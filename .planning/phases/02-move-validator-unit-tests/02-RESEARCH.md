# Phase 2: Move Validator + Unit Tests - Research

**Researched:** 2026-05-29
**Domain:** Pure TypeScript game-rule validation functions + Vitest unit testing
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Pass range checks use `hexDistance(from, to)`. PASS-01: Standard Pass ≤11; PASS-02: First-time Pass ≤6; PASS-03: High Pass ≤15; PASS-04: Long Pass = any position.
- **D-02:** `hexLine(from, to): HexCoord[]` added to `hex.ts`. Used by PASS-01 path blocking and interception checks. Algorithm: redblobgames.com hex line drawing (cube-coord lerp + round).
- **D-03:** ZoI applies in two contexts: (a) ball-carrier movement — steal attempt when ball-carrier enters adjacent defender hex; (b) pass travel path — any defender within 1 hex of any path hex may intercept. Outfield players without ball move freely.
- **D-04:** All validators return typed discriminated union results carrying consequence data. Shape: `{ ok: true } | { ok: false, reason: '...' } | { ok: true, effect: { type: 'STEAL_ATTEMPT', defenders: PlayerPiece[] } }`.
- **D-05:** `validatePass()` returns list of all defenders within 1 hex of any path hex. Interception is possible, not automatic.
- **D-06:** `computeLooseBall(from, direction, distance)` receives dice values as parameters, returns raw destination HexCoord with no boundary check.
- **D-07:** Loose Ball direction mapping hard-coded per Counter Attack rulebook v1.4.1 deflection ruler: dice 1=E, 2=NE, 3=NW, 4=W, 5=SW, 6=SE.
- **D-08:** `GameState` extended with: `movedPieceIds: readonly string[]`, `paceUsedByPieceId: Readonly<Record<string, number>>`, `movementSlot: 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2' | null`.
- **D-09:** Separate files per domain, each with co-located `*.test.ts`: `moveValidator.ts`, `passValidator.ts`, `shotValidator.ts`, `headingValidator.ts`, `snapshotValidator.ts`. Shared ZoI logic in `hex.ts` or thin `zoiValidator.ts`.
- **D-10:** `validateMove()` is single-step — called once per hex step, not jump-to-destination. `paceUsedByPieceId[pieceId]` accumulates across steps.
- **D-11:** ATTACKER_2 slot: flat 2-hex cap (overrides Pace). ATTACKER_4 and DEFENDER_5: cap by `piece.pace`.
- **D-12:** ATTACKER_2 pieces must NOT appear in `movedPieceIds`. `validateMove()` enforces this.

### Claude's Discretion

- **Dice injection pattern:** Accept dice values as direct numeric parameters so functions are deterministic and fully unit-testable. Recommended shape: `validatePassAccuracy(piece, diceValue, penalties): AccuracyResult`. Verify this fits all resolution types.
- **Combined score utility (DICE-03):** `computeCombinedScore(attribute, diceValue, penalties): number` enforcing DICE-04 max -2 penalty cap. Claude decides placement.
- **ZoI utility factoring:** Whether to extend `isUnderZoI()` in-place, add `getZoIDefenders()` variant, or put adjacency logic in each validator. Keep DRY without over-abstracting.

### Deferred Ideas (OUT OF SCOPE)

