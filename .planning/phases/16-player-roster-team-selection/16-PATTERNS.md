# Phase 16: Player Roster & Team Selection - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 16
**Analogs found:** 14 / 16

## File Classification

| New/Modified File                                               | Role           | Data Flow                   | Closest Analog                                 | Match Quality                         |
| --------------------------------------------------------------- | -------------- | --------------------------- | ---------------------------------------------- | ------------------------------------- |
| `packages/shared/scripts/seed-rosters.ts`                       | utility/script | transform (CSV → TS source) | none                                           | no analog                             |
| `packages/shared/src/teams.ts` (replace)                        | data           | static export               | existing `teams.ts`                            | exact (same file, replace shape)      |
| `packages/shared/src/types.ts` (modify)                         | model          | —                           | existing `types.ts`                            | exact (same file, additive change)    |
| `packages/shared/src/events.ts` (modify)                        | model          | event-driven                | existing `events.ts`                           | exact (same file, additive change)    |
| `packages/shared/src/teamConfig.ts`                             | model          | —                           | existing `teamConfig.ts`                       | read-only, no changes                 |
| `packages/server/src/roomHandlers.ts` (modify)                  | handler        | request-response            | existing `roomHandlers.ts`                     | exact (same file, extend slot-2 join) |
| `packages/server/src/gameEngine.ts` (modify)                    | service        | transform                   | existing `gameEngine.ts`                       | exact (same file, signature change)   |
| `packages/client/src/components/TeamSelectionScreen.tsx`        | component      | event-driven                | `LobbyScreen.tsx` + `App.tsx`                  | role-match                            |
| `packages/client/src/components/TeamSelectionScreen.module.css` | config         | —                           | `PlayerStatsPanel.module.css`                  | role-match                            |
| `packages/client/src/store/useGameStore.ts` (modify)            | store          | event-driven                | existing `useGameStore.ts`                     | exact (same file, additive)           |
| `packages/client/src/App.tsx` (modify)                          | component      | event-driven                | existing `App.tsx`                             | exact (same file, additive)           |
| `packages/client/src/components/PlayerStatsPanel.tsx` (modify)  | component      | request-response            | existing `PlayerStatsPanel.tsx`                | exact                                 |
| `packages/client/src/components/PieceOverlay.tsx` (modify)      | component      | request-response            | `PlayerStatsPanel.tsx` (TEAM_DEFAULTS pattern) | role-match                            |
| `packages/client/src/components/GameBoard.tsx` (modify)         | component      | request-response            | `PlayerStatsPanel.tsx` (TEAM_DEFAULTS pattern) | role-match                            |
| `packages/client/src/components/ActionLog.tsx` (modify)         | component      | request-response            | existing `ActionLog.tsx`                       | exact                                 |
| `packages/client/src/teamDefaults.ts`                           | utility        | —                           | —                                              | DELETE                                |

---

## Pattern Assignments

### `packages/shared/scripts/seed-rosters.ts` (utility, transform)

**Analog:** No close codebase analog. Use RESEARCH.md Pattern 1 directly.

**Import pattern** (derive from Node.js built-ins only):

```typescript
import { createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
```

**CSV parse pattern** (RESEARCH.md Pattern 1):

```typescript
async function parseCSV(filePath: string): Promise<string[][]> {
  const rl = createInterface({ input: createReadStream(filePath) });
  const rows: string[][] = [];
  for await (const line of rl) {
    rows.push(line.split(',').map((s) => s.trim()));
  }
  return rows;
}
```

**Column index pattern** (header row → index map, avoids positional fragility):

```typescript
// Build index map from header row
const header = rows[0];
const idx: Record<string, number> = {};
for (let i = 0; i < header.length; i++) idx[header[i]] = i;
// Access: rows[n][idx['Arial Ability']]  ← exact typo preserved from CSV
```

**Jersey number assignment pattern** (RESEARCH.md Pattern 2):

```typescript
const ROLE_ORDER = ['GK', 'DEF', 'MID', 'FWD', 'ST'] as const;
const sorted = players.sort(
  (a, b) =>
    ROLE_ORDER.indexOf(a.role as (typeof ROLE_ORDER)[number]) -
    ROLE_ORDER.indexOf(b.role as (typeof ROLE_ORDER)[number]),
);
sorted.forEach((p, i) => {
  p.number = i + 1;
});
```

**Position/role mapping** (critical: STR → ST, per RESEARCH.md Pitfall 2):

