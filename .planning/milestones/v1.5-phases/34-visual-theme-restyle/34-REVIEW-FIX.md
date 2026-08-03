---
phase: 34-visual-theme-restyle
fixed_at: 2026-07-26T23:25:06Z
review_path: .planning/phases/34-visual-theme-restyle/34-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 34: Code Review Fix Report

**Fixed at:** 2026-07-26T23:25:06Z
**Source review:** .planning/phases/34-visual-theme-restyle/34-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (2 critical, 6 warning; fix_scope = critical_warning, 5 Info findings skipped by scope)
- Fixed: 8
- Skipped: 0

All fixes were applied in an isolated git worktree, verified with `tsc --noEmit`, `stylelint`,
`pnpm check-contrast`, and the full client Vitest suite (416 tests passing after all fixes), then
committed atomically per finding on branch `gsd-reviewfix/34-65507` before being fast-forwarded
onto `main`.

## Fixed Issues

### CR-01: AA-safe accent derivation is validated against the wrong background — real render surfaces fail WCAG AA

**Files modified:** `packages/client/src/hooks/useTeamColors.ts`, `packages/client/scripts/check-contrast.ts`, `packages/client/src/hooks/useTeamColors.test.ts`, `packages/client/src/components/GameBoard.test.tsx`
**Commit:** 2f25920
**Applied fix:** Changed `useTeamAccentColorAA()`'s validation background from `--color-bg-page`
(#121212) to `--color-bg-surface-alt` (#262626) — the lightest real background the derived accent
is actually rendered as text on (GameBoard's `.scoreboard`/`.overlayCard`, ReplayPanel's `.panel`).
Updated `check-contrast.ts` to extract and validate against the same token for parity. Updated the
two existing test files' hardcoded reference-background literals so their assertions match the
corrected runtime behavior (verified failing before the fix would have propagated via
`useTeamColors.test.ts`'s `useTeamAccentColorAA` describe block and `GameBoard.test.tsx`'s
CSS-variable assertions). Reproduced the original failure numerically (4.36:1 / 3.87:1, both below
4.5) before fixing, and confirmed `pnpm check-contrast` plus the full Vitest suite pass after.

### CR-02: Static `--team-accent` fallback fails WCAG AA against the white text it's paired with

**Files modified:** `packages/client/src/styles/tokens.css`, `packages/client/scripts/check-contrast.ts`
**Commit:** 6539c5e
**Applied fix:** Replaced the raw `--team-accent: #f5c518` (gold) fallback — rendered by
`LobbyScreen`/`GameSettingsScreen`, which mount outside `GameBoard`'s root and so never receive the
AA-derived per-team override — with `#b08b08`, pre-derived via
`deriveAaAccentColor('#f5c518', '#262626', '#ffffff')` at authoring time (same hue, darker; 4.71:1
vs `--color-bg-surface-alt`, 3.21:1 vs white text). Also added a `check-contrast.ts` assertion
against the literal `--team-accent` token so a future edit to this value can't silently regress
below AA while the per-team validation loop stays green. Verified the original raw fallback
measured 1.63:1 (failing both AA thresholds) before the fix.

### WR-01: "Confirm Lineup" CTA button missed the border-legibility fix applied to every other CTA button

**Files modified:** `packages/client/src/components/LineupAssignmentScreen.module.css`
**Commit:** f827e95
**Applied fix:** Changed `.confirmButtonGreen`'s `border: none` to
`border: 1px solid var(--color-border-muted)`, matching the equivalent fix already applied to 8
other CTA-button definitions across the codebase (commits `f5effcb`/`961571f`/`1a9d2b9`). Verified
via `stylelint` and confirmed the class is used by both the Standard-mode and draft-mode "Confirm"
buttons (`LineupAssignmentScreen.tsx:702`, `:646`).

### WR-02: `--color-border` token is ~1.1-1.25:1 contrast against the surfaces it borders

**Files modified:** `packages/client/src/styles/tokens.css`
**Commit:** 67e07ec
**Applied fix:** Changed `--color-border` from `#262626` (same swatch as `--color-bg-surface-alt`,
measuring ~1.13-1.24:1 against the surfaces it borders — well below WCAG SC 1.4.11's 3:1
UI-component minimum) to reuse `--color-border-muted`'s value (`#a0a0a0`, confirmed 5.79-7.16:1
against all three background tokens), per the reviewer's suggested concrete fix. This is the
broadest visual change in this fix pass — it affects card/panel/input borders across ~17 files
previously rendered near-invisible. **Flagged for human visual verification**: automated checks
(stylelint, full Vitest suite — 416 tests) all pass and no test asserts this token's specific
value, but only a human can confirm the new, more visible border treatment matches the intended
design direction for phase 34's charcoal theme.

