/** Team identity types and configuration record for Counter Attack.
 * Phase 19 D-04/D-06/D-08/D-14: Rewritten to introduce 4-color palette model,
 * COLOR_SCHEME_REGISTRY, and split TeamId vs ColorSchemeId.
 * badgeFile is a filename key only (e.g. 'cosmos.png') — NOT an asset path.
 * The actual import happens in the TeamBadge client component.
 */

import type { PoolPlayer } from './teams.js';
import { PLAYER_POOL } from './teams.js';

/** D-04: Active selectable teams only — cosmos and xolos removed (retired). */
export type TeamId = 'city' | 'crew';

/** D-06: Full historical team set — includes retired teams for palette/badge registry and
 * PoolPlayer.sourceTeamId annotation. Extended in Phase 21 with new MLS/international teams. */
export type ColorSchemeId = 'cosmos' | 'xolos' | 'city' | 'crew';

/** D-08/PALETTE-01: 4-color palette per team — replaces 2-field primaryColor/secondaryColor.
 * primaryLight authored at data-definition time (D-09 / PALETTE-03 — never computed at render). */
export interface TeamPalette {
  primary: string;
  primaryLight: string;
  secondary1: string;
  secondary2: string;
}

/** D-06: Color scheme entry for historical/current teams in the registry. */
export interface ColorScheme {
  id: ColorSchemeId;
  name: string;
  palette: TeamPalette;
  /** Filename key only — e.g. 'cosmos.png'. Asset import happens in TeamBadge component. */
  badgeFile: string;
}

/** Phase 19 TeamConfig — replaces the 2-color Phase 15 shape.
 * D-08: palette replaces primaryColor/secondaryColor.
 * D-03: playerIds references PLAYER_POOL entries by sequential p001.. IDs.
 * D-14/LEAGUE-03: league field groups teams into tabs in Phase 21 team selection. */
export interface TeamConfig {
  id: TeamId;
  name: string;
  /** Cross-reference into COLOR_SCHEME_REGISTRY for Phase 21 reuse. */
  colorSchemeId: ColorSchemeId;
  /** 4-color palette — duplicated from registry for fast consumer access. */
  palette: TeamPalette;
  /** References into PLAYER_POOL; populated from seed script output (Task 3). */
  playerIds: readonly string[];
  /** D-14 / LEAGUE-03: 'mls' for city and crew; 'international' for future teams. */
  league: 'mls' | 'international';
  /** Filename key only — e.g. 'city.png'. Asset import happens in TeamBadge component. */
  badgeFile: string;
}

/** D-06/DATA-03: All historical team palette and badge data.
 * Includes retired teams (cosmos, xolos) so their identity is preserved.
 * Color values: existing primaryColor → palette.primary; existing secondaryColor → palette.secondary1.
 * primaryLight and secondary2 authored per D-09 (Claude's Discretion). */
export const COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme> = {
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos',
    palette: {
      primary: '#3b82f6', // existing primaryColor
      primaryLight: '#93c5fd', // blue-300 — lightened 3 shades
      secondary1: '#c8a84b', // existing secondaryColor (gold)
      secondary2: '#1e3a5f', // deep navy accent
    },
    badgeFile: 'cosmos.png',
  },
  xolos: {
    id: 'xolos',
    name: 'Xolos',
    palette: {
      primary: '#f59e0b', // existing primaryColor (amber)
      primaryLight: '#fcd34d', // amber-300 — lightened 2 shades
      secondary1: '#6b7280', // existing secondaryColor (gray)
      secondary2: '#1f2937', // dark charcoal accent
    },
    badgeFile: 'xolos.png',
  },
  city: {
    id: 'city',
    name: 'City',
    palette: {
      primary: '#dc143c', // existing primaryColor (crimson)
      primaryLight: '#f87171', // red-400 — lightened
      secondary1: '#f5c518', // existing secondaryColor (gold)
      secondary2: '#1e1e2e', // near-black accent
    },
    badgeFile: 'city.png',
  },
  crew: {
    id: 'crew',
    name: 'Crew',
    palette: {
      primary: '#f5c518', // existing primaryColor (yellow)
      primaryLight: '#fde68a', // yellow-200 — lightened
      secondary1: '#111111', // existing secondaryColor (near-black)
      secondary2: '#14532d', // forest green accent
    },
    badgeFile: 'crew.png',
  },
};

/** D-05: Only active/selectable teams. Retired teams (cosmos, xolos) live in COLOR_SCHEME_REGISTRY.
 * playerIds populated from seed script output — see Task 3. */
export const TEAM_CONFIGS: Record<TeamId, TeamConfig> = {
  city: {
    id: 'city',
    name: 'City',
    colorSchemeId: 'city',
    palette: COLOR_SCHEME_REGISTRY.city.palette,
    // Populated from seed script output — pnpm run seed:rosters (Task 3)
    playerIds: [
      'p023',
      'p024',
      'p025',
      'p026',
      'p027',
      'p028',
      'p029',
      'p030',
      'p031',
      'p032',
      'p033',
    ],
    league: 'mls',
    badgeFile: 'city.png',
  },
  crew: {
    id: 'crew',
    name: 'Crew',
    colorSchemeId: 'crew',
    palette: COLOR_SCHEME_REGISTRY.crew.palette,
    // Populated from seed script output — pnpm run seed:rosters (Task 3)
    playerIds: [
      'p034',
      'p035',
      'p036',
      'p037',
      'p038',
      'p039',
      'p040',
      'p041',
      'p042',
      'p043',
      'p044',
    ],
    league: 'mls',
    badgeFile: 'crew.png',
  },
};

/** CR-03: Module-level Map for O(1) player lookup — avoids O(n) linear scan per squad member.
 * Built once at module load; 11 × 178 = ~1,958 comparisons per team reduced to 11 O(1) lookups. */
const PLAYER_POOL_MAP = new Map(PLAYER_POOL.map((p) => [p.id, p]));

/** DATA-02/D-03: Resolve a team's squad players from PLAYER_POOL using TEAM_CONFIGS.playerIds.
 * Throws if a referenced player ID is not found in PLAYER_POOL (data integrity guard).
 * Imported by server buildSquadPieces — returns PoolPlayer[] for further spread to PlayerPiece. */
export function getSquadPlayers(teamId: TeamId): PoolPlayer[] {
  const ids = TEAM_CONFIGS[teamId].playerIds;
  return ids.map((id) => {
    const player = PLAYER_POOL_MAP.get(id);
    if (!player) throw new Error(`Player ${id} not found in PLAYER_POOL`);
    return player;
  });
}
