import { scaleLinear } from 'd3'
import type { Gap } from '../../types'
import { SOURCES } from '../../sources/sourceStyle'
import type { HandoverEvent, Journey, Lead, Segment } from '../../journey/types'

export const MIN_PLOT_WIDTH = 560
export type Focus = { start: number; end: number } | null | undefined
export const UNKNOWN = 'Unknown'

export interface Rect { x: number; y: number; w: number; h: number }
export interface BarBox { seg: Segment; x1: number; x2: number; y: number; spans: [number, number][] }
export const isDrawn = (s: Segment) => (s as Segment & { drawn?: boolean }).drawn !== false
export interface OwnerLabel { seg: Segment; x: number; y: number; w: number; leader: boolean; barY: number; ax: number }
export interface Marker { ev: HandoverEvent; key: string; x: number; y: number; toSeg: Segment; fromSeg: Segment }
export interface EventLabel { key: string; x: number; y: number; anchor: 'start' | 'end'; w: number }
export interface Connector { x: number; y1: number; y2: number; key: string }
export interface Layout {
  width: number
  height: number
  left: number
  right: number
  top: number
  axisY: number
  rows: { place: string; y: number; unknown: boolean }[]
  bars: BarBox[]
  connectors: Connector[]
  markers: Marker[]
  eventLabels: EventLabel[]
  ownerLabels: OwnerLabel[]
  ticks: { value: number; x: number }[]
  x: (year: number) => number
  focusX: [number, number] | null
  gapBoxes: GapBox[]
  leadBoxes: LeadBox[]
  undatedLeads: Lead[]
}

export type GapInput = Pick<Gap, 'id' | 'start' | 'end' | 'kind' | 'closed'>
export interface GapBox { gap: GapInput; label: string; x1: number; x2: number; lx: number; ly: number; w: number }
export const gapLabel = (g: GapInput) => {
  const base = g.kind === 'hidden_holder' ? `Holder not named, ${g.start} to ${g.end}` : `Gap ${g.start} to ${g.end}`
  return g.closed ? `${base}, closed by added evidence` : base
}
export interface LeadBox { lead: Lead; label: string; x1: number; x2: number; y: number; lx: number; ly: number; w: number }
export const leadKey = (l: Pick<Lead, 'id'>) => `lead:${l.id}`
export const leadLabel = (l: Lead) => {
  const span = l.end == null || l.end === l.start ? `${l.start}` : `${l.start} to ${l.end}`
  return `${SOURCES[l.source].short} lead, ${span}`
}
export const isPlaced = (l: Lead) => l.start != null
export const gapKey = (g: Pick<GapInput, 'id'>) => `gap:${g.id}`

export const eventKey = (e: Pick<HandoverEvent, 'from' | 'to'>) => `${e.from}>${e.to}`

let ctx: CanvasRenderingContext2D | null | undefined
/** Text width at 11px; canvas when available, otherwise a rough per-character estimate. */
export function textWidth(text: string, size = 11, weight = 400): number {
  if (ctx === undefined) {
    try { ctx = document.createElement('canvas').getContext('2d') } catch { ctx = null }
  }
  if (ctx) {
    ctx.font = `${weight} ${size}px "Helvetica Neue", Arial, sans-serif`
    const w = ctx.measureText(text).width
    if (w > 0) return Math.max(w, text.length * size * 0.55)
  }
  return text.length * size * 0.56
}

const hit = (a: Rect, b: Rect, pad = 3) =>
  a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function computeLayout(journey: Journey, width: number, gaps: GapInput[] = [], focus: Focus = null, leads: Lead[] = []): Layout {
  const first = layoutAt(journey, width, 0, gaps, focus, leads)
  // Many stacked handover labels can climb past the top edge; shift the whole chart down by the overshoot.
  const minY = Math.min(first.top - 20, ...first.eventLabels.map((e) => e.y - 12))
  return minY < 4 ? layoutAt(journey, width, Math.ceil(4 - minY), gaps, focus, leads) : first
}

