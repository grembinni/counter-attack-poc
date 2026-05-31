---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
last_updated: '2026-05-31T00:00:00.000Z'
progress:
  total_phases: 9
  completed_phases: 5
  total_plans: 20
  completed_plans: 17
  percent: 56
---

# Project State

## Current Phase

Phase 6 — planned, ready to execute (next: `/gsd-execute-phase 6`)

## Project Reference

See: .planning/PROJECT.md

**Core value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.
**Current focus:** Phase 06 — react-hex-grid-renderer

## Phase Status

| Phase | Name                                     | Status      | Completed  |
| ----- | ---------------------------------------- | ----------- | ---------- |
| 1     | Monorepo Scaffold + Shared Types         | Complete    | 2026-05-28 |
| 2     | Move Validator + Unit Tests              | Complete    | 2026-05-29 |
| 3     | Server Room Manager + Socket.io Scaffold | Not started | -          |
| 4     | Game Engine + Phase FSM                  | Not started | -          |
| 5     | Dice Resolver + All Resolution Branches  | Not started | -          |
| 6     | React Hex Grid Renderer                  | Planned     | -          |
| 7     | Client-Server Integration                | Not started | -          |
| 8     | Match Lifecycle + Post-Game Replay       | Not started | -          |
| 9     | AWS Deployment                           | Not started | -          |

## Blocking Dependencies

- **Board layout (RESOLVED in Phase 6 plan):** Real 37×26 grid (q∈[0,36], r∈[0,25]) with exact region boundaries defined in Phase 6 CONTEXT.md D-04/D-05. Difficult-angle hexes approximated; TODO: verify against docs/board-photo.jpg when available (D-06).
- **Hex orientation (RESOLVED in Phase 6 plan):** Flat-top confirmed (CONTEXT.md D-01). axialToPixel formula locked.
- **Team squad attributes:** Full 9-attribute sets for both hardcoded squads not yet defined. Must be finalised before Phase 5 dice resolution uses attribute values.
- **Referee card behaviour:** Whether Leniency affects anything beyond added time is unconfirmed from rulebook v1.4.1. Hardcode one card for v1; clarify before Phase 8.
- **Pass range distance type:** Resolved in Phase 2 — implemented as axial hex distance (hexDistance). Physical rulebook verification pending before Phase 5 live use.
- **ZoI scope:** Resolved in Phase 2 — ZoI triggers a STEAL_ATTEMPT for movement (moveValidator) and produces an interceptors list for passes (passValidator). Physical rulebook verification pending before Phase 5 live use.

## Accumulated Context

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

### Key Pitfalls to Avoid

- Never generate dice on the client; all rolls use `crypto.randomInt` server-side
- Always return `socket.off(event, handler)` from every `useEffect` that registers a socket listener
- Never use offset hex coordinates; axial only from day one
- Define FSM structure before implementing the second game phase
- Wire disconnect handler in the same commit as room creation (no orphaned rooms)
- Add `isProcessing` mutex before writing any game logic (prevents double-click race)

### Open Questions (resolve before indicated phase)

- Phase 4/7: Are valid moves computed on piece selection or precomputed post-state?
- Phase 5: Full attribute values for both hardcoded squads?
- Phase 6: Flat-top or pointy-top hex orientation?
- Phase 8: Tiebreaker rule at full time, or is a draw valid?
- Phase 8: Does referee card affect anything beyond Leniency/added time?

## Session Continuity

- Last updated: 2026-05-31
- Phase 5 complete: 84 tests (all green), build clean, 3 verification gaps closed
- Phase 6 planned: 3 plans in 3 waves — pitch.ts 37×26 + client scaffold + SVG rendering + lobby/sidebar UI
- Phase 6 blocking dependencies resolved: flat-top orientation, axial formula, 37×26 grid, region boundaries
- Open question from Phase 6: Flat-top vs pointy-top confirmed as flat-top (D-01)
- Next action: `/gsd-execute-phase 6` (React Hex Grid Renderer)
