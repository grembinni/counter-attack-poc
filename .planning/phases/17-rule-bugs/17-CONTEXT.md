# Phase 17: Rule Bugs - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix seven rule-correctness defects in the existing game engine and client UI: suppress header-pass interception on the server (BUG-01); add a Cancel button to escape MOVEMENT phase before the first move (BUG-02); enable undo in HIGH_PASS_MOVEMENT phase (BUG-03); deliver passes to occupied hexes as ball pickups (BUG-04); spawn loose ball at the goalkeeper's hex on a save (BUG-05); implement the free 6-hex move for players in the opponent's final third after a crossing action (MOVE-06); and implement mid-pass player repositioning during First-time Pass flight with path-blocking (PASS-02).

**Requirements in scope:** BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, MOVE-06, PASS-02

</domain>

<decisions>
## Implementation Decisions

### BUG-01: Header pass is not blockable

- **D-01:** The fix is server-only. In `applyPass` (gameEngine.ts), skip the interception loop entirely when `state.lastActionType === 'HEADER'`. The client-side suppression is already in place (HexGrid.tsx:322–325 skips ZoI/tackle risk for header passes).
- **D-02:** The HIGH_PASS contest itself (HIGH_PASS_MOVEMENT + HEADER duel) is unchanged — only the FIRST_TIME_PASS that follows a HEADER win is unblockable.

### BUG-02: Cancel/Back in MOVEMENT phase

- **D-03:** Add a "Cancel" button to the MOVEMENT phase ActionPanel. It is visible **only** when `paceUsedByPieceId` is empty (no piece has moved yet in the current slot).
- **D-04:** Pressing Cancel emits a new `game:cancel_movement` event. The server reverts to PASS phase, restoring full ball/piece state (as if `emitStartMovement` was never called). No movement slot is consumed.
- **D-05 [informational]:** This is the only new Back button needed. PASS phase step 2 already has `← Back` to action chooser; no other phases require a new Back control. (Already implemented and verified by plan 17-03, executed 2026-06-15 — citation backfilled here rather than editing the merged plan doc.)

### BUG-03: Undo in HIGH_PASS_MOVEMENT

- **D-06:** Extend `applyUndo` (gameEngine.ts:784) to also accept `phase === 'HIGH_PASS_MOVEMENT'`. Currently it returns `WRONG_PHASE` for any phase other than `MOVEMENT`. The same slot-boundary + DICE_ROLL lock logic applies.
- **D-07 [informational]:** The client `canUndo` computation in ActionPanel already reads from `eventLog` — show the Undo button in HIGH_PASS_MOVEMENT with the same disabled-when-no-moves logic. (Already implemented and verified by plan 17-03, executed 2026-06-15 — citation backfilled here rather than editing the merged plan doc.)

### BUG-04: Pass landing on occupied hex → ball pickup

- **D-08:** After the interception loop in `applyPass`, before returning the delivered-ball state, check if `targetHex` is occupied by a piece. If occupied: set `carrierId` to that piece's id and `ball.position` to that piece's position.
- **D-09:** If the occupant belongs to the defending team, also set `attackingTeam` and `activeTeam` to the defender's team (possession transfer). Phase stays `PASS`.
- **D-10:** This applies to STANDARD_PASS, FIRST_TIME_PASS, LONG_BALL — any grounded pass type. HIGH_PASS already routes to HEADER and is out of scope.

### BUG-05: Loose ball spawns at goalkeeper's hex after save

- **D-11:** Find the GK-save → LOOSE_BALL transition in gameEngine.ts. Replace the ball position in the resulting LOOSE_BALL state with the GK's current hex position (`state.pieces.find(p => p.id === gkId).position`), not the shot origin hex.

### MOVE-06: Free 6-hex move after crossing thirds

