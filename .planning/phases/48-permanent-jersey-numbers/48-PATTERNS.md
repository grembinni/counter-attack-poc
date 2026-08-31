# Phase 48: Permanent Jersey Numbers - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 5 (no new files — pure correction of existing logic)
**Analogs found:** 5 / 5 (all fixes conform to a pattern already present *in the same file*, so every "analog" is a sibling function, not a separate module)

This phase is unusual: it touches zero new files, and the correct pattern to copy is not "look at another module" but "look at the already-correct sibling function `applyRosterContinuity` in the same file, and remove the parts of the two broken functions that diverge from it." RESEARCH.md's Code Examples section already contains the verified current-vs-required diffs for every touch point — this file adds the surrounding pattern context and exact test-file shape so the planner/executors don't have to re-derive them.

## File Classification

| Modified File | Role | Data Flow | Closest Analog (pattern source) | Match Quality |
|----------------|------|-----------|----------------------------------|---------------|
| `packages/server/src/gameEngine.ts` — `applyRosterReposition` (lines 3830-3965, fix at 3924-3935) | service (pure state-mutation fn) | transform (immutable state → new state) | `applyRosterContinuity` (same file, lines 3982-3991) | exact — sibling pure-function pattern in the same file |
| `packages/server/src/gameEngine.ts` — `applySubstitution` (lines 3604-3774, fix at ~3687-3708 and ~3715-3728) | service (pure state-mutation fn) | transform | `applyRosterContinuity` (same file, lines 3982-3991) | exact — same full-object-spread contract |
| `packages/server/src/gameEngine.ts` — kickoff-striker anchor (line ~325, inside `buildSquadPieces`) | utility (lookup) | transform | `formations.ts` `FORMATIONS[...].slots` (`slotId`/`slotRole` fields) — read-only reference, no fix needed there | exact — data already shaped for the fix |
| `packages/server/src/roomHandlers.ts` — standard-mode bench-number generation (~1008-1017) | controller (socket event handler) | request-response | draft-mode bench-number block in the *same file* (~970-979, and the `assignBenchNumbers` call at ~1154-1161) | exact — same file, adjacent branch, correct pattern already exists |
| `packages/server/src/draftSession.ts` — `assignBenchNumbers` (387-406, reused) + new "fill gaps" helper | service (pure fn) | CRUD-ish (create-if-missing) | `assignBenchNumbers` itself is the pattern to wrap, not replace | exact — wrap, don't reimplement |
| `packages/shared/src/types.ts` — `BenchEntry.jerseyNumber` doc comment (~112-114) | model (type + doc) | — | n/a (doc-only correction) | n/a |

## Pattern Assignments

### `applyRosterReposition` fix (gameEngine.ts, service/transform)

**Analog / pattern source:** `applyRosterContinuity`, same file, lines 3982-3991:
```typescript
export function applyRosterContinuity(
  resetPieces: PlayerPiece[],
  currentPieces: readonly PlayerPiece[],
): PlayerPiece[] {
  return resetPieces.map((resetPiece) => {
    const currentPiece = currentPieces.find((p) => p.id === resetPiece.id);
    if (currentPiece === undefined) return resetPiece;
    return { ...currentPiece, position: resetPiece.position };
  });
}
```
This is the canonical "full-object-spread, override only the one field that legitimately changes" pattern every pure roster-mutation function in this file should follow. `applyRosterReposition`'s current build (lines 3924-3935) violates it by adding an explicit `number:` override after the spread:
```typescript
// CURRENT (bug) — gameEngine.ts:3924-3935
const newA: PlayerPiece = { ...pieceB, id: pieceA.id, position: pieceA.position, number: pieceA.number };
const newB: PlayerPiece = { ...pieceA, id: pieceB.id, position: pieceB.position, number: pieceB.number };
```
**Fix pattern (conform to the `applyRosterContinuity` shape — delete the `number:` line, nothing else):**
```typescript
const newA: PlayerPiece = { ...pieceB, id: pieceA.id, position: pieceA.position };
const newB: PlayerPiece = { ...pieceA, id: pieceB.id, position: pieceB.position };
```
Also update the docstring at lines 3795-3813 (currently asserts "number stays bound to the slot" as load-bearing design — this is the exact claim to invert) and the `ActionEvent` fields `jerseyNumberA`/`jerseyNumberB` at 3949-3950 (these read `pieceA.number`/`pieceB.number` — the PRE-swap number of the slot's prior occupant; verify whether the event should now report the post-swap person's number instead, per whichever is more useful for the event log UI — RESEARCH.md does not resolve this, flag as a planning decision).

**Error handling / guard pattern:** unchanged — this fix touches only the state-build block after all 7 guards; do not touch guards 1-7 (lines 3838-3920).

