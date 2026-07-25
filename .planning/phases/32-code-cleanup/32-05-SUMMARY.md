---
phase: 32-code-cleanup
plan: 05
subsystem: ui
tags: [zustand, react, client-state, refactor, code-review]

# Dependency graph
requires:
  - phase: 32-code-cleanup (Plan 32-04)
    provides: deriveMyTeam/useMyTeam consolidation used throughout useGameStore.ts's phase branches
provides:
  - Standalone SELECTOR-REVIEW.md cataloging every derived-and-stored field and setGameState gate boolean in useGameStore.ts, every verdict resolved
  - Four new internal store helpers (computeKickOffSetupValidHexes, computeFreeKickSetupValidHexes, computeFreeMoveValidHexes) and four named ResponseMoveValidHexConfig constants consolidating validMoveHexes recompute logic
  - Fix for a real staleness bug where KICK_OFF_SETUP/FREE_KICK_SETUP highlights silently collapsed to [] on any same-phase broadcast
affects: [client-store, hex-highlighting, kick-off-setup, free-kick-setup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared pure recompute helpers (computeKickOffSetupValidHexes/computeFreeKickSetupValidHexes/computeFreeMoveValidHexes) called from both selectPiece and setGameState's sticky-selection block, eliminating hand-rolled duplicate derivations"
    - 'Named module-scope ResponseMoveValidHexConfig constants (HIGH_PASS_MOVE_CONFIG etc.) replacing inline per-call-site config object literals'

key-files:
  created:
    - .planning/phases/32-code-cleanup/SELECTOR-REVIEW.md
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts

key-decisions:
  - 'The setGameState hand-rolled dependency gate (5 boolean terms) was reviewed and found to have zero redundant/removable terms — each guards a genuinely distinct trigger with existing BUG-09 regression coverage; verdict keep-irreducible for all five.'
  - 'validPassTargetHexes/interceptionRiskHexes have a single computation source and no sticky-recompute path (PASS-type selection is an explicit per-action choice, not sticky-across-broadcasts like validMoveHexes) — verdict keep-irreducible.'
  - 'The KICK_OFF_SETUP/FREE_KICK_SETUP sticky-highlight bug found during review was fixed in this same cleanup phase (not deferred to a future Bug Fixes phase) because it was implementable as a low-risk extraction of already-tested logic into shared helpers, backed by new regression tests, following the exact precedent of commit 7950a18 (SNAPSHOT_DEFLECT sticky-recompute gap closure).'

requirements-completed: [CLEANUP-03]

# Metrics
duration: ~35min
completed: 2026-07-25
---

# Phase 32 Plan 05: Zustand Selector Review Summary

**Authored SELECTOR-REVIEW.md cataloging useGameStore.ts's derived-state surface, then fixed a real KICK_OFF_SETUP/FREE_KICK_SETUP stale-highlight bug plus two duplicated-logic findings the review surfaced, all as behavior-preserving-or-bug-fixing refactors backed by 4 new regression tests.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-24T23:55:00Z (approx.)
- **Completed:** 2026-07-25T00:32:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created: SELECTOR-REVIEW.md; 2 modified: useGameStore.ts, useGameStore.test.ts)

## Accomplishments

- Cataloged all 4 derived-and-stored hex fields (`validMoveHexes`, `tackleRiskHexes`, `validPassTargetHexes`, `interceptionRiskHexes`) and all 5 `setGameState` gate booleans (`responseMoveStateChanged`, `responseMovePaceExhausted`, `phaseChanged`, `pieceStillExists`, `activationComplete`) with line-numbered recompute-site inventories and resolved verdicts
- Confirmed component-level Zustand selectors are already clean (zero whole-store subscriptions found) — no invented findings
- Found and fixed a genuine, currently-shipping staleness bug: `setGameState`'s sticky-selection block had no dedicated branch for KICK_OFF_SETUP or FREE_KICK_SETUP, so a same-phase broadcast (e.g. the opponent repositioning any piece) silently collapsed `validMoveHexes` to `[]` even while a piece stayed selected
- Consolidated two further duplication findings: the HIGH_PASS_MOVE/GK_KICK_MOVE/FIRST_TIME_PASS_MOVE sticky block's hand-rolled inline recompute (now calls the existing `computeResponseMoveValidHexes` helper via named configs), and FREE_MOVE_ATTACK/DEFENSE's byte-for-byte duplicated filter (now a shared helper)
- Every `fix`-verdict row in SELECTOR-REVIEW.md is marked APPLIED — zero rows left unresolved (D-06 fixed end-state, not a findings backlog)

## Task Commits

Each task was committed atomically:

1. **Task 1: Author SELECTOR-REVIEW.md cataloging every selector / derived-state field in useGameStore.ts** - `d55e74b` (docs)
2. **Task 2: Apply every "fix" verdict from the review to useGameStore.ts (D-06)** - `72b72d3` (fix)