### WR-03: `.halfTimeKickOff`'s own `color` declaration overrides `.accentHome`/`.accentAway` via CSS cascade order

**Files modified:** `packages/client/src/components/GameBoard.module.css`
**Commit:** 358e0a2
**Applied fix:** Added compound selectors `.halfTimeKickOff.accentHome` / `.halfTimeKickOff.accentAway`
(after the base `.halfTimeKickOff` rule) to raise specificity above the equal-specificity cascade
conflict, so the accent modifier wins only when paired with `.halfTimeKickOff`. Chose this over
dropping `.halfTimeKickOff`'s own `color` declaration entirely, since that class is also used
standalone (no modifier) for the plain "HALF TIME" / "2ND HALF KICK OFF" labels in
`GameBoard.tsx`, which must keep their existing secondary-gray color. Verified via `stylelint` and
the `GameBoard.test.tsx` suite (27 tests).

### WR-04: WCAG reference colors (`#121212`/`#ffffff`) are hardcoded in four separate places

**Files modified:** `packages/client/src/hooks/useTeamColors.ts`, `packages/client/scripts/check-contrast.ts`, `packages/client/src/hooks/useTeamColors.test.ts`, `packages/client/src/components/GameBoard.test.tsx`
**Commit:** 2df0861
**Applied fix:** Exported `AA_REFERENCE_BG_HEX`/`AA_REFERENCE_FG_HEX` as named constants from
`useTeamColors.ts` (single source of truth for the values CR-01 corrected). Updated
`useTeamColors.test.ts` and `GameBoard.test.tsx` to import these constants instead of re-hardcoding
their own literal copies. Added a `check-contrast.ts` assertion that the live `tokens.css` values
for `--color-bg-surface-alt`/`--color-text-inverse` match these constants, so a future retune of
either token fails CI loudly instead of shipping a silent drift regression.

### WR-05: `hexToRgb` has no input validation — 3-digit hex shorthand silently produces `NaN`

**Files modified:** `packages/client/src/hooks/useTeamColors.ts`, `packages/client/src/hooks/useTeamColors.test.ts`
**Commit:** 63f1916
**Applied fix:** Added a `normalizeHex()` helper that expands 3-digit shorthand (e.g. `fff` →
`ffffff`) before `hexToRgb` parses it. Reproduced the original bug (`deriveAaAccentColor('#125', ...)`
produced a hex string containing the literal `"nan"` before the fix) and added a regression test
(`useTeamColors.test.ts`) asserting the output always matches `/^#[0-9a-f]{6}$/i` for a
3-digit-shorthand input that fails AA and must go through the full derivation pipeline.

### WR-06: `ActionLog.tsx`'s team-accent-as-text usage bypasses the new AA derivation

**Files modified:** `packages/client/src/components/ActionLog.tsx`
**Commit:** 8cb43e4
**Applied fix:** Added an `aaTeamAccentColor()` wrapper (calls `deriveAaAccentColor` directly —
a plain function, so no Rules-of-Hooks concern applies inside this module's per-event helper
loops) validated against the same shared `AA_REFERENCE_BG_HEX`/`AA_REFERENCE_FG_HEX` constants
(WR-04). Routed `pieceColorOf()`, `slotTeamColor()`, and the five direct
`teamAccentColor(undefined)` fallback-gray call sites through it, so the match-log panel — the one
"accent-as-text on dark chrome" surface this phase's AA derivation never reached — now derives
AA-safe colors consistently with `GameBoard.tsx`. Note: ActionLog's own panel background
(`--color-bg-surface`, #1c1c1c) is darker than the shared reference (`--color-bg-surface-alt`,
#262626), so reusing the shared, harder-case reference is correct and sufficient. Verified via
`ActionLog.test.tsx` (26 tests, no color-value regressions) and the full client suite (416 tests).

## Skipped Issues

None — all 8 in-scope findings (CR-01, CR-02, WR-01 through WR-06) were fixed. The 5 Info-tier
findings (IN-01 through IN-05) were excluded by `fix_scope: critical_warning` and were not
attempted.

---

_Fixed: 2026-07-26T23:25:06Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
