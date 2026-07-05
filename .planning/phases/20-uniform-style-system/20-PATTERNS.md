# Phase 20: Uniform Style System - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 5 (2 new, 3 modified)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File                                      | Role             | Data Flow        | Closest Analog                                                         | Match Quality                                              |
| ------------------------------------------------------ | ---------------- | ---------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/shared/src/uniformStyles.ts`                 | config/types     | transform        | `packages/shared/src/teamConfig.ts`                                    | role-match (type union + registry pattern)                 |
| `packages/client/src/styles/uniformStyles.tsx`         | utility/renderer | transform        | `packages/client/src/components/PieceOverlay.tsx` (SVG pattern blocks) | partial-match (same SVG primitives, different composition) |
| `packages/client/src/components/PieceOverlay.tsx`      | component        | request-response | itself (refactor)                                                      | exact (self-refactor, existing structure preserved)        |
| `packages/client/src/components/PieceOverlay.test.tsx` | test             | —                | itself (assertion update)                                              | exact                                                      |
| `packages/client/src/components/HexGrid.tsx`           | component        | request-response | itself (add store subscription + prop pass)                            | exact                                                      |

---

## Pattern Assignments

### `packages/shared/src/uniformStyles.ts` (new — config/types, no JSX)

**Analog:** `packages/shared/src/teamConfig.ts`

**Imports pattern** (teamConfig.ts lines 1-8 — follow same no-import-of-client-code rule):

```typescript
// No React imports — shared package must not reference JSX runtime
// Only TypeScript type definitions and plain-object constants
import type { TeamPalette } from './teamConfig.js';
```

**Type union pattern** (model on TeamId union in teamConfig.ts line 12):

```typescript
// teamConfig.ts line 12 — exact pattern to copy for UniformStyleId
export type TeamId = 'city' | 'crew';

// Phase 20 equivalent:
export type UniformStyleId =
  | 'pinstripe'
  | 'diagonal'
  | 'checker'
  | 'cosmos'
  | 'plus'
  | 'v-stripe'
  | 'quarters'
  | 'polka-dots'
  | 'fade'
  | 'tree-rings'
  | 'corners'
  | 'solid';
```

**Registry pattern** (model on COLOR_SCHEME_REGISTRY in teamConfig.ts lines 59-104):

```typescript
// teamConfig.ts lines 59-62 — Record<Id, MetaShape> pattern
export const COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme> = {
  cosmos: { id: 'cosmos', name: 'Cosmos', palette: {...}, badgeFile: 'cosmos.png' },
  ...
};

// Phase 20 equivalent — metadata only (no JSX in shared):
export interface UniformStyleMeta {
  id: UniformStyleId;
  name: string;       // display name for Phase 22 selection UI
  description: string;
}

export const UNIFORM_STYLE_META: Record<UniformStyleId, UniformStyleMeta> = {
  pinstripe: { id: 'pinstripe', name: 'Pinstripe', description: 'Vertical stripes' },
  // ... 11 more entries
};
```

**Barrel export pattern** (packages/shared/src/index.ts lines 1-17 — add one line):

```typescript
// index.ts current tail:
export * from './offside.js'; // Phase 17
// Add for Phase 20:
export * from './uniformStyles.js'; // Phase 20: UniformStyleId type + UNIFORM_STYLE_META
```

**TeamConfig extension** (teamConfig.ts `TeamConfig` interface lines 40-53 — add one field):

```typescript
// Current TeamConfig interface (lines 40-53) — add defaultUniformStyle field:
export interface TeamConfig {
  id: TeamId;
  name: string;
  colorSchemeId: ColorSchemeId;
  palette: TeamPalette;
  playerIds: readonly string[];
  league: 'mls' | 'international';
  badgeFile: string;
  defaultUniformStyle: UniformStyleId; // NEW — Phase 20
}

// TEAM_CONFIGS entries (lines 108-152) get defaultUniformStyle added:
// city entry → defaultUniformStyle: 'pinstripe'
// crew entry → defaultUniformStyle: 'diagonal'
```

---

### `packages/client/src/styles/uniformStyles.tsx` (new — renderer registry, JSX)

**Analog:** `packages/client/src/components/PieceOverlay.tsx` SVG pattern blocks (lines 119-248)

**Imports pattern** (copy PieceOverlay.tsx line 1 import style):

```typescript
import type { TeamPalette, UniformStyleId } from '@counter-attack/shared';

