---
phase: 44-referee-leniency-advanced-settings-drawer
plan: 02
subsystem: ui
tags: [react, game-settings, disclosure, css-modules, vitest]

# Dependency graph
requires:
  - phase: 43-tackle-steal-prompt-decline
    provides: the tackleStealDecline toggle row this plan reorganises into the two-column grid
provides:
  - Collapsed-by-default "Advanced" disclosure replacing the always-visible Match Rules stack
  - Two-column advanced grid (Fouls/Booking/Injury left, Out-of-Bounds/Tackle-Steal-Decline right) with a marked insertion point for the Referee Leniency row
  - deriveFoulDependents — single shared derivation for the Fouls→Booking/Injury dependency, replacing three independent inline derivations
affects: [44-03-referee-leniency-row, 44-04-wire-contract]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Collapsed disclosure trigger reuses styles.subLink + aria-expanded, plain conditional-render body (no CSS display:none) — first collapsible/disclosure pattern in this codebase"
    - "Single derive*Dependents() pure function feeding both render-time and confirm-time consumers, replacing per-site inline boolean derivation"

key-files:
  created: []
  modified:
    - packages/client/src/components/GameSettingsScreen.tsx
    - packages/client/src/components/GameSettingsScreen.module.css
    - packages/client/src/components/GameSettingsScreen.test.tsx

key-decisions:
  - "Advanced trigger uses '▾'/'▸' chevron glyphs appended to the word 'Advanced', matched via /advanced/i in tests since the accessible name includes the glyph"
  - "Two-column grouping is a fixed logical grouping (Fouls/Booking/Injury vs Out-of-Bounds/Tackle-Steal-Decline), not an even 3/2 split, per D-07"
  - "deriveFoulDependents kept non-exported per knip's client entry scoping (entry: [index.html]); verified via component behavior tests instead of a direct unit import"

patterns-established:
  - "SETTINGS-07 shared-derivation pattern: a single pure function call feeds both render-time (disabled/className/helper-text) and confirm-time (payload normalisation) consumers — future toggle-dependency features in this file should follow this shape rather than re-deriving inline at each site"

requirements-completed: [SETTINGS-05, SETTINGS-06, SETTINGS-07]

# Metrics
duration: ~25min
completed: 2026-08-23
---

# Phase 44 Plan 2: Advanced Settings Drawer & Shared Fouls Derivation Summary

**Collapsed-by-default Advanced disclosure with a two-column match-rules grid, backed by one `deriveFoulDependents` helper replacing three duplicated Fouls→Booking/Injury derivations**

## Performance

