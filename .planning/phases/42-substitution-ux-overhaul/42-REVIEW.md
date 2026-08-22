---
phase: 42-substitution-ux-overhaul
reviewed: 2026-08-22T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - packages/client/src/components/ActionLog.test.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx
  - packages/client/src/components/GameBoard.module.css
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/LineupAssignmentScreen.module.css
  - packages/client/src/components/LineupAssignmentScreen.test.tsx
  - packages/client/src/components/LineupAssignmentScreen.tsx
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/server/src/__tests__/gameEngine.redCardExclusion.test.ts
  - packages/server/src/__tests__/gameEngine.rosterReposition.test.ts
  - packages/server/src/__tests__/gameHandlers.redCardExclusion.test.ts
  - packages/server/src/__tests__/gameHandlers.rosterReposition.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/shared/src/events.test.ts
  - packages/shared/src/events.ts
  - packages/shared/src/fouls.test.ts
  - packages/shared/src/fouls.ts
  - packages/shared/src/moveValidator.ts
  - packages/shared/src/moveValidator.test.ts
  - packages/shared/src/outOfBounds.ts
  - packages/shared/src/outOfBounds.test.ts
  - packages/shared/src/passValidator.ts
  - packages/shared/src/passValidator.test.ts
  - packages/shared/src/stoppagePhases.ts
  - packages/shared/src/stoppagePhases.test.ts
  - packages/shared/src/types.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-08-22
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

This phase reworks the mid-match substitution/roster panel: a new positioning-mode
drag-swap (`applyRosterReposition` / `GAME_ROSTER_REPOSITION`), a substitution-mode
bench-drag flow with a confirm popup, and the BUG-38 sweep that converged every
occupancy/eligibility/ZoI check in `packages/shared` onto the shared `isActivePiece`
predicate. The bulk of the code is careful, heavily commented, and internally
consistent — most of the human-verify "gap closure" items visible in this diff
(the sidebar-strip green background, the always-clickable SUB button) read as
already fixed in the current CSS/TSX.

The investigation task asked for an independent root-cause trace of the reported
"player-swap stacking" bug. That trace succeeded: `applyRosterReposition` has a real,
unfixed occupancy gap (CR-01 below) that can place two active pieces on the same pitch
hex. This is a genuine correctness bug, not a cosmetic one, and is classified as a
BLOCKER. Three further WARNING-level robustness/consistency gaps and two INFO-level
items are also reported below.

## Structural Findings (fallow)

None provided for this review (no `<structural_findings>` block was supplied).

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `applyRosterReposition` can stack two active pieces on the same pitch hex

**File:** `packages/server/src/gameEngine.ts:3263-3371` (see also
`packages/shared/src/stoppagePhases.ts:105-107` and
`packages/shared/src/moveValidator.ts:68-74`)

**Issue:**

`applyRosterReposition` is explicitly designed (by D-05) to allow swapping an active
on-pitch piece with a red-carded piece's slot, because a red-carded piece's `position`
field is deliberately never cleared (`types.ts:64-76`, `gameEngine.ts:1088-1093`) — it
stays a stale, frozen `HexCoord` that the piece "occupied" at the moment of dismissal.

Separately, and by design (BUG-38, Phase 42), every occupancy check elsewhere in the
codebase — critically `moveValidator.ts`'s `OCCUPIED` check
(`state.pieces.some((p) => isActivePiece(p) && p.position.q === to.q && ...)`) —
deliberately _excludes_ a red-carded piece from blocking movement onto its frozen hex
("its frozen hex no longer blocks occupancy", `moveValidator.ts:69`). This means that,
over the course of ordinary play after a red card, some OTHER active piece can and
legitimately will move onto the exact hex the sent-off player is frozen at — the game
does not treat that hex as reserved.

`applyRosterReposition`'s swap (`gameEngine.ts:3330-3341`) then does this:

