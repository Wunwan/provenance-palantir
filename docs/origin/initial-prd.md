# Provenance Evidence Trail: PRD

Oct 29, 2026 · @wunwan

A visualization-first workspace that shows where an artwork's ownership history is missing, what the existing evidence says, and where to look next. Earlier planning lives in the [proposal doc](https://claude.ai/artifact/3ksZBgeL7Ss4QgD5jz3Kmg).

## 1. Context

### The problem space

Provenance is an artwork's ownership history: part art history, part detective work. The evidence is scattered across museum records, dealer ledgers, auction catalogs and postwar archives, in mixed formats and languages, and a twenty-year gap can hide in a single period of text.

- **Scale:** a common estimate is 600,000 artworks looted in the Nazi era, at least 100,000 still missing ([CNN](https://edition.cnn.com/2019/04/21/us/nazi-stolen-art-returned)).
- **Access:** only 33 of 160 U.S. museums (21%) offer easily accessible, object-level Nazi-era provenance online ([WJRO](https://wjro.org.il/?p=14626)).
- **Definition:** the 2024 Best Practices count forced sales and sales under duress, 1933 to 1945, as Nazi-looted ([Best Practices](https://www.lootedartcommission.com/WJAJFL10202)).
- **Signals researchers use:** where a work was in 1933 to 1945 ([Cleveland Museum of Art](https://www.clevelandart.org/nazi-era-provenance)) and whether a Red Flag name appears in its history ([Proveana](https://www.proveana.de/en/glossar/r)).
- **A gap is a question, not a verdict** ([Cleveland Museum of Art](https://www.clevelandart.org/articles/provenance-research)).
- **Prior art:** Carnegie Museum of Art's Art Tracks structured and visualized one museum's provenance; this project links across sources and shows gaps and leads.

### The assignment

Palantir Product Design Show & Tell: build something meaningful to me with AI, in at most 3 hours, under one of two lenses. This is **Lens B, make it click**: take something complicated and make it legible and usable, with working software as a bonus.

- **Deliverables:** an unlisted YouTube video under 3 minutes, and a link to what I built.
- **The video covers:** why the problem was worth solving, how I approached it (decisions, challenges, where AI came in), a demo, and optionally what I'd do with more time. A pitch, not a product demo.
- **They reward:** reaching over safe and small, talking plainly, and something that represents my interests, since they may discuss it live.

### Why me

In museums I always wonder where a piece has been and how its time shaped it. A guest lecture by a museum professional who helped return Native American pieces to their tribes showed me that sometimes the answer means a piece belongs somewhere else. (Verify her role before saying this on camera.)

## 2. Goals and build philosophy

**Product goal:** a visualization-first view of an artwork's ownership journey that shows where the gaps are, what the existing evidence says, and what could fill each gap. Actions exist to support the picture, not to run a full research workflow.

**Build goal:** show building skill and judgment. The product is assembled from **self-contained modules**, each built, tested and reviewed against my own standards before it joins the whole, so it is clear I made decisions in every part rather than accepting AI output.

**Each module carries:**

- **A contract:** what it takes in and gives out, in the shared data format.
- **My standard:** what good looks like for that part, written before building it.
- **A review gate:** I check the output against the standard, with saved tests where possible.
- **A judgment log:** what AI produced, what I changed or rejected, and why. This becomes the process part of the video.

**Success looks like:** a reviewer can say in one sentence what problem I solved and why I care, what I built and that it works, the hardest design decision, how AI helped and where I stepped in, and what comes next.

## 3. System components

Six self-contained modules around one shared evidence model.

| Module | What it does | In, out | My standard (review gate) |
| --- | --- | --- | --- |
| M1 Ingestion and adapters | Pulls records and converts each source into the shared format | Museum API records or an uploaded file, to contract records with a dated snapshot | Every field keeps a pointer to where it came from; empty provenance is marked, not dropped |
| M2 Cleanup engine | Cleans Cleveland's semi-structured steps: vague dates, life dates, notes, name variants | Raw provenance steps, to events with owners, dates and their precision, places and notes | Scores well on hand-labeled records; never removes uncertainty; failures logged |
| M3 Matching and ranking engine | Connects names across sources, and sorts pieces by importance | Names, to ranked candidates with reasons and bands; a ranked collection | Every rank is explainable; saved tests for matching rules |
| M4 Evidence search | Finds what might fill a gap, inside the loaded data and in outside archives | A gap, to labeled suggestions with a preview and a link | Origin always labeled: existing data or external source |
| M5 Interface | Import preview, collection view, piece view, sources | Contract data, to screens and actions | Every claim one click from its source; AI output never looks final |
| M6 Visualization | The core of the product, in D3: ownership journey, suggestion ghosts, gap-closing motion, history barcode | Events and gaps, to the trail, barcode and certainty bars | Same encodings everywhere; every chart leads to an action |

**Messy type for the demo:** Cleveland's provenance steps, already split but full of "?", "By 1930" and "Until 1937" dates, life dates and name variants. This keeps the pipeline lean so the build goes into the visualization. **Next engines:** the Art Institute of Chicago's free-text paragraphs, dealer stock-book rows (CSV), auction catalog pages (PDF and OCR), and handwritten ledger scans.

## 4. Problem to solution mapping

**Step 1, research:** nine researcher problems surfaced: gaps hidden in text, scattered evidence, slow name matching, tedious screening, unclear priorities, no next step, lost uncertainty, untraceable claims, and lost decisions. Messy, unformatted data underlies most of them.

**Step 2, narrowing:** I focus on four, plus prioritization as their support, because together they cover the path from raw records to a decision and they are where design and engineering meet.

| Problem | Design solution | Technical solution | Module |
| --- | --- | --- | --- |
| Messy, unformatted data | Import preview: raw record beside its cleaned version, each field linked to its source words | Cleanup rules for Cleveland's steps; adapters per source | M1, M2 |
| Gaps hidden in text | Ownership journey with hatched gaps and the 1933 to 1945 band | Punctuation-aware parsing; date precision fields; derived gaps | M2, M6 |
| Evidence scattered across sources | One trail with a lane per source; suggestions labeled by origin | Shared evidence model; internal and external evidence search | M4, M6 |
| Names hard to match | Match cards with visible reasons and strength bands | Ranked candidate scoring on names, dates and places | M3 |
| Unclear what to look at first (support) | Collection sorted by importance | Gap and risk-window scoring | M3, M6 |

**Out of focus for now:** full decision history, team workflows, and source-change detection (see Learnings).

## 5. End-to-end flow

&#91;embedded content: end-to-end flow · 5 stages, 20 steps, modules M1 to M6\]

The ownership journey is the center; every action loops back and updates the gap, the ranking and the barcode.

| Stage | User actions | Features | Problems solved |
| --- | --- | --- | --- |
| 1. Import and clean up | Choose a source, compare raw and cleaned, open a field's source | Import preview, cleanup engine, field-level source links | Messy data, gaps hidden in text |
| 2. Match | Read reasons, confirm or reject a candidate | Matching engine, match cards with bands | Names hard to match, scattered evidence |
| 3. Collection | Scan the barcode, sort, open a piece | Ranking, history barcode, certainty bars | What to look at first |
| 4. Piece | Select a step or gap, read suggestions, preview a record | Ownership journey, suggestions labeled existing or external | Gaps hidden in text, scattered evidence |
| 5. Act and update | Add evidence, confirm a match, see conflicts marked | Actions with notes; recalculation | Scattered evidence, gaps |

## 6. Features

The visualization is the product; the pipeline is kept lean so most of the build goes into it.

### Visualization features (the core)

| Feature | What the user sees and does | D3 pieces | Priority |
| --- | --- | --- | --- |
| V1 Ownership journey | One lane per source; crisp, faded and hatched for confirmed, approximate and gap; the 1933 to 1945 band; places on each step | Time and band scales, axis, SVG pattern and gradient | Build |
| V2 Source on hover | Hovering a step shows the exact words it came from and a link to the record | Data join | Build |
| V3 Suggestion ghosts | Possible evidence drawn inside the gap as dashed ghost bars, labeled existing data or external source, with a preview on click | Data join | Build |
| V4 Gap-closing motion | Confirming a match or adding evidence animates the gap shrinking and the ghost turning solid | Keyed join, transition | Build |
| V5 Conflict markers | Where two sources disagree, both bars show with a marker between them; no resolution workflow | Data join | Build |
| V6 History barcode | Every piece as a thin trail on one shared timeline, ranked by missing years in the risk window; clicking opens the journey | Time and band scales | Build |
| V7 Certainty bars | Confirmed, approximate and unknown share per piece in the list | Stack | Build |
| V8 Brush and zoom | Drag across the axis to focus a window, such as 1925 to 1950 | Brush, zoom | Stretch |
| V9 Gap histogram | Above the barcode: when history goes missing across the collection | Bin | Stretch |
| V10 Completeness, before and after | A small strip on the piece header showing how much of the history was known before and after my actions; the closure moment | Stack, transition | Stretch |
| V11 Locator map | Where the piece traveled, with unplaced steps listed beside the map | Geo projection | Later |
| V12 Dealer network | Hubs across the collection, then one dealer's world | Hierarchical edge bundling, force | Later |

### Pipeline features (lean)

| Feature | What it does | Priority |
| --- | --- | --- |
| P1 Import preview | A Cleveland record's raw provenance steps beside the cleaned events, each field linked to its source words | Build |
| P2 Cleanup | Rules for vague dates, life dates, notes and name variants in Cleveland's steps | Build |
| P3 Name matching | Ranked candidates with reasons and bands, precomputed; confirm or reject | Build |
| P4 Ranking | Pieces sorted by missing years in the 1933 to 1945 window | Build |
| P5 Evidence suggestions | From existing data, plus cached Getty Provenance Index results, labeled by origin | Build |
| P6 Free-text cleanup engine | AIC paragraphs and other messy formats | Later |
| P7 Artwork matching across collections | Linking records of the same object | Later |

**Actions in this version:** confirm or reject a match, and add evidence from a suggestion. Each one visibly changes the journey. Conflicts are shown, not resolved.

## 7. Prototype

The [clickable prototype](https://claude.ai/artifact/2Qvt6A5SiwCMGLQqb97ABJ) reflects the core: collections home, import, collection list, piece view with the ownership journey and match review, and sources. All eight snapshots are in the [proposal doc](https://claude.ai/artifact/3ksZBgeL7Ss4QgD5jz3Kmg).

> **Note for Claude:** treat the prototype as the structural reference, not the final visual design. I will refine the UI myself and may ask you to generate additional UI, starting with the F1 import preview and cleanup view, which the prototype does not yet show. Keep the layout decisions (timeline with a side inspector, two-field status) unless I say otherwise.

**Collection list:** the screening queue with certainty bars, work status and finding.

&#91;image: Collection list\]

**Piece view, gap selected:** the ownership journey with the 1933 to 1945 band, the source text, and leads for the gap.

&#91;image: Piece view with the gap selected\]

**After confirming a match:** the ledger record turns solid and the gap shrinks.

&#91;image: Piece view after confirming the match\]

## 8. Data model

&#91;embedded content: schema overview · sources to records, claims, shared registries, derived layer\]

Each collection keeps its own records; they meet only in the shared registries, where a confirmed match links two names or two records of the same object.

### Tables

| Table | Key fields | Where each value comes from |
| --- | --- | --- |
| collection | id, name, source, snapshot date | The import run |
| source\_record | id, collection, url, retrieved at, version, raw payload | The source exactly as fetched |
| claim | id, source\_record, field path, character span, text, method, certainty | A pointer into the raw record, e.g. `provenance[4].description`, characters 0 to 10 |
| event | id, artwork, from party, to party, type, date start and end, precision, link type, place, claims | Built from claims; every value cites them |
| artwork | id, title, artist, created, accession, image, status, finding | Museum fields; status and finding set by me |
| artwork\_link | artwork a, artwork b, reasons, band, decision | Matching engine, then my decision |
| party, party\_alias | preferred name, kind, life dates, external IDs; name as written | Name authorities; aliases from claims |
| gap | artwork, start, end, edge certainty, kind, in risk window | Derived from events, recalculated on change |
| match | name or record as written, candidate, reasons, band, decision | Matching engine |
| suggestion | gap, origin (existing or external), provider, query, preview, url, retrieved at | Evidence search |
| decision | target, choice, note, who, when | Me |

### A real example

Cleveland's record for Waldmüller's *Prater Landscape* lists the step "Fritz Nathan, sold to Dr. Tobler" dated "Until 1937" ([Cleveland record](https://openaccess-api.clevelandart.org/api/collectiononline/metadata/1983.155)). It becomes:

- **claim:** that record's URL, the provenance step's field path, the character span of the words, method rule, certainty as stated.
- **event:** from Fritz Nathan to Dr. Tobler, type sale, end date 1937, precision "until", start unknown.
- **party\_alias:** "Fritz Nathan", later also "Dr. Fritz Nathan" and "Galerie Nathan, Zürich" in the same record, linked to one party only after I confirm the match.

### Changing data and dependencies

- **Snapshots:** every source record is stored raw with its retrieved date and version.
- **Derived data is recalculated, never edited:** gaps, ranks, the barcode and completeness come from claims and events, so any change flows through.
- **Decisions attach to stable IDs** (a claim, a match), never to positions or wording.
- **On re-import, changed records flag their claims and decisions as needing review** instead of silently updating them. This version builds the snapshots and stable IDs; the flagging is a next step.
- **Module dependencies run through the contract only,** so any module can be rebuilt without breaking the others.

## 9. Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Pipeline (M1 to M4) | Python, with Pydantic models for the contract and pytest for saved tests | Each module runs and is tested on its own; the contract is checked at every boundary |
| Fuzzy matching | RapidFuzz for name similarity, plus my rules for dates, places and titles | Fast, explainable scores that I combine into bands |
| AI | Rules first; Claude API only where rules fall short, such as splitting names from roles | Cleveland's steps are already split, so rules cover most of it; any AI output is a suggestion with its source span |
| Storage | Static JSON files, one per table | Keeps the data model's tables without a database; no server, no keys |
| Interface (M5) | React with TypeScript (Vite) | Typed contract shared with the pipeline output |
| Visualization (M6) | D3 for the ownership journey, barcode and certainty bars; HTML for tables and panels | Positioned by data uses D3; laid out like a document uses HTML |
| Hosting | Static hosting such as Vercel or Netlify | One link that always works for reviewers |

### External evidence search (M4)

| Source | How to search | Use |
| --- | --- | --- |
| Getty Provenance Index | Public REST and SPARQL endpoints for dealer stock books and sales catalogs ([Getty API docs](https://data.getty.edu/provenance/docs/)) | Find sales and stock entries for a gap's names, titles and years |
| Wikidata | Public SPARQL query service | Name variants, life dates and identifiers for parties |
| Europeana, Internet Archive | Public search APIs (Europeana needs a free key) | Catalogs, bulletins and scans that mention a work |
| Lost Art, Proveana, property cards | I did not find a public API; pre-filled search links | Shown as leads, never as fetched results |

**Rules for suggestions:** every suggestion carries an origin label (from existing data, or from an external source and which one), a preview of the record, a link, and the date it was retrieved. This version uses suggestions from existing data plus Getty Provenance Index results fetched ahead of time and cached; Wikidata, Europeana, Internet Archive and live search are later.

## 10. Design principles

- **Make silence visible.** Gaps are prominent blocks, never empty space.
- **A gap is a question, not a verdict.** Visible, not alarming.
- **Every claim is one click from its source.**
- **Origin is always labeled.** Existing data or external source, never mixed silently.
- **AI output never looks final** until a person confirms it.
- **Absence is labeled honestly.** "No records found" means limited coverage, not a clean record.
- **Certainty by form, not color:** crisp, faded, hatched.
- **Restraint in tone.** Calm visuals for Holocaust-related material.

## 11. Execution plan

One codebase, built module by module. Each module passes its review gate before the next depends on it; the 3-hour cap covers the build, with a time log and a judgment log throughout.

| Order | Module | Builds | Review gate |
| --- | --- | --- | --- |
| 0 | Foundation | Project, contract, Cleveland adapter, one hand-written real record; first UI pass on it | Fixture validates against the contract |
| 1 | M1 and M2, lean | Demo pieces from Cleveland; rules for dates, life dates, notes and name variants | Every field has a source pointer; spot-checked against the records |
| 2 | M3 and M4, lean | Precomputed name matches with reasons; ranking; existing-data suggestions; cached Getty results | Saved matching tests pass; every suggestion labeled |
| 3 | M6 core | V1 ownership journey, V2 source on hover, V3 suggestion ghosts, V5 conflict markers | Encodings consistent; every mark traces to a claim |
| 4 | M6 motion and overview | V4 gap-closing transition, V6 history barcode, V7 certainty bars, linked selection | Actions visibly change the picture |
| 5 | M5 Interface | P1 import preview, collection view, piece view with match review and add evidence | Every action updates the journey and rank |
| 6 | M6 stretch | V8 brush and zoom, V9 gap histogram, V10 completeness before and after | Each one supports a decision, or it is cut |
| 7 | Swap and polish | Fixture replaced with pipeline output; one user test; final UI pass on real data | Real-data edge cases handled |
| 8 | Ship | Static deploy; pitch materials; video | Links work in a private window |

**To add:** cleanup steps and saved tests per module.

## 12. Application

- **Museum provenance researchers:** screening a collection, then working one piece at a time from the inside out; most of their work is reviewing what museums already hold.
- **Claims and acquisitions:** a single piece needs a fast, sourced picture of its history before a decision.
- **Small museums:** short, grant-funded first checks, such as Germany's, where a tool that makes limited expert hours go further matters most.
- **Auction houses and dealers:** due diligence before a sale; one auction house already checks Red Flag names and Lost Art as standard practice ([Karl & Faber](https://www.karlundfaber.de/en/2023/10/provenance-revealed-provenance-research-in-practice/)).
- **Visitors, later:** a read-only Story mode that shows only confirmed steps and honest gaps.

**Realistic paths:** an open-source tool and data model, a public-good project for small museums, or an integration inside existing collection systems rather than a standalone product.

## 13. Learnings and fallback

### Limitations

- **Access:** much evidence is on paper or restricted; "no records found" usually means not digitized.
- **Data changes:** records are revised and APIs drift; snapshots and versions are kept for that reason.
- **Ethics:** naming people needs care; a connected dealer is not a verdict; outputs could reach disputes.
- **Adoption:** museums already have collection systems and small teams.

### Fallback if time runs short

Cut in this order: the stretch visualizations (completeness, histogram, brush), cached Getty suggestions, conflict markers, the import preview's polish. Never cut the ownership journey, the suggestion ghosts, or the gap-closing moment.

### Next steps

- **More cleanup engines:** AIC free-text paragraphs, dealer stock-book CSVs, auction catalog PDFs with OCR, handwritten ledgers.
- **Artwork matching** across collections.
- **More evidence sources:** Wikidata, Europeana, Internet Archive, and live search.
- **Conflict resolution** as an action, not just a marker.
- **Linked views:** locator map, collection map with a time brush, dealer network.
- **Story mode** for visitors.
- **Source-change flagging** on re-import.
- **Open-source release** of the pipeline and data model.

### Learnings

To fill in after the build: what each module taught me, where AI helped, and where my judgment changed the result.

## Appendix

### Pitch and video

- **Intro:** "Provenance is part art history, part detective work. The clues are scattered across dozens of archives, and a twenty-year gap can hide in a single period. So I built the case board."
- **Structure, under 3 minutes:** why; approach and the six modules, with my review at each; demo from messy import to ownership journey to a closing gap; AI judgment and what I overrode; what's next.
- **Wrap-up:** "The tool doesn't close the case. It makes sure no one overlooks the question."
- **Full drafts:** in the [proposal doc](https://claude.ai/artifact/3ksZBgeL7Ss4QgD5jz3Kmg).

### Risks

| Risk | Mitigation |
| --- | --- |
| Too much for 3 hours | Modules thin but real; precomputed data; cut order above |
| Implying a real work was looted | Only real provenance text; suggestions with reasons; no invented findings |
| External APIs fail during the demo | Cached results with retrieved dates |
| Image rights | Public-domain works only |

### Open questions

- Confirm the lecture details.
- Verify the demo records (the Hals painting, famous works, a real gap case) and their image licenses.
- Confirm Cleveland and AIC field names, and that accession numbers don't always give the acquisition year (AIC's *Near Newport* has accession 1944.686 but says sold in 1949).

### Sources

[Getty Provenance Index API](https://data.getty.edu/provenance/docs/) · [Cleveland Open Access API](https://openaccess-api.clevelandart.org) · [AIC record for Near Newport](https://api.artic.edu/api/v1/artworks/109228) · [Proveana glossary](https://www.proveana.de/en/glossar/r) · [2024 Best Practices](https://www.lootedartcommission.com/WJAJFL10202) · [WJRO](https://wjro.org.il/?p=14626) · [Hierarchical edge bundling](https://observablehq.com/@d3/hierarchical-edge-bundling) · [Proposal doc](https://claude.ai/artifact/3ksZBgeL7Ss4QgD5jz3Kmg)
