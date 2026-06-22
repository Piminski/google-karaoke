const PROBE_TIMEOUT_MS = 3500

export type ImageUrlFilter = (url: string) => boolean

export async function probeImageUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-1023',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'image/*,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!res.ok && res.status !== 206) return false

    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.startsWith('image/')) return true

    // Some hosts omit content-type on Range responses — sniff magic bytes.
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
