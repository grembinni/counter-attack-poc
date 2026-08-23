# Phase 43: Tackle/Steal Prompt & Decline - Pattern Map

**Mapped:** 2026-08-23
**Files analyzed:** 11 (new + modified)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File                                                                                       | Role                   | Data Flow                               | Closest Analog                                                                                                                                           | Match Quality                               |
| ------------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `packages/client/src/components/TackleStealPromptPanel.tsx` (NEW)                                       | component              | request-response (interrupt prompt)     | `packages/client/src/components/GkDiveAtFeetPromptPanel.tsx`                                                                                             | exact (explicitly named in CONTEXT.md D-05) |
| `packages/client/src/components/TackleStealPromptPanel.module.css` (NEW)                                | component (styles)     | —                                       | `packages/client/src/components/GkDiveAtFeetPromptPanel.module.css`                                                                                      | exact                                       |
| `packages/shared/src/types.ts` (GamePhase/ActionEventType/GameState fields)                             | model                  | CRUD (type union extension)             | Same file's `GK_DIVE_AT_FEET_PROMPT`/`GK_DIVE_AT_FEET_DECLINED`/`gkDiveAtFeetResume` region                                                              | exact                                       |
| `packages/shared/src/moveValidator.ts` (sort defenders by tackling desc)                                | utility                | transform                               | Same file's existing `isActivePiece`-filtered `defenders` construction (lines ~100-111)                                                                  | exact (extend in place)                     |
| `packages/shared/src/stoppagePhases.ts` (STOPPAGE_PHASES — confirm NO entry added)                      | config                 | —                                       | Same file's existing exclusion-comment block naming `GK_DIVE_AT_FEET_PROMPT`/`GK_DIVE_AT_FEET_TARGET`/`GK_BOX_ENTRY_PROMPT` as excluded mid-duel prompts | exact                                       |
| `packages/server/src/gameEngine.ts` (`applyMove` new toggle branch inside STEAL_ATTEMPT/TACKLE_ATTEMPT) | service                | event-driven / state-machine transition | Same file's `applyGkDiveAtFeetResponse` (lines 1957-2005+) resume/decline-clear pattern                                                                  | exact                                       |
| `packages/server/src/gameEngine.ts` (new `applyTackleStealChoice` function)                             | service                | event-driven                            | `applyGkDiveAtFeetResponse` (lines 1957-2005+)                                                                                                           | exact                                       |
| `packages/server/src/gameEngine.ts` (`applyUndo`'s `isBoundary` disjunction)                            | service                | CRUD (boolean classification)           | Same file, lines 3473-3530 — `GK_DIVE_AT_FEET`/`GK_DIVE_AT_FEET_DECLINED`-adjacent boundary terms                                                        | exact                                       |
| `packages/server/src/gameEngine.ts` (`REPLAY_ELIGIBLE_TYPES`)                                           | service                | CRUD (set membership)                   | Same file, lines 9920-9932 — `GK_DIVE_AT_FEET` included / `GK_DIVE_AT_FEET_DECLINED` explicitly excluded                                                 | exact                                       |
| `packages/server/src/gameHandlers.ts` (new `GAME_TACKLE_STEAL_CHOICE` handler)                          | route (socket handler) | request-response                        | `GAME_GK_DIVE_AT_FEET` handler (lines 3172-3221)                                                                                                         | exact                                       |
| `packages/client/src/store/useGameStore.ts` (new `emitTackleStealChoice`)                               | store                  | event-driven (fire-and-forget emit)     | `emitGkDiveAtFeet` (lines 1849-1852)                                                                                                                     | exact                                       |
| `packages/client/src/components/GameBoard.tsx` (PHASE_LABEL + panel routing)                            | component              | request-response                        | `GK_DIVE_AT_FEET_PROMPT: 'DIVE AT FEET'` (line 81) + phase-ternary panel routing (line 476)                                                              | exact                                       |
| `packages/client/src/components/ActionLog.tsx` (`formatEvent` case for decline event)                   | component              | transform (event → display)             | `GK_DIVE_AT_FEET_DECLINED` case (lines 1157-1168)                                                                                                        | exact                                       |
| `packages/client/src/components/GameSettingsScreen.tsx` (new `tackleStealDecline` toggle)               | component              | CRUD (form state)                       | `outOfBounds` toggle: `useState` (line 56), `onConfirm` payload field (lines 26-27, 110), checkbox JSX (lines 186-193)                                   | exact                                       |
| `packages/server/src/gameEngine.ts` (`buildInitialGameState` new param)                                 | service                | CRUD (config threading)                 | `outOfBoundsEnabled: boolean = false` param (line ~373-377 per RESEARCH.md)                                                                              | exact                                       |

## Pattern Assignments

### `packages/client/src/components/TackleStealPromptPanel.tsx` (component, request-response)

**Analog:** `packages/client/src/components/GkDiveAtFeetPromptPanel.tsx` (full file, 124 lines) — explicitly mandated structural mirror per CONTEXT.md D-05.

**Imports pattern** (lines 1-4):

```typescript
import { useGameStore } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';
import styles from './GkDiveAtFeetPromptPanel.module.css';
```

For the new file, swap the last import to `./TackleStealPromptPanel.module.css` and add whatever store selectors the new resume fields need (`tackleStealPromptTeam`, `tackleStealPromptDefenderId`, `tackleStealPromptCarrierId`, `tackleStealPromptKind`, `emitTackleStealChoice`).

**Phase guard + early return** (lines 20-36):

```typescript
export function GkDiveAtFeetPromptPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const myTeamOrNull = useMyTeam();
  const pieces = useGameStore((s) => s.gameState.pieces);
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const gkDiveAtFeetTeam = useGameStore((s) => s.gameState.gkDiveAtFeetTeam);
  const gkDiveAtFeetCarrierId = useGameStore((s) => s.gameState.gkDiveAtFeetCarrierId);
  const gkDiveAtFeetDistance = useGameStore((s) => s.gameState.gkDiveAtFeetDistance);
  const gameError = useGameStore((s) => s.gameError);
  const emitGkDiveAtFeet = useGameStore((s) => s.emitGkDiveAtFeet);

  if (
    (phase !== 'GK_DIVE_AT_FEET_PROMPT' && phase !== 'GK_DIVE_AT_FEET_TARGET') ||
    myTeamOrNull === null
  ) {
    return null;
  }
  ...
```

For `TackleStealPromptPanel`, the guard becomes `phase !== 'TACKLE_STEAL_PROMPT' || myTeamOrNull === null` — this new phase has no two-step target sub-phase (unlike GK Dive's `_TARGET` step), so the `GK_DIVE_AT_FEET_TARGET` branch (lines 42-75 of the analog) has no equivalent and should be omitted entirely.

**Deciding-team vs waiting-manager branch** (lines 77-92):

```typescript
if (myTeam !== decidingTeam) {
  const sideLabel = decidingTeam === attackingTeam ? 'Attacking' : 'Defending';
  return (
    <div className={styles.panel}>
      <div className={styles.helperBlock}>
        <span className={styles.helperLine1}>Dive at Feet?</span>
        <span className={styles.helperLine2}>{`${sideLabel} team is deciding whether to dive…`}</span>
      </div>
      {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
    </div>
  );
}
```

Mirror exactly; swap copy to something like `Tackle/Steal?` / `${sideLabel} team is deciding whether to challenge…` (D-05: copy is discretion, tone/structure must match).

**Deciding-team two-button prompt** (lines 106-122):

```typescript
return (
  <div className={styles.panel}>
    <div className={styles.helperBlock}>
      <span className={styles.helperLine1}>Dive at Feet?</span>
      <span className={styles.helperLine2}>{`${carrierName} is within range — dive to win the ball back?${distanceQualifier}`}</span>
    </div>
    <button className={styles.ctaButton} onClick={() => emitGkDiveAtFeet(true)}>
      Dive
    </button>
    <button className={styles.ctaButton} onClick={() => emitGkDiveAtFeet(false)}>
      Decline
    </button>
    {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
  </div>
);
```

For the new panel: `emitTackleStealChoice(true)` / `emitTackleStealChoice(false)`, buttons labeled e.g. `Attempt` / `Decline`, helper text naming the defender and carrier (e.g. `${defenderName} can challenge ${carrierName} for the ball — attempt the tackle?`). No `distanceQualifier` equivalent is required unless the planner wants to surface something duel-specific.

**Error handling pattern:** `restartErrorMessage(gameError)` from `useGameStore`, rendered conditionally as `{humanisedError && <span className={styles.errorText}>{humanisedError}</span>}` — identical, no changes needed.

---

### `packages/client/src/components/TackleStealPromptPanel.module.css` (styles)

**Analog:** `packages/client/src/components/GkDiveAtFeetPromptPanel.module.css` (full file, 73 lines) — itself a verbatim copy of `FoulChoicePanel.module.css` per its own header comment ("one-module-per-component convention").

**Full pattern to copy verbatim** (class names: `.panel`, `.helperBlock`, `.helperLine1`, `.helperLine2`, `.ctaButton`, `.ctaButton:hover`, `.errorText`):

```css
.panel {
  background: var(--color-bg-surface);
  border-radius: 4px;
  padding: 4px 8px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}
.helperBlock,
.errorText {
  flex: 0 0 100%;
}
.helperBlock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.helperLine1 {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.03em;
  color: var(--color-text-primary);
  text-align: center;
}
.helperLine2 {
  font-size: 11px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--color-text-secondary);
  text-align: center;
}
.ctaButton {
  flex: 1 1 calc(50% - 4px);
  max-width: 160px;
  min-width: 0;
  background: var(--color-bg-surface-alt);
  color: var(--color-text-inverse);
  border: 1px solid var(--color-border-muted);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.ctaButton:hover {
  background: var(--team-accent);
}
.errorText {
  color: var(--color-danger);
  font-size: 11px;
  font-weight: 400;
}
```

Copy this file byte-for-byte, only updating the header comment to name `TackleStealPromptPanel` instead of `GkDiveAtFeetPromptPanel`. Do NOT invent new spacing/colors — project convention explicitly forbids the "legacy 3px/6px micro-scale."

---

### `packages/shared/src/types.ts` (GamePhase / ActionEventType / GameState fields)

**Analog:** Same file's existing `GK_DIVE_AT_FEET_PROMPT`/`GK_DIVE_AT_FEET_DECLINED`/`gkDiveAtFeetResume` region.

**ActionEventType union entry pattern** (lines 241-242):

```typescript
| 'GK_DIVE_AT_FEET' // GKDIVE-01..05: GK-dive-at-feet duel resolution
| 'GK_DIVE_AT_FEET_DECLINED' // GKDIVE-02/D-07: GK's team declined the dive-at-feet offer
```

Add analogous entries, e.g. `'TACKLE_STEAL_PROMPT_DECLINED'` (name is discretion), with a comment citing TACKLE-02/D-03.

**ActionEvent payload shape for the decline event** (lines 771-777):

```typescript
| {
    /** GKDIVE-02/D-07: GK's team declined the dive-at-feet offer. */
    type: 'GK_DIVE_AT_FEET_DECLINED';
    gkId: string;
    carrierId: string;
    timestamp: number;
  }
```

Mirror shape: `{ type: 'TACKLE_STEAL_PROMPT_DECLINED'; defenderId: string; carrierId: string; timestamp: number }`. No `ballAfter` field — declines never carry ball movement, matching this exact analog's omission (see REPLAY_ELIGIBLE_TYPES section below).

**Resume-snapshot field trio** (referenced in RESEARCH.md Pattern 1, source `types.ts:1723-1727`):

```typescript
gkDiveAtFeetResume?: {
  phase: GamePhase;
  activeTeam: 'home' | 'away';
  movementSlot: MovementSlot | null;
} | null;
```

New fields (per RESEARCH.md Pattern 1, Claude's discretion for exact names): `tackleStealPromptTeam`, `tackleStealPromptKind`, `tackleStealPromptDefenderId`, `tackleStealPromptCarrierId`, `tackleStealPromptQueue: readonly string[]`, `tackleStealPromptResume: { phase; activeTeam; movementSlot } | null`. Mirror the exact 3-field resume shape — do not invent a 4th field.

**Sibling-field-not-overload precedent** (`subsUsed`/`addedTimeBonus`, `types.ts:1729-1744`): cited directly by CONTEXT.md/RESEARCH.md as the pattern to follow for any new tracking field — add a new named field, never repurpose `stealAttemptedByIds`/`tackleAttemptedByIds`.

---

### `packages/shared/src/moveValidator.ts` (sort defenders by tackling desc, D-02)

**Analog:** Same file's existing `isActivePiece`-filtered opponent/defenders construction.

**Current pattern** (lines ~100-111):

```typescript
if (state.ball.carrierId === piece.id) {
  const opponents = state.pieces.filter((p) => p.teamId !== piece.teamId && isActivePiece(p));
  const allDefenders = getZoIDefenders(to, opponents);
  const defenders = allDefenders.filter((d) => !(state.stealAttemptedByIds ?? []).includes(d.id));
  if (defenders.length > 0) {
    return { ok: true, effect: { type: 'STEAL_ATTEMPT', defenders } };
  }
}
```

Per RESEARCH.md Pattern 2, this is where a `.sort((a, b) => b.tackling - a.tackling)` on `defenders` (or on the consuming side in `gameEngine.ts`) belongs — RESEARCH.md's proposed snippet:

```typescript
const orderedDefenders = [...result.effect.defenders].sort((a, b) => b.tackling - a.tackling);
const [firstDefender, ...restDefenders] = orderedDefenders;
```

**Do not** add a second `isActivePiece` filter here — the `opponents` list is already filtered (Phase 42 fix, commit `613a1317`); re-filtering is redundant per RESEARCH.md's explicit Anti-Pattern note.

---

### `packages/server/src/gameEngine.ts` — `applyMove` new toggle branch + `applyTackleStealChoice` (service, event-driven)

**Analog:** `applyGkDiveAtFeetResponse` (lines 1957-2005+), the exact decline/resume-clear/event-append shape to mirror for the new choice-handling function.

**Decline branch pattern** (lines 1980-2004):

```typescript
if (!accept) {
  const clearedFields = {
    gkDiveAtFeetTeam: null,
    gkDiveAtFeetGkId: null,
    gkDiveAtFeetCarrierId: null,
    gkDiveAtFeetDistance: null,
    gkDiveAtFeetResume: null,
  };
  const declineEvent: ActionEvent = {
    type: 'GK_DIVE_AT_FEET_DECLINED',
    gkId,
    carrierId,
    timestamp: Date.now(),
  };
  return {
    ok: true,
    state: {
      ...state,
      ...clearedFields,
      phase: resume?.phase ?? state.phase,
      activeTeam: resume?.activeTeam ?? state.activeTeam,
      movementSlot: resume?.movementSlot ?? state.movementSlot,
      eventLog: [...state.eventLog, declineEvent],
    },
  };
}
```

For `applyTackleStealChoice`, the decline branch is identical in shape, but per D-03 it must NOT always resume — it must check the queue: if `tackleStealPromptQueue` is non-empty, dequeue the next defender and re-enter `TACKLE_STEAL_PROMPT` with the new current defender (do not clear `phase`/resume yet); only resume from the snapshot when the queue is exhausted. This is new branching logic layered on top of the mirrored decline-event/field-clear shape — see RESEARCH.md's "New GamePhase & Interception Point" section and Pitfall 4 for the foul-interaction nuance.

**Phase guard at function top** (line 1961-1963):

```typescript
if (state.phase !== 'GK_DIVE_AT_FEET_PROMPT') {
  return { ok: false, reason: 'WRONG_PHASE' };
}
```

Mirror with `if (state.phase !== 'TACKLE_STEAL_PROMPT') { return { ok: false, reason: 'WRONG_PHASE' }; }`.

**Toggle-check insertion point (new logic, not an existing analog to copy verbatim):** Per RESEARCH.md Pitfall 3, insert the `state.tackleStealDeclineEnabled === true` check as the FIRST statement inside each of `applyMove`'s `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` effect branches (`gameEngine.ts:1245`, `:1309`), before any dice-die extraction — this guarantees the toggle-off path (TACKLE-04) stays byte-for-byte identical to today.

---

### `packages/server/src/gameEngine.ts` — `applyUndo`'s `isBoundary` disjunction (CRUD/classification)

**Analog:** Lines 3473-3530, specifically the `GK_DIVE_AT_FEET`/`GK_DIVE_AT_FEET_DECLINED` treatment.

```typescript
// GKDIVE-01 (Phase 39, 39-12): a resolved GK_DIVE_AT_FEET duel is a committed dice
// outcome — unconditional boundary, exactly like TACKLE_ATTEMPT/STEAL_ATTEMPT above.
evt.type === 'GK_DIVE_AT_FEET' ||
```

Note `GK_DIVE_AT_FEET_DECLINED` is conspicuously ABSENT from this disjunction — declines are never boundaries. Per RESEARCH.md Pitfall 6 / CONTEXT.md discretion: the new decline event (`TACKLE_STEAL_PROMPT_DECLINED` or similar) must likewise be OMITTED from `isBoundary` — do not add a term for it. (A resolved attempt still routes through the existing unconditional `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` boundary terms already present at lines 3476-3477, so no new boundary term is needed for the attempt-success/fail path either.)

---

### `packages/server/src/gameEngine.ts` — `REPLAY_ELIGIBLE_TYPES` (CRUD/set membership)

**Analog:** Lines 9920-9932.

```typescript
// GKDIVE-01..05 (Phase 39, 39-12): GK_DIVE_AT_FEET carries ballAfter on both SUCCESS
// and FAIL. GK_DIVE_AT_FEET_DECLINED is deliberately excluded — it carries no
// ballAfter, matching the FOUL_CHOICE_MADE exclusion immediately above.
'GK_DIVE_AT_FEET',
```

The new decline event must be excluded the same way (it carries no `ballAfter`). Add a comment explicitly stating the exclusion is deliberate, mirroring this file's own "a future reader must not add them here" convention (line 9928).

---

### `packages/server/src/gameHandlers.ts` — new `GAME_TACKLE_STEAL_CHOICE` handler (route, request-response)

**Analog:** `GAME_GK_DIVE_AT_FEET` handler (lines 3172-3221).

```typescript
socket.on(ClientEvents.GAME_GK_DIVE_AT_FEET, (accept: boolean) => {
  const { roomCode } = socket.data;
  if (roomCode === undefined) return;
  const room = getRoom(roomCode);
  if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

  room.isProcessing = true;
  try {
    // 1. Null-state guard
    if (room.gameState === null) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    // 2. Phase guard
    if (room.gameState.phase !== 'GK_DIVE_AT_FEET_PROMPT') {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
      broadcastState(io, room);
      return;
    }
    // 3. Payload validation (ASVS V5)
    if (typeof accept !== 'boolean') {
      socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
      broadcastState(io, room);
      return;
    }
    // 4. Team guard: only the goalkeeper's manager may respond
    if (socketTeam(socket) !== room.gameState.gkDiveAtFeetTeam) {
      socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
      broadcastState(io, room);
      return;
    }
    // 5. Engine call
    const result = applyGkDiveAtFeetResponse(room.gameState, accept);
    if (!result.ok) {
      socket.emit(ServerEvents.GAME_ERROR, result.reason);
      broadcastState(io, room); // snap-back
      return;
    }
    room.gameState = result.state;
    broadcastState(io, room); // ARCH-04
    if (result.state.phase === 'FULL_TIME') {
      startReplayStream(io, room);
    }
  } finally {
    room.isProcessing = false; // MUST be in finally — Pitfall 5
  }
});
```

Copy this 5-step guard shape verbatim for `GAME_TACKLE_STEAL_CHOICE`: null-state guard → phase guard (`!== 'TACKLE_STEAL_PROMPT'`) → payload validation (`typeof choice !== 'boolean'`, matching `emitGkDiveAtFeet`'s boolean-accept convention per RESEARCH.md's "New GamePhase" section) → team guard against `tackleStealPromptTeam` → engine call to `applyTackleStealChoice` → `isProcessing` reset in `finally`. Per Security Domain V4/threat table in RESEARCH.md, the team guard is the critical ASVS V4 control here.

---

### `packages/client/src/store/useGameStore.ts` — new `emitTackleStealChoice` (store, event-driven)

**Analog:** `emitGkDiveAtFeet` (lines 1849-1852).

```typescript
// GKDIVE-02 (D-07): fire-and-forget, no optimistic state mutation.
emitGkDiveAtFeet: (accept) => {
  socket.emit(ClientEvents.GAME_GK_DIVE_AT_FEET, accept);
},
```

Mirror exactly: `emitTackleStealChoice: (accept) => { socket.emit(ClientEvents.GAME_TACKLE_STEAL_CHOICE, accept); }` — no optimistic mutation, matching every other two-button prompt emit in this codebase (`emitFoulChoice`, `emitGkBoxEntryResponse`). Also add the type signature to the store interface (mirrors `emitGkDiveAtFeet: (accept: boolean) => void;` at line 203).

---

### `packages/client/src/components/GameBoard.tsx` — PHASE_LABEL + panel routing

**Analog:** Line 81 (`PHASE_LABEL` entry) and line 476 (panel routing ternary).

```typescript
GK_DIVE_AT_FEET_PROMPT: 'DIVE AT FEET',
```

Add `TACKLE_STEAL_PROMPT: 'TACKLE / STEAL',` (or similar) to the `Record<GamePhase, string>` — TypeScript's exhaustiveness check on this `Record` type means omitting it is a compile error (RESEARCH.md Pitfall 5), so this is a mechanical/mandatory addition, not optional.

```typescript
) : phase === 'GK_DIVE_AT_FEET_PROMPT' || phase === 'GK_DIVE_AT_FEET_TARGET' ? (
```

Add a sibling ternary branch: `phase === 'TACKLE_STEAL_PROMPT' ? (<TackleStealPromptPanel />) :`. Since the new phase has no `_TARGET` sub-phase equivalent, the condition is a single phase check, not an `||` pair.

---

### `packages/client/src/components/ActionLog.tsx` — `formatEvent` decline case

**Analog:** `GK_DIVE_AT_FEET_DECLINED` case (lines 1157-1168).

```typescript
case 'GK_DIVE_AT_FEET_DECLINED':
  return {
    prefix: '[DIVE AT FEET]',
    prefixColor: pieceColorOf(event.gkId),
    content: (
      <>
        {' '}
        <PNamed pieceId={event.gkId} /> declined to dive
      </>
    ),
    isGoal: false,
  };
```

Mirror shape for the new decline event, e.g.:

```typescript
case 'TACKLE_STEAL_PROMPT_DECLINED':
  return {
    prefix: '[TACKLE/STEAL]',
    prefixColor: pieceColorOf(event.defenderId),
    content: (
      <>
        {' '}
        <PNamed pieceId={event.defenderId} /> declined to challenge
      </>
    ),
    isGoal: false,
  };
```

Per RESEARCH.md/CONTEXT.md, declines ARE logged to both managers — this is established precedent, not a new decision to make.

---

### `packages/client/src/components/GameSettingsScreen.tsx` — new `tackleStealDecline` toggle

**Analog:** `outOfBounds` toggle — full three-part pattern (state, payload field, checkbox JSX).

**useState declaration** (line 56):

```typescript
// GOALKICK-06 / OOB-05 (Phase 37): D-14 (Phase 39) explicitly flips this to default ON,
// superseding the prior "safe default" comment. The SERVER-side default in
// buildInitialGameState deliberately stays `false` — this is a client-only UX default.
const [outOfBounds, setOutOfBounds] = useState<boolean>(true);
```

New: `const [tackleStealDecline, setTackleStealDecline] = useState<boolean>(true);` (TACKLE-01: default on client-side per D-01/toggle requirement).

**onConfirm prop type field** (lines 26-27):

```typescript
/** OOB-05/GOALKICK-06 (Phase 37): out-of-bounds detection + restart set toggle. */
outOfBounds: boolean;
```

New: add `tackleStealDecline: boolean;` with a comment citing TACKLE-01.

**handleConfirm payload** (line 110):

```typescript
onConfirm({
  speed,
  teamType,
  draftPools: teamType === 'draft' ? draftPools : [],
  outOfBounds,
  fouls,
  booking: fouls && booking,
  injury: fouls && injury,
});
```

Add `tackleStealDecline,` to this object — no normalization needed (unlike booking/injury, this toggle has no parent-toggle dependency).

**Checkbox JSX** (lines 186-193):

```typescript
<label className={styles.poolRow}>
  <input
    type="checkbox"
    checked={outOfBounds}
    onChange={() => setOutOfBounds((v) => !v)}
  />
  Out-of-Bounds / Restarts
</label>
```

Add a sibling `<label>` block with `checked={tackleStealDecline}` / `onChange={() => setTackleStealDecline((v) => !v)}` and label text (e.g. "Tackle/Steal Decline Prompt").

---

### `packages/server/src/gameEngine.ts` — `buildInitialGameState` new param

**Analog:** `outOfBoundsEnabled: boolean = false` parameter (RESEARCH.md-cited, `gameEngine.ts:373-377`).

```typescript
/**
 * at match start from Room.outOfBoundsEnabled. Defaults to `false` — the disabled path
 */
outOfBoundsEnabled: boolean = false,
```

Add `tackleStealDeclineEnabled: boolean = false` as a new parameter, mirroring the exact client-default-on/server-default-off split (client `useState<boolean>(true)` above / server param `= false`) so any code path constructing `GameState` without the new param preserves today's toggle-off behavior. RESEARCH.md flags (Assumption A2) that the exact Room→`buildInitialGameState` middle-layer call site needs a fresh grep (`outOfBoundsEnabled` across `packages/server/src`) at implementation time — not independently re-traced in this pattern map.

---

## Shared Patterns

### Two-button interrupt-prompt phase (deciding-team + waiting-manager + resume snapshot)

**Source:** `GkDiveAtFeetPromptPanel.tsx` (client) + `applyGkDiveAtFeetResponse` (`gameEngine.ts:1957+`, server) + `gkDiveAtFeetResume` field trio (`types.ts:1723-1727`)
**Apply to:** `TackleStealPromptPanel.tsx`, `applyTackleStealChoice`, and the new `tackleStealPromptResume` field — this is the single dominant pattern for the whole phase, shipped 3 times already (`FoulChoicePanel`, `GkDiveAtFeetPromptPanel`, `GkBoxEntryPromptPanel`).

### New-ActionEventType/new-GamePhase registration checklist

**Sources (must all be touched together, per RESEARCH.md Pitfall 6):**

- `ActionEventType` union + payload shape — `types.ts:242, 771-777`
- `formatEvent` case — `ActionLog.tsx:1157-1168`
- `REPLAY_ELIGIBLE_TYPES` — deliberately EXCLUDE the decline event, `gameEngine.ts:9920-9932`
- `applyUndo`'s `isBoundary` disjunction — deliberately EXCLUDE the decline event, `gameEngine.ts:3473-3530`
- `PHASE_LABEL` record — MUST include the new phase (compile-time enforced), `GameBoard.tsx:81`
- `STOPPAGE_PHASES` — deliberately DO NOT add `TACKLE_STEAL_PROMPT` (mid-duel decision prompt, not a stoppage), `stoppagePhases.ts:27-56`
  **Apply to:** every file in the "New GamePhase & Interception Point" work — this checklist is the project's own documented defense against the BUG-30/31/37 bug class (an ActionEventType/GamePhase added but only partially registered).

### Toggle wiring (client default-on / server default-off split)

**Source:** `outOfBoundsEnabled` — `GameSettingsScreen.tsx:56` (client `useState<boolean>(true)`) + `gameEngine.ts` `buildInitialGameState` param (`= false`)
**Apply to:** `tackleStealDecline` (client) / `tackleStealDeclineEnabled` (server param) — TACKLE-01 explicitly requires this exact split.

### Fire-and-forget emit, no optimistic mutation

**Source:** `emitGkDiveAtFeet`/`emitFoulChoice`/`emitGkBoxEntryResponse` — `useGameStore.ts:1845-1866`
**Apply to:** `emitTackleStealChoice` — every two-button prompt in this codebase follows this exact non-optimistic shape (the authoritative `GAME_STATE` broadcast is the only writer).

### Socket handler 5-step guard shape

**Source:** `GAME_GK_DIVE_AT_FEET` — `gameHandlers.ts:3172-3221`
**Apply to:** `GAME_TACKLE_STEAL_CHOICE` — null-state guard → phase guard → payload validation (ASVS V5) → team guard (ASVS V4) → engine call + `isProcessing` reset in `finally` (Pitfall 5).

## No Analog Found

None — every file in this phase has an exact, explicitly-cited analog (either named directly in CONTEXT.md D-05, or the established registration-checklist precedent from `GK_DIVE_AT_FEET_PROMPT`/`GK_DIVE_AT_FEET_DECLINED`).

The one piece of genuinely new logic with no direct precedent to copy is the **sequential multi-defender queue** (D-01/D-02/D-03) — `gameEngine.ts:1248` today hardcodes `result.effect.defenders[0]`, so there is no existing multi-defender resolution loop to extend (RESEARCH.md Pitfall 1). This must be designed fresh using the sort-and-queue shape sketched in RESEARCH.md Pattern 2, not copied from an analog. Budget it as new logic in planning, not a "mirror existing code" task.

## Metadata

**Analog search scope:** `packages/client/src/components/`, `packages/client/src/store/`, `packages/shared/src/`, `packages/server/src/` (gameEngine.ts, gameHandlers.ts)
**Files scanned:** GkDiveAtFeetPromptPanel.tsx, GkDiveAtFeetPromptPanel.module.css, types.ts (GamePhase/ActionEventType/GameState regions), moveValidator.ts, stoppagePhases.ts, gameEngine.ts (applyMove, applyGkDiveAtFeetResponse, applyUndo isBoundary, REPLAY_ELIGIBLE_TYPES, buildInitialGameState), gameHandlers.ts (GAME_GK_DIVE_AT_FEET handler), useGameStore.ts (emitGkDiveAtFeet), GameBoard.tsx (PHASE_LABEL, panel routing), ActionLog.tsx (formatEvent), GameSettingsScreen.tsx (outOfBounds toggle)
**Pattern extraction date:** 2026-08-23
