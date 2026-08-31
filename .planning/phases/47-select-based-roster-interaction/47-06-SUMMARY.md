---
phase: 47-select-based-roster-interaction
plan: 06
subsystem: ui
tags: [knip, stylelint, static-analysis, css-modules, docs, vitest, click-select]

# Dependency graph
requires:
  - phase: 47-04
    provides: "LineupAssignmentScreen.test.tsx fully rewritten to click simulation, 107/107 green — primary behavioural evidence source for this plan's Task 3 criterion mapping"
  - phase: 47-05
    provides: "GameBoard.test.tsx + CardInjuryBadge.crossSurface.test.tsx converted to click simulation — closes the collateral-test gap this plan's full-suite gate depends on"
provides:
  - "docs/HIGHLIGHT-REFERENCE.md Section 4 (Card Selection) documenting .statCardSelected/.statCardEligible, value-matched to PieceOverlay.tsx's ACTIVE_RING_STROKE/selectable ring stroke"
  - "A clean pnpm knip run (zero output, knip.json unchanged) proving ROSTER-06's zero-dead-code requirement"
  - "Confirmed-by-inspection ROSTER-05 structural separation: 5 eligibility functions + 9 click handlers, none taking a mode/subMode/draftMode parameter"
  - "Whole-workspace green gate: typecheck, lint, full test suite (server 70/70 files/1635 tests, client 40/40 files/1287 tests), stylelint, and client build all exit 0"
  - "Every ROADMAP Phase 47 success criterion (1-7) mapped to named test/command evidence"
