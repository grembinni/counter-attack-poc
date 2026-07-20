# Phase 27: Game Creation Settings - Research

**Researched:** 2026-07-20
**Domain:** Client screen-state-machine insertion + server room-lifecycle event addition (React/Zustand + Socket.io, existing monorepo — no new external packages)
**Confidence:** HIGH (all claims verified by direct file reads of current repo state, not training-data assumptions)

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Settings Screen Trigger & Flow**

- D-01: The settings pre-step appears for the host only, immediately after "Create Room" — before a joiner is required. The host is not blocked waiting for a second player to configure settings.
- D-02: The joining player does not see the settings screen at all. When they join the room, the server broadcasts the confirmed settings (speed, team type, draft pool) to them as part of the room/join payload — the same pattern as the existing `TEAM_SPEED_CHANGED` broadcast (see `roomHandlers.ts`).
- D-03: Settings are locked once the host confirms them on the pre-step screen — no re-editing after confirm, for either player, for the rest of that match.

**Draft Pool Selection UI**

- D-04: All five pool checkboxes (Original, MLS, International, Legends, Icons) are shown when Team Type = Draft, but Legends and Icons are disabled/greyed with a "coming soon" indicator — only Original/MLS/International are selectable in this phase (Legends/Icons pools are DRAFT-11, deferred).
- D-05: Original is pre-checked by default when Draft mode is first selected, so the Confirm button is never blocked by an initial all-empty state.
- D-06: The Confirm/Continue button is disabled (not clickable) whenever zero of the three enabled pools are checked — no inline error message needed since the invalid state is unreachable.

**Standard Mode Speed Relocation**

- D-07: The speed control remains visible on both `TeamSelectionScreen.tsx` and `UniformSelectionScreen.tsx`, but is converted from an interactive picker to the same read-only info-subheader element used for the Draft-mode settings summary (D-09). The actual speed selection only happens once, on the new pre-step settings screen.
- D-08: The confirmed speed also gets a small read-only mention on the in-game scoreboard during gameplay, if it fits the existing scoreboard layout, as a reminder to both players of the active match speed.

**Draft Mode Settings Summary**

- D-09: On the Draft-mode team-selection screen, the settings summary (`Speed | Team Type | Draft Pool`) is a read-only info subheader — same non-interactive treatment as D-07's relocated Standard-mode speed label. No edit-back link, consistent with settings being locked per D-03.

### Claude's Discretion

- Exact subheader visual styling/placement (font size, position within TeamSelectionScreen/UniformSelectionScreen layout) — follow existing subheader/label patterns in those components.
- Whether the scoreboard speed mention (D-08) is technically feasible without layout rework; if it doesn't fit cleanly, it's acceptable to omit and note as a follow-up.
- Exact wording of the "coming soon" indicator for Legends/Icons pool checkboxes.

### Deferred Ideas (OUT OF SCOPE)

- Legends and Icons draft pools being selectable (DRAFT-11) — out of scope for this phase; checkboxes shown but disabled with "coming soon" treatment (D-04).
- Editing settings after host confirms (e.g., an "Edit" link back from the Draft summary) — explicitly decided against (D-03, D-09); settings are locked once confirmed.
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID       | Description                                                                                                                                                                                                                                         | Research Support                                                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DRAFT-01 | Game creation includes a pre-step screen for game settings: speed selector, team type (Standard / Draft), and — if Draft selected — player pool checkboxes (Original, MLS, International, Legends, Icons; at least one of the first three required) | New `GameSettingsScreen.tsx` component + `GAME_SETTINGS` screen-union member + host-only server confirm event (see Architecture Patterns)                                                     |
| DRAFT-02 | In Standard mode the existing team-selection flow is unchanged; the speed setting moves off the team-selection page to the settings pre-step                                                                                                        | Convert `TeamSelectionScreen.tsx`/`UniformSelectionScreen.tsx` interactive speed picker to read-only subheader (exact current line ranges below); speed only settable on `GameSettingsScreen` |
| DRAFT-03 | In Draft mode, team-selection flow is the same as Standard but with a settings summary line (Speed \| Team type \| Draft pool) replacing the speed picker                                                                                           | Same subheader element, conditional copy driven by `teamType` prop threaded from `App.tsx`                                                                                                    |

