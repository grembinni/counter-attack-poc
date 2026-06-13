---
phase: 16-player-roster-team-selection
plan: '01'
subsystem: test
tags: [tdd, red-tests, wave-0, shared, client, server]
dependency_graph:
  requires: []
  provides:
    - TEAM_SQUADS_test_spec
    - FREE_AGENTS_test_spec
    - gameEngine_selectedTeams_test_spec
    - PlayerStatsPanel_firstName_lastName_test_spec
    - TeamSelectionScreen_test_spec
  affects:
    - packages/shared/src/teams.test.ts
    - packages/server/src/__tests__/gameEngine.teamselect.test.ts
    - packages/client/src/components/PlayerStatsPanel.test.tsx
    - packages/client/src/components/TeamSelectionScreen.test.tsx
tech_stack:
  added: []
  patterns:
    - Nyquist Wave 0 RED test pattern (write failing tests before production code)
    - '@ts-expect-error for forward-referencing not-yet-exported symbols'
key_files:
  created:
    - packages/server/src/__tests__/gameEngine.teamselect.test.ts
    - packages/client/src/components/TeamSelectionScreen.test.tsx
  modified:
    - packages/shared/src/teams.test.ts
    - packages/client/src/components/PlayerStatsPanel.test.tsx
decisions:
  - 'TEAM_SQUADS and FREE_AGENTS test file uses @ts-expect-error on import to tolerate missing exports in Wave 0'
  - 'gameEngine.teamselect.test.ts uses @ts-expect-error on each two-arg buildInitialGameState call to maintain type safety elsewhere'
  - "PlayerStatsPanel test asserts 'Home GK' text is ABSENT (inverse assertion) — clean RED signal for the name-field removal"
  - 'TeamSelectionScreen test imports with @ts-expect-error to produce module-not-found RED failure, not a TS compile error'
metrics:
  duration: '~4 minutes'
  completed: '2026-06-13'
  tasks_completed: 2
  files_modified: 4
---

# Phase 16 Plan 01: Wave 0 RED Tests Summary

Established Nyquist Wave 0 RED test state for Phase 16. Replaced `name`-based assertions with `firstName`/`lastName`, added roster-shape assertions for `TEAM_SQUADS`/`FREE_AGENTS`, redesigned player-card test assertions, added `TeamSelectionScreen` behavior tests, and added the two-argument `buildInitialGameState` selectedTeams assertion. All four test files fail as expected until production plans 02–04 land.

## Tasks Completed

| Task | Name                                                               | Commit  | Files                                                                                                                 |
| ---- | ------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------- |
| 1    | Update shared + server roster/engine RED tests                     | 19773c8 | packages/shared/src/teams.test.ts, packages/server/src/**tests**/gameEngine.teamselect.test.ts                        |
| 2    | Update PlayerStatsPanel test + create TeamSelectionScreen RED test | 3bbc890 | packages/client/src/components/PlayerStatsPanel.test.tsx, packages/client/src/components/TeamSelectionScreen.test.tsx |

## Verification State

### Shared test suite (packages/shared)

- Test files: 1 failed | 11 passed (12 total)
- Tests: **15 RED** | 226 passing
- Failure reason: `TEAM_SQUADS` and `FREE_AGENTS` are not exported from `teams.ts` yet — Wave 0 RED confirmed

### Client test suite (packages/client)

- Test files: 3 failed | 6 passed (9 total)
- Tests: **4 RED** | 81 passing
- Failure sources:
  - `TeamSelectionScreen.test.tsx` — module `./TeamSelectionScreen.js` not found (Wave 0 RED)
  - `PlayerStatsPanel.test.tsx` — 3 failures: firstName text not found, #1 number not rendered, "Home GK" still present
  - `ActionPanel.test.tsx` — 1 pre-existing failure (unrelated to Phase 16, tolerated per success criteria)

### Server test suite (packages/server)

Not run standalone in this plan. `gameEngine.teamselect.test.ts` is a new file that will fail when the suite runs because `buildInitialGameState` does not yet accept a second argument.

## What Each Test File Asserts

### packages/shared/src/teams.test.ts (rewritten)

- `TEAM_SQUADS` keys = `['city', 'cosmos', 'crew', 'xolos']` (PLAY-01)
- Each of 4 squads has exactly 11 players
- Each squad has exactly 1 GK with `number === 1` and `highPass === 0` (D-04, Pitfall 3)
- Jersey numbers within each squad form the complete set 1–11 (no duplicates)
- Every player has non-empty `firstName`, `lastName`, `nationality` (replaces `name` check — D-06)
- No player object has a `name` key
- Every player `role` is one of `GK|DEF|MID|FWD|ST` (proves `STR→ST` mapping — Pitfall 2)
- `FREE_AGENTS` has exactly 24 players (PLAY-03)

### packages/server/src/**tests**/gameEngine.teamselect.test.ts (new)

- `buildInitialGameState('ROOM1', { home: 'cosmos', away: 'xolos' }).selectedTeams` deep-equals `{ home: 'cosmos', away: 'xolos' }` (SELECT-01, D-15, D-16)
- Returns 22 pieces when called with selectedTeams
- Home pieces have `id` starting with `home-`; away pieces start with `away-`
- At least one away piece has `position.q > 18` (mirrored to away half)

### packages/client/src/components/PlayerStatsPanel.test.tsx (updated)

- Mock gameState includes `selectedTeams: { home: 'cosmos', away: 'xolos' }` (D-15)
- GK renders `firstName` = "Vinicius" and `lastName` = "Eubsinno" on separate lines (PLAY-02, D-09)
- Role text "GK" appears on line 3 (D-09)
- Jersey number "#1" appears on line 3 (D-09, D-08)
- `queryByText(/Home GK/i)` returns null — old name format absent (D-06)
- All 10 attribute labels still render (regression guard)
- MiniTokenBadge team-keyed pattern tests unchanged (15-03)

### packages/client/src/components/TeamSelectionScreen.test.tsx (new)

- Exactly 4 team card buttons render; no FA/Free Agent card (PLAY-03)
- All 4 cards enabled when `playerSlot=1` and `homePickedTeam=null` (SELECT-01)
- All 4 cards disabled when `playerSlot=2` and `homePickedTeam=null` (SELECT-01)
- After `homePickedTeam='cosmos'`: cosmos card disabled, 3 remaining enabled for away (SELECT-01)
- Clicking enabled card calls `onPick` with that teamId (SELECT-01, D-11, D-12)
- Clicking disabled card does NOT call `onPick`

## Deviations from Plan

None — plan executed exactly as written. The `@ts-expect-error` suppression strategy was chosen over type-casting to preserve diagnostic signal: when the real types land, the directives will be automatically flagged as unnecessary, guiding cleanup.

## Known Stubs

None — this plan only authors test files.

## Threat Flags

None — no production source files created or modified in this plan.

## Self-Check: PASSED

- packages/shared/src/teams.test.ts: FOUND
- packages/server/src/**tests**/gameEngine.teamselect.test.ts: FOUND
- packages/client/src/components/PlayerStatsPanel.test.tsx: FOUND
- packages/client/src/components/TeamSelectionScreen.test.tsx: FOUND
- Commit 19773c8: FOUND
- Commit 3bbc890: FOUND
