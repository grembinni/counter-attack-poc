# Phase 2: Move Validator + Unit Tests - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 02-move-validator-unit-tests
**Areas discussed:** Pass range metric, ZoI scope, Dice interaction in validators, State tracking for 4-5-2 validation

---

## Pass Range Metric

| Option             | Description                                                                         | Selected |
| ------------------ | ----------------------------------------------------------------------------------- | -------- |
| Minimum hex steps  | hexDistance(from, to) ≤ N — standard hex-grid distance, already implemented         | ✓        |
| Straight-line only | Pass must travel along one of the 6 axial directions; range = steps along that axis |          |
| Check rulebook     | Flag as unresolved; default to hexDistance()                                        |          |

**User's choice:** Minimum hex steps (hexDistance)

---

| Option                     | Description                                                                   | Selected |
| -------------------------- | ----------------------------------------------------------------------------- | -------- |
| Implement path calculation | validatePass() checks hexes along the travel path via a new hexLine() utility | ✓        |
| Range + destination only   | Path blocking deferred to Phase 4                                             |          |

**User's choice:** Implement path calculation

**Notes:** hexLine() added to hex.ts using standard hex line-drawing algorithm (redblobgames.com). Path blocking required for PASS-01 and interception checks.

---

## ZoI Scope

| Option                            | Description                                                            | Selected |
| --------------------------------- | ---------------------------------------------------------------------- | -------- |
| Ball-carrier only                 | ZoI steal trigger only when ball-carrier moves to adjacent hex         |          |
| Also blocks pass destinations     | ZoI also applies at pass destination                                   |          |
| Both: movement AND passes use ZoI | Ball-carrier steal + pass path interception; outfield movement is free | ✓        |

**User's choice:** Both: movement AND passes use ZoI

---

| Option                        | Description                                                                               | Selected |
| ----------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| Typed result with consequence | Returns discriminated union with consequence data (STEAL_ATTEMPT, interceptionRisk, etc.) | ✓        |
| Boolean + separate query      | isUnderZoI() returns bool; caller calls getZoIDefenders() separately                      |          |
| You decide                    | Leave return types to Claude                                                              |          |

**User's choice:** Typed result with consequence

---

| Option                   | Description                                                    | Selected |
| ------------------------ | -------------------------------------------------------------- | -------- |
| Along entire travel path | Defenders adjacent to any hex in the ball's path can intercept | ✓        |
| Destination only         | Only defenders adjacent to where ball lands can intercept      |          |
| Check rulebook           | Flag as unresolved; default to destination-only                |          |

**User's choice:** Along entire travel path

---

## Dice Interaction in Validators

| Option                           | Description                                                           | Selected |
| -------------------------------- | --------------------------------------------------------------------- | -------- |
| Accept dice value as parameter   | Deterministic: caller passes the dice number; tests pass fixed values |          |
| Two-phase: evaluate then resolve | evaluateX() → needsDice; resolveWithDice(evalResult, dice) → outcome  |          |
| You decide                       | Leave dice injection pattern to Claude                                | ✓        |

**User's choice:** You decide (Claude's discretion — parameter injection recommended)

---

| Option                                      | Description                                                                | Selected |
| ------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| Raw destination only, no bounds check       | computeLooseBall returns HexCoord; boundary validation deferred to Phase 4 | ✓        |
| Include bounds check with placeholder pitch | Uses PITCH_HEXES placeholder; needs update in Phase 4                      |          |

**User's choice:** Raw destination only, no bounds check

---

| Option                                 | Description                                                       | Selected |
| -------------------------------------- | ----------------------------------------------------------------- | -------- |
| Fixed mapping matching rulebook v1.4.1 | Hard-coded constant in computeLooseBall(), documented with source | ✓        |
| Mapping as a parameter                 | directionMap as a parameter for flexibility                       |          |
| You decide                             | Leave mapping design to Claude                                    |          |

**User's choice:** Fixed mapping matching rulebook v1.4.1

---

## State Tracking for 4-5-2 Validation

| Option                        | Description                                                     | Selected |
| ----------------------------- | --------------------------------------------------------------- | -------- |
| Extend GameState              | Add movedPieceIds, paceUsedByPieceId, movementSlot to GameState | ✓        |
| Separate MovementContext type | Validators take (state, context) — GameState stays clean        |          |
| Optional embed in GameState   | movementPhase?: { ... } present only during MOVEMENT phase      |          |

**User's choice:** Extend GameState

---

| Option              | Description                                                                   | Selected |
| ------------------- | ----------------------------------------------------------------------------- | -------- |
| Split by domain     | moveValidator.ts, passValidator.ts, etc. — follows hex.ts/hex.test.ts pattern | ✓        |
| Single validator.ts | All validation in one file                                                    |          |
| You decide          | Leave to Claude                                                               |          |

**User's choice:** Split by domain

---

| Option                            | Description                                               | Selected |
| --------------------------------- | --------------------------------------------------------- | -------- |
| 2 hexes flat (≤2 overrides Pace)  | ATTACKER_2 slot hard-capped at 2 hexes regardless of Pace | ✓        |
| min(Pace, 2) — Pace still applies | Same math, Pace is always the cap                         |          |
| Check rulebook                    | Flag as unresolved; default to min(Pace, 2)               |          |

**User's choice:** 2 hexes flat (the ≤2 overrides Pace)

---

| Option                                   | Description                                                       | Selected |
| ---------------------------------------- | ----------------------------------------------------------------- | -------- |
| Multi-step: move incrementally up to cap | validateMove() called per hex step; paceUsedByPieceId accumulates | ✓        |
| Single move to destination               | Player clicks destination; validator checks total distance ≤ Pace |          |

**User's choice:** Multi-step: move incrementally up to cap

---

## Claude's Discretion

- **Dice injection pattern:** Accept dice values as direct parameters is recommended. Claude should verify this fits cleanly across all resolution validator types (pass accuracy, shot/save, heading, handling).
- **Combined score utility shape (DICE-03):** `computeCombinedScore(attribute, diceValue, penalties)` with DICE-04 -2 cap enforcement — Claude decides placement.
- **ZoI utility factoring:** Whether to extend `isUnderZoI()` or add a typed `getZoIDefenders()` variant — keep it DRY.

## Deferred Ideas

- Boundary checking for Loose Ball — deferred to Phase 4 when real PITCH_HEXES data available
- GK dive boundary validation (SHOT-04, goal line position) — deferred to Phase 4 when pitch regions encoded
- Free 6-hex move after final-third action (MOVE-06) — requires pitch region encoding, deferred to Phase 4
