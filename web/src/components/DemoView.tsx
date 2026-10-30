import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { derive } from '../derive'
import { focusLabel, type FocusPeriod } from '../focus'
import { DEMO_ARTWORK_ID, LAYER_LABELS, demoLayers } from '../demo/scenario'
import ArtworkView from './ArtworkView'
import './demo.css'

const openYears = (layer: number, focus: FocusPeriod | null) =>
  derive(demoLayers[layer], [], focus).artworks.find((a) => a.artwork === DEMO_ARTWORK_ID)?.riskYears ?? 0
const years = (n: number) => `${n} ${n === 1 ? 'year' : 'years'}`

/** A fictional showcase: the same artwork seen with one, two, then three invented sources. */
export default function DemoView({ onBack, focus }: { onBack: () => void; focus: FocusPeriod | null }) {
  const [layer, setLayer] = useState(0)
  const btns = useRef<(HTMLButtonElement | null)[]>([])
  const model = demoLayers[layer]
  const derived = useMemo(() => derive(model, [], focus), [model, focus])
  const now = openYears(layer, focus)
  const base = openYears(0, focus)

  const onKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (layer + step + LAYER_LABELS.length) % LAYER_LABELS.length
    setLayer(next)
    btns.current[next]?.focus()
  }

  return (
    <div className="view">
      <p className="demo-banner" role="note">
        <strong>FICTIONAL EXAMPLE.</strong> Every artwork, person, record and source on this page is invented to show how sources combine. Nothing here is real data.
      </p>
      <div className="demo-bar">
        <div className="demo-pick">
          <h2 id="demo-pick-h" className="demo-pick-label">Sources used</h2>
          <div className="demo-switch" role="radiogroup" aria-labelledby="demo-pick-h">
            {LAYER_LABELS.map((label, i) => (
              <button
                key={label}
                ref={(el) => { btns.current[i] = el }}
                type="button"
                role="radio"
                aria-checked={layer === i}
                tabIndex={layer === i ? 0 : -1}
                className={`demo-opt${layer === i ? ' is-on' : ''}`}
                onClick={() => setLayer(i)}
                onKeyDown={onKey}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="demo-sum" aria-live="polite">
          <p>
            Years with no recorded holder{focus ? ` (${focusLabel(focus)})` : ''}: <span className="demo-n">{now}</span>
          </p>
          {layer > 0 && <p className="demo-was">was {base} with the museum record alone</p>}
          {layer === 2 && <p className="demo-q">A gap is a question: {years(now)} {now === 1 ? 'is' : 'are'} still open.</p>}
        </div>
      </div>
      <ArtworkView
        model={model}
        artworkId={DEMO_ARTWORK_ID}
        derived={derived}
        decisions={[]}
        onDecide={() => {}}
        onBack={onBack}
        focus={focus}
      />
    </div>
  )
}
