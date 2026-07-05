---
phase: 22
slug: uniform-selection-screen
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-05
audited: 2026-07-05
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for the uniform-selection-screen phase.

---

## Test Infrastructure

| Property               | Value                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest (client + server + shared) + React Testing Library (client)                                         |
| **Config files**       | `packages/client/vitest.config.ts`, `packages/server/vitest.config.ts`, `packages/shared/vitest.config.ts` |
| **Quick run command**  | `pnpm --filter @counter-attack/client exec vitest run src/components/UniformSelectionScreen.test.tsx`      |
| **Full suite command** | `pnpm --filter @counter-attack/client test && pnpm --filter @counter-attack/server test`                   |
| **Estimated runtime**  | ~20 seconds (client ~8s, server ~8s)                                                                       |

---

## Sampling Rate

- **After every task commit:** Run `vitest run src/components/UniformSelectionScreen.test.tsx`
- **After every plan wave:** Run full client + server suites
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement   | Threat Ref       | Secure Behavior                                                | Test Type   | File                                                             | Status   |
| -------- | ---- | ---- | ------------- | ---------------- | -------------------------------------------------------------- | ----------- | ---------------------------------------------------------------- | -------- |
| 22-01-01 | 01   | 1    | UNIFORM-04    | T-22-01          | UNIFORM_CONFIRM typed signature narrows payload                | type-check  | `packages/shared/src/events.ts`                                  | ✅ green |
| 22-01-02 | 01   | 1    | UNIFORM-04    | —                | GameState.selectedUniformStyles present in all snapshots       | type-check  | `packages/shared/src/types.ts`                                   | ✅ green |
| 22-01-03 | 01   | 1    | UNIFORM-04    | —                | buildInitialGameState 4-arg, all test call sites compile       | unit        | `packages/server/src/__tests__/gameEngine.teamselect.test.ts`    | ✅ green |
| 22-02-01 | 02   | 2    | UNIFORM-04    | —                | Room type carries awayPickedTeam + homePickedUniformStyle      | type-check  | `packages/server/src/roomStore.ts`                               | ✅ green |
| 22-02-02 | 02   | 2    | UNIFORM-04    | T-22-04          | TEAM_PICK away branch emits UNIFORM_SELECTION_START, no build  | integration | `packages/server/src/__tests__/room.integration.test.ts`         | ✅ green |
| 22-02-03 | 02   | 2    | UNIFORM-04    | T-22-03/04/05/06 | UNIFORM_CONFIRM: allow-list, home-first, mutex, deferred build | integration | `packages/server/src/__tests__/room.integration.test.ts`         | ✅ green |
| 22-03-01 | 03   | 2    | UNIFORM-02/03 | —                | All 18 style tiles render; neutral before team pick (D-05)     | component   | `packages/client/src/components/UniformSelectionScreen.test.tsx` | ✅ green |
| 22-03-02 | 03   | 2    | UNIFORM-03    | —                | defaultUniformStyle pre-selected on team pick                  | component   | `packages/client/src/components/UniformSelectionScreen.test.tsx` | ✅ green |
| 22-03-02 | 03   | 2    | UNIFORM-04    | T-22-07          | Confirm emits UNIFORM_CONFIRM(teamId, styleId)                 | component   | `packages/client/src/components/UniformSelectionScreen.test.tsx` | ✅ green |
| 22-03-03 | 03   | 2    | UNIFORM-04    | —                | Away sees struck-out home card; locked until home confirms     | component   | `packages/client/src/components/UniformSelectionScreen.test.tsx` | ✅ green |
| 22-03-03 | 03   | 2    | UNIFORM-04    | —                | Opponent banner shown after home confirms (D-11)               | component   | `packages/client/src/components/UniformSelectionScreen.test.tsx` | ✅ green |
| 22-03-03 | 03   | 2    | UNIFORM-04    | —                | HexGrid resolves selectedUniformStyles per piece (D-18)        | component   | `packages/client/src/components/HexGrid.test.tsx`                | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior                                                                     | Requirement | Why Manual                                             | Test Instructions                                                                                 |
| ---------------------------------------------------------------------------- | ----------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Two-tab E2E: home picks → confirms → away unlocks → away picks → game starts | UNIFORM-04  | Requires two live browser sessions with real WebSocket | Open `http://localhost:5173` in two tabs; create room, share code; verify full flow end-to-end    |
| Away sees away-color palette on style tiles (not home palette)               | UNIFORM-02  | Visual assertion on rendered colors                    | As away player, pick a team — style tiles should reflect awayPrime/awayAlt, not homePrime/homeAlt |
| Style scale: all 18 styles display correctly at R=30 in tile grid            | UNIFORM-02  | Visual regression — pixel-level fidelity               | Verify all 18 tiles render crisp patterns at selection screen; confirmed by user 2026-07-05       |

---

## Validation Audit 2026-07-05

| Metric                   | Count |
| ------------------------ | ----- |
| Gaps found               | 4     |
| Resolved (automated)     | 4     |
| Escalated to manual-only | 0     |

**Gaps resolved:**

- G1 (PARTIAL): Fixed `UniformSelectionScreen.test.tsx` "away struck-out card" test — updated to reflect `awayLocked` behavior; added new test asserting all cards/tiles disabled before home confirms
- G2 (MISSING): Added `room.integration.test.ts` — WRONG_TURN when away emits UNIFORM_CONFIRM before home
- G3 (MISSING): Added `room.integration.test.ts` — INVALID_STYLE and TEAM_ALREADY_PICKED guards
- G4 (MISSING): Added `HexGrid.test.tsx` — D-18 selectedUniformStyles resolution (checkers vs pinstripes-vertical pattern id check)

---

## Validation Sign-Off

- [x] All tasks have automated verification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 requirements: existing infrastructure covers all requirements
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-05
