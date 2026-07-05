# Phase 22: Uniform Selection Screen - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 8 (2 new, 6 modified)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File                                                  | Role                     | Data Flow        | Closest Analog                                                         | Match Quality |
| ------------------------------------------------------------------ | ------------------------ | ---------------- | ---------------------------------------------------------------------- | ------------- |
| `packages/client/src/components/UniformSelectionScreen.tsx`        | component                | request-response | `packages/client/src/components/TeamSelectionScreen.tsx`               | exact         |
| `packages/client/src/components/UniformSelectionScreen.module.css` | config (styles)          | —                | `packages/client/src/components/TeamSelectionScreen.module.css`        | exact         |
| `packages/client/src/App.tsx`                                      | component (orchestrator) | request-response | same file (modify)                                                     | self          |
| `packages/client/src/store/useGameStore.ts`                        | store                    | —                | same file (modify)                                                     | self          |
| `packages/server/src/roomHandlers.ts`                              | middleware/handler       | request-response | same file (modify) — `TEAM_PICK` handler block                         | self          |
| `packages/shared/src/events.ts`                                    | config (shared)          | —                | same file (modify) — `TEAM_HOME_PICKED`/`TEAM_SELECTION_START` entries | self          |
| `packages/shared/src/types.ts`                                     | model                    | —                | same file (modify) — `selectedTeams` field                             | self          |
| `packages/shared/src/gameEngine.ts`                                | service                  | —                | same file (modify) — `buildInitialGameState`                           | self          |

---

## Pattern Assignments

### `packages/client/src/components/UniformSelectionScreen.tsx` (component, request-response)

**Analog:** `packages/client/src/components/TeamSelectionScreen.tsx`

**Imports pattern** (lines 10–14):

```typescript
import { useState, useEffect } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import type { GameSpeed, TeamId } from '@counter-attack/shared';
import styles from './TeamSelectionScreen.module.css';
```

For UniformSelectionScreen, extend with:

```typescript
import { UNIFORM_STYLES } from '../styles/uniformStyles.js';
import { UNIFORM_STYLE_META } from '@counter-attack/shared';
import type { UniformStyleId } from '@counter-attack/shared';
import styles from './UniformSelectionScreen.module.css';
```

**Badge imports pattern** (lines 17–31) — all 12 full-badge static Vite imports carry over verbatim:

```typescript
import cityFullBadge from '../assets/badges/city-full.png';
import crewFullBadge from '../assets/badges/crew-full.png';
import laFullBadge from '../assets/badges/la-full.png';
import miamiFullBadge from '../assets/badges/miami-full.png';
import nashvilleFullBadge from '../assets/badges/nashville-full.png';
import seattleFullBadge from '../assets/badges/seattle-full.png';
import canadaFullBadge from '../assets/badges/canada-full.png';
import englandFullBadge from '../assets/badges/england-full.png';
import franceFullBadge from '../assets/badges/france-full.png';
import mexicoFullBadge from '../assets/badges/mexico-full.png';
import spainFullBadge from '../assets/badges/spain-full.png';
import usFullBadge from '../assets/badges/us-full.png';
```

**Team ordering constants** (lines 33–36) — flat layout replaces tabs, ordering preserved:

```typescript
/** MLS first, then International — D-02 flat ordering (no tabs). */
const ALL_TEAMS: TeamId[] = [
  'city',
  'crew',
  'la',
  'miami',
  'nashville',
  'seattle', // MLS
  'canada',
  'england',
  'france',
  'mexico',
  'spain',
  'us', // International
];
```

**Props type pattern** (lines 61–70):

```typescript
type Props = {
  homePickedTeam: TeamId | null;
  homeConfirmedStyle: UniformStyleId | null; // new — received via UNIFORM_HOME_CONFIRMED
  onConfirm: (teamId: TeamId, uniformStyle: UniformStyleId) => void;
  selectedSpeed: GameSpeed;
  onSpeedChange: (speed: GameSpeed) => void;
};
```

**Home-first turn-order pattern** (lines 83–91) — direct analog; adapt for two-phase confirmation:

```typescript
const playerSlot = useGameStore((s) => s.playerSlot);
const isHomeTurn = homePickedTeam === null; // before home has CONFIRMED
const iAmHome = playerSlot === 1;
const iAmActive = isHomeTurn ? iAmHome : !iAmHome;
const heading = iAmHome ? 'Home: choose your team + style' : 'Away: choose your team + style';
```

