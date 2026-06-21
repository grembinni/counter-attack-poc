---
phase: quick-260621-b8f
plan: 01
subsystem: ui
tags: [actionlog, eventlog, header, gk-kick, shot, typescript, react]

# Dependency graph
requires:
  - phase: 18-design-polish
    provides: ActionLog duel-log conventions (PNamed, fmtStatRoll, team-colour prefixes)
provides:
  - HEADED_PASS and GK_PUNT ActionEvent types (shared)
  - HEADER event emission on the contested-winner branch of GAME_HEADER_CONTESTANT
  - HEADED_PASS emission in applyResolveHeaderTarget's PASS branch
  - GK_PUNT emission in applyGKKickTarget
  - Split SHOT_ATTEMPT rendering (duel entry + handling entry) in ActionLog
  - HEADED_PASS / GK_PUNT ActionLog render branches
affects: [ActionLog, gameEngine, gameHandlers, replay/event-log consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'computeHeaderDuelDetail extracted from computeHeaderDuelWinner so handlers can access full dice/aerial duel detail, not just the winner team'
    - 'EventItem.subKind discriminator lets consolidateEvents push two display items sharing one underlying ActionEvent, for cases where one server event must render as two log lines'

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameEngine.test.ts
    - packages/server/src/__tests__/gameEngine.rule11.test.ts
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ActionLog.test.tsx

key-decisions:
  - 'Extracted computeHeaderDuelDetail (returns full duel detail) from computeHeaderDuelWinner (thin wrapper, kept for existing callers) rather than duplicating the dice/aerial scoring logic in gameHandlers.ts'
  - "Mirrored the HEADED_PASS append in applyRoll's legacy contested-win HEADER->PASS branch (gameEngine.ts) even though it is not reachable via the live GAME_ROLL handler (guarded by headerDuelWinner check) — direct unit tests still exercise that branch, so the mirror keeps engine-level event-log behaviour consistent"
  - "GK_DIVE (goal-line header) branch intentionally does NOT get a HEADED_PASS event — it's a shot, not a pass; verified via a regression test"
  - 'SHOT_ATTEMPT handling split implemented via a subKind discriminator on EventItem rather than synthesizing a second ActionEvent type, since both lines describe the same underlying server event'

patterns-established:
  - "EventItem.subKind ('duel' | 'handling') pattern for splitting one event into two log lines without inventing new ActionEvent variants"

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-06-21
---

# Quick Task 260621-b8f: ActionLog Coverage Gaps Summary

**Closed four ActionLog coverage gaps: contested HEADER duels, post-header HEADED_PASS deliveries, split SHOT_ATTEMPT handling sub-checks, and GK_PUNT deliveries — three server-side event-emission gaps plus one client-render-merge bug.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `HEADED_PASS` and `GK_PUNT` to the shared `ActionEventType`/`ActionEvent` union (pass-format shape, no `accurate` field — both deliveries are unconditional).
- `GAME_HEADER_CONTESTANT`'s contested-winner branch now emits a `HEADER` ActionEvent with real attacker/defender dice and aerial values — previously only the tie path and the uncontested paths logged anything.
- `applyResolveHeaderTarget`'s non-goal-line PASS branch now emits a `HEADED_PASS` event for the delivery that follows a won header; the GK_DIVE (goal-line) branch is unchanged (it's a shot, not a pass).
- `applyGKKickTarget` now emits a `GK_PUNT` event with `ballAfter.carrierId: null` (ball in the air).
- `ActionLog`'s `SHOT_ATTEMPT` rendering, when a handling sub-check ran, now produces two separate log entries (duel, then handling) instead of one merged line; non-handling shots are unaffected.
- Added `[HEADER PASS]` and `[PUNT]` render branches matching the existing pass-log format conventions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add HEADED_PASS + GK_PUNT event types and emit HEADER on contested-winner branch (server)** - `72dfced` (feat)
2. **Task 2: Emit HEADED_PASS after won header and GK_PUNT on punt delivery (server)** - `e0c6739` (feat)
3. **Task 3: Split SHOT_ATTEMPT handling entry + add HEADED_PASS/GK_PUNT render branches (client)** - `52aaf43` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `packages/shared/src/types.ts` - Added `HEADED_PASS`/`GK_PUNT` to `ActionEventType` and two new `ActionEvent` union members.
- `packages/server/src/gameEngine.ts` - Extracted `computeHeaderDuelDetail` (full duel detail) from `computeHeaderDuelWinner` (now a thin wrapper); `applyResolveHeaderTarget`'s PASS branch and `applyRoll`'s legacy contested-win HEADER→PASS branch both append `HEADED_PASS`; `applyGKKickTarget` appends `GK_PUNT`.
- `packages/server/src/gameHandlers.ts` - `GAME_HEADER_CONTESTANT`'s contested-winner branch now builds and appends a `HEADER` ActionEvent using `computeHeaderDuelDetail`'s output.
- `packages/server/src/__tests__/gameEngine.test.ts` - New `describe('applyGKKickTarget', ...)` block: asserts exactly one `GK_PUNT` event with correct `passerId`/`from`/`to`/null-carrier `ballAfter`, plus the existing `GK_KICK_MOVE` phase transition.
- `packages/server/src/__tests__/gameEngine.rule11.test.ts` - Two new tests in the "valid resolve" describe block: `HEADED_PASS` event shape on the PASS branch, and a regression confirming the GK_DIVE route does NOT emit one.
- `packages/client/src/components/ActionLog.tsx` - `EventItem` gained an optional `subKind` discriminator; `consolidateEvents` pushes two items for a handling `SHOT_ATTEMPT`; `formatEvent` renders only the requested slice for split shots and gained `HEADED_PASS`/`GK_PUNT` cases.
- `packages/client/src/components/ActionLog.test.tsx` - Five new tests: handling-shot split (two entries, correct content/prefixes), non-handling-shot regression (still one entry), spilled-handling wording, `HEADED_PASS` render, `GK_PUNT` render.

