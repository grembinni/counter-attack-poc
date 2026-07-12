# Retrospective — Counter Attack Web

## v1.3 Team Customization & Formation System (2026-07-03 → 2026-07-11)

**Shipped:** 2026-07-11
**Phases:** 7 | **Plans:** 27 | **Duration:** 9 days

### What Was Built

- **Phase 19**: Global PLAYER_POOL (178 players), 4-color TeamPalette model, ColorSchemeId/TeamId split, Xolos/Cozmos retired from selectable teams; data layer decoupled for v1.4 draft mode
- **Phase 20**: 18-style parameterized uniform renderer (PieceOverlay accepts uniformStyle + palette props); all hardcoded per-team SVG patterns removed; GK variant for every style
- **Phase 21**: 10 new teams (6 MLS + 4 International); two-tab TeamSelectionScreen with struck-out cross-player feedback and auto-switch; VALID_TEAM_IDS expanded to 12
- **Phase 22**: UniformSelectionScreen with 2×9 tile grid; home-first confirmation gate; away sees awayPrime/awayAlt on tiles; GameState.selectedUniformStyles persists through match
- **Phase 23**: 4 formations in FORMATIONS table; formation selection section on UniformSelectionScreen with mini pitch diagrams; pieces placed dynamically with symmetric away mirror
- **Phase 24**: computeAutoAssignment 3-pass greedy; LineupAssignmentScreen with HTML5 drag-swap and stat-card grid; GK slot locked server-side; parallel both-confirm gate
- **Phase 25**: FREE_KICK_SETUP 6-step sequence (kicker select + 4 stages); OFFSIDE-01/02 UAT formally closed; GK_KICK + LOOSE_BALL_LAND visible in replay; jersey/Style 12 SVG fixes

### What Worked

**Short, focused phases kept momentum high.** 7 phases in 9 days averaged one phase every 1.3 days. The data-first sequencing (Phase 19 builds the foundation that every later phase consumes) was the right call — no mid-phase pivot needed because of a schema mismatch.

**Wave-parallel plan structure.** Wave 1 (shared contracts) → Wave 2 (server) → Wave 3 (client) pattern from Phase 22 onward eliminated all file-overlap conflicts in execution. Every wave's dependency graph was explicit in the plan files.

**Phase 23 formation data-integrity test.** The `formations.test.ts` data-integrity test validating all FORMATIONS entries at Phase 23 plan 01 caught coordinate inconsistencies early, before the server placement code was written. Structural data tests as Wave 0 before behavioral code is a pattern worth repeating.

**Gap-closure wave in Phase 25 worked correctly.** Wave 3 (Plans 25-06..25-09) emerged from the Plan 25-05 UAT session. Four targeted fixes were created, executed, and committed cleanly in one session without reopening earlier plans. The UAT-as-gate pattern (Wave 2 = human UAT → Wave 3 = gap closure) is now proven across two milestones.

**PROJECT.md kept current through the milestone.** The "Validated (v1.3)" section was updated incrementally as phases shipped, so the final PROJECT.md review at close required no reconstruction — just a final audit pass.

### What Was Inefficient

**REQUIREMENTS.md checkboxes drifted again.** For the third milestone running, requirement checkboxes in REQUIREMENTS.md weren't ticked at the commit that implemented them. FORM-01..04, OFFSIDE-01/02, REPLAY-07/08, UX-15 all showed "Pending" in the traceability table at close despite being done. The fix exists (tick in the same SUMMARY commit) but hasn't become habitual. Consider adding a checkbox check to the gsd-executor completion checklist.

**BUG-23 root cause not found.** The Phase 25-02 belt-and-suspenders guards were applied speculatively without confirming the root cause first. Plan 25-05 UAT showed they didn't fix the underlying issue. The D-15 instrumentation-first approach (console.log the relevant state to identify the exact guard point) should have been the Phase 25-02 plan, not an escalated v1.4 item. Speculative fixes to behavioral bugs without root cause analysis are a recurring inefficiency.

**Milestone audit run too early.** The v1.3 audit was run at 3/7 phases, before Phases 22-25 existed. A mid-milestone audit is valuable for the phases completed so far, but the audit metadata (phases_in_scope: 7, phases_complete: 3) was confusing at close because the audit was technically stale for the final 4 phases. Consider either (a) re-running the audit before close or (b) marking mid-milestone audits with a `scope: partial` flag.

### Patterns Established

