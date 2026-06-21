# Phase 13: Layout & Clock - Pattern Map

**Mapped:** 2026-06-12
**Files analyzed:** 8 files modified/deleted; 0 new files created
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File                                            | Role                    | Data Flow                       | Closest Analog                             | Match Quality           |
| ------------------------------------------------------------ | ----------------------- | ------------------------------- | ------------------------------------------ | ----------------------- |
| `packages/client/src/components/GameBoard.tsx`               | component (layout host) | request-response / event-driven | self (current GameBoard.tsx)               | exact (rewrite)         |
| `packages/client/src/components/GameBoard.module.css`        | config (CSS)            | —                               | self (current GameBoard.module.css)        | exact (rewrite)         |
| `packages/client/src/App.tsx`                                | component (router)      | event-driven                    | self (current App.tsx)                     | exact (partial edit)    |
| `packages/client/src/store/useGameStore.ts`                  | store                   | event-driven                    | self (current useGameStore.ts)             | exact (partial edit)    |
| `packages/client/src/components/ConnectionStatus.module.css` | config (CSS)            | —                               | self (current ConnectionStatus.module.css) | exact (1-line fix)      |
| `packages/client/src/components/TurnIndicator.tsx`           | component               | —                               | —                                          | DELETE (logic absorbed) |
| `packages/client/src/components/HalfTimeScreen.tsx`          | component               | —                               | self                                       | DELETE → inline overlay |
| `packages/client/src/components/FullTimeScreen.tsx`          | component               | —                               | self                                       | DELETE → inline overlay |

---

## Pattern Assignments

### `packages/client/src/components/GameBoard.tsx` (full rewrite)

**Analog:** Current `GameBoard.tsx` (read above, all 85 lines)

**Imports pattern to keep** (lines 1–11 of current file):

```tsx
import { useGameStore } from '../store/useGameStore.js';
import { HexGrid } from './HexGrid.js';
import { ActionLog } from './ActionLog.js';
import { ConnectionStatus } from './ConnectionStatus.js';
import { DisconnectBanner } from './DisconnectBanner.js';
import { ActionPanel } from './ActionPanel.js';
import { KickOffSetupPanel } from './KickOffSetupPanel.js';
import { ReplayPanel } from './ReplayPanel.js';
import { PlayerStatsPanel } from './PlayerStatsPanel.js'; // removed in Phase 13
import styles from './GameBoard.module.css';
```

**Add imports for Phase 13:**

```tsx
import { useRef, useState } from 'react';
import type { PlayerPiece } from '@counter-attack/shared';
// TurnIndicator import REMOVED
// HalfTimeScreen / FullTimeScreen imports REMOVED (converted to inline overlay)
```

**DELETE:** `PLAY_PHASES` constant (lines 15–27). Clock is now always shown — no phase filter.

**Zustand selectors pattern** (extend from lines 36–39 of current file):

```tsx
const score = useGameStore((s) => s.gameState.score);
const phase = useGameStore((s) => s.gameState.phase);
const actionCount = useGameStore((s) => s.gameState.actionCount);
// Add for center section (from TurnIndicator.tsx lines 41-45):
const activeTeam = useGameStore((s) => s.gameState.activeTeam);
const movementSlot = useGameStore((s) => s.gameState.movementSlot);
const paceUsedByPieceId = useGameStore((s) => s.gameState.paceUsedByPieceId);
// Add for compact player card (from PlayerStatsPanel.tsx lines 115-116):
const selectedPieceId = useGameStore((s) => s.selectedPieceId);
const pieces = useGameStore((s) => s.gameState.pieces);
```

**Clock formula** (replaces lines 43–48 of current file):

```tsx
// D-08/D-09: event-driven only — no setInterval. Format: "MM:00"
const clockDisplay = `${String(actionCount).padStart(2, '0')}:00`;
// No PLAY_PHASES check — always rendered (CLOCK-02)
```

**Persistent player card pattern** (from RESEARCH.md Pattern 4):

