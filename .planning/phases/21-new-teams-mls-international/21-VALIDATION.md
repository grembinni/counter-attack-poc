---
phase: 21
slug: new-teams-mls-international
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-04
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| **Framework**          | Vitest + @testing-library/react                                      |
| **Config file**        | `packages/client/vitest.config.ts`                                   |
| **Quick run command**  | `pnpm --filter @counter-attack/client test`                          |
| **Full suite command** | `pnpm --filter @counter-attack/client test` + `pnpm -w tsc --noEmit` |
| **Estimated runtime**  | ~15 seconds                                                          |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/client test`
- **After every plan wave:** Run `pnpm --filter @counter-attack/client test` + `pnpm -w tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type  | Automated Command                           | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ---------- | --------------- | ---------- | ------------------------------------------- | ----------- | ---------- |
| 21-01-01 | 01   | 1    | TEAM-08..11 | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test` | ❌ W0       | ⬜ pending |
| 21-01-02 | 01   | 1    | INTL-01..06 | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test` | ❌ W0       | ⬜ pending |
| 21-01-03 | 01   | 1    | TEAM-08..11 | —          | N/A             | type check | `pnpm -w tsc --noEmit`                      | ❌ W0       | ⬜ pending |
| 21-02-01 | 02   | 2    | LEAGUE-01   | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test` | ❌ W0       | ⬜ pending |
| 21-02-02 | 02   | 2    | LEAGUE-02   | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test` | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/client/src/components/TeamSelectionScreen.test.tsx` — update/extend with league tab assertions (LEAGUE-01, LEAGUE-02)
- [ ] `packages/shared/src/teamConfig.test.ts` (if exists) — assert 12 TeamId entries, all with `league` field set

_Existing test infrastructure (Vitest, @testing-library/react) is already installed — only test updates and new assertions needed._

---

## Manual-Only Verifications

| Behavior                                         | Requirement              | Why Manual                                    | Test Instructions                                                                                      |
| ------------------------------------------------ | ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| All 10 new team badge images render in-game      | TEAM-08..11, INTL-01..06 | Visual quality requires browser inspection    | Launch dev server, open team selection, verify each badge renders correctly at card size               |
| League tab switch animates smoothly              | LEAGUE-01                | Visual regression requires browser inspection | Switch between MLS and International tabs; verify cards update without flicker                         |
| Struck-out card visible across both tabs/players | LEAGUE-02                | Two-tab + two-browser session                 | Open two browser windows, home player picks a team; verify away player sees struck-out card on any tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
