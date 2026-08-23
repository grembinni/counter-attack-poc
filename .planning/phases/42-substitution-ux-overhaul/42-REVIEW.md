---
phase: 42-substitution-ux-overhaul
reviewed: 2026-08-22T00:00:00Z
depth: standard
files_reviewed: 37
files_reviewed_list:
  - packages/client/src/components/ActionLog.test.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/BenchCarousel.test.tsx
  - packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx
  - packages/client/src/components/DraftPackCarousel.tsx
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
  - packages/server/src/__tests__/gameEngine.freeKickWallDistance.test.ts
  - packages/server/src/__tests__/gameEngine.redCardExclusion.test.ts
  - packages/server/src/__tests__/gameEngine.rosterReposition.test.ts
  - packages/server/src/__tests__/gameHandlers.phase17-06.test.ts
  - packages/server/src/__tests__/gameHandlers.redCardExclusion.test.ts
  - packages/server/src/__tests__/gameHandlers.rosterReposition.test.ts
  - packages/server/src/__tests__/offside.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/shared/src/events.test.ts
  - packages/shared/src/events.ts
  - packages/shared/src/fouls.test.ts
  - packages/shared/src/fouls.ts
  - packages/shared/src/moveValidator.test.ts
  - packages/shared/src/moveValidator.ts
  - packages/shared/src/outOfBounds.test.ts
  - packages/shared/src/outOfBounds.ts
  - packages/shared/src/passValidator.test.ts
  - packages/shared/src/passValidator.ts
  - packages/shared/src/stoppagePhases.test.ts
  - packages/shared/src/stoppagePhases.ts
  - packages/shared/src/types.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 42: Code Review Report

**Reviewed:** 2026-08-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 37 (plus types.ts read for shared-type context)
**Status:** issues_found

## Summary

This phase adds the SUB-08 "roster reposition" (formation-position swap) feature, its
`ROSTER_REPOSITION` event/undo-boundary plumbing, and a large `BUG-38` sweep that converts
ad-hoc `redCarded`/`onPitch` checks across `packages/shared` and `packages/server` into the
single shared `isActivePiece` predicate. The new `applyRosterReposition` engine function,
its socket handler, and the client drag/drop UI in `LineupAssignmentScreen.tsx` are
extensively documented, guard-ordered defensively (client UX gate + handler-level ownership
check + engine-level re-validation, in that order), and backed by a thorough dedicated test
suite (`gameEngine.rosterReposition.test.ts`, `gameHandlers.rosterReposition.test.ts`) that
exercises every rejection path including the destination-occupancy edge case (gap item 6).
No BLOCKER-level defects (security, data loss, crash) were found in the reviewed scope.

Two WARNING-level correctness gaps were found, both in areas the codebase's own `BUG-38`
audit explicitly targeted but did not fully close: `passValidator.ts`'s Long Ball landing
restriction still uses raw (non-`isActivePiece`-filtered) piece lists, and
`applyQuickThrow`'s known TODO (opponent-occupied target hex should transfer possession) is
still open. One INFO-level cleanup item was found in `DraftPackCarousel.tsx`.

## Warnings

### WR-01: Long Ball landing restriction is not filtered through `isActivePiece`, unlike every other check in the same function

**File:** `packages/shared/src/passValidator.ts:131-140`

**Issue:** `validatePass`'s `LONG` branch computes `ownTeammates` and `opponents` directly
from `state.pieces` with no `isActivePiece` filter:

```ts
if (passType === 'LONG') {
  const ownTeammates = state.pieces.filter((p) => p.teamId === piece.teamId && p.id !== piece.id);
  if (ownTeammates.some((p) => hexDistance(to, p.position) <= 5)) {
    return { ok: false, reason: 'LANDING_RESTRICTED' };
  }
  const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId);
  if (opponents.some((p) => hexDistance(to, p.position) <= 1)) {
    return { ok: false, reason: 'LANDING_RESTRICTED' };
  }
}
```

