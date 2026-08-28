# Phase 45: Game Summary Popup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 45-game-summary-popup
**Areas discussed:** xG Formula, Possession Calculation, Tackle/Steal Decline & Stats, Icon Placement, xG Coordinate Mapping, HALF_TIME/FULL_TIME Access, Settings Recap Format, HALF_TIME/FULL_TIME Layout Detail

---

## xG Formula

| Option | Description | Selected |
|--------|-------------|----------|
| Claude proposes a formula | Claude designs a reasonable soccer-analytics-inspired formula from the 3 specified inputs | |
| User specifies the formula now | User gives the exact formula/weights verbatim | ✓ |
| Simple placeholder, tune later | Ship a deliberately simple v1 approximation | |

**User's choice:** User specifies the formula now.
**Notes:** User provided the exact formula: `xg = 1 * (1-(D*0.13)) * (1-(C*0.10)) * (1-(ABS(Y-13)>3 ? ABS(Y-13)*0.07 : ABS(Y-13)*0.04)) * (1-(X>3 ? X*0.07 : X*0.04))`, with D = defenders in goal box, C = defenders in penalty box excluding goal box, (X,Y) = shot-hex coordinates. Locked verbatim as D-01 in CONTEXT.md.

---

## Possession Calculation

| Option | Description | Selected |
|--------|-------------|----------|
| Live action-count accumulator | Running counter tied to attackingTeam, incremented per action/MOVE tick | ✓ |
| Derive from eventLog on demand | Compute by scanning eventLog each time popup opens | |

**User's choice:** Live action-count accumulator.
**Notes:** Confirmed to apply to all other whole-match stats too (passes, tackles, shots, fouls, cards), not just possession — consistent with ROADMAP.md Success Criterion 4.

---

## Tackle/Steal Decline & Stats

| Option | Description | Selected |
|--------|-------------|----------|
| Declines don't count as attempts | Matches Phase 43's TACKLE-02 rule; success% denominator only counts duels that rolled dice | ✓ |
| Declines count as a 0-success attempt | A decline lowers success percentage as an automatic failure | |

**User's choice:** Declines don't count as attempts.
**Notes:** None.

---

## Icon Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Scoreboard centre cell, always clickable | (i) icon next to clock/badges, clickable in every phase | |
| Scoreboard, but disabled during active prompts | Same placement, greyed out during interrupt-style phases | |
| (free text) | User described a specific placement not matching either option | ✓ |

**User's choice:** "Top center above the timer: Place a subtle, centered icon directly above the '00:00'. The top portion of the central panel is currently empty, and a small icon here visually establishes 'stats' as a global metric for the entire match rather than tying it to one specific team."
**Notes:** Verified against `GameBoard.module.css` — `.scoreboardCentreCell` is actually content-sized/centered rather than having pre-reserved empty space; captured as an implementation note in D-08 so the planner adds a real new row above `.clockRow` rather than assuming existing whitespace. Always clickable (no phase-gating) confirmed implicitly — not revisited.

---

## xG Coordinate Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Y=r coordinate, X=depth from goal line | Y is raw axial r (formula subtracts 13 to center); X is hex-distance from shooter to near goal line | ✓ |
| Something else — let me clarify | Mapping differs from the recommended reading | |

**User's choice:** Yes — Y=r coordinate, X=depth from goal line.
**Notes:** Confirmed against the board's known geometry (kickoff hex `{q:18, r:13}`, q∈[0,36]/r∈[0,25]).

---

## HALF_TIME/FULL_TIME Access

| Option | Description | Selected |
|--------|-------------|----------|
| Same (i) icon appears on those overlays too | One popup component/icon, reachable from scoreboard and from HALF_TIME/FULL_TIME | |
| Different affordance on HALF_TIME/FULL_TIME | Describe a different mechanism | ✓ (refined below) |

**User's choice:** "The stat display and the half time display are the same. Should be the same structure, content, and format. half time just has the proceed prompts."
**Notes:** This answer prompted a follow-up clarifying question (see "HALF_TIME/FULL_TIME Layout Detail" below) to pin down exactly how the existing score-row header and the new stats content coexist.

---

## Settings Recap Format

| Option | Description | Selected |
|--------|-------------|----------|
| All 6 match-rule toggles | Fouls, Booking, Injury, OOB, Referee Leniency (+value), Tackle/Steal Decline | (implied, see notes) |
| Game Speed | Also show selected match speed | (not selected) |
| Team/formation info | Also show teams/formations/uniform styles | (not selected) |

**User's choice:** Free text — "in row text summary of settings. i.e. (fouls: off) (bookings: active) etc"
**Notes:** Format locked as inline parenthetical toggle:state pairs (D-12). Content scope inferred as the 6 match-rule toggles only (D-13) since the user's own examples only referenced match-rule toggles; Game Speed and team/formation info explicitly excluded per Claude's discretion (not requested).

---

## HALF_TIME/FULL_TIME Layout Detail

| Option | Description | Selected |
|--------|-------------|----------|
| Replace the overlay body with the stats popup content | Existing big-badge score-row visual is replaced entirely by the match-summary content | |
| Keep the existing score-row header, add stats below it | Current header stays as-is at top; full stats content appended below it | ✓ |

**User's choice:** Keep the existing score-row header, add stats below it.
**Notes:** Locked as D-10/D-11 — one shared `MatchSummaryContent` block consumed by both the on-demand modal and an appended section inside the existing HALF_TIME/FULL_TIME overlay card.

---

## Claude's Discretion

- Exact GameState field shapes for new whole-match counters (possession, passes, tackles, shots, fouls, cards) — follow the `subsUsed` sibling-counter precedent; per-site instrumentation audit deferred to planning.
- (i) icon visual/CSS treatment (size, glyph, hover state) — no asset specified.
- Popup modal chrome (open/close mechanics, backdrop, dismiss) — follow existing modal patterns (e.g. Phase 42's substitution modal).
- Live-updating vs. snapshot-on-open popup content — defaulted to live-updating (state is already broadcast on every action).
- Goal-box/penalty-box hex-membership check implementation — translate `PitchMarkings.tsx`'s existing pixel-space boundaries into an axial hex-membership helper.

## Deferred Ideas

None — discussion stayed within phase scope. The user noted they will provide 3 reference images during the downstream UI-design step (`/gsd-ui-phase`) to influence the popup's visual design — captured as a specifics note in CONTEXT.md for whoever runs that step, not resolved now.

Three pending todos were reviewed via `cross_reference_todos` (KICK_OFF_SETUP shading bug, offside-ring-after-goal bug, no-auto-reselect-after-interrupt UX gap) — all weak keyword-only matches (score 0.6), all unrelated to the match-summary popup, none folded. All three remain tagged to Phase 46.
