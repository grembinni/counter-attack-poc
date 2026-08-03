---
status: complete
phase: 33-design-tokens-highlight-standardization
source:
  [
    33-01-SUMMARY.md,
    33-02-SUMMARY.md,
    33-03-SUMMARY.md,
    33-04-SUMMARY.md,
    33-05-SUMMARY.md,
    33-06-SUMMARY.md,
    33-07-SUMMARY.md,
  ]
started: 2026-07-26T14:00:00Z
updated: 2026-07-26T14:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Valid-move hex tint is green, not gold

expected: Select a piece with legal moves. The reachable hexes highlight in green (previously gold).
result: pass

### 2. Goal-target hex tint is purple, not red

expected: Get into a shooting/heading phase where a goal-line target hex is highlighted. It renders purple, not red — red is reserved solely for the offside marker now.
result: pass
reported: "purple need to be 30% less opaque - too faded"
severity: cosmetic
fix: Raised 'goal' and 'safe' HIGHLIGHT_STYLES restOpacity/hoverOpacity from 0.5/0.65 to 0.65/0.8 (matches 'risk') in HexCell.tsx. Re-verified by user after fix — pass.

### 3. Selected piece ring vs already-acted piece ring are visually distinct

expected: During MOVEMENT, select and move one piece, then select another piece still eligible to act. The already-moved piece shows an orange ring with an orange X; the currently active/selectable piece shows a green ring. No piece shows a grey ring.
result: pass

### 4. Ball-location marker appears during response phases

expected: Enter a response phase (e.g., after a shot or header, during GK_DIVING/SNAP_DEFLECT/similar). A dedicated white ring appears on the ball's hex, rendered on top of any other highlight/ring on that hex.
result: pass

### 5. Offside marker is the only red highlight

expected: Trigger an offside flag on a piece. It shows a red ring around that piece. No other highlight/ring in the game (goal target, selection, tackle-risk, etc.) uses red.
result: pass

### 6. Overall chrome appearance unchanged from before this phase

expected: Browse the lobby, settings, team/draft selection, and in-game board. Colors (backgrounds, borders, text, buttons, scoreboard) look identical to before — this phase only centralized color values into tokens, it did not change any chrome color's appearance (Phase 34 is the palette swap).
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

- truth: "Goal-target hex tint renders purple (not red), at the current opacity shipped by Phase 33"
  status: fixed
  reason: "User reported: purple need to be 30% less opaque - too faded"
  severity: cosmetic
  test: 2
  artifacts: [packages/client/src/components/HexCell.tsx]
  missing: []
  fix: "Raised 'goal' and 'safe' restOpacity/hoverOpacity 0.5/0.65 -> 0.65/0.8 (matches 'risk'); user re-verified pass"
