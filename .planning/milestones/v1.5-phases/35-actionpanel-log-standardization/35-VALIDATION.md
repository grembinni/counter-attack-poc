---
phase: 35
slug: actionpanel-log-standardization
status: audited
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-27
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed retroactively (State B — no VALIDATION.md existed) from the 6 PLAN/SUMMARY
> pairs, 35-UAT.md, and 35-VERIFICATION.md.

---

## Test Infrastructure

| Property               | Value                                                          |
| ---------------------- | -------------------------------------------------------------- |
| **Framework**          | vitest (client), React Testing Library                         |
| **Config file**        | `packages/client/vitest.config.ts`                             |
| **Quick run command**  | `pnpm --filter @counter-attack/client test -- <ComponentName>` |
| **Full suite command** | `pnpm --filter @counter-attack/client test`                    |
| **Estimated runtime**  | ~12 seconds (25 files, 475 tests, verified 2026-07-27)         |

Additional gates used throughout this phase: `pnpm --filter @counter-attack/client typecheck`, `pnpm lint`, `pnpm stylelint`, `pnpm -r build`.

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @counter-attack/client test -- <ComponentName>`
- **After every plan wave:** `pnpm --filter @counter-attack/client test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan             | Wave | Requirement        | Test Type  | Automated Command                                                 | File Exists                         | Status                                                                                                          |
| -------- | ---------------- | ---- | ------------------ | ---------- | ----------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 35-01-01 | 01               | 1    | PANEL-03           | unit       | `pnpm --filter @counter-attack/client test -- ctaColorClass`      | ✅ `ctaColorClass.test.ts`          | ✅ green                                                                                                        |
| 35-01-02 | 01               | 1    | PANEL-03           | unit       | `pnpm --filter @counter-attack/client test -- ActionPanel`        | ✅ `ActionPanel.test.tsx`           | ✅ green                                                                                                        |
| 35-01-03 | 01               | 1    | PANEL-03           | unit       | `pnpm --filter @counter-attack/client test -- ActionPanel`        | ✅ `ActionPanel.test.tsx`           | ✅ green                                                                                                        |
| 35-02-01 | 02               | 1    | PANEL-02, PANEL-04 | unit       | `pnpm --filter @counter-attack/client test -- ActionLog`          | ✅ `ActionLog.test.tsx`             | ⚠️ partial — header/keeper wording covered; border removal itself is source-assertion-only (see Manual-Only #1) |
| 35-02-02 | 02               | 1    | PANEL-04           | unit       | `pnpm --filter @counter-attack/client test -- ActionLog`          | ✅ `ActionLog.test.tsx`             | ✅ green                                                                                                        |
| 35-02-03 | 02               | 1    | PANEL-04           | unit       | `pnpm --filter @counter-attack/client test -- ActionLog`          | ✅ `ActionLog.test.tsx`             | ✅ green                                                                                                        |
| 35-03-01 | 03               | 2    | PANEL-01, PANEL-02 | build/lint | `pnpm stylelint && pnpm -r build`                                 | ⚠️ no `ReplayPanel.test.tsx` exists | ⚠️ partial — see Manual-Only #1, #2                                                                             |
| 35-03-02 | 03               | 2    | PANEL-03, PANEL-04 | unit       | `pnpm --filter @counter-attack/client test -- FreeKickSetupPanel` | ✅ `FreeKickSetupPanel.test.tsx`    | ✅ green                                                                                                        |
| 35-03-03 | 03               | 2    | PANEL-04           | unit       | `pnpm --filter @counter-attack/client test -- KickOffSetupPanel`  | ✅ `KickOffSetupPanel.test.tsx`     | ✅ green                                                                                                        |
| 35-04-01 | 04               | 2    | PANEL-01           | unit       | `pnpm --filter @counter-attack/client test -- ActionPanel`        | ✅ `ActionPanel.test.tsx`           | ✅ green                                                                                                        |
| 35-04-02 | 04               | 2    | PANEL-04           | unit       | `pnpm --filter @counter-attack/client test -- ActionPanel`        | ✅ `ActionPanel.test.tsx`           | ✅ green                                                                                                        |
| 35-04-03 | 04               | 2    | PANEL-04           | unit       | `pnpm --filter @counter-attack/client test -- ActionPanel`        | ✅ `ActionPanel.test.tsx`           | ✅ green                                                                                                        |
| 35-05-01 | 05               | 3    | PANEL-04           | unit       | `pnpm --filter @counter-attack/client test -- ActionPanel`        | ✅ `ActionPanel.test.tsx`           | ✅ green                                                                                                        |
| 35-05-02 | 05               | 3    | PANEL-01           | unit       | `pnpm --filter @counter-attack/client test -- ActionPanel`        | ✅ `ActionPanel.test.tsx`           | ✅ green                                                                                                        |
| 35-06-01 | 06 (gap closure) | 4    | PANEL-01, PANEL-04 | unit       | `pnpm --filter @counter-attack/client test -- KickOffSetupPanel`  | ✅ `KickOffSetupPanel.test.tsx`     | ⚠️ partial — copy/wording covered; `text-align: center` itself is not jsdom-verifiable (see Manual-Only #3)     |
| 35-06-02 | 06 (gap closure) | 4    | PANEL-01, PANEL-04 | unit       | `pnpm --filter @counter-attack/client test -- ActionPanel`        | ✅ `ActionPanel.test.tsx`           | ✅ green                                                                                                        |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/partial_

Full suite confirmed green as of this audit: `pnpm --filter @counter-attack/client test` → 25 files, 475 tests passed (2026-07-27).

---

## Wave 0 Requirements

Existing infrastructure (vitest + React Testing Library, already configured before this phase) covers all phase requirements at the unit/component level. No new framework install was needed.

---

## Manual-Only Verifications

| Behavior                                                                                                                                                                                                                                                                                                             | Requirement | Why Manual                                                                                                                                                                                                                                                                                                                                    | Test Instructions                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame borders removed from `ReplayPanel.module.css` `.panel`, `FreeKickSetupPanel.module.css` `.confirmCard`, `GameBoard.module.css` `.sideLogCollapsed`/`.sideLogExpanded`, `ActionLog.module.css` `.panel`, `ActionPanel.module.css` `.confirmCard`, and each panel still reads as legible/distinct from the pitch | PANEL-02    | CSS Modules are not rendered/computed in the vitest+jsdom test environment, so "no border present" and "still visually legible via background alone" cannot be asserted via component tests. `pnpm stylelint` only enforces that any surviving `border-color` uses a valid design token — it does not detect a re-added `border` declaration. | Completed via human UAT test 2 (`35-UAT.md`) — walked all listed panels, confirmed each remains legible/distinct from the pitch with no border. Passed 2026-07-27T22:45:23Z, commit `b3592df`. Re-run this manual check if any of the listed `.module.css` files are touched again.                                                                                 |
| `ReplayPanel.tsx`'s `.heading` → `.panelHeading` CSS class rename renders the same visible "Replay" heading                                                                                                                                                                                                          | PANEL-01    | No `ReplayPanel.test.tsx` exists in the codebase (pre-existing gap, not introduced by this phase) — the rename is verified only by `pnpm -r build` (TS/CSS-module resolution), not by a component-render assertion.                                                                                                                           | Render the app during the Replay phase and confirm the "Replay" heading is present and styled identically to before the rename. Folds into the same visual pass as Manual-Only #1. Consider adding a minimal `ReplayPanel.test.tsx` in a future phase to close this permanently (flagged, not auto-fixed, per user decision to mark manual-only during this audit). |
| `KickOffSetupPanel`/`ActionPanel`/`FreeKickSetupPanel` heading and constraint-row text render **centered** (`text-align: center`)                                                                                                                                                                                    | PANEL-01    | `text-align` is a layout/rendering property not evaluated by jsdom component tests (no real paint/layout pass).                                                                                                                                                                                                                               | Completed via human UAT test 1 (`35-UAT.md`) — stepped through 8-10 phase states and confirmed the heading/detail/CTA system, including alignment, reads naturally. Passed 2026-07-27T22:45:23Z, commit `b3592df`.                                                                                                                                                  |
| Orange→green CTA color transition is **visually** distinguishable against the charcoal/graphite background (not just class-name-correct)                                                                                                                                                                             | PANEL-03    | Color contrast/perceptual distinctness cannot be judged from a `className` assertion alone — the class is proven correct by `ctaColorClass.test.ts` and the per-phase `ActionPanel.test.tsx`/`FreeKickSetupPanel.test.tsx` D-02/D-06 blocks, but whether the two colors are obviously different to a human eye requires a human.              | Completed via human UAT test 3 (`35-UAT.md`) — confirmed all five newly-converted phases plus `FreeKickSetupPanel` match the pre-existing MOVE/HEADER look. Passed 2026-07-27T22:45:23Z, commit `b3592df`.                                                                                                                                                          |

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify command or are covered by the full-suite regression run
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — infra pre-existed)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` — **not set**. Per user decision during this audit (2026-07-27), the 2 identified automated-test gaps (border-removal regression coverage; missing `ReplayPanel.test.tsx`) were marked Manual-Only rather than closed with new tests. All 4 corresponding behaviors are independently confirmed via the completed `35-UAT.md` human-verification pass (commit `b3592df`) and `35-VERIFICATION.md` (`status: passed`).

**Approval:** approved 2026-07-27 (partial — Manual-Only items accepted in lieu of automated coverage)

## Validation Audit 2026-07-27

| Metric                  | Count |
| ----------------------- | ----- |
| Gaps found              | 2     |
| Resolved                | 0     |
| Escalated (Manual-Only) | 2     |
