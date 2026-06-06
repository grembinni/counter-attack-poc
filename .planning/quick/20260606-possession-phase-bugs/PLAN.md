---
slug: possession-phase-bugs
created: 2026-06-06
status: in-progress
---

# Fix Possession & Phase Transition Bugs

## Bugs

### Bug 1 — Defender loses ball at end of phase after steal/tackle

After a successful steal or tackle, the game was restarting ATTACKER_4 for the
new team (still in MOVEMENT phase). This meant the game continued moving instead
of ending the phase. The ball was also implicitly being returned at phase end.

### Bug 2 — ATTACKER_2 uses character pace instead of capped pace of 2

The last 2 attacker movements (ATTACKER_2 slot) should enforce a maximum of 2
hexes per piece. The moveValidator was using piece.pace directly.

### Bug 3 — Phase does not end on steal/tackle (same root cause as Bug 1)

After possession change, the game auto-started a new movement phase (ATTACKER_4)
for the new attacking team instead of transitioning to PASS phase so the new
attacker can choose their next action from SUCCESSFUL_TACKLE eligible options.

## Fixes

### gameEngine.ts — steal success return (applyMove ~line 370)

Change:
`movementSlot: 'ATTACKER_4', movedPieceIds: [], paceUsedByPieceId: {}`
To:
`phase: 'PASS', movementSlot: null, movedPieceIds: [], paceUsedByPieceId: {}`

### gameEngine.ts — tackle success return (applyMove ~line 319)

Same change as steal success.

### moveValidator.ts — pace cap for ATTACKER_2 (line 88)

Change:
`if (paceUsed + 1 > piece.pace)`
To:
`const effectivePace = state.movementSlot === 'ATTACKER_2' ? Math.min(piece.pace, 2) : piece.pace;`
`if (paceUsed + 1 > effectivePace)`
