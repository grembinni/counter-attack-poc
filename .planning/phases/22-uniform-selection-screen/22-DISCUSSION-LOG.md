# Phase 22: Uniform Selection Screen - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-04
**Phase:** 22-uniform-selection-screen
**Areas discussed:** Grid layout, Swatch detail, Opponent visibility, State insertion

---

## Grid layout

| Option            | Description                                                                 | Selected |
| ----------------- | --------------------------------------------------------------------------- | -------- |
| Flat grid         | All 18 styles in a 3×6 or 6×3 grid. Simple, scannable, no navigation.       | ✓        |
| Grouped by family | Sections for Pinstripes, Bars, Splits, Quarters, Shapes, Sunburst+Checkers. |          |
| You decide        | Claude chooses the layout based on existing screen patterns.                |          |

**User's choice:** Flat grid (6×3)

| Option             | Description                                                | Selected |
| ------------------ | ---------------------------------------------------------- | -------- |
| 6 columns × 3 rows | Compact, fits above the fold. Matches 6-team MLS tab grid. | ✓        |
| 3 columns × 6 rows | Taller swatches with more text. Requires more scrolling.   |          |
| 4 columns × 5 rows | 18 doesn't divide by 4; leaves 2 orphan tiles.             |          |

**User's choice:** 6 columns × 3 rows

| Option                          | Description                                           | Selected |
| ------------------------------- | ----------------------------------------------------- | -------- |
| Selection ring + confirm button | Click to select (ring on tile), Confirm button locks. |          |
| Single-click confirm            | Click immediately confirms. No confirm button needed. |          |
| You decide                      | Claude picks interaction pattern.                     |          |

**User's choice (freeform):** "styles should appear after selecting a team. styles should show up as player icons in the team colors each style uniquely numbered 1-18. selecting the player icon chooses the style."

**Notes:** This revealed the combined-screen design and the player-piece tile concept. "Choosing the style" means confirming it. Followed up with turn order question and additional screen layout question.

| Option                                                   | Description                                                        | Selected |
| -------------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| Keep home-first                                          | Home selects+confirms team+style first, then away unlocks.         | ✓        |
| Simultaneous free-for-all                                | Both on screen at the same time, first to confirm claims the team. |          |
| Home confirms team first, both pick style simultaneously | Two-phase confirmation.                                            |          |

**User's choice:** Keep home-first

**User follow-up (freeform):** "get rid of the team tabs, display all teams in 2 rows of 6 or 3 rows of 4 if that fits better"

**Notes:** Phase 21's MLS/International tabs are removed in Phase 22. All 12 teams shown in a flat grid on the combined screen. Claude decides 2×6 vs 3×4 based on screen space.

---

## Swatch detail

| Option                                    | Description                                                  | Selected |
| ----------------------------------------- | ------------------------------------------------------------ | -------- |
| Large piece, tile fills mostly with piece | R≈30–36px in ~80×80px tile. Style detail clearly visible.    |          |
| Medium piece with equal label space       | R≈20–24px piece. More text space.                            |          |
| You decide                                | Claude picks the size for legibility at chosen grid density. | ✓        |

**User's choice:** You decide

| Option               | Description                                                 | Selected |
| -------------------- | ----------------------------------------------------------- | -------- |
| Name below the piece | Short style name from UNIFORM_STYLE_META shown below piece. |          |
| Piece icon only      | Just the rendered piece + number. Clean visual-only.        | ✓        |

**User's choice:** Piece icon only (no name label)

| Option                              | Description                                                      | Selected |
| ----------------------------------- | ---------------------------------------------------------------- | -------- |
| Ring around the piece               | Same ring pattern as in-game piece selection.                    |          |
| Tile border glow / highlighted card | Card-level colored border/background (like TeamSelectionScreen). | ✓        |

**User's choice:** Tile border glow / highlighted card

---

## Opponent visibility

| Option                      | Description                                                                     | Selected |
| --------------------------- | ------------------------------------------------------------------------------- | -------- |
| Show home's confirmed style | Away sees home's rendered piece in a "home confirmed" banner. One socket event. | ✓        |
| Status only                 | Away just sees "Opponent confirmed" text/checkmark. Simpler.                    |          |

**User's choice:** Show home's confirmed style

| Option                     | Description                                                         | Selected |
| -------------------------- | ------------------------------------------------------------------- | -------- |
| Straight to game           | Game state arrives immediately after both confirm. No extra screen. | ✓        |
| Brief summary flash (1–2s) | Moment showing both pieces before game starts. Auto-dismiss.        |          |
| You decide                 | Claude picks based on game flow feel.                               |          |

**User's choice:** Straight to game

---

## State insertion

| Option         | Description                                                                 | Selected |
| -------------- | --------------------------------------------------------------------------- | -------- |
| Deferred build | Server waits; buildInitialGameState called after both confirm team+style.   | ✓        |
| Two-step build | Server builds GameState after teams, adds new UNIFORM_SELECTION game phase. |          |

**User's choice:** Deferred build

| Option                                | Description                                                     | Selected |
| ------------------------------------- | --------------------------------------------------------------- | -------- |
| selectedUniformStyles: { home, away } | Parallel field to selectedTeams. Clean, symmetric.              | ✓        |
| Fold into selectedTeams               | Combined object. Requires updating all selectedTeams consumers. |          |

**User's choice:** `selectedUniformStyles: { home: UniformStyleId; away: UniformStyleId }`

---

## Claude's Discretion

- Piece size in each style tile (recommended: R≈30px in ~80×80px tile)
- Whether 2×6 or 3×4 team grid (fit to available screen space; 2×6 preferred)
- Exact CSS for tile border glow highlight
- Whether new combined screen is a new file `UniformSelectionScreen.tsx` or a refactored `TeamSelectionScreen.tsx`
- Neutral black/white palette values for pre-team-selection swatch rendering

## Deferred Ideas

- Style name tooltips on hover (not required for v1.3)
- Preview of opponent's in-progress (not yet confirmed) style choice
- Formation selection — Phase 23
