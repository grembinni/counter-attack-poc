---
phase: 42-substitution-ux-overhaul
plan: 11
subsystem: ui
tags: [react, card-injury-badge, bench-carousel, gap-closure, vitest]

# Dependency graph
requires:
  - phase: 41-card-injury-iconography
    provides: shared CardInjuryBadge component and cardColorFor/cardColorForBenchEntry derivation used by DraftCardBody
  - phase: 42-substitution-ux-overhaul (plan 10)
    provides: live human verification report (Section D) identifying the duplicate red-card indicator defect on bench cards
provides:
  - Single card indicator (RED CARD text badge only) on a red-carded bench card, with the injury glyph preserved when also injured
  - Updated BenchCarousel and cross-surface regression test coverage locking the single-indicator behavior, mutation-checked
affects: [42-substitution-ux-overhaul (remaining gap-closure plans 42-12..42-15)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Local per-render suppression variable (glyphCardColor) computed once in DraftCardBody, rather than mutating the shared CardInjuryBadge component, to keep the ICON-01 single-owner derivation intact'

key-files:
  created: []
  modified:
    - packages/client/src/components/DraftPackCarousel.tsx
    - packages/client/src/components/BenchCarousel.test.tsx
    - packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - "Suppress the glyph's CARD half (not the RED CARD text badge) when redCarded is true — the RED CARD badge is unambiguous text where the glyph is a plain rectangle the verifier described as a duplicate/overlapping icon, and OUT already uses the same text-badge vocabulary on the bench (per 42-10-SUMMARY.md Section D and the plan's gap-closure decision record)"
  - 'Never suppress the injury half — a red-carded AND injured player must still show the injury cross; only cardColor is nulled, injuryCount always passes through unchanged'

requirements-completed: [SUB-18]

# Metrics
duration: ~35min (excluding one-time 6min dependency install / build needed because the worktree had no node_modules)
completed: 2026-08-22
---

# Phase 42 Plan 11: Suppress Duplicate Bench Red-Card Glyph Summary

**Nulled the CardInjuryBadge cardColor prop inside DraftCardBody when redCarded is true, so a red-carded bench card shows exactly one card indicator (the RED CARD text badge) instead of the badge plus a duplicate glyph.**

## Performance

- **Duration:** ~35 min of plan-task work (a one-time ~6 min `pnpm install` plus a `tsc` build of `@counter-attack/shared` were required first — the worktree had no `node_modules` or built shared package)
- **Started:** 2026-08-22T17:30:00Z (approx, after dependency setup)
- **Completed:** 2026-08-22T17:56:00Z
- **Tasks:** 2
- **Files modified:** 4 (3 declared in the plan + 1 pre-existing test fixed as a direct-cause Rule 1 bug)

## Accomplishments

- A red-carded bench card now renders exactly one card indicator (`RED CARD` text badge); the duplicate `piece-card-badge` glyph is suppressed
- A red-carded AND injured bench card still renders the injury glyph — only the card-color half is suppressed
- Yellow-card, OUT, draft-pack-row, and all three non-bench surfaces (pitch, scoreboard, roster) are byte-for-byte unaffected
- The `CardInjuryBadge.crossSurface.test.tsx` "Bench badge regression" suite was inverted (not deleted) to prove the single-indicator behavior across every existing mode/gating dimension (positioning mode, substitution mode, `readOnly`, `actionPending`, open confirm popup), plus a new dedicated `within(card)`-scoped single-indicator test
- Mutation-checked: temporarily reverting the suppression makes the new gap-item-1 test fail with `AssertionError: expected 1 to be +0`; the fix was restored and the diff verified byte-identical to the committed state before re-verifying

## Task Commits

Each task was committed atomically:

1. **Task 1: Suppress the duplicated card glyph on red-carded bench cards** - `bfe869a` (fix)
2. **Task 2: Retarget the cross-surface bench-badge regression suite and prove the symptom is gone** - `d6d15b89` (test)

_No plan-metadata commit yet — this SUMMARY commit is the metadata commit for this plan (worktree mode)._

## Files Created/Modified

- `packages/client/src/components/DraftPackCarousel.tsx` — added `glyphCardColor` (nulled when `redCarded === true`), passed to `CardInjuryBadge`'s `cardColor` prop instead of the raw `cardColor` prop; replaced the stale "Coexists with that badge (UI-SPEC lock)" comment with the gap-closure rationale
- `packages/client/src/components/BenchCarousel.test.tsx` — rewrote the "UI-SPEC coexistence" test into "gap item 1: … shows ONLY the RED CARD text badge …" (asserts zero `piece-card-badge` / `card-injury-badge` nodes) and added a second "gap item 1: … AND injured …" test proving the injury glyph survives suppression; left the yellow-card ordering test untouched
- `packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx` — inverted `assertBenchBadges()`'s red-glyph assertion (was: glyph present; now: zero `piece-card-badge` nodes inside the red-carded card), kept the `RED CARD`/`OUT`/injured assertions unchanged; added a new `within(card)`-scoped "gap item 1" test asserting a total card-indicator count of exactly 1; changed two array-length assertions from `toHaveLength(n)` to `.length` + `toBe(n)` to avoid a chai `inspect()` crash (`TypeError: Cannot read properties of undefined (reading 'name')`) that occurs when chai tries to pretty-print an array of DOM nodes in a failure message on this project's chai/jsdom version combination
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` — fixed the pre-existing `ICON-03: bench cards derive their glyph from BenchEntry` test, which asserted the OLD two-glyph coexistence behavior for a red-carded, uninjured bench entry (`p015`, `injuryCount: 0`); under the new suppression, `CardInjuryBadge` returns `null` entirely for that card (nothing left to draw), so the wrapper count dropped from 2 to 1 and the `red` `piece-card-badge` no longer exists — updated assertions to match, added a check that `bench-red-card-badge` is still present

## Decisions Made

- Suppress the glyph's CARD half only when `redCarded === true`, leaving the injury half, yellow-card cards, and OUT cards completely untouched — matches the plan's gap-closure decision record verbatim
- Changed brittle `expect(arr).toHaveLength(n)` assertions in `CardInjuryBadge.crossSurface.test.tsx` to `expect(arr.length).toBe(n)` after discovering they crash chai's failure-message formatter when the array contains DOM nodes and the assertion fails — this is an environment-level chai/jsdom incompatibility, not a logic bug, but the `.length`-based form produces the clean, greppable failure message the plan's mutation-check step requires

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a pre-existing test (`LineupAssignmentScreen.test.tsx`) that locked the now-superseded two-glyph coexistence behavior**

- **Found during:** Task 2 full-client-suite verification (`pnpm --filter @counter-attack/client test -- --pool=forks`)
- **Issue:** `ICON-03: bench cards derive their glyph from BenchEntry …` asserted `card-injury-badge` wrapper count `2` and expected a `red` `piece-card-badge` to exist for a red-carded, uninjured bench entry (`p015`). Task 1's fix makes `CardInjuryBadge` return `null` entirely for that card (no card color, no injury), so the wrapper count is `1` and no `red` glyph exists — this test was not in the plan's declared `<files>` list but is directly, unavoidably broken by Task 1's change.
- **Fix:** Updated the test's assertions (wrapper count `1`, `redBadge` undefined, added an explicit check that `bench-red-card-badge` renders) and renamed the test title to reference gap item 1.
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- **Verification:** Full client suite re-run green (37 files / 1106 tests passing).
- **Committed in:** `d6d15b89` (Task 2 commit)

**2. [Rule 1 - Bug] Replaced `toHaveLength` array assertions with `.length`/`toBe` in `CardInjuryBadge.crossSurface.test.tsx` to avoid a chai inspector crash**

- **Found during:** Task 2 mutation-check step
- **Issue:** `expect(domNodeArray).toHaveLength(0)` throws `TypeError: Cannot read properties of undefined (reading 'name')` from inside chai's `inspectClass` when the assertion genuinely fails and chai tries to pretty-print the array of DOM elements for the diff — an environment-level chai/jsdom incompatibility that masks the real assertion failure with a confusing crash.
- **Fix:** Changed the two affected assertions (in `assertBenchBadges()` and the new gap-item-1 test) to compare `.length` against a plain number via `toBe`, which chai can format cleanly.
- **Files modified:** `packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx`
- **Verification:** Mutation check re-run produced the clean message `AssertionError: expected 1 to be +0 // Object.is equality`; full suite green after restoring the fix.
- **Committed in:** `d6d15b89` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs directly caused/exposed by this plan's change)
**Impact on plan:** Both fixes were necessary to satisfy the plan's own verification requirement ("full client suite passes") and mutation-check requirement ("record the observed failure message"). No scope creep — no other files were touched.

## Mutation Check (Task 2 Part C)

1. Temporarily reverted `DraftPackCarousel.tsx`'s `CardInjuryBadge` call from `cardColor={glyphCardColor}` back to `cardColor={cardColor ?? null}` (the pre-fix behavior).
2. Ran the new gap-item-1 test in isolation: **FAILED** with `AssertionError: expected 1 to be +0 // Object.is equality` at `CardInjuryBadge.crossSurface.test.tsx:469` (`expect(cardGlyphs.length).toBe(0)`).
   - (First attempt before the `.length`/`toBe` rewrite threw `TypeError: Cannot read properties of undefined (reading 'name')` from chai's `inspectClass` while trying to format the failure diff for the raw DOM-node array — a genuine failure, but with an unhelpfully opaque message. Rewriting the assertion to compare `.length` directly produced the clean message above while preserving the same pass/fail semantics.)
3. Restored `cardColor={glyphCardColor}`; confirmed `git diff` on `DraftPackCarousel.tsx` was empty (byte-identical to the committed Task 1 state).
4. Re-ran the full `CardInjuryBadge.crossSurface.test.tsx` suite: **11/11 passed, 0 skipped.**

## Test Titles Rewritten (old → new)

- `BenchCarousel.test.tsx`: `'UI-SPEC coexistence: a red-carded bench card shows BOTH the red glyph and the RED CARD text badge'` → `'gap item 1: a red-carded bench card shows ONLY the RED CARD text badge — the duplicate card glyph is suppressed'` (plus a new sibling test: `'gap item 1: a red-carded AND injured bench card still renders the injury glyph, with the card glyph still suppressed'`)
- `CardInjuryBadge.crossSurface.test.tsx`: `assertBenchBadges()`'s red-glyph assertion inverted in place (title unchanged for the 5 existing mode/gating tests); new test added: `'gap item 1 (42-10 Section D): a red-carded bench entry renders exactly one card indicator — no duplicate glyph beside the RED CARD badge'`
- `LineupAssignmentScreen.test.tsx`: `'ICON-03: bench cards derive their glyph from BenchEntry — booked/injured subbedOut entry shows both glyphs, red-carded entry shows the red glyph, available entry shows none'` → `'ICON-03/gap item 1: bench cards derive their glyph from BenchEntry — booked/injured subbedOut entry shows both glyphs, red-carded entry shows only the RED CARD badge (duplicate glyph suppressed), available entry shows none'`

## Issues Encountered

- The worktree had no `node_modules` and no built `packages/shared/dist` output on first use — ran `pnpm install` (~6 min) and `pnpm --filter @counter-attack/shared build` before any test could execute. This is worktree/environment setup, not a plan deviation.
- The chai `inspectClass` crash described above (documented as deviation #2) cost significant debugging time before the root cause (pretty-printing DOM node arrays) was identified via a scratch debug test with try/catch stack capture. The scratch file (`_scratch_debug.test.tsx`) was deleted before final commit and never committed.

## Verification Results

- `pnpm --filter @counter-attack/client test -- --pool=forks BenchCarousel CardInjuryBadge` — 65/65 passed
- `pnpm --filter @counter-attack/client test -- --pool=forks CardInjuryBadge.crossSurface` — 11/11 passed, 0 skipped
- `pnpm --filter @counter-attack/client test -- --pool=forks` (full client suite) — 37 files / 1106 tests passed
- `pnpm -r typecheck` — clean (shared/server/client all `Done`)
- `npx eslint packages/client/src/components/DraftPackCarousel.tsx packages/client/src/components/BenchCarousel.test.tsx packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx` — clean
- `pnpm format:check` — 13 pre-existing warnings in files NOT touched by this plan (logged to `.planning/phases/42-substitution-ux-overhaul/deferred-items.md`, not fixed — out of scope per the scope-boundary rule)
- Acceptance-criteria greps: `glyphCardColor` count = 2; `"Coexists with that badge"` = 0 matches; non-comment `bench-red-card-badge` = 1; `"gap item 1"` in crossSurface test = 2; `"actionPending"` in crossSurface test = 5 — all match plan expectations

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes. This plan only narrows an existing prop value passed into an existing shared component; the threat register's own T-42-42/T-42-43/T-42-44 dispositions (documented in the plan) were the only threat-relevant considerations, and all three were addressed as specified (accept/mitigate via the untouched draggability path and the dedicated injury-survives-suppression test).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gap item 1 from `42-10-SUMMARY.md`'s live human verification is closed: the bench is no longer the only surface announcing a red card twice.
- Remaining gap-closure plans (42-12 through 42-15) for the other 6 items from the live verification round are unaffected by this change — no shared files beyond the ones listed above were touched.
- No blockers.

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_
