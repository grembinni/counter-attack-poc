---
phase: 38-corner-kick
plan: 27
subsystem: game-engine
tags: [gameEngine, corner-kick, restart, activation-model, gap-closure]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: 38-25 (mandatory automatic clear-out) — this plan's `depends_on`, unaffected by this plan's changes
provides:
  - 'applyCornerKickReposition rewritten from an unbounded one-hex-per-click adjacency walk into a bounded, free-kick-style single-destination placement (server half of the corrected D-GAP-03 reading; client half is plan 38-29)'
  - 'cornerKickActivatedIds now applied the instant a placement completes, locking the piece for the REST of the whole reposition window — including a same-stage re-touch, which was previously exempted'
  - "cornerKickUsedPace now increments by hexDistance(from, to) instead of a flat 1, keeping applyUndo's refund arm exact for a multi-hex placement"
  - "A-GAP3-BUDGET and A-GAP3-AREA locked assumptions, restated verbatim below for plan 38-30's checkpoint"
affects: [38-29 (client-side mirror of this interaction model), 38-30 (re-verification checkpoint)]
requirements-completed: [CORNER-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'applyCornerKickReposition now structurally mirrors applyFreeKickMove: no adjacency check, single-destination-click, activation-on-completion via a persistent id list rather than a per-stage/per-window distance budget'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/shared/src/offside.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
    - packages/server/src/__tests__/cornerKick.integration.test.ts

key-decisions:
  - 'A-GAP3-BUDGET (reposition budget unchanged): CORNER_KICK_STAGES keeps its existing shape — six stages, max: 2 distinct pieces each, alternating attacking/defending — and cornerKickActivatedIds keeps locking a piece out of every LATER stage. Net effect is unchanged from what shipped: two distinct pieces per stage, six distinct pieces per side across its three stages. Only the interaction model and the activation timing change in this plan.'
  - 'A-GAP3-AREA (what "allowed area" means): mirroring applyFreeKickMove / computeFreeKickSetupValidHexes exactly — the ATTACKING side''s allowed area is every on-pitch hex not occupied by another piece (free kick imposes no further restriction on the kicking team); the DEFENDING side''s allowed area is the same set minus every hex inside isWithinCornerExclusionZone(hex, cornerKickHex) — the corner analogue of free kick''s ">2 hexes from freeKickHex" defending rule, reusing the exclusion radius this phase already enforces everywhere else rather than inventing a second radius.'
  - "PIECE_LOCKED is now a single-term guard on cornerKickActivatedIds membership — the prior two-part guard (activated AND not in this stage's placed list) is gone, since a piece is locked the instant its placement completes, even within the same stage that activated it."
  - "cornerKickUsedPace survives purely as an Undo-refund ledger (no cap of any kind); its increment changed from a flat +1 to hexDistance(from, to) so applyUndo's subtraction stays exact for a multi-hex placement."

patterns-established:
  - "38-27 pattern for future restart-reposition rewrites: when converting an adjacency-walk mechanic to a free-kick-style single-click model, the activation guard collapses to a single membership check, the stage-cap guard's re-touch exemption becomes unreachable and is deleted, and any per-move numeric ledger must switch from a flat increment to hexDistance(from, to) to stay in sync with Undo's refund arm."

# Metrics
duration: ~10min active (2 task commits 11:44-11:52); session was interrupted by a usage-limit reset between typecheck and commit of Task 1, then resumed
completed: 2026-08-09
---

# Phase 38 Plan 27: Bounded Single-Destination Corner Reposition Summary

**Rewrote `applyCornerKickReposition` from an unbounded one-hex-per-click adjacency walk into a bounded, free-kick-style single-destination placement, with `cornerKickActivatedIds` now applied the instant a placement completes (locking the piece for the rest of the whole reposition window, including same-stage re-touches) and `cornerKickUsedPace` incrementing by actual hex distance instead of a flat 1.**

## Performance

- **Duration:** ~10 min of active edit/verify/commit time across two task commits (11:44:05 and 11:52:06 local); the session was interrupted by a usage-limit reset partway through Task 1 (after the code edit, before the typecheck/commit) and resumed from the same worktree state with no rework needed.
- **Completed:** 2026-08-09
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

- Removed the `hexDistance(piece.position, to) !== 1` adjacency guard and the `NOT_ADJACENT` reason entirely from `applyCornerKickReposition` and its result union — a corner reposition is now a single destination click at any distance, exactly like `applyFreeKickMove`.
- Collapsed the `PIECE_LOCKED` guard to a single-term check on `cornerKickActivatedIds` membership — a piece is now locked the instant its placement completes, including within the same stage that activated it (previously exempted).
- Simplified the `STAGE_LIMIT_REACHED` guard: since `PIECE_LOCKED` now rejects every re-touch, the "already counted this stage" exemption is unreachable and was removed; every placement that reaches this guard is a genuinely new distinct piece for the stage.
- Changed `cornerKickUsedPace`'s increment from a flat `+1` to `hexDistance(piece.position, to)`, keeping `applyUndo`'s `hexDistance`-based refund arm exact for a multi-hex placement.
- Refreshed stale doc comments in `applyCornerKickReposition`, `applyCornerKickStageEnd` (Pitfall 4), `applyUndo`'s `CORNER_KICK_REPOSITION` refund arm, and `CORNER_KICK_STAGES`' JSDoc in `offside.ts` — all previously described the now-removed uncapped/same-stage-exempt model.
- Rewrote or deleted every engine test that depended on the removed adjacency rule or the removed same-stage re-touch exemption; added new tests for: a distant (≥5 hex) successful placement, `cornerKickUsedPace` incrementing by actual `hexDistance` rather than 1, `PIECE_LOCKED` on a same-stage re-touch, and the full A-GAP3-BUDGET scenario (six distinct pieces placed across the three attacking stages, a seventh rejected `STAGE_LIMIT_REACHED`).
- Replaced the integration test's multi-click adjacency walk with a single `GAME_MOVE` to a distant hex, asserting the piece lands there, appears in `cornerKickActivatedIds`, and that a second `GAME_MOVE` for the same piece produces a `PIECE_LOCKED` `GAME_ERROR`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite applyCornerKickReposition as bounded single-destination placement with activation on completion** - `538cbed` (feat)
2. **Task 2: Re-test the reposition window against the placement model** - `11df9a0` (test)

**Plan metadata:** committed as part of this summary's commit (docs)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - `applyCornerKickReposition` rewritten (no adjacency guard, single-term `PIECE_LOCKED`, `hexDistance`-based pace increment); `applyCornerKickStageEnd`'s Pitfall-4 comment and `applyUndo`'s `CORNER_KICK_REPOSITION` refund-arm comment refreshed
- `packages/shared/src/offside.ts` - `CORNER_KICK_STAGES`' stale Pitfall-4 divergence paragraph corrected (the free-kick `movedPieceIds` analogy now holds; no per-piece hex budget exists)
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` - `applyCornerKickReposition` describe block and the former `D-GAP-03` describe block rewritten for the placement model; new A-GAP3-BUDGET test added (6 distinct pieces across 3 stages, 7th rejected)
- `packages/server/src/__tests__/cornerKick.integration.test.ts` - multi-click-walk test replaced with a single-`GAME_MOVE`-plus-`PIECE_LOCKED` socket-level test

## Locked Assumptions (restated verbatim for plan 38-30's checkpoint)

**A-GAP3-BUDGET (reposition budget unchanged).** `CORNER_KICK_STAGES` keeps its existing shape — six stages, `max: 2` distinct pieces each, alternating attacking/defending — and `cornerKickActivatedIds` keeps locking a piece out of every LATER stage. Net effect is unchanged from what shipped: two distinct pieces per stage, six distinct pieces per side across its three stages. Only the interaction model and the activation timing change in this plan.

**A-GAP3-AREA (what "allowed area" means).** Mirroring `applyFreeKickMove` / `computeFreeKickSetupValidHexes` exactly: the ATTACKING side's allowed area is every on-pitch hex not occupied by another piece (free kick imposes no further restriction on the kicking team); the DEFENDING side's allowed area is the same set minus every hex inside `isWithinCornerExclusionZone(hex, cornerKickHex)` — the corner analogue of free kick's ">2 hexes from `freeKickHex`" defending rule, reusing the exclusion radius this phase already enforces everywhere else rather than inventing a second radius.

## Decisions Made

- Removed the adjacency guard entirely rather than widening its threshold — the plan's `<action>` was explicit that there is no distance constraint of any kind on a corner reposition destination, matching `applyFreeKickMove`'s own guard sequence (which has no adjacency check at all).
- Kept the engine's stricter any-piece occupancy rule for `INVALID_TARGET` (not `computeFreeKickSetupValidHexes`'s own-team-only filter) — this was already `applyCornerKickReposition`'s pre-existing behavior and the plan explicitly called out keeping it, since the client must mirror the engine's stricter rule in plan 38-29.
- Left `applyCornerKickFinalMove` (the separate `CORNER_KICK_FINAL_SETUP` pre-kick 3-hex window) completely untouched — it retains its own adjacency guard and its own `NOT_ADJACENT` reason, since bug 3 from `38-24-SUMMARY.md` (removing activation-marking from the pre-kick move) is a DIFFERENT, not-yet-scheduled gap-closure item, not part of this plan's scope.

## Deviations from Plan

None - plan executed exactly as written. All guard-sequence changes, the doc-comment refreshes, and the test rewrites match the plan's `<action>` blocks and acceptance criteria precisely.

## Issues Encountered

- The worktree had no `node_modules` installed (fresh worktree checkout) — ran `pnpm install` (full monorepo dependency install, ~2m 48s) before any typecheck/test/lint command would run. This is standard worktree setup, not a plan deviation.
- The `packages/shared` package had no `dist/` build output, so `@counter-attack/server`'s typecheck initially failed with `Cannot find module '@counter-attack/shared'` — ran `pnpm --filter @counter-attack/shared build` once, which resolved all downstream typecheck errors. Also standard worktree setup, not a deviation.
- The first `git commit` attempt for Task 1 hit the 2-minute Bash tool timeout while the pre-commit `lint-staged`/`eslint --fix` hook was running (likely first-run ESLint cache warmup in the fresh worktree). Verified the working tree was unaffected (`git diff --cached` still showed the full intended diff, no unstaged changes) and retried the same commit with a longer timeout, which succeeded cleanly on the second attempt. No code changes were needed; this was purely a first-run tooling warmup cost.
- Mid-session, the agent was interrupted by a usage-limit reset immediately after Task 1's code edit and typecheck announcement, before the typecheck had actually run. On resume, `git diff` confirmed the working tree matched exactly what Task 1's edits had produced (no partial/corrupted state), so the typecheck, verification, and commit proceeded without any rework.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The server-side placement model for `CORNER_KICK_REPOSITION` is complete, tested (160/160 in `gameEngine.cornerKick.test.ts`, 22/22 in `cornerKick.integration.test.ts`, 1029/1029 across the full server suite, 706/706 in the shared suite), and typechecks cleanly.
- Plan 38-29 (client mirror) can now build against this server contract: single-destination `GAME_MOVE` per piece, no adjacency requirement, `PIECE_LOCKED` on any re-touch (including same-stage), and the same `CORNER_EXCLUSION_ZONE`/`INVALID_TARGET` guards as before.
- `applyCornerKickFinalMove` (the pre-kick 3-hex window) is unaffected by this plan and still uses its own adjacency-bounded model — bug 3 from `38-24-SUMMARY.md` (removing its activation-marking) remains open for a future plan in this gap-closure round.
- Both A-GAP3-BUDGET and A-GAP3-AREA are restated above verbatim for plan 38-30's re-verification checkpoint, as required by this plan's `<verification>` section.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-09_
