# Phase 38: Corner Kick - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 38-Corner Kick
**Areas discussed:** Corner-taker placement geometry, Goalkeeper reposition ordering, Alternating 6-hex window turn mechanic

---

## Corner-taker placement geometry

| Option                                      | Description                                                                                                                                                                                          | Selected |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Single fixed hex per corner                 | Mirrors Goal Kick's `GOAL_KICK_RESTART_HEX` precedent — one deterministic hex per corner, no placement choice. 4 fixed hexes total.                                                                  | ✓        |
| Small selectable arc (2-4 hexes per corner) | Matches the roadmap's literal "one of the corner's existing fixed corner-arc hexes" wording — manager clicks which of a few pre-set hexes to take the kick from. No such hex set exists in code yet. |          |

**User's choice:** Single fixed hex per corner (recommended option).
**Notes:** No follow-up — confirmed the recommended default directly.

---

## Goalkeeper reposition ordering

| Option                                  | Description                                                                    | Selected |
| --------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Simultaneous (both submit, then reveal) | Both managers independently choose a GK reposition at the same time.           |          |
| Turn-based, attacking manager first     | Mirrors Goal Kick's established sequential pattern (GK's team, then opponent). | ✓        |

**User's choice:** Turn-based, attacking manager first (recommended option).
**Notes:** No follow-up — confirmed the recommended default directly.

---

## Alternating 6-hex reposition window turn mechanic

| Option                                                        | Description                                                                                                                                      | Selected |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Strict pairs: attacker moves 2, then defender moves 2, repeat | Attacking manager moves up to 2 pieces and confirms, then defending manager does the same, repeating until both sides have used their allowance. | ✓        |
| Free-form: either side can move 1-2 at a time in any order    | Less rigid — a manager can move just 1 piece and pass the turn, or use both allowance slots before the other side goes.                          |          |

**User's choice:** Strict pairs (recommended option).
**Notes:** No follow-up — confirmed the recommended default directly.

---

## Claude's Discretion

- Exact coordinates for the 4 fixed corner-taker hexes.
- Whether a manager can pass early with 0 moves during an alternating round.
- Exact `GamePhase`/`GameState` field naming for the new Corner Kick chain.
- Exact adherence-vs-adaptation balance for Corner Kick panel styling relative to Phase 35 conventions.
- Internal code-sharing between Goal Kick's and Corner Kick's staged-repositioning implementations, so long as Corner Kick's phase values/state remain genuinely its own.

## Deferred Ideas

None — discussion stayed within phase scope. Two low-confidence todo matches (BUG-23 shot-path shading, CSV consolidation) were reviewed and not folded — both are generic keyword matches unrelated to Corner Kick, consistent with how they were dismissed in Phase 37.
