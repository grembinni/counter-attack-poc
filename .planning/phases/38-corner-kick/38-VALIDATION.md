---
phase: 38
slug: corner-kick
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest (`packages/server/vitest.config.ts`, `packages/shared/vitest.config.ts`)                                                              |
| **Config file**        | `packages/server/vitest.config.ts` (`environment: 'node'`, `include: ['src/**/*.test.ts']`); `packages/shared/vitest.config.ts` (same shape) |
| **Quick run command**  | `pnpm --filter @counter-attack/shared test -- <pattern>` / `pnpm --filter @counter-attack/server test -- <pattern>`                          |
| **Full suite command** | `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test && pnpm --filter @counter-attack/client test`        |
| **Estimated runtime**  | ~30-60 seconds                                                                                                                               |

---

## Sampling Rate

- **After every task commit:** Run targeted `vitest run -- <changed-file-pattern>` in the relevant package
- **After every plan wave:** Run `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test` (plus client suite if panel-rendering tests were added)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement           | Threat Ref | Secure Behavior                                                                                                                                                                           | Test Type          | Automated Command                                                                                                  | File Exists | Status     |
| -------- | ---- | ---- | --------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| 38-XX-01 | TBD  | 0    | OOB-03                | V4/V5      | `triggerOutOfBoundsRestart`'s new `CORNER_KICK` branch (team inversion, hex resolution) never trusts client-claimed team                                                                  | unit               | `pnpm --filter @counter-attack/server test -- gameEngine`                                                          | ❌ W0       | ⬜ pending |
| 38-XX-02 | TBD  | 0    | CORNER-01             | V4         | Turn-based GK reposition, attacker's GK first, `socketTeam` guard on every submission                                                                                                     | unit + integration | `pnpm --filter @counter-attack/server test -- gameEngine` / `gameHandlers`                                         | ❌ W0       | ⬜ pending |
| 38-XX-03 | TBD  | 0    | CORNER-02             | V4/V5      | Kicking manager selects any own piece; teleports to correct fixed hex; occupied-hex relocation; team-ownership check before teleport                                                      | unit               | `pnpm --filter @counter-attack/server test -- gameEngine`                                                          | ❌ W0       | ⬜ pending |
| 38-XX-04 | TBD  | 0    | CORNER-03             | V4/V5      | 6-stage alternating window: max-2-per-stage, per-piece 6-hex cumulative budget persisting across stages (not resetting per-stage), server-side pace tracking                              | unit               | `pnpm --filter @counter-attack/shared test -- offside` / `pnpm --filter @counter-attack/server test -- gameEngine` | ❌ W0       | ⬜ pending |
| 38-XX-05 | TBD  | 0    | CORNER-04 / CORNER-05 | V5         | High/Low accuracy gate (8+ combined-score), penalty-area-conditional unlimited range for High (server-side `isInRegion` check, never trust client claim), header requirement only on High | unit + integration | `pnpm --filter @counter-attack/server test -- gameEngine`                                                          | ❌ W0       | ⬜ pending |
| 38-XX-06 | TBD  | 0    | CORNER-06             | V4/V5      | Pre-kick 1-piece/team ≤3-hex slot alternation, attacking manager first, server-side cumulative pace tracking                                                                              | unit + integration | `pnpm --filter @counter-attack/server test -- gameEngine`                                                          | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

_Plan/task IDs above are placeholders (TBD) — the planner assigns actual Plan/Task IDs; this map's Requirement→Test-Type/Command/Wave-0-gap columns are authoritative and must be honored regardless of final task numbering._

---

## Wave 0 Requirements

- [ ] New corner-kick trigger + all 5-6 new `apply*` function unit tests in `packages/server/src/__tests__/gameEngine.test.ts` (or a new `gameEngine.cornerKick.test.ts`, mirroring how Goal Kick's tests were organized)
- [ ] New `CORNER_KICK_STAGES`/`cornerKickStageTeam` unit tests in `packages/shared/src/offside.test.ts` (or wherever `CORNER_KICK_STAGES` is placed), mirroring `FREE_KICK_STAGES`'s existing coverage
- [ ] New `packages/server/src/__tests__/cornerKick.integration.test.ts`, mirroring `goalKick.integration.test.ts`'s full socket-handler-level sequence structure
- [ ] No new framework install needed — Vitest is already configured project-wide

---

## Manual-Only Verifications

_All phase behaviors have automated verification via Vitest unit/integration tests. UI panel rendering (`CornerKickSetupPanel.tsx`) should additionally be manually exercised end-to-end in-browser per CLAUDE.md's UI-testing guidance, but has no behavior that is manual-ONLY (untestable by automation)._

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
