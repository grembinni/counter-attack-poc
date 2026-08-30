---
phase: 42-substitution-ux-overhaul
plan: 14
subsystem: game-engine
tags: [reposition, occupancy-guard, react, drag-drop, gap-closure, vitest]

# Dependency graph
requires:
  - phase: 42-substitution-ux-overhaul (plan 06)
    provides: applyRosterReposition and its D-05 droppable-vacated-slot guard chain
  - phase: 42-substitution-ux-overhaul (this phase, BUG-38 fix)
    provides: the isActivePiece-based occupancy fix that stopped a sent-off piece's
      frozen hex from reporting as occupied, exposing this gap
provides:
  - REPOSITION_SLOT_OCCUPIED destination-occupancy guard in applyRosterReposition
    (server-authoritative, whole-state.pieces scan)
  - Client roster-panel rejection message and a best-effort SENT OFF drop pre-gate
    (ownActiveHexKeys / sentOffSlotHexTaken)
affects: [42-substitution-ux-overhaul (remaining gap-closure plan 42-15)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Destination-occupancy guard as a local predicate (hexHeldByThirdActivePiece)
      called twice for the swap's two arrivals, mirroring the two existing
      isActivePiece occupancy predicates in gameEngine.ts rather than introducing a
      new hex-key/Set helper"
    - 'Best-effort client pre-gate computed from a memoized own-team hex-occupancy
      Set (ownActiveHexKeys), explicitly documented as incomplete (opponent pieces
      invisible) with the server guard as the authoritative fallback'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.rosterReposition.test.ts
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.test.tsx

key-decisions:
  - 'Guard 7 is placed after guard 5 (REPOSITION_BALL_CARRIER) and before guard 6''s
    "Deliberately NO red-card rejection here" comment block, which is preserved
    verbatim — this is a destination-occupancy check, not a red-card eligibility
    check, and D-05''s droppable vacated slot remains fully intact'
  - "HOME_TEAM_PIECES test fixture (LineupAssignmentScreen.test.tsx) was missing
    explicit per-piece positions — every piece shared makePiece's default
    { q: 10, r: 10 }, which made the new client pre-gate spuriously report every
    active piece as standing on the SENT OFF slot's frozen hex. Gave each piece a
    distinct hex (q incrementing per slot index) to match the real
    no-two-active-pieces-per-hex invariant, fixing 2 pre-existing test failures
    this plan's change directly caused."

requirements-completed: [SUB-08, SUB-18, BUG-38]

# Metrics
duration: ~40min (including a one-time ~5min dependency install/build — the worktree
  had no node_modules or built shared package)
completed: 2026-08-22
---

# Phase 42 Plan 14: Reposition Destination-Occupancy Guard (Gap Item 6) Summary

**Added a `REPOSITION_SLOT_OCCUPIED` destination-occupancy guard to `applyRosterReposition` (guard 7) that scans the whole `state.pieces` array and rejects a swap whose outcome would place two active pieces on one hex, plus a matching client rejection message and a best-effort SENT OFF drop pre-gate — closing the BUG-38/D-05 interaction from `42-10-SUMMARY.md` gap item 6.**

## Performance

- **Duration:** ~40 min (including a one-time `pnpm install` + `packages/shared` build — the worktree had no `node_modules` or built shared output)
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Diagnosed and closed gap item 6: BUG-38's fix (this phase) made a sent-off piece's frozen hex stop reporting as occupied, so an active piece can now legitimately stand on it during play; repositioning a different active player into that sent-off slot previously assigned them the same hex, stacking two active pieces on one hex.
- `applyRosterReposition` gained guard 7 (`REPOSITION_SLOT_OCCUPIED`): rejects the swap when either destination hex is already held by a THIRD active piece (own team or opponent), scanning the whole `state.pieces` array — not just `team`'s pieces.
- Guard 6's "Deliberately NO red-card rejection here" comment is preserved byte-for-byte; guard 7 is documented as a destination-occupancy check, structurally unreachable when both participants are active (two active pieces never share a hex today).
- 5 new engine test cases (own-team stacking, opponent stacking, inactive-third-piece exemption, D-05 free-hex preservation, ordinary active-active swap) plus a shared post-swap no-stacking invariant helper — all 18 tests in `gameEngine.rosterReposition.test.ts` pass.
- Client: `gameError === 'REPOSITION_SLOT_OCCUPIED'` now renders "Swap rejected — another player is already in that position."; the SENT OFF placeholder derives `sentOffSlotHexTaken` from a memoized own-team active-hex lookup and suppresses both the drop-target ring (`onDragOver`) and the doomed `onReposition` emit (`onDrop`) when the frozen hex is taken — without touching `handleMidmatchRepositionDrop`'s body (Pitfall-5 separation preserved).
- 5 new client test cases cover the blocked drop, the suppressed drop-target ring, D-05's free-hex path still succeeding, the new rejection message, and substitution mode being unaffected by the pre-gate.

## Task Commits

Each task was committed atomically:

1. **Task 1: Engine guard — a reposition may never land two active pieces on one hex** - `067fa370` (feat)
2. **Task 2: Roster-panel message and SENT OFF drop pre-gate** - `88dceac3` (fix)

_No plan-metadata commit yet — this SUMMARY commit is the metadata commit for this plan (worktree mode)._

## Exact Guard 7 Predicate (as written)

```ts
// 7. DESTINATION-OCCUPANCY guard (42-10-SUMMARY.md gap item 6) — this is NOT a
// red-card eligibility check on the participants; guard 6's comment above still
// stands verbatim. It is a check on the two destination HEXES the swap would
// produce. The guard is unreachable when both pieceA and pieceB are active: two
// active pieces never share a hex today, so neither destination can already hold a
// third active piece — D-05's ordinary swap path is untouched. It exists because
// BUG-38's fix (this phase) made a sent-off piece's frozen hex stop reporting as
// occupied, so an active piece can now legitimately be standing on that hex when the
// manager later repositions a different active player into the sent-off slot. Scans
// the WHOLE state.pieces array (not just `team`'s) — an opponent's active piece on
// the frozen hex produces the same stacking and is equally illegal.
const hexHeldByThirdActivePiece = (hex: { q: number; r: number }): boolean =>
  state.pieces.some(
    (p) =>
      p.id !== pieceIdA &&
      p.id !== pieceIdB &&
      isActivePiece(p) &&
      p.position.q === hex.q &&
      p.position.r === hex.r,
  );
if (
  (isActivePiece(pieceB) && hexHeldByThirdActivePiece(pieceA.position)) ||
  (isActivePiece(pieceA) && hexHeldByThirdActivePiece(pieceB.position))
) {
  return { ok: false, reason: 'REPOSITION_SLOT_OCCUPIED' };
}
```

## Mutation Check (Task 1, verbatim)

1. Temporarily replaced the guard body (from `const hexHeldByThirdActivePiece = ...` through the closing `}`) with a single comment marker, leaving guards 1-6 and the mutation block intact.
2. Ran `gameEngine.rosterReposition.test.ts`: **2 failed, 16 passed** (exactly the two new stacking cases):
   ```
   × case 1: rejects with REPOSITION_SLOT_OCCUPIED when a THIRD own-team active piece already stands on the red-carded slot frozen hex
     AssertionError: expected { ok: true, state: {…} } to deeply equal { ok: false, reason: 'REPOSITION_SLOT_OCCUPIED' }
   × case 2: rejects with REPOSITION_SLOT_OCCUPIED when the third piece on the frozen hex belongs to the OPPONENT
     AssertionError: expected { ok: true, state: {…} } to deeply equal { ok: false, reason: 'REPOSITION_SLOT_OCCUPIED' }
   Test Files  1 failed (1)
        Tests  2 failed | 16 passed (18)
   ```
3. Restored the guard body exactly as written above; re-ran the suite: **18/18 passed.**

## `isActivePiece` Occurrence Count in `gameEngine.ts`

- **Before this plan:** 57 (`git show HEAD:packages/server/src/gameEngine.ts | grep -c isActivePiece`, HEAD at plan start)
- **After this plan:** 60
- **New call sites (3):** `isActivePiece(pieceB)` and `isActivePiece(pieceA)` in the guard's own `if` condition, plus `isActivePiece(p)` inside the `hexHeldByThirdActivePiece` predicate. This matches the +3 increase exactly.

## `gameHandlers.ts` / `handleMidmatchRepositionDrop` Confirmation

- `git diff --stat packages/server/src/gameHandlers.ts` is empty for both task commits — the `GAME_ROSTER_REPOSITION` handler forwards `result.reason` verbatim with no switch, so the widened `RosterRepositionRejection` union required zero handler changes.
- `handleMidmatchRepositionDrop`'s body (read in full, see excerpt below) contains zero occurrences of `sentOffSlotHexTaken` — the new pre-gate is applied inline in the SENT OFF placeholder's own `onDrop`, not inside the shared reposition-drop handler, preserving Pitfall-5's structural separation from `handleMidmatchSubstituteDrop`:
  ```ts
  function handleMidmatchRepositionDrop(e: React.DragEvent<HTMLDivElement>, targetPieceId: string) {
    e.preventDefault();
    setMidmatchDropTargetPieceId(null);
    const drag = midmatchDrag;
    setMidmatchDrag(null);
    if (!drag || drag.source !== 'pitch') return;
    if (drag.pieceId === targetPieceId) return; // self-drop is a no-op
    if (readOnly === true || actionPending === true) return;
    onReposition?.(drag.pieceId, targetPieceId);
  }
  ```

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — widened `RosterRepositionRejection` with `'REPOSITION_SLOT_OCCUPIED'`; added guard 7 (`hexHeldByThirdActivePiece` local predicate + the two-arrival `if`) between guard 5 and guard 6's comment block; extended the function's top JSDoc with a `**Guards, in order:**` summary bullet documenting all 7 guards
- `packages/server/src/__tests__/gameEngine.rosterReposition.test.ts` — imported `isActivePiece`; added `describe('gap item 6: a reposition can never stack two active pieces on one hex')` with 5 cases (own-team stacking, opponent stacking, inactive-third-piece exemption, D-05 free-hex preservation, ordinary active-active swap) and a shared `assertNoActivePieceStacking` invariant helper
- `packages/client/src/components/LineupAssignmentScreen.tsx` — added the `'REPOSITION_SLOT_OCCUPIED'` branch to the `gameError` → `rejectionMessage` chain; added a memoized `ownActiveHexKeys` derivation (own-team active-piece hex occupancy); derived `sentOffSlotHexTaken` per SENT OFF placeholder and used it to gate `onDragOver` (suppress the drop-target ring) and `onDrop` (suppress the doomed `onReposition` emit) in `subMode === 'reposition'` only — substitution mode's branch is untouched
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` — gave every `HOME_TEAM_PIECES` fixture piece an explicit, distinct `position` (Rule 1 fix, see Deviations); added `describe('gap item 6: SENT OFF slot stacking')` with 5 cases matching the plan's Task 2D spec

## Decisions Made

- Guard 7 scans the WHOLE `state.pieces` array (not just `team`'s pieces), per the plan's explicit requirement — an opponent's active piece standing on the frozen hex produces the same stacking and is equally illegal (engine test case 2 covers this).
- The client pre-gate (`ownActiveHexKeys`) is deliberately best-effort and documented as such at both its derivation site and its use site: `midmatchPieces` (per `GameBoard.tsx`'s `pieces.filter((p) => p.teamId === myTeam)`) only ever contains the caller's own team, so an opponent's active piece on the frozen hex is invisible to the client and relies entirely on the server's authoritative guard.
- `sentOffSlotHexTaken`'s suppression logic lives inline in the SENT OFF placeholder's own `onDrop`, not inside `handleMidmatchRepositionDrop`, to preserve the Pitfall-5 hard constraint that the two mid-match drop handlers share no guard body.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `assertNoActivePieceStacking` helper's parameter type rejected `readonly PlayerPiece[]`**

- **Found during:** Task 1, `pnpm -r typecheck`
- **Issue:** `result.state.pieces` types as `readonly PlayerPiece[]`; the new test helper declared its parameter as mutable `PlayerPiece[]`, causing 3 TS2345 errors at the three call sites that pass `result.state.pieces` directly.
- **Fix:** Changed the helper's parameter type to `readonly PlayerPiece[]`.
- **Files modified:** `packages/server/src/__tests__/gameEngine.rosterReposition.test.ts`
- **Verification:** `pnpm -r typecheck` exits 0 across all 3 workspace packages.
- **Committed in:** `067fa370` (Task 1 commit)

**2. [Rule 1 - Bug] Test title containing an apostrophe broke esbuild's single-quoted string parsing**

- **Found during:** Task 1, first test run
- **Issue:** `it('case 1: ... the red-carded slot's frozen hex', ...)` used an apostrophe inside a single-quoted JS string literal, which esbuild's transform failed to parse (`Expected ")" but found "s"`), failing the entire test file with zero tests collected.
- **Fix:** Reworded the title to avoid the apostrophe ("the red-carded slot frozen hex").
- **Files modified:** `packages/server/src/__tests__/gameEngine.rosterReposition.test.ts`
- **Verification:** File transforms and all 18 tests run.
- **Committed in:** `067fa370` (Task 1 commit)

**3. [Rule 1 - Bug] `HOME_TEAM_PIECES` test fixture's shared default position caused 2 pre-existing test failures once the client pre-gate was added**

- **Found during:** Task 2, first run of the full `LineupAssignmentScreen.test.tsx` suite
- **Issue:** Every piece in the `HOME_TEAM_PIECES` fixture (including the red-carded `home-4`) relied on `makePiece`'s shared default `{ q: 10, r: 10 }` position, since no test previously needed distinct hexes. Once `ownActiveHexKeys`/`sentOffSlotHexTaken` were added, every active piece appeared to already be standing on `home-4`'s frozen hex, making the two pre-existing D-05 tests (test 14 and the SUB-06 mode-coexistence test) fail — `onReposition` was never called because the pre-gate (correctly, given the fixture) treated the slot as taken.
- **Fix:** Gave every `HOME_TEAM_PIECES` piece an explicit, distinct `position` (`{ q: 10 + slotIndex, r: 10 }`), matching the real game-state invariant that active pieces never share a hex. `home-4`'s frozen hex is free by default, matching what the pre-existing tests assert; the new gap-item-6 suite explicitly relocates a piece onto it (`COLLISION_PIECES`) to exercise the guard.
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- **Verification:** Full `LineupAssignmentScreen.test.tsx` suite green (77/77, including all 5 new gap-item-6 cases and both previously-failing tests).
- **Committed in:** `88dceac3` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs/breakages directly caused by this plan's own changes)
**Impact on plan:** All three were necessary to satisfy the plan's own verification requirements (typecheck clean, tests runnable, full pre-existing suite green). No scope creep — no files outside the plan's declared `<files>` list were touched.

## Issues Encountered

- The worktree had no `node_modules` and no built `packages/shared/dist` output on first use (fresh worktree checkout) — ran `pnpm install --frozen-lockfile` (~5 min, no lockfile changes) and `pnpm --filter @counter-attack/shared build` before any test could execute. This is worktree/environment setup, not a plan deviation.
- The full server suite's first run reported a `Worker exited unexpectedly` (`tinypool`) unhandled error with 1 file failing to complete — a known Windows vitest worker-crash flake (unrelated to this plan's changes). A clean re-run of the identical command passed 1505/1505 (1 skipped, 1 todo).

## Verification Results

- `pnpm --filter @counter-attack/server test -- --pool=forks gameEngine.rosterReposition` — 18/18 passed
- `pnpm --filter @counter-attack/client test -- --pool=forks LineupAssignmentScreen` — 77/77 passed
- `pnpm --filter @counter-attack/client test -- --pool=forks` (full client suite) — 37 files / 1116 tests passed
- `pnpm --filter @counter-attack/server test -- --pool=forks` (full server suite) — 61 files / 1505 tests passed (1 skipped, 1 todo); first attempt hit the known Windows worker-crash flake, clean on retry
- `pnpm --filter @counter-attack/shared build` — clean
- `pnpm -r typecheck` — clean (shared/server/client all `Done`)
- `npx eslint packages/server/src/gameEngine.ts packages/client/src/components/LineupAssignmentScreen.tsx packages/server/src/__tests__/gameEngine.rosterReposition.test.ts packages/client/src/components/LineupAssignmentScreen.test.tsx` — clean
- `pnpm knip` — exits clean (0 findings)
- `pnpm format:check` — clean for all 4 files this plan touches; 12 pre-existing unrelated files flagged (same set logged in 42-12/42-13 SUMMARY.md), not fixed — out of scope per the deviation rules' scope boundary
- Acceptance-criteria greps (all match plan expectations):
  - `grep -c "REPOSITION_SLOT_OCCUPIED" packages/server/src/gameEngine.ts` = 3
  - `grep -c "Deliberately NO red-card rejection here" packages/server/src/gameEngine.ts` = 1
  - `isActivePiece` count in `gameEngine.ts`: 57 before → 60 after (+3, exactly the new call sites)
  - `git diff --stat packages/server/src/gameHandlers.ts` = empty
  - `grep -c "REPOSITION_SLOT_OCCUPIED" packages/client/.../LineupAssignmentScreen.tsx` = 1
  - `grep -c "sentOffSlotHexTaken" packages/client/.../LineupAssignmentScreen.tsx` = 3 (derivation + `onDragOver` + `onDrop`)
  - `sentOffSlotHexTaken` occurrences inside `handleMidmatchRepositionDrop`'s body = 0

## Known Stubs

None.

## Threat Flags

None — this plan's own `<threat_model>` (T-42-54 through T-42-57, plus the standard T-42-SC no-install acceptance) covers every trust-boundary consideration introduced (server-side whole-`state.pieces` scan as the elevation-of-privilege mitigation, the client pre-gate explicitly documented as best-effort/non-authoritative). No new network endpoints, auth paths, file access patterns, or schema changes were introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Gap item 6 from `42-10-SUMMARY.md` is closed: the engine can no longer produce two active pieces on one hex via a reposition, and the roster panel no longer advertises a drop it knows will be refused.
- D-05 (sent-off slot remains droppable when its frozen hex is free) is confirmed intact by both the engine's case 4 and the client's case 3.
- No blockers for the remaining gap-closure plan (42-15) in this wave — this plan shares no requirement, component behavior, or user-facing surface change with it beyond the two files it touches.

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.rosterReposition.test.ts
- FOUND: packages/client/src/components/LineupAssignmentScreen.tsx
- FOUND: packages/client/src/components/LineupAssignmentScreen.test.tsx
- FOUND commit: 067fa370
- FOUND commit: 88dceac3
