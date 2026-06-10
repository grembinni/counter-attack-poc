---
phase: 10
slug: remaining-action-flows-tech-debt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| **Framework**          | Vitest (server + shared packages)                                      |
| **Config file**        | `packages/server/vitest.config.ts`, `packages/shared/vitest.config.ts` |
| **Quick run command**  | `cd packages/server && npx vitest run --reporter=verbose`              |
| **Full suite command** | `pnpm -r test`                                                         |
| **Estimated runtime**  | ~5–10 seconds (server suite)                                           |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/server && npx vitest run`
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID    | Plan | Wave | Requirement                                    | Threat Ref  | Secure Behavior                                              | Test Type        | Automated Command                                               | File Exists                | Status     |
| ---------- | ---- | ---- | ---------------------------------------------- | ----------- | ------------------------------------------------------------ | ---------------- | --------------------------------------------------------------- | -------------------------- | ---------- |
| 10-W0-01   | W0   | 0    | SNAP-02, HEAD-03, D-15, D-17, D-21, D-22, D-29 | —           | Wave 0 stubs                                                 | unit             | `cd packages/server && npx vitest run --reporter=verbose`       | ❌ W0                      | ⬜ pending |
| 10-SHOT-01 | shot | 1    | SHOT-01                                        | T-spoofing  | Shot duel resolves correctly (GOAL/MISS/SAVE/LOOSE_BALL)     | unit             | `npx vitest run -t "SHOT-01"`                                   | ✅ existing                | ⬜ pending |
| 10-SHOT-02 | shot | 1    | SHOT-02                                        | T-spoofing  | Outside penalty area: -1 shooter penalty applied             | unit             | `npx vitest run -t "outside.*penalty"`                          | ✅ existing                | ⬜ pending |
| 10-SHOT-03 | shot | 1    | SHOT-03                                        | T-spoofing  | Auto-miss on die=1                                           | unit             | `npx vitest run -t "SHOT-03"`                                   | ✅ existing                | ⬜ pending |
| 10-SHOT-04 | shot | 1    | SHOT-04                                        | T-tampering | GK dive: 3rd hex = -1 saving; 4+ hexes = unsaveable          | unit             | `npx vitest run -t "SHOT-04\|GK.*dive"`                         | ✅ + integration extension | ⬜ pending |
| 10-SNAP-02 | snap | 2    | SNAP-02                                        | T-tampering | SNAP_DEFLECT phase fires; opponent deflects before shot      | unit+integration | `npx vitest run -t "SNAP-02\|SNAP_DEFLECT"`                     | ❌ W0                      | ⬜ pending |
| 10-SNAP-03 | snap | 2    | SNAP-03                                        | —           | Snapshot uses standard shot rules                            | unit             | `npx vitest run -t "SNAP-03\|snapshot"`                         | ✅ existing                | ⬜ pending |
| 10-HEAD-01 | head | 2    | HEAD-01                                        | —           | Header distance penalty applied                              | unit             | `npx vitest run -t "HEAD-01"`                                   | ✅ existing                | ⬜ pending |
| 10-HEAD-02 | head | 2    | HEAD-02                                        | —           | Uncontested header: no dice                                  | unit             | `npx vitest run -t "HEAD-02\|uncontested"`                      | ✅ existing                | ⬜ pending |
| 10-HEAD-03 | head | 2    | HEAD-03                                        | T-tampering | Goal-line hex → GK save path; no outfield deflection check   | integration      | `npx vitest run -t "HEAD-03\|header.*goal"`                     | ❌ W0                      | ⬜ pending |
| 10-HEAD-04 | head | 2    | HEAD-04                                        | —           | No interception on headed pass; no consecutive headers       | unit             | `npx vitest run -t "HEAD-04"`                                   | ✅ existing                | ⬜ pending |
| 10-HEAD-05 | head | 2    | HEAD-05                                        | —           | Contested piece excluded from next movement                  | unit             | `npx vitest run -t "HEAD-05\|contestedPieceIds"`                | ✅ existing                | ⬜ pending |
| 10-CR-01   | debt | 1    | D-15                                           | T-crash     | startReplayStream re-fetches room inside setTimeout callback | unit             | `npx vitest run -t "replay.*stream\|CR-01"`                     | ❌ W0                      | ⬜ pending |
| 10-WR-02   | debt | 1    | D-17                                           | —           | Intermediate slot transitions reset lastActionType           | unit             | `npx vitest run -t "lastActionType.*slot\|WR-02"`               | ❌ W0                      | ⬜ pending |
| 10-D21     | debt | 1    | D-21                                           | —           | pickWinner uses injected die, not Math.random                | unit             | `npx vitest run -t "pickWinner\|tiebreak"`                      | ❌ W0                      | ⬜ pending |
| 10-D22     | debt | 1    | D-22                                           | —           | GOAL appended to eventLog                                    | unit             | `npx vitest run -t "GOAL.*eventLog\|D-22"`                      | ❌ W0                      | ⬜ pending |
| 10-D25     | debt | 1    | D-25                                           | —           | 3 failing integration tests pass with real squad positions   | integration      | `cd packages/server && npx vitest run game.integration.test.ts` | ✅ (fix existing)          | ⬜ pending |
| 10-D29     | bugs | 2    | D-29                                           | T-tampering | One steal/tackle per piece per phase enforced                | unit             | `npx vitest run -t "stealAttemptedByIds\|one.*steal"`           | ❌ W0                      | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/server/src/__tests__/gameEngine.phase10.test.ts` — stubs for SNAP_DEFLECT phase transition, HEAD-03 goal-line redirect, D-22 GOAL eventLog, D-21 pickWinner determinism, D-17 lastActionType intermediate reset, D-23 HEADER LOOSE_BALL lastActionType
- [ ] `packages/server/src/__tests__/gameHandlers.phase10.test.ts` — stubs for CR-01 stale-reference fix (mock getRoom), D-24 GAME_RESTART_MOVEMENT snap-back, GK_DIVING handler guards, SNAP_DEFLECT GAME_MOVE guard, HEADER target-hex handler
- [ ] Extend `packages/server/src/__tests__/game.integration.test.ts` — fix 3 failing tests using real `HOME_SQUAD`/`AWAY_SQUAD` piece IDs and correct positions on 37×26 board (D-25)
- [ ] `packages/server/src/__tests__/gameEngine.phase10.test.ts` — stub for D-29 steal/tackle attempt tracking

