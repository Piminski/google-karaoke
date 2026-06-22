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
  activeOutlineWidthPx: 3,
  activeOutlineColor: '#e53935',
  /** WORD_MS — duration each word stays on screen */
  wordDurationMs: 2400,
  /** Overall headline scale (1 = fill caption area) */
  textScale: 0.75,
} as const
