---
phase: 34
slug: visual-theme-restyle
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-26
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9 (client)                                                                                      |
| **Config file**        | `packages/client/vite.config.ts`                                                                           |
| **Quick run command**  | `pnpm --filter @counter-attack/client exec vitest run src/hooks/useTeamColors.test.ts`                     |
| **Full suite command** | `pnpm -r typecheck && pnpm -r test && pnpm -r build && pnpm stylelint && pnpm check-contrast && pnpm knip` |
| **Estimated runtime**  | ~30 seconds (full suite ~1-2 min including build)                                                          |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/client exec vitest run <changed test file>`
- **After every plan wave:** Run `pnpm -r test && pnpm stylelint && pnpm check-contrast`
- **Before `/gsd-verify-work`:** Full suite green (`pnpm -r typecheck && pnpm -r test && pnpm -r build && pnpm stylelint && pnpm check-contrast`)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave            | Requirement        | Threat Ref | Secure Behavior                         | Test Type                   | Automated Command                                                                                                                     | File Exists | Status                          |
| -------- | ---- | --------------- | ------------------ | ---------- | --------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------- |
| 34-01-T1 | 01   | 1               | THEME-02           | T-34-SC    | Human legitimacy gate before `pnpm add` | checkpoint                  | n/a (human-verify)                                                                                                                    | ✅          | ✅ green                        |
| 34-01-T2 | 01   | 1               | THEME-02           | T-34-SC    | N/A                                     | install check               | `pnpm ls stylelint stylelint-declaration-strict-value && pnpm --filter @counter-attack/client ls wcag-contrast tsx`                   | ✅          | ✅ green                        |
| 34-01-T3 | 01   | 1               | THEME-02           | —          | N/A                                     | lint                        | `pnpm stylelint`                                                                                                                      | ✅          | ✅ green                        |
| 34-02-T1 | 02   | 2               | THEME-04           | —          | N/A                                     | unit (RED)                  | `pnpm --filter @counter-attack/client test -- useTeamColors`                                                                          | ✅          | ✅ green                        |
| 34-02-T2 | 02   | 2               | THEME-04           | —          | N/A                                     | unit (GREEN)                | `pnpm --filter @counter-attack/client test -- useTeamColors` + `pnpm --filter @counter-attack/client typecheck`                       | ✅          | ✅ green                        |
| 34-03-T1 | 03   | 3               | THEME-04           | —          | N/A                                     | script/CI                   | `pnpm check-contrast && pnpm knip`                                                                                                    | ✅          | ✅ green                        |
| 34-03-T2 | 03   | 3               | THEME-02, THEME-04 | —          | N/A                                     | CI config assertion         | `node -e "...checks ci.yml contains pnpm stylelint / pnpm check-contrast..."`                                                         | ✅          | ✅ green                        |
| 34-04-T1 | 04   | 4               | THEME-01           | —          | N/A                                     | lint + literal-scan         | `pnpm stylelint && node -e "...asserts new hex values present, old blue literals absent..."`                                          | ✅          | ✅ green                        |
| 34-04-T2 | 04   | 4               | THEME-01, THEME-04 | —          | N/A                                     | typecheck+unit+build+script | `pnpm --filter @counter-attack/client typecheck && pnpm --filter @counter-attack/client test && pnpm -r build && pnpm check-contrast` | ✅          | ✅ green                        |
| 34-04-T3 | 04   | 4               | THEME-01           | —          | N/A                                     | manual/visual               | n/a (human-verify checkpoint)                                                                                                         | ✅          | ✅ manual — approved 2026-07-26 |
| 34-05-T1 | 05   | 1 (gap closure) | THEME-01           | —          | N/A                                     | unit                        | `pnpm --filter @counter-attack/client exec vitest run src/components/UniformSelectionScreen.test.tsx`                                 | ✅          | ✅ green                        |
| 34-05-T2 | 05   | 1 (gap closure) | THEME-01           | —          | N/A                                     | unit                        | `pnpm --filter @counter-attack/client exec vitest run src/components/LineupAssignmentScreen.test.tsx`                                 | ✅          | ✅ green                        |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

Re-run during this audit (2026-07-27), independent of SUMMARY.md claims:

- `pnpm stylelint` → exit 0, zero violations.
- `pnpm check-contrast` → `all 12 teams clear AA thresholds (text >= 4.5, ui >= 3)`.
- `pnpm --filter @counter-attack/client exec vitest run src/hooks/useTeamColors.test.ts src/components/UniformSelectionScreen.test.tsx src/components/LineupAssignmentScreen.test.tsx src/components/GameBoard.test.tsx` → 4 files, 67 tests, all pass.
- `stylelint.config.js`, `packages/client/scripts/check-contrast.ts`, and `.github/workflows/ci.yml`'s `pnpm stylelint`/`pnpm check-contrast` steps all confirmed present on disk.

---

## Wave 0 Requirements

- [x] `stylelint.config.js` — created in 34-01
- [x] `packages/client/scripts/check-contrast.ts` — new CI script, created in 34-03
- [x] `packages/client/src/hooks/useTeamColors.test.ts` — extended with `deriveAaAccentColor`/`useTeamAccentColorAA` test cases in 34-02
- [x] `knip.json` — `packages/client` `scripts/**/*.ts` project glob + `scripts/check-contrast.ts` entry added in 34-03
- [x] `.github/workflows/ci.yml` — `pnpm stylelint` and `pnpm check-contrast` steps added in 34-03

All Wave 0 dependencies landed and are confirmed present on disk.

---

## Manual-Only Verifications

| Behavior                                                                   | Requirement | Why Manual                                                                                       | Test Instructions                                                                                                                                                    | Resolution                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lobby/settings/team-selection/board render charcoal base with no blue tint | THEME-01    | Perceptual "does it look charcoal" property — no computable unit-test surface for hue perception | Load the app, visually inspect lobby, settings, team/draft selection, and in-game board against the new tokens; `pnpm -r build` is the automated regression backstop | Approved via 34-04 Task 3 human-verify checkpoint (2026-07-26, after 3 rounds addressing button-outline legibility) AND independently re-confirmed via full phase UAT (34-UAT.md: 8/8 tests passed, 0 issues, re-verification completed 2026-07-27) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-27

---

## Validation Audit 2026-07-27

Retroactive audit run via `/gsd-validate-phase 34`. This VALIDATION.md was a pre-execution draft (frontmatter `status: draft`, `nyquist_compliant: false`, Per-Task Verification Map marked "TBD — finalized by the planner") written before any of the 5 plans executed. This audit reconstructed the full per-task map from all 5 PLAN/SUMMARY files, cross-referenced against 34-VERIFICATION.md and 34-UAT.md, and independently re-ran every automated gate rather than trusting SUMMARY.md claims.

| Metric              | Count                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Tasks mapped        | 12 (across 34-01 through 34-05)                                                              |
| Gaps found          | 0                                                                                            |
| Resolved            | 0 (none needed — no missing automated coverage)                                              |
| Escalated           | 0                                                                                            |
| Manual-only (legit) | 1 (THEME-01 perceptual charcoal check — already human-verified twice: checkpoint + full UAT) |

**Finding:** All three phase requirements (THEME-01, THEME-02, THEME-04) have complete verification coverage — either automated (stylelint, check-contrast, vitest unit suites, CI wiring) or legitimately manual with signed-off human verification already on record. No test-generation work was needed; this audit updated the stale draft map to reflect what was actually built and verified.
