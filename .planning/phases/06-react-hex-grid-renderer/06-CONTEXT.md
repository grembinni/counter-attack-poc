# Phase 6: React Hex Grid Renderer - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Bootstrap the React client from its placeholder `main.ts` into a fully interactive hex-grid UI driven by hardcoded mock `GameState` data — no server connection. Deliverables: SVG pitch rendered from real board coordinates, piece overlays with ball marker, valid-move highlighting for MOVEMENT phase, lobby screens (Create/Join/Waiting), turn indicator, and action log panel.

**Out of scope for Phase 6:**

- Socket.io connection and live server state (Phase 7)
- Click-to-highlight for PASS, SHOT, HEADER, SNAPSHOT phases (Phase 7)
- Undo controls (Phase 7)
- Match lifecycle (action counters, halves, kick off, added time) (Phase 8)
- Animations — static state transitions only (out of scope for v1)
- Mobile layout — desktop-first only (out of scope for v1)

</domain>

<decisions>
## Implementation Decisions

### Hex Geometry

- **D-01:** Hex orientation is **flat-top** — flat horizontal edges at top/bottom, pointy vertices on left/right. Confirmed against the physical Counter Attack board.
- **D-02:** q-axis runs left-to-right (q=0 = home goal end, q=36 = away goal end). r-axis runs top-to-bottom.
- **D-03:** `axialToPixel` formula for flat-top hexes: `x = hexSize * (3/2 * q)`, `y = hexSize * (√3/2 * q + √3 * r)`. SVG polygon points use flat-top vertex angles (0°, 60°, 120°, 180°, 240°, 300°).

### Pitch Dimensions (replaces placeholder grid)

- **D-04:** Replace the placeholder 25×16 `PITCH_HEXES` in `packages/shared/src/pitch.ts` with the real 37×26 grid: q∈[0,36], r∈[0,25], full rectangle (962 hexes). Top/bottom rows are half-hexes visually (viewport clipping only — all 26 r-values are valid playable hexes in the logical grid).
- **D-05:** Region boundaries (to be encoded as `ReadonlySet<string>` replacing existing approximate values):
  - **Home final third**: q ∈ [0, 10] (11 columns)
  - **Middle third**: q ∈ [11, 25] (15 columns)
  - **Away final third**: q ∈ [26, 36] (11 columns)
  - **Goals** (7 hexes tall, centered): home q=0 r∈[9,15]; away q=36 r∈[9,15]
  - **Goal boxes (6-yard)**: 10r × 2q — home q∈[0,1] r∈[8,17]; away q∈[35,36] r∈[8,17]
  - **Penalty areas**: 15r × ~6q — home q∈[0,5] r∈[5,19]; away q∈[31,36] r∈[5,19]
  - **Centre circle**: hexDistance ≤ 3 from kickoff hex (~q=18, r=12)
  - **Kickoff hex**: ~q=18, r=12 (exact centre of 37×26 grid)
  - **Difficult-angle hexes**: visible as dots near penalty area corners in board photo — exact coordinates to be derived by planner from the board image
- **D-06:** The board photo (shared in discuss session) must be saved to the repo (e.g., `docs/board-photo.jpg`) and used by the planner as the ground-truth reference for exact hex region coordinates. This is the resolution of the HARD BLOCK listed in STATE.md.

### Valid Move Computation

- **D-07:** Valid move destinations are computed **client-side** using `validateMove()` from `@counter-attack/shared`, called on piece-click with the current Zustand store state. This is consistent with the server-authoritative model: the server still validates the actual `game:move` action; the client uses shared validators only for UI highlighting.
- **D-08:** In Phase 7, highlighting logic requires zero changes — the Zustand store's `GameState` is updated by `socket.on('game:state', ...)` instead of local mock mutation. The `validateMove()` call on click is identical.
- **D-09:** Highlighting applies only to **MOVEMENT phase** in Phase 6. Pass destination, shot direction, and other phase interactions are Phase 7 work.

