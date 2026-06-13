/**
 * Phase 16 D-01 / D-02: One-time CSV → teams.ts generator.
 *
 * Usage: pnpm run seed:rosters
 *
 * Reads the 5 committed CSV files in packages/shared/src/data/ and writes
 * packages/shared/src/teams.ts (TEAM_SQUADS + FREE_AGENTS).
 *
 * Source of truth: the 5 CSVs stay in the repo (D-01).
 * Output teams.ts is committed (D-02 — not a build step).
 */

import { createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'src', 'data');
const OUTPUT_PATH = join(__dirname, '..', 'src', 'teams.ts');

// D-03: CSV team name → TeamId mapping
const TEAM_ID_MAP: Record<string, string | null> = {
  Cozmos: 'cosmos',
  CITY: 'city',
  Crew: 'crew',
  Xolos: 'xolos',
  FA: null,
};

// ROLE_MAP: CSV position string → PlayerPiece role (Pitfall 2: STR → ST)
const ROLE_MAP: Record<string, 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST'> = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
  ST: 'ST',
  STR: 'ST', // city_players.csv and crew_players.csv use 'STR'
};

// ROLE_ORDER: for jersey number assignment (D-04, Pattern 2)
const ROLE_ORDER = ['GK', 'DEF', 'MID', 'FWD', 'ST'] as const;

// Formation positions (home-side only; away mirrored at runtime via q = 36 - q_home)
// Source: existing teams.ts comment block lines 26–34
type HexCoord = { q: number; r: number };

const FORMATION_POSITIONS: Record<string, HexCoord[]> = {
  GK: [{ q: 1, r: 13 }],
  DEF: [
    { q: 6, r: 6 },
    { q: 6, r: 13 },
    { q: 6, r: 19 },
  ],
  MID: [
    { q: 10, r: 9 },
    { q: 10, r: 17 },
  ],
  FWD: [
    { q: 15, r: 4 },
    { q: 15, r: 9 },
    { q: 15, r: 17 },
    { q: 15, r: 22 },
  ],
  ST: [{ q: 18, r: 13 }], // default attacking position; overridden by coin flip at runtime
};

interface RawPlayer {
  firstName: string;
  lastName: string;
  teamCsvName: string;
  nationality: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
  pace: number;
  dribbling: number;
  heading: number;
  highPass: number;
  resilience: number;
  shooting: number;
  tackling: number;
  aerialAbility: number;
  saving: number;
  handling: number;
}

/** Convert blank-or-non-numeric CSV cell to integer (blanks → 0). D-05 */
function toInt(s: string): number {
  const trimmed = s.trim();
  if (trimmed === '') return 0;
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? 0 : n;
}

/** Parse a CSV file and return rows as string arrays. First row is the header row. */
async function parseCSV(filePath: string): Promise<string[][]> {
  const rl = createInterface({ input: createReadStream(filePath) });
  const rows: string[][] = [];
  for await (const line of rl) {
    if (line.trim() === '') continue;
    rows.push(line.split(',').map((s) => s.trim()));
  }
  return rows;
}

