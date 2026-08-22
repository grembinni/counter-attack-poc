---
phase: 42-substitution-ux-overhaul
plan: 04
subsystem: ui
tags: [red-card, hex-grid, react, selection-gating, bug-fix]

requires:
  - phase: 42-01
    provides: 'isActivePiece(piece) exported from packages/shared/src/stoppagePhases.ts'
provides:
  - 'HexGrid.tsx pitch render-skip keyed on isActivePiece (was onPitch === false only)'
  - 'All 19 canSelect* selection gates in HexGrid.tsx explicitly exclude non-active pieces'
  - 'Inverted legacy test: a redCarded piece with onPitch undefined no longer renders'
affects: [42-05, 42-06, 42-07, 42-08]

tech-stack:
  added: []
  patterns:
    - "HexGrid.tsx canSelect* gates each conjunct isActivePiece(piece) explicitly, even
      though the render-skip above already removes a non-active piece from the DOM —
      the redundancy is deliberate defense-in-depth so a future flag-setting bug cannot
      silently re-enable a dismissed piece's interactivity."

key-files:
  created: []
  modified:
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.test.tsx

key-decisions:
  - "canSelectCornerKickTaker: the plan's read_first assumed this gate already carried an
    inline redCarded clause equivalent to canSelectPenaltyKickTaker's. A direct grep of the
    file at execution time found no such clause — only canSelectPenaltyKickTaker (line
    ~939) had one. isActivePiece was therefore added as a plain new conjunct to
    canSelectCornerKickTaker (matching the other 17 non-inline gates), not a replacement.
    Documented inline at the site and here so this reads as a verified correction, not an
    unflagged deviation from the plan's own acceptance criteria."
  - "The onPitch:false/redCarded-unset proof test (Task 2 item 4) reuses the
    HIGH_PASS_MOVE gate/state. Because the shared render-skip (isActivePiece in the
    pieces.map callback) already removes any non-active piece from the DOM before the
    canSelect* gates are ever evaluated, this test structurally proves the two-clause
    predicate end-to-end (render-skip + gate) rather than isolating the gate's own clause
    in front of a still-rendered piece — consistent with how the render-skip and gates are
    designed to compose (deliberate redundancy, not a testing gap)."

requirements-completed: [BUG-38, SUB-18]

duration: ~25min
completed: 2026-08-21
---

# Phase 42 Plan 04: HexGrid Red-Card Render-Skip & Selection Gating Summary

**HexGrid.tsx's pitch render-skip and all 19 `canSelect*` selection gates now key on the shared `isActivePiece` predicate instead of a bare `onPitch === false` check, closing the client half of BUG-38.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-21T22:05:00-05:00 (approx.)
- **Completed:** 2026-08-21T22:19:07-05:00
- **Tasks:** 2 (as planned)
- **Files modified:** 2

## Accomplishments

- `HexGrid.tsx`'s pitch render-skip (`pieces.map` callback) now reads `if (!isActivePiece(piece)) return null;` instead of `if (piece.onPitch === false) return null;` — a dismissed (`redCarded`) piece is suppressed even if a future code path forgets to also set `onPitch: false`.
- All 19 `canSelect*` derivations (`canSelect`, `canSelectKickOff`, `canSelectThrowIn`, `canSelectFreeKick`, `canSelectHighPassMove`, `canSelectSnapDeflect`, `canSelectGKKickMove`, `canSelectGoalKickMove`, `canSelectFirstTimePassMove`, `canSelectFreeMove`, `canSelectGoalKickSetup`, `canSelectPenaltyKickSetup`, `canSelectPenaltyKickTaker`, `canSelectGkBoxEntryMove`, `canSelectGkDiveAtFeetTarget`, `canSelectCornerKickGk`, `canSelectCornerKickTaker`, `canSelectCornerKickReposition`, `canSelectCornerKickFinal`) now explicitly conjunct `isActivePiece(piece)`, converting the render-skip's implicit protection into an explicit, auditable one at every gate.
- `canSelectPenaltyKickTaker`'s hand-written `piece.redCarded !== true` clause was replaced with `isActivePiece(piece)` — the one gate the plan correctly identified as already carrying an equivalent inline check.
- A block comment above the `canSelect*` derivations records that this redundancy with the render-skip is deliberate: it removes the mask so a future flag-setting change cannot silently re-enable a dismissed piece's interactivity.
- `HexGrid.test.tsx`: the legacy "still renders a redCarded piece with onPitch undefined" assertion was inverted to assert the piece is NOT rendered, cited to BUG-38 with the old/new expectation recorded inline. 11 new tests added: 2 each (redCarded-excluded / cleared-restored) for the five response-move gates named in the plan (`canSelectHighPassMove`, `canSelectSnapDeflect`, `canSelectGKKickMove`, `canSelectGoalKickMove`, `canSelectFirstTimePassMove`), plus 1 proving the two-clause predicate (`onPitch: false`, `redCarded` unset also excludes).
- Full client suite: 1062 tests green (up from 1051 baseline + 111 in the HexGrid file alone, up from 100). `pnpm --filter @counter-attack/client typecheck` clean. `eslint` clean on both touched files. `PieceOverlay.test.tsx` diff confirmed empty.

