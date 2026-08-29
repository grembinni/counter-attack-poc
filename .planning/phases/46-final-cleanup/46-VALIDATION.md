---
phase: 46
slug: final-cleanup
status: complete
nyquist_compliant: true
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
| **Estimated runtime** | Measured at phase close (Plan 46-06): full `pnpm -w test` ~15-30s per package in parallel; `pnpm -w lint` ~35s after the CLEANUP-13 config fix; `pnpm -w typecheck` well under 60s |

---

## Sampling Rate

- **After every task commit:** Run the single affected package's `vitest run -- <touched-test-file>` plus `pnpm knip` (fast, catches new dead exports immediately)
- **After every plan wave:** Run `pnpm -w typecheck` (confirmed fast, clean baseline this session)
- **Before `/gsd-verify-work`:** `pnpm -w test && pnpm -w lint && pnpm -w typecheck && pnpm knip` all green — this is the phase's own explicit CLEANUP-13 success criterion, not optional. Confirmed green at phase close (Plan 46-06, Task 1) — see the CLEANUP-13 row below.
- **Max feedback latency:** 60 seconds (single-package vitest run) — confirmed: every touched-package quick run measured well under this bound

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 46-02-T1 | 46-02 | 1 | CLEANUP-05 (auto-reselect) | T-46-02-I | After interrupt-prompt resume (`TACKLE_STEAL_PROMPT`/`GK_DIVE_AT_FEET_PROMPT`/`GK_BOX_ENTRY_PROMPT`/`FOUL_CHOICE` → `MOVE`), mid-move piece is re-selected with its ring/valid-hexes when moves remain, gated to the owning client only | unit | `pnpm --filter @counter-attack/client test -- useGameStore` | ✅ `useGameStore.test.ts` | ✅ green (136/136, part of the full client suite run at phase close) |
| 46-03-T1 | 46-03 | 1 | CLEANUP-05 (Match Speed relocation) | — | Match Speed control lives inside the Advanced Settings disclosure, not as its own always-visible section | unit | `pnpm --filter @counter-attack/client test -- GameSettingsScreen` | ✅ `GameSettingsScreen.test.tsx` | ✅ green (43/43, part of the full client suite run at phase close) |
| 46-04-T1/T2 | 46-04 | 1 | CLEANUP-05 (generic-bench gap closure, D-05..D-09) | — | Standard-mode room's bench is populated with 5 generic players per role, per side, and a generic bench player substitutes onto the pitch end to end | integration | `pnpm --filter @counter-attack/server test -- lineupAssignment substitution` | ✅ `lineupAssignment.integration.test.ts` + `substitution.integration.test.ts` (corrected from the original draft's "check roomHandlers test file" guess — no `roomHandlers`-named test file exists; the two integration files above are the actual coverage) | ✅ green (10/10 + 12/12, part of the full server suite run at phase close; re-verified again after Plan 46-06's comment-only fix to `substitution.integration.test.ts`) |
| 46-01-T1 | 46-01 | 1 | CLEANUP-06 (ball marker) | — | `FREE_KICK_SETUP`/`FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` render the white ball-location ring like every other restart phase; `docs/HIGHLIGHT-REFERENCE.md` resynced to the real 35-member `BALL_MARKER_PHASES` set | unit | `pnpm --filter @counter-attack/client test -- BallLocationRing` | ✅ `BallLocationRing.test.tsx` | ✅ green (24/24, part of the full client suite run at phase close) |
| 46-03-T3 | 46-03 | 1 | CLEANUP-07 (help-text coverage audit) | — | Every `GamePhase` union member (45/45) is audited for help-text coverage; any gap found is fixed or explicitly triaged (`covered`/`n/a`/`deferred`) | audit | n/a — audit-shaped requirement, not a vitest command; evidence is the written record itself, cross-checked against the live `ActionPanel.tsx`/panel-component source during Plan 46-06's own re-audit pass | ✅ `.planning/phases/46-final-cleanup/46-AUDIT.md` Section 1 ("CLEANUP-07: Help-Text Coverage") | ✅ green — 45/45 rows recorded (42 `covered`, 2 `n/a`, 1 `deferred` with full evidence and a surfaced follow-on item); the one `gap` found (`LOOSE_BALL`) was fixed in-task and re-verified (90/90 `ActionPanel.test.tsx`, part of the full client suite run at phase close) |
| 46-01-T2 | 46-01 | 1 | CLEANUP-08 (trigger language) | — | `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` panel heading names the final-third trigger ("Final-Third Movement!" instead of generic "Free Move!") | unit | `pnpm --filter @counter-attack/client test -- ActionPanel` | ✅ `ActionPanel.test.tsx` | ✅ green (90/90, part of the full client suite run at phase close) |
| 46-02-T2 | 46-02 | 1 | CLEANUP-09 (duplicate movement-pattern logic — response-move config table) | — | Six standalone `*_CONFIG` bindings + five-level nested ternary dispatch collapsed into one `RESPONSE_MOVE_CONFIG_BY_PHASE` table, consumed identically by both `selectPiece` and `setGameState`'s sticky block (the exact two-tree-drift shape BUG-09 was caused by) | unit | `pnpm --filter @counter-attack/client test -- useGameStore` | ✅ `useGameStore.test.ts` | ✅ green (136/136, part of the full client suite run at phase close) |
| 46-05-T1 | 46-05 | 2 | CLEANUP-09 (duplicate movement-pattern logic — valid-move tint exception set) | — | Two inline negated phase-literal exclusions (`phase !== 'GK_DIVE' && phase !== 'SNAPSHOT_DEFLECT'`) collapsed into one enumerated, exported, documented `VALID_MOVE_TINT_EXCEPTION_PHASES` constant (grew to 4 members after audit, with no rendering-behavior change) | unit | `pnpm --filter @counter-attack/client test -- HexGrid` | ✅ `HexGrid.test.tsx` | ✅ green (119/119, part of the full client suite run at phase close) |
| 46-03-T2 | 46-03 | 1 | CLEANUP-10 (kicker alignment) | — | `FreeKickSetupPanel`'s kicker-selection sequence uses the same select-then-lock language as the Penalty/Corner/Throw-In panels, with zero change to `FREE_KICK_STAGES`/`freeKickStageTeam` mechanics | unit | `pnpm --filter @counter-attack/client test -- FreeKickSetupPanel` | ✅ `FreeKickSetupPanel.test.tsx` | ✅ green (31/31, part of the full client suite run at phase close) |
| 46-05-T2 | 46-05 | 2 | CLEANUP-11 (layout alignment) | — | `PlayerStatsPanel`'s `TeamBadge` size (48px) and stat-grid column count (3) match the roster/bench card family; stale `56px`/"4-column"/"7-stat" comments corrected | unit | `pnpm --filter @counter-attack/client test -- PlayerStatsPanel` | ✅ `PlayerStatsPanel.test.tsx` | ✅ green (20/20, part of the full client suite run at phase close) |
| 46-03-T3 | 46-03 | 1 | CLEANUP-12 (redundant-flow disposition audit) | — | Every candidate redundant multi-step flow (6 candidates: 3 carried forward from research + 3 newly surfaced) is recorded with a keep-or-collapse decision and a specific reason | audit | n/a — audit-shaped requirement, not a vitest command; evidence is the written disposition table itself | ✅ `.planning/phases/46-final-cleanup/46-AUDIT.md` Section 2 ("CLEANUP-12: Redundant-Flow Disposition") | ✅ green — 6/6 candidates disposed `keep`, each with a specific reason; no collapse candidate met all three criteria (2+ UI steps AND provably-one-action AND no reversibility loss) |
| 46-06-T1 | 46-06 | 3 | CLEANUP-13 (dead code / full monorepo green suite) | T-46-06-T, T-46-06-R, T-46-06-SC | Full monorepo `typecheck`/`lint`/`test`/`knip` gate stays green with no suppressions; bounded dead-code sweep over every file Plans 46-01..46-05 touched (24 files), with every finding fixed or explicitly deferred as pre-existing/out-of-scope | integration/gate | `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm knip` | ✅ typecheck/knip confirmed clean; `pnpm -w lint` was blocked by a pre-existing typescript-eslint default-project file-match cap (fixed in this task, see `46-AUDIT.md`'s CLEANUP-13 section); `pnpm -w test` confirmed green this session | ✅ green — all four commands exit 0: typecheck clean, lint clean (~35s, after the `eslint.config.js` cap fix), test green (shared 907 + server 1635 [1 skipped, 1 todo] + client 1239 = 3,781 tests), knip zero findings. No vitest worker-crash flake observed this session (documented Windows `--pool=forks` workaround was not needed). |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*All placeholder Plan/Wave/Task ID and pending-status cells in the table above were resolved during Plan 46-06 (Task 2), against the five preceding plans' actual SUMMARY.md task numbers and the CLEANUP-13 gate results recorded in `46-AUDIT.md`.*

---

## Wave 0 Requirements

None — every touched component already has an existing `.test.tsx`/`.test.ts` sibling file per this codebase's established 1:1 test-file convention (confirmed for `BallLocationRing`, `ActionPanel`, `FreeKickSetupPanel`, `PenaltyKickSetupPanel`, `CornerKickSetupPanel`, `GoalKickSetupPanel`, `ThrowInSetupPanel`, `KickOffSetupPanel`, `TackleStealPromptPanel`, `FoulChoicePanel`, `GkDiveAtFeetPromptPanel`, `GkBoxEntryPromptPanel`, `DraftPackCarousel`, `CardInjuryBadge`). No new test infrastructure or shared fixtures are needed; this phase extends existing test files rather than creating new ones.

*Existing infrastructure covers all phase requirements. Confirmed correct in retrospect: no plan across 46-01..46-06 needed to create a new test file — all extended an existing sibling.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-restart-panel kicker/thrower selection feel | CLEANUP-10 | Interaction alignment across 6 panels is a UX judgment call best confirmed live, beyond unit assertions on individual panel state | Two-browser live walkthrough: run each restart type (FK/PK/CK/GK/TI/KO) and confirm kicker/thrower selection follows one consistent pattern |
| Pitch/roster/bench card visual alignment | CLEANUP-11 | Visual sizing/spacing/border alignment is inherently a rendered-pixel judgment, not something unit/snapshot tests fully capture | Live browser check: open pitch player-stats card, roster card, and bench card side by side; confirm badge size, column count, spacing look aligned |
| Dead-ball hex highlighting consistency | CLEANUP-05/06 | Visual highlight consistency across every phase where the ball is dead is best confirmed by playing through each restart type | Live two-browser walkthrough of each restart type, confirming ball-location ring/hex highlight renders consistently |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — confirmed: 13/13 tasks across Plans 46-01..46-06 each have exactly one `<automated>` verify block (grep count of `<task type=` equals grep count of `<automated>` in every plan file)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — trivially satisfied given 100% per-task automated-verify coverage above
- [x] Wave 0 covers all MISSING references (none required — see Wave 0 Requirements)
- [x] No watch-mode flags — confirmed: every `<automated>` command across all 6 plans uses `vitest run` (via each package's `test` script) or a one-shot `node -e`/gate command; zero `--watch` flags found
- [x] Feedback latency < 60s — confirmed: every quick per-package/per-file vitest run measured well under 60s; the one full-monorepo gate command (`pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm knip`) is explicitly the phase-close exception, not a per-task sampling command
- [x] `nyquist_compliant: true` set in frontmatter — set above

**Approval:** complete (Plan 46-06, Task 2)