---

## Manual-Only Verifications

| Behavior                                                            | Requirement        | Why Manual                                     | Test Instructions                                                                                                                                                                         |
| ------------------------------------------------------------------- | ------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shot declaration → GK_DIVING → shot auto-resolution in live session | SHOT-01/04, UAT-01 | Requires two-player WebSocket session          | Open two browser tabs; shooter clicks Shoot → clicks goal hex; GK player clicks dive hex → confirms; verify auto-resolution broadcast in both tabs                                        |
| Snapshot full path in MOVEMENT phase                                | SNAP-02, UAT-01    | Requires two-player session + live board state | Ball carrier in penalty area during MOVEMENT; Snapshot button enabled; click Snapshot; SNAP_DEFLECT fires; opponent moves 1 player ≤2 hexes; shot resolves with -1 penalty; no GAME_ERROR |
| Header at goal via goal-line target hex                             | HEAD-03, UAT-02    | Requires live header flow                      | High Pass → HEADER phase; select contestants; attacker clicks goal-line hex as target; GK dives; auto-resolves; both clients consistent                                                   |
| HEADER auto-roll confirmation (no separate Roll button)             | UAT-03             | Design verification                            | After both teams confirm contestants with headerTargetHex set: duel fires immediately; verify no "Roll Header" button appears                                                             |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
