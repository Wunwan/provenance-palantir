# Provenance project

A workspace that shows where an artwork's ownership history is missing, what the existing evidence says, and where to look next. **A gap is a question, not a verdict.**

Museum provenance is usually written as free text: "Fritz Nathan, sold to Dr. Tobler, until 1937", "by 1930", "Private collection". The silences in that text are easy to miss, and it is hard to tell which works to look at first. This project reads provenance records, turns them into structured and sourced events, finds the stretches of time where no record says who held the work, and shows them next to the evidence that exists.

It is a working prototype, not a finished product. The demo set is 16 paintings from the Cleveland Museum of Art, all fetched from the museum's public API.

## What you can do in the app

**Collection.** A grid of the 16 artworks with their real images. Each card shows how many holders the record names, when the record starts, and how many gaps it has. Sort by holders or by date made.

**Artwork page.**
- **Journey.** A timeline of who held the work, one row per place, with each gap drawn as a labelled band. Owner bars are never drawn across a silence. Switch to **Map** to see where the work travelled: pins, numbered colour-coded arcs, a year slider, zoom and pan. Periods with no known place are listed beside the map, never guessed.
- **Chain of possession.** One card per ownership step: holder, received from, year, action, place, certainty, origin and the exact source words, each linked to the record.
- **Name matches.** The pipeline proposes that two names are the same person ("Clarice von Rothschild" and "Baroness Clarice de Rothschild"), with reasons. You accept or reject each one. Rule output stays provisional until you decide.
- **Gap actions.** Selecting a gap opens an Actions menu. The items (read suggestions, add evidence, open leads in other archives and so on) are placeholders for now.

**Demo scenario.** A fictional artwork on its own page, built to show how several sources map onto the same timeline and fill a gap. A **Sources used** control steps from a museum record alone (a 27-year gap) to adding a dealer ledger (17 years) and an auction catalogue (9 years, still open). Each source has its own colour, and every ownership card carries a source tag. Everything in it is invented and labelled **fictional**: the artwork, the people, the records and the sources. It is kept apart from the real collection and can never merge into it.

**Focus period.** Gaps at any date count equally by default. You can optionally focus on a range, such as 1933 to 1945, the years museums prioritise when checking provenance for looted art. It is a lens, not a rule.

**Sources.** One card per provider: the Cleveland Open Access API and the cached Getty Provenance Index, plus any drafts you save. Each source page lists its records in readable form. **Add source** is a three-step flow (choose type, provide it, preview). For a Cleveland accession number it runs the real pipeline and shows the raw steps beside the cleaned events, stage counts, name matches with your existing collection, and how each incoming step would join an existing chain: agrees, fills a gap, conflicts, or new. It is preview only; nothing is added to the collection.

## How it works

```
Cleveland Open Access API ──► pipeline/ (Python) ──► static JSON ──► web/ (React + TypeScript + D3)
Getty Provenance Index (cached)                      web/src/generated
Wikidata (places, precomputed)
```

1. **Ingest.** Each record is stored exactly as fetched, with its retrieved date and version.
2. **Clean up.** Rules split the provenance steps into events, parties and aliases, and read vague dates ("by 1930", "until 1937"), life dates and places. Records that list their steps latest-first are detected and read in the right order.
3. **Claims.** Every cleaned value points back to the exact words in the source (`provenance[4].description`, characters 0 to 10). Nothing in the interface is more than one click from its source.
4. **Match and suggest.** Name matching produces ranked candidates with reasons and bands. Suggestions come from the loaded data and from cached Getty results, always labelled with their origin.
5. **Derive.** Gaps, holder counts and certainty are recalculated in the browser from claims, events and your decisions; they are never edited by hand.
6. **Show.** The interface reads the static JSON files. There is no server or database. Your decisions (match accept or reject, drafts, focus period) are kept in the browser's `localStorage`.

Rules come before AI: this version uses no language model to interpret provenance. See `docs/adr/` for the decisions behind these choices.

## Stack

