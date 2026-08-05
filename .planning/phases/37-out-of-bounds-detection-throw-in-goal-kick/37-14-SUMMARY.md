---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 14
subsystem: rules-engine
tags: [hex-grid, pitch-boundary, out-of-bounds, gap-closure]

# Dependency graph
requires:
  - phase: 37-out-of-bounds-detection-throw-in-goal-kick (plan 13)
    provides: isPitchHex bounds guard on applyGoalKickReposition
provides:
  - PITCH_HEXES narrowed by 19 hexes (962 -> 943): even-q r=0 hexes excluded
  - classifyExit's row test made parity-aware for the r=0 edge
affects: [38-corner-kick, 37-16 (sibling plan, client-only, no file overlap)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      'Rules-layer-only fix for a rendering defect — narrow the domain model instead of touching the renderer',
    ]

key-files:
  created: []
  modified:
    - packages/shared/src/pitch.ts
    - packages/shared/src/pitch.test.ts
    - packages/shared/src/outOfBounds.ts
    - packages/shared/src/outOfBounds.test.ts
    - packages/server/src/__tests__/gameEngine.outOfBounds.test.ts

key-decisions:
  - "User rejected the plan's Option A and Option B during checkpoint clarification; final approved instruction: 'Do not change anything about how the field currently renders — just remove 0% visibility hexes from the field of play.'"
  - "Only the 19 even-q r=0 hexes are excluded from PITCH_HEXES — no r=25 exclusion (this is the key difference from the plan's Option B, which would have also dropped odd-q r=25)"
  - "classifyExit's rOut check is additive (isPitchHex failure while q is in-range), not a replacement for the existing rectangle test; qOut is still checked first"

patterns-established: []

requirements-completed: [OOB-02, OOB-04, THROWIN-02]

# Metrics
duration: ~25min
completed: 2026-08-05
---

# Phase 37 Plan 14: Even-Q r=0 Pitch-Hex Exclusion (Scope-Reduced) Summary

**Excluded the 19 even-q `r=0` hexes (e.g. `(20,0)`) from `PITCH_HEXES`/`classifyExit` in the shared rules package only — zero client/rendering files touched, per the user's explicit scope reduction during the Task 1 checkpoint.**

## Scope Reduction (Task 1 resolution — recorded verbatim)

The plan file's Task 1 (`checkpoint:decision`) offered two options:

- **Option A** — keep the full 962-hex rectangle, fix client rendering so all hexes are visible.
- **Option B** — narrow the pitch to 925 hexes (drop even-q `r=0` AND odd-q `r=25`), fix client rendering, symmetric exclusion at both edges.

The user rejected **both** after several rounds of clarification. Their final, explicit, approved instruction was:

> "Do not change anything about how the field currently renders — just remove 0% visibility hexes from the field of play."

This is a materially smaller change than either plan option: no client/rendering files (`hexToPixel.ts`, `HexGrid.tsx`, `PitchMarkings.tsx`, their tests) were touched. The plan's `PITCH_CLIP` constant, clip-rect re-anchoring, and pitch-outline geometry rework (Tasks 2/3 as originally written) were **not implemented**. The pitch renders pixel-for-pixel identically to before this plan.

Instead, the fix is entirely in the shared rules layer: under the plan's own geometry table (used only as reference, not implemented), exactly the even-q `r=0` hexes — 19 hexes total, `q = 0,2,4,...,36` — render at 0% visibility (entirely clipped, invisible, unclickable) under the _current, unmodified_ client clip. No other hex renders at 0%: odd-q `r=0` and odd-q `r=25` render at ~50% ("partial", explicitly fine per the user, not touched), and even-q `r=25` already renders at 100%. Those 19 hexes are removed from the rules layer so no restart or move can ever target a hex the player can neither see nor click — without needing to fix rendering at all.

## Performance

