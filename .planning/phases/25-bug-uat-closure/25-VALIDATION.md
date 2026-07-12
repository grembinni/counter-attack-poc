---
phase: 25
slug: bug-uat-closure
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-10
audited: 2026-07-11
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9                                                           |
| **Config file**        | `packages/server/vitest.config.ts`, `packages/client/vitest.config.ts` |
| **Quick run command**  | `pnpm --filter @counter-attack/server test`                            |
| **Full suite command** | `pnpm test`                                                            |
| **Estimated runtime**  | ~30 seconds                                                            |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/server test` AND `pnpm --filter @counter-attack/client test`
- **After every plan wave:** Run `pnpm test` (all packages)
- **Before `/gsd-verify-work`:** Full suite must be green + OFFSIDE UAT checkpoints closed
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type     | Automated Command                                              | File Exists | Status    |
| -------- | ---- | ---- | ----------- | ---------- | --------------- | ------------- | -------------------------------------------------------------- | ----------- | --------- |
| 25-01-01 | 01   | 1    | BUG-22      | —          | N/A             | Documentation | N/A — read REQUIREMENTS.md                                     | ✅          | ✅ green  |
| 25-02-01 | 02   | 1    | REPLAY-07   | —          | N/A             | Integration   | `pnpm --filter @counter-attack/server test replay.integration` | ✅          | ✅ green  |
| 25-02-02 | 02   | 1    | REPLAY-08   | —          | N/A             | Integration   | `pnpm --filter @counter-attack/server test replay.integration` | ✅          | ✅ green  |
| 25-03-01 | 03   | 2    | BUG-23      | —          | N/A             | Manual UAT    | Two-tab UAT: SNAPSHOT_DEFLECT → goal → KICK_OFF_SETUP          | ✅          | ✅ manual |
| 25-04-01 | 04   | 2    | UX-15       | —          | N/A             | Manual visual | Uniform selection screen — style 12 shows ✕, style 13 shows ╬  | ✅          | ✅ manual |
| 25-04-02 | 04   | 2    | UX-15       | —          | N/A             | Manual visual | Jersey number centered in piece circle across styles           | ✅          | ✅ manual |
| 25-04-03 | 04   | 2    | UX-15       | —          | N/A             | Unit          | `pnpm --filter @counter-attack/client test EventBanner`        | ✅          | ✅ green  |
| 25-04-04 | 04   | 2    | UX-15       | —          | N/A             | Unit          | `pnpm --filter @counter-attack/client test`                    | ✅          | ✅ green  |
| 25-04-05 | 04   | 2    | UX-15       | —          | N/A             | Manual UAT    | Two-tab: opponent confirm does not reset own uniform selection | ✅          | ✅ manual |
| 25-05-01 | 05   | 3    | OFFSIDE-01  | —          | N/A             | Manual UAT    | Two-tab live session: Scenarios A, B, C, D per D-02            | ✅          | ✅ manual |
| 25-05-02 | 05   | 3    | OFFSIDE-02  | —          | N/A             | Manual UAT    | Two-tab live session: free-kick restart flow per D-02          | ✅          | ✅ manual |
| 25-06-04 | 06   | 3    | OFFSIDE-02  | —          | N/A             | Unit          | `pnpm --filter @counter-attack/client test ActionPanel`        | ✅          | ✅ green  |
| 25-06-05 | 06   | 3    | OFFSIDE-02  | —          | N/A             | Unit          | `pnpm --filter @counter-attack/client test ActionPanel`        | ✅          | ✅ green  |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] New test: `packages/server/src/__tests__/replay.integration.test.ts` — `REPLAY-07: GK_KICK produces visible replay frame` ✅ passes
- [x] New test: `packages/server/src/__tests__/replay.integration.test.ts` — `REPLAY-08: LOOSE_BALL_LAND produces visible replay frame` ✅ passes

---

## Manual-Only Verifications

| Behavior                                                               | Requirement            | Why Manual                                                                         | Test Instructions                                                                                                              |
| ---------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Offside detection: 4 scenarios pass (flag, level, not-active, restart) | OFFSIDE-01, OFFSIDE-02 | Socket.io two-player session required; can't unit test live-client offside display | Open two browser tabs on local dev server; play through all 4 scenarios from D-02                                              |
| KICK_OFF_SETUP shading cleared after SNAPSHOT_DEFLECT goal             | BUG-23                 | Rendering artifact; requires full match scenario to reproduce                      | Two-tab session: get to a SNAPSHOT that deflects for a goal; verify kickoff shows no stale tint                                |
| Uniform selection not cleared by opponent's confirm                    | UX-15                  | Requires two-player socket session to trigger the race condition                   | Two-tab: player A selects a uniform style but hasn't confirmed; player B confirms; verify player A's selection is still active |
| Jersey number centered in piece                                        | UX-15                  | Visual rendering check                                                             | Load the game; verify numbers are centered in piece circles at default zoom                                                    |
| Style 12 = ✕ (diagonal quarters), Style 13 = ╬ (cross quarters)        | UX-15                  | Visual rendering check                                                             | Uniform selection screen: verify style 12 and 13 display correctly                                                             |

---

## Validation Sign-Off

- [x] All tasks have automated verify or manual-only justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (REPLAY-07/08 integrated; Plan 06 ActionPanel unit tests added)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-07-11 — 535 server tests pass, 314 client tests pass; manual UAT 3/3

## Validation Audit 2026-07-11

| Metric                      | Count |
| --------------------------- | ----- |
| Gaps found                  | 2     |
| Resolved (unit tests added) | 2     |
| Escalated to manual-only    | 0     |
