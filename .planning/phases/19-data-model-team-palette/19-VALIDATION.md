---
phase: 19
slug: data-model-team-palette
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-03
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Framework**          | vitest (both packages)                                                                    |
| **Config file**        | `packages/shared/vitest.config.ts`, `packages/client/vite.config.ts` (test section)       |
| **Quick run command**  | `pnpm --filter shared test --run`                                                         |
| **Full suite command** | `pnpm --filter shared test --run && pnpm --filter client test --run && pnpm tsc --noEmit` |
| **Estimated runtime**  | ~30 seconds                                                                               |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter shared test --run`
- **After every plan wave:** Run `pnpm --filter shared test --run && pnpm --filter client test --run && pnpm tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement    | Threat Ref | Secure Behavior | Test Type    | Automated Command                                      | File Exists | Status     |
| -------- | ---- | ---- | -------------- | ---------- | --------------- | ------------ | ------------------------------------------------------ | ----------- | ---------- |
| 19-01-01 | 01   | 1    | PALETTE-01     | —          | N/A             | type-check   | `pnpm tsc --noEmit`                                    | ✅          | ⬜ pending |
| 19-01-02 | 01   | 1    | PALETTE-02     | —          | N/A             | type-check   | `pnpm tsc --noEmit`                                    | ✅          | ⬜ pending |
| 19-01-03 | 01   | 1    | PALETTE-03     | —          | N/A             | type-check   | `pnpm tsc --noEmit`                                    | ✅          | ⬜ pending |
| 19-01-04 | 01   | 1    | TEAM-07        | —          | N/A             | type-check   | `pnpm tsc --noEmit`                                    | ✅          | ⬜ pending |
| 19-02-01 | 02   | 1    | DATA-01        | —          | N/A             | unit         | `pnpm --filter shared test --run`                      | ✅          | ⬜ pending |
| 19-02-02 | 02   | 1    | DATA-02        | —          | N/A             | unit         | `pnpm --filter shared test --run`                      | ✅          | ⬜ pending |
| 19-02-03 | 02   | 1    | DATA-03        | —          | N/A             | unit         | `pnpm --filter shared test --run`                      | ✅          | ⬜ pending |
| 19-02-04 | 02   | 1    | LEAGUE-03      | —          | N/A             | type-check   | `pnpm tsc --noEmit`                                    | ✅          | ⬜ pending |
| 19-03-01 | 03   | 2    | DATA-01..03    | —          | N/A             | unit         | `pnpm --filter shared test --run`                      | ✅          | ⬜ pending |
| 19-03-04 | 03   | 2    | PALETTE-01..03 | —          | N/A             | compile+test | `pnpm --filter client test --run && pnpm tsc --noEmit` | ✅          | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] Update `packages/shared/src/tests/` — stubs for PLAYER_POOL export tests
- [ ] Update `packages/client/src/components/__tests__/mockMovementState.ts` — switch from Cosmos/Xolos to City/Crew teams

_All other phase behaviors use existing vitest/jest infrastructure._

---

## Manual-Only Verifications

| Behavior                                         | Requirement | Why Manual              | Test Instructions                                                            |
| ------------------------------------------------ | ----------- | ----------------------- | ---------------------------------------------------------------------------- |
| Xolos/Cozmos not selectable in team selection UI | TEAM-07     | Requires browser render | Open team selection screen; confirm only City and Crew appear as options     |
| Palette colors render correctly on piece tokens  | PALETTE-01  | Visual check            | Run dev server; confirm City/Crew pieces display with updated palette colors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