- **Duration:** ~25 min (includes a ~5.5 min `pnpm install --frozen-lockfile` for a bare worktree with no `node_modules`)
- **Tasks:** 2 code changes (Task 1 was decision-only, Task 4 was automated-verification-only per the redefined scope)
- **Files modified:** 5 (2 shared source, 2 shared test, 1 server test — collateral)

## Accomplishments

- `packages/shared/src/pitch.ts`: `PITCH_HEXES` builder now skips a hex when `r === 0 && q % 2 === 0`, removing exactly 19 hexes (962 → 943). Module doc comment updated to record the new count, the 37-14 decision, and that no `r=25` hex is excluded.
- `packages/shared/src/outOfBounds.ts`: `classifyExit`'s `rOut` check is now parity-aware — additive to the existing `hex.r < 0 || hex.r > MAX_R` rectangle test via `(!qOut && !isPitchHex(hex))`, not a replacement. `qOut` is still evaluated/short-circuited first, preserving the D-05 corner-defaults-to-BYLINE rule untouched. `isPitchHex` was already imported in this module (from the goal-kick-reposition-bounds-guard work in plan 37-13's sibling changes) — no new import needed.
- Test coverage added for both the "removed" hex (20,0) and the three "kept, unchanged" reference hexes (21,0), (20,25), (21,25) in both `pitch.test.ts` (`isPitchHex`) and `outOfBounds.test.ts` (`classifyExit`).

## isPitchHex Usage Verification (required by the redefined scope)

Grepped `isPitchHex` usage across `packages/server/src/gameEngine.ts` and `gameHandlers.ts` to confirm restart/movement paths route through it, so the newly-excluded hexes can never be targeted:

**Confirmed safe (routes through `isPitchHex`/`PITCH_HEXES`):**

- **LOOSE_BALL scatter clamp** (`gameEngine.ts:3083`) — the clamp walk only advances `clampedPos` when `isPitchHex(next)` is true; a step landing on an excluded hex now correctly refuses to advance, and the ball stays at the last real in-bounds hex instead.
- **Throw-in placement** — `resolveThrowInHex` (shared package) filters `hexesInRange(...)` candidates through `isPitchHex` internally; its `preferred` input is always the `lastInBoundsHex` from the (now-corrected) LOOSE_BALL clamp, which is itself guaranteed on-pitch. `applyThrowInPlace` (`gameEngine.ts:3336`) places the piece at the server-computed `state.throwInHex`, never a client-provided coordinate — no attack surface here.
- **Goal-kick reposition** — `applyGoalKickReposition` (`gameEngine.ts:3502`) has an explicit `if (!isPitchHex(to)) return { ok: false, reason: 'MOVE_INVALID', detail: 'OFF_PITCH' }` guard (added in plan 37-13), so a client-submitted goal-kick reposition target can never land on an excluded hex.

**Follow-up finding, NOT fixed in this plan (out of scope per the redefined instructions — flagged rather than silently expanding scope):**

- **Regular Movement Phase** (`validateMove` in `packages/shared/src/moveValidator.ts`) has **no `isPitchHex`/`OFF_PITCH` check at all** — it validates adjacency (`hexDistance === 1`), occupancy, and pace, but never bounds-checks the destination hex against the pitch grid.
- **`applyFreeMove`** (`gameEngine.ts:512`, the MOVE-06 zone-triggered free-move mechanic) has the identical gap — adjacency/occupancy/budget checks only, no `isPitchHex` guard.
- This is a **pre-existing gap, not introduced by this plan**: before this change, every hex within the `q∈[0,36], r∈[0,25]` rectangle (including the now-excluded `r=0` hexes) was a valid `PITCH_HEXES` member, so the missing check was latent but not exploitable for _this specific_ boundary. After this change, a piece already on the pitch near an excluded hex could theoretically be moved onto it via a hand-crafted `game:move` payload during regular MOVEMENT or a FREE_MOVE window, since neither path rejects an off-`PITCH_HEXES` target. This mirrors the exact defect class closed for goal-kick reposition in plan 37-13 (`OFF_PITCH`/`isPitchHex` guard). Recommended as a follow-up gap-closure item — not addressed here per the explicit instruction to flag rather than expand this plan's scope.

