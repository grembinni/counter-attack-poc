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
revision: 'D-10 empty-bench auto-fill retained; D-11 forced-2nd-injury substitution retracted by the user and fully removed (plan 40-08 deleted, 40-07 collapsed back to wave 4)'
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

| Task ID  | Plan  | Wave | Requirement                                         | Threat Ref                | Secure Behavior                                                                                                                                                                                   | Test Type             | Automated Command                                                                                     | File Exists                 | Status     |
| -------- | ----- | ---- | --------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------- | ---------- |
| 40-01-01 | 40-01 | 1    | SUB-01, SUB-04, SUB-06                              | T-40-02                   | `isStoppagePhase` is a single shared predicate; client and server can never diverge                                                                                                               | unit (shared) **W0**  | `pnpm --filter @counter-attack/shared test -- stoppagePhases`                                         | ❌ new (created in W0)      | ⬜ pending |
| 40-01-02 | 40-01 | 1    | SUB-02, SUB-05, SUB-07                              | T-40-01, T-40-03          | Substitution contract types exist; payload typing is declarative only, never a runtime gate                                                                                                       | typecheck             | `pnpm --filter @counter-attack/shared test`                                                           | ✅ existing                 | ⬜ pending |
| 40-01-03 | 40-01 | 1    | SUB-02                                              | T-40-08                   | `SUBSTITUTION` is an Undo boundary on both tiers and is deliberately replay-excluded                                                                                                              | unit (both tiers)     | `pnpm --filter @counter-attack/client test -- ActionPanel`                                            | ✅ existing                 | ⬜ pending |
| 40-02-01 | 40-02 | 2    | SUB-02..07, SETTINGS-04                             | T-40-04..T-40-08          | Full engine rule spec authored before implementation (RED)                                                                                                                                        | unit (engine) **W0**  | `pnpm --filter @counter-attack/server test -- gameEngine.substitution`                                | ❌ new (created in W0)      | ⬜ pending |
| 40-02-02 | 40-02 | 2    | SUB-02, SUB-03, SUB-04, SUB-06, SUB-07, SETTINGS-04 | T-40-04, T-40-05, T-40-06 | All eligibility guards enforced server-side before any mutation; no budget-refresh exploit                                                                                                        | unit (engine)         | `pnpm --filter @counter-attack/server test -- gameEngine.substitution`                                | ✅ (40-02-01)               | ⬜ pending |
| 40-02-03 | 40-02 | 2    | SUB-05                                              | T-40-07                   | Added time increments by exactly 1 per substitution; per-half bonus resets, match cap does not                                                                                                    | unit (engine)         | `pnpm --filter @counter-attack/server test -- gameEngine.substitution` and `-- gameEngine.phase8`     | ✅ (40-02-01)               | ⬜ pending |
| 40-03-01 | 40-03 | 2    | SUB-02, SUB-03, SUB-06, SUB-07                      | T-40-09                   | Mid-match roster spec authored before implementation (RED)                                                                                                                                        | component **W0**      | `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen`                                 | ✅ extend existing          | ⬜ pending |
| 40-03-02 | 40-03 | 2    | SUB-07                                              | T-40-09                   | Subbed-out bench cards are dimmed, badged OUT and non-draggable                                                                                                                                   | component             | `pnpm --filter @counter-attack/client test -- BenchCarousel`                                          | ✅ existing                 | ⬜ pending |
| 40-03-03 | 40-03 | 2    | SUB-02, SUB-03, SUB-06, SUB-07                      | T-40-09, T-40-10          | Drag emits one substitution intent; red-carded targets emit none; own-team data only                                                                                                              | component             | `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen`                                 | ✅ (40-03-01)               | ⬜ pending |
| 40-04-01 | 40-04 | 3    | SUB-03, SUB-02, SETTINGS-04 (D-10)                  | T-40-11, T-40-25, T-40-26 | Every piece carries a server-assigned pool identity; an empty bench is auto-filled server-side with 4 free agents (one per GK/DEF/MID/FWD, jersey 12-15, home/away disjoint) with no client input | unit (engine) **W0**  | `pnpm --filter @counter-attack/server test -- gameEngine.teamselect` and `-- gameEngine.substitution` | ✅ existing + ✅ (40-02-01) | ⬜ pending |
| 40-04-02 | 40-04 | 3    | SUB-02, SUB-07, SETTINGS-04 (D-10)                  | T-40-11, T-40-25          | Bench derived from server-held draft/assignment state, never the client payload; standard rooms reach kick-off with the 4-entry auto-filled bench                                                 | integration (server)  | `pnpm --filter @counter-attack/server test -- lineupAssignment`                                       | ✅ existing                 | ⬜ pending |
| 40-04-03 | 40-04 | 3    | SUB-03, SUB-06, SUB-07                              | T-40-12, T-40-13          | Goals and half-time cannot resurrect a substituted player or launder a red card                                                                                                                   | unit (engine)         | `pnpm --filter @counter-attack/server test -- gameEngine.substitution`                                | ✅ (40-02-01)               | ⬜ pending |
| 40-05-01 | 40-05 | 3    | SUB-01, SUB-02, SETTINGS-04                         | T-40-14..T-40-18          | Socket-level guard/mutex/error-code spec authored before implementation (RED)                                                                                                                     | unit (handler) **W0** | `pnpm --filter @counter-attack/server test -- gameHandlers.substitution`                              | ❌ new (created in W0)      | ⬜ pending |
| 40-05-02 | 40-05 | 3    | SUB-01, SUB-02, SUB-06, SUB-07, SETTINGS-04         | T-40-14..T-40-18          | Server rejects non-stoppage, cross-team, malformed and double-submitted substitutions                                                                                                             | unit (handler)        | `pnpm --filter @counter-attack/server test -- gameHandlers.substitution`                              | ✅ (40-05-01)               | ⬜ pending |
| 40-05-03 | 40-05 | 3    | SUB-03, SUB-07                                      | T-40-12                   | Handler-side goal resets preserve the live roster                                                                                                                                                 | unit (handler)        | `pnpm --filter @counter-attack/server test -- gameHandlers.substitution`                              | ✅ (40-05-01)               | ⬜ pending |
| 40-06-01 | 40-06 | 3    | SUB-02                                              | T-40-21                   | Client emits intent only; no optimistic roster mutation                                                                                                                                           | unit (store)          | `pnpm --filter @counter-attack/client test -- useGameStore`                                           | ✅ existing                 | ⬜ pending |
| 40-06-02 | 40-06 | 3    | SUB-01                                              | T-40-20, T-40-21          | Persistent-affordance gating spec authored before implementation (RED)                                                                                                                            | component **W0**      | `pnpm --filter @counter-attack/client test -- GameBoard`                                              | ✅ extend existing          | ⬜ pending |
| 40-06-03 | 40-06 | 3    | SUB-01, SUB-04, SUB-06                              | T-40-19, T-40-20          | Modal is own-team scoped and force-closes when the stoppage ends                                                                                                                                  | component             | `pnpm --filter @counter-attack/client test -- GameBoard`                                              | ✅ (40-06-02)               | ⬜ pending |
| 40-07-01 | 40-07 | 4    | SUB-01..07, SETTINGS-04, D-10                       | T-40-22, T-40-23, T-40-24 | Two real clients, one authoritative roster; no cross-team interference, no added-time drift; standard-room auto-filled bench proven over the wire                                                 | integration (server)  | `pnpm --filter @counter-attack/server test -- substitution.integration`                               | ❌ new                      | ⬜ pending |
| 40-07-02 | 40-07 | 4    | SUB-01..07, D-10                                    | —                         | Human confirmation of the two-browser interaction incl. the standard-room auto-filled bench (checkpoint, blocking)                                                                                | manual                | n/a — `checkpoint:human-verify`                                                                       | n/a                         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Each item is created by the task listed, inside the plan that consumes it, before any
task in that plan implements the asserted behaviour.

