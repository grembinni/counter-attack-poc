---
phase: 35-actionpanel-log-standardization
reviewed: 2026-07-27T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - packages/client/src/components/ActionLog.module.css
  - packages/client/src/components/ActionLog.test.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.module.css
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/FreeKickSetupPanel.module.css
  - packages/client/src/components/FreeKickSetupPanel.test.tsx
  - packages/client/src/components/FreeKickSetupPanel.tsx
  - packages/client/src/components/GameBoard.module.css
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/KickOffSetupPanel.test.tsx
  - packages/client/src/components/KickOffSetupPanel.tsx
  - packages/client/src/components/ReplayPanel.module.css
  - packages/client/src/components/ReplayPanel.tsx
  - packages/client/src/utils/ctaColorClass.test.ts
  - packages/client/src/utils/ctaColorClass.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-07-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the ActionPanel/ActionLog standardization phase: `ActionLog.tsx` (event-log
formatting/consolidation), `ActionPanel.tsx` (phase-gated action controls), the two
sibling setup panels (`KickOffSetupPanel.tsx`, `FreeKickSetupPanel.tsx`), `ReplayPanel.tsx`,
the new shared `ctaColorClass.ts` helper, plus each file's CSS module and test suite.
`GameBoard.tsx` itself was not in the reviewed file set (only its `.test.tsx` and
`.module.css` were provided), so cross-checks against that component's actual JSX/CSS
class usage could not be performed.

No security vulnerabilities, injection risks, or crash-causing defects were found. The
`ctaColorClass` extraction is clean, pure, and well-tested. However, several logic
inconsistencies and dead-code paths were found in `ActionPanel.tsx` and
`KickOffSetupPanel.tsx` that indicate the refactor didn't fully reconcile some
render-vs-computation invariants, plus a dead/unused field in `ActionLog.tsx` and
duplicated confirm-dialog logic across two panels that the same phase's `ctaColorClass`
extraction pattern should have caught.

## Warnings

### WR-01: `isGoal` field computed on every `formatEvent` branch but never consumed

**File:** `packages/client/src/components/ActionLog.tsx:309-314, 448, 888`
**Issue:** `Formatted.isGoal` is set explicitly on all ~35 branches of `formatEvent`
(including the `GOAL` case at line 448, whose inline comment — `// was false — GOAL
events must return true` — documents a past fix specifically to make this field
correct). But the only call site, line 888, destructures just `{ prefix, prefixColor,
content }` and never reads `isGoal`. `Formatted`/`formatEvent`/`consolidateEvents` are
module-private (not exported), so no other file can consume it either. The field is
fully dead: it never affects rendering (no goal-flash class, no distinct styling), so
whatever visual differentiation this "was false → true" fix was meant to enable does
not actually happen for GOAL entries in the action log today.
**Fix:** Either wire `isGoal` into the render (e.g. an extra CSS class on `.entry` for
goal rows) or remove the field and the per-branch `isGoal: false/true` boilerplate
entirely:

```tsx
const { prefix, prefixColor, content, isGoal } = formatEvent(item.event, item.subKind);
return (
  <div className={`${styles.entry} ${isGoal ? styles.goalEntry : ''}`} key={index}>
    ...
```

### WR-02: `actionCount` (wide-layout trigger) doesn't mirror the kick-off button gating it's supposed to count

