# Phase 45: Game Summary Popup - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 9 (new + modified)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `packages/shared/src/matchStats.ts` (NEW) | utility | transform | `packages/shared/src/pitch.ts` | role-match |
| `packages/shared/src/types.ts` (EXTEND — `GameState.matchStats`, `refereeCard.wasManualOverride`, `xg?` event field) | model | CRUD (state shape) | `subsUsed?: { home: number; away: number }` field (same file, line 1834) | exact |
| `packages/server/src/gameEngine.ts` (EXTEND — inline xG capture at ~7 shot-resolution sites) | service | event-driven | `case 'SHOT':` block itself (lines 5043-5372) | exact (self-referential — instrument in place) |
| `packages/server/src/gameHandlers.ts` (EXTEND — 2 duplicate `SHOT_ATTEMPT`/`DEFLECT_ATTEMPT` GK-out-of-range sites) | controller/service | event-driven | Same file's existing `SHOT_ATTEMPT` construction sites (lines 1400, 2483) | exact |
| `packages/server/src/roomStore.ts` (EXTEND — `broadcastState()` gains new-event-diff reducer) | service | event-driven / batch (diff) | `broadcastState`'s existing `lastBroadcastBallPosition` edge-trigger pattern (lines 436-520) | exact |
| `packages/client/src/components/GameBoard.tsx` (EXTEND — (i) icon row, modal state, HALF_TIME/FULL_TIME insertion) | component | request-response (client reads broadcast state) | Same file's `subOpen`/`SubstitutionButton` modal-open pattern (lines 338, 610-655) | exact |
| `packages/client/src/components/MatchSummaryModal.tsx` (NEW) | component | request-response | Substitution overlay markup (`GameBoard.tsx` lines 610-649, `.substitutionOverlay`/`.substitutionModalCard`) | role-match |
| `packages/client/src/components/MatchSummaryContent.tsx` (NEW) | component | request-response | `GameBoard.tsx`'s HALF_TIME/FULL_TIME overlay card body (lines 519-602) + `.statChip`/`.statBubble` stat-rendering pattern (lines 380-401) | role-match |
| `packages/client/src/components/MatchSummaryContent.module.css` / `MatchSummaryModal.module.css` (NEW) | config (styles) | — | `GameBoard.module.css` `.overlay`/`.overlayCard`/`.overlayCtaButton` block (lines 381-485) | exact |

## Pattern Assignments

### `packages/shared/src/matchStats.ts` (utility, transform)

**Analog:** `packages/shared/src/pitch.ts`

**Module-level constants + region-lookup pattern** (`pitch.ts` lines 1-40, 78-93):
```typescript
import type { HexCoord } from './types.js';
import { hexesInRange } from './hex.js';

const hexKey = (h: HexCoord): string => `${h.q},${h.r}`;
const buildRegion = (hexes: HexCoord[]): ReadonlySet<string> => new Set(hexes.map(hexKey));

export const PITCH_REGIONS: PitchRegions = {
  homeSixYardBox: buildRegion(PITCH_HEXES.filter((h) => h.q <= 1 && h.r >= 8 && h.r <= 17)),
  awaySixYardBox: buildRegion(PITCH_HEXES.filter((h) => h.q >= 35 && h.r >= 8 && h.r <= 17)),
  homePenaltyArea: buildRegion(PITCH_HEXES.filter((h) => h.q <= 5 && h.r >= 5 && h.r <= 19)),
  awayPenaltyArea: buildRegion(PITCH_HEXES.filter((h) => h.q >= 31 && h.r >= 5 && h.r <= 19)),
  // ...
};

export function isInRegion(hex: HexCoord, region: keyof Omit<PitchRegions, 'kickOffHex'>): boolean {
  return PITCH_REGIONS[region].has(hexKey(hex));
}
```