**Note on REQUIREMENTS.md staleness:** REQUIREMENTS.md's traceability table (lines 83-85) maps DRAFT-01/02/03 to "Phase 28", but ROADMAP.md's Phase 27 goal text matches these three requirements verbatim, and ROADMAP.md's own Phase 28 section covers DRAFT-04/05 (Draft Data Model) — confirming ROADMAP.md is correct and REQUIREMENTS.md's table is the stale artifact (pre-dates the Phase 27 "response-activation-model" removal / renumbering, per CONTEXT.md's own note). Flag to user before milestone close.
</phase_requirements>

## Summary

This phase is a pure internal-codebase feature addition: insert one new client screen (`GAME_SETTINGS`) into an existing flat Zustand string-union state machine, add one new host-authenticated Socket.io event pair to an existing room-lifecycle handler file, and convert two already-duplicated interactive speed pickers into their pre-existing read-only sibling markup. No new npm packages are required — the entire feature is built from patterns already established in `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED`, `LINEUP_CONFIRM`'s both-confirm gate, and the existing `.speedOptionActive` visitor-view CSS.

The single non-obvious design problem this phase must solve (not fully specified in CONTEXT.md) is a **race condition**: D-01 says the host must not be blocked waiting for a joiner, meaning a second player can join the room _before_ the host confirms settings. But D-02 requires the joiner to receive confirmed settings "as part of the room/join payload" and to never see the settings screen. Today, `ROOM_JOIN`'s success path unconditionally emits `TEAM_SELECTION_START` to the whole room the instant slot 2 joins (`roomHandlers.ts:194`) — if this fires before the host has confirmed settings, the joiner (and host) would be routed to team selection with no settings ever chosen. This research's recommended fix (detailed in Architecture Patterns) is a **both-conditions gate**: `TEAM_SELECTION_START` fires only once _both_ "slot 2 has joined" AND "host has confirmed settings" are true — mirroring the existing `LINEUP_CONFIRM` both-confirm-flags pattern already in this file, just with one flag pre-satisfied (host settings) instead of two symmetric ones.

**Primary recommendation:** Add a `GAME_SETTINGS` screen rendered as a new top-level sibling component to `LobbyScreen`/`TeamSelectionScreen`/`UniformSelectionScreen` in `App.tsx`'s ternary (not nested inside `LobbyScreen`). Add one consolidated `ClientEvents.ROOM_SETTINGS_CONFIRM` event (payload: `{ speed, teamType, draftPools }`) instead of extending `TEAM_SPEED_SET` — this keeps the three settings atomic and locked together per D-03, and lets `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` become dead code (flagged as a cleanup note, not required to delete this phase). Gate `TEAM_SELECTION_START` on a new `room.settingsConfirmed` boolean, following the `homeLineupConfirmed`/`awayLineupConfirmed` dual-flag precedent in `roomHandlers.ts`.

## Architectural Responsibility Map

| Capability                                                           | Primary Tier                                               | Secondary Tier | Rationale                                                                                                                                                                                          |
| -------------------------------------------------------------------- | ---------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Settings screen UI (speed/team-type/pool selection)                  | Frontend (React component)                                 | —              | Pure client-rendered form; no server round-trip needed until Confirm                                                                                                                               |
| Settings confirm authority (host-only, one-shot lock)                | API / Backend (Socket.io handler)                          | —              | Server is the single source of truth for "who is host" (`socket.data.playerSlot`) and for locking — mirrors existing `TEAM_SPEED_SET`'s home-only guard and `room.gameState !== null` freeze guard |
| Settings persistence for the room's lifetime                         | API / Backend (in-memory `Room` object in `roomStore.ts`)  | —              | Room-scoped state before `GameState` exists; same tier that already holds `gameSpeed`, `homePickedTeam`, etc.                                                                                      |
| Settings delivery to late-joining player                             | API / Backend → Client                                     | —              | Server decides timing (join-time vs. deferred-until-confirm) per the race-condition fix below; client only renders what it receives                                                                |
| Read-only settings subheader (Standard/Draft team-selection screens) | Frontend (React component)                                 | —              | Presentation-only; derives from props already threaded through `App.tsx` local state                                                                                                               |
| Scoreboard speed mention (D-08, soft)                                | Frontend (React component)                                 | —              | `gameState.gameSpeed` is already embedded in every `GameState` broadcast (`types.ts:519`) — zero new plumbing needed, pure UI addition                                                             |
| Screen routing / state machine                                       | Frontend (Zustand store `Screen` union + `App.tsx` switch) | —              | Existing flat string-union pattern, no new abstraction needed                                                                                                                                      |

## Standard Stack

No new packages are required for this phase. It is built entirely from libraries and patterns already present in the monorepo.

### Core (existing, reused)

| Library                      | Version (installed)                                                                                                         | Purpose                                                                               | Why Standard                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| React                        | 18.3.1 [VERIFIED: packages/client/package.json]                                                                             | New `GameSettingsScreen.tsx` component                                                | Matches every other screen component in the codebase                                      |
| Zustand                      | 4.5.7 [VERIFIED: packages/client/package.json]                                                                              | `Screen` union extension (`GAME_SETTINGS` member) + `setScreen`                       | Existing state machine mechanism (D-12 pattern, STATE.md)                                 |
| socket.io / socket.io-client | 4.x [VERIFIED: packages/client/package.json, ^4.8.3 client / server side uses matching 4.x per STATE.md "Decisions Locked"] | New `ROOM_SETTINGS_CONFIRM` client event + `ROOM_SETTINGS_CONFIRMED` server broadcast | Existing typed-event pattern in `events.ts`                                               |
| CSS Modules                  | n/a (build-time, Vite)                                                                                                      | New `GameSettingsScreen.module.css`                                                   | Matches hand-rolled dark-theme convention confirmed in 27-UI-SPEC.md (no shadcn/Tailwind) |

**Installation:** None — no `npm install` step for this phase.

## Package Legitimacy Audit

**Not applicable.** This phase introduces zero new external dependencies — it is a pure application of existing project patterns (Socket.io events, Zustand screen union, React components, CSS Modules) already vetted in prior phases. No `package-legitimacy check` run is required.

## Architecture Patterns

### Screen State Machine — Exact Current Shapes (verified against live source, not CONTEXT.md snapshot)

**`packages/client/src/store/useGameStore.ts`:**

- `Screen` union is defined at **lines 23-32** (CONTEXT.md said "lines 23-29" — this undercounts; the union has 9 members, not counted correctly in the snapshot):
  ```typescript
  export type Screen =
    | 'LANDING'
    | 'CREATE_ROOM'
    | 'JOIN_ROOM'
    | 'WAITING'
    | 'TEAM_SELECTION' // Phase 16 D-10: team selection screen before game board
    | 'UNIFORM_SELECTION' // Phase 22: combined team + style pre-game screen (D-01)
    | 'LINEUP_ASSIGNMENT' // Phase 24: standalone lineup assignment screen (D-13)
    | 'GAME_BOARD'
    | 'REPLAY';
  ```
  Add `'GAME_SETTINGS'` as a new member — recommended position: immediately after `'WAITING'` and before `'TEAM_SELECTION'`, since it is reached before either team-selection path.
- `setScreen: (s) => set({ screen: s })` — **line 280**, exact match to CONTEXT.md. No change needed to this action; `setScreen('GAME_SETTINGS')` works immediately once the union member exists.

**`packages/client/src/App.tsx`:**

- The top-level ternary (**lines 208-238**, confirmed) currently is: `GAME_BOARD`/`REPLAY` → `<GameBoard/>`, `LINEUP_ASSIGNMENT` → `<LineupAssignmentScreen/>`, `UNIFORM_SELECTION` → `<UniformSelectionScreen/>`, `TEAM_SELECTION` → `<TeamSelectionScreen/>`, else → `<LobbyScreen/>`.
- **Critical finding not in CONTEXT.md:** the `screen === 'TEAM_SELECTION'` branch (line 229) is **currently unreachable dead code** in the live app. Every code path that could set the screen to team selection actually calls `setScreen('UNIFORM_SELECTION')` instead — see `onTeamSelectionStart` (line 90-94: _"Phase 22: route straight to UNIFORM_SELECTION — single combined team+uniform screen (no tabs)."_). A `grep` for `setScreen('TEAM_SELECTION')` across the entire client `src/` tree returns zero matches. `TeamSelectionScreen.tsx` is exercised only by its own component test (`TeamSelectionScreen.test.tsx`), which renders it directly (bypassing `App.tsx` routing entirely). **This means the "team-selection screen" the two success criteria in the phase goal describe is `UniformSelectionScreen.tsx` in the live product, not `TeamSelectionScreen.tsx`.** D-07 explicitly names both files, so both must still be edited for consistency and test coverage, but the planner and user should know `TeamSelectionScreen.tsx`'s conversion has no live-app user-facing effect today — flag this to the user as a discrepancy from CONTEXT.md, which did not surface it.
- `LandingScreen`'s "Create Game" button (`LobbyScreen.tsx:50`) emits `ClientEvents.ROOM_CREATE` **without any local `setScreen` call**. The screen only actually advances once the server's `ROOM_JOINED` event arrives and `onRoomJoined` (App.tsx:60-70) runs `if (slot === 1 && (s === 'LANDING' || s === 'CREATE_ROOM')) setScreen('WAITING')`. **This is the exact and only insertion point for `GAME_SETTINGS`:** change this line to `setScreen('GAME_SETTINGS')` instead of `setScreen('WAITING')` for the slot-1 (host) case. The host then explicitly transitions to `'WAITING'` themselves (client-side, no server round trip needed — mirrors how clicking "Join Game" locally calls `setScreen('JOIN_ROOM')`) after their `ROOM_SETTINGS_CONFIRM` emit succeeds.
- `selectedSpeed` local state: `App.tsx:34` (`useState<GameSpeed>('standard')`), exact match to CONTEXT.md. `handleSpeedChange` at `App.tsx:179-182`, exact match. These become the values threaded into the new `GameSettingsScreen` (as the _only_ place they are set) and into the two read-only subheaders (display only, no more `onSpeedChange` prop needed on either screen once converted).

### Recommended Screen Insertion Flow (data-flow diagram)

```
Host clicks "Create Game" (LobbyScreen LandingScreen)
        │  emits ROOM_CREATE (no payload)
        ▼
Server: createRoom() → ROOM_JOINED(code, slot=1, token)
        │
        ▼
Client onRoomJoined(slot=1): setScreen('GAME_SETTINGS')  ◄── CHANGED (was 'WAITING')
        │
        ▼
GameSettingsScreen renders (speed selector, Standard/Draft toggle, pool checkboxes if Draft)
        │  host clicks "Confirm Settings"
        │  emits ROOM_SETTINGS_CONFIRM({ speed, teamType, draftPools })
        ▼
Server roomHandlers.ts: validate allow-lists, playerSlot===1, room.gameState===null
        │  room.gameSpeed = speed; room.teamType = teamType; room.draftPools = draftPools
        │  room.settingsConfirmed = true
        │  io.to(roomCode).emit(ROOM_SETTINGS_CONFIRMED, speed, teamType, draftPools)
        │  if (room.players[1] !== null) io.to(roomCode).emit(TEAM_SELECTION_START)  ◄── gate
        ▼
Client (host) onRoomSettingsConfirmed(...): store speed/teamType/draftPools locally
        │  host explicitly: setScreen('WAITING')  ◄── client-side, no server round trip
        ▼
   ... (host waits, joiner joins whenever, in parallel with the above) ...

Joiner emits ROOM_JOIN(code)
        ▼
Server ROOM_JOIN success: assign slot 2, emit ROOM_JOINED(code, 2, token) to joiner
        │  if (room.settingsConfirmed) {
        │    socket.emit(ROOM_SETTINGS_CONFIRMED, room.gameSpeed, room.teamType, room.draftPools)  // join-time delivery, D-02
        │    io.to(roomCode).emit(TEAM_SELECTION_START)
        │  }
        │  // else: do nothing further — TEAM_SELECTION_START is deferred until
        │  // the GAME_SETTINGS_CONFIRM handler above observes room.players[1] !== null
        ▼
Both clients: onTeamSelectionStart() → setScreen('UNIFORM_SELECTION')  (existing, unchanged)
```

This closes the race: whichever of {host confirms settings, joiner joins} happens second is the one that actually fires `TEAM_SELECTION_START`. Neither ordering produces a joiner who reaches team selection without settings, and the host is never blocked on the joiner (D-01 preserved).

### Host Authority Pattern — Exact Current Shape

`roomHandlers.ts`'s `TEAM_SPEED_SET` handler (**lines 259-290**, exact match to CONTEXT.md's cited line 259) is the direct template to copy for the new confirm handler:

```typescript
// Source: packages/server/src/roomHandlers.ts:259-290 (current, verbatim structure)
socket.on(ClientEvents.TEAM_SPEED_SET, (speed: GameSpeed) => {
  const roomCode = socket.data.roomCode;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room) return;
  if (!(VALID_GAME_SPEEDS as readonly string[]).includes(speed)) {
    socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SPEED');
    return;
  }
  if (socket.data.playerSlot !== 1) {
    // ← host-only guard, reuse verbatim
    socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
    return;
  }
  if (room.gameState !== null) {
    // ← "before game starts" freeze guard, reuse verbatim
    socket.emit(ServerEvents.GAME_ERROR, 'GAME_ALREADY_STARTED');
    return;
  }
  room.gameSpeed = speed;
  io.to(roomCode).emit(ServerEvents.TEAM_SPEED_CHANGED, speed);
});
```

**Important nuance confirmed by direct read:** this guard checks `room.gameState !== null`, **not** `room.status === 'waiting'`. This means `TEAM_SPEED_SET` (and, by extension, the new settings-confirm handler using the identical guard shape) is _already_ callable by the host before a joiner exists — `room.status` only flips from `'waiting'` to `'playing'` inside `joinRoom()` (`roomStore.ts:238`), and `gameState` stays `null` until `LINEUP_CONFIRM`. This directly enables D-01 with zero server-side authority changes beyond copying the existing guard shape.

### Room / Type Additions (recommended shapes)

**`packages/shared/src/types.ts`** — add alongside `GameSpeed` (line 433):

