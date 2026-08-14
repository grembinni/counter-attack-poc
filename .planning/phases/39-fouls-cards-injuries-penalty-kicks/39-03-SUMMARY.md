---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 03
subsystem: ui
tags: [react, socket.io, game-settings, typescript]

# Dependency graph
requires:
  - phase: 39-01
    provides: Phase 39 GameState/Room fields (foulsEnabled/bookingEnabled/injuryEnabled), the extended ROOM_SETTINGS_CONFIRM/CONFIRMED event signatures, and buildInitialGameState's three new toggle params
provides:
  - GameSettingsScreen "Match Rules" section with four default-ON checkboxes (Fouls, Booking, Injury, Out-of-Bounds/Restarts), Booking/Injury disabled+"(requires Fouls)" whenever Fouls is off
  - Client-side booking/injury normalisation (fouls && x) at confirm time
  - Server-side ROOM_SETTINGS_CONFIRM validation split into three field-specific guards (INVALID_FOULS/INVALID_BOOKING/INVALID_INJURY) replacing Plan 39-01's combined INVALID_FOUL_SETTINGS fallback
  - Server-side SETTINGS-02/03 normalisation (room.bookingEnabled = fouls && booking, etc.) — a modified client can no longer bypass the Fouls dependency
  - buildInitialGameState's LINEUP_CONFIRM call site now passes foulsEnabled/bookingEnabled/injuryEnabled — every GameState from this point forward carries the real toggle values instead of the false defaults
