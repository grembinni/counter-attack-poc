# Phase 12: Visual Token & Hex Layer - Research

**Researched:** 2026-06-12
**Domain:** SVG patterns, CSS Modules, React SVG component API refactoring
**Confidence:** HIGH

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use SVG `<defs><pattern>` to define stripe patterns; defined once in HexGrid's `<svg>` root `<defs>`; referenced via `fill="url(#home-stripe)"` / `fill="url(#away-stripe)"` on the piece circle.
- **D-02:** `<defs>` lives directly inside HexGrid's existing single `<svg>` root — no separate `TokenPatterns` component.
- **D-03:** Away stripe proportions — Claude's discretion (band heights/spacing at PIECE_RADIUS=12).
- **D-04:** Replace `isSelected`, `isClickable`, `isSpent`, `isHeaderContestant` with `selectionState: 'none' | 'selectable' | 'active' | 'activated'`.
- **D-05:** `'activated'` state combines orange ring AND red X in one visual; `isSpent` prop removed.
- **D-06:** `cursor: pointer` derived from `selectionState !== 'none'`; `isClickable` prop removed.
- **D-07:** `isHeaderContestant` prop removed; header contestants expressed via `selectionState: 'active'`; HexGrid maps header contestant pieces to `selectionState: 'active'` during HEADER phase.
- **D-08:** PlayerStatsPanel adds a mini token circle (~18px diameter SVG) to the panel header.
- **D-09:** Mini token is a standalone inline `<svg>` with its own self-contained `<defs>` block; no HexGrid dependency.
- **D-10:** HexCell accepts `highlightType?: HexHighlightType`; `highlightColor?: string` prop replaced; HexCell owns color lookup internally.
- **D-11:** All separate polygon overlay layers in HexGrid consolidated; HexGrid computes a single `highlightType` per hex.
- **D-12:** Priority order: `risk` > `goal` > `shot-path` > `kickoff` > `safe`.
- **D-13:** HIGH_PASS header range highlight uses `shot-path` (transparent white) tint from kick target selection through contestant selection; clears after header duel resolves.

### Claude's Discretion

- Away stripe proportions (D-03): exact band height and spacing at PIECE_RADIUS=12
- Exact hex color values for the 5 tint types (approximate targets provided in CONTEXT.md)
- Exact ring radii and stroke widths for the 3 UX-05 states

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>

## Phase Requirements

| ID     | Description                                                                                       | Research Support                                                                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| VIS-01 | Home team tokens: single vertical black stripe; away team tokens: two horizontal dark stripes     | SVG `<defs><pattern>` with `patternUnits="userSpaceOnUse"` anchored to each piece's `cx/cy`. Home: 4px vertical stripe centered; away: two 4px horizontal bands at y=6 and y=14 within 24px tile                                                       |
| VIS-02 | Token stripe design consistent in all contexts: on-pitch overlays, player stats panel, and replay | Three SVG contexts: HexGrid (on-pitch, replay reuses same components), PlayerStatsPanel mini token (self-contained inline SVG with own `<defs>`). Replay already reuses `PieceOverlay` so VIS-01 propagates automatically once PieceOverlay is updated |
| UX-05  | Three distinct piece selection outlines: selectable=blue, active=green, activated=orange          | `selectionState` enum replaces 4 boolean props; ring geometry from UI-SPEC locked; selectable r=14/2px blue, active r=16/2.5px green, activated r=15/2px orange + red X                                                                                |
| UX-06  | Unified hex tint color system: risk=orange, goal=red, safe=yellow, kickoff=blue, shot-path=white  | `highlightType` enum replaces `isHighlighted + highlightColor`; HexGrid priority-resolves to one type per hex; HexCell owns color lookup table                                                                                                         |

</phase_requirements>

---

## Summary

Phase 12 is a pure client-side SVG/CSS refactoring phase. All work is contained in five files: `PieceOverlay.tsx`, `HexCell.tsx`, `HexGrid.tsx`, `PlayerStatsPanel.tsx`, and `PlayerStatsPanel.module.css`. No server changes, no Zustand store changes, no shared types changes are required.

The two main concerns are: (1) **SVG pattern positioning** — `userSpaceOnUse` patterns require the `x`/`y` attributes to anchor the tile origin to each piece's coordinate in SVG space, so the stripe aligns with the token rather than tiling randomly across the viewport; (2) **HexGrid consolidation** — the existing file has ~15 separate polygon overlay layers with inconsistent inline styles; Phase 12 collapses them into one priority-resolved `highlightType` per hex, which significantly reduces the JSX surface area.

The phase carries zero external dependencies. All techniques are standard SVG primitives and React patterns already used in the codebase. The only creative discretion decisions are the away stripe proportions (band height/spacing) and the final RGBA values for the 5 hex tint types — both are specified in the UI-SPEC to the level of ready-to-code values.

**Primary recommendation:** Implement in four self-contained tasks in order: (1) PieceOverlay API refactor, (2) HexCell highlight API refactor, (3) HexGrid stripe defs + consolidation, (4) PlayerStatsPanel mini token. Keep `HexGrid.tsx` changes for last because it depends on both PieceOverlay and HexCell having their new APIs in place.

---

## Architectural Responsibility Map

