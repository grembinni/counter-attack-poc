---
phase: 39-fouls-cards-injuries-penalty-kicks
reviewed: 2026-08-15T23:04:38Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - packages/shared/src/types.ts
  - packages/shared/src/fouls.ts
  - packages/shared/src/fouls.test.ts
  - packages/shared/src/events.ts
  - packages/shared/src/shotValidator.ts
  - packages/shared/src/shotValidator.test.ts
  - packages/shared/src/pitch.ts
  - packages/shared/src/pitch.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/server/src/__tests__/gameEngine.fouls.test.ts
  - packages/server/src/__tests__/foulFreeKick.integration.test.ts
  - packages/server/src/__tests__/gameEngine.restartTimeCost.test.ts
  - packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts
  - packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts
  - packages/server/src/__tests__/gameEngine.undoReplay39.test.ts
  - packages/server/src/__tests__/gameEngine.penaltyKick.test.ts
  - packages/server/src/__tests__/penaltyKick.integration.test.ts
  - packages/client/src/components/FoulChoicePanel.tsx
  - packages/client/src/components/FoulChoicePanel.test.tsx
  - packages/client/src/utils/restartErrorMessage.ts
  - packages/client/src/utils/restartErrorMessage.test.ts
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/store/useGameStore.ts
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/GkDiveAtFeetPromptPanel.tsx
  - packages/client/src/components/GkDiveAtFeetPromptPanel.test.tsx
  - packages/client/src/components/BallLocationRing.tsx
  - packages/client/src/components/PenaltyKickSetupPanel.tsx
  - packages/client/src/components/PenaltyKickSetupPanel.test.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionLog.test.tsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 39: Code Review Report (Gap-Closure Round, Plans 39-18..39-24)

**Reviewed:** 2026-08-15T23:04:38Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

This review covers only the gap-closure diff (`0fb210d^..HEAD`, plans 39-18 through
39-24) layered on top of the already-reviewed Phase 39 baseline — restart-placement
fixes (foulHex now the ball's hex, not the fouler's landing hex), Professional Foul
goal-path geometry, GK dive-at-feet two-step targeting, in-box foul → penalty routing
and award-time board setup, penalty-taker confirm+shoot UI, and tackle-from-behind
detection.

The gap-closure work itself is unusually well-documented and thoroughly tested — every
plan's doc comments trace back to a specific UAT gap, and new server logic (fouls.ts's
tackle-from-behind helpers, `applyGkDiveAtFeetTarget`, `relocateOutsidePenaltyArea`,
`triggerPenaltyKick`'s award-time clear-out) is exercised by matching unit and
integration tests, including several "characterisation"/"integration risk proof" tests
that specifically probe the interaction between old and new behaviour (e.g. the fouled
carrier legitimately remaining on `freeKickHex` after the 39-18 fix).

That last interaction, however, surfaces a real defect: 39-18's change to
`triggerFoulFreeKick`'s `foulHex` (now always the fouled carrier's own hex, which the
carrier continues to occupy) turns a previously near-impossible occupancy collision at
`freeKickHex` into the **guaranteed default state** for every foul-triggered free kick —
and the kicker-select step in `applyFreeKickMove` has no server-side occupancy check to
catch it. This is flagged as the sole Critical finding below (CR-01). Two Warnings and
two Info items round out the rest of the review; none of the other gap-closure changes
(GK dive-at-feet two-step flow, penalty award/clear-out, DOGSO goal-path rewrite,
tackle-from-behind widening, actionCount/clock-cost additions) turned up correctness
defects under close tracing.

## Critical Issues

### CR-01: `applyFreeKickMove`'s kicker-select branch has no server-side occupancy check — 39-18 makes the collision the default case for every foul-triggered free kick

**File:** `packages/server/src/gameEngine.ts:8645-8685` (kicker-select branch of
`applyFreeKickMove`), triggered via `triggerFoulFreeKick` (`gameEngine.ts:1531-1556`)

**Issue:**
Before this gap-closure round, `triggerFoulFreeKick`'s `freeKickHex` was the FOULING
defender's landing hex (`to`) — a hex on the CONCEDING team's side, which
`relocateTrappedFreeKickPieces` always vacates before kicker-select begins. Plan 39-18
(closing 39-UAT gap 2) deliberately changed `foulHex`/`freeKickHex` for a
`TACKLE_ATTEMPT`-sourced foul to the fouled **carrier's own hex** instead
(`gameEngine.ts` ~1254, `foulHex: carrier.position`), and the carrier is never moved by
a failed/fouling tackle. For a `STEAL_ATTEMPT`-sourced foul, `foulHex` was already the
carrier's post-move hex. In both cases the carrier — a piece on the KICKING
(fouled) team — is now guaranteed to be standing exactly on `freeKickHex` when
`FREE_KICK_SETUP` begins (`relocateTrappedFreeKickPieces` only relocates the CONCEDING
team; this is confirmed intentional and tested in
`foulFreeKick.integration.test.ts`'s new "39-18 (integration risk proof)" test, which
only exercises placing the _carrier itself_ as kicker).

