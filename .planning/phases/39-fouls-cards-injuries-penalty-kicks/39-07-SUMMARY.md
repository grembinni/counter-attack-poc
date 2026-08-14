---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 07
subsystem: api
tags: [typescript, gameEngine, pure-functions, vitest, tdd, penalty-kick]

# Dependency graph
requires:
  - phase: 39-01
    provides: PENALTY_KICK_SETUP_ATTACKING/DEFENDING/TAKER_SELECT/PENALTY_KICK GamePhase members, PENALTY_KICK_WINDOW_ADVANCE/TAKER_PLACED/PENALTY_KICK ActionEvent shapes, and the full penaltyKick* GameState field cluster this plan's engine functions read/write
  - phase: 39-02
    provides: the pure foul/injury/booking rule kernel (not directly consumed by this plan, but establishes the sibling PEN-01 requirement context and the injury-attribute-mutation convention this plan's applyPenaltyKickDuel comment explicitly defers to)
provides:
  - 'gameEngine.ts triggerPenaltyKick — awards a penalty, seeds the attacking reposition window, spot from PENALTY_SPOT[defendingTeam]'
  - 'gameEngine.ts computePenaltyKickEligibleIds — full-squad (no third-of-pitch filter) eligibility split by team, excludes redCarded pieces'
  - 'gameEngine.ts applyPenaltyKickReposition — unbudgeted single-step reposition with a PENALTY_AREA_RESTRICTED guard (only defending GK / chosen taker may enter the box)'
  - 'gameEngine.ts applyPenaltyKickWindowEnd — attacking->defending->taker-select two-window handoff'
  - 'gameEngine.ts applyPenaltyKickTaker — taker placement with nearest-free-hex displacement of any spot occupant'
  - 'gameEngine.ts applyPenaltyKickDuel — attacker-vs-GK duel with a flat -2 GK dice penalty; GOAL/SAVED/TIE-to-LOOSE_BALL branches'
affects: [39-10, 39-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Restart-trigger functions (triggerPenaltyKick) mirror triggerOffsideFoul's exact spread-then-override return shape"
    - 'Reposition-window functions (applyPenaltyKickReposition/WindowEnd) structurally copy their goal-kick siblings, with explicit deviation comments where PEN-02 diverges (unbudgeted, penalty-area restriction) so a future reader does not "fix" the intentional difference'
    - 'Ring-1-then-ring-2 hexNeighbors sweep for nearest-free-hex displacement (applyPenaltyKickTaker), never throwing if fully blocked'
    - "Duel resolution reuses the existing SHOT branch's GOAL/SAVE-catch transitions rather than re-deriving kick-off-reset or GK_RESTART logic"

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.penaltyKick.test.ts
  modified:
    - packages/server/src/gameEngine.ts

key-decisions:
  - "applyPenaltyKickReposition takes the phase-selected eligible list (attacking vs defending) directly, independent of the moving piece's own team relative to that list — this lets the PENALTY_AREA_RESTRICTED taker-exemption guard be exercised in isolation by hand-crafted test state even though penaltyKickTakerId is null during the real reposition windows (taker selection happens afterward)"
  - "applyPenaltyKickTaker's occupant-displacement search walks ring-1 then ring-2 (neighbours-of-neighbours) because PENALTY_SPOT sits deep enough inside the penalty area that every immediate neighbour of the spot is still inside it — ring-1-only would leave a displaced occupant permanently trapped"
  - 'applyPenaltyKickDuel clears penaltyKickSpot on every terminal branch including TIE, since the LOOSE_BALL scatter walk reads its incident hex from ball.position, not penaltyKickSpot — documented inline so a future reader does not assume it needs preserving'

requirements-completed: [PEN-01, PEN-02, PEN-03]

# Metrics
duration: ~45min (includes a mid-session resume after a usage-limit interruption; net active work is closer to 30min)
completed: 2026-08-14
---

# Phase 39 Plan 7: Penalty-Kick Phase Chain Summary

**Full penalty-kick engine chain in `gameEngine.ts` — award trigger, unbudgeted full-squad reposition with a server-enforced penalty-area restriction, taker selection with nearest-free-hex displacement, and a -2-GK-penalty duel routing to GOAL/GK_RESTART/LOOSE_BALL — specified by a 41-case engine-level test suite written RED-first.**

## Performance

- **Duration:** ~45 min elapsed (includes a mid-session interruption/resume; net active implementation work is closer to 30 min)
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Wrote `gameEngine.penaltyKick.test.ts` — 41 `it(` cases covering `triggerPenaltyKick`, `computePenaltyKickEligibleIds`, `applyPenaltyKickReposition`, `applyPenaltyKickWindowEnd`, `applyPenaltyKickTaker`, and `applyPenaltyKickDuel` — confirmed a true RED state (all six functions unresolved against `../gameEngine.js`) before any implementation existed.
- Implemented the award/eligibility/reposition/taker-selection half of the chain (Task 2), verified against a real intermediate checkpoint: 31/41 test cases passing, the remaining 10 duel-only cases failing on a missing function (matching the plan's own "duel assertions may still fail until Task 3" acceptance criterion) before committing.
- Implemented `applyPenaltyKickDuel` (Task 3) reusing the existing SHOT branch's GOAL kick-off-reset path and GK_RESTART save-catch flow rather than re-deriving either; the TIE branch defers entirely to the existing `applyRoll` LOOSE_BALL scatter, per PEN-03's "following the existing Loose Ball rules."
- Registered all four `PENALTY_KICK*` phases in `ZONE_CHECK_EXEMPT_PHASES`, both new boundary events (`PENALTY_KICK_WINDOW_ADVANCE`, `PENALTY_KICK_TAKER_PLACED`) in `applyUndo`'s `isBoundary` reduce, confirmed no new `moveTypeForPhase` mapping entry is needed (documented in a comment), and registered `PENALTY_KICK` in `REPLAY_ELIGIBLE_TYPES` while deliberately excluding the two boundary events that carry no `ballAfter`.
- Full server suite (1081 tests) and full monorepo build green after each implementation task.

## Task Commits

Each task was committed atomically, following the plan's `tdd="true"` RED→GREEN cycle for Task 1, then two further `feat` commits for Tasks 2 and 3 (Task 2/3 were implemented in one edit pass but split back into two commits by temporarily removing `applyPenaltyKickDuel` and its `REPLAY_ELIGIBLE_TYPES` entry from the working tree before the Task 2 commit, then re-adding them for Task 3 — see Deviations below):

1. **Task 1: Write gameEngine.penaltyKick.test.ts specifying the whole chain** - `b833745` (test) — RED state confirmed: all 41 cases fail to resolve `triggerPenaltyKick`/`computePenaltyKickEligibleIds`/`applyPenaltyKickReposition`/`applyPenaltyKickWindowEnd`/`applyPenaltyKickTaker`/`applyPenaltyKickDuel` against `../gameEngine.js` (none of the six functions existed yet).
2. **Task 2: Implement the penalty award, eligibility, reposition windows and taker selection** - `5ba851d` (feat) — 31/41 test cases pass at this checkpoint (duel cases fail on missing `applyPenaltyKickDuel`, matching the plan's own acceptance criterion for this task).
3. **Task 3: Implement the penalty duel with the -2 goalkeeper penalty and the tie-to-loose-ball branch** - `7890c56` (feat) — all 41 cases pass; full server suite (1081 tests) and full monorepo build green.

_No plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/server/src/__tests__/gameEngine.penaltyKick.test.ts` - 41-case Vitest suite covering every bullet in the plan's `<behavior>` block; all fixture hexes derived from `PENALTY_SPOT`, `PITCH_REGIONS`, or computed `hexNeighbors()` steps of those, per STATE.md's placeholder-coordinate pitfall
- `packages/server/src/gameEngine.ts` - `triggerPenaltyKick`, `computePenaltyKickEligibleIds`, `applyPenaltyKickReposition`, `applyPenaltyKickWindowEnd`, `applyPenaltyKickTaker`, `applyPenaltyKickDuel` added next to the existing goal-kick chain; `ZONE_CHECK_EXEMPT_PHASES`, `applyUndo`'s `isBoundary` reduce, and `REPLAY_ELIGIBLE_TYPES` extended; `hexNeighbors` and `PENALTY_SPOT` added to the shared-package import list

## Decisions Made

- `applyPenaltyKickReposition`'s eligible-list selection reads `state.penaltyKickEligibleIds.attacking` or `.defending` purely from the current phase (mirroring `applyGoalKickReposition`'s `gkTeam`/`opponent` selection), not from any additional team-consistency check against the list's semantic meaning — this keeps the function's guard shape identical to its goal-kick sibling and lets the taker-exemption branch be tested in isolation.
- `applyPenaltyKickTaker`'s spot-occupant displacement walks a ring-1-then-ring-2 `hexNeighbors` sweep rather than a wider BFS, because the plan's own contract ("walk outward one ring if all six are blocked, and if still blocked leave it in place — never throw") only requires two rings; a real occupant at `PENALTY_SPOT` in this phase's own test fixture (`{q:32,r:13}`, deep inside `awayPenaltyArea`) proved ring-1 alone is insufficient, validating the two-ring design.
- `applyPenaltyKickDuel` clears `penaltyKickSpot` on every terminal branch including TIE (the plan explicitly allowed keeping it populated through the TIE branch "if the loose-ball walk needs it") — confirmed the loose-ball walk reads its incident hex from `ball.position`, not `penaltyKickSpot`, so clearing it uniformly avoids a lingering non-null field with no consumer.

## Deviations from Plan

### Process deviations (not plan-content deviations)

**1. Tasks 2 and 3 were implemented in a single edit pass, then split back into two atomic commits by temporarily removing Task 3's content.**

- **Found during:** Task 2/3 execution — both were drafted together for implementation efficiency (they share the same file region and several helper patterns).
- **Action:** Before committing, `applyPenaltyKickDuel`, its `ApplyPenaltyKickDuelResult` type, and the `REPLAY_ELIGIBLE_TYPES` `'PENALTY_KICK'` entry were removed from the working tree, the test suite was re-run to confirm the exact 31-pass/10-fail split the plan's Task 2 acceptance criteria describes, and that intermediate state was committed as Task 2. The removed content was then restored, re-verified (all 41 pass, full suite green, full build green), and committed as Task 3.
- **Files affected:** `packages/server/src/gameEngine.ts` only (commits `5ba851d`, `7890c56`).
- **Verification:** Both intermediate and final states were run through `vitest` and `tsc`; the Task 2 checkpoint's 31/10 pass/fail split exactly matches the plan's stated acceptance criterion for that task ("duel assertions may still fail until Task 3").
- This is process discipline preserving atomic, individually-meaningful commits — not a plan-content deviation. No Rule 1-4 applies; the plan's own text was followed exactly.

**2. Mid-session interruption and resume.**

- The session was terminated mid-task by a usage limit after Task 1's test file was fully drafted but before any commits existed. On resume, `git status`/`git diff` confirmed no partial/corrupted state (the test file was untracked, `gameEngine.ts` was unmodified) — work continued from exactly where it left off with no rework needed.

**Total deviations:** 0 content deviations (Rules 1-4 not triggered). 2 process notes documented above for commit-history clarity.

## Issues Encountered

- Fresh worktree had no `node_modules` — ran `pnpm install --frozen-lockfile` once (backgrounded while continuing implementation work) before any build/test command could run, consistent with prior Phase 39 plans' worktree notes.
- Two fixture hex-adjacency errors surfaced during test authoring (a defending-piece fixture whose neighbours never reached `awayPenaltyArea`, and a taker-exemption test fixture that collided coordinates with another fixture piece) — both caught and fixed before the first test run by manually computing ODD-Q neighbour sets against the real `hexNeighbors` implementation rather than guessing coordinates.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `triggerPenaltyKick`, `applyPenaltyKickReposition`, `applyPenaltyKickWindowEnd`, `applyPenaltyKickTaker`, and `applyPenaltyKickDuel` are all exported and ready for Plan 39-10's `applyFoulChoice` "take the restart" branch to call `triggerPenaltyKick` directly for a GK-dive-at-feet foul (GKDIVE-03), and for Plan 39-11's socket handlers to wire the reposition/window-end/taker/duel functions behind `GAME_PENALTY_*` events with the standard `isProcessing` mutex + team-ownership guard shape.
- No blockers. Full monorepo build/test all green (server 1081 tests; shared/client unaffected, both still build clean).

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_
