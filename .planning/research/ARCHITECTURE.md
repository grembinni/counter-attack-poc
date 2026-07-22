# Architecture Research

**Domain:** Visual/UX refresh + code cleanup on an existing React/Zustand + Node/Socket.io hex-grid game client (Counter Attack Web, v1.5 milestone)
**Researched:** 2026-07-22
**Confidence:** HIGH — findings are based on direct inspection of the current repository (`packages/client/src/**`, `packages/shared/src/teamConfig.ts`), not general ecosystem docs. This is an internal-architecture question specific to conventions already established in this codebase, not a general "what does the ecosystem look like" question — codebase inspection is the authoritative source here.

> Note: This file supersedes the v1 architecture research previously written to this path (hex coordinate system, Socket.io protocol, room lifecycle, AWS deployment). Those decisions are already built and unaffected by this milestone; this document covers the v1.5 visual/UX refresh + cleanup question only. See git history for the prior v1 content if needed.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CHROME THEME LAYER (NEW)                          │
│  packages/client/src/styles/tokens.css  — :root CSS custom properties     │
│  (panel bg, button bg/hover, borders, text tiers, status colors)          │
├──────────────────────────────┬─────────────────────────────────────────────┤
│  index.css (imports tokens)  │  17× *.module.css files consume var(--x)   │
│                               │  (ActionPanel, ActionLog, GameBoard, ...)  │
├──────────────────────────────┴─────────────────────────────────────────────┤
│                    DOMAIN COLOR-CODING LAYER (existing, unchanged)         │
│  ┌────────────────────────────┐   ┌──────────────────────────────────┐   │
│  │ HIGHLIGHT_STYLES             │   │ TEAM_CONFIGS                     │   │
│  │ (HexCell.tsx)                │   │ (packages/shared/teamConfig.ts) │   │
│  │ semantic hex-tint lookup     │   │ 12-team 7-field palette registry │   │
│  └──────────────┬───────────────┘   └───────────────┬───────────────────┘   │
│                 │ consumed by                        │ consumed by         │
│         HexGrid.tsx priority ternary          GameBoard / ActionLog /      │
│         → HexCell.tsx                          PlayerStatsPanel /          │
│                                                 PieceOverlay / Team/        │
│                                                 UniformSelectionScreen      │
├──────────────────────────────────────────────────────────────────────────┤
│                         ZUSTAND STATE LAYER                                │
│  useGameStore (per-slice selectors) → HexGrid / ActionPanel / GameBoard   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component                                               | Responsibility                                                                                                                     | Typical Implementation                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `styles/tokens.css` (NEW)                               | Single source of truth for **UI-chrome** colors (panel/button/border/text/status)                                                  | `:root { --panel-bg: #16213e; --accent-gold: #f5c518; ... }` imported once from `index.css`  |
| `*.module.css` (17 files, MODIFIED)                     | Component-scoped layout + chrome styling                                                                                           | Reference tokens via `background: var(--panel-bg)` instead of hardcoded hex                  |
| `HexCell.tsx` — `HIGHLIGHT_STYLES` / `HexHighlightType` | Single source of truth for **hex-tint semantics** (safe/risk/goal/kickoff/shot-path/header-target)                                 | `Record<HexHighlightType, {fill, opacity, stroke}>` lookup table, already established (D-10) |
| `HexGrid.tsx`                                           | Derives per-hex boolean flags each render, resolves them into **one** `HexHighlightType` via priority ternary, passes to `HexCell` | `risk > goal > shot-path(-action) > kickoff > safe` cascade (lines ~480-496)                 |
| `TEAM_CONFIGS` (`packages/shared/src/teamConfig.ts`)    | Single source of truth for **team identity** colors (12 teams × 7-field `TeamPalette`)                                             | `Record<TeamId, TeamConfig>`, consumed directly (not via CSS) by 6+ components               |
| `useGameStore` (Zustand)                                | Client game/UI state, one flat store, consumed via per-field selectors                                                             | `useGameStore((s) => s.gameState.X)` — avoids whole-store re-renders                         |

## Recommended Project Structure

