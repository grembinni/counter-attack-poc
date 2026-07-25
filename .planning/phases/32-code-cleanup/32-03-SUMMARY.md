---
phase: 32-code-cleanup
plan: 03
subsystem: ui
tags: [react, hooks, refactor, dead-code-removal, team-colors]

# Dependency graph
requires:
  - phase: 32-code-cleanup (Plan 02)
    provides: hooks/useTeamColors.ts (teamAccentColor / useTeamAccentColor) and hooks/useMyTeam.ts (deriveMyTeam / useMyTeam)
provides:
  - GameBoard.tsx and ActionLog.tsx fully migrated onto the canonical team-accent-color and myTeam hooks (CLEANUP-02, D-04)
  - PieceOverlay.tsx confirmed a verified out-of-scope pass-through (Pitfall 5), preventing a future incorrect "add the hook here" change
affects:
  [
    32-code-cleanup remaining plans,
    any future work touching GameBoard/ActionLog/PieceOverlay color logic,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Component-body hook consts (homeColor/awayColor/teamColor/secondHalfTeamColor) resolved once via useTeamAccentColor, never inside .map()/conditionals'
    - 'Module-level loop-invoked helpers (pieceColorOf/slotTeamColor) call the pure teamAccentColor(), never the hook — Rules of Hooks safety inside consolidateEvents/formatEvent per-event loops'

key-files:
  created: []
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/PieceOverlay.tsx

key-decisions:
  - 'GameBoard.tsx: homeColor/awayColor resolved once near the top of the component body and reused across all 6 home/away score/badge JSX sites (scoreboard, HALF_TIME overlay, FULL_TIME overlay), replacing 10 total palette.uiColor derivations'
  - 'GameBoard.tsx: dead playerSlot local removed (useMyTeam() now owns that store subscription internally) — Rule 1 auto-fix for an eslint no-unused-vars error surfaced by the migration'
  - 'ActionLog.tsx: pieceColorOf/slotTeamColor call the PURE teamAccentColor (not the hook) since both run inside consolidateEvents/formatEvent per-event loops, not component render (Pitfall 1)'
  - "PieceOverlay.tsx: palette.uiColor confirmed a type-shape field pass-through inside the away/GK-scheme effectivePalette object reconstruction — palette is already the fully-resolved TeamPalette prop from HexGrid's TEAM_CONFIGS lookup, and PieceOverlay has no roster TeamId to feed useTeamAccentColor. Left functionally unchanged; only a clarifying comment added (Pitfall 5)."

patterns-established:
  - 'Team-accent color migration pattern: hook in component body (useTeamAccentColor) vs. pure function in loop-invoked helpers (teamAccentColor) — established as the canonical split for any future call site needing team color'

requirements-completed: [CLEANUP-02]

# Metrics
duration: 11min
completed: 2026-07-24
---

# Phase 32 Plan 03: Migrate GameBoard/ActionLog Color Sites Summary

**Migrated all 12 genuine `TEAM_CONFIGS[...].palette.uiColor` derivations in GameBoard.tsx (10 sites) and ActionLog.tsx (2 sites) onto the canonical `useTeamAccentColor`/`teamAccentColor` helpers from Plan 32-02, reconciled GameBoard's inline `myTeam` to `useMyTeam()`, and verified PieceOverlay.tsx's single `palette.uiColor` occurrence is a type-shape pass-through correctly left unchanged.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-24T18:58Z (base commit)
- **Completed:** 2026-07-24T19:09Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- GameBoard.tsx: all 10 inline `TEAM_CONFIGS[...].palette.uiColor` sites replaced with `homeColor`/`awayColor`/`teamColor`/`secondHalfTeamColor` consts sourced from `useTeamAccentColor`, called once in the component body (never in `.map()`/conditionals); inline `myTeam` derivation replaced with `useMyTeam()`
- ActionLog.tsx: `pieceColorOf`/`slotTeamColor` module-level helpers (invoked from `consolidateEvents`/`formatEvent` per-event loops) now delegate to the pure `teamAccentColor()` — no hook calls inside loops
- PieceOverlay.tsx: verified its one `palette.uiColor` occurrence is a field pass-through (not a `TEAM_CONFIGS` lookup) inside the away/GK color-swap object reconstruction; left functionally unchanged, documented with a clarifying comment
- Color output preserved exactly: `#e0e0e0` FULL_TIME tie color and `#888888` miss-fallback both confirmed unchanged in all migrated call sites

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate GameBoard.tsx color sites to useTeamAccentColor and myTeam to useMyTeam** - `8cf0faa` (refactor)
2. **Task 2: Migrate ActionLog.tsx color helpers to the PURE teamAccentColor** - `2eedffe` (refactor)
3. **Task 3: Verify PieceOverlay.tsx is a pass-through and leave it correct (Pitfall 5)** - `6824353` (docs)

_No plan-metadata commit — this is a worktree-isolated plan; the orchestrator creates the metadata commit after merge._

## Files Created/Modified

- `packages/client/src/components/GameBoard.tsx` - 10 `palette.uiColor` sites → `homeColor`/`awayColor`/`teamColor`/`secondHalfTeamColor` via `useTeamAccentColor`; inline `myTeam` → `useMyTeam()`; `TEAM_CONFIGS` import removed; dead `playerSlot` local removed
- `packages/client/src/components/ActionLog.tsx` - `pieceColorOf`/`slotTeamColor` now call the pure `teamAccentColor()`; `TEAM_CONFIGS` import removed
- `packages/client/src/components/PieceOverlay.tsx` - clarifying comment only; no functional change (verified out-of-scope, Pitfall 5)

## Decisions Made

- `homeColor`/`awayColor` are resolved once near the top of GameBoard's component body (immediately after `selectedTeams` is read) and reused across every home/away score, badge, and overlay site — a single pair of hook calls covers 6 of the 10 original inline derivations
- The FULL_TIME `resultColor` ternary now reuses `homeColor`/`awayColor` in its win branches while the `'#e0e0e0'` tie branch is preserved verbatim (byte-for-byte), per the plan's explicit behavior-preservation requirement
- PieceOverlay.tsx was left with zero functional change — no `useTeamAccentColor`/`teamAccentColor` import, no new `TeamId` prop — per Pitfall 5's finding that the CONTEXT.md D-04 scout's third file was a substring false-match, not a genuine duplicated derivation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed dead `playerSlot` local in GameBoard.tsx**

- **Found during:** Task 1 (GameBoard.tsx migration) — surfaced by the pre-commit `eslint --fix` hook
- **Issue:** After replacing the inline `myTeam` derivation with `useMyTeam()` (which internally owns the `playerSlot` store subscription via `useGameStore((s) => s.playerSlot)`), the file's own `const playerSlot = useGameStore((s) => s.playerSlot);` became dead code, triggering `@typescript-eslint/no-unused-vars`
- **Fix:** Removed the now-unused `playerSlot` local; `canStart`'s logic is unaffected since it only ever depended on `myTeam`, never on `playerSlot` directly
- **Files modified:** packages/client/src/components/GameBoard.tsx
- **Verification:** `pnpm --filter @counter-attack/client test GameBoard` (25/25 passing) and `pnpm --filter @counter-attack/client typecheck` (clean) re-run after the fix; pre-commit hook passed on retry
- **Committed in:** 8cf0faa (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary consequence of the planned `useMyTeam()` migration; no scope creep.

## Issues Encountered

- **Worktree had no `node_modules`.** The spawned worktree contained no dependency install at all (not even a stale/broken junction). Ran `pnpm install --frozen-lockfile` (all packages resolved from the existing pnpm store — zero downloads) followed by `pnpm --filter @counter-attack/shared build` (no prebuilt `dist/` existed) to unblock Vitest's resolution of `@counter-attack/shared`. This is an environment-setup gap, not a plan defect — no source files were affected.
- **`pnpm lint` (workspace-wide) fails on a pre-existing, unrelated `packages/shared` typescript-eslint `parserOptions.projectService` file-count cap** (`Too many files (>8) have matched the default project`), unrelated to this plan's files. Verified out of scope by lint-targeting only the two touched files directly (`npx eslint packages/client/src/components/ActionLog.tsx packages/client/src/components/GameBoard.tsx`), which both passed cleanly with zero errors/warnings.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CLEANUP-02 fully closed: every genuine `TEAM_CONFIGS[...].palette.uiColor` derivation across GameBoard.tsx and ActionLog.tsx now flows through the canonical Plan 32-02 hooks; PieceOverlay.tsx's occurrence is documented as intentionally out of scope
- No blockers for subsequent Phase 32 waves

---

_Phase: 32-code-cleanup_
_Completed: 2026-07-24_
