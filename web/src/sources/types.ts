import type { EvidenceModel } from '../generated/contract'

/** Contract for the Sources feature: the source cards, the add-source flow, and the live preview endpoint. */

// ---- Sources page data (web/src/generated/sources.json, written by the pipeline) ----

export interface SourceRecordInfo {
  id: string // source_record id in the evidence model
  accession: string
  artworkId: string // e.g. "cma-1958.32"
  license: string // the record's own license flag, e.g. "CC0"
  retrievedAt: string // ISO
  version: string | null
  url: string // the raw API URL
}

export interface GettyLookup {
  name: string // the name searched
  query: string
  endpoint: string
  retrievedAt: string
  results: number // suggestions it produced
}

export interface SourceProvider {
  id: 'cleveland' | 'getty'
  name: string // "Cleveland Museum of Art Open Access API"
  kind: 'API' | 'Cached lookup'
  role: 'records' | 'suggestions' // records feed the collection; suggestions are external leads only
  description: string // what it is and how this project uses it
  endpoint: string
  license: string
  retrievedAt: string // latest retrieved date
  records?: SourceRecordInfo[] // cleveland
  lookups?: GettyLookup[] // getty, the cached lookups
  notCovered?: string[] // getty names that were tried but timed out
}

export interface SourcesFile {
  providers: SourceProvider[]
}

// ---- Live preview (GET /api/preview?accession=...), dev server only ----

export type PreviewErrorCode = 'not_found' | 'no_provenance' | 'api_error' | 'bad_request' | 'server_unavailable'

export interface PreviewStages {
  fetch: { endpoint: string; httpStatus: number; rawSteps: number }
  snapshot: { retrievedAt: string; version: string | null; bytes: number; license: string }
  clean: { events: number; parties: number; aliases: number; skippedSteps: number }
  claims: { count: number; withPlace: number }
  match: { newMatches: number; withArtworks: string[] } // name matches against the existing collection
}

export interface RawStep {
  index: number // provenance[index] in the raw record
  description: string
  date: string | null
}

/** The new records as a fragment of the evidence model, so the browser can merge it and run the same derive(). */
export type ModelFragment = Pick<
  EvidenceModel,
  'artworks' | 'parties' | 'party_aliases' | 'events' | 'claims' | 'source_records'
>

export type PreviewResponse =
  | {
      ok: true
      accession: string
      alreadyInCollection: string | null // artwork id when it is already loaded
      artwork: { title: string; artist: string; created: string; image: string }
      stages: PreviewStages
      raw: RawStep[]
      fragment: ModelFragment
    }
  | { ok: false; code: PreviewErrorCode; message: string }

// ---- Drafts, kept in the browser like match decisions (ADR 0002) ----

export type SourceType = 'api' | 'csv' | 'pdf' | 'text' | 'scan'

export interface DraftSource {
  id: string
  type: SourceType
  title: string // e.g. "Cleveland API, 1965.233" or the file name
  addedAt: string // ISO
  accession?: string
  fileName?: string
  fileBytes?: number
  summary: string // one line: what the preview found
}

// ---- Merge preview: how an incoming source's steps would join an artwork's existing chain ----

export type MergeLabel = 'agrees' | 'fills_gap' | 'conflicts' | 'new'

export interface IncomingStep {
  holder: string // name as written in the incoming source
  start: number | null // year
  end: number | null
  words: string // the exact source words this came from
}

export interface MergeRow {
  step: IncomingStep
  label: MergeLabel
  against: string | null // the existing event or gap id it was compared with
  note: string // one plain sentence: why it got this label
}
