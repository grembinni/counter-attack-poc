---
phase: 35-actionpanel-log-standardization
plan: 04
subsystem: ui
tags: [react, css-modules, vitest, panel-heading, cta-verb, terminology]

# Dependency graph
requires:
  - phase: 35-actionpanel-log-standardization
    provides: "plan 35-01's shared ctaColorClass helper (ctaClass adapter) and the
      already-cleaned ActionPanel.tsx (FREE_KICK_SETUP dead code removed) this plan
      builds directly on top of"
provides:
  - "PanelShell — a module-scope wrapper component in ActionPanel.tsx that renders a
    static 'Actions' heading as the first child of every one of the panel's 18
    phase-gated render sites"
  - "panelHeading CSS class in ActionPanel.module.css matching the sibling panels'
    (KickOffSetupPanel/FreeKickSetupPanel) declarations"
  - "Single canonical 'Confirm' verb on every ActionPanel confirm-and-advance CTA;
    modal affirm renamed to 'Yes, end turn' to avoid two identically-named buttons"
  - "ActionPanel's user-facing goalkeeper wording standardized to 'Keeper'"
affects:
  [35-05-plan (adds waitingHelperBlock/waitingPanel(detail)/actingSideLabel on top of PanelShell)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'PanelShell wrapper component pattern: a single module-scope component owns both
      the heading and the flex-container className composition, so no render site can
      omit the heading and the className composition logic (wide modifier) lives in
      exactly one place'

key-files:
  created: []
  modified:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.module.css
    - packages/client/src/components/ActionPanel.test.tsx
    - packages/client/src/components/GameBoard.test.tsx

key-decisions:
  - "PanelShell renders the heading via a template-literal className
    (`${styles.panel}${wide ? ' ' + styles.wide : ''}`) rather than the old
    array-join/ternary-with-empty-string pattern, so a non-wide shell yields the
    exact bare panel class with no stray trailing space — preserves every pre-existing
    className snapshot exactly per the plan's explicit instruction"
  - "Static 'Actions' heading (not phase-derived) — every phase block already has its
    own contextual title in helperLine1 (Move!, Attempt Save!, Kick-Off!, etc.), so a
    phase-derived heading would duplicate that line"
  - "Confirm dialog's own affirm button renamed to 'Yes, end turn' (not 'Confirm') so it
    is never simultaneously in the DOM with the now-renamed 'Confirm' CTA under an
    ambiguous shared accessible name"

patterns-established:
  - 'PanelShell(wide?, children) is now the single required wrapper for every
    ActionPanel render site — any future phase block must use it to get the heading'

requirements-completed: [PANEL-01, PANEL-02, PANEL-04]

# Metrics
duration: ~35min (includes a one-time pnpm install + packages/shared build for a fresh worktree)
completed: 2026-07-27
---

# Phase 35 Plan 04: ActionPanel Heading, Confirm Verb, and Keeper Terminology Summary

**Added a PanelShell wrapper giving all 18 ActionPanel render sites a structural "Actions" heading matching its three GameBoard slot siblings, unified every confirm-and-advance CTA to the single "Confirm" verb (with the modal affirm renamed to "Yes, end turn" to avoid ambiguity), and standardized ActionPanel's goalkeeper wording to "Keeper".**

## Performance

- **Duration:** ~35 min (includes a one-time `pnpm install --frozen-lockfile` + `packages/shared` build, since this worktree had no `node_modules` on start — resolved entirely from the shared pnpm store, no downloads)
- **Tasks:** 3/3 completed
- **Files modified:** 4 (`ActionPanel.tsx`, `ActionPanel.module.css`, `ActionPanel.test.tsx`, `GameBoard.test.tsx`)

## Accomplishments

- Added a `.panelHeading` CSS class to `ActionPanel.module.css` (joined into the existing full-width flex group) with the exact four declarations `FreeKickSetupPanel.module.css` uses, and removed `.confirmCard`'s 1px border while leaving `.ctaButton`/`.backButton` borders untouched (button borders are explicitly exempt).
- Added a module-scope `PanelShell({ wide, children })` component and a static `ACTION_PANEL_HEADING = 'Actions'` constant, then routed all 17 bare `<div className={styles.panel}>` render sites plus the one composed wide-chooser site (18 total) through `<PanelShell>`/`<PanelShell wide={...}>`. The confirm dialog (`confirmOverlay`/`confirmCard`) was deliberately left unwrapped — it's a modal, not a slot panel.
- Renamed all 6 remaining `End Turn` phase CTA labels (and the `ACTION_SUMMARY` key/tooltip) to `Confirm`; collapsed the HEADER contest button's `Confirm Selection` positive branch to `Confirm`; renamed the confirm dialog's own affirm button from `Confirm` to `Yes, end turn` so the CTA behind the overlay and the dialog's own affirm button are never simultaneously ambiguous.
- Standardized ActionPanel's user-facing goalkeeper wording to "Keeper": `GK_RESTART`'s `Goalie Restart!` → `Keeper Restart!`, and the `Punt (High Pass)`/`Quick Throw` tooltips reworded from "Goalkeeper..." to "Keeper...". No identifier (`isGKTeamPlayer`, `gkPiece`, `emitGKRestart`, `GK_RESTART`, etc.) was renamed — those are code/protocol values, out of D-03's scope.
- Added 26 new test cases across three new `describe` blocks (D-07 heading coverage across 6 phase states + confirm-dialog non-duplication, D-08 single-Confirm-verb behavior, D-03 Keeper terminology) and updated ~30 existing test queries/descriptions in `ActionPanel.test.tsx` plus one integration assertion in `GameBoard.test.tsx` to match the renamed CTA.

## Task Commits

1. **Task 1: Add panelHeading class, remove confirmCard border, route every render site through PanelShell (D-01/D-07)** - `f917cb3` (feat)
2. **Task 2: Unify confirm-and-advance verb to "Confirm" across every phase (D-08)** - `52e73a1` (feat)
3. **Task 3: Standardize ActionPanel goalkeeper wording to "Keeper" (D-03)** - `3a04d1a` (feat)

_Note: no separate plan-metadata commit — this is a worktree-isolated executor run; the orchestrator handles the final metadata commit after merge._

## Files Created/Modified

- `packages/client/src/components/ActionPanel.tsx` - Added `PanelShell`/`ACTION_PANEL_HEADING`; routed all 18 render sites through it; renamed 6 CTA labels + `ACTION_SUMMARY` key + HEADER contest positive branch + dialog affirm button to the unified `Confirm`/`Yes, end turn` wording; reworded 3 goalkeeper strings to "Keeper"
- `packages/client/src/components/ActionPanel.module.css` - Added `.panelHeading` (joined into the full-width flex group); removed `.confirmCard`'s border
- `packages/client/src/components/ActionPanel.test.tsx` - Requeried ~21 `/end turn/i` button-name matchers to `/^confirm$/i`; retargeted the dialog-affirm query to `/yes, end turn/i`; renamed `it`/`describe` text mentioning "End Turn" to "Confirm"; added D-07/D-08/D-03 describe blocks
- `packages/client/src/components/GameBoard.test.tsx` - Retargeted the MOVEMENT-phase integration assertion from `getByText(/End Turn/i)` to `getByRole('button', { name: /^confirm$/i })`

## Decisions Made

- Followed the plan's PanelShell signature and className-composition instructions exactly, including the "no stray trailing space" constraint for the non-wide case.
- Kept the shared `ctaClass`/`ctaColorClass` color-state logic from plan 35-01 completely untouched — Task 2's verb rename only changes label text and the `ACTION_SUMMARY` key, never the `className`/`onClick` composition on any button.
- Left every `GK`-prefixed identifier and phase literal (`GK_RESTART`, `isGKTeamPlayer`, `emitGKRestart`, etc.) unchanged per D-03's explicit scope guard — only rendered/tooltip strings were reworded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded two docblock comments that accidentally matched the plan's own verification regexes**

- **Found during:** Task 1 acceptance-criteria check
- **Issue:** The `PanelShell` docblock originally contained the literal substrings `` `<div className={styles.panel}>` `` and `` `styles.panel` `` for illustrative purposes. Since the plan's acceptance criteria grep the whole file for these exact patterns (`grep -c '<div className={styles.panel}>'` expecting `0`; `grep -c 'styles.panel}'` expecting `1`), the comment text caused false-positive matches (1 and 2 respectively, instead of the expected 0 and 1) even though no actual render site remained unconverted.
- **Fix:** Reworded the docblock to describe the same behavior without using the literal grep-matched substrings (e.g. "the bare panel class" instead of quoting `styles.panel` in backticks).
- **Verification:** `grep -c '<div className={styles.panel}>' ActionPanel.tsx` → `0`; `grep -c 'styles.panel}' ActionPanel.tsx` → `1` (the one real reference, inside `PanelShell`'s own implementation).
- **Committed in:** `f917cb3` (Task 1 commit)

**2. [Rule 1 - Bug] Reworded a Task 2 code comment that accidentally matched the "Confirm Selection" verification regex**

- **Found during:** Task 2 acceptance-criteria check
- **Issue:** A comment explaining the D-08 rename literally quoted the old `'Confirm Selection'` string being replaced, which caused `grep -c "Confirm Selection"` (expected `0`) to return `1` even though no code path still renders that text.
- **Fix:** Reworded the comment to describe "the old longer positive-branch label" without quoting the literal old string.
- **Verification:** `grep -c "Confirm Selection" ActionPanel.tsx` → `0`; `grep -cE "End Turn|Confirm Selection|Goalie|Goalkeeper" ActionPanel.tsx` → `0` after Task 3.
- **Committed in:** `52e73a1` (Task 2 commit)

### Assertion-drift notes (not defects)

**3. [Assertion drift, not a defect] `grep -c '^\.panelHeading'` on `ActionPanel.module.css` is 2, not the plan's expected 1**

- **Found during:** Task 1 acceptance-criteria check
- **Detail:** The plan's acceptance criterion expects exactly 1 match for `^\.panelHeading`, but the pattern necessarily matches twice: once where `.panelHeading` joins the full-width flex group (`.panelHeading,\n.phaseLabel, ...`) and once for `.panelHeading`'s own 4-declaration rule — both required by the plan's own action steps 1 and the `FreeKickSetupPanel.module.css` reference pattern it says to replicate byte-for-byte. Verified the identical sibling file (`FreeKickSetupPanel.module.css`) also has 2 matches for this same regex (`grep -c '^\.panelHeading' FreeKickSetupPanel.module.css` → `2`), confirming this is a plan-authoring miscount against its own reference implementation, not an execution defect. The `panelHeading,` (group-join) assertion independently passes at exactly 1 as specified.
- **Verification:** Behavior matches the sibling pattern exactly; `pnpm stylelint` and `pnpm -r build` both exit 0.

---

**Total deviations:** 2 code changes (both Rule 1 — rewording self-referential comments that accidentally matched literal grep patterns used by the plan's own acceptance criteria); 1 documentation note (assertion-count drift against the plan's own reference pattern, not a defect).
**Impact on plan:** None on behavior — all functional acceptance criteria, the full verification suite, and every pre-existing test pass unchanged.

## Issues Encountered

- This worktree had no `node_modules` on start (fresh worktree). Ran `pnpm install --frozen-lockfile` at the worktree root — resolved entirely from the shared pnpm content-addressable store (`reused 543, downloaded 0`), consistent with plan 35-01's documented setup step; no new package content was fetched and no Windows node_modules-junction risk was introduced (plain install, no junction creation/deletion).
- `packages/shared` needed a `tsc` build (`pnpm --filter @counter-attack/shared build`) before `packages/client`'s typecheck/tests could resolve `@counter-attack/shared` type declarations — a one-time setup step, not a plan deviation.
- Workspace-wide `pnpm lint` fails with 6 pre-existing errors in `packages/shared` (`typescript-eslint` file-count-cap / "Too many files (>8) have matched the default project"), documented in `.planning/PROJECT.md` ("Known tech debt entering Phase 33") and independently confirmed by plan 35-01's summary as identical before and after that plan's changes. Verified this plan's actual touched files are lint-clean via `npx eslint packages/client/src/components/ActionPanel.tsx packages/client/src/components/ActionPanel.test.tsx packages/client/src/components/GameBoard.test.tsx` (zero errors, zero warnings). No fix applied — correctly out of scope (pre-existing, unrelated-package issue).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ActionPanel.tsx` now has a single `PanelShell` wrapper used by all 18 render sites; any future phase-gated block added to this file must route through `PanelShell` to inherit the heading automatically.
- The `Confirm`/`Yes, end turn` verb pair and the `Keeper` terminology in `ActionPanel.tsx` are now consistent with `FreeKickSetupPanel.tsx`'s existing "Confirm"-labeled dialog and with `ActionLog.tsx`'s prior Keeper-terminology work (plan 35-02) — no further cross-component wording work needed for this file.
- Plan 35-05 (per the phase's artifact map) will add `waitingHelperBlock`/`waitingPanel(detail)`/`actingSideLabel` on top of `PanelShell` — that plan can rely on `PanelShell` already being the canonical wrapper for every render site.
- Full client test suite (453 tests across 24 files), typecheck, targeted lint on touched files, stylelint, and `pnpm -r build` all pass with this plan's changes in place.

## Self-Check: PASSED

- FOUND: packages/client/src/components/ActionPanel.tsx (PanelShell + Confirm/Keeper wording present)
- FOUND: packages/client/src/components/ActionPanel.module.css (.panelHeading, confirmCard border-free)
- FOUND: .planning/phases/35-actionpanel-log-standardization/35-04-SUMMARY.md
- FOUND: f917cb3 (Task 1 commit)
- FOUND: 52e73a1 (Task 2 commit)
- FOUND: 3a04d1a (Task 3 commit)

---

_Phase: 35-actionpanel-log-standardization_
_Completed: 2026-07-27_
