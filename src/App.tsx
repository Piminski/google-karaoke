import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { KaraokeImage } from './components/KaraokeImage'
import { KaraokeText } from './components/KaraokeText'
import { AppFrame } from './components/AppFrame'
import { LoadingHeadlines } from './components/LoadingHeadlines'
import { karaokeStyle } from './karaokeStyle'

interface HeadlineEntry {
  text: string
  words: string[]
  imageUrls: string[]
  imageAlternates: string[][]
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
  const { data, isLoading, isFetching, isError, error } = useQuery<NewsPathData>({
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
  const imageAlternates = headline?.imageAlternates ?? []
  const displaySrc = imageUrls[wordIdx] ?? ''
  const displayAlternates = imageAlternates[wordIdx] ?? []
  const displayWord = words[wordIdx] ?? ''

  React.useEffect(() => {
    for (let i = 0; i < imageUrls.length; i++) {
      const urls = [imageUrls[i], ...(imageAlternates[i] ?? [])].filter(Boolean)
      for (const url of urls.slice(0, 4)) {
        const img = new Image()
        img.decoding = 'async'
        img.referrerPolicy = 'no-referrer'
        img.src = url
      }
    }
  }, [imageUrls, imageAlternates])

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

  if (isError && !data) {
    return (
      <AppFrame>
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="site-chrome site-status text-center">
            Couldn&apos;t load headlines.
            {error instanceof Error ? ` ${error.message}` : ''}
          </p>
        </div>
      </AppFrame>
    )
  }

  if ((isLoading || isFetching) && !data) {
    return (
      <AppFrame>
        <LoadingHeadlines />
      </AppFrame>
    )
  }

  if (!headline || !displaySrc) {
    return (
      <AppFrame>
        <LoadingHeadlines />
      </AppFrame>
    )
  }

  return (
    <AppFrame>
      <KaraokeImage src={displaySrc} word={displayWord} alternates={displayAlternates} />
      <div className="karaoke-caption">
        <KaraokeText words={words} activeWordIndex={wordIdx} />
      </div>
    </AppFrame>
  )
}
