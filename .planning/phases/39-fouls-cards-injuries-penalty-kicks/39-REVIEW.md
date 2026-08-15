---
phase: 39-fouls-cards-injuries-penalty-kicks
reviewed: 2026-08-15T13:40:07Z
depth: standard
files_reviewed: 72
files_reviewed_list:
  - packages/client/src/App.test.tsx
  - packages/client/src/App.tsx
  - packages/client/src/components/ActionLog.test.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/BallLocationRing.test.tsx
  - packages/client/src/components/BallLocationRing.tsx
  - packages/client/src/components/EventBanner.module.css
  - packages/client/src/components/EventBanner.test.tsx
  - packages/client/src/components/EventBanner.tsx
  - packages/client/src/components/FoulChoicePanel.module.css
  - packages/client/src/components/FoulChoicePanel.test.tsx
  - packages/client/src/components/FoulChoicePanel.tsx
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameSettingsScreen.test.tsx
  - packages/client/src/components/GameSettingsScreen.tsx
  - packages/client/src/components/GkBoxEntryPromptPanel.module.css
  - packages/client/src/components/GkBoxEntryPromptPanel.test.tsx
  - packages/client/src/components/GkBoxEntryPromptPanel.tsx
  - packages/client/src/components/GkDiveAtFeetPromptPanel.module.css
  - packages/client/src/components/GkDiveAtFeetPromptPanel.test.tsx
  - packages/client/src/components/GkDiveAtFeetPromptPanel.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/PenaltyKickSetupPanel.module.css
  - packages/client/src/components/PenaltyKickSetupPanel.test.tsx
  - packages/client/src/components/PenaltyKickSetupPanel.tsx
  - packages/client/src/components/PieceOverlay.test.tsx
  - packages/client/src/components/PieceOverlay.tsx
  - packages/client/src/components/PlayerStatsPanel.module.css
  - packages/client/src/components/PlayerStatsPanel.test.tsx
  - packages/client/src/components/PlayerStatsPanel.tsx
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/client/src/styles/tokens.css
  - packages/server/src/__tests__/cornerKick.integration.test.ts
  - packages/server/src/__tests__/draftReconnect.integration.test.ts
  - packages/server/src/__tests__/draftSession.integration.test.ts
  - packages/server/src/__tests__/foulFreeKick.integration.test.ts
  - packages/server/src/__tests__/game.integration.test.ts
  - packages/server/src/__tests__/gameEngine.booking.test.ts
  - packages/server/src/__tests__/gameEngine.boxEntry.test.ts
  - packages/server/src/__tests__/gameEngine.fouls.test.ts
  - packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts
  - packages/server/src/__tests__/gameEngine.injury.test.ts
  - packages/server/src/__tests__/gameEngine.penaltyKick.test.ts
  - packages/server/src/__tests__/gameEngine.secondHalf.test.ts
  - packages/server/src/__tests__/gameEngine.undoReplay39.test.ts
  - packages/server/src/__tests__/gameHandlers.boxEntry.test.ts
  - packages/server/src/__tests__/gameHandlers.halfTime.test.ts
  - packages/server/src/__tests__/gameHandlers.phase17-06.test.ts
  - packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts
  - packages/server/src/__tests__/goalKick.integration.test.ts
  - packages/server/src/__tests__/penaltyKick.integration.test.ts
  - packages/server/src/__tests__/replay.integration.test.ts
  - packages/server/src/__tests__/room.integration.test.ts
  - packages/server/src/__tests__/shotGkRange.test.ts
  - packages/server/src/__tests__/testHelpers.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/server/src/roomHandlers.ts
  - packages/server/src/roomStore.ts
  - packages/shared/src/events.ts
  - packages/shared/src/fouls.test.ts
  - packages/shared/src/fouls.ts
  - packages/shared/src/index.ts
  - packages/shared/src/pitch.test.ts
  - packages/shared/src/pitch.ts
  - packages/shared/src/shotValidator.test.ts
  - packages/shared/src/shotValidator.ts
  - packages/shared/src/types.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 39: Code Review Report

**Reviewed:** 2026-08-15T13:40:07Z
**Depth:** standard
**Files Reviewed:** 72
**Status:** issues_found

