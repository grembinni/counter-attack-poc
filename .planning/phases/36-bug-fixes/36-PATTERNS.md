# Phase 36: Bug Fixes - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 12 (7 modified, 0 new source files, 5 test files extended)
**Analogs found:** 12 / 12 (all fixes have same-file or same-codebase sibling patterns; no external analogs needed)

This phase is pure defect-correction — every fix site has an in-file or same-subsystem sibling pattern to copy exactly. No new roles/data-flow shapes are introduced. RESEARCH.md (`.planning/phases/36-bug-fixes/36-RESEARCH.md`) is the primary source of truth for line numbers and is more current than CONTEXT.md's pointers, especially for Bug 4 — use RESEARCH.md's corrected root cause (gameEngine.ts:2310, not computeShotPathDeflection/computeLooseBall).

## File Classification

| New/Modified File                                               | Role                            | Data Flow           | Closest Analog                                                                                                                | Match Quality                                  |
| --------------------------------------------------------------- | ------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `packages/shared/src/events.ts`                                 | config (event registry)         | request-response    | Same file, existing `ClientEvents.ROOM_CREATE`/`ROOM_JOIN`/`ROOM_SETTINGS_CONFIRM` entries (lines 20-23)                      | exact (in-file sibling)                        |
| `packages/server/src/roomHandlers.ts`                           | controller (socket handler)     | request-response    | Same file, `ROOM_CREATE` handler (lines 149-182)                                                                              | exact (in-file sibling)                        |
| `packages/client/src/App.tsx`                                   | controller (event wiring)       | request-response    | Same file, existing room-lifecycle emit/handler pairs (`onRoomJoined`, lines 74-86)                                           | exact (in-file sibling)                        |
| `packages/client/src/components/GameSettingsScreen.tsx`         | component                       | request-response    | `LobbyScreen.tsx`'s Back button + `useLobbyBack()` hook (pattern to partially reuse, NOT wholesale copy per D-04/Pitfall 6)   | role-match (deliberately divergent)            |
| `packages/client/src/store/useGameStore.ts`                     | store (Zustand)                 | CRUD (client state) | Same file, existing `resetLobby()` action (lines 977-986) — reused as-is, no new pattern needed                               | exact (no change)                              |
| `packages/shared/src/draftEngine.ts`                            | service (pure function, shared) | transform/batch     | Same file, existing per-round `usedIds: Set` pattern in `resolveGkCandidates` (250-268) / `resolveTieredCandidates` (293-315) | exact (in-file sibling, scope-extension)       |
| `packages/server/src/__tests__/draftPacks.test.ts`              | test                            | CRUD/batch          | Same file, existing per-round duplicate-check test (lines 54-66)                                                              | exact (in-file sibling)                        |
| `packages/server/src/gameEngine.ts` (SHOT/LOOSE_BALL branch)    | service (pure state-transition) | event-driven        | Same file, SAVE branches' `gkEffectivePos` usage (lines 2339-2341, 2350, 2368)                                                | exact (in-file sibling)                        |
| `packages/server/src/gameEngine.ts` (`applyUndo`)               | service (pure state-transition) | event-driven        | Same file, existing `isBoundary` disjunction (lines 1399-1408)                                                                | exact (in-file sibling, disjunction extension) |
| `packages/client/src/components/ActionPanel.tsx` (`canUndo`)    | component (UX mirror)           | event-driven        | Same file, existing `isBoundary` disjunction (lines 265-272)                                                                  | exact (in-file sibling, disjunction extension) |
| `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` | test                            | event-driven        | Same file, `describe('Phase 26 BUG-24: applyUndo scoping — MOVE phase', ...)` block (line 351)                                | exact (in-file sibling)                        |
| `packages/server/src/__tests__/gameEngine.phase8.test.ts`       | test                            | event-driven        | Same file, existing tie-producing test near lines 718-745                                                                     | exact (in-file sibling)                        |

## Pattern Assignments

