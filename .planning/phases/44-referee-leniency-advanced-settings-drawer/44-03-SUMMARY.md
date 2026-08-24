---
phase: 44-referee-leniency-advanced-settings-drawer
plan: 03
subsystem: ui
tags: [react, client-only, forms, settings-screen]

# Dependency graph
requires:
  - phase: 44-referee-leniency-advanced-settings-drawer plan 02
    provides: the Advanced disclosure and two-column advancedGrid/advancedColumn layout this plan inserts the Referee Leniency row into
provides:
  - refereeLeniencyOverride/refereeLeniencyValue local state on GameSettingsScreen (default off/4)
  - Always-mounted, override-gated Referee Leniency stepper row (2-5) in the Advanced drawer's right column, between Out-of-Bounds and Tackle/Steal Decline
  - "(also affects added time)" REFEREE-04 coupling note
  - onConfirm contract widened with refereeLeniencyOverride/refereeLeniencyValue (raw pass-through, no Fouls-style normalisation)
  - Full REFEREE-01/02/04 UI regression test coverage
affects: [44-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side numeric-input JS clamp (min/max) paired with an explicit non-authoritative doc-comment, deferring real validation to the server (plan 44-04)"
    - "fireEvent.change over userEvent.clear()+type() for controlled numeric-input value changes in tests, matching this codebase's existing LobbyScreen.test.tsx convention"

key-files:
  created: []
  modified:
    - packages/client/src/components/GameSettingsScreen.tsx
    - packages/client/src/components/GameSettingsScreen.module.css
    - packages/client/src/components/GameSettingsScreen.test.tsx
    - packages/client/src/App.test.tsx (deviation — see below; App.tsx itself untouched)

key-decisions:
  - "refereeLeniencyOverride/refereeLeniencyValue are raw pass-throughs at confirm time — no parent-toggle normalisation like booking/injury, since Referee Leniency has no Fouls-style dependency and the value must always be sent so the server never reasons about a missing field"
  - "The override checkbox stays fully interactive at all times; only the stepper input greys out via the .leniencyInput:disabled pseudo-class (mirrors .ctaButton:disabled) rather than a conditional className, so the disabled visual can never drift from the actual disabled attribute"

patterns-established:
  - "Numeric-input tests in this codebase should use fireEvent.change, not userEvent.clear()+type() — clear() only fires a DOM event without forcing a React re-render when the underlying onChange handler intentionally bails without calling its setter (e.g. NaN guards), leaving the real DOM value stale for the next keystroke"

requirements-completed: [REFEREE-01, REFEREE-02, REFEREE-04, SETTINGS-06]

# Metrics
duration: ~20min (3 task commits spanning 22:11-22:21 UTC-5; excludes one-time worktree pnpm install/shared-build setup time)
completed: 2026-08-23
---

# Phase 44 Plan 03: Referee Leniency Row & onConfirm Widening Summary

**Added a host-toggleable, always-mounted 2-5 Referee Leniency stepper to the Advanced settings drawer's right column, with a one-sided `onConfirm` contract widening that stays typecheck-safe against the still-unmodified `App.tsx`.**

## Performance

- **Duration:** ~20 min of task work (commits span 22:11:19 to 22:21:10)
- **Tasks:** 3/3 completed
- **Files modified:** 4 (3 planned + 1 deviation — see below)

## Accomplishments

- Referee Leniency row renders between Out-of-Bounds/Restarts and Tackle/Steal Decline Prompt in the Advanced drawer's right column (D-05/D-07)
- Override checkbox defaults unchecked (REFEREE-01); the number-input stepper is always mounted, shows `4` by default, and is `disabled` while the override is off, clamped to integers 2-5 in both directions client-side (REFEREE-02, D-01/D-02/D-03/D-04)
- `(also affects added time)` coupling note renders unconditionally next to the stepper (REFEREE-04, D-08)
- `onConfirm` carries `refereeLeniencyOverride`/`refereeLeniencyValue` as raw pass-throughs; `App.tsx` is intentionally untouched (owned by plan 44-04) and the one-sided widening stays typecheck-safe under `strictFunctionTypes`
- 14 new/extended REFEREE-01/02/04 tests plus all 12 pre-existing exact-payload `onConfirm` assertions (including the two that previously used `expect.objectContaining`) now assert the full 10-field shape — 42/42 tests in `GameSettingsScreen.test.tsx` pass, full client suite (1158 tests) green

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Referee Leniency state, row markup, and CSS** - `bde770e3` (feat)
2. **Task 2: Extend the onConfirm contract with the two Leniency fields** - `3d6b923c` (feat)
3. **Task 3: Add REFEREE-01/02/04 UI tests and update the exact-payload assertions** - `772baffa` (test)

_Note: Task 3 was TDD-flagged in the plan; the test file already existed with substantial coverage, so this was executed as an extension pass (extend + add) rather than a fresh RED→GREEN cycle. No separate RED/GREEN gate commits were produced — see TDD Gate Compliance below._

## Files Created/Modified

- `packages/client/src/components/GameSettingsScreen.tsx` - `refereeLeniencyOverride`/`refereeLeniencyValue` state, `handleRefereeLeniencyValueChange` clamp handler, the Leniency row JSX, widened `onConfirm` prop type and `handleConfirm` payload
- `packages/client/src/components/GameSettingsScreen.module.css` - `.leniencyRow`, `.leniencyControls`, `.leniencyInput` (+ `:disabled` pseudo-class)
- `packages/client/src/components/GameSettingsScreen.test.tsx` - new `Referee Leniency override (REFEREE-01/02/04, Phase 44)` describe block (10 tests); all 12 pre-existing exact-payload `onConfirm` assertions extended with the two new fields; 2 pre-existing `expect.objectContaining` calls converted to exact-object assertions
- `packages/client/src/App.test.tsx` - one pre-existing exact-object `socket.emit(ROOM_SETTINGS_CONFIRM, ...)` assertion extended with the two new fields (deviation, see below)

## Decisions Made

- The stepper never resets when the override is toggled off then back on — it preserves the host's last chosen value, matching D-01's "resets to 4 on first switch-on" without imposing a reset-on-every-toggle behavior not specified in the plan.
- `handleRefereeLeniencyValueChange` returns early (keeps last valid value) on `NaN` rather than propagating it, per T-44-10's threat-model mitigation for cleared/non-numeric input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a comment self-match inflating the `poolRowDisabled` acceptance-criteria grep count**
- **Found during:** Task 1 verification
- **Issue:** An explanatory JSX comment literally contained the string `styles.poolRowDisabled`, making `grep -c "poolRowDisabled"` return 4 instead of the required 3 (Booking/Injury/draft-pool rows only)
- **Fix:** Reworded the comment to describe the same intent without repeating the literal class-reference string
- **Files modified:** `packages/client/src/components/GameSettingsScreen.tsx`
- **Verification:** `grep -c "poolRowDisabled"` now returns 3; typecheck and stylelint re-confirmed green
- **Committed in:** `bde770e3` (Task 1 commit)

**2. [Rule 1 - Bug] Replaced `userEvent.clear()`+`userEvent.type()` with `fireEvent.change()` in the clamp tests**
- **Found during:** Task 3, running the new clamp tests
- **Issue:** The plan's specified `userEvent.clear(input)` then `userEvent.type(input, '9')` pattern doesn't force a DOM sync in this jsdom setup when the controlled input's `onChange` handler intentionally bails on `NaN` without calling its state setter (`handleRefereeLeniencyValueChange`'s NaN guard, T-44-10). The DOM's actual value stayed at the stale `'4'`, so typing e.g. `'1'` produced `'41'` in the underlying DOM, which parsed to 41 and clamped to 5 instead of the intended single-digit clamp target — 2 of 3 clamp/pass-through tests failed with `refereeLeniencyValue: 5` instead of their expected value.
- **Fix:** Switched to `fireEvent.change(stepper, { target: { value: '9' } })`-style single-event value assignment, matching the codebase's existing convention in `LobbyScreen.test.tsx` for numeric/text input changes
- **Files modified:** `packages/client/src/components/GameSettingsScreen.test.tsx`
- **Verification:** All 42 tests in the file pass; the behavior-assertion check (temporarily setting the stepper's initial state to `3`) still correctly fails 14 tests, confirming the tests genuinely pin the intended default/clamp behavior
- **Committed in:** `772baffa` (Task 3 commit)

**3. [Rule 1 - Bug] Updated an existing exact-object test assertion in `App.test.tsx`**
- **Found during:** Task 3, running the full client suite
- **Issue:** `App.tsx`'s `handleSettingsConfirm` forwards the `settings` object wholesale via `socket.emit` — this is unmodified, intentional (Task 2) behavior. Once `GameSettingsScreen`'s `onConfirm` payload grew to 10 fields, a pre-existing exact-object assertion in `App.test.tsx` (asserting the emitted socket payload has exactly 8 fields) started failing, even though `App.tsx`'s source code is byte-for-byte unchanged
- **Fix:** Extended the assertion in `App.test.tsx` with the two new fields (`refereeLeniencyOverride: false, refereeLeniencyValue: 4`), matching the same pass-through the test already exercises
- **Files modified:** `packages/client/src/App.test.tsx` (test file only — `App.tsx` itself remains untouched, confirmed via `git diff --name-only` against `App.tsx`)
- **Verification:** Full client suite (1158 tests) passes; `git diff` confirms `App.tsx` and `packages/shared/src/events.ts` have zero changes
- **Committed in:** `772baffa` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 — bug fixes, all test/comment-scoped, no production-behavior changes beyond what Tasks 1-2 already specified)
**Impact on plan:** All three were necessary to make the plan's own verification commands pass (`typecheck`, full client `test`). No scope creep — no server, `App.tsx`, or `events.ts` source files were touched, preserving the plan's stated boundary for plan 44-04.

