---
phase: 36-bug-fixes
plan: 02
subsystem: api
tags: [draft-engine, typescript, vitest, shared-package]

# Dependency graph
requires:
  - phase: 30-recalibrate-draft
    provides: the 4-tier/6-round/dedicated-GK-round generateDraftPacks engine this plan modifies
provides:
  - Match-wide (not per-round) player-id uniqueness across a full 12-pack draft match
  - matchUsedIds Set<string> threaded through generateDraftPacks' round loop and both candidate resolvers
  - Server-side structural invariant tightened from per-round to match-wide duplication check
affects: [36-03-cross-pool-tier-fallback]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Match-wide dedup id set populated only from actually-dealt cards (after packs.push), never from candidate/classified pools'

key-files:
  created: []
  modified:
    - packages/shared/src/draftEngine.ts
    - packages/shared/src/draftEngine.test.ts
    - packages/server/src/__tests__/draftPacks.test.ts

key-decisions:
  - 'matchUsedIds populated only inside generateDraftPacks, immediately after each packs.push call, in both GK and tiered branches — never inside the resolver functions, which only READ it (Pitfall 5 prevention)'
  - "resolveGkCandidates and resolveTieredCandidates widened with a fourth ReadonlySet<string> parameter; generateDraftPacks' public signature is unchanged so draftPacks.ts/draftSession.ts needed no edits"
  - "Phase 30's D-18 comment ('a card CAN reappear in a different round') removed from both the shared engine's doc comment and the server test's structural-invariant comment, replaced with BUG-34/D-06/D-07 rationale"

patterns-established: []

requirements-completed: [BUG-34]

# Metrics
duration: ~30min
completed: 2026-07-28
---

# Phase 36 Plan 02: Draft Pack Match-Wide Uniqueness Summary

**Threaded a match-wide `matchUsedIds` id set through `generateDraftPacks`' round loop and both candidate resolvers so a player can appear in at most one pack across all 6 rounds / 12 packs of a match, reversing Phase 30's D-18 per-round-only dedup.**

## Performance

- **Duration:** ~30 min (including a one-time `pnpm install` + `packages/shared` build required to get the worktree's test toolchain working)
- **Started:** 2026-07-28T12:15:00Z (approx)
- **Completed:** 2026-07-28T12:45:55Z
- **Tasks:** 2/2 completed
- **Files modified:** 3

## Accomplishments

- `generateDraftPacks` now guarantees 48 distinct player ids across every match, for every selectable pool combination, verified over both a seeded RNG (shared unit tests) and real `crypto.randomInt` (server integration tests)
- `resolveGkCandidates`/`resolveTieredCandidates` widened to accept and exclude a match-wide `ReadonlySet<string>` without ever mutating it — the set is populated exclusively inside `generateDraftPacks`, immediately after each `packs.push(...)`, from the exact cards dealt (never from undealt candidate/classified pools, per RESEARCH.md Pitfall 5)
- Phase 30's stale D-18 comment ("a card CAN reappear in a different round") retired from both the shared engine's doc comment and the server integration suite's structural-invariant comment, replaced with the D-06/D-07 rule
- Server-side `assertStructuralInvariants` tightened to assert 48 distinct ids across all 12 packs (match-wide), while retaining the pre-existing per-round no-duplicate check as a separate, explicitly-labelled D-07 assertion so a within-round-only regression is still caught precisely

## Task Commits

Each task was committed atomically:

1. **Task 1: Thread a match-wide used-id Set through generateDraftPacks and both candidate resolvers** - `17ad05c` (feat)
2. **Task 2: Tighten the server-side structural invariant from per-round to match-wide** - `7c2a758` (test)

**Plan metadata:** committed by orchestrator after wave merge (worktree mode — this agent does not write STATE.md/ROADMAP.md)

## Files Created/Modified

- `packages/shared/src/draftEngine.ts` - `matchUsedIds` local `Set<string>` declared in `generateDraftPacks`, passed to `resolveGkCandidates`/`resolveTieredCandidates` (both widened with a 4th `ReadonlySet<string>` param and additional exclusion filters), populated only after each `packs.push(...)` in both the GK and tiered branches; doc comment's D-18 sentence replaced with the D-06/D-07 rule
- `packages/shared/src/draftEngine.test.ts` - new `describe('generateDraftPacks — BUG-34 (Phase 36): match-wide uniqueness (D-06/D-07)', ...)` block: 48-distinct-id assertions across 5 seeds x 4 pool selections (`['original']`, `['mls']`, `['international']`, all pools), round-1-GK-disjoint-from-later-rounds sanity check, retained per-round zero-overlap check, and a no-throw sweep
- `packages/server/src/__tests__/draftPacks.test.ts` - `assertStructuralInvariants` now flattens every card id across all 12 packs and asserts both count and distinct-count equal `TOTAL_PACKS * 4`; the old D-18-scoped per-round-only comment removed and replaced with a BUG-34/D-06 rationale; the pre-existing per-round check kept as a separate D-07 assertion

## Decisions Made

- `matchUsedIds` is populated only inside `generateDraftPacks`, immediately after each `packs.push(...)` call, never inside `resolveGkCandidates`/`resolveTieredCandidates`/`buildTierPoolsForRound` — confirmed via `grep -n "matchUsedIds.add" packages/shared/src/draftEngine.ts` returning exactly 2 lines, both after a `packs.push`.
- Both resolver functions accept `matchUsedIds: ReadonlySet<string>` as their new final parameter (rather than restructuring the round loop itself) — minimal-diff path per CONTEXT.md's "Claude's Discretion" on exact data-structure shape.
- Server test retains the per-round check alongside the new match-wide check (not a replacement) so a future regression that broke only within-round uniqueness would still fail with a precise message, per Task 2's explicit acceptance criterion.

## Deviations from Plan

None - plan executed exactly as written. One environment-setup step was required but is not a plan deviation: this worktree had no `node_modules` and `packages/shared` had no `dist/` build output, so `pnpm install` (from the existing lockfile, no dependency changes) and `pnpm --filter @counter-attack/shared build` were run before tests could execute. Neither step touched any tracked file content.

## Issues Encountered

- The worktree's `node_modules` was missing entirely (fresh worktree, never installed) and `packages/server`'s tests import `@counter-attack/shared` via its built `dist/` output, which also didn't exist yet. Resolved by running `pnpm install` (lockfile-only, no resolution changes — `+543` packages added from the existing lockfile) and `pnpm --filter @counter-attack/shared build` (`tsc`) before running any test command. No source files were affected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUG-34 fully satisfied: `pnpm --filter @counter-attack/shared test` (591 tests) and `pnpm --filter @counter-attack/server test` (627 passed, 1 skipped, 1 todo) both green, including `draftSession.test.ts`/`draftSession.integration.test.ts` (wave-merge gate confirmed unaffected by the match-wide dedup).
- `generateDraftPacks`' public signature is unchanged — `draftPacks.ts` and `draftSession.ts` required zero edits, confirmed by full-suite green run.
- No selectable pool combination throws "insufficient supply" under match-wide dedup, including the numerically-tight `['original']`-only scenario flagged in RESEARCH.md Pitfall 4 (the existing unrestricted cross-pool backfill still absorbs the shortfall this plan's match-wide dedup creates — the same-pool tier cascade (D-08) and common-only cross-pool restriction (D-09) that would tighten this further are explicitly deferred to Plan 36-03, per this plan's stated scope boundary).
- Ready for Plan 36-03 (cross-pool/tier cascade, D-08/D-09) to build on this match-wide `matchUsedIds` foundation.

---

_Phase: 36-bug-fixes_
_Completed: 2026-07-28_
