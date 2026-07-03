---
phase: 19-data-model-team-palette
reviewed: 2026-07-03T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - packages/shared/src/teamConfig.ts
  - packages/shared/src/teams.ts
  - packages/shared/src/teamConfig.test.ts
  - packages/shared/src/teams.test.ts
  - packages/shared/scripts/seed-rosters.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/roomHandlers.ts
  - packages/client/src/components/ActionLog.tsx
  - packages/client/src/components/GameBoard.tsx
  - packages/client/src/components/PlayerStatsPanel.tsx
  - packages/client/src/components/TeamSelectionScreen.tsx
  - packages/client/src/components/PieceOverlay.tsx
  - packages/client/src/components/TeamBadge.tsx
  - packages/client/src/mock/mockMovementState.ts
  - packages/client/src/components/ActionLog.test.tsx
  - packages/client/src/components/GameBoard.test.tsx
  - packages/client/src/components/PlayerStatsPanel.test.tsx
  - packages/client/src/components/TeamSelectionScreen.test.tsx
  - packages/client/src/components/PieceOverlay.test.tsx
findings:
  critical: 3
  warning: 8
  info: 5
  total: 16
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-07-03T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 19 introduces the 4-color `TeamPalette` model, a unified `PLAYER_POOL` flat array replacing per-squad exports, the `COLOR_SCHEME_REGISTRY`, and updated client components that derive colors from `TEAM_CONFIGS`. The data plumbing is largely correct and well-structured. Three correctness bugs are present: a runtime crash path in `ActionLog.tsx` when `selectedTeams` is not populated (e.g., during early renders), a data integrity inconsistency in `teams.ts` where two players share empty string last names, and a silent data loss bug in `seed-rosters.ts` where a CSV encoding that embeds commas in a field would silently corrupt all subsequent columns for that row. Several warnings cover missing guards, a non-idiomatic hook call pattern, and data quality concerns in the player pool.

---

## Critical Issues

### CR-01: `pieceColorOf` and `slotTeamColor` called outside React render context — crashes on early store reads

**File:** `packages/client/src/components/ActionLog.tsx:9-38`

**Issue:** `pieceColorOf(pieceId)` and `slotTeamColor(slot)` call `useGameStore.getState()` at module level inside helper functions. These helpers are invoked during `consolidateEvents` and `formatEvent`, which run inside the `ActionLog` component render. However, `selectedTeams` is accessed as `gameState.selectedTeams` without a null guard. If `gameState` is in a transient state where `selectedTeams` is undefined (e.g., the very first render before the store hydrates from the mock, or when the game has not started), `TEAM_CONFIGS[undefined]` is `undefined`, and calling `.palette.primary` on it throws a TypeError that crashes the entire component tree.

The pattern `TEAM_CONFIGS[selectedTeams[positional]].palette.primary` at line 12 has no fallback. `selectedTeams` being `undefined` or `selectedTeams[positional]` being a key not in `TEAM_CONFIGS` will both throw.

Additionally, calling `useGameStore.getState()` inside render-time helpers (not as a Zustand selector hook) bypasses React's subscription mechanism. The component subscribed at line 768 (`useGameStore((s) => s.gameState.selectedTeams)`) does not cover the calls inside `pieceName`, `pieceNum`, and `pieceColorOf`, which silently read stale state when called outside the subscription cycle. This is a "phantom subscription" — the component re-renders when `selectedTeams` changes (line 768), but `pieceColorOf` reads `getState()` at call time, which may be correct in practice but is fragile and violates the Zustand subscription contract.

**Fix:**

```typescript
function pieceColorOf(pieceId: string): string {
  const state = useGameStore.getState();
  const selectedTeams = state.gameState?.selectedTeams;
  if (!selectedTeams) return '#888888';
  const positional = pieceId.startsWith('home') ? 'home' : 'away';
  const teamId = selectedTeams[positional];
  return TEAM_CONFIGS[teamId]?.palette.primary ?? '#888888';
}
```

Apply the same null-guard pattern to `slotTeamColor`.

---

### CR-02: CSV parser silently corrupts rows that contain commas in quoted fields

**File:** `packages/shared/scripts/seed-rosters.ts:133-138`

