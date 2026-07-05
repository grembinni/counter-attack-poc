# Phase 22: Uniform Selection Screen - Context

**Gathered:** 2026-07-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Combined team + style pre-game selection screen. This phase delivers:

1. **A new combined selection screen** — replaces the existing `TeamSelectionScreen`; team grid + style grid on one screen; one Confirm button locks in both choices simultaneously
2. **`GameState.selectedUniformStyles`** — new `{ home: UniformStyleId; away: UniformStyleId }` field added to `GameState`; populated at build time alongside `selectedTeams`
3. **Deferred `buildInitialGameState` call** — game state is built only after both players confirm team + style (not on the second `TEAM_PICK` as currently); server holds uniform picks in room state
4. **Two new socket events** — `UNIFORM_CONFIRM` (client→server) and `UNIFORM_HOME_CONFIRMED` (server→client broadcast)
5. **HexGrid updated** — resolves uniform style from `gameState.selectedUniformStyles` instead of `TEAM_CONFIGS[teamId].defaultUniformStyle`

Phase 23 (Formation System) depends on this phase. No game logic changes, no new game phases in `GameState.phase`.

</domain>

<decisions>
## Implementation Decisions

### Screen Architecture

- **D-01:** The existing `TeamSelectionScreen` is replaced by a new combined selection screen. Both team selection and style selection happen on this one screen, confirmed together with a single Confirm button.
- **D-02:** Team grid: flat layout, all 12 teams, **no tabs** — Phase 21's MLS/International tabs are removed in this screen. Layout: 2 rows × 6 columns (or 3×4 if vertical space requires it — Claude decides based on screen fit).
- **D-03:** Style grid: flat 6×3 grid (all 18 styles).
- **D-04:** Turn order preserved: home confirms first. Away's screen shows home's team as struck-out and shows a "home confirmed" banner after home locks in. Away cannot confirm the same team home chose.
- **D-05:** Before a team is selected, style swatches render in a neutral **black/white scheme**. After a team is selected, swatches re-render live in that team's palette.
- **D-06:** The player can change their team or style selection freely until they click Confirm. Confirm locks both choices simultaneously.

### Style Swatch Appearance

- **D-07:** Each style tile renders as a **player piece icon** — the `UNIFORM_STYLES[id]` renderer is called with the team's palette (or black/white if no team selected yet) and a jersey number equal to the style's 1-based index in the `ALL_STYLE_IDS` ordered list (1–18).
- **D-08:** No style name label displayed on the tile — piece icon only. (Style name from `UNIFORM_STYLE_META` may be shown on hover via tooltip, but is not required for v1.3.)
- **D-09:** Selected style tile: **tile border glow/highlight** (card-level colored border, matching the pattern of selected team cards in TeamSelectionScreen). The team's `defaultUniformStyle` is pre-highlighted when the screen loads.
- **D-10:** Tile/piece size: Claude decides based on 6-per-row density and legibility of style patterns. Recommended starting point: R≈30px piece rendered inside an ~80×80px tile card.

### Opponent Visibility

- **D-11:** After home confirms, away's screen shows a small **"Opponent confirmed" banner** displaying home's rendered piece in home's team colors and palette. This gives away a preview of home's kit before confirming their own.
- **D-12:** After both players confirm → **straight to game** (no intermediate summary). The server calls `buildInitialGameState` with both teams + both uniform styles, broadcasts `GAME_STATE`, and App.tsx transitions to `GAME_BOARD` as before.

### State Model

- **D-13:** **Deferred build**: On the second `TEAM_PICK` (currently triggers game start), the server instead broadcasts `UNIFORM_SELECTION_START` (no payload needed — each player already knows their own team from their `TEAM_PICK` event). Server stores `homePickedTeam` + `awayPickedTeam` in room state, does NOT build GameState yet.
- **D-14:** New client event: `ClientEvents.UNIFORM_CONFIRM` — payload `{ teamId: TeamId; uniformStyle: UniformStyleId }`. Home emits first; after home confirms, away's screen unlocks for team + style selection; away emits after confirming.
- **D-15:** New server event: `ServerEvents.UNIFORM_HOME_CONFIRMED` — payload `{ teamId: TeamId; uniformStyle: UniformStyleId }` — broadcast to all room members after home confirms, so away's screen shows the banner.
- **D-16:** `GameState.selectedUniformStyles: { home: UniformStyleId; away: UniformStyleId }` — new field added to `GameState` in `packages/shared/src/types.ts`, parallel to `selectedTeams`.
- **D-17:** `buildInitialGameState(roomCode, selectedTeams, gameSpeed, selectedUniformStyles)` — updated signature; `selectedUniformStyles` required parameter; initial KICK_OFF_SETUP GameState is built with correct styles already set.