## Issues Encountered

- The worktree had no `node_modules` at plan start (fresh worktree checkout) and `packages/shared`'s `dist/` type declarations were stale/missing, causing an unrelated wall of `Cannot find module '@counter-attack/shared'` typecheck errors. Resolved by running `pnpm install` and `pnpm --filter @counter-attack/shared build` before any verification — standard one-time worktree setup, not a plan defect.
- Whole-workspace `pnpm lint` fails with a pre-existing, previously-documented `packages/shared` typescript-eslint file-count-cap parsing error (`Too many files (>8) have matched the default project`), entirely inside `packages/shared/src/*.test.ts` files this plan never touches. This is the same tech debt item already recorded in `.planning/PROJECT.md` ("the whole-workspace `pnpm lint` OOMs on a pre-existing `packages/shared` typescript-eslint file-count-cap config issue... doesn't gate CI"). Verified this plan's changed files are lint-clean by running `eslint` scoped directly to `GameSettingsScreen.tsx`, `GameSettingsScreen.test.tsx`, and `App.test.tsx` — zero errors/warnings.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `GameSettingsScreen`'s `onConfirm` contract now declares and sends `refereeLeniencyOverride`/`refereeLeniencyValue` alongside the six pre-existing fields; `App.tsx`, `events.ts`, `roomStore.ts`, `roomHandlers.ts`, and `gameEngine.ts` remain completely unmodified and ready for plan 44-04 to widen `App.tsx`'s param type, the wire contract, `Room` fields, and server-side allow-list validation (per the six-hop chain documented in `44-PATTERNS.md`).
- No blockers. The client package is fully typecheck/test/stylelint green; the server package typechecks green with zero changes.
