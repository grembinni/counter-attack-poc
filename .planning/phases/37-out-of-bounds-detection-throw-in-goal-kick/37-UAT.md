---
status: diagnosed
phase: 37-out-of-bounds-detection-throw-in-goal-kick
source: [37-14-SUMMARY.md, 37-15-SUMMARY.md, 37-16-SUMMARY.md, 37-17-SUMMARY.md, 37-18-SUMMARY.md]
started: 2026-08-05T17:40:38Z
updated: 2026-08-05T17:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Even-Q r=0 Boundary Hex Is Genuinely Out-of-Bounds

expected: A ball reaching hex (20,0) — or any even-q, r=0 hex — is treated as out-of-bounds by the rules engine (e.g. it triggers a restart / the loose-ball clamp refuses to advance onto it), consistent with every other out-of-bounds edge. Note: this is a rules-layer-only fix — the pitch does NOT render or look any different than before.
result: pass

### 2. Throw-In No Longer Places a Piece on an Invisible Hex

expected: Play a match with Out-of-Bounds enabled until a ball scatters over a sideline near the top or bottom edge. During Throw-In setup, select a thrower and confirm — the piece and ball should not disappear; the throw-in should never resolve onto one of the previously-invisible hexes. (Note: hexes at odd-q r=0 and r=25 may still render partially clipped — that's a known, accepted cosmetic gap, not a bug to report here.)
result: pass

### 3. Throw-In Setup Panel: Redundant Line Removed

expected: The Throw-In setup panel shows the "Throw-In" heading and the instruction "Select a player to take the throw." — with no extra redundant line beneath the heading.
result: pass

### 4. Goal Kick Places Ball and Keeper at a Fixed Restart Hex

expected: When a Goal Kick is awarded, the ball and the goalkeeper are placed at a fixed byline-center hex for their team (not wherever the keeper happened to be standing) before the 6-hex reposition window opens.
result: pass

### 5. Goal Kick: Standard Pass No Longer Requires Double Selection

expected: From the Goal Kick choice screen, choosing "Standard Pass" goes directly into target-hex selection for the pass — you should not need to click Standard Pass a second time.
result: pass

### 6. Goal Kick: Header-Target Ring Is Visible

expected: After choosing "Kick" and selecting an outfield teammate as the header target, a distinct ring/marker appears at the target hex during the travel-movement window that follows, visible to both teams.
result: issue
reported: "partial pass. It does highlight the target hex but it should display the same white radius hexes as a header for the response move"
severity: minor

### 7. Restart Setup Panels Show Human-Readable Errors

expected: During Throw-In, Goal-Kick, or Free-Kick setup/reposition windows, attempting an invalid action (e.g. clicking off-pitch, a non-adjacent hex, or an occupied hex) shows a plain-English message (e.g. "That hex is off the pitch") rather than a raw code like "OFF_PITCH" or "MOVE_INVALID".
result: pass

### 8. Free-Move Can No Longer Target an Off-Pitch Hex

expected: During a Zone-of-Influence-triggered free move, attempting to move a piece onto an off-pitch hex is rejected by the server (the move fails / is not applied) rather than silently succeeding.
result: pass

## Summary

total: 8
passed: 7
issues: 1
pending: 0
skipped: 0

## Gaps

<!-- YAML fenced to prevent the markdown formatter from corrupting nested list indentation -->

```yaml
- truth: 'After selecting the header target during a Goal Kick Kick path, the response-move highlight for both teams single-piece travel shows the same white radius/range hexes used elsewhere for a header response move, not just a marker at the target hex'
  status: failed
  reason: 'User reported: partial pass. It does highlight the target hex but it should display the same white radius hexes as a header for the response move'
  severity: minor
  test: 6
  root_cause: "HexGrid.tsx's highPassContestZoneSet (the white, radius-based, selection-independent 'header contest zone preview' that highlights the ball's landing hex plus all hexes within 2 hexes of it) is phase-gated exclusively to phase === 'HIGH_PASS_MOVE'. GOAL_KICK_MOVE is the structural analog of HIGH_PASS_MOVE (both are single-piece-per-team response-move windows that resolve directly into a HEADER contest, per gameEngine.ts's applyGoalKickMoveEnd doc comment), but it was never given the equivalent branch. This is distinct from the per-piece 'valid move destination' highlight (a single green hex shown after clicking a piece), which is already fully and correctly wired for GOAL_KICK_MOVE — the missing piece is only the always-on, selection-independent white radius preview."
  artifacts:
    - path: 'packages/client/src/components/HexGrid.tsx'
      issue: "highPassContestZoneSet (lines ~234-245) only computes for phase === 'HIGH_PASS_MOVE'; its two consumption sites (isShotPathActionTint at ~489, isShotPathTint at ~502) have no GOAL_KICK_MOVE counterpart"
  missing:
    - "Extend (or add a parallel set alongside) highPassContestZoneSet so it also populates when phase === 'GOAL_KICK_MOVE', centered on ball.position (== goalKickTargetHex during this phase), and fold it into the same isShotPathActionTint/isShotPathTint expressions HIGH_PASS_MOVE already uses"
  debug_session: .planning/debug/goal-kick-header-response-move-radius-missing.md
```

## Known Deferred Items (not being re-tested — carried forward as-is, no fix attempted)

- Pitch visual clip at odd-q r=0/r=25 rows (~50% visible) is unchanged — accepted as cosmetic-only per the 37-14 scope reduction, since those hexes remain legitimately in-bounds.
- Goal-kick defenders inside the penalty box are not auto-relocated during the reposition window — determined during diagnosis to be new game-rule scope (would need a new requirement, e.g. GOALKICK-02a), not a bug fix.
- "Movement Phase" terminology on the Throw-In choice screen is unchanged — flagged as a whole-game UI-copy inconsistency, out of Phase 37's scope to fix in isolation.
- Regular Movement Phase (`validateMove`) still has no `isPitchHex`/`OFF_PITCH` guard (only `applyFreeMove` and goal-kick reposition were closed) — flagged as a follow-up, not fixed in this phase.
