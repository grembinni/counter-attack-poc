# Stack Research — v1.3

**Project:** Counter Attack POC — Team Library, Formation System, Player Assignment
**Researched:** 2026-07-03
**Scope:** Incremental additions to existing pnpm monorepo with packages/shared, packages/server, packages/client

---

## New Dependencies

| Package       | Version | Purpose | Verdict                                        |
| ------------- | ------- | ------- | ---------------------------------------------- |
| None required | —       | —       | All features implementable with existing stack |

**Rationale for zero new npm dependencies:**

The three feature areas — team library, formation system, and player auto-assignment — are pure data-modeling and algorithmic problems that the existing TypeScript stack handles without additional libraries.

- **Sorting/matching for auto-assignment:** The stat-weight algorithm is a weighted sum (`tackling * w1 + pace * w2 + ...`) then sort. Native `Array.sort` + arithmetic suffices. No need for a Hungarian algorithm library — the problem is positional slot filling (11 slots, 11+ candidates), not an NP-hard assignment problem requiring munkres or similar. The greedy approach (score each player for each role, assign highest-scoring player to each anchor slot first, fill flex slots from remainder) is O(n²) worst case for 11 players, which is imperceptible.
- **Formation layout hex coordinates:** honeycomb-grid 4.x is already installed in packages/client. For server-side formation coordinate generation, honeycomb-grid is also already available since packages/shared imports it via packages/client's workspace. However, the current codebase does NOT use honeycomb-grid for formation positions — `FORMATION_POSITIONS` in `seed-rosters.ts` and `buildSquadPieces` in `gameEngine.ts` use hardcoded `{q, r}` literals. The four new formations are also fixed coordinate sets. There is no spatial computation needed at runtime; the hex positions for 4-4-2, 5-3-2, 4-3-3, and 3-4-3 are lookup tables, not derived geometry. Adding honeycomb-grid to packages/shared would be premature; keep formation coordinates as typed constant objects.
- **CSV parsing:** The existing seed script uses Node.js `readline` + `createReadStream` with manual comma-splitting. This works. For adding 8 new team CSV files (12 teams total: 4 existing + 8 new), the same parsing logic extends trivially. No csv-parse or papaparse needed.
- **International player data:** No third-party data-fetching library needed. The CSVs are hand-authored source data, not fetched from an API. International players already exist in the FA pool (Algeria, Brazil, Netherlands, etc.). New team CSV files follow the same schema.

---

## Existing Stack Changes

### 1. packages/shared/src/teamConfig.ts — Extend TeamId union and TEAM_CONFIGS

**Current state:** `TeamId = 'cosmos' | 'xolos' | 'city' | 'crew'` — 4 teams, colors embedded in `TeamConfig`.

**Required changes:**

- Expand `TeamId` to include 8 new teams across 2 leagues. Example: `'la-galaxy' | 'inter-miami' | ...` (exact ids TBD by product).
- Add a `LeagueId` type: `'mls' | 'international'`.
- Add `league: LeagueId` field to `TeamConfig` so the lobby UI can group teams by league.
- Extract color scheme into a `ColorScheme` type separate from `TeamConfig`, because the milestone context says "color scheme as a separate entity":

```typescript
export type ColorScheme = {
  primary: string;
  secondary: string;
  // optional: accent for jersey trim
};

export interface TeamConfig {
  id: TeamId;
  name: string;
  league: LeagueId;
  colorScheme: ColorScheme;
  badgeFile: string;
}
```

- `primaryColor`/`secondaryColor` flat fields on `TeamConfig` become `colorScheme.primary`/`colorScheme.secondary`. **This is a breaking rename** — every consumer of `TEAM_CONFIGS[id].primaryColor` must update to `TEAM_CONFIGS[id].colorScheme.primary`. Grep the client for `primaryColor` and `secondaryColor` before executing.

**Migration path:** Add both old and new fields during transition, then remove old fields once all consumers updated. Single-PR atomic rename is also fine given the small codebase.

### 2. packages/shared/src/teams.ts — Add 8 new team squads

**Current state:** `TEAM_SQUADS: Record<TeamId, readonly PlayerPiece[]>` with 4 entries; `FREE_AGENTS: readonly PlayerPiece[]` with 24 players.

**Required changes:**

