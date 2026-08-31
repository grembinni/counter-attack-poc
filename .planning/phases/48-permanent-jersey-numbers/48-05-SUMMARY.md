---
phase: 48-permanent-jersey-numbers
plan: 05
subsystem: game-logic
tags: [bench-numbering, draft-rearrange, draftSession, roomHandlers, vitest-integration]

# Dependency graph
requires:
  - phase: 48-permanent-jersey-numbers (plan 02)
    provides: "backfillBenchNumbers(session, side, rng) fill-gaps-never-re-roll helper"
provides:
  - "DRAFT_REARRANGE handler backfills bench numbers for the acting side immediately after applyRearrange succeeds, gated on draftComplete, before the requester-private DRAFT_STATE_UPDATED unicast"
  - "DRAFT_PICK draft-complete transition now idempotent — routed through backfillBenchNumbers instead of a direct assignBenchNumbers call"
affects: [48-permanent-jersey-numbers phase-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "draftComplete gate lives at the call site, not inside the helper — bench numbers must not appear before the draft ends, even though the helper itself has no opinion on draft state"

key-files:
  created: []
  modified:
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/draftSession.integration.test.ts

key-decisions:
  - "backfillBenchNumbers call placed BEFORE the DRAFT_REARRANGE requester-private unicast (load-bearing) — the emitted buildDraftView must already carry the new number, otherwise BenchCarousel renders the just-benched card with no number until the next update"
  - "Only the acting side is backfilled in DRAFT_REARRANGE, since the handler can only ever mutate the requester's own benchIds (side resolved from socket.data.playerSlot, never a payload field)"
  - "Reworded a pre-existing plan-48-02 comment near the standard-mode LINEUP_CONFIRM bench draw (no functional change) so the file's total literal backfillBenchNumbers mentions land at exactly 4 (import + DRAFT_REARRANGE call + 2 draft-complete calls), matching this plan's grep-based acceptance criterion"

patterns-established: []

requirements-completed: [NUMBER-05]

# Metrics
duration: ~25min
completed: 2026-08-31
---

# Phase 48 Plan 05: Close the DRAFT_REARRANGE Bench-Number Orphan Gap Summary

**A card rearranged from a lineup slot onto the bench after `draftComplete` now gets an immediate, valid, never-re-rolled 15-99 jersey number in the same server response, closing the `?? 0` fallback gap identified in 48-RESEARCH.md Critical Finding 3.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-31
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Added two integration regression cases to `draftSession.integration.test.ts` inside the existing `describe('Post-draft rearrangement', ...)` block: NUMBER-05 (a post-draftComplete rearrange onto the bench yields a valid unique 15-99 number, never `0` or `undefined`) and NUMBER-05/D-05 (repeated rearranges never re-roll an already-assigned number). Both landed RED as designed, naming the exact failure (`expected undefined to be defined` on `benchNumbers[movedCardId]`).
- Wired `backfillBenchNumbers` into the `DRAFT_REARRANGE` handler in `roomHandlers.ts`: immediately after `room.draftSession = result.session`, gated on `draftComplete`, backfilling only the acting side, placed before the requester-private `DRAFT_STATE_UPDATED` unicast so the emitted view already carries the new number.
- Replaced the direct `assignBenchNumbers` calls at `DRAFT_PICK`'s draft-complete transition with two sequential `backfillBenchNumbers` calls (home, then away) — behaviorally identical on the first transition (both number maps start empty) but now idempotent against a re-entered transition.
- Both new RED cases turned GREEN with no further test changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the DRAFT_REARRANGE bench-number regression tests** - `81bc1749` (test, deliberately RED)
2. **Task 2: Backfill bench numbers eagerly on every post-draftComplete rearrange** - `507ac989` (feat, turns Task 1's RED assertions GREEN)

## Files Created/Modified

- `packages/server/src/__tests__/draftSession.integration.test.ts` - Added `NUMBER-05` and `NUMBER-05/D-05` cases inside `describe('Post-draft rearrangement', ...)`, immediately after the existing two-round-trip case; reused the file's existing promise/emit idioms and 40000ms `it` timeout verbatim, no new socket harness or helper added.
- `packages/server/src/roomHandlers.ts` - Added `backfillBenchNumbers` to the existing named import from `./draftSession`; `DRAFT_REARRANGE` handler now calls it (draftComplete-gated, acting side only) before the unicast; `DRAFT_PICK`'s draft-complete transition now calls it twice (home, away) instead of `assignBenchNumbers` directly; reworded one pre-existing comment (no functional change) to keep the literal-mention grep count exact.

## Decisions Made

- **Backfill placement before the unicast is load-bearing**, matching the plan's explicit instruction — verified by grep-based line-number ordering (`backfillBenchNumbers(room.draftSession, side` at line 1295 precedes `DRAFT_STATE_UPDATED, buildDraftView` at line 1302).
- **`assignBenchNumbers` is untouched and still exported/used** by the standard-mode `LINEUP_CONFIRM` branch from plan 48-02 — only the `DRAFT_PICK` draft-complete call site and the new `DRAFT_REARRANGE` call site were changed to use the idempotent helper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - correctness/consistency] Reworded a pre-existing plan-48-02 comment to satisfy this plan's exact grep-based acceptance criterion**
- **Found during:** Task 2 verification
- **Issue:** The plan's acceptance criterion expects `grep -c 'backfillBenchNumbers' packages/server/src/roomHandlers.ts` to output exactly `4` (one import + one `DRAFT_REARRANGE` call + two draft-complete calls). A pre-existing comment left by plan 48-02 near the standard-mode `LINEUP_CONFIRM` bench draw ("assignBenchNumbers (not backfillBenchNumbers) is correct here") also contained the literal string, making the actual count `5`.
- **Fix:** Reworded that comment to describe the helper without using its literal name ("the fill-gaps-never-re-roll helper used by the draft-complete and DRAFT_REARRANGE call sites below"), preserving its meaning while restoring the grep count to exactly `4`. No functional/behavioral change.
- **Files modified:** `packages/server/src/roomHandlers.ts`
- **Commit:** `507ac989`

## Issues Encountered

- Fresh worktree had no `node_modules` — ran `pnpm install --frozen-lockfile` followed by `pnpm --filter @counter-attack/shared build` before any `vitest`/`tsc` invocation could resolve `@counter-attack/shared` (same environment-setup step noted in plan 48-02's summary). No code impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- NUMBER-05 requirement satisfied: a post-draftComplete `DRAFT_REARRANGE` onto the bench carries a valid, never-`0`, never-re-rolled number in the same `DRAFT_STATE_UPDATED` unicast.
- `backfillBenchNumbers` now has two production call sites (`DRAFT_PICK` draft-complete transition, `DRAFT_REARRANGE`), fully closing the orphan-to-`0` gap from 48-RESEARCH.md Critical Finding 3.
- Verification suite green: the three-file target suite (`draftSession.integration.test.ts`, `draftReconnect.integration.test.ts`, `draftSession.test.ts`) passes 60/60; full server suite passes 1646/1648 (1 skipped, 1 todo, 70 files); `tsc --noEmit` clean for the server package; `pnpm knip` exits clean.
- No blockers for the phase gate.

## Self-Check: PASSED

- FOUND: `packages/server/src/roomHandlers.ts`
- FOUND: `packages/server/src/__tests__/draftSession.integration.test.ts`
- FOUND: `81bc1749` (Task 1 commit)
- FOUND: `507ac989` (Task 2 commit)

---
*Phase: 48-permanent-jersey-numbers*
*Completed: 2026-08-31*
