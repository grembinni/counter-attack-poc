---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 17
subsystem: testing
tags: [undo, replay, event-log, gameEngine, ActionPanel, vitest]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: 'Plans 39-01 through 39-16 — the eleven new Phase 39 ActionEventType members and their server-side applyUndo/REPLAY_ELIGIBLE_TYPES registrations'
provides:
  - 'Client canUndo mirror in ActionPanel.tsx extended with all six Phase 39 applyUndo boundary terms'
  - 'gameEngine.undoReplay39.test.ts — cross-cutting registration audit for all 11 new ActionEventType members'
  - 'REPLAY_ELIGIBLE_TYPES exported from gameEngine.ts for direct test assertion'
affects: [39-phase-gate, milestone-v1.6-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Registration-audit test pattern: enumerate every new ActionEventType literal, assert membership in REPLAY_ELIGIBLE_TYPES XOR absence of ballAfter, as an executable invariant rather than a code comment'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.undoReplay39.test.ts
  modified:
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx
    - packages/server/src/gameEngine.ts

key-decisions:
  - "REPLAY_ELIGIBLE_TYPES changed from module-private to exported so the registration suite can assert membership directly instead of only inferring it indirectly through buildReplayFrames's frame count"
  - "All six Phase 39 applyUndo boundary terms reproduced verbatim in ActionPanel.tsx even though four of them (FOUL_CHOICE, PENALTY_KICK_SETUP_ATTACKING/DEFENDING, PENALTY_KICK_TAKER_SELECT, GK_BOX_ENTRY_MOVE) are currently unreachable there — those phases are each rendered by their own dedicated GameBoard panel, not ActionPanel — reproduced anyway per the plan's explicit term-for-term instruction and to keep the mirror exhaustive against future ActionPanel extension"

requirements-completed: [] # Task 3 (human checkpoint) has not yet run — no requirement in this plan's frontmatter is SATISFIED until the live two-browser UAT is approved.

# Metrics
duration: ~55min (automated portion only; Task 3 checkpoint pending)
completed: 2026-08-14
---

# Phase 39 Plan 17: Undo/Replay Registration Audit + Phase-Gate Checkpoint Summary

**Client Undo-boundary mirror extended to all six Phase 39 applyUndo terms, plus a 30-test cross-cutting Undo/Replay registration suite proving all eleven new ActionEventType members are correctly classified — human two-browser UAT checkpoint (Task 3) not yet run.**

## Performance

- **Duration:** ~55 min (Tasks 1-2, automated)
- **Tasks:** 2 of 3 completed (Task 3 is a blocking human-verify checkpoint, not started)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `ActionPanel.tsx`'s `canUndo` mirror now reproduces all six Phase 39 terms from `gameEngine.ts`'s `applyUndo` `isBoundary` reduce, term for term: the unconditional `GK_DIVE_AT_FEET` boundary, and five phase-guarded terms (`FOUL_CHOICE_MADE`/`FOUL_CHOICE`, `PENALTY_KICK_WINDOW_ADVANCE`/`PENALTY_KICK_SETUP_ATTACKING`/`DEFENDING`, `PENALTY_KICK_TAKER_PLACED`/`PENALTY_KICK_TAKER_SELECT`, `GK_BOX_ENTRY_MOVE`/`GK_BOX_ENTRY_MOVE` phase, `SECOND_HALF_CONFIRM`/`HALF_TIME`). `moveTypeForPhase` gained a `GK_BOX_ENTRY_MOVE` mapping; the penalty reposition phases deliberately stay on the default `MOVE` branch, matching the server's own confirmed decision.
- 8 new `ActionPanel.test.tsx` assertions: the unconditional `GK_DIVE_AT_FEET` boundary verified directly (MOVE and HIGH_PASS_MOVE phases, both the "locked" and "re-enabled after a fresh move" cases), plus confirmation that the five phase-guarded terms never leak a false Undo affordance through `ActionPanel` (each of those phases is rendered by its own dedicated GameBoard panel — `FoulChoicePanel`, `PenaltyKickSetupPanel`, `GkBoxEntryPromptPanel` — never by `ActionPanel`).
- New `gameEngine.undoReplay39.test.ts` (30 tests, ~70 assertions): a registration audit turning the BUG-30/31/37 defect class ("new dice-roll event types are invisible to Undo/Replay unless registered everywhere") into an executable invariant:
  1. Enumerates all 11 new `ActionEventType` members and asserts each is classified exactly once — `REPLAY_ELIGIBLE_TYPES` membership **XOR** no `ballAfter` field. Confirmed: `GK_DIVE_AT_FEET` and `PENALTY_KICK` are eligible; the other 9 are not.
  2. Drives `buildReplayFrames` over a synthetic eventLog containing all 11 new types interleaved with `MOVE`/`GOAL` — no throw, frame count > 0 (the direct guard against the `CORNER_KICK_CLEAR_OUT_MOVE` crash class).
  3. Asserts `applyUndo` returns `{ ok: false, reason: 'UNDO_LOCKED' }` whenever the current slot's events end in a committed Phase 39 dice outcome (`FOUL_CALLED`, `INJURY_CHECK`, `BOOKING_CHECK`, `GK_DIVE_AT_FEET`, `PENALTY_KICK`).
  4. Drives 3 distinct flows through the **real engine functions** (never hand-constructed events) — a TACKLE-sourced foul, a STEAL-sourced foul, and a full GK-dive-at-feet → foul → penalty-kick chain (`applyGkDiveAtFeetResponse` → `applyFoulChoice` → `applyPenaltyKickWindowEnd` ×2 → `applyPenaltyKickTaker` → `applyPenaltyKickDuel`) — and asserts zero `DICE_ROLL` events in every resulting eventLog.
  5. Confirms each of the 5 new phase-guarded boundary terms fires only in its guarding phase, with a positive control (locked in-phase) and a negative control (not locked out-of-phase, proving the guard is phase-specific and not accidentally unconditional).
  6. Confirms an injury's stored attribute degradation (`resilience`/`injuryCount`) survives an `applyUndo` of a later action — the property that makes stored mutation, rather than a penalty array, safe from Undo.
- `REPLAY_ELIGIBLE_TYPES` exported from `gameEngine.ts` (was module-private) so the registration suite could assert membership directly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mirror the new Undo boundaries in the client canUndo derivation** — `a8549e4` (feat)
2. **Task 2: Cross-cutting Undo/Replay registration suite for all eleven new event types** — `2e3d088` (test)

Task 3 (checkpoint:human-verify, gate="blocking") has not started — see "Next Phase Readiness" below.

## Files Created/Modified

- `packages/client/src/components/ActionPanel.tsx` — extended `canUndo`'s `isBoundary` reduce and `moveTypeForPhase` with the six Phase 39 terms; extended the "must stay in sync with applyUndo's isBoundary" comment to document each term and its current reachability
- `packages/client/src/components/ActionPanel.test.tsx` — 8 new assertions (2 new `describe` blocks) covering the unconditional `GK_DIVE_AT_FEET` boundary and the 5 phase-guarded terms' non-leakage
- `packages/server/src/gameEngine.ts` — `REPLAY_ELIGIBLE_TYPES` changed from a module-private `const` to `export const` (no behavior change)
- `packages/server/src/__tests__/gameEngine.undoReplay39.test.ts` — new file, 30 tests

## Decisions Made

- Reproduced all six Phase 39 boundary terms in `ActionPanel.tsx` verbatim, even though four are currently unreachable through `ActionPanel` (their phases are each routed to a dedicated GameBoard panel instead — `FoulChoicePanel`, `PenaltyKickSetupPanel` ×3 phases, `GkBoxEntryPromptPanel`). This was the plan's explicit instruction ("reproduce every Phase 39 term... term for term") and keeps the mirror exhaustive against any future `ActionPanel` extension into those phases, consistent with the existing "must stay in sync" comment convention already established for prior phases' boundary terms.
- Exported `REPLAY_ELIGIBLE_TYPES` (Rule 3 — blocking issue: the registration suite could not assert direct membership without it; this is a minimal, non-breaking visibility change with no behavior change).

## Deviations from Plan

None requiring a code change beyond the plan's own instructions — no Rule 1/2/3 auto-fixes were needed in `gameEngine.ts`'s existing Phase 39 Undo/Replay logic itself; all of it was already correct. One item is flagged below for visibility, not auto-fixed:

### Flagged (not auto-fixed — architectural, out of scope for this plan)

**Deep cross-phase Undo exposure for `PENALTY_KICK_SETUP_ATTACKING`/`DEFENDING` reposition moves.** Unlike every other Phase 39/37/38 restart family (goal kick, corner kick, free kick, throw-in), the penalty reposition windows deliberately emit a plain `MOVE` event rather than a family-specific event type (`gameEngine.ts` comment at the `moveTypeForPhase` default-branch, confirmed as of Plan 39-07: "applyPenaltyKickReposition also emits a plain MOVE event, so no new mapping entry is needed here; confirmed deliberately, not an oversight"). Because `applyStartMovement` never inserts a boundary event when transitioning a restart-resolution phase (`GK_RESTART`, `LOOSE_BALL`) back into `MOVE`, a hand-crafted/malicious `GAME_UNDO` sent at the exact start of a much later, unrelated `MOVE` phase (before any fresh move in that phase) could theoretically walk back and revert the LAST penalty-reposition `MOVE` from a since-resolved penalty sequence, rather than being rejected outright. This is **not** reachable through the real UI: (a) the `GAME_UNDO` socket handler in `gameHandlers.ts` gates on a `validUndoPhases` allow-list that does not include any restart-resolution phase, so `applyUndo` is never even called in those windows in practice; (b) the client's own Bug-C guard (`canUndo` is false whenever `paceUsedByPieceId` is empty at the start of a fresh `MOVE` slot) additionally suppresses the UI affordance. The exposure is narrow (a stale board-position artifact on one piece, not a score/card/injury reversal) and was traced during Task 2's construction but is an architectural characteristic of a Plan 39-07 design decision, not something introduced or regressed by this plan — flagging per Rule 4 rather than silently re-architecting (e.g. adding a dedicated `PENALTY_KICK_MOVE` event type) without explicit sign-off. No code changed for this; recorded here for future gap-closure triage if desired.

## Issues Encountered

- `pnpm test` (full monorepo) failed once with `Error: Worker exited unexpectedly` (a Vitest/tinypool worker-process crash, 51/52 server test files passed, 1253/1273 tests passed before the crash) — confirmed transient by immediate re-run, which passed cleanly (742 shared / 1271 server / 925 client, all green). Not related to this plan's changes.
- The workspace-wide `pnpm lint` fails on a pre-existing `packages/shared` typescript-eslint file-count-cap parsing error (documented tech debt since Phase 32/33, unrelated to any file this plan touched — confirmed via `npx eslint` run directly against the four files this plan created/modified, which is clean).
- `packages/client`/`packages/server` `node_modules` were absent in this fresh worktree; ran `pnpm install` (no junction workaround) and built `packages/shared` (`pnpm --filter @counter-attack/shared build`) before tests/typecheck would resolve.

## Verification

- `pnpm --filter @counter-attack/client test -- ActionPanel.test.tsx` — 86/86 passed
- `pnpm --filter @counter-attack/client run typecheck` — clean
- `pnpm --filter @counter-attack/server test -- gameEngine.undoReplay39.test.ts` — 30/30 passed
- `pnpm --filter @counter-attack/server run typecheck` — clean
- `pnpm --filter @counter-attack/server test` (full server suite) — 1271 passed, 1 skipped, 1 todo
- `pnpm test` (full monorepo) — 742 shared + 1271 server + 925 client = 2938 passed, all green (after one transient worker-crash re-run)
- `pnpm build` — clean (shared/server tsc, client vite build)
- `pnpm run typecheck` (workspace) — clean
- `npx eslint` against the 4 changed/created files — clean
- `pnpm run lint` (workspace) — fails on pre-existing, unrelated `packages/shared` tseslint file-count-cap issue (documented tech debt, does not gate CI per STATE.md)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**BLOCKED on Task 3 — a live two-browser human verification checkpoint (gate="blocking").** This is the phase-gate checkpoint for the entire Phase 39 (Fouls, Cards, Injuries & Penalty Kicks) milestone segment: 32 numbered UAT steps across settings toggles, the foul/injury/booking chain, card/injury board indicators, continue-or-restart, GK dive-at-feet, box-entry response, penalty kicks, two bug fixes (loose-ball direction logging, half-time mutual-confirm), and toggle-off regression checks. `pnpm test` is green (precondition for presenting the checkpoint, satisfied). No requirement in this plan's frontmatter (`FOUL-01..04`, `CARD-01..03`, `INJURY-01..03`, `GKDIVE-02..05`, `PEN-01..03`, `FK-01`, `SETTINGS-01..03`) can be marked SATISFIED until this checkpoint is explicitly approved by a human running the live session — the executor must not simulate or fabricate this verification.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14 (automated portion; checkpoint pending)_

## Self-Check: PASSED

- FOUND: packages/client/src/components/ActionPanel.tsx
- FOUND: packages/client/src/components/ActionPanel.test.tsx
- FOUND: packages/server/src/**tests**/gameEngine.undoReplay39.test.ts
- FOUND: .planning/phases/39-fouls-cards-injuries-penalty-kicks/39-17-SUMMARY.md
- FOUND commit a8549e4 (Task 1)
- FOUND commit 2e3d088 (Task 2)
- FOUND commit 7ec87b6 (docs: plan summary)
