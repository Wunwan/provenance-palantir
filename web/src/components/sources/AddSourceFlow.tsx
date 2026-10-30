import { useEffect, useRef, useState } from 'react'
import type { EvidenceModel } from '../../generated/contract'
import type { DraftSource, PreviewResponse, SourceType } from '../../sources/types'
import './flow/flow.css'
import { EMPTY, TYPES, canContinue, fetchPreview, typeName, type Provided } from './flow/info'
import PreviewStep from './flow/PreviewStep'
import ProvideStep from './flow/ProvideStep'

export interface AddSourceFlowProps {
  model: EvidenceModel
  onClose: () => void
  onSaveDraft: (draft: Omit<DraftSource, 'id' | 'addedAt'>) => void
  onOpenArtwork: (artworkId: string) => void
}

const STEPS = ['Choose type', 'Provide', 'Preview']

export default function AddSourceFlow({ model, onClose, onSaveDraft, onOpenArtwork }: AddSourceFlowProps) {
  const [step, setStep] = useState(1)
  const [type, setType] = useState<SourceType>('api')
  const [chosen, setChosen] = useState(false)
  const [provided, setProvided] = useState<Provided>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<PreviewResponse | null>(null)
  const abort = useRef<AbortController | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => heading.current?.focus(), [step])

  const pick = (t: SourceType) => {
    setType(t)
    setChosen(true)
    setProvided(EMPTY)
    setResponse(null)
  }

  const doFetch = async () => {
    abort.current?.abort()
    const ctl = new AbortController()
    abort.current = ctl
    setLoading(true)
    try {
      const r = await fetchPreview(provided.accession.trim(), ctl.signal)
      setResponse(r)
      setLoading(false)
      setStep(3)
    } catch {
      /* aborted: a newer request or unmount owns the state */
    }
  }

  const back = () => {
    abort.current?.abort()
    setLoading(false)
    setStep((s) => Math.max(1, s - 1))
  }

  const save = (summary: string) => {
    const f = provided.file
    const acc = provided.accession.trim()
    const title = type === 'api' ? `Cleveland API, ${acc}` : f?.name ?? `${typeName(type)} source`
    onSaveDraft({
      type,
      title,
      ...(type === 'api' ? { accession: acc } : {}),
      ...(f ? { fileName: f.name, fileBytes: f.size } : {}),
      summary,
    })
  }

  return (
    <main className="view fl">
      <div className="fl-top">
        <button type="button" className="fl-link" onClick={onClose}>Back to sources</button>
        <ol className="fl-stepper" aria-label="Add a source, steps">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={step === i + 1 ? 'step' : undefined} className={step > i + 1 ? 'done' : undefined}>{s}</li>
          ))}
        </ol>
      </div>
      <section className="row">
        <p className="row-label">Step {step} of 3</p>
        <div className="row-body">
          <h2 className="view-title" tabIndex={-1} ref={heading}>{['Choose a type', 'Provide it', 'Preview'][step - 1]}</h2>
          {step === 1 && (
            <ul className="fl-tiles">
              {TYPES.map((t) => (
                <li key={t.id}>
                  <button type="button" className="fl-tile" aria-pressed={chosen && type === t.id} onClick={() => pick(t.id)}>
                    <span className="fl-tile-name">{t.name}</span>
                    <span className={`fl-badge${t.live ? ' live' : ''}`}>{t.live ? 'Live' : 'Planned'}</span>
                    <span className="fl-tile-what">{t.what}{t.live ? '' : ' The engine is not built yet; the preview is illustrative.'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {step === 2 && <ProvideStep type={type} value={provided} onChange={setProvided} loading={loading} onFetch={doFetch} />}
          {step === 3 && (
            <PreviewStep model={model} type={type} response={response} onOpenArtwork={onOpenArtwork} onSave={save} onBack={back} />
          )}
        </div>
      </section>
      <div className="fl-nav">
        {step > 1 && <button type="button" className="fl-btn" onClick={back}>Back</button>}
        {step === 1 && (
          <button type="button" className="fl-btn primary" disabled={!chosen} onClick={() => setStep(2)}>Next</button>
        )}
        {step === 2 && type !== 'api' && (
          <button type="button" className="fl-btn primary" disabled={!canContinue(type, provided)} onClick={() => setStep(3)}>Next</button>
        )}
      </div>
    </main>
  )
}
