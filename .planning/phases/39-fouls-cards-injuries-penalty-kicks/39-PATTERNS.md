# Phase 39: Fouls, Cards, Injuries & Penalty Kicks - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 16 (net-new) + 8 (modified)
**Analogs found:** 24 / 24 — RESEARCH.md already performed deep, line-cited codebase inspection; this map converts that research into per-file analog assignments with concrete excerpts for the planner.

## File Classification

| New/Modified File                                                                                                                        | Role                                     | Data Flow          | Closest Analog                                                                                                                             | Match Quality                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `packages/shared/src/fouls.ts` (NEW)                                                                                                     | utility/service (pure helpers)           | transform          | `packages/shared/src/offside.ts`                                                                                                           | exact                         |
| `packages/shared/src/types.ts` (MODIFIED — new events/phases/fields)                                                                     | model                                    | transform          | same file, existing `ActionEvent`/`GamePhase`/`PlayerPiece` unions                                                                         | exact                         |
| `packages/shared/src/scoreUtils.ts` (MODIFIED — call-site extensions only)                                                               | utility                                  | transform          | same file, `computeCombinedScore`/`computeLooseBall`                                                                                       | exact                         |
| `packages/shared/src/shotValidator.ts` (MODIFIED — sibling penalty fn)                                                                   | utility                                  | transform          | same file, `validateGKDive`                                                                                                                | exact                         |
| `packages/server/src/gameEngine.ts` — foul/injury/booking inline sub-resolution                                                          | controller/service (game engine reducer) | event-driven       | `gameEngine.ts:895-1049` (STEAL_ATTEMPT/TACKLE_ATTEMPT)                                                                                    | exact                         |
| `packages/server/src/gameEngine.ts` — `triggerFoulFreeKick`                                                                              | service                                  | event-driven       | `packages/shared/src/offside.ts:234-281` `triggerOffsideFoul`                                                                              | exact                         |
| `packages/server/src/gameEngine.ts` — `applyFoulChoice`                                                                                  | service                                  | request-response   | `gameEngine.ts` `applyGoalKick*`/`applyCornerKick*` family                                                                                 | role-match                    |
| `packages/server/src/gameEngine.ts` — `computePenaltyKickEligibleIds`                                                                    | utility                                  | transform          | `gameEngine.ts:4634-4645` `computeGoalKickEligibleIds`                                                                                     | exact                         |
| `packages/server/src/gameEngine.ts` — Penalty Kick phase chain (`applyPenaltyKick*`)                                                     | service                                  | event-driven       | Goal Kick / Corner Kick phase chain (`GOAL_KICK_SETUP_GK`/`_OPPONENT`)                                                                     | exact                         |
| `packages/server/src/gameEngine.ts` — GK-dive-at-feet duel + interrupt offer                                                             | service                                  | event-driven       | `gameEngine.ts:895-1049` TACKLE_ATTEMPT (duel reuse) + `shotValidator.ts:93-99` (distance penalty)                                         | exact                         |
| `packages/server/src/gameEngine.ts` — shared `enterGkDiveOrSkip` cap helper (D-09)                                                       | service                                  | event-driven       | 4 existing `phase: 'GK_DIVE'` call sites (`gameEngine.ts:6180, 3098, 3198, 5892`)                                                          | role-match (new dedup helper) |
| `packages/server/src/gameEngine.ts` — box-entry GK response move (D-10/D-11)                                                             | service                                  | event-driven       | dive-at-feet interrupt-prompt shape (D-07), same file                                                                                      | role-match                    |
| `packages/server/src/gameHandlers.ts` — `GAME_FOUL_CHOICE`, `GAME_GK_DIVE_AT_FEET_PROMPT`, `GAME_PENALTY_*`, box-entry-response handlers | controller (socket handler)              | request-response   | `gameHandlers.ts` `GAME_GK_DIVE` handler (3009-3087)                                                                                       | exact                         |
| `packages/server/src/gameHandlers.ts` — `GAME_HALF_TIME_START` mutual-confirm rework (D-16)                                              | controller                               | request-response   | `roomHandlers.ts` `LINEUP_CONFIRM` (750-883) mutual-confirm flags; but state home is `GameState.headerConfirmed`-shaped, not `Room`-shaped | role-match (see Pitfall note) |
| `packages/client/src/components/FoulChoicePanel.tsx` (NEW)                                                                               | component                                | request-response   | `packages/client/src/components/FreeKickSetupPanel.tsx` / Phase 35 panel-family conventions                                                | exact                         |
| `packages/client/src/components/PenaltyKickSetupPanel.tsx` (NEW)                                                                         | component                                | request-response   | `packages/client/src/components/GoalKickSetupPanel.tsx`                                                                                    | exact                         |
| `packages/client/src/components/GkDiveAtFeetPromptPanel.tsx` (NEW)                                                                       | component                                | request-response   | tackle/steal opt-in prompt shape (same panel family)                                                                                       | role-match                    |
| `packages/client/src/components/EventBanner.tsx` (MODIFIED — fix + extend)                                                               | component                                | event-driven       | same file, `getBannerMessage`/`RESTART_BANNERS`/diff-effect (107-115)                                                                      | exact                         |
| `packages/client/src/components/GameSettingsScreen.tsx` (MODIFIED — 3 new toggles + default flip)                                        | component                                | request-response   | same file, Out-of-Bounds/Restarts checkbox (137-147) + `SELECTABLE_DRAFT_POOLS` disabled pattern (149-174)                                 | exact                         |
| `packages/client/src/components/PieceOverlay.tsx` (MODIFIED — card/injury badges)                                                        | component                                | transform (render) | same file, ball-possession dot (103-125, 212-226)                                                                                          | exact                         |
| `packages/client/src/components/GameBoard.tsx` (MODIFIED — phase dispatch + canStart gate)                                               | component                                | event-driven       | same file, existing phase-dispatch table (346-376) + `canStart` (188-227)                                                                  | exact                         |
| `packages/client/src/components/ActionLog.tsx` (MODIFIED — `LOOSE_BALL_LAND` fix, D-15)                                                  | component                                | transform (render) | same file, line 723-729                                                                                                                    | exact                         |
| `packages/server/src/__tests__/gameEngine.fouls.test.ts` (NEW)                                                                           | test                                     | —                  | `packages/server/src/__tests__/*.integration.test.ts` (e.g. `cornerKick.integration.test.ts`, `goalKick.integration.test.ts`)              | exact                         |
| `packages/server/src/__tests__/gkDiveAtFeet.integration.test.ts`, `penaltyKick.integration.test.ts` (NEW)                                | test                                     | —                  | `cornerKick.integration.test.ts` / `goalKick.integration.test.ts`                                                                          | exact                         |

