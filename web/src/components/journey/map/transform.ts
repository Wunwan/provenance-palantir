import { geoNaturalEarth1 } from 'd3'
import type { GeoProjection } from 'd3'

/** Semantic zoom: screen = k * fitted + (tx, ty). The fitted projection is never scaled as an image; the projection itself is recomposed. */
export interface Xf { k: number; tx: number; ty: number }
export const IDENTITY: Xf = { k: 1, tx: 0, ty: 0 }
export const MIN_K = 1
export const MAX_K = 12

export const applyXf = (p: { x: number; y: number }, t: Xf) => ({ x: p.x * t.k + t.tx, y: p.y * t.k + t.ty })

/** Multiply the zoom by `factor`, keeping the screen point (cx, cy) fixed. */
export function zoomAt(t: Xf, cx: number, cy: number, factor: number): Xf {
  const k = Math.min(MAX_K, Math.max(MIN_K, t.k * factor))
  const r = k / t.k
  return { k, tx: cx - (cx - t.tx) * r, ty: cy - (cy - t.ty) * r }
}

/**
 * Keep the visited places in view. The bounding box of the pins (fitted coordinates) stays at least `margin` px inside
 * the frame, and at least one pin is always inside the viewport: when none is, the view moves by the smallest
 * translation that brings the nearest pin to `margin` px from the edges.
 */
export function clampXf(t: Xf, pts: { x: number; y: number }[], W: number, H: number, margin = 48): Xf {
  if (!pts.length) return t
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const lim = (lo: number, hi: number, v: number) => Math.min(hi, Math.max(lo, v))
  const c: Xf = {
    k: t.k,
    tx: lim(margin - t.k * Math.max(...xs), W - margin - t.k * Math.min(...xs), t.tx),
    ty: lim(margin - t.k * Math.max(...ys), H - margin - t.k * Math.min(...ys), t.ty),
  }
  const screen = pts.map((p) => applyXf(p, c))
  if (screen.some((s) => s.x >= 0 && s.x <= W && s.y >= 0 && s.y <= H)) return c
  let best = { dx: 0, dy: 0, d: Infinity }
  for (const s of screen) {
    const dx = lim(margin, W - margin, s.x) - s.x
    const dy = lim(margin, H - margin, s.y) - s.y
    const d = Math.hypot(dx, dy)
    if (d < best.d) best = { dx, dy, d }
  }
  return { k: c.k, tx: c.tx + best.dx, ty: c.ty + best.dy }
}

/**
 * Where button, key and empty-space zooms should centre (fitted coordinates): the selected pin if any; else the centroid of
 * the pins in view (all pins when none is); if that centroid is more than a quarter of the width from every pin, the
 * cluster of pins around the nearest one.
 */
export function chooseAnchor(pts: { x: number; y: number }[], t: Xf, W: number, H: number, selected: { x: number; y: number } | null): { x: number; y: number } | null {
  if (selected) return selected
  if (!pts.length) return null
  const screen = pts.map((p) => applyXf(p, t))
  const inside = screen.filter((s) => s.x >= 0 && s.x <= W && s.y >= 0 && s.y <= H)
  const group = inside.length ? inside : screen
  const mean = (a: { x: number; y: number }[]) => ({ x: a.reduce((s, p) => s + p.x, 0) / a.length, y: a.reduce((s, p) => s + p.y, 0) / a.length })
  let c = mean(group)
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
  const nearest = group.reduce((a, b) => (dist(b, c) < dist(a, c) ? b : a))
  if (dist(nearest, c) > 0.25 * W) c = mean(group.filter((s) => dist(s, nearest) <= 0.1 * W))
  return { x: (c.x - t.tx) / t.k, y: (c.y - t.ty) / t.k }
}

/** Zoom by `factor` and put the fitted point `anchor` in the middle of the frame. Back at 1x it is the plain fit. */
export function zoomCentred(t: Xf, anchor: { x: number; y: number }, W: number, H: number, factor: number): Xf {
  const k = Math.min(MAX_K, Math.max(MIN_K, t.k * factor))
  if (k === MIN_K) return IDENTITY
  return { k, tx: W / 2 - k * anchor.x, ty: H / 2 - k * anchor.y }
}

/** A projection equal to `base` followed by the transform. */
export function composeProjection(base: GeoProjection, t: Xf): GeoProjection {
  const [bx, by] = base.translate()
  return geoNaturalEarth1().rotate(base.rotate()).center(base.center()).scale(base.scale() * t.k).translate([bx * t.k + t.tx, by * t.k + t.ty])
}
