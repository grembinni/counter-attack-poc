---
phase: 38-corner-kick
verified: 2026-08-09T23:24:37Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 38: Corner Kick Verification Report

**Phase Goal:** A ball exiting over the defending byline after last being touched by a defending player is awarded and fully playable as a corner kick, matching the physical rulebook's two-window repositioning and header/pass mechanics.
**Verified:** 2026-08-09T23:24:37Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth (Roadmap Success Criteria + Requirements)                                                                                                                                                           | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Byline exit after a defending touch awards a corner kick to the attacking team, and both goalkeepers may reposition first (OOB-03, CORNER-01)                                                             | ✓ VERIFIED | `triggerOutOfBoundsRestart` (`packages/server/src/gameEngine.ts:3510-3600`) classifies a byline exit after a defending touch as `CORNER_KICK`, inverts team ownership to award the attacker, and transitions to `CORNER_KICK_GK_SETUP_ATTACKING` → `CORNER_KICK_GK_SETUP_DEFENDING` (`applyCornerKickGkPlace`/`applyCornerKickGkWindowEnd`, lines 3818-3944). 232 corner-kick-scoped server tests pass, including `gameEngine.outOfBounds.test.ts`/`cornerKick.integration.test.ts` coverage of this exact trigger.                                                                                          |
| 2   | The kicking manager places a corner-taker with the ball in a fixed corner-arc hex, then each manager repositions up to 6 players, alternating 2 at a time, attacking manager first (CORNER-02, CORNER-03) | ✓ VERIFIED | `CORNER_KICK_HEX` (`packages/shared/src/outOfBounds.ts:82`) defines the 4 fixed corner hexes; `applyCornerKickTakerSelect` (gameEngine.ts:3981) places the chosen piece + ball there and opens `CORNER_KICK_REPOSITION`; `CORNER_KICK_STAGES` models 6 alternating attacker/defender stages (2 pieces max each) consumed by `applyCornerKickReposition`/`applyCornerKickStageEnd` (lines 4126-4319). Client: `CornerKickSetupPanel.tsx` (lines 154-276) drives taker selection and the alternating window with correct acting-team gating.                                                                   |
| 3   | Immediately before the kick, a second separate window lets both teams each move one more player up to 3 hexes, attacking manager first (CORNER-06)                                                        | ✓ VERIFIED | `CORNER_KICK_FINAL_SETUP` phase, `applyCornerKickFinalMove`/`applyCornerKickFinalSetupEnd` (gameEngine.ts:4342-4509) enforce a 1-player/team, 3-hex-budget window distinct from CORNER-03's window (separate stage machinery, separate event type `CORNER_KICK_MOVE`). Client panel branch at `CornerKickSetupPanel.tsx:279-336`.                                                                                                                                                                                                                                                                            |
| 4   | The corner is taken as High Pass (penalty area unlimited / elsewhere ≤15 hexes, header required) or Low Pass (no header), with the existing 8+ combined-score accuracy check (CORNER-04, CORNER-05)       | ✓ VERIFIED | `applyRoll`'s `PASS` case (gameEngine.ts:2032-2280) gates a corner's Low Pass (`STANDARD_PASS` + `cornerKickTeam` set) through the same `accuracyType = 'HIGH'` (threshold 8) check as an ordinary High Pass; an accurate `HIGH_PASS` corner transitions to `HEADER` phase (lines 2521-2579) while an accurate Low Pass corner does not. `gameHandlers.ts:1832-1845` applies `CORNER_KICK_UNLIMITED_DISTANCE` inside the byline owner's penalty area and otherwise falls through to `passValidator.ts`'s existing HIGH cap of 15 hexes (`dist > 15` check, line 93) — matching the requirement text exactly. |
| 5   | Requirement traceability: OOB-03, CORNER-01..06 all covered by phase plans                                                                                                                                | ✓ VERIFIED | `.planning/REQUIREMENTS.md` lines 69-88 list all 7 IDs under Phase 38; the union of all `requirements:` frontmatter fields across the 33 plans (`.planning/phases/38-corner-kick/*-PLAN.md`) covers exactly OOB-03 + CORNER-01 through CORNER-06 with no orphans.                                                                                                                                                                                                                                                                                                                                            |

**Score:** 5/5 roadmap-level truths verified (expanded to 11 granular must-haves counting engine, handler, client, and requirement-traceability sub-checks individually during investigation — all passed).

### Required Artifacts

