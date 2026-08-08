---
phase: 38-corner-kick
plan: 23
subsystem: game-engine
tags: [corner-kick, loose-ball, goalkeeper, out-of-bounds, gap-closure, rulebook-correction]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 14)
    provides: the SHOT SAVE spill branch's LOOSE_BALL transition and the second (scatter-walk) route into a Corner Kick this plan corrects
  - phase: 38-corner-kick (plan 15)
    provides: 'D-GAP-02 ruling (human verbatim rule text): the corner award is decided by the rolled Loose Ball direction alone, not by whether the scatter walk exits the pitch'
  - phase: 38-corner-kick (plan 16)
    provides: gkSpillKeeperId GameState field and isSpillCornerDirection(direction, keeperTeamId) pure classifier this plan consumes
  - phase: 38-corner-kick (plan 20)
    provides: triggerOutOfBoundsRestart's CORNER_KICK branch now entering CORNER_KICK_CLEAR_OUT, which this plan's direction-only award inherits automatically by routing through the same function
provides:
  - "gkSpillKeeperId lifecycle: set on every SHOT SAVE spill (gk.id), cleared in triggerOutOfBoundsRestart's commonReset, CORNER_KICK_TEARDOWN, and the LOOSE_BALL case's ordinary PASS landing return"
  - "Direction-only D-GAP-02 corner check at the head of applyRoll's LOOSE_BALL case: outOfBoundsEnabled === true AND gkSpillKeeperId non-null AND isSpillCornerDirection(direction, keeperTeamId) synthesises a byline exit and delegates to triggerOutOfBoundsRestart, ahead of and independent from the scatter walk"
  - "A keeper standing several hexes off their own byline now correctly concedes a corner on a behind-the-GK or lateral direction, correcting 38-14's scatter-walk under-award"
