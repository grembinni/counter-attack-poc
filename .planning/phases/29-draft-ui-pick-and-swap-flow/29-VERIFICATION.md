---
phase: 29-draft-ui-pick-and-swap-flow
verified: 2026-07-21T17:49:19Z
status: gaps_found
score: 2/5 must-haves fully verified (1 additional partial, 1 not exercised, 2 failed)
---

# Phase 29: Draft UI + Pick-and-Swap Flow Verification Report

**Phase Goal:** Players can complete a full draft session in real time — a 7-card carousel screen appears between team selection and lineup; 4 pick-and-swap cycles deliver 16 cards per player; keeper safety triggers automatically on the 4th cycle if needed; overflow drafted players appear on a dynamic bench carousel; post-draft, players are NOT auto-repositioned — jersey numbers and team colors are applied automatically.
**Verified:** 2026-07-21T17:49:19Z (automated gate) / human walkthrough same session
**Status:** gaps_found

## Goal Achievement

### Observable Truths

| #   | Truth                                                                              | Status               | Evidence                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Draft screen appears with 7-card carousel above lineup grid (DRAFT-06)             | ✓ VERIFIED (partial) | Screen appears and carousel renders, but cards are too narrow to display player stats legibly                                                                                        |
| 2   | Two players complete 4 pick-and-swap cycles delivering 16 cards each (DRAFT-07)    | ✓ VERIFIED           | Both players completed all 4 cycles, 16 cards each — drag-and-drop worked reliably during the draft itself                                                                           |
| 3   | Cycle-4 keeper safety auto-selects a keeper (DRAFT-08)                             | ? NOT EXERCISED      | Draft completed but this session didn't deliberately test the keeperless-until-cycle-4 scenario                                                                                      |
| 4   | Overflow drafted players appear on a dynamic bench carousel (DRAFT-09)             | ✗ FAILED             | Bench renders as a static list/row, not a carousel                                                                                                                                   |
| 5   | Post-draft: no auto-repositioning, jersey numbers + team colors applied (DRAFT-10) | ✗ FAILED             | Post-draft roster rearrangement (dragging between lineup/bench after the draft ends) breaks after the first adjustment, and players have no stats or positions once the match starts |

**Score:** 2/5 truths fully verified, 1 partial (DRAFT-06), 1 not exercised (DRAFT-08), 2 failed (DRAFT-09, DRAFT-10)

### Required Artifacts

| Artifact                                               | Expected                             | Status                     | Details                                                                                                                             |
| ------------------------------------------------------ | ------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `packages/client/src/components/DraftPackCarousel.tsx` | Draft carousel (built in 29-03)      | ✓ EXISTS                   | Renders, but card width insufficient for stat display (human-reported)                                                              |
| `packages/client/src/components/BenchCarousel.tsx`     | Bench carousel (built in 29-03)      | ✗ NOT BEHAVING AS CAROUSEL | Component exists but human testing shows it does not present/navigate as a carousel                                                 |
| `packages/server/src/draftSession.ts`                  | Draft state machine (built in 29-02) | ✓ HOLDS UP UNDER LIVE PLAY | Automated unit/integration tests pass; live session confirms the 4-cycle pick-and-swap machine works correctly through a full draft |

### Key Link Verification

