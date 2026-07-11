---
phase: 25-bug-uat-closure
reviewed: 2026-07-11T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/FreeKickSetupPanel.test.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/PieceOverlay.tsx
  - packages/client/src/styles/uniformStyles.tsx
  - packages/server/src/gameEngine.ts
  - packages/shared/src/offside.ts
  - packages/shared/src/types.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-07-11  
**Depth:** standard  
**Files Reviewed:** 9  
**Status:** issues_found

## Summary

This review covers the Phase 25 bug-UAT-closure implementation: the FREE_KICK_SETUP panel
work (ActionPanel.tsx / FreeKickSetupPanel.test.tsx), hex-grid highlighting and piece
rendering (HexGrid.tsx / PieceOverlay.tsx), uniform style rendering (uniformStyles.tsx),
the shared offside and free-kick stage types (offside.ts / types.ts), and the core game
engine (gameEngine.ts).

The dominant risk area is `gameEngine.ts`. Two blocker-level defects exist in the
`computeAutoAssignment` function (silent null at slot 0 when the squad has no GK) and the
`applyMove` STEAL_ATTEMPT path (unchecked non-null assertion that crashes on an empty
defenders array). Neither requires an adversarial actor — each can fire from malformed
squad CSV data or a future validator change respectively.

Client-side code is generally clean. The principal quality issues are a stale JSDoc comment
in `types.ts`, a weak test assertion in `FreeKickSetupPanel.test.tsx`, and a dead rendering
element in `uniformStyles.tsx`.

---

## Critical Issues

### CR-01: `computeAutoAssignment` — null GK slot silently cast to `PoolPlayer[]`

**File:** `packages/server/src/gameEngine.ts:184-218`

**Issue:** Pass 1 (lines 196–200) only fills `result[0]` when a GK is found:

```ts
const gkEntry = available.find((e) => e.player.role === 'GK');
if (gkEntry) {
  result[0] = gkEntry.player;
  ...
}
```

Pass 2 (line 203) and Pass 3 (line 211) both start their loops at `i = 1`, explicitly
skipping slot 0. If no GK exists in the squad, `result[0]` remains `null` and is never
filled by any pass. The function then returns:

```ts
return result as PoolPlayer[];
```

The `as PoolPlayer[]` type assertion discards TypeScript's knowledge that the array was
declared as `(PoolPlayer | null)[]`, hiding the null. Downstream code in `buildSquadPieces`
spreads each player into a piece object:

```ts
const homeSquad = homePlayers.map((p, i) => ({
  ...p,               // spreading null returns {} — no crash here
  pace: undefined,    // implied — all player stats are missing
  ...
}));
```

`{ ...null }` in JavaScript returns an empty object (no TypeError at spread time), so the
GK slot produces a `PlayerPiece` with `pace: undefined`, `shooting: undefined`, etc. Every
downstream stat comparison (`paceUsedByPieceId[id] >= piece.pace`) produces `NaN` for this
piece, corrupting movement validation silently for the entire match.

**Trigger condition:** Squad CSV missing a player whose `role === 'GK'`.

**Fix:**

```ts
// After Pass 1, before Pass 2 — hard-fail if GK is absent
if (!gkEntry) {
  throw new Error(
    `computeAutoAssignment: squad for ${JSON.stringify(squad.map((p) => p.role))} has no GK`,
  );
}
// OR return an error discriminant and let the caller surface it:
// return { ok: false, reason: 'NO_GK_IN_SQUAD' };
```

---

### CR-02: `applyMove` — unguarded non-null assertion on `defenders[0]`

**File:** `packages/server/src/gameEngine.ts:806-811`

**Issue:** When `validateMove` returns a `STEAL_ATTEMPT` effect, the code immediately
accesses the first defender with a non-null assertion and no length check:

```ts
const defender = result.effect.defenders[0];
stealDefenderId = defender!.id; // TypeError if defenders is empty
```

If `moveValidator` ever emits `STEAL_ATTEMPT` with an empty `defenders` array (e.g., after
a future refactor of ZoI logic), this throws `TypeError: Cannot read properties of
undefined (reading 'id')` — a hard server crash with no error recovery for the room.

