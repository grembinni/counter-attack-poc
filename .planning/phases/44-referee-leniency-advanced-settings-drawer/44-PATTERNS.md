# Phase 44: Referee Leniency & Advanced Settings Drawer - Pattern Map

**Mapped:** 2026-08-23
**Files analyzed:** 7 (all modified, no new files)
**Analogs found:** 7 / 7 (in-file self-analogs — this phase extends existing end-to-end plumbing rather than introducing a new file/component type)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/client/src/components/GameSettingsScreen.tsx` | component | request-response (local state → onConfirm) | itself — `tackleStealDecline` toggle row + `fouls`/`booking`/`injury` grey-out block, same file | exact |
| `packages/client/src/components/GameSettingsScreen.module.css` | config (styles) | — | itself — `.subLink`, `.poolRow`/`.poolRowDisabled`, `.comingSoon`, `.section` | exact |
| `packages/client/src/App.tsx` | controller (socket glue) | request-response | itself — `handleSettingsConfirm` / `onRoomSettingsConfirmed` tackleStealDecline plumbing | exact |
| `packages/shared/src/events.ts` | model (event contracts) | request-response | itself — `ROOM_SETTINGS_CONFIRM` / `ROOM_SETTINGS_CONFIRMED` `tackleStealDecline` fields | exact |
| `packages/shared/src/types.ts` | model | — | itself — `RefereeCard` type + `tackleStealDeclineEnabled` field pattern | exact |
| `packages/server/src/roomStore.ts` | model (Room state) | CRUD | itself — `tackleStealDeclineEnabled?: boolean` field | exact |
| `packages/server/src/roomHandlers.ts` | controller (socket handler) | request-response | itself — `ROOM_SETTINGS_CONFIRM` handler's fouls/booking/injury/tackleStealDecline validate→store→broadcast chain | exact |
| `packages/server/src/gameEngine.ts` | service (state builder) | transform | itself — `tackleStealDeclineEnabled` param → `GameState` field wiring in `buildInitialGameState`, and `randomInt(2,6)` leniency roll it must be overridden by | exact |

Every target file already carries the `tackleStealDecline` (Phase 43) end-to-end pattern that this phase's `refereeLeniencyOverride`/`refereeLeniencyValue` fields should mirror almost line-for-line — the "analog" for each file is the sibling toggle inside that same file, not an external file.

## Pattern Assignments

### `packages/client/src/components/GameSettingsScreen.tsx` (component, request-response)

**Analog:** same file — `fouls`/`booking`/`injury` grey-out block (lines 92-104, 176-209) + `tackleStealDecline` row (lines 200-208) + `onConfirm` prop type (lines 22-36) + `handleConfirm` (lines 109-123).

**Toggle-row shape to clone for the Referee Leniency row** (lines 182-191, the disabled-mirroring pattern D-04 asks to replicate):
```tsx
<label className={!fouls ? styles.poolRowDisabled : styles.poolRow}>
  <input type="checkbox" checked={booking} disabled={!fouls} onChange={toggleBooking} />
  Booking
  {!fouls && <span className={styles.comingSoon}> (requires Fouls)</span>}
