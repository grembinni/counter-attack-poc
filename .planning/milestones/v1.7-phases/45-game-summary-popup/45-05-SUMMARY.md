---
phase: 45-game-summary-popup
plan: 05
subsystem: ui
tags: [react, zustand, css-modules, match-summary, modal, checkpoint-fixes]

# Dependency graph
requires:
  - phase: 45-04
    provides: "MatchSummaryContent — the single reusable stats block (settings recap + 8 stat rows) consumed by both the standalone modal and the HALF_TIME/FULL_TIME overlay"
provides:
  - "MatchSummaryModal — standalone on-demand modal chrome (title, shared big score row, scrollable MatchSummaryContent, single green Close CTA)"
  - "MatchScoreRow — the single shared big score-row shell (120px numerals, 150px TeamBadge) consumed by both the HALF_TIME/FULL_TIME overlay and MatchSummaryModal"
  - "Scoreboard (i) icon in GameBoard.tsx's .scoreboardCentreCell, always clickable in every phase, opening MatchSummaryModal with no socket traffic"
  - "MatchSummaryContent appended inside both the HALF_TIME and FULL_TIME overlay cards, below their untouched score headers"
  - "Fix for a pre-existing red-card false-positive block in FreeKickSetupPanel's defender-zone check (isActivePiece exclusion)"
  - "Fix for a mangled final-third free-move helper text ('Position for Kick!' -> 'Free Move!')"
