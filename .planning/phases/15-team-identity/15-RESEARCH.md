# Phase 15: Team Identity - Research

**Researched:** 2026-06-13
**Domain:** SVG pattern design, TypeScript shared types, React static asset imports, client-side color refactoring
**Confidence:** HIGH (codebase evidence is authoritative; no new npm packages; all decisions locked in CONTEXT.md)

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Badge images are PNG files provided by the user, stored at `packages/client/src/assets/badges/{teamid}.png`. Display via `<img>` tags. No inline SVG recreation.
- **D-02:** Team name is **Cosmos** (not "Cozmos"). `TeamId` uses `'cosmos'`. Badge PNGs confirmed present: cosmos.png, xolos.png, city.png, crew.png.
- **D-03:** New file `packages/shared/src/teamConfig.ts`. Exports `TeamId`, `TeamConfig`, `TEAM_CONFIGS`.
- **D-04:** Color values per team: Cosmos `#1e3a8a`/`#c8a84b`; Xolos `#ea580c`/`#6b7280`; City `#dc143c`/`#f5c518`; Crew `#f5c518`/`#111111`.
- **D-05:** Client-only `TEAM_DEFAULTS: Record<'home'|'away', TeamId>` constant maps positional role to team id. No `GameState` changes, no Socket.io events.
- **D-06:** Replace all hardcoded team color hex literals (`#1a56b0`, `#c0392b`) in `PieceOverlay.tsx`, `GameBoard.tsx`, `ActionLog.tsx` with `TEAM_CONFIGS[TEAM_DEFAULTS[teamId]].primaryColor`.
- **D-07:** Replace `TeamShieldIcon` (generic colored shield) in `GameBoard.tsx:45` with a `TeamBadge` component rendering `<img src={badgePath} />`. Size 28×28px in scoreboard. Accepts a `size` prop for reuse.
- **D-08:** 4 SVG `<pattern>` defs in `PieceOverlay.tsx` keyed by team id. Pattern ids: `cosmos-jersey-{pieceId}`, `xolos-jersey-{pieceId}`, `city-jersey-{pieceId}`, `crew-jersey-{pieceId}`.
- **D-09:** Jersey patterns (outfield): Cosmos horizontal white stripe (12px wide); Xolos checker orange/grey (~8–10px tiles); City crimson with fine gold vertical stripes + gold arch path; Crew gold with diagonal black stripes top 30% of circle.
- **D-10:** GK jersey updates: Home GK purple/dark-purple checker (`#7c3aed`/`#4c1d95`, ~6px tiles); Away GK amber base `#f59e0b` with 2 narrow orange vertical stripes at left/right edges (`#ea580c`, ~3px at x≈4 and x≈20 within 24px tile).

### Claude's Discretion

_(None defined in CONTEXT.md — all implementation details are locked.)_

### Deferred Ideas (OUT OF SCOPE)

- Dynamic team color propagation based on player selection — Phase 16
- `selectedTeams: { home: TeamId, away: TeamId }` in `GameState` — Phase 16
- `gkColor` field in `TeamConfig` — not added (GK convention is board-standard)
- Badge display on player cards — Phase 16 (PLAY-02)
- Team selection screen — Phase 16 (SELECT-01)
  </user_constraints>

---

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                                  | Research Support                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| TEAM-01 | Four teams defined in shared types with name, primary color, and badge component — Cosmos, Xolos, City, Crew | D-03/D-04: `teamConfig.ts` with `TeamConfig` interface and `TEAM_CONFIGS` record                                            |
| TEAM-02 | Cosmos — home blue; badge depicts a galaxy/star; jersey horizontal stripe 3× wider than current              | D-08/D-09: navy base + 12px horizontal white stripe pattern; badge PNG via `TeamBadge`                                      |
| TEAM-03 | Xolos — orange; badge depicts a coyote; orange jersey with grey checker pattern                              | D-08/D-09: `#ea580c` base + `#6b7280` checker SVG pattern                                                                   |
| TEAM-04 | City — red with gold accent; STL City–style badge; red jersey with gold arch + vertical stripes              | D-08/D-09: `#dc143c` base + thin gold vertical stripes + gold arch `<path>`                                                 |
| TEAM-05 | Crew — gold; Columbus Crew–style badge; gold jersey with 45° black stripes across shoulders                  | D-08/D-09: `#f5c518` base + diagonal black stripe pattern top ~30% of circle                                                |
| TEAM-06 | Team badge displayed in scoreboard top band (and team selection screen, player card — Phase 16)              | D-07: `TeamBadge` component replaces `TeamShieldIcon` in scoreboard; also `PlayerStatsPanel.tsx` per integration-point note |

</phase_requirements>

---

## Summary

Phase 15 is a self-contained visual identity phase: define four named teams in shared types, apply distinct SVG jersey patterns to piece tokens, replace the generic shield icon with PNG badge images, and wire the scoreboard to show team badges using a hardcoded home/away default. The phase involves no server logic, no `GameState` schema changes, and no Socket.io events.

