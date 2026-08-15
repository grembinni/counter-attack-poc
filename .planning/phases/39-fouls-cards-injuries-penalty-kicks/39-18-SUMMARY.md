---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 18
subsystem: api
tags:
  [
    typescript,
    gameEngine,
    vitest,
    fouls,
    free-kick,
    penalty-kick,
    corner-kick,
    clock,
    uat-gap-closure,
  ]

# Dependency graph
requires:
  - phase: 39-10
    provides: 'resolveFoulChain, triggerFoulFreeKick, applyFoulChoice, and the foulDefenderId/foulVictimId/foulHex/foulSource/foulResume GameState cluster this plan extends'
  - phase: 39-13
    provides: "relocateTrappedFreeKickPieces (shared with applyOffsideFoulWithRelocation) — the conceding-team-only relocation sweep this plan relies on now that foulHex is the carrier's own hex"
provides:
  - 'GameState.foulDuelSucceeded flag on the foul* cluster, set true/false at every applyMove and applyGkDiveAtFeetResponse fouled-override return, nulled by both applyFoulChoice branches'
  - 'applyFoulChoice CONTINUE_NOT_ALLOWED rejection when choice === "continue" and foulDuelSucceeded === true'
  - "TACKLE_ATTEMPT-sourced foulHex sourced from carrier.position (the ball's hex) instead of the tackling defender's destination hex"
  - 'FoulChoicePanel suppression of the Continue Play button when foulDuelSucceeded === true, plus restartErrorMessage mapping for CONTINUE_NOT_ALLOWED'
  - 'A flat +1 minute actionCount charge on corner kick (DEFENDER-slot terminal return), free kick (stageIndex===3 terminal return) and penalty kick (all three terminal outcomes), matching the pre-existing goal-kick precedent'
affects: [39-19, 39-20, 39-21, 39-22, 39-23, 39-24]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Duel-outcome flag threaded through every fouled-override return site (mirrors the existing foulResume snapshot pattern) so a downstream choice handler can gate behaviour on whether the interrupting duel changed possession, without re-deriving it from lastActionType'
    - 'Client-side button suppression paired with a server-side authoritative rejection reason (CONTINUE_NOT_ALLOWED) — UX convenience never doubles as the enforcement point'
    - "Flat per-branch clock charge added to explicit terminal-only return sites (never hoisted to a shared teardown when intermediate stage-advance returns must NOT be charged), matching applyGoalKickMoveEnd's established precedent"

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.restartTimeCost.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.fouls.test.ts
    - packages/server/src/__tests__/foulFreeKick.integration.test.ts
    - packages/client/src/components/FoulChoicePanel.tsx
    - packages/client/src/components/FoulChoicePanel.test.tsx
    - packages/client/src/utils/restartErrorMessage.ts
    - packages/client/src/utils/restartErrorMessage.test.ts

key-decisions:
  - "39-UAT.md root_cause correction (recorded per the plan's <output> instruction): the STEAL_ATTEMPT resolveFoulChain call site's foulHex: to was ALREADY CORRECT before this plan. In a STEAL_ATTEMPT the mover (pieceId) IS the ball carrier (moveValidator's state.ball.carrierId === piece.id guard, confirmed by victimId: pieceId), so `to` was already the carrier's — and therefore the ball's — post-move hex. Only the TACKLE_ATTEMPT call site needed the foulHex: carrier.position fix; 39-UAT.md's original diagnosis that both call sites were wrong was itself wrong about the STEAL_ATTEMPT half."
  - "The fouled carrier standing on freeKickHex after the restart required NO additional handling beyond the plan's mandated integration assertion. relocateTrappedFreeKickPieces already only relocates CONCEDING-team pieces within 2 hexes of freeKickHex (39-13's T-39-13 precedent) — the carrier belongs to the KICKING (fouled) team, so it is correctly left in place, and applyFreeKickMove's kicker-select branch already accepts a destination equal to the piece's own current position. Proved end-to-end in foulFreeKick.integration.test.ts rather than assumed."
  - "Client-side Continue Play suppression is explicitly documented as UX-only (T-39-18-01 in the threat register) — the server's applyFoulChoice CONTINUE_NOT_ALLOWED guard is the actual enforcement point, tested independently of the client."
  - "The +1 minute clock charge is a flat +1 (not GAME_SPEED_MINUTES[state.gameSpeed]) on all three new restart sites, matching applyGoalKickMoveEnd's pre-existing flat +1 precedent that 39-UAT test 9 explicitly asks these three restarts to match."
