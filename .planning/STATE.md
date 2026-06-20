---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Phase Details
status: verifying
last_updated: '2026-06-20T01:41:15.595Z'
last_activity: 2026-06-20 -- Phase 17.1 Plan 15 complete (Review-CR-02 closed)
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 27
  completed_plans: 25
  percent: 60
---

# Project State

## Current Phase

v1.2 milestone defined. Phases 15–18 planned; Phase 15 (Team Identity) is first.

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-13)

**Core value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.
**Current focus:** Phase 17.1 — action-flow-cleanup

## Phase Status

| Phase | Name                                       | Status   | Completed  |
| ----- | ------------------------------------------ | -------- | ---------- |
| 1     | Monorepo Scaffold + Shared Types           | Complete | 2026-05-28 |
| 2     | Move Validator + Unit Tests                | Complete | 2026-05-29 |
| 3     | Server Room Manager + Socket.io Scaffold   | Complete | 2026-05-29 |
| 4     | Game Engine + Phase FSM                    | Complete | 2026-05-30 |
| 5     | Dice Resolver + All Resolution Branches    | Complete | 2026-05-30 |
| 6     | React Hex Grid Renderer                    | Complete | 2026-05-31 |
| 7     | Client-Server Integration                  | Complete | 2026-06-03 |
| 7.1   | UI Cleanup                                 | Complete | 2026-06-04 |
| 8     | Match Lifecycle + Post-Game Replay         | Complete | 2026-06-05 |
| 8.1   | Cleanup — Player Stats, Movement, Tackling | Complete | 2026-06-05 |
| 8.2   | Passing Cleanup                            | Complete | 2026-06-07 |
| 9     | Render Deployment                          | Complete | 2026-06-08 |
| 10    | Remaining Action Flows + Tech Debt         | Complete | 2026-06-11 |

## Blocking Dependencies

- **Board layout (RESOLVED in Phase 6 plan):** Real 37×26 grid (q∈[0,36], r∈[0,25]) with exact region boundaries defined in Phase 6 CONTEXT.md D-04/D-05. Difficult-angle hexes approximated; TODO: verify against docs/board-photo.jpg when available (D-06).
- **Hex orientation (RESOLVED in Phase 6 plan):** Flat-top confirmed (CONTEXT.md D-01). axialToPixel formula locked.
- **Team squad attributes:** Full 9-attribute sets for both hardcoded squads not yet defined. Must be finalised before Phase 5 dice resolution uses attribute values.
- **Referee card behaviour:** Whether Leniency affects anything beyond added time is unconfirmed from rulebook v1.4.1. Hardcode one card for v1; clarify before Phase 8.
- **Pass range distance type:** Resolved in Phase 2 — implemented as axial hex distance (hexDistance). Physical rulebook verification pending before Phase 5 live use.
- **ZoI scope:** Resolved in Phase 2 — ZoI triggers a STEAL_ATTEMPT for movement (moveValidator) and produces an interceptors list for passes (passValidator). Physical rulebook verification pending before Phase 5 live use.

## Accumulated Context

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: cleanup player stats, ball control, movement, tackling (URGENT)

### Decisions Locked

