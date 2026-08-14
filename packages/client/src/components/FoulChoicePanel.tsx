import { useGameStore } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';
import styles from './FoulChoicePanel.module.css';

/**
 * FOUL-03/D-01: two-button continue-or-restart decision panel shown to both managers after
 * a foul resolves. The deciding manager is the FOULED side — the engine sets `attackingTeam`
 * to the fouled team the instant a foul is called (Plan 39-10/39-11), so `attackingTeam` IS
 * the deciding team here, read via a dedicated selector rather than re-derived. GKDIVE-03:
 * when the foul originated from a GK dive-at-feet duel, the restart button reads "Take the
 * Penalty" instead of "Take the Free Kick" — same panel, conditional label, no separate
 * component; the emitted choice is always `'restart'` regardless of source. Returns null
 * unless `phase === 'FOUL_CHOICE'` and the reader has a resolved team.
 */
export function FoulChoicePanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const myTeamOrNull = useMyTeam();
  const pieces = useGameStore((s) => s.gameState.pieces);
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const foulVictimId = useGameStore((s) => s.gameState.foulVictimId);
  const foulSource = useGameStore((s) => s.gameState.foulSource);
  const gameError = useGameStore((s) => s.gameError);
  const emitFoulChoice = useGameStore((s) => s.emitFoulChoice);

  if (phase !== 'FOUL_CHOICE' || myTeamOrNull === null) {
    return null;
  }

  const myTeam = myTeamOrNull;
  // The fouled side decides — see header comment. Kept as a named comparison (rather than
  // inlining `attackingTeam`) so the "who decides" rule reads clearly at every call site below.
  const decidingTeam = attackingTeam;
  const humanisedError = restartErrorMessage(gameError);

  if (myTeam !== decidingTeam) {
    const sideLabel = decidingTeam === attackingTeam ? 'Attacking' : 'Defending';
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Foul!</span>
          <span
            className={styles.helperLine2}
          >{`${sideLabel} team is deciding whether to continue play…`}</span>
        </div>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      </div>
    );
  }

  // D-01: victim name resolved through the pieces array; fall back to the raw id only if the
  // piece is missing, never render undefined.
  const victimPiece = pieces.find((p) => p.id === foulVictimId);
  const victimName =
    victimPiece !== undefined
      ? victimPiece.lastName
        ? `${victimPiece.firstName} ${victimPiece.lastName}`
        : victimPiece.firstName
      : (foulVictimId ?? '');

  // GKDIVE-03: the restart button's label (not its emitted payload) changes when the foul
  // came from a GK dive-at-feet duel — the underlying choice is still 'restart'.
  const restartLabel = foulSource === 'GK_DIVE_AT_FEET' ? 'Take the Penalty' : 'Take the Free Kick';

  return (
    <div className={styles.panel}>
      <div className={styles.helperBlock}>
        <span className={styles.helperLine1}>Foul!</span>
        <span
          className={styles.helperLine2}
        >{`${victimName}'s side may continue play or take the restart.`}</span>
      </div>
      <button className={styles.ctaButton} onClick={() => emitFoulChoice('continue')}>
        Continue Play
      </button>
      <button className={styles.ctaButton} onClick={() => emitFoulChoice('restart')}>
        {restartLabel}
      </button>
      {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
    </div>
  );
}
