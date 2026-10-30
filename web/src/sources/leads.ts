import type { EvidenceModel } from '../generated/contract'
import type { Lead } from '../journey/types'
import { sourceIdOf } from './sourceStyle'

const yearOf = (s: string | null | undefined): number | null => {
  const m = s?.match(/\d{4}/)
  return m ? Number(m[0]) : null
}

/** A short name for a lead: the quoted record title in a Getty preview, else the preview itself. */
const titleOf = (preview: string): string => preview.match(/[“"]([^”"]+)[”"]/)?.[1] ?? preview

/**
 * External suggestions for one artwork, as leads. A lead is never part of the chain: it is a possible
 * piece of evidence, drawn apart from the owner bars and always labelled by its source.
 */
export function leadsFor(model: EvidenceModel, artworkId: string): Lead[] {
  const mine = new Set(model.events.filter((e) => e.artwork === artworkId).map((e) => e.id))
  return (model.suggestions ?? [])
    .filter((s) => mine.has(s.event))
    .map((s) => ({
      id: s.id,
      source: sourceIdOf(s.provider),
      title: titleOf(s.preview),
      preview: s.preview,
      start: yearOf(s.covers_start),
      end: yearOf(s.covers_end) ?? yearOf(s.covers_start),
      url: s.url,
      retrievedAt: s.retrieved_at,
    }))
}