/** Parse a single CSV row into a RawPlayer using a header→index map. */
function parseRow(row: string[], idx: Record<string, number>): RawPlayer {
  const fullName = row[idx['Player']] ?? '';
  // Split on first space: token[0] = firstName, remainder = lastName (D-07)
  const spaceIdx = fullName.indexOf(' ');
  const firstName = spaceIdx === -1 ? fullName : fullName.slice(0, spaceIdx);
  const lastName = spaceIdx === -1 ? '' : fullName.slice(spaceIdx + 1);

  const positionStr = row[idx['Position']] ?? '';
  const role = ROLE_MAP[positionStr];
  if (!role) {
    throw new Error(`Unknown position "${positionStr}" for player "${fullName}"`);
  }

  // Numeric attributes from CSV (blanks → 0 per D-05)
  let pace = toInt(row[idx['Pace']] ?? '');
  let dribbling = toInt(row[idx['Dribbling']] ?? '');
  let heading = toInt(row[idx['Heading']] ?? '');
  let highPass = toInt(row[idx['Highpass']] ?? '');
  let resilience = toInt(row[idx['Resilience']] ?? '');
  let shooting = toInt(row[idx['Shooting']] ?? '');
  let tackling = toInt(row[idx['Tackling']] ?? '');
  // D-05: 'Arial Ability' typo is preserved from the CSV — access by exact header string
  const aerialAbility = toInt(row[idx['Arial Ability']] ?? '');
  const saving = toInt(row[idx['Saving']] ?? '');
  const handling = toInt(row[idx['Handling']] ?? '');

  // GK overrides (Pitfall 3, D-04): force highPass=0 regardless of CSV value.
  // All other attributes must be >= 1 even for GKs (CSV often leaves them blank → 0).
  if (role === 'GK') {
    highPass = 0; // D-04: GKs use GK kick accuracy rule, not highPass
    // Floor any blank/zero outfield attributes to 1 (CSV blanks → toInt returns 0)
    if (pace === 0) pace = 1;
    if (shooting === 0) shooting = 1;
    if (tackling === 0) tackling = 1;
    if (dribbling === 0) dribbling = 1;
    if (heading === 0) heading = 1;
    if (resilience === 0) resilience = 1;
  }

  return {
    firstName,
    lastName,
    teamCsvName: row[idx['Team']] ?? '',
    nationality: row[idx['Nationality']] ?? '',
    role,
    pace,
    dribbling,
    heading,
    highPass,
    resilience,
    shooting,
    tackling,
    aerialAbility,
    saving,
    handling,
  };
}

interface PlayerEntry {
  id: string;
  teamId: 'home';
  firstName: string;
  lastName: string;
  number: number;
  nationality: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
  position: HexCoord;
  pace: number;
  shooting: number;
  tackling: number;
  dribbling: number;
  heading: number;
  saving: number;
  handling: number;
  resilience: number;
  aerialAbility: number;
  highPass: number;
}

/** Assign jersey numbers and positions to a squad of raw players. */
function buildSquadEntries(rawPlayers: RawPlayer[], squadPrefix: string): PlayerEntry[] {
  // Sort by ROLE_ORDER to assign numbers GK=1 first (D-04, Pattern 2)
  const sorted = [...rawPlayers].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.role);
    const bi = ROLE_ORDER.indexOf(b.role);
    return ai - bi;
  });

  // Track how many of each role we've placed (for position slot assignment)
  const roleCount: Record<string, number> = {};

  return sorted.map((p, i) => {
    const number = i + 1;
    const roleIdx = roleCount[p.role] ?? 0;
    roleCount[p.role] = roleIdx + 1;

    const positions = FORMATION_POSITIONS[p.role];
    const position = positions[roleIdx % positions.length];

    return {
      id: `${squadPrefix}-${i}`,
      teamId: 'home' as const, // placeholder; overridden at runtime by buildInitialGameState
      firstName: p.firstName,
      lastName: p.lastName,
      number,
      nationality: p.nationality,
      role: p.role,
      position,
      pace: p.pace,
      shooting: p.shooting,
      tackling: p.tackling,
      dribbling: p.dribbling,
      heading: p.heading,
      saving: p.saving,
      handling: p.handling,
      resilience: p.resilience,
      aerialAbility: p.aerialAbility,
      highPass: p.highPass,
    };
  });
}

/** Serialize a PlayerEntry to a TypeScript object literal string. */
function serializePlayer(p: PlayerEntry, indent = '    '): string {
  return `${indent}{
${indent}  id: '${p.id}',
${indent}  teamId: 'home',
${indent}  firstName: '${p.firstName.replace(/'/g, "\\'")}',
${indent}  lastName: '${p.lastName.replace(/'/g, "\\'")}',
${indent}  number: ${p.number},
${indent}  nationality: '${p.nationality.replace(/'/g, "\\'")}',
${indent}  role: '${p.role}',
${indent}  position: { q: ${p.position.q}, r: ${p.position.r} },
${indent}  pace: ${p.pace},
${indent}  shooting: ${p.shooting},
${indent}  tackling: ${p.tackling},
${indent}  dribbling: ${p.dribbling},
${indent}  heading: ${p.heading},
${indent}  saving: ${p.saving},
${indent}  handling: ${p.handling},
${indent}  resilience: ${p.resilience},
${indent}  aerialAbility: ${p.aerialAbility},
${indent}  highPass: ${p.highPass},
${indent}}`;
}

