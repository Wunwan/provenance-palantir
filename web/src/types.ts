/** A person's call, kept in the browser (ADR 0002). Targets are stable IDs, never positions. */
export interface Decision {
  id: string
  target: string // a match id (accepted/rejected) or an event id (evidence_added)
  choice: 'accepted' | 'rejected' | 'evidence_added'
  suggestion: string | null // the suggestion id when evidence was added
  note: string
  at: string // ISO time
}

/** A silence in one artwork's history, derived from its events; never edited (ADR 0002). */
export interface Gap {
  id: string
  artwork: string
  eventIds: string[] // the events whose date ranges make up this silence
  start: number | null // year; null when the source gives no start
  end: number | null // year; null when the source gives no end
  kind: 'unattested' | 'hidden_holder'
  inRiskWindow: boolean // overlaps 1933 to 1945
  riskYears: number // years of this gap inside 1933 to 1945
  closed: boolean // an added piece of evidence has closed it
}

export interface CertaintyShares {
  confirmed: number // 0..1
  approximate: number
  unknown: number
}

export interface ArtworkState {
  artwork: string // artwork id
  gaps: Gap[]
  riskYears: number // total missing years in the risk window
  shares: CertaintyShares
}

export interface Derived {
  artworks: ArtworkState[] // ranked, most missing risk-window years first
}

export interface ArtworkViewProps {
  model: import('./generated/contract').EvidenceModel
  artworkId: string
  derived: Derived
  decisions: Decision[]
  onDecide: (decision: Omit<Decision, 'id' | 'at'>) => void
  onBack: () => void
}