```
packages/client/src/
├── styles/
│   ├── tokens.css            # NEW — chrome design tokens (:root CSS custom properties)
│   └── uniformStyles.tsx     # EXISTING, unrelated — jersey pattern renderers (do not merge with tokens.css)
├── index.css                 # MODIFIED — @import './styles/tokens.css'
├── components/
│   ├── HexCell.tsx           # MODIFIED — HIGHLIGHT_STYLES gains 'ball-location'; HexHighlightType union updated
│   ├── HexCell.test.tsx      # MODIFIED — new assertions for 'ball-location'; recommend refactor of existing
│   │                          #   literal-string color assertions to import HIGHLIGHT_STYLES (see Anti-Pattern 2)
│   ├── HexGrid.tsx            # MODIFIED — remove duplicated ad-hoc gold overlay blocks (centre-hex ring,
│   │                          #   HEADER ball-position ring), replace with single ball-location mechanism
│   ├── GameBoard.tsx          # MODIFIED (cleanup track) — extract repeated
│   │                          #   `TEAM_CONFIGS[selectedTeams[team]].palette.uiColor` lookups (8 call sites)
│   ├── *.module.css (×17)     # MODIFIED — replace hardcoded hex literals with var(--token) references
│   └── ... (all other components unchanged for theme track)
└── store/
    └── useGameStore.ts        # MODIFIED (cleanup track) — remove dead `shootTargetHex` field (set, never read)
```

### Structure Rationale

- **`styles/tokens.css` is new and deliberately separate from `styles/uniformStyles.tsx`.** Uniform styles are jersey-pattern _renderers_ (SVG pattern defs) keyed by `UniformStyleId` — a different concern from app-chrome color tokens. Do not conflate the two files or the two concepts.
- **CSS custom properties, not a new TS constants module, for the chrome layer.** Unlike `HIGHLIGHT_STYLES`/`TEAM_CONFIGS` (which are consumed as literal string values inside SVG `fill=`/inline-style attributes computed in render logic), the ~300+ colors scattered across the 17 `*.module.css` files are pure CSS declarations (`background:`, `color:`, `border:`) with no JS branching. CSS custom properties are the natural, zero-runtime-cost mechanism here — one edit to `tokens.css` recolors every consuming class with no React re-render and no bundle-size cost. Introducing a parallel TS module (`CHROME_COLORS = {...}`) and threading it through `style={{ background: CHROME_COLORS.panel }}` on every one of these components would touch far more files than the CSS-var approach and would fight CSS Modules' existing scoping.
- **`HIGHLIGHT_STYLES` and `TEAM_CONFIGS` are explicitly NOT folded into the new token layer.** They already are correctly-scoped single-source-of-truth modules for two different domains: HIGHLIGHT_STYLES encodes _game-state semantics_ (this hex means danger/goal/safe), TEAM_CONFIGS encodes _real-world team identity_ (Man City wears sky blue). Neither is a "theme" in the reskinning sense — changing the app's visual theme should never change what "risk" means or what color a real team's kit is. Keep these two axes orthogonal. (See Anti-Pattern 1.)

## Architectural Patterns

### Pattern 1: Two-tier color source of truth (chrome tokens vs. domain-semantic constants)

**What:** Two independent, non-overlapping color authorities:

1. `styles/tokens.css` — CSS custom properties for **UI chrome** (panels, buttons, borders, body text, generic status colors like error/warning/success).
2. `HIGHLIGHT_STYLES` (`HexCell.tsx`) and `TEAM_CONFIGS` (`packages/shared/src/teamConfig.ts`) — TS constant modules for **domain color-coding** (hex-tint semantics, team kit identity), already correctly centralized.

**When to use:** Route any new "make the app look different" work through tier 1. Route any new "this hex/piece needs to communicate game state" work through tier 2 — extend the existing lookup tables, don't invent new inline colors.

**Trade-offs:** Two authorities instead of one is slightly more cognitive overhead than a single global palette, but prevents a real regression risk: a naive "replace all hardcoded hex with tokens" refactor would otherwise start rewriting `TEAM_CONFIGS.city.palette.homePrime = '#C62045'` into a themeable token — which is wrong, because that color is not a UI preference, it's Man City's actual kit color and must stay stable regardless of app theme.

