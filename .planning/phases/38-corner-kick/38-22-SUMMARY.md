---
phase: 38-corner-kick
plan: 22
subsystem: ui
tags: [corner-kick, gap-closure, hex-highlighting, exclusion-zone, react, zustand]

# Dependency graph
requires:
  - phase: 38-corner-kick (plan 18)
    provides: CORNER_KICK_CLEAR_OUT GamePhase/CORNER_KICK_CLEAR_OUT_MOVE ActionEventType,
      cornerKickClearOutSlot GameState field, and the shared outOfBounds.ts helpers
      (CORNER_EXCLUSION_RADIUS, isWithinCornerExclusionZone, cornerClearOutGoalHex,
      isLegalClearOutStep) this plan consumes
  - phase: 38-corner-kick (plan 20)
    provides: applyCornerKickClearOut/applyCornerKickClearOutEnd and the CORNER_EXCLUSION_ZONE
      guard on applyCornerKickGkPlace/applyCornerKickReposition/applyCornerKickFinalMove — the
      server-side rule this plan's client destination sets must never exceed
  - phase: 38-corner-kick (plan 21)
    provides: the GAME_MOVE/GAME_END_TURN socket wiring for CORNER_KICK_CLEAR_OUT and the
      newly-reachable GAME_ERROR wire code table this plan maps to player-facing copy
provides:
  - CORNER_KICK_CLEAR_OUT selectPiece branch (useGameStore.ts) — acting-team derivation from
    cornerKickClearOutSlot, empty destination set for pieces already clear of the zone,
    isLegalClearOutStep-filtered adjacent hexes otherwise
  - Permanent defender exclusion-zone filtering on the client's three other corner destination
    computations (CORNER_KICK_GK_SETUP_DEFENDING, CORNER_KICK_REPOSITION,
    CORNER_KICK_FINAL_SETUP, including both selectPiece and the setGameState sticky-selection
    mirrors of each) — mirrors the server's CORNER_EXCLUSION_ZONE guard on the defending side
    only, never the attacking side
  - HexGrid.tsx cornerKickClearOutSlot selector and canSelectCornerKickClearOut, wired into
    isClickable and the piece-click dispatch chain
  - CornerKickSetupPanel.tsx CORNER_KICK_CLEAR_OUT branch (acting/waiting states, {N}-driven
    CTA colour, no soft end-turn dialog, no Undo)
  - GameBoard.tsx PHASE_LABEL['CORNER_KICK_CLEAR_OUT'] and panel-dispatch registration
  - BallLocationRing.tsx BALL_MARKER_PHASES registration for CORNER_KICK_CLEAR_OUT
  - restartErrorMessage.ts sentences for MUST_CLEAR_CORNER, NOT_TOWARD_GOAL,
    CORNER_EXCLUSION_ZONE, and an updated NOT_ELIGIBLE sentence
affects: [
    38-corner-kick verification checkpoint (38-24),
    any future plan touching
    GameBoard.tsx's PHASE_LABEL/dispatch or the corner-kick client selection branches,
  ]
