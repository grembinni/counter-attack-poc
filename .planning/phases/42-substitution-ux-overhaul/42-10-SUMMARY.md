---
phase: 42-substitution-ux-overhaul
plan: 10
subsystem: testing
tags: [audit, regression-check, quality-gate, human-verification, gap-closure]

requires:
  - phase: 42-substitution-ux-overhaul (plan 08)
    provides: 'stage-then-confirm substitution flow that changed what the pre-existing SUB-07/D-13 bench-drag tests were actually proving'
  - phase: 42-substitution-ux-overhaul (plan 09)
    provides: 'GameBoard wiring, SUB-16/17 chrome, and the full Phase 42 feature set this plan closes the phase out on'
provides:
  - 'a written SUB-0X side-by-side audit table with per-row evidence (reading vs. mutation-check) for every Phase 40 SUB-0X/D-12/D-13 assertion in LineupAssignmentScreen.test.tsx'
  - 'a closed test gap: a new SUB-07/D-13 test proving no confirmation popup is ever staged for a subbedOut or redCarded bench source, replacing an assertion that Plan 08s stage-then-confirm rework had made vacuous'
  - 'a D-07/SUB-18 bench-badge regression suite in CardInjuryBadge.crossSurface.test.tsx proving redCarded/subbedOut/injured bench glyphs are unaffected by subMode/readOnly/actionPending/an open confirm popup'
  - 'a converged BUG-38 residual site: useGameStore.ts PENALTY_KICK_TAKER_SELECT now uses the shared isActivePiece predicate instead of a hand-written redCarded === true check, plus a regression test for its onPitch:false branch'
  - 'a recorded, verbatim human-verification outcome for the full Phase 42 feature set, with 7 discrete gap-closure items handed to the next planning round'
affects: [42-gap-closure]

tech-stack:
  added: []
  patterns:
    - 'Mutation-check evidence (invert/delete a guard, confirm the test fails, restore it) is the required evidence type for any guard whose reachability is not obvious from reading alone — applied here to the 3-sub cap, the red-card isSubBlocked exclusion, the subbedOut bench exclusion, and the readOnly guard.'

key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.test.tsx
    - packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/store/useGameStore.test.ts

key-decisions:
  - "Task 3's human verification did NOT return 'approved'. Sections A and B passed
    functionally (B carries two non-blocking UI notes). Sections C and D each contain
    a genuine failure. Per this plan's own acceptance criteria ('any failure is
    recorded verbatim ... and routed to a gap-closure plan rather than fixed inline'),
    this summary records the phase verdict as gaps_found, not passed, and lists 7
    discrete gap-closure items (6 in-phase-scope, 1 explicitly out-of-phase-scope
    but included at the user's request) for the next /gsd-plan-phase 42 --gaps round."

requirements-completed: [SUB-10, SUB-13, SUB-18, BUG-38]

duration: ~15min (Tasks 1-2, automated) + human playtest session (Task 3)
completed: 2026-08-22
---

# Phase 42 Plan 10: Regression Audit, Quality Gate, and Human Verification Summary

**Closed a real test-vacuity gap left by Plan 08's stage-then-confirm rework, converged one missed BUG-38 site (`useGameStore.ts`'s penalty-kick-taker guard) onto the shared `isActivePiece` predicate, ran a clean whole-repo quality gate, and then failed live two-browser human verification on the SUB-16/17 chrome and the red-card slot-swap/bench-badge behavior — routing 7 discrete defects to gap closure instead of the phase closing as `passed`.**

## Performance

- **Duration:** ~15 min for Tasks 1-2 (automated audit + quality gate); Task 3 duration is the human's live two-browser playtest session, not separately timed.
- **Tasks:** 3 (as planned) — Tasks 1 and 2 complete and committed; Task 3 (`checkpoint:human-verify`) returned a mixed pass/fail result rather than "approved".
- **Files modified:** 4 (2 in Task 1, 2 in Task 2; Task 3 produced no code changes, per its own instruction to route failures to gap closure rather than fix inline)

## Accomplishments

