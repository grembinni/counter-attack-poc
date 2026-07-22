---
phase: 28-draft-data-model
plan: 04
subsystem: api
tags: [draft-engine, crypto, csprng, server, vitest, typescript]

# Dependency graph
requires:
  - phase: 28-draft-data-model
    plan: 03
    provides: 'generateDraftPacks(selectedPools, rng) — RNG-agnostic pure batch pack generator; RandomIntFn type mirroring crypto.randomInt exactly'
provides:
  - 'generateMatchPacks(selectedPools) — server-authoritative, crypto.randomInt-backed pack generator (packages/server/src/draftPacks.ts)'
  - 'End-to-end integration test proving structural invariants (composition, keeper-role, no-cross-pack-duplication) hold under real crypto RNG'
affects: [29-draft-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'RNG binding at the server boundary: shared engine stays randomness-agnostic (client-safe); server module is the single place `crypto.randomInt` is injected, matching the diceUtils.ts/gameEngine.ts convention'
    - 'Structural-invariant integration testing over real (non-seeded) CSPRNG: assert composition/role/uniqueness invariants across N iterations instead of exact output, since crypto.randomInt cannot be seeded for determinism'

key-files:
  created:
    - packages/server/src/draftPacks.ts
    - packages/server/src/__tests__/draftPacks.test.ts
  modified: []

key-decisions:
  - 'generateMatchPacks is a pure one-line delegation: return generateDraftPacks(selectedPools, randomInt) — no adapter/wrapper needed since RandomIntFn was designed in 28-03 to mirror crypto.randomInt(min, max) exactly'
  - 'No socket wiring, room-state mutation, or persistence added — Phase 29 (ROOM_SETTINGS_CONFIRM handler) owns triggering generateMatchPacks(room.draftPools); this plan only had to expose the correct callable entry point'

patterns-established:
  - 'Server-side RNG binding module pattern: a thin file that imports crypto.randomInt and passes it directly into a shared, RNG-agnostic pure function — reusable template for any future shared engine needing a CSPRNG'

requirements-completed: [DRAFT-04, DRAFT-05]

# Metrics
duration: 15min
completed: 2026-07-21
---

# Phase 28 Plan 04: Server Crypto Binding for Draft Packs Summary

**`packages/server/src/draftPacks.ts` binds Node's `crypto.randomInt` into the shared `generateDraftPacks` engine via `generateMatchPacks(selectedPools)`, with an integration test proving 8/7/1-1-1-3-1/no-duplication invariants hold across repeated real-CSPRNG runs.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both new)

## Accomplishments

- `generateMatchPacks(selectedPools: DraftPoolId[])` created as the single server-authoritative pack-generation entry point, delegating directly to `generateDraftPacks(selectedPools, randomInt)` with Node's `crypto.randomInt` passed straight through (no adapter — the `RandomIntFn` contract from 28-03 was designed to match `crypto.randomInt(min, max)` exactly).
- Module JSDoc follows the `diceUtils.ts`/`gameEngine.ts` convention, documenting the fairness rule (CSPRNG only, never client-supplied) and citing DRAFT-04/DRAFT-05 and threat T-28-04-FAIR.
- `packages/server/src/__tests__/draftPacks.test.ts` added: 3 tests exercising `generateMatchPacks` (the real crypto path, not `generateDraftPacks` with a fake RNG) across 5 iterations each for `['original']` and `['original','mls','international']`, asserting: 8 packs, 7 cards per pack, exact `PACK_COMPOSITION` tier counts per pack, every keeper-slot card has `role === 'GK'` (and no non-keeper card does), every card's `tier` is a valid `DraftTier`, every dealt card id exists in the returned `pool`, and the union of all 8×7 card ids across a run has no duplicates. A third test loops over every `SELECTABLE_DRAFT_POOLS` single-pool id and asserts `generateMatchPacks` does not throw.
- Verified `packages/server/src/draftPacks.ts` contains zero `Math.random` occurrences (grep gate) and imports `randomInt` from `'crypto'`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create draftPacks.ts — server-authoritative crypto.randomInt-backed generateMatchPacks (D-09..D-12, threat mitigation)** - `8351a6a` (feat)
2. **Task 2: Integration test — end-to-end pack invariants over real crypto RNG (DRAFT-04/DRAFT-05)** - `b91d395` (test)

**Plan metadata:** commit deferred (worktree mode — orchestrator handles final metadata commit after merge)

## Files Created/Modified

- `packages/server/src/draftPacks.ts` - New module: `generateMatchPacks(selectedPools)`, binding `crypto.randomInt` into `generateDraftPacks`
- `packages/server/src/__tests__/draftPacks.test.ts` - New integration test asserting end-to-end structural invariants over real crypto RNG

## Decisions Made

- Kept `generateMatchPacks` to a pure one-line delegation body, per the plan's explicit instruction not to add a wrapper/adapter since Node's `randomInt(min, max)` contract (min-inclusive, max-exclusive) matches the injected `RandomIntFn` type exactly.
- Test asserts `tierCounts` via `expect(tierCounts).toEqual(PACK_COMPOSITION)` (a full object-equality check) rather than five separate per-tier assertions — equivalent coverage, less repetition, and it directly ties the assertion to the same constant `draftEngine.ts` consumes internally, so the test would break if pack composition constants ever changed even without a corresponding test update oversight.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-4 auto-fixes were needed; both tasks passed their verification commands on the first attempt.

## Issues Encountered

- Fresh worktree had no `node_modules` (same pattern as 28-01/28-02/28-03) — ran `pnpm install --frozen-lockfile` before `build`/`typecheck`/`test` could run. No new or unverified packages introduced; reused the committed lockfile only (Node's `crypto` module is a built-in, no package install required).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `generateMatchPacks(selectedPools: DraftPoolId[])` is ready for Phase 29's `ROOM_SETTINGS_CONFIRM` handler to call directly as `generateMatchPacks(room.draftPools)` once per match after `teamType: 'draft'` is locked in — no further engine work needed on the generation side.
- Phase 28 (draft-data-model) is now fully complete: all 4 waves done (poolTag/type constants + pack-generation constants, tier classification, pack generation with backfill, server crypto binding).
- **Flag for phase verification:** `.planning/REQUIREMENTS.md` already marks `DRAFT-04` and `DRAFT-05` as `[x]` complete in the checklist, and the traceability table (lines 86-87) lists both as `Complete` — but the table's **Phase** column says `Phase 29` for both rows, not `Phase 28`. Git history (`d585668 docs(28-01): complete draft-data-model foundation plan`) shows these were marked complete during Plan 28-01, before tier classification (28-02), pack generation (28-03), or this crypto-binding plan (28-04) existed. This is a pre-existing labeling artifact (out of scope for this plan's changes — no plan-04 file caused it) and is called out here per this plan's explicit instruction to flag DRAFT-04/DRAFT-05 status for phase verification. Recommend the phase verifier or orchestrator correct the traceability table's Phase column from `Phase 29` to `Phase 28` for these two rows during the final metadata pass.
- No blockers identified.

---

_Phase: 28-draft-data-model_
_Completed: 2026-07-21_

## Self-Check: PASSED

All modified files exist on disk and both task commit hashes (`8351a6a`, `b91d395`) are present in git history.