affects: [45-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MatchScoreRow: self-contained shared component (reads score/selectedTeams from the store itself) taking a single caller-supplied `center` ReactNode prop, so two structurally-different call sites (HALF_TIME/FULL_TIME's own three-section centre content vs. the modal's live clock) render the identical surrounding shell"
    - "Settings-recap bubble chunking: a small chunk() helper groups a flat item array into fixed-size rows (RECAP_COLUMNS = 4) rendered as nested flex rows, each independently centered via justify-content:center on its own flex line — deterministic grouping instead of width-dependent flex-wrap"
    - "Explicit width:100% declared at every ancestor level of a cross-surface shared component (MatchSummaryContent's .root down through .recapRow, plus both consuming wrappers) rather than relying on implicit block/flex-stretch defaults, to guarantee identical centering behavior in both consuming surfaces"

key-files:
  created:
    - packages/client/src/components/MatchSummaryModal.tsx
    - packages/client/src/components/MatchSummaryModal.module.css
    - packages/client/src/components/MatchScoreRow.tsx
    - packages/client/src/components/MatchScoreRow.module.css
    - packages/client/src/components/GameBoard.matchSummary.test.tsx
  modified:
    - packages/client/src/components/GameBoard.tsx
    - packages/client/src/components/GameBoard.module.css
    - packages/client/src/components/MatchSummaryContent.tsx
    - packages/client/src/components/MatchSummaryContent.module.css
    - packages/client/src/components/MatchSummaryContent.test.tsx
    - packages/client/src/components/FreeKickSetupPanel.tsx
    - packages/client/src/components/FreeKickSetupPanel.test.tsx
    - packages/client/src/components/ActionPanel.tsx
    - packages/client/src/components/ActionPanel.test.tsx

key-decisions:
  - "Modal chrome MUST render as a DOM descendant of GameBoard's root (not a React portal to document.body), since --home-accent/--away-accent/--team-accent custom properties inherit through the DOM tree, not the layout tree (interface_contract, 45-05-PLAN.md)"
  - "No backdrop-click-to-dismiss on the standalone modal — a stray click during a live match should not silently close a panel the player may still be reading; the always-visible footer Close button is the sole dismiss control (T-45-18, revised in round 1 from an original two-control design)"
  - "MatchScoreRow extracted as a genuinely shared component (not a second improvised variant) after developer pushback in round 2 — both the standalone modal and the HALF_TIME/FULL_TIME overlay now render the byte-identical score-row shell"
  - "Referee Leniency bubble color rule: green for the DEFAULT (Auto) setting, red when manually overridden — flipped from the original round-1 direction after round-4 developer feedback"

requirements-completed: [STATS-01, STATS-02]

# Metrics
duration: 4h 27min
completed: 2026-08-28
---

# Phase 45 Plan 05: Match Summary Entry Points Summary

**Scoreboard (i) icon opens a standalone MatchSummaryModal (shared MatchScoreRow + MatchSummaryContent), and the same stats block is appended inside the HALF_TIME/FULL_TIME overlays — plus four rounds of live-checkpoint UI/UX fixes converging on a single shared score-row component, centered/colored settings-recap bubbles, and two pre-existing gameplay/copy bugs fixed along the way**

## Performance

- **Duration:** 4h 27min (first commit 15:22, last commit 19:49; includes 4 rounds of live-checkpoint developer feedback and fix cycles between the original 3 tasks and final approval)
- **Started:** 2026-08-28T15:22:37-05:00
- **Completed:** 2026-08-28T19:49:16-05:00
- **Tasks:** 3 plan tasks + 1 checkpoint (approved after 4 fix rounds)
- **Files modified:** 14 (5 created, 9 modified)

## Accomplishments

- An always-clickable (i) icon sits directly above the scoreboard clock in every game phase (including mid-duel/prompt interrupts) and opens `MatchSummaryModal`, a standalone on-demand popup showing the shared match-summary stats block.
- The same `MatchSummaryContent` block is appended inside both the HALF_TIME and FULL_TIME overlay cards, below their untouched score-row headers and above their untouched proceed controls — zero forked rendering logic (D-11).
- After 4 rounds of live two-browser checkpoint verification, the standalone modal and the HALF_TIME/FULL_TIME overlay now share a single `MatchScoreRow` component for their score display (same 150px badges, same 120px numerals — not two different-looking elements).
- The settings recap (7 colored bubbles: Speed + 5 boolean toggles + Referee Leniency) renders as fixed-size, horizontally-centered rows (4+3 split) rather than a ragged left-aligned wrap, with an explicit full-width stretch chain so the centering is relative to the popup's real content width in both consuming surfaces.
- Two pre-existing bugs surfaced and fixed during live verification: a red-carded piece falsely blocking the free-kick defender-zone check, and a mangled "Actions Position for Kick!" helper-text concatenation in the final-third free-move phase.

## Task Commits

Each task was committed atomically:

1. **Task 45-05-01: Build the standalone MatchSummaryModal chrome** - `6d4f2110` (feat)
2. **Task 45-05-02: Add the scoreboard (i) icon and mount the modal in GameBoard** - `bbeda8f0` (feat, tdd)
3. **Task 45-05-03: Append the stats block inside the HALF_TIME and FULL_TIME overlays** - `082ebb4e` (feat, tdd)
4. **Task 45-05-04: checkpoint:human-verify** - approved after 7 checkpoint-fix commits across 4 rounds (see Deviations below)

**Checkpoint-fix commits (rounds 1-4):**

- `83c8525e` fix: exclude red-carded pieces from free-kick defender-zone check
- `3eed1935` fix: correct mangled final-third free-move helper text
- `3bd4c5d4` fix: remove modal corner x, restyle Close, add scoreboard row (round 1)
- `a611daa8` fix: add Speed and colored bubbles to the settings recap (round 1)
- `0d8a6d38` fix: unify standalone modal and half-time score rows into MatchScoreRow (round 2)
- `9f2efb2a` fix: center settings recap bubbles in fixed-size rows (round 3)
- `fe5cf56a` fix: stretch settings recap to full popup width, flip leniency color (round 4)

**Plan metadata:** (this commit)

_Note: task 45-05-02 and 45-05-03 were both `tdd="true"` — behavior/implementation were written together per task per the plan's action text; RED/GREEN gate commits were not separately split since the plan's own verify block ran tests inline per task, consistent with how prior GameBoard.tsx plans in this phase have executed._

## Files Created/Modified

- `packages/client/src/components/MatchSummaryModal.tsx` - Standalone modal chrome: title, shared `MatchScoreRow` (live clock centre content), scrollable `MatchSummaryContent`, single green footer Close button
- `packages/client/src/components/MatchSummaryModal.module.css` - Backdrop (z-index 30, above `.substitutionOverlay`'s 20), card, header, clock-text, footer-button styling
- `packages/client/src/components/MatchScoreRow.tsx` - New shared component: score numeral + 150px `TeamBadge` + caller-supplied centre content + 150px `TeamBadge` + score numeral, self-contained (reads `score`/`selectedTeams` itself)
- `packages/client/src/components/MatchScoreRow.module.css` - The score-row shell CSS, extracted verbatim from `GameBoard.module.css`'s former `.halfTimeScoreRow`/`.halfTimeScore`/`.halfTimeCenter`
- `packages/client/src/components/GameBoard.matchSummary.test.tsx` - New test suite: icon-in-every-phase (table-driven), modal open/close, no-socket-emit, HALF_TIME/FULL_TIME embedding, score-row reuse, x-removal regression
- `packages/client/src/components/GameBoard.tsx` - Added `matchSummaryOpen` local state, the scoreboard (i) icon row, the modal render block, and `<MatchScoreRow center={...}/>` in both overlay blocks (replacing hand-rolled score-row markup)
- `packages/client/src/components/GameBoard.module.css` - Added `.matchSummaryIconRow`/`.matchSummaryIconButton`, `.embeddedSummaryDivider`/`.embeddedSummaryWrapper`; removed the now-dead `.halfTimeScoreRow`/`.halfTimeScore`/`.halfTimeCenter` classes (moved into `MatchScoreRow.module.css`)
- `packages/client/src/components/MatchSummaryContent.tsx` - Added Speed to the settings recap (developer override of D-13), converted the recap to colored bubbles with a fixed-column chunk() layout, flipped the Referee Leniency color rule
- `packages/client/src/components/MatchSummaryContent.module.css` - `.recapGrid`/`.recapRow` (chunked, centered rows), `.settingsBubble*` color variants, explicit `width: 100%` stretch chain
- `packages/client/src/components/MatchSummaryContent.test.tsx` - Updated recap-format assertions (bubble text, no parens), added Speed coverage, added a structural 4+3 row-grouping regression test, added a Referee Leniency color-direction regression test
- `packages/client/src/components/FreeKickSetupPanel.tsx` - Fixed a pre-existing bug: the client-side defender-zone "too close" recount now excludes red-carded/sent-off pieces via the shared `isActivePiece` predicate (BUG-38 convention), matching the server-authoritative check
- `packages/client/src/components/FreeKickSetupPanel.test.tsx` - Added a regression test for the red-card exclusion
- `packages/client/src/components/ActionPanel.tsx` - Fixed a pre-existing text bug: "Position for Kick!" (which combined with the "Actions" heading to read as "Actions Position for Kick!") renamed to "Free Move!"
- `packages/client/src/components/ActionPanel.test.tsx` - Updated the two affected test assertions/descriptions

## Decisions Made

- The modal's centre-of-score-row content is the live match clock (`actionCount`, MM:00 format, mirroring `GameBoard.tsx`'s own `clockDisplay` derivation) — chosen because the modal can open at any point mid-match, not just at a phase boundary like HALF_TIME/FULL_TIME, and its fixed-position backdrop hides the persistent top-band clock while open.
- Settings-recap bubbles use a strict red/green binary for the five boolean toggles; Speed (not boolean) instead reuses its own existing per-speed hue from `GameSettingsScreen.module.css`/`tokens.css` rather than being forced into red/green.
- The 7 settings-recap items are chunked into fixed-size rows of 4 (`RECAP_COLUMNS = 4`, giving a deterministic 4+3 split) rather than relying on width-dependent `flex-wrap`, because the developer explicitly wanted a predictable, even-as-possible row grouping.

## Deviations from Plan

This plan closed with 7 additional commits beyond the original 3 tasks, driven by 4 rounds of live developer feedback during the 45-05-04 human-verify checkpoint. All are documented here per the executor's deviation protocol; none were fabricated approvals — every round was verified with the full automated gate suite (shared/server/client tests, typecheck, stylelint, check-contrast, knip) before being re-presented, and the final round was pre-approved by the developer contingent on green gates (satisfied).

### Auto-fixed / developer-requested issues

**1. [Rule 1 - Bug, developer-reported, blocking] Red-carded piece falsely blocked the free-kick defender-zone check**
- **Found during:** Checkpoint 45-05-04 live verification (pre-existing bug, not introduced by this plan)
- **Issue:** `FreeKickSetupPanel.tsx`'s client-side "Defending zone: N player(s) too close" recount used raw team pieces without the shared BUG-38 `isActivePiece` predicate, unlike the server-authoritative equivalent in `gameEngine.ts`. A red-carded/sent-off piece keeps a live on-pitch `position`, so it falsely counted as "too close" and disabled Confirm even when the server would have accepted ending the turn — blocking live gameplay entirely, which also blocked the developer from completing the verification script.
- **Fix:** Filtered `myPieces` through `isActivePiece`, matching the server-side pattern and the established BUG-38 convention used at 40+ other sites in the codebase.
- **Files modified:** `packages/client/src/components/FreeKickSetupPanel.tsx`, `.test.tsx`
- **Verification:** New regression test (`stage 1: a RED-CARDED defending-team piece within 2 hexes is excluded`); full 30-test `FreeKickSetupPanel.test.tsx` suite green.
- **Committed in:** `83c8525e`

**2. [Rule 1 - Bug, developer-reported] Mangled "Actions Position for Kick!" final-third helper text**
- **Found during:** Checkpoint 45-05-04 live verification (pre-existing bug)
- **Issue:** `ActionPanel.tsx`'s FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE helper text was "Position for Kick!", which combined with the `PanelShell` "Actions" heading directly above it to read as "Actions Position for Kick!" — a mangled phrase, and inaccurate besides (this phase is a final-third free-repositioning phase, unrelated to any kick).
- **Fix:** Renamed to "Free Move!", matching this file's existing short-noun-phrase-plus-exclamation convention (`Move!`, `Loose Ball!`, `Quick Throw!`) and `GameBoard.tsx`'s own "FREE MOVE" phase-label wording.
- **Files modified:** `packages/client/src/components/ActionPanel.tsx`, `.test.tsx`
- **Verification:** Updated the two affected named tests; full 87-test `ActionPanel.test.tsx` suite green.
- **Committed in:** `3eed1935`

**3. [Deviation — outside plan scope, developer-requested] Round 1: modal chrome adjustments**
- **Found during:** Checkpoint 45-05-04, round 1 feedback
- **Issue:** Three requests: (a) remove the corner `×` dismiss control; (b) the footer Close button's near-black default-CTA color read as "black"; (c) the standalone modal showed no score info at all, unlike the HALF_TIME/FULL_TIME overlay.
- **Fix:** (a) Removed `.closeIconButton` and its aria-label; the footer Close button is now the sole dismiss control (this revises T-45-18's originally-documented "two dismiss controls" threat-model mitigation — flagged here for visibility, still mitigated since Close stays always-visible outside the scroll region). (b) Recolored the footer button from `--color-bg-surface-alt` (the app's shared near-black at-rest CTA convention) to the solid-green `--color-cta-ready-bg`/`-hover` pair already used by `LineupAssignmentScreen.tsx`'s `.resumeButton`. (c) Added a compact score row below the title (superseded by round 2 below).
- **Files modified:** `packages/client/src/components/MatchSummaryModal.tsx`, `.module.css`, `GameBoard.matchSummary.test.tsx`
- **Verification:** Full automated gate suite green (shared 902, server 1625/1627, client 1209, typecheck, stylelint, check-contrast, knip).
- **Committed in:** `3bd4c5d4`

**4. [Deviation — outside plan scope, developer-requested] Round 1: settings recap Speed + colored bubbles**
- **Found during:** Checkpoint 45-05-04, round 1 feedback
- **Issue:** Two requests: (a) the settings recap was missing Game Speed; (b) restyle from inline parenthetical text to colored bubbles (red for disabled, green for enabled; Leniency green if overridden).
- **Fix:** (a) Added Speed as a 7th recap item — **this is a deliberate override of D-13** (45-CONTEXT.md), which originally scoped Speed OUT of this recap ("not requested"). Documented as an explicit scope discrepancy, not a silent expansion. (b) Replaced parenthetical text with colored bubbles; the 5 boolean toggles use a strict red/green binary, Speed reuses its own per-speed hue (not boolean), Leniency was green-if-overridden in this round (flipped in round 4, see below).
- **Files modified:** `packages/client/src/components/MatchSummaryContent.tsx`, `.module.css`, `.test.tsx`
- **Verification:** Full automated gate suite green.
- **Committed in:** `a611daa8`

**5. [Deviation — outside plan scope, developer-requested] Round 2: unified score row (MatchScoreRow)**
- **Found during:** Checkpoint 45-05-04, round 2 feedback (verbatim: "use the original size and display of the half time score on the realtime pop - why are they 2 different elements... let me know if there is a reason these are different despite the design push to use the same element")
- **Issue:** Round 1's score row was a smaller, improvised variant (40px badges, a locally-scoped 32px numeral) rather than reusing the HALF_TIME/FULL_TIME overlay's own big score row (150px badges, 120px numerals). There was no spec (45-CONTEXT.md D-10 only constrains the overlay's own header) or technical constraint forcing this difference — an unstated judgment call.
- **Fix:** Extracted the score-row shell into a new shared `MatchScoreRow` component (self-contained, taking a `center` prop for the phase-specific/modal-specific centre content). `GameBoard.tsx`'s HALF_TIME/FULL_TIME overlays and `MatchSummaryModal.tsx` now render the byte-identical shell. The modal's centre content is the live match clock (MM:00 format) — this executor's judgment call per the coordinator's guidance, justified because the modal can open mid-match (not just at a phase boundary) and its fixed backdrop hides the persistent clock while open.
- **Files modified:** New `MatchScoreRow.tsx`/`.module.css`; modified `GameBoard.tsx`, `.module.css`, `MatchSummaryModal.tsx`, `.module.css`, `GameBoard.matchSummary.test.tsx`
- **Verification:** Full automated gate suite green; new/updated tests for the shared-shell reuse.
- **Committed in:** `0d8a6d38`

**6. [Deviation — outside plan scope, developer-requested] Round 3: fixed-column, centered settings-recap rows**
- **Found during:** Checkpoint 45-05-04, round 3 feedback (verbatim: "display the same number of settings per row and center settings instead of left aligning them")
- **Issue:** The 7 recap bubbles flowed as a single left-aligned `flex-wrap` line, wrapping at an unpredictable, width-dependent point.
- **Fix:** Added a `chunk()` helper grouping items into fixed-size rows of `RECAP_COLUMNS = 4` (a deterministic 4+3 split for 7 items, matching the developer's own example); each row centers independently via `justify-content: center` on its own flex line (`.recapRow` nested inside a new `.recapGrid`).
- **Files modified:** `packages/client/src/components/MatchSummaryContent.tsx`, `.module.css`, `.test.tsx`
- **Verification:** Full automated gate suite green; new structural regression test (DOM parent-element comparison, not a CSS class-name assertion) locking in the 4+3 grouping.
- **Committed in:** `9f2efb2a`

**7. [Deviation — outside plan scope, developer-requested] Round 4: full-width recap stretch + flipped Leniency color**
- **Found during:** Checkpoint 45-05-04, round 4 feedback (verbatim: "center seetngs on the popup. swap the red/green rule for ref leniency show it shows green if its teh default setting (auto)")
- **Issue:** (a) The round-3 centering was only relative to whatever box the recap rows happened to occupy — not reliably the popup's actual full content width. (b) The Referee Leniency bubble color rule was backwards from what the developer wanted: green should mean "at its default (Auto)", not "was manually touched".
- **Fix:** (a) Added explicit `width: 100%` at every ancestor level from `MatchSummaryContent`'s `.root` down through `.settingsSection`/`.recapGrid`/`.recapRow`, plus both consuming wrappers (`MatchSummaryModal`'s `.scrollBody` and `GameBoard`'s `.embeddedSummaryWrapper`) — removing any ambiguity about implicit block/flex-stretch sizing so the recap centers against the popup's real width in both surfaces. (b) Flipped the ternary: green for `wasManualOverride !== true` (Auto/default), red for `wasManualOverride === true` (manual/non-default).
- **Files modified:** `packages/client/src/components/GameBoard.module.css`, `MatchSummaryContent.tsx`, `.module.css`, `.test.tsx`, `MatchSummaryModal.module.css`
- **Verification:** Full automated gate suite green; new regression test asserting the flipped color direction via the rendered `className` (empirically confirmed under this project's Vite/vitest CSS Modules config to embed the literal class name as a readable prefix, e.g. `_settingsBubbleGreen_<hash>` — a legitimate structural assertion, not a brittle guess).
- **Committed in:** `fe5cf56a`
- **Pre-approval:** The developer pre-approved the checkpoint contingent on this round landing correctly and gates staying green — satisfied, so no further checkpoint re-presentation was made after this commit.

---

**Total deviations:** 7 (2 pre-existing bug fixes surfaced during live verification, 5 rounds of developer-requested UI/UX refinement on the new modal/recap surfaces)
**Impact on plan:** No scope creep beyond what the developer explicitly and repeatedly requested during the mandated live-verification checkpoint. Two items are worth flagging for future audit: (1) the threat model's T-45-18 mitigation text (two dismiss controls) is now stale — the modal has one; the underlying DoS concern remains mitigated via the always-visible footer Close button. (2) 45-CONTEXT.md's D-13 (Speed explicitly out of scope for the settings recap) was deliberately overridden per direct developer request — documented, not silent.

## Issues Encountered

- Task 1's literal acceptance-criteria grep check (`grep -c 'MatchSummaryContent' packages/client/src/components/GameBoard.tsx` expected to return 2) actually returns 3 once the required `import` statement is counted — this is an unavoidable artifact of the literal grep check not anticipating the import line; the substantive intent (exactly one JSX render of `MatchSummaryContent` per overlay, no third direct render bypassing `MatchSummaryModal`) is satisfied and was independently verified via `grep -n`.
- `pnpm --filter @counter-attack/server test` intermittently hit a known Windows vitest worker-crash flake (`--pool=threads` default); resolved every time by rerunning with `--pool=forks` per the documented workaround (memory: "GSD Execute-Phase Windows Quirks").
- The worktree had no `node_modules` at session start (a fresh git worktree, distinct from the main repo checkout); resolved with `pnpm install --frozen-lockfile`, which used the shared pnpm content-addressable store (no meaningful disk duplication, no risk to sibling worktrees).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 45-06 (per ROADMAP.md) can proceed — this plan's `MatchSummaryModal`, `MatchScoreRow`, and the icon/overlay integration points are all in place and verified.
- Known non-blocking item: `pnpm lint` (workspace-wide) still fails only on the pre-existing, previously-documented `packages/shared` typescript-eslint file-count-cap issue (unrelated to any change in this plan; `packages/client` and `packages/server` lint clean via their own scoped checks — this project's `pnpm lint` OOM issue is tracked separately, see PROJECT.md's "Known tech debt" section).
- Threat model T-45-18 in `45-05-PLAN.md` describes a now-superseded "two dismiss controls" mitigation (the modal has one, per round-1 developer request) — worth a documentation pass at milestone close, not a functional gap.

---
*Phase: 45-game-summary-popup*
*Completed: 2026-08-28*

## Self-Check: PASSED

- FOUND: packages/client/src/components/MatchSummaryModal.tsx
- FOUND: packages/client/src/components/MatchSummaryModal.module.css
- FOUND: packages/client/src/components/MatchScoreRow.tsx
- FOUND: packages/client/src/components/MatchScoreRow.module.css
- FOUND: packages/client/src/components/GameBoard.matchSummary.test.tsx
- FOUND: commit 6d4f2110 (feat: build standalone MatchSummaryModal chrome)
- FOUND: commit bbeda8f0 (feat: add scoreboard (i) icon and mount MatchSummaryModal)
- FOUND: commit 082ebb4e (feat: append match summary inside HALF_TIME/FULL_TIME overlays)
- FOUND: commit 83c8525e (fix: exclude red-carded pieces from free-kick defender-zone check)
- FOUND: commit 3eed1935 (fix: correct mangled final-third free-move helper text)
- FOUND: commit 3bd4c5d4 (fix: remove modal corner x, restyle Close, add scoreboard row)
- FOUND: commit a611daa8 (fix: add Speed and colored bubbles to the settings recap)
- FOUND: commit 0d8a6d38 (fix: unify standalone modal and half-time score rows into MatchScoreRow)
- FOUND: commit 9f2efb2a (fix: center settings recap bubbles in fixed-size rows)
- FOUND: commit fe5cf56a (fix: stretch settings recap to full popup width, flip leniency color)
