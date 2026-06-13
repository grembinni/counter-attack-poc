---
phase: 14
slug: kick-off-rules-replay
status: complete
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-12
audited: 2026-06-12
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Reconstructed from SUMMARY files (State B — no VALIDATION.md existed).

---

## Test Infrastructure

| Property                | Value                                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**           | Vitest 2.1.9 (server)                                                                                                                          |
| **Server config**       | `packages/server/vitest.config.ts`                                                                                                             |
| **Phase14 run command** | `pnpm --filter @counter-attack/server exec vitest run src/__tests__/kickoffSetup.integration.test.ts src/__tests__/replay.integration.test.ts` |
| **Full suite command**  | `pnpm --filter @counter-attack/server exec vitest run`                                                                                         |
| **Estimated runtime**   | ~6 seconds (phase14 tests only)                                                                                                                |

---

## Sampling Rate

- **After every task commit:** Run kickoffSetup + replay integration tests
- **After every plan wave:** Run full server suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID  | Plan  | Wave | Requirement | Test File                        | Test Description                                                                                    | Status    |
| -------- | ----- | ---- | ----------- | -------------------------------- | --------------------------------------------------------------------------------------------------- | --------- |
| 14-01-T1 | 14-01 | 1    | MATCH-06    | — (manual Node assertion + UAT)  | DEF/MID q∈[6,20] placement — manual Node assertion during execution; UAT confirmed symmetric mirror | ⚠️ manual |
| 14-01-T2 | 14-01 | 1    | MATCH-07    | kickoffSetup.integration.test.ts | rejects non-Standard-Pass during KICK_OFF with KICKOFF_STANDARD_PASS_ONLY and snaps back            | ✅ green  |
| 14-01-T2 | 14-01 | 1    | MATCH-07    | kickoffSetup.integration.test.ts | does not block Standard Pass during KICK_OFF                                                        | ✅ green  |
| 14-01-T3 | 14-01 | 1    | MATCH-07    | — (UAT manual only)              | ActionPanel isKickOff guard hides non-standard pass buttons in KICK_OFF phase (client)              | ⚠️ manual |
| 14-02-T1 | 14-02 | 1    | REPLAY-06   | — (TypeScript build)             | ballAfter required field on 13 ActionEvent union members — enforced by TypeScript compiler          | ✅ green  |
| 14-02-T2 | 14-02 | 1    | REPLAY-06   | replay.integration.test.ts       | REPLAY-06: each replay frame reflects ball position from ballAfter on the triggering event          | ✅ green  |
| 14-03-T1 | 14-03 | 2    | REPLAY-04   | replay.integration.test.ts       | REPLAY-04: replay stream emits frames at 500ms cadence with 3s pre-roll (fake-timer)                | ✅ green  |
| 14-03-T2 | 14-03 | 2    | REPLAY-05   | replay.integration.test.ts       | REPLAY-05: movement phase replays as K simultaneous step-frames; shorter path holds final hex       | ✅ green  |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ manual/flaky_

**Test counts (Phase 14-specific):** 2 (MATCH-07) + 3 (REPLAY-04/05/06) = **5 new tests, all passing**

---

## Wave 0 Requirements

Wave 0 was not applied — tests were created as part of plan execution:

- `kickoffSetup.integration.test.ts` MATCH-07 tests created in P14-01 (Wave 1)
- `replay.integration.test.ts` REPLAY-06 test created in P14-02 (Wave 1)
- `replay.integration.test.ts` REPLAY-04/05 tests created in P14-03 (Wave 2)

This is the historical record. No retroactive Wave 0 action required.

---

## Manual-Only Verifications

| Behavior                                                                                                                     | Requirement       | Why Manual                                                                                                                                                                                  | Test Instructions                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DEF/MID pieces start within formation bounds at kick-off — Home DEF q=6, Home MID q=10, Away DEF q=30, Away MID q=26         | MATCH-06          | Skipped: automatable via teams.ts unit test but user chose to skip. Requirement text says q∈[6,20] but current positions use symmetric mirror (Away q=30 mirrors Home q=6 on 37-col board). | Open game, reach kick-off, verify Home DEF/MID are near left penalty area and Away DEF/MID are near right penalty area in symmetric formation.                           |
| ActionPanel shows only Standard Pass (and Move) during KICK_OFF phase; no FIRST_TIME_PASS/HIGH_PASS/LONG_BALL/Shoot/Snapshot | MATCH-07 (client) | Skipped: automatable via @testing-library/react but user chose to skip. Server-side guard has 2 integration tests. isKickOff guard at ActionPanel.tsx.                                      | Reach KICK_OFF phase as ball-holding team. Verify only Standard Pass and Move are visible in the action panel. Confirm no other pass/shot buttons appear.                |
| Replay ball tracking — ball position follows correct piece on every replay frame in a live session                           | REPLAY-06         | UAT (14-UAT.md Test 6) confirmed ball tracking bugs deferred to future phase. Unit test covers buildReplayFrames ballAfter path but not all live edge cases.                                | Play a full match with passes, shots, and steals. Trigger post-game replay. Verify ball marker follows correct position through every frame including pickups and goals. |

---

## Validation Sign-Off

- [x] All tasks have automated verify or documented Manual-Only reason
- [ ] Wave 0 applied before execution (not done — tests created during execution)
- [x] Sampling continuity: all phase14 tests run in ~6s
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` — 3 manual-only gaps prevent full compliance

**Approval:** partial — 5/7 automatable tasks covered (2 marked manual-only by user choice); REPLAY-06 unit test passes but UAT-confirmed live bugs deferred (2026-06-12)

---

## Validation Audit 2026-06-12

| Metric               | Count |
| -------------------- | ----- |
| Gaps found           | 2     |
| Resolved (automated) | 0     |
| Marked manual-only   | 2     |
| Tests passing        | 5/5   |

_Note: REPLAY-06 has a passing unit test but UAT deferred live-session ball tracking bugs. Treated as manual-only for live-session coverage._
