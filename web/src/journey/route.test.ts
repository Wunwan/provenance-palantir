import { describe, expect, it } from 'vitest'
import type { EvidenceModel } from '../generated/contract'
import evidence from '../generated/evidence.json'
import { deriveJourney } from './derive'
import { buildRoute } from './route'
import type { HandoverEvent, Journey, Segment } from './types'
import type { Place, PlacesFile } from './routeTypes'

const place = (id: string, label: string, lat = 1, lon = 1): Place =>
  ({ id, label, lat, lon, precision: 'city', source: 'manual', retrievedAt: '2026-01-01' })
const PLACES: PlacesFile = {
  places: [place('paris', 'Paris'), place('berlin', 'Berlin'), place('london', 'London')],
  labels: { Paris: 'paris', Berlin: 'berlin', London: 'london', Atlantis: null },
}
const seg = (n: number, label: string, start: number, end: number, o: Partial<Segment> = {}): Segment =>
  ({ id: `s${n}`, owner: `Owner ${n}`, place: label, start, end, kind: 'own', drawn: true, source: 'cleveland', claimIds: [], ...o })
const hand = (from: number, to: number, year: number, type: HandoverEvent['type'] = 'sale'): HandoverEvent =>
  ({ year, type, from: `s${from}`, to: `s${to}`, label: '', claimIds: [] })
const journey = (segments: Segment[], events: HandoverEvent[] = []): Journey =>
  ({ artworkId: 'a', title: 'T', segments, events, places: [] })
const NAZI = { start: 1933, end: 1945 }

