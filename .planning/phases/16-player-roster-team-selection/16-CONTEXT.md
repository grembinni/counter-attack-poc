# Phase 16: Player Roster & Team Selection - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate four named team squads (Cosmos, Xolos, City, Crew) and a Free Agent pool from per-team CSV files via a one-time seed script; update `PlayerPiece` with real player identity fields (firstName, lastName, number, nationality); redesign the player card to show name/badge/position/number; and add a server-gated team selection screen where the home player picks first, then the away player picks from the remaining three teams — with the chosen teams stored in `GameState.selectedTeams`.

**Requirements in scope:** PLAY-01, PLAY-02, PLAY-03, SELECT-01

</domain>

<decisions>
## Implementation Decisions

### Player Data Source

- **D-01:** Player CSVs are already in the repo at `packages/shared/src/data/`. One file per team: `cosmos_players.csv`, `xolos_players.csv`, `city_players.csv`, `crew_players.csv`, and `fa_players.csv` (Free Agents). Each team CSV has 11 rows (1 GK + 10 outfield). FA file has 24 players. These files are the source of truth for all squad data.

- **D-02:** A one-time seed script generates `packages/shared/src/teams.ts` from the CSVs. Invoked via `pnpm run seed:rosters` (script defined in `packages/shared/package.json`). After running, `teams.ts` is committed — the script is a dev tool, not a build step. The CSV files stay in the repo.

- **D-03:** CSV team-name → `TeamId` mapping used by the seed script:
  - "Cozmos" → `'cosmos'`
  - "CITY" → `'city'`
  - "Crew" → `'crew'`
  - "Xolos" → `'xolos'`
  - "FA" → `null` (Free Agents; stored in a separate `FREE_AGENTS` export, not in any team squad)

- **D-04:** Jersey numbers assigned sequentially within each squad: GK gets `number: 1`, then remaining 10 players numbered 2–11 in the order they appear in the CSV (GK first in the role sort, then DEF, MID, FWD, ST — matching current `teams.ts` ordering).

- **D-05:** Column mapping for the seed script:
  - `Player` → split into `firstName` (first token) + `lastName` (everything after first space)
  - `Team` → `TeamId` via D-03 mapping
  - `Nationality` → `nationality: string`
  - `Position` → `role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST'`
  - `Pace`, `Dribbling`, `Heading`, `Highpass`, `Resilience`, `Shooting`, `Tackling` → direct attribute fields (lowercase, `Highpass` → `highPass`)
  - `Arial Ability` (note: typo in CSV) → `aerialAbility`; empty/blank → `0` for outfield players
  - `Saving`, `Handling` → `saving`, `handling`; empty/blank → `0` for outfield players

### PlayerPiece Type Changes

- **D-06:** Remove `name: string` from `PlayerPiece`. Replace with:

  ```ts
  firstName: string;
  lastName: string;
  number: number;
  nationality: string;
  ```

  All four fields are required. No fallback `name` field kept.

- **D-07:** `firstName`/`lastName` split rule: first whitespace-delimited token = `firstName`, everything after the first space = `lastName`. Example: "Van De Kerkhof" → `{ firstName: 'Van', lastName: 'De Kerkhof' }`.

- **D-08:** `MiniTokenBadge` in `PlayerStatsPanel.tsx` currently derives the player number as `Number(piece.id.slice(piece.id.lastIndexOf('-') + 1)) + 1`. After this change, it reads `piece.number` directly. Any other code that referenced `piece.name` must be updated to use `piece.firstName + ' ' + piece.lastName` or the appropriate display field.

### Player Card (PLAY-02)

- **D-09:** `PlayerStatsPanel.tsx` header area redesigned to show:
  - Line 1: `piece.firstName`
  - Line 2: `piece.lastName`
  - Line 3: `TeamBadge` (badge icon, ~20px) | `piece.role` | `#${piece.number}`

  The existing `MiniTokenBadge` (jersey token preview) stays; only the text portion of the header changes.

### Team Selection Screen

- **D-10:** Add `'TEAM_SELECTION'` to the `Screen` union in `useGameStore.ts`. After slot 2 joins, the server emits a `team:selection-start` event to both clients instead of broadcasting the initial game state. Both clients transition to `TEAM_SELECTION` screen.

- **D-11:** New Socket.io events for team selection:
  - Server → Client (broadcast): `team:selection-start` — both clients enter TEAM_SELECTION screen; home player's cards are active, away player's cards are all disabled
  - Client → Server: `team:pick { teamId: TeamId }` — sent by the active player when they confirm their choice
  - Server → Client (broadcast): `team:home-picked { teamId: TeamId }` — after home confirms; away player's 3 remaining cards become active; home's chosen card is struck-out on away's view
  - After away picks: server calls `buildInitialGameState(roomCode, selectedTeams)` and broadcasts the initial `GameState`; both clients transition to `GAME_BOARD`

