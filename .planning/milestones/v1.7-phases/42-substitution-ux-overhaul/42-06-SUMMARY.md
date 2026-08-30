---
phase: 42-substitution-ux-overhaul
plan: 06
subsystem: game-server
tags: [roster-reposition, gameEngine, gameHandlers, shared-package, sub-08]

requires:
  - phase: 42-substitution-ux-overhaul (plans 02/03/05)
    provides: 'isActivePiece(piece) red-card exclusion baseline across gameHandlers.ts and gameEngine.ts'
provides:
  - "'ROSTER_REPOSITION' ActionEventType member and ActionEvent variant (packages/shared/src/types.ts)"
  - 'GAME_ROSTER_REPOSITION client event + RosterRepositionPayload (packages/shared/src/events.ts)'
  - 'applyRosterReposition pure engine function, ApplyRosterRepositionResult, RosterRepositionRejection (packages/server/src/gameEngine.ts)'
  - 'GAME_ROSTER_REPOSITION socket handler (packages/server/src/gameHandlers.ts)'
  - 'ROSTER_REPOSITION registered as an applyUndo boundary; explicitly excluded from REPLAY_ELIGIBLE_TYPES'
affects: [42-07, 42-08, 42-09]

tech-stack:
  added: []
  patterns:
    - "applyRosterReposition mirrors applySubstitution's structure exactly: guard-before-
      mutation ordering, immutable-spread state build, ActionEvent append — but touches
      none of subsUsed/addedTime/addedTimeBonus/bench/phase/activeTeam/movementSlot,
      since a reposition is free, uncapped, repeatable, and never advances the FSM."
    - "GAME_ROSTER_REPOSITION handler mirrors GAME_SUBSTITUTION's mutex/phase-guard/
      team-guard/pure-function-delegate/broadcast shape verbatim, using socketTeam (not
      isActivePlayer) since a reposition is roster admin during a stoppage, not a
      turn-bound action."
    - "Swap semantics: id/position/number stay bound to the slot; everything else
      (playerId, name, all nine attributes, redCarded/onPitch/yellowCards/injuryCount)
      travels with the person — required for applyRosterContinuity survival (identity-
      by-id overlay) and for the roster grid's slot-index-based column grouping."

key-files:
  created:
    - packages/server/src/__tests__/gameEngine.rosterReposition.test.ts
    - packages/server/src/__tests__/gameHandlers.rosterReposition.test.ts
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/shared/src/events.test.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts

key-decisions:
  - "GK-slot lock checks both role==='GK' and a parsed slot index of 0 (via /-(\\d+)$/
    on the piece id, matching LineupAssignmentScreen.tsx's own parse) — a prior
    substitution can change a slot's role but never its id, so both conditions are
    needed to always catch the GK slot regardless of current occupant."
  - 'D-05: a red-carded piece is a legal reposition participant. No isActivePiece guard
    was added to applyRosterReposition — this is the one deliberate exception in the
    codebase where a dismissed piece is eligible, so the vacated slot stays a real,
    droppable target for reshuffling shape.'
  - "REPOSITION_BALL_CARRIER guard added (not in the plan's must_haves list as a named
    truth but required by the plan's task text): rejects a swap touching
    state.ball.carrierId, since a stoppage-designated carrier (goal-kick GK, corner
    taker, throw-in thrower) was selected under restart-specific rules that a silent
    occupant swap would bypass."

requirements-completed: [SUB-08, SUB-13, SUB-18]

duration: ~90min
completed: 2026-08-22
---

# Phase 42 Plan 06: Server-Authoritative Roster Reposition (SUB-08) Summary

**Built the complete server-authoritative half of SUB-08 — a `GAME_ROSTER_REPOSITION` client event, a pure `applyRosterReposition` engine function, and the socket handler that gates it — mirroring the existing `GAME_SUBSTITUTION`/`applySubstitution` pair exactly, with identity-follows-slot swap semantics proven to survive `applyRosterContinuity` resets.**

## Performance

- **Duration:** ~90 min (includes ~3 min fresh-worktree `pnpm install --frozen-lockfile` + `packages/shared` build, not attributable to plan work)
- **Tasks:** 3 (as planned)
- **Files modified:** 5 (3 planned edits to existing files + 2 new test files, matching `files_modified` in the plan frontmatter)

## Accomplishments

