---
plan: 02-03
phase: 02-move-validator-unit-tests
status: complete
started: 2026-05-29
completed: 2026-05-29
key-files:
  created:
    - packages/shared/src/passValidator.ts
    - packages/shared/src/passValidator.test.ts
  modified: []
self-check: PASSED
---

# Plan 02-03 Summary: Pass Validator

## What Was Built

`validatePass(state, piece, from, to, passType): PassResult` and `validatePassAccuracy(piece, passType, diceValue, penalties): AccuracyResult` — pure functions for pass legality and accuracy resolution.

## PassResult and AccuracyResult Discriminated Unions

```typescript
type PassResult =
  | { ok: false; reason: 'RANGE_EXCEEDED' | 'PATH_BLOCKED' | 'LANDING_RESTRICTED' }
  | { ok: true; interceptors: PlayerPiece[] }
  | { ok: true; interceptors: PlayerPiece[]; effect: { type: 'FIRST_TIME_PLAYER_MOVES' } };

type AccuracyResult = { accurate: true } | { accurate: false; triggerLooseBall: true };
```

## Validator Precedence

1. `distance === 0` → RANGE_EXCEEDED (all types — cannot pass to own hex)
2. Per-type distance cap → RANGE_EXCEEDED (STANDARD ≤11, FIRST_TIME ≤6, HIGH ≤15; LONG: unlimited)
3. STANDARD only: path blocking via `hexLine(from, to).slice(1, -1)` → PATH_BLOCKED (Pitfall 3: slice excludes passer and destination)
4. LONG only: PASS-04 landing constraints:
   - Own-teammate 5-hex exclusion (excluding passer via `id !== piece.id`)
   - Opponent 1-hex adjacency exclusion
   → LANDING_RESTRICTED
5. Interception list via `getZoIDefenders` along `hexLine.slice(1)` travel path, deduped by id (LONG returns `[]`)
6. Success — FIRST_TIME attaches `FIRST_TIME_PLAYER_MOVES` effect

## PASS-04 Landing Constraint Implementation

```typescript
const ownTeammates = state.pieces.filter(p => p.teamId === piece.teamId && p.id !== piece.id);
if (ownTeammates.some(p => hexDistance(to, p.position) <= 5)) return { ok: false, reason: 'LANDING_RESTRICTED' };
const opponents = state.pieces.filter(p => p.teamId !== piece.teamId);
if (opponents.some(p => hexDistance(to, p.position) <= 1)) return { ok: false, reason: 'LANDING_RESTRICTED' };
```

## Attribute Mapping (Assumption A1)

- HIGH accuracy: `piece.aerialAbility` (threshold 8)
- LONG_SAME_THIRD accuracy: `piece.dribbling` (threshold 9)
- LONG_CROSS_THIRD accuracy: `piece.dribbling` (threshold 10)

Documented in JSDoc as assumption A1 — flagged for Phase 4 verification before live use.

## Test Count

15 tests under `describe('validatePass')` + 4 under `describe('validatePassAccuracy')` = 19 total.

PASS-04 dedicated tests: 4 (own-teammate restriction, opponent adjacency, boundary acceptance at 6+≥2, passer self-exclusion).

## index.ts

NOT modified. `export * from './passValidator.js'` was pre-registered in Plan 02-01.

## Commits

- `test(02-03)`: add failing tests for validatePass and validatePassAccuracy (RED)
- `feat(02-03)`: implement validatePass and validatePassAccuracy (GREEN)
