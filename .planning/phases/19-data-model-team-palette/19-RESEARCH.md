# Phase 19: Data Model & Team Palette - Research

**Researched:** 2026-07-03
**Domain:** TypeScript data model refactoring — shared types, seed pipeline, client consumers
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `PLAYER_POOL` uses sequential integer IDs: `p001`, `p002`, ... for all players. Existing team squads (cosmos, xolos, city, crew) get new IDs; free agents also renumbered. IDs are assigned once in the seed script and never change.
- **D-02:** `PoolPlayer` keeps the `position: {q, r}` field with existing placeholder values. Position is a harmless placeholder — it has no algorithmic role in Phase 24 auto-assignment. Keeping the field avoids a new type for now.
- **D-03:** Team configs in `TEAM_CONFIGS` reference players by ID array (e.g., `playerIds: ['p001', 'p002', ...]`) rather than embedding inline player objects. `buildInitialGameState` uses a `PLAYER_POOL` lookup to resolve IDs to full `PoolPlayer` objects.
- **D-04:** `TeamId` union shrinks — `'cosmos'` and `'xolos'` are removed. `TeamId = 'city' | 'crew'` in Phase 19 (Phase 21 will extend it with new MLS/international team IDs).
- **D-05:** `TEAM_CONFIGS: Record<TeamId, TeamConfig>` holds only active/selectable teams (`city`, `crew`). Retired team data is NOT in `TEAM_CONFIGS`.
- **D-06:** A separate `COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme>` holds palette and badge data for all historical teams. `ColorSchemeId = 'cosmos' | 'xolos' | 'city' | 'crew'` (extended in Phase 21 with new teams). `TeamConfig` references its color scheme via `colorSchemeId: ColorSchemeId`.
- **D-07:** `PLAYER_POOL` entries annotated with `sourceTeamId: ColorSchemeId` — can reference retired teams ('cosmos', 'xolos') without being constrained to active `TeamId`.
- **D-08:** `TeamConfig` gains `palette: TeamPalette`. The `TeamPalette` type is `{ primary: string; primaryLight: string; secondary1: string; secondary2: string }`. Old `primaryColor` and `secondaryColor` fields are removed from `TeamConfig`.
- **D-09:** `primaryLight` is explicitly authored per team at definition time — NOT computed at render time. Claude authors reasonable lightened shades for City and Crew.
- **D-10:** All consumers of `primaryColor` in client code are updated to `palette.primary` in Phase 19. This includes: `ActionLog.tsx`, `GameBoard.tsx`, `PlayerStatsPanel.tsx`, `TeamSelectionScreen.tsx`, and `PieceOverlay.tsx` (field access only — the SVG pattern rewrite is Phase 20's job). No SVG pattern logic changes in Phase 19.
- **D-11:** Phase 19 ingests `mls.csv` + `national.csv` into `PLAYER_POOL`. These players land in the pool with `sourceTeamId` set to their team slug. The new teams are NOT added to `TeamId` or `TEAM_CONFIGS` in Phase 19 — they become selectable in Phase 21.
- **D-12:** `TEAM_SQUADS` export is deleted and replaced entirely by `PLAYER_POOL: readonly PoolPlayer[]`. The seed script (`seed-rosters.ts`) is updated to: read all CSV files (including the new ones), assign sequential `p001...` IDs, and output a single `PLAYER_POOL` array.
- **D-13:** The CSV header typo "Arial Ability" is fixed to "Aerial Ability" in ALL CSV files (`city_players.csv`, `crew_players.csv`, `cosmos_players.csv`, `xolos_players.csv`, `fa_players.csv`, `mls.csv`, `national.csv`). The seed script maps "Aerial Ability" → `aerialAbility`.
- **D-14:** `TeamConfig` gains `league: 'mls' | 'international'`. City and Crew are `'mls'`. The league field is used by Phase 21's team selection screen to group teams into tabs.

### Claude's Discretion

- Exact `primaryLight`, `secondary1`, `secondary2` color values for City and Crew (existing `secondaryColor` maps to `secondary1`; `secondary2` is a complementary accent)
- Same for Cosmos/Xolos entries in `COLOR_SCHEME_REGISTRY`
- Exact file location for `COLOR_SCHEME_REGISTRY` (likely stays in `packages/shared/src/teamConfig.ts` alongside `TeamConfig`)
- Exact player ID assignment order within `PLAYER_POOL` (seed script determines order)
- How `TeamConfig.playerIds` integrates with `buildInitialGameState` (implementation detail for planner)
- Whether `PoolPlayer` is a named type alias or `Omit<PlayerPiece, ...>` + added fields (implementation detail)

### Deferred Ideas (OUT OF SCOPE)

- Position as a positioning weight/hint in auto-assignment — actual stat-based scoring is Phase 24's design
- Additional CSV sources or per-team CSV files for new teams — Phase 21 owns adding new team data
- Animated or dynamic palette picking — out of scope for v1.3 entirely
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID         | Description                                                                                                                                                                 | Research Support                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| PALETTE-01 | Each team's color definition has exactly 4 values: `primary`, `primaryLight`, `secondary1`, `secondary2`                                                                    | `TeamPalette` type definition in `teamConfig.ts`; colors authored for all 4 teams                                  |
| PALETTE-02 | All teams adopt the 4-value palette model; existing 2-field `primaryColor`/`secondaryColor` removed from `TeamConfig`; all client consumers updated                         | 5 client consumer locations identified below; `TeamConfig` interface replacement documented                        |
| PALETTE-03 | `primaryLight` is explicitly authored per team at data-definition time, not computed at render time                                                                         | Authoring happens in `teamConfig.ts` constant; no derive-at-render logic                                           |
| TEAM-07    | Xolos and Cozmos removed from selectable teams; their players merge into the shared player pool; their palettes and badge identities preserved in the color-scheme registry | `TeamId` shrinks; `COLOR_SCHEME_REGISTRY` retains cosmos/xolos entries; `PLAYER_POOL` entries carry `sourceTeamId` |
| DATA-01    | All players stored in a unified `PLAYER_POOL` export with `sourceTeamId` annotation; pool is queryable independently of any team assignment                                 | `TEAM_SQUADS` and `FREE_AGENTS` deleted; `PLAYER_POOL: readonly PoolPlayer[]` replaces both; seed script rewritten |
| DATA-02    | Standard team squads assembled from `PLAYER_POOL` by player ID; players not embedded inline in team definitions                                                             | `TeamConfig.playerIds: readonly string[]` added; `buildInitialGameState` uses `getSquadPlayers()` helper           |
| DATA-03    | Color scheme registry retains all team palettes (including retired teams) as named entries                                                                                  | `COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme>` covers cosmos, xolos, city, crew                       |
| LEAGUE-03  | `TeamConfig` gains `league: 'mls' \| 'international'`; client groups team cards by league tab; team selection logic otherwise unchanged                                     | `league` field added to `TeamConfig` interface; City and Crew assigned `'mls'`                                     |

</phase_requirements>

---

## Summary

Phase 19 is a pure data-layer refactoring with zero game-logic changes and no new UI. It touches three tightly coupled areas: the shared type definitions in `packages/shared/src/teamConfig.ts` and `packages/shared/src/teams.ts`, the seed pipeline in `packages/shared/scripts/seed-rosters.ts`, and the five client components that read `primaryColor` from `TeamConfig`. The work flows top-down: types first, then data constants, then seed script, then client consumers.

The central structural change is the split of `TeamId` into two distinct concepts: an active `TeamId` union (`'city' | 'crew'`) that drives the `TEAM_CONFIGS` record and the game engine's `buildInitialGameState`, and a broader `ColorSchemeId` union (`'cosmos' | 'xolos' | 'city' | 'crew'`) that anchors the new `COLOR_SCHEME_REGISTRY` and the `PoolPlayer.sourceTeamId` field. This separation lets retired teams retain their identity in the palette/badge registry while disappearing from all selectable-team surfaces. Phase 21 will extend both unions when new teams are added.

The key risk in this phase is the `buildSquadPieces` function inside `gameEngine.ts` (server), which currently calls `TEAM_SQUADS[selectedTeams.home]` to look up squad players. After this phase, `TEAM_SQUADS` no longer exists. A `getSquadPlayers(teamId: TeamId)` helper must be introduced in `packages/shared` that resolves `TeamConfig.playerIds` against `PLAYER_POOL`. The mock state in `mockMovementState.ts` also imports `TEAM_SQUADS` and must be updated to use `PLAYER_POOL` instead. Both locations must be updated atomically with the shared type change or the build will fail.

**Primary recommendation:** Sequence the work as: (1) types + constants in shared, (2) CSV typo fixes + seed script rewrite, (3) server `buildSquadPieces` update, (4) client consumer field-access swaps, (5) mock state update. TypeScript compilation is the gate for each wave — never proceed to the next wave until `pnpm -w tsc --noEmit` is clean.

---

## Architectural Responsibility Map

| Capability                                                                               | Primary Tier           | Secondary Tier  | Rationale                                                                               |
| ---------------------------------------------------------------------------------------- | ---------------------- | --------------- | --------------------------------------------------------------------------------------- |
| Type definitions (`TeamPalette`, `PoolPlayer`, `ColorScheme`, `TeamId`, `ColorSchemeId`) | Shared package         | —               | Types exported from `@counter-attack/shared` and consumed by both server and client     |
| Data constants (`TEAM_CONFIGS`, `COLOR_SCHEME_REGISTRY`, `PLAYER_POOL`)                  | Shared package         | —               | Single source of truth; server reads via `buildInitialGameState`, client reads directly |
| Seed pipeline (`seed-rosters.ts`)                                                        | Shared package scripts | —               | Dev-only tool; generates `teams.ts` from CSV; not part of the build                     |
| Squad resolution at game start (`buildSquadPieces` / `getSquadPlayers`)                  | Server                 | Shared (helper) | Pure function in shared is safer; server imports it to build `GameState.pieces`         |
| `primaryColor` → `palette.primary` field-access swaps                                    | Client (5 components)  | —               | Display-only reads; no logic change                                                     |
| Mock state update (`mockMovementState.ts`)                                               | Client                 | —               | Used only for tests; must be updated to import from `PLAYER_POOL`                       |

---

## Standard Stack

No new external packages required. This phase is entirely in-project refactoring within the existing stack.

| Layer                     | Existing Tool          | Role in Phase 19                                                      |
| ------------------------- | ---------------------- | --------------------------------------------------------------------- |
| TypeScript 5.x            | Type definitions       | `TeamPalette`, `PoolPlayer`, `ColorScheme`, `ColorSchemeId` new types |
| pnpm workspaces           | Monorepo               | `pnpm -w tsc --noEmit` validates cross-package type correctness       |
| Node.js `readline` / `fs` | Already in seed script | Extended to read `mls.csv` and `national.csv`                         |

**No installation step required for this phase.**

---

## Package Legitimacy Audit

> No external packages are installed in this phase. This section is not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
CSV files (7 total)
  city_players.csv, crew_players.csv,
  cosmos_players.csv, xolos_players.csv,
  fa_players.csv, mls.csv, national.csv
        │
        ▼
seed-rosters.ts (dev tool — pnpm run seed:rosters)
        │  assigns sequential p001..pNNN IDs
        │  normalizes team name → ColorSchemeId slug
        │  fixes "Arial Ability" → "Aerial Ability"
        │
        ▼
packages/shared/src/teams.ts [AUTO-GENERATED]
  export const PLAYER_POOL: readonly PoolPlayer[]
        │
        ├──► packages/shared/src/teamConfig.ts [HAND-AUTHORED]
        │      TeamId = 'city' | 'crew'
        │      ColorSchemeId = 'cosmos' | 'xolos' | 'city' | 'crew'
        │      TeamPalette { primary, primaryLight, secondary1, secondary2 }
        │      ColorScheme { id, name, palette, badgeFile }
        │      TeamConfig { id, name, palette, colorSchemeId, playerIds, league, badgeFile }
        │      TEAM_CONFIGS: Record<TeamId, TeamConfig>  ← city + crew only
        │      COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme>  ← all 4
        │
        ├──► packages/server/src/gameEngine.ts
        │      getSquadPlayers(teamId) → PLAYER_POOL.filter(p => TEAM_CONFIGS[teamId].playerIds.includes(p.id))
        │      buildSquadPieces() calls getSquadPlayers() instead of TEAM_SQUADS
        │
        └──► packages/client/src/components/ (5 files)
               ActionLog.tsx         .primaryColor → .palette.primary
               GameBoard.tsx         .primaryColor → .palette.primary (×8)
               PlayerStatsPanel.tsx  .primaryColor → .palette.primary
               TeamSelectionScreen.tsx .primaryColor → .palette.primary (×2)
               PieceOverlay.tsx      .primaryColor → .palette.primary (×2)
```

### Recommended Project Structure

No new directories. Changes are concentrated in:

```
packages/shared/src/
  teamConfig.ts          ← type + constant changes (primary edit target)
  teams.ts               ← regenerated by seed script
  index.ts               ← export PLAYER_POOL instead of TEAM_SQUADS

packages/shared/src/data/
  *.csv                  ← typo fix in 7 files (header row only)

packages/shared/scripts/
  seed-rosters.ts        ← extended to handle mls.csv + national.csv

packages/server/src/
  gameEngine.ts          ← buildSquadPieces rewritten
  roomHandlers.ts        ← VALID_TEAM_IDS updated to ['city', 'crew']

packages/client/src/
  components/ActionLog.tsx
  components/GameBoard.tsx
  components/PlayerStatsPanel.tsx
  components/TeamSelectionScreen.tsx
  components/PieceOverlay.tsx
  mock/mockMovementState.ts
```

### Pattern 1: Type Split — TeamId vs ColorSchemeId

**What:** Two distinct string-literal unions serve different purposes. `TeamId` is the set of selectable teams (drives `TEAM_CONFIGS`, `GameState.selectedTeams`, server validation). `ColorSchemeId` is the full historical set (drives `COLOR_SCHEME_REGISTRY`, `PoolPlayer.sourceTeamId`, `TeamConfig.colorSchemeId`).

**When to use:** Any time a property must reference a team that may be retired (not selectable) — use `ColorSchemeId`. Any time a property participates in team selection or game init — use `TeamId`.

```typescript
// Source: CONTEXT.md D-04, D-06 [ASSUMED: exact implementation]
export type TeamId = 'city' | 'crew';
export type ColorSchemeId = 'cosmos' | 'xolos' | 'city' | 'crew';

export interface TeamConfig {
  id: TeamId;
  name: string;
  colorSchemeId: ColorSchemeId; // points into COLOR_SCHEME_REGISTRY
  palette: TeamPalette; // duplicated from registry for fast access
  playerIds: readonly string[]; // references into PLAYER_POOL
  league: 'mls' | 'international';
  badgeFile: string;
}

export interface ColorScheme {
  id: ColorSchemeId;
  name: string;
  palette: TeamPalette;
  badgeFile: string;
}
```

### Pattern 2: PLAYER_POOL as Flat Array

**What:** A single `readonly PoolPlayer[]` replaces the `TEAM_SQUADS` record and `FREE_AGENTS` array. Players are keyed by sequential IDs (`p001`, `p002`, ...) and carry `sourceTeamId: ColorSchemeId` indicating which CSV squad they originated from.

**Why flat array over keyed record:** The pool is looked up by individual player ID strings (already stored in `TeamConfig.playerIds`), so a flat array with a linear scan at startup is fine. No runtime performance concern — the lookup happens once per game in `buildInitialGameState`.

```typescript
// Source: CONTEXT.md D-01, D-07 [ASSUMED: exact shape]
export interface PoolPlayer {
  id: string; // 'p001', 'p002', ...
  sourceTeamId: ColorSchemeId; // 'cosmos' | 'xolos' | 'city' | 'crew' | '<mls-slug>' | '<intl-slug>'
  firstName: string;
  lastName: string;
  number: number; // jersey number (1–11 within source squad)
  nationality: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
  position: HexCoord; // placeholder — D-02
  pace: number;
  shooting: number;
  tackling: number;
  dribbling: number;
  saving: number;
  handling: number;
  resilience: number;
  aerialAbility: number;
  highPass: number;
}

export const PLAYER_POOL: readonly PoolPlayer[] = [
  /* generated */
];
```

### Pattern 3: Squad Resolution Helper

**What:** A pure helper function replaces the direct `TEAM_SQUADS[teamId]` array access. Lives in `packages/shared` so both server and any future client usage can import it without cross-package duplication.

```typescript
// Source: CONTEXT.md code_context [ASSUMED: exact signature]
// Likely location: packages/shared/src/teamConfig.ts or teams.ts
export function getSquadPlayers(teamId: TeamId): PoolPlayer[] {
  const ids = TEAM_CONFIGS[teamId].playerIds;
  return ids.map((id) => {
    const player = PLAYER_POOL.find((p) => p.id === id);
    if (!player) throw new Error(`Player ${id} not found in PLAYER_POOL`);
    return player;
  });
}
```

**Note:** The server's `buildSquadPieces` function also needs to reconstruct `PlayerPiece` from `PoolPlayer` — it will still assign `teamId: 'home' | 'away'` and mirror positions at runtime. The `PoolPlayer` is source data; `PlayerPiece` is the runtime game object.

### Pattern 4: Sequential ID Assignment in Seed Script

**What:** Seed script assigns IDs globally across all CSV sources in a deterministic order. The order must be documented and never change after initial assignment.

**Recommended order** (preserves all existing squad members):

1. Cosmos squad players → `p001`–`p011`
2. Xolos squad players → `p012`–`p022`
3. City squad players → `p023`–`p033`
4. Crew squad players → `p034`–`p044`
5. Free agents → `p045`–`p068`
6. MLS CSV players → `p069`–`p112` (44 players: 4 squads × 11)
7. National CSV players → `p113`–`p178` (66 players: 6 squads × 11)

**Exact numbering depends on the seed script's iteration order** — the plan must run the seed script and commit the output, not hand-author IDs.

### Pattern 5: ColorScheme Registry and TeamConfig.colorSchemeId

**What:** `COLOR_SCHEME_REGISTRY` holds all historical team appearances. `TeamConfig.colorSchemeId` cross-references into it. This allows the registry to grow (Phase 21 adds new teams) without modifying `TeamConfig`'s type.

```typescript
// Source: CONTEXT.md D-05, D-06 [ASSUMED: exact shape]
export const COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme> = {
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos',
    palette: {
      primary: '#3b82f6', // existing primaryColor
      primaryLight: '#93c5fd', // blue-300 — lightened 3 shades [Claude's Discretion]
      secondary1: '#c8a84b', // existing secondaryColor
      secondary2: '#1e3a5f', // navy accent [Claude's Discretion]
    },
    badgeFile: 'cosmos.png',
  },
  xolos: {
    /* ... */
  },
  city: {
    /* ... */
  },
  crew: {
    /* ... */
  },
};
```

### Anti-Patterns to Avoid

- **Leaving `TEAM_SQUADS` in barrel export:** After Phase 19, `packages/shared/src/index.ts` must NOT export `TEAM_SQUADS`. Any file still importing it will fail TypeScript compilation — use this as the build gate.
- **Keeping `FREE_AGENTS` as a separate export:** The decision is to consolidate into `PLAYER_POOL`. `FREE_AGENTS` disappears entirely; FA players appear in `PLAYER_POOL` with `sourceTeamId: 'free-agent'` or similar slug.
- **Adding cosmos/xolos to `TEAM_CONFIGS`:** Retired teams live only in `COLOR_SCHEME_REGISTRY`. The TypeScript type `Record<TeamId, TeamConfig>` will prevent accidentally adding them.
- **Resolving `primaryLight` at render time:** D-09 is explicit — no computed lightening at render. Author the hex values in the data file.
- **Forgetting `VALID_TEAM_IDS` in `roomHandlers.ts`:** The server's allow-list currently includes `['cosmos', 'xolos', 'city', 'crew']`. After Phase 19 it must be `['city', 'crew']` or team:pick for a retired team will succeed server-side validation.
- **Leaving mock state on `TEAM_SQUADS.cosmos` / `TEAM_SQUADS.xolos`:** `mockMovementState.ts` uses both retired team squads. After Phase 19 it must pull from `PLAYER_POOL` filtered by `sourceTeamId`.

---

## Don't Hand-Roll

| Problem                    | Don't Build                   | Use Instead                                                  | Why                                                                                            |
| -------------------------- | ----------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Color lightening           | Dynamic `lighten()` at render | Authored hex values in data                                  | D-09 explicitly forbids computed-at-render; authored values are stable and reviewable          |
| CSV parsing                | A new parser                  | Extend existing `parseCSV` + `parseRow` in `seed-rosters.ts` | Existing parser already handles edge cases (blanks → 0, GK attribute floors, STR → ST mapping) |
| Player ID sequencing       | UUID or hash-based IDs        | Sequential `p001..pNNN`                                      | D-01 is explicit; sequential IDs are human-readable and debuggable in game state               |
| Cross-package type sharing | Duplicate type definitions    | Import from `@counter-attack/shared` barrel                  | Already established pattern — no cross-package type duplication                                |

**Key insight:** This phase is 100% in-project. The only "library" decision is the authoring of hex color values, and those are simply strings.

---

## Common Pitfalls

### Pitfall 1: buildSquadPieces Breaks Silently on TypeScript 5 Strict Mode

**What goes wrong:** After `TEAM_SQUADS` is removed from the shared barrel export, `gameEngine.ts` imports it — the import fails at compile time. However, if `pnpm -w tsc --noEmit` is not run before executing the next test, the dev server may start with the old compiled output and tests may pass until the server restarts.

**Why it happens:** The test suite imports from the compiled output, not source, when using Vitest with `resolve.alias` pointing at source. Whether the failure surfaces immediately depends on build configuration.

**How to avoid:** After removing `TEAM_SQUADS` from the barrel export, run `pnpm -w tsc --noEmit` before running any tests. Treat a clean TypeScript build as the entry condition for each subsequent task.

**Warning signs:** `TS2305: Module '@counter-attack/shared' has no exported member 'TEAM_SQUADS'` — confirms the gate is working correctly.

### Pitfall 2: mockMovementState.ts Uses Two Retired Team Squads

**What goes wrong:** `packages/client/src/mock/mockMovementState.ts` currently imports `TEAM_SQUADS.cosmos` (home) and `TEAM_SQUADS.xolos` (away) to build the test game state. After Phase 19, `TEAM_SQUADS` is gone.

**Why it happens:** The mock was written when cosmos and xolos were the two example teams. The refactor must update the mock to use `PLAYER_POOL` filtered by `sourceTeamId`.

**How to avoid:** Update `mockMovementState.ts` in the same wave as the `teams.ts` replacement. Use `PLAYER_POOL.filter(p => p.sourceTeamId === 'cosmos')` for home and `PLAYER_POOL.filter(p => p.sourceTeamId === 'xolos')` for away. The `selectedTeams` field in the mock can remain `{ home: 'cosmos', away: 'xolos' }` — but `'cosmos'` is no longer a valid `TeamId`. This means `selectedTeams` needs to change to use valid team IDs (`city`/`crew`), OR the mock must be restructured so the test does not rely on `TEAM_CONFIGS[selectedTeams.home]` being valid. See Pitfall 3.

### Pitfall 3: ActionLog Tests Use cosmos/xolos as selectedTeams

**What goes wrong:** `ActionLog.test.tsx` (and possibly `GameBoard.test.tsx`) seeds `selectedTeams: { home: 'cosmos', away: 'xolos' }` via `mockMovementState`. After Phase 19, `TEAM_CONFIGS['cosmos']` does not exist (cosmos is not in `TEAM_CONFIGS`). Any code path that does `TEAM_CONFIGS[selectedTeams[positional]]` will throw at runtime in tests.

**Why it happens:** `pieceColorOf()` in `ActionLog.tsx` dereferences `TEAM_CONFIGS[selectedTeams[positional]]` — if `selectedTeams.home === 'cosmos'` and `TEAM_CONFIGS['cosmos']` is undefined, this crashes.

**How to avoid:** Update `mockMovementState.ts` to use `{ home: 'city', away: 'crew' }` for `selectedTeams`. Filter `PLAYER_POOL` for the corresponding source team to populate pieces. This is a one-file change but affects every test that uses `mockMovementState` directly.

**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'primaryColor')` (or `palette`) in test output.

