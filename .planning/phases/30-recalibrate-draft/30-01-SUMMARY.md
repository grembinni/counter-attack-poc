---
phase: 30-recalibrate-draft
plan: 01
subsystem: draft
tags: [typescript, vitest, csv-codegen, draft-tier-classification, pnpm-workspace]

# Dependency graph
requires:
  - phase: 29-draft-ui-pick-and-swap-flow
    provides: Existing DraftTier/DraftSession/draftEngine.ts contract this plan supersedes
provides:
  - Regenerated teams.ts PLAYER_POOL reflecting the finished CSV rebalance (City roster swap, 188 players)
  - 4-value DraftTier ('chase'|'rare'|'uncommon'|'common') with TIER_STAT_THRESHOLDS fixed-absolute classification
  - classifyTier(totalStat) pure classifier + simplified per-player assignTiers
  - isInPool legend/icon -> legends/icons PoolTag bridge (POOL_TAG_TO_DRAFT_POOL)
  - SELECTABLE_DRAFT_POOLS widened to all 5 pools (legends/icons enabled)
  - DRAFT_ROUNDS/RoundConfig/PackSlot 6-round config table (17 total picks) + DRAFT_ROUND_COUNT/PACKS_PER_ROUND
  - DraftSession/DraftClientView renamed cycle->round, keeper fields fully removed
  - DraftPack.round field; generateDraftPacks compiling stub (round-structured impl deferred to 30-02)
