---
phase: 11-rule-correctness
verified: 2026-06-11T21:26:59Z
status: gaps_found
score: 4/5 roadmap success criteria verified
overrides_applied: 0
gaps:
  - truth: 'After the header contestant duel resolves, the target hex selection step is presented — the sequence is accuracy check then contestant duel then target selection, with no step skipping'
    status: failed
    reason: "When computeHeaderDuelWinner returns null (equal scores = tie), headerDuelWinner is stored as null and the handler comment says 'UI should handle this.' GAME_HEADER_TARGET's winner guard emits WRONG_TEAM to both sockets when duelWinner is null. There is no LOOSE_BALL transition, no applyRoll escape, and no client recovery path. The game is permanently stuck in HEADER phase on a tie duel — the pre-RULE-02 code handled this via applyRoll HEADER branch, but Phase 11 moved the duel to GAME_HEADER_CONTESTANT and left the tie path unimplemented."
    artifacts:
      - path: 'packages/server/src/gameHandlers.ts'
        issue: "Lines 1963-1969: bothConfirmed block stores headerDuelWinner: null on tie and relies on 'UI should handle this' comment. GAME_HEADER_TARGET at line 1870 emits WRONG_TEAM for null duelWinner, blocking both teams permanently."
    missing:
      - 'In the bothConfirmed block in GAME_HEADER_CONTESTANT (gameHandlers.ts ~line 1954), add a tie branch: when winner === null, immediately transition to LOOSE_BALL, clear headerCleared fields, and broadcastState — matching the fix proposed in CR-02 of the code review (11-REVIEW.md)'
human_verification:
  - test: 'Trigger a header tie: set up a HIGH_PASS where home and away contestants roll equal scores in the heading duel. Observe whether the game is stuck in HEADER phase with no available actions or whether it transitions to LOOSE_BALL.'
    expected: 'Game should transition to LOOSE_BALL when the duel ties, allowing play to continue. Currently, both teams are permanently locked out — GAME_HEADER_TARGET emits WRONG_TEAM for both.'
    why_human: 'Requires a live 2-player session to observe the actual duel tie path; the probability of equal scores in an automated test is non-zero but dice are randomized.'
---

# Phase 11: Rule Correctness Verification Report

**Phase Goal:** Fix rule-correctness bugs — RULE-01 (high-pass header accuracy-roll gate), RULE-02 (heading duel sequencing and winner-only target), RULE-03 (stale shot-path highlights), RULE-04 (snap-deflect pace suppression), RULE-05 (post-deflect Movement Phase selectability)
**Verified:** 2026-06-11T21:26:59Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| #   | Truth                                                                                                                                                                    | Status   | Evidence                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | On a High Pass, the header contestant selection prompt appears only after the accuracy roll result is shown                                                              | VERIFIED | `headerAccuracyRollPending: true` set in gameEngine.ts line 1083 on HIGH_PASS->HEADER; ActionPanel.tsx line 188 gates contestant UI on this flag; GAME_HEADER_ACCURACY_ACK handler clears it (gameHandlers.ts line 1812); 9 handler tests pass                                                                                         |
| 2   | After the header contestant duel resolves, the target hex selection step is presented — accuracy check then contestant duel then target selection, with no step skipping | FAILED   | Tie path deadlock: `computeHeaderDuelWinner` returns null on equal scores; GAME_HEADER_CONTESTANT stores `null` as headerDuelWinner with no LOOSE_BALL transition (gameHandlers.ts line 1963-1969); GAME_HEADER_TARGET's winner guard emits WRONG_TEAM for null duelWinner (line 1870), locking both teams in HEADER phase permanently |
| 3   | After a snapshot resolves, the shot-path hexes on the board are cleared before the next phase begins                                                                     | VERIFIED | `lastShotPath: null` added to 3 branches: SHOT LOOSE_BALL tie (~line 1289), SHOT save-dropped (~line 1341), LOOSE_BALL scatter→PASS (~line 1746); 4 regression tests pass; applyStartMovement untouched (D-07)                                                                                                                         |
| 4   | During SNAP_DEFLECT, a deflecting piece that has used its 2-hex pace allowance sees no further move highlights                                                           | VERIFIED | HexGrid.tsx subscribes `snapDeflectPaceUsed` (line 94); `canSelectSnapDeflect` expression ends with `&& (snapDeflectPaceUsed ?? 0) < 2` (line 578); store-level pace exhaustion test passes                                                                                                                                            |
| 5   | After a shot deflects into Loose Ball, both teams' pieces are selectable in a normal Movement Phase                                                                      | VERIFIED | Diagnosis confirmed `applyStartMovement` correctly resets `paceUsedByPieceId: {}` and `movementSlot: 'ATTACKER_4'` server-side; client `setGameState` replaces state wholesale; 3 selectability tests pass (ATTACKER_4 and DEFENDER_5 slots verified)                                                                                  |

**Score:** 4/5 truths verified

### Required Artifacts

