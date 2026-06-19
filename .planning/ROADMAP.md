# Roadmap — Counter Attack Web

## Milestones

- ✅ **v1.0 MVP** — Phases 1–10 (shipped 2026-06-11)
- ✅ **v1.1 UX Tuning & Bug Cleanup** — Phases 11–14 (shipped 2026-06-12)
- 🔄 **v1.2 Team Identity & Core Fixes** — Phases 15–18 (in progress)

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

---

## v1.2 Phase Details

### Phase 15: Team Identity

**Goal**: Four teams with distinct visual identities (badge, color, jersey) are defined in shared types and rendered wherever team branding appears.
**Depends on**: Nothing (first v1.2 phase; self-contained data and asset work)
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, TEAM-05, TEAM-06
**Success Criteria** (what must be TRUE):

1. Four teams (Cozmos, Xolos, City, Crew) exist in shared types with name, primary color, and a badge SVG component each
2. Each team's badge is visually distinct and matches its design brief (galaxy, coyote, STL arch, Columbus-style)
3. Each team's jersey is rendered with the correct color and pattern (Cozmos horizontal stripe, Xolos checker, City gold arch, Crew diagonal shoulder stripes)
4. The team badge appears in the scoreboard top band for both teams during a match

**Plans**: 3 plans

- [x] 15-01-PLAN.md — Shared TeamConfig types + TEAM_CONFIGS, client TEAM_DEFAULTS, TeamBadge component, vite-env shim
- [x] 15-02-PLAN.md — PieceOverlay jersey patterns (4 outfield + 2 GK) + D-06 color refactor
- [x] 15-03-PLAN.md — Scoreboard TeamBadge wiring + D-06 color refactor (GameBoard, ActionLog, PlayerStatsPanel)

**UI hint**: yes

### Phase 16: Player Roster & Team Selection

**Goal**: Players are populated from fc_stats.csv into four named squads, and both players choose their team before the match begins.
**Depends on**: Phase 15 (team data types and badge components required for player card badge display and selection screen)
**Requirements**: PLAY-01, PLAY-02, PLAY-03, SELECT-01
**Success Criteria** (what must be TRUE):

1. All four team squads (Cozmos, Xolos, City, Crew) are populated with correct names, positions, and attributes sourced from fc_stats.csv
2. Free Agent players are present in the system data but do not appear as selectable options in any UI
3. The player card shows First Name on line 1, Last Name on line 2, and Badge | Position | shirt number on line 3
4. Before the match starts, the home player selects their team first; the away player then selects from the remaining three teams; neither player can proceed without making a selection
5. The selected team's badge and colors are applied to the scoreboard, player cards, and tokens throughout the match
   **Plans**: 4 plans

- [x] 16-01-PLAN.md — Wave 0 RED test scaffolding (roster, player card, selection screen, engine)
- [x] 16-02-PLAN.md — Seed script + teams.ts (TEAM_SQUADS/FREE_AGENTS), PlayerPiece type surgery, selectedTeams + team events
- [x] 16-03-PLAN.md — Server: buildInitialGameState selectedTeams, team:selection-start gate, team:pick handler
- [x] 16-04-PLAN.md — Client: TeamSelectionScreen, player card redesign, TEAM_DEFAULTS deletion, App routing

**UI hint**: yes

### Phase 17: Rule Bugs

**Goal**: Seven rule-correctness defects (blocking headers, action back controls, pre-header undo, pass pickup/possession, loose ball location, free final-third move, mid-pass movement) are fixed and verified.
**Depends on**: Nothing (rule fixes are independent of team identity work)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, MOVE-06, PASS-02
**Success Criteria** (what must be TRUE):

