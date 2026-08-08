---
phase: 38-corner-kick
plan: 05
subsystem: api
tags: [typescript, socket.io, corner-kick, restart, server-handlers, vitest]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 04)
    provides: 'the complete pure-function Corner Kick engine chain in gameEngine.ts
      (applyCornerKickGkPlace, applyCornerKickGkWindowEnd, applyCornerKickTakerSelect,
      applyCornerKickReposition, applyCornerKickStageEnd, applyCornerKickFinalMove,
      applyCornerKickFinalSetupEnd), plus the applyRoll PASS-case accuracy gate,
      CORNER_KICK_ACCURACY event, interception bypass, Undo boundaries, Replay
      eligibility, and context teardown for corner resolution'
provides:
  - "GAME_CORNER_KICK_GK_PLACE and GAME_CORNER_KICK_TAKER socket handlers, each
    mutex-protected, payload-validated, and delegating entirely to the pure engine
    functions, with handler-level wrong-team pre-checks the engine itself cannot
    perform (it only verifies the SELECTED piece's team, never the REQUESTING
    socket's team)"
  - 'GAME_END_TURN wiring for CORNER_KICK_GK_SETUP_ATTACKING/_DEFENDING window-end,
    CORNER_KICK_REPOSITION stage-end, and CORNER_KICK_FINAL_SETUP slot-end (no dice
    rolled on the final-setup branch — the kick has not been taken yet)'
  - 'GAME_MOVE branches for CORNER_KICK_REPOSITION (handler-authored MOVE event, since
    applyCornerKickReposition deliberately does not log one) and
    CORNER_KICK_FINAL_SETUP (delegates only — applyCornerKickFinalMove already logs
    its own CORNER_KICK_MOVE event)'
  - 'validUndoPhases registration for both reposition windows; the three placement
    phases (GK setup x2, taker select) remain excluded'
  - "isCornerKickContext + CORNER_KICK_UNLIMITED_DISTANCE: a High Pass corner aimed
    inside the byline owner's own penalty area is server-evaluated as unlimited
    range; every other pass type/target keeps the ordinary caps unmodified"
  - "Rule 2 fix: the five CORNER_KICK_* phases added to gameEngine.ts's
    ZONE_CHECK_EXEMPT_PHASES — a corner is always awarded and taken next to a
    byline (a final third), so the pre-existing centralized ball-zone free-move
    interrupt would otherwise hijack every corner-kick phase on first broadcast"
