export function stableHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function loremFallback(word: string): string {
  return `https://loremflickr.com/800/500/${encodeURIComponent(word.toLowerCase())}?lock=${stableHash(word)}`
}

export function picsumFallback(word: string): string {
  return `https://picsum.photos/seed/${stableHash(word)}/800/500`
}

export function fallbackChainForWord(word: string, primary?: string): string[] {
  const chain = [
    primary,
    loremFallback(word),
    picsumFallback(word),
    loremFallback(`${word}-alt`),
    picsumFallback(`${word}-alt`),
  ].filter((url): url is string => Boolean(url))

  return [...new Set(chain)]
}
