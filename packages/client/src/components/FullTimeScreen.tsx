import { useGameStore } from '../store/useGameStore.js';
import styles from './FullTimeScreen.module.css';

/**
 * Full-time screen — shown when GameState.phase === 'FULL_TIME'.
 * UI-SPEC Screen 3: full-screen centred card with final score, result line,
 * and "Replay starting…" notice. No buttons — server auto-transitions to REPLAY after ~3s.
 */
export function FullTimeScreen() {
  const score = useGameStore((s) => s.gameState.score);

  // Result line derivation
  const resultText =
    score.home > score.away ? 'Home wins' : score.away > score.home ? 'Away wins' : 'Draw';
  const resultColor =
    score.home > score.away ? '#1a56b0' : score.away > score.home ? '#c0392b' : '#e0e0e0';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.heading}>Full Time</h2>

        {/* Score display */}
        <div className={styles.scoreRow}>
          <span className={styles.teamLabel} style={{ color: '#1a56b0' }}>
            Home
          </span>
          <span className={styles.score}>
            {score.home}&nbsp;&ndash;&nbsp;{score.away}
          </span>
          <span className={styles.teamLabel} style={{ color: '#c0392b' }}>
            Away
          </span>
        </div>

        {/* Result line */}
        <p className={styles.resultLine} style={{ color: resultColor }}>
          {resultText}
        </p>

        {/* Transition notice — static; server drives the actual transition (UI-SPEC) */}
        <p className={styles.body}>Replay starting&hellip;</p>
      </div>
    </div>
  );
}
