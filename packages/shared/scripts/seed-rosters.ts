/**
 * Phase 16 D-01 / D-02: One-time CSV → teams.ts generator.
 * Phase 19 D-11/D-12: Extended to emit PLAYER_POOL (replaces TEAM_SQUADS + FREE_AGENTS).
 *
 * Usage: pnpm run seed:rosters
 *
 * Reads the 7 committed CSV files in packages/shared/src/data/ and writes
 * packages/shared/src/teams.ts (PLAYER_POOL only).
 *
 * Source of truth: the 7 CSVs stay in the repo (D-01).
 * Output teams.ts is committed (D-02 — not a build step).
 *
 * CSV processing order (determines p001..pNNN assignment):
 *   1. cosmos_players.csv  → p001–p011
 *   2. xolos_players.csv   → p012–p022
 *   3. city_players.csv    → p023–p033
 *   4. crew_players.csv    → p034–p044
 *   5. fa_players.csv      → p045–p068
 *   6. mls.csv             → p069–p112
 *   7. national.csv        → p113–p178
 */

import { createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'src', 'data');
const OUTPUT_PATH = join(__dirname, '..', 'src', 'teams.ts');

// D-03: CSV team name → fixed ColorSchemeId slug (for legacy 4 squad CSVs)
// Multi-team CSVs (mls.csv, national.csv) derive sourceTeamId from Team column via toSlug()
const TEAM_ID_MAP: Record<string, string | null> = {
  Cozmos: 'cosmos',
  CITY: 'city',
  Crew: 'crew',
  Xolos: 'xolos',
  FA: 'free-agent', // Phase 19 A4: free agents use 'free-agent' slug
};

// CSV files that carry a single team per file (sourceTeamId from TEAM_ID_MAP)
const SINGLE_TEAM_CSV_FILES = [
  'cosmos_players.csv',
  'xolos_players.csv',
  'city_players.csv',
  'crew_players.csv',
  'fa_players.csv',
];

// CSV files where each row may have a different team name in the Team column (sourceTeamId from toSlug())
const MULTI_TEAM_CSV_FILES = ['mls.csv', 'national.csv'];

// Phase 19 D-11: full ordered CSV list — processing order determines p001..pNNN assignment
const CSV_FILES = [...SINGLE_TEAM_CSV_FILES, ...MULTI_TEAM_CSV_FILES];

// ROLE_MAP: CSV position string → PlayerPiece role (Pitfall 2: STR → ST, Pitfall 6: national.csv)
const ROLE_MAP: Record<string, 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST'> = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  FWD: 'FWD',
  ST: 'ST',
  STR: 'ST', // city_players.csv, crew_players.csv, and national.csv use 'STR'
};

// ROLE_ORDER: for jersey number assignment (D-04, Pattern 2)
const ROLE_ORDER = ['GK', 'DEF', 'MID', 'FWD', 'ST'] as const;

// Formation positions (home-side only; away mirrored at runtime via q = 36 - q_home)
type HexCoord = { q: number; r: number };

const FORMATION_POSITIONS: Record<string, HexCoord[]> = {
  GK: [{ q: 2, r: 13 }],
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

/** Phase 19 D-11: Normalize team name to a URL-safe slug for sourceTeamId.
 * "Inter Miami" → "inter-miami", "USMNT" → "usmnt", "England" → "england". */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

interface RawPlayer {
  firstName: string;
  lastName: string;
  teamCsvName: string;
  nationality: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
  pace: number;
  dribbling: number;
  highPass: number;
  resilience: number;
  shooting: number;
  tackling: number;
  aerialAbility: number;
  saving: number;
  handling: number;
  // NOTE: 'heading' intentionally omitted — D-01 (Phase 17): removed from PlayerPiece
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
  // NOTE: Heading intentionally excluded — D-01 (Phase 17): removed from PlayerPiece
  let pace = toInt(row[idx['Pace']] ?? '');
  let dribbling = toInt(row[idx['Dribbling']] ?? '');
  let highPass = toInt(row[idx['Highpass']] ?? '');
  let resilience = toInt(row[idx['Resilience']] ?? '');
  let shooting = toInt(row[idx['Shooting']] ?? '');
  let tackling = toInt(row[idx['Tackling']] ?? '');
  // D-13: CSV header typo fixed — now reads 'Aerial Ability' (was misspelled in original CSVs)
  const aerialAbility = toInt(row[idx['Aerial Ability']] ?? '');
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
  sourceTeamId: string;
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
  saving: number;
  handling: number;
  resilience: number;
  aerialAbility: number;
  highPass: number;
}

/** Assign jersey numbers and positions to a squad of raw players.
 * Returns entries with a sourceTeamId but WITHOUT a global p-ID (assigned by caller). */
function buildSquadEntries(
  rawPlayers: RawPlayer[],
  sourceTeamId: string,
): Omit<PlayerEntry, 'id'>[] {
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
      sourceTeamId,
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
      saving: p.saving,
      handling: p.handling,
      resilience: p.resilience,
      aerialAbility: p.aerialAbility,
      highPass: p.highPass,
    };
  });
}

