---
phase: 42-substitution-ux-overhaul
plan: 07
subsystem: ui
tags: [drag-and-drop, react, lineup-screen, substitution-ux, roster-reposition]

requires:
  - phase: 42-substitution-ux-overhaul (plan 06)
    provides: 'GAME_ROSTER_REPOSITION client event, applyRosterReposition engine function, socket handler, and rejection reasons (INVALID_REPOSITION, GK_SLOT_LOCKED, REPOSITION_BALL_CARRIER, WRONG_PHASE) this UI wires against'
provides:
  - "MidmatchSubMode ('reposition'|'substitute') mode state, defaulting to positioning mode (SUB-08)"
  - 'MidmatchDragState union replacing the old bench-only drag id, and midmatchDraggable prop threaded through LineupStatCard'
  - 'onReposition/actionPending Props consumed by LineupAssignmentScreen (parent wiring deferred to 42-09)'
  - 'Two structurally separate drop handlers: handleMidmatchRepositionDrop and handleMidmatchSubstituteDrop'
  - 'SENT OFF vacated-slot placeholder for red-carded on-pitch pieces (SUB-18/D-05/D-06)'
  - 'Substitute/Cancel mode-toggle button (.subModeButton) gated on MAX_SUBS_PER_TEAM/readOnly'
affects: [42-08, 42-09]

tech-stack:
  added: []
  patterns:
    - 'Two coexisting interaction modes on one screen share visual chrome but keep
      fully separate guard bodies per drop handler (Pitfall 5) — dispatch is a
      single ternary at the top of onDrop, never a mode branch inside a shared
      guard chain.'
    - 'midmatchDraggable is parent-computed and passed down as a plain boolean prop
      — LineupStatCard itself stays dumb and never re-derives eligibility.'
    - "The SENT OFF placeholder mirrors the draft branch's empty-slot pattern (a
      plain div with the same drag wiring, composes: statCardBase for footprint
      parity) rather than a conditional inside LineupStatCard."

key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.tsx
    - packages/client/src/components/LineupAssignmentScreen.module.css
    - packages/client/src/components/LineupAssignmentScreen.test.tsx
    - packages/client/src/components/GameBoard.test.tsx

key-decisions:
  - "midmatchDraggable's GK-lock clause checks both role === 'GK' and a parsed
    slot-index of 0 (via the same /-(\\d+)$/ parse already used for column
    grouping), mirroring applyRosterReposition's GK_SLOT_LOCKED guard exactly so
    a card can never look draggable and then be server-rejected."
  - 'Reposition-mode drops fire onReposition synchronously with no confirm popup
    (D-02) — a deliberate asymmetry with substitution mode, since a reposition is
    free/reversible while a substitution consumes a capped resource.'
  - 'A red-carded piece is never rendered as a LineupStatCard in mid-match mode
    (SUB-18) — it renders a non-draggable SENT OFF placeholder that keeps the
    exact same drop wiring, so another on-field player can still be repositioned
    into the vacated slot (D-05). isSubBlocked is left in place on the (now
    unreachable for these pieces) card path as a defensive second gate, per plan
    instruction — not deleted.'
  - "5 pre-existing tests (4 in LineupAssignmentScreen.test.tsx, 2 in
    GameBoard.test.tsx) broke as a direct, deliberate consequence of flipping the
    mid-match panel's default mode to positioning — all fixed with documented
    old/new expectations rather than left red or silently patched around (see
    Deviations)."

requirements-completed: [SUB-08, SUB-09, SUB-10, SUB-11, SUB-12, SUB-18]

duration: ~25min
completed: 2026-08-22
---

# Phase 42 Plan 07: Mid-match Positioning Mode + Substitution Mode Coexistence Summary

**`LineupAssignmentScreen.tsx`'s mid-match branch now has two coexisting drag-and-drop modes on one screen — a default positioning mode with on-field drag-to-swap firing `onReposition`, and an explicit substitution mode entered via a Substitute/Cancel toggle button — with a red-carded slot rendering a droppable SENT OFF placeholder and every Phase 40 substitution guard proven unchanged under both modes.**