```tsx
// D-03: never blank after first selection — use useRef to retain last piece
const lastPieceRef = useRef<PlayerPiece | null>(null);
const currentPiece = selectedPieceId
  ? (pieces.find((p) => p.id === selectedPieceId) ?? null)
  : null;
if (currentPiece) lastPieceRef.current = currentPiece;
const displayPiece = lastPieceRef.current;
```

**Compact stats — confirmed field names** (from `packages/shared/src/types.ts` lines 3–27):

```tsx
// PlayerPiece has exactly 10 numeric fields:
// pace, shooting, tackling, dribbling, heading, saving, handling, resilience, aerialAbility, highPass
// There is NO 'passing' or 'stamina' field — RESEARCH.md A1 assumption is WRONG.
// Choose 6 from the confirmed list. Recommended subset for outfield relevance:
const COMPACT_STATS: Array<[keyof PlayerPiece, string]> = [
  ['pace', 'PAC'],
  ['shooting', 'SHT'],
  ['tackling', 'TAC'],
  ['heading', 'HED'],
  ['dribbling', 'DRB'],
  ['highPass', 'HPS'],
];
// GK alternative (saving/handling are relevant):
// ['saving','SAV'], ['handling','HND'] — planner may choose to show all 10 or vary by role
```

**Log toggle pattern** (from RESEARCH.md Pattern 3):

```tsx
const [logExpanded, setLogExpanded] = useState(false);
```

**Phase swap pattern for action section** (preserved from lines 70–80 of current file):

```tsx
{
  phase === 'KICK_OFF_SETUP' ? (
    <KickOffSetupPanel />
  ) : phase === 'REPLAY' ? (
    <ReplayPanel />
  ) : (
    <ActionPanel />
  );
}
```

**Phase overlay pattern** (from RESEARCH.md Pattern 5; replaces HalfTimeScreen/FullTimeScreen components):

```tsx
// pitchContainer MUST have position: relative (Pitfall 2)
// Overlay absorbs content from HalfTimeScreen.tsx lines 26-68 and FullTimeScreen.tsx lines 18-46
{
  (phase === 'HALF_TIME' || phase === 'FULL_TIME') && (
    <div className={styles.overlay}>
      <div className={styles.overlayCard}>
        {/* HalfTimeScreen card content inline here when phase === 'HALF_TIME' */}
        {/* FullTimeScreen card content inline here when phase === 'FULL_TIME' */}
      </div>
    </div>
  );
}
```

**Center section content** (absorbed from `TurnIndicator.tsx` lines 40–76):

```tsx
// PHASE_LABEL table — copy verbatim from TurnIndicator.tsx lines 6-27
// SLOT_TOTAL table — copy verbatim from TurnIndicator.tsx lines 30-34
// Team color logic — copy from TurnIndicator.tsx lines 47-48
const teamName = activeTeam === 'home' ? 'HOME TEAM' : 'AWAY TEAM';
const teamColor = activeTeam === 'home' ? '#1a56b0' : '#c0392b';
const phaseLabel = PHASE_LABEL[phase];
// Moves remaining — copy from TurnIndicator.tsx lines 53-56
const remaining =
  phase === 'MOVEMENT' && movementSlot != null
    ? SLOT_TOTAL[movementSlot] - Object.keys(paceUsedByPieceId).length
    : null;
```

**HalfTimeScreen content to inline** (from `HalfTimeScreen.tsx` lines 9–68):

```tsx
// Required store selectors when phase === 'HALF_TIME':
const playerSlot = useGameStore((s) => s.playerSlot);
const kickOffTeam = useGameStore((s) => s.gameState.kickOffTeam);
const addedTime = useGameStore((s) => s.gameState.addedTime);
const emitHalfTimeStart = useGameStore((s) => s.emitHalfTimeStart);
// canStart logic: HalfTimeScreen.tsx lines 17-19
// secondHalfKickOffTeam / secondHalfTeamColor: HalfTimeScreen.tsx lines 22-24
// JSX card: HalfTimeScreen.tsx lines 26-68 — "Start 2nd Half" button must be preserved
```

