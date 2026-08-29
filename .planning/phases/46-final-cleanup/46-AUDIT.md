# Phase 46 / Plan 46-03 — CLEANUP-07 / CLEANUP-12 Audit

**Audited:** 2026-08-29 (Plan 46-03, Task 3)
**Purpose:** closes the two inherently open-ended requirements of Phase 46 — CLEANUP-07 (every
step of a multi-step phase has help/info text) and CLEANUP-12 (redundant single-action multi-step
flows collapsed) — by making "audited, no gap" an evidenced conclusion rather than an assumption,
per CONTEXT.md D-01 (the audit must scan the codebase, not rely on a user-supplied list).

This file is the evidence artifact `/gsd-verify-work` reads for CLEANUP-07 and CLEANUP-12.

---

## Section 1 — CLEANUP-07: Help-Text Coverage

Enumerated directly from the `GamePhase` union in `packages/shared/src/types.ts` (lines 899-961)
— **45 members**. The table below has **45 rows** (one per union member) — the two counts match,
so no member was skipped or double-counted.

**Source column:** `carried forward` = already spot-audited by 46-RESEARCH.md's CLEANUP-07 section
(the v1.6/v1.7-era surfaces plus the pre-v1.6 `KICK_OFF`/`PASS`/`GK_DIVE` branches research
explicitly re-checked) and copied here rather than re-derived. `audited (46-03)` = newly read and
verified in this task — the pre-v1.6 `ActionPanel.tsx` branches 46-RESEARCH.md's Open Question 2
flagged as out of its time budget (`MOVE`, `SHOT`, `HEADER`, `LOOSE_BALL`, `SNAPSHOT`/
`SNAPSHOT_TARGET`, `GK_RESTART`/`GK_QUICK_THROW`/`GK_KICK_TARGET`/`GK_KICK_MOVE`), plus the four
phases no prior pass covered at all (`LOBBY`, `HALF_TIME`, `FULL_TIME`, `REPLAY`).