**Issue:** The CSV parser at line 133 splits every line on bare commas: `line.split(',').map((s) => s.trim())`. RFC 4180 CSV files allow quoted fields that contain literal commas (e.g., `"Last, Jr."` or a name with a comma). If any row in the source CSVs uses this convention, every column after the quoted field will be misaligned, producing wrong stat values silently: the `Player` column might parse fine, but `Pace` picks up the wrong cell, and so on. The error produces no warning — `toInt` converts garbage strings to 0, so the generated `teams.ts` will have zeroed stats for affected players with no visible diagnostic.

This is particularly dangerous because the seed script is the single source of truth for `teams.ts`, which is committed. A corrupted run produces a committed file with wrong data that tests will then snapshot as correct.

**Fix:** Use a proper CSV parser that handles quoted fields, or at minimum assert that no field in the header or data rows contains a comma before proceeding:

```typescript
// After parsing header, validate no cell contains a comma
for (const cell of header) {
  if (cell.includes(','))
    throw new Error(`CSV header cell contains comma: "${cell}" — use a quoted-field-aware parser`);
}
```

Or replace the manual `line.split(',')` with a library like `csv-parse/sync` that handles RFC 4180 correctly.

---

### CR-03: `getSquadPlayers` performs O(n) linear scan across 178 players per squad member — 11 scans per team build, and throws on data integrity failures that have no recovery path in `buildSquadPieces`

**File:** `packages/shared/src/teamConfig.ts:158-165` / `packages/server/src/gameEngine.ts:116-139`

**Issue:** `getSquadPlayers` at line 160 iterates `PLAYER_POOL.find(...)` for each of the 11 `playerIds`. With 178 entries this is 11 × 178 = ~1,958 comparisons per team, and it is called twice inside `buildSquadPieces` (once for home, once for away). This runs on every call to `buildInitialGameState` and `buildKickOffPieces`. The bigger issue is the `throw new Error(...)` at line 162. Because `buildSquadPieces` does not catch this error, and `buildSquadPieces` is called from `buildInitialGameState`, which is called from the `TEAM_PICK` handler in `roomHandlers.ts` inside a `try/finally` block (line 211), an unknown player ID will propagate as an uncaught throw inside the Socket.io event handler. Socket.io does not catch synchronous throws from event handlers and will crash the Node process.

While the data is unlikely to be corrupted at runtime (the seed is committed), a single bad edit to `TEAM_CONFIGS.playerIds` would cause a production crash with no graceful error emission to the client.

**Fix:** Catch the error in `roomHandlers.ts` around the `buildInitialGameState` call:

```typescript
let gameState: GameState;
try {
  gameState = buildInitialGameState(roomCode, selectedTeams, room.gameSpeed ?? 'standard');
} catch (err) {
  console.error('buildInitialGameState failed:', err);
  socket.emit(ServerEvents.GAME_ERROR, 'SERVER_ERROR');
  return;
}
room.gameState = gameState;
broadcastState(io, room);
```

Additionally, pre-build a Map in `teamConfig.ts` for O(1) player lookup:

```typescript
const PLAYER_POOL_MAP = new Map(PLAYER_POOL.map((p) => [p.id, p]));
export function getSquadPlayers(teamId: TeamId): PoolPlayer[] {
  return TEAM_CONFIGS[teamId].playerIds.map((id) => {
    const player = PLAYER_POOL_MAP.get(id);
    if (!player) throw new Error(`Player ${id} not found in PLAYER_POOL`);
    return player;
  });
}
```

---

## Warnings

### WR-01: Two Spain players have empty string `lastName` in `teams.ts` — breaks display everywhere names are rendered

**File:** `packages/shared/src/teams.ts:3109,3147`

**Issue:** Players p162 (Rodri) and p164 (Pedri) have `lastName: ''`. Every component that renders `${piece.firstName} ${piece.lastName}` will display a trailing space (e.g. "Rodri "). The `pieceName` helper in `ActionLog.tsx` returns `"Rodri "` (with trailing space). Tests that match on exact name strings would pass, but the UI renders an awkward name. More importantly, the seed script's name-splitting logic at `seed-rosters.ts:145-147` produces an empty `lastName` when the player's full name is a single token (no space) — meaning the CSV entries for these players have no surname in the `Player` column. This may be correct (mononym players), but it's a data integrity gap that produces inconsistent rendering. There is also a risk that when these players are selected, single-name display without a trailing-space fix will look broken.

