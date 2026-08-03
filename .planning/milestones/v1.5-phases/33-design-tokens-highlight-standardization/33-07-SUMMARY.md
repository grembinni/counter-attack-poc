---
phase: 33-design-tokens-highlight-standardization
plan: 07
subsystem: ui
tags: [react, design-tokens, color-system, documentation]

requires:
  - phase: 33-design-tokens-highlight-standardization
    provides: chrome token layer (33-01/02/03), extended HIGHLIGHT_STYLES/RING_STYLES table (33-04), grey moved-this-stage marker attempt (33-05), HexGrid consolidation + BallLocationRing (33-06)
provides:
  - docs/HIGHLIGHT-REFERENCE.md — single source-of-truth reference for the highlight/ring color system (HILITE-05)
  - BallLocationRing white ball-hex marker extended to KICK_OFF_SETUP, consistent with all other response phases (HILITE-04 follow-up)
  - Final resolution of the "already-moved" piece marker — isMovedThisStage removed entirely; the pre-existing orange-ring-+-red-X 'activated' state is the single consistent visual for "already acted," used everywhere in the game
  - Full client suite green after all Phase 33 changes; chrome-literal grep sweep confirms Phase 34 is a pure token-value swap
affects: [phase-34-palette-swap]

tech-stack:
  added: []
  patterns:
    - 'Design-doc-as-gate: docs/HIGHLIGHT-REFERENCE.md is the enforced single source of truth for every highlight/ring color literal'
    - 'Human-verify checkpoints on visual/UX treatments should stay minimal-diff and reversible — two color-treatment experiments (grey unification, contrast tweak) were cleanly revertable via git revert because each was a small, atomic, self-contained commit'

key-files:
  created:
    - docs/HIGHLIGHT-REFERENCE.md
  modified:
    - packages/client/src/components/BallLocationRing.tsx
    - packages/client/src/components/BallLocationRing.test.tsx
    - packages/client/src/components/PieceOverlay.tsx
    - packages/client/src/components/PieceOverlay.test.tsx
    - packages/client/src/components/HexGrid.tsx
    - packages/client/src/components/HexCell.tsx
    - packages/client/src/components/GameBoard.module.css
    - packages/client/src/styles/tokens.css
    - .planning/REQUIREMENTS.md

key-decisions:
  - 'Ball-hex location marker (white, BallLocationRing) extended to render during KICK_OFF_SETUP too, alongside the pre-existing gold ring="required" kicker-placement marker — both stay, they mean different things, but the ball-location cue is now visually consistent everywhere it needs to appear.'
  - "The isMovedThisStage grey 'already-moved-this-stage' mechanism (originally from Plan 33-05, recoloring a free-kick-only green marker to grey) was removed entirely after two rounds of human-verify feedback rejected it — first as a broad grey-everywhere unification, then even with improved contrast. The existing orange-ring-+-red-X 'activated' selectionState, already distinct from the green 'active' ring, now covers every already-acted case app-wide (MOVE, HIGH_PASS_MOVE, GK_KICK_MOVE, FREE_MOVE_ATTACK/DEFENSE, SNAPSHOT_DEFLECT, FIRST_TIME_PASS_MOVE, FREE_KICK_SETUP) with zero one-off styling variants, matching this phase's actual goal of consistency over introducing new visual language."
  - "HILITE-03 traceability updated to reflect the final resolution: the requirement's original premise (a separate already-moved-this-stage ring) no longer exists in the codebase; distinctness between 'active' and 'already acted' piece states is satisfied by the pre-existing green/orange color difference."

patterns-established:
  - "When a phase's own checkpoint surfaces a design gap (like isMovedThisStage's inconsistent 'this only applies in FREE_KICK_SETUP' scoping), prefer removing one-off mechanisms over patching them, when the phase's stated goal is consistency."

requirements-completed: [HILITE-05]

duration: 3h40m
completed: 2026-07-25
---

# Phase 33: Design Tokens & Highlight Standardization — Plan 07 (Phase Gate) Summary

**Closed out Phase 33 with the single highlight/ring reference doc, a full-suite verification gate, and — after two rounds of human-verify iteration on the "already-moved" piece marker — landed on removing the one-off grey mechanism entirely in favor of the single pre-existing orange-ring-+-red-X treatment used consistently everywhere.**

## Performance

