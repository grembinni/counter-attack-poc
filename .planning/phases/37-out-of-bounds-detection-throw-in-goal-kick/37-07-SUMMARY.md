---
phase: 37-out-of-bounds-detection-throw-in-goal-kick
plan: 07
subsystem: ui
tags: [react, zustand, vitest, hex-grid, throw-in, action-panel]

# Dependency graph
requires:
  - phase: 37-02
    provides: 'THROW_IN_SETUP GamePhase, GameState throw-in fields (throwInHex/throwInTeam/throwInPhasesTaken), ELIGIBLE_NEXT_ACTIONS THROW_IN_MOVEMENT_1/2 rows, validatePass options.maxDistance parameter'
  - phase: 37-05
    provides: 'applyThrowInPlace + GAME_THROW_IN_PLACE handler; applyEndTurn throw-in movement-counting branch producing lastActionType THROW_IN_MOVEMENT_1/2'
provides:
  - 'ThrowInSetupPanel React component (+ CSS module + tests) — the client UI surface for THROW_IN_SETUP, following Phase 35 conventions (Confirm verb, no container border, waiting-state phrasing)'
  - 'GameBoard.tsx phase-dispatch branch rendering ThrowInSetupPanel for THROW_IN_SETUP'
  - "HexGrid.tsx throw-in hex highlighting (existing 'safe' tint) and piece-selection gating (canSelectThrowIn) for the throwing team"
  - 'useGameStore.ts emitThrowInPlace action and a client-side 6-hex throw cap mirror in setSelectedPassType (THROW_IN_MAX_DISTANCE)'
  - 'ActionPanel.tsx throw-in step-choice button labels (Standard Throw-In / High Throw-In / Move) for THROW_IN_MOVEMENT_1/2'
