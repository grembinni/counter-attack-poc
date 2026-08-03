---
phase: 35-actionpanel-log-standardization
plan: 03
subsystem: ui
tags: [react, cta-color-state, css-borders, vitest]

# Dependency graph
requires:
  - phase: 34-visual-theme-restyle
    provides: chrome design-token layer (--team-accent, --color-* tokens) this plan's property-only edits build on
  - plan: 35-01
    provides: shared ctaColorClass(eligibleRemaining, {ready, pending}, enabled) pure helper
provides:
  - Border-free ReplayPanel/FreeKickSetupPanel confirm-dialog containers and both SideLog wrapper states
  - Unified .panelHeading CSS class name across all four render-slot siblings (ActionLog/ActionPanel handled in other 35-xx plans)
  - FreeKickSetupPanel as the second ctaColorClass consumer, with its local color-state ternary deleted
  - Confirm verb unified across FreeKickSetupPanel and KickOffSetupPanel CTAs
  - KickOffSetupPanel context-specific waiting state ("Waiting for the opponent to confirm their placement…")
affects:
  [
    35-04-plan (ActionPanel heading/Confirm-verb work touches ActionPanel.tsx,
    a different file from this plan's scope),
    35-05-plan (waitingHelperBlock/waitingPanel work in ActionPanel.tsx),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'FreeKickSetupPanel.tsx now calls the plan-35-01 ctaColorClass(eligibleRemaining, classes, enabled) helper directly, passing constraintsMet as the `enabled` argument — the second real consumer of that shared implementation'

key-files:
  created:
    - packages/client/src/components/KickOffSetupPanel.test.tsx
  modified:
    - packages/client/src/components/ReplayPanel.tsx
    - packages/client/src/components/ReplayPanel.module.css
    - packages/client/src/components/FreeKickSetupPanel.tsx
    - packages/client/src/components/FreeKickSetupPanel.module.css
    - packages/client/src/components/FreeKickSetupPanel.test.tsx
    - packages/client/src/components/KickOffSetupPanel.tsx
    - packages/client/src/components/GameBoard.module.css

key-decisions:
  - "Widened D-01's .sideLogExpanded-only border removal to also cover .sideLogCollapsed — both are the same SideLog wrapper in its two states and draw the identical vertical frame line; removing only one would leave the collapsed strip framed and the expanded panel not, exactly the per-state drift PANEL-02 exists to eliminate"
  - ".sideLogHeader's border-bottom divider was deliberately kept — it's an internal MATCH LOG/entry-list divider, not a container frame, and D-01 scopes removal to frame elements only"
  - 'FreeKickSetupPanel''s confirm-dialog affirm button renamed Confirm -> "Yes, end turn" (not left as Confirm) to avoid two identically-named buttons coexisting in the DOM once the main CTA was also renamed to Confirm'
  - 'KickOffSetupPanel''s waiting text names the awaited action ("...to confirm their placement…") rather than reusing FreeKickSetupPanel''s Attacking/Defending framing, since KICK_OFF_SETUP has simultaneous both-team placement with no single acting team to name (per CONTEXT.md''s Claude''s-Discretion carve-out)'

requirements-completed: [PANEL-01, PANEL-02, PANEL-03, PANEL-04]

# Metrics
duration: ~55min (includes one-time pnpm install for a fresh worktree)
completed: 2026-07-27
---

# Phase 35 Plan 03: Sibling Panel Border/Heading/CTA/Verb Standardization Summary

**Stripped every container border from the three same-slot sibling panels (ReplayPanel, FreeKickSetupPanel, KickOffSetupPanel) and the SideLog wrapper, unified all four panels' heading class to `panelHeading`, migrated FreeKickSetupPanel onto the plan-35-01 shared `ctaColorClass` helper (deleting its duplicate ready/pending ternary), and unified the confirm-and-advance verb to "Confirm" across FreeKickSetupPanel and KickOffSetupPanel, giving KickOffSetupPanel a context-specific waiting state.**

## Performance

- **Duration:** ~55 min (includes a one-time `pnpm install --frozen-lockfile` + `packages/shared` build, since this worktree had no `node_modules` on start)
- **Tasks:** 3/3 completed
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- Removed the `border: 1px solid var(--color-border)` container/frame declaration from `ReplayPanel.module.css`'s `.panel` and `FreeKickSetupPanel.module.css`'s `.confirmCard`; removed `border-right: 1px solid var(--color-border)` from both `GameBoard.module.css`'s `.sideLogCollapsed` and `.sideLogExpanded` (widened beyond CONTEXT.md's single-selector mention — see Deviations). All button borders (`--color-border-muted`) were left untouched.
- Renamed `ReplayPanel.module.css`'s `.heading` CSS class to `.panelHeading` (and its matching JSX usage), so all four render-slot siblings (`ActionPanel`, `KickOffSetupPanel`, `FreeKickSetupPanel`, `ReplayPanel`) now share one heading class name.
- Deleted `FreeKickSetupPanel.tsx`'s local `endTurnColorClass` nested ternary and replaced it with a single call to the shared `ctaColorClass(remaining, { ready, pending }, constraintsMet)` helper from plan 35-01 — `FreeKickSetupPanel` is now the helper's second real consumer. The `disabled={!constraintsMet}` gate on the CTA button was left completely independent and unchanged (T-35-07 mitigation).
- Renamed FreeKickSetupPanel's main CTA label `End Turn` → `Confirm`, and renamed its confirm-dialog's own affirm button `Confirm` → `Yes, end turn` (to avoid two identically-named buttons in the DOM while the dialog is open).
- Renamed `KickOffSetupPanel.tsx`'s enabled CTA label `Ready` → `Confirm`; renamed its post-click disabled button's label `Waiting for opponent…` → `Confirmed`; added a new `constraintRow` (shown only when `localReady` is true) reading `Waiting for the opponent to confirm their placement…`. `disabled={!constraintsMet}`, `title`, and `handleReadyClick`/`emitReady` were left unchanged (T-35-08 mitigation).
- Created `KickOffSetupPanel.test.tsx` (did not previously exist) with 6 tests covering phase gating, Confirm-button gating on the centre-hex/in-zone constraints, and pre/post-Confirm waiting-text presence.
- Updated `FreeKickSetupPanel.test.tsx`: requeried every `End Turn` button lookup as `/^confirm$/i` (anchored so it cannot also match the dialog's `Yes, end turn`), retitled the affected `it`/`describe` blocks, and added a new `describe('FreeKickSetupPanel — D-06/D-08: shared CTA color helper and Confirm verb', …)` block with 4 new tests covering the pending/ready/disabled color states and the dialog's Cancel/"Yes, end turn" flow.

## Task Commits

1. **Task 1: Strip every container border in the slot set and normalize the heading class name (D-01, D-07)** - `d15b561` (fix)
2. **Task 2: Make FreeKickSetupPanel the second consumer of ctaColorClass and adopt the Confirm verb (D-06, D-08)** - `8f61e96` (feat)
3. **Task 3: Adopt the Confirm verb and a context-specific waiting state in KickOffSetupPanel (D-08, D-09)** - `56ee37a` (feat)

_Note: no separate plan-metadata commit — this is a worktree-isolated executor run; the orchestrator handles the final metadata commit after merge._

## Files Created/Modified

- `packages/client/src/components/ReplayPanel.module.css` - Removed `.panel`'s container border; renamed `.heading` → `.panelHeading`
- `packages/client/src/components/ReplayPanel.tsx` - Renamed `styles.heading` usage to `styles.panelHeading`
- `packages/client/src/components/FreeKickSetupPanel.module.css` - Removed `.confirmCard`'s container border
- `packages/client/src/components/FreeKickSetupPanel.tsx` - Imported and called the shared `ctaColorClass` helper (deleted local `endTurnColorClass` ternary); renamed CTA label to `Confirm`; renamed dialog affirm label to `Yes, end turn`
- `packages/client/src/components/FreeKickSetupPanel.test.tsx` - Requeried by `/^confirm$/i`; retitled affected tests; added new D-06/D-08 describe block (4 new tests)
- `packages/client/src/components/KickOffSetupPanel.tsx` - Renamed CTA label `Ready` → `Confirm`; renamed post-click label to `Confirmed`; added the context-specific waiting `constraintRow`; updated stale doc comments referencing the old "Ready"/"Waiting for opponent" terminology
- `packages/client/src/components/KickOffSetupPanel.test.tsx` - New file (did not exist before this plan); 6 tests covering phase gating, Confirm gating, and waiting-text presence
- `packages/client/src/components/GameBoard.module.css` - Removed `border-right` from both `.sideLogCollapsed` and `.sideLogExpanded` (widened scope, see Deviations); `.sideLogHeader`'s `border-bottom` divider deliberately kept

## Decisions Made

- Widened D-01's border removal from the plan's literally-named `.sideLogExpanded` to also cover `.sideLogCollapsed` — both selectors are the same `SideLog` wrapper's two states and draw the identical vertical frame line against the pitch; removing only one would leave the collapsed strip framed and the expanded panel not, exactly the per-state visual drift PANEL-02 exists to eliminate. This widening was explicitly anticipated by the plan's own task instructions.
- Kept `.sideLogHeader`'s `border-bottom: 1px solid var(--color-border)` — it's an internal MATCH LOG/entry-list divider, not a container frame, and D-01 scopes border removal to frame/container elements only. Removing it would run the header text into the first log entry.
- `FreeKickSetupPanel`'s confirm-dialog affirm button changed from `Confirm` to `Yes, end turn` (not left as `Confirm`) — required because renaming the main CTA to `Confirm` would otherwise put two identically-named buttons in the DOM whenever the dialog is open, making the UI and every accessible-name query ambiguous. `Yes, end turn` directly answers the dialog's own prompt.
- `KickOffSetupPanel`'s waiting text names the awaited action (`"...to confirm their placement…"`) rather than reusing `FreeKickSetupPanel`'s Attacking/Defending framing — `KICK_OFF_SETUP` has simultaneous both-team placement with no single "acting team" to name, per CONTEXT.md's Claude's-Discretion carve-out for this exact case.
- No new file for the shared color-state helper was needed in this plan — `ctaColorClass.ts` already exists from plan 35-01 with a signature (`(eligibleRemaining, {ready, pending}, enabled)`) designed specifically for this migration.

## Deviations from Plan

None functionally — all three tasks were implemented as specified and every acceptance criterion describing _behavior_ passes (all 449 client tests green, typecheck/stylelint/build clean, targeted eslint clean on every touched file). Several of the plan's literal grep-count assertions did not match exactly, due to the same category of plan/codebase drift documented in plan 35-01's SUMMARY (naive substring-count assertions colliding with unrelated code that happens to share a word), not anything introduced by this plan's edits:

**1. [Assertion drift, not a defect] `grep -c "border-right" GameBoard.module.css` returns 3, not the plan's expected 0**

- **Found during:** Task 1 acceptance-criteria check
- **Detail:** The plan's literal assertion assumed `border-right` appeared only in the `sideLog*` selectors. `GameBoard.module.css` also has a pre-existing, unrelated `border-right: 1px solid var(--color-border)` on `.topBandLeft` (line 33, top-band scoreboard layout) and a `border-right: 1px solid var(--team-accent)` on a different selector (line 56) — neither is part of this task's stated scope (only `.sideLogCollapsed`/`.sideLogExpanded` were named as edit sites), and neither is a `SideLog` frame border.
- **Verification:** `grep -n "border-right" packages/client/src/components/GameBoard.module.css` confirms exactly the 2 targeted `sideLog*` border-right declarations were removed; the 3 remaining matches are pre-existing, out-of-scope declarations in unrelated sections of the same file.

**2. [Assertion drift, not a defect] `grep -c "Confirm" FreeKickSetupPanel.tsx` returns 4, not the plan's expected 1**

- **Found during:** Task 2 acceptance-criteria check
- **Detail:** The plan's own acceptance criterion anticipated this ("`grep -c ">$" ... is not used as a gate — instead assert `grep -c "Confirm"`returns 1"), but the actual file has 3 additional lines containing the substring "Confirm" that predate/accompany this task: the pre-existing`withEndTurnConfirm` helper-function identifier (used twice) and this task's own new code comment describing the color-state helper call. Only one of the 4 matching lines is the literal CTA button label text.
- **Verification:** Test suite confirms the single user-facing CTA button reads exactly "Confirm" (`screen.getByRole('button', { name: /^confirm$/i })` passes across 29 tests); `grep -c "styles.ctaButtonReady"` correctly returns 2 (the adapter's `ready` argument plus the intentionally-exempt dialog affirm button), matching the plan's own acceptance criterion.

**3. [Assertion drift, not a defect] `grep -c "Confirm" KickOffSetupPanel.tsx` returns 5, not the plan's expected 2**

- **Found during:** Task 3 acceptance-criteria check
- **Detail:** After renaming the CTA labels, I also updated this file's stale JSDoc comments (which previously described the old "Ready"/"Waiting for opponent" behavior) to reference the new "Confirm" terminology for future-reader accuracy. Those doc-comment updates added 3 additional lines containing the substring "Confirm" beyond the 2 literal button labels (`Confirm` and `Confirmed`). I deliberately chose accurate documentation over hitting the literal grep count exactly, since the plan's underlying intent — a single canonical CTA verb — is fully satisfied and verified by the test suite.
- **Verification:** `KickOffSetupPanel.test.tsx`'s 6 tests assert the exact button labels via anchored role queries (`/^confirm$/i`, `/^confirmed$/i`); `grep -c "Ready$\|>Ready<"` correctly returns 0 and `grep -c "Waiting for opponent"` correctly returns 0 (updated the stale doc comment that was the sole remaining occurrence, caught during acceptance-criteria verification).

**4. [Deferred, out of scope] workspace-wide `pnpm lint` OOMs on packages/shared**

- **Found during:** Task 2 verification step
- **Detail:** Pre-existing, already-documented tech debt (`.planning/PROJECT.md` "Known tech debt entering Phase 33" and plan 35-01's SUMMARY) — a typescript-eslint file-count-cap config issue in `packages/shared`, unrelated to this plan's `packages/client`-only changes.
- **Fix:** None applied (correctly out of scope). Verified zero lint errors on every file this plan touched via targeted `npx eslint` invocations.

---

**Total deviations:** 0 code changes beyond the plan's intent; 4 documentation notes (3 acceptance-criteria count-drift explanations, 1 pre-existing out-of-scope issue confirmation).
**Impact on plan:** None — all behavioral acceptance criteria and the full verification suite (typecheck, targeted lint, tests, stylelint, build) pass.

## Issues Encountered

- This worktree had no `node_modules` on start (fresh worktree). Ran `pnpm install --frozen-lockfile` at the worktree root — resolved entirely from the shared pnpm content-addressable store (`reused 543, downloaded 0`), so no new package content was fetched and no Windows node_modules junction risk was introduced (plain install, not a junction operation).
- `packages/shared` needed a one-time `tsc` build (`pnpm --filter @counter-attack/shared build`) before `packages/client`'s typecheck/tests could resolve `@counter-attack/shared` type declarations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four render-slot siblings (`ActionPanel` — handled in plans 35-04/35-05, `KickOffSetupPanel`, `FreeKickSetupPanel`, `ReplayPanel`) now share the `.panelHeading` CSS class name convention.
- `ctaColorClass` now has two real consumers (`ActionPanel` from plan 35-01, `FreeKickSetupPanel` from this plan) — plan 35-04's `ActionPanel` heading/Confirm-verb work can proceed without further color-state consolidation needed.
- Full client test suite (25 files, 449 tests), typecheck, targeted lint, stylelint, and `pnpm -r build` all pass with this plan's changes in place.

## Self-Check: PASSED

- FOUND: packages/client/src/components/KickOffSetupPanel.test.tsx
- FOUND: packages/client/src/components/ReplayPanel.tsx (modified)
- FOUND: packages/client/src/components/ReplayPanel.module.css (modified)
- FOUND: packages/client/src/components/FreeKickSetupPanel.tsx (modified)
- FOUND: packages/client/src/components/FreeKickSetupPanel.module.css (modified)
- FOUND: packages/client/src/components/FreeKickSetupPanel.test.tsx (modified)
- FOUND: packages/client/src/components/KickOffSetupPanel.tsx (modified)
- FOUND: packages/client/src/components/GameBoard.module.css (modified)
- FOUND: d15b561 (Task 1 commit)
- FOUND: 8f61e96 (Task 2 commit)
- FOUND: 56ee37a (Task 3 commit)

---

_Phase: 35-actionpanel-log-standardization_
_Completed: 2026-07-27_
