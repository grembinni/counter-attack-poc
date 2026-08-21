# Stack Research

**Domain:** Real-time hex-grid football strategy game — v1.7 UI/UX consistency + substitution rework + match summary (feature milestone on an existing shipped codebase)
**Researched:** 2026-08-21
**Confidence:** HIGH

## Bottom Line

**No new npm dependencies are needed for any of the six v1.7 features.** Every capability requested — the referee-leniency override, unified card/injury iconography, an Advanced collapsible drawer, the substitution UX overhaul, the tackle/steal decline-and-re-prompt toggle, and the match-summary/xG popup — is a straightforward extension of patterns _already implemented and installed_ in this codebase. This was confirmed by direct inspection of `packages/client/package.json`, `packages/server/package.json`, `packages/shared/package.json`, and the relevant existing components (see Evidence below), not by assumption.

## Recommended Stack (unchanged)

### Core Technologies — already installed, no action needed

| Technology                   | Version (installed) | Purpose       | Why it already covers v1.7                                                                                                                                                              |
| ---------------------------- | ------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React                        | 18.3.1              | UI components | All 6 features are ordinary component/state work — new components, new state fields, no new rendering paradigm                                                                          |
| Zustand                      | 4.5.7               | Client state  | New slices (`refereeLeniencyOverride`, `tackleDeclinePrompt`, substitution-mode UI state, match-stats derived selectors) fit the existing per-slice-selector pattern used throughout    |
| Socket.io / socket.io-client | 4.8.3               | Realtime sync | No new event categories needed beyond the existing full-snapshot-broadcast pattern; leniency override, decline toggle, and match-stats fields ride in the existing `GameState` snapshot |
| TypeScript                   | project-wide        | Types         | Shared types extend existing unions (e.g. `SubstitutionMode`, `TackleDeclineState`) — same pattern as `STOPPAGE_PHASES`/`BenchEntry` from v1.6                                          |
| Inline SVG (no Canvas)       | —                   | Rendering     | Card/injury badges, risk rings, bench-slot markers are already SVG `<rect>`/`<circle>`/`<g>` — see Evidence                                                                             |
| CSS Modules                  | —                   | Styling       | Two-column Advanced drawer, green Resume button, red side-banner background are plain CSS (flex/grid) — same pattern as every other `.module.css` in `packages/client/src/components`   |

No version bumps are indicated either — all four packages are current within their major line (React 18, Zustand 4, Socket.io 4) and the project has no stated reason to move to React 19 or Zustand 5 for this milestone.

## Feature-by-Feature Analysis

### 1. Referee-leniency manual override (toggle, range 2–5)

Pure data/logic change: a new boolean + numeric field on the game-creation settings object (same shape as the existing `fouls`/`booking`/`injury`/`outOfBounds` toggles in `GameSettingsScreen.tsx`) and a server-side branch in the existing booking-roll logic (`fouls.ts` — booking already compares a die roll against the referee's `Leniency` attribute; this just substitutes a manager-set value in range 2–5 for the random 1–6 when the toggle is on). No new dependency — it's an `<input type="checkbox">` + a numeric `<input type="range">` or `<select>`, both native HTML.

### 2. Unified card/injury iconography across 4 surfaces

**Confirmed duplication exists today**, which is exactly what this feature is meant to fix — not a new capability to build from scratch. `PieceOverlay.tsx` (in-pitch piece overlay) and `PlayerStatsPanel.tsx` (player-stats card) both independently hand-roll the same card badge (`<rect>` sized `badgeR*1.5 x badgeR*2`, red/yellow via `var(--color-card-red)`/`var(--color-card-yellow)`) and the same injury badge (a white SVG plus-sign built from two crossed `<rect>`s). The fix is to extract these into one shared `<CardStatusBadge>` / `<InjuryBadge>` SVG component (or a single combined `<StatusBadges>`), parameterized by size/anchor, and reuse it in the two existing sites plus the two new sites (roster-screen card, bench card). This is a refactor using the existing SVG + CSS-custom-property (`var(--color-card-*)`) approach — no icon library needed. Introducing an icon-font or SVG-icon package (e.g. `lucide-react`, `react-icons`) would be a step backward: it would abandon the project's established "every visual is a hand-tuned inline SVG primitive keyed off `tokens.css`" convention (v1.5's `HIGHLIGHT_STYLES`/`RING_STYLES` precedent) for a generic asset that doesn't match the broadcast-sports token palette.