- Boundary checking for Loose Ball (deferred to Phase 4 when real PITCH_HEXES available)
- GK dive boundary/goal-line validation for SHOT-04 (deferred to Phase 4)
- Free 6-hex move after final-third action MOVE-06 (requires pitch region encoding, deferred to Phase 4)
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                     | Research Support                                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MOVE-01 | 4-5-2 movement sequence: attacker moves 4 → defender 5 → attacker 2 new players                 | D-08 `movementSlot` field tracks current sub-phase; `validateMove()` reads it                                                                            |
| MOVE-02 | Pace attribute caps total hex movement per Movement Phase                                       | D-10/D-11: `paceUsedByPieceId` accumulates; allowed pace = `piece.pace` (ATTACKER_4/DEFENDER_5) or `2` (ATTACKER_2)                                      |
| MOVE-03 | Cannot move through or end on occupied hex                                                      | `validateMove()` checks destination not in `state.pieces.map(p => p.position)`                                                                           |
| MOVE-04 | Ball-carrier entering defender's ZoI triggers steal attempt                                     | `validateMove()` returns `{ ok: true, effect: { type: 'STEAL_ATTEMPT', defenders } }` when ball-carrier lands adjacent to opponent                       |
| MOVE-05 | Successful steal ends Movement Phase, transfers possession                                      | Consequence data from MOVE-04 effect; FSM (Phase 4) drives state transition — validator just flags the trigger                                           |
| MOVE-06 | Free 6-hex move after action in opposite final third                                            | DEFERRED to Phase 4 (pitch regions not available)                                                                                                        |
| MOVE-07 | Snapshot opportunity when ball in penalty area during movement                                  | `validateMove()` signals `SNAPSHOT_AVAILABLE` effect when ball-carrier position is in penalty area; boundary deferred to Phase 4                         |
| PASS-01 | Standard Pass ≤11 hexes; cannot pass through opponent hex; interception checks                  | `validatePass()` with `hexLine()` for path; defenders within 1 hex of path returned                                                                      |
| PASS-02 | First-time Pass ≤6 hexes; each team moves 1 player 1 hex during flight                          | `validatePass()` result includes `effect: { type: 'FIRST_TIME_PLAYER_MOVES' }` to signal Phase 4                                                         |
| PASS-03 | High Pass ≤15 hexes; accuracy check (attribute + dice ≥ 8); flight moves 1 player up to 3 hexes | `validatePassAccuracy(piece, diceValue, penalties)` with threshold 8; flight effect signalled                                                            |
| PASS-04 | Long Pass any position; accuracy check (9+ same third, 10+ across thirds); landing constraints  | `validatePassAccuracy()` with threshold param; threshold value is Claude's responsibility                                                                |
| PASS-05 | Inaccurate pass triggers Loose Ball                                                             | `validatePassAccuracy()` returns `{ accurate: false }` → caller invokes `computeLooseBall()`                                                             |
| HEAD-01 | Header follows High Pass; ≤1 hex = normal; ≤2 hexes = -1 dice penalty                           | `validateHeading()` checks challenger distance from ball; returns penalty modifier                                                                       |
| HEAD-02 | Uncontested header won automatically                                                            | `validateHeading()` returns `{ contested: false }` when no opponent in range                                                                             |
| HEAD-03 | Headed attempt at goal declared before rolling; GK saves; outfield cannot block                 | `validateHeadedShot()` flag — shot declared, returns `needsGKSave: true`                                                                                 |
| HEAD-04 | Headed pass cannot be intercepted; two consecutive headed passes not allowed                    | `validateHeading()` checks `state.lastAction` for consecutive header restriction                                                                         |
| HEAD-05 | Heading challengers excluded from subsequent Movement Phase                                     | `validateHeading()` returns `{ excludedPieceIds: string[] }` for Phase 4 FSM                                                                             |
| SNAP-01 | Snapshot during movement if ball in penalty area; or immediately after any pass                 | `validateSnapshot()` checks `state.phase === 'MOVEMENT'` + ball in penalty area, or `state.phase === 'PASS'` — penalty area boundary deferred to Phase 4 |
| SNAP-02 | Snapshot: -1 Shooting dice penalty; 1 opponent moves up to 2 hexes for deflection               | `validateSnapshot()` includes `shootingPenalty: -1` in result; deflection effect signalled                                                               |
| SNAP-03 | All standard shooting rules apply to snapshots                                                  | `validateShot()` reused by snapshot flow                                                                                                                 |
| SHOT-01 | Shooter rolls Shooting+dice vs GK Saving+dice; higher = goal                                    | `validateShotDuel(shooter, gk, shooterDice, gkDice, penalties): ShotDuelResult`                                                                          |
| SHOT-02 | Outside penalty area: -1 dice penalty; GK moves 1 hex before saving                             | `validateShot()` checks whether shooter position is outside penalty area (deferred boundary); returns `outsideAreaPenalty: -1` and `gkMayMove: true`     |
| SHOT-03 | Rolling 1 on shot = automatic miss                                                              | `validateShotDuel()` checks `shooterDice === 1 → { miss: true, reason: 'AUTO_MISS' }` before attribute calculation                                       |
| SHOT-04 | GK dives ≤3 hexes along goal line; 3rd hex = -1 Saving; 4+ hexes = unsavable                    | `validateGKDive(gk, targetHex, distance): DiveResult` — mechanical rule in Phase 2; goal-line boundary deferred to Phase 4                               |
| SHOT-06 | Handling check after save: roll ≥ Handling = spill (Loose Ball); < Handling = caught            | `validateHandlingCheck(gk, diceValue): HandlingResult`                                                                                                   |
| DICE-03 | Combined score = attribute + dice result                                                        | `computeCombinedScore(attribute, diceValue, penalties): number`                                                                                          |
| DICE-04 | Max cumulative dice penalty is -2                                                               | `computeCombinedScore` enforces `Math.max(totalPenalty, -2)` clamp                                                                                       |
| DICE-05 | Loose Ball: direction 1-6 and distance 1-6 hexes from incident hex                              | `computeLooseBall(from, direction, distance): HexCoord` — D-06/D-07                                                                                      |

</phase_requirements>

---

## Summary

Phase 2 is a pure TypeScript implementation phase — no new dependencies, no server, no networking. The entire deliverable is six domain validator files plus `hexLine()` in `hex.ts`, `GameState` extension in `types.ts`, and a suite of 20+ Vitest unit tests. All tooling (Vitest 2.1.9, TypeScript 5.x, pnpm workspaces) is already installed and working: `pnpm test` in `packages/shared` currently passes 14 tests from Phase 1.

The core architectural question this phase answers is: _what are the inputs and outputs of each validator?_ The locked decisions are unusually complete — D-01 through D-12 specify the `GameState` shape, the function signatures, the return type pattern (discriminated unions), the dice injection strategy, and the file structure. The only discretionary areas are the exact signature shapes for resolution validators (pass accuracy, shot/save duel, heading duel, handling check) and placement of the shared `computeCombinedScore` utility.

