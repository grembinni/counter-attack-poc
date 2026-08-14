---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 15
subsystem: api
tags: [typescript, socket.io, gameHandlers, roomStore, vitest, integration-test, gk-dive-at-feet, box-entry, half-time]

# Dependency graph
requires:
  - phase: 39-12
    provides: 'gameEngine.ts computeGkDiveAtFeetOffer/applyGkDiveAtFeetResponse — the pure dive-at-feet duel functions this plan wires into broadcastState and a new socket handler'
  - phase: 39-14
    provides: 'gameEngine.ts computeBoxEntryOffer/applyBoxEntryResponse/applyBoxEntryMove/applySecondHalfConfirm — the pure box-entry response and mutual-confirm functions this plan wires into broadcastState and three socket handlers'
provides:
  - 'roomStore.ts Room.lastBroadcastBallPosition and a single post-action offer-hook block in broadcastState — box entry (D-10) checked first, dive-at-feet (GKDIVE-02, gated on foulsEnabled) checked only when box entry did not fire, at most one offer per broadcast'
  - 'gameHandlers.ts GAME_GK_DIVE_AT_FEET, GAME_GK_BOX_ENTRY_RESPONSE, GAME_GK_BOX_ENTRY_MOVE — three new five-step handlers (null-state guard, phase guard, payload validation, team guard against the offer'"'"'s explicit team field, engine delegate)'
  - "gameHandlers.ts GAME_HALF_TIME_START reworked (D-16) — removes the single-team kick-off-team-only gate entirely; both managers may confirm the second half in either order via applySecondHalfConfirm"
  - 'packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts — 8-test GKDIVE-01..05 socket-level suite'
  - 'packages/server/src/__tests__/gameHandlers.boxEntry.test.ts — 6-test D-10/D-11 socket-level suite'
  - 'packages/server/src/__tests__/gameHandlers.halfTime.test.ts — 5-test D-16 socket-level suite (first-ever socket coverage for GAME_HALF_TIME_START)'
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Box-entry offer hook scoped to an inclusion WHITELIST of ordinary-open-play phases (MOVE/PASS/LOOSE_BALL) rather than an exclusion blacklist of restart-setup phases — a blacklist is under-inclusive in a more damaging way (it lets a new cross-cutting offer hijack an already-established sport mechanic like GK_DIVE/GK_RESTART/SNAPSHOT_DEFLECT whose own resolution legitimately settles the ball inside a penalty area)'
    - 'Edge-triggered (not level-triggered) offer detection for dive-at-feet, reusing computeBoxEntryOffer'"'"'s own prevBallPosition snapshot — a pure "is the ball currently in range" function needs the caller to additionally gate on "did the ball actually move since the last broadcast", or a decline immediately re-offers on its own resume-phase broadcast'
    - 'Room.lastBroadcastBallPosition is a Room field (not GameState) updated unconditionally at the end of every broadcastState call — direct room.gameState test-state grafts (the established scenario-seeding convention throughout this test suite) must also set this field, mirroring the pre-existing ballZone pre-match convention for the identical class of broadcastState side-effect'

key-files:
  created:
    - packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts
    - packages/server/src/__tests__/gameHandlers.boxEntry.test.ts
    - packages/server/src/__tests__/gameHandlers.halfTime.test.ts
  modified:
    - packages/server/src/roomStore.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/cornerKick.integration.test.ts
    - packages/server/src/__tests__/game.integration.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17-06.test.ts
    - packages/server/src/__tests__/penaltyKick.integration.test.ts
    - packages/server/src/__tests__/shotGkRange.test.ts
    - packages/server/src/__tests__/goalKick.integration.test.ts

