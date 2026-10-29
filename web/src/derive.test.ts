import { describe, expect, it } from 'vitest'
import evidence from './generated/evidence.json'
import type { EvidenceModel } from './generated/contract'
import type { Decision } from './types'
import { derive } from './derive'

const model = evidence as unknown as EvidenceModel
const gapOf = (d: ReturnType<typeof derive>, artwork: string, start: number, end: number) =>
  d.artworks.find((a) => a.artwork === artwork)!.gaps.find((g) => g.start === start && g.end === end)

describe('derive', () => {
  const d = derive(model, [])

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
    expect(d.artworks.slice(0, 3).map((a) => a.artwork)).toEqual(['cma-1958.32', 'cma-1963.502', 'cma-1958.34'])
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
    const g = gapOf(derive(m, [dec]), 'cma-1958.32', 1927, 1940)!
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
    const g = gapOf(derive(m, [dec]), 'cma-1958.32', 1927, 1940)!
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