### State Management

- **D-10:** Zustand store holds the `GameState` (mock in Phase 6, server-broadcast in Phase 7). On piece-click-to-move in mock mode, the store mutates state locally (applies the move). Phase 7 replaces this local mutation with the server-broadcast update path.
- **D-11:** Export multiple mock states from a `packages/client/src/mock/` directory — one per relevant `GamePhase` (at minimum: `MOVEMENT`, `PASS`, `SHOT`, `GK_RESTART`). Lets the turn indicator, action log, and panel layouts be tested for each phase standalone. Use the `mockMovementState` as the default on app load.

### Application Structure

- **D-12:** Phase 6 needs 4 screens: **Create Room**, **Join Room**, **Waiting for Opponent**, and **Game Board**. Navigation managed by lightweight component-state routing (a `screen: Screen` field in the Zustand store). React Router is deferred to Phase 7 or later when real URL-based navigation is needed.
- **D-13:** The lobby screens (Create/Join/Waiting) are standalone and navigable in isolation without any server connection. They display static UI only: generated room code with copy-to-clipboard on Create, text input on Join, and code reminder on Waiting.

### Claude's Discretion

- **Hex size / SVG viewport:** Claude picks a hex size that makes the 37×26 grid readable at 1280px width. Suggest starting with hexSize=18–22px; SVG viewBox scales to fill available space.
- **Component decomposition:** Claude decides the file structure (`HexGrid`, `HexCell`, `PieceOverlay`, `BallMarker`, `TurnIndicator`, `ActionLog`, `LobbyScreen`) as long as each component has a single clear responsibility.
- **Layout:** Claude picks the game board layout (e.g., pitch fills ~80% of viewport width, panels on right sidebar) optimised for 1280px desktop.
- **Difficult-angle hex coordinates:** Claude derives exact axial (q, r) coordinates from the board photo and existing Phase 4 `pitch.ts` logic.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Board Layout and Hex Geometry

- `packages/shared/src/pitch.ts` — Current placeholder 25×16 `PITCH_HEXES` and region definitions. **This file is the primary target of Phase 6** — all region sets must be recomputed for the 37×26 grid.
- Board photo (shared in discuss session) — must be saved to `docs/board-photo.jpg` (or similar) in the repo. Ground-truth reference for exact region boundaries, difficult-angle hex positions, and goal/box dimensions. **Required before planning begins.**
- `c:\Users\jerem\Downloads\rule-book-new.pdf` — Official boxed game rulebook. Pages 14-15 (passes), 18-19 (shooting/GK), 21-22 (heading), 7 (ZoI). Cross-check region rules vs Phase 4 implementation.

### Shared Types and Validators

- `packages/shared/src/types.ts` — `GameState`, `PlayerPiece`, `BallState`, `GamePhase`, `MovementSlot`, `ActionEvent`. Phase 6 renders from these types.
- `packages/shared/src/hex.ts` — `hexDistance`, `hexNeighbors`, `hexesInRange`, `isUnderZoI`. Client uses `hexNeighbors`/`hexesInRange` for ZoI and highlight calculations.
- `packages/shared/src/moveValidator.ts` — `validateMove()`. Called client-side on piece-click to compute valid destinations (D-07).
- `packages/shared/src/teams.ts` — `HOME_SQUAD` / `AWAY_SQUAD`. Used to build the mock `GameState` piece arrays.

### Client Package

- `packages/client/package.json` — Currently a placeholder. Phase 6 adds React, Vite, Zustand, honeycomb-grid, socket.io-client devDeps.
- `packages/client/src/main.ts` — Entry point to replace with `main.tsx` (React mount).

### Requirements Covered

- `.planning/REQUIREMENTS.md` §Pitch — PITCH-04, PITCH-05
- `.planning/REQUIREMENTS.md` §User Experience — UX-01, UX-02, UX-03, UX-04
- `.planning/ROADMAP.md` §Phase 6 — success criteria 1–5

