import type { ArtworkState, CertaintyShares, Decision, Derived, Gap } from './types'
import type { EvidenceModel } from './generated/contract'

const RISK_START = 1933
const RISK_END = 1945
const HIDDEN_HOLDER = /^(private collection|possibly|a swiss private collector)/i

type Ev = EvidenceModel['events'][number]

const year = (d: string | null): number | null => {
  if (!d) return null
  const y = parseInt(d.slice(0, 4), 10)
  return Number.isNaN(y) ? null : y
}

const overlap = (a: number, b: number, c: number, d: number) =>
  Math.max(0, Math.min(b, d) - Math.max(a, c))

const riskOf = (start: number, end: number) => overlap(start, end, RISK_START, RISK_END)

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

export function derive(model: EvidenceModel, decisions: Decision[]): Derived {
  const partyName = new Map(model.parties.map((p) => [p.id, p.preferred_name]))
  const suggestions = new Map((model.suggestions ?? []).map((s) => [s.id, s]))
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
          return !!name && HIDDEN_HOLDER.test(name)
        }),
      )
      let risk = riskOf(start, end)
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
        if (ce > cs) risk -= overlap(cs, ce, RISK_START, RISK_END)
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
    return {
      artwork: a.id,
      gaps,
      riskYears: gaps.reduce((t, g) => t + g.riskYears, 0),
      shares: shares(events),
    }
  })

  artworks.sort((x, y) => y.riskYears - x.riskYears || x.artwork.localeCompare(y.artwork))
  return { artworks }
}
