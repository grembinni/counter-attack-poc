# Phase 27: Game Creation Settings - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 12
**Analogs found:** 12 / 12 (all files have a strong same-repo analog; RESEARCH.md already located exact line numbers via direct reads this session — reused and cross-checked below)

## File Classification

| New/Modified File                                                                              | Role                      | Data Flow                                                                  | Closest Analog                                                                                                                                                                                               | Match Quality                                                                        |
| ---------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `packages/client/src/components/GameSettingsScreen.tsx` (+ `.module.css`)                      | component                 | request-response (local form, single confirm emit)                         | `packages/client/src/components/UniformSelectionScreen.tsx`                                                                                                                                                  | exact (same shape: local `useState` for multiple fields, single bundled `onConfirm`) |
| `packages/client/src/constants/speedOptions.ts` (new, shared)                                  | utility                   | transform (static data)                                                    | `SPEED_OPTIONS` array in `TeamSelectionScreen.tsx` (lines 55-59) / `UniformSelectionScreen.tsx` (lines 98-102)                                                                                               | exact (extraction of existing duplicated const)                                      |
| `packages/client/src/store/useGameStore.ts` (Screen union + new settings state)                | store                     | event-driven (state machine)                                               | Existing `Screen` union member additions (`LINEUP_ASSIGNMENT`, `UNIFORM_SELECTION`)                                                                                                                          | exact                                                                                |
| `packages/client/src/App.tsx` (routing ternary, `onRoomJoined`)                                | route/provider            | event-driven (socket → screen transition)                                  | Existing ternary branches for `LINEUP_ASSIGNMENT`/`UNIFORM_SELECTION`/`TEAM_SELECTION` (lines 208-238) and `onRoomJoined` (lines 60-70)                                                                      | exact                                                                                |
| `packages/client/src/components/TeamSelectionScreen.tsx` (+ `.test.tsx`)                       | component                 | request-response → display-only conversion                                 | Its own existing read-only visitor-view branch (lines 139-145)                                                                                                                                               | exact (self-analog; convert ternary to always-readonly)                              |
| `packages/client/src/components/UniformSelectionScreen.tsx` (+ `.test.tsx`)                    | component                 | request-response → display-only conversion                                 | Its own existing read-only visitor-view branch (lines 213-221)                                                                                                                                               | exact (self-analog)                                                                  |
| `packages/client/src/components/GameBoard.tsx` (D-08 scoreboard)                               | component                 | display-only (derived from `GameState` broadcast)                          | `.phaseSummary` block (lines 286-293)                                                                                                                                                                        | exact                                                                                |
| `packages/server/src/roomHandlers.ts` (`ROOM_SETTINGS_CONFIRM` handler + `ROOM_JOIN` gate fix) | controller/socket-handler | request-response + event-driven (host-authority mutation, gated broadcast) | `TEAM_SPEED_SET` handler (lines 259-290) for the confirm handler; `LINEUP_CONFIRM` both-flag gate (lines 504-513) for the race fix; `ROOM_JOIN` success path (lines 191-194) for the join-time delivery/gate | exact (three separate analog fragments, all in same file)                            |
| `packages/server/src/roomStore.ts` (`Room` type fields)                                        | model                     | CRUD (in-memory room object)                                               | Existing `gameSpeed?: GameSpeed` field (line 81) and `homeLineupConfirmed`/`awayLineupConfirmed` boolean-flag fields                                                                                         | exact                                                                                |
| `packages/shared/src/types.ts` (`TeamType`, `DraftPoolId`, `SELECTABLE_DRAFT_POOLS`)           | model/config              | transform (type + allow-list const)                                        | `GameSpeed` type + `GAME_SPEED_MINUTES` map (lines 433-439)                                                                                                                                                  | exact                                                                                |
| `packages/shared/src/events.ts` (`ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED`)            | config                    | event-driven (typed socket event contract)                                 | `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` pair (lines 178, 220)                                                                                                                                                  | exact                                                                                |
| `packages/server/src/__tests__/room.integration.test.ts` (new cases)                           | test                      | request-response (socket wire integration)                                 | Existing test helpers/patterns in same file (`createClient`/`waitFor`-style, lines 1-90)                                                                                                                     | exact                                                                                |

