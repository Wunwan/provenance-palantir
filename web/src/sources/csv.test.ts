import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('parses plain rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })
  it('handles CRLF and no trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('keeps commas inside quotes', () => {
    expect(parseCsv('"Knoedler, M. & Co.",1946')).toEqual([['Knoedler, M. & Co.', '1946']])
  })
  it('keeps newlines inside quotes', () => {
    expect(parseCsv('a,"line one\nline two",c\nx,y,z')).toEqual([['a', 'line one\nline two', 'c'], ['x', 'y', 'z']])
  })
  it('unescapes doubled quotes', () => {
    expect(parseCsv('"say ""hi""",b')).toEqual([['say "hi"', 'b']])
  })
  it('keeps empty fields', () => {
    expect(parseCsv('a,,c\n,,')).toEqual([['a', '', 'c'], ['', '', '']])
  })
  it('strips a BOM and returns nothing for empty input', () => {
    expect(parseCsv('﻿a,b')).toEqual([['a', 'b']])
    expect(parseCsv('')).toEqual([])
  })
  it('tolerates an unterminated quote', () => {
    expect(parseCsv('a,"b\nc')).toEqual([['a', 'b\nc']])
  })
})
