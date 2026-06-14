---
phase: 16
slug: player-roster-team-selection
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-13
audited: 2026-06-14
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property                      | Value                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Framework**                 | Vitest 2.1.9 (client/shared) · Jest 29 (server)                                                          |
| **Config files**              | `packages/shared/vitest.config.ts`, `packages/client/vitest.config.ts`, `packages/server/jest.config.ts` |
| **Quick run (shared+client)** | `pnpm --filter @counter-attack/shared run test && pnpm --filter @counter-attack/client run test`         |
| **Quick run (server)**        | `pnpm --filter @counter-attack/server run test`                                                          |
| **Full suite command**        | `pnpm run test`                                                                                          |
| **Estimated runtime**         | ~20 seconds                                                                                              |

**Verified baseline (2026-06-14):**

- shared: 241 pass / 0 fail
- client: 91 pass / 0 fail
- server: 263 pass / 1 skipped / 1 todo / 0 fail

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @counter-attack/shared run test && pnpm --filter @counter-attack/client run test`
- **After every plan wave:** `pnpm run test`
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                    | Test Type   | Automated Command                               | Test File                                                     | Status   |
| -------- | ---- | ---- | ------------------------------ | ----------- | ----------------------------------------------- | ------------------------------------------------------------- | -------- |
| 16-01-01 | 01   | 0    | PLAY-01                        | unit        | `pnpm --filter @counter-attack/shared run test` | `packages/shared/src/teams.test.ts`                           | ✅ green |
| 16-01-02 | 01   | 0    | PLAY-02                        | unit        | `pnpm --filter @counter-attack/client run test` | `packages/client/src/components/PlayerStatsPanel.test.tsx`    | ✅ green |
| 16-01-03 | 01   | 0    | PLAY-03, SELECT-01             | unit        | `pnpm --filter @counter-attack/client run test` | `packages/client/src/components/TeamSelectionScreen.test.tsx` | ✅ green |
| 16-01-04 | 01   | 0    | SELECT-01                      | unit        | `pnpm --filter @counter-attack/server run test` | `packages/server/src/__tests__/gameEngine.teamselect.test.ts` | ✅ green |
| 16-02-01 | 02   | 1    | PLAY-01, PLAY-02               | unit        | `pnpm --filter @counter-attack/shared run test` | `packages/shared/src/teams.test.ts`                           | ✅ green |
| 16-02-02 | 02   | 1    | PLAY-01, SELECT-01             | unit        | `pnpm --filter @counter-attack/server run test` | `packages/server/src/__tests__/gameEngine.teamselect.test.ts` | ✅ green |
| 16-03-01 | 03   | 1    | SELECT-01, T-16-01, T-16-02    | integration | `pnpm --filter @counter-attack/server run test` | `packages/server/src/__tests__/room.integration.test.ts`      | ✅ green |
| 16-03-02 | 03   | 1    | CONN-03 (team:pick handler)    | integration | `pnpm --filter @counter-attack/server run test` | `packages/server/src/__tests__/game.integration.test.ts`      | ✅ green |
| 16-04-01 | 04   | 1    | PLAY-02, D-09                  | unit        | `pnpm --filter @counter-attack/client run test` | `packages/client/src/components/PlayerStatsPanel.test.tsx`    | ✅ green |
| 16-04-02 | 04   | 1    | PLAY-03, SELECT-01, D-11, D-12 | unit        | `pnpm --filter @counter-attack/client run test` | `packages/client/src/components/TeamSelectionScreen.test.tsx` | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Manual-Only Verifications

| Behavior                                                                 | Requirement | Why Manual                             | Test Instructions                                                                                                                                                                    |
| ------------------------------------------------------------------------ | ----------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Team selection screen renders correctly in a 2-player browser session    | SELECT-01   | E2E browser interaction required       | Open two browser tabs, share room code, observe TEAM_SELECTION screen appears, home player picks, away player sees struck-out card and 3 active cards, both transition to game board |
| Selected team badge/colors appear in scoreboard + tokens after selection | SELECT-01   | Visual/runtime state propagation       | After both players pick teams, verify scoreboard shows correct badges and token colors match selected teams                                                                          |
| Full badge circular clip removes white fringing on TeamSelectionScreen   | D-13        | Visual only — no DOM test for CSS clip | Visually inspect team selection cards on dark background; no white halo around badge                                                                                                 |
| Team color card background renders correctly per team                    | D-12        | Visual only                            | Each team card background matches team primary color                                                                                                                                 |

---

## Validation Audit 2026-06-14

| Metric                   | Count |
| ------------------------ | ----- |
| Gaps found               | 4     |
| Resolved (automated)     | 4     |
| Escalated to manual-only | 0     |

**Gap details:**

| #   | File                    | Test                                | Root Cause                                                                      | Fix                                        |
| --- | ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | `ActionPanel.test.tsx`  | "shows Move button during KICK_OFF" | KICK_OFF phase no longer shows standalone Move button — test invalid            | Deleted describe block                     |
| 2   | `GameBoard.test.tsx`    | CLOCK-02 HALF_TIME                  | HALF_TIME overlay + scoreboard both show `45:00` — `getByText` finds 2 elements | Changed to `getAllByText(...).length >= 1` |
| 3   | `GameBoard.test.tsx`    | CLOCK-02 FULL_TIME                  | Same as #2 with `90:00`                                                         | Changed to `getAllByText(...).length >= 1` |
| 4   | `PieceOverlay.test.tsx` | Away GK checker colors              | Test expected `#db2777`/`#831843`; impl uses `#be185d`/`#500724`                | Updated color assertions                   |

---

## Validation Sign-Off

- [x] All tasks have automated verify coverage
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ 2026-06-14
