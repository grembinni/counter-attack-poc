---
phase: 28-draft-data-model
verified: 2026-07-21T13:00:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
---

# Phase 28: Draft Data Model Verification Report

**Phase Goal:** The player pool is classified into configurable rarity tiers by total stat count, and the pack generation engine produces correctly-composed 7-card packs from the selected pool using configurable constants.
**Verified:** 2026-07-21T13:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                           | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Every player in the pool is assigned a tier (Keeper/Chase/Rare/Uncommon/Common) using configurable percentage thresholds                                        | VERIFIED | Live execution: `assignTiers(PLAYER_POOL)` on the full 188-player pool produces 188 tiered entries, 0 missing tiers, 0 GKs with an outfield tier, 0 non-GKs with `'keeper'`. Tier boundaries read from `TIER_PERCENTILE_BOUNDS` (`{chase:90, rare:80, uncommon:60}`) in `types.ts`, imported (not hardcoded) into `draftEngine.ts` `assignTiers` (packages/shared/src/draftEngine.ts:108-146).                                                                                                                                                                                                                                                                                                           |
| 2   | A 7-card pack generated from the selected pool contains the correct per-rarity composition (default 1/1/1/3/1)                                                  | VERIFIED | Live execution: `generateDraftPacks(['original','mls','international'], randomInt)` returns 8 packs, each with 7 cards; pack 0 tiers observed as `[chase, rare, uncommon, common, common, common, keeper]` — matches `PACK_COMPOSITION`. Server integration test `packages/server/src/__tests__/draftPacks.test.ts` asserts `tierCounts` equals `PACK_COMPOSITION` exactly for every pack, across 5 iterations, for `['original']`, `['original','mls','international']`, `['mls']`, and `['international']` (tightest-supply single pools) — 5/5 tests pass independently re-run. No cross-pack duplication observed (56/56 unique ids for the all-pools case; live-executed, not merely test-claimed). |
| 3   | All tier-boundary percentages and pack composition counts are exported configurable constants — changing a constant alone adjusts behavior with no code changes | VERIFIED | `DraftTier`, `TIER_PERCENTILE_BOUNDS`, `PACKS_PER_MATCH`, `PACK_COMPOSITION` are exported `const`/`type` declarations in `packages/shared/src/types.ts:474-501`. `draftEngine.ts` contains **zero** hardcoded numeric literals for pack size/percentile math — `grep` for `90                                                                                                                                                                                                                                                                                                                                                                                                                            | 80  | 60  | PACKS_PER_MATCH | 8\b | 7\b` in code (excluding comments) shows every occurrence is either the imported symbol name or a doc-comment reference; all runtime math (`keeperNeed`, `need[tier]`, the dealing loop bound, the percentile comparisons) reads `PACKS_PER_MATCH`, `PACK_COMPOSITION[tier]`, and `TIER_PERCENTILE_BOUNDS.\*` directly from the imported constants (packages/shared/src/draftEngine.ts:120-130, 249-255, 383). |

**Score:** 3/3 truths verified

### Required Artifacts

