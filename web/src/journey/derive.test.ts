import { describe, expect, it } from 'vitest'
import type { EvidenceModel } from '../generated/contract'
import evidence from '../generated/evidence.json'
import { derive } from '../derive'
import { deriveJourney } from './derive'

type Ev = EvidenceModel['events'][number]
const ev = (n: number, to: string, o: Partial<Ev> = {}): Ev => ({
  id: `e${n}`, artwork: 'a1', from_party: 'p0', to_party: to, link_type: 'sale',
  date_start: null, date_end: null, precision: 'exact', certainty: 'confirmed', place: null,
  cites: { to_party: [`c${n}`], date_start: [`c${n}`, `d${n}`] }, ...o,
})
const model = (events: Ev[]): EvidenceModel => ({
  collections: [], source_records: [], claims: [], party_aliases: [],
  artworks: [{ id: 'a1', title: 'Test Work' } as EvidenceModel['artworks'][number]],
  parties: [
    { id: 'p1', preferred_name: 'Ann', kind: 'person', life_dates: null },
    { id: 'p2', preferred_name: 'Bob', kind: 'person', life_dates: null },
    { id: 'p3', preferred_name: 'Unlocated', kind: 'person', life_dates: null },
  ] as EvidenceModel['parties'],
  events,
})
const dated = (n: number, to: string, y: string, o: Partial<Ev> = {}) =>
  ev(n, to, { date_start: y, date_end: y, ...o })

