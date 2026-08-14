---
phase: 39-fouls-cards-injuries-penalty-kicks
plan: 09
subsystem: ui
tags: [react, typescript, css-modules, zustand]

# Dependency graph
requires:
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: 'Plan 39-01 shared GamePhase/GameState/ActionEvent contract (FOUL_CHOICE, GK_DIVE_AT_FEET_PROMPT, GK_BOX_ENTRY_PROMPT, GK_BOX_ENTRY_MOVE phases; foulSource/foulVictimId/gkDiveAtFeetTeam/gkDiveAtFeetCarrierId/gkDiveAtFeetDistance/gkBoxEntryTeam fields)'
  - phase: 39-fouls-cards-injuries-penalty-kicks
    provides: 'Plan 39-05 store emitters (emitFoulChoice, emitGkDiveAtFeet, emitGkBoxEntryResponse) and selection wiring these panels build against'
provides:
  - 'FoulChoicePanel — FOUL-03 two-button continue-or-restart decision panel with the GKDIVE-03 conditional "Take the Penalty" restart label'
  - 'GkDiveAtFeetPromptPanel — GKDIVE-02 Dive/Decline interrupt prompt with the distance===3 dice-penalty qualifier'
  - 'GkBoxEntryPromptPanel — D-10/D-11 Reposition/Decline prompt covering both GK_BOX_ENTRY_PROMPT (buttons) and GK_BOX_ENTRY_MOVE (buttonless, board-click input)'
  - 'Three component test suites (28 assertions) regression-locking all three panels'
affects: [39-16]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'FoulChoicePanel established as the template for GkDiveAtFeetPromptPanel/GkBoxEntryPromptPanel — identical panel shape (helperBlock/helperLine1/helperLine2 two-line title+detail, co-equal un-coloured ctaButton pair, no container border), differing only in phase guard, copy, and emitter'
    - 'One-module-per-component CSS convention preserved — each panel gets its own verbatim-copied .module.css rather than sharing one module across the three near-identical panels'

key-files:
  created:
    - packages/client/src/components/FoulChoicePanel.tsx
    - packages/client/src/components/FoulChoicePanel.module.css
    - packages/client/src/components/FoulChoicePanel.test.tsx
    - packages/client/src/components/GkDiveAtFeetPromptPanel.tsx
    - packages/client/src/components/GkDiveAtFeetPromptPanel.module.css
    - packages/client/src/components/GkDiveAtFeetPromptPanel.test.tsx
    - packages/client/src/components/GkBoxEntryPromptPanel.tsx
    - packages/client/src/components/GkBoxEntryPromptPanel.module.css
    - packages/client/src/components/GkBoxEntryPromptPanel.test.tsx
  modified: []

key-decisions:
  - 'The "deciding team" for each panel is read directly off its own GameState field (attackingTeam for FoulChoicePanel since the engine reassigns it to the fouled side; gkDiveAtFeetTeam/gkBoxEntryTeam for the two GK prompts) rather than derived — matches the plan-cited selectors from Plan 39-05'
  - 'Waiting-state "Attacking"/"Defending" side labels are computed relative to attackingTeam (decidingTeam === attackingTeam ? "Attacking" : "Defending"), mirroring ActionPanel.tsx"s actingSideLabel pattern exactly rather than inventing a new label scheme'
  - 'Player names (victim/carrier) resolve through the pieces array with a raw-id fallback only when the piece is missing (never renders "undefined") — mirrors ActionLog.tsx"s pieceName() convention'
  - 'GK_BOX_ENTRY_MOVE renders zero buttons for both the acting and waiting manager — the board click is the input, deferred to Plan 39-16'

patterns-established: []

requirements-completed: [FOUL-03, GKDIVE-02, GKDIVE-03]

# Metrics
duration: ~35min
completed: 2026-08-14
---

# Phase 39 Plan 9: Foul/GK-Interrupt Decision Panels Summary

**Three near-identical two-button decision panels (FoulChoicePanel, GkDiveAtFeetPromptPanel, GkBoxEntryPromptPanel) built to the Phase 35 panel-family convention, covering the FOUL-03 continue-or-restart choice, the GKDIVE-02 dive-at-feet duel offer with its GKDIVE-03 conditional penalty-restart label, and the D-10 box-entry goalkeeper reposition offer including its buttonless GK_BOX_ENTRY_MOVE follow-on state.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 9 (all created)

## Accomplishments

- `FoulChoicePanel.tsx` — gated on `phase === 'FOUL_CHOICE'`; deciding manager is `attackingTeam` (the engine reassigns this to the fouled side on foul); renders `Foul!` heading, victim-name detail line, and two co-equal buttons (`Continue Play` / `Take the Free Kick`, the latter switching to `Take the Penalty` when `foulSource === 'GK_DIVE_AT_FEET'` while still emitting `'restart'`); non-deciding manager sees a waiting message; no confirmation modal for the irreversible choice, per UI-SPEC.
- `GkDiveAtFeetPromptPanel.tsx` — gated on `phase === 'GK_DIVE_AT_FEET_PROMPT'`; deciding manager is `gkDiveAtFeetTeam`; renders `Dive at Feet?` heading, carrier-name detail line with the `−1 dice penalty at this range` qualifier appended only when `gkDiveAtFeetDistance === 3`, and `Dive`/`Decline` buttons.
- `GkBoxEntryPromptPanel.tsx` — covers both `GK_BOX_ENTRY_PROMPT` (deciding manager sees `Goalkeeper Reposition?` heading, the locked detail line, and `Reposition`/`Decline` buttons) and `GK_BOX_ENTRY_MOVE` (acting manager sees `Select an adjacent hex for your goalkeeper.` with zero buttons; the other manager sees a waiting message, also zero buttons — the board click is the input, wired in Plan 39-16).
- All three CSS modules follow the Phase 35 convention verbatim: `.panel` has no `border` declaration, spacing uses only 4/8px (the `xs`/`sm` scale), typography uses only 11/12px, and CTA buttons are co-equal/un-coloured (no `ctaButtonReady`/`ctaButtonPending`).
- 28 component-test assertions across the three files; full client suite (860 tests) green; `pnpm build` and `pnpm stylelint` both exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: FoulChoicePanel — the FOUL-03 continue-or-restart decision** - `758826a` (feat)
2. **Task 2: GkDiveAtFeetPromptPanel and GkBoxEntryPromptPanel** - `ca83fc3` (feat)
3. **Task 3: Component tests for all three prompt panels** - `90fe7dd` (test)

