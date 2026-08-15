# Roadmap — Counter Attack Web

## Milestones

- ✅ **v1.0 MVP** — Phases 1–10 (shipped 2026-06-11)
- ✅ **v1.1 UX Tuning & Bug Cleanup** — Phases 11–14 (shipped 2026-06-12)
- ✅ **v1.2 Team Identity & Core Fixes** — Phases 15–18 (shipped 2026-07-03)
- ✅ **v1.3 Team Customization & Formation System** — Phases 19–25 (shipped 2026-07-11)
- ✅ **v1.4 Response Polish + Draft Mode** — Phases 26–30 (shipped 2026-07-22, with 1 known gap — RESP-01..09 deferred; see [audit](milestones/v1.4-MILESTONE-AUDIT.md))
- ✅ **v1.5 UX Refresh & Code Cleanup** — Phases 31–36 (shipped 2026-08-03; see [audit](milestones/v1.5-MILESTONE-AUDIT.md))
- 🚧 **v1.6 Fouls, Cards & Restarts** — Phases 37–40 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–10) — SHIPPED 2026-06-11</summary>

| Phase | Name                                                  | Plans | Completed  |
| ----- | ----------------------------------------------------- | ----- | ---------- |
| 1     | Monorepo Scaffold + Shared Types                      | 3/3   | 2026-05-28 |
| 2     | Move Validator + Unit Tests                           | 4/4   | 2026-05-29 |
| 3     | Server Room Manager + Socket.io Scaffold              | 3/3   | 2026-05-29 |
| 4     | Game Engine + Phase FSM                               | 3/3   | 2026-05-30 |
| 5     | Dice Resolver + All Resolution Branches               | 4/4   | 2026-05-30 |
| 6     | React Hex Grid Renderer                               | 3/3   | 2026-05-31 |
| 7     | Client-Server Integration                             | 4/4   | 2026-06-03 |
| 7.1   | UI Cleanup (INSERTED)                                 | 3/3   | 2026-06-04 |
| 8     | Match Lifecycle + Post-Game Replay                    | 8/8   | 2026-06-05 |
| 8.1   | Cleanup — Player Stats, Movement, Tackling (INSERTED) | 3/3   | 2026-06-05 |
| 8.2   | Passing Cleanup (INSERTED)                            | 6/6   | 2026-06-07 |
| 9     | Render Deployment                                     | 2/2   | 2026-06-08 |
| 10    | Remaining Action Flows + Tech Debt                    | 5/5   | 2026-06-11 |

