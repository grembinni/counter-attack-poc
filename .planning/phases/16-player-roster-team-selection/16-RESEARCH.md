# Phase 16: Player Roster & Team Selection - Research

**Researched:** 2026-06-13
**Domain:** TypeScript seed script, shared type extension, Socket.io event protocol, React screen routing
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Player CSVs are at `packages/shared/src/data/` — one file per team plus FA. These are the source of truth.
- **D-02:** One-time seed script generates `packages/shared/src/teams.ts` via `pnpm run seed:rosters`. Script is a dev tool, not a build step. CSV files stay in repo.
- **D-03:** CSV team-name → TeamId mapping: "Cozmos"→`'cosmos'`, "CITY"→`'city'`, "Crew"→`'crew'`, "Xolos"→`'xolos'`, "FA"→`null` (FREE_AGENTS, separate export).
- **D-04:** Jersey numbers assigned sequentially: GK=1, then remaining players 2–11 in CSV order (GK first in role sort, then DEF, MID, FWD, ST).
- **D-05:** Column mapping — `Player`→firstName+lastName split, `Team`→TeamId, `Nationality`→nationality, `Position`→role, numeric attributes by name, `Arial Ability` (typo preserved) → `aerialAbility`, blanks → `0`.
- **D-06:** Remove `name: string` from `PlayerPiece`. Replace with `firstName`, `lastName`, `number`, `nationality` (all required). No fallback `name` field.
- **D-07:** Name split rule: first whitespace token = `firstName`, everything after first space = `lastName`.
- **D-08:** `MiniTokenBadge` reads `piece.number` directly instead of deriving from `piece.id`.
- **D-09:** `PlayerStatsPanel.tsx` header: Line 1 = `piece.firstName`, Line 2 = `piece.lastName`, Line 3 = `TeamBadge` (~20px) | `piece.role` | `#${piece.number}`.
- **D-10:** Add `'TEAM_SELECTION'` to `Screen` union. After slot 2 joins, server emits `team:selection-start` instead of broadcasting initial game state.
- **D-11:** New Socket.io events: `team:selection-start` (server→both), `team:pick { teamId }` (client→server), `team:home-picked { teamId }` (server→both). After away picks, server calls `buildInitialGameState(roomCode, selectedTeams)`.
- **D-12:** Selection screen: 2×2 grid of team cards showing full-size badge (~100–120px), team name, primary-color border tint.
- **D-13:** Full-size badge images at `packages/client/src/assets/badges/{teamid}-full.png` (already in repo).
- **D-14:** `TEAM_SELECTION` screen manages its own local React state. No `gameState` in Zustand store during this screen.
- **D-15:** Add `selectedTeams: { home: TeamId; away: TeamId }` to `GameState` type.
- **D-16:** `buildInitialGameState` signature: `buildInitialGameState(roomCode: string, selectedTeams: { home: TeamId; away: TeamId }): GameState`.
- **D-17:** Delete `packages/client/src/teamDefaults.ts`. All components using `TEAM_DEFAULTS` switch to reading `gameState.selectedTeams[piece.teamId]` from Zustand.

### Claude's Discretion

- **Team id accessor pattern:** Use direct Zustand reads `const selectedTeams = useGameStore(s => s.gameState.selectedTeams)`. No new hook or selector abstraction.

### Deferred Ideas (OUT OF SCOPE)

- Free Agent selection in future match modes
- Jersey number column in CSV (sequential assignment is Phase 16 approach)
- Reconnection during TEAM_SELECTION phase
- Rematch with same teams

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                                                                                  | Research Support                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| PLAY-01   | Player data updated from fc_stats.csv — all four team squads populated with correct names, nationalities, positions, and attributes; remaining players stored as Free Agents | D-01 through D-05: seed script reads 5 CSV files, maps columns, generates `teams.ts` with four named squads + FREE_AGENTS export |
| PLAY-02   | Player card shows First Name on line 1, Last Name on line 2, and Badge/Position/# on line 3                                                                                  | D-06, D-08, D-09: PlayerPiece type extension + PlayerStatsPanel header redesign                                                  |
| PLAY-03   | Free Agent players stored in system but not selectable during team selection                                                                                                 | D-03: FA maps to null TeamId; seed script exports `FREE_AGENTS` array; selection UI only shows 4 named teams                     |
| SELECT-01 | Team selection screen before match; home picks first, away picks from remaining 3; chosen team's badge and colors applied throughout                                         | D-10 through D-17: full event protocol, screen routing, GameState extension, TEAM_DEFAULTS deletion                              |

</phase_requirements>

---

## Summary

Phase 16 has three distinct work streams that must be sequenced carefully:

**Stream 1 — Data layer:** A one-time seed script (`packages/shared/scripts/seed-rosters.ts`) reads the five CSV files already in the repo and outputs a new `packages/shared/src/teams.ts` containing four named squad exports (`COSMOS_SQUAD`, `XOLOS_SQUAD`, `CITY_SQUAD`, `CREW_SQUAD`) plus a `FREE_AGENTS` array. The `PlayerPiece` type in `types.ts` gains `firstName`, `lastName`, `number`, `nationality` and drops `name`.

**Stream 2 — Type surgery:** Removing `name` from `PlayerPiece` is a breaking change that touches the shared type, both squad files, the mock states, the existing `teams.test.ts`, and every component that currently reads `piece.name`. Adding `selectedTeams` to `GameState` and updating `buildInitialGameState`'s signature propagates through the server engine, room handlers, and client store.

**Stream 3 — Team selection UI:** A new Socket.io event protocol (`team:selection-start`, `team:pick`, `team:home-picked`) gates game start behind both players choosing a team. The client gets a new `TEAM_SELECTION` screen with its own local React state (no Zustand game state during selection). After both picks, the server calls `buildInitialGameState` with the selected teams and broadcasts the initial `GameState`.

