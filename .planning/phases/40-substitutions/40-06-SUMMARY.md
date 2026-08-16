---
phase: 40-substitutions
plan: 06
subsystem: ui
tags: [react, zustand, substitutions, modal, sub-affordance]

# Dependency graph
requires:
  - phase: 40-substitutions (plan 40-01)
    provides: STOPPAGE_PHASES/isStoppagePhase, MAX_SUBS_PER_TEAM/maxOnPitchFor, GameState.bench/subsUsed, GAME_SUBSTITUTION/SubstitutionPayload
  - phase: 40-substitutions (plan 40-03)
    provides: "LineupAssignmentScreen mode='midmatch' branch (midmatchPieces/bench/subsUsed/maxOnPitch/onSubstitute)"
provides:
  - 'emitSubstitution(outPieceId, inPlayerId) store action (fire-and-forget, no optimistic mutation)'
  - "SubstitutionButton — persistent stoppage-gated SUB affordance on GameBoard's pitchRow"
  - "Substitution modal — .substitutionOverlay/.substitutionModalCard/.substitutionModalClose wrapping LineupAssignmentScreen mode='midmatch'"
affects: [40-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SideLog's collapsed-chevron-strip template reused for SubstitutionButton, mirrored to the opposite (right) edge of pitchRow — modal-on-click instead of inline expand is the one structural deviation"
    - "useEffect force-close on isStoppagePhase(phase) going false — prevents a server-driven phase change from leaving a stale actionable modal open (client-side UX mirror of the server's authoritative gate)"

key-files:
  created: []
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.module.css
    - packages/client/src/components/GameBoard.test.tsx

key-decisions:
  - 'assignment/onSwap/onConfirm/lineupConfirmed passed to LineupAssignmentScreen as inert placeholders in midmatch mode ([], no-op, no-op, false) per plan instruction — mid-match substitution is entirely driven by onSubstitute, never onSwap/onConfirm'
  - 'midmatchPieces = pieces.filter(p => p.teamId === myTeam) with no redCarded exclusion — red-carded own-team pieces remain in the list so they render as blocked (non-target) cards rather than disappearing'
  - "playerSlot ?? 1 fallback when passing to LineupAssignmentScreen, matching App.tsx's existing non-null-assertion convention for the same required prop"

requirements-completed: [SUB-01, SUB-02, SUB-04, SUB-06, SUB-07]

# Metrics
duration: ~25min
completed: 2026-08-16
---

# Phase 40 Plan 06: Substitution Affordance + Modal Summary

**A persistent stoppage-gated SUB button on GameBoard opens a modal-wrapped mid-match roster screen; the store gains a fire-and-forget `emitSubstitution` action wired to the modal's drag-and-drop substitution gesture.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-16T13:38:00Z (approx.)
- **Completed:** 2026-08-16T13:46:24Z
- **Tasks:** 3/3 completed
- **Files modified:** 5

## Accomplishments

- Added `emitSubstitution(outPieceId, inPlayerId)` to `useGameStore.ts` — a fire-and-forget `socket.emit(ClientEvents.GAME_SUBSTITUTION, { outPieceId, inPlayerId })` with no optimistic state mutation, mirroring `emitFoulChoice`'s exact shape.
- Added a RED-state `describe('substitution affordance (SUB-01/02)')` block to `GameBoard.test.tsx` covering persistent rendering across stoppage/non-stoppage phases, enabled/disabled aria-labels and tooltip copy, modal open/close, own-team-only scoping, and auto-close on a server-driven phase transition out of the stoppage set.
- Implemented `SubstitutionButton` in `GameBoard.tsx` — a 28px collapsed-strip component mirroring `SideLog`'s structural template but mirrored to the opposite (right) edge of `pitchRow`, always rendered, enabled only when `isStoppagePhase(phase)` is true.
- Implemented the substitution modal — a `.substitutionOverlay`/`.substitutionModalCard` pair reusing `.confirmOverlay`'s backdrop pattern (wider card: 960px/92vw, not `.confirmCard`'s 280px cap) — wrapping `LineupAssignmentScreen` with `mode="midmatch"` and own-team-scoped data (`midmatchPieces`, `bench`, `subsUsed`, `maxOnPitch` via `maxOnPitchFor`) derived from `useMyTeam()`.
- Added a `useEffect` that force-closes the modal the instant `isStoppagePhase(phase)` goes false, so a server-driven phase change can never leave a stale actionable modal open (T-40-20).

## Task Commits

1. **Task 1: Add the emitSubstitution store action** - `6f6bea9` (feat)
2. **Task 2: Wave 0 — GameBoard SUB-affordance spec (RED)** - `07efc67` (test)
3. **Task 3: Implement SubstitutionButton and the substitution modal** - `316c4ca` (feat)

_TDD gate sequence confirmed: `test(40-06)` RED commit (`07efc67`) exists, followed by a `feat(40-06)` GREEN commit (`316c4ca`) — the SUB-affordance describe block's tests went from failing (no `SubstitutionButton` element) to all-green with zero pre-existing-test regressions._

