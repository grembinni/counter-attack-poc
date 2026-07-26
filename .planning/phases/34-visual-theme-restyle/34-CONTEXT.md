# Phase 34: Visual Theme Restyle - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

The deep-blue chrome theme (`packages/client/src/styles/tokens.css`, frozen at today's values by Phase 33) is swapped app-wide to a broadcast-sports charcoal/graphite base with crisp white text and a single WCAG-AA-safe team-color accent, across the lobby, settings, team/draft selection, and in-game board (THEME-01, THEME-02, THEME-04). This is a **pure token-value swap** — Phase 33 already migrated every chrome-color CSS Module to reference `var(--token)`; this phase changes the values in `tokens.css` and adds the automated stylelint + WCAG contrast-check gates from ROADMAP success criteria #2/#3. It does NOT touch the hex-highlight/piece-ring color system (`HexCell.tsx`/`PieceOverlay.tsx`, already standardized in Phase 33 — HILITE-01..05) and does NOT touch ActionPanel/ActionLog visual standardization (Phase 35) or response-move activation logic (RESP-01..09, out of scope for all of v1.5).

Two bug reports raised during discussion are new defects, not part of this phase's chrome-theme scope — captured under Deferred Ideas below, not acted on: loose-ball pathing on a blocked shot, and an undo-boundary gap around dice-roll-triggering actions (tackle/steal).

</domain>

<decisions>
## Implementation Decisions

### Palette reference & tones

- **D-01:** No specific real-world broadcast-sports reference was provided — Claude has full discretion to select exact charcoal/graphite tones. Aim for a neutral, true-charcoal broadcast look (e.g. modern ESPN dark mode, FIFA/EA Sports overlay style) with **no blue tint carried over** from the old `#1a1a2e`/`#16213e`/`#0f3460` theme — this is a hard constraint, not just a preference, since carrying blue forward would fail success criterion #1 ("no remaining deep-blue theme surfaces anywhere").
- **D-02:** Preserve the existing **3-tier surface depth structure** (`--color-bg-page` darkest → `--color-bg-surface` → `--color-bg-surface-alt` lightest-of-the-three) — just recolor each tier to a charcoal/graphite value. Do not flatten to 2 tiers. Lowest-risk option; matches the token file's existing shape exactly, so downstream planning/implementation is a value substitution, not a structural change.

### Team-accent contrast strategy (THEME-04)

- **D-03:** Several team `uiColor` values in `packages/shared/src/teamConfig.ts` are very light (e.g. Xolos-style gold `#FEE500`, a pink `#FF75A8`) and will likely fail WCAG AA against the new charcoal/white base. Where a team's accent fails, **auto-adjust (darken/lighten) just that color** until it clears AA — apply this per-team, not uniformly to every team's color. Passing colors are left untouched; only the colors that actually fail get adjusted. Must be verifiable by the automated contrast-check script required by ROADMAP success criterion #3.
- **D-04:** The contrast adjustment happens in a **new derivation layer only** — at the point where the CSS runtime `--team-accent` variable is derived from `TEAM_CONFIGS[activeTeam].palette.uiColor` (the existing Phase 33/THEME-03 mechanism). `TEAM_CONFIGS.uiColor` itself in `packages/shared/src/teamConfig.ts` stays **unchanged** — it's the raw brand color, still used as-is for other UI purposes (e.g. scoreboard/action-log team-name coloring) that aren't covered by THEME-04's contrast requirement. Only the theme-accent derivation point gets the AA-safe adjusted value.

### Functional/status color treatment

- **D-05:** CTA-ready (`--color-cta-ready-bg` #27ae60), CTA-pending (`--color-cta-pending-bg` #f39c12), danger (`--color-danger` #ef4444), and success (`--color-success` #22c55e) stay **exactly as-is** — these are semantic/functional state colors, not part of the deep-blue → charcoal chrome swap, and already read fine on dark backgrounds. No retuning. This keeps the diff scoped to genuinely "themed" tokens (backgrounds, borders, text, accent) per THEME-01's wording.

### Claude's Discretion

- Exact hex values for all charcoal/graphite tiers and white text tones (D-01/D-02) — no reference image provided; pick within the "neutral true-charcoal, no blue tint" constraint.
- Exact per-team contrast-adjustment algorithm/amount for failing team colors (D-03) — e.g. HSL lightness reduction step size — as long as the automated contrast-check script (success criterion #3) confirms AA pass for every team afterward.
- Where exactly the new derivation layer (D-04) lives in code (CSS `color-mix()`, a build-time script, a small TS utility feeding a runtime style property, etc.) — implementation detail for planning/research.
- Stylelint rule configuration and scope for the "zero hardcoded hex/rgba" gate (success criterion #2), and which now-unreferenced CSS classes get removed as part of the sweep.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project/milestone context

- `.planning/PROJECT.md` — v1.5 milestone goal, current-state tech debt list
- `.planning/REQUIREMENTS.md` (lines 8-13) — THEME-01, THEME-02, THEME-04 requirement definitions (THEME-03 already complete, Phase 33)
- `.planning/ROADMAP.md` (lines 202-214) — Phase 34 goal, 4 success criteria, dependency on Phase 33
- `.planning/phases/33-design-tokens-highlight-standardization/33-CONTEXT.md` — prior-phase decisions; confirms tokens.css values are frozen at today's blue theme specifically so Phase 34 can do a pure value swap; confirms highlight/ring colors are a separate system, out of this phase's scope

### Existing code (chrome token layer)

- `packages/client/src/styles/tokens.css` — the complete chrome design-token file (~35 custom properties: backgrounds, borders, text, team accent, CTA/status colors, extended tokens) — the primary file whose _values_ this phase changes
- `packages/shared/src/teamConfig.ts` (lines 46-286) — `TEAM_CONFIGS`, 14 teams' `palette.uiColor` values — several are very light and will need the new contrast-derivation layer (D-03/D-04); this file's raw values do NOT change (D-04)
- Every chrome-related `.module.css` under `packages/client/src/` (17 CSS Modules) — already migrated to `var(--token)` in Phase 33; this phase should need zero structural changes here, only token-value edits plus the new stylelint gate

No other external specs/ADRs apply beyond the above — requirements are fully captured in the Decisions section.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `tokens.css`'s existing 3-tier background structure (`--color-bg-page`/`--color-bg-surface`/`--color-bg-surface-alt`) — reuse the shape, only change the values (D-02).
- `--team-accent` runtime CSS variable mechanism (Phase 33/THEME-03) — the existing single point where `TEAM_CONFIGS[activeTeam].palette.uiColor` becomes a CSS custom property; this is where the new AA-contrast derivation (D-04) should hook in.

### Established Patterns

- `TEAM_CONFIGS[...].palette.uiColor` is the single source of truth for raw team brand colors (Phase 15/18/32/33 decisions) — stays the raw/unadjusted value; any AA-safe derivation is additive, not a replacement (D-04).
- No stylelint or WCAG-contrast tooling exists anywhere in the repo today (confirmed via scout) — both are net-new for this phase, to satisfy success criteria #2 and #3.

### Integration Points

- `packages/client/src/styles/tokens.css` — primary file for the palette value swap.
- Wherever the `--team-accent` derivation currently happens (Phase 33 implementation) — extension point for the new contrast-safe derivation layer (D-04).
- `.github/workflows/ci.yml` — likely home for new stylelint/contrast-check CI gates, following the pattern Phase 32 established for `knip`.

</code_context>

<specifics>
## Specific Ideas

- "Neutral, true-charcoal broadcast look, no blue tint carried over" — user's explicit constraint, own words via selected option (D-01).
- No specific broadcast graphic/app reference was named — open to standard dark-sports-UI patterns.

</specifics>

<deferred>
## Deferred Ideas

- **Loose-ball pathing on a blocked shot should path from the blocking square, not the shooting square** — a gameplay-logic bug (likely `computeShotPathDeflection`/loose-ball routing in `gameEngine.ts`), unrelated to chrome-color theming. Not part of Phase 34 scope. Recommend logging as a new backlog bug for a future phase or quick-task.
- **Undo should not be allowed to progress earlier than a dice-roll-triggering action (tackle/steal) within a move** — an undo-boundary/state-management bug, unrelated to chrome-color theming. Not part of Phase 34 scope. Recommend logging as a new backlog bug for a future phase or quick-task.

### Reviewed Todos (not folded)

- **`2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md`** (BUG-23) — reviewed again via `cross_reference_todos`; user explicitly chose to leave it alone. It's a highlight-rendering defect (not a chrome-color defect), already marked out-of-scope in REQUIREMENTS.md, and Phase 33's final UAT reported no issue — may already be resolved. Not folded into Phase 34.
- **`csv-consolidation-player-pool.md`** — reviewed; a data-pipeline/CSV idea unrelated to visual theming. Not folded; remains a low-priority backlog idea with no phase assignment.

**Note:** `2026-06-21-bug-gk-kick-ball-delivery-invisible-during-replay.md` was found to be stale (already fixed in Phase 31) during this review and was archived to `.planning/todos/completed/` directly (commit `dbf66f7`), rather than folded into this phase.

</deferred>

---

_Phase: 34-Visual Theme Restyle_
_Context gathered: 2026-07-26_
