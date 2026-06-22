import {
  getBingImageCandidates,
  isLikelyDrawing,
  isStockUrl,
  loremFallback,
  picsumFallback,
  stableHash,
} from './imageSearch.ts'
import { firstWorkingImageUrl } from './imageProbe.ts'

export interface HeadlineEntry {
  text: string
  words: string[]
  imageUrls: string[]
}

export interface NewsPathData {
  headlines: HeadlineEntry[]
  usingBingImages: boolean
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

  const headlineTexts = allTitles.slice(0, 15)
  const imageCache = new Map<string, string>()
  let bingHits = 0

  async function getImageForWord(word: string): Promise<string> {
    const cacheKey = word.toLowerCase().replace(/[^a-z0-9]/g, '') || `w${stableHash(word)}`

    if (imageCache.has(cacheKey)) {
      return imageCache.get(cacheKey)!
    }

    const bingCandidates = (await getBingImageCandidates(word)).filter(
      (url) => !isStockUrl(url) && !isLikelyDrawing(url),
    )
    const fallbackChain = [
      ...bingCandidates,
      loremFallback(word),
      picsumFallback(word),
      loremFallback(`${word}-alt`),
    ]

    const rejectBadImage = (url: string) => isStockUrl(url) || isLikelyDrawing(url)
    const working = await firstWorkingImageUrl(fallbackChain, 8, rejectBadImage)
    const url = working ?? picsumFallback(word)

    if (bingCandidates.includes(url)) bingHits++

    imageCache.set(cacheKey, url)
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
