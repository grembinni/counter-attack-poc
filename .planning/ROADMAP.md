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
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, MOVE-06, PASS-02, OFFSIDE-01, OFFSIDE-02
**Success Criteria** (what must be TRUE):

1. The header pass executed by the high pass contest winner is not blockable — no block option is presented during header execution and the server rejects any block attempt; the high pass contest (determining who wins the header) is unchanged
2. A back/cancel control is present at every decision step before any irreversible action (piece moved, dice rolled, target committed); activating it returns the player to the prior step without consuming their action
3. Piece moves made before a header is triggered can each be individually undone, restoring the piece's position and remaining pace allowance
4. A grounded pass that lands on an occupied hex results in ball pickup by that player; if the player belongs to the defending team, possession immediately transfers to them
5. When a goalkeeper save produces a loose ball, the ball spawns at the goalkeeper's hex; outfield players in an opponent's final third each receive a free move of up to 6 hexes after a normal action; during a first-time pass flight both teams may each move one player up to 1 hex
6. A player is flagged offside (sticky, team-relative, all pieces) when past halfway, ahead of the ball, with ≤1 opposing piece equal-or-ahead, shown by a double-width red ring; a flagged player gaining possession (incl. a won header) awards a free kick to the opposing team from the foul spot, with both teams repositioning (defenders 2+ hexes off the ball, kicker one on the ball) and only Standard/High/Long Pass + in-range Shot legal
   **Plans**: 6 plans

- [x] 17-01-PLAN.md — Foundation: shared FREE_MOVE phase + GameState fields + GAME_CANCEL_MOVEMENT event + Wave-0 failing tests
- [x] 17-02-PLAN.md — Engine bug fixes: BUG-01 (header unblockable), BUG-04 (occupied-hex pickup/possession), BUG-05 (loose ball at GK)
- [x] 17-03-PLAN.md — BUG-02 Cancel in MOVEMENT + BUG-03 Undo in HIGH_PASS_MOVEMENT (engine + handler + ActionPanel)
- [x] 17-04-PLAN.md — MOVE-06 FREE_MOVE phase end-to-end (transition, per-piece 6-hex move, handlers, panel)
- [x] 17-05-PLAN.md — OFFSIDE-01: shared offside detection helpers + sticky offsidePieceIds + evaluateOffside end-of-phase wiring + double-width red ring marker [Wave 5]
- [x] 17-06-PLAN.md — OFFSIDE-02: triggerOffsideFoul + FREE_KICK_SETUP phase/fields + applyFreeKickReady (D-30/D-31) + free-kick handlers + restricted action set [Wave 6]

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

**Plans**: 16 plans (gap closure: 10 additional plans — 4 UAT-diagnosed regressions + 6 verification gaps)
**Wave 1**

- [x] 17.1-01-PLAN.md — D-11 GamePhase rename sweep (all source + tests) + FIRST_TIME_PASS_MOVE added to union [Wave 1]

**Wave 2** _(blocked on Wave 1 completion)_

- [x] 17.1-02-PLAN.md — D-01 stat model consolidation + D-02 ZoI exclusion/reset (types, teams, moveValidator, gameEngine) [Wave 3]

**Wave 3** _(blocked on Wave 2 completion)_

- [x] 17.1-06-PLAN.md — ActionPanel FIRST_TIME_PASS_MOVE panel + BallMarker/HexCell visual commit [Wave 3]
- [x] 17.1-03-PLAN.md — D-03 FIRST_TIME_PASS_MOVE handler + D-06 GK_RESTART trigger + D-07 spill route [Wave 4]

**Wave 4** _(blocked on Wave 3 completion)_

- [x] 17.1-04-PLAN.md — D-08 board-edge clamping + D-09 regular-shot range gate [Wave 5]

**Wave 5** _(blocked on Wave 4 completion)_

- [x] 17.1-05-PLAN.md — D-10 pass intercept shape change (autoIntercepts/rollIntercepts) [Wave 6]

**Gap closure (UAT-diagnosed regressions, post-verification):**

