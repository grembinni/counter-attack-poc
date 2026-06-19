---
status: resolved
trigger: 'UAT gap from Phase 17.1 (action-flow-cleanup) verification, test 3: no prompt for either team to move after first-time pass'
created: 2026-06-19T00:00:00Z
updated: 2026-06-19T00:00:00Z
---

## Current Focus

<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — root cause found. The FIRST_TIME_PASS_MOVE transition block in applyRoll (gameEngine.ts ~line 1312) is unreachable whenever the pass target hex is occupied by any piece, because an earlier occupant-check early-return (gameEngine.ts lines 1223-1248, pre-existing pre-17.1 logic for STANDARD_PASS teammate pickup) fires first for ALL pass types except HIGH_PASS — including FIRST_TIME_PASS — and returns phase:'PASS' directly, never reaching the D-03 FIRST_TIME_PASS_MOVE check.
test: Confirmed via static trace of gameEngine.ts applyRoll PASS branch + confirmed via passing test gameEngine.test.ts:849 ('FIRST_TIME_PASS (PASS-02): same delivery as STANDARD...') which uses a fixture (firstTimePassState) with a teammate (homeTeammate, id home-2) sitting exactly at passTargetHex, and asserts result.state.phase === 'PASS' (NOT 'FIRST_TIME_PASS_MOVE') and ball.carrierId === 'home-2'. Ran `pnpm --filter @counter-attack/server test -- gameEngine.test.ts -t "PASS-02"` — both STANDARD_PASS and FIRST_TIME_PASS occupant-delivery tests PASS, confirming this is live, current, intended-per-test-suite behavior, not a flaky/transient state.
expecting: N/A — hypothesis confirmed via direct code trace + passing regression test that locks in the buggy behavior.
next_action: N/A — investigation complete. Reporting root cause (goal: find_root_cause_only, no fix applied).

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: After completing an accurate first-time pass, the game transitions to FIRST_TIME_PASS_MOVE phase, and both teams get a turn to reposition one player up to 1 hex (ActionPanel shows "First-time pass! Move 1 player to receive the ball." with Undo/End Turn controls). After both teams end their turn, the ball is delivered to the declared target hex and play resumes normally (phase becomes 'PASS' with lastActionType: 'FIRST_TIME_PASS').
actual: User reports - "there was no prompt for either team to move after first-time pass" - the repositioning panel/prompt never appeared for either team during a live game attempt at a first-time pass.
errors: None reported
reproduction: Test 3 in .planning/phases/17.1-action-flow-cleanup/17.1-UAT.md - complete an accurate first-time pass in a live game and observe whether a repositioning prompt appears
started: Discovered during Phase 17.1 UAT (D-03 feature from phase 17.1, plans 02/03/06)

## Eliminated

<!-- APPEND only - prevents re-investigating -->

- hypothesis: "PASS-02 trigger (firstTimePassStep='ATTACKER' sub-state) was never implemented, so phase never enters any first-time-pass intermediate state at all"
  evidence: "gameEngine.ts DOES contain a working FIRST_TIME_PASS_MOVE transition block at line ~1312 (if (newLastActionType === 'FIRST_TIME_PASS') return {...phase:'FIRST_TIME_PASS_MOVE'...}), added in 17.1-03 (commit 52a017f). The RED test at gameEngine.phase17.test.ts:537 ('accurate FIRST_TIME_PASS -> stays phase PASS with firstTimePassStep=\"ATTACKER\"') tests an OLDER, ABANDONED design (a firstTimePassStep sub-state field that doesn't exist in current types.ts) — explicitly documented as a 'Known Pre-existing RED Failure' in 17.1-02-SUMMARY.md predating the D-03 FIRST_TIME_PASS_MOVE design. This stub is a leftover from an earlier (pre-17.1) plan and is unrelated to the actual D-03 implementation path. Confirmed RED via `pnpm --filter @counter-attack/server test -- -t FIRST_TIME_PASS` (still fails with 'expected undefined to be ATTACKER' — firstTimePassStep field doesn't exist on GameState)."
  timestamp: 2026-06-19T00:30:00Z

- hypothesis: "Client ActionPanel.tsx never renders the FIRST_TIME_PASS_MOVE panel even when phase is correctly set"
  evidence: "ActionPanel.tsx has a correctly-implemented FIRST_TIME_PASS_MOVE panel block (added 17.1-06, commit f468039) with 4 passing tests (ActionPanel.test.tsx:121+) that directly inject phase:'FIRST_TIME_PASS_MOVE' state and confirm the panel renders with Undo/End Turn controls. The panel code itself is correct — the problem is the phase never gets set to FIRST_TIME_PASS_MOVE in the first place during real play because of the server-side occupant-check short-circuit (see confirmed root cause). Client is not at fault."
  timestamp: 2026-06-19T00:32:00Z

