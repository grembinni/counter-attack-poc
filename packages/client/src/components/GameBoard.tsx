import { useGameStore } from '../store/useGameStore.js';
import { HexGrid } from './HexGrid.js';
import { TurnIndicator } from './TurnIndicator.js';
import { ActionLog } from './ActionLog.js';
import { ConnectionStatus } from './ConnectionStatus.js';
import { DisconnectBanner } from './DisconnectBanner.js';
import { ActionPanel } from './ActionPanel.js';
import { KickOffSetupPanel } from './KickOffSetupPanel.js';
import { PlayerStatsPanel } from './PlayerStatsPanel.js';
import styles from './GameBoard.module.css';

// Play phases are the only phases where displaying the match clock is relevant.
// KICK_OFF_SETUP, HALF_TIME, FULL_TIME, REPLAY do not display the clock in the header.
const PLAY_PHASES = new Set([
  'KICK_OFF',
  'MOVEMENT',
  'PASS',
  'SHOT',
  'HEADER',
  'SNAPSHOT',
  'LOOSE_BALL',
  'GK_RESTART',
]);

/**
 * Full game board layout: header bar, pitch container (HexGrid), and right sidebar.
 * Sidebar contains TurnIndicator, phase-appropriate action panel, and ActionLog.
 * Layout spec: UI-SPEC §Layout Spec (header 48px, pitch flex:1, sidebar 280px).
 * Phase 8: adds match-time display in header; sidebar swaps ActionPanel by phase.
 */
export function GameBoard() {
  const score = useGameStore((s) => s.gameState.score);
  const phase = useGameStore((s) => s.gameState.phase);
  const actionCount = useGameStore((s) => s.gameState.actionCount);
  const addedTime = useGameStore((s) => s.gameState.addedTime);

  // Match time format: "45+N'" when actionCount > 45 and addedTime set; else "N'"
  // UI-SPEC formula: 45' base + surplus minutes consumed of added time
  const showTime = PLAY_PHASES.has(phase);
  const timeLabel = showTime
    ? actionCount > 45 && addedTime !== null
      ? `45+${actionCount - 45}'`
      : `${actionCount}'`
    : null;

  return (
    <div className={styles.gameBoard}>
      <header className={styles.header}>
        <span>Counter Attack</span>
        <span className={styles.headerScore}>
          <span className={styles.homeTeam}>Home</span> {score.home} &ndash; {score.away}{' '}
          <span className={styles.awayTeam}>Away</span>
        </span>
        {/* Phase 8: match time in accent-gold, between score and connection status */}
        {timeLabel !== null && <span className={styles.headerTime}>{timeLabel}</span>}
        <ConnectionStatus />
      </header>
      <DisconnectBanner />
      <main className={styles.gameLayout}>
        <div className={styles.pitchContainer}>
          <HexGrid />
        </div>
        <aside className={styles.sidebar}>
          <TurnIndicator />
          {/* Phase 8: swap sidebar panel by phase */}
          {phase === 'KICK_OFF_SETUP' ? (
            <KickOffSetupPanel />
          ) : (
            <>
              <ActionPanel />
              <PlayerStatsPanel /> {/* D-05: stats panel between action buttons and log */}
            </>
          )}
          <ActionLog />
        </aside>
      </main>
    </div>
  );
}