1. The header pass executed by the high pass contest winner is not blockable — no block option is presented during header execution and the server rejects any block attempt; the high pass contest (determining who wins the header) is unchanged
2. A back/cancel control is present at every decision step before any irreversible action (piece moved, dice rolled, target committed); activating it returns the player to the prior step without consuming their action
3. Piece moves made before a header is triggered can each be individually undone, restoring the piece's position and remaining pace allowance
4. A grounded pass that lands on an occupied hex results in ball pickup by that player; if the player belongs to the defending team, possession immediately transfers to them
5. When a goalkeeper save produces a loose ball, the ball spawns at the goalkeeper's hex; outfield players in an opponent's final third each receive a free move of up to 6 hexes after a normal action; during a first-time pass flight both teams may each move one player up to 1 hex
   **Plans**: 5 plans

- [x] 17-01-PLAN.md — Foundation: shared FREE_MOVE phase + GameState fields + GAME_CANCEL_MOVEMENT event + Wave-0 failing tests
- [x] 17-02-PLAN.md — Engine bug fixes: BUG-01 (header unblockable), BUG-04 (occupied-hex pickup/possession), BUG-05 (loose ball at GK)
- [x] 17-03-PLAN.md — BUG-02 Cancel in MOVEMENT + BUG-03 Undo in HIGH_PASS_MOVEMENT (engine + handler + ActionPanel)
- [ ] 17-04-PLAN.md — MOVE-06 FREE_MOVE phase end-to-end (transition, per-piece 6-hex move, handlers, panel)
- [ ] 17-05-PLAN.md — PASS-02 First-time Pass mid-flight repositioning (attacker step + SNAP_DEFLECT reuse + path highlight)

### Phase 17.1: Action Flow Cleanup

**Goal**: The codebase is aligned with the corrected Counter Attack v1.4.1 phase/action model — GamePhase enum renamed, aerial stat consolidated, ZoI exclusion fixed, first-time-pass repositioning phase added, and GK restart / loose-ball / shot-range mechanics corrected.
**Depends on**: Phase 17 (builds on the rule-bug fixes and FREE_MOVE/undo scaffolding)
**Requirements**: none (ad hoc cleanup phase; all decisions captured as D-01–D-11 in 17.1-CONTEXT.md)
**Success Criteria** (what must be TRUE):

1. All 8 GamePhase literals are renamed to the v1.4.1 names and a new FIRST_TIME_PASS_MOVE phase exists; typecheck and full test suite pass
2. PlayerPiece has a single aerial stat (aerialAbility); a defender who has attempted a tackle/steal no longer re-triggers that same challenge but still projects the other ZoI
3. First-time pass flight lets both teams reposition one player ≤1 hex, then delivers the ball without interception; undo is available at the FTP_REPOSITION boundary
4. GK carrying in its own penalty area at end of MOVE → GK_RESTART; GK save spill → GK_RESTART; loose-ball scatter clamps to the pitch; regular shot beyond 11 hexes is rejected
5. A STANDARD pass to a defender-occupied hex is allowed and auto-intercepted (case 1); intermediate on-path blocking still returns PATH_BLOCKED (case 2); ZoI defenders roll-intercept (case 3)

**Plans**: 10 plans (gap closure: 4 additional plans for UAT-diagnosed regressions)

- [x] 17.1-01-PLAN.md — D-11 GamePhase rename sweep (all source + tests) + FIRST_TIME_PASS_MOVE added to union [Wave 1]
- [x] 17.1-02-PLAN.md — D-01 stat model consolidation + D-02 ZoI exclusion/reset (types, teams, moveValidator, gameEngine) [Wave 3]
- [x] 17.1-06-PLAN.md — ActionPanel FIRST_TIME_PASS_MOVE panel + BallMarker/HexCell visual commit [Wave 3]
- [x] 17.1-03-PLAN.md — D-03 FIRST_TIME_PASS_MOVE handler + D-06 GK_RESTART trigger + D-07 spill route [Wave 4]
- [x] 17.1-04-PLAN.md — D-08 board-edge clamping + D-09 regular-shot range gate [Wave 5]
- [x] 17.1-05-PLAN.md — D-10 pass intercept shape change (autoIntercepts/rollIntercepts) [Wave 6]

**Gap closure (UAT-diagnosed regressions, post-verification):**

