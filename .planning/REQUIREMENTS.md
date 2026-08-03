# Requirements: Counter Attack POC

**Defined:** 2026-08-03
**Core Value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## v1.6 Requirements

### Fouls (FOUL)

- [ ] **FOUL-01**: A tackle or steal attempt whose defending player's own die shows exactly 1 calls a foul on that defender (nutmeg is a distinct move deferred to a future milestone — not a v1.6 trigger)
- [ ] **FOUL-02**: A foul immediately rolls an injury check (if Injury is enabled) and a booking check (if Booking is enabled), in that order, before the attacker's continue-or-restart choice
- [ ] **FOUL-03**: After those rolls resolve, the attacking manager chooses to continue play or take the restart (free kick, or penalty if the foul came from a GK-dive-at-feet)
- [ ] **FOUL-04**: A Professional (Last Man) Foul — no other defending piece can reach the tackle hex within its remaining pace this movement phase — triggers the straight-red-vs-yellow booking check (CARD-03) instead of the normal booking roll
- [ ] **FOUL-05**: Fouls (detection, injury, GK-dive-at-feet, professional-foul check, and the resulting restart) is enabled/disabled via an independent game-creation toggle

### Cards / Booking (CARD)

- [ ] **CARD-01**: When Booking is enabled and a foul occurs, a die ≥ the referee's Leniency attribute issues a yellow card to the fouling player; Booking has no effect if Fouls is disabled
- [ ] **CARD-02**: A player's second yellow card (tracked per-player) becomes a red card for that player — immediate dismissal, no substitute replacement
- [ ] **CARD-03**: A Professional (Last Man) Foul rolls directly for red-vs-yellow (≥ Leniency = straight red, otherwise yellow) instead of the normal single booking roll
- [ ] **CARD-04**: Booking is enabled/disabled via a game-creation toggle independent of Fouls, Injury, and Out-of-Bounds/Restarts

### Injury (INJURY)

- [ ] **INJURY-01**: After a foul, a die ≥ the fouled player's Resilience attribute injures them
- [ ] **INJURY-02**: An injured player has all attributes reduced by 1, floored at 1, for the rest of the match
- [ ] **INJURY-03**: A second injury forces an immediate substitution; if none is available, the player continues at degraded attributes rather than blocking the match
- [ ] **INJURY-04**: Injury is enabled/disabled via an independent game-creation toggle (no effect unless Fouls is also enabled)

### GK Dive at Feet (GKDIVE)

- [ ] **GKDIVE-01**: During a defending Movement Phase, a goalkeeper adjacent to the ball carrier reuses the existing tackle duel with the GK as tackler (no new duel type)
- [ ] **GKDIVE-02**: Whenever the ball carrier dribbles within 3 hexes of the goalkeeper, parallel to the goal line, the GK's team gets an interrupt opportunity to dive at the attacker's feet — alternating turn-by-turn as long as the attacker remains in range, comparing (Saving + dice) vs (Dribbling + dice), with a -1 dice penalty diving from the 3rd hex
- [ ] **GKDIVE-03**: A GK roll of 1 in either dive-at-feet context is a foul awarding a penalty kick (not a free kick), regardless of the duel's outcome
- [ ] **GKDIVE-04**: A successful dive landing on an occupied hex displaces every piece there (and the ball, if present) one hex further in the dive direction
- [ ] **GKDIVE-05**: A goalkeeper may attempt the attacking-phase dive-at-feet at most once per movement cycle (the existing 4-5-2 slot sequence), even if the attacker remains in range across multiple hex-steps

### Penalty Kick (PEN)

- [ ] **PEN-01**: A penalty kick is a duel between the penalty taker and the goalkeeper, with the goalkeeper's combined score taking a -2 dice penalty
- [ ] **PEN-02**: Before a penalty kick, both teams freely reposition all players, with only the penalty taker and the defending goalkeeper allowed inside the penalty area; the kicker is chosen via the existing free-kick kicker-select flow
- [ ] **PEN-03**: A tied penalty-kick duel results in a Loose Ball at the penalty spot, following the existing Loose Ball rules

