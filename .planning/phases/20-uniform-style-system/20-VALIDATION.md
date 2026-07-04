---
phase: 20
slug: uniform-style-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 20 — Validation Strategy

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

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type  | Automated Command                                                 | File Exists     | Status     |
| -------- | ---- | ---- | ----------- | ---------- | --------------- | ---------- | ----------------------------------------------------------------- | --------------- | ---------- |
| 20-01-01 | 01   | 1    | UNIFORM-01  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test -- --reporter=verbose` | ❌ W0           | ⬜ pending |
| 20-01-02 | 01   | 1    | UNIFORM-01  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test -- --reporter=verbose` | ❌ W0           | ⬜ pending |
| 20-01-03 | 01   | 1    | UNIFORM-01  | —          | N/A             | type check | `pnpm -w tsc --noEmit`                                            | ❌ W0           | ⬜ pending |
| 20-02-01 | 02   | 2    | UNIFORM-05  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test`                       | ✅ needs update | ⬜ pending |
| 20-02-02 | 02   | 2    | UNIFORM-05  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test`                       | ✅ needs update | ⬜ pending |
| 20-02-03 | 02   | 2    | UNIFORM-05  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test`                       | ✅ needs update | ⬜ pending |
| 20-02-04 | 02   | 2    | UNIFORM-05  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test`                       | ✅ needs update | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/client/src/styles/uniformStyles.test.tsx` — stubs for UNIFORM-01 (renderer shape, GK swap, 12 styles)
- [ ] Update `packages/client/src/components/PieceOverlay.test.tsx` assertions — `url(#city-jersey` → `url(#<style>-<pieceId>`, GK color assertions

_Existing test infrastructure (Vitest, @testing-library/react) is already installed — only new test file and assertion updates needed._

---

## Manual-Only Verifications

| Behavior                                     | Requirement | Why Manual                                    | Test Instructions                                                                         |
| -------------------------------------------- | ----------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| City pieces render pinstripe pattern in-game | UNIFORM-05  | Visual regression requires browser inspection | Launch dev server, join game as City, verify outfield pieces show vertical stripe pattern |
| Crew pieces render diagonal stripe in-game   | UNIFORM-05  | Visual regression requires browser inspection | Launch dev server, join game as Crew, verify outfield pieces show diagonal stripe         |
| GK pieces visually distinct from outfield    | UNIFORM-01  | Color inversion checked visually              | Verify GK piece uses swapped palette (primary↔secondary1) on both teams                   |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
