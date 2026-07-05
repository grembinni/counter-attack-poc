# Phase 19: Data Model & Team Palette - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 12 (9 modified, 3 CSV-only header fixes)
**Analogs found:** 12 / 12

## File Classification

| New/Modified File                                        | Role               | Data Flow        | Closest Analog                            | Match Quality |
| -------------------------------------------------------- | ------------------ | ---------------- | ----------------------------------------- | ------------- |
| `packages/shared/src/teamConfig.ts`                      | model/config       | transform        | itself (current version)                  | self-refactor |
| `packages/shared/src/teams.ts`                           | model/data         | transform        | itself (current version — auto-generated) | self-refactor |
| `packages/shared/src/index.ts`                           | config/barrel      | —                | itself (current version)                  | self-refactor |
| `packages/shared/scripts/seed-rosters.ts`                | utility/script     | file-I/O         | itself (current version)                  | self-refactor |
| `packages/server/src/gameEngine.ts`                      | service            | request-response | itself (`buildSquadPieces`)               | self-refactor |
| `packages/server/src/roomHandlers.ts`                    | middleware/handler | request-response | itself (`VALID_TEAM_IDS`)                 | self-refactor |
| `packages/client/src/components/ActionLog.tsx`           | component          | request-response | itself (`.primaryColor` swap)             | self-refactor |
| `packages/client/src/components/GameBoard.tsx`           | component          | request-response | itself (`.primaryColor` swap ×8)          | self-refactor |
| `packages/client/src/components/PlayerStatsPanel.tsx`    | component          | request-response | itself (`.primaryColor` swap)             | self-refactor |
| `packages/client/src/components/TeamSelectionScreen.tsx` | component          | request-response | itself (`.primaryColor` swap ×2)          | self-refactor |
| `packages/client/src/components/PieceOverlay.tsx`        | component          | request-response | itself (`.primaryColor` swap ×2)          | self-refactor |
| `packages/client/src/mock/mockMovementState.ts`          | utility/test       | transform        | itself (TEAM_SQUADS → PLAYER_POOL)        | self-refactor |

---

## Pattern Assignments

### `packages/shared/src/teamConfig.ts` (model/config, transform)

**Analog:** itself — current file is the starting point; full rewrite of types and constants.

**Current type shape** (lines 1–16, `teamConfig.ts`):

```typescript
export type TeamId = 'cosmos' | 'xolos' | 'city' | 'crew';

export interface TeamConfig {
  id: TeamId;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  /** Filename key only — e.g. 'cosmos.png'. Asset import happens in TeamBadge component. */
  badgeFile: string;
}
```

**Target type shape** (replace entirely with — per D-04, D-06, D-08, D-14):

```typescript
export type TeamId = 'city' | 'crew'; // D-04: cosmos/xolos removed

export type ColorSchemeId = 'cosmos' | 'xolos' | 'city' | 'crew'; // D-06: full historical set

export interface TeamPalette {
  // D-08: 4-field palette replaces 2-field
  primary: string;
  primaryLight: string; // D-09: authored per-team, NOT computed at render time
  secondary1: string;
  secondary2: string;
}

export interface ColorScheme {
  // D-06: historical registry entry
  id: ColorSchemeId;
  name: string;
  palette: TeamPalette;
  badgeFile: string;
}

export interface TeamConfig {
  id: TeamId;
  name: string;
  colorSchemeId: ColorSchemeId; // D-06: cross-reference into COLOR_SCHEME_REGISTRY
  palette: TeamPalette; // D-08: fast access copy from registry
  playerIds: readonly string[]; // D-03: references into PLAYER_POOL
  league: 'mls' | 'international'; // D-14
  badgeFile: string; // same pattern as current — filename key only
}
```

**Current TEAM_CONFIGS constant pattern** (lines 18–47, `teamConfig.ts`) — copy this Record shape:

```typescript
export const TEAM_CONFIGS: Record<TeamId, TeamConfig> = {
  cosmos: { id: 'cosmos', name: 'Cosmos', primaryColor: '#3b82f6', ... },
  // ...
};
```

**Target constants** (copy Record pattern, populate COLOR_SCHEME_REGISTRY first, reference it in TEAM_CONFIGS):

