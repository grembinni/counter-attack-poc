# Phase 6: React Hex Grid Renderer — Research

**Researched:** 2026-05-31
**Domain:** React 18 + Vite 5 + Zustand 4 + SVG hex rendering
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Hex orientation is flat-top — flat horizontal edges at top/bottom, pointy vertices on left/right.
- **D-02:** q-axis runs left-to-right (q=0 = home goal end, q=36 = away goal end). r-axis runs top-to-bottom.
- **D-03:** `axialToPixel` for flat-top hexes: `cx = hexSize * (3/2 * q)`, `cy = hexSize * (√3/2 * q + √3 * r)`. SVG polygon points use flat-top vertex angles (0°, 60°, 120°, 180°, 240°, 300°).
- **D-04:** Replace placeholder 25×16 grid with real 37×26 grid: q∈[0,36], r∈[0,25], 962 hexes.
- **D-05:** Region boundaries encoded as `ReadonlySet<string>`. Home final third q∈[0,10]; Middle q∈[11,25]; Away q∈[26,36]; Goals q=0/q=36 r∈[9,15]; Home 6-yard q∈[0,1] r∈[8,17]; Away 6-yard q∈[35,36] r∈[8,17]; Home penalty q∈[0,5] r∈[5,19]; Away penalty q∈[31,36] r∈[5,19]; Centre circle hexDistance≤3 from ~q=18, r=12; Kickoff hex ~q=18, r=12.
- **D-06:** Board photo saved to `docs/board-photo.jpg` as ground truth.
- **D-07:** Valid move destinations computed client-side using `validateMove()` from `@counter-attack/shared`.
- **D-08:** In Phase 7, highlighting requires zero changes — Zustand store update path swaps mock mutation for socket broadcast.
- **D-09:** Highlighting applies only to MOVEMENT phase in Phase 6.
- **D-10:** Zustand store holds `GameState` (mock in Phase 6). On piece-click-to-move, store mutates state locally.
- **D-11:** Multiple mock states exported from `packages/client/src/mock/` — one per relevant `GamePhase`. `mockMovementState` default on app load.
- **D-12:** 4 screens: Create Room, Join Room, Waiting, Game Board. Navigation via `screen: Screen` in Zustand store. No React Router.
- **D-13:** Lobby screens standalone, no server connection.

### Claude's Discretion

- Hex size / SVG viewport: hexSize=18–22px. hexSize=20 selected in UI-SPEC.
- Component decomposition: `HexGrid`, `HexCell`, `PieceOverlay`, `BallMarker`, `TurnIndicator`, `ActionLog`, `LobbyScreen`.
- Layout: pitch ~80% viewport width, 280px right sidebar, 1280px desktop target.
- Difficult-angle hex coordinates: derive from board photo + existing pitch.ts logic.

### Deferred Ideas (OUT OF SCOPE)

- Pass/Shot/Header click-to-highlight (Phase 7)
- React Router / URL-based navigation (Phase 7+)
- Connection status indicator (Phase 7)
- Undo button (Phase 7)
- Animations (out of scope v1)

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                          | Research Support                                                                                           |
| -------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| PITCH-04 | Player selects a piece by clicking it; valid destination hexes highlight immediately | `validateMove()` already exists in shared; `hexesInRange()` scans candidates; Zustand `selectPiece` action |
| PITCH-05 | Ball position is visually distinct from player positions at all times                | `BallMarker` SVG circle at r=6 with off-white fill; rendered above hex fills, below piece circles          |
| UX-01    | Turn indicator displays active player/team and current game phase at all times       | TurnIndicator component reading `gameState.phase`, `gameState.activeTeam`, `gameState.movementSlot`        |
| UX-02    | Valid destination hexes highlight when piece selected; invalid moves not clickable   | `validMoveHexes` in Zustand store; highlight overlay polygon on each valid hex; no handler on others       |
| UX-03    | Server-side event log records every action as structured object                      | `ActionEvent` union already in `types.ts`; ActionLog renders `gameState.eventLog` in Phase 6 from mock     |
| UX-04    | Event log stored in server memory for match duration, used for reconnection replay   | Satisfied by existing `GameState.eventLog: readonly ActionEvent[]`; Phase 6 renders mock log               |

</phase_requirements>

---

## Summary

Phase 6 bootstraps the React client from its current `main.ts` placeholder into a fully interactive SVG hex-grid UI. It is a pure frontend phase — no server connection, all state from hardcoded mock `GameState` objects. The deliverables are: Vite 5 + React 18 TypeScript scaffold, Zustand 4 store, SVG pitch (962 hexes, flat-top), piece overlays, ball marker, valid-move highlighting, lobby screens, turn indicator, and action log.

The single most consequential decision in this phase is **replacing `packages/shared/src/pitch.ts`** from the 25×16 placeholder to the real 37×26 grid with exact region boundaries from CONTEXT.md D-05. This change invalidates all existing `pitch.test.ts` assertions (hardcoded around the 25×16 grid) — those tests must be rewritten alongside the new pitch constants. All other shared modules (`moveValidator`, `passValidator`, `shotValidator`, etc.) call `isInRegion()` and `isDifficultAngle()` which must continue to pass after the grid update.

The honeycomb-grid 4.x library is present in the locked stack (CLAUDE.md), but the axialToPixel formula is already fully defined in CONTEXT.md D-03. Honeycomb-grid is not needed for the SVG coordinate calculation itself — `hex.corners` from `defineHex` duplicates what the locked formula produces. The library is useful if the planner wants to use `Grid.pointToHex()` for click-to-hex reverse mapping in future phases. For Phase 6, the locked `axialToPixel` formula covers all pixel coordinate needs; honeycomb-grid should be installed as a dep (locked stack decision) but the rendering math lives in a standalone `hexToPixel.ts` utility that applies the D-03 formula directly.

