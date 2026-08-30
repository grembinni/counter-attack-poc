# Phase 47: Select-Based Roster Interaction - Research

**Researched:** 2026-08-30
**Domain:** React client interaction-model rewrite (native HTML5 drag-and-drop → click-to-select), single existing file (`LineupAssignmentScreen.tsx`) + 2 collaborators, no server/protocol changes.
**Confidence:** HIGH — every finding below is grounded in direct inspection of this repo's own source (`GameBoard.tsx`, `HexGrid.tsx`, `HexCell.tsx`, `PieceOverlay.tsx`, `LineupAssignmentScreen.tsx`, `BenchCarousel.tsx`, `DraftPackCarousel.tsx`, `LineupAssignmentScreen.module.css`, `LineupAssignmentScreen.test.tsx`, `docs/HIGHLIGHT-REFERENCE.md`, `.planning/research/PITFALLS.md`, `App.tsx`, `GameBoard.tsx`), not generic industry advice. No external packages are introduced this phase — no package-legitimacy audit applies, no new library research needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope Expansion**
- **D-01:** Drag-and-drop is retired everywhere in `LineupAssignmentScreen.tsx`, not just the mid-match roster screen. `REQUIREMENTS.md` now has ROSTER-07 (Standard pregame swap) and ROSTER-08 (draft-mode pack/bench/lineup), and `ROADMAP.md` Phase 47's Goal/Success Criteria were widened to match.
- **D-02:** This expansion also resolves a pre-existing inconsistency: `ROADMAP.md`'s original Phase 47 success criterion 5 already read "no drag-and-drop state, handlers, or types remain in `LineupAssignmentScreen.tsx`" (file-wide), which contradicted the Goal text's "mid-match only" framing and REQUIREMENTS.md's Out-of-Scope line. The file-wide reading wins.

**Card Selection Visuals**
- **D-03:** Selected card and eligible-target highlighting reuse the pitch's existing `HIGHLIGHT_STYLES`/`RING_STYLES` tokens from `docs/HIGHLIGHT-REFERENCE.md` (green = selected, blue = eligible target) — one color vocabulary for "selected"/"eligible" across pitch and roster, not a new roster-local color pair and not a repurposing of the existing drag-state CSS classes (`statCardDragging`/`statCardDropTarget`).
- **D-04:** Clicking an ineligible card while something is selected is a no-op — the current green selection and blue targets stay exactly as they are. Matches the pitch's click-to-move convention exactly.
- **D-05:** The SENT OFF placeholder slot (a dismissed/red-carded player's frozen slot) gets the blue eligible-target highlight **only** in positioning/reposition mode, matching today's drag behavior where it's a legal reposition drop zone. It is never a valid or highlighted target in substitution mode (there's no active player there to sub out).

**Substitution Selection Order**
- **D-06:** Substitution mode stays bench-first only — the user must click a bench card first (it turns green), which highlights eligible on-pitch cards blue; clicking an on-pitch card first does nothing. Mirrors today's drag-always-originates-from-bench behavior exactly.
- **D-07:** While a bench card is selected, clicking a *different eligible* bench card switches the selection to it (previous green clears, new card turns green, blue on-pitch targets stay the same set) — lets the user change their mind about who to bring on before committing, without an explicit deselect step.
- **D-08:** This "switches selection" behavior is bench-substitution-specific, NOT symmetric with positioning mode. In positioning mode, a selected on-pitch card must be explicitly deselected (click it again) before a different card can be selected — positioning mode keeps strict pitch-style behavior. (Ineligible-target no-op, D-04, still applies identically in both modes — the distinction is specifically about clicking a *different eligible source-type* card.)

**GK Selectability**
- **D-09:** The GK stays permanently unselectable in positioning mode — same rule, same reason as today (server-side `GK_SLOT_LOCKED` guard already rejects any GK move). The GK card never turns green/clickable there. Making GK selectable was explicitly considered and rejected as an out-of-scope new capability.