`applyFreeKickMove`'s kicker-select branch (`state.freeKickKickerChosen === false`)
accepts ANY kicking-team piece and unconditionally writes it onto `freeKickHex`:

```ts
if (state.freeKickKickerChosen === false) {
  if (piece.teamId !== kickingTeam) {
    return { ok: false, reason: 'WRONG_PIECE' };
  }
  if (to.q !== freeKickHex.q || to.r !== freeKickHex.r) {
    return { ok: false, reason: 'KICKER_PLACEMENT_REQUIRED' };
  }
  // no occupancy check anywhere below this point
  const newPieces = state.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p));
  ...
}
```

There is no check anywhere in this branch (nor in the rest of `applyFreeKickMove`) that
`freeKickHex` is unoccupied by another piece before writing the new position. Since the
carrier is now guaranteed to already be standing there, selecting **any kicking-team
piece other than the carrier** as the free-kick taker silently stacks two pieces on the
same hex — a real state-corruption bug (breaks every downstream occupancy/hexDistance
assumption the rest of the codebase relies on).

The client's own `computeFreeKickSetupValidHexes` (`useGameStore.ts:416-423`) DOES guard
this case (`fkOccupied` check returns `[]` for any piece other than the one already on
`freeKickHex`), so an honest client cannot trigger it through the UI — the manager simply
has no way to choose a kicker other than the carrier. But the server is the trust
boundary in this codebase's own stated convention (every sibling reposition function —
`applyPenaltyKickReposition`'s `OCCUPIED` guard, `applyCornerKickReposition`'s occupancy
check, `applyGoalKickReposition`'s occupancy check — re-validates occupancy
server-side, never relying on the client to withhold the action). A modified/forged
`GAME_FREE_KICK_MOVE(otherPieceId, freeKickHex)` message bypasses the client guard
entirely and the server accepts it unconditionally today.

**Fix:** Add an explicit occupancy guard to the kicker-select branch (and, ideally, to
the rest of `applyFreeKickMove`, which has the same gap on its later placement branches
— out of scope for this diff but worth a follow-up), mirroring
`applyPenaltyKickReposition`'s convention:

```ts
if (state.freeKickKickerChosen === false) {
  if (piece.teamId !== kickingTeam) {
    return { ok: false, reason: 'WRONG_PIECE' };
  }
  if (to.q !== freeKickHex.q || to.r !== freeKickHex.r) {
    return { ok: false, reason: 'KICKER_PLACEMENT_REQUIRED' };
  }
  const occupant = state.pieces.find(
    (p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r,
  );
  if (occupant) {
    return { ok: false, reason: 'MOVE_INVALID', detail: 'OCCUPIED' };
  }
  // ... existing placement logic
}
```

Since the carrier legitimately occupies `freeKickHex` in the normal case, rejecting the
action with `OCCUPIED` still leaves the manager stuck (same UX gap the client already
has) — the more complete fix is to special-case "the occupant is the carrier and the
selected piece is also the carrier" as a no-op success (current behaviour), and either
(a) auto-select the carrier as kicker when no other choice is possible, or (b) relocate
the carrier off `freeKickHex` (mirroring `relocateOutsidePenaltyArea`'s pattern used
elsewhere in this same gap-closure round) before a different kicker is placed. At
minimum, the silent same-hex stacking must be closed.

## Warnings

### WR-01: `GK_DIVE_AT_FEET_TARGET` has no decline/escape path if `computeGkDiveAtFeetTargetHexes` returns an empty set

**File:** `packages/shared/src/shotValidator.ts:146-160` (`computeGkDiveAtFeetTargetHexes`),
consumed by `packages/server/src/gameEngine.ts:1943-1980` (`applyGkDiveAtFeetTarget`)

**Issue:** `computeGkDiveAtFeetOffer` (unchanged by this round) only requires
`hexDistance(gk, carrier) <= 3` and `|carrier.q - gk.q| <= 3` before making the offer.
`computeGkDiveAtFeetTargetHexes` requires a hex that is BOTH exactly distance 1 from the
carrier AND on-pitch AND within the GK's 3-hex saveable band. Near a pitch edge/corner
(`PITCH_HEXES` is bounded to q∈[0,36], r∈[0,25], with the 19 even-q `r=0` hexes further
excluded), a carrier can have as few as 2-3 on-pitch neighbours, and it is not proven
that at least one of those neighbours is always within the GK's saveable band once both
the pitch-edge and the 3-hex-band filters are applied together. Once
`applyGkDiveAtFeetResponse(accept: true)` has run, the once-per-cycle cap is already
consumed (by design, per the 39-20 doc comment) and the phase is locked into
`GK_DIVE_AT_FEET_TARGET` with no decline affordance — if the legal hex set is genuinely
empty here, the manager has no action available to progress the game (an `Undo` may or
may not reach far enough back to escape it, since no `GK_DIVE_AT_FEET`-boundary event has
been logged yet at this point).

