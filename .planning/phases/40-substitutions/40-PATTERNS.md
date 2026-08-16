# Phase 40: Substitutions - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 9
**Analogs found:** 9 / 9

## File Classification

| New/Modified File                                                                                            | Role                                     | Data Flow                               | Closest Analog                                                                                                                         | Match Quality                                                           |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/shared/src/stoppagePhases.ts` (new)                                                                | utility (shared predicate)               | request-response (gate check)           | `packages/server/src/gameHandlers.ts:1651-1665` (`validUndoPhases`)                                                                    | exact idiom, different location (moves to `packages/shared`)            |
| `packages/shared/src/types.ts` (GameState fields + `SUBSTITUTION` ActionEvent)                               | model                                    | CRUD (state fields)                     | `packages/shared/src/types.ts:1107` (`actionCount`), `:1149` (`addedTime`)                                                             | exact — flat counter precedent                                          |
| `packages/server/src/gameHandlers.ts` (new `GAME_SUBSTITUTION` handler)                                      | controller/socket-handler                | request-response                        | `GAME_UNDO` handler, `gameHandlers.ts:1630-1699`                                                                                       | exact — mutex + phase-guard + team-guard + pure-function-delegate shape |
| `packages/server/src/gameEngine.ts` (new `applySubstitution`)                                                | service (pure function)                  | CRUD (state transform)                  | Any `apply*` pure function in `gameEngine.ts` (e.g. `applyUndo`, `applyEndTurn`)                                                       | role-match — same `{ ok, state } \| { ok: false, reason }` return shape |
| `packages/server/src/gameEngine.ts` (`applyEndTurn` addedTime fold-in, 4 return sites)                       | service (pure function, modify existing) | CRUD (incremental state update)         | `gameEngine.ts:2440-2451` (existing addedTime roll) + 3 sibling return sites at `2468`, `2498`, `2571`, `2602`                         | exact — direct extension point named in RESEARCH.md                     |
| `packages/client/src/components/GameBoard.tsx` (new `SubstitutionButton` + modal wrapper)                    | component                                | event-driven (click → open modal)       | `SideLog` component, `GameBoard.tsx:138-170`                                                                                           | exact — collapsed/expanded chevron-strip structural template            |
| `packages/client/src/components/LineupAssignmentScreen.tsx` (new `mode` prop branch)                         | component                                | event-driven (drag/drop → callback)     | itself (existing pregame mode), `LineupAssignmentScreen.tsx:47-381`                                                                    | exact — additive prop branch on same file                               |
| `packages/client/src/components/LineupAssignmentScreen.tsx` (`LineupStatCard` card/injury badge + OUT badge) | component (sub-part)                     | transform (render derived visual state) | `PlayerStatsPanel.tsx:149-170` (card/injury chip logic), `LineupStatCard`'s existing `.lockedBadge` (`LineupAssignmentScreen.tsx:173`) | exact — logic to duplicate/adapt                                        |
| `packages/client/src/store/useGameStore.ts` (new `emitSubstitution`)                                         | store/provider (socket emit action)      | event-driven                            | Existing `emitLineupSwap`-style action in `useGameStore.ts` (mirrors `onSwap`)                                                         | role-match                                                              |

## Pattern Assignments

### `packages/shared/src/stoppagePhases.ts` (new utility)

**Analog:** `packages/server/src/gameHandlers.ts:1651-1666` (`validUndoPhases`)

**Core pattern to copy** (flat `GamePhase[]` allow-list + inline `.includes()` gate):

```typescript
// Source: packages/server/src/gameHandlers.ts:1651-1666
const validUndoPhases: GamePhase[] = [
  'MOVE',
  'HIGH_PASS_MOVE',
  'FIRST_TIME_PASS_MOVE',
  'GK_KICK_MOVE',
  'SNAPSHOT_DEFLECT',
  'FREE_MOVE_ATTACK',
  'FREE_MOVE_DEFENSE',
  'FREE_KICK_SETUP',
  'GOAL_KICK_SETUP_GK',
  'GOAL_KICK_SETUP_OPPONENT',
  'GOAL_KICK_MOVE',
  'CORNER_KICK_REPOSITION',
  'CORNER_KICK_FINAL_SETUP',
];
if (room.gameState === null || !validUndoPhases.includes(room.gameState.phase)) {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
  broadcastState(io, room);
  return;
}
```

**Adaptation for this phase:** Same idiom, but promoted to a shared exported `const` + predicate function (per RESEARCH.md Pattern 1) so both client (button enablement) and server (handler guard) import the identical list — `validUndoPhases` itself stays server-local as precedent only, it is not imported directly.

```typescript
// New file: packages/shared/src/stoppagePhases.ts
export const STOPPAGE_PHASES: readonly GamePhase[] = [
  /* see RESEARCH.md Pattern 1 for candidate list; confirm A1 with user before locking */
] as const;

