import type { Gap } from '../types'
import type { FocusPeriod } from '../focus'
import type { HandoverEvent, Journey, Segment } from './types'
import type { Move, Place, PlacesFile, Route, Stay, UnplacedPeriod } from './routeTypes'

type Draft = Omit<UnplacedPeriod, 'id'>

/** Resolves a segment's label to a place, or says why it cannot be placed. */
function resolve(label: string, places: PlacesFile, byId: Map<string, Place>): Place | 'no_place' | 'unresolved_place' {
  if (label === 'Unknown') return 'no_place'
  const id = Object.hasOwn(places.labels, label) ? places.labels[label] : null
  const place = id ? byId.get(id) : undefined
  return place ?? 'unresolved_place'
}

/** Could the move, which happened between lo and hi (either may be unknown), fall inside the focus period? */
function moveInFocus(lo: number | null, hi: number | null, focus: FocusPeriod | null): boolean {
  if (!focus) return false
  if (lo !== null && hi !== null) return lo <= focus.end && hi >= focus.start
  if (lo !== null) return lo <= focus.end
  if (hi !== null) return hi >= focus.start
  return true
}

const fin = (n: number | null | undefined): number | null => (typeof n === 'number' && Number.isFinite(n) ? n : null)

/**
 * Builds the map route from the drawn segments in time order. Stays are runs of the same place; a move is
 * the step to a different place and is 'known' only when a handover event joins the two stays. A segment
 * with no place, an undrawn holder, or a derived gap between two stays breaks the route: that move is
 * 'unknown' and the period is listed as unplaced. A return to the same place after such a break is one stay.
 */
export function buildRoute(journey: Journey, places: PlacesFile, gaps: Pick<Gap, 'start' | 'end'>[], focus: FocusPeriod | null): Route {
  const byId = new Map(places.places.map((p) => [p.id, p]))
  const ordered = journey.segments.map((s, i) => ({ s, i })).sort((a, b) => a.s.start - b.s.start || a.i - b.i).map((x) => x.s)

  const drafts: Draft[] = []
  const stays: Stay[] = []
  const breaks: boolean[] = [] // breaks[k]: an unplaced segment sits between stay k-1 and stay k
  let pendingBreak = false

  const unplace = (s: Segment, reason: Draft['reason'], dated: boolean) => {
    drafts.push({ start: dated ? s.start : null, end: dated ? s.end : null, owner: s.owner, reason, segmentIds: [s.id] })
    pendingBreak = true
  }

  for (const s of ordered) {
    if (!s.drawn) { unplace(s, 'no_place', false); continue }
    const r = resolve(s.place, places, byId)
    if (r === 'no_place' || r === 'unresolved_place') { unplace(s, r, true); continue }
    const last = stays[stays.length - 1]
    if (last && last.placeId === r.id) {
      last.segmentIds.push(s.id)
      last.end = s.end
      if (!last.owners.includes(s.owner)) last.owners.push(s.owner)
    } else {
      breaks.push(pendingBreak && stays.length > 0)
      stays.push({ id: `stay-${stays.length}`, placeId: r.id, segmentIds: [s.id], start: s.start, end: s.end, owners: [s.owner] })
    }
    pendingBreak = false
  }

  const covered = (start: number, end: number) =>
    drafts.some((d) => d.reason !== 'gap' && d.start !== null && d.end !== null && d.start <= start && d.end >= end)
  const usedGaps = new Set<Pick<Gap, 'start' | 'end'>>()
  const moves: Move[] = []

  for (let k = 1; k < stays.length; k++) {
    const prev = stays[k - 1]
    const next = stays[k]
    let broken = breaks[k]
    for (const g of gaps) {
      if (g.start === null || g.end === null || usedGaps.has(g)) continue
      if (g.start >= prev.end && g.end <= next.start) {
        usedGaps.add(g)
        broken = true
        if (!covered(g.start, g.end)) drafts.push({ start: g.start, end: g.end, owner: null, reason: 'gap', segmentIds: [] })
      }
    }
    const event: HandoverEvent | undefined = broken
      ? undefined
      : journey.events.find((e) => prev.segmentIds.includes(e.from) && next.segmentIds.includes(e.to))
    const known = fin(event?.year)
    const lo = event ? known : fin(prev.end)
    const hi = event ? known : fin(next.start)
    moves.push({
      id: `move-${moves.length}`,
      order: moves.length + 1,
      from: prev.id,
      to: next.id,
      year: event ? known : fin(prev.end),
      linkType: event ? 'known' : 'unknown',
      ...(event ? { handoverType: event.type } : {}),
      inFocus: moveInFocus(lo, hi, focus),
      segmentIds: [prev.segmentIds[prev.segmentIds.length - 1], next.segmentIds[0]],
    })
  }

  const unplaced = drafts
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (a.d.start ?? Infinity) - (b.d.start ?? Infinity) || a.i - b.i)
    .map(({ d }, i) => ({ id: `unplaced-${i}`, ...d }))

  return { stays, moves, unplaced, placeIds: [...new Set(stays.map((s) => s.placeId))] }
}