## Decisions Made

- Extracted `computeHeaderDuelDetail` as the single source of truth for duel dice/aerial values, with `computeHeaderDuelWinner` reduced to a thin wrapper — avoids duplicating the contestant-resolution/penalty logic in `gameHandlers.ts`.
- Mirrored the `HEADED_PASS` append in `applyRoll`'s legacy contested-win branch (not strictly reachable from the live handler wiring, since `GAME_ROLL` now guards against re-firing a duel once `headerDuelWinner` is set) because direct unit tests in `gameEngine.test.ts` still exercise that code path — kept engine-level behaviour consistent rather than leaving a dark corner unfixed.
- Implemented the SHOT_ATTEMPT split via an `EventItem.subKind` discriminator rather than inventing a second ActionEvent type, since both display lines derive from the same single server event and don't need independent identity in the event log itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mirrored HEADED_PASS in the legacy applyRoll contested-win branch**

- **Found during:** Task 2
- **Issue:** The plan flagged this as "confirm via test coverage whether that branch is live before duplicating." Direct unit tests in `gameEngine.test.ts` (`'HEADER contested — defender wins...'`, `'HEADER tie...'`, etc.) call `applyRoll` directly against contested HEADER states, exercising the attacker-wins-contested PASS branch even though the live `GAME_ROLL` handler now guards against reaching it (headerDuelWinner is always set first via `GAME_HEADER_CONTESTANT`).
- **Fix:** Added the same `HEADED_PASS` event append to `applyRoll`'s contested-win PASS branch (gameEngine.ts ~line 2194) for engine-level consistency, with an inline comment documenting that this path is defense-in-depth only under current handler wiring.
- **Files modified:** packages/server/src/gameEngine.ts
- **Verification:** All existing `applyRoll` HEADER-branch tests still pass unchanged (none asserted the prior absence of a pass event).
- **Committed in:** e0c6739 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — defense-in-depth consistency, no behavior change to the live game flow)
**Impact on plan:** No scope creep — this was an explicitly flagged decision point in the plan itself ("confirm via test coverage... before duplicating"), resolved by checking test coverage as instructed.

## Issues Encountered

- This worktree had no `node_modules` installed and `packages/shared` had no built `dist/` output, which made `packages/server`'s typecheck fail with `Cannot find module '@counter-attack/shared'` errors unrelated to this plan's changes. Resolved by running `pnpm install` at the repo root and `pnpm run build` in `packages/shared` before re-running typecheck — not a plan deviation, just worktree environment setup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four ActionLog coverage gaps from Phase 18 close-out are closed: contested HEADER duels, post-header deliveries, split shot handling, and GK punts all now log correctly.
- Full verification suite green: 320 shared + 462 server + 217 client tests passing (227 + 19 new vs. baseline), typecheck clean on all three packages.
- No blockers identified for subsequent phases.

---

_Quick task: 260621-b8f_
_Completed: 2026-06-21_

## Self-Check: PASSED

All files referenced in this summary verified present on disk; all three task commits
(72dfced, e0c6739, 52aaf43) verified present in git log.
