---
phase: 45
slug: game-summary-popup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-28
---

# Phase 45 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (all 3 packages: `shared`, `server`, `client`) |
| **Config file** | `packages/server/vitest.config.ts`, `packages/client/vitest.config.ts`, `packages/shared/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @counter-attack/server test -- gameEngine.matchStats` (or equivalent new test file name) |
| **Full suite command** | `pnpm --filter @counter-attack/server test` / `pnpm --filter @counter-attack/client test` / `pnpm --filter @counter-attack/shared test` |
| **Estimated runtime** | ~15-30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command against the touched spec file
- **After every plan wave:** Run the full suite per package (`pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test && pnpm --filter @counter-attack/client test`)
- **Before `/gsd-verify-work`:** Full suite must be green across all 3 packages
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 45-01-01 | 01 | 1 | STATS-08 | — | xG formula computes correctly for known defender/distance inputs | unit | `pnpm --filter @counter-attack/shared test -- matchStats` | ❌ W0 | ⬜ pending |
| 45-01-02 | 01 | 1 | STATS-08 | — | xG captured at each shot-resolution site using pre-reset piece positions on goals | unit | `pnpm --filter @counter-attack/server test -- gameEngine.matchStats` | ❌ W0 | ⬜ pending |
| 45-01-03 | 01 | 1 | STATS-04 | — | Possession delta attributed to pre-action attackingTeam, accumulates across half-time (never reset) | unit | `pnpm --filter @counter-attack/server test -- roomStore.matchStats` | ❌ W0 | ⬜ pending |
| 45-01-04 | 01 | 1 | STATS-05/06/07/09 | — | Pass/tackle/steal/shot/foul/card counters increment only on matching eventLog entries | unit | `pnpm --filter @counter-attack/server test -- gameEngine.matchStats` | ❌ W0 | ⬜ pending |
| 45-01-05 | 01 | 1 | STATS-06 | — | Declined tackle/steal excluded from attempt denominator | unit | `pnpm --filter @counter-attack/server test -- gameEngine.matchStats` | ❌ W0 | ⬜ pending |
| 45-02-01 | 02 | 2 | STATS-01/02 | V4 (symmetric broadcast) | (i) icon opens modal in every phase incl. mid-duel interrupts; HALF_TIME/FULL_TIME shows same content | component/integration | `pnpm --filter @counter-attack/client test -- GameBoard.matchSummary` | ❌ W0 | ⬜ pending |
| 45-02-02 | 02 | 2 | STATS-03 | — | Settings recap renders all toggles incl. Referee Leniency Manual/Auto distinction | component | `pnpm --filter @counter-attack/client test -- MatchSummaryContent` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/shared/src/matchStats.ts` + `matchStats.test.ts` — pure xG formula function, unit-testable in isolation from any GameState
- [ ] `packages/server/src/__tests__/gameEngine.matchStats.test.ts` — covers STATS-04..09 accumulation logic (mirrors `gameEngine.refereeLeniency.test.ts` naming)
- [ ] `packages/server/src/__tests__/matchStats.integration.test.ts` — full room round-trip, mirrors `refereeLeniency.integration.test.ts` naming
- [ ] `packages/client/src/components/GameBoard.matchSummary.test.tsx` — (i) icon + modal open/close across phases
- [ ] `packages/client/src/components/MatchSummaryContent.test.tsx` — settings recap + stat-row rendering

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Diverging-bar visual rendering matches UI-SPEC (team-accent colors, proportional fill, xG info-icon accordion) | STATS-02/08 | Visual/interaction fidelity to reference-image-derived UI-SPEC is a judgment call not fully covered by unit assertions | Open a local match, trigger the (i) icon mid-match, half-time, and full-time; confirm bar proportions and colors match `45-UI-SPEC.md` |
| Live-updating stats while popup stays open | STATS-01 | Requires two connected clients and live server broadcasts to observe in-place updates without closing/reopening the modal | Open the popup, have the other player take an action (pass/shot/tackle), confirm the open modal's numbers update without manual refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