key-decisions:
  - "Box-entry offer gating is an inclusion whitelist (MOVE/PASS/LOOSE_BALL only), not the blacklist the plan's own Task 1 text literally described ('not a restart-setup phase') — discovered via the full pre-existing test suite (17 failures) after wiring the blacklist version: the ball settling inside a penalty area as the direct, already-established consequence of an in-progress shot/header/corner/penalty/GK-catch sequence is not itself a restart-setup phase, so the blacklist let a brand-new interrupt hijack flows that already have their own correct GK-interaction mechanic."
  - "The dive-at-feet offer additionally requires the ball's position to have changed since the last broadcast (reusing the box-entry hook's own prevBallPosition), even though the plan's Task 1 text did not specify this — computeGkDiveAtFeetOffer has no memory of a prior offer/decline, so without this gate a decline would immediately re-offer on the SAME decline response's own broadcastState call whenever the carrier stayed in range, making decline functionally unreachable from the client's perspective."
  - "GAME_HALF_TIME_START derives the team via socketTeam(socket) with no null/spectator guard, diverging from the plan's literal Task 2 instruction ('reject with WRONG_TEAM when it is null, a spectator socket') — socketTeam(socket) is typed 'home' | 'away' with no null case in this codebase (every connected socket is assigned playerSlot 1 or 2 at room join; there is no spectator slot), so the described guard was dead code that would not typecheck."

requirements-completed: [GKDIVE-01, GKDIVE-02, GKDIVE-03, GKDIVE-04, GKDIVE-05]

# Metrics
duration: ~1h45m (includes ~3min dependency install/build setup)
completed: 2026-08-14
---

# Phase 39 Plan 15: Goalkeeper Interrupt Socket Wiring & Mutual Half-Time Confirm Summary

**Wired Plan 39-12's dive-at-feet duel and Plan 39-14's box-entry response/second-half-confirm engine functions onto a single post-action offer hook in `broadcastState` plus four new/reworked socket handlers, then closed a genuine cross-mechanic hijacking bug (blacklist-vs-whitelist) and a re-offer bug (level- vs edge-triggering) surfaced by running the full 1200+-test server suite against the new wiring, before proving all three flows end to end with 19 new socket-level tests.**

## Performance

- **Duration:** ~1h45m (includes dependency install/shared-package build for a fresh worktree, and multiple full-suite runs to isolate two genuine defects from a known Windows/tinypool worker-crash flake)
- **Completed:** 2026-08-14
- **Tasks:** 3 (plus 1 post-Task-3 fix commit for a defect surfaced by repeated full-suite runs)
- **Files modified:** 11 (3 created, 8 modified — 2 core server files, 6 test files)

## Accomplishments

