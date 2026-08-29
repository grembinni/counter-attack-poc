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

---

## CLEANUP-13 — Dead-Code Sweep

**Audited:** 2026-08-29 (Plan 46-06, Task 1)
**Purpose:** run the whole-monorepo green gate that is CLEANUP-13's own success criterion, and
sweep every file Plans 46-01 through 46-05 touched for the five residue classes `knip`/`tsc`
provably do not catch (stale imports, unreferenced locals/CSS, comments describing removed code,
doc counts that drifted from the code they describe, superseded planning-doc claims).

### File list (union of all `key-files: modified/created` across 46-01..46-05)

24 unique files (`docs/HIGHLIGHT-REFERENCE.md` and `ActionPanel.tsx`/`.test.tsx` are each touched
by two plans and counted once).

| # | File | Residue classes checked | Finding | Disposition |
|---|------|--------------------------|---------|--------------|
| 1 | `packages/client/src/components/BallLocationRing.tsx` | 1 (imports), 3 (stale comments), 4 (doc count vs code) | none — `BALL_MARKER_PHASES` Set literal (35 members) transcribed verbatim into `docs/HIGHLIGHT-REFERENCE.md`'s 35-phase list; member-for-member and order-for-order match confirmed by direct read of both files | n/a |
| 2 | `packages/client/src/components/BallLocationRing.test.tsx` | 1, 2 | none — `BALL_MARKER_PHASES.size` assertion reads `35`, matching the Set | n/a |
| 3 | `packages/client/src/components/ActionPanel.tsx` | 1, 3 (`Free Move!` literal) | `grep -rn "Free Move!" --include=*.tsx` matches one in-code historical comment (line 752, "the resulting 'Free Move!' heading still gave the player no indication...") documenting the pre-this-phase name, not a JSX text node — the actual rendered heading is `Final-Third Movement!` (confirmed). Not residue: past-tense, explicitly describes prior naming, not current state. | n/a |
| 4 | `packages/client/src/components/ActionPanel.test.tsx` | 1, 3 | same class as #3 (one historical comment, line 421, not a live assertion) — the live assertion at line 423 checks `'Final-Third Movement!'` | n/a |
| 5 | `docs/HIGHLIGHT-REFERENCE.md` | 4 (ball-marker phase list, valid-move exception list) | none — both lists verified against their code constants directly (see #1 and #21below); `17-phase` stale-count string (`grep -c` = 0) does not appear anywhere in the file | n/a |
| 6 | `packages/client/src/store/useGameStore.ts` | 1, 2, 3 (six deleted `*_CONFIG` binding names) | none — `grep -n "^const [A-Z_]*_CONFIG\|^export const [A-Z_]*_CONFIG ="` returns zero matches; `CORNER_KICK_FINAL_SETUP_CONFIG` string no longer appears anywhere in the file; the one historical comment referencing "a standalone named `const *_CONFIG` binding" (line 287-288) is explicitly past tense ("Previously... was") describing the pre-consolidation shape, not a live claim | n/a |
| 7 | `packages/client/src/store/useGameStore.test.ts` | 1, 2 | none — knip-clean, lint-clean (unused-vars is an error-level rule) | n/a |
| 8 | `packages/client/src/components/GameSettingsScreen.tsx` | 2 (`.section` CSS class) | none — `.section` still has 4 live consumers in the file (`styles.section` at lines 196, 220, 273, 351), including the relocated Match Speed block | n/a |
| 9 | `packages/client/src/components/GameSettingsScreen.test.tsx` | 1, 3 | none — Match Speed relocation assertions (lines 442-494) consistently describe the current left-column-4th-row position | n/a |
| 10 | `packages/client/src/components/FreeKickSetupPanel.tsx` | 1, 2, 3 | none — `freeKickKickerChosen`/`kickerLocked`/`isKickerSelectionPhase` all have live consumers; no orphaned branch found | n/a |
| 11 | `packages/client/src/components/FreeKickSetupPanel.test.tsx` | 1, 2 | none — knip/lint clean | n/a |
| 12 | `.planning/phases/46-final-cleanup/46-AUDIT.md` | n/a (this document; not source code) | n/a — this file is itself the sweep's output artifact, not a sweep target | n/a |
| 13 | `packages/shared/src/data/player-pool.csv` | 4 (row count vs generated total) | none — 10 new rows (5 `generic-bench-home` + 5 `generic-bench-away`) appended last, matching `seed-rosters.ts`'s `EXPECTED_TOTAL = 198` guard and the actual 198-entry `PLAYER_POOL` | n/a |
| 14 | `packages/shared/scripts/seed-rosters.ts` | 3, 4 (p-ID range header comment) | none — header comment's CSV processing-order block (lines 14-30) already lists `generic-bench-home → p189–p193` / `generic-bench-away → p194–p198` accurately, with the prior `usmnt → p178–p188` entry correctly left unchanged since it precedes the new rows | n/a |
| 15 | `packages/shared/src/teams.ts` | 4 (header player count vs `PLAYER_POOL.length`) | **found, out of scope** — the leading total (`198 total players`) correctly matches `PLAYER_POOL.length` (198, per the plan's own acceptance criterion). The parenthetical breakdown (`4 legacy squads (44) + free agents (24) + MLS (44) + national (66)` = 178, not 198) has been stale since before Phase 46 — confirmed via `git log -p`: the breakdown text is byte-identical across all three total bumps (178→188→198 over three separate milestones), i.e. pre-existing drift Phase 46 did not introduce and only mechanically continued the existing bump-the-leading-number-only pattern. Logged to `.planning/phases/46-final-cleanup/deferred-items.md` per the Scope Boundary rule; not fixed in this task. | n/a (deferred, documented) |
| 16 | `packages/shared/src/teams.test.ts` | 1, 2, 4 (count assertions) | none — count/last-id assertions read 198/`p198`, matching the array | n/a |
| 17 | `packages/shared/src/teamConfig.ts` | 1, 2 | none — `GENERIC_BENCH_HOME_TEAM_ID`/`GENERIC_BENCH_AWAY_TEAM_ID`/`getGenericBenchPlayers` all have live consumers (`roomHandlers.ts`); knip-clean | n/a |
| 18 | `packages/server/src/roomHandlers.ts` | 5 (D-12 "expected behavior, not a gap" claim) | none — the D-12 stance is explicitly superseded in place by a Phase 46 comment (lines 981-995) citing D-05 through D-09; no stale unqualified D-12 claim remains at this site | n/a |
| 19 | `packages/server/src/__tests__/lineupAssignment.integration.test.ts` | 3, 5 | none — fully rewritten per 46-04; `grep -n "D-12\|empty bench\|WORKING AS INTENDED"` returns zero matches | n/a |
| 20 | `packages/server/src/__tests__/substitution.integration.test.ts` | 3, 5 (superseded D-12 claim) | **found, fixed** — see below | fixed |
| 21 | `packages/client/src/components/HexGrid.tsx` | 3 (inline `GK_DIVE`/`SNAPSHOT_DEFLECT` tint exclusions) | none — the historical comment at lines 47-51 describing the prior two-literal inline form is explicitly past tense ("Previously these four exclusions were... inline... this makes the full rule an enumerated... constant instead"); the live `isHighlighted` derivation (line 529) correctly uses `!VALID_MOVE_TINT_EXCEPTION_PHASES.has(phase)`, confirmed by direct read | n/a |
| 22 | `packages/client/src/components/HexGrid.test.tsx` | 1, 2 | none — knip/lint clean | n/a |
| 23 | `packages/client/src/components/PlayerStatsPanel.tsx` | 3 (`size={56}`, "4-column"/"7-stat" grid comment) | none — `grep -c "size={56}"` = 0; no "4-column"/"7-stat" string remains; the corrected `3-column stat grid → 2 rows of 3 (6 role-filtered stats)` comment matches `PlayerStatsPanel.module.css`'s actual `repeat(3, 1fr)` | n/a |
| 24 | `packages/client/src/components/PlayerStatsPanel.test.tsx` | 1, 2 | none — knip/lint clean; badge-size (48) and stat-chip-count (6) assertions match the corrected component | n/a |

### Row #20 finding detail — stale D-12 "must never be fixed" claim in `substitution.integration.test.ts`

**Finding:** this file's header doc comment (lines 17-24, pre-fix) and its item-11 coverage-list
entry (lines 44-45, pre-fix) stated, verbatim: *"a STANDARD-mode room's squads hold exactly 11
players today... so D-02/D-12's derivation... yields an EMPTY bench for a Standard room... The
D-12 test below therefore asserts an EMPTY bench and a rejected substitution attempt — this is
WORKING AS INTENDED, not a gap, and **must never be 'fixed' by adding bench generation here or
anywhere else**."* Plan 46-04 did exactly that — added `getGenericBenchPlayers` bench-generation
fallback for standard rooms — and rewrote this file's test body accordingly (confirmed: the
`describe`/`it` block immediately below the old "Case 11 (D-12)" section divider now asserts a
5-entry generic bench per side and a successful substitution, not an empty bench). The
surrounding doc comments were left describing the old, now-superseded behavior as if it were
still both true and permanently mandated — residue class 3 (comments describing values no longer
true) combined with class 5 (a planning-doc-style claim this phase superseded).

**Fix:** reworded the file-header comment to a "HISTORICAL NOTE (superseded by Phase 46...)"
framing that states the old D-12 stance accurately as history, then explains Phase 46's D-06
supersession and points at the current describe block; updated the item-11 coverage-list entry
and both section-divider comments (`// Case 11 (D-12): ...` and `// — the STANDARD path for the
D-12 empty-bench case ...`) to name the Phase 46 D-05..D-09 supersession instead of restating the
old, now-false claim. Zero test logic, assertions, or `it()` bodies were touched — confirmed via
`git diff` showing a comment-only diff (30 insertions / 12 deletions, all inside `/** */` or `//`
regions) — and the full `substitution.integration.test.ts` suite (12/12 tests) re-run green
after the edit.

**Files modified:** `packages/server/src/__tests__/substitution.integration.test.ts`
**Verification:** `pnpm --filter @counter-attack/server test -- substitution.integration` — 12/12
pass; full monorepo suite re-run green after the fix (see gate results below).

**Note:** three other files (`gameEngine.ts`, `gameEngine.substitution.test.ts`,
`gameHandlers.substitution.test.ts`, `LineupAssignmentScreen.test.tsx`) also contain `D-12`/
"empty bench" references, but none of these four files are in Plans 46-01..46-05's touched-file
list and their claims describe a still-true, more general engine behavior (`applySubstitution`
still correctly rejects `INVALID_SUBSTITUTE` when a bench is genuinely empty, e.g. every bench
player already subbed in — a real, unchanged case, not specific to "standard rooms always have
an empty bench"). Left unchanged: out of this sweep's bounded scope (touched-files-only per
46-RESEARCH.md Pitfall 6) and not actually false.

### `eslint.config.js` — pre-existing blocking issue found and fixed (not itself a Plan 46-01..46-05 file, but required to satisfy this task's own `pnpm -w lint` exit-0 requirement)

**Finding:** `pnpm -w lint` failed with `error Parsing error: Too many files (>8) have matched
the default project` across 3 files in `packages/shared` (`stoppagePhases.test.ts`,
`teamConfig.test.ts`, `teams.test.ts`) — a pre-existing, previously-deferred typescript-eslint
default-project file-match cap issue (see `32/33/34-code-cleanup`'s and `43-06`'s own
`deferred-items.md` entries: "the whole-workspace `pnpm lint` OOMs / errors on a pre-existing
`packages/shared` typescript-eslint file-count-cap config issue"). The existing
`allowDefaultProject` glob list (`packages/shared/src/*.test.ts` + `packages/shared/scripts/*.ts`)
deliberately allow-lists 19 files, exceeding typescript-eslint's default 8-file cap — the tool's
own "Too many files" error message names the exact documented fix:
`parserOptions.projectService.maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING`.

**Why this is in scope (not deferred a fourth time):** unlike the prior three phases where a
clean `pnpm -w lint` run was not those phases' own success criterion, Plan 46-06's task text is
explicit: *"All four [gate commands] must exit 0... If a failure genuinely requires a design
decision rather than a mechanical fix, stop and report it instead of guessing"* — but raising a
config cap the tool itself instructs you to raise, for files that are already deliberately
allow-listed (not accidentally caught), is a mechanical fix, not a design decision, an
eslint-disable, a knip suppression, a scope-narrowing, or a weakened assertion. None of the
plan's explicit fix-forward prohibitions apply to this change.

**Fix:** added `maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 30` alongside
the existing `allowDefaultProject` list in `eslint.config.js`, with a comment explaining the
19-file count, the headroom to 30, and a citation of the prior three phases' deferred-items.md
entries this supersedes.

**Files modified:** `eslint.config.js`
**Verification:** `pnpm -w lint` now exits 0 in ~35s (see gate results below) — well under the
100-170s budget 46-RESEARCH.md's Environment Availability table flagged, since the prior attempts
in that research session were hitting the OOM/parse-error failure mode rather than completing.

### Gate results (final re-run, after all fixes above)

| Command | Exit code | Notes |
|---|---|---|
| `pnpm -w typecheck` | 0 | clean across shared/server/client, no findings |
| `pnpm -w lint` | 0 | **measured wall-clock: ~35s** (`date +%s` before/after: 1788022944 → 1788022979). Previously blocked by the `eslint.config.js` fix above; no watcher flake observed. |
| `pnpm -w test` | 0 | shared 907 passed (18 files) / server 1635 passed + 1 skipped + 1 todo (70 files) / client 1239 passed (40 files) — 3,781 total tests, all green. No vitest worker-crash flake observed on this run (the documented Windows `--pool=forks` workaround was not needed this time — noted per plan instruction in case a future rerun needs it). |
| `pnpm knip` | 0 | zero findings; `git diff knip.json` is empty (no suppression) |

`git diff` confirms zero `eslint-disable` comments added anywhere in this phase, and the only
test-file diff (`substitution.integration.test.ts`) is comment-only with no assertion changes.
