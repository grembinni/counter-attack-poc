---
phase: 01
slug: monorepo-scaffold-shared-types
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9                                                      |
| **Config file**        | `packages/shared/vitest.config.ts` (Wave 0 gap — must be created) |
| **Quick run command**  | `pnpm --filter @counter-attack/shared build`                      |
| **Full suite command** | `pnpm --filter @counter-attack/shared test`                       |
| **Estimated runtime**  | ~5 seconds                                                        |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/shared build`
- **After every plan wave:** Run `pnpm --filter @counter-attack/shared test`
- **Before `/gsd-verify-work`:** Full suite must be green (`pnpm -r build` + `pnpm --filter @counter-attack/shared test`)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement               | Threat Ref | Secure Behavior | Test Type  | Automated Command                                     | File Exists | Status     |
| ------- | ---- | ---- | ------------------------- | ---------- | --------------- | ---------- | ----------------------------------------------------- | ----------- | ---------- |
| 01-?-01 | TBD  | 0    | ARCH-02, ARCH-03, ARCH-07 | —          | N/A             | setup      | `pnpm install` (exit 0)                               | ❌ W0       | ⬜ pending |
| 01-?-02 | TBD  | 1    | ARCH-02                   | —          | N/A             | smoke      | `pnpm -r build` (exit 0)                              | ❌ W0       | ⬜ pending |
| 01-?-03 | TBD  | 1    | ARCH-03                   | —          | N/A             | unit       | `pnpm --filter @counter-attack/shared test`           | ❌ W0       | ⬜ pending |
| 01-?-04 | TBD  | 1    | ARCH-07                   | —          | N/A             | type-check | `pnpm --filter @counter-attack/shared build` (exit 0) | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/shared/vitest.config.ts` — Vitest config (covers all ARCH-03, ARCH-07 unit tests)
- [ ] `packages/shared/src/hex.test.ts` — unit tests for hexDistance, hexNeighbors, hexesInRange, isUnderZoI
- [ ] Vitest install: `pnpm add -D --filter @counter-attack/shared vitest` — Vitest not yet installed

---

## Manual-Only Verifications

| Behavior                                                                       | Requirement | Why Manual                                              | Test Instructions                                                 |
| ------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/server` can import `@counter-attack/shared` types without path hacks | ARCH-02     | Integration import check — requires both packages built | Run `pnpm build` in `packages/server` and verify no TS2307 errors |
| `packages/client` can import `@counter-attack/shared` types without path hacks | ARCH-02     | Integration import check — requires both packages built | Run `pnpm build` in `packages/client` and verify no TS2307 errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