_No plan-metadata commit required — worktree mode excludes STATE.md/ROADMAP.md updates (orchestrator owns those after wave merge)._

## Files Created/Modified

- `.planning/phases/32-code-cleanup/SELECTOR-REVIEW.md` - Standalone selector/derived-state review: catalog tables for the 4 stored hex fields and 5 gate booleans, component-selector confirmation section, and an "Applied Fixes" resolution section documenting all 3 fixes
- `packages/client/src/store/useGameStore.ts` - Added `computeKickOffSetupValidHexes`, `computeFreeKickSetupValidHexes`, `computeFreeMoveValidHexes` internal helpers and `HIGH_PASS_MOVE_CONFIG`/`GK_KICK_MOVE_CONFIG`/`FIRST_TIME_PASS_MOVE_CONFIG`/`SNAPSHOT_DEFLECT_CONFIG` named constants; refactored `selectPiece`'s KICK_OFF_SETUP/FREE_KICK_SETUP/HIGH_PASS_MOVE/FIRST_TIME_PASS_MOVE/GK_KICK_MOVE/SNAPSHOT_DEFLECT/FREE_MOVE branches to call the shared helpers/configs; added two new `setGameState` sticky branches (KICK_OFF_SETUP, FREE_KICK_SETUP) and consolidated the existing HIGH_PASS_MOVE/GK_KICK_MOVE/FIRST_TIME_PASS_MOVE and FREE_MOVE sticky blocks to reuse the shared helpers instead of duplicating logic inline
- `packages/client/src/store/useGameStore.test.ts` - Added 4 regression tests: 2 for `setGameState` sticky-selection during KICK_OFF_SETUP (stays highlighted across a broadcast; clears when the piece is removed) and 2 for FREE_KICK_SETUP (stays highlighted across a same-stage broadcast; clears when the active stage hands off to the other team)

## Decisions Made

- No `fix`-verdict row was downgraded to `keep — irreducible`. All three problems the review found were implementable as behavior-preserving-or-bug-fixing refactors with adequate safety nets (existing test coverage for the two consolidation-only fixes; new regression tests written alongside the bug fix), so the plan's escape-hatch clause ("if riskier than behavior-preserving, downgrade rather than ship") was not invoked.
- The `setGameState` gate-boolean review (5 terms) found zero redundancy — documented explicitly with reasoning per term rather than silently passing over it, satisfying the plan's requirement that irreducible items be a recorded decision, not an oversight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] KICK_OFF_SETUP/FREE_KICK_SETUP `validMoveHexes` silently collapses to `[]` on same-phase broadcast**