**Speed selector block** (lines 117–145) — carried over from TeamSelectionScreen unchanged; visible to home only; locked once they confirm.

**Core team card grid render pattern** (lines 167–203):

```tsx
<div className={styles.teamGrid}>
  {ALL_TEAMS.map((teamId) => {
    const isStruckOut = teamId === homePickedTeam;
    const isDisabled = isStruckOut;
    return (
      <button
        key={teamId}
        disabled={isDisabled}
        aria-pressed={teamId === selectedTeam}
        aria-label={`${TEAM_CONFIGS[teamId].name}`}
        className={
          isStruckOut
            ? styles.teamCardStruckOut
            : teamId === selectedTeam
              ? styles.teamCardSelected
              : styles.teamCard
        }
        style={
          teamId === selectedTeam
            ? { borderColor: TEAM_CONFIGS[teamId].palette.homePrime }
            : undefined
        }
        onClick={() => !isDisabled && setSelectedTeam(teamId)}
      >
        <img
          src={FULL_BADGE_MAP[teamId]}
          alt={`${TEAM_CONFIGS[teamId].name} badge`}
          width={80}
          height={80}
        />
      </button>
    );
  })}
</div>
```

**Style tile SVG render pattern** (from UI-SPEC.md SVG Tile Rendering Contract):

```tsx
// Neutral palette used before team is selected (D-05, CONTEXT specifics)
const NEUTRAL_PALETTE: TeamPalette = {
  homePrime: '#555',
  homeAlt: '#ccc',
  homeFont: '#fff',
  awayPrime: '#555',
  awayAlt: '#ccc',
  awayFont: '#fff',
  uiColor: '#555',
};

const ALL_STYLE_IDS = Object.keys(UNIFORM_STYLES) as UniformStyleId[];

// Inside render:
{
  ALL_STYLE_IDS.map((styleId, index) => {
    const n = index + 1;
    const palette = selectedTeam ? TEAM_CONFIGS[selectedTeam].palette : NEUTRAL_PALETTE;
    const result = UNIFORM_STYLES[styleId]({
      cx: 40,
      cy: 40,
      R: 30,
      palette,
      isGK: false,
      pieceId: `style-${n}`,
    });
    const accentColor = selectedTeam ? TEAM_CONFIGS[selectedTeam].palette.homePrime : '#e0e0e0';
    return (
      <button
        key={styleId}
        aria-pressed={styleId === selectedStyle}
        aria-label={UNIFORM_STYLE_META[styleId].name}
        className={styleId === selectedStyle ? styles.styleTileSelected : styles.styleTile}
        style={
          styleId === selectedStyle
            ? { borderColor: accentColor, boxShadow: `0 0 0 2px ${accentColor}` }
            : undefined
        }
        onClick={() => setSelectedStyle(styleId)}
      >
        <svg width={80} height={80} xmlns="http://www.w3.org/2000/svg">
          <defs>{result.patternDef}</defs>
          <circle cx={40} cy={40} r={30} fill={result.fill} />
          {result.overlay}
          <text
            x={40}
            y={44}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fill={selectedTeam ? palette.homeFont : '#fff'}
            pointerEvents="none"
          >
            {n}
          </text>
        </svg>
      </button>
    );
  });
}
```

**Default style pre-selection** — on mount and on team change, pre-select the team's `defaultUniformStyle`:

```typescript
useEffect(() => {
  if (selectedTeam !== null) {
    setSelectedStyle(TEAM_CONFIGS[selectedTeam].defaultUniformStyle);
  }
}, [selectedTeam]);
```

**Opponent banner pattern** (D-11, away only, after home confirms):

```tsx
{
  homeConfirmedStyle !== null && !iAmHome && (
    <div
      role="status"
      className={styles.opponentBanner}
      style={{ borderLeftColor: TEAM_CONFIGS[homePickedTeam!].palette.homePrime }}
    >
      <svg width={48} height={48} className={styles.bannerPiece}>
        {/* render home's confirmed piece at cx=24 cy=24 R=20 */}
      </svg>
      <span className={styles.bannerText}>Opponent confirmed</span>
    </div>
  );
}
```

**Confirm button pattern** (D-06):