## Pattern Assignments

### `packages/client/src/components/GameSettingsScreen.tsx` (component, request-response)

**Analog:** `packages/client/src/components/UniformSelectionScreen.tsx`

**Core pattern — local state + single bundled confirm callback** (mirrors `UniformSelectionScreen`'s `selectedTeam`/`selectedStyle`/`selectedFormation` local `useState` + one `onConfirm` prop):

```tsx
// Adapt from UniformSelectionScreen.tsx's local-state + bundled-confirm shape
const [speed, setSpeed] = useState<GameSpeed>('standard');
const [teamType, setTeamType] = useState<TeamType>('standard');
const [draftPools, setDraftPools] = useState<DraftPoolId[]>(['original']); // D-05: Original pre-checked

const confirmDisabled = teamType === 'draft' && draftPools.length === 0; // D-06

function handleConfirm() {
  onConfirm({ speed, teamType, draftPools: teamType === 'draft' ? draftPools : [] });
}
```

**Shell/visual base** (per RESEARCH.md + UI-SPEC): use `.page`/`.card` classes from `LobbyScreen.module.css` (lines 26-44) as the visual base for `GameSettingsScreen.module.css` — duplicate the relevant tokens rather than sharing a base file, consistent with how `TeamSelectionScreen.module.css`/`UniformSelectionScreen.module.css` already independently duplicate `.speedOption*` classes.

**Speed picker markup — reuse interactive branch verbatim** from `TeamSelectionScreen.tsx` lines 120-137 (the interactive `.speedOptions` block being deleted from that file per D-07 conversion) — this is the _only_ place in the app that still needs the interactive picker after this phase, so move (not duplicate) that JSX here, driven by the new shared `SPEED_OPTIONS` constant.

**Props:**

```typescript
onConfirm: (settings: { speed: GameSpeed; teamType: TeamType; draftPools: DraftPoolId[] }) => void;
```

---

### `packages/client/src/constants/speedOptions.ts` (new shared utility)

**Analog:** duplicated `SPEED_OPTIONS` arrays in `TeamSelectionScreen.tsx:55-59` and `UniformSelectionScreen.tsx:98-102` (byte-identical today)

**Pattern:** extract the existing const array verbatim into a shared module; all three consumers (`GameSettingsScreen.tsx`, `TeamSelectionScreen.tsx`, `UniformSelectionScreen.tsx`) import from here instead of declaring their own copy. This crosses the "rule of three" duplication threshold once `GameSettingsScreen.tsx` needs its own copy — extraction is a net line-count reduction per RESEARCH.md.

```typescript
// New file — copy the existing shape from TeamSelectionScreen.tsx:55-59 verbatim
export const SPEED_OPTIONS = [
  // { value: 'slow', label: ..., icon: ..., colorClass: 'speedColorSlow' }, etc. — copy exact fields
] as const;
```

---

### `packages/client/src/store/useGameStore.ts` (Screen union)

**Analog:** existing `Screen` union (lines 23-32, current):

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

**Change:** add `'GAME_SETTINGS'` as new member, recommended position immediately after `'WAITING'` and before `'TEAM_SELECTION'` (comment tag it `// Phase 27: pre-team-selection settings screen (D-01)` following the existing comment convention). No change needed to `setScreen` (line 280) — it is generic and already handles any new union member.

**Local confirmed-settings state:** follow the same pattern used for other cross-screen confirmed values already in the store (mirror how `gameSpeed`/similar simple fields are stored) to hold `teamType`/`draftPools` once `ROOM_SETTINGS_CONFIRMED` arrives, for the read-only subheaders to consume.

---

### `packages/client/src/App.tsx` (routing ternary, onRoomJoined)

**Analog:** existing ternary (lines 208-238) and `onRoomJoined` (lines 60-70, current verbatim):

```typescript
function onRoomJoined(code: string, slot: 1 | 2, token: string) {
  // ...
  if (slot === 1 && (s === 'LANDING' || s === 'CREATE_ROOM')) setScreen('WAITING');
  // ...
}
```

**Change (exact insertion point, confirmed live in current source):** change the slot-1 branch to `setScreen('GAME_SETTINGS')` instead of `setScreen('WAITING')`. The host explicitly calls `setScreen('WAITING')` themselves client-side after their `ROOM_SETTINGS_CONFIRM` emit's response (`ROOM_SETTINGS_CONFIRMED`) arrives — no server round trip needed for this specific transition, mirroring how clicking "Join Game" locally calls `setScreen('JOIN_ROOM')`.

**Ternary branch addition:** add a new branch for `screen === 'GAME_SETTINGS'` → `<GameSettingsScreen onConfirm={...} />`, inserted before the `TEAM_SELECTION` branch, following the exact structural pattern of the existing `LINEUP_ASSIGNMENT`/`UNIFORM_SELECTION` branches (top-level sibling, not nested in `LobbyScreen`).

**`selectedSpeed` local state (line 34) / `handleSpeedChange` (lines 179-182):** these become populated only via the new `GameSettingsScreen`'s confirm callback (no more `onSpeedChange` prop passed to `TeamSelectionScreen`/`UniformSelectionScreen`) — thread `teamType`/`draftPools` alongside `selectedSpeed` as new local state set the same way.

---

### `packages/client/src/components/TeamSelectionScreen.tsx` (+ `.test.tsx`)

**Analog:** its own existing read-only branch, verbatim current source (lines 139-145):

```tsx
<span
  className={`${styles.speedOptionActive} ${styles[selectedOption?.colorClass ?? 'speedColorStandard']}`}
>
  <span className={styles.speedIcon}>{selectedOption?.icon}</span>
  {selectedOption?.label ?? selectedSpeed}
</span>
```

**Conversion pattern (D-07):** delete the `iAmHome ? <interactive branch (lines 120-137)> : <readonly branch>` ternary at `.speedSelector` (lines 117-146); always render the readonly branch. Remove the now-unused `onSpeedChange` prop from `Props` (currently declared line 69).

**Draft-mode summary (D-09):** accept a single pre-formatted prop from `App.tsx` (e.g. `{ mode: 'speed' | 'summary', text: string }`) rather than computing `teamType === 'draft' ? ... : ...` branching logic inside the component — keeps this component ignorant of `DraftPoolId` formatting.

**Test file update required in lockstep:** `TeamSelectionScreen.test.tsx`'s `DEFAULT_SPEED_PROPS` (lines 22-25) currently supplies `{ selectedSpeed: 'standard', onSpeedChange: vi.fn() }` — remove `onSpeedChange` when the prop is dropped from `Props` (stale prop won't fail `tsc` but is a silent cleanup gap flagged in RESEARCH.md Pitfall 2).