**Fix:** Either add a well-known mononym sentinel (e.g., set `lastName: ''` intentionally and add a guard in the render helpers), or document this as expected behavior and add a guard in `pieceName`:

```typescript
function pieceName(pieceId: string, fallback: string): string {
  const piece = pieces.find((p) => p.id === pieceId);
  if (piece === undefined) return fallback;
  return piece.lastName ? `${piece.firstName} ${piece.lastName}` : piece.firstName;
}
```

---

### WR-02: `buildSquadPieces` silently continues when both `homeST` or `awayST` are not found — kick-off position is silently wrong

**File:** `packages/server/src/gameEngine.ts:128-138`

**Issue:** The check `if (homeST && awayST)` at line 130 silently skips the kick-off positioning when either striker is absent. If a team's data has no `ST`-role player (e.g., data corruption, or a future team configuration that uses a different striker role label), the strikers remain at their formation positions rather than the kick-off hex. This produces an invalid game state where no piece is at the kick-off hex, but `buildInitialGameState` sets `ball.position = PITCH_REGIONS.kickOffHex` and `ball.carrierId = null`. The game then starts with the ball floating on the centre dot with no carrier, and `applyStartMovement` will fail to find a kicker at the ball position, leaving `ball.carrierId = null` throughout the first movement phase.

**Fix:** Log a warning (or throw) if either striker is not found:

```typescript
if (!homeST || !awayST) {
  console.error(`buildSquadPieces: missing ST for home=${!homeST} away=${!awayST}`);
  // Fallback: proceed with pieces as-is (ball at centre, no carrier until pickup)
} else {
  // ... positioning logic
}
```

---

### WR-03: `TeamSelectionScreen` calls `SPEED_OPTIONS.find(...)` three times in the visitor branch — unnecessary repeated linear scans

**File:** `packages/client/src/components/TeamSelectionScreen.tsx:96-101`

**Issue:** Lines 96, 99, and 101 each call `SPEED_OPTIONS.find((o) => o.value === selectedSpeed)` independently. Since `SPEED_OPTIONS` has only 3 entries this is harmless for performance, but it means if `selectedSpeed` is somehow not in the array, the first `.find` returns `undefined` and accessing `?.colorClass ?? 'speedColorStandard'` gives the fallback, while `.icon` gives `undefined` (rendered as nothing). More critically, `.label ?? selectedSpeed` falls through to showing the raw enum value in the UI. This is a correctness concern for type safety: `selectedSpeed` is typed as `GameSpeed` but there is no compile-time guarantee it matches an entry in `SPEED_OPTIONS` (the array is not derived from the type).

**Fix:** Compute the found option once:

```typescript
const selectedOption = SPEED_OPTIONS.find((o) => o.value === selectedSpeed);
// Then use selectedOption?.colorClass, selectedOption?.icon, selectedOption?.label
```

---

### WR-04: `applyStartMovement` transitions from `'PASS'` phase — but `'PASS'` is the "CHOOSING ACTION" phase, not the legacy `'KICK_OFF'` phase

**File:** `packages/server/src/gameEngine.ts:235`

**Issue:** `applyStartMovement` guards at line 235 allow `state.phase === 'PASS'`. The comment says "From CHOOSE_ACTION (after steal/tackle): ball.carrierId is already correct." The `'PASS'` phase is the choosing-action phase (as labeled in `PHASE_LABEL` in GameBoard.tsx). This cross-phase transition is intentional but the guard also includes `'LOOSE_BALL'`. However, looking at `ELIGIBLE_NEXT_ACTIONS['SUCCESSFUL_TACKLE']`, `MOVEMENT` is an eligible next action from `PASS` phase. The concern is that `applyStartMovement` does not validate that the caller is the `activeTeam` — this validation is described as being enforced by the handler ("T-4-05: the handler (Wave 3) restricts this event to the attacking team's socket"), not by the engine itself. If the handler check is ever bypassed or misconfigured, both players could call `applyStartMovement` concurrently and both succeed. The engine has no `activeTeam` check.

**Fix:** Add an `activeTeam` guard to the engine function for defense-in-depth:

```typescript
if (state.activeTeam !== callerTeam) {
  return { ok: false, reason: 'WRONG_PHASE' };
}
```

Or at minimum document that this check is deliberately deferred to the handler layer.

---