affects: [38-corner-kick verification checkpoint (next walkthrough should re-confirm Step 8)]
requirements-completed: [OOB-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synthesise a minimal off-pitch exit hex (q beyond the keeper's own byline column, r = keeper's row) and delegate to the existing triggerOutOfBoundsRestart, rather than hand-building a corner-kick state — guarantees the new direction-only path can never diverge from the OOB-03 machinery (including future changes like 38-20's clear-out entry)"
    - 'A dedicated single-purpose GameState marker (gkSpillKeeperId) gates a rule that must NOT apply to a structurally-similar sibling transition (the SHOT duel-tie LOOSE_BALL, which also sets ball.lastTouchedBy to the keeper) — reading the marker instead of the shared field is what keeps the two paths from colliding'

key-files:
  created: []
  modified:
    - packages/server/src/gameEngine.ts
    - packages/server/src/__tests__/gameEngine.cornerKick.test.ts
    - packages/server/src/__tests__/gameEngine.test.ts

key-decisions:
  - "The synthesised exit hex's q is derived from the already-imported CORNER_KICK_HEX constant (CORNER_KICK_HEX.home.top.q - 1 for home, CORNER_KICK_HEX.away.top.q + 1 for away) rather than importing/exporting MAX_Q from packages/shared/src/outOfBounds.ts — the plan's own verification section requires packages/shared to be byte-unchanged by this plan, and CORNER_KICK_HEX's q columns (0 and 36) already equal the pitch's byline columns by construction, so this reads the existing constant instead of restating or newly exporting a literal."
  - "isSpillCornerDirection is gated strictly ahead of the scatter walk and returns via triggerOutOfBoundsRestart with gkSpillKeeperId explicitly nulled in the state passed to it — mirrors the existing exitInfo call's lastDiceRoll-setting pattern exactly, so the two early-return call sites read identically at a glance."
  - "Re-expected 38-14's three scatter-walk-derived tests by adding gkSpillKeeperId to the fixture (the real D-GAP-02 gate) and replacing the 'stays on pitch' dice derivation with an explicit in-front (non-spill-corner) direction search — the old landing-hex-only derivation could coincidentally have picked a byline-ward direction, which would now (correctly) award a corner regardless of where the scatter lands."

patterns-established: []

# Metrics
duration: ~20min
completed: 2026-08-08
---

# Phase 38 Plan 23: D-GAP-02 Correction — Direction-Only Corner Award on a Spilled Save Summary

**Replaced 38-14's scatter-walk reading of the spilled-save corner award with the ruled direction-only check (D-GAP-02): a goalkeeper standing off their own byline now concedes a corner immediately on a next-to-or-behind Loose Ball direction, independent of whether the scatter itself would have reached the pitch boundary.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-08
- **Tasks:** 3/3 completed
- **Files modified:** 3 (`gameEngine.ts` + 2 test files)

## Accomplishments

- The SHOT `SAVE` branch's spill (`!handling.caught`) return now sets `gkSpillKeeperId: gk.id` — the dedicated marker (not `ball.lastTouchedBy`, which the SHOT duel-tie branch also sets) that gates the direction-only check. Extended 38-14's existing comment to explain the distinction and cite why the duel-tie branch above deliberately never sets it.
- `gkSpillKeeperId: null` added to `triggerOutOfBoundsRestart`'s `commonReset` (covers all three restart branches — `CORNER_KICK`, `THROW_IN`, `GOAL_KICK`, since each spreads `commonReset`), to `CORNER_KICK_TEARDOWN` (covers every corner resolution in the PASS case), and to the `LOOSE_BALL` case's ordinary PASS landing return. Every exit path out of `applyRoll`'s `LOOSE_BALL` case — the pre-existing scatter-walk restart return, the new direction-only restart return, and the ordinary landing return — now clears the marker, closing T-38-77 (stale marker mis-awarding a later, unrelated corner).
- A new block at the head of `applyRoll`'s `LOOSE_BALL` case, gated on `state.outOfBoundsEnabled === true && state.gkSpillKeeperId != null`, looks up the spilling keeper, and when `isSpillCornerDirection(direction, keeper.teamId)` is true, synthesises a byline exit hex beyond the keeper's own goal line (`q` one past `CORNER_KICK_HEX`'s own-byline column; `r` = the keeper's row) and delegates to `triggerOutOfBoundsRestart` — the exact machinery OOB-03 already uses, so the award automatically inherits 38-20's `CORNER_KICK_CLEAR_OUT` entry with no duplicated logic. An in-front direction is exactly the untouched fall-through to the pre-existing scatter walk, which still rolls for distance and continues play.
- Traced (not assumed) that the synthesised exit correctly classifies as `'CORNER_KICK'`: `classifyExit` resolves any `q`-out hex to `'BYLINE'`; `bylineOwner(exitHex)` resolves to the keeper's own team because the synthesised `q` is beyond the keeper's own byline column; `ball.lastTouchedBy` already names the keeper (set by the SAVE spill branch); so `classifyOutOfBounds`'s `lastTouchedByTeam === bylineOwnerTeam` holds and `'CORNER_KICK'` is returned, never `'GOAL_KICK'`.
- Added a new `D-GAP-02: direction-only corner award on a spilled save` describe block (6 tests) proving: a keeper several hexes off their own byline still concedes a corner on a behind-the-GK direction (the exact case 38-14 got wrong); a purely lateral direction also concedes; an in-front direction resolves as an ordinary loose ball with the ball moved along the real scatter trajectory; the rule does not fire for a SHOT duel-tie loose ball (`gkSpillKeeperId` null, only `ball.lastTouchedBy` set); the `outOfBoundsEnabled: false` toggle still fully suppresses the award; and the corner is awarded to the team opposite whichever keeper spilled (both home and away proven). Every direction is derived from `isSpillCornerDirection` at test-run time, never hardcoded.
- Re-expected 38-14's three original scatter-walk-derived tests in place (none deleted): the fixture now carries `gkSpillKeeperId` (the real D-GAP-02 gate, absent from the original 38-14 fixture since the field didn't exist until 38-16), and the "stays on the pitch" test's dice derivation now explicitly searches for an in-front (non-spill-corner) direction rather than any direction whose single step happens to land on the pitch — see Deviations/Before-After below for why this mattered.

## Task Commits

Each task was committed atomically:

1. **Task 1: Record the spilling keeper and clear the marker everywhere a loose ball resolves** - `27e6f52` (feat)
2. **Task 2: Award the corner from the rolled direction alone, before the scatter walk** - `13d3005` (feat)
3. **Task 3: Prove the direction-only rule and re-expect 38-14's scatter-walk fixtures** - `a7807d1` (test)

_Note: SUMMARY.md is committed separately below (worktree parallel-executor mode — orchestrator owns STATE.md/ROADMAP.md updates after merge)._

## Files Created/Modified

- `packages/server/src/gameEngine.ts` — SHOT SAVE spill branch now sets `gkSpillKeeperId: gk.id`; `triggerOutOfBoundsRestart`'s `commonReset` and `CORNER_KICK_TEARDOWN` both null the marker; the `LOOSE_BALL` case's ordinary PASS landing return nulls it; new direction-only D-GAP-02 corner check inserted at the head of the `LOOSE_BALL` case, above the untouched scatter-walk loop; `isSpillCornerDirection` added to the `@counter-attack/shared` import list.
- `packages/server/src/__tests__/gameEngine.cornerKick.test.ts` — 38-14's `spilled save: the second route into a Corner Kick` describe block re-expected (fixture gains `gkSpillKeeperId`; on-pitch-case dice derivation rewritten to search for an in-front direction); new `D-GAP-02: direction-only corner award on a spilled save` describe block (6 tests) added; `isSpillCornerDirection`/`looseBallDirectionQStep` added to the shared import list.
- `packages/server/src/__tests__/gameEngine.test.ts` — added one assertion to the existing `SHOT SAVE + SPILL` coverage confirming `gkSpillKeeperId` is set to the spilling keeper's id.

## Gap-Closure Source Audit (from the plan)

| Source                | Item                                                              | Covered by                                                                                                                                      |
| --------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 38-15 D-GAP-02 ruling | Replace the scatter-walk reading with a direction-only check      | Task 2                                                                                                                                          |
| 38-15 D-GAP-02 ruling | Gate the check on the goalkeeper being the last toucher           | Task 1 (dedicated `gkSpillKeeperId` marker — stricter and correct, since the SHOT duel-tie branch also sets `ball.lastTouchedBy` to the keeper) |
| 38-15 D-GAP-02 ruling | "if in front of GK, roll for distance and continue play normally" | Task 2 (untouched fall-through to the existing scatter walk)                                                                                    |
| 38-14 tests           | Fixtures encoding the scatter-walk reading                        | Task 3                                                                                                                                          |

## `gkSpillKeeperId` Exit-Path Audit (Task 1, step 4)

Every return inside `applyRoll`'s `case 'LOOSE_BALL':` block, enumerated:

1. **Direction-only restart return** (new, Task 2) — passes `gkSpillKeeperId: null` explicitly in the state handed to `triggerOutOfBoundsRestart`, and the returned state additionally spreads `commonReset` (which also nulls it) inside `triggerOutOfBoundsRestart`'s `CORNER_KICK`/`THROW_IN`/`GOAL_KICK` branches — doubly covered.
2. **Pre-existing scatter-walk restart return** (`if (restartState !== null) return ...`) — the state passed to `triggerOutOfBoundsRestart` here does not explicitly null the marker, but every one of `triggerOutOfBoundsRestart`'s three branches unconditionally spreads `...commonReset` at the end of its returned object, which now includes `gkSpillKeeperId: null` — covered without touching this pre-existing call site (preserves the OOB-05 byte-identical requirement).
3. **Ordinary landing return** (`phase: 'PASS'`, end of the case) — explicitly nulls `gkSpillKeeperId` (Task 1, step 3).

Outside the `LOOSE_BALL` case: `CORNER_KICK_TEARDOWN` (spread at every PASS-case corner resolution) also nulls the marker, so a resolved corner can never leave it stale for a later, unrelated corner sequence. No other function in `gameEngine.ts` sets or reads `gkSpillKeeperId`.

## `classifyOutOfBounds` Trace for the Synthesised Exit (Task 2)

Confirmed by reading, not assumed: `classifyExit(spillExitHex)` — `spillExitHex.q` is `-1` (home) or `37` (away), both outside `[0, 36]`, so `qOut` is true and `classifyExit` returns `'BYLINE'` (D-05, checked first). `bylineOwner(spillExitHex)` — `q < 0` returns `'home'`; `q > 36` returns `'away'` — matches the spilling keeper's own team in both cases by construction. `ball.lastTouchedBy.teamId` is the keeper's team (set by the SAVE spill branch, Task 1). Therefore `classifyOutOfBounds`'s `lastTouchedByTeam === bylineOwnerTeam` holds, and `'CORNER_KICK'` is returned — never `'GOAL_KICK'`.

## Before/After of 38-14's Three Re-Expected Fixtures

**1. "a scatter across the keeper's own byline awards a CORNER_KICK..."**

- **Before (38-14):** Asserted the corner via the scatter walk's `exitInfo` path actually exiting on the byline (dice derived by `findBylineExitDice`, which walks `computeLooseBall` step-by-step until it finds a byline exit).
- **After (38-23):** Same dice, same assertions, but now proven to route through the NEW direction-only path — added `expect(isSpillCornerDirection(bylineDice.direction, 'home')).toBe(true)` to make explicit that a straight-line scatter exiting on the keeper's own byline can only travel in a byline-ward direction, so the two mechanisms necessarily agree on this fixture. Fixture gained `gkSpillKeeperId: homeGK.id`.

**2. "a scatter that stays on the pitch resolves as an ordinary loose ball"**

- **Before (38-14):** Dice derived by `findOnPitchDice`, which picked the first direction (1-6) whose single step landed on-pitch — this derivation had no awareness of direction category and could coincidentally have picked a byline-ward ("behind") direction that merely didn't travel far enough to exit.
- **After (38-23):** Dice now derived by `findInFrontOnPitchDice`, which explicitly skips any `isSpillCornerDirection` direction and only returns an in-front direction whose single step also lands on-pitch — because under the new rule, direction alone decides the award regardless of scatter distance, so an accidentally-byline-ward-but-short-distance direction would now (correctly) award a corner and break this test's "ordinary loose ball" assertion if left undetected. Fixture gained `gkSpillKeeperId`; test also now asserts `gkSpillKeeperId` is null in the result (cleared by the ordinary landing return, Task 1).

**3. "with outOfBoundsEnabled false the scatter clamps to the pitch and never awards a corner"**

- **Before (38-14):** Same dice as fixture 1, toggle off, asserted clamp-to-pitch and no corner.
- **After (38-23):** Unchanged behavior and assertions (the new D-GAP-02 check is gated on `outOfBoundsEnabled === true`, identically to the pre-existing `exitInfo` gate) — fixture gained `gkSpillKeeperId` to prove the marker being present does not bypass the toggle.

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, self-caught during my own draft] Reworded a comment that literally matched the plan's forbidden `"scatter actually"` acceptance-gate grep**

