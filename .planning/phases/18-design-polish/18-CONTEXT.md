# Phase 18: Design Polish - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 18 closes out the v1.2 milestone. It now covers four distinct workstreams, all gathered in this discussion:

1. **Messaging & logging consistency (DESIGN-01)** — action panel labels, phase prompts, scoreboard text, and log entries are rewritten to follow one naming convention (locked below).
2. **Replay review (DESIGN-02, REPLAY-06)** — post-game replay re-render/socket-emission audit, plus the live-session ball-tracking carry-forward fix from v1.1.
3. **Code cleanup (DESIGN-03, DESIGN-04)** — duplicate logic consolidation and dead code removal, explicitly including two known behavioral defects (the folded stale-selection todo, superseded by BUG-09 below, and BUG-11).
4. **Bug-bash addendum (BUG-06..BUG-11)** and **UX enhancements addendum (UX-07..UX-14)** — gathered mid-discussion (2026-06-20) and formally added to REQUIREMENTS.md/ROADMAP.md following the same addendum pattern used for OFFSIDE-01/02 in Phase 17.

Plus the trivial **MATCH-06** requirement-text rewrite (doc-only, no code).

**Scope warning (explicit user decision):** This phase is now large enough that `/gsd-plan-phase` may return `## PHASE SPLIT RECOMMENDED`. The user was told this and chose to fold everything in anyway rather than spin out a separate phase now — **accept a split recommendation if the planner returns one.**

</domain>

<decisions>
## Implementation Decisions

### DESIGN-01: Messaging & Logging Consistency — Naming Convention (LOCKED)

The user provided a concrete, partially-worked example of the target convention. Treat it as the canonical pattern and extrapolate it to every `GamePhase` not explicitly listed below, using the same style (plain verb/noun, no "-ING", no redundant "PHASE" suffix in display text even though the internal enum value may say `_PHASE`/`_MOVE`/etc.):

```
PASS (internal GamePhase value) — currently mislabeled "CHOOSING ACTION"
  Scoreboard: {UPPER team name} CHOOSE ACTION
  Log:        {UPPER team name} CHOOSE ACTION

STANDARD_PASS (as an action, not a phase)
  Scoreboard: {UPPER team name} STANDARD PASS
  Log:        {UPPER team name} STANDARD PASS

MOVE (GamePhase)
  Scoreboard: {UPPER team name} MOVE
  Log:        {UPPER team name} MOVE

KICK_OFF (GamePhase)
  Scoreboard: {team name} KICKOFF
  Log:        {team name} KICKOFF

  Sub-actions within MOVE's 4-5-2 slot sequence get a numbered suffix:
    ATTACKER_4 slot  → Scoreboard: {team name} MOVE 4
    DEFENDER_5 slot  → Scoreboard: {team name} MOVE 5
    ATTACKER_2 slot  → Scoreboard: {team name} MOVE 2

  Per-player move logging (one log line per activated piece, updated in place
  as that piece's path grows):
    Log: [team-color] [MOVE] {firstName} {lastName} | 19,14 → 18,15 → 17,15 → 16,16

  Helper text while in a move slot:
    "Move up to {# players to move} players."
    If max pace is not null, append: "Max pace {max pace}."
    While a specific piece is mid-move: "Moving player {n}. {step} of {total} steps."
```