| Artifact                                                  | Expected                                                                          | Status     | Details                                                                                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/outOfBounds.ts`                      | `CORNER_KICK_HEX` fixed corner geometry                                           | ✓ VERIFIED | Defined and exported, consumed by engine and client                                                                                                              |
| `packages/shared/src/offside.ts`                          | `CORNER_KICK_STAGES`, `cornerKickStageTeam`                                       | ✓ VERIFIED | 6-stage alternating model, referenced by engine + `CornerKickSetupPanel.tsx`                                                                                     |
| `packages/shared/src/types.ts`                            | 5 Corner Kick `GamePhase` values + event types                                    | ✓ VERIFIED | `CORNER_KICK_GK_SETUP_ATTACKING/DEFENDING`, `CORNER_KICK_TAKER_SELECT`, `CORNER_KICK_REPOSITION`, `CORNER_KICK_FINAL_SETUP` all present in the `GamePhase` union |
| `packages/server/src/gameEngine.ts`                       | `triggerOutOfBoundsRestart` CORNER_KICK branch + all `applyCornerKick*` functions | ✓ VERIFIED | All functions present, substantive, and covered by 164+23 passing unit/integration tests                                                                         |
| `packages/server/src/gameHandlers.ts`                     | Corner kick socket surface (GK place, taker select, reposition, final move, undo) | ✓ VERIFIED | All handlers present; 45 passing `gameHandlers.cornerKick.test.ts` tests                                                                                         |
| `packages/client/src/components/CornerKickSetupPanel.tsx` | UI for all 5 corner phases + High/Low choice                                      | ✓ VERIFIED | Full implementation, no stub returns; wired into `GameBoard.tsx:370`; 51 passing tests                                                                           |
| `packages/client/src/components/HexGrid.tsx`              | Corner-specific selectability/highlighting                                        | ✓ VERIFIED | GK placement clicks, corner-taker hex gold-highlight, reposition destination highlighting all present                                                            |

### Key Link Verification

| From                                       | To                                                 | Via                                                                     | Status                    | Details                                                                                                                                                                                                                                                   |
| ------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ball exit event                            | `triggerOutOfBoundsRestart`                        | Call sites at gameEngine.ts:3372, 3411                                  | ✓ WIRED                   | Reachable from both the shot/pass-out-of-bounds path and the GK-spill loose-ball path                                                                                                                                                                     |
| `CornerKickSetupPanel`                     | `useGameStore` emitters                            | `emitCornerKickTaker`, `emitEndTurn`, `emitUndo`, `setSelectedPassType` | ✓ WIRED                   | All emitters call through to real socket events consumed by `gameHandlers.ts`                                                                                                                                                                             |
| `GameBoard.tsx`                            | `CornerKickSetupPanel`                             | direct render, phase-gated                                              | ✓ WIRED                   | Confirmed import + render at line 370                                                                                                                                                                                                                     |
| Client `computeCornerRepositionValidHexes` | Server `applyCornerKickReposition` occupancy check | destination-hex validity                                                | ⚠️ PARTIAL (non-blocking) | WR-02 (38-REVIEW.md): server occupancy check doesn't exclude the moving piece's own hex, client does — mismatch surfaces as a rejected move with generic copy on a rare self-hex click. Not a Blocker (review classified Warning, zero Critical/Blocker). |

### Behavioral Spot-Checks

| Behavior                                                                                | Command                                                                     | Result                    | Status |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------- | ------ |
| Corner-kick server logic (engine + integration + handlers)                              | `pnpm --filter @counter-attack/server exec vitest run cornerKick`           | 3 files, 232 tests passed | ✓ PASS |
| Corner-kick client panel                                                                | `pnpm --filter @counter-attack/client exec vitest run CornerKickSetupPanel` | 1 file, 51 tests passed   | ✓ PASS |
| Shared out-of-bounds classification (OOB-03 routing)                                    | `pnpm --filter @counter-attack/shared exec vitest run outOfBounds`          | 1 file, 57 tests passed   | ✓ PASS |
| Client typecheck (no lingering PHASE_LABEL / ActionLog gaps noted in deferred-items.md) | `pnpm --filter @counter-attack/client typecheck`                            | Clean, zero errors        | ✓ PASS |
| Server typecheck                                                                        | `pnpm --filter @counter-attack/server typecheck`                            | Clean, zero errors        | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s)               | Description                                          | Status      | Evidence                                                                                              |
| ----------- | ---------------------------- | ---------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| OOB-03      | 38-01, 38-02, ... (15 plans) | Byline exit after defending touch → corner kick      | ✓ SATISFIED | `triggerOutOfBoundsRestart` CORNER_KICK branch                                                        |
| CORNER-01   | 38-01, 38-02, 38-03, ...     | Both GKs may reposition first                        | ✓ SATISFIED | `CORNER_KICK_GK_SETUP_ATTACKING/DEFENDING` + `applyCornerKickGkPlace`                                 |
| CORNER-02   | 38-01, 38-02, ...            | Corner-taker placed at fixed arc hex with ball       | ✓ SATISFIED | `applyCornerKickTakerSelect`, `CORNER_KICK_HEX`                                                       |
| CORNER-03   | 38-01, 38-02, 38-03, ...     | 6 alternating stages, 2 pieces/stage, attacker first | ✓ SATISFIED | `CORNER_KICK_STAGES`, `applyCornerKickReposition`/`applyCornerKickStageEnd`                           |
| CORNER-04   | 38-01, 38-02, 38-04, ...     | High/Low Pass with 8+ accuracy, distance rules       | ✓ SATISFIED | `applyRoll` PASS-case corner gate; `gameHandlers.ts` `CORNER_KICK_UNLIMITED_DISTANCE` in-box override |
| CORNER-05   | 38-01, 38-04, ...            | High Pass requires header; Low Pass does not         | ✓ SATISFIED | HIGH_PASS → `HEADER` phase transition; STANDARD_PASS (Low) does not                                   |
| CORNER-06   | 38-01, 38-03, ...            | Second pre-kick 3-hex window, attacker first         | ✓ SATISFIED | `CORNER_KICK_FINAL_SETUP`, `applyCornerKickFinalMove`/`applyCornerKickFinalSetupEnd`                  |

No orphaned requirements: the Phase 38 row-set in `.planning/REQUIREMENTS.md`'s traceability table (OOB-03, CORNER-01..06) exactly matches the union of all plans' `requirements:` frontmatter.

Note: `.planning/REQUIREMENTS.md`'s traceability table still marks these 7 rows `Pending` (not `Complete`) and the unchecked `- [ ]` checkboxes in the requirements body are unchanged — this is explicitly flagged in `38-33-SUMMARY.md` as orchestrator-owned post-verification bookkeeping, not a code gap. Recommend updating REQUIREMENTS.md/ROADMAP.md progress table as part of phase close-out.

### Anti-Patterns Found

| File                                           | Line                               | Pattern                                                                                 | Severity   | Impact                                                                                                                                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/gameEngine.ts`            | 5473                               | Pre-existing `TODO` in `applyQuickThrow` (GK Quick Throw opponent-possession edge case) | ℹ️ Info    | Predates Phase 38 (introduced 2026-07-12, commit `a6b0aaf`), unrelated to corner-kick logic — not in scope for this phase, not a regression.                                                                                                                      |
| `packages/client/src/components/ActionLog.tsx` | 329-1043                           | `formatEvent` switch has no compile-time exhaustiveness guard (WR-01, 38-REVIEW.md)     | ⚠️ Warning | Non-blocking per fresh code review (0 Critical/Blocker). Same defect class as a previously-shipped crash; recommend follow-up hardening but does not affect current Corner Kick functionality (all known event types have cases).                                 |
| `packages/server/src/gameEngine.ts`            | 4163 (`applyCornerKickReposition`) | Server occupancy check doesn't exclude the moving piece's own hex (WR-02, 38-REVIEW.md) | ⚠️ Warning | Non-blocking. Client excludes the moving piece; server doesn't. Surfaces as a rare rejected move with generic `INVALID_TARGET` copy (IN-01) rather than a crash or incorrect game state. Does not block any of the 7 CORNER/OOB requirements from being achieved. |

