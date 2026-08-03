# Phase 33: Design Tokens & Highlight Standardization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 33-Design Tokens & Highlight Standardization
**Areas discussed:** Highlight color palette, Selected vs already-moved ring colors, Token file structure & scope, Ball-location marker design

---

## Highlight color palette

| Option                                        | Description                                                                                            | Selected |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| Traffic-light semantic system                 | green=safe, yellow/amber=risk, red=danger-only, blue=neutral-info, distinct color for shot-opportunity | ✓        |
| Keep existing families, fix red conflict only | Leave yellow/orange/blue/white as-is, only move goal off red                                           |          |
| Custom per-type                               | Walk through all 13-14 types individually                                                              |          |

**User's choice:** Traffic-light semantic system.
**Notes:** Frees red exclusively for offside/rule-violation; goal/shot-target moves to a distinct non-red color (exact swatch at Claude's discretion).

---

## Selected vs already-moved ring colors

| Option                                       | Description                                 | Selected |
| -------------------------------------------- | ------------------------------------------- | -------- |
| Green (selected) + teal/cyan (already-moved) | Cool, informational hue for the moved state |          |
| Green (selected) + purple (already-moved)    | Maximally distinct hue                      |          |
| Custom exact colors                          | User specifies hex values                   |          |

**User's choice:** Neither preset — user proposed a custom treatment: dark grey ring outline + light grey semi-transparent overlay circle over the piece (a "dimmed/used-up" look), exact tones at Claude's discretion. Fallback if unworkable: keep existing orange ring + red X with minor tone adjustment.
**Notes:** Selected/active ring stays green, unchanged.

---

## Token file structure & scope

| Option                                 | Description                                                   | Selected |
| -------------------------------------- | ------------------------------------------------------------- | -------- |
| Tokens now, current blue-theme values  | Migrate literals to tokens now; Phase 34 does pure value swap | ✓        |
| Tokens now, placeholder neutral values | Blank-slate values, not blue, not final charcoal              |          |

**User's choice:** Tokens now, current blue-theme values.
**Notes:** Phase 34 becomes a pure token-value swap with zero literal-hunting.

---

## Ball-location marker design

| Option                             | Description                     | Selected |
| ---------------------------------- | ------------------------------- | -------- |
| Small white/cream ring or dot icon | Static marker above all layers  |          |
| Pulsing ring animation             | Same marker with CSS pulse/glow |          |
| Custom                             | User specifies exact look       | ✓        |

**User's choice:** White hex-edge outline, same stroke thickness as existing player-state ring indicators — not a dot/icon/pulse marker.
**Notes:** Must render always-on-top during response phases (headers, kicks).

---

## Claude's Discretion

- Exact non-red color for shot-opportunity/goal-target highlight.
- Exact grey tones for the already-moved-this-stage ring + overlay circle.
- Full enumeration and document format for the ~13-14 highlight-type reference table.
- Whether chrome tokens and highlight/ring colors live in one file or two.
- Z-order/layering mechanism for the ball-location hex-edge highlight.

## Deferred Ideas

- Back button on create-game screen — new UI capability, not a Phase 33 design-token/highlight change. Logged for future backlog.
- Duplicate-player prevention in draft packs — draft-engine correctness fix, unrelated to visual tokens. Logged for future backlog.
