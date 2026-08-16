---
status: resolved
trigger: 'bug - title for free kick is wrong "Offside — Free Kick" on takle from behind. Either make free kick title generic or have the correct context'
created: 2026-08-16T00:19:29Z
updated: 2026-08-16T00:38:57Z
---

## Current Focus

hypothesis: (CONFIRMED — see Resolution) FreeKickSetupPanel.tsx hardcodes the panelHeading literal "Offside — Free Kick" in both its waiting-panel branch (line 81) and its active-stage branch (line 187), unconditional on trigger source. No GameState field distinguishes offside-triggered vs. foul-triggered free kicks (confirmed: triggerFoulFreeKick in gameEngine.ts explicitly omits any trigger/source marker, and offsidePieceIds is a sticky, continuously-re-evaluated array unrelated to "this free kick's trigger"). All sibling restart panels (CornerKickSetupPanel, GoalKickSetupPanel, ThrowInSetupPanel, PenaltyKickSetupPanel, KickOffSetupPanel) use a generic family-name-only panelHeading ("Corner Kick", "Goal Kick", "Throw-In", "Penalty Kick", "Kick-Off Setup") with zero trigger-context prefix — establishing the codebase convention. EventBanner.tsx's transient banner for this same phase already reads 'Free Kick!' (generic, no "Offside —" prefix) per its RESTART_BANNERS table. Fix: align FreeKickSetupPanel's panelHeading with this convention — change both literals from "Offside — Free Kick" to "Free Kick" (generic option from the bug report, and the minimal/convention-consistent one — no new state plumbing needed).
test: n/a — fix confirmed via codebase convention + grep evidence, no ambiguity requiring a runtime test
expecting: n/a
next_action: awaiting human verification in live two-browser session (self-verification complete: fix applied, stale test assertions updated, full client suite green)
reasoning_checkpoint:
hypothesis: "FreeKickSetupPanel.tsx hardcodes panelHeading = 'Offside — Free Kick' unconditionally (2 locations), and no GameState field exists to distinguish offside vs. foul trigger, so branching on trigger would require new state plumbing; the minimal, convention-consistent fix is to make the title generic, matching every other restart setup panel."
confirming_evidence: - "grep confirms exactly 2 occurrences of the literal 'Offside — Free Kick', both in FreeKickSetupPanel.tsx (lines 81, 187), and zero occurrences elsewhere in packages/ (including tests) — no coupled test expectations." - "triggerFoulFreeKick (gameEngine.ts:1531-1556) and triggerOffsideFoul (offside.ts:234) both transition to FREE_KICK_SETUP but neither sets any field like freeKickTrigger/freeKickReason; offsidePieceIds is a sticky, globally-re-evaluated array (D-23), not a marker of 'was THIS free kick offside-triggered'." - "All 5 sibling restart setup panels (CornerKickSetupPanel, GoalKickSetupPanel, ThrowInSetupPanel, PenaltyKickSetupPanel, KickOffSetupPanel) use a plain family-name panelHeading with no trigger-context prefix — established codebase convention." - "EventBanner.tsx's RESTART_BANNERS table already renders 'Free Kick!' (generic) for FREE_KICK_SETUP phase entry — the transient banner never had the 'Offside —' prefix; only the sidebar panel heading does."
falsification_test: "If a test or the bug report explicitly required the offside-specific wording to be preserved for offside-triggered free kicks (i.e. wanted contextual titles, not generic), this fix would be wrong. Re-read trigger: 'Either make free kick title generic or have the correct context' — generic is explicitly offered as an acceptable resolution, so this is not a violation."
fix_rationale: "Removes the incorrect always-'Offside' claim without inventing new state plumbing (freeKickTrigger field) that no other part of the codebase needs yet, and matches the exact same generic-title convention already used by every sibling restart panel and by EventBanner's own banner for this phase."
blind_spots: "Did not add a distinguishing freeKickTrigger state field — if a future requirement needs foul-specific vs. offside-specific wording (e.g. showing which foul type occurred), this fix does not provide that hook and a field would need to be added then. Not verified in a live two-browser session (self-verification only: unit/component test level)."
tdd_checkpoint: null

## Symptoms

