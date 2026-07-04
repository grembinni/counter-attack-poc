# Phase 20: Uniform Style System - Research

**Researched:** 2026-07-03
**Domain:** SVG pattern rendering, React component refactoring, TypeScript shared types
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 `pinstripe`** — City's default. Vertical pinstripe: `primary` base, `primaryLight` stripe. Must match v1.2 City appearance exactly.
- **D-02 `diagonal`** — Crew's default. Diagonal stripe: `primary` base, `secondary2` stripe. Must match v1.2 Crew appearance exactly.
- **D-03 `checker`** — Modeled on the current GK checker pattern. Base `primary`, checker color `secondary1`.
- **D-04 `cosmos`** — Horizontal band: `primary` base, `secondary1` horizontal stripe across mid-section.
- **D-05 `plus`** — `secondary2` background, `primary` plus sign centered on the piece.
- **D-06 `v-stripe`** — `secondary1` background, `primary` V-shape.
- **D-07 `quarters`** — Quadrant split: `primary` top-left/bottom-right, `secondary1` top-right, `secondary2` bottom-left.
- **D-08 `polka-dots`** — `primary` background, `secondary1` dot pattern.
- **D-09 `fade`** — SVG `linearGradient`: `primary` top-left, `secondary1` bottom-right.
- **D-10 `tree-rings`** — Concentric alternating circles: outermost `primary`, next `primaryLight`, alternating inward.
- **D-11 `corners`** — `secondary1` background, `primary` triangles at four corners clipped to circle.
- **D-12 `solid`** — Solid `primary` fill, no pattern.
- **D-13** — GK variant: full palette swap `primary ↔ secondary1`, `primaryLight ↔ secondary2`. Same style pattern, all color roles inverted when `isGK = true`. No separate GK style definitions.
- **D-14** — GK italic number label (already in PieceOverlay) is preserved — not part of the uniform style system.
- **D-15** — `PieceOverlay` becomes a pure renderer: accepts `uniformStyle: UniformStyleId` and `palette: TeamPalette` as explicit props. The internal `useGameStore` call for `selectedTeams` is removed from the color/pattern path.
- **D-16** — In Phase 20, the parent component (HexGrid) resolves style + palette from `TEAM_CONFIGS[selectedTeams[piece.teamId]].defaultUniformStyle` and `TEAM_CONFIGS[selectedTeams[piece.teamId]].palette`.
- **D-17** — `selectedTeams` lookup may remain in the parent (HexGrid), NOT in `PieceOverlay` itself, for rendering purposes. `PieceOverlay` receives `palette` and `uniformStyle` as resolved props.

### Claude's Discretion

- **Exact TypeScript shape of `UniformStyle`**: Recommended approach — render function per style: `type UniformStyleRenderer = (params: { cx: number; cy: number; R: number; palette: TeamPalette; isGK: boolean; pieceId: string }) => { patternDef: React.ReactElement | null; fill: string; overlay: React.ReactElement | null }`. `UNIFORM_STYLES` is `Record<UniformStyleId, UniformStyleRenderer>`.
- **Package split**: `UniformStyleId` (string union type) + `UNIFORM_STYLE_META` (display name, description per style) live in `packages/shared/src/uniformStyles.ts`. Actual render implementations live in `packages/client/src/styles/uniformStyles.tsx` since they return JSX.
- **Exact palette values** for City and Crew (ensuring the diagonal visual match).
- **Pattern tile dimensions** for checker, cosmos, polka-dots.
- **Gradient stop positions** for fade style.
- **Concentric ring count** for tree-rings.
- **Triangle clip geometry** for corners style.

### Deferred Ideas (OUT OF SCOPE)

- Animated uniform patterns
- Uniform selection UI (Phase 22)
- `defaultUniformStyle` for Phase 21 new teams (Phase 21 owns this)
- Server-side knowledge of uniform styles

</user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID         | Description                                                                                                                                                                                     | Research Support                                                                                                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UNIFORM-01 | A uniform style library defined in `packages/shared`; each style is a named SVG pattern template parameterized by `TeamPalette`; each style defines both an outfield rendering and a GK variant | Type + metadata live in `packages/shared/src/uniformStyles.ts`; render functions (JSX) live in `packages/client/src/styles/uniformStyles.tsx`. Both satisfy the "defined in packages/shared" requirement for the type contract. |
| UNIFORM-05 | `PieceOverlay` renders using `{ uniformStyle, palette, isGK }` — parameterized pattern system replaces existing hardcoded per-team SVG patterns                                                 | `PieceOverlay.tsx` refactored to accept these props; 4 outfield pattern branches + 2 GK pattern branches removed; HexGrid resolves and passes props                                                                             |

</phase_requirements>

---

## Summary

Phase 20 is a pure client-side rendering refactor. The central deliverable is a `UniformStyleId` type union and `UNIFORM_STYLES` render registry that drive `PieceOverlay`'s SVG output from palette data rather than hardcoded team-name branches. There is no game logic change, no server-side change, and no new UI screen.

