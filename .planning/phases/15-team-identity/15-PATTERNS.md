# Phase 15: Team Identity - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 8 new/modified files
**Analogs found:** 7 / 8

## File Classification

| New/Modified File                                     | Role         | Data Flow        | Closest Analog                                                                    | Match Quality |
| ----------------------------------------------------- | ------------ | ---------------- | --------------------------------------------------------------------------------- | ------------- |
| `packages/shared/src/teamConfig.ts`                   | model/config | transform        | `packages/shared/src/teams.ts`                                                    | role-match    |
| `packages/client/src/teamDefaults.ts`                 | config       | transform        | `packages/client/src/components/ActionLog.tsx` lines 5-8 (module-level constants) | partial       |
| `packages/client/src/components/TeamBadge.tsx`        | component    | request-response | `packages/client/src/components/GameBoard.tsx` lines 45-56 (`TeamShieldIcon`)     | role-match    |
| `packages/client/src/components/PieceOverlay.tsx`     | component    | request-response | itself (lines 66-98) — extend existing SVG defs                                   | exact         |
| `packages/client/src/components/GameBoard.tsx`        | component    | request-response | itself — color refactor + badge swap                                              | exact         |
| `packages/client/src/components/ActionLog.tsx`        | component    | request-response | itself — color constant refactor                                                  | exact         |
| `packages/client/src/components/PlayerStatsPanel.tsx` | component    | request-response | itself (lines 27-60) — MiniTokenBadge GK defs                                     | exact         |
| `packages/shared/src/teamConfig.test.ts`              | test         | —                | `packages/shared/src/scoreUtils.test.ts`                                          | role-match    |

---

## Pattern Assignments

### `packages/shared/src/teamConfig.ts` (model/config, transform)

**Analog:** `packages/shared/src/teams.ts`

**Imports pattern** (`teams.ts` lines 1-1):

```typescript
import type { PlayerPiece } from './types.js';
```

New file does not need this import. Pattern to follow: no external deps, pure data export.

**Core pattern** (`teams.ts` lines 1-4 — static typed record + named exports):

```typescript
// teams.ts structure to mirror:
import type { PlayerPiece } from './types.js';

// Hardcoded squads on the 1-6 attribute scale (D-01, D-03 — Phase 8.1).
export const HOME_SQUAD: PlayerPiece[] = [ ... ];
export const AWAY_SQUAD: PlayerPiece[] = [ ... ];
```

Translate to:

```typescript
// teamConfig.ts (new file):
export type TeamId = 'cosmos' | 'xolos' | 'city' | 'crew';

export interface TeamConfig {
  id: TeamId;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  /** Filename key only — e.g. 'cosmos.png'. Asset import happens in TeamBadge component. */
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

---

### `packages/shared/src/index.ts` barrel addition (config, transform)

**Analog:** `packages/shared/src/index.ts` existing entries

**Core barrel pattern** (`index.ts` lines 3-16):

```typescript
// Existing pattern — append at bottom:
export * from './teamConfig.js';
```

All shared exports use `.js` extension (ESM build output). Follow exactly.

---

### `packages/client/src/teamDefaults.ts` (config, transform)

**Analog:** `packages/client/src/components/ActionLog.tsx` lines 5-8 (module-level constants)

**Core pattern** (`ActionLog.tsx` lines 5-8):

```typescript
// ─── Team colors (match PieceOverlay) ────────────────────────────────────────
const HOME_COLOR = '#1a56b0';
const AWAY_COLOR = '#c0392b';
```

New file is a module-level constant, not inside a component. Pattern:

```typescript
// packages/client/src/teamDefaults.ts (new file — module-level, not inside a component):
import type { TeamId } from '@counter-attack/shared';

