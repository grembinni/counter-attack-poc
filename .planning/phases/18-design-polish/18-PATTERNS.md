# Phase 18: Design Polish - Pattern Map

**Mapped:** 2026-06-20
**Files analyzed:** ~16 (touched repeatedly across DESIGN-01/02/03/04, BUG-06..11, UX-07..14)
**Analogs found:** 16 / 16 (this phase modifies existing files almost exclusively — no new files except possibly `EventBanner.tsx`+`.module.css` for UX-14)

## File Classification

| New/Modified File                                                                                                          | Role               | Data Flow                                                    | Closest Analog                                                                                                                                                                     | Match Quality                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/client/src/components/GameBoard.tsx` (PHASE_LABEL map, StatRow, dice-log)                                        | component          | request-response (renders derived state)                     | itself (existing `PHASE_LABEL`/`statBubbleClass` pattern)                                                                                                                          | exact — extend in place                                       |
| `packages/client/src/components/ActionLog.tsx` (case blocks, UX-14 hook point)                                             | component          | event-driven (renders `ActionEvent` stream)                  | itself                                                                                                                                                                             | exact — extend in place                                       |
| `packages/client/src/components/ActionPanel.tsx` (UX-08 confirm dialog + button color, UX-13 tooltips)                     | component          | request-response (emits player actions)                      | itself; confirm-dialog precedent: none exists yet, closest analog is the `HALF_TIME`/`FULL_TIME` `.overlay`/`.overlayCard` modal pattern in `GameBoard.tsx`/`GameBoard.module.css` | role-match (confirm modal needs new but small overlay markup) |
| `packages/client/src/store/useGameStore.ts` (`slotChanged` / BUG-09)                                                       | store              | event-driven (socket state sync)                             | itself (`setGameState` reducer-like function)                                                                                                                                      | exact — extend existing staleness check                       |
| `packages/client/src/components/HexGrid.tsx` (BUG-08 `zoiRiskSet`/tackle tint, UX-09 marker layer hookup)                  | component          | request-response (SVG render of board state)                 | itself                                                                                                                                                                             | exact                                                         |
| `packages/client/src/components/PitchMarkings.tsx` (UX-09 final-third line)                                                | component          | request-response (cosmetic SVG layer)                        | itself (existing `<line>` halfway-line pattern)                                                                                                                                    | exact                                                         |
| `packages/client/src/components/PieceOverlay.tsx` (BUG-09 highlight clear, BUG-10 click-to-card)                           | component          | request-response                                             | itself (`isOffside` ring / "moved-this-stage" ring precedent)                                                                                                                      | exact                                                         |
| `packages/client/src/components/TeamSelectionScreen.tsx` (UX-07 speed selector)                                            | component          | request-response (lobby/setup form)                          | itself (existing 2×2 team-card `.grid`)                                                                                                                                            | role-match — new form control, same screen                    |
| `packages/client/src/components/PlayerStatsPanel.tsx` (UX-12 tooltip)                                                      | component          | request-response                                             | `GameBoard.tsx` `StatRow` (shares same stat-label rendering concept)                                                                                                               | exact                                                         |
| `packages/client/src/components/EventBanner.tsx` (NEW, UX-14)                                                              | component          | event-driven (subscribes to `eventLog`/`ActionEvent` stream) | `DisconnectBanner.tsx` (only existing transient-overlay-style component)                                                                                                           | role-match (closest existing "banner" shape)                  |
| `packages/client/src/components/EventBanner.module.css` (NEW, UX-14)                                                       | config/style       | n/a                                                          | `DisconnectBanner.module.css` / `.overlay`/`.overlayCard` rules in `GameBoard.module.css`                                                                                          | role-match                                                    |
| `packages/server/src/gameHandlers.ts` (BUG-06 offside reset gap, BUG-11 HP carrier exclusion, BUG-07 header→pass delivery) | controller/handler | event-driven (socket event handlers)                         | itself (`GAME_MOVE` FTP handler block, lines ~495-530 and ~750-790, is the literal template for BUG-11)                                                                            | exact                                                         |
| `packages/server/src/gameEngine.ts` (BUG-07 header pass delivery, dice-roll log format D-03)                               | service            | event-driven (pure state-transition functions)               | itself (`applyPass` `lastActionType === 'HEADER'` suppression, BUG-01 precedent)                                                                                                   | exact                                                         |
| `packages/shared/src/moveValidator.ts` (BUG-08 re-verification)                                                            | utility            | transform (pure validation function)                         | itself (existing `stealAttemptedByIds`/`tackleAttemptedByIds` exclusion blocks, lines ~92-124)                                                                                     | exact                                                         |
| `packages/shared/src/offside.ts` (BUG-06)                                                                                  | utility            | transform                                                    | itself (`triggerOffsideFoul` reset logic)                                                                                                                                          | exact                                                         |
| `packages/shared/src/types.ts` (GameState additions: `gameSpeed`/UX-07 field)                                              | model              | n/a (type definitions)                                       | itself (`selectedTeams` field precedent)                                                                                                                                           | exact                                                         |
| `packages/server/src/roomStore.ts` (DESIGN-02 audit)                                                                       | service            | event-driven (`startReplayStream`, `broadcastState`)         | itself                                                                                                                                                                             | exact — audit in place, no new file                           |
| `packages/client/src/components/ReplayPanel.tsx` (DESIGN-02 audit)                                                         | component          | event-driven (consumes replay stream)                        | itself                                                                                                                                                                             | exact                                                         |

## Pattern Assignments

### `GameBoard.tsx` — `PHASE_LABEL` map (DESIGN-01 D-01/D-02)

**Analog:** itself, `packages/client/src/components/GameBoard.tsx:16-43`

**Current pattern to extend (verbatim, lines 16-43):**

```typescript
/** Phase label mapping per UI-SPEC Turn Indicator Spec table. Absorbed from TurnIndicator.tsx. */
const PHASE_LABEL: Record<GamePhase, string> = {
  LOBBY: '',
  KICK_OFF: 'KICK OFF',
  KICK_OFF_SETUP: 'KICK OFF SETUP',
  MOVE: 'MOVEMENT PHASE',
  PASS: 'CHOOSING ACTION',
  SNAPSHOT_TARGET: 'SHOT DECLARED',
  GK_DIVE: 'GK DIVING',
  // ...
};
```

**Confirmed stale-label bugs to fix as part of D-01 sweep:**

- `GK_DIVE: 'GK DIVING'` → must become `'GK DIVE'` (D-11 Phase 17.1 renamed the enum but not this label)
- `PASS: 'CHOOSING ACTION'` → must become `'{TEAM} CHOOSE ACTION'` (note: convention requires team-prefixed text now, not a bare phase label — this changes the call site, not just the map value, since `PHASE_LABEL[phase]` is currently rendered standalone at line ~137: `const phaseLabel = PHASE_LABEL[phase];`. The DESIGN-01 convention table embeds `{UPPER team name}` in the string, so either (a) change `PHASE_LABEL` values to be a function `(team: string) => string` instead of a flat string, or (b) keep `PHASE_LABEL` as a per-phase suffix and prepend team name at the render call site. Recommend (b) — keep the map shape simple per D-02 ("implement as data... do not introduce a templating engine"), and continue string-concatenating team name at the JSX call site the way other team-prefixed text in this file already works.

**D-02 constraint:** keep this as a flat `Record<GamePhase, string>` lookup — no templating engine, no function values. Extend the existing shape only.

**Numbered-suffix precedent (MOVE 4/5/2):** no existing precedent for numeric suffixes in `PHASE_LABEL` itself — these are slot-dependent, so the suffix must be computed at the render call site by reading `gameState.movementSlot` (`ATTACKER_4`/`DEFENDER_5`/`ATTACKER_2`) and appending the trailing digit, the same way `SLOT_PREFIX`-style helpers are referenced elsewhere in CONTEXT.md (no `SLOT_PREFIX` const currently exists in `GameBoard.tsx` — search turned up none; this is a new small helper to add, same file, same `Record`-lookup style).

---

### `GameBoard.tsx` — `statBubbleClass()` / `StatRow` (UX-12 + UX-08 color-state template)

**Analog:** `packages/client/src/components/GameBoard.tsx:45-60`

```typescript
/** Returns the appropriate statBubble color class based on the stat value. */
function statBubbleClass(value: number): string {
  if (value >= 5) return styles.statBubbleGreen ?? '';
  if (value >= 3) return styles.statBubbleYellow ?? '';
  return styles.statBubbleRed ?? '';
}

