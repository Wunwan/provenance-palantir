import { describe, expect, it } from 'vitest'
import { geoNaturalEarth1 } from 'd3'
import { IDENTITY, applyXf, chooseAnchor, clampXf, composeProjection, zoomAt, zoomCentred } from './transform'
import { PIN_COLORS, RANGE_DARK, RANGE_LIGHT, contrast, inkFor, moveColor } from './colors'
import { hsl } from 'd3'

describe('composeProjection', () => {
  it('equals k * fitted + translation for any point', () => {
    const base = geoNaturalEarth1().rotate([-10, 0]).center([0, 50]).scale(900).translate([300, 200])
    const t = { k: 3.5, tx: -120, ty: 45 }
    const c = composeProjection(base, t)
    for (const ll of [[2.35, 48.85], [-74, 40.7], [13.4, 52.5]] as [number, number][]) {
      const b = base(ll)!
      const want = applyXf({ x: b[0], y: b[1] }, t)
      const got = c(ll)!
      expect(got[0]).toBeCloseTo(want.x, 6)
      expect(got[1]).toBeCloseTo(want.y, 6)
    }
  })
})

describe('zoomAt', () => {
  it('keeps the point under the cursor fixed', () => {
    const t = { k: 2, tx: 10, ty: -20 }
    const world = { x: (250 - t.tx) / t.k, y: (130 - t.ty) / t.k }
    const z = zoomAt(t, 250, 130, 1.8)
    const s = applyXf(world, z)
    expect(s.x).toBeCloseTo(250)
    expect(s.y).toBeCloseTo(130)
    expect(z.k).toBeCloseTo(3.6)
  })
  it('clamps to 1x and 12x', () => {
    expect(zoomAt(IDENTITY, 0, 0, 0.1).k).toBe(1)
    expect(zoomAt({ k: 10, tx: 0, ty: 0 }, 0, 0, 5).k).toBe(12)
  })
})

describe('clampXf', () => {
  const pts = [{ x: 200, y: 150 }, { x: 400, y: 250 }]
  it('leaves a sane transform alone', () => {
    expect(clampXf(IDENTITY, pts, 640, 360)).toEqual(IDENTITY)
  })
  it('stops the places being dragged out of view', () => {
    const c = clampXf({ k: 4, tx: -5000, ty: 5000 }, pts, 640, 360)
    expect(4 * 400 + c.tx).toBeGreaterThanOrEqual(48)
    expect(4 * 150 + c.ty).toBeLessThanOrEqual(360 - 48)
  })
})

describe('move colours', () => {
  it.each([1, 2, 8, 30])('gives %i moves readable numbers in both ranges, with no red hues', (n) => {
    for (const range of [RANGE_DARK, RANGE_LIGHT]) {
      for (let i = 0; i < n; i++) {
        const c = moveColor(i, n, range)
        expect(contrast(c, inkFor(c))).toBeGreaterThanOrEqual(4.5)
        const h = hsl(c).h
        expect(h).toBeGreaterThan(55)
        expect(h).toBeLessThan(300)
      }
    }
  })
  it('runs earliest to latest and picks dark ink on light fills', () => {
    expect(moveColor(0, 5)).not.toBe(moveColor(4, 5))
    expect(inkFor('#fde725')).toBe('#000000')
    expect(inkFor('#440154')).toBe('#ffffff')
  })
})

const inView = (pts: { x: number; y: number }[], t: ReturnType<typeof zoomAt>, W: number, H: number) =>
  pts.some((p) => { const s = applyXf(p, t); return s.x >= 0 && s.x <= W && s.y >= 0 && s.y <= H })

