# Phase 25: Bug & UAT Closure - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 11 (10 code files + 1 documentation file)
**Analogs found:** 10 / 10 code files (documentation file has no analog)

---

## File Classification

| New/Modified File                                          | Role          | Data Flow        | Closest Analog                                                                                 | Match Quality                                      |
| ---------------------------------------------------------- | ------------- | ---------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `packages/shared/src/types.ts`                             | model         | request-response | `types.ts` lines 307-314 (`HEADED_PASS` with `ballAfter`)                                      | self-analog (extend existing pattern in same file) |
| `packages/server/src/gameEngine.ts`                        | service       | event-driven     | `gameEngine.ts` lines 4348-4373 (`REPLAY_ELIGIBLE_TYPES`, `LOOSE_BALL_LAND` construction)      | self-analog                                        |
| `packages/server/src/gameHandlers.ts`                      | service       | event-driven     | `gameHandlers.ts` (GK_KICK construction — same file)                                           | self-analog                                        |
| `packages/server/src/__tests__/replay.integration.test.ts` | test          | event-driven     | `replay.integration.test.ts` lines 628-719 (`HEADED_PASS`/`GK_PUNT` test cases)                | exact                                              |
| `packages/client/src/components/HexGrid.tsx`               | component     | request-response | `EventBanner.tsx` lines 73-81 (useEffect with phase dep)                                       | role-match for Fix 2; self-analog for Fix 1        |
| `packages/client/src/components/EventBanner.tsx`           | component     | event-driven     | `EventBanner.tsx` lines 16-32 (`getBannerMessage`)                                             | exact (extend within same file)                    |
| `packages/client/src/components/ActionPanel.tsx`           | component     | request-response | `ActionPanel.tsx` lines 363-383 (HEADER phase push-button) + lines 800-833 (remaining counter) | exact (modify within same file)                    |
| `packages/client/src/components/PieceOverlay.tsx`          | component     | request-response | `PieceOverlay.tsx` lines 254-266 (SVG `<text>` element)                                        | self-analog                                        |
| `packages/client/src/styles/uniformStyles.tsx`             | utility       | transform        | `uniformStyles.tsx` lines 403-452 (quarterHorizontal / quarterDiagonal)                        | self-analog                                        |
| `packages/client/src/App.tsx`                              | component     | event-driven     | `App.tsx` lines 40-242 (socket event handlers, UniformSelectionScreen render)                  | self-analog (investigation-first)                  |
| `.planning/REQUIREMENTS.md`                                | documentation | —                | none (checkbox update only)                                                                    | N/A                                                |

---

## Pattern Assignments

### `packages/shared/src/types.ts` — add `ballAfter` to `GK_KICK` and `LOOSE_BALL_LAND`

**Analog:** `types.ts` lines 307-314 (`HEADED_PASS` union member — already has `ballAfter`)

**Existing shape to mirror** (lines 307-314):

```typescript
| {
    type: 'HEADED_PASS';
    passerId: string;
    from: HexCoord;
    to: HexCoord;
    timestamp: number;
    ballAfter: { position: HexCoord; carrierId: string | null };
  }
```

**Current `LOOSE_BALL_LAND` shape** (line 289 — missing `ballAfter`):

```typescript
| { type: 'LOOSE_BALL_LAND'; from: HexCoord; to: HexCoord; timestamp: number }
```

**Current `GK_KICK` shape** (lines 290-298 — missing `ballAfter`):

```typescript
| {
    type: 'GK_KICK';
    gkId: string;
    targetHex: HexCoord;
    accurate: boolean;
    kickDie: number;
    kickScore: number;
    timestamp: number;
  }
```

**Fix:** Append `ballAfter: { position: HexCoord; carrierId: string | null }` as the last field on both union members, matching the `HEADED_PASS` pattern exactly.

---

### `packages/server/src/gameEngine.ts` — REPLAY_ELIGIBLE_TYPES + LOOSE_BALL_LAND construction

**Analog:** `gameEngine.ts` lines 4348-4373 (the `REPLAY_ELIGIBLE_TYPES` set itself)

**Current REPLAY_ELIGIBLE_TYPES block** (lines 4348-4373):