All three streams must land before the match can start. The planner should order them: Stream 1 → Stream 2 → Stream 3, because the type changes in Stream 2 depend on the new `teams.ts` shape from Stream 1, and Stream 3 depends on `selectedTeams` in `GameState` (Stream 2).

**Primary recommendation:** Implement as three sequential plans — (1) seed script + teams.ts output, (2) type surgery + TEAM_DEFAULTS deletion, (3) team selection socket protocol + UI screen.

---

## Architectural Responsibility Map

| Capability                            | Primary Tier                     | Secondary Tier             | Rationale                                                             |
| ------------------------------------- | -------------------------------- | -------------------------- | --------------------------------------------------------------------- |
| CSV parsing and squad generation      | Build tool / Dev script (shared) | —                          | One-time dev tool; output committed to repo; no runtime CSV parsing   |
| PlayerPiece type extension            | Shared types                     | —                          | Both server (engine) and client (store, components) consume this type |
| GameState.selectedTeams field         | Shared types + Server (engine)   | Client (store, components) | Server owns authoritative state; client reads from Zustand            |
| Team selection turn order enforcement | Server (roomHandlers)            | —                          | Server must be authoritative; client cannot trust local turn state    |
| TEAM_SELECTION screen rendering       | Frontend (React)                 | —                          | Pure client-side screen; no game state until both picks complete      |
| buildInitialGameState signature       | Server (gameEngine)              | —                          | Server-only function; client never calls it                           |
| TEAM_DEFAULTS deletion + migration    | Client (components)              | —                          | All four affected components read selectedTeams from Zustand instead  |

---

## Standard Stack

### Core

| Library                            | Version | Purpose                       | Why Standard                                                              |
| ---------------------------------- | ------- | ----------------------------- | ------------------------------------------------------------------------- |
| TypeScript                         | 5.x     | Seed script, type changes     | Already in monorepo; seed script runs via `ts-node` or `tsx`              |
| Node.js built-in `fs` + `readline` | 22 LTS  | CSV parsing in seed script    | No external parser needed for well-structured CSVs; avoids new dependency |
| React                              | 18.3.1  | TeamSelectionScreen component | Pinned version per STATE.md                                               |
| Socket.io server                   | 4.x     | New event protocol            | Existing server infrastructure                                            |
| Zustand                            | 4.5.7   | Screen state extension        | Pinned version per STATE.md                                               |

### Supporting

| Library                  | Version | Purpose                                     | When to Use                                                                       |
| ------------------------ | ------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| `tsx` (existing dev dep) | —       | Run seed script via `pnpm run seed:rosters` | Preferred over ts-node for ESM monorepo; check if already installed before adding |
| CSS Modules              | —       | `TeamSelectionScreen.module.css`            | Existing pattern for all components in this project                               |

**Installation:**
No new runtime dependencies required. The seed script is a dev tool. Verify `tsx` or `ts-node` availability before defining the `pnpm run seed:rosters` script command.

---

## Package Legitimacy Audit

No new runtime packages are introduced in this phase. The seed script uses only Node.js built-in `fs` and `readline`. No package legitimacy check required.

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none

---

## Architecture Patterns

### System Architecture Diagram

```
DEV TIME (one-shot):
  cosmos_players.csv ─┐
  xolos_players.csv  ─┤
  city_players.csv   ─┤──► seed-rosters.ts ──► teams.ts (committed)
  crew_players.csv   ─┤         │
  fa_players.csv     ─┘         └── FREE_AGENTS[]

RUNTIME (match start flow):
  Player 1 joins room
       │
  Player 2 joins room
       │
  roomHandlers.ts: emits team:selection-start (instead of broadcastState)
       │
  Both clients ──► TEAM_SELECTION screen
       │
  Home player clicks a team card
       │──► team:pick { teamId } ──► server validates → emits team:home-picked { teamId }
  Both clients: home card struck-out; away player's 3 remaining cards activate
       │
  Away player clicks a remaining card
       │──► team:pick { teamId } ──► server calls buildInitialGameState(roomCode, selectedTeams)
                                          └──► broadcastState ──► both clients
  Both clients ──► GAME_BOARD screen (GameState.phase = 'KICK_OFF_SETUP')
```

### Recommended Project Structure

```
packages/shared/scripts/
└── seed-rosters.ts         # dev-only; run once via pnpm run seed:rosters

packages/shared/src/
├── data/                   # CSV source files (unchanged)
├── teams.ts                # REPLACED by seed script output (4 named squads + FREE_AGENTS)
├── types.ts                # PlayerPiece extended; GameState.selectedTeams added
├── teamConfig.ts           # unchanged (TeamId, TEAM_CONFIGS)
└── events.ts               # 3 new events added

packages/client/src/
├── teamDefaults.ts         # DELETED
└── components/
    ├── TeamSelectionScreen.tsx      # NEW
    ├── TeamSelectionScreen.module.css  # NEW
    ├── PlayerStatsPanel.tsx         # header redesign (D-09) + number fix (D-08)
    ├── PieceOverlay.tsx             # TEAM_DEFAULTS → selectedTeams
    ├── GameBoard.tsx                # TEAM_DEFAULTS → selectedTeams
    └── ActionLog.tsx                # TEAM_DEFAULTS → selectedTeams

packages/server/src/
├── roomHandlers.ts         # emit team:selection-start after slot 2 joins; team:pick handler
└── gameEngine.ts           # buildInitialGameState signature + buildKickOffPieces
```

### Pattern 1: CSV Parsing in Seed Script (Node.js built-ins only)

**What:** Read CSV line-by-line using `fs.createReadStream` + `readline`, split on commas, map to `PlayerPiece` shape, write TypeScript source file.
**When to use:** One-time dev tool; no runtime dependency; committed output.

