---
phase: 40
slug: substitutions
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-15
updated: 2026-08-16
plans: 7
waves: 4
revision: 'D-11 forced-substitution retracted (plan 40-08 deleted); D-10 empty-bench free-agent auto-fill retracted and fully removed (superseded by D-12 — no bench generation, Standard-mode benches are legitimately empty); D-13 added — red-carded players relocate to the bench as a permanently unfillable entry'
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **Framework**          | Vitest (per-package config; `--pool=forks` flake workaround applies per project memory) |
| **Config file**        | `packages/*/vitest.config.ts` (per-package, existing)                                   |
| **Quick run command**  | `pnpm --filter <package> test -- <touched-file-pattern>`                                |
| **Full suite command** | `pnpm test` (root, runs all workspace packages)                                         |
| **Estimated runtime**  | ~30–60 seconds (existing suite scale)                                                   |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <package> test -- <touched-file-pattern>`
- **After every plan wave:** Run `pnpm --filter @counter-attack/server test` and `pnpm --filter @counter-attack/client test`
- **Before `/gsd-verify-work`:** Full suite (`pnpm test`) must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Task IDs are `{plan}-{task}`. Wave-0 test-creation tasks are marked **W0** and always
precede, within their own plan, the task that implements the behaviour they assert.

| Task ID  | Plan  | Wave | Requirement                                         | Threat Ref                         | Secure Behavior                                                                                                                                                               | Test Type             | Automated Command                                                                                     | File Exists                 | Status     |
| -------- | ----- | ---- | --------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------- | ---------- |
| 40-01-01 | 40-01 | 1    | SUB-01, SUB-04, SUB-06                              | T-40-02                            | `isStoppagePhase` is a single shared predicate; client and server can never diverge; `maxOnPitchFor` stays derived from `pieces` (unchanged by D-13)                          | unit (shared) **W0**  | `pnpm --filter @counter-attack/shared test -- stoppagePhases`                                         | ❌ new (created in W0)      | ⬜ pending |
| 40-01-02 | 40-01 | 1    | SUB-02, SUB-05, SUB-07 (D-13)                       | T-40-01, T-40-03, T-40-28          | Substitution contract types exist; `BenchEntryStatus` makes available/subbedOut/redCarded mutually exclusive; payload typing is declarative only                              | typecheck             | `pnpm --filter @counter-attack/shared test`                                                           | ✅ existing                 | ⬜ pending |
| 40-01-03 | 40-01 | 1    | SUB-02                                              | T-40-08                            | `SUBSTITUTION` is an Undo boundary on both tiers and is deliberately replay-excluded                                                                                          | unit (both tiers)     | `pnpm --filter @counter-attack/client test -- ActionPanel`                                            | ✅ existing                 | ⬜ pending |
| 40-02-01 | 40-02 | 2    | SUB-02..07, SETTINGS-04 (D-12, D-13)                | T-40-04..T-40-08, T-40-29          | Full engine rule spec authored before implementation (RED), incl. the empty-bench and red-carded-bench-entry rejections                                                       | unit (engine) **W0**  | `pnpm --filter @counter-attack/server test -- gameEngine.substitution`                                | ❌ new (created in W0)      | ⬜ pending |
| 40-02-02 | 40-02 | 2    | SUB-02, SUB-03, SUB-04, SUB-06, SUB-07, SETTINGS-04 | T-40-04, T-40-05, T-40-06, T-40-29 | All eligibility guards enforced server-side before any mutation; no budget-refresh exploit; a red-carded bench entry can never return to the pitch                            | unit (engine)         | `pnpm --filter @counter-attack/server test -- gameEngine.substitution`                                | ✅ (40-02-01)               | ⬜ pending |
| 40-02-03 | 40-02 | 2    | SUB-05                                              | T-40-07                            | Added time increments by exactly 1 per substitution; per-half bonus resets, match cap does not                                                                                | unit (engine)         | `pnpm --filter @counter-attack/server test -- gameEngine.substitution` and `-- gameEngine.phase8`     | ✅ (40-02-01)               | ⬜ pending |
| 40-03-01 | 40-03 | 2    | SUB-02, SUB-03, SUB-06, SUB-07 (D-12, D-13)         | T-40-09, T-40-30                   | Mid-match roster spec authored before implementation (RED), incl. all three bench states and the empty-bench state                                                            | component **W0**      | `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen`                                 | ✅ extend existing          | ⬜ pending |
| 40-03-02 | 40-03 | 2    | SUB-07 (D-13)                                       | T-40-09, T-40-30                   | Subbed-out bench cards are dimmed/badged OUT; red-carded bench cards are dimmed/badged RED CARD; both are non-draggable and visually distinct                                 | component             | `pnpm --filter @counter-attack/client test -- BenchCarousel`                                          | ✅ existing                 | ⬜ pending |
| 40-03-03 | 40-03 | 2    | SUB-02, SUB-03, SUB-06, SUB-07                      | T-40-09, T-40-10                   | Drag emits one substitution intent; red-carded targets and red-carded/subbed-out sources emit none; own-team data only                                                        | component             | `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen`                                 | ✅ (40-03-01)               | ⬜ pending |
| 40-04-01 | 40-04 | 3    | SUB-03, SUB-02 (D-12)                               | T-40-11                            | Every piece carries a server-assigned pool identity; the supplied bench is stored verbatim and an empty bench is never filled from any pool                                   | unit (engine) **W0**  | `pnpm --filter @counter-attack/server test -- gameEngine.teamselect` and `-- gameEngine.substitution` | ✅ existing + ✅ (40-02-01) | ⬜ pending |
| 40-04-02 | 40-04 | 3    | SUB-02, SUB-07, SETTINGS-04 (D-12)                  | T-40-11                            | Bench derived from server-held draft/assignment state, never the client payload; standard rooms reach kick-off with an empty bench and no generation                          | integration (server)  | `pnpm --filter @counter-attack/server test -- lineupAssignment`                                       | ✅ existing                 | ⬜ pending |
| 40-04-03 | 40-04 | 3    | SUB-03, SUB-06, SUB-07                              | T-40-12, T-40-13                   | Goals and half-time cannot resurrect a substituted player or launder a red card; bench entries persist across resets                                                          | unit (engine)         | `pnpm --filter @counter-attack/server test -- gameEngine.substitution`                                | ✅ (40-02-01)               | ⬜ pending |
| 40-04-04 | 40-04 | 3    | SUB-06, SUB-07 (D-13)                               | T-40-27, T-40-31                   | A red card appends a `status: 'redCarded'` bench entry from server rule code only; the piece stays in `pieces` so `11 - redCardCount` is unchanged                            | unit (engine) **W0**  | `pnpm --filter @counter-attack/server test -- gameEngine.substitution` and `-- gameEngine.booking`    | ✅ (40-02-01) + ✅ existing | ⬜ pending |
| 40-05-01 | 40-05 | 3    | SUB-01, SUB-02, SETTINGS-04 (D-12, D-13)            | T-40-14..T-40-18, T-40-32          | Socket-level guard/mutex/error-code spec authored before implementation (RED)                                                                                                 | unit (handler) **W0** | `pnpm --filter @counter-attack/server test -- gameHandlers.substitution`                              | ❌ new (created in W0)      | ⬜ pending |
| 40-05-02 | 40-05 | 3    | SUB-01, SUB-02, SUB-06, SUB-07, SETTINGS-04         | T-40-14..T-40-18, T-40-32          | Server rejects non-stoppage, cross-team, malformed and double-submitted substitutions; every rejection reason reaches the client verbatim                                     | unit (handler)        | `pnpm --filter @counter-attack/server test -- gameHandlers.substitution`                              | ✅ (40-05-01)               | ⬜ pending |
| 40-05-03 | 40-05 | 3    | SUB-03, SUB-07                                      | T-40-12                            | Handler-side goal resets preserve the live roster and the bench                                                                                                               | unit (handler)        | `pnpm --filter @counter-attack/server test -- gameHandlers.substitution`                              | ✅ (40-05-01)               | ⬜ pending |
| 40-06-01 | 40-06 | 3    | SUB-02                                              | T-40-21                            | Client emits intent only; no optimistic roster mutation                                                                                                                       | unit (store)          | `pnpm --filter @counter-attack/client test -- useGameStore`                                           | ✅ existing                 | ⬜ pending |
| 40-06-02 | 40-06 | 3    | SUB-01                                              | T-40-20, T-40-21                   | Persistent-affordance gating spec authored before implementation (RED)                                                                                                        | component **W0**      | `pnpm --filter @counter-attack/client test -- GameBoard`                                              | ✅ extend existing          | ⬜ pending |
| 40-06-03 | 40-06 | 3    | SUB-01, SUB-04, SUB-06                              | T-40-19, T-40-20                   | Modal is own-team scoped and force-closes when the stoppage ends                                                                                                              | component             | `pnpm --filter @counter-attack/client test -- GameBoard`                                              | ✅ (40-06-02)               | ⬜ pending |
| 40-07-01 | 40-07 | 4    | SUB-01..07, SETTINGS-04, D-12, D-13                 | T-40-22, T-40-23, T-40-24, T-40-33 | Two real clients, one authoritative roster; no cross-team interference, no added-time drift; red-card bench relocation and the empty standard-room bench proven over the wire | integration (server)  | `pnpm --filter @counter-attack/server test -- substitution.integration`                               | ❌ new                      | ⬜ pending |
| 40-07-02 | 40-07 | 4    | SUB-01..07, D-12, D-13                              | —                                  | Human confirmation of the two-browser interaction incl. the RED CARD bench badge and the calm empty-bench standard room (checkpoint, blocking)                                | manual                | n/a — `checkpoint:human-verify`                                                                       | n/a                         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Each item is created by the task listed, inside the plan that consumes it, before any
task in that plan implements the asserted behaviour.

- [ ] `packages/shared/src/stoppagePhases.test.ts` — task **40-01-01** — `isStoppagePhase()` across all 44 `GamePhase` values, `MAX_SUBS_PER_TEAM`, `maxOnPitchFor()`
- [ ] `packages/server/src/__tests__/gameEngine.substitution.test.ts` — task **40-02-01** — `applySubstitution` rules (SUB-02/03/04/06/07, SETTINGS-04), the SUB-05 accumulator, `applyRosterContinuity`, the D-12 empty-bench rejection and the D-13 `CANNOT_SUB_IN_RED_CARDED` rejection
- [ ] `packages/server/src/__tests__/gameHandlers.substitution.test.ts` — task **40-05-01** — `GAME_SUBSTITUTION` phase/team/payload guards, mutex, verbatim error codes incl. `CANNOT_SUB_IN_RED_CARDED`
- [ ] Extend `packages/client/src/components/LineupAssignmentScreen.test.tsx` — task **40-03-01** — `mode="midmatch"` rendering (OUT badge, RED CARD badge, sub-counter chip, blocked red-carded target, slot-cap note, empty-bench state, drag-to-substitute)
- [ ] Extend `packages/client/src/components/GameBoard.test.tsx` — task **40-06-02** — persistent SUB affordance gating, modal open/close, own-team scoping
- [ ] Extend `packages/server/src/__tests__/gameEngine.substitution.test.ts` — task **40-04-01** — `playerId` stamping and the verbatim/empty bench pass-through through `buildInitialGameState` (file itself is created earlier by task 40-02-01)
- [ ] Extend `packages/server/src/__tests__/gameEngine.substitution.test.ts` — task **40-04-04** — D-13 `relocateRedCardedToBench` purity/idempotence/team-scoping coverage plus its `resolveFoulChain` integration and the unchanged `maxOnPitchFor` cap (file itself is created earlier by task 40-02-01)
- [ ] `packages/server/src/__tests__/substitution.integration.test.ts` — task **40-07-01** — two-client end-to-end walkthrough, incl. the D-13 red-card bench entry and the D-12 empty standard-room bench

Resolved planning input: the `STOPPAGE_PHASES` membership question (RESEARCH.md Open
Question 1 / Assumption A1) is answered in `40-01-PLAN.md` Task 1 as an explicit 15-value
list, so `stoppagePhases.test.ts` can assert the full 44-value classification.

Revision note (D-11 retraction, 2026-08-16): D-11 (forced substitution on a second injury)
was locked, planned, then retracted by the user — substitution must never be automatic or
forced. Plan `40-08-PLAN.md` and its Wave 0 file
`packages/server/src/__tests__/gameEngine.forcedSubstitution.test.ts` are deleted, and the
`40-08-01/02/03` rows are removed from the map above. Phase 39's shipped INJURY-03 fallback
(`resolveFoulChain`'s "no substitute available" branch) is NOT read or modified by Phase 40,
so `gameEngine.injury.test.ts` remains untouched and every one of its existing expectations
stays valid with no new assertion required.

Revision note (D-10 retraction + D-13 addition, 2026-08-16): D-10 (empty-bench free-agent
auto-fill) was locked, planned into 40-04, then retracted by the user and superseded by
**D-12** — no bench is generated, seeded or auto-filled from any pool. All D-10 coverage is
removed: `seedEmptyBenchFromFreeAgentPool`, `FREE_AGENT_BENCH_ROLES` and
`FREE_AGENT_BENCH_START_NUMBER` are not created, the D-10 Wave-0 bullet is deleted, and the
40-04-01/02 and 40-07-01/02 rows now assert the ORIGINAL expectation: a Standard-mode room
reaches kick-off with an EMPTY bench, the substitution screen is still reachable, and any
substitution attempt is rejected `INVALID_SUBSTITUTE`. That is working-as-intended
behaviour, not a gap; the user will expand team rosters in a future phase.

**D-13** is new: a red-carded player is relocated into `GameState.bench` for their team with
`status: 'redCarded'`, so the roster screen shows who is unavailable and why. It is covered
by new task **40-04-04** (engine relocation, purity and cap-invariance), by extended bench
badge coverage in **40-03-01/02**, by the verbatim `CANNOT_SUB_IN_RED_CARDED` rejection in
**40-02-01/02** and **40-05-01/02**, and end to end in **40-07-01/02**. Phase 39's shipped
red-card behaviour is deliberately unchanged — the piece STAYS in `state.pieces` with
`redCarded: true` / `onPitch: false`, so `gameEngine.booking.test.ts` needs no edited
expectation and `maxOnPitchFor`'s `11 - redCardCount` math (D-08/D-09) is unaffected.

---

## Manual-Only Verifications

- Two-browser interaction walkthrough (task **40-07-02**, blocking checkpoint) — drag feel,
  modal chrome, dimmed/disabled affordance states, the half-time added-time display, the
  D-13 RED CARD bench badge (visually distinct from OUT) and the D-12 Standard-room empty
  bench reading as a calm empty state rather than an error. Every underlying rule is also
  covered automatically; this checkpoint verifies presentation. It sits in wave 4, the final
  wave, so the human sees the complete behaviour rather than a partial build.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency (only 40-07-02 is manual, and it is a presentation checkpoint over already-automated rules)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-assigned 2026-08-16 (revised same day for D-10; revised again for the D-11 retraction; revised again for the D-10 retraction and the D-13 addition)