affects: [37-08, 37-09, 37-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ThrowInSetupPanel structurally mirrors FreeKickSetupPanel's guard-then-waiting-then-active shape but omits the withEndTurnConfirm dialog since placement is a single completing action, not a multi-piece repositioning budget"
    - "HexGrid's canSelectThrowIn mirrors canSelectKickOff's 'own pieces only, opponent is a no-op' selection shape rather than the multi-stage FREE_KICK_SETUP model, since throw-in placement has no zone/budget constraints"
    - "ActionPanel's isThrowIn flag is label-only — eligibility itself stays entirely data-driven via ELIGIBLE_NEXT_ACTIONS['THROW_IN_MOVEMENT_1'/'2'], avoiding a second source of truth for which buttons render"

key-files:
  created:
    - packages/client/src/components/ThrowInSetupPanel.tsx
    - packages/client/src/components/ThrowInSetupPanel.module.css
    - packages/client/src/components/ThrowInSetupPanel.test.tsx
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx
    - packages/client/src/store/useGameStore.ts

key-decisions:
  - "Pulled the emitThrowInPlace declaration + implementation into Task 1's commit (originally scoped to Task 2 in the plan) because ThrowInSetupPanel and its tests have a hard runtime dependency on the action existing — the panel can't be built or tested without it. Task 2's commit then only added the incremental useGameStore.ts diff (THROW_IN_MAX_DISTANCE + setSelectedPassType cap mirror)."
  - "@typescript-eslint/no-unnecessary-type-assertion strips 'as HTMLButtonElement' when applied to a screen.getByRole(...) variable declaration (apparently a type-resolution quirk under this project's eslint type-aware config for test files), silently breaking tsc on the next lint-staged pass even though the assertion is required for .disabled access. Fixed by switching to the inline-cast-at-use-site pattern already used by FreeKickSetupPanel.test.tsx: (confirmBtn as HTMLButtonElement).disabled instead of a pre-cast const."
  - "Verified (not assumed) that no explicit early guard is needed to keep validMoveHexSet/shootingMode/pass-target sets inert during THROW_IN_SETUP (plan Task 2 item 4): movementSlot stays null throughout THROW_IN_SETUP, so validateMove's WRONG_SLOT guard already zeroes out any accidental selectPiece fallthrough to computeMovementValidHexes; shootingMode and the pass-target slices are already cleared on every phaseChanged broadcast in setGameState."

requirements-completed: [THROWIN-02, THROWIN-03, THROWIN-04]

# Metrics
duration: ~25min
completed: 2026-08-03
---

# Phase 37 Plan 07: Throw-In Client UI Summary

**ThrowInSetupPanel sidebar panel, pitch highlighting/selection, and ActionPanel throw-in button copy — the full client surface for the throw-in restart, reusing the existing `safe` hex tint and the existing Standard/High Pass mechanics with no new highlight types or selection UI.**

## Performance

- **Duration:** ~25 min (0353b3f at 22:06:53 to a7dfe09 at 22:21:46, plus initial context load / worktree bootstrap)
- **Started:** 2026-08-03T21:58:00-05:00 (approx)
- **Completed:** 2026-08-03T22:21:46-05:00
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `ThrowInSetupPanel` renders the Phase 35-locked waiting state (`"Defending team is repositioning…"`, verbatim) for the non-throwing manager and an active panel for the throwing manager with a thrower-selection status row and a `"Confirm"` button, disabled until a thrower is selected, that calls `emitThrowInPlace(selectedPieceId)`
- `ThrowInSetupPanel.module.css` uses the standard 4px/4px-8px spacing scale (not the legacy 3px/4px-6px values inherited by `FreeKickSetupPanel.module.css`), has no `.panel` border rule, and references only `--color-*`/`--team-accent` design tokens (no raw hex values)
- `GameBoard.tsx` dispatches `ThrowInSetupPanel` for `THROW_IN_SETUP` in the phase ternary, after the `FREE_KICK_SETUP` branch
- `HexGrid.tsx`: `isThrowInSetup`/`isMyThrowIn` derivations tint the throw-in hex with the existing `'safe'` `HexHighlightType` (green) at the same priority-ternary precedence as the `kickoff` tint, and a new `canSelectThrowIn` branch makes the throwing team's own pieces clickable/ring-eligible, mirroring `canSelectKickOff`'s "own pieces only, opponent is a no-op" shape. No hex-click `onClick` branch was added for `THROW_IN_SETUP` — placement is confirmed exclusively via the panel's Confirm button.
- `useGameStore.ts`: `emitThrowInPlace` emits `game:throw-in-place` with a pieceId-only payload; `setSelectedPassType` mirrors the server's 6-hex throw cap via a new `THROW_IN_MAX_DISTANCE = 6` constant, passed as `validatePass`'s `{ maxDistance }` option whenever `lastActionType` is `THROW_IN_MOVEMENT_1`/`THROW_IN_MOVEMENT_2`
- `ActionPanel.tsx`: a label-only `isThrowIn` flag relabels the `STANDARD_PASS`/`HIGH_PASS` buttons to `"Standard Throw-In"`/`"High Throw-In"` (with matching `ACTION_SUMMARY` tooltips) and swaps the helper-block copy to the UI-SPEC's per-step throw-in text; `Move` keeps its label unchanged in every context, and the pre-existing `ELIGIBLE_NEXT_ACTIONS['THROW_IN_MOVEMENT_2']` row (which already omits `MOVEMENT`) drops the Move button with no added client-side suppression
- Verified `git diff` on `HexCell.tsx` and `docs/HIGHLIGHT-REFERENCE.md` is empty for the whole plan — no new `HexHighlightType` member was introduced (D-08); the throw-in hex reuses `'safe'` and the throwing team's pieces reuse the pre-existing `selectionState='selectable'` ring
- Full client suite: 502 tests passing (up from the 483 baseline recorded in PROJECT.md at v1.5 close, +19 from this plan's new/expanded test files); full monorepo (`pnpm -r typecheck`) clean

## Task Commits

1. **Task 1: ThrowInSetupPanel component, styles and tests** - `0353b3f` (feat)
2. **Task 2: Wire the panel, the pitch and the store** - `389e588` (feat)
   - **Follow-up fix (same task's test file, lint-autofix regression):** `94c6474` (fix)
3. **Task 3: Throw-in action button copy in ActionPanel** - `a7dfe09` (feat)

## Files Created/Modified

- `packages/client/src/components/ThrowInSetupPanel.tsx` — sidebar panel: waiting/active states, thrower selection, Confirm button
- `packages/client/src/components/ThrowInSetupPanel.module.css` — Phase 35 conventions, 4px spacing scale, design tokens only
- `packages/client/src/components/ThrowInSetupPanel.test.tsx` — 13 tests: phase/null gating, turn gating, selection, Confirm states, emit, error surfacing
- `packages/client/src/components/GameBoard.tsx` — `THROW_IN_SETUP` phase-dispatch branch; comment cleanup for the resolved 37-07 portion of the Plan 37-02 note
- `packages/client/src/components/HexGrid.tsx` — throw-in hex tint (`'safe'`), `canSelectThrowIn` piece-selection branch, wired into `isClickable`/`selectionState`/`handleClick`
- `packages/client/src/components/ActionPanel.tsx` — `isThrowIn` flag, relabelled Standard/High Pass buttons and `ACTION_SUMMARY` entries, throw-in helper-block copy
- `packages/client/src/components/ActionPanel.test.tsx` — 3 new tests: `THROW_IN_MOVEMENT_1` (Move + both throw buttons), `THROW_IN_MOVEMENT_2` (throw buttons only), `MOVEMENT_PHASE` (unmodified labels)
- `packages/client/src/store/useGameStore.ts` — `emitThrowInPlace` action; `THROW_IN_MAX_DISTANCE` constant; `setSelectedPassType`'s throw-cap mirror in the `validatePass` call

## Decisions Made

See `key-decisions` in frontmatter — summarized: (1) pulled `emitThrowInPlace` forward into Task 1's commit since the component/tests have a hard dependency on it; (2) fixed a recurring `@typescript-eslint/no-unnecessary-type-assertion` lint-autofix regression in test-file button-disabled assertions by using the inline-cast-at-use-site pattern already established in `FreeKickSetupPanel.test.tsx`; (3) verified rather than assumed that `validMoveHexSet`/`shootingMode`/pass-target sets are already inert during `THROW_IN_SETUP` via the pre-existing `movementSlot === null` → `WRONG_SLOT` guard and the `phaseChanged` clear branch in `setGameState` — no additional early guard was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pulled `emitThrowInPlace` store action into Task 1's commit**

- **Found during:** Task 1 (ThrowInSetupPanel component/tests)
- **Issue:** The plan scoped `emitThrowInPlace`'s declaration/implementation to Task 2, but `ThrowInSetupPanel.tsx` subscribes to it directly (per Task 1's own action instructions) and `ThrowInSetupPanel.test.tsx` asserts it is called on Confirm click — the component and its tests cannot function or typecheck without it existing in the store first.
- **Fix:** Added the `emitThrowInPlace: (pieceId: string) => void` type declaration and `socket.emit(ClientEvents.GAME_THROW_IN_PLACE, pieceId)` implementation to `useGameStore.ts` as part of Task 1's commit.
- **Files modified:** `packages/client/src/store/useGameStore.ts`
- **Verification:** `ThrowInSetupPanel.test.tsx` (13/13 passing), `pnpm --filter @counter-attack/client typecheck` clean
- **Committed in:** `0353b3f` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed a lint-autofix regression stripping a required type assertion**

- **Found during:** Task 2 (post-commit `pnpm -r typecheck` verification)
- **Issue:** The pre-commit `lint-staged` hook's `eslint --fix` step removed `as HTMLButtonElement` from `const confirmBtn = screen.getByRole(...) as HTMLButtonElement;` in `ThrowInSetupPanel.test.tsx`, flagging it as `@typescript-eslint/no-unnecessary-type-assertion` — even though `tsc --noEmit` genuinely requires the cast for `.disabled` property access (`HTMLElement` has no `disabled` member). This happened twice (once after Task 1's commit, once after re-fixing and committing again for Task 2), each time silently reverting the fix back to a broken state because the auto-fixed result matched the version already in `HEAD` and produced no diff to commit.
- **Fix:** Switched to the inline-cast-at-use-site pattern already used by the pre-existing `FreeKickSetupPanel.test.tsx` — `(confirmBtn as HTMLButtonElement).disabled` instead of casting at the `const` declaration — which the same lint rule does not flag.
- **Files modified:** `packages/client/src/components/ThrowInSetupPanel.test.tsx`
- **Verification:** `npx eslint --fix` no longer strips the cast; `pnpm -r typecheck` clean; `ThrowInSetupPanel.test.tsx` 13/13 passing
- **Committed in:** `94c6474` (dedicated fix commit, after `389e588`)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes were necessary to keep the plan's own tasks committable and typechecking; no scope creep beyond what each task already required.

## Issues Encountered

- Worktree bootstrap gap (consistent with Plans 37-01 through 37-06): `node_modules` and `packages/shared/dist` were absent at session start — resolved with `pnpm install --frozen-lockfile` followed by `pnpm --filter @counter-attack/shared build` before any task work began. Not a plan deviation, standard worktree setup.
- The `lint-staged` pre-commit hook's `eslint --fix` + `prettier --write` steps ran on every commit and occasionally reformatted files beyond what was staged (e.g., reflowing `HexGrid.tsx`'s existing selector block). Re-verified `pnpm -r typecheck` and the full client test suite after every commit to confirm no regressions were introduced by the auto-formatting.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The full throw-in client surface (panel, pitch highlighting/selection, action-button copy) is wired and ready for human/browser verification alongside the server-side throw-in flow from Plans 37-05/37-06.
- `HexHighlightType` remains exactly the 10 pre-existing members (`safe`, `risk`, `goal`, `kickoff`, `shot-path`, `shot-path-action`, `header-target`, `gk-kick-target`, `pass-target`, `tackle-risk`) — this plan introduced no new tint type, and `docs/HIGHLIGHT-REFERENCE.md` is unmodified (confirmed via empty `git diff`).
- Plan 37-10 (Goal Kick client UI) can follow the same `ThrowInSetupPanel`/`GameBoard`/`HexGrid` wiring pattern established here.
- Total test count for regression tracking: **client 502 tests** — up from the 483 baseline recorded in `PROJECT.md` at v1.5 close.

