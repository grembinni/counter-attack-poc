---
phase: 30-recalibrate-draft
plan: 05
subsystem: api
tags: [typescript, vitest, socket.io, draft-session, draft-pool-allowlist]

# Dependency graph
requires:
  - phase: 30-recalibrate-draft
    plan: 02
    provides: Round-structured generateDraftPacks/generateMatchPacks (12 round-tagged 4-card packs)
  - phase: 30-recalibrate-draft
    plan: 03
    provides: Round-aware draftSession.ts (openNextRound, round-driven advanceSubStep, keeper-safety-net fully removed)
provides:
  - roomHandlers.ts wired to the round-aware draft session (openNextRound call site, checkKeeperSafety import and cycle-4 call block deleted)
  - Confirmed ROOM_SETTINGS_CONFIRM allow-list reads the widened (5-value) SELECTABLE_DRAFT_POOLS with no hardcoded pool literal — Legends/Icons now server-admitted (DRAFT-11)
  - Confirmed draftPacks.ts's generateMatchPacks needs no change (still a pure crypto.randomInt pass-through into the round-structured generateDraftPacks)
  - Rewritten draftPacks.test.ts, draftSession.integration.test.ts, draftReconnect.integration.test.ts for the 6-round/17-card model (cycle->round, 4-card packs, no keeper tier/mechanic)
  - Full server package green: tsc --noEmit 0 errors, vitest 612/613 passing (the 1 remaining failure is pre-existing/out-of-scope, see Deviations)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GK-slot role validation for card placement lives in roomHandlers.ts (both DRAFT_PICK and DRAFT_REARRANGE), never in draftSession.ts's applyPick/applyRearrange — unchanged pre-existing pattern, re-confirmed against the round model"
    - "Integration tests assert against DISTINCT bench-id sets (not raw array length) when checking bench-number map completeness — the same player's card can legitimately reappear in a different round's independently-generated pack under real crypto RNG (D-09/D-18 re-scoped to per-round only), so raw picks are not guaranteed globally unique"

key-files:
  created: []
  modified:
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/draftPacks.test.ts
    - packages/server/src/__tests__/draftSession.integration.test.ts
    - packages/server/src/__tests__/draftReconnect.integration.test.ts
    - packages/server/src/__tests__/room.integration.test.ts

key-decisions:
  - "draftPacks.ts required zero code changes — generateMatchPacks was already a pure crypto.randomInt-binding pass-through into generateDraftPacks; Task 1 only needed to verify this, per the plan's own instruction"
  - "lineupAssignment.integration.test.ts required zero changes for Task 3 — it is entirely Standard-mode (Phase 24) coverage with no draft/cycle/keeper coupling; the draft->lineup->game-start handoff coverage the plan's action text describes already lives in draftSession.integration.test.ts's 'Draft-mode LINEUP_CONFIRM roster resolution' describe block, updated in Task 2"
  - "Test (e)'s bench-number-map assertion in draftSession.integration.test.ts was reworked to key off the distinct bench-id Set rather than the raw benchIds array length, since D-09/D-18 (Plan 02) only guard against cross-pack duplication WITHIN a round — the same player's card can legitimately reappear (and be drafted) in a different round under real crypto RNG"

requirements-completed: [DRAFT-05, DRAFT-08, DRAFT-11]

# Metrics
duration: ~55min
completed: 2026-07-22
---

# Phase 30 Plan 05: Server Draft Wiring + Integration Test Recalibration Summary

**Wired the round-aware draft session into `roomHandlers.ts` (openNextRound, keeper-safety-net call block deleted) and rewrote all four server draft integration test suites for the 6-round/17-card/no-keeper-tier model, closing the cross-plan RED window and bringing `packages/server` to a fully green build/typecheck/test state (minus one pre-existing, out-of-scope failure).**

## Performance

- **Duration:** ~55 min active work
- **Tasks:** 3/3 completed
- **Files modified:** 5 (1 source file, 4 test files)

## Accomplishments

