---
phase: 29-draft-ui-pick-and-swap-flow
plan: 09
subsystem: testing
tags: [vitest, socket.io, drag-and-drop, human-verify, gap-re-verification]

# Dependency graph
requires:
  - phase: 29-07
    provides: DRAFT_REARRANGE legal after draftComplete; draft-mode LINEUP_CONFIRM resolves the drafted roster into GameState
  - phase: 29-08
    provides: BenchCarousel reworked into a real carousel; widened draft/bench cards; container-level drag-state reset; Confirm gated on a full lineup
provides:
  - Full-suite automated gate re-confirmation (typecheck + 1542 tests + build, all green) after the 29-07/29-08 gap-closure merge
  - Dev servers (client :5173, server :3001) started fresh from current main tip, ready for the live two-browser walkthrough
  - Human two-browser walkthrough completed (Task 2): 7 of 8 scripted checks pass without qualification; 1 new, more specific gap found (lineup slot-to-slot swap sends the displaced player to the bench instead of trading places) and recorded in 29-VERIFICATION.md for a follow-up gap-closure cycle (29-10)
affects: [29-VERIFICATION, phase-29-completion-decision]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - 'Restarted both dev servers (killed pre-existing stale processes on :3001/:5173) rather than trusting processes that may have predated the 29-07/29-08 merge commits, to guarantee the human walkthrough exercises the current code'
  - 'Task 2 (blocking human-verify checkpoint) reached and paused per plan contract — did not fabricate or simulate the two-browser session'
  - 'Task 2 resolved as a FAILED checkpoint (not "approved"): the human ran the full 8-step walkthrough and reported all steps pass except a newly-discovered slot-to-slot rearrange bug; per the plan''s own acceptance criteria ("If any check fails, the specific failure...is recorded for a follow-up gap-closure cycle rather than silently passing"), this plan records a fresh, specific gap in 29-VERIFICATION.md rather than marking Phase 29 complete'
  - "Read-only root-cause investigation (no source modified, per this plan's verification-only scope) traced the gap to packages/server/src/draftSession.ts applyRearrange, which implements the documented D-07 bench-displacement decision uniformly for all to-slot moves; the client already sends a fully-formed slot-to-slot payload, so the fix belongs entirely server-side (see 29-VERIFICATION.md Gap 1 for full analysis and the D-07 scope-narrowing recommendation)"

patterns-established: []

requirements-completed: [DRAFT-06, DRAFT-07, DRAFT-08, DRAFT-09] # DRAFT-10 remains partial: hand-off itself verified, but its rearrangement-semantics sub-requirement has the new slot-swap gap (see 29-VERIFICATION.md)

duration: ~3min automated gate + human walkthrough session (untracked duration)
completed: 2026-07-21
---

# Phase 29 Plan 09: Gap-Closure Re-Verification — Automated Gate Green; Human Walkthrough Finds One New Gap (Lineup Slot-to-Slot Swap)

**Re-ran the full monorepo automated gate after the 29-07 (server lifecycle) and 29-08 (client carousel/robustness) gap fixes merged — typecheck, 1542 tests, and build all green — then ran the mandatory human two-browser walkthrough (Task 2): 7 of 8 scripted checks pass without qualification (confirming the three original critical gaps are closed, plus keeper safety and reconnect), but the human discovered a new, more specific defect — dragging a card from one filled lineup slot onto another filled lineup slot sends the displaced player to the bench instead of trading places with the dragged card. This plan does NOT mark Phase 29 complete; it records the new gap in 29-VERIFICATION.md for a follow-up gap-closure cycle (29-10).**

## Performance

- **Duration:** ~3 min (Task 1 automated gate + dev server startup) + human walkthrough session (duration not tracked by the agent — human-run)
- **Started:** 2026-07-21T19:11:59Z
- **Task 1 completed:** 2026-07-21T19:14:47Z
- **Task 2 (checkpoint) resolved:** 2026-07-21T19:36:38Z — human reported walkthrough results; this continuation agent recorded the gap
- **Tasks:** 2/2 complete (Task 1 passed; Task 2 checkpoint resolved — FAILED with one specific new gap, not "approved")
- **Files modified:** 0 source files (verification-only plan); 3 planning docs updated (this SUMMARY.md, 29-VERIFICATION.md, .planning/STATE.md)

## Accomplishments