```ts
const newA: PlayerPiece = {
  ...pieceB,
  id: pieceA.id,
  position: pieceA.position,
  number: pieceA.number,
};
const newB: PlayerPiece = {
  ...pieceA,
  id: pieceB.id,
  position: pieceB.position, // <-- inherits the red-carded slot's STALE frozen hex
  number: pieceB.number,
};
```

If `pieceB` is the red-carded slot, `newB` (the previously-active player now occupying
that slot) is teleported to `pieceB.position` — the stale, frozen hex — with **no check
that this hex is currently free**. Because a third active piece may already be legally
standing there (per the paragraph above), the reposition can silently place two active
pieces on the same hex: the pre-existing occupant, and the newly repositioned player.
Nothing in `applyRosterReposition` (guards 1–6, `gameEngine.ts:3269-3327`) validates
target-hex occupancy — unlike every movement-adjacent function in this codebase, which
routes through `isActivePiece`-based occupancy checks. This is exactly the human
tester's reported "player-swap stacking" bug: "swapping into a red-carded player's slot
when an active player is also present there can leave two active players in one slot
instead of a clean swap."

This is confirmed by the existing test suite: `gameEngine.rosterReposition.test.ts`'s
D-05 test (`applyRosterReposition` swap with a red-carded piece, lines 173-200) only
asserts identity/card-state transfer — it never seeds a third piece standing at the
red-carded slot's frozen position, so this gap is untested and unguarded by CI.

**Fix:** Add an occupancy guard to `applyRosterReposition` mirroring
`moveValidator.ts`'s pattern, checked before the swap is built:

```ts
// 6.5. A reposition must never place an active piece onto a hex another active piece
// currently occupies (a red-carded slot's position is frozen and may have been legally
// vacated-into by another piece per BUG-38's isActivePiece occupancy exclusion).
const destinationOccupied = (destPos: HexCoord, movingId: string): boolean =>
  state.pieces.some(
    (p) =>
      p.id !== pieceIdA &&
      p.id !== pieceIdB &&
      isActivePiece(p) &&
      p.position.q === destPos.q &&
      p.position.r === destPos.r,
  );
if (
  destinationOccupied(pieceB.position, pieceA.id) ||
  destinationOccupied(pieceA.position, pieceB.id)
) {
  return { ok: false, reason: 'REPOSITION_TARGET_OCCUPIED' };
}
```

(New rejection reason added to `RosterRepositionRejection`; client message mapping
added alongside the existing `INVALID_REPOSITION`/`GK_SLOT_LOCKED` entries in
`LineupAssignmentScreen.tsx`.) A regression test seeding a third active piece at the
red-carded slot's frozen hex, then asserting the swap is rejected (or, if silent
auto-resolution is preferred, that the destination is safely reassigned), should be
added to `gameEngine.rosterReposition.test.ts`.

## Warnings

### WR-01: `applyRosterReposition` has no ZoI/no-op consistency check with the rest of the reposition-eligibility model, silently permitting a swap that strands a piece off-pitch conceptually

**File:** `packages/server/src/gameEngine.ts:3263-3327`

**Issue:** Guard 6 explicitly documents that red-carded participation is allowed by
design, but there is no defensive check preventing a reposition between two pieces
where BOTH are red-carded (e.g. two sent-off slots swapped with each other). This is
harmless today (nothing observable changes — two inactive slots trade inert identities)
but is unreachable-by-design UI (the client's drag source guard,
`LineupAssignmentScreen.tsx:649-656`, requires `isActivePiece(piece)` for the drag
_source_, so a red-carded piece can never be dragged — only ever a drop _target_).
Since the client can never produce this payload, it is only reachable via a
hand-crafted socket event (tampering). It is not a security hole (no state corruption
results), but it is untested and the engine comment doesn't call out this
degenerate case.

**Fix:** Either explicitly test/document that a double-red-card swap is an inert no-op
(cheap, low-risk), or add a defence-in-depth guard requiring at least one of the two
pieces to be active, matching the "one side must be a legitimate participant" spirit of
the rest of the guard set.