| Artifact                                                    | Expected                                                           | Status   | Details                                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `packages/shared/src/types.ts`                              | headerAccuracyRollPending + headerDuelWinner fields                | VERIFIED | Both fields present at lines 398-405                                                            |
| `packages/shared/src/events.ts`                             | GAME_HEADER_ACCURACY_ACK event                                     | VERIFIED | Lines 48 and 112 — const and interface both present                                             |
| `packages/server/src/gameEngine.ts`                         | applyResolveHeaderTarget, lastShotPath: null on 3 branches         | VERIFIED | `applyResolveHeaderTarget` at line 2276; 3 lastShotPath: null additions confirmed               |
| `packages/server/src/gameHandlers.ts`                       | GAME_HEADER_ACCURACY_ACK handler, auto-duel, winner guard          | PARTIAL  | ACK handler and winner guard wired; auto-duel wired but tie path leaves game deadlocked (CR-02) |
| `packages/server/src/__tests__/gameEngine.rule11.test.ts`   | Engine unit tests for RULE-01/02/03                                | VERIFIED | 20 tests, all pass                                                                              |
| `packages/server/src/__tests__/gameHandlers.rule11.test.ts` | Handler tests for ack, auto-duel, winner guard                     | VERIFIED | 9 tests, all pass                                                                               |
| `packages/client/src/components/ActionPanel.tsx`            | RULE-01 accuracy-roll gate                                         | VERIFIED | Lines 55, 56, 188-210 — gate and Continue button present                                        |
| `packages/client/src/store/useGameStore.ts`                 | emitHeaderAccuracyAck action                                       | VERIFIED | Lines 155 and 632                                                                               |
| `packages/client/src/components/HexGrid.tsx`                | snapDeflectPaceUsed subscription + canSelectSnapDeflect pace guard | VERIFIED | Lines 94 and 578                                                                                |
| `packages/client/src/store/useGameStore.rule11.test.ts`     | Client tests for RULE-04 + RULE-05                                 | VERIFIED | 5 tests, all pass                                                                               |

### Key Link Verification

| From                                   | To                       | Via                                | Status   | Details                                                                                                                      |
| -------------------------------------- | ------------------------ | ---------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| gameHandlers.ts GAME_HEADER_CONTESTANT | headerDuelWinner field   | auto-fire duel when both confirmed | PARTIAL  | Duel fires and sets headerDuelWinner correctly for win case; tie leaves null with no escape (CR-02)                          |
| gameHandlers.ts GAME_HEADER_TARGET     | applyResolveHeaderTarget | winner-guarded target resolution   | VERIFIED | `const result = applyResolveHeaderTarget(room.gameState, targetHex)` at line 1877; applyDeclareHeaderTarget no longer called |
| ActionPanel.tsx HEADER block           | emitHeaderAccuracyAck    | Continue button onClick            | VERIFIED | Line 196: `onClick={() => emitHeaderAccuracyAck()}`                                                                          |
| HexGrid.tsx canSelectSnapDeflect       | snapDeflectPaceUsed      | pace-exhaustion guard              | VERIFIED | `&& (snapDeflectPaceUsed ?? 0) < 2` at line 578                                                                              |

### Data-Flow Trace (Level 4)

| Artifact                         | Data Variable             | Source                                    | Produces Real Data                                                                                     | Status  |
| -------------------------------- | ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------- |
| ActionPanel.tsx HEADER gate      | headerAccuracyRollPending | gameState broadcast from server           | Yes — server sets true in applyRoll HIGH_PASS->HEADER (line 1083), clears via GAME_HEADER_ACCURACY_ACK | FLOWING |
| HexGrid.tsx canSelectSnapDeflect | snapDeflectPaceUsed       | gameState.snapDeflectPaceUsed from server | Yes — server writes field in SNAP_DEFLECT state transitions                                            | FLOWING |

### Behavioral Spot-Checks

| Behavior                             | Command                                                                                          | Result                               | Status |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------ | ------ |
| gameEngine.rule11 tests (20 tests)   | `pnpm --filter @counter-attack/server exec vitest run src/__tests__/gameEngine.rule11.test.ts`   | 20/20 pass                           | PASS   |
| gameHandlers.rule11 tests (9 tests)  | `pnpm --filter @counter-attack/server exec vitest run src/__tests__/gameHandlers.rule11.test.ts` | 9/9 pass                             | PASS   |
| Full server test suite               | `pnpm --filter @counter-attack/server test`                                                      | 251 pass, 1 skip, 1 todo (253 total) | PASS   |
| client rule11 tests (5 tests)        | `pnpm --filter @counter-attack/client exec vitest run src/store/useGameStore.rule11.test.ts`     | 5/5 pass                             | PASS   |
| Full client test suite               | `pnpm --filter @counter-attack/client test`                                                      | 38/38 pass                           | PASS   |
| TypeScript compilation               | `tsc --noEmit` in shared, server, client                                                         | Exit 0 in all three packages         | PASS   |
| No RULE-05 DIAGNOSIS instrumentation | grep for `[RULE-05 DIAGNOSIS]` in HexGrid.tsx                                                    | No match                             | PASS   |