## Performance

- **Duration:** ~25 min (includes ~3 min fresh-worktree `pnpm install --frozen-lockfile` + `packages/shared` build, not attributable to plan work)
- **Tasks:** 3 (as planned)
- **Files modified:** 4 (3 planned in `files_modified` + `GameBoard.test.tsx`, an out-of-plan but in-scope consequential fix — see Deviations)

## Accomplishments

- **Task 1 — Mode state, 3-way draggability, mode-toggle button, bench gating:** Added `MidmatchSubMode` (`'reposition' | 'substitute'`, module scope) defaulting to `'reposition'` (SUB-08), and unified the old single-purpose bench-only drag id into one `MidmatchDragState` union (`{source:'pitch'|'bench', ...}`) matching the file's existing `DragState` convention. `LineupStatCard` gained a `midmatchDraggable?: boolean` prop; its `isDraggable` derivation is now a genuine three-way split (pregame / midmatch-reposition / midmatch-substitute) instead of the old hardcoded `isMidmatch ? false`. The parent computes `midmatchDraggable` per piece in `renderMidmatchColumn`: `reposition mode && !readOnly && !actionPending && isActivePiece(piece) && slotIndex !== 0 && role !== 'GK'` — the two GK clauses mirror `applyRosterReposition`'s `GK_SLOT_LOCKED` guard exactly. Added the `Substitute`/`Cancel` mode-toggle button (`.subModeButton`, copying `ActionPanel`'s `.ctaButton` treatment verbatim), disabled at `MAX_SUBS_PER_TEAM` or `readOnly`. Bench cards are now inert in positioning mode (`BenchCarousel`'s `disabled` prop and `onCardDragStart` both gate on `subMode === 'substitute'`). Helper copy is now three-way (readOnly / reposition / substitute), and the `gameError` effect gained `INVALID_REPOSITION`/`REPOSITION_BALL_CARRIER` rejection strings (reusing `GK_SLOT_LOCKED`/`WRONG_PHASE` verbatim, deliberately omitting `WRONG_TEAM` per plan instruction).
- **Task 2 — Separate drop handlers + SENT OFF placeholder:** Extracted `handleMidmatchRepositionDrop` and `handleMidmatchSubstituteDrop` as two named functions sharing no guard body (Pitfall 5 hard constraint, verified by grep in acceptance criteria) — the card's `onDrop` dispatches between them purely on `subMode`, at the top of the callback and nowhere else. Added `handleMidmatchDragStart` for pitch-sourced drags. `onDragOver` now only marks a card as the hovered drop target when a drop there would actually be legal in the current mode, so the gold ring never appears on an illegal reposition target. A container-level `onDragEnd` on the mid-match `.screen` div clears drag state after any gesture completes (T-42-32), mirroring the draft branch's existing cleanup. Added the SENT OFF vacated-slot placeholder (SUB-18/D-05/D-06): a piece failing `isActivePiece` renders a non-draggable, dashed-border placeholder (`.statCardSentOff`, `composes: statCardBase` for footprint parity) with a `SENT OFF` badge and `aria-label="Sent off — slot empty"`, `role="img"` — but keeps the same `onDragOver`/`onDragLeave`/`onDrop` wiring, so another on-field player can still be repositioned into the vacated slot. The pre-existing `isSubBlocked` guard is left in place (now unreachable for these pieces) as a defensive second gate, per plan instruction.
- **Task 3 — Test matrix:** Added a `describe('Phase 42 — midmatch positioning mode', ...)` block covering all 15 numbered scenarios from the plan (default copy/button, reposition drag/drop including self-drop/`actionPending`/`readOnly`/bench-inert/GK-lock, the mode toggle including the cap and `readOnly` disabling entry, and the SENT OFF slot's render/reposition-target/non-draggable behavior) plus a 4-row mode-coexistence regression matrix proving the 3-sub cap, red-card `isSubBlocked` exclusion, `subbedOut` bench exclusion, and `readOnly` guard all behave identically in substitution mode while positioning mode never reaches them — 19 new `it(...)` blocks, each row naming its SUB-0X requirement.
- Full client suite: 1081/1081 passing (up from the pre-plan baseline). `pnpm --filter @counter-attack/client typecheck` clean except the pre-existing, documented 42-06 `ActionLog.tsx` exhaustiveness gap (out of this plan's scope). `eslint`/`stylelint`/`check-contrast` all clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mode state, 3-way draggability branch, mode-toggle button and bench gating** - `85fd570` (feat)
2. **Task 2: Separate reposition drop handler and the SENT OFF vacated-slot placeholder** - `6600abf` (feat)
3. **Task 3: Positioning-mode and mode-coexistence tests** - `c5a070b` (test)

**Plan metadata:** SUMMARY commit handled per worktree isolation (this file is committed separately by the executor per the worktree protocol).

## Files Created/Modified

- `packages/client/src/components/LineupAssignmentScreen.tsx` — `MidmatchSubMode`/`MidmatchDragState` types, `onReposition`/`actionPending` props, `midmatchDraggable` derivation, mode-toggle button, two named drop handlers, SENT OFF placeholder
- `packages/client/src/components/LineupAssignmentScreen.module.css` — `.subModeButton`, `.statCardSentOff`, `.sentOffBadge`
- `packages/client/src/components/LineupAssignmentScreen.test.tsx` — 19 new tests (Phase 42 positioning-mode/coexistence matrix) + 4 fixed pre-existing tests
- `packages/client/src/components/GameBoard.test.tsx` — 2 fixed pre-existing assertions (default helper copy changed)

## Final Props/Handler Shapes

```ts
onReposition?: (pieceIdA: string, pieceIdB: string) => void;
actionPending?: boolean;

function handleMidmatchRepositionDrop(e: React.DragEvent<HTMLDivElement>, targetPieceId: string): void;
function handleMidmatchSubstituteDrop(e: React.DragEvent<HTMLDivElement>, targetPieceId: string, isBlocked: boolean): void;
function handleMidmatchDragStart(e: React.DragEvent<HTMLDivElement>, pieceId: string): void;
```

## Decisions Made

- `midmatchDraggable`'s GK-lock clause checks both `role === 'GK'` and a parsed slot-index of 0, mirroring `applyRosterReposition`'s `GK_SLOT_LOCKED` guard exactly — reusing the existing `/-(\d+)$/` slot-index parse already present in the mid-match column-grouping code rather than adding a second parse implementation.
- Reposition-mode drops fire `onReposition` synchronously with no confirm popup (D-02) — deliberate asymmetry with substitution mode.
- A red-carded piece is never rendered as a `LineupStatCard` in mid-match mode (SUB-18); it renders the SENT OFF placeholder with identical drop wiring so D-05 (droppable vacated slot) holds. `isSubBlocked` is left in place as a defensive second gate, not deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 5 pre-existing tests broke as a direct, deliberate consequence of the mode-default change, beyond the single exception the plan named**

- **Found during:** Task 1's and Task 2's verification passes (discovered incrementally; consolidated into Task 3's commit per the plan's own instruction that test-file fixes belong to Task 3)
- **Issue:** The plan's Task 3 explicitly named ONE test as an authorized exception to update ("SUB-02: on-pitch cards are never draggable in mid-match mode" — SUB-08 deliberately changes this). In practice, flipping the mid-match panel's default mode from implicit-substitution to explicit positioning broke 4 additional tests that were not individually enumerated in the plan text: (a) a bench-drag-to-substitute test that assumed substitution worked immediately without first entering substitution mode, (b) a redCarded-target test that located its drop target via the piece's own name (now hidden entirely behind the SUB-18 SENT OFF placeholder), (c) an ICON-02 test asserting a red card glyph on a mid-match on-pitch red-carded piece (that piece no longer renders as a card at all in mid-match mode), and (d) a readOnly-false "normal drag CTA" test asserting the old substitution-mode helper copy as the default. Two further assertions in `GameBoard.test.tsx` (outside this plan's declared `files_modified`) also asserted the old default substitution-mode copy.
- **Fix:** Updated each test to reflect the new, deliberate mode-default behavior — never deleting an existing `it(...)` block, only adjusting setup (e.g., clicking "Enter substitution mode" first) or the located target (SENT OFF placeholder instead of the piece's name) while preserving each test's original intent and (where unchanged) its original expected outcome. Each modified test carries an inline comment documenting its old and new expectation, and is enumerated here per Task 3's acceptance criteria ("any modified pre-existing test is named in the summary with its old and new expectation").
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.test.tsx` (4 tests), `packages/client/src/components/GameBoard.test.tsx` (2 assertions, out-of-plan file — fixed because the plan's own verification section requires "full client suite green")
- **Verification:** Full client suite (1081 tests) green; each fixed test's new expectation independently re-derived from the plan's own specified behavior (SUB-08/SUB-18), not adjusted to merely make it pass.
- **Committed in:** `c5a070b` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed group (5 tests across 2 files, all Rule 1 — consequential test fixes for a deliberate, plan-specified behavior change)
**Impact on plan:** None beyond the expected transient red state between Task 1/2's commits and Task 3's test-fix commit, which the plan's own task structure anticipates (Task 1/2 verification does not gate on the full test suite; only Task 3 does). No scope creep — every fix traces directly to SUB-08/SUB-18's specified new behavior.

## Issues Encountered

- Fresh worktree had no `node_modules` and `packages/shared` had no built `dist/` output (same pattern as prior Phase 42 worktrees). Ran `pnpm install --frozen-lockfile` then `pnpm --filter @counter-attack/shared build` before any verification command could succeed. Not a plan deviation — infrastructure setup only.
- Task 1's and Task 2's own acceptance criteria/verify commands do not run the full `LineupAssignmentScreen` test suite (Task 1 lists it but the plan's own Task 3 explicitly anticipates and authorizes the resulting transient failures; Task 2's verify command is typecheck+stylelint only) — this made the actual commit sequence internally consistent once Task 3 arrived, despite an apparent tension in Task 1's stated acceptance criteria (see Deviations).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `onReposition`/`actionPending` props exist end-to-end on `LineupAssignmentScreen` and are fully exercised by this plan's own inline reposition-drop logic — 42-09 only needs to wire the parent (`GameBoard.tsx`) to pass real callbacks/state (`GAME_ROSTER_REPOSITION` emit, `selectedPieceId !== null`), not touch this component's internals.
- Both interaction modes are fully reachable and tested; the SENT OFF placeholder is proven droppable for repositioning (D-05) and non-draggable as a source (T-42-31).
- Substitution mode's guards are byte-for-byte unchanged from Phase 40 (`handleMidmatchSubstituteDrop` is a verbatim extraction) — 42-08 can build on top of this without re-verifying Phase 40 substitution correctness.
- No blockers. Full client suite (1081 tests) green; typecheck clean except the pre-existing, out-of-scope `ActionLog.tsx` gap (42-06); eslint/stylelint/check-contrast all clean.

## Self-Check: PASSED

- FOUND: `packages/client/src/components/LineupAssignmentScreen.tsx`
- FOUND: `packages/client/src/components/LineupAssignmentScreen.module.css`
- FOUND: `packages/client/src/components/LineupAssignmentScreen.test.tsx`
- FOUND: `packages/client/src/components/GameBoard.test.tsx`
- FOUND commit `85fd570` (Task 1)
- FOUND commit `6600abf` (Task 2)
- FOUND commit `c5a070b` (Task 3)

---

_Phase: 42-substitution-ux-overhaul_
_Completed: 2026-08-22_