async function main() {
  const CSV_FILES = [
    'cosmos_players.csv',
    'xolos_players.csv',
    'city_players.csv',
    'crew_players.csv',
    'fa_players.csv',
  ];

  const squadMap: Record<string, RawPlayer[]> = {
    cosmos: [],
    xolos: [],
    city: [],
    crew: [],
  };
  const faRaw: RawPlayer[] = [];

  for (const csvFile of CSV_FILES) {
    const filePath = join(DATA_DIR, csvFile);
    const rows = await parseCSV(filePath);
    if (rows.length < 2) continue;

    const header = rows[0];
    const idx: Record<string, number> = {};
    for (let i = 0; i < header.length; i++) {
      idx[header[i]] = i;
    }

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 2) continue;

      const raw = parseRow(row, idx);
      const teamId = TEAM_ID_MAP[raw.teamCsvName];

      if (teamId === null) {
        // FA player
        faRaw.push(raw);
      } else if (teamId !== undefined && teamId in squadMap) {
        squadMap[teamId].push(raw);
      } else {
        console.warn(
          `Unknown team CSV name: "${raw.teamCsvName}" for player ${raw.firstName} ${raw.lastName}`,
        );
      }
    }
  }

  // Build squad entries with jersey numbers + positions
  const cosmosEntries = buildSquadEntries(squadMap['cosmos'], 'home');
  const xolosEntries = buildSquadEntries(squadMap['xolos'], 'home');
  const cityEntries = buildSquadEntries(squadMap['city'], 'home');
  const crewEntries = buildSquadEntries(squadMap['crew'], 'home');

  // FA players: numbered 1..24 in CSV order, all use ST/GK appropriate position
  const faEntries: PlayerEntry[] = faRaw.map((p, i) => {
    const roleIdx = 0; // FA players don't get formation positions in squads
    const positions = FORMATION_POSITIONS[p.role];
    const position = positions[roleIdx % positions.length];
    return {
      id: `fa-${i}`,
      teamId: 'home' as const,
      firstName: p.firstName,
      lastName: p.lastName,
      number: i + 1,
      nationality: p.nationality,
      role: p.role,
      position,
      pace: p.pace,
      shooting: p.shooting,
      tackling: p.tackling,
      dribbling: p.dribbling,
      heading: p.heading,
      saving: p.saving,
      handling: p.handling,
      resilience: p.resilience,
      aerialAbility: p.aerialAbility,
      highPass: p.highPass,
    };
  });

  // Serialize squads
  const cosmosStr = cosmosEntries.map((p) => serializePlayer(p)).join(',\n');
  const xolosStr = xolosEntries.map((p) => serializePlayer(p)).join(',\n');
  const cityStr = cityEntries.map((p) => serializePlayer(p)).join(',\n');
  const crewStr = crewEntries.map((p) => serializePlayer(p)).join(',\n');
  const faStr = faEntries.map((p) => serializePlayer(p)).join(',\n');

  const out = `/**
 * AUTO-GENERATED by packages/shared/scripts/seed-rosters.ts
 * Source of truth: packages/shared/src/data/*.csv (D-01)
 * Regenerate: pnpm run seed:rosters (D-02 — dev tool, not a build step)
 *
 * Exports TEAM_SQUADS (4 squads × 11 players) and FREE_AGENTS (24 players).
 * All players use home-side positions; buildInitialGameState mirrors away at runtime.
 * teamId is 'home' placeholder for all entries; overridden at runtime.
 */
import type { PlayerPiece } from './types.js';
import type { TeamId } from './teamConfig.js';

export const TEAM_SQUADS: Record<TeamId, readonly PlayerPiece[]> = {
  cosmos: [
${cosmosStr}
  ],
  xolos: [
${xolosStr}
  ],
  city: [
${cityStr}
  ],
  crew: [
${crewStr}
  ],
};

export const FREE_AGENTS: readonly PlayerPiece[] = [
${faStr}
];
`;

  writeFileSync(OUTPUT_PATH, out, 'utf-8');
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`  cosmos: ${cosmosEntries.length} players`);
  console.log(`  xolos: ${xolosEntries.length} players`);
  console.log(`  city: ${cityEntries.length} players`);
  console.log(`  crew: ${crewEntries.length} players`);
  console.log(`  free agents: ${faEntries.length} players`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
