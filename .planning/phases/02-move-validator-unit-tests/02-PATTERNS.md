# Phase 2: Move Validator + Unit Tests - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 14
**Analogs found:** 14 / 14

All new files are pure TypeScript in `packages/shared/src/`. The codebase has two strong analog files —
`hex.ts` and `hex.test.ts` — that establish every pattern this phase needs: import style, docblock
format, pure function shape, discriminated union conventions, and Vitest test structure. All 14 files
map to one of those two analogs.

---

## File Classification

| New/Modified File                               | Role    | Data Flow | Closest Analog                    | Match Quality |
| ----------------------------------------------- | ------- | --------- | --------------------------------- | ------------- |
| `packages/shared/src/types.ts`                  | model   | —         | self (extend in place)            | exact         |
| `packages/shared/src/hex.ts`                    | utility | transform | self (extend in place)            | exact         |
| `packages/shared/src/hex.test.ts`               | test    | —         | self (extend in place)            | exact         |
| `packages/shared/src/moveValidator.ts`          | utility | transform | `packages/shared/src/hex.ts`      | role-match    |
| `packages/shared/src/moveValidator.test.ts`     | test    | —         | `packages/shared/src/hex.test.ts` | exact         |
| `packages/shared/src/passValidator.ts`          | utility | transform | `packages/shared/src/hex.ts`      | role-match    |
| `packages/shared/src/passValidator.test.ts`     | test    | —         | `packages/shared/src/hex.test.ts` | exact         |
| `packages/shared/src/shotValidator.ts`          | utility | transform | `packages/shared/src/hex.ts`      | role-match    |
| `packages/shared/src/shotValidator.test.ts`     | test    | —         | `packages/shared/src/hex.test.ts` | exact         |
| `packages/shared/src/headingValidator.ts`       | utility | transform | `packages/shared/src/hex.ts`      | role-match    |
| `packages/shared/src/headingValidator.test.ts`  | test    | —         | `packages/shared/src/hex.test.ts` | exact         |
| `packages/shared/src/snapshotValidator.ts`      | utility | transform | `packages/shared/src/hex.ts`      | role-match    |
| `packages/shared/src/snapshotValidator.test.ts` | test    | —         | `packages/shared/src/hex.test.ts` | exact         |
| `packages/shared/src/scoreUtils.ts`             | utility | transform | `packages/shared/src/hex.ts`      | role-match    |
| `packages/shared/src/index.ts`                  | config  | —         | self (extend in place)            | exact         |

---

## Pattern Assignments

### `packages/shared/src/types.ts` (model — extend in place)

**Analog:** `packages/shared/src/types.ts` (itself)

**Existing GameState shape** (lines 37–47):

```typescript
export type GameState = {
  roomCode: string;
  phase: GamePhase;
  activeTeam: 'home' | 'away';
  pieces: readonly PlayerPiece[];
  ball: BallState;
  score: { home: number; away: number };
  actionCount: number;
  half: 1 | 2;
  eventLog: readonly unknown[];
};
```

**Extension to add (D-08) — append to GameState, required fields with `| null` not `?:`:**

```typescript
// Movement phase tracking — D-08
// Default values when outside MOVEMENT phase: [], {}, null
movedPieceIds: readonly string[];
paceUsedByPieceId: Readonly<Record<string, number>>;
movementSlot: 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2' | null;
```

**Key constraint (RESEARCH.md Pitfall 2):** `exactOptionalPropertyTypes` is enabled in
`tsconfig.base.json` (line 6). Use required fields with `| null`, never optional `?:`.
`noUncheckedIndexedAccess` (line 5) means `paceUsedByPieceId[id]` has type `number | undefined`
at every call site — callers must use `?? 0`.

---

### `packages/shared/src/hex.ts` (utility — extend in place)

**Analog:** `packages/shared/src/hex.ts` (itself)

**Existing import pattern** (line 1):

```typescript
import type { HexCoord } from './types.js';
```

**Existing docblock + constant pattern** (lines 3–12):

```typescript
// Axial direction vectors for the 6 hex neighbors (E, NE, NW, W, SW, SE)
// Source: redblobgames.com/grids/hexagons/
const AXIAL_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 }, // E
  { q: 1, r: -1 }, // NE
  { q: 0, r: -1 }, // NW
  { q: -1, r: 0 }, // W
  { q: -1, r: 1 }, // SW
  { q: 0, r: 1 }, // SE
];
```

**Existing function docblock + signature pattern** (lines 14–21):