| # | Phase | Component | Heading? | Description/constraint? | Verdict | Source |
|---|-------|-----------|----------|--------------------------|---------|--------|
| 1 | `LOBBY` | — (none) | — | — | `n/a` | audited (46-03) |
| 2 | `KICK_OFF` | `ActionPanel.tsx` (PASS/KICK_OFF chooser) | Yes — "Kick-Off!" | Yes — "Play starts with a Standard Pass…" | `covered` | carried forward |
| 3 | `KICK_OFF_SETUP` | `KickOffSetupPanel.tsx` | Yes — "Kick-Off Setup" | Yes — `constraintRow` | `covered` | carried forward |
| 4 | `MOVE` | `ActionPanel.tsx` | Yes — "Move!" | Yes — "{N} of {M} players left to move." | `covered` | audited (46-03) |
| 5 | `PASS` | `ActionPanel.tsx` | Yes — "Choose an Action!" / pass-type step | Yes | `covered` | carried forward |
| 6 | `SNAPSHOT_TARGET` | `ActionPanel.tsx` | Yes — "Snapshot!" | Yes — "Select a goal hex to target." | `covered` | audited (46-03) |
| 7 | `GK_DIVE` | `ActionPanel.tsx` | Yes — "Attempt Save!" | Yes — "Dive to a highlighted hex (max 3 hexes)." | `covered` | carried forward |
| 8 | `SNAPSHOT_DEFLECT` | `ActionPanel.tsx` | Yes — "Snapshot — Deflection Attempt!" | Yes | `covered` | carried forward |
| 9 | `SHOT` | none | — | — | `deferred` | audited (46-03) |
| 10 | `HEADER` | `ActionPanel.tsx` | Yes — "Contest Header!" / "Header Won!" / accuracy-wait | Yes | `covered` | audited (46-03) |
| 11 | `SNAPSHOT` | none | — | — | `n/a` | audited (46-03) |
| 12 | `LOOSE_BALL` | `ActionPanel.tsx` | Yes — "Loose Ball!" (added this task) | Yes — "Resolving automatically…" (added this task) | `covered` (fixed) | audited (46-03) |
| 13 | `HIGH_PASS_MOVE` | `ActionPanel.tsx` | Yes — "High Pass Aerial Challenge!" | Yes | `covered` | carried forward |
| 14 | `GK_RESTART` | `ActionPanel.tsx` | Yes — "Keeper Restart!" | Yes — "Choose an action." | `covered` | audited (46-03) |
| 15 | `GK_QUICK_THROW` | `ActionPanel.tsx` | Yes — "Quick Throw!" | Yes — "Select a target hex (up to 11 hexes)." | `covered` | audited (46-03) |
| 16 | `GK_KICK_TARGET` | `ActionPanel.tsx` | Yes — "Punt!" | Yes — "Target anywhere except the opponent's final third." | `covered` | audited (46-03) |
| 17 | `GK_KICK_MOVE` | `ActionPanel.tsx` | Yes — "Ball in Air!" | Yes — "Move 1 player to receive the ball (max 3 hexes)." | `covered` | audited (46-03) |
| 18 | `FREE_MOVE_ATTACK` | `ActionPanel.tsx` | Yes — "Free Move!" | Yes — "{N} players still eligible to move…" | `covered` | carried forward |
| 19 | `FREE_MOVE_DEFENSE` | `ActionPanel.tsx` | Yes — "Free Move!" | Yes | `covered` | carried forward |
| 20 | `FIRST_TIME_PASS_MOVE` | `ActionPanel.tsx` | Yes — "First-Time Pass!" | Yes | `covered` | carried forward |
| 21 | `FREE_KICK_SETUP` | `FreeKickSetupPanel.tsx` | Yes — "Free Kick" | Yes — `constraintRow` (aligned this plan, Task 2) | `covered` | carried forward |
| 22 | `THROW_IN_SETUP` | `ThrowInSetupPanel.tsx` | Yes — "Throw-In" | Yes — `constraintRow` | `covered` | carried forward |
| 23 | `GOAL_KICK_SETUP_GK` | `GoalKickSetupPanel.tsx` | Yes — "Goal Kick" | Yes — `constraintRow` | `covered` | carried forward |
| 24 | `GOAL_KICK_SETUP_OPPONENT` | `GoalKickSetupPanel.tsx` | Yes — "Goal Kick" | Yes — `constraintRow` | `covered` | carried forward |
| 25 | `GOAL_KICK_CHOICE` | `GoalKickSetupPanel.tsx` | Yes — "Goal Kick" | Yes — "Choose an action." | `covered` | carried forward |
| 26 | `GOAL_KICK_TARGET` | `GoalKickSetupPanel.tsx` | Yes — "Goal Kick" | Yes — "Select a teammate to head the ball." | `covered` | carried forward |
| 27 | `GOAL_KICK_MOVE` | `GoalKickSetupPanel.tsx` | Yes — "Goal Kick" | Yes — "Ball in Air!" / "Move 1 player…" | `covered` | carried forward |
| 28 | `CORNER_KICK_GK_SETUP_ATTACKING` | `CornerKickSetupPanel.tsx` | Yes — "Corner Kick" | Yes — `constraintRow` | `covered` | carried forward |
| 29 | `CORNER_KICK_GK_SETUP_DEFENDING` | `CornerKickSetupPanel.tsx` | Yes — "Corner Kick" | Yes — `constraintRow` | `covered` | carried forward |
| 30 | `CORNER_KICK_TAKER_SELECT` | `CornerKickSetupPanel.tsx` | Yes — "Corner Kick" | Yes — "Choose a player to take the corner kick." | `covered` | carried forward |
| 31 | `CORNER_KICK_REPOSITION` | `CornerKickSetupPanel.tsx` | Yes — "Corner Kick" | Yes — "Reposition 1 player — up to 3 hexes." | `covered` | carried forward |
| 32 | `CORNER_KICK_FINAL_SETUP` | `CornerKickSetupPanel.tsx` | Yes — "Corner Kick" | Yes — "Choose High Pass or Low Pass." | `covered` | carried forward |
| 33 | `FOUL_CHOICE` | `FoulChoicePanel.tsx` | Yes — "Foul!" | Yes | `covered` | carried forward |
| 34 | `GK_DIVE_AT_FEET_PROMPT` | `GkDiveAtFeetPromptPanel.tsx` | Yes — "Dive at Feet?" | Yes | `covered` | carried forward |
| 35 | `GK_DIVE_AT_FEET_TARGET` | `GkDiveAtFeetPromptPanel.tsx` | Yes — "Dive at Feet" | Yes | `covered` | carried forward |
| 36 | `GK_BOX_ENTRY_PROMPT` | `GkBoxEntryPromptPanel.tsx` | Yes — "Goalkeeper Reposition?" | Yes | `covered` | carried forward |
| 37 | `GK_BOX_ENTRY_MOVE` | `GkBoxEntryPromptPanel.tsx` | Yes — "Goalkeeper Reposition?" | Yes | `covered` | carried forward |
| 38 | `TACKLE_STEAL_PROMPT` | `TackleStealPromptPanel.tsx` | Yes — "Challenge for the Ball?" | Yes | `covered` | carried forward |
| 39 | `PENALTY_KICK_SETUP_ATTACKING` | `PenaltyKickSetupPanel.tsx` | Yes — "Penalty Kick" | Yes — `constraintRow` | `covered` | carried forward |
| 40 | `PENALTY_KICK_SETUP_DEFENDING` | `PenaltyKickSetupPanel.tsx` | Yes — "Penalty Kick" | Yes — `constraintRow` | `covered` | carried forward |
| 41 | `PENALTY_KICK_TAKER_SELECT` | `PenaltyKickSetupPanel.tsx` | Yes — "Penalty Kick" | Yes — `constraintRow` | `covered` | carried forward |
| 42 | `PENALTY_KICK` | `PenaltyKickSetupPanel.tsx` | Yes — "Penalty Kick" | Yes — "Take your penalty kick." / "Waiting for the penalty kick…" | `covered` | carried forward |
| 43 | `HALF_TIME` | `GameBoard.tsx` (overlay) | Yes — "HALF TIME" | Yes — "Start 2nd Half" CTA / "Waiting for {opponent}…" | `covered` | audited (46-03) |
| 44 | `FULL_TIME` | `GameBoard.tsx` (overlay) | Yes — score + result text | Yes — "Replay starting…" | `covered` | audited (46-03) |
| 45 | `REPLAY` | `ReplayPanel.tsx` | Yes — "Replay" | Yes — "Playing…" / "Replay complete." | `covered` | audited (46-03) |

