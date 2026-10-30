export const day = (iso: string) => iso.slice(0, 10)

export const typeLabel: Record<string, string> = {
  api: 'API',
  csv: 'CSV file',
  pdf: 'PDF',
  text: 'Text',
  scan: 'Scan',
}

export function hostPath(url: string): string {
  try {
    const u = new URL(url)
    return u.host + u.pathname
  } catch {
    return url
  }
}
