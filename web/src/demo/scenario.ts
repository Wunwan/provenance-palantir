import type { Claim, EvidenceModel, Event, Party } from '../generated/contract'

/**
 * A FICTIONAL scenario for the showcase. Every artwork, person, record and source here is invented.
 * Three cumulative layers show how sources fill a gap on one ownership timeline.
 */
export const DEMO_ARTWORK_ID = 'demo-1'
export const LAYER_LABELS = ['Museum record', '+ Dealer ledger', '+ Auction catalogue'] as const

type SourceKey = 'museum' | 'ledger' | 'auction'
const SOURCE_NAME: Record<SourceKey, string> = {
  museum: 'Museum record (fictional)',
  ledger: 'Dealer ledger (fictional)',
  auction: 'Auction catalogue (fictional)',
}
const SOURCE_FIELD: Record<SourceKey, string> = { museum: 'provenance', ledger: 'entries', auction: 'lot.history' }
const SNAPSHOT = '2026-01-01'

const PARTIES: Record<string, Party> = {
  artist: { id: 'demo-p-artist', preferred_name: 'Artist X (fictional)', kind: 'person', life_dates: null },
  a: { id: 'demo-p-a', preferred_name: 'Collector A', kind: 'person', life_dates: null },
  estA: { id: 'demo-p-est-a', preferred_name: 'Estate of A', kind: 'organization', life_dates: null },
  b: { id: 'demo-p-b', preferred_name: 'Dealer B', kind: 'organization', life_dates: null },
  c: { id: 'demo-p-c', preferred_name: 'Collector C', kind: 'person', life_dates: null },
  d: { id: 'demo-p-d', preferred_name: 'Dealer D', kind: 'organization', life_dates: null },
  e: { id: 'demo-p-e', preferred_name: 'Museum E', kind: 'organization', life_dates: null },
}

/** One invented source sentence, with the names it uses (as written) so aliases get real spans. */
interface Line { id: string; source: SourceKey; n: number; text: string; names: [keyof typeof PARTIES, string][] }
const LINES: Record<string, Line> = {
  e1: { id: 'e1', source: 'museum', n: 0, text: "Artist X's studio; sold to Collector A, 1905, Paris", names: [['artist', "Artist X's studio"], ['a', 'Collector A']] },
  e2: { id: 'e2', source: 'museum', n: 1, text: 'By descent to the Estate of A, 1921, Paris', names: [['estA', 'Estate of A']] },
  M3: { id: 'M3', source: 'museum', n: 2, text: 'Estate of A; later Museum E, Boston (dates and transfer not stated, before 1948)', names: [['estA', 'Estate of A'], ['e', 'Museum E']] },
  M3b: { id: 'M3b', source: 'museum', n: 2, text: 'Collector C; later Museum E, Boston (dates and transfer not stated, before 1948)', names: [['c', 'Collector C'], ['e', 'Museum E']] },
  A1: { id: 'A1', source: 'museum', n: 2, text: 'Dealer D; sold to Museum E, 1948, Boston', names: [['d', 'Dealer D'], ['e', 'Museum E']] },
  L1: { id: 'L1', source: 'ledger', n: 0, text: 'Estate of A sold to Dealer B, 1923, Paris', names: [['estA', 'Estate of A'], ['b', 'Dealer B']] },
  L2: { id: 'L2', source: 'ledger', n: 1, text: 'Dealer B sold to Collector C, 1931, Zurich', names: [['b', 'Dealer B'], ['c', 'Collector C']] },
  U1: { id: 'U1', source: 'auction', n: 0, text: 'Lot 14, from Collector C; sold in New York to Dealer D, between 1938 and 1947', names: [['c', 'Collector C'], ['d', 'Dealer D']] },
}

