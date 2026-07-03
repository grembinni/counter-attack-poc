---
created: 2026-06-21T18:14:38.000Z
title: Bug - GK_KICK ball delivery invisible during post-game replay (REPLAY-06 gap)
area: replay
resolves_phase: 25
files:
  - packages/server/src/gameEngine.ts
  - packages/server/src/gameHandlers.ts
  - packages/shared/src/types.ts
---

## Problem

Phase 18.1 (replay-review) fixed two REPLAY-06 root causes (`HEADED_PASS`/`GK_PUNT` missing from
`REPLAY_ELIGIBLE_TYPES`, and a stale `MOVE.ballAfter` on contested steal/tackle pickups) but missed
a third instance of the same defect class: `GK_KICK`.

Code review (18.1-REVIEW.md, CR-01) found that the new `REPLAY_ELIGIBLE_TYPES` comment in
`gameEngine.ts:3986-3992` incorrectly claims `GK_KICK` is "dead code, zero construction sites." This
is factually wrong — `GK_KICK` is constructed at `gameHandlers.ts:828-836` as part of the live GK
long-kick-to-target flow (`GK_KICK_TARGET` → `GK_KICK_MOVE`, wired client-side via
`gkKickTargetSet`/`emitGKKickTarget` in `HexGrid.tsx`). The kick delivers the ball to a new
position/carrier exactly like `HEADED_PASS`/`GK_PUNT`, but:

1. `GK_KICK`'s type definition (`packages/shared/src/types.ts:280-288`) has no `ballAfter` field.
2. `GK_KICK` is excluded from `REPLAY_ELIGIBLE_TYPES`.

As a result, a GK long kick produces zero replay frames — the ball appears to teleport during
post-game replay, the exact symptom REPLAY-06 was meant to eliminate.

A related, lower-severity, pre-existing gap was also flagged (WR-01): `LOOSE_BALL_LAND` has the
same missing-`ballAfter`/not-in-`REPLAY_ELIGIBLE_TYPES` issue.

The incorrect "dead code" premise originated in `18.1-RESEARCH.md` (Pitfall 5) and propagated into
`18.1-01-PLAN.md`'s explicit instruction to exclude `GK_KICK`. User decision (2026-06-21, during
`/gsd-execute-phase 18.1`): continue phase 18.1 as planned and track this as a separate backlog
item rather than expanding 18.1's scope or routing it to 18.2 (DESIGN-04 is unrelated).

## Solution

TBD — needs:

1. Add `ballAfter: { position: HexCoord; carrierId: string | null }` to the `GK_KICK` event type
   in `packages/shared/src/types.ts`.
2. Populate it at both `gameHandlers.ts:828` construction sites (accurate/inaccurate branches) with
   the resolved ball position/carrier.
3. Add `'GK_KICK'` to `REPLAY_ELIGIBLE_TYPES` in `gameEngine.ts`, with a corrected comment (split
   per-type rationale per IN-01 in 18.1-REVIEW.md so the GK_KICK inclusion doesn't get bundled with
   the HEADER exclusion rationale again).
4. Consider fixing `LOOSE_BALL_LAND` (WR-01) in the same pass since it's the identical defect class.
5. Add regression test coverage mirroring `replay.integration.test.ts`'s existing
   `HEADED_PASS`/`GK_PUNT` visibility cases.

See `.planning/phases/18.1-replay-review/18.1-REVIEW.md` (CR-01, WR-01) for full detail.