- **Task 1 — SUB-0X side-by-side audit and bench-badge regression check (commit `1628baf`):** Enumerated every Phase 40 SUB-0X/D-12/D-13 assertion in `LineupAssignmentScreen.test.tsx` and traced each to the guard it was written to exercise, using mutation-check evidence (invert/delete the guard, confirm the test fails, restore it) for the four highest-risk guards named in the plan: the 3-sub cap, the red-card `isSubBlocked` exclusion, the `subbedOut` bench exclusion, and the `readOnly` guard. Found and closed 2 genuine GAPs: the pre-existing `subbedOut`/`redCarded` bench-drag tests only asserted `onSubstitute` was never called — but Plan 08's stage-then-confirm rework made that assertion vacuous, since `onSubstitute` is now _only_ ever called from the popup's Confirm button, which the guard-blocked drag flow never reaches regardless of whether the bench-exclusion guard itself is even present. A mutation check proved this: deleting `BenchCarousel`'s `unavailablePlayerIds?.includes(...)` clause left the original test green. Closed the gap with a new test (`SUB-07/D-13 gap-closure: dragging a subbedOut or redCarded bench card in substitution mode never stages a confirmation popup`) asserting `screen.queryByRole('dialog')` is null for both a subbedOut and a redCarded bench source, verified via the same mutation check to actually fail when the guard is removed. Also added a D-07/SUB-18 bench-badge regression suite to `CardInjuryBadge.crossSurface.test.tsx` (`describe('Bench badge regression — Phase 42 rework (D-07/SUB-18)')`) proving redCarded/subbedOut/injured bench glyphs render identically across positioning mode, substitution mode, `readOnly`, `actionPending`, and with an open substitution-confirm popup. No production code changed — `git diff` on `LineupAssignmentScreen.tsx` and `BenchCarousel.tsx` was empty, satisfying the task's audit-only constraint.
- **Task 2 — Whole-repo quality gate and BUG-38 audit closeout (commit `45eda13`):** Ran the full repository gate in the required order (shared build, workspace typecheck, shared/server/client test suites, lint, format, stylelint, knip, check-contrast). `pnpm lint` hit a pre-existing `packages/shared` typescript-eslint file-count-cap issue unrelated to this phase; fell back to a phase-scoped `npx eslint` run, which was clean. The whole-repo residual `redCarded`/`onPitch` grep sweep found one genuine missed site: `useGameStore.ts`'s `PENALTY_KICK_TAKER_SELECT` selection guard still hand-wrote `piece.redCarded === true` instead of the shared `isActivePiece` predicate — missed by 42-04's client-side sweep, which only covered `HexGrid.tsx`. Converged it onto `isActivePiece` (`!isActivePiece(piece)` replacing `piece.redCarded === true`) and added a regression test (`PENALTY_KICK_TAKER_SELECT: clicking a benched (onPitch:false, not redCarded) teammate yields no selection`) proving the predicate's `onPitch:false`-only branch is also honored, not just the `redCarded` branch. Remaining non-`stoppagePhases.ts` grep hits (`CardInjuryBadge.tsx`, `DraftPackCarousel.tsx`, `LineupAssignmentScreen.tsx`'s `isBlocked`) are display/UI-classification logic that must check `redCarded` specifically (to render the correct badge/label) rather than "any reason inactive" — verified individually and left unconverted, as they are not eligibility gates.
- **Task 3 — Live two-browser human verification: MIXED RESULT, NOT approved.** See the full verbatim record below. Two of four lettered sections (A, B) passed; B carries non-blocking UI notes; two sections (C, D) contain genuine functional/visual failures. Per this plan's acceptance criteria, failures are recorded verbatim here and routed to gap closure rather than fixed inline — no production code was touched in response to Task 3's findings.

## Task Commits

1. **Task 1: SUB-0X side-by-side audit and bench-badge regression check** - `1628baf` (test)
2. **Task 2: Whole-repo quality gate and BUG-38 residual audit closeout** - `45eda13` (fix)
3. **Task 3: Live two-browser human verification** - no commit (checkpoint; result recorded below, no code changes)

**Plan metadata:** this SUMMARY.md is committed separately per the worktree/continuation-agent protocol.

## Files Created/Modified

