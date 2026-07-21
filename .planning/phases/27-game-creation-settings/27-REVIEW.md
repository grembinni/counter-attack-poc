---
phase: 27-game-creation-settings
reviewed: 2026-07-20T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - packages/client/src/App.tsx
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/GameSettingsScreen.module.css
  - packages/client/src/components/GameSettingsScreen.test.tsx
  - packages/client/src/components/GameSettingsScreen.tsx
  - packages/client/src/components/TeamSelectionScreen.module.css
  - packages/client/src/components/TeamSelectionScreen.test.tsx
  - packages/client/src/components/TeamSelectionScreen.tsx
  - packages/client/src/components/UniformSelectionScreen.module.css
  - packages/client/src/components/UniformSelectionScreen.test.tsx
  - packages/client/src/components/UniformSelectionScreen.tsx
  - packages/client/src/constants/settingsSummary.ts
  - packages/client/src/constants/speedOptions.ts
  - packages/client/src/store/useGameStore.ts
  - packages/server/src/__tests__/game.integration.test.ts
  - packages/server/src/__tests__/gameHandlers.phase10.test.ts
  - packages/server/src/__tests__/gameHandlers.phase17-06.test.ts
  - packages/server/src/__tests__/gameHandlers.phase17.test.ts
  - packages/server/src/__tests__/gameHandlers.phase18-02.test.ts
  - packages/server/src/__tests__/gameHandlers.rule11.test.ts
  - packages/server/src/__tests__/gameHandlers.test.ts
  - packages/server/src/__tests__/kickoffSetup.integration.test.ts
  - packages/server/src/__tests__/lineupAssignment.integration.test.ts
  - packages/server/src/__tests__/replay.integration.test.ts
  - packages/server/src/__tests__/room.integration.test.ts
  - packages/server/src/__tests__/shotGkRange.test.ts
  - packages/server/src/roomHandlers.ts
  - packages/server/src/roomStore.ts
  - packages/shared/src/events.ts
  - packages/shared/src/types.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-07-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Phase 27 adds a host-only `GameSettingsScreen` pre-step (Match Speed + Team Type + Draft Pool),
a new `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` event pair, and converts the previously
interactive speed pickers on `TeamSelectionScreen`/`UniformSelectionScreen` into read-only
summaries. The server-side allow-list validation, host-only guards, and the
settings-confirmed/joiner-present race gate (T-27-05) are implemented carefully and covered by a
solid new integration test (`room.integration.test.ts`), including an explicit negative
("event NOT emitted within window") assertion for the race condition — this is good adversarial
test design.

No BLOCKER-severity defects were found (no injection, XSS, hardcoded secrets, or crash paths).
The most significant issue is that the legacy `TEAM_SPEED_SET` server handler and its
`emitTeamSpeed` client action were left fully wired but were not updated to respect the new
"settings lock together atomically" (D-03) invariant — the handler only guards on
`room.gameState !== null`, not `room.settingsConfirmed`, so the atomic-lock guarantee the new
feature is built around can be silently bypassed through the still-live legacy event. The rest of
the findings are quality/maintainability issues: a missing double-submit guard on the new
Confirm button (inconsistent with the sibling `UniformSelectionScreen` pattern), duplicated
`DRAFT_POOL_LABELS` constants that can drift, ~11-line boilerplate duplicated verbatim across 10
server test files, and a CSS selector that is now unreachable after the interactive-to-read-only
conversion.

## Warnings

### WR-01: Legacy TEAM_SPEED_SET handler bypasses the new settings-lock invariant

**File:** `packages/server/src/roomHandlers.ts:281-312`
**Issue:** `ROOM_SETTINGS_CONFIRM` (added this phase) is explicitly documented as locking Match
Speed + Team Type + Draft Pool together atomically, one-shot, via `room.settingsConfirmed`
(D-03; see `roomHandlers.ts:339-343` and the `SETTINGS_ALREADY_CONFIRMED` guard). However the
older `TEAM_SPEED_SET` handler (still fully registered, still reachable via
`ClientEvents.TEAM_SPEED_SET`) only guards on `room.gameState !== null`
(`roomHandlers.ts:303-306`) — it never checks `room.settingsConfirmed`. A host client (or any
client that still emits the raw socket event, e.g. via devtools or a stale build) can therefore
call `TEAM_SPEED_SET` _after_ `ROOM_SETTINGS_CONFIRM` has locked the room, silently mutating
`room.gameSpeed` and re-broadcasting `TEAM_SPEED_CHANGED` — bypassing the "lock together
atomically" guarantee the feature is designed to provide. `room.gameSpeed` is what actually
feeds `buildInitialGameState` at `LINEUP_CONFIRM` (`roomHandlers.ts:646`), so this is a real,
not just cosmetic, way to change the effective match speed after the settings screen claims it
is locked.
**Fix:**