- [ ] `packages/shared/src/stoppagePhases.test.ts` — task **40-01-01** — `isStoppagePhase()` across all 44 `GamePhase` values, `MAX_SUBS_PER_TEAM`, `maxOnPitchFor()`
- [ ] `packages/server/src/__tests__/gameEngine.substitution.test.ts` — task **40-02-01** — `applySubstitution` rules (SUB-02/03/04/06/07, SETTINGS-04), the SUB-05 accumulator, and `applyRosterContinuity`
- [ ] `packages/server/src/__tests__/gameHandlers.substitution.test.ts` — task **40-05-01** — `GAME_SUBSTITUTION` phase/team/payload guards, mutex, error codes
- [ ] Extend `packages/client/src/components/LineupAssignmentScreen.test.tsx` — task **40-03-01** — `mode="midmatch"` rendering (OUT badge, sub-counter chip, blocked red-carded target, slot-cap note, drag-to-substitute)
- [ ] Extend `packages/client/src/components/GameBoard.test.tsx` — task **40-06-02** — persistent SUB affordance gating, modal open/close, own-team scoping
- [ ] Extend `packages/server/src/__tests__/gameEngine.substitution.test.ts` — task **40-04-01** — D-10 `seedEmptyBenchFromFreeAgentPool` role/jersey/exclusion/determinism coverage and the per-team empty-only auto-fill in `buildInitialGameState` (file itself is created earlier by task 40-02-01)
- [ ] `packages/server/src/__tests__/substitution.integration.test.ts` — task **40-07-01** — two-client end-to-end walkthrough, incl. the D-10 standard-room bench

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
stays valid with no new assertion required. D-10 (empty-bench free-agent auto-fill) is
unaffected and remains fully covered by tasks 40-04-01/02 and 40-07-01/02.

---

## Manual-Only Verifications

- Two-browser interaction walkthrough (task **40-07-02**, blocking checkpoint) — drag feel,
  modal chrome, dimmed/disabled affordance states, the half-time added-time display, and
  the D-10 standard-room free-agent bench rendering. Every underlying rule is also covered
  automatically; this checkpoint verifies presentation. It sits in wave 4, the final wave,
  so the human sees the complete behaviour rather than a partial build.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency (only 40-07-02 is manual, and it is a presentation checkpoint over already-automated rules)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-assigned 2026-08-16 (revised same day for D-10; revised again for the D-11 retraction)
