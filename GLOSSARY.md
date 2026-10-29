# Provenance Evidence Trail

A workspace that shows where an artwork's ownership history is missing, what the existing evidence says, and where to look next. A gap is a question, not a verdict.

## Language

### Evidence

**Source**:
A provider of evidence, such as the Cleveland Museum of Art or the Getty Provenance Index.
_Avoid_: Archive, dataset

**Source record**:
One raw record exactly as fetched from a source, with its URL, retrieved date and version.
_Avoid_: Entry, payload

**Collection**:
The set of artworks imported from one source in one run, with a snapshot date.
_Avoid_: Dataset, import

**Provenance step**:
One row of a source's provenance text, as written.
_Avoid_: Record, entry

**Claim**:
A pointer into a source record (field path and character span) to the words that support a value, with the method used and the certainty as stated.
_Avoid_: Fact, annotation

**Event**:
Our structured reading of one transfer of possession: from party, to party, date range with its precision, and place. It always cites claims.
_Avoid_: Step, entry, transaction

### Artworks and people

**Artwork**:
An individual work of art as held in a collection.
_Avoid_: Piece, work, object

**Party**:
A person or organization that appears in an artwork's history. It carries no fixed role; a role (dealer, collector, auction house, museum) belongs to a particular event.
_Avoid_: Owner, entity, person

**Party alias**:
A name for a party exactly as written in a claim. Linked to a party only after a person accepts a match.
_Avoid_: Variant, synonym

### Time and certainty

**Precision**:
How exactly a date is known: exact, range, by, until, after, circa or unknown. Never converted to an exact year.
_Avoid_: Accuracy

**Certainty**:
How firmly the source states an event: confirmed, approximate or unknown. Shown by form (crisp, faded, hatched), not color.
_Avoid_: Confidence, status

**Gap**:
A derived span of time in which no event says who held the artwork: a missing span between events, a "?" or undated step, or a hidden holder such as "private collection". Recalculated, never edited. A question, not a verdict.
_Avoid_: Hole, missing period, unknown owner

**Risk window**:
The years 1933 to 1945. A gap that overlaps it is in the risk window.
_Avoid_: Nazi years, danger zone

### Matching and next leads

**Match**:
A name as written paired with a candidate party, with reasons and a strength band, awaiting a decision.
_Avoid_: Link, merge

**Candidate**:
A possible party for a name, offered with reasons and a band.
_Avoid_: Suggestion

**Band**:
A coarse strength of a match (such as strong, possible, weak) used instead of a precise score.
_Avoid_: Score, confidence

**Suggestion**:
Possible evidence for a gap that the app holds, either from loaded data or cached from an external source. Always carries its origin, a preview, a link and a retrieved date.
_Avoid_: Recommendation, result

**Origin**:
Whether a suggestion comes from existing data or from an external source, and which one. Always labeled.
_Avoid_: Provider type

**Lead**:
A pre-filled search link to a source with no public API. Nothing is fetched, and it is never shown as a result.
_Avoid_: Suggestion

### Human judgment

**Decision**:
A person's call on a match or an added piece of evidence (accepted or rejected, with a note), attached to a stable ID. Distinct from an event's certainty.
_Avoid_: Confirmation, verdict

**Accept / reject**:
The two outcomes of a decision on a match. "Confirmed" is reserved for the certainty of an event.
_Avoid_: Confirm (for matches)
