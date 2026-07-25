---
phase: 33-design-tokens-highlight-standardization
plan: 03
subsystem: client-ui-chrome
tags:
  [design-tokens, theme, css-variables, lobby, settings, team-selection, uniform-selection, lineup]
dependency-graph:
  requires:
    - 'packages/client/src/styles/tokens.css (chrome design-token layer, from 33-01)'
  provides:
    - 'LobbyScreen/GameSettingsScreen/TeamSelectionScreen/UniformSelectionScreen/LineupAssignmentScreen CSS Modules resolving 100% of chrome colors via var(--token)'
    - '18 additional chrome tokens in tokens.css (speed-picker family, selection-card glow family, misc single-use chrome literals) covering values outside the original 33-01 18-token list'
  affects:
    - 'packages/client/src/styles/tokens.css'
tech-stack:
  added: []
  patterns:
    - 'Value-based literal->token mapping: identical hex/rgba values collapse to the same var(--token) reference regardless of which CSS property or component uses them (property-sensitive only where UI-SPEC assigns different semantic tokens to the same value, e.g. border vs background use of #0f3460)'
key-files:
  created: []
  modified:
    - packages/client/src/styles/tokens.css
    - packages/client/src/components/LobbyScreen.module.css
    - packages/client/src/components/GameSettingsScreen.module.css
    - packages/client/src/components/TeamSelectionScreen.module.css
    - packages/client/src/components/UniformSelectionScreen.module.css
    - packages/client/src/components/LineupAssignmentScreen.module.css
decisions:
  - "Rule 3 deviation: extended tokens.css with 18 new chrome tokens beyond the 33-01 18-token list (--color-success-hover, --color-accent-gold-glow, --color-confirm-pending-bg, --color-border-subtle, 5 --color-card-border-*/--color-card-glow-* selection-card tokens, 9 --color-speed-*/-active/-bg speed-picker tokens) — required because the plan's zero-hex/rgba-literal acceptance gate covers every literal in the five target files, not only the subset already listed in UI-SPEC section A. Values are frozen/unchanged from their prior literal use (same pattern already established by 33-01 Task 2's --color-bg-pitch/--color-stat-badge-medium additions)."
  - "--color-speed-standard and --color-speed-fast intentionally duplicate the numeric values of --color-success (#22c55e) and --color-stat-badge-medium (#f97316) under speed-specific semantic names, mirroring the precedent already set by --color-border reusing --color-bg-surface-alt's value in the original token table."
  - 'Value-based mapping, not usage-based: identical literals collapse to the same token everywhere they occur (e.g. every #1a1a2e becomes var(--color-bg-page) whether used for a page root or a formation-card background), except where the same literal serves a genuinely different CSS property with its own UI-SPEC token (e.g. #0f3460 as border-color -> var(--color-border) vs #0f3460 as background -> var(--color-bg-surface-alt)).'
  - 'UniformSelectionScreen.tsx left untouched per plan scope — its jersey-preview palette literals (#555/#888/#fff, tileRenderPalette.*) are team-identity rendering, not chrome, and are explicitly excluded.'
metrics:
  duration: '~35 min'
  completed: 2026-07-25
---

# Phase 33 Plan 03: Lobby/Settings/Selection Screen Token Migration Summary

All five pre-game screen CSS Modules (Lobby, GameSettings, TeamSelection, UniformSelection, LineupAssignment) migrated to resolve 100% of chrome colors via `var(--token)`, extending `tokens.css` with 18 additional frozen-value tokens to cover literals (game-speed picker accents, team/formation selection-card border-glow family, and several single-use chrome values) that fell outside the original 33-01 18-token list.

## What Was Built

**Task 1 — LobbyScreen + GameSettingsScreen.** Both files' backgrounds, borders, text greys, CTA button colors, and the muted `#a0a0a0` border literal (GameSettingsScreen `.speedOption` border, flagged in the plan's read_first) now read `var(--color-bg-page)`, `var(--color-bg-surface)`, `var(--color-bg-surface-alt)`, `var(--color-border)`, `var(--color-border-muted)`, `var(--color-text-primary/secondary)`, `var(--color-text-inverse)`, `var(--color-accent-gold)`, and `var(--color-danger)`. The `#1a56b0` CTA-hover/input-focus literal in both files maps to `var(--team-accent)`, matching the UI-SPEC's documented static fallback for lobby/pre-team-select screens (no team is active yet on these screens, so the CSS variable resolves to tokens.css's `#1a56b0` default). GameSettingsScreen's game-speed picker (Slow/Standard/Fast accent colors, including the three `rgba(...)` active-state backgrounds) migrated to a new `--color-speed-*` token family (see Deviations).

**Task 2 — TeamSelectionScreen + UniformSelectionScreen.** Same background/border/text/CTA mapping applied to both files, including TeamSelectionScreen's `#a0a0a0` speed-option border (flagged at ~line 169). UniformSelectionScreen — the largest literal set (65 occurrences) — required systematic canonicalization: every distinct hex/rgba value was collapsed to one token before mapping, including the four-step white-alpha border/glow family used by `.teamCard`/`.formationCard` selection states (`rgba(255,255,255,0.1/0.2/0.45/0.55/0.9)`, now `--color-card-border-struck-out/-idle/-glow-selected/-hover-glow/-selected`), the yellow "no team selected" confirm-button state (`#eab308`, now `--color-confirm-pending-bg`), the green confirm-button hover (`#16a34a`, now `--color-success-hover`), and the jersey-toggle's `#555` border (now `--color-border-subtle`). `UniformSelectionScreen.tsx` was not touched — its jersey-preview palette literals are explicitly out of scope per the plan.

