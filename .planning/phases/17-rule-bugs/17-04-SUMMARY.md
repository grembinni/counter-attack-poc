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
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/store/useGameStore.ts
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
    - packages/client/src/components/HexGrid.test.tsx
    - packages/client/src/store/useGameStore.test.ts

key-decisions:
  - 'D-33..D-38 (CONTEXT.md addendum, 2026-06-20): supersedes D-12..D-16 — trigger is ball-position-based (any action, not just MOVEMENT End Turn), eligibility is ALL players of both teams including GK in the opposite final third, two sequential sub-phases with attacking team moving first.'
  - 'applyFreeMoveZoneCheck runs centrally in broadcastState (single ARCH-04 hook) rather than being duplicated per-handler.'
  - 'freeMoveResume snapshots {phase, activeTeam} at trigger time so the overlay can restore exactly what the triggering action already computed as next, including dynamic activeTeam cases (HIGH_PASS_MOVEMENT, D-30 mid-slot pickups).'
  - 'freeMoveResume kept optional (not required) on GameState, consistent with sibling freeMoveEligibleIds/freeMoveUsedPace fields, to minimize required-field churn across existing fixtures.'
  - 'Client click-to-move selection (HexGrid.tsx canSelectFreeMove, useGameStore.ts selectPiece/setGameState FREE_MOVE_ATTACK/DEFENSE branches) follows the HIGH_PASS_MOVE pattern exactly, but with no single-piece lock — any number of precomputed-eligible pieces may move independently, each capped at 6 hexes via freeMoveUsedPace.'

requirements-completed: [MOVE-06]

# Metrics
duration: ~90min (corrective rework after checkpoint correction) + ~30min (client-wiring fix, second checkpoint round)
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

- MOVE-06 is now fully correct per the physical rulebook AND fully wired client-side (see "Second checkpoint round" section below), ready for renewed human verification at the Task 4 checkpoint (see orchestrator return for the checkpoint text).
- Phases 17-05/17-06 (offside rule, OFFSIDE-01/02) are unaffected by this rework and can proceed independently once this checkpoint clears.
- No blockers. The centralized `applyFreeMoveZoneCheck` pattern (single hook in `broadcastState`) is reusable for any future "fires after any action" rule.

---

## IMPORTANT: Second checkpoint round — client click-to-move was never wired

After the corrected design above (commits `f41b020`..`b91185e`) reached the Task 4 human-verify
checkpoint a second time, the user manually tested it and reported: _"free move phase triggered
but no move was allowed. Expected to have eligible player highlighted to move. no players are
moveable."_

This was a distinct, narrower bug from the rulebook-design correction documented above. The
server-side trigger/eligibility/phase-sequencing logic (`applyFreeMoveZoneCheck`,
`freeMoveEligibleIds`, `freeMoveUsedPace`, the two-sub-phase FSM) was fully correct and fully
tested — but **nobody had ever wired the client's click-to-move interaction layer** for the new
`FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` phases:

- `packages/client/src/components/HexGrid.tsx` had no `canSelectFreeMove`-style branch among its
  per-phase piece-clickability flags (`canSelectHighPassMove`, `canSelectGKKickMove`, etc.) — so
  pieces in the opposite final third were never rendered as clickable/highlighted during these
  phases, and clicking one was a no-op.
- `packages/client/src/store/useGameStore.ts`'s `selectPiece(id)` had no
  `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` branch — even if a piece were clickable, no valid
  destination hexes would ever be computed.
- The same file's `setGameState` sticky-selection block (the one that keeps HIGH_PASS_MOVE/
  GK_KICK_MOVE/FIRST_TIME_PASS_MOVE pieces selected and re-highlighted across server broadcasts)
  also had no FREE_MOVE entry — so even after fixing the two issues above, a player would only be
  able to move a piece exactly 1 hex before losing the highlight, despite having up to 5 more
  hexes of budget remaining.

