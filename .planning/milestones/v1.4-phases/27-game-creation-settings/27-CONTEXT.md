# Phase 27: Game Creation Settings - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a pre-step settings screen to game creation where speed, team type (Standard or Draft), and draft pool are configured before team selection. The speed selector moves off the interactive position on the team-selection page in Standard mode (rendered as a read-only info subheader instead). Draft mode shows a settings summary line on the team-selection screen in the same subheader style. Covers requirements DRAFT-01, DRAFT-02, DRAFT-03.

**Note:** REQUIREMENTS.md's coverage table maps DRAFT-01/02/03 to "Phase 28" — this appears stale (likely from before phase 27 "response-activation-model" was removed and phases were renumbered/backfilled). ROADMAP.md's Phase 27 goal text matches DRAFT-01/02/03 verbatim, so ROADMAP.md is treated as authoritative for this phase's scope. Flag to the user if REQUIREMENTS.md's coverage table isn't updated to match by the time this phase ships.

</domain>

<decisions>
## Implementation Decisions

### Settings Screen Trigger & Flow

- **D-01:** The settings pre-step appears for the host only, immediately after "Create Room" — before a joiner is required. The host is not blocked waiting for a second player to configure settings.
- **D-02:** The joining player does not see the settings screen at all. When they join the room, the server broadcasts the confirmed settings (speed, team type, draft pool) to them as part of the room/join payload — the same pattern as the existing `TEAM_SPEED_CHANGED` broadcast (see `roomHandlers.ts`).
- **D-03:** Settings are locked once the host confirms them on the pre-step screen — no re-editing after confirm, for either player, for the rest of that match.

### Draft Pool Selection UI

- **D-04:** All five pool checkboxes (Original, MLS, International, Legends, Icons) are shown when Team Type = Draft, but Legends and Icons are disabled/greyed with a "coming soon" indicator — only Original/MLS/International are selectable in this phase (Legends/Icons pools are DRAFT-11, deferred).
- **D-05:** Original is pre-checked by default when Draft mode is first selected, so the Confirm button is never blocked by an initial all-empty state.
- **D-06:** The Confirm/Continue button is disabled (not clickable) whenever zero of the three enabled pools are checked — no inline error message needed since the invalid state is unreachable.

### Standard Mode Speed Relocation

- **D-07:** The speed control remains visible on both `TeamSelectionScreen.tsx` and `UniformSelectionScreen.tsx`, but is converted from an interactive picker to the same read-only info-subheader element used for the Draft-mode settings summary (D-09). The actual speed selection only happens once, on the new pre-step settings screen.
- **D-08:** The confirmed speed also gets a small read-only mention on the in-game scoreboard during gameplay, if it fits the existing scoreboard layout, as a reminder to both players of the active match speed.

### Draft Mode Settings Summary

- **D-09:** On the Draft-mode team-selection screen, the settings summary (`Speed | Team Type | Draft Pool`) is a read-only info subheader — same non-interactive treatment as D-07's relocated Standard-mode speed label. No edit-back link, consistent with settings being locked per D-03.

### Claude's Discretion

