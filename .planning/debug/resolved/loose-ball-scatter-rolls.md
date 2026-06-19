---
status: resolved
trigger: 'UAT gap from Phase 17.1 (action-flow-cleanup) verification, test 6: loose ball scatter at (21,4) -> (24,1) does not appear reachable with 1 direction roll + 1 distance roll.'
created: 2026-06-19T00:00:00Z
updated: 2026-06-19T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - LOOSE_BALL_DIRECTIONS deltas are axial-style fixed deltas applied directly to
ODD-Q offset coordinates. For axis-aligned directions (E/W) this works, but for the four diagonal
directions (NE/NW/SW/SE) a fixed (dq,dr) delta does NOT trace a true single straight line on an
ODD-Q offset grid (true neighbor deltas alternate by column parity per ODD_Q_NEIGHBORS in hex.ts).
Repeating the same fixed diagonal delta N times overshoots true hex distance for roughly half of
all (direction, distance>=2) rolls, depending on starting column parity.
test: Verified via direct computation (node) using the project's own toCube/hexDistance formulas from hex.ts
expecting: n/a - test executed, see Evidence
next_action: Report root cause to caller (goal=find_root_cause_only, no fix to apply)

## Symptoms

expected: |
When the ball becomes loose, scatter uses exactly ONE direction die roll and ONE
distance/range die roll. The ball moves in a straight line along that single
direction for that single distance, clamped to the last valid on-pitch hex if it
would otherwise leave the pitch (D-08, phase 17.1 plan 04).
actual: |
User-reported in-game action log: [LOOSE BALL] 21,4 -> 24,1
Delta is (+3, -3). User asserts this displacement is not reachable by any single
direction (from LOOSE_BALL_DIRECTIONS) times a single integer distance roll.
User wants all loose-ball behavior reviewed against the 1-roll-direction +
1-roll-range straight-line rule.
errors: None reported
reproduction: |
Test 6 in .planning/phases/17.1-action-flow-cleanup/17.1-UAT.md
Observed case: loose ball at (21,4) scattering to (24,1)
started: |
D-08 board-edge clamp added in phase 17.1 plan 04; underlying direction+distance
scatter mechanic predates phase 17.1.

## Eliminated

- hypothesis: "The clamp loop added in D-08 (phase 17.1 plan 04) accumulates the wrong delta or has an off-by-one"
  evidence: |
  Read gameEngine.ts lines 1972-1988. The clamp loop computes
  next = { q: from.q + dirDelta.q*(step+1), r: from.r + dirDelta.r*(step+1) }
  for step in 0..distance-1, which is mathematically identical (same fixed dirDelta, same
  multiplication by step count) to computeLooseBall's from.q + dir.q\*distance. The clamp loop
  is NOT where the bug originates - it faithfully reproduces the (already broken) fixed-delta
  walk from scoreUtils.ts. D-08 just adds early-exit-on-off-pitch on top of the same flawed delta.
  timestamp: 2026-06-19T00:10:00Z

- hypothesis: "computeLooseBall has a coding bug (off-by-one, wrong index, wrong sign) distinct from a coordinate-system issue"
  evidence: |
  Read scoreUtils.ts lines 48-78 in full. computeLooseBall does exactly
  `{ q: from.q + dir.q*distance, r: from.r + dir.r*distance }` for a single dir/distance pair -
  no loop, no multi-step branching, no extra randomness. The function does exactly what its
  docstring says. The bug is not in this function's internal logic; it is in what the
  LOOSE_BALL_DIRECTIONS delta values represent vs. the coordinate system they are applied to.
  timestamp: 2026-06-19T00:10:00Z

## Evidence

- timestamp: 2026-06-19T00:02:00Z
  checked: packages/shared/src/scoreUtils.ts (full file)
  found: |
  LOOSE_BALL_DIRECTIONS (lines 48-55) is a fixed table of 6 deltas:
  1=E{q:1,r:0}, 2=NE{q:1,r:-1}, 3=NW{q:0,r:-1}, 4=W{q:-1,r:0}, 5=SW{q:-1,r:1}, 6=SE{q:0,r:1}.
  Comment at line 44 says "Order matches AXIAL_DIRECTIONS in hex.ts" - i.e. this table was
  designed for an AXIAL coordinate system. computeLooseBall (lines 69-78) does a simple
  `from + dir*distance` single-direction walk - exactly per the 1-roll-direction + 1-roll-range
  rule, IF the underlying coordinate system were axial.
  implication: The direction table's deltas are only valid in axial coordinates, not necessarily in
  whatever coordinate system the live pitch actually uses.