```typescript
const ROLE_MAP: Record<string, PlayerPiece['role']> = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
  ST: 'ST',
  STR: 'ST', // city_players.csv and crew_players.csv use 'STR'
};
```

**GK attribute overrides** (RESEARCH.md Pitfalls 3 & 4):

```typescript
if (role === 'GK') {
  highPass = 0; // forced, regardless of CSV value (D-04)
  heading = 0; // GKs use aerialAbility instead
}
// Blank cells → 0 for all non-applicable attributes:
const toInt = (s: string) => (s === '' ? 0 : parseInt(s, 10));
```

**Output file write pattern** (string template, no template engine):

```typescript
const out = `import type { PlayerPiece } from './types.js';

export const TEAM_SQUADS: Record<TeamId, readonly PlayerPiece[]> = {
  cosmos: [${cosmosRows}],
  xolos: [${xolosRows}],
  city: [${cityRows}],
  crew: [${crewRows}],
};

export const FREE_AGENTS: readonly PlayerPiece[] = [${faRows}];
`;
writeFileSync(outputPath, out, 'utf-8');
```

---

### `packages/shared/src/teams.ts` (replace — seed script output)

**Analog:** Current `packages/shared/src/teams.ts` lines 1–60.

**Import pattern** (lines 1–2):

```typescript
import type { PlayerPiece } from './types.js';
```

**Export shape** (from RESEARCH.md Code Examples, replacing HOME_SQUAD/AWAY_SQUAD):

```typescript
// Replace HOME_SQUAD / AWAY_SQUAD exports with:
export const TEAM_SQUADS: Record<TeamId, readonly PlayerPiece[]> = {
  cosmos: [
    /* 11 players */
  ],
  xolos: [
    /* 11 players */
  ],
  city: [
    /* 11 players */
  ],
  crew: [
    /* 11 players */
  ],
};

export const FREE_AGENTS: readonly PlayerPiece[] = [
  /* 24 players */
];
```

**Per-player shape** (matches updated `PlayerPiece` after D-06 — no `name` field):

```typescript
{
  id: 'home-0',       // positional id — always 'home-N'; buildInitialGameState assigns 'away-N'
  teamId: 'home',     // placeholder; overridden at runtime
  firstName: 'Vinicius',
  lastName: 'Eubsinno',
  number: 1,          // GK always 1; others 2–11 in ROLE_ORDER
  nationality: 'Brazil',
  role: 'GK',
  position: { q: 1, r: 13 },   // from formation constants, NOT from CSV
  pace: 5, shooting: 1, tackling: 0, dribbling: 3, heading: 0,
  saving: 4, handling: 4, resilience: 6, aerialAbility: 6,
  highPass: 0,        // GK: always 0 (D-04)
}
```

**Formation position constants** (copy from existing `teams.ts` comment block, lines 26–34):

```
GK:  home q=1  r=13  /  away q=35 r=13
DEF: home q=6  r=6,13,19 / away q=30 r=6,13,19
MID: home q=10 r=9,17    / away q=26 r=9,17
FWD: home q=15 r=4,9,17,22 / away q=21 r=4,9,17,22
ST:  overridden by coin flip in buildInitialGameState
```

**Key:** The seed script stores home-side positions only for all 4 squads. `buildInitialGameState` mirrors away positions at runtime via `q_away = 36 - q_home`.

---

### `packages/shared/src/types.ts` (modify — additive)

**Analog:** `packages/shared/src/types.ts` lines 3–27 (PlayerPiece), lines 310–491 (GameState).

**PlayerPiece change** (lines 3–27 — remove `name`, add four fields):

```typescript
// REMOVE:
/** Player display name (e.g. 'Home GK', 'Away FWD 1'). TEAM-02 */
name: string;

// ADD (after existing fields, before role):
firstName: string;
lastName: string;
number: number;
nationality: string;
```

**GameState addition** (add after `kickOffActive: boolean` at line ~370):

```typescript
/** Phase 16 D-15: teams selected before match start. */
selectedTeams: {
  home: TeamId;
  away: TeamId;
}
```

**Import addition** (add `TeamId` to shared type imports at top of types.ts):

```typescript
import type { TeamId } from './teamConfig.js';
```

---

### `packages/shared/src/events.ts` (modify — additive)

**Analog:** `packages/shared/src/events.ts` lines 7–57 (existing const objects and interface pattern).

**ServerEvents addition** (after line 57, same `as const` pattern):

