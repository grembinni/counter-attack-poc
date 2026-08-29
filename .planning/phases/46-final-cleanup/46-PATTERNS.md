# Phase 46: Final Cleanup - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 11 (all modified, no new files — this is a pure cleanup/audit phase)
**Analogs found:** 11 / 11 (every "analog" here is itself the sibling code already in the same file — this phase's whole nature is "make X match the pattern Y already uses in the same codebase," so RESEARCH.md's own findings ARE the pattern map; this file packages them for the planner with exact excerpts)

## File Classification

| Modified File | Role | Data Flow | Closest Analog (in-file sibling pattern) | Match Quality |
|----------------|------|-----------|-------------------------------------------|----------------|
| `packages/client/src/components/BallLocationRing.tsx` | component (render gate) | transform (Set-membership gate) | Existing `BALL_MARKER_PHASES` entries for `THROW_IN_SETUP`/`GOAL_KICK_SETUP_GK`/etc. (same file, lines 43-73) | exact |
| `packages/client/src/store/useGameStore.ts` (`setGameState` clearing branch) | store/reducer | event-driven (phase-transition dispatch) | Existing `responseMoveStateChanged`/`headerContestantIds` phaseChanged-guard pattern (same file, lines 1432-1456) | exact |
| `packages/client/src/components/ActionPanel.tsx` (`FREE_MOVE_ATTACK`/`DEFENSE` branch, line 728) | component (panel copy) | request-response (static string) | Every other `helperLine1` heading in the same file (`'High Pass Aerial Challenge!'`, `'First-Time Pass!'`, `'Attempt Save!'`, etc.) | exact |
| `packages/client/src/components/FreeKickSetupPanel.tsx` | component (setup panel) | request-response (click/move → emit) | `PenaltyKickSetupPanel.tsx` select-then-Confirm pattern (cross-file, same role/data-flow) | role-match |
| `packages/client/src/components/PlayerStatsPanel.tsx` (+ `PlayerStatsPanel.module.css`) | component (card display) | transform (data → JSX) | `LineupAssignmentScreen.tsx`'s `LineupStatCard` / `DraftPackCarousel.tsx`'s `DraftCardBody` (already-shared card pattern) | role-match |
| `packages/client/src/components/GameSettingsScreen.tsx` (Speed control relocation) | component (settings UI) | request-response (toggle/select) | Existing Advanced-drawer rows (Fouls/Booking/Injury checkboxes, `.advancedColumn`, lines 256-340) | role-match (different widget shape — button-group not checkbox) |
| `packages/server/src/roomHandlers.ts` (bench-patch `else` branch, ~lines 979-992) | service (room/session handler) | CRUD (build derived state from confirmed room data) | The sibling `if (isDraftRoom)` branch immediately above (lines 967-978) — same `BenchEntry[]` shape, same assignment target | exact (structurally symmetric branch) |
| `packages/shared/src/teams.ts` (`PLAYER_POOL` — 10 new `PoolPlayer` entries) | model/data | CRUD (static data array) | Existing `PoolPlayer` entries in the same array (e.g. `p001`, lines 48-66) | exact |
| `docs/HIGHLIGHT-REFERENCE.md` (line ~138, ~149 prose fixes) | doc | transform (doc-to-code sync) | N/A — doc correction, no code analog needed | n/a |
| `packages/client/src/components/BallLocationRing.test.tsx` | test | — | Existing per-phase assertions in same test file | exact |
| `packages/client/src/components/ActionPanel.test.tsx` | test | — | Existing per-branch assertions in same test file | exact |

## Pattern Assignments

### `packages/client/src/components/BallLocationRing.tsx` (component, CLEANUP-06)

**Analog:** same file, existing Set entries (lines 31-78)

