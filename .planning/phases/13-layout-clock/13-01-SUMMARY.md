---
phase: 13-layout-clock
plan: 01
subsystem: testing
tags: [vitest, react-testing-library, gameboard, zustand, wave-0]

# Dependency graph
requires:
  - phase: 12-visual-token-hex-layer
    provides: PlayerStatsPanel.test.tsx harness pattern (socket mock, useGameStore.setState, cleanup)
provides:
  - Wave 0 test scaffold for LAYOUT-01, LAYOUT-02, CLOCK-01, CLOCK-02 as failing Vitest assertions
  - Nyquist feedback signal for Plan 02 (GameBoard rewrite) to drive RED → GREEN cycle
affects: [13-02-PLAN, 13-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Extended socket mock pattern: socket.io.on/off added alongside socket.on/off/emit to satisfy ConnectionStatus manager events'

key-files:
  created:
    - packages/client/src/components/GameBoard.test.tsx
  modified: []

key-decisions:
  - "Socket mock extended with socket.io: { on: vi.fn(), off: vi.fn() } to satisfy ConnectionStatus's socket.io.on('reconnect_attempt') call; without this, render throws at effect mount time"
  - "Wave 0 tests intentionally RED (11/15 fail) — current GameBoard renders N' not N:00 format and has no log toggle; this is the expected Nyquist signal state before Plan 02"
  - '4 tests pass incidentally (score zeros, End Turn button, large score digits) — these will remain green after Plan 02 rewrite'

patterns-established:
  - "GameBoard test harness: vi.mock('../socket.js') with socket.io manager mock + useGameStore.setState with all 9 store keys"

requirements-completed: [LAYOUT-01, LAYOUT-02, CLOCK-01, CLOCK-02]

# Metrics
duration: 2min
completed: 2026-06-12
---

# Phase 13 Plan 01: Layout Clock Test Scaffold Summary

**Wave 0 Vitest scaffold asserting MM:00 clock format, always-visible clock, scoreboard scores, phase-swap action section, and log toggle — 15 tests RED as expected before GameBoard rewrite**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-12T17:42:50Z
- **Completed:** 2026-06-12T17:44:59Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `packages/client/src/components/GameBoard.test.tsx` with 15 executable Vitest assertions
- Encoded all four Phase 13 requirements (LAYOUT-01, LAYOUT-02, CLOCK-01, CLOCK-02) as failing test cases
- Suite collects and runs cleanly — 11 RED (expected), 4 incidentally passing, zero collection errors
- Extended socket mock with `socket.io` manager mock to prevent ConnectionStatus render-time throws

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GameBoard.test.tsx Wave 0 scaffold** - `65f2ad3` (test)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `packages/client/src/components/GameBoard.test.tsx` — Wave 0 test scaffold: 4 describe blocks (CLOCK-01, CLOCK-02, LAYOUT-01, LAYOUT-02), 15 test cases covering clock format, cross-phase clock visibility, scoreboard score display, and phase-aware action panel + log toggle

## Decisions Made

- Extended the socket mock to include `socket.io: { on: vi.fn(), off: vi.fn() }` because `ConnectionStatus.tsx` calls `socket.io.on('reconnect_attempt', ...)` (a Manager event, not a socket event per RESEARCH Pitfall 6). Without this, all render calls throw at useEffect mount time — blocking test collection.
- Used `getByText(/\d+:00/)` regex for CLOCK-02 cross-phase assertions (clock text format varies by phase, regex is phase-agnostic)
- Used `getByText(/7:00/)` literal regex for CLOCK-01 specific value assertions (tight enough to be a meaningful RED signal)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended socket mock with socket.io manager mock**

- **Found during:** Task 1 (first test run)
- **Issue:** `ConnectionStatus.tsx` calls `socket.io.on('reconnect_attempt', onReconnectAttempt)` in useEffect; the plan's socket mock `{ emit, on, off }` had no `io` property, causing `TypeError: Cannot read properties of undefined (reading 'on')` at effect mount — all 15 tests threw instead of asserting
- **Fix:** Added `io: { on: vi.fn(), off: vi.fn() }` and `connected: false` to the socket mock object
- **Files modified:** `packages/client/src/components/GameBoard.test.tsx`
- **Verification:** All 15 tests now run (11 RED as expected, 4 incidentally pass); no TypeError in output
- **Committed in:** `65f2ad3` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — socket mock extension)
**Impact on plan:** Necessary to allow render to succeed. No scope creep. The mock extension matches what `ConnectionStatus` needs and is consistent with how the socket mock is structured elsewhere in the test suite.

## Issues Encountered

The `ConnectionStatus` component imports `socket` from `../socket.js` and uses both `socket.on/off` (Socket.io socket events) and `socket.io.on/off` (Socket.io Manager events). The base socket mock pattern from `PlayerStatsPanel.test.tsx` only mocks `{ emit, on, off }` because `PlayerStatsPanel` does not import `ConnectionStatus`. `GameBoard` renders `<ConnectionStatus />` directly, so the mock needed to be extended. This is documented as a deviation and resolved inline.

## Next Phase Readiness

- Wave 0 gate satisfied: `GameBoard.test.tsx` exists with all four requirement assertions before Plan 02 rewrite
- 11 failing tests form the RED signal target for Plan 02's GameBoard rewrite
- Full client suite unaffected: 60 existing tests still pass

## Known Stubs

None — this plan creates only a test file. No production stubs introduced.

## Threat Flags

None — test-only file, no new production code paths, no input handling, no network surface.

---

## Self-Check

- [x] `packages/client/src/components/GameBoard.test.tsx` — FOUND
- [x] Commit `65f2ad3` — verified via `git rev-parse --short HEAD`

## Self-Check: PASSED

_Phase: 13-layout-clock_
_Completed: 2026-06-12_
