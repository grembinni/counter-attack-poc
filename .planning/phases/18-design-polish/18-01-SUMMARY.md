---
phase: 18-design-polish
plan: 01
subsystem: ui
tags: [react, typescript, vitest, scoreboard, naming-convention]

# Dependency graph
requires:
  - phase: 17.1-action-flow-cleanup
    provides: GamePhase rename (GK_DIVING -> GK_DIVE), FIRST_TIME_PASS_MOVE phase
provides:
  - DESIGN-01-compliant PHASE_LABEL map for every GamePhase scoreboard label
  - moveSlotSuffix() helper for MOVE-phase numbered slot suffix (4/5/2)
  - 6 new GameBoard tests asserting D-11 corrected label targets
affects: [18-02, 18-03, design-polish-followups]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Flat Record<GamePhase, string> lookup table for scoreboard phase labels (D-02 data-not-templating)'
    - 'Flat Record<MovementSlot, string> lookup for numbered slot suffixes, computed at render call site'

key-files:
  created: []
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.test.tsx

key-decisions:
  - "PASS phase label kept as gerund 'CHOOSING ACTION' per D-11 user correction (not 'CHOOSE ACTION')"
  - 'GK_* phases expanded to GOALIE per D-11 (GOALIE DIVE, GOALIE RESTART, GOALIE KICK)'
  - "SNAPSHOT_DEFLECT and FIRST_TIME_PASS_MOVE use 'RESPONSE MOVE' phrasing; HIGH_PASS_MOVE and GK_KICK_MOVE keep 'REPOSITION' (intentional asymmetry per D-11)"
  - 'Worktree required pnpm install --frozen-lockfile and a one-time packages/shared tsc build to materialize node_modules/dist artifacts before typecheck/tests could run (fresh worktree had neither)'

patterns-established:
  - "moveSlotSuffix(slot) module-level helper mirrors PHASE_LABEL's lookup-table-as-data shape (D-02)"

requirements-completed: [DESIGN-01]

# Metrics
duration: ~15min
completed: 2026-06-21
---

# Phase 18 Plan 01: PHASE_LABEL Naming Convention Summary

**Rewrote the GameBoard scoreboard PHASE_LABEL map to the locked DESIGN-01 VERB/NOUN convention with D-11 corrections (GOALIE expansions, SELECT TARGET / RESPONSE MOVE phrasing, PASS gerund kept), and added the MOVE-phase numbered slot suffix (MOVE 4/5/2) computed from movementSlot.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-21T06:27:00Z (approx, post worktree-provisioning)
- **Completed:** 2026-06-21T11:31:22Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- All 24 `GamePhase` entries in `PHASE_LABEL` now follow the plain VERB/NOUN convention, with the explicit D-11 overrides applied exactly as specified (PASS gerund, GOALIE DIVE/RESTART/KICK, SNAPSHOT - SELECT TARGET, SNAPSHOT - RESPONSE MOVE, FIRST-TIME PASS — RESPONSE MOVE, OFFSIDES - FREE KICK SETUP)
- Dropped redundant `' PHASE'` suffixes (e.g. `MOVEMENT PHASE` → `MOVE`, `SHOT PHASE` → `SHOT`, `HEADER PHASE` → `HEADER`, `SNAPSHOT PHASE` → `SNAPSHOT`)
- Added `moveSlotSuffix(slot: MovementSlot | null): string` module-level helper with a flat `MOVE_SLOT_SUFFIX: Record<MovementSlot, string>` lookup (D-02 lookup-table-as-data shape, no templating engine)
- Wired a `movementSlot` Zustand selector and computed the MOVE-phase label as `PHASE_LABEL.MOVE + moveSlotSuffix(movementSlot)` at the render call site, leaving the existing team-name prefix untouched
- Added 6 new tests to `GameBoard.test.tsx` covering the D-11 corrected targets: PASS gerund, GOALIE DIVE (and explicit non-matches for the stale `GK DIVING`/`GK DIVE` strings), MOVE 5, MOVE 4, SNAPSHOT - SELECT TARGET, FIRST-TIME PASS — RESPONSE MOVE

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite PHASE_LABEL map to the locked naming convention** - `de0d3bc` (feat)
2. **Task 2: Add MOVE-slot numbered suffix + team prefix at the render call site, with tests** - `8811e05` (feat)

