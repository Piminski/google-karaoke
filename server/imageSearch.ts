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
  return `${query} ${STOCK_SITE_EXCLUSIONS}`
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

function prioritizeCandidates(urls: string[]): string[] {
  const gifs: string[] = []
  const photos: string[] = []

  for (const url of urls) {
    if (isStockUrl(url) || isLikelyDrawing(url)) continue
    if (isLikelyGif(url)) gifs.push(url)
    else photos.push(url)
  }

  return [...gifs, ...photos]
}

function shuffleCandidates(urls: string[], word: string): string[] {
  const ordered = prioritizeCandidates(urls)
  if (ordered.length <= 1) return ordered
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
export async function getBingImageCandidates(word: string): Promise<string[]> {
  const style = BING_STYLES[stableHash(word) % BING_STYLES.length]
  const suffix = QUERY_SUFFIXES[stableHash(`${word}:suffix`) % QUERY_SUFFIXES.length]
  const queryPasses: { query: string; filter: string }[] = [
    { query: withStockExclusions(`${word} photo`), filter: '+filterui:photo-photo' },
    { query: withStockExclusions(`${word} gif`), filter: '+filterui:photo-animatedgif' },
    { query: withStockExclusions(`${word}${suffix}`), filter: bingFilter(style) },
    { query: withStockExclusions(`${word} meme`), filter: '+filterui:photo-photo' },
  ]

  const collected: string[] = []
  const seen = new Set<string>()

  for (const { query, filter } of queryPasses) {
    if (collected.length >= 16) break

    const url = new URL('https://www.bing.com/images/async')
    url.searchParams.set('q', query)
    url.searchParams.set('first', '0')
    url.searchParams.set('count', '35')
    url.searchParams.set('adlt', 'off')
    url.searchParams.set('mkt', 'en-US')
    if (filter) url.searchParams.set('qft', filter)

    try {
      const res = await fetch(url.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.bing.com/',
        },
      })

      if (!res.ok) continue

      const html = await res.text()
      for (const candidate of extractBingImageUrls(html)) {
        if (!seen.has(candidate)) {
          seen.add(candidate)
          collected.push(candidate)
        }
      }
    } catch {
      /* try next query */
    }
  }

  return shuffleCandidates(collected, word)
}

export { stableHash, isStockUrl, isLikelyDrawing, isLikelyGif }
