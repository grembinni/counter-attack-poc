---
phase: 36-bug-fixes
reviewed: 2026-08-02T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - packages/client/src/App.tsx
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/GameSettingsScreen.module.css
  - packages/client/src/components/GameSettingsScreen.test.tsx
  - packages/client/src/components/GameSettingsScreen.tsx
  - packages/server/src/__tests__/draftPacks.test.ts
  - packages/server/src/__tests__/gameEngine.phase26-undo.test.ts
  - packages/server/src/__tests__/gameEngine.phase8.test.ts
  - packages/server/src/__tests__/gameEngine.test.ts
  - packages/server/src/__tests__/room.integration.test.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/roomHandlers.ts
  - packages/shared/src/draftEngine.test.ts
  - packages/shared/src/draftEngine.ts
  - packages/shared/src/events.ts
findings:
  critical: 3
  warning: 2
  info: 1
  total: 6
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-08-02T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 36 ships five bug fixes: (36-01) a Back button + `LEAVE_ROOM` server-side room
teardown on the pre-game settings screen, (36-02) match-wide draft-pack id uniqueness,
(36-03) a same-pool tier cascade + common-only cross-pool fallback for draft packs plus a
guard against an uncaught `generateMatchPacks` throw crashing the process, (36-04) fixing
the shot-duel-tie loose-ball origin hex, and (36-05) clamping Undo at a resolved
tackle/steal contest. Because `gameEngine.ts` and `roomHandlers.ts` are large,
long-lived files, this review scoped its close reading to the actual Phase 36 diff
(commit range `bd7a14b^..HEAD`) rather than re-litigating pre-existing code, while still
reading full function bodies for context around every changed line.

The draft-pack tier-cascade rewrite (36-03) and the shot-duel-tie fix (36-04) are both
well-reasoned and thoroughly tested (including real-crypto-RNG structural-invariant
tests), and the BUG-37 Undo clamp (36-05) is correctly implemented and mirrored
client-side. The 36-01 `LEAVE_ROOM` feature, however, has two server-side gaps that
combine with a client-side gap in `GameSettingsScreen` to produce genuinely reachable
stuck/broken states — these are the Critical findings below.

## Critical Issues

### CR-01: `LEAVE_ROOM` deletes the room without notifying an already-joined second player

**File:** `packages/server/src/roomHandlers.ts:257-269`

**Issue:** `ROOM_JOIN` assigns slot 2 and lets a second player join a room regardless of
whether the host has confirmed settings yet (the `settingsConfirmed` check only gates the
`TEAM_SELECTION_START`/`ROOM_SETTINGS_CONFIRMED` broadcast, not the join itself — see
`roomHandlers.ts:199-244`). The host stays on `GameSettingsScreen` (`App.tsx` screen
`'GAME_SETTINGS'`) until they themselves confirm settings, so a second player can join
while the host is still on that screen. If the host then clicks **Back**
(`GameSettingsScreen.tsx:154-156` → `App.tsx:244-252` `handleSettingsBack` →
`socket.emit(ClientEvents.LEAVE_ROOM)`), the server's `LEAVE_ROOM` handler calls
`deleteRoom(roomCode)` and clears only the _leaving_ socket's `socket.data`. `deleteRoom`
(`roomStore.ts:285-295`) only clears timers and removes the room from the `rooms` map —
it never emits anything to the other socket still joined to that Socket.io room. The
stranded player 2's client:

- receives no `ROOM_ERROR`/notification of any kind (contrast with the reconnect path,
  which already has a `'SESSION_EXPIRED'` `ROOM_ERROR` client handler in
  `App.tsx:90-97` that could be reused here),
- keeps `socket.data.roomCode` pointing at the now-deleted room, so any subsequent event
  they emit is silently dropped by every handler's `const room = getRoom(roomCode); if
