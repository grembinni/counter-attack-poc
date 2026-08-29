---
phase: 46-final-cleanup
plan: 05
subsystem: ui
tags: [react, hex-highlight-system, team-badge-consistency, dead-code-doc-sync]

# Dependency graph
requires: ["46-01 (docs/HIGHLIGHT-REFERENCE.md resync this plan builds its new section on top of)"]
provides:
  - "VALID_MOVE_TINT_EXCEPTION_PHASES (HexGrid.tsx) — enumerated 4-member ReadonlySet<GamePhase> exception set for the valid-move hex safe tint"
  - "docs/HIGHLIGHT-REFERENCE.md '## 4. Valid-Move Tint Consistency' section"
  - "PlayerStatsPanel.tsx TeamBadge size={48}, matching the roster/bench card family"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.test.tsx
    - packages/client/src/components/PlayerStatsPanel.tsx
    - packages/client/src/components/PlayerStatsPanel.test.tsx
    - docs/HIGHLIGHT-REFERENCE.md

key-decisions:
  - "Audit found 2 additional deliberate, pre-existing, documented valid-move tint exceptions beyond the two named in the plan's read_first (GK_DIVE, SNAPSHOT_DEFLECT): KICK_OFF_SETUP and FREE_KICK_SETUP resolve to the dedicated blue 'kickoff' zone tint instead of 'safe', because isKickoffTint/isInMyFreeKickZone take higher priority in HexGrid's highlightType ternary. This is pre-existing, already-documented behavior (kickoff tint has its own HIGHLIGHT-REFERENCE.md row; FREE_KICK_SETUP's exclusion is independently proven by the existing D-48 test suite's 'does NOT render the generic safe (green) fill anywhere' assertion) — not a D-02 divergence to fix, so both were added to the exception set with documented rationale rather than being 'brought onto safe'. No rendering behavior changed."

patterns-established: []

requirements-completed: [CLEANUP-06, CLEANUP-09, CLEANUP-11, CLEANUP-13]

# Metrics
duration: ~25min
completed: 2026-08-29
---

# Phase 46 Plan 05: Valid-Move Tint Consistency + Pitch Card Badge Alignment Summary

**Replaced HexGrid.tsx's two inline negated valid-move-tint exclusions with an exported, documented `VALID_MOVE_TINT_EXCEPTION_PHASES` set (4 members after audit, not 2), mirrored in a new HIGHLIGHT-REFERENCE.md section, and shrank the pitch player card's team badge from 56px to 48px to match the roster/bench card family, correcting its stale stat-grid comment in the same pass.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Traced every phase that populates `useGameStore`'s `validMoveHexes` via the `compute*ValidHexes` helper call sites (`computeMovementValidHexes`, `computeResponseMoveValidHexes` × 6 phases, `computeFreeMoveValidHexes` × 5 phases, `computeKickOffSetupValidHexes`, `computeFreeKickSetupValidHexes`, `computeCornerRepositionValidHexes`, `computePenaltyKickValidHexes` × 2 phases, `computeGkDiveAtFeetTargetHexes`, plus the two bespoke `CORNER_KICK_GK_SETUP_*` inline filters) — 20 phases total.
- Added `VALID_MOVE_TINT_EXCEPTION_PHASES` (module-scope, exported, `ReadonlySet<GamePhase>`) to `HexGrid.tsx`, replacing the inline `phase !== 'GK_DIVE' && phase !== 'SNAPSHOT_DEFLECT'` literals in the `isHighlighted` derivation with a single membership test.
- The audit surfaced two additional exception phases beyond the two named in the plan's `read_first` — `KICK_OFF_SETUP` and `FREE_KICK_SETUP` — whose valid-move hexes resolve to the pre-existing, documented blue `kickoff` zone tint instead of `safe`, due to `isKickoffTint`/`isInMyFreeKickZone` taking priority in the `highlightType` ternary. This is pre-existing, deliberate, already-documented behavior (not a new divergence to "fix" per the plan's own instruction), so both were added to the exception set with full rationale rather than changed to render `safe`. Rendering output is byte-identical to before this plan.
- Added a new `## 4. Valid-Move Tint Consistency` section to `docs/HIGHLIGHT-REFERENCE.md`, listing all 20 safe-tinted phases, the 4-member exception table (phase / resolved tint / reason), and contributor guidance for adding a future movement-pattern phase.
- Added `HexGrid.test.tsx` coverage: exact membership/count assertion for `VALID_MOVE_TINT_EXCEPTION_PHASES`, a `MOVE`-phase rendering assertion proving the shared-tint majority still resolves `safe`, a `GK_DIVE` rendering assertion proving the suppression exception still holds, and a new `KICK_OFF_SETUP` rendering assertion proving that phase's valid-move hex resolves `kickoff`, never `safe` — the first dedicated test for that specific fact (the existing D-48 suite already covered the `FREE_KICK_SETUP` case).
- Changed `PlayerStatsPanel.tsx`'s `TeamBadge` prop from `size={56}` to `size={48}`, matching `LineupAssignmentScreen.tsx`'s `LineupStatCard` and `DraftPackCarousel.tsx`'s `DraftCardBody` (both already `48`).
- Corrected the stale ASCII-diagram doc comment (`[TeamBadge 56px]` → `[TeamBadge 48px]`) and the stat-grid comment (`4-column stat grid → 2 rows of 4+3 (7 role-filtered stats)` → `3-column stat grid → 2 rows of 3 (6 role-filtered stats)`), citing `Phase 46 / CLEANUP-11 + CLEANUP-13`. `PlayerStatsPanel.module.css`'s `.statGrid` was already `repeat(3, 1fr)` — only the comment had drifted; the CSS file was not touched.
- Added `PlayerStatsPanel.test.tsx` coverage pinning the rendered badge `width`/`height` to `48` and asserting exactly 6 `.statChip` elements render for a representative outfield role.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enumerate and document the valid-move hex tint rule and its deliberate exceptions** - `d5a2a44f` (feat)
2. **Task 2: Align the pitch player card's team-badge size with the roster/bench card family and fix its stale stat-grid comment** - `3212f023` (fix)