```typescript
export const ServerEvents = {
  // ... existing ...
  TEAM_SELECTION_START: 'team:selection-start',
  TEAM_HOME_PICKED: 'team:home-picked',
} as const;
```

**ClientEvents addition**:

```typescript
export const ClientEvents = {
  // ... existing ...
  TEAM_PICK: 'team:pick',
} as const;
```

**ServerToClientEvents interface additions** (after line 126, same typed-callback pattern):

```typescript
[ServerEvents.TEAM_SELECTION_START]: () => void;
[ServerEvents.TEAM_HOME_PICKED]: (teamId: TeamId) => void;
```

**ClientToServerEvents interface addition** (after line 113):

```typescript
[ClientEvents.TEAM_PICK]: (teamId: TeamId) => void;
```

**Note:** `TeamId` import must be added to `events.ts` imports (line 1 currently only imports `HexCoord` and `GameState`):

```typescript
import type { HexCoord, GameState, TeamId } from './types.js';
// OR import TeamId from teamConfig.js — follow whichever pattern shared barrel uses
```

---

### `packages/server/src/roomHandlers.ts` (modify — extend slot-2 join path)

**Analog:** `packages/server/src/roomHandlers.ts` lines 107–151 (ROOM_JOIN handler).

**isProcessing mutex pattern** (from `gameHandlers.ts` lines 212–253 — copy exactly):

```typescript
if (!room || room.isProcessing) return; // SC-5: drop duplicate silently
room.isProcessing = true;
try {
  // ... handler body ...
} finally {
  room.isProcessing = false; // MUST be in finally
}
```

**Slot-2 join change** (lines 147–150 — replace `broadcastState` with `team:selection-start`):

```typescript
// BEFORE (line 148-150):
const room = getRoom(normalizedCode);
if (room) {
  broadcastState(io, room);
}

// AFTER (Phase 16):
const room = getRoom(normalizedCode);
if (room) {
  io.to(normalizedCode).emit(ServerEvents.TEAM_SELECTION_START);
  // Do NOT call broadcastState — no GameState exists yet (D-10)
}
```

**team:pick handler** (new handler, same socket.on pattern as existing handlers):

```typescript
socket.on(ClientEvents.TEAM_PICK, (teamId: TeamId) => {
  const { roomCode, playerSlot } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5 mutex

  room.isProcessing = true;
  try {
    // Validate teamId is a known TeamId
    if (!(['cosmos', 'xolos', 'city', 'crew'] as const).includes(teamId)) {
      socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TEAM');
      return;
    }

    if (playerSlot === 1 && room.homePickedTeam === undefined) {
      // Home picks first
      room.homePickedTeam = teamId;
      io.to(roomCode).emit(ServerEvents.TEAM_HOME_PICKED, teamId);
    } else if (playerSlot === 2 && room.homePickedTeam !== undefined) {
      // Away picks from remaining 3; must not pick same as home
      if (teamId === room.homePickedTeam) {
        socket.emit(ServerEvents.GAME_ERROR, 'TEAM_ALREADY_PICKED');
        return;
      }
      const selectedTeams = { home: room.homePickedTeam, away: teamId };
      room.gameState = buildInitialGameState(roomCode, selectedTeams);
      broadcastState(io, room); // both clients → GAME_BOARD
    } else {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
    }
  } finally {
    room.isProcessing = false;
  }
});
```

**socket.to vs io.to** (from `roomHandlers.ts` line 143 comment): use `io.to(roomCode)` for all team selection broadcasts (all players should see the result). Use `socket.to` only for disconnect warnings that exclude the disconnecting player.

---

### `packages/server/src/gameEngine.ts` (modify — signature change)

**Analog:** `packages/server/src/gameEngine.ts` lines 84–123 (`buildInitialGameState`), lines 129–145 (`buildKickOffPieces`).

**buildInitialGameState new signature** (line 84):

```typescript
// BEFORE:
export function buildInitialGameState(roomCode: string): GameState {
  const pieces = [...HOME_SQUAD, ...AWAY_SQUAD].map((p) => ({ ...p }));

// AFTER:
export function buildInitialGameState(
  roomCode: string,
  selectedTeams: { home: TeamId; away: TeamId },
): GameState {
  const homeSquad = TEAM_SQUADS[selectedTeams.home].map((p) => ({ ...p, teamId: 'home' as const }));
  const awaySquad = TEAM_SQUADS[selectedTeams.away].map((p) => ({
    ...p,
    teamId: 'away' as const,
    position: { q: 36 - p.position.q, r: p.position.r }, // mirror home positions
    id: p.id.replace('home-', 'away-'),
  }));
  const pieces = [...homeSquad, ...awaySquad];
```

