---
phase: 32
slug: code-cleanup
status: approved
nyquist_compliant: true
wave_0_complete: true
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

| Task ID  | Plan | Wave | Requirement       | Threat Ref | Secure Behavior                                                                                                                       | Test Type               | Automated Command                                                                                                         | File Exists                                                         | Status   |
| -------- | ---- | ---- | ----------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| 32-01-T1 | 01   | 1    | CLEANUP-01        | T-32-SC    | knip package legitimacy verified before install ([SUS] verdict human-checkpointed)                                                    | checkpoint:human-verify | manual review of `gsd-tools query package-legitimacy check` output                                                        | n/a — gate task                                                     | ✅ green |
| 32-01-T2 | 01   | 1    | CLEANUP-01        | —          | knip installed, `knip.json` + `pnpm knip` script + CI gate step added                                                                 | tooling/CI              | `pnpm knip --debug`                                                                                                       | ✅ `knip.json` exists at repo root                                  | ✅ green |
| 32-01-T3 | 01   | 1    | CLEANUP-01        | —          | `shootTargetHex` + all knip-flagged dead code removed; `pnpm knip` reports zero                                                       | unit + tooling          | `pnpm knip` ; `pnpm --filter @counter-attack/client test -- useGameStore`                                                 | ✅ existing (`useGameStore.test.ts`, `useGameStore.rule11.test.ts`) | ✅ green |
| 32-02-T1 | 02   | 1    | CLEANUP-02        | —          | `teamAccentColor` pure fn + `useTeamAccentColor` hook match prior inline `palette.uiColor` output                                     | unit (tdd)              | `pnpm --filter @counter-attack/client test -- useTeamColors`                                                              | ✅ `hooks/useTeamColors.ts` + `useTeamColors.test.ts` (4 tests)     | ✅ green |
| 32-02-T2 | 02   | 1    | CLEANUP-02        | —          | `deriveMyTeam` pure fn + `useMyTeam` hook match prior inline `myTeam` derivation                                                      | unit (tdd)              | `pnpm --filter @counter-attack/client test -- useMyTeam`                                                                  | ✅ `hooks/useMyTeam.ts` + `useMyTeam.test.ts` (7 tests)             | ✅ green |
| 32-03-T1 | 03   | 2    | CLEANUP-02        | —          | GameBoard.tsx color + myTeam sites migrated to the new hooks                                                                          | unit/integration        | `pnpm --filter @counter-attack/client test -- GameBoard`                                                                  | ✅ existing (`GameBoard.test.tsx`, 25 tests)                        | ✅ green |
| 32-03-T2 | 03   | 2    | CLEANUP-02        | —          | ActionLog.tsx color helpers migrated to the pure `teamAccentColor` (loop-invoked, non-hook context)                                   | unit/integration        | `pnpm --filter @counter-attack/client test -- ActionLog`                                                                  | ✅ existing (`ActionLog.test.tsx`)                                  | ✅ green |
| 32-03-T3 | 03   | 2    | CLEANUP-02        | —          | PieceOverlay.tsx confirmed a type-shape pass-through (Pitfall 5) and left correct, not force-migrated                                 | unit/integration        | `pnpm --filter @counter-attack/client test -- PieceOverlay`                                                               | ✅ existing                                                         | ✅ green |
| 32-04-T1 | 04   | 2    | CLEANUP-02        | —          | Null-safe component sites (HexGrid, ActionPanel) migrated to `useMyTeam()`                                                            | unit/integration        | `pnpm --filter @counter-attack/client test -- HexGrid ActionPanel`                                                        | ✅ existing (`HexGrid.test.tsx`, 41 tests)                          | ✅ green |
| 32-04-T2 | 04   | 2    | CLEANUP-02        | —          | Non-null-safe sites (useGameStore ×7, FreeKickSetupPanel, KickOffSetupPanel) reconciled to `deriveMyTeam` with explicit null handling | unit/integration        | `pnpm --filter @counter-attack/client test -- useGameStore FreeKickSetupPanel KickOffSetupPanel`                          | ✅ existing (`FreeKickSetupPanel.test.tsx` 25 tests + useGameStore) | ✅ green |
| 32-05-T1 | 05   | 3    | CLEANUP-03        | —          | `SELECTOR-REVIEW.md` catalogs every selector/derived field in `useGameStore.ts` with a resolved verdict (D-05)                        | doc                     | `test -f .planning/phases/32-code-cleanup/SELECTOR-REVIEW.md && grep -c "Verdict\|validMoveHexes\|setGameState" ...`      | ✅ exists with resolved verdicts                                    | ✅ green |
| 32-05-T2 | 05   | 3    | CLEANUP-03        | —          | Every `fix`-verdict row applied and behavior-preserving (D-06)                                                                        | unit                    | `pnpm --filter @counter-attack/client test useGameStore` ; `pnpm --filter @counter-attack/client typecheck` ; `pnpm knip` | ✅ existing                                                         | ✅ green |
| 32-06-T1 | 06   | 3    | CLEANUP-04        | —          | `eslint-plugin-react-hooks` installed, enabled at `error`, scoped to client package                                                   | lint                    | `npx eslint packages/client/src --max-warnings=0`                                                                         | ✅ `eslint.config.js` react-hooks block confirmed                   | ✅ green |
| 32-06-T2 | 06   | 3    | CLEANUP-04        | —          | Every violation fixed, preferring stable-dep additions over `eslint-disable`                                                          | lint                    | `npx eslint packages/client/src --max-warnings=0` (zero `react-hooks/*` violations)                                       | ✅ existing script, new rule set                                    | ✅ green |
| 32-06-T3 | 06   | 3    | CLEANUP-04 (D-08) | —          | Every kept `eslint-disable-next-line react-hooks/exhaustive-deps` suppression's justification reviewed and confirmed to hold up       | checkpoint:human-verify | manual review of each suppression comment                                                                                 | n/a — gate task; zero suppressions exist (grep confirmed)           | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `knip.json` (repo root) — exists, covers all 3 packages
- [x] `packages/client/src/hooks/` directory + `useTeamColors.ts`/`useMyTeam.ts` — exist as real implementations
- [x] Unit test files for the two new hooks — `useTeamColors.test.ts` (4 tests), `useMyTeam.test.ts` (7 tests), both passing
- [x] `eslint-plugin-react-hooks` block in `eslint.config.js`, scoped to the client package — exists, `error` level
- [x] `.planning/phases/32-code-cleanup/SELECTOR-REVIEW.md` — exists with resolved verdicts and applied fixes

