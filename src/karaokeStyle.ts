/** Derived from autosubs-style.autosubs-preset.json */
export const karaokeStyle = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontWeight: 400,
  /** PopInEnabled + AnimationLength */
  popInDurationMs: 200,
  /** All words — white fill */
  textColor: '#ffffff',
  /** Default outline (non-active words) */
  outlineWidthPx: 2,
  outlineColor: '#2a2a2a',
  /** Active / highlighted word */
  activeOutlineWidthPx: 2,
  activeOutlineColor: '#e53935',
  /** WORD_MS — duration each word stays on screen */
  wordDurationMs: 2400,
  /** Overall headline scale (1 = fill caption area) */
  textScale: 0.75,
} as const

/** Circular text-shadow ring — smoother corners than -webkit-text-stroke. */
export function buildRoundedTextOutline(widthPx: number, color: string): string {
  if (widthPx <= 0) return 'none'

  const shadows: string[] = []
  const rings = widthPx <= 2 ? 1 : 2

  for (let ring = 0; ring < rings; ring++) {
    const radius = widthPx - (ring * widthPx) / rings
    const steps = Math.max(16, Math.round(radius * 8))
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      shadows.push(`${x.toFixed(1)}px ${y.toFixed(1)}px 0 ${color}`)
    }
  }

  return shadows.join(', ')
}
