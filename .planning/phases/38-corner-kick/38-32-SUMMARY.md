---
phase: 38-corner-kick
plan: 32
subsystem: testing
tags: [react, vitest, testing-library, corner-kick, undo, offside, triage]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 31)
    provides: server-side lastDiceRoll null on entry to CORNER_KICK_REPOSITION/CORNER_KICK_FINAL_SETUP
  - phase: 38-corner-kick (plan 30)
    provides: 38-30-SUMMARY.md bug 1 (offside ring) and bug 2 (Undo regression) reports
provides:
  - 4 regression-sensitive tests pinning the corner Undo affordance and its lastDiceRoll enablement contract
  - Comment-only documentation of the server contract canUndoReposition/canUndoFinalSetup depend on
  - Written, evidence-backed DEFERRED triage verdict for the offside-ring-after-goal defect
  - Tracked pending todo carrying full evidence for the offside-ring defect's follow-up investigation
affects: [phase-38-close, phase-39-planning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Multi-step Undo-stack assertion via cleanup()+re-render idiom within a single test body (mirrors PlayerStatsPanel.test.tsx)'

key-files:
  created:
    - .planning/todos/pending/2026-08-09-bug-offside-ring-after-goal.md
  modified:
    - packages/client/src/components/CornerKickSetupPanel.tsx
    - packages/client/src/components/CornerKickSetupPanel.test.tsx
    - .planning/phases/38-corner-kick/deferred-items.md

key-decisions:
  - "Corner Undo affordance stays bare styles.ctaButton + disabled — no ctaColorClass added — to preserve parity with ActionPanel's Movement Phase Undo (CONTEXT D-09)"
  - 'Offside-ring-after-goal defect (38-30 bug 1) triaged DEFERRED out of Phase 38 — routed to /gsd-debug or Phase 39, not a further Phase 38 gap-closure round'

patterns-established:
  - 'Regression-pinning test for a UX-mirror guard: seed lastDiceRoll non-null alongside an otherwise-undoable event log and assert disabled=true, citing the bug report and the fix plan by number'

requirements-completed: [CORNER-03, CORNER-06]

# Metrics
duration: ~15min (across a session-limit interruption; net active work)
completed: 2026-08-09
---

# Phase 38 Plan 32: Pin Corner Undo Regression Coverage + Triage Offside-Ring Defect Summary

**Four regression-sensitive tests pinning the corner Undo `lastDiceRoll` enablement contract and Movement-Phase-parity styling, plus a written DEFERRED triage verdict (with full evidence chain and a tracked pending todo) for the 38-30 bug 1 offside-ring defect.**

## Performance

- **Duration:** ~15 min net active work (session was interrupted mid-execution by a session-limit boundary and resumed)
- **Started:** 2026-08-09 (Task 1 code/tests)
- **Completed:** 2026-08-09T16:35:20-05:00
- **Tasks:** 2
- **Files modified:** 4 (2 code/test, 1 deferred-items update, 1 new todo)

## Accomplishments

- Added 4 tests to `CornerKickSetupPanel.test.tsx` that pin the `lastDiceRoll`-disabled coupling (in both `CORNER_KICK_REPOSITION` and `CORNER_KICK_FINAL_SETUP`), the multi-step MOVE-stack mirror across re-seeded broadcasts, and the Movement-Phase-parity styling assertion (Undo carries neither `ctaButtonReady` nor `ctaButtonPending`, unlike the sibling Confirm button)
- Verified test (a) genuinely catches the regression: temporarily deleted `if (lastDiceRoll) return false;` from `canUndoReposition`, confirmed the test failed, then restored the guard and confirmed all 51 tests pass again
- Extended the existing "UX mirror only" comments on `canUndoReposition`/`canUndoFinalSetup` (comment-only — confirmed via `git diff`) to name the exact server functions (`applyCornerKickTakerSelect`, `applyCornerKickStageEnd`) that null `lastDiceRoll` as of plan 38-31, and to warn future editors never to drop the guard itself
- Wrote a full evidence-backed DEFERRED triage verdict for the offside-ring-after-goal defect (38-30 bug 1) into `deferred-items.md`, independently re-verifying every cited evidence point against the live codebase (grep/read confirmed all 5 evidence bullets accurate)
- Created `.planning/todos/pending/2026-08-09-bug-offside-ring-after-goal.md` carrying the same evidence, a BUG-23 shared-root-cause hypothesis, and explicit repro-data requirements for the follow-up session

## Task Commits

Each task was committed atomically:

1. **Task 1: Pin the corner Undo affordance and its enablement contract with regression-sensitive tests** - `7c356c0` (test)
2. **Task 2: Record the DEFERRED triage verdict for the offside-ring-after-goal defect (38-30 bug 1)** - `c1d7986` (docs)

_Note: this plan's tasks are `test`/`docs` type — no `feat` behavioural change; the panel's canUndo\* comment extensions are documentation-only, verified via `git diff` showing zero changed executable lines._

## Files Created/Modified

- `packages/client/src/components/CornerKickSetupPanel.tsx` - Comment-only extension on `canUndoReposition`/`canUndoFinalSetup` naming the server-side `lastDiceRoll`-null contract (plan 38-31) and warning against dropping the guard
- `packages/client/src/components/CornerKickSetupPanel.test.tsx` - 4 new tests: lastDiceRoll-disabled coupling ×2 (REPOSITION + FINAL_SETUP), multi-step MOVE-stack mirror, affordance-parity className assertion
- `.planning/phases/38-corner-kick/deferred-items.md` - New "From Plan 38-32" section recording the DEFERRED verdict for 38-30 bug 1 with full evidence
- `.planning/todos/pending/2026-08-09-bug-offside-ring-after-goal.md` - New pending todo tracking the offside-ring defect for a future `/gsd-debug` session or Phase 39

## Decisions Made

- No `ctaColorClass`/`ctaButtonReady`/`ctaButtonPending` added to the Undo button — the verifier's "same as a normal move phase" request means parity with `ActionPanel.tsx`'s bare-styling Undo, not a new visual treatment. Test (d) pins this.
- The offside-ring-after-goal defect is DEFERRED, not fixed in this plan — root-causing requires live two-browser reproduction, which is outside this plan's static-analysis-only scope, and none of Phase 38's requirements (OOB-03, CORNER-01..06) cover the offside/kickoff lifecycle.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<action>` and `<verify>` blocks were followed verbatim; the only environment-level step not explicitly spelled out in the plan was running `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared build` to restore this worktree's absent `node_modules`/`dist` before tests could run — both fall under Rule 3's carve-out (the plan's own threat model, T-38-SC, explicitly permits `pnpm install` "to restore an absent `node_modules`") and neither installed or changed any dependency.

## Issues Encountered

- This worktree had no `node_modules` and `packages/shared` had no `dist/` build output, so `pnpm --filter @counter-attack/client test` initially failed to resolve `@counter-attack/shared`. Resolved by running `pnpm install --frozen-lockfile` (root) and `pnpm --filter @counter-attack/shared build`, per the plan's own threat model exception for restoring an absent `node_modules`. No lockfile or dependency changes resulted.
- Execution was interrupted once by a session-limit boundary between finishing Task 1's code/tests and running the verification suite. Resumed from the exact point recorded by the coordinator; no work was duplicated or lost — `git status`/`git diff` at resume time showed the same uncommitted Task 1 changes described above, matched against the plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 38's Undo-affordance regression (38-30 bug 2) now has both the server-side fix (plan 38-31) and client-side regression coverage (this plan) in place — `pnpm --filter @counter-attack/client test` is green with 776/776 tests passing (4 more than baseline), `pnpm --filter @counter-attack/client typecheck` exits 0.
- The offside-ring-after-goal defect (38-30 bug 1) is no longer an unresolved open question blocking phase close — it has a written, auditable DEFERRED verdict and a tracked todo. Phase 38 close can proceed without it; the follow-up (BUG-23 shared-root-cause hypothesis) is ready to pick up in a future `/gsd-debug` session or Phase 39.
- Remaining phase-38 gap-closure work per `38-PLAN.md`'s 38-31..38-33 sequence: 38-33 (re-verification checkpoint) is the next plan in this round.

## Self-Check: PASSED

- FOUND: packages/client/src/components/CornerKickSetupPanel.tsx (comment-only diff confirmed via `git diff`)
- FOUND: packages/client/src/components/CornerKickSetupPanel.test.tsx (51 tests, 4 new, all passing)
- FOUND: .planning/phases/38-corner-kick/deferred-items.md ("From Plan 38-32" section present)
- FOUND: .planning/todos/pending/2026-08-09-bug-offside-ring-after-goal.md
- FOUND: commit 7c356c0 (`git log --oneline --all | grep 7c356c0`)
- FOUND: commit c1d7986 (`git log --oneline --all | grep c1d7986`)

---

_Phase: 38-corner-kick_
_Completed: 2026-08-09_
