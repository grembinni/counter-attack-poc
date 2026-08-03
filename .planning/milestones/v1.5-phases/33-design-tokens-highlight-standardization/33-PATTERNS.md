# Phase 33: Design Tokens & Highlight Standardization - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 9 (2 new, 7 modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File                                               | Role                      | Data Flow                                          | Closest Analog                                                                                                                                                                             | Match Quality                                               |
| --------------------------------------------------------------- | ------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `packages/client/src/styles/tokens.css`                         | config (CSS token layer)  | transform (literal → var)                          | none — greenfield; use `GameBoard.module.css` as source of literals to extract                                                                                                             | no-analog (new pattern)                                     |
| `packages/client/src/components/HexCell.tsx`                    | component                 | transform (props → SVG paint)                      | itself (extend in place)                                                                                                                                                                   | exact                                                       |
| `packages/client/src/components/HexGrid.tsx`                    | component                 | transform (GameState → per-hex props)              | itself (extend in place)                                                                                                                                                                   | exact                                                       |
| `packages/client/src/components/PieceOverlay.tsx`               | component                 | transform (piece state → SVG rings)                | itself (extend `isOffside`/`isMovedThisStage` pattern to grey ring)                                                                                                                        | exact                                                       |
| `packages/client/src/components/BallLocationRing.tsx` (NEW)     | component                 | transform (ball position → SVG overlay)            | `PieceOverlay.tsx`'s independent-ring blocks (`isOffside`) as structural template; `HexGrid.tsx`'s HEADER gold-overlay block (lines ~588-598) as the direct functional precursor to delete | role-match (new standalone component, no existing 1:1 file) |
| `docs/HIGHLIGHT-REFERENCE.md` (NEW)                             | config (reference doc)    | —                                                  | `docs/ARCHITECTURE.md` (doc structure/tone convention)                                                                                                                                     | role-match                                                  |
| `packages/client/src/hooks/useTeamColors.ts`                    | utility                   | transform (TeamId → color string)                  | itself (no change needed — already the correct single-source pure function; only its _consumers_ change to also write the CSS var)                                                         | exact                                                       |
| `packages/client/src/components/GameBoard.tsx`                  | component                 | request-response (renders from Zustand store)      | itself (apply Pattern 4 CSS-var injection at root; remove per-call-site `style={{color: homeColor}}` etc.)                                                                                 | exact                                                       |
| `*.module.css` (15 files, e.g. `GameBoard.module.css`)          | config (component styles) | transform (literal → var)                          | `GameBoard.module.css` as representative sample of the literal-density pattern to replace                                                                                                  | exact                                                       |
| `HexCell.test.tsx`, `HexGrid.test.tsx`, `PieceOverlay.test.tsx` | test                      | transform (literal assertion → semantic assertion) | themselves (existing test structure, only assertion values change)                                                                                                                         | exact                                                       |

## Pattern Assignments

### `packages/client/src/styles/tokens.css` (config, new file)

**Analog:** none in-repo (confirmed zero `:root`/`--color-` matches anywhere in `packages/client/src`) — this is greenfield infrastructure. Use the literal inventory already gathered in `GameBoard.module.css` (and the other 14 `*.module.css` files) as the _source_ of values to lift into tokens, keeping values byte-identical to today (D-06).

**Representative literals to convert into tokens** (from `GameBoard.module.css` lines 1-40, and `GameBoard.tsx` lines 269/283/292/306):

```css
/* Source: packages/client/src/components/GameBoard.module.css lines 21-23, 32-33 */
.topBand {
  background: #1a1a2e;
  border-bottom: 1px solid #0f3460;
}
.topBandLeft {
  background: #16213e;
  border-right: 1px solid #0f3460;
}
```

```typescript
// Source: packages/client/src/components/GameBoard.tsx line 283 (chrome literal inside inline style, not CSS module)
background: '#27ae60', // connection-status dot — must migrate too, per Pitfall 5
```

**Recommended shape** (new file, no existing analog to copy verbatim — follow plain `:root` custom-property convention):

```css
:root {
  --color-bg-panel: #1a1a2e;
  --color-bg-panel-alt: #16213e;
  --color-border: #0f3460;
  --color-text-primary: #ffffff; /* verify actual literal during audit */
  --color-text-secondary: #e0e0e0;
  --color-success: #27ae60;
  --color-danger: #ef4444;
  --team-accent: #888888; /* fallback default; overridden per-screen via inline style, Pattern 4 */
}
```

Import once in `main.tsx` alongside the existing `import './index.css'`.

---

