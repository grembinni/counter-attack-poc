# Deferred Items — Phase 30 (recalibrate-draft)

Out-of-scope discoveries logged during plan execution, per the executor's scope-boundary
rule (fix only issues directly caused by the current task's changes).

## Plan 05

- **`packages/server/src/__tests__/gameHandlers.rule11.test.ts`** — the test
  `RULE-02: GAME_HEADER_CONTESTANT — both-confirmed auto-fires duel > immediately transitions
to PASS or LOOSE_BALL when both teams confirm (Bug 4 fix)` fails deterministically
  (`expected [ 'PASS', 'GK_DIVE', 'LOOSE_BALL' ] to include 'HEADER'`), reproduced across 4
  consecutive runs (not RNG flake — dice are mocked to a constant value in this file).
  - This file has zero references to `cycle`/`keeper`/`draft`/`PACKS_PER_MATCH`/
    `PACK_COMPOSITION` and was last modified in Phase 27 (`git log` confirms), well outside
    Plan 05's declared `files_modified` list and the orchestrator's documented known-broken
    surface (`roomHandlers.ts` + the four draft test files).
  - Root cause is very likely Plan 01's player-pool CSV stat rebalance (broad attribute value
    changes across nearly all players, landed in this worktree's base commit) shifting the
    `homeAttacker`/`awayDefender` fixture pieces' aerial-duel stats such that the mocked
    constant dice roll (`rollDice() => 3`) no longer produces the tie/decisive outcome the
    test's stale comment assumes ("any two contestants with equal heading produce equal raw
    scores"). This is collateral from an earlier plan's data change, not something Plan 05's
    task scope (round-aware `roomHandlers.ts` wiring + draft test rewrites) touches.
  - **Not fixed here** — logged per the scope-boundary rule. Recommend a follow-up quick-task
    or bug-bash pass to re-pin `seedHeaderReadyForContestants`'s fixture pieces (or the test's
    stat-equality assumption) against the rebalanced CSV data.

- **`packages/client` — 7 pre-existing test failures across 2 files**, found while running
  the full monorepo test suite as this plan's own "everything green" check (per the
  orchestrator's parallel-execution note). Plan 05's `files_modified` is server-only; these
  are `packages/client` collateral from Plan 01's player-pool CSV rebalance (City roster
  swap: Sang-bin Jeong removed, Carlo Holse added) — out of scope for a server-wiring plan.
  - `src/components/ActionLog.test.tsx` (6 failures): several fixtures hardcode the now-removed
    player name `'Sang-bin Jeong'` (e.g. `expected 'ACTION LOG[HEADER ✓] ATTACKER WINS — …' to
match /#\d+\s+Sang-bin Jeong/`, actual rendered name is `Carlo Holse`) or otherwise assert
    on stat-derived duel outcomes (`[TACKLE ✓]`, `[SHOT ✓]`) that changed once the City/Crew
    roster stats were rebalanced.
  - `src/components/PlayerStatsPanel.test.tsx` (1 failure): `renders the correct attribute
value from gameState.pieces` — `expected 1 to be greater than or equal to 2`, a stat
    threshold assertion invalidated by the CSV rebalance.
  - **Not fixed here** — same rationale: caused by Plan 01's data changes, not Plan 05's
    server-wiring task, and in a different package entirely. Recommend a follow-up
    bug-bash/quick-task to re-pin these client fixtures (player names + stat thresholds)
    against the finished Phase 30 CSV data, alongside the `gameHandlers.rule11.test.ts` item
    above (likely the same root cause: Plan 01's broad stat rebalance).
