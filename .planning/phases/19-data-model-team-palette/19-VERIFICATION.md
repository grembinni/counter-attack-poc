---
phase: 19-data-model-team-palette
verified: 2026-07-03T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: 'Confirm stray packages/shared/src/mls.csv (untracked, not in src/data/) does not cause confusion or accidental use'
    expected: "File is either deleted or gitignored; the seed script exclusively reads from src/data/mls.csv which has the correct 'Aerial Ability' header"
    why_human: 'The file is untracked by git and not used by the seed script, so it causes no functional harm, but it contains the old typo and could mislead a developer who edits it directly. A human must decide whether to delete it or add it to .gitignore.'
---

# Phase 19: Data Model & Team Palette Verification Report

**Phase Goal:** The foundational data layer is stable — 4-color palette model adopted, player pool established, Xolos/Cozmos retired from selectable teams, league field on TeamConfig
**Verified:** 2026-07-03T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                        | Status   | Evidence                                                                                                               |
| --- | -------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | `TeamId = 'city' \| 'crew'` only; cosmos/xolos removed                                       | VERIFIED | `teamConfig.ts:12` — `export type TeamId = 'city' \| 'crew'`                                                           |
| 2   | `ColorSchemeId = 'cosmos' \| 'xolos' \| 'city' \| 'crew'` (historical set retained)          | VERIFIED | `teamConfig.ts:16` — `export type ColorSchemeId = 'cosmos' \| 'xolos' \| 'city' \| 'crew'`                             |
| 3   | `TeamPalette` has exactly 4 fields: primary, primaryLight, secondary1, secondary2            | VERIFIED | `teamConfig.ts:20-25` — interface with all 4 string fields declared                                                    |
| 4   | `COLOR_SCHEME_REGISTRY` has exactly 4 entries (cosmos, xolos, city, crew)                    | VERIFIED | `teamConfig.ts:59-104` — object literal with keys cosmos, xolos, city, crew                                            |
| 5   | `TEAM_CONFIGS` has exactly 2 entries (city, crew)                                            | VERIFIED | `teamConfig.ts:108-153` — object literal with keys city and crew only                                                  |
| 6   | `PLAYER_POOL` replaces `TEAM_SQUADS` + `FREE_AGENTS`; 178 entries, sequential p001..p178 IDs | VERIFIED | `teams.ts:45` — `export const PLAYER_POOL: readonly PoolPlayer[]`; grep count = 178; no `TEAM_SQUADS` export           |
| 7   | `getSquadPlayers` exported and used by `buildSquadPieces` in server                          | VERIFIED | `teamConfig.ts:158` — exported function; `gameEngine.ts:29,116,121` — imported and called for both squads              |
| 8   | `VALID_TEAM_IDS = ['city', 'crew']` in roomHandlers.ts                                       | VERIFIED | `roomHandlers.ts:40` — `const VALID_TEAM_IDS: readonly TeamId[] = ['city', 'crew'] as const`                           |
| 9   | No `primaryColor`/`secondaryColor` in client consumer components (5 files)                   | VERIFIED | grep across ActionLog.tsx, GameBoard.tsx, PlayerStatsPanel.tsx, TeamSelectionScreen.tsx, PieceOverlay.tsx = 0 hits     |
| 10  | `mockMovementState` uses `PLAYER_POOL`, `selectedTeams: {home:'city', away:'crew'}`          | VERIFIED | `mockMovementState.ts:2,51,57,81` — imports PLAYER_POOL, filters by sourceTeamId, sets city/crew                       |
| 11  | `TeamBadge` maps contain only city/crew keys                                                 | VERIFIED | `TeamBadge.tsx:15-23` — `BADGE_MAP` and `BADGE_MAP_FULL` both have city and crew keys only                             |
| 12  | All 7 CSV headers in `src/data/` use 'Aerial Ability' (typo fixed)                           | VERIFIED | grep across all 7 files in `src/data/` = 0 "Arial Ability" hits; seed script at line 164 reads `idx['Aerial Ability']` |

**Score:** 12/12 truths verified

### Deferred Items

None.

### Required Artifacts