```typescript
// Source: Node.js docs (built-in readline + fs)
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

async function parseCSV(filePath: string): Promise<string[][]> {
  const rl = createInterface({ input: createReadStream(filePath) });
  const rows: string[][] = [];
  for await (const line of rl) {
    rows.push(line.split(',').map((s) => s.trim()));
  }
  return rows;
}
```

**Critical detail — CSV column "Arial Ability":** The CSV files have a typo: "Arial Ability" (not "Aerial"). The seed script header parser must use the exact string `'Arial Ability'` as the key to map to `aerialAbility`. [VERIFIED: read from actual CSV files in repo]

**Critical detail — Position value "STR":** The city and crew CSVs contain `STR` as a position value (e.g., Simon Becher, Cucho Hernandez). The seed script must map `'STR'` → `'ST'` in the role mapping, alongside the standard `GK`, `DEF`, `MID`, `FWD`, `ST` values. [VERIFIED: read from actual CSV files in repo]

**Critical detail — GK attribute blanks:** GK rows in the CSV have empty `Heading`, `Highpass` (for some GKs), `Shooting`, `Tackling`, `Dribbling`, `Resilience`, `Arial Ability` fields. The seed script must treat empty or blank cells as `0` for GK-only attributes (`saving`, `handling`, `aerialAbility`), and for outfield-only attributes on GK rows. [VERIFIED: read from actual CSV files in repo — e.g. cosmos GK Vinicius Eubsinno has no Heading or Highpass value but has Saving=4 Handling=4]

**Critical detail — Highpass for GKs:** The cosmos GK has `Highpass=6` in the CSV, xolos GK has `Highpass=4`. Per D-04 (Phase 5), GKs use `highPass: 0` regardless — the seed script must force `highPass: 0` for all GK rows, ignoring whatever value appears in the CSV. [VERIFIED: D-04 rule in teams.ts comments + types.ts JSDoc]

**Critical detail — City GK Roman Bürki:** The city CSV has `Position` = `GK` and all values explicitly present (no blanks for the GK-specific attributes). Roman Bürki has Pace=3, Dribbling=3, Heading=0, Highpass=6, Resilience=3, Shooting=0, Tackling=0, Arial Ability=4, Saving=5, Handling=4. Note: `Heading=0` for a GK is fine (aerialAbility replaces heading for GKs). The seed script must still force `highPass: 0` for this GK even though CSV shows 6. [VERIFIED: read from city_players.csv]

**Critical detail — Crew GK Patrick Schulte:** Has `Heading=0` and `Highpass=5` in CSV — same rule applies: force `highPass: 0`. [VERIFIED: read from crew_players.csv]

### Pattern 2: Seed Script Jersey Number Assignment

Per D-04, jersey numbers are assigned sequentially: GK=1, then remaining players 2–11. The sort order is: GK first, then DEF, then MID, then FWD, then ST. This matches the existing `teams.ts` ordering pattern.

```typescript
// Source: D-04 decision in 16-CONTEXT.md [ASSUMED — implementation pattern]
const ROLE_ORDER = ['GK', 'DEF', 'MID', 'FWD', 'ST'] as const;
const sorted = players.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
sorted.forEach((p, i) => {
  p.number = i + 1;
});
```

**Note:** The starting positions in `teams.ts` are not derived from the CSV. The seed script must copy the formation coordinates from the existing `teams.ts` by role (GK position, DEF positions, etc.) as constants within the seed script itself. The CSV provides only attributes, not positions. [VERIFIED: D-05 note in 16-CONTEXT.md "The seed script assigns positions by role from the hardcoded formation coordinates"]

### Pattern 3: New Socket.io Events — Type-Safe Addition

The existing `events.ts` pattern uses `const` objects for event names and interface declarations for typed maps. New events follow the same pattern:

```typescript
// Source: packages/shared/src/events.ts (existing pattern) [VERIFIED: read from file]
export const ServerEvents = {
  // ... existing ...
  TEAM_SELECTION_START: 'team:selection-start',
  TEAM_HOME_PICKED: 'team:home-picked',
} as const;

export const ClientEvents = {
  // ... existing ...
  TEAM_PICK: 'team:pick',
} as const;

// Add to ServerToClientEvents interface:
[ServerEvents.TEAM_SELECTION_START]: () => void;
[ServerEvents.TEAM_HOME_PICKED]: (teamId: TeamId) => void;

// Add to ClientToServerEvents interface:
[ClientEvents.TEAM_PICK]: (teamId: TeamId) => void;
```

### Pattern 4: TeamSelectionScreen — Local React State (no Zustand game state)

Per D-14, the selection screen manages its own local state. The Zustand store has no `gameState` during this screen (the initial game state is broadcast only after both players pick).

```typescript
// Source: D-14 decision in 16-CONTEXT.md [ASSUMED — implementation pattern]
function TeamSelectionScreen() {
  const playerSlot = useGameStore((s) => s.playerSlot);
  const [homePickedTeam, setHomePickedTeam] = useState<TeamId | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(playerSlot === 1); // home picks first

  // Socket handler registered in App.tsx useEffect alongside other handlers
  // team:home-picked → setHomePickedTeam(teamId), setIsMyTurn(playerSlot === 2)
  // team:selection-start → setScreen('TEAM_SELECTION') (in App.tsx)
}
```

### Pattern 5: TEAM_DEFAULTS Replacement Pattern

The four components that currently use `TEAM_DEFAULTS[piece.teamId]` must switch to reading `gameState.selectedTeams[piece.teamId]`. The Zustand selector pattern is:

```typescript
// Source: Claude's Discretion in 16-CONTEXT.md
const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);
// Then: selectedTeams[piece.teamId] replaces TEAM_DEFAULTS[piece.teamId]
```

