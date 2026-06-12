---
phase: 13-layout-clock
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameBoard.module.css
  - packages/client/src/components/ConnectionStatus.module.css
  - packages/client/src/App.tsx
  - packages/client/src/store/useGameStore.ts
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-06-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 13 replaced the old sidebar/header layout with a single 80px CSS Grid top band, absorbed `TurnIndicator`, `HalfTimeScreen`, and `FullTimeScreen` into `GameBoard.tsx` as inline sections/overlays, and simplified the `Screen` enum. The structural changes are broadly correct and the key acceptance tests (CLOCK-01, CLOCK-02, LAYOUT-01, LAYOUT-02) align with the implementation. However, several defects were found:

- One **critical** bug: the `canStart` half-time gate is inverted, meaning the wrong player (the one who kicked off the first half) can start the second half — exactly the opposite of the game rule.
- Five **warnings** covering a stale-selection regression, a CSS layout breakage when the log is expanded, type-safety gaps, a test assertion that can produce false positives, and unused state that will never clear.
- Three **info** items for minor code quality issues.

---

## Critical Issues

### CR-01: Half-time "Start 2nd Half" gate is inverted — wrong player can press the button

**File:** `packages/client/src/components/GameBoard.tsx:110`

**Issue:** The `canStart` derivation reads:

```tsx
const canStart = myTeam !== null && myTeam !== kickOffTeam;
```

`kickOffTeam` is the team that kicked off in the **first half** (preserved in `GameState.kickOffTeam`). The second-half kick-off goes to the **other** team. The UI-SPEC comment on line 265 says "Only the 2nd half kick-off team can start." The 2nd half kick-off team is `secondHalfKickOffTeam` (derived two lines below as the opposite of `kickOffTeam`). So `canStart` should be:

```tsx
const canStart = myTeam !== null && myTeam === secondHalfKickOffTeam;
```

With the current code, the player whose team kicked off the first half gets an **enabled** button, while the player who should start the second half gets a **disabled** button. This directly breaks the HALF_TIME flow: the wrong player presses "Start 2nd Half", which emits `game:half-time-start` and the server may reject it, or — if server-side validation is also wrong — proceed with an incorrect kick-off assignment. Either way the game is broken at half time.

**Fix:**

```tsx
// BEFORE (line 110):
const canStart = myTeam !== null && myTeam !== kickOffTeam;

// AFTER:
const canStart = myTeam !== null && myTeam === secondHalfKickOffTeam;
```

Note: `secondHalfKickOffTeam` is already computed on line 111; reorder derivations so it is available before `canStart` if needed, or inline `kickOffTeam === 'home' ? 'away' : 'home'` directly.

---

## Warnings

### WR-01: Log toggle breaks CSS Grid layout — `logExpanded` (240px) is not a tracked grid column

**File:** `packages/client/src/components/GameBoard.tsx:190-213` / `packages/client/src/components/GameBoard.module.css:14`

**Issue:** The `.topBand` grid defines six fixed tracks:

```css
grid-template-columns: 56px 1fr 1fr 1fr auto 56px;
```

Column 5 is `auto`, which accommodates the collapsed log (32px `.logCollapsed`). When `logExpanded` is true the component renders `.logExpanded` (240px) in that same `auto` track. Because the `1fr` columns have already divided available space, the `auto` column simply expands to 240px, **pushing the away score column (56px) further right and potentially overflowing the viewport** if the three `1fr` columns are already at their minimum content size. On narrow screens (< ~700px) this will clip or overflow the top band.

More importantly, the `auto` column's expansion steals space from `1fr` columns — the centre section, player card, and action panel will each shrink unpredictably. There is no `min-width` on `.topBandSection` or `overflow: hidden` guard, so content in those sections can wrap or clip silently.

**Fix:** Replace `auto` with a fixed-width column that matches the widest state of the log slot, then hide/show the log's content within that fixed width:

```css
/* Option A: fixed 240px column, collapse content inside */
grid-template-columns: 56px 1fr 1fr 1fr 240px 56px;

/* In JSX, always render the log slot div; control content display with state */
```

Or cap the collapsed icon at `32px` and the expanded panel at `240px` using `width` + `overflow: hidden` on a wrapper set to `width: 240px` always, making the `auto` track stable:

```css
/* Option B: always 240px column, inner .logCollapsed centers its chevron */
grid-template-columns: 56px 1fr 1fr 1fr 240px 56px;
```

Either way, the `auto` column that changes size based on component state is a layout instability.

---

### WR-02: Stale `selectedPieceId` not cleared when transitioning to KICK_OFF_SETUP from MOVEMENT

**File:** `packages/client/src/store/useGameStore.ts:451-485`

