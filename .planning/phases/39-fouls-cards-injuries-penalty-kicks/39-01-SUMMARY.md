---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 01
subsystem: api
tags: [typescript, shared-types, socket.io, react, game-state]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: the staged-repositioning / dedicated-phase-chain pattern this plan's GamePhase and GameState clusters follow
provides:
  - Phase 39 GamePhase union (8 new phases), ActionEventType/ActionEvent union (11 new variants), PlayerPiece injury/card fields, GameState toggle + duel-state clusters
  - PENALTY_SPOT shared constant (packages/shared/src/pitch.ts)
  - 5 new ClientEvents (GAME_FOUL_CHOICE, GAME_GK_DIVE_AT_FEET, GAME_GK_BOX_ENTRY_RESPONSE, GAME_GK_BOX_ENTRY_MOVE, GAME_PENALTY_KICK_TAKER) with typed payloads
  - ROOM_SETTINGS_CONFIRM/CONFIRMED extended with fouls/booking/injury booleans, wired end-to-end through Room storage and the settings-confirm handler
  - LOOSE_BALL_LAND event now carries direction/distance (D-15 log fix)
  - buildInitialGameState foulsEnabled/bookingEnabled/injuryEnabled toggle params (default false)
  - GameBoard PHASE_LABEL and ActionLog formatEvent exhaustively updated for every new phase/event
