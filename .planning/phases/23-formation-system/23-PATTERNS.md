# Phase 23: Formation System — Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 9 (6 modified, 1 new shared module, 1 new test file, 1 CSS extension)
**Analogs found:** 8 / 9

---

## File Classification

| New/Modified File                                                  | Role          | Data Flow        | Closest Analog                                                | Match Quality |
| ------------------------------------------------------------------ | ------------- | ---------------- | ------------------------------------------------------------- | ------------- |
| `packages/shared/src/formations.ts`                                | data-registry | transform        | `packages/shared/src/uniformStyles.ts`                        | exact         |
| `packages/shared/src/index.ts`                                     | config        | —                | self (barrel pattern)                                         | exact         |
| `packages/shared/src/types.ts`                                     | model         | —                | self (`selectedUniformStyles` field pattern)                  | exact         |
| `packages/shared/src/events.ts`                                    | config        | request-response | self (`UNIFORM_CONFIRM` / `UNIFORM_HOME_CONFIRMED` extension) | exact         |
| `packages/server/src/roomStore.ts`                                 | store         | —                | self (`homePickedUniformStyle` field pattern)                 | exact         |
| `packages/server/src/roomHandlers.ts`                              | controller    | request-response | self (`UNIFORM_CONFIRM` handler)                              | exact         |
| `packages/server/src/gameEngine.ts`                                | service       | transform        | self (`buildSquadPieces`)                                     | exact         |
| `packages/client/src/components/UniformSelectionScreen.tsx`        | component     | request-response | self (team/style card grid section)                           | exact         |
| `packages/client/src/components/UniformSelectionScreen.module.css` | config        | —                | self (`.teamCard`, `.teamCardSelected`, `.sectionLabel`)      | exact         |

---

## Pattern Assignments

### `packages/shared/src/formations.ts` (new data-registry, transform)

**Analog:** `packages/shared/src/uniformStyles.ts`

**Imports pattern** (uniformStyles.ts lines 1–7 — shared package, no React/JSX):

```typescript
/** No React/JSX imports — shared package must not reference the JSX runtime. */
// formations.ts imports only from './types.js' (for HexCoord)
import type { HexCoord } from './types.js';
```

**Core data-registry pattern** (uniformStyles.ts lines 7–37):

```typescript
// Union type for the identifier set — matches UniformStyleId pattern exactly
export type UniformStyleId = 'pinstripes-horizontal' | 'pinstripes-vertical';
// ...

// Metadata interface for each entry in the registry
export interface UniformStyleMeta {
  id: UniformStyleId;
  name: string;
  description: string;
}

// Record keyed by the union type — TypeScript enforces all keys present
export const UNIFORM_STYLE_META: Record<UniformStyleId, UniformStyleMeta> = {
  'pinstripes-horizontal': {
    id: 'pinstripes-horizontal',
    name: 'Pinstripes (H)',
    description: 'Narrow horizontal stripes with a solid centre circle',
  },
  // ... all entries
};
```

**Application to formations.ts:** Replace `UniformStyleId` with `FormationId`, `UniformStyleMeta` with `FormationSlot` shape, and `UNIFORM_STYLE_META` with `FORMATIONS`. The `FORMATIONS` record value is richer (contains `slots: readonly FormationSlot[]` + `description`) rather than a flat metadata object. Use `satisfies` for type enforcement:

```typescript
export const FORMATIONS = {
  '4-4-2': { description: '...', slots: [...] },
  // ...
} satisfies Record<FormationId, { slots: readonly FormationSlot[]; description: string }>;
```

**Readonly guard pattern** — use `as const` on slots array or `readonly FormationSlot[]` in the interface to prevent FORMATIONS mutation (Pitfall 1 in RESEARCH.md). The `satisfies` operator (not `as const` on the whole object) preserves the inferred `FormationId` key type.

---

### `packages/shared/src/index.ts` (barrel export, config)

**Analog:** `packages/shared/src/index.ts` lines 18 (uniformStyles.ts barrel export)

**Pattern** (index.ts line 18):

```typescript
export * from './uniformStyles.js'; // Phase 20: UniformStyleId type + UNIFORM_STYLE_META
```

