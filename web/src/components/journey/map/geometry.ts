import type { Move, Stay } from '../../../journey/routeTypes'

export interface Pt { x: number; y: number }

/** Quadratic arc between two pins. `bend` is a signed fraction of the distance; endpoints are pulled in by `inset` px so arrowheads sit outside the pins. */
export function arcGeometry(a: Pt, b: Pt, bend: number, inset: number) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy) || 1
  const c = { x: (a.x + b.x) / 2 - (dy / dist) * bend * dist, y: (a.y + b.y) / 2 + (dx / dist) * bend * dist }
  const pull = (p: Pt) => {
    const vx = c.x - p.x
    const vy = c.y - p.y
    const l = Math.hypot(vx, vy) || 1
    return { x: p.x + (vx / l) * inset, y: p.y + (vy / l) * inset }
  }
  const s = pull(a)
  const e = pull(b)
  const mid = { x: 0.25 * s.x + 0.5 * c.x + 0.25 * e.x, y: 0.25 * s.y + 0.5 * c.y + 0.25 * e.y }
  return { d: `M${s.x.toFixed(1)} ${s.y.toFixed(1)}Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`, control: c, mid, start: s, end: e }
}

/**
 * Signed bend for each move so that repeated moves between the same two places never share a curve.
 * The sign is taken relative to a canonical direction (place ids sorted), so a return trip lands on the other side.
 */
export function moveBends(moves: Move[], placeOf: (stayId: string) => string): Map<string, number> {
  const seen = new Map<string, number>()
  const out = new Map<string, number>()
  for (const m of moves) {
    const p = placeOf(m.from)
    const q = placeOf(m.to)
    const key = p < q ? `${p}|${q}` : `${q}|${p}`
    const k = seen.get(key) ?? 0
    seen.set(key, k + 1)
    const mag = 0.16 + 0.12 * Math.floor(k / 2)
    const side = k % 2 === 0 ? 1 : -1
    out.set(m.id, mag * side * (p < q ? 1 : -1))
  }
  return out
}

export type YearState =
  | { kind: 'at'; stay: Stay }
  | { kind: 'unknown'; last: Stay | null }

/** Where the work was in a year. Inside a stay: that stay (the latest one if two overlap). Otherwise unknown, with the last stay that ended on or before the year. */
export function stateAtYear(stays: Stay[], year: number): YearState {
  let at: Stay | null = null
  for (const s of stays) if (s.start <= year && year <= s.end && (!at || s.start >= at.start)) at = s
  if (at) return { kind: 'at', stay: at }
  let last: Stay | null = null
  for (const s of stays) if (s.start <= year && (!last || s.end >= last.end)) last = s
  return { kind: 'unknown', last }
}

/** Year bounds over stays and dated unplaced periods; null when there is nothing dated. */
export function yearSpan(stays: Stay[], unplaced: { start: number | null; end: number | null }[]): [number, number] | null {
  const ys = [...stays.flatMap((s) => [s.start, s.end]), ...unplaced.flatMap((u) => [u.start, u.end])].filter((y): y is number => y != null && Number.isFinite(y))
  return ys.length ? [Math.min(...ys), Math.max(...ys)] : null
}

export const yearsText = (start: number | null, end: number | null) =>
  start == null && end == null ? 'dates not given' : start === end ? String(start) : `${start ?? '?'} to ${end ?? '?'}`
