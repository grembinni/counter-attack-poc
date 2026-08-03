# Phase 31: Bug Fixes - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 5 (bug-fix phase — modifications, not new files)
**Analogs found:** 5 / 5 (in-file sibling patterns; no cross-codebase analogs needed since every fix extends an existing pattern already present in the same file)

**Note on phase type:** This is a defect-correction phase. There are no genuinely "new" files — every target file is an existing file being extended to match a pattern that already exists elsewhere in that same file (e.g. add a field to `ActionEvent` the same way sibling variants already have it; add a `role !== 'GK'` guard the same way other gates already filter by role). Analogs below are therefore **sibling code blocks within the same files**, which is the strongest possible match quality.

## File Classification

| File                                                                                                 | Role                                        | Data Flow        | Closest Analog                                                                                                               | Match Quality                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `packages/shared/src/types.ts`                                                                       | model (discriminated union)                 | transform        | Sibling `ActionEvent` variants already carrying `ballAfter` (e.g. `MOVE`, `HIGH_PASS`)                                       | exact (same union, same shape convention)       |
| `packages/server/src/gameEngine.ts` (GOAL sites)                                                     | service (pure state-transition)             | event-driven     | `buildReplayFrames`'s existing "Universal ball position update" pattern (`ballAfter` handling, ~4666-4669)                   | exact — extend same mechanism for `piecesAfter` |
| `packages/server/src/gameEngine.ts` (REPLAY_ELIGIBLE_TYPES / buildReplayFrames)                      | service (pure reconstruction)               | batch/transform  | Existing `GK_KICK`/`LOOSE_BALL_LAND` entries already in the set (~4499-4508)                                                 | exact — already present, verify only            |
| `packages/server/src/gameEngine.ts` (applyResolveHeaderTarget)                                       | service (FSM transition)                    | event-driven     | Existing `movedPieceIds` locking pattern used elsewhere (e.g. `applyMove`'s `abandonedIds`/`computeMovedPieceIds`, ~699-714) | role-match                                      |
| `packages/server/src/gameHandlers.ts` (SNAPSHOT_DEFLECT validator — **not gameEngine.ts**, see note) | middleware/validator (socket handler guard) | request-response | Same file's `validateResponseMoveStep` config pattern + existing `sdPiece.role === 'GK'` branch (~453-456)                   | exact                                           |
| `packages/client/src/components/HexGrid.tsx` (`canSelectSnapDeflect`)                                | component (selection gate)                  | request-response | Sibling `canSelect*` gates in the same block (`canSelectHighPassMove`, `canSelectGKKickMove`)                                | exact                                           |
| `packages/client/src/components/ActionPanel.tsx` (`remaining` calc)                                  | component (derived UI state)                | transform        | Sibling derived-count logic already in the same block (`paceExhaustedNotLocked`, `currentSlotLockedCount`)                   | exact                                           |
| `packages/server/src/__tests__/gameEngine.rule11.test.ts`                                            | test                                        | n/a              | Existing `describe('RULE-02: applyResolveHeaderTarget ...')` blocks in the same file                                         | exact                                           |

## Pattern Assignments

### `packages/shared/src/types.ts` — add `piecesAfter` to `GOAL`, verify `GK_KICK`/`LOOSE_BALL_LAND` shape

**Current state (already correct for GK_KICK):** `GK_KICK` (lines 309-318) and `LOOSE_BALL_LAND` (lines 302-308) **already carry `ballAfter`** — the folded todo's "no ballAfter field" premise appears to already be resolved in the current codebase. Verify during planning rather than assuming the gap still exists; the remaining gap is likely only that these were missing from `REPLAY_ELIGIBLE_TYPES` at some point (also already present — see below) or a narrower delivery-timing issue in `buildReplayFrames`.

**Analog — `GOAL` variant today** (types.ts:152-159):

```typescript
| {
    type: 'GOAL';
    scoringTeam: 'home' | 'away';
    /** ID of the piece that scored — shown in the ActionLog as "[SHOT] # Name SCORED!". */
    scorerId: string;
    timestamp: number;
    ballAfter: { position: HexCoord; carrierId: string | null };
  }
```

**Pattern to copy — add `piecesAfter` following the `ballAfter` naming/shape convention:**

```typescript
| {
    type: 'GOAL';
    scoringTeam: 'home' | 'away';
    scorerId: string;
    timestamp: number;
    ballAfter: { position: HexCoord; carrierId: string | null };
    piecesAfter: Piece[]; // D-01: full post-kickoff-reset piece array (BUG-30)
  }
```

Use whatever the project's existing `Piece[]` / pieces array element type is named elsewhere in this file (check the `GameState.pieces` type immediately above/below this union for the exact type name to reuse — do not invent a new shape).

---

### `packages/server/src/gameEngine.ts` — GOAL construction sites (~2150-2178, ~2241-2270)

**Analog — unsaveable-shot branch** (gameEngine.ts:2146-2179): both branches already call `buildKickOffPieces(newKickOffTeam, state.selectedTeams, state.selectedFormation)` at the `state.pieces:` key (line 2150-2154 and 2241-2245). The **same computed value** is available to populate the new `piecesAfter` field on the `GOAL` event — no new computation needed, just reuse the already-computed `resetPieces`-equivalent expression in the event literal:

```typescript
// existing (line 2150-2154 / 2241-2245):
pieces: buildKickOffPieces(
  newKickOffTeam,
  state.selectedTeams,
  state.selectedFormation,
),
...
eventLog: [
  ...state.eventLog,
  shotAttemptGoal,
  {
    type: 'GOAL' as const,
    scoringTeam,
    scorerId: shooter.id,
    timestamp: Date.now(),
    ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
    // ADD: piecesAfter: <same buildKickOffPieces(...) call result — hoist to a local
    //   const so it's computed once and used both for state.pieces and event.piecesAfter>
  },
],
```

**Recommended refactor pattern:** hoist `const resetPieces = buildKickOffPieces(newKickOffTeam, state.selectedTeams, state.selectedFormation);` above the `return { ok: true, state: {...} }` in each branch (mirrors the exact pattern already used verbatim at the second-half kickoff reset, line 4442-4446), then reference `resetPieces` in both `state.pieces` and the `GOAL` event's new `piecesAfter` field. This avoids computing `buildKickOffPieces` twice per branch.

---

### `packages/server/src/gameEngine.ts` — second-half kickoff reset (~4442-4446)

**Analog / reference pattern (already correct, D-01's hoist recommendation is modeled on this):**

```typescript
// gameEngine.ts:4442-4446
const resetPieces = buildKickOffPieces(
  newAttackingTeam,
  state.selectedTeams,
  state.selectedFormation,
);
```

This is a plain `pieces:` state field, not an eventLog entry (there's no `ActionEvent` for a bare second-half kickoff besides `KICK_OFF`, which has no `piecesAfter` need since `buildReplayFrames`'s initial seed already calls `buildKickOffPieces` directly at line 4546-4550). D-02 asks to verify this path is fine in replay — likely already is, since `buildReplayFrames` seeds `current.pieces` via the identical `buildKickOffPieces` call. Confirm during implementation rather than assuming a fix is needed here.

---

### `packages/server/src/gameEngine.ts` — `buildReplayFrames` GOAL handling (~4654-4661) and `REPLAY_ELIGIBLE_TYPES` (~4480-4508)

**Analog — existing "Universal ball position update" pattern** (gameEngine.ts:4666-4669), the exact mechanism to mirror for `piecesAfter`:

```typescript
// Universal ball position update — driven by ballAfter on replay-eligible events (REPLAY-06)
if ('ballAfter' in event) {
  current = { ...current, ball: event.ballAfter };
}
```

**Existing GOAL-specific handling to extend** (gameEngine.ts:4654-4661):

```typescript
// Apply board mutations
if (event.type === 'GOAL') {
  // Score increment — ball position is updated via universal ballAfter below
  const newScore = {
    ...current.score,
    [event.scoringTeam]: current.score[event.scoringTeam] + 1,
  };
  current = { ...current, score: newScore };
  // ADD: current = { ...current, pieces: event.piecesAfter } here, applying
  // the new piecesAfter field the same way ballAfter is applied universally below.
} else if (event.type === 'KICK_OFF') {
  current = { ...current, movementSlot: 'ATTACKER_4' };
}
```

**`REPLAY_ELIGIBLE_TYPES` — already contains `GK_KICK` and `LOOSE_BALL_LAND`** (gameEngine.ts:4499-4508):

```typescript
// REPLAY-07: GK_KICK ball delivery — carries ballAfter (position: targetHex, carrierId:
// receiver.id | null); construction at gameHandlers.ts ~line 823.
'GK_KICK',
// REPLAY-08: LOOSE_BALL_LAND scatter resolution — carries ballAfter (position: finalPosition,
// carrierId: finalCarrierId | null); construction at gameEngine.ts ~line 2754.
'LOOSE_BALL_LAND',
```

**IMPORTANT for planner:** the folded GK_KICK/LOOSE_BALL_LAND todo's stated root cause ("no ballAfter field... missing from REPLAY_ELIGIBLE_TYPES") does **not match current code** — both fields and set membership already exist with comments citing "REPLAY-07"/"REPLAY-08" as if already fixed. The planner/implementer must re-diagnose this sub-bug from scratch (e.g. check `gameHandlers.ts` GK_KICK construction at ~line 823 for a timing/ordering issue instead of a missing-field issue) rather than assume the todo's original diagnosis is still accurate.

---

### `packages/server/src/gameHandlers.ts` — SNAPSHOT_DEFLECT server-side validator (BUG-32)

**Correction to CONTEXT.md's stated location:** the SNAPSHOT*DEFLECT move validator that must reject a GK-selected deflection responder lives in **`packages/server/src/gameHandlers.ts` (lines 438-476)**, not `gameEngine.ts` as stated in the phase context. `gameEngine.ts`'s `applyMove` (line 660) explicitly rejects any phase other than `'MOVE'`/`FREE_MOVE*\*`, so SNAPSHOT_DEFLECT moves never reach it — they're validated entirely within the socket handler via `validateResponseMoveStep` + this block.

**Analog — the block to modify** (gameHandlers.ts:438-476), note it currently has GK-specific logic assuming GK _can_ be the deflect piece (line 452-456):

```typescript
if (room.gameState.phase === 'SNAPSHOT_DEFLECT') {
  const sdState = room.gameState;
  const defendingTeam: 'home' | 'away' = sdState.attackingTeam === 'home' ? 'away' : 'home';
  const validation = validateResponseMoveStep(io, socket, room, pieceId, to, {
    actingTeam: defendingTeam,
    lockedPieceIdKey: 'snapDeflectMovedPieceId',
    paceUsedKey: 'snapDeflectPaceUsed',
    paceCap: 2,
    clickDistanceMode: 'range',
  });
  if (!validation.ok) return;
  const { piece: sdPiece, distanceMoved: clickDistance } = validation;
  const paceUsed = sdState.snapDeflectPaceUsed ?? 0;
  // SNAP-02: if the GK is being moved, recompute the snapshot GK penalty from new position.
  let snapshotGkPenalty = sdState.snapshotGkPenalty ?? 0;
  if (sdPiece.role === 'GK' && sdState.shotTargetHex) {
    const dist = hexDistance(to, sdState.shotTargetHex);
    snapshotGkPenalty = dist <= 1 ? 0 : dist === 2 ? -1 : dist === 3 ? -2 : 0;
  }
  ...
}
```

**Fix pattern:** add a rejection guard immediately after `validation.ok` succeeds (or better, before calling `validateResponseMoveStep`, by checking the looked-up piece's role), following the `fail(...)` pattern already used inside `validateResponseMoveStep` (gameHandlers.ts:211-223, e.g. `fail('WRONG_TEAM')`/`fail('WRONG_PIECE')`). Since `validateResponseMoveStep` is a shared helper used by HIGH_PASS_MOVE/GK_KICK_MOVE/FTP too, do NOT add a GK-role check inside that shared function — instead add the check locally in the SNAPSHOT_DEFLECT block only, e.g.:

```typescript
const piece = room.gameState.pieces.find((p) => p.id === pieceId);
if (piece?.role === 'GK') {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PIECE' as never);
  broadcastState(io, room);
  return;
}
```

mirroring the `fail(...)` shape used at gameHandlers.ts:211-215. Once GK can never be the deflect piece, the now-dead `sdPiece.role === 'GK'` branch (line 452-456) becomes unreachable and should be removed as part of this fix (was compensating for the very defect being fixed).

---

### `packages/client/src/components/HexGrid.tsx` — `canSelectSnapDeflect` (BUG-32 client layer)

**Analog — sibling `canSelect*` gates in the same block** (HexGrid.tsx:706-756), showing the established convention of ANDing role/team/state conditions:

```typescript
// canSelectHighPassMove (line 727-732):
const canSelectHighPassMove =
  phase === 'HIGH_PASS_MOVE' &&
  isActivePlayer &&
  myTeam !== null &&
  piece.teamId === myTeam &&
  (highPassMovedPieceId === null || highPassMovedPieceId === piece.id);
```

**Current `canSelectSnapDeflect`** (HexGrid.tsx:735-741) — the fix target:

```typescript
const canSelectSnapDeflect =
  phase === 'SNAPSHOT_DEFLECT' &&
  myTeam !== null &&
  myTeam === snapDefendingTeam &&
  piece.teamId === myTeam &&
  (snapDeflectMovedPieceId === null || snapDeflectMovedPieceId === piece.id) &&
  (snapDeflectPaceUsed ?? 0) < 2; // RULE-04 D-09: suppress when pace exhausted
```

**Fix pattern:** add `piece.role !== 'GK' &&` as an additional AND clause, following the same flat-boolean-chain convention already used by every sibling `canSelect*` gate in this file.

---

### `packages/client/src/components/ActionPanel.tsx` — `remaining` calculation (BUG-31)

**Analog — existing derived-count logic in the same block** (ActionPanel.tsx:921-933), the pattern to extend rather than replace:

```typescript
const paceExhaustedNotLocked = Object.entries(paceUsedByPieceId).filter(([id, used]) => {
  if (movedPieceIds.includes(id)) return false;
  const p = pieces.find((pc) => pc.id === id);
  if (p === undefined) return false;
  const effectiveCap = movementSlot === 'ATTACKER_2' ? Math.min(p.pace, 2) : p.pace;
  return used >= effectiveCap;
}).length;
const currentSlotLockedCount = movedPieceIds.filter(
  (id) => paceUsedByPieceId[id] !== undefined,
).length;
const remaining =
  slotTotal != null
    ? Math.max(slotTotal - currentSlotLockedCount - paceExhaustedNotLocked, 0)
    : null;
```

**Analog for the "started" signal to reuse per D-03** — `activatedCount` in HexGrid.tsx:702 (same `paceUsedByPieceId` source, already computed by simple `Object.keys(...).length`):

```typescript
const activatedCount = Object.keys(paceUsedByPieceId).length;
```

**Fix pattern (per D-04):** replace `remaining`'s subtracted terms so "started" is counted the moment `paceUsedByPieceId[id] > 0` (any entry, not just exhausted-or-locked ones). The minimal change consistent with the existing style:

```typescript
const startedCount = Object.keys(paceUsedByPieceId).length; // BUG-31/D-04: any piece with pace used counts as "started"
const remaining =
  slotTotal != null
    ? Math.max(slotTotal - currentSlotLockedCount - startedCount... /* avoid double count vs currentSlotLockedCount overlap */, 0)
    : null;
```

Note: `currentSlotLockedCount` (locked-into-`movedPieceIds`-in-this-slot) and `startedCount` (any `paceUsedByPieceId` entry) overlap for pieces that are both started AND locked — the planner must dedupe (e.g. count `new Set([...lockedIds-in-slot, ...startedIds]).size` rather than summing two possibly-overlapping counts) to avoid under-counting `remaining`. `paceExhaustedNotLocked` becomes redundant once `startedCount` is used (every exhausted-not-locked piece already has `paceUsedByPieceId[id] > 0` and is therefore already "started") — likely safe to delete that intermediate variable entirely.

**`ctaButtonClass`** (ActionPanel.tsx:46-48) needs **no changes** — it's a pure function of `eligibleRemaining`; only the value passed to it (`remaining` at line 972: `ctaButtonClass(remaining ?? 0)`) changes behavior once `remaining` is fixed. D-05 (Undo must clear started-state) should fall out automatically once `remaining` is derived purely from `state.paceUsedByPieceId`, since Undo already reverts that field elsewhere (verify Undo's handler clears/decrements `paceUsedByPieceId[id]` — check `applyUndo` in `gameEngine.ts` for the MOVE-undo branch, not yet read in this pass).

---

### `packages/server/src/gameEngine.ts` — `applyResolveHeaderTarget` (folded header-winner todo)

**Analog — `movedPieceIds` locking pattern used elsewhere** (`applyMove`, gameEngine.ts:699-714):

```typescript
const abandonedIds = isNewActivation
  ? Object.keys(state.paceUsedByPieceId).filter(
      (id) => id !== pieceId && !state.movedPieceIds.includes(id),
    )
  : [];
const computeMovedPieceIds = (forceIncludeSelf = false): string[] => {
  const ids = new Set(state.movedPieceIds);
  for (const id of abandonedIds) ids.add(id);
  if (forceIncludeSelf) ids.add(pieceId);
  return [...ids];
};
```

**Current occupant-PASS branch to fix** (gameEngine.ts:3491-3520) — `movedPieceIds` is not set at all on the returned state (falls through to whatever `...state` carries, i.e. unchanged):

```typescript
if (occupant) {
  const receiverTeam = occupant.teamId;
  const occupantBall = { position: targetHex, carrierId: occupant.id };
  return {
    ok: true,
    state: {
      ...state,
      phase: 'PASS',
      attackingTeam: receiverTeam,
      activeTeam: receiverTeam,
      ball: occupantBall,
      lastActionType: 'HEADER',
      contestedPieceIds: contestedIds,
      stealAttemptedByIds: [],
      tackleAttemptedByIds: [],
      offsidePieceIds: evaluateOffside({
        ...state,
        attackingTeam: receiverTeam,
        ball: occupantBall,
      }),
      eventLog: [...state.eventLog, headedPassEvent],
      ...headerCleared,
      // MISSING: movedPieceIds update including resolvedWinner?.id
    },
  };
}
```

**Fix pattern:** add `movedPieceIds: resolvedWinner ? [...state.movedPieceIds, resolvedWinner.id] : state.movedPieceIds,` to both the occupant-PASS branch (3491-3520) and the empty-hex/loose-ball branch (3522-3543), following the simple append convention (no dedup helper needed here since `resolvedWinner.id` cannot already be in `movedPieceIds` — it was mid-header-contest, not mid-movement-phase). Guard against `resolvedWinner` being `null` (uncontested/declined header case, per the type comment at line 3423 `referencePosition = resolvedWinner?.position ?? state.ball.position`) — do not push `null`/`undefined` into `movedPieceIds`.

---

### `packages/server/src/__tests__/gameEngine.rule11.test.ts` — test updates for header-winner fix

**Analog — existing test structure for `applyResolveHeaderTarget`** (file has `describe('RULE-02: applyResolveHeaderTarget — valid resolve (D-05/D-06)')` at line 249, and a state builder `makeHeaderStateWithWinner` used throughout, e.g. line 175/230/270/280/300/352/403). Base state includes `movedPieceIds: []` at line 120.

**Pattern to copy:** add assertions in the existing occupant-receives-ball and empty-hex describe blocks (search for the `describe` blocks covering the non-goal-line PASS-transition branches around lines 249-364) asserting `result.state.movedPieceIds` now includes the winning contestant's piece ID, using the same `expect(result.state.X).toBe/toEqual(...)` style already used for `headerDuelWinner` assertions (e.g. line 310 `expect(result.state.headerDuelWinner).toBeNull();`).

## Shared Patterns

### Server-authoritative two-layer validation (BUG-32)

**Source:** established codebase-wide convention, exemplified by `canSelectSnapDeflect` (client, HexGrid.tsx) + SNAPSHOT_DEFLECT handler block (server, gameHandlers.ts:438-476)
**Apply to:** BUG-32's fix must land in both `HexGrid.tsx` (client gate) and `gameHandlers.ts` (server validator) — never client-only, per CONTEXT.md D-06 and CLAUDE.md's ARCH-01..07 server-authoritative constraint.

### `ballAfter`-style universal-apply pattern for new per-event derived fields

**Source:** `buildReplayFrames`'s `if ('ballAfter' in event) { current = { ...current, ball: event.ballAfter }; }` (gameEngine.ts:4666-4669)
**Apply to:** BUG-30's new `piecesAfter` field on `GOAL` — extend the GOAL-specific branch (not the universal check, since `piecesAfter` is GOAL-only, unlike `ballAfter` which many event types share) at gameEngine.ts:4654-4661.

### `movedPieceIds` as canonical "spent this phase" marker

**Source:** `applyMove`'s `abandonedIds`/`computeMovedPieceIds` (gameEngine.ts:699-714), consumed by `canSelect*` gates client-side and phase-completion checks server-side
**Apply to:** folded header-winner todo's fix in `applyResolveHeaderTarget` — append the winning piece's ID the same way, but note this is a _simple append_, not the abandon-sweep logic (different granularity per CONTEXT.md's "Integration Points" note — do not conflate the two mechanisms).

## No Analog Found

None — every target file already contains an in-file sibling pattern to extend (see Match Quality column, all rated exact or role-match). This phase requires no cross-codebase pattern search since it is pure defect correction within existing, already-established conventions.

## Metadata

**Analog search scope:** `packages/shared/src/types.ts`, `packages/server/src/gameEngine.ts`, `packages/server/src/gameHandlers.ts`, `packages/client/src/components/HexGrid.tsx`, `packages/client/src/components/ActionPanel.tsx`, `packages/server/src/__tests__/gameEngine.rule11.test.ts`
**Files scanned:** 6 (all target files read directly; no external search needed since analogs are in-file)
**Pattern extraction date:** 2026-07-22
**Key discrepancy flagged for planner:** the SNAPSHOT*DEFLECT server-side validator is in `gameHandlers.ts`, not `gameEngine.ts` as stated in 31-CONTEXT.md D-06 — `gameEngine.ts`'s `applyMove` only handles phase `'MOVE'`/`FREE_MOVE*\*`. Also, the folded GK_KICK/LOOSE_BALL_LAND replay todo's stated root cause (missing `ballAfter`field / missing`REPLAY_ELIGIBLE_TYPES`entries) does not match current code — both already exist with "REPLAY-07"/"REPLAY-08" comments implying a prior fix; this sub-bug needs re-diagnosis, likely in`gameHandlers.ts` GK_KICK construction (~line 823) rather than in the type/set definitions.
