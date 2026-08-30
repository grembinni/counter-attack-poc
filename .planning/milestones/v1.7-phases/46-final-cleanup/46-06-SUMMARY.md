---
phase: 46-final-cleanup
plan: 06
subsystem: testing
tags: [eslint, typescript-eslint, vitest, knip, dead-code-audit, nyquist-validation]

# Dependency graph
requires:
  - phase: 46-01
    provides: BALL_MARKER_PHASES extension + docs/HIGHLIGHT-REFERENCE.md resync (swept file)
  - phase: 46-02
    provides: interrupt-resume auto-reselect + RESPONSE_MOVE_CONFIG_BY_PHASE (swept file)
  - phase: 46-03
    provides: Match Speed relocation, Free Kick language, 46-AUDIT.md CLEANUP-07/12 sections (swept file, extended in this plan)
  - phase: 46-04
    provides: generic placeholder bench + roomHandlers.ts D-12 supersession (swept file, comment fix applied)
  - phase: 46-05
    provides: VALID_MOVE_TINT_EXCEPTION_PHASES + PlayerStatsPanel badge fix (swept file)
provides:
  - "eslint.config.js: maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING=30, unblocking a whole-workspace `pnpm -w lint` run that has been deferred as tech debt since Phase 32/33/34/43-06"
  - "46-AUDIT.md ## CLEANUP-13 — Dead-Code Sweep section: 24-file sweep table + gate results"
  - ".planning/phases/46-final-cleanup/deferred-items.md: pre-existing teams.ts breakdown-math drift, logged not fixed"
  - "46-VALIDATION.md: status complete, nyquist_compliant true, 12-row Per-Task Verification Map covering all 9 CLEANUP requirement ids with real plan/task ids and observed statuses"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "typescript-eslint projectService.maximumDefaultProjectFileMatchCount raised (not suppressed) when allowDefaultProject globs deliberately exceed the tool's 8-file default cap"

key-files:
  created:
    - .planning/phases/46-final-cleanup/deferred-items.md
  modified:
    - eslint.config.js
    - packages/server/src/__tests__/substitution.integration.test.ts
    - .planning/phases/46-final-cleanup/46-AUDIT.md
    - .planning/phases/46-final-cleanup/46-VALIDATION.md

key-decisions:
  - "Fixed (not deferred a fourth time) the pre-existing typescript-eslint default-project file-match cap error blocking pnpm -w lint, because this plan's own task text makes a clean pnpm -w lint exit 0 an explicit, non-optional success criterion for the first time — the tool's own error message names the exact config-cap fix used, which is a mechanical fix, not a suppression, disable, or scope-narrowing"
  - "The teams.ts header breakdown math (44+24+44+66=178, contradicting the stated 198 total) was investigated but logged to deferred-items.md rather than fixed: git history shows the breakdown text has been byte-identical since before Phase 46 across three separate total-count bumps, and the plan's own acceptance criterion (leading total equals PLAYER_POOL.length) is independently satisfied — reconstructing the real category breakdown from CSV source data was judged out of this bounded sweep's scope and risked introducing new incorrect information"

patterns-established: []

requirements-completed: [CLEANUP-13]

# Metrics
duration: ~55min
completed: 2026-08-29
---

# Phase 46 Plan 06: Full Monorepo Gate + Validation Contract Backfill Summary

**Fixed a three-phase-deferred typescript-eslint config cap so `pnpm -w lint` finally exits 0 alongside typecheck/test/knip, swept all 24 files touched by plans 46-01 through 46-05 for removal residue (one genuine stale-comment finding, fixed), and backfilled `46-VALIDATION.md` from a 7-row TBD draft into a 12-row complete requirement-to-evidence map covering all nine CLEANUP-05..13 ids.**

## Performance

