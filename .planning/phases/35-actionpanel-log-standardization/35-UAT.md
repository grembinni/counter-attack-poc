---
status: testing
phase: 35-actionpanel-log-standardization
source: [35-VERIFICATION.md]
started: 2026-07-27T17:54:14Z
updated: 2026-07-27T21:54:51Z
---

## Current Test

number: 1
name: Unified heading/helper/Confirm/Keeper system reads naturally across a real phase sequence, now with the 5 reworded strings in place
expected: |
Step through at least 8-10 of ActionPanel's ~18 phase states (MOVE, HIGH_PASS_MOVE,
GK_RESTART, HEADER contest, PASS chooser, PASS target prompt, FREE_MOVE,
SNAPSHOT_DEFLECT, a waiting/non-active-player state, KickOffSetupPanel,
FreeKickSetupPanel) and confirm the heading/helper/Confirm/Keeper system reads
naturally, now with the 5 reworded strings (centered KickOffSetupPanel text,
human-friendly centre-hex/placement guidance, the move/pass/shoot action-chooser
line, and the "Position for Kick!" FREE_MOVE title) in place. Every state should
show one heading, one short title line, one detail line, and a single
Confirm-labeled CTA; the wording just changed by plan 35-06 should read naturally
in the context of a real phase sequence, not just in isolated unit-test assertions.
awaiting: user response

## Tests

### 1. Unified heading/helper/Confirm/Keeper system reads naturally across a real phase sequence, now with the 5 reworded strings in place

expected: |
Step through at least 8-10 of ActionPanel's ~18 phase states (MOVE, HIGH_PASS_MOVE,
GK_RESTART, HEADER contest, PASS chooser, PASS target prompt, FREE_MOVE,
SNAPSHOT_DEFLECT, a waiting/non-active-player state, KickOffSetupPanel,
FreeKickSetupPanel) and confirm the heading/helper/Confirm/Keeper system reads
naturally, now with the 5 reworded strings (centered KickOffSetupPanel text,
human-friendly centre-hex/placement guidance, the move/pass/shoot action-chooser
line, and the "Position for Kick!" FREE_MOVE title) in place. Every state should
show one heading, one short title line, one detail line, and a single
Confirm-labeled CTA; the wording just changed by plan 35-06 should read naturally
in the context of a real phase sequence, not just in isolated unit-test assertions.
result: [pending]

### 2. Border removal reads as legible, not "unframed"

expected: |
Confirm each ActionPanel/ActionLog-area container (ActionLog, ActionPanel
confirmCard, FreeKickSetupPanel confirmCard, ReplayPanel, SideLog collapsed/expanded
strip) still reads as visually distinct from the pitch now that all frame borders
are removed. Each panel is still legible and visually separated from the pitch by
its background color alone — no panel looks like it "floats" or bleeds into the
board with no border.
result: [pending]

### 3. Orange->green CTA transition is visually obvious in the five newly-converted phases

expected: |
Confirm the CTA color transition (orange->green) is visually distinguishable against
the charcoal/graphite background for all five newly-converted phases
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

<!-- Previous gap-closure cycle: 5 gaps diagnosed from test 2 (2026-07-27T18:10:00Z) were
     closed by plan 35-06 (commits f63bf99, eb28ae5) and independently re-verified against
     source in 35-VERIFICATION.md (2026-07-27T21:54:51Z, re-verification pass). Test 1 and 3
     were never executed in the prior UAT run (paused after test 2). All 3 tests above are
     reset to pending for this UAT pass. -->
