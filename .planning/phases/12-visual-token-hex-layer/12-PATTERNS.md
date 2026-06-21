# Phase 12: Visual Token & Hex Layer - Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 5 modified files
**Analogs found:** 5 / 5 (all files are modifications of existing files — each file is its own primary analog)

---

## File Classification

| Modified File                                                | Role         | Data Flow                 | Closest Analog                         | Match Quality           |
| ------------------------------------------------------------ | ------------ | ------------------------- | -------------------------------------- | ----------------------- |
| `packages/client/src/components/PieceOverlay.tsx`            | component    | request-response (render) | itself (current version)               | exact — direct refactor |
| `packages/client/src/components/HexCell.tsx`                 | component    | request-response (render) | itself (current version)               | exact — direct refactor |
| `packages/client/src/components/HexGrid.tsx`                 | component    | event-driven + render     | itself (current version)               | exact — direct refactor |
| `packages/client/src/components/PlayerStatsPanel.tsx`        | component    | request-response (render) | `PieceOverlay.tsx` (SVG circle + text) | role-match              |
| `packages/client/src/components/PlayerStatsPanel.module.css` | config/style | —                         | itself (current version)               | exact — additive change |

---

## Pattern Assignments

### `packages/client/src/components/PieceOverlay.tsx` (component, render)

**Analog:** itself — current `PieceOverlay.tsx`

**Current imports pattern** (lines 1-2):

```tsx
import type { PlayerPiece } from '@counter-attack/shared';
import { axialToPixel } from '../utils/hexToPixel.js';
```

These imports are unchanged. No new imports are needed.

**Current props interface to REPLACE** (lines 4-18):

```tsx
type Props = {
  piece: PlayerPiece;
  isSelected: boolean;
  isClickable: boolean;
  onClick: () => void;
  onInspect: () => void;
  carrierId: string | null;
  attackingTeam: 'home' | 'away';
  isSpent: boolean;
  isHeaderContestant?: boolean;
};
```

Replace with:

```tsx
export type SelectionState = 'none' | 'selectable' | 'active' | 'activated';

type Props = {
  piece: PlayerPiece;
  selectionState: SelectionState;
  onClick: () => void;
  onInspect: () => void;
  carrierId: string | null;
  attackingTeam: 'home' | 'away';
};
```

**Current fill/stroke derivation pattern** (lines 43-57) — UNCHANGED:

```tsx
const isGK = piece.role === 'GK';
const fill = isGK
  ? piece.teamId === 'home'
    ? '#9b59b6' // home GK: purple
    : '#f59e0b' // away GK: yellow/amber
  : piece.teamId === 'home'
    ? '#1a56b0' // home outfield: blue
    : '#c0392b'; // away outfield: red
const stroke = isGK
  ? piece.teamId === 'home'
    ? '#6c3483'
    : '#d97706'
  : piece.teamId === 'home'
    ? '#0d3a82'
    : '#8e1c12';
```

GK fill stays solid. Only outfield pieces get stripe patterns. The `fill` variable is used for GKs; for outfield pieces, replace `fill={fill}` on the circle with `fill={isGK ? fill : \`url(#${piece.teamId === 'home' ? \`home-stripe-\${piece.id}\` : \`away-stripe-\${piece.id}\`})\`}`.

**New per-piece SVG pattern defs pattern** — ADD before the base circle (from RESEARCH.md Pattern 1):

```tsx
const PIECE_RADIUS = 12;
// Per-piece patterns needed: userSpaceOnUse tiles from SVG origin;
// anchoring x/y to (cx - PIECE_RADIUS) ensures stripe is centered on this token.
{
  !isGK && (
    <defs>
      {piece.teamId === 'home' ? (
        <pattern
          id={`home-stripe-${piece.id}`}
          x={cx - PIECE_RADIUS}
          y={cy - PIECE_RADIUS}
          width={24}
          height={24}
          patternUnits="userSpaceOnUse"
        >
          {/* 4px stripe centered at x=10..14 within 24px tile → cx-2 to cx+2 */}
          <rect x={10} y={0} width={4} height={24} fill="#000000" fillOpacity={0.55} />
        </pattern>
      ) : (
        <pattern
          id={`away-stripe-${piece.id}`}
          x={cx - PIECE_RADIUS}
          y={cy - PIECE_RADIUS}
          width={24}
          height={24}
          patternUnits="userSpaceOnUse"
        >
          {/* Band 1 upper third, Band 2 lower third — evenly spaced at 4px height */}
          <rect x={0} y={6} width={24} height={4} fill="#7f0000" fillOpacity={0.65} />
          <rect x={0} y={14} width={24} height={4} fill="#7f0000" fillOpacity={0.65} />
        </pattern>
      )}
    </defs>
  );
}
```