**Core pattern to copy** (add `'FREE_KICK_SETUP'` to the Set, following the exact comment convention already used for every other addition):
```typescript
// packages/client/src/components/BallLocationRing.tsx, inside BALL_MARKER_PHASES (line ~73-77)
'TACKLE_STEAL_PROMPT',
'FREE_KICK_SETUP', // CLEANUP-06 (Phase 46): the ball is fixed at freeKickHex throughout every
                    // FREE_KICK_SETUP stage — this phase was previously (and incorrectly)
                    // grouped with ordinary MOVE/PASS in docs/HIGHLIGHT-REFERENCE.md's
                    // exclusion list; every other restart-setup family already gets this marker.
```
Each existing entry demonstrates the required comment style: reference the phase/decision that added it, state *why* the ball is "fixed or mid-air" during that phase. Follow that voice exactly — do not add a bare string with no comment.

**Companion doc fix** — `docs/HIGHLIGHT-REFERENCE.md` line ~149 lists `FREE_KICK_SETUP` in the "excluded" prose; remove it from that list. Line ~138's "17-phase list" is also stale (actual count is 31 after this addition, 32) — update the count.

---

### `packages/client/src/store/useGameStore.ts` (store, CLEANUP-05 Finding A)

**Analog:** the file's own existing `phaseChanged`-guard pattern for `headerContestantIds` (lines 1447-1456) — this phase's fix is a sibling to that same technique: add a narrower exception condition to the existing broad clearing `if`, rather than writing new clearing logic from scratch.

**Clearing branch to modify** (lines 1425-1461):
```typescript
const phaseChanged = newState.phase !== prevState.phase;
...
if (
  responseMoveStateChanged ||
  responseMovePaceExhausted ||
  phaseChanged ||
  !pieceStillExists ||
  prevSelectedId === null ||
  activationComplete
) {
  // Clear selection on phase/slot transitions or missing piece (D-18)
  set({ ... selectedPieceId: null, validMoveHexes: [], ... });
  ...
  return;
}
// Sticky selection: recompute adjacent hexes for next step (D-17, D-19)
```

