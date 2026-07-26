# Phase 34: Visual Theme Restyle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 34-Visual Theme Restyle
**Areas discussed:** Pending todo cross-reference, Palette reference & tones, Team-accent contrast strategy, Functional/status color treatment

---

## Pending Todo Cross-Reference

| Option                             | Description                                                                                 | Selected |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| Leave both alone                   | Neither is a chrome-color/theme defect                                                      | ✓        |
| Fold BUG-23 shading bug in         | Re-check the KICK_OFF_SETUP shading issue while touching related rendering code             |          |
| Archive the stale GK_KICK file now | Delete/archive the pending todo since the underlying work was already completed in Phase 31 | ✓        |

**User's choice:** Leave both alone (neither folded into scope) + archive the stale GK_KICK file now.
**Notes:** The GK_KICK replay-visibility todo was confirmed stale (fixed in Phase 31, REPLAY-06) and moved to `.planning/todos/completed/` in commit `dbf66f7`, outside the CONTEXT.md/formal-fold flow. BUG-23 (KICK_OFF_SETUP shading) stays out of scope, unchanged from its Phase 31/32/33 disposition.

---

## Scope Creep Noted

During area selection, the user also raised two new bug reports unrelated to Phase 34's chrome-theme scope:

1. Loose-ball pathing on a blocked shot should path from the blocking square, not the shooting square.
2. Undo should not progress earlier than a dice-roll-triggering action (tackle/steal) within a move.

Both redirected to Deferred Ideas in CONTEXT.md — not acted on, not part of THEME-01/02/04.

---

## Palette Reference & Tones

| Option                               | Description                                                      | Selected |
| ------------------------------------ | ---------------------------------------------------------------- | -------- |
| No specific reference — Claude picks | Neutral, true-charcoal broadcast look, no blue tint carried over | ✓        |
| I have a reference in mind           | Describe the look/app/broadcast being pictured                   |          |

**User's choice:** No specific reference — Claude picks.

| Option                | Description                                                    | Selected |
| --------------------- | -------------------------------------------------------------- | -------- |
| Keep 3-tier structure | Preserve page/panel/panel-alt layering, just recolor each tier | ✓        |
| Flatter, 2-tier depth | Simplify to page background + one panel tone                   |          |

**User's choice:** Keep 3-tier structure.
**Notes:** No blue tint carried forward from the old theme is a hard constraint per success criterion #1.

---

## Team-Accent Contrast Strategy

| Option                                  | Description                                                              | Selected |
| --------------------------------------- | ------------------------------------------------------------------------ | -------- |
| Auto-darken/lighten per-team as needed  | Adjust only failing colors until they clear AA; passing colors untouched | ✓        |
| Restrict accent usage, keep raw colors  | Never use raw uiColor as text-on-background; only for non-text purposes  |          |
| Uniform darkening formula for all teams | Apply the same adjustment step to every team regardless of pass/fail     |          |

**User's choice:** Auto-darken/lighten per-team as needed.

| Option                               | Description                                                                         | Selected |
| ------------------------------------ | ----------------------------------------------------------------------------------- | -------- |
| New derivation layer only            | Leave TEAM_CONFIGS.uiColor untouched; adjust only at --team-accent derivation point | ✓        |
| Adjust TEAM_CONFIGS.uiColor directly | Change raw uiColor values in shared/teamConfig.ts for any failing team              |          |

**User's choice:** New derivation layer only.
**Notes:** Keeps raw brand colors intact for other UI consumers (scoreboard, action log) that aren't subject to THEME-04.

---

## Functional/Status Color Treatment

| Option                             | Description                                                                                           | Selected |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| Keep as-is                         | Semantic/functional colors, not part of the blue→charcoal swap; already read fine on dark backgrounds | ✓        |
| Retune to match new palette's mood | Adjust saturation/brightness for cohesion with new charcoal aesthetic                                 |          |

**User's choice:** Keep as-is.

---

## Claude's Discretion

- Exact hex values for all charcoal/graphite tiers and white text tones.
- Exact per-team contrast-adjustment algorithm/amount for failing team colors.
- Where exactly the new contrast-safe derivation layer lives in code.
- Stylelint rule configuration/scope and which now-unreferenced CSS classes get removed.

## Deferred Ideas

- Loose-ball pathing on a blocked shot (should path from blocking square, not shooting square) — new gameplay bug, future phase/quick-task.
- Undo-boundary gap: undo should not progress earlier than a dice-roll-triggering action (tackle/steal) — new state-management bug, future phase/quick-task.
- BUG-23 KICK_OFF_SETUP shading — reviewed again, left out of scope (unchanged disposition).
- csv-consolidation-player-pool.md — reviewed again, remains unassigned low-priority idea.