```typescript
/** DRAFT-01/02/03 (Phase 27): team type selected on the pre-game settings screen. */
export type TeamType = 'standard' | 'draft';

/** DRAFT-01 (Phase 27): selectable draft player pools. Legends/Icons exist in the type
 *  for forward-compat with DRAFT-11 but are NOT selectable in this phase (D-04) — the
 *  server-side allow-list for the confirm handler must reject them even though the
 *  client renders their (disabled) checkboxes. */
export type DraftPoolId = 'original' | 'mls' | 'international' | 'legends' | 'icons';

/** DRAFT-01 (Phase 27): pools selectable in v1.4 — Legends/Icons excluded (D-04, DRAFT-11 deferred). */
export const SELECTABLE_DRAFT_POOLS: readonly DraftPoolId[] = [
  'original',
  'mls',
  'international',
] as const;
```

No existing `sourceTeamId`/pool concept exists anywhere in `packages/shared/src` today (confirmed via grep) — this is a genuinely new vocabulary introduced by this phase, exactly as CONTEXT.md's "Established Patterns" section states.

**`packages/server/src/roomStore.ts`** `Room` type — add alongside `gameSpeed?: GameSpeed` (line 81):

```typescript
/** DRAFT-01 (Phase 27): team type confirmed on the settings pre-step. undefined until confirmed. */
teamType?: TeamType;
/** DRAFT-01 (Phase 27): draft pools confirmed on the settings pre-step (only meaningful if teamType === 'draft'). */
draftPools?: DraftPoolId[];
/** DRAFT-01/D-03 (Phase 27): true once host has confirmed settings — gates TEAM_SELECTION_START
 *  alongside "slot 2 has joined" (see roomHandlers.ts ROOM_SETTINGS_CONFIRM / ROOM_JOIN). */
settingsConfirmed?: boolean;
```

**`packages/shared/src/events.ts`** — new event pair, following the exact `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` naming convention but namespaced under `room:` (this is room-lifecycle-adjacent, pre-team-selection, like `ROOM_CREATE`/`ROOM_JOIN`):

```typescript
// ClientEvents
ROOM_SETTINGS_CONFIRM: 'room:settings-confirm',
// ClientToServerEvents
[ClientEvents.ROOM_SETTINGS_CONFIRM]: (
  settings: { speed: GameSpeed; teamType: TeamType; draftPools: DraftPoolId[] }
) => void;

// ServerEvents
ROOM_SETTINGS_CONFIRMED: 'room:settings-confirmed',
// ServerToClientEvents
[ServerEvents.ROOM_SETTINGS_CONFIRMED]: (
  speed: GameSpeed, teamType: TeamType, draftPools: DraftPoolId[]
) => void;
```

Sending three positional args on `ROOM_SETTINGS_CONFIRMED` (rather than one object) matches the project's established positional-args convention for server→client broadcasts (`TEAM_SPEED_CHANGED(speed)`, `UNIFORM_HOME_CONFIRMED(teamId, uniformStyle, formationId)`), while the client→server confirm event can use a single object payload since it has three related, always-sent-together fields (there is no strong existing precedent either way for client→server; `LINEUP_SWAP`/`LINEUP_CONFIRM` already use an object payload for their multi-field client→server events, so an object here is consistent).

### Read-Only Subheader Conversion — Exact Current Markup

