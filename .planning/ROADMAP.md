# Roadmap — Counter Attack Web

## v1.0 MVP — Complete (2026-06-11)

Two players can open a browser, share a room code, and play a complete match of Counter Attack in real time. All 13 phases shipped across 51 plans (330 files, 77k+ lines), 2026-05-27 → 2026-06-11.

Full archive: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · [Requirements](milestones/v1.0-REQUIREMENTS.md) · [Milestones](milestones/MILESTONES.md)

<details>
<summary>v1.0 phases (13 phases, 51 plans)</summary>

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

</details>

---

## v1.1 UX Tuning & Bug Cleanup — Active

**Goal:** Overhaul visual presentation and layout — team token redesign, unified hex highlight system, scoreboard/action top-area, improved match clock and replay — plus 5 rule-correctness bug fixes.

### Phases

- [ ] **Phase 11: Rule Correctness** — Fix 5 server-side gameplay sequencing and highlight bugs
- [ ] **Phase 12: Visual Token & Hex Layer** — Redesign team tokens and unify hex highlight/outline system
- [ ] **Phase 13: Layout & Clock** — Restructure screen into persistent top scoreboard + action panel; MM:SS clock always visible
- [ ] **Phase 14: Kick Off Rules & Replay** — Enforce kick off placement/pass constraints; overhaul replay speed and fidelity

---

## Phase Details

### Phase 11: Rule Correctness

**Goal**: The game engine applies correct sequencing for header phases, snapshot cleanup, deflection highlights, and post-deflect Movement Phase entry
**Depends on**: Nothing (server-only changes, no visual dependencies)
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04, RULE-05
**Success Criteria** (what must be TRUE):

1. On a High Pass, the header contestant selection prompt appears only after the accuracy roll result is shown — the roll resolves first, then contestants are chosen
2. After the header contestant duel resolves, the target hex selection step is presented — the sequence is accuracy check then contestant duel then target selection, with no step skipping
3. After a snapshot resolves, the shot-path hexes on the board are cleared before the next phase begins — no stale path hexes persist into the Movement Phase or subsequent actions
4. During SNAP_DEFLECT, a deflecting piece that has used its 2-hex pace allowance sees no further move highlights — the board is clean once max deflection distance is reached
5. After a shot deflects into Loose Ball, both teams' pieces are selectable in a normal Movement Phase — the 4-5-2 sequence activates for both sides
   **Plans**: 3 plans

- [x] 11-01-PLAN.md — RULE-01/RULE-02 server: accuracy-roll ack flag + auto-duel + winner-guarded target resolution
- [x] 11-02-PLAN.md — RULE-03 server: clear stale lastShotPath on loose-ball scatter and shot bug branches
- [ ] 11-03-PLAN.md — RULE-01 client gate + RULE-04 pace-exhaust suppression + RULE-05 post-deflect Movement selectability

### Phase 12: Visual Token & Hex Layer

**Goal**: Team tokens are visually distinguishable by stripe pattern everywhere, and all hex interaction states use a single consistent color system
**Depends on**: Nothing (client SVG/CSS only; no server changes required)
**Requirements**: VIS-01, VIS-02, UX-05, UX-06
**Success Criteria** (what must be TRUE):

1. Home team tokens show a single vertical black stripe; away team tokens show two horizontal dark stripes — the two teams are instantly distinguishable on the pitch without reading labels
2. The stripe design renders identically in all three contexts: on-pitch piece overlays, player stats panel, and post-game replay frames
3. Selectable pieces show a bright blue outline; the currently active piece shows a green outline; already-activated pieces show an orange outline — three states are visually distinct simultaneously
4. Risk hexes (ZoI, tackle range, dive range, accuracy-penalty zone) tint transparent orange; goal-mouth hexes tint transparent red; safe move hexes tint transparent yellow; kick off setup hexes tint transparent blue; shot-path hexes tint transparent white — all five tint types are distinct from each other and from uncolored hexes
   **Plans**: TBD
   **UI hint**: yes

### Phase 13: Layout & Clock

**Goal**: The screen has a persistent top scoreboard and action/log panel above the hex grid, and the match clock is visible in MM:SS format throughout all game phases
**Depends on**: Nothing (layout restructure is independent of token visuals and server rule fixes)
**Requirements**: LAYOUT-01, LAYOUT-02, CLOCK-01, CLOCK-02
**Success Criteria** (what must be TRUE):

1. A scoreboard strip is visible at the top of the screen in every game phase — it shows home score on the left, away score on the right, and match time + half indicator + connection status in the centre
2. An action/log panel appears at the top of the screen containing available action buttons, current phase status text, and recent event log entries — the hex grid occupies the main area below both top components
3. Match time displays in MM:SS format; in the first half it counts up from 0:00; in the second half it starts at 45:00 and counts forward through added time to full time
4. The clock is visible during every phase without exception: kick off setup, GK restart, GK diving, half time screen, full time screen, and the post-game replay
   **Plans**: TBD
   **UI hint**: yes

### Phase 14: Kick Off Rules & Replay

**Goal**: Kick off placement and opening pass are server-enforced, and replay plays at double speed with simultaneous move animation and correct ball tracking
**Depends on**: Phase 13 (layout in place so replay visibility across all phases can be verified)
**Requirements**: MATCH-06, MATCH-07, REPLAY-04, REPLAY-05, REPLAY-06
**Success Criteria** (what must be TRUE):

1. During KICK_OFF_SETUP, placing a midfielder or back outside hex columns 6–20 is rejected by the server — the piece is not allowed to move there
2. Attempting any action other than Standard Pass from the kick off hex during kick off is rejected by the server — only Standard Pass proceeds
3. Post-game replay advances at approximately 0.5 seconds per action frame, visibly faster than v1.0 playback
4. When a Movement Phase frame is replayed, all pieces moved in that phase update simultaneously — the board snaps to the end-of-phase state rather than animating pieces sequentially
5. The ball marker is positioned correctly on every replay frame — for each replayed action the ball reflects its correct final position in that snapshot with no frames showing a stale location
   **Plans**: TBD
   **UI hint**: yes

---

## Progress

| Phase                        | Plans Complete | Status      | Completed |
| ---------------------------- | -------------- | ----------- | --------- |
| 11. Rule Correctness         | 2/3            | In Progress |           |
| 12. Visual Token & Hex Layer | 0/?            | Not started | -         |
| 13. Layout & Clock           | 0/?            | Not started | -         |
| 14. Kick Off Rules & Replay  | 0/?            | Not started | -         |

---

## Coverage

| REQ-ID    | Phase    |
| --------- | -------- |
| RULE-01   | Phase 11 |
| RULE-02   | Phase 11 |
| RULE-03   | Phase 11 |
| RULE-04   | Phase 11 |
| RULE-05   | Phase 11 |
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

**Total: 18/18 requirements mapped. No orphans.**
