---
phase: 46-final-cleanup
plan: 04
subsystem: gameplay-data
tags: [csv-pipeline, player-pool, bench, substitution, socket.io, prettier]

# Dependency graph
requires:
  - phase: 40-substitutions
    provides: applySubstitution engine guards, BenchEntry shape, subsUsed/addedTimeBonus lifecycle
provides:
  - Two generic 5-player placeholder bench rosters (generic-bench-home / generic-bench-away) seeded through the existing CSV → teams.ts pipeline
  - getGenericBenchPlayers(side) lookup in teamConfig.ts mirroring getSquadPlayers
  - Standard (non-Draft) rooms now broadcast a 5-player available bench per side instead of an empty array
  - seed-rosters.ts generator output now formatted through prettier so it is byte-for-byte reproducible against the committed file
affects: [substitution-ux, roster-authoring, lineup-assignment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSV-first data seeding: new player-pool rows always appended last so p-ID assignment for existing players never shifts"
    - "numberOffset parameter on buildSquadEntries for jersey-number ranges above the 1-11 starting-XI range"
    - "Generator scripts that emit committed TypeScript source format their own output through prettier's format() API (resolveConfig against the target file) to stay byte-identical with the repo's pre-commit hook"

key-files:
  created: []
  modified:
    - packages/shared/src/data/player-pool.csv
    - packages/shared/scripts/seed-rosters.ts
    - packages/shared/src/teams.ts
    - packages/shared/src/teams.test.ts
    - packages/shared/src/teamConfig.ts
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/lineupAssignment.integration.test.ts
    - packages/server/src/__tests__/substitution.integration.test.ts

key-decisions:
  - "CSV route (not a teams.ts hand-edit) for the new bench data, per Open Question 3 in 46-RESEARCH.md — teams.ts carries an AUTO-GENERATED header and any hand-edit would be destroyed by the next seed:rosters run"
  - "GENERIC_BENCH_NUMBER_OFFSET=11 forces the two generic bench groups to jersey numbers 12-16, structurally preventing collision with the starting XI's 1-11"
  - "Bench-stat values chosen so every generic bench player's 9-stat total lands in 24-30 (common/uncommon tier), never rare (31) or chase (32+)"
  - "seed-rosters.ts now formats its raw output through prettier before writing — closes a pre-existing latent gap where the committed file (post pre-commit-hook) differed from the raw generator output by 3 lines (two apostrophe-name quote styles plus a trailing comma), which nothing had previously exercised because no phase had regenerated + diffed teams.ts and committed within the hook flow before"

requirements-completed: [CLEANUP-05, CLEANUP-13]

# Metrics
duration: ~35min (session interrupted and resumed once by an unrelated API/quota error; work continued from git-staged state with no rework)
completed: 2026-08-29
---

# Phase 46 Plan 04: Generic Placeholder Bench for Standard Rooms Summary

**Two 5-player generic bench rosters (p189-p198, jersey numbers 12-16) seeded via the CSV pipeline and wired into standard-room bench construction so substitution works end-to-end outside Draft mode, with a zero-diff engine surface.**

## Performance

- **Duration:** ~35 min of active work (session was interrupted mid-plan by an unrelated API/quota error between Task 1 and Task 2; resumed cleanly from git-staged state per coordinator instruction)
- **Completed:** 2026-08-29
- **Tasks:** 2/2
- **Files modified:** 8

## Accomplishments

- `PLAYER_POOL` grew from 188 to 198 entries: `p189`-`p193` = `generic-bench-home`, `p194`-`p198` = `generic-bench-away`, each group covering GK/DEF/MID/FWD/ST exactly once, jersey numbers 12-16
- `getGenericBenchPlayers(side)` added to `teamConfig.ts`, mirroring `getSquadPlayers`'s one-line filter shape
- Standard (non-Draft) rooms now broadcast a 5-player `available` bench per side at the exact D-08 injection site, replacing the previously-always-empty array — with zero changes to `gameEngine.ts` (`applySubstitution`'s existing guards already treat a generic bench player identically to any other `PoolPlayer`)
- Fixed a pre-existing gap (not part of the original plan text, but a blocking acceptance-criterion issue): `seed-rosters.ts` now formats its own generated output through prettier before writing, so `teams.ts` is genuinely byte-for-byte reproducible by `pnpm run seed:rosters` even across the repo's pre-commit hook

## Task Commits

Each task was committed atomically:

1. **Task 1: Seed two generic 5-player bench rosters through the existing CSV pipeline** - `72feff4b` (feat)
2. **Task 2: Hand the generic bench to standard rooms at game-state construction** - `1ce4ca54` (feat)
3. **[Rule 3 deviation] Format seed-rosters.ts generator output through prettier** - `1acdfadc` (fix)

**Plan metadata:** _(this commit — SUMMARY.md + REQUIREMENTS.md)_

## Files Created/Modified

- `packages/shared/src/data/player-pool.csv` - 10 new rows appended last (5 `generic-bench-home`, 5 `generic-bench-away`), one row per role, nationality `United States`, no `PoolTag`
- `packages/shared/scripts/seed-rosters.ts` - `GENERIC_BENCH_SLUGS` + `GENERIC_BENCH_NUMBER_OFFSET=11`; `numberOffset` param on `buildSquadEntries`; `EXPECTED_TOTAL` 188→198; header p-ID range comment updated; output now formatted through prettier before `writeFileSync`
- `packages/shared/src/teams.ts` - regenerated, 198 entries; also incidentally normalized 2 pre-existing apostrophe-name quote-style drifts (`N'Golo Kante`, `Liam O'Conner`) between the script's raw output and the previously committed file
- `packages/shared/src/teamConfig.ts` - `GENERIC_BENCH_HOME_TEAM_ID`, `GENERIC_BENCH_AWAY_TEAM_ID`, `getGenericBenchPlayers(side)`
- `packages/shared/src/teams.test.ts` - count/last-id assertions updated to 198/`p198`; new `getGenericBenchPlayers` describe block (per-side/per-role coverage, jersey-number range, tier classification, `resolvePoolPlayers` leakage guard)
- `packages/server/src/roomHandlers.ts` - standard-room bench branch: per-side fallback to `getGenericBenchPlayers` when the squad remainder is empty; squad-remainder path kept live; D-12 comment replaced with a Phase 46 comment citing D-05 through D-09
- `packages/server/src/__tests__/lineupAssignment.integration.test.ts` - rewrote the Phase 40 D-12 empty-bench test to assert the new 5-entry-per-side bench shape
- `packages/server/src/__tests__/substitution.integration.test.ts` - rewrote the D-12 empty-bench-rejection test into an end-to-end proof of a generic bench outfielder substituting onto the pitch, plus a GK-parity rejection assertion

## Chosen Bench Data (recorded per plan `<output>` instruction)

**p-ID ranges:** `generic-bench-home` → `p189`-`p193`; `generic-bench-away` → `p194`-`p198` (confirmed from the actual generated `teams.ts` output, not assumed).

**Stat values per placeholder player** (pace/dribbling/highPass/resilience/shooting/tackling/aerialAbility/saving/handling as authored in the CSV; GK highPass is forced to 0 and GK shooting/tackling are floored to 1 by the existing `parseRow` GK-override logic regardless of the CSV value):

| Role | CSV pace/dribbling/highPass/resilience/shooting/tackling/aerialAbility/saving/handling | Post-processing `computeTotalStat` | Tier |
|------|---|---|---|
| GK | 3/2/0/4/0/0/5/5/4 | 25 | common |
| DEF | 4/3/3/4/2/5/3/0/0 | 24 | common |
| MID | 4/4/5/3/3/3/2/0/0 | 24 | common |
| FWD | 5/4/3/3/4/2/3/0/0 | 24 | common |
| ST | 5/4/2/3/5/2/3/0/0 | 24 | common |

Identical stat profiles used for both home and away sides (D-07: "roughly equal home and away", same size and role composition, no asymmetry requested). All totals are well below the `rare` threshold (31), confirmed by a dedicated test.

## Decisions Made

- **CSV route over a `teams.ts` hand-edit** — the file carries an `AUTO-GENERATED` header; a hand-edit would be silently destroyed by the next `pnpm run seed:rosters` run. Cost: three small, well-scoped `seed-rosters.ts` edits (documented above).
- **`GENERIC_BENCH_NUMBER_OFFSET = 11`** structurally guarantees jersey numbers 12-16 for both generic groups without touching any existing squad's 1-11 numbering — verified byte-for-byte via `git diff` showing additions-only on `teams.ts`.
- **Squad-remainder path kept, not deleted, in `roomHandlers.ts`** — stays live and automatically becomes the active path (rather than the generic-bench fallback) the moment a future milestone authors squads deeper than 11 players, per D-09's explicit follow-on note.
- **No changes to `gameEngine.ts`** — read `applySubstitution`'s 9 guards in full before writing any server code; confirmed a generic bench `PoolPlayer` is structurally indistinguishable from any other pool player at every guard (bench-entry lookup, `PLAYER_POOL` resolution, GK parity), so no generic-player special case was needed or added. `git diff --stat` against `gameEngine.ts` is empty, matching the plan's explicit acceptance criterion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `seed-rosters.ts` raw output was not byte-for-byte reproducible against the committed, hook-formatted file**
- **Found during:** Task 1 final verification (re-running `pnpm run seed:rosters` and checking `git status --short packages/shared/src/teams.ts` per the plan's own acceptance criterion, after the first commit had passed through the repo's pre-commit hook)
- **Issue:** The repo's pre-commit hook runs `eslint --fix` + `prettier --write` on staged `.ts` files. Prettier's `singleQuote: true` config still prefers double quotes when a string contains an unescaped single quote (to minimize escaping) — e.g. `firstName: "N'Golo"` — and enforces `trailingComma: "all"`. The raw `seed-rosters.ts` script always emitted single-quote-escaped strings (`'N\'Golo'`) and no trailing comma after the final array element, so after any commit passed through the hook, a subsequent plain re-run of `pnpm run seed:rosters` produced a 3-line diff against the committed file — silently failing the "byte-for-byte reproducible" must-have truth. This gap pre-dated this plan (the same 2 apostrophe-name entries already existed in the pool) but had never previously been exercised, because no phase had both regenerated `teams.ts` from a modified CSV and then diffed the post-hook committed result against a fresh regeneration.
- **Fix:** `seed-rosters.ts` now imports `format`/`resolveConfig` from the `prettier` package (resolved via Node's parent-directory module walk-up to the workspace root's `prettier@3.8.3`, since no package in this monorepo besides the root declares `prettier` as its own dependency — confirmed to resolve correctly by direct test) and formats its generated string through the repo's own `.prettierrc` before `writeFileSync`.
- **Files modified:** `packages/shared/scripts/seed-rosters.ts`
- **Verification:** Ran `pnpm run seed:rosters` twice in a row (once immediately after the Task 1 commit, once again after committing the fix) and confirmed `git status --short packages/shared/src/teams.ts` is clean both times; full shared test suite (907 tests) and full server test suite (1635 tests) re-run green after the fix.
- **Committed in:** `1acdfadc`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to satisfy the plan's own literal acceptance criterion ("re-running `pnpm run seed:rosters` after the edits leaves `git status` clean for `teams.ts`"). No scope creep — the fix is confined to the generator script's write step and does not touch any bench-composition logic.

## Issues Encountered

- **Fresh worktree had no `node_modules` or built `packages/shared/dist`.** Ran `pnpm install` (foreground, completed via background monitoring since it exceeded the default tool timeout) and `pnpm --filter @counter-attack/shared run build` before any test/typecheck step could succeed. Not a plan deviation — standard first-run setup for an isolated worktree.
- **`pnpm --filter @counter-attack/server test` (default vitest pool) crashed a worker mid-run** ("Worker exited unexpectedly" from tinypool) on one run, matching a previously-documented Windows-specific flake for this project. Reran with `npx vitest run --pool=forks`, which completed cleanly (70 files, 1635 tests passed) — used for all server-suite verification in this plan.
- **Session was interrupted once by an unrelated API/quota error** between staging Task 1's files and committing them. Resumed per the coordinator's explicit instruction from the exact staged state (`git status`/`git diff --cached` confirmed the staged files matched Task 1's intended scope) with no rework needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Standard (non-Draft) rooms now have a genuinely usable, testable substitution flow — the substitution UX overhaul (Phase 42) and its screen now have real bench data to render in Standard mode, not just Draft mode.
- Remaining Phase 46 requirements (CLEANUP-06 through CLEANUP-12: gameplay consistency audit, dead-ball hex highlighting, phase help-text clarity, kicker/thrower selection alignment, card/pitch/roster/bench layout alignment, duplicate-behavior consolidation) are out of this plan's scope and untouched by this work.
- No blockers for subsequent 46-0N plans. The two new `teamConfig.ts` exports (`GENERIC_BENCH_HOME_TEAM_ID`, `GENERIC_BENCH_AWAY_TEAM_ID`) are currently unconsumed outside `getGenericBenchPlayers` itself — `pnpm knip` reports them clean today, but if a future plan removes the only call site of `getGenericBenchPlayers`, revisit whether the two ID constants should be inlined per the original plan's own instruction ("if the two ID constants end up unconsumed, inline them rather than leaving dead exports").

## Self-Check: PASSED

All claimed files verified present on disk; all three task/deviation commit hashes (`72feff4b`, `1ce4ca54`, `1acdfadc`) verified present in `git log --oneline --all`.

---
*Phase: 46-final-cleanup*
*Completed: 2026-08-29*