- Server-authoritative state; full-snapshot broadcast after every action (no differential patching)
- Axial (q, r) coordinates everywhere; pixel conversion only in `hexToPixel.ts`
- pnpm monorepo: `packages/shared`, `packages/server`, `packages/client`
- Explicit FSM object for game phases (not if/else chains)
- Per-room `isProcessing` mutex before any game logic
- Socket.io v4 with typed events via generics
- honeycomb-grid 4.x for hex math in client rendering
- React + Vite (static build output for S3/CloudFront)
- Zustand for client state management
- `transports: ['websocket']` only on Socket.io client (no polling; eliminates sticky session requirement)
- Hardcoded teams for v1; no card editor or team selection UI
- Every MOVEMENT branch sets movementSlot: 'ATTACKER_4', movedPieceIds: [], paceUsedByPieceId: {} (Gap 1 invariant)
- Ties and inaccuracy route to LOOSE_BALL phase with ball at incident hex; fresh dice on next game:roll (Gap 2+3)
- kickOffHex = {q:18, r:13} (real 37×26 board centre; replaces placeholder {q:12, r:7})
- DIFFICULT_ANGLE_HEXES approximated as 16 hexes near penalty area corners (verify vs board photo D-06)
- HEX_SIZE = 20px (flat-top hex rendering, D-03)
- React 18.3.1 + Zustand 4.5.7 pinned (not npm latest v19/v5 — breaking API changes)
- Single SVG root for all overlay elements (HexCell, BallMarker, PieceOverlay) — z-order via DOM order
- Zustand per-slice selectors in HexGrid (Pitfall 6) — prevents whole-component re-renders
- clipPath on `<g>` operates in the group's LOCAL post-translate coordinate space (not SVG viewport space) — CLIP_X=-10, CLIP_RIGHT=1090 reference local hex geometry directly
- ODD-Q offset arithmetic used for both hex neighbour calculation (highlight reachability) and 3-colour formula — axial arithmetic is wrong for visual adjacency in ODD-Q layout
- LobbyScreen uses MOCK42 placeholder room code — real server-generated code wired in Phase 7

### Key Pitfalls to Avoid

- Never generate dice on the client; all rolls use `crypto.randomInt` server-side
- Always return `socket.off(event, handler)` from every `useEffect` that registers a socket listener
- Never use offset hex coordinates; axial only from day one
- Define FSM structure before implementing the second game phase
- Wire disconnect handler in the same commit as room creation (no orphaned rooms)
- Add `isProcessing` mutex before writing any game logic (prevents double-click race)

### Open Questions (resolve before indicated phase)

- Phase 7: Are valid moves computed on piece selection or precomputed post-state?
- Phase 5: Full attribute values for both hardcoded squads?
- Phase 8: Tiebreaker rule at full time, or is a draw valid?
- Phase 8: Does referee card affect anything beyond Leniency/added time?

### Decisions Locked (Phase 11 Plan 02)

- RULE-03 (D-07): lastShotPath: null added to SHOT LOOSE_BALL tie (~line 1289), SHOT save-dropped LOOSE_BALL (~line 1341), and LOOSE_BALL scatter -> PASS (~line 1746); applyStartMovement is NOT modified (targeted fix, not defensive clear)
- Dead shotPath variable removed from SHOT case after all LOOSE_BALL return objects set null explicitly (lint compliance)

### Decisions Locked (Phase 11 Plan 01)

- RULE-01 (D-03): headerAccuracyRollPending flag on HEADER state gates contestant selection; GAME_HEADER_ACCURACY_ACK (attacker-only) clears it; headerCleared spread nulls it on terminal transitions
- RULE-02 (D-03): duel fires in GAME_HEADER_CONTESTANT when both teams confirm via computeHeaderDuelWinner; headerDuelWinner field records winner; phase stays HEADER for target selection
- RULE-02 (D-05): GAME_HEADER_TARGET winner guard uses socketTeam(socket) !== headerDuelWinner replacing controlsAttackingTeam; null winner (tie) returns WRONG_TEAM
- RULE-02 (D-06): applyResolveHeaderTarget validates targetHex against winning contestant position (hexDistance > 6 = INVALID_TARGET), not ball position; no re-roll (Pitfall 4 prevention)
- exactOptionalPropertyTypes enforced: headerDuelWinner?: 'home' | 'away' | null (not undefined)

### Decisions Locked (Phase 10 Plan 05)

- passerId added to STANDARD_PASS/FIRST_TIME_PASS ActionEvent (shared types + engine) to enable team-colour prefix in ActionLog (D-27)
- game:shot integration tests updated to reflect D-02 handler rework: seedPassPhaseForShot seeds PASS phase; assertions check GK_DIVING transition
- Integration tests must use real HOME_SQUAD/AWAY_SQUAD positions (hexDistance=1 adjacency required); placeholder coords like {q:11,r:7} break moves silently

### Decisions Locked (Phase 10 Plan 04)

