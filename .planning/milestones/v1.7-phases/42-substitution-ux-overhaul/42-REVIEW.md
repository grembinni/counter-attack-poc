---
phase: 42-substitution-ux-overhaul
reviewed: 2026-08-23T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - packages/shared/src/offside.ts
  - packages/shared/src/offside.test.ts
  - packages/shared/src/passValidator.ts
  - packages/shared/src/passValidator.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-08-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This is a scoped re-review of plans 42-16 and 42-17 — a gap-closure round that filtered
red-carded/benched pieces out of the two remaining unfiltered piece-list sites identified in
the phase's earlier review round: `passValidator.ts`'s LONG-pass landing restriction
(`ownTeammates`/`opponents` lists, lines 135-141) and `offside.ts`'s opponent-counting
(`opposingPiecesEqualOrAhead`) and sticky-flag evaluation (`evaluateOffside`'s `stillFlagged`/
`newlyFlagged`). 42-17 made no source changes (audit-only).

I traced every `state.pieces` construction site in both source files (`Grep` confirms there
are no other unfiltered sites left) and confirmed each fix applies `isActivePiece` at the
correct point, with the correct polarity (exclusion lowers opposing counts, which is the
rules-correct direction per the inline BUG-38 commentary), and does not disturb the two
deliberately-unfiltered "construction-class" by-id lookups (`offside.ts`'s `piecesById` map
and `triggerOffsideFoul`'s `offender` lookup, both of which filter downstream instead). I
manually re-derived the arithmetic for every new/changed test case in both `.test.ts` files
(hex-distance/attacking-direction math, `isActivePiece`'s two-clause `redCarded`/`onPitch`
semantics per `types.ts`) and found no incorrect assertions. No BLOCKER-level defects
(incorrect behavior, security, data loss) were found in this round's changes.

One WARNING was found: the pre-existing (not introduced this round) HIGH/LONG
"opponent-adjacent-to-kicker blocks the pass" branch in `passValidator.ts` has zero test
coverage at all — including for this round's own `isActivePiece` exclusion applied at that
exact site — unlike every sibling BUG-38 fix site, which all received dedicated
redCarded/onPitch/live-control test triads. Two INFO items (stale top-of-function doc
comments in `passValidator.ts`; an untested opponent-count-reaches-zero boundary in
`offside.ts`) are also noted.

## Warnings

### WR-01: HIGH/LONG "adjacent-to-kicker" PATH_BLOCKED branch has no test coverage, including for this round's own `isActivePiece` fix at that site

**File:** `packages/shared/src/passValidator.ts:112-126`

**Issue:** The HIGH/LONG path-blocking branch —

```ts
} else if (passType === 'HIGH' || passType === 'LONG') {
  // BUG-38: isActivePiece applied at the array-construction site (mirrors STANDARD above).
  const opponentPieces = state.pieces.filter(
    (p) => p.teamId !== piece.teamId && isActivePiece(p),
  );
  const adjacentOnPath = hexLine(from, to)[1]; // hex directly next to kicker on the target line
  if (
    adjacentOnPath &&
    opponentPieces.some(
      (p) => p.position.q === adjacentOnPath.q && p.position.r === adjacentOnPath.r,
    )
  ) {
    return { ok: false, reason: 'PATH_BLOCKED' };
  }
}
```

is exercised by **no test in `passValidator.test.ts`** — neither a baseline "live opponent
immediately adjacent to the kicker blocks a HIGH/LONG pass" control test, nor a BUG-38
"redCarded/onPitch:false opponent at that hex does NOT block it" test. Every other BUG-38 fix
site in this file (STANDARD path blocking, STANDARD destination auto-intercept, STANDARD ZoI
rollIntercepts, LONG landing restriction) received a matched pair of tests: one proving the
dismissed piece is excluded, one "control" test proving a live piece at the same spot still
triggers the original behavior (see e.g. lines 264-277, 279-298, 300-319 for the STANDARD
triads). This branch has neither — it isn't even covered by a pre-existing (pre-BUG-38) test:
the closest existing test, `'does NOT block a HIGH pass over an opponent in the travel path'`
(line 128), places its blocker at `{5,0}` on a `{0,0}→{10,0}` line, which is not
`hexLine(from,to)[1]` (the adjacent-to-kicker hex this branch actually checks), so it never
enters this code path at all. The branch is currently unverified in either direction: whether
a live opponent adjacent to the kicker correctly blocks a HIGH/LONG pass, and whether this
round's `isActivePiece` filter correctly un-blocks it for a dismissed opponent, are both
unproven by the test suite.

**Fix:** Add a control/BUG-38 pair mirroring the STANDARD triads already present, e.g.:

```ts
it('blocks a HIGH pass when a live opponent is immediately adjacent to the kicker on the path', () => {
  const opp = makeOpponent('live4', 1, 0); // hexLine({0,0},{10,0})[1]
  const state: GameState = { ...baseState, pieces: [basePiece, opp] };
  const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 10, r: 0 }, 'HIGH');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.reason).toBe('PATH_BLOCKED');
});

it('BUG-38: does NOT block a HIGH pass when the adjacent-to-kicker opponent is red-carded', () => {
  const opp: PlayerPiece = { ...makeOpponent('redCarded4', 1, 0), redCarded: true };
  const state: GameState = { ...baseState, pieces: [basePiece, opp] };
  const result = validatePass(state, basePiece, { q: 0, r: 0 }, { q: 10, r: 0 }, 'HIGH');
  expect(result.ok).toBe(true);
});
```

(Repeat for `LONG`, or parametrize over both — the branch is shared.)

## Info

### IN-01: `validatePass`'s top-of-function doc comments misstate which pass types can return `PATH_BLOCKED` and which are excluded from interception

**File:** `packages/shared/src/passValidator.ts:25`, `:58`

**Issue:** Line 25's type-level summary reads:

> `Reject: RANGE_EXCEEDED (distance cap or zero), PATH_BLOCKED (Standard only — intermediate hex), LANDING_RESTRICTED (LONG only).`

and the function-level guard-precedence comment (line 58) reads:

> `5. Interception list collection (all except LONG)`

Both are inaccurate against the function body: `PATH_BLOCKED` is **not** Standard-only — the
`HIGH`/`LONG` branch at lines 112-126 (the subject of WR-01 above) also returns
`PATH_BLOCKED` via its narrower "adjacent-to-kicker" check. And interception-list collection
(step 5, lines 171-196) is skipped for **both** `HIGH` and `LONG` (`if (passType !== 'LONG' &&
passType !== 'HIGH')`), not just `LONG` — this actually contradicts the _correct_ statement
made two lines below at line 150 ("HIGH and LONG passes skip interception (fly over
defenders)") in the same file. A maintainer skimming only the top-level overview (rather than
the accurate inline comments deeper in the function) would be misled into thinking a HIGH pass
can never be `PATH_BLOCKED` and always collects interceptors — both wrong.

