# Phase 23: Formation System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 23-formation-system
**Areas discussed:** Formation coordinates, Mini pitch diagram, FORMATIONS table scope, Confirmation flow

---

## Formation Coordinates

| Option                        | Description                                     | Selected |
| ----------------------------- | ----------------------------------------------- | -------- |
| Keep as-is (r=5,10,16,22)     | Non-symmetric — matches physical board geometry |          |
| Make symmetric (r=5,10,16,21) | Force perfect mirror around r=13                | ✓        |
| You decide                    | Claude picks based on pitch geometry            |          |

**User's choice:** Symmetric 4-player r-values: r = [5, 10, 16, 21]

**Notes:** User also provided complete coordinate derivation rules — backline q=6, midline q=10, frontline q=14; 5-player rows have outer two players shifted +2 toward centre (q=8 for backline). Full rules captured in D-01 through D-04. User indicated this context covers both Phase 23 and Phase 24.

---

## Mini Pitch Diagram

| Option                  | Description                                   | Selected       |
| ----------------------- | --------------------------------------------- | -------------- |
| Scaled hex grid         | Shows exact formation positions at ~30% scale |                |
| Abstract SVG dots       | Rectangle outline with circles/dots, no hexes |                |
| Pre-existing PNG assets | Use images already in assets/formations/      | ✓ (discovered) |

**User's choice:** Pre-existing PNG assets at `packages/client/src/assets/formations/{442,532,433,343}.png` — images found during codebase scout; user confirmed "images for formation selection are in assets/formation"

**Notes:** Assets are clean black-and-white pitch diagrams showing both teams mirrored. Ready to use with no additional work.

---

## FORMATIONS Table Scope

| Option                                 | Description                                                   | Selected |
| -------------------------------------- | ------------------------------------------------------------- | -------- |
| Minimal (positions + description only) | Keep table simple, Phase 24 extends it                        |          |
| Include Phase 24 slot metadata         | SlotRole, jerseyNumber — Phase 24 uses without modifying file | ✓        |

**User's choice:** Include Phase 24 slot metadata in Phase 23's FORMATIONS table.

**Notes:** User provided detailed auto-assignment scoring formulas and jersey number assignment conventions. Full Phase 24 rules captured in CONTEXT.md `<deferred>` section so Phase 24 planner has them.

---

## Confirmation Flow

| Option                           | Description                                                     | Selected |
| -------------------------------- | --------------------------------------------------------------- | -------- |
| Simultaneous / either order      | No ordering dependency for formations                           |          |
| Home-first (Phase 22 pattern)    | Home confirms first, then away unlocks                          |          |
| On existing screen (user choice) | Formation added to current combined screen, same Confirm button | ✓        |

**User's choice:** "This should be an additional option on the selection screen, the 4 formations displaying between team and style. This will exist with the current single confirmation flow."

**Notes:** Formation is NOT a separate screen. The existing `UniformSelectionScreen.tsx` gains a formation grid section between the team and style grids. Same single Confirm button. Same home-first sequential flow from Phase 22. The UNIFORM_CONFIRM event payload is extended to include `formationId`. Phase 24 auto-assignment follows after both players confirm.

---

## Kick-off Shift Question

| Option                | Description                                               | Selected |
| --------------------- | --------------------------------------------------------- | -------- |
| Implement in Phase 23 | buildSquadPieces handles +4 shift now                     | ✓        |
| Defer to Phase 24     | Phase 24 applies shift when calling buildInitialGameState |          |

**User's choice:** Implement in Phase 23. All outfield positions for the kicking team shift q+4 toward centre; player #9 moves to kick-off hex.

---

## Claude's Discretion

- Exact CSS class names and layout dimensions for the formation section
- Whether `UNIFORM_HOME_CONFIRMED` payload is extended (recommended) or a new event is emitted
- Exact SlotId naming convention (recommended: 'GK', 'RB', 'LB', 'RCB', 'LCB', 'RM', 'RCM', 'LCM', 'LM', 'ST', 'RF', 'LF')
- Jersey number tie-breaking where priority rules overlap

## Deferred Ideas

- Phase 24 auto-assignment scoring formulas (captured in CONTEXT.md deferred section)
- Phase 24 jersey number assignment at time of player-to-slot mapping
- defaultFormation per TeamConfig — not needed for v1.3 (all teams default to 4-4-2)
