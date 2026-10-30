import type { ReactNode } from 'react'
import type { Claim, SourceRecord } from '../../generated/contract'

export interface InspectorProps {
  heading: string
  detail?: string
  claimIds?: string[]
  claims: Map<string, Claim>
  sources: Map<string, SourceRecord>
  children?: ReactNode
}

export default function Inspector({ heading, detail, claimIds = [], claims, sources, children }: InspectorProps) {
  const found = claimIds.map((id) => claims.get(id)).filter((c): c is Claim => !!c)
  const sourceCount = new Set(found.map((c) => c.source_record)).size
  return (
    <section className="j-inspector" aria-live="polite">
      <h3 className="j-insp-h">{heading}</h3>
      {detail && <p className="j-insp-d">{detail}</p>}
      {children}
      {!claimIds.length ? null : found.length === 0 ? (
        <p className="j-insp-d">No claims are recorded for this yet.</p>
      ) : (
        <>
          {sourceCount > 1 && (
            <p className="j-insp-d">These claims come from {sourceCount} source records. Compare them before relying on one.</p>
          )}
          <ul className="j-claims">
            {found.map((c) => {
              const rec = sources.get(c.source_record)
              const label = rec ? `${rec.collection} · ${rec.id}` : c.source_record
              return (
                <li key={c.id}>
                  <blockquote>
                    {rec?.url ? (
                      <a href={rec.url} target="_blank" rel="noreferrer">“{c.text}”</a>
                    ) : (
                      <span>“{c.text}”</span>
                    )}
                  </blockquote>
                  <span className="j-claim-meta">{label} · {c.field_path} · {c.certainty} · {c.method}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
