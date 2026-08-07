---
phase: 38-corner-kick
plan: 07
subsystem: ui
tags: [react, zustand, vitest, typescript, hex-grid, corner-kick, action-log]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 06)
    provides: useGameStore selectPiece branches for all 4 interactive Corner Kick phases, emitCornerKickGkPlace/emitCornerKickTaker store actions, HexGrid selectability/tint/ring wiring
provides:
  - CornerKickSetupPanel — single panel branching internally across all 5 corner phases plus the PASS-phase High/Low Pass choice
  - GameBoard.tsx PHASE_LABEL entries and phase-dispatch registration for the 5 corner phases (plus PASS-with-cornerKickTeam)
  - BallLocationRing.tsx BALL_MARKER_PHASES extended with the 5 corner phases
  - ActionLog.tsx render cases for CORNER_KICK_GK_PLACE/CORNER_KICK_TAKER_PLACED/CORNER_KICK_STAGE_ADVANCE/CORNER_KICK_MOVE/CORNER_KICK_ACCURACY and the CORNER_KICK restart label
affects: [38-08, 38-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'CornerKickSetupPanel structurally mirrors GoalKickSetupPanel: same withEndTurnGuard/pendingEndTurn soft-confirm dialog, same acting-team-vs-waiting-panel branch shape, same ctaColorClass CTA state derivation'
    - 'The PASS-phase High/Low Pass choice reuses the existing STANDARD_PASS/HIGH_PASS pass-type selection path (setSelectedPassType) instead of a new corner-specific emitter — mirrors the Throw-In precedent of reusing existing pass-type labels'

key-files:
  created:
    - packages/client/src/components/CornerKickSetupPanel.tsx
    - packages/client/src/components/CornerKickSetupPanel.module.css
    - packages/client/src/components/CornerKickSetupPanel.test.tsx
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.test.tsx
    - packages/client/src/components/BallLocationRing.tsx
    - packages/client/src/components/BallLocationRing.test.tsx
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ActionLog.test.tsx

key-decisions:
  - "GameBoard's dispatch ternary was extended with a 6th condition (phase === 'PASS' && cornerKickTeam != null) beyond the plan's literal '5 corner phases' instruction, because the plan's own must_have truth ('the kicking manager chooses between a High Pass and a Low Pass before the corner is taken') is otherwise unreachable in the live UI — ActionPanel.tsx is never touched anywhere in phase 38 and has zero corner-kick awareness"
  - "CORNER-03's constraint-row remaining count implements the plan's precise per-piece filter: eligible pieces with cornerKickUsedPace < 6, restricted to already-touched pieces (cornerKickStagePlacedIds) once the round's 2-distinct-piece budget is full"
  - "GK reposition windows (CORNER_KICK_GK_SETUP_ATTACKING/_DEFENDING) have no 'N eligible' constraint and Confirm is always immediately ready — mirrors applyCornerKickGkWindowEnd's server behavior, which performs no move validation and always accepts confirming with zero placements"

patterns-established:
  - "Corner Kick's panel-to-dispatch registration follows the same three-file checklist (GameBoard PHASE_LABEL + dispatch, BallLocationRing BALL_MARKER_PHASES, ActionLog case arms) established for Goal Kick in Phase 37 — confirmed working end to end for a 6th restart-phase-family addition"

requirements-completed: [CORNER-01, CORNER-02, CORNER-03, CORNER-04, CORNER-05, CORNER-06]

# Metrics
duration: ~55min
completed: 2026-08-07
---

# Phase 38 Plan 07: Corner Kick Presentation Layer Summary

**A single `CornerKickSetupPanel` drives all five corner-kick setup phases plus the PASS-phase High/Low Pass choice, registered into `GameBoard`'s phase dispatch/labels, `BallLocationRing`'s ball marker, and `ActionLog`'s event rendering — closing the two non-compiler-enforced registration sites Phase 37 flagged as this codebase's recurring bug class.**

## Performance

- **Duration:** ~55 min (includes one-time `pnpm install` + `pnpm --filter @counter-attack/shared build` for the fresh worktree checkout)
- **Started:** 2026-08-07T13:35:00Z (approx)
- **Completed:** 2026-08-07T14:30:00Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 9 (3 created, 6 modified)

## Accomplishments

- `CornerKickSetupPanel.tsx`: one component branching internally across `CORNER_KICK_GK_SETUP_ATTACKING`/`_DEFENDING` (uncapped GK placement, always-ready Confirm), `CORNER_KICK_TAKER_SELECT` (piece-click selection + disabled/errorText Confirm gate), `CORNER_KICK_REPOSITION` (6-stage alternating window with the exact per-piece pace/round-budget remaining-count spec), `CORNER_KICK_FINAL_SETUP` (1-player-per-team pre-kick window), and the PASS-phase High/Low Pass choice (CORNER-04/05) — all copy taken verbatim from 38-UI-SPEC.md's Copywriting Contract table
- `CornerKickSetupPanel.module.css`: copied from `GoalKickSetupPanel.module.css`'s class set and token usage, Phase 35 conventions (`gap: 4px`, `padding: 4px 8px`, no container border)
- `CornerKickSetupPanel.test.tsx`: 36 tests covering phase gating, every acting/waiting variant, the soft end-turn confirm-dialog threshold, the CTA color-class switch, and humanised `gameError` rendering across all branches
- `GameBoard.tsx`: `PHASE_LABEL` entries for the 5 corner phases; dispatch ternary extended to render `CornerKickSetupPanel` for the 5 corner phases AND for `PASS` once `cornerKickTeam` is set (see Deviations)
- `BallLocationRing.tsx`: `BALL_MARKER_PHASES` extended from 17 to 22 members with the 5 corner phases
- `ActionLog.tsx`: `OUT_OF_BOUNDS`'s `restartLabel` extended to a three-way ternary (`Throw-In`/`Goal Kick`/`Corner Kick`); 5 new case arms (`CORNER_KICK_GK_PLACE`, `CORNER_KICK_TAKER_PLACED`, `CORNER_KICK_STAGE_ADVANCE`, `CORNER_KICK_MOVE`, `CORNER_KICK_ACCURACY`) render readable log lines using the existing `PNamed`/`P` helpers, matching the neighbouring Goal Kick cases' format conventions
- Full client suite: 733/733 tests green (up from 715 pre-plan); `pnpm --filter @counter-attack/client build` and `typecheck` both clean; `git diff docs/HIGHLIGHT-REFERENCE.md packages/client/src/components/HexCell.tsx` is empty (D-09 verified — no new hex tints introduced)

## Task Commits

Each task was committed atomically:

1. **Task 1: CornerKickSetupPanel covering all five corner phases** - `8820784` (feat)
2. **Task 2: Register the corner phases in GameBoard, BallLocationRing and ActionLog (Pitfall 1)** - `fa06a65` (feat)

_Note: no plan-metadata commit is created by a worktree-isolated executor — the orchestrator handles final metadata commits after merge._

## Files Created/Modified

- `packages/client/src/components/CornerKickSetupPanel.tsx` - New component; single panel driving all 5 corner phases + the PASS-phase High/Low choice
- `packages/client/src/components/CornerKickSetupPanel.module.css` - New CSS module, copied from `GoalKickSetupPanel.module.css`'s token usage
- `packages/client/src/components/CornerKickSetupPanel.test.tsx` - New test file, 36 tests
- `packages/client/src/components/GameBoard.tsx` - `PHASE_LABEL` entries + dispatch ternary extended for the 5 corner phases and PASS-with-cornerKickTeam
- `packages/client/src/components/GameBoard.test.tsx` - Added a describe block asserting `CornerKickSetupPanel` renders for each corner phase and the PASS High/Low choice, and that ordinary (non-corner) PASS is unaffected
- `packages/client/src/components/BallLocationRing.tsx` - `BALL_MARKER_PHASES` extended with the 5 corner phases (17 → 22 members)
- `packages/client/src/components/BallLocationRing.test.tsx` - Updated the pinned member-count assertion to 22; added 4 new phase-gate tests
- `packages/client/src/components/ActionLog.tsx` - `restartLabel` 3-way ternary + 5 new `CORNER_KICK_*` case arms
- `packages/client/src/components/ActionLog.test.tsx` - New describe block covering all 5 new event types and the `CORNER_KICK` restart label

## Decisions Made

- GK reposition windows' Confirm button has no minimum-eligibility constraint (always the ready/green state) — verified against `applyCornerKickGkWindowEnd`'s actual server behavior (performs no move validation, unconditionally accepts confirming with zero placements), rather than assuming an "N eligible" pattern like the two budgeted windows.
- `CORNER_KICK_REPOSITION`'s remaining-count computation implements the plan's precise per-piece filter verbatim: an eligible piece counts toward "remaining" if its `cornerKickUsedPace` is below 6 AND either the round isn't yet full (fewer than 2 distinct pieces in `cornerKickStagePlacedIds`) or the piece is already one of the round's touched pieces.
- The PASS-phase waiting message ("Attacking team is choosing a pass type…") and the `CORNER_KICK_TAKER_SELECT` waiting message ("Attacking team is choosing a corner-taker…") use Claude's discretion for exact wording, since 38-UI-SPEC.md's Copywriting Contract table specifies only `"{Team} is choosing a corner-taker…"` generically — resolved to "Attacking team" since corner-taker selection and the pass-type choice are both single-acting-team steps (always the kicking/attacking team), unlike the alternating GK/reposition windows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Extended GameBoard's dispatch ternary to also route `PASS`-with-`cornerKickTeam` to `CornerKickSetupPanel`**

- **Found during:** Task 2 (Register the corner phases in GameBoard, BallLocationRing and ActionLog)
- **Issue:** Task 2's action text literally specifies "a five-way corner check" for the dispatch ternary (the 5 corner-specific `GamePhase` values only), and its acceptance criteria expect exactly the 5-phase pattern. However, Task 1's own `<behavior>` list and this plan's `must_haves.truths` explicitly require "the kicking manager chooses between a High Pass and a Low Pass before the corner is taken" to work in the live UI. `ActionPanel.tsx` — the component that would otherwise render during the ordinary `PASS` phase — is never modified anywhere across all 9 plans of Phase 38 (confirmed via `grep CORNER ActionPanel.tsx` returning zero matches, and cross-checking every plan's `files_modified` list), so without this extension, `CornerKickSetupPanel`'s carefully-built High/Low Pass branch would be permanently unreachable through the real dispatch path — a component built and unit-tested in isolation but dead in the running app, contradicting the plan's own must-have truth.
- **Fix:** Added a 6th disjunct to the dispatch ternary's condition (`phase === 'PASS' && cornerKickTeam != null`), gated on the same `cornerKickTeam` field `CornerKickSetupPanel` itself uses as its persistent corner-context signal. This does not change ActionPanel's behavior for the ordinary (non-corner) `PASS` phase — that path is untouched and still renders `ActionPanel`, satisfying Task 2's "ActionPanel for every non-corner phase, unchanged" for every `PASS` state where `cornerKickTeam` is null.
- **Files modified:** `packages/client/src/components/GameBoard.tsx`, `packages/client/src/components/GameBoard.test.tsx`
- **Verification:** New `GameBoard.test.tsx` tests assert `CornerKickSetupPanel`'s "Corner Kick" heading and the "High Pass"/"Low Pass" buttons render during `PASS` with `cornerKickTeam` set, and that the ordinary `ActionPanel` still renders when `cornerKickTeam` is null. The acceptance criterion's literal grep (`grep -c "CORNER_KICK" GameBoard.tsx` returns at least 10) still passes — the added condition references `cornerKickTeam` (camelCase), not the literal string `CORNER_KICK`, so the count is unaffected (10, exactly the 5+5 the criterion names).
- **Committed in:** `fa06a65` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical functionality)
**Impact on plan:** Necessary for the plan's own must-have truth to actually hold in the running application. No scope creep — the fix stays within `GameBoard.tsx`'s existing dispatch ternary and does not touch `ActionPanel.tsx` or any other file outside this plan's declared scope.