**FullTimeScreen content to inline** (from `FullTimeScreen.tsx` lines 9–46):

```tsx
// Result derivation: FullTimeScreen.tsx lines 13-16
const resultText =
  score.home > score.away ? 'Home wins' : score.away > score.home ? 'Away wins' : 'Draw';
const resultColor =
  score.home > score.away ? '#1a56b0' : score.away > score.home ? '#c0392b' : '#e0e0e0';
// JSX card: FullTimeScreen.tsx lines 18-46 — no buttons, server auto-transitions
```

---

### `packages/client/src/components/GameBoard.module.css` (full rewrite)

**Analog:** Current `GameBoard.module.css` (all 67 lines read above)

**Keep from current file:**

```css
.gameBoard {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
/* .gameLayout, .pitchContainer base structure retained */
```

**Delete:** `.header`, `.headerScore`, `.homeTeam`, `.awayTeam`, `.headerTime`, `.sidebar`

**New classes to add** (from RESEARCH.md Pattern 1):

```css
/* Top band: single CSS Grid row, 80px, full width */
.topBand {
  display: grid;
  grid-template-columns: 56px 1fr 1fr 1fr auto 56px;
  height: 80px;
  flex-shrink: 0;
  background: #1a1a2e;
  border-bottom: 1px solid #0f3460;
}

.topBandSection {
  background: #16213e;
  border-right: 1px solid #0f3460;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
}

/* Score columns at far edges: fixed 56px, no border-right on away column */
.scoreColumn {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Courier New', Courier, monospace;
  font-size: 22px;
  font-weight: 700;
  color: #e0e0e0;
  background: #16213e;
  border-right: 1px solid #0f3460;
}

/* Clock text: prominent, accent gold */
.clockDisplay {
  font-size: 20px;
  font-weight: 700;
  color: #f5c518;
}

/* Phase label text */
.phaseLabel {
  font-size: 11px;
  font-weight: 700;
  color: #a0a0a0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Team name in center section */
.teamName {
  font-size: 12px;
  font-weight: 700;
  /* color applied inline from teamColor */
}

/* Compact 2x3 stats grid */
.compactStatsGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
}

.compactStat {
  display: flex;
  gap: 4px;
  font-size: 11px;
}

.compactStatLabel {
  color: #a0a0a0;
}

.compactStatValue {
  color: #e0e0e0;
  font-weight: 700;
}

/* Log toggle section */
.logCollapsed {
  width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #16213e;
  border-right: 1px solid #0f3460;
}

.logExpanded {
  width: 240px;
  display: flex;
  flex-direction: column;
  background: #16213e;
  border-right: 1px solid #0f3460;
  overflow: hidden;
}

/* pitchContainer MUST have position: relative for phase overlay (Pitfall 2) */
.pitchContainer {
  flex: 1;
  background: #0a0a0a;
  padding: 16px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative; /* REQUIRED for overlay positioning */
}

/* Phase overlay: covers pitch area only, not top band */
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10;
}

/* Overlay card: same style as HalfTimeScreen.module.css .card (lines 13-22) */
.overlayCard {
  width: 100%;
  max-width: 440px;
  background: #16213e;
  border: 1px solid #0f3460;
  border-radius: 4px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

---

### `packages/client/src/App.tsx` (partial edit)

**Analog:** Current `App.tsx` (all 102 lines read above)

**Routing change** (lines 27–37 become):

```tsx
// BEFORE (lines 27-37):
if (state.phase === 'HALF_TIME') {
  setScreen('HALF_TIME');
} else if (state.phase === 'FULL_TIME') {
  setScreen('FULL_TIME');
} else if (state.phase === 'REPLAY') {
  setScreen('REPLAY');
} else {
  const s = useGameStore.getState().screen;
  if (s !== 'GAME_BOARD') setScreen('GAME_BOARD');
}