affects: [38-06, 38-07, 38-08, 38-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Handler-level wrong-team pre-check for placement/selection handlers whose
      engine function only validates the SELECTED PIECE's team against a derived
      acting team (never the REQUESTING socket's team) — GAME_CORNER_KICK_GK_PLACE,
      GAME_CORNER_KICK_TAKER, and the GAME_MOVE CORNER_KICK_REPOSITION/
      CORNER_KICK_FINAL_SETUP branches all add an isActivePlayer/socketTeam guard the
      plan's own threat model (T-38-17) requires but the engine alone cannot provide"
    - "Per-window event-emission asymmetry: CORNER_KICK_REPOSITION's engine function
      does not log its own move event (handler constructs it, mirroring
      applyGoalKickReposition's event shape) while CORNER_KICK_FINAL_SETUP's
      applyCornerKickFinalMove DOES log its own CORNER_KICK_MOVE event (handler must
      not double-log) — each window's handler branch was written to match its
      specific engine function's actual behavior rather than a uniform assumption"
    - "passOptions single computed value (replacing the pre-existing two-arm ternary)
      resolves throw-in override first, then the corner-kick High-Pass-in-box
      override, then falls through to validatePass's own per-type caps — extends
      Plan 37-06's options.maxDistance mechanism without touching its signature"

key-files:
  created:
    - packages/server/src/__tests__/gameHandlers.cornerKick.test.ts
  modified:
    - packages/server/src/gameHandlers.ts
    - packages/server/src/gameEngine.ts

key-decisions:
  - "GAME_CORNER_KICK_GK_PLACE and GAME_CORNER_KICK_TAKER both add an explicit
    socketTeam(socket)-based turn guard before delegating to the engine, closing a
    spoofing gap: applyCornerKickGkPlace/applyCornerKickTakerSelect only check that
    the SELECTED PIECE's team matches the derived acting/kicking team, never that
    the REQUESTING socket controls that team — without the handler-level guard, the
    non-acting team could submit a pieceId belonging to the acting team and have it
    accepted"
  - 'The GAME_MOVE CORNER_KICK_REPOSITION and CORNER_KICK_FINAL_SETUP branches add
    the identical isActivePlayer pre-check for the same reason (applyCornerKickReposition/
    applyCornerKickFinalMove have the same piece-team-only gap); the GAME_END_TURN
    CORNER_KICK_REPOSITION branch does NOT need this pre-check because
    applyCornerKickStageEnd takes socketTeam(socket) as an explicit trusted parameter
    (mirrors applyFreeKickReady) rather than deriving identity from a piece lookup'
  - "CORNER_KICK_REPOSITION needs no FREE_KICK_SETUP-style stage-team special case in
    GAME_UNDO — verified empirically (Task 2): unlike Free Kick, Corner's activeTeam
    IS kept in sync at every stage transition (set at trigger time and on every
    applyCornerKickStageEnd advance), so the default isActivePlayer branch is already
    correct for both CORNER_KICK_REPOSITION and CORNER_KICK_FINAL_SETUP"
  - 'DICE_PHASES left unchanged (confirmed by inspection, Task 2) — none of the five
    corner phases require a dice roll; only the terminal PASS phase does'
  - "Pitfall 5: defendingBox in the range-override computation is the BYLINE OWNER's
    own penalty area (opposite team from cornerKickTeam), not the kicking team's box
    — verified via 6 dedicated tests (both team-mirror in-box/out-of-box cases)"

patterns-established:
  - "Corner Kick's socket surface follows the exact pure-function-delegate +
    isProcessing mutex + phase-guard shape used by every prior restart-type handler
    in this file (throw-in, goal-kick, free-kick) — no new handler pattern
    introduced, only new handlers following the existing one"

requirements-completed: [CORNER-01, CORNER-02, CORNER-03, CORNER-04, CORNER-06]

# Metrics
duration: ~2h (session included one mid-task interruption/resume)
completed: 2026-08-07
---

# Phase 38 Plan 05: Corner Kick Socket Surface Summary

**Exposes the full Corner Kick chain over Socket.io — two new handlers
(`GAME_CORNER_KICK_GK_PLACE`, `GAME_CORNER_KICK_TAKER`), corner branches inside the
existing `GAME_MOVE`/`GAME_END_TURN` handlers for both reposition windows, and a
byline-owner-conditional unlimited-range override for an in-box High Pass corner —
plus a Rule 2 fix closing a `ZONE_CHECK_EXEMPT_PHASES` gap that would otherwise let
every corner-kick phase be spuriously hijacked by the pre-existing ball-zone
free-move interrupt.**

## Performance

- **Duration:** ~2h (one mid-task interruption/resume during Task-1 debugging)
- **Completed:** 2026-08-07
- **Tasks:** 3 completed
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments

- **CORNER-01/CORNER-02 socket handlers:** `GAME_CORNER_KICK_GK_PLACE` and
  `GAME_CORNER_KICK_TAKER` added immediately after `GAME_THROW_IN_PLACE`, each
  mutex-protected (`room.isProcessing` acquire/`finally`-release), payload-validated
  (ASVS V5 shape checks before any engine call), and delegating entirely to the
  pure `applyCornerKickGkPlace`/`applyCornerKickTakerSelect` engine functions. Both
  add a handler-level wrong-team pre-check the plan's own T-38-17 threat model
  requires but the engine alone cannot enforce (see Decisions).
  `applyCornerKickGkWindowEnd` wired into the existing `GAME_END_TURN` handler for
  both GK-setup windows, guarded by `isActivePlayer` (activeTeam is kept in sync at
  every corner-kick GK transition).
- **CORNER-03/CORNER-06 reposition windows:** `GAME_MOVE` gained branches for
  `CORNER_KICK_REPOSITION` (delegates to `applyCornerKickReposition`, then the
  handler constructs and appends its own `MOVE` event — the engine function
  deliberately does not log one, mirroring `applyGoalKickReposition`'s event shape)
  and `CORNER_KICK_FINAL_SETUP` (delegates to `applyCornerKickFinalMove`, which
  already appends its own `CORNER_KICK_MOVE` event internally — the handler does
  NOT construct a second one, a deliberate deviation from the plan's literal
  wording; see Deviations). `GAME_END_TURN` gained matching branches:
  `CORNER_KICK_REPOSITION` passes `socketTeam(socket)` straight through to
  `applyCornerKickStageEnd` (mirrors `applyFreeKickReady`'s trusted-parameter
  pattern); `CORNER_KICK_FINAL_SETUP` pre-checks `isActivePlayer` before
  `applyCornerKickFinalSetupEnd` (that function takes no team parameter and
  performs no team validation of its own) and rolls no dice.
  `validUndoPhases` gained both reposition windows; empirically verified (and
  documented in-source) that Corner needs no `FREE_KICK_SETUP`-style stage-team
  special case in `GAME_UNDO`, since Corner's `activeTeam` — unlike Free Kick's —
  is kept in sync at every stage transition. `DICE_PHASES` confirmed unchanged by
  inspection.
- **CORNER-04 range override:** `isCornerKickContext` (reads persistent
  `state.cornerKickTeam`, not `lastActionType`, since the latter is already
  overwritten with the client's chosen passType by the time this check runs) and
  `CORNER_KICK_UNLIMITED_DISTANCE` sentinel added. The `GAME_ROLL` handler's
  `validatePass` options argument restructured from a two-arm ternary into a single
  computed `passOptions`: throw-in override checked first (byte-for-byte
  unchanged), then a corner-kick High Pass targeting a hex inside the BYLINE
  OWNER's own penalty area (Pitfall 5 — the box the attacking team is shooting at,
  computed as the team opposite `cornerKickTeam`) gets the unlimited sentinel,
  otherwise `undefined` (ordinary per-type caps apply).
- **Rule 2 fix (gameEngine.ts):** `ZONE_CHECK_EXEMPT_PHASES` extended with all five
  `CORNER_KICK_*` phases. Discovered while writing Task 1's first integration test:
  a corner is by definition always awarded and taken next to a byline (inside a
  final third), so `applyFreeMoveZoneCheck`'s centralized ball-zone interrupt
  (which fires on every `broadcastState` call, including snap-back error paths)
  would otherwise overlay `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` on top of every
  corner-kick phase's very first broadcast. The constant's own pre-existing comment
  already earmarked this exact gap ("Phase 38 has one place to add `CORNER_KICK_*`
  when that restart family exists") — this plan is the first to actually exercise
  the corner phases through `broadcastState`, so it is the first to hit the gap.
- **44 new tests** in `gameHandlers.cornerKick.test.ts` (18 Task 1, 17 Task 2, 9
  Task 3), all socket-level integration tests over a real Socket.io server +
  socket.io-client (no mocking), mirroring `throwIn.integration.test.ts`/
  `goalKick.integration.test.ts`'s harness. Full server suite: 956 tests / 38
  files, all green (1 pre-existing skip, 1 pre-existing todo), no regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Socket handlers for goalkeeper placement and corner-taker selection (CORNER-01, CORNER-02)** — `b841ca6` (feat)
2. **Task 2: Corner branches in GAME_MOVE / GAME_END_TURN and the server registration checklist (CORNER-03, CORNER-06)** — `85e6c03` (feat)
3. **Task 3: Penalty-area-conditional range override for a High Pass corner (CORNER-04, Pitfall 5)** — `4781550` (feat)

_Note: no plan-metadata commit is created by a worktree-isolated executor — the orchestrator handles final metadata commits after merge._

## Files Created/Modified

- `packages/server/src/gameHandlers.ts` — two new socket handlers
  (`GAME_CORNER_KICK_GK_PLACE`, `GAME_CORNER_KICK_TAKER`); `GAME_END_TURN` branches
  for both GK-setup windows, `CORNER_KICK_REPOSITION`, and
  `CORNER_KICK_FINAL_SETUP`; `GAME_MOVE` branches for `CORNER_KICK_REPOSITION` and
  `CORNER_KICK_FINAL_SETUP`; `validUndoPhases` extended; `isCornerKickContext`/
  `CORNER_KICK_UNLIMITED_DISTANCE` added; the `GAME_ROLL` PASS-branch
  `validatePass` options argument restructured into a computed `passOptions`.
- `packages/server/src/gameEngine.ts` — `ZONE_CHECK_EXEMPT_PHASES` extended with
  the five `CORNER_KICK_*` phases (Rule 2 fix, see Deviations).
- `packages/server/src/__tests__/gameHandlers.cornerKick.test.ts` (new) — 44
  socket-integration tests across three `describe` groups plus supporting seed
  helpers (`seedCornerKickGkSetup`, `seedCornerKickTakerSelect`,
  `seedCornerKickReposition`, `seedCornerKickFinalSetup`, `seedPassRangeState`),
  each of which deliberately parks all non-test-subject pieces (including both
  goalkeepers) in the pitch's MIDDLE third to avoid spuriously triggering the
  ball-zone free-move interrupt during a real broadcast.

## Decisions Made

See frontmatter `key-decisions` for the full list. Highlights:

- Both new placement/selection handlers, and the `GAME_MOVE` branches for the two
  reposition windows, add a handler-level turn guard (`socketTeam(socket)` compared
  against the phase-derived acting team) that is NOT redundant with the engine's
  own guard — the engine only ever validates the SELECTED PIECE's team, never the
  REQUESTING socket's identity, since `pieceId` is the only identity-bearing
  payload field. Without the handler-level guard, the non-acting team's socket
  could submit a `pieceId` belonging to the acting team and have it accepted.
- The `GAME_END_TURN` `CORNER_KICK_REPOSITION` branch deliberately does NOT add
  this same pre-check, because `applyCornerKickStageEnd` takes `team` as an
  explicit parameter derived directly from `socketTeam(socket)` (a trusted,
  socket-identity-based value) rather than from a piece lookup — this mirrors
  `applyFreeKickReady`'s existing pattern and has no equivalent gap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] `ZONE_CHECK_EXEMPT_PHASES` did not
include the five Corner Kick phases**

- **Found during:** Task 1, while writing the first `GAME_CORNER_KICK_GK_PLACE`
  integration test — every assertion of the seeded phase failed, always returning
  `FREE_MOVE_DEFENSE` instead.
- **Issue:** `applyFreeMoveZoneCheck` (gameEngine.ts) is called from every
  `broadcastState` invocation, including snap-back error paths, and overlays
  `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` whenever the ball is in a final third and
  the opposite final third has an occupant. A corner-kick ball is, by definition,
  always right next to a byline (a final third), and the default-formation
  goalkeepers sit in their own final thirds too — so this centralized interrupt
  fired on the very first `broadcastState` call for any seeded corner-kick phase,
  silently overwriting the phase before any handler-level assertion could run. The
  constant's own pre-existing doc comment already flagged this exact gap: "Phase 38
  has one place to add `CORNER_KICK_*` when that restart family exists."
- **Fix:** Added all five `CORNER_KICK_*` phases (`CORNER_KICK_GK_SETUP_ATTACKING`,
  `CORNER_KICK_GK_SETUP_DEFENDING`, `CORNER_KICK_TAKER_SELECT`,
  `CORNER_KICK_REPOSITION`, `CORNER_KICK_FINAL_SETUP`) to
  `ZONE_CHECK_EXEMPT_PHASES`, mirroring the existing Phase 37 restart-phase
  exclusions exactly.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** All 44 new tests pass; full server suite (956 tests, 38 files)
  green with no regressions.
- **Committed in:** `b841ca6` (Task 1 commit)

**2. [Rule 1 - Bug] `CORNER_KICK_FINAL_SETUP`'s `GAME_MOVE` branch does not
construct its own event (plan text said it should)**

- **Found during:** Task 2, while reading `applyCornerKickFinalMove`'s actual
  implementation (already shipped by Plan 38-03) to confirm the event-emission
  shape the plan's `<action>` section described.
- **Issue:** The plan's Task 2 action text states "the engine functions
  deliberately do not [emit their own move event]" for both reposition windows,
  instructing the handler to construct a `CORNER_KICK_MOVE` event for the
  `CORNER_KICK_FINAL_SETUP` branch. Reading the actual `applyCornerKickFinalMove`
  body shows it already builds and appends its own `CORNER_KICK_MOVE` event
  (`eventLog: [...state.eventLog, moveEvent]`) — only `applyCornerKickReposition`
  (the `CORNER_KICK_REPOSITION` window) genuinely omits its own event, per its own
  doc comment. Following the plan literally would have double-logged every
  `CORNER_KICK_FINAL_SETUP` move, corrupting Undo/Replay event counts.
- **Fix:** The `CORNER_KICK_FINAL_SETUP` `GAME_MOVE` branch delegates to
  `applyCornerKickFinalMove` and broadcasts without constructing a second event;
  the `CORNER_KICK_REPOSITION` branch is the one that constructs its own `MOVE`
  event, matching each engine function's actual (not assumed) behavior.
- **Files modified:** `packages/server/src/gameHandlers.ts`
- **Verification:** A dedicated test (`a valid move by the eligible attacking
piece logs exactly one CORNER_KICK_MOVE event`) asserts `eventLog.filter(e =>
e.type === 'CORNER_KICK_MOVE').length === 1` after a single move, proving no
  double-log.
- **Committed in:** `85e6c03` (Task 2 commit)

**3. [Rule 2 - Missing Critical Functionality] Handler-level turn guards added for
`GAME_CORNER_KICK_GK_PLACE`, `GAME_CORNER_KICK_TAKER`, and the two corner
`GAME_MOVE` branches**

- **Found during:** Task 1 and Task 2, while cross-checking each new handler
  against the plan's own T-38-17 threat-model entry ("the engine re-derives the
  legal acting team ... and rejects mismatches with WRONG_TEAM. No payload carries
  a team id.").
- **Issue:** `applyCornerKickGkPlace`, `applyCornerKickTakerSelect`,
  `applyCornerKickReposition`, and `applyCornerKickFinalMove` each validate only
  that the SELECTED PIECE's `teamId` matches a phase-derived acting team — none of
  them receive or check the REQUESTING socket's team. A non-acting socket could
  therefore submit a `pieceId` belonging to the acting/kicking team and have the
  action accepted, exactly the spoofing threat T-38-17 is meant to close.
- **Fix:** Added an explicit `socketTeam(socket)`-based turn guard immediately
  before each engine delegation in all four sites, emitting `WRONG_TEAM` on
  mismatch before the engine is ever called.
- **Files modified:** `packages/server/src/gameHandlers.ts`
- **Verification:** Dedicated tests assert `WRONG_TEAM` for a non-acting socket
  submitting a valid acting-team `pieceId` in each of the four cases (e.g. "a
  non-kicking-team socket is rejected with WRONG_TEAM even for a valid
  own-team-of-the-kicker piece id").
- **Committed in:** `b841ca6` (Task 1), `85e6c03` (Task 2)

---

**Total deviations:** 3 auto-fixed (2 Rule 2 — missing critical functionality, 1
Rule 1 — bug prevention).
**Impact on plan:** All three deviations were necessary for correctness (the
zone-check gap would have made every corner-kick phase unreachable through a real
broadcast) or security (the turn-guard gaps are exactly what this plan's own
threat model requires closed). No scope creep — all fixes are narrowly scoped to
the exact files and functions this plan already touches, with one exception
(`gameEngine.ts`'s `ZONE_CHECK_EXEMPT_PHASES`, a single-constant addition the
plan's own dependency chain — Plan 38-04's summary — did not anticipate needing).

## Issues Encountered

- The initial double-emit mutex test for `GAME_CORNER_KICK_GK_PLACE` assumed the
  second of two rapid emissions would be dropped, matching the pattern used
  elsewhere in this file for phase-transitioning handlers. `applyCornerKickGkPlace`
  explicitly allows re-placing the same goalkeeper within the same window (no
  lock/budget tracking, per its own doc comment), so both synchronous back-to-back
  emits legitimately complete (this handler has no internal `await`, so the mutex
  never actually blocks a second synchronous call). Corrected the test to assert
  both emits land cleanly and the final broadcast reflects the LAST accepted
  placement, rather than asserting a single-event outcome.
- Two of the Task 3 in-box unlimited-range tests initially positioned the ball
  carrier itself inside the OPPOSITE final third from the pass target (to reach a
  distance well beyond the ordinary 15-hex cap). This legitimately triggered the
  unrelated ball-zone free-move interrupt (the carrier's teammate — itself — was
  left behind in the opposite third after the kick), overlaying `FREE_MOVE_ATTACK`
  on top of the expected `HIGH_PASS_MOVE` phase. Not a bug — correct engine
  behavior — but it obscured the test's actual subject. Repositioned both carriers
  into the pitch's MIDDLE third (distance 18, still comfortably beyond the 15-hex
  cap) to isolate the range-override assertion from the unrelated interrupt.
- Session was interrupted mid-Task-1 (investigating the `ZONE_CHECK_EXEMPT_PHASES`
  gap) and resumed from the coordinator's message; no work was lost — the
  in-progress `Edit` to the test file (already applied before the interruption)
  was verified intact on resume and execution continued from that exact point.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The entire Corner Kick chain (GK placement x2, corner-taker selection, both
  reposition windows, and the High/Low accuracy resolution wired in Plan 38-04) is
  now reachable end-to-end over Socket.io, mutex-protected, team-guarded, and
  payload-validated.
- No client-side wiring exists yet (`CornerKickSetupPanel.tsx`, `GameBoard.tsx`
  phase dispatch, `BallLocationRing.tsx`) — per 38-PATTERNS.md this is
  out-of-scope for this plan and belongs to the presentation-layer plans (38-06
  onward per the phase's plan sequence, though 38-06/38-07 SUMMARY.md indicate the
  client panel work may already be complete — verify against the current phase
  state before assuming this plan unblocks it).
- `pnpm --filter @counter-attack/server build` and the full server test suite (956
  tests, 38 files) are green — no regressions in goal-kick, free-kick, throw-in,
  or any pre-existing pass-type flow.
- The `ZONE_CHECK_EXEMPT_PHASES` fix in `gameEngine.ts` is a correctness
  prerequisite for ANY future work that exercises corner-kick phases through a real
  `broadcastState` call (e.g. client-side E2E/UAT testing) — without it, every
  corner-kick phase near a final third would have been silently unreachable.

## Known Stubs

None — every behavior this plan's tasks describe is fully implemented and tested;
no placeholder/mock data paths were introduced.

## Threat Flags

None — this plan's own threat model (T-38-17 through T-38-22, T-38-SC) was fully
addressed as designed, with the turn-guard deviations above being direct,
in-scope closures of T-38-17 rather than new surface. No new network endpoints,
schema changes, or trust-boundary shifts beyond what the plan's `<threat_model>`
already enumerated.

## Self-Check: PASSED

- FOUND: packages/server/src/gameHandlers.ts
- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameHandlers.cornerKick.test.ts
- FOUND: commit b841ca6
- FOUND: commit 85e6c03
- FOUND: commit 4781550

---

_Phase: 38-corner-kick_
_Completed: 2026-08-07_
