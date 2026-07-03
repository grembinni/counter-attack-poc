# Phase 19: Data Model & Team Palette - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure data layer refactoring — no new UI, no game logic changes. This phase establishes three foundational structures that all of v1.3 (Phases 20–24) builds on:

1. **4-color palette model** — `TeamConfig.palette: TeamPalette` replaces the 2-field `primaryColor`/`secondaryColor`. All consumers updated.
2. **Unified `PLAYER_POOL`** — single flat export replacing `TEAM_SQUADS`; includes all historical squad players + new MLS/international players from CSV; team configs reference player IDs.
3. **Retired-team handling** — Xolos and Cozmos removed from selectable `TeamId` and `TEAM_CONFIGS`; their palette/badge data preserved in `COLOR_SCHEME_REGISTRY`.

TypeScript compiles clean at the end of this phase. No selectable teams are added (Phase 21). No uniform styles are defined (Phase 20). No formation data (Phase 23).

</domain>

<decisions>
## Implementation Decisions

### Player ID Scheme (DATA-01, DATA-02)

- **D-01:** `PLAYER_POOL` uses sequential integer IDs: `p001`, `p002`, ... for all players. Existing team squads (cosmos, xolos, city, crew) get new IDs; free agents also renumbered. IDs are assigned once in the seed script and never change.
- **D-02:** `PoolPlayer` keeps the `position: {q, r}` field with existing placeholder values. Position is a harmless placeholder — it has no algorithmic role in Phase 24 auto-assignment (which scores purely by role stats). Keeping the field avoids a new type for now.
- **D-03:** Team configs in `TEAM_CONFIGS` reference players by ID array (e.g., `playerIds: ['p001', 'p002', ...]`) rather than embedding inline player objects. `buildInitialGameState` uses a `PLAYER_POOL` lookup to resolve IDs to full `PoolPlayer` objects.

### Retired-Team TypeId Scope (TEAM-07, DATA-03)

- **D-04:** `TeamId` union **shrinks** — `'cosmos'` and `'xolos'` are removed. `TeamId = 'city' | 'crew'` in Phase 19 (Phase 21 will extend it with new MLS/international team IDs).
- **D-05:** `TEAM_CONFIGS: Record<TeamId, TeamConfig>` holds only active/selectable teams (`city`, `crew`). Retired team data is NOT in `TEAM_CONFIGS`.
- **D-06:** A separate `COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme>` holds palette and badge data for all historical teams. `ColorSchemeId = 'cosmos' | 'xolos' | 'city' | 'crew'` (extended in Phase 21 with new teams). `TeamConfig` references its color scheme via `colorSchemeId: ColorSchemeId`.
- **D-07:** `PLAYER_POOL` entries annotated with `sourceTeamId: ColorSchemeId` — can reference retired teams ('cosmos', 'xolos') without being constrained to active `TeamId`.

### Palette Shape (PALETTE-01, PALETTE-02, PALETTE-03)

