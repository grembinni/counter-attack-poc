import { useGameStore } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';
import styles from './GkDiveAtFeetPromptPanel.module.css';

/**
 * GKDIVE-02/D-07: two-button Dive/Decline interrupt prompt shown to both managers when a
 * ball carrier ends a move within the GK's dive-at-feet range. Structurally identical to
 * `FoulChoicePanel` — same panel shape, different copy/target. The deciding manager is
 * `gkDiveAtFeetTeam` (the GK's team); the attacking manager sees a waiting message.
 * GKDIVE-02: the distance qualifier surfaces the -1 dice penalty band (distance === 3) before
 * the manager commits. Returns null unless phase === 'GK_DIVE_AT_FEET_PROMPT' and the reader
 * has a resolved team.
 */
export function GkDiveAtFeetPromptPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const myTeamOrNull = useMyTeam();
  const pieces = useGameStore((s) => s.gameState.pieces);
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const gkDiveAtFeetTeam = useGameStore((s) => s.gameState.gkDiveAtFeetTeam);
  const gkDiveAtFeetCarrierId = useGameStore((s) => s.gameState.gkDiveAtFeetCarrierId);
  const gkDiveAtFeetDistance = useGameStore((s) => s.gameState.gkDiveAtFeetDistance);
  const gameError = useGameStore((s) => s.gameError);
  const emitGkDiveAtFeet = useGameStore((s) => s.emitGkDiveAtFeet);

  if (phase !== 'GK_DIVE_AT_FEET_PROMPT' || myTeamOrNull === null) {
    return null;
  }

  const myTeam = myTeamOrNull;
  const decidingTeam = gkDiveAtFeetTeam ?? null;
  const humanisedError = restartErrorMessage(gameError);

  if (myTeam !== decidingTeam) {
    // The GK's team decides; described relative to the reader (attacking/defending), matching
    // every other waiting-state label in the codebase (e.g. ActionPanel's actingSideLabel).
    const sideLabel = decidingTeam === attackingTeam ? 'Attacking' : 'Defending';
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Dive at Feet?</span>
          <span
            className={styles.helperLine2}
          >{`${sideLabel} team is deciding whether to dive…`}</span>
        </div>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      </div>
    );
  }

  const carrierPiece = pieces.find((p) => p.id === gkDiveAtFeetCarrierId);
  const carrierName =
    carrierPiece !== undefined
      ? carrierPiece.lastName
        ? `${carrierPiece.firstName} ${carrierPiece.lastName}`
        : carrierPiece.firstName
      : (gkDiveAtFeetCarrierId ?? '');

  // GKDIVE-02: surface the -1 dice penalty band before the manager commits — only applies
  // at distance === 3 (the outer edge of dive range).
  const distanceQualifier = gkDiveAtFeetDistance === 3 ? ' (−1 dice penalty at this range)' : '';

  return (
    <div className={styles.panel}>
      <div className={styles.helperBlock}>
        <span className={styles.helperLine1}>Dive at Feet?</span>
        <span
          className={styles.helperLine2}
        >{`${carrierName} is within range — dive to win the ball back?${distanceQualifier}`}</span>
      </div>
      <button className={styles.ctaButton} onClick={() => emitGkDiveAtFeet(true)}>
        Dive
      </button>
      <button className={styles.ctaButton} onClick={() => emitGkDiveAtFeet(false)}>
        Decline
      </button>
      {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
    </div>
  );
}