**Return object** — add `selectedTeams` field (line ~101, after `kickOffActive: false`):

```typescript
return {
  // ... all existing fields ...
  kickOffActive: false,
  selectedTeams, // D-15: embedded in every subsequent snapshot
};
```

**buildKickOffPieces** (line 129) — same pattern, add selectedTeams param:

```typescript
// BEFORE:
export function buildKickOffPieces(attackingTeam: 'home' | 'away') {
  const pieces = [...HOME_SQUAD, ...AWAY_SQUAD].map((p) => ({ ...p }));

// AFTER:
export function buildKickOffPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
) {
  const homeSquad = TEAM_SQUADS[selectedTeams.home].map((p) => ({ ...p, teamId: 'home' as const }));
  const awaySquad = TEAM_SQUADS[selectedTeams.away].map((p) => ({
    ...p,
    teamId: 'away' as const,
    position: { q: 36 - p.position.q, r: p.position.r },
    id: p.id.replace('home-', 'away-'),
  }));
  const pieces = [...homeSquad, ...awaySquad];
```

---

### `packages/client/src/components/TeamSelectionScreen.tsx` (create)

**Analog:** `packages/client/src/components/TeamBadge.tsx` (static Vite import pattern), `packages/client/src/App.tsx` (socket handler pattern), `packages/client/src/store/useGameStore.ts` (Zustand selector pattern).

**Import pattern** (follow `TeamBadge.tsx` lines 7–18 for static Vite badge imports):

```typescript
import { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { TeamId } from '@counter-attack/shared';
import { TeamBadge } from './TeamBadge.js';
import styles from './TeamSelectionScreen.module.css';

// Full-size badge imports — Vite content-hashes at build time (same pattern as TeamBadge.tsx lines 7-10)
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

const ALL_TEAMS: TeamId[] = ['cosmos', 'xolos', 'city', 'crew'];
```

**Zustand selector pattern** (follow `useGameStore.ts` lines 12 / App.tsx line 11 — per-field selectors):

```typescript
const playerSlot = useGameStore((s) => s.playerSlot);
```

**Props interface** (D-14: local state lives in App.tsx, passed down as props):

```typescript
export function TeamSelectionScreen({
  homePickedTeam,
  onPick,
}: {
  homePickedTeam: TeamId | null;
  onPick: (teamId: TeamId) => void;
});
```

**Active/disabled derivation** (D-11 turn order):

```typescript
const isHomeTurn = homePickedTeam === null;
const iAmHome = playerSlot === 1;
const iAmActive = isHomeTurn ? iAmHome : !iAmHome;
```

**Card render pattern** (2×2 grid, TEAM_CONFIGS for name/color, FULL_BADGE_MAP for image):

```tsx
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
```

---

### `packages/client/src/App.tsx` (modify — add TEAM_SELECTION screen branch)

**Analog:** `packages/client/src/App.tsx` lines 20–85 (entire file — socket handler + render pattern).

**New socket handlers pattern** (follow existing pattern lines 21–67 — named functions, socket.on/off pairs):

```typescript
// Add alongside existing handlers in the useEffect block:
const [homePickedTeam, setHomePickedTeam] = useState<TeamId | null>(null);

function onTeamSelectionStart() {
  setHomePickedTeam(null);
  setScreen('TEAM_SELECTION');
}

function onTeamHomePicked(teamId: TeamId) {
  setHomePickedTeam(teamId);
}

socket.on(ServerEvents.TEAM_SELECTION_START, onTeamSelectionStart);
socket.on(ServerEvents.TEAM_HOME_PICKED, onTeamHomePicked);

// In cleanup return:
socket.off(ServerEvents.TEAM_SELECTION_START, onTeamSelectionStart);
socket.off(ServerEvents.TEAM_HOME_PICKED, onTeamHomePicked);
```

**onPick handler** (emits TEAM_PICK to server):

```typescript
function handleTeamPick(teamId: TeamId) {
  socket.emit(ClientEvents.TEAM_PICK, teamId);
}
```

**Screen routing addition** (line 82 — extend existing ternary):