**Gotcha:** During `TEAM_SELECTION` screen, there is no `gameState` in the store. Components that access `gameState.selectedTeams` are only rendered during `GAME_BOARD` / `REPLAY` screens, so there is no null-access risk as long as `GameBoard` and `ActionLog` are only rendered when `screen === 'GAME_BOARD' || screen === 'REPLAY'` (which is already the case in `App.tsx`). [VERIFIED: App.tsx line 82 renders GameBoard only for those two screens]

### Anti-Patterns to Avoid

- **Do not parse CSVs at runtime:** The seed script is a dev tool. `teams.ts` is committed source. No CSV parsing at server startup or client load time.
- **Do not keep `name` as an alias:** D-06 explicitly removes `name` from `PlayerPiece`. Do not add a computed getter or alias — every callsite must be updated.
- **Do not emit `buildInitialGameState` before both players have picked:** The server must accumulate both picks in room state before calling `buildInitialGameState`. Adding `selectedTeamsBySlot` to the room object is the right pattern.
- **Do not use `io.to(roomCode)` in the team:pick handler for broadcasting to the picking player:** Follow the existing Socket.io pattern in `roomHandlers.ts` — use `io.to(roomCode)` for broadcasts to all room members (including sender). The `socket.to` exclude-sender pattern is used for warnings, not for game state updates.
- **Do not access `gameState.selectedTeams` before game state exists:** The `TEAM_SELECTION` screen has no game state. Only `GAME_BOARD`/`REPLAY` screens render components that access this field.
- **Do not use `playerNumber` derived from `piece.id` index after this phase:** The existing `MiniTokenBadge` derivation (`piece.id.lastIndexOf('-') + 1`) will be wrong after the type surgery. It must read `piece.number` directly.

---

## Don't Hand-Roll

| Problem                                        | Don't Build      | Use Instead                                                             | Why                                                                                                                           |
| ---------------------------------------------- | ---------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| CSV parsing                                    | Custom tokenizer | Node.js `readline` + `split(',')`                                       | The CSVs are well-structured (no embedded commas in values, no quoted fields) — a simple split is correct and zero-dependency |
| TypeScript source generation                   | Template engine  | String literal template in seed script                                  | The output is a fixed-shape TypeScript file; a template string in the script is sufficient                                    |
| Socket.io room membership in team:pick handler | Custom tracking  | `socket.data.roomCode` + `socket.data.playerSlot` (already set at join) | The existing `socket.data` pattern carries all needed context                                                                 |

**Key insight:** The seed script generates static TypeScript source. There is no parsing at runtime, no CSV dependency shipped to clients, and no schema migration — just a developer runs `pnpm run seed:rosters` once and commits the output.

---

## Common Pitfalls

### Pitfall 1: CSV Column "Arial Ability" Typo

**What goes wrong:** Seed script uses `'Aerial Ability'` or `'aerialAbility'` as the CSV column key → returns `undefined` → all `aerialAbility` values become `0` or crash.
**Why it happens:** The CSV header has a typo — "Arial" not "Aerial". Developers naturally spell it correctly.
**How to avoid:** Use the exact string `'Arial Ability'` when looking up the column index from the header row. Add a comment in the seed script noting the typo.
**Warning signs:** All players having `aerialAbility: 0` in the generated output (GKs should have non-zero values).

### Pitfall 2: Position Value "STR" Not in Role Union

**What goes wrong:** `city_players.csv` (Simon Becher) and `crew_players.csv` (Cucho Hernandez) use `'STR'` as the Position value. The TypeScript role union is `'GK' | 'DEF' | 'MID' | 'FWD' | 'ST'` — `'STR'` is not valid.
**Why it happens:** Inconsistent data entry in the CSV files.
**How to avoid:** Seed script must map `'STR'` → `'ST'` in the position/role conversion.
**Warning signs:** TypeScript compilation error on the generated `teams.ts` for `role: 'STR'` fields.

### Pitfall 3: GK highPass Not Forced to 0

**What goes wrong:** Some GKs have a non-zero `Highpass` value in the CSV (cosmos GK = 6, xolos GK = 4, city GK = 6, crew GK = 5). If the seed script reads this value as-is, the GK will have `highPass > 0`, violating D-04.
**Why it happens:** The CSV is a football stats sheet; the game rule that GKs use kick accuracy (not highPass) is a game-specific override.
**How to avoid:** Seed script unconditionally sets `highPass: 0` for all GK-role players after parsing.
**Warning signs:** The `teams.test.ts` check `if (attr === 'highPass' && role === 'GK') return 0` minimum will fail if the generated file has non-zero GK highPass.

### Pitfall 4: Mock State Still Uses `name` Field

**What goes wrong:** `mockMovementState.ts` spreads `HOME_SQUAD` and `AWAY_SQUAD` which will no longer have a `name` field after the type change. Tests that look for `piece.name` or the text `'Home GK'` will break.
**Why it happens:** The mock state mirrors the squad types, and tests like `PlayerStatsPanel.test.tsx` assert `screen.getByText(/Home GK/i)`.
**How to avoid:** After the `PlayerPiece` type surgery, update `mockMovementState.ts` (and other mock states) if they include player data. The `PlayerStatsPanel.test.tsx` test assertions for player name must be updated to match the new two-line firstName/lastName display.
**Warning signs:** TypeScript errors in mock files; test failures for name-related assertions.

### Pitfall 5: `teams.test.ts` Tests `player.name` After Type Removal

**What goes wrong:** The existing `teams.test.ts` has tests `'each player has a non-empty name and a valid role (TEAM-02)'` that check `player.name.length`. After removing `name` from `PlayerPiece`, this test fails to compile.
**Why it happens:** The test was written for the old type.
**How to avoid:** Update `teams.test.ts` when the type changes — replace `player.name` checks with `player.firstName.length > 0 && player.lastName.length > 0` checks.
**Warning signs:** TypeScript compile error in `teams.test.ts`.

