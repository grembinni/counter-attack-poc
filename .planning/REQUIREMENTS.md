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

- [x] **PLAY-01**: Player data updated from fc_stats.csv — all four team squads (Cozmos, Xolos, City, Crew) populated with correct names, nationalities, positions, and attributes; remaining players stored as Free Agents (no team assigned)
- [x] **PLAY-02**: Player card component shows First Name on line 1, Last Name on line 2, and a third row with Badge | Position | # (shirt number)
- [x] **PLAY-03**: Free Agent players are stored in the system but not selectable during team selection; reserved for future use

## Team Selection

- [x] **SELECT-01**: A team selection screen is presented before the player enters the field; the home player selects their team first, then the away player selects from the remaining teams; the selected team's badge and colors are applied throughout the match

## Bug Fixes

- [x] **BUG-01**: The header pass executed by the winner of a high pass contest is not blockable — the block option is absent when a player executes a header and the server rejects any block attempt on a header; the high pass contest itself (determining who wins the header) is unaffected
- [x] **BUG-02**: Every action phase shows a back/cancel control until an irreversible change has been made (piece moved, dice rolled, target hex committed); the back control returns the player to the previous decision step without consuming their action
- [x] **BUG-03**: Moves made in the Movement Phase before a header is triggered (pre-header moves) can be undone; undo restores piece position and pace allowance as if the move had not been made
- [x] **BUG-04**: A pass (any type except High Pass) whose trajectory ends on a hex occupied by a player results in ball pickup by that player; if the player is on the defending team, possession transfers to the defending team immediately
- [x] **BUG-05**: When a goalkeeper save results in a loose ball, the loose ball spawns at the goalkeeper's hex (the save location), not at the shot origin hex

## Carry-forward Bugs

- [x] **MOVE-06**: Server implements the free 6-hex move rule — after completing a normal action, outfield players in the opponent's final third may each move up to 6 hexes for free; the scaffolded handler in `gameEngine.ts:517` is completed and connected
- [x] **PASS-02**: During a First-time Pass flight, each team may move one player up to 1 hex. Delivered by Phase 17.1 two-slot FIRST_TIME_PASS_MOVE redesign (Phase 17 plan 17-05 single-step design cancelled/superseded).

## Offside Rule (Addendum — Phase 17)

- [ ] **OFFSIDE-01**: The server detects offside per the three-condition trigger (past the half-field line in the player's team attacking direction, ahead of the ball in that direction, and ≤1 opposing piece — any role, GK included — positioned equal-to-or-ahead of the player) and re-evaluates it at every end-of-phase where pieces can move. The flag is **sticky**: once set on a piece it persists across subsequent end-of-phase checks until that piece ends a turn either equal-to-or-behind the ball OR with ≥2 opposing pieces equal-to-or-ahead. The check applies to **every** piece on the pitch, evaluated relative to that piece's own team attacking direction. A flagged piece renders a double-width red ring around its token, independent of and layered over its selection state.
- [ ] **OFFSIDE-02**: When a flagged-offside player gains possession of the ball — including winning a header — a free kick is immediately awarded to the team that did NOT commit the offside, taken from the offside player's hex at the moment the foul triggered. Before the kick, both teams may reposition their entire squad anywhere on the board, subject to: the defending team (relative to the kicking team) may not place any piece within 2 hexes of the restart hex, and the kicking team must have exactly one piece on the restart hex. From the free kick the only legal actions are Standard Pass, High Pass, Long Ball, and Shot (Shot only if the kicker is within shooting range).

## Design Review

- [ ] **DESIGN-01**: All player-facing messages and status text (action panel labels, phase prompts, error messages, log entries) are reviewed for consistency in tone, tense, and terminology; inconsistencies are corrected
- [ ] **DESIGN-02**: Post-game replay playback is reviewed; unnecessary re-renders, redundant socket emissions, or frame-rate issues are identified and resolved
- [ ] **DESIGN-03**: Duplicate logic across server handlers and client components is identified and consolidated into shared helpers where appropriate
- [ ] **DESIGN-04**: Dead code — unused exports, unreachable branches, stale TODO comments, and legacy feature flags — is removed from the client and server packages

## Carry-forward from v1.1

- [ ] **REPLAY-06**: Ball position updates correctly on every replay frame in a live session; ball correctly tracks pickups, intercepted passes, and steals mid-replay; UAT Test 6 from v1.1 passes
- [ ] **MATCH-06** _(req text only)_: Requirement text is updated to reflect symmetric mirror intent — the formation description is perspective-neutral (e.g., "each team's DEF/MID placed within N hex-columns of the kick-off hex from their own end")

## Bug Bash (Addendum — Phase 18, gathered 2026-06-20 during discuss-phase)

- [ ] **BUG-06**: The server resets `offsidePieceIds` to an empty array for ALL players when a free-kick restart concludes and the ball returns to live play, not only for the offending player (regression/gap in the D-43/D-47 full-reset behavior from Phase 17)
- [ ] **BUG-07**: After a header duel is won, the subsequent pass is delivered without an intermediate no-op target-selection sub-phase; the resulting pass is non-contestable and is labeled/logged as a header, not as a one-touch/first-time pass
- [ ] **BUG-08**: Once a defender's tackle or steal attempt against a piece has failed (that action type's `stealAttemptedByIds`/`tackleAttemptedByIds` flag is set), the attacker can move freely adjacent to that defender — no threat highlight and no repeat challenge for that action type — matching the per-action-type ZoI exclusion already defined for `moveValidator` (D-02, Phase 17.1)
- [ ] **BUG-09**: During response-move phases (header repositioning, snapshot deflect, first-time-pass repositioning, high-pass repositioning, GK-kick repositioning, free-kick setup, etc.), the active piece's move-ring highlight clears once that piece has used its phase-imposed pace allowance, and clears/recomputes correctly when End Turn hands control to the opponent
- [ ] **BUG-10**: Clicking an already-activated (already-moved) player piece opens that piece's player card, matching the click behavior of unmoved pieces
- [ ] **BUG-11**: HIGH_PASS_MOVE excludes the original high-pass carrier (`highPassCarrierId`) from repositioning onto the pass target hex during its own GAME_MOVE handler, mirroring the FIRST_TIME_PASS_MOVE self-pass-reclaim fix delivered in Phase 17.1-16