affects:
  [39-04, 39-05, 39-06, 39-07, 39-08, 39-09, 39-10, 39-11, 39-12, 39-13, 39-14, 39-15, 39-16, 39-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Match Rules section reuses the existing poolRow/poolRowDisabled/comingSoon CSS-class + computed-disabled pattern (SELECTABLE_DRAFT_POOLS precedent) rather than inventing new markup'
    - "Server-side toggle normalisation mirrors the client's own normalisation (fouls && booking) rather than trusting the client — same value, computed twice, independently"

key-files:
  created: []
  modified:
    - packages/client/src/components/GameSettingsScreen.tsx
    - packages/client/src/components/GameSettingsScreen.test.tsx
    - packages/client/src/App.tsx
    - packages/client/src/App.test.tsx
    - packages/server/src/roomHandlers.ts
    - packages/server/src/__tests__/room.integration.test.ts

key-decisions:
  - "Booking/Injury toggle state is deliberately NOT stored in new App.tsx React state — no downstream consumer exists yet in this plan's scope (no settings-summary line, no gameplay UI), so storing it would be dead state triggering an eslint no-unused-vars failure. The three booleans still flow end-to-end through the socket payload and Room storage, which is what SETTINGS-01/02/03 require."
  - "Split Plan 39-01's single combined INVALID_FOUL_SETTINGS guard into three field-specific guards (INVALID_FOULS/INVALID_BOOKING/INVALID_INJURY) per this plan's explicit spec, matching the INVALID_SPEED/INVALID_TEAM_TYPE/INVALID_OUT_OF_BOUNDS precedent of one error code per field."
  - "Server-side booking/injury normalisation (room.bookingEnabled = fouls && booking) added — Plan 39-01's fallback stored raw pass-through values; this plan closes that gap per SETTINGS-02/03's explicit requirement that Booking/Injury are servers-side inert (not just client-hidden) whenever Fouls is off."

requirements-completed: [SETTINGS-01, SETTINGS-02, SETTINGS-03, FOUL-05, CARD-04, INJURY-04]

# Metrics
duration: ~30min
completed: 2026-08-14
---

# Phase 39 Plan 3: Game-Creation Settings Toggles + Server Plumbing Summary

**Four default-ON Match Rules checkboxes (Fouls/Booking/Injury/Out-of-Bounds) with Fouls-dependency grey-out, client+server normalisation, and full GameState propagation validated end-to-end by a live LINEUP_CONFIRM integration test.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-14
- **Tasks:** 3 (plus one follow-up test-only commit)
- **Files modified:** 6

## Accomplishments

- `GameSettingsScreen.tsx`'s "Restarts" section renamed to "Match Rules" and extended with Fouls/Booking/Injury checkboxes ahead of Out-of-Bounds/Restarts; all four now default to `useState<boolean>(true)` (D-14), with Booking/Injury visually disabled and annotated `(requires Fouls)` whenever Fouls is unchecked (D-13), reusing the existing `poolRow`/`poolRowDisabled`/`comingSoon` pattern verbatim (D-12).
- Client-side confirm normalisation: `handleConfirm` sends `booking: fouls && booking, injury: fouls && injury` so a modified local UI state can't slip an inert toggle through.
- 23 GameSettingsScreen tests (17 pre-existing, updated for the new default-ON baseline, + 6 new D-12/13/14 assertions) and 5 App.test.tsx assertions all green.
- `App.tsx`'s `handleSettingsConfirm`/`onRoomSettingsConfirmed` extended to the 7-arg `ROOM_SETTINGS_CONFIRM`/`ROOM_SETTINGS_CONFIRMED` contract; `handleSettingsConfirm` now forwards the settings object as-is instead of Plan 39-01's hardcoded `fouls:false` override.
- `roomHandlers.ts`'s `ROOM_SETTINGS_CONFIRM` validation split into three field-specific ASVS V5 guards (`INVALID_FOULS`/`INVALID_BOOKING`/`INVALID_INJURY`), replacing Plan 39-01's combined `INVALID_FOUL_SETTINGS` fallback; server now independently re-derives `bookingEnabled`/`injuryEnabled` as `fouls && x` rather than trusting the client.
- `buildInitialGameState`'s `LINEUP_CONFIRM` call site now passes `room.foulsEnabled/bookingEnabled/injuryEnabled` as the three trailing args — every match-start `GameState` from this plan forward carries the real toggle values (previously stuck at the `false` defaults).
- Server test suite gained 6 new `room.integration.test.ts` cases (3 forged-payload rejections, 1 server-side normalisation check, 1 happy-path broadcast check, 1 full LINEUP_CONFIRM-to-GameState live-snapshot check satisfying the plan's `<verification>` bullet).
- Full monorepo `pnpm build` and `pnpm test` green: shared 706, server 1040 (1 skipped, 1 todo), client 800 — 2,546 total.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the three toggles to GameSettingsScreen with the Fouls dependency grey-out and default-ON flip** - `c4bc992` (feat)
2. **Task 2: Component tests for the four-toggle screen** - `d9068f2` (test)
3. **Task 3: Server-side validation, Room storage and GameState propagation for the three toggles** - `39f0c6a` (feat)
4. **Follow-up: live GAME_STATE assertion for the plan's `<verification>` bullet** - `941db49` (test)

_No plan-metadata commit yet — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/client/src/components/GameSettingsScreen.tsx` - Match Rules section (Fouls/Booking/Injury/Out-of-Bounds), default-ON flip, Fouls-dependency disable, confirm-time normalisation
- `packages/client/src/components/GameSettingsScreen.test.tsx` - Updated 8 pre-existing assertions for the new default-ON baseline; added 6 new D-12/13/14 assertions
- `packages/client/src/App.tsx` - `handleSettingsConfirm`/`onRoomSettingsConfirmed` extended with fouls/booking/injury; hardcoded-false override removed
- `packages/client/src/App.test.tsx` - Updated confirm-payload assertion for the new default-ON baseline
- `packages/server/src/roomHandlers.ts` - Three field-specific validation guards; server-side `fouls &&` normalisation; `buildInitialGameState` call extended with the three trailing toggle args
- `packages/server/src/__tests__/room.integration.test.ts` - 6 new integration tests (3 validation-rejection, 1 normalisation, 1 happy-path broadcast, 1 live GameState snapshot)

## Decisions Made

- Booking/Injury local echo state deliberately NOT introduced in `App.tsx` — see key-decisions above.
- Split the combined `INVALID_FOUL_SETTINGS` guard (a Plan 39-01 build-green fallback) into three field-specific guards per this plan's explicit spec.
- Added server-side `fouls &&` re-derivation for `bookingEnabled`/`injuryEnabled`, closing a gap left by Plan 39-01's raw pass-through fallback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing GameSettingsScreen/App tests broke under the new default-ON baseline**

- **Found during:** Task 1's own verify gate (`pnpm --filter client test -- GameSettingsScreen.test.tsx`)
- **Issue:** D-14's default-ON flip (all four Match Rules toggles, including the pre-existing `outOfBounds`) makes 8 pre-existing test assertions stale: default-unchecked checks, and every `onConfirm`/`socket.emit` payload assertion that expected `outOfBounds: false` (and now also needs `fouls/booking/injury: true`).
- **Fix:** Updated the 8 stale assertions in `GameSettingsScreen.test.tsx` (Task 1) and 1 in `App.test.tsx` (Task 2) to the new default-ON payload shape. This was required for Task 1's own stated verify command to pass — not scope creep, since the plan's own acceptance criteria mandates the pre-existing test file stays green after the component change.
- **Files modified:** `packages/client/src/components/GameSettingsScreen.test.tsx`, `packages/client/src/App.test.tsx`
- **Verification:** All 23 + 5 tests green; full client suite (800 tests) green.
- **Committed in:** `c4bc992` (GameSettingsScreen.test.tsx), `d9068f2` (App.test.tsx)

**2. [Rule 1 - Bug] `getByRole('checkbox', { name: 'Booking' })` broke once disabled (accessible name includes trailing helper text)**

- **Found during:** Task 2, writing the new D-13 disabled-state assertions
- **Issue:** When Fouls is off, the Booking/Injury `<label>` renders `"Booking (requires Fouls)"` as its full text content, which becomes the checkbox's accessible name — an exact-string `name: 'Booking'` query no longer matches.
- **Fix:** Used a `/^Booking/` / `/^Injury/` regex name matcher for the two assertions that query these checkboxes while Fouls is off, mirroring the existing `/legends/i` regex pattern already used elsewhere in this file for Draft Pool rows.
- **Files modified:** `packages/client/src/components/GameSettingsScreen.test.tsx`
- **Verification:** All 23 tests green.
- **Committed in:** `d9068f2`

**3. [Rule 3 - Blocking] `App.tsx`'s new `fouls`/`booking`/`injury` local `useState` triggered an eslint `no-unused-vars` failure**

- **Found during:** Task 2, extending `handleSettingsConfirm`/`onRoomSettingsConfirmed`
- **Issue:** The plan's primary instruction was to "store [fouls/booking/injury] alongside the existing `outOfBounds` echo state" — but unlike `outOfBounds` (consumed by `formatSettingsSummary`), the three new booleans have zero downstream consumers in this plan's scope. Introducing matching `useState` triples produced `'fouls' is assigned a value but never used` (and same for booking/injury) from `@typescript-eslint/no-unused-vars`, which is enforced at commit time via lint-staged.
- **Fix:** Followed the plan's own explicit fallback clause ("if App.tsx currently discards outOfBounds on the echo, discard the three new ones the same way rather than introducing new state") — accepted the three trailing params on `onRoomSettingsConfirmed` (underscore-prefixed, matching the repo's `argsIgnorePattern: '^_'` eslint convention) without storing them, and removed the `setFouls`/`setBooking`/`setInjury` calls from `handleSettingsConfirm` (the values still flow through the forwarded `settings` object to `socket.emit`).
- **Files modified:** `packages/client/src/App.tsx`
- **Verification:** `pnpm exec eslint src/App.tsx` clean; `pnpm --filter client typecheck` clean; full client test suite green.
- **Committed in:** `d9068f2`

**4. [Rule 2 - Missing Critical] Plan's `<verification>` bullet ("a live snapshot after LINEUP_CONFIRM contains foulsEnabled, bookingEnabled, injuryEnabled") had no automated test after Task 3**

- **Found during:** Post-Task-3 review of the plan's overall `<verification>` section (Task 3's own listed acceptance criteria only covered Room-level/broadcast-level assertions, not a live `GameState` snapshot)
- **Issue:** Without this test, the actual `buildInitialGameState` wiring inside `LINEUP_CONFIRM` (the single most important correctness requirement of Task 3) was only indirectly verified via existing server test-suite passes, not directly asserted against a live `GAME_STATE` payload.
- **Fix:** Added one integration test driving a full `ROOM_SETTINGS_CONFIRM` → team-pick → uniform-confirm → `LINEUP_CONFIRM` flow with all three toggles `true`, asserting `state.foulsEnabled/bookingEnabled/injuryEnabled === true` on the resulting `GAME_STATE` broadcast.
- **Files modified:** `packages/server/src/__tests__/room.integration.test.ts`
- **Verification:** New test passes (24/24 in the file); full server suite green (1040 passed, 1 skipped, 1 todo).
- **Committed in:** `941db49`

---

**Total deviations:** 4 auto-fixed (2 Rule 1, 1 Rule 3, 1 Rule 2). All were necessary to keep the plan's own stated verify gates green or to close a genuine coverage gap against the plan's `<verification>` section. No scope creep — no new UI beyond the plan's Match Rules section, no architectural changes.
**Impact on plan:** None negative. The Rule 3 fix (discarding rather than storing dead React state) is the more correct implementation per the plan's own explicit fallback instruction, and avoids introducing state a later Phase 39 plan would need to either wire up or delete.

## Issues Encountered

- Fresh worktree had no `node_modules` (each git worktree gets its own working directory) — ran `pnpm install --frozen-lockfile` once (~5 min, backgrounded) before any test/typecheck/build command would run, matching Plan 39-01's documented setup step.
- `packages/shared`'s `dist/` was stale/absent in the worktree — ran `pnpm --filter @counter-attack/shared build` once before the client's vite-based test runner could resolve `@counter-attack/shared` (package `exports` point at `dist/`, not source).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The full Fouls/Booking/Injury settings surface is now live end-to-end: client UI → `ROOM_SETTINGS_CONFIRM` (validated, normalised) → `Room` storage → `buildInitialGameState` → `GameState.foulsEnabled/bookingEnabled/injuryEnabled` on every broadcast from match start onward.
- Every later Phase 39 plan (39-04 onward, the actual foul/booking/injury/GK-dive/penalty-kick game-logic waves) can now read `state.foulsEnabled === true` / `state.bookingEnabled === true` / `state.injuryEnabled === true` directly off a live `GameState` with confidence the values are real, not stub defaults.
- No blockers. Full monorepo `pnpm build`/`pnpm test` green (shared 706, server 1040/1 skipped/1 todo, client 800 — 2,546 total).

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_
