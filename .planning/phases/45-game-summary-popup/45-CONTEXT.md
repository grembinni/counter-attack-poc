# Phase 45: Game Summary Popup - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

An (i) icon on the scoreboard opens a match-summary popup at any point during the match, showing a settings/toggle recap (including Referee Leniency) plus live soccer-style stats per team: possession %, completed passes, successful tackles+steals with success %, total shots, accumulated xG (via a fully-specified formula), fouls, yellow cards, and red cards. The same content is also folded into the existing HALF_TIME/FULL_TIME overlay, appended below its current score-row header. All stats are whole-match totals that never reset at half-time, mirroring the existing `subsUsed` persistence pattern.

</domain>

<decisions>
## Implementation Decisions

### xG Formula (STATS-08) — fully specified by the user, verbatim

- **D-01:** Use this exact per-shot xG formula (not a Claude-proposed approximation):

  ```
  xg = 1
     * (1 - (D * 0.13))
     * (1 - (C * 0.10))
     * (1 - (ABS(Y-13) > 3 ? ABS(Y-13) * 0.07 : ABS(Y-13) * 0.04))
     * (1 - (X > 3 ? X * 0.07 : X * 0.04))
  ```

  Where:
  - `D` = number of defenders in the goal box (6-yard box) at the moment of the shot
  - `C` = number of defenders in the penalty box **not including** the goal box (i.e., penalty-box-only defenders)
  - `X` = the shot hex's distance from the near goal line along the q-axis, in hexes (0 = standing on the goal line, growing as the shooter moves away)
  - `Y` = the shot hex's raw axial `r` coordinate (the formula's own `-13` term centers it, since `r=13` is the board's vertical centre row per the kickoff hex `{q:18, r:13}`)
  - Accumulate per-shot xG into a running per-team total (never reset at half-time).

- **D-02:** Coordinate mapping confirmed directly with the user: `X` is a hex-distance-from-goal-line **depth** value (perpendicular to the goal line, using the q-axis), and `Y` is the raw `r` coordinate of the shot hex — NOT an offset already computed by the caller. Downstream implementers must derive both from the shot hex at the moment of each shot-resolution branch (per D-03).
- **D-03:** xG must be captured at **every** shot-resolution branch, per ROADMAP.md Success Criterion 3: standard shot, snapshot/deflection, headed shot, penalty, and GK-dive-at-feet penalty. No single existing shared hook covers all of these today (per STATE.md pitfall) — each branch needs its own instrumentation point.
- **D-04:** Goal-box and penalty-box hex membership (for computing `D` and `C`) must be derived from the same geometric boundaries already used for `PitchMarkings.tsx`'s visual rendering (home/away penalty box and 6-yard box edges) — not a new, separately-defined zone. Planner should translate those existing pixel/hex boundaries into a reusable hex-membership check.

### Possession % (STATS-04)

- **D-05:** Possession is tracked as a **live running accumulator** tied to `attackingTeam`, incremented per action/MOVE tick — mirrors the existing event-driven MM:00 clock mechanism and the `subsUsed` never-reset-at-half-time pattern. Do NOT derive possession retrospectively by scanning `eventLog` on each popup open.
- **D-06:** This same "live accumulator, never reset at half-time" approach applies to all other whole-match stats in this phase (passes, tackles/steals, shots, fouls, cards) — confirmed by ROADMAP.md Success Criterion 4 ("mirroring the existing subsUsed persistence pattern"), not just possession.

### Tackle/Steal Success % and the Phase 43 Decline Mechanic (STATS-06)

