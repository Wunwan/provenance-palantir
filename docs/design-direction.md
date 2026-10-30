# Design direction

Revised 2026-10-29 from three references: a dark museum app (Louvre page), the British Museum "8 million objects" board, and an "Archive" grid. The earlier Swiss/warm-paper direction is superseded. Structure borrowed from Harvard's Cognitive Aesthetics Media Lab site (camlab.fas.harvard.edu): browse the same objects by Theme, Location and Timeline.

## Mood

A dark gallery at night. The works are the light source: real images of the paintings on near-black, small museum-label captions, thin rules, one red accent. Quiet, archival, unhurried. Calm tone for Holocaust-related material. Blueprint (`@blueprintjs/core`) stays as the component base, themed through the tokens below.

## Palette (dark is the default; light follows `prefers-color-scheme: light`)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--paper` | `#141416` | `#F0EDE6` | page |
| `--panel` | `#1F2023` | `#E6E6E3` | cards, fact boxes |
| `--panel-2` | `#2A2B2F` | `#DADAD6` | raised cards, hover |
| `--rule` | `#34353A` | `#CFCFCB` | hairlines |
| `--ink` | `#ECE9E2` | `#1A1A1A` | text |
| `--muted` | `#8D8D90` | `#6E6E6A` | captions, secondary text |
| `--red` | `#E0443A` | `#CC3529` | the one accent: dots on rules, links, "read more", selected state |
| `--cream` | `#EDE6D8` | `#1A1A1A` | the single filled button, as in the Archive reference |

Red is an accent, never a verdict: small dots, thin strokes and link text, no alarm fills. Other colors appear only inside the journey chart, with a legend.

## Type

- Titles and artwork names: a text serif ("Source Serif 4"; fallback Georgia). View titles may be italic.
- Section heads and labels: monospace, uppercase, tracked ("IBM Plex Mono"; fallback ui-monospace), as in the Archive reference.
- Body, captions, numerals: a clean sans ("Inter"; fallback system-ui). Big numerals stay light and tabular.

## Patterns from the references

- Image first. Each artwork is its real image on the dark ground, with a caption underneath: muted line for the title or type, bright line for artist and date (British Museum style).
- Collection as a grid of image cards: image, thin rule, mono caps title, one small line of text (Archive style). Browse by Rank, Timeline or Location.
- Artwork page: large image at the top, serif title, a boxed row of three facts (Louvre "Founded / Paintings / Location") for Accession, Created and Open years 1933 to 1945.
- Numbered sections (01, 02, 03) with a mono title and a thin rule that ends in a small red dot.
- One filled cream button for the primary action; everything else is outline or text.
- Rounded cards (8px), flat, no gradients or shadows.

## Unchanged rules

Certainty by form (crisp, faded, hatched), not color. Origin always labeled. Rule output never looks final until a person accepts. Every claim one click from its source. Works at phone width with 16px gutters.

## Revision 2: CAM Lab structure (2026-10-29)

Measured from camlab.fas.harvard.edu (About page): ground `#0D0D0D` to `#1C1C1C`, a full-bleed cinematic hero with no frame, one light-weight sans (Benton Sans) at large sizes, editorial rows with the section label in a narrow left column and a large light headline plus short-line body in a wide right column, full-width white hairlines between rows, generous space, no cards or boxes, no accent color, tiny top-left nav beside a serif wordmark. This revision overrides the earlier patterns where they conflict.

- **Type:** a light-weight sans for everything ("Hanken Grotesk" 300/400, a close open match for Benton Sans; fallback system-ui). Large headlines at weight 300 with tight tracking. The serif survives only for artwork titles and the nav wordmark. Mono is kept only for small captions and numbers (01, 02), not for section heads.
- **Rows:** every section is a row: hairline across the full width, a left column (about 1/5, large light label with its number), a right column (headline, then body at about 60ch).
- **Hero:** the artwork image runs edge to edge at the top, no panel, no rounded corners; the caption sits quietly below it.
- **Flat:** no cards, no fact boxes, no filled panels. Facts are plain rows with a hairline between them. Collection images sit directly on the black, with captions underneath.
- **Accent:** red shrinks to a small dot and the pressed/selected state; link hover may use it. The one filled button (Accept) is charcoal with white text and a thin white border.
- **Motion:** none needed; an optional fade-in of the hero is fine, and respect reduced motion.
