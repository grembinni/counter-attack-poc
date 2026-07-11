# Phase 25: Bug & UAT Closure — Research

**Researched:** 2026-07-10
**Domain:** Bug fixes, UAT closure, UX improvements — existing React/Socket.io/TypeScript codebase
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** OFFSIDE-01/02 are pure UAT closures — no code changes planned. Phase 17 implementation assumed correct until UAT contradicts it.
- **D-02:** UAT pass criteria: Scenario A (flag), B (no flag — level), C (no flag — not active), D (restart). All four must pass.
- **D-03:** If bugs surface during OFFSIDE UAT, create a gap plan within Phase 25. Do not defer offside bugs to Phase 26.
- **D-04:** `carrierExclusionKey: 'highPassCarrierId'` is live at `gameHandlers.ts:405`. BUG-22 code was fixed in Phase 18.2.
- **D-05:** Phase 25 Plan 01 updates the BUG-22 checkbox in REQUIREMENTS.md and adds a fix pointer. No code changes. No new tests.
- **D-06:** REPLAY-07 and REPLAY-08 are fixed in a single plan (same defect class).
- **D-07:** `GK_KICK` fix: add `ballAfter: { position: HexCoord; carrierId: string | null }` to GK_KICK ActionEvent in `packages/shared/src/types.ts`. `ballAfter.position` = target hex; `carrierId` = player who takes possession, or `null` for loose ball.
- **D-08:** `LOOSE_BALL_LAND` fix: add the same `ballAfter` field. `ballAfter.position` = `to` hex (landing position); `carrierId` = whoever takes possession.
- **D-09:** Both `gameHandlers.ts` construction sites for each event must populate `ballAfter` with the resolved position/carrier at construction time. No null placeholders.
- **D-10:** Add both `'GK_KICK'` and `'LOOSE_BALL_LAND'` to `REPLAY_ELIGIBLE_TYPES` in `gameEngine.ts`. Separate inline comments for each.
- **D-11:** The incorrect "dead code" comment near `REPLAY_ELIGIBLE_TYPES` (claiming GK_KICK has "zero construction sites") must be removed or replaced.
- **D-12:** Add regression tests mirroring the `HEADED_PASS`/`GK_PUNT` visibility cases in `replay.integration.test.ts`.
- **D-13:** BUG-23 root cause was not identified through static analysis.
- **D-14:** Apply two belt-and-suspenders fixes in `HexGrid.tsx`: Fix 1 — outer `phase !== 'KICK_OFF_SETUP'` guard on the entire `isShotPathTint` expression. Fix 2 — clear `shotTargetHighlight` React useState when phase transitions to `KICK_OFF_SETUP`.
- **D-15:** After fixes, reproduce SNAPSHOT_DEFLECT → goal → KICK_OFF_SETUP in two-tab UAT. If shading persists, escalate to Phase 26.
- **D-16:** Uniform clearing bug: investigation required before fix. Read `App.tsx` socket handler sequence and `UniformSelectionScreen.tsx` state lifecycle.
- **D-17:** Player number too low: fix `dominantBaseline` or add `dy` offset in PieceOverlay.tsx `<text>` element.
- **D-18:** Style 12 pattern incorrect: Style 13 = cross/plus axis (╬). Style 12 = diagonal axis (✕). Fix SVG pattern for style index 12 (`quarter-horizontal`).
- **D-19:** Eligible player counter decrements on move START (piece selected), not on destination commit. Undo restores the counter.
- **D-20:** Pass result replaces push-button confirmation: auto-dismissing popup ("Accurate Pass!" or "Loose Ball!") styled like EventBanner, auto-dismisses after 1.5–2 seconds, then advances automatically. No player input required.

### Claude's Discretion

None specified. All decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

**Phase 26 — Response Activation Overhaul:**

- GK reactive 1-hex move when ball enters penalty box
- GK reactive 1-hex move before outside-box shot save
- Response activation cleanup: single-selection UI, range-in-white, per-hex challenge penalties, range-based eligibility filtering, auto-reposition keeper, log when no eligible players
- Player number centering validation across all piece styles/zoom levels (if D-17 fix incomplete)
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID         | Description                                                                                                                                                           | Research Support                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OFFSIDE-01 | Two-tab live UAT closure — offside detection: sticky `offsidePieceIds`, team-relative detection, D-22 clear paths, D-24 defender flagging                             | Phase 17 implementation is live in `gameEngine.ts:evaluateOffside`; UAT scenarios documented in D-02; no code changes unless bugs surface                                                                |
| OFFSIDE-02 | Two-tab live UAT closure — free-kick restart: foul trigger on possession gain and deflect, D-30/D-31 placement rules, restricted action set, D-41 deflection addendum | Code implemented Phase 17; UAT scenarios in D-02; no code changes unless bugs surface                                                                                                                    |
| REPLAY-07  | GK_KICK ball delivery visible during post-game replay                                                                                                                 | Requires `ballAfter` field added to `GK_KICK` ActionEvent in types.ts, populated in gameHandlers.ts construction site, and `'GK_KICK'` added to `REPLAY_ELIGIBLE_TYPES`                                  |
| REPLAY-08  | LOOSE_BALL_LAND ball delivery visible during post-game replay                                                                                                         | Same class as REPLAY-07; requires `ballAfter` added to `LOOSE_BALL_LAND` ActionEvent in types.ts, populated in gameEngine.ts construction site, and `'LOOSE_BALL_LAND'` added to `REPLAY_ELIGIBLE_TYPES` |
| BUG-22     | HIGH_PASS_MOVE carrier exclusion — `highPassCarrierId` fix                                                                                                            | Fix is already live (`carrierExclusionKey: 'highPassCarrierId'` at gameHandlers.ts:405). REQUIREMENTS.md checkbox update only; no code changes                                                           |
| BUG-23     | KICK_OFF_SETUP shot-path shading clears after SNAPSHOT_DEFLECT goal                                                                                                   | Belt-and-suspenders fix in HexGrid.tsx: outer `phase !== 'KICK_OFF_SETUP'` guard on `isShotPathTint` + clear `shotTargetHighlight` useState on KICK_OFF_SETUP transition                                 |
| UX-15      | UX streamlining: uniform clearing bug, player number positioning, style 12 pattern, eligible counter trigger, pass result popup                                       | Multiple fixes across client components; investigation step needed for uniform clearing before fix                                                                                                       |

