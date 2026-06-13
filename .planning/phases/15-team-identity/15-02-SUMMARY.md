---
phase: 15-team-identity
plan: 02
subsystem: ui
tags: [typescript, react, svg, jersey-patterns, team-identity, tdd]

# Dependency graph
requires:
  - phase: 15-01
    provides: TEAM_CONFIGS, TEAM_DEFAULTS, TeamId union
provides:
  - cosmos-jersey SVG pattern in PieceOverlay (24px tile, navy + white stripe)
  - xolos-jersey SVG pattern in PieceOverlay (16px tile, orange + grey checker)
  - city-jersey SVG pattern in PieceOverlay (4px tile, crimson + gold stripe + arch path)
  - crew-jersey SVG pattern in PieceOverlay (8px tile, gold + diagonal black + shoulder mask)
  - home-gk-checker SVG pattern in PieceOverlay (12px tile, purple checker)
  - away GK edge stripe sibling rects in PieceOverlay
  - D-06 color refactor: TEAM_CONFIGS[TEAM_DEFAULTS[piece.teamId]] replaces positional literals
affects: [15-03, phase-16-team-selection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SVG patternUnits=userSpaceOnUse anchored to piece bounding box (cx - PIECE_RADIUS, cy - PIECE_RADIUS)
    - Sibling SVG elements (path/rect) with pointerEvents=none for non-repeating overlays (arch, mask, stripes)
    - Per-piece pattern id suffix (piece.id) to prevent SVG id collisions (T-15-02 threat mitigation)
    - TEAM_CONFIGS[TEAM_DEFAULTS[piece.teamId]] color lookup as single source of truth (D-06)

key-files:
  modified:
    - packages/client/src/components/PieceOverlay.tsx
    - packages/client/src/components/PieceOverlay.test.tsx

key-decisions:
  - 'Both TDD tasks (outfield jerseys + GK jerseys) executed in single RED/GREEN cycle — tests written before implementation, both committed atomically'
  - 'Home GK uses url(#home-gk-checker-{piece.id}) pattern fill replacing solid #9b59b6; away GK retains solid amber base with sibling stripe rects (per RESEARCH Pattern 7: two fixed-position edge stripes simpler than repeating pattern)'
  - 'Crew shoulder mask implemented as solid gold rect sibling (y=cy-PIECE_RADIUS*0.4, height=PIECE_RADIUS*1.4) covering lower 70% — simpler than clipPath approach described in UI-SPEC'
  - 'Pre-existing ActionPanel KICK_OFF test failure and tsc ballAfter errors confirmed pre-existing (present on main before plan; out of scope per deviation rules)'

patterns-established:
  - 'Pattern: All four outfield jersey patterns defined in single <defs> block gated on !isGK'
  - 'Pattern: Home GK checker pattern in separate <defs> block gated on isGK && piece.teamId === home'
  - 'Pattern: Non-repeating overlays (City arch, Crew mask, Away GK stripes) as sibling elements after base circle, all pointerEvents=none'

requirements-completed: [TEAM-02, TEAM-03, TEAM-04, TEAM-05]

# Metrics
duration: ~4min
completed: 2026-06-13
---

# Phase 15 Plan 02: Jersey Patterns + GK Identity Summary

**Four per-team outfield SVG jersey patterns (cosmos/xolos/city/crew) + home GK checker + away GK edge stripes applied to PieceOverlay.tsx via TEAM_DEFAULTS-keyed fills; positional color literals fully replaced with TEAM_CONFIGS lookup (D-06)**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-13T13:57:39Z
- **Completed:** 2026-06-13T14:01:49Z
- **Tasks:** 2 (Task 1+2 combined in single TDD RED/GREEN cycle)
- **Files modified:** 2

## Accomplishments

- `cosmos-jersey-{piece.id}`: 24px tile, `#1e3a8a` base + white `height=12` horizontal stripe at `y=6` (fillOpacity 0.6)
- `xolos-jersey-{piece.id}`: 16px tile, `#ea580c` base + `#6b7280` checker rects at (0,0) and (8,8), each 8x8px (fillOpacity 0.7)
- `city-jersey-{piece.id}`: 4px tile, `#dc143c` base + 1px `#f5c518` vertical stripe at `x=3` (fillOpacity 0.8) + sibling arch `<path>` in lower third
- `crew-jersey-{piece.id}`: 8px tile, `#f5c518` base + diagonal `#111111` line x1=8 y1=0 x2=0 y2=8 (strokeOpacity 0.75) + solid gold shoulder mask rect covering lower 70%
- `home-gk-checker-{piece.id}`: 12px tile, `#7c3aed` base + `#4c1d95` checker at (0,0) 6x6 and (6,6) 6x6
- Away GK: solid `#f59e0b` amber base + two `#ea580c` sibling rects (left at cx-PIECE_RADIUS+4, right at cx+PIECE_RADIUS-7, both width=3 height=PIECE_RADIUS\*2, fillOpacity 0.85)
- D-06 refactor: `const teamId = TEAM_DEFAULTS[piece.teamId]` + `TEAM_CONFIGS[teamId].primaryColor` replaces all `#1a56b0`/`#c0392b` outfield literals
- 16 PieceOverlay tests pass (all new + existing selection ring tests)

## Task Commits

TDD RED/GREEN cycle:

1. **RED: failing tests for jersey patterns + GK + D-06** - `6e21536` (test)
2. **GREEN: PieceOverlay jersey patterns implementation** - `ac1ac1c` (feat)

## Files Created/Modified

- `packages/client/src/components/PieceOverlay.tsx` - Four outfield jersey patterns + home GK checker + away GK edge stripes + D-06 color refactor
- `packages/client/src/components/PieceOverlay.test.tsx` - 16 tests covering team fills, GK patterns, D-06 literal checks, selection rings

## Decisions Made

- Both Task 1 (outfield jerseys) and Task 2 (GK jerseys) delivered in a single TDD RED/GREEN cycle since the behaviors were interdependent in the same file and test suite.
- Crew shoulder mask uses solid gold `<rect>` sibling approach (lower 70% covered), not `<clipPath>`. The PATTERNS.md masking-rect approach is simpler and has the same visual outcome.
- Home GK `<defs>` separated into its own block (gated `isGK && piece.teamId === 'home'`) rather than inside the outfield `!isGK` defs block, to keep conditional logic clean.

## Deviations from Plan

### Auto-noted differences

**1. [Rule 1 - Bug / Consolidation] Tasks 1+2 combined in single TDD cycle**

- **Found during:** Implementation planning
- **Issue:** Both tasks modify the same file and share the same test runner; writing separate RED commits for each would require partial implementation state between commits
- **Fix:** Single RED commit for both sets of behaviors, then single GREEN commit — same net result, cleaner git history
- **Impact:** None on functionality; both plans' acceptance criteria satisfied

## Issues Encountered

- Pre-existing `ActionPanel.test.tsx > Start Movement button for KICK_OFF phase` test failure (not caused by this plan)
- Pre-existing `tsc --noEmit` errors in `ActionPanel.test.tsx`, `mockGKRestartState.ts`, `mockPassState.ts`, `mockShotState.ts` (missing `ballAfter` field) — confirmed out of scope per 15-01-SUMMARY

## TDD Gate Compliance

- RED gate: commit `6e21536` — `test(15-02)` prefix; 6 tests failing before implementation
- GREEN gate: commit `ac1ac1c` — `feat(15-02)` prefix; all 16 tests passing after implementation

## Known Stubs

None — all four team jersey patterns are fully implemented with exact colors from D-08/UI-SPEC. TEAM_DEFAULTS is intentionally hardcoded (Phase 16 SELECT-01 will introduce dynamic team selection).

## Threat Flags

None — rendering-only SVG changes. T-15-02 (SVG pattern id collision) mitigated: all pattern ids include `piece.id` suffix, verified by tests asserting `home-5`/`away-5` in fill references.

## Self-Check: PASSED

- packages/client/src/components/PieceOverlay.tsx: FOUND
- packages/client/src/components/PieceOverlay.test.tsx: FOUND
- Commit 6e21536 (RED test): FOUND
- Commit ac1ac1c (GREEN impl): FOUND
- grep #1a56b0 (non-comment): 0 occurrences
- grep #c0392b (non-comment): 0 occurrences
- All 16 PieceOverlay tests: PASS
