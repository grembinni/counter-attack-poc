---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
reviewed: 2026-08-04T18:30:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - packages/client/src/App.test.tsx
  - packages/client/src/App.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/BallLocationRing.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameSettingsScreen.test.tsx
  - packages/client/src/components/GameSettingsScreen.tsx
  - packages/client/src/components/GoalKickSetupPanel.module.css
  - packages/client/src/components/GoalKickSetupPanel.test.tsx
  - packages/client/src/components/GoalKickSetupPanel.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/ThrowInSetupPanel.module.css
  - packages/client/src/components/ThrowInSetupPanel.test.tsx
  - packages/client/src/components/ThrowInSetupPanel.tsx
  - packages/client/src/constants/settingsSummary.ts
  - packages/client/src/mock/mockMovementState.ts
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/server/src/__tests__/draftReconnect.integration.test.ts
  - packages/server/src/__tests__/draftSession.integration.test.ts
  - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts
  - packages/server/src/__tests__/goalKick.integration.test.ts
  - packages/server/src/__tests__/room.integration.test.ts
  - packages/server/src/__tests__/roomStore.test.ts
  - packages/server/src/__tests__/testHelpers.ts
  - packages/server/src/__tests__/throwIn.integration.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/server/src/roomHandlers.ts
  - packages/server/src/roomStore.ts
  - packages/shared/src/actionSequence.test.ts
  - packages/shared/src/actionSequence.ts
  - packages/shared/src/events.ts
  - packages/shared/src/index.ts
  - packages/shared/src/offside.ts
  - packages/shared/src/outOfBounds.test.ts
  - packages/shared/src/outOfBounds.ts
  - packages/shared/src/passValidator.test.ts
  - packages/shared/src/passValidator.ts
  - packages/shared/src/types.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 37: Code Review Report

**Reviewed:** 2026-08-04T18:30:00Z
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

This is a further re-review of the out-of-bounds/throw-in/goal-kick feature set, after the
`37-13` gap-closure plan. The previous review cycle's BLOCKER (CR-01: `applyGoalKickReposition`
accepted an off-pitch destination hex) is confirmed fixed — `gameEngine.ts:3502` now calls
`isPitchHex(to)` inside `applyGoalKickReposition` and `gameHandlers.ts:685` calls it again at
the wire layer, both with extensive comments citing the `37-13` fix and a regression test.
The previous cycle's second WARNING (wasted `kickDie` roll on the `KICKER` slot) is also
confirmed fixed (`gameHandlers.ts:1041` only rolls on the `OPP` slot). All 1,967 tests across
`shared`/`server`/`client` pass.

However, the previous cycle's first WARNING — `GoalKickSetupPanel.tsx` hardcoding its waiting
label directly off `phase` instead of deriving it from state the way its sibling
`ThrowInSetupPanel.tsx` was fixed to do — was **not** addressed; the exact code flagged before
is still present unchanged. This review also independently found two new, previously-unreported
WARNINGs: a ball/carrier visual desync reachable via the GOALKICK-02 reposition windows, and a
gap where only throw-in passes get server-side off-pitch target rejection (every other pass
type, including the uncapped `LONG_BALL`, does not). The previously-flagged `resolveThrowInHex`
last-resort INFO item is still applicable and restated below for completeness, alongside two new
INFO items.

## Warnings

### WR-01: `GoalKickSetupPanel`'s waiting label is still hardcoded off `phase` (carried forward, unfixed)

**File:** `packages/client/src/components/GoalKickSetupPanel.tsx:98-111`

**Issue:** Flagged in the previous review cycle and still present verbatim:

```tsx
if (phase === 'GOAL_KICK_SETUP_GK' || phase === 'GOAL_KICK_SETUP_OPPONENT') {
  const actingTeam = phase === 'GOAL_KICK_SETUP_GK' ? goalKickTeam : oppTeam;

  if (myTeam !== actingTeam) {
    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Goal Kick</span>
        <span className={styles.constraintRow}>
          {phase === 'GOAL_KICK_SETUP_GK' ? 'Attacking' : 'Defending'} team is
          repositioning&hellip;
        </span>
      </div>
    );
  }
```

This is only correct today because `triggerOutOfBoundsRestart`'s `GOAL_KICK` branch always sets
`attackingTeam: goalKickTeam` at trigger time and `applyGoalKickWindowEnd` never changes
`attackingTeam` mid-window, so `phase === 'GOAL_KICK_SETUP_GK' ⟺ activeTeam === attackingTeam`
holds in every reachable state today. That is the exact "coincidentally true today, not
defended by the derivation itself" pattern the sibling `ThrowInSetupPanel.tsx` was already
fixed for in a prior cycle (see `ThrowInSetupPanel.tsx:52-53`'s `actingSideLabel`, derived from
`throwInTeam === attackingTeam` rather than hardcoded off `phase`/`isMyThrow`). A future change
to the goal-kick trigger invariant (e.g. a Phase 38 corner-kick reuse of this same panel shape,
or a defending-team-initiated variant) would silently break this specific label with no
compiler or test signal, since nothing here reads `attackingTeam`/`activeTeam` to derive it.

