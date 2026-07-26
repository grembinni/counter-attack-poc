# Phase 34: Visual Theme Restyle - Research

**Researched:** 2026-07-26
**Domain:** CSS custom-property theming, stylelint tooling, WCAG contrast math
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** No specific real-world broadcast-sports reference was provided — Claude has full discretion to select exact charcoal/graphite tones. Aim for a neutral, true-charcoal broadcast look (e.g. modern ESPN dark mode, FIFA/EA Sports overlay style) with **no blue tint carried over** from the old `#1a1a2e`/`#16213e`/`#0f3460` theme — this is a hard constraint, not just a preference, since carrying blue forward would fail success criterion #1 ("no remaining deep-blue theme surfaces anywhere").
- **D-02:** Preserve the existing **3-tier surface depth structure** (`--color-bg-page` darkest → `--color-bg-surface` → `--color-bg-surface-alt` lightest-of-the-three) — just recolor each tier to a charcoal/graphite value. Do not flatten to 2 tiers.
- **D-03:** Several team `uiColor` values in `packages/shared/src/teamConfig.ts` are very light and will likely fail WCAG AA against the new charcoal/white base. Where a team's accent fails, **auto-adjust (darken/lighten) just that color** until it clears AA — apply this per-team, not uniformly to every team's color. Passing colors are left untouched; only the colors that actually fail get adjusted. Must be verifiable by the automated contrast-check script required by ROADMAP success criterion #3.
- **D-04:** The contrast adjustment happens in a **new derivation layer only** — at the point where the CSS runtime `--team-accent` variable is derived from `TEAM_CONFIGS[activeTeam].palette.uiColor` (the existing Phase 33/THEME-03 mechanism). `TEAM_CONFIGS.uiColor` itself in `packages/shared/src/teamConfig.ts` stays **unchanged** — it's the raw brand color, still used as-is for other UI purposes (e.g. scoreboard/action-log team-name coloring) that aren't covered by THEME-04's contrast requirement. Only the theme-accent derivation point gets the AA-safe adjusted value.
- **D-05:** CTA-ready (`--color-cta-ready-bg` #27ae60), CTA-pending (`--color-cta-pending-bg` #f39c12), danger (`--color-danger` #ef4444), and success (`--color-success` #22c55e) stay **exactly as-is** — semantic/functional state colors, not part of the deep-blue → charcoal chrome swap. No retuning.

### Claude's Discretion

- Exact hex values for all charcoal/graphite tiers and white text tones (D-01/D-02) — no reference image provided; pick within the "neutral true-charcoal, no blue tint" constraint.
- Exact per-team contrast-adjustment algorithm/amount for failing team colors (D-03) — e.g. HSL lightness reduction step size — as long as the automated contrast-check script (success criterion #3) confirms AA pass for every team afterward.
- Where exactly the new derivation layer (D-04) lives in code (CSS `color-mix()`, a build-time script, a small TS utility feeding a runtime style property, etc.) — implementation detail for planning/research. **Research finding: recommend `packages/client/src/hooks/useTeamColors.ts`, see Architecture Patterns.**
- Stylelint rule configuration and scope for the "zero hardcoded hex/rgba" gate (success criterion #2), and which now-unreferenced CSS classes get removed as part of the sweep. **Research finding: no unreferenced-literal cleanup is actually needed — see Summary.**

### Deferred Ideas (OUT OF SCOPE)

- **Loose-ball pathing on a blocked shot should path from the blocking square, not the shooting square** — a gameplay-logic bug, unrelated to chrome-color theming. Not part of Phase 34 scope. Recommend logging as a new backlog bug for a future phase or quick-task.
- **Undo should not be allowed to progress earlier than a dice-roll-triggering action (tackle/steal) within a move** — an undo-boundary/state-management bug, unrelated to chrome-color theming. Not part of Phase 34 scope. Recommend logging as a new backlog bug for a future phase or quick-task.
- Hex-highlight/piece-ring color system (`HexCell.tsx`/`PieceOverlay.tsx`) — already standardized in Phase 33 (HILITE-01..05) — explicitly out of scope for this phase.
- ActionPanel/ActionLog visual standardization — Phase 35, not this phase.
- RESP-01..09 response-move activation logic — deferred for all of v1.5, unrelated.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                                                                                                                                                 | Research Support                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| THEME-01 | The deep-blue color scheme is replaced with a broadcast-sports palette (dark charcoal/graphite base, crisp white text, single team-color accent) applied across every screen — lobby, settings, team/draft selection, and the in-game board | `tokens.css` full current-value inventory (Summary, Architecture Patterns) confirms the 3-tier bg structure + text tokens to recolor; identified `--color-text-tertiary: #808090` as containing a residual blue-purple tint that must be neutralized to satisfy D-01's hard "no blue tint" constraint; confirmed lobby/settings screens never receive a runtime `--team-accent` override (no team selected yet) and rely solely on the static `tokens.css` fallback value, and that `TeamSelectionScreen.tsx`'s per-card team swatches are a separate raw-inline-style mechanism outside the token/CSS-var system entirely |
| THEME-02 | All chrome colors (panels, buttons, borders, text) are driven by a single CSS custom-property token file; no hardcoded hex/rgba literals remain in chrome-related CSS Modules                                                               | Verified via direct grep of all 17 chrome `.module.css` files: **zero existing hardcoded hex/rgba literals** (only 2 comment references) — the stylelint gate can be added at strict settings immediately, no fixup sweep required. Stylelint + `stylelint-declaration-strict-value` + `function-disallowed-list` config provided (Standard Stack, Architecture Patterns Pattern 2), including the verified `rgba()`-bypass pitfall and its fix (Pitfall 1)                                                                                                                                                                |
| THEME-04 | All team-accent colors pass WCAG AA contrast against the new charcoal/white base, verified via an automated contrast check                                                                                                                  | Exact derivation hook point identified (`useTeamAccentColor()` in `useTeamColors.ts`, called only from `GameBoard.tsx`); `wcag-contrast` library selected and verified; concrete contrast-ratio computation this session shows most of the 12 active `TEAM_CONFIGS` teams need adjustment under realistic charcoal values in at least one of two real usage directions (Common Pitfalls #3); CI script pattern that imports the exact runtime derivation function (Don't Hand-Roll) to avoid runtime/CI drift                                                                                                              |

</phase_requirements>

## Summary

This phase is a pure token-value substitution plus two brand-new CI gates (stylelint, contrast-check) — there is no structural refactor. Phase 33 already migrated all 17 chrome `.module.css` files to `var(--token)`; direct code inspection confirms **zero remaining hardcoded hex/rgba literals** in any of those files today (only two comment references in `GameBoard.module.css`, which stylelint's AST-based parser will not flag). This means the "stylelint gate must catch pre-existing violations" risk called out in CONTEXT.md does not materialize — the gate can be added directly at strict settings with no fixup pass required.

The `--team-accent` derivation point (D-04) is precisely located: `packages/client/src/hooks/useTeamColors.ts` exports `teamAccentColor()` (pure) and `useTeamAccentColor()` (hook wrapper), both returning the raw `TEAM_CONFIGS[teamId].palette.uiColor`. `GameBoard.tsx` (lines 180-228) is the **only** call site that feeds this into CSS custom properties (`--team-accent`, `--home-accent`, `--away-accent`) via an inline `style` object on the board's root `<div>`. `ActionLog.tsx` also calls the same pure `teamAccentColor()` function, but only to compute inline JS `style={{color: ...}}` values for log-entry text prefixes — never through a CSS var. This is the exact seam the phase needs: a new AA-derivation function must intercept **only** the `useTeamAccentColor()` calls in `GameBoard.tsx`, leaving `ActionLog.tsx`'s raw-color usage untouched, matching D-04's "other UI purposes... not covered by THEME-04" carve-out.

A concrete contrast-math check (run this session, see Common Pitfalls) shows that under a realistic charcoal/white base, **most of the 12 active `TEAM_CONFIGS` teams fail AA in at least one of the two real usage directions** (`--team-accent` used as small 11px text color, and used as a background with white text on top) — not just the two examples CONTEXT.md called out. The planner should budget the auto-adjustment algorithm as the norm, not an edge case, and must decide whether to check one direction or both (recommendation: both, since both are live, real usage patterns in the current code).

**Primary recommendation:** Swap only `tokens.css` values (backgrounds/borders/text/team-accent-fallback; leave CTA/status/danger/success untouched per D-05); add `stylelint` + `stylelint-declaration-strict-value` scoped to `packages/client/src/**/*.module.css` with a supplementary `function-disallowed-list: ['rgb','rgba','hsl','hsla']` rule (the strict-value plugin does **not** catch `rgba()` literals by default — verified via upstream GitHub issue, see Pitfalls); add a `wcag-contrast`-backed AA-derivation function co-located with `useTeamAccentColor()` in `packages/client/src/hooks/useTeamColors.ts`, and a CI script that imports that exact same function (not a re-implementation) to verify all 12 teams pass.

## Token Inventory (Ground Truth)

`packages/client/src/styles/tokens.css` currently defines **43 custom properties** [VERIFIED: repo, `grep -c '^\s*--'`] — CONTEXT.md's "~35 tokens" estimate undercounts by 8 once the three "Extended chrome tokens" blocks (speed-picker family, card-border family, overlay-backdrop family) are included. Full inventory with disposition:

| Token                                        | Current Value                                   | Disposition                                             | Notes                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--color-bg-page`                            | `#1a1a2e`                                       | **CHANGES** (D-02, darkest tier)                        |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-bg-surface`                         | `#16213e`                                       | **CHANGES** (D-02, mid tier)                            |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-bg-surface-alt`                     | `#0f3460`                                       | **CHANGES** (D-02, lightest-of-3 tier)                  |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-border`                             | `#0f3460`                                       | **CHANGES**                                             | Currently reuses `--color-bg-surface-alt`'s value verbatim (see tokens.css comment at line 90) — preserve that reuse pattern with the new value, don't diverge                                                                                                                                                                                                                                      |
| `--color-border-muted`                       | `#a0a0a0`                                       | Likely unchanged                                        | Already neutral gray, no blue channel bias — re-verify against new bg tiers for sufficient contrast, but no re-hue needed                                                                                                                                                                                                                                                                           |
| `--color-text-primary`                       | `#e0e0e0`                                       | Review                                                  | Off-white gray; success criterion #1 says "crisp white text" — may need brightening toward pure white, or may already read as "white enough" against a dark charcoal bg. Planner should decide exact value.                                                                                                                                                                                         |
| `--color-text-secondary`                     | `#a0a0a0`                                       | Likely unchanged                                        | Neutral gray, no blue tint                                                                                                                                                                                                                                                                                                                                                                          |
| `--color-text-tertiary`                      | `#808090`                                       | **CHANGES**                                             | Contains a residual blue-purple channel bias (`0x90` blue vs `0x80` red/green) — technically violates D-01's hard "no blue tint" constraint even though it reads as gray at a glance. Recommend neutralizing to e.g. `#808080`.                                                                                                                                                                     |
| `--color-text-inverse`                       | `#ffffff`                                       | Unchanged                                               | Already pure white                                                                                                                                                                                                                                                                                                                                                                                  |
| `--team-accent`                              | `#1a56b0`                                       | **CHANGES**                                             | Static pre-team-select fallback (only ever visible on Lobby/Settings screens, since `GameBoard.tsx` is the only runtime override and it doesn't mount until a match starts) — currently a saturated blue, must become theme-neutral. Runtime-derived value is separately handled by D-04's new derivation layer.                                                                                    |
| `--color-accent-gold`                        | `#f5c518`                                       | Ambiguous — not named in D-05                           | Not one of D-05's 4 explicitly-preserved functional colors; also not a "themed chrome" background/border/text token. Flag for planner/discuss-phase: likely stays (it's a functional/decorative gold accent, not deep-blue-theme-derived), but not formally locked by CONTEXT.md.                                                                                                                   |
| `--color-success`                            | `#22c55e`                                       | **Unchanged** (D-05)                                    |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-cta-ready-bg`                       | `#27ae60`                                       | **Unchanged** (D-05)                                    |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-cta-ready-bg-hover`                 | `#219a52`                                       | Unchanged (implied)                                     | Hover variant of a D-05-locked token; not independently named but logically follows the same lock                                                                                                                                                                                                                                                                                                   |
| `--color-cta-pending-bg`                     | `#f39c12`                                       | **Unchanged** (D-05)                                    |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-cta-pending-bg-hover`               | `#e67e22`                                       | Unchanged (implied)                                     | Hover variant, same reasoning as above                                                                                                                                                                                                                                                                                                                                                              |
| `--color-danger`                             | `#ef4444`                                       | **Unchanged** (D-05)                                    |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-accent-purple`                      | `#a855f7`                                       | Ambiguous — not named in D-05                           | Same status as `--color-accent-gold`                                                                                                                                                                                                                                                                                                                                                                |
| `--color-bg-pitch`                           | `#0a0a0a`                                       | Likely unchanged                                        | Already neutral near-black with no blue bias; this is the hex-grid pitch container background, arguably outside "chrome" scope entirely                                                                                                                                                                                                                                                             |
| `--color-stat-badge-medium`                  | `#f97316`                                       | Ambiguous — not named in D-05                           | Functional/status-adjacent (stat badge), same family as `--color-speed-fast`                                                                                                                                                                                                                                                                                                                        |
| `--color-overlay-backdrop`                   | `rgba(0,0,0,0.6)`                               | Likely unchanged                                        | Neutral black scrim, no blue bias                                                                                                                                                                                                                                                                                                                                                                   |
| `--color-banner-backdrop`                    | `rgba(0,0,0,0.75)`                              | Likely unchanged                                        | Neutral black scrim, no blue bias                                                                                                                                                                                                                                                                                                                                                                   |
| `--color-success-hover`                      | `#16a34a`                                       | Unchanged (implied)                                     | Hover variant of success family                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-accent-gold-glow`                   | `rgba(245,197,24,0.3)`                          | Ambiguous — tied to `--color-accent-gold`'s disposition |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-confirm-pending-bg`                 | `#eab308`                                       | Ambiguous — not named in D-05                           | Another yellow/gold-family functional color                                                                                                                                                                                                                                                                                                                                                         |
| `--color-border-subtle`                      | `#555555`                                       | Likely unchanged                                        | Already neutral gray                                                                                                                                                                                                                                                                                                                                                                                |
| `--color-card-border-idle`                   | `rgba(255,255,255,0.2)`                         | Unchanged                                               | White-alpha, theme-neutral                                                                                                                                                                                                                                                                                                                                                                          |
| `--color-card-border-hover-glow`             | `rgba(255,255,255,0.55)`                        | Unchanged                                               |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-card-border-selected`               | `rgba(255,255,255,0.9)`                         | Unchanged                                               |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-card-glow-selected`                 | `rgba(255,255,255,0.45)`                        | Unchanged                                               |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-card-border-struck-out`             | `rgba(255,255,255,0.1)`                         | Unchanged                                               |                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--color-speed-slow` / `-active` / `-bg`     | `#3b82f6` / `#93c5fd` / `rgba(59,130,246,0.15)` | **Not part of the chrome swap**                         | This IS a saturated blue family, but it's the semantic Slow/Standard/Fast speed-picker indicator (unrelated to the retired `#1a1a2e`/`#16213e`/`#0f3460` chrome theme). D-01's "no blue tint" constraint targets the _chrome background_ theme specifically, not every blue pixel in the app. Flag explicitly so the planner/executor doesn't over-scope and accidentally repaint the speed picker. |
| `--color-speed-standard` / `-active` / `-bg` | `#22c55e` family                                | Unchanged                                               | Duplicates `--color-success`'s swatch by design (documented in tokens.css comment)                                                                                                                                                                                                                                                                                                                  |
| `--color-speed-fast` / `-active` / `-bg`     | `#f97316` family                                | Unchanged                                               | Duplicates `--color-stat-badge-medium`'s swatch by design                                                                                                                                                                                                                                                                                                                                           |
| `--color-divider-subtle`                     | `rgba(255,255,255,0.1)`                         | Unchanged                                               | White-alpha, theme-neutral                                                                                                                                                                                                                                                                                                                                                                          |

**Net scope for the actual value swap:** 4 background/border tokens (`--color-bg-page`, `--color-bg-surface`, `--color-bg-surface-alt`, `--color-border`) + 1 text token (`--color-text-tertiary`, blue-tint fix) + review of `--color-text-primary` + `--team-accent`'s static fallback. Everything else is either explicitly locked (D-05, 6 tokens + 2 implied hover variants), already theme-neutral (14 gray/white/black tokens), or a functional-color family outside the "themed chrome" definition (gold/purple/speed-picker families, 12 tokens) — flag these ambiguous ones for a quick planner/discuss-phase confirmation rather than silently deciding either way.

## Architectural Responsibility Map

| Capability                                          | Primary Tier          | Secondary Tier                 | Rationale                                                                                                                                                                          |
| --------------------------------------------------- | --------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome color values (backgrounds/borders/text)      | Frontend Client (CSS) | —                              | Static `:root` custom properties in `tokens.css`; no server involvement                                                                                                            |
| Team-accent AA derivation                           | Frontend Client (TS)  | —                              | Pure function co-located with the existing `useTeamAccentColor()` hook; runs in-browser at render time, no server round-trip needed since `TEAM_CONFIGS` is a static shared import |
| Stylelint gate (zero hardcoded literal enforcement) | Build/CI tooling      | —                              | Static analysis over `.module.css` source files; runs in CI, not runtime                                                                                                           |
| Contrast-check gate (AA verification)               | Build/CI tooling      | Frontend Client (shared logic) | Node/TS script in CI that imports the _same_ derivation function the browser runtime uses — must not duplicate the algorithm                                                       |

## Standard Stack

### Core

| Library                              | Version                          | Purpose                                                                                      | Why Standard                                                                                                                                                                     |
| ------------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stylelint`                          | 17.14.1 [VERIFIED: npm registry] | CSS linter engine                                                                            | De facto standard CSS linter; only viable option for a "zero hardcoded hex/rgba" automated gate                                                                                  |
| `stylelint-declaration-strict-value` | 1.11.1 [VERIFIED: npm registry]  | Enforces `var()`/function/allowed-keyword instead of raw literal values for named properties | 488K weekly downloads; the standard plugin for exactly this "no magic literal color values" pattern — CONTEXT.md's own suggestion, confirmed still maintained                    |
| `stylelint-config-standard`          | current [VERIFIED: npm registry] | Baseline stylelint ruleset (formatting/syntax sanity)                                        | Standard companion config; keeps the custom rule from being the _only_ rule active, catches malformed CSS too                                                                    |
| `wcag-contrast`                      | 3.0.0 [VERIFIED: npm registry]   | Relative-luminance + contrast-ratio math per WCAG 2.x formula                                | Small (~132 dependents), zero-dependency, does exactly the W3C-specified luminance/contrast formula — avoids hand-rolling a formula with subtle off-by-one/gamma-correction bugs |
| `@types/wcag-contrast`               | 3.0.3 [VERIFIED: npm registry]   | TypeScript type declarations for `wcag-contrast`                                             | Package ships no bundled types (`main`/`module` fields only, no `types` field)                                                                                                   |

### Supporting

| Library | Version                                                                    | Purpose                                      | When to Use                                                                                                                      |
| ------- | -------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `tsx`   | 4.22.3 (already in repo — `packages/shared/package.json`) [VERIFIED: repo] | Run TS scripts directly without a build step | For the CI contrast-check script, following the exact `packages/shared/scripts/seed-rosters.ts` precedent (`tsx scripts/foo.ts`) |

### Alternatives Considered

| Instead of                           | Could Use                                                            | Tradeoff                                                                                                                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stylelint-declaration-strict-value` | Hand-rolled regex grep in a shell script                             | Regex over CSS text is fragile (misses `url()` false positives, multi-line values, comments); stylelint's AST-based parser is authoritative and integrates with existing lint tooling                                       |
| `wcag-contrast`                      | Hand-rolled relative-luminance calculation                           | The WCAG formula (sRGB gamma correction + weighted RGB sum) is easy to get subtly wrong (wrong gamma threshold constant, wrong D65 weights); a 132-project-depended-upon micro-library removes that risk for near-zero cost |
| `wcag-contrast`                      | `color-contrast-checker` or `get-contrast-ratio` (other search hits) | `wcag-contrast` has the simplest API surface (`hex()`, `score()`) and is what CONTEXT.md itself suggested; no reason to prefer the alternatives                                                                             |

**Installation:**

```bash
# Root devDependencies (stylelint + plugin + config)
pnpm add -D -w stylelint stylelint-declaration-strict-value stylelint-config-standard

# Client dependencies (runtime AA-derivation) + devDependencies (CI script tooling)
pnpm --filter @counter-attack/client add wcag-contrast
pnpm --filter @counter-attack/client add -D @types/wcag-contrast tsx
```

**Version verification:** Confirmed via `npm view <pkg> version` this session (2026-07-26): `stylelint@17.14.1`, `stylelint-declaration-strict-value@1.11.1`, `wcag-contrast@3.0.0`, `@types/wcag-contrast@3.0.3`. `stylelint` 17.x requires **Node ≥20.19** and is **ESM-only** (no CommonJS config support) [CITED: stylelint.io/migration-guide/to-17]. This repo is already on Node 22 LTS (per CLAUDE.md) with root `package.json` `"type": "module"` — both prerequisites already satisfied; use `stylelint.config.js` with `export default`.

## Package Legitimacy Audit

| Package                              | Registry | Age signal                                                                                                    | Downloads | Source Repo                                           | Verdict         | Disposition                                                                                                                                                                                                              |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stylelint`                          | npm      | Latest version published 2026-07-20 (project itself is a long-established, top-tier tool)                     | 10.08M/wk | github.com/stylelint/stylelint                        | SUS ("too-new") | **Approved** — false positive; the "too-new" signal is based on _latest version_ publish date, not package age. 10M+ weekly downloads is conclusive evidence of legitimacy. No checkpoint needed but noted per protocol. |
| `stylelint-declaration-strict-value` | npm      | Latest version 2026-02-24                                                                                     | 488K/wk   | github.com/AndyOGo/stylelint-declaration-strict-value | OK              | Approved                                                                                                                                                                                                                 |
| `stylelint-config-standard`          | npm      | Latest version 2026-01-15                                                                                     | 6.37M/wk  | github.com/stylelint/stylelint-config-standard        | OK              | Approved                                                                                                                                                                                                                 |
| `wcag-contrast`                      | npm      | Latest version 2019-11-05 (mature, stable)                                                                    | 116K/wk   | github.com/tmcw/wcag-contrast                         | OK              | Approved                                                                                                                                                                                                                 |
| `@types/wcag-contrast`               | npm      | 2023-11-07                                                                                                    | 35K/wk    | github.com/DefinitelyTyped/DefinitelyTyped            | OK              | Approved                                                                                                                                                                                                                 |
| `tsx`                                | npm      | Latest version published 2026-07-13 (already a real dependency of this repo — `packages/shared/package.json`) | 82.6M/wk  | github.com/privatenumber/tsx                          | SUS ("too-new") | **Approved** — false positive, same pattern as `stylelint`; already vetted and in production use elsewhere in this monorepo.                                                                                             |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `stylelint`, `tsx` — both flagged solely on the seam's "too-new" heuristic (which reads latest-version publish date, not first-publish/package-age), both have massive weekly download counts (10M+ and 82M+ respectively) that conclusively rule out a hallucinated/slopsquatted package. Recommend the planner still add a lightweight `checkpoint:human-verify` before the `pnpm add` step per protocol, but treat this as a formality — no further investigation needed given the download-count evidence gathered in this research session.

_No packages in this phase were discovered via WebSearch/training-data alone without registry+download-count cross-check — all six were verified via `npm view` this session._

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ packages/shared/src/teamConfig.ts                                │
│   TEAM_CONFIGS[teamId].palette.uiColor  (raw brand hex, UNCHANGED)│
└───────────────────────────┬───────────────────────────────────────┘
                             │ imported by
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ packages/client/src/hooks/useTeamColors.ts                       │
│                                                                    │
│  teamAccentColor(teamId) ──────────► raw uiColor (unchanged)      │
│       │                                       │                   │
│       │ used directly by                      │ NEW: wrapped by   │
│       ▼                                       ▼                   │
│  ActionLog.tsx                    deriveAaAccentColor(uiColor,    │
│  (inline style={{color}},              bgPage, textInverse)       │
│   log-entry text prefixes —                   │                   │
│   OUT of THEME-04 scope, D-04)                ▼                   │
│                                    useTeamAccentColorAA(teamId)    │
│                                    (NEW hook — wraps the above)    │
└─────────────────────────────────────────────┬─────────────────────┘
                                                │ used by
                                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ packages/client/src/components/GameBoard.tsx  (lines 180-228)     │
│                                                                     │
│   homeColor = useTeamAccentColorAA(selectedTeams['home'])          │
│   awayColor = useTeamAccentColorAA(selectedTeams['away'])          │
│   teamColor = useTeamAccentColorAA(selectedTeams[activeTeam])      │
│                                                                     │
│   rootStyle = {                                                    │
│     '--team-accent': teamColor,                                    │
│     '--home-accent': homeColor,                                    │
│     '--away-accent': awayColor,                                    │
│   }                                                                 │
│   <div style={rootStyle}>...</div>  ◄── injected once at board root│
└───────────────────────────┬─────────────────────────────────────┘
                             │ consumed via var() by
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ 17 chrome .module.css files (ActionPanel, GameBoard,               │
│ GameSettingsScreen, LobbyScreen, KickOffSetupPanel,                 │
│ FreeKickSetupPanel, ReplayPanel, ...)                               │
│   background: var(--team-accent);  color: var(--team-accent); etc. │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CI: check-contrast.ts (NEW, tsx-run script)                       │
│   imports deriveAaAccentColor from useTeamColors.ts (SAME fn)      │
│   for each of 12 TEAM_CONFIGS teams:                               │
│     assert AA(derived, bgPage) >= 4.5  AND  AA(derived,white) >= 4.5│
│   exits non-zero on any failure  →  wired into .github/ci.yml       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CI: stylelint (NEW)                                                │
│   scans packages/client/src/**/*.module.css                        │
│   scale-unlimited/declaration-strict-value: flags raw hex           │
│   function-disallowed-list: flags rgb()/rgba()/hsl()/hsla()         │
│   → wired into .github/ci.yml, mirrors the pnpm knip step pattern   │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
packages/client/
├── src/
│   ├── styles/
│   │   └── tokens.css              # values swapped (D-01/D-02); structure unchanged
│   ├── hooks/
│   │   ├── useTeamColors.ts        # ADD: deriveAaAccentColor() + useTeamAccentColorAA()
│   │   └── useTeamColors.test.ts   # ADD: unit tests for the new derivation function
│   └── components/                 # 17 .module.css files — VALUES untouched (already var()-only)
├── scripts/
│   └── check-contrast.ts           # NEW — tsx-run CI script, imports deriveAaAccentColor
stylelint.config.js                 # NEW — root-level, ESM export default
.github/workflows/ci.yml            # ADD: pnpm stylelint + pnpm check-contrast steps
knip.json                           # UPDATE: add packages/client scripts glob + entry (Pitfall)
```

### Pattern 1: Single derivation function, two call sites

**What:** Add exactly one new pure function that wraps the existing `teamAccentColor()` with an AA-safety pass, and a hook wrapper for component use — do not touch the existing `teamAccentColor()`/`useTeamAccentColor()` signatures, since `ActionLog.tsx` depends on their current raw-passthrough behavior.
**When to use:** This phase, for the `--team-accent`/`--home-accent`/`--away-accent` CSS-var injection point in `GameBoard.tsx` only.
**Example:**

```typescript
// packages/client/src/hooks/useTeamColors.ts (extension, not replacement)
import { hex as contrastHex } from 'wcag-contrast';

const AA_MIN_RATIO = 4.5; // WCAG 2.x SC 1.4.3, normal text (project's --team-accent
// renders as 11px text in some usages — see ActionPanel.module.css)

/** D-04: AA-safety derivation layer. TEAM_CONFIGS.uiColor itself is never mutated;
 *  this returns an adjusted color ONLY for CSS-custom-property theme-accent usage.
 *  bgHex/fgHex are the two real rendering contexts (--color-bg-page as text-on-charcoal,
 *  --color-text-inverse as white-text-on-accent-background). */
export function deriveAaAccentColor(uiColor: string, bgHex: string, fgHex: string): string {
  if (contrastHex(uiColor, bgHex) >= AA_MIN_RATIO && contrastHex(uiColor, fgHex) >= AA_MIN_RATIO) {
    return uiColor; // already passes both directions — no adjustment (D-03: only failing colors change)
  }
  return searchAaSafeLightness(uiColor, bgHex, fgHex); // HSL lightness step-search, see Pitfall 3
}

export function useTeamAccentColorAA(teamId: TeamId | undefined): string {
  const raw = teamAccentColor(teamId);
  return deriveAaAccentColor(raw, '#<bgPageValue>', '#<textInverseValue>');
}
```

### Pattern 2: Stylelint scoped rule for token-only chrome colors

**What:** Enforce `var()` (or an explicit allow-listed keyword) for all color-bearing properties in chrome `.module.css` files.
**When to use:** All 17 files under `packages/client/src/**/*.module.css` — `HexCell.module.css`/`HexGrid.module.css` are effectively empty of color rules already (verified: 1 and 5 lines respectively, no color declarations), so scoping to the whole glob is safe and requires no per-file exclusion list.
**Example:**

```javascript
// Source: github.com/AndyOGo/stylelint-declaration-strict-value README
// stylelint.config.js
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    'scale-unlimited/declaration-strict-value': [
      ['/color$/', 'background', 'background-color', 'border-color', 'border', 'fill', 'stroke'],
      { ignoreValues: ['transparent', 'inherit', 'currentColor', 'none'] },
    ],
    // Required supplement — see Common Pitfalls #2: the rule above does NOT
    // catch rgb()/rgba()/hsl()/hsla() literals by default.
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
  },
};
```

### Anti-Patterns to Avoid

- **Re-implementing the contrast formula in the CI script instead of importing the runtime function:** guarantees drift between what the browser renders and what CI verifies. The check-contrast script must `import { deriveAaAccentColor } from '../src/hooks/useTeamColors.js'` — never a parallel copy.
- **Routing `TeamSelectionScreen.tsx`'s per-card team swatches through the new AA-derivation layer:** those use `TEAM_CONFIGS[teamId].palette.homePrime` via **inline `style={{}}`** (not `--team-accent`/CSS), are intentionally multi-colored per-card brand swatches (not the "single accent" concept THEME-03/04 describe), and are outside stylelint's CSS-file scope entirely. Confirmed via code read: `TeamSelectionScreen.tsx` lines 162-164.
- **Setting `ignoreFunctions: false` globally in the strict-value rule to catch `rgba()`:** this would also flag legitimate function usage like `var(--token)` wrapped in `color-mix()` (a plausible D-04 implementation option) or `calc()`. Use the targeted `function-disallowed-list` rule instead (Pattern 2).

## Don't Hand-Roll

| Problem                                                                       | Don't Build                                                | Use Instead                                                                     | Why                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WCAG relative luminance / contrast ratio math                                 | A custom `luminance()`/`contrastRatio()` function          | `wcag-contrast` (`hex()`, `score()`)                                            | The sRGB gamma-correction formula (0.03928 threshold, 2.4 exponent, 0.2126/0.7152/0.0722 weights) is easy to get subtly wrong; a well-established micro-library removes that entire class of bug for ~1KB |
| "Is this color AA-safe" duplicated in two places (browser runtime + CI check) | Two independent implementations that are expected to agree | One pure function, imported by both                                             | If the CI script and the runtime hook diverge even slightly (e.g. different threshold constant), CI can pass while the actual rendered UI still fails AA — silent regression                              |
| Detecting raw hex/rgba literals in CSS via regex/grep                         | A custom text-scanning script                              | `stylelint` + `stylelint-declaration-strict-value` + `function-disallowed-list` | AST-based CSS parsing correctly ignores comments, handles multi-value shorthand, and doesn't false-positive on `url()` or numeric non-color values the way naive regex does                               |

**Key insight:** Both new tools in this phase (stylelint gate, contrast gate) are solving "detect a value pattern reliably across many files" — exactly the class of problem where hand-rolled string matching silently misses edge cases (multi-line CSS, `rgba()` inside `box-shadow` shorthand, gamma-correction math) that a maintained library/linter already handles.

## Common Pitfalls

### Pitfall 1: `stylelint-declaration-strict-value` does not catch `rgba()`/`rgb()`/`hsl()`/`hsla()` by default

**What goes wrong:** With the plugin's default `ignoreFunctions: true`, function-call color values (`rgba(0,0,0,0.6)`) pass silently even though they are exactly the "hardcoded rgba literal" success criterion #2 is meant to catch — because the plugin treats _any_ function call as satisfying the "must use a variable, function, or allowed keyword" rule, not just `var()`.
**Why it happens:** The plugin's design goal is broader than pure token-enforcement (it also supports Sass/Less function patterns); `ignoreFunctions: true` is its default because most consumers _want_ functions like `calc()`/`darken()` to pass.
**How to avoid:** Add a second, narrow rule — stylelint's built-in `function-disallowed-list: ['rgb', 'rgba', 'hsl', 'hsla']` — as a belt-and-suspenders catch. This still allows `var()`, `calc()`, `color-mix()`, etc.
**Warning signs:** A stylelint run reports 0 violations, but `git grep -n "rgba(" packages/client/src/**/*.module.css` (outside comments) finds literal matches.
**Source:** [CITED: github.com/AndyOGo/stylelint-declaration-strict-value/issues/325 — "No validation when rgb/rgba/hsl colors are used"]

### Pitfall 2: `color-no-hex` (and most other "disallow raw value" stylistic rules) no longer exist in stylelint 17

**What goes wrong:** Following older tutorials/blog posts that reference `color-no-hex` as a supplementary rule will fail — stylelint deprecated it in v15 and removed it in v16.
**Why it happens:** Stylelint's v15→v16 migration removed most purely-stylistic "disallow raw value" rules in favor of Prettier-style formatters, keeping only rules with a genuine correctness/consistency purpose.
**How to avoid:** Rely on `scale-unlimited/declaration-strict-value` (from the plugin) + `function-disallowed-list` (core rule, still present) as described in Pattern 2/Pitfall 1 — do not reach for `color-no-hex`.
**Source:** [CITED: stylelint.io/migration-guide/to-15, stylelint issue #6961 "Remove deprecated rules"]

### Pitfall 3: Naive single-direction contrast checking will under-adjust colors that are actually failing in production

**What goes wrong:** `--team-accent` has two real, live usage patterns in the current codebase: (a) as `color` (text) directly on the charcoal background — 1 occurrence, `GameBoard.module.css:116` (`.accentTeam`) — and (b) as `background` with white text (`--color-text-inverse`) on top — the _dominant_ pattern, 7+ occurrences including `ActionPanel.module.css`'s 11px `.ctaButton:hover` state. A contrast check that only tests direction (a) will approve colors that still fail AA when rendered as a small-text-on-accent-background button.
**Why it happens:** "Team accent color vs. charcoal/white base" (CONTEXT.md's phrasing) sounds like a single check, but the codebase actually has the accent playing both the foreground role and the background role in different components.
**How to avoid:** Check both directions: `contrast(accent, bgPage) >= 4.5` AND `contrast(accent, textInverse) >= 4.5`. A concrete run this session (candidate charcoal `#121212` / white `#f5f5f5`, illustrative only — not the locked values) showed **9 of 12** active teams fail at least one direction at the strict 4.5:1 text threshold, though nearly all pass a relaxed 3:1 threshold on the background direction. The planner must pick and document the exact threshold(s) per direction (see Open Questions).
**Warning signs:** Contrast-check CI passes, but a manual browser check of the `.ctaButton:hover` state on a bright team color (e.g. Crew `#FEE500`, Nashville `#F5CC26`) shows washed-out white text.

### Pitfall 4: A new CI-only script file will be flagged as "unused" by knip unless explicitly declared

**What goes wrong:** Phase 32 (CLEANUP-01) wired `knip` into `.github/workflows/ci.yml` as a required-green gate. `knip.json`'s `packages/client` workspace entry currently only declares `src/main.tsx` and `index.html` as entry points, with `project: ["src/**/*.{ts,tsx}"]` — a new `packages/client/scripts/check-contrast.ts` file sits entirely outside that glob and outside any declared entry point.
**Why it happens:** knip flags any TS/TSX file not reachable from a declared entry point and not covered by the `project` glob as dead code, exactly the pattern this phase's new script would trigger.
**How to avoid:** Mirror `packages/shared`'s existing pattern exactly — it already has `"entry": ["src/index.ts", "scripts/seed-rosters.ts"]` and `"project": ["src/**/*.ts", "scripts/**/*.ts"]`. Add the equivalent `scripts/check-contrast.ts` entry + `scripts/**/*.{ts,tsx}` project glob to `knip.json`'s `packages/client` block.
**Warning signs:** `pnpm knip` (already a required CI step per `.github/workflows/ci.yml` line 22) fails immediately after the new script file is added, before the new stylelint/contrast-check steps even run.

## Code Examples

### Reading `--color-bg-page`/`--color-text-inverse` values into the CI script without duplicating tokens.css

```typescript
// Source: pattern derived from tokens.css's plain :root custom-property format —
// avoids drift between the CSS file and a hardcoded JS constant.
import { readFileSync } from 'fs';

function extractToken(cssText: string, name: string): string {
  const match = cssText.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!match) throw new Error(`Token ${name} not found in tokens.css`);
  return match[1];
}

const tokensCss = readFileSync('src/styles/tokens.css', 'utf-8');
const bgPage = extractToken(tokensCss, '--color-bg-page');
const textInverse = extractToken(tokensCss, '--color-text-inverse');
```

### wcag-contrast usage

```typescript
// Source: github.com/tmcw/wcag-contrast README
import { hex, score } from 'wcag-contrast';

hex('#000', '#fff'); // => 21 (max possible ratio)
score(hex('#FEE500', '#121212')); // => 'AA' | 'AAA' | 'FAIL'
```

## State of the Art

| Old Approach                                     | Current Approach                                                                                   | When Changed                               | Impact                                                                                                        |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `color-no-hex` core stylelint rule               | `stylelint-declaration-strict-value` community plugin (+ `function-disallowed-list` for functions) | stylelint v15 (deprecated) → v16 (removed) | Any research/tutorial referencing `color-no-hex` is stale; must use the plugin-based approach documented here |
| CommonJS `.stylelintrc.js` with `module.exports` | ESM-only `stylelint.config.js` with `export default`                                               | stylelint v17.0.0                          | This repo's `"type": "module"` root `package.json` is already compatible — no extra config needed             |

**Deprecated/outdated:** `color-no-hex`, `color-no-rgba`-style rules (never existed as core rules — commonly confused with the strict-value plugin approach in outdated blog posts).

## Runtime State Inventory

Not applicable — this phase does not rename/refactor/migrate any identifiers, keys, or persisted state. It only changes CSS custom-property _values_ (already-abstracted tokens) and adds new dev-tooling files. **None found** across all 5 categories:

- Stored data: none — no datastore keys reference color values.
- Live service config: none — no external service config embeds theme colors.
- OS-registered state: none.
- Secrets/env vars: none.
- Build artifacts: none — `tokens.css` is a source file, not a generated artifact; no stale egg-info/dist analog applies to a CSS value swap.

## Assumptions Log

| #   | Claim                                                                                                                                                               | Section              | Risk if Wrong                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Charcoal/white illustrative values used in the Pitfall 3 contrast run (`#121212`/`#f5f5f5`/`#1c1c1c`) are placeholders only, not the actual D-01/D-02 chosen values | Common Pitfalls #3   | The 9/12-teams-fail count is illustrative of _the general shape of the problem_ (most teams need adjustment), not a locked number — the planner must re-run against the actual chosen values                                                                         |
| A2  | `--team-accent`'s two usage directions (text-on-page-bg, white-text-on-accent-bg) are the only two contexts that matter for THEME-04                                | Pattern 1, Pitfall 3 | If a future/undiscovered usage renders `--team-accent` against `--color-bg-surface-alt` (lightest chrome tier) instead of `--color-bg-page` (darkest), that pairing would need its own check — worth a grep sweep during planning to confirm no third context exists |
| A3  | 11px font-size in `.ctaButton` counts as "normal text" (4.5:1 threshold) rather than "large text" (3:1) per WCAG SC 1.4.3                                           | Common Pitfalls #3   | If treated as large text, several team colors that "fail" under this research's 4.5:1 assumption would actually already pass at 3:1, changing the auto-adjustment scope                                                                                              |

## Open Questions

1. **Which WCAG threshold applies to which `--team-accent` usage — 4.5:1 (normal text) or 3:1 (large text/UI component)?**
   - What we know: WCAG 2.x SC 1.4.3 requires 4.5:1 for normal text, 3:1 for large-scale text (≥18pt, or ≥14pt bold) and for non-text UI component boundaries (SC 1.4.11). The dominant `--team-accent` usage in this codebase is an 11px button background/border, which is neither "large text" nor purely decorative.
   - What's unclear: whether the phase should apply the strict 4.5:1 uniformly (simpler, safer, but forces more colors to shift further from brand-true) or 3:1 for background/border usages and 4.5:1 only for the single direct-text usage (`GameBoard.module.css:116`).
   - Recommendation: Apply 4.5:1 uniformly for the contrast-check script (simplest single-rule implementation, safest for a POC with no design-system nuance budget); document the choice explicitly in the plan so it's an intentional, stated decision rather than an implicit one.

2. **Should the contrast-check test both directions (page-bg text, white-text-on-bg) or just one?**
   - What we know: both directions are real, live usage patterns today (see Pitfall 3).
   - What's unclear: CONTEXT.md's D-03 wording ("against the new charcoal/white base") is compatible with either a single combined check or two separate checks.
   - Recommendation: check both directions per team (require passing both) — this matches actual rendered usage and is what `deriveAaAccentColor(uiColor, bgHex, fgHex)` in Pattern 1's code example already does.

## Environment Availability

| Dependency                                | Required By                              | Available | Version                               | Fallback |
| ----------------------------------------- | ---------------------------------------- | --------- | ------------------------------------- | -------- |
| Node.js ≥20.19 (stylelint 17 requirement) | stylelint CLI                            | ✓         | v24.15.0                              | —        |
| pnpm                                      | package install/scripts                  | ✓         | 9.15.9 (matches `packageManager` pin) | —        |
| npm registry access                       | `npm view` verification, package install | ✓         | —                                     | —        |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 2.1.9 (client), already configured                                                                |
| Config file        | `packages/client/vite.config.ts` (test config colocated, per existing `useTeamColors.test.ts` precedent) |
| Quick run command  | `pnpm --filter @counter-attack/client test -- useTeamColors`                                             |
| Full suite command | `pnpm -r test`                                                                                           |

### Phase Requirements → Test Map

| Req ID   | Behavior                                        | Test Type                                                                                                | Automated Command                                                                                                                                      | File Exists?     |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| THEME-01 | Palette values swapped, no blue tint remains    | manual/visual (no meaningful unit-test surface for "does it look charcoal") + `pnpm -r build` regression | `pnpm -r build`                                                                                                                                        | ✅ existing      |
| THEME-02 | Zero hardcoded hex/rgba in chrome `.module.css` | lint                                                                                                     | `pnpm stylelint` (NEW)                                                                                                                                 | ❌ Wave 0        |
| THEME-04 | All 12 team accents pass AA                     | unit + script                                                                                            | `pnpm --filter @counter-attack/client test -- useTeamColors` (unit tests for `deriveAaAccentColor`) + `pnpm check-contrast` (NEW, full-registry sweep) | ❌ Wave 0 (both) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/client test -- useTeamColors`
- **Per wave merge:** `pnpm -r test && pnpm stylelint && pnpm check-contrast`
- **Phase gate:** Full suite green (`pnpm -r typecheck && pnpm -r test && pnpm -r build && pnpm stylelint && pnpm check-contrast`) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `stylelint.config.js` — new config file, root of repo
- [ ] `packages/client/scripts/check-contrast.ts` — new CI script
- [ ] `packages/client/src/hooks/useTeamColors.test.ts` — extend with `deriveAaAccentColor`/`useTeamAccentColorAA` test cases (file already exists, needs new test cases only)
- [ ] `knip.json` — add `packages/client` `scripts/**/*.ts` project glob + `scripts/check-contrast.ts` entry (Pitfall 4)
- [ ] `.github/workflows/ci.yml` — add `pnpm stylelint` and `pnpm check-contrast` steps, mirroring the existing `pnpm knip` step

## Security Domain

Not applicable — `security_enforcement` has no explicit setting in `.planning/config.json`, but this phase touches only CSS values, a derived-color pure function, and dev-tooling config. No ASVS category applies: no auth, no session, no user input, no cryptography, no network calls. Omitted per the "no meaningful attack surface" case.

## Sources

### Primary (HIGH confidence)

- `npm view stylelint version` / `stylelint-declaration-strict-value version` / `wcag-contrast version` / `@types/wcag-contrast version` — this session, 2026-07-26
- Direct repo reads: `packages/client/src/styles/tokens.css`, `packages/shared/src/teamConfig.ts`, `packages/client/src/hooks/useTeamColors.ts`, `packages/client/src/components/GameBoard.tsx`, `packages/client/src/components/ActionLog.tsx`, `packages/client/src/components/TeamSelectionScreen.tsx`, all 17 `.module.css` files under `packages/client/src`, `.github/workflows/ci.yml`, `knip.json`, `eslint.config.js`
- `gsd-tools query package-legitimacy check` — this session, all 6 packages

### Secondary (MEDIUM confidence)

- [stylelint.io/migration-guide/to-17](https://stylelint.io/migration-guide/to-17/) — Node ≥20.19, ESM-only config requirement
- [stylelint.io/migration-guide/to-15](https://stylelint.io/migration-guide/to-15/) — `color-no-hex` deprecation
- [github.com/stylelint/stylelint/issues/6961](https://github.com/stylelint/stylelint/issues/6961) — deprecated rule removal confirmation
- [github.com/AndyOGo/stylelint-declaration-strict-value](https://github.com/AndyOGo/stylelint-declaration-strict-value) — plugin config shape, default `ignoreVariables`/`ignoreFunctions`/`ignoreValues`
- [github.com/AndyOGo/stylelint-declaration-strict-value/issues/325](https://github.com/AndyOGo/stylelint-declaration-strict-value/issues/325) — rgba() not caught by default, confirmed live issue
- [github.com/tmcw/wcag-contrast](https://github.com/tmcw/wcag-contrast) — `hex()`/`rgb()`/`luminance()`/`score()` API

### Tertiary (LOW confidence)

- None — all findings this session were either verified via tool calls or cited to official/upstream sources.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all package versions verified via `npm view` this session; no reliance on training-data version numbers.
- Architecture: HIGH — derivation point, usage directions, and CSS-module scope were confirmed by direct source reads, not inferred.
- Pitfalls: HIGH — the `rgba()` gap and `color-no-hex` removal are both confirmed via upstream GitHub sources, not assumption; the dual-direction contrast finding is backed by an actual computed contrast-ratio run in this session.

**Research date:** 2026-07-26
**Valid until:** 2026-08-25 (30 days — stable tooling domain, low churn risk for stylelint/wcag-contrast APIs)
