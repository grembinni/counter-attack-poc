---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 21
subsystem: ui
tags: [react, zustand, gk-dive-at-feet, hex-selection, vitest]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: GK_DIVE_AT_FEET_TARGET phase, GAME_GK_DIVE_AT_FEET_TARGET socket event, computeGkDiveAtFeetTargetHexes shared helper, applyGkDiveAtFeetTarget server resolution (Plan 39-20)
provides:
  - emitGkDiveAtFeetTarget store action and the GK_DIVE_AT_FEET_TARGET selectPiece branch
  - Goalkeeper piece selectability and a dedicated hex-click branch in HexGrid for the dive-target step
  - GkDiveAtFeetPromptPanel copy for both managers during the destination step (no buttons)
  - BallLocationRing marker coverage for GK_DIVE_AT_FEET_TARGET
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'GK_DIVE_AT_FEET_TARGET joins the existing GK_BOX_ENTRY_MOVE-style "single selectable piece, no numeric budget" club across selectPiece, setGameState sticky-selection, HexGrid canSelect*/onClick, and BallLocationRing gating'
    - 'Client highlight set for the dive destination step comes exclusively from the shared computeGkDiveAtFeetTargetHexes helper (packages/shared) — never re-derived client-side'

key-files:
  created: []
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.test.tsx
    - packages/client/src/components/GkDiveAtFeetPromptPanel.tsx
    - packages/client/src/components/GkDiveAtFeetPromptPanel.test.tsx
    - packages/client/src/components/BallLocationRing.tsx
    - packages/client/src/components/BallLocationRing.test.tsx

key-decisions:
  - 'setGameState sticky-selection block DOES need a GK_DIVE_AT_FEET_TARGET arm — deviation from the plan premise (see Deviations below)'
  - 'emitGkDiveAtFeetTarget clears selectedPieceId/validMoveHexes optimistically, mirroring emitCornerKickGkPlace (one-shot action), not emitGkBoxEntryMove (which turned out to be fire-and-forget with no clearing in the current codebase)'
  - 'canSelectGkDiveAtFeetTarget gates on piece.id === gkDiveAtFeetGkId, never role === "GK" — the state already names the exact diving keeper'

patterns-established: []

requirements-completed: [GKDIVE-02, GKDIVE-04]

# Metrics
duration: ~28min
completed: 2026-08-15
---

# Phase 39 Plan 21: GK Dive-at-Feet Destination Hex-Picker UI Summary

**Wired the client half of 39-UAT gap 3: after accepting a dive-at-feet prompt, the goalkeeper's manager can now select their own goalkeeper on the board, see the legal destination hexes highlighted via the shared `computeGkDiveAtFeetTargetHexes` helper, and click one to emit `GAME_GK_DIVE_AT_FEET_TARGET` — closing the dead-end Plan 39-20 left in the server-only half of the flow.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-08-15T18:35:00Z (approx, worktree read/setup)
- **Completed:** 2026-08-15T19:03:00Z
- **Tasks:** 3
- **Files modified:** 8 (all pre-existing)

## Accomplishments