**Example (today, ungrounded — what NOT to do):**

```css
/* ActionPanel.module.css today */
.ctaButton {
  background: #0f3460;
} /* chrome — SHOULD become var(--btn-bg) */
```

```ts
// teamConfig.ts today — must NOT become var(--team-city-prime)
homePrime: '#C62045',   // this is Man City's kit color, not a theme choice
```

### Pattern 2: Priority-ternary highlight resolution (existing, HexGrid.tsx)

**What:** `HexGrid.tsx` computes many independent booleans per hex per render (`isRisk`, `isGoalTint`, `isShotPathActionTint`, `isShotPathTint`, `isKickoffTint`, `isSafeTint`, ...) and resolves them into exactly one `HexHighlightType` via a single nested ternary (lines ~480-496), which `HexCell.tsx` looks up in `HIGHLIGHT_STYLES` to render one overlay `<polygon>`.

**When to use:** Extending this pattern for hex-highlight standardization (e.g. adding `'ball-location'`) means: (1) add the new key to `HexHighlightType` and `HIGHLIGHT_STYLES` in `HexCell.tsx`, (2) add a new boolean derivation in `HexGrid.tsx`, (3) insert it at the correct priority tier in the ternary.

**Trade-offs:** Because only **one** `HexHighlightType` can win per hex, this pattern is _mutually exclusive by design_. It is the wrong pattern for anything that must render simultaneously with other rings/tints regardless of state — see Pattern 3 and the ball-location note below.

**Example:**

```ts
const highlightType: HexHighlightType | undefined = isHeaderNonGoalTarget
  ? 'header-target'
  : isRisk
    ? 'risk'
    : isGoalTint
      ? 'goal'
      : // ... insert new tiers here, in priority order
        isSafeTint
        ? 'safe'
        : undefined;
```

### Pattern 3: Independent boolean-driven overlay layer (existing, PieceOverlay.tsx)

**What:** `PieceOverlay.tsx` renders `isOffside` and `isMovedThisStage` as **separate, independently-toggleable ring layers** at distinct radii (`PIECE_RADIUS + 6`, `PIECE_RADIUS + 8`), explicitly _not_ folded into the mutually-exclusive `selectionState` switch — the doc comment states this is intentional so a piece can be simultaneously offside AND selectable/active/activated.

**When to use:** For any highlight/marker that must be visible **regardless of** whatever the mutually-exclusive `highlightType` currently is on that hex.

**Trade-offs / why this matters for "ball-location":** `HexGrid.tsx` today already implements exactly this "must always be visible" requirement for the ball's location — but as **ad-hoc, duplicated inline polygons**, not through `HIGHLIGHT_STYLES`:

- Lines ~569-578: centre-kickoff-hex gold fill (`#f5c518`, 0.5 opacity) + 2px gold ring, rendered unconditionally during `KICK_OFF_SETUP`.
- Lines ~589-599: near-identical gold fill + 2px gold ring on the ball's hex during `HEADER` phase.

These two blocks are rendered as **sibling `<polygon>` elements after `HexCell`** in the same `<g>` — i.e., they already sit _outside_ the mutually-exclusive `highlightType` ternary and are composited on top of whatever tint `HexCell` applied. This is functionally identical to the `PieceOverlay` offside-ring pattern, just not yet extracted into a shared constant.

**Recommendation:** Do not fold "ball-location" into the single-value `HexHighlightType` ternary as a drop-in replacement — doing so would remove the "always composited on top" behavior these two call sites currently rely on (only one `HexHighlightType`'s polygon renders per hex; a ball-location entry competing in the ternary could be _hidden_ by a higher-priority tint like `risk` or `goal`, which is a real functional regression from today's "always visible" behavior). Instead:

1. Add `'ball-location'` to `HIGHLIGHT_STYLES` as the canonical color definition (gold, matching the existing `#f5c518` convention — see collision note below), so the color itself has one source of truth.
2. Render it as an **independent additive layer** in `HexGrid.tsx` (mirroring `isOffside`/`isMovedThisStage`), consuming `HIGHLIGHT_STYLES['ball-location']` for its fill/stroke, replacing both duplicated ad-hoc blocks with one shared render call.
3. This satisfies "standardize hex highlights through the single-source-of-truth table" (the stated goal) without regressing the always-on-top compositing the two existing call sites depend on.

