# Phase 11: Rule Correctness - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 fixes 5 server-side rule correctness bugs identified in v1.0 UAT: high-pass accuracy roll display ordering (RULE-01), header contestant duel sequencing (RULE-02), snapshot shot-path clearing (RULE-03), SNAP_DEFLECT highlight bounds (RULE-04), and post-deflect both-teams Movement Phase activation (RULE-05).

**In scope:**

- Restructure high-pass → header FSM so accuracy roll result is displayed before contestant selection begins
- Move header duel execution to fire when both teams confirm contestants; winning contestant's team then selects target hex
- Audit all shot/snapshot resolution branches to ensure `lastShotPath: null` is set before the next phase
- Client-side: suppress move highlights in SNAP_DEFLECT when `snapDeflectPaceUsed >= 2`
- Diagnose and fix client highlight logic producing no valid moves after snapshot deflect → LOOSE_BALL → MOVEMENT

**Out of scope:**

- Visual/layout changes (Phase 12, 13)
- New gameplay rules or mechanics
- v2 features (fouls, corners, etc.)

</domain>

<decisions>
## Implementation Decisions

### RULE-01: High Pass Accuracy Result Display

- **D-01:** Use a flag on the HEADER state rather than adding a new phase. Add a `headerAccuracyRollPending: boolean` (or equivalent) field to `GameState`. When a HIGH_PASS accuracy check resolves, the state enters HEADER with this flag `true`. The client shows the roll result and waits for the attacking team to acknowledge before revealing contestant selection UI. Once acknowledged, the flag clears and contestant selection proceeds.
- **D-02:** No new `GamePhase` union value is needed for RULE-01. The fix is state-flag driven, keeping the FSM minimal.

### RULE-02: Header Contestant Duel Sequencing

- **D-03:** The duel fires automatically when the second team confirms their contestant (inside `GAME_HEADER_CONTESTANT` handler). No separate trigger event. The `GAME_HEADER_CONTESTANT` handler fires the duel as soon as both `headerConfirmed.home` and `headerConfirmed.away` are true.
- **D-04:** Duel result is broadcast with the winning contestant identified (`headerDuelWinner: 'home' | 'away'`). The winning contestant's position becomes the valid header range centre.
- **D-05:** After the duel resolves, the **winning team** (not the original attacking team) selects the target hex via `GAME_HEADER_TARGET`. The attacker-only guard in the current `GAME_HEADER_TARGET` handler must be replaced with a winner-team guard.
- **D-06:** `headerTargetHex` validation must check that the selected hex is within header range of the **winning contestant's position**, not the ball position or any attacker.

### RULE-03: Snapshot Shot-Path Clearing

- **D-07:** Fix by auditing every shot and snapshot resolution branch in `gameHandlers.ts` and `gameEngine.ts`. Each branch must explicitly set `lastShotPath: null` before transitioning to the next phase. Do NOT add clearing to `applyStartMovement` — fix is targeted, not defensive.
- **D-08:** Branches to audit: GOAL paths, SAVE/GK_RESTART paths, LOOSE_BALL deflection paths from both regular shots and snapshots. Confirm all already set `lastShotPath: null` or add it where missing.

### RULE-04: SNAP_DEFLECT Highlight Suppression

- **D-09:** Client-side fix. In the client highlight calculation, when `phase === 'SNAP_DEFLECT'` and `snapDeflectPaceUsed >= 2`, return an empty valid-move set. No server changes needed — `snapDeflectPaceUsed` is already broadcast in state.

### RULE-05: Post-Deflect Both-Teams Movement

- **D-10:** The bug is client-side in the highlight calculation. After snapshot deflect → LOOSE_BALL → MOVEMENT via `applyStartMovement`, no pieces are shown as selectable for either team (observed in UAT). Root cause diagnosis is scoped to the planning/execution phase.
- **D-11:** The server FSM appears correct: `ELIGIBLE_NEXT_ACTIONS['DEFLECTION']` includes `'MOVEMENT'`, `applyStartMovement` accepts `LOOSE_BALL` phase, and the 4-5-2 slot sequence covers both teams. The planner should focus on client highlight logic — likely checking `activeTeam`, `movementSlot`, or `attackingTeam` assignment after the LOOSE_BALL → MOVEMENT transition.

