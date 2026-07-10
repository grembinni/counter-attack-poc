import type { PlayerPiece } from '@counter-attack/shared';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { TeamBadge } from './TeamBadge.js';
import styles from './PlayerStatsPanel.module.css';

/**
 * Ordered list of all 10 PlayerPiece attributes with their display labels.
 * D-05 (Phase 7.1): stats panel shows all attributes for selected piece.
 */
const STAT_LABELS: Array<[keyof PlayerPiece, string]> = [
  ['pace', 'Pace'],
  ['shooting', 'Shooting'],
  ['tackling', 'Tackling'],
  ['dribbling', 'Dribbling'],
  ['saving', 'Saving'],
  ['handling', 'Handling'],
  ['resilience', 'Resilience'],
  ['aerialAbility', 'Aerial'],
  ['highPass', 'High Pass'],
];

/**
 * D-08/D-09: Inline SVG mini token badge for the PlayerStatsPanel header.
 * Self-contained <defs> patterns — does NOT reference HexGrid's pattern IDs (separate SVG document).
 * Shows the home/away stripe pattern for outfield pieces; solid fill for GK.
 */
function MiniTokenBadge({ piece }: { piece: PlayerPiece }) {
  const isGK = piece.role === 'GK';
  const miniR = 9;
  const miniCx = 10;
  const miniCy = 10;

  // D-08: player number from piece.number (replaces id-slice derivation)
  const playerNumber = String(piece.number);

  // D-06/D-17: team-keyed pattern ids (15-03) — reads selectedTeams from store
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);
  const teamId = selectedTeams[piece.teamId];
  const jerseyPatId = `mini-${teamId}-jersey-${piece.id}`;
  const homeGkPatId = `mini-home-gk-checker-${piece.id}`;

  // D-10: home GK uses checker pattern; away GK keeps solid amber
  const gkFill = isGK && piece.teamId === 'home' ? `url(#${homeGkPatId})` : '#f59e0b';
  const gkStroke = piece.teamId === 'home' ? '#6c3483' : '#d97706';
  const outfieldStroke = piece.teamId === 'home' ? '#0d3a82' : '#8e1c12';

  return (
    <svg width={20} height={20} viewBox="0 0 20 20" className={styles.tokenBadge}>
      {/* D-09: self-contained team-keyed jersey defs — outfield only */}
      {!isGK && (
        <defs>
          <pattern
            id={jerseyPatId}
            x={miniCx - miniR}
            y={miniCy - miniR}
            width={18}
            height={18}
            patternUnits="userSpaceOnUse"
          >
            <rect width={18} height={18} fill={TEAM_CONFIGS[teamId].palette.homePrime} />
            {/* Horizontal white stripe across centre — matches scaled cosmos jersey */}
            <rect x={0} y={6} width={18} height={6} fill="#ffffff" fillOpacity={0.4} />
          </pattern>
        </defs>
      )}
      {/* D-10: home GK checker pattern def — 10px tile, 5px checkers */}
      {isGK && piece.teamId === 'home' && (
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
      )}
      <circle
        cx={miniCx}
        cy={miniCy}
        r={miniR}
        fill={isGK ? gkFill : `url(#${jerseyPatId})`}
        stroke={isGK ? gkStroke : outfieldStroke}
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
        fontStyle={isGK ? 'italic' : 'normal'}
        pointerEvents="none"
      >
        {playerNumber}
      </text>
    </svg>
  );
}

/**
 * Sidebar stats card showing the selected piece's name, role, and all 10 attributes.
 * Reads selectedPieceId and gameState.pieces from Zustand.
 * Returns null when no piece is selected (avoids taking up sidebar space).
 *
 * D-05 / D-06 (Phase 7.1): both players can inspect any piece — this panel renders
 * for any piece clicked on the board regardless of who is the active player.
 * Inspection is LOCAL CLIENT STATE ONLY — never emits to the server.
 * TEAM-02: player cards display name, position/role, and all attributes.
 */
export function PlayerStatsPanel() {
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const pieces = useGameStore((s) => s.gameState.pieces);
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);

  if (!selectedPieceId) return null;
  const piece = pieces.find((p) => p.id === selectedPieceId);
  if (!piece) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        {/* D-08/D-09: inline SVG mini token badge — self-contained defs, no HexGrid dependency */}
        <MiniTokenBadge piece={piece} />
        {/* D-08/D-09 (PLAY-02): 3-line header — firstName / lastName / badge|role|#number */}
        <div className={styles.headerText}>
          <span className={styles.firstName}>{piece.firstName}</span>
          <span className={styles.lastName}>{piece.lastName}</span>
          <span className={styles.playerMeta}>
            <TeamBadge teamId={selectedTeams[piece.teamId]} size={20} />
            <span className={styles.role}>{piece.role}</span>
            <span>#{piece.number}</span>
          </span>
        </div>
      </div>
      <div className={styles.statGrid}>
        {STAT_LABELS.map(([attr, label]) => (
          <div key={attr} className={styles.statRow}>
            <span className={styles.statLabel}>{label}</span>
            <span className={styles.statValue}>{piece[attr] as number}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
