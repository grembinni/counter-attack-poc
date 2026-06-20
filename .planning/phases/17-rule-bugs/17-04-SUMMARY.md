---
phase: 17-rule-bugs
plan: 04
subsystem: game-engine
tags: [free-move, move-06, ball-zone, fsm, socket.io, react]

# Dependency graph
requires:
  - phase: 17-rule-bugs
    provides: "Phase 17 D-01..D-32 fixes (BUG-01..05, MOVE-06 scaffolding, offside design); plan 17-01's freeMoveEligibleIds/freeMoveUsedPace field scaffolding"
provides:
  - 'MOVE-06 fully implemented per the corrected rulebook design (D-33..D-38): ball-zone-triggered free 6-hex move for all opposite-third players of both teams, sequenced attack-then-defense'
  - 'applyFreeMoveZoneCheck centralized trigger, wired into broadcastState as the single ARCH-04 hook'
  - 'computeBallZone shared utility'
affects: [17-05, 17-06, future-rule-fix-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centralized post-action overlay check (applyFreeMoveZoneCheck in broadcastState) instead of per-handler trigger detection — any future 'fires after any action' rule should follow this same single-hook pattern."
    - "Two-sub-phase sequencing (FREE_MOVE_ATTACK -> FREE_MOVE_DEFENSE -> resume) with a freeMoveResume snapshot to restore phase/activeTeam — reusable pattern for any future 'both teams act, one after another, then resume' rule."

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/pitch.ts
    - packages/shared/src/pitch.test.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/roomStore.ts
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/mock/mockMovementState.ts
    - packages/client/src/mock/mockPassState.ts
    - packages/client/src/mock/mockShotState.ts
    - packages/client/src/mock/mockGKRestartState.ts
    - packages/server/src/__tests__/gameEngine.phase17.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17.test.ts
    - packages/server/src/__tests__/roomStore.test.ts
    - packages/server/src/__tests__/gameEngine.test.ts
    - packages/server/src/__tests__/gameEngine.phase8.test.ts
    - packages/server/src/__tests__/gameEngine.phase10.test.ts
    - packages/server/src/__tests__/gameEngine.rule11.test.ts
    - packages/server/src/__tests__/gameHandlers.test.ts
    - packages/server/src/__tests__/gameHandlers.phase10.test.ts
    - packages/server/src/__tests__/shotGkRange.test.ts
    - packages/server/src/__tests__/game.integration.test.ts
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - 'D-33..D-38 (CONTEXT.md addendum, 2026-06-20): supersedes D-12..D-16 — trigger is ball-position-based (any action, not just MOVEMENT End Turn), eligibility is ALL players of both teams including GK in the opposite final third, two sequential sub-phases with attacking team moving first.'
  - 'applyFreeMoveZoneCheck runs centrally in broadcastState (single ARCH-04 hook) rather than being duplicated per-handler.'
  - 'freeMoveResume snapshots {phase, activeTeam} at trigger time so the overlay can restore exactly what the triggering action already computed as next, including dynamic activeTeam cases (HIGH_PASS_MOVEMENT, D-30 mid-slot pickups).'
  - 'freeMoveResume kept optional (not required) on GameState, consistent with sibling freeMoveEligibleIds/freeMoveUsedPace fields, to minimize required-field churn across existing fixtures.'

requirements-completed: [MOVE-06]

# Metrics
duration: ~90min (corrective rework after checkpoint correction)
completed: 2026-06-20
---

# Phase 17 Plan 04: MOVE-06 Free 6-Hex Move (Corrected Design) Summary

**Ball-zone-triggered free 6-hex move for all opposite-third players of both teams (GK included), sequenced attacking-team-first via FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE sub-phases, replacing the original carrier-crossing-during-MOVEMENT design that was found wrong against the physical rulebook mid-checkpoint.**

## IMPORTANT: Mid-checkpoint design correction

This plan's three original automated tasks (commits `1df51ad`, `89ca2e6`, `aa15b9c`) implemented a `FREE_MOVE` design based on decisions D-12 through D-16. During the Task 4 human-verify checkpoint, the user checked the implementation against the physical Counter Attack rulebook and found it **wrong**: the trigger, eligibility, and sequencing model did not match the real rule. D-12 through D-16 were marked SUPERSEDED in `17-CONTEXT.md` and replaced with the corrected design D-33 through D-38, captured from the rulebook text: _"If the ball is in one final third and any action has come to an end, all players in the opposite final third get a free move of 6 hexes each. Attacking team moves first."_

This SUMMARY covers the corrective rework (commits `f41b020`, `5efa415`, `e13015f`, `b91185e`) built on top of the original three commits — the original commits were **not** reverted or rebased; this is normal iterative history.

### What changed between the original (wrong) and corrected implementation

| Aspect      | Original (wrong, D-12..16)                                                                      | Corrected (D-33..38)                                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger     | Ball carrier crosses thirds _during MOVEMENT_, consumed at MOVEMENT End Turn only               | Ball's zone changes to a final third after _any_ resolved action, checked centrally after every broadcast                                                                          |
| Eligibility | Outfield (non-GK) players of the _crossing team only_, in the opponent's third                  | ALL players of _both teams_, GK included, in the _opposite_ final third from the ball                                                                                              |
| Sequencing  | Single `FREE_MOVE` phase, one team, ends on End Turn                                            | Two sequential sub-phases: `FREE_MOVE_ATTACK` (attacking team) then `FREE_MOVE_DEFENSE` (defending team), attacking team always moves first                                        |
| State shape | `pendingFreeMove: {team, hexesAllowed}` set inside `applyMove`; `freeMoveEligibleIds: string[]` | `ballZone: 'home'\|'middle'\|'away'` tracked continuously; `freeMoveEligibleIds: {attack, defense}`; `freeMoveResume: {phase, activeTeam}` to restore after both sub-phases finish |

## Performance

- **Duration:** ~90 min (corrective rework only; original 3-task implementation was a separate session)
- **Tasks:** 4 corrective commits (types, engine/handlers/roomStore wiring, client UI, test rewrite) on top of the original 3 task commits
- **Files modified:** 24 (3 shared, 3 server source, 6 client source/mocks, 12 test files)

## Accomplishments

- Replaced `pendingFreeMove` (removed entirely from `GameState`) with `ballZone` (always-present, tracks which final third the ball currently occupies) and `freeMoveResume` (snapshots phase/activeTeam to restore after the free-move sequence ends).
- Implemented `computeBallZone` in `packages/shared/src/pitch.ts`, exported and unit-tested for all three zone boundaries.
- Implemented `applyFreeMoveZoneCheck` in `gameEngine.ts` — the single centralized trigger, wired into `broadcastState` (`roomStore.ts`) immediately before every emit, so the rule fires after literally any resolved action with zero per-handler duplication.
- Split `GamePhase`'s `'FREE_MOVE'` into `'FREE_MOVE_ATTACK'` and `'FREE_MOVE_DEFENSE'`, with `freeMoveEligibleIds` now holding both teams' precomputed lists (`{attack, defense}`).
- Rewrote `applyFreeMoveEnd` for dual sub-phase transition logic: `FREE_MOVE_ATTACK` hands off to `FREE_MOVE_DEFENSE` when the defense list is non-empty, otherwise resumes immediately; `FREE_MOVE_DEFENSE` always resumes.
- Updated `gameHandlers.ts` GAME_MOVE/GAME_END_TURN branches and `ActionPanel.tsx`'s render branch for the two-phase model, with phase-aware "Attacking team" / "Defending team" helper text.
- Removed the old carrier-crossing detection block (~10 `pendingFreeMove` call sites) from `applyMove`, `applyEndTurn`, `applyUndo`, and kickoff/replay-frame state constructors.
- Rewrote all MOVE-06 unit/integration tests to match the corrected design (zone boundaries, GK eligibility, both-teams split, empty-list skipping in both directions, dual `applyFreeMoveEnd` transitions) and added `roomStore.test.ts` coverage proving `broadcastState` invokes the zone check.
- Fixed ~10 unrelated test fixtures across the server suite whose seeded ball positions happened to sit inside a final third without an explicit `ballZone` — these now mark the zone as already current so the new centralized check doesn't spuriously fire mid-test for scenarios unrelated to MOVE-06 (snapshot-shot regression tests, GK-restart tests, PASS-01 targetHex validation, etc.).

## Task Commits

Full commit history for this plan (original 3 + corrective rework):

| #   | Commit    | Type | What it did                                                                   |
| --- | --------- | ---- | ----------------------------------------------------------------------------- |
| 1   | `1df51ad` | feat | (Original, wrong design) applyEndTurn FREE_MOVE transition + applyFreeMoveEnd |
| 2   | `89ca2e6` | feat | (Original, wrong design) FREE_MOVE per-piece move handling in applyMove       |
| 3   | `aa15b9c` | feat | (Original, wrong design) Wire FREE_MOVE handlers + ActionPanel branch         |
| —   | `ce967b1` | docs | CONTEXT.md: correct MOVE-06 rule, supersede D-12..16, add D-33..37            |
| —   | `c894e5a` | docs | CONTEXT.md: refine D-36/D-38 — freeMoveResume captures activeTeam too         |
| 4   | `f41b020` | fix  | Corrected MOVE-06 types — ballZone/freeMoveResume replace pendingFreeMove     |
| 5   | `5efa415` | fix  | Implemented corrected MOVE-06 trigger — ball-zone-based, both teams           |
| 6   | `e13015f` | fix  | Updated ActionPanel/GameBoard for FREE_MOVE_ATTACK/DEFENSE phases             |
| 7   | `b91185e` | test | Rewrote MOVE-06 tests for corrected design, fixed incidental fixtures         |

**Plan metadata:** (this commit, to follow)

## Files Created/Modified

- `packages/shared/src/types.ts` — `GamePhase` splits `FREE_MOVE` into `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`; `GameState` drops `pendingFreeMove`, gains `ballZone` (required) and `freeMoveResume`; `freeMoveEligibleIds` reshaped to `{attack, defense}`.
- `packages/shared/src/pitch.ts` — adds `computeBallZone(position)`.
- `packages/shared/src/pitch.test.ts` — boundary tests for `computeBallZone`.
- `packages/server/src/gameEngine.ts` — `applyFreeMoveZoneCheck` (new centralized trigger), `applyFreeMoveEnd` (dual sub-phase transition), `applyFreeMove`/`applyMove` (phase-aware eligibility lookup), removed all `pendingFreeMove` plumbing.
- `packages/server/src/gameHandlers.ts` — GAME_MOVE/GAME_END_TURN branches accept both `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`.
- `packages/server/src/roomStore.ts` — `broadcastState` calls `applyFreeMoveZoneCheck` before emitting.
- `packages/client/src/components/ActionPanel.tsx` — two-phase render branch with attack/defense helper text.
- `packages/client/src/components/GameBoard.tsx` — `PHASE_LABEL` map updated for the two new phases.
- `packages/client/src/mock/*.ts` — mock fixtures updated for `ballZone`, `pendingFreeMove` removed.
- Server/client test files — see frontmatter `key-files.modified` for full list.

## Decisions Made

See `key-decisions` in frontmatter. All decisions are documented in `.planning/phases/17-rule-bugs/17-CONTEXT.md` as D-33 through D-38 (superseding D-12 through D-16).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] User-identified rulebook mismatch — entire MOVE-06 trigger/eligibility/sequencing model corrected**

