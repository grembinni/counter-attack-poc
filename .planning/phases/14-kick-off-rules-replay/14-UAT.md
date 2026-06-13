---
status: complete
phase: 14-kick-off-rules-replay
source: 14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md
started: 2026-06-12T00:00:00Z
updated: 2026-06-12T00:00:00Z
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test

expected: Kill any running server/service. Clear ephemeral state. Start the application from scratch. Server boots without errors and a basic connection (socket connect + room join) succeeds.
result: pass

### 2. Kick-off Piece Placement (MATCH-06)

expected: At kick-off, all DEF and MID pieces for both teams start within the q∈[6,19] column range.
result: issue
reported: "setup boundary was suppose to be x,6 -> x,19 — Away DEF pieces were at q=20 which is outside the bound"
severity: major
fixed: "away-1/2/3 DEF positions corrected q=20→q=19 in teams.ts; 218 shared tests pass"

### 3. Kick-off Standard Pass Only (MATCH-07)

expected: During kick-off phase, only Standard Pass button is shown; other pass types are hidden. Server also rejects non-standard passes with KICKOFF_STANDARD_PASS_ONLY.
result: issue
reported: "standard pass should be the only action available on kickoff but 4 buttons are there"
severity: major
fixed: "ActionPanel.tsx: added isKickOff guard — suppresses FIRST_TIME_PASS, HIGH_PASS, LONG_BALL, Shoot, Snapshot buttons when phase === KICK_OFF"

### 4. Replay Speed: 500ms Cadence (REPLAY-04)

expected: After the match ends, the post-game replay playback runs at 500ms per frame (previously 1000ms). Each step of the action sequence should feel noticeably faster than before.
result: pass

### 5. Replay Simultaneous Movement (REPLAY-05)

expected: When a replay includes a phase where multiple pieces moved (e.g. a kick-off sequence where several pieces relocated), all those pieces animate simultaneously in the same step-frame, rather than one after another. Pieces with shorter paths hold their final hex while longer-path pieces continue advancing.
result: pass

### 6. Replay Ball Tracking Accuracy (REPLAY-06)

expected: Throughout any replay, the ball (and its carrier indicator) accurately reflects where the ball was at each step — including pickups, passes, shots, and goals. The ball should not "teleport" to an incorrect position mid-replay.
result: issue
reported: "there are some bugs but defer fixing them to a later phase"
severity: minor
deferred: true

## Summary

total: 6
passed: 3
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Away DEF pieces must start within q∈[6,19] at kick-off"
  status: fixed
  reason: "User reported: setup boundary was suppose to be x,6 -> x,19 — Away DEF pieces were at q=20"
  severity: major
  test: 2
  root_cause: "MATCH-06 bound documented as [6,20] in plan but correct spec is [6,19]; away-1/2/3 positions set to q=20"
  artifacts:
  - path: "packages/shared/src/teams.ts"
    issue: "away-1/2/3 position.q was 20, corrected to 19"
    missing: []
    fixed_inline: true

- truth: "During kick-off only Standard Pass and Move are shown as available actions"
  status: fixed
  reason: "User reported: standard pass should be the only action available on kickoff but 4 buttons are there"
  severity: major
  test: 3
  root_cause: "ActionPanel KICK_OFF branch used ELIGIBLE_NEXT_ACTIONS[MOVEMENT_PHASE] without filtering — rendered all 4 pass type buttons. Server-side guard existed but UI showed all options."
  artifacts:
  - path: "packages/client/src/components/ActionPanel.tsx"
    issue: "No isKickOff guard on FIRST_TIME_PASS, HIGH_PASS, LONG_BALL, Shoot, Snapshot buttons"
    missing:
  - "isKickOff const derived from phase; all non-standard-pass buttons wrapped with !isKickOff &&"
    fixed_inline: true