</phase_requirements>

---

## Summary

Phase 25 is a closure-and-polish phase — no new game mechanics are introduced. The work divides into four categories: (1) human UAT verification of existing Phase 17 offside code, (2) a documentation-only requirement closure for BUG-22, (3) two identical replay defects requiring the same type fix, and (4) five UX items (three bugs, two UX improvements) from v1.3 playtesting.

The replay defects (REPLAY-07/08) follow an established pattern: `HEADED_PASS` and `GK_PUNT` were fixed identically in Phase 18.1. The fix requires three touch points — types.ts (add `ballAfter` field), the construction site (populate it), and `REPLAY_ELIGIBLE_TYPES` (add the event type). The existing `replay.integration.test.ts` provides the exact test pattern to mirror.

The UX-15 items range from trivially locatable (player number `dominantBaseline`, style 12 SVG transform swap) to investigation-first (uniform clearing bug with unknown root cause). All UX-15 work touches `packages/client` only — no server or shared changes. The pass result popup reuses the existing `EventBanner` pattern exactly, replacing one push-button confirmation in `ActionPanel.tsx`.

**Primary recommendation:** Execute in dependency order — BUG-22 doc closure first (zero risk), REPLAY-07/08 code fix second (contained, well-patterned), BUG-23 fix third (speculative but isolated), UX-15 fixes fourth (investigation gates uniform clearing fix), OFFSIDE UAT last (human checkpoint after all code changes are stable).

---

## Architectural Responsibility Map

| Capability                       | Primary Tier                               | Secondary Tier | Rationale                                                                 |
| -------------------------------- | ------------------------------------------ | -------------- | ------------------------------------------------------------------------- |
| Offside UAT verification         | Human/Test                                 | —              | No code change; human player tests live session                           |
| REPLAY ballAfter field           | API/Backend (shared types + server engine) | —              | ActionEvent shape lives in packages/shared; population in packages/server |
| REPLAY_ELIGIBLE_TYPES            | API/Backend (server engine)                | —              | `gameEngine.ts` constant governs replay frame generation                  |
| Replay regression tests          | API/Backend (test layer)                   | —              | `replay.integration.test.ts` in packages/server                           |
| BUG-22 doc closure               | Documentation                              | —              | REQUIREMENTS.md checkbox update only                                      |
| BUG-23 isShotPathTint guard      | Frontend/Client                            | —              | HexGrid.tsx rendering logic                                               |
| BUG-23 shotTargetHighlight clear | Frontend/Client                            | —              | HexGrid.tsx useState lifecycle                                            |
| UX-15 uniform clearing fix       | Frontend/Client                            | —              | App.tsx socket handlers + UniformSelectionScreen.tsx local state          |
| UX-15 player number centering    | Frontend/Client                            | —              | PieceOverlay.tsx SVG text element                                         |
| UX-15 style 12 pattern           | Frontend/Client (shared types)             | —              | uniformStyles.tsx renderer; type defined in packages/shared               |
| UX-15 eligible counter           | Frontend/Client                            | —              | ActionPanel.tsx derived `remaining` calculation                           |
| UX-15 pass result popup          | Frontend/Client                            | —              | ActionPanel.tsx HEADER phase + EventBanner.tsx pattern                    |

---

## Standard Stack

No new packages are installed in this phase. All work uses the existing project stack.

| Layer          | Tool                | Version (confirmed)                  |
| -------------- | ------------------- | ------------------------------------ |
| Test framework | Vitest              | 2.1.9 (packages/server/package.json) |
| Language       | TypeScript          | 5.x (workspace)                      |
| Frontend       | React + Vite        | 18.3.1 / 5.x                         |
| State          | Zustand             | 4.5.7                                |
| Backend        | Express + Socket.io | 4.22.2 / 4.8.3                       |
| Monorepo       | pnpm workspaces     | 9.x                                  |

[VERIFIED: codebase grep] All versions confirmed from `package.json` files in this session.

## Package Legitimacy Audit

No new packages installed. This section is not applicable to Phase 25.

---

## Architecture Patterns

### System Architecture Diagram

```
[Two-tab browser UAT]
        |
        v
[Socket.io client]  <---game:state---  [Socket.io server]
        |                                       |
   [React UI]                            [gameEngine.ts]
   ActionPanel.tsx                       [gameHandlers.ts]
   HexGrid.tsx                           [types.ts (shared)]
   EventBanner.tsx                              |
   PieceOverlay.tsx                    [replay.integration.test.ts]
   UniformSelectionScreen.tsx
```