- **Wave 1 (shared contracts) always first.** TypeScript interfaces and socket event types in `packages/shared` must be locked before server or client plans start. Any plan that skips this creates a second-order change storm across all consumers.
- **data-integrity tests as Wave 0.** Before writing behavioral code that consumes a data table (formations, uniforms, teams), write a structural test that validates every entry in the table. Catches coordinate errors, missing fields, and type mismatches before they propagate.
- **Formation mirror formula:** away_q = 36 − home_q. Canonical, tested, locked. Use in all future phases that place pieces on the pitch.
- **3-pass greedy for role assignment:** GK-lock → anchors (CB/CM/CF by D-04 stat weights) → flex (FB/winger/flex-mid from remaining). Pattern applies to any future assignment algorithm with a fixed-role constraint.
- **mix-blend-mode: multiply for badge PNGs.** Removes white PNG backgrounds on colored card backgrounds without modifying source files. Apply everywhere team badges render over a non-white surface.

### Known Gaps Entering v1.4

| Gap             | Description                                                           | Location                                                |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| BUG-23          | KICK_OFF_SETUP shot-path shading persists after SNAPSHOT_DEFLECT goal | HexGrid.tsx + gameHandlers — root cause unk.            |
| FK Undo         | FREE_KICK_SETUP undo not implemented (within/across stages)           | `todos/pending/free-kick-setup-undo-not-implemented.md` |
| HP exclusion    | HIGH_PASS_MOVE missing carrier-repositioning exclusion                | gameEngine.ts (parallel to FTP fix 17.1-16)             |
| Fixture hygiene | 3 useGameStore test fixtures carry stale movementSlot: 'ATTACKER_4'   | useGameStore.test.ts                                    |

### Metrics

| Metric        | Value                                     |
| ------------- | ----------------------------------------- |
| Duration      | 9 days (2026-07-03 → 2026-07-11)          |
| Phases        | 7 (Phases 19–25)                          |
| Plans         | 27                                        |
| Files changed | 156                                       |
| Insertions    | 11,602                                    |
| Deletions     | 2,375                                     |
| Requirements  | 40/41 (BUG-23 acknowledged gap)           |
| Test suite    | ~1,100+ tests across shared/server/client |

---

## v1.2 Team Identity & Core Fixes (2026-06-13 → 2026-07-03)

**Shipped:** 2026-07-03
**Phases:** 10 sub-phases | **Plans:** 52 | **Duration:** 20 days

### What Was Built

- **Phase 15**: Four teams (Cozmos, Xolos, City, Crew) with badge PNGs, jersey patterns (outfield + GK), and TEAM_CONFIGS color system
- **Phase 16**: CSV-seeded player rosters, player card redesign, full team-selection lobby (home picks first)
- **Phase 17**: Seven rule-correctness fixes + offside detection (OFFSIDE-01/02) + FREE_MOVE phase
- **Phase 17.1**: Full v1.4.1 action model alignment across 16 plans — GamePhase rename, aerial stat, ZoI, FIRST_TIME_PASS_MOVE, GK restart, loose-ball scatter, shot-range gate, pass intercept shape
- **Phase 18**: Messaging/logging convention sweep + MATCH-06 text fix
- **Phase 18.1**: Replay frame visibility (HEADED_PASS/GK_PUNT) + post-game playback optimization
- **Phase 18.2**: Duplicate-logic consolidation + BUG-08/09/11 behavioral fixes
- **Phase 18.3**: 16 bug-bash fixes (BUG-06..21)
- **Phase 18.4**: 8 UX enhancements (game speed, end-turn dialog, final-third lines, tooltips, EventBanner)

### What Worked

**Gap-closure waves caught things the initial plans missed.** Phase 17.1 grew from 6 plans to 16 across five re-verification cycles, closing progressively deeper defects (undo phase-awareness → client selection wiring → interception bypass → delivery correctness → self-pass exploit). Each cycle caught one more layer. The gsd-verifier → gap-closure → re-verify loop is the right pattern for behavior-dense phases.

**Feature flags as escape hatches.** `FTP_MOVE_ENABLED=false` let the FIRST_TIME_PASS_MOVE repositioning sub-phase be implemented completely and toggled off by default. The code shipped without behavioral change while keeping the implementation path verifiable. Same pattern would work for any partially-spec'd rule addition.

**Phase splitting paid off.** What started as a single "Phase 18 Design Polish" was split into 5 sub-phases during planning. Each sub-phase had a clear goal, disjoint file sets, and independent verification — no edit conflicts, no ambiguous "what counts as done." The split was recommended by the planner before any work started, which is the ideal time.

**Cube-coordinate unit vectors for loose ball scatter.** The Phase 17.1 fix (computeLooseBall rewrite using toCube/fromCube + direction unit vectors) was the right level of abstraction. The 72-case regression test proved the old ODD-Q fixed-delta approach was systematically wrong on non-horizontal trajectories; the new one is parity-independent. This is the kind of fix that's hard to discover without a dense test matrix.