- [x] 17.1-07-PLAN.md — Fix FIRST_TIME_PASS_MOVE unreachable for occupied target hex (gameEngine.ts PASS branch reorder) [Gap Wave 1]
- [x] 17.1-09-PLAN.md — Fix ZoI tackle/steal exclusion asymmetry (moveValidator.ts tackle branch + HexGrid.tsx steal-risk tint) [Gap Wave 1]
- [x] 17.1-08-PLAN.md — Fix loose-ball scatter math (axial deltas on ODD-Q offset grid) [Gap Wave 2, depends on 17.1-07]
- [x] 17.1-10-PLAN.md — Fix shot-range highlight missing distance filter (HexGrid.tsx) [Gap Wave 2, depends on 17.1-09]
- [x] 17.1-11-PLAN.md — Fix FTP/HP undo non-functional: phase-aware move-type lookup in applyUndo + canUndo, de-mask test fixtures, add wire test (CR-01 / SC3 undo clause) [Gap Wave 3, depends on 17.1-10]

**Gap closure (re-verification, CR-01-new / CR-02-new — SC3 reposition + no-interception clauses):**

- [x] 17.1-12-PLAN.md — CR-01-new: client FIRST_TIME_PASS_MOVE piece selection (selectPiece branch + canSelectFirstTimePassMove + sticky selection + HexGrid.test coverage) [Gap Wave 4, depends on 17.1-11]
- [x] 17.1-13-PLAN.md — CR-02-new: bypass interception loop for FIRST_TIME_PASS in applyRoll so it reaches FIRST_TIME_PASS_MOVE near a defender + regression test [Gap Wave 4, depends on 17.1-11]

**Gap closure (re-verification cycle 3, Review-CR-01 / Review-CR-02 — SC3 undo durability + delivery correctness):**

- [x] 17.1-14-PLAN.md — Review-CR-01 (Gap A): applyUndo resets firstTimePassMovedPieceId/firstTimePassPaceUsed (and highPass\* equivalents) so Undo unlocks the FTP/HP repositioning slot + lock-field regression tests [Gap Wave 5, depends on 17.1-13]
- [x] 17.1-15-PLAN.md — Review-CR-02 (Gap B): FTP delivery receiver lookup made team-agnostic (BUG-04 parity) so a defender on passTargetHex receives the ball with possession transfer + integration test [Gap Wave 5, depends on 17.1-13]

**Gap closure (re-verification cycle 4, CR-01 self-pass exploit — SC3 delivery correctness):**

- [x] 17.1-16-PLAN.md — CR-01 (cycle 4): add firstTimePassCarrierId field + exclude the original passer from FTP repositioning (server GAME_MOVE), delivery occupant lookup, and client selectPiece, closing the self-pass/reclaim exploit + server & client regression tests [Gap Wave 6, depends on 17.1-15]

### Phase 18: Messaging & Logging Consistency

**Goal**: Player-facing text (action panel labels, phase prompts, scoreboard text, log entries) follows one consistent naming convention with no contradictory or stale wording, and the MATCH-06 requirement text is corrected to its perspective-neutral wording.
**Depends on**: Nothing (polish work is independent of team identity and rule fixes)
**Requirements**: DESIGN-01, MATCH-06
**Success Criteria** (what must be TRUE):

1. All action panel labels, phase prompts, error messages, and log entries use consistent tone, tense, and terminology with no contradictory or stale wording, following the scoreboard/log naming convention captured in 18-CONTEXT.md
2. MATCH-06 requirement text in REQUIREMENTS.md is corrected to the perspective-neutral wording already drafted in PROJECT.md (doc-only, no code change)

**Plans**: 3 plans (1 wave)

- [x] 18-01-PLAN.md — GameBoard PHASE_LABEL convention sweep (stale PASS/GK_DIVE fixes) + MOVE 4/5/2 slot suffix + team-prefixed render [Wave 1]
- [x] 18-02-PLAN.md — ActionLog shared dice-roll formatter (always show `- {penalty}`) + per-player move log with first/last name + hex-path arrows + MATCH-06 doc rewrite [Wave 1]
- [x] 18-03-PLAN.md — ActionPanel D-13 text corrections: unified non-active-player wait state, all 14 active-player phase-prompt strings, GK_RESTART "Kick"→"Punt" button rename [Wave 1]

**Note**: Originally scoped as a single large "Design Polish" phase covering 20 requirements across 4 workstreams. `/gsd-plan-phase` returned `## PHASE SPLIT RECOMMENDED` (2026-06-20) — split into this phase (messaging/logging) plus Phase 18.1 (Replay Review), Phase 18.2 (Code Cleanup & Behavioral Dup-Bugs), Phase 18.3 (Bug-Bash: Rule Correctness), and Phase 18.4 (UX Enhancements). Full original discussion remains in `.planning/phases/18-design-polish/18-CONTEXT.md`, `18-UI-SPEC.md`, and `18-PATTERNS.md` — sub-phases reference these as canonical sources for their relevant decisions.

