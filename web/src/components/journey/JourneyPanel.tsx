import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Claim, SourceRecord } from '../../generated/contract'
import type { Gap } from '../../types'
import type { Journey, Lead, Segment } from '../../journey/types'
import type { PlacesFile } from '../../journey/routeTypes'
import { buildRoute } from '../../journey/route'
import GapActions from './GapActions'
import Inspector from './Inspector'
import JourneyChart from './JourneyChart'
import MapView from './map/MapView'
import { TYPE_NAME } from './typeNames'
import { UNKNOWN, eventKey, gapKey, gapLabel } from './layout'
import './journey.css'
import './map/map.css'

export interface JourneyPanelProps {
  journey: Journey
  claims: Claim[] | Map<string, Claim>
  sourceRecords: SourceRecord[] | Map<string, SourceRecord>
  focus?: { start: number; end: number } | null
  leads?: Lead[]
  gaps?: Pick<Gap, 'id' | 'start' | 'end' | 'kind' | 'closed'>[]
  places: PlacesFile
}

type View = 'timeline' | 'map'
const KEY = 'provenance-journey-view-v1'
const VIEWS: { id: View; label: string }[] = [{ id: 'timeline', label: 'Timeline' }, { id: 'map', label: 'Map' }]

function loadView(): View {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'map' ? 'map' : 'timeline'
  } catch {
    return 'timeline'
  }
}
const toMap = <T extends { id: string }>(v: T[] | Map<string, T>) => (v instanceof Map ? v : new Map(v.map((x) => [x.id, x])))
const placeName = (p: string) => (p === UNKNOWN ? 'Place unknown' : p)
const span = (s: Segment) => `${s.fadeUntil ? `by ${s.fadeUntil}` : s.start}–${s.fadeFrom ? `until ${s.end}` : s.end}`

export default function JourneyPanel({ journey, claims, sourceRecords, focus, gaps, leads, places }: JourneyPanelProps) {
  const [view, setView] = useState<View>(loadView)
  const [selected, setSelected] = useState<string | null>(null)
  const btnRefs = useRef(new Map<View, HTMLButtonElement>())

  const choose = (v: View) => {
    setView(v)
    try { localStorage.setItem(KEY, v) } catch { /* storage unavailable: the choice just is not remembered */ }
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = VIEWS.findIndex((v) => v.id === view)
    let n = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % VIEWS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + VIEWS.length - 1) % VIEWS.length
    if (n < 0) return
    e.preventDefault()
    choose(VIEWS[n].id)
    btnRefs.current.get(VIEWS[n].id)?.focus()
  }

  const route = useMemo(() => buildRoute(journey, places, gaps ?? [], focus ?? null), [journey, places, gaps, focus])
  const claimMap = useMemo(() => toMap(claims), [claims])
  const sourceMap = useMemo(() => toMap(sourceRecords), [sourceRecords])

  const unplacedKey = (u: { start: number | null; end: number | null; reason: string; segmentIds: string[]; id: string }) => {
    const g = u.reason === 'gap' ? (gaps ?? []).find((x) => x.start === u.start && x.end === u.end) : undefined
    return g ? gapKey(g) : u.segmentIds[0] ?? u.id
  }

  const selSeg = selected ? journey.segments.find((s) => s.id === selected) : undefined
  const selGap = selected ? (gaps ?? []).find((g) => gapKey(g) === selected) : undefined
  const selEv = selected ? journey.events.find((e) => eventKey(e) === selected) : undefined
  const segById = new Map(journey.segments.map((s) => [s.id, s]))

  return (
    <div className="jp">
      <div className="jp-head">
        <h2 id="aw-journey-h" className="aw-sub">Journey</h2>
        <div className="jp-switch" role="radiogroup" aria-label="Journey view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              ref={(el) => { if (el) btnRefs.current.set(v.id, el); else btnRefs.current.delete(v.id) }}
              type="button"
              role="radio"
              aria-checked={view === v.id}
              tabIndex={view === v.id ? 0 : -1}
              className={`jp-opt${view === v.id ? ' is-on' : ''}`}
              onClick={() => choose(v.id)}
              onKeyDown={onKey}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'timeline' ? (
        <JourneyChart journey={journey} claims={claims} sourceRecords={sourceRecords} focus={focus} gaps={gaps} leads={leads} selectedId={selected} onSelect={setSelected} />
      ) : (
        <>
          <MapView journey={journey} route={route} places={places.places} selectedId={selected} onSelect={setSelected} unplacedKey={unplacedKey} hasFocus={!!focus} />
          {selGap && <Inspector heading={gapLabel(selGap)} detail={selGap.kind === 'hidden_holder' ? 'The record names only a hidden holder during this time.' : 'No event in the record says who held the work during this time.'} claims={claimMap} sources={sourceMap}><GapActions key={gapKey(selGap)} /></Inspector>}
          {selSeg && <Inspector heading={selSeg.owner} detail={`${placeName(selSeg.place)}, ${span(selSeg)}${selSeg.note ? `. ${selSeg.note}` : ''}`} claimIds={selSeg.claimIds} claims={claimMap} sources={sourceMap} />}
          {selEv && <Inspector heading={`${TYPE_NAME[selEv.type]}, ${selEv.year}`} detail={`${segById.get(selEv.from)?.owner ?? ''} to ${segById.get(selEv.to)?.owner ?? ''}`} claimIds={selEv.claimIds} claims={claimMap} sources={sourceMap} />}
        </>
      )}
    </div>
  )
}
