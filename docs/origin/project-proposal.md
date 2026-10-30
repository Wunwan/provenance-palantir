# Provenance Evidence Trail: Project Proposal

Oct 28, 2026 · @wunwan

## Summary

A workspace where provenance researchers see what is missing from an artwork's history, act on it, and watch the trail fill in. Built for the Palantir Product Design Show & Tell under Lens B (make it click), as working software on real public data from the Cleveland Museum of Art. It is a showcase of building skills, not a market product, but it is designed around a real user: the provenance researcher.

- **Core value:** it makes what is missing from an artwork's history impossible to overlook, and shows where to look next.
- **Framing:** provenance is part art history, part detective work; the tool is the case board.
- **Deep feature:** ranked name matching with visible reasons, reviewed by the researcher.
- **Signature visual:** two linked timelines, the collection's history barcode and each piece's evidence trail.
- **Build:** one codebase, modules around a shared evidence model, built as one vertical slice.
- **Prototype:** [clickable skeleton with sample data](https://claude.ai/artifact/2Qvt6A5SiwCMGLQqb97ABJ).

**One sentence:** Researchers search a dozen disconnected archives for a single artwork; this tool pulls the evidence onto one trail, makes the gaps impossible to miss, and points to the next lead.

## Why this matters to me

- **The spine:** in museums I always wonder where a piece has been and how its time shaped it; context makes me appreciate it more.
- **The stakes:** a guest lecture in my Culture and Society class, by a museum professional who helped return Native American pieces to their tribes, showed me that sometimes the answer means a piece belongs somewhere else. Verify her role and work before saying this on camera.
- **The framing:** provenance is part art history, part detective work. Use this once in the intro and echo it in the wrap-up; it is about investigating, not accusing.
- **The bookend:** open as a curious visitor, build for the researcher, end with what a visitor could one day see.

## Problem

The evidence about where artworks have been exists, but it is scattered, slow to search and hard to see.

- **Scale:** a common estimate is 600,000 artworks looted in the Nazi era, with at least 100,000 still missing ([CNN](https://edition.cnn.com/2019/04/21/us/nazi-stolen-art-returned)).
- **Transparency:** of 160 U.S. museums analyzed, only 33 (21%) offer easily accessible, object-level Nazi-era provenance online; elsewhere it is buried in general collection databases, and the main U.S. portal closed in 2024. The information researchers need exists but is hard to reach ([WJRO](https://wjro.org.il/?p=14626)).
- **Active stakes:** the Met has handed over looted antiquities worth more than $95 million since 2017, and its 12-person provenance team calls each assessment slow ([Hyperallergic](https://hyperallergic.com/value-of-looted-objects-at-met-museum-tops-95m-after-new-seizures/)).
- **Fragmentation:** records sit across museum databases, dealer ledgers, auction catalogs and postwar archives, in different formats and languages.
- **Omission:** an independent review found one major collection's published provenance left out Jewish former owners ([ARTnews](https://www.artnews.com/art-news/news/report-buhrle-foundation-provenance-research-not-sufficient-kunsthaus-zurich-1234711068)). How a record is presented can hide what matters.

## Problems the product solves

| Problem | Design solution | Technical solution |
| --- | --- | --- |
| Gaps hidden in text | Hatched gaps on a timeline | Punctuation-aware parsing |
| Evidence scattered | One trail, a lane per source | Shared evidence model |
| Name matching is slow | Match cards with reasons | Ranked candidate scoring |
| Screening is tedious | Screened out, with the reason | Rule-based screening |
| Unclear priorities | Queue and barcode sorted by risk | Gap and window scoring |
| No clear next step | Leads for each gap | Gap-to-source rules |
| Uncertainty gets lost | Fade for approximate dates | Date precision fields |
| Claims can't be traced | Click a step to see its source | Claims linked to text spans |
| Decisions get lost | Decision log and history | Versioned sources, re-review flags |

What it does not solve: it does not decide whether a work was stolen, it cannot reach what is not digitized, and it does not replace expertise.

## User and use case

The primary user is a museum provenance researcher. Most of their work is reviewing collections the museum already holds; claims and acquisitions start from a single piece instead.

- **How they work:** screen the collection by elimination, prioritize suspects, research one piece from the inside out, follow names to outside archives, then record a finding.
- **Today:** each source is searched by hand, one at a time, often in German, with names spelled differently.
- **Entry points:** a whole collection (systematic review), or one piece (a claim or an acquisition).
- **Input:** a collection imported from Cleveland's open API, or one object ID.
- **Output:** a ranked queue, an evidence trail per piece, research leads, and a recorded decision.
- **Later audience:** museum visitors, through a read-only Story mode that shows only confirmed steps.

## Solution

An investigation workspace: the per-piece chain of ownership is the core, the collection is the doorway, and every view leads to an action.

**Views**

- **Collections home:** review progress per collection, plus import.
- **Collection view:** a history barcode (every artwork as a thin trail on one shared timeline, gaps hatched, the 1933 to 1945 band running through) with a small gap histogram on top, and a table for sorting and filtering. Rows rank by years of missing history inside the risk window.
- **Piece view:** header with image and wall-label title; evidence trail with one lane per source; the source text with highlights; an always-visible inspector on the right.
- **Sources:** each archive, its format, and how reachable it is.
- **Import:** choose source, fetch, extract, screen, then review a summary before anything reaches the list.

**Core actions**

1. **Confirm or reject AI suggestions:** name matches and extracted steps.
2. **Add evidence to a gap:** attach a finding or citation to a specific gap; the gap visibly shrinks.
3. **Record a decision:** work status, finding and a note, kept in history.

**Classification and status**

- **Screening is automatic,** by rules, always with the reason kept.
- **The finding is suggested from the chain,** for example a 21-year gap overlapping 1933 to 1945, with its evidence shown. The researcher confirms or changes it.
- **Two fields:** work status (not reviewed, needs research, in research, resolved, screened out) and finding on the traffic-light scale (green, yellow, orange, red, not set).
- **When the chain changes, the suggestion updates** and is flagged for a second look.

## Prior art and differentiation

Carnegie Museum of Art's Art Tracks project (around 2015) already structured and visualized provenance, including an in-gallery touchscreen ([Carnegie Magazine](https://alltogether.carnegiemuseums.org/?p=6033), [AAM](https://aam.mydigitalpublication.com/july-august-2016/page-39)). The video must credit it.

- **Art Tracks:** structures and presents one museum's own provenance.
- **This project:** links evidence across sources, surfaces gaps and conflicts, and points to where to look next.
- **To confirm:** the difference above, ideally with a researcher, before claiming it.
- **Related research:** "Teaching Provenance to AI" (Mariani, Rother, Koss) proposes an annotation scheme for structuring provenance text ([PDF](https://opus.bibliothek.uni-augsburg.de/opus4/files/125703/125703.pdf)).

## Visual design direction

An expert tool with a museum soul: dense and clear like a professional tool, grounded in the art itself.

- **Two linked timelines are the signature:** the history barcode answers which piece to open first; the evidence trail answers what to do about it. Selecting in one updates the other, the linked-views principle Gotham is known for, borrowed as a principle, not a look.
- **Bring the art in:** large public-domain images in the piece view, thumbnails in the list.
- **Museum wall label:** artwork titles in a refined serif styled like a gallery label; data in a clean sans.
- **Certainty by form, not color:** crisp for confirmed, faded for approximate, hatched for gaps; color is for source type and status.
- **One motion that answers an action:** when evidence is added or a match confirmed, the gap visibly closes.
- **Restraint:** calm palette and quiet visuals; no detective styling.
- **Later views:** a linked locator map (unplaced steps listed beside it), a collection map with a brush to 1933 to 1945, Story mode for visitors, and a dealer network as hierarchical edge bundling.

## Visualization plan

Every visualization must support a decision or reveal a pattern; the two linked timelines come first because they drive the researcher's two real decisions.

| Visualization | Where it lives | What it answers | D3 pieces | Priority |
| --- | --- | --- | --- | --- |
| Evidence trail | Piece view | What should I do about this piece? | Time and band scales, axis, data join, SVG pattern and gradient | Build |
| Gap closing on confirm | Piece view, then barcode | What changed when I acted? | Keyed join, transition | Build |
| Certainty bars | Collection table | How complete is each history? | Stack | Build |
| History barcode | Collection view | Which piece should I open first? | Time and band scales, data join | Build |
| Gap histogram | Above the barcode | When does history go missing across the collection? | Bin | Stretch |
| Brush to a time window | Trail and barcode | What happened in 1933 to 1945? | Brush, zoom | Stretch |
| Linked locator map | Piece view | Where did this piece travel, and where is that unknown? | Geo projection | Stretch |
| Collection map | Collection view | Where were works during a brushed window? | Geo projection, brush | Later |
| Dealer network | Collection view | Which dealers connect many works, and which of those have gaps? | Hierarchical edge bundling | Later |
| Flows between owners | Collection view | How did works move from collectors through dealers to museums? | Sankey plugin | Later |

### Linking rules

- **One shared selection:** the timeline, source text, inspector and later the map all read the same selected step from app state, not from inside D3.
- **Every chart is actionable:** clicking a gap opens its leads; clicking a suggestion opens match review; clicking a barcode row opens the trail; clicking a network bundle lists its artworks, each opening its trail.
- **Same encodings everywhere:** crisp, faded and hatched mean the same thing in every view.

### Dealer network, later

- **Why it fits:** in the "degenerate art" sales, four approved dealers handled most of the works confiscated from German museums, and their names recur most often in the surviving Nazi inventory ([The Art Newspaper](https://www.theartnewspaper.com/1997/05/01/revealed-what-happened-to-the-degenerate-art-in-germanys-museums-from-g-to-z)); one Lucerne auction in 1939 sold 126 confiscated works ([The Atlantic, via Yahoo](https://news.yahoo.com/persistent-crime-nazi-looted-art-110000109.html)). Hubs like these show up as thick bundles.
- **Practical data:** the Getty Knoedler and Goupil stock books record a seller and a buyer per transaction, so every row is already an edge.
- **Hierarchy:** role (collectors, dealers, auction houses, museums), then city or country, then the entity.
- **Cautions:** it drops time, so it pairs with the timelines; it depends on good name matching; a hub is not a verdict, so edges are labeled by what happened, not by implied guilt.
- **Reference:** [hierarchical edge bundling example](https://observablehq.com/@d3/hierarchical-edge-bundling).

For the pitch, a static image from a small slice of the Getty data makes the point in seconds: once names are matched, the same data reveals the networks artworks moved through.

## User flow

&#91;embedded content: researcher flow · main path, single-piece entry, review loop\]

The main path runs left to right; a claim or acquisition jumps straight to one piece, and each confirmed or rejected suggestion updates the trail.

### Collection import flow

&#91;embedded content: collection import · 7 steps, optional review, re-import\]

Import ends in a summary (records imported, screened out with reasons, flagged, empty, low-confidence) before the researcher reaches the list. A later re-import compares versions and flags only the claims whose sources changed.

## Entity map

&#91;embedded content: evidence model · 9 entities and how they relate\]

Claims sit between sources and events, so any part of the trail traces back to its document; a match links a name in a claim to a party, and a decision records the researcher's call.

## Data sources

Cleveland is the primary source: its Nazi-era filter gives a ready collection to screen, and its pre-split provenance steps make reliable trails. The MVP connects what is open and routes the researcher to what is not.

| Source | Format | Role | MVP approach |
| --- | --- | --- | --- |
| [Cleveland Museum of Art API](https://openaccess-api.clevelandart.org) | JSON, semi-structured | Starting record, Nazi-era filter | Live API |
| [Art Institute of Chicago API](https://api.artic.edu/api/v1/artworks) | JSON, free text | Optional: one messy paragraph as an extraction showcase | Live API |
| [Getty Provenance Index CSVs](https://www.github.com/thegetty/provenance-index-csv) | CSV | Dealer and auction transactions to match | Downloaded, searched locally |
| [German Sales catalogs](https://www.arthistoricum.net/en/subjects/thematic-portals/german-sales/digitized-auction-catalogs) | PDF, OCR | Auction appearances, scanned evidence | One or two real pages |
| Wikidata and Getty ULAN | Linked data | Matching name variants | Small cached set |
| Lost Art, Proveana, CCP property cards | Web databases, scans | Where to look for gaps | Research leads with links |

The Getty transcriptions double as an answer key for measuring AI extraction accuracy.

### Demo pieces

- **Known-answer case:** Frans Hals, Portrait of Tieleman Roosterman (1634), confiscated by the Nazis from Baron Nathaniel von Rothschild, returned to the family by Austria in 1999, then sold to Cleveland that year ([Artron](https://m-news.artron.net/20130531/n457065.html)). The tool should flag the seizure and still show restitution and a legitimate sale, not simply label it red.
- **Famous works for recognition:** candidates from Cleveland's highlights, such as Caravaggio, Monet, Van Gogh and Turner. Verify each record first; ideal for showing a clean trail or an automatic screen-out.
- **One real gap for the core demo:** a lesser-known work from the Nazi-era filter, such as Jean Bernard Restout's Sleep, discussed by a provenance researcher ([Open Art Data](https://www.openartdata.org/search/label/Stiebel)). Check its current record.
- **Cautions:** never attach invented findings to real works; show suggested findings with their reasons; use only public-domain images; Cleveland's own research notes that gaps do not necessarily indicate plunder ([Cleveland Museum of Art](https://www.clevelandart.org/articles/provenance-research)).

### Extraction nuances to handle first

- **Life dates beside names:** "(1849-1941)" is the owner's life, not the ownership period.
- **Punctuation means something:** a semicolon is a direct transfer; a period is an unknown link. Conventions vary by museum (brackets or parentheses for dealers).
- **Approximate dates:** "by 1928", "c. 1907" and "?-1916" keep their precision; never turn them into exact years.
- **Bracketed notes:** "\[invoice; copy in curatorial object file\]" is an evidence pointer, not an owner.
- **Empty or truncated text:** empty provenance is marked, never treated as complete; always fetch the full record.
- **Names:** variants, business renamings, married names, couples as one step, and "private collection" as a hidden gap.
- **Conflicts:** keep both claims when sources disagree and flag the conflict.
- **AI risks:** removing uncertainty, inventing details, merging different people; every suggestion links to its source span and stays unconfirmed until reviewed.

## Technical approach

- **Technical bet:** ranked entity matching goes deep, because it is a design problem with a technical core: explainable reasons, strength bands instead of fake precision, and a confirm or reject step that records who decided and why. Extraction stays simple but real: punctuation rules plus AI for names, with a small accuracy check on hand-labeled records.
- **Architecture:** one codebase, modules around a shared evidence model (extraction, matching, evaluation, researcher app, visualization lab).
- **Build sequence:** lock the UI and flow, write the data contract, hand-write one real Cleveland record in that format, build the UI against it, build the pipeline to the same format, then swap in pipeline output.
- **Vertical slice:** one complete path through every layer, designed whole and built thin; say plainly what was automated and what was done by hand.
- **Process:** Matt Pocock's skills for planning, TDD on the matching rules, and the entity map as the shared vocabulary in code and interface.
- **AI use:** in the process, adapting D3 examples and writing code, with prompts and overrides logged; inside the product, suggestions only, never final. Constrained chart generation is a later idea.

**D3 pieces**

| Use | D3 piece | Reference |
| --- | --- | --- |
| Steps positioned in time | Time scale | [d3-scale: time](https://d3js.org/d3-scale/time) |
| Lanes and barcode rows | Band scale | [d3-scale: band](https://d3js.org/d3-scale/band) |
| Year labels | Axis | [d3-axis](https://d3js.org/d3-axis) |
| Click a step, see its source | Data join | [joining](https://d3js.org/d3-selection/joining) |
| Gap closes on confirm | Transition | [d3-transition](https://d3js.org/d3-transition) |
| Focus on 1933 to 1945 | Brush | [d3-brush](https://d3js.org/d3-brush) |
| Certainty bars | Stack | [d3-shape: stack](https://d3js.org/d3-shape/stack) |
| Gap histogram | Bin | [d3-array: bin](https://d3js.org/d3-array/bin) |
| Hatching and fading | SVG pattern and gradient | [pattern](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/pattern), [linearGradient](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient) |
| Dealer network, later | Hierarchical edge bundling | [example](https://observablehq.com/@d3/hierarchical-edge-bundling) |

Rule of thumb: positioned by data, use D3; laid out like a document (tables, forms, inspector, text highlights), use HTML.

## Design principles

- **Make silence visible.** Gaps and unnamed former owners are prominent blocks, never empty space.
- **A gap is a question, not a verdict.** Gaps look visible, not alarming.
- **Every claim is one click from its source.** Store what a source says apart from what is believed.
- **AI output never looks final.** Suggestions look different until a person confirms them.
- **Absence is labeled honestly.** "No records found" says coverage is limited, never that a record is clean.
- **Every view leads to an action.** If people can't act from a chart, it is a picture, not a tool.
- **Restraint in tone.** Holocaust-related material calls for calm visuals, not flashy effects.

## Build roadmap

The 3-hour cap covers the build; keep a time log and a decision log throughout.

1. **Lock the plan:** review this doc and the prototype; confirm the personal why.
2. **Set up:** project, coding agent, Matt Pocock's skills, time and decision logs.
3. **Data:** pick the demo pieces from Cleveland, check the real API fields and acquisition years, write the data contract.
4. **Fixture:** hand-write one real record in the contract format.
5. **Interface:** collection view (barcode and table), then the piece view (trail, source text, inspector, match review, add evidence, decision), applying the visual direction.
6. **Extraction:** punctuation rules plus AI for names; score against a few hand-labeled records.
7. **Matching:** ranked candidates with reasons and bands, precomputed.
8. **Swap and test:** replace the fixture with pipeline output; watch one person use it and fix one thing.
9. **Deploy:** live link on precomputed data, no API keys, checked in a private window.
10. **Pitch materials:** diagrams (architecture, entity map, user flow, now-next-later), slides if used, and the script.
11. **Video:** under 3 minutes, unlisted on YouTube.
12. **Submit, then prepare** for the live conversation.

**Cut order if time runs short:** search, research leads, layer toggles, filters, the histogram. Never cut the trail or match review.

## Scope

- **In the slice:** a small Cleveland collection (the Hals case, a few famous works, one real gap), collection barcode and table, piece view with evidence trail, source highlighting, match review, add evidence to a gap, decision and history.
- **Stretch:** gap histogram, brush on the timeline, linked locator map, the visual pass (wall-label titles, larger images), one Story mode screen.
- **Later:** collection map, Story mode for visitors, dealer network, Sankey of flows, family search, source change detection, constrained chart generation, open-source release of the pipeline and entity model.
- **Out:** 3D gallery, shaders, live AI calls in the demo, full ingestion of closed archives, accounts.

## Pitch and video

**Intro draft:** "Provenance is part art history, part detective work: tracing where a painting has been, owner by owner. But the clues are scattered across dozens of archives, and a twenty-year gap can hide in a single period. So I built the case board: a tool that pulls the evidence together, makes what's missing impossible to overlook, and shows where to look next."

**Structure, under 3 minutes:**

1. **Why:** personal curiosity, the stakes, the detective framing.
2. **Approach:** architecture image, shared model, Art Tracks as prior art, what I cut and why, Matt Pocock's skills in the process.
3. **Demo:** a researcher screens a collection, opens a flagged piece, sees the gap, confirms a match, the gap closes, records a decision.
4. **AI judgment:** accuracy check results, where AI failed, how the design catches it, what was automated versus done by hand.
5. **Next:** a now-next-later roadmap image, including Story mode and the dealer network.

**Wrap-up draft:** "The tool doesn't close the case. It makes sure no one overlooks the question. And because every step is sourced and reviewed, the same trail could one day show a museum visitor like me where a painting has really been, gaps included."

**Success looks like:** a reviewer can say in one sentence what problem I solved and why I care, what I built and that it works, the hardest design decision, how AI helped and where I stepped in, and what comes next.

## Expert outreach

A reply before Friday is unlikely, so the build does not wait for it; a later reply still helps in the live interview.

- [ ] Email Carnegie Museum of Art today; ask for whoever handles provenance research and mention Art Tracks
- [ ] Call the main line the same day and ask to be routed to curatorial or collections
- [ ] Optionally visit and leave the same message in writing
- [ ] Follow up once on Thursday morning
- [ ] Backups: university art history faculty or grad students, a library art reference desk, recorded Art Tracks symposium talks

**Three questions:**

1. When you research one artwork, where do you look first, and what slows you down most?
2. How do you decide when a gap needs further investigation?
3. If a tool showed an artwork's trail with gaps and suggested sources, what would make you trust it, and what would make you ignore it?

## Real-world limitations

- **Access:** much evidence is on paper or restricted; "no records found" usually means not digitized.
- **Data changes:** records are revised and APIs drift, so sources are versioned and dependent claims flagged.
- **Legal and ethical stakes:** outputs could reach disputes; naming people needs care; a well-connected dealer is not a verdict; the tool could be misused to fabricate histories.
- **Adoption:** museums have collection systems, small teams and slow procurement; standalone tools risk becoming another silo.
- **Realistic paths:** an open-source tool and data model, a grant-funded public good for small museums, or an integration inside existing systems.

## Open questions

- **Lecture details:** confirm the speaker's role and work before mentioning it.
- **Demo records:** verify the Hals record, the famous candidates and the gap case in Cleveland's current data, including image licenses.
- **API fields:** confirm field names and whether accession numbers reliably carry the acquisition year.
- **Art Tracks:** confirm how this differs, ideally with a researcher.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Overscoped for 3 hours | Vertical slice; precomputed data; cut in the stated order |
| Matching is hard to get working | Narrow to a few names; precompute candidates; put effort into the review interface |
| Real data breaks the design | Build the UI against one real record first |
| Implying a real work was looted | Only real provenance text; suggestions shown with reasons; no invented findings |
| Image rights | Public-domain works only |
| Live demo breaks for reviewers | Static data, no API key; test links in a private window |
| Overlap with Art Tracks | Credit it; frame the cross-source, gaps and actions angle |
| Heavy subject, flippant framing | Detective framing used once; calm visuals |

## Other materials

Diagrams and documents from the planning conversation, collected in one place. The [User flow](#mnv4jernveg.17530) and [Entity map](#mnv4jernveg.17688) diagrams live in their own sections above; the AI approach is in its own doc, [AI-Built Custom Visuals: Approach](https://claude.ai/artifact/7FjhKy85n1RDzm4GwPau3K).

The [clickable prototype](https://claude.ai/artifact/2Qvt6A5SiwCMGLQqb97ABJ) shows the home, import, list, piece and sources screens with sample data; its layout (timeline with a side inspector) and two-field status are the decisions above.

### UI prototype snapshots

Sample data throughout; rendered with a fallback font, so type differs slightly from the live prototype.

**Collections home:** review progress per collection, and import.

&#91;image: Collections home\]

**Import, step 1:** choose a source, name the collection, see the screening criteria.

&#91;image: Import step 1\]

**Import summary:** counts, screened-out works with reasons, and items that need a check.

&#91;image: Import summary\]

**Collection list:** the screening queue with certainty bars, work status and finding.

&#91;image: Collection list\]

**Piece view, gap selected:** the evidence trail with the 1933 to 1945 band, source text, and leads for the gap.

&#91;image: Piece view with the gap selected\]

**Piece view, match review:** ranked candidates with reasons and strength bands.

&#91;image: Piece view with match review\]

**Piece view, match confirmed:** the ledger record turns solid and the gap shrinks to 1931 to 1949.

&#91;image: Piece view after confirming the match\]

**Sources:** each archive, its format, and how reachable it is.

&#91;image: Sources\]

### Use case: one artwork to one evidence trail

&#91;embedded content: use case · read bottom to top\]

Read from the bottom up: the museum record already has a gap, archives fill part of it, and what stays unknown becomes a research lead.

### Researcher workflow mapped to product views

&#91;embedded content: workflow to views · 5 stages\]

Each research stage on the left is supported by one view on the right, from screening a collection down to a decision on one piece.

### Toolkit architecture

&#91;embedded content: toolkit architecture · one codebase, modules around a shared model\]

The extraction pipeline, matching engine, researcher app and visualization lab are modules in one codebase; the shared evidence model is what connects them, and the evaluation harness keeps the rules honest.

## Sources

[CNN](https://edition.cnn.com/2019/04/21/us/nazi-stolen-art-returned) · [WJRO](https://wjro.org.il/?p=14626) · [Hyperallergic](https://hyperallergic.com/value-of-looted-objects-at-met-museum-tops-95m-after-new-seizures/) · [ARTnews](https://www.artnews.com/art-news/news/report-buhrle-foundation-provenance-research-not-sufficient-kunsthaus-zurich-1234711068) · [Getty Provenance Index CSVs](https://www.github.com/thegetty/provenance-index-csv) · [Cleveland API](https://openaccess-api.clevelandart.org)

[Carnegie Magazine on Art Tracks](https://alltogether.carnegiemuseums.org/?p=6033) · [AAM on Art Tracks](https://aam.mydigitalpublication.com/july-august-2016/page-39) · [Teaching Provenance to AI](https://opus.bibliothek.uni-augsburg.de/opus4/files/125703/125703.pdf) · [D3](https://d3js.org/) · [Palantir custom widgets](https://www.palantir.com/docs/foundry/custom-widgets)

[Cleveland Museum of Art, provenance research](https://www.clevelandart.org/articles/provenance-research) · [Artron on the Hals painting](https://m-news.artron.net/20130531/n457065.html) · [Open Art Data](https://www.openartdata.org/search/label/Stiebel) · [Hierarchical edge bundling](https://observablehq.com/@d3/hierarchical-edge-bundling)

## Appendix: superseded drafts

Earlier versions kept for reference. The sections above replace them.

**Deadline:** Friday, October 30, about 3 p.m., assumed from "within 7 days" of the Friday 3 p.m. email. Target submission Friday morning.

**Open before building:** the personal reason this problem matters to me (see Open questions).

### Solution

Three views, each answering one question the researcher has.

1. **Evidence trail: where has it been?** One ownership timeline across all sources. Each step is marked confirmed, approximate ("by 1958") or unknown, and clicking it highlights the exact source phrase, ledger row or scanned page region.
2. **Gaps and conflicts: what is missing or wrong?** Missing periods, contradictions between sources, and any gap or transfer in 1933 to 1945 are flagged and shown as visible blocks on the timeline.
3. **Research leads: where should I look next?** For each gap, a suggested archive and why, with a pre-filled search link, naming the specific dealer, catalog or year range where possible. This shortens the path to closed archives; it does not remove the barrier. The researcher confirms, rejects or edits each finding, and the trail updates.

### Visualization and AI approach

AI speeds up custom visuals in the build; inside the product, generation stays constrained or waits for later.

**Visual inspirations from [D3](https://d3js.org/):**

- **Swimlane timeline** (from the world history timeline example): one lane per source, so agreement lines up and conflicts show as misalignment.
- **Gradient encoding for uncertainty:** approximate dates fade in; confirmed dates have crisp edges; gaps are hatched blocks.
- **Brushing:** select a time window; the 1933 to 1945 band is pre-shaded.
- **Normalized stacked bars:** confirmed, approximate and unknown share per artwork, sorted into a triage queue (teaser).
- **Later:** Sankey of artworks through dealers, histogram of gap years, arc diagram, dealer network.

**How AI is used:**

1. **In the process (do fully):** AI adapts D3 examples into the custom trail; the video shows prompts, before and after, and where I stepped in.
2. **In the product (stretch only):** constrained generation, where a request like "gaps by dealer" picks from my chart types and fills parameters, never arbitrary code. Attempt only after the trail works; cut research leads to make room.
3. **Skip:** shaders and other effects that do not encode meaning; a CSS gradient carries uncertainty.

**Build note:** D3 for the trail only; Observable Plot or plain HTML for simpler charts.

### Implementation plan

The build fits the 3-hour cap by precomputing a small set of artworks and giving the evidence trail the most time. Expert calls and data hunting during the project count toward the cap.

**Schedule**

- [ ] **Wednesday:** send the museum email and call; answer the five Ws to settle the personal why; lock the reduced scope
- [ ] **Thursday:** the 3-hour build; if no expert has replied, test with whoever is available and say so in the video
- [ ] **Friday morning:** record the video, upload as unlisted, check both links in a private window, submit well before 3 p.m.

**The 3 hours**

1. **Frame and pick artworks (0:00 to 0:20).** Write the user, problem and success criteria. Pick about 5 artworks via Cleveland's Nazi-era filter, one with a Getty match and one scanned page. Cap the search at 15 minutes.
2. **Label for evaluation (0:20 to 0:35).** Hand-label about 5 museum provenance texts as ground truth. Use the Getty transcription only to check the scanned-page extraction.
3. **Pipeline, precomputed (0:35 to 1:10).** Extract events from museum text with an LLM; normalize dates; match Getty records by simple name and title; align one scanned page by hand. Save results as static data so the live demo needs no API key. Run the eval and log failures.
4. **Evidence trail view (1:10 to 2:15).** Swimlane timeline adapted from D3 with AI help: gradient-encoded uncertainty, hatched gaps, shaded 1933 to 1945 band, click-to-source.
5. **Research leads and review (2:15 to 2:30).** Simple rule-based leads per gap; confirm, reject or edit controls.
6. **Test with one person (2:30 to 2:45).** Ideally a provenance researcher; otherwise the closest available person. Note one change.
7. **Iterate and tighten (2:45 to 3:00).** Fix what the test showed; check the deployed link.

In the video, state which steps were automated and which were done by hand.

### Build roadmap

This is a showcase of building skills, not a market product: a real user (the provenance researcher) keeps design decisions grounded, without needing a business case. Each step gives a suggestion and leaves the decision open.

1. **Lock the framing.** Settle the personal why and the user.
   - Suggested: lead with curiosity about where a piece has been, with the guest lecture as one line on stakes; user is a researcher doing a systematic collection review.
   - Your call: whether single-piece entry (a claim or acquisition) is also in scope.
2. **Choose one technical bet.** Only one part can be deep in 3 hours.
   - Options: evaluated extraction, ranked entity matching with visible reasons, or a versioned evidence model.
   - Suggested: evaluated extraction as the core, with light ranked matching on top.
   - Your call: which bet best shows the skills you want to be judged on.
3. **Define the data model.** Decide the things the system tracks and how they relate.
   - Suggested: artwork, party (person or organization), event, source, claim, gap and decision; store what a source says apart from what is believed.
   - Your call: adopt the traffic-light classification as-is, a variant, or your own status scheme.
4. **Choose and prepare the data.** Pick the collection and the small set to precompute.
   - Suggested: Cleveland's Nazi-era filter, about 5 artworks, one with a Getty match and one scanned page.
   - Your call: which museum, how many artworks, and whether to include a scan at all.
5. **Build the extraction.** Turn provenance text into structured events, measured against hand labels.
   - Suggested: a hybrid, with rules for the AAM punctuation signals (semicolon for direct transfer, period for unknown link), dates and "possibly" or "probably", and an LLM for names and roles.
   - Your call: rules, LLM or hybrid, and how many texts to label.
6. **Link and match entities.** Connect names across sources.
   - Suggested: candidate matches with visible reasons (name, dates, place, shared dealer), rough bands rather than precise scores, and a confirm or reject step that records who decided and why.
   - Your call: how much to automate versus leave for the researcher.
7. **Design the views.** Collections home, collection list as the screening queue, piece evidence trail, and a sources page.
   - Suggested: give the evidence trail the most depth; treat gaps as normal but visible, not alarming; one visual language for confirmed, approximate and unknown.
   - Your call: which view gets the polish, and how status and notes work.
8. **Build the interface.** Pick the stack and the AI workflow.
   - Suggested: a static web app on precomputed data, D3 adapted with AI help for the trail, plain HTML or Observable Plot for lists.
   - Your call: framework, hosting, and which AI tools to use for which tasks.
9. **Test with one person.** Watch someone use it and change one thing.
   - Suggested: a provenance researcher if one replies, otherwise the closest available person, named honestly.
   - Your call: what task to give them.
10. **Package and tell the story.** Deploy, record and submit.
    - Suggested: keep a decision log and AI failure notes throughout; they become the video script.
    - Your call: which moments make the cut in 3 minutes.

### Scope

- **In:** about 5 precomputed artworks, one golden thread with a Getty match and one hand-aligned scanned page, the evidence trail, gaps, simple research leads, the review step.
- **Stretch:** one constrained AI-generated chart, only after the trail works, replacing research leads if time is short.
- **Out:** map view, 3D gallery, shaders, full ingestion of closed archives, live AI calls in the demo, accounts and sharing.
- **With more time:** collection-wide triage queue, dealer network and Sankey views, family search mode, open-source release of the pipeline and entity model.

### Success criteria and video plan

**Success looks like:**

- A researcher can see an artwork's full public trail and its gaps in under a minute.
- Every claim links to its exact source.
- Extraction accuracy is measured against the Getty answer key and shown.
- One real tester's feedback led to one visible change.

**3-minute video:**

1. **Why (0:00 to 0:30):** my personal reason, then the access problem in one stat.
2. **Approach (0:30 to 1:15):** pipeline, entity model, Art Tracks as prior art and what is different, what I cut and why.
3. **Demo (1:15 to 2:15):** artwork in, evidence trail out, a gap becoming a lead.
4. **AI judgment (2:15 to 2:40):** eval results, where AI failed, how the design catches it, what was automated versus by hand.
5. **Next (2:40 to 3:00):** what I would build with more time.

### Open questions

- **Personal why:** why does provenance matter to me? Answer the five Ws; if no real reason exists, reconsider the angle or pick another art problem.
- **Deadline:** confirm the Friday 3 p.m. assumption if anything is unclear.
- **Differentiation:** confirm how this differs from Art Tracks.

### Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| No genuine personal why | Settle it Wednesday; change the angle if needed |
| Overscoped for 3 hours | Precompute about 5 artworks; protect an hour for the trail; cut leads before the trail |
| Golden thread hard to find | Cap the search at 15 minutes; fall back to museum record plus one Getty match |
| AI extraction is unreliable | Lean on the review step; show failures and eval results as a design insight |
| Live demo breaks for reviewers | Static precomputed data, no API key; test links in a private window |
| Overlap with Art Tracks | Credit it; frame the cross-source, gaps and leads angle |
| No expert reply in time | Test with the closest available person; say so honestly |
| Niche or heavy topic | Open with one stat and one human story; keep visuals restrained |
| Licensing varies by dataset | Check each README; credit the Getty and museums |
