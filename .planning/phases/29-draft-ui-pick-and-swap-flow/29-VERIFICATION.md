---
phase: 29-draft-ui-pick-and-swap-flow
verified: 2026-07-21T19:36:38Z
status: gaps_found
score: 4/5 truths verified, 1 failed (new lineup slot-to-slot swap gap)
---

# Phase 29: Draft UI + Pick-and-Swap Flow Verification Report

**Phase Goal:** Players can complete a full draft session in real time — a 7-card carousel screen appears between team selection and lineup; 4 pick-and-swap cycles deliver 16 cards per player; keeper safety triggers automatically on the 4th cycle if needed; overflow drafted players appear on a dynamic bench carousel; post-draft, players are NOT auto-repositioned — jersey numbers and team colors are applied automatically.
**Verified:** 2026-07-21T19:36:38Z (29-09 re-verification, after 29-07/29-08 gap-closure merge)
**Status:** gaps_found

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                      | Status     | Evidence                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Draft screen appears with 7-card carousel above lineup grid (DRAFT-06)                                                     | ✓ VERIFIED | Human confirmed cards are legible following 29-08's card-width fix (260px → 320px `.cardTier*`); no truncation/crowding reported this pass                                                                                                                       |
| 2   | Two players complete 4 pick-and-swap cycles delivering 16 cards each (DRAFT-07)                                            | ✓ VERIFIED | Both players completed all 4 cycles again with no regression                                                                                                                                                                                                     |
| 3   | Cycle-4 keeper safety auto-selects a keeper (DRAFT-08)                                                                     | ✓ VERIFIED | Deliberately exercised this pass (previously not exercised in 29-06); human reported "all other tests pass" covering the full 8-step script including this scenario                                                                                              |
| 4   | Overflow drafted players appear on a dynamic bench carousel (DRAFT-09)                                                     | ✓ VERIFIED | 29-08's carousel rework (viewport/track/nav matching `DraftPackCarousel`) holds up under live testing — bench navigates left/right                                                                                                                               |
| 5   | Post-draft: no auto-repositioning, jersey numbers + team colors applied (DRAFT-10)                                         | ✓ VERIFIED | 29-07's `LINEUP_CONFIRM` draft-mode hand-off fix holds — match starts with all 22 on-pitch pieces showing correct stats/positions                                                                                                                                |
| 6   | **NEW:** Post-draft lineup-slot ↔ lineup-slot rearrangement preserves both cards (swap), not one-way displacement to bench | ✗ FAILED   | Human report (verbatim): "bug - when swapping players in the lineup they should trade places. currently the replaced player is being sent to the bench. all other tests pass." Isolated to slot↔slot moves; bench↔slot moves work correctly per the same report. |