The primary technical work is: (1) authoring `packages/shared/src/teamConfig.ts` with a `TeamId` union and `TEAM_CONFIGS` record; (2) adding four `<pattern>` SVG definitions to `PieceOverlay.tsx` covering the four outfield jersey designs; (3) adding two GK jersey pattern updates; (4) creating a `TeamBadge` React component that renders PNG assets via `<img>`; and (5) doing a targeted color-literal refactor across three client files.

All decisions are locked in CONTEXT.md. No new npm packages are required. The existing SVG pattern infrastructure in `PieceOverlay.tsx` (lines 66–98) is the direct extension point — the planner should treat it as the template for all four new outfield patterns. The `TEAM_DEFAULTS` constant is client-only and trivially replaced in Phase 16.

**Primary recommendation:** Implement in 3 waves — (1) shared types + barrel export, (2) `PieceOverlay.tsx` jersey patterns + GK updates, (3) `GameBoard.tsx`/`ActionLog.tsx` badge + color refactor.

---

## Architectural Responsibility Map

| Capability                           | Primary Tier           | Secondary Tier | Rationale                                                                |
| ------------------------------------ | ---------------------- | -------------- | ------------------------------------------------------------------------ |
| TeamConfig types + TEAM_CONFIGS data | Shared package         | —              | Both client and server can import; single source of truth per D-03       |
| TeamId union type                    | Shared package         | —              | Shared so server can validate team ids in Phase 16                       |
| TEAM_DEFAULTS constant               | Frontend (client-only) | —              | Positional mapping only needed in UI; explicitly NOT in GameState (D-05) |
| TeamBadge component                  | Frontend component     | —              | PNG asset display; client-only concern                                   |
| SVG jersey patterns                  | Frontend component     | —              | Rendering concern; lives in PieceOverlay.tsx per existing pattern        |
| GK jersey patterns                   | Frontend component     | —              | Same SVG extension point as outfield patterns                            |
| Scoreboard badge wiring              | Frontend component     | —              | GameBoard.tsx replaces TeamShieldIcon with TeamBadge                     |
| ActionLog color refactor             | Frontend component     | —              | D-06 cleanup; no logic change                                            |

---

## Standard Stack

### Core (no new packages — phase is pure code/asset work)

| Library    | Version         | Purpose               | Why Standard                                        |
| ---------- | --------------- | --------------------- | --------------------------------------------------- |
| React      | 18.3.1 (pinned) | Component rendering   | Project constraint; already installed               |
| TypeScript | 5.x             | Shared types          | Project constraint; already installed               |
| Vite       | 5.x             | Static asset pipeline | Project constraint; PNG imports work out of the box |

### Supporting

No new npm packages required for this phase.

**Installation:** None.

---

## Package Legitimacy Audit

> No new packages to install in this phase. Section is not applicable.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
TEAM_DEFAULTS (client const)
        │
        ▼
TEAM_CONFIGS (shared record)
   ┌────┴────┐
   │         │
   ▼         ▼
TeamBadge  PieceOverlay
(img tag)  (SVG patterns)
   │               │
   ▼               ▼
Scoreboard    HexGrid circles
(top band)    (piece tokens)
```

Data flows from the `TEAM_DEFAULTS` constant → `TEAM_CONFIGS` lookup → rendering components. No server involvement.

### Recommended Project Structure

```
packages/
├── shared/src/
│   ├── teamConfig.ts        # NEW — TeamId, TeamConfig, TEAM_CONFIGS
│   └── index.ts             # ADD re-exports for teamConfig
└── client/src/
    ├── assets/badges/
    │   ├── cosmos.png        # ALREADY PRESENT (user-provided)
    │   ├── xolos.png         # ALREADY PRESENT
    │   ├── city.png          # ALREADY PRESENT
    │   └── crew.png          # ALREADY PRESENT
    └── components/
        ├── TeamBadge.tsx     # NEW — replaces TeamShieldIcon
        ├── PieceOverlay.tsx  # MODIFY — 4 outfield + 2 GK jersey patterns
        ├── GameBoard.tsx     # MODIFY — D-06 color refactor + D-07 TeamBadge
        └── ActionLog.tsx     # MODIFY — D-06 color literal refactor