</label>
```
For Referee Leniency: row is `styles.poolRow`/`styles.poolRowDisabled` keyed off the **new** `refereeLeniencyOverride` toggle checkbox itself (not `fouls`), with the `<input type="number" min={2} max={5}>` stepper disabled whenever the override checkbox is off, plus a `styles.comingSoon`-style added-time note per D-08.

**`onConfirm` prop signature to extend** (lines 22-36) — add two fields alongside the existing `tackleStealDecline: boolean` pattern:
```tsx
onConfirm: (settings: {
  speed: GameSpeed;
  teamType: TeamType;
  draftPools: DraftPoolId[];
  outOfBounds: boolean;
  fouls: boolean;
  booking: boolean;
  injury: boolean;
  tackleStealDecline: boolean;
}) => void;
```
New fields to add, matching the existing comment-annotation convention (`/** TACKLE-01 (Phase 43): ... */`): `refereeLeniencyOverride: boolean` and `refereeLeniencyValue: number`.

**Local state declarations to clone** (lines 50-61, the toggle-default pattern):
```tsx
const [tackleStealDecline, setTackleStealDecline] = useState<boolean>(true);
```
New: `const [refereeLeniencyOverride, setRefereeLeniencyOverride] = useState<boolean>(false);` (default OFF per phase boundary) and `const [refereeLeniencyValue, setRefereeLeniencyValue] = useState<number>(4);` (D-01: defaults to 4 when switched on).

**Shared-derivation pattern to extract for SETTINGS-07** — today the Fouls→Booking/Injury grey-out logic is duplicated in two places:
- Inline guards in `toggleBooking`/`toggleInjury` (lines 95-104):
```tsx
function toggleBooking() {
  if (!fouls) return;
  setBooking((v) => !v);
}
function toggleInjury() {
  if (!fouls) return;
  setInjury((v) => !v);
}
```
- Re-derived again in `handleConfirm` (lines 117-120):
```tsx
booking: fouls && booking,
injury: fouls && injury,
```
Extract one shared derivation (e.g. `const foulsGreyOut = !fouls;` or a small `deriveMatchRules(fouls, booking, injury)` helper) used at both the render-time disabled/className computation and inside `handleConfirm`'s normalization — this satisfies SETTINGS-07's "one shared derivation" requirement and is the shape the new stepper's bounds/disabled state should also flow through if applicable.

**`handleConfirm` pattern to extend** (lines 109-123):
```tsx
function handleConfirm() {
  setHasConfirmed(true);
  onConfirm({
    speed,
    teamType,
    draftPools: teamType === 'draft' ? draftPools : [],
    outOfBounds,
    fouls,
    booking: fouls && booking,
    injury: fouls && injury,
    tackleStealDecline,
  });
}
```
Add `refereeLeniencyOverride` and `refereeLeniencyValue` (raw pass-through, no parent-toggle normalization needed — Referee Leniency has no dependency like Booking/Injury do).

**Section restructure (SETTINGS-05/06):** the existing single `<div className={styles.section}>` "Match Rules" block (lines 176-209) becomes a collapsed-by-default "Advanced" disclosure. New local `const [advancedOpen, setAdvancedOpen] = useState(false);` state; trigger button styled like the existing Back link:
```tsx
<button type="button" className={styles.subLink} onClick={onBack}>
  &larr; Back
