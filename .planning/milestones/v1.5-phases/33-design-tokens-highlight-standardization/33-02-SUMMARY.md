---
phase: 33-design-tokens-highlight-standardization
plan: 02
subsystem: client-ui-chrome
tags: [design-tokens, theme, css-variables, action-panel, action-log, kick-off, free-kick]

# Dependency graph
requires:
  - phase: 33-design-tokens-highlight-standardization
    provides: 'packages/client/src/styles/tokens.css chrome design-token layer (33-01)'
provides:
  - 'ActionPanel/ActionLog/ReplayPanel/EventBanner/DisconnectBanner/PlayerStatsPanel/FreeKickSetupPanel/KickOffSetupPanel CSS Modules fully tokenized (zero raw hex/rgba chrome literals)'
  - 'Two additional chrome tokens: --color-overlay-backdrop (modal/confirm-dialog scrim), --color-banner-backdrop (EventBanner box background)'
  - 'ActionLog fallback color routed through the shared teamAccentColor(undefined) helper'
affects: [33-06, 33-07, 'Phase 34 (pure token-value swap)']

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'ReplayPanel (a GameBoard descendant) reads var(--home-accent)/var(--away-accent) — the runtime CSS vars injected at GameBoard root by Plan 33-01 — instead of static #1a56b0/#c0392b literals, with a var() fallback to --team-accent for defense-in-depth if ever rendered outside that subtree.'
    - 'Rule 3 deviation: added --color-overlay-backdrop/--color-banner-backdrop tokens for translucent black scrim values not in the original 18-token UI-SPEC list, following the same pattern Plan 33-01 used for --color-bg-pitch/--color-stat-badge-medium.'

key-files:
  created: []
  modified:
    - packages/client/src/components/ActionPanel.module.css
    - packages/client/src/components/ActionLog.module.css
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ReplayPanel.module.css
    - packages/client/src/components/EventBanner.module.css
    - packages/client/src/components/DisconnectBanner.module.css
    - packages/client/src/components/PlayerStatsPanel.module.css
    - packages/client/src/components/FreeKickSetupPanel.module.css
    - packages/client/src/components/FreeKickSetupPanel.tsx
    - packages/client/src/components/KickOffSetupPanel.module.css
    - packages/client/src/components/KickOffSetupPanel.tsx
    - packages/client/src/styles/tokens.css

key-decisions:
  - 'ReplayPanel.homeTeam/.awayTeam migrated to var(--home-accent)/var(--away-accent) rather than a new static token — ReplayPanel is always rendered as a GameBoard descendant (GameBoard.tsx line 331), so it can safely consume the runtime CSS vars Plan 33-01 already injects at that root, with a var(--team-accent) fallback for defense-in-depth.'
  - 'Added --color-overlay-backdrop (rgba(0,0,0,0.6)) and --color-banner-backdrop (rgba(0,0,0,0.75)) to tokens.css: the plan acceptance grep (#[0-9a-fA-F]{3,8}|rgba?\\() is stricter than Plan 33-01''s own hex-only grep and also catches the modal-scrim/banner-background rgba() literals in ActionPanel/FreeKickSetupPanel/EventBanner. GameBoard.module.css still has one un-migrated rgba(0,0,0,0.6) confirm-overlay from Plan 33-01 — left untouched (out of this plan''s file scope, Rule-1/3 scope boundary).'
  - 'EventBanner.notable (#f39c12) reuses --color-cta-pending-bg rather than introducing a new amber token, since the values are byte-identical and UI-SPEC already documents this same-swatch/different-semantic-name reuse pattern for --color-border/--color-bg-surface-alt.'
  - "PlayerStatsPanel.module.css chrome (panel/text/border) migrated to tokens; the SVG jersey/team-identity rendering in PlayerStatsPanel.tsx was left untouched per the plan's explicit out-of-scope note."

patterns-established:
  - "Descendant CSS Modules of GameBoard can read var(--home-accent)/var(--away-accent) directly instead of needing their own runtime-injection call site — extends Plan 33-01's Pattern 4 to any component nested under GameBoard's root."

requirements-completed: [THEME-03]

# Metrics
duration: ~35min
completed: 2026-07-25
---

# Phase 33 Plan 02: Panel/Log/Banner Chrome Token Migration Summary

**Migrated all in-game panel, log, and banner CSS Modules (ActionPanel, ActionLog, ReplayPanel, EventBanner, DisconnectBanner, PlayerStatsPanel, FreeKickSetupPanel, KickOffSetupPanel) plus their inline `.tsx` chrome literals to `var(--token)` references from `tokens.css`, and routed ActionLog's team-prefix fallback through the shared `teamAccentColor(undefined)` helper.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 12