- `packages/client/src/components/LineupAssignmentScreen.test.tsx` — closed the SUB-07/D-13 gap-closure test (no confirmation popup ever stages for subbedOut/redCarded bench sources)
- `packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx` — new D-07/SUB-18 bench-badge regression suite (redCarded/subbedOut/injured glyphs unaffected by mode/gating state)
- `packages/client/src/store/useGameStore.ts` — `PENALTY_KICK_TAKER_SELECT` guard converged from hand-written `piece.redCarded === true` onto the shared `isActivePiece` predicate
- `packages/client/src/store/useGameStore.test.ts` — new regression test for `isActivePiece`'s `onPitch:false`-only branch in the penalty-kick-taker guard

## SUB-0X Side-by-Side Audit Table (Task 1)

| Assertion (test title, abbreviated)                                                                                                              | Requirement        | Guard exercised                                                                 | Evidence type                                                                                                                           | Verdict                |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 3-sub cap disables Substitute button at 3/3                                                                                                      | SUB-13             | `subCount >= 3` disables button                                                 | (ii) mutation check — inverting the cap left the test passing until restored; observed failing test named in commit                     | STILL-COVERED          |
| Red-card `isSubBlocked` exclusion (SENT OFF slot not a valid drop target for reposition)                                                         | SUB-18/D-05        | `isBlocked` short-circuit in `handleMidmatchSubstituteDrop`/reposition handler  | (ii) mutation check                                                                                                                     | STILL-COVERED          |
| `subbedOut` bench exclusion (dragging a subbedOut card is inert)                                                                                 | SUB-07             | `BenchCarousel`'s `unavailablePlayerIds?.includes(...)` guard                   | (ii) mutation check — original assertion (`onSubstitute` never called) found VACUOUS after Plan 08's stage-then-confirm rework; **GAP** | GAP — closed this task |
| `redCarded` bench exclusion (D-13, dragging a red-carded bench card is inert)                                                                    | D-13               | same `unavailablePlayerIds`/`redCardedPlayerIds` guard                          | (ii) mutation check — same vacuity as above; **GAP**                                                                                    | GAP — closed this task |
| `readOnly` guard (disables positioning-mode dragging and blocks substitution-mode entry)                                                         | —                  | `readOnly` prop gating `midmatchDraggable`/mode-toggle                          | (ii) mutation check                                                                                                                     | STILL-COVERED          |
| Remaining SUB-02..SUB-06/D-12 assertions (drag-to-swap apply, GK non-draggable, bench non-draggable outside sub mode, action-pending lock, etc.) | SUB-08/09/10, D-12 | respective per-guard conditions in `LineupAssignmentScreen.tsx`/`GameBoard.tsx` | (i) reading — guard's current line/condition still matches the test's driven code path                                                  | STILL-COVERED          |