This gap was missed by both the original Task 3 (which only wired `gameHandlers.ts` and
`ActionPanel.tsx`) and the first MOVE-06 design-correction rework (which touched
`gameEngine.ts`/`gameHandlers.ts`/`ActionPanel.tsx`/`GameBoard.tsx` but never `HexGrid.tsx` or
`useGameStore.ts`'s selection logic) — neither task's scope included the piece-selection layer.

### What was fixed

- **`HexGrid.tsx`**: added `freeMoveEligibleIds`/`freeMoveUsedPace` store slices, a
  `canSelectFreeMove` flag (gated on active sub-phase side, active player, own team, eligibility
  list membership, and `freeMoveUsedPace[id] < 6`), wired into the combined `isClickable` check and
  the `handleClick` ternary chain — mirroring `canSelectHighPassMove`/`canSelectFirstTimePassMove`
  exactly. The hex-click-handling and hex-highlight-rendering code paths needed no changes — both
  are already phase-agnostic and consume the store's `validMoveHexes` automatically.
- **`useGameStore.ts` `selectPiece`**: added a `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` branch that
  rejects ineligible/wrong-team pieces, computes adjacent on-pitch unoccupied 1-hex-step
  destinations when budget remains, and selects-with-empty-hexes when the 6-hex cap is reached.
  Unlike `HIGH_PASS_MOVE`, there is no single-piece lock — any number of eligible pieces may be
  selected and moved independently.
- **`useGameStore.ts` `setGameState`**: added a separate, parallel sticky-selection block (not
  folded into the existing HIGH_PASS_MOVE/GK_KICK_MOVE/FIRST_TIME_PASS_MOVE block, since FREE_MOVE
  has no lock concept) that re-runs the same adjacent-hex computation after every server broadcast,
  keeping a selected piece highlighted until its budget is exhausted. The existing `phaseChanged`
  early-return guard already clears selection the instant `FREE_MOVE_ATTACK` hands off to
  `FREE_MOVE_DEFENSE` (or resumes) — per D-35, each sub-phase starts fresh with no carry-over
  selection, so no extra logic was needed for that transition.

### Deviation from plan

**[Rule 1 - Bug] Client-side click-to-move selection layer entirely unwired for FREE_MOVE_ATTACK/DEFENSE**

- **Found during:** Task 4 human-verify checkpoint (second attempt, after the rulebook-design correction above)
- **Issue:** Server logic was correct but no client code rendered eligible pieces as selectable or computed valid-move destinations for the new phases.
- **Fix:** Added `canSelectFreeMove` to `HexGrid.tsx`'s piece-clickability chain; added `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` branches to `useGameStore.ts`'s `selectPiece` and `setGameState`.
- **Files modified:** `packages/client/src/components/HexGrid.tsx`, `packages/client/src/store/useGameStore.ts`, plus new test coverage in `packages/client/src/components/HexGrid.test.tsx` and `packages/client/src/store/useGameStore.test.ts`.
- **Commits:** `daed61e` (fix), `e19760f` (test)

### Test coverage added

- `HexGrid.test.tsx`: 6 new cases — eligible piece selectable during FREE_MOVE_ATTACK, eligible piece selectable during FREE_MOVE_DEFENSE, ineligible own-team piece NOT selectable, pace-exhausted piece (`freeMoveUsedPace >= 6`) NOT selectable, opponent piece NOT selectable even if (incorrectly) listed, non-active player sees no selectable pieces. (One test helper bug caught and fixed during this work: the cosmos/home team's jersey `primaryColor` is `#3b82f6`, identical to the selectable-ring stroke color, so the initial color-only ring-detection helper false-positived on every home piece's base circle — fixed by also matching on ring radius `r=14`, distinct from the base circle's `r=12`.)
- `useGameStore.test.ts`: 6 new `selectPiece` cases (both sub-phases, eligible/ineligible/wrong-team/pace-exhausted/partial-pace) + 3 new `setGameState` sticky-selection cases (recompute across same-phase broadcast, empty hexes at cap, clear on ATTACK→DEFENSE phase change).

### Verification (second round)

All four commands passed:

- `pnpm --filter @counter-attack/client typecheck` — clean
- `pnpm --filter @counter-attack/client test` — 128 passed (10 files)
- `pnpm --filter @counter-attack/server test` — 338 passed, 1 skipped, 1 todo (20 files; no server files modified, confirms no regression)
- `pnpm --filter @counter-attack/shared typecheck` — clean

### Checkpoint status

Returning to the Task 4 `checkpoint:human-verify` a second time. Not simulated — the user must
verify two-browser-tab behavior directly. Expected behavior once verified: pieces in the opposite
final third highlight as selectable/clickable during `FREE_MOVE_ATTACK` (then
`FREE_MOVE_DEFENSE`), each can be moved up to 6 hexes total via repeated single-hex clicks
(selection persists and re-highlights after each accepted move, same UX as `HIGH_PASS_MOVE`), and
End Turn hand-off/resume behavior is unchanged from what was already verified in the prior round.

---

## IMPORTANT: Third checkpoint round — UX-parity addition (activated/abandoned-piece tracking)

After the client click-to-move wiring fix above reached the Task 4 checkpoint a third time, the
user manually tested MOVE-06 and confirmed it works functionally, but raised a UX-parity request
(not a bug): _"when hitting max free-move pace or when moving a new unit mark previous unit as
activated just like in the regular move phase."_

In regular MOVEMENT, `applyMove` marks a piece "activated" (added to `movedPieceIds`) in two
cases — exhaustion (the piece's own pace is fully used) and abandonment (the player starts
moving a different piece while another piece has a partial, unfinished activation). The client
already renders any piece in `movedPieceIds` with the `'activated'` visual (orange ring + red X)
for every phase except `HIGH_PASS_MOVE` via `HexGrid.tsx`'s generic `isSpentNow` ternary, and
`useGameStore.ts`'s `setGameState` already auto-deselects a piece the instant it appears in
`movedPieceIds` (the `activationComplete` guard). Neither of these needed to change. The gap was
entirely that `applyFreeMove`/`applyFreeMoveZoneCheck`/`applyFreeMoveEnd` never populated or reset
`movedPieceIds` for the FREE_MOVE sub-phases.

### What was fixed

- **`applyFreeMove`** (`gameEngine.ts`): now rejects a move if `pieceId` is already in
  `state.movedPieceIds` (`FREE_MOVE_EXHAUSTED`). On each accepted step, mirrors regular
  MOVEMENT's exhaustion+abandonment rule exactly: if the piece's cumulative `freeMoveUsedPace`
  reaches 6 after this step, it is added to `movedPieceIds`; if this step is a brand-new
  activation (`usedSoFar === 0`) on a DIFFERENT piece while some other piece has an in-progress,
  unfinished free-move activation (present in `freeMoveUsedPace`, not yet in `movedPieceIds`),
  that other piece is abandoned and also added to `movedPieceIds`.
- **`applyFreeMoveZoneCheck`** (`gameEngine.ts`): the trigger-fire transition now also resets
  `movedPieceIds: []` — closing a latent bug where a piece left in `movedPieceIds` from whatever
  phase/action preceded the trigger would have been incorrectly locked out of
  `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` from the start (this bug pre-existed but had never been
  exercised by a test or by manual play before now, since `movedPieceIds` happened to already be
  empty in all prior test fixtures and play-throughs).
- **`applyFreeMoveEnd`** (`gameEngine.ts`): all three return paths — the `FREE_MOVE_ATTACK` →
  `FREE_MOVE_DEFENSE` handoff, and both exit-to-resume-phase paths (empty-defense-list fallback
  inside the `FREE_MOVE_ATTACK` branch, and the `FREE_MOVE_DEFENSE`/fallback branch) — now also
  reset `movedPieceIds: []`, so the defending team's sub-phase and the resumed phase both start
  fresh rather than inheriting free-move activation bookkeeping.
- **`HexGrid.tsx`**: `canSelectFreeMove` gained an additional `!movedPieceIds.includes(piece.id)`
  condition, mirroring the regular MOVEMENT `canSelect` constant. `movedPieceIds` was already
  pulled into this component (used by the generic `isSpentNow` check), so no new store binding
  was needed.
- **`useGameStore.ts`**: `selectPiece`'s `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` branch gained a
  defense-in-depth check — if `gameState.movedPieceIds.includes(id)`, selection is rejected
  before the pace-remaining check, mirroring the equivalent guard pattern used by other phase
  branches in this file (e.g. `FIRST_TIME_PASS_MOVE`'s locked-slot rejection).

No new client-side rendering logic was added. Both the `'activated'` visual (orange ring + red X)
and the auto-deselect-on-activation behavior were already generic, phase-agnostic code paths in
`HexGrid.tsx` and `useGameStore.ts` that simply needed the server to start populating
`movedPieceIds` for FREE_MOVE — confirmed by inspection of `isSpentNow` (`HexGrid.tsx`) and the
`activationComplete` guard (`useGameStore.ts`'s `setGameState`) before making any client changes.

### Test coverage added

- `gameEngine.phase17.test.ts`: 7 new cases — abandons a partially-moved piece when a different
  eligible piece starts moving; adds a piece to `movedPieceIds` directly on its own 6th-hex
  exhaustion; rejects a move for a piece already in `movedPieceIds` even if its
  `freeMoveUsedPace` is under 6; `applyFreeMoveZoneCheck`'s trigger-fire transition resets
  `movedPieceIds: []` (seeded with stale non-empty values to prove the reset); `applyFreeMoveEnd`'s
  `FREE_MOVE_ATTACK` → `FREE_MOVE_DEFENSE` handoff resets `movedPieceIds: []` (seeded with
  attack-side activations); `applyFreeMoveEnd`'s empty-defense-list exit-to-resume-phase path
  resets `movedPieceIds: []`; `applyFreeMoveEnd`'s `FREE_MOVE_DEFENSE` exit-to-resume-phase path
  resets `movedPieceIds: []`.
- `HexGrid.test.tsx`: 1 new case (plus a new `hasActivatedRingAt` helper mirroring the existing
  `hasSelectableRingAt` pattern) — a piece in `movedPieceIds` with pace remaining under 6
  (simulating abandonment) is NOT selectable/clickable and renders the `'activated'` orange-ring
  visual via the existing generic `isSpentNow` path.
- `useGameStore.test.ts`: 2 new `selectPiece` cases (one each for `FREE_MOVE_ATTACK` and
  `FREE_MOVE_DEFENSE`) confirming a piece already in `movedPieceIds` is rejected (selection
  cleared) even when pace remaining is under 6.

### Deviation from plan

**[Rule 1 - Bug] Latent `movedPieceIds` staleness bug in `applyFreeMoveZoneCheck`/`applyFreeMoveEnd`**

- **Found during:** Implementing the UX-parity request above (orchestrator-diagnosed, not
  independently discovered during this execution — the orchestrator's diagnosis explicitly
  flagged this as a "latent bug this fix must close").
- **Issue:** Neither `applyFreeMoveZoneCheck` nor `applyFreeMoveEnd` ever touched
  `movedPieceIds`, so a piece left in that field by whatever phase preceded a FREE_MOVE trigger
  (or by one FREE_MOVE sub-phase before the next) could leak into the next sub-phase/resumed
  phase and be incorrectly locked out from the start.
- **Fix:** Added `movedPieceIds: []` resets at all four sub-phase boundaries (zone-check
  trigger-fire, ATTACK→DEFENSE handoff, and both exit-to-resume-phase paths).
- **Files modified:** `packages/server/src/gameEngine.ts`.
- **Commits:** `bae90ea` (fix, server), `807a209` (fix, client)

### Verification (third round)

All five commands passed:

- `pnpm --filter @counter-attack/shared typecheck` — clean
- `pnpm --filter @counter-attack/server typecheck` — clean
- `pnpm --filter @counter-attack/server test` — 345 passed, 1 skipped, 1 todo (20 files; +7 new
  MOVE-06 cases vs. the prior round's 338)
- `pnpm --filter @counter-attack/client typecheck` — clean
- `pnpm --filter @counter-attack/client test` — 131 passed (10 files; +3 new cases vs. the prior
  round's 128)

### Checkpoint status (third round)

Returning to the Task 4 `checkpoint:human-verify` a third time. Not simulated — the user must
verify two-browser-tab behavior directly. Re-verification note: once you move a piece during
`FREE_MOVE_ATTACK`/`DEFENSE` and then click a DIFFERENT eligible piece, the first piece should now
show the same "activated" visual (orange ring + red X) it would show in the regular Movement
phase after being abandoned — and become unselectable — even if it hadn't used its full 6 hexes.
A piece that uses its full 6 hexes shows the same activated state immediately. End Turn hand-off/
resume behavior and the basic move-up-to-6-hexes mechanic are unchanged from what was already
verified in the prior two rounds.

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
- FOUND: commit `daed61e` (fix(17-04): wire FREE_MOVE_ATTACK/DEFENSE client click-to-move selection)
- FOUND: commit `e19760f` (test(17-04): cover FREE_MOVE_ATTACK/DEFENSE click-to-move selection)
- FOUND: commit `18060a2` (docs(17-04): document second-checkpoint client-wiring gap and fix)
- FOUND: commit `bae90ea` (fix(17-04): track activated/abandoned pieces during FREE_MOVE)
- FOUND: commit `807a209` (fix(17-04): add clickability defense-in-depth gate for activated FREE_MOVE pieces)
- FOUND: `packages/client/src/components/HexGrid.tsx` (canSelectFreeMove present)
- FOUND: `packages/client/src/store/useGameStore.ts` (FREE_MOVE_ATTACK/DEFENSE branches present)
- FOUND: `packages/server/src/gameEngine.ts` (movedPieceIds tracking in applyFreeMove/applyFreeMoveZoneCheck/applyFreeMoveEnd)