- **D-12:** The free move fires **after** the MOVEMENT phase ends (End Turn). In `applyEndTurn`, when `state.pendingFreeMove != null`, transition to a new `FREE_MOVE` phase instead of `PASS`. Clear `pendingFreeMove` once the `FREE_MOVE` phase is entered.
- **D-13:** In `FREE_MOVE` phase, eligible pieces are **outfield players already in the opponent's final third** at the moment the `FREE_MOVE` phase starts. Each eligible player independently gets up to 6 hexes — this is not a shared pool.
- **D-14:** `FREE_MOVE` ends (transitions to `PASS`) when the active team presses End Turn. The client shows "Free Move — move up to 6 hexes per player in the opponent's third" in ActionPanel, with an End Turn button.
- **D-15:** The `FREE_MOVE` phase inherits `attackingTeam`/`activeTeam` from the MOVEMENT phase that produced it (same team that crossed thirds takes the free move).
- **D-16:** Add `'FREE_MOVE'` to the `GamePhase` union type in `packages/shared/src/types.ts`. Add `ELIGIBLE_NEXT_ACTIONS['FREE_MOVE_END']` (or equivalent) as needed for phase sequencing.

### PASS-02: Mid-pass movement during First-time Pass flight

- **D-17:** First-time Pass flow after target is chosen:
  1. Attacker selects FIRST_TIME_PASS → clicks target hex → pass path highlighted on board.
  2. **New PASS step:** Attacker moves 1 non-passer player up to 1 hex. Press End Turn to commit (or skip move and End Turn immediately).
  3. Server transitions to `SNAP_DEFLECT` phase. Defender moves 1 player up to 1 hex onto the pass path.
  4. Deflect resolves as per existing SNAP_DEFLECT logic: if a defending player is on the pass path → LOOSE_BALL; otherwise → ball delivers to target.
- **D-18 [informational]:** Reuse the existing `SNAP_DEFLECT` phase for the defender's move. The `lastActionType === 'FIRST_TIME_PASS'` flag distinguishes this context from a snapshot deflect — resolution at SNAP_DEFLECT end follows the pass path (not shot path) when `lastActionType === 'FIRST_TIME_PASS'`. (SUPERSEDED: this single-step design was never executed — its implementing plan, the original 17-05, was cancelled 2026-06-20 because Phase 17.1 independently built and shipped a different, verified two-slot `FIRST_TIME_PASS_MOVE` design that fully satisfies PASS-02. Kept for historical record only; do not implement.)
- **D-19 [informational]:** The pass path is highlighted throughout the attacker's repositioning step and the `SNAP_DEFLECT` phase, so the defender can see which hexes to target. (SUPERSEDED — see D-18 note. Historical record only.)
- **D-20:** The attacker's 1-hex repositioning is limited to 1 hex max (not full pace). The passer cannot be moved during this step.

### Claude's Discretion

- BUG-03 slot-boundary logic: whether a HEADER_ACCURACY_ACK event counts as a slot boundary (use existing SLOT_ADVANCE / DICE_ROLL lock logic as written — no new boundary type needed).
- MOVE-06 test coverage for zero eligible players (empty final third) — FREE_MOVE phase should immediately return to PASS if no eligible players exist.

### Offside Rule (Addendum — gathered 2026-06-20, new scope added to Phase 17 after initial close-out)

New rule, no formal requirement ID yet — assign one (e.g. `OFFSIDE-01`) when planning and add it to `REQUIREMENTS.md` and ROADMAP.md's Phase 17 `Requirements:`/success-criteria list.