- `roomHandlers.ts`: removed the `checkKeeperSafety` import and the entire cycle-4 keeper-safety call block in the `DRAFT_PICK` handler (D-21 — superseded by the round-1 dedicated GK pack); renamed the `openNextPack` call site to `openNextRound` per Plan 03's export rename; updated `cycle`-referencing comments to `round`
- Confirmed the `ROOM_SETTINGS_CONFIRM` allow-list already reads the imported `SELECTABLE_DRAFT_POOLS` (now 5 values, widened by Plan 01) rather than any hardcoded pool literal — refreshed a stale comment that still claimed 3 values / Legends-Icons disabled
- Confirmed `draftPacks.ts` needs no change — `generateMatchPacks` remains a pure `crypto.randomInt` pass-through into the round-structured `generateDraftPacks`
- `draftPacks.test.ts` rewritten: asserts `generateMatchPacks` returns 12 round-tagged 4-card packs (round 1 GK-only, rounds 2-6 zero-GK) across `['original']`, `['original','mls','international']`, `['mls']`, `['international']`, and extends the no-throw backfill loop with dedicated Legends/Icons structural tests (D-08/D-10)
- `draftSession.integration.test.ts` fully rewritten: drives the `DRAFT_PICK` socket handler through the complete 6-round flow (2 picks round 1, 3 picks rounds 2-6), both sides reaching `draftComplete` with 17 drafted cards each (D-16), bench numbers assigned at completion; every `cycle` reference renamed to `round`; zero keeper-safety references remain; a new "ROOM_SETTINGS_CONFIRM draft-pool allow-list" describe block proves Legends/Icons acceptance and unknown-pool-id rejection (T-30-01)
- `draftReconnect.integration.test.ts`: `cycle`->`round` rename; reconnect-resend and CR-03 post-complete re-sync coverage carries over unchanged (no keeper coupling existed here)
- `room.integration.test.ts` (deviation, not in the plan's declared file list): inverted a stale Phase 27 test that asserted `'legends'` is rejected — now asserts acceptance, with a sibling test preserving unknown-pool-id rejection coverage
- Full server package verification: `pnpm --filter @counter-attack/server exec tsc --noEmit` — 0 errors; `pnpm --filter @counter-attack/server test` — 612/613 passing (1 pre-existing, out-of-scope failure, see Deviations); full monorepo `pnpm run typecheck` — 0 errors across shared/server/client

## Task Commits

Each task was committed atomically:

1. **Task 1: Round-aware roomHandlers wiring + draftPacks pass-through + allow-list confirm** - `142ab61` (feat)
2. **Task 2: Rewrite draftPacks + draftSession integration tests** - `311a39c` (test)
3. **Task 3: Rewrite draftReconnect integration tests** - `25b6419` (test)
4. **Deviation fix: invert stale room.integration.test.ts legends-rejected test + log deferred items** - `323597a` (fix)

## Files Created/Modified

- `packages/server/src/roomHandlers.ts` - openNextRound wiring, checkKeeperSafety import + cycle-4 call block removed, stale allow-list comment refreshed
- `packages/server/src/__tests__/draftPacks.test.ts` - Round-tagged 4-card pack structural invariants, Legends/Icons backfill tests
- `packages/server/src/__tests__/draftSession.integration.test.ts` - Full 6-round DRAFT_PICK/DRAFT_REARRANGE flow, allow-list describe block, cycle->round rename, zero keeper references
- `packages/server/src/__tests__/draftReconnect.integration.test.ts` - cycle->round rename in mid-draft reconnect coverage
- `packages/server/src/__tests__/room.integration.test.ts` - Inverted the Phase 27 legends-rejected test to legends-accepted + unknown-pool-rejected

## Decisions Made

- `draftPacks.ts` and `lineupAssignment.integration.test.ts` required zero code changes for this plan — both were already correct/unrelated to the round model (see key-decisions above for the reasoning on each)
- Reworked one of my own draftSession.integration.test.ts assertions (bench-number-map key count) after discovering via real crypto RNG that the same player's card can legitimately be drafted twice across different rounds (D-09/D-18 only guard within-round duplication, not match-wide) — verified this is a documented Plan 02 design decision, not a regression, before adjusting the assertion rather than "fixing" the underlying engine

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworked an over-strict bench-number-map assertion in my own new test**

- **Found during:** Task 2, verifying the full `draftSession.integration.test.ts` suite (not just the acceptance-criteria commands)
- **Issue:** My initial test (e) asserted `Object.keys(view.benchNumbers).length === view.benchIds.length`, assuming all 17 raw picks per side are globally-distinct card ids. Under real crypto RNG this failed (`16` vs `17`) because Plan 02's pack generation only guards against cross-pack duplication WITHIN a round (D-09 re-scoped) — the same player's card can legitimately be dealt into, and drafted from, a different round's independently-generated pack, producing a genuine duplicate id in the raw `benchIds` array (which collapses to one key in the `Record<string,number>` bench-number map).
- **Fix:** Verified this is Plan 02's documented, accepted design property (its own SUMMARY states "a card CAN legitimately reappear in a different round"), then reworked the assertion to key off `new Set(view.benchIds)` instead of the raw array.
- **Files modified:** `packages/server/src/__tests__/draftSession.integration.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test draftSession.integration` passes consistently across 3 repeated runs with real crypto RNG
- **Committed in:** `311a39c` (Task 2 commit)

**2. [Rule 1 - Bug] Inverted a stale Phase 27 test asserting removed behavior**

- **Found during:** Full server test-suite run after Tasks 1-3 (`pnpm --filter @counter-attack/server test`)
- **Issue:** `room.integration.test.ts` (Phase 27, not in this plan's `files_modified`) had a test `"draftPools allow-list rejects 'legends' even though it is a valid DraftPoolId (T-27-02)"` asserting `INVALID_DRAFT_POOL` for a Legends selection. Since Plan 01 widened `SELECTABLE_DRAFT_POOLS` to 5 values and this plan's Task 1 confirmed `roomHandlers.ts` reads that widened constant (D-08), the test asserted behavior the phase deliberately removes (RESEARCH.md Pitfall 8) and failed the plan's own "server test suite fully green" verification bar.
- **Fix:** Inverted the test to assert acceptance (`ROOM_SETTINGS_CONFIRMED` with `draftPools: ['legends']`), and added a sibling test preserving the "unknown pool id still rejected" coverage the original test's title implied.
- **Files modified:** `packages/server/src/__tests__/room.integration.test.ts`
- **Verification:** `pnpm --filter @counter-attack/server test room.integration` — 15/15 passing
- **Committed in:** `323597a`

---

**Total deviations:** 2 auto-fixed (2 bug fixes — both test-correctness issues surfaced while verifying the plan's own success criteria, no scope creep beyond what was necessary to satisfy them)
**Impact on plan:** Necessary to satisfy the plan's own "server test suite fully green" verification bar. No production/engine code was touched by either fix — both are test-assertion corrections.

## Issues Encountered

- Worktree had no `node_modules` at session start — resolved with a standard `pnpm install --frozen-lockfile` at the repo root, then `pnpm --filter @counter-attack/shared run build` to produce the `dist/` output the server package resolves `@counter-attack/shared` against.
- Two pre-existing, **out-of-scope** failures were discovered while verifying the full monorepo test suite (per the parallel-execution note asking me to confirm the full monorepo build/test goes green as my own check) and were logged to `.planning/phases/30-recalibrate-draft/deferred-items.md` rather than fixed, per the executor's scope-boundary rule:
  1. `packages/server/src/__tests__/gameHandlers.rule11.test.ts` — 1 deterministic failure (`RULE-02: GAME_HEADER_CONTESTANT` duel test), zero draft/cycle/keeper coupling, untouched since Phase 27. Root cause is very likely Plan 01's broad CSV stat rebalance shifting the fixture pieces' aerial-duel stats so the mocked constant dice roll no longer produces the outcome the test's stale comment assumes.
  2. `packages/client` — 7 failures across `ActionLog.test.tsx` (6) and `PlayerStatsPanel.test.tsx` (1), all collateral from Plan 01's City roster swap (the removed player `'Sang-bin Jeong'` is hardcoded into several fixtures) and stat rebalance. Entirely outside `packages/server` and this plan's declared scope.
  - **Server package itself (this plan's actual scope) is fully green** except for item 1 above, which is unrelated to any file this plan touches.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `packages/server` typechecks cleanly (`tsc --noEmit`, 0 errors) and its test suite is green apart from the one pre-existing, unrelated `gameHandlers.rule11.test.ts` failure logged in `deferred-items.md`.
- The full monorepo (`pnpm run typecheck`) is 0 errors across shared/server/client.
- Outstanding, out-of-scope work for a future bug-bash/quick-task: re-pin `gameHandlers.rule11.test.ts`'s duel-outcome assumption and the 7 `packages/client` fixture failures (hardcoded removed player name + stat thresholds) against the finished Phase 30 CSV data — all traced to Plan 01's player-pool rebalance, not this plan's server-wiring work.
- This plan closes the phase's server-side "cross-plan RED window" — Phase 30's remaining plan(s), if any, can build on a fully-typechecking, round-aware server package.

---

_Phase: 30-recalibrate-draft_
_Completed: 2026-07-22_