## Threat Flags

None. This plan's threat model (T-37-28 through T-37-31, T-37-SC) was addressed exactly as specified: T-37-28 (client-side throw-range cap tampering) is mitigated by the client's `{ maxDistance: 6 }` being UX-only — the authoritative cap is the identical server-side argument from Plan 37-06. T-37-29 (spoofing an opponent's piece as thrower) is mitigated by `HexGrid`'s `canSelectThrowIn` gating on `piece.teamId === myTeam`, with the real guard being the server's `NOT_YOUR_PIECE`/`WRONG_TEAM` pair from Plan 37-05. T-37-30 (business-logic bypass showing Move after the second Movement Phase) is mitigated by button visibility deriving entirely from `ELIGIBLE_NEXT_ACTIONS` with no client-only suppression added. T-37-31 (opponent seeing the throwing team's local selection) is an accepted risk per the threat model — selection is local component state and the board is fully public to both managers by design. No packages were installed (T-37-SC).

## Known Stubs

None. Every artifact this plan's `must_haves` section requires is fully wired: `ThrowInSetupPanel` renders both the active and waiting states with the Phase 35 conventions; `GameBoard` dispatches it for `THROW_IN_SETUP`; `HexGrid` tints the throw-in hex and makes the throwing team's pieces selectable; `useGameStore` emits `game:throw-in-place` and caps throw-target highlights at 6 hexes; `ActionPanel` shows the correct three-button/two-button throw-in choice at each Movement Phase boundary.

---

## Self-Check: PASSED

- FOUND: packages/client/src/components/ThrowInSetupPanel.tsx
- FOUND: packages/client/src/components/ThrowInSetupPanel.module.css
- FOUND: packages/client/src/components/ThrowInSetupPanel.test.tsx
- FOUND: packages/client/src/components/GameBoard.tsx (THROW_IN_SETUP dispatch branch present)
- FOUND: packages/client/src/components/HexGrid.tsx (isThrowInSetup/isMyThrowIn/canSelectThrowIn present)
- FOUND: packages/client/src/components/ActionPanel.tsx (isThrowIn present)
- FOUND: packages/client/src/store/useGameStore.ts (emitThrowInPlace, THROW_IN_MAX_DISTANCE present)
- FOUND: 0353b3f (feat: Task 1)
- FOUND: 389e588 (feat: Task 2)
- FOUND: 94c6474 (fix: lint-autofix regression)
- FOUND: a7dfe09 (feat: Task 3)

---

_Phase: 37-out-of-bounds-detection-throw-in-goal-kick_
_Plan: 07_
_Completed: 2026-08-03_
