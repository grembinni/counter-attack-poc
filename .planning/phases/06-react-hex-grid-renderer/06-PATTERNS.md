# Phase 6: React Hex Grid Renderer - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 23 new/modified files
**Analogs found:** 23 / 23 (all files have at least a role-match analog in the existing codebase)

---

## File Classification

| New/Modified File                                  | Role      | Data Flow        | Closest Analog                                                  | Match Quality |
| -------------------------------------------------- | --------- | ---------------- | --------------------------------------------------------------- | ------------- |
| `packages/client/package.json`                     | config    | —                | `packages/server/package.json`                                  | role-match    |
| `packages/client/vite.config.ts`                   | config    | —                | `packages/shared/vitest.config.ts`                              | role-match    |
| `packages/client/tsconfig.json`                    | config    | —                | `packages/shared/tsconfig.json`                                 | exact         |
| `packages/client/index.html`                       | config    | —                | (no HTML in codebase; use RESEARCH pattern)                     | no-analog     |
| `packages/client/src/main.tsx`                     | provider  | request-response | `packages/client/src/main.ts`                                   | exact         |
| `packages/client/src/App.tsx`                      | component | request-response | `packages/server/src/createServer.ts` (root factory)            | partial       |
| `packages/client/src/App.module.css`               | config    | —                | (no CSS in codebase; pure greenfield)                           | no-analog     |
| `packages/client/src/components/HexGrid.tsx`       | component | CRUD             | `packages/shared/src/hex.ts` (pure math + export)               | role-match    |
| `packages/client/src/components/HexCell.tsx`       | component | CRUD             | `packages/shared/src/hex.ts`                                    | role-match    |
| `packages/client/src/components/PieceOverlay.tsx`  | component | CRUD             | `packages/shared/src/teams.ts` (data shape reference)           | role-match    |
| `packages/client/src/components/BallMarker.tsx`    | component | CRUD             | `packages/shared/src/types.ts` (BallState type)                 | role-match    |
| `packages/client/src/components/TurnIndicator.tsx` | component | request-response | `packages/shared/src/types.ts` (GamePhase/MovementSlot)         | role-match    |
| `packages/client/src/components/ActionLog.tsx`     | component | request-response | `packages/shared/src/types.ts` (ActionEvent union)              | role-match    |
| `packages/client/src/components/GameBoard.tsx`     | component | request-response | `packages/server/src/createServer.ts`                           | partial       |
| `packages/client/src/components/LobbyScreen.tsx`   | component | request-response | `packages/server/src/roomHandlers.ts`                           | partial       |
| `packages/client/src/store/useGameStore.ts`        | store     | CRUD             | `packages/server/src/roomStore.ts`                              | role-match    |
| `packages/client/src/utils/hexToPixel.ts`          | utility   | transform        | `packages/shared/src/hex.ts`                                    | exact         |
| `packages/client/src/mock/mockMovementState.ts`    | utility   | —                | `packages/shared/src/moveValidator.test.ts` (baseState fixture) | role-match    |
| `packages/client/src/mock/mockPassState.ts`        | utility   | —                | `packages/shared/src/passValidator.test.ts`                     | role-match    |
| `packages/client/src/mock/mockShotState.ts`        | utility   | —                | `packages/shared/src/shotValidator.test.ts`                     | role-match    |
| `packages/client/src/mock/mockGKRestartState.ts`   | utility   | —                | `packages/shared/src/moveValidator.test.ts` (baseState fixture) | role-match    |
| `packages/shared/src/pitch.ts`                     | utility   | transform        | `packages/shared/src/pitch.ts` itself (update in place)         | exact         |
| `packages/shared/src/pitch.test.ts`                | test      | —                | `packages/shared/src/hex.test.ts`                               | exact         |

---

## Pattern Assignments

### `packages/client/package.json` (config)

**Analog:** `packages/server/package.json`

The server package.json establishes the monorepo package conventions: `"type": "module"`, `workspace:*` for the shared dep, `"private": true`, script names (`build`, `typecheck`, `test`), and exact version pinning with no `^` range in production deps.

**Conventions pattern** (`packages/server/package.json` lines 1-30):

```json
{
  "name": "@counter-attack/server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/main.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@counter-attack/shared": "workspace:*"
  },
  "devDependencies": {
    "vitest": "2.1.9"
  }
}
```

**Client-specific additions from RESEARCH.md Pattern 1:**

- Scripts: `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"` (replace `tsc` build)
- Runtime deps: `react@^18.3.1`, `react-dom@^18.3.1`, `zustand@^4.5.7`, `honeycomb-grid@^4.1.5`, `socket.io-client@^4.8.3`
- Dev deps: `vite@^5.4.21`, `@vitejs/plugin-react@^4.7.0`, `@types/react@^18.3.1`, `@types/react-dom@^18.3.1`, `vitest@^2.1.9`, `jsdom@^25.0.0`, `@testing-library/react@^14.3.1`

