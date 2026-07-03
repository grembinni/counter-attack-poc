---
phase: 19-data-model-team-palette
plan: '01'
subsystem: shared-data-model
tags: [data-model, player-pool, team-palette, seed-script, typescript]
dependency_graph:
  requires: []
  provides:
    - PLAYER_POOL (178 players)
    - TeamId = 'city' | 'crew'
    - ColorSchemeId = 'cosmos' | 'xolos' | 'city' | 'crew'
    - TeamPalette (4-color model)
    - COLOR_SCHEME_REGISTRY (4 entries)
    - TEAM_CONFIGS (city + crew with playerIds populated)
    - getSquadPlayers(teamId) helper
  affects:
    - packages/server (buildSquadPieces must switch to getSquadPlayers)
    - packages/client (primaryColor → palette.primary in 5 components, Plans 02/03)
tech_stack:
  added: []
  patterns:
    - TeamId/ColorSchemeId split for active vs historical teams
    - PLAYER_POOL flat array replacing per-squad exports
    - Sequential p001..p178 player IDs from seed script
    - toSlug() normalizer for multi-team CSV team names
key_files:
  created: []
  modified:
    - packages/shared/src/teamConfig.ts
    - packages/shared/src/teams.ts
    - packages/shared/src/teamConfig.test.ts
    - packages/shared/src/teams.test.ts
    - packages/shared/scripts/seed-rosters.ts
    - packages/shared/src/data/city_players.csv
    - packages/shared/src/data/crew_players.csv
    - packages/shared/src/data/cosmos_players.csv
    - packages/shared/src/data/xolos_players.csv
    - packages/shared/src/data/fa_players.csv
    - packages/shared/src/data/mls.csv
    - packages/shared/src/data/national.csv
decisions:
  - 'PoolPlayer.sourceTeamId typed as string (wide) per A4 — tightened in Phase 21 when all slugs are known'
  - "Free agents use sourceTeamId: 'free-agent' literal string"
  - 'Free agent number set to 0 (no squad jersey assignment)'
  - 'aerialAbility is 0 for outfield players — this is correct per CSV data (blank = 0); only GKs have non-zero values'
  - 'GK aerialAbility used to verify typo fix works (GKs have explicit CSV values)'
metrics:
  duration: '~16 min'
  completed: '2026-07-03'
  tasks: 3
  files: 12
---

# Phase 19 Plan 01: Data Model Foundation Summary

Establish the Phase 19 shared data foundation: 4-color palette model, TeamId/ColorSchemeId split, COLOR_SCHEME_REGISTRY, and unified PLAYER_POOL replacing TEAM_SQUADS + FREE_AGENTS. Fix "Arial Ability" CSV typo across all 7 files and extend seed script to ingest mls.csv + national.csv with sequential p001..p178 IDs.

## What Was Built

### Task 1: teamConfig.ts rewrite + teamConfig.test.ts

Replaced the old 2-color `TeamConfig` with the Phase 19 shape:

- `TeamId = 'city' | 'crew'` — cosmos and xolos removed (D-04)
- `ColorSchemeId = 'cosmos' | 'xolos' | 'city' | 'crew'` — full historical set (D-06)
- `TeamPalette { primary, primaryLight, secondary1, secondary2 }` — 4 authored colors per team (D-08/PALETTE-01/03)
- `ColorScheme { id, name, palette, badgeFile }` — registry entry shape
- `TeamConfig { id, name, colorSchemeId, palette, playerIds, league, badgeFile }` — primaryColor/secondaryColor removed
- `COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme>` — all 4 historical teams
- `TEAM_CONFIGS: Record<TeamId, TeamConfig>` — city and crew only (D-05)
- `getSquadPlayers(teamId): PoolPlayer[]` — resolves TEAM_CONFIGS.playerIds against PLAYER_POOL

Also wrote minimal teams.ts stub (PoolPlayer interface + empty PLAYER_POOL) to unblock Task 1 compilation.