```tsx
// BEFORE (line 82):
{
  screen === 'GAME_BOARD' || screen === 'REPLAY' ? <GameBoard /> : <LobbyScreen />;
}

// AFTER:
{
  screen === 'GAME_BOARD' || screen === 'REPLAY' ? (
    <GameBoard />
  ) : screen === 'TEAM_SELECTION' ? (
    <TeamSelectionScreen homePickedTeam={homePickedTeam} onPick={handleTeamPick} />
  ) : (
    <LobbyScreen />
  );
}
```

**Pitfall 9 warning:** Every new `socket.on` must have a matching `socket.off` in the cleanup `return`. Missing cleanup causes stale handler accumulation on reconnect.

---

### `packages/client/src/store/useGameStore.ts` (modify — Screen union + emit action)

**Analog:** `packages/client/src/store/useGameStore.ts` lines 22 and 60–147.

**Screen union addition** (line 22):

```typescript
// BEFORE:
export type Screen = 'LANDING' | 'CREATE_ROOM' | 'JOIN_ROOM' | 'WAITING' | 'GAME_BOARD' | 'REPLAY';

// AFTER:
export type Screen =
  | 'LANDING'
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'WAITING'
  | 'TEAM_SELECTION'
  | 'GAME_BOARD'
  | 'REPLAY';
```

**emitTeamPick action** (follow existing emit actions pattern, e.g. `emitReady` at line 581):

```typescript
// In GameStore type:
emitTeamPick: (teamId: TeamId) => void;

// In store implementation:
emitTeamPick: (teamId) => {
  socket.emit(ClientEvents.TEAM_PICK, teamId);
},
```

**Note:** D-14 places `homePickedTeam` local state in `App.tsx`, NOT in the Zustand store. The store only needs the Screen union extension and the `emitTeamPick` action (or the emit can live directly in App.tsx — either is consistent with existing patterns where App.tsx calls `socket.emit` directly for room events).

---

### `packages/client/src/components/PlayerStatsPanel.tsx` (modify)

**Analog:** `packages/client/src/components/PlayerStatsPanel.tsx` lines 1–147 (entire file).

**TEAM_DEFAULTS replacement** (lines 4 and 39 — D-17):

```typescript
// REMOVE import:
import { TEAM_DEFAULTS } from '../teamDefaults.js';

// ADD Zustand selector in PlayerStatsPanel():
const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);

// Replace usage (line 39):
// BEFORE: const teamId = TEAM_DEFAULTS[piece.teamId];
// AFTER:  const teamId = selectedTeams[piece.teamId];
```

**MiniTokenBadge number fix** (line 36 — D-08):

```typescript
// BEFORE:
const playerNumber = String(Number(piece.id.slice(piece.id.lastIndexOf('-') + 1)) + 1);

// AFTER:
const playerNumber = String(piece.number);
```

**Header redesign** (lines 128–136 — D-09):

```tsx
// BEFORE:
<div className={styles.headerText}>
  {piece.name}
  <span className={styles.role}>{piece.role}</span>
</div>

// AFTER:
<div className={styles.headerText}>
  <span className={styles.firstName}>{piece.firstName}</span>
  <span className={styles.lastName}>{piece.lastName}</span>
  <span className={styles.playerMeta}>
    <TeamBadge teamId={selectedTeams[piece.teamId]} size={20} />
    {piece.role}&nbsp;#{piece.number}
  </span>
</div>
```

**Import addition:**

```typescript
import { TeamBadge } from './TeamBadge.js';
```

---

### `packages/client/src/components/ActionLog.tsx` (modify)

**Analog:** `packages/client/src/components/ActionLog.tsx` lines 1–22 (TEAM_DEFAULTS usage).

**TEAM_DEFAULTS replacement** (lines 4 and 11 — D-17):

```typescript
// REMOVE:
import { TEAM_DEFAULTS } from '../teamDefaults.js';

// The pieceColorOf function must now read selectedTeams from Zustand:
// Option A: add selectedTeams param to pieceColorOf
// Option B: convert to a hook (breaks naming convention — avoid)
// Option C: read from store at module level via useGameStore.getState() (matches store subscription pattern)

// Recommended — read inside the component that renders action items and pass down,
// OR call useGameStore.getState() in the helper (matches existing store access in emitMove):
function pieceColorOf(pieceId: string, selectedTeams: { home: TeamId; away: TeamId }): string {
  const positional = pieceId.startsWith('home') ? 'home' : 'away';
  return TEAM_CONFIGS[selectedTeams[positional]].primaryColor;
}
// Then in the ActionLog component: const selectedTeams = useGameStore(s => s.gameState.selectedTeams);
```