```typescript
export const COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme> = {
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos',
    palette: {
      primary: '#3b82f6', // existing primaryColor preserved
      primaryLight: '#93c5fd', // blue-300 — Claude's Discretion
      secondary1: '#c8a84b', // existing secondaryColor mapped to secondary1
      secondary2: '#1e3a5f', // navy accent — Claude's Discretion
    },
    badgeFile: 'cosmos.png',
  },
  xolos: {
    id: 'xolos',
    name: 'Xolos',
    palette: {
      primary: '#f59e0b', // existing primaryColor preserved
      primaryLight: '#fcd34d', // amber-300 — Claude's Discretion
      secondary1: '#6b7280', // existing secondaryColor mapped to secondary1
      secondary2: '#1f2937', // dark charcoal — Claude's Discretion
    },
    badgeFile: 'xolos.png',
  },
  city: {
    id: 'city',
    name: 'City',
    palette: {
      primary: '#dc143c', // existing primaryColor preserved
      primaryLight: '#f87171', // red-400 — Claude's Discretion
      secondary1: '#f5c518', // existing secondaryColor mapped to secondary1
      secondary2: '#1e1e2e', // near-black — Claude's Discretion
    },
    badgeFile: 'city.png',
  },
  crew: {
    id: 'crew',
    name: 'Crew',
    palette: {
      primary: '#f5c518', // existing primaryColor preserved
      primaryLight: '#fde68a', // yellow-200 — Claude's Discretion
      secondary1: '#111111', // existing secondaryColor mapped to secondary1
      secondary2: '#14532d', // forest green — Claude's Discretion
    },
    badgeFile: 'crew.png',
  },
};

export const TEAM_CONFIGS: Record<TeamId, TeamConfig> = {
  city: {
    id: 'city',
    name: 'City',
    colorSchemeId: 'city',
    palette: COLOR_SCHEME_REGISTRY.city.palette,
    playerIds: [
      /* populated after seed script runs and IDs are known */
    ],
    league: 'mls',
    badgeFile: 'city.png',
  },
  crew: {
    id: 'crew',
    name: 'Crew',
    colorSchemeId: 'crew',
    palette: COLOR_SCHEME_REGISTRY.crew.palette,
    playerIds: [
      /* populated after seed script runs and IDs are known */
    ],
    league: 'mls',
    badgeFile: 'crew.png',
  },
};

/** Helper: resolve squad players from PLAYER_POOL by teamId. */
export function getSquadPlayers(teamId: TeamId): PoolPlayer[] {
  const ids = TEAM_CONFIGS[teamId].playerIds;
  return ids.map((id) => {
    const player = PLAYER_POOL.find((p) => p.id === id);
    if (!player) throw new Error(`Player ${id} not found in PLAYER_POOL`);
    return player;
  });
}
```

**Note:** `PoolPlayer` type and `PLAYER_POOL` constant live in `teams.ts` (auto-generated). `getSquadPlayers` references `PLAYER_POOL` — import it from `'./teams.js'`, or co-locate `getSquadPlayers` in `teams.ts` alongside `PLAYER_POOL`. Either location works; the barrel export in `index.ts` must export it either way.

---

### `packages/shared/src/teams.ts` (model/data, file-I/O output, auto-generated)

**Analog:** itself — current file is auto-generated by seed script; the output format changes.

**Current output structure** (lines 1–14 of `teams.ts`):

```typescript
/**
 * AUTO-GENERATED by packages/shared/scripts/seed-rosters.ts
 * ...
 */
import type { PlayerPiece } from './types.js';
import type { TeamId } from './teamConfig.js';

export const TEAM_SQUADS: Record<TeamId, readonly PlayerPiece[]> = { ... };
export const FREE_AGENTS: readonly PlayerPiece[] = [ ... ];
```

**Target output structure** (seed script must write this instead):

```typescript
/**
 * AUTO-GENERATED by packages/shared/scripts/seed-rosters.ts
 * Source of truth: packages/shared/src/data/*.csv
 * Regenerate: pnpm run seed:rosters
 *
 * PLAYER_POOL replaces TEAM_SQUADS + FREE_AGENTS (Phase 19 D-12).
 * All players assigned sequential IDs p001..pNNN across all CSV sources.
 */
import type { ColorSchemeId } from './teamConfig.js';
import type { HexCoord } from './types.js';

export interface PoolPlayer {
  id: string; // 'p001', 'p002', ... — D-01
  sourceTeamId: ColorSchemeId | string; // ColorSchemeId for squad players; 'free-agent' for FA
  firstName: string;
  lastName: string;
  number: number;
  nationality: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
  position: HexCoord; // D-02: placeholder retained; no algorithmic role
  pace: number;
  shooting: number;
  tackling: number;
  dribbling: number;
  saving: number;
  handling: number;
  resilience: number;
  aerialAbility: number;
  highPass: number;
}

export const PLAYER_POOL: readonly PoolPlayer[] = [
  // p001–p011: cosmos squad
  // p012–p022: xolos squad
  // p023–p033: city squad
  // p034–p044: crew squad
  // p045–p068: free agents
  // p069–p112: MLS players (mls.csv)
  // p113–p178: national players (national.csv)
];
```