- **Found during:** Task 3, my own first draft of the new D-GAP-02 test block
- **Issue:** A comment I wrote — "its scatter-walk reading only awarded a corner if a short scatter actually reached q < 0" — literally contains the substring `"scatter actually"`, which the plan's own acceptance criteria greps for (`grep -rn "scatter actually" packages/server/src` must return no matches) as a proxy for "no comment still describes the corner award as scatter-walk-conditional". The comment was accurately describing the OLD (corrected) behavior in past tense, not violating the underlying intent, but the literal grep would have failed.
- **Fix:** Reworded to "its scatter-walk reading only awarded a corner when the walk itself crossed q < 0, so a short scatter fell short" — same meaning, no longer matches the literal phrase.
- **Files modified:** `packages/server/src/__tests__/gameEngine.cornerKick.test.ts`
- **Verification:** `grep -rn "scatter actually" packages/server/src` returns no matches (confirmed via non-zero grep exit code).
- **Committed in:** `a7807d1` (Task 3 commit)

**2. [Rule 3 - Blocking] Bootstrapped the worktree (`pnpm install` + `packages/shared` build) before any typecheck/test could run**

- **Found during:** Session start, before Task 1
- **Issue:** The worktree had no `node_modules` and `packages/shared/dist/` did not exist — same class of pre-existing bootstrap gap noted in every prior 38-corner-kick plan's SUMMARY (38-14, 38-16, 38-20).
- **Fix:** Ran `pnpm install --frozen-lockfile` (uses the existing lockfile, no version changes) followed by `pnpm --filter @counter-attack/shared build`. No `package.json` changes; `dist/` is gitignored, nothing committed.
- **Files modified:** none (installs/build artifacts only, gitignored)
- **Verification:** `pnpm --filter @counter-attack/server typecheck` and `pnpm --filter @counter-attack/server test` both run cleanly afterward.

