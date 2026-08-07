---
phase: 38-corner-kick
plan: 03
subsystem: game-engine
tags: [typescript, game-engine, corner-kick, hex-movement, vitest]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 02)
    provides: 'triggerOutOfBoundsRestart CORNER_KICK branch, applyCornerKickGkPlace/applyCornerKickGkWindowEnd, applyCornerKickTakerSelect, CORNER_KICK_REPOSITION entry point'
provides:
  - 'computeCornerKickEligibleIds — precomputed once at taker-select time, excludes goalkeepers and the corner-taker (Assumption A4)'
  - 'applyCornerKickReposition — 6-stage alternating strict-pairs reposition window with a per-piece 6-hex cumulative budget (CORNER-03)'
  - 'applyCornerKickStageEnd — stage-advance FSM transition; carries cornerKickUsedPace forward unchanged across all 6 stages (Pitfall 4); terminal stage enters CORNER_KICK_FINAL_SETUP'
  - 'applyCornerKickFinalMove / applyCornerKickFinalSetupEnd — CORNER-06 pre-kick one-piece-per-team 3-hex window, terminating in PASS with lastActionType CORNER_KICK_RESTART'
affects: [38-04, 38-05, 38-06, 38-07, 38-08, 38-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "applyCornerKickReposition structurally copies applyGoalKickReposition's body (adjacency/occupancy/pace-cap) rather than calling it, adding a STAGE_LIMIT_REACHED guard modelled on applyFreeKickMove's PLACEMENT_LIMIT_REACHED"
    - 'cornerKickUsedPace is a per-piece cumulative budget that persists UNCHANGED across all 6 CORNER_KICK_REPOSITION stages — deliberately diverges from applyFreeKickReady/applyFreeKickMove which permanently lock a piece into movedPieceIds after one stage'
    - "applyCornerKickFinalMove/applyCornerKickFinalSetupEnd mirror applyGoalKickMoveEnd's KICKER/OPP slot-flip shape (renamed ATTACKER/DEFENDER) but perform no dice work — the corner kick itself has not been taken yet at this point"

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts

key-decisions:
  - 'Wired computeCornerKickEligibleIds into applyCornerKickTakerSelect (38-02), replacing the null placeholder that plan explicitly left for this plan to fill'
  - 'cornerKickHex/cornerKickTakerId are explicitly carried forward (not assumed via ...state spread) in applyCornerKickFinalSetupEnds terminal PASS return, per the plans Pitfall 3 warning — later plans read these after lastActionType is overwritten by the clients chosen passType'
  - 'exactOptionalPropertyTypes fix: applyCornerKickFinalSetupEnds terminal return normalizes state.cornerKickHex/cornerKickTakerId with `?? null` since the source fields are typed `T | null | undefined` but the target GameState fields are `T | null` — a strict-mode compile error, fixed inline (Rule 1)'

patterns-established:
  - "Corner Kick's CORNER-03/CORNER-06 engine functions are laid out top-to-bottom immediately after applyCornerKickTakerSelect, in chain order, continuing the sequential-reading convention established in 38-02"

requirements-completed: [CORNER-03, CORNER-06]

# Metrics
duration: ~35min
completed: 2026-08-07
---

# Phase 38 Plan 03: Corner Kick Reposition & Pre-Kick Move Windows Summary

**Both of Corner Kick's repositioning windows — CORNER-03's 6-stage alternating strict-pairs window with a persisting per-piece 6-hex budget, and CORNER-06's pre-kick one-piece-per-team 3-hex window — built as 5 new pure engine functions with 91 new unit tests, including the load-bearing Pitfall-4 cross-stage pace-accumulation test.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-07
- **Tasks:** 3 completed
- **Files modified:** 2

## Accomplishments

- `computeCornerKickEligibleIds(pieces, cornerKickTeam, cornerKickTakerId)`: excludes every `role === 'GK'` piece and the corner-taker (Assumption A4), partitions the rest into `attacking`/`defending` id lists; wired into `applyCornerKickTakerSelect`'s return from the POST-placement piece list, replacing the 38-02 `cornerKickEligibleIds: null` placeholder
- `applyCornerKickReposition`: single-hex-per-click movement during `CORNER_KICK_REPOSITION`'s 6 alternating stages — structurally copies `applyGoalKickReposition`'s adjacency (`hexDistance === 1`), `isPitchHex`/occupancy guards, and per-piece cumulative pace-budget accumulation (capped at `CORNER_KICK_REPOSITION_PACE_CAP = 6`), plus a new `STAGE_LIMIT_REACHED` guard (at most 2 distinct pieces touched per stage, modelled on `applyFreeKickMove`'s `PLACEMENT_LIMIT_REACHED`). Acting team is derived from `cornerKickStageTeam(stageIndex, cornerKickTeam)`, never `activeTeam` (T-38-10)
- `applyCornerKickStageEnd(state, team)`: advances the 6 alternating stages (`cornerKickStagePlacedIds` resets to `[]` each stage; `activeTeam` flips per `cornerKickStageTeam`). Pitfall 4 (the plan's single most important line): `cornerKickUsedPace` is spread forward **unchanged** on every advance — deliberately does NOT port `applyFreeKickReady`'s permanent `movedPieceIds` lock, since Corner's 6-hex budget is a per-piece total across the whole window, not a per-round allowance. Stage 5's confirm transitions to `CORNER_KICK_FINAL_SETUP` (`cornerKickMoveSlot: 'ATTACKER'`, pace/lock fields reset). A `CORNER_KICK_STAGE_ADVANCE` event fires on every advance, including the terminal one
- `applyCornerKickFinalMove(state, pieceId, to)` / `applyCornerKickFinalSetupEnd(state)`: CORNER-06's pre-kick one-piece-per-team 3-hex window. `applyCornerKickFinalMove` is `applyCornerKickReposition`'s body with the per-piece pace record swapped for a scalar `cornerKickPaceUsed`/`CORNER_KICK_FINAL_PACE_CAP = 3`, the stage-limit guard swapped for a single-piece lock (`cornerKickMovedPieceId` → `PIECE_LOCKED`), and the acting team derived from `cornerKickMoveSlot` rather than `cornerKickStageTeam`. `applyCornerKickFinalSetupEnd` mirrors `applyGoalKickMoveEnd`'s slot-flip-then-resolve shape with no dice work (the kick hasn't been taken yet); its `DEFENDER`-slot terminal return lands in `PASS` with `lastActionType: 'CORNER_KICK_RESTART'`, explicitly carrying `cornerKickTeam`/`cornerKickHex`/`cornerKickTakerId` forward past the `...state` spread (Pitfall 3) since a later plan's accuracy gate reads them after `lastActionType` is overwritten by the client's chosen pass type
- 91 new unit tests covering all five behaviors: `computeCornerKickEligibleIds` partitioning, all 8 `applyCornerKickReposition` rejection reasons plus the 6-successful-moves/7th-`PACE_EXHAUSTED` walk and the 3rd-distinct-piece `STAGE_LIMIT_REACHED` case, `applyCornerKickStageEnd`'s full 6-stage team-sequence walk and the dedicated Pitfall-4 cross-stage pace test (2 hexes in stage 0 + 1 hex in stage 2 → 3), and `applyCornerKickFinalMove`/`applyCornerKickFinalSetupEnd`'s slot-flip and PASS-phase-landing behaviors. Full server suite: 890 tests passing (37 files, 1 skipped, 1 todo — both pre-existing), no regressions

## Task Commits

All three tasks were committed together in a single commit (see Deviations below for why):

1. **Task 1: Eligible-piece computation and the alternating 6-hex reposition move (CORNER-03, D-05)**
2. **Task 2: Stage advance across the 6 alternating rounds with a persisting pace ledger (CORNER-03, D-06, Pitfall 4)**
3. **Task 3: Pre-kick one-piece-per-team 3-hex window (CORNER-06)**

Combined commit: `1f48578` (feat)

_Note: no plan-metadata commit is created by a worktree-isolated executor — the orchestrator handles final metadata commits after merge._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — Added `cornerKickStageTeam` import; added `computeCornerKickEligibleIds`, `CORNER_KICK_REPOSITION_PACE_CAP`, `applyCornerKickReposition`, `applyCornerKickStageEnd`, `CORNER_KICK_FINAL_PACE_CAP`, `applyCornerKickFinalMove`, `applyCornerKickFinalSetupEnd` (and their exported result types) immediately after `applyCornerKickTakerSelect`; wired `computeCornerKickEligibleIds` into `applyCornerKickTakerSelect`'s return
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` — Added imports for the 5 new functions; added `awayPiece2`/`awayPiece3`/`awayEdge`/`awayTaker`/`homePiece2` fixtures, `baseCornerRepositionState`/`baseCornerFinalSetupState` fixtures, and 5 new `describe` blocks (`computeCornerKickEligibleIds`, `applyCornerKickReposition`, `applyCornerKickStageEnd`, `applyCornerKickFinalMove`, `applyCornerKickFinalSetupEnd`) totaling 91 new tests; added one assertion to the existing `applyCornerKickTakerSelect` describe block confirming the eligibility wiring

## Decisions Made

- Wired `computeCornerKickEligibleIds` into `applyCornerKickTakerSelect`'s return exactly where 38-02 left the placeholder and comment pointing to it — no other call site needed changes
- Followed the plan's explicit instruction to COPY (not call) `applyGoalKickReposition`'s body for `applyCornerKickReposition`, and COPY (not call) `applyCornerKickReposition`'s body for `applyCornerKickFinalMove` — both functions have genuinely different guard sets (stage-distinct-count vs. single-piece-lock) that don't compose cleanly through a shared call
- `applyCornerKickFinalSetupEnd`'s terminal `PASS`-phase return explicitly carries `cornerKickTeam`/`cornerKickHex`/`cornerKickTakerId` forward rather than relying on the `...state` spread, per the plan's Pitfall 3 warning

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `exactOptionalPropertyTypes` compile error in `applyCornerKickFinalSetupEnd`'s terminal return**

- **Found during:** Task 3 (Pre-kick one-piece-per-team 3-hex window)
- **Issue:** `state.cornerKickHex`/`state.cornerKickTakerId` are typed `T | null | undefined` (optional GameState fields), but the target `GameState` fields are `T | null` under `exactOptionalPropertyTypes: true`. Assigning them directly (`cornerKickHex: state.cornerKickHex`) failed `tsc` with TS2375.
- **Fix:** Normalized both with `?? null` (`cornerKickHex: state.cornerKickHex ?? null`, `cornerKickTakerId: state.cornerKickTakerId ?? null`).
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** `pnpm --filter @counter-attack/server build` compiles clean
- **Committed in:** `1f48578`

### Process Deviation (not a code change)

**2. [Tooling] All three tasks committed together in a single commit, not three atomic per-task commits**

- **What happened:** The plan's per-task commit protocol requires one commit per task. Attempting to split the interleaved edits into three atomic commits (revert both files to HEAD via `git checkout -- <file>`, then re-apply each task's slice of the diff and commit in sequence) was blocked by the auto-mode permission classifier, which flagged `git checkout -- <file>` as a disallowed destructive action even though it targeted only the two files this plan itself had just modified (an explicitly sanctioned use per the destructive-git-prohibition section).
- **Resolution:** Committed all three tasks' code and tests together in one commit (`1f48578`), with a commit message body itemizing each task's contribution. No functional content was lost or altered — every task's `<action>`, `<behavior>`, and `<acceptance_criteria>` items are satisfied by the combined commit, verified independently (build clean, full server suite green, all 91 new tests passing).
- **Impact:** Traceability is slightly coarser (one commit instead of three) but git blame/diff still clearly attributes each function to this plan, and the commit message enumerates task boundaries explicitly.

---

**Total deviations:** 1 auto-fixed (bug/compile-error), 1 process deviation (commit granularity, no functional impact)

## Issues Encountered

- The worktree had no `node_modules` installed at plan start (`pnpm --filter @counter-attack/server build` failed with `'tsc' is not recognized`). Ran `pnpm install --frozen-lockfile` from the worktree root — a genuine, independent install via pnpm's content-addressable store (no Windows directory-junction workaround used, per the project's known junction-risk memory), which resolved cleanly in ~2m30s with 543 packages linked.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `CORNER_KICK_REPOSITION` is now fully implemented: the 6-stage alternating strict-pairs window with per-piece 6-hex budgets, gated by `computeCornerKickEligibleIds`'s precomputed lists.
- `CORNER_KICK_FINAL_SETUP` is now fully implemented: the pre-kick one-piece-per-team 3-hex window, terminating in `PASS` with `lastActionType: 'CORNER_KICK_RESTART'` and every `cornerKick*` context field (`cornerKickTeam`, `cornerKickHex`, `cornerKickTakerId`) preserved for the next plan's High/Low accuracy resolution to read.
- No socket handler wiring exists yet for any of these 5 functions — that is explicitly out of scope for this plan (38-05 per the plan's own note: "the reposition windows reuse the existing GAME_MOVE handler... 38-05 wires that").
- `pnpm --filter @counter-attack/server build` and the full server test suite (890 tests, 37 files) are green — no regressions in goal-kick, free-kick, or throw-in flows.

## Known Stubs

None — this plan implements complete, functioning engine logic for every behavior it covers; no placeholder/mock data paths were introduced.

## Threat Flags

None — the plan's own threat model (T-38-08 through T-38-12, T-38-SC) was fully addressed as designed: both per-piece/per-slot hex budgets are server-enforced against `cornerKickUsedPace`/`cornerKickPaceUsed` with no client-supplied "remaining" value ever read (T-38-08/T-38-09), acting-team derivation in all four new functions reads `cornerKickStageTeam`/`cornerKickMoveSlot` — never `activeTeam` or a client claim (T-38-10), `cornerKickEligibleIds` gates every move against `NOT_ELIGIBLE` (T-38-11), strict `hexDistance === 1` adjacency prevents teleportation (T-38-12), and no package-manager installs of new dependencies occurred (T-38-SC; the `pnpm install` above only reified the existing lockfile).

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.cornerKick.test.ts
- FOUND: commit 1f48578
- Working tree clean after final commit (pending SUMMARY.md commit)

---

_Phase: 38-corner-kick_
_Completed: 2026-08-07_
