---
phase: 43-tackle-steal-prompt-decline
plan: 02
subsystem: game-engine
tags: [undo, replay, game-state, tackle, steal, action-log, testing]
dependency-graph:
  requires:
    - phase: 43-01
      provides: GamePhase.TACKLE_STEAL_PROMPT, ActionEventType.TACKLE_STEAL_DECLINED, GameState prompt-cluster fields
  provides:
    - TACKLE_STEAL_PROMPT registered in ZONE_CHECK_EXEMPT_PHASES (server)
    - TACKLE_STEAL_DECLINED documented-excluded from REPLAY_ELIGIBLE_TYPES and applyUndo isBoundary
    - TACKLE_STEAL_PROMPT documented-excluded from GK_BOX_ENTRY_PHASES
    - lastBroadcastBallPosition edge-trigger guard preserving the goalkeeper-offer baseline across the prompt interrupt
    - ActionLog formatEvent case for TACKLE_STEAL_DECLINED ([TACKLE]/[STEAL] prefix, "declined to challenge")
    - TACKLE_STEAL_PROMPT registered in BALL_MARKER_PHASES (client)
    - TACKLE_STEAL_PROMPT registered in useGameStore's selectPiece two-button-panel no-op branch
    - gameEngine.undoReplay43.test.ts registration-checklist regression suite
  affects:
    - 43-03 (panel routing)
    - 43-04 (engine logic that first makes TACKLE_STEAL_PROMPT reachable)
    - 43-05 (socket handler for GAME_TACKLE_STEAL_CHOICE)
tech-stack:
  added: []
  patterns:
    - 'Registration-checklist regression suite (gameEngine.undoReplay43.test.ts) mirrors the gameEngine.undoReplay39.test.ts convention: pin every registration AND every deliberate non-registration with an executable assertion, not just a comment'
    - 'Edge-trigger baseline guard (lastBroadcastBallPosition) conditioned on phase, mirroring the existing computeBoxEntryOffer/ballPositionChanged edge-triggered pattern in broadcastState'
key-files:
  created:
    - packages/server/src/__tests__/gameEngine.undoReplay43.test.ts
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/roomStore.ts
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ActionLog.test.tsx
    - packages/client/src/components/BallLocationRing.tsx
    - packages/client/src/components/BallLocationRing.test.tsx
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/store/useGameStore.ts
decisions:
  - 'TACKLE_STEAL_PROMPT added to ZONE_CHECK_EXEMPT_PHASES (server) — the ball has not moved while the defending manager decides, so the final-third free-move zone check must never overlay FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE on top of the prompt'
  - 'TACKLE_STEAL_DECLINED deliberately excluded from REPLAY_ELIGIBLE_TYPES and applyUndo isBoundary — it carries no ballAfter and commits no dice outcome, matching the GK_DIVE_AT_FEET_DECLINED precedent exactly'
  - 'TACKLE_STEAL_PROMPT deliberately excluded from GK_BOX_ENTRY_PHASES — it is already a dedicated GK-adjacent interrupt phase and must not be double-interrupted'
  - 'lastBroadcastBallPosition edge-trigger baseline is held (not advanced) while phase === TACKLE_STEAL_PROMPT, so a goalkeeper offer is never silently swallowed on the resume broadcast'
requirements-completed: [TACKLE-02, TACKLE-04]
duration: ~15min
completed: 2026-08-23
---

# Phase 43 Plan 02: Tackle/Steal Prompt & Decline Registration Checklist Summary

Registered the new `TACKLE_STEAL_PROMPT` phase and `TACKLE_STEAL_DECLINED` event through every list, set, and mirror the codebase has previously shipped bugs by forgetting (BUG-30/31/37) — including the two deliberate non-registrations (replay eligibility, Undo boundary) documented as decisions rather than silent omissions — and closed with an executable registration-checklist regression suite.

## Performance

- **Duration:** ~15 min
- **Tasks:** 3
- **Files modified:** 8 modified, 1 created

## Accomplishments