**PoolPlayer vs PlayerPiece diff** — `PoolPlayer` omits `teamId: 'home' | 'away'` (set at runtime by `buildSquadPieces`). All stat fields are identical. The spread `{ ...poolPlayer, teamId: 'home' as const, id: 'home-0' }` produces a valid `PlayerPiece`.

---

### `packages/shared/scripts/seed-rosters.ts` (utility/script, file-I/O)

**Analog:** itself — extend the existing script; do NOT rewrite from scratch.

**Current CSV parsing infrastructure to reuse** (lines 13–105 of `seed-rosters.ts`):

```typescript
import { createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';
// ...
async function parseCSV(filePath: string): Promise<string[][]> { ... }  // reuse unchanged
function parseRow(row: string[], idx: Record<string, number>): RawPlayer { ... }  // update line 130
function toInt(s: string): number { ... }  // reuse unchanged
```

**Line 130 — the typo key that MUST change** (current `seed-rosters.ts` line 129–130):

```typescript
// D-05: 'Arial Ability' typo is preserved from the CSV — access by exact header string
const aerialAbility = toInt(row[idx['Arial Ability']] ?? '');
```

After fixing CSV headers (D-13), update to:

```typescript
const aerialAbility = toInt(row[idx['Aerial Ability']] ?? '');
```

**Current TEAM_ID_MAP pattern** (lines 25–31 of `seed-rosters.ts`) — extend for multi-team CSVs:

```typescript
const TEAM_ID_MAP: Record<string, string | null> = {
  Cozmos: 'cosmos',
  CITY: 'city',
  Crew: 'crew',
  Xolos: 'xolos',
  FA: null,
};
```

For `mls.csv` and `national.csv`, the "Team" column contains names like "Inter Miami", "USMNT". Add a slug normalizer and extend the map, OR use a `toSlug()` function as the fallback:

```typescript
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
// Unknown team names from mls.csv / national.csv fall through to toSlug(teamCsvName)
// as their sourceTeamId — they won't match ColorSchemeId but that's fine until Phase 21
```

**Current buildSquadEntries pattern** (lines 188–228 of `seed-rosters.ts`) — reuse with one change: replace `id: \`${squadPrefix}-${i}\`` with a global sequential counter:

```typescript
// BEFORE (per-squad prefix):
id: `${squadPrefix}-${i}`,

// AFTER (global sequential p001..pNNN):
id: `p${String(globalCounter++).padStart(3, '0')}`,
```

**Current serializePlayer pattern** (lines 231–252 of `seed-rosters.ts`) — update field names:

- Remove `teamId: 'home'` field (PoolPlayer has no teamId)
- Add `sourceTeamId: '${p.sourceTeamId}'` field
- Change `id: '${p.id}'` to use new sequential format
- Field order: `id, sourceTeamId, firstName, lastName, number, nationality, role, position, pace, shooting, tackling, dribbling, saving, handling, resilience, aerialAbility, highPass`

**Current output template** (lines 342–374 of `seed-rosters.ts`) — replace the entire template string:

```typescript
// BEFORE:
const out = `...
export const TEAM_SQUADS: Record<TeamId, readonly PlayerPiece[]> = { ... };
export const FREE_AGENTS: readonly PlayerPiece[] = [ ... ];
`;

// AFTER:
const out = `/**
 * AUTO-GENERATED by packages/shared/scripts/seed-rosters.ts
 * ...
 */
import type { ColorSchemeId } from './teamConfig.js';
import type { HexCoord } from './types.js';

export interface PoolPlayer { ... }

export const PLAYER_POOL: readonly PoolPlayer[] = [
${allPlayersStr}
];
`;
```

**main() flow change** (lines 254–381 of `seed-rosters.ts`):

