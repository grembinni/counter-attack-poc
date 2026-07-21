---
phase: 29-draft-ui-pick-and-swap-flow
reviewed: 2026-07-21T21:00:00Z
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
  warning: 2
  info: 3
  total: 8
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-07-21T21:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This is a full re-review of the 17-file Phase 29 draft-mode scope (plans 01-10), with two explicit
goals: (1) re-verify, against the current code, the three server-lifecycle findings raised in the
prior review committed at `a2eb259` (`LINEUP_CONFIRM` draftComplete gap, `DRAFT_PICK`
gameState gap, and a reconnect DRAFT_STATE_UPDATED gap in `roomHandlers.ts`/`createServer.ts`),
and (2) audit the 29-10 gap-closure change to `applyRearrange`'s slot-to-slot swap semantics and
its test coverage. A prior, narrower pass at this same task only looked at
`draftSession.ts`/`draftSession.test.ts`/`draftSession.integration.test.ts` and never re-checked
`roomHandlers.ts` — this review supersedes that pass with the full required scope.

**The 29-10 swap-semantics fix itself is solid.** `applyRearrange`'s true two-way swap (D-24) is
correctly implemented for every reachable input (slot↔slot with distinct indices, slot→slot onto
an empty destination, slot→slot self-swap, bench→slot displacement, slot→bench), returns a new
session object without mutating the input, and correctly leaves `cycle`/`subStep`/`picksRemaining`
untouched (D-10). The GK-slot role rule is now enforced on **both** ends of a slot↔slot swap in
`roomHandlers.ts`'s `DRAFT_REARRANGE` handler. Unit coverage in `draftSession.test.ts` and
integration coverage in `draftSession.integration.test.ts` (the Plan 10 describe block) both
directly exercise the swap and its GK-slot boundary cases.

**All three previously-flagged server-lifecycle findings are still present in the current code.**
Re-reading them together with the 29-10 change shows they compose into a single exploitable
chain: a player can force the match to start with a mechanically-incomplete draft (CR-01), keep
issuing `DRAFT_PICK` after the match has started and force both players' clients back onto the
draft screen mid-match via the resulting broadcast (CR-02), and a reconnect during the window
after the draft naturally completes but before both sides confirm gets no re-sync event at all
and is stranded on the wrong screen (CR-03). None of the three has any test coverage — every
integration test that reaches `LINEUP_CONFIRM` first drives `draftComplete` to `true`, and both
reconnect tests disconnect while `draftComplete` is still `false`.

## Critical Issues

### CR-01: LINEUP_CONFIRM (draft mode) never verifies `draftSession.draftComplete` before accepting a confirm

**File:** `packages/server/src/roomHandlers.ts:697-738`

**Issue:** The `isDraftRoom` branch of the `LINEUP_CONFIRM` handler only checks that the
confirming side's `homeLineupSlots`/`awayLineupSlots` has no `null` entry
(`resolveDraftOrder`, lines 717-728) before setting `homeLineupConfirmed`/`awayLineupConfirmed`.
It never checks `room.draftSession.draftComplete`.

`PACK_COMPOSITION.keeper === 1` guarantees a keeper card appears in every pack, and a player can
choose to place every drafted card directly into a lineup slot instead of the bench. All 11
starting slots can therefore legally fill by the end of cycle 3 (12 cards drafted: 4 per cycle ×
3 cycles) — a full cycle before the draft naturally completes at cycle 4 (16 cards, `draftComplete
= true`). A player (or a modified/malicious client emitting `LINEUP_CONFIRM` directly) can lock
in a "confirmed" lineup while `draftSession.draftComplete` is still `false`. If both players do
this, `buildInitialGameState` fires and the match starts with the draft mechanically unfinished —
a server-authoritative-state violation, not merely a UX inconsistency, and it directly enables
CR-02 below (`DRAFT_PICK`'s guard only checks `draftComplete`, which is still `false` in this
scenario).