The refactor has two major parts. First, new files: `packages/shared/src/uniformStyles.ts` (type union + metadata, no JSX) and `packages/client/src/styles/uniformStyles.tsx` (12 render functions returning SVG fragment descriptors). Second, two existing-file modifications: `TeamConfig` gains `defaultUniformStyle: UniformStyleId`, and `PieceOverlay.tsx` drops its `useGameStore(selectedTeams)` call and its 4+2 hardcoded pattern blocks in favor of a delegate call into `UNIFORM_STYLES[uniformStyle]`.

The existing GK checker pattern (12×12 tile, two 6×6 dark quadrant rects) is the template for the `checker` style. The existing City pinstripe pattern (8×24 tile, `#dc143c` base + `#ef4444` stripe) is the template for `pinstripe`. The existing Crew diagonal (a `<line>` sibling clipped to circle) is the template for `diagonal`. All three must produce bit-for-bit identical output to v1.2 when driven by City's and Crew's Phase 19 palettes.

**Critical palette mismatch to address:** CONTEXT.md D-02 says the diagonal uses `secondary2` for the stripe, requiring `secondary2 ≈ #111111`. However, Phase 19's actual `teamConfig.ts` places near-black at Crew's `secondary1 = '#111111'` and `secondary2 = '#14532d'` (forest green). The planner must resolve this: either the `diagonal` renderer uses `secondary1` (matching Phase 19 data and v1.2 exactly), or Phase 19's palette must be amended before Phase 20 executes. This is a data-contract question between Phase 19 and Phase 20 — it must be answered before the diagonal renderer is written.

**Primary recommendation:** Use a render-function-per-style architecture where each `UniformStyleRenderer` returns `{ patternDef, fill, overlay }` — `PieceOverlay` applies the GK palette swap before invoking the renderer, then injects `patternDef` into `<defs>`, uses `fill` as the circle fill, and appends `overlay` as a sibling. This mirrors the existing pattern structure while being fully palette-parameterized.

---

## Architectural Responsibility Map

| Capability                                     | Primary Tier               | Secondary Tier | Rationale                                                                                                                |
| ---------------------------------------------- | -------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| UniformStyleId type union + UNIFORM_STYLE_META | Shared (`packages/shared`) | —              | Type must be importable by server/future phases; metadata (display name) also needed by Phase 22 selection UI            |
| UniformStyleRenderer functions (JSX)           | Client (`packages/client`) | —              | Returns `React.ReactElement` — JSX runtime is client-only; server has no render concern                                  |
| GK palette swap logic                          | Client renderer            | —              | Applied before the style renderer is called; lives in `PieceOverlay` or the renderer call-site                           |
| `defaultUniformStyle: UniformStyleId` field    | Shared (`packages/shared`) | —              | Lives on `TeamConfig` in `teamConfig.ts`; consumed by HexGrid at runtime                                                 |
| `PieceOverlay` prop migration                  | Client component           | —              | `PieceOverlay.tsx` only; drops `useGameStore` call for pattern path                                                      |
| Style + palette resolution                     | Client component (HexGrid) | —              | `HexGrid` reads `selectedTeams` from store, resolves `TEAM_CONFIGS`, passes `uniformStyle` + `palette` to `PieceOverlay` |

---

## Standard Stack

No new npm packages are required. All dependencies already exist in the project.

| Capability                         | Mechanism                                                    | Source                                                                 |
| ---------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- | ---- | ------------------------------------------------- |
| SVG patterns (`<pattern>`)         | Inline JSX, already used in `PieceOverlay`                   | `[VERIFIED: packages/client/src/components/PieceOverlay.tsx]`          |
| SVG gradients (`<linearGradient>`) | Inline JSX in `<defs>` — same `<defs>` slot as patterns      | `[ASSUMED]` — SVG spec; no new import needed                           |
| SVG `<clipPath>`                   | Already used for Crew diagonal; reusable for `corners` style | `[VERIFIED: packages/client/src/components/PieceOverlay.tsx line 171]` |
| TypeScript string union            | `export type UniformStyleId = 'pinstripe'                    | 'diagonal'                                                             | ...` | `[VERIFIED: project convention in teamConfig.ts]` |
| React JSX render functions         | Standard React functional pattern                            | `[VERIFIED: project stack in CLAUDE.md]`                               |

**Installation:** No new packages needed.

---

## Package Legitimacy Audit

No new external packages are introduced in Phase 20. All rendering is done with SVG primitives already used in the codebase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
| ------- | -------- | --- | --------- | ----------- | ------- | ----------- |
| (none)  | —        | —   | —         | —           | —       | —           |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
HexGrid (client component)
  │
  ├── reads: useGameStore(selectedTeams)   → { home: TeamId, away: TeamId }
  ├── reads: TEAM_CONFIGS[teamId]          → { palette, defaultUniformStyle, ... }
  │
  └── renders: PieceOverlay (per piece)
        props: { uniformStyle, palette, isGK, piece, selectionState, ... }
        │
        ├── applyGKSwap(palette, isGK)     → swapped palette if isGK=true
        ├── UNIFORM_STYLES[uniformStyle]   → renderer function
        │     input: { cx, cy, R, palette, isGK, pieceId }
        │     output: { patternDef: JSX|null, fill: string, overlay: JSX|null }
        │
        ├── <defs>{patternDef}</defs>      → SVG pattern or gradient definition
        ├── <circle fill={fill} />         → base piece circle
        └── {overlay}                      → optional sibling (e.g. diagonal line)
