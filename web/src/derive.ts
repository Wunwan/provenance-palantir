import type { Decision, Derived } from './types'
import type { EvidenceModel } from './generated/contract'

/** STUB: replaced by the derive agent. Gaps, risk window, ranks and certainty shares from events + decisions. */
export function derive(model: EvidenceModel, decisions: Decision[]): Derived {
  void model
  void decisions
  return { artworks: [] }
}
