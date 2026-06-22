import {
  getBingImageCandidates,
  isLikelyProperNoun,
  picsumFallback,
  shouldRejectImage,
  stableHash,
} from './imageSearch.js'
import { pickWorkingUrlsParallel } from './imageProbe.js'
import { tokenizeHeadlineForSearch } from './headlineTokens.js'
import { fetchWithTimeout } from './fetchWithTimeout.js'
import { NEWS_SOURCE_URL } from '../newsSource.js'

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
  return tokenizeHeadlineForSearch(headline)
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
  const rssUrl = NEWS_SOURCE_URL
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

  const rejectBadImage = (url: string, word: string) => shouldRejectImage(url, word)

  async function ensurePool(word: string, key: string, headline: string): Promise<string[]> {
    const cached = poolsByWord.get(key)
    if (cached) return cached

    let builder = poolBuilders.get(key)
    if (!builder) {
      builder = (async () => {
        const maxValid = poolSizeForWord(key)
        const fallbacks = [picsumFallback(word)]

        const bingCandidates = (
          await getBingImageCandidates(word, { headline })
        ).filter((url) => !rejectBadImage(url, word))
        bingCandidatesByWord.set(key, bingCandidates)

        const pool = isLikelyProperNoun(word)
          ? bingCandidates.slice(0, maxValid)
          : await pickWorkingUrlsParallel(bingCandidates, {
              maxValid,
              maxProbe: 10,
              timeoutMs: isVercel ? 2200 : 3500,
              shouldSkip: (url) => rejectBadImage(url, word),
            })

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

  async function resolveWordImages(
    word: string,
    headline: string,
  ): Promise<{ primary: string; alternates: string[] }> {
    const key = wordKey(word)
    const occurrence = wordOccurrence.get(key) ?? 0
    wordOccurrence.set(key, occurrence + 1)

    const pool = await ensurePool(word, key, headline)
    const bingCandidates = bingCandidatesByWord.get(key) ?? []
    const primary =
      pool[occurrence % pool.length] ?? pool[0] ?? bingCandidates[0] ?? picsumFallback(word)

    if (isBingUrl(primary, bingCandidates)) bingHits++

    const alternates = [
      ...pool.filter((url) => url !== primary),
      ...bingCandidates.filter((url) => url !== primary && !pool.includes(url)),
    ]

    return { primary, alternates }
  }

  const headlines = await mapWithConcurrency(headlineTexts, isVercel ? 3 : 2, async (text) => {
    const words = splitHeadlineWords(text)
    const resolved = await mapWithConcurrency(words, isVercel ? 8 : 4, (word) =>
      resolveWordImages(word, text),
    )
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