```typescript
// BEFORE: 5 CSV files iterated, 4 squads + FA built separately
const CSV_FILES = [
  'cosmos_players.csv',
  'xolos_players.csv',
  'city_players.csv',
  'crew_players.csv',
  'fa_players.csv',
];

// AFTER: 7 CSV files; mls.csv and national.csv use Team column for sourceTeamId
const CSV_FILES = [
  'cosmos_players.csv', // sourceTeamId: 'cosmos'
  'xolos_players.csv', // sourceTeamId: 'xolos'
  'city_players.csv', // sourceTeamId: 'city'
  'crew_players.csv', // sourceTeamId: 'crew'
  'fa_players.csv', // sourceTeamId: 'free-agent' (Team col = 'FA', mapped to null → 'free-agent')
  'mls.csv', // sourceTeamId: toSlug(row[idx['Team']]) e.g. 'inter-miami'
  'national.csv', // sourceTeamId: toSlug(row[idx['Team']]) e.g. 'usmnt'
];
```

---

### `packages/shared/src/index.ts` (config/barrel)

**Analog:** itself — single-line swap.

**Current line 7** (`index.ts`):

```typescript
export * from './teams.js';
```

This re-exports `TEAM_SQUADS` and `FREE_AGENTS`. After Phase 19, `teams.ts` exports `PLAYER_POOL` and `PoolPlayer` — no change to the barrel line needed. TypeScript will enforce that any file importing `TEAM_SQUADS` from `@counter-attack/shared` fails to compile.

**Current teamConfig.js export** (line 16 of `index.ts`):

```typescript
export * from './teamConfig.js'; // Phase 15: team identity types and TEAM_CONFIGS record
```

This will automatically export `ColorSchemeId`, `TeamPalette`, `ColorScheme`, `COLOR_SCHEME_REGISTRY`, and `getSquadPlayers` once they are added to `teamConfig.ts`. No barrel change required if `getSquadPlayers` lives in `teamConfig.ts`.

---

### `packages/server/src/gameEngine.ts` (service, request-response)

**Analog:** itself — `buildSquadPieces` function at lines 112–136.

**Current import** (line 29 of `gameEngine.ts`):

```typescript
import {
  GAME_SPEED_MINUTES,
  TEAM_SQUADS,
  // ...
} from '@counter-attack/shared';
```

**Target import** (replace `TEAM_SQUADS` with `PLAYER_POOL` + `getSquadPlayers`):

```typescript
import {
  GAME_SPEED_MINUTES,
  PLAYER_POOL,
  getSquadPlayers,
  // ... all other imports unchanged
} from '@counter-attack/shared';
```

**Current buildSquadPieces** (lines 112–136 of `gameEngine.ts`):

```typescript
function buildSquadPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
): PlayerPiece[] {
  const homeSquad = TEAM_SQUADS[selectedTeams.home].map((p) => ({ ...p, teamId: 'home' as const }));
  const awaySquad = TEAM_SQUADS[selectedTeams.away].map((p) => ({
    ...p,
    teamId: 'away' as const,
    position: { q: 36 - p.position.q, r: p.position.r }, // A1 mirror formula
    id: p.id.replace('home-', 'away-'),
  }));
  // ... ST positioning logic unchanged
}
```

**Target buildSquadPieces** (copy the spread pattern; change only the squad source):

```typescript
function buildSquadPieces(
  attackingTeam: 'home' | 'away',
  selectedTeams: { home: TeamId; away: TeamId },
): PlayerPiece[] {
  const homeSquad = getSquadPlayers(selectedTeams.home).map((p, i) => ({
    ...p,
    teamId: 'home' as const,
    id: `home-${i}`,
  }));
  const awaySquad = getSquadPlayers(selectedTeams.away).map((p, i) => ({
    ...p,
    teamId: 'away' as const,
    id: `away-${i}`,
    position: { q: 36 - p.position.q, r: p.position.r }, // A1 mirror formula — unchanged
  }));
  // ST positioning logic: find by role, same as current (lines 124–134) — unchanged
}
```

**TypeScript validation:** `PoolPlayer` has all `PlayerPiece` stat fields. The spread `{ ...poolPlayer, teamId: 'home' as const, id: 'home-0' }` satisfies `PlayerPiece` because `PlayerPiece` requires `teamId` and `id` — both are provided via the spread override. No cast required.

