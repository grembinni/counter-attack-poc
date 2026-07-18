# Phase 27: Response Activation Model - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 27-response-activation-model
**Areas discussed:** Resolution timing, Visual overlays — penalty + ball highlight, Eligibility range per response type, Keeper auto-reposition on final third

---

## Resolution timing

| Option                                                  | Description                                                                             | Selected |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Auto-resolve immediately                                | Click selects the hex and triggers dice/contest resolution in the same round-trip       |          |
| Click sets position, resolve happens later (dive-style) | Mirrors GK_DIVING: click sets position now, resolution happens at a later trigger point | ✓        |
| Depends per response type                               | Some resolve at shot-time, others resolve on click                                      |          |

**User's choice:** Click sets position, resolve happens later (dive-style) — refined across follow-up questions into a fully positioning-only scope.

**Notes:** User clarified this phase is scoped to ONLY the pre-challenge movement/positioning step. FINAL THIRD has no auto-resolve at all — it's a literal MOVEMENT-phase clone (select, move, mark activated, undo, End Turn). DEFLECT can auto-resolve immediately after the defender's move (one-sided, no hand-off). HEADER "auto-resolves" in the sense that it's just the attacker/defender movement action responding to a HIGH_PASS — each side gets a single-selection movement turn, then the existing duel/target flow (unchanged) proceeds. Keeper ball-in-box mirrors dive: single-select-and-move, resolution deferred.

---

## Visual overlays — penalty + ball highlight

| Option                                          | Description                                                              | Selected |
| ----------------------------------------------- | ------------------------------------------------------------------------ | -------- |
| White hex + small "−1" text badge               | New white highlightType; penalty hexes get an additional "−1" text label | ✓        |
| Two hex tint colors (white=safe, amber=penalty) | Distinct fill colors instead of a text badge                             |          |
| White hex + small icon                          | Icon/glyph instead of literal text                                       |          |

**User's choice:** White hex + small "−1" text badge.

**Notes:** Penalty rule clarified as distance-based and type-specific: HEADER penalizes at hex-distance 2 (distance 1 is clean); DIVE penalizes at hex-distance 3 (the existing outer edge of the GK dive range — same penalty already implemented via `validateGKDive`, this phase just adds the matching visual). DEFLECT, FINAL THIRD, and GK ball-in-box have no penalty — flat white/eligible.

For the RESP-09 ball-hex highlight, user selected a static gold/yellow ring/outline around the ball hex (not a pulsing/animated highlight), layered under the BallMarker.

---

## Eligibility range per response type

| Option                                                | Description                                                             | Selected    |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | ----------- |
| Defenders within N hexes of shot path                 | Deflect eligibility based on movement range to reach the shot-path line | ✓ (N=3)     |
| Only defenders already adjacent (no movement)         | No movement/range involved for deflect                                  |             |
| Any defending piece that can legally reach a ring hex | Final-third eligibility as normal MOVEMENT-phase-style check            | ✓ (refined) |
| Only pieces already within N hexes of the ring        | Tighter pre-filter for final-third                                      |             |
| Keeper only, N-hex range like dive                    | Ball-in-box eligibility, keeper-only                                    | ✓ (N=1)     |
| Keeper plus nearby defenders                          | Non-keeper pieces also eligible for ball-in-box                         |             |

**User's choice:** Deflect = defenders within 3 hexes of any point on the shot path ("the player can deflect in the path or next to the path of the ball"). Final third = ALL pieces from BOTH teams already positioned in the final-third zone are eligible; when a player is selected, a 6-hex ring is shown AROUND THAT PLAYER (their own movement range), not around the ball — this is a speed optimization since these moves trigger no reaction. Keeper ball-in-box = keeper only, hex-distance ≤ 1 (tighter than dive's 3).

**Notes:** The final-third eligibility answer is a meaningful divergence from the literal RESP-05 wording ("6-hex ring around the ball") — flagged explicitly as D-13 in CONTEXT.md. Header and dive ranges were already settled during the Visual overlays discussion (header 1/2, dive existing 3).

---

## Keeper auto-reposition on final third

| Option                             | Description                                                            | Selected |
| ---------------------------------- | ---------------------------------------------------------------------- | -------- |
| Once, instant on zone entry        | Snap fires immediately on first zone-crossing detection, no re-trigger | ✓        |
| Every re-entry in same possession  | Re-snaps every time the ball re-enters the zone                        |          |
| Animated move, once per possession | Same trigger, but visibly animated rather than instant                 |          |
| Formation/lineup starting position | "Starting position" = existing per-piece formation data                | ✓        |
| Fixed goal-line center hex         | Constant hex regardless of formation                                   |          |

**User's choice:** Instant jump (no animation), fires once per possession on first zone entry, does not re-trigger on subsequent re-entries. Starting position = keeper's formation/lineup starting position. Helper text wording left to Claude's discretion during planning.

---

## Claude's Discretion

- Exact wording of the RESP-06 keeper-repositioning helper text.
- Naming/internal structure of the new `response` highlightType and its priority ordering relative to existing types.
- Whether the −1 badge reuses the existing jersey-number text-rendering approach or is a new pattern.

## Deferred Ideas

None — discussion stayed within phase scope.