requirements-completed: [OOB-03, CORNER-01, CORNER-02, CORNER-03, CORNER-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client destination-hex computation for a shared-rule phase always calls the shared pure
      helper (isLegalClearOutStep/isWithinCornerExclusionZone) directly — never reimplements the
      distance comparison inline — so the client's highlighted set can only ever be a subset of
      what the server accepts, never a superset (T-38-74)."
    - "A permanent cross-phase rule (the 3-hex exclusion zone) is enforced at every destination
      computation site that could produce a defending-side hex, not just the one phase that
      introduced it — including the setGameState sticky-selection mirrors of selectPiece's own
      branches, which are easy to miss since they live ~500 lines away from the selectPiece
      branch they mirror."

key-files:
  created:
    - .planning/phases/38-corner-kick/38-22-SUMMARY.md
  modified:
    - packages/client/src/store/useGameStore.ts
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/CornerKickSetupPanel.tsx
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/BallLocationRing.tsx
    - packages/client/src/components/BallLocationRing.test.tsx
    - packages/client/src/utils/restartErrorMessage.ts
    - packages/client/src/store/useGameStore.test.ts
    - packages/client/src/components/HexGrid.test.tsx
    - packages/client/src/components/CornerKickSetupPanel.test.tsx
    - .planning/phases/38-corner-kick/38-UI-SPEC.md

key-decisions:
  - "The goalkeeper-placement destination-set computation for CORNER_KICK_GK_SETUP_DEFENDING
    actually lives in useGameStore.ts's selectPiece (the PITCH_HEXES.filter(...) call), NOT in
    HexGrid.tsx as the plan's Task 1 action text assumed — HexGrid.tsx only consumes the
    resulting validMoveHexes for tinting, it never computes its own destination set for any
    corner phase. The plan's own read_first instruction anticipated this ('read the surrounding
    code to find that computation rather than assuming where it lives'); the exclusion-zone
    filter was applied at the real location instead of inventing a parallel computation in
    HexGrid.tsx."
  - "NOT_ELIGIBLE's restartErrorMessage.ts sentence was changed from 'That player is not
    eligible for this action.' (38-17) to 'That player cannot be moved in this step.' per this
    plan's explicit copywriting contract — the same wire code is now shared between the
    pre-existing CORNER_KICK_REPOSITION/CORNER_KICK_FINAL_SETUP eligibility rejection and the
    new CORNER_KICK_CLEAR_OUT 'already clear of the zone' rejection. No test asserted the old
    literal text, so this is a safe in-place update rather than a second entry."
  - "Applied the permanent exclusion-zone filter to the setGameState sticky-selection mirrors of
    CORNER_KICK_REPOSITION and CORNER_KICK_FINAL_SETUP (not just their selectPiece branches),
    beyond the plan action text's literal two call sites — otherwise a defending piece mid-
    selection could see a stale in-zone destination survive an opponent's broadcast until the
    next selectPiece call, a real (if narrow) client/server destination-set mismatch (Rule 1/2:
    correctness gap directly caused by this task's own change, not out-of-scope)."

patterns-established: []

# Metrics
duration: ~55min
completed: 2026-08-08
---

# Phase 38 Plan 22: Clear-Out UI and Permanent Exclusion-Zone Mirror Summary

**The mandatory pre-corner clear-out (38-15 defect 3) is now fully playable in the browser — a dedicated `selectPiece` branch, `HexGrid` selectability, and `CornerKickSetupPanel` branch — and the 3-hex defender exclusion zone is now mirrored client-side at every corner destination computation that could otherwise offer a defender a hex the server would reject.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-08
- **Tasks:** 3/3 completed
- **Files modified:** 11 (7 source, 4 test/doc — see key-files)

## Accomplishments

- `useGameStore.ts` gains a `CORNER_KICK_CLEAR_OUT` `selectPiece` branch that resolves the
  acting team from `cornerKickClearOutSlot`, gives an already-clear piece an empty destination
  set (selectable so its stats still show), and otherwise computes exactly the adjacent
  on-pitch, unoccupied hexes that pass the shared `isLegalClearOutStep` rule — never a
  reimplemented distance comparison.
- The permanent 3-hex exclusion zone (T-38-74) is now filtered client-side at all four
  destination-set computations that could ever offer a defending-side hex inside it:
  `CORNER_KICK_GK_SETUP_DEFENDING` (in `useGameStore.ts`, not `HexGrid.tsx` — see Deviations),
  `CORNER_KICK_REPOSITION`, and `CORNER_KICK_FINAL_SETUP`, each covering both their `selectPiece`
  branch and the `setGameState` sticky-selection mirror that recomputes the same set across a
  same-phase broadcast.
- `HexGrid.tsx` gains a `cornerKickClearOutSlot` selector and `canSelectCornerKickClearOut`
  (mirrors `canSelectCornerKickReposition`'s shape: phase + acting-team + zone-membership),
  wired into both the `isClickable` disjunction and the piece-click dispatch chain.
- `CornerKickSetupPanel.tsx` gains a `CORNER_KICK_CLEAR_OUT` branch placed before the
  goalkeeper-window branch (sequence order): the waiting-state phrase for the non-acting
  manager, the two constraint rows from this plan's copywriting contract, an `{N}`-driven
  `ctaColorClass` CTA, no `withEndTurnGuard` (mandatory step, no soft override), and no `Undo`
  button (the clear-out is not in `validUndoPhases`).
- `GameBoard.tsx`'s `PHASE_LABEL` gains `CORNER_KICK_CLEAR_OUT: 'CORNER KICK — CLEAR THE
CORNER'` and the panel-dispatch condition gains the phase — this closes the exact
  `deferred-items.md` gap flagged for "whichever plan next touches `GameBoard.tsx`".
- `BallLocationRing.tsx`'s `BALL_MARKER_PHASES` gains `CORNER_KICK_CLEAR_OUT` (22 → 23 members);
  the pre-existing set-size pin test in `BallLocationRing.test.tsx` was re-expected accordingly.
- `restartErrorMessage.ts` gains `MUST_CLEAR_CORNER`, `NOT_TOWARD_GOAL`, and
  `CORNER_EXCLUSION_ZONE` sentences (covering every code named in 38-21's SUMMARY plus this
  plan's four), and updates `NOT_ELIGIBLE`'s sentence per this plan's copywriting contract.
- `38-UI-SPEC.md`'s Copywriting Contract table gains the four clear-out rows verbatim, plus a
  Design System highlight-mapping row confirming clear-out destinations reuse the existing
  `safe` tint (no new `HexHighlightType` member — D-09).
- 15 new client tests (6 `useGameStore.test.ts`, 3 `HexGrid.test.tsx`, 6
  `CornerKickSetupPanel.test.tsx`) prove the clear-out selection/destination logic, its
  selectability, its panel rendering, and the exclusion-zone filtering on the two later corner
  windows — every probe hex derived from `CORNER_KICK_HEX` + hex helpers, never a restated
  coordinate literal.

## Task Commits

Each task was committed atomically:

1. **Task 1: Clear-out selection, legal-step destinations, and defending exclusion filtering** - `a0e9d98` (feat)
2. **Task 2: Clear-out panel branch, phase registration, and the new error sentences** - `0c8adf7` (feat)
3. **Task 3: Client tests for the clear-out UI and the exclusion-zone mirror** - `691b50a` (test)

_Note: SUMMARY.md is committed separately below (worktree parallel-executor mode — orchestrator owns STATE.md/ROADMAP.md updates after merge)._

## Files Created/Modified

- `packages/client/src/store/useGameStore.ts` — `CORNER_KICK_CLEAR_OUT` `selectPiece` branch
  added; exclusion-zone filtering added to `CORNER_KICK_GK_SETUP_DEFENDING`'s destination
  computation and to both `selectPiece` and `setGameState` sticky-selection paths of
  `CORNER_KICK_REPOSITION`/`CORNER_KICK_FINAL_SETUP`.
- `packages/client/src/components/HexGrid.tsx` — `cornerKickClearOutSlot` selector,
  `canSelectCornerKickClearOut`, wired into `isClickable` and the click-dispatch chain.
- `packages/client/src/components/CornerKickSetupPanel.tsx` — `CORNER_KICK_CLEAR_OUT` branch,
  `isCornerKickPhase` disjunction extended.
- `packages/client/src/components/GameBoard.tsx` — `PHASE_LABEL` entry + panel-dispatch
  condition.
- `packages/client/src/components/BallLocationRing.tsx` — `BALL_MARKER_PHASES` entry.
- `packages/client/src/components/BallLocationRing.test.tsx` — re-expected the pre-existing
  set-size pin test (22 → 23 members).
- `packages/client/src/utils/restartErrorMessage.ts` — three new sentences, one updated
  sentence.
- `packages/client/src/store/useGameStore.test.ts`,
  `packages/client/src/components/HexGrid.test.tsx`,
  `packages/client/src/components/CornerKickSetupPanel.test.tsx` — 15 new tests total.
- `.planning/phases/38-corner-kick/38-UI-SPEC.md` — Copywriting Contract rows + highlight-mapping
  row.

## Decisions Made

See `key-decisions` in frontmatter above. Two are worth restating here:

1. **Goalkeeper-placement destination set lives in `useGameStore.ts`, not `HexGrid.tsx`.** The
   plan's Task 1 action text placed this instruction under the `HexGrid.tsx` heading, but
   `HexGrid.tsx` never computes its own destination set for any corner phase — it only tints
   `HexCell`s from `validMoveHexes`, which `useGameStore.ts`'s `selectPiece` computes. The
   plan's own `read_first` note anticipated this uncertainty; the filter was applied at the real
   computation site (`useGameStore.ts`'s `CORNER_KICK_GK_SETUP_ATTACKING`/`_DEFENDING` branch)
   rather than inventing a parallel computation in `HexGrid.tsx`.
2. **`NOT_ELIGIBLE`'s sentence was changed in place, not duplicated.** The wire code
   `NOT_ELIGIBLE` was already mapped (38-17, `'That player is not eligible for this action.'`)
   for the reposition/final-setup eligibility rejection. This plan's copywriting contract
   specifies a different sentence for the same code (`'That player cannot be moved in this
step.'`), which the clear-out's "already outside the zone" rejection also uses. No test
   pinned the old literal text, so the single map entry was updated rather than risking a
   duplicate-key TypeScript error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Re-expected `BallLocationRing.test.tsx`'s pre-existing `BALL_MARKER_PHASES`
size-pin test**

- **Found during:** Task 2 verification (`pnpm --filter @counter-attack/client test --
CornerKickSetupPanel GameBoard BallLocationRing restartErrorMessage`)
- **Issue:** A pre-existing test (`BallLocationRing.test.tsx`, not in this plan's declared
  `files_modified`) hard-pins `BALL_MARKER_PHASES.size` to `22` — adding
  `'CORNER_KICK_CLEAR_OUT'` to that set (a required Task 2 change) grew it to `23`, breaking the
  pin.
- **Fix:** Updated the test's expected value and its descriptive title/comment to `23`,
  following the exact pattern 38-20/38-21 used for analogous "re-expect a pre-existing test
  broken by this plan's own required change" situations.
- **Files modified:** `packages/client/src/components/BallLocationRing.test.tsx`
- **Verification:** `pnpm --filter @counter-attack/client test -- BallLocationRing` — 11/11
  passed (was 10/11 before the fix, with the size-pin test as the sole failure).
- **Committed in:** `0c8adf7` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Extended the exclusion-zone filter to the `setGameState`
sticky-selection mirrors, not just `selectPiece`**

- **Found during:** Task 1, while implementing the `CORNER_KICK_REPOSITION`/
  `CORNER_KICK_FINAL_SETUP` exclusion filter
- **Issue:** The plan's action text names the filter for "the `CORNER_KICK_REPOSITION` and
  `CORNER_KICK_FINAL_SETUP` branches" without specifying `selectPiece` only. `useGameStore.ts`
  computes each phase's destination set in TWO places — `selectPiece` and the `setGameState`
  sticky-selection block that recomputes the same set across a same-phase broadcast (e.g. the
  opponent moving a piece while the local player still has one selected). Filtering only
  `selectPiece` would leave a narrow but real window where a defending piece's sticky-selected
  destination set could include an excluded-zone hex until the next explicit `selectPiece` call.
- **Fix:** Applied the identical `isWithinCornerExclusionZone` filter to both sticky-selection
  call sites (the `CORNER_KICK_REPOSITION` branch of the `FREE_MOVE_*`-family block and the
  `CORNER_KICK_FINAL_SETUP` branch of the `HIGH_PASS_MOVE`-family block), each deriving
  "defending side" from the same acting-team computation its `selectPiece` sibling uses.
- **Files modified:** `packages/client/src/store/useGameStore.ts`
- **Verification:** `pnpm --filter @counter-attack/client test -- useGameStore` — 92/92 passed
  (no existing sticky-selection test broke; no new test targets the sticky path specifically,
  since the plan's acceptance criteria only required the grep-verifiable `selectPiece`-branch
  filters, which are still present).
- **Committed in:** `a0e9d98` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 test re-expect, 1 Rule 2 correctness extension).
**Impact on plan:** Both fixes are directly caused by this plan's own required changes (not
pre-existing, out-of-scope issues) and keep the client's destination sets a strict subset of
what the server accepts, per this plan's own threat model (T-38-74). No scope creep — no file
outside this plan's stated concern area (`BallLocationRing`/`useGameStore`) was touched.

## Issues Encountered

The worktree needed a fresh `pnpm install --frozen-lockfile` plus `pnpm --filter
@counter-attack/shared build` at session start (no `node_modules`/`dist` present) — a standard
workspace-bootstrap step, not a package addition; no `package.json` changed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The clear-out step is now fully playable in the browser for both managers in turn, and the
  client never offers a destination inside the 3-hex exclusion zone anywhere in the corner
  sequence (clear-out, both goalkeeper windows, the alternating reposition window, and the
  pre-kick window) — closing the remaining client-side half of 38-15 defect 3.
- `packages/server/src/*` and `packages/shared/src/*` are unchanged by this plan (verified via
  `git diff --stat` against the pre-plan commit) — this plan builds entirely on the
  `isLegalClearOutStep`/`isWithinCornerExclusionZone`/`cornerClearOutGoalHex` helpers 38-16
  already shipped and the `applyCornerKickClearOut`/`applyCornerKickClearOutEnd` engine
  functions 38-20/38-21 already wired to the socket.
- `docs/HIGHLIGHT-REFERENCE.md`, `HexCell.tsx`, and `PieceOverlay.tsx` are unmodified (D-09
  verified via `git diff --stat`) — clear-out destinations render via the existing `safe` tint
  with no new highlight machinery.
- Full client suite: 777/777 passing (762 pre-plan baseline, +15 new tests: 6 in
  `useGameStore.test.ts`, 3 in `HexGrid.test.tsx`, 6 in `CornerKickSetupPanel.test.tsx`).
  `pnpm --filter @counter-attack/client typecheck` reports exactly the 1 pre-existing baseline
  error (`ActionLog.tsx(329,74)`, tracked in `deferred-items.md`, unrelated to this plan) — the
  second pre-existing baseline error (`GameBoard.tsx`'s missing `PHASE_LABEL` entry) is now
  resolved by this plan's own Task 2.
- No blockers for 38-24 (the human-verifier checkpoint) — a real corner sequence can now be
  played through the clear-out step, both goalkeeper windows, the reposition window, and the
  pre-kick window entirely in the browser, with no defending destination ever inside the 3-hex
  zone and every new server rejection reading as plain English.

---

_Phase: 38-corner-kick_
_Completed: 2026-08-08_

## Self-Check: PASSED

- FOUND: packages/client/src/store/useGameStore.ts
- FOUND: packages/client/src/components/HexGrid.tsx
- FOUND: packages/client/src/components/CornerKickSetupPanel.tsx
- FOUND: packages/client/src/components/GameBoard.tsx
- FOUND: packages/client/src/components/BallLocationRing.tsx
- FOUND: packages/client/src/components/BallLocationRing.test.tsx
- FOUND: packages/client/src/utils/restartErrorMessage.ts
- FOUND: packages/client/src/store/useGameStore.test.ts
- FOUND: packages/client/src/components/HexGrid.test.tsx
- FOUND: packages/client/src/components/CornerKickSetupPanel.test.tsx
- FOUND: .planning/phases/38-corner-kick/38-UI-SPEC.md
- FOUND: a0e9d98 (Task 1 commit)
- FOUND: 0c8adf7 (Task 2 commit)
- FOUND: 691b50a (Task 3 commit)
- `pnpm --filter @counter-attack/client typecheck` — exactly 1 pre-existing baseline error
  (`ActionLog.tsx(329,74)`), no new errors
- `pnpm --filter @counter-attack/client test` — 777/777 passed (30 files; 762 pre-plan baseline,
  +15 new tests)
- `git diff --stat` against the pre-plan commit confirms `packages/server/src/*`,
  `packages/shared/src/*`, `docs/HIGHLIGHT-REFERENCE.md`, `HexCell.tsx`, and `PieceOverlay.tsx`
  are all unmodified
