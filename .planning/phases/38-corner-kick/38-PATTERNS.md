# Phase 38: Corner Kick - Pattern Map

**Mapped:** 2026-08-07
**Files analyzed:** 8 (new/modified)
**Analogs found:** 8 / 8

This phase is pure internal FSM extension of the just-shipped Goal Kick flow (Phase 37). Every new file below has a direct, load-bearing analog already in the codebase — there is no greenfield UI/architecture work, only "copy this shape, resize/rename it."

## File Classification

| New/Modified File                                                                                                                                                          | Role                               | Data Flow              | Closest Analog                                                                                                                                                        | Match Quality |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `packages/shared/src/outOfBounds.ts` (add `CORNER_KICK_HEX`)                                                                                                               | model/config (pure data)           | CRUD (constant lookup) | Same file's `GOAL_KICK_RESTART_HEX` (lines 46-49)                                                                                                                     | exact         |
| `packages/shared/src/offside.ts` (add `CORNER_KICK_STAGES` + `cornerKickStageTeam`)                                                                                        | utility (pure fn)                  | transform              | Same file's `FREE_KICK_STAGES`/`freeKickStageTeam`                                                                                                                    | exact         |
| `packages/shared/src/types.ts` (new `GamePhase` values, `GameState` fields, `LastActionType` row, `ActionEvent` variant)                                                   | model                              | CRUD                   | Existing `GOAL_KICK_*` phase/field block (lines 130-131, 460-467, 521-525, 1137-1168)                                                                                 | exact         |
| `packages/shared/src/actionSequence.ts` (`ELIGIBLE_NEXT_ACTIONS` row)                                                                                                      | config                             | transform              | Existing `THROW_IN_MOVEMENT_1`/`_2` rows                                                                                                                              | exact         |
| `packages/server/src/gameEngine.ts` (`triggerOutOfBoundsRestart` CORNER_KICK branch + 5 new `apply*` functions + `applyRoll` PASS-case extension)                          | service/controller (state machine) | event-driven           | Adjacent `GOAL_KICK` branch (lines 3271-3339 area), `applyThrowInPlace` (3370-3428), `applyGoalKickReposition` (3486+), `GOAL_KICK_MOVE` slot-alternation (3873-3981) | exact         |
| `packages/server/src/gameHandlers.ts` (new socket handlers, `isCornerKickContext` helper, `GAME_ROLL` range override, `validUndoPhases`/`BALL_MARKER_PHASES` registration) | controller/middleware              | request-response       | `isThrowInContext` (lines 95-108), `GAME_ROLL` handler's throw-in range override (1609-1620), `validUndoPhases` (1356-1373)                                           | exact         |
| `packages/client/src/components/CornerKickSetupPanel.tsx`                                                                                                                  | component                          | request-response       | `packages/client/src/components/GoalKickSetupPanel.tsx` (entire file, 243 lines)                                                                                      | exact         |
| `packages/client/src/components/GameBoard.tsx` (phase dispatch + `PHASE_LABEL`)                                                                                            | component                          | request-response       | Existing `GOAL_KICK_*` five-way ternary/dispatch block (lines 328-360, `PHASE_LABEL` 24-64)                                                                           | exact         |
| `packages/client/src/components/BallLocationRing.tsx` (`BALL_MARKER_PHASES` extension)                                                                                     | component                          | transform              | Existing Goal Kick block (lines 43-51)                                                                                                                                | exact         |

## Pattern Assignments

### `packages/shared/src/outOfBounds.ts` — add `CORNER_KICK_HEX` (model, CRUD)

**Analog:** same file, `GOAL_KICK_RESTART_HEX` (lines 46-49) and its doc comment (27-45)

```typescript
// packages/shared/src/outOfBounds.ts:46-49
export const GOAL_KICK_RESTART_HEX: Readonly<Record<'home' | 'away', HexCoord>> = {
  home: { q: 2, r: 13 },
  away: { q: 34, r: 13 },
};
```

Copy this exact `Readonly<Record<...>>` shape, extended one level for top/bottom:

```typescript
export const CORNER_KICK_HEX: Readonly<
  Record<'home' | 'away', Record<'top' | 'bottom', HexCoord>>
> = {
  home: { top: { q: 0, r: 1 }, bottom: { q: 0, r: 25 } },
  away: { top: { q: 36, r: 1 }, bottom: { q: 36, r: 25 } },
};
```