### WR-05: `fmtStatRoll` uses `Math.abs(penalty)` but callers sometimes pass already-positive penalties and sometimes negative

**File:** `packages/client/src/components/ActionLog.tsx:139-147`

**Issue:** `fmtStatRoll` at line 146 renders `- ${Math.abs(penalty)}`. In the `HEADER` branch at lines 583-584, the `attackerPenalty` is computed as:

```typescript
const attackerPenalty = event.attackerDie! + event.attackerAerialAbility! - event.attackerCombined!;
```

If the penalty is zero or negative (no penalty applied, dice added correctly), this produces a negative or zero value. `Math.abs` corrects the sign, but it also masks a case where the formula `die + stat - combined` could be negative (i.e., `combined > die + stat`), which would indicate data corruption. The `- 0` case (no penalty) renders correctly. However, if `combined` is less than `die + stat` due to a bonus (not a penalty), the label "- X" is misleading because X would represent a bonus deducted, which is backwards. The calculation does not account for the actual penalty sign correctly.

**Fix:** Use the actual penalty field if available, or document clearly what the penalty computation means. In the `STEAL_ATTEMPT` branch the comment says "D-12: STEAL_ATTEMPT carries no penalty field — always 0", which is consistent. The `HEADER` case uses a derived penalty that is ambiguous.

---

### WR-06: `mockMovementState` is missing required `GameState` fields that exist in the live type — test isolation risk

**File:** `packages/client/src/mock/mockMovementState.ts:45-83`

**Issue:** The mock at line 45 does not include several fields that appear in `GameState` based on what `applyStartMovement` spreads onto (e.g., `contestedPieceIds`, `stealAttemptedByIds`, `tackleAttemptedByIds`, `offsidePieceIds`, `freeMoveEligibleIds`, `freeMoveUsedPace`, `freeMoveResume`, `lastShotPath`, `snapshotGkPenalty`). TypeScript may or may not catch these depending on how `GameState` is defined (whether optional fields). If tests spread `mockMovementState` into partial overrides, any missing field that the component accesses will be `undefined`, potentially causing test failures that don't reflect real bugs or masking real ones.

**Fix:** Audit `GameState`'s full type definition and ensure `mockMovementState` either includes all required fields or uses TypeScript's `satisfies GameState` operator to catch gaps at compile time.

---

### WR-07: `TEAM_ID_MAP` in `seed-rosters.ts` silently drops rows where `teamId` is `null`

**File:** `packages/shared/scripts/seed-rosters.ts:36-42,336-342`

**Issue:** `TEAM_ID_MAP` at line 36 maps `Cozmos`, `CITY`, `Crew`, `Xolos`, and `FA`. There is no entry for an unknown team name. The fallback at line 337-342:

```typescript
} else {
  console.warn(`Unknown team CSV name: "${raw.teamCsvName}"...`);
}
```

...only warns but does not fail. A mismatch between the CSV `Team` column value and the `TEAM_ID_MAP` keys (e.g., if a future CSV uses `"Cosmos"` instead of `"Cozmos"`) silently drops the player. The total player count emitted to `teams.ts` would be fewer than 178, but the seed script succeeds with exit code 0. The `teams.test.ts` test at line 19 asserts `PLAYER_POOL.toHaveLength(178)`, but this only catches the problem after re-running tests against the regenerated file — there's no fail-fast at generation time.

**Fix:** After processing all CSVs, assert the expected player count matches before writing output:

```typescript
const EXPECTED_TOTAL = 178;
if (allEntries.length !== EXPECTED_TOTAL) {
  throw new Error(
    `Expected ${EXPECTED_TOTAL} players, got ${allEntries.length}. Check TEAM_ID_MAP and CSV files.`,
  );
}
```

---

### WR-08: `GOAL` event in `ActionLog.tsx` hardcodes `isGoal: false` — always wrong

**File:** `packages/client/src/components/ActionLog.tsx:381-393`

**Issue:** The `GOAL` case at line 381 returns `isGoal: false`. The `Formatted` type includes `isGoal: boolean`, and `GOAL` is the canonical goal event. If `isGoal` is used downstream (e.g., to trigger a celebration overlay, score flash, or bold styling in the action log), setting `isGoal: false` on the goal event means the downstream consumer never sees a true positive. Looking at the render path in the `ActionLog` component (lines 804-815), `isGoal` is destructured but never actually used in the component's JSX — it is silently discarded. So the bug is currently latent, but the intent in the type is clearly to distinguish goal events, and the data is wrong.

