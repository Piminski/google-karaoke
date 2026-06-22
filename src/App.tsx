import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { KaraokeImage } from './components/KaraokeImage'
import { KaraokeText } from './components/KaraokeText'
import { karaokeStyle } from './karaokeStyle'

interface HeadlineEntry {
  text: string
  words: string[]
  imageUrls: string[]
}

interface NewsPathData {
  headlines: HeadlineEntry[]
  usingBingImages: boolean
}

async function fetchNewsPath(): Promise<NewsPathData> {
  const res = await fetch('/api/news-path')
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<NewsPathData>
}

export default function App() {
  const { data, isLoading, isFetching } = useQuery<NewsPathData>({
    queryKey: ['news-path'],
    queryFn: fetchNewsPath,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const [headlineIdx, setHeadlineIdx] = React.useState(0)
  const [wordIdx, setWordIdx] = React.useState(0)

  const headline = data?.headlines[headlineIdx]
  const words = headline?.words ?? []
  const imageUrls = headline?.imageUrls ?? []
  const displaySrc = imageUrls[wordIdx] ?? ''
  const displayWord = words[wordIdx] ?? ''

  React.useEffect(() => {
    for (const url of imageUrls) {
      const img = new Image()
      img.decoding = 'async'
      img.src = url
    }
  }, [imageUrls])

  // One timeout per word — React only updates on word boundaries (AutoSubs-style).
  React.useEffect(() => {
    if (!data?.headlines.length || !words.length) return

    let cancelled = false
    let index = 0
    let timeoutId = 0

    setWordIdx(0)

    const tick = () => {
      if (cancelled) return

      if (index >= words.length) {
        setHeadlineIdx((h) => (h + 1) % data.headlines.length)
        return
      }

      setWordIdx(index)
      index++
      timeoutId = window.setTimeout(tick, karaokeStyle.wordDurationMs)
    }

    timeoutId = window.setTimeout(tick, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [headlineIdx, data?.headlines.length, words.length])

  if ((isLoading || isFetching) && !data) {
    return (
      <div className="frame-shell">
        <div className="frame flex items-center justify-center">
          <p className="animate-pulse text-sm text-white/50">Loading headlines…</p>
        </div>
      </div>
    )
  }

  if (isLoading || !headline || !displaySrc) {
    return (
      <div className="frame-shell">
        <div className="frame" />
      </div>
    )
  }

  return (
    <div className="frame-shell">
      <div className="frame">
        <KaraokeImage src={displaySrc} word={displayWord} />
        <div className="karaoke-caption">
          <KaraokeText words={words} activeWordIndex={wordIdx} />
        </div>
      </div>
    </div>
  )
}