function layoutAt(journey: Journey, width: number, extra: number, allGaps: GapInput[], focus: Focus, allLeads: Lead[]): Layout {
  const { segments, events } = journey
  const byId = new Map(segments.map((s) => [s.id, s]))

  // Rows: contract order, then any place a segment uses that the list forgot; Unknown always last.
  const names = [...journey.places]
  segments.forEach((s) => { if (!names.includes(s.place)) names.push(s.place) })
  const known = names.filter((p) => p !== UNKNOWN)
  const hasUnknown = names.includes(UNKNOWN)

  const maxLabel = Math.max(0, ...names.map((p) => textWidth(p, 12)))
  const left = Math.ceil(clamp(maxLabel + 24, 72, 140))
  const right = width - 24
  const gaps = allGaps.filter((g) => g.start != null && g.end != null && g.end >= g.start)
  const placedLeads = allLeads.filter(isPlaced)
  const undatedLeads = allLeads.filter((l) => !isPlaced(l))
  const years = [...segments.flatMap((s) => [s.start, s.end]), ...gaps.flatMap((g) => [g.start as number, g.end as number]), ...(focus ? [focus.start, focus.end] : []), ...placedLeads.flatMap((l) => [l.start as number, (l.end ?? l.start) as number])]
  const lo = Math.min(...years)
  const hi = Math.max(...years)
  const pad = Math.max(3, Math.round((hi - lo) * 0.06))
  const x = scaleLinear().domain([lo - pad, hi + pad]).range([left, right]).nice(5)
  const [d0, d1] = x.domain()
  const approxTicks = Math.max(3, Math.floor((right - left) / 80))
  const ticks = x.ticks(approxTicks).filter((v) => v >= d0 && v <= d1).map((v) => ({ value: v, x: x(v) }))


  // Gap labels sit on lines below the focus-band label, stacked when they would overlap.
  const gapPlaced: { gap: GapInput; label: string; x1: number; x2: number; lx: number; w: number; line: number }[] = []
  const lineEnds: number[] = []
  for (const g of [...gaps].sort((p, q) => (p.start as number) - (q.start as number))) {
    const label = gapLabel(g)
    const w = Math.max(textWidth(label), label.length * 6)
    const x1 = clamp(x(g.start as number), left, right)
    const x2 = clamp(x(g.end as number), left, right)
    const lx = clamp(x1, 4, width - 4 - w)
    let line = lineEnds.findIndex((end) => lx > end + 8)
    if (line < 0) line = lineEnds.length
    lineEnds[line] = lx + w
    gapPlaced.push({ gap: g, label, x1, x2, lx, w, line })
  }
  const gapLines = lineEnds.length
  const top = 36 + extra
  const rowTop = 70 + extra + gapLines * 14
  const rowGap = 60
  const rows = known.map((place, i) => ({ place, y: rowTop + i * rowGap, unknown: false }))
  if (hasUnknown) {
    const last = rows.length ? rows[rows.length - 1].y : rowTop - rowGap
    rows.push({ place: UNKNOWN, y: last + rowGap + 6, unknown: true })
  }
  const rowY = new Map(rows.map((r) => [r.place, r.y]))
  const lastY = rows.length ? rows[rows.length - 1].y : rowTop

  // Safety: an owner bar never paints inside an open gap; the pieces left over are in `spans`.
  const openGaps = gapPlaced.filter((p) => !p.gap.closed).sort((p, q) => p.x1 - q.x1)
  const bars: BarBox[] = segments.filter(isDrawn).map((seg) => {
    const x1 = x(seg.start)
    const x2 = Math.max(x(seg.end), x1 + 4) // 4px minimum bar
    let spans: [number, number][] = [[x1, x2]]
    for (const g of openGaps) {
      spans = spans.flatMap(([a, b]): [number, number][] => {
        if (g.x2 <= a || g.x1 >= b) return [[a, b]]
        const out: [number, number][] = []
        if (g.x1 > a) out.push([a, g.x1])
        if (g.x2 < b) out.push([g.x2, b])
        return out
      })
    }
    return { seg, x1, x2, y: rowY.get(seg.place) ?? lastY, spans }
  })

  const connectors: Connector[] = []
  segments.forEach((s, i) => {
    const n = segments[i + 1]
    if (!n) return
    const y1 = rowY.get(s.place) ?? lastY
    const y2 = rowY.get(n.place) ?? lastY
    if (y1 !== y2 && isDrawn(s) && isDrawn(n)) connectors.push({ x: x(s.end), y1, y2, key: `${s.id}>${n.id}` })
  })

  const markers: Marker[] = []
  for (const ev of events) {
    const toSeg = byId.get(ev.to)
    const fromSeg = byId.get(ev.from)
    if (!toSeg || !fromSeg || !isDrawn(toSeg)) continue
    markers.push({ ev, key: eventKey(ev), x: x(ev.year), y: rowY.get(toSeg.place) ?? lastY, toSeg, fromSeg })
  }

  const obstacles: Rect[] = bars.map((b) => ({ x: b.x1, y: b.y - 6, w: b.x2 - b.x1, h: 12 }))
  const gapBoxes: GapBox[] = gapPlaced.map((p) => {
    const ly = top - 4 + 14 * (p.line + 1) // clear of the focus bracket above
    obstacles.push({ x: p.lx, y: ly - 10, w: p.w, h: 13 })
    return { gap: p.gap, label: p.label, x1: p.x1, x2: p.x2, lx: p.lx, ly, w: p.w }
  })
  markers.forEach((m) => obstacles.push({ x: m.x - 8, y: m.y - 8, w: 16, h: 16 }))

  // Leads: dashed ghost marks just below the lowest row, in lanes when they overlap. Never part of the chain.
  const laneEnds: number[] = []
  const leadMarks = [...placedLeads].sort((p, q) => (p.start as number) - (q.start as number)).map((lead) => {
    const x1 = clamp(x(lead.start as number), left, right)
    const x2 = Math.max(clamp(x((lead.end ?? lead.start) as number), left, right), x1 + 8)
    let lane = laneEnds.findIndex((end) => x1 > end + 4)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = x2
    const y = lastY + 16 + lane * 12
    obstacles.push({ x: x1, y: y - 5, w: x2 - x1, h: 10 })
    return { lead, x1, x2, y }
  })

  const free = (r: Rect, ...extra: Rect[]) => ![...obstacles, ...extra].some((o) => hit(r, o, 2))

  // Handover labels: above the marker, start or end side, then higher.
  const eventLabels: EventLabel[] = markers.map((m) => {
    const w = textWidth(m.ev.label, 11, 500)
    let pick: { rect: Rect; anchor: 'start' | 'end'; tx: number } | undefined
    for (let up = 24; up < 400 && !pick; up += 14) {
      for (const anchor of ['start', 'end'] as const) {
        const raw = anchor === 'start' ? m.x + 10 : m.x - 10 - w
        const x0 = clamp(raw, 4, width - 4 - w)
        const rect = { x: x0, y: m.y - up, w, h: 13 }
        if (!pick && free(rect)) pick = { rect, anchor, tx: anchor === 'start' ? x0 : x0 + w }
      }
    }
    if (!pick) {
      const x0 = clamp(m.x + 10, 4, width - 4 - w)
      pick = { rect: { x: x0, y: m.y - 24, w, h: 13 }, anchor: 'start', tx: x0 }
    }
    obstacles.push(pick.rect)
    return { key: m.key, x: pick.tx, y: pick.rect.y + 10, anchor: pick.anchor, w }
  })

  const leadBoxes: LeadBox[] = leadMarks.map(({ lead, x1, x2, y }) => {
    const label = leadLabel(lead)
    const w = Math.max(textWidth(label), label.length * 6)
    const xs = [x1, x2 - w].map((v) => clamp(v, 4, width - 4 - w))
    for (let dy = 7; dy < 400; dy += 14) {
      for (const x0 of xs) {
        const rect = { x: x0, y: y + dy, w, h: 13 }
        if (free(rect)) {
          obstacles.push(rect)
          return { lead, label, x1, x2, y, lx: x0, ly: rect.y + 10, w }
        }
      }
    }
    return { lead, label, x1, x2, y, lx: xs[0], ly: y + 17, w }
  })

  // Owner labels in the same pass: below the bar, a second line, then lower lines with a leader line.
  const ownerLabels: OwnerLabel[] = bars.map(({ seg, x1, x2, y }) => {
    const w = textWidth(seg.owner)
    const ax = (x1 + x2) / 2
    const xs = [ax - w / 2, ax - w + 8, ax - 8].map((v) => clamp(v, 4, width - 4 - w))
    for (let dy = 19; dy < 600; dy += 14) {
      const leader = dy > 33
      const leaderRect: Rect = { x: ax - 1, y: y + 6, w: 2, h: Math.max(0, dy - 22) }
      for (const x0 of leader ? xs : xs.slice(0, 1)) {
        const rect = { x: x0, y: y + dy - 10, w, h: 13 }
        if (free(rect, ...(leader ? [leaderRect] : []))) {
          obstacles.push(rect)
          if (leader) obstacles.push(leaderRect)
          return { seg, x: x0, y: y + dy, w, leader, barY: y, ax }
        }
      }
    }
    const x0 = xs[0]
    return { seg, x: x0, y: y + 19, w, leader: false, barY: y, ax }
  })

  const bottom = Math.max(lastY + 62, ...ownerLabels.map((l) => l.y + 14), ...leadBoxes.map((l) => l.ly + 4))
  const axisY = bottom + 16
  const height = axisY + 18

  return {
    width, height, left, right, top, axisY, rows, bars, connectors, markers, eventLabels, ownerLabels,
    gapBoxes, leadBoxes, undatedLeads, ticks, x, focusX: focus ? [clamp(x(focus.start), left, right), clamp(x(focus.end), left, right)] : null,
  }
}