**Fix pattern (from RESEARCH.md's own sketch, verified against current line numbers)** — add a `resumingFromInterrupt` guard BEFORE the `if`, and gate the clear:
```typescript
const INTERRUPT_PHASES: GamePhase[] = [
  'TACKLE_STEAL_PROMPT', 'GK_DIVE_AT_FEET_PROMPT', 'GK_BOX_ENTRY_PROMPT', 'FOUL_CHOICE',
];
const resumingFromInterrupt =
  phaseChanged && newState.phase === 'MOVE' && INTERRUPT_PHASES.includes(prevState.phase);
const midMovePieceId = resumingFromInterrupt
  ? newState.pieces.find(
      (p) => (newState.paceUsedByPieceId[p.id] ?? 0) > 0 && !newState.movedPieceIds.includes(p.id),
    )?.id ?? null
  : null;
```
Then change the `if` condition to skip the clear when `resumingFromInterrupt && midMovePieceId !== null`, and in that branch route through the existing sticky-selection `computeMovementValidHexes` call already used by the generic MOVE fallback (same file, ~line 1701-1706) — do not write a second copy of that computation.

**Existing sticky-selection call to reuse (do not duplicate)** — the `KICK_OFF_SETUP` sticky branch (lines 1491-1499) is the template for "derive team, call a compute*ValidHexes helper, set() with the same shape":
```typescript
if (newState.phase === 'KICK_OFF_SETUP') {
  const myTeam = deriveMyTeam(prev.playerSlot);
  const stickyValid =
    myTeam === null ? [] : computeKickOffSetupValidHexes(prevSelectedId, newState, myTeam);
  set({
    gameState: newState,
    selectedPieceId: prevSelectedId,
    validMoveHexes: stickyValid,
    tackleRiskHexes: [],
    ...
  });
}
```
For the generic MOVE case, the analogous existing call is `computeMovementValidHexes` at ~line 1701-1706 — use that same helper for the auto-reselect fix, do not write new valid-hex math.

---

### `packages/client/src/components/ActionPanel.tsx` (component, CLEANUP-08)

**Analog:** same file's own `helperLine1` convention — every other phase already names its trigger in the heading (see the panel-heading table below, all read directly from the file).

**Line to change** (line 728):
```typescript
<span className={styles.helperLine1}>Free Move!</span>
```
becomes something naming the trigger, per the file's own "short-noun-phrase-plus-exclamation" convention documented in the code comment at lines 719-727 (e.g. `'Final-Third Movement!'`). Compare against the established sibling headings already in the file:
```typescript
// line 372: <span className={styles.helperLine1}>High Pass Aerial Challenge!</span>
// line 412: <span className={styles.helperLine1}>First-Time Pass!</span>
// line 450: <span className={styles.helperLine1}>Attempt Save!</span>
// line 475: <span className={styles.helperLine1}>Snapshot — Deflection Attempt!</span>
// line 682: <span className={styles.helperLine1}>Ball in Air!</span>
```
`helperLine2` (line 729-731) stays as-is — it already names the mechanic ("up to 6 hexes each, regardless of remaining pace"), only `helperLine1`'s heading needs the trigger language.

---

### `packages/client/src/components/FreeKickSetupPanel.tsx` (component, CLEANUP-10)

**Analog:** `packages/client/src/components/PenaltyKickSetupPanel.tsx` (`PENALTY_KICK_TAKER_SELECT`, lines 160-204) and `CornerKickSetupPanel.tsx`/`ThrowInSetupPanel.tsx` (same click-select-then-Confirm shape).

**Shared pattern to align toward (from `PenaltyKickSetupPanel.tsx`, lines 154-159 comment + button)**:
```typescript
// PenaltyKickSetupPanel.tsx — comment explains WHY this pattern exists:
// "clos[es] the misclick-commits-irreversibly defect (PENALTY_KICK_TAKER_PLACED is an Undo boundary)"
// Pattern: click a board piece -> selectedPieceId set by store's phase-specific selectPiece branch
// -> panel shows "Choose your penalty taker." -> explicit Confirm button:
<button onClick={() => emitPenaltyKickTaker(selectedPieceId)}>Confirm</button>
```

Per CONTEXT.md D-03/RESEARCH.md's recommendation: minimum fix is aligning `FreeKickSetupPanel.tsx`'s stage-0 constraint-row *language* to describe the kicker requirement the same way ("select then this becomes locked" phrasing), matching the other 3 panels' wording conventions — do NOT restructure `FREE_KICK_STAGES`/`freeKickStageTeam` mechanics unless time allows (flagged as a larger, separate change per RESEARCH.md).

---

### `packages/client/src/components/PlayerStatsPanel.tsx` (component, CLEANUP-11)

**Analog:** `packages/client/src/components/LineupAssignmentScreen.tsx`'s `LineupStatCard` (lines 223-343) and `packages/client/src/components/DraftPackCarousel.tsx`'s `DraftCardBody` (lines 87-160, reused by `BenchCarousel.tsx`) — these two already share one CSS module (`LineupAssignmentScreen.module.css`) with class names `.cardBody`, `.cardHeader`, `.cardName`, `.cardMeta`, `.cardRole`, `.cardNum`, `.statGrid`, `.statChip`, `.statBadge`, `.statAbbr`, both at `TeamBadge size={48}`, both filtering `STAT_LABELS` to a 3-column, 6-stat grid.

**Current divergent pattern in `PlayerStatsPanel.tsx`** (own module, `PlayerStatsPanel.module.css`):
```typescript
// line 136: <div className={styles.cardBody}>   -- name coincides but is a DIFFERENT stylesheet
// line 159: <div className={styles.statGrid}>    -- 4-column claimed in stale doc comment (lines 109-118),
//           but actually only ever renders 6 stats like the roster/bench family
// TeamBadge size={56} full  (roster/bench family uses size={48})
```

**Fix direction:** align `TeamBadge` size (56→48) and stat-grid column count (visually 4-col→3-col) with the roster/bench family; correct the stale "4-column/7-stat" doc comment (lines 109-118) to match actual 6-stat/3-col behavior. Minimum-risk = just fix the two visual divergences + the comment; stretch = extract a shared card-body sub-component consumed by both stylesheets' owners (do not attempt this without confirming `LineupAssignmentScreen.module.css` doesn't pull in unrelated screen-specific rules).

