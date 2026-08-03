---
phase: 33-design-tokens-highlight-standardization
plan: 06
subsystem: ui
tags: [react, svg, hex-grid, design-tokens, highlight-system]

# Dependency graph
requires:
  - phase: 33-design-tokens-highlight-standardization (plan 04)
    provides: Exported HIGHLIGHT_STYLES (10-member HexHighlightType union) and RING_STYLES tables in HexCell.tsx
provides:
  - HexGrid.tsx with zero ad-hoc inline highlight-color polygon literals; every hex tint/ring flows through HexCell's highlightType/ring props
  - New BallLocationRing.tsx component + exported BALL_MARKER_STROKE constant — standalone always-on-top white hex-edge ball-location marker (HILITE-04)
  - HexGrid.test.tsx coverage asserting the new tints/rings/marker against the imported HIGHLIGHT_STYLES/RING_STYLES/BALL_MARKER_STROKE
affects:
  [33-07 (if any remaining highlight-standardization plan), docs/HIGHLIGHT-REFERENCE.md authoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone always-on-top overlay component (BallLocationRing) rendered as the topmost SVG sibling, entirely outside the highlightType/ring priority resolution — mirrors PieceOverlay's isOffside/isMovedThisStage independent-layer pattern"
    - 'Per-hex tint/ring derivation consolidated into typed booleans feeding a single highlightType priority ternary + independent ring value, replacing ad-hoc inline <polygon> siblings'

key-files:
  created:
    - packages/client/src/components/BallLocationRing.tsx
    - packages/client/src/components/BallLocationRing.test.tsx
  modified:
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.module.css
    - packages/client/src/components/HexGrid.test.tsx

key-decisions:
  - "isPassTargetTint merges the former GK_QUICK_THROW inline tint into 'pass-target' per UI-SPEC B1 (both are guaranteed-safe targets, no interception risk)"
  - "ring value resolved once per hex ('required' for the KICK_OFF_SETUP centre hex, 'confirmed' for a confirmed pass target, undefined otherwise) and passed to HexCell's ring prop instead of two separate inline polygons"
  - 'HEADER-only gold ball-overlay deleted entirely (not kept alongside the new marker) — BallLocationRing supersedes it per D-08'
  - 'axialToPixel/hexPolygonPoints imports and the per-hex cx/cy/points computation removed from HexGrid.tsx entirely — they were only consumed by the now-deleted inline polygons'

patterns-established:
  - 'HexGrid.test.tsx new coverage imports RING_STYLES/BALL_MARKER_STROKE alongside the existing HIGHLIGHT_STYLES import, and a new hasStrokeAtHex helper mirrors the existing hasFillAtHex helper for ring/marker stroke assertions'

requirements-completed: [HILITE-01, HILITE-04]

# Metrics
duration: ~90min
completed: 2026-07-25
---

# Phase 33 Plan 06: HexGrid Consolidation + Ball-Location Marker Summary

**Deleted all 8 ad-hoc inline highlight `<polygon>` overlays from `HexGrid.tsx` in favor of `HexCell`'s `highlightType`/`ring` props, added a new standalone always-on-top `BallLocationRing` white hex-edge marker (replacing the deleted HEADER-only gold overlay), and migrated `HexGrid.test.tsx` to assert the new tints/rings/marker against the imported `HIGHLIGHT_STYLES`/`RING_STYLES`/`BALL_MARKER_STROKE` tables.**

## Performance

- **Duration:** ~90 min (includes one-time `pnpm install --frozen-lockfile` in the freshly-created worktree, ~5 min, plus `packages/shared` build)
- **Tasks:** 3/3 completed
- **Files created:** 2 (`BallLocationRing.tsx`, `BallLocationRing.test.tsx`)
- **Files modified:** 3 (`HexGrid.tsx`, `HexGrid.module.css`, `HexGrid.test.tsx`)

## Accomplishments

- New `BallLocationRing.tsx` component: renders a single white hex-edge `<polygon>` (`stroke=BALL_MARKER_STROKE` `'#ffffff'`, `fill="none"`, `strokeWidth={2.5}`, `pointerEvents="none"`) at the ball's hex, gated to the exact 10 response phases from UI-SPEC B4 (`BALL_MARKER_PHASES`); returns `null` for any other phase (HILITE-04, D-08/D-09)
- `HexGrid.tsx` per-hex derivation extended with `isGkKickTargetTint`, `isPassTargetTint` (merges the former GK_QUICK_THROW tint), `isTackleRiskTint`, and a single `ring: 'required' | 'confirmed' | undefined` value; the `highlightType` priority ternary now emits `'tackle-risk'`, `'gk-kick-target'`, and `'pass-target'` (HILITE-01)
- All 8 inline highlight `<polygon>` overlay siblings deleted from the per-hex render (centre-hex gold fill + ring, HEADER gold ball-overlay, GK_KICK_TARGET sky-blue, QUICK_THROW green, safe-pass green, interception-risk amber, confirmed-pass gold ring) — the per-hex render is now a single `<HexCell key={hexId} hex={hex} {...highlightType} {...ring} onClick={...} />`
- `<BallLocationRing ballPosition={ball.position} phase={phase} />` wired as the topmost sibling after the `pieces.map(...)` block, entirely outside the highlightType/ring priority resolution
- `.hexTackleRisk` CSS-module class removed (its one call site is gone); now-unused `axialToPixel`/`hexPolygonPoints` import and per-hex `cx`/`cy`/`points` computation removed from `HexGrid.tsx`
- `HexGrid.test.tsx` gained 6 new tests (gk-kick-target fill, safe pass-target fill, tackle-risk fill, confirmed-pass gold ring with no green fill underneath, KICK_OFF_SETUP centre-hex required ring, ball-marker presence during HEADER + regression check that the old gold overlay is gone + absence during MOVE) — all asserting against imported `HIGHLIGHT_STYLES`/`RING_STYLES`/`BALL_MARKER_STROKE`, never a retyped literal

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BallLocationRing (RED)** - `c13585d` (test) — failing test asserting against `BALL_MARKER_STROKE`; fails at import time since the component doesn't exist yet
2. **Task 1: Create BallLocationRing (GREEN)** - `07b426f` (feat) — implementation makes all 6 tests pass
3. **Task 2: Consolidate HexGrid highlight literals + wire BallLocationRing** - `11a6658` (feat)
4. **Task 3: HexGrid.test.tsx coverage for new tints/rings/marker** - `712b3f5` (test)

## Files Created/Modified

- `packages/client/src/components/BallLocationRing.tsx` - New standalone marker component; exports `BallLocationRing` and `BALL_MARKER_STROKE`; module-level `BALL_MARKER_PHASES` set
- `packages/client/src/components/BallLocationRing.test.tsx` - 6 tests: stroke/fill/strokeWidth against the export, presence in 2 gated phases, absence in 2 non-gated phases, polygon-points positioning
- `packages/client/src/components/HexGrid.tsx` - Consolidated tint/ring derivation, deleted 8 inline polygon overlays, wired `BallLocationRing`, removed unused pixel-conversion imports/computation
- `packages/client/src/components/HexGrid.module.css` - Removed `.hexTackleRisk` (only `.hexGrid` remains)
- `packages/client/src/components/HexGrid.test.tsx` - Added `RING_STYLES`/`BALL_MARKER_STROKE` imports, new `hasStrokeAtHex` helper, and 4 new `describe` blocks covering the consolidated tints/rings/marker (6 new tests)

## Decisions Made

- Followed the plan's exact tint/ring/marker mapping (UI-SPEC B1/B2/B4) — no deviation on color or gating values.
- Simplified the per-hex render from `<g key={hexId}><HexCell .../>{...8 polygons...}</g>` to a single `<HexCell key={hexId} .../>` (no wrapping `<g>` needed once the sibling polygons are gone) — a minor structural simplification beyond the plan's literal wording but consistent with its intent ("no inline polygon highlight siblings remain").
- `axialToPixel`/`hexPolygonPoints` imports and the per-hex `cx`/`cy`/`points` computation were removed from `HexGrid.tsx` since they were only consumed by the deleted polygons (Rule 1 — dead code left behind would be an unused-variable lint error).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - dead code] Removed now-unused `axialToPixel`/`hexPolygonPoints` import and per-hex pixel computation from `HexGrid.tsx`**