---

### `packages/client/vite.config.ts` (config)

**Analog:** `packages/shared/vitest.config.ts`

Both use `defineConfig` from the respective framework package and export a single default config object. The shared vitest config shows the exact `defineConfig` import + `export default` pattern used across the monorepo.

**Config structure pattern** (`packages/shared/vitest.config.ts` lines 1-8):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

**Vite adaptation (from RESEARCH.md Pattern 1):**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

No `resolve.alias` is needed because `@counter-attack/shared` is resolved via pnpm `workspace:*` + the `exports` field in `packages/shared/package.json`. See `packages/shared/package.json` lines 7-14 for the exports configuration.

---

### `packages/client/tsconfig.json` (config)

**Analog:** `packages/client/tsconfig.json` itself (update in place) + `packages/shared/tsconfig.json`

The existing client tsconfig already has the correct base: `"extends": "../../tsconfig.base.json"`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"lib": ["ES2022", "DOM", "DOM.Iterable"]`. The only addition needed is `"types": ["vite/client"]` for CSS Module import typing.

**Current file** (`packages/client/tsconfig.json` lines 1-13):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

**Addition:** `"types": ["vite/client"]` inside `compilerOptions` — provides ambient `declare module '*.module.css'` so CSS Module imports don't produce TS errors.

**Root base** (`tsconfig.base.json` lines 1-19): Key strict flags inherited — `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`, `"verbatimModuleSyntax": true`, `"isolatedModules": true`. All new client files must comply with these.

---

### `packages/client/src/main.tsx` (provider, replaces main.ts)

**Analog:** `packages/client/src/main.ts` (current placeholder — replace entirely)

The existing `main.ts` shows the import convention for `@counter-attack/shared` from the client side (workspace package import, no relative paths). The new `main.tsx` uses the React 18 `createRoot` API.

**Current import convention** (`packages/client/src/main.ts` lines 1-2):

```typescript
import type { HexCoord, GameState, PlayerPiece } from '@counter-attack/shared';
import { hexDistance, ClientEvents } from '@counter-attack/shared';
```

**React 18 entry point pattern (from RESEARCH.md Code Examples):**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Note: Vite resolves `.tsx` imports without extensions; the `.js` extension in `'./App.js'` is correct for `verbatimModuleSyntax` compliance (TypeScript emits `.js` extensions in output). This pattern is consistent with how `packages/shared/src/hex.ts` imports `'./types.js'` (line 1).

---

### `packages/client/src/App.tsx` (component, request-response)

**Analog:** No exact analog. Closest structural reference is how `packages/server/src/createServer.ts` acts as a root factory/compositor. For component structure, copy the named-export convention from `packages/shared/src/hex.ts`.

**Named export convention** (from all shared modules):

```typescript
// Named exports, no default exports — established project convention
export function App() { ... }
// NOT: export default function App() { ... }
```

**Screen routing pattern from RESEARCH.md Pattern architecture:**

```typescript
// App reads `screen` from Zustand store and renders appropriate child
const screen = useGameStore((s) => s.screen);
// Render LobbyScreen for CREATE_ROOM / JOIN_ROOM / WAITING
// Render GameBoard for GAME_BOARD
```

---

### `packages/client/src/store/useGameStore.ts` (store, CRUD)

**Analog:** `packages/server/src/roomStore.ts`

The roomStore.ts is the closest existing state management analog: it manages a `Map<string, Room>` as application state with discriminated union results, module-level state, and exported pure functions that mutate state. The Zustand store follows the same functional approach but uses the Zustand `create` API.

**Discriminated union result pattern** (`packages/server/src/roomStore.ts` lines 53-63):

```typescript
export type JoinResult =
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_WAITING' | 'FULL' }
  | { ok: true; sessionToken: string; slot: 2 };
