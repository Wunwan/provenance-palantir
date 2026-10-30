import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '@blueprintjs/core'
import type { EvidenceModel } from '../generated/contract'
import type { Derived } from '../types'
import { artworkFacts, recordStatus } from '../artworkFacts'
import { focusLabel, type FocusPeriod } from '../focus'

interface Props {
  model: EvidenceModel
  derived: Derived
  focus: FocusPeriod | null
  onSelect: (id: string) => void
}

type SortKey = 'holders-desc' | 'holders-asc' | 'date-desc' | 'date-asc'

// Down arrow: biggest or newest first. Up arrow: smallest or oldest first.
const SORTS: { key: SortKey; label: string; icon: 'arrow-down' | 'arrow-up' }[] = [
  { key: 'holders-desc', label: 'Holders: most first', icon: 'arrow-down' },
  { key: 'holders-asc', label: 'Holders: fewest first', icon: 'arrow-up' },
  { key: 'date-desc', label: 'Date made: newest first', icon: 'arrow-down' },
  { key: 'date-asc', label: 'Date made: oldest first', icon: 'arrow-up' },
]

const madeYear = (created: string): number | null => {
  const m = /\b\d{4}\b/.exec(created)
  return m ? Number(m[0]) : null
}

/** The Sort dropdown: a button with a chevron that opens a list of four options, each with an up or down arrow. */
function SortMenu({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const options = useRef<(HTMLLIElement | null)[]>([])
  const current = SORTS.find((o) => o.key === value)!

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    options.current[SORTS.findIndex((o) => o.key === value)]?.focus()
    return () => document.removeEventListener('mousedown', away)
  }, [open, value])

  const choose = (k: SortKey) => {
    onChange(k)
    setOpen(false)
    button.current?.focus()
  }
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const i = options.current.findIndex((el) => el === document.activeElement)
    if (e.key === 'ArrowDown') options.current[(i + 1) % SORTS.length]?.focus()
    else if (e.key === 'ArrowUp') options.current[(i + SORTS.length - 1) % SORTS.length]?.focus()
    else if (e.key === 'Home') options.current[0]?.focus()
    else if (e.key === 'End') options.current[SORTS.length - 1]?.focus()
    else if (e.key === 'Enter' || e.key === ' ') choose(SORTS[Math.max(0, i)].key)
    else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
      button.current?.focus()
    } else return
    e.preventDefault()
  }

  return (
    <div className="sort" ref={root}>
      <button
        ref={button}
        type="button"
        className="sort-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sort, currently ${current.label}`}
        onClick={() => setOpen((o) => !o)}
      >
        Sort
        <Icon icon="chevron-down" size={12} className={open ? 'sort-chev open' : 'sort-chev'} />
      </button>
      {open && (
        <ul className="sort-list" role="listbox" aria-label="Sort the collection" onKeyDown={onListKey}>
          {SORTS.map((o, i) => (
            <li
              key={o.key}
              ref={(el) => {
                options.current[i] = el
              }}
              role="option"
              tabIndex={-1}
              aria-selected={o.key === value}
              className="sort-opt"
              onClick={() => choose(o.key)}
            >
              <Icon icon={o.icon} size={12} />
              <span>{o.label}</span>
              {o.key === value && <Icon icon="tick" size={12} className="sort-tick" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function CollectionView({ model, derived, focus, onSelect }: Props) {
  const [sort, setSort] = useState<SortKey>('holders-desc')
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const stateById = useMemo(() => new Map(derived.artworks.map((s) => [s.artwork, s])), [derived])
  const items = useMemo(() => {
    const rows = model.artworks.map((a) => ({ a, facts: artworkFacts(model, a.id), year: madeYear(a.created) }))
    const dir = sort.endsWith('desc') ? -1 : 1
    return rows.sort((x, y) => {
      if (sort.startsWith('holders')) return dir * (x.facts.holders - y.facts.holders) || x.a.title.localeCompare(y.a.title)
      // undated works go last whichever way the date sort runs
      if (x.year === null || y.year === null) return (x.year === null ? 1 : 0) - (y.year === null ? 1 : 0) || x.a.title.localeCompare(y.a.title)
      return dir * (x.year - y.year) || x.a.title.localeCompare(y.a.title)
    })
  }, [model, sort])
  return (
    <main className="view">
      <section className="row">
        <div className="row-label" aria-hidden="true" />
        <div className="row-body">
          <h1 className="view-title">Collection</h1>
          <p className="lede">
            {focus
              ? `A gap is a question, not a verdict. Each card shows how many holders the record names, when it starts, and whether ${focusLabel(focus)} is recorded. The bar shows how much of the history is confirmed, approximate or unknown.`
              : 'Each card shows how many holders the record names, when it starts, and how many gaps it has. A gap is a question, not a verdict. The bar shows how much of the history is confirmed, approximate or unknown.'}
          </p>
          <SortMenu value={sort} onChange={setSort} />
        </div>
      </section>
      <ol className="art-grid">
        {items.map(({ a, facts }) => {
          const s = stateById.get(a.id)
          if (!s) return null
          return (
            <li key={a.id}>
              <button className="art-card" onClick={() => onSelect(a.id)}>
                <img
                  className="art-img"
                  src={a.image}
                  alt={`${a.title}, ${a.artist}`}
                  loading="lazy"
                />
                <span className="art-cap">
                  <span className="art-title">{a.title}</span>
                  <span className="art-meta">
                    {a.artist}, {a.created}
                  </span>
                  <span className="art-acc">{a.accession}</span>
                </span>
                <span className="art-num">
                  <span className="num" title="Distinct owners, dealers and institutions named in the recorded history">
                    {facts.holders}
                  </span>
                  <span className="num-label">holders on record</span>
                  <span className="art-facts">
                    <span>Earliest record: {facts.firstYear ?? 'undated'}</span>
                    <span>
                      {(() => {
                        const r = recordStatus(s.riskYears, s.gaps.length, focus)
                        return `${r.label}: ${focus ? r.status : s.gaps.length}`
                      })()}
                    </span>
                  </span>
                  <span
                    className="shares"
                    role="img"
                    aria-label={`Certainty: ${pct(s.shares.confirmed)} confirmed, ${pct(s.shares.approximate)} approximate, ${pct(s.shares.unknown)} unknown`}
                  >
                    <span className="sh sh-confirmed" style={{ flexGrow: s.shares.confirmed }} />
                    <span className="sh sh-approx" style={{ flexGrow: s.shares.approximate }} />
                    <span className="sh sh-unknown" style={{ flexGrow: s.shares.unknown }} />
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <ul className="legend" aria-label="Certainty legend">
        <li>
          <span className="sh-key sh-confirmed" /> Confirmed
        </li>
        <li>
          <span className="sh-key sh-approx" /> Approximate
        </li>
        <li>
          <span className="sh-key sh-unknown" /> Unknown
        </li>
      </ul>
    </main>
  )
}
