# Phase 27: Response Activation Model - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase covers the **pre-challenge positioning/movement step** for all response move types: HEADER (contestant positioning), DEFLECT (SNAP_DEFLECT), FINAL THIRD, DIVE (GK_DIVING), and keeper ball-in-box. It unifies each type's positioning UX to a single-selection model (select eligible piece → white range hexes with optional −1 penalty badges → click destination → move, mark activated), adds a ball-hex highlight during response phases, and adds keeper auto-repositioning on final-third entry.

**Explicitly out of scope:** the actual contest/duel resolution logic (dice rolls, winner determination, target selection after a header duel, save mechanics) for any of these response types. That logic is unchanged — this phase only replaces how a responding piece gets selected and positioned before resolution happens.

</domain>

<decisions>
## Implementation Decisions

### Resolution timing (positioning-only scope)

- **D-01:** This phase implements positioning/movement selection only. Existing downstream contest/duel/resolution logic for HEADER, DEFLECT, DIVE, and keeper ball-in-box is unchanged — do not touch resolution mechanics, only the selection→movement step that precedes them.
- **D-02:** HEADER: each side (attacker, then defender) gets a single-selection movement turn — eligible pieces highlighted, selecting one shows in-range header hexes, selecting a hex moves the piece and hands off to the other side. Once both sides have positioned, the existing duel/target-selection flow proceeds exactly as it does today (GAME_HEADER_CONTESTANT / duel / GAME_HEADER_TARGET logic untouched).
- **D-03:** DEFLECT is one-sided: only the defender gets a positioning turn (single-select, move within range). The deflect dice roll fires immediately after that move — no hand-off, no confirm button.
- **D-04:** FINAL THIRD has no auto-resolve at all. It behaves exactly like a MOVEMENT phase: select an eligible piece, move it within its per-player range, mark it activated, allow undo, End Turn once all eligible pieces have moved (or been skipped).
- **D-05:** DIVE (GK_DIVING) and keeper ball-in-box keep today's defer-to-later-event resolution model (single click sets position now; dice resolution happens at the next triggering event, e.g. shot resolution) — this matches the existing `applyGKDive` pattern and needs no resolution-timing change, only the shared visual/eligibility treatment below.

### Visual overlays

- **D-06:** New `response` highlightType: white hex fill for all valid response destinations (replaces/extends the existing `HexHighlightType` set in `HexCell.tsx`).
- **D-07:** Hexes that incur a challenge penalty render a small "−1" text badge on top of the white fill (not a color-tint variant, not an icon).
- **D-08:** Penalty rule is type-specific and distance-based from the responding piece's destination hex:
  - HEADER: hexes at distance 1 from the ball are clean (no badge); hexes at distance 2 (max header range) get the −1 badge.
  - DIVE: hexes at distance 3 (the existing outer edge of the GK dive range) get the −1 badge; distances 1–2 are clean. This is the same penalty already implemented via `validateGKDive` — this phase adds the matching visual, not new penalty logic.
  - DEFLECT, FINAL THIRD, GK ball-in-box: no penalty — all eligible hexes render as plain white, no badge.
- **D-09:** RESP-09 ball-hex highlight: a distinct gold/yellow ring/outline highlightType applied to the single hex containing the ball, layered so it renders under the BallMarker. Static (no pulse/animation). Shown during all response phases (header, deflect, dive, final third, GK ball-in-box).

### Eligibility ranges per response type