**Score:** 5/6 rows verified if counting the original DRAFT-06..10 set (all 5 now pass); 1 new truth added this pass (row 6) and it fails. Reported per-phase as: 4/5 of the _original_ must-have truths from 29-09-PLAN.md fully pass end-to-end without any caveat surfacing during the walkthrough that touches rearrangement (DRAFT-09/DRAFT-10 truths pass their own scripted steps, but the same underlying `applyRearrange` code path used by those truths has a newly-discovered defect for one specific interaction shape — slot-to-slot — not exercised by the original 8-step script's wording).

### Required Artifacts

| Artifact                                               | Expected                                                    | Status                     | Details                                                                                                                                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/client/src/components/DraftPackCarousel.tsx` | Draft carousel (built in 29-03)                             | ✓ EXISTS, VERIFIED         | Card width fix (29-08) confirmed legible in live session                                                                                                                  |
| `packages/client/src/components/BenchCarousel.tsx`     | Bench carousel (built in 29-03)                             | ✓ EXISTS, VERIFIED         | Carousel rework (29-08) confirmed navigating correctly in live session                                                                                                    |
| `packages/server/src/draftSession.ts`                  | Draft state machine (built in 29-02)                        | ⚠️ PARTIAL — NEW GAP FOUND | 4-cycle pick-and-swap machine holds up under live play; `applyRearrange`'s slot→slot branch does not implement a true swap (see Gap below)                                |
| `packages/server/src/roomHandlers.ts`                  | `DRAFT_REARRANGE`/`LINEUP_CONFIRM` lifecycle guards (29-07) | ✓ HOLDS UP                 | Post-draft rearrange stays legal repeatedly (no more "first one works then wedges"); draft-mode `LINEUP_CONFIRM` resolves full 22-piece roster into `GameState` correctly |

### Key Link Verification

| From                                           | To                                     | Via                                                                                   | Status                  | Details                                                                                                                                                                                                                                 |
| ---------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LineupAssignmentScreen.tsx`                   | `roomHandlers.ts`                      | `DRAFT_PICK` emit → server handler → `DRAFT_STATE_UPDATED` unicast → client re-render | ✓ HOLDS UP DURING DRAFT | All in-draft picks/swaps across 4 cycles worked correctly for both players (non-regression confirmed again)                                                                                                                             |
| `LineupAssignmentScreen.tsx` (post-draft mode) | `roomHandlers.ts` (`DRAFT_REARRANGE`)  | Free lineup/bench drag-and-drop after the draft ends, before Confirm                  | ⚠️ PARTIAL — NEW GAP    | Bench↔lineup and lineup↔bench moves apply repeatedly and correctly (29-07 fix holds). Lineup-slot ↔ lineup-slot moves apply but with wrong semantics: displaced occupant goes to bench instead of trading places with the dragged card. |
| Draft hand-off                                 | Standard lineup-confirm → `GAME_STATE` | Existing `LINEUP_CONFIRM` flow reused per plan objective                              | ✓ HOLDS UP              | Match starts after draft-mode lineup-confirm; all 22 on-pitch pieces render with correct stats/positions (29-07 fix holds)                                                                                                              |

**Wiring:** 2/3 connections fully holding up under human testing this pass; the post-draft rearrange connection holds for bench↔slot moves but has a specific semantic defect for slot↔slot moves.

## Requirements Coverage

| Requirement                                                | Status      | Blocking Issue                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DRAFT-06: Draft carousel screen                            | ✓ SATISFIED | -                                                                                                                                                                                                                                                                                                                         |
| DRAFT-07: 4-cycle pick-and-swap via WebSocket              | ✓ SATISFIED | -                                                                                                                                                                                                                                                                                                                         |
| DRAFT-08: Cycle-4 keeper safety                            | ✓ SATISFIED | Deliberately re-tested this pass; passes                                                                                                                                                                                                                                                                                  |
| DRAFT-09: Dynamic bench carousel                           | ✓ SATISFIED | Carousel navigation itself passes; the shared rearrange-semantics gap below does not block DRAFT-09's own scripted step (bench↔lineup), but is tracked here since it's the same subsystem                                                                                                                                 |
| DRAFT-10: Post-draft numbering, no auto-reposition, colors | ⚠️ PARTIAL  | Hand-off to game start is correct (22 pieces, stats, positions). New gap: slot-to-slot rearrangement auto-displaces a player to the bench against the player's intent, which is arguably a violation of "no auto-repositioning" (D-08/D-15) even though it is a _documented_ D-07 behavior — see Gap below for the nuance |

**Coverage:** 4/5 requirements fully satisfied under live human testing this pass (DRAFT-06/07/08/09); DRAFT-10 partial pending resolution of the slot-to-slot swap gap.

## Anti-Patterns Found

None identified via code inspection beyond the gap below — the gap was surfaced by live human testing (a UX/semantics mismatch), not a crash or exception.

## Human Verification Required

Re-run after gap-closure fix for the item below lands:

1. Repeat the post-draft rearrange step of the two-browser walkthrough, specifically targeting lineup-slot ↔ lineup-slot drags (not just lineup↔bench), and confirm both cards trade places.

## Gaps Summary

### Critical Gaps (Block Progress)

1. **Lineup-slot ↔ lineup-slot rearrangement does not swap — it displaces the destination occupant to the bench**
   - **Symptom:** When a player drags a card from one filled lineup slot onto another already-filled lineup slot, the dragged card takes the destination slot as expected, but the previously-occupying player is sent to the bench instead of taking the dragged card's now-vacated slot (i.e., no two-way trade).
   - **Human evidence (verbatim):** "bug - when swapping players in the lineup they should trade places. currently the replaced player is being sent to the bench. all other tests pass"
   - **Scope:** Isolated to slot→slot moves. Bench→slot and slot→bench moves are unaffected and confirmed working correctly by the same walkthrough.
   - **Impact:** A player can involuntarily lose their drafted starting position to the bench as a side effect of the _other_ player being repositioned, when the human's (and arguably the more natural) expectation for a same-lineup drag is a trade. This is adjacent to, but distinct from, the D-08/D-15 "arrangement made during the draft stands" / no-unwanted-bench expectations that 29-07 fixed for the general post-draft-rearrange-doesn't-apply bug.
   - **Important nuance — this is a documented design decision, not a plain regression:** The current one-way-displacement behavior implements **D-07** as explicitly written in `29-CONTEXT.md` line 29 ("Dragging a card onto an already-occupied lineup slot replaces the occupant, and the replaced player moves to the bench") and mirrored in `29-RESEARCH.md` (D-07) and `29-UI-SPEC.md` ("Dropping a card onto an occupied lineup slot bumps the occupant to the bench (D-07) — not destructive, fully reversible by dragging again"). The 29-02 executor deliberately chose this uniform behavior for both `applyPick` (drafting onto an occupied slot) and `applyRearrange` (moving an already-drafted card onto an occupied slot) rather than giving `applyRearrange` a second, different code path for slot↔slot (see `29-02-SUMMARY.md` line 31). **D-07 makes total sense for `applyPick`** (a freshly-drafted card has no "home slot" to return the displaced occupant to — bench is the only sane destination). **It does not obviously make sense for `applyRearrange`'s slot→slot case**, where the dragged card _does_ have a well-defined vacated source slot the displaced occupant could go to instead. The next gap-closure plan should treat this as a scope-narrowing correction to D-07 (apply bench-displacement only when `from.type !== 'slot'`, i.e., drafting or bench-origin moves; apply a true two-way swap when both `from` and `to` are lineup slots) rather than a blind bug fix, and should update `29-CONTEXT.md`'s D-07 wording to reflect the narrowed rule once implemented.
   - **Suspected root cause (read-only investigation, no source modified):**
     - `packages/server/src/draftSession.ts`, `applyRearrange` (lines ~258-299). The `to.type === 'slot'` branch (lines ~286-292) unconditionally pushes any `displaced` occupant onto `benchIds` and clears the destination slot to `cardId`, regardless of whether `from.type === 'slot'` or `'bench'`. There is no branch that, when `from.type === 'slot'`, places `displaced` back into `lineupSlots[from.slotIndex]` instead of `benchIds`.
     - `packages/client/src/components/LineupAssignmentScreen.tsx`, `handleDraftSlotDrop` (lines 438-454). The client already distinguishes the slot→slot case (`ds.source === 'slot'`) and sends a fully-formed `{type:'slot', slotIndex: ds.slotIndex} -> {type:'slot', slotIndex}` payload via `onDraftRearrange`. **The client is not the problem** — the payload can already express "move from slot A to slot B"; the server-side `applyRearrange` is what collapses this into a one-way bench-displacement rather than distinguishing the swap case. No client change should be required beyond what's already in place.
     - `packages/server/src/roomHandlers.ts`'s `DRAFT_REARRANGE` handler (lines 913-993) delegates all placement logic to `applyRearrange` unchanged and does not need modification beyond whatever `applyRearrange`'s new signature/behavior requires.
   - **Fix:** See Recommended Fix Plan (29-10) below.

### Non-Critical Gaps (Can Defer)

None outstanding — the two non-critical gaps recorded in the prior verification pass (card width, legends/icons pool) are resolved (card width, closed by 29-08) or out of scope by design (legends/icons, DRAFT-11 deferred, unchanged).

## Recommended Fix Plans

### 29-10-PLAN.md: Fix lineup slot-to-slot swap semantics

**Objective:** Make `applyRearrange` perform a true two-way swap when both `from` and `to` are lineup slots, while preserving the existing D-07 bench-displacement behavior for all other cases (drafting onto an occupied slot via `applyPick`, and bench→slot rearrangement).

**Tasks:**

1. In `packages/server/src/draftSession.ts`, modify `applyRearrange`'s `to.type === 'slot'` branch: when `from.type === 'slot'` AND the destination slot has an occupant (`displaced`), place `displaced` into `lineupSlots[from.slotIndex]` (the just-vacated source slot) instead of pushing it onto `benchIds`. Preserve the existing displace-to-bench behavior when `from.type === 'bench'` (there is no source slot to return the occupant to). Do not touch `applyPick` — drafting a fresh pack card onto an occupied slot has no well-defined "swap partner" and should keep bumping the occupant to the bench exactly as today.
2. Add/extend unit tests in `packages/server/src/__tests__/draftSession.test.ts` (or the integration suite) covering: (a) slot→slot with both slots occupied → true swap (both cards end up in each other's slots, `benchIds` unchanged), (b) slot→bench still displaces correctly (unchanged), (c) bench→slot with an occupied destination still displaces the destination occupant to the bench (unchanged, since there is no source slot to swap into), (d) GK-slot role rule (D-09) still enforced correctly on both sides of a slot↔slot swap (a swap must be rejected if it would place a non-GK card in a GK slot or vice versa, on _either_ end).
3. Update `29-CONTEXT.md`'s D-07 entry to narrow its scope explicitly to non-swap moves (drafting and bench-origin rearrangement), and add a new decision (e.g. D-30 or next available ID) documenting the slot↔slot swap rule, so future readers don't re-introduce the bench-displacement behavior for this case.
4. Verify: live two-browser session — drag a lineup-slot player onto another filled lineup-slot player and confirm both cards trade places (neither lands on the bench); re-confirm bench↔lineup moves are unaffected; re-confirm the GK-slot rule still rejects illegal swaps in both directions.

**Estimated scope:** Small (single-function change, isolated to one branch of `applyRearrange`, plus a documentation correction).

## Verification Metadata

**Verification approach:** Plan 29-09 Task 1 (automated gate, green: typecheck/1542 tests/build) + Task 2 (human two-browser walkthrough covering all 8 steps from the 29-06 script plus deliberate keeper-safety and reconnect re-tests)
**Must-haves source:** 29-09-PLAN.md frontmatter (must_haves.truths)
**Automated checks:** 3 passed (typecheck, full test suite — 1542 tests, build) — all green; automated checks do not exercise live drag-and-drop semantics, so this gap was only found via human testing
**Human checks:** 7 of 8 scripted walkthrough items pass without qualification; 1 new, more specific gap found (lineup-slot ↔ lineup-slot swap semantics) during the same session, not explicitly called out in the original 8-step script's wording
**Total verification time:** Task 1 automated gate ~3 min; Task 2 human two-browser session (duration not tracked by the agent — human-run)

---

_Verified: 2026-07-21T19:36:38Z_
_Verifier: Claude (continuation agent, human-verify checkpoint resolution)_