```typescript
/**
 * Returns the axial distance between two hex coordinates.
 * Formula: (|dq| + |dq+dr| + |dr|) / 2
 * Source: redblobgames.com/grids/hexagons/
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}
```

**Two functions to add — follow the same docblock + `export function` pattern:**

`hexLine` (D-02) — add after `hexesInRange`:

```typescript
/**
 * Returns all hex coordinates along the straight line from `from` to `to` (inclusive).
 * Uses cube-coordinate linear interpolation + cube_round.
 * Source: redblobgames.com/grids/hexagons/#line-drawing
 */
export function hexLine(from: HexCoord, to: HexCoord): HexCoord[] {
  const n = hexDistance(from, to);
  if (n === 0) return [from];
  const results: HexCoord[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const fq = from.q + (to.q - from.q) * t;
    const fr = from.r + (to.r - from.r) * t;
    const fs = -fq - fr;
    let rq = Math.round(fq);
    let rr = Math.round(fr);
    let rs = Math.round(fs);
    const dq = Math.abs(rq - fq);
    const dr = Math.abs(rr - fr);
    const ds = Math.abs(rs - fs);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    results.push({ q: rq, r: rr });
  }
  return results;
}
```

`getZoIDefenders` (D-03, ZoI factoring) — requires `PlayerPiece` import; add after `isUnderZoI`:

```typescript
/**
 * Returns all opponent pieces adjacent (distance 1) to `position`.
 * Used by move and pass validators to populate consequence data (D-04, D-05).
 */
export function getZoIDefenders(
  position: HexCoord,
  opponentPieces: readonly PlayerPiece[],
): PlayerPiece[] {
  return opponentPieces.filter((p) => hexDistance(position, p.position) === 1);
}
```

**Import update required — add `PlayerPiece` to the existing import on line 1:**

```typescript
import type { HexCoord, PlayerPiece } from './types.js';
```

---

### `packages/shared/src/hex.test.ts` (test — extend in place)

**Analog:** `packages/shared/src/hex.test.ts` (itself)

**Existing import block** (lines 1–3):

```typescript
import { describe, it, expect } from 'vitest';
import { hexDistance, hexNeighbors, hexesInRange, isUnderZoI } from './hex.js';
import type { HexCoord } from './types.js';
```

**Existing describe/it/expect structure** (lines 5–22):

```typescript
describe('hexDistance', () => {
  it('returns 0 for the same hex', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
  });

  it('returns 3 for {q:0,r:0} to {q:3,r:0}', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
  });
  // ...
});
```

**New describe blocks to add** — extend the import line to include `hexLine` and `getZoIDefenders`,
then append new `describe` blocks following the same pattern:

```typescript
describe('hexLine', () => {
  it('returns [from] when from === to', () => { ... });
  it('returns 4 hexes for distance-3 line (includes both endpoints)', () => { ... });
  it('produces correct straight-line path along q-axis', () => { ... });
  it('produces correct diagonal path', () => { ... });
});

describe('getZoIDefenders', () => {
  it('returns pieces at distance 1', () => { ... });
  it('excludes pieces at distance 2', () => { ... });
  it('returns empty array when no adjacent opponents', () => { ... });
});
```

---

### `packages/shared/src/moveValidator.ts` (utility, transform)

**Analog:** `packages/shared/src/hex.ts` (lines 1–55)

**Import pattern to copy — use `import type` for type-only, `.js` extensions (verbatimModuleSyntax):**

```typescript
import type { GameState, PlayerPiece, HexCoord } from './types.js';
import { hexDistance, getZoIDefenders } from './hex.js';
```

**Discriminated union return type pattern (D-04):**

```typescript
export type MoveResult =
  | {
      ok: false;
      reason:
        | 'OUT_OF_RANGE'
        | 'OCCUPIED'
        | 'PACE_EXCEEDED'
        | 'WRONG_SLOT'
        | 'ALREADY_MOVED_IN_ATTACKER4';
    }
  | { ok: true }
  | { ok: true; effect: { type: 'STEAL_ATTEMPT'; defenders: PlayerPiece[] } }
  | { ok: true; effect: { type: 'SNAPSHOT_AVAILABLE' } };
```

**Core function pattern** — pure function, no throws, all branches return a `MoveResult`:

```typescript
export function validateMove(state: GameState, piece: PlayerPiece, to: HexCoord): MoveResult {
  // Guard: movementSlot must be active
  if (state.movementSlot === null) return { ok: false, reason: 'WRONG_SLOT' };

  // Single-step constraint (D-10)
  if (hexDistance(piece.position, to) !== 1) return { ok: false, reason: 'OUT_OF_RANGE' };

  // Occupancy (MOVE-03)
  const occupied = state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r);
  if (occupied) return { ok: false, reason: 'OCCUPIED' };

  // ATTACKER_2 restrictions (D-11, D-12)
  if (state.movementSlot === 'ATTACKER_2') {
    if (state.movedPieceIds.includes(piece.id)) {
      return { ok: false, reason: 'ALREADY_MOVED_IN_ATTACKER4' };
    }
    const paceUsed = state.paceUsedByPieceId[piece.id] ?? 0; // noUncheckedIndexedAccess
    if (paceUsed + 1 > 2) return { ok: false, reason: 'PACE_EXCEEDED' };
  } else {
    const paceUsed = state.paceUsedByPieceId[piece.id] ?? 0;
    if (paceUsed + 1 > piece.pace) return { ok: false, reason: 'PACE_EXCEEDED' };
  }

  // ZoI steal (MOVE-04) — ball-carrier only (D-03)
  if (state.ball.carrierId === piece.id) {
    const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId);
    const defenders = getZoIDefenders(to, opponents);
    if (defenders.length > 0) {
      return { ok: true, effect: { type: 'STEAL_ATTEMPT', defenders } };
    }
  }

  return { ok: true };
}
```

---

### `packages/shared/src/moveValidator.test.ts` (test)

**Analog:** `packages/shared/src/hex.test.ts` (lines 1–76)

**Import block pattern:**

```typescript
import { describe, it, expect } from 'vitest';
import { validateMove } from './moveValidator.js';
import type { GameState, PlayerPiece } from './types.js';
```

**Minimal GameState fixture pattern** — construct only the fields each test exercises; TypeScript
enforces completeness. Include D-08 fields with their "outside MOVEMENT" defaults:

```typescript
const baseState: GameState = {
  roomCode: 'TEST',
  phase: 'MOVEMENT',
  activeTeam: 'home',
  pieces: [],
  ball: { position: { q: 0, r: 0 }, carrierId: null },
  score: { home: 0, away: 0 },
  actionCount: 0,
  half: 1,
  eventLog: [],
  movedPieceIds: [],
  paceUsedByPieceId: {},
  movementSlot: 'ATTACKER_4',
};
```

**Discriminated union assertion pattern** (from RESEARCH.md Code Examples):

```typescript
describe('validateMove', () => {
  it('rejects move to occupied hex', () => {
    const result = validateMove(state, piece, to);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('OCCUPIED');
    }
  });

  it('returns STEAL_ATTEMPT effect when ball-carrier enters ZoI', () => {
    const result = validateMove(state, ballCarrier, adjacentToDefender);
    expect(result.ok).toBe(true);
    if (result.ok && 'effect' in result) {
      expect(result.effect.type).toBe('STEAL_ATTEMPT');
      expect(result.effect.defenders).toHaveLength(1);
    }
  });
});
```

---

### `packages/shared/src/passValidator.ts` (utility, transform)

**Analog:** `packages/shared/src/hex.ts` (lines 1–55)

**Import block pattern:**

```typescript
import type { GameState, PlayerPiece, HexCoord } from './types.js';
import { hexDistance, hexLine, getZoIDefenders } from './hex.js';
import { computeCombinedScore } from './scoreUtils.js';
```

**Discriminated union return types:**

```typescript
export type PassResult =
  | { ok: false; reason: 'RANGE_EXCEEDED' | 'PATH_BLOCKED' | 'WRONG_PHASE' }
  | { ok: true; interceptors: PlayerPiece[] }
  | { ok: true; interceptors: PlayerPiece[]; effect: { type: 'FIRST_TIME_PLAYER_MOVES' } };

export type AccuracyResult = { accurate: true } | { accurate: false; triggerLooseBall: true };
```

**Path blocking pattern (PASS-01, RESEARCH.md Pitfall 3):**

```typescript
// slice(1, -1): skip passer's own hex and destination — check only travel-through hexes
const path = hexLine(from, to).slice(1, -1);
const blocked = path.some((hex) =>
  state.pieces.some((p) => p.position.q === hex.q && p.position.r === hex.r),
);
if (blocked) return { ok: false, reason: 'PATH_BLOCKED' };
```

**Interception list pattern (D-05):**

