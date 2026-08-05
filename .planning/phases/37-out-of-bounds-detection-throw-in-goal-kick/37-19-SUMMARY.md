---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 19
subsystem: ui
tags: [react, svg, hex-grid, highlight-system, testing, gap-closure]

# Dependency graph
requires:
  - phase: 37-out-of-bounds-detection-throw-in-goal-kick (37-18)
    provides: goalKickTargetHex field on GameState, HeaderTargetRing gold bullseye marker, per-slice goalKickTargetHex selector in HexGrid.tsx
provides:
  - headerContestZoneSet — phase-generalised header-contest radius preview (renamed from highPassContestZoneSet) covering HIGH_PASS_MOVE and GOAL_KICK_MOVE
  - headerContestCentre — phase-branched centre derivation (ball.position for HIGH_PASS_MOVE, goalKickTargetHex for GOAL_KICK_MOVE, null otherwise)
  - First-ever regression test coverage for the HIGH_PASS_MOVE contest-zone preview, plus GOAL_KICK_MOVE positive/negative coverage and negative pins for GK_KICK_MOVE/FIRST_TIME_PASS_MOVE/GOAL_KICK_TARGET
  - HIGHLIGHT-REFERENCE.md note documenting the two-phase gate as the single source of truth for Phase 38's corner-kick contest window
affects: [phase-38-corner-kick]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Phase-branched "contest centre" ternary (headerContestCentre) feeding a single generalised Set, reused by two unchanged consumption sites — the pattern Phase 38 should extend with one more ternary arm rather than adding a parallel Set'

key-files:
  created: []
  modified:
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexGrid.test.tsx
    - docs/HIGHLIGHT-REFERENCE.md

key-decisions:
  - 'D-19-01 through D-19-06 (see PLAN.md) applied verbatim: one generalised set (not a parallel one), radius fixed at 2 (server eligibility, not a pace budget), GOAL_KICK_MOVE centres on goalKickTargetHex not ball.position, isShotPathActionTint precedence over safe accepted as intended, no isActivePlayer gate, exactly HIGH_PASS_MOVE + GOAL_KICK_MOVE qualify'
  - "Windows worktree had no node_modules at all (fresh worktree, no junction ever created) — created NTFS junctions from the worktree's node_modules (root + packages/client, /server, /shared) to the corresponding real directories in the main repo, verified each target path did not already exist before linking (zero risk of overwriting real content), and confirmed the junctions are gitignored (git status stayed clean)"

requirements-completed: [GOALKICK-05]

# Metrics
duration: ~45min
completed: 2026-08-05
---

# Phase 37 Plan 19: Generalise Header-Contest Radius to GOAL_KICK_MOVE Summary

**Renamed `highPassContestZoneSet` to phase-generalised `headerContestZoneSet` (driven by a new `headerContestCentre` ternary) so `GOAL_KICK_MOVE` gets the same white header-contest radius `HIGH_PASS_MOVE` already had, closing the last open UAT gap in Phase 37.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2/2 complete
- **Files modified:** 3 (`HexGrid.tsx`, `HexGrid.test.tsx`, `docs/HIGHLIGHT-REFERENCE.md`)

## Accomplishments

- `headerContestZoneSet` (renamed from `highPassContestZoneSet`) now renders the white, selection-independent 2-hex radius during both `HIGH_PASS_MOVE` and `GOAL_KICK_MOVE` — the two response-move windows that resolve directly into a `HEADER` contest — closing UAT test 6's gap verbatim.
- `HIGH_PASS_MOVE`'s contest-zone preview has regression test coverage for the first time ever, proven via an order-of-work pin (passed against the unmodified file, captured below) so it is a genuine before/after guarantee rather than a post-hoc rationalisation.
- `GK_KICK_MOVE` and `FIRST_TIME_PASS_MOVE` are pinned negative — neither gains the preview, since both resolve into a delivery rather than a header (D-19-06).
- `docs/HIGHLIGHT-REFERENCE.md` now states the two-phase gate, the eligibility radius, and names `headerContestZoneSet` as the source of truth, so Phase 38's corner-kick contest window starts from the real rule.

## Task Commits

1. **Task 1: Generalise the header-contest zone preview to cover GOAL_KICK_MOVE** - `df84ca0` (feat)
2. **Task 2: Record the two-phase contest-zone gate in HIGHLIGHT-REFERENCE.md and run the regression sweep** - `74a8e03` (docs)

