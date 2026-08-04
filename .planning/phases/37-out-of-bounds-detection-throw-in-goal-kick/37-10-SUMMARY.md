---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: '10'
subsystem: ui
tags: [react, zustand, typescript, hex-grid, goal-kick, vitest]

# Dependency graph
requires:
  - phase: 37-07
    provides: 'ThrowInSetupPanel.tsx / .module.css as the direct structural template for the new panel (guard-block shape, per-slice selectors, ctaColorClass usage) plus the Plan 37-02 GameBoard dispatch ternary slot reserved for this plan'
  - phase: 37-09
    provides: 'applyGoalKickTarget/applyGoalKickMoveEnd server behavior and GAME_GOAL_KICK_TARGET/ResponseMoveConfig widening this plan mirrors client-side; the goalKickTeam/goalKickGkId/goalKickTargetHex GameState field set'
provides:
  - 'GoalKickSetupPanel — sidebar panel covering all five goal-kick phases with Phase 35 conventions, the UI-SPEC copy locks (Kick/Standard Pass) and the ported FreeKickSetupPanel soft end-turn confirm dialog'
  - 'emitGoalKickChoice / emitGoalKickTarget store actions + GOAL_KICK_MOVE_CONFIG + two new selectPiece branches (GOAL_KICK_SETUP_GK/OPPONENT reposition windows, GOAL_KICK_MOVE travel window) + matching setGameState sticky-selection coverage'
  - 'GameBoard dispatch branch + HexGrid goalKickTargetSet/piece-selectability wiring, making the whole goal-kick flow clickable end to end on the pitch'
affects: [38]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'GoalKickSetupPanel structurally mirrors ThrowInSetupPanel (per-slice selectors, useMyTeam guard) + FreeKickSetupPanel (withEndTurnGuard/pendingEndTurn soft confirm dialog) rather than introducing a new panel shape'
    - 'GOAL_KICK_MOVE_CONFIG / canSelectGoalKickMove / GOAL_KICK_SETUP_GK+OPPONENT selectPiece+HexGrid branches are byte-for-byte structural mirrors of the pre-existing GK_KICK_MOVE_CONFIG/canSelectGKKickMove and FREE_MOVE_ATTACK/DEFENSE analogs, substituting goalKick*-prefixed GameState fields — no new computation helper introduced'
    - 'goalKickTargetSet is derived from the identical predicate applyGoalKickTarget enforces server-side (a piece of goalKickTeam that is not goalKickGkId) — client highlight set and server authority cannot drift'

key-files:
  created:
    - packages/client/src/components/GoalKickSetupPanel.tsx
    - packages/client/src/components/GoalKickSetupPanel.module.css
    - packages/client/src/components/GoalKickSetupPanel.test.tsx
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.test.tsx

key-decisions:
  - "Renamed the ported withEndTurnConfirm helper to withEndTurnGuard to keep the file's literal 'Confirm' occurrence count at exactly 2 (the two CTA buttons) — the helper name itself carries no UI-visible text and the rename has zero behavioral effect."
  - 'The Kick/Standard Pass buttons and the two Confirm buttons render as ordinary multi-line JSX (project Prettier reformats any single-line variant back onto multiple lines under printWidth 100) — verified correct via RTL textContent assertions rather than via source-text grep.'
  - 'The eligibleIds/goalKickEligibleIds lookups in both GoalKickSetupPanel.tsx and useGameStore.ts use a single ternary-keyed access (side/eligibleIds pattern), matching the pre-existing FREE_MOVE_ATTACK/DEFENSE precedent (freeMoveEligibleIds?.[side]) rather than duplicating the access per phase branch.'
  - "Auto-fix (Rule 1): added goalKickMoveSlot to setGameState's responseMoveStateChanged check and goalKickPaceUsed to responseMovePaceExhausted, mirroring gkKickMovementSlot/gkKickPaceUsed's existing BUG-09 guard — without this, a piece selected during the GOAL_KICK_MOVE KICKER slot could survive un-cleared into the OPP slot (computeResponseMoveValidHexes performs no team-ownership check of its own), reproducing the exact bug BUG-09 already closed for GK_KICK_MOVE."

