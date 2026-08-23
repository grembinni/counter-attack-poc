import { useGameStore } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';
import styles from './TackleStealPromptPanel.module.css';

/**
 * TACKLE-02 (Phase 43, Plan 43-05): two-button Attempt/Decline interrupt prompt for
 * `TACKLE_STEAL_PROMPT`, structurally mirroring `GkDiveAtFeetPromptPanel` per D-05. The
 * deciding manager is `tackleStealPromptTeam` (the defending manager, explicitly NOT derived
 * from `attackingTeam` — in a STEAL the decider is deliberately not the active team); the
 * other manager sees a waiting message. Unlike `GkDiveAtFeetPromptPanel`, this phase has no
 * `_TARGET` sub-phase, so there is only ever one branch pair (deciding/waiting).
 * Returns null unless phase is `TACKLE_STEAL_PROMPT` and the reader has a resolved team.
 */
export function TackleStealPromptPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const myTeamOrNull = useMyTeam();
  const pieces = useGameStore((s) => s.gameState.pieces);
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const tackleStealPromptTeam = useGameStore((s) => s.gameState.tackleStealPromptTeam);
  const tackleStealPromptDefenderId = useGameStore((s) => s.gameState.tackleStealPromptDefenderId);
  const tackleStealPromptCarrierId = useGameStore((s) => s.gameState.tackleStealPromptCarrierId);
  const tackleStealPromptQueue = useGameStore((s) => s.gameState.tackleStealPromptQueue);
  const gameError = useGameStore((s) => s.gameError);
  const emitTackleStealChoice = useGameStore((s) => s.emitTackleStealChoice);

  if (phase !== 'TACKLE_STEAL_PROMPT' || myTeamOrNull === null) {
    return null;
  }

  const myTeam = myTeamOrNull;
  const decidingTeam = tackleStealPromptTeam ?? null;
  const humanisedError = restartErrorMessage(gameError);

  if (myTeam !== decidingTeam) {
    // Described relative to the reader (attacking/defending), matching every other
    // waiting-state label in the codebase (e.g. ActionPanel's actingSideLabel).
    const sideLabel = decidingTeam === attackingTeam ? 'Attacking' : 'Defending';
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Challenge for the Ball?</span>
          <span
            className={styles.helperLine2}
          >{`${sideLabel} team is deciding whether to challenge…`}</span>
        </div>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      </div>
    );
  }

  const defenderPiece = pieces.find((p) => p.id === tackleStealPromptDefenderId);
  const defenderName =
    defenderPiece !== undefined
      ? defenderPiece.lastName
        ? `${defenderPiece.firstName} ${defenderPiece.lastName}`
        : defenderPiece.firstName
      : (tackleStealPromptDefenderId ?? '');

  const carrierPiece = pieces.find((p) => p.id === tackleStealPromptCarrierId);
  const carrierName =
    carrierPiece !== undefined
      ? carrierPiece.lastName
        ? `${carrierPiece.firstName} ${carrierPiece.lastName}`
        : carrierPiece.firstName
      : (tackleStealPromptCarrierId ?? '');

  const queueLength = tackleStealPromptQueue?.length ?? 0;
  const queueQualifier =
    queueLength === 0
      ? ''
      : queueLength === 1
        ? ' (1 more defender can challenge after this)'
        : ` (${queueLength} more defenders can challenge after this)`;

  return (
    <div className={styles.panel}>
      <div className={styles.helperBlock}>
        <span className={styles.helperLine1}>Challenge for the Ball?</span>
        <span
          className={styles.helperLine2}
        >{`${defenderName} can challenge ${carrierName} for the ball — attempt it?${queueQualifier}`}</span>
      </div>
      <button className={styles.ctaButton} onClick={() => emitTackleStealChoice(true)}>
        Attempt
      </button>
      <button className={styles.ctaButton} onClick={() => emitTackleStealChoice(false)}>
        Decline
      </button>
      {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
    </div>
  );
}