(!room) return;` guard,
- is left on whatever pre-game screen they were on with no way to recover except a full
  page reload.

**Fix:** Before deleting the room, notify the other room member(s) so their client can
route back to the landing screen (mirroring the existing `'SESSION_EXPIRED'` `ROOM_ERROR`
handling already in `App.tsx`):

```ts
socket.on(ClientEvents.LEAVE_ROOM, () => {
  const roomCode = socket.data.roomCode;
  if (roomCode === undefined) return;

  // Notify any other room member before the room disappears out from under them.
  socket.to(roomCode).emit(ServerEvents.ROOM_ERROR, 'ROOM_CLOSED');

  deleteRoom(roomCode);
  void socket.leave(roomCode);

  delete socket.data.roomCode;
  delete socket.data.playerSlot;
  delete socket.data.sessionToken;
});
```

and add a client-side `'ROOM_CLOSED'` branch in `App.tsx`'s `onRoomError` that resets to
the landing screen (the existing `resetLobby()` action already does the right state
reset).

---

### CR-02: `LEAVE_ROOM` has no game-phase guard — any connected socket can delete an in-progress match's room

**File:** `packages/server/src/roomHandlers.ts:257-269`

**Issue:** Every other room-mutating handler in this file checks `room.gameState !==
null` (or an equivalent phase guard) before acting — see `TEAM_SPEED_SET`
(`roomHandlers.ts:369-372`, `'GAME_ALREADY_STARTED'`) and `ROOM_SETTINGS_CONFIRM`
(`roomHandlers.ts:418-421`). `LEAVE_ROOM` has no such guard: it is documented as "host
abandons the pre-game settings screen" (the comment above it), but the server never
verifies the room is actually still pre-game, and it never verifies the caller is the
host (slot 1) — it acts on whichever socket sent the event. Any connected player (home or
away), at any point including mid-match, can emit the bare `room:leave` event (no
payload, trivially replayable from devtools/a modified client) and the server will
immediately `deleteRoom` the active match for both players, with no notification (see
CR-01) and no way to resume — a one-shot denial-of-service against the opponent that
bypasses every other authorization check this codebase otherwise applies consistently
(the file's own comments repeatedly invoke ASVS V3/V4/V5 for exactly this class of
check).

**Fix:** Restrict `LEAVE_ROOM` to the pre-game window and, ideally, to the host, mirroring
the existing guard pattern used elsewhere in this file:

```ts
socket.on(ClientEvents.LEAVE_ROOM, () => {
  const roomCode = socket.data.roomCode;
  if (roomCode === undefined) return;

  const room = getRoom(roomCode);
  // Only a legal action pre-game — never let it tear down a room with an active match.
  if (room && room.gameState !== null) return;

  if (room) socket.to(roomCode).emit(ServerEvents.ROOM_ERROR, 'ROOM_CLOSED');
  deleteRoom(roomCode);
  void socket.leave(roomCode);
  delete socket.data.roomCode;
  delete socket.data.playerSlot;
  delete socket.data.sessionToken;
});
```

---

### CR-03: `GameSettingsScreen` permanently hides Confirm on any server-side confirm failure, with no error shown — contradicts the stated retry path

**File:** `packages/client/src/components/GameSettingsScreen.tsx:60-63`

**Issue:**

```ts
function handleConfirm() {
  setHasConfirmed(true);
  onConfirm({ speed, teamType, draftPools: teamType === 'draft' ? draftPools : [] });
}
```

`hasConfirmed` is set to `true` unconditionally, synchronously, before the server has
responded, and the JSX only renders the Confirm button `{!hasConfirmed && (...)}`
(`GameSettingsScreen.tsx:143-152`). If `ROOM_SETTINGS_CONFIRM` fails server-side — most
notably `'DRAFT_SUPPLY_EXHAUSTED'`, the new error this very phase's `roomHandlers.ts`
change (T-36-07, `roomHandlers.ts:476-485`) introduces specifically because "a shortfall
surviving both cascades is genuinely reachable from a client-selected pool combination" —
the client never receives a `ROOM_SETTINGS_CONFIRMED` echo, so `App.tsx`'s
`onRoomSettingsConfirmed` never fires and the screen never advances. Unlike every other
sibling pre-game panel (`ActionPanel`, `FreeKickSetupPanel`, `KickOffSetupPanel`,
`LineupAssignmentScreen` all read `useGameStore((s) => s.gameError)` and render it),
`GameSettingsScreen.tsx` never reads `gameError` at all — no error text is shown, and
`hasConfirmed` is never reset. The host is left on a screen with no Confirm button, no
error message, and no indication anything went wrong; the only way out is **Back**, which
independently exhibits CR-01/CR-02 above (and, for a 2-player room, tears the room down
without telling the other player). This directly contradicts the `roomHandlers.ts`
T-36-07 comment's stated intent: "the room stays in its pre-confirm state and the host
can retry with a different pool selection" — the client has no code path that lets that
retry actually happen. This gap is untested: no test in `GameSettingsScreen.test.tsx`
covers a `GAME_ERROR`/failed-confirm scenario, and no test anywhere asserts on the
`'DRAFT_SUPPLY_EXHAUSTED'` error emitted at `roomHandlers.ts:482`.

**Fix:** Read `gameError` from the store, display it, and only set `hasConfirmed` once the
confirmation actually succeeds (or reset it when a relevant `gameError` arrives):

```tsx
const gameError = useGameStore((s) => s.gameError);

