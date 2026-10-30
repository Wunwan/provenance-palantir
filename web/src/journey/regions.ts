/** Place to region lookup for ordering the journey chart's rows: Europe, then North America, then other known places, "Unknown" last. */

export const UNKNOWN_PLACE = 'Unknown'

const EUROPE = [
  'paris', 'london', 'amsterdam', 'berlin', 'vienna', 'zurich', 'zürich', 'basel', 'geneva', 'munich', 'frankfurt',
  'hamburg', 'cologne', 'brussels', 'rome', 'florence', 'venice', 'madrid', 'lisbon', 'prague', 'budapest',
  'france', 'germany', 'austria', 'switzerland', 'england', 'britain', 'united kingdom', 'netherlands', 'holland',
  'belgium', 'italy', 'spain', 'portugal', 'europe',
  'düsseldorf', 'dusseldorf', 'barmen', 'st. gallen', 'saint gallen',
  'berlin-zehlendorf', 'chantilly', 'ferrières', 'ferrieres', 'hertfordshire', 'hoevelaken', 'lucerne', 'oslo', 'norway',
  'surrey', 'the hague', 'utrecht', 'czech republic', 'linz', 'orrouy', 'saint-germain', 'carmarten',
]
const NORTH_AMERICA = [
  'new york', 'cleveland', 'chicago', 'boston', 'philadelphia', 'washington', 'los angeles', 'san francisco',
  'detroit', 'hartford', 'shaker heights', 'toronto', 'montreal', 'united states', 'usa', 'u.s.', 'america', 'canada', 'ohio', 'ny',
]

const has = (place: string, words: string[]) => {
  const p = place.toLowerCase()
  return words.some((w) => (w.length <= 3 ? new RegExp(`\\b${w}\\b`).test(p) : p.includes(w)))
}

/** 0 Europe, 1 North America, 2 other known place, 3 Unknown. */
export function regionRank(place: string): number {
  if (place === UNKNOWN_PLACE) return 3
  if (has(place, EUROPE)) return 0
  if (has(place, NORTH_AMERICA)) return 1
  return 2
}

/** Distinct places, ordered by region (stable by first appearance within a region), "Unknown" last. */
export function orderPlaces(places: string[]): string[] {
  const distinct = [...new Set(places)]
  return distinct
    .map((p, i) => ({ p, i }))
    .sort((a, b) => regionRank(a.p) - regionRank(b.p) || a.i - b.i)
    .map((x) => x.p)
}
