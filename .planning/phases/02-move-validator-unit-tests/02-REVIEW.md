---
phase: 02-move-validator-unit-tests
reviewed: 2026-05-29T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - packages/shared/src/types.ts
  - packages/shared/src/hex.ts
  - packages/shared/src/hex.test.ts
  - packages/shared/src/scoreUtils.ts
  - packages/shared/src/scoreUtils.test.ts
  - packages/shared/src/index.ts
  - packages/shared/src/moveValidator.ts
  - packages/shared/src/moveValidator.test.ts
  - packages/shared/src/passValidator.ts
  - packages/shared/src/passValidator.test.ts
  - packages/shared/src/shotValidator.ts
  - packages/shared/src/shotValidator.test.ts
  - packages/shared/src/headingValidator.ts
  - packages/shared/src/headingValidator.test.ts
  - packages/shared/src/snapshotValidator.ts
  - packages/shared/src/snapshotValidator.test.ts
findings:
  critical: 3
  warning: 4
  info: 3
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the Phase 2 shared package: five validators (`moveValidator`, `passValidator`, `shotValidator`, `headingValidator`, `snapshotValidator`), supporting utilities (`hex`, `scoreUtils`), type definitions, and their accompanying Vitest test suites.

The core data flow — discriminated unions, no throws, injected dice, centralized DICE-04 cap — is correctly structured. The hex geometry primitives (`hexDistance`, `hexLine`, `hexesInRange`) are sound. The most significant defects are a logic error in the STANDARD pass path-blocking rule that admits friendly-fire blocking, an incorrect interception window that captures opponents adjacent to the destination hex rather than confining itself to the flight path, and an uncontested heading result that silently drops the `penaltyModifier` field even when it was computed — making the contested/uncontested branching non-orthogonal with the distance check.

---

## Critical Issues

### CR-01: STANDARD pass PATH_BLOCKED checks only opponents — own-team pieces on intermediate hexes are silently ignored

**File:** `packages/shared/src/passValidator.ts:77-79`

**Issue:** The path-blocking predicate for a STANDARD pass filters `p.teamId !== piece.teamId`, meaning only opponents can block an intermediate hex. A same-team piece occupying an intermediate hex of the path will never trigger `PATH_BLOCKED`. The comment says "only intermediate hexes can block", but omits that friendly blockers must also obstruct the pass per Counter Attack rules (a piece cannot pass through any occupied hex). If the intended rule is "only opponents block", this must be explicitly documented as a deliberate deviation; the current code has no such note and the JSDoc for PASS-01 simply says "blocked by opponents in the path" — but the physical game blocks friendly pieces too. Regardless of the final rule call, the implementation and the rule doc are inconsistent, creating a silent correctness risk.

**Fix:**
```typescript
// If PASS-01 means ALL occupants block (not just opponents):
const blocked = intermediateHexes.some((hex) =>
  state.pieces.some((p) => p.position.q === hex.q && p.position.r === hex.r),
);

// If PASS-01 truly means only opponent-occupied hexes block, add an explicit comment:
// "Per Counter Attack v1.4.1 §Pass: only opposing pieces block standard passes."
```

---

### CR-02: Interception window includes the destination hex — opponents adjacent to the landing point become spurious interceptors

**File:** `packages/shared/src/passValidator.ts:101`

**Issue:** The travel path for interception is computed as `hexLine(from, to).slice(1)`, which retains the destination hex `to`. `getZoIDefenders(to, opponents)` then adds any opponent within distance 1 of `to` to the interceptors list. This means an opponent standing 1 hex away from the receiver's position is flagged as a potential interceptor of a pass that has already landed — a receiver adjacent to an opponent would always generate an interceptor entry, even when the pass was short and the opponent never had a chance to intercept in-flight.

The path-blocking check correctly uses `slice(1, -1)` to exclude the destination. The interception logic should use the same window (flight-path hexes only, excluding `to`).

**Fix:**
```typescript
// Line 101: exclude destination from interception window
const travelPath = hexLine(from, to).slice(1, -1); // exclude passer's hex AND destination

// For a distance-1 pass this produces an empty array (no in-flight hexes), which is
// correct — a 1-hex pass has no intermediate flight path for interception.
```

---

### CR-03: `validateHeading` drops `penaltyModifier` on the uncontested branch — contested/uncontested paths are computed in the wrong order

**File:** `packages/shared/src/headingValidator.ts:77-83`

**Issue:** `penaltyModifier` is computed at line 77 based on `dist` (0 for `dist < 2`, -1 for `dist === 2`). Lines 80-83 then return the uncontested result without including `penaltyModifier`:

```typescript
if (otherIds.length === 0) {
  return { ok: true, contested: false };  // penaltyModifier silently discarded
}
```

