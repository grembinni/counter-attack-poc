---
phase: 34-visual-theme-restyle
plan: 04
subsystem: ui
tags: [css-custom-properties, design-tokens, wcag-contrast, react, vite]

# Dependency graph
requires:
  - phase: 34-visual-theme-restyle (34-01/34-02)
    provides: deriveAaAccentColor()/useTeamAccentColorAA() exported from packages/client/src/hooks/useTeamColors.ts
  - phase: 34-visual-theme-restyle (34-03)
    provides: pnpm stylelint + pnpm check-contrast CI gates that re-validate against the new tokens.css values automatically
provides:
  - Charcoal/graphite chrome palette live in packages/client/src/styles/tokens.css (--color-bg-page #121212, --color-bg-surface #1c1c1c, --color-bg-surface-alt #262626, --color-border #262626, --color-text-primary #f5f5f5, --color-text-tertiary #808080, --team-accent fallback #f5c518)
  - GameBoard.tsx's three accent call sites (homeColor/awayColor/teamColor) routed through useTeamAccentColorAA, feeding --team-accent/--home-accent/--away-accent with WCAG AA-safe derived values
affects:
  [Phase 34 human-verify checkpoint (this plan's Task 3) — must be approved before phase close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Chrome token value swap is a pure CSS custom-property edit — zero .module.css structural changes needed since Phase 33 already routed all consumers through var(--token)'

key-files:
  created: []
  modified:
    - packages/client/src/styles/tokens.css
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.test.tsx

key-decisions:
  - "GameBoard.test.tsx's THEME-03 accent-variable assertions rewritten to compute expected values via deriveAaAccentColor(uiColor, '#121212', '#ffffff') instead of raw TEAM_CONFIGS uiColor lookups, since the swap to useTeamAccentColorAA intentionally changes the derived value for any team whose brand color fails AA (Rule 1 — test was asserting the pre-THEME-04 raw-passthrough behavior)"

patterns-established: []

requirements-completed: [THEME-01, THEME-04]

# Metrics
duration: ~35min (excluding checkpoint wait)
completed: 2026-07-26
---

# Phase 34 Plan 04: Charcoal Palette Swap + GameBoard AA Wiring Summary

**tokens.css recolored from the deep-blue chrome theme to a neutral charcoal/graphite base (#121212/#1c1c1c/#262626) with crisp near-white text and a gold accent fallback, plus GameBoard.tsx's three team-accent call sites rewired from the raw `useTeamAccentColor` to the WCAG-AA-safe `useTeamAccentColorAA` derivation — pending final human visual-verification checkpoint.**

## Performance

- **Duration:** ~35 min (Tasks 1-2 automated work; Task 3 is an outstanding human-verify checkpoint)
- **Completed:** 2026-07-26 (Tasks 1-2); Task 3 checkpoint pending
- **Tasks:** 2/3 completed (Task 3 is a `checkpoint:human-verify` gate, awaiting approval)
- **Files modified:** 3 (tokens.css, GameBoard.tsx, GameBoard.test.tsx)

## Accomplishments

- Seven `tokens.css` chrome tokens recolored to the charcoal/graphite palette with zero blue-channel bias remaining anywhere in the file (`#1a1a2e`/`#16213e`/`#0f3460`/`#1a56b0`/`#808090` all confirmed removed)
- 3-tier background structure and every "Extended chrome tokens" / D-05 functional-color block preserved byte-for-byte unchanged
- `GameBoard.tsx`'s `homeColor`/`awayColor`/`teamColor` accent resolutions now call `useTeamAccentColorAA`, so `--team-accent`/`--home-accent`/`--away-accent` always carry an AA-safe value (`ActionLog.tsx`'s raw `teamAccentColor()` calls intentionally untouched, per D-04 carve-out)
- Full automated gate suite green: `pnpm stylelint`, `pnpm --filter @counter-attack/client typecheck`, `pnpm --filter @counter-attack/client test` (415/415), `pnpm -r build`, `pnpm check-contrast` (all 12 teams clear AA)
- Client dev server started and confirmed serving (`http://localhost:5175/`) for the outstanding human-verify checkpoint

## Task Commits

Each automated task was committed atomically:

1. **Task 1: Swap tokens.css chrome palette to charcoal/graphite (THEME-01)** - `c83a2a9` (feat)
2. **Task 2: Wire GameBoard accent injection through the AA hook (THEME-04)** - `108a202` (feat)

Task 3 (`checkpoint:human-verify`) has not yet been approved — see "Next Phase Readiness" below.

_Note: worktree mode — STATE.md/ROADMAP.md final metadata commit is owned by the orchestrator, not this agent._

## Files Created/Modified

- `packages/client/src/styles/tokens.css` - Recolored `--color-bg-page`/`--color-bg-surface`/`--color-bg-surface-alt`/`--color-border`/`--color-text-primary`/`--color-text-tertiary`/`--team-accent` (fallback) to the charcoal/graphite palette; updated file-header comment to record Phase 34 as the value-swap phase
- `packages/client/src/components/GameBoard.tsx` - Import and 3 call sites (`homeColor`, `awayColor`, `teamColor`) swapped from `useTeamAccentColor` to `useTeamAccentColorAA`; comment updated to reference THEME-04
- `packages/client/src/components/GameBoard.test.tsx` - THEME-03 accent-variable test block updated to assert against `deriveAaAccentColor(...)` output (see Deviations)

## Decisions Made

- Preserved the plan's exact seven target hex values and left every other token untouched, matching 34-UI-SPEC.md's Color table verbatim.
- Kept `ActionLog.tsx` fully untouched (no import/call changes) — verified via `git diff --stat` showing zero changes to that file, confirming the D-04 carve-out held.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated GameBoard.test.tsx's THEME-03 accent-variable assertions to match intentional THEME-04 behavior change**

- **Found during:** Task 2 verification (`pnpm --filter @counter-attack/client test`)
- **Issue:** Two pre-existing tests (`GameBoard — THEME-03: runtime accent CSS variables`) asserted `--team-accent`/`--home-accent`/`--away-accent` equal the raw `TEAM_CONFIGS[...].palette.uiColor` value. Swapping to `useTeamAccentColorAA` (the plan's explicit Task 2 goal) intentionally changes this for any team whose brand color fails AA against the new charcoal base — the mock's `city`/`crew` teams both required adjustment, so the raw-passthrough assertions failed by design, not by regression.
- **Fix:** Imported `deriveAaAccentColor` from `useTeamColors.ts` in the test file and rewrote both assertions to compute the expected value via `deriveAaAccentColor(uiColor, '#121212', '#ffffff')` instead of the raw uiColor — this asserts the correct AA-derived contract without hardcoding a specific derived hex (keeps the test valid if `TEAM_CONFIGS` values or the derivation algorithm are tuned later).
- **Files modified:** `packages/client/src/components/GameBoard.test.tsx`
- **Verification:** `pnpm --filter @counter-attack/client test` — all 415/415 tests pass (0 failing).
- **Committed in:** `108a202` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (test update reflecting an intentional, plan-mandated behavior change)
**Impact on plan:** No scope creep — the fix only updates test expectations to match Task 2's explicitly planned hook swap; no production code beyond the plan's stated `GameBoard.tsx` changes was touched.

## Issues Encountered

- Worktree had no `node_modules` (fresh worktree, no prior install). Ran `pnpm install` (~3m 11s) then `pnpm --filter @counter-attack/shared build` before any verification command would run — standard worktree bootstrap, not a plan or code change (consistent with 34-03-SUMMARY.md's prior note on the same pattern).
- Whole-workspace `pnpm lint` still OOMs/fails on the pre-existing `packages/shared` typescript-eslint file-count-cap issue (documented in `.planning/phases/32-code-cleanup/deferred-items.md` and `34-03-SUMMARY.md`) — unrelated to this plan's files. Confirmed our specific modified files (`GameBoard.tsx`, `GameBoard.test.tsx`, `useTeamColors.ts`) lint clean via a scoped `npx eslint` invocation instead.
- Three dev-server ports (5173/5174/5175) were found listening during Task 3 setup, consistent with sibling parallel-wave worktrees each running their own `pnpm --filter @counter-attack/client dev`. This worktree's own instance was confirmed running on `http://localhost:5175/` (verified via `curl`) — used for the checkpoint below.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- THEME-01 (charcoal/graphite chrome palette) and THEME-04 (AA-safe GameBoard accent wiring) are both code-complete and pass every automated gate (stylelint, typecheck, test, build, check-contrast).
- **Outstanding: Task 3 human-verify checkpoint** — visual confirmation across lobby, settings, team/draft selection, and the in-game board that the charcoal look reads correctly with no residual blue chrome. This plan (and Phase 34 as a whole) cannot be marked complete until that checkpoint is approved. See the CHECKPOINT REACHED section returned alongside this summary for exact verification steps and the dev-server URL.
- No further code changes are anticipated for this plan unless the checkpoint surfaces a visual defect.

## Self-Check: PASSED

- FOUND: packages/client/src/styles/tokens.css (charcoal values confirmed present, old blue literals confirmed absent)
- FOUND: packages/client/src/components/GameBoard.tsx (useTeamAccentColorAA confirmed at all 3 call sites, zero raw useTeamAccentColor( calls remain)
- FOUND: packages/client/src/components/GameBoard.test.tsx (deriveAaAccentColor-based assertions confirmed present)
- FOUND commit: c83a2a9 (Task 1)
- FOUND commit: 108a202 (Task 2)

---

## Checkpoint Round 2: Action-button legibility fix

**Trigger:** Human feedback on the Task 3 human-verify checkpoint — "action buttons are hard to see - can they be updated to have a thin outline?"

**Root cause confirmed:** `--color-border: #262626` in `tokens.css` is byte-identical to `--color-bg-surface-alt: #262626`. Every `.ctaButton`-pattern action button renders `background: var(--color-bg-surface-alt)` with `border: none`, sitting on a panel whose own background is `--color-bg-surface: #1c1c1c` — three near-adjacent dark grays with no outline to separate the clickable control from its container.

**Fix applied:** Added `border: 1px solid var(--color-border-subtle)` (`#555555` — an existing token, already used for the same purpose in `UniformSelectionScreen.module.css`) to the shared `.ctaButton`/`.overlayCtaButton` base rules, replacing `border: none`. No new CSS custom property was introduced (stylelint's `var(--token)`-only rule stays satisfied). Pending/orange and ready/green color-state variants (`.ctaButtonPending`, `.ctaButtonReady`) inherit the new border automatically — they're applied as an _additional_ class alongside `.ctaButton` in every call site (verified via `.tsx` grep), not a replacement, so only `background` needed overriding by those variants (unchanged).

**Files fixed (7):**

- `packages/client/src/components/ActionPanel.module.css`
- `packages/client/src/components/FreeKickSetupPanel.module.css`
- `packages/client/src/components/GameSettingsScreen.module.css`
- `packages/client/src/components/KickOffSetupPanel.module.css`
- `packages/client/src/components/LobbyScreen.module.css`
- `packages/client/src/components/ReplayPanel.module.css`
- `packages/client/src/components/GameBoard.module.css` (`.overlayCtaButton` — the "Start 2nd Half" CTA)

**Files investigated and deliberately excluded:**

- `packages/client/src/components/DisconnectBanner.module.css` — a fixed, full-width status banner (not a clickable action button); its text color is already `--color-accent-gold` against `--color-bg-surface-alt`, which is a distinct, legible contrast pair. Out of scope for this feedback.
- `packages/client/src/components/LineupAssignmentScreen.module.css` — its only `background: var(--color-bg-surface-alt)` usage is `.carouselNav:hover`, and `.carouselNav`'s base state already carries `border: 1px solid var(--color-border)`. Its `.confirmButtonGreen` CTA uses `background: var(--color-success)` (bright green), not the surface-alt/border-collision pattern — no legibility problem present.

**Verification (all green, re-run after the fix):**

- `pnpm stylelint` — pass (no `.module.css` violations)
- `pnpm --filter @counter-attack/client typecheck` — pass
- `pnpm --filter @counter-attack/client test` — 415/415 pass
- `pnpm -r build` — pass (shared, server, client)
- `pnpm check-contrast` (run from `packages/client`) — all 12 teams clear AA thresholds

**Commit:** `f5effcb` (fix)

**Dev server for re-verification:** `pnpm --filter @counter-attack/client dev` started fresh in this worktree; ports 5173-5175 were occupied by sibling parallel-wave worktrees, so Vite auto-selected **`http://localhost:5176/`** (confirmed via `curl` → `200`).

**Outstanding:** Task 3's human-verify checkpoint is being re-presented with this fix included — it is NOT auto-approved. The user should re-check the same screens (lobby, settings, team/draft selection, in-game board) specifically for the new button outlines, at `http://localhost:5176/`.

---

_Phase: 34-visual-theme-restyle_
_Completed: 2026-07-26 (Tasks 1-2; checkpoint-driven button-outline fix landed; Task 3 checkpoint re-pending human approval)_
