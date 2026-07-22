# Phase 26: Bug Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 26-Bug-Fixes
**Areas discussed:** BUG-23 scope, BUG-24 + FK undo todo, Bug discovery policy

---

## BUG-23 Scope

| Option                             | Description                                                                                                                                                                                | Selected |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Deferred — true spike needed       | REQUIREMENTS.md is correct. BUG-23 stays Out of Scope for Phase 26. It needs a dedicated /gsd-debug or /gsd-spike session to instrument the SNAPSHOT_DEFLECT flow and find the root cause. | ✓        |
| Included — investigate in Phase 26 | STATE.md is current. Phase 26 plans should include console.log instrumentation of the KICK_OFF_SETUP shading path.                                                                         |          |

**User's choice:** Deferred — true spike needed
**Notes:** STATE.md and REQUIREMENTS.md were in conflict (STATE.md escalated it, REQUIREMENTS.md listed it Out of Scope). User confirmed REQUIREMENTS.md is authoritative. BUG-23 deferred to standalone debug spike.

---

## BUG-24 + FREE_KICK_SETUP Undo

### Should FK undo be folded into BUG-24?

| Option                         | Description                                                                                  | Selected |
| ------------------------------ | -------------------------------------------------------------------------------------------- | -------- |
| Yes — fold FK undo into BUG-24 | BUG-24 fix includes FK_STAGE_ADVANCE as an undo boundary. The todo closes when BUG-24 ships. | ✓        |
| No — BUG-24 is MOVE-phase only | FREE_KICK_SETUP stage-boundary undo tracked separately as its own todo and future phase.     |          |

**User's choice:** Yes — fold FK undo into BUG-24
**Notes:** Pending todo `free-kick-setup-undo-not-implemented.md` is tagged `resolves_phase: 26`. User confirmed it closes with BUG-24.

### What determines 'zero moves in the current stage'?

| Option                                             | Description                                                                             | Selected |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Scan eventLog from latest FK_STAGE_ADVANCE forward | Count FK_SETUP_MOVEs after the last boundary event in the log.                          |          |
| Dedicated GameState field (freeKickPlacedPieceIds) | Use freeKickPlacedPieceIds.length === 0 to gate undo disabled. No eventLog scan needed. | ✓        |

**User's choice:** Dedicated GameState field (freeKickPlacedPieceIds)
**Notes:** freeKickPlacedPieceIds already maintained by applyFreeKickMove; reusing it avoids a new eventLog scan pattern.

---

## Bug Discovery Policy

| Option                                       | Description                                                                                  | Selected               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------- |
| Todos only — no scope expansion              | Log all discovered bugs as todos. Phase 26 plans only touch BUG-24 through BUG-29.           |                        |
| Opportunistic — fold trivial fixes           | Same-file one-liner fixes can be folded in with a note. Non-trivial discoveries go to todos. | ✓ (with clarification) |
| Strict boundary — block on user confirmation | Any discovered bug pauses execution for user confirmation.                                   |                        |

**User's choice:** Opportunistic, with clarification: "fold trivial fixes - for larger changes get confirmation before pushing out to todos"
**Notes:** User wants executor to ask before creating todos for non-trivial bugs, not silently add them. Trivial same-file one-liners can go in without asking.

---

## Claude's Discretion

None — all areas had explicit user choices.

## Deferred Ideas

- **BUG-23** — KICK_OFF_SETUP stale shot-path shading. Deferred to standalone `/gsd-debug` spike session. Not in Phase 26.