---

### `packages/server/src/roomHandlers.ts` (bench patch, D-05..D-09)

**Analog:** the sibling `if (isDraftRoom)` branch immediately above (lines 967-978) — the standard-room `else` branch should mirror its shape (build a `BenchEntry[]` with `playerId`/`jerseyNumber`/`status: 'available'`).

**Current code to replace** (lines 979-993):
```typescript
} else {
  // Every non-draft squad in PLAYER_POOL holds exactly 11 players today, so this list
  // comes out EMPTY for standard rooms. Per D-12 the empty case is deliberately NOT
  // special-cased anywhere: no pool is consulted, no substitute is generated — the
  // substitution screen simply shows "no available substitutes" until a future phase
  // expands rosters. This is expected behavior, not a gap.
  const homeAssignedIds = new Set(room.homeAssignment ?? []);
  const awayAssignedIds = new Set(room.awayAssignment ?? []);
  confirmedHomeBench = getSquadPlayers(room.homePickedTeam!)
    .filter((p) => !homeAssignedIds.has(p.id))
    .map((p) => ({ playerId: p.id, jerseyNumber: p.number, status: 'available' as const }));
  confirmedAwayBench = getSquadPlayers(room.awayPickedTeam!)
    .filter((p) => !awayAssignedIds.has(p.id))
    .map((p) => ({ playerId: p.id, jerseyNumber: p.number, status: 'available' as const }));
}
```
Per D-08: the standard-room branch should still run this existing `getSquadPlayers(...).filter(...)` logic (harmless — currently always empty since squads == starting XI), then, when it comes out empty, append/fall back to the 2 new hardcoded generic bench arrays (`GENERIC_HOME_BENCH_IDS`/`GENERIC_AWAY_BENCH_IDS`, or reference the new `PoolPlayer`s' ids directly filtered by `sourceTeamId === 'generic-bench-home'|'generic-bench-away'`), built with `BenchEntry` shape `{ playerId, jerseyNumber: 12-16 range (Pitfall 3), status: 'available' }`.

**Bench-patch data pattern to copy** — `packages/shared/src/types.ts` `BenchEntry` shape (referenced, not modified) is `{ playerId: string /* PLAYER_POOL id, NOT PlayerPiece.id */; jerseyNumber: number; status: 'available' | ... }`.

---

### `packages/shared/src/teams.ts` (`PLAYER_POOL`, D-05..D-09)

**Analog:** existing `PoolPlayer` entry, `p001` (lines 48-66):
```typescript
{
  id: 'p001',
  sourceTeamId: 'canada',
  firstName: 'Maxime',
  lastName: 'Crepeau',
  number: 1,
  nationality: 'Canada',
  role: 'GK',
  position: { q: 2, r: 13 },
  pace: 4,
  shooting: 1,
  tackling: 1,
  dribbling: 3,
  saving: 5,
  handling: 4,
  resilience: 5,
  aerialAbility: 5,
  highPass: 0,
},
```
The 10 new placeholder entries (5 `sourceTeamId: 'generic-bench-home'` + 5 `sourceTeamId: 'generic-bench-away'`, one per role `GK`/`DEF`/`MID`/`FWD`/`ST`) must follow this exact shape — every numeric stat field populated with a reasonable mid-tier value (do not leave any field 0/undefined outside what `p001` itself demonstrates, e.g. `highPass: 0` for a GK is the existing convention, not an omission).

**File header constraint (Pitfall 2)** — this file is auto-generated (`packages/shared/scripts/seed-rosters.ts` from `packages/shared/src/data/*.csv`). Per RESEARCH.md Open Question 3, the planner/executor must check the CSV pipeline before choosing hand-edit vs. CSV-row route; if hand-editing, add a prominent comment flagging these 10 rows as a manual Phase 46 addition.

**Jersey numbering (Pitfall 3)** — assign numbers 12-16 (outside the starting-XI's 1-11 range), matching how Draft-mode bench numbers already occupy a separate numbering space (`DraftSession.*BenchNumbers`).

---

## Shared Patterns

### Comment-driven Set/config additions (CLEANUP-06, and any similar single-source-of-truth table)
**Source:** `BallLocationRing.tsx`'s `BALL_MARKER_PHASES`, `HexCell.tsx`'s `HIGHLIGHT_STYLES`/`RING_STYLES`
**Apply to:** any new phase/entry added to a shared constant table — always accompany with a comment citing the phase/decision ID and the *why*, mirroring the existing entries' voice. Never add a bare literal with no comment.

### phaseChanged-guarded clearing/derivation in `useGameStore.ts`
**Source:** `useGameStore.ts` lines 1447-1456 (`headerContestantIds` guard)
**Apply to:** the CLEANUP-05 auto-reselect fix — extend the existing broad `if` with a narrow exception rather than restructuring the whole clearing block.

### select-then-Confirm restart-panel pattern
**Source:** `PenaltyKickSetupPanel.tsx` (lines 154-204), `CornerKickSetupPanel.tsx`, `ThrowInSetupPanel.tsx`
**Apply to:** `FreeKickSetupPanel.tsx`'s CLEANUP-10 language alignment — this is the "target shape" other panels already converged on to fix a real misclick defect; do not invert the direction (do not simplify PK/Corner/ThrowIn back toward FK's single-step model).

### Shared card-body markup (`LineupAssignmentScreen.module.css`)
**Source:** `LineupStatCard` (`LineupAssignmentScreen.tsx`) / `DraftCardBody` (`DraftPackCarousel.tsx`)
**Apply to:** `PlayerStatsPanel.tsx`'s CLEANUP-11 alignment — badge size (48) and 3-column/6-stat grid are the target values already used by 2 of 3 card surfaces.

### `knip`/`typecheck`/`test` regression gate (CLEANUP-13)
**Source:** `knip.json` (root), each package's `"test": "vitest run"` script
**Apply to:** every file touched in this phase — run `pnpm knip` + `pnpm --filter <pkg> test -- <touched-file>` after each task; `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm knip` as the full phase gate before `/gsd-verify-work`.

## No Analog Found

None — every file in scope for this phase is a modification of existing code with a directly comparable sibling pattern already present in the same file or a closely related file (this is the nature of a cleanup/consistency-audit phase: there is no genuinely new capability except the bench-patch data, which itself has a direct sibling — the `isDraftRoom` branch and the `p001` `PoolPlayer` entry).

## Metadata

**Analog search scope:** `packages/client/src/components/`, `packages/client/src/store/useGameStore.ts`, `packages/server/src/roomHandlers.ts`, `packages/shared/src/teams.ts`, `packages/shared/src/types.ts`, `docs/HIGHLIGHT-REFERENCE.md` — all scoped directly from RESEARCH.md's own file/line citations (already a direct-code-read research pass), verified against current line numbers via targeted `Read`/`Grep` in this session.
**Files scanned:** 7 direct reads/greps this session (BallLocationRing.tsx, useGameStore.ts clearing branch + sticky branch, roomHandlers.ts bench section, teams.ts header + p001, ActionPanel.tsx helperLine1 occurrences, PlayerStatsPanel.tsx card markup)
**Pattern extraction date:** 2026-08-29