### Pitfall 4: VALID_TEAM_IDS in roomHandlers.ts Not Updated

**What goes wrong:** The server's `team:pick` handler validates the incoming `teamId` against `VALID_TEAM_IDS: readonly TeamId[] = ['cosmos', 'xolos', 'city', 'crew']`. If a player sends `team:pick` with `'cosmos'`, the server accepts it, tries to look up `TEAM_CONFIGS['cosmos']`, and crashes or builds corrupted game state.

**Why it happens:** The validation allow-list is maintained separately from the `TeamId` type. TypeScript would catch `'cosmos' satisfies TeamId` failing, but the array literal was typed as `readonly TeamId[]` against the OLD `TeamId` union. After the type shrinks, TypeScript WILL catch this at compile time — but only if you run `tsc`.

**How to avoid:** Update `VALID_TEAM_IDS` in `roomHandlers.ts` to `['city', 'crew']` in the same task that shrinks the `TeamId` type. TypeScript's type checker will confirm this is correct.

### Pitfall 5: seed-rosters.ts Uses 'Arial Ability' as Hardcoded Header Key

**What goes wrong:** The current seed script accesses `row[idx['Arial Ability']]` (line 130 of seed-rosters.ts). After the CSV typo is fixed to "Aerial Ability", the header key changes and the lookup returns `undefined`, silently producing `aerialAbility: 0` for all players.