- controlsGKTeam is phase-aware: GK_DIVING derives defending team from attackingTeam (ball.carrierId = shooter in that phase); GK_RESTART uses ball.carrierId
- GAME_HEADER removed; single resolution route via GAME_HEADER_CONTESTANT auto-confirm (D-19)
- startReplayStream re-fetches liveRoom inside setTimeout to eliminate stale closure (D-15 CR-01 BLOCKER)
- snapDeflectMovedPieceId + snapDeflectPaceUsed added to GameState for SNAP_DEFLECT phase tracking
- GK_DIVING end-turn: computeShotPathDeflection first (deflect → LOOSE_BALL), then applyRoll with phase normalised to SHOT

### Decisions Locked (Phase 10 Plan 03)

- applyDeclareShot transitions directly to GK_DIVING (not SHOT_DECLARED + GK_DIVING); shotTargetHex recorded
- gkDivePosition seeded from GK piece position at shot declaration; cumulative distance checked against piece.position
- HEAD-03 goal-line routing applied to both contested and uncontested attacker-win HEADER paths
- computeShotPathDeflection is a pure helper; handler (plan 04) builds DefenderDeflectionInput list from hexLine

### Decisions Locked (Phase 10 Plan 02)

- D-30: loose-ball pickup in applyMove stays in MOVEMENT; attackingTeam/activeTeam update immediately; pace tracking continues; no PASS transition on pickup
- D-29 enforcement in engine layer: applyMove returns MOVE_INVALID/ALREADY_ATTEMPTED when piece id already in stealAttemptedByIds/tackleAttemptedByIds
- pickWinner tie-break: uses (die-1) % tied.length with injected die (no Math.random in engine)

### Decisions Locked (Phase 8)

- GAME_KICK_OFF_MOVE/GAME_READY/GAME_HALF_TIME_START handlers enforce KICK_OFF_SETUP placement with isProcessing mutex and snap-back pattern
- ELIGIBLE_NEXT_ACTIONS sequence guard on all action handlers (INVALID_SEQUENCE on violation)
- kickOffActive=true set on KICK_OFF→MOVEMENT; cleared after first pass from centre hex
- FULL_TIME triggers startReplayStream: 3s hold then 1s/frame setInterval (room.replayTimer)
- Disconnect handler clears replayTimer to prevent post-disconnect frame emission (T-08-15)
- addedTimeRoll pre-generated via rollDice() before every applyEndTurn call (D-05/MATCH-02)

### Decisions Locked (Phase 13)

- D-08/D-09: Clock is event-driven, MM:00 format — minutes from actionCount, seconds always :00. No client-side timer. actionCount=7 → "7:00". ROADMAP said MM:SS; CONTEXT.md design decision overrides to MM:00.
- D-11: Clock rendered unconditionally — no PLAY_PHASES gating. topBand always visible regardless of phase.
- D-12: App.tsx no longer routes HALF_TIME/FULL_TIME to separate screens. All game phases render GameBoard. HALF_TIME/FULL_TIME overlays are position:absolute inside the position:relative pitchContainer.
- topBand: CSS Grid 56px 1fr 1fr 1fr auto 56px; 80px height; six tracks: home score | centre | player card | action | log | away score.
- PHASE_LABEL and SLOT_TOTAL absorbed verbatim from TurnIndicator into GameBoard module scope.
- COMPACT_STATS: 6 confirmed PlayerPiece fields (pace/shooting/tackling/heading/dribbling/highPass). No passing or stamina.
- REPLAY phaseLabel suppressed in centre section (phase !== 'REPLAY' guard) to prevent getByText collision with ReplayPanel heading.
- Screen type trimmed to 6 members: 'LANDING' | 'CREATE_ROOM' | 'JOIN_ROOM' | 'WAITING' | 'GAME_BOARD' | 'REPLAY'. HALF_TIME and FULL_TIME removed.
- emitHalfTimeStart preserved in store — called from GameBoard HALF_TIME overlay, not HalfTimeScreen.
- Six retired files deleted: TurnIndicator.tsx/.module.css, HalfTimeScreen.tsx/.module.css, FullTimeScreen.tsx/.module.css.
- Wave 0 socket mock pattern: extend { emit, on, off } with socket.io: { on, off } to support ConnectionStatus Manager events in GameBoard tests.

## Quick Tasks Completed