## UX Enhancements (Addendum — Phase 18, gathered 2026-06-20 during discuss-phase)

- [ ] **UX-07**: A game-speed selector (Slow / Standard / Fast, default Standard) is presented on the team-selection screen; the selection sets how many match-clock minutes elapse per completed MOVE action (Slow = 1, Standard = 2, Fast = 3)
- [ ] **UX-08**: Any End Turn (or header Confirm Selection) action that would end a phase while eligible pieces remain unmoved/unplaced shows a confirmation prompt ("X players left to move, are you sure you want to end your turn?") with the option to cancel and return to the phase; the End Turn / Confirm Selection control renders orange while eligible moves remain and green once all eligible pieces have moved or been placed
- [ ] **UX-09**: The board renders a visual marker (red boundary line) across the top and bottom rows marking the boundary of each team's final third
- [ ] **UX-10**: The Free Move helper text explains that when the ball enters the opposite final third, that team's backline may reposition up to 6 hexes regardless of remaining pace, and shows the count of eligible players still able to move
- [ ] **UX-11**: The Movement phase helper text tracks and displays the number of players left to move, mirroring the existing header-contestant-selection helper pattern
- [ ] **UX-12**: Hovering over a player stat bubble shows a tooltip with the stat's full name
- [ ] **UX-13**: Hovering over an action button shows a tooltip with a short summary of that action
- [ ] **UX-14**: A transient (1-second) banner appears centered on screen for key match events (e.g., goal, interception, tackle/turnover)

---

## Traceability

| REQ-ID     | Phase      | Status   |
| ---------- | ---------- | -------- |
| TEAM-01    | Phase 15   | Pending  |
| TEAM-02    | Phase 15   | Complete |
| TEAM-03    | Phase 15   | Complete |
| TEAM-04    | Phase 15   | Complete |
| TEAM-05    | Phase 15   | Complete |
| TEAM-06    | Phase 15   | Complete |
| PLAY-01    | Phase 16   | Complete |
| PLAY-02    | Phase 16   | Complete |
| PLAY-03    | Phase 16   | Complete |
| SELECT-01  | Phase 16   | Complete |
| BUG-01     | Phase 17   | Complete |
| BUG-02     | Phase 17   | Complete |
| BUG-03     | Phase 17   | Complete |
| BUG-04     | Phase 17   | Complete |
| BUG-05     | Phase 17   | Complete |
| MOVE-06    | Phase 17   | Complete |
| PASS-02    | Phase 17.1 | Complete |
| OFFSIDE-01 | Phase 17   | Pending  |
| OFFSIDE-02 | Phase 17   | Pending  |
| DESIGN-01  | Phase 18   | Pending  |
| DESIGN-02  | Phase 18   | Pending  |
| DESIGN-03  | Phase 18   | Pending  |
| DESIGN-04  | Phase 18   | Pending  |
| REPLAY-06  | Phase 18   | Pending  |
| MATCH-06   | Phase 18   | Pending  |
| BUG-06     | Phase 18   | Pending  |
| BUG-07     | Phase 18   | Pending  |
| BUG-08     | Phase 18   | Pending  |
| BUG-09     | Phase 18   | Pending  |
| BUG-10     | Phase 18   | Pending  |
| BUG-11     | Phase 18   | Pending  |
| UX-07      | Phase 18   | Pending  |
| UX-08      | Phase 18   | Pending  |
| UX-09      | Phase 18   | Pending  |
| UX-10      | Phase 18   | Pending  |
| UX-11      | Phase 18   | Pending  |
| UX-12      | Phase 18   | Pending  |
| UX-13      | Phase 18   | Pending  |
| UX-14      | Phase 18   | Pending  |
