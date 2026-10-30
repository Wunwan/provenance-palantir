import type { EvidenceModel } from '../generated/contract'
import type { DraftSource, SourceProvider } from '../sources/types'
import { sources } from './sources/sourcesData'
import { day, typeLabel } from './sources/format'

interface Props {
  model: EvidenceModel
  drafts: DraftSource[]
  onOpenSource: (id: string) => void
  onOpenDraft: (id: string) => void
  onAdd: () => void
}

function facts(p: SourceProvider): [string, string][] {
  if (p.id === 'getty') {
    const lookups = p.lookups ?? []
    return [
      ['Lookups', String(lookups.length)],
      ['Suggestions produced', String(lookups.reduce((n, l) => n + l.results, 0))],
      ['Last retrieved', day(p.retrievedAt)],
    ]
  }
  return [
    ['Records', String((p.records ?? []).length)],
    ['License', p.license],
    ['Last retrieved', day(p.retrievedAt)],
  ]
}

export default function SourcesView({ drafts, onOpenSource, onOpenDraft, onAdd }: Props) {
  return (
    <main className="view">
      <section className="row">
        <div className="row-label">Sources</div>
        <div className="row-body">
          <h1 className="view-title">Sources</h1>
          <p className="lede">
            Where every record in this collection comes from. Each card is one provider; open it to
            see its records.
          </p>
        </div>
      </section>
      <section className="sources-grid-wrap" aria-label="Providers and drafts">
        <ul className="sources-grid">
          {sources.providers.map((p) => (
            <li key={p.id}>
              <button type="button" className="source-card" onClick={() => onOpenSource(p.id)}>
                <span className="source-card-name">{p.name}</span>
                <span className="source-card-tags">
                  <span>{p.kind}</span>
                  <span>
                    {p.role === 'records' ? 'Supplies records' : 'External · cached · suggestions only'}
                  </span>
                </span>
                <span className="source-card-desc">{p.description}</span>
                <dl className="source-card-facts">
                  {facts(p).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </button>
            </li>
          ))}
          {drafts.map((d) => (
            <li key={d.id}>
              <button type="button" className="source-card" onClick={() => onOpenDraft(d.id)}>
                <span className="source-card-name">{d.title}</span>
                <span className="source-card-tags">
                  <span>Draft</span>
                  <span>{typeLabel[d.type] ?? d.type}</span>
                </span>
                <span className="source-card-desc">{d.summary}</span>
                <dl className="source-card-facts">
                  <div>
                    <dt>Added</dt>
                    <dd>{day(d.addedAt)}</dd>
                  </div>
                </dl>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="source-card source-card-add" onClick={onAdd}>
              <span className="source-card-name">+ Add source</span>
              <span className="source-card-desc">Preview a new record before it joins the collection.</span>
            </button>
          </li>
        </ul>
      </section>
    </main>
  )
}
