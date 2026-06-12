# Phase 12: Visual Token & Hex Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 12-visual-token-hex-layer
**Areas discussed:** Stripe rendering approach, PieceOverlay selection API, Token in stats panel, Hex highlight architecture

---

## Stripe Rendering Approach

| Option                    | Description                                                                       | Selected |
| ------------------------- | --------------------------------------------------------------------------------- | -------- |
| SVG `<defs><pattern>`     | Define patterns once in HexGrid's `<svg>` root, referenced via `fill="url(#...)"` | ✓        |
| Inline geometry per piece | Each PieceOverlay draws its own clipPath + rect/line directly                     |          |

**User's choice:** SVG `<defs><pattern>` in HexGrid's existing `<svg>` root

| Option                        | Description                                        | Selected |
| ----------------------------- | -------------------------------------------------- | -------- |
| Inside HexGrid's `<svg>` root | Add `<defs>` block at the top of the existing SVG  | ✓        |
| New TokenPatterns component   | Separate component that renders the `<defs>` block |          |

**User's choice:** Inside HexGrid's `<svg>` root

| Option                            | Description                                   | Selected |
| --------------------------------- | --------------------------------------------- | -------- |
| Two dark horizontal bands         | Evenly spaced across circle, ~1/4 height each |          |
| You decide — match physical board | Claude picks proportions at PIECE_RADIUS=12   | ✓        |

**User's choice:** Claude's discretion on away stripe proportions

---

## PieceOverlay Selection API

| Option                       | Description                                               | Selected |
| ---------------------------- | --------------------------------------------------------- | -------- |
| Single `selectionState` enum | Replace isSelected/isClickable/isSpent with one enum prop | ✓        |
| Add `isSelectable` boolean   | Keep existing props and add one more boolean              |          |

**User's choice:** Single `selectionState: 'none' \| 'selectable' \| 'active' \| 'activated'` enum

| Option                                                    | Description                                | Selected |
| --------------------------------------------------------- | ------------------------------------------ | -------- |
| Keep isSpent for red X; derive cursor from selectionState | isSpent stays, isClickable removed         |          |
| Replace isSpent with activated, combine X + orange ring   | User specified: combine them, match colors | ✓        |

**User's choice:** Replace isSpent with `'activated'` state — orange ring AND red X rendered together; cursor derived from `selectionState !== 'none'`

| Option                                               | Description                             | Selected |
| ---------------------------------------------------- | --------------------------------------- | -------- |
| Keep D-17 contestant ring as separate larger ring    | Both stack visually, different purposes |          |
| Remove D-17 ring, rely on `selectionState: 'active'` | Simplifies PieceOverlay                 | ✓        |

**User's choice:** Remove `isHeaderContestant` prop; header contestants mapped to `selectionState: 'active'` in HexGrid

---

## Token in Stats Panel

| Option                                           | Description                           | Selected |
| ------------------------------------------------ | ------------------------------------- | -------- |
| Mini token circle with stripe in panel header    | ~18px SVG circle with stripe pattern  | ✓        |
| Team color badge — colored dot/border, no stripe | Simpler but non-compliant with VIS-02 |          |
| No change to stats panel                         | Out of scope interpretation           |          |

**User's choice:** Mini token circle with stripe in the PlayerStatsPanel header

| Option                                        | Description                                | Selected |
| --------------------------------------------- | ------------------------------------------ | -------- |
| Inline SVG with own `<defs>` — self-contained | No dependency on HexGrid                   | ✓        |
| Shared `<defs>` in global SVG portal          | Avoids duplication but adds infrastructure |          |

**User's choice:** Inline SVG element with self-contained `<defs>` in PlayerStatsPanel

---

## Hex Highlight Architecture

| Option                                                   | Description                                    | Selected |
| -------------------------------------------------------- | ---------------------------------------------- | -------- |
| Typed `HexHighlightType` enum in HexCell                 | HexCell owns color lookup; HexGrid passes type |          |
| Keep generic `highlightColor` prop, centralize constants | Lighter refactor; HexCell API unchanged        |          |
| You decide                                               | Claude picks approach that fits codebase       | ✓        |

**User's choice:** Claude's discretion — resolved as typed `HexHighlightType` enum (cleaner for "unified" requirement)

| Option                                     | Description                                            | Selected |
| ------------------------------------------ | ------------------------------------------------------ | -------- |
| Consolidate into HexCell                   | All tints rendered inside HexCell; HexGrid passes type | ✓        |
| Keep separate overlays, standardize colors | Existing layered polygon approach stays                |          |

**User's choice:** Consolidate all polygon overlay layers into HexCell via typed prop

| Option                                                   | Description                                | Selected |
| -------------------------------------------------------- | ------------------------------------------ | -------- |
| Priority order: risk > goal > shot-path > kickoff > safe | Single type per hex, highest priority wins | ✓        |
| Array of types — HexCell renders all stacked             | Full accuracy, more complex                |          |

**User's choice:** Priority order approach — one `highlightType` per hex

**Notes:** User added that HIGH_PASS header range hexes should use the same `shot-path` (transparent white) tint from kick target selection through contestant selection; clears after header duel resolves. Replaces current cyan tint.

---

## Claude's Discretion

- Away stripe proportions: band height/spacing at PIECE_RADIUS=12 — match physical board horizontal-stripe aesthetic
- Exact hex tint color values for the 5 UX-06 states
- Ring radii and stroke widths for the 3 UX-05 outline states
- Whether typed enum or generic prop approach is cleaner for HexCell (resolved as typed enum)

## Deferred Ideas

None — discussion stayed within phase scope.