/** Renders a single stat row: label + colored bubble. */
function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statBubble} ${statBubbleClass(value)}`}>{value}</span>
    </div>
  );
}
```

**UX-12 application:** add a `STAT_FULL_NAME: Record<string, string>` lookup (same `Record` shape as `PHASE_LABEL`) and apply `title={STAT_FULL_NAME[label]}` on the existing `.statLabel` span inside `StatRow` — minimal, no new component.

**UX-08 application (per UI-SPEC):** the same `statBubbleClass()`-style selector-function pattern (numeric/boolean condition → classname) is the explicit precedent the UI-SPEC calls out for the End Turn button's orange/green state — write an analogous `ctaButtonClass(eligibleRemaining: number): string` returning `styles.ctaButtonPending` or `styles.ctaButtonReady`, applied in `ActionPanel.tsx`.

---

### `ActionPanel.tsx` — End Turn buttons (UX-08, UX-13)

**Analog:** `packages/client/src/components/ActionPanel.tsx` (multiple call sites, e.g. lines 146-150, 174-178, 405-406, 432-433, 619-620)

**Current pattern (repeated ~8x in this file, e.g. lines 149-150):**

```typescript
<button className={styles.ctaButton} onClick={emitEndTurn}>
  End Turn
</button>
```

**UX-08 fix shape:** each of these ~8 call sites needs (a) a pre-click eligibility check (`eligibleRemaining > 0` → show confirm dialog before calling `emitEndTurn`), and (b) the `ctaButtonClass()` modifier from above swapped in for `styles.ctaButton`. No existing confirm-dialog component exists in this codebase — closest precedent is the `HALF_TIME`/`FULL_TIME` full-screen `.overlay`/`.overlayCard` modal already used in `GameBoard.tsx` (and `.module.css`); reuse that visual shape (smaller) for the Cancel/Confirm modal rather than inventing a new modal pattern.

