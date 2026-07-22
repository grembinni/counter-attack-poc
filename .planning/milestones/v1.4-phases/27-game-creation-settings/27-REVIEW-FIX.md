---
phase: 27-game-creation-settings
fixed_at: 2026-07-20T00:00:00Z
review_path: .planning/phases/27-game-creation-settings/27-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 27: Code Review Fix Report

**Fixed at:** 2026-07-20T00:00:00Z
**Source review:** .planning/phases/27-game-creation-settings/27-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 9 (5 Warning + 4 Info, fix_scope=all)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### WR-01: Legacy TEAM_SPEED_SET handler bypasses the new settings-lock invariant

**Files modified:** `packages/server/src/roomHandlers.ts`
**Commit:** 64339c0
**Applied fix:** Added a `room.settingsConfirmed` guard to the `TEAM_SPEED_SET` handler
(emitting `SETTINGS_ALREADY_CONFIRMED` and returning early when set), matching the guard
already used by `ROOM_SETTINGS_CONFIRM`. Since WR-02 confirmed the handler now has no live
client caller, it is kept wired (rather than deleted) as a defensive fallback for a
hypothetical stale client build, with a comment explaining that rationale and cross-
referencing WR-02.

### WR-02: Dead code — emitTeamSpeed/TEAM_SPEED_SET no longer called from any UI

**Files modified:** `packages/client/src/store/useGameStore.ts`, `packages/client/src/App.tsx`
**Commit:** d2a11b1
**Applied fix:** Removed the unused `emitTeamSpeed` action (interface + implementation) from
`useGameStore.ts`, including its now-unused `GameSpeed` type import. Removed the
corresponding `onTeamSpeedChanged`/`TEAM_SPEED_CHANGED` listener registration and
deregistration from `App.tsx`, since nothing in the current client build can trigger that
event anymore. The shared `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` event pair and the guarded
server handler were intentionally kept (see WR-01) as a defensive fallback rather than
removed outright, since a stale client build could theoretically still emit the raw socket
event.

### WR-03: GameSettingsScreen Confirm button has no double-submit guard

**Files modified:** `packages/client/src/components/GameSettingsScreen.tsx`
**Commit:** a7db275
**Applied fix:** Added `hasConfirmed` local state, set it in `handleConfirm`, and wrapped the
Confirm Settings button in `{!hasConfirmed && (...)}` — following the same
hide-after-confirm pattern already used by `UniformSelectionScreen.tsx`'s Confirm button
(rather than the `disabled={... || hasConfirmed}` variant sketched in the review, to match
established codebase convention).

### WR-04: DRAFT_POOL_LABELS duplicated instead of shared

**Files modified:** `packages/client/src/components/GameSettingsScreen.tsx`,
`packages/client/src/constants/settingsSummary.ts`
**Commit:** c810f48
**Applied fix:** Removed the byte-identical local `DRAFT_POOL_LABELS` const from
`GameSettingsScreen.tsx` and imported the existing export from `settingsSummary.ts` instead.
Updated `settingsSummary.ts`'s docstring to reflect that the map is now actually shared
(rather than independently duplicated).

### WR-05: ~11-line room-settings-confirm boilerplate duplicated verbatim across 10 test files

**Files modified:** `packages/server/src/__tests__/testHelpers.ts` (new),
`packages/server/src/__tests__/game.integration.test.ts`,
`packages/server/src/__tests__/gameHandlers.phase10.test.ts`,
`packages/server/src/__tests__/gameHandlers.phase17-06.test.ts`,
`packages/server/src/__tests__/gameHandlers.phase17.test.ts`,
`packages/server/src/__tests__/gameHandlers.phase18-02.test.ts`,
`packages/server/src/__tests__/gameHandlers.rule11.test.ts`,
`packages/server/src/__tests__/gameHandlers.test.ts`,
`packages/server/src/__tests__/kickoffSetup.integration.test.ts`,
`packages/server/src/__tests__/lineupAssignment.integration.test.ts`,
`packages/server/src/__tests__/replay.integration.test.ts`,
`packages/server/src/__tests__/shotGkRange.test.ts`
**Commit:** 32db3c8
**Applied fix:** Created a new `testHelpers.ts` module exporting
`confirmDefaultRoomSettings(clientA)`, which encapsulates the emit-and-await
ROOM_SETTINGS_CONFIRM/ROOM_SETTINGS_CONFIRMED round-trip. Replaced the duplicated 6-line
block in all 10 call sites with a single `await confirmDefaultRoomSettings(clientA)` call
plus an import. `room.integration.test.ts` (the dedicated ROOM_SETTINGS_CONFIRM test suite,
which exercises many non-default payload variations) was intentionally left untouched — it
is not part of this duplication. All 555 server tests still pass.