- Add entries for 8 new teams. The `Record<TeamId, ...>` type will enforce compile-time completeness — TypeScript will error if any `TeamId` value lacks a squad entry.
- Player pool decoupling for v1.4 prep: the current design conflates "team squad" (a fixed 11) with "player pool" (a larger set from which a squad can be assembled). To support future random draft without a breaking rewrite:
  - Keep `TEAM_SQUADS` as the authoritative set of pre-built squads (used when a team is selected in the current flow).
  - Add a separate `PLAYER_POOL: readonly PlayerPiece[]` export that aggregates all players across all teams + free agents, each carrying a `teamId: TeamId | 'pool'` field or a separate `poolTeamId?: TeamId` annotation. This is additive — no breaking change to existing `TEAM_SQUADS` consumers.
  - A `PlayerPool` type can be `readonly PlayerPiece[]` with a `sourceTeamId?: TeamId` annotation field added to `PlayerPiece` (optional, so backward-compatible with existing pieces that don't set it).

### 3. packages/shared/src/types.ts — FormationId type and PlayerPiece annotation

**Required changes:**

- Add `FormationId`:

```typescript
export type FormationId = '4-4-2' | '5-3-2' | '4-3-3' | '3-4-3';
```

- Add `PositionalRole` for the auto-assignment system (anchor vs. flex):

```typescript
export type PositionalRole = 'GK' | 'CB' | 'FB' | 'CM' | 'DM' | 'AM' | 'W' | 'CF' | 'ST';
```

Note: the existing `role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST'` on `PlayerPiece` is the coarse game-mechanic role (governs formation slot assignment). `PositionalRole` is finer-grained and used only for auto-assignment scoring — it does NOT replace `role` on `PlayerPiece`. Keep them separate to avoid touching game-logic validators.

- `GameState.selectedFormation` — add as an optional field initially, required once formation selection is wired:

```typescript
selectedFormation?: { home: FormationId; away: FormationId };
```

This is **additive** on `GameState` (optional field) so existing `buildInitialGameState` callers don't break. The server sets it when both players confirm their formations.

### 4. packages/shared/scripts/seed-rosters.ts — Support 12 teams

**Required changes:**

- Add 8 new team CSV name → TeamId mappings in `TEAM_ID_MAP`.
- Add 8 new entries to `squadMap` initialization.
- Add corresponding `buildSquadEntries` calls and serialization in `main()`.
- The `FORMATION_POSITIONS` hardcoded in the seed script represents the default (4-5-2 equivalent) starting layout. For the new formation system, formation positions are NOT baked into `teams.ts` at seed time — they are resolved at runtime when the player selects a formation. The seed script only needs to store player stats; `position` in `teams.ts` becomes the default/fallback used before formation selection resolves. **No breaking change to the seed output shape** — `PlayerPiece.position` stays in `teams.ts` as the formation-default position.

### 5. packages/shared/src/ — New file: formations.ts

Add a new module (not a new npm package) to packages/shared:

```typescript
// packages/shared/src/formations.ts
export type FormationId = '4-4-2' | '5-3-2' | '4-3-3' | '3-4-3';

export type FormationSlot = {
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
  position: HexCoord; // home-side coordinates; away mirrors via q = 36 - q
  label: string;      // 'CB-L', 'CM', 'ST', etc. for assignment UI
};

export const FORMATIONS: Record<FormationId, readonly FormationSlot[]> = {
  '4-4-2': [...],
  '5-3-2': [...],
  '4-3-3': [...],
  '3-4-3': [...],
};
```

This replaces the hardcoded `FORMATION_POSITIONS` in `seed-rosters.ts` as the single source of truth for hex coordinates per formation. The seed script can import from `formations.ts` for the default positions it writes into `teams.ts`.

**Export from packages/shared/src/index.ts** — additive barrel export, no breaking change.

### 6. packages/shared/src/ — New file: playerAssignment.ts

Pure function, no new dependencies:

```typescript
// packages/shared/src/playerAssignment.ts
export function assignPlayersToFormation(
  players: readonly PlayerPiece[], // the pool to assign from (team squad or player pool)
  formation: FormationId,
): AssignmentResult;
```

Where `AssignmentResult` maps each `FormationSlot` to a `PlayerPiece`. The algorithm:

1. GK slot: pick the single GK (role === 'GK') — always unambiguous.
2. Anchor slots (CB, CM, CF — positional roles where stat fit is tightest): score each candidate by weighted stat sum for the role, assign highest scorer. No external library needed.
3. Flex slots (FB, winger, flex-mid): assign from remaining players by next-best fit.
4. Allow pre-swap: return `AssignmentResult` as a mutable record so the UI can override individual slot → player mappings before confirming.

This is entirely implementable with `Array.sort` and plain arithmetic in ~80 lines. The test suite (vitest) covers it with property-based checks (does every player appear exactly once? does GK always go to GK slot?).

### 7. packages/server/src/gameEngine.ts — Formation-aware buildInitialGameState

**Required changes:**

- `buildInitialGameState` signature gains optional `formations` parameter:

```typescript
export function buildInitialGameState(
  roomCode: string,
  selectedTeams: { home: TeamId; away: TeamId },
  gameSpeed: GameSpeed = 'standard',
  formations?: { home: FormationId; away: FormationId },
): GameState;
```

- `buildSquadPieces` reads hex positions from `FORMATIONS[formationId]` instead of relying on the positions baked into `TEAM_SQUADS[teamId]`. The baked positions in `teams.ts` remain as the default (used when `formations` is undefined), ensuring backward-compat with tests that call `buildInitialGameState` without the new param.

### 8. packages/server/src/events.ts (ClientToServerEvents) — Formation selection events

Add two new client events for the pre-match flow:

```typescript
FORMATION_PICK: 'formation:pick'; // player selects formation for their team
FORMATION_CONFIRM: 'formation:confirm'; // player locks in formation + player assignments
```

And corresponding server events:

```typescript
FORMATION_SELECTED: 'formation:selected'; // broadcast to both players
FORMATION_READY: 'formation:ready'; // both formations confirmed, match can start
```

**This extends the Socket.io event schema** — it adds new events but does not modify existing event signatures. Existing tests remain valid. The lobby FSM gains a `FORMATION_SELECTION` phase between team selection and `KICK_OFF_SETUP`.

**If formation selection is skipped (default formation):** The server can auto-assign 4-4-2 if a player doesn't pick, allowing the game to start without requiring this UI. This means the new events are truly optional at the protocol level, reducing risk.

### 9. packages/client — New React components (no new deps)

- `FormationPicker` — renders 4 formation cards with a pitch diagram; uses existing SVG approach, no new rendering library.
- `AssignmentBoard` — shows the 11 slots with drag-to-swap. For a 2-player POC, drag-and-drop via native HTML5 DnD or simple click-to-select-then-click-to-assign is sufficient. **Do not add react-dnd, @dnd-kit, or similar** — the interaction is too simple to justify a library.

---

## What NOT to Add

| Rejected Package                                 | Reason                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `munkres-js` or any Hungarian algorithm library  | Player assignment is a 11-slot fill problem, not a full assignment matrix. Greedy weighted-sort is O(n²) and produces good-enough results for a board game.                                                                                                 |
| `react-dnd` / `@dnd-kit/core`                    | Formation slot swapping is 11 elements max. Click-select-then-click-place is simpler, more accessible, and touch-friendly without a drag library.                                                                                                           |
| `csv-parse` / `papaparse`                        | The seed script is a dev-time tool run once. The existing readline + manual split handles the same flat CSV schema. Adding a parser library adds a dependency to packages/shared devDependencies for zero functional gain.                                  |
| `zod` for runtime validation                     | The existing pattern is TypeScript compile-time types + server-side if-guards in game handlers. Zod would require refactoring the entire validation surface. The new formation/assignment types are simpler than the existing game logic — stay consistent. |
| `immer`                                          | GameState is already handled as plain object spreads. The formation assignment result is a simple lookup record. Immer adds no value here.                                                                                                                  |
| `honeycomb-grid` in packages/shared              | Formation coordinates are static lookup tables, not computed geometry. honeycomb-grid is appropriate for gameplay math (move validation, ZoI, distance) — already used in packages/client. Formation slot positions are authored constants.                 |
| Any UI component library (MUI, Radix, shadcn)    | The existing client uses custom SVG + CSS. Adding a component library mid-project would require either a full UI audit or two inconsistent visual systems.                                                                                                  |
| A separate `packages/formation-engine` workspace | The formation and assignment logic is ~200 lines. A new workspace package adds build configuration overhead with no benefit at this scale. Put it in packages/shared/src alongside other pure logic modules.                                                |

---

## Breaking Change Risks

### Risk 1: TeamId union expansion — MEDIUM risk, contained blast radius

**What changes:** Adding 8 new values to `TeamId` union in `teamConfig.ts`.

**What breaks:** `Record<TeamId, ...>` types — specifically `TEAM_SQUADS` in `teams.ts` and `TEAM_CONFIGS` in `teamConfig.ts`. TypeScript will error at compile time if any new `TeamId` value lacks an entry in these records. This is a **good** breaking change — the compiler catches omissions.

**What does NOT break:** `GameState.selectedTeams: { home: TeamId; away: TeamId }` is already a union — adding values is additive. Existing `switch`/`if` statements on `TeamId` that have a `default` case continue to work. Statements without `default` will cause TS exhaustiveness errors, which are the correct signal to update.

**Mitigation:** Expand `teams.ts` and `TEAM_CONFIGS` atomically with the `TeamId` expansion. Never commit `TeamId` expansion without the corresponding record entries.

### Risk 2: TeamConfig shape change (ColorScheme extraction) — LOW-MEDIUM risk

**What changes:** `primaryColor: string` and `secondaryColor: string` become `colorScheme: ColorScheme`.

**What breaks:** Client components that read `TEAM_CONFIGS[id].primaryColor` directly. Grep shows these are in jersey SVG pattern components and team badge color logic — roughly 3–6 call sites.

**What does NOT break:** `GameState`, Socket.io events, server-side game logic (the server never reads `primaryColor`). Zero test coverage of TeamConfig color fields, so no test breakage.

**Mitigation:** A single rename pass across the client. Low risk, but should be done in a dedicated commit separate from team data additions.

### Risk 3: GameState.selectedFormation addition — NEGLIGIBLE risk

**What changes:** Optional field added to `GameState`.

**What breaks:** Nothing. TypeScript optional fields are backward-compatible. `buildInitialGameState` tests that snapshot the full state object will see `selectedFormation: undefined` (or the field absent) — existing tests continue to pass. New tests assert the field when formations are chosen.

**Mitigation:** None needed. Additive optional field is the safest possible `GameState` change.

### Risk 4: New Socket.io events for formation selection — NEGLIGIBLE risk

**What changes:** New entries added to `ClientEvents` / `ServerEvents` const objects and corresponding interfaces.

**What breaks:** Nothing. Socket.io typed event maps are extended with new keys; existing keys are untouched. The server and client both ignore events they don't handle. Existing integration tests that don't exercise formation events continue to pass.

**Watch for:** If a test file asserts the exact set of keys on `ClientEvents`, it will fail. Grep for `Object.keys(ClientEvents)` before adding new events.

### Risk 5: seed-rosters.ts output format — LOW risk

**What changes:** The generated `teams.ts` gains 8 new entries in `TEAM_SQUADS`.

**What breaks:** `Record<TeamId, readonly PlayerPiece[]>` will TypeScript-error if the new `TeamId` values exist but `TEAM_SQUADS` is not regenerated. Since `teams.ts` is committed (not generated at build time), the developer must run `pnpm run seed:rosters` after adding new CSV files and expanding `TeamId`.

**Mitigation:** Document in the phase execution plan: expand `TeamId` → add CSV files → run `seed:rosters` → commit `teams.ts`. This is the same flow that produced the existing 4-team file.

---

## Confidence Assessment

| Area                              | Confidence | Notes                                                                               |
| --------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| No new npm packages needed        | HIGH       | All capabilities present in existing stack; verified against codebase               |
| TeamId/TeamConfig changes         | HIGH       | TypeScript record exhaustiveness ensures correctness; client call sites are few     |
| formations.ts as shared module    | HIGH       | Matches existing pattern (pitch.ts, offside.ts as pure shared modules)              |
| playerAssignment.ts algorithm     | HIGH       | Greedy weighted-sort is standard; 11-player domain makes complexity irrelevant      |
| GameState optional field addition | HIGH       | Additive optional fields are the safest GameState change possible                   |
| Socket.io event additions         | HIGH       | Extension, not modification; existing event contracts unchanged                     |
| ColorScheme extraction rename     | MEDIUM     | Requires a grep-and-replace client pass; low complexity but must be done atomically |
| Seed script extension to 12 teams | HIGH       | Existing script is straightforward; same CSV schema assumed for new teams           |
