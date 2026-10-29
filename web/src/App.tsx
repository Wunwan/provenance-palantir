import type { Claim, Dataset, Event } from './generated/contract'
import raw from './generated/dataset.json'

const dataset = raw as unknown as Dataset

const partyName = new Map(dataset.parties.map((p) => [p.id, p.preferred_name]))
const claimById = new Map(dataset.claims.map((c) => [c.id, c]))
const recordById = new Map(dataset.source_records.map((r) => [r.id, r]))

const LINK_LABEL: Record<Event['link_type'], string> = {
  sale: 'sold to',
  gift: 'gift to',
  descent: 'by descent to',
  bequest: 'bequest to',
  unknown: 'link not stated, then',
}

function dates(e: Event): string {
  if (e.date_start === e.date_end) return e.date_start ?? 'date unknown'
  return `${e.date_start ?? '?'} to ${e.date_end ?? '?'}`
}

function SourceWords({ claimIds }: { claimIds: string[] }) {
  const claims = [...new Set(claimIds)].map((id) => claimById.get(id)).filter((c): c is Claim => !!c)
  return (
    <ul className="source-words">
      {claims.map((c) => (
        <li key={c.id}>
          <a href={recordById.get(c.source_record)?.url} target="_blank" rel="noreferrer">
            “{c.text}”
          </a>{' '}
          <span className="where">{c.field_path}</span>
        </li>
      ))}
    </ul>
  )
}

export default function App() {
  const artwork = dataset.artworks[0]
  const record = dataset.source_records[0]
  return (
    <main>
      <h1>{artwork.title}</h1>
      <p className="byline">
        {artwork.artist}, {artwork.created}. Cleveland Museum of Art, {artwork.accession}. Record retrieved{' '}
        {record.retrieved_at.slice(0, 10)}.
      </p>
      <ol className="events">
        {dataset.events.map((e) => (
          <li key={e.id}>
            <p>
              <strong>{partyName.get(e.from_party)}</strong> {LINK_LABEL[e.link_type]}{' '}
              <strong>{partyName.get(e.to_party)}</strong>
            </p>
            <p className="meta">
              {dates(e)} · {e.precision} · {e.certainty}
            </p>
            <SourceWords claimIds={Object.values(e.cites).flat()} />
          </li>
        ))}
      </ol>
    </main>
  )
}
