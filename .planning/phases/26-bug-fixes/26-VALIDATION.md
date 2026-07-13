---
phase: 26-bug-fixes
slug: bug-fixes
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-12
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| **Framework**          | Vitest (server + client)                                                |
| **Config file**        | `packages/server/vitest.config.ts` · `packages/client/vitest.config.ts` |
| **Quick run (server)** | `pnpm --filter @counter-attack/server test -- <pattern>`                |
| **Quick run (client)** | `pnpm --filter @counter-attack/client test -- <pattern>`                |
| **Full suite**         | `pnpm -r test`                                                          |
| **Estimated runtime**  | ~8 seconds (server ~1s, client ~6s)                                     |

---

## Sampling Rate

- **After every task commit:** Run targeted pattern (e.g. `pnpm test -- ActionPanel`)
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~8 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command                                                       | File Exists | Status   |
| -------- | ---- | ---- | ----------- | ---------- | --------------- | --------- | ----------------------------------------------------------------------- | ----------- | -------- |
| 26-01-01 | 01   | 1    | BUG-24      | —          | N/A             | unit      | `pnpm --filter @counter-attack/server test -- gameEngine.phase26-undo`  | ✅          | ✅ green |
| 26-01-02 | 01   | 1    | BUG-24      | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test -- ActionPanel`              | ✅          | ✅ green |
| 26-02-01 | 02   | 2    | BUG-28      | —          | N/A             | unit      | `pnpm --filter @counter-attack/server test -- gameEngine.phase26-rules` | ✅          | ✅ green |
| 26-02-02 | 02   | 2    | BUG-29      | —          | N/A             | unit      | `pnpm --filter @counter-attack/server test -- gameEngine.phase26-rules` | ✅          | ✅ green |
| 26-03-01 | 03   | 2    | BUG-25      | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test -- ActionPanel`              | ✅          | ✅ green |
| 26-03-02 | 03   | 2    | BUG-26      | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test -- HexGrid`                  | ✅          | ✅ green |
| 26-03-03 | 03   | 2    | BUG-27      | —          | N/A             | unit      | `pnpm --filter @counter-attack/client test -- ActionLog`                | ✅          | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Requirement Coverage

| Requirement | Description                                                               | Test File                          | Tests | Status     |
| ----------- | ------------------------------------------------------------------------- | ---------------------------------- | ----- | ---------- |
| BUG-24      | Undo scoped to current phase; disabled when current stage has no moves    | `gameEngine.phase26-undo.test.ts`  | 5     | ✅ COVERED |
| BUG-25      | MOVE End Turn button orange while moves remain; green when slot exhausted | `ActionPanel.test.tsx`             | 2     | ✅ COVERED |
| BUG-26      | Clicking opponent activated piece opens stats panel                       | `HexGrid.test.tsx`                 | 2     | ✅ COVERED |
| BUG-27      | Deflect log always shows `failed to deflect — [reason]` (band + dice)     | `ActionLog.test.tsx`               | 2     | ✅ COVERED |
| BUG-28      | Header target range uses winning contestant position, not ball position   | `gameEngine.phase26-rules.test.ts` | 4     | ✅ COVERED |
| BUG-29      | Shot range gate cube-consistent at constant 11; client/server parity      | `gameEngine.phase26-rules.test.ts` | 6     | ✅ COVERED |

**Total regression tests added: 21** (5 server BUG-24 + 10 server BUG-28/29 + 6 client BUG-25/26/27)

---

## Wave 0 Requirements

Existing Vitest infrastructure covers all phase requirements. No new framework installation needed.

Test files created this phase:

- [x] `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` — BUG-24 (5 tests)
- [x] `packages/server/src/__tests__/gameEngine.phase26-rules.test.ts` — BUG-28/29 (10 tests)
- [x] `packages/client/src/components/ActionPanel.test.tsx` — extended with BUG-24/25 (2 new tests each)
- [x] `packages/client/src/components/HexGrid.test.tsx` — extended with BUG-26 (2 new tests)
- [x] `packages/client/src/components/ActionLog.test.tsx` — extended with BUG-27 (2 new tests)

---

## Manual-Only Verifications

All phase behaviors have automated verification. The UAT session (2026-07-12) confirmed all 6 success criteria in the browser with a live two-player session.

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 complete: all test files exist and green
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-12

---

## Validation Audit 2026-07-12

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

Run: `pnpm --filter @counter-attack/server test -- gameEngine.phase26-undo gameEngine.phase26-rules` → 15/15 passed  
Run: `pnpm --filter @counter-attack/client test -- ActionPanel HexGrid ActionLog` → 106/106 passed
