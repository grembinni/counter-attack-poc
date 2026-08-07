---
phase: 38-corner-kick
plan: 01
subsystem: shared-types
tags: [typescript, shared-package, game-state, socket-events, vitest]

# Dependency graph
requires:
  - phase: 37-out-of-bounds-detection-throw-in-goal-kick
    provides: classifyOutOfBounds 'CORNER_KICK' branch, GOAL_KICK_RESTART_HEX/FREE_KICK_STAGES structural templates, ball.lastTouchedBy tracking
provides:
  - CORNER_KICK_HEX fixed corner-taker geometry (outOfBounds.ts)
  - CORNER_KICK_STAGES + cornerKickStageTeam alternating-stage helpers (offside.ts)
  - 5 new GamePhase values for the dedicated Corner Kick phase chain
  - 10 cornerKick* GameState fields
  - CORNER_KICK_RESTART LastActionType + its ELIGIBLE_NEXT_ACTIONS row
  - 5 new ActionEvent/ActionEventType variants
  - GAME_CORNER_KICK_GK_PLACE / GAME_CORNER_KICK_TAKER ClientEvents + ClientToServerEvents contracts
affects: [38-02, 38-03, 38-04, 38-05, 38-06, 38-07, 38-08, 38-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Corner Kick reuses the throw-in/goal-kick 'own dedicated phase chain, pure-helper reuse only' pattern (D-07)"
    - 'GameState field clusters mirror the goal-kick/free-kick shapes field-for-field with cornerKick* prefix'

key-files:
  created: [packages/shared/src/offside.test.ts]
  modified:
    - packages/shared/src/outOfBounds.ts
    - packages/shared/src/outOfBounds.test.ts
    - packages/shared/src/offside.ts
    - packages/shared/src/types.ts
    - packages/shared/src/actionSequence.ts
    - packages/shared/src/actionSequence.test.ts
    - packages/shared/src/events.ts

key-decisions:
  - "CORNER_KICK_HEX keyed by byline owner (not attacking team) to match GOAL_KICK_RESTART_HEX's indexing convention; the inversion is documented in JSDoc for 38-02 to consume"
  - "CORNER_KICK_STAGES uses 'attacking'/'defending' literals (not FREE_KICK_STAGES's 'kicking'/'defending') to prevent accidental cross-use of freeKickStageTeam"
  - "cornerKickUsedPace persists across all 6 stages (Pitfall-4 divergence from free kick's permanent movedPieceIds lock) — documented explicitly in JSDoc"
  - 'CORNER_KICK_RESTART reuses STANDARD_PASS/HIGH_PASS NextActionType labels for Low/High per the Throw-In precedent — no new NextActionType members invented'

patterns-established:
  - 'Corner Kick GameState fields, phases, and events all documented with an explicit non-alias statement (D-07) matching the Phase 37 GOALKICK-01 precedent for keeping restart flows structurally independent'

requirements-completed: [OOB-03, CORNER-01, CORNER-02, CORNER-03, CORNER-04, CORNER-06]

# Metrics
duration: ~20min
completed: 2026-08-07
---

# Phase 38 Plan 01: Corner Kick Shared Contracts Summary

**Every shared-package contract the Corner Kick flow needs — fixed corner geometry, 6-stage alternating reposition sequence, 5 new GamePhase values, 10 cornerKick\* GameState fields, a dedicated LastActionType/ActionEvent set, and 2 new ClientEvents — all compiler-enforced and unit-tested ahead of the server/client engine plans.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-07T14:07:47Z (approx, from STATE.md last_updated before this plan started)
- **Completed:** 2026-08-07T14:26:55Z
- **Tasks:** 3 completed
- **Files modified:** 7 (1 new)

## Accomplishments

- `CORNER_KICK_HEX` added to `outOfBounds.ts`: 4 fixed corner-taker hexes keyed by byline owner, mirror-symmetric, verified against `isPitchHex`, with an explicit JSDoc warning against ever importing/aliasing `DIFFICULT_ANGLE_HEXES` — `classifyOutOfBounds` left byte-identical
- `CORNER_KICK_STAGES` + `cornerKickStageTeam` added to `offside.ts`: 6 alternating attacking/defending stages (attacking-first, max 2 distinct pieces per stage), structurally mirroring `FREE_KICK_STAGES`/`freeKickStageTeam` but with corner-specific `'attacking'`/`'defending'` literals and an explicit Pitfall-4 non-reset JSDoc note
- Full shared-package type surface landed in `types.ts`: 5 new `GamePhase` values, 10 `cornerKick*` `GameState` fields, the `CORNER_KICK_RESTART` `LastActionType`, and 5 new `ActionEvent`/`ActionEventType` variants (none reusing `DICE_ROLL`)
- `actionSequence.ts` gained the `CORNER_KICK_RESTART` eligibility row (`STANDARD_PASS`/`HIGH_PASS` only), satisfying the `Record<LastActionType, ...>` exhaustiveness check that gates the server build
- `events.ts` gained `GAME_CORNER_KICK_GK_PLACE`/`GAME_CORNER_KICK_TAKER` `ClientEvents` + typed `ClientToServerEvents` payload contracts, with a comment recording that CORNER-03/CORNER-06 reposition windows deliberately reuse `GAME_MOVE`/`GAME_END_TURN`
- Shared package test suite: 665 tests, all green (32 new in `outOfBounds.test.ts`, 8 new in `offside.test.ts`, 5 new in `actionSequence.test.ts`); `pnpm --filter @counter-attack/shared build` and `pnpm --filter @counter-attack/server build` both compile clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CORNER_KICK_HEX fixed corner-taker geometry (D-01/D-02)** - `7272b57` (feat)
2. **Task 2: Add CORNER_KICK_STAGES and cornerKickStageTeam (CORNER-03, D-05)** - `e57d41c` (feat)
3. **Task 3: Add Corner Kick GamePhase values, GameState fields, LastActionType, ActionEvents and ClientEvents** - `2f74576` (feat)

_Note: no plan-metadata commit is created by a worktree-isolated executor — the orchestrator handles final metadata commits after merge._

## Files Created/Modified

- `packages/shared/src/outOfBounds.ts` - Added `CORNER_KICK_HEX` const (home/away × top/bottom fixed hexes), keyed by byline owner
- `packages/shared/src/outOfBounds.test.ts` - Added `CORNER_KICK_HEX` describe block (literal values, mirror symmetry, `isPitchHex`, pairwise-distinct)
- `packages/shared/src/offside.ts` - Added `CORNER_KICK_STAGES` const and `cornerKickStageTeam` function
- `packages/shared/src/offside.test.ts` - **New file** (none existed prior to this plan despite the plan's read_first assuming one) covering `CORNER_KICK_STAGES` length/alternation/max and `cornerKickStageTeam`'s team resolution
- `packages/shared/src/types.ts` - Added 5 `GamePhase` values, 10 `cornerKick*` `GameState` fields, `CORNER_KICK_RESTART` `LastActionType`, 5 `ActionEvent`/`ActionEventType` variants
- `packages/shared/src/actionSequence.ts` - Added `CORNER_KICK_RESTART` row to `ELIGIBLE_NEXT_ACTIONS`
- `packages/shared/src/actionSequence.test.ts` - Added `CORNER_KICK_RESTART` describe block asserting the exact 2-member set
- `packages/shared/src/events.ts` - Added `GAME_CORNER_KICK_GK_PLACE`/`GAME_CORNER_KICK_TAKER` to `ClientEvents` and `ClientToServerEvents`

## Decisions Made

- `CORNER_KICK_HEX` keyed by byline owner (defending team), not the attacking/kicking team — matches `GOAL_KICK_RESTART_HEX`'s convention and lets 38-02 invert cleanly to resolve `cornerKickTeam`
- `CORNER_KICK_STAGES` uses `'attacking'`/`'defending'` side literals instead of reusing `FREE_KICK_STAGES`'s `'kicking'`/`'defending'`, specifically to prevent a future engine plan from accidentally calling `freeKickStageTeam` on corner-kick state
- `cornerKickUsedPace` is documented as persisting across all 6 stages (unlike free kick's permanent per-piece lock) — this is a correctness-critical distinction for 38-03's budget enforcement, so the JSDoc states it explicitly using the words "persists" and "6 stages" per the plan's acceptance criteria
- `CORNER_KICK_RESTART`'s `ELIGIBLE_NEXT_ACTIONS` row reuses `STANDARD_PASS`/`HIGH_PASS` labels (Low/High) rather than inventing `CORNER_KICK_HIGH`/`CORNER_KICK_LOW` — matches the Throw-In precedent in the same table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing `offside.test.ts` (plan's read_first assumed it existed)**

- **Found during:** Task 2 (Add CORNER_KICK_STAGES and cornerKickStageTeam)
- **Issue:** The plan's `<read_first>` and `<action>` sections both reference `packages/shared/src/offside.test.ts` as an "existing" file to extend, mirroring `FREE_KICK_STAGES`/`freeKickStageTeam` coverage — but no such file exists anywhere in the shared package (confirmed via `find packages/shared/src -iname "*offside*"`, only `offside.ts` present). `FREE_KICK_STAGES`/`freeKickStageTeam` also have zero existing test coverage anywhere in the codebase.
- **Fix:** Created `packages/shared/src/offside.test.ts` from scratch, scoped to the task's actual requirement — `CORNER_KICK_STAGES` and `cornerKickStageTeam` coverage only (length, index-parity alternation, `max: 2`, team resolution for all 4 documented cases, and a 3-attacking/3-defending balance check). Did not backfill `FREE_KICK_STAGES` test coverage, as that is a pre-existing gap outside this task's scope (Scope Boundary rule) — logged here rather than silently fixed.
- **Files modified:** `packages/shared/src/offside.test.ts` (new)
- **Verification:** `pnpm --filter @counter-attack/shared test -- offside` — 8/8 tests pass
- **Committed in:** `e57d41c` (Task 2 commit)

**2. [Rule 1 - Bug] Reworded an actionSequence.ts comment that made its own acceptance-criteria grep fail**

- **Found during:** Task 3 (Add Corner Kick GamePhase values, GameState fields, LastActionType, ActionEvents and ClientEvents)
- **Issue:** The JSDoc comment added alongside the `CORNER_KICK_RESTART` eligibility row explicitly named the forbidden literals `CORNER_KICK_HIGH`/`CORNER_KICK_LOW` as an example of what NOT to invent — but this caused the plan's own acceptance criterion (`grep -c "CORNER_KICK_HIGH\|CORNER_KICK_LOW" packages/shared/src/actionSequence.ts` returns 0) to fail, since grep doesn't distinguish code from comments.
- **Fix:** Reworded the comment to convey the same warning without using the literal forbidden strings ("do NOT invent dedicated corner-kick-specific High/Low NextActionType members").
- **Files modified:** `packages/shared/src/actionSequence.ts`
- **Verification:** `grep -c "CORNER_KICK_HIGH\|CORNER_KICK_LOW" packages/shared/src/actionSequence.ts` returns 0; shared test suite still green
- **Committed in:** `2f74576` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/missing-file, 1 bug/self-defeating acceptance check)
**Impact on plan:** Both auto-fixes necessary to satisfy the plan's own stated acceptance criteria. No scope creep — `offside.test.ts` covers only this task's new symbols, not a full backfill of pre-existing untested code.

## Issues Encountered

- Worktree had no `node_modules` installed (fresh worktree checkout). Ran `pnpm install` at the repo root inside the worktree before any test/build command could run — this is a one-time setup cost, not a plan deviation, and did not touch the main repo's `node_modules`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All shared-package contracts Corner Kick's server (38-02..38-05) and client (38-06/38-07) plans depend on now exist and compile: `CORNER_KICK_HEX`, `CORNER_KICK_STAGES`/`cornerKickStageTeam`, the 5 new `GamePhase` values, the 10 `cornerKick*` `GameState` fields, `CORNER_KICK_RESTART` + its eligibility row, the 5 new `ActionEvent` variants, and the 2 new `ClientEvents`.
- `pnpm --filter @counter-attack/server build` was confirmed green — the `LastActionType` exhaustiveness gate that would fail if the eligibility row were missing is satisfied.
- No blockers for 38-02 (server engine plan) to begin — it can now import `CORNER_KICK_HEX`, `CORNER_KICK_STAGES`, and the new `GameState` fields directly.

## Known Stubs

None - this plan only adds type/constant contracts consumed by future plans; no UI or data-flow stubs were introduced.

## Threat Flags

None - this plan's threat model (T-38-01..T-38-03, T-38-SC) was fully addressed by the type contracts as designed: `GAME_CORNER_KICK_TAKER`'s payload excludes the destination hex (T-38-01), `cornerKickUsedPace`/`cornerKickStagePlacedIds` are typed `Readonly`/`readonly` with no client-writable path (T-38-03), and no new package-manager installs occurred beyond the pre-existing `pnpm install` for worktree setup (T-38-SC — dev-tooling only, not a new runtime dependency).

---

_Phase: 38-corner-kick_
_Completed: 2026-08-07_