describe('buildRoute', () => {
  it('merges consecutive segments in the same city into one stay', () => {
    const r = buildRoute(journey([seg(0, 'Paris', 1900, 1910), seg(1, 'Paris', 1910, 1920), seg(2, 'Berlin', 1920, 1930)], [hand(0, 1, 1910), hand(1, 2, 1920)]), PLACES, [], null)
    expect(r.stays.map((s) => [s.placeId, s.start, s.end, s.segmentIds, s.owners])).toEqual([
      ['paris', 1900, 1920, ['s0', 's1'], ['Owner 0', 'Owner 1']],
      ['berlin', 1920, 1930, ['s2'], ['Owner 2']],
    ])
    expect(r.moves).toHaveLength(1)
  })

  it('handles a return to a city: stays A, B, A', () => {
    const r = buildRoute(journey([seg(0, 'Paris', 1900, 1910), seg(1, 'Berlin', 1910, 1920), seg(2, 'Paris', 1920, 1930)], [hand(0, 1, 1910), hand(1, 2, 1920, 'gift')]), PLACES, [], null)
    expect(r.stays.map((s) => s.placeId)).toEqual(['paris', 'berlin', 'paris'])
    expect(r.moves.map((m) => [m.order, m.from, m.to, m.year, m.linkType, m.handoverType])).toEqual([
      [1, 'stay-0', 'stay-1', 1910, 'known', 'sale'],
      [2, 'stay-1', 'stay-2', 1920, 'known', 'gift'],
    ])
    expect(r.placeIds).toEqual(['paris', 'berlin'])
  })

  it('treats a derived gap between places as unplaced and the move as unknown', () => {
    const r = buildRoute(journey([seg(0, 'Paris', 1900, 1910), seg(1, 'Berlin', 1920, 1930)]), PLACES, [{ start: 1910, end: 1920 }, { start: null, end: 1950 }], null)
    expect(r.unplaced).toEqual([{ id: 'unplaced-0', start: 1910, end: 1920, owner: null, reason: 'gap', segmentIds: [] }])
    expect(r.moves[0]).toMatchObject({ linkType: 'unknown', year: 1910 })
    expect(r.moves[0].handoverType).toBeUndefined()
  })

  it('separates a known handover from an unknown link between touching segments', () => {
    const segs = [seg(0, 'Paris', 1900, 1910), seg(1, 'Berlin', 1910, 1920), seg(2, 'London', 1920, 1930)]
    const r = buildRoute(journey(segs, [hand(0, 1, 1910, 'seizure')]), PLACES, [], null)
    expect(r.moves.map((m) => [m.linkType, m.handoverType, m.segmentIds])).toEqual([
      ['known', 'seizure', ['s0', 's1']],
      ['unknown', undefined, ['s1', 's2']],
    ])
  })

  it('lets an Unknown segment break the route even with a matching event', () => {
    const segs = [seg(0, 'Paris', 1900, 1910), seg(1, 'Unknown', 1910, 1920), seg(2, 'Berlin', 1920, 1930)]
    const r = buildRoute(journey(segs, [hand(0, 2, 1920)]), PLACES, [{ start: 1910, end: 1920 }], null)
    expect(r.moves).toHaveLength(1)
    expect(r.moves[0].linkType).toBe('unknown')
    expect(r.unplaced).toEqual([{ id: 'unplaced-0', start: 1910, end: 1920, owner: 'Owner 1', reason: 'no_place', segmentIds: ['s1'] }])
  })

  it('lists undrawn segments as unplaced without dates', () => {
    const segs = [seg(0, 'Paris', 1900, 1910), seg(1, 'Berlin', 1910, 1910, { drawn: false }), seg(2, 'London', 1920, 1930)]
    const r = buildRoute(journey(segs), PLACES, [], null)
    expect(r.stays.map((s) => s.placeId)).toEqual(['paris', 'london'])
    expect(r.unplaced).toEqual([{ id: 'unplaced-0', start: null, end: null, owner: 'Owner 1', reason: 'no_place', segmentIds: ['s1'] }])
    expect(r.moves[0].linkType).toBe('unknown')
  })

  it('reports ambiguous and unresolved labels as unplaced', () => {
    const segs = [seg(0, 'Atlantis', 1900, 1910), seg(1, 'Nowhere', 1910, 1920), seg(2, 'Paris', 1920, 1930)]
    const r = buildRoute(journey(segs), PLACES, [], null)
    expect(r.unplaced.map((u) => [u.reason, u.segmentIds])).toEqual([['unresolved_place', ['s0']], ['unresolved_place', ['s1']]])
    expect(r.stays).toHaveLength(1)
    expect(r.moves).toEqual([])
  })

  it('returns no stays for an empty or all-unplaced journey', () => {
    expect(buildRoute(journey([]), PLACES, [], null)).toEqual({ stays: [], moves: [], unplaced: [], placeIds: [] })
    const r = buildRoute(journey([seg(0, 'Unknown', 1900, 1910)]), PLACES, [], null)
    expect(r.stays).toEqual([])
    expect(r.unplaced).toHaveLength(1)
  })

  it('does not duplicate a gap already covered by an unplaced segment', () => {
    const segs = [seg(0, 'Paris', 1900, 1910), seg(1, 'Unknown', 1910, 1920), seg(2, 'Berlin', 1920, 1930)]
    const r = buildRoute(journey(segs), PLACES, [{ start: 1910, end: 1920 }], null)
    expect(r.unplaced).toHaveLength(1)
  })

  it('marks moves in focus only when a focus is set and overlaps', () => {
    const segs = [seg(0, 'Paris', 1900, 1938), seg(1, 'Berlin', 1938, 1950), seg(2, 'London', 1950, 1960)]
    const ev = [hand(0, 1, 1938)]
    expect(buildRoute(journey(segs, ev), PLACES, [], null).moves.map((m) => m.inFocus)).toEqual([false, false])
    expect(buildRoute(journey(segs, ev), PLACES, [], NAZI).moves.map((m) => m.inFocus)).toEqual([true, false])
  })
})

describe('buildRoute on the real artworks', () => {
  it('derives a consistent route for all 16', () => {
    const model = evidence as unknown as EvidenceModel
    const ids = model.artworks.map((a) => a.id)
    const journeys = ids.map((id) => deriveJourney(model, id))
    const labels = [...new Set(journeys.flatMap((j) => j.segments.map((s) => s.place)))].filter((l) => l !== 'Unknown')
    const fake: PlacesFile = {
      places: labels.map((l, i) => place(`p${i}`, l, i, i)),
      labels: Object.fromEntries(labels.map((l, i) => [l, `p${i}`])),
    }
    for (const j of journeys) {
      const r = buildRoute(j, fake, [], NAZI)
      if (r.stays.length) expect(r.moves).toHaveLength(r.stays.length - 1)
      const segIds = new Set(j.segments.map((s) => s.id))
      const refs = [...r.stays.flatMap((s) => s.segmentIds), ...r.moves.flatMap((m) => m.segmentIds), ...r.unplaced.flatMap((u) => u.segmentIds)]
      for (const id of refs) expect(segIds.has(id)).toBe(true)
      expect(r.placeIds).not.toContain('Unknown')
      expect(r.stays.every((s) => s.placeId !== 'Unknown')).toBe(true)
    }
  })
})
