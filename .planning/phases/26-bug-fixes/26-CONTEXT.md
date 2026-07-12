# Phase 26: Bug Fixes - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 6 known gameplay defects (BUG-24 through BUG-29) in the running codebase. All fixes are corrections to existing behavior — no new features or game rules are introduced. The phase also closes the pending FREE_KICK_SETUP undo todo (folded into BUG-24).

</domain>

<decisions>
## Implementation Decisions

### BUG-23 Status

- **D-01:** BUG-23 (KICK_OFF_SETUP stale shot-path shading after SNAPSHOT_DEFLECT goal) is **Out of Scope** for Phase 26. REQUIREMENTS.md is authoritative. It requires a dedicated `/gsd-debug` instrumentation session to identify the root cause. Do not attempt to fix it here.

### BUG-24 Scope — Undo Scoping (includes FREE_KICK_SETUP stage undo)

- **D-02:** BUG-24 includes the FREE_KICK_SETUP stage-boundary undo behavior from the pending todo `free-kick-setup-undo-not-implemented.md` (tagged `resolves_phase: 26`). The todo closes when BUG-24 ships.
- **D-03:** Undo button disabled gate for FREE_KICK_SETUP: use `freeKickPlacedPieceIds.length === 0`. Empty list = no moves committed in the current stage = button disabled. Once ≥ 1 piece placed, undo is enabled.
- **D-04:** Undo boundary for FREE_KICK_SETUP: applyUndo must not cross `FK_STAGE_ADVANCE` events. Scan eventLog backward from the current position; stop and return disabled if a `FK_STAGE_ADVANCE` or `FK_KICKER_CHOSEN` boundary is hit before finding an `FK_SETUP_MOVE` to undo.
- **D-05:** For MOVE-phase undo (non-FK): undo is disabled if no moves have been taken in the current phase (checked via `paceUsedByPieceId` empty) or all current-phase moves are already undone. Cross-turn undo is not allowed.

### Bug Discovery Policy

- **D-06:** If a discovered adjacent bug is a trivial same-file fix (one-liner, same function, no test additions needed), the executor may fold it in opportunistically with a note in the plan task.
- **D-07:** If a discovered bug requires changes outside the file being edited, new tests, or is non-trivial, the executor must surface it to the user with a recommendation (fold vs. todo) before proceeding. Do not create todos silently for user-confirmable bugs.

### Folded Todos

- **`free-kick-setup-undo-not-implemented.md`** — Stage-boundary undo for FREE_KICK_SETUP was specified in Plan 25-06 but not implemented. Full spec: undo disabled at stage start (`freeKickPlacedPieceIds` empty), enabled within stage, blocked at `FK_STAGE_ADVANCE` boundary. Closes when BUG-24 ships.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` §Bug Fixes — BUG-24 through BUG-29 definitions and acceptance criteria

### Roadmap

- `.planning/ROADMAP.md` §Phase 26 — Goal and success criteria (6 items)

### Folded Todo Spec

- `.planning/todos/pending/free-kick-setup-undo-not-implemented.md` — Full spec for FREE_KICK_SETUP stage undo (acceptance criteria, expected behavior, notes). Read before planning BUG-24.

### Out of Scope (for reference, do not implement)

- `.planning/todos/pending/2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — BUG-23 root-cause investigation. Out of scope; deferred to standalone debug spike.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/server/src/gameEngine.ts` `applyUndo` (line 1388) — existing undo implementation; FK_STAGE_ADVANCE boundary detection partially present (lines 1392–1401); FK_SETUP_MOVE handling for `freeKickPlacedPieceIds` partial (lines 1501–1540). BUG-24 extends this.
- `packages/server/src/gameEngine.ts` `applyResolveHeaderTarget` (line 3386) — validates target within 6 hexes of winning contestant, routes to GK_DIVE for goal-line hexes. BUG-28 likely extends this validation.
- `packages/server/src/gameEngine.ts` `applyDeclareShot` (line 3584) — current range gate: `hexDistance(shooter.position, goalHex) > 11`. BUG-29 investigates whether this calculation or constant is correct.
- `packages/client/src/components/ActionPanel.tsx` `ctaButtonClass` (line 46) — returns `ctaButtonReady` or `ctaButtonPending` based on `eligibleRemaining`. BUG-25 targets the MOVE-phase End Turn button color logic.
- `packages/client/src/components/HexGrid.tsx` `handleClick` / `inspectPiece` — BUG-26 fix: clicking an opponent's activated piece should call `inspectPiece(piece.id)`. The `movedPieceIds` / `myTeam` checks around line 700–728 control current click routing.
- `packages/client/src/components/ActionLog.tsx` `DEFLECT_ATTEMPT` case (line 305) — currently emits `'failed to deflect'` without the `— [reason]` suffix in some paths. BUG-27 fixes format consistency.

### Established Patterns

- All game-state mutations go through `applyXxx` pure functions in `gameEngine.ts`; handlers in `gameHandlers.ts` call these and emit the result.
- `freeKickPlacedPieceIds` is the canonical list of pieces placed in the current FREE_KICK_SETUP stage — cleared on stage advance, updated by `applyFreeKickMove`.
- `paceUsedByPieceId` tracks MOVE-phase committed moves; empty map = no moves this slot.
- `ctaButtonPending` (orange/yellow) vs `ctaButtonReady` (green) are defined in `ActionPanel.module.css`.

### Integration Points

- `canUndo` client-side selector (used in HexGrid or ActionPanel) mirrors the undo availability logic in `applyUndo` — both must be updated in sync for BUG-24 + FK undo.
- `ActionPanel.tsx` renders the Move End Turn button — BUG-25 color fix is here.
- `HexGrid.tsx` `handleClick` — BUG-26 opponent-click routing fix is here.
- `ActionLog.tsx` `DEFLECT_ATTEMPT` case — BUG-27 format fix is here.

</code_context>

<specifics>
## Specific Ideas

- BUG-24 FK undo gate: `freeKickPlacedPieceIds.length === 0` → disabled; `> 0` → enabled. This reuses the already-maintained field rather than requiring a new eventLog scan.
- Bug discovery: trivial same-file one-liner → fold opportunistically with note; anything larger → ask user before acting.

</specifics>

<deferred>
## Deferred Ideas

- **BUG-23** (KICK_OFF_SETUP stale shading) — Out of Scope; needs dedicated debug spike with console.log instrumentation of the SNAPSHOT_DEFLECT → KICK_OFF_SETUP flow.

### Reviewed Todos (not folded)

- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — BUG-23, deferred (Out of Scope per REQUIREMENTS.md).
- `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` — Already resolved in Phase 25 (REPLAY-07); no action needed.
- `csv-consolidation-player-pool.md` — Not relevant to Phase 26 bug fixes.

</deferred>

---

_Phase: 26-Bug-Fixes_
_Context gathered: 2026-07-12_
