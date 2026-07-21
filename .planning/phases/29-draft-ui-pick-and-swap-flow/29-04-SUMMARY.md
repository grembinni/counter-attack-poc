---
phase: 29-draft-ui-pick-and-swap-flow
plan: 04
subsystem: api
tags: [socket.io, draft-mode, server-authoritative, mutex, crypto-randomInt, reconnect, vitest]

requires:
  - phase: 29-draft-ui-pick-and-swap-flow (Plan 01)
    provides: DraftSession/DraftClientView/DraftDestination/DraftSlotRef types, DRAFT_PICK/DRAFT_REARRANGE/DRAFT_STATE_UPDATED events, Room.draftSession field
  - phase: 29-draft-ui-pick-and-swap-flow (Plan 02)
    provides: 'packages/server/src/draftSession.ts pure state-machine helpers: createDraftSession, openNextPack, applyPick, applyRearrange, advanceSubStep, checkKeeperSafety, assignBenchNumbers, buildDraftView'
provides:
  - 'roomHandlers.ts: DraftSession bootstrap in ROOM_SETTINGS_CONFIRM (generateMatchPacks + createDraftSession bound to crypto.randomInt)'
  - 'roomHandlers.ts: UNIFORM_CONFIRM away-branch draft/standard divergence — draft mode skips computeAutoAssignment, opens cycle-1 packs, unicasts DRAFT_STATE_UPDATED instead of LINEUP_ASSIGNMENT_READY'
  - 'roomHandlers.ts: DRAFT_PICK handler — card-membership + GK-slot-role (both directions) + slot-index validation, isProcessing mutex, keeper-safety-then-advance ordering, bench-number assignment on completion, per-socket unicast via emitDraftViews'
  - 'roomHandlers.ts: DRAFT_REARRANGE handler — moves an already-drafted card without touching cycle/subStep, same GK-slot guard, requester-private emit'
  - 'createServer.ts: reconnect block re-emits the reconnecting player private DRAFT_STATE_UPDATED for in-progress draft rooms, closing the pre-gameState resync gap'
  - '18 new integration tests across draftSession.integration.test.ts (8) and draftReconnect.integration.test.ts (2), full server suite (601 tests) green'
affects: [29-05-client-screen, 29-06-full-suite-gate]

tech-stack:
  added: []
  patterns:
    - 'emitDraftViews(io, room) module-level helper unicasts buildDraftView(session, side) to each socket individually — mirrors the LINEUP_ASSIGNMENT_READY per-socket-privacy convention already established in the UNIFORM_CONFIRM/LINEUP_SWAP handlers'
    - 'DRAFT_PICK/DRAFT_REARRANGE handler skeleton copies LINEUP_SWAP verbatim: roomCode/room guard -> isProcessing mutex try/finally -> side resolved from socket.data.playerSlot only -> allow-list validation -> pure-function delegation -> private emit'
    - 'checkKeeperSafety is invoked BEFORE advanceSubStep on the cycle-4 PICK1 boundary (per draftSession.ts doc contract) so the keeper-safety-reduced picksRemaining lands correctly on the following PICK2'
    - "Draft-mode test harness (setupThroughDraftUniformConfirm) mirrors lineupAssignment.integration.test.ts's setupThroughUniformConfirm exactly, substituting draft settings + asserting DRAFT_STATE_UPDATED instead of LINEUP_ASSIGNMENT_READY"
    - 'makeDraftDriver test helper maintains local DraftClientView mirrors via persistent .on(DRAFT_STATE_UPDATED) listeners, letting the end-to-end test reactively drive all 4 cycles without hardcoding pick counts'

key-files:
  created:
    - packages/server/src/__tests__/draftSession.integration.test.ts
    - packages/server/src/__tests__/draftReconnect.integration.test.ts
  modified:
    - packages/server/src/roomHandlers.ts
    - packages/server/src/createServer.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md

