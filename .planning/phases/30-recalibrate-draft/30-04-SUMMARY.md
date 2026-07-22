---
phase: 30-recalibrate-draft
plan: 04
subsystem: ui
tags: [react, typescript, css-modules, draft-tier-classification, vitest]

# Dependency graph
requires:
  - phase: 30-recalibrate-draft (Plan 01)
    provides: Narrowed DraftTier (4 values), classifyTier/computeTotalStat, DRAFT_ROUNDS/DRAFT_ROUND_COUNT, round-named DraftClientView (no keeperAutoPickedThisCycle)
provides:
  - 4-entry TIER_ORDER/TIER_CARD_CLASS (keeper dropped) in DraftPackCarousel.tsx, reused by BenchCarousel and LineupAssignmentScreen
  - D-22 corrected tier-border hex values (chase #a855f7, rare #ef4444, uncommon #22c55e, common #ffffff) with .cardTierKeeper deleted
  - Tier-bordered LineupStatCard on starting-11 lineup slots via new showTierBorder prop (D-23)
  - classifyTier-based resolveTieredCard fallback (D-05) — no more role-based 'keeper' heuristic
  - Round-aware draft progress label ("Round N of 6" / "GK Round" + per-round pick count from DRAFT_ROUNDS) replacing the hardcoded "Cycle N of 4" text (D-20)
  - Keeper-safety banner (state/effect/JSX/CSS) removed entirely (D-21)
  - Inverted Legends/Icons checkbox tests confirming the D-08 unlock (GameSettingsScreen.tsx required no code change — already data-driven off SELECTABLE_DRAFT_POOLS)
affects: [30-05-server-settings-allowlist, 30-06-client-settings-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "LineupStatCard's showTierBorder prop composes TIER_CARD_CLASS onto the existing drag/lock/confirm state class via string concatenation — tier color and interaction state are independent CSS concerns, reconciled by CSS Modules cascade order (tier classes declared after state classes in the stylesheet, so tier border wins on the shared `border` property while state-specific properties like opacity/cursor are unaffected)"
    - "resolveTieredCard's bench-card fallback is now an exact recomputation (classifyTier(computeTotalStat(player))) rather than a heuristic, since tier is a pure function of stats with no population/role context needed"

key-files:
  created: []
  modified:
    - packages/client/src/components/DraftPackCarousel.tsx
    - packages/client/src/components/DraftPackCarousel.test.tsx
    - packages/client/src/components/BenchCarousel.tsx
    - packages/client/src/components/BenchCarousel.test.tsx
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.module.css
    - packages/client/src/components/LineupAssignmentScreen.test.tsx
    - packages/client/src/components/GameSettingsScreen.test.tsx

key-decisions:
  - "D-22 tier colors implemented fresh from the plan's must_haves/UI-SPEC rather than trusting the pre-existing committed CSS values, per explicit orchestrator guidance that a stale WIP edit had existed in the working tree before this phase started and was discarded — the committed .cardTierChase/.cardTierRare/.cardTierUncommon/.cardTierCommon/.cardTierKeeper values found at start (gold/silver/bronze/blue/green) did not match D-22 at all and were fully replaced"
  - "showTierBorder is an opt-in LineupStatCard prop applied only from the draft-mode column renderer (renderDraftColumn), not the Standard-mode renderColumn — D-23's CONTEXT.md wording scopes tier color to 'everywhere a drafted card appears' (drafted cards only), so Standard-mode auto-assigned lineups are untouched by design, avoiding an out-of-scope visual change to the non-draft flow"
  - "Round-aware label format: '{roundLabel} · Pick {picksRemaining} of {roundPicks}' where roundLabel is 'GK Round' for round 1 (kind: 'gk') and 'Round {N} of {DRAFT_ROUND_COUNT}' for rounds 2-6, with roundPicks read from DRAFT_ROUNDS[round-1].picks rather than a hardcoded literal"

requirements-completed: [DRAFT-08, DRAFT-11]

# Metrics
duration: ~22min (includes one-time pnpm install + shared package build for the worktree)
completed: 2026-07-22
---

# Phase 30 Plan 04: Client Tier Colors & Draft UI Recalibration Summary

**Narrowed the client's 5-color tier system to 4 (D-22 hex values corrected fresh), extended tier-colored card borders to the starting-11 lineup slots, replaced the role-based keeper tier fallback with exact classifyTier resolution, deleted the dead keeper-safety banner, made the draft progress label round-aware, and inverted the Legends/Icons checkbox tests for the D-08 pool unlock.**

## Performance

- **Duration:** ~22 min (includes a one-time `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared run build` needed to resolve `@counter-attack/shared` in this fresh worktree)
- **Tasks:** 3/3 completed
- **Files modified:** 8

## Accomplishments

- `DraftPackCarousel.tsx`: `TIER_ORDER`/`TIER_CARD_CLASS` narrowed to 4 values (chase/rare/uncommon/common); `keeper` entry dropped entirely
- `LineupAssignmentScreen.module.css`: `.cardTierUncommon` corrected to `#22c55e` (green), `.cardTierCommon` corrected to `#ffffff` (white), `.cardTierChase`/`.cardTierRare` confirmed at `#a855f7`/`#ef4444`; `.cardTierKeeper` and `.keeperBanner` both deleted
- `LineupStatCard` (starting-11 slots) now composes a `TIER_CARD_CLASS` tier border via a new `showTierBorder` prop, applied only in draft-mode rendering — tier color now visible on draft carousel, bench, and starting-11 (D-23 fully closed)
- `resolveTieredCard`'s bench-card fallback replaced the `player.role === 'GK' ? 'keeper' : 'common'` heuristic with an exact `classifyTier(computeTotalStat(player))` recomputation (D-05/Pitfall 5)
- `showKeeperBanner` state, its `useEffect`, the JSX block, and the `.keeperBanner` CSS rule all removed (D-21) — no orphaned dead code
- Draft progress label rewritten to be round-aware: `"Round {N} of 6 · Pick {picksRemaining} of {roundPicks}"` for rounds 2-6, `"GK Round · Pick {picksRemaining} of 2"` for round 1 — pick-count denominator derived from `DRAFT_ROUNDS[round-1].picks`, not a hardcoded `4`/`2` literal (D-20)
- `GameSettingsScreen.test.tsx`: the two named Legends/Icons "disabled + (coming soon)" tests inverted to assert enabled/unlabelled/clickable, plus a third (previously unnamed in the plan) payload-shape test updated since it also encoded the pre-D-08 non-interactive assumption; `GameSettingsScreen.tsx` itself required zero code changes (already fully data-driven off `SELECTABLE_DRAFT_POOLS`, widened to 5 pools by Plan 01)
- Full verification suite green: `pnpm --filter @counter-attack/client test DraftPackCarousel BenchCarousel LineupAssignmentScreen GameSettingsScreen` — 36/36 tests passing across 4 files
- `pnpm --filter @counter-attack/client run typecheck` — 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Narrow tier classes and apply the D-22 4-color scheme** - `a2a9f0d` (feat)
2. **Task 2: LineupStatCard tier border + classifyTier fallback + round label + keeper-banner removal** - `63a0cd5` (feat)
3. **Task 3: Invert the Legends/Icons checkbox tests (D-08 unlock)** - `03c062d` (test)

## Files Created/Modified

- `packages/client/src/components/DraftPackCarousel.tsx` - 4-value `TIER_ORDER`/`TIER_CARD_CLASS` (keeper dropped)
- `packages/client/src/components/DraftPackCarousel.test.tsx` - Dropped `keeper`-tier test fixtures, replaced with valid 4-tier values
- `packages/client/src/components/BenchCarousel.tsx` - Stale "cycle 4/16 cards" doc comment updated to the 6-round/17-card model
- `packages/client/src/components/BenchCarousel.test.tsx` - Dropped role-from-tier `'keeper'` branch in the test fixture builder
- `packages/client/src/components/LineupAssignmentScreen.tsx` - `resolveTieredCard` uses `classifyTier`; `LineupStatCard` gained `showTierBorder` prop applied in draft-mode rendering; keeper-banner state/effect/JSX removed; round-aware progress label
- `packages/client/src/components/LineupAssignmentScreen.module.css` - D-22 tier-color fixes, `.cardTierKeeper` and `.keeperBanner` deleted
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` - Round-named/keeper-free `DraftClientView` fixture; keeper-banner test replaced with a D-23 tier-border assertion; round-aware label test cases added
- `packages/client/src/components/GameSettingsScreen.test.tsx` - Legends/Icons checkbox tests inverted to assert enabled/interactive state; payload-shape test updated to reflect legends/icons now being includable

## Decisions Made

- Implemented the D-22 tier-color hex values fresh from the plan's must_haves and 30-UI-SPEC.md rather than diffing against the pre-existing committed CSS, per explicit parallel-execution guidance that the committed `.cardTier*` values at worktree start (gold/silver/bronze/blue/green — a leftover from an unrelated stale edit) were not authoritative
- Scoped the new `showTierBorder` prop on `LineupStatCard` to the draft-mode column renderer only, not Standard-mode — D-23's decision text frames the requirement as "everywhere a drafted card appears," which Standard-mode auto-assigned lineups are not
- Preserved the existing `picksRemaining`-as-numerator convention in the progress label (matching the pre-phase code's exact display semantics) and only replaced the denominator/round-label portions per D-20's literal wording

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated an additional GameSettingsScreen.test.tsx payload-shape test not explicitly named in the plan**

- **Found during:** Task 3 verification (`pnpm --filter @counter-attack/client test GameSettingsScreen`)
- **Issue:** A third test, `'Draft mode: a Draft-mode confirm can never include legends or icons (non-interactive checkboxes)'`, was not one of the two tests the plan named for inversion, but it encoded the same pre-D-08 assumption (clicking Legends/Icons is a no-op) and failed once `SELECTABLE_DRAFT_POOLS` was widened by Plan 01 — the checkboxes are no longer disabled, so clicking them now toggles them, and the confirmed payload legitimately includes `'legends'`/`'icons'`.
- **Fix:** Inverted the test the same way as the two plan-named tests: renamed it to reflect the new behavior and updated the expected `onConfirm` payload to include `'legends'`/`'icons'` once checked.
- **Files modified:** `packages/client/src/components/GameSettingsScreen.test.tsx`
- **Verification:** `pnpm --filter @counter-attack/client test GameSettingsScreen` — 11/11 passing (was 10/11 failing on this one test before the fix)
- **Committed in:** `03c062d` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix — additional stale test caught by running the full test file, not just the two named tests)
**Impact on plan:** Necessary to satisfy the plan's own "GameSettingsScreen tests pass" verification command. No scope creep — same D-08 inversion pattern applied to a third test discovered during verification, not a new feature.

## Issues Encountered

- Fresh worktree had no `node_modules` and `@counter-attack/shared` had no built `dist/` output, causing `vitest`/`tsc` to fail resolving the shared package's `exports` map — resolved with `pnpm install --frozen-lockfile` (reused the local pnpm content-addressable store, zero downloads) followed by `pnpm --filter @counter-attack/shared run build`. This is expected first-time worktree setup, not a plan defect.
- `grep -ci "keeper" packages/client/src/components/LineupAssignmentScreen.tsx` (a literal acceptance-criteria check in the plan) returns 4, not 0 — all 4 matches are the pre-existing English word "goalkeeper" in two GK-slot-rule rejection messages (`'Swap rejected — only a goalkeeper card can be placed here.'` / `'Swap rejected — goalkeeper slot requires a GK card.'`), unrelated to the deleted `DraftTier` `'keeper'` value or the keeper-safety-net mechanic. Verified via targeted greps for the actual D-05/D-21 artifacts (`'keeper'` as a literal, `keeperAutoPicked`, `showKeeperBanner`, `keeperBanner`, `cardTierKeeper`) — all return 0 matches. The plan's case-insensitive grep criterion is imprecise for this file; the substantive D-05/D-21 completion signal is fully satisfied.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Client tier-color system, starting-11 tier borders, and round-aware draft UI are complete and green against Plan 01's shared contract (`DraftTier`, `classifyTier`, `computeTotalStat`, `DRAFT_ROUNDS`, `DRAFT_ROUND_COUNT`, round-named `DraftClientView`).
- `GameSettingsScreen.tsx` requires no further client-side change for DRAFT-11 — the Legends/Icons unlock is fully driven by the shared `SELECTABLE_DRAFT_POOLS` constant, which Plan 05 (server-side allow-list) and Plan 06 (if any further client settings UI work remains) can build on directly.
- This plan's scope was entirely client-package (`packages/client`) — no server (`packages/server`) or further shared-package changes were made or needed here. Full-workspace `pnpm typecheck`/build correctness across server+client depends on the server Wave 2/3 plans (30-02/30-03) landing, per this plan's own `<verification>` note.

---

_Phase: 30-recalibrate-draft_
_Completed: 2026-07-22_

## Self-Check: PASSED

All 8 created/modified source files verified present on disk; all 3 referenced
task commit hashes (a2a9f0d, 63a0cd5, 03c062d) verified present in `git log`.
