---
phase: 28-draft-data-model
fixed_at: 2026-07-21T12:35:30Z
review_path: .planning/phases/28-draft-data-model/28-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 28: Code Review Fix Report

**Fixed at:** 2026-07-21T12:35:30Z
**Source review:** .planning/phases/28-draft-data-model/28-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 3 (CR-01, WR-01, WR-02 — critical_warning scope; Info findings IN-01/IN-02/IN-03 explicitly excluded per instructions)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: `generateDraftPacks`/`generateMatchPacks` silently draft from ALL pools when given an empty or invalid `selectedPools`

**Files modified:** `packages/shared/src/draftEngine.ts`
**Commit:** `99937ee`
**Applied fix:** Added an input-validation guard at the top of `generateDraftPacks` that throws a descriptive `Error` when `selectedPools` is empty or contains any value not present in `SELECTABLE_DRAFT_POOLS`, imported from `./types.js`. This closes the fail-open path where an empty or unselectable (e.g. `'legends'`) selection previously fell through to drafting from the entire real-pool universe with no error. `packages/server/src/draftPacks.ts`'s `generateMatchPacks` calls `generateDraftPacks` directly, so the fix covers both entry points named in the finding without needing a separate edit there.

Verification: `tsc --noEmit` clean for `packages/shared`; full `packages/shared` vitest suite (13 files / 567 tests) passes, including the 21 pre-existing `draftEngine.test.ts` tests (none of which call `generateDraftPacks` with empty/unselectable pools, so no test needed updating); `packages/server`'s `draftPacks.test.ts` (3 tests, all valid-pool scenarios) passes unchanged.

### WR-01: Insufficient-supply scenarios fail silently instead of throwing (short packs and/or cross-pack duplication)

**Files modified:** `packages/shared/src/draftEngine.ts`
**Commit:** `c8c8a66`
**Applied fix:** After the authoritative post-backfill `assignTiers` classify step (stage 5), added an assertion block that tallies the final `keeper` count and each outfield tier's count from the classified `pool` and throws a descriptive `Error` (naming the tier and the short/need counts) if any tier's population is below its `need`. This guards the D-09 "7 cards per pack, no cross-pack duplication" contract against future tuning of `PACKS_PER_MATCH`/`PACK_COMPOSITION` past what the fixed 188-player pool can support — today the assertion is provably dormant (confirmed by the full test suite still passing at 567/567 with no assertion firing), matching the review's own stress-execution finding.

Verification: `tsc --noEmit` clean for `packages/shared`; full `packages/shared` vitest suite (567 tests) passes with zero assertion triggers (confirms dormancy, as expected); `packages/server`'s `draftPacks.test.ts` passes unchanged.

### WR-02: Test coverage gap — `draftPacks.test.ts` Test 3 never checks no-duplication/composition for the tightest-supply single pools

**Files modified:** `packages/server/src/__tests__/draftPacks.test.ts`
**Commit:** `c010105`
**Applied fix:** Added two new test cases (`Test 4`, `Test 5`) that each call the existing `assertStructuralInvariants` helper (pack size, composition, no cross-pack duplication) for `['mls']` and `['international']` respectively, across the same `ITERATIONS = 5` loop pattern used by `Test 1`/`Test 2`. Left the original `Test 3` (`not.toThrow()` smoke check across all `SELECTABLE_DRAFT_POOLS`) in place as an additional cheap regression guard, per the REVIEW.md fix note ("in addition to, or instead of").

Verification: `tsc --noEmit` clean for `packages/server`; `draftPacks.test.ts` now reports 5 passing tests (up from 3); full `packages/server` vitest suite (30 files, 560 passed / 1 skipped / 1 todo) passes with no regressions.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-21T12:35:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