Mirror-symmetry convention to preserve: `home.q + away.q === 36` (asserted in `outOfBounds.test.ts` against derived geometry, not restated literals — do the same for the new constant). Do **not** import or alias `DIFFICULT_ANGLE_HEXES` (`pitch.ts:103`) even though endpoint coordinates coincide — keep the two constants structurally separate per CONTEXT.md D-01.

**Occupied-hex resolution pattern** — reuse `resolveThrowInHex` verbatim (lines 142-170), same as Goal Kick does with `GOAL_KICK_RESTART_HEX` at trigger time (`gameEngine.ts:3292`, `preferredRestartHex = GOAL_KICK_RESTART_HEX[goalKickTeam]`, then resolved through occupancy).

**Do not touch** `classifyOutOfBounds` (lines 118-128) — its `'CORNER_KICK'` branch is already correct and explicitly documented (lines 108-116) as off-limits to this phase.

---

### `packages/shared/src/offside.ts` — add `CORNER_KICK_STAGES` (utility, transform)

**Analog:** same file, `FREE_KICK_STAGES` (referenced at `types.ts:1079`, defined `offside.ts:38-43` per RESEARCH.md)

```typescript
export const CORNER_KICK_STAGES: readonly { side: 'attacking' | 'defending'; max: 2 }[] = [
  { side: 'attacking', max: 2 },
  { side: 'defending', max: 2 },
  { side: 'attacking', max: 2 },
  { side: 'defending', max: 2 },
  { side: 'attacking', max: 2 },
  { side: 'defending', max: 2 },
];

export function cornerKickStageTeam(
  stageIndex: 0 | 1 | 2 | 3 | 4 | 5,
  cornerKickTeam: 'home' | 'away',
): 'home' | 'away' {
  const stage = CORNER_KICK_STAGES[stageIndex];
  if (stage.side === 'attacking') return cornerKickTeam;
  return cornerKickTeam === 'home' ? 'away' : 'home';
}
```

**Important divergence from `FREE_KICK_STAGES`'s companion logic:** `applyFreeKickReady` permanently locks a piece into `movedPieceIds` once used in a stage. Corner's per-piece 6-hex budget (`cornerKickUsedPace`) must persist and stay spendable across multiple rounds — only the per-stage distinct-piece counter (`cornerKickStagePlacedIds`) resets each stage. Do not port the permanent-lock behavior.

---

### `packages/shared/src/types.ts` — new `GamePhase`/`GameState`/`LastActionType`/`ActionEvent` (model, CRUD)

**Analog:** existing `GOAL_KICK_*` block

```typescript
// types.ts:130-131 (GamePhase union comments)
| 'GOAL_KICK_CHOICE' // GK chose kick vs. standard pass restart
| 'GOAL_KICK_MOVE' // 1-player-per-team repositioning while the goal kick travels
```

```typescript
// types.ts:521-525 (GamePhase union)
| 'GOAL_KICK_SETUP_GK'
| 'GOAL_KICK_SETUP_OPPONENT'   // (name elided in excerpt, confirmed present)
| 'GOAL_KICK_CHOICE'
| 'GOAL_KICK_TARGET'
| 'GOAL_KICK_MOVE'
```