```typescript
const REPLAY_ELIGIBLE_TYPES = new Set<string>([
  'MOVE',
  'DICE_ROLL',
  'STEAL_ATTEMPT',
  'TACKLE_ATTEMPT',
  'GOAL',
  'KICK_OFF',
  'HIGH_PASS',
  'LONG_BALL',
  'STANDARD_PASS',
  'FIRST_TIME_PASS',
  'SHOT_ATTEMPT',
  'SNAPSHOT',
  'HALF_TIME',
  'FULL_TIME',
  // REPLAY-06 (18.1-01, Pitfall 4): added by quick-task 260621-b8f with ballAfter populated,
  // but never folded into this set — their ball movement produced no visible replay frame.
  // GK_KICK is intentionally excluded (dead code, zero construction sites — Pitfall 5,
  // deferred to DESIGN-04). HEADER is intentionally excluded (carries no ballAfter by design).
  'HEADED_PASS',
  'GK_PUNT',
  // BUG-17 (Phase 18.3): kick-off formation repositioning.
  'KICK_OFF_SETUP',
]);
```

**Fix (D-10/D-11):** Add two entries with individual comments. Remove the existing incorrect comment block about GK_KICK being "dead code":

```typescript
  // REPLAY-07 (Phase 25): GK_KICK ball delivery — carries ballAfter (target hex + carrier or null).
  // Previously excluded due to incorrect "dead code" comment; construction site confirmed live
  // at gameHandlers.ts ~line 828.
  'GK_KICK',
  // REPLAY-08 (Phase 25): LOOSE_BALL_LAND scatter resolution — carries ballAfter (landing hex +
  // carrier or null). Construction site confirmed at gameEngine.ts ~line 2754.
  'LOOSE_BALL_LAND',
```

**LOOSE_BALL_LAND construction site pattern** (~line 2754 — confirmed):

```typescript
// Populate ballAfter at construction (finalCarrierId already resolved at this point):
const looseBallLandEvent: ActionEvent = {
  type: 'LOOSE_BALL_LAND',
  from: state.ball.position,
  to: finalPosition,
  timestamp: Date.now(),
  ballAfter: { position: finalPosition, carrierId: finalCarrierId }, // ADD THIS
};
```

---

### `packages/server/src/gameHandlers.ts` — GK_KICK construction site

**Analog:** `gameHandlers.ts` ~lines 804-862 (the `kickEvent` construction block itself)

**Critical pitfall (from RESEARCH.md):** `receiver` is currently defined INSIDE the `if (accurate)` branch. To use it in `ballAfter` on a shared `kickEvent` object, `receiver` must be resolved BEFORE `kickEvent` construction. Pattern: declare `receiver` conditionally before the object literal, then reference it inside.

**Fix approach:**

```typescript
// Resolve receiver BEFORE kickEvent construction (move out of if(accurate) block):
const receiver = accurate ? gkEndState.pieces.find(/* ...existing lookup... */) : null;

const kickEvent: ActionEvent = {
  type: 'GK_KICK',
  gkId: gkEndState.gkKickGkId ?? '',
  targetHex,
  accurate,
  kickDie,
  kickScore,
  timestamp: Date.now(),
  // ADD ballAfter (D-07 / D-09): resolved at construction, never null placeholder
  ballAfter: {
    position: targetHex,
    carrierId: accurate ? (receiver?.id ?? null) : null,
  },
};
```

---

### `packages/server/src/__tests__/replay.integration.test.ts` — GK_KICK and LOOSE_BALL_LAND regression tests

**Analog:** `replay.integration.test.ts` lines 628-719 — the `REPLAY-06: HEADED_PASS and GK_PUNT each produce a visible replay frame` test.

**Full pattern to mirror** (lines 628-719 — read above). Key structural elements:

1. Use `setupFullTimeRoom()` and `getRoom(roomCode)` to get a room with real pieces.
2. Directly mutate `room.gameState.eventLog` with a hand-crafted event (the type under test) followed by a `MOVE` event with distinct ball position for frame unambiguity.
3. Call `buildReplayFrames(room.gameState)`.
4. Assert the frame exists via `.find()` matching `carrierId` AND `position.q`.
5. Assert `frame.ball` equals the expected `ballAfter`.

**GK_KICK test shape:**

```typescript
it('REPLAY-07: GK_KICK produces a visible replay frame', async () => {
  const { roomCode } = await setupFullTimeRoom();
  const room = getRoom(roomCode)!;
  const pieces = room.gameState!.pieces;
  const gk = pieces.find((p) => p.role === 'GK')!;
  const receiver = pieces.find((p) => p.teamId === gk.teamId && p.id !== gk.id)!;
  const kickTarget = { q: gk.position.q + 3, r: gk.position.r };
  const laterMoveTo = { q: gk.position.q + 4, r: gk.position.r };

  room.gameState = {
    ...room.gameState!,
    eventLog: [
      {
        type: 'GK_KICK',
        gkId: gk.id,
        targetHex: kickTarget,
        accurate: true,
        kickDie: 5,
        kickScore: 8,
        timestamp: 1,
        ballAfter: { position: kickTarget, carrierId: receiver.id },
      },
      {
        type: 'MOVE',
        pieceId: receiver.id,
        from: kickTarget,
        to: laterMoveTo,
        slot: 'ATTACKER_4' as const,
        timestamp: 2,
        ballAfter: { position: laterMoveTo, carrierId: receiver.id },
      },
    ],
  };

  const frames = buildReplayFrames(room.gameState);
  const frame = frames.find(
    (f) => f.ball.carrierId === receiver.id && f.ball.position.q === kickTarget.q,
  );
  expect(frame).toBeDefined();
  expect(frame!.ball).toEqual({ position: kickTarget, carrierId: receiver.id });
});
```