### Phase 18.1: Replay Review

**Goal**: Live-session replay correctly tracks ball position on every frame (pickups, intercepted passes, steals) without regression, and post-game replay playback has no unnecessary re-renders or redundant socket emissions.
**Depends on**: Nothing (isolated to replay/roomStore code; independent of the messaging sweep)
**Requirements**: DESIGN-02, REPLAY-06
**Success Criteria** (what must be TRUE):

1. Live-session replay correctly tracks ball position on every frame including pickups, intercepted passes, and steals; UAT Test 6 from v1.1 passes without regression
2. Post-game replay playback produces no unnecessary re-renders or redundant socket emissions observable in browser DevTools
   **Plans**: TBD
   **Note**: Split out of the original Phase 18 "Design Polish" scope (see Phase 18 note). DESIGN-02 is an open-ended audit (D-05 in 18-CONTEXT.md: document findings before fixing) and REPLAY-06 is an open investigation (D-06: read Phase 14 replay artifacts first) — plan accordingly.

### Phase 18.2: Code Cleanup & Behavioral Dup-Bugs

**Goal**: Duplicate logic across server handlers and client components is consolidated, dead code is removed, and the three behavioral defects that are themselves duplicate-logic gaps (BUG-08, BUG-09, BUG-11) are fixed.
**Depends on**: Phase 18 (the naming-convention sweep touches GameBoard.tsx/ActionLog.tsx first; this phase's dead-code sweep over the same files should follow to avoid edit conflicts)
**Requirements**: DESIGN-03, DESIGN-04, BUG-08, BUG-09, BUG-11
**Success Criteria** (what must be TRUE):

1. Duplicate logic across server handlers and client components is consolidated; dead code, unused exports, unreachable branches, stale TODOs, and legacy feature flags are removed
2. BUG-08, BUG-09, and BUG-11 are fixed and covered by regression tests
   **Plans**: 6 plans (4 waves; +2 gap-closure plans after verification)

- [x] 18.2-01-PLAN.md — BUG-11: HIGH_PASS_MOVE carrier-exclusion (server GAME_MOVE guard + client selectPiece mirror, 2 touch points) [Wave 1]
- [x] 18.2-02-PLAN.md — BUG-08 render-level tackle-tint verification test + DESIGN-04 dead-code removal (applyDeclareHeaderTarget + 2 stale comments) [Wave 1]
- [x] 18.2-03-PLAN.md — BUG-09: broadened setGameState response-move staleness gate (slot hand-off + pace exhaustion) + folded-todo deletion [Wave 2, depends on 18.2-01]
- [x] 18.2-04-PLAN.md — DESIGN-03: consolidate Clusters 1/3/5 into shared response-move + movement valid-hex helpers (Cluster 2/4 left separate) [Wave 3, depends on 18.2-01, 18.2-03]
- [x] 18.2-05-PLAN.md — BUG-09 gap closure: SNAPSHOT_DEFLECT non-exhausted sticky-recompute path in setGameState (route through computeResponseMoveValidHexes, paceCap 2 / 'range') + regression test (closes 18.2-VERIFICATION.md CR-01 gap; WR-01 lock-check caveat honored) [Wave 1, gap closure]
- [x] 18.2-06-PLAN.md — BUG-09 gap closure: make Test 7's snapshotDeflectState() fixture set movementSlot: null so it reproduces the real SNAPSHOT_DEFLECT WRONG_SLOT failure mode + empirical proof that Test 7 fails when the production branch is reverted (closes 18.2-VERIFICATION.md hollow-test gap; test-fixture-only, no production code change) [Wave 1, gap closure]

  **Note**: Split out of the original Phase 18 "Design Polish" scope (see Phase 18 note). Per D-07 in 18-CONTEXT.md, BUG-08/09/11 are confirmed in scope here (not "too risky") because they are duplicate-logic gaps, not net-new bug hunting — D-08 caps the rest of DESIGN-03/04 to genuinely inert code only. The folded todo `.planning/todos/pending/2026-06-20-fix-stale-client-selection-on-ftp-hp-slot-handoff.md` is superseded by BUG-09 — delete it when BUG-09 closes. **Gap closure**: 18.2-VERIFICATION.md (2026-06-22, score 4/5) found BUG-09's "recompute" half broken for SNAPSHOT_DEFLECT's non-exhausted case (CR-01); plan 18.2-05 closes it.

### Phase 18.3: Bug-Bash (Rule Correctness)

**Goal**: The free-kick offside-reset gap (BUG-06), header-duel pass delivery (BUG-07), already-moved-piece click behavior (BUG-10), and ten additional bug-bash items gathered across two discuss-phase sessions (BUG-12..21 — FTP move-phase toggle, double-tackle-attempt, Snapshot-after-pace-exhaustion, goal-log styling, FTP/HP move-log player format, kickoff-setup replay visibility, Undo coverage, player-number consistency, free-move interrupt timing, and Snapshot goal-line highlight visibility) are fixed.
**Depends on**: Phase 18.2 (sequenced after to avoid HexGrid.tsx/PieceOverlay.tsx edit conflicts with the cleanup sweep)
**Requirements**: BUG-06, BUG-07, BUG-10, BUG-12, BUG-13, BUG-14, BUG-15, BUG-16, BUG-17, BUG-18, BUG-19, BUG-20, BUG-21
**Success Criteria** (what must be TRUE):

1. BUG-06, BUG-07, and BUG-10 are fixed and covered by regression tests
2. BUG-12..BUG-21 are fixed and covered by regression tests

**Plans**: 5 plans (3 waves)

- [x] 18.3-01-PLAN.md — Tier-1 client formatting: BUG-15 (remove goal amber), BUG-16 (PNamed in FTP/HP log), BUG-19 (jersey number from piece.number) [Wave 1]
- [x] 18.3-02-PLAN.md — Engine rule fixes: BUG-13 (double-tackle sequencing) + BUG-20 (deferred free-move interrupt) [Wave 1]
- [x] 18.3-05-PLAN.md — HexGrid: BUG-10 (click-to-card on spent pieces) + BUG-21 (Snapshot goal-line highlight — verified correct in live session, no code change) [Wave 1]
- [x] 18.3-03-PLAN.md — Engine possession transitions: BUG-06 (offside reset gap) + BUG-07 (direct header delivery) + BUG-12 (FTP-move toggle) [Wave 2, depends on 18.3-02]
- [x] 18.3-04-PLAN.md — Movement state machine: BUG-17 (KICK_OFF_SETUP replay) → BUG-14 (Snapshot after pace exhaustion) + BUG-18 (Undo regression + coverage) [Wave 3, depends on 18.3-03]

  **Note**: Split out of the original Phase 18 "Design Polish" scope (see Phase 18 note). BUG-06/07/10 are net rule/flow fixes (not dup-logic gaps) — see 18-CONTEXT.md's Bug-Bash Addendum section for the full repro/fix-pattern for each. BUG-12..21 were gathered across two discuss-phase sessions on 18.3 itself (2026-06-22) — see 18.3-CONTEXT.md for the full repro/fix-pattern for each, including the root-caused `applyStartMovement` missing `lastDiceRoll: null` reset (BUG-18), the missing `KICK_OFF_SETUP` repositioning event (BUG-17), the three disagreeing player-number derivations (BUG-19), and the MOVE-06 mid-flow interrupt timing fix (BUG-20).

### Phase 18.4: UX Enhancements

**Goal**: All 8 UX enhancements (UX-07..UX-14) are implemented per 18-CONTEXT.md and 18-UI-SPEC.md decisions.
**Depends on**: Phase 18 (UX-10/UX-11/UX-12/UX-13 touch the same GameBoard/ActionPanel/ActionLog surfaces the naming sweep finalizes), Phase 18.3 (UX-08/UX-14 overlap PieceOverlay/GameBoard with the bug-bash fixes)
**Requirements**: UX-07, UX-08, UX-09, UX-10, UX-11, UX-12, UX-13, UX-14
**Success Criteria** (what must be TRUE):

1. All 8 UX enhancements (UX-07..UX-14) are implemented per 18-CONTEXT.md decisions and the 18-UI-SPEC.md design contract (game speed selector, end-turn confirmation, final-third marker, helper text, tooltips, event banner)

**Plans**: 5 plans (2 waves)

**Wave 1**

- [x] 18.4-01-PLAN.md — UX-07 game-speed selector: GameSpeed type + GameState.gameSpeed + GAME_SPEED_MINUTES lookup, TEAM_SPEED_SET server handler, speed-derived MOVE clock increment, TeamSelectionScreen selector [Wave 1]
- [x] 18.4-02-PLAN.md — UX-09 final-third red boundary marker (PitchMarkings.tsx) + UX-12 stat-bubble title tooltip with STAT_FULL_NAME lookup (GameBoard.tsx) [Wave 1]
- [x] 18.4-03-PLAN.md — UX-11 MOVE + UX-10 FREE_MOVE helper-text player counts + UX-13 action-button native title tooltips (ActionPanel.tsx) [Wave 1]

**Wave 2**

- [x] 18.4-04-PLAN.md — UX-08 end-turn confirmation dialog + orange/green ctaButtonClass color state across all move/place phases (ActionPanel.tsx/.module.css) [Wave 2, depends on 18.4-03]
- [x] 18.4-05-PLAN.md — UX-14 transient EventBanner (goal/interception/tackle/loose-ball) subscribed to eventLog, mounted in GameBoard.tsx [Wave 2, depends on 18.4-02]

**Note**: Split out of the original Phase 18 "Design Polish" scope (see Phase 18 note). Largest of the 5 sub-phases (8 requirements). The existing `.planning/phases/18-design-polish/18-UI-SPEC.md` (approved, all 6 dimensions PASS) covers every visual/interaction contract these requirements need — no new UI-SPEC required. Wave assignment maximizes parallelism: Wave 1's three plans own disjoint file sets (shared/server/selection vs. PitchMarkings+GameBoard vs. ActionPanel); Wave 2 serializes the two same-file conflicts (04 after 03 on ActionPanel.tsx, 05 after 02 on GameBoard.tsx).

---

## Progress

| Phase                          | Milestone | Plans Complete | Status   | Completed  |
| ------------------------------ | --------- | -------------- | -------- | ---------- |
| 1. Monorepo Scaffold           | v1.0      | 3/3            | Complete | 2026-05-28 |
| 2. Move Validator              | v1.0      | 4/4            | Complete | 2026-05-29 |
| 3. Server Room Manager         | v1.0      | 3/3            | Complete | 2026-05-29 |
| 4. Game Engine + FSM           | v1.0      | 3/3            | Complete | 2026-05-30 |
| 5. Dice Resolver               | v1.0      | 4/4            | Complete | 2026-05-30 |
| 6. React Hex Grid              | v1.0      | 3/3            | Complete | 2026-05-31 |
| 7. Client-Server Integration   | v1.0      | 4/4            | Complete | 2026-06-03 |
| 7.1. UI Cleanup                | v1.0      | 3/3            | Complete | 2026-06-04 |
| 8. Match Lifecycle             | v1.0      | 8/8            | Complete | 2026-06-05 |
| 8.1. Cleanup                   | v1.0      | 3/3            | Complete | 2026-06-05 |
| 8.2. Passing Cleanup           | v1.0      | 6/6            | Complete | 2026-06-07 |
| 9. Render Deployment           | v1.0      | 2/2            | Complete | 2026-06-08 |
| 10. Remaining Flows            | v1.0      | 5/5            | Complete | 2026-06-11 |
| 11. Rule Correctness           | v1.1      | 4/4            | Complete | 2026-06-12 |
| 12. Visual Token & Hex Layer   | v1.1      | 4/4            | Complete | 2026-06-12 |
| 13. Layout & Clock             | v1.1      | 3/3            | Complete | 2026-06-12 |
| 14. Kick Off Rules & Replay    | v1.1      | 3/3            | Complete | 2026-06-12 |
| 15. Team Identity              | v1.2      | 3/3            | Complete | 2026-06-13 |
| 16. Player Roster & Selection  | v1.2      | 4/4            | Complete | 2026-06-14 |
| 17. Rule Bugs                  | v1.2      | 6/6            | Complete | 2026-06-21 |
| 17.1. Action Flow Cleanup      | v1.2      | 16/16          | Complete | 2026-06-20 |
| 18. Messaging & Logging Cons.  | v1.2      | 3/3            | Complete | 2026-07-02 |
| 18.1. Replay Review            | v1.2      | 2/2            | Complete | 2026-06-21 |
| 18.2. Code Cleanup & Dup-Bugs  | v1.2      | 6/6            | Complete | 2026-06-22 |
| 18.3. Bug-Bash (Rule Correct.) | v1.2      | 5/5            | Complete | 2026-07-02 |
| 18.4. UX Enhancements          | v1.2      | 5/5            | Complete | 2026-07-02 |
