import { useMemo, useState } from 'react'
import type { EvidenceModel } from '../../../generated/contract'
import { derive } from '../../../derive'
import { classifyMerge, existingEventsFor, mergeModel, sameHolder, yearOf } from '../../../sources/merge'
import { ILLUSTRATIVE_NOTE, buildSample, type Sample } from '../../../sources/samples'
import type { IncomingStep, MergeLabel, MergeRow, PreviewResponse, SourceType } from '../../../sources/types'
import { ERROR_COPY, typeName } from './info'

type Ok = Extract<PreviewResponse, { ok: true }>
type Ev = EvidenceModel['events'][number]

interface Props {
  model: EvidenceModel
  type: SourceType
  response: PreviewResponse | null
  onOpenArtwork: (id: string) => void
  onSave: (summary: string) => void
  onBack: () => void
}

const LABELS: Record<MergeLabel, string> = { agrees: 'Agrees', fills_gap: 'Fills a gap', conflicts: 'Conflicts', new: 'New' }

interface Stage { name: string; n: number | string; sub: string }
interface RawRow { key: number; index: string; text: string; date?: string | null }
interface CleanRow { key: string; line: string; sub: string; certainty: string; raws: number[] }

const yr = (d: string | null) => d ?? '?'
const dates = (e: Ev) => (e.date_start === e.date_end ? yr(e.date_start) : `${yr(e.date_start)} to ${yr(e.date_end)}`)

export default function PreviewStep({ model, type, response, onOpenArtwork, onSave, onBack }: Props) {
  if (type === 'api') {
    if (!response) return <Calm text={ERROR_COPY.server_unavailable} onBack={onBack} />
    if (!response.ok) return <Calm text={ERROR_COPY[response.code] ?? response.message} detail={response.message} onBack={onBack} />
    return <ApiPreview model={model} r={response} onOpenArtwork={onOpenArtwork} onSave={onSave} />
  }
  return <SamplePreview model={model} type={type} onOpenArtwork={onOpenArtwork} onSave={onSave} />
}

function Calm({ text, detail, onBack }: { text: string; detail?: string; onBack: () => void }) {
  return (
    <div role="alert">
      <p className="fl-msg calm">{text}</p>
      {detail && detail !== text && <p className="fl-local">Service said: {detail}</p>}
      <button type="button" className="fl-btn" onClick={onBack}>Back</button>
    </div>
  )
}

function Pipeline({ stages, illustrative }: { stages: Stage[]; illustrative: boolean }) {
  return (
    <ol className="fl-pipe" aria-label="Pipeline">
      {stages.map((s) => (
        <li key={s.name} className={`fl-stage${illustrative ? ' illus' : ''}`}>
          <div className="fl-stage-name">{s.name}</div>
          <div className="fl-stage-n">{s.n}</div>
          <div className="fl-stage-sub">{s.sub}{illustrative ? ' (illustrative)' : ''}</div>
        </li>
      ))}
    </ol>
  )
}

