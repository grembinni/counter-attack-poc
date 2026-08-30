# Phase 44: Referee Leniency & Advanced Settings Drawer - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning

<domain>
## Phase Boundary

At game creation, the host can enable a manual Referee Leniency override (default off; range 2–5 via a stepper, defaulting to 4) that replaces the random 2–5 roll and drives both the booking threshold and added-time calculation. All six match-rule toggles — Fouls, Booking, Injury, Out-of-Bounds, Referee Leniency, and Tackle/Steal Decline — move from the current single vertical "Match Rules" stack into a collapsed-by-default "Advanced" section on `GameSettingsScreen`, laid out in a two-column grid. The existing Fouls→Booking/Injury grey-out behavior must keep working inside the new layout via one shared derivation used at both render and confirm time.

**Important prior-state finding:** REFEREE-03 (narrowing the random Leniency roll from 1–6 to 2–5) is **already shipped** — a quick task (`260823-akw`, commit `390bd271`) landed it right after Phase 42 closed, before this phase started. `buildInitialGameState` already calls `randomInt(2, 6)` for `refereeCard.leniency` when no manual override exists. Phase 44's real remaining scope is: the manual override toggle + stepper + coupling copy (REFEREE-01/02/04), and the Advanced drawer restructuring (SETTINGS-05/06/07). Do not re-implement REFEREE-03.

</domain>

<decisions>
## Implementation Decisions

### Referee Leniency stepper

- **D-01:** Stepper defaults to **4** when the override is first switched on (not 3).
- **D-02:** Range stays 2–5. At the bounds, controls should behave as "disabled at bounds" — decrementing stops working at 2, incrementing stops at 5, matching the disabled-state visual language already used for Booking/Injury under Fouls.
- **D-03:** Implement the stepper as a **native `<input type="number" min={2} max={5}>`**, not custom +/- buttons. Note for planner: native number inputs don't offer per-direction disabled styling the way a custom control would — the `min`/`max` attributes give native bounds-clamping (browser stops incrementing/decrementing past them), which satisfies the intent even if it doesn't produce a distinct greyed-out arrow. If pixel-perfect bounds styling turns out to matter, flag it back to the user rather than silently switching to custom buttons.

### Referee Leniency row layout

- **D-04:** The stepper row is **always visible**, greyed out (input disabled) whenever the override toggle is off — mirrors the existing Booking/Injury-under-Fouls pattern exactly. Do not conditionally mount/unmount the stepper based on the toggle.
- **D-05:** No special grouping — Referee Leniency gets its own row, placed by whatever natural position the two-column grouping decision below puts it in (right column, see D-07).

### Advanced drawer disclosure & columns

- **D-06:** Collapsed-by-default trigger is a **text link + chevron** (e.g. "Advanced ▾"), styled consistently with the existing `styles.subLink` treatment already used for the "← Back" link on this same screen — not a full-width bordered bar.
- **D-07:** The 6 toggles split into two **fixed logical-group columns**, not just an even top-to-bottom split:
  - Left column: **Fouls, Booking, Injury** (the foul-dependency family)
  - Right column: **Out-of-Bounds, Referee Leniency, Tackle/Steal Decline** (independent toggles)

### Coupling copy (REFEREE-04)

- **D-08:** Use a **short inline note**, not a full sentence — terse helper text near the stepper, matching the tone of the existing `(requires Fouls)` suffix pattern already in `GameSettingsScreen.tsx` (e.g. `<span className={styles.comingSoon}>`-style annotation). Exact wording is Claude's discretion at planning/implementation time, but it must explicitly mention added time.

### Claude's Discretion

