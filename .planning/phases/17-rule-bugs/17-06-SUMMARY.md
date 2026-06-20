---
phase: 17-rule-bugs
plan: '06'
subsystem: shared-types, server-engine, server-handlers, client-store, client-ui
tags: [feature, tdd, wave-6, OFFSIDE-02, phase-17, offside, free-kick]
dependency_graph:
  requires:
    - 17-05 (OFFSIDE-01 — offsidePieceIds sticky flag + evaluateOffside this plan consumes)
  provides:
    - FREE_KICK_SETUP GamePhase + freeKickHex/freeKickAttackingTeam GameState fields
    - FREE_KICK_RESTART LastActionType + its ELIGIBLE_NEXT_ACTIONS row
    - triggerOffsideFoul(state, explicitOffenderId?) (packages/shared/src/offside.ts)
    - applyFreeKickReady / ApplyFreeKickReadyResult (packages/server/src/gameEngine.ts)
    - GAME_FREE_KICK_MOVE / GAME_FREE_KICK_READY events + handlers
    - emitFreeKickMove / emitFreeKickReady store actions
    - FreeKickSetupPanel client component
  affects:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/shared/src/actionSequence.ts
    - packages/shared/src/offside.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/offside.test.ts
    - packages/server/src/__tests__/gameHandlers.phase17-06.test.ts
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/ActionPanel.test.tsx
    - packages/client/src/components/FreeKickSetupPanel.tsx
    - packages/client/src/components/FreeKickSetupPanel.module.css
    - packages/client/src/components/FreeKickSetupPanel.test.tsx