expected: The free-kick banner/title should reflect the actual trigger — "Offside — Free Kick" only when the free kick was awarded for offside, and something else (foul-specific wording, or a generic "Free Kick") when awarded from a foul (e.g. tackle-from-behind, or any other foul source added in Phase 39's gap-closure round).
actual: The title always shows "Offside — Free Kick" regardless of trigger, including when the free kick was awarded from a tackle-from-behind foul.
errors: none reported — this is a UI/copy correctness bug, not a crash
reproduction: Trigger a tackle-from-behind foul (die of 1 or 2 on the tackling defender when landing on either hex directly behind the ball carrier — new in Plan 39-24), choose "restart" at the foul choice prompt, observe the free-kick setup banner/title.
started: Reported in live two-browser testing session immediately after Phase 39 gap-closure plans 39-18 through 39-24 landed (2026-08-15/16). Free-kick titling itself predates Phase 39 (offside free kicks existed before); the bug is that foul-sourced free kicks (new/expanded in Phase 39) reuse the same title without adjusting for source.

## Eliminated

## Evidence

- timestamp: 2026-08-16T00:30:00Z
  checked: grep for "Offside" + "Free Kick" literal strings across packages/client/src/components
  found: Exactly 2 occurrences, both in FreeKickSetupPanel.tsx (line 81 in the !isMyStage waiting-panel branch, line 187 in the active-stage render) — literal `<span className={styles.panelHeading}>Offside — Free Kick</span>`. No occurrences in EventBanner.tsx, FoulChoicePanel.tsx, or any test file.
  implication: The bug is isolated to FreeKickSetupPanel.tsx's panelHeading; no other component needs changing.

- timestamp: 2026-08-16T00:31:00Z
  checked: gameEngine.ts triggerFoulFreeKick (line 1531) and offside.ts triggerOffsideFoul (line 234) — both transition state.phase to FREE_KICK_SETUP
  found: Neither function sets any field distinguishing trigger source (no freeKickTrigger/freeKickReason/freeKickFoulType field exists anywhere in packages/shared/src/types.ts). offsidePieceIds exists but is a sticky, globally re-evaluated array (per D-23 comments) unrelated to marking "this specific free kick's trigger" — it's the wrong signal to branch on even if read.
  implication: No existing state field can be used to correctly branch the title on trigger source without adding new state plumbing.

- timestamp: 2026-08-16T00:32:00Z
  checked: panelHeading conventions across all sibling restart setup panels (grep across packages/client/src/components)
  found: CornerKickSetupPanel -> "Corner Kick", GoalKickSetupPanel -> "Goal Kick", ThrowInSetupPanel -> "Throw-In", PenaltyKickSetupPanel -> "Penalty Kick", KickOffSetupPanel -> "Kick-Off Setup". All generic family names, zero trigger-context prefixes. EventBanner.tsx's RESTART_BANNERS table also uses generic "Free Kick!" (no "Offside —" prefix) for the FREE_KICK_SETUP phase-entry banner.
  implication: The established codebase convention is generic, family-name-only titles for restart panels. FreeKickSetupPanel's "Offside — Free Kick" is the sole outlier. Confirms the trigger's "make it generic" option is both correct and minimal — no new state field needed.

## Resolution

root_cause: FreeKickSetupPanel.tsx hardcodes the panelHeading literal "Offside — Free Kick" in both its waiting-panel branch (line 81) and active-stage branch (line 187), regardless of what triggered the FREE_KICK_SETUP phase. No GameState field distinguishes offside-triggered vs. foul-triggered free kicks (triggerFoulFreeKick omits any such marker by design), so the title was always wrong for foul-sourced free kicks (e.g. tackle-from-behind, added/expanded in Phase 39 gap-closure). This is a pure UI copy bug — the underlying free-kick setup logic (stages, constraints, kicker placement) is unaffected and correct for both trigger sources.
fix: Replaced both "Offside — Free Kick" literals in packages/client/src/components/FreeKickSetupPanel.tsx (lines 81, 187) with generic "Free Kick", matching the established convention used by every sibling restart setup panel (CornerKickSetupPanel, GoalKickSetupPanel, ThrowInSetupPanel, PenaltyKickSetupPanel, KickOffSetupPanel) and by EventBanner's own generic "Free Kick!" banner text for the same phase.
verification: Self-verified — FreeKickSetupPanel.test.tsx's two assertions that pinned the old "/offside — free kick/i" literal were updated to expect "/^free kick$/i" (matching the new generic heading, consistent with all sibling restart panels' bare-family-name convention). Full FreeKickSetupPanel.test.tsx suite (29 tests) passes. Full client package test suite (34 files, 954 tests) passes with zero regressions. Confirmed by the user in a live two-browser session (2026-08-16) — accepted.
files_changed:

- packages/client/src/components/FreeKickSetupPanel.tsx
- packages/client/src/components/FreeKickSetupPanel.test.tsx