**Fix:** Mirror `ThrowInSetupPanel.tsx`'s fix — derive from state instead of `phase`:

```tsx
const gkWindowActingLabel: 'Attacking' | 'Defending' =
  actingTeam === goalKickTeam ? 'Attacking' : 'Defending';
// ...
<span className={styles.constraintRow}>{gkWindowActingLabel} team is repositioning&hellip;</span>;
```

(`actingTeam` is already computed one line above this branch.)

### WR-02: Ball visually desyncs from its GK carrier during the goal-kick reposition windows

**File:** `packages/server/src/gameEngine.ts:3420` (`computeGoalKickEligibleIds`) and
`packages/server/src/gameEngine.ts:3452` (`applyGoalKickReposition`)

**Issue:** `computeGoalKickEligibleIds` partitions **every** piece positioned in either final
third into `gkTeam`/`opponent` with no exclusion for the goalkeeper taking the kick
(`goalKickGkId`). Immediately after a goal kick is awarded, `ball.carrierId` is set to the GK
and `ball.position` is set to `gk.position` (`gameEngine.ts:3297-3300`). Because a GK defending
their own byline is almost always standing inside their own final third (e.g. `q ∈ [0,10]` for
home, per `pitch.ts`'s `homeThird` definition — well within the region a GK realistically
occupies), the GK is routinely included in `goalKickEligibleIds.gkTeam` and is therefore
selectable/movable during `GOAL_KICK_SETUP_GK` — neither the server
(`applyGoalKickReposition`, `gameHandlers.ts:655-698`) nor the client (`HexGrid.tsx:787-794`,
`useGameStore.ts:696-728`) excludes `goalKickGkId` from the eligible/selectable set.

`applyGoalKickReposition` moves the piece (`gameEngine.ts:3530`) but never touches
`state.ball` — the `moveEvent.ballAfter` is explicitly the _pre-move_ ball snapshot (see the
comment at `gameEngine.ts:3542-3543`, "Ball unchanged during the reposition windows"). Both
`BallMarker.tsx:32` and `BallLocationRing.tsx:64` render the ball strictly from
`ball.position`, never from the carrier piece's live position. So if a player moves the GK
during their own team's reposition window, the ball marker stays rendered at the GK's pre-move
hex while the GK piece itself renders having moved elsewhere — the ball visibly detaches from
its carrier.