### Foul-Triggered Free Kick (FK)

- [ ] **FK-01**: A foul from a tackle or steal attempt (not from a GK-dive-at-feet) awards a free kick using the existing FREE_KICK_SETUP flow, with a new foul-based trigger alongside the existing offside trigger

### Substitutions (SUB)

- [ ] **SUB-01**: A manager can substitute a player at any stoppage (kick-off, half-time, free kick, penalty kick, goal kick, corner kick, or throw-in setup), regardless of which other v1.6 toggles are enabled
- [ ] **SUB-02**: Substitutions are made via the Roster screen using drag-and-drop to replace an on-pitch player with a bench player; each substitution action replaces exactly one player
- [ ] **SUB-03**: A substitute inherits the departing player's jersey number and pitch position/lineup slot
- [ ] **SUB-04**: Each team is limited to 3 substitutions for the full match (not per half); the count never resets at half-time
- [ ] **SUB-05**: Each completed substitution adds 1 minute to the current half's added-time calculation
- [ ] **SUB-06**: A red-carded (sent-off) player cannot be replaced by a substitute
- [ ] **SUB-07**: A player who has been substituted out may never return to play for the remainder of the match, and is shown a clear "unavailable" indicator on the roster screen

### Goal Kick (GOALKICK)

- [ ] **GOALKICK-01**: Goal kick is its own dedicated restart flow, independent of the existing GK-catch/save restart chain
- [ ] **GOALKICK-02**: When a goal kick is awarded, both final-thirds' players may reposition up to 6 hexes each — the goalkeeper's team repositions first, then the opposing team
- [ ] **GOALKICK-03**: The goalkeeper then chooses to Kick the ball (High Pass accuracy check, combined score 8+ required) or take a Standard Pass
- [ ] **GOALKICK-04**: An inaccurate Kick follows the existing Loose Ball rules; the Standard Pass option uses the existing Standard Pass mechanic unmodified (no header requirement)
- [ ] **GOALKICK-05**: While a Kicked ball travels, both teams may each move one player up to 3 hexes; the Kick must target a teammate's head, and the receiver must attempt a header
- [ ] **GOALKICK-06**: Out-of-Bounds/Restarts (goal kick, corner kick, throw-in, and out-of-bounds detection) is enabled/disabled via a game-creation toggle independent of Fouls, Booking, and Injury

### Corner Kick (CORNER)

- [ ] **CORNER-01**: When a corner kick is awarded, both goalkeepers may be repositioned first
- [ ] **CORNER-02**: The kicking manager selects a corner-taker and places them in one of the corner's existing fixed corner-arc hexes with the ball
- [ ] **CORNER-03**: Each manager then repositions up to 6 players, alternating 2 players at a time, attacking manager first
- [ ] **CORNER-04**: The corner is taken as a High Pass (any hex within the penalty area with no distance limit, or elsewhere up to 15 hexes) or a Low Pass, with the existing combined-score accuracy check (8+) applied to whichever is chosen
- [ ] **CORNER-05**: A High Pass corner requires the receiving player to attempt a header; a Low Pass does not
- [ ] **CORNER-06**: Immediately before the kick, before the target is declared, both teams may each move one more player up to 3 hexes (attacking manager first) — a second, separate repositioning window from CORNER-03

### Throw-In (THROWIN)

