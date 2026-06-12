import type { PlayerPiece } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
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
  ['heading', 'Heading'],
  ['saving', 'Saving'],
  ['handling', 'Handling'],
  ['resilience', 'Resilience'],
  ['aerialAbility', 'Aerial Ability'],
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

  // Player number: 1-based — matches PieceOverlay derivation (line 35 of PieceOverlay.tsx)
  const playerNumber = String(Number(piece.id.slice(piece.id.lastIndexOf('-') + 1)) + 1);

  const homePatId = `mini-home-stripe-${piece.id}`;
  const awayPatId = `mini-away-stripe-${piece.id}`;

  // Fill/stroke colors mirror PieceOverlay values (lines 40-53)
  const gkFill = piece.teamId === 'home' ? '#9b59b6' : '#f59e0b';
  const gkStroke = piece.teamId === 'home' ? '#6c3483' : '#d97706';
  const outfieldStroke = piece.teamId === 'home' ? '#0d3a82' : '#8e1c12';

  return (
    <svg width={20} height={20} viewBox="0 0 20 20" className={styles.tokenBadge}>
      {/* D-09: self-contained stripe defs — outfield only */}
      {!isGK && (
        <defs>
          {piece.teamId === 'home' ? (
            <pattern
              id={homePatId}
              x={miniCx - miniR}
              y={miniCy - miniR}
              width={18}
              height={18}
              patternUnits="userSpaceOnUse"
            >
              {/* Single vertical black stripe centered on 18px tile (x=7..11) */}
              <rect x={7} y={0} width={4} height={18} fill="#000000" fillOpacity={0.55} />
            </pattern>
          ) : (
            <pattern
              id={awayPatId}
              x={miniCx - miniR}
              y={miniCy - miniR}
              width={18}
              height={18}
              patternUnits="userSpaceOnUse"
            >
              {/* Two horizontal maroon bands — proportional to 18px tile: y=4..7 and y=11..14 */}
              <rect x={0} y={4} width={18} height={3} fill="#7f0000" fillOpacity={0.65} />
              <rect x={0} y={11} width={18} height={3} fill="#7f0000" fillOpacity={0.65} />
            </pattern>
          )}
        </defs>
      )}
      <circle
        cx={miniCx}
        cy={miniCy}
        r={miniR}
        fill={isGK ? gkFill : `url(#${piece.teamId === 'home' ? homePatId : awayPatId})`}
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

  if (!selectedPieceId) return null;
  const piece = pieces.find((p) => p.id === selectedPieceId);
  if (!piece) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        {/* D-08/D-09: inline SVG mini token badge — self-contained defs, no HexGrid dependency */}
        <MiniTokenBadge piece={piece} />
        <div className={styles.headerText}>
          {piece.name}
          <span className={styles.role}>{piece.role}</span>
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
