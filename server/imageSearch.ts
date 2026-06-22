import { fetchWithTimeout } from './fetchWithTimeout.js'

const BING_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.bing.com/',
} as const

const STOCK_HOSTS = [
  'shutterstock.com',
  'gettyimages.com',
  'istockphoto.com',
  'istock.com',
  'media.istockphoto.com',
  'depositphotos.com',
  'stock.adobe.com',
  'adobestock.com',
  'fotolia.com',
  'ftcdn.net',
  'alamy.com',
  'dreamstime.com',
  '123rf.com',
  'unsplash.com',
  'pexels.com',
  'pixabay.com',
  'freepik.com',
  'vectorstock.com',
  'canva.com',
  'bigstockphoto.com',
  'stocksy.com',
  'pond5.com',
  'storyblocks.com',
  'photodune.net',
  'graphicriver.net',
  'envato.com',
  'elements.envato.com',
  'rawpixel.com',
  'stocksnap.io',
  'burst.shopify.com',
  'colourbox.com',
  'agefotostock.com',
  'imagebroker.com',
  'panthermedia.net',
  'yayimages.com',
  'wirestock.io',
  'stockfresh.com',
  'stockvault.net',
  'westend61.de',
  'stockfood.com',
  'crestock.com',
  'fotosearch.com',
  'superstock.com',
  'sciencephoto.com',
  'lookstock.com',
  'masterfile.com',
  'photos.com',
]

const STOCK_URL_HINTS = [
  'stock-photo',
  'stockphoto',
  'stock_photo',
  'stock-image',
  'stockimage',
  '/stock/',
  '/stocks/',
  'royalty-free',
  'watermark',
  'watermarked',
  'preview-only',
  'licensed-image',
  'commercial-photo',
]

/** Bing site: exclusions appended to every image query. */
const STOCK_SITE_EXCLUSIONS =
  '-site:shutterstock.com -site:gettyimages.com -site:istockphoto.com -site:depositphotos.com -site:alamy.com -site:dreamstime.com -site:123rf.com -site:stock.adobe.com -site:adobestock.com -site:freepik.com -site:pexels.com -site:unsplash.com -site:pixabay.com -site:stocksy.com -site:pond5.com'

const ADULT_SITE_EXCLUSIONS =
  '-site:pornhub.com -site:xvideos.com -site:xnxx.com -site:xhamster.com -site:nudevista.com -site:spankbang.com -site:onlyfans.com'

/** Photos + GIFs — no clipart/line art Bing filters. */
const BING_STYLES = ['photo', 'photo', 'gif', 'photo'] as const

const QUERY_SUFFIXES = ['', ' photo', ' gif', ' meme', ' screenshot', ' vintage', ' weird']

const GIF_URL_HINTS = [
  'giphy.com',
  'tenor.com',
  'media.tumblr.com',
  'i.imgur.com',
  '/gif/',
  '-gif.',
  '_gif.',
]

const ADULT_HOSTS = [
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'nudevista.com',
  'spankbang.com',
  'eporner.com',
  'tube8.com',
  'beeg.com',
  'onlyfans.com',
  'chaturbate.com',
  'livejasmin.com',
  'stripchat.com',
  'bongacams.com',
  'cam4.com',
  'rule34',
  'e621.net',
]

const ADULT_URL_HINTS = [
  '/porn/',
  '/xxx/',
  'pornstar',
  'nude',
  'nsfw',
  'adult-video',
  'adultphoto',
]

/** Domains that usually carry news photography — prefer for people/places in headlines. */
const NEWS_HOST_HINTS = [
  'reuters.com',
  'apnews.com',
  'bbc.co',
  'bbc.com',
  'nytimes.com',
  'washingtonpost.com',
  'theguardian.com',
  'cnn.com',
  'foxnews.com',
  'nbcnews.com',
  'cbsnews.com',
  'abcnews',
  'politico.com',
  'politico.eu',
  'axios.com',
  'bloomberg.com',
  'ft.com',
  'economist.com',
  'npr.org',
  'sky.com',
  'telegraph.co',
  'independent.co',
  'huffpost.com',
  'newsweek.com',
  'time.com',
  'wikimedia.org',
  'wikipedia.org',
  'parliament.uk',
  'britannica.com',
]

