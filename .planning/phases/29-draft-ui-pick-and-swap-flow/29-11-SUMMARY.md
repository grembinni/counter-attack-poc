---
phase: 29-draft-ui-pick-and-swap-flow
plan: 11
subsystem: api
tags: [socket.io, draft-lifecycle, server-authoritative, reconnect]

# Dependency graph
requires:
  - phase: 29-draft-ui-pick-and-swap-flow (plan 10)
    provides: applyRearrange slot-to-slot swap fix and DRAFT_PICK/DRAFT_REARRANGE server wiring
provides:
  - LINEUP_CONFIRM draft branch now rejects with DRAFT_NOT_COMPLETE before the draft is
    mechanically complete (all 16 cards drafted), closing the early-match-start exploit
  - DRAFT_PICK now shares DRAFT_REARRANGE's post-confirm/post-start lifecycle guard
    (LINEUP_ALREADY_CONFIRMED), preventing draftSession mutation and screen-yanking broadcasts
    after kickoff
  - Reconnect draft re-sync widened to gameState===null, closing the post-complete/
    pre-both-confirm reconnect dead-window
affects: [30-draft-data-model, future-draft-lifecycle-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Server-authoritative lifecycle guards: DRAFT_PICK and DRAFT_REARRANGE now share the
      identical requesterConfirmed || room.gameState !== null guard shape'
    - 'Reconnect re-sync gated on room.gameState === null (not a session-specific flag) to
      scope re-emission to the entire pre-game window, including edge sub-states'

key-files:
  created: []
  modified:
    - packages/server/src/roomHandlers.ts
    - packages/server/src/createServer.ts
    - packages/server/src/__tests__/draftSession.integration.test.ts
    - packages/server/src/__tests__/draftReconnect.integration.test.ts

key-decisions:
  - 'CR-01 guard ordering: draftComplete check placed BEFORE the existing LINEUP_INCOMPLETE
    slot-completeness check and BEFORE setting the confirmed flag'
  - "CR-01 regression fix: the pre-existing LINEUP_INCOMPLETE test's original scenario (single
    bench pick, draftComplete false) is now shadowed by the new draftComplete guard by design
    — updated that test to drive the draft to full completion via bench-only picks
    (driveDraftToCompletionBenchOnly helper) so it still exercises LINEUP_INCOMPLETE"
  - 'CR-01 regression fix note: the cycle-4 keeper safety net (DRAFT-08) auto-fills the GK slot
    (index 0) even on a bench-only drive, so the LINEUP_INCOMPLETE regression test asserts only
    slots 1-10 stay null, not the full array'
  - 'CR-02 guard mirrors DRAFT_REARRANGE exactly: reused the existing LINEUP_ALREADY_CONFIRMED
    literal rather than inventing a new one'
  - 'CR-03 gates on room.gameState === null rather than !draftSession.draftComplete — this is a
    strict superset of the old condition and correctly covers the post-complete/pre-confirm
    window without ever firing once a match has started'

patterns-established:
  - 'Lifecycle guard tests use direct room-object mutation via getRoom(roomCode) to force
    otherwise-unreachable server states (gameState non-null pre-confirm, draftComplete
    true pre-reconnect) rather than fully driving the real event sequence'

requirements-completed: [DRAFT-07, DRAFT-10]

# Metrics
duration: 6min
completed: 2026-07-21
---

# Phase 29 Plan 11: Draft Lifecycle Guard Closure (CR-01/CR-02/CR-03) Summary

**Three server-side guard-only fixes closing the last CRITICAL gap on Phase 29: draft-mode LINEUP_CONFIRM now enforces draftComplete, DRAFT_PICK now shares DRAFT_REARRANGE's post-confirm/post-start guard, and reconnect re-sync now covers the post-complete/pre-confirm window.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-21T22:45:24Z
- **Completed:** 2026-07-21T22:51:12Z
- **Tasks:** 3
- **Files modified:** 4 (2 source, 2 test)

## Accomplishments

- Closed CR-01: a draft-mode `LINEUP_CONFIRM` with all 11 lineup slots filled but
  `draftSession.draftComplete` still false (the cycle-3-full / cycle-4-incomplete window) is now
  rejected with `GAME_ERROR 'DRAFT_NOT_COMPLETE'` and emits zero `GAME_STATE` — a match can no
  longer start a full cycle early.
- Closed CR-02: `DRAFT_PICK` now carries the identical `requesterConfirmed || room.gameState !== null`
  guard `DRAFT_REARRANGE` already had, rejecting with `'LINEUP_ALREADY_CONFIRMED'` and refusing to
  mutate `draftSession` or broadcast `DRAFT_STATE_UPDATED` once the requesting side has confirmed
  or the match has started.
- Closed CR-03: the reconnect handler's draft re-sync condition is widened from
  `!draftSession.draftComplete` to `room.gameState === null`, so a socket reconnecting in the
  post-complete/pre-both-confirm window now receives a `DRAFT_STATE_UPDATED` re-sync instead of
  silence — restoring the CLAUDE.md reconnection-with-state-recovery design value for this window.

## Task Commits

Each task was committed atomically:

1. **Task 1: CR-01 — reject draft-mode LINEUP_CONFIRM while draftComplete is false** - `3fba9c6` (fix)
2. **Task 2: CR-02 — reject DRAFT_PICK after confirm or match start (mirror DRAFT_REARRANGE guard)** - `5811b2b` (fix)
3. **Task 3: CR-03 — widen reconnect draft re-sync to the post-complete/pre-confirm window** - `e59202a` (fix)

_No plan-metadata commit yet — this SUMMARY/STATE/ROADMAP commit follows separately per the final_commit step._

