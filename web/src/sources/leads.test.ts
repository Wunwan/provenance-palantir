import { describe, expect, it } from 'vitest'
import evidence from '../generated/evidence.json'
import type { EvidenceModel } from '../generated/contract'
import { leadsFor } from './leads'
import { sourceIdOf, sourceOfEvent } from './sourceStyle'

const model = evidence as unknown as EvidenceModel

describe('leadsFor (real data)', () => {
  it('turns the Getty suggestions into leads for the right artworks', () => {
    const morisot = leadsFor(model, 'cma-1958.34')
    const sleep = leadsFor(model, 'cma-1963.502')
    expect(morisot).toHaveLength(2)
    expect(sleep).toHaveLength(2)
    expect(morisot.every((l) => l.source === 'getty')).toBe(true)
  })
  it('keeps an undated lead but leaves it unplaced', () => {
    const undated = leadsFor(model, 'cma-1958.34').filter((l) => l.start === null)
    expect(undated).toHaveLength(1)
  })
  it('titles a lead by the quoted record name', () => {
    const dated = leadsFor(model, 'cma-1958.34').find((l) => l.start === 1946)
    expect(dated?.title).toMatch(/Knoedler Purchase of Stock Number A3535/)
  })
  it('gives artworks without suggestions no leads', () => {
    expect(leadsFor(model, 'cma-1958.32')).toEqual([])
  })
})

describe('source ids', () => {
  it('maps provider names to a source', () => {
    expect(sourceIdOf('Getty Provenance Index')).toBe('getty')
    expect(sourceIdOf('cleveland')).toBe('cleveland')
  })
  it('traces every chain event to Cleveland, the only record source today', () => {
    const sources = new Set(model.events.map((e) => sourceOfEvent(e, model)))
    expect([...sources]).toEqual(['cleveland'])
  })
})
