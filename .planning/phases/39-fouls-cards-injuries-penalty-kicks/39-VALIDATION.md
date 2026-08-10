---
phase: 39
slug: fouls-cards-injuries-penalty-kicks
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-09
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9 (`packages/server/package.json`, `packages/server/vitest.config.ts`)                                   |
| **Config file**        | `packages/server/vitest.config.ts` (server); equivalent client-side config exists per prior phases' component tests |
| **Quick run command**  | `pnpm --filter @counter-attack/server test -- <test-file-pattern>`                                                  |
| **Full suite command** | `pnpm test` (root — runs `pnpm -r test` across all packages)                                                        |
| **Estimated runtime**  | ~60 seconds (full monorepo suite, per prior-phase precedent)                                                        |

---

## Sampling Rate

- **After every task commit:** Run `vitest run <touched-file-pattern>` (targeted)
- **After every plan wave:** Run `pnpm --filter @counter-attack/server test` + `pnpm --filter @counter-attack/client test`
- **Before `/gsd-verify-work`:** Full suite (`pnpm test`) must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement                    | Threat Ref          | Secure Behavior                                 | Test Type        | Automated Command                             | File Exists        | Status     |
| -------- | ---- | ---- | ------------------------------ | ------------------- | ----------------------------------------------- | ---------------- | --------------------------------------------- | ------------------ | ---------- |
| 39-01-xx | TBD  | 0    | FOUL-01/02/03/04/05            | V5 Input Validation | Dice server-generated only                      | unit             | `vitest run gameEngine.fouls.test.ts`         | ❌ W0              | ⬜ pending |
| 39-01-xx | TBD  | 0    | CARD-01..04                    | V4 Access Control   | Only correct team submits card-relevant choices | unit             | `vitest run gameEngine.booking.test.ts`       | ❌ W0              | ⬜ pending |
| 39-01-xx | TBD  | 0    | INJURY-01..04                  | —                   | Attribute reduction applied correctly           | unit             | `vitest run gameEngine.injury.test.ts`        | ❌ W0              | ⬜ pending |
| 39-01-xx | TBD  | 0    | GKDIVE-01..05                  | V4 / V5             | Once-per-cycle cap enforced; team-guarded       | integration      | `vitest run gkDiveAtFeet.integration.test.ts` | ❌ W0              | ⬜ pending |
| 39-01-xx | TBD  | 0    | PEN-01..03                     | V4 / V5             | -2 GK penalty applied; team-guarded reposition  | integration      | `vitest run penaltyKick.integration.test.ts`  | ❌ W0              | ⬜ pending |
| 39-01-xx | TBD  | 0    | FK-01                          | —                   | Reuses `FREE_KICK_SETUP` contract unmodified    | integration      | `vitest run foulFreeKick.integration.test.ts` | ❌ W0              | ⬜ pending |
| 39-01-xx | TBD  | 0    | SETTINGS-01..03                | —                   | Booking/Injury inert without Fouls              | unit + component | `vitest run gameSettingsScreen.test.tsx`      | ✅ extend existing | ⬜ pending |
| 39-01-xx | TBD  | 0    | D-15 (loose-ball log)          | —                   | Direction/distance carried on event             | unit             | `vitest run gameEngine.looseBall.test.ts`     | ✅ extend existing | ⬜ pending |
| 39-01-xx | TBD  | 0    | D-16 (2nd-half mutual confirm) | V4 Access Control   | Both teams must confirm                         | integration      | `vitest run gameHandlers.halfTime.test.ts`    | ✅ extend existing | ⬜ pending |

_Full task-level enumeration happens during plan authoring — this table will be refined by the planner/executor against actual task IDs._

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `packages/server/src/__tests__/gameEngine.fouls.test.ts` — FOUL-01/02/03/04/05
- [ ] `packages/server/src/__tests__/gameEngine.booking.test.ts` — CARD-01..04
- [ ] `packages/server/src/__tests__/gameEngine.injury.test.ts` — INJURY-01..04
- [ ] `packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts` — GKDIVE-01..05 (template: existing `cornerKick.integration.test.ts` structure)
- [ ] `packages/server/src/__tests__/penaltyKick.integration.test.ts` — PEN-01..03, FK-01 (template: existing `goalKick.integration.test.ts` structure)
- [ ] Client component test for the new `FoulChoicePanel`/`PenaltyKickSetupPanel`/`GkDiveAtFeetPromptPanel` (template: existing `CornerKickSetupPanel.test.tsx`)
- [ ] `EventBanner.test.tsx` — must gain a test asserting multi-event-per-broadcast processing (fixes the confirmed live bug at `EventBanner.tsx:106-116` where only the last event in a broadcast is inspected) before/alongside D-02 implementation, since this blocks the foul→injury→booking banner sequence and is a regression risk beyond this phase

---

## Manual-Only Verifications

_None — all phase behaviors have automated verification paths per the table above._

---

## Security Domain

`security_enforcement` is not set to `false` in `.planning/config.json` (key absent) — treated as enabled (ASVS L1). Room-code-based 2-player game with no user accounts; V2 Authentication, V3 Session Management, V6 Cryptography categories do not apply.

### Applicable ASVS Categories

| ASVS Category       | Applies | Standard Control                                                                                                                                                                                                                                                      |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V4 Access Control   | Yes     | Existing `controlsGKTeam`/`socketTeam` team-guard pattern (e.g. `gameHandlers.ts:3050`) must be replicated for every new handler — continue/restart choice, dive-at-feet/box-entry response, penalty-kick reposition confirms                                         |
| V5 Input Validation | Yes     | Every new socket payload (hex coordinates, foul-choice enum, dive accept/decline) server-side shape-validated, mirroring `GAME_GK_DIVE`'s `typeof to.q !== 'number'` pattern (`gameHandlers.ts:3038-3048`); dice remain `crypto.randomInt`-generated server-side only |

### Known Threat Patterns

| Pattern                                                                  | STRIDE                                | Standard Mitigation                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Client claims a foul/injury/booking outcome directly                     | Tampering                             | All new dice generated via `crypto.randomInt` server-side only                              |
| Client submits continue/restart choice or reposition move for wrong team | Elevation of Privilege                | Reuse `controlsGKTeam`/`socketTeam` guard idiom                                             |
| Double-submission race on foul-choice/penalty-window confirm             | DoS (self-inflicted state corruption) | Reuse per-room `isProcessing` mutex idiom                                                   |
| Malformed hex payload for displacement/reposition                        | Tampering / DoS                       | Server-side `isPitchHex`/shape validation before mutation, mirroring `applyGKDive`'s guards |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
