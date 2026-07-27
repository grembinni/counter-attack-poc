# Phase 35: ActionPanel & Log Standardization - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

ActionPanel (`packages/client/src/components/ActionPanel.tsx`/`.module.css`) and ActionLog (`ActionLog.tsx`/`.module.css`) present one consistent visual and language system across every game phase: consistent help-text format, zero border-framing on containers, uniform button sizing/color-state/interaction behavior, and consistent terminology (PANEL-01..04). This phase does NOT touch chrome design tokens or the charcoal/graphite palette itself (already delivered in Phase 33/34 — this phase only changes values/properties _within_ the existing token system, e.g. removing a `border` declaration or swapping which token drives a button's background). It does NOT touch hex-highlight/piece-ring colors (Phase 33, HILITE-01..05) and does NOT touch response-move activation logic (RESP-01..09, out of scope for all of v1.5).

Two gameplay-logic bugs raised during discussion are new defects, unrelated to this phase's ActionPanel/Log scope — captured under Deferred Ideas below and formalized as new backlog todo files per explicit user request (not acted on in this phase).

</domain>

<decisions>
## Implementation Decisions

### Border removal scope (PANEL-02)

- **D-01:** "No border framing" applies to **container/frame elements only** — the ActionLog outer `.panel` and the End-Turn confirm-dialog `.confirmCard` lose their `1px solid var(--color-border)` border. **Individual ActionPanel buttons keep their border** (`.ctaButton`'s `var(--color-border-muted)`, `.backButton`'s `var(--color-border)`) — buttons are interactive controls, not framing, and are explicitly exempt from PANEL-02's "no border" requirement.

### End Turn / action-button color-state consistency (PANEL-03)

- **D-02:** Unify the orange→green dynamic color-state logic (`ctaButtonClass(remaining)`, currently only used by MOVE and HEADER) across **every** phase panel that tracks an "eligible remaining" count: `HIGH_PASS_MOVE`, `FIRST_TIME_PASS_MOVE`, `SNAPSHOT_DEFLECT`, `GK_KICK_MOVE`, `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`, `FREE_KICK_SETUP`. These currently hardcode `styles.ctaButtonReady` (green) on their End Turn button regardless of the phase's own `remaining`-style local (`hpmEligibleRemaining`, `ftpmEligibleRemaining`, `sdEligibleRemaining`, `gkmEligibleRemaining`, free-move `remaining`, free-kick `remaining`) — replace each hardcoded `ctaButtonReady` with `ctaButtonClass(remaining)` using that phase's own remaining-count variable, mirroring the MOVE phase's existing pattern exactly.

### Goalkeeper terminology (PANEL-04)

- **D-03:** Standardize on **"Keeper"** as the canonical user-facing term across ActionPanel and ActionLog. Concretely:
  - `ActionPanel.tsx` line ~512: `'Goalie Restart!'` → `'Keeper Restart!'`
  - `ActionPanel.tsx` `ACTION_SUMMARY` tooltips (lines ~34-35): `'Goalkeeper clears with a long kick.'` and `'Goalkeeper throws the ball back into play.'` → reworded to use "Keeper" (e.g. "Keeper clears with a long kick.")
  - `ActionLog.tsx`'s inline `<P pieceId={event.gkId} prefix="GK" />` label (used in `GK_KICK` formatting) — the `prefix="GK"` becomes `prefix="K"` (or equivalent short form) for consistency with the Keeper term; exact abbreviation is Claude's discretion as long as it reads as "Keeper," not "Goalie" or the bare initials "GK," anywhere user-facing text appears in these two components.
  - `[KEEPER KICK RESULT]` / `[KEEPER KICK RESPONSE MOVE]` log prefixes already say "KEEPER" — no change needed there, they're already aligned with the decision.
  - **Scope guard:** this term standardization applies only within `ActionPanel.tsx`/`ActionLog.tsx` (PANEL-04's stated scope). Other components (e.g. `PlayerStatsPanel`) that may use "GK" elsewhere are out of scope for this phase.

### Log entry glyph consistency (PANEL-04)

- **D-04:** Formalize the existing mostly-followed pattern: every event type with a genuine binary success/fail outcome gets a `✓`/`✗` glyph in its log prefix (already true for PASS, HIGH PASS, LONG BALL, SHOT, TACKLE, HEADER, DEFLECT, INTERCEPT, HANDLING-adjacent SHOT variants). Structural/informational events with no pass-fail result stay glyph-free (KICK OFF, DICE, SETUP/KICK_OFF_SETUP, FK/FK_KICKER_CHOSEN/FK_STAGE_ADVANCE, SNAP_DEFLECT_MOVE, HP_REPOSITION/FTP_REPOSITION, SLOT_ADVANCE, HALF_TIME/FULL_TIME, MOVE, HP_MOVE/FTP_MOVE, GK_KICK_MOVE, GOAL). During implementation, audit every `formatEvent` case in `ActionLog.tsx` against this rule and correct any prefix that doesn't already match (e.g. confirm `GK_KICK`'s `[KEEPER KICK TARGET ✓/✗]` is the only GK_KICK-family entry needing the glyph, since it has a real accurate/inaccurate outcome, while `GK_KICK_MOVE`'s reposition-only entries correctly stay glyph-free).

### Claude's Discretion

- Exact abbreviation used for the inline Keeper player-label prefix (D-03) — e.g. "K" vs. "Kpr" — as long as it isn't "GK" or "Goalie".
- Any `formatEvent` case not explicitly enumerated in D-04 that turns out to have a genuine binary outcome not currently glyphed, or vice versa — apply the same "glyph iff binary success/fail" rule found during implementation audit.
- Whether button-background contrast alone (without a border) is sufficient visual affordance on the ActionLog panel/confirm-dialog backgrounds — if a subtle box-shadow or background-color differentiation is needed instead of a border to keep the container visually distinct from the page, that's an implementation-detail judgment call consistent with D-01's "no border" constraint.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project/milestone context

- `.planning/PROJECT.md` — v1.5 milestone goal, current-state tech debt list
- `.planning/REQUIREMENTS.md` (lines 267-272) — PANEL-01 through PANEL-04 requirement definitions
- `.planning/ROADMAP.md` (lines 223-236) — Phase 35 goal, 4 success criteria, dependency on Phase 34
- `.planning/phases/34-visual-theme-restyle/34-CONTEXT.md` — prior-phase decisions; confirms the charcoal/graphite chrome token layer and `--team-accent` derivation are already final and this phase does not touch palette values
- `.planning/phases/33-design-tokens-highlight-standardization/33-CONTEXT.md` — confirms the token-file architecture (`packages/client/src/styles/tokens.css`) this phase's border/color-state changes must use (no new hardcoded literals)

### Existing code (ActionPanel)

- `packages/client/src/components/ActionPanel.tsx` — all phase-gated panel blocks; `ctaButtonClass()` (line ~47) is the existing color-state selector to extend everywhere per D-02; `ACTION_SUMMARY` (line ~26) and the `'Goalie Restart!'` string (line ~512) are the D-03 terminology targets
- `packages/client/src/components/ActionPanel.module.css` — `.ctaButton` (border line 26), `.backButton` (border line 58), `.confirmCard` (border line 128) — the three border declarations relevant to D-01
- `packages/client/src/components/ActionPanel.test.tsx` — existing test coverage to extend for the unified color-state logic (D-02)

### Existing code (ActionLog)

- `packages/client/src/components/ActionLog.tsx` — `formatEvent()` switch (line ~296) is the single place to audit for D-04's glyph rule; the inline `<P pieceId={event.gkId} prefix="GK" />` usage (in the `GK_KICK` case, ~line 734) is the D-03 target
- `packages/client/src/components/ActionLog.module.css` — `.panel` (border line 3) is the D-01 target
- `packages/client/src/components/ActionLog.test.tsx` — existing test coverage to extend for D-03/D-04 changes

No other external specs/ADRs apply beyond the above — requirements are fully captured in the Decisions section.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `ctaButtonClass(eligibleRemaining)` in `ActionPanel.tsx` (line ~47) — the existing single-source color-state selector; D-02 is purely a matter of calling it with each phase's already-computed remaining-count local instead of hardcoding `ctaButtonReady`.
- `styles.ctaButtonReady` / `styles.ctaButtonPending` CSS classes already exist and are token-driven (`--color-cta-ready-bg` / `--color-cta-pending-bg`) — no new tokens needed for D-02.

### Established Patterns

- Every phase panel already follows a consistent two-line `helperBlock` (title + detail) structure — PANEL-01 largely already holds; the one notable exception is the PASS/KICK_OFF "Choose Action" step and the "click a target hex" step, which use a bare `.phaseLabel` span instead of the two-line pattern. Not raised as a discussion area by the user this session, but planner should note the inconsistency exists.
- Every phase-gated block in `ActionPanel.tsx` follows a `waitingPanel` early-return pattern for the non-active player — no changes needed here, already consistent.
- All chrome colors in both components already reference CSS custom properties (`var(--color-*)`, `var(--team-accent)`) per Phase 33's token migration — border removal (D-01) and color-state unification (D-02) are property/logic changes only, not new token additions.

### Integration Points

- `packages/client/src/components/ActionPanel.tsx` — every phase-gated `return (...)` block with a hardcoded `ctaButtonReady` End Turn button is a D-02 edit site (7 phases: HIGH_PASS_MOVE, FIRST_TIME_PASS_MOVE, SNAPSHOT_DEFLECT, GK_KICK_MOVE, FREE_MOVE_ATTACK/DEFENSE — shared block, FREE_KICK_SETUP).
- `packages/client/src/components/ActionLog.tsx` — `formatEvent()`'s per-case `prefix` strings are the D-04 audit/edit sites.

</code_context>

<specifics>
## Specific Ideas

- "Keeper" was explicitly chosen over "GK" and "Goalkeeper" as the single canonical term (D-03).
- Border removal explicitly scoped to containers, not buttons (D-01) — user's own distinction between "framing" and "interactive controls."

</specifics>

<deferred>
## Deferred Ideas

- **Loose-ball pathing on a blocked shot should path from the blocking square, not the shooting square** — a gameplay-logic bug in `computeShotPathDeflection`/`computeLooseBall` (`packages/server/src/gameEngine.ts`), unrelated to ActionPanel/Log formatting. Formalized as a new backlog todo per explicit user request this session: `.planning/todos/pending/loose-ball-pathing-blocked-shot-wrong-origin.md`.
- **Undo should not be allowed to progress earlier than a dice-roll-triggering action (tackle/steal) within a move** — an undo-boundary/state-management bug in `ActionPanel.tsx`'s `canUndo` scan and the server's `applyUndo` guard, unrelated to ActionPanel/Log formatting. Formalized as a new backlog todo per explicit user request this session: `.planning/todos/pending/undo-boundary-should-stop-at-dice-roll-trigger.md`.

### Reviewed Todos (not folded)

- **`2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`** (BUG-23) — matched Phase 35 by generic keyword overlap only (score 0.6); reviewed again, user explicitly chose to leave it alone. It's a highlight-rendering defect, not an ActionPanel/Log formatting defect, and already out-of-scope per REQUIREMENTS.md.
- **`csv-consolidation-player-pool.md`** — matched by generic keyword overlap only (score 0.6); reviewed again, user explicitly chose to leave it alone. A data-pipeline idea unrelated to ActionPanel/Log formatting.

</deferred>

---

_Phase: 35-ActionPanel & Log Standardization_
_Context gathered: 2026-07-27_