**UX-13 tooltip pattern (native `title`, confirmed precedent):**

```typescript
// KickOffSetupPanel.tsx:115, FreeKickSetupPanel.tsx:137, GameBoard.tsx:234,333
<button title="...">...</button>
```

Apply `title={actionSummary}` directly on each `<button className={styles.ctaButton}>` — zero new markup, matches UI-SPEC's Interaction Contract decision exactly.

---

### `gameHandlers.ts` — FIRST_TIME_PASS carrier-exclusion (BUG-11 template, 3 touch points)

**Analog:** `packages/server/src/gameHandlers.ts` (exact lines below) — this is the literal copy-paste template named in CONTEXT.md D-07/BUG-11.

**Touch point 1 — reject move of the carrier (lines 505-514):**

```typescript
// Cycle-4 self-pass-reclaim finding (D-03, Phase 17.1-16): the original passer may
// not reposition their own piece during FTP repositioning — doing so would let them
// move onto the (empty) passTargetHex and have the delivery lookup hand the ball
// straight back to them. Mirrors how highPassCarrierId identifies the kicker; this is
// the authoritative server-side guard (the client selectPiece mirror is defense-in-depth).
if (pieceId === ftpState.firstTimePassCarrierId) {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PIECE');
  broadcastState(io, room);
  return;
}
```