**Resolving the red/red collision:** `HIGHLIGHT_STYLES.goal` is already `rgba(220,50,50,1)` (red) and is reused for the shot-declaration target hex (`isShotTarget`). If "ball-location" were naively assigned red too (a common instinct — "the ball is the most important marker, make it red"), it would collide semantically and visually with `goal`/danger tints. The codebase already has an established, unclaimed convention for "this is a fixed point of interest, not danger" — **gold (`#f5c518`)**, currently used ad hoc for the centre kickoff hex and the HEADER ball-position hex. Standardizing `HIGHLIGHT_STYLES['ball-location']` on that existing gold, rather than introducing red, resolves the collision by reusing an already-established, already-correct convention instead of inventing a new one.

## Data Flow

### Request Flow (design-token edit)

```
Design change requested (e.g. "make panels darker")
    ↓
Edit one CSS custom property in styles/tokens.css
    ↓
Browser cascade — zero React re-render, zero JS involved
    ↓
Every *.module.css class referencing var(--panel-bg) repaints
```

### Request Flow (hex-highlight change)

```
Highlight change requested (e.g. "add ball-location marker")
    ↓
HIGHLIGHT_STYLES + HexHighlightType updated in HexCell.tsx (source of truth)
    ↓
HexGrid.tsx derives the new boolean + renders the independent overlay layer
    ↓
HexCell.test.tsx assertions updated to match (tests hold literal color strings, see Anti-Pattern 2)
```

### State Management

```
useGameStore (Zustand, one flat store)
    ↓ (per-field selector: useGameStore((s) => s.gameState.X))
Components (HexGrid, GameBoard, ActionPanel, ...)
    ↔ (actions call socket.emit(...) then set({...}) optimistically)
Server broadcast → setGameState(newState) → store update → selective re-render
```

### Key Data Flows

