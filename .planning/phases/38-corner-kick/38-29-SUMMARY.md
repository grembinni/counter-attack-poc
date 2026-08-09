---
phase: 38-corner-kick
plan: 29
subsystem: ui
tags: [zustand, react, hex-grid, corner-kick, restart, activation-model, gap-closure]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: 38-27 (server-side applyCornerKickReposition rewritten to bounded single-destination placement, activation-on-completion, hexDistance-based pace ledger)
provides:
  - "computeCornerRepositionValidHexes — a PITCH_HEXES-filtered bounded-area destination helper (modelled on computeFreeKickSetupValidHexes, with a stricter any-piece occupancy exclusion mirroring applyCornerKickReposition's INVALID_TARGET guard), shared by selectPiece's CORNER_KICK_REPOSITION branch and setGameState's sticky-selection arm"
  - 'CORNER_KICK_REPOSITION single-term activation lock (cornerKickActivatedIds membership, no same-stage exemption) applied identically in useGameStore.ts (selectability/destinations) and HexGrid.tsx (canSelectCornerKickReposition/isSpentNow rendering)'
  - "CORNER_KICK_FINAL_SETUP's isSpentNow arm is now the literal false — the pre-kick 3-hex window never renders the activated marker at any pace value; cornerKickMovedPieceId's separate one-player-per-team slot lock is untouched"
  - "CornerKickSetupPanel reposition-window copy rewritten: remaining counted by activation (not a spent pace ledger), cap read from stage.max, exclusion radius interpolated from CORNER_EXCLUSION_RADIUS, no more 'unlimited distance' claim"