```typescript
socket.on(ClientEvents.TEAM_SPEED_SET, (speed: GameSpeed) => {
  const roomCode = socket.data.roomCode;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room) return;
  // Add: reject once settings have been locked via ROOM_SETTINGS_CONFIRM.
  if (room.settingsConfirmed) {
    socket.emit(ServerEvents.GAME_ERROR, 'SETTINGS_ALREADY_CONFIRMED');
    return;
  }
  ...
});
```

Alternatively, since no client code calls `emitTeamSpeed`/`TEAM_SPEED_SET` anymore (see WR-02),
consider removing the handler/event entirely rather than patching it, to avoid maintaining two
parallel "lock" mechanisms.

### WR-02: Dead code — `emitTeamSpeed`/`TEAM_SPEED_SET` no longer called from any UI

**File:** `packages/client/src/store/useGameStore.ts:170-174, 958-961`
**Issue:** `App.tsx`'s `handleSpeedChange` (the only caller of `emitTeamSpeed`) was removed in
this phase and replaced by `handleSettingsConfirm` → `ROOM_SETTINGS_CONFIRM`. Neither
`TeamSelectionScreen` nor `UniformSelectionScreen` render an interactive speed picker anymore
(both are read-only per D-07/D-09). A repo-wide search confirms `emitTeamSpeed` and
`ClientEvents.TEAM_SPEED_SET` have no remaining callers in `packages/client/src`. The store
action, its docstring, and the corresponding server handler/event pair are now unreachable
through normal use.
**Fix:** Remove `emitTeamSpeed` from `GameStore` and its implementation, and remove/deprecate the
`TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` event pair (or explicitly document why they are being kept
as a public API surface for a future use case). Leaving unreachable event handlers wired up on
the server is also what causes WR-01.

### WR-03: `GameSettingsScreen` Confirm button has no double-submit guard

**File:** `packages/client/src/components/GameSettingsScreen.tsx:53-55, 135-142`
**Issue:** `handleConfirm` calls `onConfirm(...)` (which emits `ROOM_SETTINGS_CONFIRM`) but there
is no local `hasConfirmed`-style state disabling/hiding the button afterward, unlike the sibling
`UniformSelectionScreen.tsx` which explicitly guards its Confirm button with
`{!hasConfirmed && (<button ...>)}` (`UniformSelectionScreen.tsx:356-371`). Because the screen
only transitions away from `GAME_SETTINGS` once the `ROOM_SETTINGS_CONFIRMED` echo round-trips
back from the server (`App.tsx:127`), a rapid double-click before that round-trip completes will
fire `ROOM_SETTINGS_CONFIRM` twice. The server correctly rejects the second attempt
(`SETTINGS_ALREADY_CONFIRMED`), so there's no data corruption, but it is inconsistent with the
established pattern in this codebase and would surface confusing behavior if a `gameError`
banner is ever added to this screen (currently `gameError` is never rendered while on
`GAME_SETTINGS`/`WAITING`, so today it's silent — but that's fragile, not by design).
**Fix:**

```tsx
const [hasConfirmed, setHasConfirmed] = useState(false);
...
function handleConfirm() {
  setHasConfirmed(true);
  onConfirm({ speed, teamType, draftPools: teamType === 'draft' ? draftPools : [] });
}
...
<button
  ...
  disabled={confirmDisabled || hasConfirmed}
  onClick={handleConfirm}
>
```

### WR-04: `DRAFT_POOL_LABELS` duplicated instead of shared

**File:** `packages/client/src/components/GameSettingsScreen.tsx:18-24` and
`packages/client/src/constants/settingsSummary.ts:8-14`
**Issue:** `settingsSummary.ts` exports `DRAFT_POOL_LABELS` with a docstring stating it is a
"shared label map for draft pool copy, reused by `formatSettingsSummary` and (independently)
`GameSettingsScreen.tsx`'s own checkbox labels" — but `GameSettingsScreen.tsx` does not import
it; it declares a byte-identical local copy instead. Both maps must be kept in sync manually
(e.g. if a pool label copy changes, or `DraftPoolId` gains a 6th value, only one file needs to
be touched today, but a future edit to just one map will silently desync the checkbox labels
from the settings-summary labels).
**Fix:** Import the existing export instead of duplicating it:

```tsx
import { DRAFT_POOL_LABELS } from '../constants/settingsSummary.js';
```

and delete the local `DRAFT_POOL_LABELS` const in `GameSettingsScreen.tsx`.

### WR-05: ~11-line room-settings-confirm boilerplate duplicated verbatim across 10 test files

