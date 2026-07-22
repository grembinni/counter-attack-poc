---
phase: 28-draft-data-model
plan: 03
subsystem: shared-engine
tags: [draft-engine, pack-generation, backfill, fisher-yates, vitest, typescript]

# Dependency graph
requires:
  - phase: 28-draft-data-model
    plan: 02
    provides: 'draftEngine.ts pure module: TieredPoolPlayer, computeTotalStat, isInPool, resolvePoolPlayers, assignTiers'
  - phase: 28-draft-data-model
    plan: 01
    provides: 'PACKS_PER_MATCH, PACK_COMPOSITION, DraftTier, SELECTABLE_DRAFT_POOLS constants in types.ts'
provides:
  - 'generateDraftPacks(selectedPools, rng) batch pack generator with D-12 backfill and D-09 no-duplication dealing'
  - 'RandomIntFn type (mirrors crypto.randomInt signature) — the exact injection point 28-04 binds crypto.randomInt into'
  - 'DraftPack interface and internal Fisher-Yates shuffle helper'
  - 'draftEngine.test.ts DRAFT-05 composition/no-dup/backfill-order/determinism test block (21 tests total, 15 new)'
affects: [28-04-server-crypto-binding, 29-draft-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Injected-RNG pure function: generateDraftPacks never imports crypto/Math.random — all randomness arrives via the RandomIntFn parameter (min-inclusive/max-exclusive, mirrors Node crypto.randomInt exactly)'
    - 'Iterative backfill loop that fully reclassifies the growing union via assignTiers each iteration, so tier percentiles stay correct as backfill players are added (D-05 compliance)'
    - 'Per-tier shuffle-then-cursor dealing with a modulo wrap-around as a dormant last-resort duplication exception (only reachable if every fallback pool is exhausted)'

key-files:
  created: []
  modified:
    - packages/shared/src/draftEngine.ts
    - packages/shared/src/draftEngine.test.ts

key-decisions:
  - "Backfill draw-kind selection follows the plan's exact rule: when only keeper is short, only draw a GK from the current fallback pool (skip to the next pool if it has no un-included GK, even if it has spare outfield players); when only outfield is short, only draw outfield; when both are short, prefer GK if the current pool can supply one, else outfield from that same pool"
  - 'Backfill re-classifies the ENTIRE union (assignTiers on all players so far) on every iteration rather than tracking incremental counts, so a newly-added player can land in whichever tier the recomputed percentiles put it — matches the plan note that per-tier chase/rare needs (not the illustrative aggregate outfield figure) are the actual binding backfill target'
  - 'Dealing order within a pack is chase, rare, uncommon, common (x3), keeper — stable and deterministic, no functional significance to the order itself'

requirements-completed: [DRAFT-05]

# Metrics
duration: 25min
completed: 2026-07-21
---

# Phase 28 Plan 03: Draft Engine Pack Generation Summary

**Extended `draftEngine.ts` with `generateDraftPacks` — a fully RNG-injected batch pack generator that produces all 8 match packs with D-12 pool-shortage backfill (Original -> MLS -> International) and D-09 no-cross-pack-duplication dealing.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both existing from 28-02, no new files)

## Accomplishments

- `RandomIntFn` type added — `(minInclusive: number, maxExclusive: number) => number`, documented as mirroring Node's `crypto.randomInt(min, max)` exactly so 28-04 can pass the real `crypto.randomInt` straight through with zero adapter code.
- `DraftPack` interface (`{ packNumber, cards }`) and an internal non-exported, non-mutating Fisher-Yates `shuffle<T>` helper (uses `rng(0, i + 1)` per swap) added.
- `generateDraftPacks(selectedPools, rng)` implemented in the plan's exact 7-stage sequence: resolve selected union -> compute active fallback order (Original -> MLS -> International minus already-selected pools) -> compute per-tier need counts (`PACKS_PER_MATCH * PACK_COMPOSITION[tier]`) -> iterative backfill loop (reclassifies the whole union via `assignTiers` each pass, draws one player at a time from the first fallback pool that can supply the currently-needed kind — GK preferred when both keeper and outfield are short) -> final `assignTiers` classification -> per-tier shuffle + cursor-based dealing (no reuse; modulo wrap-around only as a dormant last resort if a fallback pool set is fully exhausted) -> return `{ pool, packs }`.
- Verified `draftEngine.ts` remains completely free of `crypto`/`Math.random` — even doc-comment references to those tokens were reworded (e.g. "Math.random" -> "built-in RNG import") so the literal-text `grep` gate (`grep -cE "from 'crypto'|Math\.random"`) returns `0`. This gate is intentionally naive (matches comments too), so wording had to avoid the literal substrings, not just avoid functional usage.
- `draftEngine.test.ts` gained 4 new `describe` blocks (15 new tests, 21 total in the file) covering: pack count/composition/keeper-role invariants; all-pools no-cross-pack-duplication; original-only and mls-only backfill-order assertions (zero international cards in either case, non-free-agent keepers present, backfill league present); and determinism (two identically-seeded runs produce deep-equal `packs`). A tiny `mulberry32`-style seeded PRNG (test-only) implements the `RandomIntFn` contract.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend draftEngine.ts with generateDraftPacks — backfill + composition dealing (D-09/D-10/D-11/D-12)** - `ba7eebc` (feat)
2. **Task 2: Assert DRAFT-05 composition, backfill order, and determinism in draftEngine.test.ts** - `6fc1e1e` (test)