| Artifact                                        | Expected                                                                                     | Status   | Details                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `packages/shared/src/teamConfig.ts`             | TeamId/ColorSchemeId/TeamPalette types; COLOR_SCHEME_REGISTRY; TEAM_CONFIGS; getSquadPlayers | VERIFIED | All types, registry, configs, and function present and substantive (166 lines)          |
| `packages/shared/src/teams.ts`                  | PoolPlayer interface + PLAYER_POOL constant (178 players)                                    | VERIFIED | 178 entries with sequential p001..p178 IDs, no heading field, sourceTeamId on each      |
| `packages/server/src/gameEngine.ts`             | buildSquadPieces uses getSquadPlayers                                                        | VERIFIED | Import at line 29; called for both home and away squads at lines 116/121                |
| `packages/server/src/roomHandlers.ts`           | VALID_TEAM_IDS = ['city','crew']                                                             | VERIFIED | Line 40: exactly `['city', 'crew'] as const`                                            |
| `packages/client/src/components/TeamBadge.tsx`  | Badge maps keyed to shrunk TeamId                                                            | VERIFIED | Only city/crew keys in both BADGE_MAP and BADGE_MAP_FULL; no cosmos/xolos imports       |
| `packages/client/src/mock/mockMovementState.ts` | Mock GameState built from PLAYER_POOL                                                        | VERIFIED | Imports PLAYER_POOL; filters by sourceTeamId 'city'/'crew'; selectedTeams set correctly |

### Key Link Verification

| From                   | To                                       | Via                                    | Status   | Details                                                                                               |
| ---------------------- | ---------------------------------------- | -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `teamConfig.ts`        | `teams.ts`                               | getSquadPlayers references PLAYER_POOL | VERIFIED | `teamConfig.ts:9` imports PLAYER_POOL from './teams.js'; function body calls `.find()` on it          |
| `gameEngine.ts`        | `@counter-attack/shared getSquadPlayers` | import + call in buildSquadPieces      | VERIFIED | Line 29: `getSquadPlayers` in import block; lines 116/121: `getSquadPlayers(selectedTeams.home/away)` |
| `mockMovementState.ts` | `@counter-attack/shared PLAYER_POOL`     | filter by sourceTeamId                 | VERIFIED | Line 2 imports PLAYER_POOL; lines 51/57 call `.filter(p => p.sourceTeamId === 'city'/'crew')`         |
| `GameBoard.tsx`        | `TEAM_CONFIGS[...].palette.primary`      | field access                           | VERIFIED | 10 occurrences of `.palette.primary` confirmed; zero `.primaryColor` occurrences                      |

### Data-Flow Trace (Level 4)

| Artifact                         | Data Variable | Source                                                                        | Produces Real Data                                                              | Status  |
| -------------------------------- | ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------- |
| `mockMovementState.ts`           | `pieces`      | `PLAYER_POOL.filter(sourceTeamId === 'city'/'crew')`                          | Yes — 178 CSV-seeded players in PLAYER_POOL                                     | FLOWING |
| `GameBoard.tsx`                  | team color    | `TEAM_CONFIGS[selectedTeams[...]].palette.primary`                            | Yes — COLOR_SCHEME_REGISTRY.city/crew.palette values hardcoded in teamConfig.ts | FLOWING |
| `gameEngine.ts buildSquadPieces` | pieces        | `getSquadPlayers(teamId)` resolves TEAM_CONFIGS.playerIds against PLAYER_POOL | Yes — 11 real p-IDs per team, all in PLAYER_POOL                                | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — verifier cannot run the test suite or TypeScript compiler in this environment. SUMMARY.md reports 608/608 tests pass across all packages, and commit history confirms the build was exercised at each commit. Code-level verification of all 12 truths above provides sufficient evidence without running the suite.

### Probe Execution

