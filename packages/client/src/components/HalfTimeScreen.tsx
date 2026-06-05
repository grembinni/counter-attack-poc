import { useGameStore } from '../store/useGameStore.js';
import styles from './HalfTimeScreen.module.css';

/**
 * Half-time screen — shown when GameState.phase === 'HALF_TIME'.
 * UI-SPEC Screen 2: full-screen centred card with score, added time, kick-off assignment,
 * and a "Start 2nd Half" button gated to the non-first-half kick-off team (D-28).
 */
export function HalfTimeScreen() {
  const score = useGameStore((s) => s.gameState.score);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const kickOffTeam = useGameStore((s) => s.gameState.kickOffTeam);
  const addedTime = useGameStore((s) => s.gameState.addedTime);
  const emitHalfTimeStart = useGameStore((s) => s.emitHalfTimeStart);

  // Only the team that did NOT kick off in the first half may start the 2nd half (D-28)
  const myTeam: 'home' | 'away' | null =
    playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
  const canStart = myTeam !== null && myTeam !== kickOffTeam;

  // Team that takes the 2nd half kick-off (opposite of 1st half)
  const secondHalfKickOffTeam = kickOffTeam === 'home' ? 'away' : 'home';
  const secondHalfTeamName = secondHalfKickOffTeam === 'home' ? 'Home' : 'Away';
  const secondHalfTeamColor = secondHalfKickOffTeam === 'home' ? '#1a56b0' : '#c0392b';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.heading}>Half Time</h2>
        <p className={styles.body}>End of 1st Half</p>

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

        {/* Added time note — only shown when addedTime > 0 (D-05 / UI-SPEC) */}
        {addedTime !== null && addedTime > 0 && (
          <p className={styles.body}>Added time played: +{addedTime}&apos;</p>
        )}

        {/* 2nd half kick-off assignment */}
        <p className={styles.body}>
          2nd half kick-off:{' '}
          <span style={{ color: secondHalfTeamColor, fontWeight: 700 }}>{secondHalfTeamName}</span>
        </p>

        {/* Start 2nd Half button — only enabled for the non-first-half kick-off team */}
        <button
          className={styles.ctaButton}
          disabled={!canStart}
          title={!canStart ? 'Only the 2nd half kick-off team can start' : undefined}
          onClick={() => emitHalfTimeStart()}
        >
          Start 2nd Half
        </button>
      </div>
    </div>
  );
}