**Plan metadata:** this SUMMARY's commit (pending, see final commit)

## Files Created/Modified

- `packages/client/src/components/HexGrid.tsx` — replaced the `highPassContestZoneSet` block (former lines 234-245) with a `headerContestCentre` ternary + `headerContestZoneSet`; renamed both consumption sites (`isShotPathActionTint`, `isShotPathTint`) to the new name with no other change
- `packages/client/src/components/HexGrid.test.tsx` — added one new import line (`PITCH_HEXES`, `hexDistance` from `@counter-attack/shared`) and appended a new describe block (`HexGrid — header-contest zone preview generalisation (GOALKICK-05, Plan 37-19)`, 8 tests) covering the HIGH_PASS_MOVE pin, GOAL_KICK_MOVE in-zone/out-of-zone/non-active-team/null-target cases, the shot-path vs. shot-path-action precedence pin, and negative pins for GK_KICK_MOVE, FIRST_TIME_PASS_MOVE and GOAL_KICK_TARGET
- `docs/HIGHLIGHT-REFERENCE.md` — one note added to section 1's Notes list (the two-phase gate) and one sentence added to section 3's `HeaderTargetRing.tsx` visibility-gate subsection (bullseye + radius are complementary)

## Decisions Made

- Followed D-19-01 through D-19-06 from PLAN.md exactly as locked (one generalised set, radius fixed at 2, `goalKickTargetHex`-centred, `isShotPathActionTint` precedence accepted, no `isActivePlayer` gate, exactly two qualifying phases).
- Created NTFS junctions (`mklink /J`) for `node_modules` at the worktree root and in `packages/client`, `packages/server`, `packages/shared`, since this fresh worktree had no `node_modules` at all (not even a broken one) and `pnpm typecheck`/`test` could not run without them. Verified each junction target path did not already exist in the worktree before linking — this is a purely additive operation with zero risk of deleting or overwriting real shared package content (the exact risk flagged in the project's "Worktree Junction Risk" memory note). Confirmed post-creation that `git status` stayed clean (junctions are gitignored, not tracked).

## Deviations from Plan

None — plan executed exactly as written. All six locked decisions (D-19-01 through D-19-06) were applied verbatim; the tint priority ternary was not touched, matching D-19-01's requirement that the generalisation stay invisible downstream of the set.

One environment-setup deviation was required and is documented above (Rule 3 — blocking issue): the worktree had no `node_modules`, which is not itself a plan concern but was necessary to run any verification command. No package was installed; only junctions to already-installed directories in the main repo were created.

## Verification Data (per plan `<output>` requirements)

**The `headerContestCentre` declaration, verbatim** (`packages/client/src/components/HexGrid.tsx`):

```ts
const headerContestCentre: HexCoord | null =
  phase === 'HIGH_PASS_MOVE'
    ? ball.position
    : phase === 'GOAL_KICK_MOVE'
      ? (goalKickTargetHex ?? null)
      : null;
```

Confirms D-19-03: the `GOAL_KICK_MOVE` arm reads `goalKickTargetHex`, not `ball.position`.

**Order-of-work proof** (the HIGH_PASS_MOVE pinning test run against the unmodified `HexGrid.tsx`, before any Task 1 source edit):

`HexGrid.tsx` was reverted to its pre-Task-1 committed state via `git checkout -- packages/client/src/components/HexGrid.tsx` (`highPassContestZoneSet` confirmed present, `headerContestZoneSet` absent), then:

```
pnpm --filter @counter-attack/client test -- HexGrid -t "HIGH_PASS_MOVE regression pin"

 ✓ src/components/HexGrid.test.tsx (69 tests | 68 skipped) 154ms

 Test Files  1 passed (1)
      Tests  1 passed | 68 skipped (69)
```

The pin passed against the unmodified file — a true before/after regression guarantee. The Task 1 source changes were then restored from a scratchpad backup taken immediately after writing them, and the full suite was re-confirmed green (69/69) before proceeding.

**Red-first proof** (the `GOAL_KICK_MOVE` arm of `headerContestCentre` temporarily forced to `null`):

```
pnpm --filter @counter-attack/client test -- HexGrid

 ❯ src/components/HexGrid.test.tsx (69 tests | 3 failed) 5045ms
   × ... GOAL_KICK_MOVE: target hex and a hex 2 away carry shot-path; a hex 3 away carries neither
     → expected false to be true
   × ... GOAL_KICK_MOVE: the same preview renders for the non-active team, unselected (D-19-05)
     → expected false to be true
   × ... GOAL_KICK_MOVE: an in-zone hex also present in validMoveHexes renders shot-path-action ... (D-19-04)
     → expected false to be true

 Test Files  1 failed (1)
      Tests  3 failed | 66 passed (69)
```

Exactly the three `GOAL_KICK_MOVE` in-zone cases failed; the HIGH_PASS_MOVE pin and all negative cases (GK_KICK_MOVE, FIRST_TIME_PASS_MOVE, GOAL_KICK_TARGET, null-target) stayed green. The arm was restored and the suite re-ran green (69/69, exit 0). `git diff -U0 packages/client/src/components/HexGrid.tsx` after restoring showed only the intended Task 1 diff — no residual red-first artifact.

**Task 1 acceptance-criteria grep counts** (all against `grep -v '^\s*[*/]' packages/client/src/components/HexGrid.tsx`):

| Grep target                                | Count | Expected           |
| ------------------------------------------ | ----- | ------------------ |
| `highPassContestZoneSet`                   | 0     | 0                  |
| `headerContestZoneSet`                     | 4     | 4                  |
| `hexDistance(h, headerContestCentre) <= 2` | 1     | 1                  |
| `headerContestCentre`                      | 3     | ≥3                 |
| `goalKickTargetHex`                        | 4     | 3 (see note below) |

**Note on the `goalKickTargetHex` count (4 vs. the criterion's expected 3):** the 4th occurrence is inside a pre-existing multi-line JSX comment from Plan 37-18 (`{/* ... the same hex (goalKickTargetHex === ball.position during GOAL_KICK_MOVE) ... */}`, `HexGrid.tsx` line 994). The comment's continuation line does not start with `*` or `/` after leading whitespace, so the acceptance criterion's `grep -v '^\s*[*/]'` filter (designed for `//`- and `/* */`-prefixed lines) does not exclude it — a pre-existing gap in the filter's heuristic for multi-line JSX comments, not something introduced by this plan. Manually verified: there is exactly one `useGameStore` selector for `goalKickTargetHex` (line 142, from 37-18, untouched) and exactly two consumers — the new `headerContestCentre` arm (line 254) and the pre-existing `HeaderTargetRing` prop (line 996). No duplicate selector was added. This is the same category of false-premise acceptance criterion documented in 37-18's SUMMARY (the `CLIP_Y`/`CLIP_H` skip) — recorded here as a documented, verified skip rather than silently ignored.

**`git diff -U0` on both touched files, zero deletions:**

- `packages/client/src/components/HexGrid.test.tsx`: `git diff --stat` → `1 file changed, 257 insertions(+)`; `git diff -U0 | grep -c '^-[^-]'` → `0`.
- `docs/HIGHLIGHT-REFERENCE.md`: two hunks, both pure insertions (`+1` line at section 1's Notes list, `+6` lines at section 3's `HeaderTargetRing.tsx` subsection) — confirmed both before and after the commit-hook `prettier --write` pass.

**`pnpm --filter @counter-attack/client typecheck`:** exits 0, no errors.

**Radius parity across all three surfaces (all `<= 2`):**

- `packages/client/src/components/HexGrid.tsx` line 259: `hexDistance(h, headerContestCentre) <= 2`
- `packages/server/src/gameEngine.ts` lines 3997-4001 (`applyGoalKickMoveEnd`'s `homeEligible`/`awayEligible`): `hexDistance(p.position, targetHex) <= 2`
- `docs/HIGHLIGHT-REFERENCE.md` section 1 Notes: "The radius is 2 hexes and mirrors the server's header-eligibility predicate in `applyGoalKickMoveEnd`"

All three agree: **2 = 2 = 2.**

**`docs/HIGHLIGHT-REFERENCE.md` diff line ranges and section boundaries:**

- Hunk 1: 1 line inserted after original line 64 (end of section 1's bulleted Notes list, which spans lines 58-64 originally; section 1 as a whole spans lines 39-67). Falls entirely inside section 1's Notes.
- Hunk 2: 6 lines inserted after original line 194 (inside section 3's `HeaderTargetRing.tsx visibility gate` subsection, which spans lines 180-197; section 3 as a whole spans lines 124-197). Falls entirely inside that subsection.
- No changes anywhere in section 1's table, section 2, or the "Adding a New Highlight" checklist.

**Before/after client test totals:**

- Before Task 1 (baseline, `HexGrid.test.tsx` alone): 61 tests passing.
- After Task 1: `HexGrid.test.tsx` has 69 tests (+8), all passing.
- Full client suite before Task 1 (computed as post-Task-1 total minus the +8 delta, since the full suite was only run after Task 1's edits landed): 632 tests.
- Full client suite after Task 1 and Task 2 (doc-only, no test count change): **29 test files passed, 640 tests passed, 0 failed.**

**Server and shared regression totals (neither package modified — pure regression):**

- `pnpm --filter @counter-attack/server test`: 36 test files, **799 passed, 1 skipped, 1 todo** (801 total) — exit 0.
- `pnpm --filter @counter-attack/shared test`: 14 test files, **650 passed** — exit 0.

**Lint:** `pnpm lint` (root) shows 7 pre-existing parser-config errors (`projectService.maximumDefaultProjectFileMatchCount` threshold) confined entirely to `packages/shared/src/*.test.ts` files — identical to the pre-existing condition documented in 37-18's SUMMARY. `packages/shared` was not touched by this plan (`git status --short packages/shared` shows no changes). Zero lint errors in any file this plan touched (`HexGrid.tsx`, `HexGrid.test.tsx`, `docs/HIGHLIGHT-REFERENCE.md`).

**Post-commit re-check** (per Task 2's warning that the commit hook runs `prettier --write`): re-ran both doc grep criteria after the Task 2 commit — `grep -c 'headerContestZoneSet' docs/HIGHLIGHT-REFERENCE.md` → 2, `grep -cE 'HIGH_PASS_MOVE.*GOAL_KICK_MOVE|GOAL_KICK_MOVE.*HIGH_PASS_MOVE' docs/HIGHLIGHT-REFERENCE.md` → 1. Both still hold; `git diff` between the pre-commit working tree and the committed state showed only prettier's own line-wrapping, no content change.

## Issues Encountered

- The worktree (`agent-a954e83417c11db4c`) had no `node_modules` directory anywhere — not at the root, nor in `packages/client`/`server`/`shared` — so `pnpm typecheck`/`test` failed immediately with `tsc: not recognized`. Resolved by creating NTFS junctions (`mklink /J`) from each missing `node_modules` path to the corresponding real directory in the main repo (`D:\dev\repo\counter-attack-poc\...\node_modules`), after first confirming each target path did not already exist in the worktree (eliminating any risk of the junction workaround silently deleting real shared content, per the project's "Worktree Junction Risk" memory note). `git status` remained clean after creation, confirming the junctions are correctly gitignored and not tracked.
- One acceptance-criterion grep count (`goalKickTargetHex` returns 4, not the expected exactly-3) is a false premise caused by a pre-existing multi-line JSX comment from Plan 37-18 that the grep filter's heuristic doesn't exclude — documented above with manual verification that no duplicate selector exists.
- A TypeScript compile error surfaced during the first typecheck pass: `playerSlot: 0` is not assignable to `1 | 2 | null | undefined` (the store's slot type uses `2` for "away", not `0`). Fixed immediately (Rule 1 — bug in the newly-written test, not the plan's source code) by changing the non-active-team test to `playerSlot: 2`.

## Next Phase Readiness

- `headerContestZoneSet` and its `headerContestCentre` ternary are a complete, tested, reusable pattern. Phase 38's corner-kick contest window (also "both teams move one player into a contest") should add one more ternary arm to `headerContestCentre` rather than introducing a parallel set — this is the explicit reuse path the plan's objective called out.
- Deferred follow-up (per plan's "Deliberately NOT done" section, carried forward, not fixed in this plan): consolidate the radius literal `2` into a shared constant across `packages/shared` — it is currently written three times (twice in `gameEngine.ts`, once in `HexGrid.tsx`). A genuine improvement, but out of scope for this client-only minor UAT gap-closure plan.
- No blockers. GOALKICK-05 is fully closed; Phase 37's UAT test 6 gap (the only remaining open item in Phase 37) is resolved.

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Completed: 2026-08-05_

## Self-Check: PASSED

- FOUND: `.planning/phases/37-out-of-bounds-detection-throw-in-goal-kick/37-19-SUMMARY.md`
- FOUND: commit `df84ca0` (Task 1)
- FOUND: commit `74a8e03` (Task 2)
