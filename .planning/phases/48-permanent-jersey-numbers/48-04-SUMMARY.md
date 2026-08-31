---
phase: 48-permanent-jersey-numbers
plan: 04
subsystem: game-engine
tags: [gameEngine, applySubstitution, jersey-numbers, tdd]

# Dependency graph
requires:
  - phase: 48-permanent-jersey-numbers
    plan: 01
    provides: "number-follows-person pattern established in applyRosterReposition (Phase 48/D-05), the sibling this plan mirrors for applySubstitution"
provides:
  - "applySubstitution's incoming piece keeps the incoming player's own bench jerseyNumber instead of inheriting the vacated slot's number"
  - "applySubstitution's outgoing player's replacement bench entry carries their own number, not the incoming player's old bench number"
affects: [48-05, 48-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Number-follows-person applied to applySubstitution: `number: benchEntry.jerseyNumber` added as an explicit override in the newPiece literal (benchEntry is the INCOMING player's own bench entry, resolved earlier by inPlayerId); `jerseyNumber: outPiece.number` in the newTeamBench map replaces the previous (incorrect) `jerseyNumber: benchEntry.jerseyNumber` read of the wrong entry"

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.substitution.test.ts
    - packages/server/src/__tests__/substitution.integration.test.ts

key-decisions:
  - "The incoming piece's `number` is now an explicit override reading `benchEntry.jerseyNumber` (the incoming player's own bench entry) rather than flowing through the `...outPiece` spread — Phase 48/D-05, NUMBER-02"
  - "The outgoing player's bench entry now reads `jerseyNumber: outPiece.number` (the departing piece's own number) instead of `benchEntry.jerseyNumber` (which was actually the INCOMING player's entry — a genuine bug traced in 48-RESEARCH.md Pitfall 4)"
  - "SUB-03 docstring rewritten to drop `number` from the list of fields the substitute inherits via the `...outPiece` spread — `id`/`teamId`/`position` remain slot-bound, `number` now travels with the person"

patterns-established:
  - "Plan-level RED/GREEN pair for engine pure-function contract changes: Task 1 inverts the test assertions and lands RED (3 failing tests via negated vitest run), Task 2 implements the two-line fix and turns the suite GREEN, verified against a 4-file narrow suite and then the full 1645-test server suite before commit"

requirements-completed: [NUMBER-02]

# Metrics
duration: ~25min
completed: 2026-08-31
---

# Phase 48 Plan 04: Substitution Person-Owned Numbers Summary

**`applySubstitution` no longer launders a jersey number between the two players involved in a swap — the incoming substitute keeps their own bench number (which can legitimately be outside 1-11) and the outgoing player's new bench card shows their own number, closing the two live NUMBER-02 violations traced in 48-RESEARCH.md Pitfall 4.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-31T16:58:43Z
- **Tasks:** 2/2 completed
- **Files modified:** 3

## Accomplishments

- Rewrote the `gameEngine.substitution.test.ts` "SUB-03" number-inheritance case into two NUMBER-02 cases: one asserting the incoming piece keeps its own bench number (with a vacuous-pass guard and a `>= 15` sanity check), and a new case asserting the outgoing player's bench entry carries their own number, not the incoming player's old one
- Mirrored the fix at the integration-test level (`substitution.integration.test.ts`): the live KICK_OFF_SETUP substitution case now asserts the on-pitch slot wears the incoming player's own bench number, and the outgoing bench entry carries the outgoing player's own number
- Both test rewrites landed RED as required (3 failing assertions, all for the expected number-mismatch reason) before any engine code changed
- Added an explicit `number: benchEntry.jerseyNumber` override to `applySubstitution`'s `newPiece` literal — `benchEntry` is already in scope as the incoming player's own bench entry (resolved earlier by `inPlayerId`), so this stops `number` flowing through the `...outPiece` spread
- Changed `jerseyNumber: benchEntry.jerseyNumber` to `jerseyNumber: outPiece.number` in the `newTeamBench` map — the prior code read the INCOMING player's bench entry when building the OUTGOING player's new bench card, a genuine bug; the fix mirrors `relocateRedCardedToBench` (line ~883), which already writes the departing piece's own `number` for the red-card relocation path
- Rewrote the SUB-03 docstring above `newPiece` to drop `number` from the list of fields inherited via the `...outPiece` spread, and updated the comment above `newTeamBench` to clarify only the card SLOT is reused, not the number written into it
- Confirmed the red-card relocation path (`relocateRedCardedToBench`, lines ~660-810 of the test file) needed zero changes — it already implemented person-owned numbers correctly and served as the reference pattern for this fix

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite the substitution number assertions** - `f55687d4` (test) — landed RED as required (3 failing tests: 2 in `gameEngine.substitution.test.ts`, 1 in `substitution.integration.test.ts`)
2. **Task 2: Give the substitute their own number and the outgoing player their own bench entry number** - `d6736e3e` (feat) — turned the suite GREEN

**Plan metadata:** SUMMARY commit pending (this file)

_Note: This plan does not use `tdd="true"` frontmatter but follows a plan-level RED→GREEN structure across its two tasks, per Task 1's `<verify>` block explicitly requiring the negated vitest command to exit 0._

## Files Created/Modified

- `packages/server/src/__tests__/gameEngine.substitution.test.ts` - Renamed and rewrote the SUB-03 number-inheritance case to NUMBER-02 semantics; added a new case for the outgoing player's bench-entry number
- `packages/server/src/__tests__/substitution.integration.test.ts` - Updated the live home-substitution end-to-end case to assert person-owned numbers on both the on-pitch slot and the outgoing bench entry
- `packages/server/src/gameEngine.ts` - Added an explicit `number` override to `applySubstitution`'s `newPiece` literal; fixed the `newTeamBench` map's `jerseyNumber` to read `outPiece.number` instead of the incoming player's `benchEntry.jerseyNumber`; rewrote the SUB-03 docstring and the `newTeamBench` comment

## Decisions Made

- The incoming piece's `number` is a new explicit override (`benchEntry.jerseyNumber`) placed alongside the existing `redCarded`/`yellowCards`/`injuryCount` overrides at the end of the `newPiece` literal — Phase 48/D-05, NUMBER-02.
- The outgoing player's bench entry's `jerseyNumber` field now reads `outPiece.number` instead of `benchEntry.jerseyNumber` — the prior code was reading the wrong object (the incoming player's bench entry), which is the exact bug traced in 48-RESEARCH.md Pitfall 4.
- No signature change to `applySubstitution` — both new values are read from server-held state (`benchEntry.jerseyNumber`, `outPiece.number`), never from the socket payload, satisfying T-48-08/T-48-09 from the threat model unchanged.

## Deviations from Plan

### Auto-fixed Issues

None — the two-line fix plus docstring rewrite matched the plan's `<action>` instructions exactly.

### Acceptance-criteria grep discrepancy (documented, not a code deviation)

Task 2's acceptance criteria states `grep -c 'jerseyNumber: outPiece.number' packages/server/src/gameEngine.ts` should output `1`. The actual result is `2`: one is the new `newTeamBench` override this task adds (line ~3733), and the other is a pre-existing, unrelated field on the `substitutionEvent` `ActionEvent` literal (`jerseyNumber: outPiece.number,` at line ~3769, part of the audit-trail `SUBSTITUTION` event unchanged since Phase 40) that happens to share the identical literal text. This is a planning-time grep-target imprecision, not a code defect — the plan's own `<action>` text instructs exactly the change made, and the substantive verification (the 4-suite vitest run and the full 1645-test server suite, both green) is the ground truth. No code change was made in response to this; documenting only for auditability. All other grep-based acceptance criteria (`number: benchEntry.jerseyNumber` → 1, `jerseyNumber: benchEntry.jerseyNumber` → 0, the removed docstring phrase → no match, `jerseyNumber: piece.number` in `relocateRedCardedToBench` → 1) passed exactly as specified.

**Total deviations:** 0 code deviations. 1 documented plan/acceptance-criteria discrepancy (no code impact).
**Impact on plan:** None — behavior matches the plan's intent exactly; only a grep count in the plan's acceptance criteria over-counted due to pre-existing unrelated text.

## Issues Encountered

None beyond the acceptance-criteria discrepancy documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `applySubstitution` now correctly implements number-follows-person for the substitution path, joining `applyRosterReposition` (48-01) as the second of the phase's engine-level fixes.
- The red-card relocation path (`relocateRedCardedToBench`) required no changes and continues to serve as the reference pattern this plan's fix now matches.
- Full server suite green (1645 passed, 1 skipped, 1 todo) — no regressions introduced.
- Downstream plans in this phase (bench numbering at squad build, kickoff-striker lookup) are unaffected by and independent of this change.

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/__tests__/gameEngine.substitution.test.ts
- FOUND: packages/server/src/__tests__/substitution.integration.test.ts
- FOUND: commit f55687d4 (test)
- FOUND: commit d6736e3e (feat)

---
*Phase: 48-permanent-jersey-numbers*
*Completed: 2026-08-31*
