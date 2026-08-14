import { useGameStore } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';
import styles from './GkBoxEntryPromptPanel.module.css';

/**
 * D-10/D-11: two-button Reposition/Decline prompt (`GK_BOX_ENTRY_PROMPT`) plus a buttonless
 * board-click constraint panel (`GK_BOX_ENTRY_MOVE`) for the box-entry goalkeeper response.
 * The prompt phase is structurally identical to `FoulChoicePanel`/`GkDiveAtFeetPromptPanel`.
 * The deciding manager is `gkBoxEntryTeam` (the GK's team); the other manager sees a waiting
 * message. `GK_BOX_ENTRY_MOVE` renders zero buttons — the board click is the input, wired in
 * a later plan (Plan 39-05's store already gates selection to the responding team's GK).
 * Returns null outside these two phases, or when the reader has no resolved team.
 */
export function GkBoxEntryPromptPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const myTeamOrNull = useMyTeam();
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const gkBoxEntryTeam = useGameStore((s) => s.gameState.gkBoxEntryTeam);
  const gameError = useGameStore((s) => s.gameError);
  const emitGkBoxEntryResponse = useGameStore((s) => s.emitGkBoxEntryResponse);

  if ((phase !== 'GK_BOX_ENTRY_PROMPT' && phase !== 'GK_BOX_ENTRY_MOVE') || myTeamOrNull === null) {
    return null;
  }

  const myTeam = myTeamOrNull;
  const decidingTeam = gkBoxEntryTeam ?? null;
  const humanisedError = restartErrorMessage(gameError);
  // The GK's team decides/acts; described relative to the reader (attacking/defending),
  // matching every other waiting-state label in the codebase (e.g. ActionPanel's
  // actingSideLabel).
  const sideLabel = decidingTeam === attackingTeam ? 'Attacking' : 'Defending';

  if (phase === 'GK_BOX_ENTRY_MOVE') {
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Goalkeeper Reposition?</span>
          <span className={styles.helperLine2}>
            {myTeam === decidingTeam
              ? 'Select an adjacent hex for your goalkeeper.'
              : `${sideLabel} team is repositioning…`}
          </span>
        </div>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      </div>
    );
  }

  if (myTeam !== decidingTeam) {
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Goalkeeper Reposition?</span>
          <span
            className={styles.helperLine2}
          >{`${sideLabel} team is deciding whether to reposition…`}</span>
        </div>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.helperBlock}>
        <span className={styles.helperLine1}>Goalkeeper Reposition?</span>
        <span className={styles.helperLine2}>
          The ball has entered the box — reposition your goalkeeper 1 hex?
        </span>
      </div>
      <button className={styles.ctaButton} onClick={() => emitGkBoxEntryResponse(true)}>
        Reposition
      </button>
      <button className={styles.ctaButton} onClick={() => emitGkBoxEntryResponse(false)}>
        Decline
      </button>
      {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
    </div>
  );
}
