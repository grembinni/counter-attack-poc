---
phase: 32
slug: code-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Vitest 2.1.9 (each package has its own `vitest.config.ts`; client uses `environment: 'jsdom'` + `@testing-library/react`) |
| **Config file**        | `packages/{shared,server,client}/vitest.config.ts` (3 separate configs, no shared root config)                            |
| **Quick run command**  | `pnpm --filter @counter-attack/client test` (or `--filter` the specific package touched)                                  |
| **Full suite command** | `pnpm -r test`                                                                                                            |
| **Estimated runtime**  | ~30-60 seconds (full suite, across 3 packages)                                                                            |

---

## Sampling Rate

- **After every task commit:** Run package-scoped `pnpm --filter <pkg> test` for whichever package the task touched, plus `pnpm lint` when touching client files
- **After every plan wave:** Run `pnpm -r test` + `pnpm knip` + `pnpm lint`
- **Before `/gsd-verify-work`:** Full suite must be green — `pnpm -r typecheck && pnpm -r test && pnpm knip && pnpm lint && pnpm -r build`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Task IDs are TBD until the planner assigns plan/wave numbers. Rows below are requirement-level; the planner must map each to concrete task IDs during planning.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior                                                                            | Test Type        | Automated Command                                                                                                                        | File Exists                                                                                                                      | Status     |
| ------- | ---- | ---- | ----------- | ---------- | ------------------------------------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| TBD     | TBD  | TBD  | CLEANUP-01  | —          | `pnpm knip` reports zero flagged issues after fixes                                        | tooling/CI       | `pnpm knip`                                                                                                                              | ❌ W0 — knip.json does not exist                                                                                                 | ⬜ pending |
| TBD     | TBD  | TBD  | CLEANUP-01  | —          | `shootTargetHex` removal does not break existing store tests                               | unit             | `pnpm --filter @counter-attack/client test -- useGameStore`                                                                              | ✅ existing (`useGameStore.test.ts`, `useGameStore.rule11.test.ts`)                                                              | ⬜ pending |
| TBD     | TBD  | TBD  | CLEANUP-02  | —          | `useTeamAccentColor`/`useMyTeam` produce identical output to the inline logic they replace | unit             | `pnpm --filter @counter-attack/client test -- useMyTeam` (or co-located hook test)                                                       | ❌ W0 — no `hooks/` dir exists yet                                                                                               | ⬜ pending |
| TBD     | TBD  | TBD  | CLEANUP-02  | —          | Existing component tests still pass after call-site migration                              | unit/integration | `pnpm --filter @counter-attack/client test -- ActionLog GameBoard PieceOverlay HexGrid ActionPanel FreeKickSetupPanel KickOffSetupPanel` | ✅ existing for most; confirm coverage for `PieceOverlay.tsx`, `FreeKickSetupPanel.tsx`, `KickOffSetupPanel.tsx` during planning | ⬜ pending |
| TBD     | TBD  | TBD  | CLEANUP-03  | —          | Selector fixes don't regress existing store behavior tests                                 | unit             | `pnpm --filter @counter-attack/client test -- useGameStore`                                                                              | ✅ existing                                                                                                                      | ⬜ pending |
| TBD     | TBD  | TBD  | CLEANUP-03  | —          | `SELECTOR-REVIEW.md` deliverable exists and documents every selector in `useGameStore.ts`  | doc              | manual file review                                                                                                                       | ❌ W0 — deliverable itself                                                                                                       | ⬜ pending |
| TBD     | TBD  | TBD  | CLEANUP-04  | —          | `pnpm lint` (client scope) reports zero `react-hooks/*` violations                         | lint             | `pnpm lint` (root `eslint .` already covers all packages; verify client-scoped rules fire)                                               | ✅ existing script, new rule set                                                                                                 | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `knip.json` (repo root) — does not exist yet; required before `pnpm knip` can run at all
- [ ] `packages/client/src/hooks/` directory + `useTeamAccentColor.ts`/`useMyTeam.ts` (or equivalent naming chosen during planning) — does not exist yet
- [ ] Unit test files for the two new hooks — no existing coverage since the hooks don't exist yet
- [ ] `eslint-plugin-react-hooks` block in `eslint.config.js`, scoped to the client package — does not exist yet
- [ ] `.planning/phases/32-code-cleanup/SELECTOR-REVIEW.md` — the CLEANUP-03 deliverable itself (D-05)

---

## Manual-Only Verifications

| Behavior                                                                                                         | Requirement       | Why Manual                                                                                                                                                      | Test Instructions                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every `eslint-disable-next-line react-hooks/exhaustive-deps` suppression's justification holds up under scrutiny | CLEANUP-04 (D-08) | Requires human judgment on whether a dependency omission is genuinely a one-time-only effect vs. a masked bug — not mechanically checkable by the linter itself | During verification, list every suppression comment added/kept in this phase and confirm each has an explanatory comment that correctly describes why the omission is safe |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
