# Derived data is recalculated, never edited; decisions live in localStorage

Gaps, ranks, the barcode and completeness are always computed from claims, events and decisions, never edited directly. Decisions attach to stable IDs (a claim, a match) and are kept in the browser's `localStorage` over the static seed data, with a reset to the seed state. The cost is a client-side TypeScript copy of the gap and rank logic, which saved tests check against the pipeline's output.
