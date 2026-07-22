# Project Research Summary

**Project:** Counter Attack Web — v1.5 Milestone (UX Refresh & Code Cleanup)
**Domain:** Broadcast-sports digital UI refresh + maintenance cleanup on an existing React 18 + CSS Modules + Zustand client (Node/Express + Socket.io server, pnpm monorepo)
**Researched:** 2026-07-22
**Confidence:** HIGH

## Executive Summary

v1.5 is not a rewrite — it is a refresh layered on a shipped, test-covered real-time multiplayer game. Two independent workstreams are in scope: (1) a broadcast-style "charcoal/graphite" chrome restyle plus standardization of the hex-highlight color system, and (2) general code cleanup (dead state, duplicated lookups, Zustand hygiene). All four researchers independently converged on the same core finding: the codebase has **zero CSS custom properties today** (297 hardcoded color literals across 18 CSS Modules, duplicated per-file by explicit "no shared CSS partial" convention), so a design-token layer must be built from scratch, and it must land _before_ any component restyling — otherwise restyling work reintroduces the exact cruft it's meant to remove.

The recommended approach is a strict two-tier color model: a brand-new CSS-custom-property token layer for **UI chrome** (panels, buttons, borders, text), kept entirely separate from the two existing, correctly-scoped domain-color registries — `HIGHLIGHT_STYLES` (game-state hex-tint semantics) and `TEAM_CONFIGS` (real team-kit identity). These two axes must never be folded into the new chrome layer; doing so would make a "theme change" accidentally recolor a real team's kit or redefine what "danger" means on the board. Within the highlight system, the named goal/offside red collision is real but is actually _two_ independently-defined reds in two different rendering layers (`HexCell.tsx` hex-fill vs. `PieceOverlay.tsx` piece-ring) — and the formal `HIGHLIGHT_STYLES` table only covers 7 of an estimated 13-14 real highlight cases, with several (GK_KICK_TARGET, QUICK_THROW, pass-target, tackle-risk, ball-position gold overlays) living as ad-hoc inline literals in `HexGrid.tsx` that a naive token sweep would miss entirely.

Key risks, in priority order: (1) 60 test assertions across 4 test files assert on literal color strings, not semantic identity — a "big bang" test rewrite if not sequenced as its own step before any palette value changes; (2) dynamic `styles[colorClass]` bracket-lookups (sourced from `speedOptions.ts`) are invisible to naive dead-code search and are the single highest-risk deletion target in the cleanup track; (3) combining the visual and cleanup workstreams into one undifferentiated phase risks unbisectable regressions and repeats this project's own documented history of mid-milestone scope drift (per `RETROSPECTIVE.md`). Mitigation for all three is the same: sequence work into clearly separated phases, each with its own test-passing gate, rather than one broad "reskin + cleanup" phase.

## Key Findings

### Recommended Stack

No new runtime dependencies are needed — the token layer is native CSS custom properties (zero package, zero build step), which is also the only mechanism that supports the one genuinely dynamic requirement (a single team-accent color read from the existing `TEAM_CONFIGS[...].palette.uiColor`). All new tooling is dev-only and additive.

**Core additions:**

- Native CSS Custom Properties + one `:root` tokens file (`packages/client/src/styles/tokens.css`, imported once from `index.css`) — canonical static broadcast palette; zero dependency, works inside every CSS Module via `var()`.
- Runtime CSS-variable bridge (a few lines in React) — wires `TEAM_CONFIGS[teamId].palette.uiColor` into a single `--team-accent` variable without touching `TEAM_CONFIGS` itself.
- `stylelint` 17.14.1 + `stylelint-config-standard` + `stylelint-config-css-modules` — enforces `var()` usage going forward and prevents new hardcoded hex from creeping back in.
- `knip` 6.29.0 (not `ts-prune`, unmaintained since 2022) — workspace-aware dead-export/dead-file detection for the cleanup track.
- `eslint-plugin-react-hooks` 7.1.1 (currently absent from `eslint.config.js`) — catches stale Zustand-selector dependency arrays mechanically.
- `wcag-contrast` 3.0.0 (client-local devDependency only) — one-off script to verify all 12 team accent colors meet WCAG AA against the new charcoal base.

