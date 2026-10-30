import { describe, expect, it } from 'vitest'
import evidence from './generated/evidence.json'
import type { EvidenceModel } from './generated/contract'
import type { Decision } from './types'
import { derive, focusYears, latestMatchDecisions, RISK_WINDOW_YEARS } from './derive'
import { NAZI_ERA } from './focus'

const model = evidence as unknown as EvidenceModel
const gapOf = (d: ReturnType<typeof derive>, artwork: string, start: number, end: number) =>
  d.artworks.find((a) => a.artwork === artwork)!.gaps.find((g) => g.start === start && g.end === end)

describe('derive', () => {
  const d = derive(model, [], NAZI_ERA)

  it('Van Gogh 1927..1940 has 7 risk years (1933..1940)', () => {
    const g = gapOf(d, 'cma-1958.32', 1927, 1940)!
    expect(g.riskYears).toBe(7)
    expect(g.inRiskWindow).toBe(true)
    expect(g.id).toBe('cma-1958.32:e-1958.32-007')
  })

  it('Sleep 1910..1963 has 12 risk years and its artwork totals 12', () => {
    expect(gapOf(d, 'cma-1963.502', 1910, 1963)!.riskYears).toBe(12)
    expect(d.artworks.find((a) => a.artwork === 'cma-1963.502')!.riskYears).toBe(12)
  })

  it('ranks by risk years descending, ties by artwork id', () => {
    const r = d.artworks.map((a) => a.riskYears)
    expect(r).toEqual([...r].sort((a, b) => b - a))
    for (let i = 1; i < d.artworks.length; i++) {
      const [p, n] = [d.artworks[i - 1], d.artworks[i]]
      const order =
        n.riskYears - p.riskYears || p.warParties - n.warParties || n.longestRiskGap - p.longestRiskGap ||
        n.shares.unknown - p.shares.unknown
      expect(order).toBeLessThanOrEqual(0) // each step is in order, or tied on every measure
      if (order === 0) expect(p.artwork < n.artwork).toBe(true)
    }
  })

  it('Pissarro merges open bounds into a hidden_holder gap 1939..1951 with 6 risk years', () => {
    const g = gapOf(d, 'cma-1990.7', 1939, 1951)!
    expect(g.kind).toBe('hidden_holder')
    expect(g.eventIds).toEqual(['e-1990.7-026', 'e-1990.7-027'])
    expect(g.riskYears).toBe(6)
  })

  it('zero-length events are not gaps', () => {
    for (const a of d.artworks) for (const g of a.gaps) expect(g.start).not.toBe(g.end)
  })

  it('evidence_added with a covering suggestion reduces risk years', () => {
    const m = {
      ...model,
      suggestions: [
        ...(model.suggestions ?? []),
        { id: 's-test', event: 'e-1958.32-007', covers_start: '1933', covers_end: '1936' },
      ],
    } as unknown as EvidenceModel
    const dec: Decision = {
      id: 'd1', target: 'e-1958.32-007', choice: 'evidence_added', suggestion: 's-test', note: '', at: '2026-01-01T00:00:00Z',
    }
    const g = gapOf(derive(m, [dec], NAZI_ERA), 'cma-1958.32', 1927, 1940)!
    expect(g.riskYears).toBe(4)
    expect(g.closed).toBe(false)
  })

  it('a suggestion without a span closes the gap', () => {
    const m = {
      ...model,
      suggestions: [{ id: 's-test', event: 'e-1958.32-007', covers_start: null, covers_end: null }],
    } as unknown as EvidenceModel
    const dec: Decision = {
      id: 'd1', target: 'e-1958.32-007', choice: 'evidence_added', suggestion: 's-test', note: '', at: '2026-01-01T00:00:00Z',
    }
    const g = gapOf(derive(m, [dec], NAZI_ERA), 'cma-1958.32', 1927, 1940)!
    expect(g.closed).toBe(true)
    expect(g.riskYears).toBe(0)
  })

  it('shares sum to 1', () => {
    for (const a of d.artworks) {
      const s = a.shares
      expect(s.confirmed + s.approximate + s.unknown).toBeCloseTo(1)
    }
    expect(d.artworks.find((a) => a.artwork === 'cma-1963.502')!.shares.confirmed).toBeCloseTo(0.25)
  })
})