**Fix:**

```ts
const defender = result.effect.defenders[0];
if (!defender) {
  // defensive: validator contract broken — treat as no-steal and continue
  console.error('applyMove: STEAL_ATTEMPT effect has no defenders', { pieceId, to });
  // fall through to normal move
} else {
  stealDefenderId = defender.id;
  // ... rest of steal resolution
}
```

---

## Warnings

### WR-01: `applyFreeMove` — fabricated `slot: 'ATTACKER_2'` in FREE_MOVE event log

**File:** `packages/server/src/gameEngine.ts:554-563`

**Issue:** Every move emitted during FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE is logged as a
standard `MOVE` event with `slot: 'ATTACKER_2'`:

```ts
const moveEvent: ActionEvent = {
  type: 'MOVE',
  pieceId,
  from: piece.position,
  to,
  slot: 'ATTACKER_2', // fabricated — free-move has no slot
  timestamp: Date.now(),
  ballAfter: state.ball, // pre-move ball position, never updated
};
```

This has two consequences:

1. **Misleading event log:** Replay code or stats pipelines that branch on `event.slot` see
   free-move events labelled as ATTACKER_2 moves. Since `applyUndo` uses `type === 'MOVE'`
   to find moves for free phases, this currently works by accident, but any replay system
   querying `slot` for counting or display will get incorrect results.

2. **`ballAfter` records stale position:** `state.ball` is the pre-move ball state. The
   ball position in the event is not updated to reflect the moved piece's new position.
   This is safe _only_ because ball carriers are never in the opposite final third (the
   eligibility invariant in `applyFreeMoveZoneCheck`), but this invariant is not asserted
   in code, leaving the `ballAfter` correctness dependent on an undocumented assumption.

**Fix:** Introduce a distinct `'FREE_MOVE'` event type in `ActionEventType` (analogous to
`HP_MOVE`/`FTP_MOVE`) so free-move entries are unambiguously distinguishable from ATTACKER_2
slot moves. Update `applyUndo`'s `moveTypeForPhase` mapping to match.

---

### WR-02: `applyFreeMoveEnd` — no phase guard, always returns `ok: true`

**File:** `packages/server/src/gameEngine.ts:1202`

**Issue:** The function signature is:

```ts
export function applyFreeMoveEnd(state: GameState): { ok: true; state: GameState } {
```

Unlike every other engine function (`applyEndTurn`, `applyMove`, `applyUndo`, etc.), this
returns a non-discriminated union with no error variant. If called while `state.phase` is
not `FREE_MOVE_ATTACK` or `FREE_MOVE_DEFENSE` (e.g., a handler routing bug), the function
falls through to the `FREE_MOVE_DEFENSE` branch and unconditionally clears
`freeMoveResume`, `freeMoveEligibleIds`, `freeMoveUsedPace`, and `movedPieceIds` — all
game-state fields that may be actively in use. There is no recovery path.

**Fix:**

```ts
export function applyFreeMoveEnd(
  state: GameState,
): { ok: false; reason: 'WRONG_PHASE' } | { ok: true; state: GameState } {
  if (state.phase !== 'FREE_MOVE_ATTACK' && state.phase !== 'FREE_MOVE_DEFENSE') {
    return { ok: false, reason: 'WRONG_PHASE' };
  }
  // ... rest unchanged
}
```

---

### WR-03: `types.ts` JSDoc for `freeKickStageIndex` contradicts `FREE_KICK_STAGES`

**File:** `packages/shared/src/types.ts:716-719`

**Issue:** The JSDoc comment on `freeKickStageIndex` reads:

```
* 0 = kicking team, up to 5; 1 = conceding team, up to 5;
```

But `FREE_KICK_STAGES` in `packages/shared/src/offside.ts:38-43` was reduced to `max: 4`
for stages 0 and 1 by Plan 25-06:

```ts
export const FREE_KICK_STAGES = [
  { side: 'kicking', max: 4 }, // was 5
  { side: 'defending', max: 4 }, // was 5
  { side: 'kicking', max: 3 },
  { side: 'defending', max: 2 },
] as const;
```

