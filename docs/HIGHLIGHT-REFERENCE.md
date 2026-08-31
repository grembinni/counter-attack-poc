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
`PieceOverlay.tsx`, `BallLocationRing.tsx`, `HeaderTargetRing.tsx`, or
`LineupAssignmentScreen.module.css` without adding a corresponding row
here.

## Traffic-Light Semantic Legend (D-01)

| Color             | Meaning                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 Green          | Safe / valid action target                                                                                                                                                                                                                                                                                                                  |
| 🟡 Amber / orange | Caution / risk                                                                                                                                                                                                                                                                                                                              |
| 🔴 Red            | Danger / rule-violation — **within this highlight/ring system, reserved exclusively for the offside ring**. Red also appears elsewhere in the app for unrelated chrome purposes (e.g. `PitchMarkings.tsx`'s final-third lines, the `--color-danger` chrome token for error text/disabled states) — those are outside this document's scope. |
| 🔵 Blue           | Neutral info (zone/placement guidance, ball-related neutral state)                                                                                                                                                                                                                                                                          |
| 🟣 Purple         | Shot-opportunity / goal-target (the distinct non-red color for scoring chances)                                                                                                                                                                                                                                                             |
| ⚪ White          | Informational trajectory/path preview or the ball-location marker — established use, deliberately outside the 5-color traffic-light system                                                                                                                                                                                                  |
| 🟨 Gold           | Confirmation / required-action ring accent — established use, also outside the 5-color system (shares the `--color-accent-gold` chrome token swatch by intentional reuse, not a competing color)                                                                                                                                            |

**Rule:** Within the highlight/ring system documented here, red renders for
exactly one meaning — the offside ring (`PieceOverlay.tsx` `isOffside`,
`#dc2626`). The goal/shot-target hex tint is **purple** (`#a855f7` family),
not red. This rule does not extend to chrome (non-highlight) uses of red
elsewhere in the app, which are governed by `tokens.css`, not this document.

**Card selection consistency (Phase 47):** `LineupAssignmentScreen.module.css`'s
`.statCardSelected` / `.statCardEligible` classes (§4) reuse this same
green/blue vocabulary — green for "the current selection," blue for "an
eligible target for the pending action" — matching `PieceOverlay.tsx`'s
piece-ring semantics (§2a) rather than introducing a card-local meaning.

---

## 1. Hex Tint Types (`HexHighlightType`, `HexCell.tsx`)

Rendered as a semantic overlay polygon on top of the base hex fill. At most one
`highlightType` renders per hex — these ten members are mutually exclusive.
Source of truth: `HIGHLIGHT_STYLES` in `packages/client/src/components/HexCell.tsx`.

| Type               | Semantic                                                          | Fill                                    | Stroke                  | Rest / Hover Opacity    |
| ------------------ | ----------------------------------------------------------------- | --------------------------------------- | ----------------------- | ----------------------- |
| `safe`             | 🟢 Valid move destination                                         | `rgba(34,197,94,0.4)`                   | `#16a34a`               | 0.65 / 0.8              |
| `risk`             | 🟡 ZoI steal-risk / tackle-risk during movement                   | `rgba(255,140,0,1)`                     | `#b35a00`               | 0.65 / 0.8              |
| `goal`             | 🟣 Shot-target / goal-line opportunity                            | `rgba(168,85,247,0.5)` (`#a855f7` base) | `#9333ea`               | 0.65 / 0.8              |
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
- `pass-target` merges the former GK_QUICK_THROW inline tint (previously `rgba(34,197,94,0.35)` fill with a `rgba(34,197,94,0.6)` stroke at `strokeWidth: 1`) — both represented "guaranteed-safe target, no interception risk," and neither the ~1% fill-opacity difference nor the dropped stroke (now `none`) was an intentional design distinction.
- `tackle-risk` is intentionally the same amber family as `risk` (both are "caution" semantics) but is kept as its own table entry because it occurs in a different phase context (passing, not movement).
- **Header-contest zone preview (Plan 37-19, GOALKICK-05):** the white, selection-independent radius of hexes surrounding an upcoming header contest renders during exactly two phases — `HIGH_PASS_MOVE` and `GOAL_KICK_MOVE` — because those are the two response-move windows that resolve directly into a `HEADER` contest. `GK_KICK_MOVE` and `FIRST_TIME_PASS_MOVE` are deliberately excluded: both resolve into a delivery (a caught pass) instead of a header, so they never render this preview. The radius is 2 hexes and mirrors the server's header-eligibility predicate in `applyGoalKickMoveEnd` (`gameEngine.ts`), not any phase's pace budget — a wider preview would advertise a contest the server refuses to award. Hexes inside the radius render `shot-path`, upgrading to `shot-path-action` where the hex is also a valid destination for the selected response piece. `headerContestZoneSet` in `packages/client/src/components/HexGrid.tsx` is the source of truth for this gate.

Cross-reference: `packages/client/src/components/HexCell.tsx` (`HIGHLIGHT_STYLES` constant, `HexHighlightType` union).

---

## 2. Piece + Hex Ring Colors

### 2a. `PieceOverlay.tsx` — piece selection/status rings

`selectionState` is mutually exclusive (a piece has exactly one of `none` /
`selectable` / `active` / `activated`). `isOffside` is an independent boolean
layer — it can stack on top of any `selectionState`, since it represents an
orthogonal concern (rule-violation status) rather than the current selection
state.

| State                         | Semantic                                                      | Stroke                           | Radius offset |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------- | ------------- |
| `selectionState="selectable"` | 🔵 Piece can be selected this turn                            | `#60a5fa`                        | +3            |
| `selectionState="active"`     | 🟢 Currently-selected / active piece (also header contestant) | `#22c55e` (`ACTIVE_RING_STROKE`) | +4            |
| `selectionState="activated"`  | 🟡 Already used this turn (orange ring + red X)               | `#f97316` (ring + X)             | +3            |
| `isOffside`                   | 🔴 Offside — the sole app-wide use of red                     | `#dc2626`                        | +6            |

**Revision history (Plan 33-07 Task 3 human-verify feedback):** the app briefly
had a second, independent "already-moved-this-free-kick-stage" grey ring +
overlay mechanism (a boolean prop, `isMovedThisStage`), scoped narrowly to one
phase. Human-verify feedback tried unifying it with `activated` app-wide, then
tried improving its contrast, but ultimately rejected the grey treatment
entirely as inconsistent with this phase's actual goal — one consistent
"already acted" visual language, not a one-off styling variant for a single
phase. `isMovedThisStage` was removed entirely (prop, rendering layer,
`MOVED_THIS_STAGE_RING_STROKE`/`MOVED_THIS_STAGE_OVERLAY_FILL` constants); the
single orange-ring-+-red-X `activated` treatment now covers every already-acted
case app-wide, including pieces already placed this free-kick stage (already
folded into `selectionState==='activated'` via `isSpentNow` in `HexGrid.tsx`).

Cross-reference: `packages/client/src/components/PieceOverlay.tsx`
(`ACTIVE_RING_STROKE` constant; `selectionState`, `isOffside` props).

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

## 3. Standalone Always-On-Top Overlays — `BallLocationRing.tsx` + `HeaderTargetRing.tsx`

Neither is a `HexHighlightType` member nor part of the tint/ring priority
resolution in section 1/2 — both components render as topmost siblings in the
SVG tree (after `PieceOverlay`), so neither is ever hidden or out-prioritized
by any hex tint or ring. The two can render simultaneously on the same hex
(see the `HeaderTargetRing.tsx` entry below).

| Element                      | Semantic                                                                     | Style                                                                                                                                                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ball-location marker         | ⚪ Hex containing the ball, during response phases                           | White hex-edge outline: `stroke: '#ffffff'` (`BALL_MARKER_STROKE`), `strokeWidth: 2.5` (same thickness as the `PieceOverlay` ring family), `fill: none`                                                                         |
| Header-target contest marker | 🟨 Goal-kick header contest point, during the `GOAL_KICK_MOVE` travel window | Two concentric gold hex outlines: `stroke: '#f5c518'` (`HEADER_TARGET_STROKE`, shared with `RING_STYLES.confirmed`), outer at `hexSize + 3` / `strokeWidth: 3`, inner at `hexSize * 0.55` / `strokeWidth: 2`, both `fill: none` |

**`BallLocationRing.tsx` visibility gate — 35-phase list** (`BALL_MARKER_PHASES`
in `BallLocationRing.tsx`): the marker renders only when `GameState.phase` is
one of:

`HEADER`, `SNAPSHOT`, `SNAPSHOT_TARGET`, `SNAPSHOT_DEFLECT`, `GK_DIVE`, `SHOT`,
`GK_RESTART`, `GK_QUICK_THROW`, `GK_KICK_TARGET`, `GK_KICK_MOVE`,
`KICK_OFF_SETUP`, `THROW_IN_SETUP`, `GOAL_KICK_SETUP_GK`,
`GOAL_KICK_SETUP_OPPONENT`, `GOAL_KICK_CHOICE`, `GOAL_KICK_TARGET`,
`GOAL_KICK_MOVE`, `CORNER_KICK_GK_SETUP_ATTACKING`,
`CORNER_KICK_GK_SETUP_DEFENDING`, `CORNER_KICK_TAKER_SELECT`,
`CORNER_KICK_REPOSITION`, `CORNER_KICK_FINAL_SETUP`, `FOUL_CHOICE`,
`GK_DIVE_AT_FEET_PROMPT`, `GK_DIVE_AT_FEET_TARGET`, `GK_BOX_ENTRY_PROMPT`,
`GK_BOX_ENTRY_MOVE`, `PENALTY_KICK_SETUP_ATTACKING`,
`PENALTY_KICK_SETUP_DEFENDING`, `PENALTY_KICK_TAKER_SELECT`, `PENALTY_KICK`,
`TACKLE_STEAL_PROMPT`, `FREE_KICK_SETUP`, `FREE_MOVE_ATTACK`,
`FREE_MOVE_DEFENSE`.

It does not render during ordinary `MOVE` / `PASS` / `KICK_OFF` /
`LOOSE_BALL` / `HIGH_PASS_MOVE` / `FIRST_TIME_PASS_MOVE` / `HALF_TIME` /
`FULL_TIME` / `REPLAY` — those are standard-turn phases where the ball
position is already legible from the ball sprite (`BallMarker.tsx`) and piece
positions without an extra marker.

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

**Phase 46 CLEANUP-06 addition (Plan 46-01):** `FREE_KICK_SETUP` was the only
restart-setup family missing the marker — every other restart-setup phase
(kick-off, throw-in, goal kick, corner kick, penalty kick) already showed the
white ball-location ring at its fixed restart hex, but free kick's own
staged-repositioning flow had been left out. `FREE_MOVE_ATTACK` and
`FREE_MOVE_DEFENSE` were added alongside it because the engine provably leaves
`ball.position` untouched throughout both phases — `applyFreeMove`
(`gameEngine.ts`) never writes `state.ball`, and its own emitted `MOVE` event
carries the inline comment "Ball unchanged during FREE_MOVE." All three joins
follow this gate's existing precedent: the generic white marker is reused,
no new tint type or color literal was introduced.

**Phase 37 additions (Plan 37-02):** `THROW_IN_SETUP`, `GOAL_KICK_SETUP_GK`,
`GOAL_KICK_SETUP_OPPONENT`, `GOAL_KICK_CHOICE`, `GOAL_KICK_TARGET` and
`GOAL_KICK_MOVE` extended the gate from its original eleven members to
today's 17. The ball is either fixed at a restart hex or mid-air during every
one of these, matching this gate's existing precedent — the generic white
marker is reused rather than adding a new tint type.

The prior HEADER-only gold ball-position overlay (formerly inline in
`HexGrid.tsx`) was fully superseded by this component and removed — it is not
kept alongside the new marker.

Cross-reference: `packages/client/src/components/BallLocationRing.tsx`
(`BALL_MARKER_STROKE`, `BALL_MARKER_PHASES` constants).

**`HeaderTargetRing.tsx` visibility gate (Plan 37-18, GOALKICK-05):** the
marker renders only when `GameState.phase === 'GOAL_KICK_MOVE'` AND
`GameState.goalKickTargetHex` is non-null; it renders nothing in every other
phase, including the neighbouring `GOAL_KICK_TARGET` / `GOAL_KICK_CHOICE` /
`GOAL_KICK_SETUP_GK` / `GOAL_KICK_SETUP_OPPONENT` and the similarly-named
`GK_KICK_MOVE` (a different, GK-restart travel flow). The gate lives inside
the component itself, not at the `HexGrid` call site.

During `GOAL_KICK_MOVE`, `goalKickTargetHex` equals `ball.position`, so this
marker renders additively alongside `BallLocationRing`'s white outline on the
same hex — the two are not exclusive. They are told apart at a glance: a
single white hex-edge line (ball location) vs. two concentric gold hex
outlines (the header contest point — GOALKICK-05's "both teams get one 3-hex
response move" affordance). Both teams see the marker, ungated by
`isActivePlayer`, so each manager can aim their move at it.

During `GOAL_KICK_MOVE` the gold bullseye also sits inside the white
`headerContestZoneSet` radius described in section 1's Notes list (Plan
37-19) — the two are complementary, not redundant: the bullseye marks the
single hex where the header will be attempted, while the white radius marks
every hex from which a piece is eligible to contest it.

Cross-reference: `packages/client/src/components/HeaderTargetRing.tsx`
(`HEADER_TARGET_STROKE` constant).

---

## 4. Card Selection (`LineupAssignmentScreen.module.css`)

Phase 47 (Select-Based Roster Interaction) retired native HTML5 drag-and-drop
from `LineupAssignmentScreen.tsx` in favor of the same click-to-select model
Section 2a already establishes for pitch pieces. Card selection reuses the
same two colors — green means "this is the current selection," blue means
"clicking this card completes the pending action" — as a value-matched (not
object-identity-shared) pair of CSS Module classes, this document's fifth
consumer alongside `HexCell.tsx`, `PieceOverlay.tsx`, `BallLocationRing.tsx`,
and `HeaderTargetRing.tsx`.

| Class               | Semantic                                           | Border              | Glow                                | Source token                                                                                                        |
| ------------------- | -------------------------------------------------- | ------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `.statCardSelected` | 🟢 this card is the current selection              | `2px solid #22c55e` | `0 0 0 2px rgba(34, 197, 94, 0.4)`  | Value-matched to `PieceOverlay.tsx`'s exported `ACTIVE_RING_STROKE` (`selectionState="active"`), documented in §2a. |
| `.statCardEligible` | 🔵 clicking this card completes the pending action | `2px solid #60a5fa` | `0 0 0 2px rgba(96, 165, 250, 0.4)` | Value-matched to `PieceOverlay.tsx`'s `selectionState="selectable"` ring stroke, documented in §2a.                 |

Notes:

1. These are CSS Module literals, not a TypeScript import of `HIGHLIGHT_STYLES`/`RING_STYLES` — cards are the only CSS-Modules-styled selection surface in the app; `HexCell.tsx`/`PieceOverlay.tsx` style SVG inline, so object-identity reuse across that boundary is not available. Per UI-SPEC §Color, the D-03 requirement is satisfied by value-matching the hex literals, not by object-identity reuse.
2. These classes must remain the last border-declaring rules in `LineupAssignmentScreen.module.css` — they are composed onto `.statCardSentOff`, `.benchSlot`, `.benchCarousel`, and the `.cardTier*` rules, all of which also declare `border`, and CSS Modules resolves conflicting declarations by declaration order.
3. Gold (`--color-accent-gold`) is deliberately NOT used for the card eligible-target state (D-03) — gold stays reserved for confirm/required-action affordances app-wide (see the 🟨 Gold row in the Traffic-Light Semantic Legend above, and §2b).

Cross-reference: `packages/client/src/components/LineupAssignmentScreen.module.css`
(`.statCardSelected`, `.statCardEligible` classes); `.planning/phases/47-select-based-roster-interaction/47-UI-SPEC.md` §Color for the resolved swatch decision.

---

## 5. Valid-Move Tint Consistency

**The rule:** every `GamePhase` that populates `useGameStore`'s `validMoveHexes` (via one
of the `compute*ValidHexes` helpers in `useGameStore.ts`) tints those hexes with the shared
🟢 `safe` style from `HIGHLIGHT_STYLES` — the same green used for ordinary step-by-step
movement — unless the phase is an enumerated, documented member of
`VALID_MOVE_TINT_EXCEPTION_PHASES` (`packages/client/src/components/HexGrid.tsx`). This is
the D-02 rule (Phase 46, CLEANUP-06/CLEANUP-09): one visual language for "you may move a
piece here," consistent across every movement-pattern phase, with only named, reasoned
exceptions.

