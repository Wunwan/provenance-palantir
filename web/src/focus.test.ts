import { afterEach, describe, expect, it } from 'vitest'
import { NAZI_ERA, focusLabel, isValidFocus, loadFocus, saveFocus } from './focus'

const store = new Map<string, string>()
const fake = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
}
Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true })

afterEach(() => store.clear())

describe('focus', () => {
  it('labels none as all periods and a range in words', () => {
    expect(focusLabel(null)).toBe('All periods')
    expect(focusLabel(NAZI_ERA)).toBe('1933 to 1945')
  })
  it('validates integers and bounds', () => {
    expect(isValidFocus({ start: 1933, end: 1945 })).toBe(true)
    expect(isValidFocus({ start: 1945, end: 1933 })).toBe(false)
    expect(isValidFocus({ start: 1933, end: 1933 })).toBe(false)
    expect(isValidFocus({ start: 999, end: 1500 })).toBe(false)
    expect(isValidFocus({ start: 1500, end: 2101 })).toBe(false)
    expect(isValidFocus({ start: 1933.5, end: 1945 })).toBe(false)
    expect(isValidFocus(null)).toBe(false)
  })
  it('defaults to null, round-trips, and ignores bad stored values', () => {
    expect(loadFocus()).toBeNull()
    saveFocus(NAZI_ERA)
    expect(loadFocus()).toEqual(NAZI_ERA)
    saveFocus(null)
    expect(loadFocus()).toBeNull()
    store.set('provenance-focus-v1', '{"start":5,"end":1}')
    expect(loadFocus()).toBeNull()
    store.set('provenance-focus-v1', 'nope')
    expect(loadFocus()).toBeNull()
  })
})
