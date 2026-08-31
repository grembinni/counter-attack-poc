---
phase: 48-permanent-jersey-numbers
reviewed: 2026-08-31T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - packages/client/src/components/LineupAssignmentScreen.test.tsx
  - packages/client/src/components/LineupAssignmentScreen.tsx
  - packages/server/src/__tests__/draftSession.integration.test.ts
  - packages/server/src/__tests__/formations.test.ts
  - packages/server/src/__tests__/gameEngine.phase23.test.ts
  - packages/server/src/__tests__/gameEngine.rosterReposition.test.ts
  - packages/server/src/__tests__/gameEngine.substitution.test.ts
  - packages/server/src/__tests__/lineupAssignment.integration.test.ts
  - packages/server/src/__tests__/substitution.integration.test.ts
  - packages/server/src/draftSession.test.ts
  - packages/server/src/draftSession.ts
  - packages/server/src/gameEngine.ts
  - packages/server/src/roomHandlers.ts
  - packages/shared/src/types.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 48: Code Review Report

**Reviewed:** 2026-08-31T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This phase implements "permanent jersey numbers" — bench players draw a random, distinct
15–99 jersey number once (`assignBenchNumbers`/`backfillBenchNumbers` in `draftSession.ts`,
also reused server-side for standard-mode rooms in `roomHandlers.ts`), and that number now
follows the PERSON rather than the SLOT through substitutions (`applySubstitution`) and
in-match repositioning (`applyRosterReposition`) in `gameEngine.ts`.

The implementation is unusually well cross-checked: every number-follows-person mutation
site in `gameEngine.ts` was traced (`.number`/`number:` occurrences are limited to exactly
the sites that should touch it — `buildSquadPieces`, `relocateRedCardedToBench`,
`applySubstitution`, `applyRosterReposition`), the `backfillBenchNumbers` "fill gaps, never
re-roll" invariant is idempotent and tested for the DRAFT_REARRANGE gap-closure scenario
(a card displaced onto the bench post-draftComplete correctly receives a number, and a
repeat rearrange never re-rolls an existing one), and the client only ever renders a jersey
number where the server has actually assigned one (no premature `#0`/`undefined` rendering
in the pregame Standard-mode bench). No BLOCKER-level defect (incorrect behavior, security
issue, or data-loss risk) was found in the reviewed files.

Two WARNING-level findings and one INFO-level finding are recorded below — mostly around a
stale type-level doc comment that no longer reflects Phase 48's actual invariants, and an
inconsistency between two structurally-identical "resolve this player's bench number" call
sites in `roomHandlers.ts` (one fails safe with a silent, invalid `#0` fallback; the sibling
call site would throw instead).

## Warnings

### WR-01: `PlayerPiece.number`'s doc comment is stale and now contradicts Phase 48's own invariants

**File:** `packages/shared/src/types.ts:37-38`
**Issue:** The field's doc comment still reads:
```ts
/** D-04 (Phase 16): jersey number (GK = 1; others 2–11 in ROLE_ORDER). */
number: number;
```
This was true before Phase 48 but is no longer accurate: `applySubstitution` (gameEngine.ts:3722)
now assigns an incoming substitute their own permanent bench number (`benchEntry.jerseyNumber`,
range 15–99, see `draftSession.ts` `BENCH_NUMBER_MIN`/`BENCH_NUMBER_MAX`), and
`applyRosterReposition` (gameEngine.ts:3949-3959) deliberately carries that same number across
subsequent in-match repositions. So a live on-pitch `PlayerPiece` — including a goalkeeper, if a
GK substitute enters — can legitimately wear a number outside `1–11`, and a GK is not
guaranteed to wear `1` after a substitution. This codebase leans heavily on inline doc comments
as the authoritative record of design decisions (every other Phase-48 touch point was updated
with a `Phase 48/D-05`-style note); this one field was missed, and a future contributor (human
or AI) trusting this comment could reintroduce a `1–11` range assumption/validator that Phase 48
just broke.
**Fix:**
```ts
/**
 * D-04 (Phase 16): starting-XI jersey number is slot-bound (GK = 1; others 2–11 in
 * ROLE_ORDER) at kick-off. Phase 48 (NUMBER-01/02): once a substitution or in-match
 * roster reposition occurs, this number follows the PERSON, not the slot — a substitute
 * keeps their own permanent bench number (15–99, see draftSession.ts BENCH_NUMBER_MIN/MAX),
 * so a live on-pitch piece (including a GK) may legitimately wear a number outside 1–11.
 */
number: number;
```