### Expected Features

**Must have (table stakes):**

- Preserve the already-correct dark broadcast base palette and single-accent convention — no second accent color for highlights.
- Restore red to exactly one meaning app-wide ("rule violation/restricted") — direction (recolor goal-line-target vs. recolor offside) is disputed between researchers, see Gaps.
- Add a dedicated ball-location marker — currently missing entirely; recommended as an independent icon/token overlay (mirroring the existing `PieceOverlay` offside/isMovedThisStage "always composited on top" pattern), not a 7th/8th `HexHighlightType` competing in the mutually-exclusive priority ternary.
- One single source-of-truth highlight/color mapping (extend `HIGHLIGHT_STYLES` to cover every ad-hoc inline case, not just the formal 7).
- Redundant color+shape encoding for the highest-stakes states (rule violation, scoring opportunity) — codebase already does this correctly for `activated` (orange ring + red X); extend the pattern.

**Should have (competitive, v1.5.x follow-up):**

- Full redundant icon+glyph encoding across every remaining highlight type (WCAG 1.4.1 full compliance).
- Disambiguate `active` (selected) vs. `isMovedThisStage` ring — currently identical green `#22c55e`, differing only by an 8px radius.
- Colorblind-safe hue selection referenced against Okabe-Ito (not verbatim adoption — several of its hues are already claimed by team/tier colors).

**Defer (v2+):**

- User-toggleable colorblind mode / alternate palette — real demand signal needed first; also structurally depends on this milestone's default palette being collision-free first.
- Full custom theme/color picker for board highlights — explicit anti-feature; scope creep for a 2-player POC.

### Architecture Approach

Two-tier, non-overlapping color-source-of-truth model: (1) a new CSS-custom-property token layer for UI chrome, consumed by all 17-18 `*.module.css` files via `var()`, with zero JS/React involvement (browser cascade only, no re-render cost); (2) the existing TS constant modules `HIGHLIGHT_STYLES` (`HexCell.tsx`) and `TEAM_CONFIGS` (`packages/shared/src/teamConfig.ts`), which stay theme-invariant and are only _extended_ (new `ball-location` entry), never restructured or merged into tier 1.

**Major components:**

1. `styles/tokens.css` (NEW) — single source of truth for chrome colors; imported once from `index.css`.
2. `HIGHLIGHT_STYLES` / `HexHighlightType` (`HexCell.tsx`, extended) — single source of truth for hex-tint semantics; `HexGrid.tsx` resolves booleans into one type per hex via a priority ternary (mutually exclusive by design — wrong pattern for "always on top" markers like ball-location).
3. `PieceOverlay.tsx`'s independent boolean-driven ring layer (`isOffside`/`isMovedThisStage`) — the correct pattern to mirror for the new ball-location marker.
4. `TEAM_CONFIGS` — team-kit identity, consumed directly by 6+ components; candidate for `useTeamColor()` extraction (8+ duplicated lookups in `GameBoard.tsx`).
5. `useGameStore` (Zustand) — cleanup here is subtractive only (remove dead `shootTargetHex` field).

### Critical Pitfalls

1. **60 literal-color test assertions break en masse when tokens are introduced** — refactor the _lookup_ to token/constant identity before any palette value changes.
2. **The goal/offside red collision is two reds in two different DOM layers** (hex-fill vs. piece-ring) — a naive single-value fix will miss one of them; build a full semantic-role color inventory first.
3. **`HIGHLIGHT_STYLES` only formally covers 7 of ~13-14 real highlight cases** — several are ad-hoc inline literals in `HexGrid.tsx` a token sweep scoped to the formal table would miss.
4. **Dynamic `styles[colorClass]` bracket-lookups are invisible to naive dead-code search** — sourced from `speedOptions.ts`; grep the literal class-name string before deleting any CSS class.
5. **Combining cleanup and visual workstreams into one phase risks unbisectable regressions** and repeats this project's documented history of mid-milestone scope drift.

