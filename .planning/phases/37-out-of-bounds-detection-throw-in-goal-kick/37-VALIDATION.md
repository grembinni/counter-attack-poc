---
phase: 37
slug: out-of-bounds-detection-throw-in-goal-kick
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest (confirmed via `packages/server/vitest.config.ts`, `packages/shared/vitest.config.ts`)                                                |
| **Config file**        | `packages/server/vitest.config.ts` (`environment: 'node'`, `include: ['src/**/*.test.ts']`); `packages/shared/vitest.config.ts` (same shape) |
| **Quick run command**  | `pnpm --filter @counter-attack/shared test -- <pattern>` / `pnpm --filter @counter-attack/server test -- <pattern>`                          |
| **Full suite command** | `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test`                                                     |
| **Estimated runtime**  | ~30 seconds                                                                                                                                  |

---

## Sampling Rate

- **After every task commit:** Run `vitest run -- <changed-file-pattern>` in the relevant package (targeted).
- **After every plan wave:** Run `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test` (full suite; include client suite if any panel-rendering tests are added).
- **Before `/gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 30 seconds.

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement     | Threat Ref | Secure Behavior                                                                                                              | Test Type        | Automated Command                                           | File Exists | Status     |
| -------- | ---- | ---- | --------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------- | ----------- | ---------- |
| 37-01-xx | TBD  | 0    | OOB-01          | —          | `ball.lastTouchedBy` updates on every contact type                                                                           | unit             | `pnpm --filter @counter-attack/server test -- gameEngine`   | ❌ W0       | ⬜ pending |
| 37-01-xx | TBD  | 0    | OOB-02/04       | —          | `classifyExit`/`classifyOutOfBounds` pure functions                                                                          | unit             | `pnpm --filter @counter-attack/shared test -- outOfBounds`  | ❌ W0       | ⬜ pending |
| 37-01-xx | TBD  | 0    | OOB-05          | —          | Toggle off preserves exact existing clamp behavior                                                                           | unit/integration | `pnpm --filter @counter-attack/server test -- gameEngine`   | ❌ W0       | ⬜ pending |
| 37-02-xx | TBD  | 1+   | THROWIN-01..05  | T-37-01    | Full throw-in sequence (placement → movement(s) → throw → possible reclassification), team-spoof and off-pitch-target guards | integration      | `pnpm --filter @counter-attack/server test -- gameHandlers` | ❌ W0       | ⬜ pending |
| 37-03-xx | TBD  | 1+   | GOALKICK-01..06 | T-37-01    | Full goal-kick sequence (reposition ×2 → choice → target/standard → move → resolve), team-spoof and off-pitch-target guards  | integration      | `pnpm --filter @counter-attack/server test -- gameHandlers` | ❌ W0       | ⬜ pending |
| 37-01-xx | TBD  | 0    | Settings toggle | —          | `outOfBoundsEnabled` plumbed through Room → GameState, gates entry point                                                     | unit             | `pnpm --filter @counter-attack/server test -- roomStore`    | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_
_Task IDs are TBD — the planner assigns final plan/task numbering; this table's requirement→test mapping stays authoritative regardless of exact IDs._

---

## Wave 0 Requirements

- [ ] `packages/shared/src/outOfBounds.test.ts` — covers OOB-01/02/04/05's pure classification logic, including the double-boundary-exit default and documented edge cases.
- [ ] Extend `packages/server/src/__tests__/gameEngine.test.ts` (or a new `gameEngine.outOfBounds.test.ts`) — covers the `LOOSE_BALL` clamp hook's toggle-gated branching, `ball.lastTouchedBy` propagation, and the throw-in/goal-kick `apply*` functions.
- [ ] New `packages/server/src/__tests__/throwIn.integration.test.ts` and `goalKick.integration.test.ts` — full socket-handler-level sequences, mirroring `kickoffSetup.integration.test.ts`'s structure.
- [ ] Extend `packages/server/src/__tests__/roomStore.test.ts` — `outOfBoundsEnabled` toggle wiring.
- [ ] No new framework install needed — Vitest is already configured project-wide.

---

## Manual-Only Verifications

_None — all phase behaviors have automated verification per the Phase Requirements → Test Map above._

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
