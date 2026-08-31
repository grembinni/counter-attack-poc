---
phase: 48-permanent-jersey-numbers
plan: 06
subsystem: game-engine
tags: [gameEngine, buildSquadPieces, formations, kick-off, jersey-numbers]

# Dependency graph
requires:
  - phase: 48-permanent-jersey-numbers
    plan: 04
    provides: "substitution now keeps jersey number person-owned, removing one of the two live NUMBER-0x violations this phase closes; this plan removes the last dependency on jersey number 9 anywhere in the game engine"
provides:
  - "buildSquadPieces kick-off anchor resolved by formation slot index (slotId === 'ST') instead of PlayerPiece.number === 9"
  - "slot-keyed kick-off anchor test coverage across all four formations (4-4-2/5-3-2/4-3-3/3-4-3) and both attacking sides, where only 4-4-2 home-attacking was covered before"
  - "ST-slot existence/uniqueness locked as the load-bearing formation invariant in formations.test.ts"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Slot-based kick-off anchor: attackingSlots.findIndex(s => s.slotId === 'ST') resolves an index shared by both the FORMATIONS slot array and the 1:1-mapped squad array (attackingSquad[stSlotIndex]), avoiding a pieces.find() predicate over piece identity fields entirely"

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/formations.test.ts
    - packages/server/src/__tests__/gameEngine.phase23.test.ts

key-decisions:
  - "Anchor resolved via attackingSquad[stSlotIndex] (direct index read on the already-shift-mutated squad array), not via index arithmetic over the concatenated pieces array (stSlotIndex vs 11 + stSlotIndex) — per plan instruction, avoids an unnecessary and error-prone offset calculation"
  - "The jerseyNumber === 9 authored-data fact is kept as a separate, explicitly-labelled incidental sanity assertion in formations.test.ts, not deleted — it documents why the old and new anchor mechanisms coincide today without making it the anchor's dependency"

patterns-established: []

requirements-completed: [NUMBER-03]

# Metrics
duration: ~25min (implementation) + ~3min (worktree dependency install)
completed: 2026-08-31
---

# Phase 48 Plan 06: Slot-Keyed Kick-Off Anchor Summary

**Replaced the kick-off striker anchor's `p.number === 9` lookup in `buildSquadPieces` with a formation-slot lookup (`slotId === 'ST'`), and extended test coverage from one formation/one side to all four formations across both attacking sides.**

## Performance

- **Duration:** ~25 min implementation (plus ~3 min one-time `pnpm install` — this worktree had no `node_modules`)
- **Completed:** 2026-08-31T17:11:11Z
- **Tasks:** 2/2 completed
- **Files modified:** 3

## Accomplishments

- `formations.test.ts` Test 5 renamed to `NUMBER-03: every formation has exactly one slotId === ST slot (kick-off anchor target)`, filtering by `slotId === 'ST'` instead of `jerseyNumber === 9`, and additionally asserting the ST slot's `slotRole` is `'FWD-central'` (D-07 names both fields)
- `gameEngine.phase23.test.ts` Test 5 generalized from a single 4-4-2/home-attacking case to all 8 combinations (4 formations x 2 attacking sides), resolving the anchored piece by slot index rather than by number, and asserting the *defending* team's ST-slot occupant is explicitly NOT at the kick-off hex (proves attacking-team scoping)
- `gameEngine.phase23.test.ts` Test 6 renamed to `D-01: a starting-XI piece number comes from its formation slot, resolved by slot index` — same subject (slot-derived numbering), now resolved by slot index instead of a `p.number === 9` lookup
- Added a new case, `NUMBER-03: the anchored piece is identified by slot index, independently of the number it wears`, that never mentions the literal jersey number and proves the anchor identifies a slot *occupant* (via `playerId` matching the pool player at the same slot index), not a number
- `buildSquadPieces` in `gameEngine.ts` now resolves `kickingStriker` via `attackingSlots.findIndex(s => s.slotId === 'ST')` into `attackingSquad[stSlotIndex]`, reading from the already-shift-mutated squad array (same object references the +4 kick-off shift loop already touched) rather than the concatenated `pieces` array
- Diagnostic `console.error` and the anchor's leading comment rewritten to name the real failure mode (no ST slot found) and document D-07's positional-vs-identity rationale
- `applyRosterContinuity`'s stale docstring phrase ("the jersey-#9 anchor") corrected to "the ST-slot anchor" — no logic change

## Task Commits

Each task was committed atomically:

1. **Task 1: Move the kick-off anchor coverage from number-keyed to slot-keyed, across all four formations** - `66c4fda0` (test)
2. **Task 2: Resolve the kick-off anchor by formation slot index in buildSquadPieces** - `65332bba` (feat)

**Plan metadata:** SUMMARY commit pending (this file)

