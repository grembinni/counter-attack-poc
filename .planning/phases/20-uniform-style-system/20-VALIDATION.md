---
phase: 20
slug: uniform-style-system
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-03
audited: 2026-07-04
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

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type  | Automated Command                                                 | File Exists | Status   |
| -------- | ---- | ---- | ----------- | ---------- | --------------- | ---------- | ----------------------------------------------------------------- | ----------- | -------- |
| 20-01-01 | 01   | 1    | UNIFORM-01  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test -- --reporter=verbose` | ✅          | ✅ green |
| 20-01-02 | 01   | 1    | UNIFORM-01  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test -- --reporter=verbose` | ✅          | ✅ green |
| 20-01-03 | 01   | 1    | UNIFORM-01  | —          | N/A             | type check | `pnpm -w tsc --noEmit`                                            | ✅          | ✅ green |
| 20-02-01 | 02   | 2    | UNIFORM-05  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test`                       | ✅          | ✅ green |
| 20-02-02 | 02   | 2    | UNIFORM-05  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test`                       | ✅          | ✅ green |
| 20-02-03 | 02   | 2    | UNIFORM-05  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test`                       | ✅          | ✅ green |
| 20-02-04 | 02   | 2    | UNIFORM-05  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test`                       | ✅          | ✅ green |
| 20-03-01 | 03   | 3    | UNIFORM-05  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test`                       | ✅          | ✅ green |
| 20-03-02 | 03   | 3    | UNIFORM-05  | —          | N/A             | unit       | `pnpm --filter @counter-attack/client test`                       | ✅          | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `packages/client/src/styles/uniformStyles.test.tsx` — 26 tests covering 12-style completeness, return-shape, id uniqueness, fade gradient, patternDef DOM, pointer-events
- [x] `packages/client/src/components/PieceOverlay.test.tsx` — updated assertions: `url(#pinstripe-`/`url(#diagonal-`/`url(#checker-`, GK palette-swap colors via `COLOR_SCHEME_REGISTRY` (not hardcoded hex)

---

## Manual-Only Verifications

| Behavior                                     | Requirement | Why Manual                                    | Test Instructions                                                                         |
| -------------------------------------------- | ----------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| City pieces render pinstripe pattern in-game | UNIFORM-05  | Visual regression requires browser inspection | Launch dev server, join game as City, verify outfield pieces show vertical stripe pattern |
| Crew pieces render diagonal stripe in-game   | UNIFORM-05  | Visual regression requires browser inspection | Launch dev server, join game as Crew, verify outfield pieces show diagonal stripe         |
| GK pieces visually distinct from outfield    | UNIFORM-01  | Color inversion checked visually              | Verify GK piece uses swapped palette (primary↔secondary1) on both teams                   |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-07-04

## Validation Audit 2026-07-04

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 2     |
| Resolved   | 2     |
| Escalated  | 0     |

Root cause: `PieceOverlay.test.tsx` had hardcoded City palette hex values (`#dc143c`, `#f5c518`) that became stale when Phase 19 updated the City palette to `#C3153B`/`#E8BA21`. Fixed by replacing with `COLOR_SCHEME_REGISTRY.city.palette.primary/secondary1` references.