## Pattern Assignments

### `packages/shared/src/fouls.ts` (NEW — utility, transform)

**Analog:** `packages/shared/src/offside.ts`

**Core pattern — restart-trigger function contract** (`offside.ts:234-281`, full function read):

```typescript
export function triggerOffsideFoul(state: GameState, explicitOffenderId?: string): GameState {
  const offenderId = explicitOffenderId ?? state.ball.carrierId;
  if (explicitOffenderId === undefined && state.ball.carrierId === null) return state;
  if (offenderId === null || offenderId === undefined) return state;

  const flagged = state.offsidePieceIds ?? [];
  if (!flagged.includes(offenderId)) return state;

  const offender = state.pieces.find((p) => p.id === offenderId);
  if (!offender) return state;

  const otherTeam: 'home' | 'away' = offender.teamId === 'home' ? 'away' : 'home';

  return {
    ...state,
    phase: 'FREE_KICK_SETUP',
    freeKickHex: offender.position,
    freeKickAttackingTeam: otherTeam,
    attackingTeam: otherTeam,
    activeTeam: otherTeam,
    ball: { position: offender.position, carrierId: null, lastTouchedBy: state.ball.lastTouchedBy },
    offsidePieceIds: flagged.filter((id) => id !== offenderId),
    freeKickStageIndex: 0,
    freeKickPlacedPieceIds: [],
    freeKickKickerChosen: false,
    movedPieceIds: [],
    lastDiceRoll: null,
  };
}
```

