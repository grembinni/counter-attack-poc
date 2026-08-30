# Phase 42: Substitution UX Overhaul - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 6 (2 client components + 2 client CSS + 2 server logic files + 1 shared logic file)
**Analogs found:** 6 / 6 (all modifications to existing files — no net-new files this phase)

## File Classification

| New/Modified File                                                                                                                                               | Role                            | Data Flow                                    | Closest Analog                                                                                                                 | Match Quality                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `packages/client/src/components/LineupAssignmentScreen.tsx` (`mode==='midmatch'` branch, `renderMidmatchColumn`, drag state)                                    | component                       | event-driven (drag/drop)                     | itself — the `draftMode` branch (`handleDraftSlotDragStart/Over/Drop`, `DragState` union) in the SAME file                     | exact (in-file sibling pattern)    |
| `packages/client/src/components/GameBoard.tsx` (`SubstitutionButton`, `.substitutionModalCard` block, Resume CTA)                                               | component                       | request-response (modal chrome, local state) | itself — `SideLog` (collapsed/expanded chrome sibling) + `ActionPanel`'s `confirmDialog`/`ctaButtonReady` (CTA button pattern) | exact (in-file + cross-component)  |
| `packages/client/src/components/GameBoard.module.css` (`.subButtonStrip`, `.substitutionModalClose` → CTA)                                                      | config/style                    | —                                            | itself — `.subButtonActive`, `.confirmOverlay`-derived `.substitutionOverlay` (already present)                                | exact                              |
| `packages/client/src/components/LineupAssignmentScreen.module.css` (new drag-swap / red-card-icon slot classes)                                                 | config/style                    | —                                            | itself — `.statCardDropTarget`, `.statCardSubTarget`, `.benchSlot`                                                             | exact                              |
| `packages/server/src/gameHandlers.ts` (SNAPSHOT_DEFLECT defender-set builder ~1285, SHOT-phase defender-set builder ~2288, `validateResponseMoveStep` ~273-329) | service/middleware (validation) | request-response                             | itself — `computePenaltyKickEligibleIds` / corner-kick-taker filter in `gameEngine.ts` (already-correct exclude-by-flag sites) | role-match (cross-file, same team) |
| `packages/server/src/gameEngine.ts` (`applyMove`'s red-card guard ~1072-1077, retrofit to shared helper)                                                        | service                         | request-response                             | itself — `computePenaltyKickEligibleIds` (~6962-6972)                                                                          | exact                              |
| `packages/shared/src/stoppagePhases.ts` (new `isActivePiece` helper)                                                                                            | utility                         | transform                                    | itself — `maxOnPitchFor` (~75-78), same file, same `redCarded` filter idiom                                                    | exact                              |
| `packages/client/src/components/HexGrid.tsx` (`canSelect*` gates ~830-870, add redCarded/onPitch check)                                                         | component                       | event-driven                                 | itself — `canSelectPenaltyKickTaker`'s existing redCarded exclusion (~929-932)                                                 | exact                              |
| `packages/shared/src/moveValidator.ts` (ZoI opponent list ~95-96)                                                                                               | utility                         | transform                                    | itself — `computePenaltyKickEligibleIds` pattern (cross-file), to be retrofitted with `isActivePiece`                          | role-match                         |

## Pattern Assignments

### `LineupAssignmentScreen.tsx` — `mode==='midmatch'` branch (3-way expansion + drag-swap)

**Analog:** the file's own `draftMode` branch (lines 634-735) — the closest existing "drag one card onto another to rearrange" implementation, using the parent-owned `DragState` union instead of per-child `dataTransfer` reads.

**Drag-state pattern to copy** (lines 109-112, `DragState` union):

```typescript
type DragState =
  | { cardId: string; source: 'pack' }
  | { cardId: string; source: 'slot'; slotIndex: number }
  | { cardId: string; source: 'bench'; benchIndex: number };
```

For the new position-swap-vs-substitute duality, extend this shape (or add a sibling union) so a single parent-owned variable resolves every drop — never read `dataTransfer` payload at drop time (established convention, comment at line 106-108).

**Drag handlers to mirror** (lines 634-674, `handleDraftSlotDragStart/DragOver/DragLeave/Drop/DragEnd`):

```typescript
function handleDraftSlotDragStart(e, cardId, idx) {
  setDragState({ cardId, source: 'slot', slotIndex: idx });
  e.dataTransfer.setData('text/plain', `slot:${idx}`);
  e.dataTransfer.effectAllowed = 'move';
}
function handleDraftSlotDrop(e, slotIndex) {
  e.preventDefault();
  setDraftDropTargetIndex(null);
  const ds = dragState;
  setDragState(null);
  if (!ds) return;
  if (ds.source === 'slot') {
    if (ds.slotIndex === slotIndex) return;
    onDraftRearrange?.({ type: 'slot', slotIndex: ds.slotIndex }, { type: 'slot', slotIndex });
  } // ...
}
```

For **position-swap mode (D-02)**: apply instantly on drop, no confirm — call an `onReposition`-style prop synchronously in the drop handler, exactly like `onDraftRearrange` fires synchronously with no popup today.

For **substitution mode (D-14, confirm-before-apply)**: do NOT fire `onSubstitute` synchronously in the drop handler. Instead stage `{ outPieceId, inPlayerId }` in local state and render a confirm popup — mirror `ActionPanel.tsx`'s `withEndTurnConfirm`/`confirmDialog` pattern (see Shared Patterns below), not the draft branch's immediate-fire.

**Existing midmatch scaffold to extend** (lines 737-852): the `if (mode === 'midmatch')` block already renders `renderMidmatchColumn` (pitch side, currently non-draggable per line 193-197 `isDraggable = isMidmatch ? false : ...`) and `BenchCarousel` (bench side, currently the only draggable source, line 837-841 `onCardDragStart`). This phase's 3-way branch work is: (1) make on-pitch cards draggable-onto-each-other in reposition sub-mode while keeping bench non-draggable (D-01 "bench cards are never draggable/selectable in this mode"), (2) add a `subMode` toggle button that flips bench-drag back on for the existing bench→pitch substitute gesture, gated by the 3-sub cap (`subsUsedVal >= 3`, already computed at line 804).

**Red-card empty-slot icon (D-05/D-06):** the vacated slot must render a real, still-droppable empty slot with a red-card glyph instead of a player card. Closest analog is the draft branch's own empty-slot placeholder (lines 721-730):

```typescript
<div
  key={slotIndex}
  className={styles.benchSlot}
  data-slot-index={slotIndex}
  onDragOver={(e) => handleDraftSlotDragOver(e, slotIndex)}
  onDragLeave={handleDraftSlotDragLeave}
  onDrop={(e) => handleDraftSlotDrop(e, slotIndex)}
/>
```

Swap `.benchSlot`'s dashed-placeholder styling for a new red-card-icon variant class (CSS below), keep the same drag handlers so another on-field card can still be dropped in (D-05: "not permanently locked").

**Bench red-card display (D-07):** no new component — `CardInjuryBadge` is already wired in at line 252-256 and again for bench cards via `benchCardStatus`/`cardColorForBenchEntry` (lines 777-783). This phase's only obligation here is a regression check, not new code.

---

### `GameBoard.tsx` — `SubstitutionButton` green strip (D-03) + Resume CTA (D-04)

**Analog:** `SideLog`'s collapsed/expanded chrome (lines 141-173) for structural parity, and `ActionPanel.tsx`'s `ctaButtonReady`/`confirmDialog` CTA button (lines 186-199) for the bottom full-width Resume button's visual weight.

**Current `SubstitutionButton`** (lines 190-209) — extend the `actionable` ternary to cover the OUTER `.subButtonStrip` div, not just the inner `.sideLogChevron.subButtonActive` button (D-03: "extending that green background to the full `.subButtonStrip` container"):

```typescript
function SubstitutionButton({ actionable, onOpen }: { actionable: boolean; onOpen: () => void }) {
  return (
    <div className={styles.subButtonStrip}>
      <button
        className={
          actionable ? `${styles.sideLogChevron} ${styles.subButtonActive}` : styles.sideLogChevron
        }
        onClick={onOpen}
        ...
```

Change: apply the active/green class to the OUTER `div` as well (e.g. `styles.subButtonStrip` + conditional `styles.subButtonStripActive`), per D-03.

**Current top-right close button to replace** (lines 596-602):

```typescript
<button
  className={styles.substitutionModalClose}
  onClick={() => setSubOpen(false)}
  aria-label="Close substitutions"
>
  &times;
</button>
```

Replace with a bottom full-width CTA styled like `ActionPanel.module.css`'s `.ctaButtonReady` (see CSS excerpt below) — same `onClick={() => setSubOpen(false)}` handler, moved to render after `<LineupAssignmentScreen>` inside `.substitutionModalCard`, matching `ActionPanel.tsx`'s pattern of a full-width button (`ctaButton`/`ctaButtonReady` composed classes) as the dominant CTA in a panel.

---

### `GameBoard.module.css` — green banner + CTA button classes

**Analog for the green background/text token pairing** (lines 603-610, already-existing `.subButtonActive`):

```css
.subButtonActive {
  background: var(--color-speed-standard-bg);
  color: var(--color-success);
}
.subButtonActive:hover {
  color: var(--color-success-hover);
}
```

Reuse the same two tokens (`--color-speed-standard-bg` / `--color-success`) for the new `.subButtonStripActive` (or equivalent) full-container variant — do not introduce a new color literal (D-03 explicitly cites these tokens).

**Analog for full-viewport modal card** (lines 632-638, `.substitutionModalCard`) — unchanged structurally; the Resume CTA is a new child rule, not a rework of this container.

**`.substitutionModalClose` (lines 643-661) is being replaced**, not extended — its `position: fixed; top/right` corner-icon treatment is exactly what D-04 says to abandon in favor of a full-width bottom CTA. Copy `ActionPanel.module.css`'s `.ctaButtonReady`/`.ctaButton` shape instead (see below).

---

### `ActionPanel.module.css` — CTA button classes to copy for the Resume button

```css
.ctaButton {
  /* lines 28-46 */
}
.ctaButtonReady {
  /* lines 162-167 — orange/ready state; Resume should use --color-success token family instead, matching D-03's green language, not copy the orange literal */
}
```

Read the exact declarations at `packages/client/src/components/ActionPanel.module.css:28-46,162-167` when implementing — these were located but not read line-by-line in this pass; grep confirms both classes exist and `confirmActions .ctaButton` (line 145) shows the two-button (Cancel/Confirm) row layout, useful for the substitution mode's own confirm popup (D-02/SUB-14) if it reuses the same visual language as `ActionPanel`'s `confirmDialog`.

---

### `LineupAssignmentScreen.module.css` — drag/drop + red-card slot classes

**Analog for state-based card classes** (lines 144-186):

```css
.statCardBase {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 6px 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-width: 260px;
}
.statCard {
  composes: statCardBase;
  cursor: grab;
  user-select: none;
  transition:
    opacity 0.1s ease,
    border-color 0.1s ease,
    box-shadow 0.1s ease;
}
.statCardDropTarget {
  border: 2px solid var(--color-accent-gold);
  box-shadow: 0 0 0 2px var(--color-accent-gold-glow);
}
```

For reposition-mode on-pitch cards becoming draggable-onto-each-other, reuse `.statCard`/`.statCardDropTarget` as-is (they already exist and are composed for exactly this "grab + drop target glow" interaction) — no new base classes needed, only a new `mode`/sub-mode branch in `LineupStatCard` deciding `isDraggable` (currently hardcoded `false` for all mid-match cards at line 193-197).

**Analog for the vacated-slot placeholder** (line 314, `.benchSlot`, and Standard-mode usage at lines 992-996):

```css
.benchSlot {
  /* dashed empty-slot placeholder */
}
```

Add a new modifier class (e.g. `.benchSlotRedCard`) composing `.benchSlot`'s box/drop-target shape but swapping the dashed-border/empty look for the red-card icon treatment (D-06) — read lines 314-343 directly before implementing to get the exact box-shape declarations.

---

### `gameHandlers.ts` — SNAPSHOT_DEFLECT / SHOT defender-set builders (BUG-38 fix sites)

**Site 1 — SNAPSHOT_DEFLECT defender-set builder** (lines 1285-1288):

```typescript
for (const defender of baseSnapState.pieces.filter(
  (p) => p.teamId === defendingTeam && p.role !== 'GK',
)) {
```

**Site 2 — SHOT-phase defender-set builder** (lines 2288-2290):

```typescript
for (const defender of declaredState.pieces.filter(
  (p) => p.teamId === defTeam && p.role !== 'GK',
)) {
```

**Fix (D-09/D-10):** both sites are missing a `redCarded`/`onPitch` exclusion — apply the new shared `isActivePiece` helper:

```typescript
for (const defender of baseSnapState.pieces.filter(
  (p) => p.teamId === defendingTeam && p.role !== 'GK' && isActivePiece(p),
)) {
```

(same change at site 2, substituting `declaredState`/`defTeam`).

**Already-correct sibling pattern to retrofit onto the same helper** — `computePenaltyKickEligibleIds` in `gameEngine.ts` (lines 6962-6972):

```typescript
export function computePenaltyKickEligibleIds(
  pieces: readonly PlayerPiece[],
  kickingTeam: 'home' | 'away',
  excludeIds: readonly string[] = [],
): { attacking: readonly string[]; defending: readonly string[] } {
  const eligible = pieces.filter((p) => p.redCarded !== true && !excludeIds.includes(p.id));
  ...
```

And the corner-kick-taker filter (`gameEngine.ts:5749`):

```typescript
(p) => p.role !== 'GK' && p.id !== cornerKickTakerId && p.redCarded !== true,
```

Both should be retrofitted to call `isActivePiece(p)` in place of the inline `p.redCarded !== true` clause (D-10 item 2), for consistency once the helper exists — behavior-identical, refactor-only.

**Site 3 — `validateResponseMoveStep`** (lines 273-329, full function read above): currently has NO `redCarded`/`onPitch` check at all in its guard sequence (ownership → carrier-exclusion → lock → pace → distance → boundary → occupancy). Add a new guard, e.g. immediately after the ownership check at line 292-294:

```typescript
if (!isActivePiece(piece)) {
  return fail(
    'MOVE_INVALID' /* or a dedicated RED_CARDED-style reason, confirm against existing GameError union */,
  );
}
```

Mirrors `applyMove`'s existing red-card rejection shape (`gameEngine.ts:1075-1077`, `MOVE_INVALID`/`RED_CARDED` detail) — this is the response-move-step sibling of that guard, not a new pattern.

---

### `gameEngine.ts` — `applyMove`'s red-card guard (retrofit target, not a new fix)

**Current guard** (lines 1072-1077):

```typescript
// 2.6. CARD-02/CARD-04 (Phase 39, 39-10): a red-carded piece is kept in state.pieces
// (dismissal representation — see resolveFoulChain's comment) rather than spliced out,
// so it must be actively rejected here instead of simply no longer existing.
if (piece.redCarded === true) {
  return { ok: false, reason: 'MOVE_INVALID', detail: 'RED_CARDED' };
}
```

D-10 item 2 says retrofit this to call the shared helper too, for consistency — even though it's already correct:

```typescript
if (!isActivePiece(piece)) {
  return { ok: false, reason: 'MOVE_INVALID', detail: 'RED_CARDED' };
}
```

---

### `packages/shared/src/stoppagePhases.ts` — new `isActivePiece` helper (D-09)

**Analog — same file, same filter idiom** (lines 75-78, `maxOnPitchFor`):

```typescript
export function maxOnPitchFor(pieces: readonly PlayerPiece[], teamId: 'home' | 'away'): number {
  const redCardCount = pieces.filter((p) => p.teamId === teamId && p.redCarded === true).length;
  return 11 - redCardCount;
}
```

**New helper to add, same file, same export style:**

```typescript
/** D-09 (Phase 42): the single shared exclude-by-flag check for "is this piece
 * eligible for gameplay computations" — redCarded !== true (and/or onPitch !== false,
 * confirm exact boolean semantics against types.ts's onPitch doc comment during planning).
 * Every eligibility/defender-list site should call this instead of hand-writing its own
 * inline filter (this had already happened 3+ times before this phase — see gameEngine.ts
 * computePenaltyKickEligibleIds, the corner-kick-taker filter, and applyMove's guard). */
export function isActivePiece(piece: PlayerPiece): boolean {
  return piece.redCarded !== true;
}
```

This file already imports `PlayerPiece` from `./types.js` (confirm import path during implementation) and is the natural home — it's the one shared-logic file (not `types.ts` itself, which is pure type/const declarations) already exporting a `redCarded`-aware pure function (`maxOnPitchFor`) and a stoppage-phase predicate (`isStoppagePhase`, lines 59-61) in the same "small gameplay-rule helper" role.

---

### `moveValidator.ts` — ZoI opponent list (Pitfall 7 fix site)

**Current code** (lines 95-96):

```typescript
const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId);
const allDefenders = getZoIDefenders(to, opponents);
```

**Fix:** add the `isActivePiece` exclusion alongside the team filter:

```typescript
const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId && isActivePiece(p));
```

Requires importing `isActivePiece` from `./stoppagePhases.js` (same package, sibling file) — confirm this doesn't create a circular import with `stoppagePhases.ts` (it currently imports `PlayerPiece`/`GamePhase` types from `./types.js`, not from `moveValidator.ts`, so a one-way import `moveValidator.ts -> stoppagePhases.ts` is safe).

---

### `HexGrid.tsx` — `canSelect*` gates (defense-in-depth, D-10 item 3)

**Analog — already-correct sibling gate** (`canSelectPenaltyKickTaker`, referenced at line 929-932 per the in-file comment "The redCarded exclusion mirrors the..."):

```typescript
const canSelectPenaltyKickTaker =
  /* ...existing conditions... */ && piece.redCarded !== true;
```

Apply the same `&& isActivePiece(piece)` (or `&& piece.redCarded !== true` if the client bundle doesn't want a shared-package import here — confirm during planning) to whichever of the `canSelect*` gates at lines 830-870 are currently missing it. The render-skip at line 761 already masks this client-side, but D-10 item 3 calls for defense-in-depth against a modified client — read lines 830-870 directly during planning to enumerate exactly which gates lack the check.

## Shared Patterns

### Confirm-before-apply popup (substitution mode's SUB-14 requirement)

**Source:** `ActionPanel.tsx` lines 170-183 (`withEndTurnConfirm`) + 186-199+ (`confirmDialog`), styled via `ActionPanel.module.css` `.confirmOverlay`/`.confirmCard`/`.confirmText`/`.confirmActions`/`.ctaButton` (lines 109-151).
**Apply to:** `LineupAssignmentScreen.tsx`'s new substitution-mode drop handler — stage the pending `{outPieceId, inPlayerId}` in local state instead of firing `onSubstitute` immediately, render a confirm/cancel popup naming the player off/on, only call `onSubstitute` on explicit confirm. This is a DIFFERENT pattern from the position-swap mode's drop handler (D-02: instant, no popup) — do not conflate the two branches.

### Exclude-by-flag (not remove-by-splice) for red-carded pieces

**Source:** `gameEngine.ts` `applyMove` guard (1072-1077), `computePenaltyKickEligibleIds` (6962-6972), corner-kick-taker filter (5749), `stoppagePhases.ts`'s `maxOnPitchFor` (75-78).
**Apply to:** every BUG-38 fix site (`gameHandlers.ts` two defender-set builders + `validateResponseMoveStep`, `moveValidator.ts`'s ZoI opponent list, `HexGrid.tsx`'s `canSelect*` gates) — all should converge on calling the new `isActivePiece` helper rather than hand-writing `p.redCarded !== true` inline. D-08 is explicit: never null out `position` or splice from `state.pieces`.

### Green CTA token pairing

**Source:** `GameBoard.module.css:603-610` (`--color-speed-standard-bg` background / `--color-success` text / `--color-success-hover` on hover).
**Apply to:** the extended `.subButtonStrip` full-container green treatment (D-03) and, if the Resume CTA also adopts a green look (per "green Resume button" in the phase title's chrome-changes line), the same two tokens rather than introducing new color literals.

### Parent-owned single `DragState` variable, never read `dataTransfer` at drop time

**Source:** `LineupAssignmentScreen.tsx` lines 106-108 (comment) + 109-112 (`DragState` type) + 356 (`dragState` local state) — established in Phase 29 (`29-03-SUMMARY.md` pattern per the in-file comment).
**Apply to:** the new position-swap-vs-substitute drag/drop wiring in the same file's `mode==='midmatch'` branch — extend or add a sibling `DragState`-shaped union; do not read `e.dataTransfer.getData(...)` payloads at drop time except for the legacy pregame `handleDrop` (line 543-551), which is untouched by this phase.

## No Analog Found

None — every in-scope file is a modification to an existing file with a directly analogous pattern already present in the same file or a clear sibling file in the same package. No net-new files/components are required by CONTEXT.md's decisions.

## Metadata

**Analog search scope:** `packages/client/src/components/{LineupAssignmentScreen,GameBoard,ActionPanel,HexGrid,CardInjuryBadge}.{tsx,module.css}`, `packages/server/src/{gameHandlers,gameEngine}.ts`, `packages/shared/src/{types,moveValidator,stoppagePhases}.ts`
**Files scanned:** 9 read directly (targeted ranges), several more grepped for line-number confirmation
**Pattern extraction date:** 2026-08-21
