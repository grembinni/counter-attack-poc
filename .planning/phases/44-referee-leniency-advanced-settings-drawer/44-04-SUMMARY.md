---
phase: 44-referee-leniency-advanced-settings-drawer
plan: 04
subsystem: api
tags: [socket.io, typescript, asvs-v5, referee-leniency, wire-contract]

# Dependency graph
requires:
  - phase: 44-01
    provides: buildInitialGameState refereeLeniencyOverrideEnabled/refereeLeniencyValue trailing params
  - phase: 44-03
    provides: client-side Referee Leniency settings row and widened GameSettingsScreen onConfirm contract
provides:
  - Required refereeLeniencyOverride/refereeLeniencyValue fields on ROOM_SETTINGS_CONFIRM wire payload
  - Trailing refereeLeniencyOverride/refereeLeniencyValue positional args (9th/10th) on ROOM_SETTINGS_CONFIRMED
  - Room.refereeLeniencyOverrideEnabled / Room.refereeLeniencyValue optional persisted fields
  - Two ASVS V5 allow-list guards (INVALID_REFEREE_LENIENCY_OVERRIDE, INVALID_REFEREE_LENIENCY_VALUE) applied before any room mutation
  - Both ROOM_SETTINGS_CONFIRMED broadcast sites (confirm echo + ROOM_JOIN late-joiner replay) carrying the two new fields
  - LINEUP_CONFIRM wiring the stored override into buildInitialGameState as the final two arguments