- **D-07:** A **declined** tackle/steal (Phase 43's `TACKLE_STEAL_PROMPT` decline) does **NOT** count toward the attempt total used in the success-percentage denominator. This directly matches Phase 43's own rule (TACKLE-02: "declining doesn't count as an attempt"). Only duels that actually rolled dice count as attempts; declined-but-still-live opportunities are invisible to this stat.

### (i) Icon Placement & Access (STATS-01)

- **D-08:** The icon is placed **top-center, directly above the "00:00" clock**, inside `GameBoard.tsx`'s `.scoreboardCentreCell` (as a new small row above the existing `.clockRow`) — reads as a global match-level affordance rather than tied to either team's side of the scoreboard. Note for planner: `.scoreboardCentreCell` is currently a `justify-content: center` column sized to its content (`clockRow` + `phaseSummary`), not a cell with pre-reserved empty space — the new icon row must be added as an actual child element above `clockRow`, not positioned into "already-empty" space.
- **D-09:** The icon is **always clickable**, in every game phase, including mid-duel/prompt interrupt phases (tackle/steal prompt, GK dive-at-feet, foul choice, etc.) — no phase-gating/disabling logic needed. The popup is read-only and cannot conflict with an in-progress action.

### HALF_TIME/FULL_TIME Integration (STATS-02)

- **D-10:** The existing HALF_TIME/FULL_TIME overlay (`GameBoard.tsx` lines ~519+/~575+, the large score-row with team badges/score numerals/"HALF TIME"–"FULL TIME"/clock) **keeps its current header exactly as-is**. The full match-summary content (settings recap + all STATS-04..09 stats, same structure/content/format as the on-demand popup) is **appended below** that existing header, inside the same overlay card. The existing proceed/confirm controls (mutual-confirm kick-off button at half-time, result display at full-time) stay below the appended stats content.
- **D-11:** This means the match-summary content should be built as one reusable component/section (e.g. a `MatchSummaryContent` block) consumed by both: (a) the on-demand modal opened via the (i) icon, and (b) appended inline inside the existing `HALF_TIME`/`FULL_TIME` overlay card. Do not duplicate the stats-rendering logic between the two call sites.

### Settings/Toggle Recap Format (STATS-03)

- **D-12:** Render as an **inline row of parenthetical toggle:state pairs**, e.g. `(Fouls: Off) (Booking: Active) (Injury: Active) (Out-of-Bounds: Active) (Referee Leniency: Manual — 4) (Tackle/Steal Decline: On)` — not a table, not a bulleted list, not a settings-panel-style layout.
- **D-13:** The recap covers the 6 match-rule toggles from Phase 44's Advanced drawer: Fouls, Booking, Injury, Out-of-Bounds/Restarts, Referee Leniency (state + manual value when overridden), Tackle/Steal Decline. Game Speed and team/formation/uniform selections are **not** part of this recap (not requested; treat as out of scope for STATS-03 unless trivial to include without disrupting the inline format).

### Claude's Discretion

- Exact GameState field shapes for the new whole-match counters (possession accumulator, pass/tackle/shot/foul/card counts per team) — mirror the `subsUsed`/sibling-counter pattern (`types.ts:1834`) already established in this codebase; needs a per-site instrumentation audit at planning time (which existing handlers/branches increment which counter).
- Exact visual/CSS treatment of the new (i) icon (size, icon glyph/asset, hover state) within the existing design-token system — no asset specified by the user.
- Popup modal chrome (open/close mechanics, backdrop, dismiss button) — follow existing modal patterns already used elsewhere in the app (e.g. the substitution modal from Phase 42) rather than inventing a new modal pattern.
- Whether the popup content live-updates while open or is a snapshot taken at open time — not discussed; default to live-updating (the store already broadcasts full state snapshots on every action, so a live-bound popup is the natural default and requires no extra work over a static snapshot).
- Exact hex-membership check implementation for goal-box/penalty-box defender counts (D-04) — translate `PitchMarkings.tsx`'s existing pixel-space box boundaries into an axial hex-membership helper.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap

- `.planning/ROADMAP.md` §"Phase 45: Game Summary Popup" (lines 330-343) — goal, dependencies (Phases 42/43/44), success criteria, `UI hint: yes`
- `.planning/REQUIREMENTS.md` §"Game Summary Popup" (lines 51-61) — STATS-01 through STATS-09 exact requirement text
- `.planning/STATE.md` — "Open Questions" Phase 45 entries (icon-hosting component now resolved as D-08; xG formula/architecture now resolved as D-01..D-06); "Key Pitfalls to Avoid" xG multi-branch-instrumentation note (now D-03)

### Prior Phase Context (state this phase reads/depends on)

- `.planning/phases/44-referee-leniency-advanced-settings-drawer/44-CONTEXT.md` — the 6 Advanced-drawer toggles this phase's settings recap (D-12/D-13) must display, including the Referee Leniency manual-override shape
- `.planning/phases/43-tackle-steal-prompt-decline/43-CONTEXT.md` — the decline mechanic and its `stealDeclinedByIds`/`tackleDeclinedByIds` sibling-field shape that D-07's "declines don't count as attempts" rule must respect
- `.planning/phases/42-substitution-ux-overhaul/42-CONTEXT.md` — the `subsUsed` whole-match-counter precedent (D-06/D-11 in this doc) and existing modal-chrome patterns to reuse for the popup

### Existing Code (confirmed via direct read during this discussion)

- `packages/client/src/components/GameBoard.tsx` lines 348-460 (scoreboard/topBand structure) and lines 519+ / 575+ (HALF_TIME/FULL_TIME overlays) — the exact integration points for D-08/D-10
- `packages/client/src/components/GameBoard.module.css` lines 83-92 (`.scoreboardCentreCell`), 250-263 (`.clockRow`) — confirms the cell is content-sized/centered, not pre-reserving empty space (informs D-08's implementation note)
- `packages/client/src/components/PitchMarkings.tsx` lines 150-196 — existing penalty-box/6-yard-box (goal-box) pixel boundary definitions, the source geometry for D-04's hex-membership derivation
- `packages/shared/src/types.ts` line 1834 (`subsUsed?: { home: number; away: number }`) and lines 1839-1840 (its never-reset-at-half-time contract) — the precedent pattern for every new whole-match stat counter (D-05/D-06)
- `packages/shared/src/types.ts` line 1222+ (`GameState` type) — no existing team-level possession/pass/tackle/foul/card counters exist; all are new fields for this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `subsUsed: { home: number; away: number }` (`types.ts:1834`) — the established shape/pattern for a whole-match, never-reset-at-half-time counter; every new stat counter in this phase should follow this exact shape.
- `PitchMarkings.tsx`'s penalty-box/6-yard-box pixel boundaries (lines 150-196) — reuse this existing geometry (translated to hex membership) rather than re-deriving zone boundaries from scratch.
- Phase 42's substitution modal chrome (`GameBoard.tsx`'s `subOpen`/`.substitutionOverlay`/`.substitutionModalCard` pattern) — the nearest existing modal-open/close precedent for the on-demand popup's chrome.
- `GameBoard.tsx`'s existing HALF_TIME/FULL_TIME overlay cards (`.overlay`/`.overlayCard`, lines 519+/575+) — the container the new stats content appends into (D-10), keeping the existing score-row header untouched.

### Established Patterns

- Whole-match vs. per-half counter distinction (`subsUsed` vs. `addedTimeBonus`, `types.ts:1839-1840`) — this phase's counters are unambiguously the `subsUsed` (whole-match, never-reset) category, not the per-half category.
- No single shared hook exists across all shot-resolution branches (STATE.md pitfall, confirmed again here) — xG capture (D-03) needs per-branch instrumentation, budgeted for at planning time.
- `HIGHLIGHT_STYLES`/box-boundary geometry lives in rendering components (`PitchMarkings.tsx`), not in a shared zone-definition module — this phase introduces the first hex-membership check derived from that geometry; consider whether it belongs in `packages/shared` (consumed by both server-side xG computation and any client-side rendering needs) per the project's established server-authoritative pattern.

### Integration Points

- New whole-match counters need to be threaded through the same `buildInitialGameState` → per-action-handler → `broadcastState` pipeline every other GameState field uses; server-authoritative, computed in `packages/server/src/gameEngine.ts`/`gameHandlers.ts`, not client-derived.
- The (i) icon and its popup are pure client-side UI reading already-broadcast GameState fields — no new socket event needed beyond whatever normal state broadcast already carries the new counters.
- The `MatchSummaryContent` shared block (D-11) needs to be consumed both by a new standalone modal component and by an addition inside `GameBoard.tsx`'s existing HALF_TIME/FULL_TIME JSX — plan for one component, two call sites.

</code_context>

<specifics>
## Specific Ideas

- The user gave the xG formula as an exact algebraic expression (D-01) — treat this as a hard requirement, not a starting point to refine. Do not substitute a different weighting scheme.
- Settings recap format example given verbatim: `(fouls: off) (bookings: active)` — inline parenthetical pairs (D-12).
- **UI design note for the downstream UI phase:** the user will provide 3 reference images during UI design (`/gsd-ui-phase`) to influence the popup's visual design. This is not resolved now — flag it for whoever runs the UI-spec step for this phase so they ask for/incorporate those images rather than guessing at layout from scratch.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

### Reviewed Todos (not folded)

- `2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` — weak keyword-only match (score 0.6); a `KICK_OFF_SETUP` rendering bug unrelated to the match-summary popup. Not folded; remains tagged to Phase 46 (Final Cleanup).
- `2026-08-09-bug-offside-ring-after-goal.md` — weak keyword-only match (score 0.6); an offside-ring rendering bug unrelated to the match-summary popup. Not folded; remains tagged to Phase 46 (Final Cleanup).
- `2026-08-23-ux-no-auto-reselect-after-interrupt-prompt-resumes.md` — weak keyword-only match (score 0.6); a piece-reselection UX gap after interrupt prompts, unrelated to the match-summary popup. Not folded; already explicitly scoped to Phase 46 (`resolves_phase: 46`).

</deferred>

---

*Phase: 45-Game Summary Popup*
*Context gathered: 2026-08-28*