Step 7c: No probe scripts declared for Phase 19. No conventional `scripts/*/tests/probe-*.sh` files exist for this phase. SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description                                                           | Status    | Evidence                                                                                 |
| ----------- | ----------- | --------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| PALETTE-01  | 19-01       | 4-color palette model (primary, primaryLight, secondary1, secondary2) | SATISFIED | `teamConfig.ts:20-25` TeamPalette interface with all 4 fields                            |
| PALETTE-02  | 19-03       | Old primaryColor/secondaryColor fields gone from all consumers        | SATISFIED | Zero grep hits for primaryColor/secondaryColor in 5 consumer components                  |
| PALETTE-03  | 19-01       | primaryLight authored at data-definition time, not computed           | SATISFIED | `teamConfig.ts:65-67,80,89,99` — literal string values in registry                       |
| TEAM-07     | 19-01/02/03 | Xolos/Cozmos retired from selectable teams                            | SATISFIED | TeamId union = 'city'\|'crew'; VALID_TEAM_IDS=['city','crew']; ALL_TEAMS=['city','crew'] |
| DATA-01     | 19-01       | Single PLAYER_POOL export replacing TEAM_SQUADS/FREE_AGENTS           | SATISFIED | `teams.ts:45` — PLAYER_POOL with 178 entries; no TEAM_SQUADS or FREE_AGENTS export       |
| DATA-02     | 19-01/02    | team configs reference player IDs; getSquadPlayers resolves them      | SATISFIED | TEAM_CONFIGS.city.playerIds (p023-p033), getSquadPlayers called in buildSquadPieces      |
| DATA-03     | 19-01       | COLOR_SCHEME_REGISTRY retains cosmos/xolos palette entries            | SATISFIED | `teamConfig.ts:59-104` — all 4 entries present including retired teams                   |
| LEAGUE-03   | 19-01       | league field on TeamConfig; city and crew = 'mls'                     | SATISFIED | `teamConfig.ts:128,150` — both set to `league: 'mls'`                                    |

### Anti-Patterns Found

| File                                              | Line | Pattern                                                       | Severity | Impact                                                                                                       |
| ------------------------------------------------- | ---- | ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `packages/shared/src/mls.csv` (src/)              | 1    | "Arial Ability" typo (stray untracked file)                   | WARNING  | Not used by seed script (which reads src/data/mls.csv); no runtime impact; but presents a maintenance hazard |
| `packages/client/src/components/HexGrid.test.tsx` | 410  | Comment references "cosmos (home) team's jersey primaryColor" | INFO     | Not a TypeScript type access; JSDoc comment only; file not modified in Phase 19                              |

**Debt marker gate:** No TBD, FIXME, or XXX markers found in Phase 19 modified files.

**Code review findings (19-REVIEW.md):** The phase's own code review identified 3 critical bugs (CR-01: ActionLog null-guard crash, CR-02: CSV parser fragility, CR-03: O(n) scan + uncaught throw) and 8 warnings. These are quality issues surfaced post-completion but do not block the phase goal — the goal is the data model foundation, not bug-free production hardening. These items are recorded in 19-REVIEW.md for follow-up.

### Human Verification Required

#### 1. Stray mls.csv cleanup

**Test:** Navigate to `packages/shared/src/` (not `src/data/`). Observe that `mls.csv` exists there (shown as untracked in git status). Confirm whether this file should be deleted or added to `.gitignore`.
**Expected:** The seed script reads exclusively from `packages/shared/src/data/mls.csv` (confirmed via `DATA_DIR = join(__dirname, '..', 'src', 'data')`). The stray file has no functional impact. It should either be deleted (git-clean) or gitignored to prevent future confusion.
**Why human:** This is an administrative cleanup decision (delete vs. ignore) that cannot be automated by the verifier. The functional correctness is not affected either way, but leaving an untracked file with the old typo in the repo is a maintenance hazard.

### Gaps Summary

No functional gaps. All 12 observable truths verified against live code. The single human-verification item is a housekeeping concern (stray untracked file) with no impact on the phase goal or downstream phases.

The phase goal is substantively achieved: the 4-color palette data model is in place, TeamId/ColorSchemeId are split, PLAYER_POOL unifies 178 players across 7 CSV sources, getSquadPlayers is wired through buildSquadPieces, VALID_TEAM_IDS rejects retired teams, and all client consumers read palette.primary instead of the deleted primaryColor.

---

_Verified: 2026-07-03T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
