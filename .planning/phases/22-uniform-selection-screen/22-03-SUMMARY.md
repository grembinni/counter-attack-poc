---
phase: 22-uniform-selection-screen
plan: 03
subsystem: client
tags: [react, typescript, uniform-selection, socket.io, hex-grid]

# Dependency graph
requires:
  - phase: 22-01
    provides: ClientEvents.UNIFORM_CONFIRM, ServerEvents.UNIFORM_SELECTION_START, ServerEvents.UNIFORM_HOME_CONFIRMED, GameState.selectedUniformStyles
  - phase: 22-02
    provides: server UNIFORM_CONFIRM handler and deferred TEAM_PICK away branch
provides:
  - UniformSelectionScreen React component (new file)
  - UniformSelectionScreen.module.css (new file)
  - UniformSelectionScreen.test.tsx (12 passing tests)
  - Screen 'UNIFORM_SELECTION' union member in useGameStore.ts
  - App.tsx UNIFORM_SELECTION_START + UNIFORM_HOME_CONFIRMED handlers + render branch
  - HexGrid.tsx resolves uniformStyle from gameState.selectedUniformStyles (D-18)
affects: [App routing, HexGrid piece rendering, full client test suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NEUTRAL_PALETTE const for style tiles before team selection (D-05)"
    - "useEffect on [selectedTeam] pre-selects TEAM_CONFIGS[selectedTeam].defaultUniformStyle (UNIFORM-03)"
    - "UNIFORM_STYLES[styleId]({cx:40,cy:40,R:30,palette,isGK:false,pieceId:style-N}) tile render pattern"
    - "role=status opponent banner gated on homeConfirmedStyle !== null && !iAmHome (D-11)"
    - "selectedUniformStyles[displayPiece.teamId] replaces teamConfig.defaultUniformStyle in HexGrid (D-18)"

key-files:
  created:
    - packages/client/src/components/UniformSelectionScreen.tsx
    - packages/client/src/components/UniformSelectionScreen.module.css
    - packages/client/src/components/UniformSelectionScreen.test.tsx
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/App.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/mock/mockMovementState.ts

key-decisions:
  - "UniformSelectionScreen is a new file (not a refactor of TeamSelectionScreen) — scale of changes warrants clean separation"
  - "homeConfirmedStyle stored in App.tsx local state (mirrors homePickedTeam pattern — D-14)"
  - "resolvedUniformStyle derived from selectedUniformStyles[displayPiece.teamId] in HexGrid piece loop — single lookup per piece, no branching on home/away"
  - "ALL_TEAMS ordering: MLS first (city,crew,la,miami,nashville,seattle), then International (canada,england,france,mexico,spain,us) — flat grid, no tabs (D-02)"

requirements-completed: [UNIFORM-02, UNIFORM-03, UNIFORM-04]

# Metrics
duration: 13min
completed: 2026-07-05
---

# Phase 22 Plan 03: Client Uniform Selection Screen Summary

**Combined team + style selection screen with all 18 UNIFORM_STYLES tiles, neutral-to-palette swatch transition, defaultUniformStyle pre-selection, opponent banner, and HexGrid resolution from GameState.selectedUniformStyles**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-05T13:25:55Z
- **Completed:** 2026-07-05T13:38:32Z
- **Tasks:** 3 (+ checkpoint:human-verify)
- **Files created/modified:** 7

## Accomplishments

- Created `UniformSelectionScreen.tsx` with 12-team flat grid (MLS first, no tabs), 18 style tiles rendered via UNIFORM_STYLES, NEUTRAL_PALETTE before team pick (D-05), `defaultUniformStyle` pre-selection via useEffect (UNIFORM-03), single Confirm button, "Waiting for opponent…" post-confirm, and "Opponent confirmed" banner with `role="status"` for away player (D-11)
- Created `UniformSelectionScreen.module.css` with dark-theme token set (#1a1a2e/#16213e/#0f3460/#e0e0e0/#a0a0a0), 6×2 team grid, 6×3 style tile grid (80×80px tiles), opponent banner, confirm button, and copied speed selector classes
- Created `UniformSelectionScreen.test.tsx` with 12 tests covering all five behavior groups: style tiles always present, pre-selection, confirm emit payload, away struck-out card, and opponent banner
- Added `'UNIFORM_SELECTION'` to the `Screen` union in useGameStore.ts
- Extended App.tsx with `homeConfirmedStyle` state, `onUniformSelectionStart`/`onUniformHomeConfirmed` handlers (with matching `socket.off`), `handleUniformConfirm` emit, and `UNIFORM_SELECTION` render branch
- Updated HexGrid.tsx to select `gameState.selectedUniformStyles` and resolve each piece's `uniformStyle` from that map instead of `teamConfig.defaultUniformStyle` (D-18)
- Fixed `mockMovementState.ts` to include the required `selectedUniformStyles` field (Rule 3 blocking fix)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build UniformSelectionScreen component + CSS module** - `f7a1159` (feat)
2. **Task 2: Component test for pre-selection, palette re-render, and confirm emit** - `2d2a01f` (test)
3. **Task 3: Wire Screen union, App.tsx handlers/branch, and HexGrid style resolution** - `0beddac` (feat)

## Files Created/Modified

- `packages/client/src/components/UniformSelectionScreen.tsx` — new combined team + style screen component
- `packages/client/src/components/UniformSelectionScreen.module.css` — dark-theme CSS module
- `packages/client/src/components/UniformSelectionScreen.test.tsx` — 12 component tests (all passing)
- `packages/client/src/store/useGameStore.ts` — added `'UNIFORM_SELECTION'` to Screen union
- `packages/client/src/App.tsx` — new handlers, render branch, and uniform confirm emit
- `packages/client/src/components/HexGrid.tsx` — selectedUniformStyles selector + resolvedUniformStyle per piece
- `packages/client/src/mock/mockMovementState.ts` — added `selectedUniformStyles` to fix compile error

## Decisions Made

- `homeConfirmedStyle` stored in App.tsx local state alongside `homePickedTeam` — follows the D-14 pattern established in Phase 16; no Zustand store changes needed
- `resolvedUniformStyle = selectedUniformStyles[displayPiece.teamId]` — single lookup in the piece render loop; no branching needed since `displayPiece.teamId` is already `'home'` or `'away'`
- Style tile test assertions use `aria-label` from `UNIFORM_STYLE_META[styleId].name` (e.g. "Pinstripes (V)", "Bar (Diag)") — robust to SVG internals which are not tested

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `selectedUniformStyles` to `mockMovementState.ts`**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** `packages/client/src/mock/mockMovementState.ts` typed as `GameState` but missing the required `selectedUniformStyles` field added in Plan 22-01
- **Fix:** Added `selectedUniformStyles: { home: 'pinstripes-vertical', away: 'bar-diagonal' }` to the mock
- **Files modified:** `packages/client/src/mock/mockMovementState.ts`
- **Verification:** TypeScript compiles with 0 errors; full client vitest suite 300/300 pass
- **Committed in:** f7a1159 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed style name in test: "Bar (Diagonal)" → "Bar (Diag)"**
- **Found during:** Task 2 (test run)
- **Issue:** Test asserted `getByRole('button', { name: 'Bar (Diagonal)' })` but `UNIFORM_STYLE_META['bar-diagonal'].name` is `'Bar (Diag)'`
- **Fix:** Updated test assertion to use the correct aria-label string
- **Files modified:** `packages/client/src/components/UniformSelectionScreen.test.tsx`
- **Verification:** `cd packages/client && npx vitest run src/components/UniformSelectionScreen.test.tsx` — 12/12 pass
- **Committed in:** 2d2a01f (Task 2 commit)

## Verification

- `npx tsc --noEmit -p packages/client/tsconfig.json` exits 0 (verified via worktree typeRoots pointing to packages/client/node_modules)
- `npx vitest run` (full client suite): 300 tests / 15 test files — all pass including 12 new UniformSelectionScreen tests
- Task 4 (checkpoint:human-verify) is pending human review of the two-tab flow in browser

## Known Stubs

None — all 18 style tiles render via live UNIFORM_STYLES renderers, all confirms emit real socket events, HexGrid resolves styles from actual GameState.selectedUniformStyles.

## Threat Flags

No new security surfaces introduced beyond the threat model:
- `UNIFORM_CONFIRM` emitted by client carries user-chosen teamId/uniformStyle — both validated server-side in Plan 22-02 (T-22-07, T-22-08 mitigated)
- No new endpoints, no new auth paths, no new file access patterns

## Self-Check: PASSED

- File FOUND: packages/client/src/components/UniformSelectionScreen.tsx
- File FOUND: packages/client/src/components/UniformSelectionScreen.module.css
- File FOUND: packages/client/src/components/UniformSelectionScreen.test.tsx
- Commit f7a1159 (Task 1): FOUND
- Commit 2d2a01f (Task 2): FOUND
- Commit 0beddac (Task 3): FOUND

---
*Phase: 22-uniform-selection-screen*
*Completed: 2026-07-05*
