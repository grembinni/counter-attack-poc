---
phase: 8
slug: match-lifecycle-post-game-replay
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-04
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| **Framework**          | vitest (shared + server)                                                |
| **Config file**        | `packages/shared/vitest.config.ts` / `packages/server/vitest.config.ts` |
| **Quick run command**  | `pnpm --filter shared test run`                                         |
| **Full suite command** | `pnpm -r test run`                                                      |
| **Estimated runtime**  | ~15 seconds                                                             |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter shared test run && pnpm --filter server test run`
- **After every plan wave:** Run `pnpm -r test run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement    | Threat Ref    | Secure Behavior                                  | Test Type   | Automated Command                                                                                           | File Exists | Status     |
| -------- | ---- | ---- | -------------- | ------------- | ------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 08-01-01 | 01   | 1    | MATCH-03       | T-08-01       | N/A                                              | unit        | `cd packages/shared && pnpm exec vitest run src/actionSequence.test.ts`                                     | ✅          | ⬜ pending |
| 08-01-02 | 01   | 1    | MATCH-01/03/04 | —             | N/A                                              | typecheck   | `cd packages/shared && pnpm exec tsc --noEmit`                                                              | ✅          | ⬜ pending |
| 08-01-03 | 01   | 1    | MATCH-04       | —             | N/A                                              | build       | `cd packages/shared && pnpm build`                                                                          | ✅          | ⬜ pending |
| 08-02-01 | 02   | 2    | MATCH-01/02    | —             | N/A                                              | unit        | `cd packages/server && pnpm exec vitest run src/__tests__/gameEngine.phase8.test.ts -t "clock"`             | ✅          | ⬜ pending |
| 08-02-02 | 02   | 2    | MATCH-03       | —             | N/A                                              | unit        | `cd packages/server && pnpm exec vitest run src/__tests__/gameEngine.phase8.test.ts -t "lastActionType"`    | ✅          | ⬜ pending |
| 08-02-03 | 02   | 2    | SNAP-01        | —             | N/A                                              | unit        | `cd packages/server && pnpm exec vitest run src/__tests__/gameEngine.phase8.test.ts -t "applySnapshot"`     | ✅          | ⬜ pending |
| 08-03-01 | 03   | 2    | MATCH-03       | —             | N/A                                              | unit        | `cd packages/server && pnpm exec vitest run src/__tests__/gameEngine.phase8.test.ts -t "kick-off setup"`    | ✅          | ⬜ pending |
| 08-03-02 | 03   | 2    | REPLAY-01      | —             | N/A                                              | unit        | `cd packages/server && pnpm exec vitest run src/__tests__/gameEngine.phase8.test.ts -t "buildReplayFrames"` | ✅          | ⬜ pending |
| 08-03-03 | 03   | 2    | REPLAY-01      | T-08-15       | replay timer cleanup                             | unit        | `cd packages/server && pnpm exec vitest run src/__tests__/roomStore.test.ts`                                | ✅          | ⬜ pending |
| 08-04-01 | 04   | 4    | MATCH-03/04    | T-08-09/10/11 | placement + team guards; kickOffActive set       | integration | `cd packages/server && pnpm exec vitest run src/__tests__/kickoffSetup.integration.test.ts`                 | ✅          | ⬜ pending |
| 08-04-02 | 04   | 4    | MATCH-03       | T-08-12/16    | sequence + kick-off pass-from-centre enforcement | unit        | `cd packages/server && pnpm exec vitest run src/__tests__/gameHandlers.test.ts && pnpm exec tsc --noEmit`   | ✅          | ⬜ pending |
| 08-04-03 | 04   | 4    | REPLAY-01      | T-08-13/14/15 | replay stream + interval cleanup                 | integration | `cd packages/server && pnpm exec vitest run src/__tests__/replay.integration.test.ts`                       | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Wave 0 is satisfied by the plan structure: every code-producing plan creates its test file inline (TDD task or co-located test). No standalone scaffolding pass is required. The test files the plans create are:

- [x] `packages/shared/src/actionSequence.test.ts` — eligibility table tests (D-08), created inline by 08-01 Task 1 (TDD)
- [x] `packages/server/src/__tests__/gameEngine.phase8.test.ts` — clock / added time / lastActionType / applySnapshot / kick-off setup / buildReplayFrames (MATCH-01..05, SNAP-01..03, REPLAY-01), created/extended inline by 08-02 and 08-03
- [x] `packages/server/src/__tests__/kickoffSetup.integration.test.ts` — over-the-wire kick-off placement + ready transition + kickOffActive (MATCH-03/04), created inline by 08-04 Task 1
- [x] `packages/server/src/__tests__/replay.integration.test.ts` — over-the-wire replay frame timing + cleanup (REPLAY-01), created inline by 08-04 Task 3
- [x] `packages/server/src/__tests__/gameHandlers.test.ts` — sequence + kick-off pass enforcement guards (MATCH-03, D-07/D-27), exercised by 08-04 Task 2

---

## Manual-Only Verifications

| Behavior                                                      | Requirement                 | Why Manual                               | Test Instructions                                                                  |
| ------------------------------------------------------------- | --------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| KICK_OFF_SETUP hex zone tinting visible on pitch              | UI-SPEC §Screen 1           | SVG visual rendering; not unit-testable  | Open two tabs, create/join room; verify zone overlays appear on game start         |
| Half-time "Start 2nd Half" button disabled for correct player | MATCH-04                    | Multi-client interaction                 | Open two tabs; verify only the non-kick-off-team player can click "Start 2nd Half" |
| Post-game replay advances 1 frame per second visually         | REPLAY-01                   | Timing + visual; wall-clock dependent    | Play to full time; verify board pieces animate through event log states            |
| Match time display updates in header (N' / 45+N')             | UI-SPEC §Match Time Display | Visual/display; requires live game state | Play several actions; verify header shows correct time format                      |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (satisfied by inline test creation per plan)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