- **Duration:** ~55 min (includes `pnpm install` + `packages/shared` build for a fresh worktree with no `node_modules`)
- **Completed:** 2026-08-29
- **Tasks:** 2/2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- All four whole-monorepo gate commands (`pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w test`, `pnpm knip`) run in sequence and confirmed to exit 0 against the merged result of plans 46-01 through 46-05: typecheck clean across all 3 packages, lint clean (~35s), test green (shared 907 + server 1635 [1 skipped, 1 todo] + client 1239 = 3,781 tests), knip zero findings. This is CLEANUP-13's own stated success criterion and the first time this exact four-command sequence has been run in full against this phase's changes (46-RESEARCH.md's Environment Availability table explicitly deferred `lint`/`test` to execution time).
- Root-caused and fixed the pre-existing `pnpm -w lint` failure ("Too many files (>8) have matched the default project" across `packages/shared`'s test files) — a config-cap issue previously deferred, undisturbed, across four separate phases (32, 33, 34, 43-06's own `deferred-items.md` entries). Raised `maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING` to 30 in `eslint.config.js`, matching the tool's own documented escape hatch for the 19 files the existing `allowDefaultProject` list already deliberately allow-lists.
- Ran a bounded dead-code sweep over exactly the 24 files plans 46-01 through 46-05 touched (not the whole repo, per 46-RESEARCH.md Pitfall 6's explicit scoping), checking all five residue classes named in the plan. Found and fixed one genuine issue: `substitution.integration.test.ts`'s header and section-divider comments still asserted, in the imperative, that a Standard room's bench "must never be 'fixed' by adding bench generation" — a stance Plan 46-04 explicitly and correctly superseded by doing exactly that. Reworded to an accurate "HISTORICAL NOTE (superseded by Phase 46...)" framing; zero test assertions changed (confirmed via `git diff` — comment-only).
- Logged one pre-existing, out-of-scope finding to a new `deferred-items.md` rather than fixing it: `teams.ts`'s header comment breakdown (`4 legacy squads (44) + free agents (24) + MLS (44) + national (66)` = 178) has never summed to its own stated total across three separate historical bumps (178→188→198) — confirmed via `git log -p` that this predates Phase 46 entirely. The plan's actual acceptance criterion (the leading total equals `PLAYER_POOL.length`, 198) passes.
- Backfilled `46-VALIDATION.md` from its 7-row, all-`TBD` draft into a 12-row Per-Task Verification Map with every Plan/Wave/Task ID resolved to a real value from the five preceding plans' SUMMARY.md files, covering all nine CLEANUP-05 through CLEANUP-13 requirement ids (including both CLEANUP-09 instances and CLEANUP-05's three separate gap-closure instances), with CLEANUP-07/CLEANUP-12 correctly typed as `audit` evidence citing `46-AUDIT.md` sections instead of an invented vitest command. Frontmatter flipped to `status: complete` / `nyquist_compliant: true`; all 6 Validation Sign-Off items ticked with evidence; Manual-Only Verifications table left byte-identical and unticked (confirmed via `git diff`) for plan 46-07.

## Task Commits

Each task was committed atomically:

1. **Task 1: Run the full monorepo gate and sweep Phase 46's touched files for removal residue** - `2fcdc33d` (fix)
2. **Task 2: Backfill the phase validation contract with real task IDs and observed statuses** - `abafb383` (docs)

## Files Created/Modified

- `eslint.config.js` - Added `maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 30` to the existing `projectService` config, with a comment citing the 19-file count and the prior three phases' deferred-items.md entries this supersedes. No new `allowDefaultProject` glob, no rule disabled, no scope narrowed.
- `packages/server/src/__tests__/substitution.integration.test.ts` - Reworded the file-header doc comment (was: "the D-12 test below... must never be 'fixed' by adding bench generation") to a historical-note framing describing Phase 46's actual supersession; updated the item-11 coverage-list entry and two section-divider comments to match. Comment-only diff — zero assertions, zero `it()` bodies changed.
- `.planning/phases/46-final-cleanup/46-AUDIT.md` - Appended `## CLEANUP-13 — Dead-Code Sweep`: a 24-row file-by-file sweep table (residue classes checked, finding, disposition), the row-#20 finding detail for the `substitution.integration.test.ts` fix, the `eslint.config.js` finding-and-fix detail, and the final gate-results table (all four commands, exit codes, measured lint duration).
- `.planning/phases/46-final-cleanup/deferred-items.md` (new) - Documents the pre-existing `teams.ts` header-breakdown math drift found during the sweep, with full `git log -p` evidence that it predates Phase 46, and the disposition (deferred, not fixed — the plan's actual acceptance criterion is independently satisfied).
- `.planning/phases/46-final-cleanup/46-VALIDATION.md` - Per-Task Verification Map grown from 7 `TBD` rows to 12 resolved rows; frontmatter `status`/`nyquist_compliant` flipped to `complete`/`true`; all 6 Validation Sign-Off items ticked with evidence; Manual-Only Verifications table left untouched.

## Decisions Made

- **Fixed the `pnpm -w lint` config-cap error rather than deferring it a fourth time.** Three prior phases (32, 33, 34) and one more recent plan (43-06) all independently hit and logged this exact same pre-existing issue as out-of-scope tech debt, because none of those phases' own success criteria required a clean whole-workspace `pnpm -w lint` run. This plan's task text is different: `pnpm -w lint` is one of "all four [gate commands that] must exit 0," making it this plan's own explicit, in-scope success criterion for the first time. The fix used is the tool's own documented escape hatch (raising a file-match cap for files that are already deliberately allow-listed, not accidentally caught) — none of the plan's fix-forward prohibitions (narrowing scope, eslint-disable, knip suppression, weakened assertion, deleted test) apply to it.
- **Logged the `teams.ts` breakdown-math drift rather than attempting to fix it.** Reconstructing the real category composition (how many players actually belong to "legacy squads" vs. "free agents" vs. "MLS" vs. "national" today) would require re-deriving it from the CSV's `Team`/`SourceTeam` column values — a non-trivial analysis with real risk of introducing new incorrect numbers, for a comment whose only acceptance-criterion-relevant claim (the leading total) is already correct. Per the Scope Boundary rule, this is out-of-scope pre-existing drift (confirmed via `git log -p` to predate Phase 46 across three prior bumps) and was logged to `deferred-items.md` instead.
- **Table row for CLEANUP-07/CLEANUP-12 uses `audit` as Test Type rather than inventing a vitest command**, per the plan's explicit instruction — these are audit-shaped requirements whose evidence is the written `46-AUDIT.md` record itself (cross-checked against live source during this plan's own re-verification pass), not a runnable test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `pnpm -w lint` failed on a pre-existing typescript-eslint default-project file-match cap**
- **Found during:** Task 1, first gate-sequence run
- **Issue:** `eslint .` errored with `Parsing error: Too many files (>8) have matched the default project` across 3 `packages/shared` test files. The existing `allowDefaultProject` config already deliberately allow-lists 19 files (18 `packages/shared/src/*.test.ts` + 1 `packages/shared/scripts/*.ts`), exceeding typescript-eslint's default 8-file cap. This exact issue was previously found and explicitly deferred as out-of-scope tech debt in Phases 32, 33, 34, and again in Plan 43-06 (`git log --all --oneline -- "**/deferred-items.md"` shows all four prior occurrences) — none of those phases required a clean whole-workspace lint run as their own success criterion, but this plan's Task 1 explicitly does.
- **Fix:** Added `maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 30` to `eslint.config.js`'s existing `projectService` block — the tool's own documented fix for this exact situation, applied to files that are already intentionally allow-listed, not a suppression of a genuine problem.
- **Files modified:** `eslint.config.js`
- **Verification:** `pnpm -w lint` now exits 0 in ~35s (measured via `date +%s` before/after); re-run twice, both times clean.
- **Committed in:** `2fcdc33d` (Task 1 commit)

**2. [Rule 1 - Bug] Stale, actively-misleading "must never be fixed" comment found during the dead-code sweep**
- **Found during:** Task 1, dead-code sweep (residue classes 3 and 5)
- **Issue:** `substitution.integration.test.ts`'s file-header doc comment and two section-divider comments still stated, unqualified, that a Standard room reaching a live match with an empty bench "is WORKING AS INTENDED, not a gap, and must never be 'fixed' by adding bench generation here or anywhere else" — a claim Plan 46-04 explicitly and correctly contradicted by adding exactly that (a generic 5-player placeholder bench fallback). The test body itself had already been correctly rewritten by 46-04; only the surrounding prose comments were left describing the old, now-false behavior as both current and permanently mandated.
- **Fix:** Reworded the header comment to a "HISTORICAL NOTE (superseded by Phase 46...)" framing describing the old D-12 stance accurately as history, then explaining Phase 46's D-06 supersession; updated the item-11 coverage-list entry and both section-divider comments to match. Zero test logic, assertions, or `it()` bodies touched.
- **Files modified:** `packages/server/src/__tests__/substitution.integration.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test -- substitution.integration` — 12/12 pass; full monorepo suite re-run green after the fix.
- **Committed in:** `2fcdc33d` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking config-cap fix, 1 stale-comment bug fix)
**Impact on plan:** Both fixes were necessary to satisfy this plan's own literal acceptance criteria (a genuinely clean `pnpm -w lint`, and a dead-code sweep that actually fixes what it finds rather than just cataloging it). No scope creep — both fixes are narrowly targeted at the exact files/lines implicated, with zero behavior change to game logic, test assertions, or CI.