- **Found during:** Task 4 human-verify checkpoint (first attempt)
- **Issue:** The original implementation (D-12..D-16) modeled MOVE-06 as a carrier-crossing-during-MOVEMENT trigger restricted to the crossing team's outfielders in a single `FREE_MOVE` phase. The user checked this against the physical rulebook and found the actual rule is ball-zone-based (fires after ANY action, not just MOVEMENT End Turn), applies to ALL players of both teams (GK included) in the opposite final third, and proceeds as two sequential sub-phases (attacking team first).
- **Fix:** Implemented the full corrected design as documented above — new `ballZone`/`freeMoveResume` state fields, centralized `applyFreeMoveZoneCheck` trigger in `broadcastState`, two-phase `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` sequencing, eligibility computed over both teams including GKs.
- **Files modified:** `packages/shared/src/types.ts`, `packages/shared/src/pitch.ts`, `packages/server/src/gameEngine.ts`, `packages/server/src/gameHandlers.ts`, `packages/server/src/roomStore.ts`, `packages/client/src/components/ActionPanel.tsx`, `packages/client/src/components/GameBoard.tsx`, mock fixtures, and all MOVE-06 test files.
- **Commits:** `f41b020`, `5efa415`, `e13015f`, `b91185e`

**2. [Rule 1 - Bug] Unrelated test fixtures spuriously triggered MOVE-06 after the centralized hook was wired in**

