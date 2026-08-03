---
phase: 36
slug: bug-fixes
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
updated: 2026-08-03
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9 (all 3 packages: shared, server, client; client also uses `jsdom` + `@testing-library/react` 14.3.1)                                                       |
| **Config file**        | `packages/shared/vitest.config.ts`, `packages/server/vitest.config.ts`, `packages/client/vitest.config.ts`                                                              |
| **Quick run command**  | `pnpm --filter @counter-attack/server test -- <file-substring>` (or `@counter-attack/shared` / `@counter-attack/client` as applicable) — Vitest CLI filters by filename |
| **Full suite command** | `pnpm test` (root — runs `pnpm -r test` across all 3 packages)                                                                                                          |
| **Estimated runtime**  | ~15-30 seconds per package suite                                                                                                                                        |

---

## Sampling Rate

- **After every task commit:** the single most relevant `vitest run <file>` for the file(s) just touched (see Requirement → Test Map below)
- **After every plan wave:** full package suite for whichever package(s) the wave touched (`pnpm --filter @counter-attack/shared test`, `@counter-attack/server test`, `@counter-attack/client test` as applicable)
- **Before `/gsd-verify-work`:** `pnpm test` (full monorepo suite) must be green
- **Max feedback latency:** ~30 seconds

---

## Requirement → Test Map

Every row is covered by at least one task's `<automated>` command. Task IDs are `{plan}-T{n}`.

