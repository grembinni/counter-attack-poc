---
phase: 17-rule-bugs
plan: '05'
subsystem: shared-types, server-engine, client-ui
tags: [feature, tdd, wave-5, OFFSIDE-01, phase-17, offside]
dependency_graph:
  requires:
    - 17-04 (MOVE-06 FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE corrected design — applyFreeMoveEnd shape this plan extends)
  provides:
    - evaluateOffside / isOffsideNow / isClearedNow / opposingPiecesEqualOrAhead / isPastHalfway / isAheadOf / attackingDirection / OFFSIDE_HALFWAY_Q (packages/shared/src/offside.ts)
    - GameState.offsidePieceIds sticky field
    - offsidePieceIds wiring at every applyEndTurn ok:true return + every applyFreeMoveEnd return
    - PieceOverlay isOffside prop + double-width red ring (#dc2626, strokeWidth 5)
    - HexGrid offsidePieceIds -> isOffside wiring per piece
  affects:
    - packages/shared/src/types.ts
    - packages/shared/src/offside.ts
    - packages/shared/src/index.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/offside.test.ts
    - packages/client/src/components/PieceOverlay.tsx
    - packages/client/src/components/PieceOverlay.test.tsx
    - packages/client/src/components/HexGrid.tsx
tech_stack:
  added: []
  patterns:
    - Pure geometry-helper module mirroring computeBallZone's standalone-function style in pitch.ts
    - Sticky id-set recompute pattern (evaluateOffside) mirroring evaluateOffside-from-scratch-never semantics — analogous to MOVE-06's freeMoveResume snapshot/restore convention
    - Single nextOffside = evaluateOffside(state) computed once per apply* call, spread into every ok:true return (avoids redundant recomputation across branches that don't change piece positions)
    - Independent boolean-driven SVG ring layer (isOffside) added alongside the existing selectionState-driven ring switch in PieceOverlay — established UX-05 ring pattern, extended as a separate layer rather than folded into the enum
key_files:
  created:
    - packages/shared/src/offside.ts
    - packages/server/src/__tests__/offside.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/index.ts
    - packages/server/src/gameEngine.ts
    - packages/client/src/components/PieceOverlay.tsx
    - packages/client/src/components/PieceOverlay.test.tsx
    - packages/client/src/components/HexGrid.tsx
decisions:
  - 'OFFSIDE_HALFWAY_Q = PITCH_REGIONS.kickOffHex.q (18) — single source of truth shared with kick-off own-half enforcement, per D-21'
  - 'evaluateOffside never recomputes from scratch — sticky set = (prior flagged minus now-cleared) union (newly offside-now), satisfying D-23 exactly'
  - 'applyEndTurn computes nextOffside = evaluateOffside(state) once after the WRONG_SLOT guard (not per-return) since no return in that function mutates piece positions — avoids 4x redundant O(n^2) scans per call'
  - 'Intermediate ATTACKER_4->DEFENDER_5 / DEFENDER_5->ATTACKER_2 slot transitions in applyEndTurn also re-evaluate offside (plan D-23 explicit requirement: pieces moved during that slot)'
  - 'applyFreeMoveEnd re-evaluates offside on all 3 of its returns (FREE_MOVE_ATTACK->FREE_MOVE_DEFENSE handoff, and both resume-phase returns) because pieces may have moved during whichever sub-phase is ending at each return — broader than the plan literal text ("its returned PASS state") but consistent with the same D-23 rule and the actual 3-return shape applyFreeMoveEnd has after the 17-04 corrected design (the plan text referenced a stale single-PASS-return shape that no longer exists)'
  - 'offsidePieceIds placed immediately after freeMoveUsedPace in GameState (per plan instruction), ahead of freeMoveResume/passerId which were added later by 17-04'
  - 'Red ring color #dc2626 (deeper red) chosen distinct from the existing #ef4444 away-team-role-rect color already in PieceOverlay — visually distinguishable layer per D-25'
  - 'Did NOT route the offside check through the centralized applyFreeMoveZoneCheck/broadcastState hook that MOVE-06 (17-04) introduced — plan 17-05 explicitly specifies wiring at applyEndTurn/applyFreeMoveEnd only; treated as in-scope precision, not a missed architectural opportunity'
metrics:
  duration: ~25min (Tasks 1-3; Task 4 checkpoint pending)
  completed: 'pending human verification'
  tasks_completed: 3
  files_changed: 8
---

# Phase 17 Plan 05: OFFSIDE-01 Detection + Red Ring Summary

Server-side sticky offside detection (team-relative, all pieces including GKs, evaluated at every movement-phase-ending transition) plus a client-side double-width red ring marker, independent of piece selection state. This plan implements detection and visualization only — the foul/free-kick consequence (OFFSIDE-02) is deferred to plan 17-06.

## Tasks Completed

| #   | Task                                                             | Commit    | Files                                                               |
| --- | ---------------------------------------------------------------- | --------- | ------------------------------------------------------------------- |
| 1   | Shared offside geometry + GameState.offsidePieceIds + unit tests | `ef468a5` | `types.ts`, `offside.ts` (new), `index.ts`, `offside.test.ts` (new) |
| 2   | Wire evaluateOffside into applyEndTurn + applyFreeMoveEnd        | `8051d8e` | `gameEngine.ts`, `offside.test.ts`                                  |
| 3   | PieceOverlay double-width red ring + HexGrid wiring              | `a07b426` | `PieceOverlay.tsx`, `PieceOverlay.test.tsx`, `HexGrid.tsx`          |

## Test Results

### Before plan 17-05

- 379 server passing (1 skipped, 1 todo — pre-existing, unrelated), 134 client passing, shared typecheck clean.

### After plan 17-05 (Tasks 1-3)

- Server: 379 passing, 1 skipped, 1 todo (same pre-existing exclusions — zero new failures). `offside.test.ts` alone: 34/34 passing.
- Client: 134 passing (was 131 before; +3 new offside ring tests). `PieceOverlay.test.tsx` alone: 18/18 passing.
- Shared: `tsc --noEmit` exits 0.

### Task 1 — shared geometry helpers (32 unit tests, all green)

- `attackingDirection`: home=1, away=-1 ✓
- `isPastHalfway`: exclusive boundary at q=18 for both directions ✓
- `isAheadOf`: exclusive boundary (level is not ahead) for both directions ✓
- `opposingPiecesEqualOrAhead`: any-role/GK-included counting, team-exclusive ✓
- `isOffsideNow`: all three D-21 boundary conditions (exactly-on-halfway, exactly-level-with-ball, exactly 1 vs 2 opposing) ✓
- `isClearedNow`: both D-22 clear branches (behind ball / >=2 opposing) ✓
- `evaluateOffside`: sticky carry-forward, both clear paths, D-24 defender-flagged case, missing-field default ✓

### Task 2 — engine wiring (2 new applyEndTurn integration tests, all green)

- Flags a piece on ATTACKER_2 end-of-turn (past halfway, ahead of ball, 1 opposing) then clears it once dropped behind the ball on a follow-up end-turn (sticky -> cleared) ✓
- Intermediate ATTACKER_4->DEFENDER_5 slot transition also re-evaluates and carries the flag ✓
- All pre-existing `gameEngine.test.ts` / `gameEngine.phase17.test.ts` / `gameEngine.phase8.test.ts` / `gameEngine.phase10.test.ts` / `gameEngine.rule11.test.ts` / `gameEngine.teamselect.test.ts` suites unchanged and green ✓

### Task 3 — PieceOverlay/HexGrid (3 new tests, all green)

- `isOffside=true` renders exactly one `#dc2626` strokeWidth-5 ring ✓
- `isOffside=true` + `selectionState='active'` renders BOTH the green active ring and the red offside ring ✓
- `isOffside=false` (default) renders no red ring ✓
- Full client suite (134 tests across 10 files, including `HexGrid.test.tsx` and `GameBoard.test.tsx`) unaffected ✓

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues required Rule 1/2/3 fixes during Tasks 1-3. The implementation followed the plan's exact specifications.

### Notable plan-text vs. current-codebase reconciliation (not a deviation — documented for traceability)

The plan's `<read_first>` line-number references for `applyEndTurn` (643-775) and the described shape of `applyFreeMoveEnd` (a single PASS-returning function) reflected an earlier draft of the codebase. By the time this plan executed, plan 17-04's corrected MOVE-06 design had already landed: `applyEndTurn`'s phase check uses `'MOVE'` (not `'MOVEMENT'`), its 4 `ok:true` returns live at lines 779-881, and `applyFreeMoveEnd` has 3 returns (FREE_MOVE_ATTACK->FREE_MOVE_DEFENSE handoff, FREE_MOVE_ATTACK->resume when defense list is empty, FREE_MOVE_DEFENSE->resume) rather than the plan's described single PASS return. The implementation followed the plan's _intent_ (re-evaluate offside at every point where the engine knows movement for a sub-phase has concluded) applied to the _actual_ current shape of both functions, adding `offsidePieceIds: nextOffside` to all 4 `applyEndTurn` returns and all 3 `applyFreeMoveEnd` returns. This is a closer match to the plan's stated D-23 requirement ("re-evaluated at every end-of-phase where pieces can move") than a literal line-number-driven edit would have produced, since two of the three `applyFreeMoveEnd` returns are themselves movement-phase-ends that the plan's stale description didn't anticipate.

## Checkpoint Pending

Task 4 is a `checkpoint:human-verify` (gate="blocking") — functional behavior needs human verification in a live two-tab session. See the orchestrator handoff for full verification steps (detection, stickiness across a non-moving turn, clearing via both D-22 paths, and team-relative defender flagging).

## Known Stubs

None — server-side detection and client-side rendering are both fully wired end-to-end. No placeholder/mock data paths were introduced.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-17-05-01..03, all server-authoritative / cosmetic-client / bounded-O(n²), all already disposed as mitigate/accept in the plan). No new network endpoints, auth paths, or schema changes at trust boundaries were introduced beyond the single new `GameState.offsidePieceIds` field, which is computed server-side only and never accepted as client input.

## Self-Check

Files exist:

- `packages/shared/src/offside.ts` — created (exports `evaluateOffside`, `isOffsideNow`, `isClearedNow`, `opposingPiecesEqualOrAhead`, `isPastHalfway`, `isAheadOf`, `attackingDirection`, `OFFSIDE_HALFWAY_Q`) ✓
- `packages/server/src/__tests__/offside.test.ts` — created (34 tests) ✓
- `packages/shared/src/types.ts` — modified (contains `offsidePieceIds?: readonly string[]`) ✓
- `packages/shared/src/index.ts` — modified (re-exports `./offside.js`) ✓
- `packages/server/src/gameEngine.ts` — modified (imports `evaluateOffside`; all `applyEndTurn`/`applyFreeMoveEnd` returns carry `offsidePieceIds`) ✓
- `packages/client/src/components/PieceOverlay.tsx` — modified (contains `isOffside` prop + `#dc2626` ring) ✓
- `packages/client/src/components/PieceOverlay.test.tsx` — modified (3 new offside ring tests) ✓
- `packages/client/src/components/HexGrid.tsx` — modified (reads `offsidePieceIds`, passes `isOffside` to `PieceOverlay`) ✓

Commits exist:

- `ef468a5` feat(17-05): add shared offside geometry helpers + sticky GameState field ✓
- `8051d8e` feat(17-05): wire evaluateOffside into applyEndTurn + applyFreeMoveEnd ✓
- `a07b426` feat(17-05): add PieceOverlay double-width red offside ring + HexGrid wiring ✓

Verification:

- `pnpm --filter @counter-attack/shared exec tsc --noEmit` — exits 0 ✓
- `pnpm --filter @counter-attack/server test -- offside gameEngine` — 257 passing, 1 skipped (pre-existing, unrelated) ✓
- `pnpm --filter @counter-attack/server test` (full suite) — 379 passing, 1 skipped, 1 todo (pre-existing, unrelated) ✓
- `pnpm --filter @counter-attack/client test -- PieceOverlay` — 18 passing ✓
- `pnpm --filter @counter-attack/client test` (full suite) — 134 passing ✓
- Human checkpoint (Task 4) pending

## Self-Check: PASSED
