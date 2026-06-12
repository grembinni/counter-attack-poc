# Counter Attack POC

## What This Is

A 2-player real-time web implementation of Counter Attack, the hex-grid football strategy board game by Webstar Games. Two players connect via a shared room code and play a complete match through a browser — no installation required. The game models the physical board faithfully: hex movement, dice rolls, pass accuracy checks, Zone of Influence, and shooting duels, with a chess-like click-to-move interface.

## Core Value

Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.

## Current Milestone: v1.1 UX Tuning & Bug Cleanup

**Goal:** Overhaul visual presentation and layout — team token redesign, unified hex highlight system, scoreboard/action top-area layout, improved match clock and replay — while fixing 7 specific gameplay bugs.

**Target features:**

- Team token visual redesign (stripes distinguishing home/away)
- Unified hex highlight system (8 consistent states across all game phases)
- Top-area layout: persistent scoreboard + action/log panel above the hex grid
- Match clock overhaul: MM:SS format, 45:00 second-half start, always visible
- Kickoff constraints: midfield/backs to cols 6–20; only Standard Pass from kick off hex
- Replay: double speed, simultaneous move animation, ball tracking fix
- Bug fixes: header sequence (2), snapshot path clear, deflection highlights, post-deflect Movement Phase, clock

## Current State

**v1.1 milestone in progress.** v1.0 shipped 2026-06-11 — fully playable Counter Attack on Render (13 phases, 65/66 requirements). v1.1 focuses on visual polish, layout redesign, and 7 bug fixes identified during v1.0 UAT. Phase 11 complete — rule-correctness fixes (header sequencing, snapshot cleanup, deflection highlights, post-deflect movement entry); 252 server tests green.

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

### Active (v1.1 — in progress)

- [ ] Team token visual redesign (home: vertical black stripe; away: horizontal dark stripes)
- [ ] Unified hex highlight system (8 states: selectable/active/activated/risk/goal/safe/kickoff/shot-path)
- [ ] Top-area scoreboard (home score | time/half/connection | away score)
- [ ] Top-area action/log panel (action buttons + status + event log)
- [ ] Match clock: MM:SS format, 45:00 second-half start, always visible
- [ ] Kickoff constraints: midfield/backs cols 6–20; only Standard Pass from kick off hex
- [ ] Replay: double speed, simultaneous move animation, ball tracking fix
- [ ] Bug: header contest triggers after high pass accuracy check
- [ ] Bug: header targeting triggers after header contestant duel
- [ ] Bug: snapshot path hexes clear after phase ends
- [ ] Bug: deflection highlights stop at max pace
- [ ] Bug: post-shot-deflect Movement Phase activates both teams

### Deferred (v1.2 candidates)

- [ ] **MOVE-06**: Free 6-hex move after action confined to one final third — scaffolded in `gameEngine.ts:517`, handler not implemented
- [ ] **PASS-02 (partial)**: Mid-pass player movement during First-time Pass flight — deferred per TODO at `gameEngine.ts:1087`

### Out of Scope

- Fouls, bookings, yellow/red cards — defer to v2
- Injuries and resilience checks — defer to v2
- Corner kicks, throw-ins, free kicks, penalties — defer to v2
- Nutmeg, reckless tackle, last-man foul, professional foul — defer to v2
- Substitutions — defer to v2
- Offside enforcement — defer to v2
- AI / single-player mode — not planned
- Animations — static state updates only
- Mobile layout — desktop-first only

## Context

- Rules reference: Counter Attack Rules Reference Rulebook v1.4.1 (Giannis Tilias)
- Physical board: 37×26 axial hex grid, flat-top orientation, HEX_SIZE=20px
- Kick-off hex: `{q:18, r:13}` (board centre)
- Difficult-angle hexes: 16 corner-kick zone hexes (4 per corner)
- Hardcoded squads: two tier-balanced teams, attributes on 1–6 scale
- Deployment: Render web service (Express + Socket.io + static client from single process)

## Constraints

- **Tech — Backend**: Node.js + Socket.io; keeps the WebSocket layer portable to AWS (EC2, Elastic Beanstalk, ECS)
- **Tech — Frontend**: React (Vite); served as static files, can be hosted on S3+CloudFront later
- **Deployment target**: Render (v1.0 POC); AWS EB-compatible with no code changes required
- **Scope**: Core rules only in v1; full rulebook fidelity deferred to future milestones
- **Multiplayer**: Real-time only (no async/turn-timer mode); requires active WebSocket connection

## Key Decisions

| Decision                            | Rationale                                                                                    | Outcome                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Server-authoritative game state     | Prevents cheating, simplifies sync, maps cleanly to AWS stateful containers                  | Implemented — full snapshot broadcast after every action; `isProcessing` mutex         |
| Socket.io over raw WebSockets       | Handles reconnection and room management out of the box; negligible overhead                 | Implemented — typed events via generics; `transports: ['websocket']` only (no polling) |
| React + Vite frontend               | Fast dev loop, static build output suitable for S3+CloudFront                                | Implemented — `vite build` → `dist/`; served by Express in production                  |
| Hardcoded teams for v1              | Eliminates card editor scope; lets us validate gameplay loop first                           | Validated — two tier-balanced squads ship in v1.0                                      |
| Core rules only for v1              | Fouls/injuries add significant state complexity; validate core loop before adding edge cases | Validated — all 65 core-rule requirements satisfied                                    |
| Render deployment over AWS EB       | Simpler first deploy; no Elastic Beanstalk config overhead; Render Blueprint IaC             | Validated — single web service, `render.yaml`, CI gate on push; AWS EB path preserved  |
| SVG over Canvas for rendering       | ≤600 hexes well within SVG performance range; DevTools-inspectable; CSS transitions free     | Validated — 37×26 grid renders performantly; no Canvas needed                          |
| Zustand over Redux for client state | Zero boilerplate; per-slice selectors prevent full re-renders; socket handlers call setState | Validated — per-slice selectors throughout; no render-all issues observed              |

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

_Last updated: 2026-06-12 (Phase 11 complete — rule-correctness)_