**Fix:** Reject the confirm before setting the confirmed flag, mirroring the existing
`LINEUP_INCOMPLETE` guard:

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

### CR-02: DRAFT_PICK never checks `room.gameState !== null` or the requester's confirmed status — asymmetric with DRAFT_REARRANGE

**File:** `packages/server/src/roomHandlers.ts:809-899` (contrast with `DRAFT_REARRANGE`'s guard at `roomHandlers.ts:931-938`)

**Issue:** `DRAFT_PICK`'s only lifecycle guard is:

```ts
if (!room.draftSession || room.draftSession.draftComplete) {
  socket.emit(ServerEvents.GAME_ERROR, 'NOT_DRAFTING');
  return;
}
```

`DRAFT_REARRANGE`, by contrast, explicitly checks:

```ts
const requesterConfirmed = side === 'home' ? room.homeLineupConfirmed : room.awayLineupConfirmed;
if (requesterConfirmed || room.gameState !== null) {
  socket.emit(ServerEvents.GAME_ERROR, 'LINEUP_ALREADY_CONFIRMED');
  return;
}
```

`DRAFT_PICK` has neither check. In the intended flow this is masked because `draftComplete` is
always `true` by the time `gameState` gets built — but CR-01 shows `draftComplete` can still be
`false` when `gameState` is built. Once that happens, a player can keep emitting `DRAFT_PICK`
after kickoff: the handler still processes it (mutating `draftSession`), and
`emitDraftViews(io, room)` unicasts a fresh `DRAFT_STATE_UPDATED` to **both** sockets. On the
client, `onDraftStateUpdated` in `App.tsx` (lines 165-171) unconditionally calls
`setScreen('LINEUP_ASSIGNMENT')` whenever the screen isn't already that value — so a single
post-kickoff `DRAFT_PICK` can pull both players' clients off the live `GAME_BOARD` and back onto
the draft screen mid-match. Even setting CR-01 aside, the asymmetry itself is a defect: two
handlers that mutate the same `draftSession` state should share the same lifecycle guard, and
`DRAFT_PICK` is missing the one `DRAFT_REARRANGE` already has.

**Fix:** Add the same guard `DRAFT_REARRANGE` already has, before doing any pick processing:

```ts
const side: DraftSide = socket.data.playerSlot === 1 ? 'home' : 'away';
const requesterConfirmed = side === 'home' ? room.homeLineupConfirmed : room.awayLineupConfirmed;
if (requesterConfirmed || room.gameState !== null) {
  socket.emit(ServerEvents.GAME_ERROR, 'LINEUP_ALREADY_CONFIRMED');
  return;
}
```

### CR-03: Mid-flow reconnect sends no re-sync event during the "draft complete, not yet both-confirmed" window

**File:** `packages/server/src/createServer.ts:140-153`

**Issue:** The reconnect handler re-syncs state with two mutually-exclusive branches:

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

Once a side's draft naturally completes (`draftSession.draftComplete === true`) but before
**both** sides have called `LINEUP_CONFIRM` — i.e. during the "confirm your completed lineup"
screen, where `room.gameState` is still `null` — neither branch fires: the first is skipped
because `gameState` is `null`, and the second is skipped because its `!draftSession.draftComplete`
guard excludes exactly this window. A reconnecting socket during this window receives no state
re-sync at all.

On the client this is visibly broken: `onRoomJoined` (still fired on every reconnect) only
redirects the home player (`slot === 1`) back to `GAME_SETTINGS` when the screen was
`LANDING`/`CREATE_ROOM` — throwing the host back to the pre-game settings screen and losing the
completed draft entirely — and does nothing for the away player, who is simply stranded on
`LANDING`.

This directly reproduces the reconnect gap flagged in the prior review (`a2eb259`);
`draftReconnect.integration.test.ts`'s two tests both disconnect/reconnect while
`draftSession.draftComplete` is still `false` (mid-draft), so this specific window remains
untested.

**Fix:** Widen the draft re-sync condition to also cover the post-complete/pre-confirm window —
draft-mode rooms have no `gameState` until both `LINEUP_CONFIRM`s land, so gating purely on
`gameState === null` is sufficient and correct:

```ts
if (room.gameState === null && room.teamType === 'draft' && room.draftSession) {
  const side = socket.data.playerSlot === 1 ? 'home' : 'away';
  socket.emit(ServerEvents.DRAFT_STATE_UPDATED, buildDraftView(room.draftSession, side));
}
```

## Warnings

### WR-01: `DRAFT_REARRANGE`'s "allow-list slot indices on both ends" check silently skips bench-ref bounds validation

**File:** `packages/server/src/roomHandlers.ts:942-952`

**Issue:** The T-29-06 comment claims "allow-list slot indices on both ends before touching any
state," but the loop only validates `ref.type === 'slot'` refs:

```ts
const refs = [from, to];
for (const ref of refs) {
  if (
    ref.type === 'slot' &&
    (!Number.isInteger(ref.slotIndex) || ref.slotIndex < 0 || ref.slotIndex > 10)
  ) {
    socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SLOT_INDEX');
    return;
  }
}
```

A `{ type: 'bench', benchIndex: -1 }` or `{ type: 'bench', benchIndex: 4.7 }` payload passes this
loop untouched. It is not currently exploitable — `applyRearrange` in `draftSession.ts`
defensively treats any out-of-range/non-integer `benchIndex` as `benchIds[from.benchIndex] ===
undefined` and returns `INVALID_REARRANGE` — but the safety net is implicit and lives in a
different module than the comment claiming the validation happens here. A future refactor of
`applyRearrange` (e.g. switching `benchIds` to a `Map` keyed by id) could silently drop this
fallback without the `roomHandlers.ts` comment's promise ever being made true.

**Fix:** Make the bench-side validation explicit and colocated with the slot-side check:

```ts
for (const ref of refs) {
  if (
    ref.type === 'slot' &&
    (!Number.isInteger(ref.slotIndex) || ref.slotIndex < 0 || ref.slotIndex > 10)
  ) {
    socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SLOT_INDEX');
    return;
  }
  if (ref.type === 'bench' && (!Number.isInteger(ref.benchIndex) || ref.benchIndex < 0)) {
    socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SLOT_INDEX');
    return;
  }
}
```

### WR-02: No test coverage for any of CR-01/CR-02/CR-03

**Files:** `packages/server/src/__tests__/draftSession.integration.test.ts`,
`packages/server/src/__tests__/draftReconnect.integration.test.ts`

**Issue:** Every integration test that reaches `LINEUP_CONFIRM` in draft mode first drives the
session to `draftComplete: true` via `driveDraftToCompletionFillingLineups`
(`draftSession.integration.test.ts:592-613`), so the premature-confirm path (CR-01) is never
exercised, and by extension neither is the post-kickoff `DRAFT_PICK` path (CR-02). Likewise,
`draftReconnect.integration.test.ts`'s two tests both disconnect/reconnect while
`draftSession.draftComplete` is still `false` (mid-draft), never in the post-complete,
pre-both-confirm window (CR-03). This is why all three regressions from the prior review survived
a full round of gap-closure work (plans 07-10) aimed at other bugs — the suite has no negative-path
coverage for the lifecycle boundary itself.

**Fix:** Add regression tests once CR-01/CR-02/CR-03 are fixed:

- A test that calls `LINEUP_CONFIRM` with a full-but-not-yet-`draftComplete` session (fill all 11
  slots by cycle 3) and asserts `GAME_ERROR` is returned and no `GAME_STATE` is ever emitted.
- A test that builds `gameState` (via the CR-01 fix path or by directly setting
  `room.gameState`/`draftSession.draftComplete = false` in a unit-level harness) then emits
  `DRAFT_PICK` and asserts `GAME_ERROR` rather than a `draftSession` mutation or a
  `DRAFT_STATE_UPDATED` broadcast.
- A reconnect test that disconnects after `draftComplete` becomes `true` but before the
  reconnecting side has called `LINEUP_CONFIRM`, asserting a `DRAFT_STATE_UPDATED` (not silence)
  is received on reconnect.

## Info

### IN-01: No regression test for the slot→slot self-swap edge case (`from.slotIndex === to.slotIndex`)

**File:** `packages/server/src/draftSession.ts:258-306`, `packages/server/src/draftSession.test.ts:285-303`

**Issue:** The D-24 two-way-swap branch reads `lineupSlots[to.slotIndex]` (the `displaced`
occupant) _after_ `lineupSlots[from.slotIndex]` has already been nulled out. When
`from.slotIndex === to.slotIndex`, `displaced` correctly evaluates to `null` (a true no-op that
restores the same card to the same slot), but this correctness depends entirely on the exact
ordering of "null out `from`" before "read `displaced` at `to`". This is currently correct but
untested, and the client-side drag handler in `LineupAssignmentScreen.tsx`
(`if (ds.slotIndex === slotIndex) return;`) prevents the shipped UI from ever emitting this
payload — but the server has no independent guard, and a raw/malformed `DRAFT_REARRANGE` socket
payload can still reach this code path.

**Fix:** Add a unit test asserting `applyRearrange(session, side, { type: 'slot', slotIndex: N },
{ type: 'slot', slotIndex: N })` returns `ok: true` with the lineup slot unchanged and the bench
untouched, so a future refactor that reorders the null-out/read sequence is caught.

### IN-02: `applyRearrange`'s GK-slot invariant is validated only by the caller, not defensively inside the function

**File:** `packages/server/src/draftSession.ts:18-21, 258-306`

**Issue:** The two-way swap's correctness relies on an invariant maintained entirely outside this
file: every occupied lineup slot always holds a card whose role matches that slot's role — an
invariant enforced only by the paired checks in `roomHandlers.ts` at the `DRAFT_PICK` (lines
851-863) and `DRAFT_REARRANGE` (lines 957-979) call sites. This is a deliberate, documented module
boundary ("Card-placement boundary" comment, `draftSession.ts:18-21`), so it is not a bug in this
file — but the correctness argument for the new two-way-swap logic (that checking only the moving
card's role against the destination is sufficient, because the vacated source slot's role always
matches the displaced card's role by the same invariant) is non-obvious and is not documented
anywhere near the swap code itself. A future caller of `applyRearrange` that does not replicate
both `roomHandlers.ts` GK-slot checks (a script, an admin tool, or a refactor that consolidates
the two nearly-identical validation blocks in `roomHandlers.ts` and drops one branch) could
silently place a GK card in an outfield slot or vice versa with no error.

**Fix:** Add a short comment near the `applyRearrange` swap branch (or in the module docstring)
spelling out the invariant this function depends on, so the next person touching
`roomHandlers.ts`'s validation doesn't unknowingly weaken it.

### IN-03: Duplicated GK-slot-role validation block across DRAFT_PICK and DRAFT_REARRANGE

**File:** `packages/server/src/roomHandlers.ts:851-863` and `packages/server/src/roomHandlers.ts:966-978`

**Issue:** The GK-slot role check (`slotRole === 'GK' && card.role !== 'GK'` /
`slotRole !== 'GK' && card.role === 'GK'`) is implemented twice, nearly verbatim, once in
`DRAFT_PICK` and once in `DRAFT_REARRANGE`. This is a maintainability smell rather than a
correctness bug today (both copies are currently consistent and both are exercised by tests), but
duplicated security-relevant validation logic is exactly the kind of thing that drifts apart
during a future edit — e.g. someone "fixing" one copy's error-message wording without touching
the other, or a future third call site copy-pasting a stale version.

**Fix:** Extract a shared helper (e.g. `validateGKSlotRule(slotRole, cardRole): string | null`
returning the error reason or `null`) used by both handlers.

---

_Reviewed: 2026-07-21T21:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