- **Duration:** ~3h40m (includes iterative human-verify checkpoint cycles)
- **Started:** 2026-07-25 14:49:59 -0500
- **Completed:** 2026-07-25 18:28:05 -0500
- **Tasks:** 3/3 (Task 3's human-verify checkpoint went through 3 iteration rounds before final approval)
- **Files modified:** 9 across all commits in this plan

## Accomplishments

- Wrote `docs/HIGHLIGHT-REFERENCE.md` — the single source-of-truth reference for all three highlight/ring mechanisms (hex tints, piece/hex rings, standalone overlays), satisfying HILITE-05.
- Full client suite verified green (407/407 final), chrome-literal grep sweep confirms Phase 34 will be a pure token-value swap.
- Fixed a real cross-phase consistency gap: the ball's hex now gets the same white location marker during `KICK_OFF_SETUP` as it does in every other response phase (HEADER, SNAPSHOT, SHOT, GK\_\*), alongside the unrelated gold "required kicker placement" ring.
- Resolved a genuine ambiguity in the "already-moved" piece marker through direct human-verify iteration: started with an app-wide grey unification (retiring the pre-existing orange+X), then a contrast improvement pass, then a full revert back to orange+X after the grey didn't read well, and finally removed the separate `isMovedThisStage` grey mechanism entirely as a one-off styling variant inconsistent with the phase's actual consistency goal. Net result: a single `activated` (orange ring + red X) visual now covers every already-acted piece everywhere in the game.
- BUG-23 (stale KICK_OFF_SETUP shot-path shading) repro check: reviewer approved the full checkpoint (steps 1-9 including the BUG-23 repro) with no issues reported.

## Task Commits

Each task was committed atomically (Task 3's checkpoint iteration spans several fix/revert commits):

1. **Task 1: Write docs/HIGHLIGHT-REFERENCE.md** - `be78e1e` (docs)
2. **Task 2: Full-suite green + chrome-literal grep sweep** - `6f8bba4` (fix — closed a last raw-literal gap in `GameBoard.module.css` found during the sweep)
3. **Task 3: Human visual + BUG-23 verification** (iterative — see below):
   - `bee1fdb` (fix) — extend `BallLocationRing` white marker to `KICK_OFF_SETUP` (Issue A)
   - `1307bf7` (fix) — unify `activated` to grey, retire orange+X and `isMovedThisStage` (Issue B, round 1)
   - `add5ab5` (docs) — update HIGHLIGHT-REFERENCE.md for both fixes
   - `f0b57a5` (fix) — increase grey ring/overlay contrast (human-verify feedback: didn't stand out enough)
   - `2f34734` (revert) — reverts `f0b57a5` and `1307bf7`: grey/opaque treatment didn't read well in practice, restore orange+X
   - `3ca6add` (fix) — remove `isMovedThisStage` entirely: human-verify feedback identified it as a one-off styling variant inconsistent with the phase's consistency goal

**Plan metadata:** this commit (docs: create plan 07 summary)

## Files Created/Modified

- `docs/HIGHLIGHT-REFERENCE.md` - Single source-of-truth reference for the highlight/ring color system; documents hex tints, piece/hex rings, and the standalone ball-location overlay
- `packages/client/src/components/BallLocationRing.tsx` - `BALL_MARKER_PHASES` extended to include `KICK_OFF_SETUP`
- `packages/client/src/components/BallLocationRing.test.tsx` - Updated to assert the marker renders during `KICK_OFF_SETUP`
- `packages/client/src/components/PieceOverlay.tsx` - `isMovedThisStage` prop, rendering layer, and grey constants removed entirely; `activated` selectionState (orange ring + red X) is the sole "already acted" visual
- `packages/client/src/components/PieceOverlay.test.tsx` - `isMovedThisStage` test suite removed; `activated` tests unchanged (orange+X)
- `packages/client/src/components/HexGrid.tsx` - Removed the `isMovedThisStage={false}` prop pass to `PieceOverlay`
- `packages/client/src/components/HexCell.tsx` - Stale `isMovedThisStage` comment references updated
- `packages/client/src/components/GameBoard.module.css` - Closed last raw-literal gap found by the Task 2 grep sweep
- `packages/client/src/styles/tokens.css` - `--color-divider-subtle` token added for the GameBoard fix
- `.planning/REQUIREMENTS.md` - HILITE-03 traceability updated to reflect the final resolution (mechanism removed, distinctness satisfied by pre-existing colors)

## Human Verification (Task 3)

**Checkpoint type:** human-verify (blocking)
**Iterations:** 3 rounds before approval — the ball-marker fix (Issue A) was approved on the first pass; the "already-moved" marker (Issue B) went through unify-to-grey → contrast-improve → revert-to-orange → remove-mechanism-entirely before the reviewer approved the final state.
**Final result:** Reviewer typed "approved" after reviewing the updated checklist (deep-blue theme unchanged, purple goal-target, red offside-only, white ball marker consistent across KICK_OFF_SETUP and response phases, orange+X consistent for all already-acted pieces, grep sweep confirmed clean). BUG-23 repro was included in the approved checklist with no issue reported.

## Self-Check: PASSED

- [x] `docs/HIGHLIGHT-REFERENCE.md` exists, covers all three color mechanisms, reflects final shipped state (not stale grey-unification history)
- [x] `pnpm --filter @counter-attack/client test` — 407/407 passing
- [x] `pnpm --filter @counter-attack/client typecheck` — clean
- [x] `pnpm --filter @counter-attack/client build` — clean
- [x] Chrome-literal grep sweep — only intentional exclusions remain
- [x] Human checkpoint approved
- [x] No `isMovedThisStage` references remain anywhere in `packages/client/src`
