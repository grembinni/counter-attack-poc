# Phase 38 (Corner Kick) — Deferred Items

Items discovered during plan execution that are out of scope for the discovering plan
(Scope Boundary rule: only auto-fix issues directly caused by the current task's changes).

## From Plan 38-06 (store selection branches, HexGrid selectability/tints)

- **`pnpm --filter @counter-attack/client typecheck` reports two pre-existing failures,
  neither touched by 38-06:**
  1. `packages/client/src/components/GameBoard.tsx(26,7)`: `PHASE_LABEL`'s
     `Record<GamePhase, string>` is missing the 5 new Corner Kick phase keys
     (`CORNER_KICK_GK_SETUP_ATTACKING`, `CORNER_KICK_GK_SETUP_DEFENDING`,
     `CORNER_KICK_TAKER_SELECT`, `CORNER_KICK_REPOSITION`, `CORNER_KICK_FINAL_SETUP`).
     This is expected — `GameBoard.tsx`'s phase dispatch + `PHASE_LABEL` extension is
     explicitly scoped to a later plan in this phase (per `38-PATTERNS.md`'s file
     classification table, "GameBoard.tsx (phase dispatch + PHASE_LABEL)" is a separate
     file from this plan's `files_modified`). Not fixed here — will resolve once that
     plan lands.
  2. `packages/client/src/components/ActionLog.tsx(329,74)`: "Function lacks ending
     return statement" — unrelated to Corner Kick, not touched by any 38-06 file, and not
     newly introduced (confirmed via `git diff --stat HEAD -- ActionLog.tsx` showing no
     changes from this plan). Pre-existing gap, out of scope per Scope Boundary rule.

Both are non-blocking for 38-06's own scope: `pnpm --filter @counter-attack/client build`
(vite build, no type-check step) and `pnpm --filter @counter-attack/client test` both pass
cleanly (674/674 tests). Flagging here so a later phase-38 plan (or a dedicated cleanup pass)
resolves the `GameBoard.tsx` gap before phase close, and so `ActionLog.tsx`'s pre-existing
issue is tracked rather than silently re-discovered.

**Update (38-16):** `CORNER_KICK_CLEAR_OUT` (the new gap-closure-round-2 phase value) is now
also missing from `PHASE_LABEL`'s `Record<GamePhase, string>`, for the identical reason as
the original 5 keys — `GameBoard.tsx` is not in this plan's `files_modified` (shared package
contracts only) and its `PHASE_LABEL`/dispatch extension is explicitly deferred to the plan
that builds the clear-out UI. `pnpm --filter @counter-attack/client typecheck` still reports
exactly 2 errors (same count as this entry's original baseline) — `ActionLog.tsx`'s
pre-existing gap plus this single `GameBoard.tsx` `Record` diagnostic (TypeScript's TS2741
only names the first missing key per diagnostic, so the message text changed but the error
count and category did not). Not a regression; will resolve alongside the other 5 keys when
`GameBoard.tsx` is next touched.

## From Plan 38-14 (GK save-spill → real LOOSE_BALL / second Corner Kick route)

- **`pnpm lint` (repo root `eslint .`) fails with 8 `Parsing error: Too many files (>8) have
matched the default project` errors, all inside `packages/shared/src/*.test.ts` and
  `packages/shared/scripts/seed-rosters.ts`.** `eslint.config.js`'s
  `allowDefaultProject: ['packages/shared/src/*.test.ts', 'packages/shared/scripts/*.ts']`
  glob now matches 14 files in `packages/shared`, exceeding typescript-eslint's default
  8-file `maximumDefaultProjectFileMatchCount` safety threshold — a config-vs-repo-growth
  drift, not a code defect. None of the 8 failing files were touched by this plan (this plan's
  `files_modified` are `packages/server/src/gameEngine.ts` and two `packages/server` test
  files only); `packages/shared` was rebuilt (`pnpm --filter @counter-attack/shared build`)
  but not edited. Confirmed out of scope by running `npx eslint` scoped to exactly this
  plan's touched files (`gameEngine.ts`, `gameEngine.test.ts`, `gameEngine.cornerKick.test.ts`,
  `gameEngine.phase17.test.ts`, `gameEngine.rule11.test.ts`) — zero errors. Fix belongs to a
  dedicated cleanup pass: either raise
  `parserOptions.projectService.maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING`
  or add `packages/shared/src/**/*.test.ts`/`packages/shared/scripts/**/*.ts` to
  `packages/shared/tsconfig.json`'s `include` so they resolve through the named project
  instead of the default-project fallback.