## Accomplishments

- All chrome literals (surface/panel backgrounds, borders, text greys, white text, gold accent, danger red, CTA ready/pending pairs) in the six Task 1 CSS Modules now resolve via `var(--token)`.
- FreeKick/KickOff panel CSS and their inline `style={{ color: '#hex' }}` literals in `.tsx` now resolve via `var(--token)`/`'var(--color-x)'` strings, with conditional logic (centre-hex occupied/placement-valid branches) preserved exactly.
- ActionLog's 7 hardcoded `'#888888'` fallback sites (2 helper functions + 5 `prefixColor` literals for KICK*OFF_SETUP/SNAP_DEFLECT_MOVE/FK*\* events) now call `teamAccentColor(undefined)`.
- Two new chrome tokens added to close a gap the plan's strict `#hex|rgba?\(` acceptance grep exposed: `--color-overlay-backdrop` (modal/confirm-dialog scrim, shared by ActionPanel and FreeKickSetupPanel) and `--color-banner-backdrop` (EventBanner's translucent box background).
- Full client test suite: 400/400 passing (up from 393 pre-plan — no regressions). Client build and typecheck both clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate ActionPanel/ActionLog/Replay/EventBanner/DisconnectBanner/PlayerStats CSS Modules to tokens** - `749cf7b` (feat)
2. **Task 2: Migrate FreeKick + KickOff panel CSS and inline .tsx chrome literals to tokens** - `f00cef3` (feat)
3. **Task 3: Route ActionLog team-prefix fallback through teamAccentColor(undefined)** - `c09db42` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `packages/client/src/components/ActionPanel.module.css` - All chrome literals -> tokens; confirm-dialog scrim -> `--color-overlay-backdrop`
- `packages/client/src/components/ActionLog.module.css` - All chrome literals -> tokens
- `packages/client/src/components/ActionLog.tsx` - 7 `'#888888'` fallback sites -> `teamAccentColor(undefined)`
- `packages/client/src/components/ReplayPanel.module.css` - Chrome literals -> tokens; home/away team text -> `var(--home-accent)`/`var(--away-accent)`
- `packages/client/src/components/EventBanner.module.css` - Chrome literals -> tokens; box background -> `--color-banner-backdrop`
- `packages/client/src/components/DisconnectBanner.module.css` - Chrome literals -> tokens
- `packages/client/src/components/PlayerStatsPanel.module.css` - Chrome (panel/text/border) literals -> tokens; SVG jersey rendering in `.tsx` left untouched (out of scope)
- `packages/client/src/components/FreeKickSetupPanel.module.css` - Chrome literals -> tokens; confirm-dialog scrim -> `--color-overlay-backdrop`
- `packages/client/src/components/FreeKickSetupPanel.tsx` - Inline `'#ef4444'` literals -> `'var(--color-danger)'`
- `packages/client/src/components/KickOffSetupPanel.module.css` - Chrome literals -> tokens
- `packages/client/src/components/KickOffSetupPanel.tsx` - Inline `'#a0a0a0'`/`'#ef4444'` conditional literals -> `'var(--color-text-secondary)'`/`'var(--color-danger)'`
- `packages/client/src/styles/tokens.css` - Added `--color-overlay-backdrop` and `--color-banner-backdrop` (Rule 3 deviation)

## Decisions Made

