---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 14
subsystem: api
tags: [typescript, gameEngine, pure-functions, vitest, tdd, gk-box-entry, second-half]

# Dependency graph
requires:
  - phase: 39-12
    provides: 'computeGkDiveAtFeetOffer/applyGkDiveAtFeetResponse and the gkDiveAtFeetUsedByTeam cap/reset-site pattern this plan mirrors structurally for the box-entry response (D-10/D-11)'
provides:
  - 'gameEngine.ts computeBoxEntryOffer — D-10 first-entry-per-movement-cycle detection into homePenaltyArea/awayPenaltyArea, fires on any means of entry (pass/shot/move/loose ball), compares against a caller-supplied prevBallPosition rather than re-deriving from eventLog'
  - 'gameEngine.ts applyBoxEntryResponse — D-10/D-11 accept/decline resolution; BOTH accept and decline consume the once-per-cycle cap (an intentional asymmetry vs. the dive-at-feet decline, which does not consume its cap)'
  - "gameEngine.ts applyBoxEntryMove — one-hex GK reposition with the ordered OUT_OF_RANGE/OFF_PITCH/OCCUPIED guard sequence (mirrors applyGoalKickReposition's 37-13 ordering)"
  - 'gameEngine.ts applySecondHalfConfirm — D-16 GameState-scoped mutual-confirm gate in front of the existing applyHalfTimeStart, either team may confirm first, same-team re-confirm is an idempotent no-op'
  - "gameEngine.gkBoxEntryUsedByTeam and gkDiveAtFeetUsedByTeam are two fully independent once-per-movement-cycle caps (D-11) — verified by neither function reading/writing the other's field"
  - 'gameEngine.boxEntry.test.ts — 28-case D-10/D-11 engine coverage'
  - 'gameEngine.secondHalf.test.ts — 8-case D-16 engine coverage'
affects: [39-15]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Caller-supplied prevBallPosition parameter (not an eventLog scan) to detect a zone-entry-this-action, extending the ball.lastTouchedBy "never derive retroactively" precedent from Phase 37 to a second mechanic'
    - 'Gate-function-in-front-of-existing-transition pattern (applySecondHalfConfirm wraps applyHalfTimeStart without touching its body) — reusable whenever an existing single-actor transition needs a mutual-confirm precondition bolted on without duplicating its logic'
    - "Asymmetric accept/decline cap-consumption (box-entry: both consume; dive-at-feet: only accept consumes) — each mechanic's own behavior spec governs, not a blanket convention"

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.boxEntry.test.ts
    - packages/server/src/__tests__/gameEngine.secondHalf.test.ts
  modified:
    - packages/server/src/gameEngine.ts

key-decisions:
  - "applyBoxEntryResponse's decline branch sets gkBoxEntryUsedByTeam[team]=true (consumes the cap), unlike applyGkDiveAtFeetResponse's decline branch which deliberately does NOT consume its cap. This is not an inconsistency: the plan's Task 1 behavior spec explicitly states 'declining still consumes the once-per-cycle opportunity, because the offer is a one-shot per entry and re-offering on the next sub-action would spam the manager' (T-39-14-03) — a different rationale from the dive-at-feet mechanic, which the user can decline repeatedly at each qualifying step (D-07) without penalty. Both behaviors are correct for their own mechanic; a shared 'declining never consumes' convention across all GK-response mechanics would have been the wrong generalization."
  - "applyBoxEntryResponse's accept branch does NOT set gkBoxEntryUsedByTeam — the cap is set by applyBoxEntryMove once the reposition actually completes. This mirrors the general principle that a cap is spent when an interrupt has fully resolved (accept+move, or decline), not merely offered or partially accepted."
  - "computeBoxEntryOffer takes prevBallPosition as an explicit parameter rather than deriving it from state.eventLog — deliberately extends the ball.lastTouchedBy precedent (Phase 37 ARCHITECTURE.md Q2: never derive retroactively from an event-log scan) to a second mechanic. The caller (a sibling plan's socket-handler layer) is expected to snapshot the ball position immediately before the triggering action."

requirements-completed: [GKDIVE-02, GKDIVE-05]

# Metrics
duration: ~55min
completed: 2026-08-14
---

# Phase 39 Plan 14: Box-Entry GK Response & Second-Half Mutual-Confirm Summary