- Confirmed the full monorepo automated gate is green on the current main tip (commit `f11ad98`, which includes both 29-07 and 29-08 gap-closure merges):
  - `pnpm -r typecheck` — exits 0 (shared, server, client all clean)
  - `pnpm -r test` — exits 0; 1542 total tests passing (567 shared + 605 passed/1 skipped/1 todo server + 368 client), comfortably above the plan's required floor of 1527
  - `pnpm -r build` — exits 0 (shared `tsc`, server `tsc`, client `vite build` all succeed)
- Discovered and cleaned up stale dev-server processes: pre-existing processes were listening on ports 3001 (server) and 5173 (client) from an earlier session. Rather than trust them to reflect the 29-07/29-08 merge, killed them (including a lingering `tsx watch` child process that outlived its parent on port 3001) and started both servers fresh from the current checkout.
- Verified both fresh dev servers are healthy: server responds on `http://localhost:3001` (Express/Socket.io, 404 on `/` is expected — no static route in dev mode) and logs `Counter Attack server listening on port 3001`; client responds 200 on `http://localhost:5173` (Vite ready in 296ms).
- Reached Task 2 (`checkpoint:human-verify`, `gate="blocking-human"`) and paused per the plan's explicit instruction: this is a blocking gate that must not be auto-advanced or fabricated by the executor.

## Task Commits

Task 1 (automated gate) and Task 2 (human walkthrough + gap recording) both produced no source changes — this is a verification-only plan. No task-level commits were made for either task; the docs-only updates are captured in this plan's single closing commit (see Self-Check below for hash).

## Files Created/Modified

- `.planning/phases/29-draft-ui-pick-and-swap-flow/29-09-SUMMARY.md` — this summary, documenting the automated-gate pass and the Task 2 checkpoint resolution (gap found, not approved)
- `.planning/phases/29-draft-ui-pick-and-swap-flow/29-VERIFICATION.md` — refreshed Observable Truths/Requirements Coverage tables (DRAFT-06/07/08/09 now verified; DRAFT-10 partial), new Gap 1 (lineup slot-to-slot swap) with root-cause investigation, new 29-10 Recommended Fix Plan
- `.planning/STATE.md` — session continuity and current-position notes updated to reflect the new gap and pending 29-10 gap-closure cycle

## Decisions Made

- Restarted both dev servers instead of reusing already-listening processes on the target ports, because their process-creation timestamps could not be confidently correlated to the 29-07/29-08 merge commits landing on main. A stale server process silently serving pre-fix behavior during the human walkthrough would produce a false-negative re-verification (the exact failure mode this plan exists to prevent).
- Did not attempt to simulate, script, or fabricate the two-browser human walkthrough. Per the plan's `gate="blocking-human"` designation and the objective's explicit instruction, Task 2 requires genuine human judgment (drag feel, visual carousel behavior, on-pitch piece rendering) that cannot be verified by an agent.

## Task 2: Human Walkthrough Result

The human ran the full 8-step two-browser walkthrough against the fresh dev servers and reported:

> "bug - when swapping players in the lineup they should trade places. currently the replaced player is being sent to the bench. all other tests pass"

**Interpretation:** 7 of the 8 scripted steps pass without qualification — confirming all three original critical gaps from the prior verification pass are closed (post-draft rearrange no longer wedges, bench is a real carousel, and the drafted roster correctly reaches game start with full stats/positions), plus the two previously-unexercised scenarios (cycle-4 keeper safety, D-13 reconnect) now pass. A new, more specific defect was found: dragging a card from one filled lineup slot onto another filled lineup slot sends the displaced occupant to the bench instead of trading places with the dragged card. This is isolated to lineup-slot ↔ lineup-slot moves — bench↔lineup moves (explicitly scripted in step 5) are unaffected per the same report.

**This is a FAILED checkpoint, not an approval.** Per the plan's Task 2 acceptance criteria ("If any check fails, the specific failure...is recorded for a follow-up gap-closure cycle rather than silently passing"), this run:

- Did NOT mark Phase 29 complete.
- Investigated (read-only, no source modified — this plan is verification-only) the likely root cause: `packages/server/src/draftSession.ts`'s `applyRearrange` function unconditionally displaces any occupant of the destination slot to the bench for every `to.type === 'slot'` move, regardless of whether the source was another lineup slot (which has a well-defined vacated slot the displaced occupant could swap into) or the bench (which does not). The client (`LineupAssignmentScreen.tsx` `handleDraftSlotDrop`) already sends a correctly-shaped slot→slot payload — the gap is entirely server-side. Full analysis, including the discovery that this behavior implements the _documented_ D-07 decision from `29-CONTEXT.md` (originally scoped to `applyPick`, later applied uniformly to `applyRearrange` in 29-02) rather than being a plain regression, is recorded in `29-VERIFICATION.md` Gap 1.
- Recorded the new gap in `29-VERIFICATION.md` (`status: gaps_found`) with a `29-10-PLAN.md` recommended fix plan for the next gap-closure cycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Killed stale/orphaned dev-server processes occupying the walkthrough's required ports**