| Artifact                                           | Expected                                                                                                                         | Status   | Details                                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/types.ts`                     | `DraftTier`, `TIER_PERCENTILE_BOUNDS`, `PACKS_PER_MATCH`, `PACK_COMPOSITION` exported                                            | VERIFIED | All four symbols present, values match plan spec exactly (chase:90/rare:80/uncommon:60; 8; 1/1/1/3/1)                                                                |
| `packages/shared/src/teams.ts`                     | Regenerated `PoolPlayer.poolTag` field, 10 tagged free agents                                                                    | VERIFIED | Confirmed by 28-01-SUMMARY.md + teams.test.ts (8 new tests, all passing); poolTag threads through CSV → seed script → teams.ts                                       |
| `packages/shared/src/draftEngine.ts`               | `computeTotalStat`, `isInPool`, `resolvePoolPlayers`, `assignTiers`, `generateDraftPacks`, `DraftPack`, `RandomIntFn`, `shuffle` | VERIFIED | All exported (or internal for `shuffle`); pure module; zero `crypto`/`Math.random` (grep confirms 0); CR-01/WR-01 validation guards present (lines 234-241, 325-348) |
| `packages/shared/src/index.ts`                     | barrel export of draftEngine                                                                                                     | VERIFIED | `export * from './draftEngine.js';` present                                                                                                                          |
| `packages/shared/src/draftEngine.test.ts`          | classification + pack contract tests                                                                                             | VERIFIED | 21 tests, independently re-run, all pass                                                                                                                             |
| `packages/server/src/draftPacks.ts`                | `generateMatchPacks` — crypto.randomInt binding                                                                                  | VERIFIED | Imports `randomInt` from `'crypto'`, one-line delegation to `generateDraftPacks(selectedPools, randomInt)`, 0 `Math.random`                                          |
| `packages/server/src/__tests__/draftPacks.test.ts` | end-to-end structural-invariant integration test                                                                                 | VERIFIED | 5 tests (Test 1-5, including WR-02 fix's mls/international full-invariant coverage), independently re-run, all pass                                                  |

### Key Link Verification

| From                 | To                          | Via                                                                            | Status | Details                                                                          |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------- |
| `draftEngine.ts`     | `teamConfig.ts`             | `TEAM_CONFIGS[sourceTeamId].league` for mls/intl derivation                    | WIRED  | `isInPool` reads `TEAM_CONFIGS[player.sourceTeamId as TeamId]?.league` (line 76) |
| `draftEngine.ts`     | `types.ts`                  | `TIER_PERCENTILE_BOUNDS` threshold comparison                                  | WIRED  | Imported and used directly in `assignTiers` percentile branches                  |
| `index.ts`           | `draftEngine.ts`            | barrel re-export                                                               | WIRED  | `export * from './draftEngine.js';` confirmed present                            |
| `draftPacks.ts`      | `node:crypto`               | `randomInt` injected as `RandomIntFn`                                          | WIRED  | `import { randomInt } from 'crypto'`; passed directly, no adapter                |
| `draftPacks.ts`      | `@counter-attack/shared`    | `generateDraftPacks` consumed with crypto RNG                                  | WIRED  | `return generateDraftPacks(selectedPools, randomInt);`                           |
| `generateDraftPacks` | `generateDraftPacks` (self) | `assignTiers` called to classify the union each backfill iteration and finally | WIRED  | Confirmed at lines 262 (loop) and 315 (final classify)                           |

### Data-Flow Trace (Level 4)

Not applicable in the traditional sense (no UI rendering this phase) — instead verified via direct live execution of the full pipeline (`generateDraftPacks` and `assignTiers` invoked directly against the real 188-player `PLAYER_POOL` with real `crypto.randomInt`, outside of any test mock). Results:

- Full-pool tiering: 188/188 players tiered, tier distribution `{keeper: 16, uncommon: 34, rare: 17, common: 103, chase: 18}` (GK-exclusive keeper bucket, percentile-consistent outfield split).
- Pack generation (all 3 pools): 8 packs × 7 cards, composition matches `PACK_COMPOSITION` exactly, 56/56 unique card ids (no duplication).
- Input validation (CR-01 fix): `generateDraftPacks([], randomInt)` and `generateDraftPacks(['legends'], randomInt)` both throw the expected descriptive error rather than silently drafting from the full universe — confirmed live, not just via test.

This confirms the engine is not merely test-green but functionally produces correct real output when invoked directly.

### Behavioral Spot-Checks

| Behavior                                                            | Command                                                                                      | Result                                                       | Status |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------ |
| Every player in pool gets a tier                                    | Direct Node execution of `assignTiers(PLAYER_POOL)` from built dist                          | 188/188 tiered, 0 missing, 0 GK/outfield-tier mismatches     | PASS   |
| Pack composition/no-dup (all pools)                                 | Direct Node execution of `generateDraftPacks(['original','mls','international'], randomInt)` | 8 packs, 7 cards, correct tier composition, 56/56 unique ids | PASS   |
| Input validation fail-closed (CR-01)                                | Direct Node execution with `[]` and `['legends']`                                            | Both throw descriptive errors as expected                    | PASS   |
| No hardcoded constant duplication (configurability, criterion 3)    | `grep` scan of `draftEngine.ts` for literal `90/80/60/8/7` outside comments                  | Zero hardcoded literals; all math reads imported constants   | PASS   |
| `pnpm --filter @counter-attack/shared test draftEngine`             | vitest run                                                                                   | 21/21 passed                                                 | PASS   |
| `pnpm --filter @counter-attack/server test draftPacks`              | vitest run (after shared build)                                                              | 5/5 passed                                                   | PASS   |
| `pnpm --filter @counter-attack/shared typecheck` / server typecheck | tsc --noEmit                                                                                 | Both clean                                                   | PASS   |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` files exist for this phase; no probe was declared in any PLAN/SUMMARY.

