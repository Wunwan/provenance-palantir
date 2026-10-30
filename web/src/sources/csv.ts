/** Small CSV parser: quoted fields, doubled quotes, commas and newlines inside quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let touched = false // something was read on this row, so an empty trailing line is not a row
  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
    touched = false
  }
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += c
      continue
    }
    if (c === '"' && field === '') {
      quoted = true
      touched = true
    } else if (c === ',') {
      endField()
      touched = true
    } else if (c === '\r') {
      if (src[i + 1] === '\n') i++
      endRow()
    } else if (c === '\n') {
      endRow()
    } else {
      field += c
      touched = true
    }
  }
  if (touched || field !== '' || row.length > 0) endRow()
  return rows
}
