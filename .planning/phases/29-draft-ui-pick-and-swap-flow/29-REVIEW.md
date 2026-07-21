---
phase: 29-draft-ui-pick-and-swap-flow
reviewed: 2026-07-21T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - packages/client/src/App.tsx
  - packages/client/src/components/BenchCarousel.test.tsx
  - packages/client/src/components/BenchCarousel.tsx
  - packages/client/src/components/DraftPackCarousel.test.tsx
  - packages/client/src/components/DraftPackCarousel.tsx
  - packages/client/src/components/LineupAssignmentScreen.module.css
  - packages/client/src/components/LineupAssignmentScreen.test.tsx
  - packages/client/src/components/LineupAssignmentScreen.tsx
  - packages/server/src/__tests__/draftReconnect.integration.test.ts
  - packages/server/src/__tests__/draftSession.integration.test.ts
  - packages/server/src/createServer.ts
  - packages/server/src/draftSession.test.ts
  - packages/server/src/draftSession.ts
  - packages/server/src/roomHandlers.ts
  - packages/server/src/roomStore.ts
  - packages/shared/src/events.ts
  - packages/shared/src/types.ts
findings:
  critical: 3
  warning: 3
  info: 3
  total: 9
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-07-21T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the full draft-mode feature (Phase 29, plans 01-09, including the 29-07/29-08 gap-closure
fixes). The pure state machine (`draftSession.ts`), the privacy-scoped view projection
(`buildDraftView`), and the bulk of the server-side allow-list validation in `roomHandlers.ts` are
well constructed and consistent with the codebase's established ASVS-style conventions (ASVS V5
allow-lists, mutex guards, server-authoritative resolution). Unit test coverage in
`draftSession.test.ts` is thorough for the pure state machine.

However, three **server-authoritative lifecycle gaps** were found that are distinct from the
already-tracked `applyRearrange` slot-swap-vs-displacement gap (packages/server/src/draftSession.ts
~lines 286-295, tracked in 29-VERIFICATION.md for a 29-10 gap-closure plan — not re-reported here,
though one Warning below is a side effect of the same displacement mechanic):

1. `LINEUP_CONFIRM` never verifies that the draft actually finished (`draftSession.draftComplete`)
   before accepting a draft-mode confirm — a forged/buggy client can lock in a lineup, and even
   start the match, mid-draft.
2. `DRAFT_PICK` never checks whether the match has already started (`room.gameState !== null`),
   so — combined with (1) — a client can keep mutating the draft session and re-emitting
   `DRAFT_STATE_UPDATED` after `GAME_STATE` exists, which the client's own handler interprets as
   "go back to the lineup screen," forcibly kicking both players out of a live match.
3. The mid-game reconnect path explicitly skips re-sending `DRAFT_STATE_UPDATED` once
   `draftSession.draftComplete` is true, so a disconnect/reconnect during the (now legitimate,
   per gap-closure Plan 07) post-draft rearrange window leaves the reconnecting client with no
   state to render and no event that routes it back to the lineup screen.

A client-side scroll-reset bug in `BenchCarousel` (an unmemoized array recreated every render)
and a data-integrity gap in the cycle-4 draft-completion transition (leftover pack cards never
cleared) round out the Warnings. See below for full detail and fixes.

## Critical Issues

### CR-01: Draft-mode `LINEUP_CONFIRM` doesn't require the draft to be complete

**File:** `packages/server/src/roomHandlers.ts:697-738`
**Issue:** The `LINEUP_CONFIRM` handler's draft-mode branch (`isDraftRoom`) only checks that the
confirming side's `lineupSlots` has no `null` entries (`resolveDraftOrder(...) === null` ->
`LINEUP_INCOMPLETE`). It never checks `room.draftSession.draftComplete`. Because a full 4-cycle
draft yields 4 picks/cycle (1+2+1) = 16 cards per player, but only 11 lineup slots need to be
_filled_ to pass this check, a player can legitimately fill all 11 starting-lineup slots by the
end of cycle 3 (12 picks made) — well before `draftComplete` is set at the end of cycle 4. The
client UI gates the Confirm button on `draftView.draftComplete` (`LineupAssignmentScreen.tsx:601`),
but that is a UI-only gate; nothing stops a raw/forged `LINEUP_CONFIRM` socket emit from an
already-lineup-complete-but-still-drafting side.