| From                                           | To                                     | Via                                                                                   | Status                  | Details                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LineupAssignmentScreen.tsx`                   | `roomHandlers.ts`                      | `DRAFT_PICK` emit → server handler → `DRAFT_STATE_UPDATED` unicast → client re-render | ✓ HOLDS UP DURING DRAFT | All in-draft picks/swaps across 4 cycles worked correctly for both players                                                                                    |
| `LineupAssignmentScreen.tsx` (post-draft mode) | `roomHandlers.ts` (`DRAFT_REARRANGE`)  | Free lineup/bench drag-and-drop after the draft ends, before Confirm                  | ✗ NOT HOLDING UP        | Breaks after the first post-draft adjustment attempt (human-reported)                                                                                         |
| Draft hand-off                                 | Standard lineup-confirm → `GAME_STATE` | Existing `LINEUP_CONFIRM` flow reused per plan objective                              | ✗ NOT WIRED CORRECTLY   | Match starts after draft-mode lineup-confirm, but on-pitch players have no stats or positions — the draft-drafted roster is not correctly reaching game start |

**Wiring:** 1/3 connections fully holding up under human testing (in-draft pick/swap wiring holds; post-draft rearrange and post-confirm hand-off do not)

## Requirements Coverage

| Requirement                                                | Status          | Blocking Issue                                                                                                |
| ---------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------- |
| DRAFT-06: Draft carousel screen                            | ⚠️ PARTIAL      | Card width too narrow for player stats                                                                        |
| DRAFT-07: 4-cycle pick-and-swap via WebSocket              | ✓ SATISFIED     | -                                                                                                             |
| DRAFT-08: Cycle-4 keeper safety                            | ? NEEDS RE-TEST | Not deliberately exercised this session                                                                       |
| DRAFT-09: Dynamic bench carousel                           | ✗ BLOCKED       | Bench is not implemented/behaving as a carousel; post-draft bench↔lineup drag also broken                     |
| DRAFT-10: Post-draft numbering, no auto-reposition, colors | ✗ BLOCKED       | Post-draft rearrangement breaks after first adjustment; players missing stats/positions once the match starts |

**Coverage:** 1/5 requirements fully satisfied under live human testing (DRAFT-07); DRAFT-06 partial; DRAFT-08 needs re-test; DRAFT-09/DRAFT-10 blocked

## Anti-Patterns Found

None identified via code inspection at this stage — gaps below were surfaced by live human testing, not static analysis. Root cause for each requires investigation during gap-closure planning.

## Human Verification Required

Re-run after gap-closure fixes land:

1. Full 8-step two-browser walkthrough from `29-06-PLAN.md` Task 2 — specifically re-confirm cycle-4 keeper safety (deliberately withhold a keeper until cycle 4) and reconnect, neither of which was deliberately exercised this session even though the draft itself completed.

## Gaps Summary

### Critical Gaps (Block Progress)

1. **Post-draft roster rearrangement breaks after the first adjustment**
   - Missing: Reliable repeat drag-and-drop for freely rearranging the already-drafted lineup/bench after the draft ends and before Confirm
   - Impact: In-draft drag-and-drop (the pick mechanism across all 4 cycles) works correctly — both players completed the draft with 16 cards each. The break is specifically in post-draft free rearrangement: after the first lineup/bench adjustment post-draft, further drags stop working. This blocks the documented "arrangement made during the draft stands" capability (D-15) and likely compounds into the DRAFT-10 hand-off gap below
   - Fix: Investigate client-side drag state (`LineupAssignmentScreen.tsx` `dragState`, built in 29-05) specifically in the post-draft mode branch — likely a mode-transition flag (in-draft vs. post-draft-free-rearrange) or `DRAFT_REARRANGE` round-trip isn't correctly re-enabling drag sources after the first successful post-draft drop

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

### 29-07-PLAN.md: Fix post-draft drag-and-drop reliability + bench carousel

**Objective:** Restore repeat drag-and-drop for post-draft roster rearrangement and bring the bench in line with the carousel UI-SPEC contract

**Tasks:**

1. Diagnose and fix drag-state reset bug in `LineupAssignmentScreen.tsx`'s post-draft rearrange mode, specifically after the first successful post-draft adjustment (in-draft pick/swap drag-and-drop already works correctly — do not regress it)
2. Rework `BenchCarousel.tsx` to match the carousel nav/chrome contract used by `DraftPackCarousel.tsx`
3. Verify: after completing a full 4-cycle draft, perform multiple consecutive post-draft lineup/bench rearrangements in a real two-browser session without drag-and-drop failure; confirm bench carousel navigation

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