### WR-02: `RosterRepositionRejection`'s `WRONG_TEAM` reason from the handler is never mapped to a client-facing message

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:403-413`,
`packages/server/src/gameHandlers.ts:1879-1883`

**Issue:** The handler can emit `GAME_ERROR` with reason `'WRONG_TEAM'` (line 1880) for
an opponent-owned piece id, but `LineupAssignmentScreen.tsx`'s `gameError` → message
`useEffect` (lines 374-417) has no branch for `'WRONG_TEAM'` — this is called out
explicitly in the comment at lines 408-413 ("'WRONG_TEAM' is deliberately NOT mapped
here: it is unreachable through this UI"). That reasoning holds for the normal
sanctioned client, but a modified/tampered client (or a race where the UI briefly shows
a stale piece list) that manages to emit an opponent's id will show no rejection
message at all — the drag silently fails with no feedback, which is a worse UX
regression than reusing a generic message. This is low-severity (defence-in-depth path
only) but is a real, if narrow, silent-failure gap.

**Fix:** Map `'WRONG_TEAM'` to a generic rejection message (e.g. reusing
`'Swap rejected — invalid selection.'`, the same string used for `INVALID_REPOSITION`)
so no rejection reason is ever silently swallowed by the UI, regardless of how it was
triggered.

### WR-03: `SubstitutionRejection`'s `NON_GK_SLOT_REJECTS_GK`/`GK_SLOT_REQUIRES_GK` reuse pregame copy that doesn't mention "substitution"

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:378-382`

**Issue:** The rejection messages for `GK_SLOT_REQUIRES_GK`/`NON_GK_SLOT_REJECTS_GK`
("Swap rejected — goalkeeper slot requires a GK card." / "...only a goalkeeper card can
be placed here.") are shared verbatim between the pregame lineup-swap flow and the
mid-match substitution flow. In mid-match mode there is no "swap" happening from the
user's point of view — it's a substitution — so the word "Swap" in the toast is
slightly misleading in that context (a cosmetic/UX nit, not a functional bug, but noted
since gameError messaging is the observable contract with the reported CSS/UX gap
-closure work in this same phase).

**Fix:** Consider parameterizing the message by `mode` if this surfaces again in
manual testing; low priority.

## Info

### IN-01: `applyRosterReposition`'s new `REPOSITION_BALL_CARRIER` guard only checks the ball's `carrierId`, not a loose ball's `position`

**File:** `packages/server/src/gameEngine.ts:3314-3320`

**Issue:** Guard 5 rejects a reposition when either piece is the current ball
_carrier_. During a stoppage (the only phase this function runs in) the ball is
typically placed at a fixed restart hex rather than carried, so `carrierId` is often
`null` — meaning this guard is frequently a no-op in practice. This appears intentional
(a stoppage's dead ball has no "carrier" to protect), but it's worth flagging that a
piece standing exactly on the ball's resting hex (not carrying it) can still be
repositioned away, which could, in edge cases, need to be reconciled with restart-hex
occupancy elsewhere. No evidence of an actual defect was found; flagged for
awareness only.

**Fix:** None required; documentation-only observation for the next contributor.

### IN-02: `CardInjuryBadge.tsx` / `BenchCarousel.tsx` (the components most likely to own the reported "duplicate/overlapping bench card icon" bug) are not part of this phase's file set

**File:** N/A (out of review scope)

**Issue:** The task description asks about a "bench card icon rendering bug
(duplicate/overlapping card icons for red-carded players)." Tracing
`LineupAssignmentScreen.tsx`'s bench-status derivation (`benchCardStatus`,
`unavailablePlayerIds`, `redCardedPlayerIds`, lines 999-1011) shows correct,
non-duplicating data construction — one status object per bench entry, no
double-counting. The actual glyph-rendering logic lives in `CardInjuryBadge.tsx` and
`BenchCarousel.tsx`, neither of which is in this phase's reviewed file list, so the
root cause of that specific reported bug could not be independently confirmed within
this review's scope. Recommend including those two files in a follow-up review pass
if the bug is still reproducible.

**Fix:** N/A — scope note only.

---

_Reviewed: 2026-08-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
