---
created: 2026-08-09T00:00:00.000Z
title: 'Bug — offside rings still rendered after a goal resets positions for kick-off'
area: rendering
resolves_phase: null
files:
  - packages/client/src/components/HexGrid.tsx
  - packages/client/src/components/PieceOverlay.tsx
  - packages/client/src/store/useGameStore.ts
  - packages/server/src/gameEngine.ts
---

## Problem

After a goal is scored and player positions are reset for kick-off, players still show offside
rings when they should be reset.

**Verbatim report (human two-browser verifier):** "after goal is scored and player positions are
reset for kick off players still showed offsides rings when they should be reset"

Observation context: found during Phase 38 UAT, plan 38-30's step 9 ("Visual check and replay"),
by the human two-browser verifier. See `.planning/phases/38-corner-kick/38-30-SUMMARY.md` Bug 1
and `.planning/phases/38-corner-kick/deferred-items.md`'s "From Plan 38-32" section for the full
triage record — this todo and those two documents are cross-referenced and neither should be
findable without the other.

## What We Know

1. **The rendering path is `HexGrid.tsx`'s `isOffside` prop.** `isOffside={(offsidePieceIds ??
[]).includes(piece.id)}` feeds `PieceOverlay`'s independent red-ring layer, reading
   `gameState.offsidePieceIds` straight from the server broadcast. There is no client-side offside
   derivation that could go stale on its own.
2. **Both live goal paths in `applyRoll`'s SHOT branch already clear the field.** The
   GK-out-of-range GOAL branch and the duel GOAL branch (`gameEngine.ts` lines 2687 and 2782) both
   set `offsidePieceIds: []` on the `KICK_OFF_SETUP` transition, each carrying the `BUG-06 / D-47`
   comment.
3. **Both reset paths are covered by passing regression tests.** The
   `BUG-06: offsidePieceIds reset on GOAL restart path (applyRoll SHOT branch)` describe block in
   `packages/server/src/__tests__/offside.test.ts` (line 1535), and the `D-47: both-ready
transition resets offsidePieceIds to []` test in
   `packages/server/src/__tests__/kickoffSetup.integration.test.ts` (line 446).
4. **There is no third goal path that could bypass the reset.** `grep -n "state.score\["
packages/server/src/gameEngine.ts` returns exactly the two live scoring sites already covered
   above — no additional live scoring path exists.
5. **Replay cannot resurrect a stale live value either.** `buildReplayFrames`' seed object
   (`gameEngine.ts` line 7014 onward) does not include `offsidePieceIds` at all, so replay frames
   carry `undefined` and can never render an offside ring; and the client's `setGameState` replaces
   `gameState` wholesale rather than merging, so a replay frame cannot resurrect a stale live value
   either.
6. **Conclusion from static analysis:** the root cause is NOT in the goal-to-kickoff reset code
   path as first assumed, and it is NOT in any file touched by Phase 38 plans 38-25 through 38-29
   (`applyCornerKickReposition`, `applyAutomaticCornerClearOut`, `offside.ts`'s
   `CORNER_KICK_STAGES` docs, `ActionLog.tsx`, `useGameStore.ts`, `HexGrid.tsx`'s corner arms,
   `CornerKickSetupPanel.tsx`, `EventBanner.tsx`). No Phase 38 plan touches the offside lifecycle
   at all.

## Leading Hypothesis

This defect has the same signature as the long-pending BUG-23 todo
(`.planning/todos/pending/2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`)
— server provably nulls/clears the field, yet the client renders it for the entire
`KICK_OFF_SETUP` phase. BUG-23 has been carried unresolved across four milestone closes. This is a
**hypothesis, not a conclusion**: treat a shared root cause as the leading lead for the next
investigation, but confirm it against fresh repro data before assuming it.

## Repro Data Needed

The next session must capture:

- Which action scored the goal — regular shot, snapshot, or header-at-goal.
- Whether the observation was live (during play) or during replay.
- Whether the rings clear after the first kickoff move, or persist into MOVE.
- A devtools read of `useGameStore.getState().gameState.offsidePieceIds` at the moment the rings
  are visible on screen — confirms whether the server broadcast itself is non-empty (server bug)
  or the array is empty and the client is rendering stale rings anyway (client bug, matching the
  BUG-23 signature).
