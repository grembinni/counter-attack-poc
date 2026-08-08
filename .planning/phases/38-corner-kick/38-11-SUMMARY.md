---
phase: 38-corner-kick
plan: 11
subsystem: client
tags: [undo, corner-kick, ux, gap-closure]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: 38-09 gap-closure item 7 (live Undo check requires a reachable button); 38-10 server-side applyUndo fix for CORNER_KICK_FINAL_SETUP's moveTypeForPhase (parallel plan, not yet merged at execution time — this plan only adds the client mirror, does not touch gameEngine.ts)
provides: two reachable Undo buttons in CornerKickSetupPanel (CORNER_KICK_REPOSITION, CORNER_KICK_FINAL_SETUP)
affects: [38-corner-kick gap-closure item 7 live walkthrough]
requirements-completed: [CORNER-03, CORNER-06]

# Tech stack
tech-stack:
  added: []
  patterns:
    - "Client-side canUndo IIFE mirror (boundary-scan + move-type-scan over eventLog), copied from FreeKickSetupPanel.tsx's canUndo and ActionPanel.tsx's canUndo — UX hint only, server's applyUndo is sole enforcement layer"

# Key files
key-files:
  created: []
  modified:
    - packages/client/src/components/CornerKickSetupPanel.tsx
    - packages/client/src/components/CornerKickSetupPanel.test.tsx

# Decisions
decisions:
  - "canUndoReposition boundary types: CORNER_KICK_STAGE_ADVANCE, CORNER_KICK_TAKER_PLACED; move type scanned: MOVE (matches applyUndo's default moveTypeForPhase branch for CORNER_KICK_REPOSITION, which has no explicit phase case)"
  - "canUndoFinalSetup boundary type: CORNER_KICK_STAGE_ADVANCE only; move type scanned: CORNER_KICK_MOVE (matches the fix specified for 38-10's moveTypeForPhase CORNER_KICK_FINAL_SETUP case — this plan does not implement that server fix, only the client mirror that assumes it)"
  - "Undo button uses plain styles.ctaButton (no ready/pending color class), matching FreeKickSetupPanel's neutral Undo styling; not wrapped in withEndTurnGuard since Undo is not an end-turn action"
  - "No new CSS added or modified (D-09 compliance) — module.css diff is empty"

# Metrics
duration: ~35min
completed: 2026-08-08
---

# Phase 38 Plan 11: Corner-Kick Reposition Undo Buttons Summary

Added two client-side Undo buttons — one in `CORNER_KICK_REPOSITION`, one in `CORNER_KICK_FINAL_SETUP` — to `CornerKickSetupPanel.tsx`, each gated by a local `canUndo*` boundary-scan mirror modelled on `FreeKickSetupPanel.tsx`'s existing pattern, making the server-side Undo behavior (validated/fixed by the parallel plan 38-10) reachable from the UI for the first time.

## What Was Built

**Task 1 — Undo buttons and canUndo mirrors (`packages/client/src/components/CornerKickSetupPanel.tsx`, `CornerKickSetupPanel.test.tsx`):**

- Added three new store selectors at the top of `CornerKickSetupPanel`: `eventLog`, `lastDiceRoll`, `emitUndo` — matching `FreeKickSetupPanel.tsx`'s naming exactly.
- In the `CORNER_KICK_REPOSITION` branch, added `canUndoReposition`: false when `lastDiceRoll` is truthy; otherwise scans `eventLog` for the last `CORNER_KICK_STAGE_ADVANCE`/`CORNER_KICK_TAKER_PLACED` boundary and checks for a `MOVE` event after it.
- In the `CORNER_KICK_FINAL_SETUP` branch, added `canUndoFinalSetup`: same shape, boundary type `CORNER_KICK_STAGE_ADVANCE` only, scanned move type `CORNER_KICK_MOVE`.
- Rendered an `Undo` button (plain `styles.ctaButton`, no ready/pending class, `disabled={!canUndo*}`, `onClick={emitUndo}`) immediately above the existing Confirm button in both branches, inside the same panel div, after `humanisedError`.
- Left the other four render branches (both GK setup windows, taker-select, and the PASS-phase High/Low choice) completely untouched — no Undo button leaks into any of them.
- Added 5+ new tests to `CornerKickSetupPanel.test.tsx`: Undo button presence, disabled-with-no-boundary-move state, enabled+emits-`GAME_UNDO` for both `CORNER_KICK_REPOSITION` (scanning `MOVE`) and `CORNER_KICK_FINAL_SETUP` (scanning `CORNER_KICK_MOVE`), plus a dedicated `describe` block asserting Undo is absent from all four non-reposition branches (both GK windows, taker-select, a waiting-state variant, and the PASS High/Low choice).

