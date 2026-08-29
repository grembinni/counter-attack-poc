/**
 * Phase 16 D-01 / D-02: One-time CSV → teams.ts generator.
 * Phase 19 D-11/D-12: Extended to emit PLAYER_POOL (replaces TEAM_SQUADS + FREE_AGENTS).
 * Phase 21 Bug-fix: Consolidated to single player-pool.csv with SourceTeam column.
 *
 * Usage: pnpm run seed:rosters
 *
 * Reads packages/shared/src/data/player-pool.csv and writes
 * packages/shared/src/teams.ts (PLAYER_POOL only).
 *
 * Source of truth: player-pool.csv (D-01).
 * Output teams.ts is committed (D-02 — not a build step).
 *
 * CSV processing order within player-pool.csv (determines p001..pNNN assignment):
 *   canada     → p001–p011
 *   city       → p012–p022
 *   crew       → p023–p033
 *   england    → p034–p044
 *   free-agent → p045–p100
 *   france     → p101–p111
 *   miami       → p112–p122
 *   lafc       → p123–p133
 *   mexico     → p134–p144
 *   nashville  → p145–p155
 *   seattle    → p156–p166
 *   spain      → p167–p177
 *   usmnt      → p178–p188
 *   generic-bench-home → p189–p193 (Phase 46 D-07: placeholder bench, see below)
 *   generic-bench-away → p194–p198 (Phase 46 D-07: placeholder bench, see below)
 */

import { createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { format, resolveConfig } from 'prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'src', 'data');
const OUTPUT_PATH = join(__dirname, '..', 'src', 'teams.ts');

// Phase 21: Single consolidated CSV — sourceTeamId comes directly from SourceTeam column
const PLAYER_POOL_CSV = 'player-pool.csv';

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

// Phase 46 / CONTEXT.md D-07: the two generic placeholder bench groups. These slugs get
// jersey numbers offset above the starting XI's 1-11 range (46-RESEARCH.md Pitfall 3:
// bench numbers must never collide with the starting XI).
const GENERIC_BENCH_SLUGS: Set<string> = new Set(['generic-bench-home', 'generic-bench-away']);
const GENERIC_BENCH_NUMBER_OFFSET = 11;

// Formation positions (home-side only; away mirrored at runtime via q = 36 - q_home)
type HexCoord = { q: number; r: number };

const FORMATION_POSITIONS: Record<string, HexCoord[]> = {
  GK: [{ q: 2, r: 13 }],
  DEF: [
    { q: 6, r: 6 },
    { q: 6, r: 13 },
    { q: 6, r: 19 },
    { q: 6, r: 25 }, // 4th DEF slot — needed for squads with 4 outfield defenders
  ],
  MID: [
    { q: 10, r: 9 },
    { q: 10, r: 17 },
    { q: 10, r: 3 }, // 3rd MID slot — needed for squads with 3 midfielders
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
  /** D-02 (Phase 28): reserved Legends/Icons tag; undefined = ordinary free agent. */
  poolTag?: 'legend' | 'icon';
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

  // Phase 21: SourceTeam column holds the canonical slug directly.
  // Fall back to toSlug(Team) for backwards compatibility if SourceTeam is absent.
  const sourceTeamRaw = row[idx['SourceTeam']] ?? '';
  const teamCsvName = sourceTeamRaw.trim() !== '' ? sourceTeamRaw : toSlug(row[idx['Team']] ?? '');

  // D-02 (Phase 28): whitelist-parse PoolTag — only 'legend'/'icon' accepted, else undefined (T-28-DATA).
  const poolTagRaw = (row[idx['PoolTag']] ?? '').trim();
  const poolTag = poolTagRaw === 'legend' || poolTagRaw === 'icon' ? poolTagRaw : undefined;

  return {
    firstName,
    lastName,
    teamCsvName,
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
    poolTag,
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
  /** D-02 (Phase 28): reserved Legends/Icons tag; undefined = ordinary player. */
  poolTag?: 'legend' | 'icon';
}

/** Assign jersey numbers and positions to a squad of raw players.
 * Returns entries with a sourceTeamId but WITHOUT a global p-ID (assigned by caller). */
function buildSquadEntries(
  rawPlayers: RawPlayer[],
  sourceTeamId: string,
  numberOffset: number = 0,
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
    const number = i + 1 + numberOffset;
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
      poolTag: p.poolTag,
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
${p.poolTag ? `${indent}  poolTag: '${p.poolTag}',\n` : ''}${indent}}`;
}

async function main() {
  // Global sequential ID counter — p001, p002, ... in CSV row order
  let counter = 1;

  // All teams keyed by sourceTeamId slug — preserves first-appearance order
  const teamMap: Map<string, RawPlayer[]> = new Map();
  const teamOrder: string[] = [];

  // ---- Parse player-pool.csv ----
  const filePath = join(DATA_DIR, PLAYER_POOL_CSV);
  const rows = await parseCSV(filePath);
  if (rows.length < 2) throw new Error(`player-pool.csv is empty or missing: ${filePath}`);

  const header = rows[0];
  // CR-02: Validate that no header cell contains a comma
  for (const cell of header) {
    if (cell.includes(','))
      throw new Error(
        `CSV header cell contains comma: "${cell}" in ${PLAYER_POOL_CSV} — use a quoted-field-aware parser`,
      );
  }
  const idx: Record<string, number> = {};
  for (let i = 0; i < header.length; i++) {
    idx[header[i]] = i;
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length < 2) continue;

    const raw = parseRow(row, idx);
    // Phase 21: SourceTeam column holds the slug directly (e.g. 'cosmos', 'free-agent', 'inter-miami')
    const slug = raw.teamCsvName.trim() !== '' ? raw.teamCsvName : toSlug(row[idx['Team']] ?? '');

    if (!teamMap.has(slug)) {
      teamMap.set(slug, []);
      teamOrder.push(slug);
    }
    teamMap.get(slug).push(raw);
  }

  // ---- Build entries in CSV row order, assigning global p-IDs ----
  const allEntries: PlayerEntry[] = [];

  for (const slug of teamOrder) {
    const rawPlayers = teamMap.get(slug) ?? [];

    if (slug === 'free-agent') {
      // Free agents use number=0 and always take first slot for their role
      for (const p of rawPlayers) {
        const positions = FORMATION_POSITIONS[p.role];
        const position = positions[0];
        allEntries.push({
          id: `p${String(counter++).padStart(3, '0')}`,
          sourceTeamId: 'free-agent',
          firstName: p.firstName,
          lastName: p.lastName,
          number: 0,
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
          poolTag: p.poolTag,
        });
      }
    } else {
      const numberOffset = GENERIC_BENCH_SLUGS.has(slug) ? GENERIC_BENCH_NUMBER_OFFSET : 0;
      const entries = buildSquadEntries(rawPlayers, slug, numberOffset);
      for (const e of entries) {
        allEntries.push({ id: `p${String(counter++).padStart(3, '0')}`, ...e });
      }
    }
  }

  // WR-07: Fail-fast count assertion before writing output
  // Phase 46 D-07: 188 existing players + 10 generic bench placeholders (5 home, 5 away)
  const EXPECTED_TOTAL = 198;
  if (allEntries.length !== EXPECTED_TOTAL) {
    throw new Error(
      `Expected ${EXPECTED_TOTAL} players, got ${allEntries.length}. Check player-pool.csv.`,
    );
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
  /** D-02 (Phase 28): reserved Legends/Icons tag; undefined = ordinary free agent, included in the 'original' pool. */
  poolTag?: 'legend' | 'icon';
}

/** DATA-01/D-12: Single unified player pool — replaces TEAM_SQUADS and FREE_AGENTS.
 * ${allEntries.length} total players: 4 legacy squads (44) + free agents (24) + MLS (44) + national (66). */
export const PLAYER_POOL: readonly PoolPlayer[] = [
${playersStr}
];
`;

  // Phase 46: format through the repo's own .prettierrc before writing so the raw
  // generator output is byte-for-byte identical to what the pre-commit hook (eslint --fix
  // + prettier --write) would otherwise silently rewrite the committed file to. Without
  // this, re-running `pnpm run seed:rosters` after a commit falsely reports a diff.
  const prettierConfig = await resolveConfig(OUTPUT_PATH);
  const formatted = await format(out, { ...prettierConfig, filepath: OUTPUT_PATH });

  writeFileSync(OUTPUT_PATH, formatted, 'utf-8');
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