- **D-12:** Team selection screen layout — 4 team cards in a 2×2 grid. Each card shows:
  - Full-size badge image (`{teamid}-full.png`) at ~100–120px
  - Team name below the badge
  - Primary color accent on the card border/background tint

  Home player's cards are clickable. Away player's cards are disabled (greyed) until home confirms. After home picks, their chosen card is visually struck-out on away's screen; the remaining 3 become active.

- **D-13:** Full-size badge images are at `packages/client/src/assets/badges/{teamid}-full.png` (files already present in repo: `cosmos-full.png`, `xolos-full.png`, `city-full.png`, `crew-full.png`). These are used only on the selection screen. The regular badge images (`{teamid}.png`) continue to be used in the scoreboard and player card.

- **D-14:** The TEAM_SELECTION screen manages its own local React state (which team home picked, whose turn it is). There is no `gameState` in the Zustand store during this screen — it arrives only when the server broadcasts the initial KICK_OFF state.

### Selected Teams in GameState

- **D-15:** Add `selectedTeams: { home: TeamId; away: TeamId }` to `GameState` type in `packages/shared/src/types.ts`.

- **D-16:** `buildInitialGameState` signature changes: `buildInitialGameState(roomCode: string, selectedTeams: { home: TeamId; away: TeamId }): GameState`. The selections are embedded in the initial state object and carried in every subsequent snapshot.

- **D-17:** `packages/client/src/teamDefaults.ts` is deleted. All client components that currently import `TEAM_DEFAULTS` switch to reading `gameState.selectedTeams[piece.teamId]` from Zustand. Affected files: `PieceOverlay.tsx`, `GameBoard.tsx`, `ActionLog.tsx`, `PlayerStatsPanel.tsx`.

### Claude's Discretion

- **Team id accessor pattern:** `TEAM_DEFAULTS` replacement uses direct Zustand reads: `const selectedTeams = useGameStore(s => s.gameState.selectedTeams)`. No new hook or selector abstraction — keeps the pattern consistent with existing per-slice Zustand selectors in the codebase.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — PLAY-01, PLAY-02, PLAY-03, SELECT-01 requirements (player roster, player card redesign, Free Agents, team selection screen)
- `.planning/ROADMAP.md` — Phase 16 success criteria (5 items defining squad population, Free Agent exclusion, player card layout, selection turn order, team propagation)

### Prior Phase Context

- `.planning/phases/15-team-identity/15-CONTEXT.md` — Locked decisions from Phase 15: `TeamId` union, `TeamConfig`, `TEAM_CONFIGS`, `TeamBadge` component, `TEAM_DEFAULTS` (to be deleted in this phase), badge file naming convention, D-05 note that Phase 16 replaces TEAM_DEFAULTS with dynamic selection

### Shared Types to Modify

- `packages/shared/src/types.ts` — `PlayerPiece` type (add firstName/lastName/number/nationality, remove name); `GameState` (add selectedTeams field)
- `packages/shared/src/teamConfig.ts` — `TeamId` union and `TEAM_CONFIGS` (read-only in this phase; no changes needed)
- `packages/shared/src/teams.ts` — `HOME_SQUAD` / `AWAY_SQUAD` (will be replaced by seed script output; four named squads + FREE_AGENTS)

### Player Data

- `packages/shared/src/data/cosmos_players.csv` — Cosmos squad (11 players)
- `packages/shared/src/data/xolos_players.csv` — Xolos squad (11 players)
- `packages/shared/src/data/city_players.csv` — City squad (11 players)
- `packages/shared/src/data/crew_players.csv` — Crew squad (11 players)
- `packages/shared/src/data/fa_players.csv` — Free Agents (24 players; PLAY-03: stored, not selectable)

### Client Components to Modify

- `packages/client/src/components/PlayerStatsPanel.tsx` — player card header redesign (D-09); MiniTokenBadge number derivation (D-08); TEAM_DEFAULTS → selectedTeams (D-17)
- `packages/client/src/components/PieceOverlay.tsx` — TEAM_DEFAULTS → selectedTeams (D-17)
- `packages/client/src/components/GameBoard.tsx` — TEAM_DEFAULTS → selectedTeams (D-17)
- `packages/client/src/components/ActionLog.tsx` — TEAM_DEFAULTS → selectedTeams (D-17)
- `packages/client/src/teamDefaults.ts` — DELETE this file (D-17)

### Server Files to Modify

- `packages/server/src/roomHandlers.ts` — after slot 2 joins, emit `team:selection-start` instead of calling `buildInitialGameState` immediately; add `team:pick` handler; add `team:home-picked` broadcast; call `buildInitialGameState` only after both picks
- `packages/server/src/gameEngine.ts` — update `buildInitialGameState` signature to accept `selectedTeams` param (D-16)
- `packages/shared/src/events.ts` — add new socket events: `team:selection-start`, `team:pick`, `team:home-picked`

### New Files to Create