## Files Created/Modified

- `packages/server/src/roomHandlers.ts` - Added the CR-01 `draftComplete` guard to the
  `LINEUP_CONFIRM` `isDraftRoom` branch (emits `DRAFT_NOT_COMPLETE`) and the CR-02
  `requesterConfirmed || room.gameState !== null` guard to `DRAFT_PICK` (emits
  `LINEUP_ALREADY_CONFIRMED`, mirroring `DRAFT_REARRANGE`).
- `packages/server/src/createServer.ts` - Widened the reconnect draft re-sync condition from
  `teamType === 'draft' && draftSession && !draftSession.draftComplete` to
  `room.gameState === null && teamType === 'draft' && draftSession` (CR-03).
- `packages/server/src/__tests__/draftSession.integration.test.ts` - Added CR-01 and CR-02
  regression describe blocks; extended `setupThroughDraftUniformConfirm` to additionally return
  `roomCode`; added `getRoom` import; added `driveDraftToCompletionBenchOnly` helper; updated the
  pre-existing `LINEUP_INCOMPLETE` test to drive full completion (bench-only) so it is not
  shadowed by the new `draftComplete` guard.
- `packages/server/src/__tests__/draftReconnect.integration.test.ts` - Added the CR-03 regression
  describe block; added `getRoom` import.

## Decisions Made

- CR-01 guard placement: checked `!session.draftComplete` first, before the existing
  `resolveDraftOrder`/`LINEUP_INCOMPLETE` check and before setting either confirmed flag, exactly
  as specified in the plan's guard-order requirement.
- CR-02 reused the existing `'LINEUP_ALREADY_CONFIRMED'` literal rather than introducing a new
  error code, preserving symmetry with `DRAFT_REARRANGE`.
- CR-03's widened condition is a superset of the prior one (`gameState === null` is always true
  whenever `!draftComplete` was true, since `gameState` is only ever set after both confirms,
  which requires `draftComplete === true`), so the two pre-existing `draftReconnect` tests needed
  no changes and passed unmodified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a pre-existing regression test whose scenario was shadowed by the new CR-01 guard**

- **Found during:** Task 1 (CR-01 implementation)
- **Issue:** The plan's acceptance criteria asserted the pre-existing test "a draft
  LINEUP_CONFIRM with a null starting slot emits LINEUP_INCOMPLETE" would still pass unmodified,
  reasoning it "drives draftComplete true first." In fact that test only drove ONE bench pick
  (draftComplete left false) — with the new CR-01 guard checking `draftComplete` before the
  slot-completeness check, that scenario now correctly returns `DRAFT_NOT_COMPLETE` instead of
  `LINEUP_INCOMPLETE`, since `LINEUP_INCOMPLETE`'s real-world trigger is a mechanically-complete
  draft where a starting slot was intentionally left empty (cards benched instead), not an
  in-progress one.
- **Fix:** Added a `driveDraftToCompletionBenchOnly` helper that drives all 4 cycles to
  `draftComplete === true` while sending every pick to the bench (never a lineup slot), then
  updated the existing test to use it. Discovered along the way that the cycle-4 keeper safety
  net (DRAFT-08) auto-fills the GK slot (index 0) even under bench-only picks, so the test
  asserts only outfield slots (1-10) stay null, not the full array.
- **Files modified:** `packages/server/src/__tests__/draftSession.integration.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test draftSession.integration.test.ts`
  — all 15 tests pass, including the corrected regression test and the new CR-01 test.
- **Committed in:** `3fba9c6` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — pre-existing test correctness)
**Impact on plan:** The fix was necessary to preserve genuine regression coverage of the
`LINEUP_INCOMPLETE` code path (which the CR-01 guard does not remove, just reorders behind). No
scope creep — same file, same describe block, no new production code paths touched.

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three CRITICAL findings from 29-VERIFICATION.md's "Critical Gaps" #1 (CR-01/CR-02/CR-03)
  are closed with source guards and regression tests reaching each previously-unguarded window.
- Full server suite: 611/611 passing (was 608/608 pre-change, +3 new tests), `pnpm --filter
@counter-attack/server typecheck` exits 0.
- Source assertions confirmed: `DRAFT_NOT_COMPLETE` appears once in `roomHandlers.ts`;
  `room.gameState !== null` appears 4 times (2 pre-existing unrelated guards + DRAFT_REARRANGE's
  existing guard + the new DRAFT_PICK guard, satisfying the ≥2 threshold); `room.gameState ===
null` appears once in `createServer.ts`.
- Remaining outstanding item before Phase 29 can be marked fully complete: the pending live
  two-browser slot↔slot swap human walkthrough (for the already-code-complete 29-10 fix) —
  explicitly out of scope for this plan, called out as a non-goal.
- The uncommitted local `LineupAssignmentScreen.module.css` / `player-pool.csv` changes were left
  untouched throughout, per the plan's explicit non-goal.

## Known Stubs

None.

## Threat Flags

None - all three fixes add authorization/lifecycle guards to existing trust boundaries
(client socket → server draft/game handlers; reconnect handshake → room re-sync) already covered
by this plan's threat model. No new network endpoints, auth paths, or schema changes were
introduced.

---

_Phase: 29-draft-ui-pick-and-swap-flow_
_Completed: 2026-07-21_

## Self-Check: PASSED

- FOUND: `.planning/phases/29-draft-ui-pick-and-swap-flow/29-11-SUMMARY.md`
- FOUND: commit `3fba9c6` (Task 1)
- FOUND: commit `5811b2b` (Task 2)
- FOUND: commit `e59202a` (Task 3)