**Fix:** Either (a) prove exhaustively that `computeGkDiveAtFeetTargetHexes` can never be
empty whenever `computeGkDiveAtFeetOffer` returned non-null (add a property-based/
exhaustive test over every on-pitch carrier position), or (b) add a server-side fallback
in `applyGkDiveAtFeetTarget`/the offer hook that detects an empty legal set and
auto-resolves the dive at the GK's current position (or auto-declines) rather than
stranding the phase.

### WR-02: `PENALTY_KICK_PIECE_IMMOVABLE` guard in `applyPenaltyKickReposition` is currently unreachable dead code

**File:** `packages/server/src/gameEngine.ts:6821-6831`

**Issue:** The guard added by 39-22 to reject moving the chosen taker or the defending
GK is placed AFTER the `eligibleIds.includes(pieceId)` / `NOT_ELIGIBLE` check
(`gameEngine.ts:6813-6819`). Since `applyPenaltyKickTaker` (the only place
`state.penaltyKickEligibleIds` is (re)computed once a taker is known) already excludes
both the taker and the defending GK from `eligibleIds` via
`computePenaltyKickEligibleIds(..., [pieceId, defendingGk?.id])`, and repositioning is
only reachable AFTER `applyPenaltyKickTaker` has run (phase gating), the
`NOT_ELIGIBLE` rejection always fires first for these two pieces — the
`PENALTY_KICK_PIECE_IMMOVABLE` branch can never actually execute under the current data
flow. This isn't a correctness bug today (the intended behaviour — taker/GK can't move —
is still enforced, just by the wrong guard), but it means the "belt and braces" comment's
premise is untested and a future refactor that changes `eligibleIds` computation could
silently rely on a guard that has never actually been exercised in practice.

**Fix:** Add a unit test that reaches `applyPenaltyKickReposition` with `pieceId` equal
to the taker/defending-GK id while `eligibleIds` is NOT the narrowed post-39-22 list
(e.g. directly constructing a `PENALTY_KICK_SETUP_ATTACKING` state with a full
`penaltyKickEligibleIds` and calling `applyPenaltyKickReposition` for the taker id) to
prove the `PENALTY_KICK_PIECE_IMMOVABLE` branch is actually reachable and correct in
isolation, independent of the `NOT_ELIGIBLE` guard's current behaviour.

## Info

### IN-01: `relocateOutsidePenaltyArea`/clear-out does not exclude `redCarded` pieces

**File:** `packages/server/src/gameEngine.ts:663-709` (`relocateOutsidePenaltyArea`),
`gameEngine.ts:6721-6724` (`triggerPenaltyKick`'s `toClearOut` computation)

**Issue:** `toClearOut` is built from every piece inside the defending penalty area
except the defending GK, with no `redCarded !== true` filter (unlike
`computePenaltyKickEligibleIds`, which does exclude `redCarded` pieces). A sent-off
player still occupying a pitch hex (this codebase appears to leave dismissed players on
the board with `redCarded: true` rather than removing them) will be relocated by the
award-time clear-out along with everyone else. This is very likely harmless (a red-carded
piece isn't going anywhere important), but it's an inconsistency worth a one-line comment
confirming it's intentional, since every other penalty-kick helper in this same
gap-closure round (`computePenaltyKickEligibleIds`) explicitly reasons about
`redCarded`.

### IN-02: `applyGkDiveAtFeetTarget`'s `resume` variable is read but the FAIL branch's `wouldBeState` silently falls back to `state.phase`/`state.activeTeam`/`state.movementSlot` if `resume` is null

**File:** `packages/server/src/gameEngine.ts:1955, 2081-2090`

**Issue:** `resume = state.gkDiveAtFeetResume` is destructured and used only in the FAIL
branch's `wouldBeState` (`phase: resume?.phase ?? state.phase`, etc.), exactly mirroring
the pre-existing `applyGkDiveAtFeetResponse` decline-branch pattern. This is consistent
with the codebase's established fallback convention elsewhere, so it's not flagged as a
bug — but unlike the SUCCESS branch (which has an explicit, well-reasoned
`lastActionType: 'SUCCESSFUL_TACKLE'` / `phase: 'PASS'` transition), there is no comment
explaining what a null `resume` at this specific two-step call site would mean in
practice (it would resume into whatever the CURRENT — mid-flight — phase happens to be,
which may not be a sensible resumption point). Given `gkDiveAtFeetResume` is set once at
OFFER time and deliberately kept intact through the ACCEPT step (per the 39-20 doc
comment), a null value here should be unreachable in practice; a short comment noting
that invariant (or a defensive assertion) would make the fallback's safety explicit
rather than implicit.

---

_Reviewed: 2026-08-15T23:04:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