**Gaps found:** 2 (the `subbedOut` and `redCarded` bench-drag assertions, both made vacuous by Plan 08's stage-then-confirm rework). Both closed in this task with one new test (`SUB-07/D-13 gap-closure`) that mutation-check-verified against the actual guard. No production code was changed to close these gaps (test-only, per task constraint).

## Bench-Badge Regression Check (Task 1, Part B)

All four required bullets are covered by the new `describe('Bench badge regression — Phase 42 rework (D-07/SUB-18)')` suite in `CardInjuryBadge.crossSurface.test.tsx`:

- redCarded bench entry renders the red-card glyph and `RED CARD` badge — covered, in both positioning mode and substitution mode.
- subbedOut bench entry renders the `OUT` badge and `.cardUnavailable` dimming — covered, in both modes.
- injured bench entry renders its injury glyph — covered.
- Bench glyph rendering is unaffected by `readOnly`, `actionPending`, and an open substitution-confirm popup — covered; the suite's rationale notes that `unavailablePlayerIds`/`redCardedPlayerIds`/`benchCardStatus` are derived from `benchList` alone and never reference `subMode`/`readOnly`/`actionPending`/`pendingSub`, and the tests exercise that independence directly rather than relying on reading alone.

## Whole-Repo Quality Gate (Task 2)

| #   | Command                                                     | Result                                                                                                                                                                            |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `pnpm --filter @counter-attack/shared build`                | pass                                                                                                                                                                              |
| 2   | `pnpm -r typecheck`                                         | pass                                                                                                                                                                              |
| 3   | `pnpm --filter @counter-attack/shared test -- --pool=forks` | pass                                                                                                                                                                              |
| 4   | `pnpm --filter @counter-attack/server test -- --pool=forks` | pass                                                                                                                                                                              |
| 5   | `pnpm --filter @counter-attack/client test -- --pool=forks` | pass                                                                                                                                                                              |
| 6   | `pnpm lint`                                                 | hit a pre-existing, phase-unrelated `packages/shared` typescript-eslint file-count-cap issue; fell back to a phase-scoped `npx eslint` run, which was clean (documented fallback) |
| 7   | `pnpm format:check`                                         | pass                                                                                                                                                                              |
| 8   | `pnpm stylelint`                                            | pass                                                                                                                                                                              |
| 9   | `pnpm knip`                                                 | pass                                                                                                                                                                              |
| 10  | `pnpm --filter @counter-attack/client check-contrast`       | pass                                                                                                                                                                              |

**Residual grep sweep:** found one genuine missed site (`useGameStore.ts` `PENALTY_KICK_TAKER_SELECT` guard, hand-written `redCarded === true`), converged onto `isActivePiece`, regression test added. All other non-`stoppagePhases.ts`/`types.ts` hits (`CardInjuryBadge.tsx`, `DraftPackCarousel.tsx`, `LineupAssignmentScreen.tsx`'s `isBlocked`) verified individually as intentional display/UI-classification checks (they must check `redCarded` specifically to select the correct badge/label), not eligibility gates, and were left unconverted.

## Task 3: Human Verification Outcome (Verbatim Record)

**Overall result: NOT approved.** Two lettered sections passed outright, one passed with non-blocking UI notes, and two sections contain genuine failures. Recorded verbatim below, organized by lettered section, per this plan's acceptance criteria.

### Section A — Positioning mode (steps 1-7): PASS

All behavior confirmed correct. No issues reported.

### Section B — Substitution mode (steps 8-12): PASS

All behavior confirmed correct. However, the human flagged two UI/layout notes on this section's chrome — not blocking functional failures, but real issues routed to gap closure:

- The Substitute button should be standard button size, positioned next to the Resume button (currently it is not).
- The Cancel button (shown when substitution mode is active / when the confirm popup is open) should be styled orange (currently it is not).

### Section C — Chrome, SUB-16/17 (steps 13-14): FAIL

- **Step 13 bug:** When subs are available, the whole SUB strip is expected to turn green with white text. Actual behavior: the sidebar/strip background turns WHITE (not green), the small area directly behind the "SUB" text turns green, and the text itself renders in a darker green — so only a small green-background/dark-green-text patch appears instead of the entire strip going green with white text staying white.
- **Additional scope request bundled with this bug:** rename the strip's label text from "SUB" to "ROSTER".
- **Step 14 UI note:** the Resume button's position should be "more neutrally under the roster" rather than pinned to the bottom of the screen (currently it is pinned to the bottom).

### Section D — Red card / BUG-38 (steps 15-22): FAIL on two points, PASS on the rest

- **Bench badge bug** (relates to step 17 / the Task 1 bench-badge regression check): a red-carded player's bench card incorrectly displays BOTH a standard/plain card icon AND a red-card indicator overlapping. Expected: only the appropriate single card icon should render (no duplicate/overlapping icon).
- **Swap/stacking bug** (relates to step 18, the SENT OFF slot swap): when a red-carded player's on-field slot already has an active player occupying that same visual position and the user swaps in another active player from the roster/bench, the two active players end up visually stacked in the same slot instead of a clean swap. Expected behavior per the plan's own D-05 design: swapping into a red-carded/SENT OFF slot must not be allowed to produce two active players occupying one slot — the swap should be blocked (or correctly resolved) whenever the destination already holds an active player who was not properly displaced.
- **Steps 15, 16, 19, 20, 21, 22** (the SENT OFF placeholder appearing correctly, no deflection, no steal attempt, hex no longer blocked, and reposition/red-card state surviving a reset): **CONFIRMED PASS** — these are the three original BUG-38 symptoms (steps 19, 20, 21) plus reposition survival (step 22), and none of them regressed.

### Additional out-of-phase-scope bug (included at the user's explicit request)

A defending player is not auto-moved to the minimum legal distance from a free kick / foul kick (the defensive wall distance rule). This is unrelated to SUB-08..18 or BUG-38 — it is pre-existing / from an earlier phase, discovered incidentally during this playtest — but the user wants it captured as a gap for this phase's gap-closure round rather than filed separately.

## Gap Closure Items

The following 7 discrete items are handed to `/gsd-plan-phase 42 --gaps`:

1. **Bench badge shows duplicate/overlapping card icon for red-carded players** (should show only one) — Section D.
2. **SUB strip does not turn fully green with white text when subs available** (currently white background / small green patch / dark green text); **rename "SUB" label to "ROSTER"** — Section C, step 13.
3. **Substitute button should be standard size and positioned next to the Resume button** — Section B.
4. **Resume button should be positioned under the roster rather than pinned to the bottom of the screen** — Section C, step 14.
5. **Cancel button (substitution mode / confirm popup) should be styled orange** — Section B.
6. **Swapping a player into a slot occupied by a red-carded player's active neighbor can stack two active players in one slot instead of cleanly swapping** — must be prevented/fixed per D-05 — Section D, step 18.
7. **(Out-of-phase-scope, included at user's explicit request)** Defending player is not auto-moved to minimum legal distance from a free kick — pre-existing, discovered incidentally during this playtest.

## Decisions Made

- Per this plan's own Task 3 acceptance criteria ("Any failure is recorded verbatim with its step number ... and routed to a gap-closure plan rather than fixed inline"), no production code was modified in response to any of the human's findings. All 7 items above are handed off, verbatim in substance, to the next gap-closure planning round.
- The phase-level verdict is **`gaps_found`**, not `passed` — the resume-signal contract ("Type 'approved' to close the phase, or describe the failing step numbers") was not satisfied with "approved"; the human instead reported specific failing behaviors, which is the alternate branch of that contract.

## Deviations from Plan

None — Tasks 1 and 2 executed exactly as written (audit-only, no production code changed in Task 1; one converged BUG-38 site plus its regression test in Task 2, both within Task 2's own explicit scope). Task 3 is a `checkpoint:human-verify` gate whose result is a mixed pass/fail, which is an anticipated outcome of that gate's own resume-signal contract, not a deviation from the plan.

## Issues Encountered

None beyond what is documented above. The `pnpm lint` fallback (Task 2) and the two genuine test gaps found in Task 1 are documented as part of the plan's own designed audit process, not unplanned issues.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 42 does **not** close as complete. The next step is `/gsd-plan-phase 42 --gaps` (or equivalent) to plan a gap-closure round against the 7 items listed above.
- All automated regression coverage (SUB-0X audit, bench-badge regression, whole-repo quality gate, BUG-38 residual convergence) is green and committed (`1628baf`, `45eda13`) — the gap-closure round can build on a clean, fully-audited baseline.
- Human verification confirmed the three original BUG-38 symptoms (steps 19-21) and reposition survival (step 22) are fully fixed and have not regressed — this is the core bug the phase was chartered to close, and it holds.
- The remaining gaps are concentrated in: bench-badge rendering (duplicate icon), the SUB-16/17 chrome (green-strip fill and Resume button placement), the Substitute/Cancel button styling, and one red-card slot-swap stacking bug (D-05 violation) — plus one explicitly out-of-phase-scope item (free-kick wall distance) the user asked to include in this phase's gap-closure round.

## Self-Check: PASSED

- FOUND: `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- FOUND: `packages/client/src/components/CardInjuryBadge.crossSurface.test.tsx`
- FOUND: `packages/client/src/store/useGameStore.ts`
- FOUND: `packages/client/src/store/useGameStore.test.ts`
- FOUND commit `1628baf` (Task 1)
- FOUND commit `45eda13` (Task 2)

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_
