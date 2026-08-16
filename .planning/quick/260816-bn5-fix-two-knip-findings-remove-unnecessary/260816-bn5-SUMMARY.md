---
phase: quick/260816-bn5
plan: 01
subsystem: testing
tags: [knip, eslint, dead-code, tooling, gameEngine]

requires: []
provides:
  - Clean pnpm knip baseline (0 findings: no Unused exports, no Configuration hints)
  - triggerFoulFreeKick reduced to module-private visibility in gameEngine.ts
affects: [future dead-code audits, knip.json maintenance]

tech-stack:
  added: []
  patterns:
    - 'knip entry patterns should only be declared in knip.json when knip cannot auto-derive them from package.json fields/scripts or its Vite plugin'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - knip.json

key-decisions:
  - 'Un-exported triggerFoulFreeKick rather than adding a compensating re-export — its only consumer is in the same file'
  - "Deleted the packages/shared and packages/server entry keys entirely (rather than setting entry: []) to avoid suppressing knip's default entry resolution"
  - 'packages/client entry reduced to just index.html; src/main.tsx and scripts/check-contrast.ts are auto-detected via the Vite plugin and package.json scripts respectively'

patterns-established: []

requirements-completed: [KNIP-01, KNIP-02]

duration: ~25min
completed: 2026-08-16
---

# Quick Task 260816-bn5: Fix Two Knip Findings Summary

**Un-exported the single-file-only `triggerFoulFreeKick` function and pruned 6 redundant entry patterns from the root `knip.json`, bringing `pnpm knip` to a clean zero-finding baseline.**

## Performance

- **Duration:** ~25 min (including a one-time `pnpm install` to populate this worktree's previously-empty `node_modules`)
- **Tasks:** 3/3 completed (Task 3 was verification-only, no file changes)
- **Files modified:** 2

## Accomplishments

- `pnpm knip` now exits 0 with zero findings (was: 1 unused export + 6 configuration hints)
- `triggerFoulFreeKick` visibility reduced from exported to module-private; call site and behavior unchanged
- Root `knip.json` workspace config no longer restates entry points knip already auto-derives

## Task Commits

1. **Task 1: Un-export triggerFoulFreeKick in gameEngine.ts** - `440d478` (fix)
2. **Task 2: Prune the 6 redundant entry patterns from root knip.json** - `717dc7c` (chore)
3. **Task 3: Full-repo regression gate** - no commit (verification-only, no file edits)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - Removed `export` keyword from `triggerFoulFreeKick` (line 1536); prettier reformatted the now-shorter signature onto one line as part of lint-staged, no other changes
- `knip.json` - Deleted `entry` key entirely for `packages/shared` and `packages/server` workspaces (both now `project`-only); reduced `packages/client.entry` to `["index.html"]`

## Decisions Made

- Confirmed via `git log` and code inspection that `triggerFoulFreeKick`'s only call site is in the same file (`gameEngine.ts:1677`, unchanged); no re-export needed anywhere including `packages/server/src/index.ts`
- Verified `packages/server/src/index.ts` is a barrel that does not re-export `gameEngine`, so nothing leaked through it before or after the change
- All 6 entry pattern removals were genuinely redundant — `pnpm knip` produced zero new findings after pruning, so the Task 2 contingency clause (restore-if-load-bearing) was never triggered

## Deviations from Plan

### Auto-fixed Issues

None from Rules 1-3 during Task 1/Task 2 execution — both edits landed exactly as specified in the plan.

### Environment setup (not a deviation, required to execute at all)

This worktree's `node_modules` was completely absent (fresh worktree, never had `pnpm install` run in it). Ran `pnpm install` before any verification command — it resolved 543/543 packages entirely from the existing pnpm content-addressable store (0 downloaded), so it did not touch or risk the main repo's shared `node_modules`/`.pnpm` store content (see project memory `feedback_worktree_junction_risk.md` — this avoids the Windows-junction pitfall entirely by using pnpm's own linking instead of manual junctions).

---

**Total deviations:** 0 auto-fixed (Rules 1-3 not triggered). One pre-existing, out-of-scope failure surfaced during Task 3's verification sweep — documented below and in `deferred-items.md`, not fixed (see Issues Encountered).
**Impact on plan:** None. Both edits are exactly the minimal changes the plan specified.

## Issues Encountered

**`pnpm lint` fails with a pre-existing, out-of-scope error (not caused by this plan's changes).**

`packages/shared/src/*.test.ts` now matches 16 files, exceeding typescript-eslint's default `maximumDefaultProjectFileMatchCount` of 8 for the `allowDefaultProject` glob in `eslint.config.js` (parsing errors on `teamConfig.test.ts` and `teams.test.ts`, 9 problems total). Root-caused via `git log`: `eslint.config.js`'s `allowDefaultProject` glob was last touched in Phase 34 (`8fa0aee`); test files were added past the 8-file threshold across Phases 37-39 (e.g. `fouls.test.ts` in Phase 39, commit `7a966de`/`b0b8d0f`). Confirmed the installed `typescript-eslint` version (8.60.0) exactly matches the version pinned in `package.json`/`pnpm-lock.yaml` — this plan's `pnpm install` did not introduce version drift.

Per the plan's own Task 3 instruction ("fix the cause in the file owned by Task 1 or Task 2") and the SCOPE BOUNDARY rule, this failure is not attributable to either of this plan's two files (`gameEngine.ts`, `knip.json`) and was left unfixed. Full detail and a recommended follow-up (raise the threshold or restructure the glob) recorded in [deferred-items.md](./deferred-items.md).

All other Task 3 sweep commands passed:

- `pnpm knip` — exit 0, zero findings
- `pnpm --filter @counter-attack/shared build` — exit 0
- `pnpm typecheck` (recursive: shared + server + client) — exit 0
- `pnpm build` (recursive: shared + server + client) — exit 0
- `pnpm --filter @counter-attack/server test` — 53/53 test files, 1340 passed / 1 skipped / 1 todo, no worker-crash flake this run

## Known Stubs

None.

## Threat Flags

None — this plan strictly reduces surface area (export → module-private; dev-tool config pruning). No new network endpoints, auth paths, file access patterns, or schema changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `pnpm knip` is now a clean, zero-finding baseline; future dead-code/config-redundancy regressions will be visible as signal
- The pre-existing `pnpm lint` failure (test-file-count threshold) is unresolved and should be picked up as its own follow-up quick task or folded into a future phase's cleanup scope — see `deferred-items.md`

---

_Quick task: 260816-bn5_
_Completed: 2026-08-16_

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: knip.json
- FOUND: .planning/quick/260816-bn5-fix-two-knip-findings-remove-unnecessary/260816-bn5-SUMMARY.md
- FOUND: .planning/quick/260816-bn5-fix-two-knip-findings-remove-unnecessary/deferred-items.md
- FOUND commit: 440d478 (Task 1)
- FOUND commit: 717dc7c (Task 2)