describe('match decisions', () => {
  const ev = (id: string, f: string, t: string, a: string | null, b: string | null) => ({
    id, artwork: 'w', from_party: f, to_party: t, link_type: 'unknown', date_start: a, date_end: b,
    precision: 'after', certainty: 'approximate', place: null, cites: {},
  })
  const fx = {
    artworks: [{ id: 'w' }],
    parties: [
      { id: 'p-a', preferred_name: 'Alice' },
      { id: 'p-h', preferred_name: 'Private collection' },
      { id: 'p-r', preferred_name: 'Real Person' },
      { id: 'p-s', preferred_name: 'Sibling Person' },
    ],
    events: [ev('e1', 'p-a', 'p-h', '1930', null), ev('e2', 'p-h', 'p-a', null, '1950')],
    party_aliases: [{ id: 'pa-1', party: 'p-h', name_as_written: 'Private collection', claim: 'c' }],
    matches: [
      { id: 'm1', alias: 'pa-1', candidate_party: 'p-r', band: 'strong', reasons: [], claim: 'c' },
      { id: 'm2', alias: 'pa-1', candidate_party: 'p-s', band: 'weak', reasons: [], claim: 'c' },
    ],
    suggestions: [],
  } as unknown as EvidenceModel
  const dec = (target: string, choice: Decision['choice']): Decision => ({
    id: `${target}-${choice}-${Math.random()}`, target, choice, suggestion: null, note: '', at: '',
  })
  const gap = (ds: Decision[]) => derive(fx, ds, NAZI_ERA).artworks[0].gaps[0]

  it('undecided and rejected matches change nothing', () => {
    const base = gap([])
    expect(base.kind).toBe('hidden_holder')
    expect(gap([dec('m1', 'rejected')])).toEqual(base)
  })

  it('an accepted match unhides the holder but keeps the dates and risk', () => {
    const base = gap([])
    const g = gap([dec('m1', 'accepted')])
    expect(g.kind).toBe('unattested')
    expect(g.riskYears).toBe(base.riskYears)
    expect(g.closed).toBe(false)
  })

  it('a later decision supersedes an earlier one', () => {
    expect(gap([dec('m1', 'accepted'), dec('m1', 'rejected')]).kind).toBe('hidden_holder')
    expect(gap([dec('m1', 'rejected'), dec('m1', 'accepted')]).kind).toBe('unattested')
  })

  it('accepting a sibling supersedes the earlier accepted candidate', () => {
    const v = latestMatchDecisions(fx, [dec('m1', 'accepted'), dec('m2', 'accepted')])
    expect(v.get('m1')).toBe('rejected')
    expect(v.get('m2')).toBe('accepted')
    expect(latestMatchDecisions(fx, [dec('m1', 'accepted')]).has('m2')).toBe(false)
  })

  it('evidence_added still closes a gap', () => {
    const fx2 = { ...fx, suggestions: [{ id: 's1', covers_start: null, covers_end: null }] } as unknown as EvidenceModel
    const d: Decision = { ...dec('e1', 'evidence_added'), suggestion: 's1' }
    expect(derive(fx2, [d], NAZI_ERA).artworks[0].gaps[0].closed).toBe(true)
  })
})

describe('ranking ties', () => {
  const ev = (id: string, artwork: string, from: string, to: string, start: string, end: string) => ({
    id, artwork, from_party: from, to_party: to, link_type: 'unknown', date_start: start, date_end: end,
    precision: 'range', certainty: 'approximate', place: null, cites: {},
  })
  const art = (id: string) => ({ id, title: id, artist: '', created: '', accession: id, image: '' })
  // both artworks have the same 12 open war years; 'a-many' names more parties inside 1933 to 1945
  const tied = {
    artworks: [art('a-many'), art('b-few')],
    events: [
      ev('e1', 'a-many', 'p1', 'p2', '1920', '1960'),
      ev('e2', 'a-many', 'p3', 'p4', '1936', '1936'),
      ev('e3', 'b-few', 'p1', 'p2', '1920', '1960'),
    ],
    parties: [], party_aliases: [], matches: [], suggestions: [], claims: [], source_records: [], collections: [],
  } as unknown as EvidenceModel

  it('puts the artwork that names fewer parties in the war years first, even against alphabetical order', () => {
    const r = derive(tied, [], NAZI_ERA)
    expect(r.artworks.map((a) => a.riskYears)).toEqual([12, 12])
    expect(r.artworks.map((a) => a.artwork)).toEqual(['b-few', 'a-many'])
  })
})

describe('focus period', () => {
  const ev = (id: string, artwork: string, from: string, to: string, start: string, end: string) => ({
    id, artwork, from_party: from, to_party: to, link_type: 'sale', date_start: start, date_end: end,
    precision: 'range', certainty: 'approximate', place: null, cites: {},
  })
  const fx = {
    artworks: [{ id: 'w', title: 'w', artist: '', created: '', accession: 'w', image: '' }],
    events: [ev('e1', 'w', 'p1', 'p2', '1920', '1960'), ev('e2', 'w', 'p3', 'p4', '1800', '1800')],
    parties: [], party_aliases: [], matches: [], suggestions: [], claims: [], source_records: [], collections: [],
  } as unknown as EvidenceModel

  it('counts every year of a gap when no focus is set', () => {
    const a = derive(fx, []).artworks[0]
    expect(a.gaps[0].riskYears).toBe(40)
    expect(a.riskYears).toBe(40)
    expect(a.gaps[0].inRiskWindow).toBe(true)
    expect(a.warParties).toBe(4)
  })
  it('counts only the years inside the preset when it is set', () => {
    const a = derive(fx, [], NAZI_ERA).artworks[0]
    expect(a.gaps[0].riskYears).toBe(12)
    expect(a.warParties).toBe(2)
  })
  it('flags a gap outside the focus as not overlapping it', () => {
    const g = derive(fx, [], { start: 1970, end: 1980 }).artworks[0].gaps[0]
    expect(g.inRiskWindow).toBe(false)
    expect(g.riskYears).toBe(0)
  })
  it('measures focus lengths', () => {
    expect(focusYears(NAZI_ERA)).toBe(RISK_WINDOW_YEARS)
    expect(RISK_WINDOW_YEARS).toBe(12)
    expect(focusYears(null)).toBe(Infinity)
  })
})