### Pitfall 6: buildInitialGameState Used Before Type is Updated in gameEngine.ts

**What goes wrong:** `gameEngine.ts` imports `HOME_SQUAD` and `AWAY_SQUAD` from `@counter-attack/shared`. After the seed script runs and `teams.ts` is regenerated, those exports change shape (named squads instead of HOME_SQUAD/AWAY_SQUAD). The engine must be updated to accept `selectedTeams` and use the appropriate squad.
**Why it happens:** The engine currently hardcodes `HOME_SQUAD` and `AWAY_SQUAD`. After Phase 16, it must look up `COSMOS_SQUAD`, `XOLOS_SQUAD`, etc. based on `selectedTeams.home` and `selectedTeams.away`.
**How to avoid:** Plan the order: (1) generate new teams.ts shape, (2) update engine to accept selectedTeams and map to squad, (3) update room handlers to delay broadcast.
**Warning signs:** Import errors in `gameEngine.ts` when `HOME_SQUAD`/`AWAY_SQUAD` are removed from the `teams.ts` exports.

### Pitfall 7: `buildKickOffPieces` Also Uses HOME_SQUAD/AWAY_SQUAD

**What goes wrong:** `buildKickOffPieces` in `gameEngine.ts` (line ~129) also spreads `HOME_SQUAD` and `AWAY_SQUAD`. It is called after a goal to reset player positions. It also needs to be updated to accept (or carry forward) `selectedTeams`.
**Why it happens:** The function is a sibling to `buildInitialGameState` and uses the same squad constants.
**How to avoid:** Update `buildKickOffPieces` in the same task as `buildInitialGameState`. Add `selectedTeams` parameter or derive it from a passed `GameState`.
**Warning signs:** After a goal, players reset to the generic home/away formation instead of the correct named team's attributes.

### Pitfall 8: App.tsx Screen Routing — TEAM_SELECTION Branch Missing

**What goes wrong:** `App.tsx` currently routes `GAME_BOARD | REPLAY → <GameBoard />`, else `<LobbyScreen />`. After slot 2 joins, the server emits `team:selection-start` instead of `game:state`. Without adding a `TEAM_SELECTION` branch, the client stays on `WAITING` screen (which is currently rendered as `LobbyScreen`).
**Why it happens:** The existing fallback is LobbyScreen, which doesn't render the TeamSelectionScreen.
**How to avoid:** Add `screen === 'TEAM_SELECTION' → <TeamSelectionScreen />` branch in `App.tsx` render, alongside the `GAME_BOARD`/`REPLAY` → `<GameBoard />` branch.
**Warning signs:** After both players join, the screen stays on "Waiting for opponent" or blank.

### Pitfall 9: Socket Listener Cleanup in App.tsx for New Events

**What goes wrong:** Registering `team:selection-start` and `team:home-picked` handlers inside `useEffect` without including them in the cleanup `return` → stale handlers accumulate on reconnect.
**Why it happens:** The existing pattern in `App.tsx` already does this correctly for all other events, but it's easy to forget when adding new ones.
**How to avoid:** Add `socket.off(ServerEvents.TEAM_SELECTION_START, handler)` etc. in the same `return` cleanup block.
**Warning signs:** Duplicate state transitions when multiple reconnects occur.

### Pitfall 10: `isProcessing` Mutex on team:pick Handler

**What goes wrong:** A player double-clicks their team card, sending two `team:pick` events rapidly. Without the mutex, the server may process both, setting the wrong team or calling `buildInitialGameState` twice.
**Why it happens:** The existing pattern notes "isProcessing mutex on all game handlers" in the code context.
**How to avoid:** Wrap the `team:pick` handler body in `if (room.isProcessing) return; room.isProcessing = true; ... room.isProcessing = false;` — the same pattern as `gameHandlers.ts`.
**Warning signs:** Race condition in tests; `buildInitialGameState` called twice.

---

## Code Examples

### teams.ts Output Shape (Seed Script Target)

```typescript
// Source: D-03, D-04, D-05, D-06 in 16-CONTEXT.md [VERIFIED: derived from locked decisions]
import type { PlayerPiece } from './types.js';

export const COSMOS_SQUAD: readonly PlayerPiece[] = [
  {
    id: 'home-0', // positional id (unchanged from current pattern)
    teamId: 'home', // assigned at runtime by buildInitialGameState
    firstName: 'Vinicius',
    lastName: 'Eubsinno',
    number: 1, // GK always gets 1
    nationality: 'Brazil',
    role: 'GK',
    position: { q: 1, r: 13 }, // from formation constants, NOT from CSV
    pace: 5,
    shooting: 1,
    tackling: 0,
    dribbling: 3,
    heading: 0,
    saving: 4,
    handling: 4,
    resilience: 6,
    aerialAbility: 6,
    highPass: 0, // forced to 0 for GK regardless of CSV value
  },
  // ... remaining 10 players, numbered 2-11 in role order ...
];

export const FREE_AGENTS: readonly PlayerPiece[] = [
  // 24 players from fa_players.csv; teamId will be set at runtime if ever used
  // number assigned sequentially 1–24 in CSV order
];
```

**Note on teamId in squad exports:** The squad arrays export with `teamId: 'home'` as a placeholder (matching the current pattern). The `buildInitialGameState` function maps the selected team's squad and overrides `teamId` to `'home'` or `'away'` based on which slot picked that team. This is the same pattern as the current `HOME_SQUAD` / `AWAY_SQUAD`.

### buildInitialGameState Updated Signature