## Issues Encountered

- **Fresh worktree had no `node_modules` or built `packages/shared/dist`.** Ran `pnpm install --frozen-lockfile` (~3 min) and `pnpm --filter @counter-attack/shared build` before any gate command could resolve `@counter-attack/shared`'s workspace exports. Standard worktree setup, not a plan deviation.
- **No vitest worker-crash flake observed this session** (the documented Windows `--pool=forks` workaround, mentioned as a known risk in the plan's action text, was not needed — the full `pnpm -w test` run completed cleanly on the first attempt each time it was run).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 46's own explicit gate — `pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm knip` — is green, satisfying CLEANUP-13's "the full monorepo build/typecheck/test suite stays green" success criterion.
- `46-VALIDATION.md` is now a complete, honest requirement-to-evidence map for all nine CLEANUP-05..13 requirements, ready for `/gsd-verify-work` or the phase-gate checkpoint to consume directly.
- `46-AUDIT.md`'s CLEANUP-13 section gives the next milestone's planner a measured `pnpm -w lint` duration (~35s) instead of research's 100-170s estimate, and confirms the previously-deferred lint-config issue is now permanently resolved (not re-deferred).
- One pre-existing, non-blocking documentation drift remains logged (not fixed) in `deferred-items.md`: `teams.ts`'s header breakdown parenthetical. Does not block phase close.
- Manual-Only Verifications (CLEANUP-10 cross-panel feel, CLEANUP-11 visual card alignment, CLEANUP-05/06 dead-ball highlight consistency) remain open, exactly as scoped, for plan 46-07's live two-browser walkthrough.

---
*Phase: 46-final-cleanup*
*Completed: 2026-08-29*

## Self-Check: PASSED

- FOUND: `eslint.config.js`
- FOUND: `packages/server/src/__tests__/substitution.integration.test.ts`
- FOUND: `.planning/phases/46-final-cleanup/46-AUDIT.md`
- FOUND: `.planning/phases/46-final-cleanup/deferred-items.md`
- FOUND: `.planning/phases/46-final-cleanup/46-VALIDATION.md`
- FOUND: `.planning/phases/46-final-cleanup/46-06-SUMMARY.md`
- FOUND commit `2fcdc33d` (Task 1)
- FOUND commit `abafb383` (Task 2)