### What Was Inefficient

**REQUIREMENTS.md checkbox hygiene.** For the second milestone in a row, requirement checkboxes weren't ticked at the commit that implemented them (TEAM-01, UX-09..13). These needed manual correction at close. Fix: tick the checkbox in the same commit as the plan SUMMARY, not deferred.

**Phase 17 OFFSIDE human-verify checkpoints left open.** Plans 17-05 and 17-06 each had a `checkpoint:human-verify` task (gate=blocking) requiring two-tab live verification. The phase was marked complete on 2026-06-21 without closing these checkpoints. The code is correct but there's no signed-off UAT record. At close, the requirements were marked as deferred rather than verified. Blocking checkpoints should be resolved before marking a phase complete, or explicitly acknowledged and deferred with a todo.

**17.1 accumulated 16 plans.** The initial 6-plan scope was correct, but the 10 gap-closure plans represent significant rework — each gap was addressable earlier if the initial verification had been more thorough. The root causes (CR-01 undo non-functional, CR-02 interception bypass, self-pass exploit) were latent in the first plans. A pre-execution threat-model step asking "what could go wrong with this FTP/HP flow?" might have caught them before 10 extra plans.

**Quick tasks accumulated without artifact directories.** Thirteen quick tasks (260621-\*) were completed in git but never formally closed with artifact directories. The audit counts them as "unknown" every close. Consider using `.planning/quick-tasks/{slug}/SUMMARY.md` (a single file) to formally close quick tasks.

### Patterns Established

- **Phase-splitting at planning time beats discovering scope mid-execute.** The planner's `## PHASE SPLIT RECOMMENDED` output for Phase 18 is a concrete signal worth honoring; it predicted the 5-sub-phase structure that proved correct.
- **Gap-closure plans are first-class.** Number them sequentially with a descriptive suffix (17.1-07, not "patch-07"); include a SUMMARY.md; run them through the same verification loop.
- **`firstTypePassCarrierId` / `highPassCarrierId` pattern for pass-flight self-exclusion.** Any future pass type with a repositioning sub-phase needs this field to prevent self-pass reclaim. Document in PATTERNS.md or ARCHITECTURE.md.
- **cube-coordinate vectors for all scatter/offset math.** Never use fixed ODD-Q offset deltas for multi-step traversals. `toCube` / `fromCube` are now in `hex.ts`; use them everywhere.

### Known Gaps Entering v1.3

| Gap          | Description                                                                          | Location                     |
| ------------ | ------------------------------------------------------------------------------------ | ---------------------------- |
| OFFSIDE UAT  | Human two-tab verification of OFFSIDE-01/02 never closed                             | Phase 17 plans 17-05, 17-06  |
| GK_KICK      | Ball delivery invisible during post-game replay (missing from REPLAY_ELIGIBLE_TYPES) | `gameHandlers.ts:828-836`    |
| KO shading   | KICK_OFF_SETUP shows stale shot-path hex shading after SNAPSHOT_DEFLECT goal         | `HexGrid.tsx` (root unknown) |
| HP exclusion | HIGH_PASS_MOVE missing repositioning-exclusion (parallel defect to 17.1-16 fix)      | `gameEngine.ts`              |

### Metrics

| Metric        | Value                                    |
| ------------- | ---------------------------------------- |
| Duration      | 20 days (2026-06-13 → 2026-07-03)        |
| Phases        | 10 sub-phases (9 inserted mid-milestone) |
| Plans         | 52                                       |
| Commits       | 544                                      |
| Files changed | 326                                      |
| Insertions    | 60,174                                   |
| Deletions     | 2,235                                    |
| Requirements  | 48/50 (OFFSIDE-01/02 UAT deferred)       |

---

## v1.0 MVP (2026-05-27 → 2026-06-11)

### What We Shipped

A fully playable 2-player Counter Attack web game in 15 days: 13 phases, 51 plans, 330 files changed, 77k+ lines. All core rules implemented; deployed to Render; 10/10 UAT tests passed.

### What Went Well

**Test-driven server architecture paid off.** Starting Phase 2 with pure-function validators and 95+ unit tests meant Phase 4–5 game logic had a solid foundation. Every server mechanic was testable in isolation before wiring to Socket.io. The final suite hit 222+ integration tests with zero regressions across all 13 phases.

**Explicit FSM with `isProcessing` mutex.** Defining `ELIGIBLE_NEXT_ACTIONS` as a static map and enforcing `INVALID_SEQUENCE` on every handler prevented a class of race conditions and state corruption bugs that could have been very hard to debug under concurrent socket events.

