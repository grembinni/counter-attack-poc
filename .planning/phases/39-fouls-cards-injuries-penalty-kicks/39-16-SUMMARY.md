---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 16
subsystem: ui
tags: [react, typescript, zustand, vitest]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: 'Plan 39-06 shared GamePhase/GameState contract for the eight new phases; Plan 39-08 PenaltyKickSetupPanel; Plan 39-09 FoulChoicePanel/GkDiveAtFeetPromptPanel/GkBoxEntryPromptPanel; Plan 39-15 server-side GAME_GK_BOX_ENTRY_MOVE handler and D-16 mutual-confirm applySecondHalfConfirm engine function'
provides:
  - 'GameBoard.tsx topBandRight phase dispatch extended with 4 new branches routing all 8 new Phase 39 phases to their own panels, never the generic ActionPanel'
  - 'BallLocationRing.tsx BALL_MARKER_PHASES extended with all 8 new phases (17->30 total, was 22 after Phase 38)'
  - 'HexGrid.tsx: canSelectPenaltyKickSetup/canSelectPenaltyKickTaker/canSelectGkBoxEntryMove piece-selection wiring, penalty-spot gold ring="required" marker, and a dedicated GK_BOX_ENTRY_MOVE hex-click branch routing to emitGkBoxEntryMove (not generic emitMove)'
  - 'GameBoard.tsx D-16 mutual-confirm Start 2nd Half button: secondHalfConfirmed-derived canStart replaces the D-28 single-team kick-off-team-only gate; per-manager waiting state after their own confirm'
  - '67 new/updated test assertions across BallLocationRing.test.tsx (+8) and GameBoard.test.tsx (+14, including 8-phase dispatch it.each with mocked panel stubs)'
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GameBoard's topBandRight ternary dispatch: new phase branches inserted after the corner-kick PASS-persistent-signal branch and before REPLAY, matching the established insertion point for every restart-family addition since Phase 37"
    - 'HexGrid.tsx piece-selectability follows the canSelectX -> isClickable membership -> handleClick ternary chain established by every prior reposition-window phase (canSelectGoalKickSetup, canSelectCornerKickReposition, etc.) — PENALTY_KICK_SETUP_*/GK_BOX_ENTRY_MOVE now follow the identical shape'
    - 'A phase with its own dedicated socket event (GK_BOX_ENTRY_MOVE -> GAME_GK_BOX_ENTRY_MOVE, no pieceId) gets an explicit onClick branch inserted BEFORE the generic isValidMove/emitMove fallback, mirroring the CORNER_KICK_GK_SETUP_*/emitCornerKickGkPlace precedent'
    - "GameBoard.test.tsx: net-new panel components are vi.mock'd to identifiable data-testid stubs for phase-dispatch-only assertions, keeping those tests about routing (which panel) rather than panel internals (already covered by each panel's own dedicated suite)"

key-files:
  created: []
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.test.tsx
    - packages/client/src/components/BallLocationRing.tsx
    - packages/client/src/components/BallLocationRing.test.tsx
    - packages/client/src/components/HexGrid.tsx

