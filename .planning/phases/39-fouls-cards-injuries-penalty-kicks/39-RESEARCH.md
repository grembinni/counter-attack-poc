# Phase 39: Fouls, Cards, Injuries & Penalty Kicks - Research

**Researched:** 2026-08-09
**Domain:** Server-authoritative hex-grid football FSM extension (Node/Socket.io + React/Zustand), rule-fidelity milestone
**Confidence:** HIGH — every claim below is grounded in direct inspection of the current committed source (file:line citations against the _actual_ Phase 37/38-complete codebase, not the pre-Phase-37 research docs). A few implementation-shape items are marked `[ASSUMED]` where the codebase has no direct precedent.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The attacker's "continue play or take the restart" choice (FOUL-03) is a **new dedicated two-button panel** ("Continue Play" / "Take the Free Kick"), appearing after injury/booking results are shown. No existing "advantage" choice mechanic exists in the codebase to reuse — offside currently auto-triggers `FREE_KICK_SETUP` with no manager choice at all, so this is a genuinely new UI pattern. Follow Phase 35's panel-family conventions (no container border, two-line title+detail text) per the established default.
- **D-02:** Roll display sequencing: **logs always, banners only when there's an impact on play.** Every dice roll (foul detection, injury check, booking check) gets an ActionLog entry with die results regardless of outcome. Transient banners (EventBanner pattern, used today for goals) appear only for: (1) foul called — always, (2) injury — only if the injury check actually results in an injury, (3) booking — only if a card is actually issued. Sequence: foul banner → injury banner (if any) → booking banner (if any) → D-01's continue/restart panel.
- **D-03:** A **card-color badge** (a small rectangle matching the card color — yellow/red) is part of every booking banner, reflecting the color of the card actually being assigned. When the card results from a Professional (Last Man) Foul's straight-red-vs-yellow check (FOUL-04/CARD-03), the banner additionally displays a **"DOGSO"** label alongside the colored badge, distinguishing it from a normal booking roll. No other visual difference between a Professional Foul's booking flow and a normal one — same banner sequence and panel shape (D-02), just the added badge + label.
- **D-04:** Cards and injuries both get **persistent on-board badges AND a roster/lineup panel indicator** (not one or the other) — visible for the rest of the match once assigned.
- **D-05:** On-board sizing/placement: badges render **the same size as the existing ball-possession indicator** (`PieceOverlay.tsx`'s directional soccer-ball dot, `PIECE_RADIUS * 0.59`), positioned in the **corner of the piece opposite the ball-possession dot**. Card badge = a rectangle in the card's color (yellow/red). Injury badge = a plus-sign icon, visually distinct from the card badge. If a player is both booked and injured, the **injury icon layers on top of the card icon** (injury icon is drawn last/uppermost).
- **D-06:** INJURY-03's "second injury forces a substitution, or degraded attributes if none available" — since Phase 40 (Substitutions) doesn't exist yet when Phase 39 ships, **Phase 39 always takes the "no substitute available" branch**: a second injury always leaves the player at degraded attributes. Phase 40 later adds the actual forced-substitution trigger that reads this same injury state (per ROADMAP.md's noted soft dependency) — Phase 39 does not need to build any stub/hook for this.
- **D-07:** GKDIVE-02's repeating "interrupt opportunity" is offered via an **explicit prompt every qualifying step** — every time the carrier's move ends within 3 hexes of the GK, parallel to the goal line, a panel prompts the defending manager "Dive at feet?" Yes/No. Mirrors the existing tackle/steal opt-in pattern (defenders already choose whether to attempt those).
- **D-08:** PEN-02's "both teams freely reposition" before a penalty kick follows the **same turn-based sequential window Corner Kick already established** (GoalKickSetupPanel-style turn order: attacking manager's team, then defending manager's team), applied to the full remaining squad rather than 2-piece batches. Not a free-drag/simultaneous mechanic like Kick-Off setup.
- **D-09:** GKDIVE-05's "at most once per movement cycle (4-5-2)" cap is **extended to also cover the existing shot-block `GK_DIVE` repositioning phase**: if the GK's team uses their dive-at-feet interrupt during a movement cycle, the GK is **disabled from diving to block a shot** (the existing `GK_DIVE` repositioning window) during that same movement cycle. These two GK actions now share one cap.
- **D-10 (scope expansion, explicitly confirmed by user):** New capability — **"ball first enters the penalty box → GK 1-hex response move."** The first time the ball enters the `homePenaltyArea`/`awayPenaltyArea` region (`packages/shared/src/pitch.ts:82-83`) during a movement cycle, by any means (pass, shot, move, or loose ball), the defending manager gets a **prompted choice** to move their GK 1 hex (to any of the up to 6 adjacent legal hexes) or decline — mirrors the dive-at-feet prompt pattern (D-07). This is **not** the existing shot-declared `GK_DIVE` phase — it triggers on mere ball entry into the box, regardless of shot intent.
- **D-11:** This new box-entry response move has **its own independent once-per-movement-cycle cap**, separate from D-09's shared dive-at-feet/shot-block-dive cap. A GK could use the box-entry response move AND still be eligible for dive-at-feet AND shot-block dive in the same cycle (subject to D-09's constraint between those latter two).
- **D-12:** The 3 new toggles (Fouls, Booking, Injury) reuse `GameSettingsScreen.tsx`'s existing Out-of-Bounds/Restarts checkbox pattern exactly (same section/row markup).
- **D-13:** Booking and Injury checkboxes **visually grey out (disabled state)** whenever Fouls is unchecked, mirroring the existing Draft Pool disabled-checkbox pattern (`SELECTABLE_DRAFT_POOLS`, Legends/Icons) already in `GameSettingsScreen.tsx` — not just functionally inert while still clickable.
- **D-14:** **All 4 toggles now default ON** for a new game: Fouls, Booking, Injury (new) **and** Out-of-Bounds/Restarts (existing). This is an explicit, confirmed change to Phase 37's existing `outOfBounds` default-off behavior (`GameSettingsScreen.tsx:42`, currently `useState<boolean>(false)`) — not just the 3 new Phase 39 toggles.
- **D-15:** Fix the loose-ball log: `LOOSE_BALL_LAND` (`packages/shared/src/types.ts:356-362`) currently only carries `from`/`to` hex coordinates — no direction or distance-die value exists on the event at all. Extend the event with the direction and distance-die value actually used by `computeLooseBall`, and update `ActionLog.tsx`'s `LOOSE_BALL_LAND` formatting (currently just `${from.q},${from.r} → ${to.q},${to.r}`, `ActionLog.tsx:723-729`) to show them alongside the existing coordinates.
- **D-16:** Fix second-half-start: today only the non-kickoff team's manager can click Start (`GameBoard.tsx:225`, `canStart = myTeam !== null && myTeam !== kickOffTeam`, D-28) while the other team sees a non-actionable button. Change to a **mutual "both teams confirm" gate**, mirroring the existing `LINEUP_CONFIRM` parallel-confirm pattern (Phase 29 D-25: "either player may confirm first") rather than building a new mechanism.
- **Explicitly reconsidered, no change:** The referee's `leniency` attribute (`RefereeCard`, `gameEngine.ts:372`, currently a single `randomInt(1, 7)` roll at match start, also feeding added-time calculation) — user considered switching this to a 2d6-take-highest roll but **reconsidered and confirmed to leave it as-is**. Do not change this.

### Claude's Discretion

- Exact SVG/CSS implementation of the card-color badge and DOGSO label on banners (D-03).
- Exact `GamePhase`/`GameState` field naming for the new Foul/Booking/Injury/GK-Dive/Penalty-Kick chains, following the established `GOAL_KICK_*`/`CORNER_KICK_*` naming convention precedent.
- Internal code organization for the new box-entry response-move mechanic (D-10/D-11), so long as it is presented and capped independently as decided.

### Deferred Ideas (OUT OF SCOPE)

None — all scope-adjacent ideas raised during discussion (the box-entry GK response move, the two bug fixes) were explicitly pulled into this phase's scope by the user rather than deferred; see D-10/D-15/D-16. Three unrelated todos were reviewed and NOT folded into this phase (matched by generic keyword overlap only, not discussed this session): a KICK_OFF_SETUP shot-path shading bug, an offside-ring-after-goal rendering bug, and a CSV-consolidation data-pipeline idea.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID          | Description                                                                                                                              | Research Support                                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FOUL-01     | Tackle/steal defender's own die === 1 calls a foul (nutmeg excluded — not a v1.6 trigger)                                                | Architecture Pattern 1; Code Examples ("FOUL-01 hook point"); `gameEngine.ts:895-1049` die extraction confirmed in scope                                     |
| FOUL-02     | Foul immediately rolls injury (if enabled) then booking (if enabled), before attacker's choice                                           | Architecture Pattern 1 (inline sub-resolution, no forced phase transition); Pitfall 1 (EventBanner must process all 3 chained events)                        |
| FOUL-03     | Attacking manager chooses continue play or take the restart                                                                              | Architecture diagram; Pattern 3 panel-family CSS convention confirmed (`GoalKickSetupPanel.module.css`/`FreeKickSetupPanel.module.css`)                      |
| FOUL-04     | Professional (Last Man) Foul → straight red-vs-yellow check instead of normal booking roll                                               | Pitfall 5 (reachability algorithm — highest implementation risk, no direct precedent)                                                                        |
| FOUL-05     | Fouls toggle gates detection/injury/GK-dive-at-feet/professional-foul/restart                                                            | Don't-hand-roll table; Settings section of Architectural Responsibility Map                                                                                  |
| CARD-01     | Booking: die ≥ referee Leniency issues yellow; no effect if Fouls disabled                                                               | Pitfall 2 (inverted-comparison-direction trap); Pitfall 6 (new data model needed)                                                                            |
| CARD-02     | Second yellow → red, no substitute replacement                                                                                           | Pitfall 6 (new `yellowCards`/`redCarded` fields needed on `PlayerPiece`)                                                                                     |
| CARD-03     | Professional Foul rolls directly red-vs-yellow instead of normal roll                                                                    | State of the Art (REQUIREMENTS.md now resolves the "always-straight-red vs. modified-roll" ambiguity STATE.md flagged)                                       |
| CARD-04     | Booking toggle independent of Fouls/Injury/Out-of-Bounds                                                                                 | Architectural Responsibility Map (Settings row); mirrors existing `outOfBoundsEnabled` two-step plumbing                                                     |
| INJURY-01   | Die ≥ fouled player's Resilience injures them                                                                                            | Pitfall 2 (flat comparison, not `computeCombinedScore`); Assumption A1 (fresh die vs. reused die)                                                            |
| INJURY-02   | Injured player's attributes -1, floored at 1, rest of match                                                                              | Pitfall 6 / Assumption A2 (penalty-array threading vs. raw-attribute mutation — real design fork)                                                            |
| INJURY-03   | Second injury forces substitution, or degraded attributes if none available                                                              | CONTEXT.md D-06 (Phase 39 always takes the no-substitute branch; no stub needed)                                                                             |
| INJURY-04   | Injury toggle independent, no effect unless Fouls also enabled                                                                           | Architectural Responsibility Map (Settings row)                                                                                                              |
| GKDIVE-01   | GK adjacent to carrier reuses existing tackle duel, GK as tackler — no new duel type                                                     | `moveValidator.ts` TACKLE_ATTEMPT trigger confirmed role-agnostic (Sources); confirms "no new duel type" claim                                               |
| GKDIVE-02   | Repeating interrupt opportunity within 3 hexes parallel to goal line, -1 dice penalty at 3rd hex                                         | Architecture Pattern 4 (`validateGKDive`'s exact distance-banded penalty shape, directly reusable)                                                           |
| GKDIVE-03   | GK roll of 1 in dive-at-feet is a foul awarding a penalty kick, not a free kick                                                          | Architecture diagram (foul-source branch: GK_DIVE_AT_FEET → Penalty Kick, not FREE_KICK_SETUP)                                                               |
| GKDIVE-04   | Successful dive onto an occupied hex displaces pieces/ball one hex further in dive direction                                             | Don't Hand-Roll table (`computeLooseBall`-style directional cube-vector walk reusable)                                                                       |
| GKDIVE-05   | GK dive-at-feet at most once per movement cycle (4-5-2)                                                                                  | Pitfall 3 (D-09's shared cap — 4 `GK_DIVE` entry points must all be guarded)                                                                                 |
| PEN-01      | Penalty duel, GK combined score takes -2 dice penalty                                                                                    | Architecture Pattern 5 (`computeCombinedScore` penalty-array threading, no function changes needed)                                                          |
| PEN-02      | Both teams freely reposition before penalty kick; only kicker + GK inside penalty area; kicker via existing free-kick kicker-select flow | Architecture Pattern 3 (full template: `computeGoalKickEligibleIds`/`GoalKickSetupPanel.tsx`, with region filter removed and PEN-02's zone constraint added) |
| PEN-03      | Tied penalty duel → Loose Ball at the penalty spot                                                                                       | Don't Hand-Roll table (existing `LOOSE_BALL` phase + `computeLooseBall`, new trigger context only)                                                           |
| FK-01       | Foul from tackle/steal (not GK-dive) awards free kick via existing `FREE_KICK_SETUP`                                                     | Architecture Pattern 2 (`triggerOffsideFoul` exact contract to mirror, `offside.ts:234-281`)                                                                 |
| SETTINGS-01 | 4 independent toggles at game creation                                                                                                   | Architectural Responsibility Map; Pattern reuse of `outOfBoundsEnabled` two-step plumbing                                                                    |
| SETTINGS-02 | Booking has no effect unless Fouls also enabled                                                                                          | Don't Hand-Roll / Settings gating notes                                                                                                                      |
| SETTINGS-03 | Injury has no effect unless Fouls also enabled                                                                                           | Don't Hand-Roll / Settings gating notes                                                                                                                      |

</phase_requirements>

## Summary

Phase 39 is a pure application-logic/UI extension — no new npm packages, no new external services. The two prior v1.6 research docs (`ARCHITECTURE.md`, `FEATURES.md`, both dated 2026-08-03, pre-Phase-37) got the big structural calls right (stage-index pattern, `ball.lastTouchedBy`, inline duel-resolution for injury/booking) and Phases 37-38 already built consistently with them — `FREE_KICK_SETUP` is untouched and directly reusable per FK-01, `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` is a proven turn-based sequential-reposition template Phase 38's Corner Kick also copied, and `EventBanner.tsx` _already has a placeholder row for Penalty Kick_ with an explicit code comment naming this phase. However, three of the old research docs' predictions did **not** hold and must be corrected during planning (see Common Pitfalls): (1) `GOAL_KICK` did **not** reuse the `GK_RESTART` chain — the user explicitly rejected that and Phase 37 built a fully independent `GOAL_KICK_SETUP_*` phase family instead, which is the correct template to copy, not `GK_RESTART`; (2) `EventBanner.tsx`'s multi-event-per-broadcast bug (flagged as a v1.6 pitfall in STATE.md) is **still live and unfixed** in the current code — this blocks D-02's foul→injury→booking banner sequence as specified unless fixed as part of this phase; (3) the GK's shot-blocking `GK_DIVE` phase has **four**, not one, entry points in `gameEngine.ts`, all of which need D-09's shared-cap guard.

**Primary recommendation:** Build the foul/injury/booking chain as inline sub-resolutions appended to `eventLog` inside `applyMove`'s existing `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` branches (`gameEngine.ts:895-1049`) — never as a new phase transition — so injury/booking always fire regardless of the attacker's later continue/restart choice. Give the two new restart destinations (foul-triggered free kick, penalty kick) their own trigger functions modeled byte-for-byte on `triggerOffsideFoul` (`offside.ts:234-281`) and the `GOAL_KICK_SETUP_GK`/`_OPPONENT` two-window reposition pattern (`gameEngine.ts:4634-4645`, `GoalKickSetupPanel.tsx`), respectively. Fix `EventBanner.tsx`'s tail-only event diffing before or alongside implementing D-02.

## Architectural Responsibility Map

| Capability                              | Primary Tier                                           | Secondary Tier                                                              | Rationale                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Foul detection (die===1)                | API/Backend (`gameEngine.ts` `applyMove`)              | —                                                                           | Server-authoritative dice; must be computed inline in the same duel-resolution branch that already exists (no round trip)                                                |
| Injury/booking rolls                    | API/Backend (`gameEngine.ts`)                          | —                                                                           | Same function call as foul detection; server rolls all dice (`crypto.randomInt`), never client                                                                           |
| Foul/injury/booking banners             | Browser/Client (`EventBanner.tsx`)                     | —                                                                           | Pure event-log→UI projection; requires fixing the tail-only diff bug (see Pitfalls)                                                                                      |
| Continue/restart choice panel           | Browser/Client (new panel, `GameBoard.tsx` dispatch)   | API/Backend (new phase + handler)                                           | New human decision UI (D-01); server validates and transitions on submit                                                                                                 |
| Card/injury on-board badges             | Browser/Client (`PieceOverlay.tsx`)                    | —                                                                           | Pure rendering, reads `PlayerPiece.injured`/`yellowCards`/`redCarded` fields from broadcast state                                                                        |
| GK-dive-at-feet duel                    | API/Backend (`gameEngine.ts`, reuses `TACKLE_ATTEMPT`) | Browser/Client (new interrupt prompt panel)                                 | GKDIVE-01 explicitly reuses the existing tackle-duel resolution; only the interrupt _offer_ (GKDIVE-02) is new client UI + new server phase                              |
| Penalty-kick reposition window          | API/Backend (`gameEngine.ts`, new phase pair)          | Browser/Client (new panel, template = `GoalKickSetupPanel.tsx`)             | Same turn-based sequential-window shape already proven twice (Goal Kick, Corner Kick)                                                                                    |
| Settings toggles (Fouls/Booking/Injury) | Browser/Client (`GameSettingsScreen.tsx`)              | API/Backend (`roomHandlers.ts` `ROOM_SETTINGS_CONFIRM`, `GameState` fields) | Mirrors the existing `outOfBoundsEnabled` two-step plumbing (client local state → Room field → `GameState` field)                                                        |
| Second-half mutual-confirm gate         | API/Backend (`gameHandlers.ts` `GAME_HALF_TIME_START`) | Browser/Client (`GameBoard.tsx` button)                                     | Mid-match state lives in `GameState`, not `Room` — closer template is `headerConfirmed` (GameState-scoped), not `LINEUP_CONFIRM` (Room-scoped, pre-match) — see Pitfalls |

## Standard Stack

No new libraries. This phase extends the existing TypeScript monorepo (`packages/shared`, `packages/server`, `packages/client`) with new pure functions, `GamePhase`/`GameState` fields, `ActionEvent` types, and React components — the same shape every prior v1.6 phase used.

### Core

| Library    | Version | Purpose | Why Standard                                                                                                                                               |
| ---------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (none new) | —       | —       | Phase is pure application logic within the already-locked stack (Node 22, Express 4, Socket.io 4, React 18.3.1, Zustand 4.5.7, TypeScript 5, Vitest 2.1.9) |

### Alternatives Considered

Not applicable — no new dependency decisions in this phase.

**Installation:** None required.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. Skip the legitimacy gate.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │  MOVEMENT phase: applyMove(state, pieceId, to, dice)     │
                    │  (gameEngine.ts:808-1049, unchanged entry point)         │
                    └───────────────────────┬───────────────────────────────────┘
                                             │
                        ┌────────────────────┴────────────────────┐
                        │ moveValidator returns effect:            │
                        │  STEAL_ATTEMPT | TACKLE_ATTEMPT | none   │
                        └────────────────────┬────────────────────┘
                                             │ (existing duel resolves — SUCCESS/FAIL)
                                             ▼
                    ┌────────────────────────────────────────────────────────┐
                    │  NEW: FOUL-01 check — defender's own die === 1?         │
                    │  (stealDie for STEAL_ATTEMPT, tackleDie for TACKLE_..) │
                    └───────────┬───────────────────────────┬─────────────────┘
                          no    │                      yes  │
                                │                            ▼
                                │        ┌───────────────────────────────────────┐
                                │        │ NEW inline sub-resolution (same fn call,│
                                │        │ same broadcastState — Q3 architecture): │
                                │        │  1. append FOUL_CALLED event            │
                                │        │  2. if injuryEnabled: roll+append       │
                                │        │     INJURY_CHECK event, may set         │
                                │        │     piece.injured=true                  │
                                │        │  3. if bookingEnabled: roll+append       │
                                │        │     BOOKING_CHECK event, may set        │
                                │        │     yellowCards++/redCarded=true        │
                                │        │  (Professional Foul → straight red-vs-  │
                                │        │   yellow roll instead of normal roll)   │
                                │        └───────────────────┬───────────────────┘
                                │                            ▼
                                │        ┌───────────────────────────────────────┐
                                │        │ phase → NEW 'FOUL_CHOICE' (or similar)  │
                                │        │ attacker: Continue Play | Take Restart  │
                                │        └───────┬───────────────────────┬────────┘
                                │        continue │                      │ restart
                                ▼                 ▼                      ▼
                    (existing MOVEMENT   (existing MOVEMENT      source===GK_DIVE_AT_FEET?
                     continues, exactly   continues unchanged)      │              │
                     as today)                                     yes            no
                                                                      ▼              ▼
                                                          NEW PENALTY_KICK_*   FREE_KICK_SETUP
                                                          phase chain          (existing, FK-01
                                                          (template:           reuse — new
                                                          GOAL_KICK_SETUP_*)   triggerFoulFreeKick
                                                                               entry fn, modeled
                                                                               on triggerOffsideFoul)

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Client: EventBanner.tsx eventLog diff-effect — MUST be fixed to walk    │
  │  ALL newly-appended events (not just eventLog[length-1]) since a single  │
  │  broadcast can now carry FOUL_CALLED + INJURY_CHECK + BOOKING_CHECK in   │
  │  one state update (see Pitfall: "EventBanner tail-only diffing").       │
  └──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new top-level folders. New code lands in existing locations, mirroring every prior v1.6 phase:

```
packages/shared/src/
├── types.ts              # new ActionEventType members, ActionEvent variants, GamePhase members,
│                          # GameState fields (foulsEnabled/bookingEnabled/injuryEnabled, foul/
│                          # penalty-kick staging fields), PlayerPiece.injured/yellowCards/redCarded
├── fouls.ts               # NEW — pure helpers: triggerFoulFreeKick, computeProfessionalFoul
│                          # reachability, injury/booking roll-vs-threshold checks (mirrors
│                          # offside.ts's role for the free-kick chain)
├── scoreUtils.ts          # extend computeCombinedScore call sites with injury (-1) / GK penalty
│                          # (-2 penalty / dive-distance -1) arrays — function itself unchanged
packages/server/src/
├── gameEngine.ts          # applyMove STEAL_ATTEMPT/TACKLE_ATTEMPT branches (895-1049) gain the
│                          # inline foul/injury/booking sub-resolution; new applyFoulChoice,
│                          # applyGkDiveAtFeet*, applyPenaltyKick* functions (mirrors existing
│                          # applyGoalKick*/applyCornerKick* naming)
├── gameHandlers.ts        # new GAME_FOUL_CHOICE, GAME_GK_DIVE_AT_FEET_PROMPT, GAME_PENALTY_*
│                          # handlers, each following the isProcessing+phase-guard+pure-delegate
│                          # shape every existing handler uses
packages/client/src/components/
├── FoulChoicePanel.tsx    # NEW — D-01's two-button "Continue Play / Take the Free Kick" panel
├── PenaltyKickSetupPanel.tsx  # NEW — template: GoalKickSetupPanel.tsx structure
├── GkDiveAtFeetPromptPanel.tsx # NEW — template: same interrupt-prompt shape as existing dialogs
├── EventBanner.tsx         # FIX tail-only diffing (see Pitfalls); extend getBannerMessage +
│                            # RESTART_BANNERS for the new events/phases
├── GameSettingsScreen.tsx  # 3 new checkboxes + outOfBounds default flip to true
├── PieceOverlay.tsx        # card/injury badge rendering, opposite-corner from ball dot
├── GameBoard.tsx           # canStart → mutual-confirm gate; phase-dispatch additions
```

### Pattern 1: Inline duel sub-resolution (no forced phase transition)

**What:** `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` already append their own `ActionEvent` and, on a FAIL outcome, do **not** transition `phase` at all — movement simply continues (`gameEngine.ts:1031-1048`). This is the exact shape FOUL-02 needs: injury and booking must be unconditional side effects of the _triggering roll_, computed and committed to state **before** any client input (the attacker's continue/restart choice) is even read.
**When to use:** Any "always happens regardless of a later human choice" rule.
**Example (current code, the pattern to replicate):**

```typescript
// gameEngine.ts:895-928 (STEAL_ATTEMPT) — die is already in scope here.
const die = dice?.stealDie ?? 3;
const defender = result.effect.defenders[0];
// ... existing combined-score/result logic ...
newEventLog = [...newEventLog, stealEvent];
// NEW: FOUL-01 hook point — insert here, using the SAME `die` variable already
// extracted above (defender's own die). Do NOT introduce a second roll for the
// foul-detection check itself — die===1 is the trigger. A SEPARATE fresh die is
// needed for the INJURY-01/CARD-01 threshold checks (see Assumptions Log A1).
```

### Pattern 2: Restart-trigger function modeled on `triggerOffsideFoul`

**What:** `triggerOffsideFoul` (`packages/shared/src/offside.ts:234-281`) is a pure function: given a `GameState` and an offender id, it returns a **new** `GameState` with `phase: 'FREE_KICK_SETUP'`, `freeKickHex` = offender's position, `freeKickAttackingTeam` = the non-offending team, ball placed at the foul spot, and the stage-0 fields initialized (`freeKickStageIndex: 0`, `freeKickPlacedPieceIds: []`, `freeKickKickerChosen: false`). Every field it sets is already trigger-agnostic (named `freeKick*`, not `offside*`) — confirmed by direct inspection, matching the FEATURES.md prediction exactly.
**When to use:** FK-01's foul-triggered free kick.
**Example:**

```typescript
// offside.ts:255-280 — the exact contract to mirror in a new triggerFoulFreeKick(state, foulerId):
return {
  ...state,
  phase: 'FREE_KICK_SETUP',
  freeKickHex: offender.position, // NEW: use the FOULER's position, not the offender's
  freeKickAttackingTeam: otherTeam, // the fouled team
  attackingTeam: otherTeam,
  activeTeam: otherTeam,
  ball: { position: offender.position, carrierId: null, lastTouchedBy: state.ball.lastTouchedBy },
  freeKickStageIndex: 0,
  freeKickPlacedPieceIds: [],
  freeKickKickerChosen: false,
  movedPieceIds: [],
  lastDiceRoll: null,
};
```

Call this from the new `FOUL_CHOICE` "take the restart" branch, gated on `foulSource !== 'GK_DIVE_AT_FEET'` (GKDIVE-03/PEN-01 route to a new Penalty Kick trigger instead — same shape, different phase target).

### Pattern 3: Turn-based sequential full-squad reposition (D-08's penalty-kick template)

**What:** `GOAL_KICK_SETUP_GK` → `GOAL_KICK_SETUP_OPPONENT` is a two-phase-value window: one team repositions freely (up to N hexes per piece) while the phase is theirs, then `applyGoalKickWindowEnd` (`gameEngine.ts` — undo boundary `GOAL_KICK_WINDOW_ADVANCE`) hands control to the other team. Eligibility is precomputed once at trigger time via `computeGoalKickEligibleIds` (`gameEngine.ts:4634-4645`), which currently filters to final-third pieces only:

```typescript
// gameEngine.ts:4634-4645 (current, final-third-only — Corner Kick's precedent for D-08)
export function computeGoalKickEligibleIds(
  pieces: readonly PlayerPiece[],
  goalKickTeam: 'home' | 'away',
): { gkTeam: readonly string[]; opponent: readonly string[] } {
  const eligible = pieces.filter(
    (p) => isInRegion(p.position, 'homeThird') || isInRegion(p.position, 'awayThird'),
  );
  return {
    gkTeam: eligible.filter((p) => p.teamId === goalKickTeam).map((p) => p.id),
    opponent: eligible.filter((p) => p.teamId !== goalKickTeam).map((p) => p.id),
  };
}
```

**For D-08 (penalty kick, full remaining squad):** write an analogous `computePenaltyKickEligibleIds` with **no region filter** (every on-pitch piece of each team is eligible), and add PEN-02's zone constraint — no piece other than the kicker and the defending GK may be _placed inside_ the penalty-area hex set (`PITCH_REGIONS.homePenaltyArea`/`awayPenaltyArea`, `pitch.ts:82-83`) — as a new validation rule inside the per-piece move handler, not as an eligibility filter (a piece can be eligible to move but simply forbidden from landing in that specific zone).
**Client template:** `GoalKickSetupPanel.tsx:100-148` (the reposition-window branch) is the direct structural copy target — same `eligibleIds`/`usedPace`/`movedPieceIds` remaining-count + soft "N players left, are you sure?" end-turn dialog (`withEndTurnGuard`).
**CSS convention (D-01's cited "Phase 35 panel-family convention"):** confirmed — `GoalKickSetupPanel.module.css:6-9` and `FreeKickSetupPanel.module.css:4-7` both define `.panel` with `background`/`border-radius`/`padding` only, **no `border` property**. New panels (`FoulChoicePanel`, `PenaltyKickSetupPanel`, `GkDiveAtFeetPromptPanel`) should copy this exactly.

### Pattern 4: Distance-banded dice penalty (GKDIVE-02's "-1 at the 3rd hex")

**What:** The existing shot-blocking GK dive already has this exact mechanic, isolated in one pure function:

```typescript
// packages/shared/src/shotValidator.ts:93-99
export function validateGKDive(_gk: PlayerPiece, distance: number): DiveResult {
  const d = Math.max(distance, 0);
  if (d > 3) return { saveable: false, reason: 'OUT_OF_RANGE' };
  const savingPenalty = d === 3 ? -1 : 0;
  return { saveable: true, savingPenalty };
}
```

**When to use:** GKDIVE-02's dive-at-feet penalty is structurally identical (0-3 hex range, -1 penalty only at exactly distance 3) — write a sibling pure function (e.g. `validateDiveAtFeetDistance`) rather than inlining the band check, and thread its result into `computeCombinedScore`'s `penalties: number[]` array exactly as `gkSavingPenalty`/`gkPenalties` already do at the shot-duel call site (`gameEngine.ts:2716-2717`).

### Pattern 5: `computeCombinedScore` penalty threading (PEN-01's -2 GK penalty)

**What:** `computeCombinedScore(attribute, diceValue, penalties: number[])` (`scoreUtils.ts:28-37`) sums all penalties and clamps the total at -2 (`Math.max(totalPenalty, -2)`, DICE-04) — already the single source of truth used by every existing duel (shot, tackle, steal, header). PEN-01's flat -2 GK penalty is just `computeCombinedScore(gk.saving, gkDie, [-2])` at the new penalty-kick duel call site — **no changes to the function itself**.
**Interaction to flag:** because the clamp is on the _summed_ penalty, an already-penalized GK (e.g. injured, `-1`) taking a penalty-kick's `-2` gets no additional stacking — `Math.max(-1 + -2, -2) === -2`, same as the shot-duel penalty stacking already works today. This is consistent with existing behavior, not a new edge case to solve.

### Anti-Patterns to Avoid

- **Reusing `GK_RESTART` for anything in this phase:** the pre-Phase-37 `ARCHITECTURE.md` research recommended reusing `GK_RESTART` for Goal Kick; the user explicitly rejected that during Phase 37 (STATE.md: "user explicitly rejected reusing the GK\*RESTART chain for Goal Kick"), and the shipped `GOAL_KICK_SETUP_GK`/`_OPPONENT`/`_CHOICE`/`_TARGET`/`_MOVE` phase family is fully independent. Phase 39's Penalty Kick must follow the **shipped** Goal-Kick/Corner-Kick pattern (own dedicated phase chain, pure-helper reuse only), not the superseded pre-Phase-37 recommendation.
- **One `GamePhase` value per internal sub-step:** consistent with `FREE_KICK_SETUP`/`GOAL_KICK_SETUP_*`/`CORNER_KICK_*`, keep new phase values to one-per-distinct-client-UI (e.g. one `FOUL_CHOICE`, one or two `PENALTY_KICK_*` reposition-window values), not one per internal stage.
- **Gating substitution-adjacent logic through `ELIGIBLE_NEXT_ACTIONS`:** not directly relevant this phase (Substitutions is Phase 40), but the same anti-pattern applies to a naive "second yellow" or "injury" check bolted onto `LastActionType` sequencing — booking/injury state belongs on `PlayerPiece`/`GameState`, checked inline, not threaded through the possession-sequencing table.
- **New dice rolls reusing the generic `DICE_ROLL` `ActionEventType`:** STATE.md's standing v1.6 pitfall — reactivates a dormant full-slot Undo lockout. Every new roll (foul, injury, booking, GK-dive-at-feet, box-entry response, penalty-kick duel) needs its own specific `ActionEventType`, exactly as `GOAL_KICK`/`CORNER_KICK_ACCURACY` did in Phases 37/38.

## Don't Hand-Roll

| Problem                                                                    | Don't Build                                                        | Use Instead                                                                                                            | Why                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Combined-score dice math with penalties                                    | A new scoring formula for the GK-dive-at-feet or penalty-kick duel | `computeCombinedScore(attribute, die, penalties[])` (`scoreUtils.ts:28-37`)                                            | Already handles the -2 clamp (DICE-04); every other duel in the codebase uses it                                      |
| Tie → Loose Ball                                                           | A penalty-kick-specific "what happens on a tie" branch             | Existing `LOOSE_BALL` phase + `computeLooseBall` (`scoreUtils.ts:87-97`), triggered at the penalty spot                | PEN-03 explicitly says "following the existing Loose Ball rules" — this is a new _trigger context_, not new mechanics |
| Displacement of pieces on a successful GK dive-at-feet landing (GKDIVE-04) | Custom collision-resolution logic                                  | The `computeLooseBall`-style directional cube-vector walk (`scoreUtils.ts:58-96`)                                      | Already solves "what if the naive destination is occupied/off-pitch" for the identical geometry problem               |
| Kicker selection for the penalty taker (PEN-02)                            | A new kicker-picker UI                                             | The existing `FREE_KICK_SETUP` kicker-select sub-step (`freeKickKickerChosen` gate, `FK_KICKER_CHOSEN` event)          | Same "attacking team picks any on-pitch outfield player" rule; PEN-02 explicitly says to reuse this flow              |
| Distance-banded dice penalty for the 3-hex dive-at-feet range              | A new penalty formula                                              | `validateGKDive`'s exact `d === 3 ? -1 : 0` shape (`shotValidator.ts:93-99`)                                           | Byte-for-byte the same rule already implemented for the shot-blocking dive                                            |
| Full-squad reposition window sequencing                                    | A new stage-machine                                                | The `GOAL_KICK_SETUP_GK`/`_OPPONENT` two-phase-value pattern, generalized to full-squad eligibility (no region filter) | Proven twice (Goal Kick, Corner Kick); D-08 explicitly directs this reuse                                             |

**Key insight:** every mechanic Phase 39 needs already has a structural precedent shipped in Phases 8-38. The actual net-new work is (1) the injury/booking data model on `PlayerPiece`, (2) the foul-detection hook + two new restart-trigger functions, (3) the GK-dive-at-feet duel's _interrupt-offer_ UI (the duel itself reuses `TACKLE_ATTEMPT`), and (4) fixing `EventBanner.tsx`'s multi-event bug that blocks D-02 as specified.

## Common Pitfalls

### Pitfall 1: `EventBanner.tsx` only processes the LAST new event per broadcast — currently unfixed, blocks D-02

**What goes wrong:** `EventBanner.tsx:106-116`'s eventLog diff-effect does:

```typescript
if (eventLog.length <= lastProcessedLengthRef.current) return;
const tailEvent = eventLog[eventLog.length - 1]; // <-- only the LAST event
const banner = tailEvent !== undefined ? getBannerMessage(tailEvent) : null;
lastProcessedLengthRef.current = eventLog.length; // advances past ALL new events regardless
```

If a single `applyMove` call appends `MOVE` + `TACKLE_ATTEMPT` + `FOUL_CALLED` + `INJURY_CHECK` + `BOOKING_CHECK` in one state update (which Q3's architecture requires — all inline, one `broadcastState` call), only the _last_ of those (`BOOKING_CHECK`, or nothing if it's not a qualifying event) ever gets inspected. The foul banner and injury banner would silently never fire.
**Why it happens:** This was flagged in STATE.md's "Key Pitfalls to Avoid" as a known v1.6 risk during Phase 37/38 planning ("must process all newly-appended events, not just the tail") — but it was never actually fixed; direct inspection of the current file confirms the tail-only bug is still live, unchanged since goals/tackles/loose-balls (Phase 18.4) were the only qualifying events (where 1-new-event-per-broadcast happened to always hold).
**How to avoid:** Rework the effect to slice `eventLog.slice(lastProcessedLengthRef.current)` and process **every** newly-appended event, queueing multiple banners to display in sequence (with each one's own duration) rather than only ever showing one. This is the correct point to also add the D-03 card-color-badge + DOGSO-label rendering to the booking banner variant.
**Warning signs:** A foul immediately followed by an injury on the same die roll shows only the LAST banner (or none) instead of the D-02-specified foul→injury→booking sequence.

### Pitfall 2: Injury/booking "die >= attribute" is an inverted convention vs. every other duel

**What goes wrong:** Every existing duel in the codebase (`computeCombinedScore` callers) treats a _higher_ attribute as _better for its owner_ (higher `tackling`/`saving`/`shooting` → higher combined score → more likely to win). INJURY-01 ("a die >= the fouled player's Resilience attribute injures them") and CARD-01 ("a die >= the referee's Leniency attribute issues a yellow card") both invert this: a **higher** Resilience/Leniency makes the bad outcome (injury/card) _less_ likely, and neither check goes through `computeCombinedScore` at all — they are flat `d6 >= attribute` comparisons with no dice-plus-attribute addition.
**Why it happens:** Pattern-matching against the dominant `computeCombinedScore(attribute, die, penalties)` convention used everywhere else in the codebase.
**How to avoid:** Implement as bare comparisons (`injuryDie >= fouledPlayer.resilience`, `bookingDie >= state.refereeCard.leniency`), never routed through `computeCombinedScore`. Document this explicitly at the call site to prevent a future refactor from "fixing" it into the wrong shape.
**Warning signs:** A high-Resilience player getting injured more often than a low-Resilience player in testing.

### Pitfall 3: `GK_DIVE` has FOUR entry points, not one — D-09's shared cap must guard all of them

**What goes wrong:** D-09 requires that using the dive-at-feet interrupt disables the GK from the shot-blocking `GK_DIVE` phase for the rest of that movement cycle. Direct inspection found **four** distinct places in `gameEngine.ts` that transition `phase: 'GK_DIVE'`:

1. `applyDeclareShot` (regular declared shot), `gameEngine.ts:6180`
2. Header goal-line route, uncontested-attacker-win branch, `gameEngine.ts:3098`
3. Header goal-line route, contested-duel-win branch, `gameEngine.ts:3198`
4. `applyResolveHeaderTarget`'s goal-line route, `gameEngine.ts:5892`
   **Why it happens:** Shots can be declared directly (PASS→SHOT) or arrive via a goal-line header target from three different header-resolution branches — each duplicates its own `phase: 'GK_DIVE'` transition rather than routing through one shared helper.
   **How to avoid:** Add a single shared helper (e.g. `enterGkDiveOrSkip(state, ...)`) that checks the D-09 cap flag and either transitions to `'GK_DIVE'` normally or skips straight to auto-resolution with no reposition — call it from all four sites instead of patching each independently. Missing even one of the four silently breaks D-09.
   **Warning signs:** GK can still block a shot after already diving at feet, but only via the header path(s) not directly tested.

### Pitfall 4: Second-half mutual-confirm (D-16) — `LINEUP_CONFIRM`'s flags live on `Room`, but half-time state lives on `GameState`

**What goes wrong:** CONTEXT.md cites `LINEUP_CONFIRM` (Phase 29 D-25) as the template for D-16's fix. `LINEUP_CONFIRM`'s "either player may confirm first" flags (`room.homeLineupConfirmed`/`room.awayLineupConfirmed`, `roomHandlers.ts:824-833`) are stored on the **pre-match** `Room` object, because `GameState` doesn't exist yet at that point in the flow. Half-time happens **mid-match**, when `GameState` already exists — copying the `Room`-field pattern verbatim would require plumbing a new field from `Room` into every `broadcastState` call, which nothing else in the codebase does for in-match state.
**Why it happens:** The two flows look superficially identical ("either side confirms first, gate on both") but occur at different points in the room lifecycle.
**How to avoid:** Use `GameState.headerConfirmed`'s shape instead — `{ home: boolean; away: boolean } | null` (`types.ts:999-1003`), already a GameState-scoped both-confirm gate ("true once a team submits its contestant; requires both true") built for exactly this same "either team may act first, wait for both" scenario. Add a new `secondHalfConfirmed?: { home: boolean; away: boolean } | null` field to `GameState`, set on each `GAME_HALF_TIME_START`-equivalent call, and only actually transition to `KICK_OFF_SETUP` once both are true.
**Warning signs:** Reaching for a `Room`-level field during implementation and discovering there's no clean path to get it into `GameState`/`broadcastState`.

### Pitfall 5: Professional (Last-Man) Foul reachability is a new algorithm with no direct precedent

**What goes wrong:** FOUL-04 requires determining, at the instant of a foul, whether _any other_ defending piece could have reached the tackle hex within its remaining pace this movement phase. Nothing in the current codebase computes "remaining pace for a piece that hasn't acted yet" as a reachability check — the closest existing concept is `paceUsedByPieceId` (cumulative hexes moved so far, capped per-piece) combined with each piece's static `pace` attribute.
**Why it happens:** This is a genuinely new algorithm, not a hand-roll-avoidance situation — there's no library or existing function to reuse.
**How to avoid:** Use `hexDistance(otherPiece.position, tackleHex) <= (otherPiece.pace - (state.paceUsedByPieceId[otherPiece.id] ?? 0))` — straight-line hex distance vs. remaining pace budget, matching the "as the crow flies" standard already used for move-range highlighting elsewhere in the codebase (no path-walk/occupancy simulation needed). Budget explicit test coverage for this — it's the single highest-implementation-risk item in the phase.
**Warning signs:** Professional Foul never triggers (reachability check always finds an available defender) or triggers too often (check ignores pace already spent this phase).

### Pitfall 6: `RefereeCard`/`PlayerPiece` have no injury/card fields yet — new data model required, not an extension of an existing type

**What goes wrong:** CONTEXT.md's canonical references cite `types.ts:17-26` as "`PlayerAttributes` shape including resilience... tackling/dribbling/saving" — there is **no separate `PlayerAttributes` type**; these are inline fields directly on `PlayerPiece` (`types.ts:14-43`). `resilience` exists (line 24) and is unused elsewhere in the engine (confirmed by the FEATURES.md note, still true). `RefereeCard` has exactly one field, `leniency` (`types.ts:77-79`). Neither `PlayerPiece` nor any other type currently has `injured`, `yellowCards`, or `redCarded` fields — these are 100% new additions.
**Why it happens:** Minor doc-drift between CONTEXT.md's canonical-reference description and the actual type shape; harmless if the planner goes looking for `PlayerAttributes` and doesn't find it.
**How to avoid:** Add `injured?: boolean`, `yellowCards?: 0 | 1`, `redCarded?: boolean` (or equivalent) directly to `PlayerPiece`. Do not mutate the raw skill attributes (`pace`/`tackling`/etc.) — thread the -1 injury penalty through `computeCombinedScore`'s `penalties` array at each duel call site instead (mirrors how shot/GK penalties already work), consistent with INJURY-02's "attributes reduced by 1... floored at 1" being an _effective_, not stored, reduction. (Reduction could alternatively be applied by decrementing the raw attribute and flooring at 1, as INJURY-02's wording literally states — this is a genuine design choice; see Assumptions Log A2.)

## Code Examples

### FOUL-01 hook point — defender's die extraction (already in scope)

```typescript
// gameEngine.ts:895-928 (STEAL_ATTEMPT) — `die` IS the defender's own die (stealDie).
const die = dice?.stealDie ?? 3;
// ... FOUL-01: if (die === 1) { /* trigger foul chain */ }

// gameEngine.ts:930-969 (TACKLE_ATTEMPT) — `defDie` IS the defender's own die (tackleDie).
const defDie = dice?.tackleDie ?? 3;
const carDie = dice?.carrierDie ?? 3;
// ... FOUL-01: if (defDie === 1) { /* trigger foul chain */ }
```

FOUL-01's "defending player's own die shows exactly 1" is unambiguous in the current REQUIREMENTS.md text and directly maps onto these two already-extracted variables — no new dice need to be rolled for the _detection_ step itself.

### `triggerOffsideFoul` — the exact contract FK-01 must mirror

```typescript
// packages/shared/src/offside.ts:234-281 (full function, reference for a new triggerFoulFreeKick)
export function triggerOffsideFoul(state: GameState, explicitOffenderId?: string): GameState {
  // ... resolves offenderId, checks flagged, finds offender piece ...
  const otherTeam: 'home' | 'away' = offender.teamId === 'home' ? 'away' : 'home';
  return {
    ...state,
    phase: 'FREE_KICK_SETUP',
    freeKickHex: offender.position,
    freeKickAttackingTeam: otherTeam,
    attackingTeam: otherTeam,
    activeTeam: otherTeam,
    ball: { position: offender.position, carrierId: null, lastTouchedBy: state.ball.lastTouchedBy },
    offsidePieceIds: flagged.filter((id) => id !== offenderId),
    freeKickStageIndex: 0,
    freeKickPlacedPieceIds: [],
    freeKickKickerChosen: false,
    movedPieceIds: [],
    lastDiceRoll: null,
  };
}
```

### `applyGKDive` auto-resolve wiring — the shot-blocking dive is single-click, not multi-turn

```typescript
// gameHandlers.ts:3018-3087 (GAME_GK_DIVE handler, abridged) — confirms GK_DIVE is NOT a
// multi-step reposition window; one click both moves the GK and immediately triggers dice
// resolution in the SAME handler invocation.
const result = applyGKDive(room.gameState, to);
// ... 6. Auto-resolve shot immediately after dive (no end-turn needed)
const diveShotDie = rollDice();
const diveGkDie = rollDice();
const diveHandlingDie = rollDice();
const diveShotResult = applyRoll(
  { ...result.state, phase: 'SHOT', lastActionType: 'SHOT' },
  diveShotDie,
  diveGkDie,
  diveHandlingDie,
);
room.gameState = { ...diveShotResult.state, gkDivePosition: null };
```

This matters for D-09: because `GK_DIVE` auto-resolves on the GK's first click, "disabling" it for the rest of the cycle most likely means either (a) skipping the interactive `GK_DIVE` phase entirely and auto-resolving with `gkDivePosition = gk.position` (no reposition, no distance penalty either way), or (b) rejecting the shot-declare transition into `GK_DIVE` and routing straight to `SHOT` with zero GK movement. Either is a small, explicit branch at all four `phase: 'GK_DIVE'` sites (Pitfall 3).

### `PieceOverlay.tsx` ball-possession dot — exact geometry for D-05's opposite-corner badge

```typescript
// PieceOverlay.tsx:103, 124-125, 212-226
const PIECE_RADIUS = 12;
const dotOffsetX = piece.teamId === 'home' ? PIECE_RADIUS * 0.715 : -(PIECE_RADIUS * 0.715);
const dotOffsetY = PIECE_RADIUS * 0.715;   // always +Y (bottom corner)
// ... rendered as:
<circle cx={cx + dotOffsetX} cy={cy + dotOffsetY} r={PIECE_RADIUS * 0.59} .../>
```

D-05's badge should render at the **negated** offset (`-dotOffsetX, -dotOffsetY`) — i.e. the top-left corner for home pieces, top-right for away pieces — using the same `PIECE_RADIUS * 0.59` radius. Card badge (colored rect) and injury badge (plus-sign) both occupy this SAME corner; injury renders after card in DOM/JSX order so it visually layers on top per D-05, rather than using two different corners.

## State of the Art

| Old Approach (pre-Phase-37 research)                                                                                                                        | Current Approach (as shipped)                                                                                                                                        | When Changed                                               | Impact                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE.md` recommended reusing `GK_RESTART` for Goal Kick                                                                                            | `GOAL_KICK_SETUP_GK`/`_OPPONENT`/`_CHOICE`/`_TARGET`/`_MOVE` — fully independent phase family                                                                        | Phase 37 (user override, 2026-08-04)                       | Penalty Kick must copy the shipped independent-chain pattern, not the superseded `GK_RESTART`-reuse recommendation                                             |
| `ARCHITECTURE.md` proposed a generic `RestartSetupState`/`RESTART_STAGES` refactor unifying `FREE_KICK_SETUP`/Goal Kick/Corner Kick/Throw-In staging fields | Never built — Goal Kick, Corner Kick, and Throw-In each have their own dedicated, non-generic field clusters (`goalKick*`, `cornerKick*`, `throwIn*`) in `GameState` | Phases 37-38                                               | Phase 39's new phases (Foul/Penalty) should follow the SAME per-restart dedicated-field convention actually shipped, not the unbuilt generic-refactor proposal |
| `FEATURES.md`/STATE.md flagged "which die triggers a foul" as an open rulebook ambiguity                                                                    | REQUIREMENTS.md FOUL-01 now states explicitly: "a tackle or steal attempt whose **defending player's own die** shows exactly 1"                                      | Requirements definition (2026-08-03, before this research) | Already resolved — no confirmation needed during planning                                                                                                      |
| STATE.md flagged "Professional Foul red-vs-yellow: always-straight-red or a modified roll?" as the most safety-critical ambiguity                           | REQUIREMENTS.md CARD-03 now states explicitly: "rolls directly for red-vs-yellow (**≥ Leniency = straight red, otherwise yellow**)"                                  | Requirements definition                                    | Already resolved — a real roll, not an automatic red                                                                                                           |
| STATE.md flagged "does 'nutmeg' map to STEAL_ATTEMPT?"                                                                                                      | REQUIREMENTS.md FOUL-01 states explicitly: "nutmeg is a distinct move deferred to a future milestone — not a v1.6 trigger"                                           | Requirements definition                                    | Already resolved — only `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` are in scope; no third duel type                                                                      |

**Deprecated/outdated:** Both `.planning/research/ARCHITECTURE.md` and `.planning/research/FEATURES.md` (2026-08-03) predate Phases 37-38's actual implementation and should be read as historical context only, not as a current source of truth for phase-chain shape — cross-check every structural claim against the shipped code (as this document does) before relying on them.

## Assumptions Log

| #   | Claim                                                                                                                                                                                                                                                                                                                                     | Section                                           | Risk if Wrong                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | INJURY-01/CARD-01's threshold checks ("die >= resilience"/"die >= leniency") use a **fresh, separate d6 roll**, not the same die that triggered the foul (which is fixed at 1, and would make injury/booking checks nearly always pass for any resilience/leniency > 1).                                                                  | Architecture Pattern 1, Code Examples             | If wrong (i.e. the rulebook intends the SAME triggering die to be reused), injury/booking would fire far more often than intended — this must be confirmed against the physical rulebook or with the user before implementation, since it materially changes match balance.                                                              |
| A2  | INJURY-02's "-1 to all attributes, floored at 1" is implemented as a computed penalty threaded through `computeCombinedScore`'s `penalties` array at each duel call site (not a permanent mutation of the raw stored attribute values), to avoid corrupting the "true" stat values used elsewhere (roster/draft display, lineup screens). | Pitfall 6, Recommended Project Structure          | If the rulebook/UX actually wants the roster screen itself to show the degraded number (not just duel outcomes), this approach under-delivers and the raw-attribute-mutation approach (matching INJURY-02's literal wording) would be needed instead — this is a real design fork, not just an implementation detail.                    |
| A3  | D-09's "GK disabled from diving to block a shot" is implemented as either (a) auto-resolving the shot with the GK's position unchanged (skip the interactive `GK_DIVE` phase), or (b) some other explicit no-dive branch — not fully specified in CONTEXT.md.                                                                             | Code Examples ("applyGKDive auto-resolve wiring") | If the intended behavior is instead "the GK still gets the _shot-block_ interactive reposition but loses the -1 distance-3 penalty exemption" or some other partial restriction, the wrong branch shape would need rework. Low risk — D-09's plain-language intent ("disabled from diving") most naturally reads as skip-the-reposition. |
| A4  | The new `FOUL_CHOICE`-equivalent `GamePhase` value's exact name, and the exact `PlayerPiece` field names (`injured`/`yellowCards`/`redCarded`), are implementation details left to the planner (CONTEXT.md's "Claude's Discretion" explicitly covers `GamePhase` naming).                                                                 | Recommended Project Structure                     | Low risk — purely a naming choice, does not affect behavior.                                                                                                                                                                                                                                                                             |

## Open Questions

1. **Fresh die vs. reused die for injury/booking checks (A1 above)**
   - What we know: FOUL-01's trigger die is fixed at 1 (by definition of the trigger). INJURY-01/CARD-01 need a die compared against Resilience/Leniency (both typically 1-6).
   - What's unclear: whether the rulebook intends a brand-new roll for each of the two checks (most likely, given the physical board game rolls dice for each distinct check) or reuses the same die value.
   - Recommendation: assume fresh rolls (three total dice per foul: the triggering die, an injury die, a booking die — mirroring how `SHOT_ATTEMPT` already has three sub-rolls: shooter, GK, handling), and confirm with the user during `/gsd-plan-phase` discussion if not already settled.

2. **Does INJURY-02's attribute reduction mutate stored stats or apply as a duel-time penalty (A2 above)?**
   - What we know: Every other "temporary attribute modifier" in the codebase (shot penalties, GK penalties) is applied via `computeCombinedScore`'s penalty array, never a stored-attribute mutation.
   - What's unclear: whether the roster/lineup UI is expected to visibly show the reduced numbers after an injury (which would require actual mutation) or only duel outcomes need to reflect it.
   - Recommendation: default to the penalty-array approach (consistent with codebase convention); escalate to the user only if a UI requirement for visible degraded stats emerges during planning.

3. **Exact shape of D-09's "disabled from diving to block a shot"**
   - What we know: `GK_DIVE` auto-resolves on a single click; there is no multi-turn "decline to dive" affordance today.
   - What's unclear: whether "disabled" means skip-the-interactive-phase-entirely (auto-resolve at the GK's current position) or some other partial restriction.
   - Recommendation: skip-the-interactive-phase-entirely is the simplest, most literal reading and requires the smallest code change (one guard at each of the four `GK_DIVE` entry sites) — recommend this as the default unless the user specifies otherwise.

## Environment Availability

Not applicable — this phase has no new external dependencies (no new npm packages, no new external services, no new CLI tools). The existing dev/test toolchain (Node 22, pnpm, Vitest 2.1.9) is already installed and used by every prior phase.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 2.1.9 (`packages/server/package.json`, `packages/server/vitest.config.ts`)                                   |
| Config file        | `packages/server/vitest.config.ts` (server); equivalent client-side config exists per prior phases' component tests |
| Quick run command  | `pnpm --filter @counter-attack/server test -- <test-file-pattern>`                                                  |
| Full suite command | `pnpm test` (root — runs `pnpm -r test` across all packages)                                                        |

### Phase Requirements → Test Map (representative — full enumeration during plan authoring)

| Req ID                         | Behavior                                                                           | Test Type        | Automated Command                                                                          | File Exists?                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| FOUL-01                        | Defender die===1 on tackle/steal calls a foul                                      | unit             | `vitest run gameEngine.fouls.test.ts`                                                      | ❌ Wave 0                                                                    |
| FOUL-02                        | Injury then booking roll fires before attacker's choice, even mid-"continue play"  | unit             | `vitest run gameEngine.fouls.test.ts -t "always rolls"`                                    | ❌ Wave 0                                                                    |
| FOUL-04                        | Professional Foul reachability (no other defender in range)                        | unit             | `vitest run gameEngine.professionalFoul.test.ts`                                           | ❌ Wave 0                                                                    |
| CARD-01/CARD-02                | Booking roll ≥ leniency; 2nd yellow → red                                          | unit             | `vitest run gameEngine.booking.test.ts`                                                    | ❌ Wave 0                                                                    |
| INJURY-01/02/03                | Injury roll, attribute reduction, 2nd-injury fallback (Phase 40 not yet built)     | unit             | `vitest run gameEngine.injury.test.ts`                                                     | ❌ Wave 0                                                                    |
| GKDIVE-01..05                  | GK-dive-at-feet duel, interrupt offer, foul-on-1, displacement, once-per-cycle cap | integration      | `vitest run gkDiveAtFeet.integration.test.ts` (template: `cornerKick.integration.test.ts`) | ❌ Wave 0                                                                    |
| PEN-01..03                     | Penalty duel -2 GK penalty, full-squad reposition, tie→Loose Ball                  | integration      | `vitest run penaltyKick.integration.test.ts` (template: `goalKick.integration.test.ts`)    | ❌ Wave 0                                                                    |
| FK-01                          | Foul-triggered free kick reuses `FREE_KICK_SETUP`                                  | integration      | `vitest run foulFreeKick.integration.test.ts`                                              | ❌ Wave 0                                                                    |
| SETTINGS-01..03                | 4 toggles, Booking/Injury inert without Fouls                                      | unit + component | `vitest run gameSettingsScreen.test.tsx` (extend existing)                                 | ✅ extend existing `GameSettingsScreen` tests                                |
| D-15 (loose-ball log fix)      | `LOOSE_BALL_LAND` carries direction/distance                                       | unit             | `vitest run gameEngine.looseBall.test.ts` (extend existing)                                | ✅ extend existing                                                           |
| D-16 (2nd-half mutual confirm) | Both teams must confirm before 2nd half starts                                     | integration      | `vitest run gameHandlers.halfTime.test.ts` (extend existing)                               | ✅ extend existing (search for current `GAME_HALF_TIME_START` test coverage) |

### Sampling Rate

- **Per task commit:** targeted `vitest run <file>` for the touched module
- **Per wave merge:** `pnpm --filter @counter-attack/server test` (full server suite) + `pnpm --filter @counter-attack/client test` (component tests)
- **Phase gate:** `pnpm test` (full monorepo suite) green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/__tests__/gameEngine.fouls.test.ts` — FOUL-01/02/03/04/05
- [ ] `packages/server/src/__tests__/gameEngine.booking.test.ts` — CARD-01..04
- [ ] `packages/server/src/__tests__/gameEngine.injury.test.ts` — INJURY-01..04
- [ ] `packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts` — GKDIVE-01..05 (template: existing `cornerKick.integration.test.ts` structure)
- [ ] `packages/server/src/__tests__/penaltyKick.integration.test.ts` — PEN-01..03, FK-01 (template: existing `goalKick.integration.test.ts` structure)
- [ ] Client component test for the new `FoulChoicePanel`/`PenaltyKickSetupPanel`/`GkDiveAtFeetPromptPanel` (template: existing `CornerKickSetupPanel.test.tsx`)
- [ ] `EventBanner.test.tsx` — must gain a test asserting multi-event-per-broadcast processing (the Pitfall 1 fix) before/alongside D-02 implementation, since this is a regression risk for every future phase, not just this one

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json` (key absent) — treated as enabled. This is a real-time, room-code-based 2-player game with no user accounts, passwords, or persistent auth tokens; most traditional ASVS categories (V2 Authentication, V3 Session Management proper, V6 Cryptography) do not apply to this architecture, consistent with every prior phase's security posture.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | No      | No user accounts; room-code-based session model, unchanged by this phase                                                                                                                                                                                                                                                                                                                                                                                            |
| V3 Session Management | No      | Socket.io room membership is the only "session" concept; unaffected                                                                                                                                                                                                                                                                                                                                                                                                 |
| V4 Access Control     | Yes     | Existing `controlsGKTeam`/`socketTeam`/team-guard pattern (e.g. `gameHandlers.ts:3050` `controlsGKTeam`) must be replicated for every new handler (only the attacking manager may submit the continue/restart choice; only the GK's team may respond to a dive-at-feet or box-entry prompt; only the correct team may confirm each penalty-kick reposition window)                                                                                                  |
| V5 Input Validation   | Yes     | Every new socket payload (hex coordinates for reposition/displacement, the foul-choice enum, the GK-dive-at-feet accept/decline) must be server-side shape-validated before use, mirroring the existing `GAME_GK_DIVE` handler's `typeof to.q !== 'number'` pattern (`gameHandlers.ts:3038-3048`) — never trust client-declared die values (all dice remain `crypto.randomInt`-generated server-side, per the standing "never generate dice on the client" pitfall) |
| V6 Cryptography       | No      | No new secrets/crypto surface introduced                                                                                                                                                                                                                                                                                                                                                                                                                            |

### Known Threat Patterns for this stack

| Pattern                                                                                 | STRIDE                                              | Standard Mitigation                                                                                                                                                                |
| --------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client claims a foul/injury/booking outcome directly (bypassing server dice)            | Tampering                                           | All new dice (injury check, booking check, GK-dive-at-feet duel, penalty-kick duel) generated via `crypto.randomInt` server-side only, exactly as every existing duel already does |
| Client submits the continue/restart choice or a reposition move for the wrong team      | Elevation of Privilege                              | Reuse the existing `controlsGKTeam`/`socketTeam` team-ownership guard idiom at every new handler                                                                                   |
| Double-submission race on the foul-choice or penalty-kick-window confirm (double-click) | Denial of Service (self-inflicted state corruption) | Reuse the existing per-room `isProcessing` mutex idiom (present in 100% of existing handlers)                                                                                      |
| Malformed hex payload for GK-dive-at-feet displacement or penalty-kick reposition       | Tampering / Denial of Service                       | Server-side `isPitchHex`/shape validation before any state mutation, mirroring `applyGKDive`'s `OFF_PITCH`/`NOT_ON_PATH` guards                                                    |

## Sources

### Primary (HIGH confidence — direct codebase inspection this session)

- `packages/shared/src/types.ts` (full file, 1353 lines) — `PlayerPiece`, `BallState`, `ActionEventType`/`ActionEvent`, `GamePhase`, `GameState` field inventory
- `packages/server/src/gameEngine.ts` — `applyMove` STEAL_ATTEMPT/TACKLE_ATTEMPT (895-1049), `applyDeclareShot`/`applyGKDive` (6112-6265), header-goal-line GK_DIVE routes (3065-3142, 3187-3199), `applyResolveHeaderTarget` GK_DIVE route (5855-5899), `computeGoalKickEligibleIds` (4634-4645), `applyKickOffReady` (6304-6351), `applyOffsideFoulWithRelocation` (6423+), LOOSE_BALL scatter (3327-3445)
- `packages/shared/src/offside.ts` (full file) — `triggerOffsideFoul`, `FREE_KICK_STAGES`, `CORNER_KICK_STAGES`
- `packages/shared/src/scoreUtils.ts` (full file) — `computeCombinedScore`, `computeLooseBall`
- `packages/shared/src/shotValidator.ts:93-113` — `validateGKDive`, `validateHandlingCheck`
- `packages/shared/src/pitch.ts` (full file) — `PITCH_REGIONS`, `homePenaltyArea`/`awayPenaltyArea`
- `packages/server/src/gameHandlers.ts` — `GAME_GK_DIVE` handler (3009-3087), `GAME_HALF_TIME_START` handler (2704-2745)
- `packages/server/src/roomHandlers.ts` — `LINEUP_CONFIRM` handler (750-883), mutual-confirm flag pattern
- `packages/client/src/components/GameSettingsScreen.tsx` (full file) — checkbox pattern, `outOfBounds` default
- `packages/client/src/components/PieceOverlay.tsx` (full file) — ball-possession dot geometry
- `packages/client/src/components/EventBanner.tsx` (full file) — `RESTART_BANNERS`, `getBannerMessage`, tail-only diff effect (confirmed live bug)
- `packages/client/src/components/GoalKickSetupPanel.tsx` (full file) — reposition-window panel template
- `packages/client/src/components/GameBoard.tsx` — `canStart`/`kickOffTeam` half-time logic (188-227, 428-435), phase-dispatch table (346-376)
- `packages/client/src/components/ActionLog.tsx:723-729` — `LOOSE_BALL_LAND` formatting
- `packages/shared/src/moveValidator.ts` — `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` trigger conditions (role-agnostic, confirms GKDIVE-01's "no new duel type" claim)
- `.planning/config.json` — `nyquist_validation: true`, no `security_enforcement` key (defaults enabled)
- `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-CONTEXT.md` — locked decisions D-01..D-16
- `.planning/REQUIREMENTS.md` — FOUL-01..05, CARD-01..04, INJURY-01..04, GKDIVE-01..05, PEN-01..03, FK-01, SETTINGS-01..04
- `.planning/STATE.md` — v1.6 decisions locked, Key Pitfalls to Avoid, Open Questions (now resolved per State of the Art table)

### Secondary (MEDIUM confidence — prior-session research, partially superseded)

- `.planning/research/ARCHITECTURE.md` (2026-08-03, pre-Phase-37) — stage-index pattern, `ball.lastTouchedBy`, inline-duel-resolution recommendations (all confirmed still valid); `GK_RESTART`-reuse-for-Goal-Kick recommendation (confirmed superseded — flagged in State of the Art)
- `.planning/research/FEATURES.md` (2026-08-03, pre-Phase-37) — rulebook ambiguity catalog (three of its flagged ambiguities are now resolved by REQUIREMENTS.md text, per State of the Art table)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependencies, closed question
- Architecture: HIGH — every pattern cited is a direct, current-code precedent, not a proposal
- Pitfalls: HIGH — Pitfall 1 (EventBanner) and Pitfall 3 (4 GK_DIVE entry points) are directly confirmed defects/facts in the current codebase, not speculation
- Injury/booking dice mechanics (fresh roll vs. reused die, A1): MEDIUM — REQUIREMENTS.md text doesn't fully disambiguate; flagged for confirmation during planning/discussion

**Research date:** 2026-08-09
**Valid until:** Stable until the next phase that touches `gameEngine.ts`'s duel-resolution branches or `EventBanner.tsx` (no external-ecosystem time pressure — internal codebase research, revalidate only if Phase 39 planning is delayed past another phase's completion)
