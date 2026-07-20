---
phase: 27
slug: game-creation-settings
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
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

| Task ID  | Plan | Wave | Requirement   | Threat Ref | Secure Behavior                                                                                 | Test Type                                   | Automated Command                                                                        | File Exists                       | Status     |
| -------- | ---- | ---- | ------------- | ---------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------- | ---------- |
| 27-01-xx | TBD  | 0    | DRAFT-01      | V4/V5      | Host-only `ROOM_SETTINGS_CONFIRM`, allow-list validated `teamType`/`draftPools`                 | unit + integration                          | `vitest run roomHandlers` / `vitest run room.integration.test.ts`                        | ❌ W0 (new handler test coverage) | ⬜ pending |
| 27-01-xx | TBD  | 0    | DRAFT-01      | —          | `GameSettingsScreen` renders speed/team-type/pool controls; Confirm disabled at 0 pools checked | unit (component)                            | `vitest run GameSettingsScreen.test.tsx`                                                 | ❌ W0 — new file                  | ⬜ pending |
| 27-02-xx | TBD  | 1    | DRAFT-02      | —          | Standard mode: read-only speed subheader replaces interactive picker on both screens            | unit (component)                            | `vitest run TeamSelectionScreen.test.tsx` / `vitest run UniformSelectionScreen.test.tsx` | ✅ (extend existing)              | ⬜ pending |
| 27-03-xx | TBD  | 1    | DRAFT-03      | —          | Draft mode: settings summary line replaces speed picker on both screens                         | unit (component)                            | same files as above, extend                                                              | ✅ (extend existing)              | ⬜ pending |
| 27-01-xx | TBD  | 0    | — (Pitfall 1) | T-27-01    | `TEAM_SELECTION_START` deferred until both settings confirmed AND joiner present (race fix)     | integration (socket wire, timing-sensitive) | new cases in `room.integration.test.ts`                                                  | ⚠️ file exists, cases new         | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/client/src/components/GameSettingsScreen.test.tsx` — new component, no existing coverage
- [ ] Server-side unit/integration tests for `ROOM_SETTINGS_CONFIRM` handler (host-only guard, allow-list validation, both-conditions gate) — extend `room.integration.test.ts` using its existing `createClient`/`waitFor`-style helpers
- [ ] Test case: `ROOM_SETTINGS_CONFIRM` with `draftPools: ['legends']` → rejected (`GAME_ERROR`) — no existing precedent test to copy (Pitfall 3)
- [ ] Test case: `teamType: 'draft', draftPools: []` → `DRAFT_POOL_REQUIRED`; `teamType: 'standard', draftPools: []` → accepted (Pitfall 4)

---

## Manual-Only Verifications

| Behavior                                                                                                   | Requirement     | Why Manual                                                             | Test Instructions                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Scoreboard speed mention fits existing `topBand` layout without visual regression (D-08, soft requirement) | DRAFT-01 (D-08) | Visual layout fit is a UI judgment call, not a unit-testable assertion | Open a live match at 1080p, confirm the speed segment renders inline in `.phaseSummary` without wrapping or crowding team name/phase label |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
