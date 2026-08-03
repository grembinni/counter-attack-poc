---
phase: 34-visual-theme-restyle
reviewed: 2026-07-26T23:59:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - .github/workflows/ci.yml
  - packages/client/package.json
  - packages/client/scripts/check-contrast.ts
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/LineupAssignmentScreen.module.css
  - packages/client/src/components/LineupAssignmentScreen.test.tsx
  - packages/client/src/components/LineupAssignmentScreen.tsx
  - packages/client/src/components/UniformSelectionScreen.module.css
  - packages/client/src/components/UniformSelectionScreen.tsx
  - packages/client/src/hooks/useTeamColors.test.ts
  - packages/client/src/hooks/useTeamColors.ts
  - packages/client/src/styles/tokens.css
  - packages/client/tsconfig.json
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-07-26T23:59:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This is a fresh, full-scope pass over the complete Phase 34 file set, including the just-landed
gap-closure plan 34-05 (Confirm-button CTA color migration on `UniformSelectionScreen` and
`LineupAssignmentScreen`).

The previously-reported Critical/Warning findings (CR-01, CR-02, WR-01 through WR-06 in the prior
`34-REVIEW.md`, all recorded as fixed in `34-REVIEW-FIX.md`) were independently re-verified against
the current file contents — `useTeamColors.ts`'s `AA_REFERENCE_BG_HEX`/`AA_REFERENCE_FG_HEX`
constants, `check-contrast.ts`'s `--team-accent` fallback assertion, `tokens.css`'s
`--color-border: #a0a0a0`, `--team-accent: #b08b08`, and `normalizeHex()` in `useTeamColors.ts` are
all present and correct. No regression found in that machinery.

34-05's Confirm-button migration itself is correct and matches its plan exactly: both screens'
`.confirmButton` (grey, not-ready) / `.confirmButtonReady` (canonical green) classes reference the
right tokens, the LineupAssignmentScreen draft-incomplete branch now renders a genuine disabled
button, and the updated test assertions match the new markup.

This pass found one new, concrete, reproducible layout bug (CR-01 below) in
`LineupAssignmentScreen.module.css`/`.tsx` — pre-existing from Phase 29/30, not introduced by 34-05,
but present in the current file set and not previously reported — plus a CSS-value bug in
`UniformSelectionScreen.tsx`'s jersey-toggle inline styling, and a handful of Info-level carryovers
from the prior review's Info tier (never fixed, by design, since `fix_scope` excluded Info).

## Critical Issues

### CR-01: Draft-mode filled lineup-slot cards overflow the 4-column formation grid — tier-border `min-width: 320px` leaks from carousel cards into the fixed-width grid

**File:** `packages/client/src/components/LineupAssignmentScreen.module.css:101-108,340-368`, `packages/client/src/components/LineupAssignmentScreen.tsx:519-545`

**Issue:** `.formationColumns` is a fixed `max-width: 1260px` CSS Grid with `grid-template-columns:
repeat(4, 1fr)` and `gap: 16px` (module.css:101-108). At full width, each column's fair-share size
is `(1260 - 3*16) / 4 = 303px`.

The four `TIER_CARD_CLASS` variants (`.cardTierChase`/`.cardTierRare`/`.cardTierUncommon`/
`.cardTierCommon`, module.css:346-368) were widened from `min-width: 260px` to `min-width: 320px` in
the 29-08 gap-closure, with an explicit code comment stating this widening is "Applied ONLY to the
tier classes (draft-pack/bench cards) — NOT to `.statCardBase`... a base-level change risks a
Standard-mode layout regression" (module.css:340-345). That comment's premise is false in practice:
`renderDraftColumn()` (LineupAssignmentScreen.tsx:522-560) renders every **filled starting-11 slot**
in draft mode via `<LineupStatCard ... showTierBorder />` (tsx:538-539), and inside `LineupStatCard`
(tsx:145-148) `showTierBorder` composes the same `TIER_CARD_CLASS[tier]` (320px min-width) onto the
card — and these cards render inside `.formationColumns`, the identical fixed 4-column grid used by
Standard mode, not inside `DraftPackCarousel`/`BenchCarousel`'s horizontally-scrolling track (where
the 320px widening is harmless because `overflow-x` absorbs it).

