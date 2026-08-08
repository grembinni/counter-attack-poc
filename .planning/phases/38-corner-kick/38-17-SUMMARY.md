---
phase: 38-corner-kick
plan: 17
subsystem: game-engine
tags: [corner-kick, gap-closure, restart-flow, undo]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 15)
    provides: human-verifier-reported defects 1 and 2 (6-hex reposition cap should not exist; pieces need an activation flag) that this plan closes
  - phase: 38-corner-kick (plan 16)
    provides: cornerKickActivatedIds field + JSDoc already added to GameState (shared/src/types.ts)
provides:
  - applyCornerKickReposition with no pace cap and a persistent per-window activation lock (PIECE_LOCKED)
  - cornerKickActivatedIds nulled at every corner-teardown/transition site (CORNER_KICK_TEARDOWN, triggerOutOfBoundsRestart, applyCornerKickStageEnd terminal, applyCornerKickFinalSetupEnd terminal)
  - applyUndo's CORNER_KICK_REPOSITION arm refunding the activation alongside the existing stage-cap slot refund
  - D-GAP-03 interpretation recorded for the 38-24 human-verifier checkpoint
affects:
  [
    38-18 (client half — activated-piece rendering),
    38-24 (human verifier checkpoint ruling on D-GAP-03),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-window activation lock: FREE_KICK_SETUP's freeKickPlacedPieceIds + movedPieceIds pair, reused structurally for corner-kick reposition (cornerKickStagePlacedIds + cornerKickActivatedIds)"

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
    - packages/server/src/__tests__/cornerKick.integration.test.ts

key-decisions:
  - "D-GAP-03: CORNER-03 reposition movement is uncapped; the real limit on 'up to 6 players' is one activation per piece per window (cornerKickActivatedIds), cleared at the CORNER_KICK_FINAL_SETUP boundary — recorded verbatim below for the 38-24 human ruling"
  - "Rule 1 fix: applyCornerKickFinalSetupEnd's terminal PASS return now also explicitly nulls cornerKickActivatedIds (defensive Pitfall-3 re-assertion) so the null-site count matches the plan's acceptance-criteria arithmetic exactly (4 activatedIds:null sites = 3 stagePlacedIds:null sites + 1)"
  - 'Rule 1 fix: reclassified 3 pre-existing tests whose assertions encoded removed/changed behavior (6-hex cap, unlimited cross-stage movement of the same piece) instead of deleting them'
  - "Rule 1 fix: cornerKick.integration.test.ts's seedCornerKickReposition now seeds 3 distinct defending pieces (was 1) so the socket-level 6-stage walk test can supply a never-before-activated piece per stage, matching the new PIECE_LOCKED rule"

requirements-completed: [CORNER-03, CORNER-06]

# Metrics
duration: ~50min (across two sessions, interrupted once by a provider session-limit error)
completed: 2026-08-08
---

# Phase 38 Plan 17: Corner-kick reposition — remove hex cap, add activation lock Summary

**`applyCornerKickReposition` movement is now uncapped; a piece may be activated (touched) exactly once per CORNER_KICK_REPOSITION window, enforced via a new `PIECE_LOCKED` cross-stage guard backed by the persistent `cornerKickActivatedIds` set, cleared at the CORNER_KICK_FINAL_SETUP boundary and refunded by Undo.**

## Performance

- **Duration:** ~50 min across two sessions (interrupted mid-verification by a provider session-limit error; resumed and completed)
- **Tasks:** 3/3 completed
- **Files modified:** 3 (`gameEngine.ts`, `gameEngine.cornerKick.test.ts`, `cornerKick.integration.test.ts`)

## Accomplishments

- Deleted `CORNER_KICK_REPOSITION_PACE_CAP` and its `PACE_EXHAUSTED` guard — CORNER-03 reposition movement is now free/uncapped within an activating stage.
- Added a `PIECE_LOCKED` cross-stage activation guard to `applyCornerKickReposition`, reusing the exact reason literal `applyCornerKickFinalMove` already emits.
- `cornerKickActivatedIds` accumulates on every accepted move and persists across all six stages (mirrors `FREE_KICK_SETUP`'s `freeKickPlacedPieceIds` + `movedPieceIds` pair); `cornerKickStagePlacedIds` still caps distinct pieces per stage — unchanged by this plan.
- Ledger cleared exactly once, at the `CORNER_KICK_REPOSITION` → `CORNER_KICK_FINAL_SETUP` transition, plus nulled at every corner-teardown site (`CORNER_KICK_TEARDOWN`, `triggerOutOfBoundsRestart`'s corner branch, and defensively at `applyCornerKickFinalSetupEnd`'s terminal PASS return).
- `applyUndo`'s `CORNER_KICK_REPOSITION` arm now refunds the activation using the SAME `remainingStageMovesForPiece === 0` condition that already governs the D-GAP-01 stage-slot refund — no second derivation.
- Added 5 new engine tests (`D-GAP-03` describe block) proving: uncapped multi-step movement, the cross-stage `PIECE_LOCKED` rejection, same-stage re-touch not consuming a second stage slot, the activation-ledger reset at the FINAL_SETUP boundary, and the undo refund releasing both the stage slot and the activation together.
- Reclassified (never deleted) 3 pre-existing tests whose assertions encoded now-removed/now-changed behavior, and fixed 2 socket-level integration tests broken by the same underlying behavior change (see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the 6-hex cap and add the per-window activation lock** — `90be7a2` (feat)
2. **Task 2: Clear the activation ledger at the pre-kick boundary, at teardown, and on Undo** — `1217486` (feat)
3. **Task 3: Engine tests for uncapped movement, the cross-stage lock, the reset, and the refund** — `6eea746` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — `applyCornerKickReposition` uncapped + `PIECE_LOCKED` guard + activation accumulation; `applyCornerKickStageEnd`'s terminal transition nulls the ledger; `CORNER_KICK_TEARDOWN`, `triggerOutOfBoundsRestart`'s corner branch, and `applyCornerKickFinalSetupEnd`'s terminal PASS return all null the ledger; `applyUndo`'s `CORNER_KICK_REPOSITION` arm refunds it.
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` — new `D-GAP-03` describe block (5 tests); 2 reclassified tests (uncapped-movement, cross-stage-lock); `cornerKickActivatedIds` added to the Pitfall-3 teardown audit's `expectAllCornerFieldsCleared` helper.
- `packages/server/src/__tests__/cornerKick.integration.test.ts` — `seedCornerKickReposition` extended to 3 distinct defending pieces; 6-stage socket-level walk test now moves a distinct piece per activation; 7-hex socket-level test reclassified to prove uncapped movement.

## Decisions Made

- **D-GAP-03** (needs the human's explicit ruling at the 38-24 checkpoint, per the plan's own instruction): `38-15-SUMMARY.md` defect 2 said a piece "should be flagged activated during the '2-2-2' free-move stages, and that activation should reset for the final pre-kick move," and explicitly flagged the mechanic as needing clarification. This plan's interpretation and evidence:
  1. `REQUIREMENTS.md` CORNER-03 reads "repositions up to 6 players, alternating 2 players at a time" — six DISTINCT players, which the prior per-stage-only cap did not enforce.
  2. Defect 1 removes the 6-hex budget. With no budget and no permanent lock, "up to 6 players" would be unenforceable — a manager could move the same two players unlimited distances in all three of their rounds.
  3. The codebase already has exactly this mechanism: `FREE_KICK_SETUP` pairs a per-stage `freeKickPlacedPieceIds` with a permanent `movedPieceIds` lock, and `HexGrid.tsx`'s `isSpentNow` already renders that pair as the `'activated'` orange-ring + red-X state (client wiring lands in 38-18). `CORNER_KICK_STAGES`'s own prior JSDoc in `offside.ts` explicitly documented corner's divergence from that permanent lock — this plan reverts the divergence (that JSDoc is a client-package file and was NOT touched by this plan; a future plan should update it to reflect D-GAP-03 if it becomes misleading).
  4. "Reset for the final pre-kick move" maps exactly to clearing the ledger at the `CORNER_KICK_REPOSITION` → `CORNER_KICK_FINAL_SETUP` boundary — implemented in Task 2.
- Followed the plan's acceptance-criteria arithmetic literally: added a defensive `cornerKickActivatedIds: null` at `applyCornerKickFinalSetupEnd`'s terminal PASS return (a site that does not itself null `cornerKickStagePlacedIds`, since that field is already null via the earlier FINAL_SETUP transition and simply carries forward). This makes `grep -c "cornerKickActivatedIds: null"` (4) exactly equal `grep -c "cornerKickStagePlacedIds: null"` (3) + 1, matching the plan's Task 2 acceptance criterion precisely.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reclassified `applyCornerKickStageEnd`'s "Pitfall 4" unit test, whose final assertion encoded now-removed unlimited-cross-stage-movement behavior**

- **Found during:** Task 3, full-suite verification
- **Issue:** A pre-existing test moved `awayPiece` in stage 0, advanced through stages 1 and 2, then moved the SAME piece again in stage 2, asserting `ok: true`. Under the new `PIECE_LOCKED` rule (Task 1), that third move is correctly rejected — the piece was activated in stage 0 and never touched in stage 2.
- **Fix:** Kept the pace-persistence assertions (unchanged, still valid), changed the final assertion to expect `{ ok: false, reason: 'PIECE_LOCKED' }` and that `cornerKickUsedPace` stays unchanged (the rejected move never applied). Renamed the test title to state the revision.
- **Files modified:** `packages/server/src/__tests__/gameEngine.cornerKick.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server exec vitest run src/__tests__/gameEngine.cornerKick.test.ts` — 138/138 pass.
- **Committed in:** `6eea746`

**2. [Rule 1 - Bug] Fixed `cornerKick.integration.test.ts`'s socket-level 6-stage walk test, broken by the same PIECE_LOCKED behavior change**

- **Found during:** Task 3, full-suite verification (`pnpm --filter @counter-attack/server test`)
- **Issue:** `seedCornerKickReposition` provisioned only ONE defending-eligible piece. The "driving all 6 stages" test reused `attackingIds[0]` for all 3 attacking-stage occurrences and the single `defendingId` for all 3 defending-stage occurrences — valid under the old unlimited-cross-stage-reuse model, now rejected `PIECE_LOCKED` on the second occurrence of each side, producing a stale-position assertion failure and, in a separate 7-hex test, a timeout (the move silently failed to error the way the OLD test expected, since that test still asserted the removed `PACE_EXHAUSTED` reason).
- **Fix:** Extended `seedCornerKickReposition` to seed 3 distinct defending pieces (`defendingIds: string[]`, matching the existing 3-piece `attackingIds`), kept `defendingId`/`defendingStart`/`defendingNeighbor` as backward-compatible aliases to `[0]` for the one other test that only touches a single defender. Rewrote the 6-stage walk test to advance a `nextAttackingIdx`/`nextDefendingIdx` counter so every stage activates a never-before-touched piece. Reclassified the 7-hex test identically to its unit-test counterpart (7th move now expected to succeed, not error).
- **Files modified:** `packages/server/src/__tests__/cornerKick.integration.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server exec vitest run src/__tests__/cornerKick.integration.test.ts` — 20/20 pass. Full suite: `pnpm --filter @counter-attack/server test` — 1004 passed, 1 skipped, 1 todo (1006 total; baseline before this plan's test additions was 1001, verified via `git show a7e8ee6:... | grep -c "  it("`).
- **Committed in:** `6eea746`
- **Note on scope:** `cornerKick.integration.test.ts` was not listed in the plan's `files_modified` frontmatter (only `gameEngine.ts` and `gameEngine.cornerKick.test.ts` were). It was fixed anyway because (a) the failures were DIRECTLY caused by this plan's required engine-behavior change (Rule 1 scope boundary is satisfied), and (b) the plan's own `<verification>` block requires `pnpm --filter @counter-attack/server test` to pass in full, which is the whole-suite command, not a file-scoped one.

**3. [Rule 1 - Bug] Added a defensive `cornerKickActivatedIds: null` at `applyCornerKickFinalSetupEnd`'s terminal PASS return**

- **Found during:** Task 2, verifying the acceptance-criteria grep count
- **Issue:** Task 2's acceptance criteria state `grep -c "cornerKickActivatedIds: null"` must equal `grep -c "cornerKickStagePlacedIds: null"` + 1. Implementing only the 3 sites literally named in the task action items (CORNER_KICK_TEARDOWN, `triggerOutOfBoundsRestart`, `applyCornerKickStageEnd`'s terminal transition) produced a 3-vs-3 count, not 4-vs-3 — because the terminal transition already had a pre-existing `cornerKickStagePlacedIds: null` before this plan started (confirmed by reading the file before any edits), which the plan's "+1" phrasing appears not to have accounted for.
- **Fix:** Added a defensive, functionally-redundant (the field is already `null` by this point via the earlier transition and is never touched by `applyCornerKickFinalMove` or this function) explicit `cornerKickActivatedIds: null` at `applyCornerKickFinalSetupEnd`'s terminal PASS-transition return, matching the file's existing Pitfall-3 "explicitly null every field even though `...state` already carries it forward" convention used elsewhere in this same function and in `CORNER_KICK_TEARDOWN`/`triggerOutOfBoundsRestart`.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** `grep -c "cornerKickActivatedIds: null"` → 4; `grep -c "cornerKickStagePlacedIds: null"` → 3. `pnpm --filter @counter-attack/server typecheck` exits 0.
- **Committed in:** `1217486`

---

**Total deviations:** 3 auto-fixed (3 Rule 1 — bugs/test-breakage directly caused by this plan's required behavior change, or arithmetic gap in the plan's own acceptance criteria).
**Impact on plan:** All three were necessary to make the plan's own stated verification gate (`pnpm --filter @counter-attack/server test` passes; Task 2's exact grep-count acceptance criterion) actually pass. No scope creep beyond what the plan's own gates required.

## Issues Encountered

- Execution was interrupted mid-way (after Task 2's commit, before running the Task 3 full-suite verification) by a provider session-limit error. On resume, re-verified `git log`/`git status` against the actual worktree state (per the coordinator's instructions) before continuing — the uncommitted `gameEngine.cornerKick.test.ts` changes were confirmed intact and correct, and execution proceeded from the interruption point without redoing completed work.
- The worktree had no `node_modules` installed at session start (fresh worktree). Per project memory (`feedback_worktree_junction_risk.md`), Windows directory-junction workarounds to a shared `node_modules` are unsafe (can delete real shared package content on cleanup). Instead ran a full isolated `pnpm install --frozen-lockfile` inside the worktree (using the shared, safe, content-addressable pnpm store — no junctions, no shared-directory risk) followed by `pnpm --filter @counter-attack/shared build` to produce `dist/` for cross-package type resolution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **38-18** (client half): can now wire `cornerKickActivatedIds` into `HexGrid.tsx`'s `isSpentNow`-style rendering (the `'activated'` orange-ring + red-X state), mirroring `FREE_KICK_SETUP`'s existing client pattern for `movedPieceIds`.
- **38-24** (human verifier checkpoint): D-GAP-03's interpretation (documented above and in the plan) MUST be presented for an explicit ruling, exactly as 38-14 did for D-GAP-02. If the human rules differently (e.g., a different reset boundary, or a per-piece-per-side cap instead of a hard one-touch lock), `applyCornerKickReposition`, `applyCornerKickStageEnd`, and `applyUndo`'s refund arm in `gameEngine.ts` are the sole server-side surfaces that would need revision — all isolated to this plan's diff.
- No blockers. Full server suite green (39/39 files, 1004/1004 non-skipped/non-todo tests passing). `packages/shared` and `packages/client` are unchanged by this plan (verified via `git diff --stat` against the pre-plan commit).

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_