**Authored color values (Claude's Discretion):**

| Team   | primary   | primaryLight | secondary1 | secondary2 |
| ------ | --------- | ------------ | ---------- | ---------- |
| cosmos | `#3b82f6` | `#93c5fd`    | `#c8a84b`  | `#1e3a5f`  |
| xolos  | `#f59e0b` | `#fcd34d`    | `#6b7280`  | `#1f2937`  |
| city   | `#dc143c` | `#f87171`    | `#f5c518`  | `#1e1e2e`  |
| crew   | `#f5c518` | `#fde68a`    | `#111111`  | `#14532d`  |

### Task 2: CSV typo fix

Fixed `Arial Ability` → `Aerial Ability` in all 7 CSV headers:

- city_players.csv, crew_players.csv, cosmos_players.csv, xolos_players.csv, fa_players.csv
- mls.csv (added from main repo — 44 players, 4 MLS teams)
- national.csv (added from main repo — 66 players, 6 national teams)

Updated seed-rosters.ts key from `idx['Arial Ability']` to `idx['Aerial Ability']` (D-13).

### Task 3: seed-rosters.ts rewrite + PLAYER_POOL generation + teams.test.ts

Extended seed-rosters.ts to:

- Add `toSlug()` normalizer: `"Inter Miami"` → `"inter-miami"`, `"USMNT"` → `"usmnt"`
- Process 7 CSV files in deterministic order (cosmos → xolos → city → crew → FA → mls → national)
- Handle multi-team CSVs (mls.csv, national.csv) where Team column drives sourceTeamId
- Assign global sequential IDs p001..p178 across all squads
- Emit `PLAYER_POOL: readonly PoolPlayer[]` (178 entries) replacing TEAM_SQUADS + FREE_AGENTS
- Drop `heading` from PoolPlayer output (D-01 Phase 17)
- Add `sourceTeamId: string` to each entry

Generated teams.ts and populated TEAM_CONFIGS.playerIds in teamConfig.ts.

## PLAYER_POOL Summary

| Source      | Count   | ID Range  |
| ----------- | ------- | --------- |
| cosmos      | 11      | p001–p011 |
| xolos       | 11      | p012–p022 |
| city        | 11      | p023–p033 |
| crew        | 11      | p034–p044 |
| free-agent  | 24      | p045–p068 |
| inter-miami | 11      | p069–p079 |
| lafc        | 11      | p080–p090 |
| seattle     | 11      | p091–p101 |
| nashville   | 11      | p102–p112 |
| usmnt       | 11      | p113–p123 |
| england     | 11      | p124–p134 |
| mexico      | 11      | p135–p145 |
| canada      | 11      | p146–p156 |
| spain       | 11      | p157–p167 |
| france      | 11      | p168–p178 |
| **Total**   | **178** |           |

## City Squad (p023–p033) — for Plan 19-03 ActionLog reference

| #   | Name            | Role | ID   |
| --- | --------------- | ---- | ---- |
| 1   | Roman Bürki     | GK   | p023 |
| 2   | Timo Baumgartl  | DEF  | p024 |
| 3   | Fallou Fall     | DEF  | p025 |
| 4   | Tomas Totland   | DEF  | p026 |
| 5   | Marcel Hartel   | MID  | p027 |
| 6   | Eduard Löwen    | MID  | p028 |
| 7   | Célio Pompeu    | FWD  | p029 |
| 8   | Conrad Wallem   | FWD  | p030 |
| 9   | Sang-bin Jeong  | FWD  | p031 |
| 10  | Cedric Teuchert | FWD  | p032 |
| 11  | Simon Becher    | ST   | p033 |

## Crew Squad (p034–p044) — for Plan 19-03 ActionLog reference

| #   | Name              | Role | ID   |
| --- | ----------------- | ---- | ---- |
| 1   | Patrick Schulte   | GK   | p034 |
| 2   | Steven Moreira    | DEF  | p035 |
| 3   | Rudy Camacho      | DEF  | p036 |
| 4   | DeJuan Jones      | DEF  | p037 |
| 5   | Yaw Yeboah        | MID  | p038 |
| 6   | Max Arfsten       | MID  | p039 |
| 7   | Sean Zawadzki     | FWD  | p040 |
| 8   | Derrick Jones     | FWD  | p041 |
| 9   | Diego Rossi       | FWD  | p042 |
| 10  | Christian Ramirez | FWD  | p043 |
| 11  | Cucho Hernandez   | ST   | p044 |

**home-9 player (city):** Sang-bin Jeong, FWD, p031
**away-9 player (crew):** Diego Rossi, FWD, p042

## Test Results

- teamConfig.test.ts: 54 tests pass
- teams.test.ts: 22 tests pass (replaces old TEAM_SQUADS/FREE_AGENTS tests)
- Full shared suite: 359/359 tests pass
- TypeScript: 0 errors

## Commits

| Hash    | Description                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------ |
| eb6d41b | feat(19-01): rewrite teamConfig.ts with 4-color palette, ColorSchemeId split, and teams.ts stub  |
| f025f2b | fix(19-01): fix typo in all 7 CSVs and seed script (D-13)                                        |
| be9109a | feat(19-01): generate PLAYER_POOL (178 players), populate TEAM_CONFIGS.playerIds, add teams test |
| bd51ca0 | chore(19-01): remove old typo string from JSDoc comments in generated output and seed template   |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] teams.ts stub required for Task 1 compilation**