affects: [38-30 (re-verification checkpoint for this gap-closure round)]
requirements-completed: [CORNER-03, CORNER-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client mirrors of a server-rewritten restart-reposition destination set are extracted into a single shared helper (computeCornerRepositionValidHexes) placed next to the existing computeFreeKickSetupValidHexes model it's based on, consumed by both selectPiece and setGameState's sticky-selection block — prevents the two call sites drifting apart, the exact defect class this plan closes."
    - "An activation-marker arm in isSpentNow that must show 'never' is written as the literal `false` with an explicit comment naming what NOT to restore, rather than deleted — keeps the phase's presence in the ternary chain discoverable and blocks a future editor from silently reintroducing the removed marker via the chain's default fallthrough."

key-files:
  created: []
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.test.tsx
    - packages/client/src/components/CornerKickSetupPanel.tsx
    - packages/client/src/components/CornerKickSetupPanel.test.tsx

key-decisions:
  - 'computeCornerRepositionValidHexes deliberately diverges from computeFreeKickSetupValidHexes with an ANY-piece occupancy exclusion (not own-team-only) — applyCornerKickReposition (gameEngine.ts, plan 38-27) rejects any occupied destination with INVALID_TARGET regardless of which team occupies it; a comment in the helper states this divergence explicitly.'
  - "The activation lock collapsed from a two-term guard (activated AND not-placed-this-stage) to a single cornerKickActivatedIds membership check, in both useGameStore.ts and HexGrid.tsx, matching plan 38-27's server-side collapse exactly — a piece is locked the instant its placement completes, with no same-stage exemption."
  - "isSpentNow's CORNER_KICK_FINAL_SETUP arm changed from `piece.id === cornerKickMovedPieceId` to the literal `false`, kept present (not deleted) with a comment naming the two things a future editor must not do: restore the cornerKickMovedPieceId test, or let the arm fall through to the chain's movedPieceIds.includes default. cornerKickMovedPieceId itself is untouched and still drives canSelectCornerKickFinal's CORNER-06 one-player-per-team slot lock — a different concept from the activation marker."
  - "CornerKickSetupPanel's remaining computation simplified to: 0 when the stage is full (stagePlaced.length >= stage.max), otherwise the count of eligibleIds not in activatedIds — replacing the old two-branch activatedEarlierStage/stagePlaced filter."

patterns-established:
  - '38-29 pattern for future restart-panel copy fixes: when a numeric constraint (radius, cap) is stated in player-facing copy, interpolate the shared constant directly (CORNER_EXCLUSION_RADIUS, stage.max) rather than restating a literal — a test then asserts the interpolated value renders, so copy can never silently drift from the enforced rule.'

# Metrics
duration: ~15min active (pnpm install ~2m37s one-time worktree setup + 3 task commits 12:12-12:19)
completed: 2026-08-09
---

# Phase 38 Plan 29: Client Mirror of Bounded Corner Reposition Summary

**Rewrote the client's CORNER_KICK_REPOSITION/CORNER_KICK_FINAL_SETUP interaction model to match plan 38-27's server rewrite exactly: a bounded single-destination placement area (not six adjacent hexes), an activation marker applied the instant a placement completes with no same-stage exemption, no activation marker at all during the pre-kick 3-hex window, and panel copy that reads the reposition cap and exclusion radius from shared constants instead of a stale "unlimited distance" claim.**

## Performance

- **Duration:** ~15 min total, including a one-time `pnpm install` (~2m 37s, fresh worktree checkout) and `pnpm --filter @counter-attack/shared build` (needed for the client's typecheck to resolve `@counter-attack/shared`). Three task commits across 12:12–12:19 local.
- **Completed:** 2026-08-09
- **Tasks:** 3/3
- **Files modified:** 6

## Accomplishments

- Added `computeCornerRepositionValidHexes`, a `PITCH_HEXES`-filtered bounded-area destination helper modelled on `computeFreeKickSetupValidHexes`, placed directly beside it. Both `selectPiece`'s `CORNER_KICK_REPOSITION` branch and `setGameState`'s sticky-selection arm now call this single helper instead of the six-hex-adjacency `computeFreeMoveValidHexes`.
- Collapsed the activation guard from a two-term "activated in an earlier stage but not this one" check to a single `cornerKickActivatedIds` membership test (`cornerKickActivated`), in lockstep across `useGameStore.ts` (`selectPiece`, `setGameState`) and `HexGrid.tsx` (`canSelectCornerKickReposition`, `isSpentNow`) — a piece now renders the orange-ring-+-red-X `activated` state the instant its placement lands, including within the same stage.
- Changed `HexGrid.tsx`'s `isSpentNow` `CORNER_KICK_FINAL_SETUP` arm from `piece.id === cornerKickMovedPieceId` to the literal `false`, with a comment explaining why it must stay `false` and not fall through to the chain's default — the pre-kick 3-hex window now shows no activation marker at any pace value, while `cornerKickMovedPieceId`'s separate CORNER-06 one-player-per-team slot lock (`canSelectCornerKickFinal`) is untouched.
- Rewrote `CornerKickSetupPanel.tsx`'s `CORNER_KICK_REPOSITION` branch: `remaining` is now `0` once the stage is full, otherwise the count of eligible pieces not yet activated; row 1 reads the cap from `stage.max` instead of a literal `2`; row 2 states the bounded-placement rule in plain language, interpolating `CORNER_EXCLUSION_RADIUS` for the defending side; the word "unlimited" no longer appears anywhere in the panel.
- Rewrote/added tests across all three files: `useGameStore.test.ts` (far-hex reachability, any-piece occupancy exclusion, no same-stage exemption, sticky-selection parity), `HexGrid.test.tsx` (activated rendering on same-stage placement, never-activated during `CORNER_KICK_FINAL_SETUP` at pace 1 and pace 3, slot lock survives), `CornerKickSetupPanel.test.tsx` (row 1/row 2 copy, exclusion-radius interpolation, remaining reaching 0 at stage-full).

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace the adjacency destination set with the bounded placement area in the store** - `909f28f` (feat)
2. **Task 2: Correct activation rendering — apply it on placement in the reposition window, remove it entirely from the pre-kick window** - `a557a3d` (feat)
3. **Task 3: Update the corner reposition panel copy and its remaining-count arithmetic** - `6a31ea2` (feat)

**Plan metadata:** committed as part of this summary's commit (docs)

## Files Created/Modified

- `packages/client/src/store/useGameStore.ts` - `computeCornerRepositionValidHexes` added next to `computeFreeKickSetupValidHexes`; `selectPiece`'s `CORNER_KICK_REPOSITION` branch and `setGameState`'s sticky-selection arm both call it; the two-term `activatedEarlierStage` guard is gone from both sites
- `packages/client/src/store/useGameStore.test.ts` - new tests for far-hex reachability (`hexDistance >= 5`), any-piece occupancy exclusion, no same-stage activation exemption; existing exclusion-zone and sticky-selection tests updated to the new empty-on-activation behaviour
- `packages/client/src/components/HexGrid.tsx` - `cornerKickActivatedEarlierStage`/`cornerKickPlacedThisStage` locals replaced with `cornerKickActivated`; `canSelectCornerKickReposition`'s stage-full escape hatch simplified; `isSpentNow`'s `CORNER_KICK_REPOSITION` arm uses `cornerKickActivated`; its `CORNER_KICK_FINAL_SETUP` arm is the literal `false`
- `packages/client/src/components/HexGrid.test.tsx` - reposition activation tests updated (same-stage placement now renders `activated`); new `CORNER_KICK_FINAL_SETUP` tests asserting no activation marker at pace 1 and pace 3, plus the existing slot-lock test retained and a new explicit slot-lock assertion added
- `packages/client/src/components/CornerKickSetupPanel.tsx` - `CORNER_EXCLUSION_RADIUS` imported from `@counter-attack/shared`; `remaining` computation simplified; both `constraintRow` strings for the reposition branch rewritten; `CORNER_KICK_FINAL_SETUP` branch left untouched
- `packages/client/src/components/CornerKickSetupPanel.test.tsx` - "unlimited distance" assertions replaced with row 1/row 2 copy assertions, a defending-side exclusion-radius interpolation test, and a stage-full-yields-zero-remaining test

## Decisions Made

- Deliberately diverged `computeCornerRepositionValidHexes` from `computeFreeKickSetupValidHexes` with an any-piece (not own-team-only) occupancy exclusion, matching `applyCornerKickReposition`'s stricter `INVALID_TARGET` guard from plan 38-27 — documented inline in the helper's JSDoc so the divergence stays discoverable rather than looking like an oversight.
- Kept `isSpentNow`'s `CORNER_KICK_FINAL_SETUP` arm present as the literal `false` rather than deleting it — falling through to the chain's default (`movedPieceIds.includes(piece.id)`) would reintroduce an unrelated marker for a piece that moved earlier in MOVEMENT this half; the comment explicitly warns a future editor not to "restore" the `cornerKickMovedPieceId` test.
- Left `cornerKickMovedPieceId` fully intact everywhere else (store's `CORNER_KICK_FINAL_SETUP` lock, `HexGrid.tsx`'s `canSelectCornerKickFinal`, the panel's `remaining` computation for that branch) — it is CORNER-06's one-player-per-team slot lock, a different concept from the activation marker this plan removes from that phase.
- Simplified `CornerKickSetupPanel`'s `remaining` to a two-branch expression (`stageFull ? 0 : ...`) rather than a per-id filter with an inline `activatedEarlierStage` sub-expression, matching the simplification already applied to the store and `HexGrid.tsx`'s guards.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' `<action>` blocks, acceptance criteria, and verification commands were followed precisely; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

- Fresh worktree checkout had no `node_modules` and no `packages/shared` build output — ran `pnpm install` (~2m 37s) and `pnpm --filter @counter-attack/shared build` once before any test/typecheck command would resolve `@counter-attack/shared`. Standard worktree setup, not a plan deviation (same pattern noted in 38-27-SUMMARY.md).
- Whole-workspace `pnpm lint` fails with a pre-existing `packages/shared` typescript-eslint "too many files matched the default project" parsing error, unrelated to any file this plan touched (documented in STATE.md as known tech debt since Phase 32, doesn't gate CI). Verified this plan's actual acceptance criterion instead: `npx eslint` scoped to the six files this plan modified reports zero errors/warnings, and `pnpm --filter @counter-attack/client typecheck` exits 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Client and server now agree exactly on `CORNER_KICK_REPOSITION`'s destination set (bounded on-pitch area minus any-piece occupancy minus, for the defending side, the corner exclusion zone) and on when a piece is locked (the instant its placement completes, no same-stage exemption).
- The pre-kick `CORNER_KICK_FINAL_SETUP` window no longer shows any activation marker, closing 38-24-SUMMARY.md bug 3, while its CORNER-06 one-player-per-team slot lock (`cornerKickMovedPieceId`) is unaffected and still enforced.
- The panel's reposition-window copy no longer promises "unlimited distance" and its remaining-count/cap/exclusion-radius all read from shared constants (`stage.max`, `CORNER_EXCLUSION_RADIUS`) rather than restated literals.
- Full client test suite (772 tests across 30 files) passes; `useGameStore` (96 tests), `HexGrid` (89 tests), and `CornerKickSetupPanel` (47 tests) each pass in full with the new/updated assertions from this plan.
- Ready for plan 38-30's re-verification checkpoint for this gap-closure round.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-09_
