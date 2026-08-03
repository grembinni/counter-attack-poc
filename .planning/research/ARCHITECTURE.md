# Architecture Research — v1.6 Fouls, Cards & Restarts Integration

**Domain:** Server-authoritative real-time hex-board game FSM (Node.js/Socket.io + TypeScript monorepo)
**Researched:** 2026-08-03
**Confidence:** HIGH — every finding below is grounded in the current committed source (file:line citations), not general framework guidance. No external ecosystem research was needed for this question.

> Note: This file supersedes the v1.5 architecture research previously written to this path (chrome design tokens, hex-highlight standardization, cleanup track). That milestone shipped 2026-08-03; its decisions are already built and are unaffected by this milestone. See git history for the prior v1.5 content if needed. This document covers the v1.6 (Fouls, Cards & Restarts) FSM-integration question only.

This document answers one specific integration question for the v1.6 milestone: **how do fouls, bookings, injuries, substitutions, and the new out-of-bounds restart set (goal kick / corner kick / throw-in) fit into the existing `gameEngine.ts` FSM / `GamePhase` union / `gameHandlers.ts` wiring** — using the real `FREE_KICK_SETUP` staged-repositioning implementation as the reference pattern, not a hypothetical one.

## Current System Overview (as built, not assumed)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  packages/client (React 18 + Zustand)                                    │
│  GameBoard.tsx dispatches to ONE panel component per GamePhase:          │
│  KICK_OFF_SETUP → KickOffSetupPanel | FREE_KICK_SETUP → FreeKickSetupPanel│
│  REPLAY → ReplayPanel | everything else → ActionPanel (generic)          │
│  (GameBoard.tsx:328-336)                                                  │
├──────────────────────────────────────────────────────────────────────────┤
│  Socket.io transport — full-state broadcast after every validated action │
├──────────────────────────────────────────────────────────────────────────┤
│  packages/server/src/gameHandlers.ts (2647 lines)                        │
│  One socket.on(...) handler per client event. EVERY handler:             │
│    1. room.isProcessing mutex guard (SC-5)                               │
│    2. phase / team / payload validation                                  │
│    3. delegates to a pure gameEngine.ts apply* function                  │
│    4. room.gameState = result.state; broadcastState(io, room)            │
│    5. isProcessing = false in `finally`                                  │
│  Some handlers gate on a hardcoded GamePhase[] allow-list, not on        │
│  ELIGIBLE_NEXT_ACTIONS (see applyUndo's `validUndoPhases`, line 1130).   │
├──────────────────────────────────────────────────────────────────────────┤
│  packages/server/src/gameEngine.ts (4747 lines) — pure, socket-free FSM  │
│  ~20 exported `apply*(state, ...) → { ok: true, state } | { ok:false }`  │
│  functions. GamePhase (types.ts:403-430) is the discriminant. Sequencing │
│  across a full action (not within one phase) is enforced by              │
│  ELIGIBLE_NEXT_ACTIONS[LastActionType] (actionSequence.ts), imported by  │
│  both server (enforcement) and client (button disabling).                │
├──────────────────────────────────────────────────────────────────────────┤
│  packages/shared/src/types.ts — GameState is ONE flat object. Phase-     │
│  scoped fields are optional (`freeKickHex?`, `gkKickTargetHex?`, etc.)   │
│  and are set on phase-entry, read during the phase, cleared on phase-    │
│  exit. There is no per-phase sub-state namespacing — it's one big        │
│  struct with ad-hoc optional fields, one cluster per phase family.       │
└──────────────────────────────────────────────────────────────────────────┘
```

## Q1 — Do 3+ new multi-stage restart phases + a foul/booking/injury chain fit the current `GamePhase` union cleanly, or does it need a sub-phase/stage-index pattern?

**Answer: the stage-index pattern (already proven by `FREE_KICK_SETUP`) is the right shape to reuse — but reuse the _pattern_, not the _fields_. Copy-pasting `freeKickHex`/`freeKickStageIndex`/`freeKickPlacedPieceIds`/`freeKickKickerChosen` three more times (once per new restart type) is exactly the failure mode to avoid.**

### How `FREE_KICK_SETUP` actually works today (the reference implementation)

- `GamePhase` has exactly **one** member for the whole multi-stage sequence: `'FREE_KICK_SETUP'` (`types.ts:427`).
- Staging is carried entirely in **GameState scalar fields**, not in the phase union:
  `freeKickHex`, `freeKickAttackingTeam`, `freeKickStageIndex: 0|1|2|3|null`, `freeKickPlacedPieceIds`, `freeKickKickerChosen` (`types.ts:961-997`).
- The stage _table_ itself — which team acts, how many pieces, in what order — lives in one small, pure, importable constant: `FREE_KICK_STAGES` in `packages/shared/src/offside.ts:38-43` (`[{side:'kicking',max:4},{side:'defending',max:4},{side:'kicking',max:3},{side:'defending',max:2}]`), plus a resolver `freeKickStageTeam(stageIndex, kickingTeam)` (`offside.ts:49-56`).
- Two engine functions drive the whole sequence: `applyFreeKickMove` (`gameEngine.ts:4133-4285`, per-piece reposition + budget/lock checks) and `applyFreeKickReady` (`gameEngine.ts:4344-4441`, stage-advance-or-finalize). Both are phase-guarded on the single `'FREE_KICK_SETUP'` phase and read the stage table by index — **the stage count and per-stage rules are data, not new phase values or new functions.**
- Entry point (`triggerOffsideFoul`, `offside.ts:191-237`) is trigger-agnostic in _naming_ already: every field is `freeKick*`, not `offside*`. This was a lucky (or deliberate) choice — it means a **foul-triggered** free kick can reuse this exact machinery unchanged (see build-order note below).

### Why copy-pasting this pattern 3x for GOAL_KICK/CORNER_KICK/THROW_IN is the wrong move

Each of the three new restarts has **different stage counts, different team-ordering, different sub-steps** (goal kick likely needs no opponent repositioning at all; corner kick needs box positioning _and_ a header contest; throw-in needs sideline-adjacent placement and an offside carve-out). If each gets its own `goalKickHex`/`goalKickStageIndex`/`cornerKickHex`/`cornerKickStageIndex`/`throwInHex`/`throwInStageIndex` field cluster plus its own `applyGoalKickMove`/`applyCornerKickMove`/`applyThrowInMove` functions, you get 3x the field surface, 3x the undo-boundary bookkeeping (`applyUndo`'s boundary scan already special-cases `FK_STAGE_ADVANCE`/`FK_KICKER_CHOSEN`, `gameEngine.ts:1401-1611` region), and 3x the `GameBoard.tsx` panel wiring — for logic that is structurally identical (pick up N pieces, place them, advance stage, finalize).

### Recommended shape

Generalize the _staging mechanism_ into one reusable module, parameterized by a restart "kind," while keeping `GamePhase` additions minimal and phase-specific for the _player-facing_ sub-steps that genuinely differ per restart type. Concretely:

1. **Keep `GamePhase` additions to one entry per restart type that needs distinct client UI**, not one per internal stage: `GOAL_KICK_SETUP`, `CORNER_KICK_SETUP`, `THROW_IN_SETUP` (mirrors `FREE_KICK_SETUP` — one phase value covers the whole multi-stage sequence for that restart type). If a restart also needs a header sub-contest (corner kick), that's a _separate_, already-existing phase (`HEADER`, `types.ts:413`) reached via a normal phase transition at the end of the staged setup — not a new stage index inside the setup phase. This mirrors how `FREE_KICK_SETUP`'s stage 3 finalizes into the pre-existing `PASS` phase (`gameEngine.ts:4417-4440`) rather than inventing a 5th stage.
2. **Replace the 5 free-kick-specific scalar fields with one generic, reusable slice** shared by all four staged-restart types (free kick, goal kick, corner kick, throw-in):
   ```ts
   type RestartSetupState = {
     kind: 'FREE_KICK' | 'GOAL_KICK' | 'CORNER_KICK' | 'THROW_IN';
     anchorHex: HexCoord; // was freeKickHex
     kickingTeam: 'home' | 'away'; // was freeKickAttackingTeam
     stageIndex: number;
     placedPieceIds: readonly string[];
     kickerChosen: boolean;
   } | null;
   // GameState.restartSetup: RestartSetupState
   ```
   and one generic stage table lookup keyed by `kind`:
   ```ts
   const RESTART_STAGES: Record<RestartSetupState['kind'], readonly StageConfig[]> = {
     FREE_KICK: FREE_KICK_STAGES, // unchanged, still offside.ts's existing table
     GOAL_KICK: GOAL_KICK_STAGES, // new, likely 1 stage or none — see Q1 build note
     CORNER_KICK: CORNER_KICK_STAGES, // new
     THROW_IN: THROW_IN_STAGES, // new
   };
   ```
   `applyFreeKickMove`/`applyFreeKickReady` become `applyRestartSetupMove`/`applyRestartSetupReady`, generic over `kind`, reading `RESTART_STAGES[state.restartSetup.kind]` instead of the hardcoded `FREE_KICK_STAGES` import. This is a **refactor of existing code**, not just new code — flag it as a distinct task in the roadmap (touches `gameEngine.ts:4133-4441`, `offside.ts`, every `ActionEvent` of type `FK_SETUP_MOVE`/`FK_KICKER_CHOSEN`/`FK_STAGE_ADVANCE`, and the `validUndoPhases` array at `gameHandlers.ts:1130`).
3. **`GOAL_KICK` does not need this machinery at all — reuse the existing `GK_RESTART`/`GK_KICK_TARGET`/`GK_KICK_MOVE` chain instead.** See the dedicated finding below; this cuts the "3 new restart types" down to genuinely 2 new staged flows (corner kick, throw-in), not 3.
4. **`ActionEvent` additions**: rename/generalize `FK_SETUP_MOVE`/`FK_KICKER_CHOSEN`/`FK_STAGE_ADVANCE` (`types.ts:379-399`) into kind-carrying variants (add a `restartKind` field) rather than adding 9 new near-duplicate event types (3 types × 3 new restarts). `applyUndo`'s boundary scan (`gameEngine.ts:1401+`) already treats these as slot boundaries by `type` string — extending them with a `restartKind` discriminant preserves that logic with one `if` instead of tripling the boundary-detection branches.

### Finding: `GOAL_KICK` should NOT be a new staged-repositioning phase — it already exists in a different guise

`GK_RESTART` → `GK_KICK_TARGET` → `GK_KICK_MOVE` (`gameEngine.ts:2880-3097`) is **already** "GK has the ball at a dead-ball moment, team chooses kick/throw/movement, opponent repositions while the ball is in the air." This is functionally identical to a goal kick's requirements. Today it is only _entered_ after a GK catch/save (`applyGKKickTarget` comment: "GK kick: transition to GK_KICK_TARGET," `gameEngine.ts:2943-2956`; the SAVE branch at `gameEngine.ts:2360-2394` routes into `GK_RESTART`). The only new work for GOAL_KICK-as-a-restart-type is a **new trigger** (ball crosses the defending byline last-touched-by-attacker → set `ball.carrierId` to the GK, `phase: 'GK_RESTART'`, same as today's save-catch branch does) — not a new phase, not a new stage table, not new client UI. This is the single biggest scope-reduction finding in this document; call it out explicitly to the roadmapper so "goal kick" isn't costed as a peer of corner kick/throw-in.

(One caveat: the physical rulebook may restrict a goal-kick GK to `kick` only, not `throw`/`movement` — if so, `applyGKRestart`'s `choice` validation (`gameEngine.ts:2880-2893`) needs a restart-context flag to know which choices are legal; a small, not structural, change.)

## Q2 — Where does "last touched by" tracking for out-of-bounds classification naturally live in `GameState`?

**It does not exist today at all**, and its absence is explicitly called out in code comments at both real out-of-bounds decision points:

- `gameEngine.ts:2776` (LOOSE_BALL scatter-walk clamp): `// pending out-of-bounds rules — ball stopped at board edge for now`. This is the `LOOSE_BALL` case (`gameEngine.ts:2769-2833`) — direction+distance dice compute a trajectory via `computeLooseBall`, then `isPitchHex` is used purely to **clamp** the landing hex to the last valid pitch hex (`gameEngine.ts:2778-2783`) instead of classifying the exit as sideline/byline.
- `gameEngine.ts:2378` (GK save-spill): `// D-07 (Phase 17.1): GK save spill → GK_RESTART (mirrors clean catch). pending out-of-bounds rules — spill treated as clean catch for now`. A spilled save today auto-becomes a clean GK possession; per the physical rulebook a spill that goes out of play should become a corner kick, not a free GK restart.

**Recommendation: add `ball.lastTouchedBy: { pieceId: string; teamId: 'home'|'away' } | null` to `BallState`** (`types.ts:45-48`), not as a separate top-level `GameState` field. Rationale:

- `BallState` is already the single owner of ball possession/position and is already threaded through every `ballAfter` snapshot on every `ActionEvent` (dozens of call sites, e.g. `types.ts:122,129,138` etc.) — it is the natural, already-serialized home for "who last controlled the ball," and reuses the exact same update discipline every other ball-state field already has (immutable spread-update at every mutation site).
- It must be updated at **every** point that currently sets `ball.carrierId` or moves `ball.position` without a carrier (pass delivery, shot, header, deflection, GK kick/punt/throw, loose-ball landing) — this is a wide-touching but mechanical change, not a design risk. The actual _classification_ logic (sideline vs attacking byline vs defending byline, relative to `lastTouchedBy.teamId`) is a small pure function, best placed alongside `offside.ts`'s existing team-relative geometry helpers (`attackingDirection`, `isPastHalfway` at `offside.ts:62-73` are already exactly this shape) in a new `packages/shared/src/outOfBounds.ts` — e.g. `classifyOutOfBounds(exitHex: HexCoord, lastTouchedByTeam): 'THROW_IN'|'CORNER_KICK'|'GOAL_KICK'`.
- **Do not** try to derive "last touched by" retroactively from `eventLog` at the moment the ball exits — the two known trigger sites (`gameEngine.ts:2776` and `2378`) both need the answer synchronously, in-function, with no event-log scan; a live `ball.lastTouchedBy` field is O(1) at the point of need versus an O(n) log walk, and matches the codebase's existing convention of denormalizing "current derived facts" onto `GameState` directly (see `ballZone`, `offsidePieceIds`, `movedPieceIds` — all are pre-computed/maintained-incrementally fields, not derived on read).
- The clamp-to-pitch-edge logic at `gameEngine.ts:2778-2783` is the concrete hook point: replace "clamp `clampedPos` to the last valid pitch hex and stop" with "if the walk exits the pitch, classify the exit hex/edge using `lastTouchedBy` and transition to `THROW_IN_SETUP`/`CORNER_KICK_SETUP`/`GK_RESTART` (goal kick) instead of clamping." The GK save-spill site (`gameEngine.ts:2376-2394`) is the second hook: route to `CORNER_KICK_SETUP` when the spill direction/distance would carry the ball over the byline, instead of unconditionally routing to `GK_RESTART`.

## Q3 — How should "always roll injury+booking even on continue-play" be modeled without forcing an extra client-rendered phase transition?

**There is already a precedent for exactly this shape in the codebase: `STEAL_ATTEMPT`/`TACKLE_ATTEMPT`.** These are dice sub-resolutions that fire _inside_ `applyMove` (`gameEngine.ts:808-947`), append their own `ActionEvent` to the log (`STEAL_ATTEMPT`/`TACKLE_ATTEMPT` events, `types.ts:131-151`), and on a FAIL outcome **do not transition `phase` at all** — the move simply completes and MOVEMENT continues (`gameEngine.ts:928-945`). The client never renders a distinct "steal attempt" phase; it only reads the appended `eventLog` entries to display the outcome in `ActionLog.tsx`. This is precisely the mechanic needed for "injury and booking are always rolled regardless of the continue-play choice."

**Recommended model:**

1. **The foul-causing roll (tackle/nutmeg/steal `die === 1`) is detected in the SAME `applyMove`/`applyRoll` branch that already resolves that duel** (`gameEngine.ts:808-947` for STEAL_ATTEMPT/TACKLE_ATTEMPT specifically — note: no distinct "nutmeg" mechanic exists in the current codebase; the milestone's "tackle/nutmeg/steal" language most likely maps onto these two existing dice-duel sites, confirm exact mapping during phase planning) — not a new phase entry. On `die === 1`, compute injury (`die >= victim.resilience`) and booking (`die >= refereeCard.leniency`, `RefereeCard` already exists at `types.ts:60-62`) **inline, synchronously, in the same function call**, and append `INJURY_CHECK`/`BOOKING_CHECK`-style `ActionEvent`s to `eventLog` alongside the existing `TACKLE_ATTEMPT`/`STEAL_ATTEMPT` event — mirroring how the SHOT duel already appends a `handlingDie`/handling-check sub-roll into the _same_ `SHOT_ATTEMPT` event object (`types.ts:236-239`) rather than spawning a new phase for the handling check.
2. **A minimal, single new phase is still justified for the human decision itself** (`FOUL_CHOICE` or similar) — but critically, **injury and booking have already resolved and are already reflected in `GameState` by the time that phase renders** (the injured piece's penalty is already active, the booking is already recorded). The `FOUL_CHOICE` phase's only job is to gate the _attacker's_ one binary choice (`continue` vs `take restart`); it does not gate whether injury/booking happen — those are unconditional side effects of the triggering roll, already committed to state before the choice phase is even entered. This keeps the "always happens" requirement structurally impossible to route around client-side (the roll is server-computed and log-committed before any client input is read for the choice).
3. **Where injury lives on `PlayerPiece`**: do not mutate the piece's raw attribute fields (`pace`, `tackling`, etc.) directly — those are referenced elsewhere as "true" stats (draft/roster display, lineup screens). Instead add `injured?: boolean` to `PlayerPiece` (`types.ts:14-43`) and thread a `-1` into the **existing `penalties: number[]` parameter** of `computeCombinedScore` (`packages/shared/src/scoreUtils.ts:28-37`) at every duel call site when a participant is injured — this is the exact mechanism already used for shot/GK penalties (`shooterPenaltyTotal`/`gkPenaltyTotal`, `types.ts:241-243`, clamped at -2 total by `scoreUtils.ts:34-35`, "DICE-04"). **Important interaction to flag for planning**: because `computeCombinedScore` clamps the _summed_ penalty at -2 regardless of source, an injured GK taking a -2 snapshot penalty gets no additional injury penalty applied (already at the -2 floor) — this is probably correct per the rulebook's spirit but should be an explicit design decision recorded when this phase is planned, not an accidental side effect discovered in testing.
4. **Booking** needs a `bookings: { home: string[]; away: string[] }` (yellow-card piece ids) or per-piece `yellowCards?: 0|1` field on `PlayerPiece` — second yellow → red is a pure function of that count, evaluated at booking-resolution time, not a new phase.

## Q4 — Where do substitutions fit as a cross-cutting action reachable from many phases?

**Substitutions must NOT be threaded through `ELIGIBLE_NEXT_ACTIONS`/`LastActionType`** — that table governs the sequencing of ball-touching actions within one continuous possession sequence, and a substitution is an orthogonal, ball-independent roster mutation that can happen while _any_ dead-ball phase is active. Forcing it into `ELIGIBLE_NEXT_ACTIONS` would require adding a substitution "row" to every existing `LastActionType`, which is both semantically wrong (substitutions don't "follow" an action in the possession-sequence sense) and mechanically awkward (the type is a `Record<LastActionType, Set<NextActionType>>`, not designed for orthogonal side-channel actions).

**The correct precedent already exists in the codebase: the hardcoded `GamePhase[]` allow-list idiom used by `applyUndo`'s handler**, `validUndoPhases: GamePhase[]` (`gameHandlers.ts:1130-1139`) — a flat array of phases where the action is legal, checked directly in the handler with `.includes(room.gameState.phase)`, entirely independent of `ELIGIBLE_NEXT_ACTIONS`. Recommended shape:

```ts
// packages/shared/src/ — new pure predicate, colocated with actionSequence.ts
export const STOPPAGE_PHASES: readonly GamePhase[] = [
  'HALF_TIME',
  'KICK_OFF_SETUP',
  'FREE_KICK_SETUP',
  'GK_RESTART',
  'GK_KICK_TARGET',
  'GK_QUICK_THROW',
  'GOAL_KICK_SETUP', // new
  'CORNER_KICK_SETUP', // new
  'THROW_IN_SETUP', // new
  'FOUL_CHOICE', // new, if modeled as its own phase per Q3
];
export function isStoppagePhase(phase: GamePhase): boolean {
  return STOPPAGE_PHASES.includes(phase);
}
```

A new `GAME_SUBSTITUTION` socket event (`gameHandlers.ts`, new handler following the exact `isProcessing` mutex + phase-guard + pure-function-delegate shape every other handler already uses) checks `isStoppagePhase(room.gameState.phase)` instead of any `ELIGIBLE_NEXT_ACTIONS` row, then delegates to a new pure `applySubstitution(state, team, outPieceId, inPieceId)` in `gameEngine.ts` that:

- validates `subsUsed[team] < 3` (new `GameState.subsUsed: { home: number; away: number }` field, mirrors the flat counter style of `addedTime`/`actionCount`),
- swaps the piece in `state.pieces` (out) for a bench player (in), **inheriting the departing player's `number`** (per the milestone's explicit requirement) — a straightforward object-replace in the `pieces` array, not a phase transition; `phase` is unchanged before and after,
- appends a new `SUBSTITUTION` `ActionEvent` for replay/log purposes (same discriminated-union pattern as every other event in `types.ts:114-401`),
- adds 1 minute to `addedTime` per the milestone spec (mirrors the existing inline `addedTime` roll-and-set logic already in `applyEndTurn`, `gameEngine.ts:1024`).

**A new `GameState.bench` structure does not exist today and must be added** — currently `pieces: readonly PlayerPiece[]` holds exactly the 22 on-pitch pieces with no reserve concept in live match state (the only "bench" concept in the whole codebase today is `DraftSession.homeBenchIds`/`awayBenchIds`, which is pre-match-only and discarded once the match's `GameState` is constructed — confirmed by `types.ts:658-660` and the absence of any bench field in the `GameState` type at `types.ts:689-1012`). This is new state, not a reachable extension of existing fields — flag it as its own roadmap task, since it also needs a source: either the full team roster (12+ players per team) needs to be carried into `GameState` at match-start (today only the starting 11 are ever placed into `pieces`), or `selectedTeams`/roster lookup needs to be queried live at substitution time from the static team-config data already used for lineup assignment (`FORM-01..04`/`ASSIGN-01..04` machinery, v1.3).

Because substitution is phase-independent, **no `GameBoard.tsx` phase-dispatch change is required for the substitution trigger itself** — it should render as a persistent, always-available UI affordance (e.g., a button in the existing top-band or side panel, gated client-side by `isStoppagePhase(phase)` using the exact same shared predicate the server enforces) rather than a per-phase panel component, consistent with how the codebase already keeps `DisconnectBanner` (`GameBoard.tsx:341`) and the scoreboard persistent across all phases.

## Where the 3 new game-creation toggles fit

The milestone requires three independent game-creation toggles (Fouls, Booking, Out-of-Bounds/Restarts). The existing pre-match settings pattern is already established and should be reused directly, not reinvented: `Room.gameSpeed?: GameSpeed` and `Room.teamType?: TeamType` (`roomStore.ts:83-90`) are set by a `*_SET`/`ROOM_SETTINGS_CONFIRM`-style handler before match start, then baked into the initial `GameState` at match-build time (mirrors how `gameSpeed: GameSpeed` ends up as a required, always-present `GameState` field, `types.ts:763`). The 3 new toggles should follow the same two-step shape: `Room.foulsEnabled?/bookingEnabled?/outOfBoundsEnabled?: boolean` during the settings pre-step, then `GameState.foulsEnabled/bookingEnabled/outOfBoundsEnabled: boolean` (non-optional, always present, like `gameSpeed`) once the match starts. Every new trigger site (`die === 1` foul check, out-of-bounds classification at the LOOSE_BALL clamp, GK save-spill routing) must branch on these flags — e.g. when `outOfBoundsEnabled` is false, the existing clamp-to-edge behavior at `gameEngine.ts:2778-2783` must remain completely unchanged, which is a strong argument for gating the new classify-and-transition logic behind an early `if (!state.outOfBoundsEnabled) { /* existing clamp code, untouched */ }` guard rather than interleaving the new logic into the existing branch.

## Build Order (dependency-driven, for the roadmapper)

1. **`ball.lastTouchedBy` tracking (Q2) first.** Every out-of-bounds-triggered restart (goal kick, corner kick, throw-in) is unreachable/untestable end-to-end without it — it is a pure prerequisite, not parallelizable with the restart phases themselves. Low risk, mechanical, wide-touching (every ball-state mutation site).
2. **Generalize the `FREE_KICK_SETUP` staging mechanism (Q1, item 2) before or alongside building corner-kick/throw-in.** Building corner-kick/throw-in against the _current_ free-kick-specific fields first and generalizing afterward means redoing the corner/throw-in code twice. Do the `restartSetup`/`RESTART_STAGES` refactor as its own early phase, informed by (but not blocking on) knowing corner-kick/throw-in's exact stage tables.
3. **Foul-triggered free kick (reuse of `FREE_KICK_SETUP`/`triggerOffsideFoul`) can land early and cheaply** — the fields are already trigger-agnostic; this is largely a new `triggerFoulFreeKick`-style entry function, not new staging logic. Good candidate to sequence right after the Q1 generalization refactor, since it's the cheapest way to validate the generalized staging mechanism still works for a second trigger source before building 2 brand-new restart types on top of it.
4. **Foul/injury/booking resolution chain (Q3) should land before penalty kick**, since the milestone context states penalty kick is one of the foul chain's triggers (GK-dive-at-feet duel fouling on a roll of 1) — penalty kick's attacker-vs-GK duel and reposition-then-tie-to-Loose-Ball structure can otherwise be built independently (it doesn't depend on Q1/Q2/Q4), but its _trigger_ does depend on the foul chain existing.
5. **Goal kick is nearly free** once (1) lands — it is a new trigger into the existing `GK_RESTART` chain, not new staging machinery. Sequence it opportunistically, not as a peer-sized task to corner kick/throw-in.
6. **Corner kick and throw-in** depend on both (1) and (2); corner kick additionally depends on the existing `HEADER` phase machinery being reachable as a transition target from the new staged setup (already true structurally — `HEADER` is a normal phase reached via `lastActionType`/phase-set, same as any other transition), so no new dependency there.
7. **Substitutions (Q4) are fully independent of 1-6** and can be built and shipped in parallel with any of the restart work — its only shared dependency is the `bench`/roster `GameState` extension, which is itself independent of the FSM changes above. Good candidate for a separate, parallel phase track rather than sequenced after the restart work.
8. **The 3 game-creation toggles** should land alongside/immediately after step 1 (they need `foulsEnabled`/`bookingEnabled`/`outOfBoundsEnabled` to exist on `GameState` before any trigger-site gating can be written) but are themselves trivial (mirrors the existing `gameSpeed`/`teamType` settings-pre-step plumbing almost exactly) — do not size this as its own phase; fold it into whichever phase first needs to read one of the flags.

## Anti-Patterns to Avoid (specific to this codebase's conventions)

### Anti-Pattern: One `GamePhase` value per internal repositioning stage

**What people might do:** add `GOAL_KICK_STAGE_1`, `GOAL_KICK_STAGE_2`, etc., as distinct `GamePhase` union members.
**Why it's wrong:** `FREE_KICK_SETUP` deliberately does not do this — stage progression is a scalar `stageIndex` field, not a phase value, precisely so `GamePhase`-keyed structures (`ELIGIBLE_NEXT_ACTIONS`, `validUndoPhases`, `GameBoard.tsx`'s phase-dispatch ternary) don't have to enumerate every stage. Breaking this convention for the new restarts creates an inconsistent FSM style within the same file.
**Do this instead:** one `GamePhase` per restart type (or reuse an existing one, as with goal kick), stage index as data.

### Anti-Pattern: Deriving "last touched by" from `eventLog` scans at the moment of need

**What people might do:** when the ball goes out, walk `state.eventLog` backwards to find the last ball-touching event and infer the team.
**Why it's wrong:** slower, more fragile (every new `ActionEvent` type that moves the ball would need to be added to the scan's type-switch), and inconsistent with the codebase's existing convention of maintaining derived facts as live `GameState` fields (`offsidePieceIds`, `ballZone`, `movedPieceIds`).
**Do this instead:** a maintained `ball.lastTouchedBy` field, updated at every ball-state mutation site (mechanical but simple).

### Anti-Pattern: Gating substitutions through `ELIGIBLE_NEXT_ACTIONS`

**What people might do:** add a `'SUBSTITUTION'` member to `NextActionType` and a row to every `LastActionType` in `ELIGIBLE_NEXT_ACTIONS`.
**Why it's wrong:** that table's whole purpose is sequencing _within_ one continuous possession sequence; a substitution is orthogonal to ball possession and should be legal across many different `lastActionType` values simultaneously, which doesn't fit a `Record<LastActionType, Set<NextActionType>>` shape cleanly.
**Do this instead:** an independent `GamePhase[]` allow-list checked directly in the handler, mirroring the proven `validUndoPhases` idiom (`gameHandlers.ts:1130`).

## Integration Points

### Internal Boundaries (file:line reference table)

| Concern                                                 | Existing file:line                                                                                                                | New vs Modified                                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Staged restart reference pattern                        | `gameEngine.ts:4133-4441` (`applyFreeKickMove`/`applyFreeKickReady`), `offside.ts:38-56` (`FREE_KICK_STAGES`/`freeKickStageTeam`) | Modified — generalize to `kind`-parameterized `RESTART_STAGES`                                                        |
| Foul-triggered free kick entry                          | `offside.ts:191-237` (`triggerOffsideFoul`)                                                                                       | Modified/extended — new `triggerFoulFreeKick`-style entry reusing the same state shape                                |
| Goal kick restart                                       | `gameEngine.ts:2880-3097` (`applyGKRestart`/`applyGKKickTarget`/`applyQuickThrow`), save-spill hook at `gameEngine.ts:2376-2394`  | Modified — new out-of-bounds trigger into existing chain, not new phases                                              |
| Out-of-bounds clamp hook (throw-in/corner-kick trigger) | `gameEngine.ts:2769-2833` (`LOOSE_BALL` case), specifically the clamp loop at `2778-2783`                                         | Modified — replace clamp-only behavior with classify-and-transition, gated by `outOfBoundsEnabled`                    |
| "Last touched by" field                                 | `BallState`, `types.ts:45-48`                                                                                                     | New field: `lastTouchedBy`                                                                                            |
| Inline duel-roll precedent for injury/booking           | `gameEngine.ts:808-947` (`STEAL_ATTEMPT`/`TACKLE_ATTEMPT` inline sub-resolution, no forced phase transition on FAIL)              | Pattern to replicate, not modify                                                                                      |
| Penalty/attribute-modifier mechanism                    | `scoreUtils.ts:28-37` (`computeCombinedScore` penalties array, -2 clamp)                                                          | Modified — thread injury penalty through existing param                                                               |
| Referee/booking attribute source                        | `RefereeCard`, `types.ts:60-62`                                                                                                   | Existing, ready to consume                                                                                            |
| Cross-cutting action allow-list precedent               | `gameHandlers.ts:1130-1139` (`validUndoPhases`)                                                                                   | Pattern to replicate for `STOPPAGE_PHASES`/substitutions                                                              |
| Bench/roster state                                      | Absent from `GameState` (`types.ts:689-1012`); only exists pre-match in `DraftSession` (`types.ts:626-667`)                       | New — `GameState.bench`, `GameState.subsUsed`                                                                         |
| Pre-match settings pattern (for the 3 toggles)          | `roomStore.ts:83-90` (`Room.gameSpeed?`/`Room.teamType?`), `types.ts:763` (`GameState.gameSpeed`, always present)                 | Pattern to replicate for `foulsEnabled`/`bookingEnabled`/`outOfBoundsEnabled`                                         |
| Client phase-dispatch pattern                           | `GameBoard.tsx:328-336`                                                                                                           | Modified — add cases for new setup phases; substitution UI should NOT follow this pattern (persistent, not per-phase) |
| Undo boundary events for staged restarts                | `types.ts:379-399` (`FK_SETUP_MOVE`/`FK_KICKER_CHOSEN`/`FK_STAGE_ADVANCE`), scan logic `gameEngine.ts:1401+`                      | Modified — generalize with a `restartKind` discriminant                                                               |

### External Services

Not applicable — this is entirely an internal game-logic/FSM extension. No new external services, no changes to the Socket.io transport layer itself (only new event names/payloads on the existing transport), no AWS/deployment implications for this milestone.

## Sources

- Direct reading of the current repository source (not documentation or web research):
  - `packages/shared/src/types.ts` (GameState/GamePhase/ActionEvent/PlayerPiece/BallState definitions)
  - `packages/shared/src/offside.ts` (FREE_KICK_STAGES table, triggerOffsideFoul, staged-repositioning geometry helpers)
  - `packages/shared/src/actionSequence.ts` (ELIGIBLE_NEXT_ACTIONS)
  - `packages/shared/src/scoreUtils.ts` (computeCombinedScore penalty-clamp mechanism)
  - `packages/server/src/gameEngine.ts` (all `apply*` functions, especially the FREE_KICK_SETUP family at 3993-4441, GK restart chain at 2880-3097, LOOSE_BALL out-of-bounds clamp at 2769-2833, GK save-spill at 2337-2395, STEAL_ATTEMPT/TACKLE_ATTEMPT inline duel resolution at 808-947)
  - `packages/server/src/gameHandlers.ts` (socket wiring, `isProcessing` mutex idiom, `validUndoPhases` allow-list idiom at 1120-1175, `GAME_FREE_KICK_MOVE`/`GAME_FREE_KICK_READY` handlers at 1880-1994)
  - `packages/server/src/roomStore.ts` (Room type, pre-match settings pattern for gameSpeed/teamType — precedent for new Fouls/Booking/Out-of-Bounds toggles)
  - `packages/client/src/components/GameBoard.tsx` (per-phase panel dispatch pattern, lines 280-350)
  - `.planning/PROJECT.md` (milestone goal, target features, prior architecture decisions)
- No external/web sources were consulted — this question is scoped entirely to conventions already established in this specific codebase, not general ecosystem practice, so codebase inspection is the authoritative source.

---

_Architecture research for: Counter Attack POC v1.6 (Fouls, Cards & Restarts) FSM integration_
_Researched: 2026-08-03_
