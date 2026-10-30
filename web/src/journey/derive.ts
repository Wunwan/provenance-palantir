import type { EvidenceModel } from '../generated/contract'
import { sourceOfEvent } from '../sources/sourceStyle'
import { orderPlaces, UNKNOWN_PLACE } from './regions'
import type { HandoverEvent, Journey, Segment } from './types'

type Ev = EvidenceModel['events'][number]

/** Years an approximate edge fades over ("by 1902" fades in from 1896). Display convention, not a claim. */
export const FADE_YEARS = 6
const UNKNOWN_OWNER = 'Owner and place unknown'
const UNKNOWN_PARTY = /^(unknown|unlocated)\b/i

const year = (d: string | null): number | null => {
  if (!d) return null
  const y = parseInt(d.slice(0, 4), 10)
  return Number.isNaN(y) ? null : y
}

const isSilence = (e: Ev) => e.date_start === null || e.date_end === null || e.date_start !== e.date_end

/** Chain id per event, using the app's merge rule (src/derive.ts chains()): silences with an open bound merge; -1 for exact events. */
function chainIds(events: Ev[]): number[] {
  const ids: number[] = []
  let cur = -1
  let next = 0
  events.forEach((e, i) => {
    if (!isSilence(e)) cur = -1
    else if (cur !== -1 && i > 0 && (events[i - 1].date_end === null || e.date_start === null)) {
      // joins the open chain
    } else cur = next++
    ids.push(cur)
  })
  return ids
}

const flat = (e: Ev) => [...new Set(Object.values(e.cites).flat())]

const LABEL: Record<Ev['link_type'], string> = {
  sale: 'Sold',
  gift: 'Gift',
  descent: 'Inherited',
  bequest: 'Bequeathed',
  restitution: 'Restituted',
  unknown: '',
}

/**
 * Rule: an exact event (start equals end) ends the previous holder and starts the next at that year.
 * A silence (an open bound, or start differs from end) ends the previous holder at its start (if
 * known) and starts the next at its end (if known); nobody holds the span between, and it gets no
 * marker. "until" with no start ends the previous holder at its end year (fading in). Holders inside
 * a merged silence chain, or with no dated year, are not drawn. The last holder has no span.
 */
export function deriveJourney(model: EvidenceModel, artworkId: string): Journey {
  const artwork = model.artworks.find((a) => a.id === artworkId)
  const empty: Journey = { artworkId, title: artwork?.title ?? '', segments: [], events: [], places: [] }
  const events = model.events.filter((e) => e.artwork === artworkId)
  const n = events.length
  const S = events.map((e) => year(e.date_start))
  const E = events.map((e) => year(e.date_end))
  if (![...S, ...E].some((y) => y !== null)) return empty

  const silence = events.map(isSilence)
  const chain = chainIds(events)
  const inStart = events.map((_, i) => (silence[i] ? E[i] : S[i]))
  const outEnd = events.map((e, i) => (silence[i] ? (S[i] ?? (e.precision === 'until' ? E[i] : null)) : S[i]))

  const names = new Map(model.parties.map((p) => [p.id, p.preferred_name]))
  const segments: Segment[] = []
  const handovers: HandoverEvent[] = []
  let known = ([...S, ...E].find((y) => y !== null) as number)

  events.forEach((e, i) => {
    const name = names.get(e.to_party) ?? e.to_party
    const isUnknown = UNKNOWN_PARTY.test(name)
    const nextOut = i + 1 < n ? outEnd[i + 1] : null
    const start0 = inStart[i] ?? nextOut
    const interior = chain[i] !== -1 && chain[i] === chain[i + 1]
    const drawn = !interior && start0 !== null
    if (start0 !== null) known = start0
    const start = start0 ?? known
    const end = Math.max(start, nextOut ?? start)
    const seg: Segment = {
      id: `${artworkId}:${i}`,
      owner: isUnknown ? UNKNOWN_OWNER : name,
      place: isUnknown || !e.place ? UNKNOWN_PLACE : e.place,
      start,
      end,
      kind: isUnknown ? 'unknown' : 'own',
      drawn,
      source: sourceOfEvent(e, model),
      claimIds: flat(e),
    }
    const prev = segments[i - 1]
    if (drawn && e.precision === 'by' && !silence[i]) {
      seg.start = Math.max(start - FADE_YEARS, prev?.drawn ? prev.start : start - FADE_YEARS)
      seg.fadeUntil = start
    }
    if (drawn && nextOut !== null && events[i + 1].precision === 'until') {
      seg.fadeFrom = Math.max(end - FADE_YEARS, seg.start)
    }
    segments.push(seg)

    const sameOwnerMoved = prev && events[i - 1].to_party === e.to_party && prev.place !== seg.place
    if (prev?.drawn && drawn && !silence[i] && e.link_type !== 'unknown' && !sameOwnerMoved) {
      const type = e.link_type === 'sale' ? 'sale' : e.link_type === 'restitution' ? 'restitution' : 'gift'
      const y = S[i] ?? start
      handovers.push({ year: y, type, from: prev.id, to: seg.id, label: `${LABEL[e.link_type]}, ${y}`, claimIds: flat(e) })
    }
  })

  const places = orderPlaces(segments.filter((s) => s.drawn).map((s) => s.place))
  return { ...empty, segments, events: handovers, places }
}
