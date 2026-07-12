# Counter Attack POC

## What This Is

A 2-player real-time web implementation of Counter Attack, the hex-grid football strategy board game by Webstar Games. Two players connect via a shared room code and play a complete match through a browser — no installation required. The game models the physical board faithfully: hex movement, dice rolls, pass accuracy checks, Zone of Influence, and shooting duels, with a chess-like click-to-move interface. v1.2 adds four named teams (Cozmos, Xolos, City, Crew) with badge PNGs and jersey patterns, CSV-seeded player rosters with a pre-match team-selection lobby, offside detection, 28 bug fixes, and 8 UX enhancements including game-speed selection, end-turn confirmation, final-third markers, and a transient EventBanner.

## Core Value

Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## Current State

**v1.3 shipped 2026-07-11.** 7 phases (32 plans). Expanded from 4 fictional teams to 12 real-league teams (6 MLS + 6 International) with full visual identities; 18-style uniform selection screen; 4 dynamic formations (4-4-2, 5-3-2, 4-3-3, 3-4-3) with stat-driven auto-assignment and player swap; OFFSIDE-01/02 human UAT formally closed; FREE_KICK_SETUP 6-step sequence (kicker select + stage repositioning); GK_KICK and LOOSE_BALL_LAND replay visibility fixed; jersey centering and Style 12 SVG pattern fixed. Full test suite: ~1,100+ tests across shared/server/client.

**Known tech debt entering v1.4:**

- KICK_OFF_SETUP shot-path hex shading persists after SNAPSHOT_DEFLECT goal (BUG-23 — root cause unresolved, escalated; `.planning/todos/pending/`)
- FREE_KICK_SETUP Undo not implemented (undo within/across stages; `.planning/todos/pending/free-kick-setup-undo-not-implemented.md`)
- HIGH_PASS_MOVE missing carrier-repositioning exclusion (documented, not fixed; parallel to Phase 17.1-16 FIRST_TIME_PASS_MOVE fix)
- Three response-move test fixtures in `useGameStore.test.ts` carry stale `movementSlot: 'ATTACKER_4'` (inert fixture-hygiene risk)

## Completed Milestone: v1.3 Team Customization & Formation System

**Goal:** Expand from 4 fictional teams to 12 real-league teams grouped by league, add dynamic formation selection at kickoff with stat-driven auto-assignment, decouple team/player data to support v1.4 draft mode, and close all known v1.2 backlog bugs.

**Target features:**

- Team library — 12 selectable teams across MLS (City, Crew + 4 new) and International (6 new); Xolos/Cozmos retired as color schemes + player pool contributors; color scheme entity decoupled from team identity
- Formation selection — 4-4-2, 5-3-2, 4-3-3, 3-4-3 chosen at each kickoff; hex starting positions placed dynamically per formation
- Auto-assign with override — System assigns 11 players to roles by stat weight (anchor: CB/CM/CF; flex: FB, winger, flex-mid), player can swap before confirming lineup
- v1.4 data foundations — Player pool as global entity; color scheme as reusable visual identity; architecture supports random draft next milestone
- Bug & UX block — OFFSIDE-01/02 UAT closure, GK_KICK/LOOSE_BALL_LAND replay gaps, HIGH_PASS_MOVE carrier exclusion, plus any v1.3 regressions

## Requirements

### Validated (v1.0)

All 65 satisfied requirements are archived in [.planning/milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md).

Key groups:

- **ARCH-01..07**: Server-authoritative pnpm monorepo; pure shared validation; axial coordinates; full-snapshot broadcast; Render deployment (AWS EB-compatible)
- **CONN-01..04**: Room create/join, session middleware, reconnect with 90s grace timer
- **MOVE-01..05, MOVE-07**: 4-5-2 movement sequence, Pace caps, occupancy rules, ZoI steal, snapshot in box
- **PASS-01..05, HEAD-01..05**: All four pass types, heading duels, header-at-goal, HEAD-05 exclusion
- **SHOT-01..06, SNAP-01..03**: Shot/save duels, GK_DIVING, handling check, SNAP_DEFLECT path-deflection
- **MATCH-01..05, REPLAY-01..03**: Two-half match with added time, kick off procedure, post-game replay
- **DICE-01..05, UNDO-01..04, UX-01..04, TEAM-01..03, PITCH-01..05**: Full rules, UX, player attributes

