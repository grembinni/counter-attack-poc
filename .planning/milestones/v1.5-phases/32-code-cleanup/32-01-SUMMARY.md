---
phase: 32-code-cleanup
plan: 01
subsystem: tooling
tags: [knip, dead-code, ci, monorepo, pnpm-workspace, zustand]

# Dependency graph
requires: []
provides:
  - knip 6.29.0 installed as a permanent, CI-enforced dead-code gate (pnpm knip)
  - knip.json root config covering packages/shared, packages/server, packages/client
  - .github/workflows/ci.yml runs pnpm knip after the shared build, before typecheck
  - shootTargetHex field fully removed from useGameStore.ts (declaration + 3 write sites)
  - All other genuine knip-flagged dead code removed (files, exports, dependencies)
affects: [32-02, 32-03, 32-04, 32-05, 32-06]

# Tech tracking
tech-stack:
  added: [knip@6.29.0]
  patterns:
    - 'knip workspaces config with explicit entry/project globs per package (avoids relying on plugin auto-detection)'
    - 'Module-internal symbols (only consumed within their own file) drop the `export` keyword instead of being deleted, when the value itself is still live'
    - 'ignoreDependencies in knip.json for devDependencies invoked via shell-string execSync (husky prepare script) rather than static import — a knip config gap, not dead code'

key-files:
  created: [knip.json, .planning/phases/32-code-cleanup/deferred-items.md]
  modified:
    - package.json
    - pnpm-lock.yaml
    - .github/workflows/ci.yml
    - packages/client/package.json
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/components/DraftPackCarousel.tsx
    - packages/client/src/mock/index.ts
    - packages/client/src/styles/uniformStyles.tsx
    - packages/server/src/gameEngine.ts

key-decisions:
  - 'knip 6.29.0 (not 6.28.0) approved by human at the Task 1 checkpoint'
  - "husky added to knip.json ignoreDependencies (config gap: invoked via execSync string in the prepare script, which knip's static analysis cannot trace) rather than deleted"
  - 'ConnectionStatus.tsx + its CSS module deleted as genuinely dead — deliberately unwired from GameBoard.tsx in a prior refactor (commit 5115fce) and never re-integrated; flagged as a cross-plan note since Plan 32-06 lists this file in files_modified for a react-hooks lint fix'
  - 'mock/mockPassState.ts, mockShotState.ts, mockGKRestartState.ts deleted as a dead chain (each only consumed by the next, terminating in an unused barrel re-export); only mockMovementState remains as the live store placeholder'
  - 'honeycomb-grid removed from packages/client dependencies — genuinely unused; hex math is hand-rolled in packages/shared/src/hex.ts instead, contrary to the original STACK.md recommendation'
  - '18 uniform style renderer consts, 2 interface types, TIER_ORDER, and the Screen type had `export` dropped (not deleted) — all are live but only consumed within their own module'
  - 'computeHeaderDuelWinner deleted from gameEngine.ts — a superseded thin wrapper over computeHeaderDuelDetail with zero callers'

patterns-established:
  - 'Dead-code review checklist: for each knip finding, first grep the whole client/server tree for the symbol name before deciding export-strip vs. full-delete vs. config-gap fix'

requirements-completed: [CLEANUP-01]

# Metrics
duration: ~35min (session included one transient-API-error interruption and resume)
completed: 2026-07-24
---

# Phase 32 Plan 01: Dead-Code Detection Gate (knip) Summary

**Installed knip 6.29.0 as a permanent, CI-enforced whole-workspace dead-code gate and removed every genuine finding it surfaced — including the confirmed-dead `shootTargetHex` field, an orphaned component, a dead mock-state chain, an unused dependency, and 24 unnecessarily-exported symbols.**

## Performance

- **Duration:** ~35 min (session was interrupted mid-Task-3 by a transient API 500 error and resumed)
- **Completed:** 2026-07-24T23:53:48Z
- **Tasks:** 3 (Task 1 checkpoint pre-approved by human before this session started; Task 2 + Task 3 executed)
- **Files modified:** 9 modified, 5 deleted, 2 created (knip.json, deferred-items.md)