```typescript
// Source: D-15, D-16 in 16-CONTEXT.md [VERIFIED: derived from locked decisions]
const SQUAD_MAP: Record<TeamId, readonly PlayerPiece[]> = {
  cosmos: COSMOS_SQUAD,
  xolos: XOLOS_SQUAD,
  city: CITY_SQUAD,
  crew: CREW_SQUAD,
};

export function buildInitialGameState(
  roomCode: string,
  selectedTeams: { home: TeamId; away: TeamId },
): GameState {
  const attackingTeam: 'home' | 'away' = randomInt(0, 2) === 0 ? 'home' : 'away';

  // Map named squads to positional teamId
  const homeSquad = SQUAD_MAP[selectedTeams.home].map((p) => ({ ...p, teamId: 'home' as const }));
  const awaySquad = SQUAD_MAP[selectedTeams.away].map((p) => ({
    ...p,
    teamId: 'away' as const,
    // Mirror positions for away team
    position: mirrorPosition(p.position),
    id: p.id.replace('home-', 'away-'),
  }));
  // ... ST position override by coin flip, same as current logic ...
  return {
    // ...
    selectedTeams, // D-15: stored in GameState
  };
}
```

**Note on away squad position mirroring:** The current `AWAY_SQUAD` in `teams.ts` has manually set away-mirrored positions (q=35, q=30, etc.). After the seed script, all four squads will have home-side positions (q values for home half). The seed script should store home-side positions for all squads. `buildInitialGameState` mirrors away positions by computing `q_away = 36 - q_home`. This is the same principle already used in `mockMovementState.ts` where away positions are `q: 36 - home_q`. [ASSUMED — the current teams.ts away positions are manually mirrored; the new approach needs to either: (a) store away-mirrored positions in the squad or (b) mirror at runtime. The planner should decide — option (b) is cleaner for a symmetric pitch.]

### PlayerStatsPanel Header Redesign

```tsx
// Source: D-09 in 16-CONTEXT.md [VERIFIED: derived from locked decisions + TeamBadge component]
// Line 1: firstName; Line 2: lastName; Line 3: badge | role | number
<div className={styles.header}>
  <MiniTokenBadge piece={piece} />
  <div className={styles.headerText}>
    <span className={styles.firstName}>{piece.firstName}</span>
    <span className={styles.lastName}>{piece.lastName}</span>
    <span className={styles.playerMeta}>
      <TeamBadge teamId={selectedTeams[piece.teamId]} size={20} />
      {piece.role}
      &nbsp;#{piece.number}
    </span>
  </div>
</div>
```

The `selectedTeams` is read from Zustand: `const selectedTeams = useGameStore(s => s.gameState.selectedTeams)`.

### TeamSelectionScreen Skeleton