function RawAndCleaned({ raw, clean, rawTitle }: { raw: RawRow[]; clean: CleanRow[]; rawTitle: string }) {
  const [active, setActive] = useState<number[]>([])
  return (
    <div className="fl-cols">
      <div className="fl-col">
        <h3>{rawTitle}</h3>
        <div className="fl-scroll" tabIndex={0} role="region" aria-label={rawTitle}>
          <ul className="fl-list">
            {raw.map((r) => (
              <li key={r.key} className={`fl-li${active.includes(r.key) ? ' hl' : ''}`}>
                <span className="fl-idx">{r.index}</span>
                <span>
                  {r.text}
                  {r.date && <span className="fl-raw-d">{r.date}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="fl-col">
        <h3>Cleaned events</h3>
        <div className="fl-scroll">
          <ul className="fl-list">
            {clean.map((c) => (
              <li
                key={c.key}
                className="fl-li"
                tabIndex={0}
                style={{ gridTemplateColumns: '18px 1fr' }}
                onMouseEnter={() => setActive(c.raws)}
                onMouseLeave={() => setActive([])}
                onFocus={() => setActive(c.raws)}
                onBlur={() => setActive([])}
              >
                <span className={`fl-form ${c.certainty}`} title={c.certainty} />
                <span>
                  <span className="fl-ev-line">{c.line}</span>
                  <span className="fl-ev-sub">{c.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function SaveBar({ onSave, summary }: { onSave: (s: string) => void; summary: string }) {
  return (
    <div className="fl-nav">
      <p className="fl-notice">Preview only: nothing is added to the collection.</p>
      <button type="button" className="fl-btn primary" onClick={() => onSave(summary)}>Save as draft source</button>
    </div>
  )
}

function MergeList({ rows, existing }: { rows: MergeRow[]; existing: ReturnType<typeof existingEventsFor> }) {
  return (
    <div className="fl-cols">
      <div className="fl-col">
        <h3>Existing chain</h3>
        <div className="fl-scroll">
          <ul className="fl-list">
            {existing.map((e) => (
              <li key={e.id} className="fl-li" style={{ gridTemplateColumns: '1fr' }}>
                <span>
                  {e.from} to {e.to}
                  <span className="fl-ev-sub">{e.start === null && e.end === null ? 'undated' : e.start === e.end ? e.start : `${e.start ?? '?'} to ${e.end ?? '?'}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="fl-col">
        <h3>Incoming steps</h3>
        <ul className="fl-merge">
          {rows.map((r, i) => (
            <li key={i} className="fl-mrow" style={{ gridTemplateColumns: '1fr' }}>
              <span className={`fl-label ${r.label}`}>{LABELS[r.label]}</span>
              <span>
                {r.step.holder}, {r.step.start === r.step.end ? (r.step.start ?? 'undated') : `${r.step.start ?? '?'} to ${r.step.end ?? '?'}`}
                <span className="fl-ev-sub">{r.note}</span>
                <p className="fl-words">{r.step.words}</p>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ApiPreview({ model, r, onOpenArtwork, onSave }: { model: EvidenceModel; r: Ok } & Pick<Props, 'onOpenArtwork' | 'onSave'>) {
  const { fragment, stages } = r
  const names = useMemo(() => {
    const m = new Map(model.parties.map((p) => [p.id, p.preferred_name]))
    for (const p of fragment.parties) m.set(p.id, p.preferred_name)
    return m
  }, [model, fragment])
  const nameOf = (id: string) => names.get(id) ?? id
  const rawByIndex = useMemo(() => new Map(r.raw.map((x) => [x.index, x])), [r.raw])
  const claimIdx = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of fragment.claims) {
      const i = /provenance\[(\d+)\]/.exec(c.field_path)?.[1]
      if (i !== undefined) m.set(c.id, Number(i))
    }
    return m
  }, [fragment.claims])

  const artworkId = r.alreadyInCollection ?? fragment.artworks[0]?.id ?? ''
  const merged = useMemo(() => mergeModel(model, fragment), [model, fragment])
  const derived = useMemo(() => derive(merged, []), [merged])
  const state = derived.artworks.find((a) => a.artwork === artworkId)
  const fragEvents = fragment.events.filter((e) => e.artwork === artworkId)

  const rawRows: RawRow[] = r.raw.map((x) => ({ key: x.index, index: `[${x.index}]`, text: x.description, date: x.date }))
  const cleanRows: CleanRow[] = fragEvents.map((e) => {
    const raws = [...new Set(Object.values(e.cites).flat().map((c) => claimIdx.get(c)).filter((x): x is number => x !== undefined))]
    return {
      key: e.id,
      line: `${nameOf(e.from_party)} to ${nameOf(e.to_party)}`,
      sub: `${dates(e)}, ${e.precision}, ${e.certainty}${raws.length ? `, from step ${raws.map((i) => `[${i}]`).join(' ')}` : ''}`,
      certainty: e.certainty,
      raws,
    }
  })

  const gapCount = state?.gaps.length ?? 0
  const stageRows: Stage[] = [
    { name: 'Fetch', n: stages.fetch.rawSteps, sub: `raw steps, HTTP ${stages.fetch.httpStatus}` },
    { name: 'Snapshot', n: stages.snapshot.bytes, sub: `bytes, ${stages.snapshot.license}` },
    { name: 'Clean', n: stages.clean.events, sub: `events, ${stages.clean.parties} parties, ${stages.clean.skippedSteps} skipped` },
    { name: 'Claims', n: stages.claims.count, sub: `${stages.claims.withPlace} with a place` },
    { name: 'Match', n: stages.match.newMatches, sub: 'name matches' },
    { name: 'Gaps', n: gapCount, sub: `${state?.riskYears ?? 0} years with no recorded holder` },
  ]

  const incoming: IncomingStep[] = fragEvents.map((e) => {
    const idx = [...new Set(Object.values(e.cites).flat().map((c) => claimIdx.get(c)).filter((x): x is number => x !== undefined))][0]
    return { holder: nameOf(e.to_party), start: yearOf(e.date_start), end: yearOf(e.date_end), words: (idx !== undefined && rawByIndex.get(idx)?.description) || '' }
  })

  const art = r.artwork
  const summary = `${art.title}: ${fragEvents.length} events, ${gapCount} gaps${r.alreadyInCollection ? ' (already in the collection)' : ''}`

  return (
    <div>
      <h3 className="fl-sub" style={{ marginTop: 0 }}>{art.title}, {art.artist}, {art.created}</h3>
      <Pipeline stages={stageRows} illustrative={false} />
      <h3 className="fl-sub">Raw beside cleaned</h3>
      <RawAndCleaned raw={rawRows} clean={cleanRows} rawTitle="Raw steps as fetched" />
      <h3 className="fl-sub">{r.alreadyInCollection ? 'Merge preview' : 'What this would change'}</h3>
      {r.alreadyInCollection ? (
        <AlreadyLoaded model={model} id={r.alreadyInCollection} incoming={incoming} gaps={derived.artworks.find((a) => a.artwork === r.alreadyInCollection)?.gaps ?? []} onOpenArtwork={onOpenArtwork} />
      ) : (
        <NewArtwork model={model} r={r} gaps={state?.gaps ?? []} risk={state?.riskYears ?? 0} nEvents={fragEvents.length} onOpenArtwork={onOpenArtwork} />
      )}
      <SaveBar onSave={onSave} summary={summary} />
    </div>
  )
}

function AlreadyLoaded({ model, id, incoming, gaps, onOpenArtwork }: { model: EvidenceModel; id: string; incoming: IncomingStep[]; gaps: { id: string; start: number | null; end: number | null }[] } & Pick<Props, 'onOpenArtwork'>) {
  const existing = existingEventsFor(model, id)
  const rows = classifyMerge(existing, gaps, incoming)
  return (
    <div>
      <p className="fl-msg" role="status">No new information: this record is already loaded.</p>
      <p><button type="button" className="fl-btn" onClick={() => onOpenArtwork(id)}>Open artwork</button></p>
      <MergeList rows={rows} existing={existing} />
    </div>
  )
}

function NewArtwork({ model, r, gaps, risk, nEvents, onOpenArtwork }: { model: EvidenceModel; r: Ok; gaps: { id: string; start: number | null; end: number | null }[]; risk: number; nEvents: number } & Pick<Props, 'onOpenArtwork'>) {
  const titleOf = new Map(model.artworks.map((a) => [a.id, a.title]))
  // The holding museum appears once in every artwork; listing it as 'shared' is noise (build.py filters it the same way).
  const links = r.fragment.parties
    .filter((p) => !/Cleveland Museum/i.test(p.preferred_name))
    .map((p) => {
      const same = model.parties.filter((q) => q.id !== p.id && sameHolder(q.preferred_name, p.preferred_name))
      const arts = new Set<string>()
      for (const q of same) for (const e of model.events) if (e.from_party === q.id || e.to_party === q.id) arts.add(e.artwork)
      return { name: p.preferred_name, arts: [...arts] }
    })
    .filter((l) => l.arts.length > 0)
  const reported = r.stages.match.withArtworks.map((w) => {
    const a = model.artworks.find((x) => x.id === w || x.title === w || x.accession === w)
    return { label: w, id: a?.id ?? null }
  })
  return (
    <div>
      <ul className="fl-sum">
        <li><b>1</b>new artwork</li>
        <li><b>{nEvents}</b>events</li>
        <li><b>{r.fragment.parties.length}</b>holders</li>
        <li><b>{r.stages.match.newMatches}</b>matches with existing</li>
        <li><b>{gaps.length}</b>gaps</li>
        <li><b>{risk}</b>years with no recorded holder</li>
      </ul>
      <h3 className="fl-sub">Links to your collection</h3>
      {links.length === 0 && reported.length === 0 ? (
        <p className="fl-msg">No holder in this chain also appears in an artwork already in the collection.</p>
      ) : (
        <ul className="fl-merge">
          {links.map((l) => (
            <li key={l.name} className="fl-mrow">
              <span className="fl-label agrees">Shared holder</span>
              <span>
                {l.name} also appears in:{' '}
                {l.arts.map((a, i) => (
                  <span key={a}>
                    {i > 0 && ', '}
                    <button type="button" className="fl-link" onClick={() => onOpenArtwork(a)}>{titleOf.get(a) ?? a}</button>
                  </span>
                ))}
              </span>
            </li>
          ))}
          {reported.length > 0 && (
            <li className="fl-mrow">
              <span className="fl-label new">Name matches</span>
              <span>
                {reported.map((w, i) => (
                  <span key={w.label}>
                    {i > 0 && ', '}
                    {w.id ? <button type="button" className="fl-link" onClick={() => onOpenArtwork(w.id as string)}>{titleOf.get(w.id)}</button> : w.label}
                  </span>
                ))}
              </span>
            </li>
          )}
        </ul>
      )}
      <h3 className="fl-sub">Gaps it would show</h3>
      {gaps.length === 0 ? (
        <p className="fl-msg">The chain has no silences.</p>
      ) : (
        <ul className="fl-merge">
          {gaps.map((g) => (
            <li key={g.id} className="fl-mrow">
              <span className="fl-label new">Gap</span>
              <span>{g.start ?? '?'} to {g.end ?? '?'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SamplePreview({ model, type, onOpenArtwork, onSave }: { model: EvidenceModel; type: Exclude<SourceType, 'api'> } & Pick<Props, 'onOpenArtwork' | 'onSave'>) {
  const sample: Sample | null = useMemo(() => buildSample(model), [model])
  if (!sample) return <p className="fl-msg calm">The collection has no external suggestion to build an illustrative sample from.</p>
  const rows = classifyMerge(sample.existing, sample.gaps, [sample.step])
  const count = (l: MergeLabel) => rows.filter((x) => x.label === l).length
  const lines = sample.raw[type as Exclude<SourceType, 'api'>]
  const stages: Stage[] = [
    { name: 'Fetch', n: lines.split('\n').length, sub: type === 'csv' ? 'rows' : type === 'pdf' ? 'excerpt lines' : type === 'text' ? 'paragraph lines' : 'ledger lines' },
    { name: 'Snapshot', n: lines.length, sub: 'characters kept' },
    { name: 'Clean', n: 1, sub: 'event' },
    { name: 'Claims', n: 1, sub: 'claim' },
    { name: 'Match', n: count('agrees') + count('fills_gap'), sub: 'with the chain' },
    { name: 'Gaps', n: count('fills_gap'), sub: 'filled' },
  ]
  const s = sample.step
  const rawRows: RawRow[] = [{ key: 0, index: type === 'csv' ? 'row' : type === 'scan' ? 'line' : '[0]', text: lines }]
  const cleanRows: CleanRow[] = [{ key: 'c0', line: s.holder, sub: `${s.start === s.end ? s.start : `${s.start} to ${s.end}`}, approximate`, certainty: 'approximate', raws: [0] }]
  return (
    <div>
      <p className="fl-illus">{ILLUSTRATIVE_NOTE}</p>
      <p className="fl-local" style={{ marginTop: 0 }}>
        Sample: {sample.title} ({sample.artworkId}), from a {sample.provider} suggestion.
        {sample.fellBack && ` The Van Gogh (${sample.preferredId}) has no external suggestion in the model, so the first artwork that has one is used.`}
      </p>
      <Pipeline stages={stages} illustrative />
      <h3 className="fl-sub">Raw beside cleaned</h3>
      <RawAndCleaned raw={rawRows} clean={cleanRows} rawTitle={`${typeName(type)} as it would arrive`} />
      <h3 className="fl-sub">Merge preview against {sample.title}</h3>
      <MergeList rows={rows} existing={sample.existing} />
      <p className="fl-local"><button type="button" className="fl-link" onClick={() => onOpenArtwork(sample.artworkId)}>Open {sample.title}</button></p>
      <SaveBar onSave={onSave} summary={`Illustrative ${typeName(type)} preview, sample from ${sample.title}; engine planned`} />
    </div>
  )
}
