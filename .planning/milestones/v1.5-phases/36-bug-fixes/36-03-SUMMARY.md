---
phase: 36-bug-fixes
plan: 03
subsystem: api
tags: [draft-engine, typescript, vitest, shared-package, server, socket-io]

# Dependency graph
requires:
  - phase: 36-bug-fixes
    plan: 02
    provides: the matchUsedIds match-wide dedup foundation this plan's cascade/restriction builds on top of
provides:
  - Same-pool chase->rare->uncommon->common tier cascade (D-08) inside tierSupplyMeetsNeed and buildTierPoolsForRound
  - Common-tier-only cross-pool fallback restriction (D-09) inside resolveTieredCandidates
  - DRAFT_SUPPLY_EXHAUSTED process-crash guard around ROOM_SETTINGS_CONFIRM's generateMatchPacks call (T-36-07)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Round-scoped claimed Set<string> shared across a tiered round build so no card lands in two tier pools the same round'
    - 'Cascade-aware greedy counting simulation (tierSupplyMeetsNeed) mirrors the pool builder rarest-tier-first so the loop guard and the builder never disagree'
    - 'Compute-before-mutate error handling: generateMatchPacks/createDraftSession run and can throw BEFORE any room-state field is written, so a catch leaves the room in its exact pre-confirm state with no rollback code needed'

key-files:
  created: []
  modified:
    - packages/shared/src/draftEngine.ts
    - packages/shared/src/draftEngine.test.ts
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/draftPacks.test.ts

key-decisions:
  - 'tierSupplyCount deleted entirely (dead after the tierSupplyMeetsNeed rewrite) — confirmed via grep returning 0 references'
  - "buildTierPoolsForRound takes the FULL unclaimed primary-tier population as a tier's draw pool (not just the shortfall need), preserving drawFromPool's existing DEF/MID/FWD_ST bucket-cap slack; only the cascade top-up is capped to the exact shortfall"
  - 'D-09 restriction filter computes classifyTier(computeTotalStat(p)) on cross-pool fallback candidates rather than reading p.tier, since resolvePoolPlayers returns PoolPlayer[] which has no tier field'
  - 'ROOM_SETTINGS_CONFIRM computes generateMatchPacks/createDraftSession BEFORE mutating any room field, so a D-11 throw leaves room.settingsConfirmed/draftSession/teamType/draftPools completely untouched — no explicit rollback code needed, the room is simply never mutated on the failure path'
  - "Task 1's original test-suite intent (assert at-most-1 chase/rare card across rounds 5+6 for the 'original' pool) was corrected during execution: a manual supply-depletion trace showed round 5's common tier goes short by round 5 given the fixed round-processing order, forcing a full (still-unrestricted, Task-1-only) cross-pool reach that also injects extra chase/rare fodder from MLS — so that exact assertion only holds true AFTER Task 2's D-09 restriction lands. Task 1's tests were adjusted to assert only what is actually true at that point (no-throw + full packs + round-4 same-pool containment); the stronger tier-purity assertion was added as Task 2's D-12(b) test instead, where it correctly holds"

requirements-completed: [BUG-35]

# Metrics
duration: ~50min
completed: 2026-08-02
---

# Phase 36 Plan 03: Restrict and Restructure Draft-Pack Supply Fallback Summary

**Added a same-pool chase->rare->uncommon->common tier cascade to `draftEngine.ts` (D-08), restricted the cross-pool `FALLBACK_POOL_ORDER` chain to common-tier cards only (D-09), and wrapped the server's `generateMatchPacks` call site in a try/catch so a client-selectable pool combination that still exhausts supply surfaces as a `GAME_ERROR` instead of crashing the whole Node process (T-36-07).**

## Performance

- **Duration:** ~50 min (including a one-time `pnpm install` + `packages/shared` build required to get the worktree's test toolchain working — same one-time cost noted in 36-02's summary)
- **Started:** 2026-08-02 (session resumed after an interruption; prior in-progress edit to `draftEngine.ts` was verified against the plan and completed)
- **Completed:** 2026-08-02
- **Tasks:** 3/3 completed
- **Files modified:** 4

## Accomplishments