**Component Structure**
- **D-10:** Keep one shared click-select `LineupStatCard` / column-rendering path across all four surfaces (mid-match, Standard pregame, draft) rather than splitting into per-surface components. Eligibility/guard logic still stays in separate functions per surface (ROSTER-05's "not merged into one handler" requirement extends to all surfaces, not just the two mid-match modes).
- **D-11:** Draft-mode click-select generalizes exactly from the mid-match vocabulary already locked in D-06/D-07/D-08:
  - **Pack card selection** mirrors mid-match substitution's bench-first pattern: select a pack card (green) → eligible empty/fillable slots and bench highlight blue → click completes the pick.
  - **Filled slot or bench card selection** mirrors mid-match positioning's swap pattern: select (green) → eligible other slots/bench highlight blue → click swaps/rearranges.
  - All existing GK-slot-only-accepts-GK-card rules and swap-vs-move semantics (slot↔slot is a two-way swap via `onDraftRearrange`; slot→bench and bench→slot are moves) carry over unchanged — only the input mechanism changes, not the underlying rules.
- **D-12:** Standard pregame lineup swap (non-draft) also converts to the same positioning-mode-style swap pattern (select a card, click an eligible slot, swap completes) — same as D-11's "filled slot" case, applied to the pregame surface's simpler single-swap-only flow.

### Claude's Discretion
- Exact CSS class naming/structure for the new shared selection-visual treatment (as long as it draws from `HIGHLIGHT_STYLES`/`RING_STYLES` tokens per D-03).
- Whether the underlying selection state is one `useState` shape shared across all four surfaces or per-surface state, as long as the observable behavior in D-04 through D-12 holds and eligibility functions stay structurally separate (ROSTER-05).
- Keyboard/accessibility affordances beyond click (not raised in discussion — use judgment, consistent with how the existing pitch selection handles it).

### Deferred Ideas (OUT OF SCOPE)
None — the one scope-expansion idea raised (retiring drag-and-drop everywhere) was folded into this phase's scope rather than deferred, per explicit user confirmation (D-01).

Out of scope for this phase specifically (from the phase description, not CONTEXT.md discretion): fixing any GK/final-third/banner/jersey-number bugs (Phases 48–50); the rules-fidelity audit (Phase 51).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROSTER-01 | User can select a player card on the mid-match roster screen by clicking it (green outline = selected state) | Reference pattern documented below (`HexGrid.tsx`/`PieceOverlay.tsx` selection click model); `HIGHLIGHT_STYLES`/ring color values documented for reuse |
| ROSTER-02 | Selecting a player highlights all eligible swap/substitution targets in blue | Existing `computeMovementValidHexes`-style "compute eligible set on select" pattern documented; current drag-eligibility conditions (`midmatchDraggable`, GK/slot-0 exclusions) catalogued as the source-of-truth eligibility rules to port |
| ROSTER-03 | Clicking the selected player again deselects it and clears blue highlights | `selectPiece`'s `if (selectedPieceId === id) { clear }` toggle-off pattern documented as the reference idiom |
| ROSTER-04 | Clicking an eligible blue target completes the swap/substitution, matching today's confirm flow | Existing `onSwap`/`onReposition`/`onSubstitute`(+staging popup)/`onDraftPick`/`onDraftRearrange` call sites catalogued below — unchanged by this phase |
| ROSTER-05 | Positioning-mode and substitution-mode eligibility/guard logic remain separate functions | Pitfall 1 (research/PITFALLS.md) directly addresses this; current `handleMidmatchRepositionDrop`/`handleMidmatchSubstituteDrop` separation catalogued as the pattern to preserve |
| ROSTER-06 | All native drag-and-drop code removed from `LineupAssignmentScreen.tsx`, zero dead code per `knip` | Full before-state inventory of drag types/handlers/props/CSS classes below; knip invocation and current clean-baseline confirmed |
| ROSTER-07 | Standard pregame lineup swap converts to click-to-select | Current `handleDragStart`/`handleDragOver`/`handleDrop`/`handleDragEnd`(module-scope, ~line 801-831) and `renderColumn` catalogued as the before-state |
| ROSTER-08 | Draft-mode pack carousel + bench/slot rearrange converts to click-to-select | Current `DragState` union, `handleDraftSlotDragStart/DragOver/DragLeave/Drop/DragEnd`, `handleDropToBench`, `rejectForGKRule` catalogued; `DraftPackCarousel`/`BenchCarousel` collaborator props catalogued |

</phase_requirements>

## Summary

This phase is a pure client-side interaction-model swap: replace native HTML5 drag-and-drop with the click-to-select model (green selected / blue eligible target) already implemented and battle-tested on the hex pitch (`GameBoard.tsx` → `HexGrid.tsx` → `HexCell.tsx`/`PieceOverlay.tsx`). No server protocol, no `GameState` shape, and no eligibility *rule* changes — only the client-side gesture that triggers the same existing `onSwap`/`onReposition`/`onSubstitute`/`onDraftPick`/`onDraftRearrange` callbacks changes. The entire rewrite is scoped to `packages/client/src/components/LineupAssignmentScreen.tsx` (1424 lines) and its two collaborators `BenchCarousel.tsx` (212 lines) and `DraftPackCarousel.tsx` (283 lines), all in `packages/client/src/components/`.

The reference pattern to port lives in three places: (1) `useGameStore.ts`'s `selectPiece(id)` action, whose universal shape is "if already selected, deselect and clear valid-target set; else compute and set the valid-target set," (2) `HexGrid.tsx`'s per-hex `onClick` wiring, which resolves to either `selectPiece(id)` (select) or a completion emit (e.g. `emitMove`) depending on phase/selection state, and (3) `HexCell.tsx`/`PieceOverlay.tsx`'s highlight rendering, which is a pure lookup into `HIGHLIGHT_STYLES`/`RING_STYLES` (hex tints) or the `SelectionState` enum (piece rings) — `safe` (green, `#16a34a`/`rgba(34,197,94,0.4)`) for eligible targets, `selectionState="active"` (green ring `#22c55e`) for the selected piece itself. This phase's card-selection visuals should reuse these exact tokens per D-03, not invent new roster-local colors.

The single highest-risk item, called out explicitly by this milestone's own pre-existing research (`research/PITFALLS.md` Pitfall 1), is collapsing positioning-mode and substitution-mode eligibility into one shared click handler. The current drag implementation already enforces two structurally separate handler functions (`handleMidmatchRepositionDrop` / `handleMidmatchSubstituteDrop`) sharing no guard body — ROSTER-05 requires this to continue, and per D-10/D-11/D-12 the same separation now extends to Standard-pregame and draft-mode surfaces (4 separate eligibility functions total, one shared rendering/selection-state shape allowed per D-10's discretion note).