### Downstream Rendering Update

- **D-18:** `HexGrid.tsx` (or wherever `PieceOverlay` is mounted) replaces `TEAM_CONFIGS[teamId].defaultUniformStyle` with `gameState.selectedUniformStyles[piece.teamId === 'home' ? 'home' : 'away']` for the `uniformStyle` prop passed to `PieceOverlay`. No changes to `PieceOverlay` itself — it already accepts the prop (Phase 20 D-15).

### Claude's Discretion

- Whether the new screen is a new file `UniformSelectionScreen.tsx` (recommended — scale of changes makes a new component cleaner) or a heavily refactored `TeamSelectionScreen.tsx`
- Exact tile card dimensions and piece radius (ensure style patterns are legible at chosen size)
- Whether 2×6 or 3×4 team grid (fit to available screen space; 2×6 preferred)
- Exact CSS class names and module file structure for the new screen
- Whether `UNIFORM_SELECTION_START` carries a payload (e.g., both teams so each player's client knows the other's choice context) — probably no payload needed since each player already knows their own team

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current Screen Flow (primary integration target)

- `packages/client/src/App.tsx` — screen routing logic; `homePickedTeam` local state; socket event handlers for `TEAM_SELECTION_START`, `TEAM_HOME_PICKED`; new handlers for `UNIFORM_HOME_CONFIRMED`, `UNIFORM_SELECTION_START` go here
- `packages/client/src/store/useGameStore.ts` — `Screen` type (add `'UNIFORM_SELECTION'`); `setScreen` action

### Server Room Handling (primary change target)

- `packages/server/src/roomHandlers.ts` — `TEAM_PICK` handler (away branch must be changed from `buildInitialGameState` → `UNIFORM_SELECTION_START` broadcast); new `UNIFORM_CONFIRM` handler added here; `Room` type needs `homePickedUniformStyle` + `awayPickedUniformStyle` fields

### Socket Events (extension point)

- `packages/shared/src/events.ts` — `ClientEvents`, `ServerEvents`, `ClientToServerEvents`, `ServerToClientEvents` interfaces; add `UNIFORM_CONFIRM` and `UNIFORM_HOME_CONFIRMED`

### Shared Types (extension point)

- `packages/shared/src/types.ts` — `GameState` type (add `selectedUniformStyles` field); read current field ordering and JSDoc style to follow
- `packages/shared/src/uniformStyles.ts` — `UniformStyleId` union (all 18 ids), `UNIFORM_STYLE_META` (display names + descriptions); `ALL_STYLE_IDS` ordered list if exported, or derive from `Object.keys(UNIFORM_STYLE_META)` ordering

### Uniform Renderer (used to render tiles)

- `packages/client/src/styles/uniformStyles.tsx` — `UNIFORM_STYLES` renderer registry; each renderer signature `(params: { cx, cy, R, palette, isGK, pieceId }) => { patternDef, fill, overlay }`; all 18 renderers already implement the black/white scheme by passing a neutral palette

### Prior Phase Context (locked decisions)