## Accomplishments

- `pnpm knip` runs whole-workspace analysis across `packages/shared`, `packages/server`, `packages/client` and exits 0 (zero unused files/exports/dependencies)
- `pnpm knip` wired into `.github/workflows/ci.yml` as a permanent CI gate, correctly ordered after the shared build (Pitfall 6) and before typecheck
- `shootTargetHex` completely removed from `useGameStore.ts` — declaration, initial state, `setGameState` write, and `setShootingMode` write
- Full workspace typecheck, test suite (583 shared + 627 server + 376 client = 1,586 tests), and build all green after every removal

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify knip package legitimacy before install** — pre-approved by the human at "Approve, use 6.29.0" prior to this session; no separate commit (checkpoint gate only)
2. **Task 2: Install knip, add knip.json, root script, and the CI gate step** — `81b96f7` (feat)
3. **Task 3: Remove shootTargetHex and all other genuine knip-flagged dead code** — `6b6b69a` (fix)

_Note: this session was interrupted by a transient API error partway through Task 3 and resumed from the same worktree; Task 3's single commit reflects the complete, re-verified diff after resumption._

## Files Created/Modified

- `knip.json` - Root workspaces config (entry/project per package) + `ignoreDependencies: ["husky"]`
- `package.json` - Added `"knip": "pnpm --filter @counter-attack/shared build && knip"` script + devDependency
- `pnpm-lock.yaml` - knip added, honeycomb-grid removed
- `.github/workflows/ci.yml` - New `pnpm knip` step after shared build, before typecheck
- `packages/client/package.json` - Removed unused `honeycomb-grid` dependency
- `packages/client/src/store/useGameStore.ts` - Removed `shootTargetHex` (field + 3 write sites); dropped `export` from the module-internal `Screen` type
- `packages/client/src/components/DraftPackCarousel.tsx` - Dropped `export` from `TIER_ORDER` (module-internal only; comment corrected — only `TIER_CARD_CLASS` is actually reused by `BenchCarousel`)
- `packages/client/src/mock/index.ts` - Barrel now only re-exports the live `mockMovementState`
- `packages/client/src/styles/uniformStyles.tsx` - Dropped `export` from all 18 style-renderer consts and the `UniformRenderParams`/`UniformRenderResult` interfaces (module-internal; only the `UNIFORM_STYLES` registry and `UniformStyleRenderer` type are consumed externally)
- `packages/server/src/gameEngine.ts` - Deleted dead `computeHeaderDuelWinner` wrapper (zero callers); corrected two stale comment references to it
- `packages/client/src/components/ConnectionStatus.tsx` + `.module.css` - **Deleted** (unused file)
- `packages/client/src/mock/mockPassState.ts`, `mockShotState.ts`, `mockGKRestartState.ts` - **Deleted** (unused files, dead chain)
- `.planning/phases/32-code-cleanup/deferred-items.md` - **Created**; logs a pre-existing, out-of-scope `pnpm lint` config ceiling issue in `packages/shared`

## Decisions Made