- [x] 17.1-07-PLAN.md — Fix FIRST_TIME_PASS_MOVE unreachable for occupied target hex (gameEngine.ts PASS branch reorder) [Gap Wave 1]
- [x] 17.1-09-PLAN.md — Fix ZoI tackle/steal exclusion asymmetry (moveValidator.ts tackle branch + HexGrid.tsx steal-risk tint) [Gap Wave 1]
- [x] 17.1-08-PLAN.md — Fix loose-ball scatter math (axial deltas on ODD-Q offset grid) [Gap Wave 2, depends on 17.1-07]
- [x] 17.1-10-PLAN.md — Fix shot-range highlight missing distance filter (HexGrid.tsx) [Gap Wave 2, depends on 17.1-09]

### Phase 18: Design Polish

**Goal**: Player-facing text is consistent, replay playback is clean, and dead/duplicate code is removed, leaving the codebase in a stable state for the next milestone.
**Depends on**: Nothing (polish work is independent of team identity and rule fixes)
**Requirements**: DESIGN-01, DESIGN-02, DESIGN-03, DESIGN-04, REPLAY-06, MATCH-06
**Success Criteria** (what must be TRUE):

1. All action panel labels, phase prompts, error messages, and log entries use consistent tone, tense, and terminology with no contradictory or stale wording
2. Live-session replay correctly tracks ball position on every frame including pickups, intercepted passes, and steals; UAT Test 6 from v1.1 passes without regression
3. Post-game replay playback produces no unnecessary re-renders or redundant socket emissions observable in browser DevTools
4. Duplicate logic across server handlers and client components is consolidated; dead code, unused exports, unreachable branches, stale TODOs, and legacy feature flags are removed
   **Plans**: TBD

---

## Progress

| Phase                         | Milestone | Plans Complete | Status      | Completed  |
| ----------------------------- | --------- | -------------- | ----------- | ---------- |
| 1. Monorepo Scaffold          | v1.0      | 3/3            | Complete    | 2026-05-28 |
| 2. Move Validator             | v1.0      | 4/4            | Complete    | 2026-05-29 |
| 3. Server Room Manager        | v1.0      | 3/3            | Complete    | 2026-05-29 |
| 4. Game Engine + FSM          | v1.0      | 3/3            | Complete    | 2026-05-30 |
| 5. Dice Resolver              | v1.0      | 4/4            | Complete    | 2026-05-30 |
| 6. React Hex Grid             | v1.0      | 3/3            | Complete    | 2026-05-31 |
| 7. Client-Server Integration  | v1.0      | 4/4            | Complete    | 2026-06-03 |
| 7.1. UI Cleanup               | v1.0      | 3/3            | Complete    | 2026-06-04 |
| 8. Match Lifecycle            | v1.0      | 8/8            | Complete    | 2026-06-05 |
| 8.1. Cleanup                  | v1.0      | 3/3            | Complete    | 2026-06-05 |
| 8.2. Passing Cleanup          | v1.0      | 6/6            | Complete    | 2026-06-07 |
| 9. Render Deployment          | v1.0      | 2/2            | Complete    | 2026-06-08 |
| 10. Remaining Flows           | v1.0      | 5/5            | Complete    | 2026-06-11 |
| 11. Rule Correctness          | v1.1      | 4/4            | Complete    | 2026-06-12 |
| 12. Visual Token & Hex Layer  | v1.1      | 4/4            | Complete    | 2026-06-12 |
| 13. Layout & Clock            | v1.1      | 3/3            | Complete    | 2026-06-12 |
| 14. Kick Off Rules & Replay   | v1.1      | 3/3            | Complete    | 2026-06-12 |
| 15. Team Identity             | v1.2      | 3/3            | Complete    | 2026-06-13 |
| 16. Player Roster & Selection | v1.2      | 4/4            | Complete    | 2026-06-14 |
| 17. Rule Bugs                 | v1.2      | 3/5            | In Progress |            |
| 17.1. Action Flow Cleanup     | v1.2      | 10/10          | Complete    | 2026-06-19 |
| 18. Design Polish             | v1.2      | 0/TBD          | Pending     | -          |