New phase values to add, D-08 naming discretion (recommended, matching RESEARCH.md's proposal): `CORNER_KICK_GK_SETUP_ATTACKING`, `CORNER_KICK_GK_SETUP_DEFENDING`, `CORNER_KICK_TAKER_SELECT`, `CORNER_KICK_REPOSITION`, `CORNER_KICK_FINAL_SETUP`.

```typescript
// types.ts:1137, 1143-1168 (GameState fields — direct template)
goalKickTeam?: 'home' | 'away' | null;
// ... goalKickEligibleIds, goalKickUsedPace (per-piece pace-budget shape)
// ... goalKickMoveSlot / goalKickMovedPieceId / goalKickPaceUsed (slot-alternation shape)
```

New `GameState` fields to add (mirrors above 1:1):

```typescript
cornerKickTeam?: 'home' | 'away' | null;               // persistent, mirrors throwInTeam/goalKickTeam
cornerKickHex?: HexCoord | null;                         // resolved once at trigger time, mirrors preferredRestartHex usage
cornerKickTakerId?: string | null;
cornerKickStageIndex?: 0 | 1 | 2 | 3 | 4 | 5 | null;      // mirrors freeKickStageIndex
cornerKickStagePlacedIds?: readonly string[] | null;       // mirrors freeKickPlacedPieceIds — resets each stage
cornerKickUsedPace?: Readonly<Record<string, number>> | null; // mirrors goalKickUsedPace — persists across all 6 stages, cap 6
cornerKickMoveSlot?: 'ATTACKER' | 'DEFENDER' | null;       // mirrors goalKickMoveSlot
cornerKickMovedPieceId?: string | null;                    // mirrors goalKickMovedPieceId
cornerKickPaceUsed?: number;                                // mirrors goalKickPaceUsed, cap 3
```

New `LastActionType` row: `'CORNER_KICK_RESTART'` (mirrors `'GOAL_KICK_RESTART'`/`'FREE_KICK_RESTART'`).

**New `ActionEvent` variant** — mirror `GOAL_KICK` event shape at `types.ts:460-467`:

```typescript
// types.ts:460-467 (GOAL_KICK_CHOICE/GOAL_KICK_MOVE ActionEvent shapes — direct template)
type: 'GOAL_KICK_CHOICE';
...
type: 'GOAL_KICK_MOVE';
```

Add a dedicated `CORNER_KICK` (or `CORNER_KICK_ACCURACY`) event type — never reuse the generic `DICE_ROLL` type (STATE.md pitfall, already flagged twice for Goal Kick/Throw-In).

---

### `packages/shared/src/actionSequence.ts` — `ELIGIBLE_NEXT_ACTIONS` row (config, transform)

**Analog:** existing `THROW_IN_MOVEMENT_1`/`_2` rows (`actionSequence.ts:103-110`), which route to plain `'STANDARD_PASS'`/`'HIGH_PASS'` — the exact precedent to follow (do not invent `CORNER_KICK_HIGH`/`CORNER_KICK_LOW` labels).

```typescript
CORNER_KICK_RESTART: new Set<NextActionType>(['STANDARD_PASS', 'HIGH_PASS']),
```

TypeScript's `Record<LastActionType, ...>` exhaustiveness (`actionSequence.ts:49`) will force this row to exist once the `LastActionType` union gains `'CORNER_KICK_RESTART'`.

---

### `packages/server/src/gameEngine.ts` — engine work (service/controller, event-driven)

**Analog 1 — the hook point itself:**

```typescript
// gameEngine.ts:3203-3218 (triggerOutOfBoundsRestart, current dead-end)
export function triggerOutOfBoundsRestart(
  state: GameState,
  exitHex: HexCoord,
  lastInBoundsHex: HexCoord,
): GameState | null {
  const exit = classifyExit(exitHex);
  if (exit === null) return null;

  const owner = bylineOwner(exitHex);
  const restart = classifyOutOfBounds(exit, state.ball.lastTouchedBy?.teamId ?? null, owner);

  // CORNER_KICK branch (packages/shared/src/outOfBounds.ts) must not be edited to...
  if (restart === 'CORNER_KICK') return null;   // <-- replace this line
```

**Critical team-inversion detail (do not copy-paste `GOAL_KICK`'s branch verbatim without this fix):** for `GOAL_KICK`, `owner` (byline's own team) IS the awarded team. For `CORNER_KICK`, `owner` is the team whose defender touched last — the corner is awarded to the OPPOSITE team: `const awardedTeam = owner === 'home' ? 'away' : 'home';`. Also resolve top/bottom via `hexDistance` comparison of `lastInBoundsHex` against `CORNER_KICK_HEX[owner].top`/`.bottom` (nearest wins, tie defaults to `'top'`).

**Analog 2 — one-shot piece placement (`CORNER_KICK_TAKER_SELECT`):**

```typescript
// gameEngine.ts:3370-3428, applyThrowInPlace — copy this shape exactly:
// phase guard -> piece lookup -> team-ownership check -> unconditional teleport
// to the server-resolved fixed hex (resolveThrowInHex against current piece list)
export function applyThrowInPlace(state: GameState, pieceId: string): ApplyThrowInPlaceResult {
  // ...
}
```

**Analog 3 — per-piece pace-budget reposition window (`CORNER_KICK_REPOSITION`):**

`applyGoalKickReposition` (lines 3486+) — copy its body (adjacency check via `hexDistance === 1`, `isPitchHex`/occupancy guards, cumulative-pace-vs-cap check), **not** call it (mirrors that function's own doc comment about not calling `applyFreeMove`). Add one new guard on top: distinct-piece-count-per-stage (`cornerKickStagePlacedIds.length >= 2` for a not-yet-counted piece → reject), mirroring `applyFreeKickMove`'s `PLACEMENT_LIMIT_REACHED` check.

**Analog 4 — slot-alternation pre-kick window (`CORNER_KICK_FINAL_SETUP`):**

```typescript
// gameEngine.ts:3873, 3935-3941, 3981 — GOAL_KICK_MOVE slot-alternation
goalKickMoveSlot: 'KICKER',
...
if (state.goalKickMoveSlot === 'KICKER') {
  ...
  goalKickMoveSlot: 'OPP',
...
goalKickMoveSlot: null,
```

Direct field-shape copy: `cornerKickMoveSlot: 'ATTACKER' | 'DEFENDER' | null`, capped at 3 hexes instead of 6.

**Analog 5 — accuracy-gate extension in `applyRoll`'s PASS case:**

Extend (not duplicate) the existing `requiresAccuracyCheck` boolean:

```typescript
const requiresAccuracyCheck =
  state.lastActionType === 'HIGH_PASS' ||
  state.lastActionType === 'LONG_BALL' ||
  (state.cornerKickTeam != null && state.lastActionType === 'STANDARD_PASS'); // NEW
```

High corners need zero further change (existing `HIGH_PASS`→`HEADER` transition already fires unconditionally on accurate delivery — CORNER-05 falls out free). Low corners need `validatePassAccuracy(carrier, 'HIGH', d1, [])` applied (threshold 8, same as `HIGH`) before falling through to the existing `STANDARD_PASS` delivery path on accurate, or `LOOSE_BALL` on inaccurate (already works unmodified).

Clear `cornerKickTeam`/`cornerKickHex`/etc. on whichever branch resolves the ball, mirroring how `goalKickTeam`/`goalKickGkId` are cleared in `applyGoalKickChoice`'s `'standard'` branch.

---

### `packages/server/src/gameHandlers.ts` — socket handlers + range override (controller/middleware, request-response)

**Analog — throw-in's context helper and conditional range override:**

```typescript
// gameHandlers.ts:95-108
const DICE_PHASES = new Set<string>(['KICK_OFF', 'PASS', 'HEADER', 'LOOSE_BALL']);

/** THROWIN-04: a throw-in travels at most 6 hexes, regardless of Low/High type. */
const THROW_IN_MAX_DISTANCE = 6;

const isThrowInContext = (lastActionType: LastActionType | null): boolean =>
  lastActionType === 'THROW_IN_MOVEMENT_1' || lastActionType === 'THROW_IN_MOVEMENT_2';
```

```typescript
// gameHandlers.ts:1609-1620-area — GAME_ROLL handler's throw-in range override
isThrowInContext(room.gameState.lastActionType)
  ? { maxDistance: THROW_IN_MAX_DISTANCE }
  // ...
```

Add a parallel `isCornerKickContext(lastActionType)` helper (`lastActionType === 'CORNER_KICK_RESTART'`) and, in the same conditional-override site, when `passType === 'HIGH_PASS'` AND target hex is inside the byline-owner's OWN penalty area (`isInRegion`, `pitch.ts` regions — **not** the kicking team's area, Pitfall 5 in RESEARCH.md), pass an unlimited/sentinel `maxDistance` override; otherwise the existing default 15-hex HIGH cap applies unchanged. No `validatePass` signature change needed — reuses the exact `options.maxDistance` mechanism already proven by `THROW_IN_MAX_DISTANCE`.

**Registration checklist (Pitfall 1, STATE.md-documented bug class)** — every new `GamePhase` must be added to:

- `validUndoPhases: GamePhase[]` (`gameHandlers.ts:1356-1373`) — add Corner's reversible-move phases (mirrors `GOAL_KICK_SETUP_GK`/`_OPPONENT`/`GOAL_KICK_MOVE` already listed there).
- `DICE_PHASES` (line 95) — verify whether Corner's new phases need inclusion (RESEARCH.md concludes likely not; only the final `PASS` phase is a dice-roll phase).

---

### `packages/client/src/components/CornerKickSetupPanel.tsx` — new component (component, request-response)

**Analog:** `packages/client/src/components/GoalKickSetupPanel.tsx` (full file, 243 lines) — copy the entire structural shape:

- Imports block (lines 1-6): `useState`, `useGameStore`, `useMyTeam`, `ctaColorClass`, `restartErrorMessage`, own CSS module.
- Phase-membership guard (lines 38-54): `isCornerKickPhase` boolean OR-chain across all 5 new phases, early-return `null` when not in a corner-kick phase, when `cornerKickTeam` is null/undefined, or when `useMyTeam()` returns null.
- `withEndTurnGuard`/`pendingEndTurn`/`confirmDialog` pattern (lines 21-24, 64-98) — reused **verbatim** for D-06's "Confirm with 0 moved" behavior (CONTEXT.md D-06 explicitly directs following this Goal Kick pattern, not Free Kick's).
- Per-phase branch shape: acting-team check → "{Team} is repositioning…" waiting panel when not my turn (lines 106-116, 189-196, 210-219) vs. active panel with `panelHeading`, `constraintRow`(s), CTA button(s), `humanisedError` (lines 131-147).
- CTA verb lock: `"Confirm"` (never "Submit"/"Done"/etc.) — Phase 35 D-09 convention, reused per CONTEXT.md D-09.
- `ctaColorClass(remaining, {ready, pending}, true)` pattern for button color state (lines 125-129, 222-226).

