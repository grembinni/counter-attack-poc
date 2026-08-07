---
phase: 37
slug: out-of-bounds-detection-throw-in-goal-kick
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-03
validated: 2026-08-07
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest (confirmed via `packages/server/vitest.config.ts`, `packages/shared/vitest.config.ts`)                                                |
| **Config file**        | `packages/server/vitest.config.ts` (`environment: 'node'`, `include: ['src/**/*.test.ts']`); `packages/shared/vitest.config.ts` (same shape) |
| **Quick run command**  | `pnpm --filter @counter-attack/shared test -- <pattern>` / `pnpm --filter @counter-attack/server test -- <pattern>`                          |
| **Full suite command** | `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test`                                                     |
| **Estimated runtime**  | ~30 seconds                                                                                                                                  |

---

## Sampling Rate

- **After every task commit:** Run `vitest run -- <changed-file-pattern>` in the relevant package (targeted).
- **After every plan wave:** Run `pnpm --filter @counter-attack/shared test && pnpm --filter @counter-attack/server test` (full suite; include client suite if any panel-rendering tests are added).
- **Before `/gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 30 seconds.

---

## Per-Task Verification Map

_Reconstructed 2026-08-07 against the actual 19-plan execution (the table below at Wave 0 draft time used placeholder "TBD" task IDs before planning ran)._

| Requirement | Plans (wave)                                          | Secure Behavior                                                                                                                                                               | Test Type          | Automated Command                                                     | File Exists | Status   |
| ----------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------- | ----------- | -------- |
| OOB-01      | 37-01(1), 37-04(4)                                    | `ball.lastTouchedBy` updates on every contact type, independent of possession                                                                                                 | unit               | `pnpm --filter @counter-attack/server test -- gameEngine.outOfBounds` | ✅          | ✅ green |
| OOB-02      | 37-01(1), 37-04(4), 37-14(12)                         | Sideline exit classified via `classifyExit`; awarded to non-touching team                                                                                                     | unit               | `pnpm --filter @counter-attack/shared test -- outOfBounds`            | ✅          | ✅ green |
| OOB-04      | 37-01(1), 37-04(4), 37-14(12), 37-15(13)              | Byline exit (attacking touch or untouched) → goal kick via `classifyOutOfBounds`                                                                                              | unit               | `pnpm --filter @counter-attack/shared test -- outOfBounds`            | ✅          | ✅ green |
| OOB-05      | 37-02(2), 37-03(3), 37-04(4)                          | Toggle off preserves exact pre-Phase-37 clamp behavior; no `OUT_OF_BOUNDS` event when disabled/absent                                                                         | unit/integration   | `pnpm --filter @counter-attack/server test -- gameEngine.outOfBounds` | ✅          | ✅ green |
| THROWIN-01  | 37-04(4), 37-06(6)                                    | Sideline exit → throw-in awarded to non-touching team, from any pass type/loose ball                                                                                          | integration        | `pnpm --filter @counter-attack/server test -- throwIn.integration`    | ✅          | ✅ green |
| THROWIN-02  | 37-05(5), 37-07(6), 37-12(10), 37-14(12), 37-16(12)   | Attacking manager places thrower at exit hex; occupied-hex relocation                                                                                                         | integration        | `pnpm --filter @counter-attack/server test -- throwIn.integration`    | ✅          | ✅ green |
| THROWIN-03  | 37-02(2), 37-05(5), 37-07(6), 37-11(10)               | Choice of 1 or 2 Movement Phases before the throw; sequencing guard (D-11-02/D-17 fix)                                                                                        | integration        | `pnpm --filter @counter-attack/server test -- throwIn.integration`    | ✅          | ✅ green |
| THROWIN-04  | 37-01(1) (`maxDistance` override), 37-06(6), 37-07(6) | Throw up to 6 hexes, Low/High                                                                                                                                                 | unit/integration   | `pnpm --filter @counter-attack/server test -- throwIn.integration`    | ✅          | ✅ green |
| THROWIN-05  | 37-01(1), 37-04(4), 37-06(6)                          | Overthrown/inaccurate throw reclassified by the same OOB system                                                                                                               | integration        | `pnpm --filter @counter-attack/server test -- throwIn.integration`    | ✅          | ✅ green |
| GOALKICK-01 | 37-02(2), 37-08(7)                                    | Goal kick is its own dedicated flow (not GK_RESTART reuse, per user override of research)                                                                                     | integration        | `pnpm --filter @counter-attack/server test -- goalKick.integration`   | ✅          | ✅ green |
| GOALKICK-02 | 37-08(7), 37-10(9), 37-13(11), 37-16(12)              | Both final-thirds reposition up to 6 hexes each, GK's team first; on-pitch bounds guard (closed 37-13)                                                                        | integration        | `pnpm --filter @counter-attack/server test -- goalKick.integration`   | ✅          | ✅ green |
| GOALKICK-03 | 37-02(2), 37-08(7), 37-17(13)                         | GK chooses Kick (8+ combined) or Standard Pass; single-click Standard Pass (closes 37-UAT test 5/10)                                                                          | integration/client | `pnpm --filter @counter-attack/server test -- goalKick.integration`   | ✅          | ✅ green |
| GOALKICK-04 | 37-09(8), 37-10(9), 37-17(13)                         | Inaccurate Kick → Loose Ball; Standard Pass path unmodified (no throw-in cap leakage)                                                                                         | integration        | `pnpm --filter @counter-attack/server test -- goalKick.integration`   | ✅          | ✅ green |
| GOALKICK-05 | 37-09(8), 37-10(9), 37-12(10), 37-18(13), 37-19(14)   | Both teams move 1 player up to 3 hexes; header required on accurate Kick; header-contest radius preview shown to both managers (closes 37-UAT test 6, gap-closure plan 37-19) | integration/client | `pnpm --filter @counter-attack/client test -- HexGrid`                | ✅          | ✅ green |
| GOALKICK-06 | 37-02(2), 37-03(3)                                    | Independent game-creation toggle (`outOfBoundsEnabled`), separate from Fouls/Booking/Injury                                                                                   | unit               | `pnpm --filter @counter-attack/server test -- roomStore`              | ✅          | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_
_OOB-03 (corner kick award) is correctly out of scope for Phase 37 — deferred to Phase 38 per `.planning/REQUIREMENTS.md`; not counted against this table._
_All rows independently re-confirmed green in `37-VERIFICATION.md`'s 2026-08-07 re-verification run: client 29 files/640 passed, server 36 files/799 passed (1 skipped, 1 todo), shared 14 files/650 passed._

---

## Wave 0 Requirements

- [x] `packages/shared/src/outOfBounds.test.ts` (162 lines) — covers OOB-01/02/04/05's pure classification logic, including the double-boundary-exit default and documented edge cases.
- [x] `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` (2071 lines) — covers the `LOOSE_BALL` clamp hook's toggle-gated branching, `ball.lastTouchedBy` propagation, and the throw-in/goal-kick `apply*` functions.
- [x] `packages/server/src/__tests__/throwIn.integration.test.ts` (646 lines) and `packages/server/src/__tests__/goalKick.integration.test.ts` (1136 lines) — full socket-handler-level sequences, real Socket.io server + `socket.io-client`, zero `vi.mock`.
- [x] `packages/server/src/__tests__/roomStore.test.ts` — extended with `Room.outOfBoundsEnabled` and `buildInitialGameState` toggle-wiring coverage (lines 155-196).
- [x] No new framework install needed — Vitest confirmed already configured project-wide.

---

## Manual-Only Verifications

_None — all phase behaviors have automated verification per the Phase Requirements → Test Map above. `37-UAT.md`'s 8 browser-level checks supplemented but did not replace this automated coverage; its one issue (test 6, GOALKICK-05 header-contest radius) was closed by plan 37-19 and is reflected in the map above._

---

## Validation Sign-Off

- [x] All requirements have automated verify (no Wave 0 dependencies remain outstanding)
- [x] Sampling continuity: every plan wave (1-14) that touched Phase 37 code shipped its own automated test coverage in the same wave
- [x] Wave 0 covers all originally-MISSING references (all 5 Wave 0 checklist items above are now checked)
- [x] No watch-mode flags in any Automated Command
- [x] Feedback latency < 30s (full 3-package suite ~30s per Test Infrastructure table)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-07

---

## Validation Audit 2026-08-07

Reconstructed this file's Per-Task Verification Map against the actual 19-plan execution — the version left after Wave 0 planning (`status: draft`, `nyquist_compliant: false`, task IDs `TBD`) was never updated once execution began, even though every requirement received real automated coverage as planning proceeded.

| Metric                                      | Count |
| ------------------------------------------- | ----- |
| Requirements audited                        | 15    |
| Gaps found (missing/failing automated test) | 0     |
| Resolved this session                       | 0     |
| Escalated to manual-only                    | 0     |

No code or test changes were needed — this audit is a documentation reconciliation only. All 15 Phase 37 requirement IDs (OOB-01/02/04/05, THROWIN-01..05, GOALKICK-01..06) already had dedicated, passing automated tests by the time the phase was marked complete on 2026-08-04, independently re-confirmed green in `37-VERIFICATION.md`'s same-day (2026-08-07) re-verification run. `OOB-03` (corner kick) is out of scope for Phase 37 (Phase 38).