/** Product, social, or tabloid hosts — poor results for named people in news. */
const LOW_QUALITY_HOST_HINTS = [
  'pinimg.com',
  'pinterest.',
  'etsystatic.com',
  'etsy.com',
  'ebay.',
  'amazon.com',
  'aliexpress.',
  'wish.com',
  'nickiswift.com',
  'thelist.com',
  'cheatsheet.com',
  'ranker.com',
  'buzzfeed.com',
  'dailymail.co.uk',
  'goldposter.com',
  'cinematerial.com',
  'kinorium.com',
  'next-episode.net',
  'scifiscene.de',
  'zastavki.com',
  'getwallpapers.com',
  'pixelstalk.net',
  'wallpaper',
  'wallpapers',
  'moewalls.com',
  'kawaii',
  'bestinau.com.au',
]

const ENTERTAINMENT_URL_HINTS = [
  '/poster',
  '_poster',
  '-poster',
  '/movie/',
  '/cast/',
  '/actor/',
  'movie-poster',
  'tv-poster',
  'season-',
]

function headlineSearchContext(headline: string, word: string): string {
  const cleaned = headline.replace(/\s*-\s*[^-]+$/, '').trim()
  const stop = new Set([
    'says',
    'said',
    'the',
    'a',
    'an',
    'as',
    'in',
    'on',
    'at',
    'to',
    'for',
    'and',
    'or',
    'but',
    'he',
    'she',
    'they',
    'will',
    'yet',
    'again',
    'after',
    'before',
    'with',
    'from',
    'into',
    'over',
    'under',
    'about',
  ])
  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '') !== word.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((w) => !stop.has(w.toLowerCase().replace(/[^a-z']/g, '')))
  return words.slice(0, 4).join(' ').slice(0, 40)
}

function headlineRoleHints(headline: string): string[] {
  const lower = headline.toLowerCase()
  const hints: string[] = []
  if (lower.includes('prime minister')) hints.push('prime minister')
  if (lower.includes('vice president')) hints.push('vice president')
  if (lower.includes('president')) hints.push('president')
  if (lower.includes('senator')) hints.push('senator')
  if (lower.includes('minister')) hints.push('minister')
  if (/\buk\b/.test(lower) || lower.includes('british')) hints.push('UK')
  if (lower.includes('u.s.') || lower.includes('american')) hints.push('US')
  return hints
}

async function resolveProperNounSearchTerms(
  word: string,
  headline?: string,
): Promise<string[]> {
  const lowerHeadline = (headline ?? '').toLowerCase()

  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(word)}&limit=5&format=json`
    const res = await fetchWithTimeout(apiUrl, {}, 3000)
    if (!res.ok) return [word]

    const json = (await res.json()) as [string, string[]]
    const suggestions = json[1]?.filter(Boolean) ?? []
    if (suggestions.length === 0) return [word]

    const ranked = suggestions
      .map((name, index) => {
        let score = 0
        const lowerName = name.toLowerCase()
        if (lowerName !== word.toLowerCase()) score += 10
        if (name.includes(' ')) score += 3
        score -= index * 0.1

        for (const part of lowerName.split(/\s+/)) {
          if (part.length > 2 && lowerHeadline.includes(part)) score += 6
        }
        if (lowerHeadline.includes('trump') && lowerName.includes('jd vance')) score += 15
        if (lowerHeadline.includes('usha') && lowerName.includes('usha')) score += 15
        if (lowerHeadline.includes('keir') && lowerName.includes('keir')) score += 15

        return { name, score }
      })
      .sort((a, b) => b.score - a.score)

    const best = ranked[0]?.name ?? word
    return [...new Set([best, word, ...ranked.map((r) => r.name)])]
  } catch {
    /* best-effort */
  }

  return [word]
}

async function getWikipediaThumbnail(title: string): Promise<string | null> {
  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&pithumbsize=800&format=json`
    const res = await fetchWithTimeout(apiUrl, {}, 3000)
    if (!res.ok) return null
    const json = (await res.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source?: string } }> }
    }
    const pages = json.query?.pages ?? {}
    for (const page of Object.values(pages)) {
      const src = page.thumbnail?.source
      if (src) return src
    }
  } catch {
    /* best-effort */
  }
  return null
}

