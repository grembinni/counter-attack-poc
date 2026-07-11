---
phase: 25-bug-uat-closure
plan: '03'
subsystem: ui
tags: [react, typescript, zustand, event-banner, action-panel, ux]

# Dependency graph
requires:
  - phase: 11-header-accuracy
    provides: headerAccuracyRollPending gate and emitHeaderAccuracyAck emit — the ack this plan auto-fires
  - phase: 24-auto-assignment-lineup
    provides: EventBanner component (UX-14) that this plan extends with HP_ACCURACY case
provides:
  - HP_ACCURACY banner case in EventBanner.tsx ('Accurate Pass!' / 'Loose Ball!') with 1500ms duration
  - Auto-advance useEffect replacing the HEADER Continue button in ActionPanel.tsx
  - selectedIsMoving derived flag decrementing the eligible-player counter on piece selection in MOVE phase
affects: [25-04, 25-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Variant-aware auto-dismiss: getBannerMessage returns duration field; useEffect uses active.duration; animationDuration inline style couples CSS to JS timer'
    - 'Auto-fire useEffect pattern: setTimeout inside useEffect with clearTimeout cleanup, gated by multi-condition guard to ensure single emitter (Pitfall 6)'
    - 'Derived display flag: selectedIsMoving computed from store state with Pitfall-7 double-count guard'

key-files:
  created: []
  modified:
    - packages/client/src/components/EventBanner.tsx
    - packages/client/src/components/ActionPanel.tsx

key-decisions:
  - 'D-20: auto-dismiss duration is variant-aware (HP_ACCURACY=1500ms, others=1000ms) via duration field on getBannerMessage return type — no global change'
  - 'D-20: emitHeaderAccuracyAck guard preserved in useEffect (isActivePlayer && myTeam === attackingTeam) so only the attacking client emits — T-25-04 satisfied'
  - "D-19: selectedIsMoving uses phase === 'MOVE' (correct enum value) not 'MOVEMENT' as written in PATTERNS.md — deviation documented"
  - 'D-19: Pitfall 7 guard: selectedIsMoving requires piece not in movedPieceIds AND paceUsed===0 to prevent double-counting'

patterns-established:
  - 'Duration-aware EventBanner: pass duration in getBannerMessage return and thread to animationDuration inline style for coupled CSS/JS timing'

requirements-completed: [UX-15]

# Metrics
duration: 14min
completed: 2026-07-11
---

# Phase 25 Plan 03: UX-15 EventBanner + ActionPanel UX Streamlining Summary

**HP_ACCURACY auto-dismissing popup with 1500ms duration and HEADER Continue button replaced by auto-advance useEffect; eligible counter decrements on piece selection in MOVE phase**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-11T12:01:00Z
- **Completed:** 2026-07-11T12:15:28Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- EventBanner.tsx now fires 'Accurate Pass!' or 'Loose Ball!' (amber notable variant) when HP_ACCURACY lands in the event log, with a 1500ms auto-dismiss tied to both the JS timer and CSS animation duration via inline style
- ActionPanel.tsx auto-fires `emitHeaderAccuracyAck()` after 1500ms on the attacking client only, removing the manual Continue button entirely; non-active player still sees `waitingPanel`
- ActionPanel.tsx decrements the "left to move" counter the moment an unmoved piece is selected in MOVE phase (not when the destination hex is committed), restoring automatically on undo/deselect

## Task Commits

Each task was committed atomically:

1. **Task 1: EventBanner — HP_ACCURACY case + 1500ms duration** - `9113135` (feat)
2. **Task 2: ActionPanel — HEADER Continue button -> auto-advance useEffect** - `9d8d015` (feat)
3. **Task 3: ActionPanel — eligible counter decrement on piece selection** - `46601f2` (feat)

## Files Created/Modified

- `packages/client/src/components/EventBanner.tsx` — Added HP_ACCURACY branch in getBannerMessage; added `duration` field to return type and active state; updated auto-dismiss useEffect to use `active.duration`; added `animationDuration` inline style to banner div
- `packages/client/src/components/ActionPanel.tsx` — Added `selectedPieceId` Zustand selector; added D-20 auto-advance useEffect (1500ms timer -> emitHeaderAccuracyAck, gated on attacking client only); removed Continue button render; added `selectedIsMoving` flag and subtracted it from `remaining` counter

## Decisions Made

- **Duration field on getBannerMessage return:** Instead of branching the setTimeout hardcode, the duration is returned alongside message and variant — keeps the logic in one place and makes future per-event timing changes trivial.
- **animationDuration inline style:** The CSS `bannerFade` keyframe uses percentage-based stops (10%/90%), so it adapts correctly to any total duration. Setting `animationDuration` inline overrides only the duration part of the `animation` shorthand from the CSS class — no new CSS class needed.
- **Both players see waitingPanel during headerAccuracyRollPending:** The EventBanner popup (HP_ACCURACY) provides the visual feedback for the attacking player; showing "Opponent's Turn" briefly is acceptable and avoids re-introducing any button render.
- **phase === 'MOVE' used in selectedIsMoving:** PATTERNS.md incorrectly wrote `phase === 'MOVEMENT'`; the actual type enum value is `'MOVE'` (types.ts line 59). Used correct value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected phase name in selectedIsMoving derivation**

- **Found during:** Task 3 (eligible counter)
- **Issue:** PATTERNS.md and PLAN.md both specify `phase === 'MOVEMENT'` for the selectedIsMoving guard, but the shared types enum uses `'MOVE'` (types.ts line 59). Using 'MOVEMENT' would make selectedIsMoving permanently false, breaking the counter decrement entirely.
- **Fix:** Used `phase === 'MOVE'` (the correct enum value) in the selectedIsMoving condition. Since the code is inside the `if (phase === 'MOVE')` block, this is always true when evaluated — which is the intended behavior.
- **Files modified:** packages/client/src/components/ActionPanel.tsx
- **Verification:** TypeScript check passes; grep confirms `selectedIsMoving` and `s.selectedPieceId` present
- **Committed in:** 46601f2 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 - bug in plan/patterns documentation)
**Impact on plan:** Essential correctness fix — wrong phase name would silently disable the counter decrement feature. No scope creep.

## Issues Encountered

- Worktree had no node_modules on first run. Ran `pnpm install --frozen-lockfile` and `pnpm --filter @counter-attack/shared build` to set up the TypeScript check environment. No new packages were added — only restoring the existing lockfile state.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EventBanner HP_ACCURACY case is live and ready to be triggered by the existing server-emitted HP_ACCURACY events
- ActionPanel auto-advance is active for the HEADER accuracy step; no server changes needed
- Counter decrement on piece selection is live; behavior visible in MOVE phase with any unmoved piece
- Live behavior confirmation (popup appears, auto-advances, counter decrements/restores) deferred to Plan 05 UAT checkpoint as specified in the plan

## Self-Check: PASSED

- SUMMARY.md created at `.planning/phases/25-bug-uat-closure/25-03-SUMMARY.md`
- `packages/client/src/components/EventBanner.tsx` — confirmed exists
- `packages/client/src/components/ActionPanel.tsx` — confirmed exists
- Commit `9113135` (Task 1) — confirmed in log
- Commit `9d8d015` (Task 2) — confirmed in log
- Commit `46601f2` (Task 3) — confirmed in log

---

_Phase: 25-bug-uat-closure_
_Completed: 2026-07-11_
