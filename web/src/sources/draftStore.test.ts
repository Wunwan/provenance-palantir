import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addDraft, deleteDraft, loadDrafts, saveDrafts } from './draftStore'

function stubStorage() {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  })
  return data
}

describe('draftStore', () => {
  let data: Map<string, string>
  beforeEach(() => {
    data = stubStorage()
  })

  it('starts empty and survives corrupt data', () => {
    expect(loadDrafts()).toEqual([])
    data.set('provenance-sources-drafts-v1', '{nope')
    expect(loadDrafts()).toEqual([])
  })

  it('adds drafts with an id and a date, and persists them', () => {
    const next = addDraft({ type: 'csv', title: 'file.csv', summary: '3 rows' })
    expect(next).toHaveLength(1)
    expect(next[0].id).toBeTruthy()
    expect(next[0].addedAt).toMatch(/^\d{4}-/)
    expect(loadDrafts()).toEqual(next)
  })

  it('deletes by id', () => {
    const [a] = addDraft({ type: 'api', title: 'A', summary: 's' })
    addDraft({ type: 'pdf', title: 'B', summary: 's' })
    const next = deleteDraft(a.id)
    expect(next.map((d) => d.title)).toEqual(['B'])
  })

  it('does not throw when storage is blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(loadDrafts()).toEqual([])
    expect(() => saveDrafts([])).not.toThrow()
  })
})
