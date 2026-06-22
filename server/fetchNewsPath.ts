import {
  getBingImageCandidates,
  isLikelyDrawing,
  isStockUrl,
  loremFallback,
  picsumFallback,
  stableHash,
} from './imageSearch.ts'
import { buildValidatedPool } from './imageProbe.ts'

export interface HeadlineEntry {
  text: string
  words: string[]
  imageUrls: string[]
}

export interface NewsPathData {
  headlines: HeadlineEntry[]
  usingBingImages: boolean
}

/** Shorter words get larger pools — they repeat more often in headlines. */
function poolSizeForWord(key: string): number {
  const len = key.length
  if (len <= 2) return 10
  if (len <= 3) return 8
  if (len <= 4) return 6
  if (len <= 6) return 4
  if (len <= 8) return 3
  return 2
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

export async function fetchNewsPath(): Promise<NewsPathData> {
  const rssUrl = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'
  const rssRes = await fetch(rssUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
  })

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

  const headlineLimit = process.env.VERCEL ? 10 : 15
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
        const bingCandidates = (await getBingImageCandidates(word)).filter(
          (url) => !rejectBadImage(url),
        )
        bingCandidatesByWord.set(key, bingCandidates)

        const maxValid = poolSizeForWord(key)
        const pool = await buildValidatedPool(bingCandidates, {
          maxValid: 1,
          maxProbe: 5,
          shouldSkip: rejectBadImage,
          fallbacks: [
            loremFallback(word),
            picsumFallback(word),
            loremFallback(`${word}-alt`),
          ],
        })

        for (const candidate of bingCandidates) {
          if (pool.length >= maxValid) break
          if (!pool.includes(candidate)) pool.push(candidate)
        }

        let pad = 0
        while (pool.length < maxValid) {
          const fallback =
            pad % 2 === 0
              ? loremFallback(`${word}-${pad}`)
              : picsumFallback(`${word}-${pad}`)
          if (!pool.includes(fallback)) pool.push(fallback)
          else pool.push(picsumFallback(`${word}-x${pad}-${stableHash(word)}`))
          pad++
        }

        poolsByWord.set(key, pool)
        return pool
      })()
      poolBuilders.set(key, builder)
    }

    return builder
  }

  async function getImageForWord(word: string): Promise<string> {
    const key = wordKey(word)
    const occurrence = wordOccurrence.get(key) ?? 0
    wordOccurrence.set(key, occurrence + 1)

    const pool = await ensurePool(word, key)
    const url = pool[occurrence % pool.length]

    const bingCandidates = bingCandidatesByWord.get(key) ?? []
    if (bingCandidates.includes(url)) bingHits++

    return url
  }

  const headlines = await mapWithConcurrency(headlineTexts, 2, async (text) => {
    const words = splitHeadlineWords(text)
    const imageUrls = await mapWithConcurrency(words, 4, (word) => getImageForWord(word))
    return { text, words, imageUrls }
  })

  return {
    headlines,
    usingBingImages: bingHits > 0,
  }
}