### Validated (v1.1)

All v1.1 requirements are archived in [.planning/milestones/v1.1-REQUIREMENTS.md](milestones/v1.1-REQUIREMENTS.md).

- ✓ **VIS-01, VIS-02** — Token stripe design (home vertical, away horizontal) in all contexts — v1.1
- ✓ **UX-05, UX-06** — Selection state outlines (blue/green/orange) + 5-type hex tint system — v1.1
- ✓ **LAYOUT-01, LAYOUT-02** — Persistent top-band scoreboard + action/log panel — v1.1
- ✓ **CLOCK-01, CLOCK-02** — MM:00 event-driven clock visible in all phases — v1.1
- ✓ **RULE-01..05** — Header sequencing, snapshot cleanup, deflection pace, post-deflect Movement Phase — v1.1
- ✓ **MATCH-07** — KICKOFF_STANDARD_PASS_ONLY guard server + client — v1.1 (wired; req unchecked)
- ✓ **REPLAY-04, REPLAY-05** — 500ms cadence, simultaneous step-frames — v1.1 (wired; req unchecked)
- ✗ **REPLAY-06** — Ball tracking live-session bugs deferred to v1.2 — v1.1 partial

### Validated (v1.2)

All v1.2 requirements are archived in [.planning/milestones/v1.2-REQUIREMENTS.md](milestones/v1.2-REQUIREMENTS.md).

- ✓ **TEAM-01..06** — Four named teams with badge PNGs, jersey patterns, and color system — Phase 15
- ✓ **PLAY-01..03, SELECT-01** — CSV-seeded rosters, player card redesign, team-selection lobby — Phase 16
- ✓ **BUG-01..05, MOVE-06, PASS-02** — Seven rule-correctness defects fixed and verified — Phase 17 / 17.1
- ✓ **DESIGN-01, MATCH-06** — Messaging/logging convention sweep + MATCH-06 text fix — Phase 18
- ✓ **DESIGN-02, REPLAY-06** — Replay frame visibility + post-game playback optimization — Phase 18.1
- ✓ **DESIGN-03, DESIGN-04** — Duplicate-logic consolidation + dead-code removal — Phase 18.2
- ✓ **BUG-06..21** — 16 bug-bash fixes (rule correctness, client UX, movement state machine) — Phases 18.2/18.3
- ✓ **UX-07..14** — 8 UX enhancements (game speed, end-turn dialog, final-third lines, tooltips, EventBanner) — Phase 18.4
- ✓ **OFFSIDE-01, OFFSIDE-02** — Human UAT formally closed (Phase 25 two-tab session)

### Validated (v1.3 — complete)

- ✓ **UNIFORM-02** — Away player sees style tiles in their team's away colors (awayPrime/awayAlt) — Phase 22
- ✓ **UNIFORM-03** — 18 style tiles in 2×9 grid; defaultUniformStyle pre-selected on team pick — Phase 22
- ✓ **UNIFORM-04** — Full selection flow: home picks first → away unlocks → both confirm → game starts with chosen styles on pieces — Phase 22
- ✓ **LEAGUE-01..03** — League categorization, MLS 6-team + International 6-team sets — Phases 19–21
- ✓ **TEAM-07..10, INTL-01..06** — 10 new teams with full visual identity (badge, jersey, color) — Phase 21
- ✓ **DATA-01..03** — ColorScheme entity, global player pool, team/player decoupling — Phase 19
- ✓ **FORM-01..04** — Four formations with dynamic hex placement — Phase 23
- ✓ **ASSIGN-01..04** — Stat-weight auto-assignment + player swap override + lineup confirm gate — Phase 24
- ✓ **REPLAY-07, REPLAY-08** — GK_KICK and LOOSE_BALL_LAND delivery visible in replay — Phase 25
- ✓ **BUG-22** — HIGH_PASS_MOVE carrier exclusion documented/applied — Phase 25
- ✓ **UX-15** — Jersey number centering, Style 12 symmetric quarters, EventBanner, uniform-selection race fix — Phase 25
- ✓ **OFFSIDE-01, OFFSIDE-02** — Free-kick step sequence (kicker select + 6 stages) implemented and UAT-closed — Phases 25

