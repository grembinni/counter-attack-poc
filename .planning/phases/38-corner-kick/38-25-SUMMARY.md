---
phase: 38-corner-kick
plan: 25
subsystem: game-engine
tags: [corner-kick, gap-closure, restart-flow, automatic-movement]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 20)
    provides: CORNER_KICK_CLEAR_OUT GamePhase/CORNER_KICK_CLEAR_OUT_MOVE ActionEventType, cornerKickClearOutSlot GameState field, and the interactive hasLegalClearOutMove/applyCornerKickClearOut/applyCornerKickClearOutEnd engine functions this plan deletes
  - phase: 38-corner-kick (plan 21)
    provides: the GAME_MOVE/GAME_END_TURN CORNER_KICK_CLEAR_OUT socket branches this plan deletes
  - phase: 38-corner-kick (plan 24)
    provides: the human-verifier checkpoint (38-24-SUMMARY.md bug 1) that rejected the interactive clear-out UX and mandated the automatic straight-line-toward-goal replacement this plan implements
provides:
  - 'cornerClearOutDestination pure helper in packages/shared/src/outOfBounds.ts — single source of truth for where an in-zone piece lands (line-walk toward goal, PITCH_HEXES fallback, never returns an off-pitch/occupied/in-zone hex)'
  - 'applyAutomaticCornerClearOut(pieces, cornerHex, cornerKickTeam) in packages/server/src/gameEngine.ts — applies the clear-out to every in-zone piece in one pass, order-stable occupancy, appending CORNER_KICK_CLEAR_OUT_MOVE events'
  - "triggerOutOfBoundsRestart's CORNER_KICK branch now calls applyAutomaticCornerClearOut against the resolved corner hex and returns phase: 'CORNER_KICK_GK_SETUP_ATTACKING' directly — no CORNER_KICK_CLEAR_OUT phase, no clear-out panel, no Confirm click"
  - 'Complete removal of the interactive clear-out engine functions (hasLegalClearOutMove, applyCornerKickClearOut, applyCornerKickClearOutEnd) and their GAME_MOVE/GAME_END_TURN socket branches'
affects:
  [
    '38-26 (client cleanup — CornerKickSetupPanel/HexGrid/useGameStore/EventBanner/GameBoard/restartErrorMessage still reference the CORNER_KICK_CLEAR_OUT phase and cornerKickClearOutSlot field; the phase is now unreachable so this client code is dead but harmless)',
    '38-28 (removes the CORNER_KICK_CLEAR_OUT GamePhase literal and cornerKickClearOutSlot field from packages/shared/src/types.ts once the client references identified above are gone)',
  ]
