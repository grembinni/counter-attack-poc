---
phase: 42-substitution-ux-overhaul
plan: 01
subsystem: game-engine
tags: [red-card, validators, shared-package, bug-fix, hex-grid]

requires: []
provides:
  - 'isActivePiece(piece) exported from packages/shared/src/stoppagePhases.ts'
  - 'Red-card-aware OCCUPIED/ZoI checks in moveValidator.ts'
  - 'Red-card-aware path-blocking/interceptor/destination-occupancy checks in passValidator.ts'
  - "Red-card-aware occupancy check in outOfBounds.ts's resolveThrowInHex"
  - "Red-card-aware covering-defender check in fouls.ts's isProfessionalFoul (deviation)"
affects: [42-02, 42-03, 42-04, 42-05, 42-06, 42-07, 42-08]

tech-stack:
  added: []
  patterns:
    - "isActivePiece(piece): boolean — single shared exclude-by-flag predicate for
      'is this piece eligible for gameplay computations', checking both
      piece.redCarded !== true and piece.onPitch !== false. All future
      eligibility/occupancy/ZoI/interceptor list construction in packages/shared
      must call this rather than re-deriving the check inline."

key-files:
  created: []
  modified:
    - packages/shared/src/stoppagePhases.ts
    - packages/shared/src/stoppagePhases.test.ts
    - packages/shared/src/moveValidator.ts
    - packages/shared/src/moveValidator.test.ts
    - packages/shared/src/passValidator.ts
    - packages/shared/src/passValidator.test.ts
    - packages/shared/src/outOfBounds.ts
    - packages/shared/src/outOfBounds.test.ts
    - packages/shared/src/fouls.ts
    - packages/shared/src/fouls.test.ts

key-decisions:
  - "isActivePiece's parameter type stays PlayerPiece (as locked by the plan) — in
    outOfBounds.ts's resolveThrowInHex, whose exported signature the plan forbids
    changing, the minimal `{ position: HexCoord }` piece shape is cast to
    PlayerPiece at the call site rather than widening the function's public type."
  - 'passValidator.ts: isActivePiece applied at the array-construction site
    (opponentPieces/opponents filters) for the STANDARD path-blocking check, the
    HIGH/LONG adjacent-on-path check, and the rollIntercepts ZoI-interceptor list;
    applied directly in the .find() predicate for destDefender (destination
    occupancy), since that one is not fed by a pre-filtered array.'
  - "Extended isActivePiece coverage to fouls.ts's isProfessionalFoul, which was not
    in this plan's declared file list but was caught by the plan's own whole-package
    audit grep and is explicitly within BUG-38's stated blast radius (Rule 2)."

requirements-completed: [BUG-38]

duration: ~20min
completed: 2026-08-21
---

# Phase 42 Plan 01: Shared isActivePiece Predicate Summary

**Extracted the single shared `isActivePiece` predicate BUG-38 converges on and applied it to every occupancy/ZoI/interceptor list in `packages/shared`, including one hand-written site (`fouls.ts`) the plan's own audit caught outside its declared scope.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-21T21:35:00-05:00 (approx.)
- **Completed:** 2026-08-21T21:54:10-05:00
- **Tasks:** 3 (as planned)
- **Files modified:** 10 (8 planned + 2 deviation: fouls.ts/fouls.test.ts)

## Accomplishments

- `isActivePiece(piece): boolean` exported from `stoppagePhases.ts`, checking both `redCarded !== true` and `onPitch !== false`, with a doc comment recording the D-08/D-09 rationale for checking both flags rather than either alone.
- `moveValidator.ts`'s OCCUPIED guard and ZoI opponent list (the confirmed live Pitfall 7 defect) now exclude red-carded/benched pieces — a sent-off opponent no longer blocks a destination hex or projects a Zone of Influence, while a live opponent still does both (guard narrowed, not removed).
- `passValidator.ts`'s STANDARD/HIGH/LONG path-blocking opponent lists, destination-occupancy check, and ZoI rollIntercepts list all exclude red-carded/benched pieces.
- `outOfBounds.ts`'s `resolveThrowInHex` occupancy check excludes red-carded/benched pieces — a sent-off player's frozen hex no longer blocks throw-in/goal-kick/corner-kick placement.
- Deviation: `fouls.ts`'s `isProfessionalFoul` covering-defender filter, found via this plan's own whole-package `redCarded` audit grep, replaced a hand-written `redCarded !== true` clause with `isActivePiece` — closing a second gap (`onPitch: false` exclusion) the original inline check never had.
- Full `packages/shared` test suite: 861 tests green (up from 839 baseline). `packages/server`: 1444 passed / 1 skipped / 1 todo (unchanged). `packages/client`: 1051 passed (unchanged). Shared build + full monorepo `tsc --noEmit` clean. `eslint` clean on all touched files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the shared isActivePiece predicate** - `e37f92a` (feat)
2. **Task 2: Apply isActivePiece to moveValidator's OCCUPIED check and ZoI opponent list** - `613a131` (fix)
3. **Task 3: Apply isActivePiece to passValidator and outOfBounds occupancy lists** - `d339886` (fix)

**Plan metadata:** commit pending (final SUMMARY/STATE commit is handled by the orchestrator per worktree isolation)

## Files Created/Modified