**Apply to:** New `triggerFoulFreeKick(state, foulerId)` in `gameEngine.ts` — byte-for-byte the same return shape, substituting `freeKickHex: fouler.position` (the FOULER's, not the offender's) and skipping the `offsidePieceIds` field. Also write `computeProfessionalFoulReachability` (FOUL-04, Pitfall 5) and the flat `die >= attribute` injury/booking check helpers here as pure functions — never routed through `computeCombinedScore` (see Pitfall note below).

**Error handling pattern:** Every guard clause is an early `return state` (referential-identity no-op) rather than throwing — mirror this for all new pure helpers so callers can safely no-op on invalid input without try/catch.

---

### `packages/server/src/gameEngine.ts` — foul/injury/booking inline sub-resolution (FOUL-01/02)

**Analog:** `gameEngine.ts:895-1049` (STEAL_ATTEMPT / TACKLE_ATTEMPT branches inside `applyMove`)

**Core duel-resolution + event-append pattern** (`gameEngine.ts:930-969`, TACKLE_ATTEMPT):

```typescript
const defDie = dice?.tackleDie ?? 3;
const carDie = dice?.carrierDie ?? 3;
const carrierId = result.effect.carrierId;
const carrier = state.pieces.find((p) => p.id === carrierId);
if (carrier !== undefined) {
  const defCombined = computeCombinedScore(piece.tackling, defDie, []);
  const carCombined = computeCombinedScore(carrier.dribbling, carDie, []);
  const tackleResult: 'SUCCESS' | 'FAIL' = defCombined >= carCombined ? 'SUCCESS' : 'FAIL';
  tackleSuccess = tackleResult === 'SUCCESS';
  const tackleEvent: ActionEvent = {
    type: 'TACKLE_ATTEMPT',
    defenderId: pieceId,
    carrierId,
    defenderDie: defDie,
    carrierDie: carDie,
    defenderCombined: defCombined,
    carrierCombined: carCombined,
    result: tackleResult,
    timestamp: Date.now(),
    ballAfter: tackleBallAfter,
  };
  newEventLog = [...newEventLog, tackleEvent];
  newTackleAttemptedByIds = [...newTackleAttemptedByIds, pieceId];
  // ... SUCCESS/FAIL branches return { ok: true, state: {...} } — no phase transition on FAIL
}
```

**Hook point for FOUL-01** — insert immediately after `newEventLog = [...newEventLog, stealEvent]` (line 925) and after `newEventLog = [...newEventLog, tackleEvent]` (line 967), using the SAME `die`/`defDie` variable already extracted (do NOT roll a fresh die for the die===1 detection itself — a fresh die IS needed for the subsequent injury/booking threshold checks, per RESEARCH.md Assumption A1):

```typescript
// FOUL-01: die === 1 on the DEFENDER's own die triggers a foul.
if (die === 1 && state.foulsEnabled) {
  // append FOUL_CALLED event; if injuryEnabled roll+append INJURY_CHECK;
  // if bookingEnabled roll+append BOOKING_CHECK; transition phase to new 'FOUL_CHOICE'
  // instead of returning ok:true with the normal FAIL-continuation state.
}
```

**Error handling pattern:** Same `{ ok: false, reason: 'MOVE_INVALID', detail: '...' }` shape used for the existing `ALREADY_ATTEMPTED` guards (lines 905-907, 935-937) — reuse this exact discriminated-union shape for any new validation rejection (e.g. rejecting a `GAME_FOUL_CHOICE` submission from the wrong team).

**Apply to:** `gameEngine.ts` STEAL_ATTEMPT/TACKLE_ATTEMPT branches directly; new `PlayerPiece.injured`/`yellowCards`/`redCarded` fields set via immutable `newPieces` array rewrite (same style as `newPieces` is already built elsewhere in `applyMove`).

---

### `packages/server/src/gameEngine.ts` — Penalty Kick eligibility + reposition window (PEN-02, D-08)

**Analog:** `gameEngine.ts:4634-4645` `computeGoalKickEligibleIds`

