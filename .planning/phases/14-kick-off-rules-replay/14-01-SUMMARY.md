---
plan: 14-01
phase: 14-kick-off-rules-replay
status: complete
completed: '2026-06-12'
requirements_addressed: [MATCH-06, MATCH-07]
key-files:
  created:
    - packages/server/src/__tests__/kickoffSetup.integration.test.ts (2 new MATCH-07 tests)
  modified:
    - packages/shared/src/teams.ts
    - packages/server/src/gameHandlers.ts
---

# Plan 14-01 Summary — Kick Off Rules (MATCH-06 + MATCH-07)

## What Was Built

**MATCH-06 — DEF/MID default placement constraint (Task 1):**
Adjusted all out-of-range DEF and MID starting positions in `HOME_SQUAD` and `AWAY_SQUAD` so every piece satisfies q∈[6,20]:

- Home DEF: q 5→6 (r values unchanged)
- Away DEF: q 31→20
- Away MID: q 26→16
- Home MID was already at q=10 (no change)
  Updated the position-convention comment block to document the MATCH-06 band and per-role q-columns.

**MATCH-07 — Standard-Pass-only opening action (Task 2):**
Inserted a server-side guard in the `GAME_ROLL` handler (after the `INVALID_SEQUENCE` check, before `MISSING_TARGET`) that rejects any `passType` other than `'STANDARD_PASS'` when `room.gameState.phase === 'KICK_OFF'`, emitting `GAME_ERROR 'KICKOFF_STANDARD_PASS_ONLY'` and snapping back via `broadcastState`.

Two new integration tests in `kickoffSetup.integration.test.ts`:

- A HIGH_PASS during KICK_OFF → receives `KICKOFF_STANDARD_PASS_ONLY` error; room stays in KICK_OFF
- A STANDARD_PASS during KICK_OFF → NOT blocked by the guard

## Verification

- Node assertion: all 10 DEF/MID pieces in [6,20] ✓
- `pnpm --filter @counter-attack/shared test` — 218 tests pass ✓
- `pnpm --filter @counter-attack/server test -- kickoffSetup` — 8 tests pass (including 2 new) ✓
- `pnpm typecheck` — clean ✓

## Deviations

None. Task 1 position values were already at the correct values in the working tree (from a prior uncommitted edit); this plan committed them. Task 2 guard and tests implemented exactly as specified.

## Self-Check: PASSED
