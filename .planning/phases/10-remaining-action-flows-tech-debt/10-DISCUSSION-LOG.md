# Phase 10: Remaining Action Flows + Tech Debt - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 10-remaining-action-flows-tech-debt
**Areas discussed:** Shot declaration flow, GK dive interaction, SNAP-02 deflection, GamePhase rename, HEAD-03 headers at goal, GK save flow, Code review debt scope, Integration test fixes, Player-reported bugs

---

## Shot Declaration Flow

| Option                       | Description                                                                          | Selected |
| ---------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Click → pick goal hex → roll | Two-step: Shoot → click goal hex → Roll Dice                                         |          |
| Click → roll immediately     | Single click, direct SHOT phase, Roll Dice                                           |          |
| Click → GK reacts → roll     | Interactive GK turn between declaration and resolution                               |          |
| Full multi-step sequence     | Declare target → path highlight → GK dives → defenders auto-roll → keeper auto-rolls | ✓        |

**User's choice:** Full sequence — "Click → pick goal hex → highlight path for deflection/save visibility → move keeper for diving save → immediately for defenders to block → immediately roll for goalie to save → immediately roll for save after effects. log for each block & save action"
**Notes:** The user described a rich multi-step flow with all intermediate rolls logged. Shot sequence confirmed as: declare target → GK dives interactively → server auto-rolls defenders in path → server auto-rolls duel. No Roll Dice button needed by the shooter after GK dives.

---

## Defender Blocking (Shot Path)

| Option         | Description                                            | Selected |
| -------------- | ------------------------------------------------------ | -------- |
| Snapshots only | Only SNAP-02 deflection applies; regular shots GK-only |          |
| All shots      | Any shot type allows defenders in path to deflect      | ✓        |

**User's choice:** Any shot type — with specific rules: in-path = 5/6 or combined ≥10 with Tackling; within-1-hex-of-path = 6 or combined ≥10 with Tackling. Deflection → Loose Ball.

---

## GK Dive Interaction

| Option      | Description                                         | Selected |
| ----------- | --------------------------------------------------- | -------- |
| Interactive | GK player picks a dive position before duel fires   | ✓        |
| Automatic   | Penalty computed from GK starting position, no move |          |
| Visual only | Path highlighted, no mechanical move                |          |

**User's choice:** Interactive — GK player picks a hex to move to (up to 3 hexes parallel to goal line). After GK confirms, server auto-resolves.

---

## Shot Roll Trigger

| Option                   | Description                                             | Selected |
| ------------------------ | ------------------------------------------------------- | -------- |
| Auto-resolve             | Server rolls immediately after GK dives, no Roll button | ✓        |
| Shooter clicks Roll Dice | Shooter manually triggers the duel after GK dives       |          |

**User's choice:** Auto-resolve — no Roll Dice button for regular shots.

---

## SNAP-02 Deflection Step

| Option                    | Description                                               | Selected |
| ------------------------- | --------------------------------------------------------- | -------- |
| Interactive opponent move | Opponent moves 1 player ≤2 hexes before snapshot resolves | ✓        |
| Skip for v1               | Snapshot goes straight to shot resolution                 |          |

**User's choice:** Interactive — full SNAP-02 implementation with opponent-move phase.

---

## GamePhase Rename

| Option                      | Description                                             | Selected |
| --------------------------- | ------------------------------------------------------- | -------- |
| UI label only               | Change displayed text only; internal value stays 'PASS' |          |
| Full rename in types + code | Rename 'PASS' → 'ACTION' everywhere                     | ✓        |

**User's choice:** Full rename — types.ts, gameEngine.ts, gameHandlers.ts, ActionPanel.tsx, all test files.

---

## HEAD-03: Headers at Goal

| Option                           | Description                                                            | Selected |
| -------------------------------- | ---------------------------------------------------------------------- | -------- |
| Explicit "Header at Goal" button | Separate button in HEADER phase UI to declare goal attempt             |          |
| Auto-detect from context         | If attacker clicks a goal-line hex as the header target → GK save flow | ✓        |

**User's choice:** Auto-detect — "header range should highlight hexes on the goal line. if a highlighted hex is selected process as a shot." No separate declaration button needed; the target hex picker handles it.

---

## GK Save Flow

| Option                                | Description                                                           | Selected |
| ------------------------------------- | --------------------------------------------------------------------- | -------- |
| Full save flow (SHOT-06 + GK_RESTART) | Save → handling check → clean catch/spill; GK_RESTART for next action | ✓        |
| GK dive position update               | Visual GK position on board when diving                               |          |

**User's choice:** Full save flow — SHOT-05 (kick/throw/movement) and SHOT-06 (handling check/spill) must work end-to-end.

---

## Code Review Debt Scope

| Option        | Description                                                | Selected |
| ------------- | ---------------------------------------------------------- | -------- |
| All 9 items   | CR-01 BLOCKER, WR-01 through WR-04, IN-01, Phase 8.2 items | ✓        |
| Critical only | CR-01 + GOAL-in-eventLog + WR-02 only                      |          |

**User's choice:** All 9 items — clean slate entering v1 release.

---

## Integration Tests

| Option                  | Description                                     | Selected |
| ----------------------- | ----------------------------------------------- | -------- |
| Fix 3 failing tests     | Update to real squad positions from 37×26 board | ✓        |
| Leave as known failures | Accept pre-existing failures                    |          |

**User's choice:** Fix — all tests should be green in CI.

---

## Player-Reported Bugs (user-added scope)

These were added by the user at the end of the discussion:

1. **Loose ball boundary bug** — `r=0` is out of bounds; Loose Ball trajectory must clamp to valid PITCH_HEXES
2. **Pass log team colour** — action log pass entries need the active team's colour
3. **High pass movement highlight** — highlight persists after end of repositioning phase
4. **One steal + tackle per player per phase** — server must reject duplicate steal/tackle from the same piece in a single movement phase
5. **Loose ball pickup continues movement** — picking up a loose ball during movement should not end the movement action; remaining pace hexes continue

---

## Claude's Discretion

- Exact naming for new FSM phases (`SHOT_DECLARED` vs `DECLARING_SHOT` vs other conventions)
- Whether to reuse `GAME_SHOT` event or introduce `GAME_DECLARE_SHOT`
- Highlight colour for goal-line hexes in the HEADER target picker
- Ordering of code review debt fixes within the plan (logical grouping)

---

## Deferred Ideas

- **PASS-02 mid-pass player movement** — explicitly deferred from Phase 8.2; not in Phase 10 scope
- **SHOT-02 GK visual relocation** (outside penalty area) — penalty applied automatically; visual GK move deferred to v2
- **Rematch / chat / spectator** — v2 scope per REQUIREMENTS.md