| Slug                   | Date       | Description                                                              |
| ---------------------- | ---------- | ------------------------------------------------------------------------ |
| phase-selection-flow   | 2026-06-06 | Fix choose-phase flow, passType to server, Move from PASS                |
| possession-phase-bugs  | 2026-06-06 | End phase on steal/tackle; cap ATTACKER_2 pace at 2                      |
| undo-kickoff-ball-bugs | 2026-06-06 | Ball kept after steal; undo scoped; X clears; KICK_OFF chooser           |
| 260612-ike             | 2026-06-12 | Refactor GameBoard top-band layout and player card                       |
| 260612-kvw             | 2026-06-12 | GameBoard UI polish: scores flanking clock, side-panel log               |
| 260612-l7d             | 2026-06-12 | GameBoard 3-zone top band: centred scoreboard, left/right zones          |
| 260612-lme             | 2026-06-12 | Scoreboard dot+clock (26px), slot helper text, centred ActionPanel label |

## Deferred Items (acknowledged at milestone close 2026-06-13, v1.1)

Items acknowledged and deferred at v1.1 milestone close on 2026-06-13:

| Category         | Item                                        | Status                                                                                                     |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| verification_gap | Phase 13: 13-VERIFICATION.md                | human_needed — 3 browser UAT items (1080p layout, HALF_TIME overlay, log toggle); all automated tests pass |
| quick_task       | undo-kickoff-ball-bugs                      | missing — completed 2026-06-06; work in git log; no formal artifact dir                                    |
| quick_task       | 260612-ike (GameBoard top-band refactor)    | unknown — completed during Phase 13; work committed; no formal close                                       |
| quick_task       | 260612-kvw (GameBoard scores/clock polish)  | unknown — completed during Phase 13; work committed; no formal close                                       |
| quick_task       | 260612-l7d (GameBoard 3-zone top band)      | unknown — completed during Phase 13; work committed; no formal close                                       |
| quick_task       | 260612-lme (scoreboard action panel polish) | unknown — completed during Phase 13; work committed; no formal close                                       |

Known deferred items at close: 6 (see above)

## Deferred Items (acknowledged at milestone close 2026-06-11)

| Slug                   | Type       | Note                                                                               |
| ---------------------- | ---------- | ---------------------------------------------------------------------------------- |
| undo-kickoff-ball-bugs | quick-task | Completed 2026-06-06; no formal artifact directory. Work captured in git log only. |

## Session Continuity

- Last updated: 2026-06-15
- Phase 17.1 Plan 04 complete. D-08 board-edge clamp + D-09 shot range gate implemented and tested.
- 286 server + 91 client + 241 shared tests passing. 4 pre-existing RED stubs unchanged. Typecheck clean.

- Last updated: 2026-06-19
- Phase 17.1 Plan 07 complete (gap closure wave 1). Reordered applyRoll PASS branch so D-03
  FIRST_TIME_PASS_MOVE is checked before the generic occupant-check, fixing UAT Test 3
  (no reposition prompt after first-time pass to an occupied/teammate hex).

- 297 server tests passing; 4 pre-existing RED failures unchanged (2 MOVE-06 FREE_MOVE scaffolding
  gaps, 2 abandoned pre-17.1 firstTimePassStep design stubs). Typecheck clean.

- Gap closure plans 08-10 remain (loose-ball scatter math, ZoI tackle/steal asymmetry, shot-range
  highlight filter).

- Last updated: 2026-06-19
- Phase 17.1 Plan 09 complete (gap closure). Fixed both root causes diagnosed in
  .planning/debug/zoi-tackle-steal-exclusion.md: moveValidator's tackle branch now falls through
  to plain ok:true (no effect) for excluded tacklers instead of rejecting the move outright;
  HexGrid's zoiRiskSet now filters getZoIDefenders by stealAttemptedByIds so steal-risk tint
  clears correctly after a failed steal attempt. TACKLE_ALREADY_ATTEMPTED removed from MoveResult
  union (confirmed unreferenced elsewhere via grep).