The key technical risk is TypeScript strictness. The root `tsconfig.base.json` enables `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. The `GameState` extension with `movedPieceIds`, `paceUsedByPieceId`, and `movementSlot` must use `| null` for the optional fields (not `?:`) to satisfy `exactOptionalPropertyTypes`. Record access on `paceUsedByPieceId` returns `number | undefined` under `noUncheckedIndexedAccess` — validators must handle that explicitly.

**Primary recommendation:** Implement in dependency order — `hex.ts` extension (hexLine) first, then `types.ts` extension (GameState), then validators in order: `moveValidator` → `passValidator` → `shotValidator` → `headingValidator` → `snapshotValidator` → shared `computeCombinedScore` utility. Write tests alongside each file.

---

## Architectural Responsibility Map

| Capability                                 | Primary Tier                       | Secondary Tier               | Rationale                                                                                       |
| ------------------------------------------ | ---------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Movement validation (pace, occupancy, ZoI) | `packages/shared` (pure functions) | —                            | ARCH-07: validation lives in shared, no server imports                                          |
| Pass range and path validation             | `packages/shared` (pure functions) | —                            | Pure math over HexCoord; server calls these in Phase 4                                          |
| Shot/save duel resolution                  | `packages/shared` (pure functions) | —                            | Dice injected as params; deterministic                                                          |
| Heading duel validation                    | `packages/shared` (pure functions) | —                            | Same pattern as shot                                                                            |
| Snapshot trigger detection                 | `packages/shared` (pure functions) | Phase 4 FSM (pitch boundary) | SNAP-01 trigger conditions split: mechanical check in Phase 2, pitch region deferred to Phase 4 |
| Loose Ball coordinate computation          | `packages/shared` (pure functions) | —                            | Pure math; boundary check deferred to Phase 4                                                   |
| GameState type definition                  | `packages/shared/src/types.ts`     | —                            | All downstream packages import from here                                                        |
| Dice generation                            | NOT in this phase                  | Phase 5 server               | DICE-01: dice are server-side crypto; Phase 2 only tests pure validators with injected values   |
| Pitch boundary enforcement                 | NOT in this phase                  | Phase 4                      | Real PITCH_HEXES is a blocking dependency (hard block)                                          |

---

## Standard Stack

### Core (already installed — no new installs required)

| Library        | Version                            | Purpose                                   | Why Standard                                                                                  |
| -------------- | ---------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| TypeScript     | 5.x (6.0.3 current)                | Type-safe pure functions                  | Project constraint; already in monorepo                                                       |
| Vitest         | 2.1.9 (installed)                  | Unit test runner                          | Already configured in `packages/shared/vitest.config.ts`                                      |
| honeycomb-grid | 4.x (not used directly in Phase 2) | Hex math — not needed for pure validators | Phase 2 uses only `hexDistance`, `hexNeighbors` from `hex.ts` (hand-rolled, no honeycomb dep) |

**No new packages are required for Phase 2.** All validator logic is implemented as pure TypeScript functions using only the existing `hex.ts` utilities and standard TypeScript. Vitest is the only test runner and it is already installed. [VERIFIED: npm registry]

### Supporting

None required.

### Alternatives Considered

| Instead of                          | Could Use                     | Tradeoff                                                                                                                                                                                                                                                       |
| ----------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hand-rolled `hexLine()` in `hex.ts` | honeycomb-grid path utilities | honeycomb-grid is browser/client focused; its path API is tied to its Grid/Hex classes; using it server-side would require instantiating Grid objects rather than plain `{q,r}` structs. The redblobgames algorithm is 15 lines and produces identical output. |
| Discriminated union return types    | `throws` on invalid input     | Throwing prevents the FSM from reading consequence data (which defenders triggered a steal?); discriminated unions are the right pattern for game validation where "invalid" often means "trigger a different action".                                         |

**Installation:** None needed. Phase 2 adds zero npm dependencies.

---

## Package Legitimacy Audit

This phase installs no new external packages. All tooling (Vitest, TypeScript, pnpm) is already installed from Phase 1 and was verified at that time.

| Package                            | Registry | Age                | Source Repo                     | slopcheck                             | Disposition                                                                                                      |
| ---------------------------------- | -------- | ------------------ | ------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| vitest (already installed)         | npm      | Dec 2021 (4.5 yrs) | github.com/vitest-dev/vitest    | [SUS] — typosquat flag against "vite" | Approved — legitimate; vitest is the official Vite test runner described on vitest.dev; flag is a false positive |
| honeycomb-grid (already installed) | npm      | Nov 2016 (9+ yrs)  | github.com/flauwekeul/honeycomb | [OK]                                  | Approved                                                                                                         |
| typescript (already installed)     | npm      | N/A                | microsoft/TypeScript            | [OK]                                  | Approved                                                                                                         |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** vitest — flagged as potential typosquat on "vite". This is a known false positive. Vitest is the official testing framework from the Vite team, documented at vitest.dev and hosted at github.com/vitest-dev/vitest. It has been in active use since December 2021 and is already installed in this project from Phase 1. [VERIFIED: vitest.dev official documentation]

---

## Architecture Patterns

### System Architecture Diagram

```
Test suite (*.test.ts)
        │
        │ inject: (state, piece, to, diceValue, ...)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   packages/shared/src/                          │
│                                                                 │
│  hex.ts ──────────────── hexLine(from, to): HexCoord[]          │
│  (add hexLine)            hexDistance, hexNeighbors (existing)  │
│                                          │                      │
│  types.ts ─────────────── GameState      │                      │
│  (extend GameState)        + movedPieceIds                      │
│                            + paceUsedByPieceId                  │
│                            + movementSlot                       │
│                                          │                      │
│  moveValidator.ts ─────── validateMove(state, piece, to)        │
│                              → MoveResult (discriminated union)  │
│                                                                 │
│  passValidator.ts ─────── validatePass(state, piece, to, type)  │
│                              → PassResult                       │
│                           validatePassAccuracy(piece, dice, pen) │
│                              → AccuracyResult                   │
│                                                                 │
│  shotValidator.ts ─────── validateShotDuel(shooter, gk, ...)    │
│                              → ShotDuelResult                   │
│                           validateGKDive(gk, target, distance)  │
│                              → DiveResult                       │
│                           validateHandlingCheck(gk, dice)       │
│                              → HandlingResult                   │
│                                                                 │
│  headingValidator.ts ──── validateHeading(state, piece, ball)   │
│                              → HeadingResult                    │
│                                                                 │
│  snapshotValidator.ts ─── validateSnapshot(state, piece)        │
│                              → SnapshotResult                   │
│                                                                 │
│  (shared utility)         computeCombinedScore(attr, dice, pen) │
│                              → number (clamped at -2 penalty)   │
└─────────────────────────────────────────────────────────────────┘
        │
        │ exports via index.ts
        ▼
@counter-attack/shared ──── consumed by packages/server (Phase 3+)
                                      packages/client (Phase 6+)