## Files Created/Modified

- `packages/client/src/components/HexGrid.tsx` - Added `VALID_MOVE_TINT_EXCEPTION_PHASES` (module scope, exported, 4 members with per-member rationale comments citing D-02); replaced the inline `phase !== 'GK_DIVE' && phase !== 'SNAPSHOT_DEFLECT'` literals in the `isHighlighted` derivation with `!VALID_MOVE_TINT_EXCEPTION_PHASES.has(phase)`; added `GamePhase` to the existing type-only import from `@counter-attack/shared`. No new `HexHighlightType` member, no new `HIGHLIGHT_STYLES` entry, no new color literal, no change to the `highlightType` priority ternary's branch order.
- `packages/client/src/components/HexGrid.test.tsx` - Added a new describe block: exact membership/size assertion for `VALID_MOVE_TINT_EXCEPTION_PHASES`, a `MOVE`-phase `safe`-fill rendering assertion, a `GK_DIVE`-phase suppression rendering assertion, and a `KICK_OFF_SETUP`-phase `kickoff`-not-`safe` rendering assertion; added the new named import.
- `packages/client/src/components/PlayerStatsPanel.tsx` - `TeamBadge` `size` prop `56` → `48`; ASCII-diagram doc comment and stat-grid inline comment corrected to describe the real 3-column/6-stat layout, citing `CLEANUP-11 + CLEANUP-13`.
- `packages/client/src/components/PlayerStatsPanel.test.tsx` - Added two tests: badge `width`/`height` pinned to `48`, and exactly 6 `.statChip` elements render for an outfield role.
- `docs/HIGHLIGHT-REFERENCE.md` - Added `## 4. Valid-Move Tint Consistency` section (between the standalone-overlays section and "Adding a New Highlight"): the rule statement, the full 20-phase safe-tint list (with a note on the header-contest-zone and risk/safe per-hex subset caveats, both pre-existing and separately documented), the 4-member exception table, and contributor guidance for future movement-pattern phases.

## Decisions Made

- **Exception set grew from 2 to 4 members during the audit, with no behavior change.** The plan's `read_first` named only `GK_DIVE` and `SNAPSHOT_DEFLECT` as known exceptions. Tracing the `highlightType` priority ternary against every `compute*ValidHexes` call site showed `KICK_OFF_SETUP` and `FREE_KICK_SETUP` also resolve to a non-`safe` tint (the blue `kickoff` zone tint) for their valid-move hexes, because `isKickoffTint` and `isInMyFreeKickZone` sit at higher ternary priority than `isSafeTint`. This is pre-existing, deliberate, already-documented design (the `kickoff` tint has its own row and Notes in `HIGHLIGHT-REFERENCE.md`; `FREE_KICK_SETUP`'s exclusion is independently proven by the pre-existing `HexGrid.test.tsx` D-48 suite's "does NOT render the generic safe (green) fill anywhere" assertion) — not a genuine, undocumented D-02 divergence per the plan's own criterion for what counts as one. Per the plan's explicit instruction ("Do NOT change the two documented exceptions... their rationale is recorded in code and predates this phase" combined with "If... a phase... resolves to a tint OTHER than safe with no documented rationale... bring it onto safe"), a documented, pre-existing divergence is exactly the shape the exception set exists to record, not to erase. Both phases were added to the set with full rationale instead. Rendering output is unchanged — this is a documentation/refactor-only finding, not a behavior change.

## Deviations from Plan

None — plan executed exactly as written. The exception-set growth from 2 to 4 members (above) is not a deviation from the plan's instructions; it is the direct, correct output of following the plan's own audit methodology ("trace every phase... using the compute*ValidHexes call sites... determine which HexHighlightType its valid-move hexes actually resolve to") to its conclusion, and the plan explicitly anticipated this kind of finding by giving instructions for exactly this case (documented exceptions are recorded, not overwritten).

## Issues Encountered

- The worktree had no `node_modules` and no built `packages/shared/dist` on first use (same as 46-01) — ran `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared build` before tests would resolve `@counter-attack/shared`. Standard worktree setup, not a deviation from plan scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `VALID_MOVE_TINT_EXCEPTION_PHASES` (4 members: `GK_DIVE`, `SNAPSHOT_DEFLECT`, `KICK_OFF_SETUP`, `FREE_KICK_SETUP`) is the final, exported, tested source of truth for any future plan needing to cite the valid-move tint exception set.
- `docs/HIGHLIGHT-REFERENCE.md`'s new "Valid-Move Tint Consistency" section is now the accurate reference for the full valid-move-tint inventory.
- `PlayerStatsPanel.tsx`'s pitch player card badge is now 48px, matching the roster/bench card family (Phase 41's `CardInjuryBadge` unification plus this plan's badge-size fix together close out the CLEANUP-11 card-layout-consistency audit scope named in `46-CONTEXT.md` D-04).
- No blockers for subsequent Phase 46 plans or the phase-gate checkpoint.

---
*Phase: 46-final-cleanup*
*Completed: 2026-08-29*
