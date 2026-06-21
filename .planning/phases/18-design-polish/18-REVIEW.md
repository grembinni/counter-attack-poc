---
phase: 18-design-polish
reviewed: 2026-06-21T11:55:42Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - packages/client/src/components/ActionLog.test.tsx
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-06-21T11:55:42Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed `ActionLog.tsx`/`.test.tsx`, `ActionPanel.tsx`/`.test.tsx`, and `GameBoard.tsx`/`.test.tsx` — the Phase 18 design-polish surface (D-01/D-06/D-08/D-11/D-12/D-13/D-17 conventions: phase-label naming, shared stat-roll formatter, move-log consolidation, unified wait-state text). TypeScript (`tsc --noEmit`), ESLint, and the full unit-test suite for these three components (56 tests) all pass cleanly with no compiler errors, lint violations, debug artifacts, empty catches, or dangerous-function usage.

Traced the data contracts these components depend on (`ActionEvent` union in `packages/shared/src/types.ts`, `ELIGIBLE_NEXT_ACTIONS` in `actionSequence.ts`, and the server-side `HEADER`/`SHOT_ATTEMPT` event-emission sites in `gameEngine.ts`) to verify the non-null assertions and derived-stat arithmetic in `ActionLog.tsx`. Most are sound given current server invariants. Two issues are worth fixing: an unstable React list key in `ActionLog` and a latent empty-string fallback for `HEADER` events that can mis-tag a piece's team color in a narrow uncontested-header edge case. Neither is a crash risk under current server logic, but both are correctness/robustness gaps worth closing.

## Warnings

### WR-01: `ActionLog` list items keyed by index in a list whose order shifts every render

**File:** `packages/client/src/components/ActionLog.tsx:579` and `:596`
**Issue:** `recent` is built fresh on every render as `[...consolidateEvents(eventLog)].reverse().slice(0, 10)` (line 564), then rendered with `key={index}` (lines 579, 596). Because the underlying `eventLog` only grows, each new event shifts every other displayed item's position by one in the reversed-and-sliced window. React uses `key` to decide whether to reuse or remount a DOM node; with an index key, item N's key always refers to "the Nth most recent entry" rather than to a stable identity for a specific event/move-group. This is the classic "don't use array index as key when the list reorders" anti-pattern. Today the rendered `<div>`s are stateless, so the user-visible symptom is limited to lost CSS transition continuity, but it also means React will reconcile the wrong DOM node against the wrong logical entry as soon as any entry gains state (e.g., a future hover/expand affordance), silently misattributing it.
**Fix:** Key on a value derived from the event itself instead of the post-slice position — e.g. give each `ActionEvent` a stable `timestamp`-based key (already present on every variant) and combine with the array position only as a last-resort tiebreaker:

```tsx
const path = item.path.map((h) => `${h.q},${h.r}`).join(' → ');
const key = item.kind === 'move_group' ? `${item.groupKey}:${item.path.length}` : item.event.timestamp;
return (
  <div className={styles.entry} key={key}>
```

