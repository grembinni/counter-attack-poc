---
phase: 38-corner-kick
plan: 04
subsystem: game-engine
tags: [typescript, game-engine, corner-kick, dice-accuracy, undo, replay, vitest]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 03)
    provides: 'CORNER_KICK_REPOSITION (6-stage alternating window) and CORNER_KICK_FINAL_SETUP
      (pre-kick 1-per-team window), terminating in PASS with lastActionType
      CORNER_KICK_RESTART and cornerKickTeam/cornerKickHex/cornerKickTakerId preserved'
provides:
  - 'applyRoll PASS-case corner accuracy gate: a corner Low pass (STANDARD_PASS +
    cornerKickTeam set) is now accuracy-gated at the same 8+ combined-score HIGH threshold
    as High Pass (CORNER-04); a corner High pass reaches HEADER via the pre-existing,
    unmodified HIGH_PASS transition (CORNER-05 required no code change)'
  - 'Dedicated CORNER_KICK_ACCURACY ActionEvent emission on both the accurate and inaccurate
    corner paths, including the High-corner case which also keeps HP_ACCURACY unbroken'
  - 'Interception-loop bypass for any corner delivery (Assumption A2), extending the existing
    header-pass/FIRST_TIME_PASS bypass condition'
  - 'applyUndo Undo-boundary registration: CORNER_KICK_STAGE_ADVANCE and
    CORNER_KICK_TAKER_PLACED as phase-scoped boundaries in CORNER_KICK_REPOSITION;
    CORNER_KICK_STAGE_ADVANCE also a boundary in CORNER_KICK_FINAL_SETUP'
  - 'REPLAY_ELIGIBLE_TYPES registration for CORNER_KICK_TAKER_PLACED and
    CORNER_KICK_ACCURACY, plus a buildReplayFrames moveGroup arm for
    CORNER_KICK_TAKER_PLACED (mirrors THROW_IN_PLACE)'
  - 'CORNER_KICK_TEARDOWN shared literal (mirrors THROW_IN_TEARDOWN): nulls all 10
    cornerKick* fields, applied unconditionally at every PASS-case return a corner can
    resolve into — closes T-38-14 (stale corner context mis-gating a later pass)'
affects: [38-05, 38-06, 38-07, 38-08, 38-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Accuracy-gate extension: requiresAccuracyCheck gained a third disjunct
      (cornerKickTeam != null && lastActionType === STANDARD_PASS) rather than a parallel
      pass-resolution pipeline — the persistent cornerKickTeam field (not lastActionType)
      is the corner signal, since the GAME_ROLL handler overwrites lastActionType with the
      clients chosen passType before applyRoll runs'
    - 'Shared unconditional teardown literal spread at every resolving return, rather than
      three conditional (if cornerKickTeam) variants — a no-op for non-corner passes,
      simpler and safer per the plans explicit instruction'
    - 'CORNER_KICK_TAKER_PLACED modeled on THROW_IN_PLACE for buildReplayFrames (piece
      repositioning + ball move, needs its own moveGroup arm); CORNER_KICK_ACCURACY modeled
      on GOAL_KICK (needs no special case — the generic ballAfter-driven path covers it)'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts

key-decisions:
  - "A corner arm was inserted BEFORE the pre-existing `state.lastActionType as 'HIGH_PASS'
    | 'LONG_BALL'` cast in the inaccurate-pass branch, with an early return — that cast was
    only ever sound because STANDARD_PASS could never reach the inaccurate branch before
    corners existed; the corner arm returns before it, so the cast is now provably
    unreachable for corner passes (verified via acceptance-criteria grep: exactly 1 surviving
    occurrence)"
  - 'CORNER_KICK_ACCURACY is logged BEFORE the per-type delivery event (STANDARD_PASS/
    HP_ACCURACY) on both the accurate and inaccurate paths, so the ActionLog reads
    [accuracy check, outcome] in narrative order'
  - 'Interception bypass extended with a new isCornerKick flag alongside the existing
    isHeaderPass/isFirstTimePass flags, rather than folding cornerKickTeam into those
    checks — keeps each bypass reason independently readable/testable'
  - 'CORNER_KICK_TEARDOWN applied unconditionally at 5 physical PASS-case return sites
    (corner-inaccurate early return, accurate-High no-eligible-players LOOSE_BALL,
    accurate-High HEADER entry, accurate-Low occupant-pickup delivery, accurate-Low
    fallback delivery) — all 5 are reachable by both corner and non-corner passes except
    the first, and spreading already-null fields is a documented no-op'
  - 'No additional teardown code was added at the goal-scored or kick-off-reset paths
    (applyDeclareShot GOAL branches, applyHalfTimeStart): cornerKickTeam is unconditionally
    null by the time SHOT/GOAL is reachable, because this plans applyRoll teardown runs
    before the ball can ever leave the PASS phase after a corner — their existing
    `...state` spreads already carry the guaranteed-null value forward correctly'

patterns-established:
  - 'Corner Kicks accuracy-gate/event-emission/teardown code is laid out as the third
    disjunct/branch/return-site addition inside applyRolls existing PASS case, continuing
    the extend-dont-duplicate convention used by 38-02/38-03s sequential top-to-bottom
    engine-function layout'

requirements-completed: [CORNER-04, CORNER-05]

# Metrics
duration: ~50min
completed: 2026-08-07
---

# Phase 38 Plan 04: Corner Kick Resolution — Accuracy Gate, Events & Context Teardown Summary

**Corner Low pass now rolls the same 8+ combined-score accuracy check as High Pass via a
third `requiresAccuracyCheck` disjunct (not a parallel pipeline); every corner resolution
emits a dedicated `CORNER_KICK_ACCURACY` event registered in Undo boundaries and Replay
eligibility; all 10 `cornerKick*` context fields are unconditionally torn down on every
PASS-case branch a corner can resolve into, closing the stale-context leak (T-38-14) that a
census found already existed via `applyCornerKickFinalSetupEnd`'s terminal return.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-07
- **Tasks:** 3 completed
- **Files modified:** 2

## Accomplishments

- **CORNER-04 accuracy gate:** `requiresAccuracyCheck` extended with
  `(state.cornerKickTeam != null && state.lastActionType === 'STANDARD_PASS')`. A corner Low
  pass resolves to the default `'HIGH'` accuracy type (threshold 8) without adding a new
  accuracy type to `validatePassAccuracy` — CORNER-04's "same 8+ combined-score check as High
  Pass" requirement falls out for free from the existing default branch.
- **CORNER-05 confirmed free:** the pre-existing `HIGH_PASS` → `HEADER` transition already
  fires unconditionally on any accurate High Pass delivery, corner or not — no code change
  needed, only a test proving it.
- **Dedicated `CORNER_KICK_ACCURACY` event** appended on both branches: inaccurate corners get
  an early-return arm inserted before the previously-unsound
  `state.lastActionType as 'HIGH_PASS' | 'LONG_BALL'` cast (that cast could never previously
  execute for a `STANDARD_PASS` lastActionType before corners existed — now provably
  unreachable for corners, since the new arm returns first); accurate corners get the event
  logged before the per-type delivery event. High corners keep `HP_ACCURACY` alongside the new
  event on both paths so the existing High Pass ActionLog narration is unbroken.
- **Interception bypass (Assumption A2):** a new `isCornerKick` flag extends the existing
  `isHeaderPass`/`isFirstTimePass` bypass — no corner delivery (High or Low) is interceptable,
  mirroring `HIGH_PASS`/`LONG_BALL`'s fly-over behaviour.
- **Undo boundaries (T-38-16):** `applyUndo`'s `isBoundary` reduce gained two phase-scoped
  arms — `CORNER_KICK_STAGE_ADVANCE`/`CORNER_KICK_TAKER_PLACED` as boundaries during
  `CORNER_KICK_REPOSITION`, and `CORNER_KICK_STAGE_ADVANCE` as a boundary during
  `CORNER_KICK_FINAL_SETUP` — Undo can never cross a stage handoff into the opposing
  manager's completed round, nor un-place the corner-taker.
- **Replay eligibility (T-38-15):** `CORNER_KICK_TAKER_PLACED` and `CORNER_KICK_ACCURACY`
  added to `REPLAY_ELIGIBLE_TYPES` (both carry `ballAfter`); `CORNER_KICK_STAGE_ADVANCE`,
  `CORNER_KICK_GK_PLACE` and `CORNER_KICK_MOVE` deliberately excluded (no `ballAfter`,
  matching the `GOAL_KICK_MOVE` precedent). `buildReplayFrames` gained a dedicated
  `CORNER_KICK_TAKER_PLACED` moveGroup arm (mirrors `THROW_IN_PLACE` — piece repositioning
  plus a ball move); `CORNER_KICK_ACCURACY` needed no special case since the function's
  generic `ballAfter`-driven update already covers it (mirrors `GOAL_KICK`).
- **Context teardown audit (Pitfall 3, T-38-14):** a `cornerKick` census across the whole
  file (see table below) confirmed `cornerKickTeam`/`cornerKickHex`/`cornerKickTakerId`
  survive every intermediate `CORNER_KICK_*` phase transition unchanged, and found ONE
  pre-existing leak: `applyCornerKickFinalSetupEnd`'s DEFENDER-slot terminal `PASS` return
  explicitly carries `cornerKickTeam`/`cornerKickHex`/`cornerKickTakerId` forward (by design,
  per 38-03's Pitfall 3 note) but silently also carries `cornerKickEligibleIds` and
  `cornerKickUsedPace` into `PASS` via the `...state` spread — unnoticed until this plan's
  audit, and now closed by the unconditional `CORNER_KICK_TEARDOWN` spread added to every
  PASS-case resolving return.
- **31 new tests** across the 3 tasks (Task 1: 20, Task 2: 11, Task 3: 4 plus reuse of Task
  1/2 fixtures) in `gameEngine.cornerKick.test.ts`; full server suite green throughout
  (901 → 908 → 912 tests, 37 files, 1 skipped/1 todo pre-existing, no regressions).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend applyRoll's PASS case with the corner accuracy gate (CORNER-04/CORNER-05)** — `e6a1b28` (feat)
2. **Task 2: Register the new corner events with Undo boundaries and replay eligibility** — `a7a015d` (feat)
3. **Task 3: Corner-context persistence and teardown audit (Pitfall 3)** — `dd7f63c` (feat)

_Note: no plan-metadata commit is created by a worktree-isolated executor — the orchestrator handles final metadata commits after merge._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — extended `requiresAccuracyCheck`; added the corner
  inaccurate-branch early-return arm; added corner accurate-path `CORNER_KICK_ACCURACY`
  event logging; extended the interception-loop bypass with `isCornerKick`; added two
  `isBoundary` arms to `applyUndo`; added `CORNER_KICK_TAKER_PLACED`/`CORNER_KICK_ACCURACY`
  to `REPLAY_ELIGIBLE_TYPES`; added a `CORNER_KICK_TAKER_PLACED` moveGroup arm in
  `buildReplayFrames`; added the shared `CORNER_KICK_TEARDOWN` literal and spread it into 5
  PASS-case resolving returns.
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` — added `applyRoll`/
  `applyUndo`/`buildReplayFrames` imports and `cornerKickStageTeam` shared import; added
  `baseCornerPassState`/`cornerLowState`/`cornerHighState`/`ordinaryStandardPassState`
  fixtures; added 3 new `describe` blocks (accuracy gate, Undo/Replay eligibility,
  persistence/teardown audit) totaling 31 new tests, including a
  `runCornerSequenceToPass()` integration helper that drives the full
  `triggerOutOfBoundsRestart` → `applyCornerKickFinalSetupEnd` chain with Pitfall-3
  non-null assertions at every step.

