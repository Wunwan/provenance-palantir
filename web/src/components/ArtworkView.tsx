import { useMemo } from 'react'
import { Button, Tag } from '@blueprintjs/core'
import type { Claim, EvidenceModel, Event, Match } from '../generated/contract'
import type { ArtworkViewProps, Decision } from '../types'
import { deriveJourney } from '../journey/derive'
import { SOURCES, sourceOfEvent } from '../sources/sourceStyle'
import { leadsFor } from '../sources/leads'
import { focusYears } from '../derive'
import { focusLabel } from '../focus'
import { artworkFacts, recordStatus } from '../artworkFacts'
import JourneyPanel from './journey/JourneyPanel'
import placesFile from '../generated/places.json'
import type { PlacesFile } from '../journey/routeTypes'
import './artwork/artwork.css'

const ACTION: Record<Event['link_type'], string> = {
  sale: 'Sale',
  gift: 'Gift',
  descent: 'By descent',
  bequest: 'Bequest',
  restitution: 'Restitution',
  unknown: 'Not stated',
}

/** The year or years of a step in plain words, following its precision. */
function whenOf(e: Event): string {
  const start = e.date_start
  const end = e.date_end
  switch (e.precision) {
    case 'by': return `by ${end ?? start}`
    case 'until': return `until ${end ?? start}`
    case 'after': return `after ${start ?? end}`
    case 'circa': return `c. ${start ?? end}`
    default:
      if (start && end && start !== end) return `${start} to ${end}`
      return start ?? end ?? 'Not stated'
  }
}

const CERTAINTY_WORD: Record<string, string> = { confirmed: 'Confirmed', approximate: 'Approximate', unknown: 'Unknown' }

function SourceWords({ claimIds, model }: { claimIds: string[]; model: EvidenceModel }) {
  const claims = [...new Set(claimIds)]
    .map((id) => model.claims.find((c) => c.id === id))
    .filter((c): c is Claim => !!c)
  return (
    <ul className="aw-src">
      {claims.map((c) => (
        <li key={c.id}>
          <a href={model.source_records.find((r) => r.id === c.source_record)?.url} target="_blank" rel="noreferrer" title={`In the record: ${c.field_path}`}>
            “{c.text}”
          </a>
        </li>
      ))}
    </ul>
  )
}

function savedChoice(decisions: Decision[], target: string): Decision | undefined {
  return [...decisions].reverse().find((d) => d.target === target && d.choice !== 'evidence_added')
}