**Why it happens:** The seed script comment on line 129 explicitly acknowledges the typo: `// D-05: 'Arial Ability' typo is preserved from the CSV — access by exact header string`. When the CSV is fixed, the script key must be updated simultaneously.

**How to avoid:** Fix the CSV headers and the seed script key (`'Arial Ability'` → `'Aerial Ability'`) in the same atomic commit. Verify by running `pnpm run seed:rosters` and checking that `aerialAbility` values are non-zero for outfield players.

### Pitfall 6: mls.csv Has 'STR' Position — Must Be in ROLE_MAP

**What goes wrong:** `national.csv` contains `STR` as a Position value (e.g., `Folarin Balogun,USMNT,...,STR,...`). The existing `ROLE_MAP` already contains `STR: 'ST'` — this is already handled. But `mls.csv` must be verified — if any player uses an unmapped Position string, the seed script will `throw new Error('Unknown position...')`.

**Why it happens:** The CSV files were authored by different people; position strings may not be fully normalized.

**How to avoid:** Scan both CSVs for unique Position values before finalizing the seed script extension. The existing `ROLE_MAP` (`GK`, `DEF`, `MID`, `FWD`, `ST`, `STR`) already covers all observed values, but verify.

**Observed Position values in mls.csv:** GK, DEF, MID, FWD (no STR observed in the 44-player set).
**Observed Position values in national.csv:** GK, DEF, MID, FWD, STR (Balogun for USMNT; Kane for England; Mbappe for France; Buchanan for Canada).

