---
phase: 42-substitution-ux-overhaul
plan: 08
subsystem: ui
tags: [react, drag-and-drop, confirmation-dialog, substitution-ux]

requires:
  - phase: 42-substitution-ux-overhaul (plan 07)
    provides: 'MidmatchSubMode/MidmatchDragState, two structurally separate drop handlers (handleMidmatchRepositionDrop/handleMidmatchSubstituteDrop), the SENT OFF vacated-slot placeholder, and the Substitute/Cancel mode-toggle button this plan builds a staging layer on top of'
provides:
  - 'PendingSubstitution local type and pendingSub state — a single staged substitution awaiting confirm/cancel'
  - 'handleMidmatchSubstituteDrop rewritten to STAGE (not apply) a substitution — onSubstitute has exactly one remaining call site (the popup Confirm button)'
  - 'Confirmation popup (.subConfirmOverlay/.subConfirmCard/.subConfirmText/.subConfirmActions/.subConfirmButtonReady) naming both players, mirroring ActionPanel.confirmDialog'
  - 'SUB-13 one-at-a-time cap: a second stage attempt while pending is a silent no-op, and both on-pitch and bench drag sources go inert while staged (pendingSub === null gate added to midmatchDraggable and BenchCarousel disabled/onCardDragStart)'
  - 'SUB-15 asymmetric outcomes: Confirm applies the substitution and returns to positioning mode; Cancel (popup or mode-level) clears the staged selection and stays in substitution mode'
affects: [42-09]

tech-stack:
  added: []
  patterns:
    - 'Stage-then-confirm via a locally-captured const (`stagedSub`) read before
      `setPendingSub(null)` — mirrors ActionPanel.tsx withEndTurnConfirm/
      confirmDialog exactly, so the confirm handler never reads a nulled value.'
    - 'Display values (outName/outNumber) are captured into PendingSubstitution
      at STAGE time, not re-derived at confirm time — the popup renders
      correctly even if a later server broadcast changes pieces/bench before
      the popup resolves (see T-42-34 in the threat model).'

key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.module.css
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "Tasks 1 and 2 were committed together in a single commit rather than two
    atomic commits. Splitting them left the `onSubstitute` prop temporarily
    unused between commits (Task 1 alone stages but never calls it; Task 2
    adds the only remaining call site), which fails the repo's
    `eslint --fix`-based pre-commit gate (`no-unused-vars`). Combining them
    was the only way to keep every commit lint-clean, per Rule 3 (auto-fix a
    blocking issue) — documented as a deviation below."
  - "outName/outNumber are passed into handleMidmatchSubstituteDrop as extra
    parameters from the two call sites (both already have the piece object in
    scope inside renderMidmatchColumn), rather than having the handler
    re-look-up the target piece by id — the handler itself has no access to
    the pieces array (defined outside the mode==='midmatch' render branch)."
  - "z-index 22 property is placed as the second declaration (right after
    position) in .subConfirmOverlay, not last as ActionPanel.module.css's
    .confirmOverlay does — purely a declaration-order choice satisfying this
    plan's own self-verification script; behavior and cascade are identical
    either way since z-index does not depend on property order within a rule."

requirements-completed: [SUB-13, SUB-14, SUB-15]

duration: ~50min
completed: 2026-08-22
---

# Phase 42 Plan 08: Substitution Confirmation Popup Summary

**Bench-to-pitch drops in substitution mode now stage a `pendingSub` and require an explicit "Confirm Substitution" click (naming both players) before `onSubstitute` fires — its only remaining call site — with a silent one-at-a-time cap and Cancel returning to a clean, unresolved substitution mode.**

## Performance