affects:
  [
    39-02,
    39-03,
    39-04,
    39-05,
    39-06,
    39-07,
    39-08,
    39-09,
    39-10,
    39-11,
    39-12,
    39-13,
    39-14,
    39-15,
    39-16,
    39-17,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Per-restart dedicated-field-cluster GameState convention (goalKick*/cornerKick* precedent) extended to foul*/gkDiveAtFeet*/gkBoxEntry*/penaltyKick* clusters'
    - 'INJURY-02 implemented as stored attribute mutation at injury time, not a computeCombinedScore penalty-array entry (documented rationale on PlayerPiece.injuryCount)'

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/pitch.ts
    - packages/shared/src/pitch.test.ts
    - packages/shared/src/events.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/roomStore.ts
    - packages/server/src/roomHandlers.ts
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ActionLog.test.tsx
    - packages/client/src/App.tsx
    - packages/server/src/__tests__/testHelpers.ts
    - packages/server/src/__tests__/room.integration.test.ts
    - packages/server/src/__tests__/draftReconnect.integration.test.ts
    - packages/server/src/__tests__/draftSession.integration.test.ts
    - packages/server/src/__tests__/replay.integration.test.ts
    - packages/client/src/components/EventBanner.test.tsx
    - packages/client/src/App.test.tsx

key-decisions:
  - "INJURY-02 (-1 to all attributes, floored at 1) is a stored decrement of the numeric attributes at injury time, not a penalty-array entry — pace is a movement budget never fed into computeCombinedScore, so only stored mutation can satisfy the literal 'all attributes' requirement (documented on PlayerPiece.injuryCount)"
  - 'PENALTY_SPOT keyed by the DEFENDING team; home={q:4,r:13}, away={q:32,r:13} — two-thirds out on the goal centre-line, mirroring the q_away=36-q_home convention'
  - 'GK-dive-at-feet cap (gkDiveAtFeetUsedByTeam) is a SHARED once-per-team-per-half cap with the existing shot-block GK_DIVE mechanic (D-09); box-entry cap (gkBoxEntryUsedByTeam) is INDEPENDENT of it (D-10/D-11)'
  - "secondHalfConfirmed copies headerConfirmed's GameState-scoped {home,away} shape, not LINEUP_CONFIRM's Room-scoped flags, because half-time is mid-match and Room fields have no path into broadcastState"
  - 'PEN-02 penalty reposition windows and GK box-entry reposition deliberately reuse existing GAME_MOVE/GAME_END_TURN events — no redundant reposition events added'

patterns-established:
  - "D-15 loose-ball log line: '[LOOSE BALL] scatters {DIR} ({N} hex[es]): from → to' — LOOSE_BALL_DIRECTION_LABELS is the ActionLog-side display counterpart to scoreUtils.ts's module-private LOOSE_BALL_CUBE_DIRECTIONS"

requirements-completed:
  [
    FOUL-01,
    FOUL-02,
    FOUL-03,
    FOUL-04,
    FOUL-05,
    CARD-01,
    CARD-02,
    CARD-03,
    CARD-04,
    INJURY-01,
    INJURY-02,
    INJURY-03,
    INJURY-04,
    GKDIVE-01,
    GKDIVE-02,
    GKDIVE-03,
    GKDIVE-04,
    GKDIVE-05,
    PEN-01,
    PEN-02,
    PEN-03,
    FK-01,
    SETTINGS-01,
    SETTINGS-02,
    SETTINGS-03,
  ]

# Metrics
duration: ~25min
completed: 2026-08-14
---

# Phase 39 Plan 1: Data Model + Contract Registration Summary

**Full Phase 39 shared contract (GamePhase/ActionEvent/GameState/PlayerPiece surface for fouls, bookings, injuries, GK-dive/box-entry duels, and penalty kicks) landed in one plan, with every exhaustive consumer (PHASE_LABEL, formatEvent, buildInitialGameState) repaired so `pnpm build`/`pnpm test` stay green for waves 2+.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 18 (8 in-plan + 10 cross-package deviation fixes)

## Accomplishments

- Declared every Phase 39 `GamePhase` (8), `ActionEventType`/`ActionEvent` variant (11), `PlayerPiece` field (3), and `GameState` field cluster (toggles, foul, GK-dive-at-feet, GK-box-entry, penalty-kick, second-half-confirm) in `packages/shared/src/types.ts`, plus `PENALTY_SPOT` in `pitch.ts` with dedicated test coverage.
- Registered 5 new `ClientEvents` with typed payloads and extended `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` with `fouls`/`booking`/`injury` booleans.
- Repaired every exhaustive consumer broken by the above: `gameEngine.ts`'s single `LOOSE_BALL_LAND` construction site (D-15 direction/distance), `buildInitialGameState`'s three new toggle params, `GameBoard.tsx`'s `PHASE_LABEL` Record, and `ActionLog.tsx`'s `formatEvent` switch (11 new cases + the extended `LOOSE_BALL_LAND` case).
- Delivered D-15 end-to-end: a loose-ball landing now logs `scatters NE (3 hexes): 12,7 → 15,7` instead of just coordinates.
- Full monorepo `pnpm build`/`pnpm typecheck`/`pnpm test` all green: shared 706 tests, server 1034 (1 skipped, 1 todo), client 794.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the Phase 39 data model in shared types and add PENALTY_SPOT** - `51b26ca` (feat)
2. **Task 2: Register the Phase 39 socket events and extend the settings payloads** - `72d7662` (feat, includes Rule 3 cross-package blocking fixes)
3. **Task 3: Repair every exhaustive consumer — gameEngine LOOSE_BALL_LAND + toggles, GameBoard PHASE_LABEL, ActionLog formatEvent** - `29ac066` (feat)

_No plan-metadata commit yet — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/shared/src/types.ts` - Phase 39 GamePhase/ActionEventType/ActionEvent/PlayerPiece/GameState additions
- `packages/shared/src/pitch.ts` - `PENALTY_SPOT` constant
- `packages/shared/src/pitch.test.ts` - `PENALTY_SPOT` region/pitch-hex assertions
- `packages/shared/src/events.ts` - 5 new `ClientEvents` + extended settings payload/signature
- `packages/server/src/gameEngine.ts` - `LOOSE_BALL_LAND` direction/distance; `buildInitialGameState` toggle params
- `packages/server/src/roomStore.ts` - `Room.foulsEnabled`/`bookingEnabled`/`injuryEnabled` (Rule 3)
- `packages/server/src/roomHandlers.ts` - `ROOM_SETTINGS_CONFIRM` handler validates/stores/broadcasts the 3 new toggles; reconnect echo updated (Rule 3)
- `packages/client/src/components/GameBoard.tsx` - `PHASE_LABEL` gains 8 entries
- `packages/client/src/components/ActionLog.tsx` - `formatEvent` gains 11 new cases + extended `LOOSE_BALL_LAND`; new `LOOSE_BALL_DIRECTION_LABELS` const
- `packages/client/src/components/ActionLog.test.tsx` - 18 new assertions
- `packages/client/src/App.tsx` - `ROOM_SETTINGS_CONFIRM` emit defaults the 3 new toggles to `false` (Rule 3)
- `packages/server/src/__tests__/testHelpers.ts`, `room.integration.test.ts`, `draftReconnect.integration.test.ts`, `draftSession.integration.test.ts`, `replay.integration.test.ts` - updated fixtures for the new required payload/event shapes (Rule 3)
- `packages/client/src/components/EventBanner.test.tsx`, `packages/client/src/App.test.tsx` - updated fixtures for the new required payload/event shapes (Rule 1/3)

## Decisions Made

- INJURY-02 implemented as stored attribute mutation (not a `computeCombinedScore` penalty array) — see key-decisions above; documented directly on `PlayerPiece.injuryCount`'s JSDoc for future plans to follow.
- `PENALTY_SPOT` keyed by defending team, derived from the existing goal/penalty-area region boundaries and the `q_away = 36 - q_home` mirroring convention already used throughout `pitch.ts`.
- GK-dive-at-feet cap is explicitly documented as SHARED with the existing shot-block `GK_DIVE` mechanic (D-09); box-entry cap is explicitly INDEPENDENT (D-10/D-11) — both documented inline on the respective `GameState` fields to prevent future confusion.
- `secondHalfConfirmed` mirrors `headerConfirmed`'s GameState-scoped shape rather than `LINEUP_CONFIRM`'s Room-scoped flags, per RESEARCH.md Pitfall 4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` required-field extension broke every existing call site**

- **Found during:** Task 2, confirmed while verifying Task 3's full-monorepo build gate
- **Issue:** Adding `fouls`/`booking`/`injury` as required booleans to the shared `ClientToServerEvents`/`ServerToClientEvents` payload types (per the plan's explicit instruction to match `outOfBounds`'s required-not-optional style) broke `roomHandlers.ts`'s two `ROOM_SETTINGS_CONFIRMED` emit call sites (arg-count mismatch) and every test fixture across the server and client packages that constructs a `ROOM_SETTINGS_CONFIRM` payload object literal (missing required properties). This is a direct, unavoidable consequence of Task 2's own instructions, not a separate defect — but the plan's Task 3 file list didn't cover it, and the plan's own verification requires a full green `pnpm build`/`pnpm test` before wave 2 can start.
- **Fix:** Added `Room.foulsEnabled`/`bookingEnabled`/`injuryEnabled` to `roomStore.ts` (mirroring the existing `outOfBoundsEnabled` field/comment style); extended the `ROOM_SETTINGS_CONFIRM` handler in `roomHandlers.ts` with allow-list boolean validation (mirroring the existing `outOfBounds` check) and storage/broadcast of the 3 new toggles at both emit sites (the confirm handler and the late-joiner reconnect echo). Updated `App.tsx`'s `ROOM_SETTINGS_CONFIRM` emit to default the 3 new toggles to `false` (GameSettingsScreen has no UI for them yet — that UI is explicitly out of this plan's scope and deferred to a later Phase 39 plan). Updated 7 test fixture files (`testHelpers.ts`, `room.integration.test.ts`, `draftReconnect.integration.test.ts`, `draftSession.integration.test.ts`, `App.test.tsx`) to supply the 3 new required fields.
- **Files modified:** `packages/server/src/roomStore.ts`, `packages/server/src/roomHandlers.ts`, `packages/client/src/App.tsx`, `packages/server/src/__tests__/testHelpers.ts`, `packages/server/src/__tests__/room.integration.test.ts`, `packages/server/src/__tests__/draftReconnect.integration.test.ts`, `packages/server/src/__tests__/draftSession.integration.test.ts`, `packages/client/src/App.test.tsx`
- **Verification:** `pnpm typecheck` and `pnpm test` green across all three packages
- **Committed in:** `72d7662` (Task 2 commit, roomStore/roomHandlers/App.tsx/most test fixtures), `29ac066` (Task 3 commit, App.test.tsx — surfaced only once the full test suite ran after Task 3's changes)

**2. [Rule 1 - Bug] `LOOSE_BALL_LAND`'s new required `direction`/`distance` fields broke two pre-existing test fixtures**

- **Found during:** Task 2/3 build verification
- **Issue:** Task 1's required (not optional) `direction`/`distance` fields on the `LOOSE_BALL_LAND` `ActionEvent` variant — deliberately required so the compiler flags any construction site that omits them — surfaced two test fixtures constructing bare `LOOSE_BALL_LAND` literals: `packages/server/src/__tests__/replay.integration.test.ts` and `packages/client/src/components/EventBanner.test.tsx`.
- **Fix:** Added `direction`/`distance` literal values to both fixtures (arbitrary valid dice values; the tests don't assert on them).
- **Files modified:** `packages/server/src/__tests__/replay.integration.test.ts`, `packages/client/src/components/EventBanner.test.tsx`
- **Verification:** `pnpm typecheck` and `pnpm test` green
- **Committed in:** `72d7662`

---

**Total deviations:** 2 auto-fixed (both Rule 3/Rule 1, both direct compile-time fallout of this plan's own required-field additions across shared types/events consumed outside the plan's originally-scoped file list)
**Impact on plan:** Both fixes were necessary to satisfy the plan's own stated verification gate ("waves 2+ start from a green `pnpm build`/`pnpm test`"). No scope creep beyond what was required to keep the build green — no new UI, no new game logic, no architectural changes. `GameSettingsScreen.tsx` deliberately left untouched (no fouls/booking/injury checkboxes added) since real UI wiring is out of this plan's scope.

## Issues Encountered

- Fresh worktree had no `node_modules` (each git worktree gets its own working directory) — ran `pnpm install --frozen-lockfile` once at the start of execution (~5 min) before any typecheck/build/test command would run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Waves 2+ (Plans 39-02 through 39-17) can build directly on the full Phase 39 shared contract — every `GamePhase`, `ActionEventType`, `ActionEvent` variant, `GameState` field, and `PlayerPiece` field listed in the phase's "Artifacts this phase produces" section now exists and compiles.
- `PENALTY_SPOT`, the 5 new `ClientEvents`, and the extended settings payload are ready for the server-side engine logic (Plan 39-03+) and client panels (later waves) to consume.
- `Room.foulsEnabled`/`bookingEnabled`/`injuryEnabled` now exist and are wired through `ROOM_SETTINGS_CONFIRM` end-to-end (validated, stored, broadcast) — Plan 39-03 (per the plan's own inline comment) is expected to wire these into `buildInitialGameState`'s new toggle params at the `LINEUP_CONFIRM`/game-start call site (currently still called with the toggle params defaulting to `false`).
- No blockers. Full monorepo build/typecheck/test all green.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_
