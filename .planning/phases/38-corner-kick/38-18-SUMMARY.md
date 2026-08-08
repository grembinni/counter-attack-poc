---
phase: 38-corner-kick
plan: 18
subsystem: ui
tags: [corner-kick, gap-closure, zustand, react, activation-lock, wire-code-mapping]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: "38-16's cornerKickActivatedIds/cornerKickStagePlacedIds GameState contract, and 38-17's server-side uncapped-reposition + PIECE_LOCKED implementation (parallel plan, not yet merged into this worktree)"
provides:
  - 'Client-side uncapped CORNER_KICK_REPOSITION selection (no cornerKickUsedPace gate) in useGameStore.ts and HexGrid.tsx'
  - "cornerKickActivatedIds-driven activation lock: selectability, sticky-selection, and the existing orange-ring/red-X 'activated' PieceOverlay treatment"
  - 'CORNER_KICK_FINAL_SETUP isSpentNow arm keyed on cornerKickMovedPieceId'
  - "Corrected CornerKickSetupPanel constraint copy ('unlimited distance' + one-activation-per-window row) and activation-based remaining-count derivation"
  - 'PIECE_LOCKED plus five other previously-unmapped GAME_ERROR wire codes (NOT_ELIGIBLE, NOT_ADJACENT, STAGE_LIMIT_REACHED, NOT_GOALKEEPER, PACE_EXHAUSTED) added to restartErrorMessage.ts'
