# Phase 35: ActionPanel & Log Standardization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 35-ActionPanel & Log Standardization
**Areas discussed:** Todo cross-reference, Border removal scope, End Turn button color-state consistency, Goalkeeper terminology, Log entry glyph consistency, Same-space component audit (panel headings, log label collision, hex-coordinate readability, log casing/arrow-glyphs, button verb, waiting-state phrasing, dead-code cleanup)

---

## Todo cross-reference

| Option                    | Description                                                                                                                               | Selected |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Leave both alone          | BUG-23 and CSV consolidation todo — neither is really about ActionPanel/Log formatting; both already reviewed and declined in Phase 33/34 | ✓        |
| Fold in BUG-23            | KICK_OFF_SETUP shot-path shading rendering bug                                                                                            |          |
| Fold in CSV consolidation | player-pool.csv consolidation idea                                                                                                        |          |

**User's choice:** Leave both alone (third time declined — Phase 33, 34, and now 35).
**Notes:** User simultaneously asked to formalize two _different_ gameplay bugs (raised during Phase 34 discussion but never turned into todo files) as new backlog items — see Deferred Ideas below.

---

## Border removal scope (PANEL-02)

| Option                      | Description                                                                                | Selected |
| --------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| Remove everywhere           | Strip border from ActionLog panel, every ActionPanel button, and the confirm-dialog card   |          |
| Remove only from containers | Strip border from ActionLog panel and confirm-dialog card; leave buttons with their border | ✓        |
| Something else              | —                                                                                          |          |

**User's choice:** Remove only from containers.
**Notes:** User's own distinction: buttons are interactive controls, not "framing" — PANEL-02's "no border framing" requirement targets container/frame elements specifically.

---

## End Turn button color-state consistency (PANEL-03)

| Option                         | Description                                                                                                                      | Selected |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Yes, unify everywhere          | Every phase with an eligible-remaining count uses the same dynamic orange→green `ctaButtonClass(remaining)` logic as MOVE/HEADER | ✓        |
| Leave single-slot phases green | Only unify phases with multiple pending slots                                                                                    |          |
| Something else                 | —                                                                                                                                |          |

**User's choice:** Yes, unify everywhere.
**Notes:** Applies to HIGH_PASS_MOVE, FIRST_TIME_PASS_MOVE, SNAPSHOT_DEFLECT, GK_KICK_MOVE, FREE_MOVE_ATTACK/DEFENSE, and FREE_KICK_SETUP — all currently hardcode green regardless of pending state.

---

## Goalkeeper terminology (PANEL-04)

| Option     | Description                                                                      | Selected |
| ---------- | -------------------------------------------------------------------------------- | -------- |
| GK         | Short abbreviation, matches existing label-prefix convention                     |          |
| Goalkeeper | Full formal term everywhere                                                      |          |
| Keeper     | Casual/broadcast-style term, matches Phase 34's broadcast-sports theme direction | ✓        |