Data flow for replay fix: `ActionEvent` construction site (gameHandlers.ts / gameEngine.ts) → `ballAfter` field populated → stored in `eventLog` → `buildReplayFrames()` reads `REPLAY_ELIGIBLE_TYPES` → if event type in set AND has `ballAfter` → ball position updated in frame → emitted to client.

### Recommended Project Structure

No structural changes. Existing structure is unchanged.

```
packages/
├── shared/src/types.ts           # ActionEvent union — GK_KICK + LOOSE_BALL_LAND ballAfter fields added here
├── server/src/gameEngine.ts      # REPLAY_ELIGIBLE_TYPES, LOOSE_BALL_LAND construction site
├── server/src/gameHandlers.ts    # GK_KICK construction site
├── server/src/__tests__/         # replay.integration.test.ts — mirror HEADED_PASS/GK_PUNT pattern
└── client/src/
    ├── components/HexGrid.tsx    # isShotPathTint guard + shotTargetHighlight clear
    ├── components/PieceOverlay.tsx  # player number dominantBaseline fix
    ├── components/ActionPanel.tsx   # eligible counter + pass result popup
    ├── components/EventBanner.tsx   # reference for popup pattern
    ├── components/UniformSelectionScreen.tsx  # investigate local state reset
    ├── styles/uniformStyles.tsx  # style 12 patternTransform fix
    └── App.tsx                   # socket handler investigation for uniform clearing
```

### Pattern 1: REPLAY_ELIGIBLE_TYPES Extension (D-06 through D-12)

**What:** Add event type to the replay eligibility set and ensure the event's ActionEvent shape carries `ballAfter`.

**When to use:** Any new action event that moves the ball and should appear in post-game replay.

**Existing precedent from Phase 18.1 (HEADED_PASS / GK_PUNT):**

```typescript
// Source: packages/shared/src/types.ts (confirmed live)
| {
    type: 'HEADED_PASS';
    passerId: string;
    from: HexCoord;
    to: HexCoord;
    timestamp: number;
    ballAfter: { position: HexCoord; carrierId: string | null };
  }
```

```typescript
// Source: packages/server/src/gameEngine.ts (confirmed live, ~line 4364)
// REPLAY-06 (18.1-01): added by quick-task 260621-b8f with ballAfter populated
'HEADED_PASS',
'GK_PUNT',
```

**Fix pattern for REPLAY-07 (GK_KICK):**

```typescript
// packages/shared/src/types.ts — add ballAfter to GK_KICK union member
| {
    type: 'GK_KICK';
    gkId: string;
    targetHex: HexCoord;
    accurate: boolean;
    kickDie: number;
    kickScore: number;
    timestamp: number;
    ballAfter: { position: HexCoord; carrierId: string | null };  // ADD THIS
  }
```

```typescript
// packages/server/src/gameHandlers.ts ~line 812 — populate ballAfter at construction
const kickEvent: ActionEvent = {
  type: 'GK_KICK',
  gkId: gkEndState.gkKickGkId ?? '',
  targetHex,
  accurate,
  kickDie,
  kickScore,
  timestamp: Date.now(),
  // ADD: ballAfter derived from the accurate branch's receiver or null for loose ball
  ballAfter: {
    position: targetHex,
    carrierId: accurate ? (receiver?.id ?? null) : null,
  },
};
```

Note: the `accurate` branch defines `receiver` at line 823; the `inaccurate` branch delivers a loose ball. Both branches share the same `kickEvent` construction before the `if (accurate)` branch — `receiver` must be resolved before `kickEvent` construction, or `ballAfter` must be set conditionally inside each branch. Inspect the actual construction flow to choose the right approach.

**Fix pattern for REPLAY-08 (LOOSE_BALL_LAND):**

```typescript
// packages/shared/src/types.ts — add ballAfter to LOOSE_BALL_LAND union member
| { type: 'LOOSE_BALL_LAND'; from: HexCoord; to: HexCoord; timestamp: number;
    ballAfter: { position: HexCoord; carrierId: string | null };  // ADD THIS
  }
```

```typescript
// packages/server/src/gameEngine.ts ~line 2754 — populate ballAfter at construction
const looseBallLandEvent: ActionEvent = {
  type: 'LOOSE_BALL_LAND',
  from: state.ball.position,
  to: finalPosition,
  timestamp: Date.now(),
  ballAfter: { position: finalPosition, carrierId: finalCarrierId }, // ADD THIS
};
// Note: finalCarrierId is already resolved at this point (~line 2750)
```

**REPLAY_ELIGIBLE_TYPES addition (D-10/D-11):**

```typescript
// packages/server/src/gameEngine.ts ~line 4349
const REPLAY_ELIGIBLE_TYPES = new Set<string>([
  // ... existing entries ...
  'HEADED_PASS',
  'GK_PUNT',
  // REPLAY-07: GK_KICK ball delivery — carries ballAfter (target hex + carrier or null).
  // Excluded prior to Phase 25 due to incorrect "dead code" comment (see commit history).
  'GK_KICK',
  // REPLAY-08: LOOSE_BALL_LAND scatter resolution — carries ballAfter (landing hex + carrier or null).
  'LOOSE_BALL_LAND',
  'KICK_OFF_SETUP',
]);
```

The incorrect comment at ~line 4366 ("GK_KICK is intentionally excluded (dead code, zero construction sites)") must be removed entirely.

### Pattern 2: EventBanner Auto-Dismiss (D-20)

