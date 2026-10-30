import type { SourceId } from '../sources/sourceStyle'
/** Contract for the artwork journey chart (docs: journey-spec). Derived from the evidence model, never edited (ADR 0002). */

export type Place = string // only places this artwork passed through, plus "Unknown"

export interface Segment {
  id: string
  owner: string // party name as resolved, or "Owner and place unknown"
  place: Place // "Unknown" when no place is known
  start: number // year
  end: number // year
  fadeUntil?: number // approximate start: "by 1902" fades from start to 1902
  fadeFrom?: number // approximate end: "until 1937" fades from this year to end
  kind: 'own' | 'custody' | 'unknown'
  source: SourceId // where the evidence for this holding comes from
  drawn: boolean // false when the source gives this holder no placeable dates (inside a silence); listed in text, not drawn
  note?: string // tooltip line
  claimIds: string[] // every segment traces to claims (source + span)
}

export interface HandoverEvent {
  year: number
  type: 'sale' | 'gift' | 'seizure' | 'custody' | 'restitution'
  from: string // segment id
  to: string // segment id
  label: string // e.g. "Seized, 1938"
  claimIds: string[]
}

/** A boundary between segments with no HandoverEvent means the source does not say how the work changed hands. */
export interface Journey {
  artworkId: string
  title: string
  segments: Segment[] // in time order
  events: HandoverEvent[]
  places: Place[] // rows, geographic order, "Unknown" last
}

/** A possible piece of external evidence for this artwork. Never part of the chain; drawn as a dashed mark in its source colour. */
export interface Lead {
  id: string
  source: SourceId
  title: string // short name, e.g. "Knoedler Purchase of Stock Number A3535 (1946-07-26)"
  preview: string // the full sentence shown in the inspector
  start: number | null // year; null when the record has no date, so it cannot be placed on the timeline
  end: number | null
  url: string | null
  retrievedAt: string // ISO
}