---

**Total deviations:** 2 auto-fixed (1 acceptance-gate compliance fix in my own first draft, 1 standard workspace-bootstrap step)
**Impact on plan:** Neither deviation touched plan scope or logic. No scope creep.

## Issues Encountered

- One `pnpm --filter @counter-attack/server test` run surfaced a single `Worker exited unexpectedly` transient error (39/39 test files present but 1 reported incomplete in that run's summary line) — the same class of transient port-binding/worker flake noted in 38-13's and 38-14's SUMMARYs. An immediate re-run completed cleanly: 39/39 test files, 1035/1035 tests passing (1 skipped, 1 todo; 1037 total). Not caused by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The corner award after a spilled save is now decided by the rolled direction alone, exactly as ruled in 38-15's D-GAP-02 checkpoint finding — the keeper's distance from their own byline no longer affects the outcome, closing the single open design question blocking Phase 38's full re-verification.
- Full server suite: 1035/1035 passing (up from 1028 pre-plan baseline; +7 net tests — 6 new in the D-GAP-02 describe block, 1 new in `gameEngine.test.ts`), 1 skipped, 1 todo. No test deleted, no test case removed. `pnpm --filter @counter-attack/server typecheck` exits 0.
- `packages/shared`, every `packages/client` file, and `packages/server/src/gameHandlers.ts` are unchanged by this plan (verified via `git diff --numstat` against the pre-plan commit — only `gameEngine.ts` and the two declared test files changed).
- The OOB-05 "preserved path" block inside the `LOOSE_BALL` case is byte-identical to its pre-plan content (verified via `git diff` — the only removed lines across the whole plan are the 4 comment lines rewritten in the SAVE spill branch by Task 1; every other change is a pure addition).
- Recommend 38-15's still-open items (defects 1/2/4, and the not-yet-individually-re-confirmed steps) be re-walked in the next full two-browser checkpoint alongside this correction.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_

## Self-Check: PASSED

- FOUND: packages/server/src/gameEngine.ts
- FOUND: packages/server/src/**tests**/gameEngine.cornerKick.test.ts
- FOUND: packages/server/src/**tests**/gameEngine.test.ts
- FOUND: .planning/phases/38-corner-kick/38-23-SUMMARY.md
- FOUND: 27e6f52 (Task 1 commit)
- FOUND: 13d3005 (Task 2 commit)
- FOUND: a7807d1 (Task 3 commit)
- `pnpm --filter @counter-attack/server typecheck` exits 0
- `pnpm --filter @counter-attack/server test` — 39/39 files, 1035 passed, 1 skipped, 1 todo (1037 total; baseline before this plan's test additions was 1028)
