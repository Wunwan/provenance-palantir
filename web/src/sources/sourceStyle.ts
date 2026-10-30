import type { Claim, EvidenceModel, Event } from '../generated/contract'

/** Where a piece of evidence comes from, and the colour that stands for it everywhere (tags, timeline, legend). */
export type SourceId = 'cleveland' | 'getty' | 'demo-museum' | 'demo-ledger' | 'demo-auction'

export interface SourceStyle {
  id: SourceId
  label: string // full name
  short: string // for tags
  cssVar: string // the colour token, defined in index.css
  kind: 'record' | 'lead' // records build the chain; leads are external suggestions that never join it
}

export const SOURCES: Record<SourceId, SourceStyle> = {
  cleveland: { id: 'cleveland', label: 'Cleveland Museum of Art Open Access API', short: 'Cleveland', cssVar: '--src-cleveland', kind: 'record' },
  getty: { id: 'getty', label: 'Getty Provenance Index', short: 'Getty', cssVar: '--src-getty', kind: 'lead' },
  // Invented sources of the fictional demo scenario (src/demo); they never appear in real evidence.
  'demo-museum': { id: 'demo-museum', label: 'Museum record (fictional)', short: 'Museum record (fictional)', cssVar: '--src-demo-museum', kind: 'record' },
  'demo-ledger': { id: 'demo-ledger', label: 'Dealer ledger (fictional)', short: 'Dealer ledger (fictional)', cssVar: '--src-demo-ledger', kind: 'record' },
  'demo-auction': { id: 'demo-auction', label: 'Auction catalogue (fictional)', short: 'Auction catalogue (fictional)', cssVar: '--src-demo-auction', kind: 'record' },
}

/** Map a provider or collection name to a known source; anything unrecognised is treated as Cleveland, the only record source today. */
export function sourceIdOf(name: string | null | undefined): SourceId {
  const n = name ?? ''
  if (/^demo-(museum|ledger|auction)$/.test(n)) return n as SourceId
  return /getty/i.test(n) ? 'getty' : 'cleveland'
}

/** The source of an event: the collection of the first record any of its cited claims points to. */
export function sourceOfEvent(e: Event, model: EvidenceModel): SourceId {
  const claimById = new Map<string, Claim>(model.claims.map((c) => [c.id, c]))
  const recordById = new Map(model.source_records.map((r) => [r.id, r]))
  const collectionById = new Map(model.collections.map((c) => [c.id, c]))
  for (const ids of Object.values(e.cites)) {
    for (const id of ids) {
      const record = recordById.get(claimById.get(id)?.source_record ?? '')
      const collection = record && collectionById.get(record.collection)
      if (collection) return sourceIdOf(collection.source)
    }
  }
  return 'cleveland'
}