(`groupKey` plus path length is unique per render of a given group; `event.timestamp` is unique per non-grouped event since it's set from `Date.now()` server-side.)

### WR-02: `HEADER` uncontested-decline path can render an empty-string `pieceId`, mis-coloring the label

**File:** `packages/client/src/components/ActionLog.tsx:395-412`
**Issue:** In the uncontested-HEADER branch, `contestantId = event.attackerId ?? event.defenderId ?? ''`. Tracing the server emission sites in `packages/server/src/gameEngine.ts:2056-2076`: when `defenderContestantIds.length === 0 || defenderPiece === undefined` and `atkCount === 0`, `winnerId = attackerPiece?.id ?? ''` where `attackerPiece` falls back to the ball carrier piece. If that fallback lookup also fails to resolve (carrier id stale/null — an already-degraded state, but not type-impossible since `ball.carrierId` is `string | null`), the server emits `attackerId: ''` rather than `null`. On the client, `contestantId` becomes `''`, `prefixColor` is correctly suppressed (`contestantId ? ... : null`), but `<P pieceId={contestantId} prefix={rolePrefix} />` is still rendered unconditionally. Inside `P`, `pieceColorOf('')` evaluates `''.startsWith('home')` → `false` → resolves to the **away** team's color regardless of which side actually won, and `pieceNum('')` returns `''` (the regex fails to match, falling back to the raw empty `pieceId`). The visual result is a colored "D"/"A" badge with no player number, falsely tinted as the away team, with no error or fallback text indicating the data is degenerate.
**Fix:** Guard the render, not just the color, and make the fallback explicit instead of an empty string:

```tsx
const contestantId = event.attackerId ?? event.defenderId;
const rolePrefix: 'A' | 'D' = event.attackerId !== null ? 'A' : 'D';
const prefixColor = contestantId ? pieceColorOf(contestantId) : null;
return {
  prefix,
  prefixColor,
  content: (
    <>
      {' '}
      {winLabel} —{' '}
      {contestantId ? <P pieceId={contestantId} prefix={rolePrefix} /> : 'no contestant'}{' '}
      (uncontested)
    </>
  ),
  isGoal: false,
};
```

## Info

### IN-01: Goal-line geometry duplicated as inline literals instead of imported from `pitch.ts`

**File:** `packages/client/src/components/ActionPanel.tsx:14-15, 480-483`
**Issue:** `GOAL_R_VALUES` and the inline `q: attackingTeam === 'home' ? 36 : 0` duplicate pitch geometry (goal-line column and valid r-range) that also exists encoded in `packages/shared/src/pitch.ts` (and is re-derived independently server-side at `gameEngine.ts:2060-2062` as `goalQB`/`isGoalLineTargetB`). The two definitions currently agree, but nothing enforces that — a future pitch-dimension change in `pitch.ts` would silently desync the client's Shoot-eligibility distance check from the server's authoritative geometry.
**Fix:** Export a `GOAL_HEXES` (or `goalHexesFor(team)`) helper from `packages/shared/src/pitch.ts` and import it in `ActionPanel.tsx` instead of re-declaring `GOAL_R_VALUES`/the `q` ternary locally.

### IN-02: `actionCount >= 5` wide-panel threshold is an unexplained magic number

**File:** `packages/client/src/components/ActionPanel.tsx:507, 510`
**Issue:** `actionCount` (count of eligible buttons to render) is compared against the literal `5` to decide whether to apply the `styles.wide` CSS class, with no named constant or comment explaining why 5 is the breakpoint (e.g., button width × 5 exceeding the default panel width).
**Fix:** Hoist to a named constant with a one-line rationale, e.g. `const WIDE_PANEL_BUTTON_THRESHOLD = 5; // panel widens once 5+ action buttons would wrap`.

### IN-03: `isEligible` and the `eligible.has(...)` calls perform a redundant `?? false` / lookup guard that can never trigger

**File:** `packages/client/src/components/ActionPanel.tsx:80-84, 475`
**Issue:** `ELIGIBLE_NEXT_ACTIONS` is typed as `Record<LastActionType, ReadonlySet<NextActionType>>` (`packages/shared/src/actionSequence.ts:49`), which TypeScript enforces as exhaustive over every `LastActionType` value, and `effectiveLastAction`/`effectiveLast` are always coerced to a valid `LastActionType` via `?? 'MOVEMENT_PHASE'`. `eligible`/`eligible?.has(...)` can therefore never be `undefined`, making the `?.` and `?? false` defensive checks dead code that masks the fact the lookup is statically guaranteed.
**Fix:** Either drop the optional chaining (`ELIGIBLE_NEXT_ACTIONS[effectiveLast].has(...)`) to let the type system document the guarantee, or add a one-line comment noting the defensive check is intentionally redundant for runtime safety against future non-exhaustive edits.

---

_Reviewed: 2026-06-21T11:55:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