```typescript
export function computeGoalKickEligibleIds(
  pieces: readonly PlayerPiece[],
  goalKickTeam: 'home' | 'away',
): { gkTeam: readonly string[]; opponent: readonly string[] } {
  const eligible = pieces.filter(
    (p) => isInRegion(p.position, 'homeThird') || isInRegion(p.position, 'awayThird'),
  );
  return {
    gkTeam: eligible.filter((p) => p.teamId === goalKickTeam).map((p) => p.id),
    opponent: eligible.filter((p) => p.teamId !== goalKickTeam).map((p) => p.id),
  };
}
```

**Apply to:** New `computePenaltyKickEligibleIds` — identical shape but **no region filter** (every on-pitch piece is eligible for both teams); add PEN-02's penalty-area placement restriction (kicker + defending GK only) as a per-move validation check inside the new `applyPenaltyKickMove` handler, referencing `PITCH_REGIONS.homePenaltyArea`/`awayPenaltyArea` (`packages/shared/src/pitch.ts:82-83`) — NOT as an eligibility filter.

**Client template:** `packages/client/src/components/GoalKickSetupPanel.tsx:100-148` — the reposition-window branch (`eligibleIds`/`usedPace`/`movedPieceIds` remaining-count UI + `withEndTurnGuard` soft confirm dialog) is the direct structural copy target for `PenaltyKickSetupPanel.tsx`.