**Primary recommendation:** Write all hex rendering math as pure functions in `packages/client/src/utils/hexToPixel.ts` using the locked D-03 formula. Zustand `create<GameStore>()((set, get) => ...)` with curried TypeScript. Vite 5 workspace resolution via `workspace:*` dep — no `resolve.alias` needed because the shared package is a proper pnpm workspace dep with `exports` field. CSS Modules work out of the box in Vite — no extra declarations required.

---

## Architectural Responsibility Map

| Capability                  | Primary Tier     | Secondary Tier | Rationale                                                                            |
| --------------------------- | ---------------- | -------------- | ------------------------------------------------------------------------------------ |
| Hex pixel coordinate math   | Browser / Client | —              | Pure math function; no server involvement; defined by locked D-03 formula            |
| SVG pitch rendering         | Browser / Client | —              | Static SVG in React; all hex geometry computed client-side                           |
| Valid-move computation      | Browser / Client | API / Backend  | Client uses `validateMove()` for highlighting (D-07); server re-validates on action  |
| Zustand state (mock)        | Browser / Client | —              | Phase 6: local mock only. Phase 7: server broadcasts replace local mutation          |
| Lobby screen routing        | Browser / Client | —              | `screen` field in Zustand store; no URL routing (D-12)                               |
| 37×26 pitch region encoding | shared package   | —              | `packages/shared/src/pitch.ts` consumed by both client renderer and server validator |
| Mock state generation       | Browser / Client | —              | `packages/client/src/mock/` — pure data, no server                                   |

---

## Standard Stack

### Core

| Library              | Version      | Purpose                                         | Why Standard                                             | Source                   |
| -------------------- | ------------ | ----------------------------------------------- | -------------------------------------------------------- | ------------------------ |
| react                | 18.3.1       | UI component tree                               | Locked in CLAUDE.md stack                                | [VERIFIED: npm registry] |
| react-dom            | 18.3.1       | DOM render target                               | Always paired with react                                 | [VERIFIED: npm registry] |
| vite                 | 5.4.21 (5.x) | Dev server + build bundler                      | Locked in CLAUDE.md stack                                | [VERIFIED: npm registry] |
| @vitejs/plugin-react | 4.7.0        | React JSX transform + HMR for Vite              | Official Vite plugin for React; required for JSX         | [VERIFIED: npm registry] |
| zustand              | 4.5.7        | Client state management                         | Locked in CLAUDE.md stack                                | [VERIFIED: npm registry] |
| honeycomb-grid       | 4.1.5        | Hex grid math (Grid, defineHex, traverse)       | Locked in CLAUDE.md stack; renders hex.corners if needed | [VERIFIED: npm registry] |
| socket.io-client     | 4.8.3        | WebSocket client (install now; wire in Phase 7) | Locked in CLAUDE.md stack; dep adds 0 cost in Phase 6    | [VERIFIED: npm registry] |
| typescript           | 5.9.3        | Type checking                                   | Already in root monorepo                                 | [VERIFIED: npm registry] |

**Note on React version:** `npm view react` returns v19.2.6 as the current `latest` tag. However, CLAUDE.md explicitly locks React 18.x. Install `react@18` and `react-dom@18` — pinned to 18.3.1 which is the final 18.x release. `@types/react@18` and `@types/react-dom@18` for TypeScript. [ASSUMED: React 18 and React 19 are not API-compatible for all hooks patterns — confirm `@vitejs/plugin-react@4.x` supports React 18 before upgrading.]

**Note on Zustand version:** npm `latest` tag is zustand 5.0.14 (a breaking rewrite). Locked stack specifies 4.x. Pin to `zustand@4.5.7`. The `create<T>()((set) => ...)` curried API applies to 4.x. Zustand 5 uses a different `createStore` API — do not upgrade. [VERIFIED: npm registry]

### Supporting (testing)

| Library                | Version | Purpose                           | When to Use                                   | Source                   |
| ---------------------- | ------- | --------------------------------- | --------------------------------------------- | ------------------------ |
| vitest                 | 2.1.9   | Test runner (already in monorepo) | If client unit tests are written              | [VERIFIED: npm registry] |
| @testing-library/react | 14.3.1  | Component testing utilities       | Component interaction tests if written        | [VERIFIED: npm registry] |
| jsdom                  | 25.x    | DOM environment for vitest        | vitest `environment: 'jsdom'` for React tests | [VERIFIED: npm registry] |

**vitest slopcheck note:** slopcheck 0.6.1 flags `vitest` as `[SUS]` because the name resembles `vite`. This is a known false positive — vitest is an official Vite-team test runner already used in `packages/shared` and `packages/server` in this project. Status: APPROVED — existing project use is the highest legitimacy signal. [CITED: vitest.dev/guide/]

### Alternatives Considered

| Instead of                               | Could Use                    | Tradeoff                                                                                 |
| ---------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| Custom `axialToPixel` in hexToPixel.ts   | honeycomb-grid `hex.corners` | honeycomb-grid adds ~14KB; D-03 formula is 2 lines. Phase 6 uses formula directly.       |
| Zustand 4.x `create<T>()()`              | Zustand 5 `createStore()`    | Zustand 5 is a breaking rewrite; stack is locked to 4.x                                  |
| Vitest + jsdom                           | Jest + jsdom                 | Vitest is already the project standard; switching would add config churn                 |
| `vite build` pointing to monorepo shared | Bundling shared into client  | `workspace:*` dep + Vite resolves through dist/; cleaner and already the project pattern |

**Installation (packages/client):**

```bash
pnpm add react@18 react-dom@18 zustand@4 honeycomb-grid socket.io-client
pnpm add -D vite@5 @vitejs/plugin-react@4 @types/react@18 @types/react-dom@18 vitest jsdom @testing-library/react@14
```

---

## Package Legitimacy Audit

> slopcheck 0.6.1 run on 2026-05-31.

