---
phase: 33
slug: design-tokens-highlight-standardization
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-25
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9 + @testing-library/react 14.3.1, jsdom 25.0.0 environment                                                                                                                    |
| **Config file**        | `packages/client/vitest.config.ts` (`include: ['src/**/*.test.{ts,tsx}']`, `environment: 'jsdom'`)                                                                                        |
| **Quick run command**  | `pnpm --filter @counter-attack/client test -- HexCell.test.tsx` (or `PieceOverlay.test.tsx` / `HexGrid.test.tsx` / new `BallLocationRing.test.tsx`, scoped to the file under active edit) |
| **Full suite command** | `pnpm --filter @counter-attack/client test` (client-only — this phase touches no server/shared code)                                                                                      |
| **Estimated runtime**  | ~15-30 seconds (client suite)                                                                                                                                                             |

---

## Sampling Rate

- **After every task commit:** Run the scoped Vitest file(s) touched (`HexCell.test.tsx`, `PieceOverlay.test.tsx`, `HexGrid.test.tsx`, `GameBoard.test.tsx`, or new `BallLocationRing.test.tsx`)
- **After every plan wave:** Run `pnpm --filter @counter-attack/client test`
- **Before `/gsd-verify-work`:** Full client suite must be green, plus a manual grep sweep (`grep -rn "#[0-9a-fA-F]\{3,8\}\|rgba" packages/client/src/components`, excluding `PitchMarkings.tsx`/`GoalNets.tsx`/test files/`UNIFORM_STYLES`) confirming zero stray highlight/ring literals remain outside the token/highlight tables, plus the manual BUG-23 repro check
- **Max feedback latency:** 30 seconds

---

## Requirement → Test Map

_(PLAN.md files now exist — every requirement below is mapped to concrete plan/task IDs with `<automated>` commands. The task-level `<automated>` commands in those plans satisfy each row.)_

| Req ID    | Behavior                                                                                                                         | Test Type                                                                                                     | Automated Command                                                                                                                             | File Exists?                                                                                             |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| THEME-03  | `--team-accent` CSS var derived from `TEAM_CONFIGS.palette.uiColor`, single runtime source; chrome colors migrated to token file | unit (render + computed-style/inline-style assertion)                                                         | `pnpm --filter @counter-attack/client test -- GameBoard.test.tsx`                                                                             | ✅ existing file — new `--team-accent` assertion planned in 33-01 Task 3; token file in 33-01 Task 1     |
| HILITE-01 | `HIGHLIGHT_STYLES` (or successor) covers all ~13-14 real highlight cases, no `HexGrid.tsx` ad-hoc literals remain                | unit (render each `highlightType`, assert token/prop identity) + static grep check                            | `pnpm --filter @counter-attack/client test -- HexCell.test.tsx`                                                                               | ✅ existing file — new type coverage in 33-04; HexGrid consolidation + grep gate in 33-06                |
| HILITE-02 | Red = exactly one meaning (offside); goal-target uses a distinct non-red color                                                   | unit (assert goal-target fill ≠ offside-ring stroke; assert exactly one red-equivalent semantic use app-wide) | `pnpm --filter @counter-attack/client test -- HexCell.test.tsx PieceOverlay.test.tsx`                                                         | ✅ existing files — goal→purple recolor in 33-04, offside red unchanged in 33-05                         |
| HILITE-03 | Selected ring vs. moved-this-stage ring are visually distinct                                                                    | unit (assert ring stroke colors differ; assert grey-treatment fill/overlay present)                           | `pnpm --filter @counter-attack/client test -- PieceOverlay.test.tsx`                                                                          | ✅ existing file — grey moved-this-stage treatment + distinctness assertion in 33-05                     |
| HILITE-04 | Ball-location marker: standalone, always-on-top, white hex-edge, correct phase gating                                            | unit (new component test)                                                                                     | `pnpm --filter @counter-attack/client test -- BallLocationRing.test.tsx` (new file)                                                           | ✅ closed — new component + test planned in 33-06 Task 1 (BallLocationRing.tsx + .test.tsx)              |
| HILITE-05 | Single reference document exists and covers all types; test literals migrated to token/semantic identity                         | manual/documentation check (not automatable via Vitest) + unit (test-literal migration)                       | N/A — file-existence + content review; `pnpm --filter @counter-attack/client test -- HexCell.test.tsx HexGrid.test.tsx PieceOverlay.test.tsx` | ✅ closed — `docs/HIGHLIGHT-REFERENCE.md` planned in 33-07 Task 1; test-literal migration in 33-04/05/06 |

_Status: ✅ satisfied — every Requirement → Test Map row is covered by a PLAN.md task with an `<automated>` command (plans 33-01 … 33-07)._

---

## Wave 0 Requirements

- [x] `docs/HIGHLIGHT-REFERENCE.md` — new single-source reference doc (HILITE-05); planned in 33-07 Task 1
- [x] `packages/client/src/components/BallLocationRing.test.tsx` (or equivalent name) — new component + test; planned in 33-06 Task 1 (RED-first)
- [x] `packages/client/src/styles/tokens.css` (or equivalent) — new CSS custom-property token file; planned in 33-01 Task 1
- [x] New test assertions for `--team-accent` / `--color-*` CSS custom properties; planned in 33-01 Task 3

_Test framework itself is already fully installed and configured — no `pnpm add` or config changes needed, only new test files/assertions._

---

## Manual-Only Verifications

| Behavior                                                                      | Requirement                                                    | Why Manual                                                                                                                                | Test Instructions                                                                                                                                                |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single reference document covers all ~13-14 highlight types accurately        | HILITE-05                                                      | Content-completeness/accuracy review is not mechanically checkable by a test runner                                                       | Read `docs/HIGHLIGHT-REFERENCE.md` (or wherever the planner locates it) and cross-check every entry in `HIGHLIGHT_STYLES` (or successor) has a corresponding row |
| BUG-23 (KICK_OFF_SETUP stale shading) repro check                             | — (informational, deferred bug carried from Phase 25/26/31/32) | Requires manually reproducing the original UAT repro steps to confirm whether this phase's overlay consolidation incidentally resolves it | Follow the original BUG-23 repro steps post-implementation and record whether the stale shading still occurs                                                     |
| Zero-literal visual sweep confirming Phase 34 will be a pure token-value swap | Success Criterion #1/#2                                        | Grep sweep for stray literals needs a human to judge intentional exclusions (pitch markings, goal nets, jersey patterns) vs. real gaps    | Run `grep -rn "#[0-9a-fA-F]\{3,8\}\|rgba" packages/client/src/components` and confirm every remaining hit is on the excluded list                                |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (token file, BallLocationRing test, HIGHLIGHT-REFERENCE.md)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved — Phase 33 plans (33-01 … 33-07) satisfy every Requirement → Test Map row; `<automated>` commands are non-watch and within the 30s latency budget.
