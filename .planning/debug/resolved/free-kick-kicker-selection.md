---
slug: free-kick-kicker-selection
status: resolved
trigger: 'FREE_KICK_SETUP kicker selection is broken. The first step of the free kick phase (selecting who takes the kick) shows no eligible indicators on kicking team pieces, and after clicking a piece the board looks unchanged because the D-48 blue zone tint has higher priority than the valid-move safe/green tint. Users cannot tell any selection happened.'
created: '2026-07-11'
updated: '2026-07-11'
---

## Symptoms

- No player can visually be identified as selectable during kicker selection step
- Clicking a piece shows a green ring (selection works mechanically) but board does not change
- Screen is blue before any piece is selected (D-48 zone tinting)
- Server correctly gates kicker placement to freeKickHex only; client does not reflect this

## Current Focus

- hypothesis: Two client-side rendering bugs: (1) isFreeKickEligible suppresses blue eligible ring during kicker selection; (2) selectPiece returns ALL pitch hexes as valid but they are obscured by kickoff tint priority
- next_action: Apply fixes to HexGrid.tsx and useGameStore.ts

## Evidence

- timestamp: 2026-07-11T00:00:00Z
  observation: 'isFreeKickEligible has guard: freeKickKickerChosen !== false — when kicker not yet chosen (false), this evaluates to false, suppressing the selectable ring on all pieces (HexGrid.tsx:806)'
  interpretation: Pieces appear unclickable during kicker selection

- timestamp: 2026-07-11T00:00:00Z
  observation: 'selectPiece returns all PITCH_HEXES (minus own-occupied) as validMoveHexes for kicking team (isKickingTeam = true => return true for all). But board is already fully tinted by isInMyFreeKickZone (isKickoffTint). Cascade priority: kickoff > safe. So validMoveHexes cannot visually override the existing blue tint.'
  interpretation: After selection the board looks identical to before — user sees "no other action"

- timestamp: 2026-07-11T00:00:00Z
  observation: 'Server side (applyFreeKickMove): when freeKickKickerChosen === false, only moves to freeKickHex are accepted. Client does not reflect this restriction.'
  interpretation: Client should restrict validMoveHexes to [freeKickHex] during kicker selection

## Eliminated

## Resolution

- root_cause: 'Two client bugs: (1) isFreeKickEligible guard freeKickKickerChosen !== false suppresses eligible ring during kicker selection. (2) selectPiece computes all pitch hexes as valid during kicker selection; the D-48 blue tint has higher cascade priority so the valid hexes are invisible.'
- fix: '(1) Remove freeKickKickerChosen !== false from isFreeKickEligible in HexGrid.tsx. (2) In selectPiece FREE_KICK_SETUP branch, when freeKickKickerChosen === false set validMoveHexes = [freeKickHex] only.'
- files_changed:
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/store/useGameStore.ts