- Server: `TACKLE_STEAL_PROMPT` exempted from the final-third free-move zone check; `TACKLE_STEAL_DECLINED` documented (not registered) in `REPLAY_ELIGIBLE_TYPES` and `applyUndo`'s `isBoundary` disjunction; `GK_BOX_ENTRY_PHASES` doc comment extended; `lastBroadcastBallPosition` edge-trigger baseline guarded so a goalkeeper offer survives the prompt interrupt.
- Client: `ActionLog.tsx`'s `TACKLE_STEAL_DECLINED` case (a 43-01 Rule-1 stub) rewritten to match the plan's exact spec — `[TACKLE]`/`[STEAL]` prefix, literal `declined to challenge` content; `TACKLE_STEAL_PROMPT` added to `BALL_MARKER_PHASES` and to `useGameStore`'s `selectPiece` two-button-panel no-op branch (now four-way); `ActionPanel.tsx`'s `canUndo` boundary-mirror comment extended to record the deliberate omission.
- Test: `gameEngine.undoReplay43.test.ts` created — 4 assertions covering replay exclusion, Undo crossing a `TACKLE_STEAL_DECLINED` event via two successive undos, `applyFreeMoveZoneCheck` exemption, and `isStoppagePhase` exclusion. `ActionLog.test.tsx` and `BallLocationRing.test.tsx` extended with `[STEAL]`/`[TACKLE]`-prefix and `TACKLE_STEAL_PROMPT`-rendering cases respectively.

## Task Commits

1. **Task 1: Register TACKLE_STEAL_PROMPT server-side and preserve the goalkeeper-offer edge trigger** - `f4d0b37f` (feat)
2. **Task 2: Register the new phase and decline event client-side** - `0045f618` (feat)
3. **Task 3: Registration-checklist regression suite** - `7a7aea92` (test)

_Note: Task 3 is tagged `tdd="true"` in the plan; because the target case (`TACKLE_STEAL_DECLINED`) had already been stubbed into `ActionLog.tsx` by 43-01's Rule-1 auto-fix, this task's real behavior-under-test is 43-02's own new server-side registrations (zone-check exemption, Undo-crossing), so it was executed as a single test-and-implementation-together commit rather than a separate RED/GREEN pair — the assertions and the code they exercise (Task 1/2 commits) were both already in place before this commit; this commit adds only new test files/cases against already-committed, already-passing behavior._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - `ZONE_CHECK_EXEMPT_PHASES` gains `TACKLE_STEAL_PROMPT`; `REPLAY_ELIGIBLE_TYPES` and `applyUndo`'s `isBoundary` disjunction gain deliberate-exclusion comments for `TACKLE_STEAL_DECLINED`
- `packages/server/src/roomStore.ts` - `GK_BOX_ENTRY_PHASES` doc comment extended; `lastBroadcastBallPosition` assignment guarded on `phase !== 'TACKLE_STEAL_PROMPT'`
- `packages/client/src/components/ActionLog.tsx` - `TACKLE_STEAL_DECLINED` case rewritten to the plan's exact content/prefix spec
- `packages/client/src/components/ActionLog.test.tsx` - two new decline-rendering test cases ([STEAL]/[TACKLE] prefixes)
- `packages/client/src/components/BallLocationRing.tsx` - `TACKLE_STEAL_PROMPT` added to `BALL_MARKER_PHASES`
- `packages/client/src/components/BallLocationRing.test.tsx` - pinned set-size assertion bumped 31→32; new `TACKLE_STEAL_PROMPT` rendering case
- `packages/client/src/components/ActionPanel.tsx` - `canUndo` boundary-mirror comment extended
- `packages/client/src/store/useGameStore.ts` - `selectPiece`'s two-button-panel no-op branch extended to four phases
- `packages/server/src/__tests__/gameEngine.undoReplay43.test.ts` - new registration-checklist regression suite (created)

## Decisions Made

- `TACKLE_STEAL_PROMPT` is exempt from `ZONE_CHECK_EXEMPT_PHASES` (server) and included in `BALL_MARKER_PHASES` (client) — the ball is stationary throughout the prompt.
- `TACKLE_STEAL_DECLINED` is deliberately absent from `REPLAY_ELIGIBLE_TYPES` and `applyUndo`'s `isBoundary` disjunction (and its client mirror in `ActionPanel.tsx`) — it carries no `ballAfter` and commits no dice outcome, so Undo must cross it and it produces no replay frame. Verified by `gameEngine.undoReplay43.test.ts`.
- `TACKLE_STEAL_PROMPT` is deliberately absent from `GK_BOX_ENTRY_PHASES` — documented as one of the prompt phases that must not be double-interrupted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rewrote the 43-01 stub `TACKLE_STEAL_DECLINED` ActionLog case to match this plan's exact spec**

