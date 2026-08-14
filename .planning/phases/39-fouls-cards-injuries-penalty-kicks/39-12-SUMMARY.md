---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 12
subsystem: api
tags: [typescript, gameEngine, pure-functions, vitest, tdd, gk-dive, fouls]

# Dependency graph
requires:
  - phase: 39-10
    provides: 'resolveFoulChain, applyFoulChoice and the FOUL_CHOICE phase chain — applyGkDiveAtFeetResponse calls resolveFoulChain as its GKDIVE-03 foul-on-1 source'
provides:
  - 'gameEngine.ts computeGkDiveAtFeetOffer — GKDIVE-02/05 repeating-interrupt eligibility (<=3 hexes, parallel column band, once-per-movement-cycle cap)'
  - 'gameEngine.ts computeGkDiveDisplacement — GKDIVE-04 push-occupants-one-hex-further-along-the-dive-direction, deriving direction from hexLine''s last hop; cascades recursively; off-pitch destinations leave the occupant in place; carrier excluded'
  - 'gameEngine.ts applyGkDiveAtFeetResponse — GKDIVE-01..05 accept/decline resolution reusing the TACKLE_ATTEMPT duel shape with validateDiveAtFeetDistance''s -1-at-3-hexes penalty'
  - 'gameEngine.ts enterGkDiveOrSkip — D-09 shared once-per-movement-cycle cap helper, now the single call site all four phase:''GK_DIVE'' transitions route through'
  - 'gameEngine.gkDiveAtFeet.test.ts — 42-case GKDIVE-01..05/D-09 engine coverage'
