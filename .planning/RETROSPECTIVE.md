# Retrospective — Counter Attack Web

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

_Written: 2026-06-11_
