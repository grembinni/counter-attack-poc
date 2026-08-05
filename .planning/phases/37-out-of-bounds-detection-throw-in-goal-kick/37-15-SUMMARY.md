---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 15
subsystem: game-engine
tags: [socket.io, hex-grid, goal-kick, out-of-bounds, tdd, threat-model]

# Dependency graph
requires:
  - phase: 37-out-of-bounds-detection-throw-in-goal-kick (37-13)
    provides: applyGoalKickReposition's isPitchHex/MOVE_INVALID/OFF_PITCH guard pattern that this plan mirrors for applyFreeMove, and the carried-forward T-37-66 threat this plan closes
  - phase: 37-out-of-bounds-detection-throw-in-goal-kick (37-04)
    provides: the original triggerOutOfBoundsRestart GOAL_KICK branch (gk.position placement) that this plan supersedes
provides:
  - GOAL_KICK_RESTART_HEX — a fixed, mirror-symmetric, formation-derived per-team restart hex for goal kicks
  - triggerOutOfBoundsRestart's GOAL_KICK branch rewritten to place both ball and goalkeeper at the fixed hex, resolved through resolveThrowInHex with the keeper excluded from the blocking list
  - computeGoalKickEligibleIds now evaluated against the post-placement piece list
  - applyFreeMove on-pitch bounds guard (engine layer) closing T-37-66
  - FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE GAME_MOVE handler payload-shape + isPitchHex guards (handler layer)