## Files Created/Modified

- `packages/server/src/__tests__/formations.test.ts` - Test 5 rewritten to filter by `slotId === 'ST'`; incidental `jerseyNumber === 9` fact kept as a labelled sanity check, not the anchor mechanism
- `packages/server/src/__tests__/gameEngine.phase23.test.ts` - Module header comment updated ("jersey-#9" → "ST-slot"); Test 5 generalized to 8 formation/side combinations; Test 6 renamed and resolved by slot index; new slot-occupant-identity test added; `getSquadPlayers` and `FormationId` imported
- `packages/server/src/gameEngine.ts` - `buildSquadPieces`'s kick-off anchor resolved by `slotId === 'ST'` slot index instead of `p.number === 9`; diagnostic message and comment rewritten; `applyRosterContinuity` docstring's stale phrase corrected

## Decisions Made

- The anchor reads from `attackingSquad[stSlotIndex]` directly (not `pieces[11 + stSlotIndex]` for away) — the plan explicitly calls this out as avoiding unnecessary and error-prone index arithmetic over the concatenated array, since `attackingSquad` already holds the same object references the +4 shift loop mutated.
- Kept the `jerseyNumber === 9` fact as its own explicitly-labelled assertion in `formations.test.ts` rather than deleting it — it's genuine authored data (every formation happens to give its ST slot jersey number 9) and documents *why* the old and new anchor mechanisms coincide today without making the new anchor depend on it.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues encountered.

### Environment setup (not a plan deviation)

This worktree had no `node_modules` at all (fresh worktree checkout) and `packages/shared` had no `dist/` build output, so `vitest`/`tsc` weren't resolvable and `@counter-attack/shared` failed to resolve as a package entry. Ran `pnpm install --frozen-lockfile` (scoped to this worktree only — did not touch the main repo's `node_modules`) and `pnpm --filter @counter-attack/shared build` before any verification command would run. Not a code deviation; no source files were affected. Recorded here per the project's documented worktree-junction-risk pattern: confirmed this was a real, missing local install rather than any junction/symlink workaround, so no shared-content risk applies.

### Acceptance-criteria grep discrepancy (documented, not a code deviation)

Task 2's acceptance criteria states `grep -c "slotId === 'ST'" packages/server/src/gameEngine.ts` should output `1`. The actual result is `3`: one is the functional `findIndex` predicate, and the other two are the plan's own mandated wording for the anchor comment ("Anchor the occupant of the attacking formation's `slotId === 'ST'` slot...") and the diagnostic `console.error` string ("no `slotId === 'ST'` slot found in attacking team=..."), both of which the plan's `<action>` text explicitly instructs to include verbatim. `grep -c` counts matching lines, and all three lines are intentional per the plan's own instructions. This is a planning-time grep-target imprecision (identical in kind to the discrepancy already documented in 48-04-SUMMARY.md), not a code defect — the substantive verification (the 5-suite vitest run, the full server suite at 1648/1/1, the full client suite at 1293, and typecheck, all green) is the ground truth. No code change was made in response to this; documenting only for auditability. All other grep-based acceptance criteria (`number === 9` → 0, `jersey-#9` → 0, ordering via `PITCH_REGIONS.kickOffHex`/`defendingFwdQ` line numbers) passed exactly as specified.

**Total deviations:** 0 code deviations. 1 environment-setup note (no code impact) + 1 documented plan/acceptance-criteria discrepancy (no code impact).
**Impact on plan:** None — behavior matches the plan's intent exactly; only a grep count in the plan's acceptance criteria under-counted because the plan itself mandates the matched phrase appear in three places (code, comment, diagnostic).

## Issues Encountered

None beyond the environment-setup and acceptance-criteria-grep items documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- No source line in the game engine selects a piece by jersey number anymore (`grep -c 'number === 9' packages/server/src/gameEngine.ts` → `0`), closing NUMBER-03 and the last of this phase's `p.number === 9`/jersey-#9-as-identity dependencies.
- Kick-off now starts with the correct player in all four formations for both home-attacking and away-attacking builds — previously only 4-4-2 home-attacking had direct test coverage.
- Full server suite green (1648 passed, 1 skipped, 1 todo) and full client suite green (1293 passed) — no regressions. Both packages typecheck clean.
- This was the final plan of Phase 48 (permanent-jersey-numbers, 6 plans across 3 waves per the phase's wave-3/depends_on:[48-04] declaration) — no further plans in this phase depend on this one.

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/__tests__/formations.test.ts
- FOUND: packages/server/src/__tests__/gameEngine.phase23.test.ts
- FOUND: commit 66c4fda0 (test)
- FOUND: commit 65332bba (feat)

---
*Phase: 48-permanent-jersey-numbers*
*Completed: 2026-08-31*
