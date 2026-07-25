<!-- generated-by: gsd-doc-writer -->

# Highlight / Ring Color Reference

## Overview

Counter Attack's board renders color-coded feedback through three structurally
distinct, independently-composable mechanisms:

1. **Hex tints** — `HexHighlightType` union rendered by `HexCell.tsx` (mutually exclusive per hex; at most one tint per hex).
2. **Piece rings and hex rings** — `PieceOverlay.tsx` selection/status rings (mostly mutually exclusive, with one independent boolean layer, `isOffside`, that can stack on top) and `HexCell`'s compound `ring` prop (an additive layer independent of the tint).
3. **Standalone always-on-top overlays** — `BallLocationRing.tsx`, a marker that lives outside the tint/ring priority system entirely and is never hidden by either.

This document is the single source of truth (HILITE-05) for every highlight/ring
color in the codebase. Do not add a new color literal to `HexCell.tsx`,
`PieceOverlay.tsx`, or `BallLocationRing.tsx` without adding a corresponding row
here.

## Traffic-Light Semantic Legend (D-01)

| Color             | Meaning                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🟢 Green          | Safe / valid action target                                                                                                                                                                       |
| 🟡 Amber / orange | Caution / risk                                                                                                                                                                                   |
| 🔴 Red            | Danger / rule-violation — **reserved exclusively for the offside ring**. No other element in the app uses red for any other meaning.                                                             |
| 🔵 Blue           | Neutral info (zone/placement guidance, ball-related neutral state)                                                                                                                               |
| 🟣 Purple         | Shot-opportunity / goal-target (the distinct non-red color for scoring chances)                                                                                                                  |
| ⚪ White          | Informational trajectory/path preview or the ball-location marker — established use, deliberately outside the 5-color traffic-light system                                                       |
| 🟨 Gold           | Confirmation / required-action ring accent — established use, also outside the 5-color system (shares the `--color-accent-gold` chrome token swatch by intentional reuse, not a competing color) |

**Rule:** Red renders for exactly one meaning app-wide — the offside ring
(`PieceOverlay.tsx` `isOffside`, `#dc2626`). The goal/shot-target hex tint is
**purple** (`#a855f7` family), not red.

---

## 1. Hex Tint Types (`HexHighlightType`, `HexCell.tsx`)

Rendered as a semantic overlay polygon on top of the base hex fill. At most one
`highlightType` renders per hex — these ten members are mutually exclusive.
Source of truth: `HIGHLIGHT_STYLES` in `packages/client/src/components/HexCell.tsx`.

| Type               | Semantic                                                          | Fill                                    | Stroke                  | Rest / Hover Opacity    |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------- | ----------------------- | ----------------------- |
| `safe`             | 🟢 Valid move destination                                         | `rgba(34,197,94,0.4)`                   | `#16a34a`               | 0.5 / 0.65              |
| `risk`             | 🟡 ZoI steal-risk / tackle-risk during movement                   | `rgba(255,140,0,1)`                     | `#b35a00`               | 0.65 / 0.8              |
| `goal`             | 🟣 Shot-target / goal-line opportunity                            | `rgba(168,85,247,0.5)` (`#a855f7` base) | `#9333ea`               | 0.5 / 0.65              |
| `kickoff`          | 🔵 Neutral zone info (kick-off / free-kick placement zone)        | `rgba(59,130,246,1)`                    | none                    | 0.4 / 0.55              |
| `shot-path`        | ⚪ Informational trajectory preview                               | `rgba(255,255,255,1)`                   | `#dddddd`               | 0.2 / 0.32              |
| `shot-path-action` | ⚪ Actionable trajectory (GK dive / header-contest step-in hexes) | `rgba(255,255,255,1)`                   | `#aaaaaa`               | 0.55 / 0.7              |
| `header-target`    | 🟢 Non-goal header pass target                                    | `rgba(34,197,94,0.4)`                   | none                    | 1 / 1                   |
| `gk-kick-target`   | 🔵 GK kick destination (ball-related neutral state)               | `rgba(56,189,248,0.30)`                 | `rgba(56,189,248,0.55)` | fixed (n/a hover state) |
| `pass-target`      | 🟢 Safe pass target (also covers GK Quick Throw target — merged)  | `rgba(34,197,94,0.4)`                   | none                    | fixed (n/a hover state) |
| `tackle-risk`      | 🟡 Interception-risk pass target                                  | `rgba(255,140,0,0.55)`                  | none                    | fixed (n/a hover state) |

Notes:

- `safe` was recolored gold → green (D-01) so green consistently means "safe target" across `safe`, `header-target`, and `pass-target`.
- `goal` was recolored red → purple (D-02), freeing red app-wide for the offside ring only. Reuses the existing `#a855f7` purple swatch already present in the codebase (`LineupAssignmentScreen.module.css`) rather than introducing a new color.
- `gk-kick-target` and `kickoff` are deliberately different shades of blue (sky-blue vs. saturated blue) so the two remain visually distinguishable even though both carry the "blue = neutral info" semantic.
- `pass-target` merges the former GK_QUICK_THROW inline tint (previously `rgba(34,197,94,0.35)`) — both represented "guaranteed-safe target, no interception risk," and the ~1% opacity difference was not an intentional design distinction.
- `tackle-risk` is intentionally the same amber family as `risk` (both are "caution" semantics) but is kept as its own table entry because it occurs in a different phase context (passing, not movement).

Cross-reference: `packages/client/src/components/HexCell.tsx` (`HIGHLIGHT_STYLES` constant, `HexHighlightType` union).

---

## 2. Piece + Hex Ring Colors

### 2a. `PieceOverlay.tsx` — piece selection/status rings

`selectionState` is mutually exclusive (a piece has exactly one of `none` /
`selectable` / `active` / `activated`). `isOffside` is an independent boolean
layer — it can stack on top of any `selectionState`, since it represents an
orthogonal concern (rule-violation status) rather than the current selection
state.

| State                         | Semantic                                                      | Stroke                                                                                                                                                                            | Radius offset                                                                                 |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `selectionState="selectable"` | 🔵 Piece can be selected this turn                            | `#60a5fa`                                                                                                                                                                         | +3                                                                                            |
| `selectionState="active"`     | 🟢 Currently-selected / active piece (also header contestant) | `#22c55e` (`ACTIVE_RING_STROKE`)                                                                                                                                                  | +4                                                                                            |
| `selectionState="activated"`  | ⚫ Already used this turn / already acted ("spent" look)      | Dark grey ring `#6b7280` (`SPENT_RING_STROKE`), `strokeWidth: 2.5`, **plus** a light-grey semi-transparent overlay circle `#9ca3af` (`SPENT_OVERLAY_FILL`) at `fillOpacity: 0.35` | ring at +8; overlay circle at full `PIECE_RADIUS` (drawn over the piece body, below the ring) |
| `isOffside`                   | 🔴 Offside — the sole app-wide use of red                     | `#dc2626`                                                                                                                                                                         | +6                                                                                            |

**Revision history (Plan 33-07 Task 3 human-verify feedback):** `activated`
originally rendered an orange ring + red X (`#f97316`), and a separate
free-kick-stage-only mechanism (a boolean prop, formerly `isMovedThisStage`)
independently rendered a grey ring + grey overlay for pieces already placed
this free-kick stage. A visual test pass found this inconsistent — the same
underlying concept ("this piece has already acted / been used up") showed two
different looks depending on context. The reviewer's decision: retire the
orange+X treatment entirely and use one consistent grey visual everywhere a
piece is marked as already-acted (MOVE, HIGH_PASS_MOVE, GK_KICK_MOVE,
FREE_MOVE_ATTACK/DEFENSE, SNAPSHOT_DEFLECT, FIRST_TIME_PASS_MOVE, and
FREE_KICK_SETUP). Since `HexGrid.tsx`'s `isSpentNow` already folds
`freeKickPlacedPieceIds` membership directly into `selectionState==='activated'`
(see the `FREE_KICK_SETUP` branch), the separate boolean prop was redundant
once `activated` adopted the grey look — it was removed entirely, and the
constants were renamed from `MOVED_THIS_STAGE_RING_STROKE` /
`MOVED_THIS_STAGE_OVERLAY_FILL` to `SPENT_RING_STROKE` / `SPENT_OVERLAY_FILL`
to reflect that they now describe the general "already acted" state, not a
free-kick-stage-specific case. The grey values were originally chosen (HILITE-03,
D-05) to resolve a prior collision where this look was the same `#22c55e`
green as `active` — that distinctness rationale still applies now that the
look also covers `activated`.

Cross-reference: `packages/client/src/components/PieceOverlay.tsx`
(`ACTIVE_RING_STROKE`, `SPENT_RING_STROKE`, `SPENT_OVERLAY_FILL` constants;
`selectionState`, `isOffside` props).

### 2b. `HexCell.tsx` — compound `ring` prop

An additive gold ring layer on a hex, independent of (and stackable with) any
`highlightType` tint from section 1. Mirrors the `PieceOverlay` additive-layer
pattern. Source of truth: `RING_STYLES` in `HexCell.tsx`.

