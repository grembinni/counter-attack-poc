---
phase: 47-select-based-roster-interaction
plan: 01
subsystem: ui
tags: [react, css-modules, click-select, draft-mode, accessibility]

# Dependency graph
requires: []
provides:
  - "LineupAssignmentScreen.module.css .statCardSelected (green #22c55e) / .statCardEligible (blue #60a5fa) selection classes, declared last in the file for cascade-order precedence"
  - "DraftCardBody click/selection prop contract: interactive/onClick/isSelected/isEligibleTarget, data-roster-card + data-interactive DOM locators"
  - "DraftPackCarousel onCardClick/selectedCardId contract replacing onCardDragStart"
  - "Click-select keyboard affordance idiom (role=button/tabIndex=0/onKeyDown Enter+Space) for card components"
affects: ["47-02", "47-03 (LineupAssignmentScreen.tsx port, currently typecheck-broken against the new DraftPackCarouselProps)", "47 BenchCarousel plan (same interactive/isSelected/isEligibleTarget contract expected)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Selection classes declared last in a CSS Module file so cascade order (not composed-class order) determines which border/box-shadow wins against every other border-declaring card class"
    - "PieceOverlay.tsx's click-gating idiom ported to DOM cards: onClick/role/tabIndex/onKeyDown all conditionally omitted (not set to no-ops) when a card is neither interactive nor an eligible target"
    - "data-roster-card (always present) + data-interactive (true/false) as the stable click-select DOM locator pair replacing [draggable]"

key-files:
  created: []
  modified:
    - packages/client/src/components/LineupAssignmentScreen.module.css
    - packages/client/src/components/DraftPackCarousel.tsx
    - packages/client/src/components/DraftPackCarousel.test.tsx

key-decisions:
  - "Selection/eligible-target colors (#22c55e / #60a5fa) kept as CSS literals per 47-UI-SPEC.md's explicit design decision, with scoped stylelint-disable comments — tokens.css's own header excludes highlight/ring colors from its scope (D-07) and tokens.css is not in this plan's files_modified list, so promoting these values to tokens.css tokens would be an out-of-scope file change"
  - "Task 1 acceptance criteria's literal 'grep -c not-allowed returns 0' check was not fully satisfied — two pre-existing, unrelated not-allowed usages remain (.confirmButton not-ready state, .cardUnavailable dimmed OUT/RED CARD treatment), neither mentioned in the task's action text or in scope for the drag-to-click conversion"

requirements-completed: [ROSTER-01, ROSTER-02, ROSTER-06, ROSTER-08]

# Metrics
duration: 35min
completed: 2026-08-30
---

# Phase 47 Plan 01: Selection CSS + DraftPackCarousel Click Contract Summary

**Two new green/blue card-selection CSS classes value-matched to the pitch's `PieceOverlay` ring tokens, plus a full drag-to-click-select rewrite of `DraftCardBody`/`DraftPackCarousel` (props, DOM locators, keyboard affordance) with a fully click-based test rewrite.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 completed
- **Files modified:** 3

## Accomplishments
- `LineupAssignmentScreen.module.css`: removed all three drag-state classes (`.statCardDragging`, `.statCardDropTarget`, `.statCardSubTarget`), added `.statCardSelected`/`.statCardEligible` declared last in the file (cascade-order load-bearing per the task's own explanation of why the old gold drop-target border never rendered on the SENT OFF placeholder)
- `DraftCardBody`/`DraftPackCarousel`: full prop-contract rewrite from `draggable`/`onDragStart`/`onDragOver`/`onDrop`/`onCardDragStart` to `interactive`/`onClick`/`isSelected`/`isEligibleTarget`/`onCardClick`/`selectedCardId`, with `data-roster-card`/`data-interactive` DOM locators and keyboard (Enter/Space) activation on clickable cards
- `DraftPackCarousel.test.tsx`: fully click-based rewrite — preserved every pre-existing behavioral assertion (tier sort, card count, tier-border classes, nav wiring) and replaced drag-specific tests with click/keyboard/selection-class assertions; 9/9 tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace drag-state CSS classes with the two selection classes** - `c900a9bd` (feat)
2. **Task 2: Convert DraftCardBody and DraftPackCarousel to a click-select contract** - `d6bc5859` (feat)
3. **Task 3: Rewrite DraftPackCarousel.test.tsx for the click contract** - `e6ba13f8` (test)

_Note: no plan-metadata commit — worktree mode excludes STATE.md/ROADMAP.md updates; the orchestrator handles those centrally after merge._

## Files Created/Modified
- `packages/client/src/components/LineupAssignmentScreen.module.css` - Drag-state classes removed; `.statCardSelected`/`.statCardEligible` added at end of file; `.statCard` cursor `grab`→`pointer`; `.statCardSubBlocked` cursor `not-allowed`→`default`
- `packages/client/src/components/DraftPackCarousel.tsx` - `DraftCardBody`/`DraftPackCarousel` converted to click-select prop contract; `handleDragStart` and all dataTransfer plumbing deleted; module/function doc comments updated from drag to click-select semantics
- `packages/client/src/components/DraftPackCarousel.test.tsx` - Fully rewritten for click-based interaction; added disabled-click-suppression, selected-class, and Enter-keydown coverage

## Decisions Made
- Kept the two new selection colors as CSS literals (not `var(--token)`) with scoped `stylelint-disable-next-line` comments on exactly those two declarations, rather than adding new `tokens.css` custom properties. Rationale: `tokens.css`'s own header comment explicitly scopes it to chrome (non-pitch, non-highlight) colors and states highlight/ring colors belong in `HexCell.tsx`/`PieceOverlay.tsx` (D-07); `47-UI-SPEC.md` explicitly locked "CSS Module classes with literal color values" over a token-import approach; and `tokens.css` is not in this plan's `files_modified` frontmatter list. This satisfies both the plan's literal-value acceptance criteria and the `pnpm stylelint` exit-0 gate without an out-of-scope file edit.
- Declared `.statCardSelected`/`.statCardEligible` at the very end of the CSS module file (after `.subConfirmButtonReady:hover`), matching the plan's explicit cascade-order requirement, with a comment explaining why position is load-bearing (CSS Modules resolves conflicting border/box-shadow declarations by file order, not by className composition order).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed workspace dependencies and built `packages/shared`**
- **Found during:** Task 1 verification (`pnpm stylelint`)
- **Issue:** This worktree had no `node_modules` anywhere in the tree (fresh worktree checkout never had `pnpm install` run against it), so `pnpm stylelint`/`vitest`/`tsc` all failed with "command not found" / module-resolution errors.
- **Fix:** Ran `pnpm install` at the workspace root (standard content-addressable pnpm install, no manual node_modules junction/symlink manipulation — see project memory on Windows junction risk) and `pnpm --filter @counter-attack/shared build` to produce `packages/shared/dist` so `@counter-attack/shared` resolves for the client package.
- **Files modified:** none (installs `node_modules`/`packages/shared/dist`, both gitignored build/dependency output)
- **Verification:** `pnpm stylelint` and `pnpm --filter @counter-attack/client test -- DraftPackCarousel` both ran successfully afterward
- **Committed in:** n/a (gitignored output, not committed)

**2. [Rule 3 - Blocking] Scoped `stylelint-disable` comments on the two new literal-color declarations**
- **Found during:** Task 1 verification (`pnpm stylelint`)
- **Issue:** The project's `stylelint.config.js` enforces `scale-unlimited/declaration-strict-value` (no raw hex in border/color properties) and disallows `rgba()` via `function-disallowed-list`. The plan/UI-SPEC explicitly requires literal `#22c55e`/`#60a5fa`/`rgba(...)` values in `LineupAssignmentScreen.module.css` itself (not a `tokens.css` var), which directly conflicts with this lint rule. `tokens.css` is out of this plan's `files_modified` scope and its own header explicitly excludes highlight/ring colors from its remit.
- **Fix:** Added narrowly-scoped `/* stylelint-disable-next-line ... */` comments on exactly the four declarations that need literal values (border/box-shadow on `.statCardSelected` and `.statCardEligible`), with an explanatory comment block above both classes.
- **Files modified:** `packages/client/src/components/LineupAssignmentScreen.module.css`
- **Verification:** `pnpm stylelint` exits 0; literal values `#22c55e`, `rgba(34, 197, 94, 0.4)`, `#60a5fa`, `rgba(96, 165, 250, 0.4)` all still present in the file per acceptance criteria
- **Committed in:** `c900a9bd` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking issues preventing the plan's own required verification steps from running/passing)
**Impact on plan:** No scope creep — the dependency install/build is environment setup only (no source change, gitignored output), and the stylelint-disable comments preserve the plan's explicit literal-value design decision exactly as specified while satisfying the equally explicit `pnpm stylelint exits 0` gate.

## Issues Encountered

- Task 1's acceptance criterion `grep -c 'not-allowed' <file> returns 0` could not be fully satisfied without going out of scope. Two pre-existing `cursor: not-allowed` declarations remain in the file — `.confirmButton`'s not-ready state (line ~69) and `.cardUnavailable`'s dimmed OUT/RED-CARD treatment (line ~497, SUB-07/D-13) — neither is a drag-state class, neither is mentioned in the task's `<action>` text, and both predate this phase entirely. Changing them would be an unrequested behavior change to unrelated confirm-button and unavailable-card UX outside this plan's stated scope. The class the task's action text actually specifies (`.statCardSubBlocked`) does correctly declare `cursor: default` as required. Treating this literal grep as written would require editing two components not touched anywhere else in the plan; flagging here rather than silently expanding scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `DraftCardBody`/`DraftPackCarousel`'s click-select contract (`interactive`/`onClick`/`isSelected`/`isEligibleTarget`/`onCardClick`/`selectedCardId`) and the `.statCardSelected`/`.statCardEligible` CSS classes are now available for `BenchCarousel` (same phase, different plan) and `LineupAssignmentScreen.tsx` (plan 47-03) to consume.
- **Known, plan-documented pre-existing typecheck break:** `pnpm --filter @counter-attack/client typecheck` fails at `LineupAssignmentScreen.tsx:1291` because that file still passes the old `onCardDragStart` prop to `DraftPackCarousel`. This is explicitly called out in this plan's own `<verification>` section as "EXPECTED TO FAIL after this plan and is not a gate here" — resolved when plan 47-03 ports `LineupAssignmentScreen.tsx` to the new contract. Not a regression introduced by this plan; confirmed the only typecheck errors touching these two files are this one expected break plus the pre-existing `DraftPackCarousel.tsx(210,20)` `Key` type warning on the unmodified `key={attr}` stat-grid line (predates this plan, out of scope).

---
*Phase: 47-select-based-roster-interaction*
*Completed: 2026-08-30*
