/** Team identity types and configuration record for Counter Attack.
 * D-03/D-04: Locked decisions from Phase 15 CONTEXT.md.
 * badgeFile is a filename key only (e.g. 'cosmos.png') — NOT an asset path.
 * The actual import happens in the TeamBadge client component.
 */

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
