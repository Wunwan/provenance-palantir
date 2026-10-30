import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { geoNaturalEarth1, geoPath, interpolateViridis } from 'd3'
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
import landTopo from 'world-atlas/land-110m.json'
import type { Journey } from '../../../journey/types'
import type { Move, Place, Route, Stay, UnplacedPeriod } from '../../../journey/routeTypes'
import { TYPE_NAME } from '../typeNames'
import { textWidth } from '../layout'
import { placeLabels } from './labels'
import { RANGE_DARK, RANGE_LIGHT, inkFor, moveColor } from './colors'
import { IDENTITY, chooseAnchor, clampXf, composeProjection, zoomAt, zoomCentred } from './transform'
import type { Xf } from './transform'
import { arcGeometry, moveBends, stateAtYear, yearSpan, yearsText } from './geometry'
import './map.css'

export interface MapViewProps {
  journey: Journey
  route: Route
  places: Place[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Selection id for an unplaced period (a gap key when it is a gap, else its first segment). */
  unplacedKey: (u: UnplacedPeriod) => string
  hasFocus: boolean
}

interface Tip { left: number; top: number; title: string; lines: string[] }
type SeqItem = { key: string; kind: 'stay'; stay: Stay } | { key: string; kind: 'move'; move: Move }

const land = feature(landTopo as unknown as Topology, (landTopo as unknown as Topology).objects.land)
const PAD = 48
const MAX_SCALE = 1800
const PIN_R = 6
const BADGE_R = 10

type Zoom = 'all' | 'europe' | 'americas'
const REGIONS: { id: Exclude<Zoom, 'all'>; label: string; has: (p: Place) => boolean }[] = [
  { id: 'europe', label: 'Europe', has: (p) => p.lon >= -25 && p.lon <= 45 && p.lat >= 34 && p.lat <= 72 },
  { id: 'americas', label: 'Americas', has: (p) => p.lon >= -170 && p.lon <= -30 },
]

const stayYears = (s: Stay) => (s.start === s.end ? `${s.start}` : `${s.start} to ${s.end}`)
const unplacedText = (u: UnplacedPeriod) =>
  `No known place: ${yearsText(u.start, u.end)}${u.owner ? `, ${u.owner}` : ''}${u.reason === 'unresolved_place' ? ' (place could not be located)' : ''}`

export default function MapView({ journey, route, places, selectedId, onSelect, unplacedKey, hasFocus }: MapViewProps) {
  const gid = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, SVGGElement>())
  const [boxWidth, setBoxWidth] = useState(640)
  const [tip, setTip] = useState<Tip | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [zoomPick, setZoomPick] = useState<Zoom>('all')
  const [view, setView] = useState<Xf>(IDENTITY)
  const [switching, setSwitching] = useState(false)
  const [dark, setDark] = useState(() => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) ?? true)
  const svgRef = useRef<SVGSVGElement>(null)
  const want = useRef<Xf>(IDENTITY)
  const frame = useRef(0)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ t0: Xf; x0: number; y0: number; d0: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const basePts = useRef<{ x: number; y: number }[]>([])
  const size = useRef({ W: 640, H: 360 })
  const selectedBase = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const f = () => setDark(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const hasMap = route.stays.length > 0
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth || 640))
    ro.observe(el)
    setBoxWidth(el.clientWidth || 640)
    return () => ro.disconnect()
  }, [hasMap])

  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  const stayById = useMemo(() => new Map(route.stays.map((s) => [s.id, s])), [route.stays])
  const placeName = (placeId: string) => placeById.get(placeId)?.label ?? placeId

  const W = Math.max(300, Math.floor(boxWidth))
  const H = Math.round(Math.min(520, Math.max(260, W * 0.5625)))

  const routePlaces = useMemo(() => route.placeIds.map((id) => placeById.get(id)).filter((p): p is Place => !!p), [route.placeIds, placeById])
  const zoomOptions = useMemo(() => REGIONS.filter((r) => routePlaces.filter(r.has).length >= 2), [routePlaces])
  const region = useMemo(() => zoomOptions.find((r) => r.id === zoomPick), [zoomOptions, zoomPick])
  const zoom: Zoom = region ? region.id : 'all'

  const baseProj = useMemo(() => {
    const pts = (region ? routePlaces.filter(region.has) : routePlaces).map((p) => [p.lon, p.lat] as [number, number])
    const p = geoNaturalEarth1()
    if (!pts.length) return p.fitSize([W, H], land)
    if (pts.length > 1) {
      p.fitExtent([[PAD, PAD], [W - PAD, H - PAD]], { type: 'MultiPoint', coordinates: pts })
      if (Number.isFinite(p.scale()) && p.scale() <= MAX_SCALE) return p
    }
    // One place, or places so close that fitting would zoom past city level: centre on them at a fixed zoom.
    const lon = pts.reduce((a, q) => a + q[0], 0) / pts.length
    const lat = pts.reduce((a, q) => a + q[1], 0) / pts.length
    return geoNaturalEarth1().rotate([-lon, 0]).center([0, lat]).scale(pts.length > 1 ? MAX_SCALE : 900).translate([W / 2, H / 2])
  }, [routePlaces, region, W, H])

  const basePts_ = useMemo(() => routePlaces.map((pl) => { const r = baseProj([pl.lon, pl.lat]); return { x: r?.[0] ?? 0, y: r?.[1] ?? 0 } }), [routePlaces, baseProj])
  const xfNow = useMemo(() => clampXf(view, basePts_, W, H), [view, basePts_, W, H])
  const proj = useMemo(() => composeProjection(baseProj, xfNow), [baseProj, xfNow])
  const landPath = useMemo(() => geoPath(proj)(land) ?? '', [proj])
  const xy = useCallback((placeId: string) => {
    const p = placeById.get(placeId)
    const r = p ? proj([p.lon, p.lat]) : null
    return r ? { x: r[0], y: r[1] } : { x: -100, y: -100 }
  }, [placeById, proj])

  const pins = useMemo(() => route.placeIds.map((id) => {
    const stays = route.stays.filter((s) => s.placeId === id)
    return { id, place: placeById.get(id), stays, ...xy(id) }
  }).filter((p) => p.place), [route, placeById, xy])

  const bends = useMemo(() => moveBends(route.moves, (sid) => stayById.get(sid)?.placeId ?? sid), [route.moves, stayById])
  const arcs = useMemo(() => route.moves.map((m, i) => {
    const a = stayById.get(m.from)
    const b = stayById.get(m.to)
    if (!a || !b) return null
    const g = arcGeometry(xy(a.placeId), xy(b.placeId), bends.get(m.id) ?? 0.16, PIN_R + 3)
    const color = moveColor(i, route.moves.length, dark ? RANGE_DARK : RANGE_LIGHT)
    return { m, a, b, color, ink: inkFor(color), ...g }
  }).filter((x): x is NonNullable<typeof x> => !!x), [route.moves, stayById, xy, bends, dark])

  const labels = useMemo(() => {
    const visible = pins.filter((p) => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H)
    const steps = arcs.map((a) => ({ x: a.mid.x - BADGE_R - 2, y: a.mid.y - BADGE_R - 2, w: 2 * BADGE_R + 4, h: 2 * BADGE_R + 4 }))
    return new Map(placeLabels(visible.map((p) => ({ id: p.id, x: p.x, y: p.y, w: Math.ceil(textWidth(p.place!.label, 11, 300)) + 4 })), steps, { w: W, h: H }, PIN_R).map((l) => [l.id, l]))
  }, [pins, arcs, W, H])
  const onScreen = (id: string) => { const q = xy(id); return q.x >= 0 && q.x <= W && q.y >= 0 && q.y <= H }
  const leaving = route.moves.filter((m) => !(onScreen(stayById.get(m.from)?.placeId ?? '') && onScreen(stayById.get(m.to)?.placeId ?? ''))).length

  // Zoom and pan. Gestures write the wanted transform; one state update per animation frame follows.
  const selectedPt = useMemo(() => {
    const st = selectedId ? route.stays.find((s) => s.segmentIds.includes(selectedId)) : undefined
    const i = st ? routePlaces.findIndex((pl) => pl.id === st.placeId) : -1
    return i >= 0 ? basePts_[i] : null
  }, [selectedId, route.stays, routePlaces, basePts_])
  useEffect(() => { basePts.current = basePts_; size.current = { W, H }; selectedBase.current = selectedPt }, [basePts_, W, H, selectedPt])
  const schedule = (next: Xf) => {
    want.current = clampXf(next, basePts.current, size.current.W, size.current.H)
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; setView(want.current) })
  }
  const centre = () => ({ x: size.current.W / 2, y: size.current.H / 2 })
  const zoomBy = (factor: number, at?: { x: number; y: number }) => {
    if (at) { schedule(zoomAt(want.current, at.x, at.y, factor)); return }
    const { W: w, H: h } = size.current
    const a = chooseAnchor(basePts.current, want.current, w, h, selectedBase.current)
    if (a) schedule(zoomCentred(want.current, a, w, h, factor))
    else { const c = centre(); schedule(zoomAt(want.current, c.x, c.y, factor)) }
  }
  const resetView = () => schedule(IDENTITY)
  const local = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect()
    return r ? { x: ((e.clientX - r.left) / r.width) * size.current.W, y: ((e.clientY - r.top) / r.height) * size.current.H } : centre()
  }
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return // plain scrolling belongs to the page
      e.preventDefault()
      zoomBy(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0125)), local(e))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    pointers.current.set(e.pointerId, local(e))
    const pts = [...pointers.current.values()]
    gesture.current = { t0: want.current, x0: pts[0].x, y0: pts[0].y, d0: pts.length > 1 ? Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : 0, moved: false }
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || !pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, local(e))
    const pts = [...pointers.current.values()]
    if (pts.length > 1 && g.d0 > 0) {
      const mx = (pts[0].x + pts[1].x) / 2
      const my = (pts[0].y + pts[1].y) / 2
      const z = zoomAt(g.t0, g.x0, g.y0, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) / g.d0)
      g.moved = true
      schedule({ ...z, tx: z.tx + (mx - g.x0), ty: z.ty + (my - g.y0) })
    } else if (pts.length === 1) {
      const dx = pts[0].x - g.x0
      const dy = pts[0].y - g.y0
      if (!g.moved && Math.hypot(dx, dy) > 4) {
        g.moved = true
        try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* capture is a nicety */ }
      }
      if (g.moved) schedule({ ...g.t0, tx: g.t0.tx + dx, ty: g.t0.ty + dy })
    }
  }
  const onUp = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId)
    if (gesture.current?.moved) { dragged.current = true; setTimeout(() => { dragged.current = false }, 0) }
    if (pointers.current.size === 0) gesture.current = null
    else { const pts = [...pointers.current.values()]; gesture.current = { t0: want.current, x0: pts[0].x, y0: pts[0].y, d0: 0, moved: true } }
  }
  const pickZoom = (id: Zoom) => {
    setZoomPick(id)
    cancelAnimationFrame(frame.current)
    frame.current = 0
    want.current = IDENTITY
    setView(IDENTITY)
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setSwitching(true)
      setTimeout(() => setSwitching(false), 220)
    }
  }
  const kText = xfNow.k < 1.05 ? 'Zoom 1 time' : `Zoom ${Math.round(xfNow.k * 10) / 10} times`

  const seq: SeqItem[] = useMemo(() => route.stays.flatMap((s) => [
    { key: `pin:${s.placeId}`, kind: 'stay' as const, stay: s },
    ...route.moves.filter((m) => m.from === s.id).map((m) => ({ key: `move:${m.id}`, kind: 'move' as const, move: m })),
  ]), [route.stays, route.moves])
  const activeKey = seq[Math.min(activeIdx, seq.length - 1)]?.key

  const span = useMemo(() => yearSpan(route.stays, route.unplaced), [route])
  const yr = span ? Math.min(span[1], Math.max(span[0], year ?? span[0])) : null
  const yState = yr != null ? stateAtYear(route.stays, yr) : null

  const showTip = (e: { clientX: number; clientY: number }, title: string, lines: string[]) => {
    const r = rootRef.current?.getBoundingClientRect()
    if (r) setTip({ left: Math.min(e.clientX - r.left + 12, Math.max(0, r.width - 250)), top: e.clientY - r.top + 12, title, lines })
  }
  const showTipAt = (el: Element, title: string, lines: string[]) => {
    const b = el.getBoundingClientRect()
    showTip({ clientX: b.left + b.width / 2, clientY: b.bottom }, title, lines)
  }

  const moveLabel = (m: Move) => {
    const a = stayById.get(m.from)
    const b = stayById.get(m.to)
    const head = `${a ? placeName(a.placeId) : '?'} to ${b ? placeName(b.placeId) : '?'}`
    const how = m.linkType === 'known' ? (m.handoverType ? TYPE_NAME[m.handoverType].toLowerCase() : 'handover recorded') : 'link unknown'
    return `${head}${m.year != null ? `, ${m.year}` : ''}, ${how}`
  }
  const pinTip = (id: string): [string, string[]] => {
    const pin = pins.find((p) => p.id === id)!
    const pl = pin.place!
    const lines = pin.stays.map((s) => `${s.owners.length ? s.owners.join(', ') : 'Owner not named'}, ${stayYears(s)}`)
    lines.push(`Place read from: "${pl.label}"`)
    if (pl.precision !== 'city') lines.push(`Approximate location (${pl.precision} only)`)
    if (pl.note) lines.push(pl.note)
    return [pl.label, lines]
  }

  const pinTarget = (placeId: string) => {
    const cur = seq[activeIdx]
    const s = cur?.kind === 'stay' && cur.stay.placeId === placeId ? cur.stay : route.stays.find((x) => x.placeId === placeId)
    return s?.segmentIds[0] ?? null
  }
  const moveTarget = (m: Move) => m.segmentIds[m.segmentIds.length - 1] ?? null

  const focusSeq = (i: number) => {
    setActiveIdx(i)
    refs.current.get(seq[i].key)?.focus()
  }
  const onKey = (e: KeyboardEvent<SVGGElement>, key: string, target: string | null) => {
    const cur = activeKey === key ? activeIdx : Math.max(0, seq.findIndex((s) => s.key === key))
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); focusSeq(Math.min(seq.length - 1, cur + 1)) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); focusSeq(Math.max(0, cur - 1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPicked(key); onSelect(target) }
    else if (e.key === 'Escape') { e.preventDefault(); setPicked(null); onSelect(null) }
  }
  const itemProps = (key: string, label: string, target: string | null, tipTitle: string, tipLines: string[]) => ({
    ref: (el: SVGGElement | null) => { if (el) refs.current.set(key, el); else refs.current.delete(key) },
    tabIndex: activeKey === key ? 0 : -1,
    role: 'button' as const,
    'aria-label': label,
    'aria-pressed': picked === key ? selectedId === target : false,
    onClick: () => { if (dragged.current) return; setActiveIdx(Math.max(0, seq.findIndex((s) => s.key === key))); setPicked(key); onSelect(target) },
    onKeyDown: (e: KeyboardEvent<SVGGElement>) => onKey(e, key, target),
    onMouseMove: (e: MouseEvent) => showTip(e, tipTitle, tipLines),
    onMouseLeave: () => setTip(null),
    onFocus: (e: React.FocusEvent<SVGGElement>) => {
      if (activeKey !== key) setActiveIdx(Math.max(0, seq.findIndex((s) => s.key === key)))
      showTipAt(e.currentTarget, tipTitle, tipLines)
    },
    onBlur: () => setTip(null),
  })

  const unplacedList = route.unplaced.length > 0 && (
    <ul className="m-unplaced" aria-label="Periods with no known place">
      {route.unplaced.map((u) => {
        const k = unplacedKey(u)
        return (
          <li key={u.id}>
            <button type="button" className={`m-unplaced-btn${selectedId === k ? ' is-selected' : ''}`} aria-pressed={selectedId === k} onClick={() => onSelect(selectedId === k ? null : k)}>
              {unplacedText(u)}
            </button>
          </li>
        )
      })}
    </ul>
  )

  if (!hasMap) {
    return (
      <div className="m-root">
        <p className="j-empty">No locations recorded for this artwork.</p>
        {unplacedList}
      </div>
    )
  }

  const last = yState?.kind === 'unknown' ? yState.last : null
  const yearLine = yState == null || yr == null ? '' : yState.kind === 'at'
    ? `${yr}: ${placeName(yState.stay.placeId)}`
    : last ? `Last known: ${placeName(last.placeId)}, ${last.end}` : `${yr}: no place known yet`
  const markPin = yState?.kind === 'at' ? pins.find((p) => p.id === yState.stay.placeId) : last ? pins.find((p) => p.id === last.placeId) : undefined
  const selectedPinId = (p: (typeof pins)[number]) => p.stays.some((s) => selectedId != null && s.segmentIds.includes(selectedId))

  return (
    <div className="m-root" ref={rootRef}>
      <div className="m-layout">
        <div className="m-main" ref={boxRef}>
          <svg
            ref={svgRef}
            className="m-svg"
            role="group"
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            aria-label={`${journey.title}: map of where the work was`}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setPicked(null); onSelect(null) }
              else if (e.key === '+' || e.key === '=') zoomBy(1.6)
              else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.6)
              else if (e.key === '0') resetView()
            }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onDoubleClick={(e) => zoomBy(2, (e.target as Element).closest('.m-item') ? local(e) : undefined)}
          >
            <defs>
              {arcs.map(({ m, color }) => (
                <marker key={m.id} id={`${gid}-${m.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M1 1.5L9 5L1 8.5Z" style={{ fill: color }} />
                </marker>
              ))}
            </defs>
            <g className={`m-scene${switching ? ' is-switching' : ''}`}>
            <path className="m-land" d={landPath} />

            {arcs.map(({ m, d, mid, color, ink }) => {
              const key = `move:${m.id}`
              const target = moveTarget(m)
              const sel = picked === key && selectedId === target
              const focusMove = m.inFocus && hasFocus
              const title = `${m.order}. ${moveLabel(m)}`
              return (
                <g key={m.id} {...itemProps(key, title, target, title, [])} className={`m-item m-move${sel ? ' is-selected' : ''}`}>
                  <path className="m-hit" d={d} />
                  {sel && <path className="m-sel" d={d} />}
                  {focusMove && <path className="m-halo" d={d} />}
                  <path className={`m-arc${m.linkType === 'unknown' ? ' is-dashed' : ''}`} style={{ stroke: color }} d={d} markerEnd={`url(#${gid}-${m.id})`} />
                  {focusMove && <circle className="m-badge-focus" cx={mid.x} cy={mid.y} r={BADGE_R + 2.5} />}
                  <circle className="m-step-c" cx={mid.x} cy={mid.y} r={BADGE_R} style={{ fill: color }} />
                  <text className="m-step" x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="central" style={{ fill: ink }}>{m.order}</text>
                </g>
              )
            })}

            {pins.map((p) => {
              const key = `pin:${p.id}`
              const [tt, tl] = pinTip(p.id)
              const approx = p.place!.precision !== 'city'
              const sel = selectedPinId(p)
              return (
                <g key={p.id} {...itemProps(key, `${p.place!.label}${approx ? ', approximate location' : ''}, ${p.stays.length > 1 ? `${p.stays.length} stays` : stayYears(p.stays[0])}`, pinTarget(p.id), tt, tl)} className={`m-item m-pin${sel ? ' is-selected' : ''}`}>
                  <circle className="m-hit" cx={p.x} cy={p.y} r={14} />
                  <circle className="m-focus" cx={p.x} cy={p.y} r={PIN_R + 4} />
                  <circle className={approx ? 'm-dot is-approx' : 'm-dot'} cx={p.x} cy={p.y} r={PIN_R} />
                  {p.stays.length > 1 && (
                    <g pointerEvents="none">
                      <circle className="m-badge" cx={p.x + 8} cy={p.y - 8} r={6.5} />
                      <text className="m-badge-t" x={p.x + 8} y={p.y - 8} textAnchor="middle" dominantBaseline="central">{p.stays.length}</text>
                    </g>
                  )}
                  {labels.get(p.id) && (
                    <g pointerEvents="none">
                      {labels.get(p.id)!.leader && <line className="m-leader" {...labels.get(p.id)!.leader!} />}
                      <text className="m-city" x={labels.get(p.id)!.box.x + labels.get(p.id)!.box.w / 2} y={labels.get(p.id)!.box.y + labels.get(p.id)!.box.h / 2} textAnchor="middle" dominantBaseline="central">{p.place!.label}</text>
                    </g>
                  )}
                </g>
              )
            })}

            </g>

            {markPin && (
              <g pointerEvents="none" aria-hidden="true">
                {yState?.kind === 'at' ? (
                  <circle className="m-year-ring" cx={markPin.x} cy={markPin.y} r={PIN_R + 5} />
                ) : (
                  <>
                    <circle className="m-q-ring" cx={markPin.x + 16} cy={markPin.y + 16} r={9} />
                    <text className="m-q" x={markPin.x + 16} y={markPin.y + 16} textAnchor="middle" dominantBaseline="central">?</text>
                  </>
                )}
              </g>
            )}
          </svg>
          {tip && (
            <div className="j-tip" style={{ left: tip.left, top: tip.top }} role="presentation">
              <strong>{tip.title}</strong>
              {tip.lines.map((l, i) => <small key={i}>{l}</small>)}
            </div>
          )}
          <div className="m-zbtns">
            <button type="button" className="m-zbtn" aria-label="Zoom in" onClick={() => zoomBy(1.6)} disabled={xfNow.k >= 12}>+</button>
            <button type="button" className="m-zbtn" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.6)} disabled={xfNow.k <= 1}>{'\u2212'}</button>
            <button type="button" className="m-zbtn m-zbtn-reset" aria-label="Reset map view" onClick={resetView}>Reset</button>
          </div>
        </div>
      </div>
      <p className="m-hint">Ctrl or Cmd + scroll to zoom</p>
      {leaving > 0 && <p className="m-hint m-zoom-n">{leaving} {leaving === 1 ? 'move leaves' : 'moves leave'} this view</p>}
      <span className="j-sr" role="status" aria-live="polite" aria-atomic="true">{kText}</span>
      {zoomOptions.length > 0 && (
        <div className="m-zoom" role="radiogroup" aria-label="Zoom">
          <span className="m-zoom-l">Zoom:</span>
          {([{ id: 'all' as const, label: 'All places' }, ...zoomOptions]).map((o, i, arr) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={zoom === o.id}
              tabIndex={zoom === o.id ? 0 : -1}
              className={`jp-opt m-zoom-opt${zoom === o.id ? ' is-on' : ''}`}
              onClick={() => pickZoom(o.id)}
              onKeyDown={(e) => {
                const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
                if (!d) return
                e.preventDefault()
                const n = arr[(i + d + arr.length) % arr.length]
                pickZoom(n.id)
                ;(e.currentTarget.parentElement?.querySelectorAll('button')[(i + d + arr.length) % arr.length] as HTMLElement | undefined)?.focus()
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {unplacedList}

      {route.stays.length === 1 && route.moves.length === 0 && <p className="m-note">Only one place is recorded; there is no route to draw.</p>}

      {span && yr != null && (
        <div className="m-scrub">
          <label className="m-scrub-l" htmlFor={`${gid}-year`}>Year <output className="m-scrub-y">{yr}</output></label>
          <input id={`${gid}-year`} className="m-range" type="range" min={span[0]} max={span[1]} step={1} value={yr} onChange={(e) => setYear(Number(e.target.value))} />
          <p className="m-scrub-s" aria-live="polite">{yearLine}</p>
        </div>
      )}

      <ul className="m-legend" aria-label="Legend">
        <li><svg width="22" height="10" aria-hidden="true"><line className="m-lg" x1="1" x2="21" y1="5" y2="5" /></svg>Handover recorded</li>
        <li><svg width="22" height="10" aria-hidden="true"><line className="m-lg is-dashed" x1="1" x2="21" y1="5" y2="5" /></svg>Link unknown</li>
        <li><span className="m-ramp" style={{ background: `linear-gradient(90deg, ${[0, 1, 2, 3, 4].map((k) => interpolateViridis((dark ? RANGE_DARK : RANGE_LIGHT)[0] + ((dark ? RANGE_DARK : RANGE_LIGHT)[1] - (dark ? RANGE_DARK : RANGE_LIGHT)[0]) * (k / 4))).join(', ')})` }} aria-hidden="true" />Colour follows time: earliest to latest</li>
        {hasFocus && <li><svg width="22" height="10" aria-hidden="true"><line className="m-lg-focus" x1="1" x2="21" y1="5" y2="5" /></svg>Red ring: inside the focus period</li>}
        <li><svg width="12" height="12" aria-hidden="true"><circle className="m-dot is-approx" cx="6" cy="6" r="4.5" /></svg>Approximate location</li>
      </ul>
      <p className="m-foot">Modern basemap; borders changed during this period.</p>

      <div className="j-sr">
        <p>Map of {journey.title}. Route in time order:</p>
        <ol>
          {seq.map((s) => (
            <li key={s.key + (s.kind === 'stay' ? s.stay.id : '')}>
              {s.kind === 'stay'
                ? `${placeName(s.stay.placeId)}, ${stayYears(s.stay)}${s.stay.owners.length ? `, ${s.stay.owners.join(', ')}` : ''}`
                : `Move ${s.move.order}: ${moveLabel(s.move)}`}
            </li>
          ))}
        </ol>
        {route.unplaced.length > 0 && <ul>{route.unplaced.map((u) => <li key={u.id}>{unplacedText(u)}</li>)}</ul>}
      </div>
    </div>
  )
}