This is compounded by `applyUndo`'s `GOAL_KICK_SETUP_GK`/`GOAL_KICK_SETUP_OPPONENT` branch
(`gameEngine.ts:1692-1696`, `1765-1778`): undoing the GK's move _does_ restore
`ball.position = moveToUndo.from`. Since the forward move never advanced `ball.position` in the
first place, this "restore" can snap the ball to an intermediate hex it was never rendered at
(any hex other than the very first step's origin), making the desync worse, not better.

The bug is self-healing at the next real ball-position write: `applyGoalKickChoice`'s
`'standard'` branch re-derives `ball.position = gk.position` from the GK's _current_ position
(`gameEngine.ts:3733-3737`), and `applyGoalKickTarget` overwrites `ball.position = targetHex`
unconditionally (`gameEngine.ts:3833-3837`). So no permanent incorrect game state results —
only a transient, confusing visual during `GOAL_KICK_SETUP_GK`/`GOAL_KICK_CHOICE`/
`GOAL_KICK_TARGET` if the GK is the piece moved. Not covered by `goalKick.integration.test.ts`,
whose fixtures deliberately seed the GK at `q: 15` (`GK_HEX`) — the pitch's _middle_ third,
outside both `homeThird`/`awayThird` — so the eligibility/desync interaction is never
exercised by the existing suite.

**Fix:** Exclude `goalKickGkId` from `computeGoalKickEligibleIds`'s output (mirroring how
`applyGoalKickTarget` already excludes the GK's own hex as a legal target), or make
`applyGoalKickReposition` sync `state.ball` to the moved piece's new position when
`pieceId === state.ball.carrierId`, matching the invariant `applyMove` already maintains for
every other movement phase:

```ts
// gameEngine.ts, applyGoalKickReposition — after computing newPieces
const newBall = state.ball.carrierId === pieceId ? { ...state.ball, position: to } : state.ball;
// ...and spread `ball: newBall` into the returned state.
```

### WR-03: Off-pitch pass targets are only rejected for throw-ins, not for the general pass flow

**File:** `packages/server/src/gameHandlers.ts:1561-1567`, `packages/shared/src/passValidator.ts:65-94`

**Issue:** `validatePass` deliberately does not check `isPitchHex(to)` (documented as
"RESEARCH.md Assumption A4" at `passValidator.ts:70`), and the only server-side
`isPitchHex(targetHex)` guard in the `GAME_ROLL` PASS handler is scoped to the throw-in
context: `if (isThrowInContext(room.gameState.lastActionType) && !isPitchHex(targetHex))`
(`gameHandlers.ts:1563`). For a normal (non-throw-in) `STANDARD_PASS`/`FIRST_TIME_PASS`/
`HIGH_PASS`/`LONG_BALL`, no code path rejects an off-pitch `targetHex`. This is most exploitable
for `LONG_BALL`, which has no distance cap (`passValidator.ts:91-93`) and whose only landing
constraint (`ownTeammates`-within-5 / `opponents`-adjacent, `passValidator.ts:123-132`) is
trivially satisfied by aiming far outside the 962-hex board where no piece exists. A modified
client can therefore submit a `LONG_BALL`/`HIGH_PASS`/`FIRST_TIME_PASS` with an arbitrary
off-grid `{q, r}` and have the server accept it — `applyRoll`'s PASS branch delivers the ball
directly to `targetHex` with no bounds check (e.g. the "no occupant" `FIRST_TIME_PASS` delivery
path at `gameEngine.ts:2199-2218`), leaving `GameState.ball.position` outside the pitch.
Downstream code that assumes `ball.position` is always a valid pitch hex (offside evaluation,
ZoI/hex-distance calculations, the OOB-05 scatter clamp, rendering) is not designed for this
state.

**Fix:** Move the `isPitchHex(targetHex)` guard in `gameHandlers.ts`'s `GAME_ROLL` PASS branch
out of the `isThrowInContext(...)` conditional so it applies to every pass type unconditionally
(the throw-in-specific `maxDistance` override can remain conditional):

```ts
if (!isPitchHex(targetHex)) {
  socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
  broadcastState(io, room);
  return;
}
```

## Info

### IN-01: `resolveThrowInHex`'s last-resort fallback can still return an occupied hex (carried forward, unchanged)

**File:** `packages/shared/src/outOfBounds.ts:94-134`, consumed at `packages/server/src/gameEngine.ts:3235` and placed at `packages/server/src/gameEngine.ts:3367` (`applyThrowInPlace`)

**Issue:** Unchanged since the previous review cycle. If no free, on-pitch hex exists within
radius 6 of `preferred`, `resolveThrowInHex` returns `preferred` unchanged even if still
occupied, and `applyThrowInPlace` unconditionally teleports the thrower onto it with no
occupancy re-check (`gameEngine.ts:3367`), which would place two pieces on the same hex. Given
the pitch is 37×26 with only 22 pieces (a radius-6 hex disk has far more than 22 cells), this
remains practically unreachable in the current 1v1, 22-piece game.

**Fix:** No action required for v1; if piece count or pitch size ever changes, consider
widening the search radius or returning a null/error signal instead of a possibly-occupied hex.

### IN-02: `ThrowInSetupPanel`'s state-derived acting-side label is provably constant given the current invariants

**File:** `packages/client/src/components/ThrowInSetupPanel.tsx:52-53`

**Issue:** `triggerOutOfBoundsRestart`'s `THROW_IN` branch sets `attackingTeam: throwInTeam` in
the same object literal that sets `throwInTeam` (`gameEngine.ts:3248-3259`), and
`applyThrowInPlace` re-asserts `attackingTeam: throwInTeam` (`gameEngine.ts:3365`). No code
path can change `attackingTeam` away from `throwInTeam` while `phase === 'THROW_IN_SETUP'` (the
only handler active in that phase is `GAME_THROW_IN_PLACE`, which does not diverge them). So
`const actingSideLabel = throwInTeam === attackingTeam ? 'Attacking' : 'Defending'` is provably
always `'Attacking'` at this render site today. This is not a functional bug — deriving from
state (rather than hardcoding off `phase`, as `GoalKickSetupPanel.tsx` still does per WR-01
above) is the more resilient pattern and should be kept as-is — but it is worth a short comment
noting the derivation is currently constant, so a future reader doesn't need to re-derive the
invariant from scratch when deciding whether the `'Defending'` branch is reachable.

**Fix:** Optional; add a one-line comment above `actingSideLabel` noting the invariant, or leave
as-is (no behavior change needed).

### IN-03: Near-byte-for-byte duplicated CSS between `GoalKickSetupPanel.module.css` and `ThrowInSetupPanel.module.css`

**File:** `packages/client/src/components/GoalKickSetupPanel.module.css`,
`packages/client/src/components/ThrowInSetupPanel.module.css`

**Issue:** Both files' `.panel`, `.panelHeading`, `.constraintRow`, `.errorText`, `.ctaButton`,
`.ctaButton:hover`/`:disabled`, `.ctaButtonPending`, and `.ctaButtonReady` rules are identical
line-for-line (lines 1-86 of each file). Per the file header comments, this pattern is also
shared with `FreeKickSetupPanel.module.css`/`ActionPanel.module.css`. Any future tweak to the
shared panel chrome (e.g. spacing token, CTA color) requires editing 3+ files identically, with
drift risk if one is missed.

**Fix:** Extract the shared panel/CTA-button rules into a common `PanelShell.module.css` (or
equivalent) imported by all restart-setup panels, keeping only phase-specific overrides (e.g.
`GoalKickSetupPanel.module.css`'s `.confirmOverlay`/`.confirmCard`) local.

---

_Reviewed: 2026-08-04T18:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