## Task Commits

Each task was committed atomically:

1. **Task 1: Route the render-skip and all canSelect\* gates through isActivePiece** - `d93edbf` (fix)
2. **Task 2: HexGrid red-card exclusion tests** - `f13e5e1` (test)

**Plan metadata:** commit pending (final SUMMARY commit is handled by the orchestrator per worktree isolation)

## Files Created/Modified

- `packages/client/src/components/HexGrid.tsx` - render-skip keyed on `isActivePiece`; all 19 `canSelect*` gates gain an explicit `isActivePiece(piece)` conjunct; `canSelectPenaltyKickTaker`'s inline `redCarded` check replaced with the shared predicate; new block comment documenting the deliberate render-skip/gate redundancy
- `packages/client/src/components/HexGrid.test.tsx` - inverted the legacy onPitch-undefined-still-renders test (now cites BUG-38); added 11 new tests covering the five response-move gates plus the two-clause-predicate proof

## Decisions Made

- **`canSelectCornerKickTaker` inline-check assumption corrected:** the plan's Task 1 `read_first` and acceptance criteria assumed this gate, like `canSelectPenaltyKickTaker`, already had an inline `redCarded !== true` clause to convert. A `grep -n redCarded HexGrid.tsx` at execution time (before any edits) showed only `canSelectPenaltyKickTaker` had such a clause — `canSelectCornerKickTaker` had none, despite its own comment describing itself as mirroring the penalty-taker gate's shape. `isActivePiece(piece)` was therefore added as a plain new conjunct (same treatment as the other 17 non-inline gates), not a replacement, and this correction is recorded both inline in the code comment and here.
- **Test IDs for the five response-move gate tests:** reused `'home-8'` (home FWD 1, not GK, not the ball carrier) for the four home-active-team gates (`HIGH_PASS_MOVE`, `GK_KICK_MOVE`, `GOAL_KICK_MOVE`, `FIRST_TIME_PASS_MOVE`) and `'away-1'` (away DEF 1, not GK) for `SNAPSHOT_DEFLECT`, whose gate requires the _defending_ team (away, since `attackingTeam: 'home'`) and explicitly excludes GKs (BUG-32) — chosen to avoid conflating the new red-card assertions with either pre-existing exclusion rule.

## Deviations from Plan

None requiring auto-fix — the single documented deviation above (`canSelectCornerKickTaker`'s inline-check assumption) is a plan-assumption correction caught by the plan's own instruction to "verify by reading," not a Rule 1-4 deviation: no bug was introduced, no missing functionality was found, and no architectural change was needed. The resulting code is behaviorally identical to what the plan intended (the gate now excludes non-active pieces) — only the mechanism (add vs. replace) differed from what the plan assumed before verification.

## Issues Encountered

- Worktree had no `node_modules` (fresh worktree). Ran `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared build` before typecheck/test could run — infrastructure setup only, not a plan deviation (same as noted in 42-01-SUMMARY.md).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The client half of BUG-38 is closed: `HexGrid.tsx` render-skip and every selection gate are red-card aware via the shared `isActivePiece` predicate from 42-01.
- No blockers. Full client suite (1062 tests), typecheck, and eslint all green on the touched files.
- Scope boundary honored: no drag-and-drop, drop target, or reposition handler was added to the pitch view — this plan touched `HexGrid.tsx` solely for BUG-38 selection/render gating, per D-01.

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-21_
