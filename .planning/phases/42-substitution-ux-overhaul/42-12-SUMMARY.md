---
phase: 42-substitution-ux-overhaul
plan: 12
subsystem: ui
tags: [react, css-modules, substitution, chrome, accessibility]

# Dependency graph
requires:
  - phase: 42-substitution-ux-overhaul (plans 09/10)
    provides: the SUB-16/SUB-17 chrome (translucent-green strip, bottom-pinned Resume CTA row, small subModeButton) that this plan gap-closes
provides:
  - Solid-green ROSTER strip with white label text (no inner patch), replacing the translucent 15%-tint token
  - .midmatchActionRow — Substitute/Cancel and Resume rendered together at standard CTA size, directly beneath the bench inside LineupAssignmentScreen's own content flow
  - onResume prop on LineupAssignmentScreen (optional, additive) — Resume is now a child-rendered control, not a parent-owned bottom-of-card row
  - Orange Cancel styling on both Cancel surfaces (mode-level rosterActionButtonCancel, popup-level subConfirmButtonCancel)
affects: [42-13, 42-14, 42-15, future substitution/roster UX work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'CSS Modules `composes:` for button-variant sharing (.rosterActionButtonCancel/.resumeButton both compose: rosterActionButton)'
    - "Optional child-rendered dismiss callback (onResume) instead of parent-owned footer row, so a control's placement lives with the content it belongs next to"

key-files:
  created: []
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.module.css
    - packages/client/src/components/GameBoard.test.tsx
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.module.css
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "Swapped --color-speed-standard-bg (rgba(34,197,94,0.15) tint) for --color-cta-ready-bg (#27ae60 solid) on .subButtonStripActive — no new token, reuses the app's existing primary-CTA green"
  - "Removed .subButtonActive's own background entirely rather than picking a new solid green for the inner button — it now falls back to .sideLogChevron's `background: none`, letting the outer strip's solid fill show through with zero inner patch"
  - "onResume rendered inside LineupAssignmentScreen, not GameBoard, so Resume physically lives in the roster panel's own scrolling flow rather than a parent-owned card footer"
  - "Cancel (both mode-level and popup-level) reuses --color-cta-pending-bg/-hover, the app's existing orange 'pending/not-ready' pair — not a new color, and not --color-danger (which is reserved for destructive actions, per 42-UI-SPEC.md's Copywriting Contract)"

requirements-completed: [SUB-11, SUB-12, SUB-16, SUB-17]

# Metrics
duration: ~25min
completed: 2026-08-22
---

# Phase 42 Plan 12: Substitution Chrome Gap-Closure (ROSTER strip, action row, orange Cancel) Summary

**Solid-green ROSTER strip with white text, a standard-size Substitute/Cancel+Resume action row under the bench, and orange Cancel buttons on both substitution-mode surfaces — closing all four remaining live-verification chrome defects from 42-10.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Gap item 2: the persistent side strip now reads **ROSTER** (not SUB) and turns fully solid green (`--color-cta-ready-bg`) with white text (`--color-text-inverse`) when actionable — no more translucent tint, no inner green patch, no dark-green text
- Gap item 3: the Substitute/Cancel toggle now renders at the app's standard CTA size (20px/800, 14px 48px padding, 200px min-width), in the same row as Resume
- Gap item 4: Resume now sits inside `LineupAssignmentScreen`'s own scrolling content flow, directly under the bench (`.midmatchActionRow`), instead of pinned to the bottom of the full-viewport modal card
- Gap item 5: both Cancel affordances (substitution-mode Cancel and the confirm popup's Cancel) are orange via the app's existing `--color-cta-pending-bg`/`-hover` pair

## Task Commits

Each task was committed atomically:

1. **Task 1: ROSTER label + solid-green strip with white text (gap item 2)** - `5789390` (fix)
2. **Task 2: Move Resume under the roster and pair with a standard-size Substitute/Cancel button (gap items 3/4)** - `333285a` (fix)
3. **Task 3: Orange Cancel in the confirmation popup (gap item 5, popup half)** - `eb6b196` (fix)

_No plan-metadata docs commit was made — worktree mode: STATE.md/ROADMAP.md are owned by the orchestrator after wave merge, per this plan's parallel-execution contract._

## Files Created/Modified

- `packages/client/src/components/GameBoard.tsx` - SUB→ROSTER label rename; removed the bottom-pinned `.resumeCtaRow`/`.resumeCta` block; wires `onResume={() => setSubOpen(false)}` into `LineupAssignmentScreen`
- `packages/client/src/components/GameBoard.module.css` - `.subButtonStripActive` swapped to solid `--color-cta-ready-bg`; `.subButtonActive` background removed (falls back to `.sideLogChevron`'s `none`), text color swapped to `--color-text-inverse`; `.subButtonLabel` font-weight 400→700; `.resumeCtaRow`/`.resumeCta`/`.resumeCta:hover` deleted
- `packages/client/src/components/GameBoard.test.tsx` - ROSTER-label assertions (both actionable/non-actionable states), `.subButtonActive` class-composition assertions, and a `.midmatchActionRow` common-parent assertion for Resume/Substitute
- `packages/client/src/components/LineupAssignmentScreen.tsx` - added optional `onResume` prop (destructured, rendered conditionally); moved the Substitute/Cancel button pair into a new `.midmatchActionRow` alongside Resume, positioned after `.benchSection` and before the `pendingSub` popup; applied `.subConfirmButtonCancel` to the popup's Cancel button
- `packages/client/src/components/LineupAssignmentScreen.module.css` - added `.midmatchActionRow`, `.rosterActionButton` (+`:hover`/`:disabled`), `.rosterActionButtonCancel` (`composes: rosterActionButton`, orange), `.resumeButton` (`composes: rosterActionButton`, green); added `.subConfirmButtonCancel`/`:hover` (orange, mirrors `.subConfirmButtonReady`'s shape); incidental prettier normalization of the pre-existing `.statBadge[data-tier=...]` attribute-selector rules (quote style only, no behavior change)
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` - `onResume` additive-prop tests (omitted → no Resume button; supplied → renders and fires); a combined both-Cancels-are-orange test asserting `subConfirmButtonCancel` (popup) and `rosterActionButtonCancel` (mode-level)

## Decisions Made

- No new color tokens or literals introduced anywhere in this plan — every visual change reuses existing tokens (`--color-cta-ready-bg`/`-hover`, `--color-cta-pending-bg`/`-hover`, `--color-text-inverse`) already defined in `tokens.css` and already used elsewhere (`.confirmButtonReady`, `.subConfirmButtonReady`)
- `onResume` is optional/additive — every pre-existing `LineupAssignmentScreen` call site (pregame, draft) that omits it renders with no Resume button, verified by an explicit regression test
- Font-weight bump on `.subButtonLabel` (400→700) is a WCAG AA mitigation for white-on-green legibility at 11px, using an already-declared weight from `42-UI-SPEC.md`'s typography table — not a new design element

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing `node_modules` and shared package build output**

- **Found during:** Task 1 (pre-verification)
- **Issue:** The worktree had no `node_modules` at any workspace level (`vitest` unresolvable), and `packages/shared` had no `dist/` output, so `@counter-attack/shared` failed to resolve in vitest/vite for both `GameBoard.test.tsx` and `LineupAssignmentScreen.test.tsx`
- **Fix:** Ran `pnpm install --frozen-lockfile` at the worktree root (no lockfile changes, no `mklink`/junction workarounds used — install resolved into the worktree's own `node_modules` directly), then `pnpm --filter @counter-attack/shared build` to produce `dist/`
- **Files modified:** none (install/build artifacts only, not tracked)
- **Verification:** `pnpm test -- --pool=forks` subsequently resolved and ran successfully
- **Committed in:** N/A (no source changes; install/build state only)

**2. [Rule 3 - Blocking] `LineupAssignmentScreen.module.css` failed `pnpm format:check` after edits**

- **Found during:** Task 2/3 verification
- **Issue:** `prettier --check .` flagged `LineupAssignmentScreen.module.css` — the file had pre-existing unformatted `.statBadge[data-tier="..."]` single-line attribute-selector rules (double-quoted, one-line) that predate this plan
- **Fix:** Ran `prettier --write` scoped to this one file (already being edited by this plan) to bring the whole file into compliance; did not touch the other 12 files `format:check` also flagged (App.module.css, ActionPanel.module.css, index.css, etc.) — those are pre-existing, out-of-scope formatting debt untouched by this plan, logged below as deferred
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.module.css`
- **Verification:** `pnpm format:check` now passes for this file; `pnpm test -- --pool=forks GameBoard LineupAssignmentScreen` re-run clean afterward (145/145 passing)
- **Committed in:** `333285a` (Task 2 commit, since the reformatted region was adjacent to Task 2's new rules)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues preventing verification from completing)
**Impact on plan:** Neither affects runtime behavior. No scope creep — both are one-time environment/tooling fixes needed to run the plan's own verification gates.

## Deferred Items (out of scope, not fixed)

`pnpm format:check` still flags 12 pre-existing files untouched by this plan (`.planning/debug/resolved/*.md`, `packages/client/index.html`, `packages/client/src/App.module.css`, `packages/client/src/components/ActionPanel.module.css`, `packages/client/src/components/CardInjuryBadge.audit.test.ts`, `packages/client/src/components/PlayerStatsPanel.module.css`, `packages/client/src/components/TeamSelectionScreen.module.css`, `packages/client/src/index.css`, `packages/server/src/__tests__/gameEngine.teamselect.test.ts`, `packages/server/src/__tests__/kickoffDebug.test.ts`, and one `.planning/quick/*` doc) — pre-existing formatting debt, per Scope Boundary not fixed by this plan.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Task-order verification (per plan's `<output>` spec): final DOM order inside the mid-match `.screen` is heading (`.matchSetupHeading`, line 1035) → helper text (`.cyclePickCounter`, line 1036) → `.subCounterChip` span (~line 1046) → slot-cap note (conditional, ~line 1057) → `.formationColumns` (line 1062) → `.benchSection` (line 1069) → **`.midmatchActionRow`** (line 1100, new in this plan) → `pendingSub` confirm popup (line 1154) → `rejectionMessage` (line 1190)
- Grep of existing test files for a literal `'SUB'` label query (per Task 1E instruction): none found — no existing test located the strip control by the string `'SUB'`, so no retargeting was needed
- Removed `GameBoard.module.css` rules (per Task 2 instruction): `.resumeCtaRow`, `.resumeCta`, `.resumeCta:hover` — all three fully deleted, confirmed via `grep -c "resumeCtaRow\|resumeCta"` returning 0 in both `GameBoard.tsx` and `GameBoard.module.css`
- All plan-level verification gates pass on the final committed state: `pnpm --filter @counter-attack/client test -- --pool=forks` (1109/1109), `pnpm -r typecheck` (clean), `npx stylelint "packages/client/src/**/*.module.css"` (clean), `npx eslint` on all 4 modified/tested files (clean), `pnpm knip` (clean, exit 0), `pnpm --filter @counter-attack/client check-contrast` (all 12 teams pass AA), `pnpm format:check` (clean for all 6 files this plan touches — 12 pre-existing unrelated files still flagged, out of scope)
- Ready for the next gap-closure plan in this wave (42-13/42-14/42-15) — no blockers

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_

## Self-Check: PASSED

- FOUND: packages/client/src/components/GameBoard.tsx
- FOUND: packages/client/src/components/GameBoard.module.css
- FOUND: packages/client/src/components/GameBoard.test.tsx
- FOUND: packages/client/src/components/LineupAssignmentScreen.tsx
- FOUND: packages/client/src/components/LineupAssignmentScreen.module.css
- FOUND: packages/client/src/components/LineupAssignmentScreen.test.tsx
- FOUND: commit 5789390 (Task 1)
- FOUND: commit 333285a (Task 2)
- FOUND: commit eb6b196 (Task 3)
