import type { HandoverEvent } from './types'

/** Contract for the map view of the ownership journey. Everything here is derived from segments, events and the places file; nothing is invented. */

// ---- web/src/generated/places.json (written by the geocoding script from pipeline/data/places*.json) ----

export interface Place {
  id: string // stable, e.g. "paris"
  label: string // as written in the source: "Paris", "Washington, D.C."
  lat: number
  lon: number
  precision: 'city' | 'region' | 'country'
  wikidataId?: string // e.g. "Q90"
  source: 'wikidata' | 'manual'
  retrievedAt: string // ISO date
  note?: string // e.g. historical name vs modern name
}

export interface PlacesFile {
  places: Place[]
  /** Every distinct label found on the events: its place id, or null when it could not be resolved. "Unknown" is never a label here. */
  labels: Record<string, string | null>
}

// ---- Derived route ----

/** One or more consecutive segments in the same place. */
export interface Stay {
  id: string // `stay-${index}`
  placeId: string
  segmentIds: string[] // in time order
  start: number
  end: number
  owners: string[] // for the tooltip, never printed on the map
}

/** The step between two stays in different places. */
export interface Move {
  id: string // `move-${index}`
  order: number // 1, 2, 3 ... in time order
  from: string // stay id
  to: string // stay id
  year: number | null // when it happened, if the data says
  linkType: 'known' | 'unknown' // 'known' only when a handover event connects the two segments
  handoverType?: HandoverEvent['type']
  inFocus: boolean // happens, or could have happened, inside the app's optional focus period; always false when no focus is set
  segmentIds: string[] // the segments on either side of the move
}

/** A period that cannot be placed: no known place, or an undrawn holder, or the time between two stays. */
export interface UnplacedPeriod {
  id: string // `unplaced-${index}`
  start: number | null
  end: number | null
  owner: string | null
  reason: 'no_place' | 'unresolved_place' | 'gap'
  segmentIds: string[]
}

export interface Route {
  stays: Stay[]
  moves: Move[]
  unplaced: UnplacedPeriod[]
  placeIds: string[] // distinct places used, in first-visit order
}