- timestamp: 2026-06-19T00:03:00Z
  checked: packages/shared/src/hex.ts (full file) and packages/server/src/roomStore.ts:23 comment
  found: |
  hex.ts header comment (lines 3-9): "ODD-Q flat-top offset layout. Stored (q,r) coordinates are
  offset (col,row): q=column (0..36), r=row (0..25)." ODD_Q_NEIGHBORS (lines 12-31) defines SIX
  neighbor deltas that DIFFER depending on whether q (column) is even or odd - this is required
  for any offset (non-axial) hex grid's diagonal directions. hexDistance/hexLine/hexesInRange all
  convert offset -> cube -> back, confirming the canonical coordinate system for the live pitch is
  ODD-Q OFFSET, not axial. Searched the whole packages/ tree for "AXIAL_DIRECTIONS" - it does NOT
  exist anywhere (only two stale comments reference it: scoreUtils.ts:44 and roomStore.ts:23).
  This proves AXIAL_DIRECTIONS was a real constant at some earlier point in the project's history
  and was removed/renamed when the grid was migrated to ODD-Q offset, but LOOSE_BALL_DIRECTIONS
  in scoreUtils.ts was never updated to match.
  implication: Confirmed coordinate-system mismatch - LOOSE_BALL_DIRECTIONS deltas are axial deltas
  being applied directly as offset-coordinate deltas. This is valid only for axis-aligned E/W
  (delta has r=0, so no parity dependency), but invalid for the four diagonal directions
  (NE/NW/SW/SE) where true odd-q-offset single-step deltas depend on starting column parity.

- timestamp: 2026-06-19T00:04:00Z
  checked: packages/server/src/gameEngine.ts lines 1972-1988 (LOOSE_BALL case, D-08 clamp walk)
  found: |
  const dirDelta = LOOSE_BALL_DIRECTIONS[direction - 1]!;
  let clampedPos = from;
  for (let step = 0; step < distance; step++) {
  const next = { q: from.q + dirDelta.q*(step+1), r: from.r + dirDelta.r*(step+1) };
  if (isPitchHex(next)) clampedPos = next;
  else break;
  }
  This is the SAME fixed-delta-times-step-count computation as computeLooseBall - the engine's
  live LOOSE_BALL resolution does not call computeLooseBall directly but reimplements the same
  (flawed) formula inline, plus boundary clamping.
  implication: The D-08 clamp walk is not the source of the bug - it correctly clamps along
  whatever path the fixed delta produces, but that path itself is not a true straight line in
  odd-q offset space for diagonal directions.

- timestamp: 2026-06-19T00:06:00Z
  checked: |
  Brute-force search (node script) over all 6 LOOSE_BALL_DIRECTIONS x distances 1-6 for a match
  to from=(21,4) -> to=(24,1) using the exact fixed-delta formula from computeLooseBall/gameEngine.
  found: |
  Direction=2 (NE, delta {q:1,r:-1}), distance=3 produces (21+3, 4-3) = (24,1) - an EXACT match.
  So per the current (buggy) implementation, this displacement IS produced by a single direction
  roll (NE) and a single distance roll (3) - confirming this is not a separate multi-step/loop
  bug. The reported case is a direct symptom of the coordinate-system mismatch, not an
  additional/different bug.
  implication: The bug is reproducible exactly as reported using legitimate roll values (dir=2,
  dist=3) under the current flawed formula.

- timestamp: 2026-06-19T00:08:00Z
  checked: |
  Used hex.ts's own toCube()/hexDistance() formulas (ODD-Q offset -> cube) to compute the TRUE
  hex distance from (21,4) to each intermediate step of the NE-delta walk: step1=(22,3),
  step2=(23,2), step3=(24,1).
  found: |
  True hexDistance(from, step1) = 2 (should be 1 for a true single-step move)
  True hexDistance(from, step2) = 3 (should be 2)
  True hexDistance(from, step3) = 5 (should be 3) <- this is the reported (24,1) destination
  implication: |
  CONCLUSIVE: a "distance=3" roll in direction NE actually displaces the ball 5 true hexes from
  its origin, not 3. The scatter is NOT a straight line of length 3 on the real grid - it is a
  zig-zag/diagonal-overshoot path. This directly explains the user's observation: (21,4)->(24,1)
  "looks like" 2 moves' worth of displacement because it genuinely IS further than a 3-step
  single-direction move should be.

