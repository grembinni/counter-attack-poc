---
phase: 7
slug: client-server-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                            |
| ---------------------- | ------------------------------------------------ |
| **Framework**          | Vitest 2.1.9                                     |
| **Config file**        | packages/client/vite.config.ts (vitest inferred) |
| **Quick run command**  | `pnpm --filter @counter-attack/client test`      |
| **Full suite command** | `pnpm -r test`                                   |
| **Estimated runtime**  | ~10 seconds                                      |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/client test`
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan               | Wave | Requirement | Threat Ref | Secure Behavior     | Test Type     | Automated Command                                                                 | File Exists | Status     |
| -------- | ------------------ | ---- | ----------- | ---------- | ------------------- | ------------- | --------------------------------------------------------------------------------- | ----------- | ---------- |
| 07-xx-01 | Socket init        | 1    | —           | —          | N/A                 | unit          | `pnpm --filter @counter-attack/client test`                                       | ❌ W0       | ⬜ pending |
| 07-xx-02 | UNDO-01 emit       | 1    | UNDO-01     | —          | Active player only  | unit          | `pnpm --filter @counter-attack/client test -- --testNamePattern="emitUndo"`       | ❌ W0       | ⬜ pending |
| 07-xx-03 | UNDO-02 gate       | 1    | UNDO-02     | —          | Disabled after dice | unit          | `pnpm --filter @counter-attack/client test -- --testNamePattern="undo.*disabled"` | ❌ W0       | ⬜ pending |
| 07-xx-04 | UNDO-03 visibility | 1    | UNDO-03     | —          | Hidden for opponent | unit          | `pnpm --filter @counter-attack/client test -- --testNamePattern="playerSlot"`     | ❌ W0       | ⬜ pending |
| 07-xx-05 | UNDO-04 server     | 2    | UNDO-04     | —          | N/A                 | unit (server) | `pnpm --filter @counter-attack/server test -- --testNamePattern="applyUndo"`      | ✅ exists   | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/client/src/store/useGameStore.test.ts` — extend with: `setGameState` action, `playerSlot`/`roomCode` setters, `emitMove` replaces `movePiece`, undo gating logic (UNDO-01, UNDO-02, UNDO-03)
- [ ] `packages/client/src/components/ActionPanel.test.tsx` — new file; tests for: Undo button visibility by playerSlot, Undo disabled when lastDiceRoll set, Roll button visibility by phase

_Use `vi.fn()` mocked socket — do not require a live server for unit tests._

---

## Manual-Only Verifications

| Behavior                                                     | Requirement       | Why Manual                               | Test Instructions                                                                                      |
| ------------------------------------------------------------ | ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Two-tab live session: board updates identically in both tabs | Phase 7 Goal SC-1 | Requires live browser + Socket.io server | Open two tabs, create room in tab 1, join in tab 2; make a move in tab 1 and verify both boards update |
| Connection status indicator transitions (green→yellow→red)   | Phase 7 Goal SC-4 | Requires network manipulation            | In DevTools, toggle network offline; verify indicator turns red within the grace window                |
| Opponent disconnect banner                                   | Phase 7 Goal SC-4 | Requires two-tab session + kill opponent | Open two tabs; kill one tab's connection; verify banner appears in the other within grace period       |
| Full flow: lobby → match → move → pass → shoot               | Phase 7 Goal SC-5 | Requires full two-player session         | Play a complete mini-game through all phases without server restart                                    |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