**Fix:** Reword line 25 to `PATH_BLOCKED (STANDARD: any intermediate hex; HIGH/LONG: only the
hex immediately adjacent to the kicker)`, and line 58 to `Interception list collection
(STANDARD and FIRST_TIME only — HIGH/LONG fly over defenders, see step 6 note)` to match the
already-correct inline comment at line 150.

### IN-02: `opposingPiecesEqualOrAhead` reaching 0 (all opposing pieces dismissed) is untested

**File:** `packages/shared/src/offside.ts:141-149`, `packages/shared/src/offside.test.ts`

**Issue:** The BUG-38 test suite in `offside.test.ts` exercises the count dropping from 2 to 1
(one of two opposing pieces dismissed), but never the count dropping to 0 (e.g. both opposing
pieces on the field are simultaneously red-carded/benched, or only one opposing outfield piece
plus GK exist and both are dismissed). `isOffsideNow`'s condition 3 (`opposingCount <= 1`)
and `isClearedNow`'s condition (`opposingCount >= 2`) both behave correctly by direct extension
of the tested `count === 1` case (0 also satisfies `<= 1` and fails `>= 2`), so this is very
unlikely to hide an actual defect — but it is the one boundary value in the affected range
that the new test suite doesn't pin down, and a future refactor of the `<=1`/`>=2` comparisons
(e.g. an accidental `<` vs `<=` typo) would not be caught by the current tests at that specific
value.

**Fix:** Add one `opposingPiecesEqualOrAhead(state, homeFwd)).toBe(0)` case (both away pieces
dismissed) alongside the existing count-1 and count-2 cases, and a corresponding
`isOffsideNow`/`evaluateOffside` assertion, for completeness.

---

_Reviewed: 2026-08-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