**Issue:** `setGameState` retains selection when `slotChanged` and `phaseChanged` are both false. When the server broadcasts a KICK_OFF_SETUP state from a prior MOVEMENT state, `phaseChanged` will be true and selection is correctly cleared. However, `setGameState` is also called during KICK_OFF_SETUP itself for each `emitKickOffMove` server echo. Inside that inner path the code falls through to the sticky-selection branch (lines 488+) and re-runs `validateMove` against a piece — but the KICK_OFF_SETUP phase is not handled in the sticky-selection path. The code reaches the generic `validateMove` call (line 526-530) which will try to validate movement in MOVEMENT-phase logic. The result is that stale `validMoveHexes` from a previous selection in MOVEMENT phase may persist into KICK_OFF_SETUP if the same piece ID is selected.

More specifically: if `prevSelectedId` is non-null, `pieceStillExists` is true, `slotChanged` is false (KICK_OFF_SETUP has `movementSlot: null`), and `phaseChanged` is false (phase stayed KICK_OFF_SETUP through successive broadcasts), the code calls `validateMove(newState, piece, hex)` using MOVEMENT rules. This is incorrect for KICK_OFF_SETUP and will yield the wrong `validMoveHexes` for the persistent selection.

**Fix:** Add KICK_OFF_SETUP to the phase-specific guard block in `setGameState` (after line 492), or unconditionally clear selection when `newState.phase === 'KICK_OFF_SETUP'` unless `selectPiece` has just been called. The simplest safe fix is to include `KICK_OFF_SETUP` in the `phaseChanged` clear path by also checking `newState.phase`:

```ts
// Add to the clear-selection condition (line 459):
const isSpecialPhase =
  newState.phase === 'KICK_OFF_SETUP' ||
  newState.phase === 'GK_KICK_MOVEMENT';
if (slotChanged || phaseChanged || !pieceStillExists || prevSelectedId === null || activationComplete || isSpecialPhase) {
```

This ensures the sticky path is never reached for phases that have their own selection logic in `selectPiece`.

---

### WR-03: `useGameStore` initial state ships `mockMovementState` — will populate real game sessions with fake player data

**File:** `packages/client/src/store/useGameStore.ts:156`

**Issue:**

```ts
export const useGameStore = create<GameStore>()((set, get) => ({
  gameState: mockMovementState,
  ...
```

The store is initialised with `mockMovementState` (11 home + 11 away players at hardcoded positions, `roomCode: 'MOCK1'`). In a real production session the user is routed to `LobbyScreen` initially (`screen: 'LANDING'`), so `GameBoard` is not rendered. But if a returning user has a stale `sessionStorage` token and the socket reconnects, `onRoomJoined` sets the screen to `'WAITING'` and `onGameState` sets it to `'GAME_BOARD'`, potentially rendering the game board with mock data for a moment before the real `GAME_STATE` event arrives. More critically, any component that reads `gameState` outside of the `GAME_BOARD` screen route (e.g., during initial connection) will silently operate on mock data.

This is also a code quality risk: it becomes impossible to distinguish "game hasn't started" from "game started with mock positions" without reading the roomCode sentinel `'MOCK1'`. There is no guard in `GameBoard` or `App` that checks whether the current game state is the mock default before rendering game-critical derived values (score, phase, pieces).

**Fix:** Initialize `gameState` with a proper null/empty sentinel, or type the store field as `GameState | null` and guard all consumers. At minimum, replace the mock with a structurally valid but clearly uninitialized state (e.g., empty pieces array, `roomCode: ''`, `phase: 'LOBBY'`).

---

### WR-04: Test CLOCK-01 regex for `actionCount: 0` does not correctly gate the format

**File:** `packages/client/src/components/GameBoard.test.tsx:58-63`

**Issue:** The test uses `screen.getByText(/0?0:00/)`. This regex matches any text node containing any string that has zero or one leading `0` before `:00`. The pattern `/0?0:00/` is satisfied by `"00:00"` (correct) but also by `"10:00"`, `"20:00"`, `"30:00"` etc., because `0?` just makes the first zero optional — it does not anchor to the start of the match. If any other element on the page contains a string matching this loose pattern (e.g., the score `0` combined with `:00` somewhere in the DOM via a text join), the test could incorrectly pass.

The comment acknowledges variance between `"0:00"` and `"00:00"`, but the correct pattern to match exactly either form is `/^0?0:00$/` (with anchors), or the test should assert the exact rendered string from the formula `String(0).padStart(2,'0') + ':00'` = `"00:00"`:

```ts
// More precise assertion:
expect(screen.getByText('00:00')).toBeDefined();
```

**Fix:** Replace the permissive regex with either an exact string match `'00:00'` (since `padStart(2,'0')` on `0` always yields `'00'`) or a properly anchored pattern.

---