affects: ["Phase 51 (Rules-Fidelity Gap Analysis) — this SUMMARY is the closing evidence record for the milestone's first phase"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS Module orphan sweep: knip does not analyse .module.css files, so a manual cross-reference of every declared class name against styles.<name> usage across all consuming .tsx files is required as a separate verification step whenever a component's markup changes"
    - "Case-insensitive 'drag' grep as a zero-residue gate: doc comments referencing a retired interaction model (drag source/drop target, draggable, dragStart) must be reworded (e.g. 'pointer-carry') rather than left as historical references, since the gate greps the substring literally, not just live code"

key-files:
  created: []
  modified:
    - docs/HIGHLIGHT-REFERENCE.md
    - packages/client/src/components/LineupAssignmentScreen.module.css
    - packages/client/src/components/BenchCarousel.tsx
    - packages/client/src/components/DraftPackCarousel.tsx

key-decisions:
  - "Worktree had no node_modules installed at plan start (all 4 workspace packages) — ran `pnpm install --frozen-lockfile` directly in the worktree root before any gate could run. This creates a worktree-local node_modules from the shared pnpm content-addressable store; it does not touch or junction the main repo's node_modules, so it carries none of the Windows-junction risk documented in project memory for prior worktree agents."
  - "Removed the pre-existing orphaned `.benchPlaceholders` CSS rule (dead since commit d7de3523, long before Phase 47) during the Task 2 manual sweep — technically pre-existing tech debt outside this phase's own diff, but Task 2's own acceptance criteria ('every CSS class declared in LineupAssignmentScreen.module.css has at least one styles.<name> reference') is a hard, literal requirement that does not carve out pre-existing orphans, so it was removed rather than left failing the check."
  - "Reworded 5 'drag'-containing doc comments each in BenchCarousel.tsx and DraftPackCarousel.tsx (drag source/drop target, draggable gate, dragStart signal, drag/scroll local-state note) to 'pointer-carry'/'retired ... gate' phrasing — comment-only, zero behavior change, required because Task 3's own acceptance criteria greps all four production files case-insensitively for the literal substring 'drag' and these historical references (correctly documenting what used to be there) still matched."

requirements-completed: [ROSTER-05, ROSTER-06]

# Metrics
duration: ~35min
completed: 2026-08-30
---

# Phase 47 Plan 06: Phase-Close Verification (knip, Structural Separation, Highlight Docs, Full Green Gate) Summary

**Closed Phase 47 with a clean `pnpm knip` run (zero dead code, `knip.json` untouched), a confirmed-by-inspection four/five-way structurally-separate eligibility model, a new `docs/HIGHLIGHT-REFERENCE.md` Card Selection section, and a fully green workspace (typecheck/lint/1635+1287 tests/stylelint/build) — plus removal of one pre-existing orphaned CSS rule and five historical drag-era doc-comment references that the phase's own zero-residue gates required cleaning up.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 completed
- **Files modified:** 4

## Accomplishments

- Added `docs/HIGHLIGHT-REFERENCE.md` Section 4 "Card Selection (`LineupAssignmentScreen.module.css`)" documenting `.statCardSelected`/`.statCardEligible` as value-matched (not object-identity-shared) to `PieceOverlay.tsx`'s `ACTIVE_RING_STROKE`/`selectable` ring stroke; renumbered the old Section 4 (Valid-Move Tint Consistency) to Section 5; widened the Overview scope sentence to name `HeaderTargetRing.tsx` and `LineupAssignmentScreen.module.css`; added a Traffic-Light Semantic Legend cross-reference note
- `pnpm knip` exits 0 with zero output (`knip.json` byte-identical, confirmed via `git diff --exit-code`) — ROSTER-06's zero-dead-code requirement is proven
- Manual CSS-Modules orphan sweep (knip does not analyse `.module.css`) found and removed one dead rule, `.benchPlaceholders` — orphaned since a pre-Phase-47 commit (`d7de3523`), unrelated to this phase's drag removal but caught by this task's own "every declared class is referenced" acceptance criterion
- Confirmed by inspection: `isRepositionSelectable`, `isRepositionEligible`, `isSubstituteEligible`, `isPregameSwapEligible`, `isDraftSlotEligible`/`isDraftBenchAreaEligible` are 6 structurally separate top-level functions; `handleRepositionCardClick`, `handleSubstitutePitchClick`, `handleSubstituteBenchClick`, `handlePregameCardClick`, `handleDraftPackCardClick`, `handleDraftSlotClick`, `handleDraftBenchCardClick`, `handleDraftBenchAreaClick` are 8 independent click handlers — none takes a `mode`/`subMode`/`draftMode` parameter; every `subMode` read in `LineupAssignmentScreen.tsx` is a guard-entry comparison or the one explicitly-sanctioned JSX dispatch ternary (`subMode === 'reposition' ? handleRepositionCardClick(...) : handleSubstitutePitchClick(...)`), never a function parameter
- Full workspace green gate: `pnpm typecheck` (3/3 packages), `pnpm lint` (eslint, 0 errors), `pnpm test` (shared 18/18 files·908 tests, server 70/70 files·1635 tests via `--pool=forks` after hitting the documented Windows tinypool worker-crash flake on the first `pnpm -r test` pass, client 40/40 files·1287 tests), `pnpm stylelint` (clean), `pnpm --filter @counter-attack/client build` (built in ~1.8s) — all exit 0
- Reworded 10 total case-insensitive `drag` matches (5 in `BenchCarousel.tsx`, 5 in `DraftPackCarousel.tsx`) from historical drag-era phrasing to "pointer-carry"/"retired ... gate" language, satisfying the Task 3 acceptance criterion that `grep -ci 'drag'` returns 0 across all four production files (`LineupAssignmentScreen.tsx`, `BenchCarousel.tsx`, `DraftPackCarousel.tsx`, `LineupAssignmentScreen.module.css`)
- `pnpm install --frozen-lockfile` run once at plan start — the worktree had no `node_modules` at any workspace level; installed cleanly into the worktree's own `node_modules` from the shared pnpm store without touching the main repo

## Task Commits

1. **Task 1: Document the card-selection tokens in HIGHLIGHT-REFERENCE.md** — `1a12afd0` (docs)
2. **Task 2: Prove zero dead code and the four-way eligibility separation** — `4f818ec8` (fix — removed orphaned CSS rule found during the sweep)
3. **Task 3: Full workspace green gate** — `efff9933` (docs — drag-era comment cleanup required by the gate's own acceptance criteria)

_Note: no plan-metadata commit in this response — worktree mode excludes STATE.md/ROADMAP.md updates; the orchestrator handles those centrally after merge. SUMMARY.md is committed separately per the worktree-mode git_commit_metadata step._

## Files Created/Modified

- `docs/HIGHLIGHT-REFERENCE.md` — new Section 4 (Card Selection), renumbered old Section 4 to 5, widened Overview scope sentence, added legend cross-reference note
- `packages/client/src/components/LineupAssignmentScreen.module.css` — removed the orphaned `.benchPlaceholders` rule (pre-existing dead code, caught by this task's manual CSS sweep)
- `packages/client/src/components/BenchCarousel.tsx` — reworded 5 historical "drag" doc-comment references to pointer-carry/retired-gate phrasing (comment-only, no behavior change)
- `packages/client/src/components/DraftPackCarousel.tsx` — reworded 5 historical "drag" doc-comment references to pointer-carry/retired-gate phrasing (comment-only, no behavior change)

## Decisions Made

See frontmatter `key-decisions` for the `pnpm install` rationale, the `.benchPlaceholders` removal rationale, and the drag-comment rewording rationale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing workspace dependencies**
- **Found during:** Task 1 (first commit attempt failed — husky pre-commit hook's `lint-staged` binary was not found)
- **Issue:** The worktree had no `node_modules` at the root or in any of the 4 workspace packages — none of this plan's gates (`knip`, `stylelint`, `typecheck`, `lint`, `test`, `build`) could run without dependencies installed. This is not a package-legitimacy concern (Rule 3's install exclusion) — it is the standard lockfile-pinned workspace install every other wave already assumes ran.
- **Fix:** Ran `pnpm install --frozen-lockfile` once at the worktree root. Installed cleanly (543 packages, 2m30s) from the shared pnpm content-addressable store into a worktree-local `node_modules` — did not create a junction to or modify the main repo's `node_modules` in any way (verified: `git status --short` showed zero unexpected changes immediately after install).
- **Files modified:** none (node_modules is gitignored; no tracked files changed)
- **Commit:** N/A (dependency install, not a tracked change)

**2. [Rule 1 - Bug] Removed pre-existing orphaned `.benchPlaceholders` CSS rule**
- **Found during:** Task 2 (manual CSS-Modules class-reference sweep)
- **Issue:** `.benchPlaceholders` was declared in `LineupAssignmentScreen.module.css` but referenced by zero `.tsx` files (`git log -S` traced its last use to commit `d7de3523`, "wire real bench data into the pregame Step 3 lineup screen" — a pre-Phase-47 commit that replaced the placeholder divs with a real `BenchCarousel`). Task 2's own acceptance criterion ("every CSS class declared in `LineupAssignmentScreen.module.css` has at least one `styles.<name>` reference across the three component files") does not carve out pre-existing orphans.
- **Fix:** Deleted the 4-line dead rule.
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.module.css`
- **Verification:** `pnpm stylelint` re-run clean after removal; manual sweep re-confirmed every remaining declared class has at least one `styles.<name>` reference.
- **Committed in:** `4f818ec8`

**3. [Rule 1/3 - Bug/Blocking] Reworded 10 historical "drag" doc-comment references**
- **Found during:** Task 3 (`grep -ci 'drag'` acceptance-criteria check across all four production files)
- **Issue:** `BenchCarousel.tsx` and `DraftPackCarousel.tsx` each had 5 case-insensitive matches for "drag" — all inside doc comments correctly describing the *retired* native HTML5 drag-and-drop model this phase replaced (e.g. "converted from a native HTML5 drag source + drop target", "the old `draggable` gate", "the old drag-start signal", a `D-19/Pitfall 7` scroll-state comment). Historically accurate, but the plan's own hard acceptance criterion requires the literal grep to return 0 for every one of the four named files, with no carve-out for historical-reference comments.
- **Fix:** Reworded every match to "pointer-carry"/"retired ... gate" phrasing with identical documentation intent and zero behavior change (doc comments only, no code touched).
- **Files modified:** `packages/client/src/components/BenchCarousel.tsx`, `packages/client/src/components/DraftPackCarousel.tsx`
- **Verification:** `grep -ci 'drag'` returns 0 for all four files; `pnpm typecheck`/`pnpm lint`/`pnpm knip`/`pnpm stylelint` re-run clean; the three affected test files (`BenchCarousel.test.tsx`, `DraftPackCarousel.test.tsx`, `LineupAssignmentScreen.test.tsx`) re-run green (144/144 tests).
- **Committed in:** `efff9933`

---

**Total deviations:** 3 auto-fixed (1 blocking dependency install, 1 pre-existing dead-code removal required by the task's own literal acceptance criterion, 1 doc-comment rewording required by the same class of literal grep gate)
**Impact on plan:** All three are either infrastructure setup (install) or minimal, behavior-neutral cleanups directly required to satisfy this plan's own written, automated acceptance criteria — no scope creep beyond what Task 2/Task 3 explicitly specify as pass/fail conditions.

## Issues Encountered

- The first `pnpm test` (root `pnpm -r test`) run hit the documented Windows vitest worker-crash flake in `packages/server` (tinypool "Worker exited unexpectedly", 69/70 files reported passing with 1 unhandled error). Per this plan's own explicit guidance, re-ran `packages/server`'s vitest directly with `--pool=forks`, which passed cleanly at 70/70 files, 1635/1635 tests (1 skipped, 1 todo) — confirming the first run was a genuine infrastructure flake, not a real regression. `packages/client`'s suite (run separately to isolate it from the flake) passed cleanly on the first attempt at 40/40 files, 1287/1287 tests.

## User Setup Required

None — no external service configuration required.

## Verification Evidence — ROADMAP Phase 47 Success Criteria (all 7, closing this plan)

1. **"Clicking a player card on the mid-match roster screen selects it, shown with a green outline."** — `LineupAssignmentScreen.test.tsx` (107/107 green, Wave 4/47-04) exercises this via `.statCardSelected` class assertions on `fireEvent.click`; visually locked by `docs/HIGHLIGHT-REFERENCE.md` §4 (`#22c55e`, this plan).
2. **"Selecting a player highlights every eligible swap/substitution target in blue."** — Same test file's `.statCardEligible` assertions across positioning/substitution/pregame/draft describe blocks; documented in `docs/HIGHLIGHT-REFERENCE.md` §4 (`#60a5fa`, this plan).
3. **"Clicking the selected player again deselects it and clears the blue eligible-target highlights."** — `LineupAssignmentScreen.test.tsx`'s dedicated `ROSTER-03: deselect-on-second-click` tests (47-04) and the `handleRepositionCardClick`/`handlePregameCardClick`/`handleDraftPackCardClick`/`handleDraftSlotClick`/`handleDraftBenchCardClick` early-return deselect branches (confirmed by inspection, this plan's Task 2).
4. **"Clicking an eligible blue target completes the swap in positioning mode, or stages the substitution in substitution mode, exactly matching today's existing confirm flow."** — `LineupAssignmentScreen.test.tsx`'s `onSwap`/`onReposition`/`onSubstitute` emit-payload assertions (47-04) plus `GameBoard.test.tsx`'s SUB-08/SUB-09 click-driven `game:roster-reposition` emit assertions (47-05).
5. **"Positioning-mode and substitution-mode eligibility/guard logic remain two structurally separate functions, and no drag-and-drop state, handlers, or types remain in `LineupAssignmentScreen.tsx` — confirmed by a clean `knip` run."** — This plan's Task 2 inspection (5 eligibility functions + 8 click handlers, zero `mode`-parameterized guards) for the separation half; `pnpm knip` exit 0 zero-output (this plan) plus `grep -ci 'drag' LineupAssignmentScreen.tsx` = 0 (this plan, after the Task 3 comment cleanup in the two carousel files) for the zero-drag-code half.
6. **"The Standard pregame lineup screen's slot-swap uses the same click-to-select model."** — `LineupAssignmentScreen.test.tsx`'s `ROSTER-07: Standard pregame click-to-swap` describe block (6 tests, 47-04); `isPregameSwapEligible`/`handlePregameCardClick` confirmed structurally separate (this plan's Task 2).
7. **"The draft-mode pack carousel and bench/slot rearrange use the same click-to-select model ... GK-slot and swap-vs-move semantics are unchanged."** — `LineupAssignmentScreen.test.tsx`'s draft-mode describe blocks (12+ tests covering pack select/deselect/switch, all 5 draft dispatch shapes, both GK-rule rejection messages, 47-04); `violatesGKRule`/`rejectForGKRule`/`isDraftSlotEligible`/`isDraftBenchAreaEligible` confirmed structurally separate (this plan's Task 2).

