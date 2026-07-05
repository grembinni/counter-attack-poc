/** Team identity types and configuration record for Counter Attack.
 * Phase 19 D-04/D-06/D-08/D-14: Rewritten to introduce 4-color palette model,
 * COLOR_SCHEME_REGISTRY, and split TeamId vs ColorSchemeId.
 * badgeFile is a filename key only (e.g. 'cosmos.png') — NOT an asset path.
 * The actual import happens in the TeamBadge client component.
 */

import type { PoolPlayer } from './teams.js';
import { PLAYER_POOL } from './teams.js';
import type { UniformStyleId } from './uniformStyles.js';

/** D-04: Active selectable teams — Phase 21 expanded to 12 selectable teams (4 MLS + 6 international). */
export type TeamId =
  | 'city'
  | 'crew'
  | 'la'
  | 'miami'
  | 'nashville'
  | 'seattle'
  | 'canada'
  | 'england'
  | 'france'
  | 'mexico'
  | 'spain'
  | 'us';

/** D-06: Full historical team set — includes retired teams for palette/badge registry and
 * PoolPlayer.sourceTeamId annotation. Extended in Phase 21 with new MLS/international teams. */
export type ColorSchemeId =
  | 'cosmos'
  | 'xolos'
  | 'city'
  | 'crew'
  | 'la'
  | 'miami'
  | 'nashville'
  | 'seattle'
  | 'canada'
  | 'england'
  | 'france'
  | 'mexico'
  | 'spain'
  | 'us';

/** D-08/PALETTE-01: 7-field palette per team — home group (homePrime, homeAlt, homeFont) then away group,
 * plus uiColor for team-branded text in scoreboard, action log, and other UI elements.
 * homePrime/homeAlt are dark colors; awayPrime/awayAlt are light colors.
 * homeFont/awayFont are hex color strings controlling jersey number color (e.g. '#ffffff', '#000000').
 * uiColor is decoupled from uniform patterns — defaults to homePrime but can be tuned for readability. */
export interface TeamPalette {
  homePrime: string;
  homeAlt: string;
  homeFont: string;
  awayPrime: string;
  awayAlt: string;
  awayFont: string;
  /** UI text color for scoreboard numerals, action log labels, etc. Decoupled from uniform patterns. */
  uiColor: string;
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
  /** Phase 20 D-01/D-02: Default uniform pattern for this team (UNIFORM-03).
   * City = 'pinstripe' (D-01), Crew = 'diagonal' (D-02). */
  defaultUniformStyle: UniformStyleId;
}

/** D-06/DATA-03: All historical team palette and badge data.
 * Includes retired teams (cosmos, xolos) so their identity is preserved.
 * Color values: existing primaryColor → palette.homePrime; existing secondaryColor → palette.homeAlt.
 * awayPrime and awayAlt authored per D-09 (Claude's Discretion). */
