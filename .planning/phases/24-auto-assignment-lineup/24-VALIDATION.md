---
phase: 24
slug: auto-assignment-lineup
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-10
completed: 2026-07-10
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                    |
| ---------------------- | -------------------------------------------------------- |
| **Framework**          | Vitest (server)                                          |
| **Config file**        | `packages/server/vitest.config.ts`                       |
| **Quick run command**  | `pnpm --filter @counter-attack/server run test -- --run` |
| **Full suite command** | `pnpm --filter @counter-attack/server run test -- --run` |
| **Estimated runtime**  | ~15 seconds                                              |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/server run test -- --run`
- **After every plan wave:** Run `pnpm --filter @counter-attack/server run test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green (506+ tests)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement     | Threat Ref | Secure Behavior                                                           | Test Type        | Automated Command                                                                                           | File Exists | Status   |
| -------- | ---- | ---- | --------------- | ---------- | ------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- | ----------- | -------- |
| 24-W0-01 | 01   | 0    | ASSIGN-01       | —          | N/A                                                                       | unit stub        | `pnpm --filter @counter-attack/server run test -- --run src/__tests__/gameEngine.phase24.test.ts`           | ✅          | ✅ green |
| 24-W0-02 | 01   | 0    | ASSIGN-03,04,05 | T-24-01    | LINEUP_SWAP rejects slotIndex=0                                           | integration stub | `pnpm --filter @counter-attack/server run test -- --run src/__tests__/lineupAssignment.integration.test.ts` | ✅          | ✅ green |
| 24-01-01 | 01   | 1    | ASSIGN-01       | —          | computeAutoAssignment fills GK first, then anchors, then flex             | unit             | `pnpm --filter @counter-attack/server run test -- --run src/__tests__/gameEngine.phase24.test.ts`           | ✅          | ✅ green |
| 24-01-02 | 01   | 1    | ASSIGN-01       | —          | scoreForRole returns correct numeric result per SlotRole                  | unit             | same file                                                                                                   | ✅          | ✅ green |
| 24-01-03 | 01   | 1    | ASSIGN-01       | —          | Tie-breaking prefers lower source-team index                              | unit             | same file                                                                                                   | ✅          | ✅ green |
| 24-02-01 | 02   | 1    | ASSIGN-02       | T-24-02    | LINEUP_SWAP rejects slotIndexA=0 or slotIndexB=0                          | integration      | `pnpm --filter @counter-attack/server run test -- --run src/__tests__/lineupAssignment.integration.test.ts` | ✅          | ✅ green |
| 24-02-02 | 02   | 1    | ASSIGN-03       | T-24-03    | LINEUP_SWAP swaps valid outfield slots and emits update to requester only | integration      | same file                                                                                                   | ✅          | ✅ green |
| 24-02-03 | 02   | 1    | ASSIGN-04       | T-24-01    | LINEUP_SWAP with slotIndexA=0 → GAME_ERROR('GK_SLOT_LOCKED')              | integration      | same file                                                                                                   | ✅          | ✅ green |
| 24-02-04 | 02   | 2    | ASSIGN-05       | T-24-04    | Both LINEUP_CONFIRM → GAME_STATE broadcast; single confirm does not       | integration      | same file                                                                                                   | ✅          | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `packages/server/src/__tests__/gameEngine.phase24.test.ts` — 18 unit tests for `computeAutoAssignment` and `scoreForRole` — **GREEN**
- [x] `packages/server/src/__tests__/lineupAssignment.integration.test.ts` — 9 integration tests covering ASSIGN-02/03/04/05, T-24-01/02 — **GREEN**

_Full suite: 533 passed, 0 failed (2026-07-10)._

---

## Manual-Only Verifications

| Behavior                                                       | Requirement | Why Manual                                                   | Test Instructions                                                                                            |
| -------------------------------------------------------------- | ----------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Lineup screen renders with correct player names in each slot   | ASSIGN-02   | React component rendering — not covered by server unit tests | Open two browser tabs, both confirm formation; verify lineup display shows all 11 players correctly assigned |
| Drag-and-drop swap updates UI in real time                     | ASSIGN-03   | HTML5 D&D requires browser interaction                       | Drag a slot to another, verify visual swap and server confirmation                                           |
| Confirm button disabled until player interacts (if applicable) | ASSIGN-02   | UI state validation                                          | Check confirm button is enabled only after page loads                                                        |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s (full suite ~6s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-07-10 — 533 tests passed, 0 failed; browser UAT approved