```typescript
// Any defender within 1 hex of any path hex (including destination)
const travelPath = hexLine(from, to).slice(1);
const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId);
const interceptors: PlayerPiece[] = [];
for (const hex of travelPath) {
  for (const defender of getZoIDefenders(hex, opponents)) {
    if (!interceptors.some((d) => d.id === defender.id)) {
      interceptors.push(defender);
    }
  }
}
return { ok: true, interceptors };
```

**Dice-injected accuracy signature (Claude's Discretion, RESEARCH.md Pattern 3):**

```typescript
export function validatePassAccuracy(
  piece: PlayerPiece,
  passType: 'HIGH' | 'LONG_SAME_THIRD' | 'LONG_CROSS_THIRD',
  diceValue: number,
  penalties: number[],
): AccuracyResult {
  const threshold = passType === 'HIGH' ? 8 : passType === 'LONG_SAME_THIRD' ? 9 : 10;
  const attribute = passType === 'HIGH' ? piece.aerialAbility : piece.dribbling; // A1: assumption
  const score = computeCombinedScore(attribute, diceValue, penalties);
  return score >= threshold ? { accurate: true } : { accurate: false, triggerLooseBall: true };
}
```

---

### `packages/shared/src/passValidator.test.ts` (test)

**Analog:** `packages/shared/src/hex.test.ts` (lines 1–76)

Same Vitest import pattern and `describe`/`it`/`expect` structure. Fixture pattern same as
`moveValidator.test.ts` — minimal `GameState` with all required fields including D-08 defaults.

---

### `packages/shared/src/shotValidator.ts` (utility, transform)

**Analog:** `packages/shared/src/hex.ts` (lines 1–55)

**Import block pattern:**

```typescript
import type { PlayerPiece, HexCoord } from './types.js';
import { hexDistance } from './hex.js';
import { computeCombinedScore } from './scoreUtils.js';
```

**Note:** `shotValidator.ts` does not take `GameState` as a primary argument — it takes individual
piece params + injected dice values. No hex utility beyond `hexDistance` for `validateGKDive`.

**Return types:**

```typescript
export type ShotDuelResult =
  | { outcome: 'GOAL' }
  | { outcome: 'MISS'; reason: 'AUTO_MISS' }
  | { outcome: 'SAVE'; needsHandlingCheck: true };

export type DiveResult =
  | { saveable: true; savingPenalty: number }
  | { saveable: false; reason: 'OUT_OF_RANGE' };

export type HandlingResult = { caught: true } | { caught: false; triggerLooseBall: true };
```

**Auto-miss guard pattern (SHOT-03) — check before attribute calculation:**

```typescript
export function validateShotDuel(
  shooter: PlayerPiece,
  goalkeeper: PlayerPiece,
  shooterDice: number,
  gkDice: number,
  shooterPenalties: number[],
  gkPenalties: number[],
): ShotDuelResult {
  if (shooterDice === 1) return { outcome: 'MISS', reason: 'AUTO_MISS' };
  const shooterScore = computeCombinedScore(shooter.shooting, shooterDice, shooterPenalties);
  const gkScore = computeCombinedScore(goalkeeper.saving, gkDice, gkPenalties);
  if (shooterScore > gkScore) return { outcome: 'GOAL' };
  return { outcome: 'SAVE', needsHandlingCheck: true };
}
```

**GK dive mechanics (SHOT-04) — distance-based penalty, no boundary check in Phase 2:**

```typescript
export function validateGKDive(_gk: PlayerPiece, distance: number): DiveResult {
  if (distance > 3) return { saveable: false, reason: 'OUT_OF_RANGE' };
  const savingPenalty = distance === 3 ? -1 : 0;
  return { saveable: true, savingPenalty };
}
```

**Handling check (SHOT-06):**

```typescript
export function validateHandlingCheck(gk: PlayerPiece, diceValue: number): HandlingResult {
  if (diceValue >= gk.handling) return { caught: false, triggerLooseBall: true };
  return { caught: true };
}
```

---

### `packages/shared/src/shotValidator.test.ts` (test)

**Analog:** `packages/shared/src/hex.test.ts` (lines 1–76)

Same Vitest structure. No `GameState` fixture needed — tests construct `PlayerPiece` objects
directly and inject numeric dice values. `PlayerPiece` fixture pattern:

```typescript
const shooter: PlayerPiece = {
  id: 'p1',
  teamId: 'home',
  position: { q: 5, r: 5 },
  pace: 4,
  shooting: 7,
  tackling: 5,
  dribbling: 5,
  heading: 5,
  saving: 1,
  handling: 1,
  resilience: 5,
  aerialAbility: 5,
};
```

---

### `packages/shared/src/headingValidator.ts` (utility, transform)

**Analog:** `packages/shared/src/hex.ts` (lines 1–55)

**Import block pattern:**

```typescript
import type { GameState, PlayerPiece, HexCoord } from './types.js';
import { hexDistance } from './hex.js';
```

**Return type:**

```typescript
export type HeadingResult =
  | { ok: false; reason: 'OUT_OF_RANGE' | 'CONSECUTIVE_HEADER' }
  | { ok: true; contested: false }
  | { ok: true; contested: true; penaltyModifier: number; excludedPieceIds: string[] };
```

**Consecutive header restriction (HEAD-04) — reads `state` for last action context:**

```typescript
// HEAD-04: two consecutive headed passes not allowed
// The state must carry last-action metadata; check deferred to Phase 4 FSM
// but the validator accepts it as a parameter to remain pure and testable.
```

**Distance-based penalty (HEAD-01):**

```typescript
const dist = hexDistance(challenger.position, ballPosition);
if (dist > 2) return { ok: false, reason: 'OUT_OF_RANGE' };
const penaltyModifier = dist === 2 ? -1 : 0;
```

---

### `packages/shared/src/headingValidator.test.ts` (test)

**Analog:** `packages/shared/src/hex.test.ts` (lines 1–76)

Same Vitest structure. Tests inject `HexCoord` positions directly for distance checks; minimal
`GameState` for consecutive-header test.

---

### `packages/shared/src/snapshotValidator.ts` (utility, transform)

**Analog:** `packages/shared/src/hex.ts` (lines 1–55)

**Import block pattern:**

```typescript
import type { GameState, PlayerPiece } from './types.js';
```

**Return type:**

```typescript
export type SnapshotResult =
  | { ok: false; reason: 'NOT_AVAILABLE' | 'WRONG_PHASE' }
  | { ok: true; shootingPenalty: -1; deflectionEffect: { type: 'OPPONENT_MOVES'; maxHexes: 2 } };
```

**Phase check pattern (SNAP-01) — checks `state.phase` to determine trigger context:**

```typescript
export function validateSnapshot(state: GameState, _piece: PlayerPiece): SnapshotResult {
  if (state.phase !== 'MOVEMENT' && state.phase !== 'PASS' && state.phase !== 'SNAPSHOT') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  // SNAP-02: always -1 shooting penalty when snapshot is available
  return {
    ok: true,
    shootingPenalty: -1,
    deflectionEffect: { type: 'OPPONENT_MOVES', maxHexes: 2 },
  };
}
```

---

### `packages/shared/src/snapshotValidator.test.ts` (test)

**Analog:** `packages/shared/src/hex.test.ts` (lines 1–76)

Same Vitest structure. Minimal `GameState` fixture with `phase` field varied per test.

---

### `packages/shared/src/scoreUtils.ts` (utility, transform)

**Analog:** `packages/shared/src/hex.ts` (lines 14–21) — single exported pure function with JSDoc.

**Import block:** none (no project imports needed — pure arithmetic).

**Full implementation pattern (DICE-03, DICE-04):**

```typescript
/**
 * Computes the combined score: attribute + dice + sum of penalties.
 * Penalties are clamped to a maximum of -2 (DICE-04).
 * Source: Counter Attack rulebook §Dice Resolution
 */
export function computeCombinedScore(
  attribute: number,
  diceValue: number,
  penalties: number[],
): number {
  const totalPenalty = penalties.reduce((sum, p) => sum + p, 0);
  const clampedPenalty = Math.max(totalPenalty, -2); // DICE-04: max -2 cap
  return attribute + diceValue + clampedPenalty;
}
```

**Companion `computeLooseBall` — same file or separate; place in `scoreUtils.ts` for Phase 2:**

```typescript
// Direction mapping: dice 1=E, 2=NE, 3=NW, 4=W, 5=SW, 6=SE
// Source: Counter Attack rulebook v1.4.1 deflection ruler
// NOTE: Mapping needs physical rulebook verification before Phase 4 live use (A2).
const LOOSE_BALL_DIRECTIONS: readonly { q: number; r: number }[] = [
  { q: 1, r: 0 }, // 1 = E
  { q: 1, r: -1 }, // 2 = NE
  { q: 0, r: -1 }, // 3 = NW
  { q: -1, r: 0 }, // 4 = W
  { q: -1, r: 1 }, // 5 = SW
  { q: 0, r: 1 }, // 6 = SE
];

export function computeLooseBall(
  from: HexCoord,
  direction: 1 | 2 | 3 | 4 | 5 | 6,
  distance: 1 | 2 | 3 | 4 | 5 | 6,
): HexCoord {
  const dir = LOOSE_BALL_DIRECTIONS[direction - 1]!; // non-null: 1-6 maps to 0-5
  return { q: from.q + dir.q * distance, r: from.r + dir.r * distance };
}
```

---

### `packages/shared/src/index.ts` (config — extend in place)

**Analog:** `packages/shared/src/index.ts` (itself, lines 1–6)

**Existing pattern** (lines 1–6):

```typescript
// Single barrel export for @counter-attack/shared (D-05).
// All consumers import from '@counter-attack/shared' — no sub-path imports.
export * from './types.js';
export * from './hex.js';
export * from './events.js';
export * from './pitch.js';
```

**Lines to append — one `export *` per new module, same `.js` extension convention:**

```typescript
export * from './moveValidator.js';
export * from './passValidator.js';
export * from './shotValidator.js';
export * from './headingValidator.js';
export * from './snapshotValidator.js';
export * from './scoreUtils.js';
```

---

## Shared Patterns

### Import style

**Source:** Every file in `packages/shared/src/` (e.g., `hex.ts` line 1, `events.ts` line 1)
**Apply to:** All new `.ts` files

- `verbatimModuleSyntax` is enabled (`tsconfig.base.json` line 8). Use `import type { ... }` for
  type-only imports; `import { ... }` for value imports.
- All intra-package imports use the `.js` extension (TypeScript emits ESM; the extension is required
  at the source level even though the file is `.ts`).

```typescript
import type { HexCoord, PlayerPiece, GameState } from './types.js';
import { hexDistance, hexLine, getZoIDefenders } from './hex.js';
import { computeCombinedScore } from './scoreUtils.js';
```

### JSDoc docblock

**Source:** `packages/shared/src/hex.ts` lines 14–21
**Apply to:** All exported functions in new validator files

```typescript
/**
 * One-line summary of what the function computes/validates.
 * Include parameter semantics, return type semantics, and rule reference if applicable.
 * Source: [rulebook section or URL if algorithm is from external source]
 */
export function functionName(...): ReturnType {
```

### Source comment for external algorithms

**Source:** `packages/shared/src/hex.ts` line 4, `pitch.ts` lines 3–10
**Apply to:** `hexLine` (redblobgames.com), `LOOSE_BALL_DIRECTIONS` (rulebook v1.4.1)

```typescript
// Source: redblobgames.com/grids/hexagons/#line-drawing
// Source: Counter Attack rulebook v1.4.1 deflection ruler
```

### noUncheckedIndexedAccess guard

**Source:** RESEARCH.md Pitfall 1 (verified against `tsconfig.base.json` line 5)
**Apply to:** Every access of `state.paceUsedByPieceId[pieceId]` in `moveValidator.ts`

```typescript
const paceUsed = state.paceUsedByPieceId[piece.id] ?? 0;
```

### No-throw validation

**Source:** RESEARCH.md Anti-Patterns, D-04 decision
**Apply to:** All validator functions

Return discriminated union results. Never `throw` on invalid input. The Phase 4 FSM switches on
result types to drive state transitions; exceptions would bypass that logic.

### Vitest test structure

**Source:** `packages/shared/src/hex.test.ts` lines 1–76
**Apply to:** All `*.test.ts` files

```typescript
import { describe, it, expect } from 'vitest';
import { functionUnderTest } from './module.js';
import type { TypeUsedInFixture } from './types.js';

describe('functionUnderTest', () => {
  it('describes the specific behaviour being verified', () => {
    // arrange
    const input = ...;
    // act
    const result = functionUnderTest(input);
    // assert
    expect(result).toBe(...);
  });
});
```

---

## No Analog Found

None. All 14 files have clear analogs within `packages/shared/src/`.

---

## Metadata

**Analog search scope:** `packages/shared/src/`
**Files scanned:** `hex.ts`, `hex.test.ts`, `types.ts`, `index.ts`, `events.ts`, `pitch.ts`,
`vitest.config.ts`, `tsconfig.base.json`
**Pattern extraction date:** 2026-05-29
