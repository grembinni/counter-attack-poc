---
phase: 40
slug: substitutions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-15
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

| Task ID  | Plan | Wave | Requirement | Threat Ref | Secure Behavior                                                                                     | Test Type                                         | Automated Command                                                        | File Exists               | Status     |
| -------- | ---- | ---- | ----------- | ---------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------- | ---------- |
| 40-01-01 | TBD  | 0    | SUB-01      | V4/V5      | Server rejects `GAME_SUBSTITUTION` outside `STOPPAGE_PHASES`                                        | unit (engine)                                     | `pnpm --filter @counter-attack/server test -- gameEngine.substitution`   | ❌ Wave 0 — new test file | ⬜ pending |
| 40-01-02 | TBD  | 0    | SUB-02      | V4/V5      | `GAME_SUBSTITUTION` handler replaces exactly one player, validated against emitting socket's team   | unit (handler)                                    | `pnpm --filter @counter-attack/server test -- gameHandlers.substitution` | ❌ Wave 0                 | ⬜ pending |
| 40-01-03 | TBD  | 0    | SUB-03      | —          | Substitute inherits jersey number + position/slot                                                   | unit (engine)                                     | same file as SUB-01                                                      | ❌ Wave 0                 | ⬜ pending |
| 40-01-04 | TBD  | 0    | SUB-04      | —          | 3-per-match cap enforced, never resets at half-time                                                 | unit (engine) — half-boundary scenario            | same file as SUB-01                                                      | ❌ Wave 0                 | ⬜ pending |
| 40-01-05 | TBD  | 0    | SUB-05      | —          | +1 added-time minute per completed substitution, threaded through all 4 `applyEndTurn` return sites | unit (engine) — extend existing addedTime tests   | existing `gameEngine` addedTime test file                                | ✅ extend existing        | ⬜ pending |
| 40-01-06 | TBD  | 0    | SUB-06      | V4/V5      | Red-carded player cannot be replaced                                                                | unit (engine)                                     | same file as SUB-01                                                      | ❌ Wave 0                 | ⬜ pending |
| 40-01-07 | TBD  | 0    | SUB-07      | V4         | Subbed-out player never returns; roster screen shows "unavailable"                                  | unit (engine) + component                         | `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen`    | ✅ extend existing        | ⬜ pending |
| 40-01-08 | TBD  | 0    | SETTINGS-04 | —          | Substitution available regardless of other v1.6 toggle states                                       | unit (engine) — parametrized across toggle combos | same file as SUB-01                                                      | ❌ Wave 0                 | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_
_This map is a starting scaffold from RESEARCH.md's Phase Requirements → Test Map — the planner assigns real plan/task IDs._

---

## Wave 0 Requirements

- [ ] `packages/server/src/gameEngine.test.ts` (or new `gameEngine.substitution.test.ts`) — covers SUB-01, SUB-02, SUB-03, SUB-04, SUB-06, SETTINGS-04 (engine-level `applySubstitution` unit tests)
- [ ] `packages/server/src/gameHandlers.test.ts` (extend or new) — covers the `GAME_SUBSTITUTION` handler's `isProcessing`/phase-guard/error-code behavior
- [ ] Extend existing `gameEngine` added-time test coverage — covers SUB-05's accumulator fold-in across all 4 `applyEndTurn` return sites
- [ ] Extend `packages/client/src/components/LineupAssignmentScreen.test.tsx` — covers `mode="midmatch"` rendering (OUT badge, sub-counter chip, non-draggable red-carded card, permanent-slot-cap note)
- [ ] New `packages/shared/src/stoppagePhases.test.ts` (or fold into existing shared-predicates test file) — covers `isStoppagePhase()` against the full `GamePhase` union, once Open Question 1 (exact `STOPPAGE_PHASES` membership) is resolved

---

## Manual-Only Verifications

_None — all phase behaviors have automated verification per RESEARCH.md's Phase Requirements → Test Map._

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