**Current cursor + onClick derivation** (lines 78-83) — REPLACE:

```tsx
// OLD:
style={{ cursor: isClickable ? 'pointer' : 'default' }}
onClick={() => {
  if (isClickable) onClick();
  else onInspect();
}}
// NEW:
style={{ cursor: selectionState !== 'none' ? 'pointer' : 'default' }}
onClick={() => {
  if (selectionState !== 'none') onClick();
  else onInspect();
}}
```

**Current isSelected ring** (lines 85-95) — REPLACE all three ring/X blocks with selectionState switch:

```tsx
// OLD isSelected ring (gold):
{
  isSelected && (
    <circle
      cx={cx}
      cy={cy}
      r={PIECE_RADIUS + 2}
      fill="none"
      stroke="#f5c518"
      strokeWidth={2}
      pointerEvents="none"
    />
  );
}
// OLD isHeaderContestant ring (green, lines 97-107)
// OLD isSpent X (lines 121-129)

// NEW — three states from selectionState:
{
  selectionState === 'selectable' && (
    <circle
      cx={cx}
      cy={cy}
      r={PIECE_RADIUS + 2}
      fill="none"
      stroke="#3b82f6"
      strokeWidth={2}
      pointerEvents="none"
    />
  );
}
{
  selectionState === 'active' && (
    <circle
      cx={cx}
      cy={cy}
      r={PIECE_RADIUS + 4}
      fill="none"
      stroke="#22c55e"
      strokeWidth={2.5}
      pointerEvents="none"
    />
  );
}
{
  selectionState === 'activated' && (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={PIECE_RADIUS + 3}
        fill="none"
        stroke="#f97316"
        strokeWidth={2}
        pointerEvents="none"
      />
      <path
        d={`M${cx - PIECE_RADIUS * 0.7} ${cy - PIECE_RADIUS * 0.7} L${cx + PIECE_RADIUS * 0.7} ${cy + PIECE_RADIUS * 0.7} M${cx + PIECE_RADIUS * 0.7} ${cy - PIECE_RADIUS * 0.7} L${cx - PIECE_RADIUS * 0.7} ${cy + PIECE_RADIUS * 0.7}`}
        stroke="#ef4444"
        strokeWidth={2.5}
        strokeLinecap="round"
        pointerEvents="none"
      />
    </>
  );
}
```

Note: The green ring radius `r={PIECE_RADIUS + 4}` and stroke `2.5px` are copied directly from the existing `isHeaderContestant` ring at lines 99-107 of the current file — reuse exact geometry.

**Ball carrier dot pattern** (lines 109-119) — UNCHANGED:

```tsx
{
  isBallCarrier && (
    <circle
      cx={cx + dotOffsetX}
      cy={cy + dotOffsetY}
      r={PIECE_RADIUS * 0.35}
      fill="#ffffff"
      stroke="rgba(0,0,0,0.5)"
      strokeWidth={1}
      pointerEvents="none"
    />
  );
}
```

**Player number text pattern** (lines 131-143) — UNCHANGED.

---

### `packages/client/src/components/HexCell.tsx` (component, render)

**Analog:** itself — current `HexCell.tsx`

**Current imports** (lines 1-4) — UNCHANGED:

```tsx
import { useState } from 'react';
import type { HexCoord } from '@counter-attack/shared';
import { isDifficultAngle } from '@counter-attack/shared';
import { axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';
```

**New type export — ADD before Props:**

