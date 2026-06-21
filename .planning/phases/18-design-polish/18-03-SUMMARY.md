---
phase: 18-design-polish
plan: 03
subsystem: ui
tags: [react, vitest, action-panel, messaging-consistency]

# Dependency graph
requires:
  - phase: 18-design-polish (18-01/18-02)
    provides: PHASE_LABEL/scoreboard and ActionLog dice-roll log format conventions (D-01..D-12)
provides:
  - ActionPanel.tsx with every D-13-locked helper-text string applied
  - Unified non-active-player wait state across all phases
  - GK_RESTART "Punt (High Pass)" button rename (display-text-only)
  - MOVE phase two-line restructure scoping the hex-cap note to ATTACKER_2 only
affects: [18.4-ux-enhancements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Two-line helperBlock (helperLine1 headline + helperLine2 detail) as the canonical ActionPanel phase-prompt shape — single-line phaseLabel/gkLabel spans converted to this shape where D-13 calls for a detail line'

key-files:
  created: []
  modified:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - "Wait-state unification: waitingPanel const now renders Opponent's Turn / Waiting for opponent... and is reused directly by the HEADER 5b branch (previously diverging custom JSX); the HEADER bothConfirmed-false myConfirmed-true branch can't reuse the waitingPanel JSX element directly (shares a parent div with sibling conditional branches) so it duplicates the same two-line markup inline"
  - "Kick->Punt rename is button text only — emitGKRestart('kick') call and the 'kick' string value passed to the handler are unchanged, consistent with D-13(c)'s explicit display-text-only scoping"
  - "MOVE phase slotHelperLine1 (the old dynamic 'Move up to N players' headline) is replaced by a static 'Move!' headline; the player-count + ATTACKER_2 hex-cap text moves entirely into helperLine2"

requirements-completed: [DESIGN-01]

# Metrics
duration: 7min
completed: 2026-06-21
---

# Phase 18 Plan 03: ActionPanel D-13 Text Corrections Summary

**Unified all ActionPanel.tsx wait-state and active-player phase-prompt text to the D-13 locked table, including the HIGH_PASS_MOVE "Header!"/Arial typo fix and the GK_RESTART Kick->Punt button rename.**

## Performance

- **Duration:** ~7 min (task-commit-to-task-commit; environment setup — pnpm install + shared package build — added ~2 min before Task 1)
- **Started:** 2026-06-21T06:19:00-05:00 (approx, session start)
- **Completed:** 2026-06-21T06:32:04-05:00
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments

- Every non-active-player wait state (the shared `waitingPanel` plus the two HEADER-phase special cases) now renders identical "Opponent's Turn" / "Waiting for opponent..." text — no diverging wait-state markup remains anywhere in the file.
- All 14 active-player phase-prompt states rewritten to the D-13 locked target text exactly, including the HIGH_PASS_MOVE "Header!" → "High Pass Aerial Challenge!" fix (resolves the misleading label and the Arial/Aerial typo) and several single-line `phaseLabel`/`gkLabel` spans converted to the two-line `helperBlock` shape (SNAPSHOT_DEFLECT, SNAPSHOT_TARGET, GK_QUICK_THROW, GK_KICK_MOVE).
- GK_RESTART's "Kick (High Pass)" button renamed to "Punt (High Pass)" — display-text-only; the `emitGKRestart('kick')` handler and underlying `'kick'` restart-type value are unchanged.
- MOVE phase restructured to a static "Move!" headline (line 1) with the player-count/hex-cap detail on line 2; the "(2 hex max)" note is now correctly scoped to the `ATTACKER_2` slot only — `ATTACKER_4`/`DEFENDER_5` show no hex-cap text, matching `moveValidator.ts:87-89`'s confirmation that only `ATTACKER_2` enforces an artificial cap.
- State 12d (pass-target-hex-clicked, auto-rolling) left completely untouched — still `return null`, no new text added, per the explicit D-13 confirmation.
- Extended `ActionPanel.test.tsx` with 5 new assertions (unified wait state, HIGH_PASS_MOVE fix, Punt rename, ATTACKER_2 hex-cap, ATTACKER_4 no-hex-cap) and updated 5 pre-existing assertions that referenced now-superseded text.

## Task Commits

Each task was committed atomically:

1. **Task 1: Unify all non-active-player wait states to one shared two-line text** - `1e56bba` (feat)
2. **Task 2: Rewrite all active-player phase-prompt text per the D-13 locked table, including the Kick->Punt rename** - `1114271` (feat)

_Note: lint-staged (eslint --fix + prettier --write) ran automatically on both commits and reformatted line-wrapping in both modified files — no behavioral changes from formatting._

## Files Created/Modified

- `packages/client/src/components/ActionPanel.tsx` - Unified wait-state JSX; rewrote every active-player phase-prompt helper-text string per D-13; renamed GK_RESTART's first button to "Punt (High Pass)"; restructured the MOVE phase's two-line layout
- `packages/client/src/components/ActionPanel.test.tsx` - Updated 5 existing assertions to match new text; added a new `describe('ActionPanel — D-13 text corrections')` block with 5 new test cases

## Decisions Made

- The HEADER phase's `bothConfirmed === false && myConfirmed === true` branch could not simply `return waitingPanel` because it shares a parent `<div className={styles.panel}>` with the sibling `!myConfirmed` branch and the `gameError` display — it duplicates the same two-line "Opponent's Turn" / "Waiting for opponent..." markup inline instead, per the plan's explicit instruction.
- No changes were made to action-availability logic, `onClick` handlers, or conditional gating anywhere in the file — only literal text content and the one button-label rename, as scoped.

## Deviations from Plan

None - plan executed exactly as written. (Environment setup — running `pnpm install` and building `packages/shared` via `npx tsc` — was required because this worktree had no `node_modules`/build output; this is standard environment bootstrapping, not a plan deviation, and no files outside the plan's stated scope were modified.)

## Issues Encountered

- The worktree had no installed dependencies and `packages/shared` had no compiled output, causing the client's `tsc --noEmit` to fail with `Cannot find module '@counter-attack/shared'` and `vite/client` type-definition errors. Resolved by running `pnpm install --frozen-lockfile` (reused all 429 packages from the local store, no downloads) and `npx tsc` inside `packages/shared` to produce `dist/`. After this, `npx tsc --noEmit -p tsconfig.json` ran clean in `packages/client` for both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DESIGN-01's ActionPanel.tsx portion (D-13) is fully satisfied: all 14 active-player phase prompts read the locked target text, all non-active-player wait states are unified, the GK_RESTART button reads "Punt (High Pass)" consistently with GK_KICK_TARGET's "Punt!", the MOVE phase correctly scopes its hex-cap note, and state 12d's auto-roll transition is unchanged.
- 25 ActionPanel tests pass; full client suite (187 tests across 11 files) passes; typecheck clean on `packages/client` and `packages/shared`.
- No blockers for downstream phases. This plan's scope (ActionPanel.tsx text only) does not overlap with 18-01/18-02 (`GameBoard.tsx`/`ActionLog.tsx`), so no merge-conflict risk within Phase 18's wave.

---

## Self-Check: PASSED

- FOUND: packages/client/src/components/ActionPanel.tsx
- FOUND: packages/client/src/components/ActionPanel.test.tsx
- FOUND commit 1e56bba (Task 1)
- FOUND commit 1114271 (Task 2)

---

_Phase: 18-design-polish_
_Completed: 2026-06-21_
