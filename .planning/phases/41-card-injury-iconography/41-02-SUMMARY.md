---
phase: 41-card-injury-iconography
plan: 02
subsystem: api
tags: [typescript, server-authoritative-state, bench, substitutions, cards, injury]

# Dependency graph
requires:
  - phase: 40-substitutions
    provides: BenchEntry/BenchEntryStatus type, relocateRedCardedToBench, applySubstitution
provides:
  - 'BenchEntry.yellowCards and BenchEntry.injuryCount optional fields (additive)'
  - "relocateRedCardedToBench copies departing piece's card/injury state onto the redCarded bench entry"
  - "applySubstitution's subbedOut bench-entry rewrite copies the outgoing piece's card/injury state"
affects: [41-05-client-bench-card-rendering, 42-substitution-ux-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Bench-entry construction sites coalesce possibly-undefined PlayerPiece fields with `?? 0` to satisfy exactOptionalPropertyTypes while giving the client a defined value to render from'

key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.substitution.test.ts

key-decisions:
  - 'Both new BenchEntry fields are optional and additive — no existing construction site (kick-off bench seeding, test fixtures) required changes'
  - 'Values are coalesced with `?? 0` at both construction sites rather than left undefined, satisfying exactOptionalPropertyTypes and giving the client a defined value to render'

patterns-established:
  - 'Card/injury propagation onto BenchEntry is a pure copy-through of already-validated PlayerPiece values — no new derivation, event, or state field'

requirements-completed: [ICON-03]

# Metrics
duration: ~20min
completed: 2026-08-21
---

# Phase 41 Plan 02: Bench Card/Injury Data Propagation Summary

**BenchEntry gains optional yellowCards/injuryCount fields, populated at both existing bench-entry construction sites (red-card relocation and substitution) so ICON-03's bench card has data to render.**

## Performance

- **Duration:** ~20 min (including a full `pnpm install --frozen-lockfile` in this worktree, which had no `node_modules`)
- **Started:** 2026-08-21T11:30:00-05:00 (approx)
- **Completed:** 2026-08-21T11:49:26-05:00
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- `BenchEntry` (`packages/shared/src/types.ts`) now carries optional `yellowCards?: 0 | 1 | 2` and `injuryCount?: number`, mirroring `PlayerPiece`'s existing shapes so no conversion is ever needed on the client
- `relocateRedCardedToBench` copies the sent-off piece's `yellowCards`/`injuryCount` onto its red-card bench entry (coalesced to `0` when unset)
- `applySubstitution`'s `subbedOut` bench-entry rewrite copies the outgoing piece's `yellowCards`/`injuryCount` (coalesced to `0`); the incoming substitute's `PlayerPiece` remains clean per SUB-03, unchanged by this plan
- 5 new regression tests (all naming `ICON-03`) cover: field propagation on send-off, coalesced-default behaviour (never `undefined`), idempotence of `relocateRedCardedToBench` for card/injury fields, propagation on substitution with a clean incoming piece, and bench-length/sibling-entry invariance during a substitution

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend BenchEntry with yellowCards and injuryCount** - `b03dc50` (feat)
2. **Task 2: Populate the new fields at both BenchEntry construction sites** - `02d2e68` (feat, includes test coverage — TDD tests and implementation were verified together in the same edit/verify cycle before committing)

## Files Created/Modified

- `packages/shared/src/types.ts` - `BenchEntry` gains `yellowCards?: 0 | 1 | 2` and `injuryCount?: number`, both documented with a doc comment explaining provenance and the never-played/red-card-entry semantics
- `packages/server/src/gameEngine.ts` - `relocateRedCardedToBench` (~line 784) and `applySubstitution`'s bench rewrite (~line 3138) each add `yellowCards: <piece>.yellowCards ?? 0, injuryCount: <piece>.injuryCount ?? 0` to their `BenchEntry` object literal
- `packages/server/src/__tests__/gameEngine.substitution.test.ts` - extended the `D-13: red-carded player relocation to the bench` describe block with 3 new `ICON-03` cases (propagation, coalesced defaults, idempotence), extended `applySubstitution` coverage with 2 new `ICON-03` cases (subbedOut propagation with clean incoming piece, bench-length/sibling-entry invariance), and updated the existing "well-formed bench when undefined" test's expected object to include the new fields (behavior intentionally changed by this plan)

## Decisions Made

- Both fields are optional/additive so every existing `BenchEntry` construction site (kick-off bench seeding in `roomHandlers.ts`, all test fixtures) kept compiling untouched — verified via `git diff packages/shared/src/types.ts` showing only insertions
- `?? 0` coalescing used at both construction sites: required by `exactOptionalPropertyTypes` (cannot assign a possibly-`undefined` value to an optional field whose type excludes `undefined`) and gives the client a defined value to render from rather than a conditional glyph-or-nothing branch

## Deviations from Plan

None - plan executed exactly as written. The TDD `behavior`/`action` split in Task 2 was executed as a single edit-then-verify cycle (implementation and tests written together, then run to green) rather than a strict separate RED-then-GREEN commit sequence, since the task's `<action>` already fully specified both the engine changes and the test additions as one unit of work; the full server suite (1444 passed) confirms no regression.

## Issues Encountered

- This worktree had no `node_modules` at all (a fresh worktree checkout). Ran `pnpm install --frozen-lockfile` at the repo root before any verification could run — this is a lockfile-respecting install of already-declared dependencies, not a new package addition, so it is out of scope for the Rule 3 package-install exclusion. No new packages were added to any `package.json`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The bench data precondition for ICON-03 is now satisfied server-side: any subbed-off or sent-off player's card/injury state is available on their `BenchEntry` for plan 41-05's client-side `CardInjuryBadge` bench-card rendering to consume
- No further server-side work is needed for ICON-03; this was confirmed as the phase's only non-client change
- `pnpm --filter @counter-attack/shared build`, `pnpm -r typecheck`, and `pnpm --filter @counter-attack/server test` (full suite, 1444 passed / 1 skipped / 1 todo) are all green

---

_Phase: 41-card-injury-iconography_
_Completed: 2026-08-21_