## Files Created/Modified

- `packages/client/src/store/useGameStore.ts` - `emitSubstitution` type declaration + implementation
- `packages/client/src/store/useGameStore.test.ts` - test asserting single emit with `{ outPieceId, inPlayerId }` payload and no store field changed
- `packages/client/src/components/GameBoard.tsx` - `SubstitutionButton` component, substitution modal, `isSubEligiblePhase`/`subOpen` state, force-close `useEffect`, `bench`/`subsUsed`/`selectedFormation`/`playerSlot`/`emitSubstitution` selectors
- `packages/client/src/components/GameBoard.module.css` - `.subButtonStrip`, `.subButtonLabel`, `.subButtonDisabled`, `.substitutionOverlay`, `.substitutionModalCard`, `.substitutionModalClose` — all built from existing `var(--color-*)` tokens, zero new colour literals
- `packages/client/src/components/GameBoard.test.tsx` - new `describe('substitution affordance (SUB-01/02)')` block (10 tests)

## Decisions Made

- `midmatchPieces` includes red-carded own-team pieces (no filtering) so `LineupStatCard`'s `isSubBlocked` dimming has data to render, rather than pieces disappearing from the on-pitch column.
- `assignment`/`onSwap`/`onConfirm`/`lineupConfirmed` passed as inert placeholders (`[]`, no-op, no-op, `false`) to `LineupAssignmentScreen` in midmatch mode, with an inline comment stating mid-match mode never invokes them — SUB-02 is a 1-for-1 swap via `onSubstitute` only; formation change is deferred per CONTEXT.md.
- `playerSlot ?? 1` fallback mirrors `App.tsx`'s existing non-null-assertion convention for the same required prop; the modal is only reachable mid-game (`myTeam !== null` guard), so `playerSlot` is always set in practice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `toBeDisabled()`/`toHaveAttribute()` jest-dom matchers not installed in this project**

- **Found during:** Task 2/3 typecheck verification (`npx tsc --noEmit`)
- **Issue:** The RED-state test spec initially used `expect(button).toBeDisabled()` and `expect(button).toHaveAttribute(...)`, which are `@testing-library/jest-dom` matchers. This project has no `jest-dom` dependency and no global matcher-extension setup file, so these calls fail `tsc --noEmit` with "Property 'toBeDisabled' does not exist on type 'Assertion<HTMLElement>'".
- **Fix:** Rewrote the two affected assertions to use `(button as HTMLButtonElement).disabled` and `button.getAttribute('title')`, matching the existing convention already used throughout `ActionPanel.test.tsx` (e.g. `expect((undo as HTMLButtonElement).disabled).toBe(true)`). Added a scoped `eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion` comment on each cast, since this project's type-aware ESLint config resolves `screen.getByRole`'s return type differently than the direct `tsc` invocation does for a string-literal `name` matcher (the cast is a false-positive "unnecessary" per ESLint but genuinely required per `tsc`).
- **Files modified:** `packages/client/src/components/GameBoard.test.tsx`
- **Commit:** `316c4ca` (folded into the Task 3 commit, since the eslint-fix pass ran as part of Task 3's lint-staged hook after the button existed to test against)

None else — plan executed exactly as written otherwise.

## Issues Encountered

- This worktree's `node_modules` and `packages/shared/dist` were both missing/unbuilt at session start (fresh worktree). Resolved with `pnpm install` (full workspace, resolves from the shared pnpm content-addressable store — no Windows junction workaround used) followed by `pnpm --filter @counter-attack/shared build`. Not a plan deviation — standard worktree bootstrap, consistent with prior Phase 40 plan summaries' documented experience.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- A manager can now open the roster modal during any stoppage phase, drag a bench player onto an on-pitch player, and the substitution intent (`emitSubstitution` → `game:substitution`) reaches the server via the handler built in plan 40-05.
- No phase-dispatch case was added to the ActionPanel ternary chain (D-03 preserved); no whole-store subscription was introduced (every new read is a per-slice selector).
- Full monorepo verification: shared 839 tests / server 1360 tests (1 skipped, 1 todo) / client 989 tests, all green; `tsc --noEmit` clean on client and server; `eslint` clean on all touched files.
- Plan 40-07 (the phase's final gap-closure/verification plan) can now exercise the full end-to-end substitution flow.

---

_Phase: 40-substitutions_
_Completed: 2026-08-16_

## Self-Check: PASSED

- FOUND: packages/client/src/store/useGameStore.ts (emitSubstitution present)
- FOUND: packages/client/src/store/useGameStore.test.ts (emitSubstitution test present)
- FOUND: packages/client/src/components/GameBoard.tsx (SubstitutionButton present)
- FOUND: packages/client/src/components/GameBoard.module.css (.substitutionModalCard present)
- FOUND: packages/client/src/components/GameBoard.test.tsx (substitution affordance describe block present)
- FOUND commit: 6f6bea9 (Task 1)
- FOUND commit: 07efc67 (Task 2)
- FOUND commit: 316c4ca (Task 3)
