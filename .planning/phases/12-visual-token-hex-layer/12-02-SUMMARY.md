---
phase: 12-visual-token-hex-layer
plan: "02"
subsystem: ui
tags: [react, svg, typescript, vitest, hex-grid, testing-library]

requires:
  - phase: 12-01
    provides: PieceOverlay selectionState enum pattern (analog for typed-prop refactor approach)

provides:
  - HexHighlightType union type ('safe' | 'risk' | 'goal' | 'kickoff' | 'shot-path') exported from HexCell.tsx
  - HIGHLIGHT_STYLES lookup table with per-type fill/restOpacity/hoverOpacity/stroke/strokeWidth
  - HexCell.test.tsx with 6 behavior assertions covering all 5 tints + no-highlight case
  - Updated HexCell Props: highlightType?: HexHighlightType replaces isHighlighted + highlightColor

affects: [12-04-hex-grid-consolidation, HexGrid.tsx consumers]

tech-stack:
  added: []
  patterns:
    - "HIGHLIGHT_STYLES internal lookup table pattern: semantic type → style object, avoids prop-drilling of style values"
    - "TDD RED/GREEN for leaf SVG component: test via container.querySelectorAll('polygon') + getAttribute('fill')"
    - "eslint.config.js unsafe-rule overrides extended to *.test.tsx (was *.test.ts only)"

key-files:
  created:
    - packages/client/src/components/HexCell.test.tsx
  modified:
    - packages/client/src/components/HexCell.tsx
    - eslint.config.js

key-decisions:
  - "D-10: highlightType enum prop replaces free-form isHighlighted/highlightColor props; HIGHLIGHT_STYLES owns all tint color values as single source of truth"

patterns-established:
  - "IIFE pattern for conditional overlay polygon: `{highlightType !== undefined && (() => { const s = HIGHLIGHT_STYLES[highlightType]; return <polygon .../> })()}`"

requirements-completed: [UX-06]

duration: 5m 45s
completed: 2026-06-12
---

# Phase 12 Plan 02: HexCell Highlight Tint Refactor Summary

**HexCell refactored to replace free-form isHighlighted/highlightColor props with typed highlightType enum backed by HIGHLIGHT_STYLES lookup table; 6 unit tests GREEN**

## Performance

- **Duration:** 5m 45s
- **Started:** 2026-06-12T10:31:41Z
- **Completed:** 2026-06-12T10:37:26Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Exported `HexHighlightType = 'safe' | 'risk' | 'goal' | 'kickoff' | 'shot-path'` from HexCell.tsx (D-10)
- Internal `HIGHLIGHT_STYLES` record maps each type to exact fill, restOpacity, hoverOpacity, stroke, strokeWidth per UI-SPEC
- HexCell Props: removed `isHighlighted: boolean` and `highlightColor?: string`; added `highlightType?: HexHighlightType`
- Base polygon onClick/cursor gated on `highlightType !== undefined` (no-tint hex is non-interactive)
- All 6 HexCell.test.tsx assertions GREEN: 5 tint rgba values + undefined no-overlay case

## Task Commits

Each task was committed atomically:

1. **Task 1: HexCell unit test scaffold (RED)** - `11a524f` (test)
2. **Task 2: Refactor HexCell — GREEN** - `398f949` (feat)

_TDD plan: RED commit then GREEN commit per cycle._

## Files Created/Modified

- `packages/client/src/components/HexCell.test.tsx` - 6 behavior assertions for UX-06 tint colors
- `packages/client/src/components/HexCell.tsx` - Exports HexHighlightType + HIGHLIGHT_STYLES; Props refactored
- `eslint.config.js` - Extended unsafe-rule overrides to include _.test.tsx (was _.test.ts only)

## Decisions Made

- **D-10 implemented:** Typed `highlightType` enum replaces free-form `highlightColor` string. All tint color values owned by internal `HIGHLIGHT_STYLES` table — single source of truth for hex tints.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extended eslint test file overrides to \*.test.tsx**

- **Found during:** Task 1 (test scaffold commit)
- **Issue:** eslint.config.js relaxed `@typescript-eslint/no-unsafe-*` rules for `**/*.test.ts` but not `**/*.test.tsx`. The pre-commit hook rejected HexCell.test.tsx with `no-unsafe-assignment` error. `allowDefaultProject` also only covered `.test.ts`.
- **Fix:** Added `'**/*.test.tsx'` to both the unsafe-rules override block and the `allowDefaultProject` array in `eslint.config.js`
- **Files modified:** `eslint.config.js`
- **Verification:** eslint passes on HexCell.test.tsx with no errors
- **Committed in:** `11a524f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical config coverage)
**Impact on plan:** Essential for commit hook to accept .tsx test files. No scope creep.

## Issues Encountered

None — once the eslint config gap was addressed, both TDD phases proceeded cleanly.

## TDD Gate Compliance

- RED gate: `test(12-02)` commit `11a524f` — 5 of 6 tests failing as expected
- GREEN gate: `feat(12-02)` commit `398f949` — all 6 tests passing

## Next Phase Readiness

- HexCell now exposes `HexHighlightType` and `HIGHLIGHT_STYLES` for Plan 04 (HexGrid consolidation)
- HexGrid.tsx still passes old `isHighlighted`/`highlightColor` props — expected TypeScript errors until Plan 04 lands
- Plan 03 (PieceOverlay selectionState) is independent and can proceed without blocking

---

_Phase: 12-visual-token-hex-layer_
_Completed: 2026-06-12_
