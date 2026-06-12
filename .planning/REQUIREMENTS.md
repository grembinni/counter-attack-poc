# Requirements — Counter Attack Web

## v1.1 Requirements

### Visual Token Design

- [x] **VIS-01**: Home team tokens display a single vertical black stripe; away team tokens display two horizontal dark stripes — both teams are visually distinguishable on the pitch without requiring labels
- [ ] **VIS-02**: Token stripe design is consistent in all contexts: on-pitch overlays, player stats panel, and replay

### Hex Highlights & Indicators

- [x] **UX-05**: Piece selection state uses distinct outlines: selectable pieces show a bright blue outline; the currently active (selected) piece shows a green outline; pieces already activated this turn show an orange outline
- [x] **UX-06**: Game-state hex tints use a unified color system — risk hexes (ZoI, tackle range, dive range, accuracy-penalty zone) are transparent orange; goal hexes are transparent red; safe move hexes are transparent yellow; kick off setup hexes are transparent blue; shot-path hexes are transparent white

### Screen Layout

- [ ] **LAYOUT-01**: A persistent scoreboard is displayed at the top of the screen in all game phases; it contains home team score, match time + half indicator + connection status, and away team score
- [ ] **LAYOUT-02**: An action/log panel is displayed at the top of the screen alongside or below the scoreboard; it contains available action buttons, current phase status text, and the recent event log; the hex grid occupies the main screen area beneath both top components; layout is responsive-aware

### Match Clock

- [ ] **CLOCK-01**: Match time displays in MM:SS format; first half runs from 0:00 forward; second half starts at 45:00 and runs forward through added time to full time
- [ ] **CLOCK-02**: The clock is visible in all game phases including kick off setup, GK restart, GK diving, half time screen, full time screen, and post-game replay

### Kick Off Rules

- [ ] **MATCH-06**: Default kick off setup enforces that midfielders and backs are placed between hex columns 6 and 20 (server-side validation); pieces outside this range are rejected during KICK_OFF_SETUP
- [ ] **MATCH-07**: Only a Standard Pass can be played as the opening action from the kick off hex; any other action type attempted from the centre hex during kick off is rejected by the server

### Replay Improvements

- [ ] **REPLAY-04**: Post-game replay plays at double the v1.0 speed (approximately 0.5 seconds per action frame instead of 1 second)
- [ ] **REPLAY-05**: During a Movement Phase replay frame, all pieces moved in that phase animate/update simultaneously rather than one at a time
- [ ] **REPLAY-06**: Ball position updates correctly on every replay frame; the ball marker always reflects the ball's final position for each replayed action

### Rule Correctness & Bug Fixes

- [x] **RULE-01**: On a High Pass, the header contestant selection phase is triggered only after the accuracy check roll resolves — not before the roll
- [x] **RULE-02**: On a High Pass with header contestants, the target hex selection step is triggered only after the header contestant duel resolves — correct sequence is: accuracy check → contestant duel → target selection
- [x] **RULE-03**: After a snapshot resolves, all shot-path highlight hexes are cleared from the board before entering the next phase; no stale highlights persist into the Movement Phase or subsequent actions
- [x] **RULE-04**: During SNAP_DEFLECT phase, hex highlights for a deflecting piece's valid moves are suppressed once that piece has used its maximum deflection pace allowance (2 hexes)
- [x] **RULE-05**: After a shot is deflected into Loose Ball, both teams enter a normal Movement Phase; both teams' pieces are selectable and can be activated in the correct 4-5-2 sequence

---

## Future Requirements (not in v1.1)

### Deferred Rule Completions

- **MOVE-06**: Free 6-hex move for all players in opposite final third after action in one final third — state scaffolded, handler not yet implemented
- **PASS-02 (partial)**: Mid-pass player movement (1 hex per team) during First-time Pass flight

### Deferred v2 Features

- Fouls, yellow/red cards, booking checks
- Injuries and resilience checks
- Corner kicks, throw-ins, free kicks, penalty kicks
- Nutmeg, reckless tackle, last-man foul, professional foul
- Substitutions
- Offside enforcement
- Reconnection grace period (server holds room state for disconnected player)
- Rematch flow
- Chat

---

## Out of Scope (v1.1)

- AI / single-player mode — not planned
- Animations (piece movement between hexes) — static state updates only
- Mobile layout — desktop-first (responsive-aware but not mobile-first)
- Sound effects / audio
- Custom team / card editor — hardcoded teams only
- Spectator mode — not planned

---

## Traceability

| REQ-ID    | Phase    |
| --------- | -------- |
| VIS-01    | Phase 12 |
| VIS-02    | Phase 12 |
| UX-05     | Phase 12 |
| UX-06     | Phase 12 |
| LAYOUT-01 | Phase 13 |
| LAYOUT-02 | Phase 13 |
| CLOCK-01  | Phase 13 |
| CLOCK-02  | Phase 13 |
| MATCH-06  | Phase 14 |
| MATCH-07  | Phase 14 |
| REPLAY-04 | Phase 14 |
| REPLAY-05 | Phase 14 |
| REPLAY-06 | Phase 14 |
| RULE-01   | Phase 11 |
| RULE-02   | Phase 11 |
| RULE-03   | Phase 11 |
| RULE-04   | Phase 11 |
| RULE-05   | Phase 11 |

---

## Definition of Done

A v1.1 requirement is done when:

1. The described behavior works end-to-end in a local 2-player session
2. Server-enforced rules are validated server-side (not just client)
3. Both players' screens show consistent state after each action