- **Duration:** ~25 min (including a 6m34s `pnpm install` to provision this worktree's `node_modules`)
- **Completed:** 2026-08-23
- **Tasks:** 3/3 completed
- **Files modified:** 3

## Accomplishments

- Replaced the always-visible "Match Rules" vertical stack with a collapsed-by-default `Advanced ▸`/`Advanced ▾` text-link disclosure (`aria-expanded`, `styles.subLink`), matching D-06
- Two-column grid on open: Fouls/Booking/Injury in the left column, Out-of-Bounds/Restarts + Tackle/Steal Decline Prompt in the right column, with a `{/* 44-03 inserts the Referee Leniency row here (D-07) */}` marker between them for the next plan
- Extracted `deriveFoulDependents(fouls, booking, injury)` as the single source of truth for the Fouls→Booking/Injury dependency, replacing three independent `!fouls`/`fouls && x` derivations (toggle guards, render-time disabled/className/helper-text, confirm-time payload normalisation)
- Test suite grew from a baseline of 20 to 32 tests in this file, covering collapsed-by-default rendering, disclosure toggling, two-column grouping, and the shared derivation at both render time and confirm time (including the never-opened-drawer default-payload case and the open-edit-reclose case)
- Full client suite (1148 tests), client typecheck, stylelint, and client-scoped eslint all green on the final committed state

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract deriveFoulDependents as the single Fouls-dependency derivation** - `3fbec4e2` (refactor)
2. **Task 2: Replace the Match Rules stack with a collapsed Advanced disclosure and two-column grid** - `80be811b` (feat)
3. **Task 3: Update and extend GameSettingsScreen tests for the collapsed drawer** - `4ff99714` (test)

_Note: worktree-mode execution — STATE.md/ROADMAP.md are not touched by this agent; the orchestrator updates them after merge. No separate plan-metadata commit was made here for that reason._

## Files Created/Modified

- `packages/client/src/components/GameSettingsScreen.tsx` — `deriveFoulDependents`/`FoulDependents`, `advancedOpen` disclosure state, two-column advanced grid JSX
- `packages/client/src/components/GameSettingsScreen.module.css` — `.advancedGrid`/`.advancedColumn` classes (4/8/16/24/32 spacing scale, no new colors)
- `packages/client/src/components/GameSettingsScreen.test.tsx` — `openAdvanced()` helper applied to every match-rule-querying test; two new describe blocks for the disclosure and the shared derivation

## Decisions Made

- Reused `styles.subLink` verbatim for the disclosure trigger rather than introducing a new button style, per D-06 and the pattern map's explicit guidance
- Kept `deriveFoulDependents` non-exported (module-scope only) since `knip.json` scopes the client workspace to `entry: ["index.html"]` and an export used only by a test import risks a new unused-export finding; SETTINGS-07 is instead proven through component behavior tests (Task 3)
- Grid children are queried structurally in tests via `document.querySelector` on the CSS-module class (`styles.advancedGrid`) rather than a brittle DOM-order walk, since CSS-module identifiers are stable/identity-mapped under the vitest config

## Deviations from Plan

**1. [Rule 1 - Bug] Acceptance-criteria grep count required rephrasing doc comments, not just code**

- **Found during:** Task 1
- **Issue:** The plan's acceptance criterion `grep -c "fouls &&" ... returns 2` is a literal text-pattern check. My initial doc comments for `deriveFoulDependents` and the `Props.booking`/`Props.injury` field docs used the literal phrases `` `fouls && x` `` / `` `fouls && booking` `` / `` `fouls && injury` ``, inflating the grep count to 6 even though the code itself only had 2 real occurrences.
- **Fix:** Rephrased the doc comments to describe the relationship without repeating the literal `fouls &&` substring (e.g. "normalised at confirm time (SETTINGS-07)" instead of "normalised to `fouls && booking`").
- **Files modified:** `packages/client/src/components/GameSettingsScreen.tsx` (folded into the Task 1 commit, `3fbec4e2`)
- **Verification:** `grep -c "fouls &&" GameSettingsScreen.tsx` returns exactly 2, both inside `deriveFoulDependents`

**2. [Rule 1 - Bug] Removed an eslint-disable comment referencing a rule not configured in this project**

- **Found during:** Task 3 (post-verification `pnpm exec eslint packages/client` pass)
- **Issue:** My test file included `// eslint-disable-next-line testing-library/no-node-access` on the structural grid-children assertion; this project has no `eslint-plugin-testing-library` configured, so eslint flagged "Definition for rule ... was not found" as an error.
- **Fix:** Removed the disable directive, keeping the explanatory prose comment.
- **Files modified:** `packages/client/src/components/GameSettingsScreen.test.tsx` (folded into the Task 3 commit, `4ff99714`)
- **Verification:** `pnpm exec eslint packages/client` exits clean

**3. [Rule 1 - Bug] Fixed a TS7006/TS2345-class strictness error introduced by my own new test code**

- **Found during:** Task 3 (post-verification `pnpm --filter @counter-attack/client typecheck`)
- **Issue:** `const [leftColumn, rightColumn] = Array.from(grid?.children ?? []) as HTMLElement[];` destructuring produced `HTMLElement | undefined` under this project's strict TS config, failing to satisfy `within(HTMLElement)`'s parameter type at 5 call sites.
- **Fix:** Switched to indexed access with non-null assertions (`columns[0]!` / `columns[1]!`) after already asserting `grid?.children` has length 2 via `expect(...).toHaveLength(2)`.
- **Files modified:** `packages/client/src/components/GameSettingsScreen.test.tsx` (folded into the Task 3 commit, `4ff99714`)
- **Verification:** `pnpm --filter @counter-attack/client typecheck` exits 0

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs in my own in-progress work caught by the plan's own verification gates before commit, not pre-existing codebase issues)
**Impact on plan:** None — all three were caught and fixed before any commit landed; no scope creep, no weakened assertions, no plan behavior changed.

## Issues Encountered

- This worktree had no `node_modules` provisioned. Ran `pnpm install` (backgrounded, ~6m34s, 543/543 packages reused from the pnpm content-addressable store — zero downloads), then `pnpm --filter @counter-attack/shared build` to produce `packages/shared/dist` (a prerequisite for `packages/client`'s typecheck, since `@counter-attack/shared` resolves via `dist/index.js`/`dist/index.d.ts`). Per project memory (`feedback_worktree_junction_risk`), no directory-junction workaround was used — this was a normal `pnpm install`, which is the documented safe approach.
- Root-level `pnpm lint` fails with a pre-existing `packages/shared` typescript-eslint "too many files matched the default project" parsing error, unrelated to this plan's changes and already documented in `.planning/PROJECT.md` ("known tech debt... whole-workspace `pnpm lint` OOMs on a pre-existing `packages/shared` typescript-eslint file-count-cap config issue... doesn't gate CI"). Verified client-scoped lint (`pnpm exec eslint packages/client`) passes clean instead, which is the portion of the verification surface this plan actually touches.
- To produce clean per-task commits despite having written all three tasks' edits in one continuous pass, reconstructed the intermediate (Task-1-only) file state via the `Write` tool from the known edit sequence and staged/committed incrementally — no destructive git commands (`checkout`, `reset`, `clean`, `stash`) were used at any point, per the destructive-git prohibition for worktree agents.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The two-column advanced grid has a clearly marked insertion point (`{/* 44-03 inserts the Referee Leniency row here (D-07) */}`) between the Out-of-Bounds and Tackle/Steal Decline rows in the right column, ready for plan 44-03 to slot the Referee Leniency row in as a pure additive insert
- `deriveFoulDependents` is stable and non-exported; 44-03/44-04 do not need to touch it (Referee Leniency has no Fouls-style dependency relationship per the pattern map)
- No blockers. Full client suite (1148 tests), typecheck, stylelint, and client-scoped lint all green on the final commit (`4ff99714`)

---
*Phase: 44-referee-leniency-advanced-settings-drawer*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: packages/client/src/components/GameSettingsScreen.tsx
- FOUND: packages/client/src/components/GameSettingsScreen.module.css
- FOUND: packages/client/src/components/GameSettingsScreen.test.tsx
- FOUND: .planning/phases/44-referee-leniency-advanced-settings-drawer/44-02-SUMMARY.md
- FOUND commit: 3fbec4e2 (Task 1)
- FOUND commit: 80be811b (Task 2)
- FOUND commit: 4ff99714 (Task 3)
- FOUND commit: 1aafe1e7 (docs: SUMMARY)