### `packages/client/src/components/HexCell.tsx` (component, transform) — EXTEND IN PLACE

**Analog:** itself — the existing `HexHighlightType` union (lines 6-13) and `HIGHLIGHT_STYLES` record (lines 15-68) are the established shape. Do not redesign; add members and one optional `ring` prop.

**Core pattern to extend** (lines 6-68):

```typescript
export type HexHighlightType =
  | 'safe'
  | 'risk'
  | 'goal'
  | 'kickoff'
  | 'shot-path'
  | 'shot-path-action'
  | 'header-target';

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
    fill: 'rgba(255,140,0,1)',
    restOpacity: 0.65,
    hoverOpacity: 0.8,
    stroke: '#b35a00',
    strokeWidth: 2,
  },
  goal: {
    fill: 'rgba(220,50,50,1)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#cc2222',
    strokeWidth: 1.5,
  },
  // ... kickoff, shot-path, shot-path-action, header-target
};
```

**Render pattern** (lines 108-125) — the ternary-free lookup-and-spread approach every new type must follow:

```typescript
{highlightType !== undefined &&
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
  })()}
```

**New types to add** (per RESEARCH.md audit): `gk-kick-target` (sky-blue, was `HexGrid.tsx:603-605`), `pass-target` (green, was `HexGrid.tsx:614-616`/`625`, likely merged with GK_QUICK_THROW per Open Question 1), `tackle-risk` (orange, currently `.hexTackleRisk` CSS-module class in `HexGrid.module.css`). `goal` fill must be reassigned off red per D-02.

**New independent `ring` prop** — mirror `PieceOverlay`'s `isOffside`/`isMovedThisStage` pattern (see below) rather than adding combinatorial enum members, for the centre-hex "required" marker and confirmed-pass-target ring (both currently gold `#f5c518`).

---

### `packages/client/src/components/PieceOverlay.tsx` (component, transform) — EXTEND IN PLACE

**Analog:** itself — this file already contains the exact structural pattern (independent boolean-driven ring layer) that both D-05 (grey moved-this-stage ring) and the new `HexCell` ring prop should mirror.

**Independent-ring pattern to copy** (lines 213-223, offside — study this shape) and (lines 224-240, moved-this-stage — this is the block D-05 modifies):

```typescript
{/* OFFSIDE-01: red ring at a distinct radius — independent layer, not part of selectionState switch */}
{isOffside && (
  <circle cx={cx} cy={cy} r={PIECE_RADIUS + 6} fill="none" stroke="#dc2626" strokeWidth={2.5} pointerEvents="none" />
)}
{/* D-55: green "moved this stage" ring — CURRENTLY identical color to 'active' ring (line 181, #22c55e).
    D-05 TARGET: replace stroke with a dark-grey tone, and add a second overlay <circle> with
    fill (not fill="none") using a light-grey semi-transparent fill to produce the "dimmed" look. */}
{isMovedThisStage && (
  <circle cx={cx} cy={cy} r={PIECE_RADIUS + 8} fill="none" stroke="#22c55e" strokeWidth={2.5} pointerEvents="none" />
)}
```

**Existing ring colors for reference** (lines 163-206 — selectable/active/activated):

```typescript
{selectionState === 'selectable' && (
  <circle cx={cx} cy={cy} r={PIECE_RADIUS + 3} fill="none" stroke="#60a5fa" strokeWidth={2.5} pointerEvents="none" />
)}
{selectionState === 'active' && (
  <circle cx={cx} cy={cy} r={PIECE_RADIUS + 4} fill="none" stroke="#22c55e" strokeWidth={2.5} pointerEvents="none" />
)}
```

---

### `packages/client/src/components/BallLocationRing.tsx` (NEW component)

**Analog:** structural template = `PieceOverlay.tsx`'s independent-ring `<circle>` blocks (lines 213-223 above); functional precursor to delete = `HexGrid.tsx`'s HEADER-only gold overlay.

**Precursor to replace** (`HexGrid.tsx` lines ~588-598, gold `#f5c518`, HEADER-phase only):

```typescript
// This block is the direct precursor — same concept (mark the ball's hex), narrower scope
// (HEADER only, gold, drawn as a sibling <polygon> inside the mutually-exclusive per-hex loop).
// D-08/D-09 requires: white, hex-EDGE only (not filled), all response phases, always-on-top,
// rendered as a new standalone component OUTSIDE the highlightType priority resolution —
// last in DOM order per the SVG layer diagram in RESEARCH.md (after PieceOverlay).
fill="#f5c518" fillOpacity={0.5}
stroke="#f5c518" strokeWidth={2}
```

