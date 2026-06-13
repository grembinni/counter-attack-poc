# Counter Attack POC

## What This Is

A 2-player real-time web implementation of Counter Attack, the hex-grid football strategy board game by Webstar Games. Two players connect via a shared room code and play a complete match through a browser — no installation required. The game models the physical board faithfully: hex movement, dice rolls, pass accuracy checks, Zone of Influence, and shooting duels, with a chess-like click-to-move interface. v1.1 adds stripe-differentiated team tokens, a persistent scoreboard/action top band, MM:00 match clock, unified hex highlight system, kick off enforcement, and 5 rule-correctness fixes.

## Core Value

Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## Current State

**v1.1 shipped 2026-06-12.** Visual overhaul complete: team token stripes, persistent top-band layout with MM:00 clock, unified 5-type hex highlight system, kick off enforcement, and all 5 rule-correctness bugs fixed. 77 automated tests green (35 server rule11, 22 client visual, 15 layout/clock, 5 replay/kickoff). Deployed to Render (v1.0 deployment unchanged).

**Known tech debt:**

- REPLAY-06 live-session ball tracking edge cases deferred (minor; unit test passes)
- Intermittent timing failures in game.integration.test.ts / kickoffSetup.integration.test.ts (pre-existing, not v1.1 introduced)

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
- ⚠ **MATCH-06** — Symmetric DEF/MID formation (req text ambiguous; design intent met) — v1.1
- ✗ **REPLAY-06** — Ball tracking live-session bugs deferred to v1.2 — v1.1 partial

### Active (v1.2 — next milestone)

- [ ] **REPLAY-06** fix: live-session ball tracking edge cases (pickups, passes, steals mid-replay)
- [ ] **MATCH-06** req text update: rewrite to "each team's DEF/MID within symmetric columns of kick-off hex"
- [ ] **MOVE-06**: Free 6-hex move for all players in opposite final third — scaffolded in `gameEngine.ts:517`, handler not implemented
- [ ] **PASS-02 (partial)**: Mid-pass player movement (1 hex per team) during First-time Pass flight — deferred per TODO at `gameEngine.ts:1087`

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

| Decision                                  | Rationale                                                                                    | Outcome                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Server-authoritative game state           | Prevents cheating, simplifies sync, maps cleanly to AWS stateful containers                  | Implemented — full snapshot broadcast after every action; `isProcessing` mutex            |
| Socket.io over raw WebSockets             | Handles reconnection and room management out of the box; negligible overhead                 | Implemented — typed events via generics; `transports: ['websocket']` only (no polling)    |
| React + Vite frontend                     | Fast dev loop, static build output suitable for S3+CloudFront                                | Implemented — `vite build` → `dist/`; served by Express in production                     |
| Hardcoded teams for v1                    | Eliminates card editor scope; lets us validate gameplay loop first                           | Validated — two tier-balanced squads ship in v1.0                                         |
| Core rules only for v1                    | Fouls/injuries add significant state complexity; validate core loop before adding edge cases | Validated — all 65 core-rule requirements satisfied                                       |
| Render deployment over AWS EB             | Simpler first deploy; no Elastic Beanstalk config overhead; Render Blueprint IaC             | Validated — single web service, `render.yaml`, CI gate on push; AWS EB path preserved     |
| SVG over Canvas for rendering             | ≤600 hexes well within SVG performance range; DevTools-inspectable; CSS transitions free     | Validated — 37×26 grid renders performantly; no Canvas needed                             |
| Zustand over Redux for client state       | Zero boilerplate; per-slice selectors prevent full re-renders; socket handlers call setState | Validated — per-slice selectors throughout; no render-all issues observed                 |
| MM:00 clock format over MM:SS             | Event-driven actionCount is precise; real-time wall clock would drift from server state      | Validated (v1.1) — D-08 override accepted; CLOCK-01 spec updated in spirit                |
| HALF_TIME/FULL_TIME as pitch overlays     | Keeps top band + clock always visible; eliminates separate Screen routing paths              | Validated (v1.1) — D-12; 6 dead component files deleted; Screen type trimmed to 6 members |
| SelectionState enum over boolean bag      | 4 booleans → 1 enum; single ternary for ring color; cleaner prop contract                    | Validated (v1.1) — PieceOverlay selectionState: none/selectable/active/activated          |
| HexHighlightType union + priority ternary | Eliminates prop drilling of colors; single source of truth in HIGHLIGHT_STYLES table         | Validated (v1.1) — risk > goal > shot-path > kickoff > safe; 5 tint types distinct        |

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

_Last updated: 2026-06-13 after v1.1 milestone_