| Package                | Registry | Age     | Source Repo                                      | slopcheck | Disposition                                                             |
| ---------------------- | -------- | ------- | ------------------------------------------------ | --------- | ----------------------------------------------------------------------- |
| react                  | npm      | ~12 yrs | github.com/facebook/react                        | [OK]      | Approved                                                                |
| react-dom              | npm      | ~12 yrs | github.com/facebook/react                        | [OK]      | Approved                                                                |
| vite                   | npm      | ~5 yrs  | github.com/vitejs/vite                           | [OK]      | Approved                                                                |
| @vitejs/plugin-react   | npm      | ~4 yrs  | github.com/vitejs/vite-plugin-react              | [OK]      | Approved                                                                |
| zustand                | npm      | ~6 yrs  | github.com/pmndrs/zustand                        | [OK]      | Approved                                                                |
| honeycomb-grid         | npm      | ~7 yrs  | github.com/flauwekeul/honeycomb                  | [OK]      | Approved                                                                |
| socket.io-client       | npm      | ~11 yrs | github.com/socketio/socket.io                    | [OK]      | Approved (flagged name pattern, but established)                        |
| vitest                 | npm      | ~3 yrs  | github.com/vitest-dev/vitest                     | [SUS]     | Approved — false positive; official Vite test runner already in project |
| @testing-library/react | npm      | ~6 yrs  | github.com/testing-library/react-testing-library | [OK]      | Approved                                                                |
| jsdom                  | npm      | ~12 yrs | github.com/jsdom/jsdom                           | [OK]      | Approved                                                                |

**Packages removed due to [SLOP]:** none

**Packages flagged as suspicious [SUS]:** vitest — false positive, already used in project, approved.

---

## Architecture Patterns

### System Architecture Diagram

```
User Click
    │
    ▼
HexCell / PieceOverlay (SVG click handler)
    │
    ▼
useGameStore.selectPiece(id) / .movePiece(hex)
    │
    ├─── selectPiece: calls validateMove() from @counter-attack/shared
    │      (iterates hexesInRange(piece.position, piece.pace))
    │      writes validMoveHexes[] to store
    │
    └─── movePiece: mutates GameState.pieces[].position in store
           (Phase 7: replaced by socket.emit → socket.on('game:state'))
    │
    ▼
Zustand store triggers re-render
    │
    ▼
HexGrid (SVG) reads: PITCH_HEXES, validMoveHexes, pieces, ball
    │
    ├── HexCell × 962  (base polygon + optional highlight overlay)
    ├── PieceOverlay × 22  (circle + label per PlayerPiece)
    └── BallMarker × 1

App (screen router)
    ├── screen === 'GAME_BOARD'  → <GameBoard /> (HexGrid + sidebar)
    └── screen !== 'GAME_BOARD' → <LobbyScreen /> (Create/Join/Waiting)
```

### Recommended Project Structure

```
packages/client/
├── index.html                    # Vite entry
├── vite.config.ts                # Vite config with react plugin
├── tsconfig.json                 # extends ../../tsconfig.base.json
├── package.json                  # React 18, Vite 5, Zustand 4, deps
└── src/
    ├── main.tsx                  # replaces main.ts; ReactDOM.createRoot
    ├── App.tsx                   # root: header + screen router
    ├── App.module.css
    ├── components/
    │   ├── LobbyScreen.tsx       # Create/Join/Waiting based on screen
    │   ├── LobbyScreen.module.css
    │   ├── GameBoard.tsx         # pitch container + sidebar layout
    │   ├── GameBoard.module.css
    │   ├── HexGrid.tsx           # <svg> element; renders all HexCell + overlays
    │   ├── HexGrid.module.css
    │   ├── HexCell.tsx           # single hex <polygon> + fill + click
    │   ├── HexCell.module.css
    │   ├── PieceOverlay.tsx      # <circle> + <text> for one PlayerPiece
    │   ├── BallMarker.tsx        # <circle> for ball position
    │   ├── TurnIndicator.tsx     # active team / phase / slot panel
    │   ├── TurnIndicator.module.css
    │   ├── ActionLog.tsx         # last N ActionEvents as text
    │   └── ActionLog.module.css
    ├── store/
    │   └── useGameStore.ts       # Zustand store: GameState + screen + selection
    ├── utils/
    │   └── hexToPixel.ts         # axialToPixel(q, r, hexSize) + polygonPoints(cx, cy, hexSize)
    └── mock/
        ├── index.ts              # barrel export of all mock states
        ├── mockMovementState.ts  # MOVEMENT phase (default on app load)
        ├── mockPassState.ts      # PASS phase
        ├── mockShotState.ts      # SHOT phase
        └── mockGKRestartState.ts # GK_RESTART phase
```

---

### Pattern 1: Vite Config for pnpm Monorepo

**What:** `@counter-attack/shared` is declared as a `workspace:*` dep in `packages/client/package.json`. Because `packages/shared/package.json` has an `exports` field pointing to `./dist/index.js`, Vite resolves the import via the compiled dist output. No `resolve.alias` needed — the workspace link is resolved by pnpm before Vite sees it.

**Critical prerequisite:** `@counter-attack/shared` must be built (`pnpm build` in `packages/shared`) before running `packages/client/src` in dev mode or build. The client's Vite dev server cannot see TypeScript source files in the shared package without a dedicated source-plugin setup (adding complexity). Standard monorepo pattern: build shared first. [CITED: vite.dev/config/]

**Example:**

```typescript
// packages/client/vite.config.ts
// Source: vite.dev/config/ + standard pnpm workspace pattern
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

```json
// packages/client/package.json (relevant additions)
{
  "name": "@counter-attack/client",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@counter-attack/shared": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.7",
    "honeycomb-grid": "^4.1.5",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "vite": "^5.4.21",
    "@vitejs/plugin-react": "^4.7.0",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "vitest": "^2.1.9",
    "jsdom": "^25.0.0",
    "@testing-library/react": "^14.3.1"
  }
}
```

```json
// packages/client/tsconfig.json — update existing file
// Source: existing tsconfig.base.json pattern + vite.dev requirements
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

