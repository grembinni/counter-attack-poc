---
slug: possession-phase-bugs
status: complete
completed: 2026-06-06
commit: 1f4417c
---

# Possession & Phase Transition Bugs — Complete

## What was fixed

**Bug 1+3 — Steal/tackle didn't end the phase:**
`applyMove` tackle-success and steal-success branches both had `movementSlot: 'ATTACKER_4'`
with no `phase` override, so the game stayed in MOVEMENT and restarted for the new team.
Fixed by adding `phase: 'PASS'` and `movementSlot: null`. The new attacking team now lands
in the PASS chooser showing `ELIGIBLE_NEXT_ACTIONS['SUCCESSFUL_TACKLE']` options
(Move, Standard Pass, High Pass, Long Ball, Snapshot).

**Bug 2 — ATTACKER_2 used piece.pace:**
`moveValidator.ts` now computes `effectivePace = movementSlot === 'ATTACKER_2' ? Math.min(piece.pace, 2) : piece.pace`
and uses it for the pace-exceeded check. All 215 shared tests pass.

## Files changed

- `packages/server/src/gameEngine.ts` — tackle + steal success return values
- `packages/shared/src/moveValidator.ts` — ATTACKER_2 pace cap
