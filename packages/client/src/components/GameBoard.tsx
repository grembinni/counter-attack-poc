import { useGameStore } from '../store/useGameStore.js';
import { HexGrid } from './HexGrid.js';
import { TurnIndicator } from './TurnIndicator.js';
import { ActionLog } from './ActionLog.js';
import { ConnectionStatus } from './ConnectionStatus.js';
import { DisconnectBanner } from './DisconnectBanner.js';
import { ActionPanel } from './ActionPanel.js';
import { PlayerStatsPanel } from './PlayerStatsPanel.js';
import styles from './GameBoard.module.css';

/**
 * Full game board layout: header bar, pitch container (HexGrid), and right sidebar.
 * Sidebar contains TurnIndicator, ActionLog, and ActionPanel.
 * Layout spec: UI-SPEC §Layout Spec (header 48px, pitch flex:1, sidebar 280px).
 */
export function GameBoard() {
  const score = useGameStore((s) => s.gameState.score);

  return (
    <div className={styles.gameBoard}>
      <header className={styles.header}>
        <span>Counter Attack</span>
        <span className={styles.headerScore}>
          <span className={styles.homeTeam}>Home</span> {score.home} &ndash; {score.away}{' '}
          <span className={styles.awayTeam}>Away</span>
        </span>
        <ConnectionStatus />
      </header>
      <DisconnectBanner />
      <main className={styles.gameLayout}>
        <div className={styles.pitchContainer}>
          <HexGrid />
        </div>
        <aside className={styles.sidebar}>
          <TurnIndicator />
          <ActionPanel />
          <PlayerStatsPanel /> {/* D-05: stats panel between action buttons and log */}
          <ActionLog />
        </aside>
      </main>
    </div>
  );
}