**Note:** RESEARCH.md's live-app archaeology found this component is currently unreachable in the live app (superseded by `UniformSelectionScreen.tsx` since Phase 22) — still must be edited per D-07's explicit naming, but has no live user-facing effect.

---

### `packages/client/src/components/UniformSelectionScreen.tsx` (+ `.test.tsx`)

**Analog:** its own existing read-only branch, verbatim current source (lines 213-221) — same shape as `TeamSelectionScreen`'s.

**Conversion pattern:** identical to `TeamSelectionScreen.tsx` above — always render readonly branch (currently at lines 213-221) of the `.speedBlock`/`.speedRow` JSX (lines 190-224), delete the interactive branch (lines 190-212 range) and `onSpeedChange` prop.

**This is the live, user-facing conversion** (per RESEARCH.md: every code path that sets team-selection screen actually routes here, not to `TeamSelectionScreen.tsx`) — prioritize correctness/test coverage here over the `TeamSelectionScreen.tsx` twin.

---

### `packages/client/src/components/GameBoard.tsx` (D-08 scoreboard)

**Analog:** existing `.phaseSummary` block, verbatim current source (lines 286-293):

```tsx
<div className={styles.phaseSummary}>
  <span className={styles.teamName} style={{ color: teamColor }}>
    {teamName}
  </span>
  {phaseLabel && phase !== 'REPLAY' && (
    <span className={styles.phaseLabel}>&nbsp;&middot;&nbsp;{phaseLabel}</span>
  )}
</div>
```