### 3. Advanced collapsible drawer, two-column layout

`GameSettingsScreen.tsx` already renders the four Match Rules toggles (Fouls/Booking/Injury/Out-of-Bounds) as plain `<input type="checkbox">` rows in a `.module.css`-styled block. Moving them under a collapsible "Advanced" section is either (a) a controlled `useState<boolean>` show/hide with a CSS `max-height`/`display` transition, or (b) the native HTML `<details>`/`<summary>` element, which needs zero JavaScript and zero dependencies for expand/collapse and is trivially themeable via `tokens.css`. The two-column layout is `display: grid; grid-template-columns: 1fr 1fr;` in the existing CSS Module — the codebase already uses CSS grid elsewhere (e.g. `UniformSelectionScreen`'s 2×9 style-tile grid, `TeamSelectionScreen`'s 6×2 team grid). No component library needed.

### 4. Substitution UX overhaul (drag-and-drop mode, action-button mode, confirmation modal, bench red-card marker)

**Drag-and-drop:** the codebase already implements substitution drag-and-drop using the **native HTML5 Drag and Drop API** directly (`draggable`, `onDragStart`, `onDragOver`, `onDrop`, `e.dataTransfer.setData('text/plain', ...)`) in `LineupAssignmentScreen.tsx` and `BenchCarousel.tsx` — no library (no `react-dnd`, `@dnd-kit/core`, `react-beautiful-dnd`, etc.) is installed or used. The "default drag-and-drop player-repositioning mode" is the same mechanism applied to a new interaction target (on-field slot ↔ on-field slot instead of pack-card ↔ slot); it is index-based (`dataTransfer.getData` returns a slot index, resolved against Zustand state on drop, matching the documented pattern "never read dataTransfer at drop time" already followed in `LineupAssignmentScreen.tsx`). Introducing a drag-and-drop library here would contradict the established pattern and add a dependency for a capability already proven at the required scale (≤11 on-field slots + bench).
**Confirmation modal:** `ActionPanel.tsx` already implements the exact modal pattern this feature explicitly asks to mirror — the early-movement-end confirmation (`confirmDialog`, `confirmOverlay`/`confirmCard`/`confirmActions` CSS Module classes, driven by local `pendingEndTurn`-style React state, no portal library, no headless-UI/Radix dialog primitive). Reuse this pattern for the "player off / player on" substitution confirmation and the green Resume button. No modal/dialog library needed.
**Bench red-card marker:** a new visual state on the existing `BenchEntry`/bench-card rendering (already built in v1.6's substitutions system) — a styled slot variant, not a new rendering technology.

### 5. Tackle/Steal decline-and-re-prompt toggle

Pure game-logic + state-machine change: the risk ring is already a first-class SVG ring type in `HexCell.tsx`'s `RING_STYLES` table (v1.5's single source-of-truth ring system). "Keep the risk ring active on a declined defender for a later move step" means _not_ clearing that ring/eligibility entry on decline, tracked via a small addition to existing move-sequence state (mirrors how `eligibleRemaining`/`hpmEligibleRemaining` already track deferred eligibility in `ActionPanel.tsx`). No new dependency — this is server-authoritative state-machine logic (`gameEngine.ts`) plus reuse of an existing ring style.

### 6. On-demand match-summary popup (possession %, passes, tackle/steal counts + success %, shots, xG per shot, fouls/cards)