**Phases that take the shared `safe` tint** (traced from `useGameStore.ts`'s
`compute*ValidHexes` call sites):

`MOVE` (ordinary movement, `computeMovementValidHexes`), `HIGH_PASS_MOVE`, `GK_KICK_MOVE`,
`FIRST_TIME_PASS_MOVE`, `GOAL_KICK_MOVE`, `CORNER_KICK_FINAL_SETUP` (all six via
`computeResponseMoveValidHexes`), `FREE_MOVE_ATTACK`, `FREE_MOVE_DEFENSE`,
`GOAL_KICK_SETUP_GK`, `GOAL_KICK_SETUP_OPPONENT`, `GK_BOX_ENTRY_MOVE` (all via
`computeFreeMoveValidHexes`), `CORNER_KICK_GK_SETUP_ATTACKING`,
`CORNER_KICK_GK_SETUP_DEFENDING` (bespoke uncapped-placement filters, structurally identical
to `computeFreeMoveValidHexes`'s occupancy-only shape), `CORNER_KICK_REPOSITION`
(`computeCornerRepositionValidHexes`), `PENALTY_KICK_SETUP_ATTACKING`,
`PENALTY_KICK_SETUP_DEFENDING` (`computePenaltyKickValidHexes`), and
`GK_DIVE_AT_FEET_TARGET` (`computeGkDiveAtFeetTargetHexes`, shared package).

Two of these phases (`HIGH_PASS_MOVE`, `GOAL_KICK_MOVE`) additionally render a _subset_ of
their `safe`-tinted valid-move hexes as `shot-path-action` where that hex also falls inside
the header-contest-zone radius — this is the existing, separately documented
header-contest-zone preview (see section 1's Notes list above), not a phase-level exception:
the phase's valid-move hexes are still `safe` by default, with that one radius upgraded to a
different informational tint for the header-contest UX. `MOVE`'s valid-move hexes are
likewise still `safe` by default even though a _sub-hex_ may separately render `risk` /
`tackle-risk` when it also carries ZoI-steal or tackle danger — that per-hex risk/safe split
is the foundational, long-established purpose of the `risk` tint (section 1 above), not a
phase-level tint exception either.

**The exception set** (`VALID_MOVE_TINT_EXCEPTION_PHASES`, `HexGrid.tsx`) — phases whose
valid-move hexes deliberately do NOT take `safe`:

| Phase              | Resolved tint instead  | Reason                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GK_DIVE`          | (suppressed — no tint) | Dive-target hexes render via the separate `gkDiveTargetSet` mechanism, never through `validMoveHexes`; `validMoveHexes` is already empty entering this phase (D-28) since no `selectPiece` branch exists for it — the exclusion is defense-in-depth against a stale selection leaking `safe` onto dive-target hexes. Predates Phase 46 (Bug 2 fix).                                   |
| `SNAPSHOT_DEFLECT` | ⚪ `shot-path` (white) | The defending piece's valid-move hexes intentionally keep the white shot-path tint instead of green — moving to intercept a snapshot is a different UX context than ordinary movement. Predates Phase 46 (Bug 2 fix, snapshot-shot-flow-mismatch BUGFIX).                                                                                                                             |
| `KICK_OFF_SETUP`   | 🔵 `kickoff` (blue)    | Valid-move hexes fall entirely inside the team's kick-off placement zone, which already renders the dedicated blue `kickoff` zone-info tint (`isKickoffTint`) at higher ternary priority than `safe` — a pre-existing, documented zone-placement affordance (see the `kickoff` row in section 1), not a movement-pattern tint.                                                        |
| `FREE_KICK_SETUP`  | 🔵 `kickoff` (blue)    | Valid-move hexes fall inside the team's free-kick placement zone, which renders the same dedicated blue `kickoff` tint (`isInMyFreeKickZone`, D-48) at higher ternary priority than `safe` — mirrors the `KICK_OFF_SETUP` placement-zone precedent; independently confirmed by the existing `HexGrid.test.tsx` D-48 suite ("does NOT render the generic safe (green) fill anywhere"). |

**Adding a new movement-pattern phase:** if a future phase populates `validMoveHexes` for a
new movement pattern, it must either (a) render with the shared `safe` tint by doing nothing
special — this is the default and requires no changes here — or (b) be added to
`VALID_MOVE_TINT_EXCEPTION_PHASES` in `HexGrid.tsx` with a one-line reason comment, and this
table updated to match. Never leave a new phase silently resolving to neither `safe` nor an
enumerated exception — that is exactly the ad hoc, undocumented drift D-02 exists to prevent.

---

## Adding a New Highlight

When a future change needs a new hex tint, ring, or overlay color:

1. Determine which of the three mechanisms above it belongs to (tint, ring, or standalone overlay) — do not invent a fourth.
2. Pick a color consistent with the traffic-light legend above. Red is off-limits for anything except offside.
3. Add the entry to the relevant `Record`/`Set` constant in the owning component (`HIGHLIGHT_STYLES` / `RING_STYLES` in `HexCell.tsx`, the ring props in `PieceOverlay.tsx`, or `BALL_MARKER_PHASES` in `BallLocationRing.tsx`).
4. Add a row to the corresponding table in this document.
5. Chrome (non-highlight) colors live separately in `packages/client/src/styles/tokens.css` as CSS custom properties (Phase 33 THEME-03). Highlight/ring colors documented here remain a deliberately separate system per the three-table structure above and are not tokenized alongside chrome; Phase 34 will value-swap the chrome token file only.
