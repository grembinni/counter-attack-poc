---
phase: 35-actionpanel-log-standardization
reviewed: 2026-07-27T00:00:00Z
depth: standard
files_reviewed: 18
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
  - packages/client/src/components/KickOffSetupPanel.module.css
  - packages/client/src/components/KickOffSetupPanel.test.tsx
  - packages/client/src/components/KickOffSetupPanel.tsx
  - packages/client/src/components/ReplayPanel.module.css
  - packages/client/src/components/ReplayPanel.tsx
  - packages/client/src/utils/ctaColorClass.test.ts
  - packages/client/src/utils/ctaColorClass.ts
findings:
  critical: 0
  warning: 10
  info: 3
  total: 13
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-07-27
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the ActionPanel/ActionLog standardization set (`ActionLog`, `ActionPanel`,
`FreeKickSetupPanel`, `KickOffSetupPanel`, `ReplayPanel`, the shared `ctaColorClass` util, and
`GameBoard`'s chrome CSS/tests). No security vulnerabilities, hardcoded secrets, injection risks,
or crash-causing defects were found, and the `ctaColorClass.ts` extraction itself is clean, pure,
and well-tested.

The substantive findings cluster in three places: (1) `ActionLog.tsx` carries dead code left behind
by the event-consolidation refactor — an unused `isGoal` field on every `formatEvent` branch, and
three `formatEvent` switch cases (`MOVE`, `HP_MOVE`, `GK_KICK_MOVE`) that `consolidateEvents`
provably never lets reach; (2) `ActionPanel.tsx` has a `canUndo` computation with two phase branches
(`GK_KICK_MOVE`, `SNAPSHOT_DEFLECT`) that no Undo button ever consumes, plus a `wide`-layout
button-count calculation that silently miscounts during `KICK_OFF`; (3) `KickOffSetupPanel.tsx` has
a disabled-button tooltip that reports the wrong reason when the attacking-team's centre-hex
constraint is satisfied but the zone constraint isn't, and a `localReady` confirmation flag that is
local-only React state with no server-truth backing (unlike `headerConfirmed` for the HEADER
phase), so it can desync from what the server actually recorded. None of these are user-facing
crashes today, but each is exactly the kind of "correct only by luck / by convention" logic that
regresses silently the next time the event schema, eligibility table, or reconnect flow changes.

Findings below were cross-checked against `packages/shared/src/actionSequence.ts`
(`ELIGIBLE_NEXT_ACTIONS`) and `packages/server/src/gameEngine.ts` / `gameHandlers.ts` (event
construction and `room.readyPlayers` handling) before being included, to avoid reporting
speculative issues that the server side actually guards against.

## Warnings

### WR-01: `Formatted.isGoal` is computed on every branch but never consumed

**File:** `packages/client/src/components/ActionLog.tsx:309-314, 448, 888`
**Issue:** `Formatted.isGoal` is set explicitly across all of `formatEvent`'s ~35 branches,
including the `GOAL` case at line 448 whose inline comment (`// was false — GOAL events must return
true`) documents a past fix specifically to make this field correct. But the only call site (line 888) destructures just `const { prefix, prefixColor, content } = formatEvent(...)` — `isGoal` is
never read, never affects a CSS class, never affects rendering at all. `Formatted`/`formatEvent`
are module-private, so no other file can consume it either. Whatever visual differentiation for
goal entries that earlier fix was meant to enable does not actually happen today.
**Fix:** Either wire `isGoal` into the render (e.g. an extra CSS class on `.entry` for goal rows) or
remove the field and the per-branch `isGoal: false/true` boilerplate:

```tsx
const { prefix, prefixColor, content, isGoal } = formatEvent(item.event, item.subKind);
return (
  <div className={`${styles.entry} ${isGoal ? styles.goalEntry : ''}`} key={index}>
```

### WR-02: `formatEvent` has three unreachable switch cases (dead code)

**File:** `packages/client/src/components/ActionLog.tsx:318-324, 717-730, 762-776` (compare to `consolidateEvents` at 219-266, 268-290)
**Issue:** `consolidateEvents` intercepts every `MOVE`, `GK_KICK_MOVE`, and `HP_MOVE` event with an
unconditional `continue` after pushing/extending a `move_group` display item. None of these three
event types can ever reach the generic `items.push({ kind: 'event', event })` fallback, so
`formatEvent` is only ever invoked on `DisplayItem`s of `kind: 'event'` whose underlying event type
can never be `MOVE`, `HP_MOVE`, or `GK_KICK_MOVE`. The corresponding `formatEvent` switch cases
(lines 318-324, 717-730, and the second `GK_KICK_MOVE` case at 762-776) are therefore unreachable —
roughly 40 lines with zero test coverage and no way to exercise them. Any future bug introduced
there would go completely undetected.
**Fix:** Remove the three dead cases (with a comment noting `consolidateEvents` always intercepts
these types first), or add an explicit test proving a code path that can actually produce such an
`EventItem` before relying on the branch.

### WR-03: `canUndo`'s phase→event-type mapping includes two phases that never render an Undo button

**File:** `packages/client/src/components/ActionPanel.tsx:276-286` (compare to render sites at `310`, `350`, `411-417`, `605-629`, `902`)
**Issue:** `canUndo`'s `moveTypeForPhase` ternary explicitly maps `GK_KICK_MOVE` →
`'GK_KICK_MOVE'` and `SNAPSHOT_DEFLECT` → `'SNAP_DEFLECT_MOVE'` (comment: "BUG-18 (Phase 18.3):
extended to match the server's expanded validUndoPhases"). But `canUndo` is only ever read at three
call sites — `HIGH_PASS_MOVE` (line 310), `FIRST_TIME_PASS_MOVE` (line 350), and `MOVE` (line 902).
Neither the `SNAPSHOT_DEFLECT` block (lines 395-422) nor the `GK_KICK_MOVE` block (lines 605-629)
renders an Undo button at all — both render only a `Confirm` button. Either (a) the two
`moveTypeForPhase` branches are dead code left over from a prior refactor, or (b) these phases are
missing an intended Undo control, meaning a player who repositions the wrong piece during the
single-slot `GK_KICK_MOVE`/`SNAPSHOT_DEFLECT` window has no way to correct it before Confirm.
**Fix:** If Undo should exist for these phases, add the button (mirroring the
`HIGH_PASS_MOVE`/`FIRST_TIME_PASS_MOVE` pattern); if not, delete the two dead branches from
`moveTypeForPhase`.

### WR-04: `actionCount` (wide-layout trigger) doesn't mirror the kick-off button gating it's meant to count

**File:** `packages/client/src/components/ActionPanel.tsx:724-732` (compare to the Move button's own gate at `746-755`)
**Issue:** `PanelShell wide={actionCount >= 5}` is decided by:

```ts
const actionCount = [
  eligible.has('MOVEMENT'),
  eligible.has('STANDARD_PASS'),
  !isKickOff && eligible.has('FIRST_TIME_PASS'),
  !isKickOff && eligible.has('HIGH_PASS'),
  !isKickOff && eligible.has('LONG_BALL'),
  !isKickOff && showSnapshot,
  !isKickOff && showShoot,
].filter(Boolean).length;
```

Every entry except the first two is gated by `!isKickOff`, matching MATCH-07 ("during kick-off only
Standard Pass is a legal opening action"). But the rendered Move button IS gated by `!isKickOff`
(line 746: `{!isKickOff && eligible.has('MOVEMENT') && (...)}`), while its `actionCount` entry (line 725) is not. Since `ELIGIBLE_NEXT_ACTIONS.MOVEMENT_PHASE` (verified in
`packages/shared/src/actionSequence.ts`) includes `'MOVEMENT'`, and `KICK_OFF`'s `lastActionType` is
`null` (→ `effectiveLastAction = 'MOVEMENT_PHASE'`), `actionCount` counts 2 "eligible" actions
during kick-off even though only 1 button (Standard Pass) is actually rendered. It doesn't flip the
`>= 5` threshold today, but the computation is provably wrong and will silently miscalculate layout
the moment the kick-off eligible set (or gating) changes.
**Fix:**

```ts
const actionCount = [
  !isKickOff && eligible.has('MOVEMENT'),
  eligible.has('STANDARD_PASS'),
  ...
```

### WR-05: `KickOffSetupPanel`'s disabled-button tooltip reports the wrong reason when only the zone constraint fails

**File:** `packages/client/src/components/KickOffSetupPanel.tsx:79, 82-84, 143`
**Issue:** `constraintsMet = centreHexOccupied && placementValid` combines two independent
constraints for the attacking team, but `disabledTitle` is chosen solely by `isAttacking`, not by
which constraint actually failed:

```ts
const disabledTitle = isAttacking
  ? 'Place a player on the centre hex first'
  : 'Move all players to your own half outside the centre circle';
```

If the attacking team's centre hex IS occupied but one or more pieces are out of zone
(`placementValid === false`), the Confirm button is correctly disabled (`disabled={!constraintsMet}`
at line 142), but its `title` (line 143) still reads "Place a player on the centre hex first" — a
factually wrong tooltip, since that requirement is already satisfied and the actual problem is
placement. The two on-panel status rows (lines 101-121) do show the correct per-constraint state,
so this is a tooltip-only defect, but it's a provably incorrect string shown to the user.
**Fix:**

```ts
const disabledTitle = !centreHexOccupied
  ? 'Place a player on the centre hex first'
  : 'Move all players to your own half outside the centre circle';
```

### WR-06: `KickOffSetupPanel`'s "Confirmed" state is local-only React state with no server-truth backing

**File:** `packages/client/src/components/KickOffSetupPanel.tsx:25, 91-94, 128-148`
**Issue:** `localReady` (`useState(false)`, line 25) is the sole source of truth for the
"Confirmed"/disabled button and the "Waiting for the opponent…" text. Confirmed via
`packages/server/src/gameHandlers.ts`: the server tracks readiness in `room.readyPlayers` (a
`Set<1 | 2>` on the `room` object, lines ~1831-1871), which is never included in the broadcast
`GameState` — unlike `headerConfirmed`, which IS part of `GameState` for the analogous HEADER-phase
confirmation. If this component ever remounts after a player has already confirmed (e.g. a
component-tree remount from a reconnect, or a page refresh before the opponent has also confirmed),
the player would see the enabled "Confirm" button again instead of "Confirmed," even though the
server already recorded their readiness. Clicking Confirm again is harmless server-side (it's a
`Set.add`), but the client UI misrepresents actual state in that window.
**Fix:** Surface per-team readiness in `GameState` (mirroring `headerConfirmed`) so `localReady` can
be derived from server state instead of tracked as transient local state that doesn't survive a
remount.

### WR-07: `ActionPanel.module.css` disabled buttons still show the interactive hover state

**File:** `packages/client/src/components/ActionPanel.module.css:43-45`
**Issue:**

```css
.ctaButton:hover {
  background: var(--team-accent);
}
```

This rule has no `:not(:disabled)` guard, so the disabled `Undo` button (`disabled={!canUndo}`)
still switches to the active team-accent background on hover, contradicting the
`opacity: 0.5; cursor: default;` styling from `.ctaButton:disabled` two rules below, and misleadingly
signalling the button is clickable. The sibling panels from this same standardization phase already
got this right — `FreeKickSetupPanel.module.css:61` and `KickOffSetupPanel.module.css:49` both use
`.ctaButton:hover:not(:disabled)`. `ActionPanel.module.css` is the one outlier.
**Fix:**

```css
.ctaButton:hover:not(:disabled) {
  background: var(--team-accent);
}
```

### WR-08: Duplicated confirm-dialog / `withEndTurnConfirm` implementation across two panels

**File:** `packages/client/src/components/ActionPanel.tsx:171-205`, `packages/client/src/components/FreeKickSetupPanel.tsx:123-157`
**Issue:** `withEndTurnConfirm` and the entire confirm-dialog JSX (overlay + card +
Cancel/"Yes, end turn" buttons, plus the `${styles.ctaButtonReady ?? ''}` fallback) are duplicated
near-verbatim between these two files, differing only in the confirmation copy ("players left to
move" vs. "players left to reposition") and which CSS module supplies the class names. This same
phase already extracted the shared color-state logic into `ctaColorClass.ts` specifically to
eliminate "two divergent implementations" (per that file's own doc comment) — the confirm dialog is
a second instance of the identical pattern that wasn't extracted, leaving two copies to keep in sync
by hand.
**Fix:** Extract a shared `useEndTurnConfirm(action)` hook (or a `<ConfirmEndTurnDialog>` component
parameterized by prompt text and CSS-module class references), mirroring the `ctaColorClass`
extraction, and have both panels consume it.

### WR-09: Non-null assertions on paired-nullable fields in `SHOT_ATTEMPT`/`HEADER` formatting

**File:** `packages/client/src/components/ActionLog.tsx:513, 527, 564-565, 579, 648-651, 683-684`
**Issue:** `formatEvent` uses non-null assertions (`event.gkScore!`, `event.attackerDie!`,
`event.attackerAerialAbility!`, `event.attackerCombined!`, `event.defenderDie!`,
`event.defenderAerialAbility!`, `event.defenderCombined!`, `event.attackerId!`, `event.defenderId!`)
based on the implicit invariant that these sibling fields are always populated together by the
server. This is true today (verified in `packages/server/src/gameEngine.ts` — `shooterScore`/
`gkScore` and the HEADER contested-branch fields are always set as a pair), but it's enforced only
by server-side convention, not by the `ActionEvent` type itself (each field is typed as
independently nullable). A future change to one side of a pair without the other would throw at
render time inside `ActionLog` instead of failing a type check.
**Fix:** Narrow with an explicit runtime check instead of `!`, or model these fields as a
discriminated union (`{ shooterScore: null; gkScore: null } | { shooterScore: number; gkScore:
number }`) so the compiler enforces the pairing.

### WR-10: `pendingEndTurn` confirm-dialog state is never reset on phase/stage change

**File:** `packages/client/src/components/ActionPanel.tsx:101-104, 171-205`, `packages/client/src/components/FreeKickSetupPanel.tsx:21-24, 123-157`
**Issue:** `pendingEndTurn` is `useState`-scoped local state, cleared only by explicit user action
(Cancel or the affirm button). Nothing resets it if `phase` (or, in `FreeKickSetupPanel`,
`freeKickStageIndex`) advances while the dialog is open. Today this is masked because the dialog is
a `position: fixed; inset: 0` overlay blocking all other interaction, and because normal game flow
requires the active player's own action to advance the phase — but that's an implicit,
undocumented invariant, not an enforced one. A future change (server-forced auto-advance,
reconnect-triggered resync) could leave a stale confirm dialog on screen showing a stale `count`
after the phase it was raised for is already gone.
**Fix:** Add a `useEffect` that clears `pendingEndTurn` whenever `phase` (or `freeKickStageIndex`)
changes.

## Info

### IN-01: Unsafe type-cast in `isEligible` bypasses compile-time checking

**File:** `packages/client/src/components/ActionPanel.tsx:208-212`
**Issue:**

```ts
const isEligible = (action: string): boolean => {
  const effectiveLast = lastActionType ?? 'MOVEMENT_PHASE';
  const eligible = ELIGIBLE_NEXT_ACTIONS[effectiveLast];
  return eligible?.has(action as Parameters<typeof eligible.has>[0]) ?? false;
};
```

`action` is typed as a bare `string` and then force-cast to `NextActionType`. Only ever called with
the literal `'SNAPSHOT'` today, but the loose parameter type means a future typo'd call (e.g.
`isEligible('SNAPSHTO')`) would compile cleanly and silently return `false` at runtime instead of
failing the build.
**Fix:** Type the parameter as `NextActionType` directly: `const isEligible = (action:
NextActionType): boolean => { ... }`.

### IN-02: Array index used as React `key` in `ActionLog`'s render list

**File:** `packages/client/src/components/ActionLog.tsx:871, 890`
**Issue:** Both branches of `recent.map((item, index) => ...)` use `key={index}`. `recent` is a
freshly reversed-and-sliced array recomputed every render, not a stable per-item identity. Low risk
today (append-only, reverse-chronological feed with no reorder animations), but the SHOT_ATTEMPT
handling split (two `DisplayItem`s sharing one underlying event via `subKind`) is exactly the kind
of case where index-based keys can misattribute a DOM node's identity across renders as the log
grows past the 30-item slice window.
**Fix:** Derive a stable key from the underlying event, e.g. `item.kind === 'move_group' ?
item.groupKey : \`${item.event.timestamp}-${item.subKind ?? ''}\``.

### IN-03: `ACTION_SUMMARY` tooltip coverage is inconsistent

**File:** `packages/client/src/components/ActionPanel.tsx` (HEADER Confirm/Decline button ~483-491; "← Back" buttons ~811-813, 828-830)
**Issue:** UX-13's doc comment states the tooltip is "applied as native `title` attribute on each
`<button className={styles.ctaButton}>`," but the HEADER phase's dynamic Confirm/Decline button and
the pass-flow "← Back" buttons render without a `title` at all, unlike most other CTA buttons in the
same panel.
**Fix:** Add `title` entries (e.g. for `'Decline (no contestant)'` and a generic back-navigation
summary) for consistency with the rest of the panel.

---

_Reviewed: 2026-07-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