Per HEAD-02, uncontested headers are auto-wins and require no dice roll, so the penalty modifier is irrelevant for the duel itself. However, the rule order is also confused: the distance penalty exists independently of whether the header is contested (HEAD-01 applies regardless). The uncontested result type `{ ok: true; contested: false }` carries no penalty — but if Phase 4 introduces any uncontested headed-shot composition, the omitted modifier becomes a silent data loss. The contested branch correctly includes `penaltyModifier`. The asymmetry is a structural defect.

The deeper problem: the guard structure computes `penaltyModifier` before deciding contested/uncontested, but only exposes it in the contested path. If uncontested headers truly need no modifier (auto-win = no dice roll), the guard should be ordered so that `penaltyModifier` is never computed for the uncontested path, making the intent unambiguous. As written, the variable is computed and discarded without comment, which reads as a mistake to future maintainers.

**Fix:**

Option A — move uncontested check before penalty computation (documents that uncontested = no modifier needed):
```typescript
// 2a. HEAD-02: uncontested check first — no modifier needed for auto-wins
const dist = hexDistance(challenger.position, ballPosition);
if (dist > 2) return { ok: false, reason: 'OUT_OF_RANGE' };

const otherIds = options.otherChallengerIds ?? [];
if (otherIds.length === 0) {
  return { ok: true, contested: false };
}

// 2b. Only compute penalty modifier when contested (HEAD-01)
const penaltyModifier = dist === 2 ? -1 : 0;
const excludedPieceIds: string[] = [challenger.id, ...otherIds];
return { ok: true, contested: true, penaltyModifier, excludedPieceIds };
```

Option B — expose modifier on uncontested result too (safer for Phase 4 composition):
```typescript
| { ok: true; contested: false; penaltyModifier: number }
```

---

## Warnings

### WR-01: `validateMove` OCCUPIED check does not exclude the moving piece's own current position — succeeds by coincidence, not intent

**File:** `packages/shared/src/moveValidator.ts:65`

**Issue:** The OCCUPIED guard runs `state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r)` against the entire `state.pieces` array including the moving piece. The moving piece cannot coincidentally occupy `to` when `hexDistance(piece.position, to) === 1` (already enforced above), so no false positive fires today. However, there is no comment explaining this implicit safety, and the guard will silently break if:

1. The OUT_OF_RANGE check is ever relaxed or reordered.
2. A piece's position is mutated externally before the call.

The intent is to block moves into hexes occupied by OTHER pieces. The implementation should be explicit.

**Fix:**
```typescript
if (state.pieces.some((p) => p.id !== piece.id && p.position.q === to.q && p.position.r === to.r)) {
  return { ok: false, reason: 'OCCUPIED' };
}
```

---

### WR-02: `computeCombinedScore` accepts positive values in the `penalties` array — DICE-04 cap silently passes bonus values through unclamped

**File:** `packages/shared/src/scoreUtils.ts:27-36`

**Issue:** The parameter is typed `penalties: number[]` with no enforcement of negativity. If a caller accidentally passes a positive modifier (e.g., `[1]` as a bonus), `totalPenalty` is positive, `Math.max(positive, -2)` returns the positive value, and the "penalty cap" adds a bonus to the score. The DICE-04 cap is meant to bound downside only; the function does not guard against upside injection. A `penalties` array intended for negatives admits anything without a compile-time or runtime check.

**Fix:**
```typescript
// Option A: rename parameter and document intent clearly
penalties: readonly number[], // all values must be <= 0; positive values are treated as zero-penalty

// Option B: add a runtime guard (debug/test mode)
const totalPenalty = Math.min(0, penalties.reduce((sum, p) => sum + p, 0));
// then clamp to -2:
const clampedPenalty = Math.max(totalPenalty, -2);
```

---

### WR-03: `validateHeading` uncontested branch is reachable with `dist === 0` — a piece at the ball's exact hex is a valid uncontested header with zero distance

**File:** `packages/shared/src/headingValidator.ts:73-83`

**Issue:** HEAD-01 specifies challengers at distance 1 or 2. Distance 0 means the piece is at the ball's exact position, which is mechanically valid (the ball is at the piece's feet). There is no guard against `dist === 0`. The validator accepts it silently and, if uncontested, returns `{ ok: true, contested: false }`. If contested, it returns `penaltyModifier: 0` (same as distance 1). This may be intentional — the ball is at the challenger's hex — but it is not documented in the HEAD-01 JSDoc, which only mentions distances 1 and 2. Distance 0 being a valid heading position is an undocumented edge case that could hide a state machine error (e.g., a piece arriving at the ball hex in HEADER phase when it should not).

**Fix:** Add explicit documentation or a rejection guard:
```typescript
// If distance 0 is valid (ball at challenger's feet), document it:
// HEAD-01: distance 0 means piece is at ball hex — treated as distance-1 (no penalty).

// If distance 0 is invalid (ball cannot be at a piece's hex in HEADER phase):
if (dist === 0) return { ok: false, reason: 'OUT_OF_RANGE' };
```