## Task Commits

Each code change was committed atomically (Task 1 was decision-only, Task 4 was automated-verification-only — neither produced a commit):

1. **Task 2 (redefined): exclude even-q r=0 hexes from the rules layer** — `eefc690` (fix)
2. **Task 3 (redefined): test coverage + fix collateral test breaks** — `146e86d` (test)

## Files Created/Modified

- `packages/shared/src/pitch.ts` — `PITCH_HEXES` builder skips `r===0 && q%2===0`; module doc comment records the 943-hex total and the 37-14 decision.
- `packages/shared/src/pitch.test.ts` — hex-count assertion `962` → `943`; new describe block for the 4 reference hexes; 5 pre-existing assertions that coincidentally used `(0,0)`/`(36,0)` as q-boundary examples swapped to `(0,1)`/`(36,1)` (same coverage, unaffected by the r=0 change).
- `packages/shared/src/outOfBounds.ts` — `classifyExit`'s `rOut` gains the `(!qOut && !isPitchHex(hex))` term; JSDoc updated.
- `packages/shared/src/outOfBounds.test.ts` — new describe block asserting `classifyExit` returns `'SIDELINE'` for (20,0) and `null` for (21,0)/(20,25)/(21,25).
- `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts` — 2 pre-existing OOB-05 toggle-off tests scattered the ball onto `(18,0)`, now excluded; the clamp correctly refuses to land there and the ball stays at its starting hex `(18,1)`. Assertions updated to match.

## Decisions Made

See "Scope Reduction" above — the single governing decision of this plan is the user's redefinition of Task 1, recorded verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing shared-package test assertions broken by the narrowing (collateral, `pitch.test.ts`)**

- **Found during:** Task 3 (test run after the rule change)
- **Issue:** 5 pre-existing assertions in `pitch.test.ts` (`isInRegion` homeThird/awayThird, `computeBallZone` home/away, `isPitchHex` valid-hex check) coincidentally used `(0,0)` or `(36,0)` as q-boundary example coordinates — both are now-excluded even-q r=0 hexes, so they started failing.
- **Fix:** Swapped the r-coordinate from `0` to `1` in each (e.g. `(0,0)` → `(0,1)`), preserving the test's actual intent (proving the q-boundary, not the r-boundary) while avoiding the newly-excluded row.
- **Files modified:** `packages/shared/src/pitch.test.ts`
- **Verification:** `pnpm --filter @counter-attack/shared test` — 643/643 pass.
- **Committed in:** `146e86d` (Task 3 commit)

**2. [Rule 1 - Bug] Pre-existing server test assertions broken by the narrowing (collateral, `gameEngine.outOfBounds.test.ts`)**

- **Found during:** Task 3 (server test run, required by success criteria)
- **Issue:** Two OOB-05 (toggle-off) LOOSE_BALL clamp tests scattered the ball from `(18,1)` toward `(18,0)`, asserting it lands at `(18,0)`. That hex is now excluded from `PITCH_HEXES`, so the clamp correctly refuses to advance onto it and the ball stays at `(18,1)` instead — the _safer_, corrected behavior the whole plan exists to produce.
- **Fix:** Updated both assertions from `{q:18,r:0}` to `{q:18,r:1}`, with a comment explaining the corrected clamp behavior.
- **Files modified:** `packages/server/src/__tests__/gameEngine.outOfBounds.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test` — 785 pass, 1 skipped, 1 todo (unchanged totals from the pre-task baseline; two assertions corrected, no tests added/removed).
- **Committed in:** `146e86d` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — pre-existing tests genuinely contradicted by the intentional, user-approved narrowing)
**Impact on plan:** Both fixes are direct, expected consequences of narrowing `PITCH_HEXES` by 19 hexes. No scope creep — no source-code behavior beyond the two files touched in the Task 2 commit was changed.