key-decisions:
  - "No PASS-phase persistent-signal fallback branch was added for the penalty duel (unlike corner kick's `phase === 'PASS' && cornerKickTeam != null`) — the penalty duel has its own dedicated PENALTY_KICK phase, documented inline in GameBoard.tsx so a reader comparing against the corner-kick branch does not assume an omission (per the plan's explicit instruction)"
  - "HexGrid.tsx required three NEW canSelect* variables (canSelectPenaltyKickSetup, canSelectPenaltyKickTaker, canSelectGkBoxEntryMove) beyond what the plan's action text literally described as 'map valid hexes to highlights' — the store's selectPiece branches for these phases (Plan 39-05) already computed valid hexes correctly, but no piece in HexGrid was wired as clickable/selectable for these phases, so the panels were functionally unreachable without this addition. Read as included in the plan's read_first pointer to the canSelectGoalKickSetup 'shape' (lines 820-870), which is a piece-selection block, not a highlight-only block. (Rule 2 — missing critical functionality: without this wiring, three of the plan's four Task 2 phases could never actually be played.)"
  - "GK_BOX_ENTRY_MOVE's hex-click routes to the dedicated emitGkBoxEntryMove(hex) event (no pieceId, per the server's GAME_GK_BOX_ENTRY_MOVE handler from Plan 39-15) rather than the generic emitMove used by PENALTY_KICK_SETUP_ATTACKING/DEFENDING — confirmed server-side that penalty-kick reposition IS handled via the generic GAME_MOVE handler (gameHandlers.ts ~line 761), so only GK_BOX_ENTRY_MOVE needed a dedicated onClick branch"
  - "The waiting-state opponent label (opponentTeamName) is derived from myTeam directly (home ? 'Away' : 'Home'), independent of secondHalfKickOffTeam — the latter communicates who kicks off (an unrelated D-16 concept preserved verbatim), not who the reader is waiting on"
  - "The waiting-state text reuses styles.overlayBody (the existing FULL_TIME 'Replay starting...' secondary-line class) rather than introducing a new CSS class, per the plan's explicit instruction"

patterns-established: []

requirements-completed: [FOUL-03, GKDIVE-02, PEN-02]

# Metrics
duration: ~35min active work (session interrupted once by a usage limit between Task 2 and Task 3; resumed from the last committed state with no rework)
completed: 2026-08-14
---

# Phase 39 Plan 16: GameBoard Phase Dispatch, Highlight Wiring & Mutual Half-Time Confirm Summary

**Wires all four Phase 39 panels (FoulChoicePanel, GkDiveAtFeetPromptPanel, GkBoxEntryPromptPanel, PenaltyKickSetupPanel) into GameBoard's phase dispatch, extends the ball-location marker and hex-highlight/piece-selection systems to all eight new phases (including three new canSelect\* wiring blocks the plan's highlight-only framing didn't spell out but the phases needed to be playable at all), and replaces the single-team Start 2nd Half gate with D-16's mutual-confirm button.**

## Performance

- **Duration:** ~35 min of active execution (spread across a session interrupted once by a usage limit)
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 5 (all pre-existing)

## Accomplishments

