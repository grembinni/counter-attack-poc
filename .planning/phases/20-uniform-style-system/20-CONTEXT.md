# Phase 20: Uniform Style System - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure rendering system refactor — no game logic changes, no new UI screens (that's Phase 22). This phase delivers:

1. **A 12-style `UNIFORM_STYLES` library** — parameterized SVG jersey patterns, each driven by the 4-color `TeamPalette` (`primary`, `primaryLight`, `secondary1`, `secondary2`)
2. **`PieceOverlay` refactored** — accepts explicit `uniformStyle` and `palette` props; all 4 hardcoded per-team pattern branches and 2 hardcoded GK patterns are removed
3. **City and Crew updated** — their `TeamConfig` gains `defaultUniformStyle: UniformStyleId`; their Phase 19 palettes drive their default rendering with no visual regression from v1.2

Phase 22 (Uniform Selection Screen) will add the UI to let players pick a style. Phase 20 only assigns the defaults.

</domain>

<decisions>
## Implementation Decisions

### Style Library Contents (UNIFORM-01)

12 named styles, one reserved per team so each team can have a unique visual default:

- **D-01:** `pinstripe` — City's default. Vertical pinstripe: `primary` base, `primaryLight` stripe. Must match v1.2 City appearance exactly (red base, lighter-red stripe).
- **D-02:** `diagonal` — Crew's default. Diagonal stripe: `primary` base, `secondary2` stripe. Must match v1.2 Crew appearance exactly (gold base, near-black diagonal). Crew must author `secondary2 ≈ #111111` in their Phase 19 palette.
- **D-03:** `checker` — Modeled on the current GK checker pattern (6×6 alternating square tiles). Base color `primary`, checker color `secondary1`.
- **D-04:** `cosmos` — Inspired by the retired Cosmos kit. Horizontal band: `primary` base, `secondary1` horizontal stripe across mid-section.
- **D-05:** `plus` — Plus/cross shape: `secondary2` background, `primary` plus sign centered on the piece.
- **D-06:** `v-stripe` — V-shape stripes: `secondary1` background, `primary` V-shape.
- **D-07:** `quarters` — Quadrant split: `primary` fills top-left and bottom-right quadrants; `secondary1` fills top-right; `secondary2` fills bottom-left.
- **D-08:** `polka-dots` — `primary` background, `secondary1` dot pattern.
- **D-09:** `fade` — SVG `linearGradient`: `primary` fades in from top-left, `secondary1` fades in from bottom-right, meeting in the middle.
- **D-10:** `tree-rings` — Concentric alternating circles: outermost `primary`, next `primaryLight`, alternating inward.
- **D-11:** `corners` — Corner triangles: `secondary1` background, `primary` triangles at the four corners (clip to circle).
- **D-12:** `solid` — Solid `primary` color fill, no pattern.

### GK Visual Distinction (UNIFORM-01)

- **D-13:** GK variant uses a **full palette swap**: `primary ↔ secondary1` and `primaryLight ↔ secondary2`. The same style's pattern is rendered but with all color roles inverted. No separate GK style definitions — the swap is applied by the renderer when `isGK = true`.
- **D-14:** The italic player number label for GK (already in PieceOverlay) is preserved — it is not part of the uniform style system.

### PieceOverlay Prop Migration (UNIFORM-05)

- **D-15:** `PieceOverlay` becomes a pure renderer. It accepts `uniformStyle: UniformStyleId` and `palette: TeamPalette` as explicit props. The internal `useGameStore` call for `selectedTeams` is removed from the color/pattern path (it may still be used for other state if needed).
- **D-16:** In Phase 20, the parent component (the caller of `PieceOverlay`) resolves style + palette from `TEAM_CONFIGS[teamId].defaultUniformStyle` and `TEAM_CONFIGS[teamId].palette`. No changes to `GameState` in this phase.
- **D-17:** The existing `selectedTeams` lookup in `PieceOverlay` maps `piece.teamId` ('home' | 'away') → `TeamId`. This lookup must remain so the parent can resolve the correct `TeamConfig`. Alternatively the parent handles this resolution and passes `palette` and `uniformStyle` directly — either way, `PieceOverlay` itself no longer reads from `TEAM_CONFIGS` or the store for rendering purposes.

### TypeScript Shape

### Claude's Discretion

- **Exact TypeScript shape of `UniformStyle`**: Recommended approach — render function per style: `type UniformStyleRenderer = (params: { cx: number; cy: number; R: number; palette: TeamPalette; isGK: boolean; pieceId: string }) => { patternDef: React.ReactElement | null; fill: string; overlay: React.ReactElement | null }`. `UNIFORM_STYLES` is `Record<UniformStyleId, UniformStyleRenderer>`.
- **Package split**: `UniformStyleId` (string union type) + `UNIFORM_STYLE_META` (display name, description per style) live in `packages/shared/src/uniformStyles.ts` for server/shared access. Actual render implementations live in `packages/client/src/styles/uniformStyles.tsx` since they return JSX. UNIFORM-01 says "in packages/shared" — the type and metadata satisfy this; render implementations are client-only.
- **Exact palette values** for City and Crew (ensuring `secondary2 ≈ #111111` for Crew diagonal visual match) — Claude authors these within the constraint of Phase 19 palette authoring.
- **Pattern tile dimensions** for checker, cosmos, polka-dots (Claude picks sensible values consistent with current 24×24 and 16×16 tiles in PieceOverlay).
- **Gradient stop positions** for fade style (Claude picks sensible midpoint).
- **Concentric ring count** for tree-rings (Claude picks based on PIECE_RADIUS = 12).
- **Triangle clip geometry** for corners style (Claude picks based on piece radius).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current PieceOverlay (primary refactor target)

