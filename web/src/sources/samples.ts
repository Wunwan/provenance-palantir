import type { EvidenceModel } from '../generated/contract'
import { derive } from '../derive'
import { existingEventsFor, yearOf, type ExistingEvent, type ExistingGap } from './merge'
import type { IncomingStep, SourceType } from './types'

export const ILLUSTRATIVE_NOTE = 'Illustrative sample: a real record, reformatted. This engine is planned, not built.'

export interface Sample {
  artworkId: string
  title: string
  fellBack: boolean // true when the preferred Van Gogh had no external suggestion
  preferredId: string
  suggestionId: string
  provider: string
  url: string | null
  /** The raw text as each source type would carry it. */
  raw: Record<Exclude<SourceType, 'api'>, string>
  step: IncomingStep
  existing: ExistingEvent[]
  gaps: ExistingGap[]
}

const PREFERRED = 'cma-1958.32'

type Sug = NonNullable<EvidenceModel['suggestions']>[number]

/** Pull the pieces out of a Getty preview like: Getty ... records “Knoedler Purchase of Stock Number A3535 (1946-07-26)” involving M. Knoedler & Co. */
function parsePreview(preview: string) {
  const quoted = /[“"]([^”"]+)[”"]/.exec(preview)?.[1] ?? preview
  const holder = /involving\s+(.+)$/.exec(preview)?.[1] ?? 'Unnamed party'
  const date = /\((\d{4}(?:-\d{2}-\d{2})?)\)/.exec(quoted)?.[1] ?? ''
  const stock = /Stock Number\s+(\S+)/.exec(quoted)?.[1] ?? ''
  const action = /\b(Purchase|Sale)\b/.exec(quoted)?.[1] ?? 'Transaction'
  return { quoted, holder, date, stock, action }
}

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** The real suggestion used by the illustrative previews, or null when the model has none. */
export function buildSample(model: EvidenceModel): Sample | null {
  const external = (model.suggestions ?? []).filter((s) => s.origin === 'external' && s.provider === 'Getty Provenance Index')
  const eventArtwork = new Map(model.events.map((e) => [e.id, e.artwork]))
  const withCover = (s: Sug) => s.covers_start !== null || s.covers_end !== null
  const pick = (list: Sug[]) => list.find(withCover) ?? list[0]
  const own = external.filter((s) => eventArtwork.get(s.event) === PREFERRED)
  const sug = own.length > 0 ? pick(own) : pick(external)
  if (!sug) return null
  const artworkId = eventArtwork.get(sug.event) as string
  const art = model.artworks.find((a) => a.id === artworkId)
  if (!art) return null
  const p = parsePreview(sug.preview)
  const start = yearOf(sug.covers_start)
  const end = yearOf(sug.covers_end)
  const when = p.date || (start !== null ? String(start) : 'undated')
  const party = p.holder
  const raw = {
    csv: [
      'stock_no,date,party,transaction,reference',
      [p.stock || '-', when, party, p.action, 'Knoedler stock book'].map(csvCell).join(','),
    ].join('\n'),
    pdf: `Catalogue entry, ${art.artist}, ${art.title}.\nProvenance: ${party}, ${p.action.toLowerCase()} recorded ${when}${p.stock ? `, stock no. ${p.stock}` : ''}.`,
    text: `${art.title}: according to the dealer's stock records, ${party} had a ${p.action.toLowerCase()} of this picture on ${when}${p.stock ? ` (stock number ${p.stock})` : ''}.`,
    scan: `${when}   ${p.stock ? `No. ${p.stock}   ` : ''}${party}   ${p.action.toLowerCase()}   [handwritten ledger line]`,
  }
  const existingEvents = existingEventsFor(model, artworkId)
  const gaps = derive(model, []).artworks.find((a) => a.artwork === artworkId)?.gaps ?? []
  return {
    artworkId,
    title: art.title,
    fellBack: artworkId !== PREFERRED,
    preferredId: PREFERRED,
    suggestionId: sug.id,
    provider: sug.provider,
    url: sug.url,
    raw,
    step: { holder: party, start: start ?? yearOf(p.date), end: end ?? yearOf(p.date), words: p.quoted },
    existing: existingEvents,
    gaps: gaps.map((g) => ({ id: g.id, start: g.start, end: g.end })),
  }
}