key-decisions:
  - 'BOTH_FORMATIONS_CONFIRMED is now emitted ONCE, before the draft/standard branch split (previously only existed inside the single Standard-mode path) — both team types receive it identically, then homeSocket/awaySocket are resolved once and reused by whichever branch runs, avoiding duplicated socket-lookup code.'
  - "DRAFT_PICK always looks up the picked cardId in the global PLAYER_POOL first (to resolve its role for the GK-slot check) before delegating to applyPick for the sender-pack-membership check — this two-step order means a well-formed-but-foreign cardId (a real card, just not in the sender's current pack) still reaches applyPick and is correctly rejected as INVALID_CARD rather than silently short-circuiting on a PLAYER_POOL miss."
  - "DRAFT_REARRANGE resolves the moving card's role (for the GK-slot check) by reading it directly off room.draftSession's lineupSlots/benchIds for the `from` ref BEFORE calling applyRearrange — this mirrors DRAFT_PICK's validate-then-delegate order without duplicating any placement logic in the handler itself."
  - 'Bench numbers are assigned exactly once, at the DRAFT_PICK call that flips draftComplete from false to true (both homeBenchNumbers and awayBenchNumbers computed together) — no separate "finalize draft" event exists, so this is the only correct single-shot trigger point.'

patterns-established: []

requirements-completed: [DRAFT-07, DRAFT-08, DRAFT-10]

duration: ~50min
completed: 2026-07-21
---

# Phase 29 Plan 04: Server Wiring (DraftSession Bootstrap, Pick-and-Swap Handlers, Reconnect Resume) Summary

**Wired the pure draftSession.ts state machine into the live Socket.io layer: draft settings confirm bootstraps a CSPRNG-assigned DraftSession, UNIFORM_CONFIRM diverges cleanly for draft vs. standard mode, DRAFT_PICK/DRAFT_REARRANGE enforce full server-authoritative validation (card membership, bidirectional GK-slot rules, mutex, per-socket privacy), and mid-draft reconnect resumes exactly where it left off.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-07-21
- **Tasks:** 3/3 completed
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- `ROOM_SETTINGS_CONFIRM` now calls `generateMatchPacks` + `createDraftSession(packs, randomInt)` the instant draft mode is locked in, giving every draft room its own CSPRNG-shuffled pack-to-player assignment (D-04) before team/uniform selection even begins
- `UNIFORM_CONFIRM`'s away-branch cleanly diverges on `room.teamType`: draft mode skips `computeAutoAssignment` entirely, seeds an empty 11-slot formation shell, opens cycle-1 packs via `openNextPack`, and unicasts each player's own `DRAFT_STATE_UPDATED` — while the Standard-mode path is byte-for-byte unchanged and still fully green (Pitfall 2 closed with zero regression)
- `DRAFT_PICK` implements the complete server-authoritative pick contract: sender-pack-membership validation (`INVALID_CARD`), bidirectional GK-slot role enforcement (`GK_SLOT_REQUIRES_GK` / `NON_GK_SLOT_REJECTS_GK`), slot-index allow-listing, the `isProcessing` mutex, cycle-4 keeper-safety-before-advance ordering, and one-shot bench-number assignment exactly at draft completion
- `DRAFT_REARRANGE` moves already-drafted cards between lineup/bench without ever touching cycle/subStep state (D-10), delegating all placement logic to the pure `applyRearrange` and replying only to the requesting socket
- Mid-draft reconnect now re-emits the reconnecting player's own private `DRAFT_STATE_UPDATED`, closing a pre-existing gap where reconnect only re-emitted `GAME_STATE` (which stays `null` throughout the entire pre-game flow — team select, uniform, formation, and now draft)
- 18 new integration tests (8 in `draftSession.integration.test.ts`, 2 in `draftReconnect.integration.test.ts`, plus a Standard-mode regression smoke test) exercise the full pick-and-swap cycle, mutual-wait gating, tampering rejection, both GK-slot rejection directions, a full 4-cycle end-to-end completion with bench-number invariants, `DRAFT_REARRANGE`, and reconnect privacy — full server suite: 601 tests green, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap DraftSession at settings-confirm + gate the UNIFORM_CONFIRM away-branch** - `053d523` (feat)
2. **Task 2: DRAFT_PICK + DRAFT_REARRANGE handlers with full server-authoritative validation** - `f620846` (feat)
3. **Task 3: Reconnect resends the private draft view (close Pitfall 3 gap)** - `9614a0e` (feat)