**A new `computeBoxEntryOffer`/`applyBoxEntryResponse`/`applyBoxEntryMove` chain offers the defending manager a one-hex goalkeeper reposition on the first ball entry into a penalty area each movement cycle (by any means — pass, shot, move, or loose ball) under its own independent cap, and `applySecondHalfConfirm` replaces the single-team "Start Second Half" gate with a mutual both-confirm gate that reuses the existing `applyHalfTimeStart` transition unchanged.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- Wrote a RED-first pair of engine suites (`gameEngine.boxEntry.test.ts`, 28 cases; `gameEngine.secondHalf.test.ts`, 8 cases — 36 total, well over the 25-case acceptance floor) covering D-10/D-11's box-entry response and D-16's mutual-confirm gate, using real `PITCH_REGIONS.homePenaltyArea`/`awayPenaltyArea` member/non-member hexes throughout (never invented coordinates). Confirmed RED: 34/36 cases failed before implementation (the 2 baseline-passing cases needed no new behavior yet).
- Implemented `computeBoxEntryOffer` (D-10): detects the first ball entry into either penalty area this movement cycle by comparing a caller-supplied `prevBallPosition` against the current `state.ball.position`, offering the entered area's DEFENDING team (`homePenaltyArea` → `'home'`, `awayPenaltyArea` → `'away'`) subject to a non-red-carded GK and its own cap. Verified it fires identically regardless of the means of entry (pass reception, shot in flight, carrier move, loose-ball landing) since the function is agnostic to `lastActionType`/`carrierId`.
- Implemented `applyBoxEntryResponse` (D-10/D-11): decline restores `phase`/`activeTeam`/`movementSlot` from `gkBoxEntryResume`, clears the context cluster, and — per the plan's explicit T-39-14-03 spec — sets the cap flag even on decline (an intentional asymmetry vs. `applyGkDiveAtFeetResponse`'s decline, which does not consume its cap). Accept transitions to `GK_BOX_ENTRY_MOVE` with `activeTeam` set to the responding team, leaving `gkBoxEntryResume` intact for the post-move restore.
- Implemented `applyBoxEntryMove` (D-10): the ordered `OUT_OF_RANGE`/`OFF_PITCH`/`OCCUPIED` guard sequence, byte-for-byte mirroring `applyGoalKickReposition`'s 37-13 ordering rationale (adjacency first, OFF_PITCH before OCCUPIED since the two are mutually exclusive). On success, moves the GK exactly one hex, appends `GK_BOX_ENTRY_MOVE`, sets the cap, and restores the interrupted phase.
- Verified D-11 independence directly: neither `applyBoxEntryResponse` nor `applyBoxEntryMove`'s function bodies reference `gkDiveAtFeetUsedByTeam` (grep-verified — the only occurrence of that string in the box-entry region is a doc comment inside `computeBoxEntryOffer`), and dedicated tests assert both directions (box-entry-used does not block a dive-at-feet offer, and vice versa).
- Registered `gkBoxEntryUsedByTeam: { home: false, away: false }` at all four movement-cycle-start reset sites Plan 39-12 previously identified for `gkDiveAtFeetUsedByTeam` (`applyStartMovement`, `applyRestartMovement`, `applyThrowInPlace`, `applyGKRestart`'s `'movement'` branch) — deliberately NOT at `applyEndTurn`'s mid-cycle slot advance, confirmed by a dedicated regression test per site.
- Registered the two new events per the standing Undo/Replay checklist: `GK_BOX_ENTRY_PROMPT`/`GK_BOX_ENTRY_MOVE` added to `ZONE_CHECK_EXEMPT_PHASES`; `GK_BOX_ENTRY_MOVE` (guarded on phase) and `SECOND_HALF_CONFIRM` (guarded on `HALF_TIME`) added to `applyUndo`'s `isBoundary`; both deliberately excluded from `REPLAY_ELIGIBLE_TYPES` (neither carries `ballAfter`), with an explicit "not an oversight" comment matching the existing convention.
- Implemented `applySecondHalfConfirm` (D-16): phase-guarded to `HALF_TIME`; reads `state.secondHalfConfirmed ?? { home: false, away: false }`; a repeated confirm from the same team is a strictly referential no-op (`result.state === state`, no duplicate event); appends `SECOND_HALF_CONFIRM` with `bothConfirmed`; once both flags are true, delegates to the EXISTING `applyHalfTimeStart` (verified via `git diff` that its own body is untouched — only new code was appended after its closing brace) and clears `secondHalfConfirmed` back to `null` on the result. Verified either team may confirm first via a dedicated symmetry test (home-then-away produces an identical end state to away-then-home).
- Full server suite (1222 tests, 1 skipped, 1 todo, across all 48 test files) and full monorepo build (`pnpm build`, shared+server+client) green; `tsc --noEmit` clean on the server package; `eslint` clean on all modified/created files.

## Task Commits

1. **Task 1: Write the failing box-entry and second-half suites** - `a5c2680` (test) — RED state confirmed: 34/36 cases failed (2 baseline-passing cases required no new behavior).
2. **Task 2: Implement the box-entry goalkeeper response (D-10/D-11)** - `70f85f3` (feat) — all 28 `gameEngine.boxEntry.test.ts` cases pass.
3. **Task 3: Implement the second-half mutual-confirm gate (D-16)** - `c85942e` (feat) — all 8 `gameEngine.secondHalf.test.ts` cases pass; full server suite (1222 tests) and full monorepo build green.

_No plan-metadata commit — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/server/src/__tests__/gameEngine.boxEntry.test.ts` - 28 `it(` cases: `computeBoxEntryOffer` fires-on-any-means-of-entry (5: pass/shot/move/loose-ball/away-area), null-preconditions (5: already-inside/never-entered/cap-set/no-GK/red-carded), `applyBoxEntryResponse` decline (3) / accept (2) / guards (1), `applyBoxEntryMove` guards+success (5), D-11 independence (2, both directions), and the movement-cycle-reset-vs-slot-advance distinction (5)
- `packages/server/src/__tests__/gameEngine.secondHalf.test.ts` - 8 `it(` cases: WRONG_PHASE guard, single-confirm state+event, both-confirm event+transition, either-team-first symmetry, same-team idempotence, secondHalfConfirmed cleared post-transition; includes the recorded RESEARCH.md Pitfall 4 comment explaining why `secondHalfConfirmed` copies `headerConfirmed`'s GameState-scoped shape rather than `LINEUP_CONFIRM`'s Room-scoped flags
- `packages/server/src/gameEngine.ts` - `computeBoxEntryOffer`, `applyBoxEntryResponse`, `applyBoxEntryMove`, `applySecondHalfConfirm` added; `gkBoxEntryUsedByTeam` reset added at the four movement-cycle-start points beside the existing `gkDiveAtFeetUsedByTeam` reset; `GK_BOX_ENTRY_PROMPT`/`GK_BOX_ENTRY_MOVE` registered in `ZONE_CHECK_EXEMPT_PHASES`; `GK_BOX_ENTRY_MOVE`/`SECOND_HALF_CONFIRM` registered in `applyUndo`'s `isBoundary`; both explicitly excluded from `REPLAY_ELIGIBLE_TYPES` with a documented rationale

## Decisions Made

See `key-decisions` in frontmatter — the deliberate accept/decline cap-consumption asymmetry between the box-entry response (both consume) and the dive-at-feet duel (only accept consumes), each governed by its own plan-specified behavior rather than a blanket cross-mechanic convention; and the `prevBallPosition`-as-parameter design extending the `ball.lastTouchedBy` "never derive retroactively" precedent to a second mechanic.

## Deviations from Plan

None - plan executed exactly as written. All three tasks (RED test suite, box-entry implementation, second-half mutual-confirm implementation) matched the plan's `<action>` and `<acceptance_criteria>` blocks without requiring bug fixes, missing-functionality additions, or architectural changes beyond what was specified.

## Issues Encountered

- A transient `pnpm exec vitest run` "Worker exited unexpectedly" error occurred on the first full-suite run after Task 3 (a Windows/tinypool worker-pool flake, unrelated to this plan's changes — 46/48 test files completed before the crash). Re-running the identical command immediately produced a clean 48/48 pass with 1222 tests green; no code change was needed. Documented here rather than as a Rule 1 auto-fix since no defect was found or fixed.
- `pnpm install --frozen-lockfile` and a `packages/shared` build were required once at the start of this session (fresh worktree, no `node_modules`/`dist` yet) before any test or build command could run — consistent with prior Phase 39 plans' noted setup step.
- Per-task atomic commits required temporarily removing the `applySecondHalfConfirm` block and the `gameEngine.secondHalf.test.ts` file from the working tree after implementing both Task 2 and Task 3's code changes in a single editing pass, so that Task 2's commit contained only box-entry changes and Task 3's commit contained only the second-half gate — both blocks were re-applied verbatim (byte-for-byte identical) before the Task 3 commit. No functional impact; purely a commit-hygiene step.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `computeBoxEntryOffer`, `applyBoxEntryResponse`, `applyBoxEntryMove`, and `applySecondHalfConfirm` are all exported and ready for a sibling plan's socket-handler layer (e.g. `GAME_GK_BOX_ENTRY_RESPONSE`, `GAME_GK_BOX_ENTRY_MOVE`, and a reworked `GAME_HALF_TIME_START` handler) to wire behind the standard `isProcessing` mutex + team-ownership guard shape, following the pattern documented in `gameHandlers.ts`'s existing handlers and this phase's `39-PATTERNS.md`.
- The client-side offer/prompt UI (a `GkBoxEntryPromptPanel`-equivalent) and the actual call-site wiring of `computeBoxEntryOffer` into the move-end hook (deciding WHEN to snapshot `prevBallPosition` and invoke the offer check) are explicitly out of this plan's scope — the plan's `files_modified` list only covers `gameEngine.ts` and its test files, consistent with 39-10/39-12's precedent of shipping pure engine functions ready for a sibling handler-wiring plan. Per the threat model (T-39-14-01/T-39-14-04), Plan 39-15's handler layer is expected to add the `controlsGKTeam`-style ownership check and per-team second-half-confirm enforcement.
- No blockers. Full monorepo build/test all green (server 1222 tests, 1 skipped, 1 todo; shared/client unaffected, both still build clean).

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_

## Self-Check: PASSED

- FOUND: `packages/server/src/__tests__/gameEngine.boxEntry.test.ts`
- FOUND: `packages/server/src/__tests__/gameEngine.secondHalf.test.ts`
- FOUND: `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-14-SUMMARY.md`
- FOUND: commit `a5c2680` (test: RED state, 36 cases)
- FOUND: commit `70f85f3` (feat: box-entry goalkeeper response, D-10/D-11)
- FOUND: commit `c85942e` (feat: second-half mutual-confirm gate, D-16)
