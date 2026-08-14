---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 10
subsystem: api
tags: [typescript, gameEngine, pure-functions, vitest, tdd, fouls, cards, injury]

# Dependency graph
requires:
  - phase: 39-07
    provides: 'triggerPenaltyKick, computePenaltyKickEligibleIds and the full PENALTY_KICK_* phase chain this plan's applyFoulChoice GK_DIVE_AT_FEET restart branch calls directly'
provides:
  - 'gameEngine.ts resolveFoulChain — inline foul/injury/booking sub-resolution appended to eventLog inside applyMove STEAL_ATTEMPT/TACKLE_ATTEMPT branches, never a phase transition of its own'
  - 'gameEngine.ts triggerFoulFreeKick — FK-01 restart trigger modelled byte-for-byte on triggerOffsideFoul'
  - 'gameEngine.ts applyFoulChoice — FOUL-03 continue-or-restart resolution, routing to triggerFoulFreeKick or triggerPenaltyKick'
  - 'applyMove RED_CARDED guard rejecting any move by a redCarded piece'
  - 'gameEngine.fouls.test.ts / gameEngine.booking.test.ts / gameEngine.injury.test.ts — 40-case engine-level coverage of FOUL-01..05, CARD-01..03, INJURY-01..03, FK-01'
affects: [39-11, 39-12, 39-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Inline duel sub-resolution (resolveFoulChain) computed once per STEAL_ATTEMPT/TACKLE_ATTEMPT branch immediately after the duel event append, then folded into every one of that branch''s own would-be return objects — compute-would-be-state-first-then-override, not a separate phase transition'
    - 'foulResume snapshot pattern (mirrors freeMoveResume/gkDiveAtFeetResume) capturing exactly what the interrupted branch would have returned, so a later continue choice can restore it byte-for-byte'
    - 'Restart-trigger function (triggerFoulFreeKick) modelled byte-for-byte on triggerOffsideFoul''s spread-then-override return shape'
    - 'Flat die>=attribute comparison for injury/booking checks (rollsInjury/rollsBooking), never routed through computeCombinedScore — the inverse convention from every other duel in this codebase'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.fouls.test.ts
    - packages/server/src/__tests__/gameEngine.booking.test.ts
    - packages/server/src/__tests__/gameEngine.injury.test.ts
  modified:
    - packages/server/src/gameEngine.ts

key-decisions:
  - "injuryDie and bookingDie are fresh, independent dice from the foul-trigger die (defenderDie) — resolves 39-RESEARCH.md Assumption A1. Reusing the trigger die (fixed at FOUL_TRIGGER_DIE===1) would make both checks almost always fail their thresholds, inverting the intended balance. Recorded as a decision comment in gameEngine.fouls.test.ts and in applyMove's dice parameter JSDoc."
  - "resolveFoulChain is called once per STEAL_ATTEMPT/TACKLE_ATTEMPT branch immediately after that branch's own duel event append (before SUCCESS/FAIL is known), and its fouled/pieces/eventLog/foulFields output is threaded through a shared effectivePieces/newEventLog/fouled/foulFields variable set read at all four of applyMove's ok:true return sites (TACKLE SUCCESS, TACKLE FAIL, STEAL SUCCESS, and the shared bottom fallback covering STEAL FAIL and plain moves) — each site computes its own would-be return object first, then overrides with a FOUL_CHOICE transition when fouled, deriving foulResume from the would-be object rather than duplicating each branch's transition logic."
  - "A red-carded piece stays in state.pieces (never spliced out) with redCarded: true — applyMove gained an explicit early guard (detail RED_CARDED) rather than relying on the piece simply not existing, preserving every existing pieces.find(...) call site across the replay builder, offside evaluator and client selectors."
requirements-completed: [FOUL-01, FOUL-02, FOUL-03, FOUL-04, FOUL-05, CARD-01, CARD-02, CARD-03, INJURY-01, INJURY-02, INJURY-03, FK-01]

# Metrics
duration: ~40min
completed: 2026-08-14
---

# Phase 39 Plan 10: Foul Detection, Injury/Booking Chain & Free-Kick Trigger Summary

**A defender die of 1 on a tackle or steal now calls a foul inline inside `applyMove`, unconditionally rolling injury then booking with fresh dice before the attacker's continue-or-restart choice, and `applyFoulChoice` resolves that choice to either an exact resume or a `FREE_KICK_SETUP`/penalty-kick restart — specified by a 40-case engine-level test suite written RED-first.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- Wrote three RED-first engine suites (`gameEngine.fouls.test.ts`, `gameEngine.booking.test.ts`, `gameEngine.injury.test.ts`) — 40 `it(` cases specifying FOUL-01..05, CARD-01..03, INJURY-01..03 and FK-01, confirmed genuinely RED (`applyMove` didn't yet resolve fouls/injury/booking; `applyFoulChoice` didn't exist).
- Implemented `resolveFoulChain` as a pure, inline sub-resolution: computes `professional` via `isProfessionalFoul`, appends `FOUL_CALLED`, then — gated independently on `injuryEnabled`/`bookingEnabled` — rolls and appends `INJURY_CHECK` (mutating the victim via `applyInjuryDegradation`) and `BOOKING_CHECK` (mutating the fouler's `yellowCards`/`redCarded` via `resolveBooking`'s outcome).
- Hooked `resolveFoulChain` into both `STEAL_ATTEMPT` and `TACKLE_ATTEMPT` branches of `applyMove`, restructuring all four of the function's `ok:true` return sites (TACKLE SUCCESS/FAIL early returns, STEAL SUCCESS early return, and the shared bottom fallback covering STEAL FAIL and plain moves) to compute their own would-be state first, then override with a `FOUL_CHOICE` transition — with `foulResume` derived from that would-be state — whenever a foul was detected.
- Added an explicit `RED_CARDED` guard to `applyMove` (dismissal representation: the piece stays in `state.pieces`, never spliced out).
- Implemented `triggerFoulFreeKick` (byte-for-byte modelled on `triggerOffsideFoul`, substituting the fouler's contact hex and omitting `offsidePieceIds`) and `applyFoulChoice` (phase/choice guards, `continue` restoring `foulResume`, `restart` routing to `triggerPenaltyKick` for `GK_DIVE_AT_FEET`-sourced fouls or `triggerFoulFreeKick` otherwise).
- Registered every new event type: `'FOUL_CHOICE'` added to `ZONE_CHECK_EXEMPT_PHASES`; `'FOUL_CHOICE_MADE'` added to `applyUndo`'s `isBoundary` disjunction (phase-guarded); `FOUL_CALLED`/`INJURY_CHECK`/`BOOKING_CHECK`/`FOUL_CHOICE_MADE` explicitly and permanently excluded from `REPLAY_ELIGIBLE_TYPES` with a documenting comment (none carries `ballAfter`).
- Full server suite (1121 tests, 1 skipped, 1 todo) and full monorepo build (`pnpm build`) green after Task 3; `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically, following the plan's `tdd="true"` RED→GREEN cycle for Task 1:

1. **Task 1: Write the three failing engine suites for fouls, booking and injury** - `22f8913` (test) — RED state confirmed: 33/40 cases failed pre-Task-2 (`applyMove` didn't yet resolve fouls at all); after Task 2's checkpoint the remaining 7 failures were isolated to `applyFoulChoice is not a function`, exactly matching the plan's own "may still fail until Task 3" acceptance criterion.
2. **Task 2: Implement resolveFoulChain and hook it into both duel branches of applyMove** - `f3ee11c` (feat) — 33/40 new-suite cases pass at this checkpoint; full pre-existing `gameEngine.test.ts`/`gameEngine.phase17.test.ts` (127 tests) green, confirming non-foul duel paths unchanged.
3. **Task 3: applyFoulChoice, triggerFoulFreeKick, and undo/replay registration** - `e0a648b` (feat) — all 40 new-suite cases pass; full server suite (1121 tests) and full monorepo build green.

_No plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/server/src/__tests__/gameEngine.fouls.test.ts` - 22 `it(` cases covering FOUL-01..05 and FK-01 (die-of-1 detection on both duel types, foulsEnabled gating, event ordering, `foulResume` snapshotting on both FAIL and SUCCESS duel outcomes, `applyFoulChoice` continue/restart for all three `foulSource` values, guard rejections, and FOUL-04 reachability with both a reachable and an unreachable/pace-exhausted teammate)
- `packages/server/src/__tests__/gameEngine.booking.test.ts` - 10 `it(` cases covering CARD-01..03 (yellow/none thresholds, second-yellow-to-red upgrade, red-carded move rejection, Professional Foul's red-vs-yellow roll, the Fouls-toggle-gates-Booking rule, and booking-die independence from the foul-trigger die)
- `packages/server/src/__tests__/gameEngine.injury.test.ts` - 8 `it(` cases covering INJURY-01..03 (threshold injury, all-9-attribute degradation floored at 1 with the GK `highPass:0` exception, a second injury compounding on an already-degraded baseline while the player stays on the pitch per D-06, the Fouls-toggle-gates-Injury rule, and injury-die independence)
- `packages/server/src/gameEngine.ts` - `resolveFoulChain`, `triggerFoulFreeKick`, `applyFoulChoice` added; `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` branches restructured to thread the foul chain through all return sites; `applyMove`'s `dice` parameter extended with optional `injuryDie`/`bookingDie`; `RED_CARDED` guard added; `ZONE_CHECK_EXEMPT_PHASES`, `applyUndo`'s `isBoundary` reduce, and `REPLAY_ELIGIBLE_TYPES` extended per the registration checklist

## Decisions Made

See `key-decisions` in frontmatter — the Assumption A1 fresh-dice decision, the compute-would-be-state-then-override restructuring pattern applied at all four `applyMove` return sites, and the red-carded-piece dismissal representation (kept in `pieces`, gated by an explicit `applyMove` guard rather than removal).

## Deviations from Plan

None — plan executed exactly as written. The plan's own Task 1 acceptance criteria anticipated the intermediate RED states verified at each checkpoint (Task 1: full RED; Task 2 checkpoint: `applyFoulChoice`-only failures remaining; Task 3: full GREEN), and all three were confirmed to match exactly during execution.

**Total deviations:** 0.

## Issues Encountered

- Fresh worktree had no `node_modules` (consistent with prior Phase 39 plans) — ran `pnpm install --frozen-lockfile` once before any build/test command could run.
- `packages/shared` had no `dist/` build output yet in this worktree, causing an initial `@counter-attack/shared` resolution failure under `vitest`/`vite` — resolved by running `pnpm --filter @counter-attack/shared build` once before the first test run.
- An early booking-test fixture bug: the default `foulState()` fixture in `gameEngine.booking.test.ts` had no other away piece, which unintentionally made every foul in it a _Professional_ Foul (per `isProfessionalFoul`'s "no reachable teammate" rule), silently flipping the CARD-01/CARD-02 normal-booking assertions to CARD-03's red-vs-yellow semantics. Fixed by splitting the fixture into `foulState()` (includes a reachable `defenderCover` teammate, forcing `professional: false`, for the CARD-01/CARD-02 tests) and a separate `professionalFoulState()` (no teammate, `professional: true`, for the CARD-03 tests) — caught and fixed before the Task 1 commit via the first test run, not discovered later.
- One test-file structural edit (adding a new professional-foul describe block into `gameEngine.fouls.test.ts`) left two `it(` blocks orphaned outside any `describe(` wrapper, causing an esbuild "Unexpected `}`" parse error — caught immediately by the next test run and fixed by wrapping the orphaned block in its own `describe(...)`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `resolveFoulChain`, `triggerFoulFreeKick`, and `applyFoulChoice` are all exported and ready for a sibling plan's socket handler (`GAME_FOUL_CHOICE`) to wire behind the standard `isProcessing` mutex + team-ownership guard shape, following the pattern documented in `gameHandlers.ts`'s existing handlers.
- The GK-dive-at-feet duel (GKDIVE-01..05) is out of this plan's scope; `applyFoulChoice`'s `foulSource === 'GK_DIVE_AT_FEET'` branch is implemented and tested against a hand-crafted `FOUL_CHOICE` state, ready for whichever sibling plan implements the dive-at-feet duel itself to set `foulSource: 'GK_DIVE_AT_FEET'` via the same `resolveFoulChain` call shape (a third call site alongside the STEAL_ATTEMPT/TACKLE_ATTEMPT hooks this plan added).
- No blockers. Full monorepo build/test all green (server 1121 tests, 1 skipped, 1 todo; shared/client unaffected, both still build clean).

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_

## Self-Check: PASSED

- FOUND: `packages/server/src/__tests__/gameEngine.fouls.test.ts`
- FOUND: `packages/server/src/__tests__/gameEngine.booking.test.ts`
- FOUND: `packages/server/src/__tests__/gameEngine.injury.test.ts`
- FOUND: `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-10-SUMMARY.md`
- FOUND: commit `22f8913` (test: RED state, 40 cases)
- FOUND: commit `f3ee11c` (feat: resolveFoulChain + applyMove hook points)
- FOUND: commit `e0a648b` (feat: applyFoulChoice, triggerFoulFreeKick, undo/replay registration)
