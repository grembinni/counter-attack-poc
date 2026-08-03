# Phase 31: Bug Fixes - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Three known gameplay/replay defects are fixed and verified:

1. **BUG-30** — Post-game replay doesn't reconstruct all player positions at kickoff after a goal is scored (some pieces retain stale pre-goal positions).
2. **BUG-31** — The eligible-players-remaining message and End Turn button color only update once a piece is fully activated (exhausted pace + locked), not the moment it starts moving; must also correctly reflect state after Undo.
3. **BUG-32** — The goalkeeper can currently be selected as an eligible deflection responder during SNAPSHOT_DEFLECT; it shouldn't be selectable at all.

Two adjacent backlog bugs were folded into this phase's scope (see Folded Todos below) because they are the same defect class as BUG-30/BUG-31 and touch the same code paths. This phase does NOT include new capabilities — only fixing existing defects and their same-class siblings.

</domain>

<decisions>
## Implementation Decisions

### BUG-30 — Goal-reset replay reconstruction

- **D-01:** Add a `piecesAfter` field to the `GOAL` `ActionEvent` (in `packages/shared/src/types.ts`) carrying the full post-reset piece array, rather than having `buildReplayFrames` recompute positions by calling `buildKickOffPieces` itself. Update both `GOAL` construction sites in `packages/server/src/gameEngine.ts` (~line 2150-2178 unsaveable-shot branch, ~line 2241-2270 shot-duel-goal branch) to populate `piecesAfter`, and update `buildReplayFrames`'s `GOAL` handling (~line 4653) to apply `event.piecesAfter` to `current.pieces` instead of leaving pieces untouched.
- **D-02:** Also verify the second-half kickoff reset (`gameEngine.ts:4442`, which already calls `buildKickOffPieces`) reconstructs correctly in replay, and add regression coverage if it shares the same gap — same defect class, worth checking while this code is already being touched.

### BUG-31 — Move-started timing + Undo

- **D-03:** A piece counts as having "started a move" the moment `paceUsedByPieceId[id] > 0` (first hex stepped) — NOT the moment it's merely selected/clicked. This reuses the existing `activatedCount` signal already computed in `packages/client/src/components/HexGrid.tsx:702-704` for slot-quota gating, rather than inventing a new "currently selected" signal.
- **D-04:** The `remaining` calculation in `packages/client/src/components/ActionPanel.tsx` (~line 921-937) must be changed to count pieces with ANY `paceUsedByPieceId` entry as "started" (not just `paceExhaustedNotLocked` + `currentSlotLockedCount`), so the eligible-players-remaining message and End Turn button color (`ctaButtonClass`) update immediately on first step.
- **D-05:** Undo must immediately revert this — the moment Undo fires, the affected piece's started-state is cleared and `remaining`/button color recompute in the same render, with no stale-state window.

### BUG-32 — GK deflection eligibility

- **D-06:** Fix in both layers (defense-in-depth), matching this project's server-authoritative architecture (ARCH-01..07):
  - **Client:** Add `piece.role !== 'GK'` to `canSelectSnapDeflect` in `packages/client/src/components/HexGrid.tsx:735-741`.
  - **Server:** Add a corresponding rejection of a GK-selected deflection responder in the server-side SNAPSHOT_DEFLECT move validator in `packages/server/src/gameEngine.ts`, so a modified/buggy client cannot submit a GK deflection move that the server would otherwise accept.

### Folded Todos

- **`2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md`** ("GK_KICK ball delivery invisible during post-game replay", REPLAY-06 gap) — same replay-reconstruction defect class as BUG-30: `GK_KICK` has no `ballAfter` field and is missing from `REPLAY_ELIGIBLE_TYPES` in `gameEngine.ts`, so GK long-kicks teleport during replay instead of animating. Folded in because BUG-30 already requires touching `buildReplayFrames`/`REPLAY_ELIGIBLE_TYPES`/event-type shapes — fixing this alongside is low-marginal-cost. Also fix the related `LOOSE_BALL_LAND` gap (WR-01, same defect class) noted in the same todo if time allows within this phase.
- **`2026-07-12-bug-header-winner-piece-ineligible-next-phase.md`** ("Header winner piece should be ineligible in the subsequent movement phase") — same eligibility/`movedPieceIds`-locking class as BUG-31: after winning a header duel (non-goal route), the winning piece should be added to `movedPieceIds` so it appears activated/spent in the next MOVE phase, but currently isn't. Fix is in `applyResolveHeaderTarget` in `packages/server/src/gameEngine.ts` (occupant-PASS and empty-hex/loose-ball branches), with corresponding test updates in `gameEngine.rule11.test.ts`.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug root-cause backlog docs (folded into this phase)