Since CSS Grid tracks respect an item's explicit `min-width` over the `1fr` fair-share size (no
`minmax(0, 1fr)` is used here), every filled DEF/MID/FWD slot card in draft mode demands 320px in a
~303px column — 17px too wide per card, and worse once four columns each demand ≥320px
(4×320 + 3×16 = 1328px) inside a 1260px container. This overflows/breaks the intended equal
4-column layout for the one screen (draft-mode roster building) this widening was never supposed to
touch, on every drafted card shown in a lineup slot.

**Fix:** Scope the widened min-width to the carousel-only tier classes and leave the in-grid tier
border a border-only modifier, e.g. split into two variants:

```css
/* Carousel-only (DraftPackCarousel/BenchCarousel) — widened per DRAFT-06 */
.cardTierChaseCarousel {
  composes: statCardBase;
  border: 3px solid var(--color-accent-purple);
  min-width: 320px;
}

/* In-grid (LineupStatCard inside .formationColumns) — border only, no width change */
.cardTierChase {
  composes: statCardBase;
  border: 3px solid var(--color-accent-purple);
}
```

and pass the carousel-specific class from `DraftPackCarousel`/`BenchCarousel` while
`LineupStatCard`'s `showTierBorder` continues to use the un-widened `TIER_CARD_CLASS`. Alternatively,
add `minmax(0, 1fr)` to `.formationColumns` and cap card width with `max-width` instead of relying on
grid-track growth to absorb an oversized child.

## Warnings

### WR-01: Jersey-toggle inline style builds an invalid 5-character hex color from the neutral fallback

**File:** `packages/client/src/components/UniformSelectionScreen.tsx:271-298`

**Issue:**

```tsx
const teamPalette = selectedTeam ? TEAM_CONFIGS[selectedTeam].palette : null;
const color = teamPalette ? (type === 'home' ? teamPalette.homePrime : teamPalette.awayPrime) : '#555';
...
style={
  isActive
    ? { borderColor: color, color, background: `${color}22` }
    : { borderColor: `${color}66`, color: `${color}99` }
}
```

When no team is selected yet (`teamPalette === null`, which is the state of this screen on first
render for every game), `color` falls back to the 3-digit shorthand `'#555'`. The alpha-suffix
string concatenation then produces `` `${color}22` `` = `"#55522"`, `` `${color}66` `` = `"#55566"`,
`` `${color}99` `` = `"#55599"` — none of these are valid CSS hex colors (valid lengths after `#`
are 3, 4, 6, or 8 hex digits; these are 5). Browsers silently discard an invalid CSS property value,
so both the active and inactive jersey-toggle buttons lose their intended alpha-tinted
background/border/text color before a team is picked, falling back to whatever `.jerseyOption`/
`.jerseyOptionActive`'s own CSS declares (no explicit `color`, so it inherits the ambient text
color). All real `TEAM_CONFIGS[...].palette.homePrime/awayPrime` values are 6-digit hex, so this
only manifests in the pre-team-selection neutral state, but that is this screen's default/initial
state on every game.

**Fix:** Use a 6-digit neutral fallback consistent with the rest of the file's `NEUTRAL_PALETTE`
convention (which already defines 3-digit shorthands like `'#555'`/`'#888'` — expand those too, or
introduce a distinct 6-digit neutral just for this alpha-suffix computation), e.g.:

```ts
const color = teamPalette
  ? type === 'home'
    ? teamPalette.homePrime
    : teamPalette.awayPrime
  : '#555555';
```

### WR-02: `check-contrast.ts` regex-based token extraction is unanchored (carried over, still open)

**File:** `packages/client/scripts/check-contrast.ts:38-43`

