import type { PreviewResponse, SourceType } from '../../../sources/types'

export interface TypeInfo {
  id: SourceType
  name: string
  what: string
  live: boolean
}

export const TYPES: TypeInfo[] = [
  { id: 'api', name: 'API', what: 'Cleveland Museum of Art Open Access, looked up by accession number.', live: true },
  { id: 'csv', name: 'CSV', what: 'A dealer stock book exported as rows and columns.', live: false },
  { id: 'pdf', name: 'PDF', what: 'An auction catalog with provenance printed in the lot entries.', live: false },
  { id: 'text', name: 'Pasted text', what: 'Free-text provenance copied from a page or an email.', live: false },
  { id: 'scan', name: 'Scan', what: 'A photographed or scanned handwritten ledger.', live: false },
]

export const typeName = (t: SourceType) => TYPES.find((x) => x.id === t)?.name ?? t

export const ACCESSION_RE = /^\d{4}\.\d{1,5}[A-Za-z]?$/
export const EXAMPLES = ['1965.233', '1982.247', '1974.1']

/** Ask the dev endpoint for a preview. Anything but a JSON PreviewResponse reads as server_unavailable. */
export async function fetchPreview(accession: string, signal?: AbortSignal): Promise<PreviewResponse> {
  const unavailable: PreviewResponse = {
    ok: false,
    code: 'server_unavailable',
    message: 'The preview service is not reachable.',
  }
  try {
    const res = await fetch(`/api/preview?accession=${encodeURIComponent(accession)}`, { signal })
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'ok' in body) return body as PreviewResponse
    return unavailable
  } catch (err) {
    if (signal?.aborted) throw err
    return unavailable
  }
}

export interface FileInfo {
  name: string
  size: number
  type: string
  pages?: number // PDF only, approximate
}

export interface Provided {
  accession: string
  file: FileInfo | null
  csv: string[][] | null
  text: string
}

export const EMPTY: Provided = { accession: '', file: null, csv: null, text: '' }

export const sizeLabel = (n: number) => (n < 1024 ? `${n} bytes` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)

/** Best-effort PDF page count: occurrences of "/Type /Page" not followed by "s". Approximate by nature. */
export function countPdfPages(bytes: ArrayBuffer): number {
  const s = new TextDecoder('latin1').decode(bytes)
  return (s.match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length
}

export function canContinue(type: SourceType, p: Provided): boolean {
  if (type === 'api') return ACCESSION_RE.test(p.accession.trim())
  if (type === 'text') return p.text.trim().length > 0
  return p.file !== null
}

export const ERROR_COPY: Record<string, string> = {
  not_found: 'The museum has no record with that accession number. Check the number and try again.',
  no_provenance: 'That record exists, but it has no provenance text to read.',
  api_error: 'The museum service did not answer properly just now. Try again in a moment.',
  bad_request: 'That accession number is not in a form the lookup can use.',
  server_unavailable: 'The preview service is not running here, so nothing can be fetched right now.',
}