---

### `applySubstitution` fix (gameEngine.ts, service/transform)

**Analog / pattern source:** same `applyRosterContinuity` full-spread contract, applied to the incoming-piece build and the outgoing bench-entry build.

**Current (bug), incoming piece — gameEngine.ts:3687-3708:**
```typescript
const newPiece: PlayerPiece = {
  ...outPiece, // spreads the SLOT's fields, including its number
  playerId: inPoolPlayer.id,
  firstName: inPoolPlayer.firstName,
  // ...
  redCarded: false, yellowCards: 0, injuryCount: 0,
};
```
**Fix:** add `number: benchEntry.jerseyNumber` to the override block (the incoming player's own permanent number), same style as the existing `redCarded: false` override lines — i.e. this is an *addition to* the existing override-list pattern already used in this exact object literal, not a new pattern.

**Current (bug), outgoing bench entry — gameEngine.ts:3715-3728:**
```typescript
const newTeamBench: BenchEntry[] = benchEntries.map((e) =>
  e.playerId === inPlayerId
    ? { playerId: outPiece.playerId!, jerseyNumber: benchEntry.jerseyNumber, status: 'subbedOut' as const, ... }
    : e,
);
```
`benchEntry.jerseyNumber` here is the incoming player's OLD number (wrong object). **Fix:** change to `jerseyNumber: outPiece.number` (the outgoing piece's own permanent number, following the same "person keeps their own number" rule).

Also update the docstring at lines 3681-3686 (currently states the opposite as the SUB-03 contract).

**Test-file shape to follow (do not restructure, only change assertions):** `gameEngine.substitution.test.ts:176-196`, `it('SUB-03: substitute inherits id/number/position; ...')`:
```typescript
const result = applySubstitution(state, 'home', outPiece.id, inPlayerId);
const newPiece = result.state.pieces.find((p) => p.id === outPiece.id)!;
expect(newPiece.id).toBe(outPiece.id);
expect(newPiece.number).toBe(outPiece.number);   // OLD assertion — encodes the bug, must become:
                                                   //   expect(newPiece.number).toBe(inBenchEntry.jerseyNumber)
expect(newPiece.position).toEqual(outPiece.position);
expect(newPiece.playerId).toBe(inPoolPlayer.id);
```
Keep the `result.ok`/`if (!result.ok) return;` guard idiom and the `find((p) => p.id === ...)` lookup idiom — these are used identically across every test in this file (see `gameEngine.substitution.test.ts:161-470`); only the assertion values change.

---

### Kickoff-striker anchor fix (gameEngine.ts, utility/transform)

**Pattern source:** `formations.ts` `FormationSlot` shape (already correct, read-only) + RESEARCH.md's verified replacement snippet:
```typescript
// Required (D-07) — gameEngine.ts:325 replacement
const attackingSlots = attackingTeam === 'home' ? homeSlots : awaySlots;
const attackingSquad = attackingTeam === 'home' ? homeSquad : awaySquad;
const stSlotIndex = attackingSlots.findIndex((s) => s.slotId === 'ST');
const kickingStriker = stSlotIndex === -1 ? undefined : attackingSquad[stSlotIndex];
```
No analog search needed — RESEARCH.md already verified this is safe across all 4 formations. Treat as ground truth.

**Test-file shape:** `formations.test.ts:47-51` and `gameEngine.phase23.test.ts:66-79` use `describe`/`it` + direct `expect(...).toBe(...)` with no custom helpers beyond the shared `makeState`/`buildKickOffPieces` fixtures already used in `gameEngine.rosterReposition.test.ts` (see below) — same idioms, just assert on `slotId === 'ST'` instead of `number === 9`.

---

### Standard-mode bench-number fix (roomHandlers.ts, controller/request-response)

**Analog / pattern source:** the *already-correct* draft-mode branch in the same file, `roomHandlers.ts:970-979`:
```typescript
confirmedHomeBench = session.homeBenchIds.map((id) => ({
  playerId: id,
  jerseyNumber: session.homeBenchNumbers[id] ?? 0,
  status: 'available' as const,
}));
```
and the `assignBenchNumbers` call already wired for draft mode at `roomHandlers.ts:1154-1161`.

**Current (bug), standard mode — roomHandlers.ts:1008-1017:**
```typescript
confirmedHomeBench = homeBenchPlayers.map((p) => ({
  playerId: p.id,
  jerseyNumber: p.number, // BUG: PoolPlayer.number, not a bench draw
  status: 'available' as const,
}));
```
**Fix pattern:** call `assignBenchNumbers(homeBenchPlayers.map((p) => p.id), randomInt)` (the same `randomInt` already imported in this file for the draft-mode call site) and map the result the same way the draft-mode branch does — this is a copy-the-sibling-branch fix, not new logic.