### Claude's Discretion

- Exact field name for the accuracy-roll-pending flag in HEADER state (`headerAccuracyRollPending`, `headerAccuracyShown`, or similar) — match the existing naming convention in `types.ts`
- Exact field name for `headerDuelWinner` — follow the `headerConfirmed` / `headerContestants` naming pattern
- Whether the client's `GAME_HEADER_ACKNOWLEDGMENT` event (for clearing the accuracy-roll-pending flag) reuses an existing event or adds a new lightweight one

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Header Flow — Server

- `packages/server/src/gameEngine.ts` — `applyRoll` PASS branch (HIGH_PASS → HEADER transition, ~line 1040–1084); HEADER branch (~line 1356–1668); `applyDeclareHeaderTarget`
- `packages/server/src/gameHandlers.ts` — `GAME_HEADER_CONTESTANT` handler (~line 1863–1919); `GAME_HEADER_TARGET` handler (~line 1780–1860)
- `packages/shared/src/types.ts` — `GameState` type (add `headerAccuracyRollPending`, `headerDuelWinner` fields); `GamePhase` union

### Shot/Snapshot Path Clearing

- `packages/server/src/gameHandlers.ts` — SNAP_DEFLECT resolution block (~line 754–842); all `lastShotPath` assignments
- `packages/server/src/gameEngine.ts` — `applyRoll` SHOT branch (~line 1109–1355); all `lastShotPath: null` assignments at lines ~1179, 1255, 1328

### SNAP_DEFLECT Client Highlights

- `packages/client/src/` — wherever valid-move hex sets are computed for SNAP_DEFLECT (useGameStore, HexGrid, or highlight util); find via `grep -rn "SNAP_DEFLECT" packages/client/`
- `packages/shared/src/types.ts` — `snapDeflectPaceUsed` field on `GameState`

### Post-Deflect MOVEMENT

- `packages/client/src/` — client highlight logic for MOVEMENT phase; piece selectability calculation per `movementSlot` and `activeTeam`; find via `grep -rn "movementSlot\|ATTACKER_4\|DEFENDER_5" packages/client/`
- `packages/server/src/gameEngine.ts` — `applyStartMovement` (~line 187–225); SLOT_SEQUENCE definition (~line 47)

### Requirements Reference

- `.planning/REQUIREMENTS.md` — RULE-01 through RULE-05 definitions

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `headerConfirmed: { home: boolean, away: boolean }` pattern in `GameState` — same pattern to use for `headerDuelWinner`
- `HIGH_PASS_MOVEMENT` phase flag pattern — existing double-team-reposition phase; same flag-based approach now applied to RULE-01 accuracy result display
- `GAME_HEADER_CONTESTANT` both-confirmed guard — the existing check at handler line ~1907 is the insertion point for the RULE-02 duel trigger
- `broadcastState` after every handler action — mandatory for all new state transitions

### Established Patterns

- `isProcessing` mutex on all game handlers — any new handler or handler branch must use it
- `ELIGIBLE_NEXT_ACTIONS` sequence table — new phases/sub-states must be represented correctly
- `controlsAttackingTeam` vs `socketTeam` guards — RULE-02 changes `GAME_HEADER_TARGET` from attacker-guard to winner-team guard
- `lastShotPath: null` explicit in each resolution branch — RULE-03 follows this same per-branch explicit null pattern

### Integration Points

- `packages/shared/src/types.ts` `GameState` interface — fields `headerAccuracyRollPending`, `headerDuelWinner` added here; consumed by client and server
- `packages/client/src/` highlight calculation — RULE-04 and RULE-05 fixes both live here; exact file TBD during planning
- `GAME_HEADER_CONTESTANT` handler — RULE-02 duel trigger inserted here

</code_context>

<specifics>
## Specific Ideas

- User confirmed: the accurate pass should log, then proceed to contestant selection (flag-based, not phase-based)
- User confirmed: winner of the header duel owns target hex selection — this includes defenders heading the ball away if they win
- User confirmed: RULE-05 no-highlights bug observed during movement phase progression (ATTACKER_4 through DEFENDER_5 — all slots blank); client-side investigation approach preferred

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 11-rule-correctness_
_Context gathered: 2026-06-11_
