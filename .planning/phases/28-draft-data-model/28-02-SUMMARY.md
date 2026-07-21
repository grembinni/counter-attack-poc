---
phase: 28-draft-data-model
plan: 02
subsystem: shared-engine
tags: [draft-engine, tier-classification, pool-derivation, vitest, typescript]

# Dependency graph
requires:
  - phase: 28-draft-data-model
    plan: 01
    provides: 'PoolPlayer.poolTag field; DraftTier type; TIER_PERCENTILE_BOUNDS/PACKS_PER_MATCH/PACK_COMPOSITION constants in types.ts'
provides:
  - 'draftEngine.ts pure module: computeTotalStat, isInPool, resolvePoolPlayers, assignTiers, TieredPoolPlayer'
  - "barrel-exported via index.ts export * from './draftEngine.js'"
  - 'draftEngine.test.ts locking pool-size (46/66/66/112) and tier-classification contract'
affects: [28-03-pack-generation, 28-04-server-crypto-binding, 29-draft-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pure-function shared module modeled on scoreUtils.ts: JSDoc header citing decision IDs, .js relative imports, no side effects, no internal RNG'
    - 'Rank-based percentile tie-break via stable Array.prototype.sort (descending totalStat) rather than value-based percentile'

key-files:
  created:
    - packages/shared/src/draftEngine.ts
    - packages/shared/src/draftEngine.test.ts
  modified:
    - packages/shared/src/index.ts

key-decisions:
  - "percentileRank formula: ((N - index) / N) * 100 over the descending-sorted outfield array, compared against TIER_PERCENTILE_BOUNDS.chase/rare/uncommon thresholds (>=90/>=80/>=60), else 'common' — matches D-05/D-06 exactly as specified in the plan"
  - "GK exclusion happens before ranking: outfield array is filtered to role !== 'GK' first, so GK stat profiles never influence the outfield percentile population (D-08)"
  - "assignTiers builds a Map<id, tier> then re-maps the ORIGINAL input array (not the sorted copy) to preserve input order/length as required by the plan's behavior contract"

requirements-completed: [DRAFT-04]

# Metrics
duration: 22min
completed: 2026-07-21
---

# Phase 28 Plan 02: Draft Engine Tier Classification Summary

**Built the pure `draftEngine.ts` module (pool derivation + total-stat + rank-based percentile tier classification) that 28-03 and 28-04 will import unchanged.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `packages/shared/src/draftEngine.ts` created as a pure module (no side effects, no `crypto`/`Math.random`), exporting `TieredPoolPlayer`, `computeTotalStat`, `isInPool`, `resolvePoolPlayers`, `assignTiers` — matching `scoreUtils.ts`'s house style exactly (JSDoc decision-ID citations, `.js` relative imports).
- `isInPool` derives `'original'` (free-agent AND no `poolTag`), `'mls'`/`'international'` (via `TEAM_CONFIGS[sourceTeamId].league`), and returns `false` for the deferred `'legends'`/`'icons'` ids — with optional chaining so `'free-agent'` (absent from `TEAM_CONFIGS`) doesn't throw.
- `resolvePoolPlayers` filters `PLAYER_POOL` once per call, preserving sequential id order (p001..p188) for downstream stable tie-breaks.
- `assignTiers` splits GK/outfield, ranks outfield descending by `computeTotalStat` via a stable sort, computes rank-based percentile `((N - index) / N) * 100`, and classifies against `TIER_PERCENTILE_BOUNDS` — GKs always get `'keeper'`; output preserves input order/length.
- `index.ts` gained `export * from './draftEngine.js';` per the barrel convention.
- `draftEngine.test.ts` (16 tests) locks the full DRAFT-04 contract: pool sizes (original=46, mls=66, international=66, union=112 with strictly ascending ids), `isInPool` direct city/canada/tagged-icon assertions, `computeTotalStat` exact-sum + jersey-number/position independence, `assignTiers` GK-exclusivity, chase/common extremes, `totalStat` consistency, and a hand-crafted D-06 tie-break case proving rank-based (not value-based) classification.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create draftEngine.ts — pool derivation, total stat, and tier classification (D-04/D-05/D-06/D-07/D-08)** - `dc4c291` (feat)
2. **Task 2: Assert DRAFT-04 classification + pool-derivation contract in draftEngine.test.ts** - `4f2d708` (test)

**Plan metadata:** commit deferred (worktree mode — orchestrator handles final metadata commit after merge)

## Files Created/Modified

- `packages/shared/src/draftEngine.ts` - New pure module: `TieredPoolPlayer` interface, `computeTotalStat`, `isInPool`, `resolvePoolPlayers`, `assignTiers`
- `packages/shared/src/index.ts` - Added `export * from './draftEngine.js';` after the Phase 23 formations export line
- `packages/shared/src/draftEngine.test.ts` - New 16-test vitest file covering pool derivation, total-stat, and tier-classification contracts

## Decisions Made

- Followed the plan's exact percentile formula, boundary comparisons, and Map-based re-mapping approach for `assignTiers` with no deviation.
- Used `PLAYER_POOL.find(...)` to locate representative city/canada/Cristiano-Ronaldo test fixtures dynamically (rather than hardcoding ids) so the test file stays robust if `teams.ts` is regenerated with reordered rows.
- Added a small `TIER_PERCENTILE_BOUNDS` sanity-check `describe` block to keep the constant's exact values (`{chase: 90, rare: 80, uncommon: 60}`) documented and regression-covered alongside the classification tests.

## Deviations from Plan

None — plan executed exactly as written. Prettier reformatted minor whitespace (line-wrap of the `sort` callback and the `draftEngine.test.ts` import line) via the pre-commit lint-staged hook; no functional change.

## Issues Encountered

- Fresh worktree had no `node_modules` (as in 28-01) — ran `pnpm install --frozen-lockfile` before `pnpm --filter @counter-attack/shared typecheck` could resolve `tsc`. No new/unverified packages were introduced; this reused the committed lockfile only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `computeTotalStat`, `isInPool`, `resolvePoolPlayers`, `assignTiers`, and `TieredPoolPlayer` are ready for 28-03 (pack generation) and 28-04 (server crypto binding) to import unchanged from `@counter-attack/shared`.
- No RNG/shuffle logic was added in this plan — 28-03/28-04 remain responsible for injecting `crypto.randomInt`-backed randomness per the project's server-authoritative dice convention.
- No blockers identified.

---

_Phase: 28-draft-data-model_
_Completed: 2026-07-21_

## Self-Check: PASSED

All created/modified files exist on disk and all task/summary commit hashes are present in git history.