| Value              | Semantic                                               | Stroke                      | Fill                            |
| ------------------ | ------------------------------------------------------ | --------------------------- | ------------------------------- |
| `ring="required"`  | 🟨 Kick-off centre-hex "must place kicker here" marker | `#f5c518`, `strokeWidth: 2` | `#f5c518` at `fillOpacity: 0.5` |
| `ring="confirmed"` | 🟨 Confirmed pass-target outline                       | `#f5c518`, `strokeWidth: 2` | none                            |

Both values share the same gold swatch — "gold ring = confirmation/required
action" is one visual language expressed with a two-member enum (kept as an
enum rather than a boolean in case a future need arises to visually
distinguish the two cases).

Cross-reference: `packages/client/src/components/HexCell.tsx` (`RING_STYLES`
constant, `ring` prop).

---

## 3. Standalone Always-On-Top Overlay — `BallLocationRing.tsx`

Not a `HexHighlightType` member and not part of the tint/ring priority
resolution in section 1/2 — this component renders as the topmost sibling in
the SVG tree (after `PieceOverlay`), so it is never hidden or out-prioritized
by any hex tint or ring.

| Element              | Semantic                                           | Style                                                                                                                                                   |
| -------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ball-location marker | ⚪ Hex containing the ball, during response phases | White hex-edge outline: `stroke: '#ffffff'` (`BALL_MARKER_STROKE`), `strokeWidth: 2.5` (same thickness as the `PieceOverlay` ring family), `fill: none` |

**Visibility gate — exact 11-phase list** (`BALL_MARKER_PHASES` in
`BallLocationRing.tsx`): the marker renders only when `GameState.phase` is one
of:

`HEADER`, `SNAPSHOT`, `SNAPSHOT_TARGET`, `SNAPSHOT_DEFLECT`, `GK_DIVE`, `SHOT`,
`GK_RESTART`, `GK_QUICK_THROW`, `GK_KICK_TARGET`, `GK_KICK_MOVE`,
`KICK_OFF_SETUP`.

It does not render during ordinary `MOVE` / `PASS` / `KICK_OFF` /
`FREE_KICK_SETUP` / `FREE_MOVE_*` / `LOOSE_BALL` / `HIGH_PASS_MOVE` /
`FIRST_TIME_PASS_MOVE` / `HALF_TIME` / `FULL_TIME` / `REPLAY` — those are
standard-turn phases where the ball position is already legible from the ball
sprite (`BallMarker.tsx`) and piece positions without an extra marker.

**`KICK_OFF_SETUP` addition (Plan 33-07 Task 3 human-verify feedback):**
`KICK_OFF_SETUP` was originally excluded from the gate (a 10-phase list) — during
kickoff setup, the ball/kicker hex instead only got the gold `ring="required"`
overlay (`HexCell.tsx`, section 2b above), which marks "the kicker must be placed
here." A visual test pass found this inconsistent with every other response
phase, where the ball's own hex always gets the white marker. `KICK_OFF_SETUP`
was added to `BALL_MARKER_PHASES` so the ball's hex gets the same consistent
white marker during kickoff setup too. This is additive, not a replacement: the
gold required-ring is a distinct concept ("place the kicker here") and continues
to render unchanged, simultaneously with the white ball marker, on the same hex
during `KICK_OFF_SETUP`.

The prior HEADER-only gold ball-position overlay (formerly inline in
`HexGrid.tsx`) was fully superseded by this component and removed — it is not
kept alongside the new marker.

Cross-reference: `packages/client/src/components/BallLocationRing.tsx`
(`BALL_MARKER_STROKE`, `BALL_MARKER_PHASES` constants).

---

## Adding a New Highlight

When a future change needs a new hex tint, ring, or overlay color:

1. Determine which of the three mechanisms above it belongs to (tint, ring, or standalone overlay) — do not invent a fourth.
2. Pick a color consistent with the traffic-light legend above. Red is off-limits for anything except offside.
3. Add the entry to the relevant `Record`/`Set` constant in the owning component (`HIGHLIGHT_STYLES` / `RING_STYLES` in `HexCell.tsx`, the ring props in `PieceOverlay.tsx`, or `BALL_MARKER_PHASES` in `BallLocationRing.tsx`).
4. Add a row to the corresponding table in this document.
5. Chrome (non-highlight) colors live separately in `packages/client/src/styles/tokens.css` as CSS custom properties (Phase 33 THEME-03). Highlight/ring colors documented here remain a deliberately separate system per the three-table structure above and are not tokenized alongside chrome; Phase 34 will value-swap the chrome token file only.