**Apply to `matchStats.ts`:** export a pure `computeShotXg(shotHex, attackingTeam, defendingPieces)` function (RESEARCH.md's `computeShotXg` sketch is the exact shape to use — reuses `isInRegion`/`PITCH_REGIONS` from `pitch.ts`, does not re-derive hex-membership). Follow `pitch.ts`'s style: named exported pure functions, no classes, JSDoc block above each function documenting the exact requirement ID (D-01/D-04) and formula, mirroring `pitch.ts`'s own doc-comment convention (see its module doc lines 1-22 citing plan/decision IDs).

**Error handling:** N/A — pure math function, no I/O, no throw paths (matches `pitch.ts`/`isInRegion` — total functions over well-typed inputs).

**Testing pattern:** Co-located `matchStats.test.ts` in `packages/shared/src/`, mirrors any existing `pitch.test.ts`-style unit test in that package (Vitest, `describe`/`it`, pure function calls with literal `HexCoord`/piece-array fixtures — no mocking needed since the module has zero external dependencies).

---

### `packages/shared/src/types.ts` (model, CRUD state shape)

**Analog:** `subsUsed?: { home: number; away: number }` (same file, line 1834) + its doc comment (lines 1829-1834).

**Pattern to copy verbatim** (whole-match, never-reset-at-half-time counter shape):
```typescript
/**
 * SUB-04 (Phase 40): whole-match substitution count per team. NEVER reset at half-time
 * — independent of `addedTimeBonus` below, which IS per-half. Optional so no existing
 * `GameState` construction site breaks; every read site uses `?? 0` defaults.
 */
subsUsed?: { home: number; away: number };
```

**Apply to this phase's new fields** — add a single `matchStats` object field (not one field per stat) to `GameState`, e.g.:
```typescript
matchStats?: {
  possessionActionCount: { home: number; away: number }; // raw actionCount ticks, % computed client-side
  passesCompleted: { home: number; away: number };
  tackleStealAttempts: { home: number; away: number };
  tackleStealSuccesses: { home: number; away: number };
  shots: { home: number; away: number };
  xg: { home: number; away: number };
  fouls: { home: number; away: number };
  yellowCards: { home: number; away: number };
  redCards: { home: number; away: number };
};
```
Every field: optional, `{ home, away }` shape, `?? 0` at every read site, doc comment referencing STATS-04..09 and explicitly stating "never reset at half-time" (copy `subsUsed`'s comment wording pattern). Also add `refereeCard.wasManualOverride?: boolean` (or a sibling `GameState`-level field) per RESEARCH.md Pitfall 3, set once in `buildInitialGameState`.

**New `ActionEvent` field** — add optional `xg?: number` to whichever shot-resolution event variants need it (`SHOT_ATTEMPT`, `PENALTY_KICK`, `DEFLECT_ATTEMPT`), following the same "optional field, doc-commented, never breaks existing construction sites" convention already used throughout the `ActionEvent` union (see `subsUsed` field on the `SUBSTITUTION` event variant at line ~862 for the identical in-event-field precedent).

---

### `packages/server/src/gameEngine.ts` (service, event-driven — inline xG capture)

**Analog:** the existing `case 'SHOT':` block itself, lines 5043-5372 (self-instrumentation, not a separate analog file).

**Core pattern — compute BEFORE any pieces-reset return** (verified read, lines 5043-5143):
```typescript
case 'SHOT': {
  const shooter = state.pieces.find((p) => p.id === state.ball.carrierId);
  if (!shooter) return { ok: false, reason: 'WRONG_PHASE' };
  const opposingTeam = state.attackingTeam === 'home' ? 'away' : 'home';
  const gk = state.pieces.find((p) => p.teamId === opposingTeam && p.role === 'GK');
  if (!gk) return { ok: false, reason: 'WRONG_PHASE' };
  // ... dice pre-generated upfront (shooterDice/gkDice/handlingDice) ...

  // SHOT-04 unsaveable: GK ≥4 hexes — automatic GOAL (no duel).
  if (!diveResult.saveable) {
    const scoringTeam = state.attackingTeam;
    // D-01 (BUG-30): resetPieces computed HERE, in the same branch that builds the event —
    // this is the exact spot where `state.pieces` (pre-reset) must be read for xG's D/C inputs,
    // BEFORE `resetPieces` is assigned into the returned state.
    const resetPieces = applyRosterContinuity(
      buildKickOffPieces(newKickOffTeam, state.selectedTeams, state.selectedFormation),
      state.pieces,
    );
    const shotAttemptGoal: ActionEvent = {
      type: 'SHOT_ATTEMPT',
      shooterId: shooter.id,
      gkId: gk.id,
      targetHex: shotTarget,
      outcome: 'GOAL',
      // ... existing fields ...
      // NEW: xg: computeShotXg(shotTarget, state.attackingTeam, state.pieces.filter(...)),
    };
    return { ok: true, state: { ...state, pieces: resetPieces, /* ... */ eventLog: [...state.eventLog, shotAttemptGoal, { type: 'GOAL' as const, /* ... */ }] } };
  }
  // ... duel-resolved GOAL/SAVE/LOOSE_BALL branches follow — instrument each similarly ...
}
```

**Instrumentation site list (verified via grep, not the 5-category conceptual list):**
- `gameEngine.ts:5097, 5193, 5244, 5290` — 4 `SHOT_ATTEMPT` construction sites inside `applyRoll`'s `case 'SHOT'` (unsaveable-auto-goal + duel-resolved GOAL/SAVE/LOOSE_BALL sub-branches)
- `gameEngine.ts:8351, 8400, 8437` — 3 `PENALTY_KICK` construction sites inside `applyPenaltyKickDuel`
- `gameHandlers.ts:1337, 2421` — 2 `DEFLECT_ATTEMPT` sites (snapshot/deflection)
- `gameHandlers.ts:1400, 2483, 4030` — 3 more `SHOT_ATTEMPT` sites, including the GK-out-of-range-at-declare-time branches (Pitfall 1)

**Error handling:** No new error paths — `computeShotXg` is a pure total function; if `shooter`/`gk` lookups already returned `{ ok: false, reason: 'WRONG_PHASE' }` earlier in the branch (existing guard pattern, line 5045/5050), xG computation is simply skipped along with the rest of the branch.

**Critical constraint (Pitfall 2):** xG MUST be computed using `state.pieces` (or a captured local var) BEFORE the `resetPieces`/kickoff-formation overwrite in the same return statement — never deferred to `broadcastState` or any later diff.

---

### `packages/server/src/roomStore.ts` (service, event-driven/batch diff — centralized counters)

**Analog:** `broadcastState`'s existing `lastBroadcastBallPosition` edge-trigger pattern (lines 436-520, verified read).

**Room-level tracking field pattern** (line 225):
```typescript
lastBroadcastBallPosition?: HexCoord | null;
```
**Apply:** add `lastBroadcastEventLogLength?: number` and `lastBroadcastActionCount?: number` alongside it in the `Room` type.

**Core diff-and-fold pattern** (mirrors lines 436-519 structure):
```typescript
export function broadcastState(io: Server, room: Room): void {
  if (room.gameState === null) return;
  room.gameState = applyFreeMoveZoneCheck(room.gameState);

  const state = room.gameState;
  const prevBallPosition = room.lastBroadcastBallPosition ?? state.ball.position;
  // NEW: same "prev ?? current" fallback idiom for the new counters
  const prevEventLogLength = room.lastBroadcastEventLogLength ?? state.eventLog.length;
  const prevActionCount = room.lastBroadcastActionCount ?? state.actionCount;
  const prevAttackingTeam = /* captured from the PRE-mutation state, per Pitfall 5 */;

  // ... existing box-entry / GK-dive-at-feet offer logic unchanged ...

  const newEvents = state.eventLog.slice(prevEventLogLength);
  if (newEvents.length > 0) {
    room.gameState = foldMatchStats(room.gameState, newEvents, prevAttackingTeam, state.actionCount - prevActionCount);
  }

  if (room.gameState.phase !== 'TACKLE_STEAL_PROMPT') {
    room.lastBroadcastBallPosition = room.gameState.ball.position;
  }
  room.lastBroadcastEventLogLength = room.gameState.eventLog.length;
  room.lastBroadcastActionCount = room.gameState.actionCount;
  io.to(room.roomCode).emit(ServerEvents.GAME_STATE, room.gameState);
}
```

**Error handling:** matches existing `broadcastState` style — no try/catch; guards are structural (`if (room.gameState === null) return;`, `if (newEvents.length > 0)`), not exception-based.

**Reducer function location:** put `foldMatchStats` in `packages/server/src/` (new file, e.g. `matchStatsReducer.ts`, or co-located in `roomStore.ts` if small) — a pure function `(state, newEvents, prevAttackingTeam, actionCountDelta) => GameState`, following the same "pure state-transform function returning a new object" convention used by `applyFreeMoveZoneCheck` (already imported/called at line 438) and `applyRosterContinuity` (gameEngine.ts).

---

### `packages/client/src/components/GameBoard.tsx` (component, request-response)

**Analog:** the file's own existing `subOpen` modal-state + `SubstitutionButton` pattern (lines 338, 610-655, verified read).

**Imports pattern** (existing store selectors, lines 330-336):
```typescript
const bench = useGameStore((s) => s.gameState.bench);
const subsUsed = useGameStore((s) => s.gameState.subsUsed);
// NEW: const matchStats = useGameStore((s) => s.gameState.matchStats);
const [subOpen, setSubOpen] = useState(false);
// NEW: const [matchSummaryOpen, setMatchSummaryOpen] = useState(false);
```

**(i) icon placement — new row above `.clockRow`** (D-08), inside `.scoreboardCentreCell` (lines 417-443):
```tsx
<div className={styles.scoreboardCentreCell}>
  {/* NEW: icon row, sibling ABOVE clockRow, not positioned into empty space */}
  <div className={styles.matchSummaryIconRow}>
    <button
      className={styles.matchSummaryIconButton}
      title="View match summary"
      onClick={() => setMatchSummaryOpen(true)}
    >
      i
    </button>
  </div>
  <div className={styles.clockRow}>
    {/* ... existing badges/clock unchanged ... */}
  </div>
  <div className={styles.phaseSummary}>{/* ... unchanged ... */}</div>
</div>
```

**HALF_TIME/FULL_TIME insertion (D-10/D-11)** — analog is the existing overlay card body itself (lines 519-573, 575-602): append `<MatchSummaryContent />` directly after the existing score-row header `<div className={styles.halfTimeScoreRow}>...</div>` and BEFORE the existing proceed/confirm controls (`myConfirmed ? ... : <button>Start 2nd Half</button>` at 558-570; the `Replay starting…` body at 599), inside the same `.overlayCard`. Do not touch the header markup.

**Modal open/close state pattern to copy exactly** (mirrors `subOpen`/`SubstitutionButton`, lines 338, 610-655):
```tsx
{matchSummaryOpen && (
  <MatchSummaryModal onClose={() => setMatchSummaryOpen(false)} />
)}
```
Place this render block adjacent to the existing `{subOpen && myTeam !== null && (...)}` block (line 610) inside `.pitchContainer`.

**Error handling:** none needed — pure client-side UI state (`useState`), no network round-trip for open/close, matching `subOpen`'s pattern exactly (no server event for opening the substitution panel either).

---

### `packages/client/src/components/MatchSummaryModal.tsx` (NEW component, request-response)

**Analog:** the substitution overlay markup in `GameBoard.tsx` (lines 610-649) — `.substitutionOverlay`/`.substitutionModalCard` structure — for open/close chrome; per 45-UI-SPEC.md, styled instead directly on `.overlay`/`.overlayCard` (see CSS excerpt below) rather than the substitution modal's full-screen treatment.

**Structural pattern to copy** (backdrop + card + content + dismiss, generalized from lines 610-649):
```tsx
{open && (
  <div className={styles.matchSummaryOverlay}>
    <div className={styles.matchSummaryCard}>
      <div className={styles.header}>
        <span className={styles.title}>MATCH SUMMARY</span>
        <button aria-label="Close match summary" onClick={onClose}>×</button>
      </div>
      <div className={styles.scrollBody}>
        <MatchSummaryContent />
      </div>
      <button className={styles.overlayCtaButton /* reuse verbatim from GameBoard.module.css */} onClick={onClose}>
        Close
      </button>
    </div>
  </div>
)}
```

**CSS pattern to copy verbatim** (`GameBoard.module.css` lines 381-402, 466-484 — `.overlay`/`.overlayCard`/`.overlayCtaButton`):
```css
.matchSummaryOverlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay-backdrop);
  z-index: 30; /* higher than .substitutionOverlay's z-index: 20, per UI-SPEC D-09 */
  display: flex;
  align-items: center;
  justify-content: center;
}

.matchSummaryCard {
  width: 100%;
  max-width: 760px;
  max-height: 85vh;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

---

### `packages/client/src/components/MatchSummaryContent.tsx` (NEW component, request-response)

**Analog:** `GameBoard.tsx`'s existing HALF_TIME overlay body (score row + settings display equivalent doesn't exist yet, but the "read multiple `GameState` fields via Zustand selectors and render conditionally" pattern is established throughout `GameBoard.tsx`, e.g. lines 330-336) + `.statChip`/`.statBubble` value-rendering pattern (`GameBoard.module.css` lines 190-233, verified read).

**Store-read pattern** (mirrors lines 330-334):
```tsx
const matchStats = useGameStore((s) => s.gameState.matchStats);
const foulsEnabled = useGameStore((s) => s.gameState.foulsEnabled);
const bookingEnabled = useGameStore((s) => s.gameState.bookingEnabled);
const injuryEnabled = useGameStore((s) => s.gameState.injuryEnabled);
const outOfBoundsEnabled = useGameStore((s) => s.gameState.outOfBoundsEnabled);
const tackleStealDeclineEnabled = useGameStore((s) => s.gameState.tackleStealDeclineEnabled);
const refereeCard = useGameStore((s) => s.gameState.refereeCard);
```
All toggle field names verified directly in `types.ts`: `foulsEnabled` (1690), `bookingEnabled` (1695), `injuryEnabled` (1700), `outOfBoundsEnabled` (1552), `tackleStealDeclineEnabled` (1560), `refereeCard` (1234). Every optional boolean read site must use `=== true` (never bare truthiness) per the existing codebase convention documented at each field's own doc comment (e.g. line ~1549 "must test `state.outOfBoundsEnabled === true`, never truthiness of a possibly-undefined field").

**Value-display pattern to copy** (mirrors `.statChip`/`.statBubble`, `GameBoard.module.css` 190-233):
```tsx
<div className={styles.statRow}>
  <span className={styles.statAbbr}>{label}</span>
  <span className={`${styles.statValue} ${styles.accentHome}`}>{homeValue}</span>
</div>
```
Reuse `.accentHome`/`.accentAway`/`.accentTeam` utility classes verbatim (`GameBoard.module.css` lines 107-117) for team-tinted numerals, per UI-SPEC's Color contract.

**All values pre-computed server-side** — component performs zero authoritative computation (percentages/ratios are pure display arithmetic per RESEARCH.md's Open Question 3 recommendation), consuming only raw counts already broadcast on `GameState.matchStats`.

---

## Shared Patterns

### Whole-match, never-reset-at-half-time counter shape
**Source:** `packages/shared/src/types.ts:1834` (`subsUsed`)
**Apply to:** every new `matchStats` field in `types.ts`, and the `foldMatchStats` reducer in `roomStore.ts`
```typescript
subsUsed?: { home: number; away: number };
// Every read site: state.subsUsed?.[team] ?? 0
// NEVER reset at half-time (contrast with addedTimeBonus, which IS reset per-half)
```

### Broadcast-choke-point edge-trigger diffing
**Source:** `packages/server/src/roomStore.ts:436-520` (`broadcastState`, `lastBroadcastBallPosition`)
**Apply to:** `roomStore.ts`'s new `foldMatchStats` call, `lastBroadcastEventLogLength`/`lastBroadcastActionCount` room fields
```typescript
const prevBallPosition = room.lastBroadcastBallPosition ?? state.ball.position;
// ... compute delta, conditionally mutate room.gameState ...
room.lastBroadcastBallPosition = room.gameState.ball.position;
```

### Hex-membership for goal-box/penalty-box (D/C xG inputs)
**Source:** `packages/shared/src/pitch.ts:78-93, 208-209` (`PITCH_REGIONS`, `isInRegion`)
**Apply to:** `matchStats.ts`'s `computeShotXg` — reuse verbatim, do not re-derive from `PitchMarkings.tsx`'s pixel geometry
```typescript
export function isInRegion(hex: HexCoord, region: keyof Omit<PitchRegions, 'kickOffHex'>): boolean {
  return PITCH_REGIONS[region].has(hexKey(hex));
}
```

### Excluding red-carded/benched pieces from defender/attempt counts
**Source:** `packages/shared/src/stoppagePhases.ts:107` (`isActivePiece`)
**Apply to:** `computeShotXg`'s defender filtering, and any pass/tackle attribution logic in `foldMatchStats`
```typescript
export function isActivePiece(piece: PlayerPiece): boolean {
  return piece.redCarded !== true && piece.onPitch !== false;
}
```

### Modal backdrop/card chrome
**Source:** `packages/client/src/components/GameBoard.module.css:381-484` (`.overlay`/`.overlayCard`/`.overlayCtaButton`) and `.substitutionOverlay`/`.substitutionModalCard` (referenced at `GameBoard.tsx:610-649`)
**Apply to:** `MatchSummaryModal.module.css`
```css
.overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--color-overlay-backdrop); z-index: 10; }
.overlayCard { width: 100%; max-width: 760px; background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: 4px; padding: 24px; display: flex; flex-direction: column; gap: 16px; }
```

### Optional-boolean toggle read convention
**Source:** `packages/shared/src/types.ts` doc comments at `outOfBoundsEnabled`/`tackleStealDeclineEnabled`/`foulsEnabled` (~lines 1549, 1557, 1688)
**Apply to:** `MatchSummaryContent.tsx`'s settings-recap rendering — always `=== true`, never bare truthiness, since fields are `boolean | undefined`.

## No Analog Found

None — every file in this phase's scope has a strong (exact or role-match) analog already verified by direct read.

## Metadata

**Analog search scope:** `packages/shared/src`, `packages/server/src`, `packages/client/src/components`
**Files scanned (direct read):** `types.ts` (subsUsed + toggle fields), `roomStore.ts` (broadcastState), `pitch.ts` (PITCH_REGIONS/isInRegion), `stoppagePhases.ts` (isActivePiece), `gameEngine.ts` (SHOT case), `GameBoard.tsx` (topBand/scoreboard, HALF_TIME/FULL_TIME overlays, substitution modal), `GameBoard.module.css` (scoreboardCentreCell/clockRow/statChip/statBubble/overlay/overlayCard/overlayCtaButton)
**Pattern extraction date:** 2026-08-28