- `GameBoard.tsx`'s `topBandRight` dispatch ternary extended with 4 new branches (inserted after the corner-kick branch, before `REPLAY`) routing `FOUL_CHOICE`, `GK_DIVE_AT_FEET_PROMPT`, `GK_BOX_ENTRY_PROMPT`/`GK_BOX_ENTRY_MOVE`, and all four `PENALTY_KICK_*` phases to their dedicated panels — the eight new phases never fall through to the generic `ActionPanel`.
- `BallLocationRing.tsx`'s `BALL_MARKER_PHASES` grew from 22 to 30 members with the eight new Phase 39 phases; `BallLocationRing.test.tsx` gained 8 new membership-assertion tests plus an updated size-pin test.
- `HexGrid.tsx` gained: (1) `canSelectPenaltyKickSetup`/`canSelectPenaltyKickTaker`/`canSelectGkBoxEntryMove` piece-selection predicates wired into `isClickable` and `handleClick`, matching `canSelectGoalKickSetup`'s established shape (no pace-budget cutoff for PEN-02's unbudgeted reposition, per PEN-02); (2) a penalty-spot gold `ring="required"` marker visible across all four penalty-kick phases, reusing the existing ring mechanism with zero new `HexHighlightType`/ring members; (3) a dedicated `GK_BOX_ENTRY_MOVE` hex-click branch that calls `emitGkBoxEntryMove(hex)` (the server's dedicated no-pieceId event) inserted before the generic `isValidMove && selectedPieceId -> emitMove` fallback. Penalty-kick reposition (`PENALTY_KICK_SETUP_ATTACKING`/`_DEFENDING`) confirmed to already route correctly through the generic `emitMove`/`GAME_MOVE` handler server-side (Plan 39-11), so no dedicated branch was needed there.
- `GameBoard.tsx`'s HALF_TIME overlay button reworked per D-16: `secondHalfConfirmed`-derived `canStart`/`myConfirmed` replace the D-28 `myTeam !== kickOffTeam` gate entirely; the removed-tooltip string (`"Only the 2nd half kick-off team can start"`) is gone; the button is replaced by a `"Waiting for {opponent} to start the 2nd half…"` message (reusing the existing `styles.overlayBody` class) once the reader's own team has confirmed.
- `GameBoard.test.tsx` gained 14 new assertions: the D-16 regression (both home- and away-viewing managers see an enabled button when `secondHalfConfirmed` is null — previously only the non-kick-off team did), a click-calls-`emitHalfTimeStart`-once test, the confirmed-side waiting-text assertion, the unconfirmed-side still-enabled-button assertion, a tooltip-string-absence assertion, and an `it.each` phase-dispatch suite covering all 8 new phases against mocked panel stubs (proving routing, not panel internals).
- Full client suite: 917 tests green (903 after Task 2, +14 from Task 3); `pnpm --filter @counter-attack/client typecheck`, `pnpm build` (shared+client+server), and `pnpm stylelint` all exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Phase dispatch for the four new panels in GameBoard** - `ee0d298` (feat)
2. **Task 2: Ball marker and hex highlight registration for the new phases** - `469848d` (feat)
3. **Task 3: Mutual-confirm Start 2nd Half button and GameBoard tests** - `4c3c717` (feat)

_No plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/client/src/components/GameBoard.tsx` - 4 new panel imports + dispatch branches (Task 1); `secondHalfConfirmed` selector, D-16 `myConfirmed`/`canStart`/`opponentTeamName` derivation, reworked HALF_TIME button/waiting-state JSX (Task 3)
- `packages/client/src/components/GameBoard.test.tsx` - 4 `vi.mock` blocks for the new panel stubs; new `D-16: mutual-confirm Start 2nd Half button` describe block (6 tests) and `Phase 39 (39-16): new phase dispatch` describe block (8 tests, `it.each`)
- `packages/client/src/components/BallLocationRing.tsx` - 8 new `BALL_MARKER_PHASES` members
- `packages/client/src/components/BallLocationRing.test.tsx` - 8 new membership-assertion tests; size-pin test updated 22 -> 30
- `packages/client/src/components/HexGrid.tsx` - 3 new per-slice Phase 39 selectors (`penaltyKickTeam`/`penaltyKickSpot`/`penaltyKickEligibleIds`/`gkBoxEntryTeam`/`emitGkBoxEntryMove`); 3 new `canSelect*` predicates; `isPenaltySpotHex`/`ring` extension; dedicated `GK_BOX_ENTRY_MOVE` onClick branch

## Decisions Made

See `key-decisions` in frontmatter — the no-PASS-fallback documentation choice for the penalty duel, the Rule-2 addition of `HexGrid.tsx` piece-selection wiring beyond the plan's literal "map highlights" framing, the `emitGkBoxEntryMove`-vs-generic-`emitMove` routing split (confirmed against the server's actual handler wiring), the `opponentTeamName` derivation independent of `secondHalfKickOffTeam`, and reusing `styles.overlayBody` for the waiting-state text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] HexGrid.tsx had no piece-selection wiring for PENALTY_KICK_SETUP_ATTACKING/DEFENDING, PENALTY_KICK_TAKER_SELECT, or GK_BOX_ENTRY_MOVE**

- **Found during:** Task 2, while reading the plan's cited `useGameStore.ts` valid-hex derivation (Plan 39-05) and cross-checking `HexGrid.tsx` for the corresponding `canSelectX` piece-selection predicate the plan's read_first pointer (lines 820-870, `canSelectGoalKickSetup`'s "shape") implied should exist as a template to copy.
- **Issue:** `useGameStore.ts`'s `selectPiece` already had fully correct branches for all three phases (computing `validMoveHexes` via `computePenaltyKickValidHexes`/`computeFreeMoveValidHexes`, or directly emitting `emitPenaltyKickTaker`), but `HexGrid.tsx` had zero `canSelect*`/`isClickable`/`handleClick` wiring for any of the four new interactive phases — a grep for `PENALTY_KICK|GK_BOX_ENTRY` in `HexGrid.tsx` returned no matches at all. Without this wiring, `selectPiece` would never actually be invoked by a click during these phases (every piece would render `selectionState='none'` with `handleClick = () => undefined`), making `PenaltyKickSetupPanel`/`GkBoxEntryPromptPanel` functionally dead in a real game despite being fully built, tested, and dispatched.
- **Fix:** Added `canSelectPenaltyKickSetup` (mirrors `canSelectGoalKickSetup`'s shape exactly, minus the pace-budget cutoff per PEN-02's unbudgeted reposition), `canSelectPenaltyKickTaker` (mirrors `canSelectCornerKickTaker`'s shape — routes to `selectPiece`, which the store resolves directly into `emitPenaltyKickTaker`), and `canSelectGkBoxEntryMove` (mirrors the store's own guard: `myTeam === gkBoxEntryTeam`, GK role, no `isActivePlayer` gate). Wired all three into the `isClickable` OR-chain and the `handleClick` ternary chain (`() => selectPiece(piece.id)`), matching every prior reposition-window's established pattern.
- **Files modified:** `packages/client/src/components/HexGrid.tsx`
- **Verification:** `pnpm --filter @counter-attack/client typecheck` and the full 89-test `HexGrid.test.tsx` suite pass; full client suite (903 tests after this task) green.
- **Committed in:** `469848d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality)
**Impact on plan:** Necessary for the plan's own stated goal ("the panels, store wiring and server flows all exist by this wave but are unreachable") to actually hold for three of the four Task 2 phases — without it, `PENALTY_KICK_SETUP_*`/`PENALTY_KICK_TAKER_SELECT`/`GK_BOX_ENTRY_MOVE` would have remained unreachable even after this plan, contradicting the plan's own objective. No scope creep: the fix is narrowly the piece-selection predicate + wiring pattern every sibling reposition phase already has.