**Fix:**

```typescript
case 'GOAL':
  return {
    prefix: '[SHOT]',
    prefixColor: pieceColorOf(event.scorerId),
    content: (
      <>
        {' '}
        <PNamed pieceId={event.scorerId} /> SCORED!
      </>
    ),
    isGoal: true, // was false — GOAL events must return true
  };
```

---

## Info

### IN-01: Nationality inconsistency in player data — `'US'` and `'United States'` used interchangeably

**File:** `packages/shared/src/teams.ts:661,678,737,776` (and others)

**Issue:** Most US players use `nationality: 'US'` (p033, p034, p037, etc.) while some use `nationality: 'United States'` (p006). This inconsistency won't cause a runtime error but would cause any future feature that filters or groups by nationality (flag display, stats, nationality badges) to miscount US players. The same occurs with `'Columbia'` (p044, line 869) vs `'Colombia'` (p082, p082) — the crew striker Cucho Hernandez uses the misspelled `'Columbia'`.

**Fix:** Standardize nationality strings. Consider adding a lookup or normalization step in the seed script's `parseRow` function.

---

### IN-02: `seed-rosters.ts` uses mutable `let` for stat variables without necessity

**File:** `packages/shared/scripts/seed-rosters.ts:157-166`

**Issue:** Lines 157-166 declare `pace`, `dribbling`, `highPass`, `resilience`, `shooting`, `tackling` as `let` variables even though `aerialAbility`, `saving`, and `handling` are already `const`. The `let` declarations exist because GK overrides at lines 170-178 conditionally mutate them. This works but creates an asymmetry where some stats are mutable and some aren't within the same function. It also means a future maintainer editing the GK block could mistakenly use `=` on `const` variables.

**Fix:** Keep as-is or extract GK-override logic into a small helper that returns corrected values, removing the need for `let`.

---

### IN-03: `PieceOverlay.tsx` declares `fill` and `attackingTeam` as `void`-suppressed unused variables

**File:** `packages/client/src/components/PieceOverlay.tsx:108-109`

**Issue:** Lines 108-109 use `void attackingTeam` and `void fill` to suppress linter warnings about unused variables. `attackingTeam` is a prop that is received but never read (the comment explains the direction uses `piece.teamId` instead). `fill` is computed but only referenced in a comment. These are dead code paths. The `void` suppression pattern is unusual in a React codebase and could confuse future maintainers.

**Fix:** Remove unused variables from the scope. For `attackingTeam`, either remove the prop (if it is guaranteed never to be needed) or document with a `// TODO:` why it is kept. For `fill`, remove the variable and just inline the comment.

---

### IN-04: `getSquadPlayers` error message says "not found in PLAYER_POOL" but does not include team context

**File:** `packages/shared/src/teamConfig.ts:162`

**Issue:** `throw new Error(`Player ${id} not found in PLAYER_POOL`)` does not include which team was being resolved. When this throws in production, the log entry won't indicate whether the missing player was from city or crew, making diagnosis harder.

**Fix:**

```typescript
if (!player) throw new Error(`Player ${id} not found in PLAYER_POOL (teamId: ${teamId})`);
```

---

### IN-05: `teams.test.ts` asserts that GK `aerialAbility > 0` but only that "at least one" GK has it — doesn't catch all GKs

**File:** `packages/shared/src/teams.test.ts:58-65`

**Issue:** The test at line 63 checks `withAerialAbility.length > 0` — i.e., at least one GK has a non-zero `aerialAbility`. This would pass even if all but one GK had a zeroed aerial ability (e.g., due to a future CSV header misalignment). A stronger invariant would be that ALL GKs have `aerialAbility > 0`, since the comment at line 59-61 states that GKs have explicit Aerial Ability values in ALL CSVs.

**Fix:**

```typescript
it('ALL GK players have aerialAbility > 0', () => {
  const gks = PLAYER_POOL.filter((p) => p.role === 'GK');
  for (const gk of gks) {
    expect(
      gk.aerialAbility,
      `GK ${gk.id} (${gk.firstName} ${gk.lastName}) should have aerialAbility > 0`,
    ).toBeGreaterThan(0);
  }
});
```

---

_Reviewed: 2026-07-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