### Requirements Coverage

| Requirement | Source Plan         | Description                                                                                    | Status    | Evidence                                                                                                                                                      |
| ----------- | ------------------- | ---------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DRAFT-04    | 28-01, 28-02        | Player pool classified into 5 tiers by total stat count via configurable percentage boundaries | SATISFIED | `assignTiers` + `TIER_PERCENTILE_BOUNDS`; verified live against full 188-player pool; REQUIREMENTS.md correctly attributes Phase 28 (fixed in commit cd168eb) |
| DRAFT-05    | 28-01, 28-03, 28-04 | 7-card packs generated from selected pool with configurable per-rarity composition             | SATISFIED | `generateDraftPacks` + `generateMatchPacks` + `PACK_COMPOSITION`; verified live and via 26 combined tests across shared+server                                |

No orphaned requirements: REQUIREMENTS.md traceability table maps only DRAFT-04/DRAFT-05 to Phase 28, and both appear in plan frontmatter (`requirements: [DRAFT-04, DRAFT-05]` on 28-01 and 28-04; `[DRAFT-04]` on 28-02; `[DRAFT-05]` on 28-03).

### Anti-Patterns Found

None. Scanned `draftEngine.ts`, `draftPacks.ts`, and the draft-related additions to `types.ts` for `TODO|FIXME|XXX|TBD|HACK|PLACEHOLDER|placeholder|not yet implemented|coming soon` — zero matches in the phase's new/modified draft code (one unrelated pre-existing doc comment in `types.ts` referencing "placeholder" describes a Phase-prior `unknown[]` type replacement, not this phase's work).

A pre-existing code review (28-REVIEW.md) found and the team fixed 3 issues (CR-01 fail-open pool validation, WR-01 silent short/duplicate-pack risk under future constant tuning, WR-02 missing structural-invariant test coverage for tight-supply single pools) via commits `99937ee`, `c8c8a66`, `c010105`. All three fixes are present in the current code and independently confirmed via live execution and test re-run in this verification (not merely trusted from REVIEW-FIX.md).

### Human Verification Required

None. This phase is purely a data/engine layer (no UI, no socket wiring) — all observable truths are mechanically verifiable via direct code execution and automated tests, which were independently re-run rather than trusted from SUMMARY.md claims.

### Gaps Summary

No gaps found. All 3 roadmap success criteria are verified against live-executed code (not just passing tests): every player in the 188-player pool receives a correct tier, packs are correctly composed with no duplication (including previously-flagged tight-supply single-pool scenarios), and all tier/pack constants are genuine single-source-of-truth exports with no hardcoded duplicate literals in the engine. The prior code review's critical and warning findings (CR-01, WR-01, WR-02) were fixed and their fixes are confirmed live, not merely by summary claim.

---

_Verified: 2026-07-21T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