## Issues Encountered

- Session was interrupted by a usage limit after Task 2's commit (`469848d`) but before Task 3's test additions were committed — resumed cleanly from the last committed state per the worktree continuation protocol; `git status`/`git diff` confirmed the uncommitted `GameBoard.tsx` source edits (D-16 button rework) were intact and unaffected, and the corresponding `GameBoard.test.tsx` additions were completed and committed with no rework needed.
- `toBeDisabled()` (jest-dom matcher) is not available in this project's Vitest setup — switched to the codebase's established `(button as HTMLButtonElement).disabled` assertion pattern (already used by `KickOffSetupPanel.test.tsx`) after a typecheck failure surfaced the missing matcher.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All eight new Phase 39 phases are now fully reachable end-to-end on the client: dispatched to their own panel, showing the ball-location marker, and (where applicable) offering a selectable piece with the correct highlight/ring and click-to-move/click-to-act routing.
- The D-16 mutual half-time confirm is fully wired client-side, matching the server-side `applySecondHalfConfirm`/reworked `GAME_HALF_TIME_START` handler delivered in Plan 39-15.
- No blockers. Full client test suite (917 tests), `pnpm --filter @counter-attack/client typecheck`, `pnpm build` (shared/client/server), and `pnpm stylelint` all green.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_

## Self-Check: PASSED

- FOUND: `packages/client/src/components/GameBoard.tsx`
- FOUND: `packages/client/src/components/GameBoard.test.tsx`
- FOUND: `packages/client/src/components/BallLocationRing.tsx`
- FOUND: `packages/client/src/components/BallLocationRing.test.tsx`
- FOUND: `packages/client/src/components/HexGrid.tsx`
- FOUND: commit `ee0d298` (feat: wire four new Phase 39 panels into GameBoard dispatch)
- FOUND: commit `469848d` (feat: register ball marker and hex highlights for Phase 39 phases)
- FOUND: commit `4c3c717` (feat: D-16 mutual-confirm Start 2nd Half button + phase-dispatch tests)
