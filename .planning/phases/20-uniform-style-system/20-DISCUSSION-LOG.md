# Phase 20: Uniform Style System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 20-uniform-style-system
**Areas discussed:** Style library contents, GK visual distinction, PieceOverlay prop migration, UniformStyle TypeScript shape

---

## Style library contents

### Q1: How many named styles and what should they be?

| Option                                          | Description                           | Selected |
| ----------------------------------------------- | ------------------------------------- | -------- |
| Solid + pinstripe + diagonal (3 styles)         | Minimal set, add clean 'solid' style  |          |
| Solid + pinstripe + diagonal + hoops (4 styles) | More visual variety                   |          |
| Solid + pinstripe + diagonal + sash (4 styles)  | Diagonal band across chest            |          |
| You decide                                      | Claude picks sensible 3rd+ style      |          |
| **12 styles (one per team)**                    | User specified full list of 12 styles | ✓        |

**User's choice:** 12 unique styles so each team can default to a visually distinct pattern. Full list provided:

1. City pinstripe (vertical stripe)
2. Crew diagonal
3. GK checker pattern (originally called "Lobos", then corrected to be the current GK checker)
4. Cosmos horizontal stripe
5. Plus sign (primary on secondary2 background)
6. V-stripes (primary V on secondary1 background)
7. Quarters (primary diagonal quadrants, secondary1/secondary2 other quadrants)
8. Polka dots (primary background, secondary1 dots)
9. Fade (linearGradient, primary top-left to secondary1 bottom-right)
10. Tree rings (concentric primary/primaryLight alternating)
11. Corner triangles (secondary1 background, primary corners)
12. Solid (primary color)

**Notes:** User initially said "Lobos style" for style 3, then clarified it was a typo — intended "Xolos" — and further clarified it should match the **current GK checker pattern** tile geometry.

### Q2: Crew diagonal stripe color

| Option                  | Description                                               | Selected |
| ----------------------- | --------------------------------------------------------- | -------- |
| secondary2              | Darkest palette color; Crew authors near-black secondary2 | ✓        |
| Hardcoded black #111111 | Always black, breaks palette contract                     |          |
| secondary1              | First accent color                                        |          |

**User's choice:** `secondary2` — Crew authors `secondary2 ≈ #111111` in Phase 19 palette to preserve v1.2 appearance.

### Q3: Complex styles (fade, tree rings) — defer or implement now?

| Option                  | Description                                                   | Selected |
| ----------------------- | ------------------------------------------------------------- | -------- |
| All 12 in Phase 20      | Implement now so Phase 21 teams can pick defaults immediately | ✓        |
| Defer fade + tree rings | Ship 10 pattern-based styles, add complex ones later          |          |

**User's choice:** All 12 in Phase 20.

---

## GK visual distinction

### Q1: How should GK variant differ from outfield?

| Option                            | Description                                           | Selected |
| --------------------------------- | ----------------------------------------------------- | -------- |
| Color role swap — base color only | GK uses secondary1 as base; stripes/accents unchanged |          |
| Add checker overlay               | GK always gets checker on top regardless of style     |          |
| Style-specific GK variant         | Each style explicitly defines a separate GK rendering |          |

**Notes:** Initial question offered "base color only" swap as recommended. Follow-up question asked about full swap.

### Q2: Scope of color role swap

| Option                                                 | Description                                      | Selected |
| ------------------------------------------------------ | ------------------------------------------------ | -------- |
| Base color only                                        | Only primary→secondary1, accent colors unchanged |          |
| Full swap: primary↔secondary1, primaryLight↔secondary2 | All color roles invert                           | ✓        |

**User's choice:** Full palette inversion for GK: `primary ↔ secondary1` and `primaryLight ↔ secondary2`.

---

## PieceOverlay prop migration

### Q1: Explicit props vs internal store lookup

| Option                           | Description                                                | Selected |
| -------------------------------- | ---------------------------------------------------------- | -------- |
| Explicit props — caller resolves | Pure renderer, parent passes uniformStyle + palette        | ✓        |
| Internal store lookup stays      | PieceOverlay reads uniformStyle from game state internally |          |

**User's choice:** Explicit props. PieceOverlay becomes a pure renderer.

### Q2: How parent resolves style in Phase 20 (before Phase 22 uniform selection)

| Option                                     | Description                                   | Selected |
| ------------------------------------------ | --------------------------------------------- | -------- |
| Read defaultUniformStyle from TEAM_CONFIGS | No game state changes in Phase 20             | ✓        |
| Add selectedUniformStyle to GameState now  | Seeds game state early for Phase 22 migration |          |

**User's choice:** Read from `TEAM_CONFIGS[teamId].defaultUniformStyle`. No game state changes in Phase 20.

---

## UniformStyle TypeScript shape

### Q1: How should a UniformStyle be defined in TypeScript?

| Option                           | Description                                         | Selected |
| -------------------------------- | --------------------------------------------------- | -------- |
| Render function per style        | Each style = function returning SVG elements        |          |
| Config object + generic renderer | Data-only configs, one renderer interprets them all |          |
| You decide                       | Claude picks the shape                              | ✓        |

**User's choice:** Claude's discretion.

### Q2: Where should the UNIFORM_STYLES library live?

| Option                                      | Description                          | Selected |
| ------------------------------------------- | ------------------------------------ | -------- |
| packages/shared/src/uniformStyles.ts        | Accessible to both client and server |          |
| packages/client/src/styles/uniformStyles.ts | Client-only, JSX render functions    |          |
| You decide                                  | Claude picks the location            | ✓        |

**User's choice:** Claude's discretion.

---

## Claude's Discretion

- TypeScript shape of `UniformStyle` — recommended: render function per style returning `{ patternDef, fill, overlay }`
- Package split: `UniformStyleId` type + metadata in `packages/shared`; render implementations in `packages/client`
- Exact palette values for City and Crew (secondary2 near-black for Crew)
- Pattern tile dimensions for checker, cosmos, polka-dots
- Gradient stop positions for fade style
- Concentric ring count for tree-rings
- Triangle clip geometry for corners style

## Deferred Ideas

- Uniform selection UI — Phase 22
- `defaultUniformStyle` assignment for Phase 21 new teams — Phase 21 owns this
- Animated uniform patterns — out of scope v1.3
- Server-side uniform style knowledge — client-only concern in Phase 20
