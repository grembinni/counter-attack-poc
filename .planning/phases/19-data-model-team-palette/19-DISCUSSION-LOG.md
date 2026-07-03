# Phase 19: Data Model & Team Palette - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 19-data-model-team-palette
**Areas discussed:** Player ID scheme, Retired-team TypeId scope, primaryColor migration depth, CSV import

---

## Player ID Scheme

| Option                             | Description                                     | Selected |
| ---------------------------------- | ----------------------------------------------- | -------- |
| Team-slug prefix: cosmos-1, crew-7 | Prefix with source team slug + jersey number    |          |
| Sequential integers: p001, p002... | Simple monotonic sequence, no meaning in the ID | ✓        |
| Full name slug: vinicius-eubsinno  | Human-readable but fragile on name changes      |          |

**User's choice:** Sequential integers — p001, p002...

| Option                                                          | Description                                                 | Selected |
| --------------------------------------------------------------- | ----------------------------------------------------------- | -------- |
| Strip position — PoolPlayer type without position               | Introduce `type PoolPlayer = Omit<PlayerPiece, 'position'>` |          |
| Keep position — use it as initial weight/factor for positioning | Placeholder position kept in pool entries                   | ✓        |

**User's choice:** Keep position field
**Notes:** User initially described it as "use as initial weight/factor for positioning algorithm," then clarified it is a harmless placeholder with no algorithmic role in Phase 24 auto-assignment. Phase 24 scores slots purely by role stats.

---

## Retired-Team TypeId Scope

| Option                                        | Description                                                  | Selected |
| --------------------------------------------- | ------------------------------------------------------------ | -------- |
| Keep TeamId union, add SELECTABLE_TEAMS array | TeamId stays as-is; SELECTABLE_TEAMS guards selection screen |          |
| Introduce ActiveTeamId narrow type            | type ActiveTeamId = 'city'\|'crew'; separate from TeamId     |          |
| Remove from TeamId entirely                   | Delete 'cosmos'\|'xolos' from union; separate registry       |          |

**User's choice:** Remove from TeamId + remove from TEAM_CONFIGS  
**Notes:** User said "move all players to free agent pool. keep team for team icons and color schemes." When clarified, user confirmed removing them from TEAM_CONFIGS entirely, with palette/badge data moving to a separate COLOR_SCHEME_REGISTRY.

| Option                                            | Description                                  | Selected |
| ------------------------------------------------- | -------------------------------------------- | -------- |
| ColorSchemeId = 'cosmos'\|'xolos'\|'city'\|'crew' | Typed registry key spanning historical teams | ✓        |
| string — loose annotation                         | No new type; less type safety                |          |

**User's choice:** ColorSchemeId typed union

---

## primaryColor Migration Depth

| Option                                    | Description                              | Selected |
| ----------------------------------------- | ---------------------------------------- | -------- |
| Nested object: teamConfig.palette.primary | palette: TeamPalette with 4 fields       | ✓        |
| Flat on TeamConfig: teamConfig.primary    | Fields promoted directly onto TeamConfig |          |

**User's choice:** Nested object — `teamConfig.palette.primary`

| Option                                | Description                                           | Selected |
| ------------------------------------- | ----------------------------------------------------- | -------- |
| Update PieceOverlay field access only | Swap .primaryColor → .palette.primary, no SVG changes |          |
| Leave PieceOverlay for Phase 20       | Phase 19 skips PieceOverlay entirely                  |          |

**User's initial choice:** Leave PieceOverlay for Phase 20  
**Clarification needed:** Removing primaryColor from TeamConfig while leaving PieceOverlay would cause a TypeScript error.

| Option                                                 | Description                                                | Selected |
| ------------------------------------------------------ | ---------------------------------------------------------- | -------- |
| Update PieceOverlay field access only (no SVG changes) | One-line swap keeps TypeScript clean; SVG rewrite deferred | ✓        |
| Keep primaryColor on TeamConfig until Phase 20         | Dual-field period; PieceOverlay untouched                  |          |

**Notes:** User agreed to the field-access-only swap to maintain TypeScript cleanliness. The SVG pattern rewrite (hardcoded per-team branches → parameterized uniformStyle system) remains Phase 20's job.

---

## CSV Import

| Option                                                             | Description                                                       | Selected |
| ------------------------------------------------------------------ | ----------------------------------------------------------------- | -------- |
| Phase 19: ingest into PLAYER_POOL (pool-only, no selectable teams) | All CSV players land in pool; teams not selectable until Phase 21 | ✓        |
| Phase 21: import when teams become selectable                      | mls.csv + national.csv stay unprocessed until Phase 21            |          |

**User's choice:** Phase 19 ingests into PLAYER_POOL (pool-only)

| Option                                        | Description                                    | Selected |
| --------------------------------------------- | ---------------------------------------------- | -------- |
| Replace TEAM_SQUADS entirely with PLAYER_POOL | TEAM_SQUADS deleted; single PLAYER_POOL export | ✓        |
| Keep TEAM_SQUADS + add PLAYER_POOL alongside  | Both exports coexist temporarily               |          |

**User's choice:** Replace TEAM_SQUADS entirely

| Option                                              | Description                                           | Selected |
| --------------------------------------------------- | ----------------------------------------------------- | -------- |
| Fix CSV headers too (normalize to 'Aerial Ability') | Fix typo in all CSVs + seed script                    | ✓        |
| Normalize silently in seed script only              | Keep CSVs as-is; seed maps 'Arial Ability' internally |          |

**User's choice:** Fix CSV headers across all files

---

## Claude's Discretion

- Exact `primaryLight`, `secondary1`, `secondary2` color values for City, Crew, Cosmos, Xolos in the palette/registry
- File location for `COLOR_SCHEME_REGISTRY` (likely within `teamConfig.ts`)
- Exact `PoolPlayer` type definition and whether it's a named alias or derived from `PlayerPiece`
- Player ID assignment order within `PLAYER_POOL`
- How `TeamConfig.playerIds` integrates with `buildInitialGameState`

## Deferred Ideas

- Position-as-weighting-factor in auto-assignment: user floated this but confirmed it's a Phase 24 concern, not Phase 19
- Additional per-team CSV files for new teams: Phase 21 owns adding new team configs
- Animated/dynamic palette selection: out of scope for v1.3