- Exact subheader visual styling/placement (font size, position within TeamSelectionScreen/UniformSelectionScreen layout) — follow existing subheader/label patterns in those components.
- Whether the scoreboard speed mention (D-08) is technically feasible without layout rework; if it doesn't fit cleanly, it's acceptable to omit and note as a follow-up.
- Exact wording of the "coming soon" indicator for Legends/Icons pool checkboxes.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` §Draft Mode (DRAFT) — DRAFT-01, DRAFT-02, DRAFT-03 definitions (lines 29-39); DRAFT-11 (Legends/Icons, deferred, line 50); coverage table (lines 83-92, noted as possibly stale re: phase numbering above)

### Roadmap

- `.planning/ROADMAP.md` §Phase 27 — Goal statement (game-creation-settings)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/client/src/components/LobbyScreen.tsx` — "Create Room" button emits `ClientEvents.ROOM_CREATE` (no payload today, ~line 50/71); "Join Room" emits `ClientEvents.ROOM_JOIN` (line 110). New settings screen slots in after Create Room, before existing post-create flow.
- `packages/client/src/App.tsx` — screen router via string switch (lines 208-237): `GAME_BOARD`/`REPLAY` → `LINEUP_ASSIGNMENT` → `UNIFORM_SELECTION` → `TEAM_SELECTION` → else `LobbyScreen`. Local `selectedSpeed` state (line 34), `handleSpeedChange` (lines 179-182).
- `packages/client/src/store/useGameStore.ts` — `Screen` union type (lines 23-29) currently includes `'LANDING' | 'CREATE_ROOM' | 'WAITING' | 'TEAM_SELECTION' | ...`; add a new member (e.g. `'GAME_SETTINGS'`) following this same flat state-machine pattern. `setScreen` action (line 280). `emitTeamSpeed` (line 173/957-959) emits `ClientEvents.TEAM_SPEED_SET`.
- `packages/client/src/components/TeamSelectionScreen.tsx` — current interactive speed selector (lines 54-143, `SPEED_OPTIONS` array + `.speedSelector` block), takes `selectedSpeed`/`onSpeedChange` props. Convert this block to read-only per D-07.
- `packages/client/src/components/UniformSelectionScreen.tsx` — duplicate speed picker (lines 97-219, `.speedBlock` / "MATCH SPEED" section). Same conversion applies.
- `packages/server/src/roomHandlers.ts` — `ROOM_CREATE`/`ROOM_JOIN` handlers (~lines 124-165, call `createRoom`/`joinRoom` from `roomStore.ts`); `TEAM_SPEED_SET` handling (line 259), `VALID_GAME_SPEEDS` allow-list (line 65), home-slot-only guard (~line 272), sets `room.gameSpeed` (line 287), broadcasts `ServerEvents.TEAM_SPEED_CHANGED` (line 289) — this broadcast-on-change pattern is the model for D-02's settings sync on join.
- `packages/shared/src/events.ts` — `ClientEvents.ROOM_CREATE` (line 124), `ROOM_JOIN` (line 125), `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` (lines 178, 220). New settings-confirm event(s) and payload additions to `ROOM_CREATE`/join-response follow this file's existing event-definition pattern.
- `packages/shared/src/types.ts` — `GameSpeed = 'slow'|'standard'|'fast'` (line 433), `GAME_SPEED_MINUTES` map (line 439), `gameSpeed: GameSpeed` field on room state (line 519). New `TeamType` ('standard'|'draft') and draft-pool-selection types belong alongside these.
- `packages/server/src/roomStore.ts` — `createRoom`/`joinRoom`/`getRoom`; room object holds `gameSpeed` — extend with team type + draft pool fields.

### Established Patterns

- Screens are a flat string-based state machine in Zustand (`useGameStore.screen`), transitioned via `setScreen()` calls driven from `App.tsx` socket event handlers. No formal wizard/stepper abstraction — inserting the new pre-step screen means adding a new `Screen` union member and a branch in `App.tsx`'s switch, same as how `LINEUP_ASSIGNMENT`/`UNIFORM_SELECTION` were added.
- Speed is currently host-controlled server-side (home-slot-only guard in `roomHandlers.ts`) — the new settings-confirm flow should follow this same host-authority pattern.
- No existing "Standard vs Draft" concept anywhere in the codebase (types, enums, or flags) — this is entirely new and must be introduced in `packages/shared/src/types.ts` first so both client and server import the same definitions.

### Integration Points

- `App.tsx` screen switch — add new settings screen branch before the `TEAM_SELECTION` branch, host-only.
- `roomHandlers.ts` `ROOM_CREATE`/`ROOM_JOIN` — settings confirm event and join-time settings broadcast both live here.
- `TeamSelectionScreen.tsx` / `UniformSelectionScreen.tsx` — both need their interactive speed block converted to read-only subheader.
- Scoreboard component (in-game, not yet located precisely — locate during planning) — optional small speed mention per D-08.

</code_context>

<specifics>
## Specific Ideas

- Read-only subheader treatment (D-07/D-09): same visual element/style used for both the relocated Standard-mode speed label and the Draft-mode settings summary line — one consistent non-interactive info-subheader pattern, not two different UI treatments.
- Scoreboard speed reminder (D-08): "if it fits" — soft requirement, not a hard blocker if scoreboard layout doesn't accommodate it cleanly.

</specifics>

<deferred>
## Deferred Ideas

- Legends and Icons draft pools being selectable (DRAFT-11) — out of scope for this phase; checkboxes shown but disabled with "coming soon" treatment (D-04).
- Editing settings after host confirms (e.g., an "Edit" link back from the Draft summary) — explicitly decided against (D-03, D-09); settings are locked once confirmed.

### Reviewed Todos (not folded)

None — the 4 pending todos (GK_KICK replay visibility, KICK_OFF_SETUP shading, header-winner eligibility, CSV consolidation) all scored low relevance to this phase (generic keyword matches only, e.g. "phase", "goal") and are unrelated to game-creation settings.

</deferred>

---

_Phase: 27-Game-Creation-Settings_
_Context gathered: 2026-07-20_
