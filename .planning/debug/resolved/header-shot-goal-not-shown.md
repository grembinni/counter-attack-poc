---
slug: header-shot-goal-not-shown
status: resolved
trigger: 'Header shot not working — after a header duel is won, the winning player cannot shoot at goal. The headed-shot path to GK_DIVE appears broken.'
created: '2026-06-15'
updated: '2026-06-16'
resolved: '2026-06-16'
---

# Debug Session: header-shot-goal-not-shown

## Symptoms

- **Expected:** After winning a header duel, goal-line hexes in range are highlighted and clicking one fires a headed shot → GK_DIVE
- **Actual:** Goal-line hexes are NOT highlighted for shot selection; moving toward the goal-line is treated as a pass instead of a shot
- **Error messages:** None reported
- **Timeline:** Worked at phase 11; suspected regression from phase 17.1 GamePhase rename sweep
- **Reproduction:** Win a header duel in-game; observe that no shot hexes are highlighted on the goal-line

## Current Focus

```yaml
reasoning_checkpoint:
  hypothesis: "The 'Bug 4 fix' in gameHandlers.ts changed GAME_HEADER_CONTESTANT to call applyRoll directly and immediately transition out of HEADER phase, always routing to PASS (because headerTargetHex is null at duel time). The client-side headerTargetStep = false correctly reflects removal of the target-selection step. But the consequence is that the attacker can NEVER choose a goal-line hex for a headed shot — the server never stays in HEADER long enough for GAME_HEADER_TARGET to be emitted, so applyResolveHeaderTarget is never called. The headed-shot-to-GK_DIVE path is completely broken."
  confirming_evidence:
    - 'gameHandlers.ts line 2167: bothConfirmed path calls applyRoll(room.gameState, ...diceArr) which transitions immediately to PASS (headerTargetHex is null, so isGoalLineTarget is always false)'
    - 'gameEngine.ts lines 1832-1835: applyRoll HEADER branch: isGoalLineTarget = tgtHex !== null && ...; tgtHex = state.headerTargetHex ?? null — always null in current flow'
    - 'HexGrid.tsx line 131: headerTargetStep = false always — no goal-line hexes are ever highlighted in HEADER phase'
    - "ActionPanel.tsx lines 260-274: 'Header won! Choose target.' UI is shown when headerDuelWinner is set, but the server already transitions out of HEADER before broadcasting, so this UI is never seen"
    - 'GAME_HEADER_TARGET handler (gameHandlers.ts line 2033) checks room.gameState.headerDuelWinner (line 2071) which is only set by computeHeaderDuelWinner — but the current GAME_HEADER_CONTESTANT path calls applyRoll, which clears headerDuelWinner'
  falsification_test: 'If hypothesis is wrong, we would find a code path where headerTargetHex gets set before applyRoll is called in GAME_HEADER_CONTESTANT — grep finds nothing'
  fix_rationale: 'Restore the two-step HEADER flow: (1) GAME_HEADER_CONTESTANT when bothConfirmed calls computeHeaderDuelWinner (not applyRoll) to store headerDuelWinner and stay in HEADER; (2) client re-enables headerTargetStep when headerDuelWinner is set, shows goal-line hexes; (3) clicking a goal-line hex emits GAME_HEADER_TARGET → applyResolveHeaderTarget → GK_DIVE. Non-goal-line hex → applyResolveHeaderTarget → PASS. This is what the existing GAME_HEADER_TARGET handler + applyResolveHeaderTarget already implement — they just need to be reactivated.'
  blind_spots: 'Need to check if computeHeaderDuelWinner handles tie case (it returns null → LOOSE_BALL path must be handled in GAME_HEADER_CONTESTANT when winner is null). Also need to verify the event log is populated correctly since applyRoll writes the HEADER event but applyResolveHeaderTarget does not.'
```

next_action: "None — resolved and human-verified."

## Symptoms

<!-- IMMUTABLE after gathering -->

expected: After winning a header duel, goal-line hexes in range are highlighted and clicking one fires a headed shot → GK_DIVE
actual: Goal-line hexes are NOT highlighted for shot selection; moving toward the goal-line is treated as a pass instead of a shot
errors: None reported
reproduction: Win a header duel in-game; observe that no shot hexes are highlighted on the goal-line
started: Regression from phase 17.1

## Eliminated

- hypothesis: "Phase rename sweep (17.1) broke a phase name string comparison"
  evidence: "HEADER phase name was NOT renamed in 17.1. The code still uses 'HEADER' throughout. All phase checks use GamePhase type constants."
  timestamp: "2026-06-15"

## Evidence