The `"types": ["vite/client"]` addition is needed for CSS Module `*.module.css` import typing — it adds the ambient `declare module '*.module.css'` that suppresses TypeScript errors on CSS Module imports. [CITED: vite.dev/guide/features#css-modules]

---

### Pattern 2: Zustand 4.x Store with TypeScript

**What:** Curried `create<T>()((set, get) => ...)` pattern required in Zustand 4.x for TypeScript — the non-curried form loses type inference. [CITED: zustand.docs.pmnd.rs/learn/guides/beginner-typescript]

**Immer not needed:** The GameStore mutations in Phase 6 are simple object spreads (`pieces.map(...)` to replace one item). Immer middleware adds complexity without benefit at this scale.

```typescript
// packages/client/src/store/useGameStore.ts
// Source: zustand.docs.pmnd.rs/learn/guides/beginner-typescript
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
    // Build valid destination set: scan all hexes in pace range
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

**Selector pattern** — components subscribe to only the slice they need to avoid unnecessary re-renders:

```typescript
// Component only re-renders when validMoveHexes changes
const validMoveHexes = useGameStore((s) => s.validMoveHexes);
```

---

### Pattern 3: Flat-Top Hex SVG Math

**What:** Pure functions in `hexToPixel.ts` implementing the locked D-03 formula. No honeycomb-grid needed for rendering. [ASSUMED: the formula in CONTEXT.md D-03 matches the physical board — the hex size of 20px and the formula produce correct visual output for 1280px viewport]

```typescript
// packages/client/src/utils/hexToPixel.ts
// Source: CONTEXT.md D-03 (locked decision) + redblobgames.com/grids/hexagons/

export const HEX_SIZE = 20; // circumradius — confirms hexSize from UI-SPEC

/**
 * Converts axial hex coordinate to SVG pixel center point.
 * Flat-top orientation as per CONTEXT.md D-03.
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
 * Returns the 6 corner points for a flat-top hex polygon.
 * Flat-top vertex angles: 0°, 60°, 120°, 180°, 240°, 300°.
 * Source: CONTEXT.md D-03, redblobgames.com/grids/hexagons/
 */
export function hexPolygonPoints(cx: number, cy: number, hexSize: number = HEX_SIZE): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angleDeg = 60 * i; // flat-top: 0°, 60°, 120°, 180°, 240°, 300°
    const angleRad = (Math.PI / 180) * angleDeg;
    return `${cx + hexSize * Math.cos(angleRad)},${cy + hexSize * Math.sin(angleRad)}`;
  }).join(' ');
}

/**
 * Computes the SVG viewBox for the full 37×26 grid.
 * Adds one hexSize of padding on each side.
 */
