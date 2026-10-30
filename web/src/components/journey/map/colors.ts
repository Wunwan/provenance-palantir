import { interpolateViridis, rgb } from 'd3'

/** Sampling ranges along viridis (colour-blind safe, no red or coral). Each range keeps every colour at least 3:1 against its theme background (#141416 dark, #f0ede6 light). */
export const RANGE_DARK: [number, number] = [0.35, 0.95]
export const RANGE_LIGHT: [number, number] = [0.02, 0.5]

/** Colour of move i of n, following time order. */
export function moveColor(i: number, n: number, range: [number, number] = RANGE_DARK): string {
  const t = n <= 1 ? 0.5 : i / (n - 1)
  return rgb(interpolateViridis(range[0] + (range[1] - range[0]) * t)).formatHex()
}

function luminance(hex: string): number {
  const c = rgb(hex)
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
}
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

export const INK_DARK = '#000000'
export const INK_LIGHT = '#ffffff'
/** Number colour for a badge: whichever of dark and light ink reads better on the fill. */
export function inkFor(fill: string): string {
  return contrast(fill, INK_DARK) >= contrast(fill, INK_LIGHT) ? INK_DARK : INK_LIGHT
}

/** Pin fill and outline per theme, with the page background and the land fill (gap fill over the background) they sit on. map.css uses the same values. */
export const PIN_COLORS = {
  dark: { fill: '#ece9e2', edge: '#141416', bg: '#141416', land: '#232325' },
  light: { fill: '#1a1a1a', edge: '#f0ede6', bg: '#f0ede6', land: '#e2dfd8' },
} as const