- **D-08:** `TeamConfig` gains `palette: TeamPalette`. The `TeamPalette` type is `{ primary: string; primaryLight: string; secondary1: string; secondary2: string }`. Old `primaryColor` and `secondaryColor` fields are **removed** from `TeamConfig`.
- **D-09:** `primaryLight` is explicitly authored per team at definition time — NOT computed at render time (PALETTE-03). Claude authors reasonable lightened shades for City and Crew.
- **D-10:** All consumers of `primaryColor` in client code are updated to `palette.primary` in Phase 19. This includes: `ActionLog.tsx`, `GameBoard.tsx`, `PlayerStatsPanel.tsx`, `TeamSelectionScreen.tsx`, and `PieceOverlay.tsx` (field access only — the SVG pattern rewrite is Phase 20's job). No SVG pattern logic changes in Phase 19.

### CSV Import and Seed Script (DATA-01, DATA-02)

- **D-11:** Phase 19 ingests `mls.csv` + `national.csv` into `PLAYER_POOL`. These players land in the pool with `sourceTeamId` set to their team slug. The new teams are NOT added to `TeamId` or `TEAM_CONFIGS` in Phase 19 — they become selectable in Phase 21.
- **D-12:** `TEAM_SQUADS` export is **deleted** and replaced entirely by `PLAYER_POOL: readonly PoolPlayer[]`. The seed script (`seed-rosters.ts`) is updated to: read all CSV files (including the new ones), assign sequential `p001...` IDs, and output a single `PLAYER_POOL` array.
- **D-13:** The CSV header typo "Arial Ability" is fixed to "Aerial Ability" in ALL CSV files (`city_players.csv`, `crew_players.csv`, `cosmos_players.csv`, `xolos_players.csv`, `fa_players.csv`, `mls.csv`, `national.csv`). The seed script maps "Aerial Ability" → `aerialAbility`.

### League Field (LEAGUE-03)

- **D-14:** `TeamConfig` gains `league: 'mls' | 'international'`. City and Crew are `'mls'`. The league field is used by Phase 21's team selection screen to group teams into tabs.

### Claude's Discretion

- Exact `primaryLight`, `secondary1`, `secondary2` color values for City and Crew (author reasonable lightened shades; existing `secondaryColor` maps to `secondary1`; `secondary2` is a complementary accent).
- Same for Cosmos/Cozmos and Xolos entries in `COLOR_SCHEME_REGISTRY`.
- Exact file location for `COLOR_SCHEME_REGISTRY` (likely stays in `packages/shared/src/teamConfig.ts` alongside `TeamConfig`).
- Exact player ID assignment order within `PLAYER_POOL` (seed script determines order).
- How `TeamConfig.playerIds` integrates with `buildInitialGameState` (implementation detail for planner).
- Whether `PoolPlayer` is a named type alias or `Omit<PlayerPiece, 'id'>` + id field (implementation detail).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Data Model (source of truth for what changes)

- `packages/shared/src/teamConfig.ts` — current `TeamConfig` type and `TEAM_CONFIGS`; defines what gets refactored
- `packages/shared/src/teams.ts` — current `TEAM_SQUADS` and `FREE_AGENTS`; these are replaced by `PLAYER_POOL`
- `packages/shared/src/types.ts` — `PlayerPiece` type definition; `PoolPlayer` derives from this

### Seed Script (source of truth for data pipeline)

- `packages/shared/scripts/seed-rosters.ts` — the script that generates `teams.ts` from CSV data; must be updated

### CSV Data Files (input to seed script)

- `packages/shared/src/data/city_players.csv`
- `packages/shared/src/data/crew_players.csv`
- `packages/shared/src/data/cosmos_players.csv`
- `packages/shared/src/data/xolos_players.csv`
- `packages/shared/src/data/fa_players.csv`
- `packages/shared/src/data/mls.csv`
- `packages/shared/src/data/national.csv`

### Client Consumers of primaryColor (all need updating)

- `packages/client/src/components/PieceOverlay.tsx` — uses `teamConfig.primaryColor` for piece stroke (field access swap only)
- `packages/client/src/components/ActionLog.tsx` — uses `TEAM_CONFIGS[...].primaryColor` for team color
- `packages/client/src/components/GameBoard.tsx` — uses `primaryColor` ~8 times for scoreboard/turn indicator colors
- `packages/client/src/components/PlayerStatsPanel.tsx` — uses `primaryColor` for mini token fill
- `packages/client/src/components/TeamSelectionScreen.tsx` — uses `primaryColor` for card border color

### Requirements

- `.planning/REQUIREMENTS.md` — PALETTE-01..03, TEAM-07, DATA-01..03, LEAGUE-03

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `seed-rosters.ts` — existing CSV parsing pipeline; already handles multiple CSVs per team type; extend to handle multi-team CSVs (`mls.csv`, `national.csv`) where team name is in a column
- `TEAM_CONFIGS` record pattern — same shape can be used for `COLOR_SCHEME_REGISTRY`
- `TeamConfig.badgeFile` pattern (Phase 15 D-03) — filename key only; applies to new teams too

### Established Patterns

- D-06 refactor (Phase 15/17): `TEAM_CONFIGS[TEAM_DEFAULTS[piece.teamId]]` is the single color source of truth across `GameBoard`, `ActionLog`, `PlayerStatsPanel` — the `.palette.primary` swap follows this same lookup chain
- `badgeFile` is a filename key only — badge assets are imported in `TeamBadge` component, not in shared data; new teams follow the same pattern
- `buildInitialGameState` on the server currently imports `TEAM_SQUADS` directly; it will need a `getSquadPlayers(teamId: TeamId)` helper that looks up player IDs from `TEAM_CONFIGS` and resolves them from `PLAYER_POOL`

### Integration Points

- `packages/server/src/gameEngine.ts` (or similar) — `buildInitialGameState` imports `TEAM_SQUADS`; must switch to `PLAYER_POOL` lookup
- `packages/shared/src/index.ts` — exports `TEAM_SQUADS`; must export `PLAYER_POOL` instead
- `packages/client/src/store/gameStore.ts` (or similar) — check if `TEAM_SQUADS` is imported anywhere on the client side

</code_context>

<specifics>
## Specific Ideas

- CSV files at `packages/shared/src/data/mls.csv` and `packages/shared/src/data/national.csv` already exist with correct column structure. Phase 19 just needs to wire them into the seed pipeline.
- The mls.csv and national.csv have a "Team" column (e.g., "Inter Miami", "USMNT") — the seed script should use this as `sourceTeamId` slug (normalized to a `ColorSchemeId` slug format).
- Fix "Arial Ability" → "Aerial Ability" typo in all CSV headers as part of this phase.
- Phase 21 will add these teams' `TeamConfig` entries and `ColorScheme` registry entries. Phase 19 just populates the player pool.

</specifics>

<deferred>
## Deferred Ideas

- Position as a positioning weight/hint in auto-assignment — user mentioned "use position as weight/factor" but clarified it's a harmless placeholder; actual stat-based scoring is Phase 24's design (ASSIGN-01)
- Additional CSV sources or per-team CSV files for new teams — Phase 21 owns adding new team data
- Animated or dynamic palette picking — out of scope for v1.3 entirely

</deferred>

---

_Phase: 19-data-model-team-palette_
_Context gathered: 2026-07-03_
