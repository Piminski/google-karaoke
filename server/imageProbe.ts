import { fetchWithTimeout } from './fetchWithTimeout.js'

const PROBE_TIMEOUT_MS = 3500
const PROBE_TIMEOUT_VERCEL_MS = 2200

export type ImageUrlFilter = (url: string) => boolean

export async function probeImageUrl(url: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          Range: 'bytes=0-1023',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/*,*/*;q=0.8',
        },
      },
      timeoutMs,
    )

    if (!res.ok && res.status !== 206) return false

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.startsWith('image/')) return true

    const buf = new Uint8Array(await res.arrayBuffer())
    return looksLikeImage(buf)
  } catch {
    return false
  }
}

function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true
  // WebP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true
  }
  return false
}

export async function buildValidatedPool(
  candidates: string[],
  options: {
    maxValid?: number
    maxProbe?: number
    shouldSkip?: ImageUrlFilter
    fallbacks?: string[]
  } = {},
): Promise<string[]> {
  const maxValid = options.maxValid ?? 5
  const maxProbe = options.maxProbe ?? 8
  const shouldSkip = options.shouldSkip ?? (() => false)
  const fallbacks = options.fallbacks ?? []

  const toTry = candidates.filter((url) => url && !shouldSkip(url)).slice(0, maxProbe)

  const pool: string[] = []
  for (const url of toTry) {
    if (pool.length >= maxValid) break
    if (pool.includes(url)) continue
    if (await probeImageUrl(url)) pool.push(url)
  }

  for (const fallback of fallbacks) {
    if (pool.length >= maxValid) break
    if (fallback && !pool.includes(fallback)) pool.push(fallback)
  }

  return pool.length > 0 ? pool : fallbacks.filter(Boolean).slice(0, 1)
}

/** Probe candidates in parallel batches — faster for serverless. */
export async function pickWorkingUrlsParallel(
  candidates: string[],
  options: {
    maxValid?: number
    maxProbe?: number
    timeoutMs?: number
    shouldSkip?: ImageUrlFilter
  } = {},
): Promise<string[]> {
  const maxValid = options.maxValid ?? 4
  const maxProbe = options.maxProbe ?? 10
  const timeoutMs = options.timeoutMs ?? PROBE_TIMEOUT_VERCEL_MS
  const shouldSkip = options.shouldSkip ?? (() => false)

  const toTry = candidates.filter((url) => url && !shouldSkip(url)).slice(0, maxProbe)
  const pool: string[] = []
  const batchSize = 4

  for (let i = 0; i < toTry.length && pool.length < maxValid; i += batchSize) {
    const batch = toTry.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(async (url) => ({ url, ok: await probeImageUrl(url, timeoutMs) })),
    )
    for (const { url, ok } of results) {
      if (ok && !pool.includes(url)) pool.push(url)
      if (pool.length >= maxValid) break
    }
  }

  return pool
}

export async function firstWorkingImageUrl(
  candidates: string[],
  maxTries = 6,
  shouldSkip: ImageUrlFilter = () => false,
): Promise<string | null> {
  const seen = new Set<string>()
  let tries = 0

  for (const url of candidates) {
    if (!url || seen.has(url) || shouldSkip(url)) continue
    seen.add(url)
    if (tries >= maxTries) break
    tries++
    if (await probeImageUrl(url)) return url
  }

  return null
}
