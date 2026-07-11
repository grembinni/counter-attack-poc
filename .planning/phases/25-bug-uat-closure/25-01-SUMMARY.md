---
phase: 25-bug-uat-closure
plan: '01'
subsystem: replay
tags: [replay, bug-fix, types, regression-tests]
dependency_graph:
  requires: []
  provides: [REPLAY-07, REPLAY-08, BUG-22]
  affects:
    [
      packages/shared/src/types.ts,
      packages/server/src/gameEngine.ts,
      packages/server/src/gameHandlers.ts,
      packages/server/src/__tests__/replay.integration.test.ts,
    ]
tech_stack:
  added: []
  patterns: [ballAfter-field-pattern, REPLAY_ELIGIBLE_TYPES-set]
key_files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/replay.integration.test.ts
    - .planning/REQUIREMENTS.md
decisions:
  - 'Hoist receiver lookup before kickEvent construction in gameHandlers.ts to satisfy exactOptionalPropertyTypes and ensure ballAfter.carrierId is populated at construction time (D-09)'
  - 'Each event type gets its own inline comment in REPLAY_ELIGIBLE_TYPES (D-10); the old incorrect dead-code comment about GK_KICK removed (D-11)'
metrics:
  duration: '13 minutes'
  completed: '2026-07-11'
  tasks_completed: 3
  files_modified: 5
---

# Phase 25 Plan 01: Replay Defect Closure (REPLAY-07, REPLAY-08, BUG-22) Summary

**One-liner:** `ballAfter` field added to GK_KICK and LOOSE_BALL_LAND ActionEvent types, both added to `REPLAY_ELIGIBLE_TYPES` with individual comments, two regression tests added, and BUG-22 documented as closed via Phase 18.2 fix.

## Objective

Close two identical replay visibility defects (REPLAY-07: GK_KICK, REPLAY-08: LOOSE_BALL_LAND) and mark BUG-22 as a documentation-only closure. Both replay events were missing `ballAfter` and excluded from `REPLAY_ELIGIBLE_TYPES`, causing the ball to appear to teleport during post-game replay.

## Tasks Completed

| #   | Name                                                                                  | Commit  | Files                                    |
| --- | ------------------------------------------------------------------------------------- | ------- | ---------------------------------------- |
| 1   | Add ballAfter to GK_KICK + LOOSE_BALL_LAND types and populate both construction sites | 941395b | types.ts, gameHandlers.ts, gameEngine.ts |
| 2   | Add REPLAY-07 and REPLAY-08 regression tests                                          | 106355d | replay.integration.test.ts               |
| 3   | Close BUG-22 in REQUIREMENTS.md (documentation only)                                  | b96f2dc | .planning/REQUIREMENTS.md                |

## Changes Made

### Task 1: Type changes and construction sites

**`packages/shared/src/types.ts`**

- `LOOSE_BALL_LAND` union member expanded from inline single-line to multi-line; `ballAfter: { position: HexCoord; carrierId: string | null }` added as last field.
- `GK_KICK` union member gained `ballAfter: { position: HexCoord; carrierId: string | null }` as last field. Both mirror the existing `HEADED_PASS` member shape exactly.

**`packages/server/src/gameHandlers.ts`**

- `receiver` lookup hoisted before the `kickEvent` object literal (was inside `if (accurate)` branch). Now computed as `accurate ? gkEndState.pieces.find(...) : null`.
- `kickEvent` now carries `ballAfter: { position: targetHex, carrierId: accurate ? (receiver?.id ?? null) : null }`.

**`packages/server/src/gameEngine.ts`**

- `looseBallLandEvent` now carries `ballAfter: { position: finalPosition, carrierId: finalCarrierId }` using the already-resolved final landing position and carrier.
- `REPLAY_ELIGIBLE_TYPES` gains `'GK_KICK'` (with REPLAY-07 comment) and `'LOOSE_BALL_LAND'` (with REPLAY-08 comment), each preceded by its own inline comment.
- The incorrect "dead code / zero construction sites" comment about GK_KICK was removed.

### Task 2: Regression tests

Two new `it(...)` cases added to `replay.integration.test.ts` after REPLAY-06:

- **REPLAY-07**: Seeds an eventLog with a GK_KICK (`accurate: true`, `ballAfter: { position: kickTarget, carrierId: receiver.id }`) followed by a MOVE; asserts `buildReplayFrames` produces a frame where `ball` deep-equals `{ position: kickTarget, carrierId: receiver.id }`.
- **REPLAY-08**: Seeds with a LOOSE_BALL_LAND (`ballAfter: { position: landHex, carrierId: null }`) followed by a MOVE; asserts the frame ball equals `{ position: landHex, carrierId: null }`.

### Task 3: BUG-22 documentation closure

- BUG-22 checkbox changed from `[ ]` to `[x]` with pointer to Phase 18.2 fix: `carrierExclusionKey: 'highPassCarrierId'` at `gameHandlers.ts:405`, covered by `gameHandlers.phase18-02.test.ts`.
- Traceability table row updated from `Pending` to `Complete` with fix location note.

## Verification

- `pnpm --filter @counter-attack/server test`: 535 tests pass (27 test files), including 2 new REPLAY-07 and REPLAY-08 regression tests. 1 skipped, 1 todo (pre-existing).
- `npx tsc --noEmit` in `packages/server`: exits 0, no errors.
- REQUIREMENTS.md BUG-22 marked `[x]` with Phase 18.2 fix pointer.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all `ballAfter` fields carry concrete resolved values. No placeholder data flows to replay frames.

## Threat Flags

None — `ballAfter` is server-constructed from already-validated game state with no user-supplied input (T-25-01 accepted per threat model).

## Self-Check: PASSED

- `941395b` commit exists: yes (feat(25-01))
- `106355d` commit exists: yes (test(25-01))
- `b96f2dc` commit exists: yes (docs(25-01))
- REQUIREMENTS.md BUG-22 `[x]`: confirmed
- REQUIREMENTS.md BUG-22 Traceability row `Complete`: confirmed
- 535 tests pass including REPLAY-07 and REPLAY-08: confirmed