**LOOSE_BALL_LAND test shape:** Mirror the GK_PUNT case (lines 684-718) substituting `type: 'LOOSE_BALL_LAND'`, `from`/`to` fields, and `carrierId: null` (loose ball scenario).

---

### `packages/client/src/components/HexGrid.tsx` — BUG-23 phase guard + shotTargetHighlight clear

**Analog:** `EventBanner.tsx` lines 73-81 (useEffect with `[active]` dep — same pattern for Fix 2).

**Fix 1 — outer phase guard** (current expression at ~line 422):

```typescript
// BEFORE (guards only the lastShotPathSet sub-clause):
const isShotPathTint =
  (phase !== 'KICK_OFF_SETUP' && lastShotPathSet.has(hexId)) ||
  isHpMoveTarget ||
  isGKDiveTarget ||
  isShotPath ||
  highPassContestZoneSet.has(hexId);

// AFTER (gates entire expression — BUG-23 belt-and-suspenders, D-14 Fix 1):
const isShotPathTint =
  phase !== 'KICK_OFF_SETUP' &&
  (lastShotPathSet.has(hexId) ||
    isHpMoveTarget ||
    isGKDiveTarget ||
    isShotPath ||
    highPassContestZoneSet.has(hexId));
```

**Fix 2 — clear shotTargetHighlight** (D-14 Fix 2). `shotTargetHighlight` declared at line 135:

```typescript
const [shotTargetHighlight, setShotTargetHighlight] = useState<HexCoord | null>(null);
```

Add a useEffect (must NOT be inline — see Pitfall 4 in RESEARCH.md):

```typescript
// Clear stale goal-target highlight on KICK_OFF_SETUP transition (BUG-23 / D-14 Fix 2).
// EventBanner.tsx lines 73-81 uses the identical useEffect-for-state-cleanup pattern.
useEffect(() => {
  if (phase === 'KICK_OFF_SETUP') {
    setShotTargetHighlight(null);
  }
}, [phase]);
```

---

### `packages/client/src/components/EventBanner.tsx` — HP_ACCURACY banner case

**Analog:** `EventBanner.tsx` lines 16-32 — `getBannerMessage` function (extend in-place).

**Current getBannerMessage** (lines 16-32):

```typescript
function getBannerMessage(
  event: ActionEvent,
): { message: string; variant: 'goal' | 'notable' } | null {
  if (event.type === 'GOAL') {
    return { message: 'GOOOOOAL!!!', variant: 'goal' };
  }
  if (event.type === 'STEAL_ATTEMPT' && event.result === 'SUCCESS') {
    return { message: 'INTERCEPTION!!', variant: 'notable' };
  }
  if (event.type === 'TACKLE_ATTEMPT' && event.result === 'SUCCESS') {
    return { message: 'Tackle! Turnover!', variant: 'notable' };
  }
  if (event.type === 'LOOSE_BALL_LAND') {
    return { message: 'Loose Ball.', variant: 'notable' };
  }
  return null;
}
```

**Add before the final `return null`** (D-20):

```typescript
// D-20 (Phase 25): pass accuracy result notification — replaces push-button confirmation.
// Exact wording from user specification: 'Accurate Pass!' or 'Loose Ball!'.
if (event.type === 'HP_ACCURACY') {
  return {
    message: event.accurate ? 'Accurate Pass!' : 'Loose Ball!',
    variant: 'notable',
  };
}
```

**Auto-dismiss timing note:** EventBanner's existing auto-dismiss fires at 1000ms (line 76: `setTimeout(..., 1000)`). D-20 requires 1500ms for HP_ACCURACY. Either extend the existing timer to 1500ms, or — if keeping the global timer at 1000ms — apply a variant-specific override. Confirm the approach by reading EventBanner.tsx lines 71-81 (already read above: single `setTimeout` fires at 1000ms regardless of variant). The simplest fix is to raise the global timeout to 1500ms, or add `variant: 'pass-result'` with a dedicated timer branch.

