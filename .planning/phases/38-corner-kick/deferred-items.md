# Phase 38 (Corner Kick) — Deferred Items

Items discovered during plan execution that are out of scope for the discovering plan
(Scope Boundary rule: only auto-fix issues directly caused by the current task's changes).

## From Plan 38-06 (store selection branches, HexGrid selectability/tints)

- **`pnpm --filter @counter-attack/client typecheck` reports two pre-existing failures,
  neither touched by 38-06:**
  1. `packages/client/src/components/GameBoard.tsx(26,7)`: `PHASE_LABEL`'s
     `Record<GamePhase, string>` is missing the 5 new Corner Kick phase keys
     (`CORNER_KICK_GK_SETUP_ATTACKING`, `CORNER_KICK_GK_SETUP_DEFENDING`,
     `CORNER_KICK_TAKER_SELECT`, `CORNER_KICK_REPOSITION`, `CORNER_KICK_FINAL_SETUP`).
     This is expected — `GameBoard.tsx`'s phase dispatch + `PHASE_LABEL` extension is
     explicitly scoped to a later plan in this phase (per `38-PATTERNS.md`'s file
     classification table, "GameBoard.tsx (phase dispatch + PHASE_LABEL)" is a separate
     file from this plan's `files_modified`). Not fixed here — will resolve once that
     plan lands.
  2. `packages/client/src/components/ActionLog.tsx(329,74)`: "Function lacks ending
     return statement" — unrelated to Corner Kick, not touched by any 38-06 file, and not
     newly introduced (confirmed via `git diff --stat HEAD -- ActionLog.tsx` showing no
     changes from this plan). Pre-existing gap, out of scope per Scope Boundary rule.

Both are non-blocking for 38-06's own scope: `pnpm --filter @counter-attack/client build`
(vite build, no type-check step) and `pnpm --filter @counter-attack/client test` both pass
cleanly (674/674 tests). Flagging here so a later phase-38 plan (or a dedicated cleanup pass)
resolves the `GameBoard.tsx` gap before phase close, and so `ActionLog.tsx`'s pre-existing
issue is tracked rather than silently re-discovered.