- `packages/shared/src/stoppagePhases.ts` - adds `isActivePiece(piece)` after `maxOnPitchFor`
- `packages/shared/src/stoppagePhases.test.ts` - 6-case truth table for `isActivePiece`
- `packages/shared/src/moveValidator.ts` - OCCUPIED guard (3) and ZoI opponent list (guard 6) now filter through `isActivePiece`; guard 7 comment records the deliberate non-duplication of the mover's own red-card rejection (owned by `applyMove`)
- `packages/shared/src/moveValidator.test.ts` - 5 new BUG-38 regression tests (red-carded/onPitch:false exclusion at both guards, with live-opponent parity)
- `packages/shared/src/passValidator.ts` - `isActivePiece` applied at 3 array-construction sites (STANDARD path block, HIGH/LONG path block, rollIntercepts ZoI) and 1 `.find()` predicate (destDefender)
- `packages/shared/src/passValidator.test.ts` - 7 new BUG-38 regression tests
- `packages/shared/src/outOfBounds.ts` - `resolveThrowInHex`'s occupancy predicate now calls `isActivePiece` via a `PlayerPiece` cast (signature unchanged per plan)
- `packages/shared/src/outOfBounds.test.ts` - 3 new BUG-38 regression tests
- `packages/shared/src/fouls.ts` (deviation) - `isProfessionalFoul`'s covering-defender filter now calls `isActivePiece` instead of a hand-written `redCarded !== true` clause
- `packages/shared/src/fouls.test.ts` (deviation) - 1 new regression test proving the `onPitch: false` exclusion the original inline check lacked

## Decisions Made

- **isActivePiece signature stays `(piece: PlayerPiece)`** as locked by the plan. `resolveThrowInHex` in `outOfBounds.ts` has a minimal `{ position: HexCoord }` parameter type that the plan explicitly forbids changing; rather than widening that public signature, the call site casts `p as PlayerPiece`. Every real production caller (`gameEngine.ts`) already passes full `GameState.pieces`, so the cast reflects actual runtime shape; a bare-fixture test piece lacking `redCarded`/`onPitch` reads as active (both checks are `!== true`/`!== false` against `undefined`), matching pre-existing behavior.
- **passValidator.ts predicate-narrowing shape:** for the two predicates fed by a pre-built `opponentPieces` array (STANDARD path-blocking, HIGH/LONG path-blocking) and the rollIntercepts `opponents` array, `isActivePiece` was applied at the array-construction `.filter()` site, leaving the downstream `.some()`/`getZoIDefenders` call untouched. For `destDefender`, which is built directly via `.find()` with no pre-filtered array, `isActivePiece` was added directly into that predicate.
- **Deviation (Rule 2 — missing critical functionality):** `fouls.ts`'s `isProfessionalFoul` was not in this plan's declared `files_modified` list, but the plan's own acceptance-criteria audit (`grep -rn "redCarded" packages/shared/src ...`) caught a hand-written `candidate.redCarded !== true` clause there. This is squarely within BUG-38's stated blast radius ("packages/shared — the package the previous red-card audit structurally missed") and the phase's must-have ("every packages/shared eligibility/occupancy list is built through one shared predicate"), so it was fixed in place rather than deferred. This also closed a real secondary gap: the original inline check never excluded an `onPitch: false` piece, only `redCarded`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] fouls.ts's isProfessionalFoul hand-wrote a redCarded check, missed onPitch exclusion**

- **Found during:** Task 3 (running the plan's own acceptance-criteria audit grep across all of `packages/shared/src`)
- **Issue:** `isProfessionalFoul`'s covering-defender filter used `candidate.redCarded !== true` inline instead of the new shared predicate, and did not exclude a benched (`onPitch: false`) piece at all — the exact "hand-written flag check" bug class BUG-38 exists to close, at a site outside this plan's declared file list.
- **Fix:** Imported `isActivePiece` into `fouls.ts` and replaced the inline clause; added a regression test proving an `onPitch: false` (non-`redCarded`) covering defender is now also excluded (DOGSO still applies).
- **Files modified:** `packages/shared/src/fouls.ts`, `packages/shared/src/fouls.test.ts`
- **Verification:** Full existing `fouls.test.ts` suite (63 tests, including the pre-existing red-carded regression test) plus the new test all pass; full shared/server/client suites green; monorepo typecheck clean.
- **Committed in:** `d339886` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for BUG-38's stated goal of eliminating every hand-written red-card flag check in `packages/shared`, not scope creep — the plan's own acceptance criteria directly caught this site.

## Issues Encountered

- Worktree had no `node_modules` (fresh worktree, not yet installed). Ran `pnpm install --frozen-lockfile` inside the worktree (safe: uses pnpm's content-addressable store, does not touch the main repo's `node_modules`) before any test/typecheck/build command could run. Not a plan deviation — infrastructure setup only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `isActivePiece` is now the single source of truth for red-card/bench exclusion across `packages/shared` (moveValidator, passValidator, outOfBounds, fouls, plus its own home in stoppagePhases). Every downstream plan in Phase 42 that needs the same exclusion (e.g. any `packages/server`/`packages/client` site not yet audited) can import it directly from `@counter-attack/shared`.
- No blockers. Full shared/server/client suites green, shared `dist/` rebuilt, monorepo typecheck and eslint clean.

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-21_
