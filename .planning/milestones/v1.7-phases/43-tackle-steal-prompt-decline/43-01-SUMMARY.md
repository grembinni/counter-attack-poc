---
phase: 43-tackle-steal-prompt-decline
plan: 01
subsystem: shared-types
tags: [types, events, game-state, move-validator, tackle, steal]
dependency-graph:
  requires: []
  provides:
    - GamePhase.TACKLE_STEAL_PROMPT
    - ActionEventType.TACKLE_STEAL_DECLINED
    - GameState.tackleStealDeclineEnabled
    - GameState.tackleStealPromptTeam
    - GameState.tackleStealPromptKind
    - GameState.tackleStealPromptDefenderId
    - GameState.tackleStealPromptCarrierId
    - GameState.tackleStealPromptQueue
    - GameState.tackleStealPromptResume
    - ClientEvents.GAME_TACKLE_STEAL_CHOICE
    - moveValidator.STEAL_ATTEMPT-defender-ordering
  affects:
    - packages/shared/src/stoppagePhases.ts (exclusion comment only, no array change)
    - packages/client/src/components/GameBoard.tsx (PHASE_LABEL)
    - packages/client/src/components/ActionLog.tsx (switch exhaustiveness)
tech-stack:
  added: []
  patterns:
    - 'Ephemeral prompt-cluster fields (mirrors gkDiveAtFeetResume/gkBoxEntryResume shape) instead of a persistent decline-tracking array'
    - 'Stable Array.prototype.sort on a spread copy for deterministic tackling-descending ordering with documented tie-break'
key-files:
  created: []
  modified:
    - packages/shared/src/types.ts
    - packages/shared/src/events.ts
    - packages/shared/src/stoppagePhases.ts
    - packages/shared/src/stoppagePhases.test.ts
    - packages/shared/src/moveValidator.ts
    - packages/shared/src/moveValidator.test.ts
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/ActionLog.tsx
decisions:
  - "TACKLE_STEAL_DECLINED ActionEvent carries no ballAfter field, mirroring GK_DIVE_AT_FEET_DECLINED, so 43-02's REPLAY_ELIGIBLE_TYPES exclusion applies for free"
  - 'tackleStealPromptResume is byte-identical in shape to gkDiveAtFeetResume (phase/activeTeam/movementSlot only, no fourth key)'
  - 'No persistent stealDeclinedByIds/tackleDeclinedByIds array introduced; TACKLE-03 ring-persistence is delivered by never appending a declined defender to the existing stealAttemptedByIds/tackleAttemptedByIds arrays'
metrics:
  duration: '~35min'
  completed: 2026-08-23
---

# Phase 43 Plan 01: Tackle/Steal Shared Type Surface + Defender Ordering Summary

Added the complete shared-package type surface for the Tackle/Steal decline prompt (new
`TACKLE_STEAL_PROMPT` GamePhase, `TACKLE_STEAL_DECLINED` ActionEventType, six-field ephemeral
`GameState` prompt cluster, `GAME_TACKLE_STEAL_CHOICE` client event) and implemented D-02's
tackling-descending ordering of the `STEAL_ATTEMPT` defenders array in `moveValidator.ts`, with
a documented stable tie-break.

## What Was Built

**Task 1 — Type surface (commit `92309c4a`):**

- `GamePhase` union: `'TACKLE_STEAL_PROMPT'` added immediately after `'GK_BOX_ENTRY_MOVE'`,
  documented as a mid-duel decision prompt, not a stoppage.
- `ActionEventType` union + `ActionEvent` payload variant: `'TACKLE_STEAL_DECLINED'` added after
  `'GK_DIVE_AT_FEET_DECLINED'`, carrying `kind: 'STEAL' | 'TACKLE'`, `defenderId`, `carrierId`,
  `timestamp` — deliberately no `ballAfter` field.
- `GameState` fields: `tackleStealDeclineEnabled?: boolean` toggle next to `outOfBoundsEnabled`,
  plus the six-field ephemeral prompt cluster (`tackleStealPromptTeam`, `tackleStealPromptKind`,
  `tackleStealPromptDefenderId`, `tackleStealPromptCarrierId`, `tackleStealPromptQueue`,
  `tackleStealPromptResume`) placed immediately after the `gkBoxEntryResume` block. All fields
  respect `exactOptionalPropertyTypes` (`?: T | null`, never `undefined`).
- `packages/shared/src/events.ts`: `GAME_TACKLE_STEAL_CHOICE: 'game:tackle-steal-choice'` added
  to `ClientEvents` beside `GAME_GK_DIVE_AT_FEET`, with its typed
  `(accept: boolean) => void` signature in `ClientToServerEvents`.
- `packages/shared/src/stoppagePhases.ts`: no entry added to `STOPPAGE_PHASES` (still 15
  members); the "Deliberately EXCLUDED" comment block now names `'TACKLE_STEAL_PROMPT'`
  alongside `'FOUL_CHOICE'`/`'GK_DIVE_AT_FEET_PROMPT'`.
