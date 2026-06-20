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

- **D-12 (SUPERSEDED 2026-06-20):** ~~The free move fires after the MOVEMENT phase ends (End Turn), keyed off `state.pendingFreeMove` set when the ball carrier crosses thirds during a move.~~ Wrong trigger model — user correction against the physical rulebook during the 17-04 checkpoint review: the rule is ball-position-based ("ball is in one final third and any action has come to an end"), not carrier-crossing-during-MOVEMENT-based. See D-33.
- **D-13 (SUPERSEDED 2026-06-20):** ~~Eligible pieces are outfield players of the crossing team already in the opponent's final third.~~ Wrong eligibility — rule is "all players [both teams, GK included] in the opposite final third [from the ball]," not one team's outfielders. See D-34.
- **D-14 (SUPERSEDED 2026-06-20):** ~~`FREE_MOVE` ends (transitions to `PASS`) on a single End Turn.~~ Replaced by the two-sub-phase sequencing in D-35 ("attacking team moves first").
- **D-15 (SUPERSEDED 2026-06-20):** ~~The `FREE_MOVE` phase inherits `attackingTeam`/`activeTeam` from the MOVEMENT phase that produced it (same team that crossed thirds takes the free move).~~ Wrong — both teams take a free move (attacking first, then defending); see D-35.
- **D-16 (SUPERSEDED 2026-06-20):** ~~Add a single `'FREE_MOVE'` phase to the `GamePhase` union.~~ Replaced by the two-phase union in D-38.

**Corrected rule (verified against the physical rulebook, 2026-06-20):** "If the ball is in one final third and any action has come to an end, all players in the opposite final third get a free move of 6 hexes each. Attacking team moves first."