| Req ID | Behavior                                                                                                                    | Test Type        | Covering Task(s)   | Automated Command                                                      | File                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| BUG-33 | `room:leave` tears the room down server-side immediately — the code returns `NOT_FOUND` on a later join, no 90s grace delay | integration      | 36-01-T1           | `pnpm --filter @counter-attack/server test -- room.integration`        | `packages/server/src/__tests__/room.integration.test.ts`        |
| BUG-33 | A room-less socket emitting `room:leave` cannot delete an unrelated room (ASVS V4)                                          | integration      | 36-01-T1           | `pnpm --filter @counter-attack/server test -- room.integration`        | `packages/server/src/__tests__/room.integration.test.ts`        |
| BUG-33 | Back renders unconditionally on `GameSettingsScreen` and calls `onBack`; not added to other pre-game screens                | unit (component) | 36-01-T2           | `pnpm --filter @counter-attack/client test -- GameSettingsScreen`      | `packages/client/src/components/GameSettingsScreen.test.tsx`    |
| BUG-34 | No player id appears in more than one pack across all 6 rounds / 12 packs (seeded RNG, 4 pool selections)                   | unit             | 36-02-T1           | `pnpm --filter @counter-attack/shared test -- draftEngine`             | `packages/shared/src/draftEngine.test.ts`                       |
| BUG-34 | Match-wide (not per-round) duplication invariant holds over real `crypto.randomInt`                                         | integration      | 36-02-T2           | `pnpm --filter @counter-attack/server test -- draftPacks`              | `packages/server/src/__tests__/draftPacks.test.ts`              |
| BUG-34 | Within-round uniqueness (Phase 30 D-09 / this phase's D-07) still holds as a superset                                       | unit + integ.    | 36-02-T1, 36-02-T2 | `pnpm --filter @counter-attack/shared test -- draftEngine`             | both files above                                                |
| BUG-35 | Same-pool cascade fills a short slot; no slot ever receives a tier rarer than it called for (D-08)                          | unit             | 36-03-T1           | `pnpm --filter @counter-attack/shared test -- draftEngine`             | `packages/shared/src/draftEngine.test.ts`                       |
| BUG-35 | Cross-pool fallback is not reached while the same-pool cascade can cover the round (D-12a, `['mls']`)                       | unit             | 36-03-T2           | `pnpm --filter @counter-attack/shared test -- draftEngine`             | `packages/shared/src/draftEngine.test.ts`                       |
| BUG-35 | Cross-pool fallback yields common-tier cards only (D-09/D-12b, `['original']`, non-vacuous)                                 | unit             | 36-03-T2           | `pnpm --filter @counter-attack/shared test -- draftEngine`             | `packages/shared/src/draftEngine.test.ts`                       |
| BUG-35 | Unmeetable supply still fails loudly rather than dealing a short/duplicated pack (D-11)                                     | unit             | 36-03-T2           | `pnpm --filter @counter-attack/shared test -- draftEngine`             | `packages/shared/src/draftEngine.test.ts`                       |
| BUG-35 | `['original']` common shortfall is filled cross-pool with common cards only, over real crypto RNG                           | integration      | 36-03-T3           | `pnpm --filter @counter-attack/server test -- draftPacks`              | `packages/server/src/__tests__/draftPacks.test.ts`              |
| BUG-35 | A supply-exhaustion throw surfaces as `GAME_ERROR` instead of crashing the process (T-36-07)                                | integration      | 36-03-T3           | `pnpm --filter @counter-attack/server test -- room.integration`        | `packages/server/src/__tests__/room.integration.test.ts`        |
| BUG-36 | Shooter/GK duel TIE places the ball at `gkEffectivePos`, not the shooter's hex (with and without a dive)                    | unit             | 36-04-T1           | `pnpm --filter @counter-attack/server test -- gameEngine.phase8`       | `packages/server/src/__tests__/gameEngine.phase8.test.ts`       |
| BUG-36 | The subsequent `LOOSE_BALL_LAND` scatter and the replay frame both originate from the keeper's hex                          | unit             | 36-04-T2           | `pnpm --filter @counter-attack/server test -- gameEngine.phase8`       | `packages/server/src/__tests__/gameEngine.phase8.test.ts`       |
| BUG-37 | Undo cannot revert past a resolved `TACKLE_ATTEMPT`/`STEAL_ATTEMPT`, but CAN undo moves made after it (server)              | unit             | 36-05-T1           | `pnpm --filter @counter-attack/server test -- gameEngine.phase26-undo` | `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` |
| BUG-37 | Client `canUndo` mirrors the same boundary (button disabled/enabled state)                                                  | unit (component) | 36-05-T2           | `pnpm --filter @counter-attack/client test -- ActionPanel`             | `packages/client/src/components/ActionPanel.test.tsx`           |

_Status: ✅ complete — all 16 rows map to a task with an `<automated>` command. No `MISSING` references remain._

---

## Wave 0 Requirements

- [x] **Resolved during planning:** `packages/shared/src/draftEngine.test.ts` **does exist** (confirmed by directory scan on 2026-07-28) and already contains a `generateDraftPacks — 6-round structure` describe block plus a `makeSeededRng` xorshift32 helper. No new test file needs to be created — Plans 36-02 and 36-03 extend it in place. The RESEARCH.md/earlier-draft "verify existence in Wave 0" gap is closed; no Wave 0 scaffolding task is required.
- [x] No framework install needed — Vitest is already configured and working in all 3 packages.

---

## Manual-Only Verifications

All phase behaviors have automated verification. No manual-only items identified — the single UI
surface in scope (the Game Settings Back button, BUG-33) is covered by a `@testing-library/react`
component test plus a wire-level integration test, and its visual contract reuses `LobbyScreen`'s
already-shipped `.subLink` styling verbatim (36-UI-SPEC.md), introducing no new tokens, colors or
layout to inspect by eye.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every one of the 11 tasks across the 5 plans carries an `<automated>` command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (draftEngine.test.ts existence check — resolved, file exists)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` — plans map every row above to a task

**Approval:** approved 2026-07-28 (planner)

---

## Validation Audit 2026-08-03

Retroactive audit against the 5 completed SUMMARY files and current repo state (all 5 plans executed, phase fully complete). All 8 test files referenced in the Requirement → Test Map were confirmed present on disk, cross-referenced for `BUG-33`..`BUG-37` markers against both their implementation and test files (16/16 requirement IDs traced in both), and re-run fresh: `server` (room.integration, draftPacks, gameEngine.phase8, gameEngine.phase26-undo, gameEngine.test — 179/179 passed), `client` (GameSettingsScreen, ActionPanel — 87/87 passed), `shared` (draftEngine — 67/67 passed). No plan-time claim was contradicted by actual code.

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

`nyquist_compliant: true` reconfirmed — every requirement row remains COVERED post-execution.
