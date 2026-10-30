import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import type { Claim, SourceRecord } from '../../generated/contract'
import type { Gap } from '../../types'
import type { Journey, Lead, Segment } from '../../journey/types'
import { SOURCES } from '../../sources/sourceStyle'
import type { SourceId } from '../../sources/sourceStyle'
import GapActions from './GapActions'
import Inspector from './Inspector'
import { MarkerShape } from './Marker'
import { TYPE_NAME } from './typeNames'
import { MIN_PLOT_WIDTH, UNKNOWN, computeLayout, gapKey, gapLabel, isDrawn, leadKey } from './layout'
import type { GapInput } from './layout'
import type { Layout } from './layout'
import './journey.css'

export interface JourneyChartProps {
  journey: Journey
  claims: Claim[] | Map<string, Claim>
  sourceRecords: SourceRecord[] | Map<string, SourceRecord>
  selectedId?: string | null // segment id, or "from>to" for a handover
  onSelect?: (id: string | null) => void
  leads?: Lead[]
  focus?: { start: number; end: number } | null
  gaps?: (Pick<Gap, 'id' | 'start' | 'end' | 'kind' | 'closed'>)[]
}

interface Item {
  id: string
  time: number
  order: number
  kind: 'segment' | 'event' | 'gap' | 'lead'
}

interface Tip { left: number; top: number; title: string; lines: string[] }

const toMap = <T extends { id: string }>(v: T[] | Map<string, T>) => (v instanceof Map ? v : new Map(v.map((x) => [x.id, x])))
const placeName = (p: string) => (p === UNKNOWN ? 'Place unknown' : p)
const span = (s: Segment) => `${s.fadeUntil ? `by ${s.fadeUntil}` : s.start}–${s.fadeFrom ? `until ${s.end}` : s.end}`

