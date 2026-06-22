/** True when the token starts with an uppercase letter (punctuation allowed). */
export function isTitleCaseToken(token: string): boolean {
  const match = token.match(/[a-zA-Z]/)
  if (!match) return false
  return match[0] === match[0].toUpperCase()
}

function isQuoteDelimiter(headline: string, index: number): boolean {
  const ch = headline[index]
  if (ch === '"' || ch === '\u201c') return true
  if (ch === "'" || ch === '\u2018') {
    const prev = index > 0 ? headline[index - 1] : ' '
    const next = index + 1 < headline.length ? headline[index + 1] : ' '
    // Apostrophe inside a word — He'll, they'll — not a phrase delimiter.
    if (/[a-zA-Z0-9]/.test(prev) && /[a-zA-Z0-9]/.test(next)) return false
    return true
  }
  return false
}

function matchingCloseQuote(open: string): string {
  if (open === '\u201c') return '\u201d'
  if (open === '\u2018') return '\u2019'
  return open
}

function rawLetterTokens(headline: string): string[] {
  const stripped = headline.replace(/[""\u201c\u201d]/g, ' ')
  return stripped.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w))
}

/** Share of words that must look title-case for a headline to count as headline-style. */
const TITLE_CASE_HEADLINE_THRESHOLD = 0.8

/** Lowercase words common in news title case — don't penalize the headline score. */
const TITLE_CASE_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'as',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'to',
  'and',
  'but',
  'with',
  'from',
  'into',
  'over',
  'after',
  'before',
  'than',
  'that',
  'this',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
])

function normalizeForStopWord(token: string): string {
  return token.toLowerCase().replace(/[^a-z']/g, '')
}

/** 0–1 score: how headline-like (title case) this text is. */
export function titleCaseHeadlineScore(headline: string): number {
  const tokens = rawLetterTokens(headline)
  if (tokens.length === 0) return 0

  let scored = 0
  for (const token of tokens) {
    if (TITLE_CASE_STOP_WORDS.has(normalizeForStopWord(token))) {
      scored += 1
      continue
    }
    if (isTitleCaseToken(token)) scored += 1
  }

  return scored / tokens.length
}

function isMostlyTitleCaseHeadline(headline: string): boolean {
  return titleCaseHeadlineScore(headline) >= TITLE_CASE_HEADLINE_THRESHOLD
}

type Segment = { quoted: boolean; text: string }

function extractSegments(headline: string): Segment[] {
  const segments: Segment[] = []
  let i = 0

  while (i < headline.length) {
    if (isQuoteDelimiter(headline, i)) {
      const open = headline[i]
      const close = matchingCloseQuote(open)
      i++
      let content = ''
      while (i < headline.length && headline[i] !== close) {
        content += headline[i++]
      }
      if (i < headline.length) i++
      const trimmed = content.trim()
      if (trimmed) segments.push({ quoted: true, text: trimmed })
      continue
    }

    let plain = ''
    while (i < headline.length && !isQuoteDelimiter(headline, i)) {
      plain += headline[i++]
    }
    const trimmed = plain.trim()
    if (trimmed) segments.push({ quoted: false, text: trimmed })
  }

  return segments
}

function tokenizePlainSegment(text: string, groupTitleCase: boolean): string[] {
  const rawWords = text.split(/\s+/).filter(Boolean)
  if (!groupTitleCase) return rawWords

  const tokens: string[] = []
  let i = 0
  while (i < rawWords.length) {
    const current = rawWords[i]
    const next = rawWords[i + 1]
    if (next && isTitleCaseToken(current) && isTitleCaseToken(next)) {
      tokens.push(`${current} ${next}`)
      i += 2
    } else {
      tokens.push(current)
      i += 1
    }
  }
  return tokens
}

/** Split a headline into karaoke / image-search tokens. */
export function tokenizeHeadlineForSearch(headline: string): string[] {
  const segments = extractSegments(headline)
  const groupTitleCase = !isMostlyTitleCaseHeadline(headline)
  const tokens: string[] = []

  for (const segment of segments) {
    if (segment.quoted) {
      tokens.push(segment.text)
    } else {
      tokens.push(...tokenizePlainSegment(segment.text, groupTitleCase))
    }
  }

  return tokens.filter(Boolean)
}