- timestamp: 2026-06-19T00:09:00Z
  checked: |
  Repeated the true-hex-distance-per-step check for ALL 6 directions, from both an even-q and
  odd-q starting hex (q=20 and q=21), to characterize full scope of the bug.
  found: |
  From q=20 (even): E ok(1,2,3), NE BROKEN(1,3,4), NW ok(1,2,3), W ok(1,2,3), SW BROKEN(2,3,5), SE ok(1,2,3)
  From q=21 (odd): E ok(1,2,3), NE BROKEN(2,3,5), NW ok(1,2,3), W ok(1,2,3), SW BROKEN(1,3,4), SE ok(1,2,3)
  Pattern: E, NW, W, SE are always correct (their deltas happen to coincide with one of the two
  odd-q offset neighbor sets in a way that stays consistent across multi-step repetition for
  these specific delta values). NE and SW are ALWAYS broken for distance >= 2, regardless of
  starting column parity - they only point at a true adjacent neighbor for the FIRST step (from
  one specific parity), then diverge from a true straight line on every subsequent step because
  odd-q offset diagonal neighbors must alternate column-parity-dependent deltas to continue in
  the same true direction, but the fixed NE/SW delta in LOOSE_BALL_DIRECTIONS never alternates.
  implication: |
  This is NOT an edge-case/rare bug - it affects 2 of the 6 possible directions (NE, SW) for
  EVERY scatter roll with distance >= 2, which is the majority of rolls (5 of 6 distance values).
  Roughly 1/3 of all direction rolls, on the majority of distance rolls, produce an incorrect
  (overshooting/zig-zagging) landing hex instead of a true straight line.

- timestamp: 2026-06-19T00:11:00Z
  checked: packages/shared/src/scoreUtils.test.ts lines 30-61 (computeLooseBall test suite)
  found: |
  All existing unit tests for computeLooseBall either use distance=1 (trivially "correct" since a
  single fixed-delta step from an even-parity-adjacent direction happens to coincide with a true
  neighbor for at least one parity), or use distance=6 in the pure-E direction (axis-aligned,
  parity-independent, always correct), or the one multi-step diagonal case at line 60
  (`computeLooseBall({q:5,r:-3}, 2, 3)` expecting `{q:8,r:-6}`) which I verified ALSO has a true
  hexDistance of 5, not 3 - i.e. this existing test itself encodes/asserts the buggy behavior. No
  test in the suite checks computeLooseBall's output against hexDistance/hexLine from hex.ts.
  implication: |
  The bug has existed since computeLooseBall was written (predates phase 17.1) and has never been
  caught because the test suite validates the function against its own (axial-style) arithmetic,
  never against the actual pitch grid's true geometry (hex.ts's toCube/hexDistance, which is the
  single source of truth for "real" hex adjacency/distance on this ODD-Q offset pitch).

## Resolution

root_cause: |
LOOSE_BALL_DIRECTIONS (packages/shared/src/scoreUtils.ts lines 48-55) is a table of fixed
axial-style (q,r) deltas, originally written to match an "AXIAL_DIRECTIONS" constant that no
longer exists in the codebase (stale reference in the comment at line 44; confirmed via grep that
AXIAL_DIRECTIONS does not exist anywhere in packages/). The live pitch grid (packages/shared/src/hex.ts,
packages/shared/src/pitch.ts) uses ODD-Q OFFSET coordinates, where true single-step neighbor deltas
for the four diagonal directions (NE/NW/SW/SE) depend on the current hex's column parity
(ODD_Q_NEIGHBORS, hex.ts lines 12-31) - axis-aligned E/W deltas are parity-independent, but
diagonal deltas are not.

Both computeLooseBall (scoreUtils.ts lines 69-78) and the live engine's LOOSE_BALL resolution
(packages/server/src/gameEngine.ts lines 1972-1988, including the D-08 board-edge clamp walk added
in phase 17.1 plan 04) apply the SAME fixed delta repeatedly (delta \* distance, or delta summed
step-by-step in the clamp loop - mathematically identical) without ever adjusting for column
parity between steps. For the NE and SW directions specifically, this causes every multi-step
scatter (distance >= 2) to overshoot the true single-direction straight-line distance on the real
ODD-Q offset grid - verified via hex.ts's own toCube()/hexDistance() functions, which are the
single source of truth for "true" hex adjacency on this pitch.

Reported case: from (21,4), direction=NE (die value 2), distance=3 produces (24,1) via the current
fixed-delta formula (21+1*3, 4-1*3) = (24,1) - which IS a legitimate single-direction,
single-distance roll under the current (buggy) code. But hexDistance((21,4),(24,1)) using the
pitch's real ODD-Q offset->cube geometry is 5, not 3 - i.e. the ball actually traveled 5 true
hexes for a "distance=3" roll. This confirms the user's assertion: the displacement is not
reachable by a true single-direction, single-distance straight line on the real grid; it is an
artifact of applying axial deltas to an offset grid.

Scope: affects 2 of 6 directions (NE, SW) on every roll with distance >= 2 (5 of 6 distance
values) - not a rare edge case but a systematic, frequently-triggered bug. E, NW, W, SE happen to
remain correct because their fixed delta values coincide with a path that stays straight under
repeated application (verified empirically across both column parities); NE and SW do not.

This predates phase 17.1 - D-08 (the board-edge clamp) faithfully clamps along the same already-
incorrect path; it did not introduce the bug and did not need to "know" about it, since it just
walks whatever direction vector LOOSE_BALL_DIRECTIONS provides.
fix: ""
verification: ""
files_changed: []
