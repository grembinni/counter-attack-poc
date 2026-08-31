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

> Task IDs are assigned by the planner in step 8 — this table maps requirements to test commands; the planner/plan-checker should annotate exact Task IDs/Plan/Wave once tasks are broken out.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | NUMBER-01 | V5 | Starter number assigned once at squad-build, independent of slot recompute on reset | unit | `vitest run src/__tests__/gameEngine.phase23.test.ts` (existing, needs Pitfall 7 rewrite) + new build-time assertion | ✅ existing file, rewrite needed | ⬜ pending |
| TBD | TBD | TBD | NUMBER-02 (reposition) | V5 | Number follows the person, not the slot, on swap | unit | `vitest run src/__tests__/gameEngine.rosterReposition.test.ts` (existing, needs Pitfall 3 rewrite) | ✅ existing file, rewrite needed | ⬜ pending |
| TBD | TBD | TBD | NUMBER-02 (substitution) | V5 | Substitute keeps own permanent number; outgoing player's bench entry gets own number, not the incoming player's old one | unit | `vitest run src/__tests__/gameEngine.substitution.test.ts` (existing "SUB-03" case, needs Pitfall 4 rewrite) | ✅ existing file, rewrite needed | ⬜ pending |
| TBD | TBD | TBD | NUMBER-02 (goal/half-time reset) | V5 | `applyRosterContinuity` preserves permanent number across resets (regression lock — function already correct) | unit | `vitest run src/__tests__/gameEngine.rosterReposition.test.ts` — new regression case with a non-slot-standard number | ✅ existing coverage of function; ❌ explicit permanent-number regression case | ⬜ pending |
| TBD | TBD | TBD | NUMBER-03 | — | Kickoff-striker anchor uses `slotId === 'ST'` lookup, works when striker's number ≠ 9 | unit | `vitest run src/__tests__/formations.test.ts src/__tests__/gameEngine.phase23.test.ts` (existing, needs Pitfall 7 rewrite) | ✅ existing file, rewrite needed | ⬜ pending |
| TBD | TBD | TBD | NUMBER-04 | V5 | All 4 reset call sites (goal-unsaveable, goal-shot-duel, penalty, half-time) preserve permanent number | integration | `vitest run src/__tests__/gameEngine.substitution.test.ts src/__tests__/replay.integration.test.ts` (spot-check via existing reset-covering suites) | ✅ existing coverage, ❌ explicit permanent-number assertion per site | ⬜ pending |
| TBD | TBD | TBD | NUMBER-05 | V6 | Draft-mode bench number assigned once, survives post-`draftComplete` `DRAFT_REARRANGE` (no orphan-to-0) | integration | `vitest run src/__tests__/draftSession.integration.test.ts` (existing bench-number-range coverage, needs new post-rearrange case) | ✅ existing file, new case needed | ⬜ pending |
| TBD | TBD | TBD | (standard-mode bench, Critical Finding 1) | V5/V6 | Standard-mode bench numbers are random 15-99 via `assignBenchNumbers`, unique per team — not `PoolPlayer.number` | unit/integration | New test in `roomHandlers`-adjacent suite or alongside `gameEngine.substitution.test.ts`'s standard-mode bench setup | ❌ Wave 0 — no existing coverage of standard-mode bench number range | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New/updated assertions in `gameEngine.rosterReposition.test.ts` — number follows person, not slot, on swap (Pitfall 3); plus a goal/half-time reset regression case with a non-slot-standard number (Pitfall 2 lock-in)
- [ ] New/updated assertions in `gameEngine.substitution.test.ts` — substitute keeps own number; outgoing player's bench entry gets own number, not the incoming player's old one (Pitfall 4)
- [ ] New/updated assertions in `formations.test.ts` / `gameEngine.phase23.test.ts` — kickoff anchor via `slotId === 'ST'`, verified independent of jersey number (Pitfall 7)
- [ ] New test: standard-mode bench numbers are random 15-99, unique per team, not `PoolPlayer.number` (Pitfall 1 / Critical Finding 1)
- [ ] New test: `DRAFT_REARRANGE` after `draftComplete` moving a lineup player onto the bench yields a valid unique 15-99 number, not `0` (Pitfall 5 / Critical Finding 3)

*No new test framework installation needed — Vitest is already fully configured and in active use across all affected files' existing `.test.ts` siblings.*

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification via Vitest unit/integration tests (server-side, no client changes required per research's Architectural Responsibility Map).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
