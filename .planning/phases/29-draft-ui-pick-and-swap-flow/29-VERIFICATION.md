---
phase: 29-draft-ui-pick-and-swap-flow
verified: 2026-07-21T17:49:19Z
status: gaps_found
score: 2/5 must-haves verified (human walkthrough interrupted by functional gaps)
---

# Phase 29: Draft UI + Pick-and-Swap Flow Verification Report

**Phase Goal:** Players can complete a full draft session in real time — a 7-card carousel screen appears between team selection and lineup; 4 pick-and-swap cycles deliver 16 cards per player; keeper safety triggers automatically on the 4th cycle if needed; overflow drafted players appear on a dynamic bench carousel; post-draft, players are NOT auto-repositioned — jersey numbers and team colors are applied automatically.
**Verified:** 2026-07-21T17:49:19Z (automated gate) / human walkthrough same session
**Status:** gaps_found

## Goal Achievement

### Observable Truths

| #   | Truth                                                                              | Status               | Evidence                                                                                                                      |
| --- | ---------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Draft screen appears with 7-card carousel above lineup grid (DRAFT-06)             | ✓ VERIFIED (partial) | Screen appears and carousel renders, but cards are too narrow to display player stats legibly                                 |
| 2   | Two players complete 4 pick-and-swap cycles delivering 16 cards each (DRAFT-07)    | ✗ FAILED             | Drag-and-drop stopped working after the first roster adjustment, blocking further picks                                       |
| 3   | Cycle-4 keeper safety auto-selects a keeper (DRAFT-08)                             | ? UNCERTAIN          | Not reachable in walkthrough — blocked by drag-and-drop failure before cycle 4                                                |
| 4   | Overflow drafted players appear on a dynamic bench carousel (DRAFT-09)             | ✗ FAILED             | Bench renders as a static list/row, not a carousel                                                                            |
| 5   | Post-draft: no auto-repositioning, jersey numbers + team colors applied (DRAFT-10) | ✗ FAILED             | After the draft completes and the match starts, players have no stats or positions — they don't render correctly on the pitch |

**Score:** 1/5 truths fully verified (truth 1 partially verified — carousel present but cards too narrow)

### Required Artifacts

| Artifact                                               | Expected                             | Status                     | Details                                                                                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/client/src/components/DraftPackCarousel.tsx` | Draft carousel (built in 29-03)      | ✓ EXISTS                   | Renders, but card width insufficient for stat display (human-reported)                                                                                                                              |
| `packages/client/src/components/BenchCarousel.tsx`     | Bench carousel (built in 29-03)      | ✗ NOT BEHAVING AS CAROUSEL | Component exists but human testing shows it does not present/navigate as a carousel                                                                                                                 |
| `packages/server/src/draftSession.ts`                  | Draft state machine (built in 29-02) | ? UNCERTAIN                | Automated unit/integration tests pass; live drag-and-drop failure after first pick suggests a client-side state desync with server, or a rearrange/pick payload issue not covered by existing tests |

### Key Link Verification

| From                         | To                                     | Via                                                                                   | Status                | Details                                                                                                                                                       |
| ---------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LineupAssignmentScreen.tsx` | `roomHandlers.ts`                      | `DRAFT_PICK` emit → server handler → `DRAFT_STATE_UPDATED` unicast → client re-render | ✗ NOT HOLDING UP      | Works for the first pick/adjustment; breaks on the second drag-and-drop attempt (human-reported)                                                              |
| Draft hand-off               | Standard lineup-confirm → `GAME_STATE` | Existing `LINEUP_CONFIRM` flow reused per plan objective                              | ✗ NOT WIRED CORRECTLY | Match starts after draft-mode lineup-confirm, but on-pitch players have no stats or positions — the draft-drafted roster is not correctly reaching game start |

**Wiring:** 0/2 connections fully holding up under human testing (automated tests for these paths were green, but did not catch the live-session failures)

## Requirements Coverage

| Requirement                                                | Status          | Blocking Issue                                        |
| ---------------------------------------------------------- | --------------- | ----------------------------------------------------- |
| DRAFT-06: Draft carousel screen                            | ⚠️ PARTIAL      | Card width too narrow for player stats                |
| DRAFT-07: 4-cycle pick-and-swap via WebSocket              | ✗ BLOCKED       | Drag-and-drop breaks after first roster adjustment    |
| DRAFT-08: Cycle-4 keeper safety                            | ? NEEDS RE-TEST | Blocked from reaching cycle 4 in this session         |
| DRAFT-09: Dynamic bench carousel                           | ✗ BLOCKED       | Bench is not implemented/behaving as a carousel       |
| DRAFT-10: Post-draft numbering, no auto-reposition, colors | ✗ BLOCKED       | Players missing stats/positions once the match starts |

**Coverage:** 0/5 requirements fully satisfied under live human testing (all 5 have automated coverage from Plans 01-05, but the live session surfaced gaps the automated suite did not catch)

## Anti-Patterns Found

None identified via code inspection at this stage — gaps below were surfaced by live human testing, not static analysis. Root cause for each requires investigation during gap-closure planning.

## Human Verification Required

Re-run after gap-closure fixes land:

1. Full 8-step two-browser walkthrough from `29-06-PLAN.md` Task 2, including cycle-4 keeper safety and reconnect (not reached this session due to the drag-and-drop blocker).

