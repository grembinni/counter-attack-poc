---
phase: 19-data-model-team-palette
plan: '03'
subsystem: client-consumers
tags: [palette, team-id, mock, tests, typescript]
dependency_graph:
  requires:
    - 19-01 (PLAYER_POOL, TeamId = 'city'|'crew', TeamConfig.palette)
  provides:
    - All 5 client consumer components use palette.primary (PALETTE-02)
    - TeamId-keyed maps in TeamBadge + TeamSelectionScreen contain only city/crew (TEAM-07)
    - mockMovementState built from PLAYER_POOL with city/crew squads
    - Client test suite green (249/249)
  affects:
    - packages/client/src/components/ (5 consumer files)
    - packages/client/src/mock/mockMovementState.ts
    - packages/client/src/components/*.test.tsx (5 test files)
tech_stack:
  added: []
  patterns:
    - TEAM_CONFIGS[x].palette.primary replacing .primaryColor (field-swap pattern)
    - Record<TeamId, string> narrowed to city/crew only after D-04 shrink
    - PLAYER_POOL.filter(p => p.sourceTeamId === 'city/crew') for mock construction
    - 0-indexed array slot IDs (home-N) differ from jersey numbers (#N+1) — key insight
key_files:
  created: []
  modified:
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/PlayerStatsPanel.tsx
    - packages/client/src/components/TeamSelectionScreen.tsx
    - packages/client/src/components/PieceOverlay.tsx
    - packages/client/src/components/TeamBadge.tsx
    - packages/client/src/mock/mockMovementState.ts
    - packages/client/src/components/ActionLog.test.tsx
    - packages/client/src/components/GameBoard.test.tsx
    - packages/client/src/components/PlayerStatsPanel.test.tsx
    - packages/client/src/components/TeamSelectionScreen.test.tsx
    - packages/client/src/components/PieceOverlay.test.tsx
decisions:
  - 'home-9 in new mock = array index 9 = Cedric Teuchert (#10), NOT jersey-9 Sang-bin Jeong (#9) — array index != jersey number'
  - 'TeamSelectionScreen transitional 2-team state (city+crew) with Phase 21 restore note per D-04'
  - 'PieceOverlay crew clipPath circle is circle[0] — tests must select circles not inside clipPath to reach the base piece circle'
  - 'City arch path does not exist in PieceOverlay — test updated to assert crimson rect fill in city-jersey pattern instead'
metrics:
  duration: '~18 min'
  completed: '2026-07-03'
  tasks: 3
  files: 12
---

# Phase 19 Plan 03: Client Consumer Migration Summary

Swap all client reads of `TeamConfig.primaryColor` to `palette.primary`, shrink TeamId-keyed badge and team maps to city/crew, rebuild `mockMovementState` from PLAYER_POOL using city (home) and crew (away) squads, and update all test assertions that depended on cosmos/xolos squads or the old 4-team selection screen.

## What Was Built

### Task 1: Swap primaryColor -> palette.primary (5 consumer components)

Replaced all `TEAM_CONFIGS[...].primaryColor` reads with `.palette.primary` across:

| File                    | Occurrences                     |
| ----------------------- | ------------------------------- |
| ActionLog.tsx           | 2 (pieceColorOf, slotTeamColor) |
| GameBoard.tsx           | 10                              |
| PlayerStatsPanel.tsx    | 1 (MiniTokenBadge fill)         |
| TeamSelectionScreen.tsx | 2 (borderColor + background)    |
| PieceOverlay.tsx        | 2 (fill + stroke reads)         |

Also updated PieceOverlay JSDoc and inline comment from `primaryColor` to `palette.primary` for accuracy.

### Task 2: Shrink TeamId-keyed badge/team maps

**TeamBadge.tsx:**

- Removed `cosmosBadge`, `xolosBadge`, `cosmosBadgeFull`, `xolosBadgeFull` imports
- `BADGE_MAP` now: `{ city: cityBadge, crew: crewBadge }`
- `BADGE_MAP_FULL` now: `{ city: cityBadgeFull, crew: crewBadgeFull }`

**TeamSelectionScreen.tsx:**

- Removed `cosmosFullBadge`, `xolosFullBadge` imports
- `ALL_TEAMS` changed from `['cosmos', 'xolos', 'city', 'crew']` to `['city', 'crew']`
- `FULL_BADGE_MAP` now: `{ city: cityFullBadge, crew: crewFullBadge }`
- Top comment updated: "transitional 2-team state; Phase 21 restores the full 4-team grid" (D-04)

### Task 3: Rebuild mockMovementState + update test assertions

**mockMovementState.ts:** Complete rewrite of the pieces construction:

- Import: `TEAM_SQUADS` removed; `PLAYER_POOL` imported
- Home pieces: `PLAYER_POOL.filter(p => p.sourceTeamId === 'city').map((p, i) => ({ ...p, teamId: 'home', id: 'home-${i}' })`
- Away pieces: `PLAYER_POOL.filter(p => p.sourceTeamId === 'crew').map((p, i) => ({ ...p, teamId: 'away', id: 'away-${i}' })`
- `selectedTeams`: `{ home: 'cosmos', away: 'xolos' }` -> `{ home: 'city', away: 'crew' }`

**Key discovery:** Array-index IDs (home-N) differ from jersey numbers:

- `home-9` (array index 9) = **Cedric Teuchert**, FWD, jersey **#10**
- NOT Sang-bin Jeong (#9, array index 8)
- `away-0` (array index 0) = **Patrick Schulte**, GK, jersey **#1**

**Test assertion changes:**

| Test File                    | Old Assertion                                           | New Assertion                                   |
| ---------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| ActionLog.test.tsx           | `Nicolae Rusu` (cosmos home-9)                          | `Cedric Teuchert` (city index 9)                |
| ActionLog.test.tsx           | `Oliver Walker` (cosmos GK)                             | `Patrick Schulte` (crew GK)                     |
| GameBoard.test.tsx           | `getByAltText('cosmos badge')`                          | `getByAltText('city badge')`                    |
| GameBoard.test.tsx           | `getByAltText('xolos badge')`                           | `getByAltText('crew badge')`                    |
| PlayerStatsPanel.test.tsx    | `selectedTeams: { home: 'cosmos', away: 'xolos' }`      | `selectedTeams: { home: 'city', away: 'crew' }` |
| PlayerStatsPanel.test.tsx    | `Vinicius Eubsinno` (cosmos GK)                         | `Roman Burki` (city GK)                         |
| PlayerStatsPanel.test.tsx    | `mini-cosmos-jersey-home-1`                             | `mini-city-jersey-home-1`                       |
| PlayerStatsPanel.test.tsx    | `mini-xolos-jersey-away-1`                              | `mini-crew-jersey-away-1`                       |
| TeamSelectionScreen.test.tsx | `homePickedTeam="cosmos"`                               | `homePickedTeam="city"`                         |
| TeamSelectionScreen.test.tsx | `toHaveLength(4)` team cards                            | `toHaveLength(2)` team cards                    |
| TeamSelectionScreen.test.tsx | `expect(['xolos','city','crew']).toContain(calledWith)` | `expect(calledWith).toBe('crew')`               |
| PieceOverlay.test.tsx        | `cosmos-jersey-home-5`                                  | `city-jersey-home-5`                            |
| PieceOverlay.test.tsx        | `xolos-jersey-away-5`                                   | `crew-jersey-away-5`                            |
| PieceOverlay.test.tsx        | city arch path (stroke #f5c518)                         | city jersey #dc143c rect fill                   |

## Test Results

- Client: **249/249** tests pass
- Shared: **359/359** tests pass
- TypeScript: **0 errors** (both packages)

## Commits

| Hash    | Description                                                                        |
| ------- | ---------------------------------------------------------------------------------- |
| 597ced2 | feat(19-03): swap .primaryColor -> .palette.primary across 5 client components     |
| 6308c52 | feat(19-03): shrink TeamId-keyed badge/team maps to city/crew only                 |
| 7856e5c | feat(19-03): rebuild mockMovementState from PLAYER_POOL and update test assertions |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PieceOverlay and PlayerStatsPanel tests used cosmos/xolos jersey IDs not in plan scope**

- **Found during:** Task 3 test run
- **Issue:** `PieceOverlay.test.tsx` and `PlayerStatsPanel.test.tsx` were not listed in the plan's `<files>` but contained cosmos/xolos jersey pattern ID assertions (`cosmos-jersey-home-5`, `mini-cosmos-jersey-home-1`, etc.) that broke when the store initial state changed from cosmos/xolos to city/crew via mockMovementState
- **Fix:** Updated both test files to expect city/crew jersey pattern IDs; fixed crew clipPath circle selector (crew pieces place a clipPath anchor circle as circle[0] — tests must filter to circles not inside clipPath); replaced non-existent city arch path test with city jersey crimson rect fill assertion
- **Files modified:** packages/client/src/components/PieceOverlay.test.tsx, packages/client/src/components/PlayerStatsPanel.test.tsx
- **Commit:** 7856e5c

**2. [Rule 1 - Bug] home-9 is Cedric Teuchert (#10), not Sang-bin Jeong (#9)**

- **Found during:** Task 3 test run (ActionLog player name tests failing)
- **Issue:** The 19-01-SUMMARY.md note "home-9 player (city): Sang-bin Jeong" referred to jersey number 9. In the new PLAYER_POOL filter, array index 9 maps to the 10th player (Cedric Teuchert, #10). `home-9` (the ball carrier ID, unchanged) is array-index-9, not jersey-number-9.
- **Fix:** Updated ActionLog.test.tsx to assert `Cedric Teuchert` and `Patrick Schulte` (the actual players at those array indices)
- **Files modified:** packages/client/src/components/ActionLog.test.tsx
- **Commit:** 7856e5c

## Known Stubs

**TeamSelectionScreen transitional 2-team state:** `ALL_TEAMS = ['city', 'crew']` is intentional for Phase 19. Phase 21 (LEAGUE-01) will restore the full 4-team grid including cosmos/xolos color schemes. The test file comment notes this explicitly.

All other data is fully wired — PLAYER_POOL city/crew squads are real CSV-seeded players.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. All changes are client-side display wiring and test updates.

## Self-Check: PASSED

- packages/client/src/components/ActionLog.tsx: FOUND (palette.primary)
- packages/client/src/components/GameBoard.tsx: FOUND (palette.primary x10)
- packages/client/src/components/PlayerStatsPanel.tsx: FOUND (palette.primary)
- packages/client/src/components/TeamSelectionScreen.tsx: FOUND (palette.primary, ALL_TEAMS=['city','crew'])
- packages/client/src/components/PieceOverlay.tsx: FOUND (palette.primary)
- packages/client/src/components/TeamBadge.tsx: FOUND (city+crew only)
- packages/client/src/mock/mockMovementState.ts: FOUND (PLAYER_POOL, city/crew)
- Commits 597ced2, 6308c52, 7856e5c: all present in git log
- TypeScript: 0 errors (client + shared)
- Test suite: 249/249 client + 359/359 shared = 608/608 pass