1. **Team color resolution (duplicated today):** `TEAM_CONFIGS[selectedTeams[team]].palette.uiColor` is looked up independently in at least 4 places in `GameBoard.tsx` alone (lines ~179, ~201, ~208, ~210, plus 6 more inline `style={{color: ...}}` calls at ~271/311/354/383/409/425), and again separately in `ActionLog.tsx` (via its own `pieceColorOf` helper), `PlayerStatsPanel.tsx`, and `PieceOverlay.tsx`/`HexGrid.tsx` (via the `resolvedPalette` jersey-swap logic). This is not itself a color-scheme problem, but it is exactly the kind of "N places to touch for one change" cruft the cleanup track should target — extracting a single `useTeamColor(team)` selector/hook would reduce 8+ call sites in `GameBoard.tsx` alone to one shared derivation.
2. **`myTeam` derivation (duplicated, lower-priority):** `playerSlot === 1 ? 'home' : 'away'` (or its 3-way null-safe variant) is independently re-derived in `HexGrid.tsx`, `GameBoard.tsx`, `FreeKickSetupPanel.tsx`, `KickOffSetupPanel.tsx`, and 7 branches inside `useGameStore.ts` itself. A shared `getMyTeam(playerSlot)` utility would remove this duplication; low risk, low priority relative to the color-scheme work but a good "same PR" companion for the cleanup track since it touches the same files.
3. **Dead state slice:** `useGameStore`'s `shootTargetHex` field (declared in the `GameStore` type, initialized to `null`, and set to `null` in two places) is **never read** by any selector anywhere in the codebase — confirmed via full-repo grep. The actual shot-target highlight state lives in `gameState.shotTargetHex` (server-authoritative field, distinct name) and a local `useState` in `HexGrid.tsx` (`shotTargetHighlight`, optimistic). `shootTargetHex` in the store is a leftover from an earlier design and is safe to delete outright. This is exactly the kind of cruft ESLint's `no-unused-vars` cannot catch (it's an object property assigned within the same file, not an unused local variable) — see Anti-Pattern 4 for tooling recommendation.

## Scaling Considerations

Reframed for a codebase-scale (not user-scale) concern, since this research question is about maintainability under future growth, not concurrent players:

| Scale                                                                     | Architecture Adjustments                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current (17 CSS modules, 2 domain-color registries, 1 flat Zustand store) | Two-tier token/constant split (Pattern 1) is sufficient; no build tooling needed beyond CSS custom properties.                                                                                                                                                                                                                                |
| Growth to multiple visual themes (e.g. "classic" vs "dark" board skin)    | `tokens.css` can be split into a base `:root` + theme-override blocks selected via a `data-theme` attribute on `<html>`/`<body>`; still zero-JS-cost. Do **not** attempt to theme `TEAM_CONFIGS`/`HIGHLIGHT_STYLES` this way — those stay theme-invariant.                                                                                    |
| Growth to many more `HexHighlightType` values (>10-12)                    | The single nested ternary in `HexGrid.tsx` becomes hard to read at that size; consider promoting it to an ordered `PRIORITY_ORDER: HexHighlightType[]` array + `.find()` resolution instead of a hand-written ternary — same semantics, easier to extend without re-reading the whole cascade. Not needed yet at today's 7 types + 1 new one. |

### Scaling Priorities

1. **First bottleneck:** The nested priority ternary in `HexGrid.tsx` — already large (7 tiers) and about to grow by one. Watch for it becoming unreadable past ~10 tiers; refactor to an ordered-array `.find()` at that point, not before.
2. **Second bottleneck:** Duplicated `TEAM_CONFIGS[...].palette.uiColor` lookups (currently 8+ call sites in `GameBoard.tsx` alone). Not urgent, but every new component that needs a team color will otherwise copy the same 1-line lookup pattern again — extract once during this cleanup pass rather than letting it reach 15+ call sites.

## Anti-Patterns

### Anti-Pattern 1: Conflating chrome theming with domain color-coding

**What people do:** Reach for a single global "replace every hex color with a CSS variable" pass across the entire `src/` tree, including `teamConfig.ts` and `HIGHLIGHT_STYLES`.
**Why it's wrong:** `TEAM_CONFIGS` colors are real-world team kit identities (Man City's `#C62045` is not a design preference); `HIGHLIGHT_STYLES` colors are game-state semantics (red = danger) that must stay stable across any app-chrome reskin. Blending these into the new token layer either breaks visual correctness (a "theme change" recoloring a team's actual kit) or makes the token layer meaningless (per-team CSS variables that only ever have one legitimate value).
**Do this instead:** Keep the two-tier split (Pattern 1). Only touch `*.module.css` chrome colors during this milestone; leave `teamConfig.ts` and `HIGHLIGHT_STYLES`'s _existing_ values untouched (only add the new `ball-location` entry there, per the standardization ask).

### Anti-Pattern 2: Literal-string color assertions in tests instead of importing the source-of-truth constant

**What people do:** `HexCell.test.tsx` and `PieceOverlay.test.tsx` assert exact hex/rgba **string literals** (e.g. `expect(fills).toContain('rgba(245,197,24,1)')`, `expect(ringCircles[0]!.getAttribute('stroke')).toBe('#60a5fa')`) instead of importing `HIGHLIGHT_STYLES`/ring-color constants and asserting against those.
**Why it's wrong:** Any _intentional_ palette tweak to `HIGHLIGHT_STYLES` (or a hypothetical future extraction of `PieceOverlay`'s ring colors into a shared constant) will fail these tests even though nothing is actually broken — the tests encode the current values as if they were the requirement, rather than testing that the component correctly reads whatever the source of truth says. This directly threatens the "not break any currently-passing tests that assert on specific colors" constraint: the safest fix is not to avoid ever changing a color, but to stop hardcoding colors as literals in test expectations.
**Do this instead:** When touching `HIGHLIGHT_STYLES` for the ball-location work, take the opportunity to refactor `HexCell.test.tsx` to `import { HIGHLIGHT_STYLES } from './HexCell.js'` and assert `HIGHLIGHT_STYLES.safe.fill` etc., so future palette-only changes (chrome or semantic) don't require touching test files at all — only genuinely new _behavior_ should require test changes.