export default function ArtworkView({ model, artworkId, derived, focus = null, decisions, onDecide, onBack }: ArtworkViewProps) {
  const artwork = model.artworks.find((a) => a.id === artworkId)
  const fictional = !!artwork?.accession.startsWith('DEMO-')
  const state = derived.artworks.find((a) => a.artwork === artworkId)
  const name = (id: string) => model.parties.find((p) => p.id === id)?.preferred_name ?? id
  const events = model.events
    .filter((e) => e.artwork === artworkId)
  const gaps = state?.gaps ?? []
  const claimById = new Map(model.claims.map((c) => [c.id, c]))
  const recordsHere = new Set(
    events.flatMap((e) => Object.values(e.cites).flat()).map((id) => claimById.get(id)?.source_record),
  )
  const recordById = new Map(model.source_records.map((r) => [r.id, r]))
  const facts = artworkFacts(model, artworkId)
  const journey = useMemo(() => deriveJourney(model, artworkId), [model, artworkId])
  const leads = useMemo(() => leadsFor(model, artworkId), [model, artworkId])
  const aliasById = new Map(model.party_aliases.map((a) => [a.id, a]))
  const matches: Match[] = (model.matches ?? []).filter((m) => {
    const claim = claimById.get(aliasById.get(m.alias)?.claim ?? '')
    return claim ? recordsHere.has(claim.source_record) : false
  })

  if (!artwork) {
    return (
      <main className="aw">
        <Button icon="arrow-left" onClick={onBack}>Back</Button>
        <p className="aw-meta">This artwork is not in the loaded data.</p>
      </main>
    )
  }

  const focusRow = (() => {
    if (!state) return { label: focus ? focusLabel(focus) : 'Gaps in the record', text: 'not derived' }
    const r = recordStatus(state.riskYears, gaps.length, focus)
    if (!focus) return { label: r.label, text: String(gaps.length) }
    const open = state.riskYears > 0 ? `: no holder recorded for ${state.riskYears} of the ${focusYears(focus)} years` : ''
    return { label: r.label, text: `${r.status}${open}` }
  })()

  const record = model.source_records.find((r) => recordsHere.has(r.id))

  return (
    <main className="aw">
      <Button icon="arrow-left" variant="minimal" onClick={onBack}>Back to collection</Button>
      <header className="aw-head">
        {artwork.image && (
          <figure className="aw-figure">
            <img src={artwork.image} alt={`${artwork.title}, ${artwork.artist}`} />
            <figcaption>{fictional ? 'Illustration drawn for this demo. Not a real artwork.' : 'Image: Cleveland Museum of Art, from its open access record.'}</figcaption>
          </figure>
        )}
        <div className="aw-row">
          <p className="aw-row-label aw-label-small">Artwork</p>
          <div className="aw-row-body aw-head-text">
            <h1>{artwork.title}</h1>
            <p className="aw-by">{artwork.artist}, {artwork.created}</p>
            {record && (
              <p className="aw-meta">
                {fictional ? 'Origin: invented for this demo. There is no real record behind it.' : <>Origin: loaded data from <a href={record.url} target="_blank" rel="noreferrer">the source record</a>, retrieved {record.retrieved_at.slice(0, 10)}.</>}
              </p>
            )}
          </div>
        </div>
        <dl className="aw-facts">
          <div className="aw-row"><dt className="aw-row-label aw-label-small">Accession</dt><dd className="aw-row-body">{artwork.accession}</dd></div>
          <div className="aw-row"><dt className="aw-row-label aw-label-small">Created</dt><dd className="aw-row-body">{artwork.created}</dd></div>
          <div className="aw-row"><dt className="aw-row-label aw-label-small">Holders on record</dt><dd className="aw-row-body">{facts.holders}</dd></div>
          <div className="aw-row"><dt className="aw-row-label aw-label-small">Earliest record</dt><dd className="aw-row-body">{facts.firstYear ?? 'undated'}</dd></div>
          <div className="aw-row">
            <dt className="aw-row-label aw-label-small">{focusRow.label}</dt>
            <dd className="aw-row-body">{focusRow.text}</dd>
          </div>
        </dl>
      </header>

      <div className="aw-duo">
        <section className="aw-duo-main" aria-labelledby="aw-journey-h">
          <JourneyPanel journey={journey} claims={claimById} sourceRecords={recordById} focus={focus} gaps={state?.gaps} places={placesFile as PlacesFile}  leads={leads} />
        </section>

        <aside className="aw-duo-side" aria-labelledby="aw-chain-h">
          <h2 id="aw-chain-h" className="aw-sub">Chain of possession <span className="aw-tab-n">{events.length}</span></h2>
          <ol className="aw-cards">
            {events.map((e, i) => (
              <li key={e.id} className={`aw-own ${e.certainty}`}>
                <div className="aw-own-head">
                  <span className="aw-num">{String(i + 1).padStart(2, '0')}</span>
                  {(() => {
                    const src = SOURCES[sourceOfEvent(e, model)]
                    return (
                      <span className="aw-src-tag" style={{ ['--src' as string]: `var(${src.cssVar})` }} title={src.label}>
                        <i aria-hidden="true" />
                        {src.short}
                      </span>
                    )
                  })()}
                </div>
                <dl className="aw-facts-list">
                  <div className="aw-fact"><dt>Holder</dt><dd className="aw-fact-main">{name(e.to_party)}</dd></div>
                  <div className="aw-fact"><dt>Received from</dt><dd>{e.from_party ? name(e.from_party) : 'Not stated'}</dd></div>
                  <div className="aw-fact"><dt>Year</dt><dd>{whenOf(e)}</dd></div>
                  <div className="aw-fact"><dt>Action</dt><dd>{ACTION[e.link_type]}</dd></div>
                  <div className="aw-fact"><dt>Place</dt><dd>{e.place ?? 'Not stated'}</dd></div>
                  <div className="aw-fact">
                    <dt>Certainty</dt>
                    <dd><span className={`aw-form ${e.certainty}`} aria-hidden="true" />{CERTAINTY_WORD[e.certainty] ?? e.certainty}</dd>
                  </div>
                  <div className="aw-fact"><dt>Method</dt><dd>Read by rule</dd></div>
                  <div className="aw-fact aw-fact-src"><dt>Source words</dt><dd><SourceWords claimIds={Object.values(e.cites).flat()} model={model} /></dd></div>
                </dl>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {matches.length > 0 && (
        <section className="aw-row">
          <h2 className="aw-row-label">Name matches to review</h2>
          <div className="aw-row-body">
          <p className="aw-note">Origin: rule-produced. These are proposals and stay provisional until a person accepts them.</p>
          {matches.map((m) => {
            const saved = savedChoice(decisions, m.id)
            return (
              <div key={m.id} className="aw-card">
                <p>
                  “{aliasById.get(m.alias)?.name_as_written}” may be <strong>{name(m.candidate_party)}</strong>{' '}
                  <Tag minimal className="aw-tag">{m.band}</Tag>
                </p>
                <ul>{m.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                <div className="aw-actions">
                  <Button className="aw-accept" aria-pressed={saved?.choice === 'accepted'} onClick={() => onDecide({ target: m.id, choice: 'accepted', suggestion: null, note: '' })}>Accept</Button>
                  <Button className="aw-reject" variant="outlined" aria-pressed={saved?.choice === 'rejected'} onClick={() => onDecide({ target: m.id, choice: 'rejected', suggestion: null, note: '' })}>Reject</Button>
                  <span className="aw-meta">{saved ? `You ${saved.choice} this on ${saved.at.slice(0, 10)}.` : 'Not yet decided.'}</span>
                </div>
              </div>
            )
          })}
          </div>
        </section>
      )}
    </main>
  )
}