- 245 shared + 98 client + 297 server tests passing (4 pre-existing server RED failures unchanged,
  unrelated to this plan's files). Typecheck clean on shared and client packages.

- Gap closure plan 08 (loose-ball scatter math) has no SUMMARY.md yet — still outstanding.
  Gap closure plan 10 (shot-range highlight filter) remains as the final item in the wave.

- Last updated: 2026-06-19
- Phase 17.1 Plan 08 complete (gap closure). Rewrote computeLooseBall to use cube-coordinate
  unit vectors instead of fixed ODD-Q offset deltas — fixes systematic NE/SW overshoot on
  multi-step scatter rolls (root cause diagnosed in .planning/debug/loose-ball-scatter-rolls.md).
  gameEngine.ts's D-08 board-edge clamp walk now calls computeLooseBall per step (single source
  of truth, no duplicated fixed-delta math). Added 72-case parity/direction/distance regression
  test. Corrected 5 pre-existing test fixtures/expectations across scoreUtils.test.ts,
  gameEngine.phase8.test.ts, and gameEngine.phase17.test.ts that encoded the old (incorrect)
  row-preserving trajectory assumption.

- 317 shared + 297 server tests passing (4 pre-existing server RED failures unchanged, confirmed
  via baseline worktree comparison at commit 1f3d17d — unrelated to this plan's files).
  Typecheck clean on all packages.

- Gap closure plan 10 (shot-range highlight filter) remains as the final item in the Phase 17.1
  gap-closure wave.

- Last updated: 2026-06-19
- Phase 17.1 Plan 11 complete (gap closure, CR-01). Made applyUndo's move-type lookup
  phase-aware (HP_MOVE in HIGH_PASS_MOVE, FTP_MOVE in FIRST_TIME_PASS_MOVE, MOVE otherwise)
  in both the lastMoveRelIdx search and the hasPriorMoves fallback; mirrored the identical
  mapping in ActionPanel.tsx's canUndo. De-masked two gameEngine.phase17.test.ts fixtures and
  one ActionPanel.test.tsx fixture that fabricated MOVE events to fake the FTP/HP undo
  boundary. Added two end-to-end game.integration.test.ts wire tests driving GAME_UNDO over a
  real socket during FIRST_TIME_PASS_MOVE and HIGH_PASS_MOVE.

- 297 server + 12/12 ActionPanel client tests passing; 4 pre-existing RED failures unchanged
  (2 MOVE-06 FREE_MOVE scaffolding gaps, 2 abandoned pre-17.1 firstTimePassStep design stubs).
  Typecheck clean across shared/server/client.

- CR-01 is closed. Remaining: re-run phase verification to confirm success criterion 3's undo
  clause now passes, then close out Phase 17.1.

## Current Position

Phase: 17.1 (action-flow-cleanup) — EXECUTING
Plan: 15 of 15 (all plans complete)
Status: Ready for re-verification
Last activity: 2026-06-20 -- Phase 17.1 Plan 15 complete (Review-CR-02 closed)
Plan 15 closed Review-CR-02 (FTP DEFENDER-slot delivery used a team-restricted receiver
lookup, ignoring a defending-team piece on passTargetHex). Receiver lookup is now
team-agnostic (BUG-04 parity): defending-team occupant transfers possession; attacking-team
occupant and empty-target behavior unchanged. 2 new integration tests added.
Next: re-run phase verification to confirm Review-CR-02 and CR-01 (Plan 11/14) are resolved,
then close out Phase 17.1.

## Performance Metrics

| Phase                                     | Plan   | Duration | Notes    |
| ----------------------------------------- | ------ | -------- | -------- |
| Phase 11-rule-correctness P02             | 20     | 1 tasks  | 2 files  |
| Phase 11 P03                              | 8      | - tasks  | - files  |
| Phase 11 P04                              | 5      | 3 tasks  | 3 files  |
| Phase 12 P01                              | 5m 11s | 2 tasks  | 2 files  |
| Phase 12-visual-token-hex-layer P02       | 5m 45s | 2 tasks  | 3 files  |
| Phase 12-visual-token-hex-layer P03       | 2m 21s | 2 tasks  | 3 files  |
| Phase 12-visual-token-hex-layer P03       | ~15m   | 3 tasks  | 3 files  |
| Phase 12-visual-token-hex-layer P04       | ~45m   | 3 tasks  | 2 files  |
| Phase 13-layout-clock P01                 | 2min   | 1 tasks  | 1 files  |
| Phase 13-layout-clock P02                 | 5m 5s  | 2 tasks  | 3 files  |
| Phase 13-layout-clock P03                 | 6min   | 2 tasks  | 8 files  |
| Phase 15-team-identity P01                | 3min   | 2 tasks  | 6 files  |
| Phase 15-team-identity P02                | 4min   | 2 tasks  | 2 files  |
| Phase 15-team-identity P03                | 6min   | 2 tasks  | 5 files  |
| Phase 16 P01                              | 4min   | 2 tasks  | 4 files  |
| Phase 16 P02                              | 7m     | 2 tasks  | 6 files  |
| Phase 16-player-roster-team-selection P04 | 12min  | 2 tasks  | 13 files |
| Phase 17-rule-bugs P01                    | 6m 50s | 3 tasks  | 4 files  |
| Phase 17-rule-bugs P02                    | 25min  | 3 tasks  | 2 files  |
| Phase 17-rule-bugs P03                    | 18min  | 3 tasks  | 5 files  |
| Phase 17.1 P01                            | 45     | 3 tasks  | 23 files |
| Phase 17.1 P02                            | 90min  | 3 tasks  | 16 files |
| Phase 17.1-action-flow-cleanup P03        | 9min   | 3 tasks  | 5 files  |
| Phase 17.1-action-flow-cleanup P04        | 15min  | 2 tasks  | 5 files  |
| Phase 17.1-action-flow-cleanup P05        | 5min   | 3 tasks  | 4 files  |
| Phase 17.1-action-flow-cleanup P07        | 4min   | 2 tasks  | 2 files  |
| Phase 17.1-action-flow-cleanup P09        | 5min   | 2 tasks  | 4 files  |
| Phase 17.1-action-flow-cleanup P08        | 35min  | 3 tasks  | 6 files  |
| Phase 17.1-action-flow-cleanup P10        | 6min   | 1 tasks  | 2 files  |
| Phase 17.1-action-flow-cleanup P11        | 7min   | 3 tasks  | 5 files  |
| Phase 17.1 P12                            | 25min  | 3 tasks  | 3 files  |
| Phase 17.1-action-flow-cleanup P13        | 12min  | 1 tasks  | 2 files  |
| Phase 17.1-action-flow-cleanup P14        | 6min   | 1 tasks  | 2 files  |
| Phase 17.1-action-flow-cleanup P15        | 12min  | 1 tasks  | 2 files  |

## Decisions

- [Phase ?]: RULE-01 client: contestant UI gated behind headerAccuracyRollPending; Continue emits GAME_HEADER_ACCURACY_ACK
- [Phase ?]: RULE-04: canSelectSnapDeflect pace guard added to HexGrid; aligns outline with store selectPiece exhaustion check
- [Phase ?]: RULE-05: root cause = stale paceUsedByPieceId from applySnapshot spread; applyStartMovement reset resolves it; post-deflect tests confirm correct behavior
- [Phase 11 P04]: vi.mock('../diceUtils.js') forces rollDice()=3; pre-existing duel test relaxed to accept LOOSE_BALL since heading=6+die=3 always ties; distance-7 assertion now unconditional INVALID_TARGET; Pitfall 5 corrected on both header handler finally blocks
- [Phase ?]: D-10: highlightType enum prop replaces free-form isHighlighted/highlightColor; HIGHLIGHT_STYLES internal table owns all tint color values as single source of truth in HexCell.tsx
- [Phase ?]: D-08: mini token rendered in PlayerStatsPanel header for selected piece
- [Phase ?]: D-09: self-contained SVG defs inside inline svg — no cross-document url(#...) reference from stats panel
- [Phase 12 P04]: D-07: isHeaderEligible AND isHeaderContestant both map to selectionState='active' (green ring); no separate isHeaderContestant prop in PieceOverlay
- [Phase 12 P04]: D-11: tint-only polygon overlays folded into HexCell highlightType; .hexZoIRisk removed; .hexTackleRisk retained for interception-risk pass overlay
- [Phase 12 P04]: D-12: highlightType priority order risk > goal > shot-path > kickoff > safe applied as single ternary in HexGrid
- [Phase 12 P04]: D-13: isHeaderNonGoalTarget overlay tint changed from cyan to white (rgba(255,255,255,0.35)); two-tier white tint added for shot-path vs shot-path-action
- [Phase ?]: Wave 0 socket mock pattern: extend { emit, on, off } with socket.io: { on, off } to support ConnectionStatus Manager events in GameBoard tests
- [Phase ?]: GameBoard.test.tsx Wave 0 RED state: 15 tests, 11 failing until Plan 02 rewrites GameBoard — Nyquist signal design
- [Phase 13 P02]: PHASE_LABEL and SLOT_TOTAL absorbed verbatim from TurnIndicator into GameBoard module scope
- [Phase 13 P02]: REPLAY phaseLabel suppressed in centre section to prevent getByText collision with ReplayPanel heading
- [Phase 13 P02]: topBand uses CSS Grid 56px 1fr 1fr 1fr auto 56px; pitchContainer gains position:relative for overlay anchoring
- [Phase 13 P02]: COMPACT_STATS selects 6 confirmed PlayerPiece fields (pace/shooting/tackling/heading/dribbling/highPass)
- [Phase 13 P03]: D-12 finalised — HALF_TIME/FULL_TIME routing branches removed from App.tsx; Screen type trimmed to 6 members; six retired component files deleted; emitHalfTimeStart preserved in store
- [Phase 15 P01]: badgeFile in TeamConfig is filename key only — static Vite import in TeamBadge gives content-hashed URLs (Pitfall 3 prevention)
- [Phase 15 P01]: TEAM_DEFAULTS is client-only module-level constant in teamDefaults.ts — stable reference for Zustand selectors (D-05, Pitfall 6 prevention)
- [Phase ?]: [Phase 15 P02]: D-06 refactor complete — TEAM_CONFIGS[TEAM_DEFAULTS[piece.teamId]] replaces positional color literals in PieceOverlay; home GK uses checker pattern url(#home-gk-checker-{id}); away GK retains solid amber with sibling edge stripes
- [Phase ?]: TeamShieldIcon deleted; TeamBadge PNG wired into scoreboard and player card icon (TEAM-06, D-07)
- [Phase ?]: D-06 color refactor complete: TEAM_CONFIGS[TEAM_DEFAULTS[...]] is single color source of truth in GameBoard, ActionLog, PlayerStatsPanel
- [Phase ?]: MiniTokenBadge home GK uses mini-home-gk-checker pattern (10px tile, 5px checkers) matching main board (D-10, Pitfall 2)
- [Phase ?]: [Phase 16 P02]: GK CSV blank attrs floored to 1 in seed-rosters.ts — test spec requires >=1 for all non-GK-specific attributes
- [Phase ?]: [Phase 16 P02]: eslint allowDefaultProject extended with packages/_/scripts/_.ts for seed-rosters.ts dev tool outside src/
- [Phase ?]: FREE_MOVE inserted after GK_KICK_MOVEMENT in GamePhase union; five new GameState fields added for PASS-02 and MOVE-06
- [Phase ?]: BUG-03 engine already works correctly via event-log scan; fix needed is handler phase guard at gameHandlers.ts:884
- [Phase ?]: BUG-05 already fixed in prior phase (gameEngine.ts line 1414 uses gkEffectivePos for dropped-save LOOSE_BALL)
- [Phase ?]: BUG-01: isHeaderPass guard uses state.lastActionType === HEADER (not newLastActionType)
- [Phase ?]: BUG-04: occupant check guards HIGH_PASS path to prevent pre-empting HEADER routing (newLastActionType !== HIGH_PASS)
- [Phase ?]: BUG-05: gkEffectivePos already used at save-dropped LOOSE_BALL return (pre-existing fix from Phase 10/11)
- [Phase ?]: [Phase 17 P03]: BUG-02 cancel uses paceUsedByPieceId emptiness check (Pitfall 5); BUG-03 handler now accepts MOVEMENT and HIGH_PASS_MOVEMENT via validUndoPhases array
- [Phase ?]: CHOOSE_ACTION replaced with PASS in gameEngine.ts (deferred phase — not yet in GamePhase union)
- [Phase ?]: FIRST_TIME_PASS_MOVE added to GamePhase union to satisfy exhaustive Record<GamePhase,string> in PHASE_LABEL
- [Phase ?]: D-01: heading removed from PlayerPiece; aerialAbility is the sole aerial stat
- [Phase ?]: D-02: steal exclusion reads stealAttemptedByIds in moveValidator (cross-type)
- [Phase 17.1 P04]: D-08: LOOSE_BALL_DIRECTIONS exported from scoreUtils; direction-delta clamp walk in applyRoll LOOSE_BALL branch (isPitchHex per step; stops at board edge)
- [Phase 17.1 P04]: D-09: hexDistance(shooter.position, goalHex) > 11 guard in applyDeclareShot before GK_DIVE; snapshot 6-hex gate unchanged
- [Phase 17.1-action-flow-cleanup]: D-03 FIRST_TIME_PASS_MOVE check reordered before generic occupant-check in applyRoll PASS branch (gap closure plan 07) — occupant-check was shadowing the transition for occupied targets, the realistic gameplay case
- [Phase 17.1-09]: Phase 17.1-09: moveValidator tackle branch mirrors steal branch exclusion pattern; TACKLE_ALREADY_ATTEMPTED removed from MoveResult union; HexGrid zoiRiskSet filters by stealAttemptedByIds
- [Phase ?]: [Phase 17.1-08]: computeLooseBall rewritten to use cube-coordinate unit vectors (parity-independent) instead of fixed ODD-Q offset deltas; toCube/fromCube exported from hex.ts as single source of truth for offset<->cube conversion
- [Phase ?]: [Phase 17.1-08]: gameEngine.ts LOOSE_BALL clamp walk now calls computeLooseBall per step instead of duplicating fixed-delta math; LOOSE_BALL_DIRECTIONS export removed entirely
- [Phase 17.1-10]: regularShooter resolution mirrors snapCarrier/quickThrowTargetSet ball.carrierId->pieces.find pattern; isShootingModeGoalHex regular-shot branch now gates on hexDistance(regularShooter.position, hex) <= 11 matching server applyDeclareShot D-09 gate
- [Phase ?]: [Phase 17.1-11]: applyUndo moveToUndo cast widened to Extract<ActionEvent, {type:'MOVE'|'HP_MOVE'|'FTP_MOVE'}> -- phase-aware moveTypeForPhase constant mirrored identically in client canUndo
- [Phase ?]: FIRST_TIME_PASS_MOVE selectPiece branch mirrors HIGH_PASS_MOVE structurally (pace cap 1 via firstTimePassPaceUsed, slot lock via firstTimePassMovedPieceId), returns early, never calls validateMove — validateMove's WRONG_SLOT guard was the CR-01-new root cause; this phase tracks position via firstTimePassMovementSlot, not movementSlot
- [Phase ?]: setGameState sticky-selection branch extended to cover FIRST_TIME_PASS_MOVE with phase-keyed paceRemaining/lockedId ternaries — keeps locked FTP piece selected across same-slot broadcasts, matching existing HIGH_PASS_MOVE/GK_KICK_MOVE behavior
- [Phase 17.1-13]: CR-02-new closed: applyRoll interception-loop bypass extended to FIRST_TIME_PASS (newLastActionType === FIRST_TIME_PASS) alongside the existing header-pass bypass — Closes the second newly-confirmed Phase 17.1 verification gap; FTP near a defender now reaches FIRST_TIME_PASS_MOVE instead of SUCCESSFUL_TACKLE
- [Phase 17.1-14]: applyUndo resets firstTimePassMovedPieceId/firstTimePassPaceUsed (or highPassMovedPieceId/highPassPaceUsed) via a phase-conditional lockReset spread, mirroring the canonical null/0 slot-clear shape — Closes Review-CR-01: undo previously restored piece position but left the repositioning slot permanently locked
- [Phase 17.1-action-flow-cleanup]: FTP DEFENDER-slot delivery receiver lookup made team-agnostic (BUG-04 parity): occupant search has no teamId filter; possession transfers when occupant.teamId differs from prior attackingTeam, mirroring gameEngine.ts BUG-04 (1272-1297)
