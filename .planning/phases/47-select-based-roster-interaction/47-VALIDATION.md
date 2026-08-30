---
phase: 47
slug: select-based-roster-interaction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 + React Testing Library (existing, confirmed via `packages/client/package.json` and existing `*.test.tsx` files) |
| **Config file** | `packages/client/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30-60 seconds (targeted) / ~2-3 minutes (full workspace suite) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen` (plus `BenchCarousel`/`DraftPackCarousel` targeted reruns for tasks touching those files)
- **After every plan wave:** Run `pnpm --filter @counter-attack/client test` (full client suite — guards against collateral breakage in `GameBoard.test.tsx`, which renders `LineupAssignmentScreen` in mid-match mode)
- **Before `/gsd-verify-work`:** Full suite (`pnpm test` at repo root) must be green AND `pnpm knip` must be clean (zero output)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner in step 8 — this table maps requirements to test commands; the planner/plan-checker should annotate exact Task IDs/Plan/Wave once tasks are broken out.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | ROSTER-01 | — | Click a mid-match on-pitch card → green/selected visual state | unit (component) | `vitest run LineupAssignmentScreen -t "select"` | ✅ existing file, rewrite needed | ⬜ pending |
| TBD | TBD | TBD | ROSTER-02 | — | Selecting highlights eligible targets blue | unit (component) | same file, new assertions on eligible-target class/prop | ✅ existing file, rewrite needed | ⬜ pending |
| TBD | TBD | TBD | ROSTER-03 | — | Click selected card again → deselect, clears highlights | unit (component) | same file | ❌ Wave 0 — new test | ⬜ pending |
| TBD | TBD | TBD | ROSTER-04 | — | Click eligible target → completes swap/substitute (unchanged confirm flow) | unit (component) | same file, `fireEvent.click`×2 replacing drag/drop simulation | ✅ existing file, rewrite needed | ⬜ pending |
| TBD | TBD | TBD | ROSTER-05 | — | Reposition/substitution eligibility stay two structurally separate functions; selection clears across mode toggle | unit (pure fn) + component (mode-crossing regression) | new test per Pitfall 1 | ❌ Wave 0 — new test | ⬜ pending |
| TBD | TBD | TBD | ROSTER-06 | — | Zero drag-and-drop code remains in `LineupAssignmentScreen.tsx` | static analysis | `pnpm knip` (exit 0, no output) | ✅ tool configured, currently clean | ⬜ pending |
| TBD | TBD | TBD | ROSTER-07 | — | Standard pregame lineup swap via click-select | unit (component) | same file — new/expanded explicit swap-gesture test | ❌ Wave 0 gap — add test | ⬜ pending |
| TBD | TBD | TBD | ROSTER-08 | — | Draft pack/bench/slot click-select (GK-slot and swap-vs-move semantics unchanged) | unit (component) | same file, rewrites ~10 draft drag tests to click equivalents | ✅ existing file, rewrite needed | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `LineupAssignmentScreen.test.tsx` — full rewrite of drag-simulation helpers (`fireEvent.dragStart`/`dragOver`/`drop`/`dragEnd`) to `fireEvent.click` sequences (existing file: 1577 lines / ~90 test cases)
- [ ] `BenchCarousel.test.tsx` — rewrite for the renamed `onCardDragStart` → click-equivalent prop
- [ ] `DraftPackCarousel.test.tsx` — rewrite for the renamed `onCardDragStart` → click-equivalent prop
- [ ] New test: mode-crossing selection-clearing regression (Pitfall 1's recommended test — select in Reposition mode, toggle to Substitute, assert selection cleared)
- [ ] New/expanded test: Standard-pregame explicit click-swap coverage (ROSTER-07)

*No new test framework installation needed — Vitest + RTL are already fully configured and in active use across all 3 affected files' existing `.test.tsx` siblings.*

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification via Vitest + RTL component tests and `pnpm knip` static analysis.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