- `packages/shared/scripts/seed-rosters.ts` — one-time seed script; invoked via `pnpm run seed:rosters`
- `packages/client/src/components/TeamSelectionScreen.tsx` — team selection UI (D-10 through D-14)
- `packages/client/src/components/TeamSelectionScreen.module.css` — styles for selection screen

### Badge Assets

- `packages/client/src/assets/badges/cosmos-full.png` — full-size badge for selection screen (already in repo)
- `packages/client/src/assets/badges/xolos-full.png` — full-size badge for selection screen (already in repo)
- `packages/client/src/assets/badges/city-full.png` — full-size badge for selection screen (already in repo)
- `packages/client/src/assets/badges/crew-full.png` — full-size badge for selection screen (already in repo)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/client/src/components/TeamBadge.tsx` — renders `<img src={badgePath} />` from badge PNG; accepts a `size` prop. Reuse in the player card (D-09, ~20px) and on the selection screen cards (D-12, ~100–120px, via a `fullSize` prop or explicit `size` value).
- `packages/shared/src/teamConfig.ts` `TEAM_CONFIGS` — provides `primaryColor`, `name`, `badgeFile` per `TeamId`. Use for card border tinting and team name display on the selection screen.

### Established Patterns

- `piece.teamId` is positional (`'home' | 'away'`), not a `TeamId`. Actual team name is derived via `gameState.selectedTeams[piece.teamId]`. All code that currently uses `TEAM_DEFAULTS[piece.teamId]` must switch to this pattern (D-17).
- Per-piece SVG def ids (e.g., `mini-home-gk-checker-${piece.id}`) prevent id collisions across multiple pieces on the same page. Preserve this pattern; `piece.id` continues to be the positional id (`home-0` .. `home-10`).
- `playerSlot === 1` → home team; `playerSlot === 2` → away team. Used in `gameHandlers.ts:socketTeam()` and in `useGameStore.ts` to determine `myTeam`. No change to this mapping in Phase 16.
- `isProcessing` mutex on all game handlers — any new `team:pick` handler on the server must follow the same pattern.
- Screen routing in `App.tsx`: currently `GAME_BOARD | REPLAY → <GameBoard />`, everything else → `<LobbyScreen />`. The new `TEAM_SELECTION` screen needs its own branch (or the LobbyScreen branch can render TeamSelectionScreen conditionally).

### Integration Points

- `packages/server/src/roomHandlers.ts` `joinRoom` handler (~line 128): currently calls `buildInitialGameState` immediately after slot 2 joins and broadcasts state. Phase 16 changes this to emit `team:selection-start` instead and delay game state creation until both teams are chosen.
- `packages/client/src/store/useGameStore.ts`: `screen` state and `setScreen` action drive all screen transitions. Add `'TEAM_SELECTION'` and wire the `team:selection-start` / `team:home-picked` socket event handlers (alongside existing handlers in the `useEffect` block in `App.tsx`).
- `packages/shared/src/events.ts`: typed Socket.io events. Any new events (`team:selection-start`, `team:pick`, `team:home-picked`) must be added here so both client and server share the same typed event interface.
- Starting positions in the CSV-generated squads must use the same board coordinates as the current `HOME_SQUAD`/`AWAY_SQUAD` (real 37×26 grid). The seed script assigns positions by role from the hardcoded formation coordinates in the existing `teams.ts` comment block — it does NOT derive positions from the CSV.

</code_context>

<specifics>
## Specific Ideas

- **Full-size badge on selection screen:** User explicitly asked for the `-full.png` variants (e.g., `cosmos-full.png`) on the team selection cards — not the smaller `cosmos.png` used in the scoreboard.
- **Player name split edge case:** "Van De Kerkhof" → `firstName: 'Van'`, `lastName: 'De Kerkhof'`. The seed script splits on the first space only.
- **CSV column typo:** The CSV has "Arial Ability" (not "Aerial Ability"). The seed script must map this exact header string to `aerialAbility`.
- **GK positions:** GK piece starting position is always `{ q: 1, r: 13 }` (home) and `{ q: 35, r: 13 }` (away). The seed script assigns this from the formation constants, not from the CSV.
- **Free Agents not selectable:** `fa_players.csv` players are exported as a `FREE_AGENTS` array from `teams.ts` but never shown in the team selection UI. PLAY-03 explicitly defers FA use to future milestones.

</specifics>

<deferred>
## Deferred Ideas

- **Free Agent selection in future match modes** — PLAY-03 stores them; using them (e.g., custom lineup builder) is v2+.
- **Jersey number column in CSV** — Numbers are sequentially assigned in this phase. If real shirt numbers are needed, the CSV would need a `Number` column in a future pass.
- **Reconnection during TEAM_SELECTION phase** — If a player drops during team selection, the reconnect flow (90s grace timer) may need extension. Not handled in Phase 16.
- **Rematch with same teams** — After FULL_TIME, a rematch would need to replay team selection or remember the prior selection. Deferred to when rematch flow is implemented (v2).

</deferred>

---

_Phase: 16-player-roster-team-selection_
_Context gathered: 2026-06-13_
