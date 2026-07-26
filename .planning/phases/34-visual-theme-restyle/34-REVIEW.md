---
phase: 34-visual-theme-restyle
reviewed: 2026-07-26T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - .github/workflows/ci.yml
  - eslint.config.js
  - knip.json
  - package.json
  - packages/client/package.json
  - packages/client/scripts/check-contrast.ts
  - packages/client/src/components/ActionPanel.module.css
  - packages/client/src/components/DraftPackCarousel.tsx
  - packages/client/src/components/FreeKickSetupPanel.module.css
  - packages/client/src/components/GameBoard.module.css
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameSettingsScreen.module.css
  - packages/client/src/components/KickOffSetupPanel.module.css
  - packages/client/src/components/LineupAssignmentScreen.module.css
  - packages/client/src/components/LineupAssignmentScreen.tsx
  - packages/client/src/components/LobbyScreen.module.css
  - packages/client/src/components/PlayerStatsPanel.module.css
  - packages/client/src/components/PlayerStatsPanel.tsx
  - packages/client/src/components/ReplayPanel.module.css
  - packages/client/src/components/UniformSelectionScreen.module.css
  - packages/client/src/hooks/useTeamColors.test.ts
  - packages/client/src/hooks/useTeamColors.ts
  - packages/client/src/styles/tokens.css
  - packages/client/tsconfig.json
  - stylelint.config.js
findings:
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 34: Code Review Report

**Reviewed:** 2026-07-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Reviewed the charcoal/graphite theme swap (`tokens.css`), the new WCAG-AA accent-derivation hook
(`useTeamColors.ts`), the `stylelint`/`check-contrast` CI gates, and the human-verify-checkpoint
follow-up fixes (CTA-button border legibility across 8 files, stat-chip value/label reorder across
4 call sites).

The two checkpoint follow-ups were each traced file-by-file via `git diff`/`git show` against
every touched file: the stat-chip reorder is applied consistently everywhere (no inconsistency —
GameBoard.tsx, PlayerStatsPanel.tsx, LineupAssignmentScreen.tsx, DraftPackCarousel.tsx all match).
The border-legibility fix is consistent across 8 of 9 near-identical CTA button definitions, with
one real miss (WR-01).

More significantly, the WCAG-AA derivation machinery this phase's central deliverable
(`deriveAaAccentColor` / `AA_TEXT_MIN_RATIO` / `AA_UI_MIN_RATIO`, gated in CI by
`check-contrast.ts`) does not actually guarantee AA contrast on the surfaces it is used on. Two
independent, numerically-verified contrast failures were found (CR-01, CR-02) — both reproduced
directly with the project's own `wcag-contrast` package and the actual algorithm/token values in
this diff, not estimated.

## Critical Issues

### CR-01: AA-safe accent derivation is validated against the wrong background — real render surfaces fail WCAG AA

**File:** `packages/client/src/hooks/useTeamColors.ts:190-193`, `packages/client/scripts/check-contrast.ts:43-70`, `packages/client/src/components/GameBoard.module.css:51-57,394-404`, `packages/client/src/components/ReplayPanel.module.css:5-13,28-36`