```

Data flow for the `diagonal` (Crew) style:

1. HexGrid reads `selectedTeams.home = 'crew'` → `TEAM_CONFIGS.crew.palette` + `TEAM_CONFIGS.crew.defaultUniformStyle = 'diagonal'`
2. HexGrid passes `uniformStyle="diagonal"` + `palette={crew.palette}` to `PieceOverlay`
3. `PieceOverlay`: `isGK=false` → no swap; calls `UNIFORM_STYLES.diagonal({ cx, cy, R, palette, isGK: false, pieceId })`
4. Renderer returns `{ patternDef: <pattern id="diagonal-${pieceId}" ...><rect fill={palette.primary} /><rect fill={palette.secondary1} /></pattern>, fill: 'url(#diagonal-${pieceId})', overlay: <line ... clipPath={...} /> }`
5. `PieceOverlay` injects `patternDef` into `<defs>`, uses `fill` on the circle, appends `overlay`

### Recommended Project Structure

```
packages/
├── shared/
│   └── src/
│       └── uniformStyles.ts          # UniformStyleId union + UNIFORM_STYLE_META
└── client/
    └── src/
        ├── styles/
        │   └── uniformStyles.tsx     # 12 UniformStyleRenderer functions (JSX)
        └── components/
            └── PieceOverlay.tsx      # refactored: accepts uniformStyle + palette props
```

### Pattern 1: UniformStyleRenderer Return Shape

**What:** Each style exports a function that takes geometry + palette and returns three SVG parts. `PieceOverlay` assembles them.

**When to use:** Any new style in the library follows this exact contract.

```typescript
// packages/client/src/styles/uniformStyles.tsx
// Source: derived from existing PieceOverlay SVG structure [VERIFIED: PieceOverlay.tsx]

import type { TeamPalette } from '@counter-attack/shared';

export type UniformStyleRenderer = (params: {
  cx: number;
  cy: number;
  R: number;
  palette: TeamPalette;
  isGK: boolean;
  pieceId: string;
}) => {
  patternDef: React.ReactElement | null; // injected into <defs>
  fill: string; // applied as circle fill
  overlay: React.ReactElement | null; // sibling element (e.g., line, circles)
};
```

### Pattern 2: GK Palette Swap

**What:** Before calling the renderer, swap color roles when `isGK = true`.

**When to use:** Every call to a `UniformStyleRenderer` when the piece is a GK.

```typescript
// Applied in PieceOverlay before delegating to UNIFORM_STYLES[uniformStyle]
// Source: D-13 decision [VERIFIED: 20-CONTEXT.md]

function applyGKSwap(palette: TeamPalette, isGK: boolean): TeamPalette {
  if (!isGK) return palette;
  return {
    primary: palette.secondary1,
    primaryLight: palette.secondary2,
    secondary1: palette.primary,
    secondary2: palette.primaryLight,
  };
}
```

### Pattern 3: Pattern ID Uniqueness

**What:** SVG pattern IDs must be unique per piece in the DOM. The existing convention is `id={`${teamId}-jersey-${piece.id}`}`.

**When to use:** Every `patternDef` and `linearGradient` returned by a renderer must use `pieceId` in the id attribute.

```typescript
// Existing convention [VERIFIED: PieceOverlay.tsx line 126-128]
id={`cosmos-jersey-${piece.id}`}  // existing
// New convention per style:
id={`pinstripe-${pieceId}`}       // or `${uniformStyle}-${pieceId}`
```

### Pattern 4: `patternUnits="userSpaceOnUse"` Anchor

**What:** All existing patterns use `patternUnits="userSpaceOnUse"` with `x={cx - R}` and `y={cy - R}` to anchor the pattern to the piece's pixel position. This must be preserved.

**When to use:** Any renderer that returns a `<pattern>` (not a `<linearGradient>`) must use this anchor.

```typescript
// [VERIFIED: PieceOverlay.tsx lines 122-130]
<pattern
  id={`pinstripe-${pieceId}`}
  x={cx - R}
  y={cy - R}
  width={8}
  height={24}
  patternUnits="userSpaceOnUse"
>
```

### Pattern 5: linearGradient for the `fade` style

**What:** `<linearGradient>` goes inside `<defs>` (same slot as `<pattern>`). `gradientUnits="userSpaceOnUse"` with explicit `x1/y1/x2/y2` in pixel coords anchors it to the piece.

**When to use:** Only the `fade` style uses `linearGradient`.

```typescript
// [ASSUMED] SVG spec — no existing linearGradient in codebase to reference
<linearGradient
  id={`fade-${pieceId}`}
  gradientUnits="userSpaceOnUse"
  x1={cx - R}
  y1={cy - R}
  x2={cx + R}
  y2={cy + R}
