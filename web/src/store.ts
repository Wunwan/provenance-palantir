import type { Decision } from './types'

const KEY = 'provenance-decisions-v1'

/** Decisions live in the browser over the static seed data (ADR 0002). */
export function loadDecisions(): Decision[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as Decision[]) : []
  } catch {
    return []
  }
}

export function saveDecisions(decisions: Decision[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(decisions))
  } catch {
    // storage can be blocked; the app still works for the session
  }
}

export function resetDecisions(): Decision[] {
  saveDecisions([])
  return []
}