## Summary

Reviewed the Phase 39 (Fouls, Cards, Injuries & Penalty Kicks) implementation across the
shared rule kernel (`fouls.ts`, `shotValidator.ts`, `pitch.ts`, `types.ts`, `events.ts`),
the server engine/handlers (`gameEngine.ts`, `gameHandlers.ts`, `roomHandlers.ts`,
`roomStore.ts`) and the new client panels (`FoulChoicePanel`, `GkDiveAtFeetPromptPanel`,
`GkBoxEntryPromptPanel`, `PenaltyKickSetupPanel`, `PlayerStatsPanel`, `EventBanner`,
`ActionLog`).

Overall this is a carefully engineered, heavily documented change set: dice are rolled
server-side with `crypto.randomInt` (never client-supplied), every new socket handler
follows the same five-step guard shape (null-state → phase → payload allow-list → team
ownership → engine call) with an `isProcessing` mutex, `ROOM_SETTINGS_CONFIRM` re-validates
and re-normalizes the Fouls/Booking/Injury toggles server-side rather than trusting the
client's own normalization, and most of the new restart flows (penalty kick reposition,
GK dive-at-feet, box-entry) correctly exclude `redCarded` pieces from eligibility lists.

The most significant finding is a real correctness gap: `redCarded` (sent-off) pieces are
excluded from GK-dive-at-feet/box-entry/penalty-taker eligibility, and are explicitly
excluded from the "could a teammate have covered this foul" professional-foul check
(`isProfessionalFoul` in `fouls.ts`), but are **not** excluded from the Zone-of-Influence
opponent list that drives `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` triggers. Since a sent-off piece
is deliberately kept on the pitch (never removed from `state.pieces`) but is blocked from
ever moving again, this makes it a permanent, immovable phantom defender that can still
contest and win the ball, and can even draw fresh fouls/cards/injuries against itself. This
is flagged as a BLOCKER below.

A second, smaller finding is a dead/tautological conditional in `FoulChoicePanel.tsx` that
appears to be a copy-paste leftover from the (legitimately conditional) sibling panels.

## Critical Issues

### CR-01: Red-carded (sent-off) pieces retain full Zone-of-Influence and can still contest the ball

**File:** `packages/shared/src/moveValidator.ts:95` (consumed by `packages/server/src/gameEngine.ts:1111-1224`, `resolveFoulChain` at `packages/server/src/gameEngine.ts:751-866`)