- [ ] **THROWIN-01**: A throw-in is awarded when the ball exits the pitch over a sideline — whether from an inaccurate High Pass, an inaccurate Standard/Long Pass, or a Loose Ball
- [ ] **THROWIN-02**: The attacking manager selects a player and places them, with the ball, at the last in-bounds hex the ball crossed before exiting
- [ ] **THROWIN-03**: The throwing manager chooses 1 or 2 Movement Phases to complete before taking the throw
- [ ] **THROWIN-04**: The throw travels up to 6 hexes, either Low (a Standard Pass, interceptable) or High (to a teammate's head, not interceptable, and the receiver must attempt a header)
- [ ] **THROWIN-05**: A throw that itself exits the pitch is reclassified by the Out-of-Bounds Detection system exactly like any other exit (sideline → throw-in to the other team, byline → corner/goal kick per the normal rules)

### Out-of-Bounds Detection (OOB)

- [ ] **OOB-01**: The game tracks which piece (and team) last touched the ball, independent of current possession
- [ ] **OOB-02**: The ball exiting over a sideline awards a throw-in to the team that did not last touch it
- [ ] **OOB-03**: The ball exiting over a byline after last being touched by a defending player awards a corner kick to the attacking team
- [ ] **OOB-04**: The ball exiting over a byline after last being touched by an attacking player (or without being touched, e.g. an off-target shot) awards a goal kick to the defending team
- [ ] **OOB-05**: When Out-of-Bounds/Restarts is disabled, the ball continues to clamp to the pitch boundary exactly as it does today — none of OOB-01..04 or the Goal Kick/Corner Kick/Throw-In flows are reachable

### Settings (SETTINGS)

- [ ] **SETTINGS-01**: Game creation offers 4 independent toggles — Fouls, Booking, Injury, and Out-of-Bounds/Restarts — any combination of which can be enabled
- [ ] **SETTINGS-02**: Booking has no effect unless Fouls is also enabled
- [ ] **SETTINGS-03**: Injury has no effect unless Fouls is also enabled
- [ ] **SETTINGS-04**: Substitutions are always available regardless of toggle state

## Future Requirements

### Response Activation (carried forward from v1.4/v1.5, deferred again)

- **RESP-01 through RESP-09**: Response-move (header/deflect/final-third/dive/keeper-ball-in-box) single-selection activation model with eligibility gating, range-hex highlighting, and auto-skip. Still not scheduled — see `.planning/v1.4-MILESTONE-AUDIT.md`.

### Nutmeg (raised during v1.6 scoping, deferred)

- **NUTMEG-01+**: Nutmeg as its own distinct move (confirmed by the user to be a separate mechanic from the existing steal-attempt action, not yet designed) — deferred to a future milestone.

### Rule Expansion (carried forward from v1.5, deferred)

- **STATS-01+**: Game-stats overlay — possession, tackles, shots, goals, xG, interceptions, saves

## Out of Scope

| Feature                                                                | Reason                                                                                                                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nutmeg as a distinct move                                              | Confirmed to be its own mechanic, not the existing steal attempt — deferred to a future milestone (see Future Requirements)                                      |
| Extra Time / overtime periods                                          | "Extra Time" in this rulebook refers to injury/stoppage added time (already implemented via MATCH-02), not a post-match overtime period — no new mechanic needed |
| Substitution roster limit beyond 3 (e.g. Extra Time's rulebook +1 sub) | No Extra Time period exists in this implementation, so there is nothing for the +1 to attach to                                                                  |
| AI / single-player mode                                                | Not planned                                                                                                                                                      |
| Animations (piece movement between hexes)                              | Static state updates only                                                                                                                                        |
| Mobile layout                                                          | Desktop-first (responsive-aware but not mobile-first)                                                                                                            |
| Sound effects / audio                                                  | Not planned                                                                                                                                                      |
| Reconnection grace-period bug fix                                      | Pre-existing `createServer.ts` bug, tracked as tech debt, not part of this milestone's rule-fidelity scope                                                       |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
| ----------- | ----- | ------ |

**Coverage:**

- v1.6 requirements: 55 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 55 ⚠️ (pending roadmap)

---

_Requirements defined: 2026-08-03_
_Last updated: 2026-08-03 after initial v1.6 definition_