/** Serialize a PlayerEntry to a TypeScript object literal string. */
function serializePlayer(p: PlayerEntry, indent = '  '): string {
  return `${indent}{
${indent}  id: '${p.id}',
${indent}  sourceTeamId: '${p.sourceTeamId.replace(/'/g, "\\'")}',
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
${indent}  saving: ${p.saving},
${indent}  handling: ${p.handling},
${indent}  resilience: ${p.resilience},
${indent}  aerialAbility: ${p.aerialAbility},
${indent}  highPass: ${p.highPass},
${indent}}`;
}

async function main() {
  // Global sequential ID counter — p001, p002, ... across all CSV files in CSV_FILES order
  let counter = 1;

  // Per-squad raw players, keyed by ColorSchemeId slug for the 4 legacy squads
  const squadMap: Record<string, RawPlayer[]> = {
    cosmos: [],
    xolos: [],
    city: [],
    crew: [],
  };
  // Free agents (Team = 'FA')
  const faRaw: RawPlayer[] = [];
  // Multi-team CSV players: keyed by toSlug(teamName) → array of raw players per team
  const multiTeamMap: Map<string, RawPlayer[]> = new Map();
  // Track order of first appearance for multi-team CSVs (for deterministic ID assignment)
  const multiTeamOrder: string[] = [];

  // ---- Parse all CSVs ----
  for (const csvFile of CSV_FILES) {
    const filePath = join(DATA_DIR, csvFile);
    const rows = await parseCSV(filePath);
    if (rows.length < 2) continue;

    const header = rows[0];
    const idx: Record<string, number> = {};
    for (let i = 0; i < header.length; i++) {
      idx[header[i]] = i;
    }

    const isMultiTeam = MULTI_TEAM_CSV_FILES.includes(csvFile);

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 2) continue;

      const raw = parseRow(row, idx);

      if (isMultiTeam) {
        // mls.csv / national.csv: sourceTeamId = toSlug(Team column)
        const slug = toSlug(raw.teamCsvName);
        if (!multiTeamMap.has(slug)) {
          multiTeamMap.set(slug, []);
          multiTeamOrder.push(slug);
        }
        multiTeamMap.get(slug).push(raw);
      } else {
        // Single-team CSVs: map via TEAM_ID_MAP
        const teamId = TEAM_ID_MAP[raw.teamCsvName];
        if (teamId === 'free-agent') {
          faRaw.push(raw);
        } else if (teamId !== undefined && teamId !== null && teamId in squadMap) {
          squadMap[teamId].push(raw);
        } else {
          console.warn(
            `Unknown team CSV name: "${raw.teamCsvName}" for player ${raw.firstName} ${raw.lastName}`,
          );
        }
      }
    }
  }

  // ---- Build entries in CSV_FILES order, assigning global p-IDs ----
  const allEntries: PlayerEntry[] = [];

  // 1–4: Legacy squad CSVs in file order (cosmos, xolos, city, crew)
  for (const squadId of ['cosmos', 'xolos', 'city', 'crew']) {
    const entries = buildSquadEntries(squadMap[squadId], squadId);
    for (const e of entries) {
      allEntries.push({ id: `p${String(counter++).padStart(3, '0')}`, ...e });
    }
  }

  // 5: Free agents — numbered 1..N in CSV row order; position from role default
  const faEntries = faRaw.map((p) => {
    const positions = FORMATION_POSITIONS[p.role];
    const position = positions[0]; // FA players use first slot for their role
    return {
      id: `p${String(counter++).padStart(3, '0')}`,
      sourceTeamId: 'free-agent',
      firstName: p.firstName,
      lastName: p.lastName,
      number: 0, // FA players don't have squad jersey numbers; 0 = unassigned
      nationality: p.nationality,
      role: p.role,
      position,
      pace: p.pace,
      shooting: p.shooting,
      tackling: p.tackling,
      dribbling: p.dribbling,
      saving: p.saving,
      handling: p.handling,
      resilience: p.resilience,
      aerialAbility: p.aerialAbility,
      highPass: p.highPass,
    } satisfies PlayerEntry;
  });
  allEntries.push(...faEntries);

  // 6–7: Multi-team CSVs (mls.csv, national.csv) — per-team squads in team appearance order
  for (const slug of multiTeamOrder) {
    const rawPlayers = multiTeamMap.get(slug) ?? [];
    const entries = buildSquadEntries(rawPlayers, slug);
    for (const e of entries) {
      allEntries.push({ id: `p${String(counter++).padStart(3, '0')}`, ...e });
    }
  }

  // ---- Emit teams.ts ----
  const playersStr = allEntries.map((p) => serializePlayer(p)).join(',\n');

  // Collect stats per source for log output
  const sourceCounts: Map<string, number> = new Map();
  for (const e of allEntries) {
    sourceCounts.set(e.sourceTeamId, (sourceCounts.get(e.sourceTeamId) ?? 0) + 1);
  }

  const out = `/**
 * AUTO-GENERATED by packages/shared/scripts/seed-rosters.ts
 * Source of truth: packages/shared/src/data/*.csv (D-01)
 * Regenerate: pnpm run seed:rosters (D-02 — dev tool, not a build step)
 *
 * Phase 19: Exports PLAYER_POOL (flat array of all ${allEntries.length} players).
 * Replaces TEAM_SQUADS + FREE_AGENTS (Phase 16 shape — now removed).
 * All players use home-side formation positions; buildInitialGameState mirrors away at runtime.
 * heading intentionally omitted from PoolPlayer — D-01 (Phase 17).
 */
import type { HexCoord } from './types.js';

/** Phase 19 DATA-01/D-07: Pool player with sourceTeamId annotation.
 * Replaces PlayerPiece\\u2019s teamId (\\'home\\'|\\'away\\') with sourceTeamId (squad origin).
 * Fields match PlayerPiece stats minus teamId (set at runtime by buildSquadPieces).
 * heading field intentionally omitted — D-01 (Phase 17): heading removed from PlayerPiece. */
export interface PoolPlayer {
  /** Sequential pool ID: p001, p002, ... — assigned by seed script, stable. */
  id: string;
  /** Squad of origin — ColorSchemeId values for legacy squads; team slug for MLS/national; \\'free-agent\\'.
   * Typed as string (wide) per A4 — tightened to a closed union in Phase 21 when all slugs are known. */
  sourceTeamId: string;
  firstName: string;
  lastName: string;
  /** Jersey number within source squad (1–11 per squad; 0 for free agents). */
  number: number;
  nationality: string;
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
  /** D-02: Formation position placeholder — no algorithmic role until Phase 24. */
  position: HexCoord;
  pace: number;
  shooting: number;
  tackling: number;
  dribbling: number;
  saving: number;
  handling: number;
  resilience: number;
  /** D-13: Aerial Ability — CSV header typo corrected in Phase 19. */
  aerialAbility: number;
  highPass: number;
}

/** DATA-01/D-12: Single unified player pool — replaces TEAM_SQUADS and FREE_AGENTS.
 * ${allEntries.length} total players: 4 legacy squads (44) + free agents (${faEntries.length}) + MLS (44) + national (66). */
export const PLAYER_POOL: readonly PoolPlayer[] = [
${playersStr}
];
`;

  writeFileSync(OUTPUT_PATH, out, 'utf-8');
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`  Total players: ${allEntries.length}`);
  for (const [src, count] of sourceCounts) {
    console.log(`  ${src}: ${count} players`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