>
  <stop offset="0%" stopColor={palette.primary} />
  <stop offset="100%" stopColor={palette.secondary1} />
</linearGradient>
// fill: `url(#fade-${pieceId})`
```

### Pattern 6: Overlay Sibling Elements

**What:** Some styles use overlay sibling elements rendered after the base circle (e.g., Crew diagonal line, tree-ring circles). These are returned as `overlay: React.ReactElement | null`.

**When to use:** `diagonal` (line + clipPath), `tree-rings` (concentric circles), `corners` (polygon triangles + clipPath).

```typescript
// Existing Crew diagonal structure [VERIFIED: PieceOverlay.tsx lines 236-248]
// The renderer returns the line + clipPath def:
overlay: (
  <>
    {/* clipPath def goes in patternDef alongside the pattern */}
    <line
      x1={cx - R}  y1={cy - R}
      x2={cx + R}  y2={cy + R}
      stroke={palette.secondary1}   // see palette mismatch note below
      strokeWidth={10}
      strokeOpacity={0.8}
      clipPath={`url(#diagonal-clip-${pieceId})`}
      pointerEvents="none"
    />
  </>
)
```

### Anti-Patterns to Avoid

- **Hardcoding team names inside renderers:** Renderers receive `palette` — they must NEVER inspect `teamId` or `piece.teamId`. The palette parameterization is the whole point.
- **Using `Math.random()` for pattern IDs or geometry:** IDs must be stable per `pieceId` across re-renders. Use `pieceId` as the uniqueness seed.
- **Putting JSX in `packages/shared`:** The `uniformStyles.ts` in shared exports only the `UniformStyleId` type union and `UNIFORM_STYLE_META` (name, description). JSX render functions MUST live in `packages/client`.
- **Forgetting `pointerEvents="none"` on overlays:** All SVG overlay elements must have `pointerEvents="none"` to avoid blocking click events on the base circle. This is the existing convention for all rings and the Crew line.
- **Re-reading `TEAM_CONFIGS` inside `PieceOverlay`:** After the refactor, `PieceOverlay` must NOT import or read `TEAM_CONFIGS` or `useGameStore` for rendering purposes. All data arrives via props.

---

## Don't Hand-Roll

| Problem                               | Don't Build                            | Use Instead                                                                                             | Why                                                              |
| ------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| SVG pattern tiling                    | Custom canvas tiling or CSS background | SVG `<pattern>` with `patternUnits="userSpaceOnUse"`                                                    | Already established in codebase; correct scaling at any HEX_SIZE |
| Color interpolation for gradients     | Programmatic color mixing              | SVG `<linearGradient>` with stop colors                                                                 | Browser-native; no runtime math needed                           |
| Per-piece ID uniqueness               | UUID library                           | `pieceId` string from `PlayerPiece.id` (already unique: `'home-0'...'home-10'`, `'away-0'...'away-10'`) | IDs are already globally unique in the SVG DOM                   |
| Clip regions for `corners`/`diagonal` | Canvas masking                         | SVG `<clipPath>` (already used for Crew)                                                                | Established pattern in PieceOverlay                              |

**Key insight:** SVG's native `<pattern>`, `<linearGradient>`, and `<clipPath>` primitives handle every rendering need in this phase. Adding any npm package for SVG manipulation or color computation would be over-engineering a pure SVG composition problem.

---

## Critical Finding: Crew Diagonal Palette Mismatch

**This must be resolved before the diagonal renderer is implemented.**

The CONTEXT.md D-02 specifies: "Diagonal stripe: `primary` base, `secondary2` stripe. Crew must author `secondary2 ≈ #111111`."

However, the actual Phase 19 `teamConfig.ts` (the authoritative source, already committed) has:

```typescript
crew: {
  primary: '#f5c518',     // gold
  primaryLight: '#fde68a',
  secondary1: '#111111',  // ← near-black is here
  secondary2: '#14532d',  // ← forest green is here
}
```

The v1.2 PieceOverlay uses `stroke="#111111"` for the Crew diagonal (line 244), which maps to `secondary1` in Phase 19 data, NOT `secondary2`.

**Resolution options for the planner:**

