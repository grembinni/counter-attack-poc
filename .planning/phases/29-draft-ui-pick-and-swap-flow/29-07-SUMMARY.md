---
phase: 29-draft-ui-pick-and-swap-flow
plan: 07
subsystem: api
tags: [socket.io, draft-mode, lineup-confirm, server-authoritative, gap-closure]

# Dependency graph
requires:
  - phase: 29-draft-ui-pick-and-swap-flow (plans 01-06)
    provides: DRAFT_PICK/DRAFT_REARRANGE handlers, DraftSession state machine, human-verification gap diagnosis (29-06)
provides:
  - DRAFT_REARRANGE legal after draftComplete (before the requesting side confirms)
  - LINEUP_ALREADY_CONFIRMED lifecycle guard on DRAFT_REARRANGE
  - Draft-mode LINEUP_CONFIRM resolves confirmedHomeOrder/confirmedAwayOrder from
    draftSession.homeLineupSlots/awayLineupSlots (not the empty homeAssignment/awayAssignment shell)
  - LINEUP_INCOMPLETE guard rejecting any draft LINEUP_CONFIRM with an unfilled starting slot
affects:
  [30-draft-ui-follow-on, any future phase touching roomHandlers.ts LINEUP_CONFIRM/DRAFT_REARRANGE]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Lifecycle guard resolved from socket.data.playerSlot (never a client payload field) gates post-terminal-state mutation attempts'
    - 'Per-side completeness check runs before setting a confirm flag, so by both-confirm time both sides are already known-complete'

key-files:
  created: []
  modified:
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/draftSession.integration.test.ts

key-decisions:
  - "DRAFT_REARRANGE's draftComplete guard removed entirely; replaced with a LINEUP_ALREADY_CONFIRMED check on the requesting side's own confirmed flag + room.gameState, per T-29-07-01"
  - "DRAFT_PICK's draftComplete guard is unchanged — a 17th pick is still rejected; only rearrangement of already-drafted cards was relaxed"
  - "LINEUP_CONFIRM branches on room.teamType === 'draft' && room.draftSession != null; Standard-mode path (room.homeAssignment/awayAssignment) is untouched"
  - 'Incomplete-lineup check runs per-confirming-side BEFORE the confirm flag is set (not only at build time) — this is what allows the flag to never be set for a partial roster and guarantees both starting orders are complete by the time the both-confirm gate passes'

patterns-established:
  - 'Post-terminal-state guards resolve current-state legality (confirmed flag / game started) from server-held socket.data, never from the terminal-state flag itself (draftComplete) that the plan intends to relax'

requirements-completed: [DRAFT-08, DRAFT-09, DRAFT-10]

# Metrics
duration: ~30min
completed: 2026-07-21
---

# Phase 29 Plan 07: Gap-Closure — Post-Draft Rearrange + Roster Hand-off Summary

**Fixed two server-side draft-to-game lifecycle bugs found in 29-06 human verification: DRAFT_REARRANGE now stays legal after draftComplete until the requesting side confirms, and draft-mode LINEUP_CONFIRM resolves the drafted roster from `draftSession.*LineupSlots` instead of the permanently-null `room.*Assignment` shell, so a completed draft now produces a real 22-piece GameState with full stats/positions.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-21
- **Tasks:** 2
- **Files modified:** 2 (`packages/server/src/roomHandlers.ts`, `packages/server/src/__tests__/draftSession.integration.test.ts`)

## Accomplishments

- Post-draft rearrangement (before Confirm) is now applied and repeatable server-side — previously every `DRAFT_REARRANGE` after `draftComplete` was rejected with `NOT_DRAFTING`, silently breaking the "arrange your lineup/bench freely after the draft ends" flow (D-08/D-15).
- A completed draft, once both players confirm, now produces a full 22-piece `GameState` where every on-pitch piece has real stats and a board position — previously the drafted roster never reached `buildInitialGameState`, which received an array of `undefined` players resolved from the never-populated `room.homeAssignment`/`awayAssignment` null shell.
- A draft-mode `LINEUP_CONFIRM` with an unfilled starting slot is now rejected with a specific `LINEUP_INCOMPLETE` error before the confirm flag is set or the game starts — no undefined player can ever reach `buildInitialGameState`.
- The tamper/lifecycle guard on `DRAFT_REARRANGE` — `LINEUP_ALREADY_CONFIRMED` once the requesting side has confirmed, or the match has started — is proven by an integration test that reaches draftComplete, confirms one side, and then confirms a further rearrange attempt from that side is rejected with no state update.

## Task Commits

Each task was committed atomically:

1. **Task 1: Allow post-draft rearrangement (fix DRAFT_REARRANGE draftComplete guard)** - `e0c7cbe` (fix)
2. **Task 2: Resolve the drafted roster into game start (fix LINEUP_CONFIRM for draft mode)** - `d7223be` (fix)

_Both commits also include their task's new integration tests, per the plan's task-scoped `<files>` list._