- **Found during:** Task 1 (SELECTOR-REVIEW.md authoring — line-numbered recompute-site inventory for `validMoveHexes`)
- **Issue:** `setGameState`'s sticky-selection block (the logic that decides whether to keep the current selection's highlight across a server broadcast) had dedicated branches for HIGH_PASS_MOVE/GK_KICK_MOVE/FIRST_TIME_PASS_MOVE, SNAPSHOT_DEFLECT, and FREE_MOVE_ATTACK/DEFENSE, but not for KICK_OFF_SETUP or FREE_KICK_SETUP. Both phases instead fell through to the generic MOVEMENT-phase recompute path, which calls `validateMove` — whose first guard rejects every candidate because `movementSlot` is `null` throughout both phases (it's a MOVEMENT-only field). The practical effect: if a player selects a piece during KICK_OFF_SETUP or FREE_KICK_SETUP and the opponent does anything (a normal, expected concurrent action during these phases), the server broadcast reaches the first player's client and their zone/stage highlight silently vanishes, even though nothing about their own valid destinations changed.
- **Fix:** Extracted the KICK_OFF_SETUP zone rule and the FREE_KICK_SETUP stage/team-gated rule (previously inline only in `selectPiece`) into two new shared pure helpers, `computeKickOffSetupValidHexes` and `computeFreeKickSetupValidHexes` (the latter returns `null` when the current selection is no longer valid for the broadcast state, e.g. the active stage handed off to the other team, so the caller clears selection exactly as `selectPiece`'s original guard cascade would). Wired both helpers into `selectPiece` (behavior-identical refactor) and added two new dedicated `setGameState` sticky branches that call them on every same-phase broadcast, following the exact precedent already established in this file by commit `7950a18` ("add SNAPSHOT_DEFLECT recompute path to setGameState sticky-selection").
- **Files modified:** `packages/client/src/store/useGameStore.ts`, `packages/client/src/store/useGameStore.test.ts`
- **Verification:** 4 new regression tests added (`useGameStore.test.ts`) covering both phases' "stays highlighted across a same-phase broadcast" case, plus FREE_KICK_SETUP's "clears on stage hand-off" case and KICK_OFF_SETUP's defense-in-depth "clears if piece removed" case. All 391 client tests green, `pnpm --filter @counter-attack/client typecheck` clean, `pnpm knip` clean.
- **Committed in:** `72b72d3` (Task 2)

**2. [Rule 1 - Bug/Refactor] `HIGH_PASS_MOVE`/`GK_KICK_MOVE`/`FIRST_TIME_PASS_MOVE` sticky block reimplemented `computeResponseMoveValidHexes` inline instead of calling it**

- **Found during:** Task 1 (SELECTOR-REVIEW.md authoring)
- **Issue:** `selectPiece`'s three branches for these phases call the shared `computeResponseMoveValidHexes` helper via inline config object literals, but `setGameState`'s sticky block for the same three phases reimplemented the `strict-1`-mode subset of that logic by hand via a 3-way nested ternary — two independent implementations of the same rule that could silently drift if one changed without the other.
- **Fix:** Hoisted the per-phase config object literals (previously repeated at each `selectPiece` branch and the SNAPSHOT_DEFLECT sticky block) into four named module-scope constants (`HIGH_PASS_MOVE_CONFIG`, `GK_KICK_MOVE_CONFIG`, `FIRST_TIME_PASS_MOVE_CONFIG`, `SNAPSHOT_DEFLECT_CONFIG`). `setGameState`'s sticky block now derives `paceRemaining`/`lockedId` from the matching config and calls `computeResponseMoveValidHexes` directly, deleting the hand-rolled ternary + inline filter — exactly mirroring the pattern the SNAPSHOT_DEFLECT sticky block already used.
- **Files modified:** `packages/client/src/store/useGameStore.ts`
- **Verification:** Zero behavior change for these three phases — `useGameStore.test.ts` BUG-09 tests 1-5 (slot hand-off / pace-exhaustion clearing + regression guard) pass unmodified.
- **Committed in:** `72b72d3` (Task 2)

**3. [Rule 1 - Refactor] FREE_MOVE_ATTACK/DEFENSE valid-hex filter duplicated verbatim between `selectPiece` and `setGameState`'s sticky block**

- **Found during:** Task 1 (SELECTOR-REVIEW.md authoring)
- **Issue:** Byte-for-byte identical filter logic (`hexesInRange` + `PITCH_HEXES` membership + occupancy + `hexDistance === 1`) existed at two call sites, differing only in the pace-budget lookup expression.
- **Fix:** Extracted the shared filter into `computeFreeMoveValidHexes(id, piece, gameState)`; both call sites now call it.
- **Files modified:** `packages/client/src/store/useGameStore.ts`
- **Verification:** Zero behavior change — the existing FREE_MOVE_ATTACK/DEFENSE sticky-selection test suite passes unmodified.
- **Committed in:** `72b72d3` (Task 2)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — one genuine bug fix, two pure-duplication consolidations, all within CLEANUP-03's explicit review scope for `validMoveHexes`'s recompute-and-store surface)
**Impact on plan:** All three fixes are within the plan's named review target (the `setGameState` dependency-gate/recompute bookkeeping for the four derived hex fields). No scope creep — the KICK_OFF_SETUP/FREE_KICK_SETUP fix specifically was evaluated against the plan's own downgrade-to-irreducible escape hatch and judged safe to fix in-phase because it reuses already-tested logic and ships with new regression coverage, following an established in-file precedent (commit `7950a18`).

## Issues Encountered

None beyond the findings documented above as deviations. `pnpm lint` (repo-wide) reports a pre-existing, out-of-scope `packages/shared` config error (`Too many files (>8) have matched the default project`) already logged in `deferred-items.md` from Plan 32-01 — confirmed unrelated to this plan's files via a targeted `eslint` run on both modified files, which is clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

CLEANUP-03 is fully satisfied: SELECTOR-REVIEW.md exists with every verdict resolved, and every `fix` verdict is applied and marked APPLIED in the review doc itself (D-06 fixed end-state). `useGameStore.ts`'s derived-state bookkeeping is now free of the duplicate/stale recompute paths the review targeted. No blockers for the remaining Phase 32 plan (32-06, CLEANUP-04 React Hook lint rollout) — this plan made no changes to hook usage or `useEffect` call sites.

---

_Phase: 32-code-cleanup_
_Completed: 2026-07-25_

## Self-Check: PASSED

- FOUND: `.planning/phases/32-code-cleanup/SELECTOR-REVIEW.md`
- FOUND: `.planning/phases/32-code-cleanup/32-05-SUMMARY.md`
- FOUND: `packages/client/src/store/useGameStore.ts`
- FOUND commit: `d55e74b` (Task 1)
- FOUND commit: `72b72d3` (Task 2)
- FOUND commit: `b387b3f` (SUMMARY.md)
