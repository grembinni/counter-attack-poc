---
status: testing
phase: 35-actionpanel-log-standardization
source: [35-VERIFICATION.md]
started: 2026-07-27T17:54:14Z
updated: 2026-07-27T17:54:14Z
---

## Current Test

number: 1
name: Border removal reads as legible, not "unframed"
expected: |
Play through a full match (or use existing dev tooling to step through phases) and
visually confirm every ActionPanel/ActionLog-area container reads as visually distinct
from the pitch background now that all frame borders are removed (ActionLog, ActionPanel
confirmCard, FreeKickSetupPanel confirmCard, ReplayPanel, SideLog collapsed/expanded strip).
Each panel should still be legible and visually separated from the pitch by its background
color alone (var(--color-bg-surface)) — no panel should look like it "floats" or bleeds
into the board with no border.
awaiting: user response

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
result: [pending]

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
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
