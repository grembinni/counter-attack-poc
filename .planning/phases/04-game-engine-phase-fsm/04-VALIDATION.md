---
phase: 4
slug: 04-game-engine-phase-fsm
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9                                                                             |
| **Config file**        | `packages/shared/vitest.config.ts` / `packages/server/vitest.config.ts`                  |
| **Quick run command**  | `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test` |
| **Full suite command** | `pnpm -r test`                                                                           |
| **Estimated runtime**  | ~15 seconds                                                                              |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test`
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement                | Threat Ref             | Secure Behavior                                            | Test Type   | Automated Command                                                                  | File Exists | Status     |
| ------- | ---- | ---- | -------------------------- | ---------------------- | ---------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- | ----------- | ---------- |
| 4-01-01 | 01   | 1    | TEAM-01, TEAM-02           | —                      | N/A                                                        | unit        | `pnpm --filter @counter-attack/shared test src/teams.test.ts`                      | ❌ W0       | ⬜ pending |
| 4-01-02 | 01   | 1    | PITCH-02, PITCH-03         | —                      | N/A                                                        | unit        | `pnpm --filter @counter-attack/shared test src/pitch.test.ts`                      | ❌ W0       | ⬜ pending |
| 4-01-03 | 01   | 1    | TEAM-01, TEAM-02, PITCH-01 | —                      | N/A                                                        | unit        | `pnpm --filter @counter-attack/shared test`                                        | ✅          | ⬜ pending |
| 4-02-01 | 02   | 2    | TEAM-03                    | —                      | Referee card assigned at start                             | unit        | `pnpm --filter @counter-attack/server test src/__tests__/gameEngine.test.ts`       | ❌ W0       | ⬜ pending |
| 4-02-02 | 02   | 2    | MOVE-01, MOVE-02, MOVE-03  | Spoofing/Tampering     | Only active player can move; pieces from own team only     | unit        | `pnpm --filter @counter-attack/server test src/__tests__/gameEngine.test.ts`       | ❌ W0       | ⬜ pending |
| 4-02-03 | 02   | 2    | MOVE-04, MOVE-05, MOVE-06  | Tampering              | Steal resolution uses stub dice only; no client randomness | unit        | `pnpm --filter @counter-attack/server test src/__tests__/gameEngine.test.ts`       | ❌ W0       | ⬜ pending |
| 4-03-01 | 03   | 3    | MOVE-01, FSM               | Elevation of Privilege | game:end-turn rejected if wrong player                     | integration | `pnpm --filter @counter-attack/server test src/__tests__/game.integration.test.ts` | ❌ W0       | ⬜ pending |
| 4-03-02 | 03   | 3    | UNDO-01, UNDO-02           | —                      | game:undo blocked after SLOT_ADVANCE                       | integration | same                                                                               | ❌ W0       | ⬜ pending |
| 4-03-03 | 03   | 3    | SC-5 (isProcessing)        | Tampering              | Duplicate action silently dropped                          | integration | same                                                                               | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/shared/src/teams.test.ts` — stubs for TEAM-01, TEAM-02
- [ ] `packages/shared/src/pitch.test.ts` — stubs for PITCH-02, PITCH-03
- [ ] `packages/server/src/__tests__/gameEngine.test.ts` — stubs for TEAM-03, isProcessing, applyMove, applyEndTurn, applyUndo unit tests
- [ ] `packages/server/src/__tests__/game.integration.test.ts` — stubs for MOVE-01 through MOVE-06, FSM sequencing, D-09/D-10 undo at wire level

---

## Manual-Only Verifications

| Behavior                            | Requirement        | Why Manual                                        | Test Instructions                                                                                           |
| ----------------------------------- | ------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Pitch region approximation accuracy | PITCH-02, PITCH-03 | Placeholder grid, not physical board — hard block | Visually compare region boundaries in Phase 6 renderer against physical board photo                         |
| MOVE-06 free-move sequence UX       | MOVE-06            | Client rendering deferred to Phase 6/7            | In Phase 7 integration: trigger ball crossing final third; verify free-move prompt appears for correct team |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