**Monorepo shared types eliminated drift.** Typed Socket.io events (`ClientToServerEvents`, `ServerToClientEvents`) and shared `GameState`/`ActionEvent` types meant TypeScript caught every interface mismatch at compile time. No runtime "undefined is not a function" surprises from event payload mismatches.

**Inserted phases kept scope honest.** Three inserted phases (7.1, 8.1, 8.2) addressed real UX and gameplay issues discovered during UAT without derailing the milestone. Treating them as first-class phases with full plan/verify/summary cycles meant no "informal fixes" accumulating as hidden debt.

**Phase 10 UAT as acceptance gate.** Defining 10 concrete UAT scenarios before executing Phase 10 plans gave a clear definition of done for the most complex flows (GK_DIVING, SNAP_DEFLECT, header-at-goal). The UAT passed without revision, validating the implementation approach.

### What Was Harder Than Expected

**Passing was more complex than a single phase.** PASS-01..05 spanned 3 inserted phases (8.2 + parts of 8.1) after the original Phase 5 implementation proved incomplete. The three-step pass flow (pass type → target hex → roll), interception auto-dice, and header contestant system each required dedicated engine and handler work. In hindsight, the original pass/header requirements underestimated the UI-side state management (shootingMode, headerContestants, targetHex selection).

**Shot declaration flow needed a full phase.** The original design had shots resolved in a single `game:roll` branch. Phase 10 required a proper `applyDeclareShot → GK_DIVING → applyGKDive` pipeline with a new `SHOT_DECLARED`/`GK_DIVING`/`SNAP_DEFLECT` FSM trio. The two-step Shoot UI (click Shoot → click goal-line hex) was also non-trivial to wire without a dedicated client state flag (`shootingMode`).

**Integration test positioning was brittle.** Integration tests using placeholder hex coordinates (`{q:11,r:7}`) broke silently when engine logic required pieces to be adjacent (hexDistance=1). The D-25 fix (use real `HOME_SQUAD`/`AWAY_SQUAD` positions from `teams.ts`) should have been the standard from Phase 3 onward.

**ACTION phase rename added churn.** The `PASS` phase was renamed to `ACTION` in Phase 10 Plan 01 to support both pass and shot declarations from the same phase. This triggered ~30 files needing updates. A more neutral initial name (`ACTION` or `DECISION`) would have avoided the rename.

### Known Gaps Entering v1.1

| Gap     | Description                                                                                         | Location             |
| ------- | --------------------------------------------------------------------------------------------------- | -------------------- |
| MOVE-06 | Free 6-hex move after action confined to one final third — `pendingFreeMove` set but never consumed | `gameEngine.ts:517`  |
| PASS-02 | Mid-pass player movement during First-time Pass flight — deferred TODO                              | `gameEngine.ts:1087` |

### Metrics

| Metric        | Value                                 |
| ------------- | ------------------------------------- |
| Duration      | 15 days (2026-05-27 → 2026-06-11)     |
| Phases        | 13 (3 inserted after initial roadmap) |
| Plans         | 51                                    |
| Files changed | 330                                   |
| Lines added   | 77k+                                  |
| Server tests  | 222+ (integration + unit)             |
| Shared tests  | 218                                   |
| Client tests  | 33                                    |
| UAT pass rate | 10/10                                 |
| Requirements  | 65/66 (MOVE-06 deferred)              |

---

## v1.1 UX Tuning & Bug Cleanup (2026-06-11 → 2026-06-12)

**Shipped:** 2026-06-12
**Phases:** 4 | **Plans:** 14

### What Was Built

- **Phase 11**: 5 rule-correctness fixes — header accuracy gate, duel-target ordering, snapshot stale path, deflection pace suppression, post-deflect both-teams Movement entry. 35 new tests.
- **Phase 12**: Team token stripe redesign (home vertical, away horizontal) + unified 5-type hex highlight system (risk/goal/safe/kickoff/shot-path). 22 new tests.
- **Phase 13**: Persistent 80px CSS-Grid top band; MM:00 event-driven clock always visible; HALF_TIME/FULL_TIME as pitch overlays; 6 dead components deleted. 15 new tests (Wave 0 RED→GREEN).
- **Phase 14**: Symmetric DEF/MID kick off formation; KICKOFF_STANDARD_PASS_ONLY guard; universal `ballAfter` on 13 ActionEvent members; 500ms replay cadence; simultaneous K step-frames. 5 new tests.

### What Worked

