import { describe, expect, it } from 'vitest'
import { derive } from '../derive'
import { deriveJourney } from '../journey/derive'
import { sourceOfEvent } from '../sources/sourceStyle'
import { DEMO_ARTWORK_ID, LAYER_LABELS, demoLayers } from './scenario'

const FOCUS = { start: 1933, end: 1945 }
const state = (i: number, focus: typeof FOCUS | null) =>
  derive(demoLayers[i], [], focus).artworks.find((a) => a.artwork === DEMO_ARTWORK_ID)!

describe('fictional demo scenario', () => {
  it('has three labelled layers', () => {
    expect(demoLayers).toHaveLength(3)
    expect(LAYER_LABELS).toEqual(['Museum record', '+ Dealer ledger', '+ Auction catalogue'])
  })

  it.each([0, 1, 2])('layer %i is structurally consistent', (i) => {
    const m = demoLayers[i]
    const all = [...m.collections, ...m.source_records, ...m.claims, ...m.artworks, ...m.parties, ...m.party_aliases, ...m.events]
    const ids = all.map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => id.startsWith('demo-'))).toBe(true)
    const claims = new Map(m.claims.map((c) => [c.id, c]))
    const records = new Set(m.source_records.map((r) => r.id))
    const collections = new Set(m.collections.map((c) => c.id))
    const parties = new Set(m.parties.map((p) => p.id))
    for (const r of m.source_records) {
      expect(collections.has(r.collection)).toBe(true)
      expect(r.url).toBe('#fictional')
    }
    for (const c of m.claims) {
      expect(records.has(c.source_record)).toBe(true)
      expect(c.start).toBeGreaterThanOrEqual(0)
      // the span lies inside the field's words (the longest claim of a field holds the whole sentence) and equals the claim text
      const field = m.claims.filter((x) => x.source_record === c.source_record && x.field_path === c.field_path).reduce((a, b) => (b.text.length > a.text.length ? b : a))
      expect(c.end).toBeGreaterThan(c.start)
      expect(c.end).toBeLessThanOrEqual(field.text.length)
      expect(field.text.slice(c.start, c.end)).toBe(c.text)
    }
    for (const a of m.party_aliases) {
      expect(parties.has(a.party)).toBe(true)
      const claim = claims.get(a.claim)!
      expect(claim.text).toBe(a.name_as_written)
    }
    for (const e of m.events) {
      expect(parties.has(e.from_party)).toBe(true)
      expect(parties.has(e.to_party)).toBe(true)
      for (const cited of Object.values(e.cites).flat()) expect(claims.has(cited)).toBe(true)
    }
    expect(m.artworks[0].title).toBe('Untitled landscape (fictional)')
    for (const p of m.parties) expect(p.preferred_name).toMatch(/^(Artist X|Collector [A-Z]|Estate of [A-Z]|Dealer [A-Z]|Museum [A-Z])/)
  })

  it('open years drop as sources are added: 27, 17, 9', () => {
    expect([0, 1, 2].map((i) => state(i, null).riskYears)).toEqual([27, 17, 9])
  })

  it('follows the 1933 to 1945 focus period: 12, 12, 7', () => {
    expect([0, 1, 2].map((i) => state(i, FOCUS).riskYears)).toEqual([12, 12, 7])
  })

  it('credits the source that fills each step', () => {
    const src = (i: number, id: string) => {
      const m = demoLayers[i]
      return sourceOfEvent(m.events.find((e) => e.id === `demo-ev-${id}`)!, m)
    }
    expect(src(1, 'L1')).toBe('demo-ledger')
    expect(src(1, 'L2')).toBe('demo-ledger')
    expect(src(2, 'U1')).toBe('demo-auction')
    expect(src(2, 'A1')).toBe('demo-museum')
    expect(src(0, 'e1')).toBe('demo-museum')
    expect(src(0, 'M3')).toBe('demo-museum')
    expect(src(1, 'M3b')).toBe('demo-museum')
  })

  it.each([0, 1, 2])('layer %i: no drawn segment overlaps a gap', (i) => {
    const j = deriveJourney(demoLayers[i], DEMO_ARTWORK_ID)
    for (const s of j.segments.filter((x) => x.drawn))
      for (const g of state(i, null).gaps)
        expect(Math.min(s.end, g.end ?? g.start ?? 0) - Math.max(s.start, g.start ?? g.end ?? 0), `${s.id} vs ${g.id}`).toBeLessThanOrEqual(0)
  })
})