### Row-by-row evidence for the newly audited / non-`covered` rows

**#1 `LOBBY` — `n/a`.** Grepped every `phase: 'LOBBY'` assignment across
`packages/server/src/gameEngine.ts` and `packages/server/src/roomHandlers.ts` — zero production
call sites. `buildInitialGameState` (`gameEngine.ts:450`) seeds `phase: 'KICK_OFF_SETUP'`
directly; the only `phase: 'LOBBY'` occurrence anywhere in the codebase is an arbitrary
"not-a-real-phase" sentinel value inside one server unit test
(`gameEngine.phase8.test.ts:624`, commented `// not MOVEMENT, not PASS`). The pre-game lobby UI
is driven entirely by the separate `Screen` state machine (`LANDING`/`CREATE_ROOM`/`JOIN_ROOM`/
`WAITING`/`GAME_BOARD`/`REPLAY` — locked at Phase 13, STATE.md "Decisions Locked") via
`LobbyScreen.tsx` and friends, never by `GameState.phase`. `LOBBY` is a dead `GamePhase` union
member — not a reachable step, hence `n/a` rather than `gap`. Flagged below as a CLEANUP-13 note
(not removed in this task — see "Dead-code notes").

**#9 `SHOT` — `deferred`.** `SHOT` is primarily an internal one-tick engine-dispatch value: 3 of
the 5 `enterGkDiveOrSkip` call sites (`gameEngine.ts:5556`, `:5661`, `:9163`, `:9459`, plus
`gameHandlers.ts:1510`) resolve synchronously within the same handler invocation and the
resulting `phase: 'SHOT'` state is immediately overwritten before broadcast — same class as
`PASS`'s own step-3 "auto-emits GAME_ROLL — no step 3 needed" comment
(`ActionPanel.tsx:932-933`). However, two concrete call sites broadcast `phase: 'SHOT'` **without**
a same-tick auto-roll following it:
- `gameHandlers.ts:1510-1519` (`GAME_END_TURN`'s `SNAPSHOT_DEFLECT` resolution branch): when the
  defending GK's team already used its dive-at-feet interrupt this movement cycle,
  `enterGkDiveOrSkip` returns `{ phase: 'SHOT', ... }`, that state is assigned to
  `room.gameState` and `broadcastState(io, room)` is called, then the handler returns — no
  further roll.
- `gameHandlers.ts:4061-4189` (`GAME_HEADER_TARGET`'s goal-line routing, "site 2/4"): the same
  skip branch can fire via `applyResolveHeaderTarget`. The handler's own out-of-range auto-GOAL
  gate only checks `headerTargetState.phase === 'GK_DIVE'` (line 4078) — it does not check for
  `'SHOT'` — so when the skip branch fires, the code falls through to
  `room.gameState = headerTargetState;` / `broadcastState(io, room);` with no roll.

`ActionPanel.tsx` has no `phase === 'SHOT'` branch anywhere. In the (narrow, two-site) case where
this state actually reaches a client, the active-team player would see a blank panel (falls
through every branch to the final `return null`, since 'SHOT' matches nothing above it and, for
the active player, `!isActivePlayer` is false so the generic waiting panel never fires either).
This reads as a genuine dice-roll-resolution gap, not a copy-only help-text gap — fixing it
correctly requires an engine-level auto-roll (or extending the existing `phase === 'GK_DIVE'`
auto-GOAL gate to also cover `'SHOT'`), which is a logic change beyond "add a missing heading
line" and carries its own re-verification burden (confirming the two call sites are genuinely
reachable in live play, not just type-theoretically). Per the plan's explicit provision — "If a
gap is genuinely too large to fix as a copy addition… record it in the audit with an explicit
`deferred` verdict and a one-line reason, and surface it in the plan summary" — this is deferred
rather than fixed in this task. Surfaced in `46-03-SUMMARY.md`.

**#11 `SNAPSHOT` — `n/a`.** Grepped every `phase: 'SNAPSHOT'` (exact, excluding `_TARGET`/
`_DEFLECT`) across `packages/server/src/gameEngine.ts` and `gameHandlers.ts` — zero matches. The
Snapshot *action* always transitions to `phase: 'SNAPSHOT_TARGET'` (`gameEngine.ts:8864`,
`:8896`), recording `lastActionType: 'SNAPSHOT'` — a **different** field of a **different** type
(`LastActionType`, `types.ts:970-998`, which also happens to declare a `'SNAPSHOT'` member,
independently of `GamePhase`'s). `'SNAPSHOT'` as a `GamePhase` union member (`types.ts:910`) is
never assigned to `state.phase` anywhere in production code — a dead union member, same class as
`LOBBY` above. `n/a`, not `gap`. Flagged below as a CLEANUP-13 note.

**#12 `LOOSE_BALL` — `gap`, fixed in this task.** Before this fix, `ActionPanel.tsx` had an
auto-roll `useEffect` for `LOOSE_BALL` (`if (phase === 'LOOSE_BALL' && isActivePlayer) {
emitRoll(); }`) but no render branch for the phase at all. The non-active player fell through to
the generic `waitingPanel` (adequate: "Opponent's Turn" / "{side} team is taking their turn…"),
but the **active** player — the one whose auto-roll is in flight — fell through every phase check
to the final `return null`: a genuinely blank panel, no heading, no text, for the one client
actually mid-action. Fixed by adding a `phase === 'LOOSE_BALL'` branch
(`ActionPanel.tsx`, inserted before the `HIGH_PASS_MOVE` block) rendering the existing "Loose
Ball!" heading (already used verbatim by the PASS-phase loose-ball sub-case,
`ActionPanel.tsx:760`) plus "Resolving automatically…", shown identically to both clients since
neither can act during this auto-resolving window (mirrors the established `HEADER` accuracy
auto-advance convention — `waitingPanel('Resolving the aerial challenge…')`). Verified via 2 new
tests in `ActionPanel.test.tsx` (active + non-active player) and 1 new "Actions" heading test in
the existing D-07 describe block. Full client suite green after the change (see Section 1
conclusion).