export const COLOR_SCHEME_REGISTRY: Record<ColorSchemeId, ColorScheme> = {
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos',
    palette: {
      homePrime: '#233253',
      homeAlt: '#F5C71A',
      homeFont: '#ffffff',
      awayPrime: '#83A6D6',
      awayAlt: '#FFFFFF',
      awayFont: '#000000',
      uiColor: '#233253',
    },
    badgeFile: 'cosmos.png',
  },
  xolos: {
    id: 'xolos',
    name: 'Xolos',
    palette: {
      homePrime: '#F75E25',
      homeAlt: '#181818',
      homeFont: '#ffffff',
      awayPrime: '#FFFFFF',
      awayAlt: '#A5AEBD',
      awayFont: '#000000',
      uiColor: '#F75E25',
    },
    badgeFile: 'xolos.png',
  },
  city: {
    id: 'city',
    name: 'City',
    palette: {
      homePrime: '#C62045',
      homeAlt: '#D45873',
      homeFont: '#ffffff',
      awayPrime: '#E4B630',
      awayAlt: '#112347',
      awayFont: '#000000',
      uiColor: '#C62045',
    },
    badgeFile: 'city.png',
  },
  crew: {
    id: 'crew',
    name: 'Crew',
    palette: {
      homePrime: '#FEE500',
      homeAlt: '#000000',
      homeFont: '#000000',
      awayPrime: '#E6CE00',
      awayAlt: '#ffffff',
      awayFont: '#000000',
      uiColor: '#FEE500',
    },
    badgeFile: 'crew.png',
  },
  la: {
    id: 'la',
    name: 'LA',
    palette: {
      homePrime: '#D8AA52',
      homeAlt: '#6C5529',
      homeFont: '#000000',
      awayPrime: '#000000',
      awayAlt: '#D8AA52',
      awayFont: '#ffffff',
      uiColor: '#D8AA52',
    },
    badgeFile: 'la.png',
  },
  miami: {
    id: 'miami',
    name: 'Miami',
    palette: {
      homePrime: '#FF75A8',
      homeAlt: '#111111',
      homeFont: '#000000',
      awayPrime: '#FF75A8',
      awayAlt: '#8BD3D6',
      awayFont: '#000000',
      uiColor: '#FF75A8',
    },
    badgeFile: 'miami.png',
  },
  nashville: {
    id: 'nashville',
    name: 'Nashville',
    palette: {
      homePrime: '#F5CC26',
      homeAlt: '#264475',
      homeFont: '#000000',
      awayPrime: '#76807E',
      awayAlt: '#FEE23E',
      awayFont: '#ffffff',
      uiColor: '#F5CC26',
    },
    badgeFile: 'nashville.png',
  },
  seattle: {
    id: 'seattle',
    name: 'Seattle',
    palette: {
      homePrime: '#2B9B5B',
      homeAlt: '#264F99',
      homeFont: '#ffffff',
      awayPrime: '#A2E865',
      awayAlt: '#76807E',
      awayFont: '#000000',
      uiColor: '#20824B',
    },
    badgeFile: 'seattle.png',
  },
  canada: {
    id: 'canada',
    name: 'Canada',
    palette: {
      homePrime: '#C11B24',
      homeAlt: '#000000',
      homeFont: '#ffffff',
      awayPrime: '#CD4950',
      awayAlt: '#CAA02D',
      awayFont: '#000000',
      uiColor: '#C11B24',
    },
    badgeFile: 'canada.png',
  },
  england: {
    id: 'england',
    name: 'England',
    palette: {
      homePrime: '#C61A27',
      homeAlt: '#ffffff',
      homeFont: '#000000',
      awayPrime: '#15274D',
      awayAlt: '#DDB23E',
      awayFont: '#ffffff',
      uiColor: '#C61A27',
    },
    badgeFile: 'england.png',
  },
  france: {
    id: 'france',
    name: 'France',
    palette: {
      homePrime: '#1C428E',
      homeAlt: '#3355bb',
      homeFont: '#ffffff',
      awayPrime: '#C79F52',
      awayAlt: '#3355bb',
      awayFont: '#000000',
      uiColor: '#1C428E',
    },
    badgeFile: 'france.png',
  },
  mexico: {
    id: 'mexico',
    name: 'Mexico',
    palette: {
      homePrime: '#138A54',
      homeAlt: '#F6B941',
      homeFont: '#ffffff',
      awayPrime: '#19B66F',
      awayAlt: '#ffffff',
      awayFont: '#000000',
      uiColor: '#138A54',
    },
    badgeFile: 'mexico.png',
  },
  spain: {
    id: 'spain',
    name: 'Spain',
    palette: {
      homePrime: '#BA1325',
      homeAlt: '#F2B325',
      homeFont: '#ffffff',
      awayPrime: '#D6982D',
      awayAlt: '#B15B35',
      awayFont: '#000000',
      uiColor: '#BA1325',
    },
    badgeFile: 'spain.png',
  },
  us: {
    id: 'us',
    name: 'USA',
    palette: {
      homePrime: '#1A2849',
      homeAlt: '#C41E3A',
      homeFont: '#ffffff',
      awayPrime: '#C41E3A',
      awayAlt: '#1A2849',
      awayFont: '#ffffff',
      uiColor: '#1A2849',
    },
    badgeFile: 'us.png',
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
    defaultUniformStyle: 'pinstripes-vertical',
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
    defaultUniformStyle: 'bar-diagonal',
  },
  la: {
    id: 'la',
    name: 'LA',
    colorSchemeId: 'la',
    palette: COLOR_SCHEME_REGISTRY.la.palette,
    playerIds: [
      'p080',
      'p081',
      'p082',
      'p083',
      'p084',
      'p085',
      'p086',
      'p087',
      'p088',
      'p089',
      'p090',
    ],
    league: 'mls',
    badgeFile: 'la.png',
    defaultUniformStyle: 'pinstripes-horizontal',
  },
  miami: {
    id: 'miami',
    name: 'Miami',
    colorSchemeId: 'miami',
    palette: COLOR_SCHEME_REGISTRY.miami.palette,
    playerIds: [
      'p069',
      'p070',
      'p071',
      'p072',
      'p073',
      'p074',
      'p075',
      'p076',
      'p077',
      'p078',
      'p079',
    ],
    league: 'mls',
    badgeFile: 'miami.png',
    defaultUniformStyle: 'shape-oval',
  },
  nashville: {
    id: 'nashville',
    name: 'Nashville',
    colorSchemeId: 'nashville',
    palette: COLOR_SCHEME_REGISTRY.nashville.palette,
    playerIds: [
      'p102',
      'p103',
      'p104',
      'p105',
      'p106',
      'p107',
      'p108',
      'p109',
      'p110',
      'p111',
      'p112',
    ],
    league: 'mls',
    badgeFile: 'nashville.png',
    defaultUniformStyle: 'shape-diamond',
  },
  seattle: {
    id: 'seattle',
    name: 'Seattle',
    colorSchemeId: 'seattle',
    palette: COLOR_SCHEME_REGISTRY.seattle.palette,
    playerIds: [
      'p091',
      'p092',
      'p093',
      'p094',
      'p095',
      'p096',
      'p097',
      'p098',
      'p099',
      'p100',
      'p101',
    ],
    league: 'mls',
    badgeFile: 'seattle.png',
    defaultUniformStyle: 'split-vertical',
  },
  canada: {
    id: 'canada',
    name: 'Canada',
    colorSchemeId: 'canada',
    palette: COLOR_SCHEME_REGISTRY.canada.palette,
    playerIds: [
      'p146',
      'p147',
      'p148',
      'p149',
      'p150',
      'p151',
      'p152',
      'p153',
      'p154',
      'p155',
      'p156',
    ],
    league: 'international',
    badgeFile: 'canada.png',
    defaultUniformStyle: 'bar-horizontal',
  },
  england: {
    id: 'england',
    name: 'England',
    colorSchemeId: 'england',
    palette: COLOR_SCHEME_REGISTRY.england.palette,
    playerIds: [
      'p124',
      'p125',
      'p126',
      'p127',
      'p128',
      'p129',
      'p130',
      'p131',
      'p132',
      'p133',
      'p134',
    ],
    league: 'international',
    badgeFile: 'england.png',
    defaultUniformStyle: 'bar-plus',
  },
  france: {
    id: 'france',
    name: 'France',
    colorSchemeId: 'france',
    palette: COLOR_SCHEME_REGISTRY.france.palette,
    playerIds: [
      'p168',
      'p169',
      'p170',
      'p171',
      'p172',
      'p173',
      'p174',
      'p175',
      'p176',
      'p177',
      'p178',
    ],
    league: 'international',
    badgeFile: 'france.png',
    defaultUniformStyle: 'shape-circle',
  },
  mexico: {
    id: 'mexico',
    name: 'Mexico',
    colorSchemeId: 'mexico',
    palette: COLOR_SCHEME_REGISTRY.mexico.palette,
    playerIds: [
      'p135',
      'p136',
      'p137',
      'p138',
      'p139',
      'p140',
      'p141',
      'p142',
      'p143',
      'p144',
      'p145',
    ],
    league: 'international',
    badgeFile: 'mexico.png',
    defaultUniformStyle: 'sunburst',
  },
  spain: {
    id: 'spain',
    name: 'Spain',
    colorSchemeId: 'spain',
    palette: COLOR_SCHEME_REGISTRY.spain.palette,
    playerIds: [
      'p157',
      'p158',
      'p159',
      'p160',
      'p161',
      'p162',
      'p163',
      'p164',
      'p165',
      'p166',
      'p167',
    ],
    league: 'international',
    badgeFile: 'spain.png',
    defaultUniformStyle: 'split-horizontal',
  },
  us: {
    id: 'us',
    name: 'USA',
    colorSchemeId: 'us',
    palette: COLOR_SCHEME_REGISTRY.us.palette,
    playerIds: [
      'p113',
      'p114',
      'p115',
      'p116',
      'p117',
      'p118',
      'p119',
      'p120',
      'p121',
      'p122',
      'p123',
    ],
    league: 'international',
    badgeFile: 'us.png',
    defaultUniformStyle: 'bar-x',
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