_No plan-metadata commit yet — this worktree agent does not update STATE.md/ROADMAP.md; the orchestrator commits shared docs after the wave completes._

## Files Created/Modified

- `packages/client/src/components/FoulChoicePanel.tsx` - FOUL-03 two-button continue/restart panel
- `packages/client/src/components/FoulChoicePanel.module.css` - Phase 35 panel-family CSS (no border, 4/8px spacing, 11/12px typography)
- `packages/client/src/components/FoulChoicePanel.test.tsx` - 9 assertions: phase gating, deciding/waiting copy, both emitters, GKDIVE-03 label+payload, raw-id fallback, humanised error
- `packages/client/src/components/GkDiveAtFeetPromptPanel.tsx` - GKDIVE-02 dive interrupt prompt
- `packages/client/src/components/GkDiveAtFeetPromptPanel.module.css` - verbatim copy of FoulChoicePanel's CSS module
- `packages/client/src/components/GkDiveAtFeetPromptPanel.test.tsx` - 10 assertions: phase gating, deciding/waiting copy, both emitters, distance===3 qualifier present/absent
- `packages/client/src/components/GkBoxEntryPromptPanel.tsx` - D-10 box-entry goalkeeper reposition prompt covering both GK_BOX_ENTRY_PROMPT and GK_BOX_ENTRY_MOVE
- `packages/client/src/components/GkBoxEntryPromptPanel.module.css` - verbatim copy of FoulChoicePanel's CSS module
- `packages/client/src/components/GkBoxEntryPromptPanel.test.tsx` - 9 assertions: phase gating across both phases, both emitters, zero-button GK_BOX_ENTRY_MOVE for both managers

## Decisions Made

- Deciding/acting team for each panel is read directly off its dedicated GameState field (`attackingTeam`, `gkDiveAtFeetTeam`, `gkBoxEntryTeam`) rather than re-derived, per the plan's explicit selector guidance.
- Waiting-state "Attacking"/"Defending" labels computed as `decidingTeam === attackingTeam ? 'Attacking' : 'Defending'`, mirroring `ActionPanel.tsx`'s existing `actingSideLabel` pattern rather than introducing a new labeling convention.
- Player-name resolution mirrors `ActionLog.tsx`'s `pieceName()` helper inline at each call site (piece found → `firstName [lastName]`; piece missing → raw id; never `undefined`).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Fresh worktree had no `node_modules` and no built `packages/shared` output — ran `pnpm install --frozen-lockfile` and `pnpm build` once before typecheck/test/stylelint would resolve `@counter-attack/shared` correctly. Not a plan deviation; a one-time worktree setup step (also noted in Plans 39-01/39-05's summaries).
- The session was interrupted mid-task by a usage limit after Task 2's files were written but before Task 2's CSS module/verification/commit completed. Resumed from the untracked working-tree files exactly as instructed: re-verified typecheck/stylelint, then proceeded through Task 2's commit, Task 3, and this summary with no rework.
- The repo's pre-commit hook (`lint-staged` running `eslint --fix` + `prettier --write`) took longer than the default 2-minute Bash timeout on the first two commit attempts for Task 1, each time creating an automatic lint-staged backup stash entry (a tool-internal safety mechanism, not a manual `git stash` invocation) before timing out with the working tree left in a consistent staged state. The third attempt, run with an extended timeout, completed successfully. No files were lost; the lint-staged backup stashes were left untouched per the destructive-git-operations prohibition (not created or managed by this agent).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three prompt panels are complete, tested, and ready for phase dispatch — Plan 39-16's scope is wiring them into `GameBoard.tsx`'s phase-dispatch table and adding `HexGrid.tsx`'s `GK_BOX_ENTRY_MOVE` board-click handler (`emitGkBoxEntryMove`), neither of which this plan touches.
- No blockers. Full client test suite (860 tests), `pnpm build`, and `pnpm stylelint` all green.

---

_Phase: 39-fouls-cards-injuries-penalty-kicks_
_Completed: 2026-08-14_

## Self-Check: PASSED

- FOUND: 758826a, ca83fc3, 90fe7dd (all task commits present in `git log --oneline --all`)
- FOUND: `packages/client/src/components/FoulChoicePanel.tsx` contains `Continue Play`
- FOUND: `packages/client/src/components/GkDiveAtFeetPromptPanel.tsx` contains `Dive at Feet?`
- FOUND: `packages/client/src/components/GkBoxEntryPromptPanel.tsx` contains `Goalkeeper Reposition?`
- FOUND: `.planning/phases/39-fouls-cards-injuries-penalty-kicks/39-09-SUMMARY.md`
