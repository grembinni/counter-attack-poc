---
phase: 46-final-cleanup
plan: 02
subsystem: ui
tags: [zustand, react, client-state, typescript]

# Dependency graph
requires:
  - phase: 43-tackle-steal-prompt-decline
    provides: TACKLE_STEAL_PROMPT interrupt phase and the original bug report (43-06 live verification)
provides:
  - Interrupt-resume auto-reselect for TACKLE_STEAL_PROMPT / GK_DIVE_AT_FEET_PROMPT / GK_BOX_ENTRY_PROMPT / FOUL_CHOICE
  - RESPONSE_MOVE_CONFIG_BY_PHASE single-source-of-truth phase->config table
affects: [useGameStore.ts consumers, any future response-move phase additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase-keyed Partial<Record<GamePhase, Config>> table replacing parallel-tree duplicated dispatch (RESPONSE_MOVE_CONFIG_BY_PHASE)"
    - "Pace-based mid-move piece derivation for interrupt-resume (no piece id carried in resume snapshots)"

key-files:
  created: []
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts

key-decisions:
  - "Interrupt-resume selection is gated to the owning client via deriveMyTeam(prev.playerSlot) matching the mid-move piece's team — a null playerSlot or team mismatch falls through to the ordinary clearing behaviour (T-46-02-I mitigation)"
  - "Added an explicit `if (prevSelectedId === null) return;` narrowing guard after the interrupt-resume branch — required to restore TypeScript's control-flow narrowing that the negated guard on the clearing `if` broke"
  - "RESPONSE_MOVE_CONFIG_BY_PHASE and RESPONSE_MOVE_STICKY_PHASES exported for test reachability (knip-clean)"

patterns-established:
  - "Single phase-keyed config table consumed by both the click-handler tree (selectPiece) and the broadcast sticky-selection tree (setGameState) — the fix for BUG-09's two-tree-drift root cause, now generalized as the pattern for any future phase-to-config dispatch"

requirements-completed: [CLEANUP-05, CLEANUP-09, CLEANUP-13]

# Metrics
duration: ~40min
completed: 2026-08-29
---

# Phase 46 Plan 02: Interrupt-Resume Auto-Reselect + Response-Move Config Consolidation Summary

**Mid-move piece survives an interrupt-prompt round-trip with its movement ring intact, and the six response-move configs now live in one phase-keyed table instead of a duplicated six-const/five-level-ternary pair.**

## Performance

- **Duration:** ~40 min (session was interrupted by an API/quota error mid-Task-2 typecheck-fix and resumed; both tasks were already implemented and verified when resumed, remaining work was committing atomically and re-verifying)
- **Completed:** 2026-08-29
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Resuming from any of the four interrupt/prompt phases (`TACKLE_STEAL_PROMPT`, `GK_DIVE_AT_FEET_PROMPT`, `GK_BOX_ENTRY_PROMPT`, `FOUL_CHOICE`) back into `MOVE` now re-selects the mid-move piece and restores its valid-move highlight, closing the folded todo `2026-08-23-ux-no-auto-reselect-after-interrupt-prompt-resumes.md` (CLEANUP-05)
- Every non-interrupt phase transition still clears selection exactly as before (negative control test passes; the original clearing `if`'s five clauses are unchanged, only a negated guard was appended)
- Collapsed the six standalone `*_CONFIG` bindings and the five-level nested ternary dispatch into one `RESPONSE_MOVE_CONFIG_BY_PHASE` table, consumed identically by `selectPiece`'s per-phase branches and `setGameState`'s sticky-selection block — the exact two-tree-drift shape that caused BUG-09 (CLEANUP-09, CLEANUP-13)
- A mechanical coverage test now pins `RESPONSE_MOVE_CONFIG_BY_PHASE`'s shape (exactly 6 keys) and that every `RESPONSE_MOVE_STICKY_PHASES` member resolves to a defined config, guarding against future two-tree drift

## Task Commits

Each task was committed atomically:

1. **Task 1: Preserve the mid-move selection when an interrupt prompt resolves back to MOVE** - `54a60730` (feat)
2. **Task 2: Collapse the duplicated phase-to-response-move-config dispatch into one keyed table** - `1df461d5` (refactor)

_No TDD RED/GREEN split commits — tests and implementation were written together per task and verified before each commit; both tasks' full test suites (9 new interrupt-resume tests, 3 new table-shape tests) pass against the final committed state._

## Files Created/Modified

- `packages/client/src/store/useGameStore.ts` - Added `INTERRUPT_RESUME_PHASES`, `resumingFromInterrupt`/`midMovePieceId` derivation, a new non-clearing branch in `setGameState` that reuses `computeMovementValidHexes`, and a TypeScript narrowing guard; replaced the six `*_CONFIG` consts + nested ternary with `RESPONSE_MOVE_CONFIG_BY_PHASE`/`RESPONSE_MOVE_STICKY_PHASES`, updating all 8 call sites
- `packages/client/src/store/useGameStore.test.ts` - 9 new tests covering all 4 interrupt phases, no-piece-mid-move, activation-already-finished, the non-interrupt negative control, opponent-piece exclusion, wrong-client exclusion, and null-playerSlot fallthrough; 3 new tests pinning `RESPONSE_MOVE_CONFIG_BY_PHASE`/`RESPONSE_MOVE_STICKY_PHASES` shape

## Decisions Made

- **Interrupt-resume gated to the owning client only (T-46-02-I):** the resumed selection is only applied when `deriveMyTeam(prev.playerSlot)` matches the mid-move piece's team; a `null` playerSlot (spectator/unassigned) or a team mismatch falls through to the ordinary clearing payload instead. This prevents leaking one player's valid-move highlight onto the opponent's board — the exact bug class T-37-80 previously fixed.
- **TypeScript narrowing restored with an explicit guard:** appending `&& !(resumingFromInterrupt && midMovePieceId !== null)` to the original clearing `if` (as the plan required, to keep its five original clauses verbatim) broke TypeScript's ability to prove `prevSelectedId !== null` further down in the sticky-selection code (it previously narrowed automatically since `prevSelectedId === null` was one of the plain OR'd clauses). Added `if (prevSelectedId === null) return;` immediately after the new interrupt-resume branch — logically unreachable (proven by the control-flow analysis) but required to satisfy `tsc --noEmit`.
- **Both new constants exported:** `RESPONSE_MOVE_CONFIG_BY_PHASE` and `RESPONSE_MOVE_STICKY_PHASES` were exported from the module so the mechanical shape-coverage test could reach them; `pnpm knip` confirms both exports are consumed with zero findings.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria were independently re-verified against the final committed source (not just re-read from a prior claim):

- `INTERRUPT_RESUME_PHASES` contains exactly the 4 required phase strings
- `grep -c computeMovementValidHexes` increased by exactly 1 relative to the pre-plan baseline (7 → 8), proving the existing helper was reused, not reimplemented
- `isActivePiece(p)` is used inside the new interrupt-resume derivation block
- The original clearing `if`'s six clauses are present verbatim in the diff (only a guard was appended, confirmed via `git diff`)
- `RESPONSE_MOVE_CONFIG_BY_PHASE` has exactly 6 keys; `RESPONSE_MOVE_STICKY_PHASES` has exactly 5 members and excludes `SNAPSHOT_DEFLECT`
- Zero standalone `*_CONFIG` bindings remain (`grep -c` returns 0); `CORNER_KICK_FINAL_SETUP_CONFIG` string no longer appears anywhere in the file

## Issues Encountered

- **Session interruption:** the executor session was terminated by an API/quota error partway through Task 2's typecheck-fix pass. Resumed cleanly — `git status`/`git diff` confirmed both tasks' work was already fully implemented (uncommitted) in the working tree; re-ran the full verification suite (tests, typecheck, knip) against that work before proceeding to atomic commits, and it was correct and complete on first re-check.
- **Missing `node_modules` in worktree:** the isolated worktree had no `node_modules` installed. Ran `pnpm install` (pulls from the existing content-addressable `.pnpm-store`, does not touch the main repo's `node_modules`) rather than a manual directory-junction workaround, per the project's documented Windows-worktree junction-risk guidance. Also had to `pnpm --filter @counter-attack/shared build` once to produce `dist/` before the client package's Vite-based vitest run could resolve `@counter-attack/shared`.
- **Retroactive atomic-commit split:** both tasks had been implemented together in the working tree before the interruption (no per-task commit had landed yet). Reconstructed clean per-task commits after the fact by hand-splitting the unified diff into two non-overlapping hunk groups (verified independently separable — Task 1 touches only the `setGameState` clearing/interrupt-resume region + the `INTERRUPT_RESUME_PHASES` const + the `GamePhase` import; Task 2 touches only the config-table region + its 8 call sites + the sticky-block ternary), applying Task 1's hunks via `git apply --cached`, committing, then confirming the remaining working-tree diff was exactly Task 2's content before staging and committing it. Full verification suite (tests/typecheck/knip) re-run against the final two-commit state and passed.
- **TypeScript control-flow narrowing regression from the negated guard:** documented above under Decisions Made — required an extra explicit null-check to keep `tsc --noEmit` clean without altering the original clearing `if`'s five clauses.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useGameStore.ts`'s `setGameState`/`selectPiece` selection logic is now internally consistent for both bug classes this plan targeted (BUG-09-shaped drift and the interrupt-resume UX gap) — no known follow-on work required from this plan.
- Full monorepo client suite (1225 tests across 40 files) passes with no regressions; `pnpm -w typecheck` and `pnpm knip` are both clean.
- This was Wave 1 of Phase 46 (`depends_on: []`) — no blockers for any sibling wave-1 plan.

---
*Phase: 46-final-cleanup*
*Completed: 2026-08-29*