### WR-02: Inconsistent fail-safe behavior between the two "resolve this bench player's confirmed jersey number" call sites in the same handler

**File:** `packages/server/src/roomHandlers.ts:973,978` vs `packages/server/src/roomHandlers.ts:1029,1034`
**Issue:** Both spots, a few dozen lines apart in the same `LINEUP_CONFIRM` handler, do the
same conceptual thing — read a just-assigned bench jersey number out of a number map keyed by
player id, immediately after that map was populated — but handle a missing entry completely
differently:

```ts
// draft-room branch (line 973/978): silently falls back to an invalid jersey "0"
jerseyNumber: session.homeBenchNumbers[id] ?? 0,
jerseyNumber: session.awayBenchNumbers[id] ?? 0,
```
```ts
// standard-room branch (line 1029/1034): non-null-asserts, would throw instead
jerseyNumber: homeBenchNumbers[p.id]!,
jerseyNumber: awayBenchNumbers[p.id]!,
```
Given the current call graph, both are believed unreachable in practice (the draft-room path
relies on `backfillBenchNumbers` having already run for both sides before `LINEUP_CONFIRM`'s
guard can pass; the standard-room path relies on `assignBenchNumbers` synchronously populating
every id it was just given). But if either invariant is ever violated by a future change
(e.g., a new early-return added to the `DRAFT_PICK` handler before the `backfillBenchNumbers`
calls at lines 1177-1179), the two paths fail in opposite, differently-dangerous ways: the
draft-room path silently ships a real player with jersey `#0` to both clients with no error
logged anywhere, while the standard-room path crashes the room's `LINEUP_CONFIRM` handler
(and, per this single-instance server's own documented risk model elsewhere in the file —
see the `WR-01`-style guard comments already present at roomHandlers.ts:1149 and :1261 — an
uncaught throw here takes down the whole process, not just this room).
**Fix:** Pick one failure mode and use it at both sites — prefer failing loudly over silently
emitting an invalid jersey number for a live player:
```ts
const homeNumber = session.homeBenchNumbers[id];
if (homeNumber === undefined) {
  console.error(`LINEUP_CONFIRM: missing bench number for draft-room player ${id}`);
}
jerseyNumber: homeNumber ?? 0, // or throw / reject, matching the standard-room path's strictness
```

## Info

### IN-01: Slot-index-from-`piece.id` regex parsing is duplicated across two call sites in the same component

**File:** `packages/client/src/components/LineupAssignmentScreen.tsx:547,1052`
**Issue:** `isRepositionSelectable` (line 547) and `renderMidmatchColumn` (line 1052) each
independently run `/-(\d+)$/.exec(piece.id)` to recover the formation-slot index encoded in a
`PlayerPiece.id` (e.g. `home-5` → `5`). The two copies are currently in sync, but nothing
enforces that — a future edit to one (e.g. to add away-team-specific parsing, or to change the
id format) could silently desync eligibility logic from rendering/grouping logic. `gameEngine.ts`
already factors an equivalent server-side parse into a named helper (`slotIndexOf`, used inside
`applyRosterReposition`); the client has no equivalent shared helper.
**Fix:** Extract a single module-level helper, e.g.:
```ts
function slotIndexOfPieceId(id: string): number | null {
  const match = /-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}
```
and use it at both call sites (and in `applyRosterRepositionEligible`-style logic anywhere else
this pattern appears).

---

_Reviewed: 2026-08-31T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