**File:** `packages/client/src/components/ActionPanel.tsx:703-732`
**Issue:** During `KICK_OFF`, the rendered "Move" button is suppressed
(`!isKickOff && eligible.has('MOVEMENT') && (...)`, line 746), matching the MATCH-07
rule that only Standard Pass is legal at kick-off. But the `actionCount` array used to
decide `PanelShell wide={actionCount >= 5}` counts `eligible.has('MOVEMENT')` (line 725)
and `eligible.has('STANDARD_PASS')` (line 726) **without** the `!isKickOff` guard that
every other entry in the same array has (lines 727-731). Since `ELIGIBLE_NEXT_ACTIONS.MOVEMENT_PHASE`
includes `MOVEMENT`, during `KICK_OFF` this array counts 2 "eligible" actions
(`MOVEMENT` + `STANDARD_PASS`) even though only 1 button (Standard Pass) is actually
rendered. It doesn't currently flip the `wide` layout (threshold is 5), but it's an
inconsistent computation that will silently miscalculate the moment `MOVEMENT_PHASE`'s
eligible set grows, or if the kick-off gating logic changes independently of this array.
**Fix:** Gate the `MOVEMENT` entry the same way as the rendered button:

```ts
const actionCount = [
  !isKickOff && eligible.has('MOVEMENT'),
  eligible.has('STANDARD_PASS'),
  !isKickOff && eligible.has('FIRST_TIME_PASS'),
  ...
```

### WR-03: `canUndo`'s phase→event-type mapping includes two phases that never render an Undo button

