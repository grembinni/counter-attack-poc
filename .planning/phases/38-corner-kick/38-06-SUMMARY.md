---
phase: 38-corner-kick
plan: 06
subsystem: ui
tags: [react, zustand, vitest, typescript, hex-grid, corner-kick]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 01)
    provides: 5 new GamePhase values, 10 cornerKick* GameState fields, cornerKickStageTeam helper, GAME_CORNER_KICK_GK_PLACE/GAME_CORNER_KICK_TAKER ClientEvents
provides:
  - useGameStore.selectPiece branches for all 4 interactive Corner Kick phases (GK setup x2, taker select, reposition, final setup)
  - CORNER_KICK_FINAL_SETUP_CONFIG (ResponseMoveValidHexConfig)
  - emitCornerKickGkPlace / emitCornerKickTaker store actions
  - setGameState sticky-selection coverage for CORNER_KICK_FINAL_SETUP slot flips and CORNER_KICK_REPOSITION stage handoffs
  - HexGrid per-slice cornerKick* selectors, 4 canSelectCornerKick* predicates, required ring at cornerKickHex, dedicated GK-place onClick wiring
affects: [38-07, 38-08, 38-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Corner Kick client selectability mirrors server legality field-for-field (same field names/caps as Goal Kick's precedent) so client highlights and server rejections cannot drift"
    - 'New restart-phase click handling that needs a dedicated one-shot socket event (GK placement) gets its own onClick branch ahead of the generic isValidMove+emitMove fallback, mirroring KICK_OFF_SETUP/FREE_KICK_SETUP'

key-files:
  created: []
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.test.tsx

key-decisions:
  - "CORNER_KICK_GK_SETUP_ATTACKING/_DEFENDING hex clicks route through the new emitCornerKickGkPlace event (not the generic emitMove fallback) — required a dedicated onClick branch in HexGrid.tsx ahead of the generic isValidMove branch, since the plan's Task 2 scope (selectability/tints) didn't explicitly call this out but 38-01's SUMMARY confirms GAME_CORNER_KICK_GK_PLACE is a dedicated (non-GAME_MOVE) event"
  - "CORNER_KICK_REPOSITION joins the FREE_MOVE_ATTACK/DEFENSE/GOAL_KICK_SETUP_GK/_OPPONENT sticky-selection block (within-stage stickiness) even though only the stage-handoff-clear behavior was explicitly required by the plan's <behavior> list — omitting it would silently zero out validMoveHexes mid-round (the same BUG-09 failure class already fixed for every other response-move phase), so it was added to match 'selection stickiness matches the goal-kick precedent' from the plan's <done> criteria"
  - "cornerKickTakerId (required as one of the 8 per-slice selectors) is used as a defense-in-depth exclusion in canSelectCornerKickReposition, mirroring the highPassCarrierId/firstTimePassCarrierId carrier-exclusion pattern elsewhere in the file — keeps the subscribed selector from being flagged by the eslint no-unused-vars 'error' rule enforced via lint-staged's pre-commit hook"

patterns-established:
  - "Corner Kick's four interactive-phase selectPiece branches and HexGrid canSelect predicates are structurally identical pairs (store computes the truth, HexGrid mirrors the same predicate for selectability) — continues the Goal Kick precedent this plan explicitly extends"

requirements-completed: [CORNER-01, CORNER-02, CORNER-03, CORNER-06]

# Metrics
duration: ~35min
completed: 2026-08-07
---

# Phase 38 Plan 06: Corner Kick Client Interaction Layer Summary

**Wired the Zustand store's per-phase piece-selection/valid-destination logic, two new socket emitters (emitCornerKickGkPlace/emitCornerKickTaker), and HexGrid's selectability/tint/ring rules for all four interactive Corner Kick phases (GK reposition x2, taker select, 6-hex alternating reposition, 3-hex pre-kick window), reusing only existing highlight/ring members per D-09.**

## Performance

- **Duration:** ~35 min (includes one-time `pnpm install` for the fresh worktree checkout)
- **Started:** 2026-08-07T13:05:00Z (approx)
- **Completed:** 2026-08-07T13:20:00Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments

- `useGameStore.ts`: added `selectPiece` branches for `CORNER_KICK_GK_SETUP_ATTACKING`/`_DEFENDING` (uncapped GK placement across every unoccupied on-pitch hex, Assumption A1), `CORNER_KICK_TAKER_SELECT` (server-fixed teleport mirroring `THROW_IN_SETUP`), `CORNER_KICK_REPOSITION` (6 alternating attacking/defending stages via `cornerKickStageTeam`, cap 6, pace-exhausted-but-selectable precedent preserved) and `CORNER_KICK_FINAL_SETUP` (single-piece slot lock via the new `CORNER_KICK_FINAL_SETUP_CONFIG`, cap 3)
- `setGameState`'s sticky-selection logic extended: `cornerKickMoveSlot`/`cornerKickStageIndex` changes now force a full clear (mirrors the goal-kick slot-mirror block and closes the CORNER_KICK_REPOSITION stage-handoff gap, since all 6 stages share one `GamePhase` value unlike Goal Kick's two distinct setup phases); `CORNER_KICK_FINAL_SETUP` joins the response-move re-run ternary; `CORNER_KICK_REPOSITION` joins the FREE_MOVE/GOAL_KICK_SETUP within-stage sticky block
- Two new store actions: `emitCornerKickGkPlace(pieceId, to)` (mirrors `emitFreeKickMove` — two args, clears selection) and `emitCornerKickTaker(pieceId)` (mirrors `emitThrowInPlace` — single arg, destination server-owned)
- `HexGrid.tsx`: 8 new per-slice Zustand selectors for every `cornerKick*` field (Pitfall 6), 4 new `canSelectCornerKick*` predicates mirroring the store's `selectPiece` guards exactly, wired into both `isClickable` and the piece `handleClick` cascade
- Destination-hex `safe` tinting for all four windows required zero new dispatch code — the existing `validMoveHexes` → `isHighlighted` → `isSafeTint` → `'safe'` path already covers every new phase, confirming D-09's "reuse only" requirement
- New `required`-ring dispatch arm for the fixed corner-taker hex (`cornerKickHex`) during `CORNER_KICK_TAKER_SELECT`, reusing the same gold ring kick-off already uses
- New dedicated `onClick` branch routing `CORNER_KICK_GK_SETUP_ATTACKING`/`_DEFENDING` hex clicks through `emitCornerKickGkPlace` (ahead of the generic `isValidMove`+`emitMove` fallback), since GK placement uses its own dedicated socket event rather than reusing `GAME_MOVE`
- Test suites: `useGameStore.test.ts` gained 18 new tests (selectPiece coverage for all 4 phases + sticky-selection coverage + both emitter tests); `HexGrid.test.tsx` gained 16 new tests (selectability, safe-tint destinations, required ring, and non-acting-player negative checks for all 4 phases)
- Full client suite: 674/674 tests green; `pnpm --filter @counter-attack/client build` compiles; `git diff packages/client/src/components/HexCell.tsx docs/HIGHLIGHT-REFERENCE.md` is empty (D-09 verified)

## Task Commits

Each task was committed atomically:

1. **Task 1: Store selection branches and socket emitters for the four interactive corner phases** - `63787a1` (feat)
2. **Task 2: HexGrid selectability, tints and rings for the corner phases (D-09)** - `914c1d9` (feat)

_Note: no plan-metadata commit is created by a worktree-isolated executor — the orchestrator handles final metadata commits after merge._

## Files Created/Modified

- `packages/client/src/store/useGameStore.ts` - Added 4 new `selectPiece` phase branches, `CORNER_KICK_FINAL_SETUP_CONFIG`, widened `ResponseMoveValidHexConfig`'s field-name unions, extended `setGameState`'s sticky-selection logic (clear conditions + within-stage stickiness), added `emitCornerKickGkPlace`/`emitCornerKickTaker`
- `packages/client/src/store/useGameStore.test.ts` - Added 2 new describe blocks (`selectPiece Corner Kick`, `setGameState sticky-selection for Corner Kick`) plus 2 emitter tests in the existing "emit actions" block — 18 new tests total
- `packages/client/src/components/HexGrid.tsx` - Added 8 per-slice `cornerKick*` selectors, 4 `canSelectCornerKick*` predicates, `isClickable`/`handleClick` wiring, the `cornerKickHex` required-ring dispatch arm, and the `CORNER_KICK_GK_SETUP_*` onClick branch calling `emitCornerKickGkPlace`
- `packages/client/src/components/HexGrid.test.tsx` - Added one new describe block covering selectability, safe-tint destinations, the required ring, and non-acting-player negative checks for all 4 corner phases — 16 new tests

## Decisions Made

- `CORNER_KICK_GK_SETUP_ATTACKING`/`_DEFENDING` hex clicks were wired to `emitCornerKickGkPlace` directly in `HexGrid.tsx`'s onClick cascade (not deferred to the future `CornerKickSetupPanel`), since the destination hex can only come from a hex click and 38-01's SUMMARY confirms this is a dedicated event, not a `GAME_MOVE` reuse — matches the KICK_OFF_SETUP/FREE_KICK_SETUP precedent for "click any valid hex" placement flows
- `CORNER_KICK_TAKER_SELECT` deliberately gets NO onClick wiring in this plan — its `validMoveHexes` is always empty (server-fixed destination), so selection is piece-click-only; the eventual `emitCornerKickTaker` call is a Confirm-button concern owned by the future panel plan (38-07), mirroring `canSelectThrowIn`'s identical precedent
- `CORNER_KICK_REPOSITION`/`CORNER_KICK_FINAL_SETUP` deliberately reuse the generic `isValidMove && selectedPieceId → emitMove` fallback already present in the onClick cascade — no new emitter or branch needed, per 38-01's documented decision that these two windows reuse `GAME_MOVE`/`GAME_END_TURN`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added dedicated onClick wiring for CORNER_KICK_GK_SETUP_ATTACKING/\_DEFENDING**

- **Found during:** Task 2 (HexGrid selectability, tints and rings)
- **Issue:** The plan's Task 2 `<action>`/`<behavior>` text scopes explicitly to "selectability, tints and rings" and does not mention onClick/emit wiring. However, `CORNER_KICK_GK_SETUP_*`'s destination is an uncapped hex click (Assumption A1), and 38-01's SUMMARY confirms `GAME_CORNER_KICK_GK_PLACE` is a dedicated event (not a `GAME_MOVE` reuse) — without an explicit onClick branch, a hex click during this phase would fall through to the generic `isValidMove && selectedPieceId → emitMove` branch and silently emit the wrong event (`GAME_MOVE` instead of `GAME_CORNER_KICK_GK_PLACE`), leaving the feature non-functional even though selectability/tints render correctly.
- **Fix:** Added a dedicated onClick branch (mirroring the existing KICK_OFF_SETUP/FREE_KICK_SETUP pattern) that calls `emitCornerKickGkPlace(selectedPieceId, hex)` for these two phases, placed before the generic fallback branch.
- **Files modified:** `packages/client/src/components/HexGrid.tsx`
- **Verification:** No new test directly exercises the click (out of this plan's stated behavior list), but the branch was manually traced against the onClick cascade's `else if` ordering to confirm it fires before the generic fallback; full test suite (674 tests) remains green.
- **Committed in:** `914c1d9` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical functionality)
**Impact on plan:** Necessary for the GK reposition window to actually function once the future panel plan wires up its UI — without this, clicking a hex during CORNER*KICK_GK_SETUP*\* would silently emit the wrong socket event. No scope creep — the fix stays within HexGrid.tsx's existing onClick cascade pattern and doesn't touch server code, HexCell.tsx, or add new highlight types.

## Issues Encountered

- Fresh worktree checkout had no `node_modules` installed (same one-time setup cost 38-01 encountered). Ran `pnpm install` at the repo root, then `pnpm --filter @counter-attack/shared build` to produce the `dist/` output the client's vitest config resolves `@counter-attack/shared` against — this is a one-time setup cost, not a plan deviation, and did not touch the main repo's `node_modules`.
- `pnpm --filter @counter-attack/client typecheck` (not part of this plan's `<verify>` command) surfaces two pre-existing failures unrelated to this plan's file scope: `GameBoard.tsx`'s `PHASE_LABEL` is missing the 5 new Corner Kick `GamePhase` keys (expected — `GameBoard.tsx` is explicitly scoped to a later plan per `38-PATTERNS.md`), and an unrelated `ActionLog.tsx` return-statement gap. Neither file was touched by this plan (confirmed via `git diff --stat`); logged to `.planning/phases/38-corner-kick/deferred-items.md` per the Scope Boundary rule rather than fixed here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four interactive Corner Kick phases now have a complete, server-mirroring client interaction layer: correct piece selectability, valid-destination computation, safe/required tint-ring rendering, and (for GK placement) the correct dedicated socket emission — ready for the panel work (38-07, `CornerKickSetupPanel.tsx`) to wire Confirm buttons for `CORNER_KICK_TAKER_SELECT`'s `emitCornerKickTaker` call and the alternating-window/pre-kick-window "N players left" constraint UI.
- `GameBoard.tsx`'s `PHASE_LABEL`/phase-dispatch gap (5 new phase keys, `CornerKickSetupPanel` dispatch) remains open for whichever later 38-0X plan owns that file per `38-PATTERNS.md`'s file classification — tracked in `deferred-items.md`.
- No blockers for downstream plans: `useGameStore.ts`'s `selectPiece`/`setGameState`/emitters and `HexGrid.tsx`'s selectors/predicates/rendering are all committed, tested, and typecheck-clean within this plan's own file scope.

## Known Stubs

None - this plan wires existing store/grid infrastructure for already-defined `GameState` fields and socket events (from 38-01); no placeholder data or hardcoded empty values were introduced.

## Threat Flags

None - this plan's threat model (T-38-23/24/25, T-38-SC) was addressed exactly as scoped: T-38-23 (client selectability is advisory only, server is authoritative) holds for every new predicate added; T-38-24 (`emitCornerKickTaker` payload widening) is closed by the single-argument implementation, verified by a dedicated test asserting exactly 2 total call arguments (event name + pieceId); T-38-25 (whole-grid re-render) is closed by the 8 per-slice selectors (never an object selector); T-38-SC (package installs) — no new package-manager installs occurred beyond the pre-existing `pnpm install` for worktree setup.

---

## Self-Check: PASSED

- FOUND: packages/client/src/store/useGameStore.ts
- FOUND: packages/client/src/store/useGameStore.test.ts
- FOUND: packages/client/src/components/HexGrid.tsx
- FOUND: packages/client/src/components/HexGrid.test.tsx
- FOUND: .planning/phases/38-corner-kick/38-06-SUMMARY.md
- FOUND: .planning/phases/38-corner-kick/deferred-items.md
- FOUND commit: 63787a1 (Task 1)
- FOUND commit: 914c1d9 (Task 2)

_Phase: 38-corner-kick_
_Completed: 2026-08-07_