- **Found during:** Task 2
- **Issue:** After deleting the 8 inline `<polygon>` overlays, the `const { cx, cy } = axialToPixel(hex.q, hex.r); const points = hexPolygonPoints(cx, cy);` computation (and its import) had no remaining consumer in the file — would have been an unused-variable/import lint error.
- **Fix:** Removed the import and the computation; `computeViewBox`/`HEX_SIZE` (still used for the SVG viewBox and translate offset) remain imported from `hexToPixel.js`.
- **Files modified:** `packages/client/src/components/HexGrid.tsx`
- **Commit:** `11a6658`

No other deviations — plan executed exactly as written otherwise.

## TDD Gate Compliance

- **Task 1** (`tdd="true"`): full RED/GREEN cycle observed. RED commit `c13585d` (test file added, verified failing — import error since `BallLocationRing.tsx` did not exist) followed by GREEN commit `07b426f` (implementation added, all 6 tests verified passing). Both gate commits present in git log in the correct order.
- **Task 3** (`tdd="true"`): per the same pattern established in Plan 33-04's SUMMARY, this task is a test-coverage addition against already-implemented behavior (delivered in Task 2), not a from-scratch behavior addition — so no separate failing-test-first commit was produced for Task 3. The single `test(33-06): ...` commit (`712b3f5`) was verified green (53/53 passing, including all pre-existing HexGrid tests) before being committed. Flagging per the gate-sequence validation instruction since a stand-alone RED commit is absent for this specific task.