```

**State initialization / export pattern** (`packages/server/src/roomStore.ts` lines 19-24):

```typescript
// Module-level singleton — mirrors the AXIAL_DIRECTIONS const pattern from hex.ts.
const rooms = new Map<string, Room>();
// ...
export function createRoom(socketId: string): { roomCode: string; sessionToken: string } {
```

**Zustand 4.x store pattern (from RESEARCH.md Pattern 2):**

```typescript
import { create } from 'zustand';
import type { GameState, HexCoord } from '@counter-attack/shared';
import { validateMove, hexesInRange } from '@counter-attack/shared';
import { mockMovementState } from '../mock/index.js';

type Screen = 'CREATE_ROOM' | 'JOIN_ROOM' | 'WAITING' | 'GAME_BOARD';

type GameStore = {
  gameState: GameState;
  screen: Screen;
  selectedPieceId: string | null;
  validMoveHexes: HexCoord[];
  setScreen: (s: Screen) => void;
  selectPiece: (id: string) => void;
  movePiece: (targetHex: HexCoord) => void;
};

export const useGameStore = create<GameStore>()((set, get) => ({
  gameState: mockMovementState,
  screen: 'CREATE_ROOM',
  selectedPieceId: null,
  validMoveHexes: [],
  setScreen: (s) => set({ screen: s }),
  selectPiece: (id) => {
    const { gameState, selectedPieceId } = get();
    if (selectedPieceId === id) {
      set({ selectedPieceId: null, validMoveHexes: [] });
      return;
    }
    const piece = gameState.pieces.find((p) => p.id === id);
    if (!piece) return;
    const candidates = hexesInRange(piece.position, piece.pace);
    const valid = candidates.filter((hex) => validateMove(gameState, piece, hex).ok);
    set({ selectedPieceId: id, validMoveHexes: valid });
  },
  movePiece: (targetHex) => {
    const { gameState, selectedPieceId } = get();
    if (!selectedPieceId) return;
    const updatedPieces = gameState.pieces.map((p) =>
      p.id === selectedPieceId ? { ...p, position: targetHex } : p,
    );
    set({
      gameState: { ...gameState, pieces: updatedPieces },
      selectedPieceId: null,
      validMoveHexes: [],
    });
  },
}));
```

**Critical:** The curried `create<T>()((set, get) => ...)` form is required for Zustand 4.x TypeScript inference. The non-curried form loses type safety. Do not upgrade to Zustand 5 (different API).

**Selector subscription pattern (component usage):**

```typescript
// Correct — only re-renders when validMoveHexes changes
const validMoveHexes = useGameStore((s) => s.validMoveHexes);
// Incorrect — re-renders on any store change
const store = useGameStore();
```

---

### `packages/client/src/utils/hexToPixel.ts` (utility, transform)

**Analog:** `packages/shared/src/hex.ts` (pure utility functions — exact structural match)

`hex.ts` is the gold-standard analog for a pure-math utility module in this codebase: module-level const arrays, exported named functions with JSDoc, no side effects, no classes, `import type` for type-only imports.

**Pure utility module structure** (`packages/shared/src/hex.ts` lines 1-21):

```typescript
import type { HexCoord, PlayerPiece } from './types.js';

// Module-level const for shared data
const AXIAL_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },   // E
  { q: 1, r: -1 },  // NE
  ...
];

/**
 * JSDoc comment with formula/source citation.
 * Source: redblobgames.com/grids/hexagons/
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}
```

**hexToPixel.ts content (from RESEARCH.md Pattern 3, verified against D-03):**

```typescript
// No imports needed — pure math, no external types
// Source: CONTEXT.md D-03 (locked decision) + redblobgames.com/grids/hexagons/

export const HEX_SIZE = 20;

/**
 * Converts axial hex coordinate to SVG pixel center point.
 * Flat-top orientation as per CONTEXT.md D-03.
 * cx = hexSize * (3/2 * q)
 * cy = hexSize * (√3/2 * q + √3 * r)
 */
export function axialToPixel(
  q: number,
  r: number,
  hexSize: number = HEX_SIZE,
): { cx: number; cy: number } {
  return {
    cx: hexSize * (3 / 2) * q,
    cy: hexSize * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
  };
}

/**
 * Returns the 6 corner point strings for a flat-top hex polygon.
 * Flat-top vertex angles: 0°, 60°, 120°, 180°, 240°, 300° (D-03).
 */
export function hexPolygonPoints(cx: number, cy: number, hexSize: number = HEX_SIZE): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    return `${cx + hexSize * Math.cos(angleRad)},${cy + hexSize * Math.sin(angleRad)}`;
  }).join(' ');
}

/**
 * Computes the SVG viewBox string for the full 37×26 grid with padding.
 * Adds hexSize padding on each side to avoid q=0/r=0 clipping (Pitfall 5).
 */
