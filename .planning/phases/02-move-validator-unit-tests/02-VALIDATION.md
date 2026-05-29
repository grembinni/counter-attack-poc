---
phase: 2
slug: move-validator-unit-tests
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9                                                      |
| **Config file**        | `packages/shared/vitest.config.ts` (exists, working from Phase 1) |
| **Quick run command**  | `pnpm --filter=@counter-attack/shared test`                       |
| **Full suite command** | `pnpm --filter=@counter-attack/shared test`                       |
| **Estimated runtime**  | ~5 seconds                                                        |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter=@counter-attack/shared test`
- **After every plan wave:** Run `pnpm --filter=@counter-attack/shared test`
- **Before `/gsd-verify-work`:** Full suite must be green (20+ tests passing)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID            | Plan | Wave | Requirement                                          | Threat Ref       | Secure Behavior                                                 | Test Type | Automated Command                                                                                                                                                | File Exists | Status     |
| ------------------ | ---- | ---- | ---------------------------------------------------- | ---------------- | --------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------- |
| hex-extend         | 01   | 1    | D-02                                                 | —                | N/A — pure math                                                 | unit      | `pnpm --filter=@counter-attack/shared test -- hex`                                                                                                               | ❌ W0       | ⬜ pending |
| types-extend       | 01   | 1    | D-08                                                 | —                | N/A — type contract                                             | unit      | `pnpm --filter=@counter-attack/shared test`                                                                                                                      | ❌ W0       | ⬜ pending |
| score-utils        | 01   | 1    | DICE-03, DICE-04, DICE-05                            | T-02-01          | N/A — pure functions                                            | unit      | `pnpm --filter=@counter-attack/shared test -- scoreUtils`                                                                                                        | ❌ W0       | ⬜ pending |
| barrel-preregister | 01   | 1    | —                                                    | T-02-08          | Eliminates concurrent index.ts writes in Wave 2                 | grep      | `grep -c "^export \* from './\(moveValidator\|passValidator\|shotValidator\|headingValidator\|snapshotValidator\)\.js';" packages/shared/src/index.ts` returns 5 | ❌ W0       | ⬜ pending |
| move-validator     | 02   | 2    | MOVE-01, MOVE-02, MOVE-03, MOVE-04, MOVE-05, MOVE-07 | T-02-10, T-02-11 | N/A — pure functions, no I/O                                    | unit      | `pnpm --filter=@counter-attack/shared test -- moveValidator`                                                                                                     | ❌ W0       | ⬜ pending |
| pass-validator     | 03   | 2    | PASS-01, PASS-02, PASS-03, PASS-04, PASS-05          | T-02-25          | N/A — pure functions; PASS-04 landing enforced via state.pieces | unit      | `pnpm --filter=@counter-attack/shared test -- passValidator`                                                                                                     | ❌ W0       | ⬜ pending |
| shot-validator     | 04   | 2    | SHOT-01, SHOT-02, SHOT-03, SHOT-04, SHOT-06          | T-02-30..33      | N/A — pure functions                                            | unit      | `pnpm --filter=@counter-attack/shared test -- shotValidator`                                                                                                     | ❌ W0       | ⬜ pending |
| heading-validator  | 04   | 2    | HEAD-01, HEAD-02, HEAD-03, HEAD-04, HEAD-05          | T-02-34          | N/A — pure functions                                            | unit      | `pnpm --filter=@counter-attack/shared test -- headingValidator`                                                                                                  | ❌ W0       | ⬜ pending |
| snapshot-validator | 04   | 2    | SNAP-01, SNAP-02, SNAP-03                            | —                | N/A — pure functions                                            | unit      | `pnpm --filter=@counter-attack/shared test -- snapshotValidator`                                                                                                 | ❌ W0       | ⬜ pending |
| isolation-check    | 04   | 2    | ARCH-07                                              | —                | No socket.io/express imports                                    | build     | `pnpm --filter=@counter-attack/shared build` (expected green only after all three Wave 2 plans complete)                                                         | ✅ exists   | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

**Note on Wave 1 build state:** After Plan 02-01 Task 2 pre-registers the five Phase 2 validator barrel exports in `index.ts`, the whole-package `pnpm --filter=@counter-attack/shared build` is intentionally expected to FAIL until all three Wave 2 plans (02-02, 02-03, 02-04) complete and create the referenced modules. Per-file unit tests (`-- hex`, `-- scoreUtils`, `-- moveValidator`, etc.) still pass independently because Vitest can collect a single file's tests without compiling the entire package. This is documented in Plan 02-01's `<objective>` and is not a verification regression.

---

## Wave 0 Requirements

- [x] `packages/shared/src/scoreUtils.ts` (+ test) defined in Plan 02-01 — covers DICE-03, DICE-04, DICE-05; PRE-REGISTERED in index.ts
- [x] `packages/shared/src/moveValidator.ts` (+ test) defined in Plan 02-02 — covers MOVE-01..07; barrel export PRE-REGISTERED in Plan 02-01
- [x] `packages/shared/src/passValidator.ts` (+ test) defined in Plan 02-03 — covers PASS-01..05 including PASS-04 landing constraint; barrel export PRE-REGISTERED in Plan 02-01
- [x] `packages/shared/src/shotValidator.ts` (+ test) defined in Plan 02-04 Task 1 — covers SHOT-01..04, SHOT-06; barrel export PRE-REGISTERED in Plan 02-01
- [x] `packages/shared/src/headingValidator.ts` (+ test) defined in Plan 02-04 Task 2 — covers HEAD-01..05; barrel export PRE-REGISTERED in Plan 02-01
- [x] `packages/shared/src/snapshotValidator.ts` (+ test) defined in Plan 02-04 Task 2 — covers SNAP-01..03; barrel export PRE-REGISTERED in Plan 02-01
- [x] `hex.ts` extension (hexLine, getZoIDefenders) + `hex.test.ts` extension defined in Plan 02-01 Task 1

All Wave 0 stubs and tests have plan ownership; the wave_0_complete flag reflects that every Phase 2 requirement has a dedicated plan, task, file path, and verify command.

---

## Manual-Only Verifications

| Behavior                                                                  | Requirement      | Why Manual                                                                | Test Instructions                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loose Ball direction matches physical rulebook v1.4.1                     | DICE-05          | Physical rulebook check required                                          | Verify the direction-1=E, 2=NE, 3=NW, 4=W, 5=SW, 6=SE mapping against the Counter Attack deflection ruler before Phase 4 uses live game dice                                                                                                 |
| Pass attribute mapping (High Pass = aerialAbility, Long Pass = dribbling) | PASS-03, PASS-04 | PlayerPiece attribute for each pass type not confirmed in REQUIREMENTS.md | Confirm assumption A1 against the rulebook (or update CONTEXT.md) before Phase 5 uses these in live resolution. Open Question 1 in 02-RESEARCH.md is now marked RESOLVED with the working assumption; this manual check is the Phase 4 gate. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** signed-off during plan revision after checker pass identified the wave-2 concurrent-write blocker, the PASS-04 landing-constraint warning, and the two documentation warnings. All four issues addressed in the revised plans (02-01 through 02-04), 02-RESEARCH.md Open Questions marked RESOLVED, and this VALIDATION.md frontmatter updated.
