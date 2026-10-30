import { useId, useRef } from 'react'
import { parseCsv } from '../../../sources/csv'
import type { SourceType } from '../../../sources/types'
import { ACCESSION_RE, EXAMPLES, countPdfPages, sizeLabel, type Provided } from './info'

interface Props {
  type: SourceType
  value: Provided
  onChange: (p: Provided) => void
  loading: boolean
  onFetch: () => void
}

const LOCAL = 'Read locally in your browser. Nothing is uploaded.'

export default function ProvideStep({ type, value, onChange, loading, onFetch }: Props) {
  const id = useId()
  const readId = useRef(0)
  const acc = value.accession.trim()
  const invalid = acc !== '' && !ACCESSION_RE.test(acc)

  const onFile = (file: File | undefined) => {
    if (!file) return
    const mine = ++readId.current
    const base = { name: file.name, size: file.size, type: file.type || 'unknown' }
    onChange({ ...value, file: base, csv: null })
    const reader = new FileReader()
    reader.onload = () => {
      if (mine !== readId.current) return
      if (type === 'csv') onChange({ ...value, file: base, csv: parseCsv(String(reader.result ?? '')) })
      else if (type === 'pdf') onChange({ ...value, file: { ...base, pages: countPdfPages(reader.result as ArrayBuffer) } })
    }
    if (type === 'csv') reader.readAsText(file)
    else if (type === 'pdf') reader.readAsArrayBuffer(file)
  }

  if (type === 'api') {
    return (
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!invalid && acc && !loading) onFetch()
          }}
        >
          <div className="fl-field">
            <label htmlFor={`${id}-acc`}>Accession number</label>
            <input
              id={`${id}-acc`}
              type="text"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="1965.233"
              value={value.accession}
              aria-invalid={invalid}
              aria-describedby={`${id}-err`}
              onChange={(e) => onChange({ ...value, accession: e.target.value })}
            />
          </div>
          <p id={`${id}-err`} className="fl-err" role="alert">
            {invalid ? 'Use the form 1965.233: four digits, a dot, then up to five digits and an optional letter.' : ''}
          </p>
          <ul className="fl-chips" aria-label="Example accession numbers">
            {EXAMPLES.map((x) => (
              <li key={x}>
                <button type="button" className="fl-chip" onClick={() => onChange({ ...value, accession: x })}>
                  {x}
                </button>
              </li>
            ))}
          </ul>
          <button type="submit" className="fl-btn primary" disabled={!acc || invalid || loading}>
            {loading ? 'Fetching' : 'Fetch preview'}
          </button>
        </form>
        <p className="fl-local" role="status" aria-live="polite">
          {loading ? 'Fetching the record and reading its provenance...' : 'Looks the record up live; it is not saved anywhere.'}
        </p>
      </div>
    )
  }

  if (type === 'text') {
    return (
      <div>
        <div className="fl-field" style={{ maxWidth: '44rem' }}>
          <label htmlFor={`${id}-t`}>Provenance text</label>
          <textarea id={`${id}-t`} value={value.text} onChange={(e) => onChange({ ...value, text: e.target.value })} />
        </div>
        <p className="fl-local">{LOCAL}</p>
      </div>
    )
  }

  const accept = type === 'csv' ? '.csv,text/csv' : type === 'pdf' ? '.pdf,application/pdf' : 'image/*,.pdf'
  const label = type === 'csv' ? 'CSV file' : type === 'pdf' ? 'PDF file' : 'Scanned ledger (image or PDF)'
  const f = value.file
  return (
    <div>
      <div className="fl-field">
        <label htmlFor={`${id}-f`}>{label}</label>
        <input id={`${id}-f`} type="file" accept={accept} onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <p className="fl-local">{LOCAL}</p>
      {f && (
        <div role="status" aria-live="polite" style={{ marginTop: 16 }}>
          <dl className="fl-dl">
            <dt>Name</dt>
            <dd>{f.name}</dd>
            <dt>Size</dt>
            <dd>{sizeLabel(f.size)}</dd>
            <dt>Type</dt>
            <dd>{f.type}</dd>
            {type === 'pdf' && (
              <>
                <dt>Pages</dt>
                <dd>{f.pages === undefined ? 'counting...' : `about ${f.pages} (approximate, counted from the file's page markers)`}</dd>
              </>
            )}
          </dl>
          {type === 'csv' && value.csv && <CsvTable rows={value.csv} />}
        </div>
      )}
    </div>
  )
}

function CsvTable({ rows }: { rows: string[][] }) {
  if (rows.length === 0) return <p className="fl-msg">The file is empty.</p>
  const [head, ...body] = rows
  const shown = body.slice(0, 8)
  return (
    <>
      <div className="fl-table-wrap" tabIndex={0} role="region" aria-label="First rows of the file">
        <table className="fl-table">
          <thead>
            <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fl-local">Showing {shown.length} of {body.length} rows.</p>
    </>
  )
}