- `packages/client/src/components/PieceOverlay.tsx` — the component being refactored; all 4 outfield patterns + 2 GK patterns to be removed; MUST read to understand current SVG structure and what gets replaced
- `packages/client/src/components/PieceOverlay.test.tsx` — existing tests; must pass without modification after refactor

### Shared Types (extension points)

- `packages/shared/src/teamConfig.ts` — `TeamConfig` type; needs `defaultUniformStyle: UniformStyleId` field added; `TeamPalette` type used by renderers
- `packages/shared/src/types.ts` — `PlayerPiece` type; `isGK` derived from `piece.role === 'GK'`

### Phase 19 Context (palette foundation)

- `.planning/phases/19-data-model-team-palette/19-CONTEXT.md` — D-08 (4-color palette shape), D-09 (palette values authored for City/Crew), D-10 (palette.primary already wired into PieceOverlay field access in Phase 19)

### Requirements

- `.planning/REQUIREMENTS.md` — UNIFORM-01, UNIFORM-05

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `PieceOverlay.tsx` — the `SoccerPatches` sub-component (ball carrier indicator), `SelectionState` type, offside ring, moved-this-stage ring, player number label are ALL unchanged by Phase 20. Only the jersey pattern `<defs>`, circle `fill`, and Crew overlay `<line>` are replaced.
- `PIECE_RADIUS = 12` constant — determines tile sizes, ring radii; new styles must use this constant
- `axialToPixel` — already imported and used for `cx, cy`; unchanged

### Established Patterns

- Current pattern structure: `<defs>` containing `<pattern id={`${teamId}-jersey-${piece.id}`}>` + circle `fill={url(#pattern-id)}` — new system replicates this shape but driven by `uniformStyle` + `palette`
- `patternUnits="userSpaceOnUse"` with `x={cx - R}, y={cy - R}` anchor — must be preserved for correct positioning
- Crew uses a `<clipPath>` + a sibling `<line>` on top of the circle — the diagonal overlay pattern (D-02) continues this approach, parameterized by `secondary2`
- `home-gk-checker` and `away-gk-checker` patterns: 12×12 tile, two dark quadrant rects — this is the template for the `checker` style (D-03), now palette-driven

### Integration Points

- `HexGrid.tsx` (or its equivalent caller) — wherever `PieceOverlay` is mounted, must resolve `uniformStyle + palette` from `TEAM_CONFIGS[selectedTeams[piece.teamId]]` and pass as props
- `packages/shared/src/index.ts` — must export new `UniformStyleId` type and `UNIFORM_STYLE_META`

</code_context>

<specifics>
## Specific Ideas

- The user explicitly wants 12 styles so each team (current + all Phase 21 additions) gets a unique visual identity. Phase 21 will assign defaults for the new teams; Phase 20 only needs to define all 12 styles and assign City + Crew defaults.
- Checker style (D-03) is modeled on the **current GK checker pattern** (the home GK purple checker tile) — same tile geometry, now parameterized with palette colors.
- Cosmos style (D-04) is modeled on the **retired Cosmos outfield pattern** (navy base + horizontal blue stripe) — now parameterized.
- Crew diagonal must visually match v1.2 exactly — Crew's `secondary2` must be authored as near-black (`≈ #111111`) in Phase 19 palette.
- City pinstripe must visually match v1.2 exactly — the current pattern uses `#dc143c` base + `#ef4444` stripe; `primaryLight` is authored as `#ef4444` (or equivalent) in Phase 19.
- Fade style (D-09) uses SVG `<linearGradient>` defs — a different SVG primitive than `<pattern>`. The render function returns a `linearGradient` in `patternDef` and a `url(#gradient-id)` fill.
- Tree rings (D-10) use concentric `<circle>` elements rather than a pattern tile — the render function returns them as the `overlay`.

</specifics>

<deferred>
## Deferred Ideas

- Animated uniform patterns — out of scope for v1.3
- Uniform selection UI — that is Phase 22 (UNIFORM-02..04)
- Assigning `defaultUniformStyle` for Phase 21 new teams — Phase 21 owns this; Phase 20 defines all 12 styles but only assigns City and Crew defaults
- Server-side knowledge of uniform styles — Phase 20 style rendering is client-only; server has no render concern in this phase

</deferred>

---

_Phase: 20-uniform-style-system_
_Context gathered: 2026-07-03_