- **knip 6.29.0** installed per the human's explicit Task 1 approval ("Approve, use 6.29.0"), not the 6.28.0 fallback.
- **husky kept, not deleted.** knip flagged it as an unused devDependency because it's invoked inside a `node -e "...execSync('husky')..."` string in the `prepare` script — knip's static script parser can't trace an eval'd string. Verified husky IS genuinely used (`.husky/pre-commit` exists and lint-staged runs on every commit in this session). Fixed via `knip.json`'s `ignoreDependencies: ["husky"]` — a documented config gap, not dead code, per knip's own "avoid ignore patterns for real findings" guidance (this is the inverse case: a real config blind spot, not a surprising-but-real finding).
- **ConnectionStatus.tsx deleted despite appearing in Plan 32-06's `files_modified` list.** Traced its git history: it was added in Phase 07 (`d3b3ab4`) and deliberately removed from `GameBoard.tsx`'s render tree in a later commit (`5115fce`, commit message: "Remove ConnectionStatus import and wrapper div from GameBoard.tsx"). It has had zero live call sites since. Grepped the entire repo (source, not just `packages/client/src`) to confirm no dynamic/string-keyed reference exists. **Cross-plan note for the orchestrator/Plan 32-06 executor:** Plan 32-06 (Wave 3, `depends_on: ['32-01', '32-04']`) lists `packages/client/src/components/ConnectionStatus.tsx` in its `files_modified` for a react-hooks lint fix — that file no longer exists after this plan. The 32-06 executor should treat that list item as moot (file removed as genuine dead code in 32-01) rather than an error.
- **mockPassState/mockShotState/mockGKRestartState deleted as a chain**, not individually. `mockGKRestartState` (top of the chain) had zero external consumers; deleting it left `mockShotState`'s only consumer gone, which in turn left `mockPassState`'s only consumer gone. `mockMovementState` (the only mock actually used, by `useGameStore.ts`'s initial state) is untouched.
- **honeycomb-grid removed** from `packages/client` — grepped `packages/client/src` for any import, found none; the codebase's hex math has always lived in `packages/shared/src/hex.ts` (axial coordinates, per the project's locked Phase 1 decision), so this dependency was installed per the original STACK.md recommendation but never actually wired in.
- **18 uniform-style renderer consts + 2 interfaces + TIER_ORDER + Screen: `export` dropped, values kept.** In every case, grepped the whole `packages/client/src` tree and confirmed the symbol is used only within its own file (e.g., all 18 renderers are assembled into the exported `UNIFORM_STYLES` registry, which is what external code actually imports). This preserves live behavior while satisfying knip's unused-export check — no behavior change, just visibility narrowing.
- **computeHeaderDuelWinner deleted.** Its own docblock said "preserved for existing callers that only need the winner" but grep found zero callers anywhere (source or test) — `gameHandlers.ts` calls `computeHeaderDuelDetail` directly and reads `.winner` itself. Updated two stale comments elsewhere in `gameEngine.ts` that referenced the deleted function by name.
- **Worktree had a stale/incomplete `node_modules` at session start** (only root-level devDependencies were linked; every package's own `node_modules` — including `vitest`, `react`, `socket.io-client`, etc. — was missing). This caused knip's Vitest plugin to fail loading each package's `vitest.config.ts` (`Cannot find module 'vitest/config'`), which cascaded into 68 false "unused file" flags on every test file in the repo. Fixed via `pnpm install` (Rule 3 — blocking issue) before trusting any knip output, per the plan's own Pitfall 6 / Open Question 1 guidance ("run `knip --debug` ... treat any anomalies here as a config task").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree `node_modules` was incomplete, causing false knip findings**

- **Found during:** Task 2 (`pnpm knip --debug` first run)
- **Issue:** Only root-scoped devDependencies were linked in `node_modules`; every workspace package's own dependencies (vitest, react, socket.io-client, etc.) were missing, causing knip's Vitest plugin to fail resolving each package's `vitest.config.ts` and misreport 68 test files as "unused"
- **Fix:** Ran `pnpm install` (full workspace install, not `--frozen-lockfile`) to populate all workspace `node_modules`
- **Files modified:** None (node_modules only; not tracked by git)
- **Verification:** Re-ran `pnpm knip --debug`; zero `Cannot find module` errors; unused-files count dropped from 68 to 1 (the genuinely dead `ConnectionStatus.tsx`)
- **Committed in:** N/A (no file changes to commit for this fix itself; downstream fixes committed in `6b6b69a`)

**2. [Rule 2 - Missing Critical] husky's genuine usage wasn't visible to knip's static analysis**

- **Found during:** Task 3 (reviewing the `pnpm knip` finding inventory)
- **Issue:** knip flagged `husky` as an unused devDependency; deleting it would have silently broken the git-hooks pipeline (lint-staged pre-commit enforcement)
- **Fix:** Added `"ignoreDependencies": ["husky"]` to `knip.json` with justification documented in this SUMMARY (config gap: husky is invoked via an `execSync('husky', ...)` string inside the `prepare` script, not a statically-analyzable import)
- **Files modified:** `knip.json`
- **Verification:** `pnpm knip` no longer flags husky; `.husky/pre-commit` and lint-staged continued running correctly on the Task 2 and Task 3 commits in this session
- **Committed in:** `6b6b69a`

**3. [Rule 1 - Bug] Stale doc comment overstated TIER_ORDER's reuse**

- **Found during:** Task 3 (investigating the `TIER_ORDER` unused-export finding)
- **Issue:** `DraftPackCarousel.tsx`'s file-level docblock claimed both `TIER_CARD_CLASS` AND `TIER_ORDER` were "exported for reuse by BenchCarousel" — only `TIER_CARD_CLASS` actually is (confirmed via grep); the `TIER_ORDER` claim was incorrect/stale
- **Fix:** Corrected the docblock to only claim `TIER_CARD_CLASS` reuse; dropped `export` from `TIER_ORDER` (still used internally for the pack's rarity sort)
- **Files modified:** `packages/client/src/components/DraftPackCarousel.tsx`
- **Verification:** `pnpm --filter @counter-attack/client test` still green (DraftPackCarousel.test.tsx, BenchCarousel.test.tsx unaffected)
- **Committed in:** `6b6b69a`

---

**Total deviations:** 3 auto-fixed (1 blocking-environment, 1 missing-critical/config-gap, 1 stale-comment bug)
**Impact on plan:** All three were necessary to get an accurate, trustworthy knip finding inventory and to avoid breaking git-hooks tooling. No scope creep — every additional file touched (`ConnectionStatus.tsx`, the mock chain, `honeycomb-grid`, the 18 uniform renderers, `computeHeaderDuelWinner`) was a knip-flagged finding this plan's Task 3 explicitly mandated addressing, not unrelated work.

## Issues Encountered

- **`pnpm lint` fails on pre-existing, out-of-scope `packages/shared` test files** (typescript-eslint's `parserOptions.projectService` default-project file-count ceiling — 12 files match an 8-file limit). Confirmed via `git diff --stat` that this plan touches zero files inside `packages/shared/`, and via targeted `eslint` runs that every file this plan actually modified is lint-clean. `.github/workflows/ci.yml` does not run `pnpm lint` today, so this is a pre-existing latent issue, not a regression. Logged to `.planning/phases/32-code-cleanup/deferred-items.md` for a future plan (candidate: 32-06, which already touches `eslint.config.js`).
- **Session interruption:** a transient API 500 error terminated the agent mid-Task-3 after several files were already edited but before verification/commit. On resume, re-ran `pnpm knip`, the full test suite, typecheck, and build to confirm the in-progress changes were complete and correct before committing — no work was lost or needed to be redone.

## Known Stubs

None — this plan only removes code; no new UI/data-flow stubs introduced.

## Threat Flags

None — knip and its config are devDependency-only, never shipped in any production bundle (per the plan's own threat model, T-32-SC/T-32-01/T-32-02, all pre-assessed and disposed as mitigate/accept). No new network endpoints, auth paths, or trust-boundary changes were introduced by this plan's dead-code removals.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `pnpm knip` is now a permanent CI gate — Plans 32-02 through 32-06 (and all future work) will have any newly-introduced dead code caught automatically.
- **Cross-plan note for Plan 32-06:** `packages/client/src/components/ConnectionStatus.tsx` (listed in 32-06's `files_modified`) no longer exists — it was deleted in this plan as confirmed dead code. The 32-06 executor should skip/adjust that item rather than treat it as a missing-file error.
- `.planning/phases/32-code-cleanup/deferred-items.md` carries forward one pre-existing, unrelated `pnpm lint` config issue for a future plan to pick up (not blocking for this phase's CLEANUP-01 requirement).
- Full workspace typecheck, test (1,586 tests), `pnpm knip`, and `pnpm -r build` are all green at hand-off.

---

_Phase: 32-code-cleanup_
_Completed: 2026-07-24_