Panel phrasing to reuse verbatim (D-09): `"{Attacking|Defending} team is repositioning…"`.

---

### `packages/client/src/components/GameBoard.tsx` — phase dispatch (component, request-response)

**Analog:** existing `GOAL_KICK_*` five-way ternary/dispatch and `PHASE_LABEL` map (lines 24-64, 328-360 per RESEARCH.md citations — **not compiler-enforced**, must be manually extended). Add a Corner Kick N-way check (5 phases) alongside the existing Throw-In/Goal-Kick checks, dispatching to `<CornerKickSetupPanel />`.

---

### `packages/client/src/components/BallLocationRing.tsx` — `BALL_MARKER_PHASES` (component, transform)

**Analog:** the just-shipped Goal Kick block (lines 43-51 per RESEARCH.md) — the ball is fixed at a restart hex or mid-repositioning during every one of Goal Kick's phases; add the same for all 5 new Corner Kick phases.

---

## Shared Patterns

### Pure-function-delegate + isProcessing mutex + phase-guard (server handler shape)

**Source:** every existing socket handler in `gameHandlers.ts` (e.g. throw-in/goal-kick handlers)
**Apply to:** all new Corner Kick socket handlers
Pattern: mutex lock → phase-value guard → delegate entirely to a pure `apply*` function in `gameEngine.ts` → broadcast result → unlock. Do not inline state mutation in the handler itself.