function buildQueryPasses(
  word: string,
  headline: string | undefined,
  searchTerms: string[],
): { query: string; filter: string }[] {
  const properNoun = isLikelyProperNoun(word)
  const context = headline ? headlineSearchContext(headline, word) : ''
  const roles = headline ? headlineRoleHints(headline) : []
  const primaryTerm = searchTerms[0] ?? word
  const photoFilter = '+filterui:photo-photo'

  if (properNoun) {
    const passes: { query: string; filter: string }[] = [
      { query: withStockExclusions(`${primaryTerm} photo`), filter: photoFilter },
    ]
    for (const role of roles.slice(0, 2)) {
      passes.push({
        query: withStockExclusions(`${primaryTerm} ${role} photo`),
        filter: photoFilter,
      })
    }
    if (context) {
      passes.push({
        query: withStockExclusions(`${primaryTerm} ${context} photo`),
        filter: photoFilter,
      })
    }
    if (primaryTerm.toLowerCase() !== word.toLowerCase()) {
      passes.push({ query: withStockExclusions(`${word} photo`), filter: photoFilter })
    }
    return passes
  }

  const style = BING_STYLES[stableHash(word) % BING_STYLES.length]
  const suffix = QUERY_SUFFIXES[stableHash(`${word}:suffix`) % QUERY_SUFFIXES.length]
  return [
    { query: withStockExclusions(`${word} photo`), filter: '+filterui:photo-photo' },
    { query: withStockExclusions(`${word} gif`), filter: '+filterui:photo-animatedgif' },
    { query: withStockExclusions(`${word}${suffix}`), filter: bingFilter(style) },
    { query: withStockExclusions(`${word} meme`), filter: '+filterui:photo-photo' },
  ]
}

const DRAWING_URL_HINTS = [
  'clipart',
  'clip-art',
  'lineart',
  'line-art',
  'linedrawing',
  'line-drawing',
  'vector',
  '.svg',
  '/svg/',
  'illustration',
  'sketch',
  'drawing',
  '/icon',
  'icon-',
  '-icon',
  'black-and-white',
  'blackandwhite',
  'grayscale',
  'greyscale',
  'outline',
  'stencil',
  'coloring',
  'colouring',
  'silhouette',
  'pictogram',
  'diagram',
  'etching',
  'engraving',
]

function bingFilter(style: (typeof BING_STYLES)[number]): string {
  switch (style) {
    case 'photo':
      return '+filterui:photo-photo'
    case 'gif':
      return '+filterui:photo-animatedgif'
    default:
      return ''
  }
}

function isLikelyDrawing(url: string): boolean {
  const lower = url.toLowerCase()
  return DRAWING_URL_HINTS.some((hint) => lower.includes(hint))
}

function isAdultUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (ADULT_HOSTS.some((host) => lower.includes(host))) return true
  return ADULT_URL_HINTS.some((hint) => lower.includes(hint))
}

function isLikelyNews(url: string): boolean {
  const lower = url.toLowerCase()
  return NEWS_HOST_HINTS.some((hint) => lower.includes(hint))
}

function isLowQualityForProperNoun(url: string): boolean {
  const lower = url.toLowerCase()
  if (LOW_QUALITY_HOST_HINTS.some((hint) => lower.includes(hint))) return true
  return ENTERTAINMENT_URL_HINTS.some((hint) => lower.includes(hint))
}

export function isLikelyProperNoun(word: string): boolean {
  return /^[A-Z][a-z]+(?:[''\u2019][a-z]+)?$/.test(word) || /^[A-Z]{2,}$/.test(word)
}