All of this is **numeric aggregation + a plain HTML table/list**, not a chart. The feature spec describes discrete scalar values (percentages, counts, a computed xG number) — no line graphs, bar charts, sparklines, or heatmaps are requested. This does **not** justify adding a charting library (e.g. `recharts`, `chart.js`, `visx`, `victory`) — those exist to render trend/comparison visualizations, which is out of scope here; a styled `<table>`/CSS-grid layout inside the existing modal-overlay pattern (see #4) is sufficient and consistent with every other panel in the app (`PlayerStatsPanel.tsx` already renders a comparable stat-card layout with plain HTML/CSS, no charting dependency).
**xG computation** (inputs: defenders in the goal box, defenders in the penalty box, shot-hex X/Y distance from goal center) is pure arithmetic on data the server already tracks. Distance-from-goal-center reuses `hexDistance()` (already exported from `packages/shared/src/hex.ts`, used throughout the shared validators) or the existing axial-to-pixel hex math already used for rendering (`HEX_SIZE = 20px`, 37×26 axial grid, kickoff at `{q:18, r:13}`) — no geometry/math library needed. Defender-in-box counts are a filter over `GameState` piece positions against the existing pitch-zone helpers in `pitch.ts`. This aggregation belongs in `packages/shared` (pure function, testable like every other validator) so both server (for authoritative stats) and client (for optimistic/derived display if needed) can share it — matching the project's established "pure shared validation module" architecture (`ARCH-02`).
**(i) icon on the scoreboard:** a small inline SVG glyph (a circle with "i" text, matching the hand-rolled SVG-primitive convention already used for card/injury badges) — not an icon package.

## What NOT to Add

| Avoid                                                                                                                     | Why                                                                                                                                                                                                                                                                                                                                                                                                                                 | Use Instead                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react-icons`, `lucide-react`, `@heroicons/react`, or any icon-font/SVG-icon package                                      | The project has zero icon-package precedent; every visual glyph (card badge, injury plus-sign, ball dot, hex rings) is a hand-tuned inline SVG primitive keyed off `tokens.css` custom properties. Adding a generic icon set breaks that convention and pulls in unused icons for a handful of glyphs cheaper to hand-draw                                                                                                          | Extract the existing duplicated `PieceOverlay`/`PlayerStatsPanel` card+injury SVG markup into one shared component; hand-roll the (i) info-icon the same way |
| `react-dnd`, `@dnd-kit/core`, `react-beautiful-dnd`, `react-sortable-hoc`                                                 | Native HTML5 Drag and Drop API is already fully implemented and battle-tested in this codebase (`LineupAssignmentScreen.tsx`, `BenchCarousel.tsx`, `DraftPackCarousel.tsx`) at the required scale (≤11 slots + bench). A library would duplicate existing capability and introduce a second drag-and-drop paradigm to maintain                                                                                                      | Extend the existing native `draggable`/`onDragStart`/`onDragOver`/`onDrop` + index-based `dataTransfer` pattern to the new on-field repositioning target     |
| `recharts`, `chart.js`, `victory`, `visx`, `nivo`                                                                         | The match-summary popup's stats are discrete scalars (%, counts, one xG number per shot listed), not trend/time-series visualizations. No chart is specified in the feature description                                                                                                                                                                                                                                             | Styled `<table>`/CSS-grid list inside the existing modal-overlay pattern, matching `PlayerStatsPanel.tsx`'s existing stat layout                             |
| `@radix-ui/react-dialog`, `headlessui`, `react-modal`, or any headless-UI/dialog primitive library                        | `ActionPanel.tsx` already has a working, accessible-enough confirm-dialog pattern (`confirmOverlay`/`confirmCard`) used for the exact "mirror the early-movement-end confirmation" behavior this milestone asks for                                                                                                                                                                                                                 | Reuse `ActionPanel.tsx`'s existing confirm-dialog CSS/state pattern for the substitution confirmation and Game Summary popup                                 |
| A hex-grid math library (e.g. `honeycomb-grid`)                                                                           | Confirmed not installed and not needed — `packages/shared/src/hex.ts` already implements `hexDistance`, `toCube`/`fromCube`, `hexNeighbors`, `hexesInRange`, `hexLine` etc. as hand-written pure functions used across all existing validators. (Note: `honeycomb-grid` was recommended in the original v1.0 STACK research but the team built custom hex math instead — this is the actual, shipped state, not the original plan.) | `hexDistance()` and existing axial/pixel conversion already used for rendering                                                                               |
| A UI component/design-system library (MUI, Chakra, Ant Design, shadcn/ui) for the Advanced drawer or collapsible sections | Native `<details>`/`<summary>` or a `useState` toggle + CSS `max-height` transition covers the collapsible-drawer requirement with zero dependencies; the project has a single hand-built `tokens.css` design-token layer (v1.5) that a component library would fight rather than integrate with                                                                                                                                    | `<details>` element or controlled `useState` show/hide, styled via `tokens.css` custom properties in a new/extended CSS Module                               |

## Evidence (direct codebase inspection, 2026-08-21)

- `packages/client/package.json` — dependencies: `react@^18.3.1`, `react-dom@^18.3.1`, `socket.io-client@^4.8.3`, `wcag-contrast@3.0.0`, `zustand@^4.5.7`. No drag-and-drop, icon, charting, or modal library present.
- `packages/server/package.json` — dependencies: `cors@2.8.6`, `express@4.22.2`, `nanoid@5.1.11`, `socket.io@4.8.3`. No stats/math library present (none needed).
- `packages/shared/package.json` — no runtime dependencies at all; `hex.ts`, `fouls.ts`, `pitch.ts`, `outOfBounds.ts`, `shotValidator.ts`, `passValidator.ts` etc. are hand-written pure TypeScript.
- `packages/client/src/components/PieceOverlay.tsx` (lines ~233–292) and `packages/client/src/components/PlayerStatsPanel.tsx` (~line 151) — duplicated card/injury SVG badge logic, confirming feature #2 is a dedup refactor of existing code, not new capability.
- `packages/client/src/components/LineupAssignmentScreen.tsx` — native HTML5 DnD (`draggable`, `onDragStart`, `onDragOver`, `onDrop`, `dataTransfer.setData('text/plain', ...)`), confirming feature #4's drag-and-drop mode extends an existing, already-proven mechanism.
- `packages/client/src/components/ActionPanel.tsx` (lines ~171–196) — `withEndTurnConfirm`/`confirmDialog`/`confirmOverlay`/`confirmCard` is the existing early-movement-end confirmation the substitution modal is asked to mirror; it's local React state + CSS Module, no dialog library.
- `packages/client/src/components/GameSettingsScreen.tsx` — existing Fouls/Booking/Injury/Out-of-Bounds toggles are plain `<input type="checkbox">`, confirming the Advanced-drawer relocation is a layout change only.
- `packages/shared/src/hex.ts` (lines 39–150+) — `hexDistance`, `toCube`/`fromCube`, `hexNeighbors`, `hexesInRange`, `hexLine`, `getZoIDefenders` already implemented; directly reusable for the xG distance-from-goal-center input and box-occupancy counts.

## Installation

None required for this milestone.

```bash
# No new packages to install — all v1.7 features build on the existing
# React 18 / Zustand 4 / Socket.io 4 / inline-SVG / CSS-Modules stack.
```

## Alternatives Considered

| Recommended                                       | Alternative           | When to Use Alternative                                                                                                                                                                                                                                                               |
| ------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native HTML5 Drag and Drop API (existing)         | `@dnd-kit/core`       | If the substitution UX needed touch-device/mobile drag support with accessibility affordances (keyboard reordering, screen-reader announcements) beyond what native DnD gives — but this project is explicitly desktop-first and mobile layout is Out of Scope, so this doesn't apply |
| Hand-rolled shared `<StatusBadges>` SVG component | An icon package       | If the project later needs dozens of miscellaneous UI icons (settings gear, chevrons, etc.) at a volume where hand-drawing each one stops being worth it — not the case for 2 badge types across 4 surfaces                                                                           |
| Plain `<table>`/CSS-grid stats layout             | `recharts` or similar | If a future milestone adds a possession-over-time graph, shot-map heatmap, or multi-match trend comparison — none of which is in v1.7's scope                                                                                                                                         |
| `hexDistance()` (existing, shared)                | `honeycomb-grid`      | Only relevant if the team decides to migrate off the custom hex-math module entirely — a large, unrelated refactor with no v1.7 driver                                                                                                                                                |

## Version Compatibility

Not applicable — no new packages are being introduced, so there are no new compatibility constraints to evaluate. All work in v1.7 operates within the already-validated React 18.3 / Zustand 4.5 / Socket.io 4.8 / TypeScript combination that has shipped six prior milestones without issue.

## Sources

- Direct repository inspection (`packages/client/package.json`, `packages/server/package.json`, `packages/shared/package.json`) — HIGH confidence (primary source: the actual installed dependency manifests)
- Direct component inspection (`PieceOverlay.tsx`, `PlayerStatsPanel.tsx`, `LineupAssignmentScreen.tsx`, `ActionPanel.tsx`, `GameSettingsScreen.tsx`) — HIGH confidence (primary source: the actual shipped implementation)
- Direct shared-module inspection (`packages/shared/src/hex.ts`) — HIGH confidence (primary source)
- `.planning/PROJECT.md` (Current Milestone / v1.7 target features, v1.6 delivered substitutions/fouls system) — HIGH confidence (primary source: project's own tracked state)

---

_Stack research for: Counter Attack POC v1.7 (UI Consistency, Substitution Rework & Match Summary)_
_Researched: 2026-08-21_
