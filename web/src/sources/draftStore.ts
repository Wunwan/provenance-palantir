import type { DraftSource } from './types'

const KEY = 'provenance-sources-drafts-v1'

/** Drafts live in the browser like match decisions (ADR 0002). */
export function loadDrafts(): DraftSource[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as DraftSource[]) : []
  } catch {
    return []
  }
}

export function saveDrafts(drafts: DraftSource[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(drafts))
  } catch {
    // storage can be blocked; the app still works for the session
  }
}

export function addDraft(draft: Omit<DraftSource, 'id' | 'addedAt'>): DraftSource[] {
  const next = [
    ...loadDrafts(),
    { ...draft, id: crypto.randomUUID(), addedAt: new Date().toISOString() },
  ]
  saveDrafts(next)
  return next
}

export function deleteDraft(id: string): DraftSource[] {
  const next = loadDrafts().filter((d) => d.id !== id)
  saveDrafts(next)
  return next
}
