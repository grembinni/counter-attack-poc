---
status: resolved
trigger: 'UAT gap from Phase 17.1 (action-flow-cleanup) verification, test 7: client highlights ALL goal-line hexes as shot targets instead of only those within 11 hexes of shooter'
created: 2026-06-19T00:00:00Z
updated: 2026-06-19T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. The regular-shot branch of `isShootingModeGoalHex` in HexGrid.tsx (line 265: `shootingMode ||`) highlights every hex in `goalLineHexSet` whenever `shootingMode` is true and `isActivePlayer`, with zero hexDistance filter — unlike the SNAPSHOT_TARGET branch (lines 266-269) which has `hexDistance(snapCarrier.position, hex) <= 6`. Server's `applyDeclareShot` (gameEngine.ts:2836) gates the same regular-shot path at `hexDistance(shooter.position, goalHex) > 11`, but the client never applies an equivalent `<= 11` check for the `shootingMode` branch.
test: Read HexGrid.tsx fully (done), read applyDeclareShot fully (done), confirmed useGameStore's shootingMode is a bare boolean with no positional/distance data threaded through.
expecting: confirmed — see Evidence.
next_action: Investigation complete. Returning ROOT CAUSE FOUND (goal: find_root_cause_only — no fix applied).

## Symptoms

expected: With shooter at hex (11,5), only goal-line hexes within 11 hexes (per user check: (0,10), (0,11), (0,12)) should be highlighted as selectable shot targets in the client UI during regular shot declaration (D-09, server-side gate already implemented in applyDeclareShot per 17.1-04-SUMMARY.md).
actual: Client highlights EVERY goal-line hex as a selectable shot target regardless of distance from shooter, when shooter is at (11,5).
errors: None reported.
reproduction: Test 7 in .planning/phases/17.1-action-flow-cleanup/17.1-UAT.md — position the ball carrier/shooter at (11,5) in MOVE phase, enter shooting mode, observe which goal-line hexes are highlighted.
started: Discovered during Phase 17.1 UAT. D-09 added a SERVER-side range gate in applyDeclareShot (17.1-04); client-side highlight logic apparently never updated to match.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-06-19T00:05:00Z
  checked: packages/client/src/components/HexGrid.tsx lines 108-111, 256-269
  found: |
  GOAL_R_VALUES = [10,11,12,13,14,15,16]; goalLineHexSet built from all 7 r-values at goalQ
  (full goal line, unfiltered by distance — this is correct as the base set, filtering
  is expected to happen downstream per-branch).

  isShootingModeGoalHex (lines 262-269):
  isActivePlayer &&
  goalLineHexSet.has(hexId) &&
  (shootingMode ||
  (phase === 'SNAPSHOT_TARGET' && snapCarrier != null &&
  hexDistance(snapCarrier.position, hex) <= 6))

  The `shootingMode ||` branch (regular shot, D-09 path) has NO hexDistance check at all —
  it only requires isActivePlayer + hex is in goalLineHexSet. The SNAPSHOT_TARGET branch
  DOES have `hexDistance(snapCarrier.position, hex) <= 6`.
  implication: |
  Confirmed exact mechanism — regular-shot highlight unconditionally lights up all 7
  goal-line hexes whenever shootingMode is true, regardless of shooter position.

- timestamp: 2026-06-19T00:06:00Z
  checked: packages/server/src/gameEngine.ts applyDeclareShot, lines 2780-2840
  found: |
  Server-side regular shot path (state.phase === 'PASS', after SNAPSHOT_TARGET branch and
  sequence guard) resolves `shooter = state.pieces.find(p => p.id === state.ball.carrierId)`
  then at line 2836: `if (!shooter || hexDistance(shooter.position, goalHex) > 11) return
  { ok:false, reason:'INVALID_TARGET' }`. This is the D-09 gate referenced in
  17.1-04-SUMMARY.md. The SNAPSHOT_TARGET branch (line 2796-2814) uses a separate,
  pre-existing `hexDistance(snapShooter.position, goalHex) > 6` gate at line 2798.
  implication: |
  Server correctly rejects any regular-shot target hex more than 11 hexes from the
  shooter. The bug is CLIENT-ONLY: the highlight overstates what's clickable/valid, but
  an actual click on an out-of-range hex would still emit declareShot to the server,
  which would reject it server-side (no invalid state is reachable — this is a UX/highlight
  accuracy bug, not a validation bypass).

- timestamp: 2026-06-19T00:07:00Z
  checked: packages/client/src/store/useGameStore.ts shootingMode definition (lines 63, 181, 494, 632)
  found: |
  `shootingMode: boolean` — a bare flag toggled by `setShootingMode(on)` which only sets
  `{ shootingMode: on, shootTargetHex: null }`. No shooter position, carrier id, or distance
  data is threaded into this flag at all.
  implication: |
  Confirms the client has all the data it needs (ball.carrierId -> pieces lookup, same as
  used in the SNAPSHOT_TARGET branch and in the GK_DIVE/quickThrowTargetSet blocks elsewhere
  in the same file) to compute the equivalent shooter-position-based distance filter for the
  regular-shot branch — it simply was never wired in when D-09's server-side gate was added
  in phase 17.1-04. The fix (not applied per find_root_cause_only) would mirror the
  SNAPSHOT_TARGET pattern: resolve the regular shooter via
  `ball.carrierId ? pieces.find(p => p.id === ball.carrierId) : null` and require
  `hexDistance(shooter.position, hex) <= 11` in the `shootingMode` branch, analogous to
  quickThrowTargetSet (lines 213-223) which already does `hexDistance(gk.position, h) <= 11`
  for a different phase.

## Resolution

root_cause: |
packages/client/src/components/HexGrid.tsx, `isShootingModeGoalHex` computation
(lines 262-269). The regular-shot branch (`shootingMode ||` at line 265) highlights
every hex in `goalLineHexSet` (all 7 goal-line hexes) whenever shootingMode is true and
isActivePlayer, with no hexDistance filter. This is inconsistent with: (a) the sibling
SNAPSHOT_TARGET branch in the same ternary, which DOES gate on
`hexDistance(snapCarrier.position, hex) <= 6`, and (b) the server's `applyDeclareShot`
in packages/server/src/gameEngine.ts (line 2836), which gates the equivalent regular-shot
path on `hexDistance(shooter.position, goalHex) > 11` (D-09, added in phase 17.1-04).
When D-09 added the server-side 11-hex range gate, the client-side highlight logic for
the regular shooting-mode branch was never updated to add a matching `<= 11` distance
check against the shooter's (ball carrier's) position — only goalLineHexSet membership
and isActivePlayer are checked. No invalid state is reachable (server still rejects
out-of-range clicks), so this is a pure client-side UX/highlight-accuracy bug, not a
validation bypass.
fix: (not applied — goal is find_root_cause_only)
verification: (not applicable — no fix applied)
files_changed: []
status_update: diagnosed