### IN-01: Unreachable CSS selector after read-only conversion

**Files modified:** `packages/client/src/components/TeamSelectionScreen.module.css`,
`packages/client/src/components/UniformSelectionScreen.module.css`
**Commit:** f94252a
**Applied fix:** Deleted the dead `.speedOptionActive:disabled { opacity: 0.7; cursor:
not-allowed; }` rule from both stylesheets (the `:disabled` pseudo-class can never match
since `.speedOptionActive` is now applied to a `<span>`, not a form element).

### IN-02: Draft-pool summary text order follows click order, not canonical order

**Files modified:** `packages/client/src/components/GameSettingsScreen.tsx`
**Commit:** 74cb630
**Applied fix:** `toggleDraftPool` now sorts the array by canonical `ALL_DRAFT_POOLS` index
whenever a pool is added, instead of appending to the end. Verified against existing tests
(which already click checkboxes in canonical order, so no assertions needed updating) — the
settings summary will now always read pools in canonical order regardless of click order.

### IN-03: No uniqueness check on server-validated draftPools

**Files modified:** `packages/server/src/roomHandlers.ts`
**Commit:** f405190
**Applied fix:** Added a `new Set(draftPools).size !== draftPools.length` check after the
`SELECTABLE_DRAFT_POOLS` allow-list validation in the `ROOM_SETTINGS_CONFIRM` handler,
reusing the existing `INVALID_DRAFT_POOL` error code (which already has client-agnostic
handling and test coverage) rather than introducing a new error code.

### IN-04: homeConfirmedFormation prop is accepted but never read

**Files modified:** `packages/client/src/App.tsx`,
`packages/client/src/components/UniformSelectionScreen.tsx`,
`packages/client/src/components/UniformSelectionScreen.test.tsx`
**Commit:** 18c2cb1
**Applied fix:** Removed the `homeConfirmedFormation` prop entirely from
`UniformSelectionScreen`'s `Props` type and destructure (was previously renamed to
`_homeConfirmedFormation` just to silence the unused-var lint rule), removed the prop from
its `App.tsx` call site, removed the now-dead `homeConfirmedFormation`/
`setHomeConfirmedFormation` local state from `App.tsx`, and dropped the now-unused 3rd
(`formationId`) parameter from the `onUniformHomeConfirmed` socket handler (TypeScript
permits a handler with fewer params than the event's declared signature). Also cleaned up
the corresponding default prop and now-unused `FormationId` import in
`UniformSelectionScreen.test.tsx`.

## Skipped Issues

None — all 9 in-scope findings were fixed.

## Verification

After all 9 fixes, re-ran the full bar requested for this last gate before phase completion:

- `pnpm -r test`: 538 shared + 555 server + 341 client tests, all green (no regressions).
- `pnpm --filter @counter-attack/client typecheck`: clean.
- `pnpm --filter @counter-attack/server typecheck`: clean.
- `pnpm --filter @counter-attack/shared typecheck`: clean.

No finding in this batch involved ambiguous/logic-risk changes requiring
"requires human verification" status — WR-01/IN-03 are additive guard clauses matching an
existing, already-tested pattern in the same handler; WR-02/IN-04 are dead-code removals
verified by repo-wide grep (zero remaining callers) plus a full green test/typecheck run;
WR-03/WR-04/WR-05/IN-01/IN-02 are refactors/UI-consistency fixes with direct test coverage.

---

_Fixed: 2026-07-20T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