- `packages/client/src/components/GameBoard.tsx`: one `PHASE_LABEL` entry
  (`TACKLE_STEAL_PROMPT: 'TACKLE / STEAL'`) added after `GK_BOX_ENTRY_MOVE`, keeping
  `Record<GamePhase, string>` exhaustive.
- `packages/shared/src/stoppagePhases.test.ts`: added `TACKLE_STEAL_PROMPT` to the
  `NON_STOPPAGE_VALUES` full-coverage array (44 → 45 total `GamePhase` values), plus explicit
  assertions that `isStoppagePhase('TACKLE_STEAL_PROMPT')` is `false` and
  `STOPPAGE_PHASES.length === 15`.

**Task 2 — Defender ordering (commit `41655235`):**

- `validateMove`'s `STEAL_ATTEMPT` branch now sorts the already-filtered defenders array by
  `tackling` descending on a spread copy (`[...eligibleDefenders].sort((a, b) => b.tackling -
a.tackling)`), never mutating the `.filter` result. A comment documents the stable-sort
  tie-break explicitly (equal-tackling defenders retain `getZoIDefenders`/`state.pieces` order).
- No second `isActivePiece` filter added — the existing filter at the `opponents` derivation
  (Phase 42, BUG-38) already excludes red-carded/benched pieces.
- `TACKLE_ATTEMPT` branch left byte-for-byte unchanged.
- 4 new test cases added to `moveValidator.test.ts`: descending-tackling ordering (3 defenders),
  stable tie-break on equal tackling (proves `state.pieces` order wins, not id order),
  `stealAttemptedByIds` exclusion surviving the sort, and a red-carded-opponent BUG-38
  regression guard confirmed absent from a 2-active-defender `defenders` array.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ActionLog.tsx switch exhaustiveness gap surfaced by the new `ActionEventType` member**

- **Found during:** Task 1, `pnpm -r typecheck` verification step
- **Issue:** `packages/client/src/components/ActionLog.tsx`'s `formatEvent` switch statement
  over `ActionEvent['type']` has no `default` case (a pre-existing, previously-non-blocking
  tech-debt item tracked as Phase 38 WR-01 "ActionLog switch exhaustiveness gap" in
  PROJECT.md). Adding `TACKLE_STEAL_DECLINED` to the `ActionEventType` union made TypeScript's
  control-flow analysis unable to prove every path returns, producing `TS2366: Function lacks
ending return statement`.
- **Fix:** Added a `case 'TACKLE_STEAL_DECLINED':` branch mirroring
  `GK_DIVE_AT_FEET_DECLINED`'s declined-offer log format (`[STEAL]`/`[TACKLE]` prefix, defender
  name, "declined to steal/tackle" content).
- **Files modified:** `packages/client/src/components/ActionLog.tsx`
- **Commit:** `92309c4a`

None of Rule 2, 3, or 4 triggered — no missing critical functionality, no other blocking
issues, and no architectural changes were needed.

## Verification

- `pnpm --filter @counter-attack/shared test -- stoppagePhases`: 64/64 tests pass
- `pnpm --filter @counter-attack/shared test -- moveValidator`: 27/27 tests pass
- `pnpm --filter @counter-attack/shared test` (full suite): 886/886 tests pass
- `pnpm --filter @counter-attack/client test -- ActionLog GameBoard`: 143/143 tests pass
- `pnpm -r typecheck`: shared, client, server all `Done` (0 errors)
- `grep -rn "stealDeclinedByIds\|tackleDeclinedByIds" packages/` : only appears inside doc
  comments explaining the field is deliberately NOT introduced — no real identifier exists
  anywhere in the codebase, matching the plan's verification requirement.
- `STOPPAGE_PHASES.length === 15` confirmed by test; `TACKLE_STEAL_PROMPT` absent from the
  array (only present in the exclusion comment).

## Known Stubs

None. This plan is a pure type/ordering addition — no UI wiring, no engine logic, no socket
handler. No code enters `TACKLE_STEAL_PROMPT` and no `TACKLE_STEAL_DECLINED` event is ever
emitted yet (per the plan's own success criteria); this is expected and intentional, not a
stub — panel routing, engine logic, and the socket handler are explicitly scoped to plans
43-03/43-04/43-05.

## Threat Flags

None. All three STRIDE threat register entries (T-43-01, T-43-02, T-43-03) were pure
declarations in this plan with no new runtime surface exercised — T-43-02's runtime
`typeof accept !== 'boolean'` validation and T-43-03's server-side defender-id trust boundary
are explicitly deferred to plan 43-05's/43-04's handler tasks per the threat model's own
mitigation plan.

## Self-Check: PASSED

- FOUND: packages/shared/src/types.ts
- FOUND: packages/shared/src/events.ts
- FOUND: packages/shared/src/stoppagePhases.ts
- FOUND: packages/shared/src/stoppagePhases.test.ts
- FOUND: packages/shared/src/moveValidator.ts
- FOUND: packages/shared/src/moveValidator.test.ts
- FOUND: packages/client/src/components/GameBoard.tsx
- FOUND: packages/client/src/components/ActionLog.tsx
- FOUND commit 92309c4a in git log
- FOUND commit 41655235 in git log
