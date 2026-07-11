---
phase: 25-bug-uat-closure
plan: 04
subsystem: ui
tags: [zustand, react, game-state, header-phase, bug-fix]

# Dependency graph
requires:
  - phase: 24-auto-assignment-lineup
    provides: game state broadcast infrastructure (setGameState handler in useGameStore.ts)
provides:
  - Root cause of UX-15 headerContestantIds clearing confirmed at file+line+mechanism level
  - Fix target: useGameStore.ts line 703 — headerContestantIds reset guarded by phaseChanged
affects: [25-bug-uat-closure plan 05 UAT checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Phase-change guard pattern: use phaseChanged (already computed at line 676) to gate state resets that should only fire on genuine phase transitions, not on in-phase broadcasts'

key-files:
  created: []
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/components/HexGrid.tsx

key-decisions:
  - 'Root cause confirmed: prevSelectedId === null condition in setGameState handler fires on every in-HEADER broadcast because toggleHeaderContestantId never sets selectedPieceId'
  - 'Fix scoped to one line: headerContestantIds: phaseChanged ? [] : prev.headerContestantIds at useGameStore.ts line 703'
  - 'No changes to other reset fields (selectedPieceId, validMoveHexes, passTargetHex, shootingMode) — those resets on prevSelectedId===null may be correct for other phases'

patterns-established:
  - 'Phase-guard pattern: phaseChanged already computed in setGameState — reference it when gating state resets that must survive same-phase broadcasts'

requirements-completed: [UX-15]

# Metrics
duration: ~35min
completed: 2026-07-11
---

# Phase 25 Plan 04: UX-15 headerContestantIds Clearing Bug Summary

**Root cause confirmed: useGameStore.ts setGameState handler clears headerContestantIds on every in-HEADER broadcast because prevSelectedId===null is always true in HEADER phase (toggleHeaderContestantId never sets selectedPieceId)**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-11
- **Completed:** 2026-07-11
- **Tasks:** 2 of 2 complete
- **Files modified:** 1

## Accomplishments

- Confirmed the root cause of UX-15 at file + line + mechanism level — the plan's suspected mechanism is exactly correct
- Identified the two-file chain: HexGrid.tsx (why selectedPieceId stays null) → useGameStore.ts (why null triggers the reset and why headerContestantIds is cleared)
- Applied the minimal one-line fix: `headerContestantIds: phaseChanged ? [] : prev.headerContestantIds`
- All 303 client tests pass; `tsc --noEmit` clean

## Task Commits

1. **Task 1: Confirm root cause** — `23f081f` (docs — investigation + SUMMARY)
2. **Task 2: Fix useGameStore state-update handler** — `8cd911e` (fix)

## Files Created/Modified

- `packages/client/src/store/useGameStore.ts` — line 703: guard `headerContestantIds` reset with `phaseChanged` so in-HEADER broadcasts no longer clear pending contestant selections

## Root Cause Finding (Task 1 Checkpoint)

### Confirmed Mechanism

The plan's suspected mechanism is confirmed exactly as described.

**Chain:**

**Step 1 — HexGrid.tsx lines 817-820: contestant selection never sets selectedPieceId**

```typescript
: isHeaderEligible
  ? () => {
      toggleHeaderContestantId(piece.id);
    }
```

When a player clicks an eligible piece during HEADER phase, the handler calls `toggleHeaderContestantId(piece.id)`. It does NOT call `selectPiece()`. As a result, `selectedPieceId` remains `null` throughout the entire HEADER contestant-selection flow.

**Step 2 — useGameStore.ts lines 647-651: prevSelectedId is null in HEADER phase**

```typescript
const prev = get();
const prevState = prev.gameState;
const prevSelectedId = prev.selectedPieceId ?? prev.lastMovedPieceId;
```

Since `selectedPieceId` is never set during HEADER contestant selection, and `lastMovedPieceId` is also null (no movement action has occurred), `prevSelectedId` evaluates to `null`.

**Step 3 — useGameStore.ts line 688: prevSelectedId===null always triggers the reset block**

```typescript
if (
  responseMoveStateChanged ||
  responseMovePaceExhausted ||
  phaseChanged ||
  !pieceStillExists ||
  prevSelectedId === null ||   // always true in HEADER phase
  activationComplete
) {
```

`prevSelectedId === null` is `true` on every call during HEADER phase. The `||` short-circuits to `true`, entering the reset block unconditionally on every server broadcast.

**Step 4 — useGameStore.ts line 703: headerContestantIds reset unconditionally inside the block**

```typescript
set({
  gameState: newState,
  selectedPieceId: null,
  validMoveHexes: [],
  ...
  headerContestantIds: [],   // line 703 — cleared on every broadcast during HEADER
  ...
});
```

`headerContestantIds` is reset to `[]` every time the reset block fires. During HEADER phase, this means every server broadcast — including Player A's confirmation broadcast — wipes Player B's pending contestant selection.

### Triggering Event

When Player A confirms their header contestant selection, the server broadcasts an updated `GameState` with `headerConfirmed[A's team] = true`. This broadcast arrives on Player B's client, invokes `setGameState(newState)` in `useGameStore.ts`, `prevSelectedId` is null, the reset block fires, `headerContestantIds: []` clears Player B's pending selection.

### Fix Target for Task 2

**File:** `packages/client/src/store/useGameStore.ts`
**Line:** 703
**Change:**

```typescript
// Before (line 703):
headerContestantIds: [],

// After:
headerContestantIds: phaseChanged ? [] : prev.headerContestantIds,
```

`phaseChanged` is already computed at line 676 (`const phaseChanged = newState.phase !== prevState.phase`). `prev = get()` is already assigned at line 647. This preserves `headerContestantIds` when the phase stays HEADER (in-phase broadcasts, e.g. Player A confirming) and still clears it when the phase genuinely transitions away from HEADER.

No other reset fields need changes.

## Decisions Made

- Confirmed the plan's hypothesis is exactly correct — no alternative mechanism found
- Fix is one line and does not touch other reset fields (selectedPieceId, validMoveHexes, passTargetHex, shootingMode) whose reset-on-null behavior may be intentional for other phases
- `prev.headerContestantIds` (using the `prev = get()` snapshot already at line 647) is the correct reference — no new `get()` call needed, no change to the `set()` call form

## Deviations from Plan

None - investigation found the exact mechanism described in the plan. No code changes made in Task 1 (investigation-only as required by the checkpoint).

## Issues Encountered

None.

## Next Phase Readiness

- Fix shipped: `headerContestantIds` now survives in-HEADER state broadcasts
- Plan 05 UAT checkpoint will do two-tab confirmation of the fix
- No other files touched; no scope creep

---

_Phase: 25-bug-uat-closure_
_Completed: 2026-07-11_
