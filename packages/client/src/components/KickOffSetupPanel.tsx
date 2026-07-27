import { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { PITCH_REGIONS, isInRegion } from '@counter-attack/shared';
import { useMyTeam } from '../hooks/useMyTeam.js';
import styles from './KickOffSetupPanel.module.css';

/**
 * Kick-off setup sidebar panel — shown to BOTH players during KICK_OFF_SETUP phase.
 * Both players reposition pieces and must click Confirm to confirm placement (D-23/D-24/D-08).
 * Returns null when phase !== 'KICK_OFF_SETUP' (no isActivePlayer gate — both slots act).
 *
 * UI-SPEC Screen 1: constraint status rows + gated "Confirm" button.
 */
export function KickOffSetupPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const myTeamOrNull = useMyTeam();
  const pieces = useGameStore((s) => s.gameState.pieces);
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const gameError = useGameStore((s) => s.gameError);
  const emitReady = useGameStore((s) => s.emitReady);

  // Local state: has this player already clicked Confirm? (D-09: shows a context-specific
  // waiting message naming what it is waiting for, instead of the generic "Waiting for
  // opponent…" phrase — see the constraintRow rendered below the CTA.)
  const [localReady, setLocalReady] = useState(false);

  // Return null unless in KICK_OFF_SETUP phase.
  // D-04/Pitfall 4: myTeamOrNull === null is included here as an explicit guard, not a
  // silent `?? 'away'` coercion. A3 verified (not assumed): App.tsx's onRoomJoined sets
  // playerSlot before onGameState ever transitions screen to 'GAME_BOARD' (a GAME_STATE
  // broadcast requires the room to already have both player slots joined) — this panel
  // only renders inside GameBoard, so playerSlot (and therefore myTeamOrNull) is always
  // non-null in real gameplay. This guard is defense-in-depth for that invariant.
  if (phase !== 'KICK_OFF_SETUP' || myTeamOrNull === null) return null;

  // Narrowed to 'home' | 'away' by the guard above.
  const myTeam = myTeamOrNull;
  const isAttacking = myTeam === attackingTeam;

  // Filter my pieces
  const myPieces = pieces.filter((p) => p.teamId === myTeam);

  // Constraint 1 (attacking team only): is any of my pieces on the centre hex?
  const kickOffHex = PITCH_REGIONS.kickOffHex;
  const centreHexOccupied = isAttacking
    ? myPieces.some((p) => p.position.q === kickOffHex.q && p.position.r === kickOffHex.r)
    : true; // Defending team has no centre-hex requirement; treat as met

  // Constraint 2: piece zone validation
  // Home attacking: own half q<=18, plus centre circle allowed
  // Home defending: own half q<=18, but NOT inside centre circle
  // Away attacking: own half q>=18, plus centre circle allowed
  // Away defending: own half q>=18, but NOT inside centre circle
  const piecesOutOfZone = myPieces.filter((p) => {
    const hex = p.position;
    if (myTeam === 'home') {
      if (isAttacking) {
        // Attacking home: q<=18 OR inside centre circle (centre circle straddles q=18)
        return hex.q > 18 && !isInRegion(hex, 'centreCircle');
      } else {
        // Defending home: q<=18 AND NOT in centre circle
        return hex.q > 18 || isInRegion(hex, 'centreCircle');
      }
    } else {
      // myTeam === 'away'
      if (isAttacking) {
        // Attacking away: q>=18 OR inside centre circle
        return hex.q < 18 && !isInRegion(hex, 'centreCircle');
      } else {
        // Defending away: q>=18 AND NOT in centre circle
        return hex.q < 18 || isInRegion(hex, 'centreCircle');
      }
    }
  }).length;

  const placementValid = piecesOutOfZone === 0;

  // Ready button is enabled only when all applicable constraints are met
  const constraintsMet = centreHexOccupied && placementValid;

  // Disabled title depends on which constraint(s) are unmet
  const disabledTitle = isAttacking
    ? 'Place a player on the centre hex first'
    : 'Move all players to your own half outside the centre circle';

  const zoneGuidance = isAttacking
    ? 'your half or the centre circle'
    : 'your own half, clear of the centre circle';
  const piecesLabel = `${piecesOutOfZone} player${piecesOutOfZone === 1 ? '' : 's'}`;

  function handleReadyClick() {
    setLocalReady(true);
    emitReady();
  }

  return (
    <div className={styles.panel}>
      <span className={styles.panelHeading}>Kick-Off Setup</span>

      {/* Constraint rows */}
      {isAttacking && (
        <span
          className={styles.constraintRow}
          style={{
            color: centreHexOccupied ? 'var(--color-text-secondary)' : 'var(--color-danger)',
          }}
        >
          {centreHexOccupied
            ? 'A player is on the centre hex — ready to go.'
            : 'Place a player on the centre hex to start the kick-off.'}
        </span>
      )}

      <span
        className={styles.constraintRow}
        style={{ color: placementValid ? 'var(--color-text-secondary)' : 'var(--color-danger)' }}
      >
        {placementValid
          ? 'Setup your players for kickoff.'
          : `${piecesLabel} out of position — move into ${zoneGuidance}.`}
      </span>

      {/* Server game error — auto-clears on next game:state via App.tsx */}
      {gameError && <span className={styles.errorText}>{gameError}</span>}

      {/* D-09: waiting state names what it is waiting for, shown only after this
          player has confirmed their own placement. */}
      {localReady && (
        <span className={styles.constraintRow}>
          Waiting for the opponent to confirm their placement&hellip;
        </span>
      )}

      {/* D-08: confirm-and-advance CTA; disabled/read-only label once clicked */}
      {localReady ? (
        <button className={styles.ctaButton} disabled>
          Confirmed
        </button>
      ) : (
        <button
          className={styles.ctaButton}
          disabled={!constraintsMet}
          title={!constraintsMet ? disabledTitle : undefined}
          onClick={handleReadyClick}
        >
          Confirm
        </button>
      )}
    </div>
  );
}
