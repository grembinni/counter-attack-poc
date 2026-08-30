---
phase: 46-final-cleanup
reviewed: 2026-08-30T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - docs/HIGHLIGHT-REFERENCE.md
  - packages/client/src/components/ActionPanel.test.tsx
  - packages/client/src/components/ActionPanel.tsx
  - packages/client/src/components/BallLocationRing.test.tsx
  - packages/client/src/components/BallLocationRing.tsx
  - packages/client/src/components/FreeKickSetupPanel.test.tsx
  - packages/client/src/components/FreeKickSetupPanel.tsx
  - packages/client/src/components/GameSettingsScreen.test.tsx
  - packages/client/src/components/GameSettingsScreen.tsx
  - packages/client/src/components/HexGrid.test.tsx
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/PlayerStatsPanel.test.tsx
  - packages/client/src/components/PlayerStatsPanel.tsx
  - packages/client/src/store/useGameStore.test.ts
  - packages/client/src/store/useGameStore.ts
  - packages/server/src/__tests__/lineupAssignment.integration.test.ts
  - packages/server/src/__tests__/substitution.integration.test.ts
  - packages/server/src/roomHandlers.ts
  - packages/shared/scripts/seed-rosters.ts
  - packages/shared/src/data/player-pool.csv
  - packages/shared/src/teamConfig.ts
  - packages/shared/src/teams.test.ts
  - packages/shared/src/teams.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 46: Code Review Report

**Reviewed:** 2026-08-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the Phase 46 final-cleanup file set: the highlight/ring color reference doc,
several client components (ActionPanel, BallLocationRing, FreeKickSetupPanel,
GameSettingsScreen, HexGrid, PlayerStatsPanel) and their tests, the client Zustand store
and its tests, `roomHandlers.ts`, the roster CSV/seed-script/generated-data trio, and two
server integration test suites.

The code in this set is unusually well self-documented and cross-referenced (each new
constant/branch cites the plan/bug that introduced it, and several helpers are explicitly
shared between `selectPiece` and `setGameState`'s sticky-selection block specifically to
prevent the "two-tree-drift" class of bug the codebase has hit before — BUG-09/BUG-30/
BUG-31/BUG-37). I traced the new Phase 46 additions (`VALID_MOVE_TINT_EXCEPTION_PHASES`,
`RESPONSE_MOVE_CONFIG_BY_PHASE`/`RESPONSE_MOVE_STICKY_PHASES`, `INTERRUPT_RESUME_PHASES`,
the `BALL_MARKER_PHASES` FREE_KICK_SETUP/FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE additions, the
LOOSE_BALL panel fix, the generic-bench-player bench fallback in `roomHandlers.ts`, and the
`GameSettingsScreen` Settings/Team Mode tab split) against their tests and did not find a
functional regression or security defect in this batch — the allow-list validation in
`roomHandlers.ts` in particular is thorough and consistently fail-closed except for one
spot noted below.

I did find three code-quality issues worth fixing (duplicated confirm-dialog logic across
two panels, a stale/misleading comment plus dead code path in the CSV-to-TS seed script,
and one inconsistent fail-open validation branch) and one minor doc/behavior mismatch.

## Warnings

### WR-01: Duplicated end-turn-confirm dialog logic between ActionPanel and FreeKickSetupPanel