---

### "Fill gaps, never re-roll" helper (draftSession.ts, service/CRUD-ish)

**Pattern to wrap, not replace:** `assignBenchNumbers`, `draftSession.ts:387-406` (verified reusable as-is):
```typescript
export function assignBenchNumbers(benchIds: string[], rng: RandomIntFn): Record<string, number> {
  const range = Array.from({ length: BENCH_NUMBER_MAX - BENCH_NUMBER_MIN + 1 }, (_, i) => i + BENCH_NUMBER_MIN);
  const shuffled = shuffle(range, rng);
  const numbers: Record<string, number> = {};
  benchIds.forEach((id, index) => { numbers[id] = shuffled[index]!; });
  return numbers;
}
```
New helper (RESEARCH.md's suggested name/signature, treat as ground truth): `fillMissingBenchNumbers(benchIds: string[], existing: Record<string, number>, rng: RandomIntFn): Record<string, number>` — returns `existing` unchanged for ids already present, draws only for missing ids, excluding numbers already in use. Call site: `roomHandlers.ts` `LINEUP_CONFIRM` handler (~970-979), before `confirmedHomeBench`/`confirmedAwayBench` are built — closes the `DRAFT_REARRANGE` orphaning gap (Pitfall 5).

---

### `BenchEntry.jerseyNumber` doc comment (types.ts, model/doc-only)

No code pattern — just correct the comment at `types.ts:112-114` from "standard rooms: the pool player's own `number`" to "both modes: a random 15-99 draw via `assignBenchNumbers`, assigned once and never re-rolled." No test needed for a doc-only change.

## Shared Patterns

### Full-object-spread, override-only-what-legitimately-changed
**Source:** `applyRosterContinuity`, `gameEngine.ts:3982-3991` (the one function in this domain that is already correct)
**Apply to:** `applyRosterReposition`'s piece-build block, `applySubstitution`'s incoming-piece and outgoing-bench-entry builds
**Rule:** every pure roster-mutation function in `gameEngine.ts` takes a full object spread (`...pieceA`, `...outPiece`, `...currentPiece`) and overrides only the field(s) that function is genuinely responsible for changing. Any explicit `number:`/`jerseyNumber:` override outside the one-time build/assignment functions is the anti-pattern this phase removes.

### Test structure — pure-function unit tests in this domain
**Source:** `gameEngine.rosterReposition.test.ts` (whole file) and `gameEngine.substitution.test.ts:160-470`
**Apply to:** all test rewrites this phase requires
**Shape:**
- `import { describe, it, expect } from 'vitest'`
- Module-level `BASE_PIECES = buildKickOffPieces('home', { home, away }, { home: '4-4-2', away: '4-4-2' })` fixture, built once, reused across tests
- `makeState(overrides: Partial<GameState> = {})` factory returning a fully-populated `GameState` with sane defaults, spreading `...overrides` last (see `gameEngine.rosterReposition.test.ts:22-56`)
- Selector helpers (`homeOutfielders`, `homeGK`, `awayOutfielders`) as plain arrow functions filtering `BASE_PIECES`
- Every mutation test follows: call the function under test → `expect(result.ok).toBe(true); if (!result.ok) return;` → look up the resulting piece(s) by `.find((p) => p.id === ...)` → assert field-by-field
- Test names follow `'<REQ-ID>: <plain-English description>'` (e.g. `'SUB-03: substitute inherits id/number/position; ...'`) — new/rewritten tests for this phase should keep referencing the relevant `NUMBER-0X` requirement ID in the test name for traceability

### Random-number generation — never `Math.random`
**Source:** `assignBenchNumbers`, `draftSession.ts:387-406`, using an injected `RandomIntFn` (backed by `crypto.randomInt`)
**Apply to:** the standard-mode bench-number fix in `roomHandlers.ts` and the new "fill gaps" helper
**Rule:** reuse the existing injected `randomInt` already imported in `roomHandlers.ts`; never introduce a second/parallel RNG.

## No Analog Found

None — every touched file already contains, in the same file, the correct pattern to copy (a sibling function or a sibling branch). No external module search was necessary or productive for this phase.

## Metadata

**Analog search scope:** `packages/server/src/gameEngine.ts`, `packages/server/src/roomHandlers.ts`, `packages/server/src/draftSession.ts`, `packages/shared/src/types.ts`, `packages/shared/src/formations.ts`, `packages/server/src/__tests__/gameEngine.rosterReposition.test.ts`, `packages/server/src/__tests__/gameEngine.substitution.test.ts`
**Files scanned:** 7 (all read directly, no broad glob/grep search needed — RESEARCH.md already pinpointed every touch point with verified line numbers)
**Pattern extraction date:** 2026-08-31