export function isStoppagePhase(phase: GamePhase): boolean {
  return STOPPAGE_PHASES.includes(phase);
}
```

Comment style precedent: every entry/exclusion in `validUndoPhases` has an inline comment explaining _why_ each phase is included/excluded (see lines 1638-1650 preceding the array) — replicate this discipline for `STOPPAGE_PHASES`, especially for the explicitly-excluded GK-restart-chain/foul-choice phases (RESEARCH.md Open Question 1 / Pitfall 4).

---

### `packages/server/src/gameHandlers.ts` — new `GAME_SUBSTITUTION` handler

**Analog:** `GAME_UNDO` handler, `gameHandlers.ts:1630-1710` (approx.)

**Full shape to copy** (mutex guard → phase guard → team guard → pure-function delegate → broadcast):

```typescript
// Source: packages/server/src/gameHandlers.ts:1630-1699 (GAME_UNDO), condensed
socket.on(ClientEvents.GAME_UNDO, () => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5

  room.isProcessing = true;
  try {
    const validUndoPhases: GamePhase[] = [
      /* ... */
    ];
    if (room.gameState === null || !validUndoPhases.includes(room.gameState.phase)) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    if (!isActivePlayer(socket, room)) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
      broadcastState(io, room);
      return;
    }
    const result = applyUndo(room.gameState);
    if (!result.ok) {
      socket.emit(ServerEvents.GAME_ERROR, result.reason);
      broadcastState(io, room);
      return;
    }
    room.gameState = result.state;
    broadcastState(io, room);
  } finally {
    room.isProcessing = false;
  }
});
```

**Adaptation:** Replace `validUndoPhases.includes(...)` with `isStoppagePhase(room.gameState.phase)` (imported from `packages/shared`, NOT a local re-declared array — this is the whole point of promoting it to shared). Replace `applyUndo(room.gameState)` with `applySubstitution(room.gameState, team, outPieceId, inPieceId)`. Team resolution and payload validation (outPieceId/inPieceId presence) should mirror the payload-destructure style used by other mutating handlers that take a payload object (e.g. `GAME_MOVE`'s socket.on signature) rather than `GAME_UNDO`'s no-payload signature — check a payload-carrying handler (e.g. `LINEUP_SWAP` or `GAME_MOVE`) for the destructure/validate pattern when the handler needs `{ outPieceId, inPieceId }` from the client.

**Error reasons to model after `applyUndo`'s `{ ok: false, reason }` shape:** `SUB_CAP_REACHED`, `CANNOT_SUB_RED_CARD`, `INVALID_SUBSTITUTE`, `ALREADY_SUBBED`, `WRONG_PHASE`, `WRONG_TEAM` (per RESEARCH.md's architecture diagram, lines 140-148 of 40-RESEARCH.md).

---

### `packages/server/src/gameEngine.ts` — new `applySubstitution` pure function

**Analog:** Any existing `apply*` pure function's return-type contract (e.g. `applyUndo`, `applyEndTurn`) — all return `{ ok: true; state: GameState } | { ok: false; reason: string }`.

**Validation-then-mutate shape to copy** (from the architecture diagram in RESEARCH.md, grounded in the codebase's existing pure-function pattern):

```typescript
// Shape template — validate all guards before any mutation, single return of new state
export function applySubstitution(
  state: GameState,
  team: 'home' | 'away',
  outPieceId: string,
  inPieceId: string,
): { ok: true; state: GameState } | { ok: false; reason: string } {
  if (state.subsUsed[team] >= 3) return { ok: false, reason: 'SUB_CAP_REACHED' };
  const outPiece = state.pieces.find((p) => p.id === outPieceId);
  if (!outPiece) return { ok: false, reason: 'INVALID_SUBSTITUTE' };
  if (outPiece.redCarded === true) return { ok: false, reason: 'CANNOT_SUB_RED_CARD' };
  if (!state.bench[team].includes(inPieceId)) return { ok: false, reason: 'INVALID_SUBSTITUTE' };
  // ... swap: bench player inherits outPiece.number/position, remove/mark outPiece,
  // subsUsed[team] += 1, addedTimeBonus += 1, append SUBSTITUTION ActionEvent
}
```

**Do NOT repurpose `piece.onPitch`** for bench/substitution bookkeeping — explicit guardrail comment already in the codebase:

```typescript
// Source: packages/shared/src/types.ts:59-76 (Phase 39, already shipped)
injuryCount?: number;
yellowCards?: 0 | 1 | 2;
redCarded?: boolean;
/** ... do not repurpose it for Phase 40 (Substitutions) roster/bench semantics;
 *  SUB-01..07 need their own data model. */