Full archive: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · [Requirements](milestones/v1.0-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v1.1 UX Tuning & Bug Cleanup (Phases 11–14) — SHIPPED 2026-06-12</summary>

| Phase | Name                     | Plans | Completed  |
| ----- | ------------------------ | ----- | ---------- |
| 11    | Rule Correctness         | 4/4   | 2026-06-12 |
| 12    | Visual Token & Hex Layer | 4/4   | 2026-06-12 |
| 13    | Layout & Clock           | 3/3   | 2026-06-12 |
| 14    | Kick Off Rules & Replay  | 3/3   | 2026-06-12 |

Full archive: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) · [Requirements](milestones/v1.1-REQUIREMENTS.md) · [Audit](milestones/v1.1-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.2 Team Identity & Core Fixes (Phases 15–18.4) — SHIPPED 2026-07-03</summary>

| Phase | Name                               | Plans | Completed  |
| ----- | ---------------------------------- | ----- | ---------- |
| 15    | Team Identity                      | 3/3   | 2026-06-13 |
| 16    | Player Roster & Team Selection     | 4/4   | 2026-06-14 |
| 17    | Rule Bugs                          | 6/6   | 2026-06-21 |
| 17.1  | Action Flow Cleanup (INSERTED)     | 16/16 | 2026-06-20 |
| 18    | Messaging & Logging Consistency    | 3/3   | 2026-07-02 |
| 18.1  | Replay Review (INSERTED)           | 2/2   | 2026-06-21 |
| 18.2  | Code Cleanup & Dup-Bugs (INSERTED) | 6/6   | 2026-06-22 |
| 18.3  | Bug-Bash: Rule Correctness         | 5/5   | 2026-07-02 |
| 18.4  | UX Enhancements (INSERTED)         | 7/7   | 2026-07-02 |

Full archive: [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) · [Requirements](milestones/v1.2-REQUIREMENTS.md)

</details>

<details>
<summary>✅ v1.3 Team Customization & Formation System (Phases 19–25) — SHIPPED 2026-07-11</summary>

| Phase | Name                            | Plans | Completed  |
| ----- | ------------------------------- | ----- | ---------- |
| 19    | Data Model & Team Palette       | 3/3   | 2026-07-03 |
| 20    | Uniform Style System            | 3/3   | 2026-07-04 |
| 21    | New Teams (MLS + International) | 2/2   | 2026-07-04 |
| 22    | Uniform Selection Screen        | 3/3   | 2026-07-05 |
| 23    | Formation System                | 3/3   | 2026-07-05 |
| 24    | Auto-Assignment & Lineup        | 4/4   | 2026-07-10 |
| 25    | Bug & UAT Closure               | 9/9   | 2026-07-11 |

Full archive: [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) · [Requirements](milestones/v1.3-REQUIREMENTS.md) · [Audit](milestones/v1.3-MILESTONE-AUDIT.md)

</details>

---

<details>
<summary>✅ v1.4 Response Polish + Draft Mode (Phases 26–30) — SHIPPED 2026-07-22 (1 known gap)</summary>

| Phase | Name                          | Plans | Completed  |
| ----- | ----------------------------- | ----- | ---------- |
| 26    | Bug Fixes                     | 3/3   | 2026-07-12 |
| 27    | Game Creation Settings        | 5/5   | 2026-07-21 |
| 28    | Draft Data Model              | 4/4   | 2026-07-21 |
| 29    | Draft UI + Pick-and-Swap Flow | 12/12 | 2026-07-22 |
| 30    | Recalibrate Draft             | 6/6   | 2026-07-22 |

**Known gap:** RESP-01..09 (response-move single-selection activation model — half of this milestone's goal) was never implemented in any phase. Deferred to a future milestone.

Full archive: [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) · [Requirements](milestones/v1.4-REQUIREMENTS.md) · [Audit](milestones/v1.4-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.5 UX Refresh & Code Cleanup (Phases 31–36) — SHIPPED 2026-08-03</summary>

| Phase | Name                                      | Plans | Completed  |
| ----- | ----------------------------------------- | ----- | ---------- |
| 31    | Bug Fixes                                 | 6/6   | 2026-07-24 |
| 32    | Code Cleanup                              | 6/6   | 2026-07-25 |
| 33    | Design Tokens & Highlight Standardization | 7/7   | 2026-07-26 |
| 34    | Visual Theme Restyle                      | 5/5   | 2026-07-27 |
| 35    | ActionPanel & Log Standardization         | 6/6   | 2026-07-27 |
| 36    | Bug Fixes                                 | 5/5   | 2026-08-02 |

Full archive: [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) · [Requirements](milestones/v1.5-REQUIREMENTS.md) · [Audit](milestones/v1.5-MILESTONE-AUDIT.md)

</details>

---

### 🚧 v1.6 Fouls, Cards & Restarts (Phases 37–40) — IN PROGRESS

**Milestone Goal:** Bring the match engine to full rulebook fidelity for stoppages — fouls, bookings, injuries, substitutions, and the complete out-of-bounds restart set (throw-in, corner kick, goal kick, penalty kick) — each independently toggleable at game creation.

**Phase Order Rationale:** Out-of-bounds classification is a hard prerequisite for three of the four new restart types — throw-in, corner kick, and goal kick are all unreachable without it — so it lands first, paired with throw-in and goal kick (goal kick is built as its own dedicated setup flow per explicit product decision, not a reuse of the existing GK_RESTART chain, despite that reuse being the lower-effort path). Corner kick follows once that foundation exists, since it is the most state-machine-complex of the three restarts (two sequential repositioning windows, finer 2-at-a-time alternation than any existing staged flow). The fouls/cards/injury/GK-dive/penalty-kick cluster is the one true must-ship-together group in this milestone — injury and booking are unskippable side effects of every foul, and GK-dive-at-feet exists specifically to create a new foul source that feeds penalty kick, which has no other trigger — so it is deliberately sequenced third to give maximum lead time for resolving its rulebook ambiguities (which die triggers a foul, Professional Foul red-vs-yellow semantics) before implementation begins. Substitutions ships last: it is fully independent of every other cluster and only soft-depends on injury for one trigger source (forced substitution on a second injury), so placing it last avoids a small retroactive follow-up once that wiring already exists.

| Phase | Name          | Plans       | Status      |
| ----- | ------------- | ----------- | ----------- |
| 37    | 19/19         | Complete    | 2026-08-07  |
| 38    | 33/33         | Complete    | 2026-08-09  |
| 39    | 22/24         | In Progress |             |
| 40    | Substitutions | TBD         | Not started |

### Phase 37: Out-of-Bounds Detection, Throw-In & Goal Kick

**Goal**: The ball leaving the pitch over a sideline or the defending byline is classified by who last touched it and immediately playable as a throw-in or goal kick, with Out-of-Bounds/Restarts as its own independent, server-enforced game-creation toggle.
**Depends on**: Phase 36 (last phase of v1.5)
**Requirements**: OOB-01, OOB-02, OOB-04, OOB-05, THROWIN-01, THROWIN-02, THROWIN-03, THROWIN-04, THROWIN-05, GOALKICK-01, GOALKICK-02, GOALKICK-03, GOALKICK-04, GOALKICK-05, GOALKICK-06
**Success Criteria** (what must be TRUE):

1. The game continuously tracks which piece and team last touched the ball, independent of current possession.
2. When the ball exits over a sideline (an inaccurate pass or a loose ball), a throw-in is awarded to the team that did not last touch it; a new staged setup screen lets the attacking manager place a player with the ball at the exit hex, choose 1 or 2 Movement Phases, then throw Low (a Standard Pass, interceptable) or High (to a teammate's head, header required) up to 6 hexes — and a throw that itself exits the pitch is reclassified by the same detection system.
3. When the ball exits over the defending byline without last being touched by the attacking team (including an untouched off-target shot), the defending goalkeeper is awarded a goal kick as its own dedicated setup screen: both final-thirds reposition up to 6 hexes each (goalkeeper's team first), then the goalkeeper chooses a Kick (High Pass, combined score 8+ required, inaccurate results in a Loose Ball) or an unmodified Standard Pass, with both teams able to move one player up to 3 hexes while a Kicked ball travels and the receiver required to head it.
4. When Out-of-Bounds/Restarts is disabled at game creation, the ball continues to clamp to the pitch boundary exactly as it does today, and none of the new restart flows are reachable.

**Plans**: 19 plans
Plans:
**Wave 1**

- [x] 37-01-PLAN.md — Pure out-of-bounds classification module + required `ball.lastTouchedBy`

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 37-02-PLAN.md — New phases, state fields, last-action rows, action events and socket events

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 37-03-PLAN.md — Out-of-Bounds/Restarts game-creation toggle plumbed end to end

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 37-04-PLAN.md — Classification hooked into the LOOSE_BALL clamp; throw-in / goal-kick restart trigger

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 37-05-PLAN.md — Throw-in setup placement and the two-Movement-Phase choice model

**Wave 6** _(blocked on Wave 5 completion)_

- [x] 37-06-PLAN.md — The throw itself: 6-hex cap, Low/High reuse, context teardown, reclassification
- [x] 37-07-PLAN.md — Throw-in client surface: ThrowInSetupPanel, pitch wiring, action copy

**Wave 7** _(blocked on Wave 6 completion)_

- [x] 37-08-PLAN.md — Goal kick: two 6-hex reposition windows and the Kick/Standard-Pass choice

**Wave 8** _(blocked on Wave 7 completion)_

- [x] 37-09-PLAN.md — Goal kick: teammate-head target, 3-hex travel window, accuracy resolution

**Wave 9** _(blocked on Wave 8 completion)_

- [x] 37-10-PLAN.md — Goal-kick client surface: GoalKickSetupPanel, store wiring, pitch wiring

**Wave 10** _(gap closure from 37-VERIFICATION.md — plans run in parallel, no file overlap)_

- [x] 37-11-PLAN.md — CR-01 blocker: shared throw-in teardown on break-in-play early returns + sound applyEndTurn re-entry guard + regression test
- [x] 37-12-PLAN.md — WR-01/WR-02 warnings: throw-in waiting-state side label; goal-kick travel die generated only for the OPP slot

**Wave 11** _(gap closure from 37-VERIFICATION.md re-verification — GOALKICK-02 blocker)_

- [x] 37-13-PLAN.md — GOALKICK-02 blocker: on-pitch bounds guard for goal-kick reposition in applyGoalKickReposition and its GAME_MOVE handler branch + regression tests

**Wave 12** _(gap closure from 37-UAT.md — plans run in parallel, no file overlap)_

- [x] 37-14-PLAN.md — Even-q r=0 boundary hexes excluded from PITCH_HEXES/classifyExit in the shared rules package
- [x] 37-16-PLAN.md — Restart-panel error humaniser, throw-in duplicate line removal, THROW_IN_SETUP selection branch

**Wave 13** _(gap closure from 37-UAT.md, blocked on Wave 12)_

- [x] 37-15-PLAN.md — Goal kick restarts from a fixed byline-centre hex with the keeper moved there; applyFreeMove off-pitch guard
- [x] 37-17-PLAN.md — ELIGIBLE_NEXT_ACTIONS-cardinality auto-selection collapses the goal-kick Standard-Pass double-choice
- [x] 37-18-PLAN.md — HeaderTargetRing gold bullseye at goalKickTargetHex during GOAL_KICK_MOVE + HIGHLIGHT-REFERENCE.md correction

**Wave 14** _(gap closure from 37-UAT.md re-verification — test 6 header-contest radius)_

- [x] 37-19-PLAN.md — Generalise the white header-contest radius preview from HIGH_PASS_MOVE to GOAL_KICK_MOVE (headerContestZoneSet)

**UI hint**: yes

### Phase 38: Corner Kick

**Goal**: A ball exiting over the defending byline after last being touched by a defending player is awarded and fully playable as a corner kick, matching the physical rulebook's two-window repositioning and header/pass mechanics.
**Depends on**: Phase 37
**Requirements**: OOB-03, CORNER-01, CORNER-02, CORNER-03, CORNER-04, CORNER-05, CORNER-06
**Success Criteria** (what must be TRUE):

1. When the ball exits over the defending byline after last being touched by a defending player, a corner kick is awarded to the attacking team, and both goalkeepers may be repositioned first.
2. The kicking manager places a corner-taker with the ball in one of the corner's existing fixed corner-arc hexes, then each manager repositions up to 6 players, alternating 2 at a time, attacking manager first.
3. Immediately before the kick, in a second, separate repositioning window, both teams may each move one more player up to 3 hexes, attacking manager first.
4. The corner is taken as a High Pass (any hex in the penalty area with no distance limit, or elsewhere up to 15 hexes, receiver must attempt a header) or a Low Pass (no header), with the existing combined-score 8+ accuracy check applied to whichever is chosen.

**Plans**: 33 plans (9 original + 6 gap closure + 9 second-round gap closure + 6 third-round gap closure + 3 fourth-round gap closure)
Plans:
**Wave 1**

- [x] 38-01-PLAN.md — Shared contracts: corner phases, state fields, CORNER_KICK_HEX, CORNER_KICK_STAGES, eligibility row, client events

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 38-02-PLAN.md — Engine: corner trigger (OOB-03), goalkeeper reposition pair, corner-taker placement
- [x] 38-06-PLAN.md — Client: store selection branches, emitters, HexGrid selectability and tints

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 38-03-PLAN.md — Engine: alternating 6-hex window (CORNER-03) and pre-kick 3-hex window (CORNER-06)
- [x] 38-07-PLAN.md — Client: CornerKickSetupPanel, GameBoard dispatch, ball marker, action log

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 38-04-PLAN.md — Engine: High/Low kick resolution, accuracy gate, event/Undo/Replay registration

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 38-05-PLAN.md — Server handlers: corner socket surface, penalty-area range override, undo phases

**Wave 6** _(blocked on Wave 5 completion)_

- [x] 38-08-PLAN.md — Socket-level end-to-end integration coverage for OOB-03 and CORNER-01..06

**Wave 7** _(blocked on Wave 6 completion)_

- [x] 38-09-PLAN.md — Human verification: two-browser walkthrough and rulebook-assumption sign-off

**Wave 8** _(gap closure from 38-09-SUMMARY.md + 38-REVIEW.md — plans run in parallel, no file overlap)_

- [x] 38-10-PLAN.md — Engine: applyUndo CR-01/CR-02 corner fixes + WR-03 test strengthening
- [x] 38-11-PLAN.md — Client: Undo affordance in CornerKickSetupPanel (enabler for the item-7 live Undo check)

**Wave 9** _(gap closure, blocked on Wave 8)_

- [x] 38-12-PLAN.md — Engine: WR-01 replay piece-position tracking + WR-02 CORNER_KICK_STAGES cap read

**Wave 10** _(gap closure, blocked on Wave 9)_

- [x] 38-13-PLAN.md — Engine/client: A2 correction — Low Pass corners interceptable, High Pass not

**Wave 11** _(gap closure, blocked on Wave 10)_

- [x] 38-14-PLAN.md — Engine: real GK save-spill Loose Ball, second route into a Corner Kick (closes Phase 17.1 D-07)

**Wave 12** _(gap closure re-verification, blocked on all code-fix plans)_

- [x] 38-15-PLAN.md — Human verification: post-gap-closure two-browser walkthrough, D-GAP-01/D-GAP-02 rulings

**Wave 13** _(second gap-closure round from 38-15-SUMMARY.md — 4 new defects + the D-GAP-02 correction)_

- [x] 38-16-PLAN.md — Shared contracts: clear-out phase/event, activation + clear-out-slot + spill-keeper state, exclusion-zone and direction-only helpers

**Wave 14** _(blocked on Wave 13; three plans run in parallel, no file overlap)_

- [x] 38-17-PLAN.md — Engine: uncapped CORNER-03 reposition + one-activation-per-piece lock (defects 1 and 2, D-GAP-03)
- [x] 38-18-PLAN.md — Client: uncapped reposition, activated rendering, corrected panel copy (defects 1 and 2)
- [x] 38-19-PLAN.md — Client: restart banners for Throw In / Goal Kick / Corner Kick / Free Kick (defect 4)

**Wave 15** _(blocked on Wave 14)_

- [x] 38-20-PLAN.md — Engine: CORNER_KICK_CLEAR_OUT phase + permanent defender exclusion zone (defect 3)

**Wave 16** _(blocked on Wave 15)_

- [x] 38-21-PLAN.md — Handlers: clear-out socket surface + socket-level integration coverage (defect 3)

**Wave 17** _(blocked on Wave 16; two plans run in parallel, no file overlap)_

- [x] 38-22-PLAN.md — Client: clear-out panel, phase registration, exclusion-zone destination mirror (defect 3)
- [x] 38-23-PLAN.md — Engine: D-GAP-02 corrected — direction-only corner award on a spilled save

**Wave 18** _(second gap-closure re-verification, blocked on all code-fix plans)_

- [x] 38-24-PLAN.md — Human verification: full ten-step two-browser walkthrough, D-GAP-03 ruling

**Wave 19** _(third gap-closure round from 38-24-SUMMARY.md — 4 new defects; two plans run in parallel, no file overlap)_

- [x] 38-25-PLAN.md — Engine/handlers: automatic straight-line corner clear-out, interactive clear-out removed (bug 1)
- [x] 38-26-PLAN.md — Client: ActionLog CORNER_KICK_CLEAR_OUT_MOVE formatEvent case + compiler-exhaustive switch (bug 4)

**Wave 20** _(blocked on Wave 19; two plans run in parallel, no file overlap)_

- [x] 38-27-PLAN.md — Engine: free-kick-style bounded reposition placement, activation on completion (bug 2, D-GAP-03 corrected)
- [x] 38-28-PLAN.md — Client/shared: CORNER_KICK_CLEAR_OUT phase surface removed, Corner Kick banner re-keyed (bug 1)

**Wave 21** _(blocked on Wave 20)_

- [x] 38-29-PLAN.md — Client: bounded reposition UX, activation after the move, no activation marker in the pre-kick window (bugs 2 and 3)

**Wave 22** _(third gap-closure re-verification, blocked on all code-fix plans)_

- [x] 38-30-PLAN.md — Human verification: full ten-step two-browser walkthrough, A-AUTO-01 / A-GAP3-BUDGET / A-GAP3-AREA rulings

**Wave 23** _(fourth gap-closure round from 38-30-SUMMARY.md — the 2-2-2 window Undo regression; two plans run in parallel, no file overlap)_

- [x] 38-31-PLAN.md — Engine: clear lastDiceRoll at both corner reversible-window entries, LIFO multi-undo coverage (bug 2, D-GAP-01 re-opened)
- [x] 38-32-PLAN.md — Client: pin the Undo affordance and its enablement contract; record the offside-ring triage verdict (bug 2, bug 1 deferral)

**Wave 24** _(fourth gap-closure re-verification, blocked on Wave 23)_

- [x] 38-33-PLAN.md — Human verification: two-browser Undo re-verification, D-GAP-01 re-ruling, bug 1 deferral sign-off

**UI hint**: yes

### Phase 39: Fouls, Cards, Injuries & Penalty Kicks

**Goal**: A tackle, steal, or GK-dive-at-feet roll of 1 always resolves injury and booking before the attacker's continue-or-restart choice, with Professional Fouls, GK-dive-at-feet, and penalty kicks fully modeled — each of Fouls, Booking, and Injury independently toggleable at game creation.
**Depends on**: Phase 38
**Requirements**: FOUL-01, FOUL-02, FOUL-03, FOUL-04, FOUL-05, CARD-01, CARD-02, CARD-03, CARD-04, INJURY-01, INJURY-02, INJURY-03, INJURY-04, GKDIVE-01, GKDIVE-02, GKDIVE-03, GKDIVE-04, GKDIVE-05, PEN-01, PEN-02, PEN-03, FK-01, SETTINGS-01, SETTINGS-02, SETTINGS-03
**Success Criteria** (what must be TRUE):

1. A tackle or steal attempt whose defender's die shows exactly 1 calls a foul; injury (if enabled) and booking (if enabled) are rolled immediately, in that order, before the attacking manager chooses to continue play or take the restart — a free kick via the existing FREE_KICK_SETUP flow for tackle/steal-sourced fouls — and a Professional (Last Man) Foul, where no other defender can reach the tackle hex within remaining pace, triggers a straight-red-vs-yellow check instead of the normal booking roll.
2. An injured player (die ≥ Resilience) has all attributes reduced by 1 for the rest of the match; a second injury forces an immediate substitution, or leaves the player at degraded attributes if no substitute is available.
3. A booked player (die ≥ the referee's Leniency) receives a yellow card; a second yellow becomes a red card for that player with immediate dismissal and no substitute replacement.
4. During a defending Movement Phase, a goalkeeper adjacent to the ball carrier can tackle via the existing duel; when the carrier dribbles within 3 hexes of the goalkeeper parallel to the goal line, the GK's team may dive at the attacker's feet (at most once per movement cycle, -1 dice penalty from the 3rd hex, displacing any occupied piece and the ball one hex further in the dive direction on success), and a GK roll of 1 in either context fouls into a penalty kick regardless of the duel's outcome.
5. A penalty kick is a kicker-vs-goalkeeper duel with a -2 goalkeeper dice penalty; both teams freely reposition beforehand (only the kicker and the defending goalkeeper allowed in the penalty area, kicker chosen via the existing free-kick kicker-select flow), and a tied duel results in a Loose Ball at the penalty spot — and Fouls, Booking, and Injury are each independently toggleable at game creation, with Booking and Injury having no effect unless Fouls is also enabled.

**Plans**: 24 plans in 13 waves (17 original + 7 gap-closure)

**Wave 1** _(contract surface — everything depends on it)_

- [x] 39-01-PLAN.md — Shared types, events, PENALTY_SPOT; repair exhaustive PHASE_LABEL/ActionLog consumers; D-15 loose-ball log

**Wave 2** _(four parallel plans, no file overlap)_

- [x] 39-02-PLAN.md — Shared pure kernel: fouls.ts helpers + validateDiveAtFeetDistance
- [x] 39-03-PLAN.md — Four game-creation toggles end-to-end (SETTINGS-01..03, D-12/D-13/D-14)
- [x] 39-04-PLAN.md — EventBanner multi-event fix, foul/injury/booking banners, card badge + DOGSO
- [x] 39-05-PLAN.md — Client store: five emitters and selection/valid-hex wiring for the new phases

**Wave 3** _(four parallel plans)_

- [x] 39-06-PLAN.md — Card/injury indicators on PieceOverlay and PlayerStatsPanel (D-04/D-05)
- [x] 39-07-PLAN.md — Engine: penalty-kick chain, -2 GK penalty, tie-to-loose-ball (PEN-01..03)
- [x] 39-08-PLAN.md — PenaltyKickSetupPanel
- [x] 39-09-PLAN.md — FoulChoicePanel, GkDiveAtFeetPromptPanel, GkBoxEntryPromptPanel

**Wave 4** _(engine and handlers in parallel)_

- [x] 39-10-PLAN.md — Engine: foul detection, injury, booking, professional foul, foul choice, FK-01
- [x] 39-11-PLAN.md — Handlers: penalty-kick sockets + integration suite

**Wave 5**

- [x] 39-12-PLAN.md — Engine: GK dive at feet, displacement, D-09 shared cap at all four GK_DIVE sites
- [x] 39-13-PLAN.md — Handlers: GAME_FOUL_CHOICE, server-rolled injury/booking dice, FK-01 integration

**Wave 6**

- [x] 39-14-PLAN.md — Engine: box-entry GK response (D-10/D-11) and second-half mutual confirm (D-16)

**Wave 7**

- [x] 39-15-PLAN.md — Handlers: broadcast-time offer hooks, GK prompts, reworked GAME_HALF_TIME_START

**Wave 8**

- [x] 39-16-PLAN.md — Client integration: GameBoard dispatch, ball marker, highlights, mutual-confirm button

**Wave 9**

- [x] 39-17-PLAN.md — Undo/Replay registration audit + blocking two-browser human verification

**Wave 10** _(gap closure — 9 live-UAT defects from 39-UAT.md)_

- [x] 39-18-PLAN.md — Foul restart routing, location and time cost (UAT gaps 1, 2, 9)

**Wave 11** _(two parallel plans, no file overlap)_

- [x] 39-19-PLAN.md — DOGSO goal-side + goal-path geometry rework (UAT gap 8)
- [x] 39-20-PLAN.md — GK dive-at-feet target phase + GK relocation, shared dive cap (UAT gaps 3-server, 4)

**Wave 12** _(two parallel plans, no file overlap)_

- [x] 39-21-PLAN.md — Client interaction for choosing the dive destination hex (UAT gap 3-client)
- [x] 39-22-PLAN.md — All in-box fouls award a penalty; award-time setup and reposition locks (UAT gap 5)

**Wave 13** _(two parallel plans, no file overlap)_

- [ ] 39-23-PLAN.md — Penalty-taker select-and-confirm UX and shoot-only restart (UAT gap 6)
- [ ] 39-24-PLAN.md — Tackle-from-behind rule and distinct Action Log entry (UAT gap 7)

**UI hint**: yes

### Phase 40: Substitutions

**Goal**: Managers can substitute players at any stoppage under a 3-per-match cap, with number/position inheritance, added-time contribution, and restrictions on red-carded or previously-substituted players — regardless of which other v1.6 toggles are enabled.
**Depends on**: Phase 39 (soft — substitution mechanics are independently built; only the forced-2nd-injury trigger and red-card non-replacement rule read Phase 39 state)
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06, SUB-07, SETTINGS-04
**Success Criteria** (what must be TRUE):

1. A manager can substitute a player at any stoppage (kick-off, half-time, free kick, penalty kick, goal kick, corner kick, or throw-in setup) via drag-and-drop on the Roster screen, regardless of which other v1.6 toggles are enabled.
2. The substitute inherits the departing player's jersey number and pitch position/lineup slot, and each team is limited to 3 substitutions for the full match — the count never resets at half-time.
3. Each completed substitution adds 1 minute to the current half's added-time calculation.
4. A red-carded player cannot be replaced by a substitute, and a player who has been substituted out is shown a clear "unavailable" indicator on the roster screen and can never return for the remainder of the match.

**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase                                   | Milestone | Plans Complete | Status      | Completed  |
| --------------------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Monorepo Scaffold                    | v1.0      | 3/3            | Complete    | 2026-05-28 |
| 2. Move Validator                       | v1.0      | 4/4            | Complete    | 2026-05-29 |
| 3. Server Room Manager                  | v1.0      | 3/3            | Complete    | 2026-05-29 |
| 4. Game Engine + FSM                    | v1.0      | 3/3            | Complete    | 2026-05-30 |
| 5. Dice Resolver                        | v1.0      | 4/4            | Complete    | 2026-05-30 |
| 6. React Hex Grid                       | v1.0      | 3/3            | Complete    | 2026-05-31 |
| 7. Client-Server Integration            | v1.0      | 4/4            | Complete    | 2026-06-03 |
| 7.1. UI Cleanup                         | v1.0      | 3/3            | Complete    | 2026-06-04 |
| 8. Match Lifecycle                      | v1.0      | 8/8            | Complete    | 2026-06-05 |
| 8.1. Cleanup                            | v1.0      | 3/3            | Complete    | 2026-06-05 |
| 8.2. Passing Cleanup                    | v1.0      | 6/6            | Complete    | 2026-06-07 |
| 9. Render Deployment                    | v1.0      | 2/2            | Complete    | 2026-06-08 |
| 10. Remaining Flows                     | v1.0      | 5/5            | Complete    | 2026-06-11 |
| 11. Rule Correctness                    | v1.1      | 4/4            | Complete    | 2026-06-12 |
| 12. Visual Token & Hex Layer            | v1.1      | 4/4            | Complete    | 2026-06-12 |
| 13. Layout & Clock                      | v1.1      | 3/3            | Complete    | 2026-06-12 |
| 14. Kick Off Rules & Replay             | v1.1      | 3/3            | Complete    | 2026-06-12 |
| 15. Team Identity                       | v1.2      | 3/3            | Complete    | 2026-06-13 |
| 16. Player Roster & Selection           | v1.2      | 4/4            | Complete    | 2026-06-14 |
| 17. Rule Bugs                           | v1.2      | 6/6            | Complete    | 2026-06-21 |
| 17.1. Action Flow Cleanup               | v1.2      | 16/16          | Complete    | 2026-06-20 |
| 18. Messaging & Logging Cons.           | v1.2      | 3/3            | Complete    | 2026-07-02 |
| 18.1. Replay Review                     | v1.2      | 2/2            | Complete    | 2026-06-21 |
| 18.2. Code Cleanup & Dup-Bugs           | v1.2      | 6/6            | Complete    | 2026-06-22 |
| 18.3. Bug-Bash (Rule Correct.)          | v1.2      | 5/5            | Complete    | 2026-07-02 |
| 18.4. UX Enhancements                   | v1.2      | 7/7            | Complete    | 2026-07-02 |
| 19. Data Model & Team Palette           | v1.3      | 3/3            | Complete    | 2026-07-03 |
| 20. Uniform Style System                | v1.3      | 3/3            | Complete    | 2026-07-04 |
| 21. New Teams (MLS + Intl)              | v1.3      | 2/2            | Complete    | 2026-07-04 |
| 22. Uniform Selection Screen            | v1.3      | 3/3            | Complete    | 2026-07-05 |
| 23. Formation System                    | v1.3      | 3/3            | Complete    | 2026-07-05 |
| 24. Auto-Assignment & Lineup            | v1.3      | 4/4            | Complete    | 2026-07-10 |
| 25. Bug & UAT Closure                   | v1.3      | 9/9            | Complete    | 2026-07-11 |
| 26. Bug Fixes                           | v1.4      | 3/3            | Complete    | 2026-07-12 |
| 27. Game Creation Settings              | v1.4      | 5/5            | Complete    | 2026-07-21 |
| 28. Draft Data Model                    | v1.4      | 4/4            | Complete    | 2026-07-21 |
| 29. Draft UI + Pick-and-Swap            | v1.4      | 12/12          | Complete    | 2026-07-22 |
| 30. Recalibrate Draft                   | v1.4      | 6/6            | Complete    | 2026-07-22 |
| 31. Bug Fixes                           | v1.5      | 6/6            | Complete    | 2026-07-24 |
| 32. Code Cleanup                        | v1.5      | 6/6            | Complete    | 2026-07-25 |
| 33. Design Tokens & Highlight           | v1.5      | 7/7            | Complete    | 2026-07-26 |
| 34. Visual Theme Restyle                | v1.5      | 5/5            | Complete    | 2026-07-27 |
| 35. ActionPanel & Log Standard.         | v1.5      | 6/6            | Complete    | 2026-07-27 |
| 36. Bug Fixes                           | v1.5      | 5/5            | Complete    | 2026-08-02 |
| 37. OOB Detection, Throw-In & Goal Kick | v1.6      | 0/TBD          | Not started | -          |
| 38. Corner Kick                         | v1.6      | 0/TBD          | Not started | -          |
| 39. Fouls, Cards & Penalty Kicks        | v1.6      | 0/17           | Planned     | -          |
| 40. Substitutions                       | v1.6      | 0/TBD          | Not started | -          |