- **D-10:** HEADER: eligible responders are pieces within hex-distance 2 of the ball (distance 1 = clean, distance 2 = −1 penalty per D-08).
- **D-11:** DIVE: unchanged, hex-distance ≤ 3 from GK's current position (existing `TOO_FAR` guard in `applyGKDive`), with −1 penalty visual at distance 3.
- **D-12:** DEFLECT: eligible defenders are those who can legally move to a hex on-or-adjacent to the shot-path line (`hexLine(shotOrigin, shotTargetHex)`), within hex-distance 3 of any point on that line. No penalty tiering — flat eligible/white.
- **D-13:** FINAL THIRD: **diverges from the literal ROADMAP/RESP-05 wording.** The "6-hex ring" is NOT a fixed ring around the ball — it is a per-player movement range shown around whichever piece is currently selected (i.e., normal per-piece movement range, same shape as a MOVEMENT phase). All pieces from BOTH teams already positioned within the final-third zone are eligible to be selected and moved this way (not defending team only). This is a speed optimization for the movement phase since these moves trigger no reaction/contest.
- **D-14:** Keeper ball-in-box: keeper only, hex-distance ≤ 1 from current position (tighter than dive's 3-hex range). No penalty tiering.

### Keeper auto-reposition on final third (RESP-06)

- **D-15:** Trigger: fires once, the instant the ball first enters the final-third zone (zone-crossing detection, same category of check as existing `ballZone` crossing logic used for offside). Does NOT re-trigger on subsequent re-entries within the same possession — once-per-possession only.
- **D-16:** Reposition is an instant jump (no animation), consistent with other snap-back mechanics already in the codebase (e.g. KICK_OFF_SETUP snap-back).
- **D-17:** "Starting position" = the keeper's formation/lineup starting position (existing per-piece formation data), not a fixed goal-line-center constant.
- **D-18:** Keeper is excluded from the final-third eligible-player count for the duration of that response phase (per RESP-06). Helper text wording for the action panel is Claude's discretion during planning — keep it short, consistent with existing helper-text style (e.g. kick-off helper copy in ActionPanel).

### Claude's Discretion

- Exact wording of the RESP-06 keeper-repositioning helper text (D-18).
- Naming/internal structure of the new `response` highlightType and its priority ordering relative to existing types (`risk > goal > shot-path > kickoff > safe`) — research/planning should determine where `response` and the new ball-hex ring sit in that precedence.
- Whether the −1 badge is a new SVG `<text>` element pattern or reuses an existing text-rendering approach (e.g. jersey number rendering) — implementation detail for planning.

### Post-research clarifications (resolved 2026-07-18, after RESEARCH.md open questions)

- **D-19 (keeper ball-in-box trigger):** Fires on any ball entry into the penalty area (zone-crossing detection, same category as the final-third crossing check in D-15) — not restricted to `LOOSE_BALL` landings. Applies to whichever penalty area (home/away) is relevant to the defending keeper.
- **D-20 (deflect eligibility vs. movement budget):** D-12's hex-distance-3-from-shot-path-line is an eligibility filter only (which defenders/hexes are shown as valid). It does not replace the existing 2-hex movement pace cap — actual move distance from a defender's start hex stays capped at 2.
- **D-21 (final third turn order):** Attacker moves all desired eligible pieces first (each a single-select move, mark activated, End Turn/pass when done), then hands off to the defender who does the same. Sequential single-sided turns, not free-for-all interleaving and not per-piece HEADER-style alternation.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — RESP-01 through RESP-09 (lines 10–18), status table (lines 74–82)
- `.planning/ROADMAP.md` §"Phase 27: Response Activation Model" (lines 126–139) — goal, success criteria, depends-on Phase 26

### Prior phase decisions (highlight system, referenced during discussion)

- `.planning/STATE.md` — Decisions Locked (Phase 12 P04): D-10 highlightType enum pattern, D-11 tint-only overlay folding, D-12 highlightType priority order (`risk > goal > shot-path > kickoff > safe`), D-13 white-tint precedent for header-non-goal-target overlays

No other external specs/ADRs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/client/src/components/HexCell.tsx` (~lines 6–60) — `HexHighlightType` enum + `HIGHLIGHT_STYLES` table; extend with new `response` (white) and ball-hex-ring types.
- `packages/client/src/components/HexGrid.tsx` (~line 433) — existing highlight priority-resolution ternary (`risk > goal > shot-path > kickoff > safe`); new types need to be inserted into this precedence.
- `packages/server/src/gameEngine.ts` `applyGKDive` (~lines 3746–3794) — reference implementation for single-selection positioning: phase guard, `NOT_ON_PATH` (via `hexLine`), `TOO_FAR` (`hexDistance > 3`), `OFF_PITCH`. Deflect/header eligibility checks should follow the same validation shape.
- `packages/server/src/gameEngine.ts` (~lines 2018–2065) — existing auto-skip pattern: checks `homeEligible`/`awayEligible` via `hexDistance <= 2`; if neither eligible, routes to `LOOSE_BALL`; if only one side eligible, auto-sets that side's confirmation. Directly reusable template for RESP-08 auto-skip logic across all response types.
- `packages/client/src/components/HexGrid.tsx` (~lines 662–675) — GK piece live-reposition-on-selection rendering; pattern to mirror for other response types' selected-piece rendering.

### Established Patterns

- MOVEMENT-phase selection model (select piece → highlight range → click destination → mark activated, `movedPieceIds`, pace tracking, undo support) is the target pattern for HEADER positioning and FINAL THIRD (per D-02, D-04, D-13) — reuse this shape rather than inventing a new one.
- KICK_OFF_SETUP snap-back is the precedent for instant (non-animated) piece repositioning (D-16).

### Integration Points

- HEADER currently transitions through `phase 'HEADER'` with `headerContestants`, `headerConfirmed`, `headerTargetHex`, `headerAccuracyRollPending` (gameEngine.ts ~line 2052) and client events `GAME_HEADER_ACCURACY_ACK`, `GAME_HEADER_CONTESTANT`, `GAME_HEADER_TARGET` (gameHandlers.ts ~2281–2492). This phase replaces only the contestant-selection lead-in; the duel/target machinery downstream stays wired to the same state fields.
- SNAP_DEFLECT: logged via `SNAP_DEFLECT_MOVE` (gameHandlers.ts ~460) — needs a full read during research/planning, not yet deeply inspected.
- No existing "final third" phase/zone-check was found under that literal name during scouting — research should confirm whether final-third zone detection already exists (e.g. reused from offside `ballZone` logic) or needs to be added.

</code_context>

<specifics>
## Specific Ideas

- The −1 badge should look similar to how jersey numbers currently render on pieces (small SVG text overlay) — user's framing during discussion, not a strict requirement.
- Ball-hex ring color: gold/yellow, distinct from existing highlight colors (green=safe, orange=risk, etc.).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)

None — no matching todos were surfaced during cross-reference.

</deferred>

---

_Phase: 27-response-activation-model_
_Context gathered: 2026-07-17_
