---
phase: 48-permanent-jersey-numbers
plan: 02
subsystem: game-logic
tags: [bench-numbering, crypto-random, draftSession, roomHandlers, vitest-integration]

# Dependency graph
requires:
  - phase: 48-permanent-jersey-numbers (plan 01, if applicable)
    provides: draft-mode DraftSession bench-number infrastructure (assignBenchNumbers, homeBenchNumbers/awayBenchNumbers)
provides:
  - "backfillBenchNumbers(session, side, rng) — fill-gaps-never-re-roll bench-number helper for a DraftSession side, exported from draftSession.ts, unit-tested with 6 cases"
  - "Standard-mode LINEUP_CONFIRM bench numbers sourced from assignBenchNumbers(benchPlayerIds, randomInt), matching the draft-mode mechanism exactly"
  - "Corrected BenchEntry.jerseyNumber doc contract in packages/shared/src/types.ts describing the real 15-99 crypto-random, never-re-rolled, both-modes contract"
affects: [48-05 (DRAFT_REARRANGE orphan-to-0 gap, consumes backfillBenchNumbers), 48-permanent-jersey-numbers phase-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "assignBenchNumbers/backfillBenchNumbers pair: one-time initial draw vs. idempotent fill-gaps-never-re-roll, both crypto.randomInt-backed via injected RandomIntFn, never Math.random"

key-files:
  created: []
  modified:
    - packages/server/src/draftSession.ts
    - packages/server/src/draftSession.test.ts
    - packages/server/src/roomHandlers.ts
    - packages/shared/src/types.ts
    - packages/server/src/__tests__/lineupAssignment.integration.test.ts
    - packages/server/src/__tests__/substitution.integration.test.ts

key-decisions:
  - "assignBenchNumbers (not backfillBenchNumbers) used at the standard-mode LINEUP_CONFIRM site — it's a one-time initial draw for a bench with no pre-existing numbers, so the fill-gaps wrapper would be a no-op with extra indirection; documented in a code comment so a later reader doesn't upgrade it"
  - "backfillBenchNumbers dedupes benchIds before drawing (pack generation only guards duplication within a round, so a repeated id must consume exactly one number) and excludes already-in-use numbers from the shuffle pool to preserve per-team uniqueness after a backfill"

patterns-established:
  - "Idempotent id-based reference-equality return: a helper that discovers nothing to do returns the input object unchanged by reference, letting callers assert 'nothing happened' with toBe() rather than deep equality"

requirements-completed: [NUMBER-01, NUMBER-05]

# Metrics
duration: ~35min
completed: 2026-08-31
---

# Phase 48 Plan 02: Bench Jersey Number Unification Summary

**Standard-mode bench numbers now draw from the same crypto-backed 15-99 shuffle-without-replacement helper (`assignBenchNumbers`) draft mode already used, plus a new idempotent `backfillBenchNumbers` fill-gaps-never-re-roll helper for future rearrange-time gap closure.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-31T16:36:43Z
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- Added `backfillBenchNumbers` to `draftSession.ts`: draws numbers only for bench ids missing an entry, never re-rolls an already-assigned number, returns the exact same session reference when nothing is missing (idempotence proven by reference equality), dedupes repeated bench ids, and excludes in-use numbers from the draw pool. 6 new unit tests.
- Rewrote both stale standard-mode bench integration assertions (`lineupAssignment.integration.test.ts`, `substitution.integration.test.ts`) from the old `[12, 16]` `PoolPlayer.number` range to the correct `[15, 99]` random range, and added a new end-to-end case proving per-team distinct, non-starter-colliding bench numbers structurally distinct from the old `PoolPlayer.number` source.
- Rewired the standard-mode `LINEUP_CONFIRM` bench branch in `roomHandlers.ts` to call `assignBenchNumbers(benchPlayerIds, randomInt)` per side instead of `jerseyNumber: p.number` — eliminating the exact anti-pattern 48-RESEARCH.md flagged.
- Corrected the `BenchEntry.jerseyNumber` doc comment in `packages/shared/src/types.ts` to describe the real, unified contract for both draft and standard rooms, noting the D-13 red-card exception.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add backfillBenchNumbers to draftSession.ts with unit coverage** - `60d7eb86` (feat)
2. **Task 2: Rewrite both standard-mode bench-number integration assertions** - `ee09696b` (test, deliberately RED)
3. **Task 3: Source standard-mode bench numbers from assignBenchNumbers and correct the BenchEntry doc contract** - `d5dcbfe9` (feat, turns Task 2's RED assertions GREEN)

_Note: Task 2 is a deliberate RED commit per the plan's TDD-style task split — Task 3 makes the same assertions pass without further test changes._

## Files Created/Modified

- `packages/server/src/draftSession.ts` - Added exported `backfillBenchNumbers(session, side, rng)` immediately after `assignBenchNumbers`
- `packages/server/src/draftSession.test.ts` - Added `describe('backfillBenchNumbers (Phase 48, D-05)', ...)` with 6 cases; imported the new export
- `packages/server/src/roomHandlers.ts` - Standard-mode bench branch now draws `homeBenchNumbers`/`awayBenchNumbers` via `assignBenchNumbers` before mapping to `BenchEntry[]`
- `packages/shared/src/types.ts` - `BenchEntry.jerseyNumber` doc comment rewritten to the corrected contract
- `packages/server/src/__tests__/lineupAssignment.integration.test.ts` - Existing bench-range assertions widened to `[15, 99]`, case name updated; new `NUMBER-05/D-02/D-04` case added
- `packages/server/src/__tests__/substitution.integration.test.ts` - Same stale `[12, 16]` range corrected to `[15, 99]`, case name's parenthetical updated; red-card relocation (`fouler.number`) and slot-inheritance (`outfield.number`) assertions left untouched (out of this plan's scope)

## Decisions Made

- **`assignBenchNumbers` (not `backfillBenchNumbers`) at the standard-mode call site.** This is the one-time initial draw for a bench whose membership is fully known and which starts with no pre-existing numbers — using the fill-gaps wrapper here would be a no-op with extra indirection. Recorded in an in-code comment so a future reader doesn't "upgrade" it incorrectly; `backfillBenchNumbers` is reserved for plan 48-05's `DRAFT_REARRANGE` orphan-closing use case.
- **Combined-across-both-sides "structural proof" assertion** in the new `lineupAssignment.integration.test.ts` case (all 10 bench entries, not per-side 5) — matches the plan's stated probability argument (an all-in-[12,16] result across 10 entries under a 15-99 draw is effectively impossible) more precisely than a weaker per-side 5-entry version would.

## Deviations from Plan

None — plan executed exactly as written. All three tasks, their `<read_first>` guidance, and every acceptance criterion were followed verbatim.

## Issues Encountered

- The worktree had no `node_modules` at all (fresh worktree, no reparse-point workaround attempted — see project memory on Windows junction risk). Resolved by running a plain `pnpm install --frozen-lockfile` in the worktree (safe: pnpm's content-addressable store means this only hardlinks from the global store, never touches the main repo's `node_modules`) followed by `pnpm --filter @counter-attack/shared build` to produce `dist/` before any `vitest`/`tsc` invocation could resolve `@counter-attack/shared`. No code impact; purely an environment-setup step.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `backfillBenchNumbers` is ready for plan 48-05 to consume when closing the `DRAFT_REARRANGE` orphan-to-`0` gap.
- Standard-mode and draft-mode bench numbering are now mechanistically identical (same helper, same RNG, same range), closing the D-02/D-04 requirement for this plan's scope.
- Full verification suite green: server 1642 passed (1 skipped, 1 todo, 70 files), shared 908 passed (18 files), `tsc --noEmit` clean for both packages, `pnpm knip` clean (the new `backfillBenchNumbers` export is not flagged as unused).
- No blockers for the next plan in this phase.

## Self-Check: PASSED

- FOUND: `packages/server/src/draftSession.ts`
- FOUND: `.planning/phases/48-permanent-jersey-numbers/48-02-SUMMARY.md`
- FOUND: `60d7eb86` (Task 1 commit)
- FOUND: `ee09696b` (Task 2 commit)
- FOUND: `d5dcbfe9` (Task 3 commit)
- FOUND: `d320d676` (SUMMARY commit)

---
*Phase: 48-permanent-jersey-numbers*
*Completed: 2026-08-31*