**Pattern to add (additive, same flex row, no layout rework):**

```tsx
<span className={styles.phaseLabel}>
  &nbsp;&middot;&nbsp;{GAME_SPEED_LABEL[gameState.gameSpeed]}
</span>
```

`gameState.gameSpeed` is already present on every `GameState` broadcast (`packages/shared/src/types.ts:519`) — zero new plumbing needed. Reuses the existing 13px dim-text `.phaseLabel` styling; do not add a new row to `.scoreboardCentreCell` (would grow `topBand` row height).

---

### `packages/server/src/roomHandlers.ts` (new `ROOM_SETTINGS_CONFIRM` handler + `ROOM_JOIN` gate fix)

**Analog 1 — host-authority + allow-list guard shape:** `TEAM_SPEED_SET` handler, verbatim current source (lines 259-290):

```typescript
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
    socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
    return;
  }
  if (room.gameState !== null) {
    socket.emit(ServerEvents.GAME_ERROR, 'GAME_ALREADY_STARTED');
    return;
  }
  room.gameSpeed = speed;
  io.to(roomCode).emit(ServerEvents.TEAM_SPEED_CHANGED, speed);
});
```

Copy this exact guard shape (roomCode lookup → allow-list validation → host-only guard → freeze guard) for the new `ROOM_SETTINGS_CONFIRM` handler, adding a `SETTINGS_ALREADY_CONFIRMED` guard (`if (room.settingsConfirmed) { ...; return; }`) before processing, per RESEARCH.md's threat-pattern note (server-side enforcement of D-03, not just client-side hiding).

**Analog 2 — both-conditions gate:** `LINEUP_CONFIRM` both-flag gate, verbatim current source (lines 504-513):

```typescript
if (!room.homeLineupConfirmed || !room.awayLineupConfirmed) {
  return; // still waiting for the other player
}
```

Adapt to this phase's asymmetric gate (settings confirmed AND joiner present, not two symmetric per-player flags):

```typescript
// In the ROOM_SETTINGS_CONFIRM handler, after storing settings:
room.settingsConfirmed = true;
if (room.players[1] !== null) {
  io.to(roomCode).emit(ServerEvents.TEAM_SELECTION_START);
}
```

**Analog 3 — `ROOM_JOIN` success path, current source (lines 191-194) requiring the race-condition fix:**

```typescript
// CONN-03 (Phase 16 D-10): emit TEAM_SELECTION_START to all room members.
io.to(normalizedCode).emit(ServerEvents.TEAM_SELECTION_START);
```

Replace the unconditional emit with the gated version:

```typescript
if (room.settingsConfirmed) {
  socket.emit(
    ServerEvents.ROOM_SETTINGS_CONFIRMED,
    room.gameSpeed!,
    room.teamType!,
    room.draftPools ?? [],
  );
  io.to(normalizedCode).emit(ServerEvents.TEAM_SELECTION_START);
}
// else: do nothing — ROOM_SETTINGS_CONFIRM handler fires TEAM_SELECTION_START
// once host confirms, since room.players[1] will already be non-null by then.
```

**Validation for `draftPools` (Pitfall 3/4):** use `SELECTABLE_DRAFT_POOLS` (3-value const), not `DraftPoolId`'s full 5-value type, for the `.every(p => SELECTABLE_DRAFT_POOLS.includes(p))` check. Only require `draftPools.length >= 1` when `teamType === 'draft'`; ignore/allow-empty when `teamType === 'standard'`. Use error reason `'DRAFT_POOL_REQUIRED'` following the existing `INVALID_SPEED`/`WRONG_TURN` naming convention.