</button>
```
(lines 251-253) — reuse `styles.subLink` for the "Advanced ▾"/"Advanced ▸" trigger per D-06, conditionally rendering the two-column toggle grid below it when `advancedOpen` is true.

---

### `packages/client/src/components/GameSettingsScreen.module.css` (config)

**Analog:** same file.

**`.subLink` to reuse verbatim for the Advanced disclosure trigger** (lines 220-234):
```css
.subLink {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  align-self: flex-start;
}
.subLink:hover {
  color: var(--color-text-primary);
}
```

**`.poolRow` / `.poolRowDisabled` to reuse for the Leniency stepper row's disabled state** (lines 163-183):
```css
.poolRow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-primary);
  cursor: pointer;
}
.poolRowDisabled {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-secondary);
  cursor: not-allowed;
  opacity: 0.4;
}
```

**`.comingSoon` to reuse for the added-time coupling note** (lines 185-188):
```css
.comingSoon {
  font-size: 13px;
  color: var(--color-text-secondary);
}
```

**New CSS needed:** a two-column grid class for the Advanced toggle grouping (D-07) — no existing analog in this file; follow the file's header comment convention ("Spacing: new elements use only 4/8/16/24/32... Color: dark theme verbatim, sourced via var(--token)") and add e.g. `.advancedGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }` plus `.advancedColumn { display: flex; flex-direction: column; gap: 8px; }`.

---

### `packages/client/src/App.tsx` (controller, request-response)

**Analog:** same file — `tackleStealDecline` end-to-end forwarding.

**`handleSettingsConfirm` param type + emit pattern** (lines 265-287):
```tsx
function handleSettingsConfirm(settings: {
  speed: GameSpeed;
  teamType: TeamType;
  draftPools: DraftPoolId[];
  outOfBounds: boolean;
  fouls: boolean;
  booking: boolean;
  injury: boolean;
  tackleStealDecline: boolean;
}) {
  setSelectedSpeed(settings.speed);
  setTeamType(settings.teamType);
  setDraftPools(settings.draftPools);
  setOutOfBounds(settings.outOfBounds);
  socket.emit(ClientEvents.ROOM_SETTINGS_CONFIRM, settings);
}
```
Add `refereeLeniencyOverride`/`refereeLeniencyValue` to the param type; `settings` is forwarded wholesale via `socket.emit`, so no extra line needed there — only the type annotation needs the new fields (mirrors the comment at lines 284-285: "fouls/booking/injury are forwarded wholesale via `settings` below — no local state to set").

**`onRoomSettingsConfirmed` echo handler — trailing-param discard pattern** (lines 140-165), the exact shape to copy for the two new trailing fields:
```tsx
function onRoomSettingsConfirmed(
  speed: GameSpeed,
  confirmedTeamType: TeamType,
  pools: DraftPoolId[],
  confirmedOutOfBounds: boolean,
  _confirmedFouls: boolean,
  _confirmedBooking: boolean,
  _confirmedInjury: boolean,
  _confirmedTackleStealDecline: boolean,
) {
  setSelectedSpeed(speed);
  setTeamType(confirmedTeamType);
  setDraftPools(pools);
  setOutOfBounds(confirmedOutOfBounds);
  if (useGameStore.getState().screen === 'GAME_SETTINGS') setScreen('WAITING');
}
```
Add `_confirmedRefereeLeniencyOverride: boolean, _confirmedRefereeLeniencyValue: number,` as new trailing params (underscore-prefixed = intentionally discarded, no local consumer yet — matches the established convention documented in the comment block above this function for fouls/booking/injury/tackleStealDecline).

---

### `packages/shared/src/events.ts` (model, request-response contracts)

**Analog:** same file — `ROOM_SETTINGS_CONFIRM` (lines 269-283) and `ROOM_SETTINGS_CONFIRMED` (lines 450-464).

**Client→server event payload to extend:**
```ts
[ClientEvents.ROOM_SETTINGS_CONFIRM]: (settings: {
  speed: GameSpeed;
  teamType: TeamType;
  draftPools: DraftPoolId[];
  outOfBounds: boolean;
  fouls: boolean;
  booking: boolean;
  injury: boolean;
  /** TACKLE-01 (Phase 43): Tackle/Steal decline-prompt game-creation toggle. */
  tackleStealDecline: boolean;
}) => void;
```
Add `refereeLeniencyOverride: boolean; refereeLeniencyValue: number;` with a `/** REFEREE-01/02 (Phase 44): ... */` doc-comment matching the existing annotation style.

**Server→client broadcast (positional args) to extend:**
```ts
[ServerEvents.ROOM_SETTINGS_CONFIRMED]: (
  speed: GameSpeed,
  teamType: TeamType,
  draftPools: DraftPoolId[],
  outOfBounds: boolean,
  fouls: boolean,
  booking: boolean,
  injury: boolean,
  /** TACKLE-01 (Phase 43): Tackle/Steal decline-prompt game-creation toggle. */
  tackleStealDecline: boolean,
) => void;
```
Append `refereeLeniencyOverride: boolean, refereeLeniencyValue: number,` as new trailing positional args — this event uses **positional**, not object, args (unlike the client→server object payload), so ordering/position matters and must match `roomHandlers.ts`'s emit call exactly.

---

### `packages/shared/src/types.ts` (model)

**Analog:** same file — `RefereeCard` type (lines 163-169) + `tackleStealDeclineEnabled?: boolean` field pattern on `GameState`/Room-adjacent types (per `roomStore.ts`/`gameEngine.ts` grep hits at types.ts:1557-1560).

**`RefereeCard` type, currently:**
```ts
/**
 * Referee card leniency attribute. Assigned randomly at match start.
 * Range 2–5. TEAM-03.
 */
export type RefereeCard = {
  leniency: number;
};
```
No shape change needed here — `leniency: number` already accommodates a manually-set 2-5 value; the override lives upstream (Room settings → `buildInitialGameState` param), not in this type.

**Field-doc pattern to clone for GameState's new override-adjacent fields** (types.ts ~1557-1560, mirrors `tackleStealDeclineEnabled`):
```ts
/**
 * TACKLE-01 (Phase 43): ... test `state.tackleStealDeclineEnabled === true`, never
 * truthiness of a possibly-undefined value.
 */