**User's choice:** Keeper.
**Notes:** Scoped to ActionPanel/ActionLog user-facing text only (PANEL-04's stated scope) — not a whole-app rename.

---

## Log entry glyph consistency (PANEL-04)

| Option                         | Description                                                                                                 | Selected |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------- |
| Yes — glyph iff binary outcome | Every event type with a clear success/fail result gets ✓/✗; structural/informational events stay glyph-free | ✓        |
| Remove glyphs entirely         | Drop ✓/✗ everywhere, rely on bracketed prefix + team color                                                  |          |
| Something else                 | —                                                                                                           |          |

**User's choice:** Yes — glyph iff binary outcome.
**Notes:** Formalizes a pattern that's already mostly followed in `ActionLog.tsx`'s `formatEvent()` — codifies it as an explicit rule to audit every case against during implementation.

---

---

## Same-space component audit

User asked directly whether the first pass had reviewed (1) all elements rendered in the same space as ActionPanel, (2) messaging format/structure consistency across all action-selection sections, and (3) all log formatting/structure for consistency and player-friendly language. Answer was no on all three — the first pass only covered `ActionPanel.tsx`/`ActionLog.tsx` literally, not their same-slot siblings (`KickOffSetupPanel`, `FreeKickSetupPanel`, `ReplayPanel` in `GameBoard.tsx`'s `topBandRight`) or `ActionLog`'s `SideLog` wrapper. A follow-up audit of those files surfaced several new violations, resolved across two rounds of questions:

### Panel headings

| Option                             | Description                                                                | Selected |
| ---------------------------------- | -------------------------------------------------------------------------- | -------- |
| Add a heading to ActionPanel       | Match KickOffSetupPanel/FreeKickSetupPanel/ReplayPanel, which all show one | ✓        |
| Drop headings from the other three | Match ActionPanel's headerless style instead                               |          |
| Leave as-is                        | Each panel's need is different enough                                      |          |

**User's choice:** Add a heading to ActionPanel.

### Match log label collision

| Option            | Description                                                          | Selected |
| ----------------- | -------------------------------------------------------------------- | -------- |
| "MATCH LOG" only  | Keep SideLog wrapper's label, remove ActionLog's own internal header | ✓        |
| "ACTION LOG" only | Keep ActionLog's header, remove the wrapper's label                  |          |
| Something else    | —                                                                    |          |

**User's choice:** "MATCH LOG" only.

### Log hex-coordinate readability

| Option                      | Description                                       | Selected |
| --------------------------- | ------------------------------------------------- | -------- |
| Keep raw coordinates        | Intentional board-game transparency, not a UX bug | ✓        |
| Replace with readable zones | Bigger scope, needs its own design pass           |          |
| Something else              | —                                                 |          |

**User's choice:** Keep raw coordinates.

### Log casing and arrow-glyph consistency

| Option                                   | Description                                    | Selected |
| ---------------------------------------- | ---------------------------------------------- | -------- |
| Sentence case + unicode arrow everywhere | Drop ALL-CAPS emphasis, unify -> to →          | ✓        |
| ALL CAPS for outcomes + unicode arrow    | Keep punchy caps style, only unify arrow glyph |          |
| Something else                           | —                                              |          |

**User's choice:** Sentence case + unicode arrow everywhere.

### Confirm/Ready/End Turn button verb

| Option            | Description                                                 | Selected |
| ----------------- | ----------------------------------------------------------- | -------- |
| Keep separate     | "Ready" and "End Turn" describe genuinely different actions |          |
| Unify to one term | Single verb across all three panels                         | ✓        |

**User's choice:** Unify to one term — then, in a targeted follow-up, chose **"Confirm"** specifically over "Ready" and "End Turn" (the only one of the three that reads naturally in both a pre-turn placement context and an active-turn-ending context).

### Waiting-state phrasing

| Option                                          | Description                                                  | Selected |
| ----------------------------------------------- | ------------------------------------------------------------ | -------- |
| Keep FreeKickSetupPanel's more specific version | "{Team} is repositioning…" applied wherever context is known | ✓        |
| Unify to "Waiting for opponent…" everywhere     | Simpler, less specific                                       |          |
| Leave as-is                                     | Not worth standardizing                                      |          |

**User's choice:** Keep FreeKickSetupPanel's more specific version, extend it elsewhere.

### Dead-code cleanup (ActionPanel's FREE_KICK_SETUP block)

| Option                              | Description                                                                                                                                 | Selected |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Confirm dead, remove + consolidate  | Delete ActionPanel's unreachable FREE_KICK_SETUP block; extract a shared color-state helper used by both ActionPanel and FreeKickSetupPanel | ✓        |
| Leave ActionPanel's branch in place | Don't touch it even if unreachable                                                                                                          |          |

**User's choice:** Confirm dead, remove + consolidate.

---

## Claude's Discretion

- Exact abbreviation for the inline Keeper player-label prefix (currently `"GK"`) — as long as it isn't "GK" or "Goalie".
- Any `formatEvent` case not explicitly enumerated during discussion that turns out to need a glyph, casing, or arrow-glyph correction under the rules established.
- Whether button-background contrast alone is sufficient visual affordance once container borders are removed, or a subtle box-shadow/background differentiation is needed.
- Exact heading text/derivation for ActionPanel.
- Exact shape of the shared color-state helper (hook vs. plain function vs. relocated module).
- Exact wording of KickOffSetupPanel's waiting-state text once made more specific (it has no natural attacking/defending framing the way FreeKickSetupPanel does).

## Deferred Ideas

- **Loose-ball pathing on a blocked shot paths from the shooting square instead of the blocking square** — gameplay-logic bug, unrelated to this phase's scope. First raised during Phase 34 discussion as a deferred idea; user asked this session to formalize it as an actual backlog todo file: `.planning/todos/pending/loose-ball-pathing-blocked-shot-wrong-origin.md`.
- **Undo can progress earlier than a dice-roll-triggering action (tackle/steal) within a move** — undo-boundary bug, unrelated to this phase's scope. First raised during Phase 34 discussion as a deferred idea; user asked this session to formalize it as an actual backlog todo file: `.planning/todos/pending/undo-boundary-should-stop-at-dice-roll-trigger.md`.
