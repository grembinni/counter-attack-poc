---
phase: 45
slug: game-summary-popup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-28
updated: 2026-08-28
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Refreshed at planning time (2026-08-28):** the original map assumed a two-plan breakdown
> (`45-01-01`..`45-01-05`, `45-02-01`..`45-02-02`). Planning produced six plans across four
> waves; the map below reflects the delivered task IDs. Statuses are finalised by task
> `45-06-02` at the end of the phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (all 3 packages: `shared`, `server`, `client`) |
| **Config file** | `packages/server/vitest.config.ts`, `packages/client/vitest.config.ts`, `packages/shared/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @counter-attack/<pkg> test -- <spec>` (per-task commands in the map below) |
| **Full suite command** | `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test && pnpm --filter @counter-attack/client test` |
| **Estimated runtime** | ~15-30 seconds per package |
| **Build prerequisite** | Server and client tests consume `@counter-attack/shared` from `dist/`, so `pnpm --filter @counter-attack/shared build` must run after any change to `packages/shared/src`. Every cross-package command in the map below includes it. |
| **Known environment quirk** | STATE.md records a vitest worker-crash flake on Windows; rerun with `--pool=forks` before treating it as a real failure. |

---

## Sampling Rate

- **After every task commit:** run the task's own `<automated>` command from the map below
- **After every plan wave:** run the full suite for every package the wave touched
- **Before `/gsd-verify-work`:** full suite green across all 3 packages, plus `pnpm typecheck`, `pnpm lint`, `pnpm stylelint`, `pnpm knip`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure / Verified Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------------------|-----------|-------------------|-------------|--------|
| 45-01-01 | 01 | 1 | STATS-04..09 | T-45-02 | `MatchStats` contract and `RefereeCard.wasManualOverride` added without touching the `ActionEvent` union | typecheck | `pnpm --filter @counter-attack/shared typecheck` | ✅ exists | ⬜ pending |
| 45-01-02 | 01 | 1 | STATS-08 | T-45-01, T-45-03 | D-01 xG formula computes correctly and clamps to `[0,1]` for adversarial inputs | unit | `pnpm --filter @counter-attack/shared test -- matchStats && pnpm --filter @counter-attack/shared typecheck` | ❌ W0 | ⬜ pending |
| 45-02-01 | 02 | 2 | STATS-03 | T-45-04 | `matchStats` seeded at kickoff; Leniency override source recorded; stats and toggles carried into replay frames | unit | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server typecheck && pnpm --filter @counter-attack/server test -- gameEngine.refereeLeniency` | ✅ exists | ⬜ pending |
| 45-02-02 | 02 | 2 | STATS-07, STATS-08 | T-45-05, T-45-06 | Shot and xG captured at the SHOT duel and penalty duel using pre-reset piece positions on goals | unit | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server test -- gameEngine.matchStats && pnpm --filter @counter-attack/server typecheck` | ❌ W0 | ⬜ pending |
| 45-02-03 | 02 | 2 | STATS-07, STATS-08 | T-45-05, T-45-07 | Shot and xG captured at the two deflection branches and three GK-out-of-range auto-goals; no double-count | unit | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server test -- gameEngine.matchStats && pnpm --filter @counter-attack/server typecheck` | ❌ W0 | ⬜ pending |
| 45-03-01 | 03 | 2 | STATS-04, STATS-05, STATS-06, STATS-09 | T-45-10, T-45-11 | Reducer folds pass/duel/foul/card events and the possession delta; declined tackle/steal excluded (D-07) | unit | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server test -- matchStatsReducer && pnpm --filter @counter-attack/server typecheck` | ❌ W0 | ⬜ pending |
| 45-03-02 | 03 | 2 | STATS-04, STATS-05, STATS-06, STATS-09 | T-45-08, T-45-09 | `broadcastState` folds each appended event exactly once; idempotent across repeat broadcasts and undo shrink | unit | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server test -- roomStore && pnpm --filter @counter-attack/server test -- matchStatsReducer && pnpm --filter @counter-attack/server typecheck` | ✅ exists (extended) | ⬜ pending |
| 45-04-01 | 04 | 2 | STATS-03..09 | — | Stats-block CSS uses design tokens only; no literal colours, no banned colour functions | lint | `pnpm stylelint && pnpm --filter @counter-attack/client typecheck` | ❌ W0 | ⬜ pending |
| 45-04-02 | 04 | 2 | STATS-03, STATS-05, STATS-06, STATS-07, STATS-09 | T-45-13, T-45-15 | Settings recap renders all six toggles incl. the Manual/Auto Leniency distinction; seven diverging rows render proportional bars | component | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/client test -- MatchSummaryContent && pnpm --filter @counter-attack/client typecheck` | ❌ W0 | ⬜ pending |
| 45-04-03 | 04 | 2 | STATS-04, STATS-08 | T-45-15, T-45-16 | Possession pills + continuous bar with neutral remainder; xG two-decimal display and click-toggled explainer | component | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/client test -- MatchSummaryContent && pnpm --filter @counter-attack/client typecheck && pnpm stylelint` | ❌ W0 | ⬜ pending |
| 45-05-01 | 05 | 3 | STATS-01 | T-45-17, T-45-18 | Modal chrome hosts the shared block, has two dismiss controls, stacks above the substitution overlay, and never touches the socket | lint/typecheck | `pnpm stylelint && pnpm --filter @counter-attack/client typecheck && pnpm lint` | ❌ W0 | ⬜ pending |
| 45-05-02 | 05 | 3 | STATS-01 | T-45-17, T-45-19 | (i) icon renders above the clock and is clickable in every phase incl. mid-duel prompts; opening emits no socket event | component | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/client test -- GameBoard.matchSummary && pnpm --filter @counter-attack/client typecheck && pnpm stylelint` | ❌ W0 | ⬜ pending |
| 45-05-03 | 05 | 3 | STATS-02 | T-45-21 | Stats block appended inside both stoppage overlays with headers untouched and the half-time confirm flow unregressed | component | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/client test -- GameBoard && pnpm --filter @counter-attack/client typecheck && pnpm stylelint` | ❌ W0 | ⬜ pending |
| 45-05-04 | 05 | 3 | STATS-01..09 | T-45-18, T-45-21 | Human visual/interaction verification against 45-UI-SPEC.md (see Manual-Only Verifications below) | checkpoint | `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test && pnpm --filter @counter-attack/client test` | n/a | ⬜ pending |
| 45-06-01 | 06 | 4 | STATS-01..09 | T-45-22, T-45-23 | Full two-client socket round-trip: stats accumulate, broadcast symmetrically, and survive half-time on all nine counters | integration | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server test -- matchStats.integration` | ❌ W0 | ⬜ pending |
| 45-06-02 | 06 | 4 | STATS-01..09 | T-45-24 | This document maps every delivered task to its real automated command, with truthful sign-off | doc-gate | `node -e "…45-VALIDATION coverage script (see 45-06-PLAN.md task 45-06-02)"` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test artifacts that do not exist yet and are created by the task that depends on them:

- [ ] `packages/shared/src/matchStats.test.ts` — pure xG formula, clamping, and immutable shot recording (task 45-01-02)
- [ ] `packages/server/src/__tests__/gameEngine.matchStats.test.ts` — per-site shot/xG capture across all seven shot-resolution sites, including the goal pieces-reset regression (tasks 45-02-02, 45-02-03)
- [ ] `packages/server/src/__tests__/matchStatsReducer.test.ts` — per-event-type fold rules, decline exclusion, pre-action possession attribution (task 45-03-01)
- [ ] `packages/server/src/__tests__/roomStore.test.ts` — EXISTING file, extended with a match-stats fold `describe` block covering idempotency, the `TACKLE_STEAL_PROMPT` single-fold case and the undo-shrink case (task 45-03-02)
- [ ] `packages/client/src/components/MatchSummaryContent.test.tsx` — settings recap and stat-row rendering (tasks 45-04-02, 45-04-03)
- [ ] `packages/client/src/components/GameBoard.matchSummary.test.tsx` — (i) icon across every phase, modal open/close, overlay embedding (tasks 45-05-02, 45-05-03)
- [ ] `packages/server/src/__tests__/matchStats.integration.test.ts` — full-room socket round-trip (task 45-06-01)

No task in this phase depends on a test file it does not itself create, so there is no separate Wave 0 plan.

---

## Manual-Only Verifications

All manual verification is consolidated into the single blocking checkpoint task **45-05-04** (plan `45-05-PLAN.md`), which carries a ten-step script. Summary of what is manual and why:

| Behavior | Requirement | Why Manual | Covered By |
|----------|-------------|------------|------------|
| Diverging-bar and possession-pill visual fidelity to 45-UI-SPEC.md (team-accent segment colours, 2px centre seam, proportional fill, card-colour numeral exception) | STATS-02, STATS-09 | Visual judgement against a reference-image-derived spec; jsdom asserts widths and class names but not appearance | 45-05-04 steps 2, 3, 6 |
| xG explainer accordion on touch as well as mouse | STATS-08 | jsdom `fireEvent.click` cannot prove real touch behaviour on a device | 45-05-04 step 4 |
| Live in-place updating while the modal stays open | STATS-01 | Requires two connected clients and real server broadcasts to observe an open modal updating without reopening | 45-05-04 step 5 |
| Modal opening over a live interrupt prompt without disturbing it | STATS-01 | Requires a real mid-action prompt state driven by two players | 45-05-04 step 7 |
| No statistic resets across the half-time boundary in live play | STATS-04..09 | Automated coverage exists in `matchStats.integration.test.ts`; the live pass is a confirmation, not the primary gate | 45-05-04 steps 8, 9 |
| Real statistics still shown during the post-full-time replay | STATS-01, STATS-02 | Requires the real replay stream timing, which the unit tests bypass | 45-05-04 step 10 |

---

## Validation Sign-Off

Finalised by task `45-06-02`. Any item that cannot be honestly ticked must be left unticked with a stated reason — Phases 38, 39 and 40 each shipped a stale VALIDATION.md (STATE.md, v1.6 deferred items, `nyquist` row) and this phase must not repeat that.

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — gated on checkpoint `45-05-04` and the sign-off pass in task `45-06-02`.
