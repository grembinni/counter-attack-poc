---
phase: 36
slug: bug-fixes
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-28
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

_(Plans do not exist yet — this maps RESEARCH.md's verified fix sites to requirement IDs and test commands. The planner mints exact Task IDs; each row below must be covered by at least one task's `<automated>` command.)_

| Req ID (suggested) | Behavior                                                                                                                    | Test Type        | Automated Command                                                      | File Exists?                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| BUG-33             | Back button restores + tears down room server-side within grace period (not 90s later)                                      | integration      | `pnpm --filter @counter-attack/server test -- room.integration`        | ✅ extend `packages/server/src/__tests__/room.integration.test.ts`                                                     |
| BUG-33             | Back button renders only on `GameSettingsScreen`, not other pre-game screens                                                | unit (component) | `pnpm --filter @counter-attack/client test -- GameSettingsScreen`      | ✅ extend `packages/client/src/components/GameSettingsScreen.test.tsx`                                                 |
| BUG-34             | No player id appears in more than one pack across all 6 rounds/12 packs                                                     | unit             | `pnpm --filter @counter-attack/server test -- draftPacks`              | ✅ extend `packages/server/src/__tests__/draftPacks.test.ts` (modify the existing per-round-only check at lines 54-66) |
| BUG-35             | Same-pool cascade tried before cross-pool; cross-pool fallback pulls common-tier only                                       | unit             | `pnpm --filter @counter-attack/shared test -- draftEngine`             | ⚠️ verify existence in Wave 0 — create `packages/shared/src/draftEngine.test.ts` if missing                            |
| BUG-35             | `['original']`-only match still succeeds without throwing, using common-tier cross-pool fallback for the ~7-card shortfall  | integration      | `pnpm --filter @counter-attack/server test -- draftPacks`              | ✅ extend Test 1 in `draftPacks.test.ts`                                                                               |
| BUG-36             | Shooter/GK duel TIE routes loose ball to `gkEffectivePos`, not shooter's hex                                                | unit             | `pnpm --filter @counter-attack/server test -- gameEngine.phase8`       | ✅ extend `packages/server/src/__tests__/gameEngine.phase8.test.ts` (near line 718-745, existing tie-producing test)   |
| BUG-37             | Undo cannot revert past a resolved TACKLE_ATTEMPT/STEAL_ATTEMPT within the same MOVE slot, but CAN undo moves made after it | unit             | `pnpm --filter @counter-attack/server test -- gameEngine.phase26-undo` | ✅ extend `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` (line 351 describe block)                    |
| BUG-37             | Client `canUndo` mirrors the same boundary (button disabled state)                                                          | unit (component) | `pnpm --filter @counter-attack/client test -- ActionPanel`             | ✅ extend `packages/client/src/components/ActionPanel.test.tsx`                                                        |

_Status: ⬜ pending — no plans exist yet; planner must map each row above to a task with an `<automated>` command._

---

## Wave 0 Requirements

- [ ] Verify whether `packages/shared/src/draftEngine.test.ts` exists as a standalone unit-test file for the pure engine functions (`resolveGkCandidates`, `resolveTieredCandidates`, the new same-pool cascade helper), separate from `packages/server/src/__tests__/draftPacks.test.ts`'s integration-style structural-invariant tests. If missing, the draft-engine wave must create one — the new D-08 cascade logic is intricate enough to warrant direct unit tests against `resolveTieredCandidates`, not just indirect exercise through `generateMatchPacks`.
- [ ] No framework install needed — Vitest is already configured and working in all 3 packages.

---

## Manual-Only Verifications

All phase behaviors have automated verification. No manual-only items identified — all 5 bugs are server/engine-level logic corrections with existing Vitest coverage patterns to extend (no CSS/visual/layout behaviors in scope for this phase).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies — pending planner
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify — pending planner
- [x] Wave 0 covers all MISSING references (draftEngine.test.ts existence check)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [ ] `nyquist_compliant: true` — pending planner output; set once plans map every row above to a task

**Approval:** pending — awaiting PLAN.md creation