**Stroke-width convention to match (D-08 "same thickness as player-state rings")** — use the same `strokeWidth={2.5}` used by `PieceOverlay`'s selectable/active/offside/moved rings (see above), not the ring/polygon's own `strokeWidth={2}`.

**Recommended shape** (new file — use `hexPolygonPoints`/`axialToPixel` from `../utils/hexToPixel.js`, same imports as `HexCell.tsx` line 4):

```typescript
import { axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';
// <polygon points={hexPolygonPoints(cx, cy)} fill="none" stroke="#ffffff" strokeWidth={2.5} pointerEvents="none" />
```

---

### `docs/HIGHLIGHT-REFERENCE.md` (NEW reference doc)

**Analog:** `docs/ARCHITECTURE.md` — only existing precedent for a permanent top-level reference doc in this repo; follow its heading/tone conventions (read that file's intro/section-header style before drafting, sibling location `docs/`, not `.planning/`).

**Required structure** (per RESEARCH.md Pattern 3 — three sub-tables, not one flat list):

1. Hex tint types (`HexHighlightType` / `HIGHLIGHT_STYLES` — mutually exclusive)
2. Piece ring colors (`PieceOverlay.tsx` — `selectable`/`active`/`activated` mutually exclusive, plus `isOffside`/`isMovedThisStage` independent/stackable)
3. Standalone always-on-top overlays (new ball-location marker; centre-hex "required" ring if not folded into category 2's `ring` prop)

---

### `packages/client/src/components/GameBoard.tsx` (component, request-response) — CSS-var injection

**Analog:** itself — replace the per-call-site color threading pattern below with one inline-style CSS-variable write on the root.

**Current per-call-site pattern to replace** (lines 269, 292, 306):

```typescript
<span className={styles.scoreNumeral} style={{ color: homeColor }}>{score.home}</span>
...
<span className={styles.teamName} style={{ color: teamColor }}>{teamName}</span>
...
<span className={styles.scoreNumeral} style={{ color: awayColor }}>{score.away}</span>
```

**Chrome literal also in scope** (line 283, inline style, not CSS module — per Pitfall 5):

```typescript
style={{ width: 8, height: 8, borderRadius: '50%', background: '#27ae60', flexShrink: 0 }}
```

**Target pattern (Pattern 4, not yet in codebase — apply at root wrapper, e.g. `<div className={styles.gameBoard}>`):**

```typescript
<div className={styles.gameBoard} style={{ '--team-accent': teamColor } as React.CSSProperties}>
  {/* descendants: .module.css reads `color: var(--team-accent);` — CSS Modules already support var() for free */}
</div>
```

**Source of team color** — unchanged, already correct single source (`useTeamColors.ts` lines 12-15, 23-25):

```typescript
export function teamAccentColor(teamId: TeamId | undefined): string {
  if (!teamId) return '#888888';
  return TEAM_CONFIGS[teamId]?.palette.uiColor ?? '#888888';
}
export function useTeamAccentColor(teamId: TeamId | undefined): string {
  return teamAccentColor(teamId);
}
```

---

### `*.module.css` files (15 total, e.g. `GameBoard.module.css`) — mechanical literal→var() migration

**Analog:** `GameBoard.module.css` itself, representative of the pattern across all 15 files.

**Literal pattern to replace** (lines 21-23, 32-33):

```css
.topBand {
  background: #1a1a2e;
  border-bottom: 1px solid #0f3460;
}
.topBandLeft {
  background: #16213e;
  border-right: 1px solid #0f3460;
}
```

**Target:**

```css
.topBand {
  background: var(--color-bg-panel);
  border-bottom: 1px solid var(--color-border);
}
```

---

### Test files — `HexCell.test.tsx`, `HexGrid.test.tsx`, `PieceOverlay.test.tsx`

**Analog:** themselves — only the assertion _values_ change (literal color string → semantic type/token identity); test structure (render + `getAttribute`/`toHaveStyle` queries) stays the same.

**Pattern to migrate** (`PieceOverlay.test.tsx`, moved-this-stage assertion — the exact HILITE-03 defect target):

```typescript
// CURRENT (to be replaced): asserts the literal that D-05 is removing
expect(ring).toHaveAttribute('stroke', '#22c55e');
// TARGET: assert semantic distinctness from the active-ring color, not a specific literal
// (e.g. assert stroke !== ACTIVE_RING_COLOR, or assert a named grey token/constant)
```

**Pattern to migrate** (`HexGrid.test.tsx` lines 93/145/176, 629-630 — named constants already exist, just point them at new semantics):

```typescript
const goalFill = 'rgba(220,50,50,1)'; // must change once 'goal' is reassigned off red (D-02)
const KICKOFF_FILL = 'rgba(59,130,246,1)'; // unaffected — kickoff stays blue
const SAFE_FILL = 'rgba(245,197,24,1)'; // unaffected — safe stays gold
```

## Shared Patterns

### Independent boolean-driven ring/overlay layer (the single most important pattern in this phase)

**Source:** `packages/client/src/components/PieceOverlay.tsx` lines 213-240 (`isOffside`, `isMovedThisStage`)
**Apply to:** `HexCell.tsx`'s new `ring` prop (centre-hex required marker, confirmed-pass-target ring) and the new `BallLocationRing.tsx` component.

```typescript
{isOffside && (
  <circle cx={cx} cy={cy} r={PIECE_RADIUS + 6} fill="none" stroke="#dc2626" strokeWidth={2.5} pointerEvents="none" />
)}
```

**Why:** This is a boolean prop that renders an additional `<circle>`/`<polygon>` sibling regardless of the primary mutually-exclusive state, at a distinct radius so multiple rings can stack without visually merging. RESEARCH.md's "Don't Hand-Roll" table explicitly warns against combinatorial enum growth (`'kickoff-required'`, `'pass-target-confirmed'`) — always prefer this independent-prop shape.

### Single source-of-truth color lookup table

**Source:** `packages/client/src/components/HexCell.tsx` lines 15-68 (`HIGHLIGHT_STYLES`)
**Apply to:** All new `HexHighlightType` members — extend the `Record<HexHighlightType, {...}>` shape, never add a parallel `if/else` color chain.

### Team accent color — single derivation function, never re-derive

**Source:** `packages/client/src/hooks/useTeamColors.ts` lines 12-15 (`teamAccentColor`, pure function, fallback `#888888`)
**Apply to:** `--team-accent` CSS var injection (Pattern 4) and any remaining hardcoded `'#888888'` fallback literals (e.g. `ActionLog.tsx` lines 758/766/774/782/790 per RESEARCH.md Anti-Patterns) — call `teamAccentColor(undefined)` instead of re-typing the literal.

### CSS custom-property injection at component root, not global DOM mutation

**Source:** No existing in-repo instance — this is new infrastructure (see RESEARCH.md Architecture Pattern 4, Sources section for external citation).
**Apply to:** Any screen-root component currently threading `useTeamAccentColor(teamId)` through multiple `style={{color}}` props: `GameBoard.tsx` (lines 269/292/306/346/372/395/408 per RESEARCH.md), `TeamSelectionScreen.tsx`, `UniformSelectionScreen.tsx`, `LineupAssignmentScreen.tsx`.

```typescript
<div className={styles.root} style={{ '--team-accent': teamColor } as React.CSSProperties}>
```

## No Analog Found

| File                                                  | Role         | Data Flow | Reason                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------- | ------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/client/src/styles/tokens.css`               | config       | transform | Greenfield — zero CSS custom-property usage anywhere in the codebase today (confirmed via research search). Use RESEARCH.md's literal inventory (342 occurrences across 15 CSS modules) as the source list, not a code analog.                                                              |
| `packages/client/src/components/BallLocationRing.tsx` | component    | transform | No existing standalone always-on-top SVG overlay component exists; closest structural precedent is `PieceOverlay`'s independent-ring `<circle>` blocks (used as template, see Pattern Assignments above), and `HexGrid.tsx`'s HEADER gold overlay (used as the functional block to delete). |
| `docs/HIGHLIGHT-REFERENCE.md`                         | config (doc) | —         | No existing color-reference doc; `docs/ARCHITECTURE.md` used only for doc-authoring tone/structure convention, not content pattern.                                                                                                                                                         |

## Metadata

**Analog search scope:** `packages/client/src/components/*.tsx`, `packages/client/src/components/*.module.css`, `packages/client/src/hooks/`, `packages/client/src/styles/`, `docs/`
**Files scanned:** `HexCell.tsx`, `HexGrid.tsx`, `PieceOverlay.tsx`, `GameBoard.tsx`, `GameBoard.module.css`, `useTeamColors.ts`, `docs/*.md` listing, plus RESEARCH.md's own full-file reads (HexCell.test.tsx, HexGrid.test.tsx, PieceOverlay.test.tsx, all 15 `*.module.css`) cited by reference rather than re-read here.
**Pattern extraction date:** 2026-07-25