```tsx
{
  !hasConfirmed ? (
    <button
      className={styles.confirmButton}
      disabled={selectedTeam === null || selectedStyle === null}
      aria-disabled={selectedTeam === null || selectedStyle === null}
      aria-label="Confirm team and style selection"
      onClick={() => {
        if (selectedTeam && selectedStyle) {
          onConfirm(selectedTeam, selectedStyle);
          setHasConfirmed(true);
        }
      }}
    >
      Confirm selection
    </button>
  ) : (
    <p className={styles.statusLine}>Waiting for opponent...</p>
  );
}
```

---

### `packages/client/src/components/UniformSelectionScreen.module.css` (CSS module)

**Analog:** `packages/client/src/components/TeamSelectionScreen.module.css`

**Root screen class** (lines 7–16) — copy verbatim; applies to new screen:

```css
.screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #1a1a2e;
  gap: 16px;
  padding: 24px;
}
```

**Typography classes** (lines 18–33) — copy `.heading` and `.statusLine` verbatim:

```css
.heading {
  font-size: 20px;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
  line-height: 1.2;
}
.statusLine {
  font-size: 13px;
  font-weight: 400;
  color: #a0a0a0;
  margin: 0;
}
```

**Team grid** — new class replacing `.grid` (3-col) with 6-col flat layout (D-02):

```css
.teamGrid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  max-width: 800px;
  width: 100%;
}
@media (max-width: 760px) {
  .teamGrid {
    grid-template-columns: repeat(3, 1fr);
    max-width: 420px;
  }
}
```

**Team card states** — adapted from `.card` / `.cardStruckOut` (lines 84–128):

```css
.teamCard {
  border: 2px solid #0f3460;
  border-radius: 4px;
  background: #16213e;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  min-width: 100px;
  min-height: 120px;
  transition:
    box-shadow 0.15s ease,
    opacity 0.15s ease;
}
.teamCard:hover:not(:disabled) {
  box-shadow: 0 0 0 2px currentColor;
}
.teamCardSelected {
  /* inherits .teamCard structure; border-color set inline via palette.homePrime */
  border-width: 3px;
}
.teamCardStruckOut {
  /* copy of .cardStruckOut */
  border: 2px solid #0f3460;
  border-radius: 4px;
  background: #16213e;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: not-allowed;
  min-width: 100px;
  min-height: 120px;
  opacity: 0.4;
}
```

**Style tile grid** (D-03, D-10):