```

### Recommended Project Structure

```
packages/shared/src/
├── types.ts             # EXTEND: add GameState movement fields (D-08)
├── hex.ts               # EXTEND: add hexLine(from, to) utility (D-02)
├── hex.test.ts          # EXTEND: add tests for hexLine
├── moveValidator.ts     # NEW: validateMove()
├── moveValidator.test.ts
├── passValidator.ts     # NEW: validatePass(), validatePassAccuracy()
├── passValidator.test.ts
├── shotValidator.ts     # NEW: validateShotDuel(), validateGKDive(), validateHandlingCheck()
├── shotValidator.test.ts
├── headingValidator.ts  # NEW: validateHeading()
├── headingValidator.test.ts
├── snapshotValidator.ts # NEW: validateSnapshot()
├── snapshotValidator.test.ts
├── scoreUtils.ts        # NEW: computeCombinedScore() — or inline in passValidator.ts
├── index.ts             # EXTEND: add all new exports
├── events.ts            # unchanged
└── pitch.ts             # unchanged
```

### Pattern 1: Discriminated Union Validator Result (D-04)

**What:** All validators return a typed union that carries the consequence data the Phase 4 FSM needs to drive state transitions — not just boolean pass/fail.

**When to use:** Every public validator function.

```typescript
// Source: CONTEXT.md D-04 decision
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