onPitch?: boolean;
```

Follow the same _shape_ as `redCarded` (piece stays in `state.pieces`, gains a new flag) per RESEARCH.md Assumption A2 — add a distinct new flag (e.g. `subbedOut?: boolean`) rather than splicing the piece out of the array.

---

### `packages/server/src/gameEngine.ts` — `applyEndTurn` addedTime fold-in (4 return sites)

**Analog:** The existing single-roll line, occurring identically in 4 places.

**Exact current code (one of 4 occurrences — all 4 must change identically):**

```typescript
// Source: packages/server/src/gameEngine.ts:2440-2451
if (nextSlot === null) {
  const newActionCount = state.actionCount + GAME_SPEED_MINUTES[state.gameSpeed];
  const HALF_LENGTH = state.half * 45;
  let newAddedTime = state.addedTime;
  if (newActionCount >= HALF_LENGTH && state.addedTime === null) {
    const roll = options?.addedTimeRoll ?? 3;
    newAddedTime = roll + state.refereeCard.leniency; // ← D-06: add `+ state.addedTimeBonus` here
  }
  // ...
}
```

**All 4 exact return-site line numbers where `addedTime: newAddedTime` appears** (grep-verified this session): `gameEngine.ts:2468`, `:2498`, `:2571`, `:2602`. Only the single computation line at `2450` needs the `+ state.addedTimeBonus` change — the 4 return sites all reference the same `newAddedTime` local variable, so this is a single-line fix, not 4 separate edits. (RESEARCH.md's Pitfall 2 flags this correctly but the actual mechanism is simpler than "4 edits" — verify by grepping `newAddedTime =` to confirm only one assignment site exists before/after the change.)

**Half-boundary reset location** (add `addedTimeBonus: 0` here, do NOT touch `subsUsed`):

```typescript
// Source: packages/server/src/gameEngine.ts:2457-2476 (HALF_TIME/FULL_TIME return branch)
return {
  ok: true,
  state: {
    ...state,
    phase: endPhase,
    movementSlot: null,
    activeTeam: nextActiveTeam,
    eventLog: [...state.eventLog, slotAdvanceEvent],
    movedPieceIds: [],
    paceUsedByPieceId: {},
    actionCount: newActionCount,
    addedTime: newAddedTime,
    lastActionType: 'MOVEMENT_PHASE',
    offsidePieceIds: nextOffside,
    lastShotPath: null,
    ...THROW_IN_TEARDOWN,
    // D-07: add `addedTimeBonus: 0,` here (half-only reset) — do NOT reset subsUsed
  },
};
```

---

### `packages/client/src/components/GameBoard.tsx` — `SubstitutionButton` + modal

**Analog:** `SideLog`, `GameBoard.tsx:138-170`

**Full component to copy the structural shape from:**

```typescript
// Source: packages/client/src/components/GameBoard.tsx:138-170
function SideLog() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className={styles.sideLogCollapsed}>
        <button
          className={styles.sideLogChevron}
          onClick={() => setOpen(true)}
          aria-label="Open log"
        >
          &#8250;
        </button>
      </div>
    );
  }

  return (
    <div className={styles.sideLogExpanded}>
      <div className={styles.sideLogHeader}>
        <span>MATCH LOG</span>
        <button
          className={styles.sideLogChevron}
          onClick={() => setOpen(false)}
          aria-label="Close log"
        >
          &#8249;
        </button>
      </div>
      <ActionLog />
    </div>
  );
}
```

**Adaptation per UI-SPEC.md:** `SubstitutionButton` mirrors this collapsed/expanded chevron-strip shape but is mirrored to the opposite edge (attached to `pitchContainer`'s right side), always rendered (not conditionally, per D-03 — enabled only when `isStoppagePhase(phase)` is true, dimmed with `opacity: 0.35; cursor: not-allowed;` when disabled, mirroring `.statCardLocked`'s dimming convention per UI-SPEC.md). Clicking when enabled opens the modal (reuses `ActionPanel.module.css`'s `.confirmOverlay` backdrop pattern — see UI-SPEC.md lines 33) instead of an inline expand — this is the one structural deviation from `SideLog` (modal vs. inline panel).

**Where to wire it in `GameBoard()`:** Follow the same `useGameStore` selector pattern used for other top-level reads:

```typescript
// Source: packages/client/src/components/GameBoard.tsx:183-190
const score = useGameStore((s) => s.gameState.score);
const phase = useGameStore((s) => s.gameState.phase);
const cornerKickTeam = useGameStore((s) => s.gameState.cornerKickTeam);
const actionCount = useGameStore((s) => s.gameState.actionCount);
```

New selectors needed: `state.bench`, `state.subsUsed`, `state.maxOnPitch` (or derived), `phase` (already selected, reuse for `isStoppagePhase(phase)`).

---

### `packages/client/src/components/LineupAssignmentScreen.tsx` — `mode` prop branch + drag reuse

**Analog:** itself — existing `Props` type and drag handlers.

**Existing `Props` type to extend additively** (per RESEARCH.md Pattern 2 — default `'pregame'`, every existing caller unaffected):

```typescript
// Source: packages/client/src/components/LineupAssignmentScreen.tsx:47-72
type Props = {
  assignment: string[];
  formationId: FormationId;
  playerSlot: 1 | 2;
  myTeamId: TeamId;
  onSwap: (slotIndexA: number, slotIndexB: number) => void;
  onConfirm: (confirmedOrder: string[]) => void;
  lineupConfirmed: boolean;
  draftMode?: boolean;
  draftView?: DraftClientView | null;
  onDraftPick?: (cardId: string, destination: DraftDestination) => void;
  onDraftRearrange?: (from: DraftSlotRef, to: DraftSlotRef) => void;
  // NEW additive:
  // mode?: 'pregame' | 'midmatch';
  // subsUsed?: number; maxOnPitch?: number;
  // bench?: { pieceId: string; subbedOut: boolean }[];
  // onSubstitute?: (outPieceId: string, inPieceId: string) => void;
};
```

**Existing drag-and-drop handlers — reuse verbatim, do not reimplement:**

```typescript
// Source: packages/client/src/components/LineupAssignmentScreen.tsx:351-381 (per RESEARCH.md)
function handleDragStart(e: React.DragEvent<HTMLDivElement>, idx: number) {
  setDragSourceIndex(idx);
  e.dataTransfer.setData('text/plain', String(idx));
  e.dataTransfer.effectAllowed = 'move';
}