**What:** Replace push-button confirmation with an auto-advancing notification using the existing EventBanner pattern.

**Existing EventBanner implementation:**

```typescript
// Source: packages/client/src/components/EventBanner.tsx (confirmed live)
// Auto-dismiss timing: 1000ms total (100ms in + 800ms hold + 100ms out)
// Triggered by: diff against eventLog tail — useEffect([eventLog]) pattern
// Variants: 'goal' (green) | 'notable' (amber)
```

**D-20 approach:** For the "Accurate Pass!" / "Loose Ball!" notifications, reuse the SAME auto-dismiss mechanism but the trigger is different — it fires when `phase === 'HEADER'` AND `headerAccuracyRollPending === true` (accurate case) OR when `phase === 'LOOSE_BALL'` and the entry came from a HIGH_PASS. The notification must auto-emit `emitHeaderAccuracyAck()` after the dismiss timer fires, rather than waiting for a button click.

Implementation approach:

1. In `ActionPanel.tsx`, when `phase === 'HEADER' && headerAccuracyRollPending && isActivePlayer && myTeam === attackingTeam`: instead of rendering a "Continue" button, render nothing (or a waiting indicator) and use a `useEffect` that fires `emitHeaderAccuracyAck()` after 1500–2000ms.
2. Simultaneously trigger an EventBanner-style popup via a parallel mechanism: add a case to `getBannerMessage()` in `EventBanner.tsx` for `HP_ACCURACY` events — `event.accurate ? 'Accurate Pass!' : 'Loose Ball!'` — so the EventBanner fires automatically when `HP_ACCURACY` is appended to `eventLog`.

Note: The INACCURATE case (`HP_ACCURACY` with `accurate: false`) transitions to LOOSE_BALL which auto-emits `emitRoll()` (ActionPanel.tsx lines 171-176). No button click is needed for the inaccurate case's game-logic advancement. The popup is purely informational.

**Exact text (from D-20 / user specification):**

- Accurate: `"Accurate Pass!"`
- Inaccurate: `"Loose Ball!"`

Auto-dismiss duration: 1.5–2 seconds. Use 1500ms to match the intent (the 1000ms EventBanner auto-dismiss timing was set for brief notifications; 1500ms gives slightly more reading time for this pass-result moment).

### Pattern 3: BUG-23 Phase Guard (D-14)

**Current `isShotPathTint` expression (confirmed live at HexGrid.tsx ~line 422):**

```typescript
const isShotPathTint =
  (phase !== 'KICK_OFF_SETUP' && lastShotPathSet.has(hexId)) ||
  isHpMoveTarget ||
  isGKDiveTarget ||
  isShotPath ||
  highPassContestZoneSet.has(hexId);
```

**Fix 1 — outer guard:**

```typescript
const isShotPathTint =
  phase !== 'KICK_OFF_SETUP' &&
  (lastShotPathSet.has(hexId) ||
    isHpMoveTarget ||
    isGKDiveTarget ||
    isShotPath ||
    highPassContestZoneSet.has(hexId));
```

**Fix 2 — clear shotTargetHighlight on phase transition:**

```typescript
// Add useEffect in HexGrid.tsx
useEffect(() => {
  if (phase === 'KICK_OFF_SETUP') {
    setShotTargetHighlight(null);
  }
}, [phase]);
```

`shotTargetHighlight` is declared at HexGrid.tsx line 135:

```typescript
const [shotTargetHighlight, setShotTargetHighlight] = useState<HexCoord | null>(null);
```

It is currently only SET (at line 497, on shot declaration click) and never cleared. Fix 2 closes the stale-red-tint-on-goal-target-hex issue independently of BUG-23's shot-path shading.

### Pattern 4: Style 12 SVG Pattern Fix (D-18)

**Current (confirmed live in `packages/client/src/styles/uniformStyles.tsx`):**

- `quarterHorizontal` (style 12): uses `patternTransform={`rotate(45 ${cx} ${cy})`}` → produces ✕ (diagonal axes)
- `quarterDiagonal` (style 13): uses no rotation, with `x={cx - R} y={cy - R}` origin offset → produces ╬ (cross axes)

**Expected per D-18:**

- Style 12 (`quarter-horizontal`) → ╬ (cross/plus axes, divided by horizontal+vertical lines)
- Style 13 (`quarter-diagonal`) → ✕ (diagonal axes, divided by diagonal lines = 45° rotation)

**Fix:** Swap the `patternTransform` between the two renderers:

- `quarterHorizontal`: remove `patternTransform`, add `x={cx - R} y={cy - R}` for proper alignment → renders ╬
- `quarterDiagonal`: add `patternTransform={`rotate(45 ${cx} ${cy})`}` and use `x={0} y={0}` alignment → renders ✕

### Pattern 5: Player Number Centering (D-17)

**Current (confirmed live at PieceOverlay.tsx line 254-265):**

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

The `dominantBaseline="central"` attribute should center the text vertically. The observed downward offset could be a browser rendering quirk where `"central"` is not the same as `"middle"`. Fix: switch to `dominantBaseline="middle"` OR keep `"central"` and add `dy="-0.5"` (small upward correction). `"middle"` is more reliably cross-browser for SVG text centering.

### Pattern 6: Eligible Counter on Move Start (D-19)

**Current logic (confirmed live at ActionPanel.tsx ~lines 808-826):**

The `remaining` count is derived from:

