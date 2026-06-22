/** Derived from autosubs-style.autosubs-preset.json */
export const karaokeStyle = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontWeight: 400,
  /** PopInEnabled + AnimationLength */
  popInDurationMs: 200,
  /** Future / unspoken words */
  pendingColor: 'rgba(110, 181, 255, 0.55)',
  /** FillEnabled — spoken words */
  spokenColor: '#ffffff',
  /** OutlineEnabled */
  outlineWidthPx: 2,
  outlineColor: '#2a2a2a',
  /** WORD_MS — duration each word stays on screen */
  wordDurationMs: 2400,
  /** Overall headline scale (1 = fill caption area) */
  textScale: 0.75,
} as const
