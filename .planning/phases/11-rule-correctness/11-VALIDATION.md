---
phase: 11
slug: rule-correctness
status: complete
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
audited: 2026-06-12
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | vitest 2.1.9 (server) + vitest 2.1.9 / jsdom (client)                                                                                    |
| **Server config**      | `packages/server/vitest.config.ts`                                                                                                       |
| **Client config**      | `packages/client/vitest.config.ts`                                                                                                       |
| **Server run command** | `pnpm --filter @counter-attack/server exec vitest run`                                                                                   |
| **Client run command** | `pnpm --filter @counter-attack/client exec vitest run`                                                                                   |
| **Rule11 server**      | `pnpm --filter @counter-attack/server exec vitest run src/__tests__/gameEngine.rule11.test.ts src/__tests__/gameHandlers.rule11.test.ts` |
| **Rule11 client**      | `pnpm --filter @counter-attack/client exec vitest run src/store/useGameStore.rule11.test.ts`                                             |
| **Estimated runtime**  | ~5 seconds (rule11 suite only)                                                                                                           |

---

## Sampling Rate

- **After every task commit:** Run rule11 suites
- **After every plan wave:** Run full server + client suites
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan  | Wave | Requirement | Test File                                        | Test Description                                                                            | Status    |
| -------- | ----- | ---- | ----------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- | --------- |
| 11-01-T1 | 11-01 | 1    | RULE-01     | gameEngine.rule11.test.ts                        | HIGH_PASS accurate roll sets headerAccuracyRollPending                                      | ✅ green  |
| 11-01-T1 | 11-01 | 1    | RULE-01     | gameEngine.rule11.test.ts                        | HIGH_PASS accurate roll preserves headerContestants                                         | ✅ green  |
| 11-01-T2 | 11-01 | 1    | RULE-02     | gameEngine.rule11.test.ts                        | applyResolveHeaderTarget WRONG_PHASE guard (×2)                                             | ✅ green  |
| 11-01-T2 | 11-01 | 1    | RULE-02     | gameEngine.rule11.test.ts                        | DUEL_NOT_RESOLVED guard (×2)                                                                | ✅ green  |
| 11-01-T2 | 11-01 | 1    | RULE-02     | gameEngine.rule11.test.ts                        | Valid resolve — phase, ball, attackingTeam, headerCleared (×6)                              | ✅ green  |
| 11-01-T2 | 11-01 | 1    | RULE-02     | gameEngine.rule11.test.ts                        | OUT_OF_RANGE (×2) + GK_DIVING route (×1)                                                    | ✅ green  |
| 11-01-T3 | 11-01 | 1    | RULE-01     | gameHandlers.rule11.test.ts                      | ACK clears pending (attacker), WRONG_TEAM (non-attacker), WRONG_PHASE, state unchanged (×4) | ✅ green  |
| 11-01-T3 | 11-01 | 1    | RULE-02     | gameHandlers.rule11.test.ts                      | Auto-duel on both-confirmed, single broadcast (×2)                                          | ✅ green  |
| 11-01-T3 | 11-01 | 1    | RULE-02     | gameHandlers.rule11.test.ts                      | Winner guard: home wins, away loses, null tie (×3)                                          | ✅ green  |
| 11-02-T1 | 11-02 | 1    | RULE-03     | gameEngine.rule11.test.ts                        | SHOT LOOSE_BALL tie → lastShotPath null                                                     | ✅ green  |
| 11-02-T1 | 11-02 | 1    | RULE-03     | gameEngine.rule11.test.ts                        | SHOT save-dropped → lastShotPath null                                                       | ✅ green  |
| 11-02-T1 | 11-02 | 1    | RULE-03     | gameEngine.rule11.test.ts                        | LOOSE_BALL scatter → PASS lastShotPath null                                                 | ✅ green  |
| 11-02-T1 | 11-02 | 1    | RULE-03     | gameEngine.rule11.test.ts                        | GOAL branch + save-caught regression guards (×2)                                            | ✅ green  |
| 11-03-T1 | 11-03 | 2    | RULE-01     | — (store action exists; ActionPanel gate manual) | emitHeaderAccuracyAck action wired to socket.emit                                           | ⚠️ manual |
| 11-03-T2 | 11-03 | 2    | RULE-04     | useGameStore.rule11.test.ts                      | selectPiece returns [] when snapDeflectPaceUsed === 2                                       | ✅ green  |
| 11-03-T2 | 11-03 | 2    | RULE-04     | useGameStore.rule11.test.ts                      | selectPiece returns non-empty when snapDeflectPaceUsed === 0                                | ✅ green  |
| 11-03-T2 | 11-03 | 2    | RULE-04     | — (HexGrid component gate manual)                | canSelectSnapDeflect renders no outline at pace=2                                           | ⚠️ manual |
| 11-03-T3 | 11-03 | 2    | RULE-05     | useGameStore.rule11.test.ts                      | Home pieces selectable in ATTACKER_4 after deflect                                          | ✅ green  |
| 11-03-T3 | 11-03 | 2    | RULE-05     | useGameStore.rule11.test.ts                      | Away pieces selectable in DEFENDER_5                                                        | ✅ green  |
| 11-03-T3 | 11-03 | 2    | RULE-05     | useGameStore.rule11.test.ts                      | DEFENDER_5 state: activeTeam is away                                                        | ✅ green  |
| 11-04-T1 | 11-04 | 2    | RULE-02     | gameHandlers.rule11.test.ts                      | Header tie → LOOSE_BALL recovery (CR-02, deterministic)                                     | ✅ green  |
| 11-04-T2 | 11-04 | 2    | RULE-02     | gameEngine.rule11.test.ts                        | Distance-7 unconditional INVALID_TARGET assertion                                           | ✅ green  |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ manual/flaky_