// AFTER (D-12: HALF_TIME and FULL_TIME fall through to GAME_BOARD):
if (state.phase === 'REPLAY') {
  setScreen('REPLAY');
} else {
  const s = useGameStore.getState().screen;
  if (s !== 'GAME_BOARD') setScreen('GAME_BOARD');
}
```

**Render tree change** (lines 86–101 become):

```tsx
// BEFORE (lines 86-101):
{
  screen === 'GAME_BOARD' ? (
    <GameBoard />
  ) : screen === 'HALF_TIME' ? (
    <HalfTimeScreen />
  ) : screen === 'FULL_TIME' ? (
    <FullTimeScreen />
  ) : screen === 'REPLAY' ? (
    <GameBoard />
  ) : (
    <LobbyScreen />
  );
}

// AFTER (D-12: all game phases → GameBoard):
{
  screen === 'GAME_BOARD' || screen === 'REPLAY' ? <GameBoard /> : <LobbyScreen />;
}
```

**Remove imports** (lines 5–6):

```tsx
// DELETE these two lines:
import { HalfTimeScreen } from './components/HalfTimeScreen.js';
import { FullTimeScreen } from './components/FullTimeScreen.js';
```

---

### `packages/client/src/store/useGameStore.ts` (partial edit)

**Analog:** Current `useGameStore.ts` (all 635 lines read above)

**Screen type change** (lines 23–30):

```tsx
// BEFORE:
export type Screen =
  | 'LANDING'
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'WAITING'
  | 'GAME_BOARD'
  | 'HALF_TIME' // REMOVE
  | 'FULL_TIME' // REMOVE
  | 'REPLAY';

