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

## From Plan 38-19 (restart banners)

- **The Penalty Kick restart banner requested by 38-15 defect 4 cannot be implemented in Phase
  38** because no penalty-kick `GamePhase` exists yet — Penalty Kick is Phase 39 scope
  (requirement family PK per `ROADMAP.md`). `grep -rn "PENALTY" packages/shared/src` today
  returns only the `NOT_IN_PENALTY_AREA` shot reason, confirming there is no phase value to key
  a banner on.
  `RESTART_BANNERS` (`packages/client/src/components/EventBanner.tsx`) is the extension point:
  Phase 39 must add exactly one row — `<the Phase 39 penalty-kick entry phase>: 'Penalty Kick!'`
  — to the existing table; no new mechanism is needed. The `it.each(Object.entries(RESTART_BANNERS))`
  test in `EventBanner.test.tsx` automatically covers the new row once added, without further
  test changes.
  The 38-24 checkpoint records this same follow-up so it stays visible at Phase 38 close.

## From Plan 38-32 (round-4 triage of 38-30 bug 1)

**Verdict: DEFERRED** out of Phase 38. Tracked as a pending todo:
`.planning/todos/pending/2026-08-09-bug-offside-ring-after-goal.md`.

**The verbatim report** (`38-30-SUMMARY.md` Bug 1): "after goal is scored and player positions
are reset for kick off players still showed offsides rings when they should be reset."

**Evidence gathered by static analysis during planning:**

1. **The rendering path is `HexGrid.tsx`'s `isOffside` prop.** `isOffside={(offsidePieceIds ?? []).includes(piece.id)}`
   feeds `PieceOverlay`'s independent red-ring layer, reading `gameState.offsidePieceIds` straight
   from the server broadcast. There is no client-side offside derivation that could go stale on
   its own.
2. **Both live goal paths in `applyRoll`'s SHOT branch already clear the field.** The
   GK-out-of-range GOAL branch and the duel GOAL branch (`gameEngine.ts` lines 2687 and 2782) both
   set `offsidePieceIds: []` on the `KICK_OFF_SETUP` transition, each carrying the `BUG-06 / D-47`
   comment.
3. **Both reset paths are covered by passing regression tests.** The
   `BUG-06: offsidePieceIds reset on GOAL restart path (applyRoll SHOT branch)` describe block in
   `packages/server/src/__tests__/offside.test.ts` (line 1535), and the `D-47: both-ready
transition resets offsidePieceIds to []` test in
   `packages/server/src/__tests__/kickoffSetup.integration.test.ts` (line 446).
4. **There is no third goal path that could bypass the reset.** `grep -n "state.score\["
packages/server/src/gameEngine.ts` returns exactly the two scoring sites already covered above
   (plus one unrelated occurrence inside a differently-shaped event-replay branch) — no additional
   live scoring path exists.
5. **Replay cannot resurrect a stale live value either.** `buildReplayFrames`' seed object
   (`gameEngine.ts` line 7014 onward) does not include `offsidePieceIds` at all, so replay frames
   carry `undefined` and can never render an offside ring; and the client's `setGameState` replaces
   `gameState` wholesale rather than merging, so a replay frame cannot resurrect a stale live value
   either.

**Conclusion:** the root cause is NOT in the goal-to-kickoff reset code path as first assumed, and
it is NOT in any file touched by 38-25 through 38-29 (`applyCornerKickReposition`,
`applyAutomaticCornerClearOut`, `offside.ts`'s `CORNER_KICK_STAGES` docs, `ActionLog.tsx`,
`useGameStore.ts`, `HexGrid.tsx`'s corner arms, `CornerKickSetupPanel.tsx`, `EventBanner.tsx`). No
Phase 38 plan touches the offside lifecycle at all.

**Strongest lead for the follow-up:** this defect has the same signature as the long-pending
BUG-23 todo
(`.planning/todos/pending/2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`)
— server provably nulls/clears the field, yet the client renders it for the entire
`KICK_OFF_SETUP` phase. BUG-23 has been carried unresolved across four milestone closes. Treat a
shared root cause as the leading hypothesis for the follow-up investigation.

**Why deferring rather than fixing here:** root-causing needs live two-browser reproduction with
the exact scoring action captured, not a code edit — an open-ended investigation. Phase 38's
requirement set is OOB-03 and CORNER-01 through CORNER-06; none covers offside or kickoff.
Bundling an open-ended investigation into the final gap-closure round would block a phase that is
otherwise one surgical fix from closing.

**Route:** `/gsd-debug` against the tracked todo, or a Phase 39 bug-fix item. Explicitly NOT a
further Phase 38 gap-closure round.
