---
status: complete
phase: 21-new-teams-mls-international
source:
  - 21-01-SUMMARY.md
  - 21-02-SUMMARY.md
started: 2026-07-04T16:40:00.000Z
updated: 2026-07-04T16:45:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. MLS Tab Default

expected: Open team selection screen; MLS tab is active by default (underlined/bold); 6 MLS cards visible (City, Crew, LA, Miami, Nashville, Seattle); no international cards shown.
result: pass

### 2. International Tab Switch

expected: Click the "International" tab; it becomes active (underline/bold moves to International); 6 international cards appear (Canada, England, France, Mexico, Spain, USA); MLS cards are no longer shown.
result: pass

### 3. All 10 New Team Badges Render

expected: On the MLS tab, LA, Miami, Nashville, and Seattle each show a badge image (no broken image icon, no placeholder). Switch to International; Canada, England, France, Mexico, Spain, and USA each show a badge image. All badges look roughly 80×80 in the card.
result: pass

### 4. Away Auto-Switch to Picked Team's Tab

expected: |
Requires two browser windows in the same room.
Home player (window A) switches to the International tab and picks France.
Away player (window B) — who had MLS active — should automatically switch to the International tab, with France's card struck out (dimmed, not clickable).
result: pass

### 5. Cross-Tab Struck-Out Persists

expected: |
Continuing the two-browser setup from Test 4 (France struck out for away player).
Away player (window B) manually clicks the MLS tab, then clicks back to International.
France's card should still be struck out on the International tab.
result: pass

### 6. Pick a New Team and Advance

expected: |
Away player (window B) selects an available International team (e.g. Mexico — not the one home picked).
The team selection screen should advance past team selection (to the next screen — uniform selection or game start depending on phase state).
result: pass

## Summary

total: 6
passed: 6
issues: 0
skipped: 0
pending: 0

## Gaps

[none yet]
