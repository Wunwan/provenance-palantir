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
  inRiskWindow: boolean // overlaps the focus period (legacy name); any dated gap when no focus is set
  riskYears: number // years of this gap inside the focus period (legacy name); the whole gap length when no focus is set
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
  riskYears: number // total open years inside the focus period (legacy name); all gap years when no focus is set
  shares: CertaintyShares
  warParties: number // distinct parties named on steps that touch the focus period (all parties when none; legacy name); fewer means thinner coverage
  longestRiskGap: number // the largest single silence inside the focus period (whole gap when none), in years
}

export interface Derived {
  artworks: ArtworkState[] // ranked: most open years in the focus period (all years when none), then fewer parties named in them, then the longer single silence, then more unknown history, then artwork id
}

export interface ArtworkViewProps {
  model: import('./generated/contract').EvidenceModel
  artworkId: string
  derived: Derived
  focus?: import('./focus').FocusPeriod | null
  decisions: Decision[]
  onDecide: (decision: Omit<Decision, 'id' | 'at'>) => void
  onBack: () => void
}