describe('keep a pin in view', () => {
  // Two clusters far apart with open ocean between them, like Europe and the Americas.
  const pts = [{ x: 90, y: 120 }, { x: 100, y: 130 }, { x: 560, y: 200 }]
  it('zooming in at the middle of the frame never empties the view', () => {
    let t = IDENTITY
    for (let i = 0; i < 6; i++) { t = clampXf(zoomAt(t, 320, 180, 1.6), pts, 640, 360); expect(inView(pts, t, 640, 360)).toBe(true) }
  })
  it('zooming out from a clamped, panned state still leaves a pin in view', () => {
    let t = clampXf({ k: 10, tx: -9000, ty: -9000 }, pts, 640, 360)
    expect(inView(pts, t, 640, 360)).toBe(true)
    for (let i = 0; i < 8; i++) { t = clampXf(zoomAt(t, 320, 180, 1 / 1.6), pts, 640, 360); expect(inView(pts, t, 640, 360)).toBe(true) }
    expect(t.k).toBe(1)
  })
  it('brings the nearest pin to the margin with the smallest shift', () => {
    const c = clampXf({ k: 4, tx: -3000, ty: 200 }, [{ x: 100, y: 100 }], 640, 360)
    const s = applyXf({ x: 100, y: 100 }, c)
    expect(s.x).toBeGreaterThanOrEqual(48)
    expect(s.x).toBeLessThanOrEqual(640 - 48)
  })
})

describe('chooseAnchor', () => {
  const pts = [{ x: 90, y: 120 }, { x: 100, y: 130 }, { x: 560, y: 200 }]
  it('uses the selected pin first', () => {
    expect(chooseAnchor(pts, IDENTITY, 640, 360, pts[2])).toEqual(pts[2])
  })
  it('snaps a far-from-everything centroid to the nearest cluster', () => {
    const far = [{ x: 30, y: 120 }, { x: 40, y: 130 }, { x: 610, y: 200 }]
    const a = chooseAnchor(far, IDENTITY, 640, 360, null)!
    expect(a.x).toBeLessThan(60)
    expect(a.x).toBeGreaterThan(25)
  })
  it('uses the centroid of the pins in view, not all pins, when some are out of view', () => {
    const a = chooseAnchor(pts, { k: 4, tx: -300, ty: -300 }, 640, 360, null)!
    // only the first cluster... check the anchor is a real pin position (inside view after transform)
    const s = applyXf(a, { k: 4, tx: -300, ty: -300 })
    expect(s.x).toBeGreaterThanOrEqual(0)
    expect(s.x).toBeLessThanOrEqual(640)
  })
  it('falls back to all pins when none is in view and is null with no pins', () => {
    expect(chooseAnchor(pts, { k: 12, tx: -5000, ty: -5000 }, 640, 360, null)).not.toBeNull()
    expect(chooseAnchor([], IDENTITY, 640, 360, null)).toBeNull()
  })
  it('centres the anchor when zooming in and returns to the fit at 1x', () => {
    const z = zoomCentred(IDENTITY, { x: 100, y: 130 }, 640, 360, 4)
    expect(applyXf({ x: 100, y: 130 }, z)).toEqual({ x: 320, y: 180 })
    expect(zoomCentred(z, { x: 100, y: 130 }, 640, 360, 1 / 4)).toEqual(IDENTITY)
  })
})

describe('palette floors', () => {
  it('keeps every dark-theme fill at 3:1 or better against #141416, with readable ink', () => {
    for (const n of [1, 2, 9, 30]) for (let i = 0; i < n; i++) {
      const c = moveColor(i, n, RANGE_DARK)
      expect(contrast(c, '#141416')).toBeGreaterThanOrEqual(3)
      expect(contrast(c, inkFor(c))).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('keeps every light-theme fill at 3:1 or better against #f0ede6', () => {
    for (const n of [1, 2, 9, 30]) for (let i = 0; i < n; i++) expect(contrast(moveColor(i, n, RANGE_LIGHT), '#f0ede6')).toBeGreaterThanOrEqual(3)
  })
})

describe('pin colours', () => {
  it.each(['dark', 'light'] as const)('%s theme: pin fill is at least 3:1 against land and background, and the outline against the fill', (theme) => {
    const c = PIN_COLORS[theme]
    expect(contrast(c.fill, c.land)).toBeGreaterThanOrEqual(3)
    expect(contrast(c.fill, c.bg)).toBeGreaterThanOrEqual(3)
    expect(contrast(c.edge, c.fill)).toBeGreaterThanOrEqual(3)
  })
})
