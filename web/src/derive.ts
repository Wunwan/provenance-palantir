import type { ArtworkState, CertaintyShares, Decision, Derived, Gap } from './types'
import type { EvidenceModel } from './generated/contract'

import { NAZI_ERA, type FocusPeriod } from './focus'

/** Legacy name: the length of the Nazi-era preset (12 years). Prefer focusYears(focus). */
export const RISK_WINDOW_YEARS = NAZI_ERA.end - NAZI_ERA.start
/** Length of a focus period in years; Infinity when there is none (all periods). */
export const focusYears = (focus: FocusPeriod | null): number => (focus ? focus.end - focus.start : Infinity)
const HIDDEN_HOLDER = /^(private collection|possibly|a swiss private collector)/i

type Ev = EvidenceModel['events'][number]

const year = (d: string | null): number | null => {
  if (!d) return null
  const y = parseInt(d.slice(0, 4), 10)
  return Number.isNaN(y) ? null : y
}

const overlap = (a: number, b: number, c: number, d: number) =>
  Math.max(0, Math.min(b, d) - Math.max(a, c))


function isSilence(e: Ev): boolean {
  return e.date_start === null || e.date_end === null || e.date_start !== e.date_end
}

/** Group an artwork's events into silences; consecutive events with open bounds merge. */
function chains(events: Ev[]): Ev[][] {
  const out: Ev[][] = []
  let cur: Ev[] | null = null
  let prev: Ev | null = null
  for (const e of events) {
    if (!isSilence(e)) {
      cur = null
    } else if (cur && prev && (prev.date_end === null || e.date_start === null)) {
      cur.push(e)
    } else {
      cur = [e]
      out.push(cur)
    }
    prev = e
  }
  return out
}

function shares(events: Ev[]): CertaintyShares {
  const n = events.length || 1
  const count = (c: string) => events.filter((e) => e.certainty === c).length / n
  return { confirmed: count('confirmed'), approximate: count('approximate'), unknown: count('unknown') }
}

/**
 * Person-made verdict per match id. The latest decision on a match wins; when one alias has
 * several accepted candidates only the most recently decided stays accepted and its siblings
 * read as rejected. Undecided matches are absent.
 */
export function latestMatchDecisions(
  model: EvidenceModel,
  decisions: Decision[],
): Map<string, 'accepted' | 'rejected'> {
  const aliasOf = new Map((model.matches ?? []).map((m) => [m.id, m.alias]))
  const last = new Map<string, { choice: 'accepted' | 'rejected'; order: number }>()
  decisions.forEach((d, order) => {
    if ((d.choice === 'accepted' || d.choice === 'rejected') && aliasOf.has(d.target)) {
      last.set(d.target, { choice: d.choice, order })
    }
  })
  const winner = new Map<string, { id: string; order: number }>()
  for (const [id, v] of last) {
    if (v.choice !== 'accepted') continue
    const alias = aliasOf.get(id) as string
    const w = winner.get(alias)
    if (!w || v.order > w.order) winner.set(alias, { id, order: v.order })
  }
  const out = new Map<string, 'accepted' | 'rejected'>()
  for (const [id, v] of last) {
    out.set(id, v.choice === 'accepted' && winner.get(aliasOf.get(id) as string)?.id !== id ? 'rejected' : v.choice)
  }
  return out
}

/** With a focus period, riskYears and warParties measure that range; with none, every date counts equally. */
export function derive(model: EvidenceModel, decisions: Decision[], focus: FocusPeriod | null = null): Derived {
  const lo = focus ? focus.start : -Infinity
  const hi = focus ? focus.end : Infinity
  const partyName = new Map(model.parties.map((p) => [p.id, p.preferred_name]))
  const suggestions = new Map((model.suggestions ?? []).map((s) => [s.id, s]))
  // A hidden party stays hidden until a person accepts a match for one of its aliases that
  // resolves to a party whose own name is not a hidden holder.
  const verdicts = latestMatchDecisions(model, decisions)
  const aliasParty = new Map(model.party_aliases.map((a) => [a.id, a.party]))
  const resolved = new Set<string>()
  for (const m of model.matches ?? []) {
    const named = partyName.get(m.candidate_party)
    const party = aliasParty.get(m.alias)
    if (verdicts.get(m.id) === 'accepted' && party && named && !HIDDEN_HOLDER.test(named)) resolved.add(party)
  }
  const added = decisions.filter((d) => d.choice === 'evidence_added' && d.suggestion)

  const artworks: ArtworkState[] = model.artworks.map((a) => {
    const events = model.events.filter((e) => e.artwork === a.id)
    const gaps: Gap[] = []
    for (const chain of chains(events)) {
      const first = chain[0]
      const last = chain[chain.length - 1]
      let start = year(first.date_start)
      let end = year(last.date_end)
      if (start === null) start = end
      if (end === null) end = start
      if (start === null || end === null || start === end) continue
      if (start > end) [start, end] = [end, start]

      const ids = chain.map((e) => e.id)
      const hidden = chain.some((e) =>
        [e.from_party, e.to_party].some((p) => {
          const name = p ? partyName.get(p) : undefined
          return !!name && HIDDEN_HOLDER.test(name) && !resolved.has(p as string)
        }),
      )
      let risk = overlap(start, end, lo, hi)
      let closed = false
      for (const d of added) {
        if (!ids.includes(d.target)) continue
        const s = suggestions.get(d.suggestion as string)
        if (!s) continue
        if (s.covers_start === null && s.covers_end === null) {
          closed = true
          continue
        }
        const cs = Math.max(year(s.covers_start) ?? start, start)
        const ce = Math.min(year(s.covers_end) ?? end, end)
        if (ce > cs) risk -= overlap(cs, ce, lo, hi)
      }
      if (closed) risk = 0
      risk = Math.max(0, risk)
      gaps.push({
        id: `${a.id}:${first.id}`,
        artwork: a.id,
        eventIds: ids,
        start,
        end,
        kind: hidden ? 'hidden_holder' : 'unattested',
        inRiskWindow: risk > 0,
        riskYears: risk,
        closed,
      })
    }
    const warParties = new Set<string>()
    for (const e of events) {
      const [s, t] = [year(e.date_start), year(e.date_end)]
      if (!focus) {
        if (e.from_party) warParties.add(e.from_party)
        if (e.to_party) warParties.add(e.to_party)
        continue
      }
      if (s === null && t === null) continue
      if ((t ?? s!) >= lo && (s ?? t!) <= hi) {
        if (e.from_party) warParties.add(e.from_party)
        if (e.to_party) warParties.add(e.to_party)
      }
    }
    return {
      artwork: a.id,
      gaps,
      riskYears: gaps.reduce((t, g) => t + g.riskYears, 0),
      shares: shares(events),
      warParties: warParties.size,
      longestRiskGap: gaps.reduce((m, g) => Math.max(m, g.riskYears), 0),
    }
  })

  // Most open years in the focus period first (all years when there is none). Ties: fewer parties named in those years, a longer single silence,
  // more unknown history overall, and only then the artwork id so the order is stable.
  artworks.sort(
    (x, y) =>
      y.riskYears - x.riskYears ||
      x.warParties - y.warParties ||
      y.longestRiskGap - x.longestRiskGap ||
      y.shares.unknown - x.shares.unknown ||
      x.artwork.localeCompare(y.artwork),
  )
  return { artworks }
}
