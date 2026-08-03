# Phase 33: Design Tokens & Highlight Standardization - Research

**Researched:** 2026-07-25
**Domain:** Internal client-side refactor — CSS custom-property design tokens + SVG hex-highlight/piece-ring color system (React 18 + Vite + CSS Modules, no new libraries)
**Confidence:** HIGH (this is a pure codebase audit — every claim below was verified by reading the actual source files in this repo, not by researching an external ecosystem)

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### HILITE-01/02/03 — Highlight color semantics

- **D-01:** Adopt a traffic-light semantic system: **green** = safe/valid move, **yellow/amber** = caution/risk, **red** = danger/rule-violation ONLY (offside, illegal — the sole red meaning app-wide per success criterion #3), **blue** = neutral info (kickoff zone, ball-related neutral state), and a **distinct non-red color** (e.g. purple or cyan — planner/implementer's judgment during actual swatch selection) for shot-opportunity/goal-target so it is never confused with red-danger.
- **D-02:** This reassigns the current `goal` highlight (currently red `rgba(220,50,50,1)`) off red entirely — freeing red exclusively for the offside ring (`#dc2626` in `PieceOverlay.tsx`), satisfying success criterion #3.
- **D-03:** The full ~13-14 type mapping (existing 7 in `HexCell.tsx`'s `HIGHLIGHT_STYLES` plus new: GK-kick-target, pass-target, tackle-risk, ball-position, and any other gaps found during implementation) must be written up as a single reference document per ROADMAP success criterion #2 — exact list of all 13-14 to be finalized during planning/research by auditing every inline highlight-color literal in `HexGrid.tsx`.

#### Selected-piece ring vs. already-moved-this-stage ring (success criterion #4)

- **D-04:** "Selected/active" ring stays **green** (`#22c55e`, matches the new safe=green semantic) — no change.
- **D-05:** "Already-moved-this-stage" ring (currently identical green, in `PieceOverlay.tsx` — the free-kick "moved this stage" marker) becomes: a **dark grey ring outline** plus a **light grey semi-transparent overlay circle** drawn over the rest of the piece, producing a visually "dimmed/used-up" look distinct from the bright green active-selection ring. Exact grey tones (dark ring / light overlay opacity) are Claude's discretion during implementation — aim for a look that reads as "spent/greyed out," not alarming.
- **Fallback noted but not needed unless the grey treatment proves unworkable:** user's fallback was to keep the existing orange circle + red X ("activated" state in `PieceOverlay.tsx`) with only minor color-tone adjustment at Claude's discretion. Only use this fallback if the grey-ring approach turns out visually indistinguishable from other states or technically awkward — default to D-05.

#### Token file structure & scope (Success Criterion #1)

- **D-06:** Create the CSS custom-property token file now (root token file defining all chrome colors + the single `--team-accent` variable derived from `TEAM_CONFIGS.palette.uiColor`), and migrate every hardcoded chrome color literal in components/CSS Modules to reference tokens — but the token **values** stay identical to today's existing deep-blue theme. Phase 34 then does a pure token-value swap to the charcoal/graphite palette with zero literal-hunting required.
- **D-07:** This phase's token migration scope is chrome colors specifically (backgrounds, borders, text colors, the accent variable) — separate from the highlight/ring color table (D-01..05 above), which is its own lookup table, not folded into the same CSS custom-property file unless implementation finds a clean reason to unify them.

#### Ball-location marker (Success Criterion #5)

- **D-08:** Implement as a **white hex-edge highlight** — outline the edge of the ball's hex in white, using the **same stroke thickness as the existing player-state ring indicators** in `PieceOverlay.tsx` (selected/active/activated/offside rings) for visual consistency. This replaces the "dot/icon/pulse" marker concepts initially proposed — user's explicit preference is a hex-edge outline, not a piece-level marker.
- **D-09:** Must render always-on-top during response phases (headers, kicks) per the requirement — layering order relative to existing highlight overlays and piece rings to be resolved during implementation (likely: render after/above the standard `HIGHLIGHT_STYLES` overlay in `HexCell.tsx`, same z-order tier as piece rings).

#### Test migration (Success Criterion #5, second half)

- All pre-existing color-literal test assertions (e.g. in `HexGrid.test.tsx`) must be migrated to assert token/semantic identity (e.g. asserting `highlightType === 'risk'` or a token name) instead of literal color strings (e.g. `'rgba(255,140,0,1)'`) — this must happen for every test that currently hardcodes a color literal, ahead of/alongside the Phase 34 palette value change, per ROADMAP wording ("existing color-literal tests migrated to token/semantic identity ahead of any palette value changes").

### Claude's Discretion

- Exact hex/rgba values for the new shot-opportunity/goal-target color (must not be red).
- Exact grey tones for the "already-moved-this-stage" ring + overlay circle (D-05).
- Full enumeration of all ~13-14 highlight types and the format/location of the single reference document (D-03) — likely a new `.md` doc or a co-located comment block, decided during planning.
- Whether chrome tokens and highlight/ring colors end up in one combined token file or two related files (D-07) — implementation-detail judgment call.
- Exact z-order/layering mechanism for the ball-location hex-edge highlight (D-09).

### Deferred Ideas (OUT OF SCOPE)

- **Back button on create-game screen** — raised during discussion; a new UI capability, not a design-token/highlight-color change. Not part of Phase 33 scope. Recommend logging as a backlog bug/UX item for a future phase or quick-task.
- **Duplicate-player prevention in draft packs** — raised during discussion; a draft-engine correctness fix (Phase 27-30 territory), unrelated to visual tokens. Not part of Phase 33 scope. Recommend logging as a backlog bug for a future phase or quick-task.

Reviewed todos (not folded): the `2026-07-02` KICK_OFF_SETUP shot-path-shading bug remains earmarked for Phase 33/34 per `31-CONTEXT.md`/`32-CONTEXT.md` — implementer should check during Phase 33/34 whether the highlight-standardization work incidentally resolves it (see Common Pitfall 3 below).
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID        | Description                                                                                                                                                  | Research Support                                                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| THEME-03  | The single accent color per view is derived from the active team's `TEAM_CONFIGS.palette.uiColor` via one runtime CSS variable, not per-component lookups    | Architecture Pattern 4 (runtime CSS-var injection via inline style on screen root) documents the exact wiring mechanism; confirmed current per-component call-site pattern (`useTeamAccentColor` threaded through 5+ individual `style={{color}}` props in `GameBoard.tsx`) that must be replaced |
| HILITE-01 | Every hex-tint and piece-selection-ring color is defined in one single source-of-truth table, extending `HIGHLIGHT_STYLES` to cover all real highlight cases | Full literal audit (Code Examples section) enumerates every ad-hoc `HexGrid.tsx` overlay (11 literal occurrences across 5 distinct overlay groups + 1 CSS-module class) that must migrate into `HIGHLIGHT_STYLES`/`HexCell.tsx` props                                                             |
| HILITE-02 | Red used for exactly one meaning app-wide (rule violation/offside); goal-line shot-target moved to a distinct non-red color                                  | Confirmed current `goal` highlight is `rgba(220,50,50,1)` (red) and offside ring is `#dc2626` (red) — two separate reds today; Architecture/Common Pitfalls sections flag the exact literals to change                                                                                            |
| HILITE-03 | "Selected" ring and "already-moved-this-stage" ring are visually distinct (currently both identical green)                                                   | Confirmed via direct read of `PieceOverlay.tsx` (both use `#22c55e` today) and `PieceOverlay.test.tsx` line 304 (the exact assertion that must change)                                                                                                                                            |
| HILITE-04 | Dedicated ball-location marker, standalone always-on-top overlay, not competing in the mutually-exclusive highlight priority order                           | Architecture diagram + Pattern identifies the exact current precursor (HEADER-only gold overlay, lines 588-598) to remove, and the new standalone-component placement (topmost SVG layer, after `PieceOverlay`) required to satisfy "not competing"                                               |
| HILITE-05 | Full highlight/ring color mapping documented as a single reference                                                                                           | Pattern 3 clarifies the reference doc must cover three structurally distinct color mechanisms (hex tints, piece rings, standalone overlays), not one flat table; recommends `docs/HIGHLIGHT-REFERENCE.md` location                                                                                |

</phase_requirements>

## Summary

This phase has no new-technology risk — there is nothing to "learn," only to **audit exhaustively and then centralize**. The codebase already has two informal color systems that need to become one formal one: (1) a 7-entry `HIGHLIGHT_STYLES` lookup table in `HexCell.tsx` that is a good pattern to _extend_, and (2) roughly a dozen ad-hoc inline `<polygon>`/`style={{color:...}}` color literals scattered across `HexGrid.tsx`, `PieceOverlay.tsx`, and 15 CSS Modules that bypass that table entirely. The chrome-color side is a large, mechanical, low-risk migration: 342 raw hex/rgba literal occurrences across 15 `*.module.css` files reduce to roughly **12 distinct reusable colors** (a manageable token set), plus a handful of one-off SVG literals in `.tsx` files that also need tokens or removal.

The highlight-color side is architecturally more interesting: `HexGrid.tsx` currently renders several highlight/ring overlays as **raw sibling `<polygon>` elements inside the per-hex loop**, completely bypassing `HexCell`'s `highlightType` prop and its `HIGHLIGHT_STYLES` table. These ad-hoc overlays fall into two shapes that don't fit the existing single-`highlightType`-enum model: (a) new mutually-exclusive tint types that just need adding to the enum (GK-kick-target, pass-target, tackle-risk-during-pass), and (b) **compound/layered overlays** — an additional ring or fill drawn _on top of_ whatever base tint already won the priority ternary (the KICK*OFF_SETUP centre-hex "required" ring, and the confirmed-pass-target ring). `PieceOverlay.tsx` already has an established pattern for exactly this second shape — independent boolean-driven ring layers (`isOffside`, `isMovedThisStage`) that render \_alongside* the primary `selectionState` switch, not inside it. The plan should mirror that pattern onto `HexCell.tsx` rather than inventing a new mechanism.

One existing overlay — the HEADER-phase gold ball-position highlight (`#f5c518`, lines ~588-598 of `HexGrid.tsx`) — is the direct, narrower precursor of this phase's new ball-location marker (D-08/D-09, HILITE-04). It must be replaced (not extended) with a white, always-on-top, hex-edge-only overlay that covers more phases than just HEADER. Because HILITE-04 explicitly requires this marker to sit _outside_ the mutually-exclusive highlight priority order, it should be implemented as a new standalone component rendered as the topmost SVG layer (after `PieceOverlay`), not as a `HexHighlightType` member.

**Primary recommendation:** Do the chrome-token migration as pure mechanical find/replace against ~12 new CSS custom properties defined in one new `packages/client/src/styles/tokens.css` (imported once in `main.tsx`, values frozen to today's deep-blue theme per D-06). Separately, extend `HexCell.tsx`'s `HexHighlightType` union and `HIGHLIGHT_STYLES` table to absorb every ad-hoc `HexGrid.tsx` inline literal, adding a small independent "ring/overlay" prop (mirroring `PieceOverlay`'s `isOffside`/`isMovedThisStage` pattern) for the two compound cases. Implement the ball-location marker as a new standalone component (`BallLocationRing.tsx` or similar) rendered last in the SVG tree. Do all of this with the existing deep-blue/gold/orange/red/green palette values unchanged — Phase 34 then only edits the token _values_.

## Architectural Responsibility Map

| Capability                                                             | Primary Tier                                        | Secondary Tier                             | Rationale                                                                                                                                                                               |
| ---------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome design-token definitions (`--color-*`)                          | Browser/Client (CSS)                                | CDN/Static (bundled at build time by Vite) | Pure presentation values consumed by CSS Modules already loaded client-side; no server involvement                                                                                      |
| Runtime `--team-accent` derivation from `TEAM_CONFIGS.palette.uiColor` | Browser/Client (React state → inline style/CSS var) | —                                          | `TEAM_CONFIGS` is a static client-side import (`@counter-attack/shared`); the "active team" is client UI state (`selectedTeams`/`activeTeam` in the Zustand store), not server-computed |
| Highlight/ring color table (`HIGHLIGHT_STYLES`, piece rings)           | Browser/Client (SVG rendering)                      | —                                          | Pure rendering concern inside `HexCell.tsx`/`PieceOverlay.tsx`; `highlightType` values are already derived client-side in `HexGrid.tsx` from server-authoritative `GameState`           |
| Ball-location marker overlay                                           | Browser/Client (SVG rendering)                      | —                                          | New standalone SVG component; ball position itself (`GameState.ball.position`) is server-authoritative, but the marker rendering is 100% client                                         |
| Color-literal test assertions                                          | Browser/Client (Vitest/jsdom test suite)            | —                                          | Test-only concern, no runtime/production code path                                                                                                                                      |

## Standard Stack

### Core

No new libraries are introduced by this phase. The existing stack is sufficient and appropriate:

| Library                                      | Version               | Purpose                                                        | Why Standard                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Native CSS Custom Properties                 | CSS spec (no package) | Design-token layer (`--color-*`, `--team-accent`)              | `[VERIFIED: packages/client/package.json]` No PostCSS/Tailwind/CSS-in-JS present — plain CSS Modules via Vite's built-in CSS pipeline is the only styling mechanism in this codebase; native `:root { --x: ... }` variables are consumed for free by every existing `.module.css` file with zero new tooling |
| React 18.3.1                                 | 18.3.1 (pinned)       | Runtime CSS var injection via inline `style` on a root element | `[VERIFIED: packages/client/package.json]` Already pinned per STATE.md ("React 18.3.1 + Zustand 4.5.7 pinned — not npm latest v19/v5")                                                                                                                                                                       |
| Vite 5.4.21                                  | 5.4.21                | Build tool, serves `.css`/`.module.css` natively               | `[VERIFIED: packages/client/package.json]`                                                                                                                                                                                                                                                                   |
| Vitest 2.1.9 + @testing-library/react 14.3.1 | 2.1.9 / 14.3.1        | Test-literal migration target                                  | `[VERIFIED: packages/client/package.json]`                                                                                                                                                                                                                                                                   |

### Supporting

None needed. This phase should add **zero** new `dependencies`/`devDependencies` entries to `packages/client/package.json`.

### Alternatives Considered

| Instead of                                                                                   | Could Use                                                                                               | Tradeoff                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native CSS custom properties                                                                 | CSS-in-JS (styled-components, vanilla-extract)                                                          | Explicitly out of scope per CLAUDE.md ("New UI framework or component library" is out of scope for this milestone) and per REQUIREMENTS.md Out of Scope table ("Replacing SVG rendering, Zustand, or React itself"). Would also require a new dependency, contradicting D-06/D-07's framing of this as a pure CSS-file addition.                                                                                                  |
| `document.documentElement.style.setProperty('--team-accent', ...)` (imperative DOM mutation) | React inline-style CSS-var injection: `<div style={{ '--team-accent': color } as React.CSSProperties}>` | The inline-style pattern is idiomatic React+TypeScript, keeps the mutation inside React's render cycle (testable in jsdom without side-effecting `document` globally between tests), and scopes the variable to the subtree that needs it rather than the whole document `[CITED: spacejelly.dev — "How to Create CSS Custom Properties That Dynamically Update with React & JavaScript"]`. Recommended over the imperative form. |

**Installation:** None required — no `pnpm add` needed for this phase.

**Version verification:** Not applicable (no new packages).

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** It is a pure internal refactor: one new `.css` file, extensions to existing `.tsx` component prop tables, and CSS Module literal-to-`var()` substitutions. The Package Legitimacy Gate protocol is skipped per its own trigger condition ("whenever this phase installs external packages").

**Packages removed due to [SLOP] verdict:** none — no packages evaluated.
**Packages flagged as suspicious [SUS]:** none — no packages evaluated.

## Architecture Patterns

### System Architecture Diagram

```
GameState (server-authoritative, arrives via Socket.io GAME_STATE event)
        │
        ▼
useGameStore (Zustand) ── selectedTeams / activeTeam / gameState.ball / gameState.phase
        │
        ├──► TEAM_CONFIGS[selectedTeams[team]].palette.uiColor  (static import, @counter-attack/shared)
        │            │
        │            ▼
        │    useTeamAccentColor(teamId) [existing hook, packages/client/src/hooks/useTeamColors.ts]
        │            │
        │            ▼
        │    [NEW] inline style on screen-root element: style={{ '--team-accent': color }}
        │            │
        │            ▼
        │    CSS Modules read var(--team-accent) — replaces today's per-component
        │    style={{ color: homeColor }} call sites (GameBoard.tsx lines 269/292/306/346/372/395/408 etc.)
        │
        └──► HexGrid.tsx render loop (per-hex highlightType derivation, ~lines 338-654)
                     │
                     ▼
             HexCell.tsx  ◄── highlightType: HexHighlightType (mutually exclusive, priority-resolved)
                     │       + [NEW] optional independent ring/overlay prop (mirrors PieceOverlay pattern)
                     │
                     ▼
             HIGHLIGHT_STYLES lookup table (single source of truth for fill/stroke/opacity)
                     │
                     ▼
             <polygon> tint overlay — DOM-order z-index inside <g key={hexId}>

        SVG DOM order (z-order), unchanged structural pattern, new top layer added:
        <g clipPath="url(#pitch-clip)">
          {PITCH_HEXES.map ...}      ← Layer 1: hex cells + highlightType tint (HexCell)
          <PitchMarkings/>            ← Layer 1.5: static pitch decor
          <BallMarker ball={ball}/>   ← Layer 2: the ball sprite itself
          {pieces.map ...}            ← Layer 3: PieceOverlay (piece circles + selection/offside/moved rings)
          [NEW] <BallLocationRing/>   ← Layer 4 (topmost): always-on-top white hex-edge outline —
                                         HILITE-04 requires this NOT participate in the highlightType
                                         priority ternary; it must be its own sibling, last in DOM order.
        </g>
```

### Recommended Project Structure

```
packages/client/src/
├── styles/
│   ├── tokens.css              # NEW — :root { --color-bg-panel, --color-border, --color-text-primary,
│   │                           #   --color-text-secondary, --color-accent-blue, --color-danger,
│   │                           #   --color-warning, --color-success, --team-accent (default fallback), ... }
│   └── uniformStyles.tsx        # existing — untouched
├── main.tsx                     # add: import './styles/tokens.css' (alongside existing './index.css')
├── components/
│   ├── HexCell.tsx               # extend HexHighlightType union + HIGHLIGHT_STYLES table;
│   │                              #   add optional ring/overlay prop for compound cases
│   ├── HexGrid.tsx               # remove every inline <polygon fill="#..."/> — replace with
│   │                              #   highlightType/ring prop values only
│   ├── PieceOverlay.tsx          # D-04/D-05: adjust "moved this stage" ring to grey treatment
│   ├── BallLocationRing.tsx      # NEW — standalone always-on-top hex-edge marker (D-08/D-09)
│   └── *.module.css              # replace literal colors with var(--color-*) / var(--team-accent)
└── docs (repo root)/
    └── docs/HIGHLIGHT-REFERENCE.md   # NEW — single reference doc per HILITE-05/D-03 (see Pattern 3)
```

### Pattern 1: Extend, don't replace, `HIGHLIGHT_STYLES`

**What:** `HexCell.tsx`'s existing `HexHighlightType` union (7 members) + `HIGHLIGHT_STYLES` record (fill/restOpacity/hoverOpacity/stroke/strokeWidth per type) is exactly the right shape — CONTEXT.md D-03 and the code-context notes both say to extend it, not redesign it.
**When to use:** For every color currently rendered via a raw `<polygon fill="...">` sibling inside `HexGrid.tsx`'s per-hex `<g key={hexId}>` block that represents a **mutually-exclusive** tint state (i.e., only one can be "true" for a given hex at a time, same as the existing `risk > goal > shot-path > kickoff > safe` priority chain).
**Example:**

```typescript
// Source: packages/client/src/components/HexCell.tsx (existing pattern, lines 6-68)
export type HexHighlightType =
  | 'safe'
  | 'risk'
  | 'goal'
  | 'kickoff'
  | 'shot-path'
  | 'shot-path-action'
  | 'header-target'
  // candidates to add (exact final names/count are a planning decision — see Open Questions):
  | 'gk-kick-target' // sky-blue tint currently hardcoded at HexGrid.tsx:603-605
  | 'pass-target' // green tint currently hardcoded at HexGrid.tsx:614-616 and :625
  | 'tackle-risk'; // orange interception-risk tint currently a raw CSS class (.hexTackleRisk)
```

### Pattern 2: Independent "ring/overlay" layer for compound highlights (new — mirrors `PieceOverlay`)

**What:** `PieceOverlay.tsx` already solves the "this state can coexist with the primary state" problem: `selectionState` (none/selectable/active/activated) is a mutually-exclusive switch, but `isOffside` and `isMovedThisStage` are **independent boolean props** that render their own `<circle>` ring at a distinct radius, layered on top, regardless of what `selectionState` resolved to (see `PieceOverlay.tsx` lines 207-240 and their doc comments).
**When to use:** Two current `HexGrid.tsx` ad-hoc overlays don't fit a single mutually-exclusive `highlightType` because they are drawn **in addition to** whatever base tint the hex already has:

- The KICK_OFF_SETUP centre-hex "required" marker (gold fill + gold ring, `HexGrid.tsx` lines 568-587) — drawn on top of whatever `highlightType` (usually `'kickoff'`) the centre hex also has.
- The confirmed-pass-target ring (gold outline, `HexGrid.tsx` lines 641-651) — drawn on top of the `'pass-target'` tint once a target is confirmed.

Both currently reuse the exact same gold literal (`#f5c518`) that is _also_, by coincidence, the same color as `HIGHLIGHT_STYLES.safe.fill` (`rgba(245,197,24,1)` === `#f5c518` in a different notation — confirmed by direct decimal conversion). Recommend adding one small optional prop to `HexCell.tsx`, e.g. `ring?: 'required' | 'confirmed'` (or a boolean if the two never need to be visually distinct), following the exact structural pattern already proven in `PieceOverlay`.
**Example:**

```typescript
// Source: packages/client/src/components/PieceOverlay.tsx lines 224-240 (pattern to mirror in HexCell.tsx)
{isMovedThisStage && (
  <circle cx={cx} cy={cy} r={PIECE_RADIUS + 8} fill="none" stroke="#22c55e" strokeWidth={2.5} pointerEvents="none" />
)}
```

### Pattern 3: The "single reference document" covers THREE categories, not one flat table

**What:** HILITE-05/D-03 requires one document covering "the full ~13-14 type mapping." Do not interpret this as one flat `HexHighlightType` union with 13-14 members — the codebase already has (and should keep) three structurally different color mechanisms:

1. **Hex tint types** (`HexHighlightType` / `HIGHLIGHT_STYLES` in `HexCell.tsx`) — mutually exclusive per-hex fill/stroke.
2. **Piece ring colors** (`PieceOverlay.tsx`) — `selectable`/`active`/`activated` (mutually exclusive) plus `isOffside`/`isMovedThisStage` (independent, can stack).
3. **Standalone always-on-top overlays** — the new ball-location marker (HILITE-04 explicitly forbids folding this into category 1), and arguably the centre-hex "required" ring if it is _not_ folded into category 2's new `ring` prop.
   **When to use:** Structure `docs/HIGHLIGHT-REFERENCE.md` (recommended location — sibling to the existing `docs/ARCHITECTURE.md`, `docs/CONFIGURATION.md`, etc., which are the only precedent for permanent reference docs in this repo) as three sub-tables, one per category, so future contributors extending any one of the three don't have to guess which mechanism a new color belongs to.

### Pattern 4: Runtime CSS variable injection via component-tree inline style (not global DOM mutation)

**What:** THEME-03 requires `--team-accent` to be derived from `TEAM_CONFIGS.palette.uiColor` at runtime (it varies by active team/screen, so it cannot be a static value in `tokens.css`). The idiomatic React pattern is an inline `style` object with a custom-property key, cast as `React.CSSProperties`, applied to the screen's outermost wrapper element so all descendant CSS Modules inherit it via normal CSS cascade.
**When to use:** Any screen-root component (`GameBoard.tsx`'s `<div className={styles.gameBoard}>`, `TeamSelectionScreen.tsx`, `UniformSelectionScreen.tsx`, `LineupAssignmentScreen.tsx`) that currently calls `useTeamAccentColor(teamId)` and threads the result through multiple individual `style={{ color: ... }}` props per THEME-03's "not per-component lookups" language.
**Example:**

```typescript
// Source: WebSearch-verified idiomatic pattern (see Sources) — not yet present in this codebase
<div className={styles.gameBoard} style={{ '--team-accent': teamColor } as React.CSSProperties}>
  {/* descendants: .module.css can now use `color: var(--team-accent);` directly */}
</div>
```

### Anti-Patterns to Avoid

- **Raw `<polygon fill="#hex">` siblings inside `HexGrid.tsx`'s per-hex loop:** This is exactly what success criterion #2 forbids. Every one of the 10 raw-literal `<polygon>`/CSS-class overlays currently in `HexGrid.tsx` (lines 568-651, plus the `.hexTackleRisk` CSS-module class) must become a prop passed into `HexCell`, not inline JSX color.
- **Re-deriving `TEAM_CONFIGS` colors per-component:** `ActionLog.tsx` already has a documented convention ("Calls the PURE `teamAccentColor` (never the `useTeamAccentColor` hook)") — 5 of its own call sites (lines 758/766/774/782/790) still hardcode the exact fallback literal `'#888888'` instead of calling `teamAccentColor(undefined)` or a shared `--color-team-fallback` token. Don't perpetuate this pattern when doing the token migration; consolidate these too.
- **Mutating `document.documentElement.style` directly for `--team-accent`:** works, but is harder to test (mutates a global between jsdom test runs unless carefully reset) and doesn't scope the variable — prefer the inline-style-on-subtree-root pattern (Pattern 4).

## Don't Hand-Roll

| Problem                                                | Don't Build                                                                                                                                                                                      | Use Instead                                                                                                                    | Why                                                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Design-token layer                                     | A custom theming library, a JS "theme object" passed through context/props                                                                                                                       | Native CSS custom properties in one `:root` block                                                                              | Zero new dependencies; CSS Modules already read plain CSS, so `var(--x)` is free; this is exactly what D-06 asks for                                                                    |
| Runtime accent-color propagation                       | A new Zustand slice/selector for "current accent color," or prop-drilling through every screen                                                                                                   | One inline-style CSS-variable assignment at each screen's root (Pattern 4) + `var(--team-accent)` in descendant CSS            | `TEAM_CONFIGS` is already a static import and `useTeamAccentColor` already exists — the only missing piece is _where the value is written_, not a new state mechanism                   |
| Compound/stacked highlight state (ring on top of tint) | A second parallel highlight system, or overloading `highlightType` with combinatorial members (e.g. `'kickoff-required'`, `'pass-target-confirmed'` as separate enum values, doubling the table) | An independent boolean/enum "ring" prop on `HexCell`, mirroring `PieceOverlay`'s proven `isOffside`/`isMovedThisStage` pattern | Combinatorial enum growth is exactly the kind of ad-hoc-literal sprawl this phase is trying to eliminate; the ring-prop pattern already exists and is tested elsewhere in this codebase |

**Key insight:** Nothing in this phase requires new infrastructure. Every recommended solution is "use the pattern the codebase already proved out in the sibling component" (`PieceOverlay`'s independent ring layers → apply to `HexCell`; `useTeamAccentColor` → wire its output into one CSS var instead of many inline styles).

## Common Pitfalls

### Pitfall 1: Treating "~13-14 types" as a literal target count for the `HexHighlightType` union

**What goes wrong:** Padding the union to hit a specific number, or conversely stopping the audit early because 7 existing + 4 CONTEXT-named new ones = 11, "close enough."
**Why it happens:** CONTEXT.md's D-03 gives an approximate count (~13-14) as a sanity check, not a spec.
**How to avoid:** Use the full literal audit in this document (see below) as the actual checklist; the true count depends on planning decisions already flagged as Open Questions (e.g., does GK_QUICK_THROW's green tint merge with `pass-target`, or stay distinct? Does the centre-hex "required" ring become a `HexHighlightType` member or a `ring` prop?).
**Warning signs:** A PLAN.md task that says "add exactly 6 new highlight types" without listing which ones and why.

### Pitfall 2: Missing the CSS-class-based highlight (`.hexTackleRisk`)

**What goes wrong:** Grepping only for `#[0-9a-f]{3,8}` or `rgba(` inside `HexGrid.tsx` and missing `className={styles.hexTackleRisk}` (line 635), whose color literal actually lives in `HexGrid.module.css` (`rgba(255, 140, 0, 0.55)`), not in the `.tsx` file.
**Why it happens:** "Inline literal" naturally reads as "literal inside the `.tsx` file"; this one is one level removed.
**How to avoid:** Audit `HexGrid.module.css` alongside `HexGrid.tsx` — it currently has exactly one rule (`.hexTackleRisk`), and it must be migrated into the highlight table too (success criterion #2 says "no ad-hoc inline highlight-color literals remaining in `HexGrid.tsx`" — the CSS class is the same ad-hoc mechanism by another name).
**Warning signs:** `HexGrid.module.css` still has a `.hexTackleRisk` (or similarly named) rule after the phase is marked done.

### Pitfall 3: Forgetting BUG-23 could resurface differently, not disappear

**What goes wrong:** Assuming the KICK_OFF_SETUP stale shot-path-shading bug (`2026-07-02` todo, deferred through Phases 25/26/31/32 to "33/34") is either fully fixed already or fully out of scope, without re-testing after this phase's refactor.
**Why it happens:** The current code (`HexGrid.tsx` lines 142-144 and 452-461) already contains BOTH of the belt-and-suspenders fixes the todo's own "Suggested Fix Approach" describes (`shotTargetHighlight` cleared on `KICK_OFF_SETUP` transition; `isShotPathTint` gated on the entire expression, not just the `lastShotPath` clause) — introduced by commit `32c71d2` ("fix(25-02): BUG-23 belt-and-suspenders KICK_OFF_SETUP shot-path tint guard"). Despite this, Phase 25's own UAT found the bug still reproduced, and it was escalated to a dedicated `/gsd-debug` spike that was explicitly deferred again in Phase 26 as out of scope ("needs dedicated debug spike with console.log instrumentation").
**How to avoid:** This phase's consolidation of every ad-hoc `HexGrid.tsx` polygon overlay into `HexCell`/`HIGHLIGHT_STYLES`-driven props is highly likely to touch the exact code path implicated (the per-hex loop's many independently-conditioned sibling `<polygon>` elements, some phase-gated, some not) — the refactor may incidentally resolve it as a side effect of removing the stacking of independently-conditioned overlays. Recommend one explicit manual verification step during this phase's checkpoint: reproduce the original repro path (SNAPSHOT_DEFLECT → goal → KICK_OFF_SETUP) and confirm no stray shading remains. Do not silently assume it's fixed; do not silently assume it's still someone else's problem — verify and record the result either way.
**Warning signs:** Phase closes without anyone re-running the SNAPSHOT_DEFLECT-goal-to-kickoff repro.

### Pitfall 4: `#f5c518` is already accidentally consistent — don't introduce a second gold

**What goes wrong:** Defining a _new_ gold/amber token for the centre-hex/confirmed-pass-target ring work without noticing it's already the exact same value (in different notation) as `HIGHLIGHT_STYLES.safe.fill` (`rgba(245,197,24,1)`).
**Why it happens:** One is written as a 6-digit hex literal, the other as an rgba() literal — a plain-text grep for one form won't surface the other.
**How to avoid:** Convert every color to a canonical form (hex or decimal-rgb) before deduplicating during token/table design. `#f5c518` = `rgb(245,197,24)` exactly.
**Warning signs:** The final token file has two near-identical gold values that were meant to be the same semantic color.

### Pitfall 5: Migrating chrome tokens without touching `.tsx` inline-style literals

**What goes wrong:** Doing a mechanical grep-and-replace only inside `*.module.css` files (where 342 of the literal occurrences live) and missing the smaller but real set of chrome-color literals embedded directly in component `.tsx` files via `style={{ color: '#hex' }}` — e.g., `KickOffSetupPanel.tsx:97/105` (`'#a0a0a0'`/`'#ef4444'`), `FreeKickSetupPanel.tsx:187/193` (`'#ef4444'`), `GameBoard.tsx:211` (`'#e0e0e0'` draw-result fallback), `GameBoard.tsx:283` (`'#27ae60'` connection-status dot).
**Why it happens:** THEME-02's wording ("no hardcoded hex/rgba literals remain in chrome-related CSS Modules") names CSS Modules specifically; it's easy to read that as the entire scope.
**How to avoid:** D-06's wording is broader ("migrate every hardcoded chrome color literal in components/CSS Modules") — treat inline `style={{...}}` literals inside `.tsx` files as in-scope too, using `var(--color-x)` via the CSS-custom-property-as-string trick (`style={{ color: 'var(--color-danger)' }}` works directly in inline styles, no cast needed for reading a var()).
**Warning signs:** `grep -rn "#[0-9a-f]\{3,8\}" packages/client/src/components/*.tsx` (excluding `.test.tsx` and the highlight-system files) still returns chrome-looking hits after the phase is marked done.

## Code Examples

### Existing highlight-table pattern to extend (verified in this repo)

```typescript
// Source: packages/client/src/components/HexCell.tsx, lines 15-68 (current state, to be extended not replaced)
const HIGHLIGHT_STYLES: Record<
  HexHighlightType,
  { fill: string; restOpacity: number; hoverOpacity: number; stroke: string; strokeWidth: number }
> = {
  safe: {
    fill: 'rgba(245,197,24,1)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#d4a017',
    strokeWidth: 1.5,
  },
  risk: {
    fill: 'rgba(255,140,0,1)',
    restOpacity: 0.65,
    hoverOpacity: 0.8,
    stroke: '#b35a00',
    strokeWidth: 2,
  },
  goal: {
    fill: 'rgba(220,50,50,1)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#cc2222',
    strokeWidth: 1.5,
  },
  // ...4 more existing entries
};
```

### Existing independent-ring pattern to mirror onto HexCell (verified in this repo)

```typescript
// Source: packages/client/src/components/PieceOverlay.tsx, lines 213-223
{isOffside && (
  <circle cx={cx} cy={cy} r={PIECE_RADIUS + 6} fill="none" stroke="#dc2626" strokeWidth={2.5} pointerEvents="none" />
)}
```

### Every ad-hoc HexGrid.tsx literal found in this audit (full enumeration for D-03/success criterion #2)

```typescript
// Source: packages/client/src/components/HexGrid.tsx — line numbers as of this research date

// 1-2. KICK_OFF_SETUP centre-hex "required" marker (fill + ring), lines 568-587
fill="#f5c518" fillOpacity={0.5}           // line 572
stroke="#f5c518" strokeWidth={2}           // line 583  — NOTE: fill and stroke are two separate <polygon>s

// 3-4. HEADER-phase ball-position gold overlay (DIRECT PRECURSOR of the new ball-location marker), lines 588-598
fill="#f5c518" fillOpacity={0.5}
stroke="#f5c518" strokeWidth={2}           // lines 592, 594 — replace entirely per D-08 (white, all response phases, always-on-top)

// 5-6. GK_KICK_TARGET sky-blue tint, lines 599-609
fill="rgba(56,189,248,0.30)"
stroke="rgba(56,189,248,0.55)"             // lines 603-604 — candidate new type: 'gk-kick-target'

// 7-8. GK_QUICK_THROW green tint, lines 610-620
fill="rgba(34,197,94,0.35)"
stroke="rgba(34,197,94,0.6)"               // lines 614-615 — candidate: merge into 'pass-target' (Open Question)

// 9. Safe pass-target green tint, lines 621-630
fill="rgba(34,197,94,0.4)"                 // line 625 — candidate new type: 'pass-target'

// 10. Interception-risk pass target — NOT a literal in the .tsx, but a CSS-module class:
className={styles.hexTackleRisk}           // line 635 → HexGrid.module.css: "fill: rgba(255, 140, 0, 0.55);"
                                            // candidate new type: 'tackle-risk' (or reuse existing 'risk')

// 11. Confirmed pass-target ring, lines 641-651
stroke="#f5c518" strokeWidth={2}           // line 646 — candidate: fold into the same compound "ring" prop
                                            //            as the centre-hex "required" marker (both are gold outline rings)
```

Total distinct `#f5c518` occurrences found: **5** (lines 572, 583, 592, 594, 646) — CONTEXT.md's canonical-refs section says "4x"; this audit found one more (the confirmed-pass-target ring at line 646). Use this document's count for planning.

### Test-literal migration targets (full enumeration)

```typescript
// Source: packages/client/src/components/HexCell.test.tsx — ALL 7 tests assert raw rgba() fill strings:
// 'rgba(245,197,24,1)' (safe), 'rgba(255,140,0,1)' (risk), 'rgba(220,50,50,1)' (goal),
// 'rgba(59,130,246,1)' (kickoff), 'rgba(255,255,255,1)' (shot-path AND shot-path-action — same fill,
// differ only in opacity/stroke), plus the "undefined renders no tint" negative test that lists all 5.
// Every one of these 7 tests must migrate to asserting the semantic highlightType prop/token identity
// instead of the literal string value.

// Source: packages/client/src/components/HexGrid.test.tsx — literal constants + inline strings to migrate:
// line 93, 145, 176: const goalFill = 'rgba(220,50,50,1)';       (3 separate declarations, same value)
// line 62: p.getAttribute('fill') === 'rgba(255,140,0,1)'         (risk)
// line 418: c.getAttribute('stroke') === '#60a5fa'                (PieceOverlay selectable ring)
// line 433: c.getAttribute('stroke') === '#f97316'                (PieceOverlay activated ring)
// line 629: const KICKOFF_FILL = 'rgba(59,130,246,1)';
// line 630: const SAFE_FILL = 'rgba(245,197,24,1)';

// Source: packages/client/src/components/PieceOverlay.test.tsx — largest literal-assertion surface:
// stroke === '#60a5fa' (selectable), '#22c55e' (active AND moved-this-stage — same color today, the
// exact HILITE-03 defect being fixed), '#f97316' (activated ring + X path), '#dc2626' (offside),
// plus 4 tests asserting specific hardcoded team-identity colors are ABSENT ('#1a56b0', '#c0392b',
// '#9b59b6', '#db2777') from an earlier (already-completed) D-06 color refactor — these 4 do not need
// to change for Phase 33, they're validating a different, already-shipped migration.
```

## State of the Art

| Old Approach                                                                                                                       | Current Approach                                                                                                   | When Changed                        | Impact                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Per-component `useTeamAccentColor(teamId)` calls threaded into individual `style={{ color }}` props (GameBoard.tsx: 5+ call sites) | Single runtime `--team-accent` CSS variable set once per screen root, read via `var(--team-accent)` in CSS Modules | This phase (Phase 33, THEME-03)     | Removes per-component color-prop threading; one write, many reads via CSS cascade                                                    |
| Ad-hoc inline `<polygon fill="#literal">` siblings in `HexGrid.tsx`'s per-hex loop                                                 | All highlight colors flow through `HexCell`'s `highlightType`/ring props, backed by `HIGHLIGHT_STYLES`             | This phase (Phase 33, HILITE-01/02) | Zero hex/rgba literals left in `HexGrid.tsx`; single lookup table is the only place colors are defined                               |
| HEADER-phase-only gold ball-position overlay (`#f5c518`, inside the mutually-exclusive per-hex loop)                               | Phase-agnostic (all "response phases") white always-on-top standalone ball-location marker                         | This phase (Phase 33, HILITE-04)    | Marker no longer competes with/gets hidden by other highlight priority resolution; visible across headers AND kicks, not just HEADER |

**Deprecated/outdated:**

- The HEADER-only gold ball-position overlay at `HexGrid.tsx` lines 588-598 is fully superseded by the new ball-location marker and should be deleted, not kept alongside it.
- CONTEXT.md's D-02/D-05 "fallback" plans (keep goal-line red with minor tone tweak; keep orange-circle-plus-red-X for moved-this-stage) are explicitly secondary — the primary decisions (non-red shot color; grey ring+overlay treatment) are what to implement first per the user's own instructions.

## Assumptions Log

| #   | Claim                                                                                                                                                                                                                                                                                                                                                                                               | Section                                  | Risk if Wrong                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | GK_QUICK_THROW's green tint (`rgba(34,197,94,0.35)`) should likely be consolidated with the new `pass-target` type rather than kept as a 12th distinct type, since both represent "guaranteed-safe target, no interception risk"                                                                                                                                                                    | Code Examples / Common Pitfall 1         | Low — this is a naming/consolidation choice, reversible; worst case is one extra table row instead of a merge                                                                                                                                                                                                                        |
| A2  | The KICK_OFF_SETUP centre-hex "required" ring and the confirmed-pass-target ring can share one `ring: 'required' \| 'confirmed'` (or boolean) prop on `HexCell` rather than each needing a dedicated new `HexHighlightType` member                                                                                                                                                                  | Architecture Patterns / Pattern 2        | Low — both currently render identical gold styling; if a future need arises to visually distinguish them, splitting the prop later is a small, localized change                                                                                                                                                                      |
| A3  | The recommended reference-doc location `docs/HIGHLIGHT-REFERENCE.md` (sibling to `docs/ARCHITECTURE.md`) is appropriate — CONTEXT.md leaves the exact location/format to planning discretion                                                                                                                                                                                                        | Architecture Patterns / Pattern 3        | Low — purely organizational; easy to move if the planner prefers a different location (e.g. co-located `HexCell.tsx` comment block, as CONTEXT.md's Claude's Discretion note also allows)                                                                                                                                            |
| A4  | "Response phases (headers, kicks)" for the ball-location marker's visibility gate (HILITE-04) should include, at minimum, `HEADER`, `SNAPSHOT`, `SNAPSHOT_TARGET`, `SNAPSHOT_DEFLECT`, `GK_DIVE`, `SHOT`, `GK_RESTART`, `GK_QUICK_THROW`, `GK_KICK_TARGET`, `GK_KICK_MOVE` — inferred from the full `GamePhase` union and the requirement's own parenthetical examples, not confirmed with the user | Open Questions                           | Medium — too narrow a phase list means the marker is invisible in a phase where the user expected it (visually confusing "wait, where's the ball" moment); too broad means it appears during ordinary MOVE/PASS play, cluttering the standard turn. Recommend confirming the exact phase list at plan-check or execution checkpoint. |
| A5  | `PitchMarkings.tsx`'s 4 internal color literals (pitch-line white strokes) are out of scope for this phase — they represent static field/pitch decoration, not UI chrome or highlight/ring state                                                                                                                                                                                                    | Common Pitfalls (implicit, not itemized) | Low — if included, D-06/D-07's "chrome colors specifically (backgrounds, borders, text colors)" framing arguably doesn't cover pitch-line decor anyway; worst case is 4 extra literals remain, easily swept up in Phase 34 if needed                                                                                                 |

## Open Questions

1. **Does GK_QUICK_THROW's green tint merge with the new `pass-target` type, or stay distinct?**
   - What we know: both are green, both represent "guaranteed valid, no risk" — visually and semantically near-identical (`rgba(34,197,94,0.35)` vs `rgba(34,197,94,0.4)`, a rounding-level difference).
   - What's unclear: whether there's a reason (found only during implementation) to keep the throw target visually distinguishable from a normal pass target.
   - Recommendation: default to merging (one less table entry, closer to the "single source of truth" spirit of HILITE-01); split only if implementation surfaces a concrete need.

2. **Exact final `HexHighlightType` union membership and count.**
   - What we know: 7 existing + at least 3 clearly new (`gk-kick-target`, `pass-target`, `tackle-risk`) = 10 minimum. CONTEXT.md's "~13-14" estimate implies 3-4 more beyond the 4 explicitly named (GK-kick-target, pass-target, tackle-risk, ball-position) — but ball-position is explicitly NOT a `HexHighlightType` member per HILITE-04, so the ~13-14 count spans all three reference-doc categories (Pattern 3), not the union alone.
   - What's unclear: the precise final enum membership, since it depends on decisions 1 (merge or split GK_QUICK_THROW) and the `ring` prop question below.
   - Recommendation: the planner should treat the "Every ad-hoc HexGrid.tsx literal found in this audit" list (Code Examples section) as the authoritative checklist of literals-to-migrate, and let the exact type-count fall out of resolving items 1 and 3 below, rather than targeting a specific number.

3. **Does the centre-hex "required" marker and the confirmed-pass-target ring become `HexHighlightType` members, or a new independent `ring` prop on `HexCell`?**
   - What we know: both are currently additive overlays drawn on top of another already-resolved tint, not mutually-exclusive alternatives to it — architecturally they match `PieceOverlay`'s independent-ring pattern (Pattern 2), not the priority-ternary pattern.
   - What's unclear: whether the planner/implementer finds a simpler path by just adding two more `HexHighlightType` members and accepting that a hex might need to render twice (base `HexCell` for the tint, plus a second thin `HexCell`-like element for the ring) — functionally possible but architecturally messier.
   - Recommendation: use the independent-prop pattern (Pattern 2); it has a direct, already-tested precedent in this exact codebase.

4. **Exact phase list for ball-location-marker visibility (HILITE-04's "response phases (headers, kicks)").**
   - See Assumption A4. Recommend the planner confirm this list explicitly (either via a quick user check-in or by treating it as a documented judgment call in the plan) rather than leaving it implicit in code.

5. **BUG-23 resolution status after this phase's refactor.**
   - See Common Pitfall 3. Recommend an explicit manual verification step in the plan (reproduce SNAPSHOT_DEFLECT → goal → KICK_OFF_SETUP, confirm no stray shading) rather than assuming either "already fixed" or "still someone else's problem."

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | Vitest 2.1.9 + @testing-library/react 14.3.1, jsdom 25.0.0 environment                                                                                  |
| Config file        | `packages/client/vitest.config.ts` (`include: ['src/**/*.test.{ts,tsx}']`, `environment: 'jsdom'`)                                                      |
| Quick run command  | `pnpm --filter @counter-attack/client test -- HexCell.test.tsx` (or `PieceOverlay.test.tsx` / `HexGrid.test.tsx`, scoped to the file under active edit) |
| Full suite command | `pnpm --filter @counter-attack/client test` (or root `pnpm test` to also run shared/server suites)                                                      |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                                    | Test Type                                                                                                                 | Automated Command                                                                     | File Exists?                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| THEME-03  | `--team-accent` CSS var derived from `TEAM_CONFIGS.palette.uiColor`, single runtime source  | unit (React render + computed-style/inline-style assertion)                                                               | `pnpm --filter @counter-attack/client test -- GameBoard.test.tsx`                     | ✅ existing file, needs new assertions — Wave 0 gap: no current test asserts a `--team-accent` CSS variable exists anywhere                |
| HILITE-01 | `HIGHLIGHT_STYLES` covers all ~13-14 real highlight cases, no `HexGrid.tsx` literals remain | unit (render each `highlightType`, assert token/prop identity) + static grep check                                        | `pnpm --filter @counter-attack/client test -- HexCell.test.tsx`                       | ✅ existing file, needs new type coverage — 7 of ~11-13 union members already tested                                                       |
| HILITE-02 | Red = exactly one meaning (offside); goal-target uses a distinct non-red color              | unit (assert goal-target fill ≠ offside-ring stroke color; assert exactly one `#dc2626`-equivalent semantic use app-wide) | `pnpm --filter @counter-attack/client test -- HexCell.test.tsx PieceOverlay.test.tsx` | ✅ existing files                                                                                                                          |
| HILITE-03 | Selected ring vs. moved-this-stage ring are visually distinct                               | unit (assert ring stroke colors differ; assert grey-treatment fill/overlay present)                                       | `pnpm --filter @counter-attack/client test -- PieceOverlay.test.tsx`                  | ✅ existing file — current test (line 304) already asserts moved-this-stage is `#22c55e`; this assertion is the exact one that must change |
| HILITE-04 | Ball-location marker: standalone, always-on-top, white hex-edge, correct phase gating       | unit (new component test)                                                                                                 | `pnpm --filter @counter-attack/client test -- BallLocationRing.test.tsx` (new file)   | ❌ Wave 0 gap — new component, new test file needed                                                                                        |
| HILITE-05 | Single reference document exists and covers all types                                       | manual/documentation check (not automatable via Vitest)                                                                   | N/A — file-existence + content review                                                 | ❌ Wave 0 gap — `docs/HIGHLIGHT-REFERENCE.md` does not exist yet                                                                           |

### Sampling Rate

- **Per task commit:** scoped Vitest run on the file(s) touched (`HexCell.test.tsx`, `PieceOverlay.test.tsx`, `HexGrid.test.tsx`, or the new `BallLocationRing.test.tsx`)
- **Per wave merge:** `pnpm --filter @counter-attack/client test` (full client suite — this phase touches no server/shared code, so scoping to the client package is sufficient; confirm no shared-package color constants are affected)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the manual BUG-23 repro check (Pitfall 3) and a manual visual pass confirming Phase 34 will be a pure value-swap (no remaining literals findable via `grep -rn "#[0-9a-fA-F]\{3,8\}\|rgba" packages/client/src/components` outside of intentionally-excluded files like `PitchMarkings.tsx`/`GoalNets.tsx`, test files, and the `UNIFORM_STYLES` jersey-pattern renderer which is a separate, already-reviewed system)

### Wave 0 Gaps

- [ ] `docs/HIGHLIGHT-REFERENCE.md` — new reference doc (HILITE-05), does not exist
- [ ] `packages/client/src/components/BallLocationRing.test.tsx` (or equivalent name) — new component + test, does not exist
- [ ] `packages/client/src/styles/tokens.css` — new token file, does not exist; `packages/client/src/styles/` currently only contains `uniformStyles.tsx`
- [ ] No existing test currently asserts presence/value of any `--color-*` or `--team-accent` CSS custom property anywhere in the client package (confirmed via search — zero matches for `--team-accent`, `:root`, or `--color-` in `packages/client/src`) — new assertions needed once the token file exists

_(Framework itself is already fully installed and configured — no `pnpm add` or config changes needed, only new test files/assertions.)_

## Security Domain

This phase has no meaningful security surface: it is a pure client-side CSS/color/rendering refactor. No new user input, no new network calls, no new authentication/session/authorization logic, no cryptography, no data persistence changes.

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                              |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | No      | Unaffected — no auth logic touched                                                                                                                                            |
| V3 Session Management | No      | Unaffected — no session logic touched                                                                                                                                         |
| V4 Access Control     | No      | Unaffected — highlight/ring visibility is a rendering concern derived from already-authorized `GameState`, not a new access boundary                                          |
| V5 Input Validation   | No      | No new user input introduced; color values are either static token literals or derived from server-authoritative `TEAM_CONFIGS`/`GameState`, never from unsanitized user text |
| V6 Cryptography       | No      | Unaffected                                                                                                                                                                    |

### Known Threat Patterns for this stack

None applicable. There is no injection surface here — CSS custom-property values in this phase are all developer-authored literals or derived from a closed, typed `TeamId` enum (`TEAM_CONFIGS[teamId]`), never from free-form user input, so there is no CSS-injection or XSS vector introduced by this phase's `--team-accent`/token work.

## Sources

### Primary (HIGH confidence)

- `packages/client/src/components/HexCell.tsx`, `HexGrid.tsx`, `PieceOverlay.tsx`, `BallMarker.tsx` — direct source read, full file, this session
- `packages/client/src/components/HexCell.test.tsx`, `HexGrid.test.tsx`, `PieceOverlay.test.tsx` — direct source read, this session
- `packages/client/src/components/*.module.css` (all 15 files) + `App.module.css` — grepped for literal color counts, this session
- `packages/client/src/hooks/useTeamColors.ts`, `App.tsx`, `GameBoard.tsx` — direct source read, this session
- `packages/client/package.json`, `vite.config.ts`, `vitest.config.ts` — direct source read, confirms exact installed versions and test setup
- `.planning/phases/33-design-tokens-highlight-standardization/33-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — direct source read, this session (user decisions and project history)
- `.planning/todos/pending/2026-07-02-bug-kickoff-setup-persistent-light-shading-on-shot-path-hexes.md` + `git log -S` confirming commit `32c71d2` already applied the todo's suggested fix — direct source read + git history, this session

### Secondary (MEDIUM confidence)

- [How to Create CSS Custom Properties That Dynamically Update with React & JavaScript](https://spacejelly.dev/posts/how-to-create-css-custom-properties-that-dynamically-update-with-react-javascript) — WebSearch, corroborates the inline-style CSS-variable injection pattern recommended in Architecture Pattern 4
- [TypeScript and React: Styles and CSS](https://fettblog.eu/typescript-react/styles/) — WebSearch, corroborates `as React.CSSProperties` cast convention for custom-property keys in inline styles

### Tertiary (LOW confidence)

- None — this research relied on direct codebase inspection for nearly every claim; no unverified web-only claims were carried into the recommendations above.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new libraries; existing versions confirmed directly from `package.json`
- Architecture: HIGH — every pattern recommendation cites a specific existing file/line already proven in this codebase (PieceOverlay's ring pattern), not a hypothetical
- Pitfalls: HIGH for the literal-audit pitfalls (directly observed via grep/read); MEDIUM for the BUG-23 speculation (Pitfall 3) since the actual root cause was never confirmed by prior phases, only the belt-and-suspenders symptom-guards were

**Research date:** 2026-07-25
**Valid until:** 2026-08-24 (30 days — this is an internal-codebase audit with no external-ecosystem drift risk; the only staleness risk is if Phase 34 or another concurrent workstream changes these same files before Phase 33 executes)