**Issue:** `deriveAaAccentColor()`/`useTeamAccentColorAA()` only check a candidate color against
`--color-bg-page` (#121212) for the 4.5:1 text ratio. But the derived color is rendered as text on
lighter surfaces too:

- `GameBoard.module.css` `.scoreboard` (line 51-57) is `background: var(--color-bg-surface-alt)`
  (#262626). The home/away score numerals (`.scoreNumeral.accentHome/.accentAway`) and the active
  team name (`.teamName.accentTeam`) render on top of it.
- `GameBoard.module.css` `.overlayCard` (line 394-404) is `background: var(--color-bg-surface)`
  (#1c1c1c). HALF_TIME/FULL_TIME score numerals and the "2ND HALF KICK OFF ... TEAM" label render
  on top of it.
- `ReplayPanel.module.css` `.panel` (line 5-13) is also `--color-bg-surface`; `.homeTeam`/
  `.awayTeam` (line 28-36) render `var(--home-accent)`/`var(--away-accent)` as text there.

Reproduced directly, running the exact algorithm in this diff against the "USA navy" fixture
already present in `useTeamColors.test.ts` (`#1A2849`):

```
deriveAaAccentColor('#1A2849', '#121212', '#ffffff') => '#617fc7'

contrast('#617fc7', '#121212' /* bg-page,        used for validation */) = 4.79  (passes 4.5)
contrast('#617fc7', '#1c1c1c' /* bg-surface,      real overlay/replay bg */) = 4.36  (FAILS 4.5)
contrast('#617fc7', '#262626' /* bg-surface-alt,  real scoreboard bg   */) = 3.87  (FAILS 4.5)
```

Because `searchAaSafeLightness` stops at the first lightness that clears the `bg-page` threshold,
it lands colors right at that boundary (~4.5-4.8:1) — exactly the zone that then fails against the
two lighter surfaces the color is actually painted on. `check-contrast.ts` cannot catch this
because it re-derives against the same narrow `#121212`/`#ffffff` pair, so a team whose raw color
needs any adjustment ships with under-contrast scoreboard/overlay/replay text while CI stays green.
This defeats the stated purpose of THEME-04.

**Fix:** Validate against the lightest background the accent is actually painted on as text
(`--color-bg-surface-alt`, #262626 — confirmed the hardest case above), not just `--color-bg-page`:

```ts
export function useTeamAccentColorAA(teamId: TeamId | undefined): string {
  const raw = teamAccentColor(teamId);
  return deriveAaAccentColor(
    raw,
    '#262626' /* --color-bg-surface-alt: lightest real bg */,
    '#ffffff',
  );
}
```

Update `check-contrast.ts` to read/check the same token for parity with the runtime hook.

### CR-02: Static `--team-accent` fallback fails WCAG AA against the white text it's paired with

**File:** `packages/client/src/styles/tokens.css:35`, `packages/client/src/components/LobbyScreen.module.css:81-83`, `packages/client/src/components/GameSettingsScreen.module.css:203-205`

**Issue:** `tokens.css` defines a static fallback `--team-accent: #f5c518;` (gold), documented as
"the static fallback used before any team is active (lobby/pre-team-select)." `LobbyScreen` and
`GameSettingsScreen` both render `.ctaButton:hover { background: var(--team-accent); }` with
`color: var(--color-text-inverse)` (white). Both screens mount **outside** `GameBoard`'s root
`<div style={rootStyle}>` — the only place `--team-accent` is overridden to the AA-derived
per-team value — so on these two screens `var(--team-accent)` resolves to the raw `#f5c518`
fallback, which is never run through `deriveAaAccentColor`.

Measured directly:

```
contrast('#f5c518', '#ffffff') = 1.63 : 1
```

That fails both the applicable SC 1.4.3 normal-text threshold (4.5:1 — 13px bold does not qualify
as "large text," which requires ≥18.66px bold) and the looser SC 1.4.11 UI-component 3:1 this
phase's own `AA_UI_MIN_RATIO` targets. On hover, the "Create Room"/"Join Room" buttons
(LobbyScreen) and the Draft-settings primary CTA (GameSettingsScreen) render low-contrast white
text on a gold background — the exact failure mode the AA machinery exists to prevent — and
`check-contrast.ts` never checks it because it only iterates `TEAM_CONFIGS` entries, never the
static `--team-accent` default that actually ships and renders.

**Fix:** Run the fallback through `deriveAaAccentColor` at authoring time and hardcode the result,
or add a `check-contrast.ts` assertion against the literal `--team-accent` token:

```ts
const fallbackTeamAccent = extractToken(tokensCss, '--team-accent');
if (
  hex(fallbackTeamAccent, bgPage) < AA_TEXT_MIN_RATIO ||
  hex(fallbackTeamAccent, textInverse) < AA_UI_MIN_RATIO
) {
  console.error(`FAIL: static --team-accent fallback (${fallbackTeamAccent}) does not clear AA`);
  failed = true;
}
```

## Warnings

### WR-01: "Confirm Lineup" CTA button missed the border-legibility fix applied to every other CTA button

**File:** `packages/client/src/components/LineupAssignmentScreen.module.css:60-77`

**Issue:** Commits `f5effcb`/`961571f`/`1a9d2b9` changed `border: none` to
`border: 1px solid var(--color-border-muted)` on the equivalent `.ctaButton`/
`.confirmButtonGreen`/`.confirmButtonYellow` classes in `ActionPanel.module.css`,
`FreeKickSetupPanel.module.css`, `GameSettingsScreen.module.css`, `KickOffSetupPanel.module.css`,
`LobbyScreen.module.css`, `ReplayPanel.module.css`, `GameBoard.module.css`, and
`UniformSelectionScreen.module.css`. Commit `1a9d2b9`'s message states this closes the gap because
"every other CTA button in the app" now carries the outline.

`LineupAssignmentScreen.module.css`'s visually-identical `.confirmButtonGreen` (used for the
"Confirm" button in both Standard-mode, `LineupAssignmentScreen.tsx:702`, and draft-mode,
`LineupAssignmentScreen.tsx:646`) was never touched — confirmed via grep, zero occurrences of
`--color-border-muted` in the file:

```css
.confirmButtonGreen {
  ...
  border: none;  /* still no outline */
  ...
}
```

**Fix:**

```diff
 .confirmButtonGreen {
   ...
-  border: none;
+  border: 1px solid var(--color-border-muted);
   ...
 }
```

### WR-02: `--color-border` token is ~1.1-1.25:1 contrast against the surfaces it borders

**File:** `packages/client/src/styles/tokens.css:24`

**Issue:** `--color-border: #262626;` intentionally reuses the same swatch as
`--color-bg-surface-alt` (per the file's own comment). Measured:

```
contrast('#262626', '#1c1c1c' /* --color-bg-surface */) = 1.13 : 1
contrast('#262626', '#121212' /* --color-bg-page    */) = 1.24 : 1
```

Both are far below WCAG SC 1.4.11's 3:1 minimum for UI-component boundaries. This token underlies
nearly every card/panel/input border shipped this phase (`.card`, `.panel`, `.input`,
`.confirmCard`, `.overlayCard`, `.columnHeader`, `.styleTile`, etc.), making those borders
effectively invisible against the backgrounds they're meant to delineate — the opposite of this
phase's stated legibility goal — and unlike the CTA-button fix (WR-01), no CI gate would ever
catch a regression here.

**Fix:** Give `--color-border` a value with ≥3:1 against `--color-bg-surface`/`--color-bg-page`
(e.g. reuse `--color-border-muted`'s `#a0a0a0`, confirmed 5.79:1 against `--color-bg-surface-alt`),
or explicitly document the near-invisible border as an intentional "no visible boundary" choice
and give inputs (which arguably need a real boundary under SC 1.4.11) a distinct, visible token.

### WR-03: `.halfTimeKickOff`'s own `color` declaration overrides `.accentHome`/`.accentAway` via CSS cascade order

**File:** `packages/client/src/components/GameBoard.module.css:107-117,552-560`, `packages/client/src/components/GameBoard.tsx:373-379`

**Issue:** GameBoard.tsx renders the "2ND HALF KICK OFF" team-name span with two classes:
`` `${styles.halfTimeKickOff} ${secondHalfKickOffTeam === 'home' ? styles.accentHome : styles.accentAway}` ``.
`.halfTimeKickOff` (declared at line 552) and `.accentHome`/`.accentAway` (declared at lines
107/111) are all single-class selectors with equal specificity, so the stylesheet's declaration
order — not the JSX class order — decides which `color` wins. `.halfTimeKickOff` sets
`color: var(--color-text-secondary)` and is declared **after** `.accentHome`/`.accentAway` in the
file, so it always wins: the label renders in plain gray regardless of which team kicks off
second, silently defeating the only place this markup applies an accent-color modifier class.
(Compare `.halfTimeScore`, used the same way one row up, which intentionally has no `color`
declaration so `.accentHome`/`.accentAway` can apply — `.halfTimeKickOff` is the one sibling that
still sets its own `color`.)

**Fix:** Drop the `color` declaration from `.halfTimeKickOff` (matching `.halfTimeScore`'s
pattern) so `.accentHome`/`.accentAway` can win, or increase the modifier's specificity, e.g.
`.halfTimeKickOff.accentHome { color: var(--home-accent); }`.

### WR-04: WCAG reference colors (`#121212`/`#ffffff`) are hardcoded in four separate places

**File:** `packages/client/src/hooks/useTeamColors.ts:192`, `packages/client/src/hooks/useTeamColors.test.ts:18-19`, `packages/client/src/components/GameBoard.test.tsx:290-291,307`, `packages/client/src/styles/tokens.css:19,31`

**Issue:** `useTeamAccentColorAA` hardcodes `deriveAaAccentColor(raw, '#121212', '#ffffff')`.
`useTeamColors.test.ts` and `GameBoard.test.tsx` independently re-hardcode the same two literals.
Only `check-contrast.ts` reads `--color-bg-page`/`--color-text-inverse` dynamically from
`tokens.css` at run time — its own doc comment calls this out as the reason it "stays correct
after the 34-04 value tuning pass." If those tokens are ever retuned again without updating the
four hardcoded copies, `check-contrast` still passes (it re-derives against the new value), the
Vitest suites still pass (they assert against the hook's stale literal, not the live CSS), and the
browser output silently derives against outdated reference colors — a false-green regression.

**Fix:** Export the two reference hex values as named constants from a single module (alongside
`AA_TEXT_MIN_RATIO`/`AA_UI_MIN_RATIO`), and have `check-contrast.ts` assert those constants equal
what it independently reads from `tokens.css`, so drift fails CI instead of shipping silently.

### WR-05: `hexToRgb` has no input validation — 3-digit hex shorthand silently produces `NaN`

**File:** `packages/client/src/hooks/useTeamColors.ts:48-54`

**Issue:**

```ts
function hexToRgb(colorHex: string): [number, number, number] {
  const clean = colorHex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}
```

Reproduced directly: `hexToRgb('#fff')` returns `[255, 15, NaN]`. Any `NaN` channel propagates
through `rgbToHsl` → `searchAaSafeLightness` → `hslToRgb` → `rgbToHex`, where
`Math.max(0, Math.min(255, NaN))` is `NaN` and `NaN.toString(16).padStart(2, '0')` yields the
literal string `"nan"`, silently producing a broken CSS color with no thrown error. Not triggered
today (all `TEAM_CONFIGS` colors are apparently 6-digit hex), but this is the load-bearing
function of a WCAG-safety-critical utility with zero defensive coding against malformed/shorthand
input.

**Fix:** Normalize 3-digit shorthand to 6-digit before parsing (or assert on non-6-digit-hex input)
at the top of `deriveAaAccentColor`/`hexToRgb`.

### WR-06: `ActionLog.tsx`'s team-accent-as-text usage bypasses the new AA derivation

**File:** `packages/client/src/hooks/useTeamColors.ts:1-16` (docstring names this call site directly; `ActionLog.tsx` itself is outside this phase's file list)

**Issue:** `useTeamColors.ts`'s docstring explains the pure `teamAccentColor()` function exists so
`ActionLog.tsx`'s per-event helpers can call it from render loops without violating Rules of Hooks.
Those call sites use the **raw** `teamAccentColor()`, never `deriveAaAccentColor()` — even though
`deriveAaAccentColor` is itself a plain function with no hook/Rules-of-Hooks concern. The match-log
panel renders team-colored text on the same charcoal chrome background that motivated
`GameBoard.tsx`'s switch to `useTeamAccentColorAA` in this phase (THEME-04); as shipped, the log
panel is the one "accent-as-text on dark chrome" surface this phase's AA derivation never reached.

**Fix:** Have the event-prefix/piece-color helpers in `ActionLog.tsx` call
`deriveAaAccentColor(teamAccentColor(teamId), bgHex, fgHex)` instead of the raw call (no hook
needed), or explicitly document this surface as intentionally out of scope.

## Info

### IN-01: Stale docstring — stated stat-tier thresholds don't match `statTier`

**File:** `packages/client/src/components/PlayerStatsPanel.tsx:30-34,115`

**Issue:** The docstring at line 115 reads "Stat badges: green ≥7 / orange 4-6 / red ≤3" but
`statTier()` (line 30-34, mirrored in `GameBoard.tsx`/`LineupAssignmentScreen.tsx`/
`DraftPackCarousel.tsx`) uses `>=5` (high) / `>=3` (mid) / else (low). Predates this phase, but the
file is in this diff's stat-chip touch-up, so worth correcting while in the area.

**Fix:** Update the comment to "green ≥5 / orange 3-4 / red ≤2".

### IN-02: Inconsistent `.statAbbr` `letter-spacing` across three near-duplicated CSS blocks

**File:** `packages/client/src/components/GameBoard.module.css:202`, `packages/client/src/components/PlayerStatsPanel.module.css:104`, `packages/client/src/components/LineupAssignmentScreen.module.css:251`

**Issue:** The three `.statAbbr` rules are otherwise identical (font-size family, weight, color,
uppercase treatment) but use three different `letter-spacing` values: `0.04em`, `0.05em`, and
`0.03em` respectively. All three files were touched by this phase's stat-chip alignment fix and
are meant to render identically.

**Fix:** Standardize on one value across all three.

### IN-03: `check-contrast.ts`'s token-extraction regex is unanchored

**File:** `packages/client/scripts/check-contrast.ts:37`

**Issue:** ``new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,8})`)`` has no word-boundary anchor, so it
would match `name` as a substring of a longer custom-property name sharing the same prefix (e.g. a
hypothetical future `--color-bg-page-2`). No current collision, but fragile as tokens are added.

**Fix:** Anchor the match, e.g. ``new RegExp(`(?<![\\w-])${name}:\\s*(#[0-9a-fA-F]{3,8})`)``.

### IN-04: `packages/shared` is built twice per CI run

**File:** `.github/workflows/ci.yml:21-22`

**Issue:** CI runs `pnpm --filter @counter-attack/shared build` (line 21) then `pnpm knip` (line
22), whose own script is `"knip": "pnpm --filter @counter-attack/shared build && knip"` —
rebuilding the already-built package again before `knip` runs.

**Fix:** Drop the explicit line-21 build step, or simplify the `knip` npm script to just `"knip"`
and keep the explicit CI build step, so `shared` is built exactly once.

### IN-05: No automated test asserts the new stat-chip value-before-label DOM order

**File:** `packages/client/src/components/GameBoard.test.tsx`

**Issue:** Commit `0168749` reordered `statBubble`/`statBadge` before `statAbbr` across all four
call sites (verified consistent via `git diff` across `GameBoard.tsx`, `PlayerStatsPanel.tsx`,
`LineupAssignmentScreen.tsx`, `DraftPackCarousel.tsx` — no inconsistency found, this part of the
checkpoint fix is correct), but no test asserts DOM order; it currently relies solely on the
human-verify checkpoint.

**Fix:** Optional — add a DOM-order assertion (e.g. querying `.statChip`'s children and asserting
the numeric badge precedes the abbreviation label) to guard against a future regression.

---

_Reviewed: 2026-07-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
