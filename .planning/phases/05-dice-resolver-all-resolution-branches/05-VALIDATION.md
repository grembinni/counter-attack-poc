---
phase: 5
slug: dice-resolver-all-resolution-branches
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9                                                                             |
| **Config file**        | Per-package (no root vitest.config.ts)                                                   |
| **Quick run command**  | `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test` |
| **Full suite command** | `pnpm test`                                                                              |
| **Estimated runtime**  | ~15 seconds                                                                              |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior                                                  | Test Type          | Automated Command                           | File Exists                          | Status     |
| -------- | ---- | ---- | ----------- | ---------- | ---------------------------------------------------------------- | ------------------ | ------------------------------------------- | ------------------------------------ | ---------- |
| 05-01-01 | 01   | 1    | DICE-01     | —          | N/A                                                              | unit               | `pnpm --filter @counter-attack/shared test` | ✅ types.ts (modify)                 | ⬜ pending |
| 05-01-02 | 01   | 1    | DICE-01     | —          | N/A                                                              | unit               | `pnpm --filter @counter-attack/shared test` | ✅ teams.test.ts (update)            | ⬜ pending |
| 05-02-01 | 02   | 2    | DICE-01     | V6         | crypto.randomInt only; no Math.random                            | unit               | `pnpm --filter @counter-attack/server test` | ❌ W0 diceUtils.test.ts              | ⬜ pending |
| 05-02-02 | 02   | 2    | DICE-02     | V4         | game:roll rejected if wrong team/phase                           | unit + integration | `pnpm --filter @counter-attack/server test` | ✅ gameEngine.test.ts (extend)       | ⬜ pending |
| 05-03-01 | 03   | 3    | SHOT-05     | V4,V5      | game:gk-restart rejected if not GK team; invalid choice rejected | unit + integration | `pnpm --filter @counter-attack/server test` | ✅ game.integration.test.ts (extend) | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/server/src/__tests__/diceUtils.test.ts` — unit tests for `rollDice()`: returns 1–6 integer; at least 3 distinct values across 20 rolls
- [ ] Extend `packages/server/src/__tests__/gameEngine.test.ts` — applyRoll happy paths (PASS, SHOT, HEADER, LOOSE_BALL), applyGKRestart (kick/throw/movement), phase guard rejections, D-13 tie→LOOSE_BALL
- [ ] Update `packages/shared/src/shotValidator.test.ts` — change tie test from SAVE to LOOSE_BALL per D-13
- [ ] Update `packages/shared/src/teams.test.ts` — add 'highPass' to ATTRIBUTES array; allow aerialAbility:0 and handling:0 for non-GK roles
- [ ] Extend `packages/server/src/__tests__/game.integration.test.ts` — game:roll in PASS phase → game:state received; game:gk-restart each choice → correct phase transition

---

## Manual-Only Verifications

| Behavior                                                  | Requirement | Why Manual                                      | Test Instructions                                                                        |
| --------------------------------------------------------- | ----------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| lastDiceRoll visible in both clients before board updates | DICE-02     | Requires two browser tabs and visual inspection | Open two tabs, trigger game:roll, verify dice values appear in both before board changes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