- **Task 1 — Shared wire contract:** Added `'ROSTER_REPOSITION'` to `ActionEventType` (immediately after `'SUBSTITUTION'`) and a matching `ActionEvent` variant with fields `type`, `team`, `pieceId` (slot A, named to match `SUBSTITUTION`'s convention so `ActionLog.tsx`'s `pieceColorOf(event.pieceId)` needs no special case), `pieceIdB`, `playerAName`, `playerBName`, `jerseyNumberA`, `jerseyNumberB`, `timestamp`. Added `GAME_ROSTER_REPOSITION: 'game:roster-reposition'` to `ClientEvents`, exported `RosterRepositionPayload = { pieceIdA: string; pieceIdB: string }`, and the `ClientToServerEvents` signature entry. No `ServerToClientEvents` addition — result rides the existing full-snapshot broadcast; rejections use `GAME_ERROR`. Added two `events.test.ts` assertions: the new event's string value, and a `Set`-based uniqueness check across every `ClientEvents` value (the file had no pre-existing uniqueness assertion to mirror, so one was authored from scratch).
- **Task 2 — `applyRosterReposition` engine function:** Placed immediately after `applySubstitution` and before `applyRosterContinuity`, per the plan. Guard order (all validated before any mutation): `WRONG_PHASE` (not `isStoppagePhase`) → `INVALID_REPOSITION` (same id twice) → `INVALID_REPOSITION` (unresolved id or wrong team) → `GK_SLOT_LOCKED` (role `'GK'` OR parsed slot index 0, either piece) → `REPOSITION_BALL_CARRIER` (either id is `state.ball.carrierId`) → no red-card rejection (D-05, documented exception). Swap expression locked exactly as specified: `newA = { ...pieceB, id: pieceA.id, position: pieceA.position, number: pieceA.number }` (and the mirror for `newB`). State build touches only `pieces` and `eventLog`; `phase`/`activeTeam`/`movementSlot`/`subsUsed`/`addedTime`/`addedTimeBonus`/`bench` are all passed through unchanged via the outer spread. Registered `'ROSTER_REPOSITION'` as an unconditional `applyUndo` boundary term alongside `'SUBSTITUTION'`, and added an explicit exclusion comment beside `REPLAY_ELIGIBLE_TYPES` (verified absent by both `grep -c` and the plan's own `node -e` `REPLAY_ELIGIBLE_TYPES` membership check).
- **Task 3 — `GAME_ROSTER_REPOSITION` socket handler:** Registered immediately after `GAME_SUBSTITUTION`, mirroring its exact shape — mutex acquire/release, untrusted-payload shape validation (`INVALID_REPOSITION`), `isStoppagePhase` gate (`WRONG_PHASE`), `socketTeam(socket)` (not `isActivePlayer` — comment explicitly says not to "fix" this), handler-level ownership pre-check on both ids (`INVALID_REPOSITION` if either piece is missing, `WRONG_TEAM` if either belongs to the opponent), delegation to `applyRosterReposition`, and verbatim rejection forwarding via `GAME_ERROR`. Added `applyRosterReposition` to the `gameEngine.js` import block and `RosterRepositionPayload` to the `@counter-attack/shared` type-only import block — no duplicate import statements created.
- Full test suite: `packages/shared` 863 tests (unchanged baseline, +2 new event-contract assertions counted within `events.test.ts`'s 10), `packages/server` 1490 tests (up from the 1466 baseline entering this plan — +24: 13 engine tests + 11 handler tests), both green. `pnpm -r typecheck` clean on shared and server; `packages/client` typecheck fails with the exact anticipated `ActionLog.tsx` exhaustiveness gap (see "Known Client Typecheck Gap" below — per the plan's own verification note, this is 42-09's scope, not patched here). `eslint` clean on all 4 touched source files plus both new test files (one unused-import lint error was caught and fixed during Task 3 — see Deviations).

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared contracts — ROSTER_REPOSITION event type, ActionEvent variant, socket event and payload** - `20a91fd` (feat)
2. **Task 2: applyRosterReposition pure engine function plus Undo/Replay registration** - `99a70ff` (feat)
3. **Task 3: GAME_ROSTER_REPOSITION socket handler** - `8858aff` (feat)

**Plan metadata:** SUMMARY commit handled per worktree isolation (this file is committed separately by the executor per the worktree protocol).

## Files Created/Modified

- `packages/shared/src/types.ts` — `'ROSTER_REPOSITION'` `ActionEventType` member + `ActionEvent` variant
- `packages/shared/src/events.ts` — `GAME_ROSTER_REPOSITION` client event, `RosterRepositionPayload`, `ClientToServerEvents` entry
- `packages/shared/src/events.test.ts` — 2 new assertions (value check + uniqueness check)
- `packages/server/src/gameEngine.ts` — `applyRosterReposition`, `ApplyRosterRepositionResult`, `RosterRepositionRejection`; Undo boundary registration; Replay exclusion comment
- `packages/server/src/gameHandlers.ts` — `GAME_ROSTER_REPOSITION` socket handler; 2 new imports
- `packages/server/src/__tests__/gameEngine.rosterReposition.test.ts` (new) — 13 engine-level tests
- `packages/server/src/__tests__/gameHandlers.rosterReposition.test.ts` (new) — 11 socket-level integration tests

## Final `applyRosterReposition` Signature and Rejection Union

```ts
type RosterRepositionRejection =
  | 'WRONG_PHASE'
  | 'INVALID_REPOSITION'
  | 'GK_SLOT_LOCKED'
  | 'REPOSITION_BALL_CARRIER';

export type ApplyRosterRepositionResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: RosterRepositionRejection };

export function applyRosterReposition(
  state: GameState,
  team: 'home' | 'away',
  pieceIdA: string,
  pieceIdB: string,
): ApplyRosterRepositionResult;
```

Exactly matches the plan's specified rejection reasons and function signature — no deviation.

## Exact Swap Expression Used

```ts
const newA: PlayerPiece = {
  ...pieceB,
  id: pieceA.id,
  position: pieceA.position,
  number: pieceA.number,
};
const newB: PlayerPiece = {
  ...pieceA,
  id: pieceB.id,
  position: pieceB.position,
  number: pieceB.number,
};
```

Byte-for-byte the plan's locked model — `id`/`position`/`number` stay slot-bound; everything else (identity, all nine numeric attributes, card/injury/on-pitch state) travels with the person via the leading spread.

## Undo-Boundary / Replay-Exclusion Registration Confirmation

- **Undo:** `evt.type === 'ROSTER_REPOSITION'` added to `applyUndo`'s `isBoundary` disjunction, unconditional (no phase guard), directly beside `evt.type === 'SUBSTITUTION'`.
- **Replay:** `'ROSTER_REPOSITION'` is NOT a member of `REPLAY_ELIGIBLE_TYPES` — confirmed by the plan's own acceptance-criteria command:
  ```
  node -e "const s=require('fs').readFileSync('packages/server/src/gameEngine.ts','utf8');const m=s.match(/REPLAY_ELIGIBLE_TYPES = new Set<string>\(\[[\s\S]*?\]\)/)[0];process.exit(m.includes(\"'ROSTER_REPOSITION'\")?1:0)"
  ```
  exits `0` (member absent), and an explanatory exclusion comment sits directly beside the existing `SUBSTITUTION` exclusion comment.

## Decisions Made

- **GK-slot lock is a two-clause OR** (`role === 'GK'` on either piece, OR parsed slot index `0` on either piece's id via `/-(\d+)$/`) rather than either clause alone — a prior substitution can change a slot's occupant `role` but never its `id`, so both are required to always catch the GK slot regardless of who currently occupies it. This mirrors the client's own `slotIndex === 0` parse in `LineupAssignmentScreen.tsx` and reuses the existing `GK_SLOT_LOCKED` string verbatim so the client's already-present rejection copy works unmodified.
- **No `isActivePiece` guard on the reposition participants** — D-05 explicitly requires a red-carded piece's vacated slot to remain a legal, droppable reposition target so a manager can reshuffle shape around a numerical disadvantage. This is the one deliberate exception (documented inline) to the otherwise-universal BUG-38 `isActivePiece` convergence established in plans 42-01/02/03/05.
- **`events.test.ts` uniqueness assertion authored from scratch.** The plan instructed "mirror whatever uniqueness assertion the file already performs," but the file had none — only individual value-equality checks. A `new Set(Object.values(ClientEvents)).size === values.length` assertion was added as the most direct literal interpretation of "distinct from every other `ClientEvents` value."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Unused `waitForNStates` helper copied into the new handler test file**

- **Found during:** Task 3's eslint verification pass
- **Issue:** `gameHandlers.rosterReposition.test.ts` was initially drafted by adapting `gameHandlers.substitution.test.ts`'s server-lifecycle boilerplate, which included a `waitForNStates` helper used by that file's double-emit mutex test. This plan's mutex test (a no-op check while `isProcessing === true`) didn't need it, so the copied helper was dead code, tripping `@typescript-eslint/no-unused-vars`.
- **Fix:** Removed the unused `waitForNStates` function entirely.
- **Files modified:** `packages/server/src/__tests__/gameHandlers.rosterReposition.test.ts`
- **Verification:** `npx eslint` clean afterward; full rosterReposition test run (24 tests) still green.
- **Committed in:** `8858aff` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (blocking lint error, not a functional issue)
**Impact on plan:** None — a pure cleanup of copied-but-unused test scaffolding, caught before commit.

## Known Client Typecheck Gap (documented, not patched — per plan's own instruction)

`pnpm -r typecheck` fails on `packages/client` with:

```
src/components/ActionLog.tsx(343,74): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

This is `ActionLog.tsx`'s `formatEvent` exhaustive `switch (event.type)` over `ActionEvent`, which the plan's own verification section explicitly anticipated: _"the new `ActionEventType` member must not break `ActionLog.tsx`'s exhaustiveness handling; if it does, that is 42-09's scope — report it rather than patching the client here."_ Confirmed this is exactly that gap — no `case 'ROSTER_REPOSITION':` arm exists yet. `packages/client`'s **test suite** (vitest, which does not type-check) runs green regardless (1062 tests, unchanged baseline) — only `tsc --noEmit` is affected. Not fixed in this plan; flagged for 42-09 (or whichever later plan wires the client-side log rendering for this event).

## Acceptance-Criteria Grep Note (documented, not a defect)

Task 3's acceptance criteria include:

```
grep -A40 "ClientEvents.GAME_ROSTER_REPOSITION" packages/server/src/gameHandlers.ts | grep -c "isActivePlayer"
```

expected to return `0`. As literally written this grep counts substring occurrences within the surrounding **comment text**, not function calls — the handler's required comment ("deliberately `socketTeam`, NOT `isActivePlayer`... do not 'fix' this into an `isActivePlayer` check", mandated by this same task's own action text) causes it to return `2`. This is not a functional gap: the identical grep run against the existing `GAME_SUBSTITUTION` handler — the explicit template this task mirrors — also returns `2`, for the exact same reason (its own analogous SUB-01 comment). Confirmed via direct comparison during verification; no code change made, since removing the mandated documentation comment to satisfy a literal substring grep would be a worse outcome than a known, template-consistent acceptance-criteria quirk.

## Issues Encountered

- Fresh worktree had no `node_modules` and `packages/shared` had no built `dist/` output (same pattern as every prior Phase 42 wave-3/4 worktree). Ran `pnpm install --frozen-lockfile` then `pnpm --filter @counter-attack/shared build` before any verification command could succeed. Not a plan deviation — infrastructure setup only.
- No `vitest --pool=forks` worker-crash flake was observed during this plan's verification runs (unlike 42-02/03/05) — full suites ran clean on the first attempt each time.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `GAME_ROSTER_REPOSITION` exists end to end: wire contract (`packages/shared`), pure engine function (`applyRosterReposition`), and socket handler — ready for 42-07's client-side drag-and-drop wiring.
- The swap's identity-follows-slot model is proven to survive `applyRosterContinuity` (goal/half-time resets) by a dedicated test, so 42-07/42-08 can build the client interaction without re-verifying reset survival.
- All rejection reasons (`WRONG_PHASE`, `INVALID_REPOSITION`, `GK_SLOT_LOCKED`, `REPOSITION_BALL_CARRIER`, plus handler-level `WRONG_TEAM`) reach the client verbatim via `GAME_ERROR` — 42-07 can wire client-side messaging directly off these strings, and `GK_SLOT_LOCKED` specifically reuses the existing client copy with zero client-side change needed.
- **Known gap for a future plan (42-09 or later):** `ActionLog.tsx`'s `formatEvent` switch needs a `case 'ROSTER_REPOSITION':` arm — currently causes a `tsc` exhaustiveness error (client test suite unaffected). Flagged, not fixed, per this plan's own verification note.
- No blockers. Full shared suite (863) and server suite (1490, +24 from this plan) green; typecheck clean on shared/server; eslint clean on every touched file.

## Self-Check: PASSED

- FOUND: `packages/shared/src/types.ts`
- FOUND: `packages/shared/src/events.ts`
- FOUND: `packages/shared/src/events.test.ts`
- FOUND: `packages/server/src/gameEngine.ts`
- FOUND: `packages/server/src/gameHandlers.ts`
- FOUND: `packages/server/src/__tests__/gameEngine.rosterReposition.test.ts`
- FOUND: `packages/server/src/__tests__/gameHandlers.rosterReposition.test.ts`
- FOUND commit `20a91fd` (Task 1)
- FOUND commit `99a70ff` (Task 2)
- FOUND commit `8858aff` (Task 3)

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_