### Deferred (v2 candidates)

- [ ] Fouls, yellow/red cards, booking checks
- [ ] Injuries and resilience checks
- [ ] Corner kicks, throw-ins, free kicks, penalty kicks
- [ ] Nutmeg, reckless tackle, last-man foul, professional foul
- [ ] Substitutions
- [ ] Offside enforcement
- [ ] Reconnection grace period (server holds room state for disconnected player)
- [ ] Rematch flow
- [ ] Chat

### Out of Scope

- AI / single-player mode — not planned
- Animations (piece movement between hexes) — static state updates only
- Mobile layout — desktop-first (responsive-aware but not mobile-first)
- Sound effects / audio
- Custom team / card editor — hardcoded teams only
- Spectator mode — not planned

## Context

- Rules reference: Counter Attack Rules Reference Rulebook v1.4.1 (Giannis Tilias)
- Physical board: 37×26 axial hex grid, flat-top orientation, HEX_SIZE=20px
- Kick-off hex: `{q:18, r:13}` (board centre)
- Difficult-angle hexes: 16 corner-kick zone hexes (4 per corner)
- Hardcoded squads: two tier-balanced teams, attributes on 1–6 scale
- Deployment: Render web service (Express + Socket.io + static client from single process)
- Test suite: 218 shared + ~250 server + 71 client = ~540 tests total

## Constraints

- **Tech — Backend**: Node.js + Socket.io; keeps the WebSocket layer portable to AWS (EC2, Elastic Beanstalk, ECS)
- **Tech — Frontend**: React (Vite); served as static files, can be hosted on S3+CloudFront later
- **Deployment target**: Render (v1.0 POC); AWS EB-compatible with no code changes required
- **Scope**: Core rules only in v1; full rulebook fidelity deferred to future milestones
- **Multiplayer**: Real-time only (no async/turn-timer mode); requires active WebSocket connection

## Key Decisions