Whole-workspace gate (all named in `<verification>`): `pnpm typecheck` exit 0 · `pnpm lint` exit 0 · `pnpm test` — shared 18/18·908, server 70/70·1635 (via `--pool=forks`), client 40/40·1287 · `pnpm knip` exit 0 zero-output, `knip.json` unchanged (`git diff --exit-code knip.json` exit 0) · `pnpm stylelint` exit 0 · `pnpm --filter @counter-attack/client build` exit 0.

## Next Phase Readiness

- Phase 47 (Select-Based Roster Interaction) is fully closed: all 6 plans across 5 waves complete, all 8 ROSTER requirements (ROSTER-01..08) satisfied and evidenced, `knip`/`stylelint`/`typecheck`/`lint`/full-suite/`build` all green, `docs/HIGHLIGHT-REFERENCE.md` documents the new card-selection tokens.
- Ready for the orchestrator to merge this worktree, update `STATE.md`/`ROADMAP.md` centrally, and proceed to Phase 48 (Permanent Jersey Numbers) — which explicitly depends on Phase 47's `applyRosterReposition` call path being exercised through the new click-to-select UI (ROADMAP.md Phase 48 "Depends on" note).
- No blockers, no deferred items, no stubs.

## Self-Check: PASSED

- FOUND: `docs/HIGHLIGHT-REFERENCE.md` (Section 4 Card Selection present, Section 5 renumbered)
- FOUND: `packages/client/src/components/LineupAssignmentScreen.module.css` (`.benchPlaceholders` removed)
- FOUND: `packages/client/src/components/BenchCarousel.tsx` (drag-era comments reworded)
- FOUND: `packages/client/src/components/DraftPackCarousel.tsx` (drag-era comments reworded)
- FOUND commit `1a12afd0` (Task 1)
- FOUND commit `4f818ec8` (Task 2)
- FOUND commit `efff9933` (Task 3)
- FOUND commit `e56db55d` (SUMMARY.md)

---
*Phase: 47-select-based-roster-interaction*
*Completed: 2026-08-30*
