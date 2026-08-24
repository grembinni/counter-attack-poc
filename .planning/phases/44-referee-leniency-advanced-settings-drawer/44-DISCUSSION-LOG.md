# Phase 44: Referee Leniency & Advanced Settings Drawer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-23
**Phase:** 44-Referee Leniency & Advanced Settings Drawer
**Areas discussed:** Leniency stepper behavior, Leniency row layout, Advanced drawer disclosure & columns, Coupling copy wording

---

## Leniency stepper behavior

| Option     | Description                                                                                                | Selected |
| ---------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| 3          | Rounds down from the 2–5 midpoint (3.5). Slightly more lenient than strict.                                |          |
| 4          | Rounds up from the 2–5 midpoint (3.5). Slightly stricter — matches the median of the old 1–6 random range. | ✓        |
| You decide | Claude picks based on convention/simplicity during planning.                                               |          |

**User's choice:** 4

| Option            | Description                                                                              | Selected |
| ----------------- | ---------------------------------------------------------------------------------------- | -------- |
| Disable at bounds | Minus disabled at 2, plus disabled at 5 — matches Booking/Injury disabled-state pattern. | ✓        |
| Clamp silently    | Buttons stay enabled but clicking past 2/5 has no effect.                                |          |
| Wrap around       | Clicking past 5 wraps to 2, and past 2 wraps to 5.                                       |          |

**User's choice:** Disable at bounds

| Option              | Description                                                                                                | Selected |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | -------- |
| Custom +/- buttons  | Two small buttons matching the app's existing button system; matches "up/down stepper" language literally. |          |
| Native number input | `<input type="number" min="2" max="5">` — native spinner arrows, less custom CSS.                          | ✓        |

**User's choice:** Native number input
**Notes:** Flagged in CONTEXT.md that a native input doesn't give per-direction disabled styling the way a custom control would — `min`/`max` gives native bounds-clamping, which was treated as satisfying "disable at bounds" in spirit.

---

## Leniency row layout

| Option                          | Description                                                                                                     | Selected |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| Always visible, greyed when off | Mirrors the existing Booking/Injury pattern — visible row, disabled input, dimmed style.                        | ✓        |
| Only shown when enabled         | Stepper row appears/disappears based on the toggle — new interaction pattern not used elsewhere on this screen. |          |

**User's choice:** Always visible, greyed when off

| Option                            | Description                                                                            | Selected |
| --------------------------------- | -------------------------------------------------------------------------------------- | -------- |
| Grouped with Fouls/Booking/Injury | Since Leniency drives the booking threshold, cluster it with the Fouls-family toggles. |          |
| Own row, natural order            | Add it wherever the 6 toggles fall in the 2-column grid — no special grouping logic.   | ✓        |

**User's choice:** Own row, natural order
**Notes:** This ended up placing Leniency in the "independent toggles" right column once the fixed 3+3 grouping was decided in the next area — consistent, not contradictory.

---

## Advanced drawer disclosure & columns

| Option              | Description                                                                                   | Selected |
| ------------------- | --------------------------------------------------------------------------------------------- | -------- |
| Text link + chevron | "Advanced ▾" style link, similar to the existing "← Back" sublink styling (`styles.subLink`). | ✓        |
| Full-width bar      | A distinct bordered/background bar spanning the settings card width.                          |          |
| You decide          | Claude picks a treatment consistent with the existing design-token/card system.               |          |

**User's choice:** Text link + chevron

| Option                                 | Description                                                                                                                     | Selected |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Fixed pairing: 3 + 3 in logical groups | Left: Fouls, Booking, Injury (foul-family). Right: Out-of-Bounds, Referee Leniency, Tackle/Steal Decline (independent toggles). | ✓        |
| Simple even split, existing order      | Lay the current top-to-bottom order into two columns with no semantic grouping.                                                 |          |

**User's choice:** Fixed pairing: 3 + 3 in logical groups

---

## Coupling copy wording

| Option             | Description                                                                                           | Selected |
| ------------------ | ----------------------------------------------------------------------------------------------------- | -------- |
| Short inline note  | e.g. "Also affects added time" — terse helper text, matching the existing "(requires Fouls)" pattern. | ✓        |
| Fuller explanation | e.g. "A stricter setting also increases added time." — a full sentence.                               |          |
| You decide         | Claude drafts copy consistent with the screen's existing tone during planning.                        |          |

**User's choice:** Short inline note

---

## Claude's Discretion

- Exact copy text for the added-time coupling note (must mention added time, short tone matching `(requires Fouls)`)
- CSS/layout mechanics for the two-column grid (Grid vs flex-wrap)
- Shape of the shared Fouls-grey-out derivation (SETTINGS-07) — pure code-organization choice

## Deferred Ideas

None — discussion stayed within phase scope. Three pending todos were checked against this phase's domain via `todo.match-phase` but all were low-confidence keyword matches on unrelated rendering/UX bugs already filed for Phase 46; none were folded or reviewed as in-scope.

## Prior-State Finding (not a discussed gray area, but worth recording)

REFEREE-03 (narrowing the random Leniency roll from 1–6 to 2–5) was discovered to already be shipped via an out-of-band quick task (`260823-akw`, commit `390bd271`) landed immediately after Phase 42 closed, before Phase 44 began. This was surfaced to the user at the start of the discussion as context, not asked as a question — see CONTEXT.md's Phase Boundary section for the full detail downstream agents need.