- `useGameStore.ts`: added `emitGkDiveAtFeetTarget(to)` action and a `GK_DIVE_AT_FEET_TARGET` `selectPiece` branch gated on both `myTeam === gkDiveAtFeetTeam` and the exact `gkDiveAtFeetGkId` (ID equality, not `role === 'GK'`), using `computeGkDiveAtFeetTargetHexes` imported from `@counter-attack/shared` — never re-derived locally, so the highlighted set can never drift from the server's authority check.
- `HexGrid.tsx`: the diving goalkeeper is now selectable (`canSelectGkDiveAtFeetTarget`, wired into the `canSelect` disjunction and the click-routing ternary) and a dedicated `onClick` branch emits `emitGkDiveAtFeetTarget(hex)`, placed before the generic `isValidMove && selectedPieceId` fallback so a click can never be misrouted to `GAME_MOVE`.
- `GkDiveAtFeetPromptPanel.tsx`: widened to also render during `GK_DIVE_AT_FEET_TARGET`, mirroring `GkBoxEntryPromptPanel`'s two-phase span — the non-deciding manager sees a waiting message, the diving GK's manager sees hex-selection instructions (no buttons), and the `-1` dice penalty qualifier at distance 3 is preserved on this arm too. The existing `GK_DIVE_AT_FEET_PROMPT` rendering is untouched.
- `BallLocationRing.tsx`: `GK_DIVE_AT_FEET_TARGET` added to `BALL_MARKER_PHASES` (30 → 31) so the ball stays marked at the carrier's hex while the destination is chosen.
- Full client suite: 944 tests green (929 baseline + 15 new); `pnpm typecheck` clean across all three packages; `pnpm build` (shared/client/server) clean; per-file `eslint` clean on all 8 modified files; `pnpm stylelint` clean (no CSS touched).

## Task Commits

1. **Task 1: Add the emitGkDiveAtFeetTarget action and the GK_DIVE_AT_FEET_TARGET selection branch** - `e12752c` (feat)
2. **Task 2: Make the goalkeeper clickable and route hex clicks to the dive-target event in HexGrid** - `e6d8510` (feat)
3. **Task 3: Extend the dive panel copy to the destination step and mark the ball during it** - `2079597` (feat)