**Wave 0 RED→GREEN (Phase 13).** Creating GameBoard.test.tsx with 15 failing tests as Plan 13-01 before any implementation in Plan 13-02 was the cleanest Nyquist signal in the milestone. The RED state was the spec; the GREEN state was the done condition. No guessing about what "done" meant.

**TypeScript as an enforcement layer.** Making `ballAfter` a required (not optional) field on 13 ActionEvent union members in Phase 14 meant the TypeScript compiler caught every missed site at build time. Zero runtime surprises; the migration was mechanical rather than exploratory.

**Targeted bug fixes with regression coverage.** Phase 11's approach of a per-requirement test file (`gameEngine.rule11.test.ts`) with explicit test descriptions meant every bug fix had a corresponding regression guard. The 35-test file is self-documenting history of what was broken and how it was fixed.

**UAT as the final arbiter.** Phase 14 UAT caught 2 bugs (MATCH-06 boundary, MATCH-07 client UI) that automated tests missed. The deferred REPLAY-06 was correctly classified as minor — the unit test coverage was honest about its limits.

### What Was Inefficient

**Phase 14 REQUIREMENTS.md checkboxes never ticked.** Three requirements (MATCH-07, REPLAY-04, REPLAY-05) were implemented and tested but their REQUIREMENTS.md checkboxes were never ticked. This created unnecessary audit noise at milestone close. The SUMMARY `requirements_addressed` vs `requirements-completed` key mismatch compounded the problem. Fix: always tick the checkbox in the same commit that executes the final task.

**Multiple iterative UAT commits for MATCH-06.** Away DEF positions were adjusted three times across commits `23266b1 → 6404725 → 261b69a` before settling on q=30. The original requirement text (q∈[6,20]) was ambiguous about which team's perspective it described. A 2-minute clarification at requirements time would have prevented 3 fix commits.

**Post-compact context cost.** This session ran out of context midway through Phase 13 validation and required a summary handoff. The Phase 13 test run state was fully derivable from the artifact files; resumption was smooth, but it highlights that validation-heavy sessions (4 phases × Nyquist audit each) should be split across sessions proactively.

### Patterns Established

- **Per-phase validation audit**: `gsd-validate-phase` reconstructs coverage from SUMMARY files for phases without VALIDATION.md (State B); manual-only gaps documented with test instructions
- **Wave 0 as a separate plan**: Plan 13-01 as an explicit Wave 0 scaffold with intentionally RED tests is cleaner than creating test stubs mid-implementation
- **Symmetric mirror convention**: On a 37-col board, Away column = 36 - Home column. Should be documented in CONTEXT.md for future phases touching team formation

### Key Lessons

1. **Tick requirement checkboxes atomically with implementation.** Never let `[ ]` survive past the commit that wires the feature. The audit overhead at close is disproportionate.
2. **Requirement text should be perspective-neutral.** "columns 6–20" without specifying "from each team's own end" caused a 3-commit correction cycle. Frame formation requirements as "within N hexes of kick-off" or "symmetric from centre".
3. **TypeScript required fields > optional fields for migrations.** Adding `ballAfter?: ...` would have compiled everywhere silently; `ballAfter: ...` forced every missed site to a compile error. Use required fields for migration-style additions.
4. **UAT defers gracefully when classified clearly.** REPLAY-06 had severity:minor + deferred:true set explicitly in 14-UAT.md. This made the milestone audit unambiguous — the gap was acknowledged, not overlooked.

### Known Gaps Entering v1.2

| Gap               | Description                                                                | Location                               |
| ----------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| REPLAY-06         | Live-session ball tracking edge cases (pickups, passes, steals mid-replay) | `gameEngine.ts:buildReplayFrames`      |
| MATCH-06 req text | Requirement says q∈[6,20] but Away team uses symmetric q=30/q=26           | `.planning/REQUIREMENTS.md` (archived) |
| MOVE-06           | Free 6-hex move scaffolded, handler not implemented                        | `gameEngine.ts:517`                    |
| PASS-02           | Mid-pass player movement deferred TODO                                     | `gameEngine.ts:1087`                   |

### Metrics

| Metric        | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| Duration      | 2 days (2026-06-11 → 2026-06-12)                            |
| Phases        | 4                                                           |
| Plans         | 14                                                          |
| Commits       | 141                                                         |
| Files changed | 108                                                         |
| Lines added   | +16,372                                                     |
| Lines removed | -995                                                        |
| New tests     | 77 (35+22+15+5)                                             |
| Requirements  | 13/18 fully validated; 3 wired; 1 spec conflict; 1 deferred |
| UAT pass rate | 4/6 (MATCH-06 fixed, MATCH-07 fixed; REPLAY-06 deferred)    |

---

_Written: 2026-06-13_