### Anti-Pattern 3: Ad-hoc inline overlay polygons duplicating a color that should live in the single-source-of-truth table

**What people do:** `HexGrid.tsx` lines ~569-578 and ~589-599 each hardcode `fill="#f5c518"` / `stroke="#f5c518"` inline, independently, for two conceptually-identical "mark this hex specially" overlays (centre kick-off hex, ball position during HEADER).
**Why it's wrong:** Two independent inline literals for the same semantic color is exactly the kind of drift that makes a future "change this gold to something else" request require hunting through render logic instead of editing one table entry — the opposite of the single-source-of-truth pattern the rest of the file (`HIGHLIGHT_STYLES`) already correctly follows.
**Do this instead:** Fold both into the new `HIGHLIGHT_STYLES['ball-location']` entry, rendered once via the independent-overlay-layer pattern (Pattern 3), not two separate inline blocks.

### Anti-Pattern 4: Relying on ESLint's `no-unused-vars` to catch all dead state

**What people do:** Assume `@typescript-eslint/no-unused-vars` (already configured in `eslint.config.js`) will surface dead code during cleanup.
**Why it's wrong:** It caught nothing for `useGameStore`'s `shootTargetHex` — the field is _assigned_ within the same file (`set({ shootTargetHex: null })`), so from ESLint's perspective it's "used." Detecting that no _selector anywhere in the codebase reads_ `s.shootTargetHex` requires either a manual cross-file grep (as done for this research) or a dedicated dead-export/dead-property tool. No such tool (`knip`, `ts-prune`, `depcheck`) is currently installed in this repo (checked: not present in root `package.json`).
**Do this instead:** For the cleanup track's Zustand review, either (a) do a manual `grep -rn "s\.<field>" packages/client/src` sweep per store field before the phase, or (b) add `knip` as a one-time (or CI-gated) dev-dependency to systematically flag unused exports/store fields across `packages/client` and `packages/shared` before hand-editing.

## Integration Points

### External Services

Not applicable — this is a purely internal client-side refactor. Socket.io event contracts (`ClientEvents`/server broadcast shape) are untouched by either the theme work or the cleanup track; no server-side changes are required for this milestone.

### Internal Boundaries

| Boundary                                                                                                                                                                                          | Communication                                            | Notes                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `styles/tokens.css` ↔ 17× `*.module.css`                                                                                                                                                          | CSS custom-property cascade (`var(--x)`), no JS          | New boundary. Zero runtime cost; must be introduced before any component restyling touches these files, or restyling work will re-introduce hardcoded hex that then needs a second pass.            |
| `index.css` ↔ `styles/tokens.css`                                                                                                                                                                 | `@import` (or a single merged file)                      | `index.css` today has only 3 lines (box-sizing reset) — trivial to extend.                                                                                                                          |
| `HIGHLIGHT_STYLES`/`HexHighlightType` (`HexCell.tsx`) ↔ `HexGrid.tsx`                                                                                                                             | Direct TS import of the type + lookup table              | Existing boundary; extend, don't replace. `HexGrid.tsx` owns _when_ a type applies; `HexCell.tsx` owns _what color_ it renders as — keep that split intact when adding `ball-location`.             |
| `TEAM_CONFIGS` (`packages/shared/src/teamConfig.ts`) ↔ `GameBoard.tsx` / `ActionLog.tsx` / `PlayerStatsPanel.tsx` / `PieceOverlay.tsx` / `TeamSelectionScreen.tsx` / `UniformSelectionScreen.tsx` | Direct import, ad hoc per-call-site `.palette.X` lookups | Existing boundary, unaffected by the theme work. Candidate for a `useTeamColor()` extraction during the cleanup track (not required for the color-scheme overhaul itself).                          |
| `useGameStore` ↔ all components                                                                                                                                                                   | Zustand per-field selector hooks                         | Existing boundary; the cleanup track's job here is _subtractive_ (remove dead fields like `shootTargetHex`), not structural — do not introduce new store-access patterns as part of this milestone. |

## Suggested Build/Phase Order for This Overhaul