### WR-05: `gameError` in the store is never cleared for non-phase-change server broadcasts

**File:** `packages/client/src/store/useGameStore.ts:482`

**Issue:** The comment on line 482 reads "Bug 1: stale GAME_ERROR from a prior action must not bleed into the new phase/slot." The fix correctly clears `gameError: null` in the phase/slot-change branch. However, in the **sticky-selection path** (lines 536-542), `gameError` is never cleared. If a player performs an invalid action (server emits `game:error`), the `gameError` is set. If the next server broadcast is a same-phase, same-slot update (e.g., an opponent moves a piece), `setGameState` takes the sticky path and `gameError` remains set indefinitely.

The `KickOffSetupPanel` renders `{gameError && <span ...>{gameError}</span>}` directly from the store (KickOffSetupPanel.tsx:18), so a stale game error from a previous failed action will continue to be shown to the player even after a successful subsequent action, until the phase changes.

**Fix:** Clear `gameError` in the sticky-selection `set()` call as well:

```ts
// Lines 536-542 — add gameError: null
set({
  gameState: newState,
  selectedPieceId: prevSelectedId,
  validMoveHexes: stickyValid,
  tackleRiskHexes: stickyTackle,
  lastMovedPieceId: null,
  gameError: null, // add this
});
```

Apply the same fix to the HIGH_PASS_MOVEMENT / GK_KICK_MOVEMENT sticky path (lines 516-523).

---

## Info

### IN-01: `PHASE_LABEL` for `REPLAY` is defined but conditionally suppressed in JSX — silent inconsistency

**File:** `packages/client/src/components/GameBoard.tsx:35` and `143`

**Issue:** `PHASE_LABEL['REPLAY']` is set to `'REPLAY'` in the constant. In the JSX render, the phase label is conditionally hidden for REPLAY:

```tsx
{
  phaseLabel && phase !== 'REPLAY' && <span className={styles.phaseLabel}>&nbsp;{phaseLabel}</span>;
}
```

This is functionally correct (ReplayPanel is rendered instead), but the `PHASE_LABEL` entry for `REPLAY` is misleading dead data. A future developer may not realise it is intentionally suppressed. Either remove the `REPLAY` entry from the `PHASE_LABEL` record (and update the `Record<GamePhase, string>` type to allow omission via `Partial<>`), or add a comment explaining the suppression.

---

### IN-02: Inline hex color literals duplicated across JSX and CSS — no single source of truth

**File:** `packages/client/src/components/GameBoard.tsx:128-131`, `219-222`, `113`, `119`

**Issue:** Colors `#1a56b0` (home blue) and `#c0392b` (away red) appear as inline `style` props in the JSX (e.g., `style={{ color: '#1a56b0' }}`) while the same colors are also hardcoded in `GameBoard.module.css` (e.g., `.overlayCtaButton` background). If the team color tokens change, both JSX and CSS files must be updated independently. The 13-PATTERNS.md defines these as named design tokens but they are never declared as CSS custom properties.

**Fix:** Declare CSS custom properties at the root and reference them throughout:

```css
/* In a global stylesheet or :root */
:root {
  --color-home: #1a56b0;
  --color-away: #c0392b;
  --color-accent-gold: #f5c518;
}
```

---

### IN-03: `App.tsx` calls `useGameStore.getState()` inside a `useEffect` — pattern inconsistency

**File:** `packages/client/src/App.tsx:29`

**Issue:**

```ts
const s = useGameStore.getState().screen;
if (s !== 'GAME_BOARD') setScreen('GAME_BOARD');
```

`useGameStore.getState()` is the Zustand escape hatch for reading state outside of React's render cycle. Inside a `useEffect` that already has access to the reactive `screen` variable (subscribed at line 11), this call is redundant and inconsistent. The `screen` variable captured in the effect closure will be stale if `onGameState` fires more than once without the effect re-running (the effect has an empty dep array `[]`). However, the escape hatch `getState()` reads fresh state, which is why the author uses it — but this pattern is fragile and undocumented.

The same pattern exists in `onRoomJoined` (line 43). While not immediately broken (Zustand's `getState()` is synchronous and always returns current state), the inconsistency — subscribing to `screen` reactively at the top but reading it imperatively inside the effect — can confuse future readers and hides the fact that the closure-captured `screen` is stale.

**Fix:** Either remove the reactive `screen` subscription from line 11 (since it is only used for routing) and rely entirely on `getState()`, or add `screen` to the effect's dependency array and use the reactive value:

```ts
// Option: depend on screen so the effect re-runs if screen changes externally
}, [screen]);
```

Note: adding `screen` to deps would cause the effect to re-register socket listeners on screen changes — refactor by splitting the listener setup into a separate effect with `[]` deps and keeping the screen-check logic separate.

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