- ReplayPanel's `.homeTeam`/`.awayTeam` (previously static `#1a56b0`/`#c0392b`) now read `var(--home-accent, var(--team-accent))`/`var(--away-accent, var(--team-accent))` — ReplayPanel is always rendered as a `GameBoard` descendant (confirmed via `GameBoard.tsx:331`), so it can safely consume the runtime CSS variables Plan 33-01 already injects at GameBoard's root, rather than needing a new static token or its own runtime-injection call site.
- Added two tokens not in the UI-SPEC's original 18-token list (`--color-overlay-backdrop: rgba(0, 0, 0, 0.6)`, `--color-banner-backdrop: rgba(0, 0, 0, 0.75)`) because this plan's acceptance-criteria grep pattern (`#[0-9a-fA-F]{3,8}|rgba?\(`) is broader than Plan 33-01's own verification grep (hex-only) and therefore also flags the modal-scrim and banner-background rgba() literals in this plan's target files. Values are unchanged (frozen per D-06) — this mirrors the exact Rule 3 deviation pattern Plan 33-01 used for `--color-bg-pitch`/`--color-stat-badge-medium`.
- `EventBanner.notable`'s `#f39c12` reuses the existing `--color-cta-pending-bg` token (byte-identical value) rather than introducing a new "warning/amber" token, consistent with the UI-SPEC's own documented pattern of one swatch backing multiple semantically-named tokens (e.g. `--color-border`/`--color-bg-surface-alt` both `#0f3460`).
- `GameBoard.module.css` still has one un-migrated `rgba(0, 0, 0, 0.6)` confirm-overlay literal from Plan 33-01 (missed because that plan's own grep only checked for hex, not rgba). This file is out of this plan's `files_modified` scope — left untouched per the deviation rules' scope boundary (only auto-fix issues directly caused by the current task's changes). Logged here for phase-close visibility; Phase 34's pre-close grep sweep (UI-SPEC Implementation Note 2) should catch and resolve it if not addressed by another 33-0X plan first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Modal-scrim and banner-background rgba() literals had no matching token**

- **Found during:** Task 1/2 acceptance-criteria grep sweep (`grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' ...`)
- **Issue:** `ActionPanel.module.css`'s `.confirmOverlay` background (`rgba(0, 0, 0, 0.6)`), `FreeKickSetupPanel.module.css`'s identical `.confirmOverlay` background, and `EventBanner.module.css`'s `.banner` background (`rgba(0, 0, 0, 0.75)`) are genuine chrome literals in this plan's target files, but the strict rgba-inclusive acceptance grep has zero carve-out for them and no matching token existed in `tokens.css`.
- **Fix:** Added `--color-overlay-backdrop` and `--color-banner-backdrop` to `tokens.css` with the exact frozen values (no visual change), documented inline as a Rule 3 deviation.
- **Files modified:** `packages/client/src/styles/tokens.css`, `packages/client/src/components/ActionPanel.module.css`, `packages/client/src/components/FreeKickSetupPanel.module.css`, `packages/client/src/components/EventBanner.module.css`
- **Commits:** `749cf7b`, `f00cef3`

No other deviations. All three tasks completed per the plan's action text; no architectural changes were needed (Rule 4 did not apply).

## Issues Encountered

- Worktree had no `node_modules` (fresh worktree checkout) and `packages/shared` had no built `dist/` output, causing an initial test failure (`Failed to resolve entry for package "@counter-attack/shared"`). Resolved by running `pnpm install --frozen-lockfile` (worktree-local dependency install, no lockfile changes) followed by `pnpm --filter @counter-attack/shared build`. This is standard first-run worktree setup (also independently hit and resolved the same way by Plan 33-05), not a plan or code defect — no deviation rule applies.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - no stub patterns introduced by this plan.

## Threat Flags

None - this plan touches only developer-authored chrome-color literals and existing pure helper functions (`teamAccentColor`), matching the plan's own threat model (T-33-03/T-33-04, both `accept`). No new network endpoints, auth paths, file access, or schema changes were introduced.

## Next Phase Readiness

- THEME-03 chrome-token migration is complete for all 8 files this plan targeted; combined with Plan 33-01's GameBoard migration, this leaves only `GameBoard.module.css`'s single un-migrated `rgba(0, 0, 0, 0.6)` literal (see Decisions Made) as an open item before Phase 34's pure-value-swap assumption holds fully.
- No blockers for subsequent Phase 33 plans (33-06, 33-07) or Phase 34.

---

_Phase: 33-design-tokens-highlight-standardization_
_Completed: 2026-07-25_

## Self-Check: PASSED

- FOUND: packages/client/src/components/ActionPanel.module.css
- FOUND: packages/client/src/components/ActionLog.module.css
- FOUND: packages/client/src/components/ActionLog.tsx
- FOUND: packages/client/src/components/ReplayPanel.module.css
- FOUND: packages/client/src/components/EventBanner.module.css
- FOUND: packages/client/src/components/DisconnectBanner.module.css
- FOUND: packages/client/src/components/PlayerStatsPanel.module.css
- FOUND: packages/client/src/components/FreeKickSetupPanel.module.css
- FOUND: packages/client/src/components/FreeKickSetupPanel.tsx
- FOUND: packages/client/src/components/KickOffSetupPanel.module.css
- FOUND: packages/client/src/components/KickOffSetupPanel.tsx
- FOUND: packages/client/src/styles/tokens.css
- FOUND commit: 749cf7b
- FOUND commit: f00cef3
- FOUND commit: c09db42
