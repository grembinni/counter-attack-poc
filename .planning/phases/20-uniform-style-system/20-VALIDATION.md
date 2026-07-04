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

- [x] `packages/client/src/styles/uniformStyles.test.tsx` — 33 tests covering 18-style completeness, return-shape, id uniqueness, patternDef DOM, overlay pointerEvents, sunburst 8-sector paths, centre circle overlay for number legibility (Phase 21 expanded 12→18 styles; `fade` replaced by `sunburst`/`shape-*`/`split-*`/`quarter-*` family)
- [x] `packages/client/src/components/PieceOverlay.test.tsx` — updated assertions: `url(#ps-v-` (pinstripes-vertical), `url(#bar-diagonal-` (crew outfield, solid fill + clipPath), `url(#checkers-` (GK), GK palette-swap colors via `COLOR_SCHEME_REGISTRY` using `homePrime`/`homeAlt`/`awayPrime`/`awayAlt` fields (Phase 21 renamed palette fields from `primary`/`secondary1`/`primaryLight`/`secondary2`)

---

## Manual-Only Verifications

| Behavior                                               | Requirement | Why Manual                                    | Test Instructions                                                                                                              |
| ------------------------------------------------------ | ----------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| City pieces render pinstripes-vertical pattern in-game | UNIFORM-05  | Visual regression requires browser inspection | Launch dev server, join game as City, verify outfield pieces show vertical pinstripe pattern (style id: `pinstripes-vertical`) |
| Crew pieces render bar-diagonal pattern in-game        | UNIFORM-05  | Visual regression requires browser inspection | Launch dev server, join game as Crew, verify outfield pieces show diagonal bar pattern (style id: `bar-diagonal`)              |
| GK pieces visually distinct from outfield              | UNIFORM-01  | Color inversion checked visually              | Verify GK piece uses swapped palette (homePrime↔awayPrime, homeAlt↔awayAlt) on both teams                                      |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-07-04

## Validation Audit 2026-07-04 (first)

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 2     |
| Resolved   | 2     |
| Escalated  | 0     |

Root cause: `PieceOverlay.test.tsx` had hardcoded City palette hex values (`#dc143c`, `#f5c518`) that became stale when Phase 19 updated the City palette to `#C3153B`/`#E8BA21`. Fixed by replacing with `COLOR_SCHEME_REGISTRY.city.palette.primary/secondary1` references.

## Validation Audit 2026-07-04 (second — post Phase 21 expansion)

| Metric                     | Count |
| -------------------------- | ----- |
| Gaps found (coverage)      | 0     |
| Stale descriptions updated | 3     |
| Escalated                  | 0     |

Root cause: Phase 21 (new-teams-mls-international) expanded the uniform style system from 12 styles (pinstripe, diagonal, checker, cosmos, plus, v-stripe, quarters, polka-dots, fade, tree-rings, corners, solid) to 18 styles with renamed IDs (pinstripes-vertical, bar-diagonal, checkers, sunburst, etc.) and renamed palette fields (primary→homePrime, secondary1→homeAlt, primaryLight→awayPrime, secondary2→awayAlt). The Wave 0 requirements and Manual-Only sections in this file referenced Phase 20's original style names and test counts; updated to reflect current implementation. All 288 client tests green; no coverage gaps.