**Task 2 — Regression sweep:** Ran the full client suite (743 tests, 30 files, all green — including the new 46-test `CornerKickSetupPanel.test.tsx` and the pre-existing `GameBoard.test.tsx` corner-kick dispatch tests), client typecheck (clean), and stylelint (clean). No test broke and no production behavior changed beyond Task 1's additions — the plan's "fix broken button-count queries" step was a no-op because no existing test used a broad `getAllByRole('button')`/singular `getByRole('button')` query that the new buttons made ambiguous.

## Verification

- `pnpm --filter @counter-attack/client test -- CornerKickSetupPanel` — 46/46 passed
- `pnpm --filter @counter-attack/client test` — 743/743 passed (30 files)
- `pnpm --filter @counter-attack/client typecheck` — clean
- `pnpm stylelint` — clean
- `git diff --stat packages/client/src/components/CornerKickSetupPanel.module.css` — empty (no new CSS, D-09 compliant)
- Acceptance-criteria greps: `emitUndo` count 3, `CORNER_KICK_STAGE_ADVANCE` count 4 (≥2), `CORNER_KICK_MOVE` count 2 (≥1)

## Deviations from Plan

**Whole-workspace `pnpm lint` not run to a clean exit — pre-existing, out-of-scope failure.** `pnpm lint` (root `eslint .`) fails with "Too many files (>8) have matched the default project" parsing errors inside `packages/shared/src/*.test.ts` — this is the pre-existing `packages/shared` typescript-eslint file-count-cap issue already documented in `.planning/STATE.md` ("the whole-workspace `pnpm lint` OOMs on a pre-existing `packages/shared` typescript-eslint file-count-cap config issue ... doesn't gate CI") since Phase 32. It is unrelated to this plan's files (`packages/shared` was not touched). Per the deviation-rules scope boundary, this was not fixed. Verified client-package lint cleanliness directly instead: `node_modules/.bin/eslint packages/client/**/*.{ts,tsx}` (including both files this plan modified) produced zero output/errors.

No other deviations — plan executed as written. Task 2 required no code changes since the full suite, typecheck, and stylelint were already green after Task 1.

## Known Stubs

None. Both Undo buttons are fully wired to `emitUndo` (which emits `ClientEvents.GAME_UNDO` via the real socket) and their enable/disable state reads live `eventLog`/`lastDiceRoll` store data, not mock or placeholder values.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-38-38 elevation-of-privilege, T-38-39 client-mirror-divergence, T-38-SC no-installs) — no new endpoints, auth paths, or trust-boundary-crossing surface introduced.

## Follow-up Noted (per plan's `<output>` instruction)

`GoalKickSetupPanel.tsx` has the identical missing-Undo gap (no Undo button in either of its reposition windows) — pre-existing from Phase 37, out of scope for this phase. Should be triaged separately (not filed as a formal todo by this plan; flagging here per the plan's explicit instruction).

## Self-Check: PASSED

- FOUND: packages/client/src/components/CornerKickSetupPanel.tsx
- FOUND: packages/client/src/components/CornerKickSetupPanel.test.tsx
- FOUND commit 3bcb7ce (feat(38-11): add Undo buttons to corner-kick reposition panels)