- `TIER_CASCADE_BELOW` (module-private const table) and `tierDrawOrder` (module-private helper) added to `draftEngine.ts`, documenting the never-upgrade rule: a slot may only ever be filled by its own tier or a strictly LOWER one.
- `tierSupplyMeetsNeed` rewritten as a cascade-aware greedy counting simulation (rarest-tier-first, no RNG), replacing the old per-tier-independent check. `tierSupplyCount` deleted as dead code (confirmed via `grep -c "tierSupplyCount"` returning 0 after `.ts`-comment stripping).
- `buildTierPoolsForRound` rewritten with a round-scoped `claimed: Set<string>` so a card can never land in two tier pools within the same round: each tier's pool starts with its full unclaimed primary population (chase+rare merged for `chaseOrRare`, per D-25), then tops up only the exact shortfall from each lower cascade tier in order. All shuffling still goes through the injected `rng` — no new randomness source introduced.
- `resolveTieredCandidates`'s cross-pool `fallbackPlayers` filter now additionally requires `classifyTier(computeTotalStat(p)) === 'common'` — cross-pool backfill can no longer hand a host rare/chase/uncommon cards from a non-selected pool. `resolveGkCandidates` and the "insufficient tiered supply" loud-fail throw in `generateDraftPacks` are both byte-identical to their pre-Plan-03 state (confirmed via targeted `git diff`).
- `ROOM_SETTINGS_CONFIRM` now computes `generateMatchPacks`/`createDraftSession` inside a try/catch BEFORE any room-state field is written. On catch, emits `GAME_ERROR 'DRAFT_SUPPLY_EXHAUSTED'` to the requesting socket and returns without emitting `ROOM_SETTINGS_CONFIRMED` — the room is left in its exact pre-confirm state (no rollback code needed since nothing was mutated yet). `packages/server/src/draftPacks.ts` is unmodified, preserving it as the sole RNG-binding site.
- New regression coverage: `draftEngine.test.ts` gained a `BUG-35 (Phase 36)` describe block (D-08 cascade-prevents-shortfall + round-4 same-pool containment + never-upgrade rule across all 5 selectable pools, plus D-12(a)/(b) audits and a D-11 fail-closed check) — 22 new tests, bringing the file to 67 (was 45). `draftPacks.test.ts` gained a real-crypto-RNG `BUG-35` describe block proving `['original']`'s cross-pool fallback is non-vacuously common-tier-only and `['mls']` never reaches cross-pool for rounds 2-6 — 2 new tests, bringing the file to 9 (was 7).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the same-pool tier cascade and make the supply check cascade-aware (D-08)** - `6abe9ca` (feat)
2. **Task 2: Restrict cross-pool fallback to common tier and add the D-12 audit tests (D-09, D-12)** - `10cca15` (feat)
3. **Task 3: Harden the ROOM_SETTINGS_CONFIRM call site and add real-RNG fallback assertions** - `2dbfbbf` (fix)

**Plan metadata:** committed by orchestrator after wave merge (worktree mode — this agent does not write STATE.md/ROADMAP.md).

## Files Created/Modified

- `packages/shared/src/draftEngine.ts` — `TIER_CASCADE_BELOW`/`tierDrawOrder` added; `tierSupplyMeetsNeed` rewritten cascade-aware; `tierSupplyCount` deleted; `buildTierPoolsForRound` rewritten with round-scoped `claimed` Set; `resolveTieredCandidates`'s `fallbackPlayers` filter gained the `classifyTier(computeTotalStat(p)) === 'common'` clause
- `packages/shared/src/draftEngine.test.ts` — new `BUG-35 (Phase 36)` describe block: D-08 cascade-prevents-shortfall (5 seeded tests), round-4 same-pool containment, never-upgrade rule across all `SELECTABLE_DRAFT_POOLS`, D-12(a) `['mls']` never-cross-pool (5 seeded tests), D-12(b) `['original']` common-only-and-non-vacuous (5 seeded tests), D-11 fail-closed message assertion
- `packages/server/src/roomHandlers.ts` — `ROOM_SETTINGS_CONFIRM` handler: `generateMatchPacks`/`createDraftSession` moved into a try/catch computed before any room-state mutation; catch path emits `GAME_ERROR 'DRAFT_SUPPLY_EXHAUSTED'` and returns
- `packages/server/src/__tests__/draftPacks.test.ts` — new `BUG-35 (Phase 36)` real-crypto-RNG describe block: `['original']` non-vacuous common-only cross-pool assertion, `['mls']` never-cross-pool assertion; `isInPool` imported from `@counter-attack/shared`

## Decisions Made

