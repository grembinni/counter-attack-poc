---
status: resolved
trigger: 'UAT gap from Phase 17.1 (action-flow-cleanup) verification, test 2 — tackle/steal ZoI exclusion not behaving correctly per D-02'
created: 2026-06-19T00:00:00Z
updated: 2026-06-19T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — two independent root causes (see Resolution.root_cause). Investigation complete; goal is find_root_cause_only, no fix applied.
test: N/A — confirmed via direct code inspection of moveValidator.ts and HexGrid.tsx/useGameStore.ts, plus grep confirming no client references to exclusion arrays.
expecting: N/A
next_action: None — diagnosis complete. Hand off to fix-applying agent/workflow.

## Symptoms

expected: |
Per D-02: when a defender attempts a tackle (success or fail) against the ball carrier,
that defender is added to tackleAttemptedByIds and should no longer project TACKLE ZoI for
the rest of the move sequence (carrier can move past/into adjacent hexes without re-triggering
tackle from that defender), but the defender STILL projects STEAL ZoI (independent exclusion).
Symmetric for steal: defender added to stealAttemptedByIds loses STEAL ZoI but keeps TACKLE ZoI.
The excluded-risk hexes should remain valid/safe move hexes (just lose the risk tint), not
disappear from the valid move set.

actual: |
DATA_START
After a failed tackle the threat no longer show but neither does valid move squares next to the ball carrier. After a failed tackle the defender should still be able to move next to the ball carrier it just wont trigger a new tackle this move phase. After a failed steal the defender threat hexes still shows. After a failed steal the attacker should still be able to move next to the defender it just wont trigger a new steal from that defender this move phase. Threat hexes should show safe movement if there are no defenders in range who can still make a steal or tackle action (depending on the use case)
DATA_END

Two distinct defects:

1. After tackle attempt, hexes near ball carrier that defender could move into (tackle excluded)
   disappear from defender's valid move set entirely, instead of just losing tackle-risk tint.
2. After STEAL attempt fails, steal-risk tint on that defender's hex does NOT clear for the
   carrier — should clear (steal excluded) while tackle-risk (if applicable) still shows.

errors: None reported

reproduction: Test 2 in .planning/phases/17.1-action-flow-cleanup/17.1-UAT.md

started: Discovered during Phase 17.1 UAT (D-02 fix from phase 17.1, plan 02)

## Eliminated

## Evidence

- timestamp: 2026-06-19T00:05:00Z
  checked: packages/shared/src/moveValidator.ts (full file, 130 lines)
  found: |
  Line 95-104 (STEAL trigger, ball-carrier moving): correctly filters allDefenders by
  stealAttemptedByIds. If defenders.length > 0 after filtering, returns ok:true with
  STEAL_ATTEMPT effect. If defenders.length === 0 (all excluded), falls through to
  return { ok: true } (plain, no effect) at line 129 — this looks correct: move is
  still valid, just no steal effect/risk.

  Line 106-124 (TACKLE trigger, non-carrier moving adjacent to carrier): DIFFERENT
  pattern. At line 119-121:
  if ((state.tackleAttemptedByIds ?? []).includes(piece.id)) {
  return { ok: false, reason: 'TACKLE_ALREADY_ATTEMPTED' };
  }
  This returns ok:false — i.e. the move itself is REJECTED/INVALID, not just stripped
  of the TACKLE_ATTEMPT effect. Comment at line 117-118 explicitly says "block the move
  so the client does not highlight adjacent-to-carrier hexes as valid for a spent tackler"
  — this is the WRONG design per D-02. D-02 says the defender should still be able to
  move into that hex (losing only the risk/effect), not have the move itself invalidated.
  implication: |
  This directly explains symptom #1 (tackle case): after a failed/attempted tackle, the
  hexes adjacent to the carrier disappear from the DEFENDER's valid move set entirely
  (because validateMove returns ok:false for those destinations), not just losing the
  orange tackle-risk tint. This is a moveValidator.ts bug, not a client-rendering bug.

  The STEAL path (lines 95-104) does NOT have this problem — it correctly falls through
  to plain ok:true when defenders are filtered to empty. So symptom #1 is asymmetric with
  steal by design — confirms the steal/tackle code paths are structurally different,
  supporting investigation of symptom #2 as a SEPARATE bug elsewhere (client risk-tint
  computation), since the moveValidator steal logic itself looks correct for move validity.