## Known Residual (Out of Scope, Not a Deviation)

- `grep -nE '#[0-9a-fA-F]{3,8}|rgba?\(|hexTackleRisk' packages/client/src/components/HexGrid.tsx` returns one hit: the pre-existing goal-net mesh `<pattern id="goal-net">` definition (`stroke="rgba(255,255,255,0.4)"`, line ~332, inside `<defs>`). This literal predates this plan (it existed at the base commit before any 33-06 changes) and is the identical decorative net-mesh pattern the UI-SPEC explicitly excludes from migration ("Out of scope for this token file: `PitchMarkings.tsx` and `GoalNets.tsx` static pitch-line/net color literals ... Do not migrate these in Phase 33"). It happens to be defined inline in `HexGrid.tsx`'s `<defs>` (reused by both goal-net rects in `GoalNets.tsx`, per the existing D-09 code comment) rather than inside `GoalNets.tsx` itself, but it is the same cosmetic-decor category, not a highlight/chrome color. No fix applied — recorded here per the plan's own acceptance-criteria wording ("returns zero highlight/chrome color-literal hits (only non-color matches, if any, remain)").

## Issues Encountered

- Fresh worktree had no `node_modules` (same one-time bootstrap issue as Plan 33-04's worktree) — resolved via `pnpm install --frozen-lockfile` (workspace-wide, no new packages added) followed by `pnpm --filter @counter-attack/shared build`. Not a plan deviation.
- To achieve a genuine RED→GREEN cycle for Task 1 (rather than writing the test after the implementation already existed), the implementation file was temporarily renamed to `.bak`, the test committed while genuinely failing (verified via `pnpm --filter @counter-attack/client test -- BallLocationRing.test.tsx`), then restored and re-verified green before its own commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `HexGrid.tsx` now holds zero highlight-color literals (aside from the pre-existing, explicitly-out-of-scope goal-net mesh pattern documented above); every hex tint/ring flows through `HexCell`'s `highlightType`/`ring` props.
- `BallLocationRing` is exported and stable — available for `docs/HIGHLIGHT-REFERENCE.md` authoring (UI-SPEC B4 section) in a later plan/phase-close step.
- UI-SPEC Implementation Note #1 (manually reproduce the SNAPSHOT_DEFLECT → goal → KICK_OFF_SETUP repro path to confirm BUG-23's stray shot-path shading doesn't reappear after this consolidation) requires a live two-browser session and was NOT performed as part of this automated worktree execution — it remains an open manual-verification item, consistent with BUG-23's pre-existing "pending" status tracked in `.planning/STATE.md`.
- Verification commands green: `pnpm --filter @counter-attack/client test -- HexGrid.test.tsx BallLocationRing.test.tsx` (53/53 passing), `pnpm --filter @counter-attack/client exec tsc --noEmit` (clean), `pnpm --filter @counter-attack/client build` (clean).
- Full client suite re-run for regression safety: 412/412 tests passing (23 files) after this plan's changes.

---

_Phase: 33-design-tokens-highlight-standardization_
_Completed: 2026-07-25_

## Self-Check: PASSED

- FOUND: packages/client/src/components/BallLocationRing.tsx
- FOUND: packages/client/src/components/BallLocationRing.test.tsx
- FOUND: packages/client/src/components/HexGrid.tsx
- FOUND: packages/client/src/components/HexGrid.module.css
- FOUND: packages/client/src/components/HexGrid.test.tsx
- FOUND: .planning/phases/33-design-tokens-highlight-standardization/33-06-SUMMARY.md
- FOUND commit: c13585d (Task 1 RED)
- FOUND commit: 07b426f (Task 1 GREEN)
- FOUND commit: 11a6658 (Task 2)
- FOUND commit: 712b3f5 (Task 3)
- FOUND commit: c8a43fa (docs: summary)