## Issues Encountered

- The worktree had no `node_modules` (fresh worktree checkout). Ran `pnpm install --frozen-lockfile` (~5.5 min, lockfile unchanged, 543 packages resolved from the existing store) before any test could run.
- `packages/shared` ships a compiled `dist/` that `packages/server`'s Vitest/Vite resolution depends on (`main`/`exports` point at `./dist/index.js`) — `packages/shared` node_modules were present but `dist/` was stale/missing, causing `Failed to resolve entry for package "@counter-attack/shared"` across all 35 server test files. Ran `pnpm --filter @counter-attack/shared build` (`tsc`) before the server test suite; all 35 files then resolved and ran normally.

## User Setup Required

None — no external service configuration required.

## Task 4 (redefined): Automated Verification Results

The plan's Task 4 was a `checkpoint:human-verify` gated on visually inspecting the repaired pitch clip in a live browser. Since nothing changed visually (per the redefined scope, zero client/rendering files were touched), that checkpoint's premise no longer applies. Per the redefined-scope instructions, this was replaced with automated verification, run and confirmed here:

- (a) `isPitchHex({q:20,r:0})` and its 18 siblings are excluded — confirmed via `pitch.test.ts`'s new describe block (`packages/shared/src/pitch.test.ts`), and `PITCH_HEXES` length assertion is `943` (was `962`).
- (b) The odd-q `r=0` row and both `r=25` rows are unaffected — confirmed via the same describe block: `isPitchHex({q:21,r:0})`, `isPitchHex({q:20,r:25})`, `isPitchHex({q:21,r:25})` are all `true`.
- (c) `pnpm --filter @counter-attack/server test` passes with zero failures — confirmed: **785 passed, 1 skipped, 1 todo** (787 total, matching the pre-task baseline recorded in `.planning/PROJECT.md`: "server 785 (1 skipped, 1 todo)"). This proves no downstream rule (offside, ZoI, loose-ball clamping, goal-kick, throw-in) regressed from narrowing `PITCH_HEXES`.
- `pnpm --filter @counter-attack/shared test` also passes: **643 passed** (was 635 at Phase 37 close; +8 from the two new describe blocks in `pitch.test.ts` and `outOfBounds.test.ts`).
- `pnpm --filter @counter-attack/shared typecheck` and `pnpm --filter @counter-attack/server typecheck` both exit 0.

All of that passing satisfies the checkpoint's substance without a live browser session, per the redefined-scope instructions. No live-verify checkpoint is being returned — this SUMMARY documents the automated verification in its place, and this result is reported to the orchestrator via the structured completion state rather than presenting a human-verify prompt.

## Next Phase Readiness

- The narrow shared-package fix is self-contained and has zero file overlap with sibling plan `37-16` (client-only), which runs in the same wave.
- **Follow-up recommended for a future gap-closure plan:** `validateMove` (regular MOVEMENT) and `applyFreeMove` (MOVE-06 free-move) have no `isPitchHex`/`OFF_PITCH` guard at all — see "isPitchHex Usage Verification" above. This mirrors the exact defect class closed for goal-kick reposition in plan 37-13, and is now a live (if narrow) exposure given the newly-excluded hexes. Not addressed in this plan per its reduced scope.
- The plan's original client-rendering fix (`PITCH_CLIP`, clip-rect re-anchoring, pitch-outline geometry) remains entirely undone — the pitch still visually clips even-q `r=0` hexes to 0% and odd-q `r=0`/`r=25` to ~50%. Those hexes are simply no longer part of the playable rules model, so the visual clipping is no longer a correctness bug, only a residual cosmetic one. If a future phase wants the _visible_ pitch outline to match the _rules_ pitch shape more precisely (e.g. drawing a boundary that excludes the invisible row entirely, or extending the clip to show the full rectangle), that remains open and unaddressed.

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Completed: 2026-08-05_