```tsx
export type HexHighlightType = 'safe' | 'risk' | 'goal' | 'kickoff' | 'shot-path';

const HIGHLIGHT_STYLES: Record<
  HexHighlightType,
  { fill: string; restOpacity: number; hoverOpacity: number; stroke: string; strokeWidth: number }
> = {
  safe: {
    fill: 'rgba(245,197,24,1)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#d4a017',
    strokeWidth: 1.5,
  },
  risk: {
    fill: 'rgba(255,165,0,1)',
    restOpacity: 0.4,
    hoverOpacity: 0.55,
    stroke: '#cc7700',
    strokeWidth: 1.5,
  },
  goal: {
    fill: 'rgba(220,50,50,1)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#cc2222',
    strokeWidth: 1.5,
  },
  kickoff: {
    fill: 'rgba(59,130,246,1)',
    restOpacity: 0.4,
    hoverOpacity: 0.55,
    stroke: '#2563eb',
    strokeWidth: 1.5,
  },
  'shot-path': {
    fill: 'rgba(255,255,255,1)',
    restOpacity: 0.35,
    hoverOpacity: 0.5,
    stroke: '#cccccc',
    strokeWidth: 1.5,
  },
};
```

**Current Props interface** (lines 6-12) — REPLACE:

```tsx
// OLD:
type Props = {
  hex: HexCoord;
  isHighlighted: boolean;
  highlightColor?: string | undefined;
  onClick: () => void;
};
// NEW:
type Props = {
  hex: HexCoord;
  highlightType?: HexHighlightType;
  onClick: () => void;
};
```

**Current base polygon onClick gating** (lines 39-40) — UPDATE:

```tsx
// OLD:
onClick={isHighlighted ? onClick : undefined}
style={{ cursor: isHighlighted ? 'pointer' : 'default' }}
// NEW:
onClick={highlightType !== undefined ? onClick : undefined}
style={{ cursor: highlightType !== undefined ? 'pointer' : 'default' }}
```

**Current highlight overlay polygon** (lines 46-58) — REPLACE with lookup table:

```tsx
// OLD: {isHighlighted && (<polygon fill={highlightColor ?? '#f5c518'} fillOpacity={hovered ? 0.75 : 0.55} .../>)}
// NEW:
{
  highlightType !== undefined &&
    (() => {
      const s = HIGHLIGHT_STYLES[highlightType];
      return (
        <polygon
          points={points}
          fill={s.fill}
          fillOpacity={hovered ? s.hoverOpacity : s.restOpacity}
          stroke={s.stroke}
          strokeWidth={hovered ? s.strokeWidth + 0.5 : s.strokeWidth}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={onClick}
          style={{ cursor: 'pointer' }}
        />
      );
    })();
}
```

**Difficult-angle dot** (lines 60-62) — UNCHANGED:

```tsx
{
  isDifficultAngle(hex) && (
    <circle cx={cx} cy={cy} r={3} fill="#ffffff" fillOpacity={0.3} pointerEvents="none" />
  );
}
```

---

### `packages/client/src/components/HexGrid.tsx` (component, event-driven + render)

**Analog:** itself — current `HexGrid.tsx`

**Existing `<defs>` block pattern** (lines 222-230) — EXTEND with stripe patterns:

```tsx
// Current defs block (keep existing contents, add stripe defs for HexGrid's own SVG root):
<defs>
  <clipPath id="pitch-clip">
    <rect x={CLIP_X} y={CLIP_Y} width={CLIP_W} height={CLIP_H} />
  </clipPath>
  <pattern id="goal-net" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
    <path d="M 0 0 L 8 0 M 0 0 L 0 8" stroke="rgba(255,255,255,0.4)" strokeWidth={0.8} />
  </pattern>
  {/* Phase 12: stripe patterns moved to per-piece defs inside PieceOverlay — no shared defs needed here.
      D-01/D-02 intent was single defs, but per-piece approach (RESEARCH.md Pattern 1) is required
      for pixel-accurate centering. HexGrid's <defs> block stays as-is. */}
</defs>
```

**Note:** Per RESEARCH.md open question resolution, stripe `<defs>` are defined per-piece inside `PieceOverlay.tsx` (not here). HexGrid's `<defs>` block is unchanged.

**selectionState derivation — REPLACES isSpent/isSelected/isHeaderContestant boolean props** (lines 598-663):

The existing boolean derivations at lines 590-621 remain intact. Add the enum computation immediately before the `return (<PieceOverlay .../>)` call:

```tsx
// After line 621 (isClickable derivation), ADD:
const isSpentNow =
  phase === 'HIGH_PASS_MOVEMENT'
    ? piece.id === highPassMovedPieceId && (highPassPaceUsed ?? 0) >= 3
    : movedPieceIds.includes(piece.id);

const selectionState: SelectionState = isSpentNow
  ? 'activated'
  : piece.id === selectedPieceId || isHeaderEligible || isHeaderContestant
    ? 'active'
    : isClickable
      ? 'selectable'
      : 'none';
```