- **Duration:** ~50 min (includes ~7 min fresh-worktree `pnpm install --frozen-lockfile` + `packages/shared` build, not attributable to plan work)
- **Tasks:** 3 (as planned)
- **Files modified:** 3 (all three declared in the plan's `files_modified`)

## Accomplishments

- **Task 1 — Stage instead of fire:** Added `PendingSubstitution` (module scope, beside `MidmatchSubMode`) and `pendingSub` state. Rewrote `handleMidmatchSubstituteDrop` to stage a swap: it keeps every pre-existing guard (`!inPlayerId || isBlocked || readOnly === true`) in its original order, adds a new `pendingSub !== null` no-op guard (SUB-13), resolves the incoming player's display name via `PLAYER_MAP` (silently dropping rather than staging a blank-name popup if the lookup fails), and calls `setPendingSub(...)` instead of `onSubstitute(...)`. Both mode-toggle button handlers (enter substitution mode / mode-level Cancel) now also clear `pendingSub`, so a stale staged selection can never leak across a mode transition. The container-level `onDragEnd` cleanup from 42-07 was deliberately left untouched — a staged substitution survives the end of the drag gesture that created it, since the popup (not the drag) is what resolves it.
- **Task 2 — Confirmation popup + guards:** Rendered a `role="dialog"` popup (mounted in the mid-match branch whenever `pendingSub !== null`, before the rejection-message paragraph) with the exact copy `Substitute {outName} for {inName}?`, a Cancel button (`aria-label="Cancel substitution selection"`, clears `pendingSub` only) and a `Confirm Substitution` button (`aria-label="Confirm substitution"`, calls `onSubstitute?.(stagedSub.outPieceId, stagedSub.inPlayerId)` then clears `pendingSub` then returns to positioning mode via `setSubMode('reposition')`). `stagedSub` is captured as a local const before the JSX so the confirm handler can't read a nulled value. Added `.subConfirmOverlay`/`.subConfirmCard`/`.subConfirmText`/`.subConfirmActions`/`.subConfirmButtonReady` to the CSS module, copying `ActionPanel.module.css`'s `.confirmOverlay`/`.confirmCard`/`.confirmText`/`.confirmActions`/`.ctaButtonReady` declarations verbatim except for `z-index: 22` (not 20) — required because this popup renders inside `GameBoard.module.css`'s `.substitutionOverlay` (z-index 20) alongside `.substitutionModalClose` (z-index 21). Extended `midmatchDraggable`'s derivation and `BenchCarousel`'s `disabled`/`onCardDragStart` guard with `pendingSub === null`, so both on-pitch and bench drag sources go inert while a substitution is staged — making SUB-13's "exactly one staged swap" visible, not merely silently no-op.
- **Task 3 — Tests:** Added a `describe('Phase 42 — staged substitution with confirmation', ...)` block with the 9 scenarios named in the plan (popup render + exact text, SUB-13's second-drop no-op, both drag sources inert while staged, SUB-15 confirm, SUB-15 cancel, re-stage after cancel, mode-level Cancel while staged, SUB-18's SENT OFF exclusion, and `readOnly`) — 20 new assertions across 9 `it(...)` blocks. Updated the one pre-existing test that asserted `onSubstitute` fired directly on drop (`SUB-02: dragging an available bench card...`) to drive the confirm button first, keeping its original `toHaveBeenCalledTimes(1)`/`toHaveBeenCalledWith('home-1', 'p013')` assertions intact and adding an explicit `expect(onSubstitute).not.toHaveBeenCalled()` immediately after the drop (before confirming) to prove the staging behavior. No other pre-existing test needed changes — the SENT OFF/redCarded test at line 765 was already unaffected since `isBlocked` short-circuits `handleMidmatchSubstituteDrop` before staging ever occurs, and the `readOnly` bench-drag test dispatches through `handleMidmatchRepositionDrop` (mode stays `'reposition'` when `readOnly` is true), never touching `onSubstitute` either way.
- Full client suite: 1090/1090 passing (up from the pre-plan 1081). `typecheck`/`stylelint`/`eslint`/`check-contrast` all clean.

## Task Commits

Tasks 1 and 2 were committed together (see Deviations below); Task 3 committed separately.

1. **Tasks 1 + 2: Stage substitution + confirmation popup and guards** - `fbce219` (feat)
2. **Task 3: Staged-substitution tests** - `3b57675` (test)

**Plan metadata:** SUMMARY commit handled per worktree isolation (this file is committed separately by the executor per the worktree protocol).

## Files Created/Modified

- `packages/client/src/components/LineupAssignmentScreen.tsx` — `PendingSubstitution` type, `pendingSub` state, rewritten `handleMidmatchSubstituteDrop`, confirmation popup JSX, `pendingSub === null` drag-source guards
- `packages/client/src/components/LineupAssignmentScreen.module.css` — `.subConfirmOverlay`/`.subConfirmCard`/`.subConfirmText`/`.subConfirmActions`/`.subConfirmButtonReady`
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` — 9 new tests (Phase 42 Plan 08 staged-substitution matrix) + 1 pre-existing test updated to drive the confirm button

## Final Shapes

```ts
type PendingSubstitution = {
  outPieceId: string;
  inPlayerId: string;
  outName: string;
  outNumber: number;
  inName: string;
};

function handleMidmatchSubstituteDrop(
  e: React.DragEvent<HTMLDivElement>,
  targetPieceId: string,
  isBlocked: boolean,
  outName: string,
  outNumber: number,
): void; // stages pendingSub; never calls onSubstitute
```

Popup copy: `Substitute {outName} for {inName}?` (e.g. "Substitute Home DefOne for Fallou Fall?"). Buttons: `Cancel` (`aria-label="Cancel substitution selection"`) and `Confirm Substitution` (`aria-label="Confirm substitution"`, the sole `onSubstitute?.(...)` call site).

## Decisions Made

- `outName`/`outNumber` are captured at stage time into `PendingSubstitution` rather than re-derived at confirm time, so the popup keeps rendering the correct identity even across an intervening server broadcast (T-42-34 in the threat model).
- Tasks 1 and 2 committed together (see Deviations) — the plan's own task split assumed `onSubstitute` could go temporarily unused between commits; the repo's eslint gate disagrees.
- `.subConfirmOverlay`'s `z-index: 22` declaration was placed second (after `position: fixed`) rather than last, purely so this plan's own grep-based self-verification (`-A3` window) could confirm it without changing behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tasks 1 and 2 committed together instead of as two atomic commits**

- **Found during:** attempting to commit Task 1 alone
- **Issue:** The plan structures Task 1 (stage the substitution) and Task 2 (render the popup) as separate tasks with separate commits. Task 1 alone leaves the `onSubstitute` prop destructured but never called anywhere in the component (the old call site is removed by Task 1; the new one — the popup's Confirm button — doesn't exist until Task 2). The repo's `husky`/`lint-staged` pre-commit hook runs `eslint --fix` on staged files, and `@typescript-eslint/no-unused-vars` fails the commit outright on the temporarily-unused prop.
- **Fix:** Applied Task 1's and Task 2's code changes together and committed them as a single commit, so `onSubstitute` is never unused at any committed state. Task 3 (tests) remained a separate, third commit as planned.
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.tsx`, `packages/client/src/components/LineupAssignmentScreen.module.css`
- **Verification:** `pnpm --filter @counter-attack/client typecheck`, `npx stylelint`, `npx eslint`, and `pnpm check-contrast` all clean on the combined commit; every Task 1 and Task 2 acceptance-criteria grep re-verified against the final committed state (see below).
- **Committed in:** `fbce219`

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking pre-commit gate)
**Impact on plan:** No functional or scope change — every line of code the plan specified for Task 1 and Task 2 was written exactly as instructed; only the commit boundary moved. All of both tasks' acceptance criteria were independently re-verified against the combined commit:

- `pendingSub` occurs 8 times in `LineupAssignmentScreen.tsx` (>= 5 required)
- `onSubstitute` does not appear in the first 18 lines of `handleMidmatchSubstituteDrop` (0 required)
- `setPendingSub` appears once in the first 18 lines of `handleMidmatchSubstituteDrop` (1 required)
- `pendingSub` does not appear in `handleMidmatchRepositionDrop` (0 required)
- `subConfirmOverlay`/`subConfirmCard`/`subConfirmText`/`subConfirmActions`/`subConfirmButtonReady` occur 7 times in the CSS module (>= 5 required)
- `.subConfirmOverlay`'s first 3 lines contain `z-index: 22` (1 required)
- `Confirm Substitution` occurs once in the .tsx (1 required); `Substitute {` occurs once (>= 1 required)
- `onSubstitute?.(` occurs exactly once in the .tsx (1 required)

## Issues Encountered

- Fresh worktree had no `node_modules` and `packages/shared` had no built `dist/` output (same pattern as prior Phase 42 worktrees — see 42-07-SUMMARY.md). Ran `pnpm install --frozen-lockfile` (~7 min) then `pnpm --filter @counter-attack/shared build` before any verification command could succeed. Not a plan deviation — infrastructure setup only.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `onSubstitute` now has exactly one call site in `LineupAssignmentScreen.tsx` (the popup's Confirm button) — 42-09 (parent wiring in `GameBoard.tsx`) needs no changes to accommodate this; the prop's signature (`(outPieceId: string, inPlayerId: string) => void`) is unchanged from 42-06/42-07.
- The staged-substitution flow is fully reachable and tested independently of 42-09's parent wiring — `LineupAssignmentScreen`'s own test harness (`renderMidmatch`) exercises it directly via `onSubstitute`/`onReposition` mocks.
- No blockers. Full client suite (1090 tests) green; typecheck/stylelint/eslint/check-contrast all clean.

## Self-Check: PASSED

- FOUND: `packages/client/src/components/LineupAssignmentScreen.tsx`
- FOUND: `packages/client/src/components/LineupAssignmentScreen.module.css`
- FOUND: `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- FOUND commit `fbce219` (Tasks 1+2)
- FOUND commit `3b57675` (Task 3)

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_