### Dead-code notes (CLEANUP-13-flavored, not fixed in this task)

`LOBBY` and `SNAPSHOT` are both dead `GamePhase` union members (see evidence above) — `knip` and
`tsc --noEmit` do not catch this class of dead code (a type union member that's never assigned is
not an unused export or a type error). Removing either member is a type-level change with a
broader blast radius than a copy-only fix: every `switch`/exhaustiveness site touching
`GamePhase` (there are several across `gameEngine.ts`, `ActionPanel.tsx`, `BallLocationRing.tsx`,
`HexCell.tsx`, etc.) would need re-verification that removal doesn't silently narrow an
exhaustiveness check elsewhere. Per CONTEXT.md D-03 (no speculative refactor / minimum-scope
default), this is surfaced here as a finding rather than acted on — a candidate for a future
targeted cleanup task, not this help-text audit.

### CLEANUP-07 verification

After the `LOOSE_BALL` fix, the full client suite was re-run:
`pnpm --filter @counter-attack/client test -- ActionPanel` — **90/90 tests pass** (2 new
`LOOSE_BALL` tests + 1 new D-07 heading test added, zero existing tests modified or broken).

---

## Section 2 — CLEANUP-12: Redundant-Flow Disposition

Starts from 46-RESEARCH.md's three-candidate table, extended with two further candidates
surfaced while enumerating phases in Section 1 above (the two GK interrupt-response pairs).

