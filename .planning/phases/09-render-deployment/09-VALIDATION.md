---
phase: 9
slug: render-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| **Framework**          | vitest (server + client + shared), GitHub Actions (CI)                 |
| **Config file**        | `packages/server/vitest.config.ts`, `packages/client/vitest.config.ts` |
| **Quick run command**  | `pnpm -r typecheck`                                                    |
| **Full suite command** | `pnpm -r build && pnpm -r test`                                        |
| **Estimated runtime**  | ~30 seconds                                                            |

---

## Sampling Rate

- **After every task commit:** Run `pnpm -r typecheck`
- **After every plan wave:** Run `pnpm -r build && pnpm -r test`
- **Before `/gsd-verify-work`:** Full suite must be green + manual smoke test
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior                | Test Type          | Automated Command   | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ---------- | ------------------------------ | ------------------ | ------------------- | ----------- | ---------- |
| 09-01-01 | 01   | 1    | ARCH-05     | —          | /healthz returns 200           | manual + typecheck | `pnpm -r typecheck` | ✅          | ⬜ pending |
| 09-01-02 | 01   | 1    | ARCH-05     | —          | Static serving + SPA fallback  | manual smoke       | `pnpm -r build`     | ✅          | ⬜ pending |
| 09-01-03 | 01   | 1    | ARCH-05     | —          | Socket URL same-origin in prod | typecheck          | `pnpm -r typecheck` | ✅          | ⬜ pending |
| 09-01-04 | 01   | 1    | ARCH-05     | —          | Port 0.0.0.0 binding           | typecheck          | `pnpm -r typecheck` | ✅          | ⬜ pending |
| 09-02-01 | 02   | 2    | ARCH-06     | —          | render.yaml valid YAML         | manual             | review file         | ✅          | ⬜ pending |
| 09-02-02 | 02   | 2    | ARCH-06     | —          | CI workflow passes             | CI                 | GitHub Actions      | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

_Existing infrastructure covers all phase requirements. No new test framework installation needed._

---

## Manual-Only Verifications

| Behavior                             | Requirement      | Why Manual                            | Test Instructions                                                                                                             |
| ------------------------------------ | ---------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Render deploy + WebSocket session    | ARCH-05, ARCH-06 | Requires Render account + live deploy | Owner: New → Blueprint → connect repo → Apply; open service URL; two tabs share room code and complete kick-off + pass + shot |
| `/healthz` returns 200 in production | ARCH-05          | Live endpoint only                    | `curl https://<service>.onrender.com/healthz` returns `ok`                                                                    |
| No localhost in client bundle        | ARCH-05          | Bundle inspection                     | `strings packages/client/dist/assets/*.js \| grep localhost` returns nothing                                                  |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
