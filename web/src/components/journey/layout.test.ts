import chartSrc from './JourneyChart.tsx?raw'
import { SOURCES } from '../../sources/sourceStyle'
import { describe, expect, it } from 'vitest'
import raw from '../../generated/evidence.json'
import type { EvidenceModel } from '../../generated/contract'
import { deriveJourney } from '../../journey/derive'
import { derive } from '../../derive'
import { leadsFor } from '../../sources/leads'
import { computeLayout, gapLabel, leadKey } from './layout'

const model = raw as unknown as EvidenceModel
const derived = derive(model, [])
interface Box { name: string; x: number; y: number; w: number; h: number }
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const FOCI = [null, { start: 1933, end: 1945 }]
describe.each(model.artworks.map((a) => a.id))('journey layout %s', (id) => {
  const journey = deriveJourney(model, id)
  it.each(FOCI.flatMap((f) => [560, 1100].map((w) => [f, w] as const)))('has no label collisions with focus %j at width %i', (focus, width) => {
    const gaps = derived.artworks.find((a) => a.artwork === id)?.gaps ?? []
    const leads = leadsFor(model, id)
    const l = computeLayout(journey, width, gaps, focus, leads)
    const labels: Box[] = [
      ...l.ownerLabels.map((o) => ({ name: o.seg.owner, x: o.x, y: o.y - 10, w: o.seg.owner.length * 6, h: 12 })),
      ...l.eventLabels.map((e, i) => {
        const w = l.markers[i].ev.label.length * 6
        return { name: l.markers[i].ev.label, x: e.anchor === 'start' ? e.x : e.x - w, y: e.y - 10, w, h: 12 }
      }),
      ...l.gapBoxes.map((g) => ({ name: gapLabel(g.gap), x: g.lx, y: g.ly - 10, w: gapLabel(g.gap).length * 6, h: 12 })),
      ...l.leadBoxes.map((b) => ({ name: b.label, x: b.lx, y: b.ly - 10, w: b.label.length * 6, h: 12 })),
    ]
    const markers: Box[] = [
      ...l.markers.map((m) => ({ name: m.key, x: m.x - 5, y: m.y - 5, w: 10, h: 10 })),
      ...l.leadBoxes.map((b) => ({ name: leadKey(b.lead), x: b.x1, y: b.y - 4, w: b.x2 - b.x1, h: 8 })),
    ]
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) expect(overlap(labels[i], labels[j]), `${labels[i].name} / ${labels[j].name}`).toBe(false)
      for (const m of markers) expect(overlap(labels[i], m), `${labels[i].name} / marker ${m.name}`).toBe(false)
    }
  })
})

describe('sources and leads', () => {
  it('draws only dated leads and counts the undated ones', () => {
    const journey = deriveJourney(model, model.artworks[0].id)
    const mk = (id: string, start: number | null) => ({ id, source: 'getty' as const, title: id, preview: id, start, end: start, url: null, retrievedAt: '2026-01-01T00:00:00Z' })
    const l = computeLayout(journey, 800, [], null, [mk('a', 1946), mk('b', null)])
    expect(l.leadBoxes.map((b) => b.lead.id)).toEqual(['a'])
    expect(l.undatedLeads.map((x) => x.id)).toEqual(['b'])
    expect(l.leadBoxes[0].label).toBe('Getty lead, 1946')
    expect(l.leadBoxes[0].x2 - l.leadBoxes[0].x1).toBeGreaterThanOrEqual(8)
  })
  it('colours a bar by its segment source token', () => {
    expect(chartSrc).toContain('SOURCES[src].cssVar')
    expect(SOURCES.getty.cssVar).toBe('--src-getty')
    expect(SOURCES.cleveland.cssVar).toBe('--src-cleveland')
  })
})