Practical consequence: if both sides trigger this early (or one triggers it and the other later
confirms normally), `buildInitialGameState`/`broadcastState` fire and `GAME_STATE` is emitted
**while `room.draftSession.draftComplete` is still `false`** — i.e., the match starts before the
draft the game design requires (all 16 picks) has actually finished. This also sets up the
CR-02 exploit chain below, since `DRAFT_PICK` is gated solely on `draftSession.draftComplete`,
not on `room.gameState`.

**Fix:**

```ts
if (isDraftRoom) {
  const session = room.draftSession!;
  if (!session.draftComplete) {
    socket.emit(ServerEvents.GAME_ERROR, 'DRAFT_NOT_COMPLETE');
    return;
  }
  const side = playerSlot === 1 ? 'home' : 'away';
  const slotsToCheck = side === 'home' ? session.homeLineupSlots : session.awayLineupSlots;
  if (resolveDraftOrder(slotsToCheck) === null) {
    socket.emit(ServerEvents.GAME_ERROR, 'LINEUP_INCOMPLETE');
    return;
  }
}
```

### CR-02: `DRAFT_PICK` never checks whether the match has already started

**File:** `packages/server/src/roomHandlers.ts:809-899`
**Issue:** The only guard at the top of the `DRAFT_PICK` handler is:

```ts
if (!room.draftSession || room.draftSession.draftComplete) {
  socket.emit(ServerEvents.GAME_ERROR, 'NOT_DRAFTING');
  return;
}
```

There is no check on `room.gameState`. In the intended flow this is harmless because
`draftSession.draftComplete` only becomes `true` once, after which `LINEUP_CONFIRM` (once both
sides confirm) builds `GAME_STATE` — so by the time `GAME_STATE` exists, `draftComplete` is
already `true` and this guard already rejects further picks. But because of CR-01, `GAME_STATE`
can be built **before** `draftComplete` flips to `true`. In that window, a client can continue to
emit `DRAFT_PICK`, which mutates `room.draftSession` and calls `emitDraftViews(io, room)`
(`roomHandlers.ts:895`), unicasting a fresh `DRAFT_STATE_UPDATED` to both players.

On the client, `DRAFT_STATE_UPDATED` is handled unconditionally regardless of current screen:

```ts
function onDraftStateUpdated(view: DraftClientView) {
  setDraftView(view);
  if (useGameStore.getState().screen !== 'LINEUP_ASSIGNMENT') {
    setLineupConfirmed(false);
    setScreen('LINEUP_ASSIGNMENT');
  }
}
```

(`packages/client/src/App.tsx:165-171`). If this event arrives while a player is on `GAME_BOARD`
(match already live), it forcibly switches their screen back to `LINEUP_ASSIGNMENT`, effectively
kicking both players out of an in-progress match.

**Fix:** Reject `DRAFT_PICK` (and, for defense-in-depth, `DRAFT_REARRANGE`, which already checks
`requesterConfirmed` but not blanket `room.gameState`) once the match has started:

```ts
if (!room.draftSession || room.draftSession.draftComplete || room.gameState !== null) {
  socket.emit(ServerEvents.GAME_ERROR, 'NOT_DRAFTING');
  return;
}
```

