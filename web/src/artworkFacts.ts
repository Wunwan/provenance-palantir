import type { EvidenceModel } from './generated/contract'
import { focusYears } from './derive'
import { NAZI_ERA, focusLabel, type FocusPeriod } from './focus'

/** Plain facts about one artwork's recorded history, shown on the collection cards and the artwork page. */
export interface ArtworkFacts {
  holders: number // distinct parties named anywhere in the chain (owners, dealers, institutions)
  firstYear: number | null // earliest year any step mentions
}

const yearOf = (s: string | null): number | null => {
  const m = s?.match(/\d{4}/)
  return m ? Number(m[0]) : null
}

export function artworkFacts(model: EvidenceModel, artworkId: string): ArtworkFacts {
  const parties = new Set<string>()
  const years: number[] = []
  for (const e of model.events) {
    if (e.artwork !== artworkId) continue
    if (e.from_party) parties.add(e.from_party)
    if (e.to_party) parties.add(e.to_party)
    for (const y of [yearOf(e.date_start), yearOf(e.date_end)]) if (y !== null) years.push(y)
  }
  return { holders: parties.size, firstYear: years.length ? Math.min(...years) : null }
}

/**
 * The record in words. With a focus period: fully, partly or not recorded, relative to its length,
 * labelled by the period. With none: just how many gaps there are.
 */
export function recordStatus(
  openYears: number,
  gapCount: number,
  focus: FocusPeriod | null,
): { label: string; status: string } {
  if (!focus) return { label: 'Gaps in the record', status: gapCount === 0 ? 'No gaps' : `${gapCount} ${gapCount === 1 ? 'gap' : 'gaps'}` }
  const status =
    openYears <= 0 ? 'Fully recorded' : openYears >= focusYears(focus) ? 'Not recorded' : 'Partly recorded'
  return { label: focusLabel(focus), status }
}

/** Compatibility wrapper: the Nazi-era words for a count of open years out of 12. */
export function warYearsStatus(riskYears: number): 'Fully recorded' | 'Partly recorded' | 'Not recorded' {
  return recordStatus(riskYears, 0, NAZI_ERA).status as 'Fully recorded' | 'Partly recorded' | 'Not recorded'
}
