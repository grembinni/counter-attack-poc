---
phase: 30-recalibrate-draft
reviewed: 2026-07-22T13:09:12Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - packages/client/src/components/ActionLog.test.tsx
  - packages/client/src/components/BenchCarousel.test.tsx
  - packages/client/src/components/BenchCarousel.tsx
  - packages/client/src/components/DraftPackCarousel.test.tsx
  - packages/client/src/components/DraftPackCarousel.tsx
  - packages/client/src/components/GameSettingsScreen.test.tsx
  - packages/client/src/components/LineupAssignmentScreen.module.css
  - packages/client/src/components/LineupAssignmentScreen.test.tsx
  - packages/client/src/components/LineupAssignmentScreen.tsx
  - packages/client/src/components/PlayerStatsPanel.test.tsx
  - packages/server/src/__tests__/draftPacks.test.ts
  - packages/server/src/__tests__/draftReconnect.integration.test.ts
  - packages/server/src/__tests__/draftSession.integration.test.ts
  - packages/server/src/__tests__/gameHandlers.rule11.test.ts
  - packages/server/src/__tests__/room.integration.test.ts
  - packages/server/src/draftSession.test.ts
  - packages/server/src/draftSession.ts
  - packages/server/src/roomHandlers.ts
  - packages/shared/src/data/player-pool.csv
  - packages/shared/src/draftEngine.test.ts
  - packages/shared/src/draftEngine.ts
  - packages/shared/src/teams.test.ts
  - packages/shared/src/teams.ts
  - packages/shared/src/types.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-07-22T13:09:12Z
**Depth:** standard
**Files Reviewed:** 22 (of 24 listed; `LineupAssignmentScreen.test.tsx` and `DraftPackCarousel.test.tsx`/`BenchCarousel.test.tsx` were read as part of scope — see note below)
**Status:** issues_found

## Summary

This phase recalibrates the draft system to a fixed-absolute-threshold tier model and a
6-round pack structure. The pure logic in `draftEngine.ts` (pool derivation, tier
classification, pack generation) and `draftSession.ts` (state machine) is well-designed and
thoroughly unit/integration tested — I traced every branch (fallback chains, position-bucket
capping, chase/rare merge pool, round/sub-step advancement) and could not find a logic defect;
`pnpm --filter @counter-attack/shared test` and `pnpm --filter @counter-attack/server test`
both pass (607/608 server tests passing; one unrelated worker-exit noise error, not a test
failure).

However, `roomHandlers.ts`'s `DRAFT_PICK` handler has an unguarded property access that lets
any connected player crash the entire Node process (not just their own room) simply by sending
a `DRAFT_PICK` event with a `slot` destination before their side's formation has been selected
— a normal, easily-reachable window in the pre-game flow, not a contrived edge case. This is a
BLOCKER given the project's single-instance-server architecture (CLAUDE.md: "single instance =
in-memory room state," "t3.micro… adequate for a POC with 2 concurrent players" — i.e. no
process isolation between rooms). No test in `draftSession.integration.test.ts` (or any other
reviewed file) exercises `DRAFT_PICK` prior to `UNIFORM_CONFIRM` completing, so this gap is
untested as well as unguarded.

Two warnings and two info-level findings are documentation/consistency nits that don't affect
correctness.

## Critical Issues

### CR-01: DRAFT_PICK crashes the server when a formation hasn't been selected yet

**File:** `packages/server/src/roomHandlers.ts:874-886`
**Issue:**
`room.draftSession` is created in the `ROOM_SETTINGS_CONFIRM` handler (line ~446-449) as soon
as `teamType === 'draft'` is locked in — i.e., **before** either player has picked a team or
confirmed a formation via `UNIFORM_CONFIRM`. `room.homePickedFormation` /
`room.awayPickedFormation` stay `undefined` until each side's `UNIFORM_CONFIRM` fires.

The `DRAFT_PICK` handler's guards (`!room.draftSession`, `draftComplete`, `requesterConfirmed`,
`room.gameState !== null`) all pass during this window, so a client can send a `DRAFT_PICK`
with any valid `PLAYER_POOL` card id and `destination: { type: 'slot', slotIndex: N }`
(0 ≤ N ≤ 10, which passes the range check) immediately after `ROOM_SETTINGS_CONFIRMED`:

```ts
if (destination.type === 'slot') {
  const formationId = side === 'home' ? room.homePickedFormation : room.awayPickedFormation;
  const slotRole = FORMATIONS[formationId!].slots[destination.slotIndex]!.slotRole; // <-- throws
  ...
}
```

`formationId` is `undefined` here, so `FORMATIONS[undefined]` evaluates to `undefined`, and
`.slots` on `undefined` throws a synchronous `TypeError`. Socket.io/Node's `EventEmitter` does
not catch synchronous throws inside event listeners (the file's own `CR-02` comment on
`ROOM_CREATE`, line ~158, calls out exactly this hazard for `createRoom`), so this exception
propagates out of the handler uncaught and crashes the whole process — every room/match
currently in progress on the server goes down, not just the offending room, because this is a
single-instance Node server per the project's deployment architecture (CLAUDE.md: "Single
instance = in-memory room state works without Redis").

