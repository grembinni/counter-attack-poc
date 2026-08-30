# Phase 47: Select-Based Roster Interaction - Pattern Map

**Mapped:** 2026-08-30
**Files analyzed:** 3 (in-place rewrite, no new files)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/client/src/components/LineupAssignmentScreen.tsx` | component (stateful screen, 4 interaction surfaces) | event-driven (click → select/complete → server emit) | `packages/client/src/store/useGameStore.ts` (`selectPiece`) + `packages/client/src/components/HexGrid.tsx` (click wiring) | exact (this is a documented direct pattern port, per CONTEXT.md) |
| `packages/client/src/components/BenchCarousel.tsx` | component (collaborator, card row renderer) | event-driven | `packages/client/src/components/PieceOverlay.tsx` (selection-state prop + onClick) | role-match |
| `packages/client/src/components/DraftPackCarousel.tsx` | component (collaborator, card row renderer) | event-driven | `packages/client/src/components/PieceOverlay.tsx` (selection-state prop + onClick) | role-match |
| `packages/client/src/components/LineupAssignmentScreen.module.css` | style (CSS Module) | n/a | `packages/client/src/components/HexCell.tsx` (`HIGHLIGHT_STYLES`), `PieceOverlay.tsx` (ring stroke constants) | exact — token source only, not a file-type analog |
| `packages/client/src/components/LineupAssignmentScreen.test.tsx` | test | event-driven | own prior version (drag-simulation → click-simulation rewrite) | exact (self-analog, mechanical `fireEvent` swap) |
| `packages/client/src/components/BenchCarousel.test.tsx` | test | event-driven | own prior version | exact |
| `packages/client/src/components/DraftPackCarousel.test.tsx` | test | event-driven | own prior version | exact |

No files are newly created this phase — every file above already exists and is rewritten in place.

## Pattern Assignments

### `packages/client/src/components/LineupAssignmentScreen.tsx` (component, event-driven)

**Analog:** `packages/client/src/store/useGameStore.ts` (`selectPiece` action) for the toggle-select-or-complete state shape; `packages/client/src/components/HexGrid.tsx`/`PieceOverlay.tsx` for click-wiring and highlight-derivation-at-render-time.

**Core toggle-select-or-complete pattern** (`useGameStore.ts` lines 772-798):
```typescript
selectPiece: (id) => {
  const { gameState, selectedPieceId, playerSlot } = get();
  // Toggle off if the same piece is clicked again
  if (selectedPieceId === id) {
    set({ selectedPieceId: null, validMoveHexes: [] });
    return;
  }
  const piece = gameState.pieces.find((p) => p.id === id);
  if (!piece) return;
  // ...phase-specific eligibility branch, ends with:
  const valid = computeKickOffSetupValidHexes(id, gameState, myTeam);
  set({ selectedPieceId: id, validMoveHexes: valid });
  return;
},
```
Port this 3-way shape (deselect-on-same-id / select-and-compute-eligible-set / no-op-if-ineligible) into each of the 4 new `handle*CardClick` functions named in RESEARCH.md (`handleRepositionCardClick`, `handleSubstituteBenchClick`/`handleSubstitutePitchClick`, `handlePregameCardClick`, draft pack/slot/bench click handlers) — **as 4 structurally separate functions**, never one function parameterized by mode (this is Pitfall 1, the single highest-risk item for this phase).

**Selection state shape to replace `DragState`/`MidmatchDragState`** (current types, `LineupAssignmentScreen.tsx` lines 128-164):
```typescript
type DragState =
  | { cardId: string; source: 'pack' }
  | { cardId: string; source: 'slot'; slotIndex: number }
  | { cardId: string; source: 'bench'; benchIndex: number };

type MidmatchDragState =
  | { source: 'pitch'; pieceId: string }
  | { source: 'bench'; playerId: string };
