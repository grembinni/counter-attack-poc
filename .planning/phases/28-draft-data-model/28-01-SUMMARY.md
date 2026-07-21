---
phase: 28-draft-data-model
plan: 01
subsystem: database
tags: [csv-codegen, vitest, typescript, data-model]

# Dependency graph
requires:
  - phase: 27-game-creation-settings
    provides: DraftPoolId, SELECTABLE_DRAFT_POOLS, TeamType vocabulary in types.ts
provides:
  - "PoolPlayer.poolTag optional field ('legend' | 'icon') threaded through CSV -> seed-rosters.ts -> teams.ts"
  - '10 reserved Legends/Icons free agents tagged (5 legend / 5 icon); (L)/(M) name suffixes stripped'
  - 'DraftTier type and TIER_PERCENTILE_BOUNDS/PACKS_PER_MATCH/PACK_COMPOSITION exported constants in types.ts'
  - 'teams.test.ts poolTag data-integrity assertions (count, split, suffix removal, mononym edge, decoys, original-pool size)'
affects:
  [28-02-tier-classification, 28-03-pack-generation, 28-04-draft-engine-integration, 29-draft-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whitelist-parse pattern for CSV-sourced optional enum fields (poolTag: only 'legend'/'icon' accepted, else undefined)"
    - 'Guarded conditional-emit line in codegen serializer for optional fields (only emit poolTag line when defined)'

key-files:
  created: []
  modified:
    - packages/shared/src/data/player-pool.csv
    - packages/shared/scripts/seed-rosters.ts
    - packages/shared/src/teams.ts
    - packages/shared/src/teams.test.ts
    - packages/shared/src/types.ts

key-decisions:
  - 'poolTag stored as explicit optional field on PoolPlayer rather than runtime regex on name suffixes (D-02)'
  - "Mononyms Pele and Ronaldinho parse to firstName=<name>, lastName='' after suffix strip; no special-case leading-space handling needed since parseRow trims cells (D-03)"
  - 'DraftTier/TIER_PERCENTILE_BOUNDS/PACKS_PER_MATCH/PACK_COMPOSITION placed in types.ts; PoolPlayer NOT imported into types.ts to avoid a types.ts <-> teams.ts circular dependency (T-28-DATA-2)'

patterns-established:
  - "Draft data-model constants (tier vocabulary, percentile bounds, pack composition) live in types.ts alongside Phase 27's DraftPoolId/TeamType, following the same JSDoc-cited-decision-ID + union-type + const house style"

requirements-completed: [DRAFT-04, DRAFT-05]

# Metrics
duration: 18min
completed: 2026-07-21
---

# Phase 28 Plan 01: Draft Data Model Foundation Summary

**Threaded a `poolTag` field ('legend' | 'icon') through the CSV -> seed-rosters.ts -> teams.ts codegen pipeline to tag 10 reserved Legends/Icons free agents, and added `DraftTier`/`TIER_PERCENTILE_BOUNDS`/`PACKS_PER_MATCH`/`PACK_COMPOSITION` configurable draft constants to types.ts.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-21T11:20:00Z (approx)
- **Completed:** 2026-07-21T11:38:30Z
- **Tasks:** 3/3 completed
- **Files modified:** 5

## Accomplishments

- `PoolPlayer.poolTag` field threaded end-to-end: CSV `PoolTag` column -> `seed-rosters.ts` whitelist parse/emit -> regenerated `teams.ts`. Pool stays at 188 players (additive field).
- 10 free agents tagged (5 `legend`: Maradona, Maldini, Pelé, Ronaldinho, Zidane; 5 `icon`: Ronaldo, Haaland, De Bruyne, Neymar Jr, van Dijk); `(L)`/`(M)` name suffixes removed; mononyms (Pelé, Ronaldinho) correctly parse to empty `lastName`.
- `types.ts` gained four exported draft configuration symbols (`DraftTier`, `TIER_PERCENTILE_BOUNDS`, `PACKS_PER_MATCH`, `PACK_COMPOSITION`) for downstream tier-classification/pack-generation plans, with no circular import introduced.
- `teams.test.ts` gained an 8-test `describe` block asserting the full poolTag data contract, including the `'original'` pool derivation (free-agent AND no poolTag) = 46 players (4 GK).

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread poolTag through the CSV -> seed -> teams.ts codegen pipeline** - `d669fc2` (feat)
2. **Task 2: Add draft tier + pack configuration vocabulary to types.ts** - `1f44feb` (feat)
3. **Task 3: Assert poolTag data integrity in teams.test.ts** - `f672a81` (test)

**Plan metadata:** commit deferred (worktree mode — orchestrator handles final metadata commit after merge)

## Files Created/Modified

- `packages/shared/src/data/player-pool.csv` - Added trailing `PoolTag` header column; stripped `(L)`/`(M)` suffixes from 10 rows and appended `legend`/`icon` tag values
- `packages/shared/scripts/seed-rosters.ts` - Added `poolTag` to `RawPlayer`/`PlayerEntry`, whitelist-parse in `parseRow`, threaded through `buildSquadEntries` and the free-agent inline push, guarded conditional emit in `serializePlayer`, and added the field to the emitted `PoolPlayer` interface template
- `packages/shared/src/teams.ts` - AUTO-GENERATED; regenerated via `pnpm run seed:rosters` (188 players, 10 poolTag rows, no `(L)`/`(M)` remnants)
- `packages/shared/src/teams.test.ts` - New `describe('PoolPlayer poolTag — DRAFT-04 / D-01 / D-02 / D-03...')` block (8 tests)
- `packages/shared/src/types.ts` - Added `DraftTier`, `TIER_PERCENTILE_BOUNDS`, `PACKS_PER_MATCH`, `PACK_COMPOSITION` after `SELECTABLE_DRAFT_POOLS`

## Decisions Made

- Followed the plan's exact naming and values for all four new `types.ts` symbols (no deviation).
- `PoolPlayer` import intentionally excluded from `types.ts` per the plan's explicit circular-dependency warning; player-referencing output types (`TieredPoolPlayer`, `DraftPack`) remain deferred to `draftEngine.ts` in plans 28-02/28-03 as specified.

## Deviations from Plan

None - plan executed exactly as written. One incidental environment setup step was required (see Issues Encountered) but did not alter any plan file targets, task scope, or acceptance criteria.

## Issues Encountered

- The worktree had no `node_modules` installed (fresh worktree checkout). Ran `pnpm install --frozen-lockfile` before Task 1 could execute `pnpm run seed:rosters` — this installed existing lockfile dependencies only, no new packages were added or resolved outside the committed `pnpm-lock.yaml`, so it did not trigger the package-install Rule 3 exclusion (no new/unverified package names were introduced).
- Re-running `pnpm run seed:rosters` for final plan-level verification produced a `teams.ts` diff limited to prettier quote-style formatting (`"N'Golo"` vs `'N\'Golo'` and trailing-comma-before-bracket) versus the already-committed, lint-staged-formatted version — this is pre-existing raw-generator-vs-prettier drift unrelated to the poolTag work. Reverted with `git checkout -- packages/shared/src/teams.ts` to keep the working tree clean; the committed `teams.ts` (task 1 commit `d669fc2`) is the correct, prettier-formatted artifact.
- The untracked `packages/shared/src/data/.~lock.player-pool.csv#` file (spreadsheet-app lock file, noted in task context as unrelated) was left untouched throughout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 28-02/28-03/28-04 can now import `poolTag` off `PoolPlayer`, and `DraftTier`/`TIER_PERCENTILE_BOUNDS`/`PACKS_PER_MATCH`/`PACK_COMPOSITION` from `types.ts`, by the exact names established here.
- `'original'` pool derivation (`sourceTeamId === 'free-agent' && !poolTag`) is verified at exactly 46 players (4 GK) — ready for the tier-classification engine in 28-02.
- No blockers identified.

---

_Phase: 28-draft-data-model_
_Completed: 2026-07-21_