## Evidence

<!-- APPEND only - facts discovered -->

- timestamp: 2026-06-19T00:10:00Z
  checked: "packages/server/src/gameEngine.ts applyRoll() PASS branch, full read lines 994-1350"
  found: "Line 1223: `if (newLastActionType !== 'HIGH_PASS') { const occupant = state.pieces.find(p => p.position.q === targetHex.q && p.position.r === targetHex.r); if (occupant) { return {...phase:'PASS'...} } }` — this fires for STANDARD_PASS, FIRST_TIME_PASS, and LONG_BALL whenever ANY piece (teammate or opponent) occupies targetHex, and returns immediately with phase:'PASS'. The D-03 FIRST_TIME_PASS_MOVE check `if (newLastActionType === 'FIRST_TIME_PASS') {...}` sits at line 1312 — AFTER this occupant-check return — so it is dead code whenever targetHex is occupied."
  implication: "Any first-time pass aimed at a hex where a teammate (the intended receiver) stands will never reach the FIRST_TIME_PASS_MOVE transition. The repositioning prompt cannot appear for this — the most common — case."

- timestamp: 2026-06-19T00:15:00Z
  checked: "packages/server/src/**tests**/gameEngine.test.ts lines 734-793, 849-861"
  found: "Fixture `homeTeammate` (id: 'home-2') is placed at position {q:17,r:7}. Fixture `firstTimePassState` sets passTargetHex: {q:17,r:7} (identical hex). Test 'FIRST_TIME_PASS (PASS-02): same delivery as STANDARD...' calls applyRoll(firstTimePassState, 1, 3, 3) and asserts result.state.phase === 'PASS' and result.state.ball.carrierId === 'home-2'. This test currently PASSES (verified via `pnpm --filter @counter-attack/server test -- gameEngine.test.ts -t PASS-02` — 2 passed)."
  implication: "This is a pre-17.1 test (from the original Phase 17 PASS-02 implementation, before D-03/FIRST_TIME_PASS_MOVE existed) that hard-codes/locks-in the exact buggy behavior: delivering a first-time pass straight to phase:'PASS' when the target is occupied. It was never updated when 17.1-03 added the FIRST_TIME_PASS_MOVE transition, so it now passes for the wrong reason — masking the regression instead of catching it. This is a real, currently-codified contradiction with the D-03 spec, not a hypothetical."

- timestamp: 2026-06-19T00:20:00Z
  checked: "packages/server/src/**tests**/gameEngine.phase17.test.ts lines 568-602 (ftpMoveAttackerState fixture)"
  found: "The 17.1-03 D-03 test suite for FIRST_TIME_PASS_MOVE always constructs state directly already-in-phase FIRST_TIME_PASS_MOVE (synthetic fixture `ftpMoveAttackerState` with phase:'FIRST_TIME_PASS_MOVE' set manually) — it never drives the transition end-to-end starting from phase:'PASS' through applyRoll() with an occupied target hex. So the occupant-check short-circuit bug was never exercised by any 17.1-03/17.1-06 test."
  implication: "The D-03 implementation (gameEngine.ts:1312) and its tests are individually correct in isolation, but no test ever verified the actual entry path into FIRST_TIME_PASS_MOVE from a realistic occupied-target pass — the gap between the old occupant-check logic and the new transition was never caught by either old or new tests."

- timestamp: 2026-06-19T00:25:00Z
  checked: "packages/client/src/store/useGameStore.ts lines 196-258 (setSelectedPassType — validPassTargetHexes computation) and packages/shared/src/passValidator.ts validatePass() for FIRST_TIME type"
  found: "validatePass for passType 'FIRST_TIME' (passValidator.ts lines 80, 86, 166-173) has no requirement that the target hex be occupied — it allows any hex within 6 hex range with no path blocking. The client's validPassTargetHexes is computed across ALL PITCH_HEXES using this same validatePass, so empty hexes are technically valid FTP targets too. However, in normal gameplay a first-time pass is aimed at a teammate's hex (that's the point of passing to a player), so the occupied-target case is the dominant/expected real-world scenario — consistent with user report of the prompt 'never' appearing."
  implication: "Confirms the bug is not contingent on a contrived edge case — it reproduces in the standard/expected user flow of passing to a visible teammate, which is exactly what the UAT tester did."