```
Replace 1:1 with click-selection equivalents (same tagged-union convention, `cardId`/`pieceId`/`playerId` fields kept, only the "how it got set" trigger changes from `onDragStart` to `onClick`). Do NOT remove `MidmatchSubMode` (line 139) or `PendingSubstitution` (line 149-155) — these are not drag-and-drop types.

**Card component prop/click-target pattern to replace** (`LineupStatCard`, `StatCardProps` lines 178-222, wrapper lines 298-307):
```typescript
// BEFORE — StatCardProps (lines 187-196, 217-221)
isDragSource: boolean;
isDropTarget: boolean;
onDragStart: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
onDragOver: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
onDragLeave: () => void;
onDrop: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
onDragEnd: () => void;
midmatchDraggable?: boolean;

// BEFORE — wrapper div (lines 298-307)
<div
  className={cardClass}
  draggable={isDraggable}
  onDragStart={(e) => onDragStart(e, slotIndex)}
  onDragOver={(e) => onDragOver(e, slotIndex)}
  onDragLeave={onDragLeave}
  onDrop={(e) => onDrop(e, slotIndex)}
  onDragEnd={onDragEnd}
>
```
Replace with `isSelected: boolean` / `isEligibleTarget: boolean` / `isSelectable?: boolean` and a single `onClick: () => void`, wired as `<div className={cardClass} onClick={isSelectable || isEligibleTarget ? onClick : undefined} style={{ cursor: ... }}>` — this directly mirrors `PieceOverlay.tsx`'s own click-gating idiom (lines 150-155):
```typescript
// packages/client/src/components/PieceOverlay.tsx, lines 143-155
<circle
  ...
  style={{ cursor: selectionState !== 'none' ? 'pointer' : 'default' }}
  onClick={() => {
    if (selectionState !== 'none') onClick();
    else onInspect();
  }}
/>
```
`LineupStatCard` has no `onInspect` equivalent, so the ternary collapses to: only attach `onClick` (and `cursor: pointer`) when the card is selected or an eligible/selectable target; otherwise no `onClick` (or a no-op), matching D-04.

**Class-selection pattern to replace** (lines 268-283):
```typescript
// BEFORE
if (isMidmatch) {
  cardClass = styles.statCard;
  if (isSubBlocked) cardClass = `${cardClass} ${styles.statCardSubBlocked}`;
  if (isSubTarget) cardClass = `${cardClass} ${styles.statCardSubTarget}`;
} else if (isGK && !allowGKDrag) {
  cardClass = styles.statCardLocked;
} else if (lineupConfirmed) {
  cardClass = styles.statCardConfirmed;
} else if (isDragSource) {
  cardClass = `${styles.statCard} ${styles.statCardDragging}`;
} else if (isDropTarget) {
  cardClass = `${styles.statCard} ${styles.statCardDropTarget}`;
} else {
  cardClass = styles.statCard;
}
```
Port this if/else-if class-composition shape unchanged in structure; swap `isDragSource`→`isSelected` (new green class), `isDropTarget`/`isSubTarget`→`isEligibleTarget` (one shared new blue class — RESEARCH.md explicitly flags `.statCardDropTarget` and `.statCardSubTarget` as byte-identical duplicates today; collapse to one class consumed by both call sites).

### `packages/client/src/components/LineupAssignmentScreen.module.css`

**Analog (color tokens to reuse, not copy CSS mechanism):** `packages/client/src/components/HexCell.tsx` lines 18-30 (`HIGHLIGHT_STYLES.safe`) and `packages/client/src/components/PieceOverlay.tsx` lines 6-8, 160-171 (`ACTIVE_RING_STROKE`, selectable-ring blue).

**Selected (green) token source** (`PieceOverlay.tsx` lines 6-8, 172-183):
```typescript
export const ACTIVE_RING_STROKE = '#22c55e';
// ...
{selectionState === 'active' && (
  <circle ... stroke={ACTIVE_RING_STROKE} strokeWidth={2.5} pointerEvents="none" />
)}
```
Also cross-confirmed by `HexCell.tsx` line 28: `HIGHLIGHT_STYLES.safe.stroke = '#16a34a'` (darker green variant) — `#22c55e` is the correct "this is the selected/active thing" token; `#16a34a` is the correct "this hex/target is safe to act on" token. For cards (one visual mechanism, a ring/border, not two), D-03 + RESEARCH.md's own recommendation: selected card → `#22c55e` border/ring family; eligible-target card → the blue below.

