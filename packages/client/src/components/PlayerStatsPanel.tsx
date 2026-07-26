import type { PlayerPiece } from '@counter-attack/shared';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { TeamBadge } from './TeamBadge.js';
import { NationFlag } from './NationFlag.js';
import styles from './PlayerStatsPanel.module.css';

/**
 * Stat definitions: [attribute key, abbreviation, full label for title tooltip].
 * Abbreviation shown in card; full label visible on hover via `title`.
 * Exported so LineupAssignmentScreen can reuse the same ordered list.
 */
// Order determines grid position: stats fill 3 columns left-to-right, top-to-bottom.
// Col 1: pace / dribbling  Col 2: tackling / aerial  Col 3: shooting / passing (or save / handling for GK)
// shooting+saving are adjacent so the role filter always lands one of them in col-3 row-1;
// highPass+handling likewise for col-3 row-2.
export const STAT_LABELS: Array<[keyof PlayerPiece, string, string]> = [
  ['pace', 'PACE', 'Pace'],
  ['tackling', 'TACKLING', 'Tackling'],
  ['shooting', 'SHOOTING', 'Shooting'], // outfield col-3 row-1 (filtered out for GK)
  ['saving', 'SAVE', 'Saving'], // GK col-3 row-1 (filtered out for outfield)
  ['dribbling', 'DRIBBLING', 'Dribbling'],
  ['aerialAbility', 'AERIAL', 'Aerial Ability'],
  ['highPass', 'PASSING', 'High Pass'], // outfield col-3 row-2 (filtered out for GK)
  ['handling', 'HANDLING', 'Handling'], // GK col-3 row-2 (filtered out for outfield)
  ['resilience', 'RES', 'Resilience'],
];

/** Returns color tier for a stat value on the 1-9 scale. */
function statTier(value: number): 'high' | 'mid' | 'low' {
  if (value >= 5) return 'high';
  if (value >= 3) return 'mid';
  return 'low';
}

/**
 * Inline SVG mini token badge — self-contained <defs>, no HexGrid dependency.
 * D-08/D-09/D-10: home outfield = stripe pattern; home GK = checker; away GK = solid amber.
 */
function MiniTokenBadge({ piece }: { piece: PlayerPiece }) {
  const isGK = piece.role === 'GK';
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);
  const teamId = selectedTeams[piece.teamId];
  const jerseyPatId = `mini-${teamId}-jersey-${piece.id}`;
  const homeGkPatId = `mini-home-gk-checker-${piece.id}`;
  const gkFill = isGK && piece.teamId === 'home' ? `url(#${homeGkPatId})` : '#f59e0b';
  const gkStroke = piece.teamId === 'home' ? '#6c3483' : '#d97706';
  const outfieldStroke = piece.teamId === 'home' ? '#0d3a82' : '#8e1c12';

  return (
    <svg width={20} height={20} viewBox="0 0 20 20" className={styles.tokenBadge}>
      {!isGK && (
        <defs>
          <pattern
            id={jerseyPatId}
            x={1}
            y={1}
            width={18}
            height={18}
            patternUnits="userSpaceOnUse"
          >
            <rect width={18} height={18} fill={TEAM_CONFIGS[teamId].palette.homePrime} />
            <rect x={0} y={6} width={18} height={6} fill="#ffffff" fillOpacity={0.4} />
          </pattern>
        </defs>
      )}
      {isGK && piece.teamId === 'home' && (
        <defs>
          <pattern
            id={homeGkPatId}
            x={1}
            y={1}
            width={10}
            height={10}
            patternUnits="userSpaceOnUse"
          >
            <rect width={10} height={10} fill="#7c3aed" />
            <rect x={0} y={0} width={5} height={5} fill="#4c1d95" />
            <rect x={5} y={5} width={5} height={5} fill="#4c1d95" />
          </pattern>
        </defs>
      )}
      <circle
        cx={10}
        cy={10}
        r={9}
        fill={isGK ? gkFill : `url(#${jerseyPatId})`}
        stroke={isGK ? gkStroke : outfieldStroke}
        strokeWidth={1.5}
      />
      <text
        x={10}
        y={10}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        fill="#ffffff"
        fontStyle={isGK ? 'italic' : 'normal'}
        pointerEvents="none"
      >
        {String(piece.number)}
      </text>
    </svg>
  );
}

/**
 * Flat player card:
 *
 * [TeamBadge 56px] │ [token] Name Surname  [🏳] [ROLE]
 *                  │ [PAC●][SHO●][TAC●][DRI●][SAV●]
 *                  │ [HND●][RES●][AER●][PAS●]
 *
 * Stat badges: green ≥7 / orange 4-6 / red ≤3 (via data-tier CSS attribute selector).
 * Abbreviated labels show full name on hover via `title`.
 */
export function PlayerStatsPanel() {
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const pieces = useGameStore((s) => s.gameState.pieces);
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);

  if (!selectedPieceId) return null;
  const piece = pieces.find((p) => p.id === selectedPieceId);
  if (!piece) return null;

  const teamId = selectedTeams[piece.teamId];

  return (
    <div className={styles.panel}>
      {/* Left column: large team badge */}
      <TeamBadge teamId={teamId} size={56} full />

      {/* Right column: header + 2-row stat grid */}
      <div className={styles.cardBody}>
        {/* Header: token · name · [flag · role · #n] */}
        <div className={styles.cardHeader}>
          <MiniTokenBadge piece={piece} />
          <span className={styles.playerName}>
            {piece.firstName} {piece.lastName}
          </span>
          <div className={styles.playerMeta}>
            <NationFlag nationality={piece.nationality} size={20} />
            <span className={styles.roleChip}>{piece.role}</span>
            <span className={styles.jerseyNum}>#{piece.number}</span>
          </div>
        </div>

        {/* 4-column stat grid → 2 rows of 4+3 (7 role-filtered stats) */}
        <div className={styles.statGrid}>
          {STAT_LABELS.filter(([attr]) => {
            if (attr === 'resilience') return false;
            const isGK = piece.role === 'GK';
            if (isGK) return attr !== 'shooting' && attr !== 'highPass';
            return attr !== 'saving' && attr !== 'handling';
          }).map(([attr, abbr, fullLabel]) => {
            const value = piece[attr] as number;
            return (
              <div key={attr} className={styles.statChip} title={fullLabel}>
                <span className={styles.statBadge} data-tier={statTier(value)}>
                  {value}
                </span>
                <span className={styles.statAbbr}>{abbr}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