**File:** `packages/client/src/components/ActionPanel.tsx:104-108,170-209`
**File:** `packages/client/src/components/FreeKickSetupPanel.tsx:31-34,151-185`
**Issue:** Both components independently implement the identical `pendingEndTurn` local
state shape, the identical `withEndTurnConfirm(eligibleRemaining, action)` closure, and
near-identical `confirmDialog` JSX (only the prompt copy differs: "left to move" vs. "left
to reposition"). This is the exact kind of duplication the codebase has otherwise been
careful to eliminate in this same phase/area — `ctaColorClass.ts` and
`restartErrorMessage.ts` were both extracted specifically so two call sites can't drift.
Here the ~50-line confirm-dialog block was not extracted, so a future fix to the dialog
(e.g. a11y attributes, styling, or the double-click race) has to be applied twice and can
silently diverge.
**Fix:** Extract a shared `useEndTurnConfirm(promptSuffix: string)` hook (or a shared
`<EndTurnConfirmDialog>` component parameterized by the prompt copy) into
`packages/client/src/hooks/` or `utils/`, and have both `ActionPanel.tsx` and
`FreeKickSetupPanel.tsx` consume it, mirroring how `ctaColorClass` was already extracted.

### WR-02: seed-rosters.ts's primary CSV-column path is dead code with a stale comment

**File:** `packages/shared/scripts/seed-rosters.ts:44,178-181`
**Issue:** Line 44's comment states "Phase 21: Single consolidated CSV — sourceTeamId
comes directly from SourceTeam column", and `parseRow` (lines 178-181) reads
`row[idx['SourceTeam']]` as the primary source, falling back to `toSlug(row[idx['Team']])`
only when that column is absent/blank. However, the actual
`packages/shared/src/data/player-pool.csv` header is
`Player,Team,Nationality,Position,Pace,Dribbling,Highpass,Resilience,Shooting,Tackling,Aerial Ability,Saving,Handling,PoolTag`
— there is no `SourceTeam` column at all. `idx['SourceTeam']` is therefore always
`undefined`, `row[undefined]` is always `undefined`, and `sourceTeamRaw` is always `''`
for every single row (confirmed: `Team` column already holds the raw slug, e.g.
`generic-bench-home`, `canada`, `free-agent`). The primary branch is unreachable in
practice, and the comment actively misleads a future editor into believing a
`SourceTeam` column governs team assignment. The same stale assumption is echoed at the
top-level `main()` loop (line 330, `raw.teamCsvName`, which is really always the `Team`
fallback value).
**Fix:** Either remove the dead `SourceTeam` branch and comment (since `Team` already
holds a ready-made slug) or restore an actual `SourceTeam` column to the CSV if the two
were meant to diverge. At minimum, correct the comment to describe the CSV as it exists
today so it doesn't misdirect the next change to this script.

### WR-03: roomHandlers.ts UNIFORM_CONFIRM silently coerces an invalid jerseyType instead of rejecting it

**File:** `packages/server/src/roomHandlers.ts:685-688`
**Issue:** Every other field in this handler (and file) uses the explicit ASVS V5
allow-list pattern: validate, and on failure `socket.emit(ServerEvents.GAME_ERROR, '...')`
and `return` before any mutation (see `INVALID_TEAM`, `INVALID_STYLE`, `INVALID_FORMATION`
immediately above it). `jerseyType` breaks that pattern:
```ts
const safeJerseyType: 'home' | 'away' = VALID_JERSEY_TYPES.includes(jerseyType)
  ? jerseyType
  : 'home';
```
A forged/garbled `jerseyType` is silently coerced to `'home'` and the handler proceeds to
mutate room state, rather than being rejected the way every sibling field is. The blast
radius today is cosmetic (which kit color a team wears), but this is a fail-open outlier
in an otherwise consistently fail-closed file, and it is easy for a future field added
near this one to copy the coercion pattern instead of the reject pattern.
**Fix:** Match the surrounding convention:
```ts
if (!VALID_JERSEY_TYPES.includes(jerseyType)) {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_JERSEY_TYPE');
  return;
}
```
and use `jerseyType` directly thereafter (drop the `safeJerseyType` coercion).

## Info

### IN-01: GameSettingsScreen's Referee Leniency input comment overstates the "snap back" behavior

**File:** `packages/client/src/components/GameSettingsScreen.tsx:157-166`
**Issue:** The comment above `handleRefereeLeniencyValueChange` says a cleared/invalid
leniency input "snaps back to the last valid value." In practice, the guard is:
```ts
function handleRefereeLeniencyValueChange(e: React.ChangeEvent<HTMLInputElement>) {
  const parsed = Number.parseInt(e.target.value, 10);
  if (Number.isNaN(parsed)) return;
  setRefereeLeniencyValue(Math.min(5, Math.max(2, parsed)));
}
```
When the field is cleared, `parsed` is `NaN` and the function returns without calling
`setRefereeLeniencyValue` — so no re-render is triggered, `refereeLeniencyValue` state is
unchanged, but the controlled `<input>`'s DOM value is left however the browser rendered
the user's clear/edit (i.e. blank), not actively reverted to the last valid number until
some other state change causes React to reconcile the `value` prop again. The stored value
does stay correct for the eventual `Confirm Settings` payload (verified by the existing
clamp tests), but the visual "snaps back" claim in the comment doesn't describe what
actually happens on screen during the blank/invalid interim.
**Fix:** Either force a re-render on the invalid path too (e.g.
`setRefereeLeniencyValue((v) => v)` won't help since it's the same reference value — use a
key-based remount or an explicit `e.target.value = String(refereeLeniencyValue)` DOM write)
so the field visibly snaps back, or correct the comment to describe the actual behavior
(value is preserved internally; the field may visually sit blank until the next valid
keystroke or external re-render).

---

_Reviewed: 2026-08-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