## Implications for Roadmap

### Phase 1: Non-visual code cleanup

**Rationale:** Independent of the color system; lowest risk, unblocks nothing else.
**Delivers:** Remove dead `shootTargetHex`; extract duplicated `TEAM_CONFIGS[...].palette.uiColor` lookups and `myTeam` derivation; add `eslint-plugin-react-hooks`, passing across shared → server → client.
**Addresses:** Code cleanup ask.
**Avoids:** Pitfall 5 (sequencing risk), dead-code/dynamic-CSS blind spots.

### Phase 2: Design-token foundation + highlight-system standardization

**Rationale:** Must precede restyling; also the place to fix the test-assertion architecture before values change.
**Delivers:** `tokens.css`; `HIGHLIGHT_STYLES` extended to all 13-14 highlight cases incl. `ball-location`; test assertions migrated to token-identity.
**Addresses:** Goal/offside fix, ball-location marker, single source-of-truth mapping (all P1).
**Avoids:** Pitfalls 1, 2, 3.

### Phase 3: Component restyling

**Rationale:** Mechanical sweep once tokens exist; parallelizable per file.
**Delivers:** 18 `*.module.css` files migrated to `var(--token)`; charcoal palette applied app-wide.
**Uses:** `stylelint`, `wcag-contrast` audit.

### Phase 4: CSS dead-code pruning

**Rationale:** Only safe once dynamic `styles[x]` sites are traced during Phases 2-3.
**Delivers:** Removal of genuinely-unreferenced CSS classes; `knip` run at repo root.
**Avoids:** Pitfall 4.

### Phase Ordering Rationale

- Phase 1 and Phases 2-4 touch disjoint files but stay sequential to preserve bisectability.
- Phase 2 must precede Phase 3; Phase 4 must follow both.
- Each phase carries its own test-passing gate, mirroring this project's "phase splitting" pattern.

### Research Flags

Needs research/decision at planning time: Phase 2 (goal/offside recolor direction is disputed between researchers; PieceOverlay ring scope is undecided; rulebook offside color convention unverifiable from codebase).
Standard patterns: Phase 1 (cleanup tooling), Phase 3 (mechanical CSS sweep), Phase 4 (standard dead-code detection).

## Confidence Assessment

| Area         | Confidence                                                                                                | Notes                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Stack        | HIGH                                                                                                      | Verified against npm registry same-day; codebase facts confirmed by direct grep. |
| Features     | HIGH for external conventions (WCAG, forum evidence, Okabe-Ito); MEDIUM for specific hex recommendations. |
| Architecture | HIGH — based on direct repository inspection.                                                             |
| Pitfalls     | HIGH — grounded in file/line citations and cross-checked against `RETROSPECTIVE.md`.                      |

**Overall confidence:** HIGH

### Gaps to Address

- Goal vs. offside recolor direction conflict between Features research (recolor goal) and Pitfalls research (implicitly leaves open which side moves) — must be resolved explicitly at requirements/planning time.
- `PieceOverlay` selection-ring colors (blue/green/orange/red) in/out of scope for the chrome refresh — undecided by any researcher; flagged for the roadmapper to clarify with the user before the phase that touches it.
- Rulebook offside color convention — unverifiable from codebase; treat as a user decision or free design choice.
- `header-target` highlight is actually green in the current code, not white as the original brief assumed — correct the shared mental model going into requirements.

## Sources

### Primary (HIGH confidence)

- Direct repository inspection across client/server/shared packages, `.planning/RETROSPECTIVE.md`.
- npm registry metadata for all new dev tools.
- WCAG 1.4.1 official spec.

### Secondary (MEDIUM confidence)

- Chess.com/Lichess forum threads; Okabe-Ito palette; specific recolor hex recommendation.

### Tertiary (LOW confidence)

- General FIFA/EA/broadcast color conventions (illustrative, not audited).

---

_Research completed: 2026-07-22_
_Ready for roadmap: yes_
