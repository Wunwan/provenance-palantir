import type { EvidenceModel } from '../generated/contract'
import type { Gap } from '../types'
import type { IncomingStep, MergeRow, ModelFragment } from './types'

/** An existing event reduced to what merging needs: holder names resolved and years parsed. */
export interface ExistingEvent {
  id: string
  from: string
  to: string
  start: number | null
  end: number | null
}

/** The part of a Gap that merging needs (a full derive() Gap fits). */
export type ExistingGap = Pick<Gap, 'id' | 'start' | 'end'>

const TITLES = new Set(['baron', 'baroness', 'mrs', 'mr', 'ms', 'dr', 'sir', 'the'])
const UNNAMED = /^(private collection|possibly|a swiss private collector|unknown|\?)/i

/** Lowercase, strip accents, punctuation and titles; return the sorted token set as a string key. */
export function nameTokens(name: string): string[] {
  const plain = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
  const tokens = plain.split(/\s+/).filter((t) => t && !TITLES.has(t))
  return [...new Set(tokens)].sort()
}

export function sameHolder(a: string, b: string): boolean {
  const x = nameTokens(a)
  const y = nameTokens(b)
  return x.length > 0 && x.length === y.length && x.every((t, i) => t === y[i])
}

export const yearOf = (d: string | null | undefined): number | null => {
  if (!d) return null
  const y = parseInt(d.slice(0, 4), 10)
  return Number.isNaN(y) ? null : y
}

type Span = [number, number]
const span = (s: number | null, e: number | null): Span | null => {
  const a = s ?? e
  const b = e ?? s
  if (a === null || b === null) return null
  return a <= b ? [a, b] : [b, a]
}

/** Overlap in years; two points (or a point inside a range) count when they touch, ranges that only share an end do not. */
function overlaps(a: Span, b: Span): boolean {
  if (a[0] === a[1] || b[0] === b[1]) return a[0] <= b[1] && b[0] <= a[1]
  return Math.min(a[1], b[1]) - Math.max(a[0], b[0]) > 0
}

const years = (s: Span) => (s[0] === s[1] ? `${s[0]}` : `${s[0]} to ${s[1]}`)

export function classifyMerge(
  existingEvents: ExistingEvent[],
  existingGaps: ExistingGap[],
  incoming: IncomingStep[],
): MergeRow[] {
  return incoming.map((step): MergeRow => {
    const sp = span(step.start, step.end)
    if (!sp) return { step, label: 'new', against: null, note: 'The step gives no dates, so it cannot be placed against the chain yet.' }
    const named = step.holder.trim() !== '' && !UNNAMED.test(step.holder.trim())
    const touching = existingEvents.filter((e) => {
      const es = span(e.start, e.end)
      return es !== null && overlaps(sp, es)
    })
    if (named) {
      const same = touching.find((e) => sameHolder(e.from, step.holder) || sameHolder(e.to, step.holder))
      if (same) return { step, label: 'agrees', against: same.id, note: `The same holder is already named for ${years(sp)}.` }
      const gap = existingGaps.find((g) => {
        const gs = span(g.start, g.end)
        return gs !== null && sp[0] >= gs[0] && sp[1] <= gs[1]
      })
      if (gap) return { step, label: 'fills_gap', against: gap.id, note: `A named holder for ${years(sp)}, inside a span where the chain has no holder.` }
    }
    if (touching.length > 0) {
      const e = touching[0]
      return { step, label: 'conflicts', against: e.id, note: `The years overlap an existing step with different holders (${e.from} to ${e.to}).` }
    }
    return { step, label: 'new', against: null, note: 'Nothing in the existing chain overlaps these years.' }
  })
}

/** Resolve an artwork's events to names and years for classifyMerge. */
export function existingEventsFor(model: EvidenceModel, artworkId: string): ExistingEvent[] {
  const name = new Map(model.parties.map((p) => [p.id, p.preferred_name]))
  return model.events
    .filter((e) => e.artwork === artworkId)
    .map((e) => ({
      id: e.id,
      from: name.get(e.from_party) ?? e.from_party,
      to: name.get(e.to_party) ?? e.to_party,
      start: yearOf(e.date_start),
      end: yearOf(e.date_end),
    }))
}

/** Concatenate the fragment's tables onto the model, keeping the first row of any id. */
export function mergeModel(model: EvidenceModel, fragment: ModelFragment): EvidenceModel {
  const join = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const seen = new Set(a.map((x) => x.id))
    return [...a, ...b.filter((x) => !seen.has(x.id) && seen.add(x.id))]
  }
  return {
    ...model,
    artworks: join(model.artworks, fragment.artworks),
    parties: join(model.parties, fragment.parties),
    party_aliases: join(model.party_aliases, fragment.party_aliases),
    events: join(model.events, fragment.events),
    claims: join(model.claims, fragment.claims),
    source_records: join(model.source_records, fragment.source_records),
  }
}