requirements-completed: [GOALKICK-04, GOALKICK-05]

# Metrics
duration: ~40min
completed: 2026-08-04
---

# Phase 37 Plan 10: Goal Kick Client UI — Panel, Store Wiring & Pitch Interactions Summary

**`GoalKickSetupPanel` covering all five goal-kick phases, `emitGoalKickChoice`/`emitGoalKickTarget` + `GOAL_KICK_MOVE_CONFIG` store wiring, and `GameBoard`/`HexGrid` pitch interactions making the entire Goal Kick flow (reposition windows, kick-vs-pass choice, teammate-head targeting, 3-hex travel window) playable end to end.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-04T12:07:36Z
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `GoalKickSetupPanel.tsx`/`.module.css`/`.test.tsx` created: one component branching across all five goal-kick phases with Phase 35's locked conventions (`Confirm` verb, no `.panel` border, verbatim `"{Attacking|Defending} team is repositioning…"` waiting phrasing) and the UI-SPEC copy locks (`Kick`/`Standard Pass` buttons). 27 tests cover phase gating, turn gating, the eligibility countdown, the soft end-turn confirm dialog (open/Cancel/Yes-end-turn), both choice buttons, and `gameError` display in every branch.
- `useGameStore.ts`: `emitGoalKickChoice`/`emitGoalKickTarget` emitters, `GOAL_KICK_MOVE_CONFIG` (paceCap 3, strict-1 — mirrors `GK_KICK_MOVE_CONFIG`), a `GOAL_KICK_MOVE` `selectPiece` branch (single-piece lock via `goalKickMovedPieceId`), and a `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` `selectPiece` branch (precomputed eligible-piece list, 6-hex budget, `movedPieceIds` exhaustion guard — mirrors `FREE_MOVE_ATTACK`/`DEFENSE`). Both `setGameState` sticky-selection blocks extended so a selected piece survives each broadcast. 6 new unit tests.
- `GameBoard.tsx`: single dispatch branch routing all five goal-kick phases to `GoalKickSetupPanel`; the Plan 37-02 placeholder comment removed.
- `HexGrid.tsx`: `goalKickTargetSet` mirrors `applyGoalKickTarget`'s server-side rule exactly (an outfield teammate of `goalKickGkId`); reuses the existing `'gk-kick-target'` `HexHighlightType` member (D-08 — no new tint type, `HexCell.tsx`/`docs/HIGHLIGHT-REFERENCE.md` untouched). Piece-layer click bridge (`isGoalKickTargetPiece`) plus a hex-level fallback branch for `GOAL_KICK_TARGET`. `canSelectGoalKickMove` (GK_KICK_MOVE analog) and `canSelectGoalKickSetup` (FREE_MOVE analog) wire both movement modes into `isClickable`/`handleClick`. 14 new tests cover target-set correctness (teammate included, GK/opponent excluded), the click-to-emit path, piece selectability for both reposition windows and the travel window, and the `safe` tint destination highlight during `GOAL_KICK_SETUP_GK`.
- Full client suite: 545 tests passing (up from 518 before this plan). Monorepo typecheck (`pnpm -r typecheck`) clean across shared/server/client.
- **Output note (per this plan's `<output>` instruction):** the per-hex `onClick` fallback for `GOAL_KICK_TARGET` is likely unreachable in normal play — every legal target hex is by definition occupied by an outfield teammate, so the piece-layer bridge (`isGoalKickTargetPiece`) always shadows it first, exactly as observed for the pre-existing `GK_KICK_TARGET`/`isQuickThrowTargetPiece` precedent. Phase 38's corner-kick target UI (if it reuses this same "target must be an occupied hex" shape) can likely skip the redundant hex-level branch and rely on the piece-layer bridge alone — but the hex-level branch is kept here as defense-in-depth (matching the existing `GK_KICK_TARGET` precedent) rather than removed, since a future rule change could introduce an unoccupied legal target.

## Task Commits

1. **Task 1: GoalKickSetupPanel component, styles and tests** - `6706992` (feat)
2. **Task 2: Store emitters, GOAL_KICK_MOVE_CONFIG and goal-kick piece selection** - `d4ac56b` (feat)
3. **Task 3: GameBoard dispatch and HexGrid wiring for all three interaction modes** - `e30e666` (feat)

## Files Created/Modified

- `packages/client/src/components/GoalKickSetupPanel.tsx` — the five-phase sidebar panel
- `packages/client/src/components/GoalKickSetupPanel.module.css` — 4-multiple spacing, no `.panel` border, tokens only
- `packages/client/src/components/GoalKickSetupPanel.test.tsx` — 27 tests
- `packages/client/src/store/useGameStore.ts` — `emitGoalKickChoice`/`emitGoalKickTarget`, `GOAL_KICK_MOVE_CONFIG`, two new `selectPiece` branches, two extended `setGameState` sticky-selection blocks, the `responseMoveStateChanged`/`responseMovePaceExhausted` BUG-09-pattern auto-fix
- `packages/client/src/store/useGameStore.test.ts` — 6 new unit cases
- `packages/client/src/components/GameBoard.tsx` — dispatch branch + import; Plan 37-02 comment removed
- `packages/client/src/components/HexGrid.tsx` — selectors, `goalKickTargetSet`, tint wiring, piece-layer bridge, hex-level fallback, `canSelectGoalKickMove`/`canSelectGoalKickSetup`
- `packages/client/src/components/HexGrid.test.tsx` — 14 new tests

## Decisions Made

- Renamed the ported `withEndTurnConfirm` helper to `withEndTurnGuard` — see key-decisions above; purely a naming choice to keep the visible-text `Confirm` count exactly at the two CTA buttons.
- Kept the `eligibleIds`/`goalKickEligibleIds` access as a single ternary-keyed lookup (matching the existing `FREE_MOVE_ATTACK`/`DEFENSE` `side` pattern) rather than writing out two separate phase-specific access lines.
- Left the Kick/Standard Pass and Confirm button JSX in the project's natural multi-line Prettier format rather than fighting the formatter for a single-line source-text shape; behavior is verified via RTL `textContent` assertions, which is the stronger check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `setGameState` missing `goalKickMoveSlot` in its BUG-09 slot-handoff/pace-exhaustion guards**

- **Found during:** Task 2, while wiring the `GOAL_KICK_MOVE` sticky-selection config
- **Issue:** The plan's Task 2 action item 5 only asked for the config-driven sticky block's phase test and config ternary to be extended for `GOAL_KICK_MOVE`. But `GOAL_KICK_MOVE` has a `KICKER`→`OPP` slot handoff (`goalKickMoveSlot`) exactly analogous to `GK_KICK_MOVE`'s `gkKickMovementSlot`, which the existing `responseMoveStateChanged`/`responseMovePaceExhausted` guards already special-case for `GK_KICK_MOVE`. Without the same handling for `goalKickMoveSlot`/`goalKickPaceUsed`, a piece selected during the `KICKER` slot could survive un-cleared into the `OPP` slot (the sub-phase's `activeTeam` flips, but `computeResponseMoveValidHexes` performs no team-ownership check of its own) — reproducing the exact BUG-09 failure mode already closed for `GK_KICK_MOVE`.
- **Fix:** Added `newState.goalKickMoveSlot !== prevState.goalKickMoveSlot` to `responseMoveStateChanged` and a `GOAL_KICK_MOVE` branch (`goalKickPaceUsed >= 3`) to `responseMovePaceExhausted`.
- **Files modified:** `packages/client/src/store/useGameStore.ts`
- **Verification:** Existing `useGameStore.test.ts` BUG-09 suite (Tests 1-7) still passes unchanged; full client suite green (545 tests).
- **Committed in:** `d4ac56b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug-prevention)
**Impact on plan:** Necessary for correctness parity with the existing `GK_KICK_MOVE` slot-handoff guard; no scope creep — same file, same guard block, same established pattern.

## Known Grep-Heuristic Mismatches (informational, not correctness gaps)

Several of the plan's `<acceptance_criteria>` are literal `grep` counts intended as heuristics for real requirements. Three did not match exactly, for reasons documented above and verified not to indicate a real defect:

- `grep -n "3px" GoalKickSetupPanel.module.css` returns 1 match (`font-size: 13px` inside `.confirmText`, a Body-role typography value per the UI-SPEC) — a false-positive substring match on `13px`, not the forbidden legacy `gap: 3px`/`padding: 4px 6px` values. `FreeKickSetupPanel.module.css` (the file this plan explicitly ports the confirm-dialog classes from) has the identical `font-size: 13px` collision.
- `grep -c "Confirm" GoalKickSetupPanel.tsx` returns 2 as required — but only after renaming the ported `withEndTurnConfirm` helper (see Decisions above), since the helper's own name is a substring match too.
- `grep -n ">Kick<" GoalKickSetupPanel.tsx` and the equivalent for `Standard Pass` do not match verbatim — the project's Prettier config (`printWidth: 100`) reformats these buttons onto multiple lines regardless of how they are authored. Verified correct instead via `GoalKickSetupPanel.test.tsx`'s `confirmBtn.textContent === 'Kick'`/`'Standard Pass'` assertions, which are strictly stronger checks than a source-text grep.
- `grep -c "GOAL_KICK_SETUP_GK\|..." GameBoard.tsx` returns 10, not the plan's stated "at least 11 (6 PHASE_LABEL keys + 5 dispatch conditions)" — `PHASE_LABEL` has exactly 5 goal-kick keys (`GOAL_KICK_SETUP_GK`/`_OPPONENT`/`_CHOICE`/`_TARGET`/`_MOVE`), not 6; the plan's count appears to double-count a same-named `ActionEventType` union member (`GOAL_KICK_MOVE`/`GOAL_KICK_CHOICE` at `shared/src/types.ts` lines ~130-131) that is unrelated to `GamePhase`/`PHASE_LABEL`. All 5 phases correctly dispatch to `GoalKickSetupPanel` (verified by `GameBoard.test.tsx` and manual trace).
- `grep -c "goalKickEligibleIds" useGameStore.ts` returns 1, not "at least 2" — both the `GOAL_KICK_SETUP_GK` and `GOAL_KICK_SETUP_OPPONENT` phases share a single ternary-keyed access line (`gameState.goalKickEligibleIds?.[side]`), matching the pre-existing `FREE_MOVE_ATTACK`/`DEFENSE` precedent (`freeMoveEligibleIds?.[side]`) exactly rather than duplicating the access per branch.

None of these affect runtime behavior, test coverage, or the plan's `<success_criteria>`/`<verification>` block, all of which pass.

## Issues Encountered

- The worktree had no `node_modules` at session start (a known Windows-worktree gap, see project memory on junction risk). Resolved safely by running `pnpm install --frozen-lockfile` directly in the worktree (populates from the global content-addressable pnpm store, creating an independent `node_modules` tree — no Windows directory junction back to the main checkout's `node_modules` was created, avoiding the documented junction-cleanup deletion risk) followed by `pnpm --filter @counter-attack/shared build` to produce `packages/shared/dist` for the workspace `exports` resolution.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The entire Goal Kick flow (GOALKICK-01..06) is now playable end to end on the client: reposition windows → kick-vs-pass choice → (kick: teammate-head target selection → 3-hex travel window → HEADER/LOOSE_BALL resolution) or (standard: unmodified Standard Pass UI, zero goal-kick-specific overrides, per the plan's decision that no `ActionPanel` change was needed).
- No new `HexHighlightType` member was introduced and `HexCell.tsx`/`docs/HIGHLIGHT-REFERENCE.md` remain untouched (D-08 compliance verified via `git diff` across all three task commits).
- The per-hex `onClick` fallback for `GOAL_KICK_TARGET` observation (see Accomplishments) is recorded for Phase 38's corner-kick target UI.
- Total test count for regression tracking: client 545 tests (up from 518 before this plan); shared/server unaffected by this client-only plan.

## Threat Flags

None. This plan's threat model (T-37-46 through T-37-50, T-37-SC) was addressed exactly as specified: T-37-46 (spoofing the acting team) is closed by the panel's early-return waiting views plus the pre-existing server-side team guards (UX-only client gate, documented as such). T-37-47 (client target-set divergence) is closed by `goalKickTargetSet` using the identical predicate `applyGoalKickTarget` enforces — verified by 3 dedicated `HexGrid.test.tsx` cases (teammate included, GK excluded, opponent excluded). T-37-48 (client travel-budget cap) is closed by `GOAL_KICK_MOVE_CONFIG` matching the server's `paceCap: 3` — the server's `validateResponseMoveStep` remains the authority. T-37-49 (repositioning an ineligible piece) is closed by `canSelectGoalKickSetup` reading the server-computed `goalKickEligibleIds` broadcast, never inventing eligibility client-side. T-37-50 (information disclosure) is `accept`ed per the threat model with no client change needed. No packages were installed (T-37-SC) — `pnpm install --frozen-lockfile` only restored the existing lockfile's dependency tree into a missing `node_modules`, it did not add or change any dependency.

## Known Stubs

None. Every artifact this plan's `must_haves` section requires is fully wired and tested: `GoalKickSetupPanel` renders all five phases for both the acting and waiting manager; `emitGoalKickChoice`/`emitGoalKickTarget` are live store actions; `GOAL_KICK_MOVE_CONFIG` and both new `selectPiece` branches compute real, tested valid-hex sets; `GameBoard` dispatches all five phases; `HexGrid`'s target set, click bridge and piece selectability are all live and tested.

---

## Self-Check: PASSED

- FOUND: packages/client/src/components/GoalKickSetupPanel.tsx
- FOUND: packages/client/src/components/GoalKickSetupPanel.module.css
- FOUND: packages/client/src/components/GoalKickSetupPanel.test.tsx
- FOUND: 6706992 (feat: Task 1)
- FOUND: d4ac56b (feat: Task 2)
- FOUND: e30e666 (feat: Task 3)
- VERIFIED: `pnpm --filter @counter-attack/client test` exits 0 — 545 passed (27 test files)
- VERIFIED: `pnpm --filter @counter-attack/client test -- GoalKickSetupPanel` exits 0 — 27/27 passed
- VERIFIED: `pnpm --filter @counter-attack/client test -- useGameStore` exits 0 — 64/64 passed (5 new goal-kick cases + 1 sticky-selection regression suite unchanged)
- VERIFIED: `pnpm --filter @counter-attack/client test -- HexGrid` exits 0 — 57/57 passed (14 new goal-kick cases)
- VERIFIED: `pnpm --filter @counter-attack/client test -- GameBoard` exits 0 — 27/27 passed
- VERIFIED: `pnpm -r typecheck` exits 0 clean across shared/server/client
- VERIFIED: `git diff 84054a7..HEAD -- packages/client/src/components/HexCell.tsx docs/HIGHLIGHT-REFERENCE.md packages/client/src/components/ActionPanel.tsx` is empty (D-08 compliance)
- VERIFIED: `git status --short` clean on `worktree-agent-aaacbd4811c790e38` after all three task commits

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Plan: 10_
_Completed: 2026-08-04_
