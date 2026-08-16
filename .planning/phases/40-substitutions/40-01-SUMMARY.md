---
phase: 40-substitutions
plan: 01
subsystem: shared-types
tags: [typescript, shared-contracts, game-state, undo, replay]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: redCarded/yellowCards/injuryCount PlayerPiece fields (red-card cap reads these)
provides:
  - STOPPAGE_PHASES allow-list + isStoppagePhase() predicate (SUB-01)
  - MAX_SUBS_PER_TEAM constant and maxOnPitchFor() derivation (SUB-04/SUB-06)
  - BenchEntryStatus/BenchEntry three-state bench model (D-13)
  - GameState.bench/subsUsed/addedTimeBonus fields
  - PlayerPiece.playerId field
  - SUBSTITUTION ActionEventType/ActionEvent member, rendered in ActionLog
  - GAME_SUBSTITUTION client event + SubstitutionPayload type
  - SUBSTITUTION registered as an unconditional Undo boundary (server + client mirror)
  - SUBSTITUTION documented as a deliberate REPLAY_ELIGIBLE_TYPES exclusion
affects: [40-02, 40-03, 40-04, 40-05, 40-06, 40-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Shared GamePhase[] allow-list + isStoppagePhase predicate, promoted to packages/shared so client and server import the identical list (mirrors validUndoPhases idiom)'
    - 'Per-event-type Undo/Replay registration checklist applied to a new ActionEventType at declaration time (server isBoundary + client mirror + REPLAY_ELIGIBLE_TYPES decision), not deferred'

key-files:
  created:
    - packages/shared/src/stoppagePhases.ts
    - packages/shared/src/stoppagePhases.test.ts
  modified:
    - packages/shared/src/index.ts
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ActionPanel.tsx
    - packages/server/src/gameEngine.ts

key-decisions:
  - 'STOPPAGE_PHASES locked to exactly 15 GamePhase values per plan spec, verified against the full 44-member GamePhase union with a hardcoded 29-value non-stoppage test list'
  - "maxOnPitchFor is derived from state.pieces (never a stored counter), matching D-08's redCardCount-from-pieces requirement"
  - 'SUBSTITUTION registered as an unconditional applyUndo/canUndo boundary but explicitly excluded from REPLAY_ELIGIBLE_TYPES (no ballAfter, no board change)'

patterns-established:
  - 'New ActionEventType additions must touch: ActionEventType union, ActionEvent union member, ActionLog.formatEvent case, applyUndo isBoundary, ActionPanel canUndo mirror, and a documented REPLAY_ELIGIBLE_TYPES decision (include or exclude) — all four Phase 40 plan tasks demonstrate this checklist end-to-end in one commit sequence'

requirements-completed: [SUB-01, SUB-02, SUB-04, SUB-05, SUB-06, SUB-07]

# Metrics
duration: ~10min
completed: 2026-08-16
---

# Phase 40 Plan 01: Shared Substitution Contracts Summary

**Shared `STOPPAGE_PHASES`/`isStoppagePhase` eligibility module, `BenchEntry` three-state bench model, `GameState` roster fields, and a fully Undo/Replay-registered `SUBSTITUTION` `ActionEvent` — no behavior change yet, contract-only.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-08-16T17:33:00Z (approx.)
- **Completed:** 2026-08-16T17:41:00Z
- **Tasks:** 3/3 completed
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- Created `packages/shared/src/stoppagePhases.ts` — the single source of truth `STOPPAGE_PHASES` 15-value allow-list, `isStoppagePhase()`, `MAX_SUBS_PER_TEAM = 3`, and `maxOnPitchFor()` (derived from `pieces`, never a stored counter), plus a regression-guard test asserting classification of all 44 `GamePhase` values.
- Extended `packages/shared/src/types.ts` with `BenchEntryStatus`/`BenchEntry` (D-13's three mutually-exclusive states via a single `status` field), `PlayerPiece.playerId`, and `GameState.bench`/`subsUsed`/`addedTimeBonus` — all optional, all documented with reset/independence semantics.
- Added the `SUBSTITUTION` `ActionEventType` + `ActionEvent` union member and `GAME_SUBSTITUTION`/`SubstitutionPayload` to `packages/shared/src/events.ts`.
- Registered `SUBSTITUTION` everywhere the codebase's recurring "new event invisible to Undo/Replay" bug class (BUG-30/31/37) requires: `ActionLog.formatEvent`'s exhaustive switch, `gameEngine.ts`'s `applyUndo` `isBoundary` reduce (unconditional term), the client-side `ActionPanel.tsx` `canUndo` mirror (identical unconditional term), and a documented deliberate exclusion from `REPLAY_ELIGIBLE_TYPES`.

## Task Commits

1. **Task 1: Create the shared substitution-eligibility module (STOPPAGE_PHASES + caps)** - `f7fcc90` (feat)
2. **Task 2: Add BenchEntryStatus/BenchEntry, GameState roster fields, PlayerPiece.playerId, SUBSTITUTION event and GAME_SUBSTITUTION client event** - `92b1082` (feat)
3. **Task 3: Register SUBSTITUTION in every per-event-type bookkeeping list** - `4464905` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/shared/src/stoppagePhases.ts` - `STOPPAGE_PHASES`, `isStoppagePhase`, `MAX_SUBS_PER_TEAM`, `maxOnPitchFor`
- `packages/shared/src/stoppagePhases.test.ts` - full 44-value `GamePhase` coverage + `maxOnPitchFor` edge cases
- `packages/shared/src/index.ts` - barrel export for `stoppagePhases.js`
- `packages/shared/src/types.ts` - `BenchEntryStatus`, `BenchEntry`, `PlayerPiece.playerId`, `GameState.bench`/`subsUsed`/`addedTimeBonus`, `SUBSTITUTION` event type + union member
- `packages/shared/src/events.ts` - `GAME_SUBSTITUTION` client event, `SubstitutionPayload` type, typed `ClientToServerEvents` signature
- `packages/client/src/components/ActionLog.tsx` - `formatEvent` case `'SUBSTITUTION'` (`[SUB] #N Off → On (n/3)`)
- `packages/client/src/components/ActionPanel.tsx` - `canUndo` mirror extended with the `SUBSTITUTION` unconditional boundary term
- `packages/server/src/gameEngine.ts` - `applyUndo` `isBoundary` unconditional `SUBSTITUTION` term; `REPLAY_ELIGIBLE_TYPES` deliberate-exclusion comment

## Decisions Made

- `STOPPAGE_PHASES` locked to exactly the 15 values specified in the plan (verified programmatically against the full 44-member `GamePhase` union via a hardcoded 29-value non-stoppage test list, not just the 15 positive assertions the plan required — stronger regression coverage than the minimum acceptance bar).
- `SubstitutionPayload` was defined in `events.ts` per the plan's explicit instruction, diverging from the `DraftPickPayload`/`DraftRearrangePayload` precedent (which lives in `types.ts`) — followed the plan literally since it named the file explicitly.
- `SUBSTITUTION` is an unconditional Undo boundary on both tiers but a documented `REPLAY_ELIGIBLE_TYPES` exclusion — a substitution changes roster state but not board/ball state, so it has no replay frame, matching the `SECOND_HALF_CONFIRM`/`GK_BOX_ENTRY_MOVE` precedent.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria greps pass verbatim (verified individually per task, see below).

## Issues Encountered

- `pnpm --filter <pkg> test` intermittently failed with a Vitest `tinypool` "Worker exited unexpectedly" error on the full server suite (one file silently dropped, 52/53). This is a known Windows `threads`-pool flake (documented in project memory, not a real regression) — reran with `npx vitest run --pool=forks` from each package directory, which passed 53/53 server files (1340 tests) and 34/34 client files (958 tests) cleanly. No code issue; environment-only.
- `node_modules` was absent in this fresh worktree; ran `pnpm install` (no junction workarounds, reads from the shared pnpm content-addressable store) to populate it safely.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Shared substitution contracts (`STOPPAGE_PHASES`, `BenchEntry`, `GameState.bench`/`subsUsed`/`addedTimeBonus`, `SUBSTITUTION` event, `GAME_SUBSTITUTION` client event) are in place and fully typechecked/tested — plans 40-02 (`applySubstitution` engine logic) through 40-07 (integration tests) can now build against a stable surface.
- No behavior change shipped in this plan (as intended) — no substitution can actually be performed until plan 40-02/40-05 land.
- Full monorepo verification: shared 839 tests / server 1340 tests (1 skipped, 1 todo) / client 958 tests, all green; `pnpm typecheck` clean across all 3 packages.

---

_Phase: 40-substitutions_
_Completed: 2026-08-16_
