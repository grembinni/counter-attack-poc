---
slug: free-kick-setup-undo-not-implemented
type: todo
area: free-kick
created: 2026-07-11
source: Phase 25 UAT
---

# FREE_KICK_SETUP: Undo not implemented

## Description

The FREE_KICK_SETUP repositioning stages have no Undo support. The Plan 25-06 spec called for undo to be disabled at the start of each stage (no moves yet) and functional within a stage, with stage-boundary enforcement preventing cross-stage undo. None of this was built — the Undo button behaviour during FREE_KICK_SETUP is undefined.

## Expected behaviour (from Plan 25-06 spec)

- Undo **disabled** (greyed out) when current stage has zero moves committed
- Undo **enabled** once at least one move exists in the current stage
- Undo cannot cross stage boundaries (i.e., undoing in stage 2 cannot reach stage 1 moves)
- FK_STAGE_ADVANCE event in eventLog serves as the undo boundary marker (applyUndo scans for last FK_STAGE_ADVANCE)

## Acceptance criteria

- [ ] Undo button is greyed out at start of each FREE_KICK_SETUP stage
- [ ] Undo reverts the most recent FK_SETUP_MOVE within the current stage
- [ ] Undo is blocked once the stage boundary (FK_STAGE_ADVANCE) is reached
- [ ] Works in two-tab session — each team sees correct Undo state for their stage

## Notes

The main step sequence (A:choose-kicker → A:4 → D:4 → A:3 → D:2 → A:kick) works correctly. Only undo is missing.
