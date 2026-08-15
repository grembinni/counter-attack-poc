---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 20
subsystem: game-engine
tags: [gk-dive-at-feet, gap-closure, socket-handlers, replay, undo-boundary]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: GK_DIVE_AT_FEET_PROMPT phase, computeGkDiveAtFeetOffer, computeGkDiveDisplacement, applyGkDiveAtFeetResponse, enterGkDiveOrSkip (Plan 39-12/39-15)
provides:
  - GK_DIVE_AT_FEET_TARGET phase and the GAME_GK_DIVE_AT_FEET_TARGET socket event
  - computeGkDiveAtFeetTargetHexes shared legal-target helper (client+server single source of truth)
  - applyGkDiveAtFeetTarget — server-authoritative duel resolution + goalkeeper relocation
  - Fifth GK_DIVE entry point (SNAPSHOT_DEFLECT resolution) brought under the D-09 shared cap
affects: [39-21 (client dive-target hex-picker UI)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Two-step accept-then-target socket flow (mirrors GAME_GK_BOX_ENTRY_RESPONSE/GAME_GK_BOX_ENTRY_MOVE)'
    - 'Shared legal-target-set helper imported by both client highlight logic and server authority check'

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/shared/src/shotValidator.ts
    - packages/shared/src/shotValidator.test.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts
    - packages/server/src/__tests__/gameEngine.undoReplay39.test.ts
    - packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/ActionLog.test.tsx
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - 'GKDIVE-05 cap is set on ACCEPT, not on target resolution — an abandoned target step can never re-offer the same dive'
  - 'GKDIVE-02 saving-penalty basis stays the GK-to-CARRIER distance recorded at offer time, not the distance to the chosen hex — 39-UAT gap 3 asked only for hex selection and GK movement'
  - 'computeGkDiveDisplacement runs unconditionally on both outcomes now, with no excludeId — the GK always lands on `to`, and `to` can never hold the carrier by construction'
  - "39-UAT gap 4's 'faulty reset site' hypothesis is DISPROVED — audited all 5 gkDiveAtFeetUsedByTeam reset sites and all are genuine fresh-cycle starts; the actual cause was the 5th GK_DIVE transition site (gameHandlers.ts snapshot resolution) bypassing enterGkDiveOrSkip entirely"

patterns-established:
  - 'Shared legal-target-hex helper pattern: compute once in packages/shared, import into both client highlight code and the server authority check — client can never offer what the server would reject'

requirements-completed: [GKDIVE-01, GKDIVE-02, GKDIVE-04, GKDIVE-05]

# Metrics
duration: 28min
completed: 2026-08-15
---

# Phase 39 Plan 20: GK Dive-at-Feet Two-Step Target Selection + Fifth GK_DIVE Cap Site Summary

**Split the GK dive-at-feet duel into accept-then-choose-destination-hex, made the goalkeeper's piece provably move to that hex on both duel outcomes, and closed a D-09 cap hole where a snapshot resolution could still let an already-dived keeper block a shot in the same movement cycle.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-08-15T13:05:00-05:00 (worktree base)
- **Completed:** 2026-08-15T13:33:37-05:00
- **Tasks:** 3
- **Files modified:** 12 (11 planned + 1 net-new deviation touching 2 unplanned files)

## Accomplishments

- Closed 39-UAT gap 3 (server half): accepting the dive-at-feet prompt now opens a new `GK_DIVE_AT_FEET_TARGET` phase; the manager-chosen hex is validated server-side against a shared legal-target-set helper before any mutation, and the goalkeeper's own piece is written to that hex on both SUCCESS and FAIL.
- Closed 39-UAT gap 4: the `GAME_END_TURN` snapshot-resolution branch in `gameHandlers.ts` — previously the one code path that set `phase: 'GK_DIVE'` directly instead of routing through `enterGkDiveOrSkip` — now goes through the shared D-09 cap like the other four entry points.
- Added `computeGkDiveAtFeetTargetHexes` to `packages/shared/src/shotValidator.ts` as the single source of truth for the legal dive-destination set — the client highlight computation (wired in Plan 39-21) and the server authority check both import the same function.
- Disproved the 39-UAT gap 4 "faulty reset site" hypothesis via a full audit of every `gkDiveAtFeetUsedByTeam` reset site.

## Task Commits

1. **Task 1: Add GK_DIVE_AT_FEET_TARGET phase, target socket event, shared legal-target helper** - `2eabb19` (feat)
2. **Task 2: Split dive into accept-then-target, move GK to chosen hex** - `50153de` (feat)
3. **Task 3: Wire target socket handler, bring fifth GK_DIVE entry under D-09 cap** - `cb110f8` (feat)

**Deviation commit:** `084a158` (fix — required `diveFrom`/`diveTo` fields on two unplanned client test fixtures; see Deviations below)

_Note: no plan-metadata commit required beyond this SUMMARY — see final commit below._

## Files Created/Modified

- `packages/shared/src/types.ts` — `GK_DIVE_AT_FEET_TARGET` GamePhase member; `GK_DIVE_AT_FEET` ActionEvent variant gains required `diveFrom`/`diveTo: HexCoord`
- `packages/shared/src/events.ts` — `GAME_GK_DIVE_AT_FEET_TARGET` client event, `(to: HexCoord) => void` payload
- `packages/shared/src/shotValidator.ts` — `computeGkDiveAtFeetTargetHexes(state): HexCoord[]`
- `packages/shared/src/shotValidator.test.ts` — full unit coverage for the new helper (distance/range/edge/occupied/missing-id cases)
- `packages/server/src/gameEngine.ts` — reworked `applyGkDiveAtFeetResponse` (2 params, no dice); new `applyGkDiveAtFeetTarget`; `GK_DIVE_AT_FEET_TARGET` added to `ZONE_CHECK_EXEMPT_PHASES`; `buildReplayFrames` now applies `event.diveTo` to the goalkeeper piece; `enterGkDiveOrSkip` doc comment updated to name all five entry points
- `packages/server/src/gameHandlers.ts` — `GAME_GK_DIVE_AT_FEET` no longer rolls dice; new `GAME_GK_DIVE_AT_FEET_TARGET` handler; `GAME_END_TURN`'s snapshot-resolution branch now spreads `enterGkDiveOrSkip(...)` instead of a literal `phase: 'GK_DIVE'`
- `packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts` — rewritten for the two-step flow; added gap-3 core assertions (GK position on both outcomes), guard tests, GKDIVE-04 displacement-on-both-outcomes tests
- `packages/server/src/__tests__/gameEngine.undoReplay39.test.ts` — `diveFrom`/`diveTo` added to the `GK_DIVE_AT_FEET` fixture; full-chain test updated to the two-step flow; new test asserting `buildReplayFrames` places the goalkeeper on `diveTo`
- `packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts` — item 5 rewritten for the two-step flow; new access-control/payload/membership/happy-path coverage for `GAME_GK_DIVE_AT_FEET_TARGET`; new gap-4 regression test over a real `GAME_END_TURN` emission
- `packages/client/src/components/GameBoard.tsx` — `PHASE_LABEL` entry and panel-dispatch branch widened for `GK_DIVE_AT_FEET_TARGET` (panel content itself is Plan 39-21's scope; the target phase intentionally renders no content yet)
- `packages/client/src/components/ActionLog.test.tsx`, `packages/client/src/components/ActionPanel.test.tsx` — deviation fix, see below

## Decisions Made

- GKDIVE-05's once-per-cycle cap is consumed on ACCEPT (not on target resolution), so an abandoned target step can never re-offer the same dive — matches the plan's explicit instruction.
- GKDIVE-02's saving-penalty basis remains the GK-to-CARRIER distance recorded at offer time, never re-based on the manager's chosen hex — an unrequested duel-math change was deliberately avoided.
- `computeGkDiveDisplacement` now runs unconditionally on both outcomes with no `excludeId`, since the goalkeeper always lands on the chosen hex and that hex can never be the carrier's own hex (it's always exactly one hex away, by construction of `computeGkDiveAtFeetTargetHexes`).
- **gkDiveAtFeetUsedByTeam reset-site audit (39-UAT gap 4 investigation):** every reset site — `applyStartMovement`, `applyRestartMovement`, `applyThrowInPlace`, `applyGKRestart`'s `'movement'` branch, and `buildInitialGameState`'s `null` initializer — was independently confirmed to be a genuine fresh 4-5-2 movement-cycle start, not a mid-cycle slot advance masquerading as one. **The "faulty reset site" hypothesis from 39-UAT gap 4 is DISPROVED.** The actual root cause was purely the fifth `phase: 'GK_DIVE'` transition site in `gameHandlers.ts`'s `GAME_END_TURN` snapshot-resolution branch bypassing `enterGkDiveOrSkip` entirely — confirmed by `grep -rn "phase: 'GK_DIVE'" packages/server/src --include=*.ts | grep -v __tests__`, which now returns zero lines outside `enterGkDiveOrSkip`'s own return statement.
- **Pre-existing behaviour, recorded per plan's output spec:** pieces displaced by `computeGkDiveDisplacement` (occupants pushed off the chosen landing hex) remain untracked in `buildReplayFrames` — only the diving goalkeeper's own position is corrected in the replay frame. This was already true before this plan (displacement was never replay-tracked for the shot-block `GK_DIVE` path either) and is explicitly out of scope here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added required `diveFrom`/`diveTo` fields to two unplanned client test fixtures**

- **Found during:** Task 1 verification (`pnpm typecheck`)
- **Issue:** Task 1 widened the `GK_DIVE_AT_FEET` `ActionEvent` variant with two new _required_ fields (`diveFrom`/`diveTo`, per the plan's explicit instruction). This broke `pnpm typecheck` for `packages/client/src/components/ActionLog.test.tsx` and `packages/client/src/components/ActionPanel.test.tsx` — both outside this plan's `files_modified` list, but both construct `GK_DIVE_AT_FEET` event object literals directly and are unrelated to Plan 39-21's client scope.
- **Fix:** Added `diveFrom`/`diveTo: HexCoord` values to the 4 affected fixture object literals (1 in `ActionLog.test.tsx`, 3 in `ActionPanel.test.tsx`).
- **Files modified:** `packages/client/src/components/ActionLog.test.tsx`, `packages/client/src/components/ActionPanel.test.tsx`
- **Verification:** `pnpm typecheck` passes clean across all three packages; both files' full test suites still pass (67 + 86 tests).
- **Committed in:** `084a158`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to satisfy the plan's own `pnpm typecheck passes across all three packages` verification requirement; no scope creep into Plan 39-21's client UI work (the panel content itself is untouched).

## Issues Encountered

- The worktree had no `node_modules` at spawn time (git worktrees don't carry `node_modules`, which isn't tracked in git). Ran `pnpm install --offline` once at the start of execution to populate per-package `node_modules` before any test/typecheck/build command could run. This is environment setup, not a plan deviation.
- The whole-workspace `pnpm lint` command hit a pre-existing, previously-documented `packages/shared` typescript-eslint file-count-cap parsing error (STATE.md: "Known tech debt entering Phase 33... doesn't gate CI"), unrelated to any file this plan touches. Verified no lint regressions were introduced by directly linting every file this plan modified (`npx eslint <files>`), which returned clean. Did not attempt to fix the pre-existing shared-package eslint config cap — that is a project-wide config change out of this plan's scope (Rule 4 territory, not requested).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 39-21 can now build the client-side hex-picker UI for `GK_DIVE_AT_FEET_TARGET`: `computeGkDiveAtFeetTargetHexes` is available from `@counter-attack/shared` for highlight computation, and `ClientEvents.GAME_GK_DIVE_AT_FEET_TARGET` is wired end-to-end on the server. `GkDiveAtFeetPromptPanel`'s own phase guard still needs widening to render content for the target phase (explicitly deferred to 39-21 per this plan's Task 1 action).
- No blockers. Full verification suite green: shared 774 tests (749 + 25 new), server 1297 tests, client 929 tests; full monorepo build and per-file lint clean; `pnpm typecheck` clean across all three packages.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-15_

## Self-Check: PASSED

- FOUND: `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-20-SUMMARY.md`
- FOUND: commit `2eabb19` (Task 1)
- FOUND: commit `50153de` (Task 2)
- FOUND: commit `cb110f8` (Task 3)
- FOUND: commit `084a158` (deviation fix)
- FOUND: commit `002a179` (this SUMMARY)
