# Phase 5: Dice Resolver + All Resolution Branches - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 5-dice-resolver-all-resolution-branches
**Areas discussed:** Rules Version, Player Attribute Corrections, Post-save Outcome, Long Ball Accuracy, GK Restart Event Design, GK Kick Accuracy, Roll Phase Design, Tie Handling

---

## Rules Version

| Option                                       | Description                                                                    | Selected |
| -------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| Box rulebook (2019)                          | Implement exactly what the PDF says. Update requirements to match.             |          |
| v1.4.1 requirements (keep as-is)             | Keep existing requirements as the authoritative source.                        |          |
| Hybrid: box rules as base, add v1.4.1 extras | Use PDF as ground truth for corrections; keep v1.4.1 additions that add value. | ✓        |

**User's choice:** Hybrid approach
**Notes:** Rulebook opened mid-session revealed several corrections (highPass attribute, inaccurate high pass outcome, shot tie behaviour). User confirmed the boxed game PDF as ground truth but retained v1.4.1 depth features (long ball accuracy check, GK restart options, handling attribute).

---

## Post-save Outcome

| Option                                   | Description                                                                       | Selected |
| ---------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| Box rule: dice 1-3 = corner, 4-6 = catch | Simple die roll, no handling attribute used. Remove validateHandlingCheck.        |          |
| v1.4.1: handling attribute threshold     | Keep gk.handling — higher handling = catches more saves. Adds GK differentiation. | ✓        |

**User's choice:** v1.4.1 handling attribute threshold
**Notes:** Preserves strategic depth of GK selection. `validateHandlingCheck` stays as-is.

---

## Long Ball Accuracy

| Option                               | Description                                                  | Selected |
| ------------------------------------ | ------------------------------------------------------------ | -------- |
| Keep v1.4.1 accuracy check           | 9+ same third, 10+ cross-third. Already in passValidator.ts. | ✓        |
| Drop to box rules: no accuracy check | Simpler; removes a strategic risk element.                   |          |

**User's choice:** Keep v1.4.1 accuracy check
**Notes:** Long ball accuracy check already implemented correctly. No change needed.

---

## GK Restart Event Design

| Option                                        | Description                                                                                          | Selected |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| One game:gk-restart event with choice payload | Single event: { choice: 'kick' \| 'throw' \| 'movement' }. Consistent with existing event structure. | ✓        |
| Three separate events                         | GAME_GK_KICK, GAME_GK_THROW, GAME_GK_MOVEMENT. More explicit but more surface area.                  |          |

**User's choice:** Single `game:gk-restart` event with choice payload

---

## GK Kick Accuracy

| Option                                      | Description                                                           | Selected |
| ------------------------------------------- | --------------------------------------------------------------------- | -------- |
| v1.4.1: kick needs High Pass accuracy check | Uses GK's highPass + dice ≥ 8. Inaccurate = nearest defender header.  | ✓        |
| Box rule: GK kick always accurate           | No accuracy roll. Simpler but removes kick-vs-throw strategic choice. |          |

**User's choice:** v1.4.1 accuracy check for GK kick
**Notes:** Makes quick throw (always accurate, uninterceptable) a meaningful alternative when GK has low highPass.

---

## Roll Phase Design (game:roll broadcast)

| Option                                    | Description                                                                                       | Selected |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| Single broadcast: dice + outcome together | Server rolls, applies outcome, broadcasts one game:state with lastDiceRoll embedded.              | ✓        |
| Two-phase: roll then apply                | game:roll → dice broadcast → second client event → outcome applied. Matches SC-2 literal wording. |          |

**User's choice:** Single broadcast
**Notes:** `lastDiceRoll` field added to GameState so clients can display the roll before animating the board transition.

---

## Tie Handling

| Option                                  | Description                                                                                | Selected |
| --------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| Server loops internally until no tie    | Server re-rolls both on tie; broadcasts final non-tie result. Standard rulebook behaviour. |          |
| Emit each re-roll as separate broadcast | Intermediate states for drama. More complex.                                               |          |
| Ties produce Loose Ball                 | Tie in any duel (shot, heading) = Loose Ball from incident hex. No re-roll.                | ✓        |

**User's choice:** Ties → Loose Ball
**Notes:** Deliberate simplification. Makes ties a distinct meaningful outcome rather than a loop. Update validateShotDuel to return LOOSE_BALL on tie.

---

## Claude's Discretion

- Loose Ball direction mapping (1–6 → axial directions): Claude defines the constant.
- `lastDiceRoll` field shape in `GameState`: Claude defines the exact structure.
- `resolveLoseBall` placement (shared vs server): Claude decides based on whether state access is needed.

## Deferred Ideas

- Advanced rules (tackles from behind, extra yard injury risk, difficult-angle penalties) — out of scope for v1.
- Snapshot during movement (MOVE-07) — condition detected in Phase 4, resolved in Phase 5.