---

### `packages/client/src/components/ActionPanel.tsx` — pass result auto-advance + eligible counter

**Analog 1:** `ActionPanel.tsx` lines 363-383 — HEADER phase `headerAccuracyRollPending` push-button block (replace this).

**Current button block** (lines 367-383):

```typescript
if (headerAccuracyRollPending ?? false) {
  if (isActivePlayer && myTeam === attackingTeam) {
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Accurate High Pass!</span>
          <span className={styles.helperLine2}>Click to continue.</span>
        </div>
        <button className={styles.ctaButton} onClick={() => emitHeaderAccuracyAck()}>
          Continue
        </button>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }
  return waitingPanel;
}
```

**Replacement (D-20):** Remove the `<button>` and replace the active player branch with a `useEffect` auto-fire. The `waitingPanel` return for the non-active player is unchanged.

```typescript
// D-20 (Phase 25): auto-advance after 1500ms instead of button click.
// Popup fires via EventBanner (HP_ACCURACY added to getBannerMessage).
// Only the attacking player's client emits the ack (Pitfall 6 guard preserved).
useEffect(() => {
  if (
    phase === 'HEADER' &&
    (headerAccuracyRollPending ?? false) &&
    isActivePlayer &&
    myTeam === attackingTeam
  ) {
    const timerId = setTimeout(() => {
      emitHeaderAccuracyAck();
    }, 1500);
    return () => clearTimeout(timerId);
  }
}, [phase, headerAccuracyRollPending, isActivePlayer, myTeam, attackingTeam]);
```

**Analog 2:** `ActionPanel.tsx` lines 800-833 — `remaining` counter derivation.

**Current derivation** (lines 821-827):

```typescript
const currentSlotLockedCount = movedPieceIds.filter(
  (id) => paceUsedByPieceId[id] !== undefined,
).length;
const remaining =
  slotTotal != null
    ? Math.max(slotTotal - currentSlotLockedCount - paceExhaustedNotLocked, 0)
    : null;
```

**Fix (D-19):** Subtract 1 more when a piece is selected that has not yet moved. Add `selectedPieceId` from Zustand store. Guard against double-counting (piece must not already be in `movedPieceIds` or `paceExhaustedNotLocked`).

```typescript
// D-19 (Phase 25): decrement on piece selection (move start), not destination commit.
// selectedPieceId from Zustand store; must be an unmoved piece to avoid double-count.
const selectedPieceId = useGameStore((s) => s.selectedPieceId);
const selectedIsMoving =
  phase === 'MOVEMENT' &&
  selectedPieceId !== null &&
  !movedPieceIds.includes(selectedPieceId) &&
  (paceUsedByPieceId[selectedPieceId] ?? 0) === 0;

const remaining =
  slotTotal != null
    ? Math.max(
        slotTotal - currentSlotLockedCount - paceExhaustedNotLocked - (selectedIsMoving ? 1 : 0),
        0,
      )
    : null;
```

---

### `packages/client/src/components/PieceOverlay.tsx` — player number centering

**Analog:** `PieceOverlay.tsx` lines 254-266 (the `<text>` element itself — modify in-place).

**Current element** (lines 254-266):

```typescript
<text
  x={cx}
  y={cy}
  textAnchor="middle"
  dominantBaseline="central"
  fontSize={15}
  fontWeight={700}
  fill={numberColor}
  fontStyle={piece.role === 'GK' ? 'italic' : 'normal'}
  pointerEvents="none"
>
  {playerNumber}
</text>
```

**Fix (D-17):** Change `dominantBaseline="central"` to `dominantBaseline="middle"` (more reliable cross-browser SVG centering). If visual offset persists after this change, add `dy="-0.5"` as a secondary adjustment. Do not apply both simultaneously — test `"middle"` alone first.

---

### `packages/client/src/styles/uniformStyles.tsx` — style 12 / 13 pattern swap

**Analog:** `uniformStyles.tsx` lines 403-452 (`quarterHorizontal` and `quarterDiagonal` renderers — confirmed live).

**Current state (per RESEARCH.md verification):**

- `quarterHorizontal` (style 12): has `patternTransform={`rotate(45 ${cx} ${cy})`}` → renders ✕ (diagonal axes) — WRONG
- `quarterDiagonal` (style 13): no rotation, uses `x={cx - R} y={cy - R}` origin → renders ╬ (cross axes) — WRONG

**Expected per D-18:**

- Style 12 (`quarterHorizontal`) → ╬ (horizontal + vertical axes)
- Style 13 (`quarterDiagonal`) → ✕ (diagonal axes)

