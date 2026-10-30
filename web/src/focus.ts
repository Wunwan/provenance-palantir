/** An optional range of years the user picks to measure and highlight gaps. None means all periods. */
export interface FocusPeriod {
  start: number
  end: number
}

const KEY = 'provenance-focus-v1'

/** Preset: the Nazi era, the years museums prioritize when checking provenance for looted art. */
export const NAZI_ERA: FocusPeriod = { start: 1933, end: 1945 }

/** Integers, 1000 <= start < end <= 2100. */
export function isValidFocus(f: unknown): f is FocusPeriod {
  if (!f || typeof f !== 'object') return false
  const { start, end } = f as Record<string, unknown>
  return (
    Number.isInteger(start) && Number.isInteger(end) &&
    (start as number) >= 1000 && (start as number) < (end as number) && (end as number) <= 2100
  )
}

export function focusLabel(f: FocusPeriod | null): string {
  return f ? `${f.start} to ${f.end}` : 'All periods'
}

export function sameFocus(a: FocusPeriod | null, b: FocusPeriod | null): boolean {
  return a === b || (!!a && !!b && a.start === b.start && a.end === b.end)
}

export function loadFocus(): FocusPeriod | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const f: unknown = JSON.parse(raw)
    return isValidFocus(f) ? { start: f.start, end: f.end } : null
  } catch {
    return null
  }
}

export function saveFocus(f: FocusPeriod | null): void {
  try {
    if (f) localStorage.setItem(KEY, JSON.stringify(f))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}
