---
phase: 43
slug: tackle-steal-prompt-decline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-23
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Framework**          | vitest (packages/shared, packages/server)                                          |
| **Config file**        | packages/shared/vitest config (none — Wave 0 installs if a new spec dir is needed) |
| **Quick run command**  | `pnpm --filter @counter-attack/shared test -- <spec-file>`                         |
| **Full suite command** | `pnpm test` (runs `pnpm -r test` across all workspace packages)                    |
| **Estimated runtime**  | ~15-30 seconds                                                                     |

---

## Sampling Rate

- **After every task commit:** Run the quick command against the touched spec file
- **After every plan wave:** Run `pnpm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement        | Threat Ref  | Secure Behavior                                                                                                                            | Test Type | Automated Command                                           | File Exists | Status     |
| -------- | ---- | ---- | ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------- | ----------- | ---------- |
| 43-01-01 | 01   | 1    | TACKLE-01/02/03/04 | T-43-01 / — | New GamePhase intercepts STEAL_ATTEMPT/TACKLE_ATTEMPT in gameEngine.ts instead of auto-resolving                                           | unit      | `pnpm --filter @counter-attack/shared test -- gameEngine`   | ✅          | ⬜ pending |
| 43-01-02 | 01   | 1    | TACKLE-01/02       | T-43-02 / — | Sequential per-defender ordering by tackling stat, highest first                                                                           | unit      | `pnpm --filter @counter-attack/shared test -- gameEngine`   | ✅          | ⬜ pending |
| 43-01-03 | 01   | 1    | TACKLE-03          | T-43-03 / — | Declined defender's risk ring recomputes live (via existing zoiRiskSet/tackleRiskHexes exclusion) without a new persistent GameState array | unit      | `pnpm --filter @counter-attack/client test -- useGameStore` | ✅          | ⬜ pending |
| 43-02-01 | 02   | 2    | TACKLE-01/04       | T-43-04 / — | New GamePhase/ActionEventType registered in formatEvent, REPLAY_ELIGIBLE_TYPES, applyUndo isBoundary, PHASE_LABEL, STOPPAGE_PHASES         | unit      | `pnpm --filter @counter-attack/shared test -- actionLog`    | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or fixture setup needed — vitest is already configured in packages/shared and packages/server, and the new spec files extend existing gameEngine.test.ts / moveValidator.test.ts patterns.

---

## Manual-Only Verifications

| Behavior                                                                   | Requirement  | Why Manual                                                                                                                                | Test Instructions                                                                                                             |
| -------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| TackleStealPromptPanel visual rendering and waiting-manager message        | TACKLE-01    | Two-button prompt panel visual/interaction parity with GkDiveAtFeetPromptPanel is a UI judgment call not fully covered by unit assertions | Start a local match with the toggle on, trigger a tackle/steal opportunity, confirm both managers see the correct panel state |
| End-to-end decline-then-retry flow across multiple move steps in a browser | TACKLE-02/03 | Requires two connected clients and live dice-roll timing to observe the ring staying active across steps                                  | Play a full movement phase: decline once, move again, confirm the same defender is re-offered                                 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