**Copy exactly for formations:**

```typescript
export * from './formations.js'; // Phase 23: FormationId, FormationSlot, SlotRole, FORMATIONS
```

Insert after the `uniformStyles.js` export line (line 18) to maintain chronological ordering.

---

### `packages/shared/src/types.ts` (model extension)

**Analog:** `packages/shared/src/types.ts` line 480–481 (`selectedUniformStyles` field addition)

**Field addition pattern** (types.ts lines 479–481):

```typescript
/** Phase 16 D-15: teams selected before match start, embedded in every GameState snapshot. */
selectedTeams: {
  home: TeamId;
  away: TeamId;
}
/** Phase 22 D-16: uniform styles selected before match start, embedded in every GameState snapshot. */
selectedUniformStyles: {
  home: UniformStyleId;
  away: UniformStyleId;
}
```

**Copy pattern for selectedFormation** — add immediately after `selectedUniformStyles` field, same JSDoc style:

```typescript
/** Phase 23 D-11: formations selected before match start, embedded in every GameState snapshot. */
selectedFormation: {
  home: FormationId;
  away: FormationId;
}
```

Import `FormationId` at the top of `types.ts` following the existing import pattern (lines 1–2):

```typescript
import type { TeamId } from './teamConfig.js';
import type { UniformStyleId } from './uniformStyles.js';
// add:
import type { FormationId } from './formations.js';
```

---

### `packages/shared/src/events.ts` (event extension, request-response)

**Analog:** self — `UNIFORM_CONFIRM` / `UNIFORM_HOME_CONFIRMED` signatures (events.ts lines 68, 86–87, 154, 177)

**ClientToServerEvents extension pattern** (events.ts line 154):

```typescript
/** Phase 22 D-14: client confirms team + uniform style selection. Validated server-side. */
[ClientEvents.UNIFORM_CONFIRM]: (teamId: TeamId, uniformStyle: UniformStyleId) => void;
```

Phase 23 extends to:

```typescript
/** Phase 22/23: client confirms team + uniform style + formation selection. Validated server-side. */
[ClientEvents.UNIFORM_CONFIRM]: (teamId: TeamId, uniformStyle: UniformStyleId, formationId: FormationId) => void;
```

**ServerToClientEvents extension pattern** (events.ts line 177):

```typescript
/** Phase 22 D-15: informs both players that home has confirmed their team + uniform style. */
[ServerEvents.UNIFORM_HOME_CONFIRMED]: (teamId: TeamId, uniformStyle: UniformStyleId) => void;
```

Phase 23 extends to:

```typescript
/** Phase 22/23: informs both players that home has confirmed their team + uniform style + formation. */
[ServerEvents.UNIFORM_HOME_CONFIRMED]: (teamId: TeamId, uniformStyle: UniformStyleId, formationId: FormationId) => void;
```

Import `FormationId` at top of events.ts alongside existing shared-type imports (lines 1–3):

```typescript
import type { HexCoord, GameState, GameSpeed } from './types.js';
import type { TeamId } from './teamConfig.js';
import type { UniformStyleId } from './uniformStyles.js';
// add:
import type { FormationId } from './formations.js';
```

---

### `packages/server/src/roomStore.ts` (store extension)

**Analog:** self — `homePickedUniformStyle` field (roomStore.ts lines 89–93)

**Field addition pattern** (roomStore.ts lines 88–93):

```typescript
/**
 * Phase 22 D-15: set on home's UNIFORM_CONFIRM; presence gates away's confirm branch.
 * undefined = home has not yet confirmed; defined = home confirmed, away may now confirm.
 */
homePickedUniformStyle?: UniformStyleId;
```

**Copy pattern for formation fields** — add after `homePickedUniformStyle` in the `Room` type, following same JSDoc convention:

```typescript
/**
 * Phase 23 D-10: set on home's UNIFORM_CONFIRM; presence gates away's confirm branch.
 * undefined = home has not yet confirmed; null not used — field is absent until set.
 */
homePickedFormation?: FormationId;
/**
 * Phase 23 D-10: set on away's UNIFORM_CONFIRM after home has confirmed.
 * undefined = away has not yet confirmed.
 */
awayPickedFormation?: FormationId;
```