affects: [45-game-summary-popup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unconditional server-side value validation independent of its own enable flag (prevents a forged payload from persisting an inert-until-activated value on Room)"

key-files:
  created: []
  modified:
    - packages/shared/src/events.ts
    - packages/server/src/roomStore.ts
    - packages/server/src/roomHandlers.ts
    - packages/client/src/App.tsx
    - packages/server/src/__tests__/testHelpers.ts
    - packages/server/src/__tests__/room.integration.test.ts
    - packages/server/src/__tests__/draftReconnect.integration.test.ts
    - packages/server/src/__tests__/draftSession.integration.test.ts
    - packages/server/src/__tests__/gameHandlers.substitution.test.ts
    - packages/server/src/__tests__/substitution.integration.test.ts
    - packages/server/src/__tests__/tackleStealPrompt.integration.test.ts

key-decisions:
  - "refereeLeniencyValue is validated unconditionally, not only when refereeLeniencyOverride is true — a forged out-of-range value can never be persisted on Room for a later code path to activate"
  - "refereeLeniencyOverride/refereeLeniencyValue are REQUIRED fields on ROOM_SETTINGS_CONFIRM (not optional), matching the sibling tackleStealDecline field, deliberately breaking all 34 pre-existing test fixture call sites so Task 3 repairs them explicitly rather than silently tolerating omission"

patterns-established:
  - "Value-field validation independent of its own boolean enable-flag when the value could later be activated by a different code path"

requirements-completed: [REFEREE-01, REFEREE-02, REFEREE-04]

# Metrics
duration: ~20min
completed: 2026-08-24
---

# Phase 44 Plan 04: Wire Referee Leniency Override Through the Socket Contract Summary

**Referee Leniency override flag/value now flow end-to-end from ROOM_SETTINGS_CONFIRM through two ASVS V5 allow-list guards, persist on Room, broadcast on both ROOM_SETTINGS_CONFIRMED emit sites, and reach buildInitialGameState as the engine's final two arguments.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-24T03:22:00Z (approx, prior to first commit)
- **Completed:** 2026-08-24T03:43:20Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Closed the six-hop plumbing chain: client payload (plan 44-03) → wire contract → server allow-list validation → Room persistence → both broadcast sites → engine call site (plan 44-01's params)
- Added the phase's only new untrusted-input surface's security guards: `INVALID_REFEREE_LENIENCY_OVERRIDE` (non-boolean flag) and `INVALID_REFEREE_LENIENCY_VALUE` (out-of-range/non-integer/non-numeric value), both validated before any `room.*` mutation
- Validated `refereeLeniencyValue` unconditionally (not gated on `refereeLeniencyOverride`), pinned by a dedicated regression test so this decision can't silently regress
- Repaired all 34 pre-existing `ROOM_SETTINGS_CONFIRM` fixture call sites across 7 test files, broken intentionally by widening the two new fields from optional to required
- Added 7 new tests (6 rejection + 1 happy-path store-and-broadcast) to `room.integration.test.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen the wire contract, Room state, and App.tsx receivers** - `53d2f21a` (feat)
2. **Task 2: Validate, persist, broadcast, and thread the override through roomHandlers** - `bc8c8274` (feat)
3. **Task 3: Repair all ROOM_SETTINGS_CONFIRM fixtures and add validation rejection tests** - `3c588af2` (test)

**Plan metadata:** (pending — orchestrator commits shared docs after merge; this worktree only commits SUMMARY.md/REQUIREMENTS.md per worktree isolation)

## Files Created/Modified

- `packages/shared/src/events.ts` - Added required `refereeLeniencyOverride`/`refereeLeniencyValue` fields to `ROOM_SETTINGS_CONFIRM` object payload; appended both as trailing positional args (9th/10th) to `ROOM_SETTINGS_CONFIRMED`
- `packages/server/src/roomStore.ts` - Added optional `Room.refereeLeniencyOverrideEnabled`/`Room.refereeLeniencyValue` fields, doc-commented per the `tackleStealDeclineEnabled` convention
- `packages/server/src/roomHandlers.ts` - Destructured the two new fields; added `T-44-04`/`T-44-05` ASVS V5 allow-list guards before any mutation; persisted validated values on `Room`; broadcast from both `ROOM_SETTINGS_CONFIRMED` emit sites (confirm echo + `ROOM_JOIN` late-joiner replay); threaded stored values as the final two arguments to `buildInitialGameState` in `LINEUP_CONFIRM`
- `packages/client/src/App.tsx` - Widened `handleSettingsConfirm`'s param type to include the two new fields (forwarded wholesale, no new local state); added two underscore-prefixed discard params to `onRoomSettingsConfirmed` matching the extended `ROOM_SETTINGS_CONFIRMED` signature
- `packages/server/src/__tests__/testHelpers.ts` - Updated the shared `confirmDefaultRoomSettings` fixture
- `packages/server/src/__tests__/room.integration.test.ts` - Updated 20 pre-existing fixture call sites; added a new `describe('Referee Leniency override validation (REFEREE-01/02, T-44-04/T-44-05)')` block with 7 tests
- `packages/server/src/__tests__/draftReconnect.integration.test.ts`, `draftSession.integration.test.ts`, `gameHandlers.substitution.test.ts`, `substitution.integration.test.ts`, `tackleStealPrompt.integration.test.ts` - Updated remaining fixture call sites (14 total across these 5 files)

## Decisions Made

- **Unconditional value validation:** `refereeLeniencyValue` is range/integer-validated on every `ROOM_SETTINGS_CONFIRM`, regardless of whether `refereeLeniencyOverride` is `true` or `false`. This deliberately diverges from a conditional-validation shape sketched in PATTERNS.md. Rationale: the client always sends a value (the stepper never unmounts), so no legitimate client can trip an unconditional guard, while a conditional guard would let a forged payload persist an arbitrary number on `Room` for a later code path to activate. Pinned by a dedicated test asserting the out-of-range-value-with-override-false case still rejects.
- **Required, not optional, wire fields:** Both new `ROOM_SETTINGS_CONFIRM` fields are required (matching `tackleStealDecline`), not optional — this intentionally broke all 34 pre-existing test fixtures at compile time so Task 3 repairs them explicitly, rather than allowing a legitimate client to omit them and be rejected only at runtime.

## Deviations from Plan

### Auto-fixed Issues

None — all three tasks executed as specified in the plan. No Rule 1-4 auto-fixes were needed; the plan's task-level acceptance criteria and read_first guidance matched the live source exactly (all line-number references in the plan's `<read_first>` blocks were accurate).

**Total deviations:** 0
**Impact on plan:** None — plan executed exactly as written.

## Issues Encountered

- **Missing `node_modules` in worktree:** The worktree had no `node_modules` at any package level (git worktrees don't carry installed dependencies). Ran `pnpm install --frozen-lockfile` at the repo root before any typecheck/test/lint/knip command could run. This is expected worktree setup, not a plan deviation.
- **Vitest worker-crash flake (Windows):** `pnpm test` at the monorepo root produced one `Error: Worker exited unexpectedly` from tinypool on the server package, despite 65/66 test files passing. This is a known pre-existing Windows flake (documented in project memory). Reran `pnpm vitest run --pool=forks` per that guidance — all 66 server test files / 1568 tests passed cleanly.
- **Pre-existing `pnpm lint` OOM on `packages/shared`:** The whole-monorepo `pnpm lint` fails with `Parsing error: Too many files (>8) have matched the default project` on 10 `packages/shared/src/*.test.ts` files, none of which this plan touched. This is documented pre-existing tech debt in `PROJECT.md` ("the whole-workspace `pnpm lint` OOMs on a pre-existing `packages/shared` typescript-eslint file-count-cap config issue... doesn't gate CI"). Verified independently that every file this plan modified lints clean via a scoped `eslint` invocation covering exactly this plan's changed files (zero errors, zero warnings).
- **Verification bullet 7 count drift:** The plan's own `<verification>` section bullet 7 states `grep -rn "ROOM_SETTINGS_CONFIRM," ...` should "still return 36." Task 3's own `<action>` instructs adding 7 new tests (6 rejection + 1 happy-path), each with its own `ROOM_SETTINGS_CONFIRM` emit call site — raising the true count to 43 (verified: 42 non-`CONFIRMED` matching lines plus the `App.test.tsx` comment reference). This is an internal inconsistency in the plan's own text (the verification bullet predates Task 3's explicit instruction to add new emit sites), not a mistake in execution. The invariant that actually matters — no call site was *deleted* to dodge the fixture update — holds: the count went up, not down.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- REFEREE-01, REFEREE-02, and REFEREE-04 are now fully wired end-to-end: a host's Leniency override choice reaches `buildInitialGameState` and therefore the live match's booking threshold and added-time bonus (both read `gameState.refereeCard.leniency`, satisfying REFEREE-04's dual-consumer coupling decision from STATE.md).
- Full monorepo verification green: shared 886 tests, server 1568 tests (1 skipped, 1 todo), client 1158 tests — 3,612 total, all passing. `pnpm -r typecheck` clean across all three packages. `pnpm knip` clean. Every file this plan touched lints clean.
- No known stubs, no threat-surface additions beyond the two guards documented in this plan's own `<threat_model>` (T-44-04, T-44-05, T-44-14 — all `mitigate` disposition, all closed by this plan).
- Ready for Phase 45 (Game Summary Popup): the settings-summary surface for Referee Leniency (STATS-02 recaps referee Leniency) was deliberately left unimplemented in `App.tsx`'s `onRoomSettingsConfirmed` — the two new trailing params are discarded (underscore-prefixed) exactly as this plan specifies, since that display surface belongs to Phase 45's match-summary modal, not this plan.

---
*Phase: 44-referee-leniency-advanced-settings-drawer*
*Completed: 2026-08-24*