**BUG-11 mirror:** add an identical block gated on `gameState.phase === 'HIGH_PASS_MOVE'` checking `pieceId === hpState.highPassCarrierId`, in whichever `GAME_MOVE` handler branch currently handles HIGH_PASS_MOVE repositioning (search `gameHandlers.ts` for the HIGH_PASS_MOVE equivalent of this `if (gameState.phase === 'FIRST_TIME_PASS_MOVE')` block — same file, same shape).

**Touch point 2 — delivery occupant lookup excludes the passer (lines 758-767):**

```typescript
// Cycle-4 self-pass-reclaim finding (D-03, Phase 17.1-16): exclude the original
// passer (firstTimePassCarrierId) — defense in depth behind the GAME_MOVE rejection
// above; even if the passer were somehow standing on passTargetHex, the ball must
// not be handed back to them.
const occupant = ftpEndState.pieces.find(
  (p) =>
    p.position.q === targetHex.q &&
    p.position.r === targetHex.r &&
    p.id !== ftpEndState.firstTimePassCarrierId,
);
```

**BUG-11 mirror:** the equivalent HIGH_PASS_MOVE delivery-occupant `.find()` (search `gameHandlers.ts` near line 690 — `ball: { ...hpState.ball, carrierId: hpState.highPassCarrierId ?? null }`) must add the same `p.id !== hpEndState.highPassCarrierId` exclusion clause.

**Touch point 3 — carrier id cleared at delivery (line 786):**

```typescript
// Carrier id is only cleared once the ball is delivered — mirrors the
// HIGH_PASS clear of highPassCarrierId:null (Phase 17.1-16).
firstTimePassCarrierId: null,
```

Per the comment itself, `highPassCarrierId: null` is **already cleared** at HP delivery (line 695: `highPassCarrierId: null,`) — confirm this remains correct; this touch point may already be satisfied for HP and only touch points 1-2 are the actual gap.

**Client mirror (UX-only, `useGameStore.ts:474-481`):**

```typescript
// Cycle-4 self-pass-reclaim finding (D-03, Phase 17.1-16): the original passer's own
// piece is not selectable during FTP repositioning — defense-in-depth UX only; the
// server is the authoritative guard (GAME_MOVE rejects WRONG_PIECE) and would reject
// this move even if a tampered client bypassed this check.
if (id === gameState.firstTimePassCarrierId) {
  set({ selectedPieceId: null, validMoveHexes: [] });
  return;
}
```

**BUG-11 mirror:** add the identical block to the `gameState.phase === 'HIGH_PASS_MOVE'` branch of `selectPiece` in `useGameStore.ts`, checking `gameState.highPassCarrierId`.

---

### `useGameStore.ts` — `slotChanged` staleness check (BUG-09)

**Analog:** `packages/client/src/store/useGameStore.ts:595-617` (`setGameState`)

**Current pattern — only compares `movementSlot` (confirmed gap):**

```typescript
setGameState: (newState) => {
  const prev = get();
  const prevState = prev.gameState;
  const prevSelectedId = prev.selectedPieceId ?? prev.lastMovedPieceId;

  // Determine whether to retain or clear selection (D-17, D-18, D-19)
  const slotChanged = newState.movementSlot !== prevState.movementSlot;
  const phaseChanged = newState.phase !== prevState.phase;
  const pieceStillExists =
    prevSelectedId !== null && newState.pieces.some((p) => p.id === prevSelectedId);
  const activationComplete =
    prevSelectedId !== null && newState.movedPieceIds.includes(prevSelectedId);

  if (
    slotChanged ||
    phaseChanged ||
    !pieceStillExists ||
    prevSelectedId === null ||
    activationComplete
  ) {
    set({ gameState: newState, selectedPieceId: null, validMoveHexes: [], ... });
    return;
  }
  ...
}
```