### Prior Phase Context

- `.planning/phases/05-dice-resolver-all-resolution-branches/05-CONTEXT.md` — Phase 5 decisions (lastDiceRoll shape, GK_RESTART phase, event log ActionEvent union). Phase 6 renders these in the turn indicator and action log panels.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `hexDistance(a, b)` in `hex.ts` — used to compute ZoI defenders and movement range. Phase 6 client calls this for valid-move highlighting.
- `hexNeighbors(h)` / `hexesInRange(h, n)` in `hex.ts` — range sets for pass highlights and ZoI circles in the SVG.
- `validateMove(state, pieceId, targetHex)` in `moveValidator.ts` — client calls this on piece-click to get the set of valid destination hexes.
- `HOME_SQUAD` / `AWAY_SQUAD` in `teams.ts` — import directly into mock state file; no need to hardcode player attributes again.
- `PITCH_REGIONS`, `PITCH_HEXES`, `isDifficultAngle` in `pitch.ts` — will be updated in Phase 6; renderer imports these for hex colouring (final third shading, penalty area outline, difficult-angle markers).
- `ActionEvent` union in `types.ts` — action log panel maps each `ActionEvent` type to a human-readable string.

### Established Patterns

- **Named exports, no defaults** — All shared modules use named exports. Client components should follow the same convention.
- **`.js` extensions on local imports** — NodeNext module resolution in `packages/shared`; Vite handles `.tsx` imports in client without extensions.
- **Axial (q, r) everywhere** — pixel conversion lives only in `hexToPixel.ts` (to be created in Phase 6). No offset coordinates anywhere in the codebase.
- **Readonly types** — `GameState.pieces` is `readonly PlayerPiece[]`; `PITCH_HEXES` is `readonly HexCoord[]`. Zustand store wraps state immutably.

### Integration Points

- `packages/client/package.json` — needs React 18, Vite 5, Zustand 4, honeycomb-grid 4.x, socket.io-client 4.x added as deps. `"build"` script needs replacing with `vite build`.
- `packages/shared/src/pitch.ts` — `PITCH_HEXES` and all region `ReadonlySet<string>` constants need recomputing for 37×26. This affects Phase 4's region lookups (penalty box shots, difficult-angle penalties) — re-verify PITCH-02, PITCH-03 unit tests after update.
- `pnpm -r build` must continue to pass after client is fully wired up.

</code_context>

<specifics>
## Specific Ideas

- **Board photo as planning artifact**: The physical Counter Attack board photo (shared in discussion) is the ground truth for exact hex region boundaries. The planner must save this image to the repo and derive q,r coordinates from it before writing plan tasks.
- **Pitch color banding**: The real board uses alternating dark/light green diagonal stripes. Phase 6 should visually approximate this (e.g., alternating fill by `(q + r) % 2`) for visual fidelity.
- **Half-hex top/bottom rows**: The physical board clips the top and bottom rows of hexes visually. The SVG should use a `clipPath` or `overflow: hidden` on the SVG viewport to replicate this.
- **Difficult-angle hexes**: Board shows small white dots at specific hexes near the penalty area corners. Phase 6 renders these as a subtle dot/circle overlay on those hexes (same radius as the ZoI marker concept).

</specifics>

<deferred>
## Deferred Ideas

- **Pass/Shot/Header click-to-highlight**: Phase 7 — once real server broadcasts drive state, the click handling for non-MOVEMENT phases can be added.
- **React Router / URL-based navigation**: Deferred to Phase 7 or later. Phase 6 uses component-state screen switching only.
- **Connection status indicator**: Phase 7 (requires live socket).
- **Undo button**: Phase 7.
- **Animations**: Out of scope for v1.

</deferred>

---

_Phase: 6-react-hex-grid-renderer_
_Context gathered: 2026-05-30_
