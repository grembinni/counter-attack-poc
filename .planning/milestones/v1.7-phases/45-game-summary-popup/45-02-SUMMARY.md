---
phase: 45-game-summary-popup
plan: 02
subsystem: api
tags: [socket-io, xg-formula, match-stats, server-authoritative, vitest]

# Dependency graph
requires:
  - phase: 45-game-summary-popup (plan 01)
    provides: "MatchStats type, EMPTY_MATCH_STATS, computeShotXg, recordShotInStats, RefereeCard.wasManualOverride — all defined in @counter-attack/shared"
provides:
  - "GameState.matchStats seeded at kickoff and carried verbatim into every replay frame"
  - "refereeCard.wasManualOverride recorded once at match start (STATS-03 Manual/Auto distinction)"
  - "Shot count (STATS-07) and accumulated xG (STATS-08) captured at all seven logical shot-resolution sites across gameEngine.ts and gameHandlers.ts"
affects: [45-03, 45-04, 45-05, 45-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "xG/shot capture is hoisted to a single local (or pair of locals) immediately after the shooter/GK lookup guards, computed from PRE-reset state.pieces, then threaded into every terminal return object of that branch — never deferred to a later diff or broadcast-time read (45-RESEARCH.md Pitfall 2)"
    - "Handler-level sites with an undefined shooter lookup skip the capture entirely (matchStats passed through via `?? EMPTY_MATCH_STATS` for exactOptionalPropertyTypes) rather than fabricating a shot hex"

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.matchStats.test.ts
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/refereeLeniency.integration.test.ts

key-decisions:
  - "PD-07 confirmed in code: GK-dive-at-feet is not a distinct xG-capture site — a foul awarded via that source already flows through the single applyPenaltyKickDuel hook (S2), so no eighth site was built"

patterns-established:
  - "Pattern: whole-match GameState counter fields carried into buildReplayFrames's seeded literal use `?? false`/`?? EMPTY_MATCH_STATS` fallbacks (mirrors the pre-existing outOfBoundsEnabled convention) to satisfy exactOptionalPropertyTypes when the source field is itself optional"

requirements-completed: [STATS-03, STATS-07, STATS-08]

# Metrics
duration: ~2h (including a mid-task connection-error resume)
completed: 2026-08-28
---

# Phase 45 Plan 02: Server-Side Shot/xG Instrumentation Summary

**Instrumented all seven logical shot-resolution sites across `gameEngine.ts` (SHOT duel, penalty duel) and `gameHandlers.ts` (snapshot/declared-shot deflection, three GK-out-of-range auto-goals) so `GameState.matchStats.shots`/`.xg` accumulate correctly per team, using pre-reset defender positions even on goal-scoring shots.**

## Performance

- **Duration:** ~2h (spanning a connection-error interruption mid-task-2; resumed and verified against the plan before continuing)
- **Completed:** 2026-08-28T20:01:07Z
- **Tasks:** 3/3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `buildInitialGameState` seeds `matchStats: EMPTY_MATCH_STATS` and records `refereeCard.wasManualOverride` from the existing `refereeLeniencyOverrideEnabled` parameter, so the settings recap can distinguish `(Referee Leniency: Manual — 4)` from `(Referee Leniency: Auto — 4)`.
- `buildReplayFrames` carries `matchStats`, `foulsEnabled`, `bookingEnabled`, `injuryEnabled`, and `tackleStealDeclineEnabled` verbatim from `finalState` into every replay frame — the match summary now shows real stats and the correct settings recap throughout post-full-time replay, not zeros.
- `applyRoll`'s `case 'SHOT'` (S1) and `applyPenaltyKickDuel` (S2) each hoist a single `computeShotXg`/`recordShotInStats` pair immediately after their shooter/GK guards, using `state.pieces` before any goal-branch pieces-reset, and thread the result into all five physical `case 'SHOT'` return objects and all three `PENALTY_KICK` return objects.
- Five handler-level sites in `gameHandlers.ts` — snapshot deflection (S3), snapshot GK-out-of-range (S4), declared-shot deflection (S5), declared-shot GK-out-of-range (S6), and headed-shot GK-out-of-range (S7) — each capture xG/shots at their single per-shot state write, since a blocked shot never produces a `SHOT_ATTEMPT` event and would otherwise be invisible to the stats.
- 36 new tests across `gameEngine.matchStats.test.ts` (15 pure-function tests for S1/S2, 21 Socket.io integration tests for S3-S7 plus an explicit no-double-count regression) — including a dedicated Pitfall 2 regression proving a goal recorded from a crowded six-yard box records the crowded (correct) xG, not a sparse/kickoff-formation value.
- Grep-count acceptance criteria all verified: `computeShotXg` exactly 2 in `gameEngine.ts`, `recordShotInStats`/`computeShotXg` exactly 5 each in `gameHandlers.ts`, no `matchStats` write inside either `DEFLECT_ATTEMPT` event literal or inside `applyGkDiveAtFeetTarget`.

## Task Commits

Each task was committed atomically:

1. **Task 45-02-01: Seed matchStats at kickoff, record the Leniency override source, and carry both into replay frames** - `0cb10c45` (feat)
2. **Task 45-02-02: Capture shots and xG at the SHOT duel and the penalty duel (S1, S2)** - `8e782cd7` (feat)
3. **Task 45-02-03: Capture shots and xG at the five handler-level shot branches (S3-S7)** - `b6410b7f` (feat)

## Files Created/Modified

- `packages/server/src/gameEngine.ts` - `buildInitialGameState` seeds `matchStats`/`refereeCard.wasManualOverride`; `buildReplayFrames` carries 5 fields into replay; `applyRoll` case `'SHOT'` and `applyPenaltyKickDuel` hoist xG/shot capture above every branch and write `matchStats` into all 8 physical return sites (5 + 3)
- `packages/server/src/gameHandlers.ts` - Five handler-level capture sites (S3-S7): snapshot/declared-shot deflection early returns and the three GK-out-of-range auto-goal branches (snapshot, declared shot, header)
- `packages/server/src/__tests__/gameEngine.matchStats.test.ts` - New file: 15 pure engine-function tests (S1/S2) + 21 Socket.io integration tests (S3-S7, no-double-count) = 36 tests
- `packages/server/src/__tests__/refereeLeniency.integration.test.ts` - Updated a pre-existing strict `refereeCard` key allow-list assertion to include the new, intentional `wasManualOverride` field

## Decisions Made

None beyond the plan's own instructions, which were followed verbatim. PD-07 (GK-dive-at-feet is not a distinct xG-capture site) was confirmed correct in code: `applyGkDiveAtFeetTarget` never produces a goal/shot event itself, and any foul it triggers already routes through the single `applyPenaltyKickDuel` hook — grep-verified zero `matchStats`/`computeShotXg` occurrences inside that function.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a scoping bug introduced mid-edit: `defTeam` referenced out of scope at site S5**
- **Found during:** Task 45-02-03, while wiring the declared-shot deflection capture (S5)
- **Issue:** The plan's site-inventory table names `defTeam` as "already in scope" at S5, but `defTeam` is actually declared inside the `if (shotShooter && shotPathTarget)` block that only wraps the deflection-input-gathering loop — it is out of scope at the DEFLECTED early-return site where the capture needed to run. Caught immediately by `pnpm --filter @counter-attack/server typecheck` (`TS2304: Cannot find name 'defTeam'`).
- **Fix:** Recomputed the defending team inline at the capture site (`shotDeflectDefTeam`), using the identical derivation (`declaredState.attackingTeam === 'home' ? 'away' : 'home'`) already used elsewhere in the same handler.
- **Files modified:** `packages/server/src/gameHandlers.ts`
- **Verification:** `pnpm --filter @counter-attack/server typecheck` exits 0; the S5 test in `gameEngine.matchStats.test.ts` passes.
- **Committed in:** `b6410b7f` (Task 3 commit)

**2. [Rule 1 - Bug] Updated a pre-existing test whose strict assertion became stale due to this plan's own schema change**
- **Found during:** Task 45-02-03, full-suite regression run
- **Issue:** `refereeLeniency.integration.test.ts` (Phase 44) asserted `Object.keys(state.refereeCard)` equals exactly `['leniency']`. Task 45-02-01 deliberately added `refereeCard.wasManualOverride` per STATS-03/Pitfall 3 — the exact fix that pitfall recommended — so this assertion now fails, correctly flagging the schema change but with a test that predates and doesn't anticipate it.
- **Fix:** Updated the assertion to expect both `['leniency', 'wasManualOverride']` and added a positive assertion that `wasManualOverride` reflects the override flag, with a comment explaining this is an intentional second field, not a smuggled duplicate.
- **Files modified:** `packages/server/src/__tests__/refereeLeniency.integration.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test -- refereeLeniency.integration` passes (6/6); full server suite green.
- **Committed in:** `b6410b7f` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs, both caught by typecheck/test runs during the same task, not scope creep)
**Impact on plan:** Both fixes were necessary to land a working, green build for exactly the site inventory and schema changes the plan specified. No functionality beyond the plan's scope was added.