Every other occupancy/eligibility computation in this same file (the `STANDARD` path-block
`opponentPieces`, the `HIGH`/`LONG` adjacent-blocker `opponentPieces`, the `destDefender`
auto-intercept lookup, and the `rollIntercepts` ZoI `opponents` list) was explicitly updated
by the `BUG-38` sweep (see the inline `BUG-38` comments at lines 102-106, 113-116, and
151-158) to exclude red-carded/benched pieces via `isActivePiece`, because
`stoppagePhases.ts`'s own doc comment states this predicate must be used for "eligibility/
occupancy/ZoI/interceptor lists, anywhere in `packages/shared`". These two `LONG`-only
landing-restriction lists were missed by that sweep. A red-carded or subbed-off piece keeps
a live, frozen `position` in `state.pieces` (by design — see `PlayerPiece.onPitch`'s doc
comment in `types.ts`), so today a Long Ball can be wrongly rejected with
`LANDING_RESTRICTED` because of a teammate who was sent off five minutes ago and is sitting
motionless on a frozen hex, or because of an opponent's frozen red-card hex sitting next to
the intended landing spot. `passValidator.test.ts` has dedicated `BUG-38` coverage for the
`STANDARD`/`HIGH`/`LONG` path-blocking branches (lines 265-337: `redCarded`/`onPitch: false`
opponents excluded) but no equivalent test for the `LONG` landing-restriction branch,
confirming this is an untested gap rather than a deliberate exclusion.

**Fix:**

```ts
if (passType === 'LONG') {
  const ownTeammates = state.pieces.filter(
    (p) => p.teamId === piece.teamId && p.id !== piece.id && isActivePiece(p),
  );
  if (ownTeammates.some((p) => hexDistance(to, p.position) <= 5)) {
    return { ok: false, reason: 'LANDING_RESTRICTED' };
  }
  const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId && isActivePiece(p));
  if (opponents.some((p) => hexDistance(to, p.position) <= 1)) {
    return { ok: false, reason: 'LANDING_RESTRICTED' };
  }
}
```

(`isActivePiece` is already imported in this file at line 20.)

### WR-02: `applyQuickThrow` never hands possession to an opponent standing on the throw target hex

**File:** `packages/server/src/gameEngine.ts:8143-8168`

**Issue:** `applyQuickThrow` resolves the GK's unblockable/uninterceptable quick throw by
looking only for a teammate at `targetHex` to become the new carrier:

```ts
// Find a teammate at the target hex to become the new carrier.
// TODO: if an OPPOSING player occupies targetHex, they should immediately gain possession
// (change of possession; ball.carrierId = opponent piece, attackingTeam flips). Currently
// the ball lands as a loose ball (carrierId: null) and the opponent never gets possession.
// Fix: also search for an opponent piece at targetHex; if found, set carrierId to that piece
// and flip attackingTeam/activeTeam to the opponent's team before transitioning to PASS.
const receiver = state.pieces.find(
  (p) =>
    isActivePiece(p) &&
    p.teamId === gk.teamId &&
    p.position.q === targetHex.q &&
    p.position.r === targetHex.r,
);
```

This is a live, self-documented TODO (not new to this phase, but present in a file under
review) describing incorrect game behavior: if the GK's manager throws to a hex an opponent
is standing on, the ball becomes a carrier-less loose ball at that hex instead of the
opponent immediately gaining possession, which both misrepresents what "quick throw" means
in the rulebook and denies the defending side the possession change they are entitled to.

**Fix:** As the TODO itself proposes — also search for an opposing piece at `targetHex`; if
found, set `ball.carrierId` to that piece's id and flip `attackingTeam`/`activeTeam` to the
opponent's team before transitioning to `PASS`, mirroring how other restart resolution
functions in this file (e.g. auto-interception paths) already perform a possession flip.

## Info

### IN-01: `DraftPackCarousel`'s post-scroll `setTimeout` is not cleared on unmount

**File:** `packages/client/src/components/DraftPackCarousel.tsx:223-229`

**Issue:**

```ts
function scrollByCard(direction: 1 | -1) {
  const el = trackRef.current;
  if (!el) return;
  el.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: 'smooth' });
  // Smooth scroll settles asynchronously — re-check disabled state shortly after.
  setTimeout(updateScrollState, 300);
}
```

If the user clicks the carousel-nav arrow and the component unmounts within the 300ms window
(e.g. the draft/roster panel is closed immediately after), this timer still fires and calls
`setCanScrollLeft`/`setCanScrollRight` on an unmounted component. React 18 treats this as a
silent no-op rather than a hard error, but it is a lingering-timer code smell that can produce
noisy warnings under React's strict/test double-invoke mode and is worth cleaning up.

**Fix:** Store the timer id in a ref and clear it in a `useEffect` cleanup, or clear/replace
it on each call:

```ts
const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
function scrollByCard(direction: 1 | -1) {
  const el = trackRef.current;
  if (!el) return;
  el.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: 'smooth' });
  clearTimeout(scrollTimeoutRef.current);
  scrollTimeoutRef.current = setTimeout(updateScrollState, 300);
}
useEffect(() => () => clearTimeout(scrollTimeoutRef.current), []);
```

---

_Reviewed: 2026-08-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
