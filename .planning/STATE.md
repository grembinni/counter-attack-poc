---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: ready_to_plan
last_updated: '2026-06-06T17:49:20.218Z'
progress:
  total_phases: 16
  completed_phases: 10
  total_plans: 44
  completed_plans: 38
  percent: 63
---

# Project State

## Current Phase

Phase 8.1 — context gathered; ready to plan

## Project Reference

See: .planning/PROJECT.md

**Core value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.
**Current focus:** Phase 08.1 — cleanup-player-stats-ball-control-movement-tackling

## Phase Status

| Phase | Name                                     | Status      | Completed  |
| ----- | ---------------------------------------- | ----------- | ---------- |
| 1     | Monorepo Scaffold + Shared Types         | Complete    | 2026-05-28 |
| 2     | Move Validator + Unit Tests              | Complete    | 2026-05-29 |
| 3     | Server Room Manager + Socket.io Scaffold | Complete    | 2026-05-29 |
| 4     | Game Engine + Phase FSM                  | Complete    | 2026-05-30 |
| 5     | Dice Resolver + All Resolution Branches  | Complete    | 2026-05-30 |
| 6     | React Hex Grid Renderer                  | Complete    | 2026-05-31 |
| 7     | Client-Server Integration                | Complete    | 2026-06-03 |
| 7.1   | UI Cleanup                               | Complete    | 2026-06-04 |
| 8     | Match Lifecycle + Post-Game Replay       | Complete    | 2026-06-05 |
| 9     | AWS Deployment                           | Not started | -          |

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

### Decisions Locked (Phase 8)

- GAME_KICK_OFF_MOVE/GAME_READY/GAME_HALF_TIME_START handlers enforce KICK_OFF_SETUP placement with isProcessing mutex and snap-back pattern
- ELIGIBLE_NEXT_ACTIONS sequence guard on all action handlers (INVALID_SEQUENCE on violation)
- kickOffActive=true set on KICK_OFF→MOVEMENT; cleared after first pass from centre hex
- FULL_TIME triggers startReplayStream: 3s hold then 1s/frame setInterval (room.replayTimer)
- Disconnect handler clears replayTimer to prevent post-disconnect frame emission (T-08-15)
- addedTimeRoll pre-generated via rollDice() before every applyEndTurn call (D-05/MATCH-02)

## Quick Tasks Completed

| Slug                   | Date       | Description                                                    |
| ---------------------- | ---------- | -------------------------------------------------------------- |
| phase-selection-flow   | 2026-06-06 | Fix choose-phase flow, passType to server, Move from PASS      |
| possession-phase-bugs  | 2026-06-06 | End phase on steal/tackle; cap ATTACKER_2 pace at 2            |
| undo-kickoff-ball-bugs | 2026-06-06 | Ball kept after steal; undo scoped; X clears; KICK_OFF chooser |

## Session Continuity

- Last updated: 2026-06-06
- Quick task phase-selection-flow COMPLETE (commit c6a1cbf):
  - game:start-movement now accepts PASS phase (was KICK_OFF-only)
  - game:roll now receives passType from client; server validates + sets lastActionType
  - ActionPanel PASS phase redesigned as two-step choose-phase → roll flow
  - Shoot button added when SNAPSHOT/SHOT is eligible
- Phase 8 COMPLETE — 6 of 6 plans complete (08-01 through 08-06)
- Next: Phase 9 (AWS Deployment)