**BUG-09 fix shape:** `slotChanged` must be broadened to a multi-field OR comparison covering `firstTimePassMovementSlot`, `highPassMovementSlot`, `gkKickMovementSlot` (the original folded-todo scope) **plus** a new pace-exhaustion clear condition (BUG-09's broadened scope) covering `firstTimePassPaceUsed`, `highPassPaceUsed`, `gkKickPaceUsed`, `snapDeflectPaceUsed` reaching their per-phase cap, and `HEADER`/`FREE_KICK_SETUP` phases' own moved/placed tracking fields. Recommend renaming `slotChanged` to something like `responseMoveStateChanged` and building it as an OR-chain of per-phase field comparisons, mirroring this function's existing OR-chain style (`activationComplete` is the template for "derive a boolean from current+previous state, OR it into the clear condition").

---

### `moveValidator.ts` / `HexGrid.tsx` — ZoI exclusion (BUG-08 re-verification)

**Analog:** `packages/shared/src/moveValidator.ts:92-124`

```typescript
// STEAL_ATTEMPT exclusion (already correct, lines 94-102):
const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId);
const allDefenders = getZoIDefenders(to, opponents);
const defenders = allDefenders.filter((d) => !(state.stealAttemptedByIds ?? []).includes(d.id));

// TACKLE_ATTEMPT exclusion (already correct, lines 116-122):
if (!(state.tackleAttemptedByIds ?? []).includes(piece.id)) {
  return { ok: true, effect: { type: 'TACKLE_ATTEMPT', carrierId: carrier.id } };
}
```

**Client tint filter, `HexGrid.tsx:165-173`:**

```typescript
// D-02 (Phase 17.1 gap closure, plan 09): exclude defenders already in stealAttemptedByIds
const zoiRiskSet = new Set(
  // ... filters by stealAttemptedByIds ...
  (d) => !(stealAttemptedByIds ?? []).includes(d.id),
  // ...
);
```

**BUG-08 finding:** `moveValidator.ts`'s validator-side logic for both steal and tackle already correctly excludes by `*AttemptedByIds`. `HexGrid.tsx`'s `zoiRiskSet` (line 165-173) is filtered by `stealAttemptedByIds` only — confirm whether a parallel `tackleRiskSet`/`tackleAttemptedByIds` filter exists; grep showed only `stealAttemptedByIds` referenced in `HexGrid.tsx`. This is very likely the actual BUG-08 gap: the steal-side tint filter exists, but the bug report describes a **steal** scenario, so re-verify against the literal repro before assuming this is solved — read `.planning/debug/zoi-tackle-steal-exclusion.md` per CONTEXT.md D-07 instruction before changing code.

---

### `PitchMarkings.tsx` — final-third marker (UX-09)

**Analog:** `packages/client/src/components/PitchMarkings.tsx:14-25` (halfway line, exact geometry template)

```typescript
{/* Halfway line — vertical at x=540 (q=18 centre column) */}
<line
  x1={540}
  y1={17.3}
  x2={540}
  y2={883.3}
  stroke="white"
  strokeWidth={1.5}
  strokeOpacity={0.6}
  fill="none"
  pointerEvents="none"
/>
```

**UX-09 application:** add two new `<line>` elements at the q=10/q=11 and q=25/q=26 boundary x-coordinates (derive from the same hex-to-pixel conversion already used for `x1={540}` at q=18 — do not hardcode a guess, compute from `PITCH_REGIONS.homeThird`/`awayThird` and the existing hex coordinate math used elsewhere in this file/`HexGrid.tsx`), using `stroke="#ef4444"`, `strokeWidth={3}`, `strokeOpacity={1}` per UI-SPEC, spanning full board height (`y1={17.3}` to `y2={883.3}`, matching the halfway line's y-span exactly).

---

### `ActionLog.tsx` — dice-roll log format (D-03) and UX-14 hook

**Analog:** `packages/client/src/components/ActionLog.tsx:180-186, 205-219, 220-236, 275-304, 326-...`

**Current `DICE_ROLL` case (line 180-186, generic, no stat/penalty):**

```typescript
case 'DICE_ROLL':
  return {
    prefix: '[DICE]',
    prefixColor: null,
    content: ` Rolled ${event.result}`,
    isGoal: false,
  };
```

**`TACKLE_ATTEMPT` case already has the stat+roll shape (lines 220-236) — use as the template:**

```typescript
case 'TACKLE_ATTEMPT': {
  const defStat = event.defenderCombined - event.defenderDie;
  const carrStat = event.carrierCombined - event.carrierDie;
  return {
    prefix: '[TACKLE]',
    prefixColor: pieceColorOf(event.defenderId),
    content: (
      <>
        {' '}
        {event.result} {'-> '}
        <P pieceId={event.defenderId} prefix="D" /> ({event.defenderDie}+{defStat}) vs{' '}
        <P pieceId={event.carrierId} prefix="A" /> ({event.carrierDie}+{carrStat})
      </>
    ),
    isGoal: false,
  };
}
```

**`SHOT_ATTEMPT`'s `fmtScore` helper (lines 276-279) is the closest existing `{stat}+{roll}{±penalty}={score}` formatter — reuse/generalize this for D-03's mandated format:**

```typescript
const fmtScore = (die: number, rawStat: number, penalty: number, score: number): string => {
  if (penalty === 0) return `(${die}+${rawStat}=${score})`;
  return `(${die}+${rawStat}${penalty < 0 ? penalty : `+${penalty}`}=${score})`;
};
```

**D-03 fix shape:** generalize `fmtScore` (currently local to the `SHOT_ATTEMPT` case) into a shared module-level helper, and apply it uniformly to `DICE_ROLL`, `TACKLE_ATTEMPT`, `STEAL_ATTEMPT`, `HEADER` cases — note `fmtScore` already omits the `-0`/`+0` term inconsistently (`if (penalty === 0) return ...=score` with no `-0`/`+0` shown) which **violates** D-03's "never omit, always show `- 0`" rule. The shared helper must be rewritten to always include the penalty term, e.g. `${die}+${rawStat}-${Math.abs(penalty)}` style matching the literal `{stat} + {roll} - {penalty}` convention, not the current `if (penalty===0) omit` branch.

**UX-14 hook point:** `ActionLog.tsx`'s `case 'GOAL':` (line 237), `case 'STEAL_ATTEMPT':` (success branch, line 205-219), and `case 'TACKLE_ATTEMPT':` (success/turnover branch, line 220-236) are the literal `ActionEvent` types `EventBanner.tsx` must subscribe to — no new event types, exactly as UI-SPEC states. `EventBanner.tsx` needs its own ref-based "is this event new" diff (UI-SPEC explicitly recommends `lastPieceRef`-style ref tracking, same pattern already used in `GameBoard.tsx` per D-03 of that file) rather than re-deriving from `ActionLog.tsx`'s rendering logic.

---

### `TeamSelectionScreen.tsx` — game speed selector (UX-07)

**Analog:** `packages/client/src/components/TeamSelectionScreen.tsx:57-58` (2×2 grid, `SELECT-01`)

```typescript
{/* D-12: 2×2 grid — SELECT-01 */}
<div className={styles.grid}>
```

**UX-07 application:** add a Slow/Standard/Fast control as a sibling section on this screen (new `<select>` or three-button toggle, styled at Body/Emphasis typography roles per UI-SPEC), persisted onto `GameState` alongside `selectedTeams` (per `types.ts` precedent — `selectedTeams` field shape is the template for where/how to add the new speed field). Threading: the picked value must reach whatever function derives clock minutes from `actionCount` (Phase 13 area — search for the `actionCount`→minutes derivation function, likely in `gameEngine.ts` or a clock utility, before wiring the multiplier).

---

## Shared Patterns

### Lookup-table-as-data pattern (D-02 constraint)

**Source:** `PHASE_LABEL: Record<GamePhase, string>` (`GameBoard.tsx:17-43`)
**Apply to:** `STAT_FULL_NAME` (UX-12), any new slot-suffix lookup (DESIGN-01's MOVE 4/5/2), `ctaButtonClass()`/`statBubbleClass()`-style selector functions (UX-08)

```typescript
const X_LABEL: Record<KeyType, string> = { ... };
```

Never introduce a templating engine or function-valued map for these — flat `Record` lookups only, per D-02's explicit instruction.

### Native `title` tooltip (UX-12/UX-13)

**Source:** `KickOffSetupPanel.tsx:115`, `FreeKickSetupPanel.tsx:137`, `GameBoard.tsx:234,333`
**Apply to:** all UX-12 stat bubbles, all UX-13 action buttons

```typescript
<button title="...">...</button>
```

No custom tooltip component — confirmed zero-dependency precedent already exists 4x in the codebase.

### `*AttemptedByIds` per-action-type ZoI exclusion (BUG-08 precedent, Phase 17.1 D-02)

**Source:** `moveValidator.ts:92-124`, `HexGrid.tsx:165-173`
**Apply to:** any new BUG-08 fix, and as the template for BUG-09's broader "already attempted" semantics if applicable

```typescript
const defenders = allDefenders.filter((d) => !(state.stealAttemptedByIds ?? []).includes(d.id));
```

### `*CarrierId` exclusion lifecycle (BUG-11 precedent, Phase 17.1-16 D-03)

**Source:** `gameHandlers.ts` lines 505-514, 758-767, 786; `useGameStore.ts` lines 474-481
**Apply to:** `highPassCarrierId` (BUG-11) — 3 server touch points + 1 client mirror, see Pattern Assignments above for full excerpts.

### Cosmetic SVG board-overlay layer (UX-09 precedent, Phase 7.1 D-07/D-08/D-12)

**Source:** `PitchMarkings.tsx` (whole file is the established home for static board markings)
**Apply to:** UX-09's final-third marker — must live in `PitchMarkings.tsx`, not as a new ad-hoc `<line>` directly in `HexGrid.tsx`.

### `ref`-based "is this new" diffing for transient UI (UX-14 precedent)

**Source:** `GameBoard.tsx` D-03 comment referencing `lastPieceRef`-style pattern (search `GameBoard.tsx` for existing `useRef` usage tracking "last seen" values)
**Apply to:** `EventBanner.tsx`'s trigger logic — diff current `eventLog` tail against a ref-stored "last seen event id/index," not a derived-state recompute every render.

## No Analog Found

| File                        | Role                                   | Data Flow        | Reason                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-08 confirm dialog markup | component (inline JSX, not a new file) | request-response | No standalone confirm-dialog component exists anywhere in the codebase; closest is the full-screen `HALF_TIME`/`FULL_TIME` `.overlay`/`.overlayCard` modal in `GameBoard.tsx`/`.module.css`, which is a different size/purpose (full match-break screen, not a small inline confirm). Treat as a new small modal pattern using the same CSS building blocks (`.overlay` z-index/backdrop conventions), not a literal copy. |
| `EventBanner.tsx` (UX-14)   | component                              | event-driven     | No existing "transient toast" component exists. `DisconnectBanner.tsx` is the closest shape (a banner that mounts/unmounts based on connection state) but is not auto-dismissing/timed. Build fresh using UI-SPEC's fully-locked visual/timing spec; do not search further for a closer analog — UI-SPEC already pre-resolved all discretion points.                                                                       |

## Metadata

**Analog search scope:** `packages/client/src/components/`, `packages/client/src/store/`, `packages/server/src/`, `packages/shared/src/`
**Files scanned:** GameBoard.tsx, ActionLog.tsx, ActionPanel.tsx, HexGrid.tsx, PitchMarkings.tsx, PieceOverlay.tsx, TeamSelectionScreen.tsx, PlayerStatsPanel.tsx, DisconnectBanner.tsx, useGameStore.ts, gameHandlers.ts, gameEngine.ts, moveValidator.ts, offside.ts, types.ts, roomStore.ts, ReplayPanel.tsx
**Pattern extraction date:** 2026-06-20
