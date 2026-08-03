---
phase: 33-design-tokens-highlight-standardization
plan: 01
subsystem: client-ui-chrome
tags: [design-tokens, theme, css-variables, gameboard]
dependency-graph:
  requires: []
  provides:
    - 'packages/client/src/styles/tokens.css (chrome design-token layer, 20 CSS custom properties)'
    - 'GameBoard.tsx runtime --team-accent/--home-accent/--away-accent CSS-variable injection pattern'
  affects:
    - 'packages/client/src/main.tsx'
    - 'packages/client/src/components/GameBoard.tsx'
    - 'packages/client/src/components/GameBoard.module.css'
tech-stack:
  added: []
  patterns:
    - 'CSS custom properties as the single chrome-color source of truth (:root block in tokens.css)'
    - "Runtime per-view CSS-variable injection at a component root (style={{'--var': value} as CSSProperties}), read by descendant CSS Modules via var(--var) instead of per-render-site inline style={{color}} threading"
key-files:
  created:
    - packages/client/src/styles/tokens.css
  modified:
    - packages/client/src/main.tsx
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.module.css
    - packages/client/src/components/GameBoard.test.tsx
decisions:
  - "tokens.css values frozen to today's deep-blue theme exactly as specified in UI-SPEC section A (D-06) — Phase 34 will do the palette value swap"
  - "GameBoard root injects three runtime CSS variables (--team-accent, --home-accent, --away-accent) instead of one, because the scoreboard renders both team colors simultaneously and a single --team-accent cannot represent both without changing today's appearance (documented in a GameBoard.tsx code comment)"
  - "GameBoard.module.css .scoreboard border and .overlayCtaButton:hover background — previously a static #1a56b0 literal — now read var(--team-accent), per UI-SPEC's explicit runtime-derivation note that descendant CSS reads border-color: var(--team-accent); this is an intentional, spec-directed use of the dynamic team accent, not a defect"
  - "Rule 3 deviation: added two chrome tokens not in the UI-SPEC's 18-token list (--color-bg-pitch #0a0a0a for .pitchContainer, --color-stat-badge-medium #f97316 for .statBubbleYellow) to satisfy the zero-hex-literal acceptance gate on GameBoard.module.css; values unchanged, so no visual change"
metrics:
  duration: '~20 min'
  completed: 2026-07-25
---

# Phase 33 Plan 01: Design Tokens & Runtime Team-Accent Pattern Summary

Chrome design-token layer (`tokens.css`, 18 frozen deep-blue tokens) created and imported globally; GameBoard migrated to consume tokens and to inject `--team-accent`/`--home-accent`/`--away-accent` as runtime CSS custom properties at its root instead of threading `useTeamAccentColor()` results through per-render-site inline styles.

## What Was Built

**Task 1 — `tokens.css` + global import.** Created `packages/client/src/styles/tokens.css` with a single `:root { ... }` block defining the 18 chrome design tokens listed in UI-SPEC section A: backgrounds (`--color-bg-page`, `--color-bg-surface`, `--color-bg-surface-alt`), borders (`--color-border`, `--color-border-muted`), text (`--color-text-primary/secondary/tertiary/inverse`), `--team-accent` (static `#1a56b0` fallback), `--color-accent-gold`, `--color-success`, CTA-ready/pending base+hover pairs, `--color-danger`, and `--color-accent-purple`. Imported once in `main.tsx` immediately after the existing `./index.css` import. All values are frozen to today's deep-blue theme — no value changes, only centralization.

**Task 2 — GameBoard migration.** Two changes:

1. **Runtime accent injection (THEME-03, D-06).** The GameBoard root `<div className={styles.gameBoard}>` now carries an inline `style` object (typed via `CSSProperties` from `react`) setting `--team-accent` (active team, from `useTeamAccentColor(selectedTeams[activeTeam])`), `--home-accent`, and `--away-accent`. A code comment documents why three variables exist instead of one: the scoreboard shows home and away colors simultaneously, and collapsing to a single `--team-accent` would change today's appearance, which the phase boundary forbids. Score digits (`.scoreNumeral`), the active-team name (`.teamName`), and all four half-time/full-time score numerals (`.halfTimeScore`) now read color via new `accentHome`/`accentAway`/`accentTeam` utility classes instead of per-render `style={{color: homeColor}}` etc. The second-half kick-off team name picks its class at runtime based on `secondHalfKickOffTeam` (still class-driven, not an inline hex value). The now-unused `secondHalfTeamColor` variable was removed.
2. **Inline chrome-literal migration (Pitfall 5).** The connection-status dot now reads `var(--color-cta-ready-bg)` instead of `'#27ae60'`; the FULL_TIME draw-result fallback now reads `'var(--color-text-primary)'` instead of `'#e0e0e0'`.