export function computeViewBox(hexSize: number = HEX_SIZE): string {
  const maxCoord = axialToPixel(36, 25, hexSize);
  const width = maxCoord.cx + hexSize * 2;
  const height = maxCoord.cy + hexSize * 2;
  return `0 0 ${width} ${height}`;
}
```

**Pitfall 5 mitigation:** The hex at q=0, r=0 has its center at pixel (0, 0). The viewBox or a `<g transform>` must offset by at least `hexSize` so the polygon at the origin is not clipped. Apply `<g transform="translate(hexSize, hexSize * √3/2)">` wrapper around all SVG content, or shift the viewBox origin to `(-hexSize, -hexSize * √3/2)`.

---

### `packages/client/src/components/HexGrid.tsx` (component, CRUD)

**Analog:** `packages/shared/src/hex.ts` (structural), `packages/shared/src/pitch.ts` (data iteration)

HexGrid iterates `PITCH_HEXES` (same pattern as `pitch.ts` iterating hexes to build regions) and renders SVG children. It is the SVG root element owner.

**Iteration pattern** (`packages/shared/src/pitch.ts` lines 17-27):

```typescript
export const PITCH_HEXES: readonly HexCoord[] = (() => {
  const hexes: HexCoord[] = [];
  for (let q = 0; q < 25; q++) {
    for (let r = 0; r < 16; r++) {
      hexes.push({ q, r });
    }
  }
  return hexes;
})();
```

**Component pattern (from RESEARCH.md anti-patterns and architecture):**

```typescript
import type { HexCoord } from '@counter-attack/shared';
import { PITCH_HEXES } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { HexCell } from './HexCell.js';
import { PieceOverlay } from './PieceOverlay.js';
import { BallMarker } from './BallMarker.js';
import { computeViewBox, HEX_SIZE, axialToPixel } from '../utils/hexToPixel.js';

// Selectors — subscribe only to slices needed (Pitfall 6 avoidance)
const pieces = useGameStore((s) => s.gameState.pieces);
const ball = useGameStore((s) => s.gameState.ball);
const validMoveHexes = useGameStore((s) => s.validMoveHexes);