function handleDrop(e: React.DragEvent<HTMLDivElement>, targetIdx: number) {
  e.preventDefault();
  const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (targetIdx !== 0 && sourceIdx !== targetIdx) {
    onSwap(sourceIdx, targetIdx);
  }
  setDragSourceIndex(null);
  setDropTargetIndex(null);
}
```

In `mode === 'midmatch'`, `onSwap(sourceIdx, targetIdx)` becomes `onSubstitute(outPieceId, inPieceId)` — resolve piece IDs from the drag source (bench card) and drop target (on-pitch slot) instead of two lineup-slot indices; the `dataTransfer` plumbing itself does not change.

**`isDraggable` gating — GK-lock precedent, DO NOT merge with red-card logic (RESEARCH.md Pitfall 6):**

```typescript
// Source: packages/client/src/components/LineupAssignmentScreen.tsx:126-127
const isGK = slotIndex === 0;
const isDraggable = allowGKDrag ? !lineupConfirmed : !isGK && !lineupConfirmed;
```

Add a structurally separate midmatch condition rather than folding into this expression:

```typescript
// New, kept distinct per Pitfall 6:
const isDraggable = mode === 'midmatch' ? !piece.redCarded : (existing GK-lock expression above);
```

**"LOCK" badge precedent — copy for the new "OUT" badge, but with corrected (neutral, not gold) color per UI-SPEC.md:**

```typescript
// Source: packages/client/src/components/LineupAssignmentScreen.tsx:173
{isGK && !allowGKDrag && <span className={styles.lockedBadge}>LOCK</span>}
```

New OUT badge: same 9px/700 sizing/letter-spacing treatment, new CSS class using `--color-text-tertiary` (`#808080`) on `--color-bg-surface-alt` instead of `--color-accent-gold` (UI-SPEC.md Color section explicitly corrects the naive copy-paste here — do not reuse `.lockedBadge`'s gold color).

