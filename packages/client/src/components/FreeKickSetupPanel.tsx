import { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { hexDistance } from '@counter-attack/shared';
import styles from './FreeKickSetupPanel.module.css';

/**
 * Offside free-kick setup sidebar panel — shown to BOTH players during FREE_KICK_SETUP
 * phase (OFFSIDE-02 D-29). Both players reposition their entire squad anywhere on the
 * board and must click Ready to confirm placement (D-30/D-31). Returns null when
 * phase !== 'FREE_KICK_SETUP' (no isActivePlayer gate — both slots act).
 *
 * Mirrors KickOffSetupPanel's structure, with the free-kick zone rules (D-30/D-31)
 * substituted for the kick-off own-half rule — D-29 explicitly has no own-half
 * restriction, so there is no zone-out-of-bounds constraint row here.
 */
export function FreeKickSetupPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const pieces = useGameStore((s) => s.gameState.pieces);
  const freeKickHex = useGameStore((s) => s.gameState.freeKickHex);
  const freeKickAttackingTeam = useGameStore((s) => s.gameState.freeKickAttackingTeam);
  const gameError = useGameStore((s) => s.gameError);
  const emitFreeKickReady = useGameStore((s) => s.emitFreeKickReady);

  // Local state: has this player already clicked Ready? (shows "Waiting for opponent…")
  const [localReady, setLocalReady] = useState(false);

  // Return null unless in FREE_KICK_SETUP phase
  if (phase !== 'FREE_KICK_SETUP' || freeKickHex === null || freeKickHex === undefined) {
    return null;
  }

  // Derive this player's team
  const myTeam: 'home' | 'away' = playerSlot === 1 ? 'home' : 'away';
  const isKicking = myTeam === freeKickAttackingTeam;

  // Filter my pieces
  const myPieces = pieces.filter((p) => p.teamId === myTeam);

  // D-31 (kicking team only): exactly one of my pieces must be on freeKickHex.
  const onFreeKickHexCount = myPieces.filter(
    (p) => p.position.q === freeKickHex.q && p.position.r === freeKickHex.r,
  ).length;
  const kickerHexValid = isKicking ? onFreeKickHexCount === 1 : true;

  // D-30 (defending team only): no piece within 2 hexes of freeKickHex.
  const tooCloseCount = !isKicking
    ? myPieces.filter((p) => hexDistance(p.position, freeKickHex) <= 2).length
    : 0;
  const defenderZoneValid = !isKicking ? tooCloseCount === 0 : true;

  const constraintsMet = kickerHexValid && defenderZoneValid;

  const disabledTitle = isKicking
    ? 'Place exactly one player on the free-kick hex'
    : 'Move all players at least 3 hexes from the free-kick hex';

  function handleReadyClick() {
    setLocalReady(true);
    emitFreeKickReady();
  }

  return (
    <div className={styles.panel}>
      <span className={styles.panelHeading}>Offside — Free Kick</span>

      <span className={styles.constraintRow}>
        Reposition your players, then press Ready.{' '}
        {isKicking
          ? 'Place exactly one player on the free-kick hex.'
          : 'Stay 3+ hexes from the free-kick hex.'}
      </span>

      {isKicking && (
        <span
          className={styles.constraintRow}
          style={{ color: kickerHexValid ? '#a0a0a0' : '#ef4444' }}
        >
          {kickerHexValid
            ? 'Kicker hex: occupied'
            : `Kicker hex: ${onFreeKickHexCount === 0 ? 'EMPTY' : 'MULTIPLE PLAYERS'} — required exactly one`}
        </span>
      )}

      {!isKicking && (
        <span
          className={styles.constraintRow}
          style={{ color: defenderZoneValid ? '#a0a0a0' : '#ef4444' }}
        >
          {defenderZoneValid
            ? 'Defending zone: clear'
            : `Defending zone: ${tooCloseCount} player(s) too close`}
        </span>
      )}

      {/* Server game error — auto-clears on next game:state via App.tsx */}
      {gameError && <span className={styles.errorText}>{gameError}</span>}

      {/* Ready / Waiting button */}
      {localReady ? (
        <button className={styles.ctaButton} disabled>
          Waiting for opponent&hellip;
        </button>
      ) : (
        <button
          className={styles.ctaButton}
          disabled={!constraintsMet}
          title={!constraintsMet ? disabledTitle : undefined}
          onClick={handleReadyClick}
        >
          Ready
        </button>
      )}
    </div>
  );
}
