---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
reviewed: 2026-08-05T19:08:36Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - docs/HIGHLIGHT-REFERENCE.md
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 37: Code Review Report (Plan 37-19 gap closure)

**Reviewed:** 2026-08-05T19:08:36Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Scope for this review is intentionally narrowed to the final gap-closure plan (37-19) in
Phase 37: the rename of `highPassContestZoneSet` → `headerContestZoneSet` in `HexGrid.tsx`,
the new `headerContestCentre` ternary that generalises the header-contest preview to cover
both `HIGH_PASS_MOVE` and `GOAL_KICK_MOVE`, the associated test coverage in
`HexGrid.test.tsx`, and the doc note added to `docs/HIGHLIGHT-REFERENCE.md`. The rest of
Phase 37 was reviewed in an earlier cycle (see prior git history of this file).

I traced the change against its stated correctness contract by reading the two server-side
functions it claims to mirror (`gameEngine.ts`'s HIGH_PASS→HEADER eligibility check at
line ~2279 and `applyGoalKickMoveEnd` at line ~3995). Both confirmed: radius `<= 2`,
`targetHex` for the goal-kick case is `state.goalKickTargetHex` (matching the client's
centre choice), and the client's `??` null-coalescing correctly narrows
`goalKickTargetHex?: HexCoord | null | undefined` to `HexCoord | null`. No stale references
to the old `highPassContestZoneSet` name remain outside a documentation comment. Test
coverage for the new phase branch (radius boundary, null-target degradation, non-active-team
visibility, shot-path vs. shot-path-action upgrade, and negative coverage for the two
excluded phases `GK_KICK_MOVE`/`FIRST_TIME_PASS_MOVE`) is present and exercises the real
render path rather than only the derived Set.

No bugs, security issues, or behavior regressions were found in this specific diff. The
findings below are maintainability/quality items, not correctness defects.

## Warnings

### WR-01: Header-contest eligibility radius is a duplicated magic number with no shared constant

**File:** `packages/client/src/components/HexGrid.tsx:244`
**Issue:** The comment at lines 242-244 states the `2`-hex radius "mirrors
`applyGoalKickMoveEnd`'s homeEligible/awayEligible header-eligibility check in
`gameEngine.ts` verbatim ... and must never be changed." This is now a hard-coded literal
`2` duplicated in three independent places: `HexGrid.tsx`'s `headerContestZoneSet`
computation (`hexDistance(h, headerContestCentre) <= 2`), the HIGH_PASS→HEADER eligibility
check in `gameEngine.ts` (~line 2282/2285), and the GOAL_KICK→HEADER eligibility check in
the same file (~line 3998/4001). There is no shared constant (e.g.
`HEADER_ELIGIBILITY_RADIUS`) in `@counter-attack/shared` enforcing this invariant — a
grep for `HEADER_ELIGIB`/`ELIGIBILITY_RADIUS`/`CONTEST_RADIUS` across `packages/` returns
no matches. This plan explicitly widened the duplication from two call sites to three while
adding prose warning against exactly the drift a shared constant would prevent
mechanically. A future change to either server eligibility check (or the client preview)
that misses updating the other two would silently desync the visual preview from the
actual server-enforced rule, and nothing (type system, lint, or test) would catch it short
of a human re-reading three separate comments in two different packages.
**Fix:** Extract a single exported constant (e.g. `HEADER_CONTEST_RADIUS = 2`) from
`@counter-attack/shared`, and reference it from all three call sites:

```ts
// packages/shared/src/constants.ts (or similar)
export const HEADER_CONTEST_RADIUS = 2;

// HexGrid.tsx
if (hexDistance(h, headerContestCentre) <= HEADER_CONTEST_RADIUS) { ... }

// gameEngine.ts (both HIGH_PASS and GOAL_KICK eligibility checks)
hexDistance(p.position, targetHex) <= HEADER_CONTEST_RADIUS
```

## Info

### IN-01: Test title embeds a transient process note that will confuse future readers

**File:** `packages/client/src/components/HexGrid.test.tsx:1665`
**Issue:** The test title `'HIGH_PASS_MOVE regression pin: ... (order-of-work proof: written
and verified passing against the unmodified file — see SUMMARY)'` bakes in a note about the
plan's TDD sequencing ("see SUMMARY") that has no meaning once the referenced
`37-19-SUMMARY.md` planning artifact is no longer front-of-mind. Test titles are
long-lived documentation; process provenance belongs in a code comment or the plan/summary
file, not in the `it(...)` string that will show up in CI output indefinitely.
**Fix:** Shorten to something like `'HIGH_PASS_MOVE regression pin: ball hex and a hex 2
away carry shot-path; a hex 3 away carries neither'` and move the "written before the fix,
verified failing pre-generalisation" provenance note into a `//` comment above the test if
it's worth preserving at all.

### IN-02: Test fixtures use non-null assertions on `Array.find()` without a fallback message

**File:** `packages/client/src/components/HexGrid.test.tsx:1662-1663, 1700-1701`
**Issue:** `HP_2AWAY`, `HP_3AWAY`, `GK_2AWAY`, and `GK_3AWAY` are all derived via
`PITCH_HEXES.find((h) => hexDistance(h, X) === N)!`. If `PITCH_HEXES`'s shape ever changes
(e.g. pitch dimensions shrink such that no hex sits at exactly distance 3 from a given
centre), `find()` returns `undefined`, the `!` assertion silences TypeScript, and the
resulting `undefined.q`/`undefined.r` access inside `hasStrokeAtHex`/`axialToPixel` throws a
raw `TypeError` deep inside a helper rather than a clear assertion failure at the point of
setup. Low risk given the current fixed 37×26 pitch, but it is a footgun for whoever edits
pitch geometry later.
**Fix:** Add an explicit guard immediately after each `find()`, e.g.
`if (!HP_3AWAY) throw new Error('fixture invariant: no pitch hex at distance 3 from HP_BALL_HEX');`
or use a small `mustFind()` test helper that throws with a descriptive message.

### IN-03: No test exercises the header-contest preview during the `GOAL_KICK_MOVE` OPP slot

**File:** `packages/client/src/components/HexGrid.test.tsx:1703-1719`
**Issue:** All five `GOAL_KICK_MOVE` tests in the new `describe` block (lines 1660-1905)
construct state with `goalKickMoveSlot: 'KICKER'`. The production code's phase gate
(`phase === 'GOAL_KICK_MOVE'`, `HexGrid.tsx:253`) does not distinguish `KICKER` vs. `OPP`
slot, so the preview is presumably identical in both slots — but that equivalence is
asserted by code inspection only, not verified by a test. Since `goalKickMoveSlot` is a
real, distinct piece of state that changes mid-phase (per `applyGoalKickMoveEnd`'s
KICKER→OPP handoff reviewed above), a future change that accidentally keys the preview off
`goalKickMoveSlot` would not be caught by the existing suite.
**Fix:** Add (or parametrize) one of the existing `GOAL_KICK_MOVE` tests with
`goalKickMoveSlot: 'OPP'` to lock in that the preview is slot-independent.

---

_Reviewed: 2026-08-05T19:08:36Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