- Exact copy text for the added-time coupling note (must mention added time; keep it short, matching `(requires Fouls)` tone).
- CSS/layout mechanics for the two-column grid (CSS Grid vs flex-wrap) — no user preference expressed, follow existing `GameSettingsScreen.module.css` conventions.
- The shared-derivation refactor shape for SETTINGS-07 (e.g. a `foulsGreyOut` boolean or small helper function) — purely a code-organization choice, not a visible UX decision.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/ROADMAP.md` (Phase 44 section, "Referee Leniency & Advanced Settings Drawer") — goal, success criteria, dependency on Phase 43's final toggle set
- `.planning/REQUIREMENTS.md` (REFEREE-01..04, SETTINGS-05..07) — exact requirement text; note REFEREE-03's random-range language is stale relative to already-shipped code (see Phase Boundary above)
- `.planning/PROJECT.md` (Current Milestone: v1.7, "Referee Leniency toggle" and "UI iconography/layout consistency" bullets)

### Prior-state / already-shipped work relevant to this phase

- `packages/server/src/gameEngine.ts` lines ~262-266, ~434-437 — `buildInitialGameState`'s existing `randomInt(2, 6)` leniency roll (REFEREE-03 already done, commit `390bd271`)
- `packages/shared/src/types.ts` lines ~162-169, ~1231-1234 — `RefereeCard` type and `refereeCard` field, already documented as "Range 2–5"

No other external specs/ADRs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/client/src/components/GameSettingsScreen.tsx` — the file to modify. Currently renders a single vertical "Match Rules" section (lines ~176-209) with 5 checkboxes: Fouls, Booking, Injury, Out-of-Bounds, Tackle/Steal Decline. `onConfirm` callback signature (lines ~22-36) needs two new fields for the Leniency override (enabled flag + value).
- `styles.subLink` (used for the "← Back" link, line ~251-253) — reuse this treatment for the new "Advanced ▾" disclosure trigger.
- `styles.poolRowDisabled` / `styles.comingSoon` — existing greyed-out-row and small-annotation-text patterns; reuse for both the Leniency stepper's disabled state and the added-time coupling note.

### Established Patterns

- **Shared-derivation gap (what SETTINGS-07 asks to fix):** today the Fouls→Booking/Injury grey-out is computed independently in two places — inline `!fouls` checks in `toggleBooking`/`toggleInjury`/render (lines ~92-104, ~182-191) and again via `fouls && booking` / `fouls && injury` normalization inside `handleConfirm` (lines ~117-120). Phase 44 should extract this into one shared derivation (e.g. a small pure function or `useMemo`) used at both sites, satisfying SETTINGS-07's "driven by one shared derivation" requirement.
- No existing collapsible/disclosure component exists anywhere in `packages/client/src/components` — this will be a new local pattern (state + conditional render + chevron), not a reuse of something from `ActionPanel.tsx`/`ActionLog.tsx`'s unrelated collapse mechanisms.
- Toggle-row shape to mirror for the new Referee Leniency row: same `<label className={styles.poolRow}>` + `<input type="checkbox">` structure used by the other 5 toggles, with an added `<input type="number">` alongside it.

### Integration Points

- `onConfirm` payload (client) flows into whatever handler in `packages/client/src/App.tsx` currently forwards `tackleStealDecline` etc. to the server via socket event — the same handoff point needs the two new Leniency fields.
- Server-side: `packages/server/src/roomStore.ts` / `roomHandlers.ts` already carry the `tackleStealDecline` toggle end-to-end (validated → Room → `buildInitialGameState`); mirror this exact pattern for the manual override (validate → store on room settings → `buildInitialGameState` uses the override value instead of `randomInt(2, 6)` when present).
- `packages/shared/src/events.ts` and `packages/shared/src/types.ts` will need the new override fields added to whatever settings-confirm event/type carries `tackleStealDecline` today.

</code_context>

<specifics>
## Specific Ideas

- Stepper default: **4**, not the arithmetic midpoint's floor (3).
- Trigger label reads "Advanced" with a chevron (▾/▸ or similar), not a heavier bordered box.
- Coupling note should read short and inline, in the same voice as `(requires Fouls)` — not a full explanatory sentence.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No todos matched this phase's domain (the 3 pending todos are unrelated rendering/UX bugs already earmarked for Phase 46).

</deferred>

---

_Phase: 44-Referee Leniency & Advanced Settings Drawer_
_Context gathered: 2026-08-23_