## Issues Encountered

- Fresh worktree checkout had no `node_modules` installed (the same one-time setup cost 38-06 encountered). Ran `pnpm install` at the repo root, then `pnpm --filter @counter-attack/shared build` to produce the `dist/` output the client's vitest config resolves `@counter-attack/shared` against — a one-time setup cost, not a plan deviation.
- Task 1's acceptance criterion `grep -Eo '[0-9]+px' CornerKickSetupPanel.module.css | sort -u yields only values divisible by 4` is not literally satisfiable while copying `GoalKickSetupPanel.module.css` verbatim as instructed — that source file itself contains 11px/1px/2px/13px values (font sizes, border widths, flex-calc offsets) inherited from Phase 35's typography/border conventions, which are separate from the Spacing Scale's gap/padding tokens the criterion is actually about. Verified this is not a regression: `grep -Eo '[0-9]+px' GoalKickSetupPanel.module.css | sort -u` produces the identical value set. Not treated as a deviation to "fix" since doing so would mean diverging from the explicit copy-this-file instruction and from locked Phase 35 typography (11px labels, 12px headings). Documented here rather than silently worked around.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Corner Kick presentation layer is complete and fully registered: every corner phase has a label, a rendered panel, a ball marker, and a readable action-log line, plus the PASS-phase High/Low Pass choice is reachable in the live dispatch tree.
- Plan 38-08 (end-to-end socket-level integration tests) can now exercise the full flow including client-reachable dispatch; this plan's client-side work does not block it (38-08 drives the server/socket layer directly).
- Plan 38-09 (human two-browser verification) should specifically confirm the High/Low Pass choice actually renders after the pre-kick window ends, given the GameBoard dispatch extension documented above as a deviation from the plan's literal 5-phase-only instruction.
- No blockers for downstream plans: all new/modified files are committed, tested, and typecheck-clean within this plan's own scope.