## Files Created/Modified

- `packages/server/src/roomHandlers.ts` — `DRAFT_REARRANGE` opening guard no longer rejects on `draftSession.draftComplete`; adds a `LINEUP_ALREADY_CONFIRMED` guard resolved from the requester's own confirmed flag / `room.gameState`. `LINEUP_CONFIRM` branches on `room.teamType === 'draft'`, resolving `confirmedHomeOrder`/`confirmedAwayOrder` from `draftSession.homeLineupSlots`/`awayLineupSlots` for draft rooms (Standard-mode path unchanged), with a `LINEUP_INCOMPLETE` guard run per-confirming-side before the flag is set.
- `packages/server/src/__tests__/draftSession.integration.test.ts` — new shared helpers (`pickIntoLineup`, `driveDraftToCompletionFillingLineups`, `SLOT_ROLES`) that drive a full 4-cycle draft while explicitly filling all 11 starting-lineup slots (needed so a side can legally `LINEUP_CONFIRM` in tests); two new `describe` blocks covering post-draft repeat-rearrange, rearrange-after-confirm rejection, full-roster `LINEUP_CONFIRM` resolution (22 pieces with real stats/positions), and incomplete-lineup rejection.

## Decisions Made

- Kept the incomplete-lineup completeness check scoped to the **confirming side's own** lineup, run once per `LINEUP_CONFIRM` before the flag is set (not a single check of "either side" at build time). This guarantees the confirm flag is never set for a partial roster, and by the time both `homeLineupConfirmed`/`awayLineupConfirmed` are true, both sides' starting orders are already known-complete — so the final resolution at build time can safely use `resolveDraftOrder(...)!`.
- `DRAFT_PICK`'s existing `draftComplete` rejection was left untouched, per the plan's explicit instruction that only `DRAFT_REARRANGE` relaxes.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria (source assertions on the guard conditions, behavior assertions in new integration tests, full-suite green) are satisfied without any Rule 1-4 deviations.

## Issues Encountered

- The worktree had no installed `node_modules` (fresh worktree, own `pnpm-lock.yaml`). Resolved by running `pnpm install --frozen-lockfile` from the worktree root (safe — resolves from the shared pnpm content-addressable store, no directory-junction workaround used, consistent with the known Windows-junction risk noted in project memory) followed by `pnpm build` in `packages/shared` (its `dist/` output didn't exist yet, causing `@counter-attack/shared` module-not-found errors during `tsc --noEmit` in `packages/server`).
- To keep the two tasks committed atomically despite both touching the same two files with tightly-coupled shared test helpers, the second task's changes were applied via `git checkout -- <file>` (single-file revert, sanctioned) after Task 1's commit, then Task 2's edits were reapplied and diffed byte-for-byte against the originally-authored combined version before committing, to guarantee no content was lost or duplicated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three critical gaps identified in 29-06 human verification that were in scope for this plan (repeat post-draft rearrange, draft-mode roster hand-off to game start, incomplete-lineup safety) are closed and covered by integration tests.
- `pnpm --filter @counter-attack/server typecheck` clean; `pnpm --filter @counter-attack/server test` full suite green — 33 test files, 605 passed, 1 pre-existing skip, 1 pre-existing todo (no regressions to Standard-mode `LINEUP_CONFIRM`, `DRAFT_PICK`, keeper-safety, or reconnect behavior).
- Manual grep verification confirmed: `DRAFT_REARRANGE` handler no longer contains `draftComplete` in its opening reject condition; `LINEUP_CONFIRM` contains a `room.teamType === 'draft'` branch resolving from `draftSession.*LineupSlots`.
- This plan is the server-side half of the 29-06 gap-closure work (runs in parallel with 29-08). The client-side portion — bench-as-carousel (DRAFT-09), draft/bench card legibility (DRAFT-06 partial), `onDragEnd` drag-state reset, and Confirm-button gating on a full lineup — is tracked in `29-08-PLAN.md` and is a separate concern from this plan's server fixes.
- This plan's server-side `LINEUP_INCOMPLETE` guard is designed to pair with 29-08's client-side Confirm-gating (client prevents the confirm attempt in the common case; server enforces it regardless of client state, per ASVS V5).
- Next human-verification pass (re-run of the 29-06 walkthrough) should re-test: repeat post-draft drag/rearrange across a full session, and confirm the completed match now shows correct stats/positions for all 22 pieces.

---

_Phase: 29-draft-ui-pick-and-swap-flow_
_Completed: 2026-07-21_

## Self-Check: PASSED

- FOUND: commit `e0c7cbe` (Task 1)
- FOUND: commit `d7223be` (Task 2)
- FOUND: `packages/server/src/roomHandlers.ts`
- FOUND: `packages/server/src/__tests__/draftSession.integration.test.ts`
- FOUND: `.planning/phases/29-draft-ui-pick-and-swap-flow/29-07-SUMMARY.md`
