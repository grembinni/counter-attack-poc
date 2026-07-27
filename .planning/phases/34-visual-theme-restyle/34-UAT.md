---
status: diagnosed
phase: 34-visual-theme-restyle
source: [34-01-SUMMARY.md, 34-02-SUMMARY.md, 34-03-SUMMARY.md, 34-04-SUMMARY.md]
started: 2026-07-26T00:00:00Z
updated: 2026-07-26T00:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Charcoal Theme - Lobby Screen

expected: Background/panels render in a dark charcoal/graphite palette (near-black page background, dark-gray panels) with near-white text. No blue-tinted chrome remains anywhere.
result: pass

### 2. Charcoal Theme - Settings Screen

expected: Game Settings screen matches the same charcoal/graphite palette as the lobby, with legible near-white text on the dark background.
result: pass

### 3. Charcoal Theme - Team/Uniform/Draft Selection Screens

expected: Team selection, uniform selection, and draft pack carousel screens render in the charcoal palette with legible text and visible accent colors — no blue chrome remnants.
result: issue
reported: "not ready 'confirm' on team select and roster should follow the white outline pattern for other buttons. Green ready 'confirm' should match the other green ready button patterns."
severity: cosmetic

### 4. Charcoal Theme - In-Game Board

expected: The hex board / in-game screen renders in the charcoal palette throughout (board chrome, panels, overlays) with no residual blue chrome.
result: pass

### 5. Team Accent Colors Visible

expected: Home/away team accent colors (jersey/UI highlight colors used around the board) render distinctly and are clearly visible against the dark background — not washed out, not invisible, not too similar to the background.
result: pass

### 6. Action Button Outline Visibility

expected: Action buttons (e.g. action panel buttons, End Turn, Confirm-style buttons) show a clearly visible thin light-gray outline separating them from their dark panel background.
result: pass

### 7. Player Stat Chip Layout

expected: Player stat chips (in Player Stats panel, Lineup Assignment, Draft Pack Carousel, and in-game board) show the value before the label, e.g. "5 PACE" rather than "PACE 5", packed together at a fixed left position rather than spread across the column.
result: pass

### 8. Uniform Selection Confirm Button

expected: The Confirm button on the Uniform Selection screen shows the same visible outline as other action buttons across the app (consistent styling).
result: issue
reported: "not ready 'confirm' on team select and roster should follow the white outline/text w/grey background pattern for other buttons. Green ready 'confirm' should match the other green ready button patterns."
severity: cosmetic

## Summary

total: 8
passed: 6
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Team selection, uniform selection, and draft pack carousel screens render in the charcoal palette with legible text and visible accent colors — no blue chrome remnants."
  status: failed
  reason: "User reported: not ready 'confirm' on team select and roster should follow the white outline pattern for other buttons. Green ready 'confirm' should match the other green ready button patterns."
  severity: cosmetic
  test: 3
  root_cause: "UniformSelectionScreen (the screen users actually experience as 'Team Select' — TeamSelectionScreen.tsx is dead/unreachable code since Phase 22) and LineupAssignmentScreen ('Roster') define bespoke, duplicated Confirm-button classes (.confirmButtonYellow/.confirmButtonGreen) instead of reusing the shared .ctaButton/.ctaButtonPending/.ctaButtonReady class family used everywhere else in the app. Prior fix commits (1a9d2b9, f827e95, already merged) added the --color-border-muted outline to these bespoke classes, but never reconciled their background-color tokens: not-ready state uses --color-confirm-pending-bg (#eab308 bright yellow/gold) instead of the canonical --color-cta-pending-bg (#f39c12) / grey-surface pattern, and ready state uses --color-success (#22c55e) instead of --color-cta-ready-bg (#27ae60). LineupAssignmentScreen also has no true not-ready visual state in code."
  artifacts:
  - path: "packages/client/src/components/UniformSelectionScreen.module.css"
    issue: ".confirmButtonYellow (lines ~223-238) and .confirmButtonGreen (lines ~244-260) use --color-confirm-pending-bg/--color-success instead of the canonical --color-cta-pending-bg/--color-cta-ready-bg tokens"
  - path: "packages/client/src/components/LineupAssignmentScreen.module.css"
    issue: ".confirmButtonGreen (lines ~60-77) uses --color-success instead of --color-cta-ready-bg; no not-ready/pending variant class exists"
  - path: "packages/client/src/components/ActionPanel.module.css"
    issue: "reference pattern — canonical .ctaButton/.ctaButtonPending/.ctaButtonReady (lines ~20-42, ~158-177)"
  - path: "packages/client/src/styles/tokens.css"
    issue: "two unreconciled token pairs coexist (lines ~50-91): --color-success vs --color-cta-ready-bg; --color-confirm-pending-bg vs --color-cta-pending-bg"
    missing:
  - "Migrate UniformSelectionScreen's .confirmButtonYellow/.confirmButtonGreen background-color to --color-cta-pending-bg / --color-cta-ready-bg (keep existing --color-border-muted border)"
  - "Migrate LineupAssignmentScreen's .confirmButtonGreen background-color to --color-cta-ready-bg (keep existing border)"
  - "Add a genuine not-ready visual state to LineupAssignmentScreen's Confirm button matching the canonical pending pattern, rather than hiding/always-rendering green"
    debug_session: ".planning/debug/team-roster-confirm-button-outline-mismatch.md"

- truth: "The Confirm button on the Uniform Selection screen shows the same visible outline as other action buttons across the app (consistent styling)."
  status: failed
  reason: "User reported: not ready 'confirm' on team select and roster should follow the white outline/text w/grey background pattern for other buttons. Green ready 'confirm' should match the other green ready button patterns."
  severity: cosmetic
  test: 8
  root_cause: "Duplicate of the test-3 gap — same root cause: UniformSelectionScreen's/LineupAssignmentScreen's bespoke .confirmButtonYellow/.confirmButtonGreen classes have the correct border (already patched) but the wrong background-color tokens (--color-confirm-pending-bg/--color-success instead of --color-cta-pending-bg/--color-cta-ready-bg)."
  artifacts:
  - path: "packages/client/src/components/UniformSelectionScreen.module.css"
    issue: "same as test-3 gap"
  - path: "packages/client/src/components/LineupAssignmentScreen.module.css"
    issue: "same as test-3 gap"
    missing:
  - "Same fix as test-3 gap — single fix closes both gaps"
    debug_session: ".planning/debug/team-roster-confirm-button-outline-mismatch.md"