tackleStealDeclineEnabled?: boolean;
```
If GameState needs to carry the override flag/value forward (verify against actual downstream consumer needs at planning time — the override may only need to affect the *initial* `randomInt` roll, not persist as a separate GameState field since `refereeCard.leniency` already stores the resolved number), follow this same `?: boolean` / `?: number` optional-field-with-doc-comment convention.

---

### `packages/server/src/roomStore.ts` (model, CRUD)

**Analog:** same file — `tackleStealDeclineEnabled?: boolean` (line 127) alongside `foulsEnabled?`/`bookingEnabled?`/`injuryEnabled?`/`outOfBoundsEnabled?` (lines 100-127).

**Field pattern to clone:**
```ts
/**
 * TACKLE-01 (Phase 43): Tackle/Steal decline-prompt toggle confirmed on the settings
 * pre-step. `undefined` = not yet confirmed and is treated as `false` (disabled) when
 * building game state. Independent of Fouls/Booking/Injury/Out-of-Bounds toggles.
 */
tackleStealDeclineEnabled?: boolean;
```
Add two new optional fields on the `Room` type: `refereeLeniencyOverrideEnabled?: boolean;` and `refereeLeniencyValue?: number;`, each with a matching doc-comment block (`REFEREE-01/02 (Phase 44): ...`).

---

### `packages/server/src/roomHandlers.ts` (controller, request-response)

**Analog:** same file — `ROOM_SETTINGS_CONFIRM` handler, full validate→store→broadcast chain (lines 413-596).

**Destructure + type annotation to extend** (lines 413-437):
```ts
socket.on(
  ClientEvents.ROOM_SETTINGS_CONFIRM,
  ({
    speed, teamType, draftPools, outOfBounds, fouls, booking, injury, tackleStealDecline,
  }: {
    speed: GameSpeed;
    teamType: TeamType;
    draftPools: DraftPoolId[];
    outOfBounds: boolean;
    fouls: boolean;
    booking: boolean;
    injury: boolean;
    /** TACKLE-01 (Phase 43): Tackle/Steal decline-prompt game-creation toggle. */
    tackleStealDecline: boolean;
  }) => {
```
Add `refereeLeniencyOverride, refereeLeniencyValue` to destructure + type.

**Allow-list validation guard to clone** (lines 497-502, the most recent/closest sibling guard):
```ts
// T-43-07 (Phase 43): ASVS V5 allow-list guard — reject a forged non-boolean
// tackleStealDecline payload before any room mutation, mirroring the guards above.
if (typeof tackleStealDecline !== 'boolean') {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TACKLE_STEAL_DECLINE');
  return;
}
```
New guards needed:
```ts
if (typeof refereeLeniencyOverride !== 'boolean') {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_REFEREE_LENIENCY_OVERRIDE');
  return;
}
// Only meaningfully validated when the override is actually enabled — bounds-check
// mirrors the range constraint (2-5) enforced client-side by the <input min/max>.
if (refereeLeniencyOverride && (typeof refereeLeniencyValue !== 'number' || refereeLeniencyValue < 2 || refereeLeniencyValue > 5 || !Number.isInteger(refereeLeniencyValue))) {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_REFEREE_LENIENCY_VALUE');
  return;
}
```

**Store-and-lock pattern to clone** (lines 558-586):
```ts
room.tackleStealDeclineEnabled = tackleStealDecline;
room.settingsConfirmed = true;
...
io.to(roomCode).emit(
  ServerEvents.ROOM_SETTINGS_CONFIRMED,
  room.gameSpeed, room.teamType, room.draftPools, room.outOfBoundsEnabled,
  room.foulsEnabled, room.bookingEnabled, room.injuryEnabled,
  room.tackleStealDeclineEnabled,
);
```
Add `room.refereeLeniencyOverrideEnabled = refereeLeniencyOverride;` / `room.refereeLeniencyValue = refereeLeniencyValue;` before `settingsConfirmed = true`, and append the two new fields as trailing positional args to the `ROOM_SETTINGS_CONFIRMED` emit (must match the new `events.ts` signature order exactly).

**`buildInitialGameState` call-site to extend** (roomHandlers.ts lines 955-974, LINEUP_CONFIRM handler — the ONLY place `buildInitialGameState` is invoked in production code):
```ts
gameState = buildInitialGameState(
  roomCode,
  { home: room.homePickedTeam!, away: room.awayPickedTeam! },
  room.gameSpeed ?? 'standard',
  { home: room.homePickedUniformStyle!, away: room.awayPickedUniformStyle! },
  { home: room.homePickedFormation!, away: room.awayPickedFormation! },
  { home: room.homePickedJerseyType ?? 'home', away: room.awayPickedJerseyType ?? 'away' },
  confirmedHomeOrder,
  confirmedAwayOrder,
  room.outOfBoundsEnabled ?? false,
  room.foulsEnabled ?? false,
  room.bookingEnabled ?? false,
  room.injuryEnabled ?? false,
  room.tackleStealDeclineEnabled ?? false,
  confirmedHomeBench,
  confirmedAwayBench,
);
```
Add two new trailing params: `room.refereeLeniencyOverrideEnabled ?? false, room.refereeLeniencyValue,` — must be appended at the END of the existing positional param list (new optional params with defaults, matching every prior toggle's append-at-tail convention) to avoid breaking any other caller/test that constructs `buildInitialGameState(...)` positionally.

---

### `packages/server/src/gameEngine.ts` (service, transform)

**Analog:** same file — `tackleStealDeclineEnabled` param wiring (lines 394-402, 458) is the pattern to mirror for threading the override through; the `randomInt(2, 6)` leniency roll (line 437) is the specific line the override must conditionally replace.

**Param + doc-comment pattern to clone** (lines 394-402):
```ts
/**
 * TACKLE-01 (Phase 43): Tackle/Steal decline-prompt toggle baked into GameState at match
 * start from Room.tackleStealDeclineEnabled. Defaults to `false` — the disabled path is
 * the safe default even if a caller forgets to pass it, matching `outOfBoundsEnabled`'s
 * fail-closed default. ...
 */
tackleStealDeclineEnabled: boolean = false,
```
New trailing params to add at the end of `buildInitialGameState`'s signature (after `awayBench`, matching the roomHandlers.ts call-site append order): `refereeLeniencyOverrideEnabled: boolean = false, refereeLeniencyValue?: number,` with an equivalent doc-comment (`REFEREE-01/02 (Phase 44): manual override for the random 2-5 leniency roll (REFEREE-03, already shipped) baked in from Room.refereeLeniencyOverrideEnabled/refereeLeniencyValue...`).

**The exact line to override** (line 437 — this is the REFEREE-03-already-shipped code, do NOT reimplement, only conditionally bypass it):
```ts
refereeCard: { leniency: randomInt(2, 6) }, // TEAM-03: random 2–5 (randomInt is max-exclusive, so (2, 6) yields 2..5)
```
Change to:
```ts
refereeCard: {
  leniency: refereeLeniencyOverrideEnabled && refereeLeniencyValue !== undefined
    ? refereeLeniencyValue
    : randomInt(2, 6),
},
```

**`GameState` field assignment pattern to clone** if the override flag/value needs to persist on GameState (lines 454-458, for the "field embedded in every snapshot" convention):
```ts
outOfBoundsEnabled, // GOALKICK-06 / OOB-05 (Phase 37): Out-of-Bounds/Restarts toggle
foulsEnabled, // SETTINGS-01/FOUL-05 (Phase 39): Fouls system toggle
bookingEnabled, // SETTINGS-02/CARD-04 (Phase 39): Booking (cards) toggle
injuryEnabled, // SETTINGS-03/INJURY-04 (Phase 39): Injury system toggle
tackleStealDeclineEnabled, // TACKLE-01 (Phase 43): Tackle/Steal decline-prompt toggle
```
Only add a new field here if a downstream consumer (added-time calculation at line 3065, or a settings-summary display) needs to read the override state from GameState directly at runtime — otherwise the override only needs to influence the one-time `randomInt` substitution at construction and does not need to persist. Verify against the added-time calculation site below before deciding.

**Existing added-time consumer of `refereeCard.leniency`** (line 3065) — confirms the override does NOT need separate handling here; it already flows through `state.refereeCard.leniency` regardless of whether that number came from `randomInt` or the manual override:
```ts
newAddedTime = roll + state.refereeCard.leniency + (state.addedTimeBonus ?? 0);
```
This is the "drives both the booking threshold and added-time calculation" behavior described in the phase boundary — no code change needed at this line; it already works correctly once `refereeCard.leniency` is set correctly at construction time (line 437 above).

---

## Shared Patterns

### End-to-end toggle plumbing (client checkbox → App.tsx → socket → roomHandlers validation → roomStore field → buildInitialGameState param → GameState)
**Source:** `tackleStealDecline` (Phase 43) — every file listed above.
**Apply to:** All 7 files in this phase for `refereeLeniencyOverride`/`refereeLeniencyValue`. This is a **six-hop chain**: `GameSettingsScreen.tsx` local state → `onConfirm` payload → `App.tsx handleSettingsConfirm` → `events.ts ROOM_SETTINGS_CONFIRM` → `roomHandlers.ts` validate+store → `roomStore.ts Room` field → `roomHandlers.ts` `buildInitialGameState` call → `gameEngine.ts` param → `GameState.refereeCard.leniency`. Every hop in this phase must mirror the `tackleStealDecline` shape exactly, substituting the boolean+number pair for the boolean.

### ASVS V5 allow-list validation
**Source:** `packages/server/src/roomHandlers.ts` lines 497-502 (and siblings at 463-495).
**Apply to:** `roomHandlers.ts` `ROOM_SETTINGS_CONFIRM` handler — every new client-supplied field gets its own `typeof`/range guard with a distinct `GAME_ERROR` reason string, emitted and returned BEFORE any room mutation (never trust client-side stepper bounds-clamping).

### Disabled-row grey-out visual language
**Source:** `packages/client/src/components/GameSettingsScreen.tsx` lines 182-191 + `.module.css` lines 163-183 (`styles.poolRow`/`styles.poolRowDisabled`/`styles.comingSoon`).
**Apply to:** The Referee Leniency stepper row (always-visible, greyed out via `styles.poolRowDisabled` + `disabled` attribute on the `<input type="number">` when override is off — D-04) and the added-time coupling note (`styles.comingSoon`-style span — D-08).

### Trailing-param broadcast + intentional-discard client receiver
**Source:** `packages/shared/src/events.ts` lines 450-464 (`ROOM_SETTINGS_CONFIRMED`) + `packages/client/src/App.tsx` lines 140-165 (underscore-prefixed unused params).
**Apply to:** New `refereeLeniencyOverride`/`refereeLeniencyValue` fields appended at the tail of the positional `ROOM_SETTINGS_CONFIRMED` broadcast; client-side receiver accepts them as `_confirmedRefereeLeniencyOverride`/`_confirmedRefereeLeniencyValue` with no local state consumer yet (unless the planner decides a settings-summary line needs them — check `formatSettingsSummary` in `packages/client/src/constants/settingsSummary.ts` if so).

## No Analog Found

None — every file in scope already has a directly-analogous same-file pattern to mirror (the `tackleStealDecline` Phase 43 toggle plumbing), so no external/cross-project pattern search was needed. The one genuinely new UI element — the collapsible "Advanced" disclosure — has no existing component analog anywhere in `packages/client/src/components` (confirmed via the CONTEXT.md code_context note: "No existing collapsible/disclosure component exists anywhere... this will be a new local pattern"); its implementation should reuse `styles.subLink` for the trigger button and plain conditional-render (`{advancedOpen && (...)}`) for the body, following React/CSS conventions already established elsewhere in this same file (e.g. the `{teamType === 'draft' && (...)}` conditional-render block at lines 211-236).

## Metadata

**Analog search scope:** `packages/client/src/components/GameSettingsScreen.tsx`, `packages/client/src/components/GameSettingsScreen.module.css`, `packages/client/src/App.tsx`, `packages/shared/src/events.ts`, `packages/shared/src/types.ts`, `packages/server/src/roomStore.ts`, `packages/server/src/roomHandlers.ts`, `packages/server/src/gameEngine.ts`
**Files scanned:** 8 (all files named in CONTEXT.md's code_context, each read directly rather than via broader codebase search — Phase 43's `tackleStealDecline` implementation inside these same files is the strongest possible analog for every new field in this phase)
**Pattern extraction date:** 2026-08-23