export default function JourneyChart({ journey, claims, sourceRecords, selectedId, onSelect, gaps, focus, leads }: JourneyChartProps) {
  const gid = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<string, SVGGElement>())
  const [boxWidth, setBoxWidth] = useState(MIN_PLOT_WIDTH)
  const [inner, setInner] = useState<string | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)

  const selected = selectedId !== undefined ? selectedId : inner
  const select = (id: string | null) => {
    if (selectedId === undefined) setInner(id)
    onSelect?.(id)
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth))
    ro.observe(el)
    setBoxWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [journey.segments.length])

  // Fixed minimum plot width keeps text at its rendered size on phones; the container scrolls sideways.
  const width = Math.max(MIN_PLOT_WIDTH, Math.floor(boxWidth))
  const layout: Layout | null = useMemo(
    () => (journey.segments.length ? computeLayout(journey, width, gaps, focus, leads) : null),
    [journey, width, gaps, focus, leads],
  )
  const claimMap = useMemo(() => toMap(claims), [claims])
  const sourceMap = useMemo(() => toMap(sourceRecords), [sourceRecords])
  const segById = useMemo(() => new Map(journey.segments.map((s) => [s.id, s])), [journey.segments])

  const items: Item[] = useMemo(() => {
    if (!layout) return []
    const segs: Item[] = journey.segments.filter(isDrawn).map((s, i) => ({ id: s.id, time: s.start, order: i * 2, kind: 'segment' }))
    const evs: Item[] = layout.markers.map((m, i) => ({ id: m.key, time: m.ev.year, order: i * 2 + 1, kind: 'event' }))
    const gs: Item[] = layout.gapBoxes.map((g, i) => ({ id: gapKey(g.gap), time: g.gap.start as number, order: i * 2 + 1, kind: 'gap' }))
    const ls: Item[] = layout.leadBoxes.map((l, i) => ({ id: leadKey(l.lead), time: l.lead.start as number, order: i * 2 + 1, kind: 'lead' }))
    return [...segs, ...evs, ...gs, ...ls].sort((a, b) => a.time - b.time || a.order - b.order)
  }, [journey.segments, layout])

  const tabStop = active && items.some((i) => i.id === active) ? active : items[0]?.id

  const showTip = useCallback((e: { clientX: number; clientY: number }, title: string, lines: string[]) => {
    const r = rootRef.current?.getBoundingClientRect()
    if (!r) return
    setTip({ left: Math.min(e.clientX - r.left + 12, Math.max(0, r.width - 250)), top: e.clientY - r.top + 12, title, lines })
  }, [])
  const showTipAt = useCallback((el: Element, title: string, lines: string[]) => {
    const b = el.getBoundingClientRect()
    showTip({ clientX: b.left + b.width / 2, clientY: b.bottom }, title, lines)
  }, [showTip])

  if (!layout) {
    return (
      <div className="j-root">
        <p className="j-empty">No journey to draw yet: this record has no ownership history to place on a timeline.</p>
      </div>
    )
  }

  const onKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    const i = items.findIndex((it) => it.id === id)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(items.length - 1, i + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, i - 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      select(id)
      return
    }
    if (next < 0) return
    e.preventDefault()
    setActive(items[next].id)
    itemRefs.current.get(items[next].id)?.focus()
  }

  const itemProps = (id: string, label: string, tipTitle: string, tipLines: string[]) => ({
    ref: (el: SVGGElement | null) => { if (el) itemRefs.current.set(id, el); else itemRefs.current.delete(id) },
    className: `j-item${selected === id ? ' is-selected' : ''}`,
    tabIndex: tabStop === id ? 0 : -1,
    role: 'button' as const,
    'aria-label': label,
    'aria-pressed': selected === id,
    onClick: () => { setActive(id); select(id) },
    onKeyDown: (e: KeyboardEvent<SVGGElement>) => onKey(e, id),
    onMouseMove: (e: MouseEvent) => showTip(e, tipTitle, tipLines),
    onMouseLeave: () => setTip(null),
    onFocus: (e: FocusEvent<SVGGElement>) => { setActive(id); showTipAt(e.currentTarget, tipTitle, tipLines) },
    onBlur: () => setTip(null),
  })

  const { x, rows, left, right, top, axisY } = layout
  const bandX = layout.focusX
  const lastRowY = rows[rows.length - 1].y
  const segTip = (s: Segment) => [`${placeName(s.place)}, ${span(s)}`, ...(s.note ? [s.note] : [])]
  const gapTip = (g: GapInput) => [g.kind === 'hidden_holder' ? 'The record names only a hidden holder during this time.' : 'No event in the record says who held the work during this time.']
  const leadTip = (l: Lead) => [`External lead from the ${SOURCES[l.source].label}; not part of the chain`]
  const evTip = (f: Segment, t: Segment) => [`${f.owner} to ${t.owner}`, `${placeName(f.place)} to ${placeName(t.place)}`]

  const barShape = (s: Segment, x1: number, x2: number, y: number): ReactNode => {
    if (s.kind === 'unknown') return <line className="j-bar-unknown" x1={x1} y1={y} x2={x2} y2={y} />
    if (s.kind === 'custody') return <rect className="j-bar-custody" x={x1} y={y - 5} width={x2 - x1} height={10} rx={2} />
    const src: SourceId = s.source ?? 'cleveland'
    const srcFill = `var(${SOURCES[src].cssVar}, var(--j-own))`
    const fu = s.fadeUntil != null ? Math.min(x2, Math.max(x1, x(s.fadeUntil))) : x1
    const ff = s.fadeFrom != null ? Math.max(fu, Math.min(x2, x(s.fadeFrom))) : x2
    return (
      <>
        {fu > x1 && <rect x={x1} y={y - 5} width={fu - x1} height={10} fill={`url(#${gid}-in-${src})`} />}
        {ff > fu && <rect className="j-bar-own" style={{ fill: srcFill }} x={fu} y={y - 5} width={ff - fu} height={10} rx={fu === x1 && ff === x2 ? 2 : 0} />}
        {x2 > ff && <rect x={ff} y={y - 5} width={x2 - ff} height={10} fill={`url(#${gid}-out-${src})`} />}
      </>
    )
  }

  const segDesc = (s: Segment) => `${s.owner}, ${placeName(s.place)}, ${span(s)}${s.kind === 'custody' ? ', custody not ownership' : ''}`
  const legendSources = (Object.keys(SOURCES) as SourceId[]).filter(
    (s) => layout.bars.some((b) => (b.seg.source ?? 'cleveland') === s) || (leads ?? []).some((l) => l.source === s),
  )
  const selLead = selected ? layout.leadBoxes.find((l) => leadKey(l.lead) === selected) : undefined
  const selSeg = selected ? segById.get(selected) : undefined
  const selGap = selected ? layout.gapBoxes.find((g) => gapKey(g.gap) === selected) : undefined
  const selMarker = selected ? layout.markers.find((m) => m.key === selected) : undefined

  return (
    <div className="j-root" ref={rootRef}>
      <div className="j-scroll" ref={scrollRef}>
        <svg
          className="j-svg"
          role="group"
          width={width}
          height={layout.height}
          viewBox={`0 0 ${width} ${layout.height}`}
          aria-label={`Ownership journey of ${journey.title} across places and owners`}
        >
          <defs>
            {(Object.keys(SOURCES) as SourceId[]).flatMap((id) => [
              <linearGradient key={`in-${id}`} id={`${gid}-in-${id}`} x1="0" x2="1">
                <stop offset="0" style={{ stopColor: `var(${SOURCES[id].cssVar}, var(--j-own))`, stopOpacity: 0.1 }} />
                <stop offset="1" style={{ stopColor: `var(${SOURCES[id].cssVar}, var(--j-own))`, stopOpacity: 1 }} />
              </linearGradient>,
              <linearGradient key={`out-${id}`} id={`${gid}-out-${id}`} x1="0" x2="1">
                <stop offset="0" style={{ stopColor: `var(${SOURCES[id].cssVar}, var(--j-own))`, stopOpacity: 1 }} />
                <stop offset="1" style={{ stopColor: `var(${SOURCES[id].cssVar}, var(--j-own))`, stopOpacity: 0.1 }} />
              </linearGradient>,
            ])}
          </defs>

          {layout.gapBoxes.map((g) => {
            const id = gapKey(g.gap)
            const h = lastRowY - top + 16
            return (
              <g key={id} {...itemProps(id, gapLabel(g.gap), g.label, gapTip(g.gap))} className={`j-item j-gap${g.gap.closed ? ' is-closed' : ''}${selected === id ? ' is-selected' : ''}`}>
                <rect className="j-gap-fill" x={g.x1} y={top} width={Math.max(0, g.x2 - g.x1)} height={h} />
                <line className="j-gap-edge" x1={g.x1} x2={g.x1} y1={top} y2={top + h} />
                <line className="j-gap-edge" x1={g.x2} x2={g.x2} y1={top} y2={top + h} />
                <rect className="j-focus" x={g.x1} y={top} width={Math.max(0, g.x2 - g.x1)} height={h} />
                <rect className="j-hit" x={g.x1} y={top} width={Math.max(0, g.x2 - g.x1)} height={h} />
                <text className="j-gap-label" x={g.lx} y={g.ly}>{g.label}</text>
              </g>
            )
          })}

          {bandX && (
            <g role="img" aria-label={`Focus period ${focus?.start} to ${focus?.end}`}>
              <title>{`Focus period ${focus?.start} to ${focus?.end}`}</title>
              <path className="j-bracket" d={`M${bandX[0]} ${top + 2}V${top - 3}H${bandX[1]}V${top + 2}`} />
              <line className="j-bracket" x1={bandX[0]} x2={bandX[0]} y1={axisY - 18} y2={axisY - 10} />
              <line className="j-bracket" x1={bandX[1]} x2={bandX[1]} y1={axisY - 18} y2={axisY - 10} />
              <text className="j-band-label" x={(bandX[0] + bandX[1]) / 2} y={top - 8} textAnchor="middle">
                {focus?.start} to {focus?.end}
              </text>
            </g>
          )}

          {rows.map((r) => (
            <g key={r.place}>
              <line className={`j-rowline${r.unknown ? ' is-unknown' : ''}`} x1={left} x2={right} y1={r.y} y2={r.y} />
              <text className={`j-rowlabel${r.unknown ? ' is-unknown' : ''}`} x={left - 12} y={r.y + 4} textAnchor="end">{r.place}</text>
            </g>
          ))}

          <line className="j-axis" x1={left} x2={right} y1={axisY - 14} y2={axisY - 14} />
          {layout.ticks.map((t, i) => (
            <text key={t.value} className="j-tick" x={t.x} y={axisY} textAnchor={i === 0 ? 'start' : i === layout.ticks.length - 1 ? 'end' : 'middle'}>
              {t.value}
            </text>
          ))}

          {layout.connectors.map((c) => (
            <line key={c.key} className="j-connector" x1={c.x} x2={c.x} y1={c.y1} y2={c.y2} />
          ))}

          {layout.bars.map(({ seg, x1, x2, y, spans }) => (
            <g key={seg.id} {...itemProps(seg.id, segDesc(seg), seg.owner, segTip(seg))}>
              {spans.map(([a, b]) => <g key={a}>{barShape(seg, a, b, y)}</g>)}
              <rect className="j-focus" x={x1 - 2} y={y - 8} width={x2 - x1 + 4} height={16} rx={3} />
              <rect className="j-hit" x={x1} y={y - 10} width={Math.max(x2 - x1, 6)} height={20} />
            </g>
          ))}

          {layout.leadBoxes.map((l) => {
            const id = leadKey(l.lead)
            const color = `var(${SOURCES[l.lead.source].cssVar})`
            return (
              <g key={id} {...itemProps(id, `${l.label}. ${leadTip(l.lead)[0]}`, l.lead.title, leadTip(l.lead))} className={`j-item j-lead${selected === id ? ' is-selected' : ''}`}>
                <rect className="j-lead-mark" style={{ stroke: color }} x={l.x1} y={l.y - 4} width={l.x2 - l.x1} height={8} rx={4} />
                <rect className="j-focus" x={l.x1 - 3} y={l.y - 8} width={l.x2 - l.x1 + 6} height={16} rx={4} />
                <rect className="j-hit" x={l.x1 - 3} y={l.y - 9} width={l.x2 - l.x1 + 6} height={18} />
                <text className="j-lead-label" style={{ fill: color }} x={l.lx} y={l.ly}>{l.label}</text>
              </g>
            )
          })}

          {layout.ownerLabels.map((l) => (
            <g key={l.seg.id} pointerEvents="none">
              {l.leader && <line className="j-leader" x1={l.ax} x2={l.ax} y1={l.barY + 7} y2={l.y - 12} />}
              <text className={`j-owner${l.seg.kind === 'unknown' ? ' is-unknown' : ''}`} x={l.x} y={l.y}>{l.seg.owner}</text>
            </g>
          ))}

          {layout.markers.map((m) => (
            <g key={m.key} {...itemProps(m.key, `${m.ev.label}: ${TYPE_NAME[m.ev.type]}, ${m.ev.year}, ${m.fromSeg.owner} to ${m.toSeg.owner}`, `${TYPE_NAME[m.ev.type]}, ${m.ev.year}`, evTip(m.fromSeg, m.toSeg))}>
              <MarkerShape type={m.ev.type} x={m.x} y={m.y} />
              <rect className="j-focus" x={m.x - 10} y={m.y - 10} width={20} height={20} rx={3} />
              <rect className="j-hit" x={m.x - 12} y={m.y - 12} width={24} height={24} />
            </g>
          ))}

          {layout.eventLabels.map((l, i) => (
            <text key={l.key} className={`j-evl j-evl-${layout.markers[i].ev.type}`} x={l.x} y={l.y} textAnchor={l.anchor} pointerEvents="none">
              {layout.markers[i].ev.label}
            </text>
          ))}
        </svg>
      </div>

      {tip && (
        <div className="j-tip" style={{ left: tip.left, top: tip.top }} role="presentation">
          <strong>{tip.title}</strong>
          {tip.lines.map((l, i) => <small key={i}>{l}</small>)}
        </div>
      )}

      <ul className="j-legend" aria-label="Legend">
        <li><svg width="12" height="12" aria-hidden="true"><MarkerShape type="sale" x={6} y={6} /></svg>Sale</li>
        <li><svg width="12" height="12" aria-hidden="true"><MarkerShape type="gift" x={6} y={6} /></svg>Gift or inheritance</li>
        <li><svg width="16" height="14" aria-hidden="true"><MarkerShape type="seizure" x={8} y={7} /></svg>Seizure</li>
        <li><svg width="12" height="12" aria-hidden="true"><MarkerShape type="custody" x={6} y={6} /></svg>Recovered into custody</li>
        <li><svg width="16" height="14" aria-hidden="true"><MarkerShape type="restitution" x={8} y={7} /></svg>Restitution</li>
        <li><svg width="22" height="12" aria-hidden="true"><rect className="j-bar-own" x="1" y="3" width="20" height="6" /></svg>Owned</li>
        {legendSources.map((s) => (
          <li key={s}><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" style={{ fill: `var(${SOURCES[s].cssVar})` }} /></svg>{SOURCES[s].kind === 'lead' ? `${SOURCES[s].short} lead` : SOURCES[s].short}</li>
        ))}
        <li><svg width="22" height="12" aria-hidden="true"><rect className="j-bar-custody" x="1" y="3" width="20" height="6" rx="1" /></svg>Custody, not ownership</li>
        <li><svg width="22" height="12" aria-hidden="true"><rect x="1" y="3" width="20" height="6" fill={`url(#${gid}-in-cleveland)`} /></svg>Faded edge: date approximate</li>
        {bandX && <li><svg width="22" height="12" aria-hidden="true"><path className="j-bracket" d="M1 8V3H21V8" /></svg>Focus period</li>}
        <li><svg width="22" height="12" aria-hidden="true"><rect className="j-gap-fill" x="1" y="1" width="20" height="10" /><line className="j-gap-edge" x1="1" x2="1" y1="1" y2="11" /><line className="j-gap-edge" x1="21" x2="21" y1="1" y2="11" /></svg>Gap: no recorded holder</li>
        <li><svg width="22" height="12" aria-hidden="true"><line className="j-bar-unknown" x1="1" y1="6" x2="21" y2="6" /></svg>Owner and place unknown</li>
      </ul>

      {legendSources.length > 0 && <p className="j-legend-note">Colour shows where the evidence comes from.</p>}
      {layout.undatedLeads.length > 0 && (
        <p className="j-legend-note">{layout.undatedLeads.length} {SOURCES[layout.undatedLeads[0].source].short} {layout.undatedLeads.length === 1 ? 'lead' : 'leads'} with no date: not drawn</p>
      )}

      <div className="j-sr">
        <p>Journey of {journey.title}. Segments:</p>
        <ul>{journey.segments.map((s) => <li key={s.id}>{segDesc(s)}</li>)}</ul>
        {(gaps ?? []).length > 0 && (
          <>
            <p>Gaps:</p>
            <ul>{(gaps ?? []).map((g) => <li key={g.id}>{g.start != null && g.end != null ? gapLabel(g) : `${g.kind === 'hidden_holder' ? 'Holder not named' : 'Gap'}, dates not given`}{g.start != null && g.end != null ? `. ${gapTip(g)[0]}` : ''}</li>)}</ul>
          </>
        )}
        {(leads ?? []).length > 0 && (
          <>
            <p>External leads, not part of the chain:</p>
            <ul>{(leads ?? []).map((l) => <li key={l.id}>{l.start != null ? `${SOURCES[l.source].short} lead, ${l.start}${l.end != null && l.end !== l.start ? ` to ${l.end}` : ''}` : `${SOURCES[l.source].short} lead, undated`}: {l.title}</li>)}</ul>
          </>
        )}
        {layout.markers.length > 0 && (
          <>
            <p>Handovers:</p>
            <ul>{layout.markers.map((m) => <li key={m.key}>{m.ev.label}: {TYPE_NAME[m.ev.type]}, {m.ev.year}, {m.fromSeg.owner} to {m.toSeg.owner}</li>)}</ul>
          </>
        )}
      </div>

      {selLead && (
        <Inspector heading={selLead.lead.title} detail={selLead.lead.preview} claims={claimMap} sources={sourceMap}>
          <p className="j-insp-d">Source: {SOURCES[selLead.lead.source].label} (external, cached)</p>
          <p className="j-insp-d">Retrieved {selLead.lead.retrievedAt.slice(0, 10)}</p>
          {selLead.lead.url && <p className="j-insp-d"><a href={selLead.lead.url} target="_blank" rel="noreferrer">Open in the Getty index</a></p>}
        </Inspector>
      )}
      {selGap && <Inspector heading={selGap.label} detail={gapTip(selGap.gap)[0]} claims={claimMap} sources={sourceMap}><GapActions key={gapKey(selGap.gap)} /></Inspector>}
      {selSeg && (
        <Inspector heading={selSeg.owner} detail={`${placeName(selSeg.place)}, ${span(selSeg)}${selSeg.note ? `. ${selSeg.note}` : ''}`} claimIds={selSeg.claimIds} claims={claimMap} sources={sourceMap} />
      )}
      {selMarker && (
        <Inspector heading={`${TYPE_NAME[selMarker.ev.type]}, ${selMarker.ev.year}`} detail={`${selMarker.fromSeg.owner} to ${selMarker.toSeg.owner}`} claimIds={selMarker.ev.claimIds} claims={claimMap} sources={sourceMap} />
      )}
    </div>
  )
}