```tsx
// Source: D-10 through D-14 in 16-CONTEXT.md [ASSUMED — implementation pattern]
import { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';
import { TeamBadge } from './TeamBadge.js';
import styles from './TeamSelectionScreen.module.css';

const ALL_TEAMS: TeamId[] = ['cosmos', 'xolos', 'city', 'crew'];

// Full-size badge imports (Vite static imports for content-hashed URLs)
import cosmosFullBadge from '../assets/badges/cosmos-full.png';
import xolosFullBadge from '../assets/badges/xolos-full.png';
import cityFullBadge from '../assets/badges/city-full.png';
import crewFullBadge from '../assets/badges/crew-full.png';

const FULL_BADGE_MAP: Record<TeamId, string> = {
  cosmos: cosmosFullBadge,
  xolos: xolosFullBadge,
  city: cityFullBadge,
  crew: crewFullBadge,
};

export function TeamSelectionScreen({
  homePickedTeam,
  onPick,
}: {
  homePickedTeam: TeamId | null;
  onPick: (teamId: TeamId) => void;
}) {
  const playerSlot = useGameStore((s) => s.playerSlot);
  const isHomeTurn = homePickedTeam === null;
  const iAmHome = playerSlot === 1;
  const iAmActive = isHomeTurn ? iAmHome : !iAmHome;

  return (
    <div className={styles.screen}>
      <h2>{isHomeTurn ? 'Home: choose your team' : 'Away: choose your team'}</h2>
      <div className={styles.grid}>
        {ALL_TEAMS.map((teamId) => {
          const isStruckOut = teamId === homePickedTeam;
          const isDisabled = !iAmActive || isStruckOut;
          return (
            <button
              key={teamId}
              disabled={isDisabled}
              className={isStruckOut ? styles.cardStruckOut : styles.card}
              style={{ borderColor: TEAM_CONFIGS[teamId].primaryColor }}
              onClick={() => onPick(teamId)}
            >
              <img src={FULL_BADGE_MAP[teamId]} width={110} height={110} alt={teamId} />
              <span>{TEAM_CONFIGS[teamId].name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

The `homePickedTeam` and `onPick` are managed in `App.tsx` local state, wired to the socket handler for `team:home-picked`.

---

## Runtime State Inventory

> This phase is NOT a rename/refactor of runtime state. The section below covers the one category that IS affected.

| Category            | Items Found                                                                                                                                        | Action Required                                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored data         | `mockMovementState.ts`, `mockPassState.ts`, `mockShotState.ts`, `mockGKRestartState.ts` spread `HOME_SQUAD`/`AWAY_SQUAD` which will have new shape | Update all mock states to add `selectedTeams` to the spread `GameState`, and ensure pieces have `firstName`/`lastName`/`number`/`nationality` (they inherit from squad arrays which will have the new shape after seed script runs) |
| Live service config | None — no external service config embeds player names or team selection                                                                            | None                                                                                                                                                                                                                                |
| OS-registered state | None                                                                                                                                               | None                                                                                                                                                                                                                                |
| Secrets/env vars    | None                                                                                                                                               | None                                                                                                                                                                                                                                |
| Build artifacts     | `packages/shared/tsconfig.tsbuildinfo` — stale after `types.ts` change                                                                             | `pnpm run build` in shared package will regenerate                                                                                                                                                                                  |

**Nothing found in category:** Live service config, OS-registered state, Secrets/env vars — none, verified by inspection of codebase.

---

## Open Questions

1. **Away squad position mirroring strategy**
   - What we know: current `AWAY_SQUAD` in `teams.ts` has manually mirrored positions. After seed script, all 4 squads will have home-side positions.
   - What's unclear: should the seed script store home-side positions for all squads (and let `buildInitialGameState` mirror at runtime), or should the seed script emit mirrored away positions for each squad?
   - Recommendation: Store home-side positions only in the seed output. `buildInitialGameState` mirrors with `q_away = 36 - q_home` (same symmetric axis used in `mockMovementState.ts`). This is cleaner and ensures all 4 squads use the same data shape.

2. **`buildKickOffPieces` selectedTeams source**
   - What we know: `buildKickOffPieces` is called after a goal; it needs the selected squads to reset players.
   - What's unclear: does it receive `selectedTeams` as a new parameter, or is it derived from the current `GameState` passed by the caller?
   - Recommendation: Add `selectedTeams: { home: TeamId; away: TeamId }` as a second parameter to `buildKickOffPieces`, consistent with `buildInitialGameState`. The caller (goal handler in `gameEngine.ts`) already has `gameState.selectedTeams`.

3. **`teams.ts` export names for squads**
   - What we know: D-03 defines the 4 TeamIds but doesn't specify the export constant names.
   - What's unclear: Use `COSMOS_SQUAD`, `XOLOS_SQUAD`, etc. or `TEAM_SQUADS: Record<TeamId, readonly PlayerPiece[]>`?
   - Recommendation: Use a single `TEAM_SQUADS` record for cleaner lookup in `buildInitialGameState`: `TEAM_SQUADS[selectedTeams.home]`. Also export `FREE_AGENTS` as a standalone array per D-03.

---

## Environment Availability

| Dependency     | Required By             | Available                                                | Version                | Fallback                                        |
| -------------- | ----------------------- | -------------------------------------------------------- | ---------------------- | ----------------------------------------------- |
| Node.js        | seed script runtime     | ✓                                                        | 22 LTS (per CLAUDE.md) | —                                               |
| pnpm           | `pnpm run seed:rosters` | ✓                                                        | 9.x (per CLAUDE.md)    | —                                               |
| tsx or ts-node | seed script execution   | [ASSUMED — check `packages/shared/package.json` devDeps] | —                      | Use `tsc` + `node dist/scripts/seed-rosters.js` |

**Note on tsx:** The `packages/shared/package.json` does not currently have a `seed:rosters` script. The planner must add it. Verify whether `tsx` is already installed as a devDependency before choosing the execution command. An alternative is to write the seed script in plain JavaScript (`seed-rosters.js`) to avoid any transpilation requirement.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Framework          | Vitest 2.1.9                                                                                                       |
| Config file        | `packages/shared/vitest.config.ts` (implicit, uses package.json `test` script), `packages/client/vitest.config.ts` |
| Quick run command  | `pnpm --filter @counter-attack/shared run test`                                                                    |
| Full suite command | `pnpm run test`                                                                                                    |

**Current baseline:** shared = 240 pass / 0 fail; server = (part of full suite); client = 81 pass / 1 pre-existing fail (ActionPanel.test.tsx, unrelated to Phase 16).

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                                      | Test Type | Automated Command                                                           | File Exists?                |
| --------- | --------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------- | --------------------------- |
| PLAY-01   | Four squads each have 11 players with correct fields                                          | unit      | `pnpm --filter @counter-attack/shared run test` (teams.test.ts)             | ✅ exists but needs updates |
| PLAY-01   | Seed script generates valid TypeScript that compiles                                          | build     | `pnpm --filter @counter-attack/shared run build`                            | —                           |
| PLAY-01   | FREE_AGENTS export has 24 players                                                             | unit      | teams.test.ts (new test)                                                    | ❌ Wave 0                   |
| PLAY-02   | PlayerStatsPanel renders firstName on line 1, lastName on line 2, badge+role+number on line 3 | unit      | `pnpm --filter @counter-attack/client run test` (PlayerStatsPanel.test.tsx) | ✅ exists but needs updates |
| PLAY-03   | FREE_AGENTS players not shown in TeamSelectionScreen                                          | unit      | TeamSelectionScreen.test.tsx                                                | ❌ Wave 0                   |
| SELECT-01 | Home player's cards active, away player's disabled initially                                  | unit      | TeamSelectionScreen.test.tsx                                                | ❌ Wave 0                   |
| SELECT-01 | After home picks, their card is struck-out on away's view; 3 remaining active                 | unit      | TeamSelectionScreen.test.tsx                                                | ❌ Wave 0                   |
| SELECT-01 | selectedTeams embedded in GameState after both picks                                          | unit      | gameEngine.test.ts (new test)                                               | ❌ Wave 0                   |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/shared run test && pnpm --filter @counter-attack/client run test`
- **Per wave merge:** `pnpm run test`
- **Phase gate:** Full suite green (modulo the pre-existing ActionPanel failure which is unrelated) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/shared/src/teams.test.ts` — update: replace `player.name` checks with `player.firstName + player.lastName` checks; add test for 4 squads × 11 players; add test for FREE_AGENTS.length === 24; add test that no player has `name` field
- [ ] `packages/client/src/components/PlayerStatsPanel.test.tsx` — update: replace `getByText(/Home GK/i)` with firstName/lastName text; add tests for badge/role/number line 3
- [ ] `packages/client/src/components/TeamSelectionScreen.test.tsx` — NEW: covers PLAY-03, SELECT-01 behaviors listed above
- [ ] `packages/shared/src/gameEngine.test.ts` (or new file) — new test: `buildInitialGameState` with selectedTeams sets `gameState.selectedTeams` correctly
- [ ] Mock states — update `selectedTeams` field on `GameState` objects and verify no TypeScript errors

---

## Security Domain

> `security_enforcement` not set to false in config.json — section included.

| ASVS Category         | Applies                                                                | Standard Control                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| V2 Authentication     | No                                                                     | Team selection is tied to playerSlot (server-assigned); no separate auth                                                             |
| V3 Session Management | No                                                                     | Existing session token pattern unchanged                                                                                             |
| V4 Access Control     | Yes — team:pick must only be accepted from the currently active player | Server validates `socket.data.playerSlot` before processing `team:pick`; home player (slot 1) picks first, then away player (slot 2) |
| V5 Input Validation   | Yes — teamId in team:pick payload                                      | Server validates `teamId` is one of the 4 valid TeamId values and not already picked                                                 |
| V6 Cryptography       | No                                                                     | No new cryptographic operations                                                                                                      |

### Known Threat Patterns for This Phase

| Pattern                                                         | STRIDE    | Standard Mitigation                                                          |
| --------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------- |
| Away player sends team:pick before home player has picked       | Tampering | Server checks `room.homeTeamPicked !== undefined` before accepting away pick |
| Player sends team:pick with an invalid or already-chosen teamId | Tampering | Server validates teamId ∈ TeamId union AND teamId !== room.homePickedTeam    |
| Double-pick race (two team:pick events from same player)        | Tampering | isProcessing mutex on the handler; first pick locks the slot                 |
| Player sends team:pick when not in a room                       | Tampering | Check `socket.data.roomCode` is set before processing                        |

---

## State of the Art

| Old Approach                                             | Current Approach                                   | When Changed | Impact                                                   |
| -------------------------------------------------------- | -------------------------------------------------- | ------------ | -------------------------------------------------------- |
| Hardcoded HOME_SQUAD/AWAY_SQUAD in teams.ts              | 4 named squads from CSV seed script                | Phase 16     | Real player names, attributes from CSV; teams selectable |
| `piece.name` single string                               | `piece.firstName + piece.lastName` separate fields | Phase 16     | Enables two-line card layout; removes ambiguity          |
| TEAM_DEFAULTS client-side constant (always cosmos/xolos) | Dynamic `gameState.selectedTeams`                  | Phase 16     | Colors/badges driven by actual player choice             |
| Game starts immediately after slot 2 joins               | Team selection screen gates game start             | Phase 16     | Both players must pick before match begins               |

---

## Assumptions Log

| #   | Claim                                                                                                                         | Section                       | Risk if Wrong                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A1  | Away squad position mirroring done at runtime in `buildInitialGameState` via `q_away = 36 - q_home`                           | Code Examples, Open Questions | If mirroring formula is wrong, away players start in wrong hexes; caught by `buildInitialGameState` tests   |
| A2  | `tsx` or `ts-node` is available (or installable) to run the seed script as TypeScript                                         | Environment Availability      | If neither available, seed script must be written in JS; adjust `pnpm run seed:rosters` command accordingly |
| A3  | The 4 squad exports will be named via a `TEAM_SQUADS: Record<TeamId, readonly PlayerPiece[]>` record (Open Question 3)        | Architecture Patterns         | Minor: any naming works; planner should confirm before implementing                                         |
| A4  | `buildKickOffPieces` receives `selectedTeams` as second parameter                                                             | Open Questions, Code Examples | If wrong, goal reset will revert players to wrong team attributes                                           |
| A5  | All FA players in `fa_players.csv` have `teamId` set to some placeholder in the generated output (e.g., `null` or a sentinel) | Architecture Patterns         | Minor: FREE_AGENTS array is not used in gameplay in Phase 16                                                |

---

## Sources

### Primary (HIGH confidence)

- `packages/shared/src/data/*.csv` — actual CSV source files read directly; column names, data values, edge cases verified
- `packages/shared/src/types.ts` — current `PlayerPiece` and `GameState` types, exact field names
- `packages/shared/src/teams.ts` — current squad structure, formation positions, attribute patterns
- `packages/shared/src/events.ts` — current Socket.io event pattern; typed const object + interface pattern
- `packages/shared/src/teamConfig.ts` — TeamId union, TEAM_CONFIGS shape
- `packages/client/src/components/PlayerStatsPanel.tsx` — current header rendering, MiniTokenBadge number derivation
- `packages/client/src/components/GameBoard.tsx` — current TEAM_DEFAULTS usage
- `packages/client/src/components/ActionLog.tsx` — current TEAM_DEFAULTS usage
- `packages/client/src/components/TeamBadge.tsx` — existing reusable badge component
- `packages/client/src/App.tsx` — screen routing, socket event handler pattern
- `packages/client/src/store/useGameStore.ts` — Screen union, Zustand store shape
- `packages/server/src/roomHandlers.ts` — current slot-2 join → broadcastState flow
- `packages/server/src/gameEngine.ts` — current `buildInitialGameState` and `buildKickOffPieces` signatures
- `.planning/phases/16-player-roster-team-selection/16-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — accumulated decisions, pitfalls, locked patterns
- `packages/shared/src/teams.test.ts` — existing test coverage to be preserved/updated

### Tertiary (LOW confidence)

- Away squad position mirroring formula `q_away = 36 - q_home` [ASSUMED from mockMovementState.ts pattern]
- tsx/ts-node availability for seed script execution [ASSUMED]

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries are existing project dependencies, no new packages
- Architecture: HIGH — all locked decisions are from CONTEXT.md; code structure confirmed by reading actual files
- Pitfalls: HIGH — all pitfalls derived from reading actual CSV data and existing code (typos, type conflicts, mock state breakage confirmed)
- Test gap identification: HIGH — gaps identified by reading existing test files and comparing against requirements

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable codebase; CSV data is committed)
