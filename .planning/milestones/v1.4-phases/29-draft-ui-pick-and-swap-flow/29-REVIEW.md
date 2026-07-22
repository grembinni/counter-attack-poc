---
phase: 29-draft-ui-pick-and-swap-flow
reviewed: 2026-07-21T18:05:01-05:00
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
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-07-21T18:05:01-05:00
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This review re-verifies the 29-11 gap-closure fixes (CR-01/CR-02/CR-03 from the prior review at
this path) against the current code, then performs an independent adversarial pass across all 17
files rather than assuming the prior findings were the only defects.

**The three previously-flagged CR-01/CR-02/CR-03 findings are confirmed fixed and tested:**

- `LINEUP_CONFIRM`'s draft branch now rejects with `DRAFT_NOT_COMPLETE` before the
  `LINEUP_INCOMPLETE` completeness check (`roomHandlers.ts:738-741`), exercised by "Phase 29 Plan
  11 — CR-01 LINEUP_CONFIRM draftComplete guard".
- `DRAFT_PICK` now carries the same `requesterConfirmed || room.gameState !== null` guard
  `DRAFT_REARRANGE` already had (`roomHandlers.ts:845-850`), exercised by "Phase 29 Plan 11 — CR-02
  DRAFT_PICK post-start guard".
- The reconnect handler's draft re-sync is now gated on `room.gameState === null` rather than
  `!draftSession.draftComplete` (`createServer.ts:156-159`), exercised by "Phase 29 Plan 11 —
  CR-03 reconnect re-sync in post-complete window".

**However, this pass surfaced two new BLOCKER-level defects in the same reviewed scope:**

1. `createServer.ts`'s reconnect handler has a misplaced `return` that discards the documented
   "fall through to fresh connection" behavior for a session token that resolves to a `'waiting'`
   (not yet `'playing'`) or deleted room — leaving the socket with **no registered event handlers
   at all**. This is 100%-reproducible (no race needed): a host who refreshes the page while
   still alone in their own room (before the second player joins) gets a permanently dead socket.
2. `BenchCarousel`'s scroll-to-start effect fires on every unrelated re-render of
   `LineupAssignmentScreen`, not just on genuine bench changes, because the `benchCards` array
   passed to it is rebuilt with a fresh reference every render. This is most visible during a
   drag-over of a lineup slot (which updates state on every native `dragover` tick), snapping the
   bench scroll position back to 0 mid-drag and defeating the carousel feature this phase built.

Additional warnings cover a jersey-number gap for bench cards rearranged after `draftComplete`, a
client-only tier-color cache that silently degrades to a heuristic guess after any reconnect or
reload, a carried-forward input-validation asymmetry between `slotIndex` and `benchIndex`
allow-listing in `DRAFT_REARRANGE` (still unfixed from the prior review), and minor duplication
findings.

## Critical Issues

### CR-01: Reconnect handler drops all event registration for stale/waiting-room sessions

**File:** `packages/server/src/createServer.ts:99-167`

**Issue:** The `if (room && room.status === 'playing') { ... }` block is followed by an
unconditional `return;` that sits **outside** that inner `if` but still **inside** the outer
`if (socket.data.sessionToken !== undefined && ...)` block:

```ts
if (
  socket.data.sessionToken !== undefined &&
  socket.data.roomCode !== undefined &&
  socket.data.playerSlot !== undefined
) {
  const room = getRoom(socket.data.roomCode);
  if (room && room.status === 'playing') {
    // ... reconnect logic ...
  }
  return; // <-- runs even when the inner `if` above was false
}
```

The comment directly above this code states the intended behavior: _"A 'waiting' room has no
game state to restore — fall through to fresh connection so the socket can freely create or
join another room."_ The code does not do this. Any socket for which the session middleware
resolved `sessionToken`/`roomCode`/`playerSlot` (a real, still-valid session token) but for which
`room.status !== 'playing'` or the room no longer exists, hits the bare `return` and:

- never reaches the "stale token" `SESSION_EXPIRED` emit a few lines below — that entire branch
  is unreachable for this socket,