### `packages/shared/src/events.ts` (config, request-response) — Bug 1 / D-03

**Analog:** same file, existing `ClientEvents` entries (lines 19-35)

**Convention pattern** (verified lines 19-23):

```typescript
export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  /** DRAFT-01/D-03 (Phase 27): host confirms speed + team type + draft pools atomically on the pre-game settings screen. */
  ROOM_SETTINGS_CONFIRM: 'room:settings-confirm',
```

**What to add:** `LEAVE_ROOM: 'room:leave'` following the same `room:` kebab-case namespace, plus a JSDoc comment citing this phase/decision (mirror the `ROOM_SETTINGS_CONFIRM` comment style). Add a void-payload entry to the typed-payload interface (around line 154-167, alongside `[ClientEvents.ROOM_CREATE]: () => void;`):

```typescript
[ClientEvents.ROOM_CREATE]: () => void;
[ClientEvents.ROOM_JOIN]: (roomCode: string) => void;
```

`LEAVE_ROOM` should follow the `ROOM_CREATE` shape exactly: `() => void` (no payload — per RESEARCH.md's V5 Input Validation note, nothing for a client to inject).

---

### `packages/server/src/roomHandlers.ts` (controller, request-response) — Bug 1 / D-03

**Analog:** same file, `ROOM_CREATE` handler (lines 149-182)

**Core pattern to mirror:**

```typescript
// Source: packages/server/src/roomHandlers.ts:149-182 (ROOM_CREATE — pattern to mirror)
socket.on(ClientEvents.ROOM_CREATE, () => {
  if (socket.data.roomCode !== undefined) {
    socket.emit(ServerEvents.ROOM_ERROR, 'ALREADY_IN_ROOM');
    return;
  }
  // ... creates + persists socket.data.roomCode/playerSlot/sessionToken, socket.join(roomCode)
});
```

**New handler (design sketch, from RESEARCH.md Code Examples — copy this shape):**

```typescript
socket.on(ClientEvents.LEAVE_ROOM, () => {
  const roomCode = socket.data.roomCode;
  if (roomCode === undefined) return; // nothing to leave
  deleteRoom(roomCode); // packages/server/src/roomStore.ts:285 — existing fn, already clears timers
  void socket.leave(roomCode);
  socket.data.roomCode = undefined;
  socket.data.playerSlot = undefined;
  socket.data.sessionToken = undefined;
});
```

**Security pattern (V3/V4, from RESEARCH.md):** read `socket.data.roomCode` (server-assigned), never accept a room code as an event payload argument — same convention already used by every existing handler in this file. Do NOT reuse the disconnect-grace-timer path at lines 1047-1049 — that is the anti-pattern this fix must avoid (D-03).

**Do NOT reuse `room.isProcessing` mutex** unless the planner decides otherwise (RESEARCH.md Assumption A2) — `deleteRoom` on an already-deleted key is a safe no-op.

---

### `packages/client/src/App.tsx` / `GameSettingsScreen.tsx` (component, request-response) — Bug 1 / D-01/D-02/D-04

**Analog (what NOT to copy wholesale):** `LobbyScreen.tsx`'s `useLobbyBack()` hook — does `sessionStorage.removeItem` + `socket.disconnect()`/`socket.connect()` + `resetLobby()`, with **no** room-teardown emit (relies on 90s grace timer). Per D-03/Pitfall 6, do not call `useLobbyBack()` directly from `GameSettingsScreen`.

**Correct new flow:** emit `LEAVE_ROOM` (new event, immediate server-side `deleteRoom`) THEN perform client-side reset — CAN reuse `resetLobby()` and the `sessionStorage.removeItem('ca_session_token')` line, but must NOT rely on `socket.disconnect()`/`socket.connect()` as the cleanup mechanism.

**Reusable client reset primitive (already correct, no changes needed):**

```typescript
// Source: packages/client/src/store/useGameStore.ts:977-986
resetLobby: () =>
  set({
    screen: 'LANDING',
    roomCode: null,
    playerSlot: null,
    roomError: null,
    gameError: null,
    disconnectWarning: false,
    gameState: mockMovementState,
  }),
```

**Open item flagged by RESEARCH.md (Open Question 2):** verify whether `App.tsx`'s local `teamType`/`draftPools`/`selectedSpeed`/`homePickedTeam` `useState` (outside Zustand, `App.tsx:40-47`) also needs resetting on Back so a subsequent Create Room doesn't inherit stale local state.

**CSS convention:** `GameSettingsScreen.module.css` already has a comment (line 2, 190) noting it reuses `LobbyScreen`'s `.ctaButton`/`.subLink` styling — style the new Back button the same way.

---

### `packages/shared/src/draftEngine.ts` (service, transform/batch) — Bugs 2/3 / D-06 through D-12

**Analog:** same file, existing per-round `usedIds: Set` pattern

**Existing per-round pattern to extend in scope (not shape)** (verified lines 250-268, 293-315):

```typescript
// resolveGkCandidates (250-268) — existing per-round-only usedIds
function resolveGkCandidates(
  selectedUnion: PoolPlayer[],
  fallbackChain: readonly DraftPoolId[],
  neededCount: number,
): PoolPlayer[] {
  const candidates = selectedUnion.filter((p) => p.role === 'GK');
  const usedIds = new Set(candidates.map((p) => p.id)); // <- currently local/fresh per call
  for (const fallbackPoolId of fallbackChain) {
    if (candidates.length >= neededCount) break;
    const fallbackGks = resolvePoolPlayers([fallbackPoolId]).filter(
      (p) => p.role === 'GK' && !usedIds.has(p.id),
    );
    for (const p of fallbackGks) {
      candidates.push(p);
      usedIds.add(p.id);
    }
  }
  return candidates;
}

// resolveTieredCandidates (293-315) — same shape, non-GK
function resolveTieredCandidates(
  selectedUnion: PoolPlayer[],
  fallbackChain: readonly DraftPoolId[],
  round: Extract<RoundConfig, { kind: 'tiered' }>,
): TieredPoolPlayer[] {
  const baseCandidates = selectedUnion.filter((p) => p.role !== 'GK');
  const usedIds = new Set(baseCandidates.map((p) => p.id)); // <- currently local/fresh per call
  let classified = assignTiers(baseCandidates);
  for (const fallbackPoolId of fallbackChain) {
    if (tierSupplyMeetsNeed(classified, round)) break;
    const fallbackPlayers = resolvePoolPlayers([fallbackPoolId]).filter(
      (p) => p.role !== 'GK' && !usedIds.has(p.id),
    );
    for (const p of fallbackPlayers) {
      baseCandidates.push(p);
      usedIds.add(p.id);
    }
    classified = assignTiers(baseCandidates);
  }
  return classified;
}
```

**Round loop edit site** (verified lines 392-431, `generateDraftPacks`):

```typescript
let packNumber = 0;
// ADD (D-06): const matchUsedIds = new Set<string>();

for (const round of DRAFT_ROUNDS) {
  if (round.kind === 'gk') {
    const neededCount = PACKS_PER_ROUND * round.cardsPerPack;
    const gkCandidates = resolveGkCandidates(selectedUnion, fallbackChain, neededCount);
    // ADD matchUsedIds param + exclusion filter
    if (gkCandidates.length < neededCount) {
      throw new Error(/* ... */);
    }
    const dealt = shuffle(assignTiers(gkCandidates), rng);
    addToPool(dealt);
    for (let i = 0; i < PACKS_PER_ROUND; i++) {
      packNumber += 1;
      const cards = dealt.slice(i * round.cardsPerPack, (i + 1) * round.cardsPerPack);
      packs.push({ packNumber, round: round.round, cards });
      // ADD (after push, Pitfall 5): cards.forEach(c => matchUsedIds.add(c.id))
    }
  } else {
    const classified = resolveTieredCandidates(selectedUnion, fallbackChain, round);
    // ADD matchUsedIds param + exclusion filter
    // NEW (D-08): same-pool cascade helper (chase->rare->uncommon->common) BEFORE cross-pool loop
    if (!tierSupplyMeetsNeed(classified, round)) {
      throw new Error(/* ... */);
    }
    addToPool(classified);
    const tierPools = buildTierPoolsForRound(round, classified, rng);
    const orderedSlots = sortSlotsRarestFirst(round.slots);
    for (let i = 0; i < PACKS_PER_ROUND; i++) {
      const bucketCounts: Record<PositionBucket, number> = { DEF: 0, MID: 0, FWD_ST: 0 };
      const cards: TieredPoolPlayer[] = [];
      for (const slot of orderedSlots) {
        const tierPool = tierPools.get(slot.tier)!;
        cards.push(...drawFromPool(tierPool, slot.count, bucketCounts));
      }
      packNumber += 1;
      packs.push({ packNumber, round: round.round, cards });
      // ADD (after push, Pitfall 5): cards.forEach(c => matchUsedIds.add(c.id))
    }
  }
}
```

**Critical Pitfall 5 (must follow exactly):** only add ids to `matchUsedIds` from the actual dealt `cards` pushed into `packs.push(...)`, AFTER each round's pack-dealing loop — never from `classified`/candidate pools inside `resolveGkCandidates`/`resolveTieredCandidates`. Marking undealt candidates as used would wrongly shrink supply for later rounds.

**D-09 cross-pool restriction edit site** — the existing cross-pool fallback loop inside `resolveTieredCandidates` (lines 302-312) currently backfills whatever tier `tierSupplyMeetsNeed` finds short, unrestricted. Must be modified so that once the NEW same-pool cascade (D-08) is exhausted and cross-pool fallback is reached, `fallbackPlayers` is filtered to `p.tier === 'common'` only:

```typescript
const fallbackPlayers = resolvePoolPlayers([fallbackPoolId]).filter(
  (p) => p.role !== 'GK' && !usedIds.has(p.id),
  // ADD (D-09): && p.tier === 'common'  — only once same-pool cascade exhausted
);
```

**Stale comment to remove/update:** lines ~353-357, the D-18 comment block ("a card CAN reappear in a different round... never tracked match-wide") is now false and must be updated to describe D-06's match-wide dedup instead.

**Don't-hand-roll guidance:** use a plain `Set<string>` threaded as a function parameter — this is the codebase's own established minimal-diff idiom (CONTEXT.md's "Claude's Discretion" explicitly leaves the exact structure open, but a `Set` matches every existing `usedIds` sibling in this file).

---

### `packages/server/src/__tests__/draftPacks.test.ts` (test) — Bugs 2/3 / D-06/D-08/D-09/D-12

**Analog:** same file, existing per-round-only duplicate check (lines 54-66) — must be changed to assert match-wide non-duplication. Existing Test 1 (`['original']`-only scenario) is the analog to extend for the numerically-verified 7-card common-tier shortfall (RESEARCH.md Pitfall 4 table): assert the fallback actually pulls common-tier cross-pool cards, not just `not.toThrow()` (RESEARCH.md's explicit warning against a weak assertion).

**Gap to check (RESEARCH.md Wave 0 item):** verify whether `packages/shared/src/draftEngine.test.ts` exists as a standalone unit-test file for `resolveGkCandidates`/`resolveTieredCandidates`/the new cascade helper — if absent, Wave B likely needs one for direct unit coverage of D-08's cascade logic.

---

### `packages/server/src/gameEngine.ts` — SHOT/LOOSE_BALL tie branch (service, event-driven) — Bug 4 / D-14

**Analog:** same file, SAVE branches' `gkEffectivePos` usage (already correct — copy this pattern exactly)

**Correct sibling pattern to copy** (verified lines 2339-2341, 2350, 2368):

```typescript
// Source: packages/server/src/gameEngine.ts:2339-2341, 2350, 2368 (already correct — copy this pattern)
ballAfter: handling.caught
  ? { position: gkEffectivePos, carrierId: gk.id }
  : { position: gkEffectivePos, carrierId: null },
// ...
ball: { position: gkEffectivePos, carrierId: gk.id },
```

**Buggy branch to fix** (verified lines 2286-2318, the tie-outcome branch):

```typescript
if (shotResultWithPenalty.outcome === 'LOOSE_BALL') {
  const shotAttempt: ActionEvent = {
    // ...
    ballAfter: { position: state.ball.position, carrierId: null }, // BUG: should be gkEffectivePos
  };
  return {
    ok: true,
    state: {
      ...state,
      pieces: piecesWithGKPos,
      phase: 'LOOSE_BALL',
      ball: { position: state.ball.position, carrierId: null }, // BUG: should be gkEffectivePos
      // ...
    },
  };
}
```

Fix both `ballAfter` (~line 2302) and `ball` (line 2310) to use `gkEffectivePos` (already computed at line 2111), matching the SAVE branches exactly.

**Critical scope note (Pitfall 1/2):** do NOT touch `computeShotPathDeflection` (~line 3615, outfield-defender deflection, already correct) or the `computeLooseBall` scatter-walk call site (~line 2757-2766, already correct). Both CONTEXT.md and the folded todo point at the wrong location — this is the single most important correction in RESEARCH.md. The regression test must specifically construct a shooter/GK duel TIE (see `gameEngine.phase8.test.ts:718-745` for an existing tie-producing dice combination), not an outfield-defender-deflection scenario.

---

### `packages/server/src/gameEngine.ts` — `applyUndo` (service, event-driven) — Bug 5 / D-13

**Analog:** same file, existing `isBoundary` disjunction (lines 1399-1408)

**Existing pattern to extend** (verified lines 1399-1413):

```typescript
// Source: packages/server/src/gameEngine.ts:1399-1408 (applyUndo — SERVER, authoritative)
const lastSlotAdvanceIdx = state.eventLog.reduce<number>((acc, evt, idx) => {
  const isBoundary =
    evt.type === 'SLOT_ADVANCE' ||
    evt.type === 'KICK_OFF' ||
    (state.phase === 'HIGH_PASS_MOVE' && evt.type === 'HP_REPOSITION') ||
    (state.phase === 'FIRST_TIME_PASS_MOVE' && evt.type === 'FTP_REPOSITION') ||
    (state.phase === 'FREE_KICK_SETUP' &&
      (evt.type === 'FK_KICKER_CHOSEN' || evt.type === 'FK_STAGE_ADVANCE'));
  // ADD: || evt.type === 'TACKLE_ATTEMPT' || evt.type === 'STEAL_ATTEMPT'  (D-13 fix)
  return isBoundary ? idx : acc;
}, -1);

// DO NOT touch this separate check — full-lockout for 'DICE_ROLL', a DIFFERENT event type:
if (currentSlotEvents.some((e) => e.type === 'SLOT_ADVANCE' || e.type === 'DICE_ROLL')) {
  return { ok: false, reason: 'UNDO_LOCKED' };
}
```

**Critical anti-pattern to avoid (RESEARCH.md, Pitfall 5/"Fixing Bug 5 by extending the wrong check"):** adding `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` to the line-1413 full-lockout check instead of the line-1399-1408 `isBoundary` disjunction would make Undo permanently unavailable for the rest of the slot, even for moves made AFTER the tackle — directly violating D-13.

---

### `packages/client/src/components/ActionPanel.tsx` — `canUndo` (component, event-driven) — Bug 5 / D-13

**Analog:** same file, existing `isBoundary` disjunction (lines 265-272), mirrors the server pattern above

**Existing pattern to extend** (verified lines 265-272):

```typescript
// Source: packages/client/src/components/ActionPanel.tsx:265-272 (canUndo — CLIENT, UX mirror)
const lastBoundaryIdx = eventLog.reduce<number>((acc, evt, idx) => {
  const isBoundary =
    evt.type === 'SLOT_ADVANCE' ||
    evt.type === 'KICK_OFF' ||
    (phase === 'HIGH_PASS_MOVE' && evt.type === 'HP_REPOSITION') ||
    (phase === 'FIRST_TIME_PASS_MOVE' && evt.type === 'FTP_REPOSITION');
  // ADD: || evt.type === 'TACKLE_ATTEMPT' || evt.type === 'STEAL_ATTEMPT'  (D-13 fix)
  return isBoundary ? idx : acc;
}, -1);
```

This is UX-only (button disabled state) — server `applyUndo` remains the enforcement layer; both must change identically to keep the client mirror in sync (this project's established defense-in-depth convention, same pattern as BUG-32 in Phase 31).

---

### `packages/server/src/__tests__/gameEngine.phase26-undo.test.ts` (test) — Bug 5

**Analog:** same file, `describe('Phase 26 BUG-24: applyUndo scoping — MOVE phase', ...)` block (line 351) — extend with a new tackle/steal-boundary scenario asserting Undo clamps at the resolved `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` event but still works for later same-slot steps.

### `packages/server/src/__tests__/gameEngine.phase8.test.ts` (test) — Bug 4

**Analog:** same file, existing tie-producing test near lines 718-745 (shooter die 3 + GK die 4, GK dive position that does NOT cancel the tie) — extend/adapt to assert `result.state.ball.position` equals `gkEffectivePos`, not the shooter's origin hex.

## Shared Patterns

### Server-authoritative fail-closed convention (CR-01/WR-01)

**Source:** `packages/shared/src/draftEngine.ts` comments (lines 367-378, 398-402, 412-416)
**Apply to:** D-11's supply-exhaustion path — keep the existing loud "insufficient supply" `Error` throw; never silently reuse a used card or leave a pack short.

### Defense-in-depth client+server validation

**Source:** established in Phase 31 (BUG-32), reused for Bug 5 here
**Apply to:** `ActionPanel.tsx`'s `canUndo` (client, UX-only) + `gameEngine.ts`'s `applyUndo` (server, authoritative) — both must change identically, in the boundary-detection disjunction, never the separate full-lockout check.

### Socket handler structure (`socket.data.roomCode` as sole source of truth)

**Source:** `packages/server/src/roomHandlers.ts`, every existing handler (`ROOM_CREATE`, `ROOM_JOIN`, `ROOM_SETTINGS_CONFIRM`)
**Apply to:** new `LEAVE_ROOM` handler — read `socket.data.roomCode`, never a client-supplied payload argument (V3/V4 security convention already established project-wide).

### `usedIds: Set<string>` dedup idiom

**Source:** `packages/shared/src/draftEngine.ts` (`resolveGkCandidates` line 256, `resolveTieredCandidates` line 299)
**Apply to:** D-06's match-wide set — same idiom, wider scope (threaded as a parameter across the round loop in `generateDraftPacks` instead of created fresh per call).

## No Analog Found

None — every file in this phase has an exact in-file or same-subsystem sibling pattern (see RESEARCH.md's own "Key insight": each of the 5 fixes has a same-file, same-pattern sibling to copy).

## Metadata

**Analog search scope:** `packages/shared/src`, `packages/server/src`, `packages/client/src/components`, `packages/client/src/store` — all fix sites are in-file siblings; no cross-package or external-library analog search was needed since this is a 3-subsystem defect-correction phase with zero new patterns.
**Files scanned:** `events.ts`, `roomHandlers.ts`, `roomStore.ts`, `App.tsx`, `GameSettingsScreen.tsx`, `useGameStore.ts`, `LobbyScreen.tsx`, `draftEngine.ts`, `draftPacks.ts`, `gameEngine.ts`, `ActionPanel.tsx`, plus test files `draftPacks.test.ts`, `gameEngine.phase26-undo.test.ts`, `gameEngine.phase8.test.ts`
**Pattern extraction date:** 2026-07-28
