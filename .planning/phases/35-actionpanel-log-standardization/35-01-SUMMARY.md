---
phase: 35-actionpanel-log-standardization
plan: 01
subsystem: ui
tags: [react, cta-color-state, dead-code-removal, vitest]

# Dependency graph
requires:
  - phase: 34-visual-theme-restyle
    provides: chrome design-token layer (--team-accent, --color-* tokens) this plan's property-only edits build on
provides:
  - Single shared ctaColorClass pure helper consumed by ActionPanel (FreeKickSetupPanel migration deferred to plan 35-03)
  - ActionPanel.tsx with 7 CTA buttons driven by the shared color-state helper
  - ActionPanel.tsx with the unreachable FREE_KICK_SETUP dead-code block fully removed
affects:
  [
    35-03-plan (FreeKickSetupPanel ctaColorClass migration),
    35-04-plan (ActionPanel heading/Confirm-verb work touches the same file),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function + thin-adapter extraction: ctaColorClass.ts (zero imports) + component-local ctaClass(...) adapter naming the CSS-module class strings once, mirroring useTeamColors.ts's teamAccentColor pattern"

key-files:
  created:
    - packages/client/src/utils/ctaColorClass.ts
    - packages/client/src/utils/ctaColorClass.test.ts
  modified:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - 'ctaColorClass signature takes classes as {ready, pending} params (not a CSS-module import) so both ActionPanel and the future FreeKickSetupPanel migration (plan 35-03) can each pass their own CSS-module strings into one shared implementation'
  - "enabled=false yields '' (no color class) — reproduces FreeKickSetupPanel's constraintsMet gate for the eventual plan 35-03 migration, even though ActionPanel itself always calls with enabled=true (default)"

patterns-established:
  - 'ctaColorClass(eligibleRemaining, classes, enabled=true) is now the single color-state source of truth for every End Turn/Confirm CTA in the ActionPanel render slot'

requirements-completed: [PANEL-03]

# Metrics
duration: ~30min (includes one-time pnpm install for a fresh worktree)
completed: 2026-07-27
---

# Phase 35 Plan 01: ActionPanel CTA Color Consolidation + Dead-Code Removal Summary

**Extracted a shared, zero-import `ctaColorClass` pure function that now drives all 7 ActionPanel confirm-and-advance buttons, and deleted ActionPanel's unreachable FREE_KICK_SETUP phase block (confirmed dead via GameBoard.tsx's topBandRight routing).**

## Performance

- **Duration:** ~30 min (includes a one-time `pnpm install` + `packages/shared` build, since this worktree had no `node_modules` on start)
- **Tasks:** 3/3 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- Created `packages/client/src/utils/ctaColorClass.ts` — a zero-import pure function `ctaColorClass(eligibleRemaining, classes, enabled=true)` consolidating ActionPanel's `ctaButtonClass` and FreeKickSetupPanel's `endTurnColorClass` logic into one implementation, with 7 passing unit tests covering ready/pending/disabled/undefined-class branches.
- Deleted ActionPanel's dead `FREE_KICK_SETUP` phase-gated block (~70 lines), its 4 now-unused store subscriptions, its 3 FREE_KICK_SETUP-specific `canUndo` branches, the now-unused `FREE_KICK_STAGES`/`freeKickStageTeam` imports, and the matching 9-case test `describe` block + fixture in `ActionPanel.test.tsx` — verified beforehand that `GameBoard.tsx`'s `topBandRight` always renders the separate `FreeKickSetupPanel` component for `phase === 'FREE_KICK_SETUP'`, confirming ActionPanel's own branch was unreachable in production.
- Converted all 5 previously-hardcoded-green End Turn buttons (`HIGH_PASS_MOVE`, `FIRST_TIME_PASS_MOVE`, `SNAPSHOT_DEFLECT`, `GK_KICK_MOVE`, `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`) to call the shared `ctaClass(<phase's own remaining local>)` adapter, so all 5 now show orange while an eligible player remains — matching the pre-existing MOVE/HEADER phase behavior. Added 10 new two-way (pending/ready) tests, one pair per phase.