- **D-01:** Apply this same pattern (TEAM + plain VERB/NOUN, numbered suffix only where an existing numbered-slot concept exists) to every other `GamePhase` value currently in `PHASE_LABEL` (GameBoard.tsx:17-43): `KICK_OFF_SETUP`, `SNAPSHOT_TARGET`, `GK_DIVE`, `SNAPSHOT_DEFLECT`, `SHOT`, `HEADER`, `SNAPSHOT`, `LOOSE_BALL`, `HIGH_PASS_MOVE`, `GK_RESTART`, `GK_QUICK_THROW`, `GK_KICK_TARGET`, `GK_KICK_MOVE`, `FREE_MOVE_ATTACK`, `FREE_MOVE_DEFENSE`, `FIRST_TIME_PASS_MOVE`, `FREE_KICK_SETUP`, `HALF_TIME`, `FULL_TIME`, `REPLAY`. Known concrete errors to fix while doing this sweep:
  - `GK_DIVE` phase is still labeled `'GK DIVING'` (stale — the phase value itself was renamed `GK_DIVING` → `GK_DIVE` in Phase 17.1's D-11 rename, but the display label was never updated to match).
  - `PASS` is labeled `'CHOOSING ACTION'` (gerund form) — rename per the convention above to `'CHOOSE ACTION'`.
- **D-02:** This is a scoreboard/log naming convention, not a new abstraction requirement — implement it as data (a lookup table), the same shape as the existing `PHASE_LABEL` map. Do not introduce a templating engine for this.
- **D-03 (dice-roll logging):** Every dice roll that resolves an action must be logged in the format `{player stat} + {roll} - {penalty}` (e.g., a tackle roll: `Tackling 4 + 3 - 0 = 7`). Audit `DICE_ROLL`/`TACKLE_ATTEMPT`/`STEAL_ATTEMPT`/`SHOT_ATTEMPT`/`HEADER` cases in `ActionLog.tsx` (case blocks at lines 180, 220, 205, 275, 326) for this format; apply uniformly where a stat+roll+penalty triple exists. Where no penalty applies, render `- 0` (don't omit the term — consistency over brevity, per the messaging-consistency goal).
- **D-04:** This naming-convention sweep IS the deliverable for DESIGN-01 — there is no separate "tone audit" pass. Errors, omissions, or inconsistencies the planner/executor finds while doing this sweep (stale terminology, contradictory wording) should be fixed inline.

### DESIGN-02 / REPLAY-06: Replay Review

- **D-05:** No specific symptom was reported for DESIGN-02. Treat it as an open-ended, clean-room audit of `startReplayStream`/`roomStore.ts` (server) and `ReplayPanel.tsx` (client) for unnecessary re-renders or redundant socket emissions, observable via React DevTools profiler / browser Network tab. Document findings before fixing if the root cause isn't obvious from a first read.
- **D-06:** REPLAY-06 (live-session ball tracking — pickups, intercepted passes, steals mid-replay) likewise has no new repro beyond what's already in REQUIREMENTS.md/PROJECT.md ("Known tech debt: REPLAY-06 live-session ball tracking edge cases deferred"). This remains an open investigation — read `.planning/phases/14-kick-off-rules-replay/` artifacts (replay was introduced/iterated there) before starting.

### DESIGN-03 / DESIGN-04: Duplicate/Dead Code Removal — Risk Tolerance

- **D-07 (confirmed in scope, not "too risky"):** Known _behavioral_ defects that are also duplicate-logic gaps are IN SCOPE for this phase, not just inert dead code. Specifically: BUG-11 below (HIGH_PASS_MOVE carrier exclusion — same fix pattern as the already-shipped FIRST_TIME_PASS_MOVE fix) and the previously-pending stale-selection todo (superseded by BUG-09 below — see Folded Todos).
- **D-08:** Stay limited to genuinely inert code for everything else flagged by DESIGN-03/04: unused exports, unreachable branches, stale TODO comments, legacy feature flags. Do not go looking for additional behavioral bugs beyond what's explicitly listed in this CONTEXT.md's bug-bash section — that scope is closed as of this discussion.
- **D-09:** The 4 pre-existing RED test failures documented in STATE.md (2 MOVE-06 FREE_MOVE scaffolding gaps, 2 abandoned firstTimePassStep design stubs) remain explicitly out of scope — they were deliberately deferred past Phase 17.1, and nothing in this discussion changes that.

### Bug-Bash Addendum (BUG-06..BUG-11)

- **BUG-06:** `offsidePieceIds` must reset to `[]` for ALL players (not just the offending player) when a free-kick restart concludes. D-43 (Phase 17) added a full reset on `GAME_FREE_KICK_READY`'s both-ready transition, and D-47 generalized it to kick-off — read both before fixing; this is reported as a regression/incomplete case of that existing logic, not a net-new feature. Find the actual gap (likely a code path that bypasses the reset, e.g. a kick taken via a different transition than the one D-43/D-47 patched).
- **BUG-07:** After a header duel is won, drop the target-selection sub-phase entirely — deliver the resulting pass directly. Read `gameEngine.ts`'s `GAME_HEADER_TARGET` handler and the `HEADER`→pass-delivery flow (Phase 17.1 D-05, "multi-contestant header... confirmed done"). The post-header pass must be: (a) non-contestable (no interception roll/ZoI — mirrors the existing BUG-01 fix that already suppresses interception for header-derived passes, `lastActionType === 'HEADER'` in `applyPass`), and (b) labeled/logged as `HEADER`, not as a one-touch/first-time-pass action type.
- **BUG-08:** Once a defender's `stealAttemptedByIds` flag is set for a piece (a failed steal attempt), the attacker must be able to move freely adjacent to that defender — no threat tint, no repeat steal challenge. This is the per-action-type ZoI exclusion already specified in Phase 17.1's D-02 (`packages/shared/src/moveValidator.ts`) and the HexGrid risk-tint filtering fix from 17.1-09 (`.planning/debug/zoi-tackle-steal-exclusion.md`). Report indicates this exclusion is not fully working for the steal case — re-verify both the validator-side exclusion and the client-side `zoiRiskSet` tint filter against `stealAttemptedByIds` (not just `tackleAttemptedByIds`).
- **BUG-09 (supersedes/broadens the folded todo — see Folded Todos):** During ANY response-move phase (`HEADER` contestant repositioning, `SNAPSHOT_DEFLECT`, `FIRST_TIME_PASS_MOVE`, `HIGH_PASS_MOVE`, `GK_KICK_MOVE`, `FREE_KICK_SETUP` stages, etc.), the active piece's move-ring highlight must clear once (a) that piece has used its phase-imposed pace allowance, or (b) End Turn hands control to the opponent. Root cause is the same `slotChanged`-style staleness class documented in the original todo (`useGameStore.ts:511`) — that fix only covered `movementSlot`/`firstTimePassMovementSlot`/`highPassMovementSlot`/`gkKickMovementSlot` comparisons; the broader fix here must also cover pace-exhaustion (not just slot hand-off) as a clear condition.
- **BUG-10:** Clicking an already-activated (already-moved, `movedPieceIds.includes(id)`) player piece must still open/select that piece's player card — same click handler path as unmoved pieces, just don't allow it to also re-trigger move-target highlighting.
- **BUG-11:** Apply the FIRST_TIME_PASS_MOVE carrier-exclusion fix pattern (Phase 17.1-16: `firstTimePassCarrierId` set at FTP transition, excluded from `GAME_MOVE` repositioning onto the pass target, preserved across undo, cleared at delivery) identically to `HIGH_PASS_MOVE`'s `highPassCarrierId`, which already exists on `GameState` but is never consumed as an exclusion. Mirror the exact 3 touch points from 17.1-16: server `GAME_MOVE` HP handler (reject `pieceId === highPassCarrierId` before the lock check), delivery occupant lookup (exclude the passer), and the client `selectPiece` HP branch (UX-only mirror).

### UX Enhancements Addendum (UX-07..UX-14)

- **UX-07 (game speed):** A Slow/Standard/Fast selector (default Standard) on the team-selection screen (`TeamSelectionScreen.tsx`). **Confirmed semantics:** there is no movement animation (CLAUDE.md: "Animations... static state updates only") and the match clock is event-driven off `actionCount`, not a wall clock (D-08/D-09, Phase 13: minutes derived from `actionCount`, seconds always `:00`). The speed setting changes how many clock-minutes increment per completed MOVE action: Slow = +1 min, Standard = +2 min (current/default behavior), Fast = +3 min. This is a multiplier/lookup change on the existing actionCount→minutes derivation, not a new animation or timer system. Store the selection somewhere accessible to both players for the match's duration (likely alongside `selectedTeams` in `GameState`, set during the same team-selection flow).
- **UX-08 (end-turn confirmation + button color):** Any End Turn (or header Confirm Selection) action that would end a phase while eligible pieces remain unmoved/unplaced shows a confirm dialog: "{N} players left to move, are you sure you want to end your turn?" with Cancel (return to the phase, no state change) and Confirm (proceed) options. Applies to every phase that tracks a moved/placed-pieces count: `MOVE` slots, `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`, `HIGH_PASS_MOVE`, `FIRST_TIME_PASS_MOVE`, `GK_KICK_MOVE`, `FREE_KICK_SETUP` stages, and `HEADER` contestant confirm-selection. The End Turn / Confirm Selection button itself renders orange while eligible moves remain (i.e., ending now would cut off options) and green once all eligible pieces for that phase have been moved/placed.
- **UX-09 (final-third marker):** Render a red boundary-line marker across the top and bottom of the board at each team's final-third boundary (reuse `PITCH_REGIONS` zone boundaries already used for `ballZone`/MOVE-06 — no new geometry needed, just a new visual layer in `HexGrid.tsx`/`GameBoard.tsx`).
- **UX-10 (Free Move helper text):** Rewrite the `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` helper text to explain the mechanic ("ball entered the opposite final third — your backline can reposition up to 6 hexes regardless of remaining pace") and show the count of still-eligible players, mirroring UX-11's pattern.
- **UX-11 (movement helper text — player count):** `MOVE` phase helper text tracks and displays "{N} players left to move," mirroring the header-contestant-selection helper pattern already in the codebase.
- **UX-12 (stat tooltip):** Hovering a stat bubble (`StatRow` in `GameBoard.tsx:53-60`, also used in `PlayerStatsPanel.tsx`) shows the full stat name (e.g., hovering "TKL" shows "Tackling"). Plain title-attribute or lightweight tooltip — no new dependency needed for a single-line label.
- **UX-13 (action button tooltip):** Hovering an action button in `ActionPanel.tsx` shows a short one-line summary of what that action does.
- **UX-14 (event banner):** A transient (1-second) centered banner for key events: goal ("GOOOOOAL!!!"), interception ("INTERCEPTION!!"), tackle/turnover ("Tackle! Turnover!"). Triggered off the same `ActionEvent` types already logged in `ActionLog.tsx` (`GOAL`, `STEAL_ATTEMPT`/`TACKLE_ATTEMPT` success cases, interception within `STANDARD_PASS`/etc. interception loop) — no new event types needed, just a new client-side banner component subscribed to the existing event stream.

### MATCH-06 (doc-only)

- **D-10:** Rewrite the `MATCH-06` requirement text in `REQUIREMENTS.md` to the perspective-neutral wording already drafted in `PROJECT.md`'s Active section: "each team's DEF/MID within symmetric columns of kick-off hex." No code change — this is purely correcting requirement documentation to match already-shipped behavior.

### Claude's Discretion

- Exact tooltip implementation (native `title` attribute vs. a small custom tooltip component) for UX-12/UX-13 — whichever is more consistent with existing patterns once the planner/executor reads the current component structure.
- Exact CSS/animation treatment for the UX-14 event banner (fade in/out timing, exact styling) — keep it simple; this is a 1-second transient overlay, not a major UI feature.
- Where exactly the game-speed selection (UX-07) is persisted in `GameState` and how it's threaded through to the clock-derivation function — follow whichever existing pattern (`selectedTeams`-style field set during team selection) fits the actual `buildInitialGameState`/team-selection flow once read.
- Extrapolating the DESIGN-01 naming convention to phases not explicitly given an example (D-01's list) — apply the same plain-verb-and-noun style; no need to ask the user per-phase.
- Exact wording for BUG-07's "non-contestable, labeled as header" pass log line — follow the same `[team-color] [ACTION] ...` log-line shape already established for other action types in `ActionLog.tsx`.

### Folded Todos

- **`.planning/todos/pending/2026-06-20-fix-stale-client-selection-on-ftp-hp-slot-handoff.md`** ("Fix stale client selection on FTP/HP slot hand-off") — folded into this phase, but **superseded/broadened by BUG-09** above rather than implemented as originally scoped. The original todo only covered `firstTimePassMovementSlot`/`highPassMovementSlot`/`gkKickMovementSlot` slot-hand-off staleness in `useGameStore.ts`'s `slotChanged` check; BUG-09 additionally requires clearing the stale highlight on pace-exhaustion (not just slot hand-off) and covers more response-move phases (`HEADER`, `SNAPSHOT_DEFLECT`, `FREE_KICK_SETUP`). Implementing BUG-09 fully resolves this todo — delete the todo file as part of closing BUG-09, don't implement them as two separate fixes.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements (updated 2026-06-20 during this discussion)

- `.planning/REQUIREMENTS.md` — DESIGN-01..04, REPLAY-06, MATCH-06 (original Phase 18 scope) + new `## Bug Bash (Addendum — Phase 18)` (BUG-06..BUG-11) and `## UX Enhancements (Addendum — Phase 18)` (UX-07..UX-14) sections, plus updated Traceability table
- `.planning/ROADMAP.md` §Phase 18 — updated Requirements list, Success Criteria (now 6 items), and a note anticipating a possible `## PHASE SPLIT RECOMMENDED` planner response

### Prior Phase Decisions Still in Force

- `.planning/phases/17-rule-bugs/17-CONTEXT.md` — D-43 (full offside reset on free-kick taken), D-47 (generalized to kick-off restart) for BUG-06; D-25/D-42 (offside ring rendering pattern) for visual-layer precedent
- `.planning/phases/17.1-action-flow-cleanup/17.1-CONTEXT.md` — D-02 (per-action-type ZoI exclusion) for BUG-08; D-11 (GamePhase rename sweep, including the `GK_DIVING`→`GK_DIVE` rename whose label was never updated) for DESIGN-01; D-03 (FIRST_TIME_PASS_MOVE two-slot design, used as BUG-11's fix template)
- `.planning/debug/zoi-tackle-steal-exclusion.md` — root-cause diagnosis for the original ZoI exclusion fix; read before re-diagnosing BUG-08
- `.planning/todos/pending/2026-06-20-fix-stale-client-selection-on-ftp-hp-slot-handoff.md` — original (narrower) version of BUG-09; delete once BUG-09 is fixed

### Key Source Files to Read Before Planning

- `packages/client/src/components/GameBoard.tsx` — `PHASE_LABEL` map (lines 17-43, DESIGN-01 target), `StatRow` (lines 53-60, UX-12)
- `packages/client/src/components/ActionLog.tsx` — per-event-type log formatting (case blocks listed in D-03/decisions above), DESIGN-01 + UX-14 target
- `packages/client/src/components/ActionPanel.tsx` — End Turn / Confirm Selection rendering (UX-08), action button hover targets (UX-13)
- `packages/client/src/store/useGameStore.ts` — `slotChanged` check (~line 511, BUG-09)
- `packages/client/src/components/HexGrid.tsx` — `zoiRiskSet` tint filtering (BUG-08), final-third marker rendering (UX-09)
- `packages/client/src/components/PlayerStatsPanel.tsx` — stat display (UX-12)
- `packages/client/src/components/TeamSelectionScreen.tsx` — game speed selector placement (UX-07)
- `packages/client/src/components/ReplayPanel.tsx` — DESIGN-02 target
- `packages/server/src/roomStore.ts` — `startReplayStream`, `broadcastState` (DESIGN-02, BUG-06's reset-on-restart logic lives near here or in `gameHandlers.ts`)
- `packages/server/src/gameEngine.ts` — `applyPass` HEADER suppression (BUG-07 template), `GAME_HEADER_TARGET`/header delivery flow (BUG-07), HIGH_PASS_MOVE handler (BUG-11), offside reset logic (BUG-06)
- `packages/shared/src/moveValidator.ts` — ZoI exclusion logic (BUG-08)
- `packages/shared/src/offside.ts` — `triggerOffsideFoul`, reset logic (BUG-06)
- `packages/shared/src/types.ts` — `GameState.highPassCarrierId` (already exists, unused — BUG-11), `selectedTeams` shape (precedent for UX-07's speed-selection field)

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `PHASE_LABEL: Record<GamePhase, string>` (GameBoard.tsx) — same shape extends naturally to the DESIGN-01 naming sweep; no new data structure needed, just corrected/expanded values
- `firstTimePassCarrierId` exclusion pattern (Phase 17.1-16) — copy-paste template for BUG-11's `highPassCarrierId` fix
- `isOffside` red-ring layer (PieceOverlay.tsx) and the "green moved-this-stage" ring pattern (D-55, Phase 17) — both are precedent for adding new independent boolean-driven visual layers without disturbing `selectionState`; relevant if UX-08's color-state or BUG-09's highlight-clearing touches `PieceOverlay.tsx`
- `ballZone`/`PITCH_REGIONS` final-third boundaries (Phase 17, MOVE-06) — reuse directly for UX-09's visual marker, no new geometry

### Established Patterns

- `apply*` handler shape in `gameEngine.ts` — all bug-bash server fixes follow this existing pattern
- `lastActionType` discrimination — already used to suppress header-pass interception (BUG-01 precedent for BUG-07's "non-contestable" requirement)
- Per-slice Zustand selectors — UX-07's game speed value should be read the same way `selectedTeams` is

### Integration Points

- DESIGN-01's naming convention touches both server (`ActionEvent` types feeding the log) and client (`PHASE_LABEL`, `ActionLog.tsx` rendering) — coordinate so the log text and scoreboard text stay in sync per the convention table
- UX-07 (game speed) likely needs a new `GameState` field set during team selection, read by whatever function currently derives clock minutes from `actionCount`
- UX-08's "eligible pieces remaining" count must read from whichever per-phase tracking field already exists (`movedPieceIds`, `freeKickPlacedPieceIds`, `firstTimePassMovedPieceId`, etc.) — there is no single unified field today, so this touches multiple phase branches

</code_context>

<specifics>
## Specific Ideas

- The DESIGN-01 naming-convention example (KICK_OFF_PHASE → "KICKOFF", MOVE_PHASE → "MOVE", numbered MOVE 4/5/2 suffixes for the 4-5-2 slot sequence, per-player move log with hex-path arrows `19,14 → 18,15 → ...`) is the literal target shape — match it precisely for the phases it covers, extrapolate the same style elsewhere.
- Dice-roll log format: `{stat} + {roll} - {penalty}` for every roll, always showing the `- {penalty}` term even when penalty is 0.
- UX-14 banner copy: "GOOOOOAL!!!" (goal), "INTERCEPTION!!" (interception), "Tackle! Turnover!" (successful tackle/steal causing possession change) — these are the user's literal example strings, reuse them.

</specifics>

<deferred>
## Deferred Ideas

None beyond what's already captured as addenda above — both the bug-bash and UX-enhancement items the user raised were explicitly folded into this phase's scope rather than deferred.

</deferred>

---

_Phase: 18-design-polish_
_Context gathered: 2026-06-20_