| Layer | Technology | Used for |
|---|---|---|
| Pipeline | Python 3.12+, [uv](https://docs.astral.sh/uv/) | Ingest, cleanup, matching, geocoding and the live preview |
| Data contract | [pydantic](https://docs.pydantic.dev) 2, JSON Schema, `json-schema-to-typescript` | One model of the data (`contract.py`); its schema generates the TypeScript types, so the pipeline and the app cannot drift apart |
| Matching | [RapidFuzz](https://rapidfuzz.github.io/RapidFuzz/) plus rules | Name similarity, combined with life dates and shared artworks into bands (strong, possible, weak) |
| Web app | React 19, TypeScript 7, Vite 8 | The interface |
| Components | [Blueprint](https://blueprintjs.com) 6 | Navbar, buttons, tags and icons, themed through CSS custom properties. The dropdowns are hand-built, because Blueprint's popover did not position correctly here |
| Charts and map | [D3](https://d3js.org) 7 (linear scales and ticks, `d3-geo` projections and paths, colour interpolation), `topojson-client`, `world-atlas` | D3 does the maths and React draws the SVG: the journey timeline and the map |
| Styling | Plain CSS with design tokens; Hanken Grotesk, Source Serif 4 and IBM Plex Mono | Dark gallery look; light theme follows the system setting |
| Tests and checks | Vitest 5, oxlint, pytest | Unit tests, real-data invariants, and a check that every claim's text really appears in its source record |
| Dev tooling | A dev-only Vite plugin; Agentation | The live source preview, and an on-page annotation toolbar. Neither ships in a production build |
| External data | Cleveland Open Access API, Getty Provenance Index (SPARQL, cached), Wikidata API, Natural Earth | See Data and licences below |

Architecture in three decisions (each has an ADR in `docs/adr/`): the app is **static JSON with no server or database**; **derived data is recalculated** from claims and decisions, never edited; and **rules come before AI**.

## How it was built

The project was built with Claude Code as a set of small, reviewed steps rather than one large generation.

1. **Frame the problem.** A PRD and a project proposal (`docs/origin/`) set the goal: a working showcase on real public data, designed around the provenance researcher who needs to see what is missing and act on it.
2. **Agree the language before the code.** Short question-and-answer sessions on the open decisions produced `GLOSSARY.md` and three ADRs. Words such as *gap*, *claim*, *event* and *focus period* have one meaning each, and the code and the interface use them the same way.
3. **Spec and tickets.** One spec issue and a set of vertical-slice tickets on GitHub, each ending in something you can see.
4. **Contract first, then one real record.** The first ticket defined the data contract and took a single hand-decided real record, the Van Gogh, all the way to the screen. Every value cites the exact words it came from, and a test checks each cited span against the raw record.
5. **A cost-split agent loop.** Work was divided by how hard it was (`.claude/skills/cost-split/`). A strong model plans, writes the shared types two builders depend on, and reviews. A standard model builds one briefed chunk in files no one else is editing. A cheap model searches and runs mechanical checks. Each run keeps a state file in `.agents/runs/`, files are backed up before a chunk starts, a failed chunk gets one retry and is then restored, and the builder never judges its own work.
6. **Verify against the real thing.** Besides unit tests, the checks run over all 16 real artworks: no owner bar may overlap a gap, and no chart label may collide at two widths. Layouts were checked in a real browser with screenshots and measured positions. This caught problems the tests did not: two records that list their provenance latest-first and had been read backwards, a place lookup that put one Rothschild estate in the wrong French commune, owner bars drawn across silences in the record, and a popover that never positioned itself.
7. **Design in steps.** The look moved from a light Swiss layout to a dark gallery style, then toward the editorial structure of Harvard's CAMLab site. Each change is recorded in `docs/design-direction.md`.
8. **Challenge the defaults.** The 1933 to 1945 window was first hard-coded into the logic. Asking why it narrowed the picture turned it into an optional focus period. The Sources feature was designed through a 14-question session before any code, and the map was built from a written plan with review gates: geocode cache, route builder, static map, linking, year scrubber, then polish.
9. **Keep a judgment log.** `docs/judgment-log.md` records what AI produced, and what was changed or rejected and why.

Most of the code was written by AI agents working from briefs. The direction, the design decisions and the review of what shipped were done by a person.

## Principles

- **Real data only.** No invented records, places or events. Places are read by rules from the provenance text and geocoded once from Wikidata; a pin is only drawn for a place the data states.
- **Every claim is one click from its source.**
- **Origin is always labelled**: existing data or external source, never mixed silently.
- **Certainty shows by form** (solid, faded, hatched), not by colour alone.
- **Rule output looks provisional** until a person accepts it.
- **Calm tone** for Holocaust-related material.

## Data and licences

| Source | Used for | Notes |
|---|---|---|
| [Cleveland Museum of Art Open Access API](https://openaccess-api.clevelandart.org) | The 16 artworks, their images and provenance | Each record carries its own licence flag; all 16 are CC0 |
| [Getty Provenance Index](https://data.getty.edu/provenance/docs/) | Suggestions for gaps | Fetched ahead of time and cached; covers only two dealers so far |
| [Wikidata](https://www.wikidata.org) | Coordinates for the places on the map | Looked up once by `provenance.geocode`, with hand-checked overrides in `pipeline/data/places.overrides.json` |
| [Natural Earth](https://www.naturalearthdata.com) via `world-atlas` | Map outline | A modern basemap; borders changed during this period |

Artwork images are loaded from the museum's servers, not copied into the repository.

## Getting started

You need Node and [uv](https://docs.astral.sh/uv/).

```bash
# run the app
cd web
npm install
npm run dev          # http://localhost:5173 (or the port Vite prints)

# checks
npm test             # unit tests
npm run lint
npm run build

# pipeline tests
cd ../pipeline
uv run pytest -q
```

Rebuild the data after changing the pipeline or the list of artworks (`ACCESSIONS` in `pipeline/src/provenance/build.py`):

```bash
cd pipeline
uv run python -m provenance.ingest data/raw/cleveland 1958.32 1965.233   # fetch raw records
uv run python -m provenance.build . data/evidence                        # clean up, match, suggest
uv run python -m provenance.geocode                                      # places (network, a few minutes)
cd ../web && npm run generate                                            # JSON + types for the app
```

The **Add source** live preview calls `/api/preview`, a route that exists only in the dev server (`npm run dev`) and runs the pipeline in a temporary folder without touching `pipeline/data`. In a production build it is absent and the flow says so. You can also run it directly: `uv run python -m provenance.preview 1965.233`.

## Repository layout

```
pipeline/            Python: ingest, cleanup, matching, suggestions, geocoding, live preview
  src/provenance/    the modules; tests are in pipeline/tests
  data/raw/          records exactly as fetched
  data/evidence/     one JSON file per table of the data model
web/                 React + TypeScript + Vite + D3 (Blueprint components)
  src/derive.ts      gaps, ranking and certainty, recalculated from the data
  src/journey/       journey and route logic (segments, silences, map route)
  src/components/    collection, artwork page, journey chart and map, sources
  src/generated/     JSON and types produced by the pipeline
docs/                design direction, decisions (adr/), judgment log
  origin/            the initial PRD and the project proposal
.claude/             agent roles (advisor, builder, scout, chore) and the cost-split skill
.agents/runs/        state file for each build run
GLOSSARY.md          the shared vocabulary: source, claim, event, gap, match and more
```

## Not built yet

- **Cross-source merging.** A second source can be previewed against an artwork's chain, but it does not yet add events to it. Name matches and Getty leads are the only cross-source links today.
- **Seizure and custody events.** The chart can draw them, but the pipeline does not derive them from wording yet, so works taken by the Nazis appear as ordinary chains.
- **Gap actions.** The Actions menu is a set of placeholders; adding evidence does not yet change a gap.
- **Other engines.** CSV stock books, auction-catalogue PDFs, free-text paragraphs and handwritten ledgers appear in the Add source flow as labelled illustrations only.
- **Place roles.** A place read from a sale or a museum display is drawn like any other place, although it says where the sale happened, not necessarily where the work lived.
- **Wider coverage.** One collection, 16 works, and Getty suggestions for two dealers.

## Documentation

- `GLOSSARY.md`: the vocabulary used everywhere in the code and the interface
- `docs/adr/`: why the data is static JSON, why derived data is recalculated, and why rules come before AI
- `docs/design-direction.md`: the visual direction
- `docs/moodboard.html`: the visual moodboard; `docs/moodboard.md` has the notes on what was taken from each reference
- `docs/tech-stack-diagram.html`: the stack and external tools for the three main features, with what is built and what is only proposed
- `docs/judgment-log.md`: decisions made while building
- `docs/origin/`: the initial PRD and the project proposal the work started from
- `.claude/skills/cost-split/SKILL.md`: how work was divided between model tiers, briefed, verified and recorded