// All SVG elements (HexCell, PieceOverlay, BallMarker) must be children of the
// same <svg> root — z-order is controlled by DOM order within SVG (anti-pattern note).
// width="100%" with viewBox controls aspect ratio responsively.
```

---

### `packages/client/src/components/HexCell.tsx` (component, CRUD)

**Analog:** `packages/shared/src/hex.ts` (pure function structure), `packages/shared/src/pitch.ts` (region membership lookup pattern)

**Region membership lookup pattern** (`packages/shared/src/pitch.ts` lines 97-99):

```typescript
export function isInRegion(hex: HexCoord, region: keyof Omit<PitchRegions, 'kickOffHex'>): boolean {
  return PITCH_REGIONS[region].has(hexKey(hex));
}
```

**HexCell component pattern (from RESEARCH.md Pattern 4):**

```typescript
import React, { useState } from 'react';
import type { HexCoord } from '@counter-attack/shared';
import { axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';
import { isDifficultAngle, PITCH_REGIONS } from '@counter-attack/shared';

type Props = {
  hex: HexCoord;
  isGoal: boolean;
  isHighlighted: boolean;
  onClick: () => void;
};

export function HexCell({ hex, isGoal, isHighlighted, onClick }: Props) {
  const { cx, cy } = axialToPixel(hex.q, hex.r);
  const points = hexPolygonPoints(cx, cy);
  // Diagonal stripe: alternating fill by (q + r) % 2
  const baseFill = isGoal ? '#1a1a1a' : (hex.q + hex.r) % 2 === 0 ? '#4a7c3f' : '#3d6b34';
  const [hovered, setHovered] = useState(false);

  return (
    <g>
      <polygon
        points={points}
        fill={baseFill}
        stroke="#2d5227"
        strokeWidth={0.5}
        onClick={isHighlighted ? onClick : undefined}
        style={{ cursor: isHighlighted ? 'pointer' : 'default' }}
      />
      {isHighlighted && (
        <polygon
          points={points}
          fill="#f5c518"
          fillOpacity={hovered ? 0.75 : 0.55}
          pointerEvents="none"
        />
      )}
      {isDifficultAngle(hex) && (
        <circle cx={cx} cy={cy} r={3} fill="#ffffff" fillOpacity={0.3} pointerEvents="none" />
      )}
    </g>
  );
}
```

---

### `packages/client/src/components/PieceOverlay.tsx` (component, CRUD)

**Analog:** `packages/shared/src/teams.ts` (PlayerPiece shape reference), `packages/shared/src/types.ts` (PlayerPiece type)

PieceOverlay renders one `PlayerPiece`. The teams.ts file shows the full shape of `PlayerPiece` including `teamId`, `role`, `name`, and `position`.

**PlayerPiece shape** (`packages/shared/src/types.ts` lines 3-27):

```typescript
export type PlayerPiece = {
  id: string;
  teamId: 'home' | 'away';
  position: HexCoord;
  pace: number;
  // ... other attributes
  name: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
};
```

**Component pattern:**

```typescript
import type { PlayerPiece } from '@counter-attack/shared';
import { axialToPixel } from '../utils/hexToPixel.js';

type Props = {
  piece: PlayerPiece;
  isSelected: boolean;
  onClick: () => void;
};

export function PieceOverlay({ piece, isSelected, onClick }: Props) {
  const { cx, cy } = axialToPixel(piece.position.q, piece.position.r);
  const fill = piece.teamId === 'home' ? '#e63946' : '#457b9d';
  // SVG <circle> + <text> label; must be child of the HexGrid <svg> root
}
```

---

### `packages/client/src/components/BallMarker.tsx` (component, CRUD)

**Analog:** `packages/shared/src/types.ts` (BallState type reference)

**BallState type** (`packages/shared/src/types.ts` lines 29-32):

```typescript
export type BallState = {
  position: HexCoord;
  carrierId: string | null;
};
```

Simple SVG `<circle>` at the ball position. No complex logic — read `ball.position`, call `axialToPixel`, render. When `carrierId !== null`, ball is rendered at the carrier's position (handled by HexGrid passing ball.position, which is already updated by server state).

---

### `packages/client/src/components/TurnIndicator.tsx` (component, request-response)

**Analog:** `packages/shared/src/types.ts` (GamePhase, MovementSlot, GameState)

Reads `phase`, `activeTeam`, `movementSlot`, `movedPieceIds` from Zustand store. Uses selector pattern to avoid re-renders from unrelated state changes (Pitfall 6).

**Types consumed** (`packages/shared/src/types.ts` lines 38, 78-89, 91-120):

```typescript
export type MovementSlot = 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2';
export type GamePhase = 'LOBBY' | 'KICK_OFF' | 'MOVEMENT' | 'PASS' | 'SHOT' | ... ;
// GameState fields rendered: phase, activeTeam, movementSlot, movedPieceIds, score, half
```

**Selector pattern (performance):**

```typescript
const phase = useGameStore((s) => s.gameState.phase);
const activeTeam = useGameStore((s) => s.gameState.activeTeam);
const movementSlot = useGameStore((s) => s.gameState.movementSlot);
```

---

### `packages/client/src/components/ActionLog.tsx` (component, request-response)

**Analog:** `packages/shared/src/types.ts` (ActionEvent discriminated union)

**ActionEvent union** (`packages/shared/src/types.ts` lines 62-76):

```typescript
export type ActionEvent =
  | {
      type: 'MOVE';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      slot: MovementSlot;
      timestamp: number;
    }
  | { type: 'SLOT_ADVANCE'; from: MovementSlot; to: MovementSlot | null; timestamp: number }
  | { type: 'DICE_ROLL'; result: number; timestamp: number }
  | { type: 'STEAL_ATTEMPT'; defenderId: string; result: 'SUCCESS' | 'FAIL'; timestamp: number }
  | { type: 'GOAL'; scoringTeam: 'home' | 'away'; timestamp: number }
  | { type: 'KICK_OFF'; timestamp: number };
```

**Switch-on-type rendering pattern** (following the discriminated union exhaustiveness pattern from `packages/server/src/gameHandlers.ts`):

```typescript
// In ActionLog.tsx — render each event type as human-readable string
// Use JSX string interpolation (never dangerouslySetInnerHTML — Security note)
function formatEvent(event: ActionEvent): string {
  switch (event.type) {
    case 'MOVE':
      return `${event.pieceId} moved to (${event.to.q},${event.to.r})`;
    case 'DICE_ROLL':
      return `Dice rolled: ${event.result}`;
    case 'GOAL':
      return `GOAL! ${event.scoringTeam} team scores`;
    // ...
  }
}
```

---

### `packages/client/src/components/LobbyScreen.tsx` (component, request-response)

**Analog:** `packages/server/src/roomHandlers.ts` (room create/join logic flow)

The roomHandlers.ts shows the CREATE/JOIN branching — the LobbyScreen mirrors this with three sub-screens driven by the `screen` field in the Zustand store (D-12, D-13).

**Store screen field drives rendering:**

```typescript
// In LobbyScreen.tsx — reads screen from store, renders sub-UI accordingly
const screen = useGameStore((s) => s.screen);
const setScreen = useGameStore((s) => s.setScreen);

// CREATE_ROOM: generate display room code + copy-to-clipboard via navigator.clipboard.writeText()
// JOIN_ROOM: text input, uppercase transform, setScreen to WAITING on submit
// WAITING: display room code reminder, static "Waiting for opponent..."
```

---

### `packages/client/src/components/GameBoard.tsx` (component, request-response)

**Analog:** No direct analog — root layout compositor. Structural pattern from `packages/server/src/createServer.ts` (assembles sub-components).

**Layout structure (from RESEARCH.md Architecture):**

- Pitch fills ~80% of viewport width, 280px right sidebar at 1280px desktop target
- `<HexGrid />` in main area, `<TurnIndicator />` + `<ActionLog />` in sidebar
- CSS Modules for layout: `styles.gameBoard`, `styles.pitchContainer`, `styles.sidebar`

---

### `packages/client/src/mock/mockMovementState.ts` (utility, data fixture)

**Analog:** `packages/shared/src/moveValidator.test.ts` (baseState fixture, lines 5-37)

The `baseState` and `basePiece` fixtures in moveValidator.test.ts are the exact pattern to copy for mock state construction: full `GameState` object with every required field.

**Full GameState fixture pattern** (`packages/shared/src/moveValidator.test.ts` lines 5-37):

```typescript
const basePiece: PlayerPiece = {
  id: 'p1',
  teamId: 'home',
  position: { q: 5, r: 5 },
  pace: 4,
  shooting: 5,
  tackling: 5,
  dribbling: 5,
  heading: 5,
  saving: 1,
  handling: 5,
  resilience: 5,
  aerialAbility: 5,
  highPass: 5,
  name: 'Test Player',
  role: 'MID',
};

const baseState: GameState = {
  roomCode: 'TEST',
  phase: 'MOVEMENT',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [basePiece],
  ball: { position: { q: 0, r: 0 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 3 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: 'ATTACKER_4',
};
```

**Mock state pattern for Phase 6:** Replace the single `basePiece` with the real `HOME_SQUAD` + `AWAY_SQUAD` from `teams.ts`, update positions to fit the new 37×26 grid, and set `phase` to the appropriate `GamePhase` per mock file.

```typescript
// mockMovementState.ts
import type { GameState } from '@counter-attack/shared';
import { HOME_SQUAD, AWAY_SQUAD } from '@counter-attack/shared';

export const mockMovementState: GameState = {
  roomCode: 'MOCK1',
  phase: 'MOVEMENT',
  activeTeam: 'home',
  attackingTeam: 'home',
  pieces: [...HOME_SQUAD, ...AWAY_SQUAD], // positions need 37×26 update
  ball: { position: { q: 18, r: 13 }, carrierId: 'home-9' },
  score: { home: 0, away: 0 },
  actionCount: 3,
  half: 1,
  eventLog: [],
  refereeCard: { leniency: 4 },
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: 'ATTACKER_4',
};
```

---

### `packages/client/src/mock/mockPassState.ts` (utility, data fixture)

**Analog:** Same as mockMovementState — baseState fixture pattern from `packages/shared/src/moveValidator.test.ts`.

Set `phase: 'PASS'`, `movementSlot: null`, and add a representative `eventLog` entry of type `MOVE` to show movement history.

---

### `packages/client/src/mock/mockShotState.ts` (utility, data fixture)

**Analog:** Same pattern. Set `phase: 'SHOT'`, place the ball carrier inside the penalty area (q∈[0,5] for home penalty, q∈[31,36] for away penalty per D-05), `movementSlot: null`.

---

### `packages/client/src/mock/mockGKRestartState.ts` (utility, data fixture)

**Analog:** Same pattern. Set `phase: 'GK_RESTART'`, `movementSlot: null`, `lastDiceRoll: { rolls: [4], context: 'SHOT_DUEL' }` to exercise the TurnIndicator and ActionLog with dice roll display.

---

### `packages/shared/src/pitch.ts` (utility, transform — update in place)

**Analog:** `packages/shared/src/pitch.ts` itself — same file, same structure, same exports. Only the constants change.

**Current structure to preserve** (`packages/shared/src/pitch.ts` lines 31-118):

```typescript
// Keep ALL of these — structure is correct, only values change:
const hexKey = (h: HexCoord): string => `${h.q},${h.r}`;        // line 31
const buildRegion = (hexes: HexCoord[]): ReadonlySet<string> => new Set(hexes.map(hexKey)); // line 32

export type PitchRegions = { ... };   // lines 38-49 — ADD homeGoal/awayGoal fields

export const PITCH_REGIONS: PitchRegions = { ... };  // lines 57-67 — recompute for 37×26

export const DIFFICULT_ANGLE_HEXES: ReadonlySet<string> = buildRegion([...]); // lines 74-91 — replace with real coordinates

export function isInRegion(...): boolean { ... }  // lines 97-99 — unchanged
export function isDifficultAngle(...): boolean { ... }  // lines 104-106 — unchanged
export function isPitchHex(...): boolean { ... }  // lines 116-118 — unchanged
```

**Key changes for 37×26 (from CONTEXT.md D-04, D-05):**

- `PITCH_HEXES`: q∈[0,36], r∈[0,25] → 962 hexes (replace lines 17-27)
- `PitchRegions` type: ADD `homeGoal: ReadonlySet<string>` and `awayGoal: ReadonlySet<string>` (from RESEARCH.md Pattern 5)
- `PITCH_REGIONS`: New boundaries per D-05:
  - `homeThird`: q ∈ [0, 10]
  - `middleThird`: q ∈ [11, 25]
  - `awayThird`: q ∈ [26, 36]
  - `homePenaltyArea`: q∈[0,5] r∈[5,19]
  - `awayPenaltyArea`: q∈[31,36] r∈[5,19]
  - `homeSixYardBox`: q∈[0,1] r∈[8,17]
  - `awaySixYardBox`: q∈[35,36] r∈[8,17]
  - `homeGoal`: q=0 r∈[9,15]
  - `awayGoal`: q=36 r∈[9,15]
  - `centreCircle`: `hexesInRange({ q: 18, r: 13 }, 3)` (use {q:18, r:13} as default kickoff)
  - `kickOffHex`: `{ q: 18, r: 13 }`
- `DIFFICULT_ANGLE_HEXES`: Derive from board photo (blocking task — planner must resolve before implementing)
- `isInRegion` key type must be updated: `keyof Omit<PitchRegions, 'kickOffHex'>` now includes `'homeGoal' | 'awayGoal'`

---

### `packages/shared/src/pitch.test.ts` (test — rewrite)

**Analog:** `packages/shared/src/hex.test.ts` (exact match — same test framework, same file structure)

**Test file structure** (`packages/shared/src/hex.test.ts` lines 1-13):

```typescript
import { describe, it, expect } from 'vitest';
import {
  hexDistance,
  hexNeighbors,
  // ...named imports from the module under test
} from './hex.js';

describe('functionName', () => {
  it('description with requirement tag (PITCH-01)', () => {
    expect(result).toHaveLength(400);
  });
});
```

**Note:** Import from `'./pitch.js'` (not `'./pitch'`) — NodeNext module resolution requires `.js` extensions on local imports. This is established in all existing test files.

**Tests to rewrite (from RESEARCH.md Pitfall 3 — pitch.test.ts breaks after grid replacement):**

| Old assertion                                             | New assertion                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `PITCH_HEXES.length === 400`                              | `PITCH_HEXES.length === 962`                                        |
| `kickOffHex: { q: 12, r: 7 }`                             | `kickOffHex: { q: 18, r: 13 }`                                      |
| `isInRegion({ q: 3, r: 7 }, 'homeThird') === true`        | `isInRegion({ q: 5, r: 12 }, 'homeThird') === true` (q≤10)          |
| `isInRegion({ q: 17, r: 7 }, 'awayThird') === true`       | `isInRegion({ q: 30, r: 12 }, 'awayThird') === true` (q≥26)         |
| `isInRegion({ q: 22, r: 7 }, 'awayPenaltyArea') === true` | `isInRegion({ q: 33, r: 12 }, 'awayPenaltyArea') === true`          |
| `isDifficultAngle({ q: 2, r: 3 }) === true`               | Update to real coordinates from board photo                         |
| `isDifficultAngle({ q: 22, r: 11 }) === true`             | Update to real coordinates from board photo                         |
| `DIFFICULT_ANGLE_HEXES.size === 16`                       | Keep count assertion; update count to actual total from board photo |
| `isPitchHex({ q: 24, r: 15 }) === true`                   | Change to `isPitchHex({ q: 36, r: 25 }) === true`                   |
| `isPitchHex({ q: 25, r: 0 }) === false`                   | Change to `isPitchHex({ q: 37, r: 0 }) === false`                   |
| `isPitchHex({ q: 0, r: 16 }) === false`                   | Change to `isPitchHex({ q: 0, r: 26 }) === false`                   |

**Add new tests for homeGoal/awayGoal regions:**

```typescript
it('homeGoal contains q=0 r=12', () => {
  expect(isInRegion({ q: 0, r: 12 }, 'homeGoal')).toBe(true);
});
it('homeGoal does not contain q=1 r=12', () => {
  expect(isInRegion({ q: 1, r: 12 }, 'homeGoal')).toBe(false);
});
```

---

### `packages/client/vitest.config.ts` (config)

**Analog:** `packages/shared/vitest.config.ts` (exact match) + `packages/server/vitest.config.ts` (exact match)

Both existing vitest configs are identical. The client config only differs in: `environment: 'jsdom'` (for React/DOM testing) and `include: ['src/**/*.test.{ts,tsx}']` (add `.tsx` extension).

**Existing pattern** (`packages/shared/vitest.config.ts` lines 1-8):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

**Client adaptation:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
  },
});
```

---

## Shared Patterns

### Named Exports (No Default Exports)

**Source:** All modules in `packages/shared/src/` — every file uses named exports exclusively.
**Apply to:** All client TypeScript/TSX files.

```typescript
// Correct
export function HexGrid() { ... }
export const useGameStore = create<GameStore>()(...);
// Never
export default function HexGrid() { ... }
```

### `.js` Extensions on Local Imports

**Source:** `packages/shared/src/hex.ts` line 1, `packages/shared/src/moveValidator.ts` lines 15-16, `packages/client/src/main.ts` lines 1-2
**Apply to:** All TypeScript local imports in `packages/client/src/`.

```typescript
// Correct — NodeNext / verbatimModuleSyntax requires .js extensions
import { axialToPixel } from '../utils/hexToPixel.js';
import { App } from './App.js';
// Never
import { axialToPixel } from '../utils/hexToPixel';
```

Note: Vite handles `.tsx` source files transparently when the import uses `.js` extension (TypeScript emits `.js`; Vite resolves either at runtime).

### `import type` for Type-Only Imports

**Source:** `packages/shared/src/hex.ts` line 1, `packages/shared/src/moveValidator.ts` line 15, `packages/client/src/main.ts` line 1
**Apply to:** All files that import TypeScript types from `@counter-attack/shared`.

```typescript
// Correct — verbatimModuleSyntax requires type-only imports to use `import type`
import type { HexCoord, GameState, PlayerPiece } from '@counter-attack/shared';
import { hexDistance, validateMove } from '@counter-attack/shared';
```

### Import from Workspace Package (Not Relative Paths)

**Source:** `packages/client/src/main.ts` lines 1-2, `packages/server/src/roomStore.ts` line 14
**Apply to:** All client files importing from the shared package.

```typescript
// Correct
import type { GameState } from '@counter-attack/shared';
import { PITCH_HEXES, isInRegion } from '@counter-attack/shared';
// Never
import type { GameState } from '../../shared/src/types.js';
```

### Discriminated Union for State Results

**Source:** `packages/server/src/roomStore.ts` lines 53-63, `packages/shared/src/moveValidator.ts` lines 29-40
**Apply to:** `useGameStore.ts` action results (if any), `hexToPixel.ts` error cases.

```typescript
// Pattern: ok: boolean as discriminant, reason on false branch
type Result = { ok: false; reason: 'REASON_A' | 'REASON_B' } | { ok: true; data: T };
```

### Readonly Types for Immutable Data

**Source:** `packages/shared/src/types.ts` lines 95, 97, `packages/shared/src/pitch.ts` line 17
**Apply to:** All mock state files, all constants in hexToPixel.ts, store state.

```typescript
export const PITCH_HEXES: readonly HexCoord[] = [...];
// GameState.pieces is readonly PlayerPiece[] — preserve this in store mutations
const updatedPieces = gameState.pieces.map(...); // returns new array, not mutation
```

### JSDoc Comments with Source Citations

**Source:** All functions in `packages/shared/src/hex.ts` (lines 18-21, 27-30, etc.)
**Apply to:** All exported functions in `hexToPixel.ts`, `useGameStore.ts` actions.

```typescript
/**
 * One-line description of what it does.
 * Source: redblobgames.com/grids/hexagons/ or CONTEXT.md D-03
 */
export function functionName(...): ReturnType { ... }
```

---

## No Analog Found

| File                                          | Role   | Data Flow | Reason                                                                                                   |
| --------------------------------------------- | ------ | --------- | -------------------------------------------------------------------------------------------------------- |
| `packages/client/index.html`                  | config | —         | No HTML files exist in the codebase; use standard Vite template with `<div id="root">`                   |
| `packages/client/src/App.module.css`          | config | —         | No CSS files exist in codebase; pure greenfield                                                          |
| `packages/client/src/components/*.module.css` | config | —         | CSS Modules are greenfield; follow RESEARCH.md Pattern 6 (Vite handles natively via `vite/client` types) |

**For index.html:** Standard Vite template:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Counter Attack</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## Metadata

**Analog search scope:** `packages/shared/src/`, `packages/server/src/`, `packages/client/src/`
**Files scanned:** 18 source files read in full; 4 config files read in full
**Pattern extraction date:** 2026-05-30

**Version pinning reminders (from RESEARCH.md Pitfalls 1 and 2):**

- Pin `zustand@^4.5.7` — npm `latest` is 5.x with breaking API changes
- Pin `react@^18.3.1` — npm `latest` is 19.x with type definition changes
- Pin `react-dom@^18.3.1`, `@types/react@^18.3.1`, `@types/react-dom@^18.3.1` to match

**Blocking pre-condition:** `packages/shared/src/pitch.ts` update requires the board photo (`docs/board-photo.jpg`) for accurate `DIFFICULT_ANGLE_HEXES` coordinates. Planner must include a Wave 0 task to verify this file exists before deriving difficult-angle coordinates.