## Files Created/Modified

- `packages/server/src/roomHandlers.ts` - `ROOM_SETTINGS_CONFIRM` DraftSession bootstrap; `UNIFORM_CONFIRM` away-branch draft/standard split; `emitDraftViews` helper; `DRAFT_PICK`/`DRAFT_REARRANGE` handlers
- `packages/server/src/createServer.ts` - reconnect block re-emits the reconnecting player's private `DRAFT_STATE_UPDATED` for in-progress draft rooms
- `packages/server/src/__tests__/draftSession.integration.test.ts` - Task 1 bootstrap tests + Task 2 pick/rearrange/tampering/GK-slot/end-to-end tests (8 tests)
- `packages/server/src/__tests__/draftReconnect.integration.test.ts` - Task 3 mid-draft reconnect tests (2 tests)
- `.planning/REQUIREMENTS.md` - DRAFT-10 wording corrected: bench numbers are random 15-99, not sequential (D-16)
- `.planning/ROADMAP.md` - Phase 29 Goal + Success Criterion 5 corrected: no auto-repositioning after draft completes; bench numbers random 15-99 (D-15/D-16)

## Decisions Made

See `key-decisions` in the frontmatter for the full rationale on: (1) hoisting `BOTH_FORMATIONS_CONFIRMED` above the draft/standard split, (2) the PLAYER_POOL-lookup-then-applyPick-delegation order in `DRAFT_PICK`, (3) the mirrored validate-then-delegate order in `DRAFT_REARRANGE`, and (4) the single-shot bench-number-assignment trigger point.

## Deviations from Plan

None triggering Rules 1-4 — all three tasks were implemented exactly as specified in the plan's `<action>` blocks, including the exact GAME_ERROR reason strings (`INVALID_CARD`, `GK_SLOT_REQUIRES_GK`, `NON_GK_SLOT_REJECTS_GK`, `NOT_DRAFTING`, `INVALID_SLOT_INDEX`), the `emitDraftViews` unicast-only privacy pattern, the keeper-safety-before-advance ordering, and the REQUIREMENTS.md/ROADMAP.md wording corrections per D-15/D-16.

One test-design refinement not called out explicitly in the plan: `setupThroughDraftUniformConfirm` returns the initial `viewA`/`viewB` alongside `clientA`/`clientB` (rather than just the sockets), so downstream tests can assert on the bootstrap view without a second round-trip — this is a pure test-ergonomics addition, not a behavior change.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no `dist/` build output (expected for a fresh worktree checkout per the Plan 01/02 precedent). Ran `pnpm install --frozen-lockfile` (resolved from the existing pnpm store, zero downloads) followed by `pnpm --filter @counter-attack/shared build`. No junction/symlink workaround was used, per project memory on the worktree junction risk.
- No other issues — all three tasks' acceptance criteria passed on first test run with zero debugging iterations required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `roomHandlers.ts` and `createServer.ts` now expose the complete draft-mode socket surface (`DRAFT_PICK`, `DRAFT_REARRANGE`, `DRAFT_STATE_UPDATED` on bootstrap/pick/rearrange/reconnect) that Plan 05's client `LineupAssignmentScreen` draft-mode branch needs to wire against.
- `pnpm --filter @counter-attack/server test` (full suite, 601 tests) and `pnpm --filter @counter-attack/server typecheck` both pass with zero regressions; `pnpm --filter @counter-attack/shared typecheck` and `pnpm --filter @counter-attack/client typecheck` also verified clean.
- Verified via grep: no `io.to(roomCode).emit(...DRAFT_STATE_UPDATED...)` exists anywhere — every draft-state emission is a per-socket unicast (D-14/T-29-05 privacy invariant holds structurally, not just by convention).
- No blockers for Plan 05 (client screen) or Plan 06 (full-suite gate + two-browser human-verify checkpoint).

---

_Phase: 29-draft-ui-pick-and-swap-flow_
_Completed: 2026-07-21_

## Self-Check: PASSED