```

### Pattern 1: SVG `<pattern>` per-piece def with `userSpaceOnUse`

**What:** Each piece renders its own `<defs><pattern>` block inside the SVG root. Pattern ids include the piece id to avoid SVG id collisions when multiple pieces of the same team are rendered simultaneously.

**When to use:** Whenever piece-specific coordinates must be encoded in the pattern origin (the `x`/`y` attributes of `<pattern>` use `cx - PIECE_RADIUS`, `cy - PIECE_RADIUS` to anchor the tile to the piece center).

**Example (existing vertical stripe — extend this for all 4 team patterns):**

```tsx
// Source: packages/client/src/components/PieceOverlay.tsx lines 66–98 [VERIFIED: codebase]
<defs>
  <pattern
    id={`home-stripe-${piece.id}`}
    x={cx - PIECE_RADIUS}
    y={cy - PIECE_RADIUS}
    width={24}
    height={24}
    patternUnits="userSpaceOnUse"
  >
    <rect width={24} height={24} fill="#1a56b0" />
    <rect x={10} y={0} width={4} height={24} fill="#000000" fillOpacity={0.55} />
  </pattern>
</defs>
```

**Key insight:** `patternUnits="userSpaceOnUse"` means the pattern tile's `x`/`y` is in SVG viewport coordinates. To keep the pattern visually anchored to the circle, set `x={cx - PIECE_RADIUS}` and `y={cy - PIECE_RADIUS}` — this shifts the tile origin to the top-left corner of the piece's bounding box.

### Pattern 2: Cosmos horizontal white stripe (D-09)

**What:** Navy base with a single wide horizontal stripe. The existing home pattern uses a 4px VERTICAL stripe; the Cosmos jersey uses a 12px HORIZONTAL stripe.

```tsx
// Source: CONTEXT.md D-09 [ASSUMED — straight implementation of spec]
<pattern
  id={`cosmos-jersey-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={24}
  height={24}
  patternUnits="userSpaceOnUse"
>
  <rect width={24} height={24} fill="#1e3a8a" />
  {/* Single wide horizontal white stripe centered vertically at y=6..18 */}
  <rect x={0} y={6} width={24} height={12} fill="#ffffff" fillOpacity={0.6} />
</pattern>
```

### Pattern 3: Xolos checker pattern (D-09)

**What:** Orange base with grey checker squares. Checker tiles are 8px × 8px within the 24px tile space. Two checker positions per row, two rows per tile.

```tsx
// Source: CONTEXT.md D-09 [ASSUMED — standard SVG checker implementation]
<pattern
  id={`xolos-jersey-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={16}
  height={16}
  patternUnits="userSpaceOnUse"
>
  <rect width={16} height={16} fill="#ea580c" />
  {/* Top-left and bottom-right checker squares */}
  <rect x={0} y={0} width={8} height={8} fill="#6b7280" fillOpacity={0.7} />
  <rect x={8} y={8} width={8} height={8} fill="#6b7280" fillOpacity={0.7} />
</pattern>
```

**Note on tile width:** Use `width={16} height={16}` (two 8px checker tiles per axis) instead of 24 to get proper checker repetition. The pattern repeats to fill the 24px piece circle.

### Pattern 4: City vertical stripes + arch path (D-09)

**What:** Crimson base with thin gold vertical stripes (1px every 4px), plus a gold arch `<path>` in the lower third. The arch is a separate SVG element overlaid on the circle fill, not part of the pattern repeat.

```tsx
// Source: CONTEXT.md D-09 [ASSUMED — spec describes a non-repeating arch element]
// Jersey pattern (repeated stripes):
<pattern
  id={`city-jersey-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={4}
  height={24}
  patternUnits="userSpaceOnUse"
>
  <rect width={4} height={24} fill="#dc143c" />
  <rect x={3} y={0} width={1} height={24} fill="#f5c518" fillOpacity={0.8} />
</pattern>

// Arch overlaid AFTER the base circle (as a sibling SVG element, not inside pattern):
<path
  d={`M ${cx - PIECE_RADIUS * 0.7} ${cy + PIECE_RADIUS * 0.3} Q ${cx} ${cy + PIECE_RADIUS * 0.9} ${cx + PIECE_RADIUS * 0.7} ${cy + PIECE_RADIUS * 0.3}`}
  fill="none"
  stroke="#f5c518"
  strokeWidth={1.5}
  pointerEvents="none"
/>
```

**Planner note:** The arch is rendered AFTER the base circle as a sibling `<path>` element (not inside the `<pattern>`). It uses a quadratic bezier curve (SVG `Q` command) centered at `(cx, cy + PIECE_RADIUS * 0.9)` to create a gentle arch in the lower third. The planner task for City jersey must include both the pattern def AND the arch path element.

### Pattern 5: Crew diagonal shoulder stripes (D-09)

**What:** Gold base with 45° diagonal black stripes in the top ~30% of the circle. Constrained to the upper region only (not full-coverage diagonal).

```tsx
// Source: CONTEXT.md D-09 [ASSUMED — spec describes top-region diagonal stripes]
<pattern
  id={`crew-jersey-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={8}
  height={8}
  patternUnits="userSpaceOnUse"
>
  <rect width={8} height={8} fill="#f5c518" />
  {/* 45° diagonal stripe: thin line from top-right to bottom-left of tile */}
  <line x1={8} y1={0} x2={0} y2={8} stroke="#111111" strokeWidth={2} strokeOpacity={0.75} />
</pattern>
```

**Shoulder constraint:** The top-30% restriction means the pattern fill area must be clipped. Approach: apply the pattern as fill on the entire circle, then overlay a gold-filled shape covering the lower 70% to mask out the diagonal stripes below the shoulder region. Alternatively, use a `clipPath` element to restrict the diagonal pattern to the upper portion.

**Recommended implementation:** Add a `<rect>` inside the component (as a sibling SVG element, after the base circle) covering the lower 70% of the piece circle with a solid gold fill (`#f5c518`), pointerEvents none. This masks the diagonal pattern below the shoulder zone without needing a clipPath. Coordinates: `y={cy - PIECE_RADIUS * 0.7}` to `cy + PIECE_RADIUS` for the mask rect (centered on circle y).

Actually, the cleanest approach: render a `<clipPath>` that restricts to the upper 30% of the token. Use `clipPathUnits="userSpaceOnUse"` and define a `<rect>` from `y={cy - PIECE_RADIUS}` to `y={cy - PIECE_RADIUS + PIECE_RADIUS * 0.6}` (top 30% of the 24px height = ~7px). Apply this clipPath on a second `<circle>` filled with the diagonal pattern, leaving the base gold circle underneath.

### Pattern 6: Home GK checker (D-10)

**What:** Purple/dark-purple checker replacing the current solid purple fill. 6px tiles in a 24px token.

```tsx
// Source: CONTEXT.md D-10 [ASSUMED — direct implementation of spec]
<pattern
  id={`home-gk-checker-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={12}
  height={12}
  patternUnits="userSpaceOnUse"
>
  <rect width={12} height={12} fill="#7c3aed" />
  <rect x={0} y={0} width={6} height={6} fill="#4c1d95" />
  <rect x={6} y={6} width={6} height={6} fill="#4c1d95" />
</pattern>
```

### Pattern 7: Away GK amber + orange edge stripes (D-10)

**What:** Amber base with two narrow orange vertical stripes at the left and right edges (~3px at x≈4 and x≈20 within 24px). These are sibling rect elements overlaid on the base circle, not a repeating pattern (they are fixed-position edge stripes).

```tsx
// Source: CONTEXT.md D-10 [ASSUMED — spec describes fixed-position edge stripes, not repeating]
// Approach: render the GK circle with solid amber fill, then two orange rect overlays:
<circle cx={cx} cy={cy} r={PIECE_RADIUS} fill="#f59e0b" stroke={stroke} strokeWidth={1.5} />
<rect
  x={cx - PIECE_RADIUS + 4} y={cy - PIECE_RADIUS}
  width={3} height={PIECE_RADIUS * 2}
  fill="#ea580c" fillOpacity={0.85} pointerEvents="none"
/>
<rect
  x={cx + PIECE_RADIUS - 7} y={cy - PIECE_RADIUS}
  width={3} height={PIECE_RADIUS * 2}
  fill="#ea580c" fillOpacity={0.85} pointerEvents="none"
/>
```

**Note:** This makes the Away GK the only piece that still uses solid fill for its base circle (easier than a pattern for two fixed-position stripes). The orange stripe rects are clipped naturally by the SVG circle stroke boundary at the edges.

### Pattern 8: Vite PNG asset import (D-01, D-07)

**What:** Vite handles PNG imports as URL strings out of the box. No plugin configuration needed.

```tsx
// Source: Vite 5.x docs — static asset handling [ASSUMED — well-established Vite behavior]
// In TeamBadge.tsx:
import cosmosBadge from '../assets/badges/cosmos.png';
import xolosBadge from '../assets/badges/xolos.png';
import cityBadge from '../assets/badges/city.png';
import crewBadge from '../assets/badges/crew.png';
import type { TeamId } from '@counter-attack/shared';

const BADGE_MAP: Record<TeamId, string> = {
  cosmos: cosmosBadge,
  xolos: xolosBadge,
  city: cityBadge,
  crew: crewBadge,
};

export function TeamBadge({ teamId, size = 28 }: { teamId: TeamId; size?: number }) {
  return (
    <img
      src={BADGE_MAP[teamId]}
      alt={`${teamId} badge`}
      width={size}
      height={size}
      style={{ display: 'block' }}
    />
  );
}
```

**TypeScript declaration for PNG modules:** Vite's client type shims handle `*.png` imports. The project should have `/// <reference types="vite/client" />` in a `vite-env.d.ts` file — if missing, the planner must add it in Wave 0.

### Anti-Patterns to Avoid

- **Mixing positional teamId ('home'/'away') with TeamId ('cosmos'/'xolos'/...):** `piece.teamId` is always `'home'|'away'`. The mapping `TEAM_DEFAULTS[piece.teamId]` gives the `TeamId`. Never assume `piece.teamId` is a `TeamId`.
- **Shared SVG pattern ids across pieces:** If two pieces share the same pattern id in the same SVG document, only one renders correctly. Always include `piece.id` in the pattern id (e.g., `cosmos-jersey-${piece.id}`).
- **Placing `<defs>` outside the SVG root:** All `<defs>` must be rendered as children of the same `<svg>` element that references them. `PieceOverlay` is a fragment child of the HexGrid's single `<svg>` root — this is already correct.
- **Importing PNG assets from the shared package:** Badge assets live in `packages/client/src/assets/` — they are client-only. The shared package exports only types and data (no asset paths as strings in TEAM_CONFIGS). The `badgeFile` field in `TeamConfig` is a filename key (e.g., `'cosmos.png'`); the actual import happens in the `TeamBadge` component.
- **Putting TEAM_DEFAULTS in shared package:** It is a client-only constant that will be replaced by Phase 16 dynamic selection. It does not belong in shared types.

---

## Don't Hand-Roll

| Problem                   | Don't Build                  | Use Instead                                               | Why                                                                                                    |
| ------------------------- | ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| SVG checker pattern       | Custom canvas drawing        | SVG `<pattern>` with two offset `<rect>` elements         | Already the established pattern in PieceOverlay; zero runtime cost                                     |
| Diagonal stripe pattern   | CSS transform on rect        | SVG `<line>` or diagonal `<rect>` inside `<pattern>` tile | SVG patterns support arbitrary geometry; `<line x1={w} y1={0} x2={0} y2={h}>` is the standard diagonal |
| PNG asset path management | Dynamic string concatenation | Static imports via Vite module system                     | Vite processes imports at build time; gives content-hashed URLs; no runtime path logic needed          |
| Color lookup              | Ternary chains in components | `TEAM_CONFIGS[TEAM_DEFAULTS[piece.teamId]].primaryColor`  | D-06 mandates single source of truth; eliminates 12+ scattered literals                                |

**Key insight:** All jersey patterns use the same `userSpaceOnUse` pattern infrastructure already established in `PieceOverlay.tsx`. The planner should treat lines 66–98 of `PieceOverlay.tsx` as the template — extend don't rebuild.

---

## Common Pitfalls

### Pitfall 1: SVG Pattern Id Collision

**What goes wrong:** Two pieces of the same team rendered in the same SVG document both define a `<pattern id="cosmos-jersey">`. The second definition silently overrides the first. Both pieces' fills reference the same pattern, but only the second piece's coordinates appear in the pattern origin — the first piece renders with a visually misaligned jersey.

**Why it happens:** SVG ids must be unique per document. The HexGrid renders all pieces in a single `<svg>` root.

**How to avoid:** Always suffix pattern ids with `piece.id`: `cosmos-jersey-${piece.id}`. This is the existing convention in the codebase (`home-stripe-${piece.id}`, `away-stripe-${piece.id}`).

**Warning signs:** Jersey pattern appears on some tokens but not others, or the pattern appears shifted/misaligned on some pieces.

### Pitfall 2: GK Branch Not Updated in Both PieceOverlay and PlayerStatsPanel

**What goes wrong:** The GK jersey update (D-10) is applied in `PieceOverlay.tsx` but not in `PlayerStatsPanel.tsx`'s `MiniTokenBadge`. The mini token in the stats panel still shows the old solid purple/amber fill for GKs.

**Why it happens:** `MiniTokenBadge` duplicates the GK color logic from `PieceOverlay.tsx` (see `gkFill` at `PlayerStatsPanel.tsx:40`). It is a separate SVG document with its own `<defs>`.

**How to avoid:** The planner must include `PlayerStatsPanel.tsx` in the GK jersey update task. It also needs separate `<pattern>` defs for the GK checker/stripe patterns using `mini-` prefixed ids.

**Warning signs:** GK pieces show checker pattern in the main board but solid color in the stats panel mini token.

### Pitfall 3: `badgeFile` Field Used as Asset Path Directly

**What goes wrong:** Code treats `teamConfig.badgeFile` (e.g., `'cosmos.png'`) as a valid `<img src>` value. At runtime, the string `'cosmos.png'` is not a valid URL — Vite's asset hashing produces URLs like `/assets/cosmos-a1b2c3.png`.

**Why it happens:** Vite processes static imports at build time, not at runtime. String paths bypass this processing.

**How to avoid:** The `TeamBadge` component uses static imports (`import cosmosBadge from '../assets/badges/cosmos.png'`) collected in a `BADGE_MAP: Record<TeamId, string>`. `badgeFile` in `TeamConfig` is metadata only — the `TeamBadge` component does the actual import lookup.

**Warning signs:** Badge images show broken image icons in production but work in dev (dev server can serve arbitrary static files; production relies on Vite-processed URLs).

### Pitfall 4: Diagonal Stripe Covers Full Circle (Crew)

**What goes wrong:** The Crew diagonal stripe pattern is applied to the full piece circle. The spec (D-09) says stripes should appear only in the top ~30% ("shoulder region"). Full coverage looks like prison stripes and is visually inconsistent with the brief.

**Why it happens:** SVG patterns fill the entire shape they are applied to unless restricted.

**How to avoid:** Use one of the two approaches documented in Pattern 5 above — either a masking gold `<rect>` overlay on the lower 70%, or a `<clipPath>` restricting the diagonal fill to the top 30%.

**Warning signs:** Crew tokens display diagonal stripes across the entire circle, not just the shoulder area.

### Pitfall 5: Color Refactor Misses Hardcoded Literals in Overlay JSX

**What goes wrong:** D-06 requires replacing `#1a56b0` and `#c0392b` throughout client code. `GameBoard.tsx` has these colors in: (1) the scoreboard cell score numeral `style`, (2) the HALF_TIME overlay team label, (3) the FULL_TIME overlay result color derivation, (4) the player card `TeamShieldIcon` call (now replaced by `TeamBadge`). Missing any instance leaves a hardcoded blue/red when the team is Xolos or City (whose primary colors are orange and crimson).

**Why it happens:** There are 10+ occurrences spread across three files. A manual search is error-prone.

**How to avoid:** The planner should emit a grep step: `grep -n '#1a56b0\|#c0392b' packages/client/src/` as a verification step in the refactor task.

**Warning signs:** One team shows the correct badge color but score numerals or team-label text still renders in old blue/red.

### Pitfall 6: `TEAM_DEFAULTS` Placed Inside a Component Rendering Loop

**What goes wrong:** `TEAM_DEFAULTS` defined inside `PieceOverlay` or `HexGrid` re-creates the object on every render, causing unnecessary re-renders for Zustand selectors that compare by reference.

**Why it happens:** Module-level vs. component-level scoping.

**How to avoid:** Define `TEAM_DEFAULTS` as a module-level constant in a dedicated file (e.g., `packages/client/src/teamDefaults.ts`) or at the top of `GameBoard.tsx` module scope. Import it wherever needed.

---

## Code Examples

### TeamConfig type and TEAM_CONFIGS record (to create at `packages/shared/src/teamConfig.ts`)

```typescript
// Source: CONTEXT.md D-03/D-04 [ASSUMED — direct implementation of locked decisions]
export type TeamId = 'cosmos' | 'xolos' | 'city' | 'crew';

export interface TeamConfig {
  id: TeamId;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  /** Filename key only (e.g. 'cosmos.png'). Asset import happens in TeamBadge component. */
  badgeFile: string;
}

export const TEAM_CONFIGS: Record<TeamId, TeamConfig> = {
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos',
    primaryColor: '#1e3a8a',
    secondaryColor: '#c8a84b',
    badgeFile: 'cosmos.png',
  },
  xolos: {
    id: 'xolos',
    name: 'Xolos',
    primaryColor: '#ea580c',
    secondaryColor: '#6b7280',
    badgeFile: 'xolos.png',
  },
  city: {
    id: 'city',
    name: 'City',
    primaryColor: '#dc143c',
    secondaryColor: '#f5c518',
    badgeFile: 'city.png',
  },
  crew: {
    id: 'crew',
    name: 'Crew',
    primaryColor: '#f5c518',
    secondaryColor: '#111111',
    badgeFile: 'crew.png',
  },
};
```

### Barrel export addition (`packages/shared/src/index.ts`)

```typescript
// ADD at bottom of packages/shared/src/index.ts [VERIFIED: codebase — existing barrel pattern]
export * from './teamConfig.js';
```

### TEAM_DEFAULTS constant (client-only)

```typescript
// Source: CONTEXT.md D-05 [ASSUMED — direct spec]
// File: packages/client/src/teamDefaults.ts  (new module-level constant)
import type { TeamId } from '@counter-attack/shared';

export const TEAM_DEFAULTS: Record<'home' | 'away', TeamId> = {
  home: 'cosmos',
  away: 'xolos',
};
```

### Color lookup replacing hardcoded literals (D-06 refactor pattern)

```typescript
// BEFORE (existing):
const teamColor = activeTeam === 'home' ? '#1a56b0' : '#c0392b';

// AFTER (D-06 compliant):
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { TEAM_DEFAULTS } from '../teamDefaults.js';
const teamColor = TEAM_CONFIGS[TEAM_DEFAULTS[activeTeam]].primaryColor;
```

### Checking for `vite-env.d.ts` (PNG import support)

```typescript
// Expected at packages/client/src/vite-env.d.ts [VERIFIED: codebase — standard Vite scaffold]
/// <reference types="vite/client" />
```

If this file is absent, Wave 0 must create it. Without it, TypeScript rejects `import cosmosBadge from '*.png'` with "Cannot find module".

---

## State of the Art

| Old Approach                                              | Current Approach                                         | When Changed | Impact                                                                |
| --------------------------------------------------------- | -------------------------------------------------------- | ------------ | --------------------------------------------------------------------- |
| Generic `TeamShieldIcon` with color prop                  | `TeamBadge` with PNG img                                 | Phase 15     | Real team badge images replace placeholder shield                     |
| Hardcoded home/away colors (`#1a56b0`, `#c0392b`)         | `TEAM_CONFIGS[TEAM_DEFAULTS[teamId]].primaryColor`       | Phase 15     | Single source of truth; Phase 16 dynamic selection is a one-line swap |
| Two positional jersey patterns (home-stripe, away-stripe) | Four named team jersey patterns (cosmos/xolos/city/crew) | Phase 15     | Outfield pieces display their team's actual uniform design            |
| Solid GK fills (purple/amber)                             | Checker/stripe GK patterns                               | Phase 15     | Visually richer; matches physical board convention more closely       |

**Deprecated/outdated:**

- `TeamShieldIcon` component in `GameBoard.tsx` — replaced by `TeamBadge`. The old component can be deleted after D-07 is implemented.
- `HOME_COLOR = '#1a56b0'` and `AWAY_COLOR = '#c0392b'` constants in `ActionLog.tsx` — replaced by `TEAM_CONFIGS` lookup after D-06 refactor.

---

## Assumptions Log

| #   | Claim                                                                                                      | Section                           | Risk if Wrong                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| A1  | Cosmos horizontal stripe: `y=6, height=12` (centered in 24px tile) creates a visually centered wide stripe | Code Examples / Pattern 2         | Stripe may appear off-center; adjust y/height during implementation                         |
| A2  | Xolos checker: `width=16 height=16` tile gives two full checker squares across the circle diameter         | Code Examples / Pattern 3         | Checker may be too large or small; tile size is adjustable to 8×8 or 12×12                  |
| A3  | City gold arch: quadratic bezier Q curve produces a "gentle arch" in lower third                           | Code Examples / Pattern 4         | Curve shape may need control-point tuning; spec says "curved path", not bezier specifically |
| A4  | Crew shoulder mask: gold `<rect>` overlay on lower 70% is simpler than `<clipPath>` for this constraint    | Architecture Patterns / Pattern 5 | If the rect approach clips the selection ring incorrectly, switch to clipPath               |
| A5  | Away GK orange edge stripes: two fixed-position `<rect>` siblings are simpler than a `<pattern>`           | Architecture Patterns / Pattern 7 | If the rects extend visually beyond the circle stroke, a clipPath will be needed            |
| A6  | `PlayerStatsPanel.tsx` MiniTokenBadge also needs GK checker/stripe updates                                 | Common Pitfalls / Pitfall 2       | GK tokens in stats panel will show outdated solid fill — visual inconsistency               |
| A7  | `vite-env.d.ts` with `/// <reference types="vite/client" />` exists in the project                         | Code Examples                     | TypeScript will reject PNG imports — Wave 0 must create the file if absent                  |

---

## Open Questions

1. **Does `vite-env.d.ts` exist in `packages/client/src/`?**
   - What we know: Vite scaffold typically creates this file; the project was created with Vite.
   - What's unclear: It may have been deleted or never created if the Vite template was applied manually.
   - Recommendation: Wave 0 task should check and create if absent.

2. **Should `PlayerStatsPanel.tsx` MiniTokenBadge also update GK patterns?**
   - What we know: CONTEXT.md integration notes mention `PlayerStatsPanel.tsx` for the D-06 color refactor + D-07 badge component. D-10 GK jersey changes are described for `PieceOverlay.tsx` specifically.
   - What's unclear: Whether the MiniTokenBadge in `PlayerStatsPanel.tsx` should also receive the GK checker/stripe patterns.
   - Recommendation: Include it. Pitfall 2 explains the risk. The mini token should mirror the main board token visually.

3. **Color values in D-04 are described as "approximate — planner should verify against badge images"**
   - What we know: Badge PNGs are user-provided and present on disk.
   - What's unclear: Whether the colors precisely match the badge images.
   - Recommendation: The planner should note this as a verification step — inspect badge files visually during implementation and adjust color values if needed. This is a low-risk aesthetic concern, not a correctness blocker.

---

## Environment Availability

> Step 2.6: No new external tools, runtimes, or services required. Badge PNG assets confirmed present at `packages/client/src/assets/badges/` (cosmos.png, xolos.png, city.png, crew.png). [VERIFIED: codebase — confirmed by directory listing]

This phase is pure code/asset work with no external service dependencies.

---

## Validation Architecture

### Test Framework

| Property           | Value                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Framework          | Vitest + @testing-library/react                                                                      |
| Config file        | `packages/client/vite.config.ts` (vitest section implied from existing test files)                   |
| Quick run command  | `pnpm --filter @counter-attack/client test --run`                                                    |
| Full suite command | `pnpm --filter @counter-attack/client test --run && pnpm --filter @counter-attack/shared test --run` |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                  | Test Type | Automated Command                                 | File Exists?                                         |
| ------- | --------------------------------------------------------- | --------- | ------------------------------------------------- | ---------------------------------------------------- |
| TEAM-01 | `TEAM_CONFIGS` exports all four teams with correct fields | unit      | `pnpm --filter @counter-attack/shared test --run` | ❌ Wave 0 — `packages/shared/src/teamConfig.test.ts` |
| TEAM-02 | Cosmos piece renders `url(#cosmos-jersey-<id>)` fill      | unit      | `pnpm --filter @counter-attack/client test --run` | ❌ Wave 0 — extend `PieceOverlay.test.tsx`           |
| TEAM-03 | Xolos piece renders `url(#xolos-jersey-<id>)` fill        | unit      | `pnpm --filter @counter-attack/client test --run` | ❌ Wave 0 — extend `PieceOverlay.test.tsx`           |
| TEAM-04 | City piece renders `url(#city-jersey-<id>)` fill          | unit      | `pnpm --filter @counter-attack/client test --run` | ❌ Wave 0 — extend `PieceOverlay.test.tsx`           |
| TEAM-05 | Crew piece renders `url(#crew-jersey-<id>)` fill          | unit      | `pnpm --filter @counter-attack/client test --run` | ❌ Wave 0 — extend `PieceOverlay.test.tsx`           |
| TEAM-06 | `GameBoard` scoreboard renders `<img>` badge elements     | unit      | `pnpm --filter @counter-attack/client test --run` | ❌ Wave 0 — extend `GameBoard.test.tsx`              |
| TEAM-06 | Home GK renders checker pattern (not solid `#9b59b6`)     | unit      | `pnpm --filter @counter-attack/client test --run` | ❌ Wave 0 — extend `PieceOverlay.test.tsx`           |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/client test --run`
- **Per wave merge:** Full suite (client + shared)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/shared/src/teamConfig.test.ts` — covers TEAM-01 (type shape + TEAM_CONFIGS entries)
- [ ] Extend `packages/client/src/components/PieceOverlay.test.tsx` — covers TEAM-02..05 + D-10 GK pattern tests
- [ ] Extend `packages/client/src/components/GameBoard.test.tsx` — covers TEAM-06 (badge `<img>` in scoreboard)
- [ ] `packages/client/src/vite-env.d.ts` — check/create if absent (PNG import TypeScript support)

**Note on PNG import mocking in tests:** Vitest does not process Vite asset imports the same way as the full build. `import cosmosBadge from '../assets/badges/cosmos.png'` in tests returns the string `'/src/assets/badges/cosmos.png'` (the module mock path). Tests asserting badge display should check that the `<img>` `src` attribute is a non-empty string, not the exact URL. Alternatively, mock the PNG module in test setup.

---

## Security Domain

> This phase involves no authentication, no user input validation, no cryptography, no network endpoints, and no server changes. ASVS categories V2, V3, V4, V5, V6 do not apply.

Static asset display (PNG images) and hardcoded color constants carry no security risk. Security enforcement: not applicable for this phase.

---

## Sources

### Primary (HIGH confidence — codebase reads)

- `packages/client/src/components/PieceOverlay.tsx` — existing SVG pattern infrastructure (lines 66–98), piece color logic, GK detection, per-piece id convention
- `packages/client/src/components/GameBoard.tsx` — `TeamShieldIcon` location (line 45), all hardcoded color occurrences, scoreboard structure
- `packages/client/src/components/ActionLog.tsx` — `HOME_COLOR`/`AWAY_COLOR` constants
- `packages/client/src/components/PlayerStatsPanel.tsx` — `MiniTokenBadge` GK color logic
- `packages/shared/src/index.ts` — barrel export pattern
- `packages/client/src/assets/badges/` — confirmed presence of cosmos.png, xolos.png, city.png, crew.png
- `packages/client/vite.config.ts` — Vite alias + build config confirming static asset handling

### Secondary (MEDIUM confidence — CONTEXT.md decisions)

- `.planning/phases/15-team-identity/15-CONTEXT.md` — all locked decisions D-01 through D-10

### Tertiary (LOW confidence — training knowledge / assumed)

- SVG `<pattern>` checker and diagonal stripe patterns — standard SVG pattern geometry, not verified against external source this session
- Vite PNG import behavior — well-established, but not re-verified via Context7 this session

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; existing React/Vite/TypeScript stack fully verified
- Architecture: HIGH — all decisions locked; codebase extension points confirmed by reading source
- SVG patterns: MEDIUM — geometry approach assumed from training knowledge; tile sizes are adjustable
- Pitfalls: HIGH — derived directly from codebase analysis of existing pattern infrastructure

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable domain — SVG patterns and Vite asset imports are not volatile)
