---
phase: 32-code-cleanup
plan: 04
subsystem: ui
tags: [react, zustand, hooks, refactor, code-cleanup]

# Dependency graph
requires:
  - phase: 32-code-cleanup (plan 02)
    provides: useMyTeam()/deriveMyTeam() canonical hook + pure fn in packages/client/src/hooks/useMyTeam.ts
provides:
  - HexGrid.tsx and ActionPanel.tsx derive myTeam via useMyTeam() (component bodies)
  - useGameStore.ts's 7 selectPiece phase branches derive myTeam via deriveMyTeam(playerSlot) (pure fn, store action bodies)
  - FreeKickSetupPanel.tsx and KickOffSetupPanel.tsx migrated from non-null-safe inline derivation to useMyTeam() with explicit null guards
  - All 8 CLEANUP-02/D-04 myTeam-duplication production sites consolidated onto one canonical helper
affects: [32-05, 32-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pure-function-core + thin-hook-wrapper: useGameStore.ts action bodies call deriveMyTeam(playerSlot) (pure); component bodies call useMyTeam() (hook) — hooks are illegal in Zustand store action closures'
    - "Null-safe myTeam as canonical semantics: 'home' | 'away' | null everywhere, no silent '?? away' coercion; every previously non-null-safe site gets an explicit, documented null guard instead"

key-files:
  created: []
  modified:
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/components/FreeKickSetupPanel.tsx
    - packages/client/src/components/KickOffSetupPanel.tsx

key-decisions:
  - "useGameStore.ts's 7 sites: null playerSlot -> explicit early-return no-op (clear selection), not a '?? away' coercion — every real caller (HexGrid's canSelect* checks) already requires myTeam !== null, so this is defense-in-depth, not a real-flow behavior change"
  - "FreeKickSetupPanel.tsx / KickOffSetupPanel.tsx: A3 assumption verified via code trace (not assumed) — App.tsx's onRoomJoined sets playerSlot before onGameState ever transitions screen to 'GAME_BOARD', and both panels only render inside GameBoard, so playerSlot is always non-null when these panels render in real gameplay; the new null branch is unreachable defense-in-depth"
  - 'Removed now-redundant playerSlot Zustand selectors in HexGrid.tsx and ActionPanel.tsx — playerSlot had no other use in either file beyond the myTeam derivation'

patterns-established: []

requirements-completed: [CLEANUP-02]

# Metrics
duration: ~35min
completed: 2026-07-25
---

# Phase 32 Plan 04: myTeam/Team-Slot Consolidation (Part 3 of 3) Summary

**Consolidated all 8 CLEANUP-02 myTeam-duplication sites onto useMyTeam()/deriveMyTeam(), resolving the null-safe vs. non-null-safe semantic split with explicit guards instead of silent coercion.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments

- `HexGrid.tsx` and `ActionPanel.tsx` (component bodies) now derive `myTeam` via `useMyTeam()`, with their now-redundant `playerSlot` selectors removed.
- `useGameStore.ts`'s 7 inline `myTeam` derivations inside `selectPiece`'s phase branches (KICK_OFF_SETUP, FREE_KICK_SETUP, HIGH_PASS_MOVE, FREE_MOVE_ATTACK/DEFENSE, FIRST_TIME_PASS_MOVE, GK_KICK_MOVE, SNAPSHOT_DEFLECT) now use the pure `deriveMyTeam(playerSlot)` function — never `useMyTeam()`, since hooks are uncallable in Zustand store action closures.
- `FreeKickSetupPanel.tsx` and `KickOffSetupPanel.tsx` migrated from the non-null-safe `playerSlot === 1 ? 'home' : 'away'` form to `useMyTeam()`, with the newly-introduced `null` case handled by an explicit guard folded into each component's existing early-return block — never a silent `?? 'away'` coercion.
- All 9 previously non-null-safe sites (7 in `useGameStore.ts` + 2 panels) now have a recorded, individually-justified null-handling decision (see Decisions Made below).

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate the null-safe component sites (HexGrid, ActionPanel) to useMyTeam()** - `0a98c7b` (refactor)
2. **Task 2: Reconcile the non-null-safe sites (useGameStore ×7, FreeKickSetupPanel, KickOffSetupPanel) to deriveMyTeam with explicit null handling** - `50c9164` (refactor)

## Files Created/Modified

- `packages/client/src/components/HexGrid.tsx` - `myTeam` now derived via `useMyTeam()`; redundant `playerSlot` selector removed
- `packages/client/src/components/ActionPanel.tsx` - `myTeam` now derived via `useMyTeam()`; redundant `playerSlot` selector removed
- `packages/client/src/store/useGameStore.ts` - 7 `selectPiece` phase branches now use `deriveMyTeam(playerSlot)` with explicit null-guard early returns
- `packages/client/src/components/FreeKickSetupPanel.tsx` - migrated to `useMyTeam()`; `myTeamOrNull === null` folded into the existing early-return-null guard block
- `packages/client/src/components/KickOffSetupPanel.tsx` - migrated to `useMyTeam()`; `myTeamOrNull === null` folded into the existing `phase !== 'KICK_OFF_SETUP'` early-return guard

## Decisions Made

**useGameStore.ts (7 sites — KICK_OFF_SETUP, FREE_KICK_SETUP, HIGH_PASS_MOVE, FREE_MOVE_ATTACK/DEFENSE, FIRST_TIME_PASS_MOVE, GK_KICK_MOVE, SNAPSHOT_DEFLECT):**
Each site now calls `deriveMyTeam(playerSlot)` and, if the result is `null`, returns early with `set({ selectedPieceId: null, validMoveHexes: [] })` — the same "invalid selection" no-op pattern already used throughout `selectPiece` for other invalid-state conditions. This guard is defense-in-depth: `selectPiece`'s only real caller is HexGrid's `canSelect*` family of checks, every one of which already requires `myTeam !== null` before `selectPiece` is ever invoked from the UI. The guard is documented inline at each site (full rationale at the first/KICK_OFF_SETUP site, cross-referenced at the remaining 6).

**FreeKickSetupPanel.tsx / KickOffSetupPanel.tsx (component bodies):**
`useMyTeam()` is called unconditionally at the top of each component (Rules of Hooks), then `myTeamOrNull === null` is added to each panel's existing early-return-null guard block. The A3 assumption from RESEARCH.md ("these panels only render mid-game after room join, so playerSlot is never null") was **verified via code trace, not assumed**: `App.tsx`'s `onRoomJoined` handler calls `setPlayerSlot(slot)` before `onGameState` ever transitions `screen` to `'GAME_BOARD'` — a `GAME_STATE` broadcast can only occur after the room already has both player slots joined. Both `FreeKickSetupPanel` and `KickOffSetupPanel` are rendered exclusively inside `GameBoard.tsx`, which itself only renders when `screen === 'GAME_BOARD'`. So `playerSlot` (and therefore `myTeamOrNull`) is unreachable-null in real gameplay; the new guard branch is defense-in-depth documented inline, not a live behavior change.

## Deviations from Plan

None - plan executed exactly as written. The `pnpm lint` (root, whole-workspace) `Too many files (>8) have matched the default project` failure in `packages/shared/src/*.test.ts` is a pre-existing, already-documented issue (see `deferred-items.md`, logged by Plan 32-01) — confirmed out of scope by running `eslint` directly on this plan's 5 modified files, all of which lint clean.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CLEANUP-02's myTeam/team-slot consolidation is fully complete across all 8 D-04 production sites (this plan's 5 + `GameBoard.tsx`'s single site, handled by a sibling plan in this phase's wave structure).
- `pnpm --filter @counter-attack/client test HexGrid ActionPanel useGameStore FreeKickSetupPanel KickOffSetupPanel` (164 tests) and the full client suite (387 tests) both pass; `pnpm --filter @counter-attack/client typecheck` is clean.
- No blockers for subsequent Phase 32 plans.

---

_Phase: 32-code-cleanup_
_Completed: 2026-07-25_

## Self-Check: PASSED

All 5 modified files + SUMMARY.md verified present on disk. All 3 commit hashes (0a98c7b, 50c9164, 86817c9) confirmed in `git log --oneline --all`.
