---
phase: 19-data-model-team-palette
plan: '02'
subsystem: server-game-engine
tags: [server, game-engine, player-pool, team-validation, typescript]
dependency_graph:
  requires:
    - PLAYER_POOL (178 players) — provided by Plan 19-01
    - getSquadPlayers(teamId) helper — provided by Plan 19-01
    - TeamId = 'city' | 'crew' — provided by Plan 19-01
  provides:
    - buildSquadPieces rewritten to consume getSquadPlayers (DATA-02)
    - VALID_TEAM_IDS narrowed to ['city', 'crew'] (TEAM-07, T-19-03)
  affects:
    - packages/client (mockMovementState.ts — Plan 19-03 scope)
tech_stack:
  added: []
  patterns:
    - getSquadPlayers(teamId).map((p, i) => ({ ...p, teamId, id: `${side}-${i}` }))
    - VALID_TEAM_IDS as readonly TeamId[] enforces compile-time narrowing
key_files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/game.integration.test.ts
    - packages/server/src/__tests__/gameEngine.phase10.test.ts
    - packages/server/src/__tests__/gameEngine.phase17.test.ts
    - packages/server/src/__tests__/gameEngine.phase8.test.ts
    - packages/server/src/__tests__/gameEngine.rule11.test.ts
    - packages/server/src/__tests__/gameEngine.teamselect.test.ts
    - packages/server/src/__tests__/gameEngine.test.ts
    - packages/server/src/__tests__/gameHandlers.phase10.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17-06.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17.test.ts
    - packages/server/src/__tests__/gameHandlers.phase18-02.test.ts
    - packages/server/src/__tests__/gameHandlers.rule11.test.ts
    - packages/server/src/__tests__/gameHandlers.test.ts
    - packages/server/src/__tests__/kickoffDebug.test.ts
    - packages/server/src/__tests__/kickoffSetup.integration.test.ts
    - packages/server/src/__tests__/offside.test.ts
    - packages/server/src/__tests__/replay.integration.test.ts
    - packages/server/src/__tests__/room.integration.test.ts
    - packages/server/src/__tests__/roomStore.test.ts
    - packages/server/src/__tests__/shotGkRange.test.ts
decisions:
  - "buildSquadPieces uses index-based ids (home-${i}/away-${i}) because PoolPlayer ids are p### not home-#"
  - 'All 20 server test files updated from cosmos/xolos to city/crew (now required by TeamId union)'
  - 'VALID_TEAM_IDS narrowed to exactly the TeamId union members — compiler enforces no drift'
metrics:
  duration: '~9 min'
  completed: '2026-07-03'
  tasks: 2
  files: 22
---

# Phase 19 Plan 02: Server Consumer Update Summary

Update server to consume the new PLAYER_POOL data model: rewrite buildSquadPieces to resolve squads through getSquadPlayers (replacing deleted TEAM_SQUADS), and narrow VALID_TEAM_IDS to active teams only.

## What Was Built

### Task 1: Rewrite buildSquadPieces to use getSquadPlayers

In `packages/server/src/gameEngine.ts`:

- Replaced `TEAM_SQUADS` import with `getSquadPlayers` in the shared import block
- Rewrote the home squad mapping: `getSquadPlayers(selectedTeams.home).map((p, i) => ({ ...p, teamId: 'home' as const, id: \`home-${i}\` }))`
- Rewrote the away squad mapping: `getSquadPlayers(selectedTeams.away).map((p, i) => ({ ...p, teamId: 'away' as const, id: \`away-${i}\`, position: { q: 36 - p.position.q, r: p.position.r } }))`
- Away id now uses index (`away-${i}`) because PoolPlayer ids are `p###`, not `home-#` — the old `.replace('home-', 'away-')` pattern is gone
- The ST kick-off positioning block (finding by role, assigning kickOffHex) is unchanged
- The spread `{ ...poolPlayer, teamId, id }` satisfies PlayerPiece without any cast — PoolPlayer carries all stat fields

The 22-piece build behavior is unchanged: 11 home pieces at formation positions + 11 away pieces mirrored, with the attacking striker at kickOffHex `{q:18,r:13}`.

### Task 2: Narrow VALID_TEAM_IDS and run test suite

In `packages/server/src/roomHandlers.ts`:

- Changed `['cosmos', 'xolos', 'city', 'crew']` to `['city', 'crew']`
- TypeScript now rejects any assignment of `'cosmos'` or `'xolos'` to `TeamId` at compile time
- A `team:pick 'cosmos'` or `team:pick 'xolos'` event is rejected at the allow-list guard before any TEAM_CONFIGS lookup (T-19-03 mitigated)

## Test Results

- `npx tsc --noEmit`: **0 errors**
- `npx vitest run`: **490 passed | 1 skipped | 1 todo** (23 test files, all pass)
- Striker positioning at kickOffHex confirmed via `gameEngine.teamselect.test.ts` (5 tests, all pass)

## Commits

| Hash    | Description                                                                    |
| ------- | ------------------------------------------------------------------------------ |
| 3213d28 | feat(19-02): rewrite buildSquadPieces to use getSquadPlayers from PLAYER_POOL  |
| 4f4eb70 | feat(19-02): shrink VALID_TEAM_IDS allow-list to active teams ['city', 'crew'] |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 20 server test files used retired TeamId literals 'cosmos'/'xolos'**

- **Found during:** Task 1 — TypeScript compilation after shared dist was built
- **Issue:** All 20 server test files used `selectedTeams: { home: 'cosmos', away: 'xolos' }` patterns. After Plan 19-01 narrowed `TeamId = 'city' | 'crew'`, these are no longer assignable to `TeamId`. This produced 102 of the 104 compile errors.
- **Fix:** Mechanical sed replacement: `'cosmos'` → `'city'`, `'xolos'` → `'crew'` across all 20 affected test files. No test assertions referenced specific player names (e.g., no "Nicolae Rusu" assertions existed despite PATTERNS.md warning). Id-based assertions (`home-0`..`home-10`) are unchanged because the new index-based scheme produces the same ids.
- **Files modified:** 20 test files (see key_files)
- **Commit:** 3213d28

## Known Stubs

None — all production code is fully wired. buildSquadPieces resolves real players from PLAYER_POOL. VALID_TEAM_IDS enforces exactly the active team set.

## Threat Flags

No new network endpoints, auth paths, or trust-boundary changes. T-19-03 (Tampering via `team:pick` with a retired team id) is now mitigated: `VALID_TEAM_IDS = ['city', 'crew']` rejects any other string at the allow-list guard.

## Self-Check

- packages/server/src/gameEngine.ts: FOUND (contains getSquadPlayers, no TEAM_SQUADS)
- packages/server/src/roomHandlers.ts: FOUND (contains ['city', 'crew'], no cosmos/xolos)
- Commits 3213d28 and 4f4eb70: present in git log
- TypeScript: 0 errors
- Test suite: 490/490 pass

## Self-Check: PASSED