export function validateMove(state: GameState, piece: PlayerPiece, to: HexCoord): MoveResult {
  // 1. Check movementSlot is active
  if (state.movementSlot === null) return { ok: false, reason: 'WRONG_SLOT' };

  // 2. Single-step: hexDistance must be exactly 1
  if (hexDistance(piece.position, to) !== 1) return { ok: false, reason: 'OUT_OF_RANGE' };

  // 3. Occupancy check
  const occupied = state.pieces.some((p) => p.position.q === to.q && p.position.r === to.r);
  if (occupied) return { ok: false, reason: 'OCCUPIED' };

  // 4. ATTACKER_2 restrictions (D-11, D-12)
  if (state.movementSlot === 'ATTACKER_2') {
    if (state.movedPieceIds.includes(piece.id)) {
      return { ok: false, reason: 'ALREADY_MOVED_IN_ATTACKER4' };
    }
    const paceUsed = state.paceUsedByPieceId[piece.id] ?? 0;
    if (paceUsed + 1 > 2) return { ok: false, reason: 'PACE_EXCEEDED' };
  } else {
    // ATTACKER_4 or DEFENDER_5: cap by piece.pace
    const paceUsed = state.paceUsedByPieceId[piece.id] ?? 0;
    if (paceUsed + 1 > piece.pace) return { ok: false, reason: 'PACE_EXCEEDED' };
  }

  // 5. ZoI steal check (ball-carrier only)
  if (state.ball.carrierId === piece.id) {
    const defenders = state.pieces.filter(
      (p) => p.teamId !== piece.teamId && hexDistance(to, p.position) === 1,
    );
    if (defenders.length > 0) {
      return { ok: true, effect: { type: 'STEAL_ATTEMPT', defenders } };
    }
  }

  return { ok: true };
}
```

### Pattern 2: hexLine Algorithm (D-02)

**What:** Draws a straight line through the hex grid using cube-coordinate linear interpolation with rounding. Returns all hexes the ball travels through — needed for pass path blocking and interception checks.

**When to use:** `validatePass()` for path blocking (PASS-01) and interception range checks (D-05).

```typescript
// Source: redblobgames.com/grids/hexagons/#line-drawing
// Algorithm: linear interpolation in cube coordinates + cube_round
export function hexLine(from: HexCoord, to: HexCoord): HexCoord[] {
  const n = hexDistance(from, to);
  if (n === 0) return [from];
  const results: HexCoord[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // Lerp in cube coords (s = -q - r)
    const fq = from.q * (1 - t) + to.q * t;
    const fr = from.r * (1 - t) + to.r * t;
    const fs = -from.q - from.r + (from.q + from.r) * t - (-to.q - to.r + to.q + to.r) * t;
    // cube_round
    let rq = Math.round(fq);
    let rr = Math.round(fr);
    let rs = Math.round(fs);
    const dq = Math.abs(rq - fq);
    const dr = Math.abs(rr - fr);
    const ds = Math.abs(rs - fs);
    if (dq > dr && dq > ds) {
      rq = -rr - rs;
    } else if (dr > ds) {
      rr = -rq - rs;
    }
    // else rs is reset; but we only need q,r
    results.push({ q: rq, r: rr });
  }
  return results;
}
```

**Simplified version (axial lerp, mathematically equivalent):**

```typescript
// Source: redblobgames.com/grids/hexagons/#line-drawing
export function hexLine(from: HexCoord, to: HexCoord): HexCoord[] {
  const n = hexDistance(from, to);
  if (n === 0) return [from];
  const results: HexCoord[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const fq = from.q + (to.q - from.q) * t;
    const fr = from.r + (to.r - from.r) * t;
    // cube_round via s derivation
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

### Pattern 3: Dice Injection Pattern (Claude's Discretion)

**What:** Resolution validators (accuracy checks, shot/save duels, heading duels, handling checks) accept dice values as direct numeric parameters. This keeps functions deterministic and fully testable without mocking.

**When to use:** All validators that involve stochastic resolution.

```typescript
// Recommended by CONTEXT.md — Claude verifies fit across all types
export function validatePassAccuracy(
  piece: PlayerPiece,
  passType: 'HIGH' | 'LONG_SAME_THIRD' | 'LONG_CROSS_THIRD',
  diceValue: number,
  penalties: number[],
): AccuracyResult {
  const threshold = passType === 'HIGH' ? 8 : passType === 'LONG_SAME_THIRD' ? 9 : 10;
  const score = computeCombinedScore(
    passType === 'HIGH' ? piece.aerialAbility : piece.dribbling, // TODO: confirm attribute
    diceValue,
    penalties,
  );
  return score >= threshold ? { accurate: true } : { accurate: false, triggerLooseBall: true };
}

export function validateShotDuel(
  shooter: PlayerPiece,
  goalkeeper: PlayerPiece,
  shooterDice: number,
  gkDice: number,
  shooterPenalties: number[],
  gkPenalties: number[],
): ShotDuelResult {
  if (shooterDice === 1) return { outcome: 'MISS', reason: 'AUTO_MISS' }; // SHOT-03
  const shooterScore = computeCombinedScore(shooter.shooting, shooterDice, shooterPenalties);
  const gkScore = computeCombinedScore(goalkeeper.saving, gkDice, gkPenalties);
  if (shooterScore > gkScore) return { outcome: 'GOAL' };
  return { outcome: 'SAVE', needsHandlingCheck: true };
}
```

### Pattern 4: computeCombinedScore (DICE-03 / DICE-04)

**What:** Shared utility computing combined score with a maximum -2 cumulative penalty cap. The -2 cap is a project-wide rule (DICE-04).

**Placement recommendation:** `scoreUtils.ts` — imported by all validators that compute combined scores. Keeps it in one place and makes the -2 cap a single source of truth.

```typescript
// DICE-03 + DICE-04
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

### Pattern 5: computeLooseBall (DICE-05 / D-06 / D-07)

**What:** Pure coordinate function. Takes dice values as parameters (D-06), maps direction to the AXIAL_DIRECTIONS constant already in `hex.ts` (D-07).

```typescript
// Source: Counter Attack rulebook v1.4.1 deflection ruler
// Direction mapping: 1=E, 2=NE, 3=NW, 4=W, 5=SW, 6=SE
// Matches index order of AXIAL_DIRECTIONS in hex.ts: [E, NE, NW, W, SW, SE]
const LOOSE_BALL_DIRECTIONS: readonly HexCoord[] = [
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
  const dir = LOOSE_BALL_DIRECTIONS[direction - 1]!; // non-null: direction is 1-6
  return { q: from.q + dir.q * distance, r: from.r + dir.r * distance };
}
```

### Pattern 6: ZoI Utility Factoring (Claude's Discretion)

**Recommendation:** Add `getZoIDefenders(position: HexCoord, opponentPieces: readonly PlayerPiece[]): PlayerPiece[]` to `hex.ts` alongside the existing `isUnderZoI()`. The existing function returns `boolean` and is used in tests. The new typed variant returns `PlayerPiece[]` so validators can include defenders in consequence data (D-04, D-05).

```typescript
// Addition to hex.ts
export function getZoIDefenders(
  position: HexCoord,
  opponentPieces: readonly PlayerPiece[],
): PlayerPiece[] {
  return opponentPieces.filter((p) => hexDistance(position, p.position) === 1);
}
```

`isUnderZoI()` stays unchanged (existing tests reference it). `getZoIDefenders()` is the version validators use.

### Anti-Patterns to Avoid

- **Checking `!state.movedPieceIds.includes(pieceId)` for ATTACKER_4/DEFENDER_5 slots:** Only ATTACKER_2 has the "not previously moved" restriction. ATTACKER_4 players _can_ move again in ATTACKER_2 — wait, they cannot per D-12. The check is correct but the inverse matters: ATTACKER_2 pieces must be NEW (not in movedPieceIds). ATTACKER_4/DEFENDER_5 have no such restriction.
- **Accessing `state.paceUsedByPieceId[pieceId]` without a `?? 0` default:** `noUncheckedIndexedAccess` is enabled in tsconfig; this produces `number | undefined`. Always default to 0.
- **Optional chaining on `movementSlot`:** `exactOptionalPropertyTypes` is enabled. Do not use `state.movementSlot?.` — use an explicit `!== null` check. The field must be typed as `'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2' | null`, not optional (`?:`).
- **Importing from `socket.io` or `express` in any file under `packages/shared/src/`:** TypeScript compilation of the shared package runs in isolation (ARCH-07). These packages are not installed in `packages/shared`. Any such import causes a build failure.
- **Throwing on validation failure:** Return a discriminated union result instead. The Phase 4 FSM consumes result types, not exceptions.
- **Hex line including endpoints from `from` hex:** The `hexLine()` function includes both `from` and `to`. For pass path blocking, the implementation should skip the source hex (ball origin) and only check hexes the ball _passes through or lands on_. Consider whether to include the destination when checking for blocking opponents.

---

## Don't Hand-Roll

| Problem                      | Don't Build                                                        | Use Instead                                                    | Why                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Hex line drawing             | Custom ad-hoc algorithm                                            | `hexLine()` in `hex.ts` using redblobgames cube-lerp algorithm | The naive approach (stepping along one axis) fails on diagonal paths; the lerp+round algorithm handles all directions correctly |
| Dice max-penalty enforcement | Inline `Math.min(a+b, a-2)` scattered per validator                | `computeCombinedScore()` with DICE-04 clamp                    | Single bug-fix location; DRY; Phase 5 will reuse when wiring real dice                                                          |
| ZoI adjacency scatter        | Calling `hexNeighbors()` in every validator and filtering manually | `getZoIDefenders()` in `hex.ts`                                | DRY; ensures consistent distance-1 definition across move and pass validators                                                   |

**Key insight:** This phase's "don't hand-roll" is about intra-project duplication. The risk is writing the same distance/adjacency logic in five validator files independently, creating a maintenance hazard.

---

## Common Pitfalls

### Pitfall 1: `noUncheckedIndexedAccess` on Record types

**What goes wrong:** `state.paceUsedByPieceId[piece.id]` has type `number | undefined` under the strict tsconfig. Arithmetic on it without a null-guard produces a TypeScript error.

**Why it happens:** `tsconfig.base.json` enables `noUncheckedIndexedAccess: true`. The `GameState.paceUsedByPieceId` field is `Readonly<Record<string, number>>`, so index access produces `number | undefined`.

**How to avoid:** Always use `?? 0`: `const paceUsed = state.paceUsedByPieceId[piece.id] ?? 0;`

**Warning signs:** TypeScript error `Type 'number | undefined' is not assignable to type 'number'` when writing `paceUsedByPieceId[id] + 1`.

---

### Pitfall 2: `exactOptionalPropertyTypes` vs `| null`

**What goes wrong:** Declaring `movementSlot?: '...' | null` instead of `movementSlot: '...' | null` changes the semantics under `exactOptionalPropertyTypes`. An optional field with `?:` allows `undefined` (not in the union); a required field typed as `| null` is explicit.

**Why it happens:** `tsconfig.base.json` enables `exactOptionalPropertyTypes: true`, which treats `?:` and `| undefined` differently.

**How to avoid:** Declare `movementSlot: 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2' | null` (required field, null for "inactive"). Same for `movedPieceIds` (use `readonly string[]`, not optional) and `paceUsedByPieceId` (use `Readonly<Record<string, number>>`, not optional).

**Warning signs:** Assignment errors on GameState construction; TypeScript requiring `undefined` handling you didn't expect.

---

### Pitfall 3: hexLine endpoint semantics in pass path blocking

**What goes wrong:** `hexLine(from, to)` includes both the start hex and destination. When checking if a pass travels through an opponent's hex (PASS-01: "cannot pass through an opponent's hex"), the passer's own hex (`from`) and the target hex (`to`) should be excluded from the blocking check — otherwise a passer with an opponent in their own hex, or passing to an opponent's hex, gets different treatment than intended.

**Why it happens:** The algorithm naturally includes endpoints. The rulebook "cannot pass through" does not mean "cannot pass to" — destination checks are separate.

**How to avoid:** In `validatePass()`, slice the path: `hexLine(from, to).slice(1, -1)` for blocking checks (skip source and destination); check destination occupancy separately.

**Warning signs:** Tests where a pass to an unoccupied hex fails because the passer's own hex is blocked.

---

### Pitfall 4: backward-compatible GameState extension

**What goes wrong:** Adding new required fields to `GameState` without defaults breaks existing server and client code that constructs `GameState` objects (test fixtures in Phase 1, and future Phase 3 room initialization).

**Why it happens:** TypeScript will require all new fields at every construction site.

**How to avoid:** The fields `movedPieceIds: readonly string[]`, `paceUsedByPieceId: Readonly<Record<string, number>>`, and `movementSlot: '...' | null` all have natural "empty/inactive" defaults (`[]`, `{}`, `null`). Document the default values in a JSDoc comment on each field. Existing `GameState` construction sites will need updating — plan a task for this.

**Warning signs:** TypeScript errors at `packages/server` (Phase 3 uses the type even though server scaffold is not yet wired to game logic).

---

### Pitfall 5: ATTACKER_2 restriction direction

**What goes wrong:** Confusing which direction the D-12 restriction flows. ATTACKER_2 pieces must NOT be in `movedPieceIds`. This means: if a piece already moved in ATTACKER_4, it cannot move again in ATTACKER_2. It does NOT mean ATTACKER_4 pieces can't have moved before in ATTACKER_4.

**Why it happens:** D-12 is phrased as "ATTACKER_2 pieces must not appear in movedPieceIds" — the check is: `if (movementSlot === 'ATTACKER_2' && movedPieceIds.includes(piece.id)) → reject`.

**How to avoid:** Name the reason code clearly: `'ALREADY_MOVED_IN_ATTACKER4'` so it's obvious what constraint fired.

---

### Pitfall 6: Loose Ball direction mapping off-by-one

**What goes wrong:** `direction` param is `1|2|3|4|5|6` (1-indexed), but array indexing is 0-indexed.

**Why it happens:** Dice values are 1-6; array indices are 0-5.

**How to avoid:** Always use `LOOSE_BALL_DIRECTIONS[direction - 1]`. With `noUncheckedIndexedAccess`, add a non-null assertion `!` because the type system can't prove the literal union `1|2|3|4|5|6` maps to a valid index — but it does by construction. Document why.

---

## Code Examples

### Verified TypeScript strict-mode guard patterns

```typescript
// Source: verified against packages/shared/tsconfig.json + tsconfig.base.json [VERIFIED: codebase grep]

// noUncheckedIndexedAccess: always default Record access
const paceUsed = state.paceUsedByPieceId[piece.id] ?? 0;

// exactOptionalPropertyTypes: required field with null, not optional
type GameStateExtension = {
  movedPieceIds: readonly string[];
  paceUsedByPieceId: Readonly<Record<string, number>>;
  movementSlot: 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2' | null;
};

// verbatimModuleSyntax: use 'import type' for type-only imports
import type { PlayerPiece, HexCoord, GameState } from './types.js';
import { hexDistance, hexLine, getZoIDefenders } from './hex.js';

// Non-null assertion on bounded union array index
const dir = LOOSE_BALL_DIRECTIONS[direction - 1]!;
```

### Existing test pattern to follow (from hex.test.ts)

```typescript
// Source: packages/shared/src/hex.test.ts [VERIFIED: codebase read]
import { describe, it, expect } from 'vitest';
import { validateMove } from './moveValidator.js';
import type { GameState, PlayerPiece } from './types.js';

describe('validateMove', () => {
  it('rejects move to occupied hex', () => {
    // arrange
    const state: GameState = {
      /* minimal fixture */
    };
    const piece: PlayerPiece = {
      /* piece at origin */
    };
    const to = { q: 1, r: 0 }; // occupied by another piece

    // act
    const result = validateMove(state, piece, to);

    // assert
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

## State of the Art

| Old Approach                        | Current Approach            | When Changed                   | Impact                                                         |
| ----------------------------------- | --------------------------- | ------------------------------ | -------------------------------------------------------------- | --------------------------------------------------- |
| `throw new Error()` in validators   | Discriminated union returns | Project design decision (D-04) | FSM can read consequence data without try/catch                |
| Optional GameState fields with `?:` | Required fields with `      | null`                          | `exactOptionalPropertyTypes` in tsconfig.base.json             | More explicit nullability; no `undefined` surprises |
| Single `validators.ts` file         | Domain-split files per D-09 | Project design decision        | Easier test co-location; smaller files; follows hex.ts pattern |

**Deprecated/outdated:**

- `isUnderZoI()` (Phase 1 stub) remains but is supplemented by `getZoIDefenders()` which returns the typed defenders array validators need. The original boolean function is kept for backward-compat (tests exist for it).

---

## Assumptions Log

| #   | Claim                                                                                                               | Section                           | Risk if Wrong                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Pass accuracy for High Pass uses `aerialAbility` attribute; Long Pass uses `dribbling`                              | Code Examples / passValidator     | Wrong attribute used in accuracy calculation; affects PASS-03/PASS-04 balance. The CONTEXT.md does not specify which attribute maps to which pass type — this needs confirmation from the rulebook.                                                 |
| A2  | Loose Ball direction mapping (dice 1=E, 2=NE, 3=NW, 4=W, 5=SW, 6=SE) matches AXIAL_DIRECTIONS index order in hex.ts | Architecture Patterns (Pattern 5) | Wrong mapping would produce wrong ball positions in live games. CONTEXT.md notes "needs to be verified against the physical rulebook v1.4.1 before Phase 4 uses it in a live game". Implement with documentation; Phase 4 verification is the gate. |
| A3  | `hexLine()` including both source and destination is correct; callers slice as needed                               | Common Pitfalls #3                | If the algorithm should exclude endpoints by default, callers could miss blocking the destination hex or incorrectly include the source.                                                                                                            |

**If this table is empty:** It is not — see A1, A2, A3 above.

---

## Open Questions

1. **Which PlayerPiece attribute governs High Pass and Long Pass accuracy?**
   - What we know: PASS-03 requires accuracy check; PASS-04 requires accuracy check. `PlayerPiece` has 9 attributes. The CONTEXT.md does not map pass types to specific attributes.
   - What's unclear: Is High Pass accuracy based on `aerialAbility`? Is Long Pass based on `dribbling`? Or is there a separate "passing" attribute not currently in the type?
   - Recommendation: The planner should add a human-verify checkpoint before implementing `validatePassAccuracy` — or default to `aerialAbility` for High Pass and `dribbling` for Long Pass and flag it as an assumption in the implementation comment.

2. **SNAP-01 trigger condition — "immediately after any pass" outside penalty area?**
   - What we know: SNAP-01 says "inside or outside box" for the post-pass trigger.
   - What's unclear: Does `validateSnapshot()` need to signal availability from inside the passing validators, or is it a separate call the FSM makes after any pass resolves?
   - Recommendation: Snapshot availability after a pass is an FSM state transition, not a pass validator concern. `validateSnapshot()` should be callable by the FSM after any pass, with the FSM passing the current game state. Phase 4 drives the trigger; Phase 2 only validates legality.

---

## Environment Availability

Step 2.6: Verified — no external dependencies for this phase.

| Dependency | Required By                     | Available | Version                              | Fallback |
| ---------- | ------------------------------- | --------- | ------------------------------------ | -------- |
| Node.js    | TypeScript compilation, Vitest  | ✓         | v24.15.0                             | —        |
| pnpm       | Package management, test runner | ✓         | 9.x (from Phase 1)                   | —        |
| TypeScript | Compilation                     | ✓         | 6.0.3 (tsc)                          | —        |
| Vitest     | Unit test runner                | ✓         | 2.1.9 (installed in packages/shared) | —        |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| Framework          | Vitest 2.1.9                                                             |
| Config file        | `packages/shared/vitest.config.ts` (exists, working)                     |
| Quick run command  | `pnpm --filter=@counter-attack/shared test`                              |
| Full suite command | `pnpm --filter=@counter-attack/shared test` (same — all tests in shared) |

### Phase Requirements → Test Map

| Req ID  | Behavior                                            | Test Type | Automated Command                                                          | File Exists?                            |
| ------- | --------------------------------------------------- | --------- | -------------------------------------------------------------------------- | --------------------------------------- |
| MOVE-01 | `movementSlot` gates which pieces can move          | unit      | `pnpm --filter=@counter-attack/shared test -- moveValidator`               | ❌ Wave 0                               |
| MOVE-02 | Pace cap per slot                                   | unit      | same                                                                       | ❌ Wave 0                               |
| MOVE-03 | Occupancy rejection                                 | unit      | same                                                                       | ❌ Wave 0                               |
| MOVE-04 | ZoI steal attempt effect                            | unit      | same                                                                       | ❌ Wave 0                               |
| MOVE-05 | Steal ends movement (consequence signalled)         | unit      | same                                                                       | ❌ Wave 0                               |
| MOVE-07 | Snapshot available effect during movement           | unit      | same                                                                       | ❌ Wave 0                               |
| PASS-01 | Standard Pass ≤11, path blocking, interception list | unit      | `pnpm --filter=@counter-attack/shared test -- passValidator`               | ❌ Wave 0                               |
| PASS-02 | First-time Pass ≤6, player-move effect              | unit      | same                                                                       | ❌ Wave 0                               |
| PASS-03 | High Pass ≤15, accuracy threshold 8                 | unit      | same                                                                       | ❌ Wave 0                               |
| PASS-04 | Long Pass any distance, accuracy threshold 9/10     | unit      | same                                                                       | ❌ Wave 0                               |
| PASS-05 | Inaccurate pass → Loose Ball trigger                | unit      | same                                                                       | ❌ Wave 0                               |
| HEAD-01 | Challenger distance penalty modifier                | unit      | `pnpm --filter=@counter-attack/shared test -- headingValidator`            | ❌ Wave 0                               |
| HEAD-02 | Uncontested header                                  | unit      | same                                                                       | ❌ Wave 0                               |
| HEAD-03 | Headed shot declaration                             | unit      | same                                                                       | ❌ Wave 0                               |
| HEAD-04 | Consecutive header prevention                       | unit      | same                                                                       | ❌ Wave 0                               |
| HEAD-05 | Excluded piece IDs after heading                    | unit      | same                                                                       | ❌ Wave 0                               |
| SNAP-01 | Snapshot trigger validation                         | unit      | `pnpm --filter=@counter-attack/shared test -- snapshotValidator`           | ❌ Wave 0                               |
| SNAP-02 | Snapshot penalty signal                             | unit      | same                                                                       | ❌ Wave 0                               |
| SHOT-01 | Shot duel combined score                            | unit      | `pnpm --filter=@counter-attack/shared test -- shotValidator`               | ❌ Wave 0                               |
| SHOT-02 | Outside area penalty                                | unit      | same                                                                       | ❌ Wave 0                               |
| SHOT-03 | Auto-miss on dice=1                                 | unit      | same                                                                       | ❌ Wave 0                               |
| SHOT-04 | GK dive distance rules                              | unit      | same                                                                       | ❌ Wave 0                               |
| SHOT-06 | Handling check result                               | unit      | same                                                                       | ❌ Wave 0                               |
| DICE-03 | Combined score calculation                          | unit      | `pnpm --filter=@counter-attack/shared test -- scoreUtils`                  | ❌ Wave 0                               |
| DICE-04 | Max -2 penalty cap                                  | unit      | same                                                                       | ❌ Wave 0                               |
| DICE-05 | Loose Ball coordinate                               | unit      | `pnpm --filter=@counter-attack/shared test -- passValidator` or scoreUtils | ❌ Wave 0                               |
| D-02    | hexLine algorithm                                   | unit      | `pnpm --filter=@counter-attack/shared test -- hex`                         | ❌ Wave 0 (extend existing hex.test.ts) |

### Sampling Rate

- **Per task commit:** `pnpm --filter=@counter-attack/shared test`
- **Per wave merge:** `pnpm --filter=@counter-attack/shared test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/shared/src/moveValidator.ts` + `moveValidator.test.ts` — covers MOVE-01 through MOVE-07
- [ ] `packages/shared/src/passValidator.ts` + `passValidator.test.ts` — covers PASS-01 through PASS-05
- [ ] `packages/shared/src/shotValidator.ts` + `shotValidator.test.ts` — covers SHOT-01 through SHOT-04, SHOT-06
- [ ] `packages/shared/src/headingValidator.ts` + `headingValidator.test.ts` — covers HEAD-01 through HEAD-05
- [ ] `packages/shared/src/snapshotValidator.ts` + `snapshotValidator.test.ts` — covers SNAP-01 through SNAP-03
- [ ] `packages/shared/src/scoreUtils.ts` + tests inline in a domain validator or own file — covers DICE-03, DICE-04
- [ ] Extension to `packages/shared/src/hex.ts` (add `hexLine`, `getZoIDefenders`) — covers D-02, ZoI pattern
- [ ] Extension to `packages/shared/src/hex.test.ts` (add hexLine tests) — verifies D-02
- [ ] Extension to `packages/shared/src/types.ts` (add D-08 GameState fields) — type contract for all validators
- [ ] Extension to `packages/shared/src/index.ts` (add all new exports)

---

## Security Domain

This phase contains no authentication, session management, access control, cryptography, or user input handling. It is entirely pure TypeScript functions operating on in-memory game state structs with no I/O, no network, and no persistence. ASVS categories V2–V6 do not apply.

The one security-adjacent rule to note for downstream phases: DICE-01 mandates server-side `crypto.randomInt` for all dice. Phase 2 validators accept dice values as parameters precisely so that the dice generation (Phase 5, server only) stays decoupled. This architectural choice is intentional — do not introduce any random number generation in Phase 2.

---

## Sources

### Primary (HIGH confidence)

- `packages/shared/src/types.ts` — existing types confirmed by direct read [VERIFIED: codebase read]
- `packages/shared/src/hex.ts` — existing utilities confirmed by direct read [VERIFIED: codebase read]
- `packages/shared/src/hex.test.ts` — test pattern confirmed by direct read [VERIFIED: codebase read]
- `packages/shared/vitest.config.ts` — test config confirmed by direct read [VERIFIED: codebase read]
- `packages/shared/package.json` — Vitest 2.1.9 confirmed installed [VERIFIED: codebase read]
- `tsconfig.base.json` — strict flags confirmed: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` [VERIFIED: codebase read]
- `.planning/phases/02-move-validator-unit-tests/02-CONTEXT.md` — locked decisions D-01 through D-12 [VERIFIED: codebase read]
- redblobgames.com/grids/hexagons/#line-drawing — hexLine cube-lerp algorithm [CITED: redblobgames.com]
- vitest.dev — Vitest confirmed as legitimate testing framework [CITED: vitest.dev]

### Secondary (MEDIUM confidence)

- npm registry: `vitest` version 2.1.9, created 2021-12-03, repository github.com/vitest-dev/vitest [VERIFIED: npm registry]
- npm registry: `honeycomb-grid` version 4.1.5, created 2016-11-14, repository github.com/flauwekeul/honeycomb [VERIFIED: npm registry]
- npm registry: `typescript` version 6.0.3 [VERIFIED: npm registry]

### Tertiary (LOW confidence)

- Attribute mapping (aerialAbility for High Pass, dribbling for Long Pass) — [ASSUMED] training knowledge; not confirmed in REQUIREMENTS.md or CONTEXT.md.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — Vitest 2.1.9 already installed and running; TypeScript already configured; no new packages
- Architecture: HIGH — Locked decisions D-01 through D-12 cover all major design choices; existing code patterns verified by direct read
- Pitfalls: HIGH — TypeScript strict flags verified directly from tsconfig; hex algorithm from authoritative source (redblobgames.com)
- Attribute mapping for pass accuracy: LOW — not specified in locked decisions; marked as assumption

**Research date:** 2026-05-29
**Valid until:** 2026-08-29 (stable domain — pure TypeScript, no external APIs, locked decisions unlikely to change)