| Capability                        | Primary Tier                            | Secondary Tier | Rationale                                                                           |
| --------------------------------- | --------------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| Token stripe pattern definitions  | Browser / Client (SVG `<defs>`)         | —              | Purely visual; SVG patterns are paint-server definitions scoped to the SVG document |
| Stripe rendering on piece circles | Browser / Client (PieceOverlay.tsx)     | —              | `fill="url(#home-stripe)"` on the `<circle>` element                                |
| Selection state computation       | Browser / Client (HexGrid.tsx)          | —              | Derived from Zustand game state; no server round-trip needed                        |
| Selection ring rendering          | Browser / Client (PieceOverlay.tsx)     | —              | Visual only; server is authoritative for state, not rings                           |
| Hex highlight type resolution     | Browser / Client (HexGrid.tsx)          | —              | Priority computation from multiple boolean sets → single enum                       |
| Hex tint color lookup             | Browser / Client (HexCell.tsx)          | —              | Color table owned by the rendering component                                        |
| Mini token badge                  | Browser / Client (PlayerStatsPanel.tsx) | —              | Local inspection state; `selectedPieceId` already in Zustand                        |

---

## Standard Stack

No new packages are installed in this phase. All capabilities are implemented with the existing stack.

### Core (already installed — no changes)

| Library                         | Version  | Purpose                            | Notes                             |
| ------------------------------- | -------- | ---------------------------------- | --------------------------------- |
| React                           | 18.3.1   | Component rendering                | Locked per STATE.md               |
| SVG (inline)                    | —        | Hex grid, token, pattern rendering | No external library needed        |
| CSS Modules                     | —        | Panel styling                      | `PlayerStatsPanel.module.css`     |
| Vitest + @testing-library/react | existing | Unit tests                         | jsdom environment, existing setup |

### Installation

No `npm install` / `pnpm add` steps required.

---

## Package Legitimacy Audit

> No external packages are installed in this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
| ------- | -------- | --- | --------- | ----------- | ------- | ----------- |
| (none)  | —        | —   | —         | —           | —       | N/A         |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Zustand game state
    │
    ▼