**File:** `packages/client/src/components/ActionPanel.tsx:276-286, 395-422, 605-629`
**Issue:** `canUndo`'s `moveTypeForPhase` ternary (lines 276-285) explicitly maps
`GK_KICK_MOVE` → `'GK_KICK_MOVE'` and `SNAPSHOT_DEFLECT` → `'SNAP_DEFLECT_MOVE'`
(comment: "BUG-18 (Phase 18.3): extended to match the server's expanded
validUndoPhases"). But `canUndo` is only ever read at three call sites — lines 310
(`HIGH_PASS_MOVE`), 350 (`FIRST_TIME_PASS_MOVE`), and 902 (`MOVE`). Neither the
`SNAPSHOT_DEFLECT` block (lines 395-422) nor the `GK_KICK_MOVE` block (lines 605-629)
renders an Undo button at all — both only render a `Confirm` button. This means either:
(a) the `moveTypeForPhase` branches for these two phases are dead code left over from a
prior refactor, or (b) these phases are missing an intended Undo control, meaning a
player who repositions the wrong piece during the single-slot GK_KICK_MOVE/
SNAPSHOT_DEFLECT window has no way to correct it before clicking Confirm.
**Fix:** If Undo should exist for these phases, add the button (mirroring the
`HIGH_PASS_MOVE`/`FIRST_TIME_PASS_MOVE` pattern); if not, delete the two dead branches
from `moveTypeForPhase` to avoid implying a capability that doesn't exist.

### WR-04: `KickOffSetupPanel`'s disabled-button tooltip doesn't reflect which constraint actually failed for the attacking team

**File:** `packages/client/src/components/KickOffSetupPanel.tsx:76-84, 131-138`
**Issue:** `constraintsMet = centreHexOccupied && placementValid` (line 79) combines two
independent constraints for the attacking team. `disabledTitle` (lines 82-84), however,
is chosen solely by `isAttacking`, not by which constraint is actually unmet:

```ts
const disabledTitle = isAttacking
  ? 'Place a player on the centre hex first'
  : 'Move all players to your own half outside the centre circle';
```

If the attacking team's centre hex IS occupied but one or more pieces are simply out of
their zone (`placementValid === false`), the Confirm button is correctly disabled, but
its `title` tooltip (line 134: `title={!constraintsMet ? disabledTitle : undefined}`)
still reads "Place a player on the centre hex first" — an incorrect/misleading message,
since the centre hex requirement is already satisfied and the real problem is
placement. The two on-panel status rows (lines 96-112) do show the correct per-
constraint state, so this is a secondary/tooltip-only defect, but it's still a provably
wrong string shown to the user.
**Fix:** Derive the title from the actual failing constraint:

```ts
const disabledTitle = !centreHexOccupied
  ? 'Place a player on the centre hex first'
  : 'Move all players to your own half outside the centre circle';
```

### WR-05: `KickOffSetupPanel`'s "confirmed" state is local-only and desyncs from server truth on remount/reconnect

**File:** `packages/client/src/components/KickOffSetupPanel.tsx:25, 86-89, 119-140`
**Issue:** `localReady` (line 25) is the sole source of truth for showing the
"Confirmed"/disabled button and the "Waiting for the opponent…" text (lines 119-140).
It is plain `useState(false)` local component state — the server tracks readiness in
`room.readyPlayers` (`gameHandlers.ts`), which is never included in the broadcast
`GameState` sent to clients. If this component remounts after the player has already
confirmed (e.g. a socket reconnect that causes `GameBoard`/`ActionPanel`'s tree to
reconstruct, or a manual page refresh while both players haven't yet confirmed), the
player would see the enabled "Confirm" button again instead of "Confirmed" — even
though the server has already recorded their readiness. Clicking Confirm again is
harmless (`room.readyPlayers` is a `Set`), but the UI misrepresents the actual state to
the player in that window.
**Fix:** Surface per-team readiness in `GameState` (similar to `headerConfirmed` for the
HEADER phase) so `localReady` can be derived from server state rather than tracked as
transient local state that doesn't survive a remount.

## Info

### IN-01: Duplicated confirm-dialog/`withEndTurnConfirm` implementation across two panels

**File:** `packages/client/src/components/ActionPanel.tsx:171-205` and `packages/client/src/components/FreeKickSetupPanel.tsx:123-157`
**Issue:** `withEndTurnConfirm` and the entire confirm-dialog JSX (overlay + card +
Cancel/"Yes, end turn" buttons) are duplicated near-verbatim between these two files.
This same phase already extracted the shared color-state logic into
`ctaColorClass.ts` specifically to eliminate "two divergent implementations" (per that
file's own doc comment) — the same rationale applies here, but the confirm-dialog
logic wasn't extracted alongside it, leaving future edits (e.g. wording changes) at
risk of only being applied to one of the two copies.
**Fix:** Extract a shared `useEndTurnConfirm()` hook (or a `<ConfirmEndTurnDialog>`
component) that both panels consume, mirroring the `ctaColorClass` extraction.

### IN-02: Unsafe type assertion in `isEligible` bypasses compile-time checking

**File:** `packages/client/src/components/ActionPanel.tsx:208-212`
**Issue:**

```ts
const isEligible = (action: string): boolean => {
  const effectiveLast = lastActionType ?? 'MOVEMENT_PHASE';
  const eligible = ELIGIBLE_NEXT_ACTIONS[effectiveLast];
  return eligible?.has(action as Parameters<typeof eligible.has>[0]) ?? false;
};
```

`action` is typed as a bare `string`, then force-cast to `NextActionType` via
`Parameters<typeof eligible.has>[0]`. This is only ever called with the literal
`'SNAPSHOT'` today, but the loose `string` parameter means a future typo'd call (e.g.
`isEligible('SNAPSHTO')`) would compile cleanly and just silently return `false` at
runtime instead of failing the build.
**Fix:** Type the parameter as `NextActionType` directly:

```ts
const isEligible = (action: NextActionType): boolean => { ... }
```

### IN-03: Array index used as React `key` in `ActionLog`'s render list

**File:** `packages/client/src/components/ActionLog.tsx:871, 890`
**Issue:** Both branches of the `recent.map((item, index) => ...)` render use
`key={index}`. Since `recent` is a freshly reversed-and-sliced array recomputed on
every render (not a stable per-item identity), this is a well-known React anti-pattern:
if items are ever inserted/reordered outside of the current append-only pattern, keys
would silently attach to the wrong DOM nodes. Currently harmless because the log is
append-only and the whole list re-renders every time, but it's fragile as written.
**Fix:** Derive a stable key from the underlying event, e.g.
`key={item.kind === 'move_group' ? item.groupKey : `${item.event.timestamp}-${item.subKind ?? ''}`}`.

---

_Reviewed: 2026-07-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