**File:** `packages/server/src/__tests__/game.integration.test.ts`,
`gameHandlers.phase10.test.ts`, `gameHandlers.phase17-06.test.ts`, `gameHandlers.phase17.test.ts`,
`gameHandlers.phase18-02.test.ts`, `gameHandlers.rule11.test.ts`, `gameHandlers.test.ts`,
`kickoffSetup.integration.test.ts`, `lineupAssignment.integration.test.ts`,
`replay.integration.test.ts`, `shotGkRange.test.ts` (each `setupRoom`/`setupThroughUniformConfirm`
helper)
**Issue:** Every one of these files got the identical ~11-line block inserted verbatim:

```typescript
const settingsConfirmedPromise = oncePromise(clientA, ServerEvents.ROOM_SETTINGS_CONFIRMED);
clientA.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, {
  speed: 'standard',
  teamType: 'standard',
  draftPools: [],
});
await settingsConfirmedPromise;
```

This is the same "just to unblock TEAM_SELECTION_START under the new gate" fixture logic copied
10 times rather than factored into a shared test helper. It is low risk (test-only code) but is
exactly the kind of duplication that drifts: a future change to the `ROOM_SETTINGS_CONFIRM`
payload shape or default values now requires editing 10 files instead of 1.
**Fix:** Extract a shared helper (e.g. in a `packages/server/src/__tests__/testHelpers.ts` module
or similar) such as `confirmDefaultRoomSettings(clientA)` and import it from all 10 call sites.

## Info

### IN-01: Unreachable CSS selector after read-only conversion

**File:** `packages/client/src/components/TeamSelectionScreen.module.css:200-203` and
`packages/client/src/components/UniformSelectionScreen.module.css:340-343`
**Issue:** `.speedOptionActive:disabled { opacity: 0.7; cursor: not-allowed; }` was left in both
stylesheets after this phase converted `.speedOptionActive` from a `<button>` to a plain
`<span>` in both `TeamSelectionScreen.tsx` (`styles.speedOptionActive` on a `<span>`,
line ~119) and `UniformSelectionScreen.tsx` (same, line ~186/192). The `:disabled` pseudo-class
only ever matches form elements, so this rule is now permanently dead in both files.
**Fix:** Delete the two `.speedOptionActive:disabled` rules (or, if a genuinely-disabled variant
is still desired in the future, apply it via a class modifier instead of `:disabled`).

### IN-02: Draft-pool summary text order follows click order, not canonical order

**File:** `packages/client/src/components/GameSettingsScreen.tsx:41-48` and
`packages/client/src/constants/settingsSummary.ts:32`
**Issue:** `toggleDraftPool` appends newly-checked pools to the end of the `draftPools` array
(`[...prev, poolId]`), so the array order reflects the order the host clicked the checkboxes in,
not the canonical `ALL_DRAFT_POOLS` order (`['original', 'mls', 'international', ...]`).
`formatSettingsSummary` then joins `draftPools` in that same order
(`draftPools.map((pool) => DRAFT_POOL_LABELS[pool]).join(', ')`). If a host unchecks Original and
then checks International before MLS, the settings summary shown to both players reads
"Draft Pool: International, MLS" instead of the canonical "Draft Pool: MLS, International" —
cosmetically inconsistent, not incorrect.
**Fix:** Sort `draftPools` by a canonical index (e.g. `ALL_DRAFT_POOLS.indexOf`) before storing,
or sort in `formatSettingsSummary` before formatting.

### IN-03: No uniqueness check on server-validated `draftPools`

**File:** `packages/server/src/roomHandlers.ts:370-383`
**Issue:** The `ROOM_SETTINGS_CONFIRM` handler validates that every entry in `draftPools` is a
member of `SELECTABLE_DRAFT_POOLS`, but does not check for duplicate entries. The normal
checkbox UI cannot produce duplicates, but a hand-crafted socket payload
(`draftPools: ['original', 'original']`) would pass validation and get stored/broadcast as-is,
producing a summary line like "Draft Pool: Original, Original" on both clients.
**Fix:** `if (new Set(draftPools).size !== draftPools.length) { ...emit INVALID_DRAFT_POOL...; return; }`
or de-duplicate before storing (`room.draftPools = [...new Set(draftPools)]`).

### IN-04: `homeConfirmedFormation` prop is accepted but never read (pre-existing, touched by this diff)

**File:** `packages/client/src/components/UniformSelectionScreen.tsx:104, 130`
**Issue:** `UniformSelectionScreen` still declares and destructures the
`homeConfirmedFormation` prop (renamed to `_homeConfirmedFormation` to silence the unused-var
lint rule) but never uses it in the component body. This predates Phase 27 (Phase 24 moved
formation-for-lineup plumbing to `BOTH_FORMATIONS_CONFIRMED`/`myFormationId` in `App.tsx`
instead), but the file was touched again in this phase (speed-block relocation) without cleaning
this up.
**Fix:** Remove the `homeConfirmedFormation` prop from `Props` and from the `App.tsx` call site
(`App.tsx:261`) if it is confirmed dead, or wire it to an actual use if one was intended.

---

_Reviewed: 2026-07-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
