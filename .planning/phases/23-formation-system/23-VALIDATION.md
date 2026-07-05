---
phase: 23
slug: formation-system
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-05
audited: 2026-07-05
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                       |
| ---------------------- | ------------------------------------------- |
| **Framework**          | Vitest (server + shared packages)           |
| **Config file**        | `packages/server/vitest.config.ts`          |
| **Quick run command**  | `pnpm --filter @counter-attack/server test` |
| **Full suite command** | `pnpm --filter @counter-attack/server test` |
| **Estimated runtime**  | ~10 seconds                                 |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/server test`
- **After every plan wave:** Run `pnpm --filter @counter-attack/server test`
- **Before `/gsd-verify-work`:** Full suite must be green

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref  | Secure Behavior                              | Test Type   | Automated Command                                              | File Exists | Status   |
| -------- | ---- | ---- | ----------- | ----------- | -------------------------------------------- | ----------- | -------------------------------------------------------------- | ----------- | -------- |
| 23-01-01 | 01   | 1    | FORM-04     | T-22-03 ext | formationId allow-list validated server-side | unit        | `pnpm --filter @counter-attack/server test formations`         | ✅ exists   | ✅ green |
| 23-01-02 | 01   | 1    | FORM-04     | —           | N/A                                          | unit        | `pnpm --filter @counter-attack/server test formations`         | ✅ exists   | ✅ green |
| 23-02-01 | 02   | 2    | FORM-04     | —           | N/A                                          | unit        | `pnpm --filter @counter-attack/server test gameEngine.phase23` | ✅ exists   | ✅ green |
| 23-02-02 | 02   | 2    | FORM-04     | —           | N/A                                          | unit        | `pnpm --filter @counter-attack/server test gameEngine.phase23` | ✅ exists   | ✅ green |
| 23-03-01 | 03   | 2    | FORM-03     | —           | N/A                                          | integration | `pnpm --filter @counter-attack/server test room.integration`   | ✅ exists   | ✅ green |
| 23-04-01 | 04   | 3    | FORM-01     | —           | N/A                                          | manual      | n/a — browser UAT                                              | ❌ N/A      | ✅ UAT   |
| 23-04-02 | 04   | 3    | FORM-02     | —           | N/A                                          | manual      | n/a — browser UAT                                              | ❌ N/A      | ✅ UAT   |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `packages/server/src/__tests__/formations.test.ts` — data integrity (FORM-04): 6 tests ✅
  - Each formation has exactly 11 slots
  - All jersey numbers 1–11 present exactly once per formation
  - GK slot has `{ q: 2, r: 13 }` and `jerseyNumber: 1`
- [x] `packages/server/src/__tests__/gameEngine.phase23.test.ts` — unit tests (FORM-04): 7 tests ✅
  - `buildKickOffPieces` uses FORMATIONS positions (not PoolPlayer.position)
  - Away pieces mirrored via `q = 36 − q`
  - Kick-off +4 shift applied to kicking team outfield only
  - GK position unchanged by shift
  - Jersey #9 piece repositioned to kick-off hex `{ q: 18, r: 13 }`
  - Non-kicking team positions unchanged
  - FORMATIONS table not mutated across calls

_Existing test infrastructure covers: `packages/server/src/__tests__/room.integration.test.ts` — FORM-03 integration test (handler extension)_

---

## Manual-Only Verifications

| Behavior                                               | Requirement | Why Manual                                       | Test Instructions                                                                                                                   |
| ------------------------------------------------------ | ----------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Formation section visible between team and style grids | FORM-01     | No client test infra; visual layout verification | Open browser, navigate to UniformSelectionScreen; confirm "Formation" section label and 4 cards appear between team and style grids |
| Mini pitch diagram + tactical description per card     | FORM-02     | Visual content; PNG asset render verification    | Inspect each card: PNG image visible, label matches formation name, description matches locked copy from D-08                       |
| 4-4-2 pre-selected on mount                            | FORM-01     | Visual default state                             | On screen load, confirm 4-4-2 card has selected border-glow; no click needed                                                        |
| Confirm button carries formationId                     | FORM-03     | Network-level verification                       | Open DevTools Network, confirm UNIFORM_CONFIRM socket event payload includes `formationId` field                                    |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s (~6s full suite)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-07-05 — all 506 server tests green (25 test files)

---

## Validation Audit 2026-07-05

| Metric               | Count |
| -------------------- | ----- |
| Gaps found           | 2     |
| Resolved (automated) | 2     |
| Escalated            | 0     |

Both Wave 0 test files were created and are green:

- `formations.test.ts` — 6 tests covering FORM-04 data integrity
- `gameEngine.phase23.test.ts` — 7 tests covering formation-driven piece placement, mirror, shift, GK exemption, immutability