- `.planning/todos/pending/2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` — full root-cause analysis and suggested fix steps for the GK_KICK replay gap (folded todo)
- `.planning/todos/pending/2026-07-12-bug-header-winner-piece-ineligible-next-phase.md` — full root-cause analysis and affected code for the header-winner eligibility gap (folded todo)

### Related backlog doc (reviewed, NOT folded — see Deferred below)

- `.planning/todos/pending/2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — KICK_OFF_SETUP shot-path shading; deferred to Phase 33/34

### Project/milestone context

- `.planning/PROJECT.md` — v1.5 milestone goal, current-state known-bug list (BUG-30/31/32 originate here), and prior-milestone tech debt
- `.planning/REQUIREMENTS.md` (lines 37-41) — BUG-30, BUG-31, BUG-32 requirement definitions
- `.planning/ROADMAP.md` (lines 122-132) — Phase 31 goal, success criteria, dependency note ("Nothing — first phase of v1.5")
- `.planning/v1.4-MILESTONE-AUDIT.md` — background on RESP-01..09 (explicitly NOT in scope for this phase; do not touch response-move activation logic)

No other external specs/ADRs apply — requirements are fully captured in the Decisions section above plus the two canonical backlog docs.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `activatedCount` computation (`HexGrid.tsx:702-704`, derived from `Object.keys(paceUsedByPieceId).length`) — reuse this "started" signal for BUG-31's remaining-count fix instead of inventing a new one.
- `buildKickOffPieces(kickOffTeam, selectedTeams, selectedFormation)` — existing formation-position builder already used by every live-path kickoff reset (goal-scored at `gameEngine.ts:2150`/`2241`, second-half kickoff at `gameEngine.ts:4442`). Confirms deterministic inputs are already available in `finalState` for reconstructing `piecesAfter`.
- `REPLAY_ELIGIBLE_TYPES` set and the `ballAfter`-driven "Universal ball position update" pattern in `buildReplayFrames` (`gameEngine.ts` ~4476-4508, ~4665-4667) — the established pattern to extend for `piecesAfter` (BUG-30) and for adding `GK_KICK`/`LOOSE_BALL_LAND` (folded todo).

### Established Patterns

- Server-authoritative validation: every move type has both a client-side selection gate (`canSelect*` in `HexGrid.tsx`) and a server-side validator in `gameEngine.ts`. BUG-32's fix must follow this two-layer pattern like every other move type, not just patch the client.
- `movedPieceIds` is the canonical "piece is spent/ineligible this phase" marker, consumed both by client `canSelect*` gates and by server phase-completion checks. The folded header-winner todo and BUG-31 both operate on this same concept but at different granularity (phase-level lock vs. mid-phase pace tracking) — do not conflate the two.

### Integration Points

- `packages/shared/src/types.ts` — `ActionEvent` discriminated union; BUG-30's `piecesAfter` field and the folded GK_KICK todo's `ballAfter` field both need type changes here.
- `packages/server/src/gameEngine.ts` — all three bugs plus both folded todos have their primary fix location here.
- `packages/client/src/components/HexGrid.tsx` — BUG-31 (`activatedCount` reuse) and BUG-32 (`canSelectSnapDeflect`) client-side changes.
- `packages/client/src/components/ActionPanel.tsx` — BUG-31's `remaining` calculation (~line 915-943) and `ctaButtonClass` button coloring.

</code_context>

<specifics>
## Specific Ideas

No particular visual/UX references beyond the ROADMAP.md success criteria — this phase is pure defect correction, verified against the existing rule/replay behavior rather than new design.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)

- **`2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`** ("KICK_OFF_SETUP shows persistent light shading on hexes matching prior shot path") — reviewed and NOT folded into Phase 31. Reason: this is fundamentally a highlight/rendering-color defect (root cause still unconfirmed after exhaustive static analysis), not a state-reconstruction or eligibility defect like BUG-30/31/32. It belongs with Phase 33 (Design Tokens & Highlight Standardization) or Phase 34 (Visual Theme Restyle), where the highlight system is being audited and rebuilt wholesale — fixing it now, before that audit, risks being overwritten or duplicated.

</deferred>

---

_Phase: 31-Bug Fixes_
_Context gathered: 2026-07-22_
