import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

const ACTIONS = [
  { label: 'See why this is a gap', hint: 'The source words on either side of the silence, each linked to its record.', will: 'Show the source words just before and just after this silence, each linked to the record it came from, so you can see what the record does and does not say.' },
  { label: 'Read suggestions', hint: 'Leads from the loaded data and the Getty Provenance Index, each labeled by origin.', will: 'List possible leads for this period from the data already loaded and from the Getty Provenance Index. Every lead will say where it came from.' },
  { label: 'Preview a suggested record', hint: 'A dashed ghost bar in the gap, with a preview on click.', will: 'Draw a dashed ghost bar inside the gap for a suggested record. Clicking it will preview the record without changing the journey.' },
  { label: 'Add evidence from a suggestion', hint: 'With a note; the gap shrinks.', will: 'Add a suggested record as evidence, with a note of your own. The gap will shrink to the years the evidence does not cover.' },
  { label: 'Confirm or reject a name match', hint: 'Matches related to the holders around this gap.', will: 'Show name matches for the holders on either side of this gap, so a person can confirm or reject each one.' },
  { label: 'Open leads in other archives', hint: 'Lost Art, Proveana and property cards as pre-filled search links.', will: 'Offer search links for Lost Art, Proveana and property cards, pre-filled with the artwork and the years of this gap.' },
  { label: 'See conflicts', hint: 'Where two sources disagree, shown and not resolved.', will: 'Show where two sources disagree about this period. The disagreement is shown side by side and is not resolved for you.' },
]

export default function GapActions() {
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<number | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const options = useRef<(HTMLLIElement | null)[]>([])
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    options.current[chosen ?? 0]?.focus()
    return () => document.removeEventListener('mousedown', away)
  }, [open, chosen])

  const choose = (i: number) => {
    setChosen(i)
    setOpen(false)
    button.current?.focus()
  }
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const n = ACTIONS.length
    const i = options.current.findIndex((el) => el === document.activeElement)
    if (e.key === 'ArrowDown') options.current[(i + 1) % n]?.focus()
    else if (e.key === 'ArrowUp') options.current[(i + n - 1) % n]?.focus()
    else if (e.key === 'Home') options.current[0]?.focus()
    else if (e.key === 'End') options.current[n - 1]?.focus()
    else if (e.key === 'Enter' || e.key === ' ') choose(Math.max(0, i))
    else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false)
      button.current?.focus()
    } else return
    e.preventDefault()
  }
  const action = chosen == null ? null : ACTIONS[chosen]

  return (
    <div className="j-actions" ref={root}>
      <div className="j-actions-row">
        <span className="j-actions-label">Actions</span>
        <div className="j-actions-menu">
          <button ref={button} type="button" className="j-actions-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => setOpen((o) => !o)}>
            <span className={action ? '' : 'j-actions-ph'}>{action ? action.label : 'Choose an action'}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={open ? 'j-actions-chev open' : 'j-actions-chev'}>
              <path d="M2 4.5L6 8.5L10 4.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          {open && (
            <ul id={listId} className="j-actions-list" role="listbox" aria-label="Actions for this gap" onKeyDown={onListKey}>
              {ACTIONS.map((a, i) => (
                <li key={a.label} ref={(el) => { options.current[i] = el }} role="option" tabIndex={-1} aria-selected={i === chosen} className="j-actions-opt" onClick={() => choose(i)}>
                  <span>{a.label}</span>
                  <small>{a.hint}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {action && (
        <div className="j-actions-panel">
          <h4>{action.label}</h4>
          <p>{action.will}</p>
          {chosen === 3 && (
            <div className="j-actions-sketch">
              <label>Note (optional)<input type="text" disabled placeholder="Note (optional)" /></label>
              <button type="button" disabled>Add evidence</button>
            </div>
          )}
          <p className="j-actions-note">Placeholder: not built yet.</p>
        </div>
      )}
    </div>
  )
}
