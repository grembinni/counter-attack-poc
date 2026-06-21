---
phase: 18-design-polish
plan: 02
subsystem: ui
tags: [react, action-log, logging, vitest, requirements-doc]

# Dependency graph
requires:
  - phase: 17.1-action-flow-cleanup
    provides: firstTimePassCarrierId/highPassCarrierId patterns and GamePhase/stat-mapping context referenced in D-12
provides:
  - Shared fmtStatRoll formatter producing the spelled-out "{Stat Name} {statValue} + {roll} - {penalty} = {combined}" format for SHOT_ATTEMPT, TACKLE_ATTEMPT, STEAL_ATTEMPT, HEADER
  - Name-resolved per-player move-group log lines ("{firstName} {lastName} | path")
  - Corrected MATCH-06 requirement text in REQUIREMENTS.md
affects: [18.4-ux-enhancements, future-design-polish-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fmtStatRoll(statName, statValue, roll, penalty, combined) module-level helper — single source of truth for stat+roll+penalty duel logging, always shows '- {penalty}' including '- 0'"
    - 'pieceName(pieceId, fallback) module-level helper resolving display names from gameState.pieces with a safe fallback to the terse pieceLabel'

key-files:
  created:
    - packages/client/src/components/ActionLog.test.tsx
  modified:
    - packages/client/src/components/ActionLog.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "fmtStatRoll always renders Math.abs(penalty) after a literal '- ' — callers pass the raw computed penalty (which may be 0, negative, or positive) and the formatter normalizes the sign so the term is always '- N', never '+ N' or omitted"
  - "MoveGroup gained a pieceId field populated in all three move_group-producing branches (MOVE, GK_KICK_MOVE, HP_MOVE); FTP_MOVE has no move_group branch today (it renders as an individual event), so D-01's 'if present' fourth branch did not apply"
  - 'pieceName takes an explicit fallback parameter (the existing pieceLabel) rather than re-deriving it internally, keeping the not-found path a pure pass-through with no duplicate logic'

requirements-completed: [DESIGN-01, MATCH-06]

# Metrics
duration: 22min
completed: 2026-06-21
---

# Phase 18 Plan 02: ActionLog Logging Consistency + MATCH-06 Doc Fix Summary

**Unified dice-roll log format via a shared fmtStatRoll helper (spelled-out stat name, always-shown penalty term) across all four duel event types, plus full-name per-player move logging and a corrected MATCH-06 requirement line.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-06-21T11:10:00Z
- **Completed:** 2026-06-21T11:32:18Z
- **Tasks:** 3 completed
- **Files modified:** 3 (2 code/test, 1 doc)

## Accomplishments

- Replaced the old compact `(die+stat=score)` parenthetical shorthand (and the separate `fmtHeading`/local `fmtScore` helpers) with one shared module-level `fmtStatRoll` formatter producing `"{Stat Name} {statValue} + {roll} - {penalty} = {combined}"`, always including the `- {penalty}` term — even `- 0` — across SHOT_ATTEMPT, TACKLE_ATTEMPT, STEAL_ATTEMPT, and HEADER (D-12). DICE_ROLL remains exempt with an explicit comment.
- Added a `pieceName` helper that resolves a piece's `{firstName} {lastName}` from `gameState.pieces` by id, with a safe fallback to the existing terse label when the id isn't found; wired it into the `move_group` render branch so per-player move-log lines now read like `Nicolae Rusu | 14,13 → 15,13 → 16,13` instead of `A10 14,13 → 15,13 → 16,13` (D-01).
- Rewrote the MATCH-06 requirement line in `REQUIREMENTS.md` to the perspective-neutral wording already drafted in `PROJECT.md` (D-10) — doc-only, no code change.
- Added `ActionLog.test.tsx` (new file) with 7 tests covering all four D-12 stat-mapping cases (including a zero-penalty regression guard) and both D-01 name-resolution paths (found and not-found/fallback).

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: fmtStatRoll formatter + per-player move-log names** - `27f74dc` (feat) — both tasks landed in one commit because they touch the same two files (`ActionLog.tsx`, `ActionLog.test.tsx`) with non-overlapping, interleaved edits; splitting would have required re-running tests against a partially-edited intermediate file with no independent value.
2. **Task 3: MATCH-06 requirement text rewrite** - `49894f0` (docs)

**Plan metadata:** SUMMARY commit (this commit, see below)

## Files Created/Modified

- `packages/client/src/components/ActionLog.tsx` - Replaced `fmtHeading`/local `fmtScore` with shared `fmtStatRoll`; rewired SHOT_ATTEMPT/TACKLE_ATTEMPT/STEAL_ATTEMPT/HEADER cases to call it with the D-12 stat-name mapping; added `pieceName` helper; added `pieceId` to `MoveGroup` and populated it in all three move_group branches; updated the move_group render branch to show `{firstName} {lastName} | {path}`.
- `packages/client/src/components/ActionLog.test.tsx` - New file. 7 tests: TACKLE_ATTEMPT Tackling/Dribbling + `- 0` both sides, SHOT_ATTEMPT non-zero penalty renders `Shooting`/`Saving` + `- {abs(penalty)}`, SHOT_ATTEMPT zero-penalty regression guard, STEAL_ATTEMPT Tackling + `- 0`, contested HEADER Aerial Ability both sides, MOVE move-group name+path rendering, unknown-pieceId fallback (no throw).
- `.planning/REQUIREMENTS.md` - MATCH-06 line rewritten to perspective-neutral symmetric-columns wording; no other line touched.

## Decisions Made

- Combined Task 1 and Task 2 into a single commit (both touch the same two files with non-overlapping regions; see Task Commits note above) rather than forcing an artificial mid-file split.
- `fmtStatRoll` takes the raw signed penalty and normalizes via `Math.abs()` internally so every call site (including TACKLE_ATTEMPT/STEAL_ATTEMPT, which always pass a literal `0`) can pass through whatever sign convention the source data uses without each caller needing to pre-normalize.
- Confirmed via `gameEngine.ts` (lines ~565, ~601-602) that the D-12 stat mapping matches the actual server-side computation: STEAL_ATTEMPT/TACKLE_ATTEMPT defender side uses `piece.tackling`, TACKLE_ATTEMPT carrier side uses `carrier.dribbling` — no drift between display layer and engine.
- FTP_MOVE has no move_group consolidation branch in the current codebase (it's still an individual per-event case in `formatEvent`), so the plan's "FTP path if present" fourth branch for the `pieceId` field did not apply — only MOVE, GK_KICK_MOVE, and HP_MOVE needed the new field.

## Deviations from Plan

None - plan executed exactly as written. The two infrastructure steps below were required to get the worktree into a runnable state and are not deviations from the plan's scope:

- Ran `pnpm install` (no lockfile changes) because the worktree had no `node_modules`.
- Ran `npx tsc -b` in `packages/shared` to build its type declarations, because `@counter-attack/shared` was not yet built in this fresh worktree and the client package imports its types directly.

## Issues Encountered

- Initial test assertions used `screen.getAllByText(/- 0/)` expecting one match per occurrence, but React Testing Library queries match against the nearest queryable element, and both duel sides' formatted strings are sibling text nodes under the same parent `<span>` — so `getAllByText` returned 1 combined-container match instead of 2. Fixed by asserting against `container.textContent` with a regex `match(...).length` count instead of relying on `getAllByText` to enumerate sibling text nodes separately. No production code was affected; this was purely a test-assertion correction.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `fmtStatRoll` is now the single source of truth for stat+roll+penalty duel logging; any future event type needing the same shape can reuse it directly.
- `pieceName` and the `MoveGroup.pieceId` field are available for any other consumer needing name-resolved piece display in the action log.
- MATCH-06 requirement text now matches already-shipped behavior; the Traceability table entry (Phase 18 / Pending) is intentionally untouched per D-10's scope (text correction only, not a completion marker) and remains for the orchestrator to update during phase close.
- DESIGN-01 and MATCH-06 requirement IDs are listed in this plan's frontmatter `requirements-completed` for orchestrator bookkeeping; DESIGN-01 also spans plans 18-01 and 18-03, so its full closure depends on those plans too.

---

_Phase: 18-design-polish_
_Completed: 2026-06-21_

## Self-Check: PASSED

- FOUND: packages/client/src/components/ActionLog.tsx
- FOUND: packages/client/src/components/ActionLog.test.tsx
- FOUND: .planning/REQUIREMENTS.md
- FOUND: .planning/phases/18-design-polish/18-02-SUMMARY.md
- FOUND commit: 27f74dc (feat: fmtStatRoll + per-player move-log names)
- FOUND commit: 49894f0 (docs: MATCH-06 requirement text rewrite)
- FOUND commit: 04401dd (docs: this summary)
