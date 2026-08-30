# Phase 41: Card & Injury Iconography - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 41-card-injury-iconography
**Areas discussed:** Icon visual style, Pitch token position rule, Simultaneous card+injury

---

## Icon visual style

| Option                             | Description                                                                                                                                            | Selected |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Adopt pitch token's glyphs         | Same colored rect + cross shapes everywhere — one visual language, matches what's already built and tested on the pitch token; text chips get replaced | ✓        |
| Keep text, restyle for consistency | Keep 'YELLOW'/'RED'/'INJ' text but give them identical styling across all three card surfaces — pitch token stays visually distinct as a special case  |          |
| Let me describe something else     | —                                                                                                                                                      |          |

**User's choice:** Adopt pitch token's glyphs (Recommended)
**Notes:** No follow-up — recommended option accepted directly.

---

## Pitch token position rule

| Option                         | Description                                                                                                                           | Selected |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Yes, name-row cards only       | Pitch token keeps its existing corner-anchor treatment; the position rule governs only the 3 cards that actually have a name·flag row | ✓        |
| Let me describe something else | —                                                                                                                                     |          |

**User's choice:** Yes, name-row cards only (Recommended)
**Notes:** No follow-up — recommended option accepted directly.

---

## Simultaneous card + injury

| Option                         | Description                                                                                                                                           | Selected |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Yes, both side by side         | Matches the pitch token's existing behavior — one visual rule everywhere: card and injury are independent statuses, both always shown when both apply | ✓        |
| Let me describe something else | —                                                                                                                                                     |          |

**User's choice:** Yes, both side by side (Recommended)
**Notes:** No follow-up — recommended option accepted directly.

---

## Claude's Discretion

- Concrete component shape (single parameterized component vs. two thin wrappers around a shared glyph-drawing core) — left to planner, since half the target surfaces render outside any `<svg>` context.
- Exact pixel sizing/spacing of the badge per surface.

## Deferred Ideas

- None raised during this discussion. Three pending todos were reviewed via automatic phase-matching (KICK_OFF_SETUP shading bug, offside-ring-after-goal bug, CSV consolidation idea) — all three were weak generic-keyword matches, not genuine iconography-phase matches. The two bugs remain tagged to Phase 46; the CSV idea was confirmed already complete and moved to `.planning/todos/completed/`.