affects: [30-02-shared-pack-generation, 30-03-server-draft-session, 30-04-client-tier-colors, 30-05-server-settings-allowlist, 30-06-client-settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "classifyTier as single fixed-threshold pure function reused by assignTiers and (per RESEARCH) client fallback resolution"
    - "RoundConfig discriminated union ('gk' | 'tiered') as the single source of truth for round-scoped pack composition and pick counts"
    - "PoolTag (singular) -> DraftPoolId (plural) bridge via an explicit lookup const, not string coercion"

key-files:
  created: []
  modified:
    - packages/shared/src/data/player-pool.csv
    - packages/shared/src/teams.ts
    - packages/shared/src/types.ts
    - packages/shared/src/draftEngine.ts
    - packages/shared/src/draftEngine.test.ts
    - packages/shared/src/teams.test.ts

key-decisions:
  - "DraftTier narrowed to 4 values; 'keeper' removed entirely — GK classified by identical thresholds (D-04/D-05)"
  - "D-24 accepted as-is: 11/16 GKs classify 'common' under the fixed thresholds; test explicitly asserts this rather than forbidding it"
  - "generateDraftPacks stubbed (throws) pending round-structured rewrite in Plan 30-02; CR-01 input guard preserved"
  - "Fixed a data bug (not in original plan scope): CSV rebalance had accidentally added an 'icon' PoolTag to the untagged Cristiano Ribeiro decoy row — reverted and regenerated teams.ts"

requirements-completed: [DRAFT-04, DRAFT-11]

# Metrics
duration: ~18min active (spread across two sessions: Task 1 pre-interruption, Tasks 2-3 post-resume)
completed: 2026-07-22
---

# Phase 30 Plan 01: Shared Draft Foundation Summary

**Regenerated teams.ts from the finished CSV rebalance and rewrote the draft type/engine contract to fixed-absolute-threshold tier classification (4-value DraftTier, TIER_STAT_THRESHOLDS) with a 6-round DRAFT_ROUNDS config table and a legend/icon PoolTag bridge for Legends/Icons pools.**

## Performance

- **Duration:** ~18 min active work (Task 1 committed in an earlier session before an OAuth interruption; Tasks 2-3 completed after resume)
- **Tasks:** 3/3 completed
- **Files modified:** 6 (player-pool.csv, teams.ts, types.ts, draftEngine.ts, draftEngine.test.ts, teams.test.ts)

## Accomplishments

- `teams.ts` regenerated from the finished CSV (188 players; Alex Mățan/Carlo Holse present; João Klauss/Mykhi Joyner/Sang-bin Jeong absent; TBD City ST row untouched per D-02)
- `types.ts` draft contract rewritten: `DraftTier` narrowed to 4 values, `TIER_STAT_THRESHOLDS` replaces `TIER_PERCENTILE_BOUNDS`, `SELECTABLE_DRAFT_POOLS` widened to 5 pools, new `PackSlot`/`RoundConfig`/`DRAFT_ROUNDS` (6 entries, 17 total picks)/`DRAFT_ROUND_COUNT`/`PACKS_PER_ROUND`, `DraftSession`/`DraftClientView` renamed `cycle`->`round` with all keeper fields deleted
- `draftEngine.ts`: `classifyTier` pure fixed-threshold classifier added; `assignTiers` simplified to a per-player map (no percentile ranking, no GK/outfield split); `isInPool` extended with `POOL_TAG_TO_DRAFT_POOL` bridge for legends/icons; `DraftPack` gained a `round` field; `generateDraftPacks` replaced with a compiling stub (CR-01 guard preserved, throws pending Plan 30-02)
- `draftEngine.test.ts` rewritten: classifyTier boundary tests, per-player assignTiers tests (including the D-24 "GK can legitimately be common" acceptance test), isInPool legend/icon bridge tests; old percentile/pack-generation describe blocks removed
- Shared package fully green: `pnpm --filter @counter-attack/shared test` (570/570 passing) and `tsc --noEmit` (0 errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Finish CSV edit + regenerate teams.ts** - `0f659bd` (feat) — CSV rebalance was already committed as this worktree's base commit (`9f46be7`); this commit is the `teams.ts` regeneration
2. **Task 2: Rewrite the draft type/constant contract in types.ts** - `f5fd871` (feat)
3. **Task 3 (RED): add failing classifyTier/isInPool tests** - `fc6f301` (test)
4. **Task 3 (GREEN): implement classifyTier/assignTiers/isInPool bridge/DraftPack.round** - `a8c9ee1` (feat)
5. **Deviation fix: remove accidental icon poolTag from Cristiano Ribeiro decoy + regenerate teams.ts + update teams.test.ts** - `9de92f9` (fix)

_Note: Task 3 followed the RED/GREEN TDD cycle since draftEngine.test.ts was in its `<files>` scope; Task 2 was implemented directly and verified via the plan's own `tsc`-based verify command since it has no dedicated test file target._

## Files Created/Modified

- `packages/shared/src/data/player-pool.csv` - Fixed an accidental `icon` PoolTag on the Cristiano Ribeiro decoy row (data bug, not part of the planned rebalance)
- `packages/shared/src/teams.ts` - Regenerated PLAYER_POOL from the finished CSV (188 players)
- `packages/shared/src/types.ts` - New draft type/constant contract (DraftTier, TIER_STAT_THRESHOLDS, DRAFT_ROUNDS, round-aware DraftSession/DraftClientView)
- `packages/shared/src/draftEngine.ts` - classifyTier, simplified assignTiers, isInPool bridge, DraftPack.round, generateDraftPacks stub
- `packages/shared/src/draftEngine.test.ts` - Rewritten test suite for the new classification model
- `packages/shared/src/teams.test.ts` - Updated stale pool-derivation/poolTag-count assertions to match the finished (bug-fixed) CSV data

## Decisions Made

- DraftTier is a pure per-player fixed-threshold classification (D-03/D-04) — no session-relative ranking, no reserved GK tier value (D-05)
- D-24 accepted explicitly: some GKs land in 'common' tier under the identical thresholds; this is documented as a positive test assertion, not something to "fix" by rebalancing GK stats or special-casing GK classification
- `generateDraftPacks` is intentionally left as a throwing stub in this plan — the round-structured dealing algorithm is Plan 30-02's responsibility; this plan only needed the shared package to typecheck and its own tests to pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed accidental `icon` PoolTag from the Cristiano Ribeiro decoy player**

- **Found during:** Task 3 (verifying "shared package test suite is green" while running the full `pnpm --filter @counter-attack/shared test` suite, not just `draftEngine`)
- **Issue:** `teams.test.ts` has a pre-existing, intentional test (`'decoys Neymar Andre and Cristiano Ribeiro stay untagged'`) asserting Cristiano Ribeiro is a deliberately untagged same-firstname decoy for the icon-tagged Cristiano Ronaldo. The Task 1 base-commit CSV rebalance (`9f46be7`, pre-staged before this plan started) had added an `icon` PoolTag to Ribeiro's row with stats otherwise unchanged from the pre-rebalance CSV — no CONTEXT.md decision (D-01 through D-25) authorizes this change, and it broke the decoy design plus two other pre-existing count assertions (`'original' pool derivation` and `'exactly 10 players have a defined poolTag'`).
- **Fix:** Reverted the PoolTag column on the Ribeiro row to blank, re-ran `pnpm --filter @counter-attack/shared run seed:rosters` to regenerate `teams.ts`, and updated the two dependent `teams.test.ts` assertions to the corrected finished-data counts (`'original'` pool: 38 players; total tagged: 18 — 10 legend, 8 icon, reflecting the phase's intentional DRAFT-11 pool-supply expansion beyond the pre-Phase-30 5+5 baseline).
- **Files modified:** `packages/shared/src/data/player-pool.csv`, `packages/shared/src/teams.ts`, `packages/shared/src/teams.test.ts`
- **Verification:** Full `pnpm --filter @counter-attack/shared test` suite green (570/570); `tsc --noEmit` 0 errors; roster-swap/188-count/TBD-row acceptance criteria from Task 1 re-verified after the second regeneration
- **Committed in:** `9de92f9`

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary to satisfy the plan's own "shared package test suite is green" success criterion. No scope creep — the fix is a targeted one-row CSV correction plus two dependent test-count updates, not a broader stat rebalance.

## Issues Encountered

- Worktree had no `node_modules` at session start (`tsx: command not found`) — resolved with a standard `pnpm install --frozen-lockfile` at the repo root (reused 429/429 packages from the local pnpm content-addressable store, no downloads, no manual directory-junction workaround).
- Session was interrupted by an OAuth error after Task 1's commit; resumed cleanly from Task 2 per the coordinator's structured continuation message, re-reading the plan file first to confirm task boundaries before proceeding.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The shared package's draft type/engine contract (Wave 1 interface) is complete and green: `DraftTier`, `TIER_STAT_THRESHOLDS`, `DRAFT_ROUNDS`, `classifyTier`, `assignTiers`, `isInPool` legend/icon bridge, `DraftPack.round`.
- Wave 2 plans (30-02 shared pack generation, 30-03 server draft session, 30-04 client tier colors) can now build directly against this contract.
- **Known intentional gap:** `generateDraftPacks` throws (`'generateDraftPacks: round-structured implementation lands in 30-02'`) — this is expected per the plan's own verification note ("server and client packages do NOT yet typecheck against the narrowed contract... resolved by Wave 2 plans"). Plan 30-02 must implement the round-structured dealing algorithm before `server`/`client` packages can typecheck against this plan's changes.

---

_Phase: 30-recalibrate-draft_
_Completed: 2026-07-22_

## Self-Check: PASSED

All created/modified files verified present on disk; all 6 referenced commit hashes
(0f659bd, f5fd871, fc6f301, a8c9ee1, 9de92f9, 3b93ff6) verified present in `git log`.