- **Found during:** Task 2 setup (starting dev servers ahead of the human checkpoint, per checkpoint automation-first protocol)
- **Issue:** Ports 3001 and 5173 were already bound by processes of uncertain provenance (creation timestamps suggested they might predate the 29-07/29-08 merge). A first restart attempt on port 3001 hit `EADDRINUSE` because the original `tsx watch` process's child (the actual listening `node` process) had outlived its killed parent.
- **Fix:** Identified and killed both the stale parent and the orphaned child process (`taskkill //F` on both PIDs), confirmed port 3001 was fully free (no LISTENING socket, only TIME_WAIT), then started fresh `pnpm run dev` processes for both server and client from the current checkout.
- **Files modified:** None (process/environment cleanup only, no source changes)
- **Verification:** Fresh server process logs `Counter Attack server listening on port 3001` and responds 404 (expected, no static route) on `http://localhost:3001`; fresh client process logs Vite ready and responds 200 on `http://localhost:5173`.

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking environment issue, not a code change)
**Impact on plan:** No source code affected. Ensures the human walkthrough in Task 2 exercises the actual 29-07/29-08 gap-closure code rather than a potentially stale server/client process.

## Issues Encountered

None beyond the stale-process cleanup documented above. The Task 2 gap discovery (lineup slot-to-slot swap) is not an "issue encountered" during execution of this plan — it is the plan's intended output (a re-verification verdict), documented in full in `29-VERIFICATION.md`.

## User Setup Required

None further — the live two-browser human walkthrough required to complete this plan has been run. Dev servers used for it:

- Client: http://localhost:5173
- Server: http://localhost:3001 (Socket.io backend for the client)

The full 8-step walkthrough script that was run, covering:

1. Card legibility (DRAFT-06) — PASS
2. Full 4-cycle pick-and-swap non-regression (DRAFT-07) — PASS
3. Keeper-safety re-test — deliberately withhold a keeper until cycle 4 (DRAFT-08) — PASS
4. Bench carousel navigation (DRAFT-09) — PASS
5. Post-draft rearrange — 3+ consecutive drags before Confirm (DRAFT-09/DRAFT-10, gap 1) — PASS for bench↔lineup moves; NEW GAP found for lineup-slot↔lineup-slot moves (see Task 2 result above)
6. Reconnect resume mid-draft (D-13) — PASS
7. Confirm-button gating on a complete 11-slot lineup — PASS
8. Post-confirm hand-off — all 22 on-pitch pieces render with correct stats/positions (DRAFT-10, gap 3) — PASS

## Next Phase Readiness

**This plan is complete, but Phase 29 is NOT complete.** Task 2's checkpoint resolved with a specific new gap rather than a full "approved." Next steps:

1. A new gap-closure plan (`29-10-PLAN.md`, recommended in `29-VERIFICATION.md`) should fix `applyRearrange`'s slot-to-slot swap semantics in `packages/server/src/draftSession.ts`, per the root-cause analysis and D-07 scope-narrowing recommendation recorded there.
2. After 29-10 lands, another re-verification pass (a fresh 29-11-style plan, or a re-run of this plan's Task 2 script targeting specifically the slot-to-slot swap) is needed before Phase 29 can be marked complete.
3. ROADMAP.md is intentionally left untouched by this plan — Phase 29 completion is an orchestrator decision made only once zero open gaps remain in `29-VERIFICATION.md`.

---

_Phase: 29-draft-ui-pick-and-swap-flow_
_Completed: 2026-07-21 (Task 1 automated gate + Task 2 human walkthrough checkpoint resolved with a new gap recorded)_

## Self-Check: PASSED

- FOUND: `.planning/phases/29-draft-ui-pick-and-swap-flow/29-09-SUMMARY.md`
- FOUND: commit `2f895ea` (SUMMARY.md creation)
- FOUND: commit `c4a7a2b` (STATE.md checkpoint-pause update)
- FOUND: `.planning/phases/29-draft-ui-pick-and-swap-flow/29-VERIFICATION.md` (updated with new Gap 1 and 29-10 recommended fix plan)
