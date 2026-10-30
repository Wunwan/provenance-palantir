import type { EvidenceModel } from '../../generated/contract'
import { sources } from './sourcesData'
import { day, hostPath } from './format'

interface Props {
  model: EvidenceModel
  id: string
  onBack: () => void
  onOpenArtwork: (artworkId: string) => void
}

export default function SourceDetail({ model, id, onBack, onOpenArtwork }: Props) {
  const p = sources.providers.find((x) => x.id === id)
  if (!p) {
    return (
      <main className="view">
        <section className="row">
          <div className="row-label">Source</div>
          <div className="row-body">
            <button type="button" className="src-link" onClick={onBack}>← All sources</button>
            <p className="lede">This source is not in the loaded data.</p>
          </div>
        </section>
      </main>
    )
  }
  const claimCounts = new Map<string, number>()
  for (const c of model.claims) claimCounts.set(c.source_record, (claimCounts.get(c.source_record) ?? 0) + 1)
  const artworks = new Map(model.artworks.map((a) => [a.id, a]))
  const lookups = p.lookups ?? []
  const records = p.records ?? []

  const facts: [string, string][] =
    p.id === 'getty'
      ? [
          ['Endpoint', p.endpoint],
          ['Lookups', String(lookups.length)],
          ['Suggestions produced', String(lookups.reduce((n, l) => n + l.results, 0))],
          ['Last retrieved', day(p.retrievedAt)],
        ]
      : [
          ['Endpoint', p.endpoint],
          ['Records', String(records.length)],
          ['License', p.license],
          ['Last retrieved', day(p.retrievedAt)],
        ]

  return (
    <main className="view">
      <section className="row">
        <div className="row-label">
          <button type="button" className="src-link" onClick={onBack}>← All sources</button>
        </div>
        <div className="row-body">
          <h1 className="view-title">{p.name}</h1>
          <p className="source-tags">
            <span>{p.kind}</span>
            <span>{p.role === 'records' ? 'Supplies records' : 'External · cached · suggestions only'}</span>
          </p>
          <p className="lede">{p.description}</p>
          <dl className="source-facts">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {records.map((r) => {
        const a = artworks.get(r.artworkId)
        return (
          <section key={r.id} className="row" aria-label={`Record ${r.accession}`}>
            <h2 className="row-label src-origin">{r.accession}</h2>
            <div className="row-body">
              <p className="source-rec-title">{a ? a.title : r.artworkId}</p>
              {a && <p className="src-meta">{a.artist}</p>}
              <p className="src-meta">
                Retrieved {day(r.retrievedAt)}
                {r.version ? ` · version ${r.version}` : ''} · {claimCounts.get(r.id) ?? 0} claims
                extracted · license {r.license}
              </p>
              <p className="source-actions">
                <button type="button" className="sort-btn" onClick={() => onOpenArtwork(r.artworkId)}>
                  Open artwork
                </button>
                <a className="src-link" href={r.url} target="_blank" rel="noreferrer">
                  View raw record: {hostPath(r.url)}
                </a>
              </p>
            </div>
          </section>
        )
      })}

      {lookups.map((l) => (
        <section key={l.name + l.query} className="row" aria-label={`Lookup ${l.name}`}>
          <h2 className="row-label src-origin">Lookup</h2>
          <div className="row-body">
            <p className="source-rec-title">{l.name}</p>
            <p className="src-meta">
              Retrieved {day(l.retrievedAt)} · {l.results} suggestions produced
            </p>
            <p className="src-meta source-endpoint">{l.endpoint}</p>
          </div>
        </section>
      ))}

      {p.notCovered && p.notCovered.length > 0 && (
        <section className="row" aria-label="Not covered">
          <h2 className="row-label src-origin">Not covered</h2>
          <div className="row-body">
            <p className="lede">Not covered: these names were tried and could not be fetched.</p>
            <ul className="src-list">
              {p.notCovered.map((n) => (
                <li key={n} className="src-row">{n}</li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  )
}