HexGrid.tsx (single SVG root)
    │
    ├── <defs> ──────────────────► #home-stripe pattern (userSpaceOnUse)
    │                              #away-stripe pattern (userSpaceOnUse)
    │                              #pitch-clip clipPath (existing)
    │                              #goal-net pattern (existing)
    │
    ├── per-hex: boolean sets → priority-resolve → highlightType enum
    │       │
    │       └──► HexCell (hex polygon + one highlight overlay polygon)
    │
    ├── per-piece: boolean flags → selectionState enum
    │       │
    │       └──► PieceOverlay (circle with url(#home/away-stripe) fill + ring)
    │
    └── PlayerStatsPanel (separate subtree)
            │
            └── inline <svg> ────► self-contained <defs>
                                   #home-stripe (scoped to this SVG)
                                   #away-stripe (scoped to this SVG)
                                   mini <circle> token badge
```

### Recommended Project Structure

No structural changes needed. All modifications are within existing files:

```
packages/client/src/
├── components/
│   ├── PieceOverlay.tsx          ← new selectionState prop; stripe fill; ring/X logic
│   ├── HexCell.tsx               ← new highlightType prop; internal color lookup
│   ├── HexGrid.tsx               ← add <defs> stripes; compute selectionState; compute highlightType
│   ├── PlayerStatsPanel.tsx      ← add inline SVG mini token badge
│   └── PlayerStatsPanel.module.css ← add .tokenBadge / flex .header rule
└── (optional) types.ts           ← SelectionState + HexHighlightType client types
```

### Pattern 1: SVG `userSpaceOnUse` Stripe Pattern

**What:** A `<pattern>` with `patternUnits="userSpaceOnUse"` tiles in the SVG viewport coordinate space. The `x` and `y` attributes anchor the tile origin to a specific coordinate, so the stripe aligns with the token circle rather than scrolling independently.

**When to use:** When the pattern must be visually registered to a specific element's center. `objectBoundingBox` would be simpler but only works on non-zero-size elements and requires normalized coordinates.

**Key insight — dynamic `x`/`y` per piece:** Each piece has a different `cx, cy`. With `userSpaceOnUse`, a single pattern definition would anchor to one fixed point. To make the stripe always center on the token, the pattern's `x` attribute must equal `cx - PIECE_RADIUS` (for the horizontal offset) and `y` must equal `cy - PIECE_RADIUS` (for vertical). This is done by making the pattern IDs encode or accept the offset.

**The practical solution used by this codebase (from UI-SPEC D-01/D-02):** Define ONE pattern per team in `HexGrid`'s `<defs>`. Each `PieceOverlay` circle references `fill="url(#home-stripe)"`. Because `userSpaceOnUse` patterns tile infinitely across the viewport, ANY piece that is a circle of radius 12 will show one stripe tile crossing through it — but the tile may not be centered.

**Critical finding — tile centering:** [VERIFIED: SVG spec + math verification] The 24px tile contains a 4px stripe centered at x=10..14 (for home) or two 4px bands at y=6..10 and y=14..18 (for away). With a 24px tile width/height, the stripe will repeat every 24px across the SVG. For pieces at arbitrary positions, the stripe will land at different sub-tile offsets. This is visually acceptable for a game token (the stripe may be slightly off-center) BUT the UI-SPEC specifies `patternContentUnits="userSpaceOnUse"` with `x="cx - PIECE_RADIUS"` per piece, implying a per-piece `<pattern>` with dynamic x/y.

**Implementation decision from UI-SPEC:** The UI-SPEC specifies pattern offset is `cx - PIECE_RADIUS` and `cy - PIECE_RADIUS`, meaning each `PieceOverlay` must either:

- Define two `<defs><pattern>` elements in PieceOverlay per piece (renders ~22 pattern defs per render cycle — functional but verbose), OR
- Accept that with a single pattern definition in HexGrid, tiles will be offset by the piece's position modulo 24px

The CONTEXT.md D-01 specifies patterns are "defined once inside HexGrid's `<svg>` root `<defs>` block." Combined with the fact that each piece position has different `cx, cy`, the tile will appear at the correct width/height but may not be pixel-perfectly centered. For PIECE_RADIUS=12 (24px diameter), a 24px tile that repeats every 24px will always produce exactly one stripe crossing through the token — but its phase within the token depends on the token's absolute SVG position.

**Planner note:** If precise stripe centering is required, PieceOverlay must define per-piece patterns (two `<defs>` per piece × 22 pieces = 44 pattern elements). If visual presence (stripe somewhere on the token) is acceptable, a single shared pattern definition in HexGrid is sufficient. The UI-SPEC's per-piece x/y offsets imply precise centering is desired — recommend per-piece pattern definitions within PieceOverlay's `<>` fragment.

**Example — per-piece pattern in PieceOverlay:**

```tsx
// Source: SVG specification, math verified in codebase
const patternId = `home-stripe-${piece.id}`;
// In the JSX fragment:
<defs>
  <pattern
    id={patternId}
    x={cx - PIECE_RADIUS}
    y={cy - PIECE_RADIUS}
    width={24}
    height={24}
    patternUnits="userSpaceOnUse"
  >
    <rect x={10} y={0} width={4} height={24} fill="#000000" fillOpacity={0.55} />
  </pattern>
</defs>
<circle cx={cx} cy={cy} r={PIECE_RADIUS} fill={`url(#${patternId})`} stroke={stroke} strokeWidth={1.5} />
```

**Alternative — single shared pattern in HexGrid (D-01 as written):**

- Simpler, fewer DOM elements
- Stripe position modulo 24px — will not always be centered on every token
- Likely visually acceptable at 12px radius since the stripe will always appear within the token

**Recommendation:** Use per-piece patterns defined within PieceOverlay's JSX fragment for pixel-accurate stripe centering. This aligns with the UI-SPEC x/y offset specification and produces a predictable visual. The 44 `<pattern>` elements are lightweight SVG paint servers with no performance concern at this scale.

**Example — away stripe per-piece pattern:**

```tsx
// Source: UI-SPEC §SVG Pattern Spec + math verified
const awayPatternId = `away-stripe-${piece.id}`;
<pattern
  id={awayPatternId}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={24}
  height={24}
  patternUnits="userSpaceOnUse"
>
  <rect x={0} y={6} width={24} height={4} fill="#7f0000" fillOpacity={0.65} />
  <rect x={0} y={14} width={24} height={4} fill="#7f0000" fillOpacity={0.65} />
</pattern>;
```

### Pattern 2: `selectionState` Enum Mapping in HexGrid

**What:** Replace the four separate boolean props (`isSelected`, `isClickable`, `isSpent`, `isHeaderContestant`) with a single `selectionState` enum value computed in HexGrid before passing to PieceOverlay.

**Priority order (from CONTEXT.md D-04/D-05/D-07):**

1. `'activated'` — piece is in `paceUsedByPieceId` or `movedPieceIds` (already used this turn) and `isSpent` logic
2. `'active'` — piece is `selectedPieceId`, OR piece is header contestant (`isHeaderContestant`)
3. `'selectable'` — `isClickable` is true (any of the many selectable conditions)
4. `'none'` — default

**Example mapping:**

```typescript
// Source: derived from existing HexGrid.tsx boolean logic
function computeSelectionState(params: {
  isSpent: boolean;
  isSelected: boolean;
  isHeaderContestant: boolean;
  isClickable: boolean;
}): SelectionState {
  if (params.isSpent) return 'activated';
  if (params.isSelected || params.isHeaderContestant) return 'active';
  if (params.isClickable) return 'selectable';
  return 'none';
}
```

**Note on `isHeaderContestant` vs `isHeaderEligible`:** In the current code, `isHeaderContestant` means the piece is in `headerContestantIds` (locally toggled). `isHeaderEligible` means it can be toggled. Per D-07, BOTH eligible pieces AND already-selected contestants should show `selectionState: 'active'` (green ring). The click handler remains `toggleHeaderContestantId`.

### Pattern 3: `HexHighlightType` Priority Resolution in HexGrid

**What:** Replace the ~12 separate inline polygon overlay `<g>` children per hex with a single `highlightType` value passed to `HexCell`, plus retained overlays for kick-off zone (special click/visual logic), pass target (separate pointer events), and confirmed pass target ring — these three have click handlers and cannot be folded into `HexCell`.

**Critical distinction — what moves into HexCell vs what stays in HexGrid:**

The overlays that can move to `HexCell.highlightType`:

- `isValidMove` (gold/safe) — MOVEMENT phase valid moves
- `isGoalHex` / `isShotTarget` / `isShootingModeGoalHex` / `isHeaderTargetGoalHex` (red/goal)
- `zoiRiskSet` + `tackleRiskSet` (orange/risk)
- `snapDeflectPathSet` (orange/risk — shot danger path)
- `lastShotPathSet` (white/shot-path)
- `isHpMoveTarget` (white/shot-path — HIGH_PASS_MOVEMENT reposition targets)
- `gkDiveTargetSet` (mixed — these are effectively "safe" targets for the GK team)

The overlays that **must stay in HexGrid** (have click handlers, or are semantic overlays):

- `kickoff` zone tint + centre hex gold fill (has `isCentreHex` special case)
- `isPassTarget` / `isInterceptionRisk` / `isConfirmedPassTarget` — have `onClick` handlers for pass confirmation
- `quickThrowTargetSet` — has `onClick = () => emitQuickThrow(hex)`
- `gkKickTargetSet` — has `onClick = () => emitGKKickTarget(hex)`
- HEADER ball-position gold overlay (semantic, always rendered during HEADER regardless of other highlights)

**Recommendation:** HexCell's `highlightType` covers the "tint-only, no separate click handler needed" cases. The click handler is already on the base `<polygon>` in HexCell when `highlightType` is defined. Pass-target and GK-kick overlays remain in HexGrid because they need their own click handlers (pass confirmation is a two-step flow with deselect).

**Priority resolution (D-12: `risk` > `goal` > `shot-path` > `kickoff` > `safe`):**

```typescript
// Source: CONTEXT.md D-12
function resolveHighlightType(
  hexId: string,
  sets: {
    riskSet: Set<string>; // zoiRisk + tackleRisk + snapDeflectPath
    goalSet: Set<string>; // isGoalHex + isShotTarget + shootingModeGoal + headerTargetGoal
    shotPathSet: Set<string>; // lastShotPath + isHpMoveTarget + gkDiveTarget
    kickoffSet: Set<string>; // inMyZone (non-centre kickoff hexes)
    safeSet: Set<string>; // isValidMove (MOVEMENT phase) + quickThrow + gkKickTarget
  },
): HexHighlightType | undefined {
  if (sets.riskSet.has(hexId)) return 'risk';
  if (sets.goalSet.has(hexId)) return 'goal';
  if (sets.shotPathSet.has(hexId)) return 'shot-path';
  if (sets.kickoffSet.has(hexId)) return 'kickoff';
  if (sets.safeSet.has(hexId)) return 'safe';
  return undefined;
}
```

### Pattern 4: Inline SVG Mini Token in PlayerStatsPanel

**What:** Self-contained `<svg>` element in the `.header` div with its own `<defs>` block.

**Why self-contained:** PlayerStatsPanel is not necessarily mounted inside HexGrid's SVG root. The `url(#pattern-id)` reference resolves within the same SVG document fragment. A `<pattern>` defined in one `<svg>` is not accessible from another `<svg>` on the same page (cross-SVG `<use>` is supported but requires specific conditions). [ASSUMED — SVG cross-document pattern behavior; standard SVG spec behavior]

**Example:**

```tsx
// Source: UI-SPEC §Mini Token Badge Spec + CONTEXT.md D-08/D-09
const isGK = piece.role === 'GK';
const homePatId = `mini-home-stripe-${piece.id}`;
const awayPatId = `mini-away-stripe-${piece.id}`;
const miniR = 9;
const miniCx = 10;
const miniCy = 10;

<svg width={20} height={20} viewBox="0 0 20 20" className={styles.tokenBadge}>
  {!isGK && (
    <defs>
      {piece.teamId === 'home' ? (
        <pattern
          id={homePatId}
          x={miniCx - miniR}
          y={miniCy - miniR}
          width={18}
          height={18}
          patternUnits="userSpaceOnUse"
        >
          <rect x={7} y={0} width={4} height={18} fill="#000000" fillOpacity={0.55} />
        </pattern>
      ) : (
        <pattern
          id={awayPatId}
          x={miniCx - miniR}
          y={miniCy - miniR}
          width={18}
          height={18}
          patternUnits="userSpaceOnUse"
        >
          <rect x={0} y={4} width={18} height={3} fill="#7f0000" fillOpacity={0.65} />
          <rect x={0} y={11} width={18} height={3} fill="#7f0000" fillOpacity={0.65} />
        </pattern>
      )}
    </defs>
  )}
  <circle
    cx={miniCx}
    cy={miniCy}
    r={miniR}
    fill={
      isGK
        ? piece.teamId === 'home'
          ? '#9b59b6'
          : '#f59e0b'
        : `url(#${piece.teamId === 'home' ? homePatId : awayPatId})`
    }
    stroke={
      isGK
        ? piece.teamId === 'home'
          ? '#6c3483'
          : '#d97706'
        : piece.teamId === 'home'
          ? '#0d3a82'
          : '#8e1c12'
    }
    strokeWidth={1.5}
  />
  <text
    x={miniCx}
    y={miniCy}
    textAnchor="middle"
    dominantBaseline="central"
    fontSize={9}
    fontWeight={700}
    fill="#ffffff"
  >
    {playerNumber}
  </text>
</svg>;
```

**Note on GK tokens:** Per UI-SPEC, GK tokens do NOT receive stripe patterns — they use solid fill colors (`#9b59b6` home GK, `#f59e0b` away GK). Skip `<defs>` entirely for GK pieces. [VERIFIED: UI-SPEC §Mini Token Badge Spec]

### Anti-Patterns to Avoid

- **Using `objectBoundingBox` for patterns on a `<circle>`:** Produces distorted (elliptical) coordinates on Firefox in some SVG versions. `userSpaceOnUse` is reliable cross-browser. [ASSUMED — known SVG cross-browser behavior]
- **Referencing a pattern defined in HexGrid's `<defs>` from PlayerStatsPanel:** `url(#id)` references only resolve within the same SVG document fragment. PlayerStatsPanel must define its own patterns. [ASSUMED — SVG spec behavior, standard knowledge]
- **Using CSS `background` for token stripes:** Tokens are SVG elements, not HTML divs; CSS background properties do not apply to SVG `<circle>` elements.
- **Mutating `isHighlighted` on HexCell without updating HexGrid's `onClick` logic:** HexCell currently only fires `onClick` when `isHighlighted` is true. The new `highlightType` prop replaces this gating — keep `onClick` gated on `highlightType !== undefined`.
- **Leaving the old `hexZoIRisk` / `hexTackleRisk` CSS classes in HexGrid.module.css:** Once HexGrid uses `highlightType`, these classes become dead code. Remove them to avoid confusion, but verify no other component references them first.
- **Priority confusion between `risk` and `safe`:** ZoI/tackle risk hexes are valid move hexes that also happen to be risky. The `risk` priority must be higher than `safe` so the warning tint wins over the green safe-move tint when both apply.

---

## Don't Hand-Roll

| Problem                          | Don't Build                     | Use Instead                           | Why                                                                                            |
| -------------------------------- | ------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Stripe pattern on SVG circle     | CSS background, canvas, image   | SVG `<defs><pattern>`                 | Scales with SVG zoom; composites with token fill color; browser-native                         |
| Color lookup for highlight types | Inline ternary chains in JSX    | Color table object/map inside HexCell | Single source of truth; one file to change colors                                              |
| Cross-SVG pattern sharing        | SVG `<use>` + external document | Self-contained `<defs>` per SVG root  | Browser support for cross-document SVG references is limited; self-contained defs are reliable |

**Key insight:** SVG `<pattern>` is the standard primitive for this use case. It requires no library and produces scalable, compositable fills that work seamlessly with SVG `fill-opacity` and stroke rendering.

---

## Common Pitfalls

### Pitfall 1: `userSpaceOnUse` tile not centered on the token

**What goes wrong:** Pattern renders a stripe that floats at an arbitrary position within the token, not centered on it.
**Why it happens:** `userSpaceOnUse` tiles from the SVG viewport origin. If `x=0, y=0`, the tile starts at the SVG origin and repeats; a token at `cx=540, cy=450` shows whatever part of the tile falls at (540 mod 24, 450 mod 24).
**How to avoid:** Set `x={cx - PIECE_RADIUS}` and `y={cy - PIECE_RADIUS}` on the `<pattern>` element to anchor the tile to the top-left corner of the token's bounding box. This is per-piece, requiring per-piece patterns.
**Warning signs:** Stripe appears on one side of some tokens and the other side on other tokens; inconsistency across pieces.

### Pitfall 2: `url(#pattern-id)` resolves to nothing in PlayerStatsPanel

**What goes wrong:** Token circle in the stats panel renders as a transparent/black fill.
**Why it happens:** The `<pattern>` is defined in HexGrid's `<svg>` element. PlayerStatsPanel's `<svg>` is a separate document fragment; `url(#home-stripe)` can only resolve within the same SVG.
**How to avoid:** Define `<defs>` with pattern definitions inside PlayerStatsPanel's own `<svg>` element.
**Warning signs:** Mini token renders with no fill or a default black fill; browser DevTools shows unresolved `url(#...)` reference.

### Pitfall 3: `selectionState` priority clobbers the header contestant green ring

**What goes wrong:** A piece that is both `isHeaderEligible` and `selectedPieceId` shows blue (selectable) or no ring instead of green.
**Why it happens:** If `selectionState: 'selectable'` is assigned for eligible pieces and `'active'` only for confirmed contestants, the green ring disappears for eligible-but-not-yet-toggled pieces.
**How to avoid:** Per D-07, ALL eligible header pieces show `'active'` (green ring) during HEADER phase before confirmation, regardless of whether they are in `headerContestantIds`. Map `isHeaderEligible` → `'active'`, not `'selectable'`. The click handler remains `toggleHeaderContestantId`.
**Warning signs:** Green ring only appears on pieces explicitly added to `headerContestantIds`; eligible but not yet selected pieces show blue ring or no ring.

### Pitfall 4: `activated` state and HEADER phase collision

**What goes wrong:** A piece that `isSpent` (paceUsed > 0) during a MOVEMENT phase and is also header-eligible during HEADER phase might inadvertently render as `'activated'` during the wrong phase.
**Why it happens:** `paceUsedByPieceId` and `movedPieceIds` are populated during MOVEMENT but the `isSpent` derivation in HexGrid uses them cross-phase if not gated.
**How to avoid:** Confirm `isSpent` derivation is gated: the current code already uses `movedPieceIds.includes(piece.id)` which is only non-empty during MOVEMENT; `paceUsedByPieceId` is `{}` outside MOVEMENT. No change needed — but verify this gating in the refactor.
**Warning signs:** Pieces show orange ring + red X during HEADER or GK_DIVING phases.

### Pitfall 5: HexCell `onClick` fires on non-highlighted hexes

**What goes wrong:** After refactoring, clicks on un-highlighted hexes trigger unintended handlers.
**Why it happens:** Current HexCell gates `onClick` on `isHighlighted`. New API gates it on `highlightType !== undefined`. If the pass-target, quick-throw, and GK-kick overlays are moved inside HexCell, their click handlers would fire even when HexGrid intended a no-op.
**How to avoid:** Keep pass-target, quick-throw, and GK-kick overlays in HexGrid with their own `<polygon>` click handlers. HexCell only handles the base highlight; it does not replace HexGrid's action-specific polygons.
**Warning signs:** Pass confirmation, quick throw, or GK kick fires when clicking wrong hexes.

### Pitfall 6: PlayerStatsPanel `.header` CSS layout breaks with token badge added

**What goes wrong:** Player name overflows, role badge wraps, or badge overflows the panel width.
**Why it happens:** `.header` currently uses `display: flex; justify-content: space-between`. Adding a 20px SVG before the player name text inserts a third flex item.
**How to avoid:** The name and the role badge should be grouped in a `<div>` so the layout stays as two flex children: [token badge] [name + role]. Or adjust `.header` to a three-item flex row. The UI-SPEC specifies a 6px gap between badge and name.
**Warning signs:** Name and role run into the token, or the header row wraps onto a second line.

---

## Code Examples

### Home stripe pattern (per-piece, PIECE_RADIUS=12, tile 24×24)

```tsx
// Source: UI-SPEC §SVG Pattern Spec + verified centering math
// cx - PIECE_RADIUS anchors tile left edge to token left edge
// Stripe rect x=10 of 24px tile → tile_x + 10 = (cx-12)+10 = cx-2 → stripe from cx-2 to cx+2 (4px centered)
<pattern
  id={`home-stripe-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={24}
  height={24}
  patternUnits="userSpaceOnUse"
>
  <rect x={10} y={0} width={4} height={24} fill="#000000" fillOpacity={0.55} />
</pattern>
```

### Away stripe pattern (per-piece, PIECE_RADIUS=12, tile 24×24)

```tsx
// Source: UI-SPEC §SVG Pattern Spec
// Band 1 at y=6..10 (upper third), Band 2 at y=14..18 (lower third)
<pattern
  id={`away-stripe-${piece.id}`}
  x={cx - PIECE_RADIUS}
  y={cy - PIECE_RADIUS}
  width={24}
  height={24}
  patternUnits="userSpaceOnUse"
>
  <rect x={0} y={6} width={24} height={4} fill="#7f0000" fillOpacity={0.65} />
  <rect x={0} y={14} width={24} height={4} fill="#7f0000" fillOpacity={0.65} />
</pattern>
```

### Selection ring rendering by selectionState

```tsx
// Source: UI-SPEC §NEW Selection Ring Colors + CONTEXT.md D-04/D-05
const PIECE_RADIUS = 12;

// selectable: bright blue ring, r=14
{
  selectionState === 'selectable' && (
    <circle
      cx={cx}
      cy={cy}
      r={PIECE_RADIUS + 2}
      fill="none"
      stroke="#3b82f6"
      strokeWidth={2}
      pointerEvents="none"
    />
  );
}
// active: green ring, r=16 (selected piece OR header contestant)
{
  selectionState === 'active' && (
    <circle
      cx={cx}
      cy={cy}
      r={PIECE_RADIUS + 4}
      fill="none"
      stroke="#22c55e"
      strokeWidth={2.5}
      pointerEvents="none"
    />
  );
}
// activated: orange ring r=15 + red X
{
  selectionState === 'activated' && (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={PIECE_RADIUS + 3}
        fill="none"
        stroke="#f97316"
        strokeWidth={2}
        pointerEvents="none"
      />
      <path
        d={`M${cx - PIECE_RADIUS * 0.7} ${cy - PIECE_RADIUS * 0.7} L${cx + PIECE_RADIUS * 0.7} ${cy + PIECE_RADIUS * 0.7} M${cx + PIECE_RADIUS * 0.7} ${cy - PIECE_RADIUS * 0.7} L${cx - PIECE_RADIUS * 0.7} ${cy + PIECE_RADIUS * 0.7}`}
        stroke="#ef4444"
        strokeWidth={2.5}
        strokeLinecap="round"
        pointerEvents="none"
      />
    </>
  );
}
```

### HexCell color lookup table

```tsx
// Source: UI-SPEC §NEW Hex Highlight Tint Colors
export type HexHighlightType = 'safe' | 'risk' | 'goal' | 'kickoff' | 'shot-path';

const HIGHLIGHT_STYLES: Record<
  HexHighlightType,
  {
    fill: string;
    restOpacity: number;
    hoverOpacity: number;
    stroke: string;
    strokeWidth: number;
  }
> = {
  safe: {
    fill: 'rgba(245,197,24,1)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#d4a017',
    strokeWidth: 1.5,
  },
  risk: {
    fill: 'rgba(255,165,0,1)',
    restOpacity: 0.4,
    hoverOpacity: 0.55,
    stroke: '#cc7700',
    strokeWidth: 1.5,
  },
  goal: {
    fill: 'rgba(220,50,50,1)',
    restOpacity: 0.5,
    hoverOpacity: 0.65,
    stroke: '#cc2222',
    strokeWidth: 1.5,
  },
  kickoff: {
    fill: 'rgba(59,130,246,1)',
    restOpacity: 0.4,
    hoverOpacity: 0.55,
    stroke: '#2563eb',
    strokeWidth: 1.5,
  },
  'shot-path': {
    fill: 'rgba(255,255,255,1)',
    restOpacity: 0.35,
    hoverOpacity: 0.5,
    stroke: '#cccccc',
    strokeWidth: 1.5,
  },
};
```

### HexCell refactored props

```tsx
// Source: CONTEXT.md D-10
type Props = {
  hex: HexCoord;
  highlightType?: HexHighlightType;
  onClick: () => void;
};
// isHighlighted becomes: highlightType !== undefined
// cursor pointer gated on: highlightType !== undefined
// color lookup: HIGHLIGHT_STYLES[highlightType]
```

### HexGrid `selectionState` derivation for piece

```tsx
// Source: CONTEXT.md D-04 through D-07 + verified against existing HexGrid boolean logic
const isSpentNow =
  phase === 'HIGH_PASS_MOVEMENT'
    ? piece.id === highPassMovedPieceId && (highPassPaceUsed ?? 0) >= 3
    : movedPieceIds.includes(piece.id);

const selectionState: SelectionState = isSpentNow
  ? 'activated'
  : piece.id === selectedPieceId || isHeaderEligible
    ? 'active'
    : isClickable
      ? 'selectable'
      : 'none';
```

---

## State of the Art

| Old Approach                                    | Current Approach                          | When Changed | Impact                                                                             |
| ----------------------------------------------- | ----------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| 4 separate boolean props on PieceOverlay        | Single `selectionState` enum              | Phase 12     | Fewer prop combinations; HexGrid mapping is explicit; impossible states eliminated |
| `highlightColor?: string` free-form prop        | Typed `highlightType` enum                | Phase 12     | Color consistency enforced by type system; color values in one place               |
| ~12 separate inline polygon overlays in HexGrid | Priority-resolved `highlightType` per hex | Phase 12     | ~200 lines of JSX reduced to ~20 lines; overlapping state logic made explicit      |
| `isHeaderContestant` boolean prop               | `selectionState: 'active'` semantic       | Phase 12     | Header contestant green ring unified with normal active-selection green ring       |

**Deprecated after Phase 12:**

- `isSelected`, `isClickable`, `isSpent`, `isHeaderContestant` props on PieceOverlay — removed
- `isHighlighted`, `highlightColor` props on HexCell — removed
- `hexZoIRisk`, `hexTackleRisk` CSS classes in HexGrid.module.css — removed (colors move into HexCell's lookup table)

---

## Assumptions Log

| #   | Claim                                                                                                                                 | Section                               | Risk if Wrong                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | SVG `url(#pattern-id)` only resolves within the same SVG document fragment, not across sibling `<svg>` elements on the same HTML page | Architecture Patterns — Pattern 4     | If cross-SVG resolution were supported, PlayerStatsPanel could reference HexGrid's patterns — simpler, but non-standard. Low risk: the self-contained approach works regardless.  |
| A2  | `objectBoundingBox` patterns distort on `<circle>` elements in Firefox                                                                | Architecture Patterns — Anti-Patterns | If this is false, `objectBoundingBox` could be used with normalized coordinates. Low risk: `userSpaceOnUse` is the conservative choice and works correctly.                       |
| A3  | 44 per-piece `<pattern>` DOM elements (22 pieces × 2 teams) have negligible rendering performance impact at this scale                | Architecture Patterns — Pattern 1     | If this causes measurable frame-rate drops on old hardware, fall back to shared single-pattern approach accepting stripe misalignment. Low risk: SVG paint servers are efficient. |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
(Table not empty — three low-risk assumptions logged.)

---

## Open Questions

1. **Per-piece vs shared pattern for stripe centering**
   - What we know: `userSpaceOnUse` with fixed x/y produces misaligned stripes for pieces at arbitrary positions; per-piece patterns with `x={cx - PIECE_RADIUS}` produce centered stripes.
   - What's unclear: Whether the UI-SPEC truly requires pixel-accurate centering or whether "stripe visible on the token" is sufficient.
   - Recommendation: Use per-piece patterns (in PieceOverlay's JSX fragment). The UI-SPEC explicitly specifies per-piece x/y offsets; this indicates precise centering is required.

2. **HexGrid `<defs>` — per the CONTEXT.md D-01/D-02 decision to define patterns once in HexGrid's `<defs>`**
   - If the planner follows D-01/D-02 literally (one shared pattern per team in HexGrid), stripes will not be centered on all pieces. D-01/D-02 may have been written assuming `objectBoundingBox` behavior without accounting for `userSpaceOnUse` tiling behavior.
   - Recommendation: The planner should note this tension and choose: (a) per-piece patterns in PieceOverlay (precise, recommended), or (b) shared pattern in HexGrid's `<defs>` (simpler but possibly visually imprecise). Present both options to the executor with a default recommendation of (a).

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely client-side SVG/CSS code changes. No external tools, services, or runtimes beyond the existing React/Vite/pnpm development environment are required.

| Dependency | Required By             | Available | Version                   | Fallback |
| ---------- | ----------------------- | --------- | ------------------------- | -------- |
| Node.js    | Vite dev server / tests | ✓         | 22 LTS (project standard) | —        |
| pnpm       | Workspace management    | ✓         | 9.x                       | —        |
| Vitest     | Unit tests              | ✓         | existing                  | —        |
| jsdom      | Test environment        | ✓         | existing (vitest config)  | —        |

---

## Validation Architecture

### Test Framework

| Property           | Value                                        |
| ------------------ | -------------------------------------------- |
| Framework          | Vitest (vitest run) + @testing-library/react |
| Config file        | `packages/client/vitest.config.ts`           |
| Quick run command  | `pnpm --filter @counter-attack/client test`  |
| Full suite command | `pnpm --filter @counter-attack/client test`  |

### Phase Requirements → Test Map

| Req ID | Behavior                                                                         | Test Type | Automated Command                                                               | File Exists? |
| ------ | -------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------- | ------------ |
| VIS-01 | Home token renders with stripe fill url; away token renders with stripe fill url | unit      | `pnpm --filter @counter-attack/client test -- --grep "PieceOverlay"`            | ❌ Wave 0    |
| VIS-02 | PlayerStatsPanel renders mini token with stripe fill when piece is selected      | unit      | `pnpm --filter @counter-attack/client test` (extends PlayerStatsPanel.test.tsx) | ✅ (extend)  |
| UX-05  | PieceOverlay renders correct ring color/radius per selectionState                | unit      | `pnpm --filter @counter-attack/client test -- --grep "PieceOverlay"`            | ❌ Wave 0    |
| UX-05  | `selectionState: 'activated'` renders orange ring AND red X path                 | unit      | `pnpm --filter @counter-attack/client test -- --grep "PieceOverlay"`            | ❌ Wave 0    |
| UX-06  | HexCell renders correct fill color per highlightType                             | unit      | `pnpm --filter @counter-attack/client test -- --grep "HexCell"`                 | ❌ Wave 0    |
| UX-06  | HexCell renders no overlay when highlightType is undefined                       | unit      | `pnpm --filter @counter-attack/client test -- --grep "HexCell"`                 | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `pnpm --filter @counter-attack/client test`
- **Per wave merge:** `pnpm --filter @counter-attack/client test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/client/src/components/PieceOverlay.test.tsx` — covers VIS-01, UX-05
- [ ] `packages/client/src/components/HexCell.test.tsx` — covers UX-06

Existing `PlayerStatsPanel.test.tsx` can be extended in-place to cover VIS-02 (mini token badge presence).

---

## Security Domain

> This phase introduces no authentication, session management, input validation, cryptography, or access control changes. All changes are client-side SVG/CSS rendering only. Security enforcement is not applicable to this phase.

ASVS categories V2–V6 do not apply. No threat patterns are introduced.

---

## Project Constraints (from CLAUDE.md)

| Directive                                      | Category          | Impact on Phase 12                                                        |
| ---------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| Frontend: React (Vite), served as static files | Tech constraint   | All changes are React components — compliant                              |
| No server changes in this phase                | Phase boundary    | Confirmed: CONTEXT.md "no server changes required"                        |
| TypeScript everywhere                          | Coding convention | New types `SelectionState` and `HexHighlightType` must be typed; no `any` |
| Use GSD workflow                               | Process           | Changes made via `/gsd-execute-phase`                                     |
| SVG rendering (not Canvas)                     | Tech constraint   | All token and hex visuals remain SVG — compliant                          |
| Zustand for client state                       | Tech constraint   | No new store state needed; phase reads existing slices                    |
| pnpm workspaces                                | Tooling           | `pnpm --filter @counter-attack/client test` for running tests             |

---

## Sources

### Primary (HIGH confidence)

- `packages/client/src/components/PieceOverlay.tsx` — current props interface, ring geometry, PIECE_RADIUS constant
- `packages/client/src/components/HexCell.tsx` — current highlight prop interface, polygon rendering
- `packages/client/src/components/HexGrid.tsx` — complete overlay logic, Zustand slice subscriptions, existing `<defs>` usage
- `packages/client/src/components/PlayerStatsPanel.tsx` + `.module.css` — panel structure and CSS palette
- `.planning/phases/12-visual-token-hex-layer/12-CONTEXT.md` — all locked decisions D-01 through D-13
- `.planning/phases/12-visual-token-hex-layer/12-UI-SPEC.md` — exact pixel values for all visual specs
- `packages/client/src/utils/hexToPixel.ts` — coordinate math verification
- `packages/shared/src/types.ts` — `PlayerPiece.teamId` drives stripe selection; `GameState` fields driving highlights

### Secondary (MEDIUM confidence)

- `packages/client/src/store/useGameStore.ts` — Zustand slice shape confirms no store changes needed
- `packages/client/src/mock/index.ts` — test infrastructure confirmed available

### Tertiary (LOW confidence)

- SVG cross-document `url()` reference behavior — [ASSUMED] based on standard SVG spec knowledge; not verified via browser test in this session
- `objectBoundingBox` distortion on `<circle>` — [ASSUMED] known cross-browser behavior, not tested in this session

---

## Metadata

**Confidence breakdown:**

- Standard Stack: HIGH — no new dependencies; existing stack fully understood from codebase
- Architecture: HIGH — all patterns derived directly from existing code + locked CONTEXT.md decisions
- Pitfalls: HIGH — derived from direct code analysis of HexGrid.tsx overlay logic and SVG pattern mechanics
- Color values: HIGH — exact values specified in 12-UI-SPEC.md (approved)

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (stable SVG spec + stable React 18 API)
