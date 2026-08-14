---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 04
subsystem: ui
tags: [react, zustand, event-banner, css-modules, tdd]

# Dependency graph
requires:
  - phase: 39-01
    provides: FOUL_CALLED/INJURY_CHECK/BOOKING_CHECK ActionEvent shapes, PENALTY_KICK_SETUP_ATTACKING GamePhase member
provides:
  - Queue-based EventBanner processing that displays every newly-appended eventLog event (not just the tail)
  - Foul/injury/booking banner variants (D-02) with card-colour badge and DOGSO label (D-03)
  - Penalty Kick restart banner row in RESTART_BANNERS
  - --color-card-yellow/--color-card-red semantic tokens
affects: [39-corner-kick-eventbanner-consumers, foul-choice-panel-plans, penalty-kick-plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Ref-backed banner queue (queueRef, not state) drains via the existing auto-dismiss setTimeout — avoids extra renders on enqueue'
    - 'Module-scope pure functions that need id->name resolution take the resolver as a parameter (pieceName built via useCallback in the component) rather than calling the store directly, preserving Rules of Hooks'

key-files:
  created: []
  modified:
    - packages/client/src/components/EventBanner.tsx
    - packages/client/src/components/EventBanner.test.tsx
    - packages/client/src/components/EventBanner.module.css
    - packages/client/src/styles/tokens.css

key-decisions:
  - 'EventBanner eventLog effect now processes eventLog.slice(lastProcessedLengthRef.current) instead of only the tail event — closes the Pitfall 1 defect (STATE.md v1.6 pitfall, live since Phase 37/38.19)'
  - 'Banner queue lives in a ref (queueRef), not state, so enqueueing never triggers an extra render; only setActive (draining the head) triggers a render'
  - 'Restart-phase banners enqueue through the SAME queue as event-derived banners (not a separate overwrite path) so a mid-sequence foul banner is never clobbered by a restart entry'
  - "Added --color-card-badge-border (rgba(0,0,0,0.5)) as an unplanned third token — stylelint's declaration-strict-value rule forbids a raw rgba() literal in border-color/border shorthand inside .module.css files, so the card badge's outline needed its own var() token following the file's existing --color-overlay-backdrop/--color-banner-backdrop precedent"
  - "Added a queue-cap regression test (T-39-04-02) beyond the plan's Task 1 test list, closing the threat register's 'assert in tests' requirement for the 5-entry DoS mitigation"

requirements-completed: [FOUL-02, CARD-01, CARD-02, CARD-03, INJURY-01]

# Metrics
duration: ~20min
completed: 2026-08-14
---

# Phase 39 Plan 04: EventBanner Multi-Event Queue + Foul/Injury/Booking Banners Summary

**Fixed the confirmed live EventBanner tail-only diffing defect with a ref-backed ordered banner queue, and added the foul/injury/booking banner variants with card-colour badge, DOGSO label, and Penalty Kick restart banner.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 3 (plus 1 unplanned test-only addition, see Deviations)
- **Files modified:** 4

## Accomplishments

- `EventBanner.tsx`'s eventLog effect now processes every newly-appended event (`eventLog.slice(lastProcessedLengthRef.current)`) instead of only inspecting the tail — a single foul-chain broadcast (`FOUL_CALLED` + `INJURY_CHECK` + `BOOKING_CHECK`) now displays all three banners in sequence instead of silently dropping the first two.
- Added `FOUL_CALLED` (always fires), `INJURY_CHECK` (fires only when `injured: true`), and `BOOKING_CHECK` (fires only when `card !== 'none'`, carries card colour + DOGSO flag) cases to `getBannerMessage`.
- Added a card-colour badge (`data-testid="card-badge"`, `data-card="yellow"|"red"`) and a DOGSO label rendered inline in the booking banner.
- Added `PENALTY_KICK_SETUP_ATTACKING: 'Penalty Kick!'` to `RESTART_BANNERS`, replacing the stale "Phase 39 scope" comment — the fifth restart named by 38-15 defect 4 is now covered.
- Added `--color-card-yellow`/`--color-card-red` semantic tokens (reusing existing swatches) and `.cardBadge`/`.dogsoLabel` CSS classes.
- Added a queue-cap regression test confirming T-39-04-02's 5-entry DoS mitigation actually drops overflow.

## Task Commits

Each task was committed atomically (TDD RED → GREEN sequence for Tasks 1-2):

1. **Task 1: Add the failing multi-event and banner-variant tests to EventBanner.test.tsx** - `eb0a4fe` (test) — RED state confirmed: 7 new tests failed against the tail-only implementation; 21 pre-existing tests untouched and passing.
2. **Task 2: Replace tail-only diffing with an ordered banner queue and add the new variants** - `b4a04f6` (feat) — GREEN: all 29 tests pass; `typecheck` and `eslint` clean.
3. **Task 3: Card colour tokens and the badge / DOGSO styling** - `5bb191c` (feat) — `stylelint` clean, full client suite green (805 tests).
4. _(unplanned, Rule 2 deviation)_ **Queue-cap regression test (T-39-04-02)** - `093956d` (test) — 30 tests pass.

_No separate plan-metadata commit — orchestrator owns STATE.md/ROADMAP.md updates for this worktree wave; this SUMMARY.md commit is the final artifact commit for this plan._

## Files Created/Modified

- `packages/client/src/components/EventBanner.tsx` - Ordered banner queue (queueRef), widened `Banner` type (`cardColor`/`dogso`), `getBannerMessage` extended for `FOUL_CALLED`/`INJURY_CHECK`/`BOOKING_CHECK`, `pieceName` resolver built via `useCallback` from a `gameState.pieces` selector, `RESTART_BANNERS` gains `PENALTY_KICK_SETUP_ATTACKING`, render body adds card badge + DOGSO label
- `packages/client/src/components/EventBanner.test.tsx` - 10 new tests (multi-event sequence, non-impacting injury/booking suppression, card badge attributes, DOGSO literal, injured-player message, Penalty Kick banner lifecycle) plus 1 queue-cap regression test
- `packages/client/src/components/EventBanner.module.css` - `.cardBadge` (18×24px, `data-card` attribute selectors) and `.dogsoLabel` (11px/700 Label role)
- `packages/client/src/styles/tokens.css` - `--color-card-yellow`, `--color-card-red`, `--color-card-badge-border`

## Decisions Made

- `getBannerMessage`'s module-scope signature widened to `(event, pieceName)` — a resolver function passed in, rather than the function calling the store directly, since module-scope functions cannot call hooks (Rules of Hooks).
- The banner queue (`queueRef`) is a `useRef`, not `useState` — pushing onto it during the eventLog-processing effect never triggers a second render; only the existing `setActive` call (dequeuing the head) does.
- Restart-phase banners enqueue through the identical queue as event-derived banners (checking `if (active === null)` before either `setActive` directly or pushing to `queueRef`), so a restart-phase transition arriving mid-foul-sequence waits its turn instead of overwriting the active banner.
- `BOOKING_CHECK`'s player name resolves from `event.defenderId` (the booked player), not `victimId` — matches 39-UI-SPEC.md's "{Player Name} — Yellow Card" copy referring to the carded player, and `INJURY_CHECK`'s name resolves from `event.victimId` (the injured player).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `--color-card-badge-border` token (not in the plan's two-token list)**

