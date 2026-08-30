# Stack Research

**Domain:** Click-to-select swap/substitution UI + permanent jersey-number identity, added to a mature React 18 + Zustand + TypeScript + CSS Modules app
**Researched:** 2026-08-30
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

**No new core technologies are needed.** Both new capabilities in v1.8 (RES-01/02-style select-based roster interaction, permanent jersey numbers) are UI-interaction and data-modeling changes that fit entirely inside the existing stack:

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React 18 | ^18.3.1 (already installed) | Component state (`useState`) for local, ephemeral selection state | Already the project's UI layer; local component state is the established pattern for interaction-only state (drag state in `LineupAssignmentScreen.tsx` is never in Zustand — see Pitfall 7 comment at line ~382) |
| Zustand | ^4.5.7 (already installed) | Cross-component selection/eligibility state when it must be read by sibling components (mirrors `selectedPieceId`/`validMoveHexes` on `useGameStore`) | The exact click-to-select interaction this milestone asks for (click = select, eligible targets highlighted, click again = deselect) is **already implemented** for pitch pieces via `useGameStore.selectedPieceId` + phase-specific `validMoveHexes`/`tackleRiskHexes` arrays (`packages/client/src/store/useGameStore.ts:54,773-958`). This is the pattern to replicate for roster cards, not a new one to invent. |
| CSS Modules | (already installed, no package — Vite built-in) | Selected/eligible/deselected outline styling | `LineupAssignmentScreen.module.css` and `HexCell.tsx`'s `HIGHLIGHT_STYLES`/`RING_STYLES` table are the project's existing single-source-of-truth pattern for state→color mapping. The new green/blue outline states extend that same table-driven approach — do not hand-roll a second styling mechanism. |

### Supporting Libraries

**None required.** No new npm package is needed for either capability. Specifically ruled out:

| Library considered | Why it was considered | Why rejected |
|---------------------|------------------------------|---------------|
| A drag-and-drop replacement library (e.g. `@dnd-kit/core`) | The milestone explicitly *removes* drag-and-drop in favor of click-to-select | Wrong direction entirely — this milestone deletes the need for DnD libraries in the roster screen, it doesn't add one. `LineupAssignmentScreen.tsx`'s native HTML5 `draggable`/`onDragStart`/`onDrop` wiring for the two existing modes (`reposition`, `substitute`) becomes dead code to remove, not a place to add more drag tooling. |
| A finite-state-machine library (e.g. XState) | Selection has a few explicit states (none → selected → eligible-target-highlighted → confirm/deselect) | The project already solved an equivalent problem with a plain string-literal union type (`SelectionState = 'none' \| 'selectable' \| 'active' \| 'activated'` in `PieceOverlay.tsx:30`) driving a single ternary for ring color. A 3-state enum (`'none' \| 'selected' \| 'eligible'`) plus one `selectedRosterId: string \| null` field is proportionate; XState would be a new paradigm and a new dependency for a problem this codebase already has an established, lighter-weight answer to. |
| A UUID/nanoid library for jersey-number or identity generation | Permanent jersey numbers need a stable per-player identity at assignment time | Not needed — jersey numbers are small integers (1-99, most commonly 1-11 for a fixed XI) assigned once via the existing deterministic/`Math.random`-based assignment logic already used for auto-numbering in draft mode (see `Key Decisions`: "post-draft lineup hand-off with auto-numbering"). No collision-resistant unique-ID generation is involved — this is small-integer allocation with a straightforward uniqueness-within-squad check, which is a few lines of plain TypeScript, not a library concern. |
| A headless UI / accessibility primitives library (e.g. Radix UI, React Aria) for the select/highlight interaction | Click-to-select with visual state and keyboard/ARIA affordances is sometimes delegated to headless UI libraries | Out of proportion to the change. The interaction is a click handler on an existing `<div>` card (already true today for drag), not a new composite widget (combobox, listbox, dialog) that benefits from a headless primitive's accessibility plumbing. Introducing Radix/React Aria here would add a dependency and a new interaction paradigm to a component that otherwise still uses raw DOM event handlers everywhere else in the file. |

### Development Tools

No changes. Existing tooling (`eslint` 9.39.4, `eslint-plugin-react-hooks` ^7.1.1, `knip` 6.29.0, `vitest` ^2.1.9, `@testing-library/react` ^14.3.1, `@testing-library/user-event` ^14.6.1) fully covers testing and linting a click-handler-based interaction. `@testing-library/user-event`'s `click()` API is actually a *better* fit for testing this new interaction than the current drag-event-simulation tests in `LineupAssignmentScreen.test.tsx`, which have to synthesize `dataTransfer` objects — click-to-select tests will be simpler to write, not harder.

## Installation

