# Design direction

Mood and tone: Swiss, modernist, restrained. Palantir's Blueprint (`@blueprintjs/core`) supplies the components (Navbar, Tabs, Tag, Button, Callout, HTMLTable, Card); the look below overrides Blueprint's defaults through CSS variables. Reference image: grayscale panels, black type, one red accent.

## Palette

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F0EDE6` | `#151515` | page background |
| `--panel` | `#E6E6E3` | `#1F1F1F` | panels, cards, grid fields |
| `--rule` | `#CFCFCB` | `#3A3A38` | hairlines, grid |
| `--ink` | `#1A1A1A` | `#ECEAE4` | text, dots, strong marks |
| `--muted` | `#6E6E6A` | `#9A9A94` | secondary text |
| `--red` | `#CC3529` | `#E0443A` | the accent: actions, arrows, key labels, the 1933 to 1945 band |

Red is an accent, never a verdict: flat fills and fine strokes only, no alarm styling (a gap is a question). Other colors are allowed in charts and annotations: use a muted categorical set for source lanes (loaded data, Cleveland, Getty) and say what each color means in a legend.

## Type

Large, bold grotesque for titles and numerals with tight tracking; system stack `"Helvetica Neue", Arial, sans-serif`. Artwork titles keep the gallery-label feel. Small, dense body text. Ghost numerals (years) are allowed as oversized, low-contrast background type.

## Patterns from the reference

- A red arrow beside a large label for the selected thing.
- Numbered columns (01, 02, 03) with a bold title and small text.
- Timeline: black dots on a thin black line, labels below.
- Thin vertical rules and a fine grid behind data fields.
- Flat geometry (circles, wedges), no gradients or shadows.

## Unchanged rules

Certainty by form (crisp, faded, hatched), not color. Origin always labeled. Rule output never looks final until a person accepts. Every claim one click from its source. Calm tone for Holocaust-related material. Works at phone width with 16px gutters and has a dark mode.
