import { describe, expect, it } from 'vitest'
import type { Move, Stay } from '../../../journey/routeTypes'
import { arcGeometry, moveBends, stateAtYear, yearSpan, yearsText } from './geometry'

const stay = (i: number, placeId: string, start: number, end: number): Stay => ({ id: `stay-${i}`, placeId, segmentIds: [`s${i}`], start, end, owners: [] })
const move = (i: number, from: string, to: string): Move => ({ id: `move-${i}`, order: i, from, to, year: null, linkType: 'known', inFocus: false, segmentIds: [] })

describe('moveBends', () => {
  const stays = [stay(0, 'paris', 1900, 1910), stay(1, 'london', 1911, 1920), stay(2, 'paris', 1921, 1930), stay(3, 'london', 1931, 1940)]
  const placeOf = (id: string) => stays.find((s) => s.id === id)!.placeId
  it('gives repeated moves between the same pair distinct bends', () => {
    const moves = [move(1, 'stay-0', 'stay-1'), move(2, 'stay-1', 'stay-2'), move(3, 'stay-2', 'stay-3')]
    const b = moveBends(moves, placeOf)
    const P = { paris: { x: 0, y: 0 }, london: { x: 100, y: 0 } } as const
    const ctrl = moves.map((m) => arcGeometry(P[placeOf(m.from) as 'paris' | 'london'], P[placeOf(m.to) as 'paris' | 'london'], b.get(m.id)!, 0).control.y.toFixed(1))
    expect(new Set(ctrl).size).toBe(3)
  })
  it('puts a return trip on the other side in screen terms', () => {
    const moves = [move(1, 'stay-0', 'stay-1'), move(2, 'stay-1', 'stay-2')]
    const b = moveBends(moves, placeOf)
    const g1 = arcGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, b.get('move-1')!, 0)
    const g2 = arcGeometry({ x: 100, y: 0 }, { x: 0, y: 0 }, b.get('move-2')!, 0)
    expect(g1.control.y).not.toBeCloseTo(g2.control.y)
  })
  it('curves even a single move', () => {
    const b = moveBends([move(1, 'stay-0', 'stay-1')], placeOf)
    expect(Math.abs(b.get('move-1')!)).toBeGreaterThan(0)
  })
})

describe('stateAtYear', () => {
  const stays = [stay(0, 'paris', 1900, 1910), stay(1, 'london', 1920, 1937)]
  it('finds the stay containing the year', () => {
    expect(stateAtYear(stays, 1905)).toMatchObject({ kind: 'at', stay: { id: 'stay-0' } })
    expect(stateAtYear(stays, 1937)).toMatchObject({ kind: 'at', stay: { id: 'stay-1' } })
  })
  it('never places the work inside a gap; reports the last known stay', () => {
    expect(stateAtYear(stays, 1915)).toEqual({ kind: 'unknown', last: stays[0] })
    expect(stateAtYear(stays, 1950)).toEqual({ kind: 'unknown', last: stays[1] })
  })
  it('has no last known stay before the first one', () => {
    expect(stateAtYear(stays, 1850)).toEqual({ kind: 'unknown', last: null })
  })
})

describe('yearSpan and yearsText', () => {
  it('spans stays and dated unplaced periods', () => {
    expect(yearSpan([stay(0, 'a', 1900, 1910)], [{ start: 1874, end: null }])).toEqual([1874, 1910])
    expect(yearSpan([], [{ start: null, end: null }])).toBeNull()
  })
  it('words ranges', () => {
    expect(yearsText(1874, 1886)).toBe('1874 to 1886')
    expect(yearsText(1900, 1900)).toBe('1900')
    expect(yearsText(null, null)).toBe('dates not given')
  })
})
