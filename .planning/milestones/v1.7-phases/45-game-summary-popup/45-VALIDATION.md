---
phase: 45
slug: game-summary-popup
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-28
updated: 2026-08-28
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> **Refreshed post-execution (task 45-06-02, 2026-08-28):** the phase was planned and
> delivered as six plans across four waves (sixteen tasks total), not the original
> two-plan assumption this document's early draft was seeded from. Every row below was
> re-derived from the actual `<tasks>` blocks and `<verify><automated>` commands in
> `45-01-PLAN.md` through `45-06-PLAN.md`, and every automated command was independently
> re-run against the delivered code on 2026-08-28 rather than trusted from each plan's own
> SUMMARY.md claims.

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
| **Known environment quirk** | STATE.md records a vitest worker-crash flake on Windows; rerun with `--pool=forks` before treating it as a real failure. Not encountered during this refresh's independent re-run. |

---

## Sampling Rate

- **After every task commit:** run the task's own `<automated>` command from the map below
- **After every plan wave:** run the full suite for every package the wave touched
- **Before `/gsd-verify-work`:** full suite green across all 3 packages, plus `pnpm typecheck`, `pnpm lint`, `pnpm stylelint`, `pnpm knip`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure / Verified Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------------------|-----------|-------------------|--------|
| 45-01-01 | 01 | 1 | STATS-03, STATS-04..09 | T-45-02 | `MatchStats` type, `GameState.matchStats`, and `RefereeCard.wasManualOverride` added to `types.ts` without touching the `ActionEvent` union (PD-05) | typecheck | `pnpm --filter @counter-attack/shared typecheck` | ✅ green |
| 45-01-02 | 01 | 1 | STATS-07, STATS-08 | T-45-01, T-45-03 | `computeShotXg` implements D-01 verbatim, per-factor-clamps (PD-03) so the result is always in `[0,1]`, and `recordShotInStats`/`EMPTY_MATCH_STATS` are pure and immutable | unit | `pnpm --filter @counter-attack/shared test -- matchStats && pnpm --filter @counter-attack/shared typecheck` | ✅ green (16 tests) |
| 45-02-01 | 02 | 2 | STATS-03 | T-45-04 | `matchStats` seeded via `EMPTY_MATCH_STATS` at kickoff; `refereeCard.wasManualOverride` recorded once from `refereeLeniencyOverrideEnabled`; both plus the four rule toggles carried verbatim into `buildReplayFrames` | unit | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server typecheck && pnpm --filter @counter-attack/server test -- gameEngine.refereeLeniency` | ✅ green |
| 45-02-02 | 02 | 2 | STATS-07, STATS-08 | T-45-05, T-45-06 | Shot/xG captured at `applyRoll` `case 'SHOT'` (S1) and `applyPenaltyKickDuel` (S2) from PRE-reset pieces, with a dedicated Pitfall-2 regression proving the GOAL branch does not read the post-goal kickoff-formation layout | unit | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server test -- gameEngine.matchStats && pnpm --filter @counter-attack/server typecheck` | ✅ green |
| 45-02-03 | 02 | 2 | STATS-07, STATS-08 | T-45-05, T-45-07 | Shot/xG captured at the two deflection early-returns (S3, S5) and the three GK-out-of-range auto-goal branches (S4, S6, S7); explicit no-double-count test on the deflection-survived path | unit | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server test -- gameEngine.matchStats && pnpm --filter @counter-attack/server typecheck` | ✅ green (21 tests total in file, S1-S7 combined) |
| 45-03-01 | 03 | 2 | STATS-04, STATS-05, STATS-06, STATS-09 | T-45-10, T-45-11 | `foldMatchStats` folds pass/duel/foul/card events and the possession delta; pre-action possession attribution (Pitfall 5); declined tackle/steal excluded (D-07); `shots`/`xg` passed through untouched | unit | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server test -- matchStatsReducer && pnpm --filter @counter-attack/server typecheck` | ✅ green (25 tests) |
| 45-03-02 | 03 | 2 | STATS-04, STATS-05, STATS-06, STATS-09 | T-45-08, T-45-09 | `broadcastState` folds each newly-appended event exactly once via three new `Room` baselines; idempotent across repeat broadcasts, the `TACKLE_STEAL_PROMPT` resume case, and an undo-shrunk `eventLog` | unit | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server test -- roomStore && pnpm --filter @counter-attack/server test -- matchStatsReducer && pnpm --filter @counter-attack/server typecheck` | ✅ green (25 tests in roomStore.test.ts) |
| 45-04-01 | 04 | 2 | STATS-03..09 | — | Stats-block CSS module uses design tokens only; no literal colours, no banned colour functions, no stray `--color-accent-gold` | lint | `pnpm stylelint && pnpm --filter @counter-attack/client typecheck` | ✅ green |
| 45-04-02 | 04 | 2 | STATS-03, STATS-05, STATS-06, STATS-07, STATS-09 | T-45-13, T-45-15 | Settings recap renders all six toggles incl. the Manual/Auto Leniency distinction; seven diverging rows render proportional bars from `matchStats`, never recomputing a counter (PD-18) | component | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/client test -- MatchSummaryContent && pnpm --filter @counter-attack/client typecheck` | ✅ green |
| 45-04-03 | 04 | 2 | STATS-04, STATS-08 | T-45-15, T-45-16 | Possession renders as two pills over a continuous bar with a neutral remainder (PD-14); xG numerals show two decimals from an unrounded backing value; click-toggled explainer with no hover dependency | component | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/client test -- MatchSummaryContent && pnpm --filter @counter-attack/client typecheck && pnpm stylelint` | ✅ green (32 tests total in MatchSummaryContent.test.tsx, 45-04-02 + 45-04-03 combined) |
| 45-05-01 | 05 | 3 | STATS-01 | T-45-17, T-45-18 | `MatchSummaryModal` chrome hosts the shared block above `.substitutionOverlay`'s stacking level, imports nothing from `../socket.js`, and never touches the socket | lint/typecheck | `pnpm stylelint && pnpm --filter @counter-attack/client typecheck && pnpm lint` | ❌ red — see note below |
| 45-05-02 | 05 | 3 | STATS-01 | T-45-17, T-45-19 | (i) icon renders above the clock and is clickable in every phase incl. mid-duel prompts (table-driven); opening emits no socket event | component | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/client test -- GameBoard.matchSummary && pnpm --filter @counter-attack/client typecheck && pnpm stylelint` | ✅ green (21 tests) |
| 45-05-03 | 05 | 3 | STATS-02 | T-45-21 | Stats block appended inside both stoppage overlays with headers untouched and the half-time mutual-confirm flow unregressed | component | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/client test -- GameBoard && pnpm --filter @counter-attack/client typecheck && pnpm stylelint` | ✅ green (75 + 21 tests across GameBoard.test.tsx / GameBoard.matchSummary.test.tsx) |
| 45-05-04 | 05 | 3 | STATS-01..09 | T-45-18, T-45-21 | Human visual/interaction verification against 45-UI-SPEC.md — **approved** after 4 rounds of live two-browser feedback (see Manual-Only Verifications below) | checkpoint | `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test && pnpm --filter @counter-attack/client test` | ✅ green (approved 2026-08-28) |
| 45-06-01 | 06 | 4 | STATS-01..09 | T-45-22, T-45-23 | Full two-client socket round-trip: stats accumulate, broadcast symmetrically (deep-equal on both clients), and survive a real MOVE→HALF_TIME crossing on all nine counters individually, with `addedTimeBonus` reset and `subsUsed` persisted | integration | `pnpm --filter @counter-attack/shared build && pnpm --filter @counter-attack/server test -- matchStats.integration` | ✅ green (10 tests) |
| 45-06-02 | 06 | 4 | STATS-01..09 | T-45-24 | This document maps every delivered task to its real automated command, with truthful sign-off | doc-gate | `node -e "…45-VALIDATION coverage script (see 45-06-PLAN.md task 45-06-02)"` | ✅ green (verify script exits 0, see below) |

*Status: ✅ green · ❌ red · ⚠️ flaky*

**Note on 45-05-01 (red):** the task's own `<verify><automated>` command chains `pnpm lint` (whole-workspace) at the end. Re-run independently during this refresh, `pnpm stylelint` and `pnpm --filter @counter-attack/client typecheck` both exit 0 in isolation, but the workspace-wide `pnpm lint` still fails with `Parsing error: Too many files (>8) have matched the default project` inside `packages/shared`'s test files. This is the pre-existing `packages/shared` typescript-eslint file-count-cap issue documented in `PROJECT.md`'s "Known tech debt" section since Phase 32/33 and reconfirmed in `45-05-SUMMARY.md`'s own "Next Phase Readiness" note ("`packages/client` and `packages/server` lint clean via their own scoped checks") — it predates this phase, is not caused by any file this phase touched, and does not gate CI. Left honestly red per this task's own instruction rather than ticked optimistically.

---

## Wave 0 Requirements

Test artifacts that did not exist at planning time, created by the task that depends on them — all seven now exist and pass, independently re-run during this refresh:

- [x] `packages/shared/src/matchStats.test.ts` — pure xG formula, clamping, and immutable shot recording (task 45-01-02) — 16 tests passing
- [x] `packages/server/src/__tests__/gameEngine.matchStats.test.ts` — per-site shot/xG capture across all seven shot-resolution sites, including the goal pieces-reset regression (tasks 45-02-02, 45-02-03) — 21 tests passing
- [x] `packages/server/src/__tests__/matchStatsReducer.test.ts` — per-event-type fold rules, decline exclusion, pre-action possession attribution (task 45-03-01) — 25 tests passing
- [x] `packages/server/src/__tests__/roomStore.test.ts` — EXISTING file, extended with a match-stats fold `describe` block covering idempotency, the `TACKLE_STEAL_PROMPT` single-fold case and the undo-shrink case (task 45-03-02) — 25 tests passing
- [x] `packages/client/src/components/MatchSummaryContent.test.tsx` — settings recap and stat-row rendering (tasks 45-04-02, 45-04-03) — 32 tests passing
- [x] `packages/client/src/components/GameBoard.matchSummary.test.tsx` — (i) icon across every phase, modal open/close, overlay embedding (tasks 45-05-02, 45-05-03) — 21 tests passing
- [x] `packages/server/src/__tests__/matchStats.integration.test.ts` — full-room socket round-trip (task 45-06-01) — 10 tests passing

No task in this phase depends on a test file it does not itself create, so there is no separate Wave 0 plan.

---

## Manual-Only Verifications

All manual verification was consolidated into the single blocking checkpoint task **45-05-04** (plan `45-05-PLAN.md`), which carried a ten-step script. **Outcome: approved 2026-08-28**, after 4 rounds of live two-browser developer feedback (documented in full in `45-05-SUMMARY.md`'s Deviations section) — 2 pre-existing bugs surfaced and fixed (a red-carded-piece false-positive block in the free-kick defender-zone check; a mangled final-third helper-text string), plus 5 rounds of UI/UX refinement converging on a shared `MatchScoreRow` component, centered/chunked settings-recap bubbles, a corrected Referee Leniency color rule (green = default/Auto, not green = touched), and removal of the modal's corner `×` in favor of a single footer Close control. Every round was re-verified against the full automated gate suite before re-presentation.

| Behavior | Requirement | Why Manual | Covered By | Outcome |
|----------|-------------|------------|------------|---------|
| Diverging-bar and possession-pill visual fidelity to 45-UI-SPEC.md (team-accent segment colours, 2px centre seam, proportional fill, card-colour numeral exception) | STATS-02, STATS-09 | Visual judgement against a reference-image-derived spec; jsdom asserts widths and class names but not appearance | 45-05-04 steps 2, 3, 6 | Approved after round-3/4 centering and color-rule fixes |
| xG explainer accordion on touch as well as mouse | STATS-08 | jsdom `fireEvent.click` cannot prove real touch behaviour on a device | 45-05-04 step 4 | Approved |
| Live in-place updating while the modal stays open | STATS-01 | Requires two connected clients and real server broadcasts to observe an open modal updating without reopening | 45-05-04 step 5 | Approved |
| Modal opening over a live interrupt prompt without disturbing it | STATS-01 | Requires a real mid-action prompt state driven by two players | 45-05-04 step 7 | Approved |
| No statistic resets across the half-time boundary in live play | STATS-04..09 | Automated coverage exists in `matchStats.integration.test.ts` (task 45-06-01, added after this checkpoint); the live pass was a confirmation, not the primary gate | 45-05-04 steps 8, 9 | Approved |
| Real statistics still shown during the post-full-time replay | STATS-01, STATS-02 | Requires the real replay stream timing, which the unit tests bypass | 45-05-04 step 10 | Approved |

---

## Validation Sign-Off

Finalised by task `45-06-02` against the delivered code, not the original plan assumptions. Phases 38, 39 and 40 each shipped a stale VALIDATION.md (STATE.md, v1.6 deferred items, `nyquist` row) — this phase does not repeat that.

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every one of the sixteen rows above carries an automated command (the checkpoint task's own is the full three-package suite run).
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — every task has one; there is no gap.
- [x] Wave 0 covers all MISSING references — all seven Wave 0 artifacts exist and pass (see above).
- [x] No watch-mode flags — every command runs `vitest run` (via each package's `test` script), never `--watch`.
- [x] Feedback latency < 30s — every command observed to complete in well under 30 seconds during this refresh's independent re-run (longest single-package suite: client at ~20s).
- [x] `nyquist_compliant: true` set in frontmatter.

One row (45-05-01) is honestly left red rather than ticked, per a pre-existing, out-of-scope tech-debt issue documented above and in `PROJECT.md` — this does not affect the sign-off items above, none of which assert 100% green status on every literal command; it is disclosed for the next auditor.

**Approval:** Checkpoint `45-05-04` approved 2026-08-28 after 4 rounds of live developer feedback (see `45-05-SUMMARY.md`). This document (task `45-06-02`) independently re-ran every automated command in the map above against the delivered code on 2026-08-28 and confirms: `pnpm --filter @counter-attack/shared test` (902 tests), `pnpm --filter @counter-attack/server test` (1635 tests, 1 skipped, 1 todo, including the new `matchStats.integration.test.ts`), `pnpm --filter @counter-attack/client test` (1212 tests), `pnpm -r typecheck`, `pnpm stylelint`, and `pnpm knip` are all green; `pnpm build` succeeds; `pnpm lint` fails only on the pre-existing `packages/shared` issue noted above.