**Plan metadata:** commit deferred (worktree mode — orchestrator handles final metadata commit after merge)

## Files Created/Modified

- `packages/shared/src/draftEngine.ts` - Added `RandomIntFn`, `DraftPack`, internal `shuffle`, `FALLBACK_POOL_ORDER`, `OUTFIELD_TIERS`, and `generateDraftPacks` (backfill + dealing implementation)
- `packages/shared/src/draftEngine.test.ts` - Added `generateDraftPacks` import, seeded-PRNG test helper, and 4 new `describe` blocks (composition, no-duplication, backfill-order, determinism)

## Decisions Made

- Followed the plan's draw-kind selection rule literally rather than a simplified "always prefer whatever's short" heuristic — this matters for the mls-only fallback-order test (backfill must draw from Original first per the constant fallback order, and must not skip ahead to International while Original can still supply the needed kind).
- Reworded two JSDoc comments that originally referenced "Math.random" as literal text, since the plan's verification gate (`grep -cE "from 'crypto'|Math\.random"`) is a raw text match and does not distinguish code from comments — this is a Rule 1 (auto-fix bug) style correction caught by running the verification command before committing, not a deviation from the plan's intent.
- Used a `for (;;) { ... break; }` explicit-exit backfill loop instead of a `while` condition, since the exit condition (needs met OR no draw happened this pass) is naturally checked mid-body after the reclassification step, matching the plan's described algorithm shape most directly.

## Deviations from Plan

**1. [Rule 1 - Bug] Removed literal "Math.random"/"crypto" substrings from doc comments that tripped the verification grep gate**

- **Found during:** Task 1, running the `<verify>` command before committing
- **Issue:** The plan's verify step is `grep -cE "from 'crypto'|Math\.random" packages/shared/src/draftEngine.ts` returning `0`. Two JSDoc comments (the module header and the `RandomIntFn` doc block) referenced "crypto/Math.random" and "`crypto`/`Math.random`" purely as prose describing what the module avoids — but the grep pattern matches raw text regardless of comment vs. code, so these doc comments caused a false-positive gate failure.
- **Fix:** Reworded both comments to convey the same meaning without the literal substrings (e.g. "no internal RNG source" / "no built-in RNG import here") — no functional or documentation-intent change.
- **Files modified:** `packages/shared/src/draftEngine.ts`
- **Commit:** `ba7eebc`

## Issues Encountered

- Fresh worktree had no `node_modules` (same as 28-01/28-02) — ran `pnpm install --frozen-lockfile` before `typecheck`/`test` could run. No new or unverified packages introduced; reused the committed lockfile only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `generateDraftPacks`, `DraftPack`, and `RandomIntFn` are ready for 28-04 to import unchanged and bind `crypto.randomInt` server-side (the `RandomIntFn` signature was designed to match `crypto.randomInt(min, max)` exactly, so no adapter function is needed).
- `pool` (the full tiered union, including any backfill players) is also returned from `generateDraftPacks` alongside `packs`, in case 28-04 or Phase 29 needs the classified population separately from the dealt packs.
- No blockers identified.

---

_Phase: 28-draft-data-model_
_Completed: 2026-07-21_

## Self-Check: PASSED

All modified files exist on disk and both task commit hashes (`ba7eebc`, `6fc1e1e`) are present in git history.