requirements-completed: [OOB-03, CORNER-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Automatic single-pass relocation at award time, mirroring the existing goal-kick "clear the box" mechanic, instead of an interactive per-hex click-and-confirm flow — the pattern the human verifier explicitly asked for (38-24-SUMMARY.md bug 1)'
    - 'A pure geometry helper (cornerClearOutDestination) owns the destination computation; the engine helper (applyAutomaticCornerClearOut) owns only piece-array iteration, occupancy threading, and event construction — mirrors the existing split between isLegalClearOutStep and the deleted applyCornerKickClearOut'

key-files:
  created: []
  modified:
    - packages/shared/src/outOfBounds.ts
    - packages/shared/src/outOfBounds.test.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
    - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts
    - packages/server/src/__tests__/gameHandlers.cornerKick.test.ts
    - packages/server/src/__tests__/cornerKick.integration.test.ts

key-decisions:
  - "cornerClearOutDestination walks hexLine(from, goalHex) from index 1, skipping (not aborting on) any candidate that is off-pitch, occupied, or still inside the exclusion zone — a blocked hex mid-line can never strand a piece inside the zone. Falls back to a PITCH_HEXES scan (distance-from-from, then distance-from-goal, then q, then r) mirroring resolveThrowInHex's existing deterministic sort shape."
  - 'applyAutomaticCornerClearOut threads a mutable working copy of the pieces array through a single ordered loop so each subsequent piece sees the positions already produced by earlier pieces in the same call — deterministic, order-stable, and the moving piece is always excluded from its own occupancy check.'
  - "cornerKickClearOutSlot is never written again anywhere in gameEngine.ts (removed from triggerOutOfBoundsRestart's return, CORNER_KICK_TEARDOWN, and applyCornerKickFinalSetupEnd's defensive re-assertion) but the field itself stays declared in packages/shared/src/types.ts, per the plan's explicit instruction — plan 38-28 removes it once client references are gone."
  - "Client-side CORNER_KICK_CLEAR_OUT UI code (CornerKickSetupPanel, HexGrid selectability, useGameStore selectPiece branch, EventBanner/GameBoard phase labels, restartErrorMessage wire-code mapping) was deliberately left untouched — the phase is now unreachable from the server so this code is dead but harmless; removing it is 38-26's explicit scope, not this plan's."

patterns-established: []

# Metrics
duration: ~35min
completed: 2026-08-09
---

# Phase 38 Plan 25: Automatic Corner Clear-Out Summary

**Replaced the interactive click-to-select-destination corner clear-out (38-20/38-21/38-22) with a single automatic straight-line-toward-goal relocation applied server-side at corner-award time — a corner now opens directly on the attacking goalkeeper reposition window, with zero manager interaction before it.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-09
- **Tasks:** 3/3 completed
- **Files modified:** 8 (2 shared, 6 server)

## Accomplishments

- `cornerClearOutDestination(from, cornerHex, goalHex, occupied)` added to `packages/shared/src/outOfBounds.ts` — a pure function computing the automatic landing hex for one in-zone piece: returns `from` unchanged if already clear; otherwise walks `hexLine(from, goalHex)` for the first on-pitch, unoccupied, out-of-zone candidate; falls back to a deterministic `PITCH_HEXES` scan if the line yields nothing; never returns an off-pitch or occupied hex. 20 new tests assert derived geometry (never restated coordinates), including exhaustive coverage of every zone hex of all four `CORNER_KICK_HEX` corners.
- `applyAutomaticCornerClearOut(pieces, cornerHex, cornerKickTeam)` added to `packages/server/src/gameEngine.ts` — iterates the piece array in order, threading a mutable working copy so occupancy checks see prior pieces' new positions within the same call; appends one `CORNER_KICK_CLEAR_OUT_MOVE` event per piece actually moved (`slot: 'ATTACKER'`/`'DEFENDER'` derived from team membership), reusing the existing event variant verbatim.
- `triggerOutOfBoundsRestart`'s `CORNER_KICK` branch now calls this helper immediately after `resolvedCornerHex` is computed and returns `phase: 'CORNER_KICK_GK_SETUP_ATTACKING'` directly — `cornerKickClearOutSlot` is entirely absent from the return object, and the clear-out events are appended to `eventLog` right after the `OUT_OF_BOUNDS` event.
- Deleted outright: `hasLegalClearOutMove`, `applyCornerKickClearOut` (+ `ApplyCornerKickClearOutResult`), `applyCornerKickClearOutEnd` (+ `ApplyCornerKickClearOutEndResult`) from `gameEngine.ts`; the `GAME_MOVE` and `GAME_END_TURN` `CORNER_KICK_CLEAR_OUT` branches (and their imports) from `gameHandlers.ts`; `CORNER_KICK_CLEAR_OUT` removed from `ZONE_CHECK_EXEMPT_PHASES` and every `cornerKickClearOutSlot` write site in the server package.
- Every test asserting the old `CORNER_KICK_CLEAR_OUT` intermediate phase was re-expected against `CORNER_KICK_GK_SETUP_ATTACKING` directly (`gameEngine.cornerKick.test.ts`, `gameEngine.outOfBounds.test.ts`, `cornerKick.integration.test.ts`); the interactive clear-out unit/socket test blocks were deleted and replaced with tests proving the automatic relocation: no piece of either team ends inside the exclusion zone, the event count matches the pre-call in-zone piece count, already-clear pieces are untouched, and the clear-out events appear after `OUT_OF_BOUNDS` in the log. `gameHandlers.cornerKick.test.ts`'s socket-level clear-out tests (and their now-orphaned seed helpers) were deleted entirely.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the pure cornerClearOutDestination helper to the shared package** - `0ba8226` (feat)
2. **Task 2: Apply the clear-out automatically at corner-award time and delete the interactive engine functions** - `c552c9b` (feat)
3. **Task 3: Remove the clear-out socket surface from the handlers** - `219e23a` (feat)

_Note: SUMMARY.md is committed separately below (worktree parallel-executor mode — orchestrator owns STATE.md/ROADMAP.md updates after merge)._

## Files Created/Modified

- `packages/shared/src/outOfBounds.ts` — `cornerClearOutDestination` added (new imports: `hexLine`, `PITCH_HEXES`)
- `packages/shared/src/outOfBounds.test.ts` — 20 new tests for `cornerClearOutDestination`
- `packages/server/src/gameEngine.ts` — `applyAutomaticCornerClearOut` + `AutomaticCornerClearOutResult` added; `triggerOutOfBoundsRestart`'s `CORNER_KICK` branch rewritten; `hasLegalClearOutMove`/`applyCornerKickClearOut`/`applyCornerKickClearOutEnd` deleted; `ZONE_CHECK_EXEMPT_PHASES` and `CORNER_KICK_TEARDOWN` updated; `hexNeighbors`/`isLegalClearOutStep` imports dropped (unused after deletion), `cornerClearOutDestination` import added
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` — re-expected against the new automatic-award behavior; `CORNER_KICK_CLEAR_OUT (38-15 defect 3)` describe block replaced with `automatic corner clear-out (gap-closure round 3, 38-25)`, including direct `applyAutomaticCornerClearOut` unit coverage
- `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` — the single `CORNER_KICK_CLEAR_OUT` expectation re-expected to `CORNER_KICK_GK_SETUP_ATTACKING`
- `packages/server/src/gameHandlers.ts` — the two `CORNER_KICK_CLEAR_OUT` socket branches and their imports deleted; the stale `validUndoPhases` comment paragraph removed
- `packages/server/src/__tests__/gameHandlers.cornerKick.test.ts` — the `CORNER_KICK_CLEAR_OUT over the socket` describe block and its orphaned seed helpers (`seedCornerKickClearOut`, `clearOutLegalTarget`, `clearOutIllegalTarget`) deleted
- `packages/server/src/__tests__/cornerKick.integration.test.ts` — `driveLooseBallToCorner` now stops at `CORNER_KICK_GK_SETUP_ATTACKING`; `seedCornerKickLooseBall` extended with an optional `inZonePiece` override; the interactive clear-out socket tests replaced with a real-socket test proving automatic relocation; the still-valid permanent-exclusion-zone-during-reposition test moved to its own describe block; the now-unused `waitForState` helper removed

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

None — plan executed exactly as written. Test-file scope beyond the plan's declared `files_modified` list (`gameEngine.outOfBounds.test.ts` was already listed; no files outside the plan's own declared set were touched) was all directly required by the plan's own verification gates.

## Issues Encountered

The worktree had no `node_modules` at session start (fresh worktree, no prior `pnpm install`). Ran `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared build` before any test could run — a standard workspace-bootstrap step, not a package addition; no `package.json` changed.

Root `pnpm lint` (`eslint .`) fails with the pre-existing, documented `packages/shared` typescript-eslint file-count-cap parsing error (`.planning/phases/32-code-cleanup/deferred-items.md`), unrelated to this plan. Every file this plan touched was verified lint-clean individually via targeted `eslint` runs (`pnpm --filter @counter-attack/server exec eslint <files>`), and the pre-commit `lint-staged` hook (which scopes to staged files, not the whole workspace) passed on every commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `pnpm --filter @counter-attack/shared test`: 706 passed, all green.
- `pnpm --filter @counter-attack/server test`: 1030 passed, 1 skipped, 1 todo, all green (up from the pre-plan baseline; no test deleted without replacement — the interactive clear-out unit/socket tests were replaced 1:1 in scope by automatic-clear-out tests).
- `pnpm --filter @counter-attack/shared typecheck` and `pnpm --filter @counter-attack/server typecheck` both exit 0.
- `grep -rn "CORNER_KICK_CLEAR_OUT'" packages/server packages/shared/src/outOfBounds.ts` produces no output — no interactive clear-out phase literal remains server-side.
- **38-26 readiness:** the client (`CornerKickSetupPanel.tsx`, `HexGrid.tsx`, `useGameStore.ts`, `EventBanner.tsx`, `GameBoard.tsx`, `restartErrorMessage.ts`) still contains substantial `CORNER_KICK_CLEAR_OUT`/`cornerKickClearOutSlot` handling code, entirely untouched by this plan. That phase is now unreachable from the server, so the client code is dead but harmless (it will simply never activate) — not a runtime risk, but it needs to be removed as part of 38-26's client cleanup scope before 38-28 can safely delete the `CORNER_KICK_CLEAR_OUT` `GamePhase` literal and `cornerKickClearOutSlot` field from `packages/shared/src/types.ts`.
- No blockers for 38-26 or any later gap-closure plan.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-09_

## Self-Check: PASSED