**Eligible-target (blue) token source** (`PieceOverlay.tsx` lines 160-171):
```typescript
{selectionState === 'selectable' && (
  <circle
    cx={cx} cy={cy} r={PIECE_RADIUS + 3}
    fill="none" stroke="#60a5fa" strokeWidth={2.5} pointerEvents="none"
  />
)}
```
`#60a5fa` is RESEARCH.md's recommended blue (Assumption A1) — "you may click this to act," the closest semantic match to a card eligible-target ring.

**Classes to remove** (`LineupAssignmentScreen.module.css`, current):
```css
/* lines 178-181 — remove: no drag gesture to visualize mid-gesture */
.statCardDragging {
  opacity: 0.45;
  cursor: grabbing;
}

/* lines 183-186 — remove per D-03: gold token rejected for "eligible target" */
.statCardDropTarget {
  border: 2px solid var(--color-accent-gold);
  box-shadow: 0 0 0 2px var(--color-accent-gold-glow);
}

/* lines 541-544 — remove: byte-identical duplicate of .statCardDropTarget */
.statCardSubTarget {
  border: 2px solid var(--color-accent-gold);
  box-shadow: 0 0 0 2px var(--color-accent-gold-glow);
}
```
`.statCardSubBlocked` (lines 547-550, `opacity: 0.7; cursor: not-allowed;`) and `.statCardSentOff` (lines 643-649) are NOT drag-and-drop classes — keep, though `.statCardSubBlocked`'s cursor may change to `default` per D-04's silent-no-op framing (Claude's Discretion / RESEARCH.md Assumption A3).

**Base card cursor to update** (line 156-164): `.statCard { cursor: grab; ... }` → `cursor: pointer` (no drag gesture exists).

**New classes needed** (not present today — author new, using the token values above):
```css
.statCardSelected {
  border: 2px solid #22c55e;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.4);
}
.statCardEligibleTarget {
  border: 2px solid #60a5fa;
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.4);
}
```
(Exact box-shadow alpha/naming is Claude's Discretion per CONTEXT.md — the border/ring color values above are the load-bearing part, sourced directly from `PieceOverlay.tsx`.)

### `packages/client/src/components/BenchCarousel.tsx` (component, event-driven)

**Analog:** `PieceOverlay.tsx`'s `onClick`/`selectionState` prop contract (a pure boolean/enum input, one `onClick` callback, no drag-payload plumbing).

**Current drag props to replace** (`BenchCarousel.tsx`, `BenchCarouselProps`):
```typescript
onCardDragStart: (benchIndex: number) => void;
onDropToBench: () => void;
```
Comment at line 14-18 already documents the pattern to preserve: *"The bench container's onDrop is intentionally payload-free — it only [relies on parent-owned] onCardDragStart callbacks. This component must never read dataTransfer..."* — the click-model equivalent keeps this exact "dumb collaborator, parent owns all resolution state" shape: `onCardClick: (benchIndex: number) => void` (fires on any bench card click, parent's `handleSubstituteBenchClick`/draft bench handler resolves select-vs-switch-vs-complete) and `onBenchAreaClick: () => void` (payload-free completion target, direct rename of `onDropToBench`, still fires only when the parent's active selection makes the bench itself a valid completion target — e.g. draft slot→bench moves).

Internal card rendering (line ~190, `draggable={disabled !== true}`) becomes `onClick={disabled !== true ? () => onCardClick(benchIndex) : undefined}` with cursor styling driven by a new `isSelected`/`isEligibleTarget` prop pair passed down per card (mirrors `LineupStatCard`'s new props above).

### `packages/client/src/components/DraftPackCarousel.tsx` (component, event-driven)

**Analog:** Same as `BenchCarousel.tsx` — `PieceOverlay.tsx`'s onClick contract; also directly parallels `LineupStatCard`'s prop rename since `DraftCardBody` (internal, `DraftCardBodyProps` lines 50-67) has the identical `draggable`/`onDragOver`/`onDrop` shape.

**Current drag props to replace** (`DraftPackCarouselProps`):
```typescript
onCardDragStart: (cardId: string) => void;
```
Comment at line 10 documents current one-way-out drag design: *"prefixed cardId via dataTransfer and expose no onDragOver/onDrop handler"* (line 232-235: `// D-06: drag SOURCE only — no onDragOver/onDrop on these cards (one-way out).`). Replace with `onCardClick: (cardId: string) => void` — pack cards are ALWAYS a selection source in the new model too (D-11: pack selection mirrors bench-first substitution), never a click-to-complete target themselves, so this stays a pure source-only callback, just renamed from drag-start semantics to click semantics. `draggable={!disabled}` (line 266) becomes `onClick={!disabled ? () => onCardClick(cardId) : undefined}`.

`DraftCardBody`'s `onDragOver?`/`onDrop?` (lines 58-59) — used when `DraftCardBody` renders a filled lineup slot, which today CAN be a drop target — become a single `onClick?: () => void` fired when that slot is an eligible target (per D-11's "filled slot mirrors mid-match positioning swap pattern").

---

## Shared Patterns

### Selection state shape (toggle-select-or-complete)
**Source:** `packages/client/src/store/useGameStore.ts`, `selectPiece` action, lines 772-798
**Apply to:** All 4 new click handlers in `LineupAssignmentScreen.tsx` (positioning, substitution-bench, pregame-swap, draft)
```typescript
if (selectedId === id) {
  setSelectedId(null); // clear + clear eligible set
  return;
}
if (selectedId !== null) {
  if (!isEligible(selectedId, id)) return; // D-04 no-op
  onComplete(selectedId, id); // fires existing onSwap/onReposition/onSubstitute/onDraftPick/onDraftRearrange unchanged
  setSelectedId(null);
  return;
}
if (isSelectable(id)) setSelectedId(id);
```

### Selected/eligible color tokens
**Source:** `packages/client/src/components/PieceOverlay.tsx` lines 6-8 (`ACTIVE_RING_STROKE = '#22c55e'`), 160-171 (`stroke="#60a5fa"` for `selectionState === 'selectable'`)
**Apply to:** New `.statCardSelected` (green, `#22c55e`) / `.statCardEligibleTarget` (blue, `#60a5fa`) CSS classes in `LineupAssignmentScreen.module.css`, consumed by `LineupStatCard`, the SENT OFF placeholder `<div>`, `BenchCarousel` cards, and `DraftPackCarousel`/`DraftCardBody` cards — one shared color vocabulary per D-03.

### Click-target gating (only attach onClick when interactive)
**Source:** `packages/client/src/components/PieceOverlay.tsx` lines 150-155
**Apply to:** `LineupStatCard`, `BenchCarousel` cards, `DraftPackCarousel`/`DraftCardBody` cards — conditionally attach `onClick` and `cursor: pointer` only when `isSelectable || isEligibleTarget`, otherwise no handler (matches D-04's silent no-op and avoids stray click listeners on inert cards).

### Parent-owns-all-resolution-state (no child reads a payload at completion time)
**Source:** `LineupAssignmentScreen.tsx` lines 125-127 (`DragState` doc comment) and `BenchCarousel.tsx` lines 14-18
**Apply to:** The new `SelectionState` equivalents — this convention ("a single parent-owned state variable resolves every click; children never resolve anything themselves, they only report `onCardClick(id)`") carries over unchanged from the drag-and-drop version and should NOT be relaxed just because `dataTransfer` plumbing goes away.

## No Analog Found

None — all 3 rewritten files and their CSS module have a direct, already-implemented analog pattern in this same codebase (`useGameStore.ts`/`HexGrid.tsx`/`HexCell.tsx`/`PieceOverlay.tsx`), as explicitly called out by CONTEXT.md's canonical references. This phase introduces zero new domain logic or interaction concepts requiring outside research.

## Metadata

**Analog search scope:** `packages/client/src/components/` (HexCell.tsx, PieceOverlay.tsx, GameBoard.tsx, HexGrid.tsx — grepped), `packages/client/src/store/useGameStore.ts` (selectPiece action), plus full targeted reads of the 3 files this phase rewrites and their CSS module.
**Files scanned:** 8 (LineupAssignmentScreen.tsx, BenchCarousel.tsx, DraftPackCarousel.tsx, LineupAssignmentScreen.module.css, HexCell.tsx, PieceOverlay.tsx, useGameStore.ts, HexGrid.tsx via grep)
**Pattern extraction date:** 2026-08-30