```bash
# No installation needed — this milestone adds zero new dependencies.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Plain `useState`/Zustand selection state + CSS Modules outline classes | A dedicated selection-management library (e.g. a custom hook library, or state-machine library) | If the roster screen's selection logic grows materially more complex than "one selected id + a derived eligible-target set" (e.g. multi-select, drag-select-plus-click hybrid, undo/redo of selections) — none of which is in scope for v1.8. Revisit only if a future milestone adds that complexity. |
| Extending `HIGHLIGHT_STYLES`-style pattern for green/blue roster outlines | A CSS-in-JS solution (styled-components, Emotion) | Never for this project — CSS Modules is an established, working convention across 40+ phases; introducing a second styling system for one screen would be pure inconsistency with no functional benefit. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Keeping the native HTML5 drag-and-drop (`draggable`, `onDragStart`/`onDragOver`/`onDrop`) wiring alongside the new click-to-select handlers | The milestone explicitly *replaces* drag-and-drop, not layers a second interaction mode on top of it — keeping both would double the interaction-state surface (`dragSourceIndex`/`dropTargetIndex`/`DragState`/`MidmatchDragState` unions all become dead once click-to-select lands) and risk state desync between two parallel selection mechanisms | Delete the drag handlers and their backing state (`dragSourceIndex`, `dropTargetIndex`, `dragState`, `midmatchDrag`, `midmatchDropTargetPieceId`, the `DragState`/`MidmatchDragState` types) once the click-based flow is verified; `knip` (already CI-enforced) will catch anything left unused |
| A new global "UI interaction" Zustand slice/store separate from `useGameStore` | The project's established pattern is one store (`useGameStore`) holding both server-synced game state and client-only interaction state (`selectedPieceId`, `validMoveHexes` are already client-only fields living in the same store) | Add `selectedRosterId`/`eligibleSwapTargetIds`-equivalent fields to the existing `useGameStore`, mirroring `selectedPieceId`/`validMoveHexes` exactly — or keep it as local `useState` in `LineupAssignmentScreen.tsx` if no sibling component needs to read it (matches the existing drag-state precedent of "local unless something else needs it") |
| Deriving jersey numbers from `FormationSlot.jerseyNumber` (today's model) for *any* post-kickoff read | `FormationSlot.jerseyNumber` is fundamentally position-keyed (see `formations.ts`: GK is always slot 0 → number 1, etc.) — it changes meaning the instant a player occupies a different slot, which is the exact bug this milestone fixes | Assign jersey numbers once per player at squad-build time (the same moment `buildSquadPieces`/draft-mode auto-numbering already runs) and store them on the persistent per-player identity (the `PlayerPiece`/bench entry), never re-derive from the slot the player currently occupies. This is a data-flow change (move number assignment from slot-render-time to squad-build-time and stop re-deriving it), not a new library concern. |

## Stack Patterns by Variant

**If the click-to-select state must be visible to `GameBoard.tsx` or another sibling component (e.g. to dim the pitch while roster selection is active):**
- Add the selection fields to `useGameStore` (mirrors `selectedPieceId`)
- Because cross-component visibility is exactly what Zustand is already used for in this app; local `useState` can't be read outside `LineupAssignmentScreen.tsx`

**If the click-to-select state is fully contained within `LineupAssignmentScreen.tsx` (most likely, since the existing drag state already was):**
- Keep it as local `useState` (a `selectedIndex`/`selectedPieceId` equivalent, `string | number | null`)
- Because the existing drag-state precedent in this exact file (`dragSourceIndex`, `dropTargetIndex`, `dragState`, `midmatchDrag`) is already scoped locally and documented as deliberately not living in Zustand — follow the same call

**If jersey-number permanence needs to survive a mid-match substitution (it does — that's the whole point of PERM-jersey requirement):**
- Store the number on the same persistent identity substitution already inherits (`PlayerPiece.number`, `BenchEntry.jerseyNumber`) — SUB-03 ("substitute inherits the departing player's number") already established the number lives on player-identity, not slot-identity, for substitution purposes; this milestone just needs to apply that same rule at initial assignment time instead of only at sub time

## Version Compatibility

Not applicable — no new packages, so no new version-compatibility surface. All work happens inside the already-pinned versions in `packages/client/package.json` (React 18.3.1, Zustand 4.5.7, TypeScript 5.9.3 at the workspace root) and `packages/shared` (pure TypeScript, no runtime deps relevant here).

## Sources

- Primary source: direct inspection of the existing codebase (`packages/client/src/components/LineupAssignmentScreen.tsx`, `packages/client/src/store/useGameStore.ts`, `packages/client/src/components/PieceOverlay.tsx`, `packages/shared/src/formations.ts`, `packages/client/package.json`, `package.json`) — HIGH confidence, this is the authoritative record of what patterns already exist and work in this exact app.
- `.planning/PROJECT.md` — v1.7/v1.6 Key Decisions table (`SelectionState enum over boolean bag`, `HIGHLIGHT_STYLES`/`RING_STYLES` single source of truth, substitution number-inheritance decision) — HIGH confidence, project's own validated architectural record.
- No external/web/Context7 lookups were performed because no new library is proposed; the quality gate's "verify with Context7 if any library is proposed" is satisfied vacuously — there is nothing to verify.

---
*Stack research for: click-to-select roster UI + permanent jersey-number identity (v1.8 milestone)*
*Researched: 2026-08-30*