---

### `packages/server/src/roomStore.ts` (Room type fields)

**Analog:** existing `gameSpeed?: GameSpeed` field (line 81) and `homeLineupConfirmed`/`awayLineupConfirmed` boolean fields (same file, same pattern class).

**Fields to add:**

```typescript
/** DRAFT-01 (Phase 27): team type confirmed on the settings pre-step. undefined until confirmed. */
teamType?: TeamType;
/** DRAFT-01 (Phase 27): draft pools confirmed on the settings pre-step (only meaningful if teamType === 'draft'). */
draftPools?: DraftPoolId[];
/** DRAFT-01/D-03 (Phase 27): true once host has confirmed settings — gates TEAM_SELECTION_START
 *  alongside "slot 2 has joined" (see roomHandlers.ts ROOM_SETTINGS_CONFIRM / ROOM_JOIN). */
settingsConfirmed?: boolean;
```

---

### `packages/shared/src/types.ts` (TeamType, DraftPoolId, SELECTABLE_DRAFT_POOLS)

**Analog:** `GameSpeed` type + `GAME_SPEED_MINUTES` map (lines 433-439, exact structure to mirror — type union alongside an allow-list-style const).

```typescript
export type TeamType = 'standard' | 'draft';

export type DraftPoolId = 'original' | 'mls' | 'international' | 'legends' | 'icons';

export const SELECTABLE_DRAFT_POOLS: readonly DraftPoolId[] = [
  'original',
  'mls',
  'international',
] as const;
```

Note: `DraftPoolId` type intentionally includes all 5 values (forward-compat with DRAFT-11) while `SELECTABLE_DRAFT_POOLS` is narrower (3 values) — this is the first case in the codebase where type and allow-list intentionally diverge (flag explicitly in plan verification steps).

---

### `packages/shared/src/events.ts` (ROOM_SETTINGS_CONFIRM/ROOM_SETTINGS_CONFIRMED)

**Analog:** `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` pair (lines 178, 220), namespaced similarly to `ROOM_CREATE`/`ROOM_JOIN` (`room:` prefix).

```typescript
// ClientEvents
ROOM_SETTINGS_CONFIRM: 'room:settings-confirm',
[ClientEvents.ROOM_SETTINGS_CONFIRM]: (
  settings: { speed: GameSpeed; teamType: TeamType; draftPools: DraftPoolId[] }
) => void;

// ServerEvents
ROOM_SETTINGS_CONFIRMED: 'room:settings-confirmed',
[ServerEvents.ROOM_SETTINGS_CONFIRMED]: (
  speed: GameSpeed, teamType: TeamType, draftPools: DraftPoolId[]
) => void;
```

