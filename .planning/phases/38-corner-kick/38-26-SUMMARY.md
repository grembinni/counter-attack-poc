---
phase: 38-corner-kick
plan: 26
subsystem: ui
tags: [react, typescript, action-log, exhaustiveness, gap-closure]

# Dependency graph
requires:
  - phase: 38-corner-kick
    provides: 38-24-SUMMARY.md bug 4 — the confirmed root cause (missing formatEvent case for CORNER_KICK_CLEAR_OUT_MOVE) that this plan fixes
provides:
  - 'formatEvent case for CORNER_KICK_CLEAR_OUT_MOVE, closing the ActionLog runtime crash'
  - 'Compiler-verified proof (clean pnpm --filter @counter-attack/client typecheck) that every other ActionEventType member already has a formatEvent case'
  - 'Two regression tests guarding against this crash reoccurring'
affects: [38-corner-kick verification checkpoint (next round), any future ActionEventType addition]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - packages/client/src/components/ActionLog.tsx
    - packages/client/src/components/ActionLog.test.tsx

key-decisions:
  - 'formatEvent case for CORNER_KICK_CLEAR_OUT_MOVE uses the same [CORNER KICK] prefix and PNamed piece label as CORNER_KICK_GK_PLACE/CORNER_KICK_TAKER_PLACED, deriving an Attacking/Defending side label from event.slot the same way CORNER_KICK_GK_PLACE derives one from event.side'
  - 'Deliberately no default arm added to the switch — the absence of a default is what makes the missing-case bug a compile-time TS2366 error rather than a silent runtime undefined; adding a default would re-open this bug class for any future ActionEventType addition'

patterns-established: []

requirements-completed: [CORNER-01, CORNER-03]

# Metrics
duration: ~20min (excluding ~6min unattended pnpm install wait)
completed: 2026-08-09
---

# Phase 38 Plan 26: ActionLog CORNER_KICK_CLEAR_OUT_MOVE Crash Fix Summary

**Added the missing `formatEvent` switch case for `CORNER_KICK_CLEAR_OUT_MOVE`, closing the runtime crash reported in 38-24-SUMMARY.md bug 4, and used the compiler (not a grep) to prove no other `ActionEventType` member is missing a case.**

## Performance

- **Duration:** ~20 min of active work (plus ~6 min unattended `pnpm install` wait for the worktree's missing `node_modules`)
- **Completed:** 2026-08-09
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Fixed the exact crash reported in the live two-browser checkpoint: `TypeError: Cannot destructure property 'prefix' of 'formatEvent(...)' as it is undefined` at `ActionLog.tsx:1070`, caused by `formatEvent`'s switch having no case (and no `default`) for `CORNER_KICK_CLEAR_OUT_MOVE`.
- Proved via the TypeScript compiler — not a manual grep — that this was the _only_ missing case in the entire `ActionEventType` union: `pnpm --filter @counter-attack/client typecheck` went from exactly one `TS2366` error to a clean exit after the fix, and `TS2366` fires once for the whole function regardless of how many members are unhandled, so a clean exit is proof none remain.
- Added two regression tests: one rendering a lone `CORNER_KICK_CLEAR_OUT_MOVE` event, one rendering it in a mixed list alongside a `CORNER_KICK_TAKER_PLACED` event to exercise the `items.map` render loop the same way the original crash occurred.

## Exhaustiveness Audit (Compiler Evidence)

**Pre-edit** (`packages/client/src/components/ActionLog.tsx` at commit `32e4420`, before this plan's change):

```
> @counter-attack/client@0.0.1 typecheck
> tsc --noEmit

src/components/ActionLog.tsx(329,74): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
 ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  @counter-attack/client@0.0.1 typecheck: `tsc --noEmit`
Exit status 2
```

Exactly one error, on exactly the line the plan predicted — confirming the root cause from 38-24-SUMMARY.md bug 4 without re-diagnosing it.

**Post-edit** (after adding the `CORNER_KICK_CLEAR_OUT_MOVE` case, no `default` arm added):

```
> @counter-attack/client@0.0.1 typecheck
> tsc --noEmit
```

Clean exit 0. No other `ActionEventType` member is missing a `formatEvent` case.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the CORNER_KICK_CLEAR_OUT_MOVE formatEvent case and prove the switch is exhaustive** - `352634e` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified

- `packages/client/src/components/ActionLog.tsx` - Added `case 'CORNER_KICK_CLEAR_OUT_MOVE'` to `formatEvent`'s switch (placed immediately after `CORNER_KICK_ACCURACY`, keeping the corner-kick family contiguous). Returns `[CORNER KICK]` prefix, `PNamed`-labeled piece, an Attacking/Defending side label derived from `event.slot`, "cleared the corner", and the `from`→`to` coordinates.
- `packages/client/src/components/ActionLog.test.tsx` - Added two tests to the existing `describe('ActionLog — Phase 38 (38-07): Corner Kick event rendering')` block: a single-event render assertion and a mixed-list render assertion (alongside a `CORNER_KICK_TAKER_PLACED` event).

## Decisions Made

- Matched the `CORNER_KICK_GK_PLACE`/`CORNER_KICK_TAKER_PLACED` content shape (using `PNamed`, not the role-prefixed `P` component `CORNER_KICK_MOVE` uses) per the plan's explicit instruction, since `CORNER_KICK_CLEAR_OUT_MOVE` is emitted automatically (not from an interactive phase) and reads more naturally with a full player name.
- No `default:` arm was added to the switch, preserving compiler-enforced exhaustiveness against the `ActionEvent` union going forward (mitigates T-38-88/T-38-89 from the plan's threat register).

## Deviations from Plan

None — plan executed exactly as written. One environment prerequisite was required and handled per Rule 3 (blocking issue, not a deviation from the plan's intent): this worktree had no `node_modules` (fresh worktree checkout) and `packages/shared/dist` had never been built, so `pnpm --filter @counter-attack/client typecheck` failed for reasons unrelated to this plan's code (`Cannot find module '@counter-attack/shared'`). Ran `pnpm install --offline` (fully resolved from the existing local pnpm store — 0 packages downloaded, 543 reused, no modification to the main repo's `node_modules`) and `pnpm --filter @counter-attack/shared build` to produce `dist/`. This is standard worktree setup, not a code change, and is not tracked as a plan deviation.

## Issues Encountered

None beyond the environment-setup step described above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CORNER_KICK_CLEAR_OUT_MOVE no longer crashes ActionLog; the automatic clear-out mechanic (once implemented per the other gap-closure items in this round) can safely emit this event type.
- The compiler-exhaustiveness gate is now in place and will fail the build (not the runtime) if any future `ActionEventType` addition is missed — directly addresses the STATE.md pitfall "every new ActionEventType needs per-event checklist treatment."
- This plan does not touch the other three items from 38-24-SUMMARY.md's third-round gap-closure list (automatic straight-line clear-out movement, single-hex-per-step reposition UX, removing activation-marking from the pre-kick move) — those are separate plans in this same wave/round per the phase's gap-closure source audit.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-09_

## Self-Check: PASSED

- FOUND: packages/client/src/components/ActionLog.tsx
- FOUND: .planning/phases/38-corner-kick/38-26-SUMMARY.md
- FOUND: 352634e (Task 1 commit)
- FOUND: 1974aca (plan metadata commit)