Import `FormationId` in roomStore.ts alongside existing shared imports (roomStore.ts lines 14–15):

```typescript
import type { GameState, GameSpeed, HexCoord } from '@counter-attack/shared';
import type { TeamId, UniformStyleId } from '@counter-attack/shared';
// extend the second import line to include FormationId:
import type { TeamId, UniformStyleId, FormationId } from '@counter-attack/shared';
```

---

### `packages/server/src/roomHandlers.ts` (controller extension, request-response)

**Analog:** self — `UNIFORM_CONFIRM` handler (roomHandlers.ts lines 279–356)

**Allow-list validation pattern** (roomHandlers.ts lines 59 area + lines 298–305):

```typescript
/** Valid uniform style IDs — allow-list for UNIFORM_CONFIRM validation (T-22-03). */
// (at module top, before handler registration)
const VALID_UNIFORM_STYLE_IDS: readonly UniformStyleId[] = Object.keys(
  UNIFORM_STYLE_META,
) as UniformStyleId[];

// Inside handler:
if (!(VALID_UNIFORM_STYLE_IDS as readonly string[]).includes(uniformStyle)) {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_STYLE');
  return;
}
```

**Copy pattern for formationId allow-list:**

```typescript
const VALID_FORMATION_IDS: readonly FormationId[] = ['4-4-2', '5-3-2', '4-3-3', '3-4-3'] as const;

// Inside handler, after uniformStyle check:
if (!(VALID_FORMATION_IDS as readonly string[]).includes(formationId)) {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_FORMATION');
  return;
}
```

**isProcessing mutex pattern** (roomHandlers.ts lines 293–296 + 353–355):

```typescript
if (room.isProcessing) return;
room.isProcessing = true;
try {
  // ... all handler logic
} finally {
  room.isProcessing = false;
}
```

**Home-first guard + storage pattern** (roomHandlers.ts lines 309–319):

```typescript
if (room.homePickedUniformStyle === undefined) {
  // T-22-04: Home confirms first — only slot 1 may act now.
  if (playerSlot !== 1) {
    socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN');
    return;
  }
  room.homePickedTeam = teamId;
  room.homePickedUniformStyle = uniformStyle;
  io.to(roomCode).emit(ServerEvents.UNIFORM_HOME_CONFIRMED, teamId, uniformStyle);
}
```

**Phase 23 home branch extension** — add `formationId` storage alongside `uniformStyle`:

```typescript
room.homePickedTeam = teamId;
room.homePickedUniformStyle = uniformStyle;
room.homePickedFormation = formationId; // Phase 23 addition
io.to(roomCode).emit(ServerEvents.UNIFORM_HOME_CONFIRMED, teamId, uniformStyle, formationId);
```

**Away branch** (roomHandlers.ts lines 320–351) — Phase 23 removes `buildInitialGameState` call and replaces with formation storage. The pattern for storing and signalling is:

```typescript
} else {
  if (playerSlot !== 2) { socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TURN'); return; }
  if (teamId === room.homePickedTeam) { socket.emit(ServerEvents.GAME_ERROR, 'TEAM_ALREADY_PICKED'); return; }
  // Phase 23: store away formation; do NOT call buildInitialGameState (Phase 24 does this)
  room.awayPickedTeam = teamId;
  room.awayPickedFormation = formationId;
  // Phase 23: emit BOTH_FORMATIONS_CONFIRMED signal (planner defines exact event name)
  // broadcastState(io, room) is NOT called here — no gameState yet
}
```

**Handler signature extension** (roomHandlers.ts line 286):

```typescript
// current:
socket.on(ClientEvents.UNIFORM_CONFIRM, (teamId: TeamId, uniformStyle: UniformStyleId) => {
// Phase 23:
socket.on(ClientEvents.UNIFORM_CONFIRM, (teamId: TeamId, uniformStyle: UniformStyleId, formationId: FormationId) => {
```

---

### `packages/server/src/gameEngine.ts` (service rewrite, transform)

**Analog:** self — `buildSquadPieces` (gameEngine.ts lines 113–148), `buildKickOffPieces` (lines 196–201), `buildInitialGameState` (lines 150–187)

