---
phase: 32-code-cleanup
plan: 02
subsystem: ui
tags: [react, hooks, zustand, typescript, refactor]

# Dependency graph
requires: []
provides:
  - 'packages/client/src/hooks/ directory (net-new)'
  - 'teamAccentColor(teamId) pure fn + useTeamAccentColor(teamId) hook wrapper in useTeamColors.ts'
  - 'deriveMyTeam(playerSlot) pure fn + useMyTeam() hook wrapper in useMyTeam.ts'
affects: [32-03, 32-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pure-function-core + thin-hook-wrapper: export the computation as a plain function callable from any context (loops, module-level helpers, Zustand action bodies), plus a one-line hook wrapper for component-body call sites'

key-files:
  created:
    - packages/client/src/hooks/useTeamColors.ts
    - packages/client/src/hooks/useTeamColors.test.ts
    - packages/client/src/hooks/useMyTeam.ts
    - packages/client/src/hooks/useMyTeam.test.ts
  modified: []

key-decisions:
  - "Kept the two hooks in two files (per RESEARCH.md Pattern 1 / Claude's Discretion) — teamAccentColor/useTeamAccentColor and deriveMyTeam/useMyTeam are unrelated concerns with different call-site shapes; no reason found during implementation to merge them into one file."
  - "Canonical myTeam semantics adopted as the null-safe form: deriveMyTeam(1)='home', deriveMyTeam(2)='away', deriveMyTeam(null)=null — matches HexGrid.tsx/ActionPanel.tsx/GameBoard.tsx's existing inline form (Pitfall 4); the 3 non-null-safe call sites (useGameStore.ts, FreeKickSetupPanel.tsx, KickOffSetupPanel.tsx) are migration targets for Plan 32-04, not this plan."

patterns-established:
  - 'Pure-function-core + thin-hook-wrapper: both new hook files export a plain function (safe in loops, module-level helpers, and Zustand action bodies) and a same-named-with-use-prefix hook wrapper for component bodies.'

requirements-completed: [CLEANUP-02]

# Metrics
duration: 6min
completed: 2026-07-24
---

# Phase 32 Plan 02: Consolidation Hooks (useTeamColors, useMyTeam) Summary

**Two new consolidation hooks (`useTeamColors.ts`, `useMyTeam.ts`) under `packages/client/src/hooks/`, each exporting a pure function plus a thin hook wrapper, fully unit-tested and typecheck-clean — ready for Wave 2 call-site migration.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-24T23:34:00Z
- **Completed:** 2026-07-24T23:40:04Z
- **Tasks:** 2 completed
- **Files modified:** 4 (all new)

## Accomplishments

- Created the `packages/client/src/hooks/` directory (net-new, D-03) with `useTeamColors.ts` and `useMyTeam.ts`, each following the pure-function-core + thin-hook-wrapper pattern from RESEARCH.md Pattern 1.
- `teamAccentColor(teamId)` resolves `TEAM_CONFIGS[teamId]?.palette.uiColor ?? '#888888'`, safely callable from `ActionLog.tsx`'s loop-invoked module-level helpers (Pitfall 1) with no Rules-of-Hooks risk.
- `deriveMyTeam(playerSlot)` implements the canonical null-safe `myTeam` semantics (`1→'home'`, `2→'away'`, `null→null`), callable from `useGameStore.ts`'s own action bodies via `get()` (Pitfall 2), which cannot call hooks.
- `useTeamAccentColor`/`useMyTeam` hook wrappers exist for component-body call sites; `useMyTeam` subscribes to the narrowest `playerSlot` slice only (`useGameStore((s) => s.playerSlot)`), matching the locked per-slice-selector convention.
- Every exported symbol is imported and exercised by its co-located unit test (`useTeamColors.test.ts`, `useMyTeam.test.ts`), locking behavior and ensuring knip counts each as used.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useTeamColors.ts (teamAccentColor pure fn + useTeamAccentColor hook) with tests** - `57d751a` (feat)
2. **Task 2: Create useMyTeam.ts (deriveMyTeam pure fn + useMyTeam hook) with tests** - `3af5395` (feat)

## Files Created/Modified

- `packages/client/src/hooks/useTeamColors.ts` - Exports pure `teamAccentColor(teamId)` and thin hook wrapper `useTeamAccentColor(teamId)`
- `packages/client/src/hooks/useTeamColors.test.ts` - Unit tests: valid teamId, undefined, unknown-id fallback, hook/pure-fn parity
- `packages/client/src/hooks/useMyTeam.ts` - Exports pure `deriveMyTeam(playerSlot)` and hook wrapper `useMyTeam()` (narrow `playerSlot` slice subscription)
- `packages/client/src/hooks/useMyTeam.test.ts` - Unit tests: `deriveMyTeam(1/2/null)` and `useMyTeam` against store state via `renderHook`

## Decisions Made

- Two-file split retained (not merged into one hooks file) — `teamAccentColor`/`useTeamAccentColor` and `deriveMyTeam`/`useMyTeam` are independent concerns (static config lookup vs. reactive store slice) with no shared call sites, so keeping them in separate, clearly-named files matches the existing per-concern component-file convention in this codebase.
- Adopted the null-safe `myTeam` form as canonical per RESEARCH.md Pitfall 4's recommendation — this is a foundation decision for Plan 32-04, which will need to reconcile the 3 non-null-safe call sites (`useGameStore.ts` ×7, `FreeKickSetupPanel.tsx`, `KickOffSetupPanel.tsx`) against the new `null`-inclusive type.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The worktree had no `node_modules` installed (fresh worktree checkout). Ran `pnpm install --frozen-lockfile` (safe: uses the shared global pnpm content-addressable store, does not touch the main repo's `node_modules` or require any junction/symlink workaround) followed by `pnpm --filter @counter-attack/shared build` to produce `packages/shared/dist/` before running client tests/typecheck, matching this repo's existing CI ordering constraint (RESEARCH.md Pitfall 6). Not a plan deviation — standard environment setup, no code changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 32-03 and 32-04 can now import `teamAccentColor`/`useTeamAccentColor` from `packages/client/src/hooks/useTeamColors.ts` and `deriveMyTeam`/`useMyTeam` from `packages/client/src/hooks/useMyTeam.ts` to migrate the 3 `TEAM_CONFIGS` color call sites and 8 `myTeam`-derivation call sites identified in RESEARCH.md D-04.
- No blockers. The canonical null-safe `myTeam` type (`'home' | 'away' | null`) is now locked; Plan 32-04 must explicitly resolve the 3 non-null-safe call sites against this type (per Pitfall 4), not silently coerce with `?? 'away'`.

---

_Phase: 32-code-cleanup_
_Completed: 2026-07-24_
