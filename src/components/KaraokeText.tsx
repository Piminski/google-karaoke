import React from 'react'

import { karaokeStyle } from '../karaokeStyle'

interface KaraokeTextProps {
  words: string[]
  activeWordIndex: number
  className?: string
}

const CSS = `
  .karaoke-text {
    width: 100%;
    margin: 0;
    text-align: center;
    line-height: 1.05;
    word-break: break-word;
    overflow-wrap: break-word;
  }
  .karaoke-word {
    display: inline-block;
    transform-origin: center bottom;
    will-change: transform, opacity;
    paint-order: stroke fill;
  }
  .karaoke-word--active {
    animation: karaoke-pop-in var(--pop-duration, 200ms) ease-out;
  }
  @keyframes karaoke-pop-in {
    from {
      opacity: 0.35;
      transform: scale(0.88);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`

function fitTextToContainer(container: HTMLElement, text: HTMLElement) {
  const minPx = 9
  const maxPx = Math.min(container.clientWidth * 0.12, 32)

  if (maxPx <= minPx || container.clientHeight <= 0) return

  let lo = minPx
  let hi = maxPx
  let best = minPx

  while (lo <= hi) {
    const mid = (lo + hi) / 2
    text.style.fontSize = `${mid}px`
    const fits =
      text.scrollHeight <= container.clientHeight &&
      text.scrollWidth <= container.clientWidth

    if (fits) {
      best = mid
      lo = mid + 0.25
    } else {
      hi = mid - 0.25
    }
  }

  text.style.fontSize = `${best * karaokeStyle.textScale}px`
}

export const KaraokeText = React.memo(function KaraokeText({
  words,
  activeWordIndex,
  className = '',
}: KaraokeTextProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const textRef = React.useRef<HTMLParagraphElement>(null)
  const headlineKey = words.join(' ')

  React.useLayoutEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    fitTextToContainer(container, text)

    const observer = new ResizeObserver(() => {
      fitTextToContainer(container, text)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [headlineKey])

  const outlineStyle: React.CSSProperties = {
    WebkitTextStroke: `${karaokeStyle.outlineWidthPx}px ${karaokeStyle.outlineColor}`,
  }

  const spokenStyle: React.CSSProperties = {
    ...outlineStyle,
    color: karaokeStyle.spokenColor,
  }

  const pendingStyle: React.CSSProperties = {
    ...outlineStyle,
    color: karaokeStyle.pendingColor,
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div ref={containerRef} className="karaoke-text-fit">
        <p
          ref={textRef}
          className={`karaoke-text ${className}`}
          style={{
            fontFamily: karaokeStyle.fontFamily,
            fontWeight: karaokeStyle.fontWeight,
            ['--pop-duration' as string]: `${karaokeStyle.popInDurationMs}ms`,
          }}
        >
          {words.map((word, wordIndex) => {
            const isSpoken = wordIndex <= activeWordIndex
            const isActive = wordIndex === activeWordIndex

            return (
              <React.Fragment key={`${wordIndex}-${word}`}>
                {wordIndex > 0 && ' '}
                <span
                  className={[
                    'karaoke-word',
                    isSpoken ? 'karaoke-word--spoken' : '',
                    isActive ? 'karaoke-word--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={isSpoken ? spokenStyle : pendingStyle}
                >
                  {word}
                </span>
              </React.Fragment>
            )
          })}
        </p>
      </div>
    </>
  )
})