**Primary recommendation:** Introduce one `SelectionState`-shaped `useState` (or four per-surface equivalents — Claude's discretion, D-10) that mirrors `MidmatchDragState`'s existing tagged-union convention, replacing every `DragState`/`MidmatchDragState` field 1:1 with a `{source, id}`-shaped selection; keep `computeReposition Eligible(...)`, `computeSubstituteEligible(...)`, `computePregameSwapEligible(...)`, and `computeDraftEligible(...)` as four separate pure functions (never one branching function); wire each `LineupStatCard`'s `onClick` to a `handleCardClick` per surface that either (a) selects (if nothing selected / different eligible source-type per D-06/D-07/D-08), (b) deselects (click same card again), or (c) completes the action (click an eligible blue target) — directly mirroring `selectPiece`'s three-way branch shape from `useGameStore.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Selection state (which card is green, which are blue) | Browser / Client | — | Pure client-local UI state (`useState`), never sent to server, mirrors existing `selectedPieceId`/`validMoveHexes`/`DragState` local-state pattern (Pitfall 7: "drag/scroll UI state is local — never in Zustand") |
| Eligibility computation (which targets are legal to click) | Browser / Client | API / Backend (authoritative) | Client computes for UX/highlighting only; server (`applyRosterReposition`, `applySubstitution`, `LINEUP_SWAP`, `DRAFT_PICK`, `DRAFT_REARRANGE` handlers) remains the sole authority — client eligibility is a UX mirror, never trusted (research/PITFALLS.md "Security Mistakes" row) |
| Click-to-complete-action emit (`onSwap`/`onReposition`/`onSubstitute`/`onDraftPick`/`onDraftRearrange`) | Browser / Client (trigger) | API / Backend (validation + state mutation) | Unchanged this phase — only the client-side gesture that fires these callbacks changes from `onDrop` to `onClick` |
| Highlight color tokens (`HIGHLIGHT_STYLES`/`RING_STYLES`) | Browser / Client | — | Presentation-only, already centralized in `HexCell.tsx` per `docs/HIGHLIGHT-REFERENCE.md`; this phase reuses, does not modify |
| Card component rendering (`LineupStatCard`, `DraftCardBody`) | Browser / Client | — | Pure React component tier; no SSR in this app (Vite SPA) |

## Reference Pattern — What GameBoard.tsx/HexCell.tsx Do Today

### Selection state shape (`useGameStore.ts`)

`selectedPieceId: string | null` + `validMoveHexes: HexCoord[]` (plus a sibling `tackleRiskHexes` for the risk-tint subset). The `selectPiece(id)` action's universal shape, repeated per-phase across ~20 branches in `useGameStore.ts`:

```typescript
// Source: packages/client/src/store/useGameStore.ts, selectPiece action (~line 772)
selectPiece: (id) => {
  const { gameState, selectedPieceId, playerSlot } = get();
  if (selectedPieceId === id) {
    // Click the already-selected piece again -> deselect, clear highlights (ROSTER-03 shape)
    set({ selectedPieceId: null, validMoveHexes: [] });
    return;
  }
  // ...phase/eligibility guards (varies per phase)...
  const { validMoveHexes: valid } = computeMovementValidHexes(piece, gameState);
  set({ selectedPieceId: id, validMoveHexes: valid }); // select + compute eligible targets (ROSTER-01/02 shape)
},
```

This is the exact shape ROSTER-01/02/03 ask for, generalized to cards: click same selected id → deselect + clear; click a new eligible id → select + compute eligible-target set.

### Click wiring (`HexGrid.tsx`)

Each piece's `onClick` resolves to `selectPiece(piece.id)` when the piece is selectable (gated by a `canSelect*` phase predicate), and each hex's `onClick` resolves to a completion emit (e.g. `() => emitMove(selectedPieceId, hex)`) when that hex is a valid target. `PieceOverlay`'s `selectionState` prop — `'none' | 'selectable' | 'active' | 'activated'` (`PieceOverlay.tsx`, exported type `SelectionState`) — is derived per-piece as `piece.id === selectedPieceId ? 'active' : (isEligibleThisPhase ? 'selectable' : 'none')`, matching the green/blue split ROSTER-01/02 need (card equivalent: `LineupStatCard` needs an analogous 3-state visual prop rather than the current boolean `isDragSource`/`isDropTarget` pair).

### Highlight rendering (`HexCell.tsx` / `PieceOverlay.tsx` / `docs/HIGHLIGHT-REFERENCE.md`)

`HIGHLIGHT_STYLES` is a `Record<HexHighlightType, {fill, restOpacity, hoverOpacity, stroke, strokeWidth}>` — a pure lookup table, not per-component styling logic. The exact tokens D-03 says to reuse for cards:

| Token | Semantic | Values | Source |
|-------|----------|--------|--------|
| `HIGHLIGHT_STYLES.safe` (hex tint) | 🟢 valid target | `fill: 'rgba(34,197,94,0.4)'`, `stroke: '#16a34a'`, `strokeWidth: 1.5`, rest/hover opacity `0.65`/`0.8` | `HexCell.tsx` |
| `PieceOverlay` `selectionState="active"` (piece ring) | 🟢 currently-selected piece | `stroke: '#22c55e'` (`ACTIVE_RING_STROKE` constant), radius offset `+4` | `PieceOverlay.tsx` |
| `PieceOverlay` `selectionState="selectable"` (piece ring) | 🔵 piece can be selected this turn | `stroke: '#60a5fa'`, radius offset `+3` | `PieceOverlay.tsx` |

D-03's intent for cards: selected card = green (`#22c55e`/`ACTIVE_RING_STROKE` family), eligible-target card = blue. Note the pitch's own vocabulary actually uses green for BOTH "safe destination hex" (`HIGHLIGHT_STYLES.safe`) and "the active/selected piece itself" (`PieceOverlay` `active` ring) — they are different mechanisms (hex tint vs. piece ring) that happen to share the green family. For cards there is only one mechanism (a card border/ring, no separate "hex" to tint), so the natural mapping is: selected card → green ring (reuse `ACTIVE_RING_STROKE`/`#22c55e`), eligible-target card → blue ring (reuse `PieceOverlay`'s `selectable` blue, `#60a5fa`, OR `HIGHLIGHT_STYLES.kickoff`'s saturated blue family — either is a legitimate "reuse an existing blue token" choice; `#60a5fa` is the closer semantic match since it specifically means "you may click this to act," identical to what a card target means). Whichever exact token is chosen, `docs/HIGHLIGHT-REFERENCE.md` should get a note referencing the new card-selection use if a genuinely new mechanism (a 4th "card ring" category) is introduced — see "Adding a New Highlight" in that doc.

**Verification note:** `docs/HIGHLIGHT-REFERENCE.md` is a documented single-source-of-truth ("Do not add a new color literal to `HexCell.tsx`, `PieceOverlay.tsx`, or `BallLocationRing.tsx` without adding a corresponding row here"). Card selection is a 4th component (`LineupAssignmentScreen.tsx`), not one of those three — the doc's "Adding a New Highlight" section implies any new color mechanism should get a row, but it does not currently mandate covering non-pitch components. Planner should decide whether to add a "4. Card Selection (`LineupAssignmentScreen.tsx`)" section to this doc for consistency, since D-03 explicitly ties card selection into this same vocabulary.

## Current Drag-and-Drop Implementation — Full Before-State Inventory

All of the following are in `packages/client/src/components/LineupAssignmentScreen.tsx` (1424 lines) unless noted, and must be entirely removed per ROSTER-06 (verified by a clean `knip` run).

### Types (module scope)

| Type | Lines | Shape | Used by |
|------|-------|-------|---------|
| `DragState` | 128-131 | `\| {cardId, source:'pack'} \| {cardId, source:'slot', slotIndex} \| {cardId, source:'bench', benchIndex}` | Draft-mode drag (pack/slot/bench origin tracking) |
| `MidmatchSubMode` | 139 | `'reposition' \| 'substitute'` | **NOT drag-and-drop — this is the mode toggle, KEEP THIS TYPE.** Mid-match positioning vs. substitution mode selection; unrelated to the drag mechanism itself |
| `PendingSubstitution` | 149-155 | `{outPieceId, inPlayerId, outName, outNumber, inName}` | **NOT drag-and-drop — KEEP.** The staged-substitution confirmation popup state; substitution still needs to stage-then-confirm under click-select (D-06/D-07/D-08 describe the click-select bench-selection flow, but the confirm-popup mechanic itself is unchanged) |
| `MidmatchDragState` | 162-164 | `\| {source:'pitch', pieceId} \| {source:'bench', playerId}` | Mid-match drag (positioning-mode pitch drag + substitution-mode bench drag) |

**Note for planner:** `MidmatchSubMode` and `PendingSubstitution` are NOT drag-and-drop types — do not remove them. Only `DragState` and `MidmatchDragState` (and their `useState` instances) are drag-and-drop-specific and must be replaced with click-select equivalents.

### State (component scope)

| State variable | Lines | Replaces to |
|---|---|---|
| `dragSourceIndex`, `dropTargetIndex` (Standard pregame) | 382-383 | Click-select equivalent (selected slot index + eligible slot indices) |
| `dragState: DragState \| null` (draft) | 440 | Click-select equivalent selection state |
| `draftDropTargetIndex` (draft) | 441 | Eligible-target set (array/Set of slot indices) |
| `midmatchDrag: MidmatchDragState \| null` | 520 | Click-select equivalent selection state |
| `midmatchDropTargetPieceId` | 521 | Eligible-target set (array/Set of piece ids) |
| `pendingSub: PendingSubstitution \| null` | 528 | **KEEP unchanged** — staging/confirm-popup mechanic survives; only what populates it (a click, not a drop) changes |
| `subMode: MidmatchSubMode` | 517 | **KEEP unchanged** — the Reposition/Substitute mode toggle is unaffected by the drag→click swap |

### Handler functions (must be removed/replaced)

| Handler | Lines | Mode | Fires on | Replaces to |
|---|---|---|---|---|
| `handleMidmatchDragStart` | 533-536 | Mid-match positioning | pitch card `onDragStart` | Click-select `handleCardClick` (positioning) |
| `handleMidmatchRepositionDrop` | 543-552 | Mid-match positioning | pitch/SENT-OFF card `onDrop` | Completion branch of positioning click handler — calls `onReposition` unchanged |
| `handleMidmatchSubstituteDrop` | 562-581 | Mid-match substitution | pitch/SENT-OFF card `onDrop` | Completion branch of substitution click handler — stages `pendingSub` unchanged |
| `handleDragStart` (module scope, Standard pregame) | 801-805 | Standard pregame | lineup card `onDragStart` | Click-select `handleCardClick` (pregame swap) |
| `handleDragOver` | 807-812 | Standard pregame | lineup card `onDragOver` | N/A — click model has no hover-drag-over step |
| `handleDragLeave` | 814-816 | Standard pregame | lineup card `onDragLeave` | N/A |
| `handleDrop` | 818-826 | Standard pregame | lineup card `onDrop` | Completion branch — calls `onSwap` unchanged |
| `handleDragEnd` | 828-831 | Standard pregame | lineup card `onDragEnd` | N/A |
| `handleDraftSlotDragStart` | 909-917 | Draft (slot origin) | filled slot card `onDragStart` | Click-select `handleCardClick` (draft, filled-slot source) |
| `handleDraftSlotDragOver` | 919-922 | Draft | slot `onDragOver` | N/A |
| `handleDraftSlotDragLeave` | 924-926 | Draft | slot `onDragLeave` | N/A |
| `handleDraftSlotDrop` | 928-944 | Draft | slot `onDrop` | Completion branch — calls `onDraftPick`/`onDraftRearrange` unchanged; `rejectForGKRule` guard logic carries over |
| `handleDraftSlotDragEnd` | 946-949 | Draft | container `onDragEnd` | N/A |
| `handleDropToBench` | 951-967 | Draft | `BenchCarousel`'s `onDropToBench` | Completion branch when a bench card/area is the click target |

`rejectForGKRule(slotIndex, cardId)` (890-902) and `showDraftRejection(message)` (904-907) are pure validation/messaging helpers with NO drag-specific logic inside them — **keep both, call them from the new click-completion handlers instead of the drop handlers.**

### Props removed from `LineupStatCard` (`StatCardProps`, lines 178-222)

| Prop | Type | Replaces to |
|---|---|---|
| `isDragSource: boolean` | required | `isSelected: boolean` (green) |
| `isDropTarget: boolean` | required | `isEligibleTarget: boolean` (blue) |
| `onDragStart`, `onDragOver`, `onDragLeave`, `onDrop`, `onDragEnd` | 5 required callback props | Single `onClick: () => void` |
| `midmatchDraggable?: boolean` | optional | `isSelectable?: boolean` (renamed; same eligibility computation feeds it, just gates click instead of `draggable` attribute) |
| `isSubTarget?: boolean`, `isSubBlocked?: boolean` | optional | `isSubTarget` folds into `isEligibleTarget`; `isSubBlocked` (red-carded/no-op styling) likely survives as-is — it is a "never eligible, show as blocked" visual, not a drag concept |

The `<div draggable={isDraggable} onDragStart={...} onDragOver={...} onDragLeave={...} onDrop={...} onDragEnd={...}>` wrapper (lines 299-307) becomes `<div onClick={handleClick} role="button" ...>` (or similar — see Accessibility note below).

### CSS classes to remove/replace (`LineupAssignmentScreen.module.css`)

| Class | Lines | Current meaning | D-03 disposition |
|---|---|---|---|
| `.statCardDragging` | 178-181 | `opacity: 0.45; cursor: grabbing;` — applied to the drag source while dragging | **Remove.** No native drag gesture exists to visualize mid-gesture. |
| `.statCardDropTarget` | 183-186 | `border: 2px solid var(--color-accent-gold); box-shadow: 0 0 0 2px var(--color-accent-gold-glow);` — gold ring on hover-drop-target | **Remove per D-03** (D-03 explicitly rejects "repurposing existing drag-state classes" — this gold token is NOT the blue eligible-target color needed). Replace with a new blue-ring class sourced from `HIGHLIGHT_STYLES`/`PieceOverlay` tokens. |
| `.statCardSubTarget` | 541-544 | Identical declarations to `.statCardDropTarget` (SUB-02 comment: "reuses .statCardDropTarget's treatment") | Same disposition — remove, replace with the same new blue-eligible-target class (this class already duplicates `.statCardDropTarget`'s body, so the replacement should be ONE shared eligible-target class used everywhere, not two near-duplicates as today) |
| `.statCardSubBlocked` | 547-550 | `opacity: 0.7; cursor: not-allowed;` | **Likely keep, rename cursor** (`not-allowed` reads oddly for a plain click no-op vs. D-04's "click = silent no-op" behavior — consider `cursor: default` to match D-04's "nothing visibly happens" framing, Claude's discretion) |
| `.statCard` (base, `cursor: grab`) | 156-164 | `cursor: grab; user-select: none;` | `cursor: grab` should become `cursor: pointer` (or default) since there is no drag gesture |
| `.statCardSentOff` | 643-649 | `border: 1px dashed var(--color-card-red)` | Keep — this is the placeholder styling, independent of drag/click mechanism. Needs a NEW eligible-target-highlight composability for positioning mode per D-05 (currently gets `.statCardDropTarget` appended conditionally at line 641-643 in the render function — same swap-to-blue-class treatment applies here) |

New class(es) needed: a green "selected" ring/border class (reusing `#22c55e`/`ACTIVE_RING_STROKE` family) and a blue "eligible target" ring/border class (reusing `#60a5fa` or another established blue token) — see D-03/Claude's Discretion above for exact token choice.

## Component Structure

### Recommended Project Structure

No new files are required — this is an in-place rewrite of 3 existing files:

```
packages/client/src/components/
├── LineupAssignmentScreen.tsx        # Rewrite: DragState/MidmatchDragState -> SelectionState;
│                                      # 4 separate handleCardClick + 4 separate eligibility functions
├── LineupAssignmentScreen.module.css # Remove statCardDragging/statCardDropTarget/statCardSubTarget;
│                                      # add shared .statCardSelected (green) / .statCardEligible (blue)
├── BenchCarousel.tsx                 # onCardDragStart -> onCardClick; onDropToBench -> onBenchAreaClick (or similar)
├── DraftPackCarousel.tsx             # onCardDragStart -> onCardClick
└── LineupAssignmentScreen.test.tsx   # Rewrite: fireEvent.dragStart/dragOver/drop -> fireEvent.click
```

### Pattern 1: Toggle-select-or-complete click handler (the core pattern to port)

**What:** A single `handleCardClick(id)` per surface/mode that branches exactly like `selectPiece` does: (a) same id clicked again → deselect, (b) an eligible target id clicked while something is selected → complete the action, (c) any other id clicked → select it (or no-op if ineligible, per D-04).

**When to use:** Every one of the 4 surfaces (mid-match positioning, mid-match substitution, Standard pregame, draft) needs its OWN copy of this shape — never a single shared handler parameterized by mode (Pitfall 1).

**Example (positioning mode, adapted from `selectPiece`'s shape):**
```typescript
// Source: pattern adapted from packages/client/src/store/useGameStore.ts selectPiece (~line 772)
// and packages/client/src/components/LineupAssignmentScreen.tsx handleMidmatchRepositionDrop (543-552)
function handleRepositionCardClick(pieceId: string) {
  if (readOnly === true || actionPending === true || pendingSub !== null) return;
  if (selectedRepositionId === pieceId) {
    setSelectedRepositionId(null); // ROSTER-03: click selected again -> deselect
    return;
  }
  if (selectedRepositionId !== null) {
    if (!isRepositionEligible(selectedRepositionId, pieceId)) return; // D-04: ineligible target = no-op
    onReposition?.(selectedRepositionId, pieceId); // ROSTER-04: eligible target click -> complete
    setSelectedRepositionId(null);
    return;
  }
  if (isRepositionSelectable(pieceId)) {
    setSelectedRepositionId(pieceId); // ROSTER-01/02: select + (eligible set derives from selectedRepositionId in render)
  }
}
```

**Example (substitution mode — bench-first + D-07 "switch selection" variant):**
```typescript
// D-06: on-pitch card clicked with nothing selected -> no-op (bench-first only)
// D-07: a DIFFERENT eligible bench card clicked while one is already selected -> switches selection (no deselect step)
function handleSubstituteBenchClick(playerId: string) {
  if (readOnly === true || pendingSub !== null) return;
  if (selectedBenchPlayerId === playerId) {
    setSelectedBenchPlayerId(null); // explicit deselect
    return;
  }
  // D-07: switching bench selection does NOT require deselecting first
  setSelectedBenchPlayerId(playerId);
}
function handleSubstitutePitchClick(pieceId: string) {
  if (selectedBenchPlayerId === null) return; // D-06: bench-first only, on-pitch click with nothing selected is a no-op
  if (!isSubstituteEligible(pieceId)) return; // D-04
  // ...stage pendingSub, unchanged from handleMidmatchSubstituteDrop's body...
}
```

### Pattern 2: Eligibility as a pure function, not inline in the click handler

**What:** Each of `isRepositionEligible`, `isSubstituteEligible`, `isPregameSwapEligible`, `isDraftEligible` should be extractable pure functions (piece/id in, boolean or the full eligible-set out) — enabling the unit test Pitfall 1 recommends ("select a piece in Reposition mode, toggle to Substitute mode, assert selection state is cleared and the stale selection cannot be used as a swap participant").

**When to use:** Every eligibility check currently embedded in `onDragOver`/`onDrop` conditionals (e.g. lines 744-751's `subMode === 'reposition'` branch inside `onDragOver`) should be hoisted into a named function invoked once at render time to derive the full "eligible target id set" for the current selection, then consulted by both (a) the render loop (to color cards blue) and (b) the click handler (to gate completion).

### Anti-Patterns to Avoid

- **One `computeEligible(mode, selection)` function branching internally on mode** — this is Pitfall 1's exact warning. Even though D-10 allows one shared `SelectionState` shape and one shared rendering path, the four eligibility *computations* must stay 4 separate functions.
- **Reusing `.statCardDropTarget`'s gold color for the new blue eligible-target ring** — D-03 explicitly rejects this; gold in this app's vocabulary means "confirmation/required-action" (`RING_STYLES`), not "eligible target."
- **Selection state surviving a mode toggle (Reposition ↔ Substitute)** — Pitfall 1 flags this exactly: today's drag state (`midmatchDrag`) is NOT cleared on entering Substitute mode from Reposition (only `pendingSub` is defensively cleared per the SUB-11/12 comment, line 1157-1164/1173-1178). The new selection-state equivalent must be explicitly cleared in BOTH the "Substitute" button's `onClick` and the "Cancel" button's `onClick` — do not assume the existing partial-clear behavior is sufficient for the new state variable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Selected/eligible color tokens | A new roster-local color palette (e.g. hardcoded hex literals in the new CSS classes) | `HIGHLIGHT_STYLES.safe` / `PieceOverlay`'s `ACTIVE_RING_STROKE` (`#22c55e`) / `selectable` blue (`#60a5fa`) — reference via a shared constant, not copy-pasted literals | D-03 explicit requirement; also `docs/HIGHLIGHT-REFERENCE.md`'s stated purpose ("single source of truth... do not add a new color literal without adding a corresponding row") |
| Toggle-select-or-complete click logic | A bespoke roster-specific state machine library or reducer | The `selectPiece`-shape pattern already proven in `useGameStore.ts` (plain `useState` + branch-on-click, no reducer/library) | This codebase already establishes "drag/scroll UI state is local — never in Zustand" (Pitfall 7) and a plain 3-branch click handler is the existing, working idiom — no new abstraction needed |
| GK-slot / role eligibility rules (positioning, draft) | Re-deriving GK/slot-0 lock logic from scratch for the click model | Existing conditions verbatim: `slotIndexNum !== 0 && piece.role !== 'GK'` (positioning, line 707-708), `rejectForGKRule(slotIndex, cardId)` (draft, line 890-902) | These are already-correct, already-tested guard expressions — only the trigger event (click vs. drag) changes, not the rule itself |

**Key insight:** This phase adds zero new domain logic — every eligibility rule, every server call, every rejection message already exists and is correct. The only genuinely new code is (a) the selection-state shape and its 3-branch click handler (ported from `selectPiece`'s proven shape) and (b) the 2 new CSS highlight classes (ported from existing color tokens). Treat any code that computes a NEW eligibility rule not already present in the drag implementation as scope creep.

## Runtime State Inventory

N/A — this is not a rename/refactor/migration phase in the STATE.md sense (no persisted data, no external service config, no OS-registered state, no secrets/env vars, no build artifacts carry the drag-and-drop concept). All affected state is React component-local (`useState`) and is discarded on unmount; the only "carry-over" risk is within-session (selection state surviving a mode toggle), covered under Anti-Patterns above, not a Runtime State Inventory category.

## Common Pitfalls

### Pitfall 1: Select-to-swap built as a third mode instead of replacing the two drag modes' shared risk surface
**What goes wrong:** A single unified `handleClick(pieceId)` that branches internally on `subMode` silently reintroduces the "Pitfall 5 HARD CONSTRAINT" shared-guard-body risk Phase 42 deliberately avoided for drag-and-drop.
**Why it happens:** Click-to-select naturally invites "one selection state, one handler" thinking because that's how the pitch's own selection model works (single `selectedPieceId`). But reposition and substitution have genuinely different eligibility rules baked into two different server messages.
**How to avoid:** Keep two (now four, per D-10/D-11/D-12's surface expansion) selection-state variables or one tagged union mirroring `MidmatchDragState`'s convention, and 4 separate eligible-target computations — never one `computeEligibleTargets(mode, selection)` that branches internally.
**Warning signs:** A single handler function taking a `mode`/`subMode` parameter with an internal `if/else` branch; a single `eligibleTargets` array/Set not recomputed distinctly per mode; a selection surviving the Reposition/Substitute toggle in manual testing.
*(Full detail: `.planning/research/PITFALLS.md` Pitfall 1 — this is THE pitfall for this phase; the other 4 pitfalls in that document belong to Phases 48-51.)*

### Pitfall 2: Losing the D-06/D-07/D-08 asymmetry between substitution and positioning selection-switching
**What goes wrong:** Implementing "click a different card while one is selected" identically in both modes — either always switching (breaking positioning mode's "explicit deselect required" rule, D-08) or never switching (breaking substitution mode's "switch bench selection without deselecting" convenience, D-07).
**Why it happens:** These two behaviors look similar at a glance ("clicking a different eligible-type card while one is selected") but are deliberately asymmetric per CONTEXT.md — D-08 explicitly calls out that this is "bench-substitution-specific, NOT symmetric with positioning mode."
**How to avoid:** Write the positioning-mode click handler and substitution-mode bench click handler as two independently-reasoned functions (naturally follows from Pitfall 1's guidance) rather than trying to parameterize one "select-or-switch" helper across both.
**Warning signs:** A shared `handleSourceCardClick(mode, id)` helper; a test that passes for one mode's switch-selection behavior but the equivalent test for the other mode was never written (D-07 needs a positive test, D-08 needs its negative counterpart).

### Pitfall 3: SENT OFF placeholder's mode-conditional eligibility (D-05) getting lost in the click-model port
**What goes wrong:** The current drag implementation's SENT OFF `onDragOver` handler (lines 648-659) has an inline conditional: highlight as drop target in reposition mode only if the frozen hex isn't already occupied by an own active piece (`sentOffSlotHexTaken`), and unconditionally NOT in substitute mode. If the port only handles the "normal" `LineupStatCard` eligibility path and forgets the separately-rendered SENT OFF placeholder branch (it's a `<div>`, not a `LineupStatCard`, rendered in a completely separate code path at lines 637-686), D-05 silently regresses.
**Why it happens:** The SENT OFF slot is NOT a `LineupStatCard` — it's a bespoke inline `<div>` with its own `onDragOver`/`onDrop` wiring, easy to overlook when the main port focuses on `LineupStatCard`'s props.
**How to avoid:** Explicitly enumerate "does the SENT OFF placeholder participate in the new eligible-target computation, positioning mode only" as its own task/test — do not assume porting `LineupStatCard` covers it.
**Warning signs:** A positioning-mode reposition onto an empty SENT OFF slot no longer highlights blue or no longer completes on click; a substitution-mode click on a SENT OFF slot incorrectly does something (it must remain excluded per D-05).

## Code Examples

### Existing drag→click 1:1 mapping for the Standard-pregame surface (ROSTER-07)
```typescript
// BEFORE (packages/client/src/components/LineupAssignmentScreen.tsx, lines 818-826)
function handleDrop(e: React.DragEvent<HTMLDivElement>, targetIdx: number) {
  e.preventDefault();
  const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (targetIdx !== 0 && sourceIdx !== targetIdx) {
    onSwap(sourceIdx, targetIdx);
  }
  setDragSourceIndex(null);
  setDropTargetIndex(null);
}

// AFTER (pattern) — targetIdx === 0 (GK slot) exclusion carries over unchanged (D-09-equivalent for pregame)
function handlePregameCardClick(idx: number) {
  if (lineupConfirmed) return;
  if (selectedSlotIndex === idx) {
    setSelectedSlotIndex(null);
    return;
  }
  if (selectedSlotIndex !== null) {
    if (idx === 0 || selectedSlotIndex === idx) return; // D-04-equivalent no-op; GK slot never a target
    onSwap(selectedSlotIndex, idx);
    setSelectedSlotIndex(null);
    return;
  }
  if (idx !== 0) setSelectedSlotIndex(idx); // GK slot (idx 0) never selectable, mirrors D-09
}
```

### Draft-mode pack-card selection mirroring bench-first substitution (D-11, ROSTER-08)
```typescript
// BEFORE (packages/client/src/components/LineupAssignmentScreen.tsx, DraftPackCarousel usage line 1291)
onCardDragStart={(cardId) => setDragState({ cardId, source: 'pack' })}

// AFTER (pattern) — pack selection state mirrors mid-match bench selection (D-11 "mirrors bench-first pattern")
onCardClick={(cardId) => {
  if (selectedDraftSource?.source === 'pack' && selectedDraftSource.cardId === cardId) {
    setSelectedDraftSource(null); // deselect
    return;
  }
  setSelectedDraftSource({ cardId, source: 'pack' }); // select; eligible slots/bench derive from this in render
}}
```

## State of the Art

Not applicable — this phase ports an existing, current-generation in-house pattern (click-to-select, already implemented on the pitch in this same codebase during earlier phases) to a new surface. There is no external library/ecosystem "state of the art" question here; the authoritative reference is this repo's own `HexGrid.tsx`/`HexCell.tsx`/`PieceOverlay.tsx`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The blue eligible-target token should be `PieceOverlay`'s `selectable` blue (`#60a5fa`) rather than `HIGHLIGHT_STYLES.kickoff`'s saturated blue (`rgba(59,130,246,1)`) or `gk-kick-target`'s sky blue | Reference Pattern — Highlight rendering | Low — D-03 only mandates reusing an existing pitch token, not which specific blue; either choice satisfies the decision. Flagged as [ASSUMED] because CONTEXT.md does not pin the exact swatch and this is a judgment call the planner/executor should confirm during implementation (Claude's Discretion explicitly covers "exact CSS class naming/structure") |
| A2 | `docs/HIGHLIGHT-REFERENCE.md` should get a new "Card Selection" section documenting the reused tokens | Reference Pattern — Verification note | Low — cosmetic documentation completeness only; the doc's existing scope is nominally pitch-only (`HexCell`/`PieceOverlay`/`BallLocationRing`), so adding cards is a natural but not explicitly mandated extension |
| A3 | `.statCardSubBlocked`'s cursor should change from `not-allowed` to `default` to match D-04's "silent no-op" framing | CSS classes to remove/replace table | Very low — purely cosmetic; either cursor value is defensible, D-04 doesn't specify cursor styling |

**Overall:** All CORE behavioral claims (selection toggle shape, eligibility separation, D-03 token reuse requirement, D-04 through D-12 behaviors) are `[VERIFIED: codebase]` — directly read from `useGameStore.ts`, `HexGrid.tsx`, `HexCell.tsx`, `PieceOverlay.tsx`, `LineupAssignmentScreen.tsx`, and CONTEXT.md itself. Only cosmetic/discretionary choices (exact blue swatch, doc-update scope, cursor value) are `[ASSUMED]` — all three are already flagged as Claude's Discretion in CONTEXT.md, so no user confirmation is blocking.

## Open Questions

1. **Should `LineupStatCard`'s click target be the whole card `<div>` (matching the current whole-card `draggable`), or should keyboard/ARIA affordances (Claude's Discretion: "keyboard/accessibility affordances beyond click... use judgment, consistent with how the existing pitch selection handles it") require a `<button>`-semantics wrapper?**
   - What we know: The pitch's `HexCell`/piece click targets are raw SVG `<polygon>`/`<circle>` elements with `onClick` and `cursor: pointer` styling — no `role="button"`/keyboard handling is implemented there today (confirmed by reading `HexCell.tsx`/`PieceOverlay.tsx` in full — no `onKeyDown`, no `tabIndex`, no `role` attribute on the clickable polygons).
   - What's unclear: Whether "consistent with how the existing pitch selection handles it" means "match the pitch's current lack of keyboard support" or "the roster cards, being ordinary DOM `<div>`s rather than SVG, should get baseline `<div role="button" tabIndex={0} onKeyDown={...}>` treatment since that's cheap and DOM (not SVG) supports it naturally."
   - Recommendation: Default to matching the pitch's current behavior (click-only, no new keyboard affordance) unless the planner's own judgment (explicitly delegated by CONTEXT.md) decides the DOM context makes minimal `role="button"` + Enter/Space handling cheap enough to add — this is Claude's Discretion per CONTEXT.md, not a blocking question.

2. **Exact new CSS class name(s) for the selected/eligible-target rings.**
   - What we know: D-03 requires reuse of `HIGHLIGHT_STYLES`/`RING_STYLES` token VALUES, not class NAMES — CSS Modules in this codebase (`.module.css`) means class names are already scoped/hashed, so there's no naming collision risk with `HexCell.tsx`'s inline-styled SVG elements (which don't use CSS Modules at all — they use inline `style`/`fill`/`stroke` props directly).
   - What's unclear: Whether the new roster CSS classes should hold the color values as literal duplicated hex/rgba strings (matching the existing `.statCardDropTarget`-style declarations, e.g. `border: 2px solid #22c55e;`) or whether a shared TS constant (mirroring `HIGHLIGHT_STYLES`) should be introduced and consumed via inline `style` props on `LineupStatCard` instead of a CSS Module class, to more literally "reuse" `HexCell.tsx`'s existing `HIGHLIGHT_STYLES`/`RING_STYLES` objects (e.g. `import { RING_STYLES } from './HexCell.js'`).
   - Recommendation: Either approach satisfies D-03's stated intent ("reuse... tokens," not "reuse... the exact TypeScript objects"); CSS Module classes with literal color values matching the pitch tokens is simpler and consistent with `LineupAssignmentScreen.module.css`'s existing all-CSS-classes convention (no components in this file currently consume `HIGHLIGHT_STYLES` directly) — recommend this simpler path unless the planner has a specific reason to cross-import from `HexCell.tsx`.

## Environment Availability

Skipped — this phase has no new external dependencies (no new npm packages, no new services, no new CLI tools). All tooling (`vitest`, `knip`, TypeScript, React 18/Vite 5) is already installed and verified working in this repo (confirmed: `pnpm knip` runs clean with zero output at time of research; `vitest run` is the existing test command in `packages/client/package.json`).

## Validation Architecture

`config.json`'s `workflow.nyquist_validation` is `true` — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9 + React Testing Library (existing, confirmed via `packages/client/package.json` and existing `*.test.tsx` files using `fireEvent`, `render`, `screen`) |
| Config file | `packages/client/vitest.config.ts` (assumed standard location — not read this session; existing `*.test.tsx` files run via `pnpm --filter @counter-attack/client test` / root `pnpm test`) |
| Quick run command | `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen` (or `vitest run LineupAssignmentScreen` from `packages/client`) |
| Full suite command | `pnpm test` (root, runs `pnpm -r test` across all workspaces) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROSTER-01 | Click a mid-match on-pitch card → green/selected visual state | unit (component) | `vitest run LineupAssignmentScreen -t "selects"` | ✅ existing file, rewrite needed (currently asserts drag state, e.g. line 1128-1141's "dragging an on-field card...") |
| ROSTER-02 | Selecting highlights eligible targets blue | unit (component) | same file, new assertions on the new eligible-target class/prop | ✅ existing file, rewrite needed |
| ROSTER-03 | Click selected card again → deselect | unit (component) | same file | ✅ existing file — no direct drag equivalent exists today (drag has no "deselect" gesture); this is a genuinely NEW test to add |
| ROSTER-04 | Click eligible target → completes swap/substitute (unchanged confirm flow for substitution) | unit (component) | same file, replaces "dropping ... calls onReposition/onSubstitute" tests (e.g. lines 1128, 839) with "clicking ... calls onReposition/onSubstitute" | ✅ existing file, rewrite needed (assertion targets — `onReposition`/`onSubstitute`/`onSwap`/`onDraftPick`/`onDraftRearrange` — are unchanged; only the trigger event in the test body changes from `fireEvent.dragStart`+`fireEvent.drop` to `fireEvent.click`×2) |
| ROSTER-05 | Reposition/substitution eligibility stay separate functions | unit (pure function, if extracted) + component (mode-crossing regression) | New test: "select a piece in Reposition mode, toggle to Substitute mode, assert selection cleared and stale selection unusable" (per Pitfall 1's own recommended test) | ❌ Wave 0 — new test, not present in current drag-based suite (current suite has no equivalent because drag state incidentally clears differently) |
| ROSTER-06 | Zero drag-and-drop code remains, clean `knip` | static analysis | `pnpm knip` (exit 0, no output) | ✅ tool already configured (`knip.json`), currently passes clean — must remain clean after the rewrite |
| ROSTER-07 | Standard pregame swap via click-select | unit (component) | same file — currently untested for drag-swap explicitly in isolation from the DRAFT-06 suite (search shows Standard-mode non-regression tests at line 374 focus on rendering, not the swap gesture itself) — **new/expanded test needed** | ❌ Wave 0 gap — add explicit pregame click-swap test |
| ROSTER-08 | Draft pack/bench/slot click-select | unit (component) | same file, rewrites the ~10 draft drag tests (lines 100-337) to click equivalents | ✅ existing file, rewrite needed |

### Sampling Rate
- **Per task commit:** `vitest run LineupAssignmentScreen` (targeted — this is the only file with meaningful new logic; `BenchCarousel.test.tsx`/`DraftPackCarousel.test.tsx` also need targeted reruns for their own drag→click prop renames)
- **Per wave merge:** `pnpm --filter @counter-attack/client test` (full client suite — guards against collateral breakage in `GameBoard.test.tsx`, which renders `LineupAssignmentScreen` in mid-match mode)
- **Phase gate:** Full suite green (`pnpm test` at repo root) + `pnpm knip` clean, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `LineupAssignmentScreen.test.tsx` — full rewrite of drag-simulation helpers (`fireEvent.dragStart`/`dragOver`/`drop`/`dragEnd`) to `fireEvent.click` sequences; this is the single largest test-authoring task in the phase (existing file is 1577 lines / ~90 test cases across draft, Standard-mode, mid-match-substitution, and mid-match-positioning describe blocks)
- [ ] `BenchCarousel.test.tsx` (451 lines) — rewrite for the renamed `onCardDragStart`→click-equivalent prop
- [ ] `DraftPackCarousel.test.tsx` (149 lines) — rewrite for the renamed `onCardDragStart`→click-equivalent prop
- [ ] New test: mode-crossing selection-clearing regression (Pitfall 1's explicitly recommended test — does not exist in any form today)
- [ ] New/expanded test: Standard-pregame click-swap explicit coverage (ROSTER-07 — today's Standard-mode tests focus on rendering/Confirm-button behavior, not the swap gesture in isolation)
- No new test framework installation needed — Vitest + RTL are already fully configured and in active use across all 3 affected files' existing `.test.tsx` siblings.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` — treated as enabled per protocol, but this phase's actual security surface is minimal (pure client-UI interaction-model swap, no new endpoints, no new data flows, no auth/session/crypto changes).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unaffected — no auth surface touched |
| V3 Session Management | No | Unaffected |
| V4 Access Control | No | Server-side handlers (`GAME_ROSTER_REPOSITION`, `GAME_SUBSTITUTION`, `LINEUP_SWAP`, `LINEUP_CONFIRM`, `DRAFT_PICK`, `DRAFT_REARRANGE`) remain the sole authority and are explicitly unchanged this phase (CONTEXT.md Integration Points) |
| V5 Input Validation | Yes (mirrors existing pattern, not new) | Client-computed eligible-target sets are UX-only; server-side guards (`applyRosterReposition`, `applySubstitution`) remain authoritative — this is the existing established pattern in this codebase, not a new control to design |
| V6 Cryptography | No | Unaffected |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client trusts its own eligible-target computation as authoritative, sends a crafted illegal swap/substitute payload | Tampering | Already mitigated — server-side guards are the sole source of truth today and are untouched by this phase (`research/PITFALLS.md` "Security Mistakes" table row, directly applicable: "add/extend server-side tests for the same eligibility rules independently of the client rewrite" — recommended as a defense-in-depth check, not a new requirement, since server logic itself does not change) |

No new threat surface is introduced by swapping the client gesture from drag to click — both gestures ultimately call the same, already-guarded server emit functions.

## Sources

### Primary (HIGH confidence — direct codebase inspection this session)
- `packages/client/src/components/LineupAssignmentScreen.tsx` (full file, 1424 lines) — current drag-and-drop implementation, all types/handlers/props
- `packages/client/src/components/BenchCarousel.tsx` (full file, 212 lines) — collaborator drag props
- `packages/client/src/components/DraftPackCarousel.tsx` (full file, 283 lines) — collaborator drag props + shared `DraftCardBody`
- `packages/client/src/components/HexCell.tsx` (full file, 190 lines) — `HIGHLIGHT_STYLES`/`RING_STYLES` reference tokens
- `packages/client/src/components/PieceOverlay.tsx` (grep + targeted reads) — `SelectionState` type, `ACTIVE_RING_STROKE`, ring rendering
- `packages/client/src/store/useGameStore.ts` (grep, `selectPiece` action ~line 772) — reference selection-toggle pattern
- `packages/client/src/components/HexGrid.tsx` (grep) — click-wiring reference pattern
- `docs/HIGHLIGHT-REFERENCE.md` (full file, 289 lines) — canonical color/token documentation, D-03's explicit reference
- `packages/client/src/components/LineupAssignmentScreen.module.css` (targeted reads, lines 140-260, 520-660) — CSS classes to remove/replace
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` (structure scan, 1577 lines, ~90 test cases) — existing coverage inventory
- `packages/client/src/components/GameBoard.tsx` (targeted reads/grep) — `onReposition`/`onSubstitute`/`actionPending` wiring
- `packages/client/src/App.tsx` (grep) — `onSwap`/`onConfirm`/`onDraftPick`/`onDraftRearrange` wiring
- `.planning/research/PITFALLS.md` (full file) — Pitfall 1 (directly applicable), Pitfalls 2-5 (other v1.8 phases, not this one)
- `knip.json` + `pnpm knip` (executed this session, clean run confirmed) — knip invocation/config
- `.planning/phases/47-select-based-roster-interaction/47-CONTEXT.md` — all locked decisions (D-01 through D-12)
- `.planning/REQUIREMENTS.md` — ROSTER-01..08 verbatim
- `.planning/STATE.md` — project decisions, pitfalls, phase status

### Secondary (MEDIUM confidence)
None — no external web/docs sources were needed for this phase; it is a pure in-repo pattern-porting exercise with no new libraries or external APIs.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Reference pattern (pitch click-to-select): HIGH — read directly from working source, 3 independent files cross-confirm the same shape
- Before-state inventory (drag-and-drop code to remove): HIGH — full-file read of the 1424-line target file plus both collaborators
- Pitfalls: HIGH — sourced from this milestone's own pre-existing dedicated research document, cross-confirmed against the actual current code structure (Pitfall 5 HARD CONSTRAINT comment verified present in source at line 538-542)
- Validation architecture: MEDIUM — test framework/commands inferred from `package.json` scripts and existing `.test.tsx` file conventions; `vitest.config.ts` itself was not read this session

**Research date:** 2026-08-30
**Valid until:** No external dependency — valid until the underlying source files change (i.e., effectively until this phase begins execution; re-verify line numbers if execution is delayed and other phases touch this file first, though CONTEXT.md notes Phase 47 is sequenced first specifically to avoid merge contention).