This should be paired with the CR-01 fix — either fix alone closes the immediate exploit path,
but both independently guard against the same invariant ("draft mutation is only valid before a
game exists") and should not rely on each other to hold.

### CR-03: Reconnect during the post-draft-complete, pre-confirm window leaves the client with no synced state

**File:** `packages/server/src/createServer.ts:140-153`
**Issue:** The reconnect handler re-syncs state in two ways:

```ts
if (room.gameState !== null) {
  socket.emit(ServerEvents.GAME_STATE, room.gameState);
  socket.to(room.roomCode).emit(ServerEvents.GAME_STATE, room.gameState);
}

if (room.teamType === 'draft' && room.draftSession && !room.draftSession.draftComplete) {
  const side = socket.data.playerSlot === 1 ? 'home' : 'away';
  socket.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room.draftSession, side));
}
```

The second branch explicitly requires `!room.draftSession.draftComplete`. Gap-closure Plan 07
(DRAFT-09/D-08/D-15, `roomHandlers.ts:906-911`) intentionally made `DRAFT_REARRANGE` legal _after_
`draftComplete` becomes `true` and before both sides confirm — a legitimate "arrange your finished
roster" window. If a player disconnects and reconnects during exactly that window:

- `room.gameState` is still `null` (neither side has confirmed yet), so the first branch no-ops.
- `room.draftSession.draftComplete` is `true`, so the second branch's `!draftComplete` condition
  is `false` and it also no-ops.

The reconnecting socket receives `ROOM_JOINED` (restoring `roomCode`/`playerSlot`) but no
`GAME_STATE` and no `DRAFT_STATE_UPDATED` — no server event routes the client back to
`LINEUP_ASSIGNMENT`, so after a page reload (which resets the Zustand store to its `LANDING`
default, per the App.tsx comment on line 55) the player is stuck. This exact scenario is untested
— `draftReconnect.integration.test.ts` only covers a mid-draft (`draftComplete === false`)
reconnect.

**Fix:** Drop the `!draftSession.draftComplete` condition (or split it: always re-send
`DRAFT_STATE_UPDATED` for any live, non-game-started draft room, complete or not):

```ts
if (room.teamType === 'draft' && room.draftSession && room.gameState === null) {
  const side = socket.data.playerSlot === 1 ? 'home' : 'away';
  socket.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room.draftSession, side));
}
```

## Warnings

### WR-01: `BenchCarousel`'s scroll-reset effect fires on every unrelated re-render, not just when the bench actually changes

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:528-530`,
`packages/client/src/components/BenchCarousel.tsx:63-68`
**Issue:** `LineupAssignmentScreen` computes the `cards` array passed to `BenchCarousel` inline on
every render:

```ts
const benchCards = draftView.benchIds
  .map(resolveTieredCard)
  .filter((c): c is TieredPoolPlayer => c !== null);
```

This produces a **new array reference every render**, regardless of whether `draftView.benchIds`
actually changed. `BenchCarousel`'s own effect resets scroll position whenever its `cards` prop's
identity changes:

```ts
useEffect(() => {
  const el = trackRef.current;
  if (!el) return;
  el.scrollLeft = 0;
  updateScrollState();
}, [cards]);
```

Because `LineupAssignmentScreen` has several pieces of local drag/hover state that change during
every drag gesture (`dragState`, `draftDropTargetIndex`, `rejectionMessage`), and each of those
state changes triggers a re-render that recreates `benchCards`, the bench carousel's scroll
position snaps back to the leftmost card on effectively every hover-target change during a drag —
including while the user is actively dragging a card across the formation grid trying to find a
slot to drop it on. This directly undermines the exact feature (D-21 carousel navigation for a
0-16-card bench) the 29-08 gap-closure introduced. `DraftPackCarousel` does not have this problem
because it's handed `draftView.currentPack` directly (a stable reference unless the pack itself
changes).

**Fix:** Memoize the derived array on the data it actually depends on:

```ts
const benchCards = useMemo(
  () => draftView.benchIds.map(resolveTieredCard).filter((c): c is TieredPoolPlayer => c !== null),
  [draftView.benchIds],
);
```

(`draftView.benchIds` keeps a stable reference across updates that don't touch the bench, per
`draftSession.ts`'s `withSide`/`getSide` pattern, so this correctly reduces churn.)

### WR-02: Cycle-4's final draft transition doesn't clear leftover pack cards, violating the documented D-02 discard invariant

**File:** `packages/server/src/draftSession.ts:343-351`
**Issue:**

```ts
// subStep === 'PICK3': leftover 3 cards discarded (D-02) — never carried into openNextPack.
if (session.cycle < 4) {
  return openNextPack(session);
}

return {
  ...session,
  draftComplete: true,
};
```

For cycles 1-3, `openNextPack` overwrites `homeCurrentPack`/`awayCurrentPack` from the next pack,
which is how the "3 leftover cards are discarded" comment holds true. For cycle 4, there is no
subsequent `openNextPack` call — the final `{...session, draftComplete: true}` return leaves
`homeCurrentPack`/`awayCurrentPack` populated with cycle 4's 3 un-drafted PICK3 leftovers. The
final `DraftClientView` sent at the draftComplete transition (`buildDraftView`,
`draftSession.ts:461`) therefore still carries those 3 undrafted cards in `currentPack`. This is
currently invisible in the UI (the client hides `DraftPackCarousel` once
`draftView.draftComplete` is true — `LineupAssignmentScreen.tsx:563`), but it is a real
discrepancy from the documented invariant and a latent trap for any future code that assumes
`draftComplete === true ⇒ currentPack === []`. It's also untested — no test in
`draftSession.test.ts` asserts `currentPack` is empty at the cycle-4 completion boundary.
**Fix:** Explicitly clear both packs in the `draftComplete: true` return:

```ts
return {
  ...session,
  homeCurrentPack: [],
  awayCurrentPack: [],
  draftComplete: true,
};
```

### WR-03: Bench cards moved via `DRAFT_REARRANGE` after draft-completion never receive a jersey number

**File:** `packages/server/src/roomHandlers.ts:885-892`, `packages/server/src/roomHandlers.ts:913-993`
**Issue:** Bench jersey numbers are assigned exactly once, inside `DRAFT_PICK`, on the transition
into `draftComplete`:

```ts
if (room.draftSession.draftComplete) {
  room.draftSession = {
    ...room.draftSession,
    homeBenchNumbers: assignBenchNumbers(room.draftSession.homeBenchIds, randomInt),
    awayBenchNumbers: assignBenchNumbers(room.draftSession.awayBenchIds, randomInt),
  };
}
```

This is correctly guarded to run only once (`DRAFT_PICK` itself is unreachable once
`draftComplete` is `true`). However, gap-closure Plan 07 legitimately allows `DRAFT_REARRANGE`
after `draftComplete` (moving a lineup card to the bench, or vice versa) and that handler never
recomputes `homeBenchNumbers`/`awayBenchNumbers`. Any card that lands on the bench via a
post-completion rearrange — either an intentional "move to bench" action, or a card displaced by
the already-tracked `applyRearrange` slot-to-slot swap bug (`draftSession.ts:286-295`) — has no
entry in `benchNumbers` and is rendered with no jersey number
(`BenchCarousel.tsx:140` / `LineupAssignmentScreen.tsx:585`: `benchNumbers?.[card.id]` is
`undefined`, so the `#n` chip is simply omitted).
**Fix:** Recompute (or top up) bench numbers after a `DRAFT_REARRANGE` that changes bench
membership, e.g. in the `DRAFT_REARRANGE` handler after `applyRearrange` succeeds:

```ts
const side = ...;
const benchIds = side === 'home' ? result.session.homeBenchIds : result.session.awayBenchIds;
const existingNumbers = side === 'home' ? result.session.homeBenchNumbers : result.session.awayBenchNumbers;
const missingIds = benchIds.filter((id) => existingNumbers[id] === undefined);
if (missingIds.length > 0) {
  const newNumbers = assignBenchNumbers(missingIds, randomInt); // extend to avoid collisions with existingNumbers
  // merge into homeBenchNumbers/awayBenchNumbers
}
```

## Info

### IN-01: `LINEUP_SWAP` has no draft-mode guard, unlike `DRAFT_PICK`/`DRAFT_REARRANGE`

**File:** `packages/server/src/roomHandlers.ts:623-675`
**Issue:** For a draft-mode room, `room.homeAssignment`/`room.awayAssignment` are set to
`Array(11).fill(null)` (a permanent placeholder shell, see `roomHandlers.ts:573-574`). The
`LINEUP_SWAP` handler's `!assignment` guard treats this array as valid (it's truthy), so a
`LINEUP_SWAP` sent to a draft-mode room passes all validation and silently "succeeds," swapping
two `null` entries and emitting a meaningless all-null `LINEUP_ASSIGNMENT_UPDATED` back to the
requester. Currently harmless — no client code path emits `LINEUP_SWAP` in draft mode, and the
resulting event is ignored by the draft-mode branch of `LineupAssignmentScreen` — but it's an
inconsistency: `DRAFT_PICK`/`DRAFT_REARRANGE` explicitly guard on `room.draftSession`, while
`LINEUP_SWAP` has no equivalent "reject if this is a draft room" check.
**Fix:** Add `if (room.teamType === 'draft') { socket.emit(GAME_ERROR, 'WRONG_PHASE'); return; }`
near the top of the handler.

