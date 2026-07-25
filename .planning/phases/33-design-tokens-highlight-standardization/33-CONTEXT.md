# Phase 33: Design Tokens & Highlight Standardization - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A single CSS custom-property design-token layer (chrome colors + one `--team-accent` variable) and a complete, single-source-of-truth highlight/ring color table (~13-14 highlight types, all `HexGrid.tsx` inline literals migrated to it) replace all ad-hoc color literals (THEME-03, HILITE-01..05). This phase does NOT change the deep-blue theme's actual look (that's Phase 34 — tokens are populated with today's existing blue-theme values so Phase 34 is a pure value swap). It does NOT touch ActionPanel/ActionLog visual standardization (Phase 35) and does NOT touch response-move activation logic (RESP-01..09, out of scope for all of v1.5).

Two items raised during discussion are new capabilities, not part of this phase's design-token/highlight scope — captured under Deferred Ideas below, not acted on: a back button on the create-game screen, and duplicate-player prevention in draft packs.

</domain>

<decisions>
## Implementation Decisions

### HILITE-01/02/03 — Highlight color semantics

- **D-01:** Adopt a traffic-light semantic system: **green** = safe/valid move, **yellow/amber** = caution/risk, **red** = danger/rule-violation ONLY (offside, illegal — the sole red meaning app-wide per success criterion #3), **blue** = neutral info (kickoff zone, ball-related neutral state), and a **distinct non-red color** (e.g. purple or cyan — planner/implementer's judgment during actual swatch selection) for shot-opportunity/goal-target so it is never confused with red-danger.
- **D-02:** This reassigns the current `goal` highlight (currently red `rgba(220,50,50,1)`) off red entirely — freeing red exclusively for the offside ring (`#dc2626` in `PieceOverlay.tsx`), satisfying success criterion #3.
- **D-03:** The full ~13-14 type mapping (existing 7 in `HexCell.tsx`'s `HIGHLIGHT_STYLES` plus new: GK-kick-target, pass-target, tackle-risk, ball-position, and any other gaps found during implementation) must be written up as a single reference document per ROADMAP success criterion #2 — exact list of all 13-14 to be finalized during planning/research by auditing every inline highlight-color literal in `HexGrid.tsx`.

### Selected-piece ring vs. already-moved-this-stage ring (success criterion #4)

- **D-04:** "Selected/active" ring stays **green** (`#22c55e`, matches the new safe=green semantic) — no change.
- **D-05:** "Already-moved-this-stage" ring (currently identical green, in `PieceOverlay.tsx` — the free-kick "moved this stage" marker) becomes: a **dark grey ring outline** plus a **light grey semi-transparent overlay circle** drawn over the rest of the piece, producing a visually "dimmed/used-up" look distinct from the bright green active-selection ring. Exact grey tones (dark ring / light overlay opacity) are Claude's discretion during implementation — aim for a look that reads as "spent/greyed out," not alarming.
- **Fallback noted but not needed unless the grey treatment proves unworkable:** user's fallback was to keep the existing orange circle + red X ("activated" state in `PieceOverlay.tsx`) with only minor color-tone adjustment at Claude's discretion. Only use this fallback if the grey-ring approach turns out visually indistinguishable from other states or technically awkward — default to D-05.

### Token file structure & scope (Success Criterion #1)

- **D-06:** Create the CSS custom-property token file now (root token file defining all chrome colors + the single `--team-accent` variable derived from `TEAM_CONFIGS.palette.uiColor`), and migrate every hardcoded chrome color literal in components/CSS Modules to reference tokens — but the token **values** stay identical to today's existing deep-blue theme. Phase 34 then does a pure token-value swap to the charcoal/graphite palette with zero literal-hunting required.
- **D-07:** This phase's token migration scope is chrome colors specifically (backgrounds, borders, text colors, the accent variable) — separate from the highlight/ring color table (D-01..05 above), which is its own lookup table, not folded into the same CSS custom-property file unless implementation finds a clean reason to unify them.

### Ball-location marker (Success Criterion #5)

- **D-08:** Implement as a **white hex-edge highlight** — outline the edge of the ball's hex in white, using the **same stroke thickness as the existing player-state ring indicators** in `PieceOverlay.tsx` (selected/active/activated/offside rings) for visual consistency. This replaces the "dot/icon/pulse" marker concepts initially proposed — user's explicit preference is a hex-edge outline, not a piece-level marker.
- **D-09:** Must render always-on-top during response phases (headers, kicks) per the requirement — layering order relative to existing highlight overlays and piece rings to be resolved during implementation (likely: render after/above the standard `HIGHLIGHT_STYLES` overlay in `HexCell.tsx`, same z-order tier as piece rings).

### Test migration (Success Criterion #5, second half)

- All pre-existing color-literal test assertions (e.g. in `HexGrid.test.tsx`) must be migrated to assert token/semantic identity (e.g. asserting `highlightType === 'risk'` or a token name) instead of literal color strings (e.g. `'rgba(255,140,0,1)'`) — this must happen for every test that currently hardcodes a color literal, ahead of/alongside the Phase 34 palette value change, per ROADMAP wording ("existing color-literal tests migrated to token/semantic identity ahead of any palette value changes").

### Claude's Discretion

- Exact hex/rgba values for the new shot-opportunity/goal-target color (must not be red).
- Exact grey tones for the "already-moved-this-stage" ring + overlay circle (D-05).
- Full enumeration of all ~13-14 highlight types and the format/location of the single reference document (D-03) — likely a new `.md` doc or a co-located comment block, decided during planning.
- Whether chrome tokens and highlight/ring colors end up in one combined token file or two related files (D-07) — implementation-detail judgment call.
- Exact z-order/layering mechanism for the ball-location hex-edge highlight (D-09).

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project/milestone context

- `.planning/PROJECT.md` — v1.5 milestone goal, current-state tech debt list
- `.planning/REQUIREMENTS.md` — THEME-03, HILITE-01..05 requirement definitions
- `.planning/ROADMAP.md` (lines 178-191) — Phase 33 goal, 5 success criteria, dependency on Phase 32
- `.planning/phases/32-code-cleanup/32-CONTEXT.md` — prior-phase decisions (confirms this phase does NOT touch visual/color values beyond what's specified here; confirms the pre-existing `2026-07-02` KICK_OFF_SETUP shot-path-hex-shading bug was deferred to Phase 33/34 — worth checking during implementation whether it's now in scope as a highlight-standardization side effect)

### Existing code (highlight/ring system)

- `packages/client/src/components/HexCell.tsx` — current `HexHighlightType` union (7 types) and `HIGHLIGHT_STYLES` lookup table; this is the primary file to extend/replace
- `packages/client/src/components/HexGrid.tsx` (lines ~420-650) — `highlightType` derivation logic and remaining ad-hoc inline color literals (`#f5c518` appears 4x) that must be migrated into the token/highlight system
- `packages/client/src/components/PieceOverlay.tsx` (lines ~40-240) — all piece-ring rendering: selectable (blue `#60a5fa`), active (green `#22c55e`), activated (orange `#f97316` + red X), offside (red `#dc2626`), free-kick "moved this stage" (currently green `#22c55e`, duplicate of active — this is D-05's target)
- `packages/client/src/components/HexGrid.test.tsx`, `HexCell.test.tsx` — existing color-literal test assertions to migrate per the test-migration decision above

No other external specs/ADRs apply beyond the above — requirements are fully captured in the Decisions section.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `HIGHLIGHT_STYLES` in `HexCell.tsx` — existing lookup-table pattern (fill/restOpacity/hoverOpacity/stroke/strokeWidth per type) is the established shape to extend to ~13-14 types; do not redesign the pattern, extend it.
- `PieceOverlay.tsx`'s ring-rendering blocks — each ring (selectable/active/activated/offside/moved-this-stage) already follows a consistent `<circle>` structure; the grey-ring treatment (D-05) should follow this same structural pattern.

### Established Patterns

- `TEAM_CONFIGS[...].palette.uiColor` is the existing single source of truth for team accent colors (Phase 15/18/32 decisions); the new `--team-accent` CSS variable (D-06) derives from this same source — it does not replace `TEAM_CONFIGS`, it exposes it as a CSS custom property for chrome styling.
- No CSS custom-property tokens exist anywhere in the codebase today (confirmed via scout — zero matches for `--team-accent`, `:root`, or `--color-` across `packages/client/src`). This phase is greenfield for the token layer.

### Integration Points

- `packages/client/src/components/HexCell.tsx` — `HexHighlightType` union + `HIGHLIGHT_STYLES` table: primary extension point for all highlight color work.
- `packages/client/src/components/HexGrid.tsx` — highlight-type derivation logic + the 4 remaining `#f5c518` inline literals to migrate.
- `packages/client/src/components/PieceOverlay.tsx` — all ring rendering; D-04/D-05 changes land here; ball-location marker (D-08/D-09) likely also renders from or near here.
- New: a root-level (or `packages/client/src/styles/`) CSS custom-property token file — location TBD during planning, doesn't exist yet.
- `packages/client/src/components/HexGrid.test.tsx`, `HexCell.test.tsx` — test-assertion migration target.

</code_context>

<specifics>
## Specific Ideas

- "Traffic-light semantic system" — green=safe, yellow/amber=caution, red=danger-only, blue=neutral-info, distinct non-red for shot-opportunity.
- Already-moved-this-stage ring: "dark grey outline and then a light grey opaque circle over the rest of the piece" — user's own words, exact tones at Claude's discretion.
- Ball-location marker: "highlight the edge of the hex white — the same thickness as the player state indicators" — user's own words; explicitly a hex-edge treatment, not a dot/icon/pulse.

</specifics>

<deferred>
## Deferred Ideas

- **Back button on create-game screen** — raised during discussion; a new UI capability, not a design-token/highlight-color change. Not part of Phase 33 scope. Recommend logging as a backlog bug/UX item for a future phase or quick-task.
- **Duplicate-player prevention in draft packs** — raised during discussion; a draft-engine correctness fix (Phase 27-30 territory), unrelated to visual tokens. Not part of Phase 33 scope. Recommend logging as a backlog bug for a future phase or quick-task.

### Reviewed Todos (not folded)

None reviewed via `cross_reference_todos` beyond what Phase 31/32 already covered (the `2026-07-02` KICK_OFF_SETUP shot-path-shading bug remains earmarked for Phase 33/34 per `31-CONTEXT.md`/`32-CONTEXT.md` — implementer should check during Phase 33/34 whether the highlight-standardization work incidentally resolves it).

</deferred>

---

_Phase: 33-Design Tokens & Highlight Standardization_
_Context gathered: 2026-07-25_
