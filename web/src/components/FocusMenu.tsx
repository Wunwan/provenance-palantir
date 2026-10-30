import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '@blueprintjs/core'
import { NAZI_ERA, focusLabel, isValidFocus, sameFocus, type FocusPeriod } from '../focus'

interface Props {
  value: FocusPeriod | null
  onChange: (f: FocusPeriod | null) => void
}

type Key = 'all' | 'preset' | 'custom'

const REASON =
  'The Nazi era: the years museums prioritize when checking provenance for looted art. It is a lens, not a rule: gaps at any date are always found and listed.'

const keyOf = (v: FocusPeriod | null): Key => (!v ? 'all' : sameFocus(v, NAZI_ERA) ? 'preset' : 'custom')

/** The Focus period dropdown: all periods by default, the Nazi-era preset, or a custom range. */
export default function FocusMenu({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState(keyOf(value) === 'custom')
  const [start, setStart] = useState(String(value?.start ?? 1900))
  const [end, setEnd] = useState(String(value?.end ?? 1950))
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const options = useRef<(HTMLLIElement | null)[]>([])
  const current = keyOf(value)
  const order: Key[] = ['all', 'preset', 'custom']

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    options.current[order.indexOf(current)]?.focus()
    return () => document.removeEventListener('mousedown', away)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const parsed = { start: Number(start), end: Number(end) }
  const valid = isValidFocus(parsed)
  const error = valid ? null : 'Enter whole years, 1000 to 2100, with the start before the end.'

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }
  const choose = (k: Key) => {
    if (k === 'custom') {
      setCustom(true)
      return
    }
    setCustom(false)
    onChange(k === 'all' ? null : NAZI_ERA)
    close()
  }
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const i = options.current.findIndex((el) => el === document.activeElement)
    if (e.key === 'ArrowDown') options.current[(i + 1) % order.length]?.focus()
    else if (e.key === 'ArrowUp') options.current[(i + order.length - 1) % order.length]?.focus()
    else if (e.key === 'Home') options.current[0]?.focus()
    else if (e.key === 'End') options.current[order.length - 1]?.focus()
    else if (e.key === 'Enter' || e.key === ' ') choose(order[Math.max(0, i)])
    else if (e.key === 'Escape') close()
    else return
    e.preventDefault()
  }
  const apply = () => {
    if (!valid) return
    onChange(parsed)
    close()
  }
  const onFormKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      close()
      e.preventDefault()
    } else if (e.key === 'Enter') {
      apply()
      e.preventDefault()
    }
  }

  const labels: Record<Key, string> = { all: 'All periods', preset: NAZI_ERA.start + ' to ' + NAZI_ERA.end, custom: 'Custom range…' }

  return (
    <div className="focus" ref={root}>
      <button
        ref={button}
        type="button"
        className="focus-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Focus period, currently ${focusLabel(value)}`}
        onClick={() => setOpen((o) => !o)}
      >
        Focus: {focusLabel(value)}
        <Icon icon="chevron-down" size={12} className={open ? 'sort-chev open' : 'sort-chev'} />
      </button>
      {open && (
        <div className="focus-pop">
          <ul className="sort-list focus-list" role="listbox" aria-label="Focus period" onKeyDown={onListKey}>
            {order.map((k, i) => (
              <li
                key={k}
                ref={(el) => {
                  options.current[i] = el
                }}
                role="option"
                tabIndex={-1}
                aria-selected={k === current}
                className="sort-opt focus-opt"
                onClick={() => choose(k)}
              >
                <span className="focus-opt-text">
                  <span>{labels[k]}</span>
                  {k === 'preset' && <span className="focus-reason">{REASON}</span>}
                </span>
                {k === current && <Icon icon="tick" size={12} className="sort-tick" />}
              </li>
            ))}
          </ul>
          {custom && (
            <div className="focus-custom" onKeyDown={onFormKey}>
              <label>
                <span>Start year</span>
                <input type="number" inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value)} aria-invalid={!valid} />
              </label>
              <label>
                <span>End year</span>
                <input type="number" inputMode="numeric" value={end} onChange={(e) => setEnd(e.target.value)} aria-invalid={!valid} />
              </label>
              {error && <p className="focus-error" role="alert">{error}</p>}
              <button type="button" className="focus-apply" disabled={!valid} onClick={apply}>Apply</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
