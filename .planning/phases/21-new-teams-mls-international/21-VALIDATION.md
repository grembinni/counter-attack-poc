---
phase: 21
slug: new-teams-mls-international
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-04
audited: 2026-07-04
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Framework**          | Vitest + @testing-library/react                                                                                                |
| **Config file**        | `packages/client/vitest.config.ts`                                                                                             |
| **Quick run command**  | `pnpm --filter @counter-attack/client run test`                                                                                |
| **Full suite command** | `pnpm --filter @counter-attack/shared run test` + `pnpm --filter @counter-attack/client run test` + per-package `tsc --noEmit` |
| **Estimated runtime**  | ~8 seconds                                                                                                                     |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/client run test`
- **After every plan wave:** Run both test suites + per-package `tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type  | Automated Command                                                                                                   | File Exists | Status   |
| -------- | ---- | ---- | ----------- | ---------- | --------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- | ----------- | -------- |
| 21-01-01 | 01   | 1    | TEAM-08..11 | —          | N/A             | unit       | `pnpm --filter @counter-attack/shared run test`                                                                     | ✅          | ✅ green |
| 21-01-02 | 01   | 1    | INTL-01..06 | —          | N/A             | unit       | `pnpm --filter @counter-attack/shared run test`                                                                     | ✅          | ✅ green |
| 21-01-03 | 01   | 1    | TEAM-08..11 | T-21-01    | N/A             | type check | `pnpm --filter @counter-attack/shared exec tsc --noEmit` + `pnpm --filter @counter-attack/server exec tsc --noEmit` | ✅          | ✅ green |
| 21-02-01 | 02   | 2    | LEAGUE-01   | —          | N/A             | unit       | `pnpm --filter @counter-attack/client run test`                                                                     | ✅          | ✅ green |
| 21-02-02 | 02   | 2    | LEAGUE-02   | —          | N/A             | unit       | `pnpm --filter @counter-attack/client run test`                                                                     | ✅          | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `packages/client/src/components/TeamSelectionScreen.test.tsx` — LEAGUE-01 and LEAGUE-02 describe blocks added (tab layout, aria-selected, cross-tab struck-out)
- [x] `packages/shared/src/teamConfig.test.ts` — `toHaveLength(12)` TEAM_CONFIGS assertion; `it.each(TEAM_IDS)` getSquadPlayers returns 11 players for all 12 teams; league field asserts `['mls','international'].toContain(...)`

_Both test files verified green as of 2026-07-04 audit._

---

## Manual-Only Verifications

| Behavior                                         | Requirement              | Why Manual                                    | Test Instructions                                                                                      |
| ------------------------------------------------ | ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| All 10 new team badge images render in-game      | TEAM-08..11, INTL-01..06 | Visual quality requires browser inspection    | Launch dev server, open team selection, verify each badge renders correctly at card size               |
| League tab switch animates smoothly              | LEAGUE-01                | Visual regression requires browser inspection | Switch between MLS and International tabs; verify cards update without flicker                         |
| Struck-out card visible across both tabs/players | LEAGUE-02                | Two-tab + two-browser session                 | Open two browser windows, home player picks a team; verify away player sees struck-out card on any tab |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-07-04

---

## Validation Audit 2026-07-04

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

_All 5 tasks were COVERED — tests existed and were green at audit time. VALIDATION.md was in draft/pending state; updated to reflect verified results._

_Verified commands:_

- `pnpm --filter @counter-attack/shared run test` → 538 tests pass (12 files)
- `pnpm --filter @counter-attack/client run test` → 288 tests pass (14 files)
- `pnpm --filter @counter-attack/shared exec tsc --noEmit` → exits 0
- `pnpm --filter @counter-attack/server exec tsc --noEmit` → exits 0
- `pnpm --filter @counter-attack/client exec tsc --noEmit` → exits 0

## Validation Audit 2026-07-04 (re-verify)

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

_Re-verification via /gsd-validate-phase 21. All 5 tasks remain COVERED — test counts unchanged from prior audit._

_Verified commands:_

- `pnpm --filter @counter-attack/shared run test` → 538 tests pass (12 files)
- `pnpm --filter @counter-attack/client run test` → 288 tests pass (14 files)
- `pnpm --filter @counter-attack/shared exec tsc --noEmit` → exits 0
- `pnpm --filter @counter-attack/server exec tsc --noEmit` → exits 0
- `pnpm --filter @counter-attack/client exec tsc --noEmit` → exits 0