---

### `packages/client/src/components/PieceOverlay.tsx` and `GameBoard.tsx` (modify)

**Analog:** `packages/client/src/components/PlayerStatsPanel.tsx` TEAM_DEFAULTS → selectedTeams pattern.

**Pattern to apply in both files** (D-17):

```typescript
// REMOVE in each file:
import { TEAM_DEFAULTS } from '../teamDefaults.js';

// ADD in each component function body:
const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);

// Replace all:  TEAM_DEFAULTS[piece.teamId]
// With:         selectedTeams[piece.teamId]
```

**Safety note** (RESEARCH.md Pattern 5): `PieceOverlay` and `GameBoard` are only rendered when `screen === 'GAME_BOARD' || screen === 'REPLAY'` (App.tsx line 82). At that point `gameState` is always populated by a server broadcast, so `gameState.selectedTeams` will never be `undefined` at render time.

---

## Shared Patterns

### isProcessing Mutex (all new server handlers)

**Source:** `packages/server/src/gameHandlers.ts` lines 212–253
**Apply to:** `team:pick` handler in `roomHandlers.ts`

```typescript
if (!room || room.isProcessing) return; // SC-5: drop duplicate silently
room.isProcessing = true;
try {
  // handler body
} finally {
  room.isProcessing = false; // MUST be in finally — Pitfall 5
}
```

### Socket event handler cleanup (App.tsx useEffect)

**Source:** `packages/client/src/App.tsx` lines 62–77
**Apply to:** All new socket.on calls in App.tsx

```typescript
// Every socket.on in the useEffect must have a matching socket.off in the return:
socket.on(ServerEvents.TEAM_SELECTION_START, onTeamSelectionStart);
socket.on(ServerEvents.TEAM_HOME_PICKED, onTeamHomePicked);

return () => {
  socket.off(ServerEvents.TEAM_SELECTION_START, onTeamSelectionStart);
  socket.off(ServerEvents.TEAM_HOME_PICKED, onTeamHomePicked);
  // ... plus all existing offs
};
```

### Zustand per-field selector

**Source:** `packages/client/src/App.tsx` lines 11–18, `useGameStore.ts` lines 120–121
**Apply to:** `TeamSelectionScreen.tsx`, `PlayerStatsPanel.tsx`, `ActionLog.tsx`, `GameBoard.tsx`, `PieceOverlay.tsx`

```typescript
// One selector per field — avoids over-subscription causing extra re-renders
const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);
const playerSlot = useGameStore((s) => s.playerSlot);
```

### Static Vite badge import (no dynamic require)

**Source:** `packages/client/src/components/TeamBadge.tsx` lines 7–18
**Apply to:** `TeamSelectionScreen.tsx` (full-size badge variant)

```typescript
// Use static import for each badge — Vite content-hashes at build time
// Do NOT: `import(../assets/badges/${teamId}-full.png)` — dynamic imports bypass Vite processing
import cosmosFullBadge from '../assets/badges/cosmos-full.png';
// etc.
const FULL_BADGE_MAP: Record<TeamId, string> = { cosmos: cosmosFullBadge, ... };
```

### io.to vs socket.to broadcast choice

**Source:** `packages/server/src/roomHandlers.ts` lines 138–143 + comment
**Apply to:** `team:pick` handler broadcasts

```typescript
// Use io.to(roomCode).emit for game state updates — ALL room members receive
io.to(roomCode).emit(ServerEvents.TEAM_HOME_PICKED, teamId);

// Use socket.to(roomCode).emit only for notifications that exclude the sender
// (e.g. disconnect warnings — the disconnecting player can't receive anyway)
```

---

## No Analog Found

| File                                                            | Role           | Data Flow | Reason                                                                                                                       |
| --------------------------------------------------------------- | -------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/scripts/seed-rosters.ts`                       | utility/script | transform | No code-generation scripts exist in the codebase; Node.js readline + fs pattern is standard but has no prior example to copy |
| `packages/client/src/components/TeamSelectionScreen.module.css` | config         | —         | CSS module structure follows all existing `.module.css` files; no layout analog for a 2×2 card grid exists yet               |

---

## Metadata

**Analog search scope:** `packages/server/src/`, `packages/client/src/`, `packages/shared/src/`
**Files read:** 15
**Pattern extraction date:** 2026-06-13
