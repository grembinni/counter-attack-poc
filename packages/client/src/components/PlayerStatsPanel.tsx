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
        {piece.name}
        <span className={styles.role}>{piece.role}</span>
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
