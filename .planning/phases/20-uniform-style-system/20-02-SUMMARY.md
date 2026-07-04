---
phase: 20-uniform-style-system
plan: 02
subsystem: ui
tags: [svg, react, typescript, uniform, renderer, pattern, client]

# Dependency graph
requires:
  - phase: 20-01
    provides: UniformStyleId string union + UNIFORM_STYLE_META from @counter-attack/shared

provides:
  - UniformRenderParams interface (cx, cy, R, palette, isGK, pieceId)
  - UniformRenderResult interface (patternDef, fill, overlay)
  - UniformStyleRenderer function type
  - UNIFORM_STYLES Record<UniformStyleId, UniformStyleRenderer> — 12 renderer functions
  - packages/client/src/styles/uniformStyles.tsx
  - packages/client/src/styles/uniformStyles.test.tsx (26 tests — green)

affects:
  - 20-03 (PieceOverlay refactor — imports UNIFORM_STYLES + types from this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - UniformStyleRenderer function-per-style returning { patternDef, fill, overlay }
    - pieceId-seeded SVG pattern/gradient/clipPath ids (Pitfall 1 guard)
    - patternUnits="userSpaceOnUse" with x/y anchor at cx-R/cy-R (Pitfall 4 guard)
    - overlay sibling elements with pointerEvents="none"
    - GK palette swap applied by caller before renderer invocation (D-13)

key-files:
  created:
    - packages/client/src/styles/uniformStyles.tsx
    - packages/client/src/styles/uniformStyles.test.tsx
  modified: []

key-decisions:
  - "diagonal renderer uses palette.secondary1 (not secondary2) to match v1.2 Crew stroke=#111111 exactly — diverges from D-02 wording but matches Phase 19 teamConfig data and PieceOverlay.tsx line 242"
  - "All overlay sibling elements carry pointerEvents='none' per RESEARCH.md anti-pattern guidance"
  - "fade renderer returns linearGradient (not pattern) in patternDef slot; gradientUnits=userSpaceOnUse with x1/y1/x2/y2 bounding the piece"
  - "tree-rings uses overlay concentric circles (no pattern tile) per Pitfall 5 guidance"
  - "corners renderer embeds clipPath in patternDef and four polygon triangles in overlay"

patterns-established:
  - "UniformStyleRenderer: function (params: UniformRenderParams) => UniformRenderResult"
  - "SVG id uniqueness: id=`${styleName}-${pieceId}` / `clip-${styleName}-${pieceId}` / `grad-${styleName}-${pieceId}`"
  - "Pattern anchor: x={cx-R} y={cy-R} patternUnits=userSpaceOnUse on every <pattern>"

requirements-completed: [UNIFORM-01]

# Metrics
duration: 35min
completed: 2026-07-03
---

# Phase 20 Plan 02: Uniform Style Renderer Registry Summary

**12 palette-parameterised SVG renderer functions in UNIFORM_STYLES — pinstripe/diagonal/checker/cosmos geometry reproduced from PieceOverlay v1.2, plus 8 new styles (plus/v-stripe/quarters/polka-dots/fade/tree-rings/corners/solid)**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-03T23:25:00Z
- **Completed:** 2026-07-03T23:45:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created `packages/client/src/styles/uniformStyles.tsx` with all 12 `UniformStyleRenderer` functions and the `UNIFORM_STYLES: Record<UniformStyleId, UniformStyleRenderer>` registry
- Every renderer returns `{ patternDef, fill, overlay }` — palette-only, never inspects teamId, no Math.random
- All pattern/gradient/clipPath ids embed `pieceId` (Pitfall 1 guard); all patterns use `patternUnits="userSpaceOnUse"` with `x/y` anchor (Pitfall 4 guard); all overlay elements carry `pointerEvents="none"`
- Created `packages/client/src/styles/uniformStyles.test.tsx` with 26 passing tests covering 12-style completeness, return-shape, id uniqueness, fade linearGradient DOM assertion, and overlay pointer-events

## Task Commits

1. **Task 1: Implement 12 UniformStyleRenderer functions + UNIFORM_STYLES registry** - `f02dff0` (feat)
2. **Task 2: Add uniformStyles.test.tsx** - `b0f7b37` (test)

## Files Created/Modified

- `packages/client/src/styles/uniformStyles.tsx` — 12 renderer consts + `UNIFORM_STYLES` registry + exported interfaces; 409 lines
- `packages/client/src/styles/uniformStyles.test.tsx` — 26 tests across 6 describe blocks; 206 lines

## Decisions Made

- **diagonal uses palette.secondary1**: D-02 wording says `secondary2` but Phase 19 Crew palette has near-black at `secondary1` (`#111111`) and forest green at `secondary2` (`#14532d`). v1.2 PieceOverlay.tsx line 242 hardcodes `stroke="#111111"` = `secondary1`. Renderer uses `secondary1` with code comment documenting the D-02 divergence.
- **fade uses linearGradient**: `patternDef` slot holds a `<linearGradient>` (not `<pattern>`) as specified in D-09 and RESEARCH.md Pattern 5. Fill is `url(#grad-fade-${pieceId})`.
- **tree-rings uses overlay circles**: No tile pattern — `patternDef: null`, base fill = `primary`, overlay = 3 concentric circles at r=12/8/4 per RESEARCH.md Pitfall 5.
- **corners embeds clipPath in patternDef**: `patternDef` holds the `<clipPath>` Fragment; overlay holds 4 polygon corner triangles clipped to circle boundary.
- **Worktree test execution**: Required creating a Windows junction from worktree's `packages/client/node_modules` to main repo's `packages/client/node_modules` to run vitest from the worktree (shared git object store, separate working tree). Pre-existing jsdom issue (`@csstools/css-calc` empty dir) fixed by `pnpm install --force`.

## Deviations from Plan

None — plan executed exactly as written. The diagonal `secondary1` vs `secondary2` usage was already documented as the resolution in RESEARCH.md "Open Questions (RESOLVED)".

## Issues Encountered

- Pre-existing broken jsdom installation (`@csstools/css-calc` dir was empty in pnpm store) prevented all client tests from running. Fixed with `pnpm install --force` — this restored the missing package contents and unblocked the entire test suite (249 existing tests also now pass).
- Worktree vitest execution required a Windows directory junction from the worktree's `packages/client/node_modules` to the main repo's equivalent, since git worktrees share git objects but not node_modules. The junction is not committed (gitignored) and is local to this session.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None — all 12 renderers produce palette-driven SVG output with no placeholder data.

## Next Phase Readiness

- `UNIFORM_STYLES` registry is complete and type-checked. Plan 20-03 (PieceOverlay refactor) can import `UNIFORM_STYLES`, `UniformStyleRenderer`, `UniformRenderParams`, `UniformRenderResult` from `../styles/uniformStyles.js` immediately.
- TypeScript is clean (`tsc --noEmit` exits 0 for both `packages/client` and `packages/shared`).
- 26 unit tests green; covers all acceptance criteria.

---
*Phase: 20-uniform-style-system*
*Completed: 2026-07-03*

## Self-Check: PASSED

- FOUND: `packages/client/src/styles/uniformStyles.tsx`
- FOUND: `packages/client/src/styles/uniformStyles.test.tsx`
- FOUND: `.planning/phases/20-uniform-style-system/20-02-SUMMARY.md`
- FOUND: commit `f02dff0` (Task 1 — feat)
- FOUND: commit `b0f7b37` (Task 2 — test)
- FOUND: commit `03429c1` (docs — SUMMARY)