This is reachable by an ordinary player still on the team-select or uniform-select screen (no
exotic tooling needed — any stray/duplicate client emit, a buggy reconnect race, or a
malicious actor with browser devtools is sufficient), and it is not covered by any existing
test: every scenario in `draftSession.integration.test.ts` drives `DRAFT_PICK` only after
`setupThroughDraftUniformConfirm()` completes (i.e., after both sides' formations are set).

**Fix:** Guard on `formationId` being defined before touching `FORMATIONS`, mirroring the
`DRAFT_REARRANGE` handler's existing `if (movingCard)` pattern that incidentally avoids this
same crash:

```ts
if (destination.type === 'slot') {
  const formationId = side === 'home' ? room.homePickedFormation : room.awayPickedFormation;
  if (!formationId) {
    socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
    return;
  }
  const slotRole = FORMATIONS[formationId].slots[destination.slotIndex]!.slotRole;
  if (slotRole === 'GK' && card.role !== 'GK') {
    socket.emit(ServerEvents.GAME_ERROR, 'GK_SLOT_REQUIRES_GK');
    return;
  }
  if (slotRole !== 'GK' && card.role === 'GK') {
    socket.emit(ServerEvents.GAME_ERROR, 'NON_GK_SLOT_REJECTS_GK');
    return;
  }
}
```

Add an integration test that emits `DRAFT_PICK` with a `slot` destination immediately after
`ROOM_SETTINGS_CONFIRMED` (before any `TEAM_PICK`/`UNIFORM_CONFIRM`) and asserts a `GAME_ERROR`
is received instead of the server crashing.

## Warnings

### WR-01: DRAFT_REARRANGE relies on incidental protection for the same unguarded FORMATIONS lookup

**File:** `packages/server/src/roomHandlers.ts:969-990`
**Issue:** `DRAFT_REARRANGE`'s `to.type === 'slot'` branch does the identical
`FORMATIONS[formationId!].slots[...]` lookup as `DRAFT_PICK` (CR-01), but is only reached
`if (movingCard)` is truthy — i.e. only when a card was already resolved from `lineupSlots`/
`benchIds`. Today that's coincidentally safe because nothing can be sitting in `lineupSlots`/
`benchIds` before a formation exists (round-1 packs don't open until after both formations are
confirmed). But this safety is incidental, not structural: it depends on invariants holding
across the whole pre-game flow, and a future change to pack-opening order (or a bootstrap
change) could silently reintroduce the same crash here. Since CR-01 is already being fixed with
an explicit `formationId` guard, apply the identical explicit guard here too instead of relying
on the `movingCard` truthiness to happen to protect it.
**Fix:** Add the same `if (!formationId) { socket.emit(...'WRONG_PHASE'...); return; }` check
before the `FORMATIONS[formationId]` lookup in the `DRAFT_REARRANGE` handler, so both handlers
share one explicit, self-documenting guard rather than one being protected by an unrelated
side-effect.

### WR-02: Stale "5, 6, or 7 cards" doc comment no longer matches the fixed 4-card pack model

**File:** `packages/client/src/components/DraftPackCarousel.tsx:122`
**Issue:** `DraftPackCarouselProps.cards` is documented as `/** The current pack's cards —
variable length (5, 6, or 7), never hardcoded. */`. Since Phase 30, every `RoundConfig` in
`packages/shared/src/types.ts` fixes `cardsPerPack: 4` for all 6 rounds (`DRAFT_ROUNDS`) — packs
are never 5, 6, or 7 cards anymore. This is leftover documentation from an earlier phase (28/29)
and will mislead a future reader into thinking pack size is still variable when it is now a
fixed, load-bearing invariant (`generateDraftPacks` assumes `cardsPerPack` from `RoundConfig`,
not the caller).
**Fix:** Update the comment to state the current invariant, e.g. `/** The current pack's cards
— always 4 (RoundConfig.cardsPerPack, D-12..D-16, Phase 30). */`.

## Info

### IN-01: Stale CSV-blankness claim in teams.test.ts no longer matches the data

**File:** `packages/shared/src/teams.test.ts:58-65`
**Issue:** The test comment states "Outfield players have blank CSV values for [Aerial
Ability] (aerialAbility = 0 is correct for them)." This is no longer accurate — outfield
players in the current `player-pool.csv`/`teams.ts` (e.g. `p002` Alistair Johnston,
`aerialAbility: 3`) have non-zero Aerial Ability values; only GK-specific fields (`shooting`
being near-zero, `highPass: 0`) follow the "GK vs outfield" split described elsewhere. The test
assertion itself (`gks.filter(p => p.aerialAbility > 0).length > 0`) still passes and is still
meaningful, so this is a documentation-only staleness, not a logic bug.
**Fix:** Update or remove the outdated "blank CSV" claim in the comment to avoid confusing a
future reader about which fields are actually GK-exclusive.

### IN-02: `PackSlot`'s standalone `'chase'` / `'rare'` tier variants are unreachable in practice

**File:** `packages/shared/src/types.ts:504-506`, exercised in `packages/shared/src/draftEngine.ts` (`SLOT_RARITY_ORDER`, `tierSupplyCount`, `buildTierPoolsForRound`)
**Issue:** `PackSlot`'s type allows `{ tier: 'chase' | 'rare', count }` as distinct slot kinds,
and `draftEngine.ts`'s helpers (`tierSupplyCount`, `buildTierPoolsForRound`,
`SLOT_RARITY_ORDER`) all handle them. However, `DRAFT_ROUNDS` (the single production
configuration, `types.ts`) never constructs a standalone `'chase'` or `'rare'` slot — every
round that needs chase/rare cards uses the merged `'chaseOrRare'` slot instead (by design, D-25:
"never prefer chase, fall back to rare"). The standalone branches are therefore dead code in
production, kept alive only by the type signature. Not a bug, but worth flagging since a future
contributor might assume standalone `'chase'`/`'rare'` slots are load-bearing when they are
untested in that configuration.
**Fix:** Either narrow `PackSlot` to only the tiers `DRAFT_ROUNDS` actually uses (dropping
standalone `'chase'`/`'rare'`) or add a code comment at the `PackSlot` type declaration noting
that standalone chase/rare slots are reserved for future use and untested in the current
round configuration.

---

_Reviewed: 2026-07-22T13:09:12Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