- never calls `registerRoomHandlers(io, socket, false)` / `registerGameHandlers(io, socket)`.

Concretely: the host creates a room and is waiting alone on the settings/waiting screen
(`room.status` stays `'waiting'` until the second player joins — see `roomStore.ts`'s `joinRoom`).
If the host refreshes their browser at this point, `sessionMiddleware` finds their still-valid
token, populates `socket.data`, and this handler then does nothing useful: no reconnect resync,
no fresh registration, no error surfaced to the client. `ROOM_CREATE`/`ROOM_JOIN` emitted by the
client afterward have no listener on this socket, so the client hangs indefinitely. This requires
no race condition — it reproduces on every host refresh while waiting for the second player, and
directly contradicts the code's own documented intent.

**Fix:** Only `return` when the reconnect path actually ran; otherwise fall through:

```ts
if (
  socket.data.sessionToken !== undefined &&
  socket.data.roomCode !== undefined &&
  socket.data.playerSlot !== undefined
) {
  const room = getRoom(socket.data.roomCode);
  if (room && room.status === 'playing') {
    // ... reconnect logic ...
    return; // only skip fresh-connection setup when the reconnect path actually ran
  }
  // fall through — do NOT return here.
}
```

### CR-02: BenchCarousel scroll position resets on every unrelated parent re-render

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:528-530`,
`packages/client/src/components/BenchCarousel.tsx:63-68`

**Issue:** `LineupAssignmentScreen` computes the bench cards inline on every render:

```ts
const benchCards = draftView.benchIds
  .map(resolveTieredCard)
  .filter((c): c is TieredPoolPlayer => c !== null);
```

`.map()`/`.filter()` always return a brand-new array, so `benchCards` gets a new reference on
**every** render of `LineupAssignmentScreen`, regardless of whether `draftView.benchIds` actually
changed. This is passed straight through as `<BenchCarousel cards={benchCards} .../>`, whose own
effect is:

```ts
useEffect(() => {
  const el = trackRef.current;
  if (!el) return;
  el.scrollLeft = 0;
  updateScrollState();
}, [cards]);
```

Documented as resetting scroll "whenever the bench (cards prop identity/length) changes," this
effect actually fires on **every** render of the parent for **any** reason, because `cards` gets a
new reference each time. In practice this includes `handleDraftSlotDragOver`, which calls
`setDraftDropTargetIndex(idx)` on every native `dragover` event (firing continuously, many times
per second) while a user drags a card over any lineup slot. The result: mid-drag, the bench
carousel's scroll position keeps snapping back to the leftmost card; the same happens on any other
incidental re-render (e.g. the `rejectionMessage` timeout firing). This defeats the exact carousel
feature this phase built (D-21) whenever the bench has enough cards to require scrolling.

By contrast, `DraftPackCarousel` does not have this problem: `cards={draftView.currentPack}` is
passed directly from state without an intervening `.map()`/`.filter()`, so its reference is stable
across unrelated re-renders of the parent.

**Fix:** Memoize `benchCards` on a dependency that only changes when the underlying draft state
legitimately changes (`draftView.benchIds` is itself a stable reference unless the session's bench
array actually changed — see `draftSession.ts`'s copy-on-write discipline):

```ts
const benchCards = useMemo(
  () => draftView.benchIds.map(resolveTieredCard).filter((c): c is TieredPoolPlayer => c !== null),
  [draftView.benchIds, cardCache],
);
```

(Import `useMemo` from `react`.) Alternatively, change `BenchCarousel`'s effect dependency to a
content-derived key (e.g. `cards.map((c) => c.id).join(',')`) so identity churn in the parent no
longer matters.

## Warnings

### WR-01: `DRAFT_REARRANGE` validates `slotIndex` but not `benchIndex` (carried forward, still unfixed)

**File:** `packages/server/src/roomHandlers.ts:965-975`

**Issue:** The slot-index allow-list loop only checks `ref.type === 'slot'`:

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

There is no equivalent explicit check for `ref.type === 'bench'` / `ref.benchIndex`, even though
the surrounding comment (T-29-06) claims indices are allow-listed "on both ends." Not currently
exploitable — `applyRearrange` reads `benchIds[from.benchIndex]`, and any out-of-range, negative,
non-integer, or non-numeric index simply evaluates to `undefined`, which the existing
`if (!occupant) return { ok: false, error: 'INVALID_REARRANGE' }` guard catches — but this is an
implicit safety net (JS array-indexing semantics) rather than an explicit validation step, and it
lives in a different module than the comment claiming the check happens here. This finding was
raised in the prior review of this phase and remains unaddressed.

**Fix:**

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

### WR-02: Bench jersey numbers are never assigned for cards benched after `draftComplete`

**File:** `packages/server/src/roomHandlers.ts:908-915`, `packages/server/src/draftSession.ts:437-449`

**Issue:** `assignBenchNumbers` runs exactly once, the instant `draftSession.draftComplete` first
flips true:

```ts
if (room.draftSession.draftComplete) {
  room.draftSession = {
    ...room.draftSession,
    homeBenchNumbers: assignBenchNumbers(room.draftSession.homeBenchIds, randomInt),
    awayBenchNumbers: assignBenchNumbers(room.draftSession.awayBenchIds, randomInt),
  };
}
```

`DRAFT_REARRANGE` is explicitly documented and tested as remaining legal _after_ `draftComplete`
(D-08/D-15; see "Phase 29 Plan 07 Task 1 — post-draft rearrangement" in
`draftSession.integration.test.ts`), letting a player move a card from a lineup slot onto the bench
post-completion. `applyRearrange` never touches `benchNumbers`, so any card that lands on the bench
via a post-`draftComplete` rearrange has no entry in `homeBenchNumbers`/`awayBenchNumbers`. On the
client, `DraftCardBody` simply omits the `#N` badge when `benchNumbers?.[card.id]` is `undefined`
— not a crash, but a silent, permanent data gap (that bench card never gets a jersey number for the
rest of the match).

**Fix:** Either (a) reassign bench numbers for any _new_ bench entries after every
`DRAFT_REARRANGE` that changes `benchIds` (diff old vs. new ids, assign numbers only to the new
ones so existing numbers stay stable), or (b) derive jersey numbers deterministically/lazily
instead of via a one-shot random assignment.

### WR-03: Client-side tier-color cache does not survive reconnect/reload, mis-coloring already-drafted cards

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:237-277`

**Issue:** `cardCache` (local `useState<Record<string, TieredPoolPlayer>>({})`) is the only place
the client remembers a card's true `DraftTier` for already-placed lineup/bench cards — the
server's `DraftClientView.lineupSlots`/`benchIds` are plain id arrays with no tier metadata (D-14
privacy-scoped view intentionally omits it). `cardCache` is populated only from cards the client
has personally seen in `draftView.currentPack` during the current mount (`useEffect` at lines
242-255). On any full reconnect/reload, the component remounts and `cardCache` resets to `{}`.
The reconnect resync (`createServer.ts`, CR-03) sends only the reconnecting player's _current_
pack — not the full history of every previously-drafted card. `resolveTieredCard`'s fallback then
applies to every already-placed card:

```ts
function resolveTieredCard(cardId: string): TieredPoolPlayer | null {
  const cached = cardCache[cardId];
  if (cached) return cached;
  const player = PLAYER_MAP.get(cardId);
  if (!player) return null;
  const tier: DraftTier = player.role === 'GK' ? 'keeper' : 'common';
  return { ...player, tier, totalStat: computeTotalStat(player) };
}
```

Every previously-drafted non-GK card (including chase/rare/uncommon cards) renders with a
`common` (green) tier border after a reconnect, and every GK card renders as `keeper` regardless
of its actual tier. Cosmetic only (border color; no gameplay impact), but a real, reproducible
display regression for exactly the reconnect flow this phase's own tests exercise on the server
side without an equivalent client-side check.

**Fix:** Have the server include a lightweight tier lookup for placed cards in `DraftClientView`
(or a small `cardId -> tier` map alongside `lineupSlots`/`benchIds`), rather than relying on
session-local, transient client state to reconstruct display-only tier information.

### WR-04: `SCROLL_STEP_PX` magic number duplicated verbatim across two components

**File:** `packages/client/src/components/DraftPackCarousel.tsx:133`,
`packages/client/src/components/BenchCarousel.tsx:40`

**Issue:** Both files independently declare `const SCROLL_STEP_PX = 328;`, each with a comment
noting the two must stay in sync ("mirrors DraftPackCarousel's SCROLL_STEP_PX exactly"). This is
exactly the kind of duplicated magic number that silently drifts the next time the card min-width
or gap in `LineupAssignmentScreen.module.css` changes (only one of the two constants would likely
get updated by whoever makes that change).

**Fix:** Extract `SCROLL_STEP_PX` to a single shared export (e.g. alongside `TIER_ORDER`/
`TIER_CARD_CLASS` in `DraftPackCarousel.tsx`, or a small shared `carousel.ts` module) and import it
in both components.

## Info

### IN-01: Duplicated GK-slot-role validation block across DRAFT_PICK and DRAFT_REARRANGE

**File:** `packages/server/src/roomHandlers.ts:874-886` and `packages/server/src/roomHandlers.ts:977-1001`

**Issue:** The GK-slot role check (`slotRole === 'GK' && card.role !== 'GK'` /
`slotRole !== 'GK' && card.role === 'GK'`) is implemented twice, nearly verbatim — once in
`DRAFT_PICK`, once in `DRAFT_REARRANGE`. Not a correctness bug today (both copies are currently
consistent and both are exercised by tests), but duplicated security-relevant validation logic is
exactly the kind of thing that drifts apart during a future edit (e.g. someone "fixing" one copy's
error-message wording without touching the other).

**Fix:** Extract a shared helper (e.g. `validateGKSlotRule(slotRole, cardRole): string | null`
returning the error reason or `null`) used by both handlers.

### IN-02: Stat-chip filtering/rendering logic duplicated between `LineupStatCard` and `DraftCardBody`

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:156-173`,
`packages/client/src/components/DraftPackCarousel.tsx:99-115`

**Issue:** The same `STAT_LABELS.filter(...)`/`.map(...)` block (role-based stat exclusion plus
`statTier`-driven badge coloring) is written out twice — once in `LineupStatCard`, once in
`DraftCardBody`. `statTier()` itself is also duplicated verbatim in both files. Correct today, but
any future change to which stats are shown/excluded per role has to be applied in two places, and
the two `statTier` copies can already silently drift.

**Fix:** Extract the stat-chip-grid render logic (and `statTier`) into one shared helper/component
consumed by both `LineupStatCard` and `DraftCardBody`.

### IN-03: No regression test for the slot→slot self-swap edge case (carried forward, still untested)

**File:** `packages/server/src/draftSession.ts:286-306`

**Issue:** The D-24 two-way-swap branch reads `lineupSlots[to.slotIndex]` (the `displaced`
occupant) _after_ `lineupSlots[from.slotIndex]` has already been nulled out. When
`from.slotIndex === to.slotIndex`, this correctly evaluates to a no-op, but only because of the
exact ordering of "null out `from`" before "read `displaced` at `to`" — a fragile-by-construction
invariant with no dedicated test. The client-side drag handler in `LineupAssignmentScreen.tsx`
(`if (ds.slotIndex === slotIndex) return;`) prevents the shipped UI from ever emitting this
payload, but the server has no independent guard, and a raw/malformed `DRAFT_REARRANGE` payload can
still reach this code path.

**Fix:** Add a unit test asserting `applyRearrange(session, side, { type: 'slot', slotIndex: N },
{ type: 'slot', slotIndex: N })` returns `ok: true` with the lineup slot unchanged and the bench
untouched, so a future refactor that reorders the null-out/read sequence is caught.

---

_Reviewed: 2026-07-21T18:05:01-05:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
