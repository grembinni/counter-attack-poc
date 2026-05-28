# Project State

## Current Phase
Phase 1 — not started

## Project Reference
See: .planning/PROJECT.md

**Core value:** Two friends can open a browser, share a room code, and play a complete match of Counter Attack against each other in real time.
**Current focus:** Phase 1 — Monorepo Scaffold + Shared Types

## Phase Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Monorepo Scaffold + Shared Types | Not started |
| 2 | Move Validator + Unit Tests | Not started |
| 3 | Server Room Manager + Socket.io Scaffold | Not started |
| 4 | Game Engine + Phase FSM | Not started |
| 5 | Dice Resolver + All Resolution Branches | Not started |
| 6 | React Hex Grid Renderer | Not started |
| 7 | Client-Server Integration | Not started |
| 8 | Match Lifecycle + Post-Game Replay | Not started |
| 9 | AWS Deployment | Not started |

## Blocking Dependencies

- **Board layout (HARD BLOCK):** Physical Counter Attack pitch hex coordinates (q, r) not yet measured — placeholder rectangular grid used in Phase 1 (`packages/shared/src/pitch.ts`). Must be resolved before Phase 6 hex renderer reflects real board geometry and before Phase 4 boundary-dependent rules (goal detection, penalty box, pitch edge) are accurate.
- **Hex orientation (SOFT BLOCK):** Flat-top vs pointy-top orientation not yet confirmed against physical board. Must be resolved before Phase 6 (`axialToPixel` formula and SVG polygon points depend on this).
- **Team squad attributes:** Full 9-attribute sets for both hardcoded squads not yet defined. Must be finalised before Phase 5 dice resolution uses attribute values.
- **Referee card behaviour:** Whether Leniency affects anything beyond added time is unconfirmed from rulebook v1.4.1. Hardcode one card for v1; clarify before Phase 8.
- **Pass range distance type:** Rulebook distances (11/6/15 hex) not confirmed as hex-ring distance vs Manhattan. Must be verified before Phase 2 move validator is implemented.
- **ZoI scope:** Whether ZoI blocks movement destinations or only pass/dribble paths is unconfirmed. Must be resolved before Phase 2.

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

### Key Pitfalls to Avoid
- Never generate dice on the client; all rolls use `crypto.randomInt` server-side
- Always return `socket.off(event, handler)` from every `useEffect` that registers a socket listener
- Never use offset hex coordinates; axial only from day one
- Define FSM structure before implementing the second game phase
- Wire disconnect handler in the same commit as room creation (no orphaned rooms)
- Add `isProcessing` mutex before writing any game logic (prevents double-click race)

### Open Questions (resolve before indicated phase)
- Phase 2: Pass range distance type (hex ring vs Manhattan)?
- Phase 2: Does ZoI block movement destinations or only pass/dribble paths?
- Phase 4/7: Are valid moves computed on piece selection or precomputed post-state?
- Phase 5: Full attribute values for both hardcoded squads?
- Phase 6: Flat-top or pointy-top hex orientation?
- Phase 8: Tiebreaker rule at full time, or is a draw valid?
- Phase 8: Does referee card affect anything beyond Leniency/added time?

## Session Continuity

- Last updated: 2026-05-27
- Roadmap created, STATE.md initialised
- Next action: `/gsd-plan-phase 1`
