# Phase 2: Move Validator + Unit Tests - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

All game rule validation logic — movement (4-5-2 sequence), passing (all four types), heading duels, shooting/saving duels, snapshots, Zone of Influence, and Loose Ball — implemented as pure TypeScript functions in `packages/shared/src/` with a complete Vitest unit test suite (20+ tests). No Socket.io, Express, or server imports. Builds on the hex math and types established in Phase 1.

Deliverables: `pnpm test` in `packages/shared` passes; `validateMove()`, `validatePass()`, `computeLooseBall()`, and related functions are exported from the shared package index; `GameState` type extended with movement-phase tracking fields.

</domain>

<decisions>
## Implementation Decisions

### Pass Range Measurement

- **D-01:** All pass range checks use `hexDistance(from, to)` — minimum axial hex steps, the same metric already in `hex.ts`. PASS-01: Standard Pass ≤11; PASS-02: First-time Pass ≤6; PASS-03: High Pass ≤15; PASS-04: Long Pass = any position (no distance cap, different destination constraints).
- **D-02:** Path calculation is required. A `hexLine(from: HexCoord, to: HexCoord): HexCoord[]` utility is added to `hex.ts` returning the hex coordinates the ball travels through. Used by PASS-01 (cannot pass through an opponent's hex) and interception checks along the travel path. Source algorithm: redblobgames.com hex line drawing.

### ZoI Scope & Application

- **D-03:** ZoI applies in two distinct contexts: (a) ball-carrier movement — when the ball-carrier moves to a hex adjacent to a defender, a steal attempt is triggered (MOVE-04); (b) pass travel path — any defender within 1 hex of any hex the ball passes through can attempt interception (PASS-01). Outfield players without the ball move freely — no ZoI trigger.
- **D-04:** All validators return typed discriminated union results carrying consequence data. Example shape: `{ ok: true } | { ok: false, reason: 'OCCUPIED' | 'PACE_EXCEEDED' | 'WRONG_SLOT' } | { ok: true, effect: { type: 'STEAL_ATTEMPT', defenders: PlayerPiece[] } }`. The Phase 4 FSM uses the consequence type to drive state transitions — not just pass/fail.
- **D-05:** Pass interception (PASS-01) is checked along the entire travel path computed by `hexLine()`. `validatePass()` returns a list of all defenders within 1 hex of any path hex. Interception is possible, not automatic — the Phase 4/5 dice resolution decides the outcome.

### Dice Interaction in Validators

- **D-06:** `computeLooseBall(from: HexCoord, direction: 1|2|3|4|5|6, distance: 1|2|3|4|5|6): HexCoord` — receives dice values as parameters, returns the raw destination HexCoord with no boundary check. Boundary validation (is the result a valid pitch hex?) is deferred to Phase 4 when `PITCH_HEXES` contains real coordinates.
- **D-07:** The Loose Ball direction mapping (dice 1–6 → hex direction) is fixed per the Counter Attack rulebook v1.4.1 deflection ruler. Hard-coded as a constant in `computeLooseBall()` with its source documented.

### GameState Extension & File Structure

- **D-08:** `GameState` in `packages/shared/src/types.ts` is extended with three movement-phase tracking fields:
  - `movedPieceIds: readonly string[]` — IDs of pieces that have completed their movement in the current Movement Phase (empty outside MOVEMENT phase)
  - `paceUsedByPieceId: Readonly<Record<string, number>>` — cumulative hexes moved per piece in the current Movement Phase (empty outside MOVEMENT phase)
  - `movementSlot: 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2' | null` — which 4-5-2 sub-phase is currently active (null outside MOVEMENT phase)
- **D-09:** Validator functions are split by domain — separate files, each with a co-located `*.test.ts`, following the `hex.ts` / `hex.test.ts` pattern:
  - `moveValidator.ts` + `moveValidator.test.ts`
  - `passValidator.ts` + `passValidator.test.ts`
  - `shotValidator.ts` + `shotValidator.test.ts`
  - `headingValidator.ts` + `headingValidator.test.ts`
  - `snapshotValidator.ts` + `snapshotValidator.test.ts`
  - Shared ZoI logic lives in `hex.ts` (extending the existing `isUnderZoI`) or a thin `zoiValidator.ts`
- **D-10:** Movement is **multi-step incremental** — `validateMove()` is called once per hex step (single-step, not jump-to-destination). The validator checks: `hexDistance(piece.position, to) === 1`, hex is unoccupied (MOVE-03), cumulative `paceUsed + 1 <= allowedPace`. `paceUsedByPieceId[pieceId]` accumulates across steps.
- **D-11:** The ATTACKER_2 slot applies a **flat 2-hex cap** regardless of each piece's Pace attribute. ATTACKER_4 and DEFENDER_5 slots cap movement by the piece's `pace` attribute. Allowed pace per slot:
  - `ATTACKER_4`: `piece.pace`
  - `DEFENDER_5`: `piece.pace`
  - `ATTACKER_2`: `2` (flat cap, overrides Pace)
- **D-12:** ATTACKER_2 pieces must NOT appear in `movedPieceIds` (they must be different players from those who moved in ATTACKER_4). `validateMove()` enforces this.

### Claude's Discretion

- **Dice injection pattern for resolution validators** (pass accuracy checks PASS-03/PASS-04, shot/save duels SHOT-01, heading duels HEAD-01, handling checks SHOT-06): accept dice values as direct numeric parameters so functions are deterministic and fully unit-testable. Recommended signature shape: `validatePassAccuracy(piece: PlayerPiece, diceValue: number, penalties: number[]): AccuracyResult`. Claude should verify this fits cleanly across all resolution types.
- **Combined score utility (DICE-03):** A `computeCombinedScore(attribute: number, diceValue: number, penalties: number[]): number` helper enforcing DICE-04's max cumulative penalty of -2. Claude decides placement (inline or shared utility).
- **ZoI utility factoring:** Whether to extend `isUnderZoI()` in-place, add a `getZoIDefenders()` variant, or put adjacency logic in each validator. Keep it DRY without over-abstracting.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Goal & Success Criteria

- `.planning/ROADMAP.md` §Phase 2 — goal, success criteria (5 criteria including 20+ tests, validateMove/validatePass signatures, computeZoI, isolation constraint), and requirements list. Read success criteria verbatim when writing plan acceptance tests.

### Game Rules (requirements this phase must satisfy)

- `.planning/REQUIREMENTS.md` §Movement Phase — MOVE-01 through MOVE-07 (4-5-2 sequence, Pace cap, occupancy, ZoI steal, free 6-hex move, snapshot opportunity)
- `.planning/REQUIREMENTS.md` §Passing — PASS-01 through PASS-05 (Standard/First-time/High/Long pass rules, Loose Ball trigger)
- `.planning/REQUIREMENTS.md` §Heading — HEAD-01 through HEAD-05 (range rules, uncontested header, headed shot, consecutive header restriction, post-header exclusion)
- `.planning/REQUIREMENTS.md` §Snapshots — SNAP-01 through SNAP-03 (trigger conditions, -1 dice penalty, deflection opportunity)
- `.planning/REQUIREMENTS.md` §Shooting & Saving — SHOT-01 through SHOT-04, SHOT-06 (duel resolution, outside-box penalty, auto-miss on 1, GK dive range, handling check)
- `.planning/REQUIREMENTS.md` §Dice & Resolution — DICE-03 (combined score), DICE-04 (max -2 penalty cap), DICE-05 (Loose Ball direction + distance)

### Architectural Constraints

- `.planning/STATE.md` §Decisions Locked — axial-only coords, server-authoritative state, no client dice; pitfalls that MUST be respected
- `.planning/STATE.md` §Key Pitfalls to Avoid — specific anti-patterns to avoid in this phase

### Existing Code (must read before planning)

- `packages/shared/src/types.ts` — types to extend: `GameState` (add D-08 fields), `PlayerPiece` (all 9 attributes available), `HexCoord`
- `packages/shared/src/hex.ts` — utilities to build on (`hexDistance`, `hexNeighbors`, `hexesInRange`, `isUnderZoI`) and extend (add `hexLine`)
- `packages/shared/src/hex.test.ts` — test structure and pattern to follow for all new `*.test.ts` files
- `packages/shared/src/index.ts` — all new exports must be added here

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `hexDistance(a, b): number` in `hex.ts` — direct use for all pass range and movement distance checks
- `hexNeighbors(hex): HexCoord[]` in `hex.ts` — basis for ZoI adjacency checks (who is adjacent to a path hex?)
- `isUnderZoI(position, opponentPieces): boolean` in `hex.ts` — Phase 1 stub; extend or supplement for typed-consequence return
- `hexesInRange(center, range): HexCoord[]` in `hex.ts` — useful for computing valid destination sets in tests
- `PlayerPiece` type — all 9 attributes typed: `pace`, `shooting`, `tackling`, `dribbling`, `heading`, `saving`, `handling`, `resilience`, `aerialAbility`
- `GamePhase` union — `'MOVEMENT'`, `'PASS'`, `'SHOT'`, `'HEADER'`, `'SNAPSHOT'`, `'LOOSE_BALL'` all defined; validators constrain which phase is active
- Vitest already configured in `packages/shared/vitest.config.ts`; `pnpm test` already wired

### Established Patterns

- Co-located test files: `*.ts` with sibling `*.test.ts` in `packages/shared/src/`
- `describe('function', () => { it('behavioural description', () => { expect(...).toBe(...) }) })` test structure
- Pure axial math — no offset coords anywhere; `{q, r}` objects are the only coordinate type
- Zero server/socket imports in `packages/shared` — enforced by TypeScript compilation in isolation (ARCH-07)
- Single root index (`packages/shared/src/index.ts`) — all exports go through it

### Integration Points

- `packages/shared/src/index.ts` — new validator exports added here; downstream packages (`server`, `client`) import from `@counter-attack/shared`
- `GameState` type extension in `types.ts` — immediately affects `packages/server` (Phase 3+) which imports this type; extension must be backward-compatible (null/empty defaults for new fields outside MOVEMENT phase)
- Phase 4 (Game Engine + FSM) is the primary consumer of Phase 2 validators — the discriminated union return types (D-04) are designed for the FSM to switch on

</code_context>

<specifics>
## Specific Ideas

- `hexLine(from, to)` should use the standard hex line-drawing algorithm from redblobgames.com — linear interpolation in cube coordinates then round. Include the source URL in a comment matching the style in `hex.ts`.
- The `movementSlot` field (D-08) drives which Pace cap formula applies in `validateMove()`. The validator should derive allowed pace from `(slot === 'ATTACKER_2') ? 2 : piece.pace`.
- ATTACKER_2 enforcement (D-12): `validateMove()` checks `!state.movedPieceIds.includes(piece.id)` when `movementSlot === 'ATTACKER_2'` to ensure the piece wasn't already moved in ATTACKER_4.
- The Loose Ball direction mapping from the physical deflection ruler should be documented as: dice 1=E, 2=NE, 3=NW, 4=W, 5=SW, 6=SE — matching the order in `AXIAL_DIRECTIONS`. This needs to be verified against the physical rulebook v1.4.1 before Phase 4 uses it in a live game.
- First-time Pass (PASS-02) allows each team to move 1 player 1 hex while the ball travels. This is an effect that `validatePass()` should signal as part of its result (not just a boolean) so Phase 4 can prompt for the player movement.

</specifics>

<deferred>
## Deferred Ideas

- **Boundary checking for Loose Ball** — `computeLooseBall()` returns raw destination; checking it against `PITCH_HEXES` is deferred to Phase 4 when real pitch coordinates are available.
- **GK dive range validation (SHOT-04)** — "goalkeeper may dive up to 3 hexes parallel to the goal line" requires knowing pitch geometry (goal line position). Validate the mechanical rule (dive ≤3 hexes, -1 Saving at 3rd hex, 4+ hexes = unsavable) in Phase 2; boundary check deferred to Phase 4.
- **Free 6-hex move after final-third action (MOVE-06)** — This is a movement phase trigger but requires knowledge of which hexes are in each final third. Validation logic deferred to Phase 4 when pitch regions (PITCH-02) are encoded.

</deferred>

---

_Phase: 2-Move Validator + Unit Tests_
_Context gathered: 2026-05-29_
