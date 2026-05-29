---
plan: 02-04
phase: 02-move-validator-unit-tests
status: complete
started: 2026-05-29
completed: 2026-05-29
key-files:
  created:
    - packages/shared/src/shotValidator.ts
    - packages/shared/src/shotValidator.test.ts
    - packages/shared/src/headingValidator.ts
    - packages/shared/src/headingValidator.test.ts
    - packages/shared/src/snapshotValidator.ts
    - packages/shared/src/snapshotValidator.test.ts
  modified: []
self-check: PASSED
---

# Plan 02-04 Summary: Shot, Heading, and Snapshot Validators

## What Was Built

Three domain validators completing the Phase 2 suite.

## Result Type Shapes

```typescript
// Shot duel (SHOT-01, SHOT-03)
type ShotDuelResult =
  | { outcome: 'GOAL' }
  | { outcome: 'MISS'; reason: 'AUTO_MISS' }
  | { outcome: 'SAVE'; needsHandlingCheck: true };

// GK dive (SHOT-04)
type DiveResult =
  | { saveable: true; savingPenalty: number }
  | { saveable: false; reason: 'OUT_OF_RANGE' };

// Handling check (SHOT-06)
type HandlingResult = { caught: true } | { caught: false; triggerLooseBall: true };

// Heading duel (HEAD-01..05)
type HeadingResult =
  | { ok: false; reason: 'OUT_OF_RANGE' | 'CONSECUTIVE_HEADER' }
  | { ok: true; contested: false }
  | { ok: true; contested: true; penaltyModifier: number; excludedPieceIds: string[] };

// Snapshot trigger (SNAP-01..03)
type SnapshotResult =
  | { ok: false; reason: 'WRONG_PHASE' }
  | { ok: true; shootingPenalty: -1; deflectionEffect: { type: 'OPPONENT_MOVES'; maxHexes: 2 } };
```

## HEAD-03 Wiring (aimedAtGoal)

Included `aimedAtGoal?: boolean` in `HeadingOptions` type. validateHeading does not change its result based on this flag — Phase 4 FSM uses it to involve the GK. Documented as a TODO in JSDoc citing CONTEXT.md.

## SHOT-02 Handling

Implemented `getOutsideAreaModifiers()` helper returning `{ shootingPenalty: -1, gkMayMoveOneHex: true }`. Phase 4 FSM calls this after boundary detection; the deferral is documented in the shotValidator.ts JSDoc.

## Cumulative Phase 2 Test Count

| Plan | Module | Tests |
|------|--------|-------|
| 02-01 | hex (extensions) + scoreUtils | 37 |
| 02-02 | moveValidator | 12 |
| 02-03 | passValidator + passAccuracy | 19 |
| 02-04 | shotValidator + headingValidator + snapshotValidator | 13 + 7 + 4 = 24 |
| **Total** | | **92** |

All 92 tests pass. Full shared package build GREEN after Wave 2 completion.

## index.ts

NOT modified. All three export lines were pre-registered in Plan 02-01.

## Commits

- `test(02-04)`: add failing tests for shot, heading, and snapshot validators (RED)
- `feat(02-04)`: implement shotValidator, headingValidator, snapshotValidator (GREEN)
