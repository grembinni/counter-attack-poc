---
phase: 48
slug: permanent-jersey-numbers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-31
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (server: `vitest run`, config at `packages/server/vitest.config.ts`) |
| **Config file** | `packages/server/vitest.config.ts` — `include: ['src/**/*.test.ts']`, `environment: 'node'` |
| **Quick run command** | `pnpm --filter @counter-attack/server exec vitest run <touched-test-file>` |
| **Full suite command** | `pnpm --filter @counter-attack/server test` |
| **Estimated runtime** | ~30-60 seconds (targeted) / ~2-3 minutes (full server suite) |

**Windows note (project memory):** vitest worker-crash flake is a known intermittent issue on this environment — rerun failed runs with `--pool=forks` before concluding a real regression.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/server exec vitest run <touched-test-file>`
- **After every plan wave:** Run `pnpm --filter @counter-attack/server test`
- **Before `/gsd-verify-work`:** Full suite (`pnpm --filter @counter-attack/server test`) must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> Annotated by the planner on 2026-08-31 against the 6-plan / 3-wave breakdown. `Task ID` uses `<plan>-T<n>` shorthand; `Threat Ref` points at the STRIDE row in the named plan's `<threat_model>` block.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 48-01 T1/T2 | 48-01 | 1 | NUMBER-01 | T-48-01 (V5) | Starter number assigned once at squad-build; no roster mutation re-derives it from the slot | unit | `vitest run src/__tests__/gameEngine.rosterReposition.test.ts` | ✅ existing file, rewritten in 48-01 T1 | ⬜ pending |
| 48-01 T1/T2 | 48-01 | 1 | NUMBER-02 (reposition) | T-48-01 (V5) | Number follows the person, not the slot, on swap | unit | `vitest run src/__tests__/gameEngine.rosterReposition.test.ts` | ✅ existing file, rewritten in 48-01 T1 | ⬜ pending |
| 48-04 T1/T2 | 48-04 | 2 | NUMBER-02 (substitution) | T-48-08/T-48-09 (V5) | Substitute keeps own permanent number; outgoing player's bench entry gets own number, not the incoming player's old one | unit + integration | `vitest run src/__tests__/gameEngine.substitution.test.ts src/__tests__/substitution.integration.test.ts` | ✅ existing files, rewritten in 48-04 T1 | ⬜ pending |
| 48-01 T1/T2 | 48-01 | 1 | NUMBER-02 (goal/half-time reset) | T-48-01 (V5) | `applyRosterContinuity` preserves a non-slot-standard permanent number across resets (regression lock — function already correct) | unit | `vitest run src/__tests__/gameEngine.rosterReposition.test.ts` (new `NUMBER-04` case, `number: 77` fixture) | ✅ existing coverage; new case added in 48-01 T1 | ⬜ pending |
| 48-06 T1/T2 | 48-06 | 3 | NUMBER-03 | T-48-15 (V5) | Kick-off anchor uses `slotId === 'ST'` lookup across all 4 formations × both attacking sides | unit | `vitest run src/__tests__/formations.test.ts src/__tests__/gameEngine.phase23.test.ts` | ✅ existing files, rewritten in 48-06 T1 | ⬜ pending |
| 48-01 T2 | 48-01 | 1 | NUMBER-04 | T-48-01 (V5) | All 4 reset call sites preserve the permanent number — source assertion `grep -c 'const resetPieces = applyRosterContinuity('` = 4 plus the `NUMBER-04` behavior case | unit + source | `vitest run src/__tests__/gameEngine.rosterReposition.test.ts`; `grep -c 'const resetPieces = applyRosterContinuity(' packages/server/src/gameEngine.ts` | ✅ existing coverage; explicit assertion added in 48-01 | ⬜ pending |
| 48-05 T1/T2 | 48-05 | 2 | NUMBER-05 (draft bench) | T-48-11/T-48-14 (V5/V6) | Draft-mode bench number assigned once, survives post-`draftComplete` `DRAFT_REARRANGE` (no orphan-to-0), never re-rolled | integration | `vitest run src/__tests__/draftSession.integration.test.ts` | ✅ existing file, 2 new cases in 48-05 T1 | ⬜ pending |
| 48-02 T1 | 48-02 | 1 | NUMBER-05 (helper) | T-48-05 (V6) | `backfillBenchNumbers` fills gaps only, never re-rolls, never collides, idempotent by reference | unit | `vitest run src/draftSession.test.ts` | ❌ new `describe` block added in 48-02 T1 | ⬜ pending |
| 48-02 T2/T3 | 48-02 | 1 | (standard-mode bench, Critical Finding 1) | T-48-03/T-48-04 (V5/V6) | Standard-mode bench numbers are random 15-99 via `assignBenchNumbers`, unique per team, never colliding with a starting-XI number | integration | `vitest run src/__tests__/lineupAssignment.integration.test.ts src/__tests__/substitution.integration.test.ts` | ❌ new case + 2 stale-range rewrites in 48-02 T2 | ⬜ pending |
| 48-03 T1 | 48-03 | 1 | NUMBER-01 (pregame display) | T-48-06 (V5) | The standard pregame bench renders no jersey number, so no user-visible number change occurs between Step 3 and kick-off | unit (client) | `vitest run src/components/LineupAssignmentScreen.test.tsx` (client package) | ❌ new case added in 48-03 T1 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **[plan 48-01, Task 1]** New/updated assertions in `gameEngine.rosterReposition.test.ts` — number follows person, not slot, on swap (Pitfall 3); plus a goal/half-time reset regression case with a non-slot-standard number (Pitfall 2 lock-in) and a `ROSTER_REPOSITION` event name/number-pairing case
- [ ] **[plan 48-04, Task 1]** New/updated assertions in `gameEngine.substitution.test.ts` (and the `substitution.integration.test.ts` twin at line 608) — substitute keeps own number; outgoing player's bench entry gets own number, not the incoming player's old one (Pitfall 4)
- [ ] **[plan 48-06, Task 1]** New/updated assertions in `formations.test.ts` / `gameEngine.phase23.test.ts` — kickoff anchor via `slotId === 'ST'`, extended to all 4 formations × both attacking sides (Pitfall 7). NOT a RED gate — see 48-06-PLAN.md §"Note on RED gating"
- [ ] **[plan 48-02, Task 2]** New test: standard-mode bench numbers are random 15-99, unique per team, never colliding with a starting-XI number, not `PoolPlayer.number` (Pitfall 1 / Critical Finding 1). Two existing sites pin the stale 12-16 range and must both be rewritten: `lineupAssignment.integration.test.ts:407-408` and `substitution.integration.test.ts:1008-1009`
- [ ] **[plan 48-05, Task 1]** New test: `DRAFT_REARRANGE` after `draftComplete` moving a lineup player onto the bench yields a valid unique 15-99 number, not `0` (Pitfall 5 / Critical Finding 3), plus a repeated-rearrange never-re-roll case
- [ ] **[plan 48-02, Task 1]** New test: `backfillBenchNumbers` unit coverage (fill-gaps, no re-roll, no collision, idempotent by reference, duplicate-id handling, other-side untouched)
- [ ] **[plan 48-03, Task 1]** New test: the standard pregame bench renders zero `#n` markup while still rendering five named placeholder cards

*No new test framework installation needed — Vitest is already fully configured and in active use across all affected files' existing `.test.ts` siblings.*

---

## Manual-Only Verifications

*None — every phase behavior has automated Vitest coverage. Note: research's Architectural Responsibility Map concluded "no client changes required"; a planning-time grep found one exception (`LineupAssignmentScreen.tsx:1392-1393` fabricates pregame bench numbers from `PoolPlayer.number`), handled by plan 48-03 with automated client-side coverage — still no manual-only verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — Task IDs/Plan/Wave annotated by the planner on 2026-08-31 (6 plans, 3 waves).