affects: [38-corner-kick-and-restart-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed restart hex as an exported Readonly<Record<'home'|'away', HexCoord>> constant, tested against FORMATIONS rather than restated as a literal"
    - "Two-layer OFF_PITCH validation (engine MOVE_INVALID/OFF_PITCH + handler payload-shape/INVALID_TARGET then isPitchHex/OFF_PITCH), mirrored verbatim from 37-13's applyGoalKickReposition guard"

key-files:
  created: []
  modified:
    - packages/shared/src/outOfBounds.ts
    - packages/shared/src/outOfBounds.test.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts

key-decisions:
  - 'D-15-01: restart hex is a named exported constant (GOAL_KICK_RESTART_HEX), not an inline literal'
  - 'D-15-02: lives in outOfBounds.ts (restart-rules module), not pitch.ts (geometry module)'
  - 'D-15-03: occupancy resolved via existing resolveThrowInHex, keeper excluded from the blocking piece list'
  - "D-15-04: both ball.position and the goalkeeper's own pieces entry move, keeping ball.carrierId and the carrier's position in agreement"
  - 'D-15-05: computeGoalKickEligibleIds is called with the post-placement piece list, not state.pieces'
  - 'D-15-06: T-37-66 gets the same two-layer treatment (engine MOVE_INVALID/OFF_PITCH, handler payload-shape then OFF_PITCH) that 37-13 gave applyGoalKickReposition'

requirements-completed: [] # Task 4 (checkpoint:human-verify) is pending user confirmation of the restart hex; do NOT mark OOB-04/GOALKICK-01/GOALKICK-02 complete until approved.

# Metrics
duration: 14min
completed: 2026-08-05
---

# Phase 37 Plan 15: Fixed Goal-Kick Restart Hex + T-37-66 Bounds Guard Summary

**Goal kicks now restart from a fixed, mirror-symmetric, formation-derived byline-centre hex (`{q:2,r:13}` home / `{q:34,r:13}` away) with the goalkeeper physically moved there alongside the ball, and `applyFreeMove` gained the on-pitch bounds guard (engine + handler layers) that closes the carried-forward T-37-66 threat.**

**Continuation note:** This SUMMARY was written by a continuation agent after the original executor hit an API session-quota limit immediately after Task 3's final sanity test run. All code, tests, and commits below were produced by the original executor; this agent's contribution was re-verification (re-running every test suite and both red-first proofs against the actual committed diffs) and writing this SUMMARY. Task 4 (the human-verify checkpoint) was not answered by either agent and remains open.

## Performance

- **Duration:** 14 min (Task 1 commit to Task 3 commit: 08:04:31 → 08:18:34)
- **Started:** 2026-08-05T08:04:31-05:00
- **Completed (Tasks 1-3):** 2026-08-05T08:18:34-05:00
- **Tasks:** 3 of 4 (Task 4 is a pending checkpoint, not executed by design)
- **Files modified:** 5 (`outOfBounds.ts`, `outOfBounds.test.ts`, `gameEngine.ts`, `gameHandlers.ts`, `gameEngine.outOfBounds.test.ts`)

## Accomplishments

- Added `GOAL_KICK_RESTART_HEX` to `packages/shared/src/outOfBounds.ts`: `home: {q:2,r:13}`, `away: {q:34,r:13}`, mirror-symmetric (`home.q + away.q === 36`, `home.r === away.r`), and provably derived from the goalkeeper's formation-default slot (`FORMATIONS[...].slots[0].position`) rather than restated as a literal.
- Rewrote `triggerOutOfBoundsRestart`'s `GOAL_KICK` branch (`packages/server/src/gameEngine.ts`) to resolve the restart hex through `resolveThrowInHex` (with the goalkeeper excluded from the blocking piece list) and move **both** `ball.position` and the goalkeeper's own `pieces` entry there — closing the drift defect where the restart was taken from the keeper's live (often far-displaced) position.
- `computeGoalKickEligibleIds` now receives the post-placement piece list so the two 6-hex reposition windows agree with the board from their first frame.
- Closed `T-37-66` (carried forward from 37-13): `applyFreeMove` gained an `isPitchHex(to)` guard between the adjacency and occupancy checks (engine layer), and the `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` `GAME_MOVE` handler branch gained a payload-shape check (`INVALID_TARGET`) followed by an `isPitchHex` check (`OFF_PITCH`), mirroring the goal-kick reposition branch's guard ordering exactly (handler layer).
- `ApplyMoveResult.reason` union was NOT widened — `MOVE_INVALID` + `detail: 'OFF_PITCH'` reuses the existing shape.

## Task Commits

1. **Task 1: GOAL_KICK_RESTART_HEX constant + shared tests** - `cf03e77` (feat, tdd)
2. **Task 2: Place ball AND goalkeeper at the fixed restart hex in triggerOutOfBoundsRestart** - `c1b71cb` (feat, tdd)
3. **Task 3: Close T-37-66 — on-pitch bounds guard for FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE** - `b138c29` (feat, tdd)

**Plan metadata:** (this commit, written by the continuation agent)

_Note: all three tasks are `tdd="true"`; each commit bundles its RED+GREEN work into a single `feat` commit rather than separate `test`/`feat` commits — verified against the actual diffs below, this does not violate the plan's TDD requirement since the plan's own acceptance criteria are red-first-proof based (temporarily break the implementation, confirm the test fails, restore), which this agent re-executed independently for all three tasks (see "Red-First Proofs" below)._

## Files Created/Modified

- `packages/shared/src/outOfBounds.ts` - Added `GOAL_KICK_RESTART_HEX` constant with full JSDoc (placed directly after the `MAX_Q`/`MAX_R` block)
- `packages/shared/src/outOfBounds.test.ts` - Added `describe('GOAL_KICK_RESTART_HEX')` block (7 tests): literal equality, mirror symmetry, `isPitchHex` membership, `FORMATIONS`-derived correctness, byline-centre row, `resolveThrowInHex` unoccupied/occupied behavior. Zero deletions — only appended tests.
- `packages/server/src/gameEngine.ts` - Rewrote the `GOAL_KICK` branch of `triggerOutOfBoundsRestart` (resolves `GOAL_KICK_RESTART_HEX[goalKickTeam]` via `resolveThrowInHex`, builds `repositionedPieces`, uses it for both the returned `pieces` field and `computeGoalKickEligibleIds`); added the `isPitchHex(to)` guard to `applyFreeMove`
- `packages/server/src/gameHandlers.ts` - Added payload-shape (`INVALID_TARGET`) and `isPitchHex` (`OFF_PITCH`) guards to the `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` `GAME_MOVE` branch, in that order, before the `applyMove` call
- `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` - Updated the one pre-existing test that encoded the drift defect (see "Pre-existing Test Updated" below); added a `triggerOutOfBoundsRestart GOAL_KICK placement (Plan 37-15)` describe block (7 tests) and an `applyFreeMove OFF_PITCH guard (Plan 37-15, closes T-37-66)` describe block (multiple tests covering both teams, both axes, precedence, and a positive control)

## Verification Evidence (from plan acceptance criteria)

### Task 1 — Line-number / grep proofs

- `grep -c 'GOAL_KICK_RESTART_HEX' packages/shared/src/outOfBounds.ts` → 2+ (declaration + JSDoc references), confirmed by inspection of the committed diff
- `outOfBounds.test.ts` imports and iterates `FORMATIONS` directly (`for (const formationId of Object.keys(FORMATIONS) ...)`), asserting each formation's `slots[0]` (`GK`) position against `GOAL_KICK_RESTART_HEX.home` — not a restated literal
- `git diff -U0 packages/shared/src/outOfBounds.test.ts` (cf03e77 vs. its parent) shows zero deletions — only appended tests

### Task 1 — Red-first proof (re-executed by this agent)

Temporarily set `GOAL_KICK_RESTART_HEX.away` from `{q:34,r:13}` to `{q:32,r:13}` in `outOfBounds.ts`, then ran `pnpm --filter @counter-attack/shared test -- outOfBounds`:

```
FAIL src/outOfBounds.test.ts > GOAL_KICK_RESTART_HEX > home equals { q: 2, r: 13 } and away equals { q: 34, r: 13 }
AssertionError: expected 32 to equal 34 (received `.away` = {q:32,r:13})

FAIL src/outOfBounds.test.ts > GOAL_KICK_RESTART_HEX > is mirror-symmetric: home.q + away.q === 36 and home.r === away.r
AssertionError: expected 34 to be 36 // Object.is equality (received home.q+away.q = 34)

FAIL src/outOfBounds.test.ts > GOAL_KICK_RESTART_HEX > home matches every formation's GK slot-0 position, and away matches its 36-q mirror (derived from FORMATIONS, not a restated literal)
AssertionError: expected { q: 34, r: 13 } to deeply equal { q: 32, r: 13 }

Test Files  1 failed (1)
     Tests  3 failed | 24 passed (27)
```

Restored `away` to `{q:34,r:13}`; re-ran: `Test Files 1 passed (1)` / `Tests 27 passed (27)`. Working tree confirmed clean (`git status --porcelain` empty) after restore.

### Task 2 — Line-number / grep proofs

- `computeGoalKickEligibleIds(repositionedPieces, goalKickTeam)` is at `packages/server/src/gameEngine.ts:3322` — receives the repositioned piece list, not `state.pieces`
- The `GOAL_KICK` branch contains `GOAL_KICK_RESTART_HEX` (line 3292) and exactly one `resolveThrowInHex` call (line 3294)
- `grep -v '^\s*[*/]' packages/server/src/__tests__/gameEngine.outOfBounds.test.ts | grep -c 'GOAL_KICK_RESTART_HEX'` returns well over 4 (the new describe block alone references it 11+ times)

### Task 2 — Pre-existing test updated (encoded the drift defect)

**Test:** `applyRoll LOOSE_BALL with outOfBoundsEnabled true — byline (OOB-04) > awards a goal kick to home when an away (attacking) touch crosses the home byline`

- **Before:** `expect(result.state.ball.position).toEqual(homeGK.position);`
- **After:** `expect(result.state.ball.position).toEqual(GOAL_KICK_RESTART_HEX.home);`
- This was the only pre-existing test asserting `ball.position === gk.position` — that assertion passed trivially under the old (defective) implementation because the engine wrote `gk.position` verbatim; it now asserts against the fixed constant instead, additionally proving the restart hex is not the drifted fixture position (`homeGK` fixture sits at `{q:3,r:5}`).

### Task 2 — Red-first proof (re-executed by this agent)

Reverted the `GOAL_KICK` branch of `triggerOutOfBoundsRestart` back to the pre-Task-2 defect (`ball.position: gk.position`, `ballAfter: { position: gk.position, ... }`, `goalKickEligibleIds: computeGoalKickEligibleIds(state.pieces, goalKickTeam)`, no `repositionedPieces`) while leaving Task 3's `applyFreeMove` guard untouched (single-file targeted edit, not `git stash`, per the destructive-git-command prohibition). Ran `pnpm --filter @counter-attack/server test -- gameEngine.outOfBounds`:

```
FAIL ... awards a goal kick to home when an away (attacking) touch crosses the home byline
  expected { q: 3, r: 5 } to deeply equal { q: 2, r: 13 }   (received = homeGK's drifted fixture position)

FAIL ... places ball.position at GOAL_KICK_RESTART_HEX.away and moves the away GK there for an away-byline exit awarding away
  expected { q: 33, r: 5 } to deeply equal { q: 34, r: 13 }   (received = awayGK's drifted fixture position)

FAIL ... places ball.position at GOAL_KICK_RESTART_HEX.home and moves the home GK there for a home-byline exit awarding home (mirror case)
  expected { q: 3, r: 5 } to deeply equal { q: 2, r: 13 }

FAIL ... returns a keeper that had drifted far from goal (homeGK fixture at {q:3,r:5}) to GOAL_KICK_RESTART_HEX.home
  expected { q: 3, r: 5 } to deeply equal { q: 2, r: 13 }

FAIL ... the appended OUT_OF_BOUNDS event's ballAfter.position equals the resolved restart hex, not the keeper's prior position
  expected { position: { q: 3, r: 5 }, carrierId: 'home-gk' } to deeply equal { position: { q: 2, r: 13 }, carrierId: 'home-gk' }

FAIL ... computes goalKickEligibleIds from the POST-placement piece list ...
  expected [] to include 'home-gk'

Test Files  1 failed (1)
     Tests  6 failed | 101 passed (107)
```

Every received value in the placement failures is the keeper's (drifted) fixture position, confirming the fix is load-bearing. Restored via `git checkout HEAD -- packages/server/src/gameEngine.ts`; re-ran: `Test Files 1 passed (1)` / `Tests 107 passed (107)`. Working tree confirmed clean after restore.

### Task 2 — throwIn.integration regression check

`pnpm --filter @counter-attack/server test -- throwIn.integration` → **15 passed (15)**, file byte-unchanged (`git diff cf03e77 HEAD -- packages/server/src/__tests__/throwIn.integration.test.ts` is empty) — the `THROW_IN` branch was not disturbed.

### Task 2 — goalKick.integration regression check

`pnpm --filter @counter-attack/server test -- goalKick.integration` → **30 passed (30)**, file byte-unchanged (`git diff cf03e77 HEAD -- packages/server/src/__tests__/goalKick.integration.test.ts` is empty) — no assertion in that file depended on the pre-fix behavior.

### Task 3 — Line-number / grep proofs

`applyFreeMove` guard ordering (`packages/server/src/gameEngine.ts`):

- Line 537: `if (hexDistance(piece.position, to) !== 1) { ... OUT_OF_RANGE ... }` (adjacency check)
- Line 545: `if (!isPitchHex(to)) { ... OFF_PITCH ... }` (new guard)
- Line 548: `if (state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r)) { ... OCCUPIED ... }` (occupancy check)

537 < 545 < 548 — confirmed strictly ordered as required.

Handler guard ordering (`packages/server/src/gameHandlers.ts`, `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` branch):

- Line 649: `typeof to.r !== 'number'` (payload-shape check, part of the guard clause)
- Line 655: `if (!isPitchHex(to)) { ... OFF_PITCH ... }`
- Line 660: `const freeMoveResult = applyMove(room.gameState, pieceId, to);`

649 < 655 < 660 — confirmed strictly ordered as required. `ApplyMoveResult`'s `reason` union is unwidened (`MOVE_INVALID` + `detail: 'OFF_PITCH'` reuses the existing shape already used by `applyGoalKickReposition`).

### Task 3 — Red-first proof (re-executed by this agent)

Temporarily commented out the `if (!isPitchHex(to)) { return { ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' }; }` block inside `applyFreeMove` (single targeted edit distinguished from the identical-looking guard in `applyGoalKickReposition` by surrounding context). Ran `pnpm --filter @counter-attack/server test -- gameEngine.outOfBounds`:

```
FAIL applyFreeMove OFF_PITCH guard (Plan 37-15, closes T-37-66) > FREE_MOVE_ATTACK: eligible piece at {q:0,r:5} attempting {q:-1,r:5} returns MOVE_INVALID/OFF_PITCH
  expected { ok: true, state: {...} } to deeply equal { ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' }

FAIL applyFreeMove OFF_PITCH guard (Plan 37-15, closes T-37-66) > FREE_MOVE_ATTACK: eligible piece at {q:5,r:0} attempting {q:5,r:-1} returns MOVE_INVALID/OFF_PITCH (gap is not q-only)
  expected { ok: true, state: {...} } to deeply equal { ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' }

FAIL applyFreeMove OFF_PITCH guard (Plan 37-15, closes T-37-66) > FREE_MOVE_DEFENSE: eligible piece at {q:36,r:20} attempting {q:37,r:20} returns MOVE_INVALID/OFF_PITCH
  expected { ok: true, state: {...} } to deeply equal { ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' }

FAIL applyFreeMove OFF_PITCH guard (Plan 37-15, closes T-37-66) > FREE_MOVE_DEFENSE: eligible piece at {q:20,r:25} attempting {q:20,r:26} returns MOVE_INVALID/OFF_PITCH
  expected { ok: true, state: {...} } to deeply equal { ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' }

Test Files  1 failed (1)
     Tests  4 failed | 103 passed (107)
```

Exactly the four new `OFF_PITCH` cases failed (all others, including `WRONG_TEAM`/`NOT_ELIGIBLE`/`OCCUPIED`/`FREE_MOVE_EXHAUSTED` precedence tests and the positive-control 6-hex-budget walk, still passed). Restored via `git checkout HEAD -- packages/server/src/gameEngine.ts`; re-ran: `Test Files 1 passed (1)` / `Tests 107 passed (107)`. Working tree confirmed clean after restore.

## Before/After Test Totals

| Package                  | Baseline (post-37-14 / post-37-13)                     | After this plan (Tasks 1-3)                    | Delta                                                                                                           |
| ------------------------ | ------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@counter-attack/shared` | 643 passed (per 37-14-SUMMARY.md)                      | **650 passed** (14 files)                      | +7 (Task 1's `GOAL_KICK_RESTART_HEX` describe block)                                                            |
| `@counter-attack/server` | 785 passed / 1 skipped / 1 todo (per 37-13-SUMMARY.md) | **799 passed / 1 skipped / 1 todo** (36 files) | +14, zero failures                                                                                              |
| `@counter-attack/client` | 547 passed (per 37-13-SUMMARY.md, unchanged)           | **581 passed** (28 files)                      | pure regression check — no client file modified; delta reflects unrelated prior-plan client work, zero failures |

One server-suite run during this agent's re-verification hit a transient `Worker exited unexpectedly` infra error (35/36 files completed before the crash) — re-ran immediately and got a clean `36 passed (36)` / `799 passed | 1 skipped | 1 todo`, reproduced twice. Not a code regression; flagged here for transparency per the plan's verbatim-recording requirement.

`pnpm typecheck` (monorepo-wide, all 3 packages) exits 0.

## Undo/Replay Registration Checklist — Confirmed N/A

No new `ActionEventType` was introduced by this plan. `git diff cf03e77 HEAD --stat` shows zero changes to `packages/shared/src/events.ts` or any other event-type-defining file. The `OUT_OF_BOUNDS` event already existed (added in an earlier plan); this plan only corrects its `ballAfter` payload values. The `isBoundary` / `REPLAY_ELIGIBLE_TYPES` / `ELIGIBLE_NEXT_ACTIONS` checklist that `STATE.md` warns about for new event types does not apply here, as anticipated by the plan's "Deliberately NOT done" section.

## Decisions Made

All six locked decisions (D-15-01 through D-15-06) were implemented exactly as specified in the plan — see `key-decisions` in the frontmatter above. No deviations from the plan's decision set.

## Deviations from Plan

None — plan executed exactly as written by the original executor. This agent's only actions were re-verification (independently re-running all specified test suites and all three red-first proofs against the actual committed code) and writing this SUMMARY, which the original executor had not yet done when it hit an API session-quota limit.

## Issues Encountered

- One transient `Worker exited unexpectedly` vitest infra error during this agent's re-verification of the full server suite (see "Before/After Test Totals" above). Immediately reproducible as a clean pass on re-run; not connected to any code change in this plan and not treated as a deviation.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**BLOCKED on Task 4 (checkpoint:human-verify, gate="blocking").** Tasks 1-3 are code-complete, fully tested (all automated verification and both red-first proofs pass), and committed. The plan's own `<success_criteria>` explicitly requires "The user has confirmed the restart coordinate, so the value is a decision rather than an inference" — this has not happened. Task 4 asks the user to:

1. Verify in a live two-tab match that a goal kick restarts both the ball and the goalkeeper at the same fixed byline-centre hex, including after the keeper has drifted away from goal.
2. Explicitly confirm or correct the restart coordinate: the plan implemented `{q:2,r:13}` (home) / `{q:34,r:13}` (away), derived from the goalkeeper's canonical formation slot; the original UAT note said "34,13 or 4, 13", and `4` does not mirror to `34` (`4` mirrors to `32`; `34` mirrors to `2`), so one of the two UAT numbers appears to be a slip that this plan surfaces back to the user rather than guessing at.
3. Confirm the two 6-hex reposition windows behave sensibly from the corrected starting position.

If the user requests a different home-side hex, the change is a one-line edit to `GOAL_KICK_RESTART_HEX` in `packages/shared/src/outOfBounds.ts` (its away mirror is derived as `36 - q`). Do not mark `OOB-04`/`GOALKICK-01`/`GOALKICK-02` complete in `REQUIREMENTS.md`, advance `STATE.md`'s plan counter, or run `roadmap.update-plan-progress` until Task 4 is resolved — that finalization is deferred to whichever agent handles the checkpoint response.

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Completed (Tasks 1-3 only; Task 4 pending): 2026-08-05_
