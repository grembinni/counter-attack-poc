---
status: complete
phase: 22-uniform-selection-screen
source:
  - 22-01-SUMMARY.md
  - 22-02-SUMMARY.md
  - 22-03-SUMMARY.md
started: 2026-07-05T11:30:00Z
updated: 2026-07-05T11:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Both players reach the uniform selection screen

expected: |
Open two browser tabs at http://localhost:5173. In Tab A, click Create Room and note the room code.
In Tab B, enter the code and join. Both tabs should advance past the lobby and show the
"Home: choose your team + style" / "Away: choose your team + style" heading — NOT the old
tabbed team-selection screen.
result: pass

### 2. Away player is locked until home confirms

expected: |
Before home player has confirmed, the away tab should show "Waiting for home player to confirm
their selection…". All 12 team cards AND all 18 style tiles should be greyed out / not
clickable. The Confirm button should be disabled.
result: pass

### 3. Home team selection — flat grid with primary color cards

expected: |
In the home tab: 12 team cards displayed in a flat 6×2 grid (no tabs). Each card shows the
team badge on top of the team's primary color background. Badges should not have a white
rectangular background — the badge should blend into the colored card.
result: pass

### 4. Home style selection — 2 rows of 9

expected: |
Below the team grid, 18 style tiles arranged in 2 rows of 9. Each tile shows the uniform
pattern rendered in neutral grey before a team is selected.
result: pass

### 5. Selecting a team updates style tiles to team colors

expected: |
Click any team card in the home tab. The 18 style tiles should immediately re-render in that
team's primary + alt colors. The team's default style tile should be pre-selected
(aria-pressed highlight / colored border).
result: pass

### 6. Style tile numbers are legible

expected: |
Each style tile shows its number (1–18) overlaid on the uniform pattern. Numbers should be
large and clearly readable — approximately 26px, not tiny.
result: pass

### 7. Home confirms — away unlocks and sees opponent banner

expected: |
Home picks a team + style and clicks Confirm. The home tab shows "Waiting for opponent…".
The away tab should immediately unlock (all cards + tiles become clickable) and show the
"Opponent confirmed" banner with a mini piece showing home's chosen style.
result: pass

### 8. Away cannot pick home's team or home's style

expected: |
In the away tab (after home confirms), the home player's team card should be greyed out /
disabled. Home's confirmed style tile should also be greyed out / not selectable.
result: pass

### 9. Away sees their own team's away colors on style tiles

expected: |
When the away player selects a team, the 18 style tiles should render in that team's AWAY
colors (awayPrime / awayAlt), not the home colors.
result: pass

### 10. Both confirm — game starts

expected: |
Away picks a team + style and clicks Confirm. Both tabs should transition off the selection
screen and into the game board (kick-off setup phase). The game should start normally.
result: pass

### 11. Confirmed uniform styles visible on pieces during play

expected: |
Once in-game, home outfield pieces should display the style chosen by the home player, and
away outfield pieces should display the style chosen by the away player. The pieces in the
hex grid should NOT all show the same default style.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