`GameBoard.module.css` had every remaining chrome hex literal replaced with the matching `var(--token)`: page/surface/surface-alt backgrounds, chrome borders, all four text-grey shades, the gold accent (clock, half-time clock/added-time), CTA button colors, and the stat-bubble green/red grading colors. The `.scoreboard` border and `.overlayCtaButton:hover` background (previously a static `#1a56b0`) now read `var(--team-accent)` per the UI-SPEC's explicit instruction that descendant CSS reads `border-color: var(--team-accent)` — this makes those two chrome elements track the active team's color dynamically, which is an intentional, spec-directed consequence of centralizing that literal into the reusable team-accent token (not an unintended visual regression).

**Task 3 — Runtime accent test.** Added two tests to `GameBoard.test.tsx` that render GameBoard with the seeded mock store (`selectedTeams: { home: 'city', away: 'crew' }`), read the rendered root's inline style via `container.firstChild`, and assert `--team-accent`/`--home-accent`/`--away-accent` equal the corresponding `TEAM_CONFIGS[...].palette.uiColor` values (imported from `@counter-attack/shared`, not hardcoded literals). A second test flips `activeTeam` to `'away'` and confirms `--team-accent` follows the active team while `--home-accent` stays anchored to the home team. No pre-existing GameBoard test asserted a raw chrome hex/rgba literal, so no test-literal migration was required in this file.

## Verification

- `pnpm --filter @counter-attack/client build` — succeeds (both after Task 1 and after Task 2).
- `pnpm --filter @counter-attack/client typecheck` — clean, no errors.
- `pnpm --filter @counter-attack/client test -- GameBoard.test.tsx` — 27/27 tests pass (25 pre-existing + 2 new).
- `pnpm --filter @counter-attack/client test` (full client suite) — 393/393 tests pass across 22 files; no regressions from the token/CSS migration.
- `grep -nE '#[0-9a-fA-F]{3,8}' packages/client/src/components/GameBoard.module.css` — zero non-comment hits (all remaining `#f97316`/`#0a0a0a` hex mentions are inside deviation-documentation comments, not CSS values).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Two GameBoard.module.css chrome literals had no matching token in the UI-SPEC's 18-token list**

- **Found during:** Task 2 (zero-hex-literal acceptance sweep)
- **Issue:** `.pitchContainer`'s `background: #0a0a0a` and `.statBubbleYellow`'s `background: #f97316` are genuine chrome literals in the plan's target file, but neither value appears in UI-SPEC section A's exhaustive 18-token table. Migrating the file to zero raw hex literals (a hard acceptance criterion) was blocked without a token to point at.
- **Fix:** Added two additional CSS custom properties to `tokens.css` — `--color-bg-pitch: #0a0a0a` and `--color-stat-badge-medium: #f97316` — with the exact same frozen values (no visual change), documented inline in both `tokens.css` and `GameBoard.module.css` as a Rule 3 deviation so a future phase doesn't mistake them for UI-SPEC-authored tokens.
- **Files modified:** `packages/client/src/styles/tokens.css`, `packages/client/src/components/GameBoard.module.css`
- **Commit:** 36584f4

**2. [Rule 1 - Bug] `secondHalfTeamColor` became a dead variable after the class-based accent migration**

- **Found during:** Task 2
- **Issue:** Converting the half-time second-half-team-name color from an inline `style={{color: secondHalfTeamColor}}` to a runtime class selection (`accentHome`/`accentAway` picked by `secondHalfKickOffTeam`) left the `secondHalfTeamColor` hook-derived variable with no remaining call site.
- **Fix:** Removed the now-unused `const secondHalfTeamColor = useTeamAccentColor(...)` declaration.
- **Files modified:** `packages/client/src/components/GameBoard.tsx`
- **Commit:** 36584f4

No other deviations. All three tasks completed per the plan's action text; no architectural changes were needed (Rule 4 did not apply).

## Known Stubs

None — no stub patterns introduced by this plan.

## Threat Flags

None — this plan touches only developer-authored chrome-color literals and the closed `TeamId` enum via `TEAM_CONFIGS`, matching the plan's own threat model (T-33-01/T-33-02, both `accept`). No new network endpoints, auth paths, file access, or schema changes were introduced.

## Self-Check: PASSED

- FOUND: packages/client/src/styles/tokens.css
- FOUND: packages/client/src/main.tsx (import './styles/tokens.css';)
- FOUND: packages/client/src/components/GameBoard.tsx
- FOUND: packages/client/src/components/GameBoard.module.css
- FOUND: packages/client/src/components/GameBoard.test.tsx
- FOUND commit 45deec4 (feat(33-01): create chrome design-token layer and import globally)
- FOUND commit 36584f4 (feat(33-01): migrate GameBoard chrome to tokens, inject runtime accent vars)
- FOUND commit d63426b (test(33-01): assert --team-accent/--home-accent/--away-accent derive from TEAM_CONFIGS)
