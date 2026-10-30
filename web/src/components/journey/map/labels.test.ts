import { describe, expect, it } from 'vitest'
import { placeLabels } from './labels'

const hit = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

describe('placeLabels', () => {
  const pins = [{ id: 'a', x: 300, y: 200, w: 70 }, { id: 'b', x: 306, y: 200, w: 80 }, { id: 'c', x: 312, y: 200, w: 40 }]
  const out = placeLabels(pins, [], { w: 640, h: 360 })
  it('keeps labels from overlapping each other', () => {
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(hit(out[i].box, out[j].box)).toBe(false)
  })
  it('keeps labels off every pin', () => {
    for (const l of out) for (const p of pins) expect(hit(l.box, { x: p.x - 6, y: p.y - 6, w: 12, h: 12 })).toBe(false)
  })
  it('keeps labels off obstacles and inside bounds', () => {
    const ob = [{ x: 310, y: 186, w: 14, h: 12 }]
    for (const l of placeLabels(pins, ob, { w: 640, h: 360 })) {
      expect(hit(l.box, ob[0])).toBe(false)
      expect(l.box.x).toBeGreaterThanOrEqual(0)
    }
  })
  it('puts a lone pin label to its right with no leader', () => {
    const [l] = placeLabels([pins[0]], [], { w: 640, h: 360 })
    expect(l.box.x).toBeGreaterThan(300)
    expect(l.leader).toBeNull()
  })
})