// AFTER (D-12 — both values removed; App.tsx no longer routes to them):
export type Screen = 'LANDING' | 'CREATE_ROOM' | 'JOIN_ROOM' | 'WAITING' | 'GAME_BOARD' | 'REPLAY';
```

**Warning:** Before removing `'HALF_TIME'` and `'FULL_TIME'`, grep for `screen === 'HALF_TIME'` and `screen === 'FULL_TIME'` across the entire client package to confirm no other component reads these values. `useGameStore.ts` and `App.tsx` are the only known consumers, but this must be verified (RESEARCH.md Pitfall 1 / Assumption A2).

---

### `packages/client/src/components/ConnectionStatus.module.css` (1-line fix)

**Analog:** Current `ConnectionStatus.module.css` (all 19 lines read above)

**Change** (lines 8–9, Pitfall 6):

```css
/* BEFORE: */
.dot {
  width: 10px;
  height: 10px;

/* AFTER (UI-SPEC requires 8px × 8px): */
.dot {
  width: 8px;
  height: 8px;
```

---

### `TurnIndicator.tsx` + `TurnIndicator.module.css` (DELETE)

**Before deleting:** Copy these sections verbatim into `GameBoard.tsx`:

- `PHASE_LABEL` constant (lines 6–27) — copy as-is
- `SLOT_TOTAL` constant (lines 30–34) — copy as-is
- `remaining` computation (lines 53–56) — copy as-is
- Team color logic (lines 47–48) — copy as-is

**Source:** `packages/client/src/components/TurnIndicator.tsx` lines 1–76 (read above)

---

### `HalfTimeScreen.tsx` + `HalfTimeScreen.module.css` (DELETE)

**Before deleting:** Extract and inline into `GameBoard.tsx` phase overlay:

- Overlay content JSX: `HalfTimeScreen.tsx` lines 26–68
- `canStart` logic: lines 17–19
- `secondHalfKickOffTeam` / color: lines 22–24
- CSS for card: `HalfTimeScreen.module.css` lines 12–78 → merge into `GameBoard.module.css` as `.overlayCard`, `.overlayHeading`, `.overlayBody`, `.overlayScoreRow`, `.overlayCtaButton`

**Critical:** `emitHalfTimeStart()` at line 61 of `HalfTimeScreen.tsx` must survive into the inline overlay. The "Start 2nd Half" button is the only user action in the HALF_TIME phase.

---

### `FullTimeScreen.tsx` + `FullTimeScreen.module.css` (DELETE)

**Before deleting:** Extract and inline into `GameBoard.tsx` phase overlay:

- Overlay content JSX: `FullTimeScreen.tsx` lines 18–46
- Result derivation: lines 13–16
- No emits — purely display

---

## Shared Patterns

### Zustand selector per-slice pattern

**Source:** All existing components (e.g., `TurnIndicator.tsx` lines 41–45, `PlayerStatsPanel.tsx` lines 115–116)
**Apply to:** Every inline section in the new top band — each section selects only its needed slice

```tsx
// Per-slice — prevents whole-component re-render on unrelated state changes
const score = useGameStore((s) => s.gameState.score);
const phase = useGameStore((s) => s.gameState.phase);
const actionCount = useGameStore((s) => s.gameState.actionCount);
const activeTeam = useGameStore((s) => s.gameState.activeTeam);
const movementSlot = useGameStore((s) => s.gameState.movementSlot);
const paceUsedByPieceId = useGameStore((s) => s.gameState.paceUsedByPieceId);
const selectedPieceId = useGameStore((s) => s.selectedPieceId);
const pieces = useGameStore((s) => s.gameState.pieces);
const playerSlot = useGameStore((s) => s.playerSlot);
const kickOffTeam = useGameStore((s) => s.gameState.kickOffTeam);
const addedTime = useGameStore((s) => s.gameState.addedTime);
const emitHalfTimeStart = useGameStore((s) => s.emitHalfTimeStart);
```

### Dark theme tokens

**Source:** `GameBoard.module.css` (entire file), `HalfTimeScreen.module.css` (entire file)
**Apply to:** All new CSS classes in `GameBoard.module.css`

```
Background primary:   #1a1a2e
Background secondary: #16213e
Border:               #0f3460
Text primary:         #e0e0e0
Text muted:           #a0a0a0
Accent gold (clock):  #f5c518
Home team blue:       #1a56b0
Away team red:        #c0392b
```

### Button style

**Source:** `HalfTimeScreen.module.css` lines 59–78
**Apply to:** "Start 2nd Half" button in phase overlay

```css
.ctaButton {
  background: #0f3460;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.ctaButton:hover:not(:disabled) {
  background: #1a56b0;
}
.ctaButton:disabled {
  opacity: 0.5;
  cursor: default;
}
```

---

## No Analog Found

None — all files have direct analogs or are self-referential rewrites.

---

## Key Facts for Planner

1. **`PlayerPiece` has no `passing` or `stamina` field.** The 10 confirmed numeric fields are: `pace`, `shooting`, `tackling`, `dribbling`, `heading`, `saving`, `handling`, `resilience`, `aerialAbility`, `highPass`. The compact card must map "PAS" and "STM" labels to two of these, or the planner should choose 6 fields without forcing those abbreviations. Recommended: use `dribbling` (DRB) and `highPass` (HPS) as slots 5 and 6.

2. **`REPLAY` may still be needed in the `Screen` enum.** `App.tsx` line 94 branches `screen === 'REPLAY'` → `<GameBoard />`. After Phase 13 simplification that branch collapses into the combined `GAME_BOARD || REPLAY` check. Keeping `REPLAY` in the enum is safe and avoids a breaking grep — planner may retain it.

3. **The `emitHalfTimeStart` action in `useGameStore` is not deleted** — only the `HalfTimeScreen` component is deleted. The action (line 598 of `useGameStore.ts`) must remain; it is called by the inline overlay button.

4. **`DisconnectBanner` position:** It currently renders below the header (`GameBoard.tsx` line 62). In the new layout it renders between the top band and the pitch area — no logic change needed, just preserved placement.

---

## Metadata

**Analog search scope:** `packages/client/src/` — all `.tsx`, `.ts`, `.css` files
**Files read:** GameBoard.tsx, GameBoard.module.css, TurnIndicator.tsx, App.tsx, HalfTimeScreen.tsx, FullTimeScreen.tsx, HalfTimeScreen.module.css, PlayerStatsPanel.tsx, ConnectionStatus.tsx, ConnectionStatus.module.css, useGameStore.ts (types excerpt), packages/shared/src/types.ts (lines 1–27)
**Pattern extraction date:** 2026-06-12
