---
phase: 11
slug: rule-correctness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                              |
| ---------------------- | ---------------------------------- |
| **Framework**          | vitest 2.1.9                       |
| **Config file**        | `packages/server/vitest.config.ts` |
| **Quick run command**  | `pnpm --filter server test`        |
| **Full suite command** | `pnpm --filter server test`        |
| **Estimated runtime**  | ~10 seconds                        |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter server test`
- **After every plan wave:** Run `pnpm --filter server test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command           | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ---------- | --------------- | --------- | --------------------------- | ----------- | ---------- |
| 11-01-01 | TBD  | 1    | RULE-01     | —          | N/A             | unit      | `pnpm --filter server test` | ✅          | ⬜ pending |
| 11-01-02 | TBD  | 1    | RULE-02     | —          | N/A             | unit      | `pnpm --filter server test` | ✅          | ⬜ pending |
| 11-01-03 | TBD  | 1    | RULE-03     | —          | N/A             | unit      | `pnpm --filter server test` | ✅          | ⬜ pending |
| 11-01-04 | TBD  | 1    | RULE-04     | —          | N/A             | unit      | `pnpm --filter server test` | ✅          | ⬜ pending |
| 11-01-05 | TBD  | 1    | RULE-05     | —          | N/A             | unit      | `pnpm --filter server test` | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior                                                                 | Requirement | Why Manual                             | Test Instructions                                                                                                       |
| ------------------------------------------------------------------------ | ----------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Accuracy roll shown before contestant selection UI appears               | RULE-01     | Requires live 2-player game session    | Start a High Pass; verify roll result displays and no contestant selection until acknowledged                           |
| Header duel fires automatically when both confirm; winner selects target | RULE-02     | Requires live 2-player game session    | Select contestants as both teams; verify duel auto-fires and winning team's target selection appears                    |
| Shot-path hexes clear after snapshot resolves                            | RULE-03     | Visual board state                     | Fire a snapshot; verify path hexes clear before Movement Phase begins                                                   |
| No move highlights after 2 deflection pace used                          | RULE-04     | Live SNAP_DEFLECT state                | Deflect twice; verify piece is no longer highlighted as selectable                                                      |
| Both teams' pieces selectable after deflect → LOOSE_BALL → MOVEMENT      | RULE-05     | Requires game flow to reach this state | Trigger snapshot deflect into loose ball; enter Movement Phase; verify all eligible pieces for both teams are clickable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