- timestamp: 2026-06-19T00:06:00Z
  checked: packages/shared/src/hex.ts getZoIDefenders (lines 128-133)
  found: |
  getZoIDefenders(position, opponentPieces) is a pure geometric helper — returns
  opponents within hexDistance===1 of position. It has NO knowledge of
  stealAttemptedByIds/tackleAttemptedByIds. Exclusion is the CALLER's responsibility.
  moveValidator.ts correctly applies exclusion for the STEAL case (line 100) by filtering
  allDefenders before checking defenders.length > 0. This is the only place exclusion is
  correctly applied for steal.
  implication: Confirms getZoIDefenders itself is not the bug; exclusion must happen in every caller.

- timestamp: 2026-06-19T00:08:00Z
  checked: packages/client/src/components/HexGrid.tsx lines 141-152 (zoiRiskSet / tackleRiskSet)
  found: |
  zoiRiskSet (steal-risk, red/orange tint shown when carrier selected) is computed by:
  validMoveHexes.filter((hex) => getZoIDefenders(hex, opponents).length > 0)
  This calls getZoIDefenders RAW — directly, with no stealAttemptedByIds filtering at all.
  It does not call moveValidator.validateMove and does not reference state.stealAttemptedByIds.
  tackleRiskSet, by contrast, is NOT computed in HexGrid.tsx — it's read from the
  `tackleRiskHexes` store slice (populated by useGameStore.ts, see below).
  implication: |
  Steal-risk tint (zoiRiskSet) is entirely disconnected from the D-02 exclusion mechanism.
  It will show steal risk on a defender's hex even after that defender is in
  stealAttemptedByIds, because it never checks that array. This IS symptom #2's root cause.