**Current buildSquadPieces signature** (gameEngine.ts lines 113–116):

```typescript
function buildSquadPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
): PlayerPiece[] {
```

**Phase 23 extended signature** — add `selectedFormation` parameter:

```typescript
function buildSquadPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
  selectedFormation: { home: FormationId; away: FormationId },
): PlayerPiece[] {
```

**Current squad-build body** (gameEngine.ts lines 117–128):

```typescript
const homeSquad = getSquadPlayers(selectedTeams.home).map((p, i) => ({
  ...p,
  teamId: 'home' as const,
  id: `home-${i}`,
}));
const awaySquad = getSquadPlayers(selectedTeams.away).map((p, i) => ({
  ...p,
  teamId: 'away' as const,
  id: `away-${i}`,
  position: { q: 36 - p.position.q, r: p.position.r }, // A1 mirror formula
}));
```

**Phase 23 rewrite** — replace `p.position` with FORMATIONS lookup; spread positions to avoid mutation (Pitfall 1):

```typescript
const homeSlots = FORMATIONS[selectedFormation.home].slots;
const awaySlots = FORMATIONS[selectedFormation.away].slots;

const homeSquad = getSquadPlayers(selectedTeams.home).map((p, i) => ({
  ...p,
  teamId: 'home' as const,
  id: `home-${i}`,
  position: { ...homeSlots[i].position }, // spread — never reference slot directly
  number: homeSlots[i].jerseyNumber, // formation jersey number replaces squad number
}));
const awaySquad = getSquadPlayers(selectedTeams.away).map((p, i) => ({
  ...p,
  teamId: 'away' as const,
  id: `away-${i}`,
  position: { q: 36 - awaySlots[i].position.q, r: awaySlots[i].position.r }, // mirror + spread
  number: awaySlots[i].jerseyNumber,
}));
```

**Current kick-off striker logic** (gameEngine.ts lines 129–146) — MUST change from `role === 'ST'` to `number === 9`:

```typescript
// current (lines 129–130):
const homeST = pieces.find((p) => p.teamId === 'home' && p.role === 'ST');
const awayST = pieces.find((p) => p.teamId === 'away' && p.role === 'ST');

// Phase 23 rewrite:
const homeST = pieces.find((p) => p.teamId === 'home' && p.number === 9);
const awayST = pieces.find((p) => p.teamId === 'away' && p.number === 9);
```

**Kick-off +4 shift** — new block inserted after squad construction, before the `homeST`/`awayST` kick-off positioning:

```typescript
// Kick-off +4 shift: kicking team outfield pieces shift toward centre
for (const piece of pieces) {
  if (piece.teamId !== attackingTeam) continue;
  if (piece.role === 'GK') continue;
  piece.position =
    attackingTeam === 'home'
      ? { q: piece.position.q + 4, r: piece.position.r }
      : { q: piece.position.q - 4, r: piece.position.r };
}
// Then find striker by jersey number and reposition to kick-off hex (overrides shift result)
```

**buildInitialGameState signature extension** (gameEngine.ts line 150–154):

```typescript
// current:
export function buildInitialGameState(
  roomCode: string,
  selectedTeams: { home: TeamId; away: TeamId },
  gameSpeed: GameSpeed = 'standard',
  selectedUniformStyles: { home: UniformStyleId; away: UniformStyleId },
): GameState {

// Phase 23 addition — add selectedFormation parameter:
export function buildInitialGameState(
  roomCode: string,
  selectedTeams: { home: TeamId; away: TeamId },
  gameSpeed: GameSpeed = 'standard',
  selectedUniformStyles: { home: UniformStyleId; away: UniformStyleId },
  selectedFormation: { home: FormationId; away: FormationId },
): GameState {
```

**buildInitialGameState body extension** (gameEngine.ts line 183–184) — add `selectedFormation` field to returned state:

```typescript
selectedTeams,           // D-15
selectedUniformStyles,   // Phase 22 D-17
selectedFormation,       // Phase 23 D-11
gameSpeed,
```

**buildKickOffPieces extension** (gameEngine.ts lines 196–201) — must receive and pass `selectedFormation`:

```typescript
// current:
export function buildKickOffPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
) {
  return buildSquadPieces(attackingTeam, selectedTeams);
}

// Phase 23:
export function buildKickOffPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
  selectedFormation: { home: FormationId; away: FormationId },
) {
  return buildSquadPieces(attackingTeam, selectedTeams, selectedFormation);
}
```

**All callers of buildKickOffPieces** must also be updated (gameEngine.ts lines 1948, 2035, 4118, 4214) to pass `state.selectedFormation` as the third argument.

---

### `packages/client/src/components/UniformSelectionScreen.tsx` (component extension, request-response)

**Analog:** self — team grid section (lines 217–250) and confirm button (lines 308–325)

**Static formation options array pattern** — mirrors `ALL_TEAMS` / `SPEED_OPTIONS` constants at file top (lines 42–81):

```typescript
// At file top, after existing imports:
import formation442 from '../assets/formations/442.png';
import formation532 from '../assets/formations/532.png';
import formation433 from '../assets/formations/433.png';
import formation343 from '../assets/formations/343.png';
import type { FormationId } from '@counter-attack/shared';
import { FORMATIONS } from '@counter-attack/shared';

const FORMATION_OPTIONS: { id: FormationId; asset: string; label: string }[] = [
  { id: '4-4-2', asset: formation442, label: '4-4-2' },
  { id: '5-3-2', asset: formation532, label: '5-3-2' },
  { id: '4-3-3', asset: formation433, label: '4-3-3' },
  { id: '3-4-3', asset: formation343, label: '3-4-3' },
];
```

**State initialization pattern** — mirrors `useState<TeamId | null>(null)` (line 116):

```typescript
// D-07: default pre-selected formation is '4-4-2'
const [selectedFormation, setSelectedFormation] = useState<FormationId>('4-4-2');
```

**Card selection loop pattern** (lines 220–250 — team card loop):

```typescript
{ALL_TEAMS.map((teamId) => {
  const isDisabled = isStruckOut || hasConfirmed || awayLocked;
  return (
    <button
      key={teamId}
      disabled={isDisabled}
      aria-pressed={teamId === selectedTeam}
      aria-label={TEAM_CONFIGS[teamId].name}
      className={teamId === selectedTeam ? styles.teamCardSelected : styles.teamCard}
      onClick={() => { if (!isDisabled) setSelectedTeam(teamId); }}
    >
      <img src={FULL_BADGE_MAP[teamId]} alt={...} className={styles.teamBadge} />
    </button>
  );
})}
```

**Formation grid section** — insert between team grid (line 250) and style label (line 252), using exact same `sectionLabel` + grid + card pattern:

```tsx
{/* Formation grid section — D-05: inserted between team grid and style grid */}
<p className={styles.sectionLabel}>Formation</p>
<div className={styles.formationGrid}>
  {FORMATION_OPTIONS.map(({ id, asset, label }) => (
    <button
      key={id}
      disabled={hasConfirmed || awayLocked}
      aria-pressed={id === selectedFormation}
      aria-label={`${label} formation`}
      className={id === selectedFormation ? styles.formationCardSelected : styles.formationCard}
      onClick={() => { if (!hasConfirmed && !awayLocked) setSelectedFormation(id); }}
    >
      <img src={asset} alt={`${label} formation diagram`} className={styles.formationImage} />
      <p className={styles.formationLabel}>{label}</p>
      <p className={styles.formationDescription}>{FORMATIONS[id].description}</p>
    </button>
  ))}
</div>
```

**Props extension pattern** (line 89) — `onConfirm` signature extends with `formationId`:

```typescript
// current (line 89):
onConfirm: (teamId: TeamId, uniformStyle: UniformStyleId) => void;
// Phase 23:
onConfirm: (teamId: TeamId, uniformStyle: UniformStyleId, formationId: FormationId) => void;
```

**Confirm button click handler** (line 315–317) — add `selectedFormation` to call:

```typescript
// current:
onConfirm(selectedTeam, selectedStyle);
// Phase 23:
onConfirm(selectedTeam, selectedStyle, selectedFormation);
```

---