---

## Manual-Only Verifications

| Behavior                                                                                                         | Requirement       | Why Manual                                                                                                                                                      | Test Instructions                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every `eslint-disable-next-line react-hooks/exhaustive-deps` suppression's justification holds up under scrutiny | CLEANUP-04 (D-08) | Requires human judgment on whether a dependency omission is genuinely a one-time-only effect vs. a masked bug — not mechanically checkable by the linter itself | During verification, list every suppression comment added/kept in this phase and confirm each has an explanatory comment that correctly describes why the omission is safe |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the 2 `checkpoint:human-verify` tasks — 32-01-T1, 32-06-T3 — correctly omit `<automated>` per gsd-plan-checker's structure check)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (knip.json, hooks/ dir, react-hooks plugin, SELECTOR-REVIEW.md — all created by Wave 1/3 tasks themselves)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-24 — gsd-plan-checker VERIFICATION PASSED (2 non-blocking documentation-freshness warnings, since resolved)

---

## Validation Audit 2026-07-25

| Metric     | Count |
| ---------- | ----- |
| Gaps found | 0     |
| Resolved   | 0     |
| Escalated  | 0     |

All 15 tasks' automated commands were independently re-run against the current codebase (not just SUMMARY.md/VERIFICATION.md claims): `pnpm --filter @counter-attack/client test -- --run` (391/391 passed, 22 files), `pnpm --filter @counter-attack/server test -- --run` (627 passed, 1 skipped, 1 todo, 33 files), `pnpm knip` (zero unused-file/export/dependency findings, only 5 informational config hints), `npx eslint packages/client/src --max-warnings=0` (exit 0, zero output). All 5 Wave 0 deliverables (`knip.json`, `hooks/` dir with both hooks + tests, `SELECTOR-REVIEW.md`, react-hooks eslint block) confirmed present on disk. Per-Task Verification Map statuses updated from stale `⬜ pending` (frozen at plan-approval time, never updated after execution) to `✅ green` to reflect actual, re-verified state. No gaps — phase remains Nyquist-compliant.