| # | Candidate flow | UI steps | Minimum actions actually required | Disposition | Reason |
|---|-----------------|----------|-------------------------------------|--------------|--------|
| 1 | `CORNER_KICK_GK_SETUP_ATTACKING` / `_DEFENDING` (`CornerKickSetupPanel.tsx` lines 122-152) | 1 reposition window + always-enabled Confirm | 0-or-more (uncapped) | `keep` | The panel's own comment ("Assumption A1") documents repositioning as uncapped — a GK can move multiple times before confirming. This is a variable-count (0-or-more) flow, not "exactly one action wrapped in extra steps"; collapsing it would remove the ability to reposition more than once before committing. |
| 2 | `GOAL_KICK_CHOICE` → `GOAL_KICK_TARGET` (`GoalKickSetupPanel.tsx` lines 150-206) | 2 phases (delivery-method choice, then target) | 2 — genuinely different downstream rules | `keep` | Kick vs. Standard Pass alters game rules downstream (different accuracy/header requirements). Collapsing the UI without collapsing the underlying phase machine would be cosmetic only and would obscure a real rule difference from the player. |
| 3 | `PENALTY_KICK_TAKER_SELECT` / `CORNER_KICK_TAKER_SELECT` select-then-Confirm | 2 clicks (select piece, then Confirm) | 1 decision ("who takes it") | `keep` | Explicitly NOT a collapse candidate — this 2-step pattern was deliberately introduced (`PenaltyKickSetupPanel.tsx` lines 154-159 comment) to fix a real "misclick commits irreversibly" defect (`PENALTY_KICK_TAKER_PLACED` is an Undo boundary). Collapsing back to 1 step reintroduces that bug. |
| 4 | `GK_DIVE_AT_FEET_PROMPT` → `GK_DIVE_AT_FEET_TARGET` (`GkDiveAtFeetPromptPanel.tsx`) | 2 phases (accept/decline prompt, then target hex) | 1 or 2 — branching, not fixed | `keep` | Declining ends the flow at 1 step; accepting adds a genuinely separate placement action (destination hex). The prompt is a real binary decision, not a redundant echo of the target step — collapsing would remove the decline path's ability to skip the target step entirely. |
| 5 | `GK_BOX_ENTRY_PROMPT` → `GK_BOX_ENTRY_MOVE` (`GkBoxEntryPromptPanel.tsx`) | 2 phases (accept/decline prompt, then move) | 1 or 2 — branching, not fixed | `keep` | Same reasoning as #4 — a real accept/decline decision followed by a conditionally-reachable movement step, not two steps for one action. |
| 6 | `CORNER_KICK_REPOSITION` (`CornerKickSetupPanel.tsx`) — 6 alternating stages, attacking first, 2 pieces max per stage | 6 stages | 0-2 pieces per stage (variable) | `keep` | Same variable-count class as #1 — each stage independently allows 0, 1, or 2 piece moves before advancing; not a fixed single action spread across steps. |

**No new candidate met all three collapse criteria** (2+ UI steps AND the game logic provably
only ever accepts one action AND collapsing removes no reversibility affordance) — consistent
with 46-RESEARCH.md's own conclusion. CLEANUP-12 is satisfied by this documented audit (6
candidates inspected, all `keep` with a specific reason) rather than by any structural collapse
in this phase.

---

## Conclusion

**CLEANUP-07 (help-text completeness):** Satisfied. 45/45 `GamePhase` union members audited
(31 carried forward from 46-RESEARCH.md's already-checked v1.6/v1.7-era + pre-v1.6 KICK_OFF/
PASS/GK_DIVE surfaces, 14 newly audited in this task). Verdicts: **42 `covered`**
(41 pre-existing + 1 fixed this task — `LOOSE_BALL`), **2 `n/a`** (`LOBBY`, `SNAPSHOT` — both
confirmed dead `GamePhase` union members, never assigned to `state.phase` in production code),
**1 `deferred`** (`SHOT` — a narrow, evidenced dice-roll-resolution gap at 2 specific call sites,
requiring an engine-level fix beyond this task's copy-only scope; surfaced in the plan summary
for a future bug-fix phase). Zero rows remain marked `gap` — the sole `gap` found (`LOOSE_BALL`)
was fixed in this task and re-verified (90/90 `ActionPanel.test.tsx` tests pass).

**CLEANUP-12 (redundant single-action flows):** Satisfied by evidenced audit. 6 candidate
multi-step flows inspected (3 carried forward from 46-RESEARCH.md, 3 newly surfaced during
Section 1's phase enumeration) — all 6 disposed `keep`, each with a specific reason (variable
0-or-more action count, genuinely distinct downstream action types, or deliberate
defect-prevention split). No flow in this codebase was found to present 2+ UI steps for a
game-logic action that only ever needs exactly one — the default per CONTEXT.md D-03 (no
speculative refactor) applies: document the audit, do not manufacture a collapse.