### `packages/client/src/components/UniformSelectionScreen.module.css` (CSS extension)

**Analog:** self — `.teamCard`, `.teamCardSelected`, `.sectionLabel` (lines 38–110)

**Card base pattern** (lines 65–77 for `.teamCard`):

```css
.teamCard {
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: transparent;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    box-shadow 0.15s ease,
    opacity 0.15s ease;
}
```

**Selected state pattern** (lines 84–97 for `.teamCardSelected`):

```css
.teamCardSelected {
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 6px;
  background: transparent;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.45);
  transition:
    box-shadow 0.15s ease,
    opacity 0.15s ease;
}
```

**Formation-specific additions** — 4-card grid (narrower than 6-col team grid), image + label + description inside each card:

```css
/* Formation grid — 4 cards in a row; matches team grid gap and max-width style */
.formationGrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  max-width: 560px;
  width: 100%;
}

@media (max-width: 640px) {
  .formationGrid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Formation card — base state; mirrors .teamCard shape */
.formationCard {
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: #1a1a2e;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: box-shadow 0.15s ease;
}

/* Formation card — selected state; mirrors .teamCardSelected shape */
.formationCardSelected {
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 6px;
  background: #1a1a2e;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.45);
  transition: box-shadow 0.15s ease;
}

.formationImage {
  height: 100px; /* UI-SPEC: 100px image height for legibility */
  width: auto;
  object-fit: contain;
  display: block;
}

.formationLabel {
  font-size: 13px;
  font-weight: 700;
  color: #e0e0e0;
  margin: 0;
}

.formationDescription {
  font-size: 11px;
  color: #a0a0a0;
  margin: 0;
  text-align: center;
  line-height: 1.3;
}
```

---

## Shared Patterns

### isProcessing Mutex

**Source:** `packages/server/src/roomHandlers.ts` lines 293–296, 353–355
**Apply to:** All server handler extensions in `roomHandlers.ts`

```typescript
if (room.isProcessing) return;
room.isProcessing = true;
try {
  // handler logic
} finally {
  room.isProcessing = false;
}
```

### Allow-list Input Validation

**Source:** `packages/server/src/roomHandlers.ts` lines 298–305
**Apply to:** `UNIFORM_CONFIRM` handler for new `formationId` parameter

```typescript
if (!(VALID_FORMATION_IDS as readonly string[]).includes(formationId)) {
  socket.emit(ServerEvents.GAME_ERROR, 'INVALID_FORMATION');
  return;
}
```

### Away Mirror Formula

**Source:** `packages/server/src/gameEngine.ts` line 126
**Apply to:** `buildSquadPieces` away squad construction

```typescript
position: { q: 36 - awaySlots[i].position.q, r: awaySlots[i].position.r }
```

### PITCH_REGIONS.kickOffHex Reference

**Source:** `packages/server/src/gameEngine.ts` lines 140, 144
**Apply to:** `buildSquadPieces` kick-off striker repositioning

```typescript
// current usage:
homeST.position = { ...PITCH_REGIONS.kickOffHex }; // centre dot — always spread, never reference
```

### Barrel Export Convention

**Source:** `packages/shared/src/index.ts` lines 3–18
**Apply to:** `formations.ts` export entry

```typescript
export * from './formations.js'; // Phase 23: FormationId, FormationSlot, SlotRole, FORMATIONS
```

---

## No Analog Found

All files in Phase 23 have close analogs in the existing codebase. No files require fallback to RESEARCH.md patterns alone.

| File                                                       | Note                                                                                                                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/__tests__/gameEngine.phase23.test.ts` | New test file — analog is `packages/server/src/__tests__/gameEngine.teamselect.test.ts` (existing Vitest test file for gameEngine). Executor should read that file before writing the new test. |
| `packages/server/src/__tests__/formations.test.ts`         | New data-integrity test — no exact analog exists; use the Vitest test file pattern from `gameEngine.teamselect.test.ts` for imports and `describe`/`it` structure.                              |

---

## Metadata

**Analog search scope:** `packages/shared/src/`, `packages/server/src/`, `packages/client/src/components/`
**Files read:** 9
**Pattern extraction date:** 2026-07-05
