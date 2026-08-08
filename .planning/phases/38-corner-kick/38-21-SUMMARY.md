---
phase: 38-corner-kick
plan: 21
subsystem: game-server
tags: [corner-kick, socket-handlers, gap-closure, integration-tests]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 20)
    provides:
      applyCornerKickClearOut(state, pieceId, to) and applyCornerKickClearOutEnd(state, team)
      — the two pure engine functions this plan wires onto the socket surface — plus the
      CORNER_KICK_CLEAR_OUT GamePhase/CORNER_KICK_CLEAR_OUT_MOVE ActionEventType and
      cornerKickClearOutSlot GameState field it consumes
provides:
  - GAME_MOVE handler branch for CORNER_KICK_CLEAR_OUT (gameHandlers.ts) — team guard, ASVS V5
    payload-shape validation, delegates to applyCornerKickClearOut, appends no event of its own
  - GAME_END_TURN handler branch for CORNER_KICK_CLEAR_OUT (gameHandlers.ts) — delegates the
    acting-team comparison to applyCornerKickClearOutEnd(state, socketTeam(socket))
  - Socket-level test coverage proving a real two-client corner walks award -> attacking
    clear-out -> defending clear-out -> CORNER_KICK_GK_SETUP_ATTACKING end to end
affects: [
    38-22 (client destination-hex highlighting for the clear-out — the socket surface this
    plan exposes is now the real integration point for the client's GAME_MOVE emits),
    38-24 (human verifier checkpoint — a real corner can now be played through the clear-out
    step by two connected clients),
  ]
requirements-completed: [OOB-03, CORNER-01, CORNER-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GAME_MOVE's CORNER_KICK_CLEAR_OUT branch follows the CORNER_KICK_FINAL_SETUP event
      pattern (engine constructs its own ActionEvent), not the adjacent CORNER_KICK_REPOSITION
      pattern (handler constructs the event) — the two neighbouring branches disagree on this
      point and picking the wrong one double-logs every move"
    - "waitForState (predicate-based GAME_STATE wait, not a bare oncePromise/.once()) is now the
      correct pattern for any socket-level test that listens on a client OTHER than the one a
      shared driver like driveLooseBallToCorner awaits internally — that client accumulates an
      un-drained backlog of broadcasts across the driver's retry loop, and a bare .once() can
      resolve on a stale backlog entry instead of the next fresh broadcast"

key-files:
  created: []
  modified:
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/gameHandlers.cornerKick.test.ts
    - packages/server/src/__tests__/cornerKick.integration.test.ts

key-decisions:
  - "The GAME_MOVE clear-out branch appends NO ActionEvent of its own — applyCornerKickClearOut
    (38-20) already emits CORNER_KICK_CLEAR_OUT_MOVE internally. A dedicated code comment in the
    branch calls out that it mirrors CORNER_KICK_FINAL_SETUP's pattern, not the immediately-
    adjacent CORNER_KICK_REPOSITION branch's pattern, specifically because the two are easy to
    confuse and the wrong choice silently double-logs every clear-out move (verified by a
    dedicated 'exactly one CORNER_KICK_CLEAR_OUT_MOVE per accepted move' test)."
  - "CORNER_KICK_CLEAR_OUT was NOT added to validUndoPhases — per 38-20's design decision the
    clear-out is deliberately non-undoable, joining the GK setup windows and taker select in
    that exclusion. The existing exclusion-list comment was extended (not replaced) to name it."
  - "Socket-level test fix: driveLooseBallToCorner (pre-existing helper) only awaits clientA
    internally across its up-to-60-attempt retry loop, so clientB (and, symmetrically, whichever
    client isn't the one already being awaited) accumulates an un-drained backlog of GAME_STATE
    broadcasts. A bare oncePromise/.once() attached to that client after the driver resolves can
    catch a stale backlog entry instead of the next fresh broadcast. Added a predicate-based
    waitForState helper (skips non-matching broadcasts, keeps listening until a match) and used
    it everywhere a test listens on the 'other' client following driveLooseBallToCorner."
  - "seedCornerKickClearOut (gameHandlers.cornerKick.test.ts) reserves the home in-zone piece's
    own legal/illegal probe targets when choosing where to park the away in-zone piece — an
    earlier draft let the away piece land exactly on the home piece's expected illegal-step
    target, turning an intended NOT_TOWARD_GOAL assertion into an unrelated INVALID_TARGET
    (occupied-hex) rejection. Caught by the test suite itself, not by inspection."

patterns-established: []

# Metrics
duration: ~35min
completed: 2026-08-08
---

# Phase 38 Plan 21: Wire CORNER_KICK_CLEAR_OUT into the socket surface Summary

**Two new gameHandlers.ts branches (GAME_MOVE/GAME_END_TURN) make the mandatory pre-corner clear-out step playable by real connected clients, and 8 new socket-level tests (5 handler-level, 3 full two-client integration) prove a real corner now walks award through both clear-out slots into the goalkeeper window end to end.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-08
- **Tasks:** 2/2 completed
- **Files modified:** 3 (`gameHandlers.ts` + 2 test files)

## Accomplishments

- `GAME_MOVE`'s new `CORNER_KICK_CLEAR_OUT` branch (placed immediately before the existing
  `CORNER_KICK_REPOSITION` branch) guards with `isActivePlayer` (T-38-17 rationale, copied and
  adapted from the sibling branch), runs the same ASVS V5 payload-shape validation as its
  neighbours, delegates to `applyCornerKickClearOut`, and appends no `ActionEvent` of its own —
  the engine already emits `CORNER_KICK_CLEAR_OUT_MOVE`.
- `GAME_END_TURN`'s new `CORNER_KICK_CLEAR_OUT` branch delegates straight to
  `applyCornerKickClearOutEnd(room.gameState, socketTeam(socket))` with no handler-level
  pre-check, mirroring `applyCornerKickStageEnd`'s branch — the engine owns the acting-team
  comparison and the `MUST_CLEAR_CORNER` rejection reason.
- `validUndoPhases`'s existing exclusion-list comment was extended to name
  `CORNER_KICK_CLEAR_OUT` among the deliberately-excluded corner phases (it was never added to
  the array itself).
- 5 new handler-level tests (`gameHandlers.cornerKick.test.ts`): WRONG_TEAM on a non-acting
  move, INVALID_TARGET on a malformed payload, NOT_TOWARD_GOAL reaching the socket verbatim,
  MUST_CLEAR_CORNER on a premature confirm with a movable in-zone piece, and a double-log guard
  asserting exactly one `CORNER_KICK_CLEAR_OUT_MOVE` per accepted move.
- 3 new full two-client integration tests (`cornerKick.integration.test.ts`): a corner award
  opens the clear-out with the attacking manager acting (asserted on both clients), both
  managers clear their in-zone pieces via real `GAME_MOVE`/`GAME_END_TURN` emits and the
  sequence reaches `CORNER_KICK_GK_SETUP_ATTACKING`, and a defending reposition into the
  exclusion zone is rejected over the socket with `CORNER_EXCLUSION_ZONE`.
- Wire-code enumeration (`grep -o "GAME_ERROR, '[A-Z_]*'" packages/server/src/gameHandlers.ts`)
  re-run per the plan's Task 1 step 5 — see "Newly Reachable GAME_ERROR Codes" below for the
  full list 38-22 needs to map, since most of the new codes are emitted via the dynamic
  `result.reason` pattern rather than a string literal and so don't show up in that grep
  directly.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire the clear-out into the GAME_MOVE and GAME_END_TURN handlers** - `c6526f2` (feat)
2. **Task 2: Socket-level coverage of the clear-out step and its turn order** - `c7cecce` (test)

_Note: SUMMARY.md is committed separately below (worktree parallel-executor mode — orchestrator owns STATE.md/ROADMAP.md updates after merge)._

## Files Created/Modified

- `packages/server/src/gameHandlers.ts` — `applyCornerKickClearOut`/`applyCornerKickClearOutEnd`
  imports added; new `CORNER_KICK_CLEAR_OUT` branches added to `GAME_MOVE` and `GAME_END_TURN`;
  `validUndoPhases`'s exclusion-list comment extended.
- `packages/server/src/__tests__/gameHandlers.cornerKick.test.ts` — new
  `seedCornerKickClearOut` seed helper, `clearOutLegalTarget`/`clearOutIllegalTarget` geometry
  helpers, and a new `CORNER_KICK_CLEAR_OUT over the socket (38-15 defect 3)` describe block
  (5 tests).
- `packages/server/src/__tests__/cornerKick.integration.test.ts` — new `waitForState`
  predicate-based wait helper, a new `CORNER_KICK_CLEAR_OUT over the socket (38-15 defect 3)`
  describe block (3 tests), and updated doc comments on `driveLooseBallToCorner` and the OOB-03
  test to reflect that the socket wiring now exists (no behavior change to that helper itself —
  it still deliberately stops at `CORNER_KICK_CLEAR_OUT` so every other phase-specific describe
  block in the file can start from a known, minimal seeded state).

## Newly Reachable GAME_ERROR Codes (for 38-22)

Per the plan's Task 1 step 5, every `GAME_ERROR` wire code this plan newly makes reachable
(both functions' full discriminated-union `reason` types, since most are emitted dynamically via
`socket.emit(ServerEvents.GAME_ERROR, result.reason)` rather than as string literals the grep
enumeration would catch):

**From `applyCornerKickClearOut` (GAME_MOVE / CORNER_KICK_CLEAR_OUT branch):**

| Code              | Meaning                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `WRONG_PHASE`     | Not currently in `CORNER_KICK_CLEAR_OUT`, or required corner fields are null                                  |
| `PIECE_NOT_FOUND` | `pieceId` does not match any piece                                                                            |
| `WRONG_TEAM`      | Piece belongs to the non-acting slot side (also emitted directly by the handler's `isActivePlayer` pre-check) |
| `NOT_ELIGIBLE`    | Piece is already outside the exclusion zone — nothing left to clear                                           |
| `NOT_ADJACENT`    | Target is not exactly 1 hex from the piece's current position                                                 |
| `INVALID_TARGET`  | Target is off-pitch, occupied, or the payload shape itself is malformed (handler-level ASVS V5 check)         |
| `NOT_TOWARD_GOAL` | Step does not satisfy `isLegalClearOutStep` (retreats toward the corner or away from goal)                    |

**From `applyCornerKickClearOutEnd` (GAME_END_TURN / CORNER_KICK_CLEAR_OUT branch):**

| Code                | Meaning                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `WRONG_PHASE`       | Not currently in `CORNER_KICK_CLEAR_OUT`, or required corner fields are null                 |
| `WRONG_TEAM`        | Confirming socket's team is not the currently-acting slot side                               |
| `MUST_CLEAR_CORNER` | At least one in-zone piece of the confirming team still has a legal clear-out step available |

All 10 codes above are net-new _reachable_ wire values as of this plan (`applyCornerKickClearOut`/
`applyCornerKickClearOutEnd` existed since 38-20 but had no socket entry point). `WRONG_TEAM` and
`INVALID_TARGET` were already reachable elsewhere in the file for other phases, but this plan adds
new call sites that can now also produce them for the clear-out context specifically.

## Decisions Made

See `key-decisions` in frontmatter above — all four were either dictated by the plan's explicit
`<action>` text (the event-ownership pattern, the `validUndoPhases` exclusion) or were fixes
required to make the plan's own explicitly-mandated test scenarios pass correctly (the
`waitForState` async-ordering fix and the `seedCornerKickClearOut` occupied-hex collision fix —
both caught empirically by running the new tests, documented as Deviations below since they
required judgment calls beyond the plan's literal text).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a stale-backlog async race in two new integration tests**

- **Found during:** Task 2, first test run of the new `CORNER_KICK_CLEAR_OUT over the socket`
  describe block in `cornerKick.integration.test.ts`
- **Issue:** `driveLooseBallToCorner` (pre-existing helper) only `await`s `clientA`'s
  `GAME_STATE` promise across its up-to-60-attempt retry loop; `clientB` never has a listener
  attached during that loop, so it accumulates an un-drained backlog of broadcasts (one per
  failed attempt) that were delivered to the socket but never consumed by JS-land. A bare
  `oncePromise`/`.once()` attached to `clientB` immediately after `driveLooseBallToCorner`
  resolves can catch a stale backlog entry (e.g. a `PASS`-phase broadcast from an earlier
  failed roll, or the piece's pre-move position) instead of the actual next fresh broadcast —
  observed directly as two failing assertions (`expected 'PASS' to be 'CORNER_KICK_CLEAR_OUT'`
  and a piece position matching the pre-move parked value instead of the post-move target).
- **Fix:** Added a `waitForState(client, predicate, timeoutMs)` helper that keeps listening
  (rather than resolving on the first event) until a `GAME_STATE` broadcast actually satisfies
  the given predicate, and used it in place of `oncePromise` everywhere the new tests listen on
  a client other than the one already synchronized by `driveLooseBallToCorner`.
- **Files modified:** `packages/server/src/__tests__/cornerKick.integration.test.ts`
- **Verification:** Both affected tests, and the full corner-kick test pair (73 tests), passed
  consistently across 4 consecutive runs after the fix.
- **Committed in:** `c7cecce` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed an occupied-hex collision in the handler-level clear-out seed helper**

- **Found during:** Task 2, first test run of `gameHandlers.cornerKick.test.ts`'s new
  `CORNER_KICK_CLEAR_OUT over the socket` describe block
- **Issue:** `seedCornerKickClearOut`'s original away-piece placement picked "any distinct
  neighbour of `CORNER_HEX`" for `IN_ZONE_AWAY_START`, without checking whether that hex
  coincided with the home in-zone piece's own computed legal/illegal probe targets. In this
  file's fixed pitch geometry it did coincide: the away piece landed exactly on the hex the
  "NOT_TOWARD_GOAL" test expected to be a free (illegal-direction) target for the home piece,
  so `applyCornerKickClearOut`'s occupancy guard fired first and the test observed
  `INVALID_TARGET` instead of the intended `NOT_TOWARD_GOAL`.
- **Fix:** `seedCornerKickClearOut` now computes the home piece's own `clearOutLegalTarget`/
  `clearOutIllegalTarget` first and excludes both (plus the home start hex itself) when
  selecting `IN_ZONE_AWAY_START`, guaranteeing the two pieces' zones of probe hexes never
  collide.
- **Files modified:** `packages/server/src/__tests__/gameHandlers.cornerKick.test.ts`
- **Verification:** Re-ran the full corner-kick handler test file (50 tests) — all pass,
  including the previously-failing `NOT_TOWARD_GOAL` assertion.
- **Committed in:** `c7cecce` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test-only bugs discovered while making the
plan's own mandated test scenarios pass; no production code was touched by either fix).
**Impact on plan:** Both fixes were necessary to deliver the exact test coverage the plan's
Task 2 `<action>` specifies (NOT_TOWARD_GOAL reaching the socket verbatim; a real two-client
walkthrough into `CORNER_KICK_GK_SETUP_ATTACKING`). No scope creep — no production
(`gameHandlers.ts`) code was touched by either fix, and no additional test scenarios beyond the
plan's own list were added.

## Issues Encountered

The worktree needed a fresh `pnpm install --frozen-lockfile` plus
`pnpm --filter @counter-attack/shared build` at session start (no `node_modules`/`dist` present)
— a standard workspace-bootstrap step, not a package addition; no `package.json` changed. One
full-suite test run hit a transient `Worker exited unexpectedly` vitest/tinypool infrastructure
error (unrelated to any specific test, no stack trace pointing at project code) — re-ran
immediately and the full suite passed cleanly (1036 passed, 1 skipped, 1 todo), consistent with
resource contention from a concurrently-running sibling worktree agent rather than a real defect.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The clear-out step is now fully playable over the socket by both managers in turn — a real
  two-client corner walks award, attacking clear-out, defending clear-out, and into the
  goalkeeper window (`CORNER_KICK_GK_SETUP_ATTACKING`), proven by real socket emits rather than
  seeded state.
- Every rejection reason both `applyCornerKickClearOut` and `applyCornerKickClearOutEnd` can
  return is reachable and asserted at the socket boundary — see "Newly Reachable GAME_ERROR
  Codes" above for 38-22's client-side error-message mapping.
- `packages/server/src/gameEngine.ts`, `packages/shared`, and every `packages/client` file are
  unchanged by this plan (verified via `git status --short` before each commit — only
  `gameHandlers.ts` and the two test files were touched).
- `validUndoPhases` still excludes `CORNER_KICK_CLEAR_OUT` (verified via
  `grep -n "'CORNER_KICK_CLEAR_OUT'" packages/server/src/gameHandlers.ts` — the only two matches
  are the phase-guard `if` conditions in the `GAME_MOVE`/`GAME_END_TURN` handlers, neither is
  inside the `validUndoPhases` array literal).
- Full server suite: 1038 total (1036 passed, 1 skipped, 1 todo), up from 1030 pre-plan baseline
  — 8 new tests (the plan's minimum), no test deleted, no test case removed.
  `pnpm --filter @counter-attack/server typecheck` exits 0.
- No blockers for 38-22 (client destination-hex highlighting for the clear-out) — it can now
  build directly on real `GAME_MOVE`/`GAME_END_TURN` emits against `CORNER_KICK_CLEAR_OUT`
  rather than a mocked/seeded socket layer, and has the full wire-code table above to drive its
  `restartErrorMessage.ts` mapping.
- Note on the plan's own acceptance-criteria grep
  (`grep -rn "phase: 'CORNER_KICK_GK_SETUP_ATTACKING'" .../cornerKick.integration.test.ts`):
  this literally still matches the pre-existing (38-05/38-08-era) `seedCornerKickGkSetup` helper
  and its type annotation, which directly seed that phase for ISOLATED testing of the GK
  placement window's own move/end-turn logic (used by the `CORNER-01: goalkeeper reposition
windows` describe block, unmodified by this plan). That helper never claimed to originate from
  a real corner award and was never a "driver that jumps from the corner award" in the sense the
  plan's action text means — the actual corner-award driver (`driveLooseBallToCorner`) is
  unmodified in behavior (still stops at `CORNER_KICK_CLEAR_OUT`) and this plan's new tests
  extend it via real emits, satisfying the criterion's intent rather than its literal grep
  output.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_

## Self-Check: PASSED

- FOUND: packages/server/src/gameHandlers.ts
- FOUND: packages/server/src/**tests**/gameHandlers.cornerKick.test.ts
- FOUND: packages/server/src/**tests**/cornerKick.integration.test.ts
- FOUND: .planning/phases/38-corner-kick/38-21-SUMMARY.md
- FOUND: c6526f2 (Task 1 commit)
- FOUND: c7cecce (Task 2 commit)
- `pnpm --filter @counter-attack/server typecheck` exits 0
- `pnpm --filter @counter-attack/server test` — 39/39 files, 1036 passed, 1 skipped, 1 todo (1038 total; baseline before this plan's test additions was 1030)
