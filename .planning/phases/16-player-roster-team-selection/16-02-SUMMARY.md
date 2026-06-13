---
phase: 16-player-roster-team-selection
plan: '02'
subsystem: shared
tags: [data-layer, csv-seed, types, events, tdd-green]
dependency_graph:
  requires: [16-01]
  provides:
    - TEAM_SQUADS_export
    - FREE_AGENTS_export
    - PlayerPiece_firstName_lastName_number_nationality
    - GameState_selectedTeams
    - ServerEvents_TEAM_SELECTION_START
    - ServerEvents_TEAM_HOME_PICKED
    - ClientEvents_TEAM_PICK
  affects:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/shared/src/teams.ts
    - packages/shared/scripts/seed-rosters.ts
    - packages/shared/package.json
    - eslint.config.js
tech_stack:
  added:
    - tsx@4.22.3 (devDep in packages/shared — same version as packages/server)
  patterns:
    - CSV parse via Node built-ins (createReadStream + readline)
    - Header-index map pattern (header row → idx object for column-safe access)
    - TypeScript string template code generation (no template engine)
    - GK attribute override pattern (highPass=0; blank attrs floored to 1)
    - ROLE_ORDER sort for jersey number assignment (GK=1 always)
key_files:
  created:
    - packages/shared/scripts/seed-rosters.ts
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/shared/src/teams.ts
    - packages/shared/package.json
    - eslint.config.js
    - pnpm-lock.yaml
decisions:
  - 'GK attributes heading/shooting/tackling/dribbling/pace/resilience floored to 1 when CSV blank — test spec (teams.test.ts minForAttr) requires >=1 for all non-GK-specific attrs'
  - 'Seed script heading=0 override removed (PATTERNS.md conflicted with test spec; test wins)'
  - 'eslint allowDefaultProject extended with packages/*/scripts/*.ts — scripts/ is outside src/ which tsconfig includes, ESLint project service rejected the file'
metrics:
  duration: '~7 minutes'
  completed: '2026-06-13'
  tasks_completed: 2
  files_modified: 6
---

# Phase 16 Plan 02: Data Layer — Seed Script + Type Surgery Summary

Built the Phase 16 shared data layer: CSV seed script generating TEAM_SQUADS (4×11) + FREE_AGENTS (24) from committed CSVs; PlayerPiece type surgery (firstName/lastName/number/nationality replacing name); GameState.selectedTeams; three team selection socket events.

## Tasks Completed

| Task | Name                                                | Commit  | Files                                                                                                                                 |
| ---- | --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | PlayerPiece + GameState type surgery and new events | 96ab9f8 | packages/shared/src/types.ts, packages/shared/src/events.ts                                                                           |
| 2    | Seed script + regenerate teams.ts                   | 91dbdd5 | packages/shared/scripts/seed-rosters.ts, packages/shared/src/teams.ts, packages/shared/package.json, eslint.config.js, pnpm-lock.yaml |

## Verification

- `pnpm --filter @counter-attack/shared run seed:rosters` — regenerates teams.ts deterministically (4×11 + 24 FA)
- `pnpm --filter @counter-attack/shared run test` — 241/241 PASS (15 Wave-0 RED tests from plan 01 now GREEN)
- `cd packages/shared && npx tsc --noEmit` — clean, zero errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GK attribute minimums: heading/shooting/tackling/dribbling/resilience**

- **Found during:** Task 2 (test run after first seed)
- **Issue:** PATTERNS.md specified `heading: 0` override for GKs. CSV data also left shooting/tackling/dribbling blank (→0). The Wave-0 RED test spec (`teams.test.ts minForAttr`) requires all non-GK-specific attributes >= 1, including heading (no special-case for GK heading in test).
- **Fix:** Removed `heading = 0` override; added floor-to-1 for pace/shooting/tackling/dribbling/heading/resilience when CSV blank. `highPass = 0` remains (only GK-specific zero per test).
- **Files modified:** packages/shared/scripts/seed-rosters.ts
- **Commit:** 91dbdd5

**2. [Rule 3 - Blocking] ESLint project service rejects scripts/\*.ts**

- **Found during:** Task 2 (pre-commit hook failure)
- **Issue:** Root eslint.config.js uses `projectService` which only resolves files through tsconfig.json. packages/shared/tsconfig.json only includes `src/**/*`. scripts/seed-rosters.ts was outside this scope and not in `allowDefaultProject`.
- **Fix:** Added `packages/*/scripts/*.ts` to `allowDefaultProject` array in eslint.config.js.
- **Files modified:** eslint.config.js
- **Commit:** 91dbdd5 (same commit as task 2)

## Known Stubs

None — all data is fully wired from CSVs. TEAM_SQUADS exports are complete and authoritative.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundary changes. Seed script reads committed CSV files (dev-time only, T-16-03 accepted). TeamId payload typing enforced at type layer (T-16-02 mitigated; runtime allow-list validation deferred to plan 03 server handler per threat register).

## Self-Check: PASSED

- packages/shared/scripts/seed-rosters.ts: FOUND
- packages/shared/src/teams.ts: FOUND
- packages/shared/src/types.ts: FOUND
- packages/shared/src/events.ts: FOUND
- packages/shared/package.json: FOUND
- eslint.config.js: FOUND
- Commit 96ab9f8: FOUND
- Commit 91dbdd5: FOUND