---

### WR-04: `passValidator.ts` STANDARD path-blocking check uses coordinate comparison (`p.position.q === hex.q && p.position.r === hex.r`) inconsistently with the rest of the codebase that uses `hexDistance`

**File:** `packages/shared/src/passValidator.ts:77-79`

**Issue:** The OCCUPIED-equivalent coordinate match in the path-blocking check manually compares `.q` and `.r` fields instead of calling `hexDistance(p.position, hex) === 0`. The `moveValidator` OCCUPIED check uses the same manual comparison (line 65), and `getZoIDefenders` in `hex.ts` uses `hexDistance`. The manual `.q === .q && .r === .r` pattern works correctly for axial coordinates but is inconsistent style — any future refactor of `HexCoord` (e.g., adding a third field, renaming fields) would silently break the manual comparisons while the `hexDistance` variant would continue to work. A `hexEqual` utility (or `hexDistance === 0`) should be used consistently.

**Fix:**
```typescript
// Introduce a helper in hex.ts:
export function hexEqual(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

// Then in passValidator.ts:
const blocked = intermediateHexes.some((hex) =>
  state.pieces.some((p) => p.teamId !== piece.teamId && hexEqual(p.position, hex)),
);
```

---

## Info

### IN-01: `scoreUtils.ts` — `computeLooseBall` does not validate the `direction` and `distance` parameter ranges at runtime despite the literal-union type enforcement

**File:** `packages/shared/src/scoreUtils.ts:69-78`

**Issue:** The parameters `direction: 1 | 2 | 3 | 4 | 5 | 6` and `distance: 1 | 2 | 3 | 4 | 5 | 6` are enforced at compile time via TypeScript literal unions. At runtime (e.g., when called from the server with dice values deserialized over the network), out-of-range values (e.g., 0 or 7) will produce `undefined` for `direction - 1` index access and the `!` non-null assertion on line 76 would return `undefined` at runtime, causing a silent `NaN` result in the coordinate math rather than a clear error. This is acceptable for pure game-logic validators that will always be called with valid dice, but the non-null assertion comment ("Safe by construction") will not hold once the server layer passes real dice values without pre-validation.

**Fix:** Note for Phase 4: add a dice-range validation gate in the server event handler before calling `computeLooseBall`, or add a runtime guard here:
```typescript
if (direction < 1 || direction > 6 || distance < 1 || distance > 6) {
  throw new Error(`computeLooseBall: invalid dice values direction=${direction} distance=${distance}`);
}
```

---

### IN-02: `moveValidator.test.ts` — no test verifies that the ATTACKER_2 "already moved" check is enforced even when `paceUsedByPieceId` is 0 (i.e., the piece was recorded in movedPieceIds before using any pace)

**File:** `packages/shared/src/moveValidator.test.ts:101-110`

**Issue:** The existing ATTACKER_2 test for `ALREADY_MOVED_IN_ATTACKER4` uses `paceUsedByPieceId: {}` (default 0). That combination correctly tests the precedence rule (D-12 before D-11). But there is no test for the inverse: a piece in `movedPieceIds` that has also exhausted its pace. Both conditions being true should still return `ALREADY_MOVED_IN_ATTACKER4` (not `PACE_EXCEEDED`) — the current test suite only covers the case where pace has not been used, so the precedence under combined conditions is unverified.

**Fix:** Add a test:
```typescript
it('ATTACKER_2: ALREADY_MOVED_IN_ATTACKER4 takes precedence even when pace is also exhausted', () => {
  const state: GameState = {
    ...baseState,
    movementSlot: 'ATTACKER_2',
    movedPieceIds: ['p1'],
    paceUsedByPieceId: { p1: 2 }, // pace also exhausted
  };
  const result = validateMove(state, basePiece, { q: 6, r: 5 });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toBe('ALREADY_MOVED_IN_ATTACKER4');
});
```

---

### IN-03: `headingValidator.test.ts` — no test covers the uncontested result when challenger is at distance 2 (penaltyModifier would have been -1 before being discarded)

**File:** `packages/shared/src/headingValidator.test.ts`

**Issue:** The uncontested tests only use `ballAt = { q: 5, r: 5 }` (distance 0 from `basePiece` at `{q: 5, r: 5}`). There is no test for an uncontested challenger at distance 2 where `penaltyModifier` would have been `-1` (but is discarded). This gap means the discarded-modifier defect described in CR-03 has zero test coverage to surface it, and future refactors altering the uncontested return type would not be caught by the test suite.

**Fix:** Add a test:
```typescript
it('returns contested:false (uncontested) at distance 2 — no modifier in result', () => {
  const result = validateHeading(baseState, basePiece, { q: 7, r: 5 }, {
    previousActionWasHeadedPass: false,
    otherChallengerIds: [],
  });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.contested).toBe(false);
});
```

---

_Reviewed: 2026-05-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