- timestamp: "2026-06-15"
  checked: "HexGrid.tsx lines 128-131"
  found: "headerTargetStep is hard-coded false always. Comment says 'Bug 4 fix: server now resolves the duel immediately when both teams confirm contestants, transitioning directly to PASS without a choose target hex step.'"
  implication: "No goal-line hexes are ever highlighted during HEADER phase on the client"

- timestamp: "2026-06-15"
  checked: "gameHandlers.ts lines 2151-2174 (GAME_HEADER_CONTESTANT bothConfirmed path)"
  found: "Calls applyRoll(room.gameState, ...diceArr) directly when bothConfirmed. This immediately transitions state out of HEADER to PASS or LOOSE_BALL."
  implication: "Server never stays in HEADER with headerDuelWinner set. The GAME_HEADER_TARGET handler is dead code in this flow."

- timestamp: "2026-06-15"
  checked: "gameEngine.ts applyRoll HEADER branch lines 1832-1835"
  found: "isGoalLineTarget = tgtHex !== null && tgtHex.q === goalQ && ...; tgtHex = state.headerTargetHex ?? null. Since headerTargetHex is always null when applyRoll is called from GAME_HEADER_CONTESTANT, isGoalLineTarget is always false."
  implication: "Headed shot to goal line can NEVER route to GK_DIVE in the current flow — always goes to PASS"

- timestamp: "2026-06-15"
  checked: "gameHandlers.ts lines 2033-2085 (GAME_HEADER_TARGET handler)"
  found: "Handler exists, checks headerDuelWinner, calls applyResolveHeaderTarget. applyResolveHeaderTarget correctly routes goal-line hex to GK_DIVE and non-goal to PASS."
  implication: "The intended fix mechanism already exists on the server — it just needs to be activated by not calling applyRoll in bothConfirmed path"

- timestamp: "2026-06-15"
  checked: "gameEngine.ts computeHeaderDuelWinner (lines 2476-2548)"
  found: "Pure function that computes winner ('home'|'away'|null for tie) without transitioning phase. Returns null for ties."
  implication: "Can be used in GAME_HEADER_CONTESTANT to store headerDuelWinner and stay in HEADER, with tie handled separately"

- timestamp: "2026-06-15"
  checked: "ActionPanel.tsx lines 260-274"
  found: "bothConfirmed branch shows 'Header won! Choose target.' when headerDuelWinner === myTeam. This UI exists but is never reached because server already left HEADER before broadcasting."
  implication: "The ActionPanel already has the correct UI — it will work once the server stays in HEADER phase"

## Resolution

root_cause: "The 'Bug 4 fix' in GAME_HEADER_CONTESTANT calls applyRoll directly when both teams confirm, immediately transitioning out of HEADER to PASS. Since headerTargetHex is always null at this point, isGoalLineTarget is always false, so headed shots never route to GK_DIVE. The client's headerTargetStep = false reflects this but breaks the headed-shot UI. The GAME_HEADER_TARGET server handler and applyResolveHeaderTarget engine function (which correctly route goal-line hexes to GK_DIVE) exist but are unreachable."
fix: "Restore the two-step HEADER resolution: (1) In GAME_HEADER_CONTESTANT, when bothConfirmed, call computeHeaderDuelWinner instead of applyRoll — store result as headerDuelWinner and stay in HEADER. Handle tie (null result) by calling applyRoll for the LOOSE_BALL path. (2) In HexGrid.tsx, restore headerTargetStep = gameState.headerDuelWinner === myTeam to re-enable goal-line hex highlights. Client then emits GAME_HEADER_TARGET on click, which routes to GK_DIVE (goal-line) or PASS (other)."
verification: "Self-verified: server tests (gameHandlers.rule11, gameEngine.rule11, gameHandlers.phase10, gameHandlers.test — 52 tests) pass. Full client test suite (95 tests) passes. Full server test suite passes except 4 pre-existing failures in gameEngine.phase17/gameHandlers.phase17 (FREE_MOVE/FIRST_TIME_PASS) confirmed unrelated — reproduced identically on git stash baseline before this fix. TypeScript typecheck clean (server + client). ESLint clean on both changed files. Prettier formatting applied. Human-verified 2026-06-16: user confirmed in-game that after a header duel, goal-line hexes are highlighted and the headed shot correctly routes to GK_DIVE ('Its working again')."
files_changed: ["packages/server/src/gameHandlers.ts", "packages/client/src/components/HexGrid.tsx"]
human_verification: "Confirmed by user on 2026-06-16: header duel win → goal-line hexes highlighted → shot routes correctly."
