# Requirements — Counter Attack Web v1.2

**Milestone:** Team Identity & Core Fixes
**Status:** In Progress
**Phases:** 15–18 (starting at Phase 15)

---

## Team Identity

- [ ] **TEAM-01**: Four teams defined in shared types with name, primary color, and badge component — Cozmos, Xolos, City, Crew
- [x] **TEAM-02**: Cozmos — home blue; badge depicts a galaxy or star pattern; jersey has a horizontal stripe that is 3× wider than the current stripe
- [x] **TEAM-03**: Xolos — orange; badge depicts a coyote; orange jersey with a grey checker pattern
- [x] **TEAM-04**: City — red with gold accent; badge is an STL City–style design; red jersey with a gold arch line across the lower half and vertical stripes
- [x] **TEAM-05**: Crew — gold; badge is a Columbus Crew–style design; gold jersey with 45-degree black stripes across the shoulders
- [x] **TEAM-06**: Team badge is displayed in the team selection screen, the player card, and the scoreboard top band

## Player Roster

- [ ] **PLAY-01**: Player data updated from fc_stats.csv — all four team squads (Cozmos, Xolos, City, Crew) populated with correct names, nationalities, positions, and attributes; remaining players stored as Free Agents (no team assigned)
- [ ] **PLAY-02**: Player card component shows First Name on line 1, Last Name on line 2, and a third row with Badge | Position | # (shirt number)
- [ ] **PLAY-03**: Free Agent players are stored in the system but not selectable during team selection; reserved for future use

## Team Selection

- [ ] **SELECT-01**: A team selection screen is presented before the player enters the field; the home player selects their team first, then the away player selects from the remaining teams; the selected team's badge and colors are applied throughout the match

## Bug Fixes

- [ ] **BUG-01**: The header pass executed by the winner of a high pass contest is not blockable — the block option is absent when a player executes a header and the server rejects any block attempt on a header; the high pass contest itself (determining who wins the header) is unaffected
- [ ] **BUG-02**: Every action phase shows a back/cancel control until an irreversible change has been made (piece moved, dice rolled, target hex committed); the back control returns the player to the previous decision step without consuming their action
- [ ] **BUG-03**: Moves made in the Movement Phase before a header is triggered (pre-header moves) can be undone; undo restores piece position and pace allowance as if the move had not been made
- [ ] **BUG-04**: A pass (any type except High Pass) whose trajectory ends on a hex occupied by a player results in ball pickup by that player; if the player is on the defending team, possession transfers to the defending team immediately
- [ ] **BUG-05**: When a goalkeeper save results in a loose ball, the loose ball spawns at the goalkeeper's hex (the save location), not at the shot origin hex

## Carry-forward Bugs

- [ ] **MOVE-06**: Server implements the free 6-hex move rule — after completing a normal action, outfield players in the opponent's final third may each move up to 6 hexes for free; the scaffolded handler in `gameEngine.ts:517` is completed and connected
- [ ] **PASS-02**: During a First-time Pass flight, each team may move one player up to 1 hex; the TODO at `gameEngine.ts:1087` is implemented

## Design Review

- [ ] **DESIGN-01**: All player-facing messages and status text (action panel labels, phase prompts, error messages, log entries) are reviewed for consistency in tone, tense, and terminology; inconsistencies are corrected
- [ ] **DESIGN-02**: Post-game replay playback is reviewed; unnecessary re-renders, redundant socket emissions, or frame-rate issues are identified and resolved
- [ ] **DESIGN-03**: Duplicate logic across server handlers and client components is identified and consolidated into shared helpers where appropriate
- [ ] **DESIGN-04**: Dead code — unused exports, unreachable branches, stale TODO comments, and legacy feature flags — is removed from the client and server packages

## Carry-forward from v1.1

- [ ] **REPLAY-06**: Ball position updates correctly on every replay frame in a live session; ball correctly tracks pickups, intercepted passes, and steals mid-replay; UAT Test 6 from v1.1 passes
- [ ] **MATCH-06** _(req text only)_: Requirement text is updated to reflect symmetric mirror intent — the formation description is perspective-neutral (e.g., "each team's DEF/MID placed within N hex-columns of the kick-off hex from their own end")

---

## Traceability

| REQ-ID    | Phase    | Status   |
| --------- | -------- | -------- |
| TEAM-01   | Phase 15 | Pending  |
| TEAM-02   | Phase 15 | Complete |
| TEAM-03   | Phase 15 | Complete |
| TEAM-04   | Phase 15 | Complete |
| TEAM-05   | Phase 15 | Complete |
| TEAM-06   | Phase 15 | Complete |
| PLAY-01   | Phase 16 | Pending  |
| PLAY-02   | Phase 16 | Pending  |
| PLAY-03   | Phase 16 | Pending  |
| SELECT-01 | Phase 16 | Pending  |
| BUG-01    | Phase 17 | Pending  |
| BUG-02    | Phase 17 | Pending  |
| BUG-03    | Phase 17 | Pending  |
| BUG-04    | Phase 17 | Pending  |
| BUG-05    | Phase 17 | Pending  |
| MOVE-06   | Phase 17 | Pending  |
| PASS-02   | Phase 17 | Pending  |
| DESIGN-01 | Phase 18 | Pending  |
| DESIGN-02 | Phase 18 | Pending  |
| DESIGN-03 | Phase 18 | Pending  |
| DESIGN-04 | Phase 18 | Pending  |
| REPLAY-06 | Phase 18 | Pending  |
| MATCH-06  | Phase 18 | Pending  |