- **D-33 (trigger):** Track `ballZone: 'home' | 'middle' | 'away'` on `GameState` (home = q≤10, middle = q 11-25, away = q≥26 per `PITCH_REGIONS`). The check runs centrally in `broadcastState` (`roomStore.ts`) — the single ARCH-04 entry point already called after every validated action — comparing the post-action ball position's zone against the stored `ballZone`. The trigger fires only when the new zone differs from the stored zone **and** the new zone is `'home'` or `'away'` (entering a final third fresh, from any prior zone — including a direct home↔away change with no intervening middle-third action). No retrigger while the ball stays in the same final third across subsequent actions; the flag resets (next entry becomes "fresh" again) once the ball's zone changes to anything else. `ballZone` initializes to `'middle'` at kickoff (center hex is in `middleThird`).
- **D-34 (eligibility):** When the trigger fires with the ball's new zone Z, the "opposite final third" is the other final third (Z='away' → opposite='home', and vice versa). Eligible pieces are **all pieces of both teams, including goalkeepers**, currently positioned in the opposite final third. Each eligible piece independently gets up to 6 hexes — not a shared pool.
- **D-35 (sequencing):** Two sequential sub-phases enforce "attacking team moves first": `FREE_MOVE_ATTACK` (current `state.attackingTeam`'s eligible pieces only; ends on that team's End Turn) → `FREE_MOVE_DEFENSE` (the other team's eligible pieces only; ends on End Turn) → resume phase (D-36). Both teams' eligible-id sets are computed once, up front, at trigger time (positions are snapshotted at the moment of entry — a piece that moves out of the opposite third during its own team's sub-phase doesn't affect the other team's already-computed eligible list).
- **D-36 (resume phase):** Because the trigger can fire after _any_ resolved action (not just a MOVEMENT End Turn), add `freeMoveResume: { phase: GamePhase; activeTeam: 'home' | 'away' } | null` to `GameState` — captures both the phase AND `activeTeam` the triggering action had already computed as "next," since `activeTeam` is dynamic (D-30/HIGH_PASS_MOVEMENT) and the overlay must not lose it. When the trigger fires, snapshot `{ phase: state.phase, activeTeam: state.activeTeam }` into `freeMoveResume`, then overwrite `phase` with `'FREE_MOVE_ATTACK'` (or `'FREE_MOVE_DEFENSE'` if the attack list is empty) and `activeTeam` with the team whose sub-phase is starting (so the existing `actingTeam(state) = state.activeTeam` gating in gameHandlers.ts needs no changes). When `FREE_MOVE_DEFENSE` ends (or is skipped because its eligible list was empty), restore `phase`/`activeTeam` from `state.freeMoveResume`, then clear `freeMoveResume`/`freeMoveEligibleIds`/`freeMoveUsedPace`. Leave `ballZone` itself set to the zone that fired the trigger (so it doesn't immediately refire).
- **D-37 (non-interruptible phases — Claude's discretion):** The trigger must not fire (or must be deferred) while `phase` is `HALF_TIME`, `FULL_TIME`, or already one of `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`. Implementer's call on the exact guard list and whether any other restart/formation phase (e.g. `KICK_OFF` pre-match setup) needs the same exemption — default to exempting only phases where there is no sensible "resume phase" to return to.
- **D-38 (types):** `GamePhase` union replaces `'FREE_MOVE'` with `'FREE_MOVE_ATTACK' | 'FREE_MOVE_DEFENSE'`. `GameState` drops `pendingFreeMove` (carrier-cross detection no longer used) and gains `ballZone: 'home' | 'middle' | 'away'` (always present, not optional), `freeMoveResume: { phase: GamePhase; activeTeam: 'home' | 'away' } | null` (D-36), and an eligible-ids shape that can hold both teams' precomputed lists (`freeMoveEligibleIds: { attack: readonly string[]; defense: readonly string[] } | null`); `freeMoveUsedPace` keyed by piece id is shared across both sub-phases and reset at trigger time.

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
- MOVE-06 test coverage for zero eligible players (empty final third), evaluated per sub-phase under the corrected D-33..D-38 design: if `FREE_MOVE_ATTACK`'s eligible list is empty, skip straight to `FREE_MOVE_DEFENSE`; if that's also empty, skip straight to `freeMoveResumePhase`. Each sub-phase is independently skippable — no empty panel for either.

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
- ~~Whether offside is checked at every single phase-end transition project-wide, or only at end-of-MOVEMENT-equivalent phases where piece positions can change~~ — RESOLVED by user correction during the 17-05 checkpoint review; see D-39.

### Offside Rule — Corrections (gathered 2026-06-20, during 17-05 checkpoint review)

Plan 17-05 implemented D-21..D-24 by re-evaluating offside at every MOVEMENT phase-end return in `applyEndTurn`, including the two intermediate slot-to-slot transitions (ATTACKER_4→DEFENDER_5, DEFENDER_5→ATTACKER_2). The user corrected this against the physical rulebook:

- **D-39 (evaluation timing — refines D-23, resolves the open Claude's-Discretion question):** Offside is evaluated (sticky `evaluateOffside`) ONLY at: (a) the true end of the MOVEMENT phase — the `nextSlot === null` returns in `applyEndTurn` (HALF_TIME/FULL_TIME, GK_RESTART, and the normal ATTACKER_2→PASS return) — NOT at the two intermediate slot-to-slot returns (ATTACKER_4→DEFENDER_5, DEFENDER_5→ATTACKER_2), which must have the evaluation removed; (b) a "break in play" — a successful tackle or steal, which ends MOVEMENT early via the two `phase: 'PASS'` early-return branches inside `applyMove` itself (currently ~lines 622-646 and ~666-691, search "Phase ends immediately" comments) — these currently have NO offside evaluation at all; add it; (c) `applyFreeMoveEnd`'s exit transition (already implemented correctly in plan 17-04/17-05 — no change needed).
- **D-40 (clear condition refined — refines D-22a):** The ball-position clear condition (D-22's "(a) equal-to-or-behind the ball") only applies when the ball is in possession (`state.ball.carrierId !== null`) by either team. While the ball is loose (`carrierId === null`), ONLY D-22's condition (b) (≥2 opposing pieces equal-to-or-ahead) can clear a flag — a loose/bouncing ball's position cannot reprieve an offside player. D-21's trigger condition (2) ("ahead of the ball") is UNCHANGED — it still uses raw ball position regardless of possession; only the clear/reset side gets this added guard.
- **D-41 (foul trigger expanded — extends D-26, applies to plan 17-06/OFFSIDE-02, not yet executed):** The free-kick foul (D-26..D-32) also triggers when a flagged-offside player REDIRECTS the ball during a contesting action — header, deflection, steal, or tackle — even if the action does not end with that player in clean possession afterward (e.g. they deflect/touch the ball mid-contest and it ends up elsewhere). Not just "gains possession" (D-26's original wording). Same consequence as D-26 — a free kick from the foul spot per D-27..D-32. Confirmed via clarifying question: "penalty" in the user's correction is figurative for this existing foul/free-kick consequence, NOT a literal penalty-kick mechanic — there is no separate penalty-kick phase to build.

### Free Kick Setup — Corrections (gathered 2026-06-20, during 17-06 checkpoint review)

- **D-42 (visual marker size — corrects D-25):** ~~The offside ring is double-width (`strokeWidth=5`).~~ Wrong — the ring should be the SAME stroke width as the other selection rings (2/2.5), not double. Keep the ring at a distinct radius (`PIECE_RADIUS + 6`, outside the other rings) so it remains visible as its own layer when stacked with a selection ring, but reduce `strokeWidth` to 2.5 to match.
- **D-43 (full reset on free kick taken — extends D-26/D-28):** `triggerOffsideFoul` (D-26) only removes the OFFENDING piece from `offsidePieceIds`, leaving any other already-flagged pieces sticky. User correction: when the free kick is actually TAKEN (the `GAME_FREE_KICK_READY` both-ready transition to `PASS`), reset `offsidePieceIds` to `[]` entirely — a major dead-ball restart clears all offside positions, not just the offender's.
- **D-44 (help text colour — pure CSS bug, no rule change):** `FreeKickSetupPanel.module.css`'s `.constraintRow` class has no `color` set, inheriting an unreadable dark default against the panel's dark background (`#16213e`). Fix: set `color: #e0e0e0` (matching the panel's own `.panelHeading`, the established light-text-on-dark-background token in this component family). The orchestrator found the identical bug in `KickOffSetupPanel.module.css` (FreeKickSetupPanel was cloned from it) — fix both for consistency, even though the user only reported the free-kick instance.
- **D-45 (placement highlight colour + accuracy):** During `FREE_KICK_SETUP`, valid placement hexes currently render with the generic yellow "safe" tint (the same one normal movement uses) because the highlight-type derivation in `HexGrid.tsx` only special-cases `KICK_OFF_SETUP`'s zone as the light-blue "kickoff" tint. Correction: `FREE_KICK_SETUP`'s valid placement hexes should ALSO use the light-blue "kickoff" tint (`HexHighlightType: 'kickoff'`, `rgba(59,130,246,1)` — already defined in `HexCell.tsx`, no new colour). Additionally, the highlighted (and actually clickable) hex set must match server truth per team, not just "all unoccupied pitch hexes" — see D-46 for the defending team's exclusions, which the light-blue highlight must respect (don't show a hex as available if `applyFreeKickReady` would reject it).
- **D-46 (REVERTED 2026-06-20):** ~~In addition to D-30's 2-hex exclusion, the defending team may not position any piece behind the ball.~~ User: "the implementation doesn't work as expected... undo this change" — this rule does not exist in the physical rulebook. Fully reverted: remove `DEFENDER_BEHIND_BALL` from `applyFreeKickReady` and the matching client-side exclusion entirely. The defending team's only placement restriction is D-30 (the 2-hex zone) — see D-50 below for the corrected staged-sequence enforcement model.

### Free Kick Setup — Rulebook Correction (gathered 2026-06-20, after the user reviewed the physical rulebook's "streamlined movement phase")

The free-kick repositioning mechanic built for plan 17-06 (D-29: both teams simultaneously reposition their entire squad anywhere on the board, then both press Ready) is WRONG. The actual rule, quoted by the user from the rulebook:

> Any opponents within 2 hexes of the ball must be moved 2 CLEAR hexes away from the ball.
> Select the player you want to take the kick and position them and the ball where the foul was committed.
> You and your opponent may now reposition players like so:
> • Attacking team picks up and places 5 players. (4 for any field player, 1 spot for goalie)
> • Defending team picks up and places 5 players. (4 for any field player, 1 spot for goalie)
> • Attacking team picks up and places 3 players.
> • Defending team picks up and places 2 players.

- **D-47 (offside exemption on restart — new rule, also affects kick-off; throw-in noted for when it's eventually built):** A player cannot be flagged/remain-flagged offside as a direct result of a kick-off or free-kick restart. Implementation: reset `offsidePieceIds` to `[]` at the moment ANY restart-from-setup concludes and the ball is put back into live play — this generalizes D-43 (already does this for the free-kick restart) to ALSO apply to the kick-off restart (`GAME_READY`'s both-ready transition to `KICK_OFF`, in `gameHandlers.ts` — currently does not touch `offsidePieceIds` at all, a latent gap predating OFFSIDE-01/02). When throw-ins are eventually built, their restart transition must do the same — noted here for that future plan, not implemented now (no throw-in phase exists yet).
- **D-48 (persistent geometric highlight, not selection-gated — corrects the 17-06 corrections-round D-45 fix):** D-45's fix made the free-kick placement zone light up blue only via `isValidMove`/`validMoveHexes`, which the store only populates once a piece is selected — so the zone was invisible until the user clicked a piece, unlike `KICK_OFF_SETUP`'s zone (`isInMyKickOffZone(hex)`), which is a pure per-hex geometric function of `hex`/`myTeam`/`attackingTeam`/phase, evaluated and rendered for EVERY hex on EVERY render regardless of selection. Correct fix: add an analogous `isInMyFreeKickZone(hex)`-style geometric check (current team + current stage's legality, NOT tied to `validMoveHexes`) so the placement zone is always visible and to determine, independent of selection state. This also fixes "allow free player movement... not just on player selection" — the zone's clickability (not just its highlight) should not require a piece to already be selected first; clicking an empty valid hex while a piece IS selected still moves it there (unchanged interaction model), but the VISUAL zone itself is no longer selection-gated.
- **D-49 (staged alternating repositioning — replaces D-29's simultaneous-both-teams model):** After the ball/kicker placement (unchanged — D-31, the kicking team puts exactly one of their pieces on `freeKickHex`; the ball is already auto-placed there by `triggerOffsideFoul`), repositioning proceeds in four fixed, alternating stages, each ending via that team's own End-Turn-equivalent action (mirrors the already-built `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` "up to N, optional, ended by End Turn" pattern from plan 17-04 — confirmed via clarifying question, NOT a mandatory-exact-count requirement):
  1. Kicking team ("attacking team" in the rulebook's terms — the side awarded the kick, D-28) repositions up to 5 of its own pieces anywhere on the board (D-29 — no zone restriction for the kicking team).
  2. Conceding team ("defending team" — the side that committed the offside foul) repositions up to 5 of its own pieces, excluding D-30's 2-hex zone (see D-50).
  3. Kicking team repositions up to 3 more of its own pieces, anywhere on the board.
  4. Conceding team repositions up to 2 more of its own pieces, excluding D-30's 2-hex zone (see D-50).
     After stage 4 ends, the kick is taken: validate D-31 (handled at the end of stage 3, the kicking team's LAST turn — see D-51), transition to `PASS` with the kicker as carrier, `freeKickAttackingTeam` in possession, `lastActionType: 'FREE_KICK_RESTART'`, `offsidePieceIds: []` (D-47/D-43), and clear the free-kick tracking fields. Per-stage "up to N" placements are NOT required to be used — a team may end its stage having placed 0..N of its pieces.
- **D-50 (2-hex exclusion enforced continuously — refines D-30, not superseded):** D-30's "defending team must stay >2 hexes from the restart hex" rule still holds, but is now checked at the end of EACH of the conceding team's two stages (stage 2's "place up to 5" and stage 4's "place up to 2") rather than at a single simultaneous Ready button — a stage-ending attempt is rejected (`DEFENDER_TOO_CLOSE`) if any of that team's pieces (moved or not) is still within 2 hexes of `freeKickHex` at that moment.
- **D-51 (SUPERSEDED 2026-06-20):** ~~D-31's kicker-hex check is validated when the kicking team attempts to end their LAST stage (stage index 2).~~ Wrong order — see D-54: the kicker must be placed FIRST, before stage 0's general repositioning even opens up, not deferred to the end.

### Free Kick Setup — Round 2 Corrections (gathered 2026-06-20, after a second live playtest)

- **D-52 (SUPERSEDED 2026-06-20 — broadened):** ~~If the piece that WINS a HEADER duel is already flagged offside, skip target-selection and trigger the foul immediately.~~ Too narrow — user correction: "If header is contested by an offside player go directly to the free kick." It is not about who wins; merely CONTESTING a header while offside-flagged is itself the foul, regardless of duel outcome. See D-57.
- **D-53 (auto-relocate trapped defenders before setup begins):** When `triggerOffsideFoul` transitions to `FREE_KICK_SETUP`, before stage 0 (the kicking team's first turn) becomes interactive: for every CONCEDING-team piece that is within 2 hexes of the new `freeKickHex` (the same threshold as D-30/D-50), automatically relocate it to a random unoccupied pitch hex that is ≥3 hexes from `freeKickHex` (server-generated via `crypto.randomInt`, never `Math.random` — mirrors the existing `attackingTeam` coin-flip pattern in `createInitialState`; this is a one-time, non-test-critical randomization, not a dice-injection context, so direct `crypto.randomInt` use inside the engine function is consistent with existing code, not a violation of the "dice are injected" pitfall which applies to gameplay dice rolls specifically). Process trapped pieces one at a time so each relocation accounts for hexes already taken by earlier relocations in the same pass (no two pieces land on the same hex). This removes the burden of manually walking already-too-close defenders out of the zone during their own stage — they start the encounter already legal; the defending team may still freely reposition ANY of its pieces (including the auto-moved ones) during their own stages.
- **D-54 (mandatory kicker-first placement, kicker locked immediately — supersedes D-51):** Stage 0 (the kicking team's first turn) begins with a MANDATORY sub-step: the kicking team must move one of its own pieces onto `freeKickHex` before they are permitted to move ANY other piece (an attempt to move a different piece while no kicking-team piece is yet on `freeKickHex` is rejected — there is no other legal move available until the kicker is placed). The kicker placement does NOT consume any of stage 0's "up to 5" budget — it is a separate, free, mandatory first action. The instant a kicking-team piece lands on `freeKickHex`, it becomes permanently locked for the remainder of free-kick setup (added to `movedPieceIds`, rendering the existing orange 'activated' ring — same mechanism as D-39's MOVE-06 abandonment tracking, no new client rendering needed for this part) — "kicker cannot be moved." Only after the kicker is locked does the general up-to-5 budget become available for the kicking team's OTHER pieces.
- **D-55 (green "moved this stage" highlight, distinct from the permanent orange 'activated' state):** While a stage is in progress, any piece already counted in `freeKickPlacedPieceIds` (i.e., it has used one of the stage's placement slots but can still be freely re-positioned without cost, per the existing "up to N, optional, re-placement is free" rule) renders with a green highlight, visible for the whole stage — not just momentarily while selected. This is a NEW, persistent, independent visual layer (mirror the `isOffside` red-ring pattern: an additional boolean-driven `<circle>`, not folded into the `selectionState` switch, so it can coexist with `selectable`/`active`/`activated`/`isOffside`). Purpose: let the player see at a glance which pieces are "already spent a slot, but still movable for free" versus which are still untouched (moving an untouched piece will consume a new slot from the remaining budget). Reuse the green already established for the 'active' selection ring (`#22c55e`) for visual consistency, at a radius that doesn't collide with the other rings.
- **D-57 (header CONTESTED by an offside player — supersedes D-52, broader trigger):** The foul check happens at the moment BOTH teams' header contestants are nominated and confirmed (`GAME_HEADER_CONTESTANT`'s `bothConfirmed` branch in `gameHandlers.ts`), BEFORE dice are rolled and BEFORE `computeHeaderDuelWinner` is called — not after the duel resolves. Check the FULL combined nominated-contestant list (`updatedContestants.home` concatenated with `updatedContestants.away`) for ANY id present in `offsidePieceIds`. If found: skip rolling dice and skip `computeHeaderDuelWinner`/the win/tie branches entirely — immediately call the same foul-trigger path (`applyOffsideFoulWithRelocation`, D-53) using that contestant's id, regardless of whether they would have won, lost, or tied the duel. Only if NO nominated contestant on either side is offside-flagged does the duel proceed normally (roll dice, resolve winner/tie, etc. — unchanged). If multiple nominated contestants happen to be flagged (rare — typically at most one realistic candidate per side), use the first one found, scanning home's list then away's, in nomination order — not specified by the rulebook, documented here as the deterministic tiebreak.
- **D-56 (moved pieces lock in as 'activated' when the stage ends):** When a stage's End-Turn-equivalent action succeeds (advancing to the next stage, or finalizing the kick after the last stage), merge that stage's `freeKickPlacedPieceIds` into `movedPieceIds` before resetting `freeKickPlacedPieceIds` to `[]` for the next stage — this converts the green "moved this stage" highlight (D-55) into the existing orange 'activated' ring for the rest of free-kick setup, via the SAME generic `movedPieceIds.includes(piece.id)` rendering path already used everywhere else (MOVEMENT, MOVE-06) — no new client rendering logic, just feeding the existing mechanism. Pieces a team chose NOT to move this stage are unaffected (they remain selectable in a LATER stage if that team gets another turn, e.g. the kicking team's stage-0-then-stage-2 split) — only pieces actually touched this stage get locked.

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