function isLikelyGif(url: string): boolean {
  const lower = url.toLowerCase()
  if (/\.gif(?:[?#]|$)/.test(lower)) return true
  return GIF_URL_HINTS.some((hint) => lower.includes(hint))
}

function decodeBingUrl(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\\u0026/g, '&')
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/')
}

function isStockUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (STOCK_HOSTS.some((host) => lower.includes(host))) return true
  return STOCK_URL_HINTS.some((hint) => lower.includes(hint))
}

function withStockExclusions(query: string): string {
  return `${query} ${STOCK_SITE_EXCLUSIONS} ${ADULT_SITE_EXCLUSIONS}`
}

function extractBingImageUrls(html: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()

  const patterns = [
    /murl&quot;:&quot;(.*?)&quot;/g,
    /"murl":"(.*?)"/g,
    /&quot;murl&quot;:&quot;(.*?)&quot;/g,
  ]

  for (const regex of patterns) {
    let match = regex.exec(html)
    while (match !== null) {
      const url = decodeBingUrl(match[1])
      if (
        url.startsWith('http') &&
        !isStockUrl(url) &&
        !isLikelyDrawing(url) &&
        !isAdultUrl(url) &&
        !seen.has(url)
      ) {
        seen.add(url)
        urls.push(url)
      }
      match = regex.exec(html)
    }
  }

  return urls
}

function stableHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function prioritizeCandidates(urls: string[], properNoun = false): string[] {
  const news: string[] = []
  const gifs: string[] = []
  const photos: string[] = []
  const lowQuality: string[] = []

  for (const url of urls) {
    if (isStockUrl(url) || isLikelyDrawing(url) || isAdultUrl(url)) continue
    if (properNoun && isLowQualityForProperNoun(url)) {
      lowQuality.push(url)
      continue
    }
    if (isLikelyNews(url)) news.push(url)
    else if (isLikelyGif(url)) gifs.push(url)
    else photos.push(url)
  }

  if (properNoun) return [...news, ...photos, ...gifs, ...lowQuality]
  return [...gifs, ...photos]
}

function shuffleCandidates(urls: string[], word: string, properNoun = false): string[] {
  const ordered = prioritizeCandidates(urls, properNoun)
  if (properNoun || ordered.length <= 1) return ordered
  const start = stableHash(word) % ordered.length
  return [...ordered.slice(start), ...ordered.slice(0, start)]
}

export function loremFallback(word: string): string {
  return `https://loremflickr.com/800/500/${encodeURIComponent(word.toLowerCase())}?lock=${stableHash(word)}`
}

export function picsumFallback(word: string): string {
  return `https://picsum.photos/seed/${stableHash(word)}/800/500`
}

/** Return several Bing image URLs for a word, best-effort. */
export async function getBingImageCandidates(
  word: string,
  options: { headline?: string } = {},
): Promise<string[]> {
  const properNoun = isLikelyProperNoun(word)
  const searchTerms = properNoun
    ? await resolveProperNounSearchTerms(word, options.headline)
    : [word]
  const queryPasses = buildQueryPasses(word, options.headline, searchTerms)
  const targetCount = 16
  const fetchTimeoutMs = 6000
  const resultCount = '35'

  async function runPass({ query, filter }: { query: string; filter: string }): Promise<string[]> {
    const url = new URL('https://www.bing.com/images/async')
    url.searchParams.set('q', query)
    url.searchParams.set('first', '0')
    url.searchParams.set('count', resultCount)
    url.searchParams.set('adlt', 'off')
    url.searchParams.set('mkt', 'en-US')
    if (filter) url.searchParams.set('qft', filter)

    try {
      const res = await fetchWithTimeout(url.toString(), { headers: BING_HEADERS }, fetchTimeoutMs)
      if (!res.ok) return []
      const html = await res.text()
      return extractBingImageUrls(html)
    } catch {
      return []
    }
  }

  const collected: string[] = []
  const seen = new Set<string>()

  function mergeUrls(urls: string[]) {
    for (const candidate of urls) {
      if (collected.length >= targetCount) return
      if (!seen.has(candidate)) {
        seen.add(candidate)
        collected.push(candidate)
      }
    }
  }

  const passResults = await Promise.all(queryPasses.map(runPass))
  for (const urls of passResults) mergeUrls(urls)

  if (properNoun) {
    const wikiThumb = await getWikipediaThumbnail(searchTerms[0] ?? word)
    if (wikiThumb && !seen.has(wikiThumb)) {
      collected.unshift(wikiThumb)
      seen.add(wikiThumb)
    }
  }

  return shuffleCandidates(collected, word, properNoun)
}

export function shouldRejectImage(url: string, word?: string): boolean {
  if (isStockUrl(url) || isLikelyDrawing(url) || isAdultUrl(url)) return true
  if (word && isLikelyProperNoun(word) && isLowQualityForProperNoun(url)) return true
  return false
}

export { stableHash, isStockUrl, isLikelyDrawing, isLikelyGif, isAdultUrl }
