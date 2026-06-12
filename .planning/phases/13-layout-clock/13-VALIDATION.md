---
phase: 13
slug: layout-clock
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                             |
| ---------------------- | ------------------------------------------------- |
| **Framework**          | Vitest (jsdom environment)                        |
| **Config file**        | `packages/client/vitest.config.ts`                |
| **Quick run command**  | `pnpm --filter @counter-attack/client test --run` |
| **Full suite command** | `pnpm --filter @counter-attack/client test --run` |
| **Estimated runtime**  | ~15 seconds                                       |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/client test --run`
- **After every plan wave:** Run `pnpm --filter @counter-attack/client test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan   | Wave | Requirement                              | Threat Ref | Secure Behavior | Test Type | Automated Command                                              | File Exists | Status     |
| -------- | ------ | ---- | ---------------------------------------- | ---------- | --------------- | --------- | -------------------------------------------------------------- | ----------- | ---------- |
| 13-W0-01 | Wave 0 | 0    | LAYOUT-01, LAYOUT-02, CLOCK-01, CLOCK-02 | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test --run -- GameBoard` | ❌ W0       | ⬜ pending |
| 13-01    | 01     | 1    | LAYOUT-01, CLOCK-01, CLOCK-02            | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test --run -- GameBoard` | ❌ W0       | ⬜ pending |
| 13-02    | 01/02  | 1    | LAYOUT-02                                | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test --run -- GameBoard` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/client/src/components/GameBoard.test.tsx` — stubs/tests for LAYOUT-01, LAYOUT-02, CLOCK-01, CLOCK-02

_Wave 0 must create the GameBoard test file before implementation begins._

---

## Manual-Only Verifications

| Behavior                                    | Requirement          | Why Manual                                      | Test Instructions                                                                                                                                              |
| ------------------------------------------- | -------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top band renders correctly at 1080p desktop | LAYOUT-01, LAYOUT-02 | Visual layout cannot be fully verified in jsdom | Launch `pnpm --filter @counter-attack/client dev`, open two browser tabs, join same room; verify top band has scoreboard + action section visible at all times |
| Clock displays during HALF_TIME overlay     | CLOCK-02             | jsdom doesn't render CSS overlays               | Reach half time in a 2-player session; verify clock MM:SS is visible above overlay card                                                                        |
| Log section expands/collapses on click      | LAYOUT-02            | Interaction test                                | Click `›` chevron in top band; verify log expands to 240px; click `‹` to collapse                                                                              |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