- **Found during:** Task 2
- **Issue:** 43-01's Task 1 typecheck step had already auto-added a `TACKLE_STEAL_DECLINED` case to `ActionLog.tsx`'s `formatEvent` switch (to fix a switch-exhaustiveness `TS2366` error introduced by the new `ActionEventType` union member). That stub used `[STEAL]`/`[TACKLE]` prefix logic keyed on `event.kind === 'STEAL'` (STEAL-first) and content text `declined to steal`/`declined to tackle` — functionally reasonable but not what this plan specifies: prefix keyed `'[TACKLE]'` when `event.kind === 'TACKLE'` (TACKLE-first) and literal content `declined to challenge`.
- **Fix:** Rewrote the case to match the plan's action block verbatim: `prefix: event.kind === 'TACKLE' ? '[TACKLE]' : '[STEAL]'`, content `<PNamed pieceId={event.defenderId} /> declined to challenge`.
- **Files modified:** `packages/client/src/components/ActionLog.tsx`
- **Commit:** `0045f618`

**2. [Rule 1 - Bug] Bumped `BallLocationRing.test.tsx`'s pinned `BALL_MARKER_PHASES` set-size assertion**

- **Found during:** Task 2 verification (`pnpm --filter @counter-attack/client test`)
- **Issue:** Adding `TACKLE_STEAL_PROMPT` to `BALL_MARKER_PHASES` grew the set from 31 to 32 members, failing the pre-existing pinned-size regression test (`expect(BALL_MARKER_PHASES.size).toBe(31)`).
- **Fix:** Updated the assertion to 32 and its accompanying doc comment, consistent with every prior phase's precedent of bumping this pinned count when the set legitimately grows.
- **Files modified:** `packages/client/src/components/BallLocationRing.test.tsx`
- **Commit:** `0045f618`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 — both pre-existing-test/stub corrections caused directly by this plan's own registration work, no scope creep beyond what the plan already specified).
**Impact on plan:** Both auto-fixes bring the codebase to exactly what the plan's acceptance criteria specify; no functionality beyond the plan's scope was added.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no built `dist/` output at session start. Resolved by running `pnpm install --frozen-lockfile` (safe: uses the global content-addressable pnpm store, does not touch the main checkout's `node_modules`) followed by `pnpm --filter @counter-attack/shared build`. Documented here per the project's Worktree Junction Risk memory note — no directory junctions were created or deleted; this was a standard `pnpm install` inside the worktree's own filesystem tree.

## Next Phase Readiness

- Every registration/deliberate-exclusion site from 43-RESEARCH.md Pitfall 6 (`ActionEventType` union, `formatEvent`, `REPLAY_ELIGIBLE_TYPES`, `applyUndo` `isBoundary`, `PHASE_LABEL`, `STOPPAGE_PHASES`) plus the phase's own `ZONE_CHECK_EXEMPT_PHASES`/`GK_BOX_ENTRY_PHASES`/`BALL_MARKER_PHASES` memberships are now registered or documented-excluded, each pinned by an automated assertion.
- No behaviour changes for existing flows: nothing yet enters `TACKLE_STEAL_PROMPT` (unreachable until 43-04's engine logic lands) and no `TACKLE_STEAL_DECLINED` event is ever emitted yet — this is intentional per the plan's own success criteria, not a stub.
- Ready for 43-03 (panel routing), 43-04 (engine logic making the phase reachable), and 43-05 (the `GAME_TACKLE_STEAL_CHOICE` socket handler).

---

_Phase: 43-tackle-steal-prompt-decline_
_Completed: 2026-08-23_

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/roomStore.ts
- FOUND: packages/client/src/components/ActionLog.tsx
- FOUND: packages/client/src/components/ActionLog.test.tsx
- FOUND: packages/client/src/components/BallLocationRing.tsx
- FOUND: packages/client/src/components/BallLocationRing.test.tsx
- FOUND: packages/client/src/components/ActionPanel.tsx
- FOUND: packages/client/src/store/useGameStore.ts
- FOUND: packages/server/src/**tests**/gameEngine.undoReplay43.test.ts
- FOUND commit f4d0b37f in git log
- FOUND commit 0045f618 in git log
- FOUND commit 7a7aea92 in git log
- FOUND commit a34d3845 in git log