- **Found during:** Server test suite run after wiring `applyFreeMoveZoneCheck` into `broadcastState`
- **Issue:** ~10 pre-existing integration/handler tests across `gameEngine.test.ts`, `gameHandlers.test.ts`, `gameHandlers.phase10.test.ts`, `shotGkRange.test.ts`, and `game.integration.test.ts` seed a `room.gameState` directly with a ball position already inside a final third (e.g. deep in the away penalty area for shot tests), but never set `ballZone` explicitly — it defaulted to `'middle'` from the original kickoff state. Once `broadcastState` started running the zone check on every emit, these tests' first broadcast saw a "fresh" entry into a final third and correctly fired `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`, breaking assertions that expected the test's actual target phase (`SNAPSHOT_DEFLECT`, `GK_DIVE`, `MOVE`, `PASS`, etc.).
- **Fix:** Added `ballZone: computeBallZone(<seeded ball position>)` (or the equivalent literal) to each affected seed block, marking the zone as already current rather than freshly entered — these fixtures test other phases/rules, not MOVE-06, so they should not incidentally trip the new centralized check.
- **Files modified:** `packages/server/src/__tests__/gameEngine.test.ts`, `gameEngine.phase8.test.ts`, `gameEngine.phase10.test.ts`, `gameEngine.rule11.test.ts`, `gameHandlers.test.ts`, `gameHandlers.phase10.test.ts`, `shotGkRange.test.ts`, `game.integration.test.ts`.
- **Verification:** Full server test suite (338 tests) passes.
- **Committed in:** `b91185e`