export type UniformStyleRenderer = (params: {
  cx: number;
  cy: number;
  R: number;
  palette: TeamPalette;
  isGK: boolean;
  pieceId: string;
}) => {
  patternDef: React.ReactElement | null;
  fill: string;
  overlay: React.ReactElement | null;
};
```

**Pinstripe renderer** — copy from PieceOverlay.tsx lines 146-157, parameterize colors:

```typescript
// PieceOverlay.tsx lines 146-157 (EXACT SOURCE):
<pattern
  id={`city-jersey-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={8}
  height={24}
  patternUnits="userSpaceOnUse"
>
  <rect width={8} height={24} fill="#dc143c" />
  <rect x={2} y={0} width={4} height={24} fill="#ef4444" fillOpacity={0.9} />
</pattern>

// Phase 20 renderer — replace hardcoded colors with palette:
export const pinstripe: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <pattern
      id={`pinstripe-${pieceId}`}
      x={cx - R}
      y={cy - R}
      width={8}
      height={24}
      patternUnits="userSpaceOnUse"
    >
      <rect width={8} height={24} fill={palette.primary} />
      <rect x={2} y={0} width={4} height={24} fill={palette.primaryLight} fillOpacity={0.9} />
    </pattern>
  ),
  fill: `url(#pinstripe-${pieceId})`,
  overlay: null,
});
```

**Cosmos renderer** — copy from PieceOverlay.tsx lines 119-130:

```typescript
// PieceOverlay.tsx lines 119-130 (EXACT SOURCE):
<pattern
  id={`cosmos-jersey-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={24}
  height={24}
  patternUnits="userSpaceOnUse"
>
  <rect width={24} height={24} fill="#1e3a8a" />
  <rect x={0} y={6} width={24} height={12} fill="#3b82f6" fillOpacity={0.85} />
</pattern>
// Phase 20 renderer — primary = base, secondary1 = horizontal band:
```

**Checker renderer** — copy from PieceOverlay.tsx lines 179-194 (home GK pattern):

```typescript
// PieceOverlay.tsx lines 179-194 (EXACT SOURCE — GK checker template):
<pattern
  id={`home-gk-checker-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={12}
  height={12}
  patternUnits="userSpaceOnUse"
>
  <rect width={12} height={12} fill="#7c3aed" />
  <rect x={0} y={0} width={6} height={6} fill="#4c1d95" />
  <rect x={6} y={6} width={6} height={6} fill="#4c1d95" />
</pattern>
// Phase 20 renderer — primary = base fill, secondary1 = checker squares:
```

**Diagonal renderer** — copy from PieceOverlay.tsx lines 159-174, 236-248:

```typescript
// PieceOverlay.tsx lines 159-174 (EXACT SOURCE — solid gold base pattern):
<pattern
  id={`crew-jersey-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={PIECE_RADIUS * 2}
  height={PIECE_RADIUS * 2}
  patternUnits="userSpaceOnUse"
>
  <rect width={PIECE_RADIUS * 2} height={PIECE_RADIUS * 2} fill="#f5c518" />
</pattern>

// PieceOverlay.tsx lines 170-174 (EXACT SOURCE — clipPath):
<clipPath id={`crew-clip-${piece.id}`}>
  <circle cx={cx} cy={cy} r={PIECE_RADIUS} />
</clipPath>

// PieceOverlay.tsx lines 236-248 (EXACT SOURCE — diagonal overlay line):
<line
  x1={cx - PIECE_RADIUS}
  y1={cy - PIECE_RADIUS}
  x2={cx + PIECE_RADIUS}
  y2={cy + PIECE_RADIUS}
  stroke="#111111"       // → palette.secondary1 (see Crew palette mismatch note below)
  strokeWidth={10}
  strokeOpacity={0.8}
  clipPath={`url(#crew-clip-${piece.id})`}
  pointerEvents="none"
/>

// NOTE: Crew palette in teamConfig.ts has secondary1='#111111' (near-black),
// secondary2='#14532d' (forest green). The v1.2 diagonal uses secondary1, NOT secondary2
// as D-02 wording suggests. Use palette.secondary1 to match v1.2 appearance exactly.

// Phase 20 renderer:
export const diagonal: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: (
    <>
      <pattern id={`diagonal-${pieceId}`} x={cx-R} y={cy-R} width={R*2} height={R*2} patternUnits="userSpaceOnUse">
        <rect width={R*2} height={R*2} fill={palette.primary} />
      </pattern>
      <clipPath id={`diagonal-clip-${pieceId}`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
    </>
  ),
  fill: `url(#diagonal-${pieceId})`,
  overlay: (
    <line
      x1={cx - R} y1={cy - R}
      x2={cx + R} y2={cy + R}
      stroke={palette.secondary1}
      strokeWidth={10}
      strokeOpacity={0.8}
      clipPath={`url(#diagonal-clip-${pieceId})`}
      pointerEvents="none"
    />
  ),
});
```

**UNIFORM_STYLES registry** (follow TEAM_CONFIGS Record pattern — teamConfig.ts line 108):

```typescript
export const UNIFORM_STYLES: Record<UniformStyleId, UniformStyleRenderer> = {
  pinstripe,
  diagonal,
  checker,
  cosmos,
  plus,
  'v-stripe': vStripe,
  quarters,
  'polka-dots': polkaDots,
  fade,
  'tree-rings': treeRings,
  corners,
  solid,
};
```

---

### `packages/client/src/components/PieceOverlay.tsx` (modified — refactor)

**Analog:** itself (self-refactor — existing structure preserved, see full read above)

**New props signature** — replace current Props type (lines 28-57):

```typescript
// Current Props (lines 28-57) — ADD uniformStyle and palette, REMOVE internal store read
type Props = {
  piece: PlayerPiece;
  uniformStyle: UniformStyleId; // NEW — Phase 20
  palette: TeamPalette; // NEW — Phase 20
  selectionState: SelectionState;
  onClick: () => void;
  onInspect: () => void;
  carrierId: string | null;
  attackingTeam: 'home' | 'away';
  isOffside?: boolean;
  isMovedThisStage?: boolean;
};
```

**Remove from body** (lines 80, 88-89 — selectedTeams store call + TEAM_CONFIGS lookup):

```typescript
// REMOVE these lines from PieceOverlay body:
const selectedTeams = useGameStore((s) => s.gameState.selectedTeams); // line 80 — remove
const teamId = selectedTeams[piece.teamId]; // line 88 — remove
const teamConfig = TEAM_CONFIGS[teamId]; // line 89 — remove
```

**Add GK swap + renderer call** (replaces the 4 outfield + 2 GK pattern defs blocks at lines 117-212):

```typescript
// NEW rendering core — replaces all <defs> pattern blocks:
const isGK = piece.role === 'GK';
const effectivePalette: TeamPalette = isGK
  ? {
      primary: palette.secondary1,
      primaryLight: palette.secondary2,
      secondary1: palette.primary,
      secondary2: palette.primaryLight,
    }
  : palette;

const {
  patternDef,
  fill: circleFill,
  overlay,
} = UNIFORM_STYLES[uniformStyle]({
  cx,
  cy,
  R: PIECE_RADIUS,
  palette: effectivePalette,
  isGK,
  pieceId: piece.id,
});

// In JSX — replaces current <defs> + <circle fill> blocks:
// <defs>{patternDef}</defs>                    (if patternDef is not null)
// <circle ... fill={circleFill} ... />
// {overlay}
```

**Imports to remove/add** (lines 1-4):

```typescript
// REMOVE: import { TEAM_CONFIGS } from '@counter-attack/shared';
// ADD:    import type { UniformStyleId, TeamPalette } from '@counter-attack/shared';
// ADD:    import { UNIFORM_STYLES } from '../styles/uniformStyles.js';
// KEEP:   import type { PlayerPiece } from '@counter-attack/shared';
// KEEP:   import { axialToPixel } from '../utils/hexToPixel.js';
// KEEP:   import { useGameStore } from '../store/useGameStore.js'; // still needed for other state if any
```

**Unchanged elements** (do NOT touch):

- `SoccerPatches` sub-component (lines 6-24)
- `SelectionState` type export (line 26)
- Ball carrier `isBallCarrier` logic (lines 105-112)
- All selection ring circles (lines 250-328)
- `isOffside` red ring (lines 295-311)
- `isMovedThisStage` green ring (lines 312-328)
- Ball carrier dot + SoccerPatches render (lines 329-343)
- Player number `<text>` label (lines 344-357) — GK italic preserved

---

### `packages/client/src/components/PieceOverlay.test.tsx` (modified — assertion updates)

**Analog:** itself (assertion update only — test structure unchanged)

**Current failing assertions after refactor** (lines 118-125, 127-137, 184-199, 209-218):

```typescript
// line 123 — WILL BREAK after refactor (pattern ID changes from city-jersey to pinstripe):
expect(baseCircle.getAttribute('fill')).toContain('url(#city-jersey');
// FIX → assert on style name and pieceId:
expect(baseCircle.getAttribute('fill')).toContain('url(#pinstripe-');
expect(baseCircle.getAttribute('fill')).toContain('home-5');

// line 135 — WILL BREAK:
expect(baseCircle.getAttribute('fill')).toContain('url(#crew-jersey');
// FIX:
expect(baseCircle.getAttribute('fill')).toContain('url(#diagonal-');
expect(baseCircle.getAttribute('fill')).toContain('away-5');

// line 187 — WILL BREAK (GK pattern ID changes):
expect(baseCircle.getAttribute('fill')).toContain('url(#home-gk-checker');
// FIX: home GK uses checker style with GK swap applied:
expect(baseCircle.getAttribute('fill')).toContain('url(#checker-');
expect(baseCircle.getAttribute('fill')).toContain('home-0');

// lines 191-199 — WILL BREAK (GK checker colors were purple/dark-purple hardcoded):
expect(fills).toContain('#7c3aed'); // was City's secondary1 used as GK primary
expect(fills).toContain('#4c1d95'); // was City's secondary1-dark
// FIX: after GK swap, City GK checker base = City.secondary1 (#f5c518), checker = City.primary (#dc143c)
// Use palette-derived assertions, not hardcoded color literals.
```

**Test render helper** — `renderPiece` helper must pass new required props (PieceOverlay.test.tsx line 101-114):

```typescript
// Current renderPiece — does NOT pass uniformStyle or palette:
function renderPiece(piece, selectionState, isOffside = false, isMovedThisStage = false) {
  return render(<svg><PieceOverlay piece={piece} selectionState={selectionState} .../></svg>);
}

// Updated helper must add:
//   uniformStyle: 'pinstripe'   for home pieces (City default)
//   uniformStyle: 'diagonal'    for away pieces (Crew default)
//   palette: COLOR_SCHEME_REGISTRY.city.palette  for home
//   palette: COLOR_SCHEME_REGISTRY.crew.palette  for away
// OR pass both as parameters from each test case.
```

---

### `packages/client/src/components/HexGrid.tsx` (modified — add store subscription + prop pass)

**Analog:** itself (minimal addition — existing subscription pattern at lines 52-79)

**Add selectedTeams subscription** (after existing slice subscriptions, around line 79):

```typescript
// Existing subscription pattern (lines 52-79) — copy this style:
const pieces = useGameStore((s) => s.gameState.pieces); // line 53

// ADD — for PieceOverlay prop resolution (D-16):
const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);
```

**Add TEAM_CONFIGS import** (line 12 area — already imported in PieceOverlay, now moves to HexGrid):

```typescript
// Add to HexGrid imports:
import { TEAM_CONFIGS } from '@counter-attack/shared';
```

**Update PieceOverlay call site** (lines 807-821 — add uniformStyle and palette props):

```typescript
// Current PieceOverlay render (lines 807-821):
<PieceOverlay
  key={piece.id}
  piece={displayPiece}
  selectionState={selectionState}
  onClick={handleClick}
  onInspect={() => inspectPiece(piece.id)}
  carrierId={ball.carrierId}
  attackingTeam={attackingTeam}
  isOffside={(offsidePieceIds ?? []).includes(piece.id)}
  isMovedThisStage={...}
/>

// Updated — add resolution before the map return, then pass props:
const resolvedTeamId = selectedTeams[piece.teamId];   // 'city' | 'crew'
const teamConfig = TEAM_CONFIGS[resolvedTeamId];
<PieceOverlay
  key={piece.id}
  piece={displayPiece}
  uniformStyle={teamConfig.defaultUniformStyle}    // NEW
  palette={teamConfig.palette}                     // NEW
  selectionState={selectionState}
  onClick={handleClick}
  onInspect={() => inspectPiece(piece.id)}
  carrierId={ball.carrierId}
  attackingTeam={attackingTeam}
  isOffside={(offsidePieceIds ?? []).includes(piece.id)}
  isMovedThisStage={...}
/>
```

---

## Shared Patterns

### SVG Pattern Anchor (apply to ALL pattern-based renderers)

**Source:** `packages/client/src/components/PieceOverlay.tsx` lines 148-151

```typescript
// ALL <pattern> elements must use this anchor — without it, tiles misalign on pieces
// far from SVG origin (0,0) since patternUnits="userSpaceOnUse" tiles from SVG origin
<pattern
  id={`${uniformStyle}-${pieceId}`}
  x={cx - R}          // REQUIRED — shifts tile origin to piece top-left corner
  y={cy - R}          // REQUIRED
  width={tileW}
  height={tileH}
  patternUnits="userSpaceOnUse"  // REQUIRED
>
```

### Overlay pointerEvents="none" (apply to ALL overlay sibling elements)

**Source:** `packages/client/src/components/PieceOverlay.tsx` lines 259, 268, etc.

```typescript
// ALL sibling overlay elements (rings, diagonal lines, tree-ring circles, etc.)
// must block no click events — the base circle handles all interaction
pointerEvents = 'none';
```

### GK Palette Swap (apply in PieceOverlay before renderer call)

**Source:** `packages/shared/src/teamConfig.ts` (TeamPalette shape) + CONTEXT.md D-13

```typescript
// Applied once in PieceOverlay before delegating to UNIFORM_STYLES[uniformStyle]:
const effectivePalette: TeamPalette = isGK
  ? {
      primary: palette.secondary1,
      primaryLight: palette.secondary2,
      secondary1: palette.primary,
      secondary2: palette.primaryLight,
    }
  : palette;
```

### TypeScript String Union + Record Registry (shared package pattern)

**Source:** `packages/shared/src/teamConfig.ts` lines 12, 16, 59

```typescript
// Pattern: named string union → Record<union, T> registry — used for TeamId, ColorSchemeId
// Replicate exactly for UniformStyleId + UNIFORM_STYLE_META and UNIFORM_STYLES
export type SomeId = 'a' | 'b' | 'c';
export const SOME_REGISTRY: Record<SomeId, SomeMeta> = { a: {...}, b: {...}, c: {...} };
```

---

## No Analog Found

All files have close analogs. No entries needed here.

---

## Critical Data Contract Notes

1. **Crew diagonal color**: Use `palette.secondary1` (= `'#111111'` in Phase 19 teamConfig.ts line 99), NOT `palette.secondary2` (= `'#14532d'` forest green). The v1.2 diagonal hardcodes `stroke="#111111"` (PieceOverlay.tsx line 242), matching `secondary1`. CONTEXT.md D-02's wording ("secondary2") diverges from Phase 19 data — the Phase 19 data is authoritative.

2. **Test assertion IDs**: Tests at PieceOverlay.test.tsx lines 123, 135, 187, 204 assert pattern ID substrings (`city-jersey`, `crew-jersey`, `home-gk-checker`, `away-gk-checker`). These WILL break after refactor. The test file IS a modification target; update assertions to match new ID format (`pinstripe-`, `diagonal-`, `checker-`).

3. **City pinstripe**: PieceOverlay.tsx line 155 has `fill="#dc143c"` (City `palette.primary`) and line 156 has `fill="#ef4444"` (which is `red-400`). However, Phase 19 teamConfig.ts line 87 sets `primaryLight: '#f87171'` (red-400 = `#f87171`, not `#ef4444`). The pinstripe renderer must use `palette.primaryLight` — the exact value `#f87171` vs `#ef4444` is a one-shade difference from the hardcoded v1.2. City's `primaryLight` in Phase 19 data (`#f87171`) is the authoritative source; the renderer uses `palette.primaryLight`, not the hardcoded `#ef4444`.

---

## Metadata

**Analog search scope:** `packages/client/src/components/`, `packages/shared/src/`
**Files scanned:** 6 (PieceOverlay.tsx, PieceOverlay.test.tsx, HexGrid.tsx, teamConfig.ts, index.ts, types.ts)
**Pattern extraction date:** 2026-07-03
