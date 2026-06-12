# Phase 12: Visual Token & Hex Layer - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 redesigns team token visuals and unifies the hex highlight/outline system. All changes are client-side SVG/CSS only — no server changes required.

**In scope:**

- Add stripe patterns to team tokens: home = single vertical black stripe on blue; away = two horizontal dark stripes on red
- Stripe pattern rendered consistently in: on-pitch PieceOverlay, PlayerStatsPanel header mini-token, and post-game replay (which reuses PieceOverlay on the GAME_BOARD layout)
- Replace the current 3-boolean PieceOverlay selection props with a single `selectionState` enum covering UX-05's 3 outline states
- Consolidate all HexCell tint overlays into a typed `highlightType` prop with priority-ordered rendering
- Standardize hex tint colors per UX-06: risk=transparent orange, goal=transparent red, safe=transparent yellow, kickoff=transparent blue, shot-path=transparent white

**Out of scope:**

- Server changes
- Layout restructure (Phase 13)
- Kick-off rule enforcement (Phase 14)
- Replay speed / simultaneous animation (Phase 14)

</domain>

<decisions>
## Implementation Decisions

### Stripe Rendering

- **D-01:** Use SVG `<defs><pattern>` to define stripe patterns. Patterns are defined once inside HexGrid's `<svg>` root `<defs>` block and referenced as `fill="url(#home-stripe)"` on the piece circle. All PieceOverlay children of that SVG root can reference the patterns without duplication.
- **D-02:** `<defs>` lives directly inside HexGrid's existing single `<svg>` root — no separate `TokenPatterns` component. HexGrid already owns the SVG root; this is a minimal addition.
- **D-03:** Away stripe proportions — Claude's discretion. Two dark (maroon/dark-red) horizontal bands, evenly spaced, sized to be visible at PIECE_RADIUS=12 (24px diameter) without dominating the token. Match the physical board aesthetic.

### PieceOverlay Selection API

- **D-04:** Replace `isSelected: boolean`, `isClickable: boolean`, and `isSpent: boolean` with a single `selectionState: 'none' | 'selectable' | 'active' | 'activated'` prop.
  - `'none'` — no ring, default cursor
  - `'selectable'` — bright blue outline ring, pointer cursor
  - `'active'` — green outline ring, pointer cursor (currently active/selected piece)
  - `'activated'` — orange outline ring + red X overlay, default cursor (already used this turn)
- **D-05:** The `'activated'` state combines the orange ring AND the red X in one visual. `isSpent` prop is removed; the red X and orange ring render together when `selectionState === 'activated'`.
- **D-06:** `cursor: pointer` is derived from `selectionState !== 'none'`. The `isClickable` prop is removed.
- **D-07:** `isHeaderContestant` prop (D-17 from Phase 8.2) is removed. Header contestants are expressed via `selectionState: 'active'` — the green ring serves both purposes. HexGrid maps header contestant pieces to `selectionState: 'active'` during HEADER phase.

### Token in Stats Panel

- **D-08:** PlayerStatsPanel adds a mini token circle (~18px diameter SVG) to the panel header alongside the player name. This satisfies VIS-02's "consistent in all contexts" requirement.
- **D-09:** The mini token is a standalone inline `<svg>` element within PlayerStatsPanel, with its own self-contained `<defs>` block defining the stripe patterns for that SVG. No dependency on HexGrid being mounted; no global SVG portal infrastructure needed.

### Hex Highlight Architecture

- **D-10:** HexCell is refactored to accept `highlightType?: HexHighlightType` where `HexHighlightType = 'safe' | 'risk' | 'goal' | 'kickoff' | 'shot-path'`. HexCell owns the color lookup internally (one place to change colors). The existing `highlightColor?: string` prop is replaced.
- **D-11:** All current separate inline polygon overlay layers in HexGrid (zoiRiskSet, tackleRiskSet, kickoff zone, SNAP_DEFLECT danger path, shot path, GK kick target, quick throw, high pass movement, safe pass target, header target) are consolidated. HexGrid computes a single `highlightType` per hex from these sets and passes it to HexCell.
- **D-12:** Priority order for overlapping states: `risk` > `goal` > `shot-path` > `kickoff` > `safe`. HexGrid derives the highest-priority applicable type and passes one value.
- **D-13:** HIGH_PASS header range highlight: valid target hexes for the HIGH_PASS kick use `shot-path` (transparent white) tint. This tint persists from when the kick target hex is being selected through the contestant selection phase. It clears after the header duel resolves (i.e., not shown during the final landing target selection step). The current cyan tint for header targets is replaced by this white tint.

### Claude's Discretion