---

**Total deviations:** 2 auto-fixed (1 rulebook-correction rewrite per explicit user instruction, 1 incidental-fixture bug caused by the rewrite's new centralized hook).
**Impact on plan:** The rulebook correction was the entire purpose of this corrective continuation, not scope creep. The incidental-fixture fix was a direct, in-scope consequence of wiring the new centralized check and was necessary to keep the existing test suite green.

## Issues Encountered

- The plan's design contract specified test expectations for one scenario ("eligibility includes GK and splits by attackingTeam") that, on first pass, had an incorrect expected phase in the authored test itself (expected `FREE_MOVE_DEFENSE` when the correct result per the implemented logic is `FREE_MOVE_ATTACK`, since the attack list was non-empty). Caught immediately by running the test suite; corrected the test assertion to match the documented D-35 rule ("attack list non-empty -> FREE_MOVE_ATTACK fires first").

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- MOVE-06 is now fully correct per the physical rulebook and ready for renewed human verification at the Task 4 checkpoint (see orchestrator return for the checkpoint text).
- Phases 17-05/17-06 (offside rule, OFFSIDE-01/02) are unaffected by this rework and can proceed independently once this checkpoint clears.
- No blockers. The centralized `applyFreeMoveZoneCheck` pattern (single hook in `broadcastState`) is reusable for any future "fires after any action" rule.

---

_Phase: 17-rule-bugs_
_Completed: 2026-06-20_

## Self-Check: PASSED

- FOUND: `.planning/phases/17-rule-bugs/17-04-SUMMARY.md`
- FOUND: commit `f41b020` (fix(17-04): correct MOVE-06 types)
- FOUND: commit `5efa415` (fix(17-04): implement corrected MOVE-06 trigger)
- FOUND: commit `e13015f` (fix(17-04): update ActionPanel/GameBoard)
- FOUND: commit `b91185e` (test(17-04): rewrite MOVE-06 tests)
- FOUND: commit `fd10053` (docs(17-04): add SUMMARY.md)
