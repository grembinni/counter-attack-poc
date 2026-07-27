# Phase 35: ActionPanel & Log Standardization - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

**Revised scope (expanded after a same-space audit — see D-05 below):** "ActionPanel and ActionLog" in the ROADMAP goal is the _functional slot_, not just the two literally-named components. `packages/client/src/components/GameBoard.tsx` reveals that `ActionPanel` shares its top-band right-hand slot with three phase-conditional siblings — `KickOffSetupPanel`, `FreeKickSetupPanel`, `ReplayPanel` (each its own file + `.module.css`) — and `ActionLog` is wrapped by a collapsible `SideLog` component with its own header. All of PANEL-01..04 ("one consistent visual and language system... across every game phase") apply to this full set of components, not just the two headline-named files. This phase does NOT touch chrome design tokens or the charcoal/graphite palette itself (already delivered in Phase 33/34 — this phase only changes values/properties _within_ the existing token system, e.g. removing a `border` declaration or swapping which token drives a button's background). It does NOT touch hex-highlight/piece-ring colors (Phase 33, HILITE-01..05) and does NOT touch response-move activation logic (RESP-01..09, out of scope for all of v1.5).

Two gameplay-logic bugs raised during discussion are new defects, unrelated to this phase's ActionPanel/Log scope — captured under Deferred Ideas below and formalized as new backlog todo files per explicit user request (not acted on in this phase).

</domain>

<decisions>
## Implementation Decisions

### Same-space component audit (all of PANEL-01..04 — scope-defining)

- **D-05:** All decisions below apply not just to `ActionPanel.tsx`/`ActionLog.tsx` but to the full set of components that share their render slot: `KickOffSetupPanel.tsx`, `FreeKickSetupPanel.tsx`, `ReplayPanel.tsx` (siblings of `ActionPanel` in `GameBoard.tsx`'s `topBandRight`), and `SideLog` (the `GameBoard.tsx`-local wrapper around `ActionLog`). Discovered via a full same-space render audit requested mid-discussion — see Specifics for the concrete violations found.
- **D-06 (corrects/supersedes part of the original D-02 below):** `ActionPanel.tsx`'s own `FREE_KICK_SETUP` phase-gated block (~line 652-718) is dead code — `GameBoard.tsx`'s `topBandRight` always renders the separate `FreeKickSetupPanel` component for `phase === 'FREE_KICK_SETUP'`, so `ActionPanel`'s branch can never be reached in production. Planner must verify this (confirm no other render path reaches it) and then **delete `ActionPanel`'s `FREE_KICK_SETUP` block entirely** rather than "fixing" its color logic per the original D-02 wording. `FreeKickSetupPanel.tsx` has its own separate, already-mostly-correct pending/ready color logic (`endTurnColorClass`, line ~170) — **extract a single shared helper** (e.g. move `ctaButtonClass`-equivalent logic to a shared hook/util) that both `ActionPanel` and `FreeKickSetupPanel` call, so PANEL-03's "single color-state logic" requirement is genuinely satisfied across both components, not reimplemented twice.

### Border removal scope (PANEL-02)

- **D-01:** "No border framing" applies to **container/frame elements only**, across every panel in the D-05 set — buttons keep their border everywhere (interactive controls, not framing; explicitly exempt). Concretely, remove `border: 1px solid var(--color-border)` from:
  - `ActionLog.module.css` `.panel`
  - `ActionPanel.module.css` `.confirmCard`
  - `ReplayPanel.module.css` `.panel` (same 1px border — found during the same-space audit)
  - `FreeKickSetupPanel.module.css` `.confirmCard` (a near-identical clone of ActionPanel's confirm dialog — found during the same-space audit)
  - `GameBoard.module.css` `.sideLogExpanded`'s `border-right: 1px solid var(--color-border)` (the `SideLog` wrapper around `ActionLog` — found during the same-space audit)
  - `KickOffSetupPanel.module.css`'s `.panel` and `FreeKickSetupPanel.module.css`'s `.panel` already have **no** border — already compliant, no change needed there, but confirms the target end-state for the others.

### End Turn / action-button color-state consistency (PANEL-03)

- **D-02 (see D-06 correction above for FREE_KICK_SETUP specifically):** Unify the orange→green dynamic color-state logic (`ctaButtonClass(remaining)`, currently only used by MOVE and HEADER in `ActionPanel.tsx`) across every phase panel that tracks an "eligible remaining" count: `HIGH_PASS_MOVE`, `FIRST_TIME_PASS_MOVE`, `SNAPSHOT_DEFLECT`, `GK_KICK_MOVE`, `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE` (all in `ActionPanel.tsx`). These currently hardcode `styles.ctaButtonReady` (green) on their End Turn button regardless of the phase's own `remaining`-style local (`hpmEligibleRemaining`, `ftpmEligibleRemaining`, `sdEligibleRemaining`, `gkmEligibleRemaining`, free-move `remaining`) — replace each hardcoded `ctaButtonReady` with `ctaButtonClass(remaining)` using that phase's own remaining-count variable, mirroring the MOVE phase's existing pattern exactly. `FREE_KICK_SETUP`'s equivalent fix happens in `FreeKickSetupPanel.tsx` via the shared helper from D-06, not in `ActionPanel.tsx`. `KickOffSetupPanel`'s "Ready"/"Confirm" button has no meaningful partial-progress state to color (it's a single boolean gate, not a multi-slot countdown) — no color-state change needed there.

### Panel heading consistency (PANEL-01)

- **D-07:** `ActionPanel` currently shows no heading/title span at all in any phase, while `KickOffSetupPanel` ("Kick-Off Setup"), `FreeKickSetupPanel` ("Offside — Free Kick"), and `ReplayPanel` ("Replay") each show one. Add a heading to `ActionPanel` so all four panels sharing the slot present the same structural pattern. Exact heading text/derivation (e.g. a phase-derived label, or a static "Actions" label) is Claude's discretion during planning — should read naturally regardless of which of the ~15 phase-gated blocks is showing.

### Confirm/Ready button verb (PANEL-04)

- **D-08:** Unify the confirm-and-advance button label to **"Confirm"** across `KickOffSetupPanel` (currently "Ready"), `FreeKickSetupPanel` (currently "End Turn"), and `ActionPanel` (currently "End Turn"). "Confirm" was chosen specifically because it reads correctly both for confirming an initial placement (no turn active yet, kick-off setup) and for confirming the end of an active turn — neither "Ready" nor "End Turn" covers both contexts naturally.

### Waiting-state phrasing (PANEL-01/04)

- **D-09:** Where the waiting player's context is known (which team/what they're doing), use `FreeKickSetupPanel`'s existing more-specific pattern — `"{Attacking/Defending} team is repositioning…"` — instead of the generic `"Waiting for opponent…"`. Apply this style to `ActionPanel`'s `waitingPanel` and to `KickOffSetupPanel`'s waiting state (currently generic) wherever the specific context (which team, what action) is available from existing state; fall back to the generic phrasing only where no more-specific text is derivable.

### Match log label (PANEL-04)

- **D-10:** The `SideLog` wrapper's header (`GameBoard.tsx`, "MATCH LOG") and `ActionLog`'s own internal `.panelHeader` ("ACTION LOG") duplicate each other — same content, two labels stacked directly on top of each other. Keep **"MATCH LOG"** (the wrapper's label) and remove `ActionLog`'s own internal `.panelHeader` span entirely.

### Goalkeeper terminology (PANEL-04)

- **D-03:** Standardize on **"Keeper"** as the canonical user-facing term across ActionPanel and ActionLog. Concretely:
  - `ActionPanel.tsx` line ~512: `'Goalie Restart!'` → `'Keeper Restart!'`
  - `ActionPanel.tsx` `ACTION_SUMMARY` tooltips (lines ~34-35): `'Goalkeeper clears with a long kick.'` and `'Goalkeeper throws the ball back into play.'` → reworded to use "Keeper" (e.g. "Keeper clears with a long kick.")
  - `ActionLog.tsx`'s inline `<P pieceId={event.gkId} prefix="GK" />` label (used in `GK_KICK` formatting) — the `prefix="GK"` becomes `prefix="K"` (or equivalent short form) for consistency with the Keeper term; exact abbreviation is Claude's discretion as long as it reads as "Keeper," not "Goalie" or the bare initials "GK," anywhere user-facing text appears in these two components.
  - `[KEEPER KICK RESULT]` / `[KEEPER KICK RESPONSE MOVE]` log prefixes already say "KEEPER" — no change needed there, they're already aligned with the decision.
  - **Scope guard:** this term standardization applies only within `ActionPanel.tsx`/`ActionLog.tsx` (PANEL-04's stated scope). Other components (e.g. `PlayerStatsPanel`) that may use "GK" elsewhere are out of scope for this phase.

### Log entry glyph consistency (PANEL-04)

- **D-04:** Formalize the existing mostly-followed pattern: every event type with a genuine binary success/fail outcome gets a `✓`/`✗` glyph in its log prefix (already true for PASS, HIGH PASS, LONG BALL, SHOT, TACKLE, HEADER, DEFLECT, INTERCEPT, HANDLING-adjacent SHOT variants). Structural/informational events with no pass-fail result stay glyph-free (KICK OFF, DICE, SETUP/KICK_OFF_SETUP, FK/FK_KICKER_CHOSEN/FK_STAGE_ADVANCE, SNAP_DEFLECT_MOVE, HP_REPOSITION/FTP_REPOSITION, SLOT_ADVANCE, HALF_TIME/FULL_TIME, MOVE, HP_MOVE/FTP_MOVE, GK_KICK_MOVE, GOAL). During implementation, audit every `formatEvent` case in `ActionLog.tsx` against this rule and correct any prefix that doesn't already match (e.g. confirm `GK_KICK`'s `[KEEPER KICK TARGET ✓/✗]` is the only GK_KICK-family entry needing the glyph, since it has a real accurate/inaccurate outcome, while `GK_KICK_MOVE`'s reposition-only entries correctly stay glyph-free).

### Log casing and arrow-glyph consistency (PANEL-04, player-friendly language)

- **D-11:** Standardize all `formatEvent` outcome narration to **sentence case** — drop ALL-CAPS emphasis words like `SCORED!`, `ATTACKER WINS`/`DEFENDER WINS`, `ACCURATE`/`CONTESTING HEADER`, and the raw interpolated `event.result` enum values (`SUCCESS`/`FAILURE`) that currently render in caps (e.g. `STEAL_ATTEMPT`'s `{event.result} -> `). This includes the `HP_ACCURACY` case specifically, which currently has one ALL-CAPS branch (`'ACCURATE -> CONTESTING HEADER'`) and one sentence-case branch (`'Inaccurate — loose ball'`) for the same event type. Audit every `formatEvent` case for ALL-CAPS narration text (not bracketed `[PREFIX]` tags, which stay as-is) and convert to sentence case.
- **D-12:** Standardize the arrow glyph to the **unicode `→`** everywhere a directional/result arrow appears in log content — replace the ASCII `-> ` currently used in `STEAL_ATTEMPT`, `TACKLE_ATTEMPT`, and `SHOT_ATTEMPT`'s narration (e.g. `{event.result} {'-> '}`) with `→`, matching the unicode arrow already used by `MOVE`/`STANDARD_PASS`/`LOOSE_BALL_LAND`/etc.'s hex-coordinate paths.
- **D-13 (explicitly confirmed, no change):** Raw axial hex coordinates (e.g. `23,3 → 22,4`) shown in move/pass/kick log entries stay as-is. This is intentional board-game transparency for an audience already thinking in board coordinates, not a UX defect — do not replace with human-readable zone/direction language.

### Claude's Discretion

- Exact abbreviation used for the inline Keeper player-label prefix (D-03) — e.g. "K" vs. "Kpr" — as long as it isn't "GK" or "Goalie".
- Any `formatEvent` case not explicitly enumerated in D-04/D-11/D-12 that turns out to need a glyph, casing, or arrow-glyph correction under these rules — apply the same rule found during implementation audit.
- Whether button-background contrast alone (without a border) is sufficient visual affordance on the container backgrounds affected by D-01 — if a subtle box-shadow or background-color differentiation is needed instead of a border to keep a container visually distinct from the page, that's an implementation-detail judgment call consistent with D-01's "no border" constraint.
- Exact heading text/derivation for `ActionPanel` (D-07).
- Exact shape of the shared color-state helper extracted in D-06 (hook vs. plain function vs. relocated module) — implementation-detail judgment call, as long as both `ActionPanel` and `FreeKickSetupPanel` end up calling the same single implementation.
- Exact wording of `KickOffSetupPanel`'s waiting-state text once made more specific per D-09 (it currently has no waiting-team distinction to draw on beyond "opponent" — attacking/defending framing may not directly apply the same way it does in `FreeKickSetupPanel`).

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

- `packages/client/src/components/ActionPanel.tsx` — all phase-gated panel blocks; `ctaButtonClass()` (line ~47) is the existing color-state selector to extend everywhere per D-02, and to relocate into the D-06 shared helper; `ACTION_SUMMARY` (line ~26) and the `'Goalie Restart!'` string (line ~512) are the D-03 terminology targets; the `FREE_KICK_SETUP` block (~line 652-718) is the D-06 dead-code deletion target
- `packages/client/src/components/ActionPanel.module.css` — `.ctaButton` (border line 26), `.backButton` (border line 58), `.confirmCard` (border line 128) — `.confirmCard`'s border is a D-01 target; `.ctaButton`/`.backButton` borders are explicitly kept
- `packages/client/src/components/ActionPanel.test.tsx` — existing test coverage to extend for D-02/D-06/D-07/D-08/D-09 changes

### Existing code (ActionLog + SideLog wrapper)

- `packages/client/src/components/ActionLog.tsx` — `formatEvent()` switch (line ~296) is the single place to audit for D-04/D-11/D-12; the inline `<P pieceId={event.gkId} prefix="GK" />` usage (in the `GK_KICK` case, ~line 734) is the D-03 target; the `panelHeader` element (`ACTION LOG`, line ~837) is the D-10 removal target
- `packages/client/src/components/ActionLog.module.css` — `.panel` (border line 3) is a D-01 target
- `packages/client/src/components/ActionLog.test.tsx` — existing test coverage to extend for D-03/D-04/D-10/D-11/D-12 changes
- `packages/client/src/components/GameBoard.tsx` — `SideLog()` function (line ~107-139) wraps `ActionLog`; its `sideLogHeader` `<span>MATCH LOG</span>` (line ~127) is the D-10 label to keep; `topBandRight` (line ~327-337) is where `ActionPanel`/`KickOffSetupPanel`/`FreeKickSetupPanel`/`ReplayPanel` are conditionally selected — confirms D-06's dead-code claim
- `packages/client/src/components/GameBoard.module.css` — `.sideLogExpanded`'s `border-right` (line ~330) is a D-01 target

### Existing code (same-slot siblings — KickOffSetupPanel / FreeKickSetupPanel / ReplayPanel)

- `packages/client/src/components/KickOffSetupPanel.tsx`/`.module.css` — `.panel` has no border already (D-01 compliant); `panelHeading` "Kick-Off Setup" (the D-07 pattern to extend to ActionPanel); `'Ready'` button text (D-08 target, → "Confirm"); generic "Waiting for opponent…" text (D-09 target)
- `packages/client/src/components/FreeKickSetupPanel.tsx`/`.module.css` — `.panel` has no border already (D-01 compliant); `.confirmCard` border (D-01 target); `panelHeading` "Offside — Free Kick" (D-07 pattern); `'End Turn'` button text (D-08 target, → "Confirm"); `endTurnColorClass` (line ~170, the D-06 second implementation to consolidate); `"{Attacking/Defending} team is repositioning…"` waiting text (the D-09 pattern to extend elsewhere)
- `packages/client/src/components/FreeKickSetupPanel.test.tsx` — existing test coverage to extend for D-01/D-06/D-07/D-08 changes
- `packages/client/src/components/ReplayPanel.tsx`/`.module.css` — `.panel` border (D-01 target); `heading` "Replay" (D-07 pattern)

No other external specs/ADRs apply beyond the above — requirements are fully captured in the Decisions section.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `ctaButtonClass(eligibleRemaining)` in `ActionPanel.tsx` (line ~47) — the existing single-source color-state selector; D-02 is purely a matter of calling it with each phase's already-computed remaining-count local instead of hardcoding `ctaButtonReady`.
- `styles.ctaButtonReady` / `styles.ctaButtonPending` CSS classes already exist and are token-driven (`--color-cta-ready-bg` / `--color-cta-pending-bg`) — no new tokens needed for D-02.

### Established Patterns

- Every phase panel already follows a consistent two-line `helperBlock` (title + detail) structure — PANEL-01 largely already holds within `ActionPanel.tsx`; two notable exceptions the planner should also address even though not raised as a standalone discussion area: (1) the PASS/KICK_OFF "Choose Action" step and the "click a target hex" step use a bare `.phaseLabel` span instead of the two-line pattern, and (2) `FREE_MOVE_ATTACK`/`FREE_MOVE_DEFENSE`'s `helperLine1` is a full explanatory sentence rather than a short title, breaking the title+detail split every other phase follows. Both should be brought into the two-line title+detail pattern for genuine PANEL-01 consistency.
- Most title-line text ends in "!" (`Attempt Save!`, `Snapshot!`, `Kick-Off!`, `Move!`, etc.) but `FreeKickSetupPanel`'s kicker-select sub-step heading ("Free Kick") and stage heading ("Free Kick Setup — {stageLabel} Team") do not — planner should apply the same punctuation convention there too.
- Every phase-gated block in `ActionPanel.tsx` follows a `waitingPanel` early-return pattern for the non-active player; `HEADER`'s `myConfirmed` branch duplicates this text inline instead of reusing the constant — a minor DRY cleanup opportunity, not a user-facing inconsistency, safe to fix incidentally while implementing D-09.
- All chrome colors across every component in the D-05 set already reference CSS custom properties (`var(--color-*)`, `var(--team-accent)`) per Phase 33's token migration — border removal (D-01) and color-state unification (D-02/D-06) are property/logic changes only, not new token additions.
- The confirm-dialog copy differs slightly by verb ("...left to move..." in ActionPanel vs "...left to reposition..." in FreeKickSetupPanel) — this variance is fine (matches what's actually happening in each phase), not part of any decision above.

### Integration Points

- `packages/client/src/components/ActionPanel.tsx` — every phase-gated `return (...)` block with a hardcoded `ctaButtonReady` End Turn button is a D-02 edit site (HIGH_PASS_MOVE, FIRST_TIME_PASS_MOVE, SNAPSHOT_DEFLECT, GK_KICK_MOVE, FREE_MOVE_ATTACK/DEFENSE — shared block); the `FREE_KICK_SETUP` block is a D-06 deletion site, not an edit site.
- `packages/client/src/components/ActionLog.tsx` — `formatEvent()`'s per-case `prefix`/content strings are the D-04/D-11/D-12 audit/edit sites; `panelHeader` is the D-10 removal site.
- `packages/client/src/components/KickOffSetupPanel.tsx`, `FreeKickSetupPanel.tsx`, `ReplayPanel.tsx` — each needs D-01 (border) and D-07 (heading, where not already present) treatment; `KickOffSetupPanel`/`FreeKickSetupPanel` additionally need D-08 (button verb) and D-09 (waiting text) treatment.
- `packages/client/src/components/GameBoard.tsx`'s `SideLog()` — D-10 label-collision fix site.

</code_context>

<specifics>
## Specific Ideas

- "Keeper" was explicitly chosen over "GK" and "Goalkeeper" as the single canonical term (D-03).
- Border removal explicitly scoped to containers, not buttons (D-01) — user's own distinction between "framing" and "interactive controls."
- "Confirm" explicitly chosen over "Ready" and "End Turn" as the single canonical confirm-and-advance verb (D-08) because it's the only one of the three that reads naturally in both a pre-turn placement context (kick-off setup) and an active-turn-ending context (movement/free-kick phases).
- Raw axial hex coordinates in log entries (`23,3 → 22,4`) are explicitly _not_ a defect — user confirmed this is intentional board-game transparency for an audience already thinking in board coordinates (D-13).
- The same-space audit (ActionPanel's siblings, ActionLog's SideLog wrapper) was requested directly by the user mid-discussion after the first pass only covered the two headline-named components — see D-05.

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
