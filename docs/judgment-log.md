# Judgment log

What AI produced, what I changed or rejected, and why. One entry per ticket.

## #2 Foundation: contract and the real Van Gogh through to the screen

- **Fixture is hand-decided.** I chose each of the 11 events and which words support each value. A throwaway script only computed character offsets against the real text, so a miscount could not slip in. A test now checks every claim's span against the raw snapshot.
- **`unknown` link types cite nothing.** The first draft cited an adjacent row for them, which supports nothing. The evidence for "link not stated" is the absence of linking words, so the contract exempts it from the citation rule.
- **Source record points at the raw snapshot instead of embedding it.** The PRD's table holds the payload; I kept the payload in one raw file and referenced it, so the per-table JSON stays small. Revisit if the ingestion ticket finds this awkward.
- **Alias grouping.** "Leonard C. Hanna, Jr" and "Leonard C. Hanna, Jr." are grouped under one party in the fixture. The glossary says an alias is linked only after a person accepts a match, so this shows the post-acceptance state; the match ticket (#6) is where acceptance becomes real.
- **Cleveland puts dates in a separate field** from the description, so claims cite spans in both `description` and `date`.
- **Browser check skipped.** The browser extension was not connected, so I rendered the page to HTML on the server and read it instead of looking at it.
- **Code review fixes.** The review caught two glossary mismatches that I had missed: I used `Dataset`, a term the glossary avoids, for the bundle of all tables (renamed `EvidenceModel`), and my precision list had drifted from the glossary (I added `range` and `after` and dropped `circa`). I kept `range` and `after` because the fixture needs them, restored `circa`, and updated the glossary to match. I left e-07 and e-08 as they are: their wide date range is how the fixture encodes the 1927 to July 1940 silence, and the gap ticket (#5) must make that explicit instead of reading it as continuous ownership.
