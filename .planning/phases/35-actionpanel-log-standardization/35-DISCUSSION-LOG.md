# Phase 35: ActionPanel & Log Standardization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 35-ActionPanel & Log Standardization
**Areas discussed:** Todo cross-reference, Border removal scope, End Turn button color-state consistency, Goalkeeper terminology, Log entry glyph consistency

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

## Claude's Discretion

- Exact abbreviation for the inline Keeper player-label prefix (currently `"GK"`) — as long as it isn't "GK" or "Goalie".
- Any `formatEvent` case not explicitly enumerated during discussion that turns out to need a glyph correction under the "binary outcome" rule.
- Whether button-background contrast alone is sufficient visual affordance once container borders are removed, or a subtle box-shadow/background differentiation is needed.

## Deferred Ideas

- **Loose-ball pathing on a blocked shot paths from the shooting square instead of the blocking square** — gameplay-logic bug, unrelated to this phase's scope. First raised during Phase 34 discussion as a deferred idea; user asked this session to formalize it as an actual backlog todo file: `.planning/todos/pending/loose-ball-pathing-blocked-shot-wrong-origin.md`.
- **Undo can progress earlier than a dice-roll-triggering action (tackle/steal) within a move** — undo-boundary bug, unrelated to this phase's scope. First raised during Phase 34 discussion as a deferred idea; user asked this session to formalize it as an actual backlog todo file: `.planning/todos/pending/undo-boundary-should-stop-at-dice-roll-trigger.md`.