export const TEAM_DEFAULTS: Record<'home' | 'away', TeamId> = {
  home: 'cosmos',
  away: 'xolos',
};
```

Key rule: module-level (not inside a React component) to avoid reference identity re-creation on each render.

---

### `packages/client/src/components/TeamBadge.tsx` (component, request-response)

**Analog:** `packages/client/src/components/GameBoard.tsx` lines 44-56 (`TeamShieldIcon`)

**Existing component to replace** (`GameBoard.tsx` lines 44-56):

```typescript
/** Inline SVG shield icon for team identity in the score row and player card. */
function TeamShieldIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden="true">
      <path
        d="M11 1L2 4.5V12C2 17.5 6 22.5 11 25C16 22.5 20 17.5 20 12V4.5L11 1Z"
        fill={color}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1"
      />
    </svg>
  );
}
```

**Replacement `TeamBadge.tsx` pattern** (Vite static import approach — D-01, D-07):

```typescript
import cosmosBadge from '../assets/badges/cosmos.png';
import xolosBadge  from '../assets/badges/xolos.png';
import cityBadge   from '../assets/badges/city.png';
import crewBadge   from '../assets/badges/crew.png';
import type { TeamId } from '@counter-attack/shared';

const BADGE_MAP: Record<TeamId, string> = {
  cosmos: cosmosBadge,
  xolos:  xolosBadge,
  city:   cityBadge,
  crew:   crewBadge,
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

Prerequisite: `packages/client/src/vite-env.d.ts` must contain `/// <reference types="vite/client" />` — check before implementing.

---

### `packages/client/src/components/PieceOverlay.tsx` (component, request-response)

**Analog:** itself — lines 66-98 are the direct extension point

**Existing SVG defs pattern to extend** (`PieceOverlay.tsx` lines 66-98):

```tsx
{
  !isGK && (
    <defs>
      {piece.teamId === 'home' ? (
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
      ) : (
        <pattern
          id={`away-stripe-${piece.id}`}
          x={cx - PIECE_RADIUS}
          y={cy - PIECE_RADIUS}
          width={24}
          height={24}
          patternUnits="userSpaceOnUse"
        >
          <rect width={24} height={24} fill="#c0392b" />
          <rect x={0} y={6} width={24} height={4} fill="#7f0000" fillOpacity={0.65} />
          <rect x={0} y={14} width={24} height={4} fill="#7f0000" fillOpacity={0.65} />
        </pattern>
      )}
    </defs>
  );
}
```

**Circle fill reference pattern** (`PieceOverlay.tsx` lines 100-116):

```tsx
<circle
  cx={cx}
  cy={cy}
  r={PIECE_RADIUS}
  fill={
    isGK
      ? fill
      : `url(#${piece.teamId === 'home' ? `home-stripe-${piece.id}` : `away-stripe-${piece.id}`})`
  }
  stroke={stroke}
  strokeWidth={1.5}
  ...
/>
```

**D-06 color refactor — imports to add at top of file:**

```typescript
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { TEAM_DEFAULTS } from '../teamDefaults.js';
```

**D-06 lookup pattern (replaces `#1a56b0` / `#c0392b` literals):**

```typescript
// BEFORE (lines 44-46):
const fill = isGK ? ... : piece.teamId === 'home' ? '#1a56b0' : '#c0392b';

// AFTER (D-06):
const teamConfig = TEAM_CONFIGS[TEAM_DEFAULTS[piece.teamId]];
const fill = isGK
  ? piece.teamId === 'home' ? '#9b59b6' : '#f59e0b'
  : teamConfig.primaryColor;
const stroke = isGK
  ? piece.teamId === 'home' ? '#6c3483' : '#d97706'
  : piece.teamId === 'home' ? '#0d3a82' : '#8e1c12';
```

**D-08: New outfield pattern defs structure** (replace the home/away ternary inside `<defs>`):

```tsx
{
  !isGK && (
    <defs>
      {/* Cosmos: navy base + 12px horizontal white stripe */}
      <pattern
        id={`cosmos-jersey-${piece.id}`}
        x={cx - PIECE_RADIUS}
        y={cy - PIECE_RADIUS}
        width={24}
        height={24}
        patternUnits="userSpaceOnUse"
      >
        <rect width={24} height={24} fill="#1e3a8a" />
        <rect x={0} y={6} width={24} height={12} fill="#ffffff" fillOpacity={0.6} />
      </pattern>

      {/* Xolos: orange base + grey checker 8x8 tiles (16px tile for 2x2 checker) */}
      <pattern
        id={`xolos-jersey-${piece.id}`}
        x={cx - PIECE_RADIUS}
        y={cy - PIECE_RADIUS}
        width={16}
        height={16}
        patternUnits="userSpaceOnUse"
      >
        <rect width={16} height={16} fill="#ea580c" />
        <rect x={0} y={0} width={8} height={8} fill="#6b7280" fillOpacity={0.7} />
        <rect x={8} y={8} width={8} height={8} fill="#6b7280" fillOpacity={0.7} />
      </pattern>

      {/* City: crimson base + thin gold vertical stripes (1px every 4px) */}
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

      {/* Crew: gold base + 45° diagonal black stripes (8px tile) */}
      <pattern
        id={`crew-jersey-${piece.id}`}
        x={cx - PIECE_RADIUS}
        y={cy - PIECE_RADIUS}
        width={8}
        height={8}
        patternUnits="userSpaceOnUse"
      >
        <rect width={8} height={8} fill="#f5c518" />
        <line x1={8} y1={0} x2={0} y2={8} stroke="#111111" strokeWidth={2} strokeOpacity={0.75} />
      </pattern>

      {/* Home GK: purple/dark-purple checker (6px tiles in 12px tile) */}
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
    </defs>
  );
}
```

**D-09 Crew shoulder mask** (sibling element after base circle, masks lower 70%):

```tsx
{
  /* Crew shoulder mask: cover lower 70% with solid gold to restrict diagonal to top 30% */
}
{
  teamId === 'crew' && !isGK && (
    <rect
      x={cx - PIECE_RADIUS}
      y={cy - PIECE_RADIUS * 0.4}
      width={PIECE_RADIUS * 2}
      height={PIECE_RADIUS * 1.4}
      fill="#f5c518"
      pointerEvents="none"
    />
  );
}
```

**D-09 City arch** (sibling path after base circle):

```tsx
{
  /* City arch: gold curved path in lower third of token */
}
{
  teamId === 'city' && !isGK && (
    <path
      d={`M ${cx - PIECE_RADIUS * 0.7} ${cy + PIECE_RADIUS * 0.3} Q ${cx} ${cy + PIECE_RADIUS * 0.9} ${cx + PIECE_RADIUS * 0.7} ${cy + PIECE_RADIUS * 0.3}`}
      fill="none"
      stroke="#f5c518"
      strokeWidth={1.5}
      pointerEvents="none"
    />
  );
}
```

**D-10 Away GK edge stripes** (sibling rects after amber base circle — no pattern needed):

```tsx
{
  /* Away GK: amber base circle + two narrow orange vertical edge stripes */
}
{
  isGK && piece.teamId === 'away' && (
    <>
      <rect
        x={cx - PIECE_RADIUS + 4}
        y={cy - PIECE_RADIUS}
        width={3}
        height={PIECE_RADIUS * 2}
        fill="#ea580c"
        fillOpacity={0.85}
        pointerEvents="none"
      />
      <rect
        x={cx + PIECE_RADIUS - 7}
        y={cy - PIECE_RADIUS}
        width={3}
        height={PIECE_RADIUS * 2}
        fill="#ea580c"
        fillOpacity={0.85}
        pointerEvents="none"
      />
    </>
  );
}
```

**Circle fill reference update** (replaces home/away positional lookup with team-name lookup):

```tsx
fill={
  isGK
    ? piece.teamId === 'home'
      ? `url(#home-gk-checker-${piece.id})`
      : '#f59e0b'   // away GK: solid amber base; stripes added as siblings
    : `url(#${TEAM_DEFAULTS[piece.teamId]}-jersey-${piece.id})`
}
```

---

### `packages/client/src/components/GameBoard.tsx` (component, request-response)

**Analog:** itself

**D-06 imports to add** (after existing imports):

```typescript
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { TEAM_DEFAULTS } from '../teamDefaults.js';
import { TeamBadge } from './TeamBadge.js';
```

**D-07 TeamShieldIcon replacement** (lines 44-56 — delete `TeamShieldIcon`, replace call sites):
All call sites of `<TeamShieldIcon color={...} />` become `<TeamBadge teamId={TEAM_DEFAULTS[team]} size={28} />`.

**D-06 color literal replacement pattern** — grep target: `#1a56b0` and `#c0392b`. Each occurrence:

```typescript
// BEFORE:
const teamColor = activeTeam === 'home' ? '#1a56b0' : '#c0392b';

// AFTER:
const teamColor = TEAM_CONFIGS[TEAM_DEFAULTS[activeTeam]].primaryColor;
```

Known occurrences (`GameBoard.tsx`): lines 139, 156. Run grep to find all before editing.

---

### `packages/client/src/components/ActionLog.tsx` (component, request-response)

**Analog:** itself — lines 5-8

**D-06 refactor pattern** (`ActionLog.tsx` lines 5-8):

```typescript
// BEFORE:
const HOME_COLOR = '#1a56b0';
const AWAY_COLOR = '#c0392b';
function pieceColorOf(pieceId: string): string {
  return pieceId.startsWith('home') ? HOME_COLOR : AWAY_COLOR;
}

// AFTER:
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { TEAM_DEFAULTS } from '../teamDefaults.js';
function pieceColorOf(pieceId: string): string {
  const positional = pieceId.startsWith('home') ? 'home' : 'away';
  return TEAM_CONFIGS[TEAM_DEFAULTS[positional]].primaryColor;
}
```

---

### `packages/client/src/components/PlayerStatsPanel.tsx` (component, request-response)

**Analog:** itself — `MiniTokenBadge` lines 27-60

**Existing MiniTokenBadge defs pattern** (`PlayerStatsPanel.tsx` lines 36-60):

```tsx
const homePatId = `mini-home-stripe-${piece.id}`;
const awayPatId = `mini-away-stripe-${piece.id}`;
const gkFill   = piece.teamId === 'home' ? '#9b59b6' : '#f59e0b';
const gkStroke = piece.teamId === 'home' ? '#6c3483' : '#d97706';

{!isGK && (
  <defs>
    {piece.teamId === 'home' ? (
      <pattern id={homePatId} x={miniCx - miniR} y={miniCy - miniR}
        width={18} height={18} patternUnits="userSpaceOnUse">
        <rect width={18} height={18} fill="#1a56b0" />
        <rect x={7} y={0} width={4} height={18} fill="#000000" fillOpacity={0.55} />
      </pattern>
    ) : ( ... )}
  </defs>
)}
```

**D-06 + D-10 updates to MiniTokenBadge** — same structural pattern, scaled to `miniR=9` / 18px tile:

Add imports at top of file:

```typescript
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { TEAM_DEFAULTS } from '../teamDefaults.js';
```

Replace positional pattern ids with team-name ids:

```typescript
const teamId = TEAM_DEFAULTS[piece.teamId]; // e.g. 'cosmos'
const jerseyPatId = `mini-${teamId}-jersey-${piece.id}`;
const homeGkPatId = `mini-home-gk-checker-${piece.id}`;
```

GK fill update (D-10 — home GK now uses checker pattern, away GK keeps solid amber):

```typescript
// Home GK: checker pattern via <pattern>; Away GK: solid amber
const gkFill = isGK && piece.teamId === 'home' ? `url(#${homeGkPatId})` : '#f59e0b';
```

Home GK checker pattern def inside `<defs>` (scaled to 18px tile, 5px checker tiles):

```tsx
{
  isGK && piece.teamId === 'home' && (
    <defs>
      <pattern
        id={homeGkPatId}
        x={miniCx - miniR}
        y={miniCy - miniR}
        width={10}
        height={10}
        patternUnits="userSpaceOnUse"
      >
        <rect width={10} height={10} fill="#7c3aed" />
        <rect x={0} y={0} width={5} height={5} fill="#4c1d95" />
        <rect x={5} y={5} width={5} height={5} fill="#4c1d95" />
      </pattern>
    </defs>
  );
}
```

---

### `packages/shared/src/teamConfig.test.ts` (test)

**Analog:** `packages/shared/src/scoreUtils.test.ts`

**Test file structure** (`scoreUtils.test.ts` lines 1-5):

```typescript
import { describe, it, expect } from 'vitest';
import { computeCombinedScore, computeLooseBall } from './scoreUtils.js';

describe('computeCombinedScore', () => {
  it('returns attribute + diceValue when no penalties', () => {
    expect(computeCombinedScore(5, 4, [])).toBe(9);
  });
```

**New test file pattern for teamConfig:**

```typescript
import { describe, it, expect } from 'vitest';
import { TEAM_CONFIGS } from './teamConfig.js';
import type { TeamId } from './teamConfig.js';

const TEAM_IDS: TeamId[] = ['cosmos', 'xolos', 'city', 'crew'];

describe('TEAM_CONFIGS', () => {
  it('exports all four team ids', () => {
    expect(Object.keys(TEAM_CONFIGS)).toEqual(expect.arrayContaining(TEAM_IDS));
  });

  it.each(TEAM_IDS)('%s has required fields', (teamId) => {
    const cfg = TEAM_CONFIGS[teamId];
    expect(cfg.id).toBe(teamId);
    expect(cfg.name).toBeTruthy();
    expect(cfg.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(cfg.secondaryColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(cfg.badgeFile).toMatch(/\.png$/);
  });
});
```

---

## Shared Patterns

### Module-level constants (not inside components)

**Source:** `packages/client/src/components/ActionLog.tsx` lines 5-8
**Apply to:** `teamDefaults.ts`, any file defining `TEAM_DEFAULTS`
Pattern: define static lookup tables at module scope, not inside component function bodies.

### SVG `patternUnits="userSpaceOnUse"` with piece-anchored origin

**Source:** `packages/client/src/components/PieceOverlay.tsx` lines 68-97
**Apply to:** All new jersey pattern `<pattern>` defs in `PieceOverlay.tsx` and `MiniTokenBadge` in `PlayerStatsPanel.tsx`

```tsx
<pattern
  id={`{teamId}-jersey-${piece.id}`}   // always include piece.id to avoid SVG id collisions
  x={cx - PIECE_RADIUS}               // anchor to piece top-left bounding box
  y={cy - PIECE_RADIUS}
  width={N}                            // tile width (4, 8, 12, or 16 depending on pattern)
  height={M}
  patternUnits="userSpaceOnUse"        // coordinates in SVG viewport space
>
```

### Sibling SVG elements for non-repeating overlays

**Source:** `packages/client/src/components/PieceOverlay.tsx` lines 141-160 (path elements after circle)
**Apply to:** City arch path, Crew shoulder mask rect, Away GK edge stripe rects
These elements render AFTER the base `<circle>` as sibling elements in the fragment. Set `pointerEvents="none"` on all overlay elements.

### Color lookup via TEAM_CONFIGS

**Source:** `packages/client/src/components/ActionLog.tsx` lines 10-12 (pattern to replace)
**Apply to:** `PieceOverlay.tsx`, `GameBoard.tsx`, `ActionLog.tsx`, `PlayerStatsPanel.tsx`

```typescript
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { TEAM_DEFAULTS } from '../teamDefaults.js';
// Usage:
const primaryColor = TEAM_CONFIGS[TEAM_DEFAULTS[positionalTeamId]].primaryColor;
```

### Barrel export with `.js` extension

**Source:** `packages/shared/src/index.ts` lines 3-16
**Apply to:** New `export * from './teamConfig.js'` line in `index.ts`

```typescript
export * from './teamConfig.js'; // .js extension required for ESM output
```

---

## No Analog Found

| File                                      | Role  | Data Flow | Reason                                                           |
| ----------------------------------------- | ----- | --------- | ---------------------------------------------------------------- |
| `packages/client/src/assets/badges/*.png` | asset | —         | Binary assets — no code analog; already present on disk per D-02 |

---

## Metadata

**Analog search scope:** `packages/shared/src/`, `packages/client/src/components/`
**Files scanned:** 8 source files read directly
**Pattern extraction date:** 2026-06-13