- `tierSupplyCount` deleted entirely rather than left as dead code, matching the CLEANUP-01 precedent cited in the plan.
- `buildTierPoolsForRound` takes each tier's FULL unclaimed primary population as its draw pool (not capped to `need`), preserving `drawFromPool`'s existing position-bucket-cap slack exactly as the algorithm contract specified; only the cascade top-up from lower tiers is capped to the precise shortfall (`need - pool.length`).
- The D-09 restriction computes tier via `classifyTier(computeTotalStat(p))` on cross-pool candidates rather than a `p.tier` property access, since `resolvePoolPlayers` returns `PoolPlayer[]` which has no `tier` field (the plan's algorithm contract flagged this as a correction to 36-PATTERNS.md's sketch).
- `ROOM_SETTINGS_CONFIRM`'s pack generation was reordered to run before any room-state field write, rather than mutating state first and rolling back on catch — this is simpler and structurally guarantees the room is untouched on failure with zero rollback code.
- **Mid-execution test-design correction (not a deviation from the plan's acceptance criteria, but worth flagging):** the plan's Task 1 action prose suggested asserting "across rounds 5+6, the number of cards classified chase or rare is at most 1" for `['original']`. A manual trace of the fixed round-processing order (round 2 → 3 → 4 → 5 → 6) against the RESEARCH.md supply table showed `['original']`'s common tier runs out entering round 5 (only 1 common card remains vs. a need of 4), which — under Task 1 alone, before D-09's restriction exists — forces the _unrestricted_ cross-pool fallback loop to pull ALL of MLS's non-GK players (not just enough commons), including MLS's own chase/rare cards. This means the "at most 1 chase/rare" assertion is actually FALSE immediately after Task 1 and only becomes true once Task 2's common-only restriction lands. Task 1's tests were corrected to assert what is verifiably true at that point in the sequence (no-throw, full 4-card packs, round-4 stays entirely within-pool); the stronger "every non-`original` card is common-tier and at least one exists" assertion was added as Task 2's D-12(b) test, where the manual trace and the actual test run both confirm it holds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Task 1's D-08 cascade test corrected to match actual system state at that point in the plan's task sequence**

- **Found during:** Task 1 (writing the BUG-35 describe block's cascade test for `['original']`)
- **Issue:** The plan's action prose for Task 1 suggested an assertion ("chase-or-rare card count across rounds 5+6 <= 1") that is only true once Task 2's D-09 common-only cross-pool restriction exists. Written literally against Task 1's code alone, the test failed (actual count was 4, not <=1) because the still-unrestricted cross-pool fallback — forced to activate by a genuine common-tier shortfall entering round 5 — also imports extra chase/rare fodder from MLS.
- **Fix:** Rewrote Task 1's test to assert what actually holds after Task 1 alone (no-throw, every round-5/6 pack still has exactly 4 cards, round 4 stays entirely same-pool). Moved the stronger "cross-pool contributes common-tier cards only, non-vacuously" assertion into Task 2's test block (D-12(b)), where it is provably true post-restriction and where the test run confirms it.
- **Files modified:** `packages/shared/src/draftEngine.test.ts`
- **Commits:** `6abe9ca` (Task 1 correction), `10cca15` (D-12(b) addition)

No other deviations — the rest of the plan (D-08 cascade table/algorithm, D-09 filter, D-11/D-12 preservation, T-36-07 guard) was implemented exactly as the algorithm contract specified.

## Issues Encountered

- This session was resumed mid-task after an interruption. On resume, the worktree had an uncommitted, partially-applied edit to `packages/shared/src/draftEngine.ts` (Task 1's cascade table + rewritten `tierSupplyMeetsNeed`/`buildTierPoolsForRound`, applied but not yet tested or committed) and no commits yet on this branch beyond the wave-1 merge base. Verified the in-progress edit against the plan's algorithm contract (matched exactly), ran `tsc --noEmit` and the full `draftEngine` test suite to confirm correctness before proceeding, then completed Task 1's test coverage and committed. No code was reverted or redone.
- The worktree's `node_modules` was missing entirely (fresh worktree) and `packages/shared`'s `dist/` build output was stale/absent, matching the exact environment-setup step documented in 36-02's summary. Resolved identically: `pnpm install` (lockfile-only, no dependency changes) and `pnpm --filter @counter-attack/shared build` (`tsc`) run before any test command, and re-run after each shared-package source edit so `packages/server`'s tests (which import `@counter-attack/shared` via its built `dist/` output) picked up the latest changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- BUG-35 fully satisfied: `pnpm --filter @counter-attack/shared test -- draftEngine` (67 tests), `pnpm --filter @counter-attack/server test -- draftPacks` (9 tests), and `pnpm --filter @counter-attack/server test -- room.integration` (17 tests) are all green.
- Full-package wave-merge gate confirmed: `pnpm --filter @counter-attack/shared test` (613 tests, was 583 baseline pre-Phase-36) and `pnpm --filter @counter-attack/server test` (637 passed, 1 skipped, 1 todo, was 627/1/1 baseline pre-Phase-36) both green, including `draftSession.test.ts`/`draftSession.integration.test.ts` — confirming this plan's cascade/restriction/guard changes did not regress the draft carousel or lineup hand-off flows built in prior phases.
- `grep -vn '^\s*[/*]' packages/shared/src/draftEngine.ts | grep -c "tierSupplyCount"` returns 0 — dead helper fully removed.
- `resolveGkCandidates` confirmed unchanged (D-10 unaffected by this plan); `packages/server/src/draftPacks.ts` confirmed unmodified (sole RNG-binding site preserved).
- No known stubs, no known threat-surface additions beyond what the plan's `<threat_model>` already registered and mitigated (T-36-05/T-36-07/T-36-08/T-36-09 all addressed per the plan's acceptance criteria).

## Self-Check: PASSED

- FOUND: `packages/shared/src/draftEngine.ts`
- FOUND: `packages/shared/src/draftEngine.test.ts`
- FOUND: `packages/server/src/roomHandlers.ts`
- FOUND: `packages/server/src/__tests__/draftPacks.test.ts`
- FOUND: `.planning/phases/36-bug-fixes/36-03-SUMMARY.md`
- FOUND: commit `6abe9ca` (Task 1)
- FOUND: commit `10cca15` (Task 2)
- FOUND: commit `2dbfbbf` (Task 3)
- FOUND: commit `9bf8b00` (SUMMARY.md)

---

_Phase: 36-bug-fixes_
_Completed: 2026-08-02_
