---
status: diagnosed
phase: 35-actionpanel-log-standardization
source: [35-VERIFICATION.md]
started: 2026-07-27T17:54:14Z
updated: 2026-07-27T18:10:00Z
---

## Current Test

[testing paused — 2 item(s) outstanding, 5 issue(s) diagnosed and routed to gap closure]

## Tests

### 1. Border removal reads as legible, not "unframed"

expected: Each panel is still legible and visually separated from the pitch by its background color alone — no panel looks like it "floats" or bleeds into the board with no border.
result: [pending]

### 2. Unified heading/helper/Confirm/Keeper system reads naturally across a real phase sequence

expected: |
Step through at least 8-10 of ActionPanel's ~18 phase states (MOVE, HIGH_PASS_MOVE,
GK_RESTART, HEADER contest, PASS chooser, PASS target prompt, FREE_MOVE,
SNAPSHOT_DEFLECT, a waiting/non-active-player state, KickOffSetupPanel,
FreeKickSetupPanel) and confirm the "Actions" heading, two-line helper block, and
Confirm/Confirmed button read naturally and consistently. Every state should show one
heading, one short title line, one detail line, and a single Confirm-labeled CTA that
changes color (orange while an eligible player remains, green when ready) exactly as
the phase-specific waiting text and terminology (Keeper, not GK/Goalie) describe.
result: issue
reported: "in action panel - text should be centered always - currently sometimes left; \"Placement: valid\" -> not relavant, give brief human friendly setup expectation; \"Centre hex: occupied / Centre hex: EMPTY — required\" -> not user friendly; \"Select how to move or use the ball.\" -> Not helpful, clean up language, move the player, pass, shoot; \"Free Move!\" -> \"Position for Kick!\""
severity: minor

### 3. Orange->green CTA transition is visually obvious in the five newly-converted phases

expected: |
Confirm the CTA color transition (orange->green) is visually distinguishable against
the new charcoal/graphite background for all five newly-converted phases
(HIGH_PASS_MOVE, FIRST_TIME_PASS_MOVE, SNAPSHOT_DEFLECT, GK_KICK_MOVE, FREE_MOVE) plus
FreeKickSetupPanel's Confirm button, matching the pre-existing MOVE/HEADER look. The
pending (orange) and ready (green) states should be as visually obvious in these five
phases as they already are in MOVE/HEADER.
result: [pending]

## Summary

total: 3
passed: 0
issues: 1
pending: 2
skipped: 0
blocked: 0

## Gaps

- truth: "KickOffSetupPanel text is centered, matching ActionPanel/FreeKickSetupPanel siblings"
  status: failed
  reason: "User reported: text should be centered always - currently sometimes left"
  severity: cosmetic
  test: 2
  root_cause: "KickOffSetupPanel.module.css's .panelHeading and .constraintRow classes are missing `text-align: center`, unlike the identically-named classes in ActionPanel.module.css and FreeKickSetupPanel.module.css (both already set text-align: center on these classes)."
  artifacts:
  - path: "packages/client/src/components/KickOffSetupPanel.module.css"
    issue: ".panelHeading (line ~14-18) and .constraintRow (line ~20-27) do not set text-align: center"
    missing:
  - "Add text-align: center to .panelHeading and .constraintRow in KickOffSetupPanel.module.css"
    debug_session: ""

- truth: "KickOffSetupPanel's placement status uses human-friendly setup language, not raw validation state"
  status: failed
  reason: "User reported: \"Placement: valid\" -> not relavant, give brief human friendly setup expectation"
  severity: minor
  test: 2
  root_cause: "KickOffSetupPanel.tsx line 111 renders the raw internal validation label 'Placement: valid' / 'Placement: N pieces out of zone' verbatim instead of a player-facing description of what's expected."
  artifacts:
  - path: "packages/client/src/components/KickOffSetupPanel.tsx"
    issue: "line 111: `{placementValid ? 'Placement: valid' : `Placement: ${piecesOutOfZone} pieces out of zone`}`"
    missing:
  - "Rewrite both branches as human-friendly setup guidance (e.g. describe what to do / confirm readiness) instead of 'Placement: valid'"
    debug_session: ""

- truth: "KickOffSetupPanel's centre-hex constraint status uses human-friendly language, not raw state labels"
  status: failed
  reason: "User reported: \"Centre hex: occupied / Centre hex: EMPTY — required\" -> not user friendly"
  severity: minor
  test: 2
  root_cause: "KickOffSetupPanel.tsx line 103 renders the raw constraint label 'Centre hex: occupied' / 'Centre hex: EMPTY — required' verbatim instead of a player-facing instruction."
  artifacts:
  - path: "packages/client/src/components/KickOffSetupPanel.tsx"
    issue: "line 103: `{centreHexOccupied ? 'Centre hex: occupied' : 'Centre hex: EMPTY — required'}`"
    missing:
  - "Rewrite both branches as human-friendly guidance (e.g. plain instruction to place a player on the centre hex) instead of 'Centre hex: ...'"
    debug_session: ""

- truth: "ActionPanel's action-chooser helper text tells the player what actions are available (move/pass/shoot), not a vague generic line"
  status: failed
  reason: "User reported: \"Select how to move or use the ball.\" -> Not helpful, clean up language, move the player, pass, shoot"
  severity: minor
  test: 2
  root_cause: "ActionPanel.tsx line 743 (the non-kick-off branch of the 'Choose an Action!' helperLine2) uses the generic placeholder 'Select how to move or use the ball.' instead of naming the available action categories."
  artifacts:
  - path: "packages/client/src/components/ActionPanel.tsx"
    issue: "line 743: `: 'Select how to move or use the ball.'`"
    missing:
  - "Reword to name the concrete available actions (move the player, pass, shoot) rather than the generic 'use the ball' phrasing"
    debug_session: ""

- truth: "ActionPanel's FREE_MOVE phase title reads 'Position for Kick!'"
  status: failed
  reason: "User reported: \"Free Move!\" -> \"Position for Kick!\""
  severity: cosmetic
  test: 2
  root_cause: "ActionPanel.tsx line 650 (FREE_MOVE_ATTACK / FREE_MOVE_DEFENSE helperLine1) hardcodes the title 'Free Move!'; product direction is to rename it to 'Position for Kick!'."
  artifacts:
  - path: "packages/client/src/components/ActionPanel.tsx"
    issue: "line 650: `<span className={styles.helperLine1}>Free Move!</span>` (also asserted in ActionPanel.test.tsx lines 225, 239)"
    missing:
  - "Rename 'Free Move!' to 'Position for Kick!' in ActionPanel.tsx and update the two matching assertions in ActionPanel.test.tsx"
    debug_session: ""