Client→server uses an object payload (consistent with `LINEUP_SWAP`/`LINEUP_CONFIRM`'s multi-field object-payload precedent); server→client uses positional args (consistent with `TEAM_SPEED_CHANGED(speed)`/`UNIFORM_HOME_CONFIRMED(...)` positional convention).

**Anti-pattern (explicit, from RESEARCH.md):** do NOT extend `TEAM_SPEED_SET`/`TEAM_SPEED_CHANGED` to also carry `teamType`/`draftPools` — the three settings must lock together atomically per D-03; a single consolidated event/handler is the correct model, not incremental extension of the speed-only event.

---

### `packages/server/src/__tests__/room.integration.test.ts` (new test cases)

**Analog:** existing `createClient`/`waitFor`-style helpers already in this file (lines 1-90).

**New cases needed (per RESEARCH.md Validation Architecture):**

1. Host-only guard: non-host (slot 2) attempt at `ROOM_SETTINGS_CONFIRM` → `WRONG_TURN`.
2. `teamType: 'draft', draftPools: []` → `DRAFT_POOL_REQUIRED`.
3. `teamType: 'standard', draftPools: []` → success (no pool requirement in Standard mode).
4. `draftPools: ['legends']` → rejected (allow-list against `SELECTABLE_DRAFT_POOLS`, not full `DraftPoolId` type) — no existing precedent test to copy from, write from scratch using the file's existing `createClient` harness.
5. Race-condition regression: joiner joins before host confirms settings → `TEAM_SELECTION_START` deferred until confirm fires (timing-sensitive integration test using existing harness patterns).

---

## Shared Patterns

### Host-only authority guard

**Source:** `packages/server/src/roomHandlers.ts:259-290` (`TEAM_SPEED_SET`)
**Apply to:** `ROOM_SETTINGS_CONFIRM` handler

```typescript
if (socket.data.playerSlot !== 1) {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
  return;
}
```

### Allow-list input validation (ASVS V5)

**Source:** `VALID_GAME_SPEEDS`/`VALID_TEAM_IDS`/`VALID_UNIFORM_STYLE_IDS` pattern, `packages/server/src/roomHandlers.ts:49-76`
**Apply to:** `teamType` and `draftPools` validation in the new handler — use `SELECTABLE_DRAFT_POOLS` (narrow 3-value const), not the full 5-value `DraftPoolId` type.

### Both-conditions gate for next-phase broadcast

**Source:** `LINEUP_CONFIRM` both-flag pattern, `packages/server/src/roomHandlers.ts:504-513`
**Apply to:** `TEAM_SELECTION_START` gating across both `ROOM_SETTINGS_CONFIRM` and `ROOM_JOIN` handlers (asymmetric: "settings confirmed" flag + "joiner present" check, rather than two symmetric per-player flags).

### Freeze-after-confirm guard (server-side lock enforcement of D-03)

**Source:** `TEAM_SPEED_SET`'s `room.gameState !== null` freeze check (same handler, same file)
**Apply to:** New `if (room.settingsConfirmed) { emit SETTINGS_ALREADY_CONFIRMED; return; }` guard — enforces D-03 server-side, not just via client-side UI hiding.

### Read-only info-subheader element (D-07/D-09 — one consistent visual treatment, not two)

**Source:** `packages/client/src/components/TeamSelectionScreen.tsx:139-145` / `UniformSelectionScreen.tsx:213-221` (identical shape in both files today)
**Apply to:** Both screens' converted speed block AND the new Draft-mode settings-summary line — same `styles.speedOptionActive`/`styles.speedIcon` classes, driven by a single pre-formatted content prop from `App.tsx` rather than per-component branching logic.

### Shared static options data (rule-of-three extraction)

**Source:** duplicated `SPEED_OPTIONS` const in `TeamSelectionScreen.tsx:55-59` and `UniformSelectionScreen.tsx:98-102`
**Apply to:** New `packages/client/src/constants/speedOptions.ts` — all three consumers (including new `GameSettingsScreen.tsx`) import from here.

## No Analog Found

None. RESEARCH.md's direct-read archaeology found an existing near-identical pattern in this codebase for every mechanism this phase needs (host authority, both-conditions gating, allow-list validation, read-only/interactive UI toggling, in-memory room field additions, typed event pairs). This phase is "clone and adapt three existing patterns," not new design.

## Metadata

**Analog search scope:** `packages/client/src/{components,store}`, `packages/server/src/{roomHandlers.ts,roomStore.ts,__tests__}`, `packages/shared/src/{types.ts,events.ts}` — scoped by RESEARCH.md's own direct-read citations, spot-verified this session (`App.tsx` lines 60-70, `roomHandlers.ts` lines 191-194 confirmed via Grep against live source).
**Files scanned:** 12 target files + their cited analog source lines (all verified against live repo, not assumed from CONTEXT.md's original line-number snapshot, which RESEARCH.md found to be slightly off in several places — corrected line ranges used throughout this document).
**Pattern extraction date:** 2026-07-20