1. Use `secondary1` in the `diagonal` renderer (diverges from D-02's stated color role, but matches v1.2 appearance and Phase 19 data — recommended for zero regression).
2. Amend Phase 19's Crew palette to swap secondary1 and secondary2 before implementing Phase 20 (preserves D-02 color role naming, but touches Phase 19 work).

**Recommendation:** Use `secondary1` in the diagonal renderer. The visual match to v1.2 is the locked success criterion, and the Phase 19 data is the authoritative current state. Document the divergence from D-02's wording.

---

## Common Pitfalls

### Pitfall 1: Pattern ID Collisions in the SVG DOM

**What goes wrong:** When multiple pieces render simultaneously (22 pieces on the pitch), duplicate pattern IDs cause the browser to use whichever `<defs>` entry appears first in the DOM for all circles — every piece shows the same pattern.

**Why it happens:** SVG `<defs>` are global within the SVG root. If pattern IDs are static (e.g., `id="pinstripe"`), only the first piece's pattern is applied to all pieces.

**How to avoid:** Every pattern/gradient/clipPath ID must include `pieceId`. Convention: `id={`${uniformStyle}-${pieceId}`}` and `id={`${uniformStyle}-clip-${pieceId}`}`.

**Warning signs:** All pieces of one style look identical even when palettes differ; or all pieces show the same style.

### Pitfall 2: Tests Assert Hardcoded Pattern IDs/Colors

**What goes wrong:** `PieceOverlay.test.tsx` has tests asserting specific pattern IDs (`url(#city-jersey-home-5)`) and specific fill colors (`#dc143c`, `#7c3aed`, `#4c1d95`). After the refactor, these IDs and colors change.

**Why it happens:** The tests were written for the v1.2 hardcoded system. The requirement says "existing tests pass without modification" — but that requirement may conflict with the ID naming change.

**How to avoid:** Read `PieceOverlay.test.tsx` carefully. The success criterion says tests pass "without modification" — this means the new pattern IDs must include the same piece IDs that existing tests query. Existing tests use assertions like `fill.toContain('url(#city-jersey')` and `fill.toContain('home-5')`. The new system must produce IDs that still satisfy these substring assertions, OR the requirement needs interpretation (the tests test behavior, not exact IDs).

**Analysis of test assertions vs. refactor:**

- `expect(baseCircle.getAttribute('fill')).toContain('url(#city-jersey')` — this asserts the old ID format. After refactor, the fill will be e.g. `url(#pinstripe-home-5)` which does NOT contain `city-jersey`. **These tests will break.**
- `expect(fills).toContain('#dc143c')` — the City pinstripe pattern's base rect fill will still be `#dc143c` (from `palette.primary`). This assertion WILL still pass.
- `expect(fills).toContain('#7c3aed')` (home GK checker) — after refactor, GK uses the palette-swapped `checker` style. Home GK's palette swap makes `secondary1` → `primary`; the exact colors depend on City's palette. This assertion WILL break.

**Resolution:** The success criterion "existing tests pass without modification" was likely written expecting that the new pattern IDs would be derivable from the existing team + piece ID. The planner must either: (a) name patterns using `${teamId}-jersey-${pieceId}` format (preserving test compatibility), or (b) update the tests. Given the success criterion explicitly states "without modification," option (a) is safer — the renderer receives `teamId` via `pieceId` parsing OR via an additional prop.

**Recommended approach:** Pass `teamId: TeamId` as an additional prop to `PieceOverlay`, or derive it from `piece.teamId`, and use it only for pattern ID construction (not for rendering logic). The pattern ID becomes `id={`${teamId}-${uniformStyle}-${piece.id}`}`. Then `url(#city-pinstripe-home-5)` still contains both `city-jersey` ← wait, it won't. **The test assertion `toContain('url(#city-jersey')` will still fail because the style name changed from `jersey` to `pinstripe`.**

**Final resolution:** The success criterion "without modification" cannot be fully preserved while changing pattern IDs. The planner must decide: modify the tests (simpler, correct) or keep `jersey` as the pattern ID suffix (brittle). The safer plan is to **update the test assertions** in the same wave as `PieceOverlay` is refactored. The CONTEXT.md says "existing tests pass without modification" — this should be read as "test logic is not restructured," not "zero characters change." Document this decision in the plan.

### Pitfall 3: `clipPath` and `patternDef` Sharing a Single `<defs>` Block

**What goes wrong:** If the renderer returns both a `<pattern>` and a `<clipPath>` in `patternDef`, they must both appear inside a single `<defs>` element. If `PieceOverlay` wraps `patternDef` in its own `<defs>`, and the renderer returns a React Fragment with both elements, this works correctly. If the renderer only returns the `<pattern>` and the `<clipPath>` is separate, the assembler must handle both.

**How to avoid:** The `patternDef` return slot can be a React Fragment containing both `<pattern>` and `<clipPath>`. `PieceOverlay` wraps it: `<defs>{patternDef}</defs>`.

### Pitfall 4: `patternUnits="userSpaceOnUse"` Missing the `x/y` Anchor

**What goes wrong:** Without `x={cx - R} y={cy - R}` on the `<pattern>`, the pattern tile origin is at SVG `(0, 0)` instead of the piece center. On a large pitch (1090px wide), pieces far from the origin will show a shifted tile, making the pattern appear misaligned.

**Why it happens:** `userSpaceOnUse` means the tile is specified in the coordinate system of the SVG's user space. The `x/y` attributes shift the tile origin to the piece's top-left corner.

**How to avoid:** Every `<pattern>` must include `x={cx - R} y={cy - R}`.

### Pitfall 5: `tree-rings` Using Concentric `<circle>` Elements — No `<pattern>` Needed

**What goes wrong:** The CONTEXT.md says tree-rings uses concentric `<circle>` elements rather than a pattern tile. If a planner tries to implement tree-rings with a `<pattern>`, the concentric circles won't center correctly on the piece.

**How to avoid:** The `tree-rings` renderer returns `patternDef: null` and `fill: palette.primary` (outermost color) and `overlay: <>{concentric circles}</>`. The overlay circles cover the base circle from inside outward.

**Geometry guidance:** With `PIECE_RADIUS = 12`, three rings fit cleanly: outer (`r=12`, `primary`), middle (`r=8`, `primaryLight`), inner (`r=4`, `primary`). The base circle is the outermost ring — its fill is `primary`. The middle ring (overlay circle `r=8`) is `primaryLight`. The inner ring (overlay circle `r=4`) is `primary` again. All overlay circles need `pointerEvents="none"`.

### Pitfall 6: HexGrid Store Subscription Change

**What goes wrong:** After the refactor, HexGrid must call `useGameStore((s) => s.gameState.selectedTeams)` to resolve `TeamConfig` before passing to `PieceOverlay`. If this subscription is missing, `PieceOverlay` won't receive the correct palette and the board renders with wrong colors.

**Why it happens:** `PieceOverlay` previously read `selectedTeams` itself. Moving that read to HexGrid requires HexGrid to subscribe to it.

**How to avoid:** HexGrid already subscribes to many `gameState` slices. Check whether it already subscribes to `selectedTeams` — looking at the current codebase, HexGrid does NOT subscribe to `selectedTeams` (that read was in `PieceOverlay`). Add: `const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);` to HexGrid.

---

## Code Examples

Verified patterns from actual codebase:

### Existing City Pinstripe Pattern (to match exactly)

```typescript
// Source: PieceOverlay.tsx lines 146-157 [VERIFIED]
// This is what pinstripe renderer must produce for City palette
<pattern
  id={`city-jersey-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={8}
  height={24}
  patternUnits="userSpaceOnUse"
>
  <rect width={8} height={24} fill="#dc143c" />           // palette.primary
  <rect x={2} y={0} width={4} height={24} fill="#ef4444" fillOpacity={0.9} />  // palette.primaryLight
</pattern>
```

### Existing Home GK Checker Pattern (to model `checker` style from)

```typescript
// Source: PieceOverlay.tsx lines 179-194 [VERIFIED]
// This is the template for checker style; tile is 12×12, sub-tiles are 6×6
<pattern
  id={`home-gk-checker-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={12}
  height={12}
  patternUnits="userSpaceOnUse"
>
  <rect width={12} height={12} fill="#7c3aed" />   // palette.primary (post-GK-swap: secondary1)
  <rect x={0} y={0} width={6} height={6} fill="#4c1d95" />  // palette.secondary1 (post-swap: primary)
  <rect x={6} y={6} width={6} height={6} fill="#4c1d95" />  // palette.secondary1 (post-swap: primary)
</pattern>
```

### Existing Crew Diagonal (to model `diagonal` renderer)

```typescript
// Source: PieceOverlay.tsx lines 159-174, 236-248 [VERIFIED]
// Pattern part (solid gold base):
<pattern
  id={`crew-jersey-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={PIECE_RADIUS * 2}
  height={PIECE_RADIUS * 2}
  patternUnits="userSpaceOnUse"
>
  <rect width={PIECE_RADIUS * 2} height={PIECE_RADIUS * 2} fill="#f5c518" />  // palette.primary
</pattern>
// ClipPath (goes in patternDef alongside the pattern):
<clipPath id={`crew-clip-${piece.id}`}>
  <circle cx={cx} cy={cy} r={PIECE_RADIUS} />
</clipPath>
// Overlay sibling (the diagonal line):
<line
  x1={cx - PIECE_RADIUS}  y1={cy - PIECE_RADIUS}
  x2={cx + PIECE_RADIUS}  y2={cy + PIECE_RADIUS}
  stroke="#111111"           // palette.secondary1 in Phase 19 data (see palette mismatch note)
  strokeWidth={10}
  strokeOpacity={0.8}
  clipPath={`url(#crew-clip-${piece.id})`}
  pointerEvents="none"
/>
```

### Existing Cosmos Horizontal Band (to model `cosmos` style from)

```typescript
// Source: PieceOverlay.tsx lines 119-130 [VERIFIED]
// navy base + horizontal stripe across mid-section
<pattern
  id={`cosmos-jersey-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={24}
  height={24}
  patternUnits="userSpaceOnUse"
>
  <rect width={24} height={24} fill="#1e3a8a" />  // palette.primary
  <rect x={0} y={6} width={24} height={12} fill="#3b82f6" fillOpacity={0.85} />  // palette.secondary1
</pattern>
```

### Proposed `solid` Style Renderer (simplest possible)

```typescript
// Source: inferred from system design [ASSUMED — no existing solid style in codebase]
export const solid: UniformStyleRenderer = ({ cx, cy, R, palette, pieceId }) => ({
  patternDef: null,
  fill: palette.primary,
  overlay: null,
});
```

### Proposed `PieceOverlay` Integration Point

```typescript
// Source: derived from D-15, D-16, D-17 decisions [VERIFIED: CONTEXT.md]
// New PieceOverlay signature (simplified):
type Props = {
  piece: PlayerPiece;
  uniformStyle: UniformStyleId;
  palette: TeamPalette;
  selectionState: SelectionState;
  onClick: () => void;
  onInspect: () => void;
  carrierId: string | null;
  attackingTeam: 'home' | 'away';
  isOffside?: boolean;
  isMovedThisStage?: boolean;
};

// Inside PieceOverlay:
const isGK = piece.role === 'GK';
const effectivePalette = isGK
  ? {
      primary: palette.secondary1,
      primaryLight: palette.secondary2,
      secondary1: palette.primary,
      secondary2: palette.primaryLight,
    }
  : palette;
const { patternDef, fill, overlay } = UNIFORM_STYLES[uniformStyle]({
  cx,
  cy,
  R: PIECE_RADIUS,
  palette: effectivePalette,
  isGK,
  pieceId: piece.id,
});
// ... render: <defs>{patternDef}</defs>, circle fill={fill}, {overlay}
```

### Proposed `HexGrid` Resolution (D-16)

```typescript
// Source: derived from D-16 decision [VERIFIED: CONTEXT.md] + HexGrid.tsx structure [VERIFIED]
// Add to HexGrid subscriptions:
const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);

// Inside the pieces.map():
const resolvedTeamId = selectedTeams[piece.teamId];  // 'city' | 'crew'
const teamConfig = TEAM_CONFIGS[resolvedTeamId];
// Pass to PieceOverlay:
<PieceOverlay
  piece={displayPiece}
  uniformStyle={teamConfig.defaultUniformStyle}
  palette={teamConfig.palette}
  selectionState={selectionState}
  // ... other props unchanged
/>
```

---

## State of the Art

| Old Approach                                             | Current Approach                                                          | When Changed | Impact                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------ |
| Hardcoded per-team pattern branches in `PieceOverlay`    | Parameterized `UniformStyleRenderer` driven by palette                    | Phase 20     | Decouples rendering from team identity; enables Phase 22 style selection |
| 4 outfield patterns + 2 GK patterns (6 total, hardcoded) | 12 named styles × 2 variants (outfield + GK via swap) = 24 visual outputs | Phase 20     | All 12 styles available to all future teams in Phases 21+                |
| `PieceOverlay` reads `useGameStore` for team identity    | Parent (HexGrid) resolves team config, passes props to pure renderer      | Phase 20     | `PieceOverlay` becomes testable without store; easier to compose         |

**Deprecated after Phase 20:**

- `url(#city-jersey-*)`, `url(#crew-jersey-*)`, `url(#cosmos-jersey-*)`, `url(#xolos-jersey-*)` pattern ID formats
- `url(#home-gk-checker-*)`, `url(#away-gk-checker-*)` pattern ID formats
- `crew-clip-*` clipPath format (replaced by `diagonal-clip-*`)
- `useGameStore` import in `PieceOverlay.tsx` (removed from the rendering path)

---

## Assumptions Log

| #   | Claim                                                                                                              | Section                      | Risk if Wrong                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A1  | `linearGradient` with `gradientUnits="userSpaceOnUse"` anchors correctly to piece pixel coords using `x1/y1/x2/y2` | Code Examples — `fade` style | Gradient may appear misaligned or wrong scale; fix: use `gradientUnits="objectBoundingBox"` instead         |
| A2  | Three concentric rings (radii 12, 8, 4) fit visually well inside PIECE_RADIUS=12 for `tree-rings`                  | Common Pitfalls — Pitfall 5  | May look too tight or too sparse; adjust ring count/spacing during implementation                           |
| A3  | `polka-dots` can be approximated with a pattern tile containing 2-3 `<circle>` rects of radius ~2-3                | Architecture Patterns        | A single tile may not produce enough visual coverage; adjust tile size during implementation                |
| A4  | The `diagonal` renderer should use `secondary1` (not `secondary2`) to match v1.2                                   | Critical Finding section     | If resolved the other way (amend Phase 19 data), palette authoring must be re-done before Phase 20 executes |
| A5  | HexGrid does not currently subscribe to `selectedTeams`                                                            | Pitfall 6                    | If HexGrid already subscribes (future edit), the add is redundant but harmless                              |

---

## Open Questions

1. **Crew diagonal color role: `secondary1` vs `secondary2`**
   - What we know: Phase 19 data has `secondary1 = '#111111'` (near-black, matches v1.2); D-02 says use `secondary2`
   - What's unclear: Whether Phase 19 palette values should be amended to move near-black to `secondary2`, or whether D-02's wording should be interpreted as "the near-black accent color, whatever slot it's in"
   - Recommendation: Planner should confirm with user before wave execution. If amending Phase 19 is acceptable, update Crew palette to `secondary1='#14532d'` and `secondary2='#111111'`. If not, use `secondary1` in the diagonal renderer and note the D-02 divergence.

2. **Test compatibility: `toContain('url(#city-jersey')` assertion**
   - What we know: PieceOverlay.test.tsx line 123 asserts the base circle fill contains `'url(#city-jersey'`; after refactor this will be something like `url(#pinstripe-home-5)`
   - What's unclear: Whether the success criterion "existing tests pass without modification" requires zero assertion changes or only zero structural changes
   - Recommendation: Update the test assertions in the same wave as PieceOverlay is refactored. The test file IS a modification target in this phase, just a constrained one (update only fill pattern assertions, not the overall test structure).

3. **`defaultUniformStyle` field type location**
   - What we know: CONTEXT.md says the type lives in `packages/shared`; the render functions live in `packages/client`
   - What's unclear: Whether `TeamConfig.defaultUniformStyle: UniformStyleId` can be in `teamConfig.ts` (shared) when `UniformStyleId` is also in shared
   - Recommendation: `UniformStyleId` type union in `packages/shared/src/uniformStyles.ts`; `UNIFORM_STYLE_META` also there; `TeamConfig` imports `UniformStyleId` from `'./uniformStyles.js'`. This creates no circular dependency.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this phase is purely client-side SVG rendering and TypeScript type additions with no external tools, services, or CLIs required beyond the existing pnpm + TypeScript + Vitest stack).

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                |
| ------------------ | -------------------------------------------------------------------- |
| Framework          | Vitest + @testing-library/react                                      |
| Config file        | `packages/client/vitest.config.ts`                                   |
| Quick run command  | `pnpm --filter @counter-attack/client test`                          |
| Full suite command | `pnpm --filter @counter-attack/client test` + `pnpm -w tsc --noEmit` |

### Phase Requirements → Test Map

| Req ID     | Behavior                                                                           | Test Type  | Automated Command                                                 | File Exists?    |
| ---------- | ---------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- | --------------- |
| UNIFORM-01 | `UNIFORM_STYLES` has 12 entries; each returns `patternDef`/`fill`/`overlay`        | unit       | `pnpm --filter @counter-attack/client test -- --reporter=verbose` | ❌ Wave 0       |
| UNIFORM-01 | GK palette swap inverts color roles                                                | unit       | same                                                              | ❌ Wave 0       |
| UNIFORM-01 | `UniformStyleId` type union has 12 members                                         | type check | `pnpm -w tsc --noEmit`                                            | ❌ Wave 0       |
| UNIFORM-05 | `PieceOverlay` base circle fill is `url(#<style>-<pieceId>)` not a hardcoded color | unit       | `PieceOverlay.test.tsx` (update assertions)                       | ✅ needs update |
| UNIFORM-05 | `PieceOverlay` renders GK with swapped palette                                     | unit       | `PieceOverlay.test.tsx` (update GK assertions)                    | ✅ needs update |
| UNIFORM-05 | City outfield pieces show `pinstripe` pattern                                      | unit       | `PieceOverlay.test.tsx`                                           | ✅ needs update |
| UNIFORM-05 | Crew outfield pieces show `diagonal` pattern with correct stripe color             | unit       | `PieceOverlay.test.tsx`                                           | ✅ needs update |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/client test`
- **Per wave merge:** `pnpm --filter @counter-attack/client test` + `pnpm -w tsc --noEmit`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/client/src/styles/uniformStyles.test.tsx` — covers UNIFORM-01 (renderer shape, GK swap, 12 styles)
- [ ] Update `PieceOverlay.test.tsx` assertions — update `url(#city-jersey` → `url(#pinstripe`, GK color assertions

_(Existing test infrastructure covers the test runner setup — only new test file and assertion updates needed)_

---

## Security Domain

Phase 20 introduces no authentication, session management, access control, cryptography, or network endpoints. All changes are client-side SVG rendering and TypeScript type definitions. Security domain is not applicable.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)

- `packages/client/src/components/PieceOverlay.tsx` — full source read; all 6 existing pattern branches analyzed
- `packages/client/src/components/PieceOverlay.test.tsx` — all test assertions catalogued
- `packages/shared/src/teamConfig.ts` — Phase 19 palette values confirmed
- `packages/client/src/components/HexGrid.tsx` — PieceOverlay call site and store subscription pattern confirmed
- `packages/shared/src/types.ts` — `PlayerPiece.role === 'GK'` derivation confirmed
- `packages/shared/src/index.ts` — barrel export pattern confirmed
- `.planning/phases/20-uniform-style-system/20-CONTEXT.md` — all locked decisions read
- `.planning/phases/19-data-model-team-palette/19-CONTEXT.md` — palette foundation confirmed

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — UNIFORM-01, UNIFORM-05 full text confirmed
- `.planning/STATE.md` — project history and locked decisions

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all SVG primitives verified in existing code
- Architecture: HIGH — render function pattern derived directly from existing PieceOverlay structure
- Pitfalls: HIGH — pattern ID collision, test assertion breakage, and palette mismatch all directly observed in source files
- Palette mismatch finding: HIGH — directly read from Phase 19 `teamConfig.ts`

**Research date:** 2026-07-03
**Valid until:** 2026-08-03 (stable — no external dependency on fast-moving packages)