**Plan metadata:** committed separately per worktree protocol (SUMMARY.md only; STATE.md/ROADMAP.md owned by orchestrator)

## Files Created/Modified

- `packages/client/src/components/GameBoard.tsx` - Rewrote `PHASE_LABEL` map values to DESIGN-01/D-11 convention; added `MovementSlot` import, `MOVE_SLOT_SUFFIX` lookup, `moveSlotSuffix()` helper, `movementSlot` selector, and MOVE-phase suffix concatenation at the `phaseLabel` derivation
- `packages/client/src/components/GameBoard.test.tsx` - Added a new `DESIGN-01: phase label naming convention` describe block with 6 tests

## Decisions Made

- Kept `PHASE_LABEL` as a flat `Record<GamePhase, string>` exactly as instructed (D-02) — no function values, no templating engine introduced for the MOVE suffix; the suffix is concatenated as a plain string at the render call site, matching the pattern already used for the team-name prefix.
- Preserved the documented asymmetry between `HIGH_PASS_MOVE`/`GK_KICK_MOVE` (keep "REPOSITION") and `SNAPSHOT_DEFLECT`/`FIRST_TIME_PASS_MOVE` (use "RESPONSE MOVE") verbatim per the plan's explicit D-11 instruction — this is intentional, not an inconsistency to "fix."
- Updated the `PHASE_LABEL` doc comment from "UI-SPEC Turn Indicator Spec table" to reference DESIGN-01 (Phase 18) as instructed in Task 1's action text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fresh worktree had no installed dependencies or built shared package**

- **Found during:** Task 1 (running the `tsc --noEmit` verification command)
- **Issue:** The worktree was created from a fresh git checkout with no `node_modules` anywhere in the monorepo and no `packages/shared/dist` build output. `npx tsc` failed immediately with "Cannot find type definition file for 'vite/client'", and after a first install pass, `@counter-attack/shared` module resolution failed across every file that imports it (this is a workspace package resolved via its built `dist/`, not source).
- **Fix:** Ran `pnpm install --frozen-lockfile` (materializes the exact dependency tree already locked in `pnpm-lock.yaml` — no new or different packages introduced, identical to what's already installed in the main repo checkout) followed by `npx tsc` inside `packages/shared` to produce its `dist/` output, matching the package's own `"build": "tsc"` script.
- **Files modified:** None (only installed `node_modules/` and built `packages/shared/dist/`, neither of which is tracked in git)
- **Verification:** `cd packages/client && npx tsc --noEmit -p tsconfig.json` and `npx vitest run src/components/GameBoard.test.tsx` both ran cleanly afterward
- **Committed in:** N/A (build artifacts and node_modules are gitignored; nothing to commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — environment provisioning, no source code changes)
**Impact on plan:** No impact on the plan's deliverable. This was purely a fresh-worktree provisioning gap (missing `pnpm install` + shared-package build), not a code or design issue. No package names were introduced or substituted — the exact locked lockfile was used.

## Issues Encountered

A stray `bash.exe.stackdump` file appeared in the worktree root during execution (a Windows Git Bash crash artifact unrelated to any command this plan ran against the codebase). Left untracked and out of scope per the deviation rules' scope boundary — not part of this plan's files, not committed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DESIGN-01's GameBoard portion is complete: every `GamePhase` scoreboard label follows the locked convention, the D-11 corrections are in place, and the MOVE slot suffix renders correctly.
- 24/24 `GameBoard.test.tsx` tests pass; typecheck is clean across `packages/client` (and `packages/shared` now has a built `dist/` for downstream worktree use).
- Plans 18-02 and 18-03 (also touching `GameBoard.tsx`/ActionPanel per the Phase 18 pattern map) can build on this corrected `PHASE_LABEL` map without re-touching phase-label strings.

---

_Phase: 18-design-polish_
_Completed: 2026-06-21_