// ...
{
  !hasConfirmed && (
    <button
      type="button"
      className={styles.ctaButton}
      disabled={confirmDisabled}
      onClick={handleConfirm}
    >
      Confirm Settings
    </button>
  );
}
{
  gameError && <span className={styles.errorText}>{gameError}</span>;
}
```

and clear/never-set `hasConfirmed` when a `GAME_ERROR` is received for this screen (e.g.
via a `useEffect` on `gameError` that resets `hasConfirmed` to `false`), so the host can
correct their pool selection and retry.

## Warnings

### WR-01: `tierSupplyMeetsNeed`/`buildTierPoolsForRound` tier-processing order is not stable-sorted for same-rank tiers beyond `chaseOrRare`

**File:** `packages/shared/src/draftEngine.ts:198-231, 308-336, 398-440`

**Issue:** `SLOT_RARITY_ORDER` assigns `chase`, `rare`, and `chaseOrRare` the same rank
(`0`). `distinctTiers` is derived from `[...needByTier.keys()].sort(...)` in both
`tierSupplyMeetsNeed` and `buildTierPoolsForRound`. Today this is safe only because
`DRAFT_ROUNDS` (`packages/shared/src/types.ts:542-578`) never defines a round with two
distinct rank-0 slot tiers (`chase` and `rare` are never used standalone, only merged as
`chaseOrRare`) — so `Map` insertion order (which determines the tie-break under a stable
sort) never actually matters today. `TIER_CASCADE_BELOW` even defines cascade behavior
for standalone `'chase'` and `'rare'` (`chase: ['rare', 'uncommon', 'common']`, `rare:
['uncommon', 'common']`) that is currently unreachable dead code given `DRAFT_ROUNDS`.
If a future round definition ever introduces both a standalone `chase` slot and a
standalone `rare` slot in the same round, the processing order between them would depend
on `Map` iteration order (i.e., `round.slots` declaration order) rather than an explicit,
documented tie-break, and `tierSupplyMeetsNeed`/`buildTierPoolsForRound` could silently
diverge from each other if `round.slots` iterates in different array positions in the two
call sites (they don't today, but nothing enforces that they must match).

**Fix:** Either add an explicit secondary sort key (e.g. array-declaration order) with a
comment establishing the invariant, or add a runtime assertion / type-level restriction
that a single tiered round may not declare both a standalone `'chase'` slot and a
standalone `'rare'` slot, documenting why `TIER_CASCADE_BELOW`'s `chase`/`rare` entries
exist for future-proofing only.

### WR-02: `buildTierPoolsForRound` claims a tier's entire unclaimed primary population, not just what it needs

**File:** `packages/shared/src/draftEngine.ts:416-437`

**Issue:** For a tier whose primary population already meets `need` (the common case),
`pool = shuffle(primaryCandidates, rng)` uses the _entire_ unclaimed primary population,
and every card in it is then added to `claimed` (`for (const p of pool) claimed.add(p.id)`
at line 435) — not just the `need` amount actually destined to be drawn via
`drawFromPool`. This doesn't produce an incorrect pack today (verified against
`tierSupplyMeetsNeed`'s bounded-consumption accounting, and confirmed by the seeded
regression tests), because nothing cascades _upward_ into a rarer tier, so over-claiming a
tier's own population never starves a different (lower) tier that might have needed those
same cards. It is, however, more pool computation than necessary per round and a
surprising deviation from the "claim only what's used" pattern the cascade branch below it
correctly follows (`shuffledCascade.slice(0, shortfall)`), making the function harder to
reason about than it needs to be.

**Fix:** Not required for correctness, but consider slicing the primary pool to `need`
plus reasonable `drawFromPool` bucket-cap slack (matching the existing `slice(0,
shortfall)` pattern for cascade tiers) so `claimed` reflects only cards actually placed
into a round's draw pools.

## Info

### IN-01: `LEAVE_ROOM` integration tests don't cover the two-player-already-joined scenario

**File:** `packages/server/src/__tests__/room.integration.test.ts:708-757`

**Issue:** Both new `LEAVE_ROOM` tests use a single client (host-only) room. Neither
exercises the reachable case where a second player has already joined
(`ROOM_JOIN`/slot 2) before the host emits `LEAVE_ROOM` — the scenario underlying CR-01
above. Given `ROOM_JOIN` explicitly allows joining before `settingsConfirmed`
(`roomHandlers.ts:225-230`), this is a realistic sequence, not a contrived edge case.

**Fix:** Add a test that joins a second client, then has the host emit `LEAVE_ROOM`, and
asserts the second client receives some notification (once CR-01 is fixed) rather than
silently hanging.

---

_Reviewed: 2026-08-02T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
