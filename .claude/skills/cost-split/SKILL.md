---
name: cost-split
description: How to run any multi-step task in this repo for the best result at the lowest cost — implementing a feature or screen, adding states, a refactor, a review or audit, research across files, or anything touching more than ~3 files. Decides inline vs split, which model tier does each chunk, how chunks are briefed, verified, kept or reverted, and how the run is recorded. Use before starting such a task, even when the user doesn't mention cost.
---

# Cost-split

Best result for the least money. Two facts drive everything:

- **The main loop is the expensive part.** It re-reads the whole conversation every turn. Keep
  raw file dumps out of it — a worker reads, the main loop gets a 20-line summary.
- **Splitting buys quality, not savings.** Each worker starts cold. A split only pays when the
  chunks are real work and independent. A cheap model that needs three tries costs more than a
  strong one that needs one.

## Tiers

| Tier | Claude agent | Model | Codex | Does |
|---|---|---|---|---|
| strong | main session in plan mode, `advisor` | opus | top model | plan, split, write shared contracts, hard logic, final review |
| standard | `builder` | sonnet | default | implement one briefed chunk |
| cheap | `scout`, `chore` | haiku | mini | search and summarise; mechanical edits, run checks, screenshots |

Set `"model": "opusplan"` in `.claude/settings.json` (merge it; do not overwrite an existing file) — Opus while planning, Sonnet while executing. Call `advisor`
when execution hits hard logic, instead of guessing.

## 1. Inline or split

Do it **inline** (no state file, no workers) when it is ~3 files or fewer, or one tight change.

**Split** when there are 2+ chunks that each need real reading or writing. Then:

## 2. Run the loop

1. **State file** — write `.agents/runs/<YYYY-MM-DD>-<slug>.md`: goal, chunks, tier, status,
   failures. Update it as chunks finish. A new or compacted session resumes from it rather than
   re-exploring.
2. **Contract first** — if two writers will run in parallel, the strong tier first writes the
   shared types/props they both depend on.
3. **Briefs** — one per chunk, using the template below.
4. **Print the split** as a table (chunk → agent → files) and go. Ask first only if 5+ workers.
5. **Run.** Reads (`scout`, screenshots) run in parallel. Writes are guarded: one `builder` per
   coupled unit (an area's view + container + states is ONE unit). Parallel builders only on
   unrelated areas, or after step 2.
6. **Ratchet.** Before a write chunk starts, save its files (`cp` to the state folder, or
   `git diff -- <files>`). The worker runs its done-check. Pass → keep. Fail → one retry with the
   error in the brief. Fail again → restore the saved files and hand the chunk to `advisor`.
   Never a third retry. Never `git checkout` a file — it may hold someone's uncommitted work.
7. **Verify in a fresh context.** The writer never judges its own work. `chore` takes before/
   after screenshots of only the changed states; `advisor` (or the main session in plan mode)
   reviews the combined diff and the images.
8. **Lesson.** Append one line to `docs/knowledge/agent-loop-lessons.md` (create it on first use: date, task, what worked, what failed).
9. **Report** — what changed, check results, screenshot paths, what's left.

## Brief template

```
Goal: <one sentence, the outcome>
Repo: /Users/wunwan/provenance-palantir — cd there in every Bash call.
May edit: <exact paths>
Never edit: guards and checks (check scripts, tsconfig/lint config, CI),
  <files other chunks own>, files with someone's uncommitted edits unless listed above.
Rules: GLOSSARY.md vocabulary and docs/adr/*.md decisions; real data only; read CLAUDE.md for the tracker and docs layout.
Context: <the facts it needs, pasted — so it doesn't re-explore>
Done when: <the repo's typecheck passes and the linter is clean on your files>.
Return (≤ 20 lines): files changed, check output, anything you could not do. No code dumps.
```

## Verifiers

- Typecheck: `cd web && npx tsc -b`. Tests: `cd pipeline && uv run pytest -q` and `cd web && npm test`.
- Linter: `cd web && npx oxlint <files touched>` (web only); never auto-fix across the whole repo.
- Screenshots (macOS Chrome path; adjust for your OS): `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless
  --disable-gpu --hide-scrollbars --window-size=1440,900 --virtual-time-budget=12000
  --screenshot=<out.png> "<url>"` against the already-running dev server (find its port with
  `lsof -iTCP -sTCP:LISTEN | grep node`; don't start another). Point it at the page(s) the chunk changed.

A check is never edited to make it pass.

## Anti-patterns

- Splitting a 2-file fix.
- Two writers on coupled code without a contract.
- A worker re-exploring the repo because the brief left out context.
- Editing a guard, check or tsconfig so a chunk passes.
- A third retry on the same tier.
- The main loop reading whole files a scout could have summarised.

## Improving this skill

When `docs/knowledge/agent-loop-lessons.md` has ~10 lines since the last `— reviewed` marker,
propose concrete edits to this skill to the user. Don't edit it without their OK.