- Away stripe proportions (D-03): exact band height and spacing at PIECE_RADIUS=12 — choose values that read well visually and match the physical board's horizontal-stripe aesthetic
- Exact hex color values for the 5 tint types — match UX-06 intent (transparent variants, visible against #3d6b34/#4a7c3f grass): orange ≈ `rgba(255,165,0,0.4)`, red ≈ `rgba(220,50,50,0.5)`, yellow ≈ `rgba(245,197,24,0.5)`, blue ≈ `rgba(59,130,246,0.4)`, white ≈ `rgba(255,255,255,0.35)`
- Exact ring radii and stroke widths for the 3 UX-05 states (selectable/active/activated) — ensure they are visually distinct at PIECE_RADIUS=12 without clashing with adjacent tokens

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — VIS-01, VIS-02, UX-05, UX-06 full definitions (this is the authoritative spec for what each state must look/behave like)

### Token & Piece Rendering

- `packages/client/src/components/PieceOverlay.tsx` — current token rendering; fields to replace: `isSelected`, `isClickable`, `isSpent`, `isHeaderContestant`; new: `selectionState` enum; stripe patterns referenced via `fill="url(#home-stripe)"` / `fill="url(#away-stripe)"`
- `packages/client/src/components/HexGrid.tsx` — owns the `<svg>` root where `<defs>` patterns are added; computes piece selection state for all pieces; contains all current polygon overlay logic to consolidate

### Hex Cell Rendering

- `packages/client/src/components/HexCell.tsx` — current hex polygon; `highlightColor?: string` replaced by `highlightType?: HexHighlightType`; color lookup moves inside HexCell

### Stats Panel

- `packages/client/src/components/PlayerStatsPanel.tsx` — add mini inline SVG token with embedded `<defs>` to panel header
- `packages/client/src/components/PlayerStatsPanel.module.css` — dark theme (#16213e); mini token SVG should fit the existing header layout

### Shared Types

- `packages/shared/src/types.ts` — `PlayerPiece` type (piece.teamId drives home/away stripe selection); `GameState` fields that drive highlight state: `validMoveHexes`, `lastShotPath`, `snapDeflectPaceUsed`, `headerConfirmed`, `headerContestants`, `headerDuelWinner`

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `axialToPixel(q, r)` in `packages/client/src/utils/hexToPixel.ts` — used by PieceOverlay to place tokens; unchanged
- `hexPolygonPoints(cx, cy)` — used by HexCell; unchanged
- Existing `isHeaderContestant` green ring pattern in PieceOverlay — the ring-at-radius approach is reused for all 3 UX-05 outline states (just different colors/radii)
- `getZoIDefenders` from shared — used in HexGrid for risk set computation; unchanged
- `isDifficultAngle` in HexCell — the difficult-angle white dot (30% opacity) is orthogonal to tints and stays as-is

### Established Patterns

- Single SVG root for all overlays in HexGrid — `<defs>` block slots naturally at the top of this SVG
- Zustand per-slice selectors in HexGrid — piece selection state computation reads from store slices; no change to store structure needed
- `paceUsedByPieceId` in game state drives the `'activated'` state for pieces that have moved this turn
- `selectedPieceId` from Zustand drives the `'active'` state for the currently selected piece
- `canSelect` / `canSelectKickOff` / etc. boolean logic in HexGrid drives the `'selectable'` state — refactored to produce `selectionState` enum instead of separate booleans
- ODD-Q 3-colour formula in HexCell for grass fill is orthogonal to highlight changes — do not modify

### Integration Points

- HexGrid → PieceOverlay: `selectionState` enum replaces 4 separate boolean props; HexGrid computes the enum per piece
- HexGrid → HexCell: `highlightType` enum replaces `isHighlighted` + `highlightColor`; HexGrid derives the type from all its current set-membership checks
- PlayerStatsPanel: new inline SVG token badge in `<div className={styles.header}>` — no Zustand changes needed; `piece.teamId` already available
- Stripe pattern IDs: `#home-stripe` and `#away-stripe` — must be unique within the SVG document (scoped to HexGrid's svg root, and separately self-contained in PlayerStatsPanel's inline svg)

</code_context>

<specifics>
## Specific Ideas

- User confirmed: HIGH_PASS header target hexes should use shot-path (transparent white) tint from kick target selection through contestant selection; clears after the header duel resolves
- User confirmed: `isSpent` visual (red X) is combined with the orange `'activated'` ring — they are one state, not separate
- User confirmed: `isHeaderContestant` prop removed entirely; header contestant pieces expressed as `selectionState: 'active'`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 12-visual-token-hex-layer_
_Context gathered: 2026-06-11_