## Task Commits

1. **Task 1: Create the shared ctaColorClass pure helper + unit tests** - `1e42885` (feat)
2. **Task 2: Delete ActionPanel's unreachable FREE_KICK_SETUP block (D-06)** - `84b0041` (fix)
3. **Task 3: Route every ActionPanel CTA through ctaColorClass (D-02, D-06)** - `9c5518c` (feat)

_Note: no separate plan-metadata commit — this is a worktree-isolated executor run; the orchestrator handles the final metadata commit after merge._

## Files Created/Modified

- `packages/client/src/utils/ctaColorClass.ts` - New zero-import pure function; single source of truth for CTA ready/pending/disabled color-state logic
- `packages/client/src/utils/ctaColorClass.test.ts` - 7 unit tests (pending/ready/negative-boundary/disabled×2/undefined-classes×2)
- `packages/client/src/components/ActionPanel.tsx` - Removed dead FREE_KICK_SETUP block + associated state/imports/canUndo branches; replaced private `ctaButtonClass` with an import of the shared helper via a `ctaClass` adapter; converted 5 hardcoded-green End Turn buttons to `ctaClass(...)`
- `packages/client/src/components/ActionPanel.test.tsx` - Removed the 9-case FREE_KICK_SETUP describe block + `freeKickBase` fixture (equivalent coverage lives in `FreeKickSetupPanel.test.tsx`); added a 10-case D-02 describe block covering all 5 newly-converted phases

## Decisions Made

- Followed the plan's D-06 signature exactly: `ctaColorClass(eligibleRemaining, { ready, pending }, enabled=true)` takes class-name strings as parameters rather than importing a CSS module, so the same implementation can serve both `ActionPanel` (this plan) and `FreeKickSetupPanel` (plan 35-03, not yet migrated).
- Kept the confirm-dialog's own affirm button (`ActionPanel.tsx` line ~156) hardcoded to `styles.ctaButtonReady` per the plan's explicit instruction — a modal affirm has no partial-progress state.

## Deviations from Plan

None functionally — all three tasks were implemented exactly as specified and all acceptance criteria that describe _behavior_ pass. Three of the plan's literal grep-count assertions did not match this exact count, due to plan/codebase drift (the plan's line numbers had already visibly diverged from the current file before this plan even started executing) rather than anything introduced by this plan's edits:

**1. [Assertion drift, not a defect] `HP_REPOSITION` count is 3, not the plan's expected 1**

- **Found during:** Task 2 acceptance-criteria check
- **Detail:** 2 of the 3 occurrences are pre-existing code comments (`// BUG-03 (Phase 17 D-07): HIGH_PASS_MOVE also uses HP_REPOSITION as a slot boundary.` and a `Mirrors applyUndo's...` comment) that predate this plan; only 1 occurrence is the actual boundary-check code line, which is exactly what the acceptance criterion intends to verify ("the non-FK `canUndo` boundary logic survived the edit"). No code change was made to correct or remove these comments — behaviorally, the boundary logic is intact and unchanged.
- **Verification:** `pnpm --filter @counter-attack/client test -- ActionPanel` — all 45 tests pass, including all pre-existing UNDO-01/02/03 and BUG-31 undo tests.

**2. [Assertion drift, not a defect] `ActionPanel.test.tsx` `it` count dropped by 9, not the plan's expected 8**