**Test counts:** 30 server tests + 5 client tests = **35 tests, all passing**

---

## Wave 0 Requirements

Wave 0 was not applied — tests were created as part of plan execution (not before). All test files are created within plan tasks (P11-01 creates gameEngine/gameHandlers.rule11.test.ts; P11-03 creates useGameStore.rule11.test.ts). This is the historical record; no retroactive Wave 0 action required.

---

## Manual-Only Verifications

| Behavior                                                                                                                    | Requirement             | Why Manual                                                                                                                                                               | Test Instructions                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ActionPanel renders attacker-only Continue button when `headerAccuracyRollPending: true`; non-attacker sees waiting message | RULE-01 (client)        | Skipped: automatable via @testing-library/react but user chose to skip. Store action `emitHeaderAccuracyAck` exists and is called on Continue click.                     | Mount ActionPanel with `headerAccuracyRollPending: true` + `playerSlot=1` (attacker). Verify Continue button visible. Swap to `playerSlot=2`. Verify waiting message shown instead. |
| HexGrid renders no selectable outline on deflecting piece at pace=2                                                         | RULE-04 (client visual) | Skipped: automatable via @testing-library/react but user chose to skip. Store-level contract (empty validMoveHexes at pace=2) is covered by useGameStore.rule11.test.ts. | In a live SNAP_DEFLECT game, move deflecting piece twice. Verify piece no longer shows blue selectable ring.                                                                        |
| Accuracy roll shown before contestant selection UI appears                                                                  | RULE-01 (live)          | Requires live 2-player game session                                                                                                                                      | Start a High Pass; verify roll result displays and no contestant selection until Continue is clicked                                                                                |
| Header duel fires automatically when both confirm; winner selects target                                                    | RULE-02 (live)          | Requires live 2-player game session                                                                                                                                      | Select contestants as both teams; verify duel auto-fires and winning team's target selection appears                                                                                |
| Shot-path hexes clear after snapshot resolves                                                                               | RULE-03 (visual)        | Visual board state                                                                                                                                                       | Fire a snapshot; verify path hexes clear before Movement Phase begins                                                                                                               |
| Both teams' pieces selectable after deflect → LOOSE_BALL → MOVEMENT                                                         | RULE-05 (live)          | Requires game flow to reach this state                                                                                                                                   | Trigger snapshot deflect into loose ball; enter Movement Phase; verify all eligible pieces for both teams are clickable                                                             |

---

## Validation Sign-Off

- [x] All tasks have automated verify or documented Manual-Only reason
- [ ] Wave 0 applied before execution (not done — tests created during execution)
- [x] Sampling continuity: all rule11 tests run in < 5s
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [ ] `nyquist_compliant: true` — 2 manual-only gaps prevent full compliance

**Approval:** partial — 33/35 automatable tasks covered; 2 marked manual-only by user choice (2026-06-12)

---

## Validation Audit 2026-06-12

| Metric               | Count |
| -------------------- | ----- |
| Gaps found           | 2     |
| Resolved (automated) | 0     |
| Marked manual-only   | 2     |
| Tests passing        | 35/35 |