| Decision                                                   | Rationale                                                                                                                     | Outcome                                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Server-authoritative game state                            | Prevents cheating, simplifies sync, maps cleanly to AWS stateful containers                                                   | Implemented — full snapshot broadcast after every action; `isProcessing` mutex             |
| Socket.io over raw WebSockets                              | Handles reconnection and room management out of the box; negligible overhead                                                  | Implemented — typed events via generics; `transports: ['websocket']` only (no polling)     |
| React + Vite frontend                                      | Fast dev loop, static build output suitable for S3+CloudFront                                                                 | Implemented — `vite build` → `dist/`; served by Express in production                      |
| Hardcoded teams for v1                                     | Eliminates card editor scope; lets us validate gameplay loop first                                                            | Validated — two tier-balanced squads ship in v1.0                                          |
| Core rules only for v1                                     | Fouls/injuries add significant state complexity; validate core loop before adding edge cases                                  | Validated — all 65 core-rule requirements satisfied                                        |
| Render deployment over AWS EB                              | Simpler first deploy; no Elastic Beanstalk config overhead; Render Blueprint IaC                                              | Validated — single web service, `render.yaml`, CI gate on push; AWS EB path preserved      |
| SVG over Canvas for rendering                              | ≤600 hexes well within SVG performance range; DevTools-inspectable; CSS transitions free                                      | Validated — 37×26 grid renders performantly; no Canvas needed                              |
| Zustand over Redux for client state                        | Zero boilerplate; per-slice selectors prevent full re-renders; socket handlers call setState                                  | Validated — per-slice selectors throughout; no render-all issues observed                  |
| MM:00 clock format over MM:SS                              | Event-driven actionCount is precise; real-time wall clock would drift from server state                                       | Validated (v1.1) — D-08 override accepted; CLOCK-01 spec updated in spirit                 |
| HALF_TIME/FULL_TIME as pitch overlays                      | Keeps top band + clock always visible; eliminates separate Screen routing paths                                               | Validated (v1.1) — D-12; 6 dead component files deleted; Screen type trimmed to 6 members  |
| SelectionState enum over boolean bag                       | 4 booleans → 1 enum; single ternary for ring color; cleaner prop contract                                                     | Validated (v1.1) — PieceOverlay selectionState: none/selectable/active/activated           |
| HexHighlightType union + priority ternary                  | Eliminates prop drilling of colors; single source of truth in HIGHLIGHT_STYLES table                                          | Validated (v1.1) — risk > goal > shot-path > kickoff > safe; 5 tint types distinct         |
| badgeFile as filename key only                             | Static Vite import in TeamBadge gives content-hashed URLs; no runtime resolution needed                                       | Validated (v1.2) — PNG badge renders correctly in scoreboard and player card at build time |
| TEAM_CONFIGS color source of truth                         | Eliminates positional home/away color strings; single lookup per team across all surfaces                                     | Validated (v1.2) — GameBoard, ActionLog, PlayerStatsPanel all use TEAM_CONFIGS[teamId]     |
| firstTimePassCarrierId in GameState                        | Prevents self-pass reclaim exploit; mirrors highPassCarrierId lifecycle                                                       | Validated (v1.2) — passer excluded from FTP repositioning target and delivery occupant     |
| computeLooseBall cube-coordinate vectors                   | Eliminates systematic NE/SW overshoot caused by fixed ODD-Q offset deltas on axial grid                                       | Validated (v1.2) — 72-case regression test; clamp walk per-step from gameEngine.ts         |
| FTP_MOVE_ENABLED=false feature flag                        | Disables FIRST_TIME_PASS_MOVE sub-phase by default; code kept for future toggle                                               | Validated (v1.2) — direct delivery path mirrors STANDARD_PASS behavior                     |
| checkHalfEndOnTackle exported helper                       | Gates half-end correctly on tackle/steal paths; reads addedTime without re-rolling                                            | Validated (v1.2) — called at 3 tackle/steal success sites; 9 regression tests              |
| UniformSelectionScreen replaces tabbed TeamSelectionScreen | Single screen with flat 6×2 team grid + 2×9 style tile grid; no tabs; home picks first, away locked until home confirms       | Validated (v1.3/Ph22) — UNIFORM-02/03/04; UAT 11/11 passed                                 |
| awayLocked gate on UNIFORM_CONFIRM ordering                | Server rejects away UNIFORM_CONFIRM before home confirms (WRONG_TURN); client shows locked state until homeConfirmedStyle set | Validated (v1.3/Ph22) — Nyquist G2/G3 integration tests                                    |
| mix-blend-mode: multiply on team badges                    | Removes white PNG backgrounds on colored card backgrounds without modifying source PNG files                                  | Validated (v1.3/Ph22) — UAT Test 3                                                         |
| tileRenderPalette for away style tiles                     | Away player sees their team's away colors (awayPrime/awayAlt) on style tiles, not home palette                                | Validated (v1.3/Ph22) — UNIFORM-02; UAT Test 9                                             |

## Evolution

This document is updated at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-07-11 after Phase 25 (Bug & UAT Closure) — v1.3 milestone complete_
