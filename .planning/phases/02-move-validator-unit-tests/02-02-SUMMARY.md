---
plan: 02-02
phase: 02-move-validator-unit-tests
status: complete
started: 2026-05-29
completed: 2026-05-29
key-files:
  created:
    - packages/shared/src/moveValidator.ts
    - packages/shared/src/moveValidator.test.ts
  modified: []
self-check: PASSED
---

# Plan 02-02 Summary: Movement Validator

## What Was Built

`validateMove(state, piece, to): MoveResult` — a pure function enforcing Movement Phase rules.

## MoveResult Discriminated Union

```typescript
type MoveResult =
  | { ok: false; reason: 'WRONG_SLOT' | 'OUT_OF_RANGE' | 'OCCUPIED' | 'PACE_EXCEEDED' | 'ALREADY_MOVED_IN_ATTACKER4' }
  | { ok: true }
  | { ok: true; effect: { type: 'STEAL_ATTEMPT'; defenders: PlayerPiece[] } }
  | { ok: true; effect: { type: 'SNAPSHOT_AVAILABLE' } }
```

## Validator Guard Precedence

1. `WRONG_SLOT` — `state.movementSlot === null` (checked first, before geometry)
2. `OUT_OF_RANGE` — `hexDistance(piece.position, to) !== 1` (D-10 single-step)
3. `OCCUPIED` — any piece occupies destination (MOVE-03)
4. `ALREADY_MOVED_IN_ATTACKER4` — piece in `movedPieceIds` during ATTACKER_2 slot (D-12, checked before pace)
5. `PACE_EXCEEDED` — cumulative pace + 1 exceeds cap (flat 2 for ATTACKER_2; `piece.pace` for others, D-11)
6. `STEAL_ATTEMPT` effect — ball-carrier moving into ZoI of opponents (MOVE-04/MOVE-05, D-03)

## MOVE-06 Deferral

MOVE-06 (free 6-hex move) is documented in source with a comment:
```
// MOVE-06: deferred to Phase 4 — requires pitch region encoding (CONTEXT.md Deferred Ideas)
```

## MOVE-07 Handling

MOVE-07 (snapshot availability): Phase 2 returns plain `{ ok: true }` when no STEAL_ATTEMPT applies. Documented in JSDoc that Phase 4 FSM will gate `SNAPSHOT_AVAILABLE` on penalty-area membership once pitch regions exist.

## Test Count

12 tests under `describe('validateMove')` — all passing.

Covers: all 5 reject reasons, all slot types (ATTACKER_4/DEFENDER_5/ATTACKER_2), STEAL_ATTEMPT trigger, non-ball-carrier isolation, guard precedence (WRONG_SLOT before OUT_OF_RANGE, ALREADY_MOVED before PACE_EXCEEDED).

## index.ts

NOT modified by this plan. The `export * from './moveValidator.js';` line was pre-registered in Plan 02-01 Task 2 (Wave 1 pre-registration).

## Commits

- `test(02-02)`: add failing tests for validateMove (RED)
- `feat(02-02)`: implement validateMove with MoveResult discriminated union (GREEN)