Any developer reading the `GameState` type to understand the free-kick budget will see the
wrong cap (5 vs 4) and build incorrect assumptions or tests.

**Fix:** Update the JSDoc in `types.ts` line 716 to read "up to 4" for both stage 0 and
stage 1.

---

### WR-04: `FreeKickSetupPanel.test.tsx` — End Turn click test makes no emit assertion

**File:** `packages/client/src/components/FreeKickSetupPanel.test.tsx:233-249`

**Issue:** The test named "clicking End Turn (when enabled) calls emitFreeKickReady"
asserts only that the button is still visible after the click:

```ts
fireEvent.click(endTurn);
// Only asserts the button is still present — not that the emit fired
expect(screen.getByRole('button', { name: /end turn/i })).toBeDefined();
```

A completely broken or missing `onClick` handler would pass this test. Every other
emit-testing suite in `ActionPanel.test.tsx` correctly mocks the emitter and asserts
`toHaveBeenCalledOnce()` — this test should follow that pattern.

**Fix:**

```ts
it('clicking End Turn (when enabled) calls emitFreeKickReady', () => {
  const emitFreeKickReady = vi.fn();
  useGameStore.setState({
    playerSlot: 1,
    emitFreeKickReady,   // inject mock
    gameState: freeKickSetupState(1, { /* cleared pieces */ }),
  });
  render(<FreeKickSetupPanel />);
  fireEvent.click(screen.getByRole('button', { name: /end turn/i }));
  expect(emitFreeKickReady).toHaveBeenCalledOnce();
});
```

---

## Info

### IN-01: `uniformStyles.tsx` `shapeCircle` — dead rendering element

**File:** `packages/client/src/styles/uniformStyles.tsx:485-491`

**Issue:** The `shapeCircle` renderer emits two overlapping circles both using
`fill={palette.homePrime}`:

```tsx
overlay: (
  <>
    <circle cx={cx} cy={cy} r={R * 0.7}   fill={palette.homePrime} ... />  // outer
    <circle cx={cx} cy={cy} r={dotR}       fill={palette.homePrime} ... />  // dotR ≈ 0.583R
  </>
),
```

The prime-dot circle (`r ≈ 0.583R`) is fully contained within the outer circle
(`r = 0.7R`) and shares its fill color. The inner element is invisible — it produces no
visual output. Every other renderer in the file has the prime dot overlaid on a different
base pattern (where the dot's purpose is legibility contrast), not on an identical fill.

**Fix:** Remove the redundant inner circle from `shapeCircle`'s overlay.

---

### IN-02: `gameEngine.ts` — `console.error` debug artifact in server code

**File:** `packages/server/src/gameEngine.ts:289-292`

**Issue:**

```ts
console.error(`buildSquadPieces: missing jersey-#9 for attacking team=...`);
```

Raw `console.error` in production server code produces unstructured output. For AWS
Elastic Beanstalk / CloudWatch deployment, log entries need consistent formatting for
filtering and alerting. The missing-kicker case also silently continues, so this error
is easy to miss in a sea of logs.

**Fix:** Route through a structured logger (or at minimum `console.warn` with a
structured object). If the kicker is genuinely required for game logic correctness,
consider throwing from `buildSquadPieces` instead of continuing silently.

---

### IN-03: `ActionPanel.tsx` — CSS module nullish-coalescing on class names

**File:** `packages/client/src/components/ActionPanel.tsx:47-48`

**Issue:**

```ts
return eligibleRemaining <= 0 ? (styles.ctaButtonReady ?? '') : (styles.ctaButtonPending ?? '');
```

The `?? ''` guards suggest CSS module class-name lookups can return `undefined`. In a
correctly typed Vite project these accesses should never be undefined for classes that
exist in the `.module.css` file. If the class is absent from the CSS module, the `?? ''`
fallback silently renders an unstyled button with no TypeScript or runtime warning. The
same pattern appears at line 159 (`styles.ctaButtonReady ?? ''`).

**Fix:** Either remove the `?? ''` guards (if the CSS classes are guaranteed by the module
file) or add an explicit TypeScript check that the class names resolve to non-empty strings
at test time, so a missing class is detected early.

---

_Reviewed: 2026-07-11_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