- **D-21 (trigger):** A player is flagged offside when, at end of phase, all three hold: (1) past half field in their team's attacking direction (home attacks toward q>36 side, i.e. q>18; away attacks toward q<0 side, i.e. q<18 — mirrors the existing `kickOffHex.q=18` half-boundary convention at gameEngine.ts:2999-3001), (2) ahead of the ball in that same direction, and (3) the count of opposing-team pieces (any role, GK included) positioned equal-to-or-ahead of this player (same direction) is ≤1.
- **D-22 (clear):** The flag clears when the player ends a turn either (a) equal-to-or-behind the ball, or (b) with ≥2 opposing pieces equal-to-or-ahead of them. This is the logical complement of D-21, evaluated the same way.
- **D-23 (persistence — STICKY):** Once flagged, a player stays flagged across subsequent end-of-phase checks until D-22's clear condition is actually satisfied — this is NOT a fresh per-phase recompute. Requires a per-piece boolean (or id-set) field on `GameState`, re-evaluated and updated at every phase-end, not derived ad hoc at render time.
- **D-24 (scope — ALL players, team-relative):** The check applies to every piece on the pitch, not just the attacking team's outfielders. For a given player P on team T, "ahead"/"behind"/"defenders" are all relative to T's attacking direction, and "defenders" means pieces on the OTHER team (relative to P), any role, GK included. A defending-team player can also be flagged if they push forward of the ball and their own opponents (now playing the "defender" role relative to them) leave them with ≤1 covering piece.
- **D-25 (visual marker):** A flagged piece renders a double-width red circle (an additional ring around the piece token, distinct from and independent of `selectionState` — a piece can be simultaneously offside and selectable/selected). Mirror PieceOverlay.tsx's existing ring pattern (e.g. `selectionState==='active'` green ring at PieceOverlay.tsx:240-246) but as a separate boolean-driven layer, not folded into `selectionState`.
- **D-26 (consequence):** If a flagged-offside player gains possession of the ball — including winning a header — a free kick is triggered immediately.
- **D-27 (foul spot):** The free kick is taken from the offside player's position at the moment the foul triggers (not the ball's position).
- **D-28 (possession):** Possession goes to the team NOT committing the foul (i.e., the opposing team of the flagged player).
- **D-29 (repositioning):** Both teams may reposition their entire squad anywhere on the board before the kick (mirror `KICK_OFF_SETUP`'s both-teams-place-pieces pattern, gameEngine.ts `applyKickOffReady` ~2997-3040, but with different zone rules — see D-30/D-31, not the kickoff own-half restriction).
- **D-30 (defender zone restriction):** The defending team (relative to the kicking team) cannot place any piece within 2 hexes of the ball's restart position.
- **D-31 (kicker requirement):** The kicking team must have exactly one player positioned on the ball's hex before the kick can be taken (mirrors the kickoff centre-hex-occupancy check, `CENTRE_HEX_EMPTY` guard, gameEngine.ts ~3038).
- **D-32 (action set):** From the free kick, the only legal actions are STANDARD_PASS, HIGH_PASS, LONG_BALL, and SHOT (the last only if the kicker is in shooting range). No MOVE, no other action types.

#### Claude's Discretion (Offside)

- Exact GamePhase name(s)/count for the free-kick flow (e.g. a single `FREE_KICK_SETUP` mirroring `KICK_OFF_SETUP`, or split setup/execution phases) — follow whichever existing restart-phase pattern (KICK_OFF_SETUP vs GK_RESTART) fits best once the planner has read both.
- Exact new `GameState` field name/shape for offside-flag tracking (e.g. `offsidePieceIds: string[]`) and for the free-kick restart spot/team (e.g. `freeKickHex`, `freeKickAttackingTeam`).
- Whether offside is checked at every single phase-end transition project-wide, or only at end-of-MOVEMENT-equivalent phases where piece positions can change — use judgment grounded in where pieces can actually move, to avoid needless checks in phases with no movement (e.g. dice-roll-only phases).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` — BUG-01..05, MOVE-06, PASS-02 requirement text (authoritative definitions)
- `.planning/ROADMAP.md` §Phase 17 — Success criteria and dependency notes

### Existing Implementation (read before modifying)

- `packages/server/src/gameEngine.ts` — `applyPass` (pass handler, interception loop), `applyEndTurn` (slot advance → phase transition), `applyUndo` (slot-boundary logic), `applyMove` (pendingFreeMove scaffolding at line 556–566), GK-save → LOOSE_BALL transition
- `packages/shared/src/types.ts` — `GamePhase` union type, `GameState.pendingFreeMove`, `GameState.lastActionType`
- `packages/shared/src/actionSequence.ts` — `ELIGIBLE_NEXT_ACTIONS` (needs FREE_MOVE entry)
- `packages/client/src/components/ActionPanel.tsx` — MOVEMENT phase render (Undo + End Turn buttons, add Cancel here), PASS phase step flow (add new attacker-1-hex step for FIRST_TIME_PASS)
- `packages/client/src/components/HexGrid.tsx` — `isHeaderPass` guard (line 322–325, already done), pass-path highlight logic (extend for FIRST_TIME_PASS attacker step + SNAP_DEFLECT)

### Prior Phase Decisions Relevant Here

- Phase 11 CONTEXT.md §RULE-01 — header accuracy roll and HEADER phase sequencing (BUG-01 must not touch this)
- Phase 10 CONTEXT.md §Decisions Locked (Plan 04) — `SNAP_DEFLECT` phase, `snapDeflectMovedPieceId` + `snapDeflectPaceUsed` on GameState (PASS-02 reuses this phase)
- Phase 8 CONTEXT.md §Decisions Locked — `applyEndTurn`, `SLOT_ADVANCE` events, `applyUndo` lock logic (BUG-03, MOVE-06 must stay consistent)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `applyUndo` (gameEngine.ts:784): extend to accept `HIGH_PASS_MOVEMENT` phase — minimal change, same boundary logic
- `SNAP_DEFLECT` phase (gameEngine.ts): fully implemented; reuse for PASS-02 defender move by checking `lastActionType === 'FIRST_TIME_PASS'` at resolution
- `snapDeflectMovedPieceId` / `snapDeflectPaceUsed` on `GameState`: already track defender movement in SNAP_DEFLECT — reuse directly
- `pendingFreeMove` field on `GameState` (types.ts:352): already set by `applyMove` when ball carrier crosses thirds; `applyEndTurn` just needs to consume it

### Established Patterns

- Phase transitions via return values from `applyX` functions — all fixes follow existing server-authoritative pattern
- `WRONG_PHASE` guard at top of each apply function — add `FREE_MOVE` to any handler that operates in that phase
- `isActivePlayer` / `isActiveTeam` gating in ActionPanel — Cancel button follows same `isActivePlayer` guard
- `lastActionType` discrimination for phase resolution — already used by HEADER to skip ZoI risk; PASS-02 uses same pattern for SNAP_DEFLECT

### Integration Points

- `game:cancel_movement` (new socket event): server handler calls `applyCancelMovement`; must be typed in shared `ClientToServerEvents`
- `FREE_MOVE` phase: needs `GamePhase` union extension + `ELIGIBLE_NEXT_ACTIONS` entry + server handler (`applyFreeMove`) + `game:free_move` socket event + client ActionPanel render branch
- PASS-02 attacker step: new sub-state within PASS phase — either a new `GameState` flag (e.g., `firstTimePassPath: HexCoord[] | null`) or tracked via `passTargetHex` + `lastActionType` combination

</code_context>

<specifics>
## Specific Ideas

- PASS-02 should feel like the SNAP_DEFLECT interaction — defender sees a highlighted path and tries to step onto it. Same visual language already exists.
- For MOVE-06, if no outfield players are in the opponent's final third when FREE_MOVE fires, immediately advance to PASS (no UI shown). Don't surface an empty panel.
- Cancel in MOVEMENT phase: label it "← Cancel" (same style as existing `← Back` button in PASS step 2) and position it below End Turn.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 17-rule-bugs_
_Context gathered: 2026-06-14_
