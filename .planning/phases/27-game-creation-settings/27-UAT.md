---
status: complete
phase: 27-game-creation-settings
source:
  - 27-01-SUMMARY.md
  - 27-02-SUMMARY.md
  - 27-03-SUMMARY.md
  - 27-04-SUMMARY.md
  - 27-05-SUMMARY.md
started: 2026-07-21T00:00:00.000Z
updated: 2026-07-21T00:05:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Host lands on Game Settings screen after creating a room

expected: After creating a room, the host (slot 1) is routed to a "Game Settings" screen instead of the old Waiting screen. It shows a Match Speed picker (slow/standard/fast), a Standard/Draft team-type toggle, and a "Confirm Settings" button.
result: pass

### 2. Draft mode reveals pool checkboxes; Legends/Icons disabled; Original pre-checked

expected: Toggling from Standard to Draft reveals five pool checkboxes (Original, MLS, International, Legends, Icons). Original is pre-checked by default. Legends and Icons are disabled and labelled "(coming soon)". Switching back to Standard hides the checkboxes.
result: pass

### 3. Confirm Settings button gating in Draft mode

expected: In Draft mode, if you uncheck all enabled pools (Original/MLS/International) so zero are selected, the "Confirm Settings" button becomes disabled. Checking at least one enabled pool re-enables it.
result: pass

### 4. Joiner never sees Game Settings; race gate holds until host confirms

expected: Open a second browser tab and join the room code before the host confirms settings. The joiner should NOT be taken to Team Selection yet — it should wait. Only after the host clicks "Confirm Settings" does the joiner (and host) advance to Team Selection.
result: pass

### 5. Standard mode: read-only speed subheader on selection screens

expected: After confirming Standard-mode settings, the Team/Uniform selection screen shows a read-only match-speed subheader (e.g. an icon + "Standard") directly under the screen heading, centered — no interactive speed buttons to click.
result: pass

### 6. Draft mode: single settings summary line on selection screens

expected: After confirming Draft-mode settings (e.g. Fast speed, Original + MLS pools), the Team/Uniform selection screen shows one centered summary line like "Speed: ⚡ Fast · Team Type: Draft · Draft Pool: Original, MLS" instead of the plain speed subheader.
result: pass

### 7. Scoreboard shows active match speed during play

expected: Once the match is underway (not on the Replay screen), the in-game scoreboard shows a read-only speed segment (icon + label matching the confirmed speed) alongside the existing phase label.
result: pass

### 4. Joiner never sees Game Settings; race gate holds until host confirms

expected: Open a second browser tab and join the room code before the host confirms settings. The joiner should NOT be taken to Team Selection yet — it should wait. Only after the host clicks "Confirm Settings" does the joiner (and host) advance to Team Selection.
result: [pending]

### 5. Standard mode: read-only speed subheader on selection screens

expected: After confirming Standard-mode settings, the Team/Uniform selection screen shows a read-only match-speed subheader (e.g. an icon + "Standard") directly under the screen heading, centered — no interactive speed buttons to click.
result: [pending]

### 6. Draft mode: single settings summary line on selection screens

expected: After confirming Draft-mode settings (e.g. Fast speed, Original + MLS pools), the Team/Uniform selection screen shows one centered summary line like "Speed: ⚡ Fast · Team Type: Draft · Draft Pool: Original, MLS" instead of the plain speed subheader.
result: [pending]

### 7. Scoreboard shows active match speed during play

expected: Once the match is underway (not on the Replay screen), the in-game scoreboard shows a read-only speed segment (icon + label matching the confirmed speed) alongside the existing phase label.
result: [pending]

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
