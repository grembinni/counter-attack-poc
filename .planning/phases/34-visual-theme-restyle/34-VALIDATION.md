---
phase: 34
slug: visual-theme-restyle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9 (client), already configured                                                                |
| **Config file**        | `packages/client/vite.config.ts` (test config colocated, per existing `useTeamColors.test.ts` precedent) |
| **Quick run command**  | `pnpm --filter @counter-attack/client test -- useTeamColors`                                             |
| **Full suite command** | `pnpm -r test`                                                                                           |
| **Estimated runtime**  | ~30 seconds                                                                                              |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/client test -- useTeamColors`
- **After every plan wave:** Run `pnpm -r test && pnpm stylelint && pnpm check-contrast`
- **Before `/gsd-verify-work`:** Full suite must be green (`pnpm -r typecheck && pnpm -r test && pnpm -r build && pnpm stylelint && pnpm check-contrast`)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type                        | Automated Command                                                                          | File Exists | Status     |
| -------- | ---- | ---- | ----------- | ---------- | --------------- | -------------------------------- | ------------------------------------------------------------------------------------------ | ----------- | ---------- |
| 34-01-xx | 01   | 0    | THEME-02    | —          | N/A             | lint                             | `pnpm stylelint` (NEW)                                                                     | ❌ Wave 0   | ⬜ pending |
| 34-01-xx | 01   | 0    | THEME-04    | —          | N/A             | unit + script                    | `pnpm --filter @counter-attack/client test -- useTeamColors` + `pnpm check-contrast` (NEW) | ❌ Wave 0   | ⬜ pending |
| 34-xx-xx | TBD  | 1+   | THEME-01    | —          | N/A             | manual/visual + build regression | `pnpm -r build`                                                                            | ✅ existing | ⬜ pending |

_Full task-level mapping is finalized by the planner; this table reflects the requirement→test-type shape confirmed by research._

---

## Wave 0 Requirements

- [ ] `stylelint.config.js` — new config file, root of repo
- [ ] `packages/client/scripts/check-contrast.ts` — new CI script
- [ ] `packages/client/src/hooks/useTeamColors.test.ts` — extend with `deriveAaAccentColor`/`useTeamAccentColorAA` test cases (file already exists, needs new test cases only)
- [ ] `knip.json` — add `packages/client` `scripts/**/*.ts` project glob + `scripts/check-contrast.ts` entry
- [ ] `.github/workflows/ci.yml` — add `pnpm stylelint` and `pnpm check-contrast` steps, mirroring the existing `pnpm knip` step

---

## Manual-Only Verifications

| Behavior                                                                   | Requirement | Why Manual                                                                                                             | Test Instructions                                                                                                                                                       |
| -------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lobby/settings/team-selection/board render charcoal base with no blue tint | THEME-01    | No meaningful unit-test surface for "does it look charcoal" — a visual/perceptual property, not a computable assertion | Load the app, visually inspect lobby, settings, team/draft selection, and in-game board against the new tokens; confirm `pnpm -r build` passes as a regression backstop |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