interface Step {
  id: string; from: keyof typeof PARTIES; to: keyof typeof PARTIES; link: Event['link_type']
  start: string; end: string; precision: Event['precision']; certainty: Event['certainty']; place: string
}
const STEPS: Record<string, Step> = {
  e1: { id: 'e1', from: 'artist', to: 'a', link: 'sale', start: '1905', end: '1905', precision: 'exact', certainty: 'confirmed', place: 'Paris' },
  e2: { id: 'e2', from: 'a', to: 'estA', link: 'descent', start: '1921', end: '1921', precision: 'exact', certainty: 'confirmed', place: 'Paris' },
  M3: { id: 'M3', from: 'estA', to: 'e', link: 'unknown', start: '1921', end: '1948', precision: 'range', certainty: 'unknown', place: 'Boston' },
  L1: { id: 'L1', from: 'estA', to: 'b', link: 'sale', start: '1923', end: '1923', precision: 'exact', certainty: 'confirmed', place: 'Paris' },
  L2: { id: 'L2', from: 'b', to: 'c', link: 'sale', start: '1931', end: '1931', precision: 'exact', certainty: 'confirmed', place: 'Zurich' },
  M3b: { id: 'M3b', from: 'c', to: 'e', link: 'unknown', start: '1931', end: '1948', precision: 'range', certainty: 'unknown', place: 'Boston' },
  U1: { id: 'U1', from: 'c', to: 'd', link: 'unknown', start: '1938', end: '1947', precision: 'range', certainty: 'approximate', place: 'New York' },
  A1: { id: 'A1', from: 'd', to: 'e', link: 'sale', start: '1948', end: '1948', precision: 'exact', certainty: 'confirmed', place: 'Boston' },
}

/** The events of each layer, in chain order. */
const LAYER_STEPS: string[][] = [
  ['e1', 'e2', 'M3'],
  ['e1', 'e2', 'L1', 'L2', 'M3b'],
  ['e1', 'e2', 'L1', 'L2', 'U1', 'A1'],
]

const claimId = (lineId: string) => `demo-c-${lineId}`

function build(stepIds: string[]): EvidenceModel {
  const lines = stepIds.map((s) => LINES[s])
  const sources = [...new Set(lines.map((l) => l.source))]
  const claims: Claim[] = []
  const party_aliases: EvidenceModel['party_aliases'] = []
  for (const l of lines) {
    const record = `demo-sr-${l.source}`
    const field_path = `${SOURCE_FIELD[l.source]}[${l.n}]`
    claims.push({ id: claimId(l.id), source_record: record, field_path, start: 0, end: l.text.length, text: l.text, method: 'hand', certainty: 'stated' })
    l.names.forEach(([party, written], i) => {
      const start = l.text.indexOf(written)
      const id = `demo-a-${l.id}-${i}`
      claims.push({ id: `demo-c-${l.id}-name${i}`, source_record: record, field_path, start, end: start + written.length, text: written, method: 'hand', certainty: 'stated' })
      party_aliases.push({ id, party: PARTIES[party].id, name_as_written: written, claim: `demo-c-${l.id}-name${i}` })
    })
  }
  const events: Event[] = stepIds.map((sid) => {
    const s = STEPS[sid]
    const c = [claimId(sid)]
    const cites: Event['cites'] = { from_party: c, to_party: c, date_start: c, date_end: c, place: c }
    if (s.link !== 'unknown') cites.link_type = c
    return {
      id: `demo-ev-${sid}`, artwork: DEMO_ARTWORK_ID, from_party: PARTIES[s.from].id, to_party: PARTIES[s.to].id,
      link_type: s.link, date_start: s.start, date_end: s.end, precision: s.precision, certainty: s.certainty, place: s.place, cites,
    }
  })
  const used = new Set(stepIds.flatMap((sid) => [STEPS[sid].from, STEPS[sid].to]))
  return {
    collections: sources.map((k) => ({ id: `demo-${k}`, name: SOURCE_NAME[k], source: `demo-${k}`, snapshot_date: SNAPSHOT })),
    source_records: sources.map((k) => ({ id: `demo-sr-${k}`, collection: `demo-${k}`, url: '#fictional', retrieved_at: `${SNAPSHOT}T00:00:00Z`, version: null, raw_path: 'fictional' })),
    claims,
    artworks: [{ id: DEMO_ARTWORK_ID, title: 'Untitled landscape (fictional)', artist: 'Artist X (fictional)', created: 'c. 1900', accession: 'DEMO-0001', image: '/demo-artwork.svg' }],
    parties: Object.entries(PARTIES).filter(([k]) => used.has(k)).map(([, p]) => p),
    party_aliases,
    events,
    matches: [],
    suggestions: [],
  }
}

/** Layer 1: museum record only. Layer 2: + dealer ledger. Layer 3: + auction catalogue. Each is complete on its own. */
export const demoLayers: EvidenceModel[] = LAYER_STEPS.map(build)
