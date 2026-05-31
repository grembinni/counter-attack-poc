# Phase 6: React Hex Grid Renderer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 6-react-hex-grid-renderer
**Areas discussed:** Hex orientation, Board dimensions, Valid move computation

---

## Hex orientation

| Option                          | Description                                                          | Selected |
| ------------------------------- | -------------------------------------------------------------------- | -------- |
| Pointy-top (Recommended)        | Points at top/bottom, flat edges on sides. Attack runs horizontally. |          |
| Flat-top                        | Flat edge at top/bottom, points on sides. Attack runs left-to-right. | ✓        |
| Not sure — I'll check the board | Check physical board before deciding.                                |          |

**User's choice:** Flat-top confirmed. Then confirmed again via follow-up question about top-edge appearance (flat edge at top). q increases left-to-right toward away goal.

**Notes:** User confirmed both the orientation and the attack direction (left-to-right, home goal at q=0). The axialToPixel formula is `x = size * 3/2 * q`, `y = size * (√3/2 * q + √3 * r)`.

---

## Board dimensions

| Question                             | Options                                     | Selected                                   |
| ------------------------------------ | ------------------------------------------- | ------------------------------------------ |
| Do you have real board measurements? | Yes / No (placeholder)                      | Yes — I have measurements                  |
| Overall pitch size                   | User typed: 37 × 26                         | 37 columns × 26 rows                       |
| Full rectangle or irregular?         | Full rectangle / Irregular (corners cut)    | Full rectangle                             |
| Final thirds + centre location       | User described                              | Each third is 11 hexes; red lines on image |
| Centre circle radius                 | ~3 / ~4 / ~5 hexes radius                   | ~3 hexes radius                            |
| Board photo location                 | Drop in repo / Share here / Note as pending | Share in next message                      |

**User's choice:** User provided measurements (37×26, 7-hex goals, 10r×2q goal box, 15r×6.5q penalty area, 11q final thirds) and shared a physical board photo.

**Notes:** User also specified: goals are 7 hexes top-to-bottom; goal box is 10 hexes top-to-bottom × 2 hexes left-to-right; penalty area is 15 hexes top-to-bottom × ~6.5 hexes left-to-right; top/bottom rows are half-hexes (visual clipping only). Board photo uploaded directly in conversation — must be saved to repo (e.g., `docs/board-photo.jpg`) as planning artifact.

---

## Valid move computation

| Option                                                 | Description                                                   | Selected          |
| ------------------------------------------------------ | ------------------------------------------------------------- | ----------------- |
| Precompute in state (server computes, client displays) | validMoves: HexCoord[] in GameState; renderer reads it.       |                   |
| Client-side via shared validators                      | Call validateMove() on click; server validates actual move.   | (Claude's choice) |
| Let Claude decide                                      | Claude picks the approach.                                    | ✓                 |
| Zustand store holds mock state (local mutation)        | Recommended for Phase 6                                       | ✓                 |
| Multiple mock states per GamePhase                     | One mock state per phase for standalone testing               | ✓                 |
| MOVEMENT phase only for clicking                       | Highlights only in MOVEMENT; other phases deferred to Phase 7 | ✓                 |

**User's choice:** "Let Claude decide" for valid move computation source. Accepted Zustand + local mutation + multiple mock states + MOVEMENT-phase-only highlighting.

**Notes:** Claude chose client-side `validateMove()` from shared (consistent with server-authoritative model; server still validates actual move; Phase 7 requires zero refactoring of highlight logic). Multiple mock states per GamePhase allows standalone testing of all panels.

---

## Claude's Discretion

- **Valid move computation approach:** Client-side via `validateMove()` from shared. Reasoning: pure functions in shared were designed for both client and server; no network round-trip needed for highlighting; server authoritativeness preserved for actual moves.
- **Hex size / SVG viewport:** Claude picks hexSize (suggest 18-22px) so 37×26 grid fits readable at 1280px width.
- **Component decomposition:** Claude decides file structure (HexGrid, HexCell, PieceOverlay, BallMarker, TurnIndicator, ActionLog, LobbyScreen).
- **Board layout:** Claude picks layout (e.g., pitch ~80% width, right sidebar for panels) optimised for 1280px desktop.
- **Difficult-angle hex coordinates:** Claude derives exact (q,r) values from the board photo and existing pitch.ts logic.

## Deferred Ideas

- Pass/Shot/Header click-to-highlight → Phase 7
- React Router / URL-based navigation → Phase 7 or later
- Connection status indicator → Phase 7
- Undo button → Phase 7
- Animations → Out of scope for v1