affects: [38-19, 38-20, 38-21, 38-22, 38-23, 38-24]
requirements-completed: [CORNER-03, CORNER-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side 'activated in an earlier stage' lock term (ledger includes id AND this-stage-placed set does not) mirrored identically across selectPiece, canSelectCornerKickReposition, isSpentNow, the sticky-selection ternary, and CornerKickSetupPanel's remaining-count filter — same boolean expression, five call sites, never restated as a different derivation"
    - 'Stage-cap literal eliminated: HexGrid now reads CORNER_KICK_STAGES[stageIndex].max instead of a hardcoded 2, matching what the panel already did'

key-files:
  created: []
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/CornerKickSetupPanel.tsx
    - packages/client/src/utils/restartErrorMessage.ts
    - .planning/phases/38-corner-kick/38-UI-SPEC.md
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/HexGrid.test.tsx
    - packages/client/src/components/CornerKickSetupPanel.test.tsx

key-decisions:
  - "D-GAP-03 (client half): mirrors 38-17's server-side interpretation verbatim — a piece is 'activated' (locked for the rest of the window) once touched in an EARLIER stage; a piece touched THIS stage remains freely movable for the rest of the stage regardless of how many hexes it has already moved. Movement itself has no per-piece hex budget."
  - "Wire-code scan (Task 2) surfaced five pre-existing gaps beyond the plan's named PIECE_LOCKED addition: NOT_ELIGIBLE, NOT_ADJACENT, STAGE_LIMIT_REACHED, NOT_GOALKEEPER, and PACE_EXHAUSTED were all already leaking to the DOM as raw wire tokens from various ApplyCornerKick*Result reason unions before this plan. Added all six under Rule 2 (missing critical functionality) since the task's own instruction explicitly authorized fixing whatever the scan found."

patterns-established: []

# Metrics
duration: ~25min (session interrupted mid-flow before first commit; work verified intact and resumed from disk state, no re-implementation needed)
completed: 2026-08-08
---

# Phase 38 Plan 18: Client Half of Corner-Kick Reposition Gap-Closure Summary

**Removed the client's independent 6-hex reposition cap and wired the new `cornerKickActivatedIds` ledger into selectability, the sticky-selection ternary, and the existing orange-ring/red-X `activated` piece treatment; corrected the panel's constraint copy; and mapped `PIECE_LOCKED` plus five other previously-unmapped `GAME_ERROR` wire codes discovered by re-running the module's mandated scan.**

## Performance

- **Duration:** ~25 min (work was interrupted by a provider session-limit error after all edits and verification were complete but before the first commit; on resume, every uncommitted file was re-verified against the plan and the full test suite before committing — no code needed to be redone)
- **Completed:** 2026-08-08
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- `useGameStore.ts`'s `CORNER_KICK_REPOSITION` `selectPiece` branch and the `setGameState` sticky-selection ternary no longer read `cornerKickUsedPace`/report a `paceRemaining` for this phase — both now gate solely on the activation lock (`cornerKickActivatedIds` minus this stage's `cornerKickStagePlacedIds`).
- `HexGrid.tsx`'s `canSelectCornerKickReposition` drops the `< 6` pace term and adds the activation-lock term plus a stage-cap term read from `CORNER_KICK_STAGES[stageIndex].max` (never a literal `2`). `isSpentNow` gains two new arms: `CORNER_KICK_REPOSITION` (spent when activated in an earlier stage) and `CORNER_KICK_FINAL_SETUP` (spent when `piece.id === cornerKickMovedPieceId`) — both render the pre-existing `'activated'` orange-ring/red-X `PieceOverlay` state with zero changes to `PieceOverlay.tsx`, `HexCell.tsx`, or `docs/HIGHLIGHT-REFERENCE.md` (D-09 verified via empty diff).
- `CornerKickSetupPanel.tsx`'s reposition-window constraint row changed from `"up to 2, up to 6 hexes each."` to `"up to 2, unlimited distance."` plus a new second row, `"A player who has been repositioned is done for this window."` The `remaining` eligible-count derivation switched from a pace filter to the same activation-lock term used everywhere else.
- `restartErrorMessage.ts` gained `PIECE_LOCKED` (the plan's named addition) plus five codes a full scan of every `ApplyCornerKick*Result` reason union surfaced as already-unmapped before this plan: `NOT_ELIGIBLE`, `NOT_ADJACENT`, `STAGE_LIMIT_REACHED`, `NOT_GOALKEEPER`, `PACE_EXHAUSTED`.
- `38-UI-SPEC.md`'s Copywriting Contract CORNER-03 row updated to match, citing 38-15 defect 1 and D-GAP-03 as the correction source.
- Client test suite reclassified (not deleted) every test that encoded the removed 6-hex budget, plus 2 new tests proving the activation lock and its uncapped-within-stage counterpart. Full suite: **751/751 passing** (up from **749** pre-plan baseline — 2 net-new tests, zero removed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Make corner reposition selection uncapped and activation-aware in the store and HexGrid** - `a01da35` (feat)
2. **Task 2: Correct the reposition panel copy and count, and map the new PIECE_LOCKED code** - `7336266` (feat)
3. **Task 3: Update and extend the client tests for uncapped, activation-gated repositioning** - `c211a5d` (test)

_Note: SUMMARY.md is committed separately below (worktree parallel-executor mode — orchestrator owns STATE.md/ROADMAP.md updates after merge)._

## Files Created/Modified

- `packages/client/src/store/useGameStore.ts` - Removed the `cornerKickUsedPace` pace-cap read from `selectPiece`'s `CORNER_KICK_REPOSITION` branch and the sticky-selection ternary; both now gate on the activation lock
- `packages/client/src/components/HexGrid.tsx` - `cornerKickActivatedIds`/`cornerKickStagePlacedIds` selectors added, `cornerKickUsedPace` selector removed; `canSelectCornerKickReposition` and `isSpentNow` rewritten per D-GAP-03; `CORNER_KICK_STAGES` imported for the stage-cap term
- `packages/client/src/components/CornerKickSetupPanel.tsx` - Constraint-row copy corrected, second row added, `remaining` derivation switched to the activation term
- `packages/client/src/utils/restartErrorMessage.ts` - Six new wire-code-to-sentence mappings (`PIECE_LOCKED`, `NOT_ELIGIBLE`, `NOT_ADJACENT`, `STAGE_LIMIT_REACHED`, `NOT_GOALKEEPER`, `PACE_EXHAUSTED`)
- `.planning/phases/38-corner-kick/38-UI-SPEC.md` - CORNER-03 constraint-row entry corrected to match the new copy
- `packages/client/src/store/useGameStore.test.ts` - Reclassified 2 tests, added 1 new test (sticky-selection earlier-stage lock)
- `packages/client/src/components/HexGrid.test.tsx` - Reclassified 1 test, added 1 new test (touched-this-stage still selectable)
- `packages/client/src/components/CornerKickSetupPanel.test.tsx` - Reclassified 3 tests to seed activation fields instead of pace

## Decisions Made

See `key-decisions` in frontmatter above. Both decisions were dictated by the plan's explicit instructions (D-GAP-03's interpretation was set by the parallel server plan 38-17 and this plan's own doc comments require mirroring it; the wire-code scan's expanded scope was explicitly authorized by Task 2's action text: "add a sentence for any OTHER unmapped code that scan surfaces").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added five wire-code mappings beyond the plan's named PIECE_LOCKED**

- **Found during:** Task 2's mandated wire-code scan
- **Issue:** Re-running the header-comment grep plus a scan of every `ApplyCornerKickGkPlaceResult`/`ApplyCornerKickTakerSelectResult`/`ApplyCornerKickRepositionResult`/`ApplyCornerKickFinalMoveResult` reason union in `gameEngine.ts` surfaced five codes already reachable via `socket.emit(GAME_ERROR, result.reason)` in `gameHandlers.ts` but absent from `RESTART_ERROR_MESSAGES`: `NOT_ELIGIBLE`, `NOT_ADJACENT`, `STAGE_LIMIT_REACHED` (corner reposition/final-move guards) and `NOT_GOALKEEPER` (`applyCornerKickGkPlace`). `PACE_EXHAUSTED` also scanned as unmapped — it is removed from the reposition-window result union by the parallel 38-17 plan but remains real and still-emitted for `CORNER_KICK_FINAL_SETUP`'s 3-hex pre-kick cap (`applyCornerKickFinalMove`), which this plan explicitly leaves untouched.
- **Fix:** Added all five as new `RESTART_ERROR_MESSAGES` entries alongside `PIECE_LOCKED`, satisfying the same formatting invariants (`restartErrorMessage.test.ts`'s existing table-driven test) the map's other entries already meet.
- **Files modified:** `packages/client/src/utils/restartErrorMessage.ts`
- **Verification:** `pnpm --filter @counter-attack/client test -- restartErrorMessage` passes (33 tests, all formatting-invariant assertions included); `grep -n "PIECE_LOCKED" packages/client/src/utils/restartErrorMessage.ts` matches exactly one line.
- **Committed in:** `7336266` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality, explicitly authorized by the task's own instruction)
**Impact on plan:** No scope creep — the task's action text directly requested this scan and its findings. All five additions are pure additive wire-code-to-sentence mappings with no behavioral change to any other file.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no `dist/` at session start (same bootstrap gap 38-16 hit). Ran `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared build` — standard workspace-bootstrap steps, no `package.json` changes, `dist/` gitignored.
- Mid-session, the agent process was interrupted by a provider session-limit error after all three tasks' edits and full-suite verification were complete but before the first `git commit`. On resume: re-read the plan, re-verified `git log`/`git status` showed zero 38-18 commits and the working tree exactly matched the pre-interruption edit set (confirmed via `git diff --stat` matching the pre-interruption record), re-ran the full client test suite (751/751 passing, unchanged) and `typecheck` (2 pre-existing baseline errors, unchanged) before proceeding to commit — no files needed correction.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Client-side D-GAP-03 implementation is structurally identical to 38-17's server-side interpretation (same lock predicate: activated AND not placed this stage), so the two halves should agree once merged — no independent verification of the merge was possible from this isolated worktree since 38-17 runs in a parallel worktree not yet merged.
- `packages/shared`, `packages/server`, and every file outside this plan's `files_modified` list are untouched — confirmed via `git status --short` showing only the 8 expected files.
- `PieceOverlay.tsx`, `HexCell.tsx`, and `docs/HIGHLIGHT-REFERENCE.md` are byte-for-byte unchanged (D-09 verified: `git diff --stat` on all three is empty).
- Full client suite: 751/751 passing (749 pre-plan baseline + 2 net-new tests, 0 removed). `pnpm --filter @counter-attack/client typecheck` reports the same 2 pre-existing errors documented in `deferred-items.md` (unrelated `ActionLog.tsx`/`GameBoard.tsx` `PHASE_LABEL` gaps, explicitly deferred to a later plan) — no regression.
- D-GAP-03 still requires an explicit human ruling at the 38-24 checkpoint per 38-17's plan text; this plan's client-side implementation assumes that ruling will confirm the interpretation both plans already share.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_

## Self-Check: PASSED

- FOUND: packages/client/src/store/useGameStore.ts
- FOUND: packages/client/src/components/HexGrid.tsx
- FOUND: packages/client/src/components/CornerKickSetupPanel.tsx
- FOUND: packages/client/src/utils/restartErrorMessage.ts
- FOUND: .planning/phases/38-corner-kick/38-UI-SPEC.md
- FOUND: packages/client/src/store/useGameStore.test.ts
- FOUND: packages/client/src/components/HexGrid.test.tsx
- FOUND: packages/client/src/components/CornerKickSetupPanel.test.tsx
- FOUND: a01da35 (Task 1 commit)
- FOUND: 7336266 (Task 2 commit)
- FOUND: c211a5d (Task 3 commit)