### IN-02: `destination.type` / `from.type` / `to.type` discriminants aren't allow-list validated

**File:** `packages/server/src/draftSession.ts:228-238,270-295`;
`packages/server/src/roomHandlers.ts:830-840,940-952`
**Issue:** `DRAFT_PICK`'s `T-29-06` validation and `DRAFT_REARRANGE`'s equivalent loop only bounds
check `slotIndex` when `type === 'slot'`. Neither validates that `type` is actually `'slot'` or
`'bench'` before delegating to `applyPick`/`applyRearrange`. Both of those functions treat any
non-`'slot'` type as `'bench'` by default (`else { newBenchIds = [...] }` /
`else { benchIds = [...] }`), so a malformed or typo'd `type` value (e.g. `'Slot'`, `'foo'`)
silently falls through to bench-append/bench-source semantics instead of being rejected. This is
not currently exploitable (bench append is always safe, and a bogus `benchIndex` is caught by the
downstream `!occupant` check), but it's inconsistent with the strict ASVS-style allow-list
validation used everywhere else in this file (e.g. `VALID_TEAM_IDS`, `VALID_GAME_SPEEDS`).
**Fix:** Add an explicit `type` allow-list check (`ref.type !== 'slot' && ref.type !== 'bench'` ->
reject) before delegating to the pure state-machine functions.

### IN-03: Lineup slot bounds (`10`/`11`) are repeated as magic numbers instead of a shared constant

**File:** `packages/server/src/roomHandlers.ts` (LINEUP_SWAP ~647-656, DRAFT_PICK ~832-840,
DRAFT_REARRANGE ~944-951); `packages/server/src/draftSession.ts:43`
**Issue:** `draftSession.ts` defines `const LINEUP_SLOT_COUNT = 11` but doesn't export it.
`roomHandlers.ts` independently hardcodes the upper bound as the literal `10` (i.e.
`LINEUP_SLOT_COUNT - 1`) in three separate handlers (`LINEUP_SWAP`, `DRAFT_PICK`,
`DRAFT_REARRANGE`). If the lineup size ever changes, all three call sites need to be found and
updated in lockstep with no compiler assistance.
**Fix:** Export `LINEUP_SLOT_COUNT` from `draftSession.ts` (or move it to `shared/src/types.ts`
alongside `PACKS_PER_MATCH`) and reference it (`LINEUP_SLOT_COUNT - 1`) at each validation site.

---

_Reviewed: 2026-07-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
