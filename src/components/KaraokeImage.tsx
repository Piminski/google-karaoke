import * as React from 'react'

import { fallbackChainForWord } from '../lib/imageFallback'

interface KaraokeImageProps {
  src: string
  word: string
}

export const KaraokeImage = React.memo(function KaraokeImage({ src, word }: KaraokeImageProps) {
  const candidates = React.useMemo(() => fallbackChainForWord(word, src), [word, src])
  const [candidateIdx, setCandidateIdx] = React.useState(0)

  React.useEffect(() => {
    setCandidateIdx(0)
  }, [src, word])

  const currentSrc = candidates[candidateIdx] ?? candidates[0] ?? src

  return (
    <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-black">
      <img
        key={currentSrc}
        src={currentSrc}
        alt={word}
        className="h-full w-full object-cover"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          setCandidateIdx((i) => (i + 1 < candidates.length ? i + 1 : i))
        }}
      />
    </div>
  )
})