- timestamp: 2026-06-19T00:28:00Z
  checked: ".planning/phases/17.1-action-flow-cleanup/17.1-02-SUMMARY.md and 17.1-03-SUMMARY.md"
  found: "17.1-02-SUMMARY.md explicitly lists 'accurate FIRST_TIME_PASS -> firstTimePassStep=\"ATTACKER\"' (gameEngine.phase17.test.ts) and 'SNAP_DEFLECT end-turn with FIRST_TIME_PASS -> LOOSE_BALL' (gameHandlers.phase17.test.ts) as 'Known Pre-existing RED Failures' / 'intentional Wave 0 RED tests for features not yet implemented' that 'existed before this plan and are unchanged by it'. 17.1-03-SUMMARY.md confirms these 2 RED stubs remained RED after D-03 was implemented ('Pre-existing RED stubs (MOVE-06, PASS-02, SNAP_DEFLECT) unchanged — will be addressed in future waves'). Neither summary mentions the gameEngine.test.ts:849 occupant-delivery test or the occupant-check short-circuit at all — it was not on anyone's radar during 17.1-02/03/06."
  implication: "The RED stubs referenced in the original symptom-gathering guidance are a documented, known, unrelated abandoned-design artifact — confirmed NOT the root cause (see Eliminated). The actual root cause (occupant-check short-circuit) was an unrecognized gap that escaped all three plans (02, 03, 06) because each one only tested its own slice in isolation: 02 didn't touch delivery logic, 03 tested FIRST_TIME_PASS_MOVE only via pre-constructed in-phase fixtures, and 06 tested the panel only via direct phase injection. No integration test ever exercised PASS-phase delivery of a FIRST_TIME_PASS to an occupied hex after D-03 landed."

## Resolution

<!-- OVERWRITE as understanding evolves -->

root_cause: |
In packages/server/src/gameEngine.ts, function applyRoll(), case 'PASS': branch.
The occupant-check block at lines 1223-1248 (pre-existing logic that predates Phase 17.1,
originally written so STANDARD_PASS could deliver the ball to a teammate standing at the
target hex) executes BEFORE the D-03 FIRST_TIME_PASS_MOVE transition block at line 1312.

The guard `if (newLastActionType !== 'HIGH_PASS')` means this occupant-check applies to
STANDARD_PASS, FIRST_TIME_PASS, and LONG_BALL alike. Whenever ANY piece occupies the
pass's targetHex — which is the normal case for a pass aimed at a teammate — the function
returns immediately with `phase: 'PASS'` and delivers the ball directly to that occupant,
completely bypassing the `if (newLastActionType === 'FIRST_TIME_PASS')` check at line 1312
that is supposed to route into the FIRST_TIME_PASS_MOVE repositioning phase (D-03).

As a result, FIRST_TIME_PASS_MOVE is only ever reached when the first-time pass target hex
is EMPTY (no piece standing there) — an edge case, not the normal "pass to a teammate" flow.
In real gameplay, a first-time pass is virtually always aimed at a visible teammate's hex,
so the FIRST_TIME_PASS_MOVE phase (and therefore the ActionPanel repositioning prompt) never
fires for either team, exactly matching the user report "there was no prompt for either team
to move after first-time pass."

This is a regression gap introduced when 17.1-03 added the FIRST_TIME_PASS_MOVE transition:
it was inserted after the older occupant-check code without accounting for the fact that the
occupant-check's early return would shadow it. None of 17.1-02/03/06's tests caught this
because each plan tested its own slice in isolation (02: type cleanup only; 03: FTP_MOVE
tested via pre-built in-phase fixtures, never end-to-end from PASS phase; 06: ActionPanel
panel tested via direct phase injection). A pre-existing, never-updated test
(gameEngine.test.ts:849, "FIRST_TIME_PASS (PASS-02): same delivery as STANDARD...") still
asserts and locks in the old (now-incorrect per D-03 spec) occupied-target behavior, which is
why this regression was not flagged by the test suite.

The two PASS-02 RED stubs mentioned in the symptom-gathering guidance
(gameEngine.phase17.test.ts:537 firstTimePassStep="ATTACKER", and
gameHandlers.phase17.test.ts SNAP_DEFLECT->LOOSE_BALL) are a SEPARATE, unrelated, abandoned
pre-17.1 design (a firstTimePassStep sub-state that doesn't exist in current types.ts) and
were confirmed via 17.1-02-SUMMARY.md / 17.1-03-SUMMARY.md to be known, intentional,
pre-existing RED failures unrelated to D-03. They are NOT the cause of this bug — eliminated
with evidence above.
fix: ""
verification: ""
files_changed: []
