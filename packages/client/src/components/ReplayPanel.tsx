import { useGameStore } from '../store/useGameStore.js';
import styles from './ReplayPanel.module.css';

/**
 * Replay sidebar panel — shown during REPLAY phase in place of ActionPanel.
 * Displays the final score, live "Action N of N" counter, a running/complete indicator,
 * and a "Play Again" button after the last frame.
 *
 * UI-SPEC §Screen 4 REPLAY — ReplayPanel contents.
 * D-33: Play Again calls setScreen('CREATE_ROOM'); no socket emit needed (room cleaned up via disconnect).
 */
export function ReplayPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const score = useGameStore((s) => s.gameState.score);
  // replayIndex and replayTotal are carried on broadcast frames during REPLAY (D-31)
  const replayIndex = useGameStore((s) => s.gameState.replayIndex);
  const replayTotal = useGameStore((s) => s.gameState.replayTotal);
  const setScreen = useGameStore((s) => s.setScreen);

  if (phase !== 'REPLAY') return null;

  const current = replayIndex ?? 0;
  const isComplete = replayTotal !== undefined && current >= replayTotal;

  // Position counter: "Action {N} of {total}" or "Action {N}" if total unknown (UI-SPEC §Replay position counter)
  const positionLabel =
    replayTotal !== undefined ? `Action ${current} of ${replayTotal}` : `Action ${current}`;

  return (
    <div className={styles.panel}>
      {/* Panel heading */}
      <span className={styles.panelHeading}>Replay</span>

      {/* Final score — persistent throughout replay (D-33) */}
      <div className={styles.scoreLine}>
        <span className={styles.homeTeam}>Home</span>
        <span className={styles.scoreDisplay}>
          {score.home} &ndash; {score.away}
        </span>
        <span className={styles.awayTeam}>Away</span>
      </div>

      {/* Action N of N counter — accent-gold per UI-SPEC */}
      <span className={styles.positionCounter}>{positionLabel}</span>

      {/* Running / complete indicator */}
      <span className={styles.statusText}>{isComplete ? 'Replay complete.' : 'Playing…'}</span>

      {/* Play Again — visible only when replay is complete (D-33) */}
      {isComplete && (
        <button className={styles.ctaButton} onClick={() => setScreen('CREATE_ROOM')}>
          Play Again
        </button>
      )}
    </div>
  );
}