- **Found during:** Task 1
- **Issue:** teamConfig.ts imports `PoolPlayer` and `PLAYER_POOL` from `teams.ts` — but the old teams.ts used the old `TeamId` which no longer includes `cosmos`/`xolos`. TypeScript compilation failed.
- **Fix:** Wrote a minimal teams.ts stub (PoolPlayer interface + empty `PLAYER_POOL`) to unblock Task 1 types and tests. Task 3 regenerated the full file via seed script.
- **Files modified:** packages/shared/src/teams.ts
- **Commit:** eb6d41b

**2. [Rule 1 - Bug] ESLint error: `ColorSchemeId | string` redundant union**

- **Found during:** Task 1 commit attempt
- **Issue:** ESLint `@typescript-eslint/no-redundant-type-constituents` rejected `ColorSchemeId | string` in PoolPlayer (string overrides the literals). Per A4, the plan wanted this wide type.
- **Fix:** Changed `sourceTeamId: ColorSchemeId | string` to `sourceTeamId: string` with a comment explaining Phase 21 will tighten it. Removed unused `ColorSchemeId` import from teams.ts stub.
- **Files modified:** packages/shared/src/teams.ts
- **Commit:** eb6d41b

**3. [Rule 1 - Bug] Test "outfield aerialAbility > 0" failed — CSV data is blank for outfielders**

- **Found during:** Task 3 test run
- **Issue:** The plan's `<behavior>` for teams.test.ts says "every PoolPlayer has a defined aerialAbility (>= 0) confirming the header-key fix produced non-zero values for outfielders". However, the actual CSV data has blank Aerial Ability for ALL outfield players in all 7 CSVs — only GKs have explicit values. aerialAbility = 0 for outfielders is correct.
- **Fix:** Changed the test to assert that GKs (who DO have explicit CSV values like 4, 5, 6) have aerialAbility > 0, which correctly verifies the header key lookup works.
- **Files modified:** packages/shared/src/teams.test.ts
- **Commit:** be9109a

**4. [Rule 2 - Cleanup] JSDoc comments contained old 'Arial Ability' typo string**

- **Found during:** Post-Task-3 verification
- **Issue:** The seed script template and generated teams.ts both had `/** D-13: Fixed "Arial Ability" → "Aerial Ability" */` as JSDoc comments, causing `grep -r "Arial Ability" packages/shared` to return hits.
- **Fix:** Changed JSDoc comment to `/** D-13: Aerial Ability — CSV header typo corrected in Phase 19. */` in both seed script template and teams.ts.
- **Files modified:** packages/shared/scripts/seed-rosters.ts, packages/shared/src/teams.ts
- **Commit:** bd51ca0

## Known Stubs

None — all data is fully wired. TEAM_CONFIGS.playerIds contains real p-IDs from the seed output. PLAYER_POOL has 178 real players. The only "stub" is that PoolPlayer.sourceTeamId is `string` (wide) per A4 — tightened in Phase 21.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. All changes are static in-memory data and dev-time tooling.

## Self-Check

<!-- filled in below after verification -->

## Self-Check: PASSED

- packages/shared/src/teamConfig.ts: FOUND
- packages/shared/src/teams.ts: FOUND (178 players in PLAYER_POOL)
- packages/shared/src/teamConfig.test.ts: FOUND (54 tests)
- packages/shared/src/teams.test.ts: FOUND (22 tests)
- packages/shared/scripts/seed-rosters.ts: FOUND (rewritten)
- Commits eb6d41b, f025f2b, be9109a, bd51ca0: all present in git log
- TypeScript: 0 errors
- Test suite: 359/359 pass