### Requirements Coverage

| Requirement | Source Plan  | Description                                              | Status    | Evidence                                                                                                          |
| ----------- | ------------ | -------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------- |
| RULE-01     | 11-01, 11-03 | High-pass accuracy-roll gate before contestant selection | SATISFIED | headerAccuracyRollPending flag set server-side; ActionPanel.tsx gates UI; ACK handler clears; REQUIREMENTS.md [x] |
| RULE-02     | 11-01        | Header duel before target selection, winner-only target  | PARTIAL   | Win path verified; tie path leaves game deadlocked with no recovery (CR-02)                                       |
| RULE-03     | 11-02        | Shot-path cleared on loose-ball scatter                  | SATISFIED | 3 branches patched; 4 regression tests; REQUIREMENTS.md [x]                                                       |
| RULE-04     | 11-03        | SNAP_DEFLECT pace-exhaustion highlight suppression       | SATISFIED | HexGrid pace guard + store tests; REQUIREMENTS.md [x]                                                             |
| RULE-05     | 11-03        | Post-deflect Movement Phase selectability                | SATISFIED | Server-side reset confirmed correct; no client fix needed; tests pass; REQUIREMENTS.md [x]                        |

### Anti-Patterns Found

| File                                                      | Line      | Pattern                                                                                                                    | Severity                                           | Impact                                                                                                                                   |
| --------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/gameEngine.ts`                       | 50, 306   | `TESTING_PACE_OVERRIDE: number \| null = 15` — testing constant left active; all pieces receive 15-hex pace                | BLOCKER (pre-existing, flagged by CR-01 in REVIEW) | Breaks movement balance, ZoI calculations, pace-dependent features in any live session. Comment says "Remove before ship." — not removed |
| `packages/server/src/gameHandlers.ts`                     | 1963-1969 | Tie path stores `headerDuelWinner: null` with comment "UI should handle this" but no client or server recovery path exists | BLOCKER (Phase 11 introduced)                      | Game permanently stuck in HEADER phase on tie duel — no escape route for either team                                                     |
| `packages/server/src/gameHandlers.ts`                     | 1975      | Comment `// MUST be in finally — Pitfall 2` should be Pitfall 5                                                            | INFO (from IN-03)                                  | Minor comment error, no functional impact                                                                                                |
| `packages/server/src/__tests__/gameEngine.rule11.test.ts` | 318       | Vacuous distance-7 assertion inside `if (result7.ok)` — only executes when unexpected value found                          | INFO (from IN-02)                                  | Test appears to pass always; boundary check does not actually assert distance-7 failure                                                  |

**Note on CR-01 scope:** `TESTING_PACE_OVERRIDE = 15` is pre-existing (committed before Phase 11 work, in v1.0 era code). Phase 11's modifications to gameEngine.ts did not introduce or change this constant. The REVIEW correctly identified it. While it is a production blocker, it is not a Phase 11 regression — it existed before this phase. The VERIFICATION classifies it as a WARNING rather than a Phase 11 blocker; it should be addressed in a follow-up quick-fix plan.

### Human Verification Required

#### 1. Header Tie Deadlock Recovery

**Test:** In a live 2-player session, trigger a High Pass leading to a heading duel where both teams' contestant scores are equal (raw heading stat + die roll = same value for attacker and defender best contestants). Observe what happens after both teams confirm contestants.
**Expected:** The game should transition to LOOSE_BALL when the duel ties, allowing play to continue via the scatter roll.
**Why human:** Requires a real game session; dice randomization means tie probability is non-zero but cannot be reliably forced through automated integration tests. The deadlock exists in code (confirmed by static analysis) but testing it in production requires live play or a mocked dice injection to force equal scores.

### Gaps Summary

**One blocking gap** was found in the Phase 11 RULE-02 implementation. The header tie path is unimplemented:

- `computeHeaderDuelWinner` correctly returns `null` on equal attacker vs defender scores
- The `bothConfirmed` block in `GAME_HEADER_CONTESTANT` stores `headerDuelWinner: null` but takes no further action
- `GAME_HEADER_TARGET` emits `WRONG_TEAM` for null duelWinner — locking both teams out
- No alternative escape from HEADER phase exists (GAME_ROLL in HEADER now requires both-confirmed which is true, but would re-fire the duel from applyRoll inconsistently; no END_TURN handler for HEADER)

The fix is straightforward: in the `bothConfirmed` block, check `winner === null` and immediately transition to `LOOSE_BALL`, spreading `headerCleared` fields and calling `broadcastState`. This pattern was documented in CR-02 of the code review (11-REVIEW.md).

**One pre-existing production blocker** (not Phase 11's fault but requires attention before deployment):

- `TESTING_PACE_OVERRIDE = 15` in gameEngine.ts gives all pieces 15-hex pace, breaking movement balance. This was not introduced by Phase 11 but must be set to `null` before any live session.

---

_Verified: 2026-06-11T21:26:59Z_
_Verifier: Claude (gsd-verifier)_