**CSS convention** — confirmed via CONTEXT.md/RESEARCH.md citation: `GoalKickSetupPanel.module.css:6-9` and `FreeKickSetupPanel.module.css:4-7` both define `.panel` with `background`/`border-radius`/`padding` only, no `border` property. Copy this exactly for `FoulChoicePanel`, `PenaltyKickSetupPanel`, `GkDiveAtFeetPromptPanel` (D-01's cited Phase 35 panel-family convention).

---

### `packages/shared/src/scoreUtils.ts` — penalty threading (PEN-01, GKDIVE-02, INJURY-02)

**Analog:** same file, `computeCombinedScore` (lines 28-37, full function):

```typescript
export function computeCombinedScore(
  attribute: number,
  diceValue: number,
  penalties: number[],
): number {
  const totalPenalty = penalties.reduce((sum, p) => sum + p, 0);
  // DICE-04: cap cumulative penalty at -2 (penalties are negative, so we use Math.max)
  const clampedPenalty = Math.max(totalPenalty, -2);
  return attribute + diceValue + clampedPenalty;
}
```

**Apply to:** No changes to the function itself. New call sites: PEN-01's penalty-kick GK duel = `computeCombinedScore(gk.saving, gkDie, [-2])`; GKDIVE-02's dive-at-feet duel threads a distance-banded penalty from the new sibling function below; INJURY-02's -1 effective attribute reduction is threaded as an additional entry in the `penalties` array at each duel call site (do NOT mutate `PlayerPiece.tackling`/`.dribbling`/`.saving`/`.pace` directly — see Pitfall below).

**Analog for distance-banded penalty:** `packages/shared/src/shotValidator.ts:93-99` `validateGKDive`:

```typescript
export function validateGKDive(_gk: PlayerPiece, distance: number): DiveResult {
  const d = Math.max(distance, 0);
  if (d > 3) return { saveable: false, reason: 'OUT_OF_RANGE' };
  const savingPenalty = d === 3 ? -1 : 0;
  return { saveable: true, savingPenalty };
}
```

**Apply to:** Write a sibling `validateDiveAtFeetDistance(distance: number)` with the identical `d > 3` range guard and `d === 3 ? -1 : 0` penalty shape (GKDIVE-02 is structurally identical to the existing shot-block dive band).

---

### `packages/server/src/gameHandlers.ts` — new socket handlers

**Analog:** `GAME_GK_DIVE` handler (`gameHandlers.ts:3009-3087` per RESEARCH.md citation; `isProcessing` mutex pattern confirmed at multiple sites, e.g. lines 394-434, 446-873, 885-1530).

**isProcessing mutex + finally-release pattern** (confirmed live in file, e.g. lines 394-396, 434):

```typescript
if (!room || room.isProcessing) return; // SC-5: drop duplicate silently
room.isProcessing = true;
try {
  // ... validate team ownership (controlsGKTeam-style guard), delegate to pure gameEngine.ts function, broadcastState
} finally {
  room.isProcessing = false; // MUST be in finally — Pitfall 5
}
```

**Auth/guard pattern:** `controlsGKTeam(socket, room)` (`gameHandlers.ts:188`) — team-ownership check before allowing a GK-only action. Apply the identical idiom (a `controlsXTeam`-shaped helper or the same `socketTeam` comparison) to every new handler: only the attacking manager may submit `GAME_FOUL_CHOICE`; only the GK's team may respond to `GAME_GK_DIVE_AT_FEET_PROMPT` and the box-entry response prompt; only the correct team per turn-window may act in `GAME_PENALTY_*` reposition handlers.

**Apply to:** All new handlers (`GAME_FOUL_CHOICE`, `GAME_GK_DIVE_AT_FEET_PROMPT`, `GAME_PENALTY_REPOSITION`, `GAME_PENALTY_WINDOW_END`, `GAME_PENALTY_KICKER_CHOSEN`, box-entry-response handler) — copy this exact three-part shape (mutex guard → try → team-guard + pure delegate + broadcastState → finally release).

---

### `packages/client/src/components/EventBanner.tsx` — fix + extend (D-02, Pitfall 1)

**Analog:** same file, current (buggy) tail-only diff effect (lines 107-115):

```typescript
if (eventLog.length <= lastProcessedLengthRef.current) return;
const tailEvent = eventLog[eventLog.length - 1];
const banner = tailEvent !== undefined ? getBannerMessage(tailEvent) : null;
lastProcessedLengthRef.current = eventLog.length;
if (banner !== null) {
  setActive(banner);
}
```

**Bug to fix (Pitfall 1, confirmed live):** only ever inspects the LAST newly-appended event; a single `applyMove` broadcast that appends `MOVE` + `TACKLE_ATTEMPT` + `FOUL_CALLED` + `INJURY_CHECK` + `BOOKING_CHECK` in one update silently drops all but the last banner. **Rework to** `eventLog.slice(lastProcessedLengthRef.current)` and process/queue **every** newly-appended event's banner in sequence, not just the tail.

**Existing banner-registry pattern to extend** (`RESTART_BANNERS`, lines 24-27, and `getBannerMessage`, lines 43-46):

```typescript
export const RESTART_BANNERS: Partial<Record<GamePhase, string>> = {
  THROW_IN_SETUP: 'Throw In!',
  GOAL_KICK_SETUP_GK: 'Goal Kick!',
  CORNER_KICK_GK_SETUP_ATTACKING: 'Corner Kick!',
  // ADD: new Penalty Kick phase value, matching this exact registry-entry convention
};

function getBannerMessage(
  event: ActionEvent,
): { message: string; variant: 'goal' | 'notable'; duration: number } | null {
  if (event.type === 'GOAL') {
    /* ... */
  }
  // ADD: FOUL_CALLED / INJURY_CHECK (only if injury occurred) / BOOKING_CHECK (only if
  // card issued) cases here, per D-02's "banners only when there's an impact on play" rule.
}
```

**Apply to:** This is also the right place to add D-03's card-color badge (colored rect matching yellow/red) + "DOGSO" label for the booking-banner variant — extend the banner payload shape with an optional `cardColor`/`isDogso` field, rendered in the banner's JSX alongside the message.

---

### `packages/client/src/components/GameSettingsScreen.tsx` — 3 new toggles (D-12/D-13/D-14)

**Analog:** same file — Out-of-Bounds/Restarts checkbox section (lines 137-147) is the exact row-markup template for D-12; `SELECTABLE_DRAFT_POOLS` disabled-checkbox pattern (lines 149-174) is the exact template for D-13's grey-out-when-Fouls-off behavior.

**Checkbox row pattern to copy verbatim (D-12):**

```typescript
<div className={styles.section}>
  <span className={styles.sectionLabel}>Restarts</span>
  <label className={styles.poolRow}>
    <input
      type="checkbox"
      checked={outOfBounds}
      onChange={() => setOutOfBounds((v) => !v)}
    />
    Out-of-Bounds / Restarts
  </label>
</div>
```

**Disabled-checkbox-when-dependency-off pattern to copy (D-13)** (lines 153-171, the `ALL_DRAFT_POOLS.map` disabled-row rendering):

```typescript
{ALL_DRAFT_POOLS.map((poolId) => {
  const disabled = !SELECTABLE_DRAFT_POOLS.includes(poolId);
  const checked = draftPools.includes(poolId);
  return (
    <label key={poolId} className={disabled ? styles.poolRowDisabled : styles.poolRow}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleDraftPool(poolId)} />
      {DRAFT_POOL_LABELS[poolId]}
      {disabled && <span className={styles.comingSoon}> (coming soon)</span>}
    </label>
  );
})}
```

**Apply to:** New `fouls`/`booking`/`injury` boolean `useState`s (all defaulting to `true` per D-14 — this is also where the existing `outOfBounds` default flips from `useState<boolean>(false)` at line 42 to `true`, an explicit confirmed change). Booking/Injury checkboxes get `disabled={!fouls}` computed the same way `disabled = !SELECTABLE_DRAFT_POOLS.includes(poolId)` is computed, applying `styles.poolRowDisabled` when true. Extend the `onConfirm` settings bundle (lines 22-28) with the 3 new boolean fields, mirroring how `outOfBounds` was added there in Phase 37.

---

### `packages/client/src/components/PieceOverlay.tsx` — card/injury badges (D-04/D-05)

**Analog:** same file — existing ball-possession directional dot (lines 103, 124-125, 212-226):

```typescript
const PIECE_RADIUS = 12;
const dotOffsetX = piece.teamId === 'home' ? PIECE_RADIUS * 0.715 : -(PIECE_RADIUS * 0.715);
const dotOffsetY = PIECE_RADIUS * 0.715;   // always +Y (bottom corner)
// ...
<circle cx={cx + dotOffsetX} cy={cy + dotOffsetY} r={PIECE_RADIUS * 0.59} .../>
```

**Apply to:** D-05's badge renders at the **negated** offset (`-dotOffsetX, -dotOffsetY`) — top-left corner for home pieces, top-right for away — using the identical `PIECE_RADIUS * 0.59` radius. Render the card badge (colored `<rect>` yellow/red) first, then the injury badge (plus-sign `<g>`/`<path>`) after it in JSX/DOM order so it visually layers on top when both apply, per D-05. Read `piece.injured`/`piece.yellowCards`/`piece.redCarded` (new `PlayerPiece` fields) to drive conditional rendering, mirroring how the possession dot is conditionally rendered off `piece.id === ball.carrierId` today.

---

## Shared Patterns

### Server-authoritative dice via `crypto.randomInt`

**Source:** every existing duel resolution in `gameEngine.ts` (e.g. `dice?.stealDie`, `dice?.tackleDie` extraction at lines 900, 939)
**Apply to:** All new dice (injury check, booking check, GK-dive-at-feet duel, box-entry n/a, penalty-kick duel) — never accept a client-declared die value; server rolls and includes the result in the `ActionEvent` payload only.

### `isProcessing` mutex + team-ownership guard + pure-delegate + `finally` release

**Source:** `packages/server/src/gameHandlers.ts` (pattern present at every existing handler, e.g. lines 394-434, `controlsGKTeam` at 188)
**Apply to:** All new socket handlers listed above.

### Immutable state returns — `{ ok: true, state: {...state, ...} }` / `{ ok: false, reason, detail }`

**Source:** `gameEngine.ts:895-1049` (both STEAL_ATTEMPT and TACKLE_ATTEMPT branches)
**Apply to:** All new `applyFoulChoice`/`applyPenaltyKick*`/`applyGkDiveAtFeet*` functions — never mutate `state` in place; every field not explicitly overridden must pass through via spread.

### Per-event-type `ActionEventType` registration for Undo/Replay

**Source:** STATE.md standing pitfall, confirmed still applicable (RESEARCH.md Anti-Patterns section) — reactivating the generic `DICE_ROLL` type for any new roll is the specific anti-pattern to avoid, mirrored by how `GOAL_KICK`/`CORNER_KICK_ACCURACY` each got their own specific type in Phases 37/38.
**Apply to:** Every new roll needs its own `ActionEventType` member (e.g. `FOUL_CALLED`, `INJURY_CHECK`, `BOOKING_CHECK`, `GK_DIVE_AT_FEET`, `PENALTY_KICK`, plus D-15's extended `LOOSE_BALL_LAND` fields) — register each with Undo/Replay exactly as prior restart types were.

### Flat threshold comparison (INVERTED convention — do not route through `computeCombinedScore`)

**Source:** RESEARCH.md Pitfall 2 (confirmed architectural fact, not speculation)
**Apply to:** INJURY-01 (`injuryDie >= fouledPlayer.resilience`) and CARD-01 (`bookingDie >= state.refereeCard.leniency`) — both are bare `>=` comparisons where a HIGHER attribute is BETTER for the piece owner (opposite of every other duel's higher-is-better-for-offense convention). Do not thread these through `computeCombinedScore`; document this inversion explicitly at the call site.

### Effective (not stored) attribute penalty for injuries

**Source:** RESEARCH.md Pitfall 6 / Assumption A2 — default recommendation, consistent with existing shot/GK penalty convention
**Apply to:** INJURY-02's "-1 to all attributes, floored at 1" should be threaded through `computeCombinedScore`'s `penalties` array at each duel call site, NOT a permanent mutation of `PlayerPiece.tackling`/`.dribbling`/`.saving`/`.pace`/`.resilience` — this preserves the "true" stat values used elsewhere (roster/draft display). Escalate to the user only if a UI requirement for visibly-degraded roster numbers emerges during planning (flagged as a real design fork, not settled).

## No Analog Found

None — RESEARCH.md's direct codebase inspection (Sources section, `39-RESEARCH.md:561-583`) already confirmed a structural precedent exists in the shipped Phases 8-38 code for every mechanic this phase needs. The two genuinely novel algorithms are:

| File                                                                                             | Role          | Data Flow        | Reason                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------ | ------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/fouls.ts` — Professional Foul reachability check (FOUL-04)                  | utility       | transform        | No existing "remaining pace for a piece that hasn't acted yet" reachability check exists anywhere in the codebase (RESEARCH.md Pitfall 5) — nearest building block is `paceUsedByPieceId` + each piece's static `pace`, combined via `hexDistance(otherPiece.position, tackleHex) <= (otherPiece.pace - paceUsed)`, but no prior function assembles this exact check. Highest-implementation-risk item in the phase per RESEARCH.md. |
| `packages/server/src/gameEngine.ts` — `GameState.secondHalfConfirmed` mutual-confirm gate (D-16) | model/service | request-response | `LINEUP_CONFIRM`'s mutual-confirm flags live on `Room` (pre-match object); half-time state must live on `GameState` (mid-match). Closest actual analog is `GameState.headerConfirmed: { home: boolean; away: boolean }                                                                                                                                                                                                               | null` (`types.ts:999-1003`), not `LINEUP_CONFIRM`as CONTEXT.md's citation literally suggests — use`headerConfirmed`'s shape, not `LINEUP_CONFIRM`'s storage location (RESEARCH.md Pitfall 4). |

## Metadata

**Analog search scope:** `packages/shared/src`, `packages/server/src`, `packages/client/src/components` — scoped and cross-checked against RESEARCH.md's already-completed direct-inspection citations (file:line accurate as of 2026-08-09) plus this session's independent re-reads of `gameEngine.ts:895-1049`, `offside.ts:230-282`, `GameSettingsScreen.tsx` (full), `PieceOverlay.tsx` (grep-located), `scoreUtils.ts` (`computeCombinedScore`/`computeLooseBall`), `EventBanner.tsx` (grep-located diff effect + registries), `gameHandlers.ts` (grep-located mutex/guard pattern), `types.ts` (`PlayerPiece` attribute fields).
**Files scanned:** 8 read directly this session (full or targeted ranges); ~20 additional cross-referenced via RESEARCH.md's prior direct inspection (not re-read, to avoid duplicate-range waste).
**Pattern extraction date:** 2026-08-09
