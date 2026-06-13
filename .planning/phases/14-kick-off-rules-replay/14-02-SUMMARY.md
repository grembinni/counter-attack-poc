---
plan: 14-02
phase: 14-kick-off-rules-replay
status: complete
completed: '2026-06-12'
requirements_addressed: [REPLAY-06]
key-files:
  modified:
    - packages/shared/src/types.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.phase8.test.ts
    - packages/server/src/__tests__/replay.integration.test.ts
---

# Plan 14-02 Summary — ballAfter Field on ActionEvent (REPLAY-06)

## What Was Built

**Task 1 — Add `ballAfter` to shared types (commit 5d5b3b2):**
Added `ballAfter: { position: HexCoord; carrierId: string | null }` as a
**required** (not optional) field to the 13 replay-eligible ActionEvent union
members: MOVE, DICE_ROLL, STEAL_ATTEMPT, GOAL, KICK_OFF, HIGH_PASS,
LONG_BALL, STANDARD_PASS, FIRST_TIME_PASS, SHOT_ATTEMPT, SNAPSHOT,
HALF_TIME, FULL_TIME. Non-replay-eligible members (TACKLE_ATTEMPT,
SLOT_ADVANCE, etc.) are unchanged.

**Task 2 — Populate ballAfter at all event-creation sites (commit 0d71ec6):**
Added `ballAfter` to every ActionEvent constructor in `gameEngine.ts` and
`gameHandlers.ts`:

| Site                                                 | ballAfter value                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| MOVE (carrier moving)                                | `{ position: to, carrierId: pieceId }`                          |
| MOVE (loose-ball pickup)                             | `{ position: to, carrierId: pieceId }`                          |
| MOVE (non-carrier, no pickup)                        | `{ position: ball.position, carrierId: ball.carrierId }`        |
| STEAL_ATTEMPT in movement (SUCCESS)                  | `{ position: to, carrierId: defender.id }`                      |
| STEAL_ATTEMPT in movement (FAIL)                     | `{ position: to, carrierId: pieceId }`                          |
| STEAL_ATTEMPT interception (SUCCESS)                 | `{ position: interceptor.position, carrierId: interceptor.id }` |
| STEAL_ATTEMPT interception (FAIL)                    | `{ position: targetHex, carrierId: teammate?.id ?? null }`      |
| LONG_BALL inaccurate                                 | `{ position: targetHex, carrierId: null }`                      |
| STANDARD_PASS / FIRST_TIME_PASS / LONG_BALL accurate | `{ position: targetHex, carrierId: passTeammate?.id ?? null }`  |
| SHOT_ATTEMPT GOAL (all paths)                        | `{ position: kickOffHex, carrierId: null }`                     |
| SHOT_ATTEMPT LOOSE_BALL                              | `{ position: ball.position, carrierId: null }`                  |
| SHOT_ATTEMPT SAVE/LOOSE_BALL                         | `{ position: gkEffectivePos, carrierId: gk.id or null }`        |
| GOAL (inline, all paths)                             | `{ position: kickOffHex, carrierId: null }`                     |
| HIGH_PASS                                            | `{ position: targetHex, carrierId: null }`                      |
| KICK_OFF                                             | `{ position: kickOffHex, carrierId: kicker.id }`                |
| STANDARD_PASS in applyQuickThrow                     | `{ position: targetHex, carrierId: receiver?.id ?? null }`      |

Also updated `buildReplayFrames` to apply ball position universally via
`if ('ballAfter' in event) current = { ...current, ball: event.ballAfter }`
after each event branch, replacing the GOAL-only ball reset.

**Task 3 — Test migrations + REPLAY-06 assertion test (commit 922669f):**

- Migrated 11 event literals in `gameEngine.phase8.test.ts` (KICK_OFF, MOVE,
  GOAL, STEAL_ATTEMPT, DICE_ROLL) to include stub `ballAfter` values.
- Migrated 4 MOVE event literals in `replay.integration.test.ts` to include
  `ballAfter`; fixed null assertion on `room.gameState` argument.
- Added new **REPLAY-06** test: verifies that each replay frame from
  `buildReplayFrames` carries the ball position from the triggering event's
  `ballAfter` field (ball.position and ball.carrierId both correct).

## Verification

- `pnpm --filter @counter-attack/shared build` — clean ✓
- `pnpm --filter @counter-attack/server typecheck` — 0 errors ✓
- `pnpm --filter @counter-attack/server test -- replay` — 6 tests pass (including new REPLAY-06) ✓
- `pnpm --filter @counter-attack/server test -- phase8` — 61 tests pass ✓

## Known Pre-Existing Failures

Several integration tests in `game.integration.test.ts` and `kickoffSetup.integration.test.ts` exhibit intermittent failures (timing/race conditions) that were present before plan 14-02 started. These are not caused by any changes in this plan. Confirmed via `git stash && pnpm test` before changes.

## Deviations

- Added a `passTeammate` lookup before the pass-event construction block (before line 970 in gameEngine.ts) to share the teammate reference between the `passAttemptEvent` and the interception `STEAL_ATTEMPT` events. This avoids duplicating the `state.pieces.find(...)` lookup.

## Self-Check: PASSED
