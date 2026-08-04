import { useGameStore } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { ctaColorClass } from '../utils/ctaColorClass.js';
import styles from './ThrowInSetupPanel.module.css';

/**
 * Throw-in setup sidebar panel — shown to BOTH players during THROW_IN_SETUP (THROWIN-02).
 * Adopts Phase 35's locked conventions in full (D-07): `.panel` with no `border` rule, the
 * single-CTA verb lock, and the verbatim waiting-state phrasing (see the inactive-team
 * branch below). Unlike `FreeKickSetupPanel`, placement is the only action here and it
 * completes the phase — so there is no confirm-dialog overlay (no "N players left" concept
 * for a single-piece placement).
 *
 * Returns null when phase !== 'THROW_IN_SETUP', when throwInHex/throwInTeam are null/undefined,
 * or when the viewer's team cannot be determined.
 */
export function ThrowInSetupPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const throwInHex = useGameStore((s) => s.gameState.throwInHex);
  const throwInTeam = useGameStore((s) => s.gameState.throwInTeam);
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const pieces = useGameStore((s) => s.gameState.pieces);
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const gameError = useGameStore((s) => s.gameError);
  const emitThrowInPlace = useGameStore((s) => s.emitThrowInPlace);
  const myTeamOrNull = useMyTeam();

  // D-04/Pitfall 4 (mirrors FreeKickSetupPanel): myTeamOrNull === null is an explicit guard,
  // never a silently-coerced default team.
  if (
    phase !== 'THROW_IN_SETUP' ||
    throwInHex === null ||
    throwInHex === undefined ||
    throwInTeam === null ||
    throwInTeam === undefined ||
    myTeamOrNull === null
  ) {
    return null;
  }

  // Narrowed to 'home' | 'away' by the guard above.
  const myTeam = myTeamOrNull;
  const isMyThrow = myTeam === throwInTeam;

  // WR-01: the previous `{isMyThrow ? 'Attacking' : 'Defending'}` ternary was dead —
  // this branch is only reachable when `isMyThrow` is `false`, so it always rendered
  // 'Defending'. The acting side is a property of the _state_ (who is taking the
  // throw), never of the _viewer_. This mirrors ActionPanel.tsx's equivalent
  // acting-side label derivation (which compares `activeTeam` to `attackingTeam`);
  // comparing `throwInTeam` here is the throw-in-specific equivalent, since
  // `triggerOutOfBoundsRestart` sets `activeTeam === attackingTeam === throwInTeam`.
  const actingSideLabel: 'Attacking' | 'Defending' =
    throwInTeam === attackingTeam ? 'Attacking' : 'Defending';

  // Inactive team: waiting message only — mirrors FreeKickSetupPanel's !isMyStage branch.
  if (!isMyThrow) {
    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Throw-In</span>
        <span className={styles.constraintRow}>
          {actingSideLabel} team is repositioning&hellip;
        </span>
      </div>
    );
  }

  const selectedPiece = pieces.find((p) => p.id === selectedPieceId && p.teamId === myTeam) ?? null;

  const confirmColorClass = ctaColorClass(
    selectedPiece ? 0 : 1,
    { ready: styles.ctaButtonReady, pending: styles.ctaButtonPending },
    true,
  );

  return (
    <div className={styles.panel}>
      <span className={styles.panelHeading}>Throw-In</span>

      <span className={styles.constraintRow}>Throw-In!</span>
      <span className={styles.constraintRow}>Select a player to take the throw.</span>

      <span className={styles.constraintRow}>
        {selectedPiece
          ? `Thrower: #${selectedPiece.number} ${selectedPiece.firstName} ${selectedPiece.lastName}`
          : 'No player selected.'}
      </span>

      {gameError && <span className={styles.errorText}>{gameError}</span>}

      <button
        className={`${styles.ctaButton} ${confirmColorClass}`}
        disabled={selectedPiece === null}
        title={selectedPiece === null ? 'Select one of your players to take the throw' : undefined}
        onClick={() => selectedPiece && emitThrowInPlace(selectedPiece.id)}
      >
        Confirm
      </button>
    </div>
  );
}
