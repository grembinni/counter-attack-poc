---
phase: 21-new-teams-mls-international
plan: '01'
subsystem: shared-data-model
tags:
  - team-config
  - data-model
  - server-validation
dependency_graph:
  requires:
    - 'phases/20-uniform-style-system (UniformStyleId union — all 12 style IDs must exist)'
    - 'phases/19-data-model-team-palette (COLOR_SCHEME_REGISTRY — all 10 new entries pre-populated)'
  provides:
    - 'TeamId 12-member union (la, miami, nashville, seattle, canada, england, france, mexico, spain, us)'
    - 'TEAM_CONFIGS 12 entries with verified playerIds, league, badgeFile, defaultUniformStyle'
    - 'VALID_TEAM_IDS 12-member allow-list in roomHandlers.ts'
    - 'teamConfig.test.ts updated — 12-team/14-scheme assertions, all 12 squads resolve to 11 players'
  affects:
    - 'Plan 21-02 (TeamSelectionScreen tab UI — depends on TeamId being 12 members)'
    - 'Server room join — VALID_TEAM_IDS now accepts all 12 team picks'
tech_stack:
  added: []
  patterns:
    - 'Record<TeamId, TeamConfig> as TypeScript compilation gate for data completeness'
    - 'COLOR_SCHEME_REGISTRY palette reference (no inline hex literals in new TEAM_CONFIGS entries)'
    - 'playerIds string array referencing PLAYER_POOL by sequential p-IDs'
key_files:
  created: []
  modified:
    - packages/shared/src/teamConfig.ts
    - packages/shared/src/teamConfig.test.ts
    - packages/server/src/roomHandlers.ts
decisions:
  - 'D-17 (CONTEXT.md) player ID ranges are authoritative: seattle=p091-p101, nashville=p102-p112 (PLAN.md action description had these reversed; verified against teams.ts sourceTeamId slugs)'
  - 'TEAM_CONFIGS ordering: la, miami, nashville, seattle (MLS new), then canada, england, france, mexico, spain, us (international) — matches D-11/D-12 tab order'
metrics:
  duration: '~10 minutes'
  completed: '2026-07-04'
  tasks: 3
  files: 3
---

# Phase 21 Plan 01: Data Model Extension Summary

**One-liner:** 12-member TeamId union + 10 new TEAM_CONFIGS entries (4 MLS + 6 international) with verified playerIds, server VALID_TEAM_IDS extended to 12, and teamConfig.test.ts assertions updated to match.

## Tasks Completed

| Task | Name                                                    | Commit  | Files                                  |
| ---- | ------------------------------------------------------- | ------- | -------------------------------------- |
| 1    | Extend TeamId union and add 10 new TEAM_CONFIGS entries | 4eca245 | packages/shared/src/teamConfig.ts      |
| 2    | Update teamConfig.test.ts count and coverage assertions | 58fa8c6 | packages/shared/src/teamConfig.test.ts |
| 3    | Extend server VALID_TEAM_IDS allow-list to 12 members   | 1f6cc67 | packages/server/src/roomHandlers.ts    |

## Verification Results

- `pnpm --filter @counter-attack/shared run test` — 510 tests pass (12 test files; 205 teamConfig tests green)
- `pnpm --filter @counter-attack/shared exec tsc --noEmit` — exits 0 (Record<TeamId, TeamConfig> completeness gate satisfied)
- `pnpm --filter @counter-attack/server exec tsc --noEmit` — exits 0 (readonly TeamId[] allow-list gate satisfied)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PLAN.md action description had seattle/nashville playerIds ranges reversed**

- **Found during:** Task 1, cross-referencing actual teams.ts data
- **Issue:** PLAN.md task action listed nashville=p091-p101 and seattle=p102-p112, but teams.ts shows p091-p101 has `sourceTeamId: 'seattle'` and p102-p112 has `sourceTeamId: 'nashville'`
- **Fix:** Used CONTEXT.md D-17 and verified teams.ts directly — seattle=p091-p101, nashville=p102-p112
- **Files modified:** packages/shared/src/teamConfig.ts (correct ranges used)
- **Impact:** Prevents wrong players being assigned to wrong teams

**2. [Rule 3 - Blocker] Server tsc --noEmit failed with stale shared package build**

- **Found during:** Task 3 verification
- **Issue:** Server TypeScript could not resolve new TeamId members because shared dist/ was outdated
- **Fix:** Ran `pnpm --filter @counter-attack/shared run build` before server tsc check
- **Impact:** Server tsc passes clean after shared rebuild

## Known Stubs

None. All 10 new TEAM_CONFIGS entries have verified playerIds from PLAYER_POOL. All entries reference COLOR_SCHEME_REGISTRY palettes (no inline hex literals). No placeholder values.

## Threat Flags

T-21-01 (Tampering) mitigated as planned: `VALID_TEAM_IDS` allow-list extended to 12 members with `readonly TeamId[]` type gate. No new threat surface beyond what was in the plan's threat model.

## Self-Check: PASSED

- `packages/shared/src/teamConfig.ts` — exists, contains 'la' | 'miami' in TeamId union, 12 TEAM_CONFIGS entries
- `packages/shared/src/teamConfig.test.ts` — exists, contains toHaveLength(12) and toHaveLength(14)
- `packages/server/src/roomHandlers.ts` — exists, VALID_TEAM_IDS contains 12 members
- Commits 4eca245, 58fa8c6, 1f6cc67 — all present in git log