1. **Phase 1 — Design-token foundation (must come first, blocking).** Create `packages/client/src/styles/tokens.css` with `:root` custom properties covering every distinct chrome color currently hardcoded across the 17 `*.module.css` files (panel backgrounds, button bg/hover/disabled, borders, text tiers, and the semantic status colors — note today's 3 near-duplicate oranges, `#f39c12`/`#e67e22`/`#f97316`, used for similar-but-not-identical purposes across `ActionPanel.module.css` and elsewhere, need a deliberate decision on whether to consolidate to one token or keep as distinct tokens with different names). Import it from `index.css`. **No component restyling should happen before this phase lands** — any restyling done first would either hardcode new literals (creating more of the same cruft) or would need to be redone once tokens exist.
2. **Phase 2 — Component restyling (mechanical, file-by-file).** Sweep the 17 `*.module.css` files, replacing hardcoded hex with the Phase 1 tokens. This is safe to parallelize by file since CSS Modules are already scoped per-component; no shared state risk. Do **not** touch `teamConfig.ts` or `HIGHLIGHT_STYLES` in this phase (Anti-Pattern 1).
3. **Phase 3 — Hex-highlight standardization (`ball-location`, red/red collision).** Independent of Phases 1-2 (different color axis — see Pattern 1) and can run in parallel or immediately after. Scope: `HexCell.tsx` (`HIGHLIGHT_STYLES`/`HexHighlightType` + test refactor per Anti-Pattern 2), `HexGrid.tsx` (remove duplicated ad-hoc gold overlays, add the independent ball-location layer per Pattern 3), `HexCell.test.tsx` (new + refactored assertions).
4. **Phase 4 — Code cleanup track, ordered shared → server → client (per pnpm workspace topology, which `pnpm -r build`/`test`/`typecheck` already respects automatically).** Within `packages/shared`, confirm no exports are dead using a manual grep sweep or `knip` (Anti-Pattern 4) before deleting anything — `shared` has the widest blast radius since both `server` and `client` import from it. Then `packages/server` (pure `gameEngine.ts`/`draftEngine.ts` modules — no socket/io imports, so cleanup here is low-risk and independently testable). Then `packages/client`: remove `useGameStore`'s dead `shootTargetHex` field, and optionally extract the duplicated `TEAM_CONFIGS[...].palette.uiColor` lookups (`GameBoard.tsx`, 8+ call sites) and the duplicated `myTeam` derivation into shared helpers. Run `pnpm typecheck && pnpm -r test` after each package, not just once at the end, so a bad deletion in `shared` is caught before it cascades into `server`/`client` failures that are harder to attribute.
5. **Sequencing between the tracks:** Phases 1-3 (visual) and Phase 4 (cleanup) touch almost entirely disjoint files (`*.module.css`/`HexCell.tsx`/`HexGrid.tsx` vs. `useGameStore.ts`/`teamConfig.ts` call sites), so they can be done in either order or interleaved across separate PRs/phases without much conflict risk — but Phase 1 must precede Phase 2 regardless of where Phase 4 falls, since Phase 2's mechanical sweep is worthless if done before tokens exist.

## Sources

- Direct repository inspection (ground truth, HIGH confidence): `packages/client/src/components/HexCell.tsx`, `HexGrid.tsx`, `PieceOverlay.tsx`, `GameBoard.tsx`, `ActionPanel.tsx`, `ActionLog.tsx`, `PlayerStatsPanel.tsx`; `packages/client/src/store/useGameStore.ts`; `packages/shared/src/teamConfig.ts`; all 17 `*.module.css` files under `packages/client/src/components/`; `packages/client/src/index.css`, `App.module.css`; `packages/client/src/components/HexCell.test.tsx`, `HexGrid.test.tsx`, `PieceOverlay.test.tsx`; root `package.json`, `pnpm-workspace.yaml`, `eslint.config.js`.
- No external/web sources were consulted — this question is scoped to conventions already established in this specific codebase, not general ecosystem practice, so codebase inspection is the authoritative source.

---

_Architecture research for: Counter Attack Web — v1.5 visual/UX refresh + code cleanup milestone_
_Researched: 2026-07-22_
