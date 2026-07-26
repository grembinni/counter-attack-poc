---
phase: 33-design-tokens-highlight-standardization
reviewed: 2026-07-25T00:00:00Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - docs/HIGHLIGHT-REFERENCE.md
  - packages/client/src/components/ActionLog.module.css
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.module.css
  - packages/client/src/components/BallLocationRing.test.tsx
  - packages/client/src/components/BallLocationRing.tsx
  - packages/client/src/components/DisconnectBanner.module.css
  - packages/client/src/components/EventBanner.module.css
  - packages/client/src/components/FreeKickSetupPanel.module.css
  - packages/client/src/components/FreeKickSetupPanel.tsx
  - packages/client/src/components/GameBoard.module.css
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameSettingsScreen.module.css
  - packages/client/src/components/HexCell.test.tsx
  - packages/client/src/components/HexCell.tsx
  - packages/client/src/components/HexGrid.module.css
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/KickOffSetupPanel.module.css
  - packages/client/src/components/KickOffSetupPanel.tsx
  - packages/client/src/components/LineupAssignmentScreen.module.css
  - packages/client/src/components/LobbyScreen.module.css
  - packages/client/src/components/PieceOverlay.test.tsx
  - packages/client/src/components/PieceOverlay.tsx
  - packages/client/src/components/PlayerStatsPanel.module.css
  - packages/client/src/components/ReplayPanel.module.css
  - packages/client/src/components/TeamSelectionScreen.module.css
  - packages/client/src/components/UniformSelectionScreen.module.css
  - packages/client/src/main.tsx
  - packages/client/src/styles/tokens.css
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-07-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 30 (29 listed above; `tokens.css` counted once)
**Status:** issues_found

## Summary

This phase (a) introduces `packages/client/src/styles/tokens.css` as a single chrome
design-token layer and migrates ~20 `.module.css` files plus a handful of inline-style
call sites from hardcoded hex/rgba literals to `var(--token)` references, and (b)
consolidates the highlight/ring color system (`HexCell.tsx` `HIGHLIGHT_STYLES`/
`RING_STYLES`, `PieceOverlay.tsx` selection rings, and the new `BallLocationRing.tsx`
standalone marker), documenting the result in `docs/HIGHLIGHT-REFERENCE.md`.

I verified every migrated CSS value against its `tokens.css` token by diffing against
the pre-phase commit (`f6f7618`) — all substitutions are value-faithful (no drift). I
ran the full client test suite (23 files / 407 tests) and `tsc --noEmit`; both are
clean. I traced the `HexGrid.tsx` highlight-priority ternary refactor (inline
per-hex `<polygon>` siblings consolidated into `HexCell`'s `highlightType`/`ring`
props) line-by-line against the pre-phase version and found the click/priority
semantics preserved exactly, matching the extensive existing/added test coverage.

No BLOCKER-tier defects were found. There is one documentation-accuracy WARNING (the
new highlight-reference doc overclaims an "app-wide" red-color invariant that is
contradicted elsewhere in the same codebase) and two minor INFO items (pre-existing
dead CSS classes surfaced in a reviewed file, and an undocumented cosmetic tweak from
a tint consolidation).

## Warnings

### WR-01: HIGHLIGHT-REFERENCE.md's "red = offside only, app-wide" rule is factually inaccurate as written

**File:** `docs/HIGHLIGHT-REFERENCE.md:25, 31-33`
**Issue:** The doc states, without qualification: _"🔴 Red ... reserved exclusively for
the offside ring. No other element in the app uses red for any other meaning."_ and
_"Red renders for exactly one meaning app-wide — the offside ring."_ This is not true
of the app as a whole — only of the three highlight/ring mechanisms this document
scopes itself to in its opening paragraph. The same red swatch (`--color-danger:
#ef4444` in `tokens.css`, and the raw `#ef4444` literal in
`packages/client/src/components/PitchMarkings.tsx` for the final-third boundary tick
lines) is used throughout the app's chrome layer for: error/waiting text
(`ActionPanel`, `FreeKickSetupPanel`, `KickOffSetupPanel`, `LobbyScreen`,
`GameSettingsScreen`'s dependents), disabled/danger button states, the "rare" draft
card tier border in `LineupAssignmentScreen.module.css` (`.cardTierRare`), and the
final-third pitch markings in `PitchMarkings.tsx`. A future contributor reading this
doc's literal claim could reasonably (and incorrectly) conclude that _any_ other red
usage in the app is a bug to fix, or could be misled about how strict the invariant
actually is when auditing "why is there red here."
**Fix:** Scope the claim explicitly, e.g.: _"Within the hex-tint/ring/overlay
highlight system documented here, red renders for exactly one meaning — the offside
ring. (Chrome-layer red, e.g. `--color-danger` error text/disabled states and the
`PitchMarkings.tsx` final-third tick lines, is a separate token system and is out of
scope for this rule.)"_

## Info

### IN-01: Six dead CSS classes remain in `GameBoard.module.css`

**File:** `packages/client/src/components/GameBoard.module.css:405-464` (`.overlayHeading`,
`.overlayScoreRow`, `.overlayScoreSection`, `.overlayInfoRow`, `.overlayTeamLabel`,
`.overlayResultLine`)
**Issue:** None of these six classes are referenced by any `className` in
`GameBoard.tsx` (verified via full-repo grep) — the HALF_TIME/FULL_TIME overlay markup
uses `.halfTimeScoreRow`/`.halfTimeCenter*`/`.halfTimeScore` instead. This is
pre-existing dead code (present before this phase's diff, not introduced by it), but
it sits directly beside the classes this phase migrated to `var(--token)` in the same
file, so a token audit of this file will find "used" tokens (`--color-text-primary`,
`--color-text-secondary` at `.overlayHeading`/`.overlayBody`) baked into unreachable
rules.
**Fix:** Delete the six unused rules, or if they're intentionally kept for a
near-term follow-up layout, add a one-line comment saying so.

### IN-02: GK_QUICK_THROW tint consolidation silently drops the target hex's stroke

**File:** `packages/client/src/components/HexCell.tsx:82-88` (`'pass-target'` entry in
`HIGHLIGHT_STYLES`), `docs/HIGHLIGHT-REFERENCE.md:61`
**Issue:** Prior to this phase, the `GK_QUICK_THROW` inline tint rendered
`stroke="rgba(34,197,94,0.6)"` with `strokeWidth={1}` (a visible green outline) in
addition to its fill. The consolidated `'pass-target'` `HIGHLIGHT_STYLES` entry it was
merged into has `stroke: 'none', strokeWidth: 0` — the outline is gone. The
HIGHLIGHT-REFERENCE.md changelog note for this merge only calls out "the ~1% opacity
difference was not an intentional design distinction," but doesn't mention the stroke
removal, so this small additional visual change isn't documented anywhere. It's very
likely an intentional simplification (a "no visual change" boundary was declared only
for `tokens.css`'s chrome values, not for this highlight-system consolidation), but as
written the changelog undersells the actual delta.
**Fix:** Either restore a stroke on `pass-target` matching the pre-existing quick-throw
outline, or add one sentence to the HIGHLIGHT-REFERENCE.md note acknowledging the
stroke was also dropped as part of the merge (not just the opacity).

---

_Reviewed: 2026-07-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
