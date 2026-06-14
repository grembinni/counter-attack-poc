---
phase: 17
slug: rule-bugs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest                                                                                                                                                  |
| **Config file**        | `packages/server/vitest.config.ts`                                                                                                                      |
| **Quick run command**  | `pnpm --filter @counter-attack/server test --run`                                                                                                       |
| **Full suite command** | `pnpm --filter @counter-attack/server test --run && pnpm --filter @counter-attack/client test --run && pnpm --filter @counter-attack/shared test --run` |
| **Estimated runtime**  | ~30 seconds                                                                                                                                             |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/server test --run`
- **After every plan wave:** Run full suite (server + client + shared)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID   | Req     | Test Type   | Behavior                                                                                       | Automated Command                                              | File Exists             | Status     |
| --------- | ------- | ----------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------- | ---------- |
| 17-BUG01  | BUG-01  | unit        | `applyRoll` skips interception loop when `lastActionType === 'HEADER'`                         | `pnpm --filter @counter-attack/server test --run gameEngine`   | ✅ `gameEngine.test.ts` | ⬜ pending |
| 17-BUG02a | BUG-02  | unit        | `applyCancelMovement` returns ok when no pieces moved; errors when pieces moved                | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ W0                   | ⬜ pending |
| 17-BUG02b | BUG-02  | integration | `game:cancel_movement` socket handler reverts state to PASS phase                              | `pnpm --filter @counter-attack/server test --run gameHandlers` | ❌ W0                   | ⬜ pending |
| 17-BUG03  | BUG-03  | unit        | `applyUndo` works in HIGH_PASS_MOVEMENT phase (same slot-boundary logic)                       | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ W0                   | ⬜ pending |
| 17-BUG04a | BUG-04  | unit        | Pass to defender hex transfers possession to defending team                                    | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ W0                   | ⬜ pending |
| 17-BUG04b | BUG-04  | unit        | Pass to teammate hex on occupied target → ball pickup by that player                           | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ W0                   | ⬜ pending |
| 17-BUG05  | BUG-05  | unit        | Save → LOOSE_BALL branch places ball at GK position (not shot origin)                          | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ W0                   | ⬜ pending |
| 17-MOV06a | MOVE-06 | unit        | `applyEndTurn` transitions to FREE_MOVE when `pendingFreeMove` set and eligible players exist  | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ W0                   | ⬜ pending |
| 17-MOV06b | MOVE-06 | unit        | `applyEndTurn` skips FREE_MOVE (→ PASS directly) when no eligible players in final third       | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ W0                   | ⬜ pending |
| 17-PAS02a | PASS-02 | unit        | FIRST_TIME_PASS delivery enters attacker 1-hex step, then transitions to SNAP_DEFLECT          | `pnpm --filter @counter-attack/server test --run gameEngine`   | ❌ W0                   | ⬜ pending |
| 17-PAS02b | PASS-02 | unit        | SNAP_DEFLECT with `lastActionType='FIRST_TIME_PASS'` resolves as pass delivery (not shot duel) | `pnpm --filter @counter-attack/server test --run gameHandlers` | ❌ W0                   | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/server/src/__tests__/gameEngine.phase17.test.ts` — unit tests for all 7 engine fixes (BUG-01 through BUG-05, MOVE-06, PASS-02 engine layer)
- [ ] `packages/server/src/__tests__/gameHandlers.phase17.test.ts` — integration tests for new socket events (`game:cancel_movement`) and SNAP_DEFLECT PASS-02 resolution

_Existing `gameEngine.test.ts` has BUG-01 coverage; Wave 0 adds the remaining 10 test cases._

---

## Manual-Only Verifications

| Behavior                                                                | Requirement | Why Manual           | Test Instructions                                                           |
| ----------------------------------------------------------------------- | ----------- | -------------------- | --------------------------------------------------------------------------- |
| Cancel button appears only before first move in MOVEMENT phase          | BUG-02      | Client UI visibility | Start MOVEMENT, verify Cancel shows; move one piece, verify Cancel hides    |
| Undo button appears in HIGH_PASS_MOVEMENT phase                         | BUG-03      | Client UI visibility | Enter HIGH_PASS_MOVEMENT, verify Undo button is visible in ActionPanel      |
| FREE_MOVE ActionPanel shows "Free Move — move up to 6 hexes per player" | MOVE-06     | Client UI copy       | Trigger FREE_MOVE phase, inspect ActionPanel render                         |
| Pass path highlighted during PASS-02 attacker step and SNAP_DEFLECT     | PASS-02     | Visual highlight     | Execute FIRST_TIME_PASS, observe path highlight persists through both steps |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