```css
.styleGrid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  max-width: 560px;
  width: 100%;
}
.styleTile {
  width: 80px;
  height: 80px;
  border: 1px solid #0f3460;
  border-radius: 4px;
  background: #16213e;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 0.15s ease;
}
.styleTile:hover:not(:disabled) {
  box-shadow: 0 0 0 1px #a0a0a0;
}
/* border-color and box-shadow set inline via palette */
.styleTileSelected {
  width: 80px;
  height: 80px;
  border: 3px solid;
  border-radius: 4px;
  background: #16213e;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

**Section label**:

```css
.sectionLabel {
  font-size: 14px;
  font-weight: 700;
  color: #a0a0a0;
  margin: 0;
  align-self: flex-start;
  max-width: 560px;
  width: 100%;
}
```

**Opponent banner** (D-11):

```css
.opponentBanner {
  max-width: 560px;
  width: 100%;
  background: #16213e;
  border-left: 3px solid; /* color set inline via palette.homePrime */
  border-radius: 4px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.bannerText {
  font-size: 13px;
  font-weight: 700;
  color: #e0e0e0;
}
```

**Confirm button**:

```css
.confirmButton {
  font-size: 13px;
  font-weight: 700;
  color: #e0e0e0;
  background: #0f3460;
  border: none;
  border-radius: 4px;
  padding: 8px 20px;
  cursor: pointer;
  min-width: 160px;
  transition: opacity 0.15s ease;
}
.confirmButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Speed selector classes** (lines 145–240) — copy the entire `.speedSelector`, `.speedOptions`, `.speedOption`, `.speedOptionActive`, `.speedColorSlow`, `.speedColorStandard`, `.speedColorFast`, `.speedIcon` blocks verbatim from `TeamSelectionScreen.module.css`.

---

### `packages/client/src/App.tsx` (orchestrator, request-response)

**Analog:** same file — extend the existing socket `useEffect` block.

**Existing socket handler registration pattern** (lines 26–104) — every `socket.on` has a matching `socket.off` in the cleanup return; all handlers defined as named functions inside `useEffect`:

```typescript
useEffect(() => {
  function onUniformSelectionStart() {
    setScreen('UNIFORM_SELECTION');
  }

  function onUniformHomeConfirmed(teamId: TeamId, uniformStyle: UniformStyleId) {
    setHomeConfirmedStyle(uniformStyle);
    // homePickedTeam already set from TEAM_HOME_PICKED; no second state needed for teamId
  }

  socket.on(ServerEvents.UNIFORM_SELECTION_START, onUniformSelectionStart);
  socket.on(ServerEvents.UNIFORM_HOME_CONFIRMED, onUniformHomeConfirmed);

  return () => {
    socket.off(ServerEvents.UNIFORM_SELECTION_START, onUniformSelectionStart);
    socket.off(ServerEvents.UNIFORM_HOME_CONFIRMED, onUniformHomeConfirmed);
  };
}, []);
```

**Local state pattern** (lines 22–24) — add alongside `homePickedTeam`:

```typescript
const [homePickedTeam, setHomePickedTeam] = useState<TeamId | null>(null);
const [selectedSpeed, setSelectedSpeed] = useState<GameSpeed>('standard');
// NEW:
const [homeConfirmedStyle, setHomeConfirmedStyle] = useState<UniformStyleId | null>(null);
```

**Screen routing pattern** (lines 118–133) — add `UNIFORM_SELECTION` branch:

```tsx
return (
  <div className={styles.app}>
    {screen === 'GAME_BOARD' || screen === 'REPLAY' ? (
      <GameBoard />
    ) : screen === 'UNIFORM_SELECTION' ? (
      <UniformSelectionScreen
        homePickedTeam={homePickedTeam}
        homeConfirmedStyle={homeConfirmedStyle}
        onConfirm={handleUniformConfirm}
        selectedSpeed={selectedSpeed}
        onSpeedChange={handleSpeedChange}
      />
    ) : screen === 'TEAM_SELECTION' ? (
      <TeamSelectionScreen ... />
    ) : (
      <LobbyScreen />
    )}
  </div>
);
```

**Emit handler pattern** (lines 107–116) — new handler mirrors `handleTeamPick`:

```typescript
function handleUniformConfirm(teamId: TeamId, uniformStyle: UniformStyleId) {
  socket.emit(ClientEvents.UNIFORM_CONFIRM, teamId, uniformStyle);
}
```

---

### `packages/client/src/store/useGameStore.ts` (store)

**Analog:** same file — `Screen` type (lines 22–30).

**Screen union extension pattern** (lines 22–30):

```typescript
export type Screen =
  | 'LANDING'
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'WAITING'
  | 'TEAM_SELECTION'
  | 'UNIFORM_SELECTION' // Phase 22: combined team + style pre-game screen
  | 'GAME_BOARD'
  | 'REPLAY';
```

No new store actions required — `setScreen` already handles all screen values.

---

### `packages/server/src/roomHandlers.ts` (handler, request-response)

**Analog:** same file — `TEAM_PICK` handler (lines 182–244).

**Allow-list validation pattern** (lines 40–53, 196–197) — new `UNIFORM_CONFIRM` handler must add a `VALID_UNIFORM_STYLE_IDS` allow-list and validate payload:

```typescript
/** Valid uniform style IDs — allow-list for UNIFORM_CONFIRM validation. */
const VALID_UNIFORM_STYLE_IDS: readonly UniformStyleId[] = Object.keys(
  UNIFORM_STYLES,
) as UniformStyleId[];
```

**isProcessing mutex pattern** (lines 189–192, 241–243) — copy exactly for `UNIFORM_CONFIRM`:

```typescript
if (room.isProcessing) return;
room.isProcessing = true;
try {
  // ... handler logic
} finally {
  room.isProcessing = false;
}
```

**Home-first turn-order enforcement pattern** (lines 200–213):

```typescript
// In UNIFORM_CONFIRM handler:
if (room.homePickedUniformStyle === undefined) {
  // Home confirms first — only slot 1 may act
  if (playerSlot !== 1) {
    socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
    return;
  }
  room.homePickedUniformStyle = uniformStyle;
  io.to(roomCode).emit(ServerEvents.UNIFORM_HOME_CONFIRMED, teamId, uniformStyle);
} else {
  // Away confirms second — only slot 2 may act
  if (playerSlot !== 2) {
    socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
    return;
  }
  // Build game state with both teams and both uniform styles
  const selectedTeams = { home: room.homePickedTeam!, away: teamId };
  const selectedUniformStyles = { home: room.homePickedUniformStyle, away: uniformStyle };
  let gameState: GameState;
  try {
    gameState = buildInitialGameState(
      roomCode,
      selectedTeams,
      room.gameSpeed ?? 'standard',
      selectedUniformStyles,
    );
  } catch (err) {
    console.error('buildInitialGameState failed:', err);
    socket.emit(ServerEvents.GAME_ERROR, 'SERVER_ERROR');
    return;
  }
  room.gameState = gameState;
  broadcastState(io, room);
}
```

**TEAM_PICK away-branch replacement** — current lines 215–239 build game state; replace the `else` body with:

```typescript
} else {
  if (playerSlot !== 2) {
    socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
    return;
  }
  if (teamId === room.homePickedTeam) {
    socket.emit(ServerEvents.GAME_ERROR, 'TEAM_ALREADY_PICKED');
    return;
  }
  // Phase 22: defer game state build — store away's team and broadcast UNIFORM_SELECTION_START
  room.awayPickedTeam = teamId;
  io.to(roomCode).emit(ServerEvents.UNIFORM_SELECTION_START);
}
```

**Room type extension** — `roomStore.ts` `Room` type needs new optional fields:

```typescript
homePickedUniformStyle?: UniformStyleId;
awayPickedTeam?: TeamId;       // was built inline before; now stored
```

---

### `packages/shared/src/events.ts` (shared config)

**Analog:** same file — `TEAM_HOME_PICKED` / `TEAM_SELECTION_START` entries (lines 75–80).

**ClientEvents extension pattern** (lines 8–66) — const object, no enum:

```typescript
export const ClientEvents = {
  // ... existing entries ...
  /** Phase 22 D-14: client emits chosen team + uniform style to confirm selection. */
  UNIFORM_CONFIRM: 'uniform:confirm',
} as const;
```

**ServerEvents extension pattern** (lines 68–80):

```typescript
export const ServerEvents = {
  // ... existing entries ...
  /** Phase 22 D-13: emitted to both players after away's TEAM_PICK; signals uniform selection phase start. */
  UNIFORM_SELECTION_START: 'uniform:selection-start',
  /** Phase 22 D-15: emitted to both players after home confirms team + style. */
  UNIFORM_HOME_CONFIRMED: 'uniform:home-confirmed',
} as const;
```

**ClientToServerEvents interface extension** (lines 86–146):

```typescript
/** Phase 22 D-14: home or away player confirms their team + uniform style. Validated server-side. */
[ClientEvents.UNIFORM_CONFIRM]: (teamId: TeamId, uniformStyle: UniformStyleId) => void;
```

**ServerToClientEvents interface extension** (lines 152–165):

```typescript
/** Phase 22 D-13: signals both players that uniform selection has begun. No payload. */
[ServerEvents.UNIFORM_SELECTION_START]: () => void;
/** Phase 22 D-15: informs both players which team + style home player confirmed. */
[ServerEvents.UNIFORM_HOME_CONFIRMED]: (teamId: TeamId, uniformStyle: UniformStyleId) => void;
```

---

### `packages/shared/src/types.ts` (model)

**Analog:** same file — `selectedTeams` field (line 477–478).

**GameState field extension pattern** — follow the JSDoc + field pattern of `selectedTeams`:

```typescript
/** Phase 16 D-15: teams selected before match start, embedded in every GameState snapshot. */
selectedTeams: {
  home: TeamId;
  away: TeamId;
}
/** Phase 22 D-16: uniform styles selected before match start, parallel to selectedTeams. */
selectedUniformStyles: {
  home: UniformStyleId;
  away: UniformStyleId;
}
```

Place `selectedUniformStyles` immediately after `selectedTeams` in the type declaration.

---

### `packages/shared/src/gameEngine.ts` (service)

**Analog:** same file — `buildInitialGameState` function (lines 149–173).

**Current signature** (line 149–152):

```typescript
export function buildInitialGameState(
  roomCode: string,
  selectedTeams: { home: TeamId; away: TeamId },
  gameSpeed: GameSpeed = 'standard',
): GameState {
```

**Updated signature pattern** — add `selectedUniformStyles` as a required 4th parameter (no default; must be supplied after Phase 22):

```typescript
export function buildInitialGameState(
  roomCode: string,
  selectedTeams: { home: TeamId; away: TeamId },
  gameSpeed: GameSpeed = 'standard',
  selectedUniformStyles: { home: UniformStyleId; away: UniformStyleId },
): GameState {
```

**Return object extension** — add `selectedUniformStyles` alongside `selectedTeams` in the returned object literal (line 158+):

```typescript
return {
  roomCode,
  // ... existing fields ...
  selectedTeams,
  selectedUniformStyles, // Phase 22 D-17
  gameSpeed,
  // ...
};
```

**buildReplayFrames impact** — `buildReplayFrames` (line 4197+) builds a manual initial state object literal; it must also include `selectedUniformStyles: finalState.selectedUniformStyles` so replay frames carry the correct styles.

---

### D-18: `packages/client/src/components/HexGrid.tsx` (component, targeted line change)

**Analog:** same file — lines 66–68 (selector) and line 818 (prop).

**Current pattern** (line 66–68):

```typescript
// Phase 20 D-16: resolve uniformStyle + palette per piece from TEAM_CONFIGS (passed to PieceOverlay)
const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);
```

**Current PieceOverlay prop** (line 818):

```typescript
uniformStyle={teamConfig.defaultUniformStyle}
```

**Updated pattern** — add a second selector alongside `selectedTeams`:

```typescript
const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);
const selectedUniformStyles = useGameStore((s) => s.gameState.selectedUniformStyles); // Phase 22 D-18
```

Then inside the piece render loop (around line 635 where `teamConfig` is derived):

```typescript
const resolvedTeamId = selectedTeams[displayPiece.teamId];
const teamConfig = TEAM_CONFIGS[resolvedTeamId];
// Phase 22 D-18: resolve style from GameState instead of team default
const resolvedUniformStyle = selectedUniformStyles[displayPiece.teamId];
```

And update the PieceOverlay prop (line 818):

```typescript
uniformStyle = { resolvedUniformStyle }; // was: teamConfig.defaultUniformStyle
```

No other changes to `PieceOverlay` itself (it already accepts the prop per Phase 20 D-15).

---

## Shared Patterns

### Socket handler registration (App.tsx)

**Source:** `packages/client/src/App.tsx` lines 26–104
**Apply to:** All new socket handlers in App.tsx (`UNIFORM_SELECTION_START`, `UNIFORM_HOME_CONFIRMED`)

Pattern: named function inside `useEffect(() => {}, [])`, every `socket.on` paired with matching `socket.off` in the cleanup return. No inline arrow functions in `socket.on` calls.

### isProcessing mutex (server handlers)

**Source:** `packages/server/src/roomHandlers.ts` lines 189–243
**Apply to:** `UNIFORM_CONFIRM` handler

```typescript
if (room.isProcessing) return;
room.isProcessing = true;
try {
  // ... guarded logic
} finally {
  room.isProcessing = false;
}
```

### Allow-list validation (server)

**Source:** `packages/server/src/roomHandlers.ts` lines 40–53, 195–197
**Apply to:** `UNIFORM_CONFIRM` handler — validate both `teamId` and `uniformStyle` against allow-lists before processing.

### buildInitialGameState error guard (server)

**Source:** `packages/server/src/roomHandlers.ts` lines 226–238
**Apply to:** `UNIFORM_CONFIRM` away-branch:

```typescript
try {
  gameState = buildInitialGameState(
    roomCode,
    selectedTeams,
    room.gameSpeed ?? 'standard',
    selectedUniformStyles,
  );
} catch (err) {
  console.error('buildInitialGameState failed:', err);
  socket.emit(ServerEvents.GAME_ERROR, 'SERVER_ERROR');
  return;
}
```

### CSS dark-theme token set

**Source:** `packages/client/src/components/TeamSelectionScreen.module.css` lines 1–4 (comment) and throughout
**Apply to:** `UniformSelectionScreen.module.css` — use same color literals:

- `#1a1a2e` — screen background
- `#16213e` — card/surface backgrounds
- `#0f3460` — borders/dividers
- `#e0e0e0` — primary text
- `#a0a0a0` — dim text

---

## No Analog Found

All 8 files have analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `packages/client/src/`, `packages/server/src/`, `packages/shared/src/`
**Files scanned:** 8 primary files read in full; targeted reads on `HexGrid.tsx` (2 ranges) and `gameEngine.ts` (1 range)
**Pattern extraction date:** 2026-07-04
