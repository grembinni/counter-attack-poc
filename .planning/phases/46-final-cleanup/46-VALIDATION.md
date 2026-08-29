---
phase: 46
slug: final-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-29
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (each package: `"test": "vitest run"`) |
| **Config file** | Per-package (`packages/client/package.json`, `packages/server/package.json`, `packages/shared/package.json` each define their own `test` script) |
| **Quick run command** | `pnpm --filter @counter-attack/client test -- <file-pattern>` (or `@counter-attack/server` for server-side changes) |
| **Full suite command** | `pnpm -w test` (root `"test": "pnpm -r test"`) |
| **Estimated runtime** | Not measured this session — use quick per-file runs during task work, full suite before phase gate |

---

## Sampling Rate

- **After every task commit:** Run the single affected package's `vitest run -- <touched-test-file>` plus `pnpm knip` (fast, catches new dead exports immediately)
- **After every plan wave:** Run `pnpm -w typecheck` (confirmed fast, clean baseline this session)
- **Before `/gsd-verify-work`:** `pnpm -w test && pnpm -w lint && pnpm -w typecheck && pnpm knip` all green — this is the phase's own explicit CLEANUP-13 success criterion, not optional
- **Max feedback latency:** 60 seconds (single-package vitest run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 46-XX-XX | TBD | TBD | CLEANUP-05 (auto-reselect) | — | After interrupt-prompt resume, mid-move piece is re-selected with its ring/valid-hexes when moves remain | unit | `pnpm --filter @counter-attack/client test -- useGameStore` | ✅ existing coverage — exact file to confirm during planning | ⬜ pending |
| 46-XX-XX | TBD | TBD | CLEANUP-06 (ball marker) | — | `FREE_KICK_SETUP` renders the white ball-location ring like every other restart phase | unit | `pnpm --filter @counter-attack/client test -- BallLocationRing` | ✅ `BallLocationRing.test.tsx` | ⬜ pending |
| 46-XX-XX | TBD | TBD | CLEANUP-08 (trigger language) | — | `FREE_MOVE_ATTACK`/`DEFENSE` panel copy names the final-third trigger | unit | `pnpm --filter @counter-attack/client test -- ActionPanel` | ✅ `ActionPanel.test.tsx` | ⬜ pending |
| 46-XX-XX | TBD | TBD | CLEANUP-10 (kicker alignment) | — | `FreeKickSetupPanel` kicker-selection sequence aligned with the shared 6-panel pattern | unit | `pnpm --filter @counter-attack/client test -- FreeKickSetupPanel` | ✅ `FreeKickSetupPanel.test.tsx` | ⬜ pending |
| 46-XX-XX | TBD | TBD | CLEANUP-11 (layout alignment) | — | `PlayerStatsPanel` badge size/column-count matches roster/bench card family | unit/snapshot | `pnpm --filter @counter-attack/client test -- PlayerStatsPanel` | Likely `PlayerStatsPanel.test.tsx` — confirm during planning | ⬜ pending |
| 46-XX-XX | TBD | TBD | Bench patch (D-05..D-09) | — | Standard-mode room's bench is populated with 5 generic players per role, per side | integration | `pnpm --filter @counter-attack/server test -- roomHandlers` | Check existing `roomHandlers` test file for a bench section to extend | ⬜ pending |
| 46-XX-XX | TBD | TBD | CLEANUP-13 (dead code / green suite) | — | Full monorepo build/typecheck/test/knip stays green | integration/gate | `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm knip` | ✅ typecheck/knip confirmed clean this session; lint/test to run during execution | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are TBD pending planner output — the planner must fill in actual plan/wave/task numbers when PLAN.md files are created.*

---

## Wave 0 Requirements

None — every touched component already has an existing `.test.tsx`/`.test.ts` sibling file per this codebase's established 1:1 test-file convention (confirmed for `BallLocationRing`, `ActionPanel`, `FreeKickSetupPanel`, `PenaltyKickSetupPanel`, `CornerKickSetupPanel`, `GoalKickSetupPanel`, `ThrowInSetupPanel`, `KickOffSetupPanel`, `TackleStealPromptPanel`, `FoulChoicePanel`, `GkDiveAtFeetPromptPanel`, `GkBoxEntryPromptPanel`, `DraftPackCarousel`, `CardInjuryBadge`). No new test infrastructure or shared fixtures are needed; this phase extends existing test files rather than creating new ones.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-restart-panel kicker/thrower selection feel | CLEANUP-10 | Interaction alignment across 6 panels is a UX judgment call best confirmed live, beyond unit assertions on individual panel state | Two-browser live walkthrough: run each restart type (FK/PK/CK/GK/TI/KO) and confirm kicker/thrower selection follows one consistent pattern |
| Pitch/roster/bench card visual alignment | CLEANUP-11 | Visual sizing/spacing/border alignment is inherently a rendered-pixel judgment, not something unit/snapshot tests fully capture | Live browser check: open pitch player-stats card, roster card, and bench card side by side; confirm badge size, column count, spacing look aligned |
| Dead-ball hex highlighting consistency | CLEANUP-05/06 | Visual highlight consistency across every phase where the ball is dead is best confirmed by playing through each restart type | Live two-browser walkthrough of each restart type, confirming ball-location ring/hex highlight renders consistently |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none required — see Wave 0 Requirements)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
