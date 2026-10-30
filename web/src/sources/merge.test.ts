import { describe, expect, it } from 'vitest'
import type { EvidenceModel } from '../generated/contract'
import { classifyMerge, mergeModel, nameTokens, sameHolder, type ExistingEvent } from './merge'
import type { IncomingStep, ModelFragment } from './types'

const ev = (id: string, from: string, to: string, start: number | null, end: number | null): ExistingEvent => ({ id, from, to, start, end })
const step = (holder: string, start: number | null, end: number | null): IncomingStep => ({ holder, start, end, words: 'w' })

const events = [
  ev('e1', 'Theo van Gogh', 'Johanna van Gogh-Bonger', 1891, 1891),
  ev('e2', 'Johanna van Gogh-Bonger', 'Baron Étienne de Rothschild', 1905, 1905),
  ev('e3', 'Baron Étienne de Rothschild', 'Mrs. Ada Brown', 1910, 1930),
  ev('e4', 'Mrs. Ada Brown', 'Knoedler & Co.', 1935, 1947),
]
const gaps = [{ id: 'g1', start: 1935, end: 1947 }]
const one = (s: IncomingStep) => classifyMerge(events, gaps, [s])[0]

describe('name normalization', () => {
  it('strips accents, titles and punctuation', () => {
    expect(nameTokens('Baroness Éloïse de Rothschild')).toEqual(['de', 'eloise', 'rothschild'])
    expect(nameTokens('The Mrs. Ada  Brown')).toEqual(['ada', 'brown'])
    expect(nameTokens('Dr. Sir')).toEqual([])
  })
  it('compares token sets, ignoring order', () => {
    expect(sameHolder('Brown, Ada', 'Ada Brown')).toBe(true)
    expect(sameHolder('Mrs. Ada Brown', 'ada brown')).toBe(true)
    expect(sameHolder('Ada Brown', 'Ada Browne')).toBe(false)
    expect(sameHolder('', '')).toBe(false)
  })
})

describe('classifyMerge', () => {
  it('agrees: same holder, overlapping years', () => {
    const r = one(step('Baron Etienne de Rothschild', 1910, 1912))
    expect(r.label).toBe('agrees')
    expect(r.against).toBe('e3')
  })
  it('agrees through the to_party and the from_party', () => {
    expect(one(step('Theo van Gogh', 1891, 1891)).label).toBe('agrees')
    expect(one(step('Knoedler & Co.', 1946, 1946)).label).toBe('agrees')
  })
  it('fills a gap: named holder inside the gap years, not already named', () => {
    const r = one(step('M. Knoedler', 1946, 1946))
    expect(r.label).toBe('fills_gap')
    expect(r.against).toBe('g1')
  })
  it('does not fill a gap when the years stick out of it', () => {
    expect(one(step('Someone Else', 1930, 1940)).label).toBe('conflicts')
  })
  it('does not fill a gap with an unnamed holder', () => {
    expect(one(step('Private collection', 1940, 1941)).label).toBe('conflicts')
  })
  it('conflicts: overlapping years, different holder', () => {
    const r = one(step('Paul Durand', 1915, 1920))
    expect(r.label).toBe('conflicts')
    expect(r.against).toBe('e3')
  })
  it('conflicts with an exact-year event', () => {
    expect(one(step('Paul Durand', 1905, 1905)).label).toBe('conflicts')
  })
  it('new: nothing overlaps', () => {
    expect(one(step('Paul Durand', 1960, 1970)).label).toBe('new')
    expect(one(step('Paul Durand', 1895, 1900)).label).toBe('new')
  })
  it('ranges that only share an end year do not overlap', () => {
    expect(one(step('Paul Durand', 1930, 1934)).label).toBe('new')
  })
  it('a step without dates is new and says why', () => {
    const r = one(step('Ada Brown', null, null))
    expect(r.label).toBe('new')
    expect(r.note).toMatch(/no dates/)
  })
  it('uses the one given year when the other is open', () => {
    expect(one(step('Ada Brown', null, 1915)).label).toBe('agrees')
    expect(one(step('Paul Durand', 1915, null)).label).toBe('conflicts')
  })
  it('returns one row per step, in order', () => {
    const rows = classifyMerge(events, gaps, [step('Ada Brown', 1920, 1920), step('X Y', 2000, 2001)])
    expect(rows.map((r) => r.label)).toEqual(['agrees', 'new'])
  })
  it('with no events or gaps everything is new', () => {
    expect(classifyMerge([], [], [step('A B', 1900, 1901)])[0].label).toBe('new')
  })
})

describe('mergeModel', () => {
  const base = {
    collections: [], source_records: [], claims: [], matches: [], suggestions: [],
    artworks: [{ id: 'a1', title: 'T', artist: 'A', created: '1900', accession: '1.1', image: '' }],
    parties: [{ id: 'p1', preferred_name: 'X', kind: 'person', life_dates: null }],
    party_aliases: [], events: [],
  } as unknown as EvidenceModel
  const frag = {
    artworks: [{ id: 'a1', title: 'dup', artist: 'A', created: '1900', accession: '1.1', image: '' }, { id: 'a2', title: 'N', artist: 'A', created: '1900', accession: '2.2', image: '' }],
    parties: [{ id: 'p2', preferred_name: 'Y', kind: 'person', life_dates: null }],
    party_aliases: [], events: [], claims: [], source_records: [],
  } as ModelFragment
  it('concatenates and dedupes by id, keeping the model first', () => {
    const m = mergeModel(base, frag)
    expect(m.artworks.map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(m.artworks[0].title).toBe('T')
    expect(m.parties.map((p) => p.id)).toEqual(['p1', 'p2'])
  })
  it('does not mutate the model and keeps other tables', () => {
    mergeModel(base, frag)
    expect(base.artworks).toHaveLength(1)
    expect(mergeModel(base, frag).suggestions).toEqual([])
  })
})