**`TeamSelectionScreen.tsx`:** `SPEED_OPTIONS` array at **lines 55-59** (not "54-143" as CONTEXT.md's line range suggested — that range conflated the const declaration with the JSX block). The actual interactive/read-only ternary is the `.speedSelector` div at **lines 117-146**:

```tsx
// Source: packages/client/src/components/TeamSelectionScreen.tsx:117-146 (current)
<div className={styles.speedSelector}>
  <span className={styles.statusLine}>Match speed:</span>
  {iAmHome ? (
    <div className={styles.speedOptions}>{/* interactive buttons, lines 120-137 */}</div>
  ) : (
    <span
      className={`${styles.speedOptionActive} ${styles[selectedOption?.colorClass ?? 'speedColorStandard']}`}
    >
      <span className={styles.speedIcon}>{selectedOption?.icon}</span>
      {selectedOption?.label ?? selectedSpeed}
    </span>
  )}
</div>
```

The read-only branch (visitor view, lines 139-145) **already exists exactly as CONTEXT.md described** and is the correct element to reuse — D-07's conversion is: delete the `iAmHome ? <interactive> : <readonly>` ternary and always render the `<readonly>` branch (the `iAmHome`-gated interactive branch, lines 120-137, is deleted entirely). The `onSpeedChange` prop becomes unused by this component after conversion — flag for removal from `Props` (currently `TeamSelectionScreen.tsx:69`).

**`UniformSelectionScreen.tsx`:** `SPEED_OPTIONS` at **lines 98-102**. The `.speedBlock`/`.speedRow` JSX spans **lines 190-224** (CONTEXT.md said "97-219" — close but the closing tag is actually at 224, and 97 conflates with the const array). Same ternary shape (`iAmHome ? <interactive> : <readonly>`, readonly branch at lines 213-221) — same conversion: always render the readonly branch, delete the interactive branch and the `onSpeedChange` prop.

**Both files currently declare their own copy of `SPEED_OPTIONS`** (byte-identical arrays). A third copy will be needed inside the new `GameSettingsScreen.tsx` (the only place speed is still interactively chosen). This crosses the "rule of three" duplication threshold — **recommend extracting `SPEED_OPTIONS` to a small shared client module** (e.g. `packages/client/src/constants/speedOptions.ts`) imported by all three components, rather than adding a third inline copy. This is a net line-count reduction and removes a footgun (the two existing copies could already drift silently).

### Draft-Mode Settings Summary (D-09)

Both screens need one additional prop: `teamType: TeamType` and `draftPools: DraftPoolId[]` (threaded from the same `App.tsx` local state that will hold the confirmed settings, alongside existing `selectedSpeed`). Recommend computing the subheader **content** once in `App.tsx` (or a small shared helper) rather than duplicating the `teamType === 'draft' ? ... : ...` branch inside both screen components — pass a single already-formatted string or a small `{ mode: 'speed' | 'summary', text: string }` prop so both screens only need to render one read-only `<span>` with whatever content they're given. This keeps the two screen components from needing to know about `DraftPoolId` formatting logic at all.

### GameSettingsScreen — Recommended Shape

A new top-level component (sibling to `LobbyScreen`, not nested inside it, per the UI-SPEC's "renders host-only... insert as its own screen" framing and because `TeamSelectionScreen`/`UniformSelectionScreen` are already siblings rendered directly by `App.tsx`, not by `LobbyScreen`):

```
packages/client/src/components/
├── GameSettingsScreen.tsx        # new
├── GameSettingsScreen.module.css # new (duplicate relevant tokens from LobbyScreen.module.css
│                                 #      per existing project convention — TeamSelectionScreen.module.css
│                                 #      and UniformSelectionScreen.module.css already independently
│                                 #      duplicate .speedOption* classes rather than sharing a base;
│                                 #      following that precedent is lower-risk than introducing the
│                                 #      project's first shared CSS partial)
```

Props needed: `onConfirm: (settings: { speed: GameSpeed; teamType: TeamType; draftPools: DraftPoolId[] }) => void`. All other state (selected speed, team type, checked pools) is local `useState` inside the component, matching the pattern in `UniformSelectionScreen.tsx` (local `selectedTeam`/`selectedStyle`/`selectedFormation` state, single `onConfirm` callback bundling everything at confirm time).

Use the `.page`/`.card` shell classes from `LobbyScreen.module.css` (lines 26-44) as the visual base per the UI-SPEC's explicit instruction ("Use the same `.page` / `.card` centered-column shell as `LobbyScreen.tsx`").

### Anti-Patterns to Avoid

- **Do not extend `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` to also carry `teamType`/`draftPools`.** These three settings must lock together atomically per D-03; a single new consolidated event is simpler to reason about and to guard (one allow-list validation block, one `settingsConfirmed` flag) than trying to layer team-type/pool validation onto an event whose name and existing call sites imply "speed only."
- **Do not gate `TEAM_SELECTION_START` solely on `ROOM_JOIN`** (today's behavior) once this phase ships — this is the exact race condition described in the Summary. Any plan that does not add the `room.settingsConfirmed` gate will intermittently let a joiner reach team selection with default/unset settings if they join before the host confirms.
- **Do not add `GAME_SETTINGS` as a case inside `LobbyScreen.tsx`'s internal switch.** `TeamSelectionScreen`/`UniformSelectionScreen` establish the convention that "screens needing their own confirm-flow props" are top-level `App.tsx` ternary branches, not nested inside `LobbyScreen`.

## Don't Hand-Roll

| Problem                                                      | Don't Build                              | Use Instead                                                                                                                                                     | Why                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host-only server authority check                             | New "isHost" helper/abstraction          | `socket.data.playerSlot !== 1` inline guard (copy `TEAM_SPEED_SET`'s exact shape)                                                                               | Every existing host-gated handler (`TEAM_SPEED_SET`, `TEAM_PICK` home-branch) uses this identical one-line check; introducing an abstraction for a single new handler adds indirection with no reuse payoff yet               |
| Both-conditions gate (settings confirmed AND joiner present) | A generic "game start conditions" engine | Two boolean-ish checks mirroring `LINEUP_CONFIRM`'s `homeLineupConfirmed`/`awayLineupConfirmed` both-confirm pattern (`roomHandlers.ts:504-513`)                | Same shape already proven in this exact file for a structurally identical problem (wait for two independent conditions before firing the next-phase broadcast)                                                                |
| Draft pool checkbox disabled/greyed styling                  | New disabled-treatment CSS               | Reuse `.card:disabled { opacity: 0.4 }` treatment already specified in 27-UI-SPEC.md's Interaction Notes                                                        | UI-SPEC explicitly calls this out as the existing pattern to reuse                                                                                                                                                            |
| Allow-list validation for new `teamType`/`draftPools` fields | Ad hoc `if` chains                       | `readonly X[]` allow-list array + `.includes()` check, exact shape of `VALID_GAME_SPEEDS`/`VALID_TEAM_IDS`/`VALID_UNIFORM_STYLE_IDS` in `roomHandlers.ts:49-76` | This project has a single consistent ASVS V5 allow-list pattern already used for every enum-like client payload; deviating from it for the two new enums would be inconsistent and lose the established test-review shorthand |

**Key insight:** Every mechanism this phase needs (host authority, both-conditions gating, allow-list validation, read-only vs. interactive UI toggling) already exists at least once in this codebase in near-identical shape. This phase is best planned as "clone and adapt three existing patterns," not as new design.

## Common Pitfalls

### Pitfall 1: Forgetting the settings-confirmed / joiner-present race

**What goes wrong:** `TEAM_SELECTION_START` fires from `ROOM_JOIN` before the host has clicked "Confirm Settings," so the joiner (and possibly the host, if their client hasn't processed the confirm response yet) reach team selection with default/stale `gameSpeed`/`teamType`.
**Why it happens:** The current `ROOM_JOIN` handler (`roomHandlers.ts:191-194`) unconditionally emits `TEAM_SELECTION_START` the moment slot 2 joins — this line predates the settings-screen concept entirely and was correct before this phase.
**How to avoid:** Gate the `TEAM_SELECTION_START` emit in both `ROOM_JOIN` and the new confirm handler on `room.settingsConfirmed && room.players[1] !== null` (see the data-flow diagram above).
**Warning signs:** Integration test that joins immediately after create (no delay) and asserts on team-selection settings values will flake if this gate is missing.

### Pitfall 2: Speed prop wiring breaks TeamSelectionScreen's existing unit tests

**What goes wrong:** `TeamSelectionScreen.test.tsx` renders the component directly and passes `{ selectedSpeed: 'standard', onSpeedChange: vi.fn() }` in `DEFAULT_SPEED_PROPS` (lines 22-25). If `onSpeedChange` is removed from `Props` but the test file isn't updated, TypeScript will fail the build (excess property on an object literal is usually just an unused prop, not a compile error, unless `Props` uses `exact` typing — but removing a _required_ prop the test still supplies is harmless; removing `selectedSpeed` would break rendering assertions).
**Why it happens:** The component's test file is the only thing currently exercising `TeamSelectionScreen.tsx` (see the dead-code finding above) — it must be updated in lockstep with the prop signature change.
**How to avoid:** When converting the props, update `TeamSelectionScreen.test.tsx`'s `DEFAULT_SPEED_PROPS` in the same task/commit; do not leave `onSpeedChange` on it if the prop is removed (stale prop won't break TS compile but signals incomplete cleanup).
**Warning signs:** `tsc --noEmit` still passes even with a leftover unused prop in a test fixture — this is a silent gap, not a compiler-caught one. Add it explicitly to task verification steps.

### Pitfall 3: New `DraftPoolId` allow-list must reject `'legends'`/`'icons'` server-side even though the client renders their checkboxes

**What goes wrong:** If the server's allow-list for `ROOM_SETTINGS_CONFIRM`'s `draftPools` array accepts all five `DraftPoolId` values (because the type includes them for forward-compat), a modified/malicious client could select Legends/Icons even though D-04 says they're disabled client-side only.
**Why it happens:** `DraftPoolId` as a TypeScript type must include all 5 values (so DRAFT-11 doesn't require a breaking type change later), but the _validation allow-list_ used in the handler must be the narrower `SELECTABLE_DRAFT_POOLS` (3 values), not the full type's keys.
**How to avoid:** Use `SELECTABLE_DRAFT_POOLS` (the 3-value const) for the server-side `.every(p => SELECTABLE_DRAFT_POOLS.includes(p))` check, not `Object.values` of the 5-value type. This is the same "type is broader than the current allow-list" pattern already present for `VALID_TEAM_IDS` (12 teams, all currently selectable) — this phase is actually the _first_ case in the codebase where the type and the allow-list intentionally diverge, so there's no existing copy-paste template for this specific detail; call it out explicitly in the plan's verification steps (ASVS V5).
**Warning signs:** A test that emits `ROOM_SETTINGS_CONFIRM` with `draftPools: ['legends']` and asserts `GAME_ERROR` should be added — this exact case has no precedent test to copy from.

### Pitfall 4: Draft pool "at least one required" check must apply only when `teamType === 'draft'`

**What goes wrong:** If the server validates `draftPools.length >= 1` unconditionally, a Standard-mode confirm (which has no meaningful pool selection) could be rejected if the client sends an empty array for `draftPools` in Standard mode.
**Why it happens:** DRAFT-01's "at least one of the first three required" constraint is conditional on Draft mode being selected at all.
**How to avoid:** Structure the handler validation as: if `teamType === 'draft'`, require `draftPools.length >= 1` and each entry in `SELECTABLE_DRAFT_POOLS`; if `teamType === 'standard'`, `draftPools` should be ignored/empty (client sends `[]` or the field is optional in that case — decide one convention and validate it explicitly, don't leave it implicit).
**Warning signs:** A test with `teamType: 'standard', draftPools: []` should pass; a test with `teamType: 'draft', draftPools: []` should fail with a specific error reason (recommend `'DRAFT_POOL_REQUIRED'`, following the existing `INVALID_SPEED`/`INVALID_TEAM`/`WRONG_TURN` naming convention).

## Code Examples

### Both-confirm-style gate (adapt from existing `LINEUP_CONFIRM`)

```typescript
// Source: packages/server/src/roomHandlers.ts:504-513 (existing, for LINEUP_CONFIRM)
// Both-confirm gate (Pitfall 4): only start game when BOTH flags are true.
if (!room.homeLineupConfirmed || !room.awayLineupConfirmed) {
  return; // still waiting for the other player
}
```

Adapt to this phase's asymmetric gate (one side is "settings confirmed", the other is "joiner present" — not two symmetric per-player flags):

```typescript
// New: in the ROOM_SETTINGS_CONFIRM handler, after storing settings:
room.settingsConfirmed = true;
if (room.players[1] !== null) {
  io.to(roomCode).emit(ServerEvents.TEAM_SELECTION_START);
}
// New: in the ROOM_JOIN success path, replacing the current unconditional emit at line 194:
if (room.settingsConfirmed) {
  socket.emit(
    ServerEvents.ROOM_SETTINGS_CONFIRMED,
    room.gameSpeed!,
    room.teamType!,
    room.draftPools ?? [],
  );
  io.to(normalizedCode).emit(ServerEvents.TEAM_SELECTION_START);
}
// else: do nothing — the ROOM_SETTINGS_CONFIRM handler above will fire TEAM_SELECTION_START
// once the host confirms, since room.players[1] will already be non-null by then.
```

### Existing read-only speed markup (verbatim source, D-07/D-09's reuse target)

```tsx
// Source: packages/client/src/components/TeamSelectionScreen.tsx:139-145 (current, exact)
<span
  className={`${styles.speedOptionActive} ${styles[selectedOption?.colorClass ?? 'speedColorStandard']}`}
>
  <span className={styles.speedIcon}>{selectedOption?.icon}</span>
  {selectedOption?.label ?? selectedSpeed}
</span>
```

### Scoreboard integration point for D-08 (concrete recommendation: INCLUDE, feasible)

```tsx
// Source: packages/client/src/components/GameBoard.tsx:286-293 (current)
<div className={styles.phaseSummary}>
  <span className={styles.teamName} style={{ color: teamColor }}>
    {teamName}
  </span>
  {phaseLabel && phase !== 'REPLAY' && (
    <span className={styles.phaseLabel}>&nbsp;&middot;&nbsp;{phaseLabel}</span>
  )}
</div>
```

**Recommendation: INCLUDE D-08.** `gameState.gameSpeed` is already present on every `GameState` broadcast (`types.ts:519`) — no new plumbing needed. Add a third `&middot;`-separated segment to the _existing single-line_ `.phaseSummary` (do not add a new row/line to `.scoreboardCentreCell`, which would grow the `topBand`'s row height and risk the "layout rework" D-08 explicitly permits skipping if infeasible):

```tsx
<span className={styles.phaseLabel}>
  &nbsp;&middot;&nbsp;{GAME_SPEED_LABEL[gameState.gameSpeed]}
</span>
```

This is additive to one existing flex row, uses the existing 13px dim-text `.phaseLabel`/`.teamName` styling already present, and requires zero CSS Grid/row-height changes — confirmed feasible without layout rework.

## State of the Art

Not applicable in the traditional sense (no external library API to track) — but one internal "state of the art" finding: the project has iterated the pre-game screen flow twice already (Phase 16 `TeamSelectionScreen` → Phase 22 `UniformSelectionScreen` "single combined screen, no tabs"). This phase should **not** resurrect the two-screen team/uniform split; it operates entirely upstream of both, on the currently-live `UniformSelectionScreen.tsx` path.

**Deprecated/outdated:**

- `TeamSelectionScreen.tsx`'s live-app reachability: superseded by `UniformSelectionScreen.tsx` since Phase 22, but the file/tests remain in the tree and are still explicitly named in this phase's locked CONTEXT.md decisions (D-07). Not this phase's job to resolve — flag to user as an existing-but-unaddressed inconsistency.

## Assumptions Log

| #   | Claim                                                                                                                                                            | Section                                                | Risk if Wrong                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` are the best event names (vs. e.g. reusing/extending `TEAM_SPEED_SET` or naming under a `settings:` namespace) | Architecture Patterns — Room / Type Additions          | Low — purely a naming choice; any consistent name works, this just follows the closest existing `room:`-namespaced precedent (`ROOM_CREATE`/`ROOM_JOIN`)                                                                                                                                             |
| A2  | Extracting `SPEED_OPTIONS` to a shared client module is worth the diff vs. adding a third inline copy                                                            | Architecture Patterns — Read-Only Subheader Conversion | Low — either approach is functionally identical; only affects maintainability, not correctness                                                                                                                                                                                                       |
| A3  | The three settings (speed/teamType/draftPools) should be bundled into one atomic confirm event rather than three separate emits                                  | Architecture Patterns — Anti-Patterns to Avoid         | Medium — if the planner instead reuses `TEAM_SPEED_SET` for speed and adds two more separate events, D-03's "locked together" intent could be violated by a client that sends them out of order or only partially; recommend confirming this bundling decision with the user if the planner deviates |
| A4  | `GameSettingsScreen` should be a sibling top-level component (not nested in `LobbyScreen`)                                                                       | Architecture Patterns — Anti-Patterns to Avoid         | Low — either structure works technically; sibling placement matches `TeamSelectionScreen`/`UniformSelectionScreen` precedent most closely                                                                                                                                                            |

**If this table is empty:** N/A — see above; all four assumptions are low-to-medium risk naming/structuring choices, not open factual gaps.

## Open Questions

1. **Does "Play Again" (post-`REPLAY`, `ReplayPanel.tsx:51`) need to re-trigger the settings screen for a new match?**
   - What we know: `ReplayPanel`'s "Play Again" button calls `setScreen('CREATE_ROOM')` directly with **no new `ROOM_CREATE` emit** (comment at `ReplayPanel.tsx:10`: "no socket emit needed (room cleaned up via disconnect)"). The `CreateRoomScreen` sub-view of `LobbyScreen` would then show the _previous_ room code (since `roomCode` state isn't cleared) with a "Generate Room Code" button that re-emits `ROOM_CREATE`.
   - What's unclear: Whether a genuinely new room (and thus a fresh `GAME_SETTINGS` pass) is created on Play Again, or whether this flow is effectively unreachable/broken already (the comment suggests reliance on a disconnect that isn't visible in this file).
   - Recommendation: Out of scope for DRAFT-01/02/03 — this is a pre-existing flow gap unrelated to settings. Do not let this phase's plan attempt to fix it; flag to the user as a follow-up if noticed during implementation.

2. **Exact copy for the Draft-mode summary line's pool list when only some of the 3 selectable pools are checked (e.g. "Original, International" vs. "Original + International")**
   - What we know: UI-SPEC's Copywriting Contract specifies the format `"Draft Pool: {Pool1, Pool2, ...}"` with comma-separated pool names.
   - What's unclear: Capitalization/exact separator nuance isn't pinned down beyond the example.
   - Recommendation: Use the exact format shown in UI-SPEC (comma + space separated, capitalized pool names matching the checkbox labels: "Original", "MLS", "International") — no further research needed, this is a copy-only decision already resolved by UI-SPEC.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 2.1.9 (client) / Vitest (server, same monorepo-pinned version) [VERIFIED: packages/client/package.json]                                                              |
| Config file        | Vite/Vitest config colocated per package (no separate `vitest.config.*` found at repo root; client uses `vite.config.ts` with `test` block per existing convention)         |
| Quick run command  | `pnpm --filter @counter-attack/client test -- GameSettingsScreen` / `pnpm --filter @counter-attack/server test -- roomHandlers` (adjust filenames to actual new test files) |
| Full suite command | `pnpm -r test`                                                                                                                                                              |

### Phase Requirements → Test Map

| Req ID                         | Behavior                                                                                                              | Test Type                                   | Automated Command                                                                                                                                                                                                                                               | File Exists?                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| DRAFT-01                       | Settings screen renders speed/team-type/pool controls; Confirm disabled with 0 pools checked (Draft mode)             | unit (component)                            | `vitest run GameSettingsScreen.test.tsx`                                                                                                                                                                                                                        | ❌ Wave 0 — new file                                                    |
| DRAFT-01                       | Host-only `ROOM_SETTINGS_CONFIRM` — non-host (slot 2) attempt is rejected with `WRONG_TURN`                           | integration (socket wire)                   | `vitest run room.integration.test.ts` (extend existing)                                                                                                                                                                                                         | ⚠️ File exists (`room.integration.test.ts`), needs new test cases added |
| DRAFT-01                       | `ROOM_SETTINGS_CONFIRM` with `teamType: 'draft', draftPools: []` → `DRAFT_POOL_REQUIRED` error                        | unit (handler)                              | new test in a `roomHandlers`-adjacent test file — **no existing unit test file for `roomHandlers.ts` handlers was found** (`TEAM_SPEED_SET` itself has zero test coverage today, confirmed via grep — this is a pre-existing gap, not introduced by this phase) | ❌ Wave 0                                                               |
| DRAFT-02                       | Standard mode: `TeamSelectionScreen`/`UniformSelectionScreen` render read-only speed subheader, no interactive picker | unit (component)                            | `vitest run TeamSelectionScreen.test.tsx` / `UniformSelectionScreen.test.tsx` (extend existing)                                                                                                                                                                 | ✅ Both files exist                                                     |
| DRAFT-03                       | Draft mode: settings summary line replaces speed picker on both screens                                               | unit (component)                            | same files as above, extend                                                                                                                                                                                                                                     | ✅ Both files exist                                                     |
| Race-condition fix (Pitfall 1) | Joiner joins before host confirms settings → `TEAM_SELECTION_START` deferred until confirm                            | integration (socket wire, timing-sensitive) | new test in `room.integration.test.ts`                                                                                                                                                                                                                          | ⚠️ File exists, new test cases needed                                   |

### Sampling Rate

- **Per task commit:** targeted `vitest run <changed-file>.test.ts(x)`
- **Per wave merge:** `pnpm -r test` (full client + server suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/client/src/components/GameSettingsScreen.test.tsx` — new component, no existing coverage
- [ ] Server-side unit/integration tests for `ROOM_SETTINGS_CONFIRM` handler (host-only guard, allow-list validation, both-conditions gate) — extend `room.integration.test.ts`, following its existing `createClient`/`waitFor`-style helpers (lines 1-90 read during this research)
- [ ] **Pre-existing gap (not phase-27-introduced, but adjacent):** `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` currently have zero test coverage anywhere in `packages/server/src/__tests__/` — confirmed via grep. If this phase retires that event pair (per the "TEAM_SPEED_SET becomes dead code" recommendation above), no new test debt is created; if the planner instead chooses to keep it wired to something, add coverage.

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                   |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | No      | Session-token reconnect model unchanged by this phase                                                                                                                                                                              |
| V3 Session Management | No      | No changes to `sessionMiddleware`/reconnect flow                                                                                                                                                                                   |
| V4 Access Control     | Yes     | Host-only guard (`socket.data.playerSlot !== 1` → reject) on `ROOM_SETTINGS_CONFIRM`, identical shape to `TEAM_SPEED_SET`'s existing guard                                                                                         |
| V5 Input Validation   | Yes     | Allow-list validation for `teamType` (`'standard'`/`'draft'`) and `draftPools` (against `SELECTABLE_DRAFT_POOLS`, NOT the full 5-value `DraftPoolId` type — see Pitfall 3), mirroring `VALID_GAME_SPEEDS`/`VALID_TEAM_IDS` pattern |
| V6 Cryptography       | No      | No new secrets/tokens introduced                                                                                                                                                                                                   |

### Known Threat Patterns for this stack

| Pattern                                                                                                           | STRIDE                             | Standard Mitigation                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Non-host client forges `ROOM_SETTINGS_CONFIRM` to change settings after another player is mid-game                | Tampering / Elevation of Privilege | `socket.data.playerSlot !== 1` guard (server-authoritative, client never self-declares host status) — exact existing pattern                                                                                                                                                |
| Client sends `draftPools: ['legends']` bypassing the disabled UI checkbox                                         | Tampering                          | Server-side allow-list against `SELECTABLE_DRAFT_POOLS` (3 values), independent of the `DraftPoolId` type's full 5 values (Pitfall 3)                                                                                                                                       |
| Re-sending `ROOM_SETTINGS_CONFIRM` after `settingsConfirmed` is already true, to change locked settings mid-match | Tampering                          | Guard identical in shape to `TEAM_SPEED_SET`'s `room.gameState !== null` freeze check — add `if (room.settingsConfirmed) { socket.emit(GAME_ERROR, 'SETTINGS_ALREADY_CONFIRMED'); return; }` before processing, enforcing D-03 server-side (not just client-side UI hiding) |

## Sources

### Primary (HIGH confidence — direct repository reads this session)

- `D:\dev\repo\counter-attack-poc\packages\client\src\store\useGameStore.ts` — `Screen` union, `setScreen`, `emitTeamSpeed`
- `D:\dev\repo\counter-attack-poc\packages\client\src\App.tsx` — screen routing ternary, `onRoomJoined`, `handleSpeedChange`
- `D:\dev\repo\counter-attack-poc\packages\client\src\components\LobbyScreen.tsx` — `ROOM_CREATE`/`ROOM_JOIN` emit sites
- `D:\dev\repo\counter-attack-poc\packages\client\src\components\TeamSelectionScreen.tsx` — interactive/readonly speed markup
- `D:\dev\repo\counter-attack-poc\packages\client\src\components\UniformSelectionScreen.tsx` — interactive/readonly speed markup
- `D:\dev\repo\counter-attack-poc\packages\client\src\components\TeamSelectionScreen.test.tsx` — confirms `TeamSelectionScreen` is only exercised directly, not via `App.tsx`
- `D:\dev\repo\counter-attack-poc\packages\server\src\roomHandlers.ts` — `ROOM_CREATE`/`ROOM_JOIN`/`TEAM_SPEED_SET`/`LINEUP_CONFIRM` handlers
- `D:\dev\repo\counter-attack-poc\packages\server\src\roomStore.ts` — `Room` type, `createRoom`/`joinRoom`
- `D:\dev\repo\counter-attack-poc\packages\shared\src\events.ts` — `ClientEvents`/`ServerEvents`/typed event interfaces
- `D:\dev\repo\counter-attack-poc\packages\shared\src\types.ts` — `GameSpeed`, `GameState.gameSpeed`
- `D:\dev\repo\counter-attack-poc\packages\client\src\components\GameBoard.tsx` / `GameBoard.module.css` — scoreboard structure for D-08
- `D:\dev\repo\counter-attack-poc\packages\server\src\__tests__\room.integration.test.ts` — integration test helper patterns
- `D:\dev\repo\counter-attack-poc\packages\client\src\store\useGameStore.test.ts` — client unit test socket-mock pattern

### Secondary (MEDIUM confidence)

- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — project decision history and requirement traceability cross-check

### Tertiary (LOW confidence)

- None — this phase required no external web research; it is entirely a codebase-archaeology task.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages, all versions read directly from `package.json`
- Architecture: HIGH — every claimed line number and code shape was verified by direct file reads this session; the one non-trivial design (settings-confirmed/joiner-present race gate) is derived by direct analogy to an existing, working pattern (`LINEUP_CONFIRM`) in the same file
- Pitfalls: HIGH — all four pitfalls are grounded in specific, cited current-file behavior (not speculative)

**Research date:** 2026-07-20
**Valid until:** 30 days (stable internal codebase, no fast-moving external dependency)