- timestamp: 2026-06-19T00:09:00Z
  checked: packages/client/src/store/useGameStore.ts selectPiece (lines 438-450) and setGameState
  sticky-selection recompute (lines 540-556)
  found: |
  Both call the SHARED validateMove(gameState, piece, hex) for each adjacent candidate hex
  (normal MOVEMENT phase path only — KICK_OFF_SETUP/HIGH_PASS_MOVE/GK_KICK_MOVE/SNAPSHOT_DEFLECT
  have their own bespoke hex-set logic and don't call validateMove at all).
  validMoveHexes = candidates where result.ok === true
  tackleRiskHexes = candidates where result.ok && effect.type === 'TACKLE_ATTEMPT'
  Because moveValidator.ts line 119-121 returns { ok: false, reason: 'TACKLE_ALREADY_ATTEMPTED' }
  for a piece in tackleAttemptedByIds attempting to move adjacent to the carrier, that hex is
  excluded from BOTH validMoveHexes (move disappears entirely) AND tackleRiskHexes (no risk,
  but only because the move itself was rejected, not because risk was correctly suppressed).
  implication: |
  This IS symptom #1's root cause, confirmed end-to-end: moveValidator.ts's TACKLE_ALREADY_ATTEMPTED
  branch (lines 117-121) intentionally blocks the move (ok:false) instead of allowing the move
  and merely omitting the TACKLE_ATTEMPT effect (which is what the STEAL branch does correctly at
  lines 95-104, falling through to plain { ok: true } when defenders are filtered to empty).
  The comment at line 117-118 ("block the move so the client does not highlight adjacent-to-carrier
  hexes as valid for a spent tackler") reveals this was a deliberate design choice in moveValidator.ts
  itself — but it contradicts D-02's explicit requirement that "the attacker can freely move next to
  them... without triggering another tackle challenge" (CONTEXT.md line 121) i.e. the move must
  remain VALID, just without the tackle effect/risk.

- timestamp: 2026-06-19T00:10:00Z
  checked: grep for stealAttemptedByIds/tackleAttemptedByIds anywhere in packages/client/src
  found: No matches found.
  implication: |
  Confirms the client never reads either exclusion array directly. The tackle case only
  "works" (incorrectly, by over-blocking) because moveValidator.ts's reject path happens to
  also remove the hex from valid moves. The steal case has no such indirect mechanism since
  zoiRiskSet bypasses validateMove entirely — so steal-risk tint is never suppressed at all
  after a failed steal, confirmed by direct code inspection of HexGrid.tsx lines 144-150.

- timestamp: 2026-06-19T00:11:00Z
  checked: packages/shared/src/types.ts GameState (lines 483, 485) and packages/server/src/gameHandlers.ts:725
  found: |
  GameState.stealAttemptedByIds / tackleAttemptedByIds are both readonly string[] fields on
  GameState (broadcast to client as part of full game state). gameHandlers.ts resets
  tackleAttemptedByIds: [] at line 725 (one of the PASS-transition reset points per D-02).
  Fields ARE present in the client's gameState slice (useGameStore subscribes to gameState
  wholesale in setGameState) — so the data IS available to the client, it's just never
  consulted by HexGrid.tsx's zoiRiskSet computation.
  implication: |
  Rules out "data never reaches client" as a cause for symptom #2 — the data is present,
  it's simply not wired into the steal-risk tint logic. This is a pure logic/wiring gap,
  not a data-plumbing gap.

## Resolution

root_cause: |
TWO independent root causes, one per symptom, both in the D-02 exclusion implementation:

SYMPTOM #1 (tackle): packages/shared/src/moveValidator.ts lines 117-121. When a defender
(non-carrier piece) who is already in state.tackleAttemptedByIds attempts to move adjacent
to the ball carrier again, validateMove returns { ok: false, reason: 'TACKLE_ALREADY_ATTEMPTED' }
— i.e. it REJECTS the move outright — instead of allowing the move (ok: true) without the
TACKLE_ATTEMPT effect. This contradicts D-02 (17.1-CONTEXT.md lines 113-122), which specifies
the defender should still be able to move into that hex, just without re-triggering the tackle
challenge. Because both packages/client/src/store/useGameStore.ts's selectPiece (lines 438-450)
and setGameState sticky-selection recompute (lines 540-556) derive BOTH validMoveHexes and
tackleRiskHexes from the SAME validateMove() result per candidate hex, rejecting the move
also strips it from validMoveHexes — causing the hex to disappear from the defender's valid
move set entirely, not just lose its orange risk tint. The STEAL branch in the same file
(lines 95-104) does this correctly: it filters excluded defenders out of the effect-trigger
check but still falls through to plain { ok: true } (valid, no effect) when all defenders are
excluded — proving the correct pattern already exists in the same file, just not applied
symmetrically to the tackle branch.

SYMPTOM #2 (steal): packages/client/src/components/HexGrid.tsx lines 144-150. The steal-risk
highlight (zoiRiskSet, the red/orange tint shown when the ball carrier is selected) is computed
directly in the client component via a RAW, unfiltered call to getZoIDefenders(hex, opponents)
— it does not call moveValidator.validateMove and does not reference
state.stealAttemptedByIds anywhere. Confirmed by grep: stealAttemptedByIds/tackleAttemptedByIds
do not appear anywhere in packages/client/src. The exclusion data IS present in GameState and
IS broadcast to the client (types.ts lines 483/485, reset in gameHandlers.ts:725), so this is
a pure logic-wiring gap in the client's risk-tint computation, not a data-plumbing problem.
Steal-risk tint therefore never clears after a failed steal attempt, regardless of
stealAttemptedByIds contents.

fix: |
NOT APPLIED (goal: find_root_cause_only). Suggested directions for a future fix:

1. moveValidator.ts tackle branch (lines 106-124): mirror the steal branch's pattern.
   Instead of `return { ok: false, reason: 'TACKLE_ALREADY_ATTEMPTED' }` when the piece is in
   tackleAttemptedByIds, skip emitting the TACKLE_ATTEMPT effect and fall through to plain
   `{ ok: true }` (move remains valid, just no tackle effect/risk). Remove the
   TACKLE_ALREADY_ATTEMPTED reason from MoveResult's reject union if it becomes unused (check
   other call sites / tests referencing it first — e.g. gameEngine.ts or test files that may
   assert on this reason string).

2. HexGrid.tsx zoiRiskSet (lines 144-150): filter out defenders in state.stealAttemptedByIds
   before counting getZoIDefenders results, mirroring moveValidator.ts's STEAL_ATTEMPT pattern:
   `getZoIDefenders(hex, opponents).filter((d) => !(stealAttemptedByIds ?? []).includes(d.id)).length > 0`
   Requires subscribing to `gameState.stealAttemptedByIds` in HexGrid.tsx (currently not read
   anywhere in the client).

3. Symmetric concern for tackleRiskSet: once fix #1 makes the tackle branch fall through to
   ok:true (no effect) for excluded defenders, tackleRiskHexes (derived from
   TACKLE_ATTEMPT effect presence in useGameStore.ts) will correctly stop including those hexes
   automatically — no separate client fix needed for tackle-risk tint, since tackleRiskHexes
   IS correctly wired to validateMove's effect (unlike zoiRiskSet which bypasses it).

4. Confirmed via grep: no test file currently references TACKLE_ALREADY_ATTEMPTED (only
   moveValidator.ts itself and 17.1-PATTERNS.md mention it) — so removing/changing this
   reject path has no existing test fallout to fix, only new test coverage to add for the
   corrected ok:true/no-effect behavior.

verification: N/A — root-cause-only investigation, no fix applied.
files_changed: []