- `.planning/phases/20-uniform-style-system/20-CONTEXT.md` — D-15 (PieceOverlay prop shape: `uniformStyle + palette`), D-16 (parent resolves from `TEAM_CONFIGS`; Phase 22 changes the source to `GameState.selectedUniformStyles`)
- `.planning/phases/21-new-teams-mls-international/21-CONTEXT.md` — D-01..D-10 (`defaultUniformStyle` per team; used as pre-selection on arrival at the new screen), D-11/D-12 (team ordering; without tabs, ordering in the flat grid should follow MLS teams first, then International, matching Phase 21's intent)

### Requirements

- `.planning/REQUIREMENTS.md` — UNIFORM-02, UNIFORM-03, UNIFORM-04

### Existing Screen Pattern (follow this component structure)

- `packages/client/src/components/TeamSelectionScreen.tsx` — current team selection component; the structure (CSS module, badge imports, socket event pattern) is the closest analog for the new screen
- `packages/client/src/components/TeamSelectionScreen.module.css` — CSS module conventions to follow

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `UNIFORM_STYLES` registry (`packages/client/src/styles/uniformStyles.tsx`) — each renderer already accepts `palette` and returns `{ patternDef, fill, overlay }`. Passing a neutral palette `{ homePrime: '#888', homeAlt: '#ddd', homeFont: '#fff', awayPrime: '#888', awayAlt: '#ddd', awayFont: '#fff', uiColor: '#888' }` produces the black/white swatch default (D-05).
- `UNIFORM_STYLE_META` — all 18 style names and descriptions already defined in `packages/shared/src/uniformStyles.ts`; use for tooltip content (D-08).
- `TEAM_CONFIGS[teamId].defaultUniformStyle` — used to pre-select the style tile on screen load (UNIFORM-03 / D-09).
- `COLOR_SCHEME_REGISTRY` — provides team palettes for live swatch re-render after team selection (D-05).
- Static badge imports pattern (Phase 15 D-03 / Phase 21) — badge PNGs for the team grid tiles.

### Established Patterns

- **App.tsx socket handler registration**: `socket.on` / `socket.off` paired in a single `useEffect(() => {}, [])`. New `UNIFORM_HOME_CONFIRMED` and `UNIFORM_SELECTION_START` handlers follow exactly this pattern.
- **Screen transitions via `setScreen`**: `if (state.phase === 'REPLAY') setScreen('REPLAY'); else setScreen('GAME_BOARD')` in `onGameState`. `setScreen('UNIFORM_SELECTION')` fires on `UNIFORM_SELECTION_START`.
- **Local state in App.tsx**: `homePickedTeam` is a local `useState<TeamId | null>`. A new `homeConfirmedStyle: UniformStyleId | null` (or similar) follows this pattern — received via `UNIFORM_HOME_CONFIRMED`, stored in App, passed as prop to `UniformSelectionScreen`.
- **Home-first confirmation**: `TEAM_PICK` enforces `playerSlot === 1` first, then slot 2. `UNIFORM_CONFIRM` follows the same enforcement: home must confirm before away can confirm (guard in `roomHandlers.ts`).
- **isProcessing mutex**: The `room.isProcessing` guard in `TEAM_PICK` prevents concurrent processing. Apply the same pattern to `UNIFORM_CONFIRM`.
- **TeamSelectionScreen CSS module**: `.grid` class for the team card grid, `.card`/`.cardActive`/`.cardStruckOut` for card states — new screen can follow these or introduce its own module.

### Integration Points

- `App.tsx` — add `'UNIFORM_SELECTION'` to `Screen` union in `useGameStore.ts`; add render branch for `screen === 'UNIFORM_SELECTION'`; add socket handlers; pass `homeConfirmedStyle` prop to `UniformSelectionScreen`
- `packages/server/src/roomHandlers.ts` — away `TEAM_PICK` branch currently calls `buildInitialGameState`; replace with `io.to(roomCode).emit(ServerEvents.UNIFORM_SELECTION_START)` and store `room.awayPickedTeam = teamId`
- `packages/shared/src/gameEngine.ts` (or equivalent) — `buildInitialGameState` signature update to accept `selectedUniformStyles`; propagate to initial `GameState`
- `HexGrid.tsx` — wherever `PieceOverlay` is mounted, change uniform style source from `TEAM_CONFIGS[teamId].defaultUniformStyle` to `gameState.selectedUniformStyles.home` / `..away` (D-18)

</code_context>

<specifics>
## Specific Ideas

- **Black/white swatch before team selection**: Pass a neutral grey palette to the renderer when no team is selected. The exact neutral values should make style patterns legible (distinct but not distracting). Example: `{ homePrime: '#555', homeAlt: '#ccc', homeFont: '#fff', awayPrime: '#555', awayAlt: '#ccc', awayFont: '#fff', uiColor: '#555' }`.
- **Style numbering 1–18**: Jersey numbers on style tiles come from the style's 1-based position in `ALL_STYLE_IDS` / `Object.keys(UNIFORM_STYLES)`. The number is the `pieceId` analogue — `pieceId: 'style-1'` through `'style-18'` for renderer calls (ensures unique pattern IDs in SVG defs).
- **Team grid ordering in flat layout (no tabs)**: MLS teams first (city, crew, la, miami, nashville, seattle) then International (canada, england, france, mexico, spain, us) — follows Phase 21 D-11/D-12 ordering intent, just without tab visual separation.
- **`UNIFORM_SELECTION_START` trigger timing**: Home's `TEAM_PICK` broadcasts `TEAM_HOME_PICKED` (unchanged). Away's `TEAM_PICK` (second pick) now broadcasts `UNIFORM_SELECTION_START` instead of building game state. Both players' clients transition `screen → 'UNIFORM_SELECTION'`.

</specifics>

<deferred>
## Deferred Ideas

- Style name tooltips (hover to see name from `UNIFORM_STYLE_META`) — not required for v1.3; noted but not scoped into Phase 22
- Preview of opponent's current (not yet confirmed) style choice — not scoped; only confirmed choices are visible
- Formation selection — Phase 23

### Reviewed Todos (not folded)

- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — Phase 25 (BUG-23), not Phase 22 scope
- `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` — Phase 25 (REPLAY-07), not Phase 22 scope
- `csv-consolidation-player-pool.md` — Phase 24+, not Phase 22 scope

</deferred>

---

_Phase: 22-uniform-selection-screen_
_Context gathered: 2026-07-04_