**Task 3 — LineupAssignmentScreen.** All chrome literals migrated, including the tier-badge purple (`#a855f7` -> `var(--color-accent-purple)`, line ~329) and tier-border green (`#22c55e` -> `var(--color-success)`, line ~341) called out in the plan. The stat-tier badge colors (`#22c55e`/`#f97316`/`#ef4444` for high/mid/low) map to `--color-success`/`--color-stat-badge-medium`/`--color-danger` respectively — the medium-tier badge reuses the exact token 33-01 already added for GameBoard's stat-bubble-yellow, confirming that token's value was correctly generalized. The drag-and-drop drop-target's gold glow (`rgba(245,197,24,0.3)`) got a new `--color-accent-gold-glow` token since no existing token expressed that alpha variant of gold.

## Token Additions (Rule 3 Deviation)

18 new tokens added to `tokens.css`, all frozen to their prior literal values (zero visual change):

- `--color-success-hover: #16a34a` (green CTA hover state, used by 3 different confirm buttons across files)
- `--color-accent-gold-glow: rgba(245, 197, 24, 0.3)` (drop-target glow)
- `--color-confirm-pending-bg: #eab308` (yellow "action needed" confirm button)
- `--color-border-subtle: #555555` (jersey-toggle border)
- `--color-card-border-idle/-hover-glow/-selected/-glow-selected/-struck-out` (5 tokens — white-alpha team/formation selection-card family)
- `--color-speed-slow/-slow-active/-slow-bg`, `--color-speed-standard/-standard-active/-standard-bg`, `--color-speed-fast/-fast-active/-fast-bg` (9 tokens — game-speed picker, duplicated verbatim across 3 files prior to this migration)

## Verification

- `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(' <all 5 target .module.css files>` — zero hits (individually and combined).
- `pnpm --filter @counter-attack/client test -- LobbyScreen GameSettingsScreen` — 15/15 pass.
- `pnpm --filter @counter-attack/client test -- TeamSelectionScreen UniformSelectionScreen` — 32/32 pass.
- `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen` — 11/11 pass.
- `pnpm --filter @counter-attack/client test` (full suite) — 400/400 pass across 22 files (up from 393 pre-plan per 33-01-SUMMARY.md; no regressions).
- `pnpm --filter @counter-attack/client build` — succeeds.
- `git status --short packages/client/src/components/UniformSelectionScreen.tsx` — no output (file untouched, confirming jersey-preview scope boundary held).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] 18 chrome literals across the five target files had no matching token in tokens.css's existing 18-token list**

- **Found during:** Task 1 (GameSettingsScreen's game-speed picker), continued through Tasks 2-3 (UniformSelectionScreen's selection-card glow family, confirm-button yellow, jersey-toggle border; LineupAssignmentScreen's gold drop-target glow)
- **Issue:** The plan's acceptance criteria requires zero non-comment hex/rgba literals in each target file. Several recurring literal families (the game-speed Slow/Standard/Fast accent set, duplicated identically across GameSettingsScreen/TeamSelectionScreen/UniformSelectionScreen; the white-alpha team/formation selection-card border-glow family; a handful of single-use chrome values) are not part of UI-SPEC section A's 18-token chrome table, so migrating to zero literals was blocked without new tokens to reference — the same situation 33-01 Task 2 encountered and resolved the same way.
- **Fix:** Added 18 new frozen-value tokens to `tokens.css` (full list in "Token Additions" above), documented inline in the file as a Rule 3 deviation distinct from 33-01's additions, and used throughout the five migrated files. No value changes — pure literal centralization.
- **Files modified:** `packages/client/src/styles/tokens.css` (plus the five target files that reference the new tokens)
- **Commits:** 8b86263 (tokens.css extension + Task 1), f7a1a62 (Task 2), 8ee945c (Task 3)

No other deviations. All three tasks completed per the plan's action text; no architectural changes were needed (Rule 4 did not apply). `UniformSelectionScreen.tsx` was not modified, per plan scope.

## Known Stubs

None — no stub patterns introduced by this plan.

## Threat Flags

None — this plan touches only developer-authored chrome-color literals in CSS Modules, matching the plan's own threat model (T-33-05/T-33-06, both `accept`). No new network endpoints, auth paths, file access, or schema changes were introduced.

## Self-Check: PASSED

- FOUND: packages/client/src/styles/tokens.css
- FOUND: packages/client/src/components/LobbyScreen.module.css
- FOUND: packages/client/src/components/GameSettingsScreen.module.css
- FOUND: packages/client/src/components/TeamSelectionScreen.module.css
- FOUND: packages/client/src/components/UniformSelectionScreen.module.css
- FOUND: packages/client/src/components/LineupAssignmentScreen.module.css
- FOUND commit 8b86263 (feat(33-03): migrate Lobby + GameSettings CSS Modules to design tokens)
- FOUND commit f7a1a62 (feat(33-03): migrate TeamSelection + UniformSelection CSS Modules to design tokens)
- FOUND commit 8ee945c (feat(33-03): migrate LineupAssignmentScreen CSS Module to design tokens)