- `roomStore.ts`'s `broadcastState` now runs a single post-action offer-hook block immediately after the existing `applyFreeMoveZoneCheck` call: box entry (D-10) checked first, dive-at-feet (GKDIVE-02, gated on `foulsEnabled === true` per FOUL-05) checked only when box entry did not fire — at most one offer per broadcast, verified never to emit a second snapshot or recurse.
- `Room.lastBroadcastBallPosition` added so `computeBoxEntryOffer` can compare the pre-action ball position without a retroactive `eventLog` scan (the same reasoning `ball.lastTouchedBy` was introduced with in Phase 37).
- Three new socket handlers (`GAME_GK_DIVE_AT_FEET`, `GAME_GK_BOX_ENTRY_RESPONSE`, `GAME_GK_BOX_ENTRY_MOVE`) copy the canonical five-step shape (mutex → null-state guard → phase guard → payload validation → team guard against the offer's own explicit team field, not `controlsGKTeam` → engine delegate → `broadcastState`). The dive-at-feet handler rolls all four dice server-side unconditionally, even on decline, so the handler carries no rule logic.
- `GAME_HALF_TIME_START` reworked end to end (D-16): the prior single-team kick-off-team-only gate is removed entirely; the team comes from `socketTeam(socket)` only, never the payload, and `applySecondHalfConfirm` requires both teams' flags before delegating to the untouched `applyHalfTimeStart`.
- **Two genuine bugs found and fixed while wiring against the full existing test suite** (see Deviations) — a blacklist-based box-entry phase gate that hijacked shot/header/corner/penalty/GK-catch resolution phases, and a level-triggered dive-at-feet offer that made decline functionally unreachable.
- 19 new socket-level tests across three files (`gkDiveAtFeet.integration.test.ts` 8, `gameHandlers.boxEntry.test.ts` 6, `gameHandlers.halfTime.test.ts` 5) drive every flow through real `Socket.io` client emissions — no direct engine calls for the behavior under test.
- Full server suite (1241 tests across 51 files, 1 skipped, 1 todo) and full monorepo build (`pnpm build`, shared+server+client) green, confirmed across 6+ repeated runs to separate genuine failures from a known Windows/tinypool worker-crash flake (already documented in 39-14's SUMMARY.md).
- `grep -c "NOT_KICK_OFF_TEAM" packages/server/src/gameHandlers.ts` returns 0; a repo-wide grep confirms no test anywhere still asserts it.

## Task Commits

Each task was committed atomically:

1. **Task 1: Post-action offer hooks in broadcastState** - `b64e963` (feat)
2. **Task 2: The three goalkeeper handlers and the reworked half-time handler** - `4ec8786` (feat)
3. **Task 3: Integration suites for the dive-at-feet, box-entry and half-time flows** - `93494d2` (test) — includes the box-entry-whitelist and dive-at-feet-edge-trigger Rule 1 fixes to `roomStore.ts`, discovered writing this task's suites
4. **Post-Task-3 fix: allow GK_BOX_ENTRY_PROMPT as a valid goal-kick loose-ball outcome** - `3010c07` (test) — a pre-existing test's expected-outcomes list needed widening after repeated full-suite runs surfaced a real (dice-dependent, intermittent) interaction

_No plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/server/src/roomStore.ts` - `Room.lastBroadcastBallPosition` field; `GK_BOX_ENTRY_PHASES` whitelist constant; the post-action offer-hook block in `broadcastState`
- `packages/server/src/gameHandlers.ts` - `GAME_GK_DIVE_AT_FEET`, `GAME_GK_BOX_ENTRY_RESPONSE`, `GAME_GK_BOX_ENTRY_MOVE` handlers added; `GAME_HALF_TIME_START` reworked; `applyHalfTimeStart` import removed (no longer called directly), four new engine imports added
- `packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts` - 8-test GKDIVE-01..05 socket-level suite (created)
- `packages/server/src/__tests__/gameHandlers.boxEntry.test.ts` - 6-test D-10/D-11 socket-level suite (created)
- `packages/server/src/__tests__/gameHandlers.halfTime.test.ts` - 5-test D-16 socket-level suite (created)
- `packages/server/src/__tests__/cornerKick.integration.test.ts` / `game.integration.test.ts` / `gameHandlers.phase17-06.test.ts` / `penaltyKick.integration.test.ts` / `shotGkRange.test.ts` - each gained one `room.lastBroadcastBallPosition = <seeded position>` line at their existing direct `room.gameState = {...}` scenario grafts, mirroring the codebase's established `ballZone` pre-match convention, so the new box-entry offer hook does not spuriously detect a "fresh entry" from a test-state teleport
- `packages/server/src/__tests__/goalKick.integration.test.ts` - widened one pre-existing test's expected-phase list to include `GK_BOX_ENTRY_PROMPT`, a legitimate new outcome of the shared loose-ball scatter clamp landing inside a penalty area

## Decisions Made

See `key-decisions` in frontmatter — the whitelist-vs-blacklist box-entry gating decision, the edge-trigger addition to the dive-at-feet offer, and the `socketTeam` null-guard omission (dead code per this codebase's actual type contract).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Box-entry offer hook hijacked shot/header/corner/penalty/GK-catch resolution phases**

- **Found during:** Task 1, running the full pre-existing server suite (1224 tests) against the literal plan-specified blacklist ("not already one of the Phase 39 prompt phases, not a restart-setup phase, not HALF_TIME/FULL_TIME/REPLAY")
- **Issue:** 17 pre-existing tests across 8 files failed. The blacklist excluded restart-SETUP phases (`KICK_OFF_SETUP`, `GOAL_KICK_SETUP_*`, `CORNER_KICK_*`, etc.) but not the RESOLUTION phases those and other mechanics transition INTO (`GK_DIVE`, `SNAPSHOT_DEFLECT`, `GK_RESTART`, `HIGH_PASS_MOVE`, `LOOSE_BALL`) — when a shot/header/corner/penalty/GK-catch sequence's own already-established resolution legitimately settled the ball inside a penalty area, the box-entry offer fired on top of it, hijacking flows the acceptance criteria explicitly require to stay unchanged (e.g. a snapshot shot reaching `SNAPSHOT_DEFLECT`, a GK catch reaching `GK_RESTART`).
- **Fix:** Replaced the blacklist with an inclusion whitelist of exactly three genuinely "ordinary open play" phases — `MOVE`, `PASS`, `LOOSE_BALL` — the only phases where a fresh box entry is not already handled by an existing, more specific mechanic. Also fixed 5 pre-existing tests (of the 17) that used the codebase's established direct `room.gameState = {...}` scenario-seeding convention without also updating the new `room.lastBroadcastBallPosition` field, causing a stale-position false positive independent of the whitelist fix — mirrors the pre-existing `ballZone` pre-match convention already used for the analogous `applyFreeMoveZoneCheck` cross-cutting concern.
- **Files modified:** `packages/server/src/roomStore.ts`, `packages/server/src/__tests__/{shotGkRange,cornerKick.integration,game.integration,gameHandlers.phase17-06,penaltyKick.integration}.test.ts`
- **Verification:** Full server suite green (1222+ tests) after the fix; re-verified across 6+ repeated runs.
- **Committed in:** `b64e963` (Task 1 commit)

**2. [Rule 1 - Bug] Dive-at-feet offer immediately re-fired on its own decline response**

- **Found during:** Task 3, writing `gkDiveAtFeet.integration.test.ts`'s decline test — the "restores the interrupted phase" assertion failed, receiving `GK_DIVE_AT_FEET_PROMPT` again instead of `MOVE`
- **Issue:** `computeGkDiveAtFeetOffer` is a pure, level-triggered function with no memory of a prior offer or decline — it simply reports whether the carrier is CURRENTLY in range with the cap unset. Since decline does not consume the cap (by design, GKDIVE-05) and does not move the carrier, the decline response's OWN `broadcastState` call re-evaluated the SAME still-true condition and re-transitioned back to `GK_DIVE_AT_FEET_PROMPT` in the same broadcast — the manager could never actually decline and resume play without first moving the carrier out of range.
- **Fix:** Added a `ballPositionChanged` gate to the dive-at-feet check, reusing the exact `prevBallPosition` snapshot already computed for the box-entry check — the offer now only fires when the ball's position has actually changed since the last broadcast (a real qualifying move), matching `computeBoxEntryOffer`'s own edge-triggered design philosophy.
- **Files modified:** `packages/server/src/roomStore.ts`
- **Verification:** `gkDiveAtFeet.integration.test.ts`'s decline/accept/mutex tests all pass deterministically across repeated runs; full server suite unaffected (the added condition can only make the hook fire less often, never introduces new offers).
- **Committed in:** `93494d2` (Task 3 commit)

**3. [Rule 1 - Bug] GOALKICK-04/D-04 loose-ball-scatter test's expected-outcomes list needed widening**

- **Found during:** post-Task-3, running the full server suite repeatedly to separate genuine failures from a known infrastructure flake
- **Issue:** The pre-existing test asserts the goal-kick's Loose Ball drop resolves to one of `['PASS', 'THROW_IN_SETUP', 'GOAL_KICK_SETUP_GK']`, predating the D-10 box-entry offer. Because goal kicks happen at a byline immediately next to a penalty area, the shared out-of-bounds-aware scatter clamp can (on certain real, unmocked dice rolls) land the ball inside the penalty area as a genuine "first entry via loose ball" — exactly the D-10 trigger the offer hook is designed to react to, not a defect.
- **Fix:** Added `'GK_BOX_ENTRY_PROMPT'` to the test's expected-outcomes list with an explanatory comment.
- **Files modified:** `packages/server/src/__tests__/goalKick.integration.test.ts`
- **Verification:** 3+ repeated full-suite runs green after the fix (the failure is dice-dependent/intermittent, so repeated runs were required to confirm).
- **Committed in:** `3010c07` (post-Task-3 fix commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs)
**Impact on plan:** All three fixes were necessary for the plan's own acceptance criteria ("existing suites green") to hold, and none represent scope creep — each is a targeted correction to the exact cross-cutting mechanism this plan introduced, discovered by exhaustively running the pre-existing test suite (a step the plan's own acceptance criteria mandated) rather than skipped or worked around.

## Issues Encountered

- Fresh worktree had no `node_modules` and `packages/shared` had no `dist/` build output — resolved with `pnpm install --frozen-lockfile` then `pnpm --filter @counter-attack/shared build` before any typecheck/test command, consistent with every prior Phase 39 plan's worktree notes.
- A pre-existing, environment-level "Worker exited unexpectedly" (tinypool/Windows) flake — already documented in 39-14-SUMMARY.md as unrelated to code changes — occurred intermittently throughout this plan's execution (roughly 1 in 3 full-suite runs). Distinguishing it from the two genuine defects above required running the full suite 6+ times and inspecting the specific failure signature each time (an `AssertionError` with a specific test name vs. an `Unhandled Error: Worker exited unexpectedly` with a reduced total test count and no named failing test).
- `eslint --fix` (via the repo's pre-commit hook) rejected two intentionally-malformed-payload test lines (`(client as any).emit(...)`) that were missing the established `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment used at every other such call site in the test suite — added to both.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both goalkeeper interrupt mechanics (dive-at-feet, box-entry) and the mutual second-half confirm gate are now reachable end-to-end over real sockets, including every access-control failure path, cap independence (D-11), and re-offer/no-re-offer edge cases, with 19 new tests proving it.
- The whitelist-based box-entry gating (`GK_BOX_ENTRY_PHASES = {MOVE, PASS, LOOSE_BALL}`) and the edge-triggered dive-at-feet gating are now the canonical pattern for this offer hook — any future new phase that legitimately delivers the ball via "ordinary open play" (e.g. a hypothetical future mechanic) should be added to that whitelist explicitly, not assumed to work via a blacklist.
- `packages/client/src/utils/restartErrorMessage.ts` still contains a `NOT_KICK_OFF_TEAM: "It isn't your team's kick-off."` message-lookup entry, now orphaned (the server never emits this error code after this plan's D-16 rework). Harmless — not part of this plan's `files_modified` scope (client-side dead-code cleanup was not requested) — but flagged here for a future cleanup pass, e.g. alongside a `knip`-style dead-code audit.
- No blockers. Full monorepo build/test all green (server 1241 tests, 1 skipped, 1 todo, across 51 files; shared/client unaffected, both still build clean).

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_

## Self-Check: PASSED

- FOUND: `packages/server/src/roomStore.ts`
- FOUND: `packages/server/src/gameHandlers.ts`
- FOUND: `packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts`
- FOUND: `packages/server/src/__tests__/gameHandlers.boxEntry.test.ts`
- FOUND: `packages/server/src/__tests__/gameHandlers.halfTime.test.ts`
- FOUND: commit `b64e963` (feat: post-action GK offer hooks in broadcastState)
- FOUND: commit `4ec8786` (feat: GK dive-at-feet, box-entry handlers and mutual half-time confirm)
- FOUND: commit `93494d2` (test: integration suites for dive-at-feet, box-entry and half-time flows)
- FOUND: commit `3010c07` (test: allow GK_BOX_ENTRY_PROMPT as a valid goal-kick loose-ball outcome)