**Fix:** Swap the `patternTransform` attributes between the two renderers:

- `quarterHorizontal`: remove `patternTransform`, add `x={cx - R} y={cy - R}` alignment (copy from current `quarterDiagonal`) → renders ╬
- `quarterDiagonal`: add `patternTransform={`rotate(45 ${cx} ${cy})`}` and use `x={0} y={0}` alignment (copy from current `quarterHorizontal`) → renders ✕

**Both renderers must be updated in the same edit.** Fixing only one swaps which style is broken (Pitfall 3).

---

### `packages/client/src/App.tsx` — uniform clearing bug investigation + fix

**Analog:** `App.tsx` lines 40-242 (socket handler block and UniformSelectionScreen render — read during RESEARCH phase, confirmed live).

**Investigation-first (D-16, mandatory before fix):**

1. Locate the `UNIFORM_CONFIRM` socket event handler in `App.tsx`. Check whether it calls `setScreen('UNIFORM_SELECTION')` or re-triggers `onUniformSelectionStart` — either would re-mount `UniformSelectionScreen` if the screen was already `'UNIFORM_SELECTION'`.

2. Check whether `UniformSelectionScreen` has a `key` prop in `App.tsx` render that changes when opponent confirms (a key change forces full remount and resets all local state).

3. Read `UniformSelectionScreen.tsx` for any `useEffect` with `homePickedTeam`, `homeConfirmedStyle`, or similar opponent-state as a dependency that resets `selectedTeam`, `selectedStyle`, `selectedFormation`, or `jerseyType`.

**Fix constraint (D-16):** Preserve each player's pending selections (`selectedTeam`, `selectedStyle`, `selectedFormation`, `jerseyType`) across the opponent's confirmation event. The exact fix depends on investigation findings. Do not write any fix code until the root cause is confirmed.

---

### `.planning/REQUIREMENTS.md` — BUG-22 checkbox (documentation only)

**No analog required.** Change `[ ]` to `[x]` for the BUG-22 requirement entry and append a note:

```
> Fixed in Phase 18.2: `carrierExclusionKey: 'highPassCarrierId'` added at `gameHandlers.ts:405`.
> Covered by `gameHandlers.phase18-02.test.ts`. Requirement checkbox updated in Phase 25.
```

---

## Shared Patterns

### useEffect for State Side-Effects (React)

**Source:** `packages/client/src/components/EventBanner.tsx` lines 59-81
**Apply to:** HexGrid.tsx Fix 2 (shotTargetHighlight clear), ActionPanel.tsx D-20 auto-fire

The canonical pattern: state updates that depend on prop/store changes go in `useEffect`, never in the render body. The cleanup `return () => clearTimeout(timerId)` is mandatory for timer-based effects.

```typescript
// Pattern: state update in effect with cleanup
useEffect(() => {
  if (<condition>) {
    const timerId = setTimeout(() => {
      <action>();
    }, <ms>);
    return () => clearTimeout(timerId);
  }
}, [<deps>]);
```

### ballAfter Field on ActionEvent

**Source:** `packages/shared/src/types.ts` lines 307-314 (`HEADED_PASS`)
**Apply to:** `GK_KICK` (types.ts + gameHandlers.ts), `LOOSE_BALL_LAND` (types.ts + gameEngine.ts)

Shape is always `{ position: HexCoord; carrierId: string | null }`. `carrierId` is `null` for loose balls. Field is always populated at construction time — never left as a null placeholder (D-09).

### REPLAY_ELIGIBLE_TYPES Extension

**Source:** `packages/server/src/gameEngine.ts` lines 4348-4373
**Apply to:** REPLAY-07, REPLAY-08

Each new entry must have its own inline comment explaining WHY it is included. Never bundle two types under a single comment (D-10 explicit rule — Phase 18.1 "dead code" mistake was caused by bundling).

### Replay Integration Test Structure

**Source:** `packages/server/src/__tests__/replay.integration.test.ts` lines 628-719
**Apply to:** REPLAY-07 (GK_KICK) and REPLAY-08 (LOOSE_BALL_LAND) test cases

Structure: `setupFullTimeRoom()` → mutate `room.gameState.eventLog` directly → call `buildReplayFrames()` → assert frame existence with `.find()` → assert `frame.ball` shape.

---

## No Analog Found

All modified files have direct analogs in the codebase. No file in Phase 25 introduces a genuinely new pattern.

---

## Metadata

**Analog search scope:** `packages/shared/src/`, `packages/server/src/`, `packages/client/src/`
**Files scanned (via RESEARCH.md verified reads):** 10 source files with confirmed line ranges
**Pattern extraction date:** 2026-07-10
