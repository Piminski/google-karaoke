import {
  getBingImageCandidates,
  isLikelyDrawing,
  isStockUrl,
  loremFallback,
  picsumFallback,
  stableHash,
} from './imageSearch.js'
import { buildValidatedPool, pickWorkingUrlsParallel } from './imageProbe.js'
import { fetchWithTimeout } from './fetchWithTimeout.js'

export interface HeadlineEntry {
  text: string
  words: string[]
  imageUrls: string[]
  imageAlternates: string[][]
}

export interface NewsPathData {
  headlines: HeadlineEntry[]
  usingBingImages: boolean
}

/** Shorter words get larger pools — they repeat more often in headlines. */
function poolSizeForWord(key: string, isVercel: boolean): number {
  const len = key.length
  let size: number
  if (len <= 2) size = 10
  else if (len <= 3) size = 8
  else if (len <= 4) size = 6
  else if (len <= 6) size = 4
  else if (len <= 8) size = 3
  else size = 2
  return isVercel ? Math.min(size, 5) : size
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
}

function splitHeadlineWords(headline: string): string[] {
  return headline.split(/\s+/).filter(Boolean)
}

function wordKey(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '') || `w${stableHash(word)}`
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

function isBingUrl(url: string, bingCandidates: string[]): boolean {
  return bingCandidates.includes(url)
}

export async function fetchNewsPath(): Promise<NewsPathData> {
  const isVercel = Boolean(process.env.VERCEL)
  const rssUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'
  const rssRes = await fetchWithTimeout(
    rssUrl,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    },
    isVercel ? 8000 : 15000,
  )

  if (!rssRes.ok) throw new Error(`RSS fetch failed: ${rssRes.status}`)

  const rssText = await rssRes.text()

  const allTitles: string[] = []
  const itemRegex = /<item>[\s\S]*?<\/item>/g
  let itemMatch = itemRegex.exec(rssText)
  while (itemMatch !== null) {
    const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(itemMatch[0])
    if (titleMatch) {
      const title = decodeHtmlEntities(titleMatch[1]).trim()
      const clean = title.replace(/\s*-\s*[^-]+$/, '').trim()
      if (clean) allTitles.push(clean)
    }
    itemMatch = itemRegex.exec(rssText)
  }

  const headlineLimit = isVercel ? 5 : 15
  const headlineTexts = allTitles.slice(0, headlineLimit)
  const poolsByWord = new Map<string, string[]>()
  const poolBuilders = new Map<string, Promise<string[]>>()
  const bingCandidatesByWord = new Map<string, string[]>()
  const wordOccurrence = new Map<string, number>()
  let bingHits = 0

  const rejectBadImage = (url: string) => isStockUrl(url) || isLikelyDrawing(url)

  async function ensurePool(word: string, key: string): Promise<string[]> {
    const cached = poolsByWord.get(key)
    if (cached) return cached

    let builder = poolBuilders.get(key)
    if (!builder) {
      builder = (async () => {
        const maxValid = poolSizeForWord(key, isVercel)
        const fallbacks = [
          loremFallback(word),
          picsumFallback(word),
          loremFallback(`${word}-alt`),
        ]

        const bingCandidates = (
          await getBingImageCandidates(word, { vercel: isVercel })
        ).filter((url) => !rejectBadImage(url))
        bingCandidatesByWord.set(key, bingCandidates)

        let pool: string[]
        if (isVercel) {
          pool = await pickWorkingUrlsParallel(bingCandidates, {
            maxValid,
            maxProbe: 12,
            timeoutMs: 2200,
            shouldSkip: rejectBadImage,
          })
        } else {
          pool = await buildValidatedPool(bingCandidates, {
            maxValid: 1,
            maxProbe: 5,
            shouldSkip: rejectBadImage,
            fallbacks: [],
          })
        }

        for (const candidate of bingCandidates) {
          if (pool.length >= maxValid) break
          if (!pool.includes(candidate)) pool.push(candidate)
        }

        if (pool.length === 0) {
          for (const fallback of fallbacks) {
            if (pool.length >= maxValid) break
            if (!pool.includes(fallback)) pool.push(fallback)
          }
        }

        poolsByWord.set(key, pool)
        return pool
      })()
      poolBuilders.set(key, builder)
    }

    return builder
  }

  async function resolveWordImages(word: string): Promise<{ primary: string; alternates: string[] }> {
    const key = wordKey(word)
    const occurrence = wordOccurrence.get(key) ?? 0
    wordOccurrence.set(key, occurrence + 1)

    const pool = await ensurePool(word, key)
    const bingCandidates = bingCandidatesByWord.get(key) ?? []
    const primary =
      pool[occurrence % pool.length] ?? pool[0] ?? bingCandidates[0] ?? loremFallback(word)

    if (isBingUrl(primary, bingCandidates)) bingHits++

    const alternates = [
      ...pool.filter((url) => url !== primary),
      ...bingCandidates.filter((url) => url !== primary && !pool.includes(url)),
    ]

    return { primary, alternates }
  }

  const headlines = await mapWithConcurrency(headlineTexts, isVercel ? 3 : 2, async (text) => {
    const words = splitHeadlineWords(text)
    const resolved = await mapWithConcurrency(words, isVercel ? 8 : 4, (word) => resolveWordImages(word))
    return {
      text,
      words,
      imageUrls: resolved.map((r) => r.primary),
      imageAlternates: resolved.map((r) => r.alternates),
    }
  })

  return {
    headlines,
    usingBingImages: bingHits > 0,
  }
}
