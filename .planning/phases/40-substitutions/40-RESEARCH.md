# Phase 40: Substitutions - Research

**Researched:** 2026-08-15
**Domain:** Server-authoritative real-time hex-board game FSM (Node.js/Socket.io + TypeScript monorepo) — mid-match roster mutation, reusing an existing pre-match drag-and-drop screen
**Confidence:** HIGH — every finding is grounded in the current committed source (file:line citations from direct codebase reads), the pre-existing `.planning/research/ARCHITECTURE.md` Q4 answer (written for this exact phase during v1.6 roadmap creation), and Phase 39's now-shipped code (which this phase reads but does not modify).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bench/roster data source & UI**

- **D-01:** The in-match substitution UI reuses the existing `LineupAssignmentScreen` component and its drag-and-drop mechanics — the same screen already used post-draft/pre-game to confirm the lineup. Not a new screen. Adapt this component to also operate on live `GameState` mid-match. `GameState.bench` is seeded at kickoff from whatever the pre-game `LineupAssignmentScreen` left as unselected (its existing `benchIds` concept), carried forward into live match state instead of being discarded at `LINEUP_CONFIRM` as it is today.
- **D-02:** No new pre-match "matchday squad selection" step — the bench is simply every roster player not placed in the starting 11, exactly as `LineupAssignmentScreen` already produces today for both Draft and Standard modes (`draftMode` prop gates draft-specific behavior; the underlying lineup/bench split is common to both).
- **D-03:** The Roster/substitution screen mid-match is opened via a persistent button (top-band or side panel), enabled only during a stoppage (`isStoppagePhase(phase)`, a new `STOPPAGE_PHASES` allow-list — see below). Not a per-phase `GameBoard.tsx` dispatch case — substitution UI is phase-independent within the stoppage set.
- **D-04:** Mid-match substitution is constrained to 1-for-1 swaps only (SUB-02's literal wording) — reusing `LineupAssignmentScreen`'s drag-and-drop interaction, but each confirmed action is gated through a new `GAME_SUBSTITUTION` handler (`subsUsed < 3`, red-card cap, no-return-once-subbed-out), unlike the free pre-match rearrangement the same screen allows before kickoff.

**Card/injury badges**

- **D-05:** Card (yellow/red rectangle) and injury (plus-sign) badges — already built on-pitch pieces in Phase 39 (`PieceOverlay.tsx`, corner-of-piece placement, D-04/D-05 of `39-CONTEXT.md`) — are added to two more surfaces using the same visual style: (1) the sub-roster rows on the reused `LineupAssignmentScreen`, and (2) the existing top-left "player card" component shown during gameplay (`PlayerStatsPanel.tsx`). **Codebase-verified correction: `PlayerStatsPanel.tsx` already has this badge (`.cardChip`/`.injuryChip`, lines 146-171, shipped in Phase 39) — do not duplicate this as new work.** Only the sub-roster-row badge (on `LineupAssignmentScreen`'s reused cards) is genuinely new for this phase. The existing on-pitch piece badge design/position is not changed.

**Added-time accumulation**

- **D-06:** `addedTime` today is a single flat value rolled once when `actionCount` first crosses minute 45/90 (`roll + refereeCard.leniency`, `gameEngine.ts:2449-2451`) — there is no existing accumulator for incremental contributions from in-match events, and substitutions can happen well before that roll fires. Add a new per-half running accumulator field (e.g. `GameState.addedTimeBonus: number`), incremented by 1 on every completed substitution for either team, regardless of when in the half it happens. When the `addedTime` roll fires at minute 45/90, fold the accumulator in: `newAddedTime = roll + state.refereeCard.leniency + state.addedTimeBonus`.
- **D-07:** The accumulator is per-half — it resets to 0 at half-time, so each half's `addedTime` roll only reflects that half's own substitutions. This differs from SUB-04's 3-substitution cap, which is explicitly whole-match and never resets — the two counters are independent and must not be conflated in implementation.

**SUB-06 permanent slot cap**

- **D-08:** A red card permanently reduces the team's max on-pitch headcount, independent of the 3-substitution allowance. Model as `maxOnPitch = 11 - redCardCount` per team (not a separate "blocked slots" counter) — substitution validation checks `pieces.filter(onPitch, team).length < maxOnPitch` as a distinct guard from `subsUsed[team] < 3`. A team with 1 red card is capped at 10 on-pitch players for the rest of the match even with substitutions still remaining; 2 red cards → 9; etc.
- **D-09:** The vacated slot is unfillable the instant the red card is shown — no grace substitution is offered for the sent-off player specifically.

### Claude's Discretion

- Exact `GameState`/`ActionEvent` field naming for the new `bench`, `subsUsed`, `addedTimeBonus`, `maxOnPitch`/`redCardCount` fields, following the codebase's existing flat-counter naming conventions (`actionCount`, `addedTime`).
- Internal mechanics of adapting `LineupAssignmentScreen` for mid-match use (e.g. whether it's rendered in a modal/overlay vs. an in-place swap) — the screen/interaction pattern is locked (D-01), the exact modal chrome is not. **Resolved by 40-UI-SPEC.md: modal overlay, reusing `ActionPanel.module.css`'s `.confirmOverlay` pattern, `max-width: 960px; width: 92vw; max-height: 90vh`.**
- Exact placement/sizing of the new top-left player-card badge (D-05) — moot per the codebase-verified correction above; no new work needed there.

### Deferred Ideas (OUT OF SCOPE)

- Hide game-creation toggles under an advanced dropdown (`GameSettingsScreen.tsx` UI reorganization) — unrelated to substitutions.
- Referee leniency roll range change (max 5, min 2) — a Phase 39 rule-balance tweak, not a substitution mechanic. Distinct from Phase 39's already-rejected 2d6-take-highest proposal; evaluate fresh if ever picked up.
- Display referee leniency on the scoreboard — new UI feature, unrelated to substitutions.
- Allow formation change from the sub screen — SUB-02 restricts substitution to exactly one player replaced per action; formation change is a genuinely new capability for a future phase.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID          | Description                                                                                                                                         | Research Support                                                                                                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SUB-01      | Substitute at any stoppage (kick-off, half-time, free kick, penalty kick, goal kick, corner kick, throw-in setup), regardless of other v1.6 toggles | See "STOPPAGE_PHASES definition" below — full `GamePhase` inventory mapped to each named stoppage type, with an explicit open question on stage-granularity                                     |
| SUB-02      | Roster screen drag-and-drop, one player replaced per action                                                                                         | `LineupAssignmentScreen.tsx` reuse (D-01/D-04) fully mapped below — existing drag handlers, existing `LineupStatCard`, existing `BenchCarousel`                                                 |
| SUB-03      | Substitute inherits departing player's jersey number and pitch position/slot                                                                        | `applySubstitution` pure-function shape below; `slotMeta.jerseyNumber` precedent already exists in `LineupAssignmentScreen.tsx:172`                                                             |
| SUB-04      | 3-per-team match cap, never resets at half-time                                                                                                     | `subsUsed: { home: number; away: number }` flat-counter field, mirrors `actionCount`/`addedTime` precedent; increment site identified                                                           |
| SUB-05      | Each completed substitution adds 1 minute to current half's added-time                                                                              | D-06/D-07 accumulator design fully specified against `applyEndTurn`'s exact 4 return sites (`gameEngine.ts:2468,2498,2571,2602`)                                                                |
| SUB-06      | Red-carded player cannot be replaced by a substitute                                                                                                | D-08/D-09 `maxOnPitch = 11 - redCardCount` design; reads Phase 39's `piece.redCarded` field (already shipped)                                                                                   |
| SUB-07      | Subbed-out player never returns; shown "unavailable" indicator on roster screen                                                                     | Bench data model below (`GameState.bench` shape, "OUT" badge per UI-SPEC)                                                                                                                       |
| SETTINGS-04 | Substitutions always available regardless of toggle state                                                                                           | Confirmed structurally true by design — substitution handler has no dependency on `foulsEnabled`/`bookingEnabled`/`injuryEnabled`/`outOfBoundsEnabled` flags anywhere in the recommended design |

</phase_requirements>

## Summary

Phase 40 is the lowest-architectural-risk phase of the v1.6 milestone. `.planning/research/ARCHITECTURE.md` (written 2026-08-03, specifically for this milestone) already answered the core structural question — "where do substitutions fit as a cross-cutting action reachable from many phases" — in its Q4 section, and that answer has not been invalidated by anything built in Phases 37–39. Phase 40's own CONTEXT.md (D-01 through D-09) locks in every major design decision already: reuse `LineupAssignmentScreen` verbatim for the mid-match UI, model the bench as a new `GameState.bench` field seeded from the pre-match `benchIds` concept, gate substitution eligibility with a new `STOPPAGE_PHASES` allow-list (mirroring the existing `validUndoPhases` idiom at `gameHandlers.ts:1651-1665`), track the 3-per-match cap and the per-half added-time bonus as two independent flat counters, and cap post-red-card on-pitch headcount via `maxOnPitch = 11 - redCardCount`.

This research confirms every one of those decisions is directly buildable against real, already-shipped code — `LineupAssignmentScreen.tsx`, `BenchCarousel.tsx`, `PlayerStatsPanel.tsx`, and `PieceOverlay.tsx` all exist exactly as CONTEXT.md describes them, and Phase 39's card/injury fields (`redCarded`, `yellowCards`, `injuryCount`) are already on `PlayerPiece`, ready to read. One correction surfaces from direct inspection: CONTEXT.md's D-05 describes the top-left player-card card/injury badge as new work, but `PlayerStatsPanel.tsx` (lines 146-171) already has it, built in Phase 39 — Phase 40's UI-SPEC already caught and flagged this discrepancy; this research independently confirms it. The only genuinely new badge surface is the sub-roster row.

The riskiest open item is **not** architectural but definitional: the exact list of `GamePhase` values that satisfy SUB-01's "any stoppage" wording. SUB-01 names 7 stoppage _types_ in English prose, but the codebase's `GamePhase` union has 5–8 discrete phase values _per_ named stoppage type (e.g. "corner kick" spans 5 phase values: `CORNER_KICK_GK_SETUP_ATTACKING` through `CORNER_KICK_FINAL_SETUP`). This research maps every candidate phase value explicitly and flags the genuinely ambiguous ones (GK_RESTART chain, FOUL_CHOICE, penalty-kick sub-stages) for planner/user confirmation rather than guessing silently.

**Primary recommendation:** Reuse `LineupAssignmentScreen` behind a new `mode: 'pregame' | 'midmatch'` prop branch (per UI-SPEC), add `GameState.bench: { home: string[]; away: string[] }` seeded at kickoff from confirmed pre-match `benchIds`, add flat counters `subsUsed: {home,away}`, `addedTimeBonus: number` (per-half, resets at half-time), `redCardCount: {home,away}` (or derive `maxOnPitch` from existing `pieces` red-card count directly — see Open Questions), gate the new `GAME_SUBSTITUTION` handler on a new `STOPPAGE_PHASES` allow-list (not `ELIGIBLE_NEXT_ACTIONS`), and register the new `SUBSTITUTION` `ActionEvent` type in all three Undo/Replay bookkeeping locations (server `isBoundary` reduce, client `isBoundary` reduce, `REPLAY_ELIGIBLE_TYPES` set) on day one to avoid the recurring bug class already shipped twice in this codebase (BUG-30/31, BUG-37).

## Architectural Responsibility Map

| Capability                                                                | Primary Tier                                                                           | Secondary Tier                                                                           | Rationale                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Substitution eligibility check (stoppage phase, cap, red-card, no-return) | API / Backend (`gameHandlers.ts` + `gameEngine.ts`)                                    | —                                                                                        | Server-authoritative state; all validation must be enforced server-side per the project's "Server-authoritative state; full-snapshot broadcast" locked decision (STATE.md)                                                                     |
| Bench/roster drag-and-drop interaction                                    | Browser / Client (`LineupAssignmentScreen.tsx`)                                        | —                                                                                        | Pure UI interaction; emits an intent event, never mutates authoritative state directly                                                                                                                                                         |
| Added-time accumulator fold-in                                            | API / Backend (`gameEngine.ts` `applyEndTurn`)                                         | —                                                                                        | Must be computed at the same point the existing `addedTime` roll fires, using server-side state only                                                                                                                                           |
| Card/injury badge rendering (sub-roster, top-left panel)                  | Browser / Client (`LineupAssignmentScreen.tsx`, `PlayerStatsPanel.tsx` — already done) | —                                                                                        | Pure rendering of already-broadcast `PlayerPiece.redCarded`/`yellowCards`/`injuryCount` fields                                                                                                                                                 |
| "Unavailable" (OUT) badge for subbed-out bench players                    | Browser / Client (`LineupAssignmentScreen.tsx`)                                        | API / Backend (source of truth: piece removed from `bench` array or a subbed-out marker) | Client renders a derived visual state from server-broadcast `GameState.bench`/piece list; server owns the underlying fact                                                                                                                      |
| Persistent substitution button gating (`isStoppagePhase`)                 | Browser / Client (UI enable/disable)                                                   | Shared (`packages/shared`)                                                               | The predicate itself (`isStoppagePhase`) must be a shared pure function so client (button enablement) and server (handler guard) can never disagree — mirrors the existing `validUndoPhases`/shared-predicate split precedent in this codebase |

## Standard Stack

No new external libraries are required for this phase — it is a pure extension of the existing internal FSM/UI conventions. All "stack" here is internal architectural pattern reuse, not package installation.

### Core (internal patterns reused)

| Pattern                                                                   | Location                                                                             | Purpose                                          | Why Standard                                                                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validUndoPhases`-style flat `GamePhase[]` allow-list                     | `packages/server/src/gameHandlers.ts:1651-1665`                                      | Template for the new `STOPPAGE_PHASES` array     | Already the established codebase idiom for a cross-cutting, phase-independent action gate — explicitly recommended by `.planning/research/ARCHITECTURE.md` Q4   |
| `isProcessing` mutex + phase-guard + pure-function-delegate handler shape | Every `gameHandlers.ts` socket handler (e.g. the `GAME_UNDO` handler at line ~1640+) | Template for the new `GAME_SUBSTITUTION` handler | Universal convention in this codebase — STATE.md "Key Pitfalls to Avoid": "Add `isProcessing` mutex before writing any game logic (prevents double-click race)" |
| Flat per-team counter fields on `GameState` (`actionCount`, `addedTime`)  | `packages/shared/src/types.ts:1100-1150`                                             | Template for `subsUsed`, `addedTimeBonus`        | Established naming/shape convention; no nested sub-objects for simple counters elsewhere in `GameState`                                                         |
| Discriminated-union `ActionEvent` member                                  | `packages/shared/src/types.ts` (`ActionEvent` union, ~line 115+)                     | Template for new `SUBSTITUTION` event            | Every state mutation that needs Undo/Replay/log visibility is modeled this way; no exceptions in this codebase                                                  |

### Package Legitimacy Audit

Not applicable — this phase introduces zero new external packages (npm/PyPI/etc). All work is internal TypeScript against the existing monorepo.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ CLIENT (packages/client)                                                │
│                                                                           │
│  GameBoard.tsx                                                          │
│   ├─ SubstitutionButton (new, persistent, mirrors SideLog chevron)      │
│   │    enabled = isStoppagePhase(gameState.phase)  ←── shared predicate │
│   │    onClick → open substitution modal                                │
│   │                                                                      │
│   └─ Substitution Modal (new, reuses .confirmOverlay backdrop pattern)  │
│        └─ <LineupAssignmentScreen mode="midmatch" .../>  (D-01 reuse)   │
│             ├─ Formation grid (on-pitch cards; red-carded = non-drag)   │
│             ├─ BenchCarousel (bench cards; subbed-out = "OUT", dimmed)  │
│             ├─ Sub-counter chip "{used}/3 SUBS USED"                    │
│             └─ drag bench card → on-pitch slot → onSubstitute(out, in)  │
│                                                                           │
│                    │ emits GAME_SUBSTITUTION { outPieceId, inPieceId }  │
└────────────────────┼─────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TRANSPORT — Socket.io (full-state broadcast after every action)         │
└────────────────────┬─────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SERVER (packages/server)                                                │
│                                                                           │
│  gameHandlers.ts: GAME_SUBSTITUTION handler                             │
│   1. room.isProcessing mutex guard                                      │
│   2. isStoppagePhase(room.gameState.phase) — else WRONG_PHASE           │
│   3. delegate → gameEngine.ts: applySubstitution(state, team, out, in)  │
│                                                                           │
│  gameEngine.ts: applySubstitution (pure function)                       │
│   ├─ validate subsUsed[team] < 3            → else SUB_CAP_REACHED      │
│   ├─ validate outPiece.redCarded !== true    → else CANNOT_SUB_RED_CARD │
│   ├─ validate inPieceId in bench[team]       → else INVALID_SUBSTITUTE  │
│   ├─ validate inPiece not already subbed out → else ALREADY_SUBBED      │
│   ├─ swap: bench player → pieces[] (inherits outPiece.number/position)  │
│   ├─ remove outPiece from pieces[] (or mark unavailable — see below)    │
│   ├─ subsUsed[team] += 1                                                │
│   ├─ addedTimeBonus += 1                                                │
│   └─ append SUBSTITUTION ActionEvent                                    │
│                                                                           │
│   applyEndTurn (existing, MODIFIED):                                    │
│   newAddedTime = roll + refereeCard.leniency + addedTimeBonus  (D-06)   │
│   addedTimeBonus resets to 0 at half boundary                (D-07)     │
│                                                                           │
│   4. room.gameState = result.state; broadcastState(io, room)            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No new files/folders are required beyond what CONTEXT.md already names. Modifications land in:

```
packages/shared/src/
├── types.ts                    # GameState.bench/subsUsed/addedTimeBonus/redCardCount fields;
│                                #   new SUBSTITUTION ActionEvent member
├── stoppagePhases.ts (new)     # STOPPAGE_PHASES array + isStoppagePhase() predicate — shared
│                                #   so client button-enable and server handler-guard never diverge

packages/server/src/
├── gameHandlers.ts              # new GAME_SUBSTITUTION handler
├── gameEngine.ts                # new applySubstitution(); modify applyEndTurn's addedTime fold-in
│                                #   (4 return sites); modify buildInitialGameState + buildReplayFrames
│                                #   to seed new fields

packages/client/src/
├── components/
│   ├── GameBoard.tsx            # new persistent SubstitutionButton; new modal wrapper
│   ├── LineupAssignmentScreen.tsx  # new `mode: 'pregame' | 'midmatch'` prop branch (additive)
│   ├── LineupAssignmentScreen.module.css  # new .substitutionModalCard, sub-counter chip, OUT badge styles
│   ├── PlayerStatsPanel.tsx     # NO CHANGE — badge already shipped in Phase 39
│   └── PieceOverlay.tsx         # NO CHANGE — on-pitch badge already correct, not touched (D-05)
├── store/useGameStore.ts        # new emitSubstitution() action, mirrors existing emitLineupSwap-style actions
```

### Pattern 1: STOPPAGE_PHASES shared allow-list (mirrors `validUndoPhases`)

**What:** A flat, exported `GamePhase[]` constant plus a predicate function, colocated in `packages/shared` so both client (button enablement) and server (handler guard) import the identical list.
**When to use:** Any action that is legal across a heterogeneous, non-contiguous set of `GamePhase` values and is NOT part of the ball-possession sequencing model (`ELIGIBLE_NEXT_ACTIONS`).
**Example:**

```typescript
// Source: pattern extrapolated from packages/server/src/gameHandlers.ts:1651-1665 (validUndoPhases),
// explicitly recommended by .planning/research/ARCHITECTURE.md Q4 for this exact use case.
export const STOPPAGE_PHASES: readonly GamePhase[] = [
  'KICK_OFF_SETUP',
  'HALF_TIME',
  'FREE_KICK_SETUP',
  'PENALTY_KICK_SETUP_ATTACKING',
  'PENALTY_KICK_SETUP_DEFENDING',
  'PENALTY_KICK_TAKER_SELECT',
  'GOAL_KICK_SETUP_GK',
  'GOAL_KICK_SETUP_OPPONENT',
  'GOAL_KICK_CHOICE',
  'CORNER_KICK_GK_SETUP_ATTACKING',
  'CORNER_KICK_GK_SETUP_DEFENDING',
  'CORNER_KICK_TAKER_SELECT',
  'CORNER_KICK_REPOSITION',
  'CORNER_KICK_FINAL_SETUP',
  'THROW_IN_SETUP',
  // See "Open Questions" — GK_RESTART/GK_KICK_TARGET/FOUL_CHOICE/GK_DIVE_AT_FEET_PROMPT
  // deliberately excluded pending explicit confirmation; do not add without re-checking
  // against SUB-01's literal 7-item enumeration.
] as const;

export function isStoppagePhase(phase: GamePhase): boolean {
  return STOPPAGE_PHASES.includes(phase);
}
```

### Pattern 2: Reusing `LineupAssignmentScreen` for a second (mid-match) purpose via a mode prop

**What:** Add a `mode: 'pregame' | 'midmatch'` prop (default `'pregame'` to preserve every existing call site unchanged) that branches only the parts CONTEXT.md/UI-SPEC call out as different: no draft-pack row, no round/pick counters, no `LINEUP_CONFIRM` full-lineup gate, "Substitute" CTA instead of "Confirm", sub-counter chip, OUT badges, non-draggable red-carded cards, permanent-slot-cap note.
**When to use:** This specific reuse — do not generalize further; this is a two-mode branch, not a new abstraction layer.
**Example:**

```typescript
// Source: LineupAssignmentScreen.tsx:201-213 (current Props), UI-SPEC.md "Component reuse" table
type Props = {
  // ...all existing props unchanged...
  mode?: 'pregame' | 'midmatch'; // default 'pregame' — every existing caller keeps current behavior
  // midmatch-only props (all optional, only read when mode === 'midmatch'):
  subsUsed?: number; // for the "{used}/3 SUBS USED" chip
  maxOnPitch?: number; // for the permanent-slot-cap note when < 11
  bench?: { pieceId: string; subbedOut: boolean }[]; // for OUT badge rendering
  onSubstitute?: (outPieceId: string, inPieceId: string) => void; // replaces onSwap in this mode
};
```

### Pattern 3: Injury-style inline sub-resolution — NOT applicable here (documented negative finding)

**What:** Phase 39's Q3 precedent (dice sub-resolution fired inline inside `applyMove` without a forced phase transition) does **not** apply to substitutions. Substitution is a discrete, deliberate player-initiated action gated by phase membership, not an automatic side effect of another action resolving. Do not model it as an inline hook inside `applyEndTurn` or any duel resolver — it needs its own socket event (`GAME_SUBSTITUTION`) and its own pure engine function (`applySubstitution`), exactly as `.planning/research/ARCHITECTURE.md` Q4 already concluded.
**When to use:** N/A — documented here only to prevent a wrong-pattern-match against the injury/booking precedent in Phase 39's research, which is superficially similar (both are "things that happen mid-match, cross-cutting phases") but structurally different (automatic dice-driven vs. manager-initiated discrete action).

### Anti-Patterns to Avoid

- **Threading substitution through `ELIGIBLE_NEXT_ACTIONS`/`LastActionType`:** Already flagged explicitly in `.planning/research/ARCHITECTURE.md` ("Anti-Pattern: Gating substitutions through `ELIGIBLE_NEXT_ACTIONS`"). That table governs ball-possession sequencing; substitution is orthogonal and must use the `STOPPAGE_PHASES` allow-list instead.
- **Duplicating the top-left player-card card/injury badge:** CONTEXT.md D-05 describes this as new work; direct inspection of `PlayerStatsPanel.tsx:146-171` shows it already exists (Phase 39 built it). Re-implementing it would create dead/duplicate code. Only the sub-roster-row badge is new.
- **Removing the subbed-out player from `state.pieces` without a clear "why they're gone" trail:** Phase 39's `redCarded` precedent (`types.ts:64-76`) explicitly documents _keeping_ a dismissed piece in `state.pieces` with `onPitch: false` rather than splicing it out, specifically so eligibility guards can reject-by-id rather than relying on absence. Recommend the same shape for a substituted-out piece — see "Don't Hand-Roll" and Open Questions below for the exact mechanism.
- **New pre-match "matchday squad" step:** Explicitly rejected by D-02 — do not build one. Bench = roster minus starting 11, full stop.
- **Separate "blocked slots" counter for the red-card cap:** Explicitly rejected by D-08/D-09 in favor of `maxOnPitch = 11 - redCardCount`, a simple headcount comparison — do not build a per-slot blocking bitmap or similar.

## Don't Hand-Roll

| Problem                                       | Don't Build                                                       | Use Instead                                                                                                                                                            | Why                                                                                                                                                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Drag-and-drop bench↔slot interaction          | A new native-HTML5-drag implementation for the substitution modal | `LineupAssignmentScreen.tsx`'s existing `handleDragStart`/`handleDragOver`/`handleDrop`/`handleDragEnd` (lines 351-381) and `BenchCarousel.tsx`'s existing drag wiring | Already battle-tested across Standard and Draft modes (Phase 24/29/30); reinventing it risks reintroducing already-fixed bugs (e.g. DRAFT-09 scroll-reset, GK-lock edge cases)                                             |
| Cross-cutting phase-independent action gating | A new `ELIGIBLE_NEXT_ACTIONS` row per `LastActionType`            | The `STOPPAGE_PHASES`/`isStoppagePhase` allow-list (Pattern 1 above)                                                                                                   | `ELIGIBLE_NEXT_ACTIONS` is a `Record<LastActionType, Set<NextActionType>>` — structurally the wrong shape for an orthogonal action; the codebase already has a working precedent (`validUndoPhases`) for exactly this need |
| Substitute/bench card visual layout           | A new card component for bench rows in the substitution modal     | `LineupStatCard`/`DraftCardBody` (already shared between `LineupAssignmentScreen` and `BenchCarousel`)                                                                 | These already render name/flag/role/number/stat-chip layout identically to what the substitution modal needs; only new additions (card/injury chip, OUT badge) are additive props/classes                                  |
| Added-time roll-and-accumulate math           | A new standalone added-time service/module                        | Extend the existing inline logic in `applyEndTurn` (`gameEngine.ts:2440-2451`)                                                                                         | The existing roll is already inline, guarded by a "only set once per half" invariant that the new accumulator must respect exactly (D-07) — a separate module would risk drifting out of sync with the guard               |

**Key insight:** Every mechanical building block this phase needs (drag-and-drop, card rendering, cross-cutting phase gating, flat per-team counters, badge rendering) already exists in this codebase in a proven, tested form. This phase is almost entirely a wiring exercise — the risk is in getting the wiring boundaries right (which phases count as "stoppage," how the subbed-out piece is represented in `pieces`), not in building new mechanisms.

## Runtime State Inventory

> Not a rename/refactor/migration phase — this section is scoped to genuinely new state, not migrated state, but is included because the phase reuses/repurposes several existing fields in ways worth calling out explicitly.

| Category                      | Items Found                                                                                                                                                                                                                                                                                                                                                                                         | Action Required                                                                                                                                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored data                   | None — this is a live in-memory `GameState` field addition (`bench`, `subsUsed`, `addedTimeBonus`, `redCardCount`/`maxOnPitch`), not a persisted-datastore concern. No database, no external service.                                                                                                                                                                                               | Code edit only (types.ts + 2 `GameState` construction sites: `buildInitialGameState` at `gameEngine.ts:343` and `buildReplayFrames`'s replay seed at `gameEngine.ts:9288`)                                                                                    |
| Live service config           | None — no external service config involved                                                                                                                                                                                                                                                                                                                                                          | None                                                                                                                                                                                                                                                          |
| OS-registered state           | None                                                                                                                                                                                                                                                                                                                                                                                                | None                                                                                                                                                                                                                                                          |
| Secrets/env vars              | None                                                                                                                                                                                                                                                                                                                                                                                                | None                                                                                                                                                                                                                                                          |
| Build artifacts               | None — no package/schema changes requiring reinstall                                                                                                                                                                                                                                                                                                                                                | None                                                                                                                                                                                                                                                          |
| **Repurposed existing field** | `DraftClientView.benchIds` (`types.ts:1095`) and `DraftSession.homeBenchIds`/`awayBenchIds` (`types.ts:1069-1071`) are currently **pre-match-only** and discarded once `GameState` is constructed at kickoff (confirmed: no `bench` field exists anywhere in the current `GameState` type, `types.ts:1100+`). D-01 requires carrying this concept forward into live match state for the first time. | Code edit: `buildInitialGameState` must accept the confirmed bench-player-id list (already computed pre-match by the existing lineup/draft flow) and store it as `GameState.bench`, instead of letting it fall out of scope after `LINEUP_CONFIRM`            |
| **Repurposed existing field** | `piece.onPitch?: boolean` (`types.ts:76`) — Phase 39's own doc comment explicitly warns: _"This flag is a pure client-rendering signal, independent of `redCarded`'s rules meaning — do not repurpose it for Phase 40 (Substitutions) roster/bench semantics; SUB-01..07 need their own data model."_                                                                                               | **Do not reuse `onPitch` for substitution bookkeeping.** Confirmed by direct code-comment inspection — this is an explicit, named guardrail left by Phase 39 for Phase 40. Substitution needs its own field(s); see Open Questions for the recommended shape. |

**Canonical question answered:** After every file in the repo is updated, the only "runtime systems" holding old state are the two `GameState` construction call sites (`buildInitialGameState`, `buildReplayFrames`) — both are in-process TypeScript functions, not external state. No data migration is needed; this is greenfield field addition, not a rename.

## Common Pitfalls

### Pitfall 1: Forgetting to register the new `SUBSTITUTION` ActionEvent in all three Undo/Replay bookkeeping locations

**What goes wrong:** A new dice-roll or state-mutating event type is invisible to Undo/Replay unless registered in every relevant list.
**Why it happens:** This is a documented, recurring bug class in this exact codebase — STATE.md "Key Pitfalls to Avoid": _"new dice-roll event types are invisible to Undo/Replay unless registered in every relevant list (isBoundary server + client mirror, REPLAY_ELIGIBLE_TYPES, possibly ELIGIBLE_NEXT_ACTIONS) — this bug class has already shipped twice (BUG-30/31, BUG-37)."_
**How to avoid:** When adding the `SUBSTITUTION` `ActionEvent` member, update all three locations in the same task: (1) server `isBoundary` reduce in `applyUndo` (`gameEngine.ts:2930` region), (2) client-mirrored `isBoundary` reduce in `ActionPanel.tsx:295` (and any other panel that independently mirrors it, e.g. `CornerKickSetupPanel.tsx:245`, `FreeKickSetupPanel.tsx:173` — check whether a substitution-specific panel needs its own mirror or whether `ActionPanel`'s generic logic already covers it), (3) `REPLAY_ELIGIBLE_TYPES` set (`gameEngine.ts:9191`). Note: since a substitution is likely **not** meant to be undoable (it's a discrete, deliberate roster commitment, not a mid-sequence dice outcome) or replayable-as-a-frame in the same way movement is, the correct action may be _deliberately excluding_ `SUBSTITUTION` from these sets (mirroring how `SECOND_HALF_CONFIRM` and `GK_BOX_ENTRY_MOVE` are deliberately excluded per `gameEngine.ts:9251-9254`) — but this must be an explicit, documented decision at plan time, not an accidental omission. Flag this as a required decision point in planning.

### Pitfall 2: Re-rolling `addedTime` or double-counting the accumulator

**What goes wrong:** The existing `addedTime` set-once-per-half guard (`gameEngine.ts:2444-2451`, "Pitfall 3 — prevents re-roll") could be bypassed if the new accumulator logic is inserted incorrectly, either re-triggering the roll or adding `addedTimeBonus` twice (once at increment time, once at fold-in time).
**Why it happens:** `applyEndTurn` has **4 separate return sites** that all set `addedTime: newAddedTime` (`gameEngine.ts:2468, 2498, 2571, 2602`), not one — a fix applied to only one branch will silently miss the others (this exact multi-site pitfall is called out generically in STATE.md: _"v1.6 out-of-bounds detection touches 5+ independent existing clamp-to-pitch call sites — audit each individually rather than fixing one and assuming the rest follow"_, and the same audit discipline applies here).
**How to avoid:** `addedTimeBonus` should be a simple running total incremented once per completed substitution (in `applySubstitution`, not in `applyEndTurn`). `applyEndTurn`'s existing `newAddedTime = roll + state.refereeCard.leniency` line (singular, computed once per branch entry) becomes `newAddedTime = roll + state.refereeCard.leniency + state.addedTimeBonus` — apply this change to all 4 return sites identically, in the same task, verified by grep for `newAddedTime =` before considering the change complete.

### Pitfall 3: Confusing the per-half accumulator reset with the whole-match substitution cap

**What goes wrong:** D-07 explicitly warns these are independent counters that must not be conflated — `subsUsed` never resets (whole match), `addedTimeBonus` resets every half.
**Why it happens:** Both are "substitution-related counters on GameState," making it easy to write one reset call that accidentally clears both, especially since half-time is also the natural place someone might think to "clean up" substitution-related state.
**How to avoid:** At the `HALF_TIME` transition return site in `applyEndTurn` (`gameEngine.ts:2457-2476`), explicitly reset `addedTimeBonus: 0` alongside the other half-boundary resets already present there (`movedPieceIds: []`, `paceUsedByPieceId: {}`, `...THROW_IN_TEARDOWN`) — but do NOT touch `subsUsed`, which must carry through unchanged in the same spread.

### Pitfall 4: Ambiguous stage-granularity in `STOPPAGE_PHASES` silently under- or over-scoping SUB-01

**What goes wrong:** SUB-01 names 7 stoppage types in prose; the `GamePhase` union has far more discrete values than 7 (e.g. 5 phase values for corner kick alone). A too-narrow list makes substitution unavailable when a manager reasonably expects it to be (e.g. mid-corner-kick-repositioning); a too-broad list makes it available during moments that aren't really "stoppages" in the rulebook sense (e.g. `GK_KICK_MOVE`, where the ball is actively traveling).
**Why it happens:** No existing precedent in this codebase collapses a multi-stage restart flow into a single "is this a stoppage" boolean — every existing per-phase list (`validUndoPhases`, `ELIGIBLE_NEXT_ACTIONS`) was built value-by-value against a specific, narrower need.
**How to avoid:** See "Open Questions" below — this needs an explicit decision at plan time, not silent inference. Recommend defaulting to "every phase value that belongs to a named stoppage flow's _setup/reposition_ stages" (ball is dead) and excluding phases where the ball is already in flight or a duel is actively resolving (e.g. `GOAL_KICK_MOVE`, `CORNER_KICK_...` header contest via `HEADER`, `PENALTY_KICK` itself).

### Pitfall 5: Building a brand-new "no substitute available" fallback that duplicates Phase 39's D-06

**What goes wrong:** Phase 39's INJURY-03 already has a "second injury forces substitution, falls back to degraded attributes if none available" rule, deliberately stubbed to always take the fallback branch in Phase 39 (D-06: _"Phase 39 always takes the 'no substitute available' branch... Phase 40 later adds the actual forced-substitution trigger that reads this same injury state."_).
**Why it happens:** Someone planning Phase 40 fresh might not realize this specific integration point already has a named, documented hook waiting for it.
**How to avoid:** When wiring the forced-2nd-injury substitution trigger (this is the "soft dependency" on Phase 39 mentioned in the phase description), locate the exact spot in Phase 39's shipped code where the "no substitute available" fallback currently always fires unconditionally, and add the real availability check (`bench[team].length > 0 && subsUsed[team] < 3`) there — do not build a parallel/new injury-substitution pathway.

### Pitfall 6: GK-lock precedent doesn't apply to red-carded on-pitch cards — different rejection reason, same visual mechanism

**What goes wrong:** `LineupStatCard`'s existing GK-lock behavior (`isDraggable = allowGKDrag ? !lineupConfirmed : !isGK && !lineupConfirmed`, `LineupAssignmentScreen.tsx:127`) is structurally similar to what's needed for red-carded cards (`draggable={false}`) but is driven by a different boolean (`isGK`, not `piece.redCarded`). A naive copy-paste risks conflating "this is the goalkeeper slot" logic with "this specific player is red-carded" logic, which have different downstream implications (GK lock is permanent and slot-based; red-card lock is player-based and only applies mid-match, never pre-match).
**How to avoid:** Add a distinct `isDraggable` condition for midmatch mode: `mode === 'midmatch' ? !piece.redCarded && !lineupConfirmed-equivalent : (existing GK logic)`. Keep the two conditions structurally separate in code, not merged into one combined boolean expression, so future changes to either don't cross-contaminate.

## Code Examples

Verified patterns from the actual, already-shipped codebase (all file:line references confirmed via direct read this session):

### Existing drag-and-drop swap flow (D-01/D-04's reuse target)

```typescript
// Source: packages/client/src/components/LineupAssignmentScreen.tsx:351-381
function handleDragStart(e: React.DragEvent<HTMLDivElement>, idx: number) {
  setDragSourceIndex(idx);
  e.dataTransfer.setData('text/plain', String(idx));
  e.dataTransfer.effectAllowed = 'move';
}

function handleDrop(e: React.DragEvent<HTMLDivElement>, targetIdx: number) {
  e.preventDefault();
  const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (targetIdx !== 0 && sourceIdx !== targetIdx) {
    onSwap(sourceIdx, targetIdx);
  }
  setDragSourceIndex(null);
  setDropTargetIndex(null);
}
```

For midmatch mode, `onSwap(sourceIdx, targetIdx)` becomes `onSubstitute(outPieceId, inPieceId)` — the drag-state plumbing (source index tracking, dataTransfer payload) is identical; only the emitted callback's semantics change (swap two lineup slots vs. substitute one player onto another's slot).

### Existing card/injury chip precedent — already shipped, do not duplicate (top-left panel)

```typescript
// Source: packages/client/src/components/PlayerStatsPanel.tsx:149-170 (Phase 39, already built)
const cardColor: 'yellow' | 'red' | null =
  piece.redCarded === true ? 'red' : (piece.yellowCards ?? 0) > 0 ? 'yellow' : null;
if (!cardColor) return null;
return (
  <span data-testid="stats-card-chip" data-card={cardColor} className={styles.cardChip}>
    {cardColor.toUpperCase()}
  </span>
);
// ...
{(piece.injuryCount ?? 0) > 0 && (
  <span data-testid="stats-injury-chip" className={styles.injuryChip}>
    {(piece.injuryCount ?? 0) >= 2 ? 'INJ ×2' : 'INJ'}
  </span>
)}
```

This exact `cardColor`/injury-count derivation logic should be extracted or duplicated (small enough to duplicate without a shared-helper refactor being mandatory) into the new sub-roster-row rendering inside `LineupAssignmentScreen.tsx`'s `LineupStatCard`, per D-05's "genuinely new" badge surface.

### Existing added-time roll (D-06/D-07's exact extension point)

```typescript
// Source: packages/server/src/gameEngine.ts:2440-2451 — ONE of 4 return-site occurrences;
// all 4 must be updated identically (see Pitfall 2)
if (nextSlot === null) {
  const newActionCount = state.actionCount + GAME_SPEED_MINUTES[state.gameSpeed];
  const HALF_LENGTH = state.half * 45;
  let newAddedTime = state.addedTime;
  if (newActionCount >= HALF_LENGTH && state.addedTime === null) {
    const roll = options?.addedTimeRoll ?? 3;
    newAddedTime = roll + state.refereeCard.leniency; // ← D-06: add `+ state.addedTimeBonus` here
  }
  // ...
}
```

### Existing flat allow-list precedent (Pattern 1's direct template)

```typescript
// Source: packages/server/src/gameHandlers.ts:1651-1665
const validUndoPhases: GamePhase[] = [
  'MOVE',
  'HIGH_PASS_MOVE',
  'FIRST_TIME_PASS_MOVE',
  'GK_KICK_MOVE',
  'SNAPSHOT_DEFLECT',
  'FREE_MOVE_ATTACK',
  'FREE_MOVE_DEFENSE',
  'FREE_KICK_SETUP',
  'GOAL_KICK_SETUP_GK',
  'GOAL_KICK_SETUP_OPPONENT',
  'GOAL_KICK_MOVE',
  'CORNER_KICK_REPOSITION',
  'CORNER_KICK_FINAL_SETUP',
];
if (room.gameState === null || !validUndoPhases.includes(room.gameState.phase)) {
  socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
  broadcastState(io, room);
  return;
}
```

### Existing `PlayerPiece` red-card field (D-08/D-09's read target — do not repurpose `onPitch`)

```typescript
// Source: packages/shared/src/types.ts:59-76 (Phase 39, already shipped)
injuryCount?: number;
yellowCards?: 0 | 1 | 2;
redCarded?: boolean;
/** ... do not repurpose it for Phase 40 (Substitutions) roster/bench semantics;
 *  SUB-01..07 need their own data model. */
onPitch?: boolean;
```

## State of the Art

| Old Approach                                                                               | Current Approach                                                                                                                                    | When Changed          | Impact                                                                                                                      |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `LineupAssignmentScreen` is pre-match only; bench discarded after `LINEUP_CONFIRM`         | Bench concept carried into live `GameState` for the first time                                                                                      | This phase (Phase 40) | New `GameState.bench` field; two construction sites (`buildInitialGameState`, `buildReplayFrames`) must be updated together |
| `addedTime` is a single flat roll, computed once                                           | `addedTime` becomes `roll + leniency + addedTimeBonus`, with `addedTimeBonus` a live per-half accumulator                                           | This phase            | 4 return sites in `applyEndTurn` need the identical one-line change                                                         |
| Red-carded pieces are visually hidden (`onPitch: false`) but stay in `pieces[]` (Phase 39) | Substituted-out pieces need an analogous "still exists, but excluded from active play" representation — exact mechanism is an open question (below) | This phase            | Determines whether `pieces` array length stays constant (22) or shrinks/grows across substitutions                          |

**Deprecated/outdated:** Nothing in this phase deprecates prior work — it is purely additive to the v1.6 milestone's existing FSM.

## Assumptions Log

| #   | Claim                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Section                                               | Risk if Wrong                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `STOPPAGE_PHASES` should include every setup/reposition-stage `GamePhase` value belonging to a named restart flow, but exclude in-flight/duel-active phases (`GOAL_KICK_MOVE`, `PENALTY_KICK`, `HEADER`, `GK_KICK_MOVE`) and ambiguous GK-chain/foul-chain phases (`GK_RESTART`, `GK_KICK_TARGET`, `GK_QUICK_THROW`, `FOUL_CHOICE`, `GK_DIVE_AT_FEET_PROMPT`, `GK_DIVE_AT_FEET_TARGET`, `GK_BOX_ENTRY_PROMPT`, `GK_BOX_ENTRY_MOVE`) pending explicit confirmation | Architecture Patterns / Pattern 1, Common Pitfalls #4 | If wrong: substitution either unavailable during a stoppage the user expects it in (under-scope, user-visible friction), or available mid-duel/mid-flight in a way that breaks the mental model of "stoppage" (over-scope, rules-fidelity bug). This is the single highest-leverage confirmation needed before planning locks the list. |
| A2  | Substituted-out pieces should follow the Phase 39 `redCarded`/`onPitch: false` precedent — stay in `state.pieces` with a new flag (e.g. `subbedOut: true`) rather than being spliced out of the array — so existing array-length-assuming code (22-piece squad displays, replay reconstruction) doesn't need defensive rewrites                                                                                                                                   | Runtime State Inventory, Code Examples                | If wrong (i.e. if the array is meant to shrink to 21/20 pieces per substitution instead): every piece-counting/iteration site in `gameEngine.ts` that assumes 11-per-team needs an audit, a substantially larger change than the flag-based approach                                                                                    |
| A3  | `maxOnPitch`/`redCardCount` should be computed live from `pieces.filter(p => p.teamId === team && p.redCarded).length` rather than stored as a separate incrementing counter field, since Phase 39 already tracks `redCarded` per-piece and a derived count avoids a second source of truth that could drift                                                                                                                                                      | Architecture Patterns, Pattern 1 area / D-08          | If wrong (i.e. if a stored counter is preferred to match `subsUsed`'s explicit-counter style for consistency): low risk either way — both are correct, this is a style/consistency preference, not a correctness question. Flag for planner discretion.                                                                                 |
| A4  | The `SUBSTITUTION` `ActionEvent` should likely be excluded from Undo (a substitution is a deliberate roster commitment, not an accidentally-triggered dice sequence) but should still appear in the match log/`ActionLog.tsx` for visibility                                                                                                                                                                                                                      | Common Pitfalls #1                                    | If wrong (i.e. if Undo should cover a just-made substitution, e.g. "oops, wrong player"): missing Undo support would be a UX gap, not a correctness bug — lower risk than over-scoping Undo and hitting the same bug class already shipped twice (BUG-30/31, BUG-37)                                                                    |

**Confirm A1 explicitly during planning** — it directly gates SUB-01 acceptance criteria and is the one item in this research not resolvable by reading existing code (it requires a judgment call SUB-01's prose doesn't fully disambiguate).

## Open Questions

_All three questions below were resolved during planning (across the initial plan and two subsequent revision passes for D-10/D-12/D-13) — see each item's RESOLVED note._

1. **Exact `STOPPAGE_PHASES` membership (SUB-01 stage-granularity)** — RESOLVED
   - What we know: SUB-01 names 7 stoppage types; each maps to 1–8 discrete `GamePhase` values in the current union (mapped exhaustively above); `.planning/research/ARCHITECTURE.md` proposed an illustrative-but-incomplete list (`gameHandlers.ts`-era draft, written before Phase 39's `PENALTY_KICK_*`/`FOUL_CHOICE`/`GK_*` phases existed).
   - What's unclear: Whether "kick-off" in SUB-01 means only `KICK_OFF_SETUP` (repositioning) or also the immediately-following `KICK_OFF` phase itself; whether "penalty kick" means the full `PENALTY_KICK_SETUP_ATTACKING` → `PENALTY_KICK_TAKER_SELECT` chain or excludes the live `PENALTY_KICK` duel phase; whether `GK_RESTART`/`GK_KICK_TARGET`/`GK_QUICK_THROW` (the GK-catch/save restart chain, structurally separate from "goal kick" per Phase 37's explicit design) should count as a stoppage at all, since SUB-01's prose doesn't name it.
   - RESOLVED: Locked to the 15-value list in `40-01-PLAN.md` Task 1 (kick-off/half-time/free-kick/throw-in setup, all goal-kick setup/choice, all corner-kick, all penalty setup/taker-select phases), with inline exclusion comments for `KICK_OFF`, in-flight/duel phases, the `GK_RESTART` chain, and Phase 39's decision-prompt phases. Presented to and confirmed by the user rather than silently assumed, per the recommendation below.
   - (Original recommendation, superseded by the locked list above:) Resolve via `/gsd-discuss-phase` follow-up or explicit planner decision before locking `STOPPAGE_PHASES` — Assumption A1 above is the recommended default (setup/reposition stages yes, in-flight/duel stages no, GK-restart-chain and foul-choice excluded) but should be presented to the user as a confirmable list, not silently assumed.

2. **Representation of a substituted-out player in `state.pieces`** — RESOLVED
   - What we know: Phase 39 established a precedent (`onPitch: false`, piece stays in array) for a structurally similar problem (red-carded player is gone from play but shouldn't vanish from data structures) and explicitly flagged that this specific field must NOT be reused for Phase 40's purposes.
   - RESOLVED: `state.pieces` itself is untouched by a substitution — the incoming substitute _takes over the departing player's slot object_ (id, number, position preserved), so `pieces.length` stays 22 and no new per-piece "subbed out" flag was needed on `PlayerPiece` at all. The outgoing player's unavailability is tracked separately, on their `BenchEntry.status` (`'available' | 'subbedOut' | 'redCarded'`, `40-01-PLAN.md` Task 2) — a different, simpler resolution than either option this question originally posed.
   - (Original recommendation:) Follow the same shape as `redCarded`/`onPitch` (Assumption A2) — keeps `pieces.length` stable at 22 for the whole match. (The stable-`pieces.length` goal was achieved, but via slot-takeover rather than a new flag.)

3. **Whether `GameState.bench` needs full `PlayerPiece`-shaped entries or just id references** — RESOLVED
   - What we know: Pre-match `benchIds: string[]` (just ids) is resolved to full player data via `PLAYER_MAP`/`getSquadPlayers` lookups client-side (`LineupAssignmentScreen.tsx:37-38`, `resolveTieredCard`). Server-side, bench players are not yet `PlayerPiece` objects (no `position`, no per-match mutable state like `injuryCount`) until they're substituted onto the pitch.
   - RESOLVED: Landed between the two options — `BenchEntry = { playerId: string; jerseyNumber: number; status: BenchEntryStatus }` (`40-01-PLAN.md` Task 2). Slightly richer than plain id references (carries `jerseyNumber` and `status` alongside the id) but still far short of a full `PlayerPiece` — no `position` or other per-match mutable state. The `status` field also absorbs D-13's later requirement (red-carded players relocated onto the bench, marked distinctly from `'subbedOut'`), which wasn't yet known when this question was first written.
   - (Original recommendation:) Keep `GameState.bench: { home: string[]; away: string[] }` (id references only, mirroring `benchIds`) — superseded once `status` and `jerseyNumber` proved necessary.

## Environment Availability

Not applicable — this phase has no new external tool/service/runtime dependencies. It extends the existing Node.js/Socket.io/React/TypeScript stack already running in this project with no new packages.

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest (confirmed by prior-phase precedent: `--pool=forks` flake workaround noted in project memory for this exact monorepo) |
| Config file        | `packages/*/vitest.config.ts` (per-package, existing)                                                                        |
| Quick run command  | `pnpm --filter @counter-attack/server test -- gameEngine` (or equivalent scoped run)                                         |
| Full suite command | `pnpm test` (root, runs all workspace packages)                                                                              |

### Phase Requirements → Test Map

| Req ID      | Behavior                                                                                                  | Test Type                                                      | Automated Command                                                        | File Exists?                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| SUB-01      | Substitution allowed only during `STOPPAGE_PHASES`, rejected otherwise                                    | unit (engine)                                                  | `pnpm --filter @counter-attack/server test -- gameEngine.substitution`   | ❌ Wave 0 — new test file                                             |
| SUB-02      | `GAME_SUBSTITUTION` handler replaces exactly one player per action                                        | unit (handler)                                                 | `pnpm --filter @counter-attack/server test -- gameHandlers.substitution` | ❌ Wave 0                                                             |
| SUB-03      | Substitute inherits jersey number + position/slot                                                         | unit (engine)                                                  | same file as SUB-01                                                      | ❌ Wave 0                                                             |
| SUB-04      | 3-per-match cap, never resets at half-time                                                                | unit (engine) — include a full-match/half-boundary scenario    | same file as SUB-01                                                      | ❌ Wave 0                                                             |
| SUB-05      | +1 added-time minute per completed substitution, per-half reset                                           | unit (engine) — extend existing `applyEndTurn`/addedTime tests | existing `gameEngine` addedTime test file (extend, not new)              | ✅ extend existing                                                    |
| SUB-06      | Red-carded player cannot be replaced                                                                      | unit (engine)                                                  | same file as SUB-01                                                      | ❌ Wave 0                                                             |
| SUB-07      | Subbed-out player never returns; roster screen shows "unavailable"                                        | unit (engine) + component (`LineupAssignmentScreen.test.tsx`)  | `pnpm --filter @counter-attack/client test -- LineupAssignmentScreen`    | ✅ extend existing (`LineupAssignmentScreen.test.tsx` already exists) |
| SETTINGS-04 | Substitution available regardless of `foulsEnabled`/`bookingEnabled`/`injuryEnabled`/`outOfBoundsEnabled` | unit (engine) — parametrized across toggle combinations        | same file as SUB-01                                                      | ❌ Wave 0                                                             |

### Sampling Rate

- **Per task commit:** scoped `pnpm --filter <package> test -- <touched-file-pattern>`
- **Per wave merge:** full package test run (`pnpm --filter @counter-attack/server test`, `pnpm --filter @counter-attack/client test`)
- **Phase gate:** `pnpm test` (full monorepo suite) green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/server/src/gameEngine.test.ts` (or a new `gameEngine.substitution.test.ts`) — covers SUB-01, SUB-02, SUB-03, SUB-04, SUB-06, SETTINGS-04 (engine-level `applySubstitution` unit tests)
- [ ] `packages/server/src/gameHandlers.test.ts` (extend or new) — covers the `GAME_SUBSTITUTION` handler's `isProcessing`/phase-guard/error-code behavior
- [ ] Extend existing `gameEngine`'s added-time test coverage — covers SUB-05's accumulator fold-in across all 4 `applyEndTurn` return sites
- [ ] Extend `packages/client/src/components/LineupAssignmentScreen.test.tsx` — covers `mode="midmatch"` rendering (OUT badge, sub-counter chip, non-draggable red-carded card, permanent-slot-cap note)
- [ ] New `packages/shared/src/stoppagePhases.test.ts` (or fold into an existing shared-predicates test file) — covers `isStoppagePhase()` against the full `GamePhase` union, once Open Question 1 is resolved

_(No framework install needed — Vitest is already fully configured across all three packages.)_

## Security Domain

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V2 Authentication     | No      | This project has no user-account auth layer (room-code-based ephemeral sessions only, per project CLAUDE.md)                                                                                                                                                                                                                                                       |
| V3 Session Management | No      | No new session-management surface introduced by this phase                                                                                                                                                                                                                                                                                                         |
| V4 Access Control     | Yes     | Server must independently re-validate every substitution constraint (stoppage phase, cap, red-card, no-return) — never trust client-side `isStoppagePhase`/disabled-button state, since Socket.io events can be emitted directly bypassing the UI (standard "server-authoritative" project convention, STATE.md "Decisions Locked")                                |
| V5 Input Validation   | Yes     | `outPieceId`/`inPieceId` from the `GAME_SUBSTITUTION` payload must be validated as: (a) existing piece ids belonging to the emitting socket's own team, (b) `outPieceId` currently on-pitch, (c) `inPieceId` currently on the bench and not already subbed out — mirrors the existing validation depth already applied to `LINEUP_SWAP`/`DRAFT_REARRANGE` payloads |
| V6 Cryptography       | No      | Not applicable — no crypto/secrets touched by this phase                                                                                                                                                                                                                                                                                                           |

### Known Threat Patterns for this stack

| Pattern                                                                                                  | STRIDE                               | Standard Mitigation                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client emits `GAME_SUBSTITUTION` for the opponent's team, or with a piece id belonging to the opponent   | Spoofing / Elevation of Privilege    | Server handler must check `socketTeam(socket)` against the team implied by `outPieceId`/`inPieceId`, exactly as every other action handler in `gameHandlers.ts` already does (e.g. the `isActivePlayer`/`controlsAttackingTeam` precedent used throughout) |
| Client emits `GAME_SUBSTITUTION` outside a stoppage phase (bypassing the disabled button)                | Tampering                            | Server-side `isStoppagePhase(room.gameState.phase)` check in the handler — never rely on client button `disabled` state alone (already the project's universal convention)                                                                                 |
| Double-submit race (rapid double-click before broadcast reflects the new `subsUsed` count)               | Tampering / Repudiation (accidental) | `room.isProcessing` mutex — already the project's universal per-room guard, applies unchanged to this new handler                                                                                                                                          |
| Client claims a bench player is not yet subbed out when server state says otherwise (stale client cache) | Tampering                            | Server is the sole source of truth for `bench[team]`/subbed-out status; validate against `room.gameState`, never trust any client-supplied "this player is available" flag                                                                                 |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)

- `packages/client/src/components/LineupAssignmentScreen.tsx` (full file, 727 lines) — drag-and-drop mechanics, `draftMode`/mode branching precedent, `LineupStatCard` structure
- `packages/client/src/components/BenchCarousel.tsx` (full file) — bench rendering/drag-source mechanics
- `packages/client/src/components/PlayerStatsPanel.tsx` (full file) — confirmed card/injury chip already shipped (Phase 39), corrects CONTEXT.md D-05's framing
- `packages/client/src/components/PieceOverlay.tsx` (full file) — confirmed on-pitch badge design/position, confirmed `redCarded`/`yellowCards`/`injuryCount` read pattern
- `packages/client/src/components/GameBoard.tsx` (relevant sections) — `SideLog` persistent-button precedent, `pitchRow`/`pitchContainer` structure, phase-dispatch ternary location
- `packages/shared/src/types.ts` (relevant sections) — `PlayerPiece`, `BallState`, `GameState`, `DraftSession`, `DraftClientView`, `GamePhase` union (full, all ~60 members read), `RefereeCard`
- `packages/server/src/gameEngine.ts` (relevant sections) — `applyEndTurn`'s exact 4 addedTime return sites, `buildInitialGameState`, `buildReplayFrames`'s replay-seed construction, `REPLAY_ELIGIBLE_TYPES`, `isBoundary` Undo reduce
- `packages/server/src/gameHandlers.ts` (relevant sections) — `validUndoPhases` allow-list idiom (exact template for `STOPPAGE_PHASES`)
- `packages/shared/src/teamConfig.ts` — `getSquadPlayers` full-roster lookup
- `.planning/research/ARCHITECTURE.md` — pre-existing, milestone-scoped architecture research answering this phase's core structural question (Q4) in detail, written 2026-08-03 specifically for this milestone
- `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-CONTEXT.md` — D-04/D-05/D-06 precedent and explicit soft-dependency hooks for Phase 40

### Secondary (MEDIUM confidence)

- `.planning/phases/40-substitutions/40-CONTEXT.md` and `40-UI-SPEC.md` — user-locked decisions and UI contract (authoritative for scope/behavior, cross-checked against code where verifiable)

### Tertiary (LOW confidence)

- None — this research required no external web sources; the entire domain is internal-codebase-convention-driven per the same reasoning `.planning/research/ARCHITECTURE.md` used ("this question is scoped entirely to conventions already established in this specific codebase, not general ecosystem practice, so codebase inspection is the authoritative source").

## Metadata

**Confidence breakdown:**

- Standard stack (internal patterns): HIGH — every pattern cited is read directly from committed, shipped source in this session
- Architecture: HIGH — the core structural question was already answered by dedicated milestone research (`ARCHITECTURE.md` Q4) and independently re-verified against the now-shipped Phase 37/38/39 code
- Pitfalls: HIGH — sourced from this project's own documented recurring-bug-class history (STATE.md) plus direct inspection of the exact multi-site `addedTime` logic that must be modified
- STOPPAGE_PHASES exact membership: MEDIUM/LOW — genuinely underdetermined by SUB-01's prose; flagged as Open Question 1 / Assumption A1 rather than silently resolved

**Research date:** 2026-08-15
**Valid until:** Stable for the remainder of v1.6 (no fast-moving external dependency); re-verify only if Phase 39's shipped `GamePhase` union changes before Phase 40 planning begins (unlikely — Phase 39 status is "Complete")