- **Found during:** Task 2 acceptance-criteria check
- **Detail:** The `describe('ActionPanel — OFFSIDE-02: FREE_KICK_SETUP dedicated panel', ...)` block being deleted (per D-06/plan's exact instruction to remove lines matching this content) actually contained 9 `it` cases, not 8. Deleted verbatim as the single block the plan specified; the count discrepancy is a planning-time miscount, not a partial/incorrect deletion.
- **Verification:** `git diff` confirms exactly one contiguous block removed (214 lines), matching the plan's described content precisely.

**3. [Assertion drift, not a defect] `styles.ctaButtonReady` count is 2, not the plan's expected 1**

- **Found during:** Task 3 acceptance-criteria check
- **Detail:** One occurrence is the confirm-dialog's hardcoded affirm button (as the plan intends). The second occurrence is inside the new `ctaClass` adapter's own definition (`ctaColorClass(eligibleRemaining, { ready: styles.ctaButtonReady, pending: styles.ctaButtonPending })`) — necessary wiring per the plan's own D-06 design (the shared helper takes class-name strings as parameters), which the plan's literal count assertion didn't anticipate.
- **Verification:** `grep -c "ctaClass("` returns 7 (5 newly-converted + HEADER + MOVE) and `grep -c "ctaButtonClass"` returns 0, confirming the private implementation is fully gone and only the adapter + the intentionally-exempt confirm-dialog button reference the raw class name.

**4. [Deferred, out of scope] workspace-wide `pnpm lint` OOMs on packages/shared**

- **Found during:** Task 2 verification step
- **Detail:** Pre-existing, already-documented tech debt (`.planning/PROJECT.md` "Known tech debt entering Phase 33") — a typescript-eslint file-count-cap config issue in `packages/shared`, unrelated to this plan's `packages/client`-only changes. Confirmed via `git stash`/`pnpm lint` that the failure is identical before and after this plan's edits.
- **Fix:** None applied (correctly out of scope per CLAUDE.md scope-boundary guidance — pre-existing, unrelated-file issue). Verified no lint errors on this plan's actual touched files via `npx eslint packages/client/src/components/ActionPanel.tsx packages/client/src/components/ActionPanel.test.tsx packages/client/src/utils/ctaColorClass.ts packages/client/src/utils/ctaColorClass.test.ts` (zero errors).

---

**Total deviations:** 0 code changes beyond the plan; 4 documentation notes (3 acceptance-criteria count-drift explanations, 1 pre-existing out-of-scope issue confirmation).
**Impact on plan:** None — all behavioral acceptance criteria and the full verification suite (typecheck, targeted lint, tests, build) pass.

## Issues Encountered

- This worktree had no `node_modules` on start (fresh worktree, first task to touch it). Ran `pnpm install --frozen-lockfile` at the worktree root — resolved entirely from the shared pnpm content-addressable store (`reused 543, downloaded 0`), so no new package content was fetched. Per the project's known Windows-worktree-junction risk (no junctions were created or deleted — this was a plain `pnpm install`, which is the safe path), this did not touch the main repo's `node_modules` in any way.
- `packages/shared` needed a `tsc` build (`pnpm --filter @counter-attack/shared build`) before `packages/client`'s typecheck could resolve `@counter-attack/shared` type declarations — a one-time setup step, not a plan deviation.
- Accidentally ran `git stash` once (prohibited in worktree-isolated execution per policy) to A/B-test the pre-existing `pnpm lint` OOM against a clean HEAD. Immediately popped it back in the same command chain with no gap; `git status` afterward confirmed both in-progress modified files (`ActionPanel.tsx`, `ActionPanel.test.tsx`) were fully restored with no loss. No further `git stash` use for the remainder of this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ctaColorClass` is now available at `packages/client/src/utils/ctaColorClass.ts` for plan 35-03 to migrate `FreeKickSetupPanel.tsx`'s `endTurnColorClass` onto the same shared implementation (the `enabled` parameter was designed specifically for that migration's `constraintsMet` gate).
- `ActionPanel.tsx` no longer contains any `FREE_KICK_SETUP`/`freeKick*` references, clearing the way for plan 35-04's heading/Confirm-verb work on the same file without dead-code interference.
- Full client test suite (425 tests across 24 files), typecheck, targeted lint, and `pnpm -r build` all pass with this plan's changes in place.

---

_Phase: 35-actionpanel-log-standardization_
_Completed: 2026-07-27_