Note: `isHeaderContestant` (line 598) and `isHeaderEligible` (line 593) BOTH map to `'active'` per D-07 — eligible-but-not-yet-toggled pieces also get the green ring.

**PieceOverlay call site — REPLACE boolean props** (lines 649-664):

```tsx
// OLD:
<PieceOverlay
  key={piece.id}
  piece={displayPiece}
  isSelected={piece.id === selectedPieceId}
  isClickable={isClickable}
  onClick={handleClick}
  onInspect={() => inspectPiece(piece.id)}
  carrierId={ball.carrierId}
  attackingTeam={attackingTeam}
  isSpent={
    phase === 'HIGH_PASS_MOVEMENT'
      ? piece.id === highPassMovedPieceId && (highPassPaceUsed ?? 0) >= 3
      : movedPieceIds.includes(piece.id)
  }
  isHeaderContestant={isHeaderContestant}
/>
// NEW:
<PieceOverlay
  key={piece.id}
  piece={displayPiece}
  selectionState={selectionState}
  onClick={handleClick}
  onInspect={() => inspectPiece(piece.id)}
  carrierId={ball.carrierId}
  attackingTeam={attackingTeam}
/>
```

**highlightType derivation — consolidates ~12 polygon overlay blocks**.

The priority resolution function (from RESEARCH.md Pattern 3), placed in the per-hex render loop after `isShotPath` is computed (around line 263):

```tsx
// Compute single highlightType from priority-ordered sets (D-12: risk > goal > shot-path > kickoff > safe)
// These replace the separate zoiRiskSet, tackleRiskSet, snapDeflectPathSet, lastShotPathSet polygon overlays.
// Overlays with click handlers (pass targets, quick throw, GK kick) REMAIN as separate polygons in HexGrid.
const isRisk =
  (zoiRiskSet.has(hexId) && isValidMove) || (tackleRiskSet.has(hexId) && isValidMove) || isShotPath; // snapDeflectPath is also risk tint
const isGoalTint = isGoalHex || isShotTarget || isShootingModeGoalHex || isHeaderTargetGoalHex;
const isShotPathTint = lastShotPathSet.has(hexId) || isHpMoveTarget || isGKDiveTarget;
const isKickoffTint = inMyZone && !isCentreHex; // exclude centre hex (gets special gold overlay)
const isSafeTint = isHighlighted && !isGoalTint; // valid move hexes not already classified as goal

const highlightType: HexHighlightType | undefined = isRisk
  ? 'risk'
  : isGoalTint
    ? 'goal'
    : isShotPathTint
      ? 'shot-path'
      : isKickoffTint
        ? 'kickoff'
        : isSafeTint
          ? 'safe'
          : undefined;
```

**HexCell call site — REPLACE isHighlighted + highlightColor** (lines 363-372):

```tsx
// OLD:
<HexCell
  hex={hex}
  isHighlighted={isHighlighted}
  highlightColor={
    isGoalHex || isShotTarget || isShootingModeGoalHex || isHeaderTargetGoalHex
      ? '#ef4444'
      : undefined
  }
  onClick={onClick ?? (() => undefined)}
/>
// NEW:
<HexCell
  hex={hex}
  highlightType={highlightType}
  onClick={onClick ?? (() => undefined)}
/>
```

**Polygon overlay blocks to REMOVE** (lines 374-462):

- `zoiRiskSet.has(hexId) && isValidMove` polygon (lines 374-380) — now handled by `highlightType: 'risk'`
- `tackleRiskSet.has(hexId) && isValidMove` polygon (lines 382-388) — now handled by `highlightType: 'risk'`
- `inMyZone && !isCentreHex` kickoff zone polygon (lines 392-400) — now handled by `highlightType: 'kickoff'`
- `isShotPath` snapDeflect orange polygon (lines 443-451) — now handled by `highlightType: 'risk'`
- `lastShotPathSet.has(hexId)` shot-path polygon (lines 453-461) — now handled by `highlightType: 'shot-path'`

**Polygon overlay blocks to KEEP** (these have click handlers or special semantics):

