# Phase 39: Fouls, Cards, Injuries & Penalty Kicks - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A tackle, steal, or GK-dive-at-feet roll of 1 always resolves injury and booking before the attacker's continue-or-restart choice, with Professional Fouls, GK-dive-at-feet, and penalty kicks fully modeled — each of Fouls, Booking, and Injury independently toggleable at game creation. Covers FOUL-01..05, CARD-01..04, INJURY-01..04, GKDIVE-01..05, PEN-01..03, FK-01, SETTINGS-01..03. Depends on Phase 38 (Corner Kick). Does not build Substitutions (Phase 40) — a second injury with no substitute available always falls back to degraded attributes this phase.

Scope was explicitly expanded twice during discussion, both confirmed directly by the user (not Claude's inference):

1. A new GK-positioning capability — "ball first enters the penalty box → GK 1-hex response move" — not covered by any locked GKDIVE requirement, built now per user direction.
2. Two unrelated bug fixes (loose-ball log direction/distance-roll, second-half-start both-team acknowledgement) riding along in this phase's plan per user direction, despite being outside the fouls/cards/injuries/penalties domain.

</domain>

<decisions>
## Implementation Decisions

### Foul resolution & restart choice

- **D-01:** The attacker's "continue play or take the restart" choice (FOUL-03) is a **new dedicated two-button panel** ("Continue Play" / "Take the Free Kick"), appearing after injury/booking results are shown. No existing "advantage" choice mechanic exists in the codebase to reuse — offside currently auto-triggers `FREE_KICK_SETUP` with no manager choice at all, so this is a genuinely new UI pattern. Follow Phase 35's panel-family conventions (no container border, two-line title+detail text) per the established default.
- **D-02:** Roll display sequencing: **logs always, banners only when there's an impact on play.** Every dice roll (foul detection, injury check, booking check) gets an ActionLog entry with die results regardless of outcome. Transient banners (EventBanner pattern, used today for goals) appear only for: (1) foul called — always, (2) injury — only if the injury check actually results in an injury, (3) booking — only if a card is actually issued. Sequence: foul banner → injury banner (if any) → booking banner (if any) → D-01's continue/restart panel.
- **D-03:** A **card-color badge** (a small rectangle matching the card color — yellow/red) is part of every booking banner, reflecting the color of the card actually being assigned. When the card results from a Professional (Last Man) Foul's straight-red-vs-yellow check (FOUL-04/CARD-03), the banner additionally displays a **"DOGSO"** label alongside the colored badge, distinguishing it from a normal booking roll. No other visual difference between a Professional Foul's booking flow and a normal one — same banner sequence and panel shape (D-02), just the added badge + label.

### Cards & injuries — visual indicators

- **D-04:** Cards and injuries both get **persistent on-board badges AND a roster/lineup panel indicator** (not one or the other) — visible for the rest of the match once assigned.
- **D-05:** On-board sizing/placement: badges render **the same size as the existing ball-possession indicator** (`PieceOverlay.tsx`'s directional soccer-ball dot, `PIECE_RADIUS * 0.59`), positioned in the **corner of the piece opposite the ball-possession dot**. Card badge = a rectangle in the card's color (yellow/red). Injury badge = a plus-sign icon, visually distinct from the card badge. If a player is both booked and injured, the **injury icon layers on top of the card icon** (injury icon is drawn last/uppermost).
- **D-06:** INJURY-03's "second injury forces a substitution, or degraded attributes if none available" — since Phase 40 (Substitutions) doesn't exist yet when Phase 39 ships, **Phase 39 always takes the "no substitute available" branch**: a second injury always leaves the player at degraded attributes. Phase 40 later adds the actual forced-substitution trigger that reads this same injury state (per ROADMAP.md's noted soft dependency) — Phase 39 does not need to build any stub/hook for this.

### GK dive-at-feet & penalty kick flow

- **D-07:** GKDIVE-02's repeating "interrupt opportunity" is offered via an **explicit prompt every qualifying step** — every time the carrier's move ends within 3 hexes of the GK, parallel to the goal line, a panel prompts the defending manager "Dive at feet?" Yes/No. Mirrors the existing tackle/steal opt-in pattern (defenders already choose whether to attempt those).
- **D-08:** PEN-02's "both teams freely reposition" before a penalty kick follows the **same turn-based sequential window Corner Kick already established** (GoalKickSetupPanel-style turn order: attacking manager's team, then defending manager's team), applied to the full remaining squad rather than 2-piece batches. Not a free-drag/simultaneous mechanic like Kick-Off setup.
- **D-09:** GKDIVE-05's "at most once per movement cycle (4-5-2)" cap is **extended to also cover the existing shot-block `GK_DIVE` repositioning phase**: if the GK's team uses their dive-at-feet interrupt during a movement cycle, the GK is **disabled from diving to block a shot** (the existing `GK_DIVE` repositioning window) during that same movement cycle. These two GK actions now share one cap.
- **D-10 (scope expansion, explicitly confirmed by user):** New capability — **"ball first enters the penalty box → GK 1-hex response move."** The first time the ball enters the `homePenaltyArea`/`awayPenaltyArea` region (`packages/shared/src/pitch.ts:82-83`) during a movement cycle, by any means (pass, shot, move, or loose ball), the defending manager gets a **prompted choice** to move their GK 1 hex (to any of the up to 6 adjacent legal hexes) or decline — mirrors the dive-at-feet prompt pattern (D-07). This is **not** the existing shot-declared `GK_DIVE` phase (`packages/server/src/gameEngine.ts`, "GK's team repositions GK interactively" after a shot is declared) — it triggers on mere ball entry into the box, regardless of shot intent.
- **D-11:** This new box-entry response move has **its own independent once-per-movement-cycle cap**, separate from D-09's shared dive-at-feet/shot-block-dive cap. A GK could use the box-entry response move AND still be eligible for dive-at-feet AND shot-block dive in the same cycle (subject to D-09's constraint between those latter two).

### Settings toggle UI

- **D-12:** The 3 new toggles (Fouls, Booking, Injury) reuse `GameSettingsScreen.tsx`'s existing Out-of-Bounds/Restarts checkbox pattern exactly (same section/row markup).
- **D-13:** Booking and Injury checkboxes **visually grey out (disabled state)** whenever Fouls is unchecked, mirroring the existing Draft Pool disabled-checkbox pattern (`SELECTABLE_DRAFT_POOLS`, Legends/Icons) already in `GameSettingsScreen.tsx` — not just functionally inert while still clickable.
- **D-14:** **All 4 toggles now default ON** for a new game: Fouls, Booking, Injury (new) **and** Out-of-Bounds/Restarts (existing). This is an explicit, confirmed change to Phase 37's existing `outOfBounds` default-off behavior (`GameSettingsScreen.tsx:42`, currently `useState<boolean>(false)` with a "safe default" comment) — not just the 3 new Phase 39 toggles.

### Bug fixes riding along in this phase (scope expansion, explicitly confirmed by user)

- **D-15:** Fix the loose-ball log: `LOOSE_BALL_LAND` (`packages/shared/src/types.ts:356-362`) currently only carries `from`/`to` hex coordinates — no direction or distance-die value exists on the event at all. Extend the event with the direction and distance-die value actually used by `computeLooseBall`, and update `ActionLog.tsx`'s `LOOSE_BALL_LAND` formatting (currently just `${from.q},${from.r} → ${to.q},${to.r}`, `ActionLog.tsx:723-729`) to show them alongside the existing coordinates.
- **D-16:** Fix second-half-start: today only the non-kickoff team's manager can click Start (`GameBoard.tsx:225`, `canStart = myTeam !== null && myTeam !== kickOffTeam`, D-28) while the other team sees a non-actionable button. Change to a **mutual "both teams confirm" gate**, mirroring the existing `LINEUP_CONFIRM` parallel-confirm pattern (Phase 29 D-25: "either player may confirm first") rather than building a new mechanism.

### Explicitly reconsidered, no change

- The referee's `leniency` attribute (`RefereeCard`, `gameEngine.ts:372`, currently a single `randomInt(1, 7)` roll at match start, also feeding added-time calculation) — user considered switching this to a 2d6-take-highest roll but **reconsidered and confirmed to leave it as-is**. Do not change this.

### Claude's Discretion

- Exact SVG/CSS implementation of the card-color badge and DOGSO label on banners (D-03).
- Exact `GamePhase`/`GameState` field naming for the new Foul/Booking/Injury/GK-Dive/Penalty-Kick chains, following the established `GOAL_KICK_*`/`CORNER_KICK_*` naming convention precedent.
- Internal code organization for the new box-entry response-move mechanic (D-10/D-11), so long as it is presented and capped independently as decided.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` (FOUL-01..05, CARD-01..04, INJURY-01..04, GKDIVE-01..05, PEN-01..03, FK-01, SETTINGS-01..03 sections, lines 10-46, 94-97) — locked requirement text for this phase
- `.planning/ROADMAP.md` (Phase 39 section, lines 336-350) — phase goal, 5 success criteria, dependency on Phase 38
- `.planning/STATE.md` — v1.6 "Decisions Locked" section and general per-event-type Undo/Replay registration pitfall (applies to any new `ActionEvent` types this phase introduces, e.g. the extended `LOOSE_BALL_LAND` in D-15)

### Prior-phase precedent (structural templates explicitly reused again)

- `.planning/phases/38-corner-kick/38-CONTEXT.md` D-03/D-05 — the turn-based sequential GK/team reposition pattern D-08 explicitly re-applies to penalty-kick repositioning
- `.planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-CONTEXT.md` D-01/D-02 — the "new dedicated chain per restart type, reuse only pure helpers" precedent, applicable to the new Foul/Booking/Injury/Penalty-Kick `GamePhase` chains

### Existing code (referee/leniency, penalty area, GK_DIVE, response patterns)

- `packages/server/src/gameEngine.ts:370-373, 1194-1197` — `refereeCard.leniency` assignment (`randomInt(1, 7)`) and its added-time usage; confirmed unchanged (see "Explicitly reconsidered" above)
- `packages/server/src/gameEngine.ts:890-1029` — `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` resolution (`dice.stealDie`/`dice.tackleDie`/`dice.carrierDie`), the exact hook point for FOUL-01's "defender's own die shows exactly 1" trigger
- `packages/shared/src/pitch.ts:51-52, 73-83` — `homePenaltyArea`/`awayPenaltyArea` region definitions, the zone D-10's box-entry trigger reads
- `packages/server/src/gameEngine.ts` (`GK_DIVE` phase, e.g. lines 2714-3198, 5872-5893, 6094-6099) — existing shot-declared GK repositioning phase; D-10's new box-entry response move is explicitly a **different** mechanic from this
- `packages/shared/src/types.ts:77-79` — `RefereeCard`/`leniency` type definition
- `packages/shared/src/types.ts:17-26` — `PlayerAttributes` shape including `resilience` (INJURY-01's threshold attribute) and `tackling`/`dribbling`/`saving` (dive-at-feet duel attributes)

### Reference patterns for new UI (settings toggles, both-confirm gate, card badges)

- `packages/client/src/components/GameSettingsScreen.tsx` (full file) — Out-of-Bounds/Restarts checkbox pattern (D-12/D-13/D-14 target), and `SELECTABLE_DRAFT_POOLS` disabled-checkbox precedent (D-13)
- STATE.md "[Phase 29]" entries — `LINEUP_CONFIRM` parallel both-confirm gate pattern (D-25), the direct template for D-16's second-half-start fix
- `packages/client/src/components/PieceOverlay.tsx:212-224` — existing directional ball-possession indicator (`dotOffsetX`/`dotOffsetY`, `PIECE_RADIUS * 0.59`), the sizing/positioning template for D-05's card/injury badges
- `packages/client/src/components/ActionLog.tsx:723-729` — current `LOOSE_BALL_LAND` formatting, the target of D-15's fix

No other external specs/ADRs apply beyond the above — requirements are fully captured in the Decisions section.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `FREE_KICK_SETUP` flow (`packages/shared/src/types.ts:118-124, 601, 1168-1206`) — FK-01 explicitly reuses this existing flow for tackle/steal-sourced fouls (not GK-dive-at-feet fouls, which award a penalty per GKDIVE-03/PEN-01).
- `computeCombinedScore` (`scoreUtils.ts`) — the duel-scoring function already used for tackle/steal/header; PEN-01's -2 GK dice penalty and GKDIVE's -1 dice penalty extend this same pattern.
- EventBanner transient-banner pattern (used today for goals) — direct template for D-02's foul/injury/booking banner sequence.
- Corner Kick's turn-based sequential reposition window (`GoalKickSetupPanel.tsx`-style) — direct template for D-08's penalty-kick repositioning and D-07/D-10's prompt-based interrupt patterns.
- `LINEUP_CONFIRM` parallel-confirm gate (Phase 29 D-25) — direct template for D-16's second-half-start both-team-acknowledgement fix.

### Established Patterns

- `isProcessing` mutex + phase-guard + pure-function-delegate shape for every socket handler (`gameHandlers.ts`) — new Foul/Booking/Injury/GK-Dive/Penalty-Kick handlers should follow this exactly.
- Per-event-type registration required for Undo/Replay (recurring pitfall noted across Phases 37/38) — applies to every new `ActionEvent` type this phase introduces, including D-15's extended `LOOSE_BALL_LAND`.
- Disabled-checkbox-when-dependency-off pattern already exists (`SELECTABLE_DRAFT_POOLS`) — direct template for D-13.

### Integration Points

- `packages/server/src/gameEngine.ts:890-1029` — `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` resolution branches; FOUL-01's die-of-1 check hooks in here.
- `packages/client/src/components/GameBoard.tsx` — per-phase panel dispatch; needs new cases for whatever new `GamePhase` values this phase introduces (foul choice, injury/booking banners, GK-dive prompts, box-entry prompt, penalty-kick setup).
- `packages/client/src/components/GameSettingsScreen.tsx` — `onConfirm` settings bundle needs 3 new boolean fields (fouls, booking, injury) alongside the existing `outOfBounds` field.
- `packages/client/src/components/PieceOverlay.tsx:212-224` — card/injury badge rendering integrates here, opposite-corner from the existing ball-possession dot.

</code_context>

<specifics>
## Specific Ideas

- Card badge = colored rectangle (yellow/red matching the card), injury badge = plus-sign icon; both same size as the ball-possession dot; injury layers over card when both apply (D-05).
- Booking banners always show the card-color badge; Professional Foul bookings additionally show a "DOGSO" label (D-03).
- The referee-leniency-roll change (2d6-take-highest) was considered and explicitly un-decided — left exactly as it is today.

</specifics>

<deferred>
## Deferred Ideas

None — all scope-adjacent ideas raised during discussion (the box-entry GK response move, the two bug fixes) were explicitly pulled into this phase's scope by the user rather than deferred; see D-10/D-15/D-16.

### Reviewed Todos (not folded)

- **`2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`** — matched Phase 39 by generic keyword overlap only (score 0.6, same recurring pattern seen matching Phases 31/35/36/37/38 previously). Not raised or discussed this session; a rendering defect unrelated to this phase's scope.
- **`2026-08-09-bug-offside-ring-after-goal.md`** — matched by generic keyword overlap only (score 0.6). Not raised or discussed this session; a rendering defect unrelated to this phase's scope.
- **`csv-consolidation-player-pool.md`** — matched by generic keyword overlap only (score 0.6). Not raised or discussed this session; a data-pipeline idea unrelated to this phase's scope.

</deferred>

---

_Phase: 39-Fouls, Cards, Injuries & Penalty Kicks_
_Context gathered: 2026-08-09_
