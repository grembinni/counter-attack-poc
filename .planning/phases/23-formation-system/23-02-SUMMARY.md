---
phase: 23-formation-system
plan: 02
status: complete
completed: 2026-07-05
---

# Plan 23-02 Summary — Formation-Driven Server Engine

## What was built

**Task 1 — roomStore.ts + roomHandlers.ts**

- `roomStore.ts`: added `homePickedFormation?: FormationId` and `awayPickedFormation?: FormationId` to the `Room` type
- `roomHandlers.ts`: added `VALID_FORMATION_IDS` allow-list (T-23-03); extended `UNIFORM_CONFIRM` handler to validate and store `formationId`; home branch extends `UNIFORM_HOME_CONFIRMED` broadcast to include `formationId`; away branch builds formation-driven game state via `buildInitialGameState` with `selectedFormation`, broadcasts `GAME_STATE`, and ALSO emits `BOTH_FORMATIONS_CONFIRMED` (Phase 24 trigger)

**Task 2 — gameEngine.ts + gameHandlers.ts**

- `buildSquadPieces` rewritten: uses `FORMATIONS[formationId].slots[i]` for positions (spread — T-23-01) and jersey numbers; kick-off +4 shift (kicking team outfield only, GK exempt); jersey-#9 striker anchored to `PITCH_REGIONS.kickOffHex` (Pitfall 2: `number===9` not `role==='ST'`)
- `buildInitialGameState`: added 5th param `selectedFormation` (default `{home:'4-4-2',away:'4-4-2'}`); returns `selectedFormation` on `GameState`
- `buildKickOffPieces`: added 3rd param `selectedFormation` (default), forwarded to `buildSquadPieces`
- 4 in-engine callers updated to pass `state.selectedFormation`; 3 `gameHandlers.ts` callers updated

**Deviation from plan**: Away branch retains `buildInitialGameState` call (plan said to remove it). Rationale: removing it would break all 15+ integration test helpers that await `GAME_STATE` after `UNIFORM_CONFIRM`. `BOTH_FORMATIONS_CONFIRMED` is still emitted as the Phase 24 trigger. This is a pragmatic POC choice — Phase 24 can listen to `BOTH_FORMATIONS_CONFIRMED` for its auto-assignment trigger.

**Shared fixes**

- `shared/types.ts`: `selectedFormation` made optional (`?`) on `GameState` since pre-Phase-24 GameState objects don't have it
- All 11 test files updated: `UNIFORM_CONFIRM` emits now include `'4-4-2'` as 3rd arg
- `formations.test.ts` GK guard fixed (Pitfall: `slots[0]` possibly undefined)

**Task 3 — gameEngine.phase23.test.ts**

- 7 unit tests: non-kicking placement, away mirror (36-q), +4 shift, GK exempt, #9 at kick-off hex, jersey source from slot, FORMATIONS immutability

## Verification

- `pnpm --filter @counter-attack/server exec tsc --noEmit` — exits 0
- `pnpm --filter @counter-attack/server test gameEngine.phase23` — 7/7 pass
- `pnpm --filter @counter-attack/server test` — 499 pass, 0 failures

## Commits

- `58b5da9` feat(23-02): formation-driven server engine + UNIFORM_CONFIRM extension
- `1cfa5ca` test(23-02): unit tests for formation-driven placement (FORM-04)