describe('deriveJourney', () => {
  it('chains an ordinary sale', () => {
    const j = deriveJourney(model([dated(1, 'p1', '1900', { place: 'Paris' }), dated(2, 'p2', '1920', { place: 'Paris' })]), 'a1')
    expect(j.title).toBe('Test Work')
    expect(j.segments.map((s) => [s.id, s.owner, s.start, s.end, s.kind])).toEqual([
      ['a1:0', 'Ann', 1900, 1920, 'own'],
      ['a1:1', 'Bob', 1920, 1920, 'own'],
    ])
    expect(j.events).toEqual([{ year: 1920, type: 'sale', from: 'a1:0', to: 'a1:1', label: 'Sold, 1920', claimIds: ['c2', 'd2'] }])
  })

  it('fades only the approximate start (on an exact handover)', () => {
    const j = deriveJourney(model([dated(1, 'p1', '1890'), dated(2, 'p2', '1902', { precision: 'by' })]), 'a1')
    expect(j.segments[1]).toMatchObject({ start: 1896, fadeUntil: 1902 })
    expect(j.segments[1].fadeFrom).toBeUndefined()
  })

  it('fades an until end from before it', () => {
    const j = deriveJourney(model([dated(1, 'p1', '1900'), ev(2, 'p2', { precision: 'until', date_end: '1930' })]), 'a1')
    expect(j.segments[0]).toMatchObject({ end: 1930, fadeFrom: 1924 })
  })

  it('draws no marker for an unknown link and marks unknown owners', () => {
    const j = deriveJourney(model([dated(1, 'p1', '1900'), dated(2, 'p3', '1910', { link_type: 'unknown' })]), 'a1')
    expect(j.events).toEqual([])
    expect(j.segments[1]).toMatchObject({ owner: 'Owner and place unknown', place: 'Unknown', kind: 'unknown' })
  })

  it('puts a null place on the Unknown row but keeps the owner', () => {
    const j = deriveJourney(model([dated(1, 'p1', '1900')]), 'a1')
    expect(j.segments[0]).toMatchObject({ owner: 'Ann', place: 'Unknown' })
    expect(j.places).toEqual(['Unknown'])
  })

  it('splits the same owner in a new place without a handover', () => {
    const j = deriveJourney(model([dated(1, 'p1', '1900', { place: 'Paris' }), dated(2, 'p1', '1910', { place: 'New York' })]), 'a1')
    expect(j.segments.map((s) => [s.owner, s.place])).toEqual([['Ann', 'Paris'], ['Ann', 'New York']])
    expect(j.events).toEqual([])
  })

  it('returns no segments for empty provenance', () => {
    expect(deriveJourney(model([]), 'a1').segments).toEqual([])
    expect(deriveJourney(model([ev(1, 'p1')]), 'a1').segments).toEqual([])
  })

  it('orders places Europe, North America, other, Unknown', () => {
    const j = deriveJourney(model([
      dated(1, 'p1', '1900', { place: 'New York' }), dated(2, 'p2', '1910'), dated(3, 'p1', '1920', { place: 'Tokyo' }),
      dated(4, 'p2', '1930', { place: 'Paris' }),
    ]), 'a1')
    expect(j.places).toEqual(['Paris', 'New York', 'Tokyo', 'Unknown'])
  })

  it('maps gift, descent, bequest and restitution', () => {
    const j = deriveJourney(model([
      dated(1, 'p1', '1900'), dated(2, 'p2', '1910', { link_type: 'descent' }),
      dated(3, 'p1', '1920', { link_type: 'bequest' }), dated(4, 'p2', '1950', { link_type: 'restitution' }),
    ]), 'a1')
    expect(j.events.map((e) => [e.type, e.label])).toEqual([
      ['gift', 'Inherited, 1910'], ['gift', 'Bequeathed, 1920'], ['restitution', 'Restituted, 1950'],
    ])
  })

  it('draws no one inside a range silence and no marker for it', () => {
    const j = deriveJourney(model([
      dated(1, 'p1', '1900'), ev(2, 'p2', { date_start: '1927', date_end: '1940-07', precision: 'range' }),
    ]), 'a1')
    expect(j.segments[0]).toMatchObject({ start: 1900, end: 1927 })
    expect(j.segments[1]).toMatchObject({ start: 1940, drawn: true })
    expect(j.events).toEqual([])
  })

  it('handles an open-ended silence', () => {
    const j = deriveJourney(model([
      dated(1, 'p1', '1900'), ev(2, 'p2', { date_start: '1920', precision: 'after' }), dated(3, 'p1', '1950'),
    ]), 'a1')
    expect(j.segments[0]).toMatchObject({ start: 1900, end: 1920 })
    expect(j.segments[1]).toMatchObject({ start: 1950, end: 1950 }) // no own start: its first known year
    expect(j.events.map((e) => e.to)).toEqual(['a1:2'])
  })

  it('does not draw a holder sandwiched between undated silences', () => {
    const j = deriveJourney(model([
      dated(1, 'p1', '1900'), ev(2, 'p2', { date_start: '1910' }), ev(3, 'p1'), ev(4, 'p2'), dated(5, 'p1', '1950'),
    ]), 'a1')
    expect(j.segments.map((s) => s.drawn)).toEqual([true, false, false, true, true])
    expect(j.segments[2].owner).toBe('Ann')
  })

  it('never overlaps a drawn segment with a derived gap on real artworks', () => {
    const real = evidence as unknown as EvidenceModel
    const d = derive(real, [], null)
    let undrawn = 0
    for (const a of real.artworks) {
      const j = deriveJourney(real, a.id)
      undrawn += j.segments.filter((s) => !s.drawn).length
      const gaps = d.artworks.find((x) => x.artwork === a.id)!.gaps
      for (const s of j.segments.filter((x) => x.drawn))
        for (const g of gaps) {
          const gs = g.start ?? g.end
          const ge = g.end ?? g.start
          if (gs === null || ge === null) continue
          expect(Math.min(s.end, ge) - Math.max(s.start, gs), `${s.id} vs ${g.id}`).toBeLessThanOrEqual(0)
        }
    }
    console.log('undrawn segments', undrawn)
  })

  it('sets every real segment source to cleveland', () => {
    const real = evidence as unknown as EvidenceModel
    for (const a of real.artworks)
      for (const s of deriveJourney(real, a.id).segments) expect(s.source, s.id).toBe('cleveland')
  })

  it('takes the source from the collection of the cited claim', () => {
    const m = model([dated(1, 'p1', '1900'), dated(2, 'p2', '1910')])
    m.collections = [{ id: 'col-g', name: 'Getty', source: 'Getty Provenance Index', snapshot_date: '2026-01-01' }]
    m.source_records = [{ id: 'r1', collection: 'col-g' } as EvidenceModel['source_records'][number]]
    m.claims = [{ id: 'c2', source_record: 'r1' } as EvidenceModel['claims'][number]]
    const j = deriveJourney(m, 'a1')
    expect(j.segments.map((s) => s.source)).toEqual(['cleveland', 'getty'])
  })
})