No `FIXME`/`XXX`/unreferenced `TBD` debt markers found in any corner-kick file. No blocker anti-patterns found.

### Human Verification Required

None outstanding. All human-verification items for this phase were resolved across the phase's four verification checkpoints:

- `38-09-SUMMARY.md` — original two-browser walkthrough
- `38-15-SUMMARY.md` — post-gap-closure-round-1 walkthrough, D-GAP-01/D-GAP-02 rulings
- `38-24-SUMMARY.md` — post-gap-closure-round-2 walkthrough, D-GAP-03 ruling
- `38-30-SUMMARY.md` — post-gap-closure-round-3 walkthrough (surfaced the Undo regression and the offside-ring bug)
- `38-33-SUMMARY.md` — final checkpoint: all 7 re-scoped walkthrough steps CONFIRMED, D-GAP-01 reconfirmed, offside-ring-after-goal bug (`38-30-SUMMARY.md` bug 1) explicitly ACCEPTED as a deferred, out-of-scope item, tracked at `.planning/todos/pending/2026-08-09-bug-offside-ring-after-goal.md` with a full evidence trail in `deferred-items.md`.

The offside-ring-after-goal deferral is a legitimate, human-approved scope boundary (the bug is in the goal→kickoff reset lifecycle, not in any corner-kick file — confirmed by static analysis in `deferred-items.md`'s "From Plan 38-32" section) and is not re-opened here.

### Gaps Summary

No gaps. All 7 requirement IDs (OOB-03, CORNER-01 through CORNER-06) have working, tested, human-verified implementations. The 2 Warnings and 1 Info from the fresh code review (`38-REVIEW.md`) are real but non-blocking — they describe an edge-case client/server validation mismatch and a latent maintainability risk, neither of which prevents any of the roadmap's 4 success criteria from being true today. The offside-ring-after-goal bug is a pre-existing, unrelated defect in the kickoff-reset lifecycle, explicitly triaged out of this phase's scope with human sign-off.

---

_Verified: 2026-08-09T23:24:37Z_
_Verifier: Claude (gsd-verifier)_
