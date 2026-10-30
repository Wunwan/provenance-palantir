export interface Box { x: number; y: number; w: number; h: number }
export interface LabelPin { id: string; x: number; y: number; w: number }
export interface PlacedLabel { id: string; box: Box; leader: { x1: number; y1: number; x2: number; y2: number } | null }

const hit = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

/**
 * Place one label per pin without covering any pin, any other label, or any obstacle (arc step numbers).
 * Tries right, left, above, below, then the four diagonals at growing distance; when nothing is free it
 * pushes the label out and joins it to its pin with a thin leader line.
 */
export function placeLabels(pins: LabelPin[], obstacles: Box[], bounds: { w: number; h: number }, pinR = 6, h = 14): PlacedLabel[] {
  const pinBoxes = pins.map((p) => ({ x: p.x - pinR - 1, y: p.y - pinR - 1, w: 2 * pinR + 2, h: 2 * pinR + 2 }))
  const placed: PlacedLabel[] = []
  const free = (b: Box) =>
    b.x >= 0 && b.y >= 0 && b.x + b.w <= bounds.w && b.y + b.h <= bounds.h &&
    !pinBoxes.some((p) => hit(b, p)) && !obstacles.some((o) => hit(b, o)) && !placed.some((l) => hit(b, l.box))
  const around = (p: LabelPin, d: number): Box[] => {
    const k = d * 0.7
    return [
      { x: p.x + d, y: p.y - h / 2, w: p.w, h },
      { x: p.x - d - p.w, y: p.y - h / 2, w: p.w, h },
      { x: p.x - p.w / 2, y: p.y - d - h, w: p.w, h },
      { x: p.x - p.w / 2, y: p.y + d, w: p.w, h },
      { x: p.x + k, y: p.y - k - h, w: p.w, h },
      { x: p.x - k - p.w, y: p.y - k - h, w: p.w, h },
      { x: p.x + k, y: p.y + k, w: p.w, h },
      { x: p.x - k - p.w, y: p.y + k, w: p.w, h },
    ]
  }
  for (const p of pins) {
    let box: Box | undefined
    let leader = false
    for (const d of [pinR + 3, pinR + 13, pinR + 25]) {
      box = around(p, d).find(free)
      if (box) break
    }
    if (!box) {
      leader = true
      for (let d = pinR + 40; d <= pinR + 160 && !box; d += 16) box = around(p, d).find(free)
      box ??= around(p, pinR + 60)[0]
    }
    const cx = Math.min(Math.max(p.x, box.x), box.x + box.w)
    const cy = Math.min(Math.max(p.y, box.y), box.y + box.h)
    placed.push({ id: p.id, box, leader: leader ? { x1: p.x, y1: p.y, x2: cx, y2: cy } : null })
  }
  return placed
}
