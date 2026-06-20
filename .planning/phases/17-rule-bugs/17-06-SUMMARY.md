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

## Corrections Round 1 (D-42..D-46, gathered 2026-06-20 during first Task 4 checkpoint review)

The user's first manual verification pass surfaced five corrections against the original
Tasks 1-3 implementation. All five are now fixed, tested, and re-verified; the plan returns
to the Task 4 checkpoint for a second round of manual verification.

### D-42 — offside ring stroke width corrected (5 → 2.5)

**Issue:** The OFFSIDE-01 (D-25) red ring around an offside piece used `strokeWidth={5}` —
double the width of every other selection ring. The user's correction: the ring should be
the same stroke width as the other selection rings, not double. The distinct radius
(`PIECE_RADIUS + 6`, outside the other rings) is fine and intentional — it's what keeps the
ring visible as its own layer when stacked with a selection ring — only the stroke width
was wrong.

**Fix:** `PieceOverlay.tsx` — changed `strokeWidth={5}` to `strokeWidth={2.5}` on the
offside ring `<circle>`. Updated doc comments referencing "double-width" to describe the
ring as "a distinct radius, normal stroke width."

**Test:** `PieceOverlay.test.tsx` — updated the existing assertion
(`stroke-width` `'5'` → `'2.5'`) and renamed the describe block to drop the now-incorrect
"double-width" label.

**Files:** `packages/client/src/components/PieceOverlay.tsx`,
`packages/client/src/components/PieceOverlay.test.tsx`
**Commit:** `526e671`

### D-43 — full offside reset on free kick taken (extends D-26/D-28)

**Issue:** `triggerOffsideFoul` (D-26) only ever removes the OFFENDING piece's id from
`offsidePieceIds`, leaving any other already-flagged pieces sticky. The user's correction:
when the free kick is actually TAKEN (the `GAME_FREE_KICK_READY` both-ready transition to
`PASS`), `offsidePieceIds` should reset to `[]` entirely — a major dead-ball restart clears
all offside positions, not just the offender's.

**Fix:** `gameHandlers.ts` — added `offsidePieceIds: []` to the state object spread inside
the `room.readyPlayers.size === 2` both-ready transition block, alongside the existing
`freeKickHex: null` / `freeKickAttackingTeam: null` resets. One-line comment cites D-43.