requirements-completed: [FOUL-02, FOUL-03, FK-01, PEN-01]

# Metrics
duration: ~20min
completed: 2026-08-15
---

# Phase 39 Plan 18: Gap Closure — Continue-Play Gate, Foul Restart Hex, Restart Clock Cost Summary

**Rejects "Continue Play" after a possession-changing foul, relocates the free-kick restart to the ball's hex instead of the fouler's, and charges +1 minute for corner/free/penalty kicks to match the existing goal-kick precedent.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- Added `GameState.foulDuelSucceeded` and wired `applyFoulChoice` to reject `'continue'` with `CONTINUE_NOT_ALLOWED` whenever the duel that produced the foul already succeeded (possession already changed hands) — closes UAT gap 1
- Fixed the TACKLE_ATTEMPT foul restart hex to be sourced from `carrier.position` (the ball's hex) instead of the tackling defender's destination hex — closes UAT gap 2, and corrected the STEAL_ATTEMPT half of 39-UAT.md's original diagnosis (that call site was already right)
- Charged a flat +1 minute `actionCount` on corner kick, free kick and penalty kick restarts, matching the pre-existing goal-kick precedent — closes UAT gap 9
- Suppressed the client's "Continue Play" button when the server flag says continuing isn't allowed, and mapped the new `CONTINUE_NOT_ALLOWED` wire code to player-facing copy
- Proved end-to-end that the fouled carrier — now standing exactly on the relocated `freeKickHex` — can still complete the mandatory kicker-first placement (the integration risk Task 1's location change introduces)

## Task Commits

Each task was committed atomically:

1. **Task 1: Reject Continue Play after a successful duel and source the restart hex from the ball carrier** - `0fb210d` (feat), fixup - `921a56e` (docs)
2. **Task 2: Hide Continue Play in FoulChoicePanel and map the new error code** - `2549295` (feat)
3. **Task 3: Charge 1 minute for corner kick, free kick and penalty kick** - `bb21434` (feat)

_Note: Task 1 received a small follow-up commit (`921a56e`) to reword an explanatory comment so it no longer collided with the plan's own verification grep for `foulHex: to`._

## Files Created/Modified

- `packages/shared/src/types.ts` - Added `GameState.foulDuelSucceeded?: boolean | null` to the foul\* cluster
- `packages/server/src/gameEngine.ts` - `foulDuelSucceeded` set at all 4 `applyMove` fouled-override returns + the GK-dive-at-feet fouled override; TACKLE_ATTEMPT's `resolveFoulChain` call now sources `foulHex` from `carrier.position`; `applyFoulChoice` gained the `CONTINUE_NOT_ALLOWED` guard and nulls the new flag on both branches; `+1` `actionCount` charge added to `applyCornerKickFinalSetupEnd`'s DEFENDER-slot return, `applyFreeKickReady`'s `stageIndex===3` return, and all three `applyPenaltyKickDuel` terminal branches
- `packages/server/src/__tests__/gameEngine.fouls.test.ts` - Updated the TACKLE-source restart-location test to assert the new carrier-hex value; added a `39-18` describe block covering `foulDuelSucceeded` gating for TACKLE/STEAL success and failure
- `packages/server/src/__tests__/gameEngine.restartTimeCost.test.ts` (new) - Table-driven coverage of all four restarts' clock cost, plus negative assertions that intermediate stage-advance returns stay unchanged
- `packages/server/src/__tests__/foulFreeKick.integration.test.ts` - Fixed a stale assertion that no longer holds now that `foulHex` is the carrier's own hex (was asserting no piece stands there at all; now asserts the CONCEDING team was cleared while the KICKING team's carrier legitimately remains); added an end-to-end proof that the relocated carrier can still complete kicker-first placement via `applyFreeKickMove`
- `packages/client/src/components/FoulChoicePanel.tsx` - Reads `foulDuelSucceeded`, derives `continueAllowed`, conditionally renders the Continue Play button and adjusts the helper copy
- `packages/client/src/components/FoulChoicePanel.test.tsx` - Added tests for both button-suppression states
- `packages/client/src/utils/restartErrorMessage.ts` - Added `CONTINUE_NOT_ALLOWED` mapping
- `packages/client/src/utils/restartErrorMessage.test.ts` - Added a test asserting the new mapping is distinct from the generic fallback
- `.planning/phases/39-fouls-cards-injuries-penalty-kicks/deferred-items.md` (new) - Logged a pre-existing, out-of-scope `pnpm lint` infra failure in `packages/shared` (unrelated to this plan)

## Decisions Made

See `key-decisions` in frontmatter — the two most consequential:

1. The STEAL_ATTEMPT foul-restart hex needed NO code change (39-UAT.md's root_cause note was half wrong); only TACKLE_ATTEMPT needed the fix.
2. The fouled carrier standing on `freeKickHex` after a TACKLE-sourced restart required no additional handling — `relocateTrappedFreeKickPieces` already only relocates the conceding team — proved with a new integration test rather than assumed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `foulFreeKick.integration.test.ts`'s pre-existing "no piece stands at foulHex" assertion broke as a direct, expected consequence of Task 1's fix**

- **Found during:** Task 3 verification (`pnpm --filter @counter-attack/server test foulFreeKick`)
- **Issue:** Before this plan, `foulHex` for a TACKLE-sourced foul was the tackling defender's landing hex, and the pre-existing test asserted no piece at all remained there after `relocateTrappedFreeKickPieces` ran. After Task 1's fix, `foulHex` is the carrier's own hex — and the carrier (kicking/fouled team) legitimately remains standing there, so the blanket "no piece" assertion now fails.
- **Fix:** Split the assertion into two: no CONCEDING-team piece stands at `foulHex` (the relocation guarantee that still holds), and the KICKING team's own carrier DOES legitimately stand there (the new, correct behaviour). Updated the surrounding comment and the `seedFoulChoiceViaTackle` helper's returned `foulHex` value (which was silently stale, though nothing downstream had been reading it) to match.
- **Files modified:** `packages/server/src/__tests__/foulFreeKick.integration.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test foulFreeKick` passes (10/10)
- **Committed in:** `bb21434` (Task 3 commit)

**2. [Rule 1 - Bug] My own explanatory comment collided with the plan's verification grep**

- **Found during:** Final verification pass (`grep -n "foulHex: to" packages/server/src/gameEngine.ts` returned 2 lines instead of the required exactly 1)
- **Issue:** The doc comment explaining why the STEAL_ATTEMPT call site needed no change literally contained the substring `` `foulHex: to` `` in backticks, which the verification grep also matched.
- **Fix:** Reworded the comment to reference "the `foulHex` argument below" instead of quoting the exact literal.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** `grep -n "foulHex: to" packages/server/src/gameEngine.ts` now returns exactly 1 line
- **Committed in:** `921a56e`

---

**Total deviations:** 2 auto-fixed (2 bug fixes, both direct consequences of Task 1's own change)
**Impact on plan:** Both fixes were necessary corrections to test/verification accuracy caused by this plan's own intended behavior change. No scope creep.

## Issues Encountered

- **Worktree had no `node_modules`.** Ran `pnpm install` at the worktree root before any build/test/lint step could run; this created a fresh install via pnpm's content-addressable store (no lockfile or `packages/shared` changes resulted) — not a plan deviation, just required environment setup.
- **Pre-existing `pnpm lint` failure in `packages/shared`, unrelated to this plan.** `packages/shared/src/*.test.ts` (14 files) now exceeds typescript-eslint's `maximumDefaultProjectFileMatchCount` default of 8, configured via `allowDefaultProject` in `eslint.config.js`. Confirmed via `git stash` that the failure is identical on the pre-39-18 commit. Logged to `deferred-items.md`; verified this plan's own files are lint-clean via `npx eslint <touched-files>` directly.
- **A transient `vitest` "Worker exited unexpectedly" error** appeared on one server full-suite run (1 of 53 test files silently skipped that run) but did not reproduce on immediate retry (53/53 passed, 1284 tests). Treated as an environment flake, not a regression — no code changes were made in response.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 39-UAT gaps 1, 2 and 9 are closed and regression-tested at both the engine and client layer.
- `foulDuelSucceeded` and the corrected `foulHex` provenance are available for any later Phase 39 gap-closure plan that touches the foul chain.
- The `packages/shared` ESLint default-project ceiling (see Issues Encountered / `deferred-items.md`) should be picked up as its own small cleanup item before it blocks a future plan's `pnpm lint` step outright.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-15_

## Self-Check: PASSED

- SUMMARY.md file exists on disk
- Commits 0fb210d, 2549295, bb21434, 921a56e all found in git log
