---
created: 2026-07-02T00:00:00.000Z
title: 'Bug — KICK_OFF_SETUP shows persistent light shading on hexes matching prior shot path'
area: rendering
files:
  - packages/client/src/components/HexGrid.tsx
  - packages/server/src/gameHandlers.ts
  - packages/server/src/gameEngine.ts
---

## Problem

After a goal scored via the SNAPSHOT_DEFLECT flow (snapshot shot → defender repositions → goal), certain hexes in the KICK_OFF_SETUP blue zone appear with a slightly lighter or different shade than the standard kickoff blue. The affected hexes correspond to the path of the prior shot (from the attacker's position toward the declared goal target), as if `lastShotPath` was still active.

**User observation:** "looks like its the path a player used to try and deflect the shot" / "it sits thier through the entire kickoff setup."

This is persistent through the ENTIRE KICK_OFF_SETUP phase — not a transient flicker. Rules out intermediate render artifacts from the GK_DIVE state.

## What We Know

### Server side — all paths clear `lastShotPath: null` before KICK_OFF_SETUP

Exhaustively verified in `gameEngine.ts` and `gameHandlers.ts`:

- Goal outcome 1 (line ~1943): `lastShotPath: null`
- Goal outcome 2 (line ~2030): `lastShotPath: null`
- LOOSE_BALL deflection (line ~946 in gameHandlers.ts): `lastShotPath: null`
- Auto-GOAL when GK out of range (line ~1009 in gameHandlers.ts): `lastShotPath: null`
- GK saves kick (line ~2118): `lastShotPath: null`
- GK holds (line ~2136): `lastShotPath: null`
- Half-time start (line ~4108): `lastShotPath: null` (fix applied in phase 18.3)

### Client side — all `isShotPathTint` components are phase-gated

In `HexGrid.tsx` ~line 413:

```typescript
const isShotPathTint =
  (phase !== 'KICK_OFF_SETUP' && lastShotPathSet.has(hexId)) ||
  isHpMoveTarget ||
  isGKDiveTarget ||
  isShotPath ||
  highPassContestZoneSet.has(hexId);
```

- `phase !== 'KICK_OFF_SETUP' && lastShotPathSet.has(hexId)` — explicit guard added, definitively false during KICK_OFF_SETUP
- `isHpMoveTarget = (phase === 'SNAPSHOT_DEFLECT' && ...) || isGKDiveTarget` — false (phase-gated)
- `isGKDiveTarget = phase === 'GK_DIVE' && ...` — false (phase-gated)
- `isShotPath = snapDeflectPathSet.has(hexId)` — false (snapDeflectPathSet only built when phase === 'SNAPSHOT_DEFLECT')
- `highPassContestZoneSet.has(hexId)` — false (set only built when phase === 'HIGH_PASS_MOVE')

`isShotPathTint` is mathematically provably false for ALL hexes during KICK_OFF_SETUP.

### Other potential causes ruled out

- `validMoveHexes` — cleared by `setGameState` clear path when phaseChanged = true ✓
- `validPassTargetHexes` — cleared on phase change ✓
- `isPassTarget` — gated on `phase === 'PASS' || phase === 'KICK_OFF'` ✓
- `isHeaderNonGoalTarget` — gated on `phase === 'HEADER'` ✓
- `gkKickTargetSet`, `quickThrowTargetSet` — phase-gated sets ✓
- All polygon overlays in the per-hex render loop are individually phase-gated ✓
- No SVG `<line>` or `<path>` elements that could draw a persistent shot-path line ✓

### Unknown: root cause not identified via static analysis

Despite all the above proving `isShotPathTint = false` during KICK_OFF_SETUP, the shading persists. The code appears correct, yet the bug occurs. This suggests one of:

1. A server-side path to KICK_OFF_SETUP we haven't found that leaves `lastShotPath` non-null — but our client guard should suppress it even then.
2. A Zustand state update race where a stale intermediate state is rendered briefly, but "persists through entire kickoff setup" contradicts this.
3. The "light shading" may not be from `isShotPathTint` at all — could be a subtle visual artifact from the `HexCell` component itself, or from how the kickoff blue tint (`rgba(59,130,246,1)` at 0.4 opacity) interacts with the green pitch on hexes that also had some OTHER state set.
4. The shading might be from `shotTargetHighlight` (a React `useState<HexCoord | null>` in HexGrid.tsx) that is NEVER cleared — it causes `isGoalTint = true` on the stale goal hex → RED tint, not white. But this is only one hex (the declared goal target), not a "path."

## Suggested Investigation

1. Add `console.log` instrumentation in `HexGrid.tsx` to print the active `highlightType` and raw boolean values for each hex during `KICK_OFF_SETUP`. Filter for hexes showing unexpected values.
2. Log `gameState.lastShotPath` on every `setGameState` call during KICK_OFF_SETUP to confirm server is actually sending `null`.
3. Check whether the shading hexes align exactly with `lastShotPath` hexes from the prior shot, or with `validMoveHexes` from the defender's SNAPSHOT_DEFLECT reposition.
4. Look at `HexCell.tsx` to see if there's any internal state or derived color that could produce a third visual variant beyond "kickoff blue" and "no highlight."

## Suggested Fix Approach (to try first)

Broaden the client-side guard to cover the ENTIRE `isShotPathTint` block, not just the `lastShotPath` clause. This is belt-and-suspenders since all sub-conditions should already be false, but eliminates any edge case not caught by analysis:

```typescript
// In HexGrid.tsx ~line 413
const isShotPathTint =
  phase !== 'KICK_OFF_SETUP' &&
  (lastShotPathSet.has(hexId) ||
    isHpMoveTarget ||
    isGKDiveTarget ||
    isShotPath ||
    highPassContestZoneSet.has(hexId));
```

If this doesn't fix it, the source is NOT `isShotPathTint` and the `console.log` approach above is needed.

Also consider clearing `shotTargetHighlight` (the never-cleared React useState) when phase changes to KICK_OFF_SETUP — it currently causes a stale red tint on the prior goal target hex indefinitely.