## cornerKick Census (Task 3 Pitfall-3 audit)

Every `cornerKick*`-field write site in `gameEngine.ts`, classified as **carry-forward**
(context populated/threaded through the corner sequence, pre-resolution) or **teardown**
(this plan's new unconditional nulling at PASS-case resolution):

| Site (function)                                                               | Fields written                                                                                                                                                                                                                                                                                                                              | Classification                                                  |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `triggerOutOfBoundsRestart` CORNER_KICK branch                                | Sets `cornerKickTeam`, `cornerKickHex`; explicitly nulls the other 8 fields                                                                                                                                                                                                                                                                 | carry-forward (initiation)                                      |
| `applyCornerKickGkWindowEnd` (x2 transitions)                                 | No `cornerKick*` field writes (reads `cornerKickTeam` only)                                                                                                                                                                                                                                                                                 | carry-forward                                                   |
| `applyCornerKickTakerSelect`                                                  | Sets `cornerKickHex` (resolved), `cornerKickTakerId`, `cornerKickEligibleIds`, `cornerKickStageIndex:0`, `cornerKickStagePlacedIds:[]`, `cornerKickUsedPace:{}`                                                                                                                                                                             | carry-forward                                                   |
| `applyCornerKickReposition`                                                   | Updates `cornerKickUsedPace`, `cornerKickStagePlacedIds`                                                                                                                                                                                                                                                                                    | carry-forward                                                   |
| `applyCornerKickStageEnd` (stages 0-4)                                        | Updates `cornerKickStageIndex`, `cornerKickStagePlacedIds`; leaves `cornerKickUsedPace`/`cornerKickEligibleIds` untouched (Pitfall 4)                                                                                                                                                                                                       | carry-forward                                                   |
| `applyCornerKickStageEnd` (terminal, stage 5→FINAL_SETUP)                     | Nulls `cornerKickStageIndex`/`cornerKickStagePlacedIds`; sets `cornerKickMoveSlot:'ATTACKER'`; leaves `cornerKickUsedPace`/`cornerKickEligibleIds` set (documented, CORNER-06 reuses the pools)                                                                                                                                             | carry-forward                                                   |
| `applyCornerKickFinalMove`                                                    | Updates `cornerKickMovedPieceId`, `cornerKickPaceUsed`                                                                                                                                                                                                                                                                                      | carry-forward                                                   |
| `applyCornerKickFinalSetupEnd` (ATTACKER-slot end)                            | Flips `cornerKickMoveSlot` to `'DEFENDER'`; resets `cornerKickMovedPieceId`/`cornerKickPaceUsed`                                                                                                                                                                                                                                            | carry-forward                                                   |
| `applyCornerKickFinalSetupEnd` (DEFENDER-slot end, terminal → PASS)           | Explicitly carries `cornerKickTeam`/`cornerKickHex`/`cornerKickTakerId` forward (Pitfall 3, by design); nulls `cornerKickMoveSlot`/`cornerKickMovedPieceId`/`cornerKickPaceUsed`; **leaves `cornerKickEligibleIds`/`cornerKickUsedPace` set** — this was the one pre-existing leak into `PASS`, now closed by Task 3's `applyRoll` teardown | carry-forward into PASS (partial pre-existing leak — see below) |
| `applyRoll` PASS case — corner-inaccurate early return (Task 1/3)             | Reads `cornerKickTeam`/`cornerKickTakerId`; **nulls all 10 fields**                                                                                                                                                                                                                                                                         | **teardown (new, Task 3)**                                      |
| `applyRoll` PASS case — accurate-High no-eligible-players LOOSE_BALL (Task 3) | **Nulls all 10 fields** (unconditional, no-op for non-corner High Pass)                                                                                                                                                                                                                                                                     | **teardown (new, Task 3)**                                      |
| `applyRoll` PASS case — accurate-High HEADER entry (Task 3)                   | **Nulls all 10 fields** (unconditional, no-op for non-corner High Pass)                                                                                                                                                                                                                                                                     | **teardown (new, Task 3)**                                      |
| `applyRoll` PASS case — accurate-Low occupant-pickup delivery (Task 3)        | **Nulls all 10 fields** (unconditional, no-op for non-corner STANDARD_PASS/LONG_BALL)                                                                                                                                                                                                                                                       | **teardown (new, Task 3)**                                      |
| `applyRoll` PASS case — accurate-Low fallback delivery (Task 3)               | **Nulls all 10 fields** (unconditional, no-op for any non-corner pass type)                                                                                                                                                                                                                                                                 | **teardown (new, Task 3)**                                      |
| Goal-scored resets (`applyRoll` SHOT case, both GOAL branches)                | No `cornerKick*` writes — relies on `...state` spread                                                                                                                                                                                                                                                                                       | not touched — safe by construction (see Decisions)              |
| `applyHalfTimeStart` (kick-off reset)                                         | No `cornerKick*` writes — relies on `...state` spread                                                                                                                                                                                                                                                                                       | not touched — safe by construction (see Decisions)              |

## Decisions Made

See frontmatter `key-decisions` for the full list. Highlights:

- The corner-inaccurate early-return arm was placed BEFORE the pre-existing unsound
  `as 'HIGH_PASS' | 'LONG_BALL'` cast rather than modifying the cast itself, so the cast's
  existing HIGH_PASS/LONG_BALL-only contract stays intact and is now provably unreachable for
  corner passes (verified by the plan's own acceptance-criteria grep).
- `CORNER_KICK_TEARDOWN` is spread unconditionally rather than gated behind
  `if (state.cornerKickTeam != null)` at each of the 5 return sites — the plan explicitly
  sanctions this as simpler/safer than three conditional variants, and it doubles as a
  defence-in-depth guard against any future non-corner code path that might accidentally set
  a `cornerKick*` field.
- No new teardown code was needed at the goal-scored/kick-off-reset sites — verified by
  reading `applyDeclareShot`'s two GOAL branches and `applyHalfTimeStart`, neither of which
  ever writes a `cornerKick*` field, so their `...state` spreads already forward whatever
  value was there (guaranteed null post-Task-3).

## Deviations from Plan

None — plan executed exactly as written. All three tasks' `<action>`, `<behavior>`, and
`<acceptance_criteria>` items were implemented and verified as specified, including the
literal grep-based acceptance criteria (`cornerKickTeam != null` count, the unsound-cast
survivor count, `REPLAY_ELIGIBLE_TYPES` exclusions).

## Issues Encountered

- The comment text originally drafted for the corner-inaccurate arm literally contained the
  string `state.lastActionType as 'HIGH_PASS' | 'LONG_BALL'`, which would have made the
  acceptance-criteria grep (`at most 1` occurrence of that exact cast) fail even though the
  actual code only has one real cast. Reworded the comment to reference `inaccuratePassType`
  instead of repeating the literal cast expression — a documentation-only fix, no behavior
  change.
- The worktree had no `node_modules` installed at plan start (matching 38-03's note — each
  plan's worktree is independent). Ran `pnpm install --frozen-lockfile` from the worktree
  root; resolved cleanly with 543 packages linked, no junction workaround needed.
- A first draft of the `applyUndo` boundary test asserted `NOTHING_TO_UNDO` for a second
  Undo call after the post-boundary move was already undone; the actual (and correct, per
  D-09) result is `UNDO_LOCKED`, since a pre-boundary move genuinely exists but is locked
  out by the `CORNER_KICK_STAGE_ADVANCE` boundary. Corrected the test expectation — this is
  the more precise assertion of the two, since it proves the boundary recognizes the
  existence of the pre-boundary move rather than merely finding nothing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Corner Kick's own dedicated resolution pipeline (accuracy gate, event, Undo/Replay
  registration, context teardown) is complete and independently unit-tested.
- No socket handler wiring exists yet for the `CORNER_KICK_REPOSITION`/
  `CORNER_KICK_FINAL_SETUP` movement windows — that remains explicitly out of scope per
  38-03's note (38-05 wires the `GAME_MOVE` handler reuse) and this plan's own scope (Task 1
  only extends `applyRoll`, which is called after the client's `GAME_ROLL` request).
  `applyUndo`'s new boundary arms are written against the `MOVE`-type event that 38-05's
  handler wiring will emit for `CORNER_KICK_REPOSITION` (via `moveTypeForPhase`'s existing
  `'MOVE'` fallback) — verified in this plan's own Undo tests using that same event shape.
- `pnpm --filter @counter-attack/server build` and the full server test suite (912 tests, 37
  files) are green — no regressions in goal-kick, free-kick, throw-in, or any pre-existing
  pass-type flow.

## Known Stubs

None — this plan implements complete, functioning engine logic for every behavior it covers;
no placeholder/mock data paths were introduced.

## Threat Flags

None — the plan's own threat model (T-38-13 through T-38-16, T-38-SC) was fully addressed as
designed: `requiresAccuracyCheck` is derived entirely server-side from `state.cornerKickTeam`

- `state.lastActionType`, neither of which the client supplies directly (T-38-13); the new
  `CORNER_KICK_TEARDOWN` literal plus the load-bearing regression test close T-38-14; the
  dedicated `CORNER_KICK_ACCURACY` event type (never `DICE_ROLL`) registered in
  `REPLAY_ELIGIBLE_TYPES` closes T-38-15; the two new `applyUndo` boundary arms close T-38-16;
  no package-manager installs of new dependencies occurred (T-38-SC — the `pnpm install` above
  only reified the existing lockfile).

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.cornerKick.test.ts
- FOUND: commit e6a1b28
- FOUND: commit a7a015d
- FOUND: commit dd7f63c
- Working tree clean after final commit (pending SUMMARY.md commit)

---

_Phase: 38-corner-kick_
_Completed: 2026-08-07_