### Turn-order UI phrasing and CTA lock

**Source:** `GoalKickSetupPanel.tsx` (Phase 35 D-09 conventions, carried forward)
**Apply to:** `CornerKickSetupPanel.tsx` for all 5 new phases
`"Confirm"` button verb, no container border on `.panel`, two-line title+detail helper text, `"{Team} is repositioning…"` waiting phrasing.

### Occupied-hex relocation

**Source:** `resolveThrowInHex` (`packages/shared/src/outOfBounds.ts:142-170`)
**Apply to:** `CORNER_KICK_HEX` resolution at trigger time, and `CORNER_KICK_TAKER_SELECT` placement
Reuse verbatim — no new occupancy-resolution logic needed.

### `GamePhase` registration checklist (Pitfall 1)

**Source:** STATE.md's documented recurring bug class, now with a concrete Goal Kick-derived checklist (RESEARCH.md §Common Pitfalls #1)
**Apply to:** every new Corner Kick `GamePhase` value
Must register in: `GamePhase` union (`types.ts`), `PHASE_LABEL` (`GameBoard.tsx`), phase-dispatch ternary (`GameBoard.tsx`, not compiler-enforced), `validUndoPhases` (`gameHandlers.ts`), `BALL_MARKER_PHASES` (`BallLocationRing.tsx`), `ELIGIBLE_NEXT_ACTIONS` (`actionSequence.ts`, compiler-enforced once `LastActionType` gains the value).

### Persistent context field survives intermediate phase transitions (Pitfall 3)

**Source:** `throwInTeam`/`highPassCarrierId`/`goalKickTeam` precedent
**Apply to:** `cornerKickTeam` — must be explicitly carried in every state-literal return between `CORNER_KICK_FINAL_SETUP`'s end and the eventual `PASS`-phase accuracy resolution, since it (not `lastActionType`) is the signal gating the Low-option accuracy gate.

## No Analog Found

None — every file in this phase's scope has a direct, load-bearing analog in the already-shipped Goal Kick (Phase 37) or Throw-In/Free-Kick (earlier phases) code.

## Metadata

**Analog search scope:** `packages/shared/src`, `packages/server/src`, `packages/client/src/components`
**Files scanned:** `outOfBounds.ts`, `offside.ts`, `types.ts`, `actionSequence.ts`, `gameEngine.ts`, `gameHandlers.ts`, `GoalKickSetupPanel.tsx`, `GameBoard.tsx`, `BallLocationRing.tsx`
**Pattern extraction date:** 2026-08-07
