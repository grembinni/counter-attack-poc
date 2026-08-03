# Phase 37: Out-of-Bounds Detection, Throw-In & Goal Kick - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-03
**Phase:** 37-Out-of-Bounds Detection, Throw-In & Goal Kick
**Areas discussed:** Goal Kick's dedicated identity, Out-of-bounds edge cases, New setup-screen look & feel, Throw-in sequence choices

---

## Goal Kick's dedicated identity

| Option                      | Description                                                                                                                       | Selected |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| New panel + heading only    | Reuse GK_RESTART chain entirely, distinct GoalKickSetupPanel with own heading                                                     |          |
| New phase + reposition step | Genuinely new GOAL_KICK_SETUP phase with GOALKICK-02's reposition window before handing off to existing GK_KICK_TARGET/MOVE chain |          |
| You decide during planning  | Let planner/researcher resolve against requirements text                                                                          |          |

**User's choice:** Free text — "Dont reuse the same flow under the hood. New phase + new repositioning + new target + new move chain. Review the provided rules to refine flow"
**Notes:** This is a deliberate rejection of `ARCHITECTURE.md`'s research recommendation (reuse `GK_RESTART`→`GK_KICK_TARGET`→`GK_KICK_MOVE`). GOALKICK-01's own text ("independent of the existing GK-catch/save restart chain") is the textual basis.

| Option                            | Description                                                                                                 | Selected |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| New phases, reused formulas       | New GamePhase values/state drive sequence; calls existing pure scoring/accuracy/header/loose-ball functions | ✓        |
| Fully independent, including math | Own accuracy/header/loose-ball resolution logic end to end, no shared helpers                               |          |

**User's choice:** New phases, reused formulas
**Notes:** GOALKICK-04 explicitly says the Standard Pass option "uses the existing Standard Pass mechanic unmodified" — confirms formulas are shared even though phase/state wiring is new.

---

## Out-of-bounds edge cases

| Option                          | Description                                                                         | Selected |
| ------------------------------- | ----------------------------------------------------------------------------------- | -------- |
| Reclassify like any exit        | Sideline-again = throw-in to other team; byline = corner/goal kick per normal rules | ✓        |
| Loose Ball / re-throw same team | Treat as ordinary Loose Ball or re-throw for same team                              |          |

**User's choice:** Reclassify like any exit
**Notes:** Matches THROWIN-05 and real football; resolves the ambiguity `FEATURES.md` flagged.

| Option                               | Description                              | Selected |
| ------------------------------------ | ---------------------------------------- | -------- |
| Default to byline (goal/corner kick) | Research's recommendation                | ✓        |
| Default to sideline (throw-in)       | Alternative default                      |          |
| Let Claude decide during planning    | Resolve once exact geometry is inspected |          |

**User's choice:** Default to byline (goal/corner kick)
**Notes:** Confirm against actual grid corner-hex geometry during implementation — starting assumption, not yet geometry-verified.

| Option                        | Description                                                                               | Selected |
| ----------------------------- | ----------------------------------------------------------------------------------------- | -------- |
| Yes, any contact counts       | Every deflection/header/save/bounce updates lastTouchedBy, even without possession change | ✓        |
| Only possession changes count | lastTouchedBy only updates on carrierId change                                            |          |

**User's choice:** Yes, any contact counts
**Notes:** Matches real football (a deflected shot that goes out is "last touched by" the deflector).

---

## New setup-screen look & feel

| Option                     | Description                                                                      | Selected |
| -------------------------- | -------------------------------------------------------------------------------- | -------- |
| Yes, match exactly         | Reuse Phase 35's locked panel conventions verbatim                               |          |
| Same family, new details   | Follow general pattern, allow different specifics where they read more naturally |          |
| You decide during planning | Planner applies conventions where obviously applicable                           | ✓        |

**User's choice:** You decide during planning
**Notes:** No explicit instruction to deviate from Phase 35 conventions — default to following them where they fit.

| Option                     | Description                                                             | Selected |
| -------------------------- | ----------------------------------------------------------------------- | -------- |
| Reuse existing tint types  | Map onto closest existing HIGHLIGHT_STYLES/RING_STYLES entry            | ✓        |
| You decide during planning | Planner figures out closest mapping, adds new tint only if nothing fits |          |

**User's choice:** Reuse existing tint types
**Notes:** No new entries in `docs/HIGHLIGHT-REFERENCE.md` for this phase.

---

## Throw-in sequence choices

| Option                          | Description                                                                  | Selected |
| ------------------------------- | ---------------------------------------------------------------------------- | -------- |
| Binary choice at sequence entry | Simple 1-or-2 pick upfront, mirrors Goal Kick's Kick-vs-Standard-Pass choice |          |
| You decide during planning      | Planner designs the exact UI                                                 |          |

**User's choice:** Free text — "on throw in - initial actions are standard throw-in, high throw-in, move. If move is selected - next actions are standard throw-in, high throw-in, move. If move is selected again - next actions are standard throw-in, high throw-in"
**Notes:** A per-step decision model, not a binary upfront choice — described a 3-way choice (Standard/High/Move) re-offered after each Movement Phase, capped at 2 total Movement Phases.

| Option                                | Description                                                 | Selected |
| ------------------------------------- | ----------------------------------------------------------- | -------- |
| 0, 1, or 2 moves allowed              | Immediate throw is valid too — update THROWIN-03            |          |
| Must move at least once (1 or 2 only) | Keep THROWIN-03 as written — first choice is forced to Move | ✓        |

**User's choice:** Must move at least once (1 or 2 only)
**Notes:** Resolves an internal contradiction — the user's initial description implied a zero-movement immediate-throw option, which this follow-up ruled out. THROWIN-03's "1 or 2" wording is preserved unchanged.

| Option                                    | Description                                                                             | Selected |
| ----------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| Explicit Low/High choice before targeting | Clear choice step before target-hex selection, mirrors Corner Kick's High-vs-Low choice |          |
| You decide during planning                | Match whatever existing High Pass/Standard Pass selection pattern already exists        | ✓        |

**User's choice:** You decide during planning

---

## Claude's Discretion

- Exact `GamePhase`/`GameState` field naming for the new Goal Kick chain
- Exact adherence-vs-adaptation balance for Throw-In/Goal-Kick panel styling relative to Phase 35 conventions
- Low/High throw-type selection UI shape for throw-ins
- Exact corner-hex geometry verification for the byline-default edge case (implementation-time verification)

## Deferred Ideas

None — discussion stayed within phase scope. Corner Kick (Phase 38) was referenced repeatedly as context/precedent but never proposed as in-scope for this phase.
