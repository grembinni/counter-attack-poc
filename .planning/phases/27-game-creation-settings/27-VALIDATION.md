---
phase: 27
slug: game-creation-settings
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-20
audited: 2026-07-21
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9 (client) / Vitest (server, same monorepo-pinned version)                                                         |
| **Config file**        | none — colocated per package via `vite.config.ts` (`test` block); no repo-root `vitest.config.*`                              |
| **Quick run command**  | `pnpm --filter @counter-attack/client test -- <changed-file>` / `pnpm --filter @counter-attack/server test -- <changed-file>` |
| **Full suite command** | `pnpm -r test`                                                                                                                |
| **Estimated runtime**  | ~30-60 seconds (monorepo full suite, per prior phase norms)                                                                   |

---

## Sampling Rate

- **After every task commit:** Run targeted `vitest run <changed-file>.test.ts(x)`
- **After every plan wave:** Run `pnpm -r test` (full client + server suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID  | Plan  | Wave | Requirement           | Threat Ref      | Secure Behavior                                                                                                          | Test Type                                | Automated Command                                                     | File Exists                           | Status                                                             |
| -------- | ----- | ---- | --------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| 27-01-01 | 27-01 | 1    | DRAFT-01              | T-27-01/T-27-02 | `TeamType`/`DraftPoolId`/`SELECTABLE_DRAFT_POOLS` defined; allow-list narrower than the type (Pitfall 3)                 | typecheck                                | `pnpm --filter @counter-attack/shared typecheck`                      | ✅ (existing file, additive)          | ✅ green                                                           |
| 27-01-02 | 27-01 | 1    | DRAFT-01              | —               | `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` typed event pair compiles; `TEAM_SPEED_SET` unchanged                  | typecheck                                | `pnpm --filter @counter-attack/shared typecheck`                      | ✅ (existing file, additive)          | ✅ green                                                           |
| 27-02-01 | 27-02 | 2    | DRAFT-01 (Pitfall 1)  | T-27-01..05     | RED: 5 failing integration cases (host-only, allow-list, lock, conditional pool count, race gate)                        | integration (socket wire)                | `pnpm --filter @counter-attack/server test -- room.integration`       | ✅ 14 cases incl. 5 new               | ✅ green                                                           |
| 27-02-02 | 27-02 | 2    | DRAFT-01 (Pitfall 1)  | T-27-01..05     | GREEN: handler + Room fields + gated `TEAM_SELECTION_START` implemented; all 5 cases pass                                | integration (socket wire) + typecheck    | `pnpm --filter @counter-attack/server test -- room.integration`       | ✅ 14 cases incl. 5 new               | ✅ green                                                           |
| 27-03-01 | 27-03 | 2    | DRAFT-01              | —               | Shared `SPEED_OPTIONS` extracted; `GAME_SETTINGS` Screen union member added                                              | typecheck                                | `pnpm --filter @counter-attack/client typecheck`                      | ✅ created in 27-03                   | ✅ green                                                           |
| 27-03-02 | 27-03 | 2    | DRAFT-01              | T-27-02/T-27-04 | `GameSettingsScreen` renders speed/team-type/pool controls; Confirm disabled at 0 pools checked (D-06)                   | unit (component)                         | `pnpm --filter @counter-attack/client test -- GameSettingsScreen`     | ✅ 11 tests                           | ✅ green                                                           |
| 27-03-03 | 27-03 | 2    | DRAFT-01              | T-27-06         | Host routes to `GAME_SETTINGS` after Create Room; Confirm emits `ROOM_SETTINGS_CONFIRM`; joiner never sees the screen    | unit (component/integration) + typecheck | `pnpm --filter @counter-attack/client test -- App`                    | ✅ created via Nyquist audit, 5 tests | ✅ green                                                           |
| 27-04-01 | 27-04 | 3    | DRAFT-02, DRAFT-03    | —               | `UniformSelectionScreen` (live path): read-only speed subheader (standard) / summary line (draft), no interactive picker | unit (component)                         | `pnpm --filter @counter-attack/client test -- UniformSelectionScreen` | ✅ (extend existing)                  | ✅ green                                                           |
| 27-04-02 | 27-04 | 3    | DRAFT-02, DRAFT-03    | —               | `TeamSelectionScreen` (dead twin, consistency-only): identical conversion; `handleSpeedChange` removed from App.tsx      | unit (component) + typecheck + lint      | `pnpm --filter @counter-attack/client test -- TeamSelectionScreen`    | ✅ (extend existing)                  | ✅ green                                                           |
| 27-05-01 | 27-05 | 4    | DRAFT-01 (D-08, soft) | T-27-08         | Scoreboard shows read-only active-speed segment derived from `gameState.gameSpeed` — additive, no layout rework          | unit (component)                         | `pnpm --filter @counter-attack/client test -- GameBoard`              | ✅ (extend existing)                  | ✅ green                                                           |
| 27-05-02 | 27-05 | 4    | DRAFT-01/02/03        | —               | Human checkpoint: full two-tab flow incl. race ordering, approved                                                        | manual (blocking checkpoint)             | n/a — `checkpoint:human-verify`                                       | n/a                                   | ✅ done — approved in 27-05; re-confirmed via 27-UAT.md 2026-07-21 |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `packages/client/src/components/GameSettingsScreen.test.tsx` — new component, no existing coverage
- [x] Server-side unit/integration tests for `ROOM_SETTINGS_CONFIRM` handler (host-only guard, allow-list validation, both-conditions gate) — extend `room.integration.test.ts` using its existing `createClient`/`waitFor`-style helpers
- [x] Test case: `ROOM_SETTINGS_CONFIRM` with `draftPools: ['legends']` → rejected (`GAME_ERROR`) — no existing precedent test to copy (Pitfall 3)
- [x] Test case: `teamType: 'draft', draftPools: []` → `DRAFT_POOL_REQUIRED`; `teamType: 'standard', draftPools: []` → accepted (Pitfall 4)

---

## Manual-Only Verifications

| Behavior                                                                                                   | Requirement     | Why Manual                                                             | Test Instructions                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Scoreboard speed mention fits existing `topBand` layout without visual regression (D-08, soft requirement) | DRAFT-01 (D-08) | Visual layout fit is a UI judgment call, not a unit-testable assertion | Open a live match at 1080p, confirm the speed segment renders inline in `.phaseSummary` without wrapping or crowding team name/phase label |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-20 (verified against final PLAN.md task IDs post plan-checker pass)

---

## Validation Audit 2026-07-21

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 1     |
| Resolved   | 1     |
| Escalated  | 0     |

All 10 automated rows re-run and confirmed green: shared typecheck, `room.integration.test.ts` (14 tests incl. race gate), client typecheck, `GameSettingsScreen.test.tsx` (11 tests), `UniformSelectionScreen.test.tsx`, `TeamSelectionScreen.test.tsx`, `GameBoard.test.tsx`. The 27-05-02 manual checkpoint (previously approved) was independently re-confirmed end-to-end via a `/gsd-verify-work` UAT session (`27-UAT.md`, 7/7 passed).

**Gap found:** Task 27-03-03 claimed automated coverage via `pnpm --filter @counter-attack/client test -- App`, but no `App.test.*` file existed anywhere in `packages/client/src` — App.tsx's `GAME_SETTINGS` routing, the `ROOM_SETTINGS_CONFIRM` emit, the joiner-never-routes guarantee, and the `onRoomSettingsConfirmed` receipt handler had zero automated coverage.

**Resolved:** `packages/client/src/App.test.tsx` created (5 tests, socket mocked per the existing `vi.mock('../socket.js', ...)` convention) — host routes to `GAME_SETTINGS`, joiner does not, Confirm emits the exact `{ speed, teamType, draftPools }` payload, `onRoomSettingsConfirmed` moves the host to `WAITING`, and a negative case confirms it's a no-op when the host isn't on `GAME_SETTINGS`. `pnpm --filter @counter-attack/client test -- App` — 5/5 passing.