**Issue:**
CARD-02/CARD-04 deliberately keep a sent-off piece in `state.pieces` rather than removing
it (see the comment on `applyMove`'s red-card guard, `gameEngine.ts:954-959`), and
`applyMove` correctly rejects any attempt to _move_ a `redCarded` piece
(`gameEngine.ts:957-959`). However, `validateMove`'s Zone-of-Influence computation for
`STEAL_ATTEMPT` never filters `redCarded` pieces out of the opponent list:

```ts
// packages/shared/src/moveValidator.ts:94-102
if (state.ball.carrierId === piece.id) {
  const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId);
  const allDefenders = getZoIDefenders(to, opponents);
  const defenders = allDefenders.filter((d) => !(state.stealAttemptedByIds ?? []).includes(d.id));
  if (defenders.length > 0) {
    return { ok: true, effect: { type: 'STEAL_ATTEMPT', defenders } };
  }
}
```

`getZoIDefenders` (`hex.ts:136-141`) is a pure distance filter with no `redCarded` check
either. `gameEngine.ts`'s `applyMove` then trusts `result.effect.defenders[0]` verbatim
(`gameEngine.ts:1111-1161`) and runs a full steal duel against it — a sent-off player can
still win the ball back via `computeCombinedScore(defender.tackling, die, [])`. The same
gap applies to `TACKLE_ATTEMPT`'s adjacency trigger (`moveValidator.ts:109-124`), although
in practice a `redCarded` piece can never be the _mover_ there since `applyMove` blocks
its own movement — but it can still be the passive `carrier`'s adjacent-opponent target for
another (non-carded) teammate's tackle, which is fine; the bug is specifically that a
`redCarded` piece itself keeps acting as a live defender that the carrier must duel through.

Compounding this, `resolveFoulChain` (`gameEngine.ts:751-866`) — which fires whenever
`defenderDie === FOUL_TRIGGER_DIE` — also never checks whether `defenderId` is already
`redCarded`, so a sent-off "ghost" defender can draw fresh `FOUL_CALLED`/`INJURY_CHECK`/
`BOOKING_CHECK` events against opponents and teammates indefinitely.

This is a real, provable inconsistency: `isProfessionalFoul` (`fouls.ts:129-143`) already
excludes `redCarded` pieces from the "could a teammate have covered this" reachability
check (`fouls.ts:136`, with a dedicated test at `fouls.test.ts:299`), and
`computeGkDiveAtFeetOffer`/`computeBoxEntryOffer`/`computePenaltyKickEligibleIds`/
`applyPenaltyKickTaker` (`gameEngine.ts:1620`, `2010`, `6369`, `6649-6651`) all correctly
exclude `redCarded` pieces from their respective eligibility. Only the core ZoI/duel-trigger
path was missed. No test in the suite (`gameEngine.fouls.test.ts`, `gameEngine.booking.test.ts`,
`gameEngine.injury.test.ts`, etc.) exercises a `redCarded` defender against
`STEAL_ATTEMPT`/`TACKLE_ATTEMPT`, confirming this path is untested.

**Impact:** once any player is sent off, that piece becomes a permanent, unmovable obstacle
that keeps contesting the ball (and can keep drawing further fouls/injuries/cards) for the
rest of the match — a correctness bug that breaks core gameplay after the very feature this
phase implements (cards) is exercised.

**Fix:** filter `redCarded` pieces out of the opponent list before computing ZoI defenders,
and/or add a defensive `redCarded !== true` guard at the top of `resolveFoulChain`:

```ts
// moveValidator.ts
if (state.ball.carrierId === piece.id) {
  const opponents = state.pieces.filter(
    (p) => p.teamId !== piece.teamId && p.redCarded !== true,
  );
  const allDefenders = getZoIDefenders(to, opponents);
  ...
}
// ...and for the TACKLE_ATTEMPT trigger:
if (
  carrier !== undefined &&
  piece.teamId !== carrier.teamId &&
  carrier.redCarded !== true &&
  hexDistance(to, carrier.position) === 1
) { ... }
```

## Warnings

### WR-01: Dead/tautological conditional in FoulChoicePanel's waiting-state label

**File:** `packages/client/src/components/FoulChoicePanel.tsx:20,33,37`
**Issue:**

```ts
const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
...
const decidingTeam = attackingTeam;         // line 33: decidingTeam IS attackingTeam
...
if (myTeam !== decidingTeam) {
  const sideLabel = decidingTeam === attackingTeam ? 'Attacking' : 'Defending'; // line 37
```

`decidingTeam` is assigned directly from `attackingTeam` on line 33, so the comparison on
line 37 (`decidingTeam === attackingTeam`) is always `true` by construction — `sideLabel` can
never be `'Defending'`, making that branch of the ternary dead code. This is almost
certainly a copy-paste artifact from the structurally similar `GkDiveAtFeetPromptPanel.tsx`
and `GkBoxEntryPromptPanel.tsx`, where the identical-looking ternary is _not_ dead — in
those panels `decidingTeam` is derived from `gkDiveAtFeetTeam`/`gkBoxEntryTeam`, a genuinely
different field from `attackingTeam`, so the comparison is meaningful there. In its current
form the displayed text always happens to read "Attacking team is deciding…" (which is
correct today only because `resolveFoulChain`'s callers always set `attackingTeam` to the
fouled/deciding team), but the logic is fragile: a future refactor that decouples "who
decides" from `attackingTeam` would silently keep showing the wrong label, because the check
can never actually catch the divergence.
**Fix:** either remove the dead ternary and hardcode the string (since `decidingTeam` is
always `attackingTeam` here), or — to guard against future drift — compare against the
_reader's own_ relationship to the deciding team instead of comparing a variable to its own
source value, e.g. derive `sideLabel` from `myTeam === state.foulSource ...` semantics or
simply drop the conditional:

```ts
const sideLabel = 'Attacking'; // decidingTeam is always attackingTeam by construction
```

### WR-02: `resolveFoulChain` does not guard against a `redCarded` fouler (see CR-01)

**File:** `packages/server/src/gameEngine.ts:751-866`
**Issue:** Separately from CR-01's root cause, `resolveFoulChain` itself has no defensive
check that `defenderId`'s piece isn't already `redCarded` before appending a new
`FOUL_CALLED`/`INJURY_CHECK`/`BOOKING_CHECK` chain. Every other Phase 39 helper in this file
(`computeGkDiveAtFeetOffer`, `computeBoxEntryOffer`, `computePenaltyKickEligibleIds`,
`applyPenaltyKickTaker`) treats `redCarded` exclusion as a precondition it enforces itself,
not something callers must remember. `resolveFoulChain` breaks that pattern — even once
CR-01's ZoI-level fix lands, this function would still silently process a foul "committed"
by an already-sent-off piece if any other call site ever manages to route one to it.
**Fix:** add a defensive early return, matching the file's established idiom:

```ts
const fouler = pieces.find((p) => p.id === defenderId);
if (fouler?.redCarded === true) {
  return { fouled: false, pieces, eventLog, foulFields: {} };
}
```

### WR-03: `ActionLog` list items keyed by array index despite reordering on every new event

**File:** `packages/client/src/components/ActionLog.tsx:1277,1296`
**Issue:** `ActionLog` renders `recent = [...consolidated].reverse().slice(0, 30)` and keys
every row with `key={index}`. Because the log is re-reversed on every render as new events
are appended, the item that occupies a given `index` changes on almost every state update
(everything shifts down by one). React key stability is violated: React may reuse a DOM/row
instance for a logically different event, which can cause stale `style`/color mismatches or
incorrect CSS transition/animation behavior on rows, and makes the component harder to
reason about for future maintainers relying on key stability. Every event type in
`ActionEvent` already carries a `timestamp: number` field, and move-group entries carry a
`groupKey` — a stable key is one small step away.
**Fix:** derive a stable key, e.g. `` `${item.event.timestamp}-${index}` `` for event items and
`item.groupKey` for move groups, instead of the bare `index`.

## Info

### IN-01: `injuryPenalty` helper is exported but never consumed by any duel site

**File:** `packages/shared/src/fouls.ts:44-52`
**Issue:** `injuryPenalty` is exported with an explicit warning in its own doc comment that
adding it to a `computeCombinedScore` penalty array would double-count injury (since
INJURY-02 is delivered via stored attribute mutation instead). Grepping the reviewed file
set turns up no call site for this function outside its own doc comment — it is dead,
unused public API surface that exists only as a documented "do not use this" trap. This
isn't wrong, but it is a maintenance smell: an unused exported function whose entire purpose
is a warning against using it is easy for a future contributor to miss and wire up
incorrectly anyway.
**Fix:** either remove `injuryPenalty` until Phase 40 (Substitutions) actually needs it, or
mark it `@deprecated`/`@internal` more forcefully, or add a one-line unit test asserting it
is intentionally unused (as documentation-as-code) if it must stay exported for a future
consumer.

### IN-02: `PENALTY_KICK_TAKER_SELECT` client-side piece-click guard omits the `redCarded` check present server-side

**File:** `packages/client/src/store/useGameStore.ts:1270-1287`
**Issue:** The client-side click handler for selecting a penalty taker checks
`piece.teamId !== myTeam`, `piece.teamId !== gameState.penaltyKickTeam`, and
`piece.role === 'GK'`, but does not also exclude `piece.redCarded === true` the way the
server's `applyPenaltyKickTaker` does (`gameEngine.ts:6646-6654`, `TAKER_INVALID`). This is
not a security issue (the server is authoritative and will reject the request), but it means
a manager can click a sent-off teammate and get a round-trip `GAME_ERROR` instead of the
piece simply being unselectable/un-clickable, which is worse UX than the other guards in the
same block provide.
**Fix:** add `|| piece.redCarded === true` to the rejection condition on line ~1279 to match
server-side eligibility before emitting.

---

_Reviewed: 2026-08-15T13:40:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