### Pitfall 7: PoolPlayer vs PlayerPiece Shape Mismatch

**What goes wrong:** `buildSquadPieces` in `gameEngine.ts` currently reads `TEAM_SQUADS[selectedTeams.home]` which returns `readonly PlayerPiece[]`. The new `getSquadPlayers()` helper will return `PoolPlayer[]`. If `PoolPlayer` is missing any field that `PlayerPiece` has, the spread `{ ...poolPlayer, teamId: 'home' }` will produce an object that fails the `PlayerPiece` type check.

**Why it happens:** `PlayerPiece` has a `teamId: 'home' | 'away'` field (set at runtime). `PoolPlayer` intentionally omits `teamId` (it's not meaningful in the pool). But both must share all stat fields (`pace`, `shooting`, etc.).

**How to avoid:** Define `PoolPlayer` as the pool shape explicitly. In `buildSquadPieces`, the spread `{ ...poolPlayer, teamId: 'home' as const, id: `home-${idx}` }` produces a valid `PlayerPiece`. Verify TypeScript accepts this without a cast.

---

## Code Examples

### Example 1: Updated teamConfig.ts — Core Types

```typescript
// Source: CONTEXT.md decisions D-04, D-06, D-08, D-14 [ASSUMED: exact syntax]
// packages/shared/src/teamConfig.ts

export type TeamId = 'city' | 'crew';

export type ColorSchemeId = 'cosmos' | 'xolos' | 'city' | 'crew';

export interface TeamPalette {
  primary: string;
  primaryLight: string;
  secondary1: string;
  secondary2: string;
}

export interface ColorScheme {
  id: ColorSchemeId;
  name: string;
  palette: TeamPalette;
  badgeFile: string;
}

export interface TeamConfig {
  id: TeamId;
  name: string;
  colorSchemeId: ColorSchemeId;
  palette: TeamPalette;
  playerIds: readonly string[];
  league: 'mls' | 'international';
  badgeFile: string;
}

export const COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme> = {
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos',
    palette: {
      primary: '#3b82f6',
      primaryLight: '#93c5fd', // blue-300
      secondary1: '#c8a84b',
      secondary2: '#1e3a5f', // deep navy
    },
    badgeFile: 'cosmos.png',
  },
  xolos: {
    id: 'xolos',
    name: 'Xolos',
    palette: {
      primary: '#f59e0b',
      primaryLight: '#fcd34d', // amber-300
      secondary1: '#6b7280',
      secondary2: '#1f2937', // dark charcoal
    },
    badgeFile: 'xolos.png',
  },
  city: {
    id: 'city',
    name: 'City',
    palette: {
      primary: '#dc143c',
      primaryLight: '#f87171', // red-400
      secondary1: '#f5c518',
      secondary2: '#1e1e2e', // near-black
    },
    badgeFile: 'city.png',
  },
  crew: {
    id: 'crew',
    name: 'Crew',
    palette: {
      primary: '#f5c518',
      primaryLight: '#fde68a', // yellow-200
      secondary1: '#111111',
      secondary2: '#14532d', // forest green accent
    },
    badgeFile: 'crew.png',
  },
};

export const TEAM_CONFIGS: Record<TeamId, TeamConfig> = {
  city: {
    id: 'city',
    name: 'City',
    colorSchemeId: 'city',
    palette: COLOR_SCHEME_REGISTRY.city.palette,
    playerIds: [
      /* populated after seed script runs */
    ],
    league: 'mls',
    badgeFile: 'city.png',
  },
  crew: {
    id: 'crew',
    name: 'Crew',
    colorSchemeId: 'crew',
    palette: COLOR_SCHEME_REGISTRY.crew.palette,
    playerIds: [
      /* populated after seed script runs */
    ],
    league: 'mls',
    badgeFile: 'crew.png',
  },
};
```

### Example 2: Updated seed-rosters.ts — Multi-Team CSV Support

```typescript
// Source: existing seed-rosters.ts extended per CONTEXT.md D-11, D-12, D-13 [ASSUMED]

// New: map CSV team names → ColorSchemeId slugs for sourceTeamId field
const MULTI_CSV_FILES = ['mls.csv', 'national.csv'];

// Team slug normalizer: "Inter Miami" → "inter-miami", "USMNT" → "usmnt"
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// Updated parseRow: reads 'Aerial Ability' (fixed) instead of 'Arial Ability'
const aerialAbility = toInt(row[idx['Aerial Ability']] ?? '');
```

### Example 3: Updated buildSquadPieces in gameEngine.ts

```typescript
// Source: CONTEXT.md code_context [ASSUMED: exact signature]
// In packages/server/src/gameEngine.ts

import { PLAYER_POOL, TEAM_CONFIGS, getSquadPlayers } from '@counter-attack/shared';

function buildSquadPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
): PlayerPiece[] {
  const homeSquad = getSquadPlayers(selectedTeams.home).map((p, i) => ({
    ...p,
    teamId: 'home' as const,
    id: `home-${i}`,
  }));
  const awaySquad = getSquadPlayers(selectedTeams.away).map((p, i) => ({
    ...p,
    teamId: 'away' as const,
    id: `away-${i}`,
    position: { q: 36 - p.position.q, r: p.position.r },
  }));
  // ... existing attack/defense ordering logic unchanged
}
```

### Example 4: Client Consumer Swap Pattern (identical across all 5 files)

```typescript
// Before (all 5 consumers):
const color = TEAM_CONFIGS[teamId].primaryColor;

// After (all 5 consumers):
const color = TEAM_CONFIGS[teamId].palette.primary;

// TeamSelectionScreen.tsx also has secondaryColor (via CSS background):
// Before:
style={{ borderColor: TEAM_CONFIGS[teamId].primaryColor, background: TEAM_CONFIGS[teamId].primaryColor }}
// After:
style={{ borderColor: TEAM_CONFIGS[teamId].palette.primary, background: TEAM_CONFIGS[teamId].palette.primary }}
```

---

## Runtime State Inventory

> This phase is not a rename/refactor/migration of runtime-stored state — it is a data-model change to static in-memory constants. No persistent state (database, OS registrations, secrets) is affected.

| Category            | Items Found                                                                                         | Action Required                |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------ |
| Stored data         | None — game state is in-memory only; no database                                                    | None                           |
| Live service config | None — no external services reference TeamId or player IDs                                          | None                           |
| OS-registered state | None                                                                                                | None                           |
| Secrets/env vars    | None — no env vars reference team names or player IDs                                               | None                           |
| Build artifacts     | `packages/shared/src/teams.ts` (auto-generated) — will be fully replaced by `pnpm run seed:rosters` | Run seed script; commit output |

---

## Environment Availability

| Dependency     | Required By                       | Available                              | Version | Fallback |
| -------------- | --------------------------------- | -------------------------------------- | ------- | -------- |
| Node.js 22 LTS | seed-rosters.ts execution         | Assumed available (project constraint) | 22.x    | —        |
| pnpm           | `pnpm run seed:rosters`           | Assumed available                      | 9.x     | —        |
| TypeScript     | `pnpm -w tsc --noEmit` validation | Available (project dependency)         | 5.x     | —        |

**No missing dependencies.** This phase has no new external dependencies.

---

## State of the Art

| Old Approach                                                      | Current Approach                                                           | Impact                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `TEAM_SQUADS: Record<TeamId, readonly PlayerPiece[]>`             | `PLAYER_POOL: readonly PoolPlayer[]` with `TEAM_CONFIGS[teamId].playerIds` | Separates identity from assignment; enables pool-based draft in v1.4 |
| `primaryColor: string` + `secondaryColor: string` on `TeamConfig` | `palette: TeamPalette` with 4 named slots                                  | Enables Phase 20 uniform pattern parameterization                    |
| All 4 teams in `TeamId`                                           | `TeamId = 'city'                                                           | 'crew'`; retired teams in `ColorSchemeId`                            | Clean separation of active vs historical; allows retiring teams without breaking color registry |

**Deprecated/outdated after this phase:**

- `TEAM_SQUADS`: deleted from `teams.ts` and barrel export
- `FREE_AGENTS`: deleted; these players become entries in `PLAYER_POOL` with `sourceTeamId: 'free-agent'` (or a similar constant)
- `primaryColor` / `secondaryColor` on `TeamConfig`: removed from type definition
- `TeamId = 'cosmos' | 'xolos' | 'city' | 'crew'`: shrinks to `'city' | 'crew'`

---

## Assumptions Log

| #   | Claim                                                                                                                        | Section               | Risk if Wrong                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `PoolPlayer` should include `teamId: 'home' \| 'away'` is intentionally omitted — it is set at runtime by `buildSquadPieces` | Pattern 2, Example 3  | If the existing `PlayerPiece` type requires `teamId` and `PoolPlayer` omits it, the spread must explicitly set it — which the example already shows. Low risk.                                                                                                                                          |
| A2  | `COLOR_SCHEME_REGISTRY` stays co-located in `teamConfig.ts`                                                                  | Architecture Patterns | User's discretion allows alternative location. Any location in `packages/shared/src/` is fine.                                                                                                                                                                                                          |
| A3  | `getSquadPlayers()` is a named export from `packages/shared`                                                                 | Example 3             | Could alternatively be a method/helper only in `gameEngine.ts`. But shared placement is cleaner for Phase 21 reuse.                                                                                                                                                                                     |
| A4  | Free agent players use `sourceTeamId: 'free-agent'` slug                                                                     | Pattern 2             | Could use a different string. The important thing is that it is NOT a `ColorSchemeId` value — or alternatively `ColorSchemeId` could be extended with `'free-agent'`. The planner must decide.                                                                                                          |
| A5  | `TeamConfig.playerIds` is populated with actual IDs only after the seed script runs                                          | Example 1             | This is inherent to the workflow: type definition first, seed script second, then hand-populate (or auto-populate) `playerIds` in `teamConfig.ts`                                                                                                                                                       |
| A6  | `mockMovementState.ts` must switch `selectedTeams` to `{ home: 'city', away: 'crew' }`                                       | Pitfall 3             | Risk: all tests using `mockMovementState` assume cosmos (home) and xolos (away) pieces. Piece IDs (`home-0..home-10`, `away-0..away-10`) and player names will change. Test assertions that reference specific player names (e.g., `Nicolae Rusu` in `ActionLog.test.tsx` line 189) will need updating. |
| A7  | `PlayerStatsPanel.tsx` uses only `primaryColor` (not `secondaryColor`)                                                       | Code Examples section | Verified from reading the file: only `primaryColor` is used at line 61. `secondaryColor` not referenced. Low risk.                                                                                                                                                                                      |

---

## Open Questions (RESOLVED)

1. **What happens to `FREE_AGENTS` / `sourceTeamId` for free agents?**
   - What we know: CONTEXT.md says all players land in `PLAYER_POOL` with `sourceTeamId` set to their team slug. Free agents have no team.
   - What's unclear: Should `sourceTeamId` be typed as `ColorSchemeId | 'free-agent'`, or should `free-agent` be added to `ColorSchemeId`?
   - Recommendation: Type `PoolPlayer.sourceTeamId` as `ColorSchemeId | string` (wide) in Phase 19, then tighten in Phase 21 once all team slugs are known. Alternatively, add a `PoolTeamId = ColorSchemeId | 'free-agent'` type alias.
   - **RESOLVED (19-01 Task 3):** `PoolPlayer.sourceTeamId` typed as `ColorSchemeId | string`; free agents use `sourceTeamId: 'free-agent'` string literal.

2. **Should `TeamConfig.playerIds` be populated manually or by the seed script?**
   - What we know: CONTEXT.md D-03 says team configs reference player IDs. D-12 says the seed script assigns IDs.
   - What's unclear: Does the seed script write `TEAM_CONFIGS.city.playerIds = [...]` into `teams.ts`, or does it write `PLAYER_POOL` and the planner manually enters the IDs into `teamConfig.ts`?
   - Recommendation: The seed script should output both `PLAYER_POOL` and a `CITY_PLAYER_IDS` / `CREW_PLAYER_IDS` const block so the planner can copy the IDs into `teamConfig.ts` without guessing. Alternatively the seed script could write `teamConfig.ts` too — but that is a bigger change than needed.
   - **RESOLVED (19-01 Task 3):** Seed script outputs `PLAYER_POOL` array with all players; executor runs seed script, reads the console output, and manually pastes the City/Crew player ID arrays into `TEAM_CONFIGS.city.playerIds` and `TEAM_CONFIGS.crew.playerIds` in `teamConfig.ts`.

3. **Do `ActionLog.test.tsx` player name assertions need updating?**
   - What we know: `ActionLog.test.tsx` line 189 asserts `expect(screen.getByText(/Nicolae Rusu/))` which relies on the cosmos squad being the home team in `mockMovementState`. After the mock switches to `city`, a different player is at `home-9`.
   - What's unclear: How many test assertions reference specific player names?
   - Recommendation: The planner must audit `ActionLog.test.tsx` and `HexGrid.test.tsx` for player-name or player-ID assertions that depend on cosmos/xolos squad membership, and update them as part of the mock update task.
   - **RESOLVED (19-03 Task 3):** Player name assertions in `ActionLog.test.tsx` and `GameBoard.test.tsx` are updated to use City/Crew player names read from `19-01-SUMMARY.md` (which records the actual player IDs/names assigned during 19-01 execution).

---

## Validation Architecture

### Test Framework

| Property           | Value                                             |
| ------------------ | ------------------------------------------------- |
| Framework          | Vitest                                            |
| Config file        | `packages/client/vite.config.ts` (test section)   |
| Quick run command  | `pnpm --filter @counter-attack/client test --run` |
| Full suite command | `pnpm -r test --run`                              |

### Phase Requirements → Test Map

| Req ID     | Behavior                                                          | Test Type                 | Automated Command                                 | File Exists?                               |
| ---------- | ----------------------------------------------------------------- | ------------------------- | ------------------------------------------------- | ------------------------------------------ |
| PALETTE-01 | `TeamConfig.palette` has exactly 4 fields                         | unit (type-level)         | `pnpm -w tsc --noEmit`                            | ✅ (TypeScript enforces structurally)      |
| PALETTE-02 | `primaryColor` / `secondaryColor` absent from all consumers       | unit (type-level)         | `pnpm -w tsc --noEmit`                            | ✅ (TS compile fails if field is accessed) |
| PALETTE-03 | `primaryLight` is a literal string, not computed                  | unit (type-level)         | `pnpm -w tsc --noEmit`                            | ✅ (authored value in constant)            |
| TEAM-07    | `cosmos`/`xolos` not in `TEAM_CONFIGS`                            | unit (type-level)         | `pnpm -w tsc --noEmit`                            | ✅ (`Record<TeamId, ...>` excludes them)   |
| DATA-01    | `PLAYER_POOL` exists and contains all expected players            | unit                      | `pnpm --filter @counter-attack/shared test --run` | ❌ Wave 0 — new test needed                |
| DATA-02    | `TEAM_CONFIGS.city.playerIds` references valid pool IDs           | unit                      | `pnpm --filter @counter-attack/shared test --run` | ❌ Wave 0 — new test needed                |
| DATA-03    | `COLOR_SCHEME_REGISTRY` has entries for cosmos, xolos, city, crew | unit                      | `pnpm --filter @counter-attack/shared test --run` | ❌ Wave 0 — new test needed                |
| LEAGUE-03  | `TeamConfig.league` field exists and is `'mls'` for city/crew     | unit (type-level + value) | `pnpm -w tsc --noEmit` + data test                | ✅ type / ❌ value test                    |

### Sampling Rate

- **Per task commit:** `pnpm -w tsc --noEmit` (type gate) + `pnpm --filter @counter-attack/client test --run`
- **Per wave merge:** `pnpm -r test --run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/shared/src/__tests__/playerPool.test.ts` — verifies `PLAYER_POOL` length, unique IDs, all `sourceTeamId` values valid, `getSquadPlayers('city')` returns 11 players
- [ ] `packages/shared/src/__tests__/teamConfig.test.ts` — verifies `COLOR_SCHEME_REGISTRY` has 4 entries, `TEAM_CONFIGS` has 2 entries, `palette` has all 4 fields on each entry

---

## Security Domain

> ASVS V5 (Input Validation) applies: the server validates incoming `teamId` values against an allow-list.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                 |
| --------------------- | ------- | ------------------------------------------------ |
| V2 Authentication     | No      | —                                                |
| V3 Session Management | No      | —                                                |
| V4 Access Control     | No      | —                                                |
| V5 Input Validation   | Yes     | `VALID_TEAM_IDS` allow-list in `roomHandlers.ts` |
| V6 Cryptography       | No      | —                                                |

### Known Threat Patterns

| Pattern                                          | STRIDE    | Standard Mitigation                                                                              |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------ |
| Client sends `teamId: 'cosmos'` after retirement | Tampering | `VALID_TEAM_IDS` allow-list rejects non-`TeamId` values; TypeScript type narrows at compile time |
| Client sends arbitrary `teamId` string           | Tampering | Existing `VALID_TEAM_IDS` guard in `roomHandlers.ts:40`; must be updated to `['city', 'crew']`   |

**Security note:** The allow-list `VALID_TEAM_IDS` in `roomHandlers.ts` MUST be updated in the same task that shrinks `TeamId`. If it is not, a client could send `teamId: 'cosmos'` and the server would accept it, then crash when looking up `TEAM_CONFIGS['cosmos']`.

---

## Project Constraints (from CLAUDE.md)

- Backend: Node.js + Socket.io — no change required for this phase
- Frontend: React + Vite — client consumer updates are field-access-only, no component structure change
- TypeScript everywhere — all changes are fully typed; `pnpm -w tsc --noEmit` is the primary quality gate
- pnpm monorepo — use `pnpm -r` / `pnpm --filter` for cross-package commands
- No new external packages — confirmed; this phase is pure refactoring

---

## Sources

### Primary (HIGH confidence)

- `packages/shared/src/teamConfig.ts` — current `TeamConfig` type; 4 teams with `primaryColor` / `secondaryColor`; exact field names confirmed by reading the file
- `packages/shared/src/teams.ts` — current `TEAM_SQUADS` + `FREE_AGENTS` structure; player counts per squad confirmed (11 × 4 squads + 24 free agents)
- `packages/shared/scripts/seed-rosters.ts` — current CSV parsing pipeline; `'Arial Ability'` key on line 130 confirmed; `ROLE_MAP` confirmed to include `STR: 'ST'`
- `packages/client/src/components/ActionLog.tsx` — `.primaryColor` access confirmed at lines 12 and 37
- `packages/client/src/components/GameBoard.tsx` — `.primaryColor` access confirmed at 8 locations
- `packages/client/src/components/PlayerStatsPanel.tsx` — `.primaryColor` access confirmed at line 61
- `packages/client/src/components/TeamSelectionScreen.tsx` — `.primaryColor` access confirmed at lines 119 and 120
- `packages/client/src/components/PieceOverlay.tsx` — `.primaryColor` access confirmed at lines 97 and 98
- `packages/client/src/mock/mockMovementState.ts` — `TEAM_SQUADS.cosmos` + `TEAM_SQUADS.xolos` imports confirmed
- `packages/shared/src/data/mls.csv` — 44 players, 4 MLS teams (Inter Miami, LAFC, Seattle, Nashville), "Arial Ability" typo confirmed
- `packages/shared/src/data/national.csv` — 66 players, 6 national teams (USMNT, England, Mexico, Canada, Spain, France), STR position confirmed
- `packages/server/src/gameEngine.ts` — `buildSquadPieces` confirmed to use `TEAM_SQUADS[selectedTeams.home]`; `VALID_TEAM_IDS` confirmed in `roomHandlers.ts`
- `.planning/phases/19-data-model-team-palette/19-CONTEXT.md` — all 14 locked decisions and Claude's discretion items

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — requirements PALETTE-01..03, TEAM-07, DATA-01..03, LEAGUE-03 verified as Phase 19 scope
- `.planning/STATE.md` — confirmed Phase 19 is the active phase, v1.3 milestone

---

## Metadata

**Confidence breakdown:**

- Data model types: HIGH — read the exact current source; changes are mechanical
- Seed script extension: HIGH — existing script structure is fully understood; extension follows same patterns
- Client consumer swaps: HIGH — all 5 files read; all access sites located
- Color values authored for Claude's discretion: MEDIUM — reasonable lightened shades; user may adjust
- `getSquadPlayers` helper signature: MEDIUM — logical inference from CONTEXT.md; exact signature is Claude's discretion

**Research date:** 2026-07-03
**Valid until:** 2026-08-03 (stable in-project refactoring; no external dependencies)
