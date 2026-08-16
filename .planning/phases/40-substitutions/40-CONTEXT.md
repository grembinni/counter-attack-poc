# Phase 40: Substitutions - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Managers can substitute players at any stoppage under a 3-per-match cap, with number/position inheritance, added-time contribution, and restrictions on red-carded or previously-substituted players — regardless of which other v1.6 toggles are enabled. Covers SUB-01..07, SETTINGS-04. Depends on Phase 39 (soft — only the forced-2nd-injury trigger and red-card non-replacement rule read Phase 39 state). Does not build formation change, referee-leniency tuning, a settings-screen advanced dropdown, or a referee-leniency scoreboard display — all explicitly raised during discussion and deferred (see Deferred Ideas).

</domain>

<decisions>
## Implementation Decisions

### Bench/roster data source & UI

- **D-01:** The in-match substitution UI **reuses the existing `LineupAssignmentScreen` component and its drag-and-drop mechanics** — the same screen and process already used post-draft/pre-game to confirm the lineup. Not a new screen built from scratch; adapt this component to also operate on live `GameState` mid-match. This directly resolves the research's open question about where the bench data model comes from: **`GameState.bench` is seeded at kickoff from whatever the pre-game `LineupAssignmentScreen` left as unselected (its existing `benchIds` concept)**, carried forward into live match state instead of being discarded at `LINEUP_CONFIRM` as it is today.
- **D-02:** No new pre-match "matchday squad selection" step — the bench is simply every roster player not placed in the starting 11, exactly as `LineupAssignmentScreen` already produces today for both Draft and Standard modes (`draftMode` prop gates draft-specific behavior; the underlying lineup/bench split is common to both).
- **D-03:** The Roster/substitution screen mid-match is opened via a **persistent button** (top-band or side panel, per the research's suggestion), enabled only during a stoppage (`isStoppagePhase(phase)`, the already-locked `STOPPAGE_PHASES` allow-list from `.planning/research/ARCHITECTURE.md` Q4). This is not a per-phase `GameBoard.tsx` dispatch case — matches the research's explicit recommendation that substitution UI should NOT follow the per-phase panel pattern, since it's phase-independent within the stoppage set.
- **D-04:** Mid-match substitution is constrained to **1-for-1 swaps only** (SUB-02's literal wording: "each substitution action replaces exactly one player") — reusing `LineupAssignmentScreen`'s drag-and-drop interaction, but each confirmed action is gated through the new `GAME_SUBSTITUTION` handler (subsUsed < 3, red-card cap, no-return-once-subbed-out), unlike the free pre-match rearrangement the same screen allows before kickoff.

### Card/injury badges

- **D-05:** Card (yellow/red rectangle) and injury (plus-sign) badges — already built on-pitch pieces in Phase 39 (`PieceOverlay.tsx`, corner-of-piece placement, D-04/D-05 of `39-CONTEXT.md`) — are **added to two more surfaces using the same visual style**: (1) the sub-roster rows on the reused `LineupAssignmentScreen`, and (2) the existing top-left "player card" component shown during gameplay (`PlayerStatsPanel.tsx`), which today has no card/injury indicator at all. The existing on-pitch piece badge design/position is **not changed**.

### Added-time accumulation

- **D-06:** `addedTime` today is a single flat value rolled once when `actionCount` first crosses minute 45/90 (`roll + refereeCard.leniency`, `gameEngine.ts:2444-2451`) — there is no existing accumulator for incremental contributions from in-match events, and substitutions can happen well before that roll fires. Add a **new per-half running accumulator field** (e.g. `GameState.addedTimeBonus: number`), incremented by 1 on every completed substitution for either team, **regardless of when in the half it happens**. When the `addedTime` roll fires at minute 45/90, fold the accumulator in: `newAddedTime = roll + state.refereeCard.leniency + state.addedTimeBonus`.
- **D-07:** The accumulator is **per-half** — it resets to 0 at half-time, so each half's `addedTime` roll only reflects that half's own substitutions. This differs from SUB-04's 3-substitution cap, which is explicitly whole-match and never resets — the two counters are independent and must not be conflated in implementation.

### SUB-06 permanent slot cap (folded from todo)

- **D-08:** A red card **permanently reduces the team's max on-pitch headcount**, independent of the 3-substitution allowance. Model as `maxOnPitch = 11 - redCardCount` per team (not a separate "blocked slots" counter) — substitution validation checks `pieces.filter(onPitch, team).length < maxOnPitch` as a distinct guard from `subsUsed[team] < 3`. A team with 1 red card is capped at 10 on-pitch players for the rest of the match even with substitutions still remaining; 2 red cards → 9; etc.
- **D-09:** The vacated slot is **unfillable the instant the red card is shown** — no grace substitution is offered for the sent-off player specifically. This mirrors real-world football and the original todo's framing.

### Empty-bench auto-fill (Standard rooms)

- **D-10:** Superseding D-02's framing that Standard rooms simply have no bench: **substitutions must work in all room flows**, not just Draft. At kickoff, if a team's bench (per D-01/D-02's derivation) is empty — the case for every Standard-mode 11-player squad — auto-seed that team's bench with **4 players randomly drafted from the common free-agent pool** (`PLAYER_POOL` entries with `sourceTeamId === 'free-agent'`, the same pool Draft mode already draws from), one of each of the four core `PoolPlayer.role` values: **GK, DEF, MID, FWD** (the `'ST'` role variant does not count toward the FWD slot). This applies only when the bench is empty at seed time — Draft-mode/any room that already has a non-empty bench from `LineupAssignmentScreen`'s pre-match split is unaffected. The 4 auto-filled players become ordinary bench entries — no special "auto-filled" flag or restriction beyond the normal substitution rules (3-per-match cap, 1-for-1, no-return).

### Forced-2nd-injury trigger (Phase 39 hook)

- **D-11:** Phase 39 (now shipped) deliberately stubbed its "second injury forces substitution" rule (INJURY-03) to always take the "no substitute available" fallback branch, with an explicit documented hook for Phase 40 to wire the real check (`39-CONTEXT.md` D-06: _"Phase 40 later adds the actual forced-substitution trigger that reads this same injury state"_). **In scope for this phase**: locate the exact spot in Phase 39's shipped code where this fallback always fires unconditionally, and replace it with a real availability check (`bench[team].length > 0 && subsUsed[team] < 3`) that, when true, performs a forced substitution through the same `applySubstitution`/roster-continuity mechanics as a manager-initiated one (auto-selecting a bench player, no manager drag-and-drop needed since play cannot pause for input at this trigger point) rather than building a parallel/new injury-substitution pathway.

### Claude's Discretion

- Exact `GameState`/`ActionEvent` field naming for the new `bench`, `subsUsed`, `addedTimeBonus`, `maxOnPitch`/`redCardCount` fields, following the codebase's existing flat-counter naming conventions (`actionCount`, `addedTime`).
- Internal mechanics of adapting `LineupAssignmentScreen` for mid-match use (e.g. whether it's rendered in a modal/overlay vs. an in-place swap) — the screen/interaction pattern is locked (D-01), the exact modal chrome is not.
- Exact placement/sizing of the new top-left player-card badge (D-05), so long as it visually matches the sub-roster style.
- Which bench player the forced-2nd-injury trigger (D-11) auto-selects when more than one is available (e.g. first-by-role-match, first-by-bench-order) — any deterministic, documented rule is acceptable.

### Folded Todos

- **`2026-08-16-sub-06-permanent-slot-cap-must-survive-substitutions.md`** — SUB-06 permanent slot cap. Original problem: during Phase 39 live testing, the user asked for a red-carded player's on-field slot to be permanently unfillable, confirmed to map onto the already-locked SUB-06 requirement, and explicitly scoped to Phase 40 since no bench/substitution data model existed yet. Resolved into D-08/D-09 above.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` (SUB-01..07, SETTINGS-04 sections, lines 50-56, 97) — locked requirement text for this phase
- `.planning/ROADMAP.md` (Phase 40 section, lines 416-429) — phase goal, 4 success criteria, soft dependency on Phase 39
- `.planning/STATE.md` — v1.6 "Decisions Locked" section: `STOPPAGE_PHASES`/`isStoppagePhase` allow-list idiom (not threaded through `ELIGIBLE_NEXT_ACTIONS`); general per-event-type Undo/Replay registration pitfall applies to the new `SUBSTITUTION` `ActionEvent`
- `.planning/todos/pending/2026-08-16-sub-06-permanent-slot-cap-must-survive-substitutions.md` — folded into D-08/D-09; also references `.planning/debug/resolved/red-card-bench-removal-scope.md` for the original Phase 39 triage evidence

### Architecture research (directly answers most of this phase's structural questions)

- `.planning/research/ARCHITECTURE.md` §"Q4 — Where do substitutions fit as a cross-cutting action reachable from many phases?" (lines 126-160) — `STOPPAGE_PHASES`/`isStoppagePhase` shape, `GAME_SUBSTITUTION` handler pattern, `applySubstitution(state, team, outPieceId, inPieceId)` pure-function shape, `SUBSTITUTION` `ActionEvent`, and the explicit open question about bench data source (resolved by D-01/D-02 above)
- `.planning/research/ARCHITECTURE.md` §"Anti-Pattern: Gating substitutions through `ELIGIBLE_NEXT_ACTIONS`" (lines 191-195) — do not add a `SUBSTITUTION` row to `NextActionType`/`ELIGIBLE_NEXT_ACTIONS`
- `.planning/research/ARCHITECTURE.md` Integration Points table (lines 199-215), specifically the "Bench/roster state" and "Cross-cutting action allow-list precedent" rows

### Prior-phase precedent

- `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-CONTEXT.md` D-04/D-05 — existing on-pitch card/injury badge design (corner-of-piece, ball-possession-dot sizing), explicitly NOT changed by this phase; D-06 — Phase 39's "no substitute available" fallback for a second injury, which this phase's actual forced-substitution trigger now supersedes

### Existing code (reuse targets)

- `packages/client/src/components/LineupAssignmentScreen.tsx` (full file, `draftMode` prop) — the screen/drag-and-drop mechanics D-01 reuses for mid-match substitution
- `packages/client/src/components/BenchCarousel.tsx`, `DraftPackCarousel.tsx` — supporting bench-rendering components used by `LineupAssignmentScreen`
- `packages/client/src/components/PlayerStatsPanel.tsx` — the top-left in-game "player card" component D-05 adds a card/injury badge to
- `packages/client/src/components/PieceOverlay.tsx` — existing on-pitch card/injury badge implementation (style reference for D-05, not itself modified)
- `packages/shared/src/teamConfig.ts:408-410` (`getSquadPlayers`) — full-roster lookup already used to build the pre-match lineup/bench split
- `packages/server/src/gameEngine.ts:2440-2451` — existing `addedTime` roll-and-set logic in `applyEndTurn`, the integration point for D-06/D-07's accumulator
- `packages/server/src/gameHandlers.ts:1130-1139` (`validUndoPhases`) — the flat `GamePhase[]` allow-list idiom `STOPPAGE_PHASES` replicates
- `packages/shared/src/types.ts:14-72` (`PlayerPiece`) — existing `yellowCards`/`redCarded`/injury-count fields the red-card cap (D-08/D-09) and no-return rule (SUB-07) read
- `packages/shared/src/types.ts:1086-1098` (`DraftClientView`, incl. `benchIds`) — the pre-match-only bench concept D-01/D-02 carry forward into live `GameState` instead of discarding

No other external specs/ADRs apply beyond the above — requirements are fully captured in the Decisions section.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `LineupAssignmentScreen.tsx` + `BenchCarousel.tsx` — direct reuse target for the mid-match Roster screen (D-01), already handles drag-and-drop bench↔slot assignment for both draft and standard modes.
- `validUndoPhases` flat allow-list idiom (`gameHandlers.ts:1130-1139`) — direct template for `STOPPAGE_PHASES`/`isStoppagePhase`.
- `PieceOverlay.tsx`'s corner-of-piece card/injury badge (Phase 39) — visual/positioning template to replicate (not modify) on the sub-roster and top-left player card.
- Existing inline `addedTime` roll-and-set logic (`gameEngine.ts:2444-2451`) — direct extension point for the new per-half accumulator.

### Established Patterns

- `isProcessing` mutex + phase-guard + pure-function-delegate shape for every socket handler — the new `GAME_SUBSTITUTION` handler should follow this exactly, per `.planning/research/ARCHITECTURE.md` Q4.
- Per-event-type registration required for Undo/Replay (recurring pitfall, flagged across Phases 37/38/39) — applies to the new `SUBSTITUTION` `ActionEvent` type.
- Flat per-team counter fields on `GameState` (`actionCount`, `addedTime`) — naming/shape precedent for `subsUsed`, `addedTimeBonus`, `maxOnPitch`/`redCardCount`.

### Integration Points

- `packages/server/src/gameHandlers.ts` — new `GAME_SUBSTITUTION` handler, gated by `isStoppagePhase(room.gameState.phase)` instead of `ELIGIBLE_NEXT_ACTIONS`.
- `packages/server/src/gameEngine.ts` — new pure `applySubstitution`; extend `applyEndTurn`'s existing `addedTime` roll logic with the D-06/D-07 accumulator.
- `packages/client/src/components/GameBoard.tsx` — add the persistent stoppage-gated substitution button (D-03); NOT a new phase-dispatch case.
- `packages/client/src/components/LineupAssignmentScreen.tsx` — adapt for mid-match live-`GameState` operation (D-01/D-04), constrained to single 1-for-1 swaps instead of free pre-match rearrangement.
- `packages/client/src/components/PlayerStatsPanel.tsx` — add card/injury badge (D-05).

</code_context>

<specifics>
## Specific Ideas

- Reuse `LineupAssignmentScreen` verbatim in spirit — "same screen and process as confirming lineup post-draft/pre-game" (user's own words) — rather than building a parallel roster UI.
- Card/injury badges on the sub roster and the top-left player card should visually match each other; the existing on-pitch piece badge is the style reference but is not itself being redesigned.
- `maxOnPitch = 11 - redCardCount` is the preferred field shape over a separate "blocked slots" counter — keeps the cap check readable as a simple headcount comparison.

</specifics>

<deferred>
## Deferred Ideas

Four items were raised during discussion and explicitly deferred by the user — none are Phase 40 scope:

- **Hide game-creation toggles under an advanced dropdown** — `GameSettingsScreen.tsx` UI reorganization, unrelated to substitutions. Future settings/UI phase.
- **Referee leniency roll range change (max 5, min 2)** — a Phase 39 rule-balance tweak to `RefereeCard.leniency` (currently `randomInt(1, 7)`), not a substitution mechanic. Note: Phase 39 already considered and explicitly rejected a _different_ leniency change (switching to 2d6-take-highest) — this is a new, distinct ask (clamping the existing roll's range) and should be evaluated fresh, not conflated with that prior rejection.
- **Display referee leniency on the scoreboard** — new UI feature (proposed: staggered with the yellow/red card count in a lower corner of the middle scoreboard), unrelated to substitutions.
- **Allow formation change from the sub screen** — initially miscaptured as in-scope during discussion, then explicitly corrected by the user to be deferred alongside the other three. SUB-02's requirement text ("each substitution action replaces exactly one player") does not cover formation changes; this is a genuine new capability for a future phase.

### Reviewed Todos (not folded)

- **`2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`** — matched Phase 40 by generic keyword overlap only (score 0.6, same recurring pattern seen matching Phases 31/35/36/37/38/39 previously). Not raised or discussed this session; a rendering defect unrelated to this phase's scope.
- **`2026-08-09-bug-offside-ring-after-goal.md`** — matched by generic keyword overlap only (score 0.6). Not raised or discussed this session; a rendering defect unrelated to this phase's scope.
- **`csv-consolidation-player-pool.md`** — matched by generic keyword overlap only (score 0.6). Not raised or discussed this session; a data-pipeline idea unrelated to this phase's scope.

</deferred>

---

_Phase: 40-Substitutions_
_Context gathered: 2026-08-15_