affects: [39-13, 39-14, 39-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Dive-direction derivation via hexLine''s last hop (not a naive (to-from)/distance cube-vector division) — guarantees an exact single-neighbour-hex step for any two hexes up to 3 apart, not just the 6 canonical collinear directions'
    - 'Recursive cascading displacement bounded by pitch dimension (fixed direction, finite grid → no cycles possible), terminating on the first off-pitch destination'
    - 'Shared cap helper (enterGkDiveOrSkip) replacing N duplicated inline phase transitions — same "one helper, N call sites" shape resolveFoulChain established in 39-10'

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts
  modified:
    - packages/server/src/gameEngine.ts
    - packages/shared/src/types.ts

key-decisions:
  - "computeGkDiveDisplacement derives its push direction from hexLine(from, to)'s LAST HOP (toCube of the second-to-last hex vs. the landing hex), not the plan's literally-worded 'toCube(to) - toCube(from) normalised to a unit step'. The literal wording only produces a valid single-hex-step direction when from/to are exactly collinear along one of the 6 canonical cube directions — for an arbitrary GK-to-carrier pair up to 3 hexes apart (not necessarily axis-aligned), that division does not reduce to an integer neighbour delta. hexLine's last-hop direction is guaranteed to be a valid adjacent-hex step for any from/to pair, verified independently against the real 37x26 grid (hexLine({q:0,r:13},{q:3,r:13}) → pushed hex {q:4,r:14}, NOT the naively-expected {q:4,r:13})."
  - "computeGkDiveDisplacement gained a 5th parameter, excludeId?: string, beyond the plan's literal 4-parameter signature — GKDIVE-04's Task 1 spec explicitly requires displacement to exclude the carrier ('occupied by pieces OTHER than the carrier'), and there is no way to express that exclusion through the pieces/ball/from/to signature alone without either double-filtering the array at the call site (losing the carrier from the returned array) or this parameter. applyGkDiveAtFeetResponse passes carrierId."
  - "Movement-cycle-reset sites for gkDiveAtFeetUsedByTeam were identified empirically: the four places where BOTH movedPieceIds:[] AND paceUsedByPieceId:{} reset together AND movementSlot is (re)set to 'ATTACKER_4' (applyStartMovement, applyRestartMovement, applyThrowInPlace, applyGKRestart's 'movement' branch) — verified by grepping every 'movementSlot: '\''ATTACKER_4'\''' site and excluding the buildReplayFrames reconstruction site (not a live state transition) and applyEndTurn's intermediate slot advance (which resets paceUsedByPieceId per-slot but deliberately preserves movedPieceIds across slot boundaries — confirmed via its own code comment, D-12)."
requirements-completed: [GKDIVE-01, GKDIVE-02, GKDIVE-03, GKDIVE-04, GKDIVE-05]

# Metrics
duration: ~50min
completed: 2026-08-14
---

# Phase 39 Plan 12: Goalkeeper Dive-at-Feet Interrupt Summary

**The GK-dive-at-feet interrupt (repeating 3-hex parallel-to-goal-line offer, reused-tackle-duel with a -1 penalty at distance 3, foul-on-1 into a penalty regardless of duel outcome, cascading pitch-bounded displacement of occupants on a successful landing) now shares one once-per-movement-cycle cap with the existing shot-blocking GK_DIVE reposition window across all four of its transition sites.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Wrote a RED-first 42-case engine suite (`gameEngine.gkDiveAtFeet.test.ts`) covering GKDIVE-01..05 and D-09's four-entry-point shared cap, using real `PITCH_REGIONS`/`GOAL_R_VALUES`-derived goalkeeper/carrier coordinates independently verified against the actual `hexDistance`/`hexLine`/`toCube`/`fromCube` implementation (not hand-derived or guessed) before hardcoding as test literals.
- Implemented `computeGkDiveAtFeetOffer` (GKDIVE-02/05 eligibility: `hexDistance<=3`, the column-band "parallel to goal line" check, red-card exclusion, and the once-per-cycle cap).
- Implemented `computeGkDiveDisplacement` (GKDIVE-04): reuses `hexLine`'s last-hop direction (not a naive cube-vector division, which is only valid for exactly-collinear canonical directions) to compute the push step, cascades recursively into occupied destinations, leaves pieces in place when the push destination is off-pitch, and excludes the carrier from displacement via an added `excludeId` parameter.
- Implemented `applyGkDiveAtFeetResponse` (GKDIVE-01/02/03/05): reuses the exact `TACKLE_ATTEMPT` duel shape (`computeCombinedScore`, tie-goes-to-defender) with `validateDiveAtFeetDistance`'s distance-banded penalty; calls `resolveFoulChain` unconditionally on both SUCCESS and FAIL (the chain itself gates on `defenderDie === FOUL_TRIGGER_DIE`); sets `gkDiveAtFeetUsedByTeam[team] = true` on accept only (SUCCESS or FAIL), never on decline.
- Implemented `enterGkDiveOrSkip` (D-09) and replaced all four inline `phase: 'GK_DIVE'` transition sites (`applyDeclareShot`; the header goal-line route's uncontested-attacker-win and contested-duel-win branches; `applyResolveHeaderTarget`'s goal-line route) with calls to it — `grep -c "phase: 'GK_DIVE',"` confirms exactly 1 remaining occurrence, inside `enterGkDiveOrSkip` itself.
- Registered `gkDiveAtFeetUsedByTeam: {home:false,away:false}` at the four verified movement-cycle-start points (`applyStartMovement`, `applyRestartMovement`, `applyThrowInPlace`, `applyGKRestart`'s `'movement'` branch), explicitly NOT at `applyEndTurn`'s mid-cycle slot advance — asserted by a dedicated regression test.
- Registered the two new events per the standing Undo/Replay checklist: `GK_DIVE_AT_FEET_PROMPT` added to `ZONE_CHECK_EXEMPT_PHASES`; `GK_DIVE_AT_FEET` added unconditionally to `applyUndo`'s `isBoundary` reduce and to `REPLAY_ELIGIBLE_TYPES` (carries `ballAfter`); `GK_DIVE_AT_FEET_DECLINED` deliberately excluded from replay eligibility (no `ballAfter`).
- Full server suite (1177 tests, 1 skipped, 1 todo) and full monorepo build (`pnpm build`) green; `tsc --noEmit` clean; exactly one `phase: 'GK_DIVE'` literal remains; no `Math.random` calls in `gameEngine.ts`.

## Task Commits

1. **Task 1: Write gameEngine.gkDiveAtFeet.test.ts covering GKDIVE-01..05 and D-09** - `359664b` (test) — RED state confirmed: 37/42 cases failed (the 5 passing cases were expected-baseline control cases — "cap unused → still enters GK_DIVE" and "slot advance doesn't clear anything yet" — since neither behavior had changed yet).
2. **Task 2: Implement the dive-at-feet offer, duel and GKDIVE-04 displacement** - `b256600` (feat) — 34/42 cases passed at this checkpoint (all Task-2-scoped cases; the 8 remaining were the D-09 four-site "skip to SHOT" cases and the four movement-cycle-reset cases, both explicitly Task 3's scope per the plan).
3. **Task 3: enterGkDiveOrSkip and the four GK_DIVE call-site replacements (D-09)** - `cc38c83` (feat) — all 42 cases pass; full server suite and full monorepo build green.

_No plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts` - 42 `it(` cases: `computeGkDiveAtFeetOffer` eligibility/boundary/cap (8 cases), `applyGkDiveAtFeetResponse` decline (3), guards (1), accept/GKDIVE-01/02 (5), GKDIVE-03 foul-on-1 (3), `computeGkDiveDisplacement` (7), `enterGkDiveOrSkip` (3), a dedicated `describe('D-09 shared cap — all four GK_DIVE entry points')` block driving each of the four call sites by name (8), and the movement-cycle-reset-vs-slot-advance distinction (5)
- `packages/server/src/gameEngine.ts` - `computeGkDiveAtFeetOffer`, `computeGkDiveDisplacement`, `applyGkDiveAtFeetResponse`, `enterGkDiveOrSkip` added; the four `phase: 'GK_DIVE'` sites replaced with `enterGkDiveOrSkip` calls; `gkDiveAtFeetUsedByTeam` reset added at the four movement-cycle-start points; `GK_DIVE_AT_FEET_PROMPT`/`GK_DIVE_AT_FEET` registered in `ZONE_CHECK_EXEMPT_PHASES`/`applyUndo`'s `isBoundary`/`REPLAY_ELIGIBLE_TYPES`
- `packages/shared/src/types.ts` - corrected `gkDiveAtFeetUsedByTeam`'s doc comment (see Deviations)

## Decisions Made

See `key-decisions` in frontmatter — the `hexLine`-last-hop dive-direction derivation (a genuine correction of the plan's literally-worded "normalised unit step," which is only valid for collinear canonical directions), the added `excludeId` parameter on `computeGkDiveDisplacement` (required by GKDIVE-04's "other than the carrier" wording, not expressible through the plan's literal 4-parameter signature), and the empirical identification of the four movement-cycle-reset sites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected `computeGkDiveDisplacement`'s direction derivation from the plan's literal wording**

- **Found during:** Task 2 (design phase, before writing any implementation code)
- **Issue:** The plan's action text says to derive the dive direction as "the cube-vector difference `toCube(to) - toCube(from)` normalised to a unit step." Independently verifying this against the real 37x26 grid (`hexLine({q:0,r:13},{q:3,r:13})`) showed the naive `(to-from)/hexDistance` division does NOT reduce to a valid single-hex-step cube vector for this from/to pair — the correct "one hex further" destination from `{q:3,r:13}` is `{q:4,r:14}`, not the `{q:4,r:13}` a plain same-row extrapolation would suggest, because ODD-Q offset "rows" are not straight lines in cube space.
- **Fix:** Derive the direction from `hexLine(from, to)`'s last hop (`toCube` of the second-to-last hex vs. the landing hex) instead — guaranteed to be a valid adjacent-hex cube delta for any `from`/`to` pair, since `hexLine` already produces a sequence of pairwise-adjacent hexes.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** Independently computed via `node` against the built `packages/shared/dist` output for every fixture coordinate before hardcoding test literals (documented inline in the test file); all displacement test cases pass.
- **Committed in:** `b256600` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added an `excludeId` parameter to `computeGkDiveDisplacement`**

- **Found during:** Task 2
- **Issue:** GKDIVE-04's Task 1 behavior spec requires displacement to affect only occupants "other than the carrier" — the carrier is dispossessed in place, not shoved elsewhere by their own dispossession. The plan's literal 4-parameter signature (`pieces, ball, from, to`) has no way to express this exclusion.
- **Fix:** Added an optional 5th parameter, `excludeId?: string`; `applyGkDiveAtFeetResponse` passes the carrier's id.
- **Files modified:** `packages/server/src/gameEngine.ts`
- **Verification:** SUCCESS-path tests confirm the carrier's position is unchanged after a successful dive even when other occupants at the landing hex are displaced.
- **Committed in:** `b256600` (Task 2 commit)

**3. [Rule 1 - Bug] Corrected a misleading doc comment on `gkDiveAtFeetUsedByTeam` in `types.ts`**

- **Found during:** Task 3
- **Issue:** The field's existing doc comment (from an earlier plan) said "SHARED once-per-team-per-half cap" — this contradicts GKDIVE-05's actual once-per-movement-cycle semantics that this plan implements and tests.
- **Fix:** Corrected the comment to say "once-per-movement-cycle (4-5-2)... reset at every fresh movement-cycle start... NOT once per half." No behavior change — comment only.
- **Files modified:** `packages/shared/src/types.ts`
- **Verification:** `tsc --noEmit` clean; full test suite unaffected (comment-only change).
- **Committed in:** `cc38c83` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 bug fix in direction math, 1 missing-critical parameter, 1 doc-accuracy bug fix)
**Impact on plan:** All three were necessary for correctness (deviations 1-2) or to prevent future confusion (deviation 3). No scope creep — no new files beyond the plan's declared `files_modified`, except the incidental `types.ts` comment fix.

## Issues Encountered

None beyond the two auto-fixes documented above. `pnpm install --frozen-lockfile` and a `packages/shared` build were required once at the start of this session (fresh worktree, no `node_modules`/`dist` yet) before any test or build command could run — consistent with prior Phase 39 plans' noted setup step.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `computeGkDiveAtFeetOffer`, `applyGkDiveAtFeetResponse`, `computeGkDiveDisplacement`, and `enterGkDiveOrSkip` are all exported and ready for a sibling plan's socket handler (e.g. `GAME_GK_DIVE_AT_FEET`) to wire behind the standard `isProcessing` mutex + team-ownership guard shape, following the pattern documented in `gameHandlers.ts`'s existing handlers (per `39-PATTERNS.md`'s `GAME_GK_DIVE` analog).
- The client-side offer/prompt UI (`GkDiveAtFeetPromptPanel.tsx`) and the actual wiring of `computeGkDiveAtFeetOffer` into the move-end hook (deciding WHEN to transition into `GK_DIVE_AT_FEET_PROMPT`) are explicitly out of this plan's scope — the plan's `files_modified` list only covers `gameEngine.ts` and its test file, consistent with 39-10's precedent of shipping pure engine functions ready for a sibling handler-wiring plan.
- No blockers. Full monorepo build/test all green (server 1177 tests, 1 skipped, 1 todo; shared/client unaffected, both still build clean).

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_

## Self-Check: PASSED

- FOUND: `packages/server/src/__tests__/gameEngine.gkDiveAtFeet.test.ts`
- FOUND: `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-12-SUMMARY.md`
- FOUND: commit `359664b` (test: RED state, 42 cases)
- FOUND: commit `b256600` (feat: offer, duel, GKDIVE-04 displacement)
- FOUND: commit `cc38c83` (feat: enterGkDiveOrSkip + four call-site replacements)