- `isCentreHex` gold fill polygon (lines 401-409) — semantic centre-hex visual, keep
- `isCentreHex` gold ring polygon (lines 411-419) — semantic, keep
- `phase === 'HEADER' && ball position` gold overlay (lines 421-431) — semantic ball position, keep
- `isHeaderNonGoalTarget` cyan polygon (lines 433-441) — has `onClick` handler, keep; update tint to `rgba(255,255,255,0.18)` (shot-path white) per D-13
- `gkKickTargetSet.has(hexId)` sky-blue polygon — has `onClick` handler emitting `emitGKKickTarget`, keep
- Pass target / interception risk polygons — have `onClick` handlers for pass confirmation, keep

**isHpMoveTarget and isGKDiveTarget** — these currently render as subtle overlays without click handlers. They fold into `highlightType: 'shot-path'` (transparent white). Remove the separate polygon blocks for them.

**CSS classes to REMOVE from `HexGrid.module.css`** (verify no other component uses them first):

- `.hexZoIRisk` — colors move into HexCell's `HIGHLIGHT_STYLES.risk`
- `.hexTackleRisk` — same

---

### `packages/client/src/components/PlayerStatsPanel.tsx` (component, render)

**Analog:** `PieceOverlay.tsx` for the SVG circle+text pattern; `PlayerStatsPanel.tsx` for the panel structure.

**Current imports** (lines 1-3) — UNCHANGED:

```tsx
import type { PlayerPiece } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import styles from './PlayerStatsPanel.module.css';
```

**Current header div** (lines 42-45):

```tsx
<div className={styles.header}>
  {piece.name}
  <span className={styles.role}>{piece.role}</span>
</div>
```

Replace with three-item flex layout (token badge + name/role group):

```tsx
<div className={styles.header}>
  {/* D-08/D-09: inline SVG mini token badge — self-contained defs, no HexGrid dependency */}
  <MiniTokenBadge piece={piece} />
  <div className={styles.headerText}>
    {piece.name}
    <span className={styles.role}>{piece.role}</span>
  </div>
</div>
```

**New MiniTokenBadge component** (inline within PlayerStatsPanel.tsx or as a local function):

Pattern derived from RESEARCH.md Pattern 4 + PieceOverlay's fill/stroke values (lines 43-57):

```tsx
function MiniTokenBadge({ piece }: { piece: PlayerPiece }) {
  const isGK = piece.role === 'GK';
  const miniR = 9;
  const miniCx = 10;
  const miniCy = 10;
  // Derive player number same way as PieceOverlay (line 39 of PieceOverlay.tsx):
  const playerNumber = String(Number(piece.id.slice(piece.id.lastIndexOf('-') + 1)) + 1);
  const homePatId = `mini-home-stripe-${piece.id}`;
  const awayPatId = `mini-away-stripe-${piece.id}`;

  // GK fill/stroke from PieceOverlay lines 44-57 (same values, just mini size):
  const gkFill = piece.teamId === 'home' ? '#9b59b6' : '#f59e0b';
  const gkStroke = piece.teamId === 'home' ? '#6c3483' : '#d97706';
  const outfieldStroke = piece.teamId === 'home' ? '#0d3a82' : '#8e1c12';

  return (
    <svg width={20} height={20} viewBox="0 0 20 20" className={styles.tokenBadge}>
      {!isGK && (
        <defs>
          {piece.teamId === 'home' ? (
            <pattern
              id={homePatId}
              x={miniCx - miniR}
              y={miniCy - miniR}
              width={18}
              height={18}
              patternUnits="userSpaceOnUse"
            >
              <rect x={7} y={0} width={4} height={18} fill="#000000" fillOpacity={0.55} />
            </pattern>
          ) : (
            <pattern
              id={awayPatId}
              x={miniCx - miniR}
              y={miniCy - miniR}
              width={18}
              height={18}
              patternUnits="userSpaceOnUse"
            >
              <rect x={0} y={4} width={18} height={3} fill="#7f0000" fillOpacity={0.65} />
              <rect x={0} y={11} width={18} height={3} fill="#7f0000" fillOpacity={0.65} />
            </pattern>
          )}
        </defs>
      )}
      <circle
        cx={miniCx}
        cy={miniCy}
        r={miniR}
        fill={isGK ? gkFill : `url(#${piece.teamId === 'home' ? homePatId : awayPatId})`}
        stroke={isGK ? gkStroke : outfieldStroke}
        strokeWidth={1.5}
      />
      <text
        x={miniCx}
        y={miniCy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        fill="#ffffff"
        fontStyle={isGK ? 'italic' : 'normal'}
        pointerEvents="none"
      >
        {playerNumber}
      </text>
    </svg>
  );
}
```

Note on mini away stripe tile: 18px tile at miniR=9 → band at y=4..7 and y=11..14 (same proportional thirds as full 24px tile at y=6..10 and y=14..18).

---

### `packages/client/src/components/PlayerStatsPanel.module.css` (style, additive)

**Analog:** itself — current CSS

**Current `.header` rule** (lines 14-21):

```css
.header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  font-weight: 700;
  color: #e0e0e0;
}
```

Change `align-items: baseline` to `align-items: center` to vertically center the token badge with the text:

```css
.header {
  display: flex;
  align-items: center;
  gap: 6px; /* D-08: 6px gap between badge and name */
  font-size: 13px;
  font-weight: 700;
  color: #e0e0e0;
}
```

**New rules to ADD:**

```css
.tokenBadge {
  flex-shrink: 0;
}