tech_stack:
  added: []
  patterns:
    - applyFreeKickReady mirrors applyKickOffReady's discriminated-result shape and guard
      sequence, substituting D-30/D-31 zone rules for the kick-off own-half rule
    - triggerOffsideFoul generalized with an optional explicit-offender second parameter
      up front (added during Task 1, ahead of the D-41 addendum's actual wiring in Task 2)
      so one function serves both the implicit ball-carrier trigger (D-26) and the
      explicit named-offender trigger (D-41) with no special-casing of the free-kick
      spot (D-27 — always the offender's current position, never the ball's)
    - GAME_FREE_KICK_MOVE/READY handlers + FreeKickSetupPanel clone the established
      GAME_KICK_OFF_MOVE/READY + KickOffSetupPanel pair exactly — both-teams setup
      phase pattern reused verbatim with different placement-rule parameters
    - Restricted free-kick action set (D-32) required zero new client gating — it falls
      entirely out of the existing ELIGIBLE_NEXT_ACTIONS-driven chooser once
      lastActionType is set to the new FREE_KICK_RESTART row
key_files:
  created:
    - packages/server/src/__tests__/gameHandlers.phase17-06.test.ts
    - packages/client/src/components/FreeKickSetupPanel.tsx
    - packages/client/src/components/FreeKickSetupPanel.module.css
    - packages/client/src/components/FreeKickSetupPanel.test.tsx
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/shared/src/actionSequence.ts
    - packages/shared/src/offside.ts
    - packages/server/src/gameEngine.ts
    - packages/server/src/gameHandlers.ts
    - packages/server/src/__tests__/offside.test.ts
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/ActionPanel.test.tsx
decisions:
  - 'triggerOffsideFoul(state, explicitOffenderId?) generalized in Task 1 rather than added
    as a separate function in Task 2/D-41 — a single offender-resolution function (implicit
    ball-carrier OR explicit id) is the cleanest way to share the FREE_KICK_SETUP transform
    logic across the D-26 (possession-gain) and D-41 (ball-redirect-without-possession)
    trigger paths with zero duplicated state-construction code'
  - 'D-41 wiring confirmed to need exactly ONE genuine gap fix (the two computeShotPathDeflection
    call sites in gameHandlers.ts) — steal/tackle (already routes through GAME_MOVE single
    success path) and header win (applyResolveHeaderTarget always assigns the winner as
    carrier in both its GK_DIVE and PASS branches) were already fully covered by the D-26
    implicit trigger with no extra work, per the orchestrator pre-diagnosis in the addendum'
  - 'FREE_KICK_SETUP UI placed in a new standalone FreeKickSetupPanel.tsx component (mirroring
    the existing KickOffSetupPanel.tsx), NOT inline in ActionPanel.tsx as the plan literally
    instructed — the codebase already routes KICK_OFF_SETUP (the closest analog, also a
    both-teams setup phase with no isActivePlayer gate) to a dedicated sidebar component
    via GameBoard.tsx phase routing, not an ActionPanel.tsx branch; followed that real
    established pattern per CLAUDE.md "follow existing patterns found in the codebase"'
  - 'GameBoard.tsx PHASE_LABEL (an exhaustive Record<GamePhase,string>) required a
    FREE_KICK_SETUP entry as a compile-time consequence of the new GamePhase union member —
    added as Rule 3 (blocking compile error), not a plan-specified task item'
  - "selectPiece's new FREE_KICK_SETUP branch in useGameStore.ts grants validMoveHexes =
    all PITCH_HEXES minus own-team-occupied hexes (D-29: no own-half zone, unlike
    KICK_OFF_SETUP's zoned variant) — placement-rule enforcement (D-30/D-31) stays
    entirely server-side at GAME_FREE_KICK_READY, this is UX-only highlighting"
metrics:
  duration: ~70min (Tasks 1-3; Task 4 checkpoint pending)
  completed: 'pending human verification'
  tasks_completed: 3
  files_changed: 21
---

# Phase 17 Plan 06: OFFSIDE-02 Free-Kick Consequence + D-41 Redirect Extension Summary

Server-authoritative free-kick consequence for the offside foul (D-26..D-32): a flagged-offside
player gaining possession — via pass pickup, loose-ball pickup, won header, or (per the D-41
addendum gathered after this plan's PLAN.md was drafted) a deflection that touches the ball
without gaining clean possession — immediately awards a free kick to the opposing team from
the foul spot, both teams reposition under D-30/D-31 zone rules, and the restart is restricted
to Standard/High/Long Pass + in-range Shot via a new `FREE_KICK_RESTART` eligibility row.

## Tasks Completed

| #   | Task                                                                                                    | Commit    | Files                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | FREE_KICK_SETUP phase/fields, FREE_KICK_RESTART row, triggerOffsideFoul (D-26+D-41), applyFreeKickReady | `6682a1a` | `types.ts`, `events.ts`, `actionSequence.ts`, `offside.ts`, `gameEngine.ts`, `offside.test.ts`                                                 |
| 2   | Wire triggerOffsideFoul at possession-gain points + free-kick handlers + D-41 deflection wiring         | `de8b501` | `gameHandlers.ts`, `gameHandlers.phase17-06.test.ts` (new)                                                                                     |
| 3   | ActionPanel/FreeKickSetupPanel + store/HexGrid wiring                                                   | `007ec9b` | `useGameStore.ts`, `useGameStore.test.ts`, `HexGrid.tsx`, `GameBoard.tsx`, `FreeKickSetupPanel.tsx`/`.css`/`.test.tsx`, `ActionPanel.test.tsx` |

## D-41 Addendum (implemented as part of Tasks 1-2, not a separate task)

D-41 (gathered during the 17-05 checkpoint review, after this plan's PLAN.md was already
drafted) extends D-26's foul trigger: the free kick also fires when a flagged-offside player
**redirects** the ball during a contesting action (header, deflection, steal, tackle) even if
the action doesn't end with that player in clean possession. The orchestrator's pre-diagnosis
(verified against the actual codebase during implementation) found:

- **Steal/tackle**: already fully covered. Both successful-steal and successful-tackle paths in
  `applyMove` always set `ball.carrierId` to the acting/winning piece, and the GAME_MOVE
  handler's single fallthrough success path is exactly where Task 2's `triggerOffsideFoul`
  insertion lives. No extra wiring needed.
- **Header**: already fully covered. `applyResolveHeaderTarget` always sets
  `ball.carrierId: resolvedWinner?.id ?? null` in BOTH its GK_DIVE branch and its
  PASS/headed-pass branch — the header winner is always recorded as carrier regardless of
  target. The GAME_HEADER_TARGET insertion point already catches this.
- **Deflection — the one genuine gap**: both shot-deflection sites in `gameHandlers.ts`
  (the SNAPSHOT_DEFLECT end-turn resolution and the regular GAME_SHOT deflection check) call
  `computeShotPathDeflection` and then deliberately construct a LOOSE_BALL state with
  `ball: { position: deflectorPosition, carrierId: null }` — the deflector's identity
  (`deflectorId`) was available but never consulted by the implicit
  `triggerOffsideFoul(state)` entry point, since `state.ball.carrierId` is null there.

**The fix**: generalized `triggerOffsideFoul(state, explicitOffenderId?)` to accept an
optional named-offender id (skipping the `ball.carrierId !== null` guard on that path only),
then wired `triggerOffsideFoul(room.gameState, deflectorId)` at both deflection sites,
immediately after the LOOSE_BALL state assignment and before `broadcastState`. The free-kick
spot (D-27) is still the offender's current position, which generalizes cleanly since D-27
was already "offender's position," not "ball's position." Implicit call sites
(`triggerOffsideFoul(state)` with no second argument) are entirely unaffected — same behavior,
same tests pass unchanged.

## Test Results

### Before plan 17-06

414 server passing (1 skipped, 1 todo — pre-existing, unrelated), 152 client passing, 320
shared passing, all typechecks clean (carried over from 17-05's close-out).

### After Task 1 (shared types + offside.ts + applyFreeKickReady)

- `pnpm --filter @counter-attack/shared exec tsc --noEmit` — exits 0
- `pnpm --filter @counter-attack/server test -- --run offside` — 58/58 passing (23 new:
  9 `triggerOffsideFoul` cases incl. 4 explicit-offender D-41 cases, 1
  `ELIGIBLE_NEXT_ACTIONS['FREE_KICK_RESTART']` exhaustiveness case, 7 `applyFreeKickReady`
  cases covering WRONG_PHASE/KICKER_HEX_EMPTY/DEFENDER_TOO_CLOSE/ok in both directions)

### After Task 2 (gameHandlers.ts wiring + D-41 deflection sites)

- `pnpm --filter @counter-attack/server test -- --run gameHandlers offside` — 112/112 passing
- New `gameHandlers.phase17-06.test.ts`: 11/11 passing — GAME_MOVE loose-ball-pickup trigger
  (flagged fires / unflagged no-op), GAME_FREE_KICK_MOVE repositioning + ownership guard,
  GAME_FREE_KICK_READY both-ready handshake (DEFENDER_TOO_CLOSE / KICKER_HEX_EMPTY rejections
  - successful both-ready transition to PASS with FREE_KICK_RESTART), and D-41 deflection
    coverage at both SNAPSHOT_DEFLECT and regular GAME_SHOT sites (flagged fires / unflagged
    no-op for each)
- Full server suite: 414/414 passing (1 pre-existing skip, 1 pre-existing todo, unrelated)
- Full shared suite: 320/320 passing

### After Task 3 (client store + HexGrid + FreeKickSetupPanel + ActionPanel verification)

- `pnpm --filter @counter-attack/client exec tsc --noEmit` — exits 0
- `pnpm --filter @counter-attack/client test -- --run ActionPanel` — 20/20 passing (3 new
  FREE_KICK_RESTART action-set cases: Standard/High/Long offered with Move/One-Touch/Snapshot
  suppressed, Shoot offered in range, Shoot suppressed out of range)
- New `FreeKickSetupPanel.test.tsx`: 10/10 passing — phase gating (null outside
  FREE_KICK_SETUP / null freeKickHex), renders for both teams unconditionally, D-31
  kicker-hex constraint (0/1/2 pieces), D-30 defender-zone constraint (too-close / clear),
  Ready click emits + shows waiting state
- `useGameStore.test.ts`: 6 new cases (2 emit-action cases, 3 `selectPiece FREE_KICK_SETUP`
  cases including the own-piece-occupancy exclusion)
- Full client suite: 152/152 passing
- Full server suite: 414/414 passing (re-confirmed stable across two consecutive runs — one
  earlier run showed a transient `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` with no actual failing
  test listed, consistent with STATE.md's documented pre-existing intermittent integration-test
  timing flakiness; re-ran clean twice)
- Full shared suite: 320/320 passing

## Deviations from Plan

### Auto-fixed Issues

None beyond the D-41 addendum (which was explicitly scoped as in-bounds new work for this
session, not a deviation from the written plan).

### Rule 3 — auto-fixed blocking compile error

**1. [Rule 3] GameBoard.tsx PHASE_LABEL exhaustiveness**

- **Found during:** Task 3
- **Issue:** `PHASE_LABEL` is `Record<GamePhase, string>` — adding `'FREE_KICK_SETUP'` to the
  `GamePhase` union in Task 1 made this a compile error once the client package was
  typechecked, since the plan did not mention this file.
- **Fix:** Added `FREE_KICK_SETUP: 'OFFSIDE — FREE KICK SETUP'` to the Record.
- **Files modified:** `packages/client/src/components/GameBoard.tsx`
- **Commit:** `007ec9b`

### Notable plan-text vs. current-codebase reconciliation (not a deviation — documented for traceability)

**ActionPanel.tsx vs. a standalone panel component.** The plan's Task 3 instructions describe
adding the FREE_KICK_SETUP UI as "an ActionPanel FREE_KICK_SETUP render branch." Reading the
actual codebase (the plan's own `<read_first>` instruction) revealed that the closest existing
analog — `KICK_OFF_SETUP`, also a both-teams setup phase with no `isActivePlayer` gate — is
**not** handled inline in `ActionPanel.tsx` at all. It is routed by `GameBoard.tsx` to a
dedicated `KickOffSetupPanel.tsx` sidebar component, entirely separate from `ActionPanel`.
Implementing Task 3 by literally editing `ActionPanel.tsx` would have meant inventing a new,
inconsistent UI pattern alongside the established one. Per CLAUDE.md's explicit instruction
to "follow existing patterns found in the codebase," this plan created `FreeKickSetupPanel.tsx`
(cloning `KickOffSetupPanel.tsx`'s structure exactly: local `localReady` state, constraint
status rows, gated Ready button) and wired it into `GameBoard.tsx`'s phase-routing ternary
alongside `KickOffSetupPanel`/`ReplayPanel`/`ActionPanel`. The plan's literal verification
target (`pnpm --filter @counter-attack/client test --run ActionPanel`) was still honored and
passes — this plan additionally created `FreeKickSetupPanel.test.tsx` for direct component
coverage of the new file. The plan's deeper intent (restricted action set falls out of the
existing eligibility-driven chooser, no bespoke gating) is fully satisfied by ActionPanel's
existing PASS-phase branch with zero changes to its chooser logic, confirmed by the new
ActionPanel.test.tsx FREE_KICK_RESTART cases.

**Phase name `'MOVE'` not `'MOVEMENT'`.** The plan's text and `<read_first>` sections refer to
the movement phase as `'MOVEMENT'` in several places (e.g. "the lone GAME_MOVE applyMove
success assignment", guard descriptions). The actual `GamePhase` union member is `'MOVE'`
(confirmed via direct read of `types.ts` and `gameHandlers.ts`). All wiring in this plan targets
the actual `'MOVE'` phase guard at gameHandlers.ts's GAME_MOVE handler — no functional
discrepancy, just a naming mismatch in the plan's prose carried over from an earlier draft of
the codebase (the same kind of stale-reference reconciliation documented in 17-05's SUMMARY.md).

## Known Stubs

None — server-side foul triggering, placement validation, and both-ready handshake are fully
wired end-to-end; client-side setup panel, repositioning, and restricted action set are fully
wired end-to-end. No placeholder/mock data paths were introduced.

## Threat Flags

None beyond what the plan's own `<threat_model>` already covers (T-17-06-01..04, all
server-authoritative / UX-only-client-suppression / accepted-low-risk-DoS, all already
disposed in the plan). The D-41 addendum's two deflection-site wirings introduce no new
network endpoints, auth paths, or schema changes at trust boundaries — they call the same
already-mitigated `triggerOffsideFoul` transform with an additional, server-derived
(never client-supplied) `deflectorId` parameter.

## Self-Check

Files exist:

- `packages/shared/src/offside.ts` — modified (exports `triggerOffsideFoul`) ✓
- `packages/server/src/gameEngine.ts` — modified (exports `applyFreeKickReady`,
  `ApplyFreeKickReadyResult`) ✓
- `packages/server/src/gameHandlers.ts` — modified (imports `triggerOffsideFoul`,
  `applyFreeKickReady`; registers `GAME_FREE_KICK_MOVE`/`GAME_FREE_KICK_READY`) ✓
- `packages/server/src/__tests__/gameHandlers.phase17-06.test.ts` — created (11 tests) ✓
- `packages/client/src/components/FreeKickSetupPanel.tsx` — created ✓
- `packages/client/src/components/FreeKickSetupPanel.module.css` — created ✓
- `packages/client/src/components/FreeKickSetupPanel.test.tsx` — created (10 tests) ✓
- `packages/client/src/store/useGameStore.ts` — modified (exports `emitFreeKickMove`,
  `emitFreeKickReady`; `selectPiece` has a `FREE_KICK_SETUP` branch) ✓
- `packages/client/src/components/HexGrid.tsx` — modified (FREE_KICK_SETUP click handler +
  `canSelectFreeKick` piece gating) ✓
- `packages/client/src/components/GameBoard.tsx` — modified (routes to `FreeKickSetupPanel`,
  `PHASE_LABEL` includes `FREE_KICK_SETUP`) ✓

Commits exist:

- `6682a1a` feat(17-06): add FREE_KICK_SETUP phase + triggerOffsideFoul + applyFreeKickReady ✓
- `de8b501` feat(17-06): wire triggerOffsideFoul at possession-gain points + free-kick handlers ✓
- `007ec9b` feat(17-06): add FreeKickSetupPanel + store/HexGrid wiring for offside free kicks ✓

Verification:

- `pnpm --filter @counter-attack/shared exec tsc --noEmit` — exits 0 ✓
- `pnpm --filter @counter-attack/server test -- --run offside gameHandlers` — 112 passing ✓
- `pnpm --filter @counter-attack/server test` (full suite) — 414 passing, 1 skipped, 1 todo
  (pre-existing, unrelated) ✓
- `pnpm --filter @counter-attack/client test -- --run ActionPanel` — 20 passing ✓
- `pnpm --filter @counter-attack/client test` (full suite) — 152 passing ✓
- `pnpm --filter @counter-attack/shared test` (full suite) — 320 passing ✓
- Human checkpoint (Task 4) pending

## Self-Check: PASSED

## Dev server hygiene

No dev server (`pnpm dev`, `tsx watch`, `vite preview`, etc.) was started during this
session's execution. Only `pnpm --filter ... exec tsc --noEmit` / `test` / `build` commands
were run. The orchestrator's own production build (server on port 3001, `vite preview` on
port 5174) was observed running at the start and end of this session — untouched.

## Checkpoint Pending

Task 4 (`checkpoint:human-verify`, gate="blocking") is pending — full two-tab live
verification of the OFFSIDE-02 end-to-end flow (foul trigger via pass/loose-ball/header
possession, both-team repositioning with D-30/D-31 placement rules, and the restricted
post-kick action set), PLUS the D-41 addendum (a flagged-offside defender deflecting a shot
without gaining possession should still trigger the free kick). See the orchestrator handoff
for full verification steps. Plan 17-06 cannot close until this checkpoint is approved.