export function computeViewBox(hexSize: number = HEX_SIZE): string {
  const maxCoord = axialToPixel(36, 25, hexSize);
  const width = maxCoord.cx + hexSize * 2;
  const height = maxCoord.cy + hexSize * 2;
  return `0 0 ${width} ${height}`;
}
```

**Flat-top vertex angle verification at hexSize=20:**

- Angle 0° → vertex at (cx+20, cy) — rightmost point
- Angle 60° → vertex at (cx+10, cy+17.32)
- Angle 120° → vertex at (cx-10, cy+17.32)
- Angle 180° → vertex at (cx-20, cy)
- Angle 240° → vertex at (cx-10, cy-17.32)
- Angle 300° → vertex at (cx+10, cy-17.32)

This produces a regular flat-top hexagon with flat edges at top/bottom (the 120°–240° and 300°–60° edges) and vertices at left/right (0° and 180°), consistent with D-01. [ASSUMED: visual inspection at implementation will confirm the geometry matches physical board orientation]

---

### Pattern 4: HexCell Component

**What:** SVG `<polygon>` for base hex + optional overlay polygon for valid-move highlight. Two-polygon approach per UI-SPEC (highlight does not replace base fill, it overlays at 0.55 opacity).

```typescript
// packages/client/src/components/HexCell.tsx
// Source: UI-SPEC §Hex Grid Visual Spec + CONTEXT.md D-03
import React, { useState } from 'react';
import type { HexCoord } from '@counter-attack/shared';
import { axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';
import { isDifficultAngle } from '@counter-attack/shared';
import { PITCH_REGIONS } from '@counter-attack/shared';

type Props = {
  hex: HexCoord;
  isGoal: boolean;
  isHighlighted: boolean;
  onClick: () => void;
};

export function HexCell({ hex, isGoal, isHighlighted, onClick }: Props) {
  const { cx, cy } = axialToPixel(hex.q, hex.r);
  const points = hexPolygonPoints(cx, cy);
  const stripeClass = (hex.q + hex.r) % 2 === 0 ? '#4a7c3f' : '#3d6b34';
  const baseFill = isGoal ? '#1a1a1a' : stripeClass;
  const [hovered, setHovered] = useState(false);

  return (
    <g>
      <polygon
        points={points}
        fill={baseFill}
        stroke="#2d5227"
        strokeWidth={0.5}
        onClick={isHighlighted ? onClick : undefined}
        onMouseEnter={() => isHighlighted && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: isHighlighted ? 'pointer' : 'default' }}
      />
      {isHighlighted && (
        <polygon
          points={points}
          fill="#f5c518"
          fillOpacity={hovered ? 0.75 : 0.55}
          stroke="#d4a017"
          strokeWidth={hovered ? 2 : 1.5}
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

### Pattern 5: pitch.ts Replacement

**What:** Replace the placeholder 25×16 grid with the real 37×26 grid from CONTEXT.md D-05. The `PitchRegions` type, `isInRegion`, `isDifficultAngle`, `isPitchHex`, and `PITCH_HEXES` all remain — only the constants change.

**Goal hexes** — the current `pitch.ts` has no `goalHexes` region. Phase 6 needs it for `isGoal` rendering. Add it to `PitchRegions`:

```typescript
// Addition to PitchRegions type
homeGoal: ReadonlySet<string>; // q=0, r∈[9,15]
awayGoal: ReadonlySet<string>; // q=36, r∈[9,15]
```

**Impact on existing tests:** `pitch.test.ts` contains 11 test cases with hardcoded coordinates from the 25×16 placeholder grid. All of these must be rewritten for the 37×26 grid. The test for `PITCH_HEXES.length === 400` must change to `=== 962`. The kickoff hex changes from `{q:12, r:7}` to `{q:18, r:12}`. All `isInRegion` boundary tests need new coordinates matching D-05 boundaries.

**Impact on other validators:** `moveValidator.ts`, `passValidator.ts`, `shotValidator.ts`, etc. call `isInRegion()` and `isDifficultAngle()` — they do not import coordinates directly, only call these functions. After the pitch.ts update, those modules are correct by construction as long as `isInRegion` and `isDifficultAngle` continue to work. Their own tests (moveValidator.test.ts etc.) do not use coordinates that would be affected — they use piece positions that are well inside the grid.

**Difficult-angle hexes:** Current `DIFFICULT_ANGLE_HEXES` uses 16 placeholder coordinates. Phase 6 must derive the real coordinates from the board photo (CONTEXT.md D-06). The planner must include a task to inspect the board photo and map visible white dots to (q, r) coordinates in the 37×26 grid before implementing the pitch.ts update.

---

### Pattern 6: CSS Modules in Vite

**What:** Files named `*.module.css` are automatically treated as CSS Modules. Import returns an object of class name strings. TypeScript sees them as `{ [className: string]: string }` via `vite/client` types. No extra declarations needed. [CITED: vite.dev/guide/features#css-modules]

```typescript
// Component usage
import styles from './GameBoard.module.css';
// styles.pitchContainer etc. are typed as string
<div className={styles.pitchContainer}>
```

**No need for type-gen plugins** (`vite-css-modules`, `ts-css-modules-vite-plugin`) in Phase 6 — they provide stricter class-name type checking but add build complexity. The default `{ [key: string]: string }` typing is sufficient for this project.

---

### Anti-Patterns to Avoid

- **Calling `validateMove()` on all 962 hexes on every click** — `hexesInRange(piece.position, piece.pace)` limits the candidate set to at most ~18–91 hexes depending on pace. Never iterate all PITCH_HEXES.
- **Using offset coordinates for rendering** — all rendering is axial (q, r) → pixel via `axialToPixel`. Never introduce offset coordinates.
- **Rendering PieceOverlay as a sibling `<svg>`** — all SVG elements (HexCell, PieceOverlay, BallMarker) must be children of the same `<svg>` root so z-order is controlled by DOM order within the SVG.
- **Setting SVG `width`/`height` as fixed px values** — set `width="100%"` and let the `viewBox` aspect ratio control the height. A fixed height makes the pitch non-responsive.
- **Storing GameState as plain `useState`** — Zustand is the locked state solution. `useState` in components is only for transient UI state (hover).
- **Importing `packages/shared/src/...` with relative paths from client** — always import from `@counter-attack/shared` (the workspace package), never via `../../shared/src/`.

---

## Don't Hand-Roll

| Problem                      | Don't Build                         | Use Instead                                                                 | Why                                                                            |
| ---------------------------- | ----------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Hex distance / neighbor math | Custom axial arithmetic             | `hexDistance`, `hexNeighbors`, `hexesInRange` from `@counter-attack/shared` | Already battle-tested with 84 passing tests                                    |
| Valid move computation       | Custom movement rule checking       | `validateMove()` from `@counter-attack/shared`                              | All edge cases (pace cap, ZoI, occupied, ATTACKER_2) covered by existing tests |
| Pitch region membership      | Custom set/boundary logic           | `isInRegion()`, `isDifficultAngle()` from pitch.ts                          | O(1) ReadonlySet lookups; consistency with server-side validation              |
| Client state                 | React Context + useReducer          | Zustand 4.x (locked)                                                        | Zero boilerplate; selector subscriptions prevent extra re-renders              |
| Hex polygon points formula   | Approximate polygon from CSS shapes | Pure `hexPolygonPoints()` function using D-03                               | CSS shapes cannot produce the correct flat-top hex geometry for click handling |
| Copy-to-clipboard            | Custom document.execCommand         | `navigator.clipboard.writeText()`                                           | execCommand is deprecated; clipboard API works in modern browsers              |

---

## Runtime State Inventory

> Omitted — this is a greenfield phase (bootstrapping client from placeholder; no rename/refactor/migration involved).

---

## Common Pitfalls

### Pitfall 1: Zustand 5 vs Zustand 4 API

**What goes wrong:** `npm install zustand` installs v5.0.14 (current `latest`). The `create()` API changed — Zustand 5 deprecated the curried form and changed the `combine` middleware. Code written for Zustand 4 fails at runtime in Zustand 5.
**Why it happens:** npm `latest` tag points to Zustand 5; the lock in CLAUDE.md specifies `4.x`.
**How to avoid:** Pin explicitly: `zustand@^4.5.7` in package.json.
**Warning signs:** TypeScript errors on `create<GameStore>()((set) => ...)` curried form; `zustand/middleware` import failures.

### Pitfall 2: React 19 vs React 18

**What goes wrong:** `npm install react react-dom` installs v19.x (current `latest`). React 19 changed several hooks behaviors and the `@types/react@19` type definitions differ (e.g., `children` prop is no longer implicitly typed). The project locks to React 18.
**Why it happens:** npm `latest` is React 19.2.6 as of 2026-05-31.
**How to avoid:** Pin `react@^18.3.1`, `react-dom@^18.3.1`, `@types/react@^18.3.1`, `@types/react-dom@^18.3.1`.
**Warning signs:** Type errors on `React.FC`, implicit `children` prop, or experimental hook APIs.

### Pitfall 3: pitch.test.ts Breaks After Grid Replacement

**What goes wrong:** After updating `pitch.ts` to 37×26, all 11 existing `pitch.test.ts` tests fail. `pnpm -r test` goes red. The planner must treat pitch.test.ts rewriting as part of the same task as pitch.ts replacement — not a separate wave.
**Why it happens:** Tests use hardcoded coordinates from the 25×16 placeholder (e.g., `PITCH_HEXES.length === 400`, kickoff hex at `{q:12, r:7}`, boundary tests using old q values).
**How to avoid:** Rewrite pitch.test.ts in the same plan task as pitch.ts. Never commit pitch.ts update without a corresponding pitch.test.ts update.
**Warning signs:** `vitest run` output shows failures in `pitch.test.ts`; `PITCH_HEXES.length` mismatch.

### Pitfall 4: Shared Package Not Built Before Client Dev

**What goes wrong:** `pnpm dev` in `packages/client` fails with "Cannot find module '@counter-attack/shared'" or stale type definitions if `packages/shared/dist/` is absent or outdated.
**Why it happens:** Vite resolves `@counter-attack/shared` via the `exports` field pointing to `./dist/index.js`. If dist hasn't been built (or is from a previous state), the client sees stale or missing types.
**How to avoid:** Add a root-level `dev` script that builds shared first, then runs client dev. Wave 0 task must run `pnpm --filter @counter-attack/shared build` before starting the Vite dev server.
**Warning signs:** Module resolution errors in Vite dev server; TypeScript complaining about missing exports.

### Pitfall 5: SVG Coordinate System Origin

**What goes wrong:** The `axialToPixel` formula produces `cx = hexSize * (3/2) * q`. For q=0 and r=0, this gives (0, 0) — the hex center is at the SVG origin, which means half the hex is clipped by the viewport (outside the viewBox).
**Why it happens:** The formula gives the hex center. The SVG viewBox must start negative, OR the coordinates must be offset by one hexSize to ensure the leftmost hex is fully visible.
**How to avoid:** Apply padding: start viewBox at `(-hexSize, -hexSize * Math.sqrt(3)/2)` OR add `hexSize` to all cx/cy values. The `computeViewBox()` pattern in Pattern 3 above adds `hexSize * 2` to total dimensions; also shift origin by padding. Alternatively, apply an SVG `<g transform="translate(hexSize, hexSize * √3/2)">` wrapper.
**Warning signs:** First column (q=0) hexes appear clipped on the left side of the pitch SVG.

### Pitfall 6: HexGrid Re-Renders on Every Store Update

**What goes wrong:** If `HexGrid` reads the entire `gameState` object (not selected slices), it re-renders every time any field of `gameState` changes — including `eventLog` appends that don't affect the pitch.
**Why it happens:** Zustand compares by reference; a new `gameState` object triggers re-render of all subscribers that read the full object.
**How to avoid:** Use selector subscriptions. `HexGrid` should subscribe to `pieces` and `ball` separately. `ActionLog` subscribes only to `eventLog`. `TurnIndicator` subscribes only to `phase`, `activeTeam`, `movementSlot`, `movedPieceIds`.
**Warning signs:** React DevTools profiler shows HexGrid re-rendering when only the action log changes.

### Pitfall 7: validateMove Called With Wrong `to` Argument Type

**What goes wrong:** `validateMove(state, piece, hex)` signature takes `(GameState, PlayerPiece, HexCoord)` — second argument is `PlayerPiece`, not `pieceId`. The store's `selectPiece(id)` must look up the piece first.
**Why it happens:** It's easy to pass `id: string` directly to validateMove if the signature isn't carefully read.
**How to avoid:** In `selectPiece`, always do `const piece = gameState.pieces.find(p => p.id === id)` first, then pass `piece` to `validateMove`.
**Warning signs:** TypeScript type error on the second argument; or runtime "piece.position is undefined".

---

## Code Examples

Verified patterns from project codebase and official sources.

### axialToPixel (D-03 verified from CONTEXT.md)

```typescript
// Source: CONTEXT.md D-03 (locked decision)
function axialToPixel(q: number, r: number, hexSize: number) {
  return {
    cx: hexSize * (3 / 2) * q,
    cy: hexSize * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
  };
}
```

At hexSize=20, q=36, r=25:

- cx = 20 _ 1.5 _ 36 = 1080
- cy = 20 _ (√3/2 _ 36 + √3 _ 25) = 20 _ (31.18 + 43.30) = 20 \* 74.48 = 1489.6

SVG viewBox = `0 0 ~1120 ~1530` (adding 2×hexSize padding). At container width ~968px (1280 - 280 - 32), the pitch renders at approximately 968/1120 = 0.86× scale — each hex appears ~17px wide. Acceptable for the 20px hexSize design.

### Valid Move Computation Pattern

```typescript
// Source: CONTEXT.md D-07, packages/shared/src/moveValidator.ts
import { hexesInRange, validateMove } from '@counter-attack/shared';

function computeValidMoves(gameState: GameState, piece: PlayerPiece): HexCoord[] {
  // Limit candidates to pieces's pace range — never iterate all 962 hexes
  const candidates = hexesInRange(piece.position, piece.pace);
  return candidates.filter((hex) => validateMove(gameState, piece, hex).ok);
}
```

### Main Entry Point Pattern

```typescript
// packages/client/src/main.tsx
// Source: React 18 official docs (react.dev/reference/react-dom/client/createRoot)
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

Note: `index.html` needs `<div id="root"></div>` in the body.

### Zustand Selector Pattern (Performance)

```typescript
// Source: zustand.docs.pmnd.rs/learn/guides/beginner-typescript
// Each component subscribes only to the slice it needs
const phase = useGameStore((s) => s.gameState.phase);
const pieces = useGameStore((s) => s.gameState.pieces);
const validMoveHexes = useGameStore((s) => s.validMoveHexes);
```

---

## State of the Art

| Old Approach                        | Current Approach                   | When Changed                | Impact                                                          |
| ----------------------------------- | ---------------------------------- | --------------------------- | --------------------------------------------------------------- |
| Zustand `create()` without currying | `create<T>()()` curried form       | Zustand 3→4 TS improvements | Required for correct TypeScript inference in 4.x                |
| CRA (Create React App)              | Vite                               | ~2021–2022                  | Vite is now universal standard; CRA is archived                 |
| CSS-in-JS (styled-components)       | CSS Modules                        | Ongoing shift               | No runtime overhead; Vite handles natively; locked by CLAUDE.md |
| `ReactDOM.render()`                 | `createRoot().render()` (React 18) | React 18 (2022)             | Required for concurrent features; old API shows console warning |

**Deprecated/outdated:**

- `document.execCommand('copy')`: Deprecated. Use `navigator.clipboard.writeText()` for the lobby "Copy Code" button.
- `ReactDOM.render()`: Removed in React 19; use `createRoot()` in React 18+.
- Zustand `create()` non-curried form: Works but loses TypeScript inference in 4.x.
- pnpm `workspace:^` syntax: Use `workspace:*` (current project convention as seen in client/package.json).

---

## Assumptions Log

| #   | Claim                                                                                                  | Section                 | Risk if Wrong                                                                           |
| --- | ------------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------- |
| A1  | React 18 and `@vitejs/plugin-react@4.x` are mutually compatible (React 19 is current `latest`)         | Standard Stack          | Would need React 19 migration; breaking type changes                                    |
| A2  | The D-03 axialToPixel formula produces correct flat-top geometry for the physical Counter Attack board | Pattern 3, Pitfall 5    | Pitch renders but hex alignment doesn't match physical board; requires formula revision |
| A3  | hexSize=20 produces a legible pitch at 1280px viewport (UI-SPEC selection)                             | Pattern 3               | May need visual adjustment to 18 or 22; minor implementation tweak                      |
| A4  | Difficult-angle hex coordinates can be accurately derived from the board photo (docs/board-photo.jpg)  | Pattern 5               | Wrong coordinates produce incorrect difficulty-angle dots; impacts PITCH-03 rendering   |
| A5  | pnpm `workspace:*` resolution via `exports` field works without Vite `resolve.alias`                   | Pattern 1               | Would need to add `resolve.alias` pointing shared src path; minor config addition       |
| A6  | No client-side unit tests are required for Phase 6 (rendering-only phase)                              | Validation Architecture | If testing policy requires component tests, Wave 0 grows by 2–3 tasks                   |

---

## Open Questions (RESOLVED)

1. **Board photo location and difficult-angle coordinates**
   - What we know: CONTEXT.md D-06 says the board photo must be saved to `docs/board-photo.jpg`
   - What's unclear: The photo has not been verified as present in the repo. The planner must check whether it exists before attempting to derive difficult-angle hex coordinates.
   - Recommendation: First task in Wave 0 — confirm `docs/board-photo.jpg` exists; if not, the planner must request it from the user before deriving coordinates.
   - **RESOLVED:** `docs/board-photo.jpg` does not exist in the repo at planning time. Difficult-angle hexes approximated from Counter Attack rules — 16 hexes near penalty area corners on both ends. A `TODO: Verify against docs/board-photo.jpg when available (D-06)` comment is included in pitch.ts.

2. **Kickoff hex exact coordinates**
   - What we know: CONTEXT.md D-05 says "Kickoff hex: ~q=18, r=12 (exact centre of 37×26 grid)"
   - What's unclear: The `~` prefix indicates this is approximate. The true centre of q∈[0,36] is q=18; r∈[0,25] is r=12.5 (non-integer). The planner should use `{q:18, r:13}` as the kickoff hex (rounding down to nearest valid row) or `{q:18, r:12}` — verify against board photo.
   - Recommendation: Use `{q:18, r:13}` as default and note it for board photo verification.
   - **RESOLVED:** Plans use `{q:18, r:13}`. D-05 used `~` indicating approximate; r=12.5 rounds to 13 for an integer row. Noted for board photo verification when available.

3. **Goal hex region in PitchRegions type**
   - What we know: UI-SPEC specifies goal hexes render as `#1a1a1a`. Current `PitchRegions` type has no `homeGoal`/`awayGoal` field.
   - What's unclear: Whether to add goal hexes to `PitchRegions` in pitch.ts or handle them inline in HexCell via direct coordinate check.
   - Recommendation: Add `homeGoal` and `awayGoal` to `PitchRegions` for consistency with all other region lookups. This is a pure `pitch.ts` addition with no downstream breakage.
   - **RESOLVED:** `homeGoal` and `awayGoal` added to `PitchRegions` type (q=0 r∈[9,15] and q=36 r∈[9,15]) for consistency with all other region lookups.

---

## Environment Availability

| Dependency                        | Required By          | Available       | Version | Fallback                                               |
| --------------------------------- | -------------------- | --------------- | ------- | ------------------------------------------------------ |
| Node.js                           | Vite dev server      | ✓               | 22 LTS  | —                                                      |
| pnpm                              | Monorepo workspace   | ✓               | 9.15.9  | —                                                      |
| TypeScript                        | Type checking        | ✓               | 5.9.3   | —                                                      |
| @counter-attack/shared built dist | Client workspace dep | ✓ (after build) | —       | run `pnpm --filter @counter-attack/shared build` first |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Pre-condition:** `packages/shared` must be built before starting client dev — include in Wave 0.

---

## Validation Architecture

> `workflow.nyquist_validation: true` — section included.

### Test Framework

| Property           | Value                                           |
| ------------------ | ----------------------------------------------- |
| Framework          | vitest 2.1.9                                    |
| Config file        | `packages/client/vitest.config.ts` — Wave 0 gap |
| Quick run command  | `pnpm --filter @counter-attack/client test`     |
| Full suite command | `pnpm -r test`                                  |

### Phase Requirements → Test Map

| Req ID   | Behavior                                                | Test Type     | Automated Command                             | File Exists?        |
| -------- | ------------------------------------------------------- | ------------- | --------------------------------------------- | ------------------- |
| PITCH-04 | `selectPiece` computes valid highlight hexes            | unit (store)  | `vitest run src/store/useGameStore.test.ts`   | ❌ Wave 0           |
| PITCH-04 | `movePiece` updates piece position and clears selection | unit (store)  | `vitest run src/store/useGameStore.test.ts`   | ❌ Wave 0           |
| PITCH-05 | BallMarker renders at correct hex position              | manual-only   | visual inspection in browser                  | —                   |
| UX-01    | TurnIndicator shows correct phase/team labels           | manual-only   | visual inspection in browser with mock states | —                   |
| UX-02    | validMoveHexes computed correctly from mock state       | unit (store)  | `vitest run src/store/useGameStore.test.ts`   | ❌ Wave 0           |
| UX-03    | ActionLog renders ActionEvent union types correctly     | manual-only   | visual inspection in browser with mock states | —                   |
| UX-04    | ActionLog empty state renders "No actions yet."         | manual-only   | visual inspection in browser                  | —                   |
| PITCH-02 | pitch.ts 37×26 region boundaries correct                | unit (shared) | `pnpm --filter @counter-attack/shared test`   | ❌ Wave 0 (rewrite) |

**Note on test scope:** Phase 6 is primarily a rendering phase. The highest-value unit tests target the Zustand store's `selectPiece` / `movePiece` logic (pure state transitions) — these are testable without a DOM environment. Component rendering tests (HexGrid, HexCell) require jsdom and provide lower ROI for a mock-data phase. The planner should include Zustand store unit tests but may treat component rendering as manual verification.

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/shared test` (protect pitch.ts changes)
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/client/vitest.config.ts` — test runner config for jsdom environment
- [ ] `packages/client/src/store/useGameStore.test.ts` — covers PITCH-04, UX-02
- [ ] Rewrite `packages/shared/src/pitch.test.ts` — covers PITCH-02 for 37×26 grid
- [ ] `packages/client/index.html` — Vite entry point with `<div id="root">`
- [ ] Confirm `docs/board-photo.jpg` exists in repo — blocking for difficult-angle hex derivation

---

## Security Domain

> `security_enforcement` not set in config.json — treated as enabled. Assessed against Phase 6 tech stack.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                    |
| --------------------- | ------- | ----------------------------------------------------------------------------------- |
| V2 Authentication     | No      | No auth in Phase 6 (mock state only)                                                |
| V3 Session Management | No      | No session in Phase 6                                                               |
| V4 Access Control     | No      | No access control in Phase 6                                                        |
| V5 Input Validation   | Limited | Room code input: max 6 chars, uppercase-only transform (in-browser, no server call) |
| V6 Cryptography       | No      | No crypto in Phase 6                                                                |

### Known Threat Patterns for Phase 6 Stack

| Pattern                     | STRIDE          | Standard Mitigation                                                                                                                    |
| --------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| XSS via ActionEvent content | Tampering       | React auto-escapes string interpolation in JSX — never use `dangerouslySetInnerHTML`                                                   |
| Clipboard API in non-HTTPS  | Info Disclosure | `navigator.clipboard.writeText()` requires secure context (HTTPS or localhost); works in dev; flag for production deployment (ARCH-06) |

**Security posture:** Phase 6 is pure frontend with mock data and no server interaction. The primary security concern is ensuring the React component tree uses JSX string interpolation (not innerHTML) for all ActionEvent display — auto-satisfied by JSX syntax.

---

## Sources

### Primary (HIGH confidence)

- `packages/shared/src/pitch.ts` — current placeholder structure; region type; `hexKey` / `buildRegion` pattern
- `packages/shared/src/types.ts` — `GameState`, `PlayerPiece`, `BallState`, `ActionEvent`, `GamePhase`, `MovementSlot`
- `packages/shared/src/moveValidator.ts` — `validateMove(GameState, PlayerPiece, HexCoord)` exact signature
- `packages/shared/src/hex.ts` — `hexesInRange`, `hexDistance` for valid-move candidate generation
- `.planning/phases/06-react-hex-grid-renderer/06-CONTEXT.md` — all locked decisions (D-01 through D-13)
- `.planning/phases/06-react-hex-grid-renderer/06-UI-SPEC.md` — approved design contract (colors, sizes, component list)
- `packages/client/tsconfig.json` — existing tsconfig extending base; `moduleResolution: Bundler` confirmed
- `npm view react/vite/zustand/honeycomb-grid` — versions verified on npm registry
- [vite.dev/config/ shared-options#resolve-alias](https://vite.dev/config/shared-options#resolve-alias) — resolve.alias config
- [vite.dev/guide/features#css-modules](https://vite.dev/guide/features#css-modules) — CSS Modules native support
- [zustand.docs.pmnd.rs/learn/guides/beginner-typescript](https://zustand.docs.pmnd.rs/learn/guides/beginner-typescript) — curried TypeScript create pattern

### Secondary (MEDIUM confidence)

- [abbekeultjes.nl/honeycomb/api/](https://abbekeultjes.nl/honeycomb/api/) — honeycomb-grid 4.x exports including `hexToPoint`, `hex.corners`
- [abbekeultjes.nl/honeycomb/guide/rendering.html](https://abbekeultjes.nl/honeycomb/guide/rendering.html) — `hex.corners` SVG pattern

### Tertiary (LOW confidence)

- slopcheck 0.6.1 scan — all 7 primary packages rated [OK]; vitest [SUS] is a false positive

---

## Metadata

**Confidence breakdown:**

- Standard Stack: HIGH — all versions verified on npm registry; packages confirmed via slopcheck
- Architecture: HIGH — directly derived from locked CONTEXT.md decisions and existing codebase
- Pitfalls: HIGH — pitch.ts replacement and Zustand/React version pinning derived from registry verification
- Hex Math: HIGH — D-03 formula is a locked decision; vertex angles are standard flat-top geometry
- Test Strategy: MEDIUM — based on assessment of rendering-phase testing conventions; planner may choose to add more

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (stable packages; honeycomb-grid is slow-moving)