- `currentSlotLockedCount` = pieces in `movedPieceIds` that also appear in `paceUsedByPieceId` (locked in current slot)
- `paceExhaustedNotLocked` = pieces with pace exhausted but not yet in `movedPieceIds` (BUG-14 deferred lock)
- `remaining = slotTotal - currentSlotLockedCount - paceExhaustedNotLocked`

**D-19 change:** When a piece is selected (selectedPieceId is non-null) in MOVE phase, it counts as "1 already moving" — the counter should show one fewer remaining. This is purely cosmetic (client display, no server change).

The `selectedPieceId` is available from the Zustand store (`useGameStore((s) => s.selectedPieceId)`). Add it to ActionPanel selectors.

Condition for decrementing: `phase === 'MOVEMENT'` AND `selectedPieceId !== null` AND the selected piece is NOT already in `movedPieceIds` (to avoid double-counting).

Undo behavior: when `emitUndo` is called, the server broadcasts a new state that clears `selectedPieceId` (or the store's selectPiece action clears it client-side). The count restores automatically because `selectedPieceId` goes back to null.

### Pattern 7: Uniform Clearing Bug Investigation (D-16)

**Investigation approach (from D-16 and `<specifics>`):**

1. Read `App.tsx` `onUniformSelectionStart` handler — check if it is called on opponent confirmation, which would call `setScreen('UNIFORM_SELECTION')` again and potentially cause the React component to unmount/remount if the screen was already 'UNIFORM_SELECTION'.

2. Read server-side `UNIFORM_CONFIRM` handler — check what events are emitted to ALL clients vs. just the confirming client. Look for `UNIFORM_SELECTION_START` being re-emitted server-wide.

3. Read `UniformSelectionScreen.tsx` for any `useEffect` that depends on props that change when opponent confirms (e.g. `homePickedTeam`, `homeConfirmedStyle`) and might call `setSelectedTeam(null)` or `setSelectedStyle(null)`.

4. Check if `UniformSelectionScreen` has a `key` prop in App.tsx that changes when opponent confirms — a key change forces full remount and resets all local state.

**Root cause hypothesis:** The most likely culprit is one of:

- The server re-emitting `UNIFORM_SELECTION_START` on home confirm (to signal away player's turn starts) → `onUniformSelectionStart` in `App.tsx` → `setScreen('UNIFORM_SELECTION')` → if already on that screen, React may or may not remount depending on whether React's reconciler considers the component instance stale.
- A `useEffect` in `UniformSelectionScreen` with `homePickedTeam` or `homeConfirmedStyle` as dependency that implicitly resets local state.

**Fix constraint:** The fix must preserve each player's pending selections (`selectedTeam`, `selectedStyle`, `selectedFormation`, `jerseyType`) across the opponent's confirmation event.

### Anti-Patterns to Avoid

- **Bundling REPLAY_ELIGIBLE_TYPES comments:** D-10 explicitly forbids a single shared comment for GK_KICK and LOOSE_BALL_LAND. Phase 18.1's "dead code" mistake happened because the prior comment grouped them. Each type must have its own inline explanation.
- **Null placeholder for ballAfter:** D-09 forbids leaving `ballAfter` as `null` in the construction sites. The field must be populated with the resolved position/carrier at construction time.
- **Double-counting in eligible counter:** The `remaining` derivation must not subtract 1 for `selectedPieceId` when that piece is already in `movedPieceIds` or `paceExhaustedNotLocked`.
- **Auto-emit before popup renders:** For D-20, ensure `emitHeaderAccuracyAck()` fires AFTER the popup has had time to render (i.e., the setTimeout fires at 1500ms, not immediately).
- **Fixing style 12 without verifying style 13:** Swapping one transform without the corresponding swap on the other will make both wrong. Both `quarterHorizontal` and `quarterDiagonal` must be updated together.

---

## Don't Hand-Roll

| Problem                            | Don't Build                       | Use Instead                      | Why                                                                                                |
| ---------------------------------- | --------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Auto-dismiss popup for pass result | Custom timer + CSS                | Existing EventBanner pattern     | Pattern already handles fade-in/hold/fade-out, DOM removal, and multiple concurrent events cleanly |
| SVG text vertical centering        | Custom y-offset calculations      | `dominantBaseline="middle"`      | SVG spec attribute that works cross-browser for baseline alignment                                 |
| Replay frame ball position         | Re-running engine logic from dice | `ballAfter` field on ActionEvent | Deterministic: same approach used for all 12 other REPLAY_ELIGIBLE_TYPES                           |

**Key insight:** Every pattern in Phase 25 has a direct existing precedent in the codebase. HEADED_PASS/GK_PUNT for REPLAY-07/08. EventBanner for D-20. Phase 17 fix for the eligible counter. The work is mechanical application of established patterns, not invention.

---

## Common Pitfalls

### Pitfall 1: GK_KICK ballAfter Requires Resolving receiver Before kickEvent Construction

**What goes wrong:** The current `kickEvent` construction at gameHandlers.ts ~line 812 is shared between the `accurate` and `inaccurate` branches. The `receiver` variable is defined at line 823 inside the `if (accurate)` block. If you add `carrierId: accurate ? receiver?.id ?? null : null` inside the shared `kickEvent` object, TypeScript will complain that `receiver` is used before definition.

**How to avoid:** Either (a) declare `receiver` before the `kickEvent` construction with `const receiver = accurate ? gkEndState.pieces.find(...) : null;`, or (b) construct the `kickEvent` inside each branch separately with the correct `ballAfter`. Option (a) is cleaner and closer to the HEADED_PASS/GK_PUNT pattern in the engine.

**Warning signs:** TypeScript error "Variable 'receiver' is used before being assigned" OR `carrierId` being null when the kick was accurate.

### Pitfall 2: LOOSE_BALL_LAND Construction Site Is in gameEngine.ts, Not gameHandlers.ts

**What goes wrong:** The GK_KICK construction site is in `gameHandlers.ts`. The LOOSE_BALL_LAND construction site is in `gameEngine.ts` (~line 2754 — confirmed). Searching only in `gameHandlers.ts` for both will miss the LOOSE_BALL_LAND site.

**How to avoid:** The canonical reference is `gameEngine.ts ~line 2754`. Check using grep for `'LOOSE_BALL_LAND'` in both files.

### Pitfall 3: Style 12 Fix Must Update Both quarterHorizontal AND quarterDiagonal

**What goes wrong:** Only fixing `quarterHorizontal` (adding no-rotation) without also fixing `quarterDiagonal` (adding rotation) swaps which style is broken but leaves one still wrong.

**How to avoid:** Edit both renderers in the same task. Verify both styles in the uniform selection screen after the fix.

### Pitfall 4: shotTargetHighlight Clear Must Use useEffect with [phase] Dependency

**What goes wrong:** Calling `setShotTargetHighlight(null)` in the render body (outside a useEffect) when `phase === 'KICK_OFF_SETUP'` violates React's rules of hooks and causes "Cannot update a component while rendering a different component" errors.

**How to avoid:** Use `useEffect(() => { if (phase === 'KICK_OFF_SETUP') setShotTargetHighlight(null); }, [phase])`. The EventBanner.tsx file already uses this exact pattern for state updates in effects (lines 59-69).

### Pitfall 5: Uniform Clearing — Fix Without Investigation Will Miss Root Cause

**What goes wrong:** Applying a defensive reset to `selectedTeam`/`selectedStyle` in `UniformSelectionScreen` without identifying WHY the reset happens may fix the symptom while the root cause continues to cause other issues (stale state, double-socket-events, etc.).

**How to avoid:** D-16 mandates an investigation step before fixing. Read the server handler, check what events are emitted on confirm, and trace the socket event path in `App.tsx` before writing any fix.

### Pitfall 6: Pass Result Popup — Both Teams See It, Only Active Team Advances

**What goes wrong:** The HEADER phase with `headerAccuracyRollPending = true` shows a waiting panel to the non-active team (line 382: `return waitingPanel`). If the auto-advance `emitHeaderAccuracyAck()` is placed outside the `isActivePlayer` guard, the non-active player's client would also try to emit it.

**How to avoid:** Keep the `emitHeaderAccuracyAck()` auto-fire inside the same `isActivePlayer && myTeam === attackingTeam` branch where the button currently lives. The popup notification (EventBanner) can show to both teams since it's event-log-driven, but only the attacking player's client emits the ack.

### Pitfall 7: Eligible Counter — selectedPieceId Must Be in Non-moved Piece

**What goes wrong:** Selecting an already-moved piece (inspecting it) in MOVE phase would decrement the counter even though the piece already moved.

**How to avoid:** The condition for the -1 adjustment must be: `selectedPieceId !== null && !movedPieceIds.includes(selectedPieceId) && paceUsedByPieceId[selectedPieceId] === undefined (or 0)`. The piece must be genuinely unmoved in the current slot.

---

## Code Examples

### Verified Pattern: HEADED_PASS replay test (mirror this for GK_KICK)

```typescript
// Source: packages/server/src/__tests__/replay.integration.test.ts ~line 628 (confirmed live)
// Mirror this exact structure for GK_KICK and LOOSE_BALL_LAND

room.gameState = {
  ...room.gameState!,
  eventLog: [
    {
      type: 'GK_KICK', // replace HEADED_PASS with GK_KICK
      gkId: gk.id, // passerId → gkId
      targetHex: kickTarget, // to → targetHex
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
const gkKickFrames = buildReplayFrames(room.gameState);
const gkKickFrame = gkKickFrames.find(
  (f) => f.ball.carrierId === receiver.id && f.ball.position.q === kickTarget.q,
);
expect(gkKickFrame).toBeDefined();
expect(gkKickFrame!.ball).toEqual({ position: kickTarget, carrierId: receiver.id });
```

### Verified Pattern: EventBanner getBannerMessage extension

```typescript
// Source: packages/client/src/components/EventBanner.tsx lines 16-32 (confirmed live)
// Extend with HP_ACCURACY case:

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
  // D-20 (Phase 25): pass accuracy result notification
  if (event.type === 'HP_ACCURACY') {
    return {
      message: event.accurate ? 'Accurate Pass!' : 'Loose Ball!',
      variant: 'notable',
    };
  }
  return null;
}
```

---

## Runtime State Inventory

No rename, refactor, or migration in this phase. This section is omitted.

---

## State of the Art

| Old Approach                                | Current Approach                         | When Changed | Impact                                             |
| ------------------------------------------- | ---------------------------------------- | ------------ | -------------------------------------------------- |
| GK_KICK/LOOSE_BALL_LAND missing from replay | Add to REPLAY_ELIGIBLE_TYPES + ballAfter | Phase 25     | Ball teleports in replay → will now show correctly |
| Pass accuracy: click "Continue" button      | Auto-advancing popup notification        | Phase 25     | Removes unnecessary click from match flow          |
| Eligible counter: updates at move commit    | Updates at piece selection (move start)  | Phase 25     | Matches physical board game activation feel        |
| shotTargetHighlight: never cleared          | Cleared on KICK_OFF_SETUP transition     | Phase 25     | Eliminates stale red tint on prior goal target hex |
| Style 12 pattern: wrong SVG transform       | Correct patternTransform per axis        | Phase 25     | Fixes visual mismatch between style 12 and 13      |

**Deprecated/outdated:**

- The "Continue" button in ActionPanel.tsx HEADER phase (`headerAccuracyRollPending` guard): replaced by auto-advance + popup in D-20.

---

## Assumptions Log

| #   | Claim                                                                                                                            | Section       | Risk if Wrong                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| A1  | The GK_KICK kickEvent construction can be factored so receiver is resolved before kickEvent is built                             | Code Examples | Minor — construction site may need to split into branches instead                  |
| A2  | The uniform clearing bug root cause is an event-flow issue in App.tsx (UNIFORM_SELECTION_START re-emitted or screen state reset) | Pattern 7     | Investigation may reveal a different root cause requiring a different fix strategy |
| A3  | `dominantBaseline="middle"` will fully correct the player number vertical centering across all browsers and zoom levels          | Pattern 5     | May still show slight offset on some browsers; `dy` offset may still be needed     |

---

## Open Questions

1. **GK_KICK ballAfter construction site — single vs. branched**
   - What we know: `kickEvent` is built before the `if (accurate)` branch; `receiver` is only defined inside the accurate branch.
   - What's unclear: Whether the accurate branch's `receiver` needs to be resolved before `kickEvent` construction or can be referenced inside a conditional expression within the shared construction block.
   - Recommendation: Read the precise construction order at gameHandlers.ts lines 804-862 during execution and choose the approach that avoids TypeScript errors. Prefer resolving `receiver` before the `kickEvent` object literal.

2. **Uniform clearing root cause**
   - What we know: When home player confirms uniform selection, away player's in-progress selections are reset. Exact mechanism unknown.
   - What's unclear: Whether the fix is in App.tsx (socket handler), UniformSelectionScreen.tsx (useEffect or key), or server-side (incorrect event emission).
   - Recommendation: Investigation step must precede any fix implementation (D-16 is explicit about this).

3. **Pass result popup auto-advance timing**
   - What we know: D-20 specifies 1.5–2 seconds. EventBanner uses 1000ms.
   - What's unclear: Whether 1500ms or 2000ms feels right during live play.
   - Recommendation: Implement at 1500ms; game feel can be adjusted if playtest feedback requests it.

---

## Environment Availability

This phase is code-and-test only. No new external dependencies.

| Dependency | Required By           | Available                  | Version         | Fallback |
| ---------- | --------------------- | -------------------------- | --------------- | -------- |
| Node.js    | Server tests          | Check via `node --version` | 22 LTS expected | —        |
| pnpm       | Monorepo              | Expected                   | 9.x             | —        |
| Vitest     | Server + client tests | ✓ (in package.json)        | 2.1.9           | —        |

Test commands (confirmed from package.json):

- Server tests: `pnpm --filter @counter-attack/server test` (runs `vitest run`)
- Client tests: `pnpm --filter @counter-attack/client test` (runs `vitest run`)
- All tests: `pnpm test` (runs `-r test`)

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                  |
| ------------------ | ---------------------------------------------------------------------- |
| Framework          | Vitest 2.1.9                                                           |
| Config file        | `packages/server/vitest.config.ts`, `packages/client/vitest.config.ts` |
| Quick run command  | `pnpm --filter @counter-attack/server test`                            |
| Full suite command | `pnpm test`                                                            |

### Phase Requirements → Test Map

| Req ID                    | Behavior                                                  | Test Type           | Automated Command                                                       | Notes                                                             |
| ------------------------- | --------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- |
| OFFSIDE-01                | Offside detection correct across 4 UAT scenarios          | Manual UAT          | N/A — human two-tab session required                                    | Code exists; UAT is the closure mechanism                         |
| OFFSIDE-02                | Free-kick restart correct across 4 UAT scenarios          | Manual UAT          | N/A — human two-tab session required                                    | Code exists; UAT is the closure mechanism                         |
| REPLAY-07                 | GK_KICK produces visible replay frame                     | Integration         | `pnpm --filter @counter-attack/server test replay.integration`          | New test in replay.integration.test.ts — mirrors HEADED_PASS case |
| REPLAY-08                 | LOOSE_BALL_LAND produces visible replay frame             | Integration         | `pnpm --filter @counter-attack/server test replay.integration`          | New test in replay.integration.test.ts — mirrors GK_PUNT case     |
| BUG-22                    | REQUIREMENTS.md checkbox updated                          | Documentation       | N/A — no code to test                                                   | Verified by reading REQUIREMENTS.md                               |
| BUG-23                    | KICK_OFF_SETUP shading clears after SNAPSHOT_DEFLECT goal | Manual UAT + unit   | Two-tab UAT; HexGrid unit test optional                                 | Speculative fix; UAT is the closure gate                          |
| UX-15 (uniform clearing)  | Opponent confirm does not reset own selections            | Manual UAT          | Two-tab session; unit test for socket handler if root cause is isolated | Root cause investigation required first                           |
| UX-15 (player number)     | Jersey number visually centered in piece circle           | Manual visual check | N/A — rendering artifact                                                | Verify across styles and zoom                                     |
| UX-15 (style 12)          | quarter-horizontal renders ╬; quarter-diagonal renders ✕  | Manual visual check | PieceOverlay.test.tsx if snapshot tests exist                           | Verify in uniform selection screen                                |
| UX-15 (eligible counter)  | Counter decrements on piece selection in MOVE phase       | Unit/snapshot       | `pnpm --filter @counter-attack/client test`                             | ActionPanel behavior change                                       |
| UX-15 (pass result popup) | HP_ACCURACY fires EventBanner notification                | Unit                | `pnpm --filter @counter-attack/client test EventBanner`                 | EventBanner.test.tsx has existing HP_ACCURACY-adjacent cases      |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/server test` AND `pnpm --filter @counter-attack/client test`
- **Per wave merge:** `pnpm test` (all packages)
- **Phase gate:** Full suite green + OFFSIDE UAT checkpoints closed before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] New test: `replay.integration.test.ts` — `REPLAY-07: GK_KICK produces visible replay frame` (mirrors HEADED_PASS case from line 628)
- [ ] New test: `replay.integration.test.ts` — `REPLAY-08: LOOSE_BALL_LAND produces visible replay frame` (mirrors GK_PUNT case from line 684)

_(Existing test infrastructure covers ActionPanel and EventBanner; no new test files needed beyond the two replay cases above.)_

---

## Security Domain

This phase adds no authentication, no new API endpoints, no data persistence, no cryptography, and no user-controlled input validation. The ASVS categories below are included for completeness.

| ASVS Category         | Applies                                         | Standard Control |
| --------------------- | ----------------------------------------------- | ---------------- |
| V2 Authentication     | No                                              | —                |
| V3 Session Management | No                                              | —                |
| V4 Access Control     | No                                              | —                |
| V5 Input Validation   | No — existing socket event validation unchanged | —                |
| V6 Cryptography       | No                                              | —                |

No new threat patterns introduced. The `emitHeaderAccuracyAck()` auto-fire (D-20) emits over an existing authenticated Socket.io connection — no change to authorization model.

---

## Sources

### Primary (HIGH confidence)

- Codebase grep + Read tool — `packages/server/src/gameHandlers.ts` lines 780-865 (GK_KICK construction site) [VERIFIED: codebase grep]
- Codebase grep + Read tool — `packages/server/src/gameEngine.ts` lines 2748-2780 (LOOSE_BALL_LAND construction site), lines 4348-4373 (REPLAY_ELIGIBLE_TYPES) [VERIFIED: codebase grep]
- Codebase grep + Read tool — `packages/shared/src/types.ts` lines 289-298 (GK_KICK and LOOSE_BALL_LAND ActionEvent shapes) [VERIFIED: codebase grep]
- Codebase grep + Read tool — `packages/client/src/components/HexGrid.tsx` lines 135, 318-320, 422-427, 497 (isShotPathTint, shotTargetHighlight) [VERIFIED: codebase grep]
- Codebase grep + Read tool — `packages/client/src/components/ActionPanel.tsx` lines 808-833 (eligible remaining), lines 363-383 (HEADER pass accuracy button) [VERIFIED: codebase grep]
- Codebase grep + Read tool — `packages/client/src/components/EventBanner.tsx` lines 16-94 (EventBanner pattern) [VERIFIED: codebase grep]
- Codebase grep + Read tool — `packages/client/src/components/PieceOverlay.tsx` lines 254-266 (player number text element) [VERIFIED: codebase grep]
- Codebase grep + Read tool — `packages/client/src/styles/uniformStyles.tsx` lines 403-452 (quarterHorizontal and quarterDiagonal renderers) [VERIFIED: codebase grep]
- Codebase grep + Read tool — `packages/server/src/__tests__/replay.integration.test.ts` lines 628-719 (HEADED_PASS/GK_PUNT test pattern) [VERIFIED: codebase grep]
- Codebase grep + Read tool — `packages/client/src/App.tsx` lines 40-242 (socket handlers, UniformSelectionScreen render) [VERIFIED: codebase grep]
- `25-CONTEXT.md` — decisions D-01 through D-20, canonical references, code insights [VERIFIED: codebase read]
- `.planning/todos/pending/2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — full BUG-23 static analysis [VERIFIED: codebase read]
- `.planning/phases/17-rule-bugs/17-CONTEXT.md` — D-21 through D-59 offside/free-kick implementation decisions [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)

- None needed for this phase — all research was conducted against the live codebase.

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**

- REPLAY-07/08 fix: HIGH — exact touch points identified, construction sites confirmed, test pattern confirmed from existing analogous tests
- BUG-23 fix: MEDIUM — fix is speculative (root cause unknown); two belt-and-suspenders measures identified but UAT is the closure gate
- UX-15 bug fixes (player number, style 12): HIGH — exact code locations confirmed, fix approach established from SVG standards
- UX-15 uniform clearing: MEDIUM — investigation required; root cause unconfirmed; fix approach depends on investigation outcome
- UX-15 UX changes (eligible counter, pass result popup): HIGH — exact implementation approach confirmed from existing patterns
- OFFSIDE UAT: HIGH — code is live; UAT scenarios are specified in D-02; human execution is the only remaining step
- BUG-22 doc closure: HIGH — fix confirmed live at gameHandlers.ts:405

**Research date:** 2026-07-10
**Valid until:** 2026-08-10 (stable codebase; patterns won't change unless Phase 26 work begins)