---

### `packages/server/src/roomHandlers.ts` (middleware/handler, request-response)

**Analog:** itself — single-line update.

**Current line 40** (`roomHandlers.ts`):

```typescript
const VALID_TEAM_IDS: readonly TeamId[] = ['cosmos', 'xolos', 'city', 'crew'] as const;
```

**Target** (shrink to match new `TeamId` union — D-04):

```typescript
const VALID_TEAM_IDS: readonly TeamId[] = ['city', 'crew'] as const;
```

TypeScript will validate this: `'cosmos'` and `'xolos'` are no longer assignable to `TeamId` after `teamConfig.ts` is updated, so the compiler enforces this change.

---

### `packages/client/src/components/ActionLog.tsx` (component, request-response)

**Analog:** itself — field-access-only swap; no logic change.

**Two swap sites** (lines 12 and 37 of `ActionLog.tsx`):

```typescript
// BEFORE (line 12):
return TEAM_CONFIGS[selectedTeams[positional]].primaryColor;

// AFTER:
return TEAM_CONFIGS[selectedTeams[positional]].palette.primary;
```

```typescript
// BEFORE (line 37):
return TEAM_CONFIGS[selectedTeams[positional]].primaryColor;

// AFTER:
return TEAM_CONFIGS[selectedTeams[positional]].palette.primary;
```

**Import line 2** — no change needed; `TEAM_CONFIGS` is still the import:

```typescript
import { TEAM_CONFIGS } from '@counter-attack/shared';
```

---

### `packages/client/src/components/GameBoard.tsx` (component, request-response)

**Analog:** itself — 8 identical field-access swaps.

**All 8 sites** (lines 180, 198, 205, 207, 261, 298, 341, 370, 396, 412 of `GameBoard.tsx`) follow the same pattern:

```typescript
// BEFORE (example line 180):
const teamColor = TEAM_CONFIGS[selectedTeams[activeTeam]].primaryColor;

// AFTER:
const teamColor = TEAM_CONFIGS[selectedTeams[activeTeam]].palette.primary;
```

Apply the same `.primaryColor` → `.palette.primary` substitution at all 8 occurrences. No structural changes.

---

### `packages/client/src/components/PlayerStatsPanel.tsx` (component, request-response)

**Analog:** itself — single field-access swap.

**Swap site** (line 61 of `PlayerStatsPanel.tsx`):

```typescript
// BEFORE:
<rect width={18} height={18} fill={TEAM_CONFIGS[teamId].primaryColor} />

// AFTER:
<rect width={18} height={18} fill={TEAM_CONFIGS[teamId].palette.primary} />
```

---

### `packages/client/src/components/TeamSelectionScreen.tsx` (component, request-response)

**Analog:** itself — 2 field-access swaps.

**Two swap sites** (lines 119–120 of `TeamSelectionScreen.tsx`):

```typescript
// BEFORE:
style={{ borderColor: TEAM_CONFIGS[teamId].primaryColor, background: TEAM_CONFIGS[teamId].primaryColor }}

// AFTER:
style={{ borderColor: TEAM_CONFIGS[teamId].palette.primary, background: TEAM_CONFIGS[teamId].palette.primary }}
```

---

### `packages/client/src/components/PieceOverlay.tsx` (component, request-response)

**Analog:** itself — 2 field-access swaps.

**Two swap sites** (lines 97–98 of `PieceOverlay.tsx`):

```typescript
// BEFORE (lines 97–98):
    : teamConfig.primaryColor; // outfield: team primary color (used for stroke calculation only — fill comes from url(#pattern))
  const stroke = isGK ? (piece.teamId === 'home' ? '#6c3483' : '#5f1515') : teamConfig.primaryColor;

// AFTER:
    : teamConfig.palette.primary;
  const stroke = isGK ? (piece.teamId === 'home' ? '#6c3483' : '#5f1515') : teamConfig.palette.primary;
```

---

### `packages/client/src/mock/mockMovementState.ts` (utility/test, transform)

**Analog:** itself — replace `TEAM_SQUADS` import with `PLAYER_POOL`; update `selectedTeams`.

**Current imports and usage** (lines 1–3, 49–62 of `mockMovementState.ts`):