## Issues Encountered

- **Windows vitest worker-crash flake:** `pnpm --filter @counter-attack/server test` (default pool) intermittently reports `Error: Worker exited unexpectedly` on this machine, unrelated to any code change here (documented in the user's own project memory as a known Windows quirk). Re-running with `pnpm --filter @counter-attack/server exec vitest run --pool=forks` confirmed all 68 files / 1595 tests green with no regressions.
- **Snapshot/declared-shot deflection fixture geometry (S3/S5):** Initial fixtures placed the shooter too close to goal, causing the deflected ball's landing hex to fall inside the defending penalty area and trigger a legitimate downstream `GK_BOX_ENTRY_PROMPT` interrupt (Phase 39 behavior) instead of terminating at `LOOSE_BALL`. Resolved by widening S5's shooter distance to stay outside the box (regular shots have an 11-hex range gate vs. snapshot's 6-hex gate, so S5 could avoid the box entirely) and relaxing S3's phase assertion to accept either terminal phase, since `matchStats` is already written into the state before that downstream check runs and is unaffected by which phase ultimately wins.
- **Mid-task connection interruption:** Execution was interrupted by a connection error partway through Task 45-02-02's test-file authoring. On resume, the uncommitted `gameEngine.ts` diff was independently re-verified against the plan (grep counts, typecheck) before continuing — no rework was needed, the engine instrumentation was already complete and correct.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `GameState.matchStats.shots`/`.xg` are now correctly and completely populated by every shot a player takes, in every branch, at both engine sites and all five handler sites — ready for the remaining Wave 2 plans (broadcast/possession reducer, client rendering) to consume as an already-authoritative source.
- `refereeCard.wasManualOverride` and the five replay-carried fields (`matchStats`, `foulsEnabled`, `bookingEnabled`, `injuryEnabled`, `tackleStealDeclineEnabled`) are ready for the settings-recap component to read directly, in both live and replay contexts.
- No `ActionEvent` type or field was added (PD-05 preserved), so no Undo/Replay/ActionLog registration checklist was triggered by this plan.
- Full server suite green (1595 tests, 68 files, `--pool=forks`); shared suite unaffected (902 tests, untouched by this plan's scope); `pnpm --filter @counter-attack/server typecheck` and the server ESLint config both clean.

---
*Phase: 45-game-summary-popup*
*Completed: 2026-08-28*