_No plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/client/src/store/useGameStore.ts` — `emitGkDiveAtFeetTarget` interface declaration + implementation; `GK_DIVE_AT_FEET_TARGET` `selectPiece` branch; `GK_DIVE_AT_FEET_TARGET` added to the sticky-selection block in `setGameState` (see Deviations)
- `packages/client/src/store/useGameStore.test.ts` — 4 new `selectPiece` tests (selectable/non-empty, distance-1 hexes, non-GK rejection, attacking-team rejection) + 1 new emit-action test (single emit call, clears selection)
- `packages/client/src/components/HexGrid.tsx` — `gkDiveAtFeetTeam`/`gkDiveAtFeetGkId`/`emitGkDiveAtFeetTarget` selectors; `canSelectGkDiveAtFeetTarget` predicate wired into the `canSelect` disjunction and click-routing ternary; dedicated `onClick` branch ahead of the generic `isValidMove` fallback
- `packages/client/src/components/HexGrid.test.tsx` — new describe block: piece selectability for both managers, non-GK exclusion, and hex-click → `emitGkDiveAtFeetTarget` routing (asserts `emitMove` is NOT called)
- `packages/client/src/components/GkDiveAtFeetPromptPanel.tsx` — guard widened; new `GK_DIVE_AT_FEET_TARGET` arm (waiting + deciding sub-arms); doc comment rewritten to describe the two-phase span
- `packages/client/src/components/GkDiveAtFeetPromptPanel.test.tsx` — 6 new tests covering both manager arms, the distance-3 penalty qualifier, and error-row rendering
- `packages/client/src/components/BallLocationRing.tsx` — `GK_DIVE_AT_FEET_TARGET` added to `BALL_MARKER_PHASES`
- `packages/client/src/components/BallLocationRing.test.tsx` — 1 new membership-assertion test; size-pin test updated 30 → 31

## Decisions Made

- **`setGameState`'s sticky-selection block:** the plan's read_first pointer stated the new phase would NOT need a sticky arm, "matching GK_BOX_ENTRY_MOVE, which has no sticky arm either." On inspection, `GK_BOX_ENTRY_MOVE` **does** already have a sticky arm in the current codebase (`useGameStore.ts`, the `FREE_MOVE_ATTACK`/`.../GK_BOX_ENTRY_MOVE` block). Since `GK_DIVE_AT_FEET_TARGET` is structurally identical to `GK_BOX_ENTRY_MOVE` (single selectable piece, no numeric budget, ends on one click) and the plan's own stated rationale for including `GK_BOX_ENTRY_MOVE` there ("re-derive neighbours every broadcast") applies equally, `GK_DIVE_AT_FEET_TARGET` was added to the same block using `computeGkDiveAtFeetTargetHexes(newState)` for parity — without it, a same-phase rebroadcast (e.g. reconnect resync) would silently drop the manager's goalkeeper selection mid-target-step. Documented as a deviation below (Rule 2 — missing critical functionality, since the plan's own premise for omitting it didn't hold against the actual code).
- **`emitGkDiveAtFeetTarget`'s clearing behaviour:** the plan's read_first pointer described `emitGkBoxEntryMove` as "the socket.emit(...) + optimistic-clear shape to copy." In the current codebase `emitGkBoxEntryMove` is actually fire-and-forget (no optimistic clear). Since the plan's own acceptance criteria explicitly require `emitGkDiveAtFeetTarget` to clear `selectedPieceId` after emitting, the implementation mirrors `emitCornerKickGkPlace` instead (which does clear, and is the correct analogue for a one-shot destination-hex action) — satisfies both the acceptance criteria and the plan's underlying intent.
- `canSelectGkDiveAtFeetTarget` and the `selectPiece` guard both key off `piece.id === gkDiveAtFeetGkId` (not `role === 'GK'`), per the plan's explicit instruction — the state already names the specific diving keeper, so a stray second GK (impossible in this ruleset, but defense-in-depth) could never be selected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added a `GK_DIVE_AT_FEET_TARGET` arm to `setGameState`'s sticky-selection block**

- **Found during:** Task 1, while reading the plan's cited `setGameState` sticky-selection block (lines 1321-1470 as pointed to) to "determine" whether a sticky arm was needed, per the plan's own instruction.
- **Issue:** The plan's read_first pointer asserted the new phase needs no sticky arm "matching GK_BOX_ENTRY_MOVE, which has no sticky arm either" — but `GK_BOX_ENTRY_MOVE` is explicitly present in that block in the current codebase (`newState.phase === 'GK_BOX_ENTRY_MOVE'` is one of the disjunction's terms, with its own `computeFreeMoveValidHexes(prevSelectedId, piece, newState)` branch). Without a matching arm, a same-phase rebroadcast during `GK_DIVE_AT_FEET_TARGET` (e.g. a reconnect resync) would fall through to the phase-change/clear branch's else-path and silently drop the manager's in-progress goalkeeper selection.
- **Fix:** Added `newState.phase === 'GK_DIVE_AT_FEET_TARGET'` to the sticky-selection disjunction and a corresponding branch using `computeGkDiveAtFeetTargetHexes(newState)` (the shared helper takes only `GameState`, deriving the GK/carrier from `gkDiveAtFeetGkId`/`gkDiveAtFeetCarrierId` internally — no `prevSelectedId`/`piece` args needed, unlike the other branches).
- **Files modified:** `packages/client/src/store/useGameStore.ts`
- **Verification:** `pnpm --filter @counter-attack/client test useGameStore` passes; `pnpm --filter @counter-attack/client typecheck` clean.
- **Committed in:** `e12752c` (Task 1 commit)

**2. [Rule 1 - Bug] `emitGkDiveAtFeetTarget` mirrors `emitCornerKickGkPlace`'s clearing shape, not the plan's cited `emitGkBoxEntryMove` shape**

- **Found during:** Task 1, implementing the action per the plan's read_first pointer.
- **Issue:** The plan described `emitGkBoxEntryMove` as the "socket.emit(...) + optimistic-clear shape to copy," but the current `emitGkBoxEntryMove` implementation has no optimistic clear (fire-and-forget only) — copying it verbatim would leave `selectedPieceId` stale after emitting, contradicting the plan's own acceptance criterion ("...and clears selectedPieceId").
- **Fix:** Implemented `emitGkDiveAtFeetTarget` mirroring `emitCornerKickGkPlace` instead (which does clear `selectedPieceId`/`validMoveHexes` after emitting) — the correct analogue for a one-shot destination-hex action.
- **Files modified:** `packages/client/src/store/useGameStore.ts`
- **Verification:** Store test asserts `emitGkDiveAtFeetTarget({q:5,r:5})` calls `socket.emit` exactly once and clears `selectedPieceId`.
- **Committed in:** `e12752c` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 bug — both traced to the plan's read_first pointers describing sibling code that had already drifted from the plan author's assumption by the time this plan executed)
**Impact on plan:** Both fixes were necessary to satisfy the plan's own acceptance criteria and to avoid a genuine functional regression (stale selection on reconnect). No scope creep — both changes are narrowly the `GK_DIVE_AT_FEET_TARGET`-specific additions the plan already asked for, just implemented against the sibling code's actual current shape rather than its described shape.

## Issues Encountered

- The worktree had no `node_modules` at spawn time (git worktrees don't carry `node_modules`). Ran `pnpm install --offline` once at the start of execution, then `pnpm --filter @counter-attack/shared build` to populate `packages/shared/dist` (required for `@counter-attack/shared` package resolution in Vitest/tsc). This is environment setup, not a plan deviation.
- The whole-workspace `pnpm lint` command hit the pre-existing, previously-documented `packages/shared` typescript-eslint file-count-cap parsing error (STATE.md: "Known tech debt... doesn't gate CI"), entirely inside `packages/shared/src/*.test.ts` files unrelated to any file this plan touches. Verified no lint regressions were introduced by directly linting every file this plan modified (`npx eslint <files>`), which returned clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 39-UAT gap 3 is now closed end-to-end: prompt → Dive → goalkeeper selectable → highlighted neighbours of the carrier (from the shared helper) → click → `GAME_GK_DIVE_AT_FEET_TARGET` emitted with that hex, resolved server-side by Plan 39-20's `applyGkDiveAtFeetTarget`.
- **Manual trace (code-inspection verification, no live two-browser session performed this plan):**
  1. `GK_DIVE_AT_FEET_PROMPT` — deciding manager sees "Dive at Feet?" + Dive/Decline buttons (`GkDiveAtFeetPromptPanel`, unchanged).
  2. Clicking Dive emits `GAME_GK_DIVE_AT_FEET(true)`; server (Plan 39-20) transitions to `GK_DIVE_AT_FEET_TARGET`.
  3. Client re-renders: `GkDiveAtFeetPromptPanel`'s new arm shows "Dive at Feet" + "Click a highlighted hex..." for the deciding manager, and a waiting message for the other manager — no buttons in either sub-arm.
  4. `HexGrid` renders the diving GK (named by `gkDiveAtFeetGkId`) as selectable only for the manager whose team is `gkDiveAtFeetTeam`; `BallLocationRing` keeps the marker on the carrier's hex.
  5. Clicking the GK piece calls `selectPiece`, which populates `validMoveHexes` via `computeGkDiveAtFeetTargetHexes(gameState)` — the same function the server enforces.
  6. Clicking a highlighted hex fires the dedicated `onClick` branch (ordered before the generic `GAME_MOVE` fallback), calling `emitGkDiveAtFeetTarget(hex)` → `socket.emit('game:gk-dive-at-feet-target', hex)`.
- No blockers. Full verification suite green: client 944 tests (929 baseline + 15 new); `pnpm typecheck` clean across shared/client/server; `pnpm build` clean; per-file `eslint` clean on all 8 modified files; `pnpm stylelint` clean.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-15_

## Self-Check: PASSED

- FOUND: `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-21-SUMMARY.md`
- FOUND: commit `e12752c` (Task 1)
- FOUND: commit `e6d8510` (Task 2)
- FOUND: commit `2079597` (Task 3)
- FOUND: commit `22ad550` (this SUMMARY)