---

### `LineupStatCard` — new card/injury badge on sub-roster rows (D-05's one genuinely-new surface)

**Analog:** `PlayerStatsPanel.tsx:149-170` (already-shipped Phase 39 logic — duplicate this, do not build new derivation logic)

**Exact logic to duplicate into `LineupStatCard`'s `.cardMeta` row:**

```typescript
// Source: packages/client/src/components/PlayerStatsPanel.tsx:149-170
{(() => {
  const cardColor: 'yellow' | 'red' | null =
    piece.redCarded === true ? 'red' : (piece.yellowCards ?? 0) > 0 ? 'yellow' : null;
  if (!cardColor) return null;
  return (
    <span data-testid="stats-card-chip" data-card={cardColor} className={styles.cardChip}>
      {cardColor.toUpperCase()}
    </span>
  );
})()}
{(piece.injuryCount ?? 0) > 0 && (
  <span data-testid="stats-injury-chip" className={styles.injuryChip}>
    {(piece.injuryCount ?? 0) >= 2 ? 'INJ ×2' : 'INJ'}
  </span>
)}
```

Insert into the existing `.cardMeta` row in `LineupStatCard` (`LineupAssignmentScreen.tsx:168-174`, which today only renders flag/role/#) using the same `.cardChip`/`.injuryChip` CSS classes (already defined, cross-component reuse — confirm they're exported/shared or duplicate the CSS Module rule into `LineupAssignmentScreen.module.css` under the same class names per UI-SPEC.md's "identical classes/tokens" instruction).

**Current existing `.cardMeta` row (insertion point):**

```typescript
// Source: packages/client/src/components/LineupAssignmentScreen.tsx:168-174
<div className={styles.cardMeta}>
  <NationFlag nationality={player.nationality} size={14} />
  <span className={styles.cardRole}>{player.role}</span>
  <span className={styles.cardNum}>#{slotMeta.jerseyNumber}</span>
  {isGK && !allowGKDrag && <span className={styles.lockedBadge}>LOCK</span>}
</div>
```

Note: `LineupStatCard`'s `player` type is `PoolPlayer`, which does not carry `redCarded`/`yellowCards`/`injuryCount` (those live on `PlayerPiece`, a live-match type). In `mode === 'midmatch'`, the caller must pass a `PlayerPiece`-shaped object (or merge PoolPlayer + live piece fields) so this badge has data to read — this is a real wiring decision the planner must make explicit (not resolvable by direct copy-paste, since the two source types differ).

---

## Shared Patterns

### Server-authoritative mutex + phase-guard + pure-function-delegate handler shape

**Source:** `packages/server/src/gameHandlers.ts:1630-1699` (`GAME_UNDO`)
**Apply to:** `GAME_SUBSTITUTION` handler

```typescript
room.isProcessing = true;
try {
  // 1. phase guard (isStoppagePhase)
  // 2. team guard (isActivePlayer or equivalent)
  // 3. delegate to pure function
  // 4. room.gameState = result.state; broadcastState(io, room)
} finally {
  room.isProcessing = false;
}
```

### Flat per-team counter fields on `GameState`

**Source:** `packages/shared/src/types.ts:1107` (`actionCount: number`), `:1149` (`addedTime: number | null`)
**Apply to:** `subsUsed: { home: number; away: number }`, `addedTimeBonus: number`, `bench: { home: string[]; away: string[] }` — no nested sub-object beyond team-keying; simple flat shape, no separate class/module.

### Undo/Replay registration — per-event-type bookkeeping (recurring pitfall, shipped twice already: BUG-30/31, BUG-37)

**Source:** RESEARCH.md Pitfall 1 — three locations: server `isBoundary` reduce (`gameEngine.ts:2930` region), client-mirrored `isBoundary` reduce (`ActionPanel.tsx:295`, possibly `CornerKickSetupPanel.tsx:245`, `FreeKickSetupPanel.tsx:173`), `REPLAY_ELIGIBLE_TYPES` set (`gameEngine.ts:9191`).
**Apply to:** New `SUBSTITUTION` `ActionEvent` member. RESEARCH.md's Assumption A4 recommends deliberately excluding it from Undo/Replay (mirroring `SECOND_HALF_CONFIRM`/`GK_BOX_ENTRY_MOVE` exclusion precedent at `gameEngine.ts:9251-9254`) but flags this as a required explicit planning decision, not a silent default.

### Card/injury derivation logic (red-wins-over-yellow, injury count → "INJ"/"INJ ×2")

**Source:** `packages/client/src/components/PlayerStatsPanel.tsx:149-170`
**Apply to:** New sub-roster-row badge in `LineupAssignmentScreen.tsx`'s `LineupStatCard`. Do NOT touch `PlayerStatsPanel.tsx` itself — it already has this badge (Phase 39), confirmed by direct inspection; CONTEXT.md D-05 describing it as new work is a documented discrepancy.

## No Analog Found

None — RESEARCH.md's "Don't Hand-Roll" table and the codebase scan confirm every mechanical building block this phase needs (drag-and-drop, card rendering, cross-cutting phase gating, flat per-team counters, socket-handler shape, pure-function return contract) already has a direct, provably-working analog in the current codebase.

## Metadata

**Analog search scope:** `packages/client/src/components/` (LineupAssignmentScreen.tsx, GameBoard.tsx, PlayerStatsPanel.tsx, BenchCarousel.tsx), `packages/server/src/` (gameHandlers.ts, gameEngine.ts), `packages/shared/src/types.ts`
**Files scanned:** 6 (all directly named by CONTEXT.md/RESEARCH.md as reuse targets; no broader search needed given RESEARCH.md's already-exhaustive file:line citations)
**Pattern extraction date:** 2026-08-15