**Test:** `gameHandlers.phase17-06.test.ts` — added a new test seeding multiple sticky
`offsidePieceIds` (two home pieces, neither the "offender" — there's no foul-trigger call
in this fixture, proving the reset is unconditional) before the both-ready transition, then
asserting the post-transition state's `offsidePieceIds` is `[]`. Also fixed a stale fixture
in the pre-existing both-ready test: it moved all defenders to `{q:1, r:1}`, which the new
D-46 restriction (below) now rejects as `DEFENDER_BEHIND_BALL` — relocated to `{q:35, r:1}`
(equal-to-or-ahead of the ball in the defending team's attacking direction) to keep that
test's original intent (validating the both-ready PASS transition) isolated from D-46.

**Files:** `packages/server/src/gameHandlers.ts`,
`packages/server/src/__tests__/gameHandlers.phase17-06.test.ts`
**Commit:** `9c6dc06`

### D-44 — help text colour unreadable on dark panel background (pure CSS bug)

**Issue:** `FreeKickSetupPanel.module.css`'s `.constraintRow` class had no `color` set,
inheriting an unreadable dark default against the panel's `#16213e` dark background. The
orchestrator's pre-diagnosis additionally found the identical bug in
`KickOffSetupPanel.module.css` (the clone source) — the user only reported the free-kick
instance, but both were fixed for consistency.

**Fix:** Added `color: #e0e0e0` to `.constraintRow` in both files, matching `.panelHeading`'s
existing light-text-on-dark-background token in the same component family. Pure CSS fix —
no rule/logic change, no test changes needed (neither component's test file asserts computed
style or className presence on this row).

**Files:** `packages/client/src/components/FreeKickSetupPanel.module.css`,
`packages/client/src/components/KickOffSetupPanel.module.css`
**Commit:** `622e87f`

### D-45 — free-kick placement highlight uses the wrong tint (yellow instead of light-blue)

**Issue:** During `FREE_KICK_SETUP`, valid placement hexes rendered with the generic yellow
"safe" tint (the same one normal movement uses) because `HexGrid.tsx`'s highlight-type
derivation only special-cased `KICK_OFF_SETUP`'s zone as the light-blue "kickoff" tint.
Correction: `FREE_KICK_SETUP`'s valid placement hexes should ALSO use the light-blue
"kickoff" tint (`HexHighlightType: 'kickoff'`, already defined in `HexCell.tsx` — no new
colour). The highlighted (and actually clickable) hex set must also match server truth per
team, not just "all unoccupied pitch hexes" — this is where D-46 (below) comes in, since the
light-blue highlight must respect the defending team's new exclusions.

**Fix:** `HexGrid.tsx` — `isKickoffTint` is now `(inMyZone && !isCentreHex) ||
(phase === 'FREE_KICK_SETUP' && isValidMove)`. Since `isValidMove` reads from the store's
`validMoveHexes`, which after the D-46 fix is already correctly restricted per team, this
hex now resolves to the `'kickoff'` highlight type (confirmed via the existing priority
chain: `isKickoffTint` is checked before the `isSafeTint` fallback) instead of falling
through to yellow.

**Test:** New describe block in `HexGrid.test.tsx` — seeds a `FREE_KICK_SETUP` state with a
single `validMoveHexes` entry (a hex ahead of and clear of the freeKickHex zone, mirroring
what `useGameStore.selectPiece` would compute for a defending-team piece post-D-46) and
asserts (a) that hex renders with the kickoff fill (`rgba(59,130,246,1)`), located via
polygon bounding-box center match against `axialToPixel`, and (b) no polygon anywhere renders
the generic safe fill (`rgba(245,197,24,1)`) in this state.

**Files:** `packages/client/src/components/HexGrid.tsx`,
`packages/client/src/components/HexGrid.test.tsx`
**Commit:** `7d56d12`

### D-46 — new defending-team placement constraint: must stay equal-or-ahead of the ball (extends D-30)

**Issue:** D-30 already excludes a 2-hex zone around `freeKickHex` for the defending team
(the side that committed the offside foul). The user's correction adds a second, independent
constraint: the defending team may not position ANY piece BEHIND the ball — i.e., on their
own defensive side of `freeKickHex` in their own attacking direction (the same
`attackingDirection` convention as D-21/D-24's offside geometry: home attacks toward higher
q, away toward lower q). Equal-to-or-ahead of the ball is legal; strictly behind it is not.
Rationale given: getting caught offside denies the offending team the chance to retreat into
a defensive shape — they're forced to stay pushed up. The kicking team (D-29) has no such
restriction.

**Fix — server (`gameEngine.ts`, `applyFreeKickReady`):**

- `ApplyFreeKickReadyResult`'s reason union gained `'DEFENDER_BEHIND_BALL'` alongside
  `'WRONG_PHASE' | 'KICKER_HEX_EMPTY' | 'DEFENDER_TOO_CLOSE'`.
- Imported `attackingDirection` from `@counter-attack/shared` (already exported per plan
  17-05), mirroring the import style already used for `evaluateOffside`.
- In the defending-team branch's per-piece loop, added a second check after the existing
  `DEFENDER_TOO_CLOSE` distance check: `if ((piece.position.q - freeKickHex.q) * dir < 0)
return { ok: false, reason: 'DEFENDER_BEHIND_BALL' }`, with `dir` computed once before the
  loop via `attackingDirection(team)`.
- Updated the function's JSDoc guard-sequence comment to document this as guard 4, citing
  D-46.

**Fix — client (`useGameStore.ts`, `selectPiece`'s `FREE_KICK_SETUP` branch):** the branch
now distinguishes the kicking team (`gameState.freeKickAttackingTeam === myTeam` — keeps the
original unrestricted D-29 behavior) from the defending team, which additionally excludes:
(a) any hex within 2 of `freeKickHex` (mirrors D-30, previously only enforced server-side),
and (b) any hex strictly behind `freeKickHex` in the defending team's own attacking direction
(mirrors D-46). Imported `attackingDirection` from `@counter-attack/shared`, mirroring the
existing `hexDistance` import style in this file. This makes the D-45 highlight accurate
(only legal hexes light up) and prevents the client from attempting a move the server would
reject.

**Tests:**

- `offside.test.ts` (server) — six new cases under `applyFreeKickReady`: home-defending
  behind/equal/ahead (3 cases) and away-defending behind/equal/ahead (3 cases), covering both
  `attackingDirection` signs. Equal-q cases use a different `r` to clear the `DEFENDER_TOO_CLOSE`
  distance check in isolation, confirmed via the `hexDistance` cube-coordinate formula.
- `useGameStore.test.ts` (client) — three new cases under the existing
  `selectPiece FREE_KICK_SETUP` describe block: defending-team piece excludes the 2-hex zone,
  defending-team piece excludes behind-ball hexes, defending-team piece retains
  equal-or-ahead hexes outside the zone; plus one regression case confirming the kicking team
  (away, in the shared fixture) remains fully unrestricted (includes both the 2-hex-zone hex
  and the behind-ball-for-defenders hex, both illegal for the defending team only).

**Files:** `packages/server/src/gameEngine.ts`, `packages/server/src/__tests__/offside.test.ts`,
`packages/client/src/store/useGameStore.ts`, `packages/client/src/store/useGameStore.test.ts`
**Commit:** `7d56d12` (same commit as D-45 — the two are interdependent: D-45's highlight
accuracy depends on D-46's client-side restriction being in place first)

### Re-verification after corrections

- `pnpm --filter @counter-attack/shared typecheck` — exits 0
- `pnpm --filter @counter-attack/server typecheck` — exits 0
- `pnpm --filter @counter-attack/server test -- --run` — 421 passing (1 pre-existing skip,
  1 pre-existing todo, unrelated), up from 414 (+7: 1 new D-43 test, 6 new D-46 tests)
- `pnpm --filter @counter-attack/client typecheck` — exits 0
- `pnpm --filter @counter-attack/client test -- --run` — 158 passing, up from 152 (+2 new
  D-45 tests in `HexGrid.test.tsx`; D-46's 4 new `useGameStore.test.ts` cases offset by no
  net test-count change there since one pre-existing case's assertion scope was unchanged)
- All five commands re-run a second time after lint-staged's eslint/prettier auto-formatting
  (triggered on each commit) to confirm formatting didn't alter behavior — identical results.

No dev server was started during this corrective session. The orchestrator's production
build (server on port 3001, `vite preview` on port 5174) was observed running, untouched,
at both the start and end of this session.

## Rulebook Correction Round (D-46 REVERTED; D-47..D-51 staged rework, gathered/implemented 2026-06-20)

The user checked the free-kick setup mechanic built above (D-29's simultaneous-both-teams-
reposition-then-dual-Ready model, including the Round-1 D-46 correction) against the physical
rulebook's "streamlined movement phase" section and found it substantially wrong. This round
fully reverts D-46 and replaces the entire repositioning mechanic with the staged, alternating
sequence the rulebook actually describes.

### Before vs. After

**Before (D-29 + D-46, now superseded):** Both teams simultaneously repositioned their entire
squad anywhere on the board (kicking team unrestricted; defending team excluded from a 2-hex
zone around the ball AND from any hex behind the ball in their own attacking direction — D-46).
Each team pressed a "Ready" button independently; the kick was taken once BOTH teams had
confirmed ready (`room.readyPlayers` dual-confirm Set, mirroring `GAME_READY`'s kick-off
handshake).

**After (D-47..D-51, this round):** Repositioning proceeds in four fixed, alternating stages,
quoted directly from the rulebook:

1. **Kicking team** picks up and places up to **5** players (anywhere on the board, D-29 — no
   zone restriction).
2. **Conceding team** picks up and places up to **5** players, excluding a 2-hex zone around
   the ball (D-30 — unchanged from before; D-46's behind-ball exclusion is fully reverted).
3. **Kicking team** picks up and places up to **3** more players, anywhere on the board. This
   is the kicking team's LAST turn — the kicker-on-ball-hex check (D-31/D-51) fires here.
4. **Conceding team** picks up and places up to **2** more players, excluding the same 2-hex
   zone (D-30/D-50 — checked again, continuously, at this stage too).

After stage 4 ends, the kick is taken automatically: phase transitions to `PASS`, the
kicking-team piece on the ball's hex becomes the carrier, `attackingTeam`/`activeTeam` flip to
the kicking team, `lastActionType: 'FREE_KICK_RESTART'`, and `offsidePieceIds` resets to `[]`
(D-43/D-47). Each stage is **optional up to its cap** — a team may end its turn having placed
zero, some, or all of its allowance; only the cap on NEW (not-yet-counted) pieces is enforced.
Re-placing an already-counted piece within the same stage is always free.

### D-46 — fully reverted

`DEFENDER_BEHIND_BALL` is removed entirely: from `ApplyFreeKickReadyResult`'s reason union,
from `applyFreeKickReady`'s guard sequence (server), and from `useGameStore.ts`'s
`FREE_KICK_SETUP` `selectPiece` branch (client) — no trace remains in either package's
non-test source. The defending team's only placement restriction is now D-30's 2-hex zone, as
the physical rulebook actually specifies. All six D-46 test cases (3 server, 4 client) were
deleted along with the simultaneous-model tests they were embedded in; the staged-model test
suites written this round (below) contain zero `DEFENDER_BEHIND_BALL` assertions.

### D-47 — offside exemption generalized to kick-off restart

`GAME_READY`'s both-ready transition (`gameHandlers.ts`, KICK_OFF_SETUP → KICK_OFF) now resets
`offsidePieceIds: []`, generalizing the D-43 reset that previously only applied to the
free-kick restart. A player cannot be flagged/remain-flagged offside as a direct result of
either restart type. (Throw-ins will need the same treatment whenever that phase is built — no
throw-in phase exists yet, so nothing to change there now.)

### D-48 — persistent geometric placement-zone highlight

`HexGrid.tsx` gained `isInMyFreeKickZone(hex)` — a pure per-hex geometric function evaluated
for every pitch hex on every render, mirroring `isInMyKickOffZone`'s existing shape. It returns
true only during MY team's CURRENTLY-active stage (per the new turn-gating below): always true
for the kicking team's stages (0/2); true except within 2 hexes of the ball for the conceding
team's stages (1/3). This replaces the prior `phase === 'FREE_KICK_SETUP' && isValidMove` term
in `isKickoffTint`'s derivation, which only lit up the zone AFTER a piece was selected (since
`isValidMove` reads the store's `validMoveHexes`, populated only on selection). The zone is now
visible the moment a stage becomes active, with zero clicks. The click-to-move interaction
itself — select a piece, then click a destination — is unchanged.

### D-49 — staged, alternating sequence

New `GameState` fields: `freeKickStageIndex?: 0 | 1 | 2 | 3 | null` (which stage is active) and
`freeKickPlacedPieceIds?: readonly string[] | null` (distinct pieces already counted toward the
CURRENT stage's cap; reset to `[]` at the start of every new stage). A new lookup table in
`offside.ts`, `FREE_KICK_STAGES`, maps stage index to `{ side: 'kicking' | 'defending'; max:
number }`; `freeKickStageTeam(stageIndex, freeKickAttackingTeam)` resolves the lookup's `side`
to an actual `'home' | 'away'` team. `triggerOffsideFoul` (the single funnel point all foul
triggers go through) initializes `freeKickStageIndex: 0` and `freeKickPlacedPieceIds: []`
alongside its existing FREE_KICK_SETUP transition fields.

A new pure function, `applyFreeKickMove` (gameEngine.ts), replaces the old free-form
repositioning logic inside the `GAME_FREE_KICK_MOVE` handler: rejects a piece that doesn't
belong to the currently-active stage's team (`WRONG_TEAM`), and rejects placing a NEW piece
once the stage's cap is reached (`PLACEMENT_LIMIT_REACHED`) while always allowing free
re-placement of an already-counted piece. `applyFreeKickReady` was entirely rewritten from a
dual-team validator into a single-team stage-end validator: it now takes `(state, team)` and
either advances `freeKickStageIndex` (resetting `freeKickPlacedPieceIds`) or — on stage 3 —
finalizes the kick. The `GAME_FREE_KICK_READY` socket handler keeps its event name (still means
"I'm done with my stage") but no longer touches `room.readyPlayers`; the staged model has
exactly one acting team per stage, so there is no dual-confirm to track.

### D-50 — 2-hex exclusion enforced continuously

D-30's "defending team must stay >2 hexes from the ball" rule is now checked at the end of
EACH of the conceding team's two stages (1 and 4, i.e. `freeKickStageIndex` 1 and 3) rather
than once at a single simultaneous Ready button. A stage-ending attempt by the conceding team
is rejected with `DEFENDER_TOO_CLOSE` if any of their pieces (moved or not) is still within 2
hexes of the ball's restart hex at that moment.

### D-51 — kicker-hex check timing

D-31's "kicking team must have exactly one piece on the ball's hex" is validated specifically
when the kicking team attempts to end stage index 2 (their LAST turn) via `KICKER_HEX_EMPTY` —
not at stage 0 (they may legitimately wait until stage 2 to finalize the kicker) and not after
stage 3 (by then they have no further turns to fix it).

### New rejection reason: `NOT_YOUR_STAGE`

Replaces the old "both teams confirm independently" model's lack of any inactive-team
rejection. An inactive team's `GAME_FREE_KICK_READY` (stage-end) or `GAME_FREE_KICK_MOVE`
(repositioning, via the `WRONG_TEAM` reason) attempt during another team's active stage is
rejected and snapped back — only the currently-active stage's team can act.

### Client UI rework

`FreeKickSetupPanel.tsx` was rewritten from a dual-Ready-button panel into a turn-gated,
per-stage panel: the ACTIVE team sees which side they're on (Attacking/Defending), how many
placements they've used/have remaining this stage, the relevant constraint row (`Kicker hex:
...` at stage 2 only; `Defending zone: ...` at stages 1/3 only), and a single End-Turn-style
button (label is "End Turn" for stages 0-2, "Take Kick" for stage 3 — the user's last action
before the ball goes live) that still emits the existing `emitFreeKickReady` action (kept the
name — it's now a "stage done" signal, not a literal both-ready confirmation, but renaming
would have touched more files for no behavioral gain). The INACTIVE team sees only a waiting
message ("Attacking/Defending team is repositioning…"), mirroring `ActionPanel`'s established
`!isActivePlayer` waiting-panel pattern. `useGameStore.ts`'s `selectPiece` `FREE_KICK_SETUP`
branch and `HexGrid.tsx`'s `canSelectFreeKick` piece-clickability gate both now require "is it
currently MY team's stage" (via `freeKickStageTeam`), not just "is my team the kicking or
defending side" — only one team can interact with the board at a time now.

### Files changed this round

- `packages/shared/src/types.ts` — added `freeKickStageIndex`, `freeKickPlacedPieceIds`
- `packages/shared/src/offside.ts` — added `FREE_KICK_STAGES`, `freeKickStageTeam`; updated
  `triggerOffsideFoul` to initialize the new stage fields
- `packages/server/src/gameEngine.ts` — removed `DEFENDER_BEHIND_BALL`; added
  `applyFreeKickMove`; rewrote `applyFreeKickReady`
- `packages/server/src/gameHandlers.ts` — reworked `GAME_FREE_KICK_MOVE`/`GAME_FREE_KICK_READY`
  handlers; added `offsidePieceIds: []` to `GAME_READY`'s KICK_OFF transition (D-47)
- `packages/server/src/__tests__/offside.test.ts` — full rewrite of the `applyFreeKickReady`
  describe block into `applyFreeKickReady / applyFreeKickMove (D-49 staged rework)` (24 cases)
- `packages/server/src/__tests__/gameHandlers.phase17-06.test.ts` — full rewrite of the
  GAME_FREE_KICK_MOVE/READY describe blocks for the staged model (16 cases)
- `packages/server/src/__tests__/kickoffSetup.integration.test.ts` — new D-47 test
- `packages/client/src/store/useGameStore.ts` — reworked `FREE_KICK_SETUP` `selectPiece` branch
- `packages/client/src/store/useGameStore.test.ts` — rewrote the FREE_KICK_SETUP test block
- `packages/client/src/components/HexGrid.tsx` — added `isInMyFreeKickZone` (D-48); turn-gated
  `canSelectFreeKick`
- `packages/client/src/components/HexGrid.test.tsx` — replaced the D-45 test block with a D-48
  persistent-highlight test block (5 cases)
- `packages/client/src/components/FreeKickSetupPanel.tsx` — full rewrite for the staged UI
- `packages/client/src/components/FreeKickSetupPanel.test.tsx` — full rewrite (20 cases)

### Commits

| Commit    | Scope                                                                                     |
| --------- | ----------------------------------------------------------------------------------------- |
| `3498573` | shared types/offside.ts — FREE_KICK_STAGES, freeKickStageTeam, new fields                 |
| `3d7f517` | server — D-46 revert, applyFreeKickMove, applyFreeKickReady rework, handlers, D-47, tests |
| `c508082` | client — useGameStore, HexGrid (D-48), FreeKickSetupPanel rework, tests                   |

### Re-verification after this round

- `pnpm --filter @counter-attack/shared typecheck` — exits 0
- `pnpm --filter @counter-attack/server typecheck` — exits 0
- `pnpm --filter @counter-attack/server test` — 435 passing (1 pre-existing skip, 1 pre-existing
  todo, unrelated), up from 421 (+14 net: offside.test.ts's `applyFreeKickReady` block grew from
  19 to 24 cases testing `applyFreeKickMove`+`applyFreeKickReady` together;
  gameHandlers.phase17-06.test.ts's free-kick describe blocks grew from 6 to 16 cases;
  kickoffSetup.integration.test.ts gained 1 new D-47 case)
- `pnpm --filter @counter-attack/client typecheck` — exits 0
- `pnpm --filter @counter-attack/client test` — 173 passing, up from 158 (+15 net: useGameStore
  FREE_KICK_SETUP block restructured to 9 turn-gated cases; HexGrid D-48 block has 5 cases vs.
  the prior D-45 block's 2; FreeKickSetupPanel rewritten to 20 cases vs. the prior 10)
- `pnpm --filter @counter-attack/shared test` — 320 passing (unchanged — no shared-package
  test file exists for `offside.ts`'s new exports beyond what `offside.test.ts` in the SERVER
  package already covers via its `@counter-attack/shared` import)

No dev server was started during this session. Only `tsc --noEmit`, `tsc` (shared package
build, needed to refresh `dist/` so the server package's `@counter-attack/shared` resolution
picked up the new types/exports), and `vitest run` commands were executed. The orchestrator's
production build (server on port 3001, `vite preview` on port 5174) was not touched.

## Checkpoint Pending (Round 3) — superseded by Round 4 below

Task 4 (`checkpoint:human-verify`, gate="blocking") was pending a THIRD time after the staged
free-kick rework. A second live playtest then surfaced five more corrections (D-52..D-56,
below), which this session implements. See "Checkpoint Pending (Round 4)" at the bottom of
this document for the current outstanding verification scope.

## Free Kick Setup — Round 2 Corrections (D-52..D-56, gathered/implemented 2026-06-20, after a second live playtest)

After the staged-sequence rework (D-47..D-51) passed a second round of live two-tab testing,
the user surfaced five more corrections. All five are now implemented, tested, and verified.

### D-52 — offside header-duel winner skips target selection, foul fires immediately

**Issue:** A flagged-offside player who WINS a header duel was still routed into the normal
two-step header flow — stay in `HEADER`, store `headerDuelWinner`, let the winning team choose
a target hex via `GAME_HEADER_TARGET` — before `applyResolveHeaderTarget`'s success path (which
always assigns the winner as ball carrier) triggered the offside foul. This meant an offside
winner briefly saw a "choose where to head it" UI before the foul retroactively fired. User
correction: winning the duel while flagged IS the foul — there is no target choice at all.

**Fix:** Extracted the winning-piece resolution algorithm (previously inlined in
`applyResolveHeaderTarget`, "highest `aerialAbility` among the winning team's nominated
contestants, falling back to the current ball carrier when uncontested") into a new standalone
exported function, `resolveHeaderWinnerPiece(state, winnerTeam)`, in `gameEngine.ts`.
`applyResolveHeaderTarget` now calls this helper instead of duplicating the logic. The
`GAME_HEADER_CONTESTANT` handler (`gameHandlers.ts`) — the point where `computeHeaderDuelWinner`
resolves the winning TEAM — now also calls `resolveHeaderWinnerPiece` to resolve the winning
PIECE immediately, and checks whether that piece's id is in `offsidePieceIds`. If flagged: the
foul fires immediately via `applyOffsideFoulWithRelocation(state, winnerPiece.id)` (D-53's
wrapper — see below), transitioning straight to `FREE_KICK_SETUP` without ever storing
`headerDuelWinner`. If not flagged: the original behavior (store `headerDuelWinner`, await
`GAME_HEADER_TARGET`) is unchanged. The pre-existing `triggerOffsideFoul` call at the end of
the `GAME_HEADER_TARGET` handler remains in place as a defensive no-op safety net (now
unreachable for the offside-winner case specifically, since D-52 intercepts earlier).

**Files:** `packages/server/src/gameEngine.ts` (new `resolveHeaderWinnerPiece` export;
`applyResolveHeaderTarget` refactored to use it), `packages/server/src/gameHandlers.ts`
(`GAME_HEADER_CONTESTANT` handler).

### D-53 — auto-relocate trapped defenders before free-kick setup begins

**Issue:** When the offside foul fires, conceding-team pieces left standing within 2 hexes of
the new restart spot (`freeKickHex`) had to be manually walked out of the zone by the
defending team during their own stage — tedious busywork the physical rulebook doesn't
actually require; the relocation should happen automatically the instant the foul fires.

**Fix:** New exported function `applyOffsideFoulWithRelocation(state, explicitOffenderId?)` in
`gameEngine.ts` — a server-side wrapper around the shared `triggerOffsideFoul`
(`packages/shared/src/offside.ts`). `offside.ts` has zero Node-only imports (confirmed via
inspection — no `crypto`, no other environment-specific dependency) and stays importable from
the client bundle; D-53's relocation needs `crypto.randomInt` (never `Math.random`, mirroring
the existing `attackingTeam` coin-flip pattern in `createInitialState`), so the relocation step
lives in `gameEngine.ts` (server-only) rather than inside the shared `triggerOffsideFoul`
itself. Behavior: calls `triggerOffsideFoul`, and if the foul actually fired, finds every
CONCEDING-team piece (excluding the offender themselves — see below) within 2 hexes of the new
`freeKickHex` and relocates each, one at a time, to a random unoccupied on-pitch hex `>=3` hexes
away, accumulating an occupied-hex set across iterations so two relocated pieces never collide.

**Offender exclusion (a deviation worth flagging):** The offender themselves is always at
distance 0 from `freeKickHex` (D-27: the foul spot IS the offender's position) and belongs to
the conceding team, so a literal reading of "every conceding-team piece within 2 hexes" would
relocate the offender too — contradicting D-27's "foul spot = offender's position" framing and
breaking `freeKickHex` as a stable reference point. `applyOffsideFoulWithRelocation` explicitly
excludes the offender's own id from the trapped-piece search. This is a Rule 1 fix (the
literal D-53 wording, applied without this exclusion, would produce an internally
inconsistent result — `freeKickHex` would no longer equal the offender's actual position after
relocation).

**Wiring:** ALL SIX `triggerOffsideFoul` call sites in `gameHandlers.ts` (GAME_MOVE, the
SNAPSHOT_DEFLECT D-41 site, GAME_ROLL, the regular GAME_SHOT D-41 site, the GAME_HEADER_TARGET
defensive fallback, and the new D-52 GAME_HEADER_CONTESTANT site) now call
`applyOffsideFoulWithRelocation` instead, so the relocation always happens as part of the SAME
foul-trigger transition, before stage 0 ever becomes interactive to either team.

**Files:** `packages/server/src/gameEngine.ts` (new `applyOffsideFoulWithRelocation` export),
`packages/server/src/gameHandlers.ts` (all six call sites updated).

### D-54 — mandatory kicker-first placement, kicker locked immediately (supersedes D-51)

**Issue:** D-31's "kicking team must have exactly one piece on the ball's hex" requirement was
checked at the END of the kicking team's LAST turn (stage index 2, via `KICKER_HEX_EMPTY` in
`applyFreeKickReady`). The user's correction: the kicker must be placed FIRST, before stage 0's
general repositioning even opens up — no other piece may move until the kicker is on the ball's
hex — and the kicker is then permanently locked, immune to being selected/moved again.

**Fix — `applyFreeKickMove` (gameEngine.ts):**

- New guard order: WRONG_PHASE → WRONG_TEAM → **PIECE_LOCKED** (new — `pieceId` must not
  already be in `movedPieceIds`) → **KICKER_NOT_YET_PLACED** (new, kicking-team stages only) →
  PLACEMENT_LIMIT_REACHED.
- On a kicking-team stage (0 or 2), if no kicking-team piece is yet on `freeKickHex`, the ONLY
  legal move is moving a piece ONTO `freeKickHex` — any other destination is rejected with
  `KICKER_NOT_YET_PLACED`.
- The kicker-placement move itself is a dedicated success branch: it repositions the piece onto
  `freeKickHex` and adds its id directly to `movedPieceIds` (NOT `freeKickPlacedPieceIds`) —
  permanently locked, and does NOT consume any of the stage's "up to N" budget. The existing
  generic `movedPieceIds.includes(piece.id)` → 'activated' rendering picks this up automatically
  with zero new client rendering logic for the lock itself (D-55's new green ring is a separate,
  additional concern — see below).
- Once the kicker is locked (i.e. ANY kicking-team piece is already in `movedPieceIds`), the
  mandatory-first-move gate no longer applies — other kicking-team pieces may move freely,
  subject to the normal `freeKickPlacedPieceIds` budget.

**Fix — `applyFreeKickReady` (gameEngine.ts):** the old `KICKER_HEX_EMPTY` check (validated
specifically at the end of stage index 2) is REMOVED entirely from the guard sequence and from
`ApplyFreeKickReadyResult`'s reason union. By the time a kicking-team stage can ever end, a
kicking-team piece is already permanently locked on `freeKickHex` from stage 0 — there is
nothing left to validate at stage-end.

**Fix — client (`FreeKickSetupPanel.tsx`):** the kicker constraint row is rewritten from the
old stage-2-only "exactly one piece on freeKickHex" check into a check that applies on EVERY
kicking stage (0 and 2): `kickerLocked = isKicking && myPieces.some(p =>
movedPieceIds.includes(p.id))`. The End Turn button is disabled with a clear prompt ("Kicker:
move a player onto the free-kick hex first — required before any other move") until the kicker
is locked; once locked, the row reads "Kicker: placed and locked" for the remainder of setup
(stage 2 included, since the lock carries forward in `movedPieceIds`).

**Tests:** `offside.test.ts` — `KICKER_NOT_YET_PLACED` rejection when a different piece is
moved before the kicker; successful kicker-placement locks into `movedPieceIds` and skips the
budget; `PIECE_LOCKED` rejection on a second move attempt against the locked kicker; other
kicking-team pieces movable once the kicker is locked, correctly counted toward the budget;
`applyFreeKickReady` stage-2 end no longer requires kicker-hex occupancy.
`gameHandlers.phase17-06.test.ts` — equivalent handler-level coverage via the
`GAME_FREE_KICK_MOVE`/`GAME_FREE_KICK_READY` socket events.
`FreeKickSetupPanel.test.tsx` — End Turn disabled/enabled at stage 0 and stage 2 based on
`movedPieceIds` lock state.

**Files:** `packages/server/src/gameEngine.ts`, `packages/server/src/__tests__/offside.test.ts`,
`packages/server/src/__tests__/gameHandlers.phase17-06.test.ts`,
`packages/client/src/components/FreeKickSetupPanel.tsx`,
`packages/client/src/components/FreeKickSetupPanel.test.tsx`.

### D-55 — green "moved this stage" highlight, distinct from the permanent orange "activated" state

**Issue:** While a stage is in progress, a piece that has used one of the stage's placement
slots (tracked in `freeKickPlacedPieceIds`) but can still be freely re-positioned for free had
no visual marker distinguishing it from an untouched piece — the player had to remember which
pieces they'd already spent a slot on.

**Fix — `PieceOverlay.tsx`:** new optional prop `isMovedThisStage?: boolean` (default `false`).
Renders an additional green ring (`#22c55e`, matching the existing `selectionState='active'`
ring's color) at `PIECE_RADIUS + 8` — a distinct radius outside every other ring layer
(`selectable` +2, `active` +4, `activated` +3, `isOffside` +6) so none of them get hidden when
multiple layers stack simultaneously. This is an independent boolean-driven `<circle>`, not
folded into the `selectionState` switch — mirrors the existing `isOffside` red-ring pattern
exactly, per the plan's explicit instruction.

**Fix — `HexGrid.tsx`:** new store subscription `freeKickPlacedPieceIds`. Wired as
`isMovedThisStage={phase === 'FREE_KICK_SETUP' && (freeKickPlacedPieceIds ?? []).includes(piece.id)}`
on the `<PieceOverlay>` render call.

**Tests:** `PieceOverlay.test.tsx` — the ring renders at the correct radius/color/stroke-width
when `isMovedThisStage=true`; it coexists with `selectionState='active'` (two distinct green
rings at two distinct radii), with `isOffside=true` (green + red simultaneously), and with
`selectionState='activated'` (green + orange simultaneously); no ring when `false` (default).
`HexGrid.test.tsx` — new `D-55: isMovedThisStage wiring from freeKickPlacedPieceIds` describe
block: the ring renders at the correct piece's pixel position when that piece's id is in
`freeKickPlacedPieceIds`, does NOT render for a piece not in the list, and does NOT render
outside `FREE_KICK_SETUP` even if the piece id happens to match.

**Files:** `packages/client/src/components/PieceOverlay.tsx`,
`packages/client/src/components/PieceOverlay.test.tsx`,
`packages/client/src/components/HexGrid.tsx`, `packages/client/src/components/HexGrid.test.tsx`.

### D-56 — moved pieces lock in as 'activated' when the stage ends

**Issue:** D-55's green "moved this stage" ring is correctly transient (scoped to
`freeKickPlacedPieceIds`, which resets to `[]` at the start of every new stage) — but without an
explicit hand-off, a piece moved during one stage could be re-selected and moved again during
a LATER stage belonging to the SAME team (e.g. the kicking team's stage-0-then-stage-2 split),
even though the rulebook intends each stage's placements to be final once that stage ends.

**Fix — `applyFreeKickReady` (gameEngine.ts):** when a stage successfully ends (advancing
`freeKickStageIndex`, OR finalizing the kick after stage 3), the CURRENT stage's
`freeKickPlacedPieceIds` are merged into `movedPieceIds` (deduplicated via `Set`) BEFORE
`freeKickPlacedPieceIds` resets to `[]` for the next stage. This converts the green "moved this
stage" highlight into the existing orange 'activated' ring for the rest of free-kick setup, via
the SAME generic `movedPieceIds.includes(piece.id)` rendering path already used everywhere else
(MOVEMENT, MOVE-06) — no new client rendering logic, just feeding the existing mechanism. A
piece moved in the kicking team's stage 0 is therefore locked out of being touched again even in
their later stage 2 turn, confirmed intentional per D-56.

**Fix — finalize cleanup:** when the kick fully finalizes (after stage 3 ends), the existing
field-clearing logic (`freeKickHex`/`freeKickStageIndex`/etc. → `null`, `offsidePieceIds` → `[]`
per D-43/D-47) now ALSO clears `movedPieceIds: []` — `movedPieceIds` is otherwise a
MOVEMENT-phase-scoped field, and leftover free-kick-setup activation state (including the locked
kicker) must not bleed into the subsequent `PASS` phase.

**Tests:** `offside.test.ts` — a piece moved in stage 0 appears in `movedPieceIds` after stage 0
ends (advancing to stage 1); `movedPieceIds` carries the locked kicker + stage-0 placements
forward through stage 1 and into stage 2; `movedPieceIds` is `[]` immediately after the kick
finalizes, alongside the existing D-43/D-47 `offsidePieceIds: []` assertion.
`gameHandlers.phase17-06.test.ts` — the full four-stage sequence test now asserts
`finalState.movedPieceIds` is `[]` after finalize.

**Files:** `packages/server/src/gameEngine.ts`, `packages/server/src/__tests__/offside.test.ts`,
`packages/server/src/__tests__/gameHandlers.phase17-06.test.ts`.

### Supporting fix — `movedPieceIds` reset on foul trigger

Since `movedPieceIds` is now repurposed during free-kick setup (D-54's kicker lock, D-56's
per-stage lock-in), `triggerOffsideFoul` (`packages/shared/src/offside.ts`) was updated to reset
`movedPieceIds: []` on entry into `FREE_KICK_SETUP` — the foul can fire mid-MOVEMENT-phase,
carrying a stale `movedPieceIds` value from whatever phase preceded it; free-kick setup must
always start with a clean lock state. Covered by a new `offside.test.ts` case asserting the
reset even when `movedPieceIds` is non-empty going in.

### Commits

| Commit    | Scope                                                                                                                                                                                                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c44340e` | shared — `triggerOffsideFoul` resets `movedPieceIds: []` on entry (D-54/D-56 prep)                                                                                                                                                                                                |
| `05a9ce3` | server — D-52 (`resolveHeaderWinnerPiece` + GAME_HEADER_CONTESTANT short-circuit), D-53 (`applyOffsideFoulWithRelocation` + all six call sites), D-54 (`applyFreeKickMove` mandatory-kicker-first + `applyFreeKickReady` D-51 removal), D-56 (stage-end lock-in + finalize clear) |
| `d2a67ff` | client — D-55 (`PieceOverlay` green ring + `HexGrid` wiring), D-54 (`FreeKickSetupPanel` kicker constraint rewrite)                                                                                                                                                               |

### Re-verification after this round

- `pnpm --filter @counter-attack/shared typecheck` — exits 0
- `pnpm --filter @counter-attack/shared test -- --run` — 320 passing (unchanged from prior
  round — `offside.ts`'s changes are exercised via the server package's `offside.test.ts`,
  which imports it through `@counter-attack/shared`)
- `pnpm --filter @counter-attack/server typecheck` — exits 0
- `pnpm --filter @counter-attack/server test -- --run` — 449 passing (1 pre-existing skip, 1
  pre-existing todo, unrelated), up from 435 (+14 net: `offside.test.ts` gained 1 new
  `triggerOffsideFoul` movedPieceIds-reset case, 1 new `applyOffsideFoulWithRelocation` describe
  block with 6 cases, and the `applyFreeKickMove`/`applyFreeKickReady` describe block was
  substantially rewritten for D-54/D-56 with a net increase; `gameHandlers.phase17-06.test.ts`'s
  free-kick describe blocks were rewritten for the mandatory-kicker-first model, net +3 cases)
- `pnpm --filter @counter-attack/client typecheck` — exits 0
- `pnpm --filter @counter-attack/client test -- --run` — 182 passing, up from 173 (+9 net:
  `PieceOverlay.test.tsx` +4 D-55 cases, `HexGrid.test.tsx` +3 D-55 wiring cases,
  `FreeKickSetupPanel.test.tsx` net +1 case after the D-51→D-54 kicker-constraint block rewrite)

No dev server was started during this session. Only `tsc --noEmit`, `vitest run`, and a handful
of one-off `node --input-type=module -e "..."` debug scripts against the already-built
`dist/` output (used to isolate a test-ordering race in `gameHandlers.phase17-06.test.ts` — see
deviations below) were executed. The orchestrator's production build (server on port 3001,
`vite preview` on port 5174) was not touched, confirmed running both before and after this
session's changes.

## Deviations from Plan (this round)

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test race condition in `gameHandlers.phase17-06.test.ts`'s new D-54
stage-2 test — broadcastState fan-out race, not a product bug**

- **Found during:** writing the new D-54 `GAME_FREE_KICK_READY` handler-level test for "stage 2
  ends successfully regardless of `freeKickHex` occupancy."
- **Issue:** The test emitted three sequential `GAME_FREE_KICK_READY` calls, waiting only for
  the ACTING client's own `GAME_STATE` broadcast before emitting the next call. Since
  `broadcastState` emits to the WHOLE room, the OTHER client's copy of a given broadcast can
  arrive after a later listener is already registered on that client, causing a stale/duplicate
  resolution that masked the real outcome (the test's third-stage assertion intermittently saw
  the SECOND stage's broadcast, not the third).
- **Fix:** Adopted the established pattern already used by this same test file's "full
  sequence" test — wait for BOTH clients' copies of each broadcast (via `Promise.all`) before
  registering the next stage's listener.
- **Files modified:** `packages/server/src/__tests__/gameHandlers.phase17-06.test.ts`
- **Commit:** `05a9ce3`

### Notable test-fixture reconciliation (not a deviation — documented for traceability)

Several pre-existing `gameHandlers.phase17-06.test.ts` and `offside.test.ts` fixtures
constructed `FREE_KICK_SETUP` stage states with no kicking-team piece actually positioned on
`freeKickHex` (valid under the old D-51 model, where the kicker check only fired at stage-2 end).
Under D-54, these fixtures now correctly trigger `KICKER_NOT_YET_PLACED` the moment a non-kicker
piece tries to move. All affected fixtures were updated to either explicitly seed a kicker
already locked into `movedPieceIds` (for tests not specifically exercising the kicker-placement
flow itself) or to exercise the kicker-placement flow directly (for the new D-54-specific test
cases) — this is expected fallout from the D-54 behavior change, not a bug.

## Checkpoint Pending (Round 4) — superseded by Round 5's D-57 broadening below

Task 4 (`checkpoint:human-verify`, gate="blocking") is pending a FOURTH time — re-verification
needed for all five Round-2 corrections:

1. **D-52 (SUPERSEDED — see "Free Kick Setup — Round 3 Correction (D-57)" below):** Win a
   header while offside-flagged and confirm you are dropped straight into `FREE_KICK_SETUP`
   with no target-choice prompt at all (try this for both a would-be headed pass and a
   would-be headed shot at goal — both should skip straight to the foul). D-52 only checked
   the eventual winner; D-57 broadens this to check ANY nominated contestant on either side,
   before dice are even rolled — see below for the corrected re-verification step.
2. **D-53:** Trigger an offside foul with a conceding-team piece left standing within 2 hexes of
   the restart spot and confirm it auto-relocates to a random legal hex 3+ away before stage 0
   becomes interactive — no manual walking-out required. Confirm a piece NOT within 2 hexes is
   left untouched, and confirm the offender's own piece (now standing exactly on the restart
   spot) is NOT itself relocated.
3. **D-54:** During the kicking team's stage 0, confirm no other piece can be moved until a
   kicking-team piece is moved onto the free-kick hex; confirm that placement is free (doesn't
   count against the 5-piece budget) and the kicker immediately shows the orange "activated"
   ring and can never be selected again, including during the kicking team's later stage 2 turn.
4. **D-55:** During any stage, move up to your budget's worth of pieces and confirm each shows a
   green ring distinct from the orange "activated" ring, persisting for the rest of that stage.
5. **D-56:** Confirm that once a stage ends, all pieces moved during that stage show the orange
   "activated" ring (not green) for the remainder of free-kick setup, including in a later stage
   belonging to the same team.

The original OFFSIDE-02 end-to-end flow, the Round-1 corrections (D-42..D-45; D-46 reverted),
and the Round-2/D-49..D-51 staged-sequence behavior (D-47..D-50, still in effect; D-51 itself is
now superseded by D-54) remain in scope for re-confirmation since the underlying mechanic has
changed substantially across multiple rounds. Plan 17-06 cannot close until this round is
approved.

## Self-Check (this round)

Files exist:

- `packages/shared/src/offside.ts` — modified (`triggerOffsideFoul` resets `movedPieceIds`) ✓
- `packages/server/src/gameEngine.ts` — modified (`resolveHeaderWinnerPiece`,
  `applyOffsideFoulWithRelocation`, `applyFreeKickMove`/`applyFreeKickReady` D-54/D-56
  rework) ✓
- `packages/server/src/gameHandlers.ts` — modified (D-52 short-circuit in
  `GAME_HEADER_CONTESTANT`, all six foul-trigger sites routed through
  `applyOffsideFoulWithRelocation`) ✓
- `packages/server/src/__tests__/offside.test.ts` — modified (D-52..D-56 + D-53 relocation
  test coverage) ✓
- `packages/server/src/__tests__/gameHandlers.phase17-06.test.ts` — modified (D-54 handler
  coverage rewrite) ✓
- `packages/client/src/components/PieceOverlay.tsx` — modified (`isMovedThisStage` green
  ring, D-55) ✓
- `packages/client/src/components/PieceOverlay.test.tsx` — modified (4 new D-55 cases) ✓
- `packages/client/src/components/HexGrid.tsx` — modified (`freeKickPlacedPieceIds` wiring) ✓
- `packages/client/src/components/HexGrid.test.tsx` — modified (3 new D-55 wiring cases) ✓
- `packages/client/src/components/FreeKickSetupPanel.tsx` — modified (D-54 kicker constraint
  rewrite) ✓
- `packages/client/src/components/FreeKickSetupPanel.test.tsx` — modified (D-54 test
  rewrite) ✓
- `.planning/phases/17-rule-bugs/17-06-SUMMARY.md` — this file, updated ✓

Commits exist:

- `c44340e` fix(17-06): reset movedPieceIds on offside foul trigger (D-54/D-56 prep) ✓
- `05a9ce3` feat(17-06): server-side D-52..D-54/D-56 free-kick round-2 corrections ✓
- `d2a67ff` feat(17-06): client-side D-54/D-55 free-kick round-2 corrections ✓
- `2feec4d` docs(17-06): document round-2 free-kick corrections (D-52..D-56) in SUMMARY ✓

Verification:

- `pnpm --filter @counter-attack/shared typecheck` — exits 0 ✓
- `pnpm --filter @counter-attack/shared test -- --run` — 320 passing ✓
- `pnpm --filter @counter-attack/server typecheck` — exits 0 ✓
- `pnpm --filter @counter-attack/server test -- --run` — 449 passing, 1 pre-existing skip, 1
  pre-existing todo (unrelated) ✓
- `pnpm --filter @counter-attack/client typecheck` — exits 0 ✓
- `pnpm --filter @counter-attack/client test -- --run` — 182 passing ✓

## Self-Check: PASSED

## Free Kick Setup — Round 3 Correction (D-57 supersedes D-52, gathered/implemented 2026-06-20)

A third live playtest of the D-52 header-offside short-circuit surfaced one more correction:
D-52 only intercepted the duel when the eventual WINNER was offside-flagged — a contestant who
was flagged but went on to LOSE (or tie) the duel was missed entirely, since
`computeHeaderDuelWinner` and the dice roll had already run by the time D-52's check executed.
User correction: "If header is contested by an offside player go directly to the free kick." It
is not about who wins — merely CONTESTING a header while offside-flagged is itself the foul,
regardless of outcome.

### The fix

In `GAME_HEADER_CONTESTANT`'s `bothConfirmed` branch (`gameHandlers.ts`), the offside check now
runs immediately after `updatedContestants` is built and BEFORE any dice are rolled — before
`numDice`/`diceArr`/`rollDice()` are even computed, and before `computeHeaderDuelWinner` is
called. The check scans the FULL combined nominated-contestant list
(`[...updatedContestants.home, ...updatedContestants.away]`, home's ids first) for any id present
in `offsidePieceIds`. If found, dice are never rolled and `computeHeaderDuelWinner` is never
invoked — the foul fires immediately via the existing `applyOffsideFoulWithRelocation` (D-53)
wrapper, using that contestant's id as the explicit offender. Only when NO nominated contestant
on either side is flagged does the duel proceed exactly as before (roll dice, resolve
winner/tie, etc.).

The old post-resolution D-52 check — resolve the winning piece via `resolveHeaderWinnerPiece`,
then check only that one piece — is removed entirely from `gameHandlers.ts` as dead code: by the
time a winner could ever be resolved under the new D-57 ordering, every nominated contestant has
already been confirmed not-flagged, so a winner-only check at that point could never fire.
`resolveHeaderWinnerPiece` itself is kept (not deleted) since `applyResolveHeaderTarget` still
depends on it to resolve the winning piece's position for D-06 target-distance validation — only
its now-unused import in `gameHandlers.ts` was removed. Doc comments that previously cited D-52
as the rationale for this code path were updated to cite D-57 (in `gameEngine.ts`'s
`resolveHeaderWinnerPiece` JSDoc and `applyResolveHeaderTarget`'s step-3 comment, and in
`gameHandlers.ts`'s GAME_HEADER_TARGET defensive-no-op comment).

### Tests

New `D-57: header contested by an offside-flagged player triggers the foul immediately
(supersedes D-52)` describe block added to `gameHandlers.rule11.test.ts` (the file that already
held the `RULE-02: GAME_HEADER_CONTESTANT — both-confirmed auto-fires duel` coverage this
extends), six cases:

- A contestant who would clearly LOSE the duel (lowest `aerialAbility`, with `rollDice` mocked
  deterministic) but is flagged offside still triggers the foul immediately — the exact case
  D-52 missed.
- A contestant on the attacking (home) side being flagged also triggers the foul, with
  possession correctly awarded to the non-offending team (D-28).
- No dice are rolled when a flagged contestant is present: `lastDiceRoll` is explicitly seeded
  to `null` beforehand and asserted to remain `null` after the foul fires, confirming
  `rollDice()`/`computeHeaderDuelWinner` were never invoked for this contest.
- The normal (no flagged contestant) WIN path is unchanged — duel resolves, stays in `HEADER`
  with `headerDuelWinner` set, awaiting target selection (regression check).
- The normal (no flagged contestant) TIE path is unchanged — resolves to `LOOSE_BALL` with a
  null carrier (regression check).
- Multiple flagged contestants (one nominated per side) — confirms the deterministic home-first
  scan order: the home contestant becomes the offender (foul spot = home's position, possession
  awarded to away), and the away contestant's flag remains sticky (only the chosen offender is
  cleared from `offsidePieceIds` per D-26/D-43), without crashing.

One pre-existing-pattern test-fixture note: `seedHeaderReadyForContestants`'s default away
defender position (`{q:26,r:12}`) sits inside `awayThird`. Since the foul's free-kick spot is
the offender's position (D-27) and the ball is moved there, two of the new tests reposition the
flagged piece to a middle-third hex (`{q:20,r:12}`) first — otherwise MOVE-06's independent
ball-zone-triggered free-move check (`applyFreeMoveZoneCheck`, D-33) would also fire on the same
state transition (a fresh entry into a final third) and overlay `FREE_MOVE_ATTACK` on top of
`FREE_KICK_SETUP`, an unrelated interaction these tests aren't exercising.

### Files changed this round

- `packages/server/src/gameHandlers.ts` — `GAME_HEADER_CONTESTANT`'s `bothConfirmed` branch
  reordered: D-57 offside scan moved before dice rolling; old post-resolution D-52 check
  removed; unused `resolveHeaderWinnerPiece` import removed; stale D-52 doc comments updated
  to cite D-57
- `packages/server/src/gameEngine.ts` — `resolveHeaderWinnerPiece` JSDoc and
  `applyResolveHeaderTarget`'s step-3 comment updated to describe D-57 instead of D-52
  (function itself unchanged — still used by `applyResolveHeaderTarget`)
- `packages/server/src/__tests__/gameHandlers.rule11.test.ts` — new D-57 describe block (6
  cases)

### Commit

| Commit    | Scope                                                                    |
| --------- | ------------------------------------------------------------------------ |
| `7086dff` | feat(17-06): broaden offside header-foul check to D-57 (supersedes D-52) |

### Re-verification after this round

- `pnpm --filter @counter-attack/shared typecheck` — exits 0
- `pnpm --filter @counter-attack/server typecheck` — exits 0
- `pnpm --filter @counter-attack/server test -- --run` — 455 passing (1 pre-existing skip, 1
  pre-existing todo, unrelated), up from 449 (+6 new D-57 cases in `gameHandlers.rule11.test.ts`)
- Client and shared packages required no source changes for this fix (purely a
  `gameHandlers.ts`/`gameEngine.ts` server-side reordering) — client typecheck/test were not
  re-run this round since nothing in `packages/client` or `packages/shared` was touched.

No dev server was started during this session. Only `tsc --noEmit` and `vitest run` commands
were executed. The orchestrator's production build (server on port 3001, `vite preview` on port 5174) was observed running, untouched, at both the start and end of this session.

## Checkpoint Pending (Round 5) — superseded by the D-59 stall fix below

Task 4 (`checkpoint:human-verify`, gate="blocking") was pending a FIFTH time, scoped to D-57.
Before that round could be verified, the user found a GAME-STALLING BUG in D-53's
auto-relocation logic during manual testing. This session fixes it (D-59) — see below for the
new, current checkpoint scope, which supersedes Round 5's checklist.

## D-59 (BUG FIX) — the offender was never relocated, permanently blocking kicker placement

**The bug:** D-53's auto-relocation explicitly excluded the offending player from the
trapped-piece sweep — the doc comment reasoned that since `freeKickHex` is defined as "the
offender's position at the moment of the foul" (D-27), relocating them would "displace the
historical foul-spot marker." This reasoning was wrong in practice: the offender is a
CONCEDING-team piece sitting at distance 0 from `freeKickHex` (trivially within the 2-hex
trap radius), and the KICKING team's mandatory first action (D-31/D-54) is to move one of
their OWN pieces onto that exact same hex. With the offender permanently parked there, the
kicking team's placement attempt was rejected at the `gameHandlers.ts` `GAME_FREE_KICK_MOVE`
handler with `OCCUPIED` (the occupancy guard checked there, before `applyFreeKickMove` is even
called) — there was no legal move available, ever, and the game stalled permanently the moment
any offside foul fired with the offender exactly on the restart spot (i.e., every single time,
since D-27 places the foul spot AT the offender's position by definition).

**The fix:** `applyOffsideFoulWithRelocation` (`packages/server/src/gameEngine.ts`) no longer
excludes the offender from its trapped-piece search — the `offenderId`-based filter was removed
entirely from the `trappedIds` computation. The offender now goes through the exact same
relocation sweep as every other conceding-team piece within 2 hexes of `freeKickHex`. After the
foul-trigger transition completes, nothing occupies `freeKickHex` (the ball itself stays there
per D-27 — only pieces move), which is what unblocks the kicking team's mandatory kicker-first
placement.

**Relocation target algorithm refined (applies to every relocated piece, offender included):**
previously, every trapped piece went straight to a uniformly-random unoccupied on-pitch hex
`>=3` hexes from `freeKickHex` (`crypto.randomInt`). D-59 adds a preference step before that
fallback:

1. Compute the full ring of on-pitch hexes at EXACTLY `hexDistance === 3` from `freeKickHex`
   (`ring3Hexes`, via `PITCH_HEXES`/`isPitchHex`).
2. For the piece being relocated, resolve its TEAM's own goal-line hex set via a new helper,
   `ownGoalLineHexes(team)` — the goal that team DEFENDS, the OPPOSITE of the `goalQ` convention
   used elsewhere in `gameEngine.ts` for the goal a team shoots AT (e.g. `applyDeclareShot`'s
   `goalQ = attackingTeam === 'home' ? 36 : 0`): home defends q=0, away defends q=36, both
   r∈[10..16].
3. Sort `ring3Hexes` by ascending minimum `hexDistance` to that goal-line set; take the closest 4.
4. Try those 4 in closest-first order, skipping any already occupied (by another piece's
   current position, or an earlier relocation already applied in this same pass).
5. If none of those 4 are available, fall back to D-53's original behavior: a uniformly-random
   unoccupied on-pitch hex `>=3` hexes from `freeKickHex`.

Pieces are still processed one at a time with an accumulating occupied-hex set (every other
piece's current position + every already-relocated piece's new position), so no two relocated
pieces — including the offender now — ever collide with each other or with an unrelated piece.

**Files:** `packages/server/src/gameEngine.ts` (`applyOffsideFoulWithRelocation` rewritten;
new private helper `ownGoalLineHexes`), `packages/server/src/__tests__/offside.test.ts` (D-53
describe block renamed to cover D-59; offender-exclusion test flipped to assert inclusion +
`freeKickHex` ends up unoccupied; multi-piece collision test extended to include the offender;
four new D-59-specific cases: end-to-end kicker-placement-succeeds regression, home-team
ring-3-nearest-own-goal preference, away-team ring-3-nearest-own-goal preference, and the
all-4-preferred-occupied fallback case), `packages/server/src/__tests__/gameHandlers.phase17-06.test.ts`
(two pre-existing D-41 deflection tests updated — see Deviations below).

### Deviations from Plan (this round)

**1. [Rule 1 — test fallout from the behavior fix] Two pre-existing D-41 deflection tests
asserted the old (buggy) behavior**

- **Found during:** running the full server suite after the D-59 fix.
- **Issue:** `gameHandlers.phase17-06.test.ts`'s two D-41 deflection tests ("a FLAGGED defender
  deflecting a [snapshot/regular] shot triggers FREE_KICK_SETUP at the defender's position")
  asserted `newState.freeKickHex` equals the flagged defender's (the offender's) CURRENT
  position post-trigger — true only under the old buggy behavior where the offender never
  moved. Under the D-59 fix, the offender IS relocated, so their current position no longer
  equals the (fixed, historical) foul spot.
- **Fix:** Updated both assertions to check `freeKickHex` against the known fixed foul-spot
  coordinate from each test's fixture (`{q:34,r:13}` and `{q:30,r:13}` respectively) and added
  an explicit assertion that the defender's post-relocation position is no longer equal to
  `freeKickHex` — turning each test into a direct regression check for the fix itself, not just
  a coincidental pass.
- **Files modified:** `packages/server/src/__tests__/gameHandlers.phase17-06.test.ts`
- **Commit:** `0d021b8`

### Commit

| Commit    | Scope                                                                               |
| --------- | ----------------------------------------------------------------------------------- |
| `0d021b8` | fix(17-06): include offender in D-53 auto-relocation, fixing free-kick stall (D-59) |

### Re-verification after this fix

- `pnpm --filter @counter-attack/shared typecheck` — exits 0
- `pnpm --filter @counter-attack/shared test` — 320 passing (unchanged — no shared-package
  source was touched; `offside.ts`'s `triggerOffsideFoul` is unchanged, only the server-side
  `applyOffsideFoulWithRelocation` wrapper around it)
- `pnpm --filter @counter-attack/server typecheck` — exits 0
- `pnpm --filter @counter-attack/server test -- --run` — 459 passing (1 pre-existing skip, 1
  pre-existing todo, unrelated), up from 455 (net +4: `offside.test.ts` gained 4 new D-59 cases
  — end-to-end kicker-placement regression, home/away ring-3-nearest-own-goal preference, and
  the all-preferred-occupied fallback — while the prior offender-exclusion test and the
  multi-piece collision test were updated in place, not added; `gameHandlers.phase17-06.test.ts`'s
  two updated D-41 deflection tests are pre-existing cases with corrected assertions, not new
  cases). Re-run twice to confirm stability (no flakiness) — identical results both times.
- Client and shared packages required no source changes for this fix (pure
  `gameEngine.ts` engine logic plus its own test files) — confirmed via `git status` showing
  only `packages/server/src/gameEngine.ts` and its two test files modified.

No dev server was started during this session. Only `tsc --noEmit` and `vitest run` commands
were executed. The orchestrator's production build (server on port 3001, `vite preview` on port 5174) was observed listening, untouched, at both the start and end of this session.

## Checkpoint Pending (Round 6)

Task 4 (`checkpoint:human-verify`, gate="blocking") is pending a SIXTH time. Re-verification
needed for the D-59 stall fix specifically (this supersedes Round 5's D-57-only scope — D-57
itself is unchanged this round and remains verified-pending from Round 5, see below):

1. **D-59 (the stall bug):** Trigger an offside foul and confirm the offending player is no
   longer standing on the ball spot — you should now be able to immediately walk an attacking
   (kicking-team) piece onto the free-kick spot without it being blocked with an "OCCUPIED"
   rejection. This is the actual end-to-end reproduction of the originally reported stall.
2. **D-59 (relocation target preference):** When a defender is auto-relocated (offender or any
   other trapped teammate), confirm they generally land closer to their own goal than before —
   not scattered randomly across the pitch — unless those preferred spots happen to already be
   taken, in which case the old random-placement fallback is fine.
3. **D-58 (no action needed — informational only):** Already confirmed correct with no code
   change; not part of this round's verification scope.

All prior outstanding re-verification items (D-53 through D-57, the original OFFSIDE-02
end-to-end flow, and the Round-1/Round-2 corrections) remain in scope per the Round 4/5
checklists above. Plan 17-06 cannot close until this round is approved.