## Known Stubs

None - this plan wires the presentation layer for already-defined `GameState` fields, socket actions, and event types (from 38-01/38-06); no placeholder data or hardcoded empty values were introduced.

## Threat Flags

None - this plan's threat model (T-38-26, T-38-27, T-38-28, T-38-SC) was addressed exactly as scoped: T-38-26 (no hidden information in any corner phase) holds — every field rendered is public game state; T-38-27 (unescaped event content) holds — React escapes all interpolated text, no `dangerouslySetInnerHTML` introduced; T-38-28 (panel buttons shown to the non-acting manager) is closed by every branch's `myTeam !== actingTeam` waiting-panel gate, including the newly-added PASS-phase branch; T-38-SC (package installs) — no new package-manager installs beyond the pre-existing `pnpm install` for worktree setup.

---

## Self-Check: PASSED

- FOUND: packages/client/src/components/CornerKickSetupPanel.tsx
- FOUND: packages/client/src/components/CornerKickSetupPanel.module.css
- FOUND: packages/client/src/components/CornerKickSetupPanel.test.tsx
- FOUND: packages/client/src/components/GameBoard.tsx
- FOUND: packages/client/src/components/GameBoard.test.tsx
- FOUND: packages/client/src/components/BallLocationRing.tsx
- FOUND: packages/client/src/components/BallLocationRing.test.tsx
- FOUND: packages/client/src/components/ActionLog.tsx
- FOUND: packages/client/src/components/ActionLog.test.tsx
- FOUND: .planning/phases/38-corner-kick/38-07-SUMMARY.md
- FOUND commit: 8820784 (Task 1)
- FOUND commit: fa06a65 (Task 2)

_Phase: 38-corner-kick_
_Completed: 2026-08-07_