```typescript
import type { GameState } from '@counter-attack/shared';
import { TEAM_SQUADS } from '@counter-attack/shared';

// ...
pieces: [
  ...TEAM_SQUADS.cosmos.map((p) => ({
    ...p,
    teamId: 'home' as const,
    position: HOME_POSITIONS[p.id] ?? p.position,
  })),
  ...TEAM_SQUADS.xolos.map((p) => ({
    ...p,
    teamId: 'away' as const,
    id: p.id.replace('home-', 'away-'),
    position: AWAY_POSITIONS[p.id.replace('home-', 'away-')] ?? { q: 36 - p.position.q, r: p.position.r },
  })),
],
// ...
selectedTeams: { home: 'cosmos', away: 'xolos' },  // line 81
```

**Target** (per Pitfall 3 in RESEARCH.md — must use valid TeamId after shrink):

```typescript
import type { GameState } from '@counter-attack/shared';
import { PLAYER_POOL } from '@counter-attack/shared';

// ...
pieces: [
  ...PLAYER_POOL.filter(p => p.sourceTeamId === 'city').map((p, i) => ({
    ...p,
    teamId: 'home' as const,
    id: `home-${i}`,
    position: HOME_POSITIONS[`home-${i}`] ?? p.position,
  })),
  ...PLAYER_POOL.filter(p => p.sourceTeamId === 'crew').map((p, i) => ({
    ...p,
    teamId: 'away' as const,
    id: `away-${i}`,
    position: AWAY_POSITIONS[`away-${i}`] ?? { q: 36 - p.position.q, r: p.position.r },
  })),
],
// ...
selectedTeams: { home: 'city', away: 'crew' },  // D-04: cosmos/xolos no longer valid TeamId
```

**Warning for test updates:** `ActionLog.test.tsx` line 189 asserts `expect(screen.getByText(/Nicolae Rusu/))` — this is a cosmos squad player. After switching to city/crew, player names differ. The planner must audit all test assertions that reference specific player names and update them to city/crew players.

---

## Shared Patterns

### Pattern: `TEAM_CONFIGS[x].primaryColor` → `TEAM_CONFIGS[x].palette.primary`

**Source:** `packages/client/src/components/ActionLog.tsx` lines 12 and 37 (shows the before/after clearly)
**Apply to:** All 5 client consumer files (ActionLog, GameBoard, PlayerStatsPanel, TeamSelectionScreen, PieceOverlay)
**Mechanical rule:** `s/.primaryColor/.palette.primary/g` across the 5 files — exactly 12 occurrences total.

### Pattern: `Record<TeamId, TeamConfig>` constant shape

**Source:** `packages/shared/src/teamConfig.ts` lines 18–47 (current TEAM_CONFIGS)
**Apply to:** `COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme>` — same Record shape, wider key type, `ColorScheme` value instead of `TeamConfig`.

### Pattern: Auto-generated file header comment

**Source:** `packages/shared/src/teams.ts` lines 1–9 (current header)

```typescript
/**
 * AUTO-GENERATED by packages/shared/scripts/seed-rosters.ts
 * Source of truth: packages/shared/src/data/*.csv (D-01)
 * Regenerate: pnpm run seed:rosters (D-02 — dev tool, not a build step)
 * ...
 */
```

**Apply to:** New `teams.ts` output — preserve this header pattern verbatim (update the description to mention `PLAYER_POOL` instead of `TEAM_SQUADS + FREE_AGENTS`).

### Pattern: `badgeFile` as filename key only

**Source:** `packages/shared/src/teamConfig.ts` line 14 comment:

```typescript
/** Filename key only — e.g. 'cosmos.png'. Asset import happens in TeamBadge component. */
badgeFile: string;
```

**Apply to:** `ColorScheme.badgeFile` — same pattern, same comment.

### Pattern: TypeScript compilation as build gate

**Source:** `packages/shared/src/index.ts` barrel + `pnpm -w tsc --noEmit` command
**Apply to:** Every task boundary — run `pnpm -w tsc --noEmit` after each wave before proceeding. The barrel export of `TEAM_SQUADS` disappearing is the enforcer: any remaining import of `TEAM_SQUADS` becomes a `TS2305` error immediately.

---

## No Analog Found

All files have direct analogs in the codebase (all are self-refactors of existing files). No file requires a net-new pattern with no prior example.

---

## Metadata

**Analog search scope:** `packages/shared/src/`, `packages/shared/scripts/`, `packages/server/src/`, `packages/client/src/components/`, `packages/client/src/mock/`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-07-03
