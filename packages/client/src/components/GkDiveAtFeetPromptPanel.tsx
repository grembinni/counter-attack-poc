import { useGameStore } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';
import styles from './GkDiveAtFeetPromptPanel.module.css';

/**
 * GKDIVE-02/D-07: two-button Dive/Decline interrupt prompt (`GK_DIVE_AT_FEET_PROMPT`) plus a
 * buttonless board-click destination step (`GK_DIVE_AT_FEET_TARGET`, 39-UAT gap 3, Plan 39-21)
 * for the dive-at-feet GK response. Structurally mirrors `GkBoxEntryPromptPanel`'s two-phase
 * span: `GK_DIVE_AT_FEET_PROMPT` is structurally identical to `FoulChoicePanel`; the deciding
 * manager is `gkDiveAtFeetTeam` (the GK's team) in both phases, the other manager sees a
 * waiting message. `GK_DIVE_AT_FEET_TARGET` renders zero buttons — the destination hex is
 * chosen on the board (HexGrid, wired in this same plan).
 * GKDIVE-02: the distance qualifier surfaces the -1 dice penalty band (distance === 3) before
 * the manager commits — the penalty band stays keyed on the GK-to-carrier distance recorded at
 * offer time in both phases (Plan 39-20 deliberately kept this basis; it is not re-derived from
 * the manager's eventual hex choice).
 * Returns null unless phase is one of the two above and the reader has a resolved team.
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

  if (
    (phase !== 'GK_DIVE_AT_FEET_PROMPT' && phase !== 'GK_DIVE_AT_FEET_TARGET') ||
    myTeamOrNull === null
  ) {
    return null;
  }

  const myTeam = myTeamOrNull;
  const decidingTeam = gkDiveAtFeetTeam ?? null;
  const humanisedError = restartErrorMessage(gameError);

  if (phase === 'GK_DIVE_AT_FEET_TARGET') {
    // Described relative to the reader (attacking/defending), matching every other
    // waiting-state label in the codebase (e.g. ActionPanel's actingSideLabel).
    const sideLabel = decidingTeam === attackingTeam ? 'Attacking' : 'Defending';
    // GKDIVE-02: same distance-penalty basis as the prompt phase below — recorded at offer
    // time, not re-based on the manager's eventual hex choice (see file-level doc comment).
    const distanceQualifier = gkDiveAtFeetDistance === 3 ? ' (−1 dice penalty at this range)' : '';

    if (myTeam !== decidingTeam) {
      return (
        <div className={styles.panel}>
          <div className={styles.helperBlock}>
            <span className={styles.helperLine1}>Dive at Feet</span>
            <span
              className={styles.helperLine2}
            >{`${sideLabel} team is choosing where their goalkeeper dives…`}</span>
          </div>
          {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
        </div>
      );
    }

    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Dive at Feet</span>
          <span
            className={styles.helperLine2}
          >{`Click a highlighted hex next to the carrier to send your goalkeeper there.${distanceQualifier}`}</span>
        </div>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      </div>
    );
  }

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
