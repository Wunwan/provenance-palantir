import { useState } from 'react'
import type { DraftSource } from '../../sources/types'
import { day, typeLabel } from './format'

interface Props {
  draft: DraftSource | undefined
  onBack: () => void
  onDelete: (id: string) => void
}

export default function DraftDetail({ draft, onBack, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  if (!draft) {
    return (
      <main className="view">
        <section className="row">
          <div className="row-label">Draft</div>
          <div className="row-body">
            <p className="lede">This draft no longer exists.</p>
            <button type="button" className="sort-btn" onClick={onBack}>Back</button>
          </div>
        </section>
      </main>
    )
  }
  const fields: [string, string | undefined][] = [
    ['Type', typeLabel[draft.type] ?? draft.type],
    ['Added', day(draft.addedAt)],
    ['Accession', draft.accession],
    ['File', draft.fileName],
    ['Size', draft.fileBytes !== undefined ? `${draft.fileBytes} bytes` : undefined],
  ]
  return (
    <main className="view">
      <section className="row">
        <div className="row-label">
          <button type="button" className="src-link" onClick={onBack}>← All sources</button>
        </div>
        <div className="row-body">
          <h1 className="view-title">{draft.title}</h1>
          <p className="source-tags"><span>Draft</span></p>
          <p className="lede">{draft.summary}</p>
          <dl className="source-facts">
            {fields.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="source-actions">
            <button type="button" className="sort-btn" onClick={onBack}>Back</button>
            <button
              type="button"
              className="sort-btn"
              onClick={() => (confirming ? onDelete(draft.id) : setConfirming(true))}
              onBlur={() => setConfirming(false)}
            >
              {confirming ? 'Click again to delete' : 'Delete'}
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}