## Gaps Summary

### Critical Gaps (Block Progress)

1. **Drag-and-drop stops working after the first roster adjustment**
   - Missing: Reliable repeat drag-and-drop across multiple picks/rearranges in a single draft session
   - Impact: Blocks DRAFT-07 entirely — a draft cannot be completed past the first move; this is the core interaction of the phase
   - Fix: Investigate client-side drag state (`LineupAssignmentScreen.tsx` `dragState`, built in 29-05) for a reset/stale-reference bug after the first successful drop, and/or a server round-trip (`DRAFT_STATE_UPDATED`) that isn't correctly re-enabling drag sources on re-render

2. **Bench is not set up as a carousel**
   - Missing: Left-right navigable carousel behavior for the bench (DRAFT-09 requires "the same card display as the draft stage")
   - Impact: Fails DRAFT-09 directly; dynamically-sized bench doesn't match the required carousel UX
   - Fix: Revisit `BenchCarousel.tsx` (built in 29-03) against the UI-SPEC carousel contract — likely missing nav controls or rendering as a plain flex row instead of the carousel chrome used by `DraftPackCarousel.tsx`

3. **Players have no stats or positions once the match starts (post-draft hand-off)**
   - Missing: Correct hand-off from the draft-mode lineup/bench arrangement into the game-start roster (`GAME_STATE`)
   - Impact: Fails DRAFT-10 and breaks the actual playable match — the entire point of completing a draft. This is the most severe gap.
   - Fix: Investigate the `LINEUP_CONFIRM` → `GAME_STATE` path (in `roomHandlers.ts`, wired in 29-04) for draft-mode rooms — likely the draft-mode roster (drafted `PlayerId[]` from lineup + bench) isn't being resolved to full player records (stats/position) the same way the Standard-mode path does

### Non-Critical Gaps (Can Defer)

1. **Draft card not wide enough to display player stats legibly**
   - Issue: Card width in `DraftPackCarousel.tsx` / shared `DraftCardBody` renderer (built in 29-03) truncates or crowds stat display
   - Impact: Readability/UX issue; does not block completing a draft, but degrades the experience UI-SPEC calls for (this is a UI-hint=yes phase)
   - Recommendation: Fix alongside the bench-carousel gap since both touch the same card-rendering/carousel CSS

2. **Enable legends and icons (modern pools)**
   - Issue: User requested enabling 'legends'/'icons' draft pools
   - Impact: None — this is explicitly out of scope for this phase by design. `packages/shared/src/draftEngine.ts` documents: `'legends' / 'icons': not selectable in v1 (DRAFT-11, deferred) — always false.`
   - Recommendation: Not a Phase 29 gap. Track as a future phase against requirement DRAFT-11 if desired; do not include in this phase's gap-closure cycle.

## Recommended Fix Plans

### 29-07-PLAN.md: Fix drag-and-drop reliability + bench carousel

**Objective:** Restore repeat drag-and-drop across a full draft session and bring the bench in line with the carousel UI-SPEC contract

**Tasks:**

1. Diagnose and fix drag-state reset bug in `LineupAssignmentScreen.tsx` after the first successful pick/rearrange
2. Rework `BenchCarousel.tsx` to match the carousel nav/chrome contract used by `DraftPackCarousel.tsx`
3. Verify: complete a full 4-cycle draft in a real two-browser session without drag-and-drop failure; confirm bench carousel navigation

**Estimated scope:** Medium

---

### 29-08-PLAN.md: Fix post-draft hand-off to game start

**Objective:** Ensure drafted rosters (lineup + bench) correctly resolve to full player records (stats, position) when the match starts

**Tasks:**

1. Trace the `LINEUP_CONFIRM` → `GAME_STATE` path for draft-mode rooms; compare against the Standard-mode resolution path
2. Fix the roster resolution so drafted `PlayerId[]` correctly maps to full player data at game start
3. Verify: complete a draft, confirm lineup, and confirm all 22 on-pitch pieces render with correct stats/positions

**Estimated scope:** Small-Medium

---

### 29-09-PLAN.md: Widen draft cards for stat legibility

**Objective:** Fix card width so player stats are fully legible in the draft/bench carousels

**Tasks:**

1. Adjust `DraftCardBody`/card CSS dimensions in `DraftPackCarousel.tsx` and the shared tier-border classes
2. Verify: stats are fully visible and not truncated at the carousel's rendered card size

**Estimated scope:** Small

## Verification Metadata

**Verification approach:** Plan 29-06 Task 1 (automated gate) + Task 2 (human two-browser walkthrough), interrupted by functional gaps before all 8 steps could complete
**Must-haves source:** 29-06-PLAN.md frontmatter (must_haves.truths, derived from ROADMAP.md Phase 29 success criteria)
**Automated checks:** 3 passed (typecheck, full test suite — 1527 tests, build) — all green; these did not catch the live-session gaps
**Human checks required:** Re-test all 8 walkthrough steps after gap-closure (29-07/29-08/29-09)
**Total verification time:** Task 1 ~5 min; Task 2 human session interrupted

---

_Verified: 2026-07-21T17:49:19Z_
_Verifier: Claude (orchestrator, human-verify checkpoint)_