- **Found during:** Task 3 (card badge styling)
- **Issue:** The plan's action specified `border: 1px solid rgba(0,0,0,0.5)` for `.cardBadge`, matching PieceOverlay's inline SVG stroke treatment. `EventBanner.module.css` is covered by the project's `stylelint` config (`scale-unlimited/declaration-strict-value` + `function-disallowed-list: [rgb, rgba, hsl, hsla]`), which forbids a raw `rgba()` literal in `border`/`border-color`. Without a token, `pnpm stylelint` (an explicit `<verify>` and `<acceptance_criteria>` requirement) would fail.
- **Fix:** Added `--color-card-badge-border: rgba(0, 0, 0, 0.5)` to `tokens.css` (not itself linted by the `*.module.css` glob) as an "Extended chrome token (Rule 3 deviation)" — the same established pattern already used repeatedly in this file for `--color-overlay-backdrop`/`--color-banner-backdrop`/`--color-divider-subtle`. `.cardBadge`'s border now references `var(--color-card-badge-border)`.
- **Files modified:** `packages/client/src/styles/tokens.css`, `packages/client/src/components/EventBanner.module.css`
- **Verification:** `pnpm stylelint` exits 0; the visual value is unchanged from the plan's literal (`rgba(0,0,0,0.5)`) — only its `var()` form changed.
- **Committed in:** `5bb191c` (Task 3 commit)

**2. [Rule 2 - Missing Critical] Added a queue-cap regression test for T-39-04-02**

- **Found during:** post-Task-3 threat-model review
- **Issue:** The plan's `<threat_model>` assigns `mitigate` disposition to T-39-04-02 (unbounded banner queue DoS) with an explicit "assert in tests" clause. The 5-entry cap was already implemented in Task 2 (`queueRef.current = [...queueRef.current, ...banners].slice(0, 5)`), but no test asserted it — a correctness/security requirement per the threat register was left unverified.
- **Fix:** Added a test that queues 6 `GOAL` events from a single broadcast and asserts exactly 5 banners display (drain-and-count loop), confirming overflow is silently dropped rather than growing unbounded.
- **Files modified:** `packages/client/src/components/EventBanner.test.tsx`
- **Verification:** New test passes; full `EventBanner.test.tsx` suite (30 tests) green.
- **Committed in:** `093956d`

---

**Total deviations:** 2 auto-fixed (1 blocking/stylelint, 1 missing critical/threat-model test coverage)
**Impact on plan:** Both auto-fixes necessary for the plan's own explicit verification gates (`pnpm stylelint` exits 0) and the threat register's stated test-coverage requirement. No scope creep — no new banner behavior beyond what the plan specified.

## Issues Encountered

- The worktree had no `node_modules` and `packages/shared` had no `dist/` build output on first test run — resolved by running `pnpm install` (took several minutes; background task) and `pnpm --filter @counter-attack/shared build` before any test/typecheck/build command would resolve `@counter-attack/shared`. Not a plan defect — normal fresh-worktree setup cost, not a deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `EventBanner` now correctly surfaces every event in a multi-event broadcast — sibling Phase 39 plans (FoulChoicePanel, GK dive/box-entry prompts, PenaltyKickSetupPanel) can rely on the banner queue draining foul/injury/booking sequences without further EventBanner changes.
- `--color-card-yellow`/`--color-card-red` tokens are now available for the on-board `PieceOverlay` badge and roster-panel chip mentioned in 39-UI-SPEC.md as consumers in sibling plans.
- No blockers identified for downstream Phase 39 plans that depend on this one (`depends_on: ['39-01']` only — this plan itself introduces no new blocking dependency).

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Plan: 04_
_Completed: 2026-08-14_