**Issue:** `extractToken()` builds `new RegExp(\`${name}:\\s\*(#[0-9a-fA-F]{3,8})\`)`with no
word-boundary anchor around`name`. No current collision exists among the three tokens it extracts
(`--color-bg-surface-alt`, `--color-text-inverse`, `--team-accent`) against the current
`tokens.css`contents (verified: no other declaration or comment text contains one of these exact
strings immediately followed by`:`), but the function remains fragile — a future token sharing a
name prefix (e.g. a hypothetical `--color-bg-surface-alt-hover`) or a comment that happens to write
`tokenName:` followed by a hex value would silently extract the wrong value with no error, and this
script is the CI gate protecting WCAG AA compliance.

**Fix:** Anchor the match so it can't cross a token-name boundary, e.g.
``new RegExp(`(?<![\\w-])${name}:\\s*(#[0-9a-fA-F]{3,8})`)``.

## Info

### IN-01: `packages/shared` is built twice per CI run (carried over, still open)

**File:** `.github/workflows/ci.yml:21-22`

**Issue:** CI runs `pnpm --filter @counter-attack/shared build` (line 21) immediately before
`pnpm knip` (line 22); the root `package.json`'s `knip` script is
`"pnpm --filter @counter-attack/shared build && knip"`, so `shared` is rebuilt a second time before
`knip` actually runs (confirmed by reading the current root `package.json`).

**Fix:** Drop the explicit line-21 build step (the `knip` script step already performs it), or
change the `knip` npm script to just `"knip"` and rely on the explicit CI step, so `shared` is built
exactly once per run.

### IN-02: `eslint` is configured but never run in CI

**File:** `.github/workflows/ci.yml:1-27`, `packages/client/package.json` (no `lint` script; root
`package.json` has `"lint": "eslint ."`)

**Issue:** The root `package.json` defines a `lint` script and `lint-staged` runs `eslint --fix` on
commit via the Husky pre-commit hook, but `ci.yml`'s job never invokes `pnpm lint` (or `eslint .`)
— only `typecheck`, `test`, `build`, `stylelint`, and `check-contrast` run in CI. A contributor who
bypasses the local pre-commit hook (e.g. `git commit --no-verify`, a GitHub-UI edit, or a rebase
that skips hooks) can merge code with lint violations (including `react-hooks/exhaustive-deps`,
which this codebase has explicitly fixed regressions for per commit `f0ff5e1`) with a fully green CI
run.

**Fix:** Add a `pnpm lint` (or `pnpm -r lint` if per-package scripts exist) step to `ci.yml`.

### IN-03: No automated test guards the tier-border grid width from CR-01's regression

**File:** `packages/client/src/components/LineupAssignmentScreen.test.tsx`

**Issue:** The existing D-23 test (`applies a TIER_CARD_CLASS tier-color class to filled starting-11
lineup slot cards`) only asserts that a tier class is present on in-grid cards; it does not (and,
being jsdom-based with no real CSS layout engine, structurally cannot) catch the min-width overflow
described in CR-01. There is also still no test asserting the stat-chip DOM order carried over from
the prior review's IN-05.

**Fix:** Not blocking — layout regressions of this kind are best caught by a visual/percy-style
snapshot or a manual UAT pass, not jsdom unit tests. Noting for completeness since this is the gap
that let CR-01 ship unnoticed through the existing test suite.

### IN-04: `check-contrast.ts`'s per-team loop error message doesn't show the reference colors on failure

**File:** `packages/client/scripts/check-contrast.ts:88-91`

**Issue:** On failure the per-team loop logs only `` `FAIL: ${teamId} (${raw} -> ${adjusted})` ``
with no ratio values, unlike the `bgSurfaceAlt`/`textInverse`/`fallbackTeamAccent` failure branches
just above and below it, which all print the measured ratios. A failing per-team AA check in CI
gives a debugger less actionable output than the other three checks in the same file.

**Fix:**

```ts
console.error(
  `FAIL: ${teamId} (${raw} -> ${adjusted}) text ${textRatio.toFixed(2)}, ui ${uiRatio.toFixed(2)}`,
);
```

---

_Reviewed: 2026-07-26T23:59:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