.headerText {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex: 1;
  min-width: 0; /* prevents overflow */
}
```

The `.role` span (lines 23-29) is unchanged — it remains inside `.headerText`.

---

## Shared Patterns

### SVG Fragment Pattern (no-div wrapper)

**Source:** `PieceOverlay.tsx` JSX root (`<>...</>`) and `HexCell.tsx` JSX root (`<>...</>`)
**Apply to:** All SVG component modifications — never wrap SVG child elements in a `<div>`; these components must remain SVG fragments mounted inside a parent `<svg>` root.

### Zustand Selector Pattern

**Source:** `HexGrid.tsx` lines 48-96 — individual slice selectors:

```tsx
const pieces = useGameStore((s) => s.gameState.pieces);
const selectedPieceId = useGameStore((s) => s.selectedPieceId);
// etc. — one selector per slice to avoid whole-component re-renders
```

**Apply to:** No new selectors needed in Phase 12. Pattern is informational for HexGrid refactor — do not collapse selectors while restructuring.

### Player Number Derivation

**Source:** `PieceOverlay.tsx` line 39:

```tsx
const playerNumber = String(Number(piece.id.slice(piece.id.lastIndexOf('-') + 1)) + 1);
```

**Apply to:** `MiniTokenBadge` in `PlayerStatsPanel.tsx` — copy this exact derivation for consistency.

### CSS Module Dark Theme Palette

**Source:** `PlayerStatsPanel.module.css` lines 1-2 comment:

```css
/* --bg: #16213e; --border: #0f3460; --text-dim: #a0a0a0; --text: #e0e0e0; --accent: #f5c518 */
```

**Apply to:** New `.tokenBadge` and `.headerText` classes — use `color: #e0e0e0` for text, no new background colors.

---

## No Analog Found

All files are direct modifications of existing files. No new files require analogs from elsewhere.

| File   | Role | Data Flow | Reason                                                    |
| ------ | ---- | --------- | --------------------------------------------------------- |
| (none) | —    | —         | All changes are in-place refactors of existing components |

---

## Type Declarations

Two new client-side types emerge from this phase. They can be co-located in the component files or extracted to `packages/client/src/types.ts` (if that file exists) or a new `packages/client/src/components/types.ts`:

```typescript
// SelectionState — exported from PieceOverlay.tsx or a shared client types file
export type SelectionState = 'none' | 'selectable' | 'active' | 'activated';

// HexHighlightType — exported from HexCell.tsx or a shared client types file
export type HexHighlightType = 'safe' | 'risk' | 'goal' | 'kickoff' | 'shot-path';
```

HexGrid imports both types from wherever they are declared. PieceOverlay exports `SelectionState`; HexCell exports `HexHighlightType`.

---

## Metadata

**Analog search scope:** `packages/client/src/components/`
**Files read:** `PieceOverlay.tsx`, `HexCell.tsx`, `HexGrid.tsx` (lines 1-100, 140-270, 270-470, 560-672), `PlayerStatsPanel.tsx`, `PlayerStatsPanel.module.css`
**Pattern extraction date:** 2026-06-11
