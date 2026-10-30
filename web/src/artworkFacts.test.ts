import { describe, expect, it } from 'vitest'
import type { EvidenceModel } from './generated/contract'
import { NAZI_ERA } from './focus'
import { artworkFacts, recordStatus, warYearsStatus } from './artworkFacts'

const ev = (id: string, artwork: string, from: string, to: string, start: string | null, end: string | null) => ({
  id, artwork, from_party: from, to_party: to, link_type: 'sale', date_start: start, date_end: end,
  precision: 'exact', certainty: 'confirmed', place: null, cites: {},
})

const model = {
  events: [
    ev('e1', 'a', 'p1', 'p2', '1891', '1891'),
    ev('e2', 'a', 'p2', 'p3', '1905-03', '1905-03'),
    ev('e3', 'a', 'p3', 'p4', null, '1958'),
    ev('e4', 'b', 'p9', 'p8', null, null),
  ],
} as unknown as EvidenceModel

describe('artworkFacts', () => {
  it('counts each party once across the chain, from and to', () => {
    expect(artworkFacts(model, 'a').holders).toBe(4)
  })
  it('finds the earliest year any step mentions', () => {
    expect(artworkFacts(model, 'a').firstYear).toBe(1891)
  })
  it('has no first year when nothing is dated, and ignores other artworks', () => {
    expect(artworkFacts(model, 'b')).toEqual({ holders: 2, firstYear: null })
  })
})

describe('warYearsStatus', () => {
  it('says fully, partly or not recorded', () => {
    expect(warYearsStatus(0)).toBe('Fully recorded')
    expect(warYearsStatus(5)).toBe('Partly recorded')
    expect(warYearsStatus(12)).toBe('Not recorded')
  })
})

describe('recordStatus', () => {
  it('with a focus period, uses the words relative to its length', () => {
    expect(recordStatus(0, 2, NAZI_ERA)).toEqual({ label: '1933 to 1945', status: 'Fully recorded' })
    expect(recordStatus(5, 2, NAZI_ERA).status).toBe('Partly recorded')
    expect(recordStatus(12, 2, NAZI_ERA).status).toBe('Not recorded')
    expect(recordStatus(3, 1, { start: 1900, end: 1903 }).status).toBe('Not recorded')
  })
  it('with no focus, reports the gap count', () => {
    expect(recordStatus(40, 3, null)).toEqual({ label: 'Gaps in the record', status: '3 gaps' })
    expect(recordStatus(0, 0, null).status).toBe('No gaps')
  })
})
