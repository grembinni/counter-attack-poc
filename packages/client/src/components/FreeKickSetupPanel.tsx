import { useGameStore } from '../store/useGameStore.js';
import { hexDistance, FREE_KICK_STAGES, freeKickStageTeam } from '@counter-attack/shared';
import styles from './FreeKickSetupPanel.module.css';

/**
 * Offside free-kick setup sidebar panel — shown to BOTH players during FREE_KICK_SETUP
 * phase (OFFSIDE-02, D-49 rulebook-correction rework). Reworked from the original
 * simultaneous-both-teams-then-dual-Ready model into a staged, alternating, turn-gated
 * UI: only the CURRENTLY-active stage's team sees the End-Turn-style "End Stage" button
 * and constraint rows; the inactive team sees a waiting message (mirrors ActionPanel's
 * `!isActivePlayer` waiting-panel pattern). Returns null when phase !== 'FREE_KICK_SETUP'.
 *
 * Sequence (D-49): stage 0 kicking<=5 -> stage 1 defending<=5 -> stage 2 kicking<=3
 * (kicking team's LAST turn — D-51 kicker-hex check) -> stage 3 defending<=2 (D-50
 * 2-hex check) -> kick taken.
 */
export function FreeKickSetupPanel() {
  const phase = useGameStore((s) => s.gameState.phase);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const pieces = useGameStore((s) => s.gameState.pieces);
  const freeKickHex = useGameStore((s) => s.gameState.freeKickHex);
  const freeKickAttackingTeam = useGameStore((s) => s.gameState.freeKickAttackingTeam);
  const freeKickStageIndex = useGameStore((s) => s.gameState.freeKickStageIndex);
  const freeKickPlacedPieceIds = useGameStore((s) => s.gameState.freeKickPlacedPieceIds);
  const gameError = useGameStore((s) => s.gameError);
  const emitFreeKickReady = useGameStore((s) => s.emitFreeKickReady);

  // Return null unless in FREE_KICK_SETUP phase with a fully-initialized stage.
  if (
    phase !== 'FREE_KICK_SETUP' ||
    freeKickHex === null ||
    freeKickHex === undefined ||
    freeKickAttackingTeam === null ||
    freeKickAttackingTeam === undefined ||
    freeKickStageIndex === null ||
    freeKickStageIndex === undefined
  ) {
    return null;
  }

  // Derive this player's team and the CURRENTLY-active stage's team.
  const myTeam: 'home' | 'away' = playerSlot === 1 ? 'home' : 'away';
  const activeStageTeam = freeKickStageTeam(freeKickStageIndex, freeKickAttackingTeam);
  const isMyStage = myTeam === activeStageTeam;
  const stage = FREE_KICK_STAGES[freeKickStageIndex];
  const isKicking = stage.side === 'kicking';
  const placedCount = (freeKickPlacedPieceIds ?? []).length;
  const remaining = Math.max(0, stage.max - placedCount);

  // Inactive team: waiting message only — it isn't their turn (mirrors ActionPanel's
  // !isActivePlayer waiting-panel pattern).
  if (!isMyStage) {
    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Offside — Free Kick</span>
        <span className={styles.constraintRow}>
          {isKicking ? 'Attacking' : 'Defending'} team is repositioning&hellip;
        </span>
      </div>
    );
  }

  // My pieces — used for the D-50/D-51 constraint preview rows.
  const myPieces = pieces.filter((p) => p.teamId === myTeam);

  // D-51 (kicking team's LAST turn only — stage index 2): exactly one of my pieces
  // must be on freeKickHex.
  const onFreeKickHexCount = myPieces.filter(
    (p) => p.position.q === freeKickHex.q && p.position.r === freeKickHex.r,
  ).length;
  const checksKickerHex = isKicking && freeKickStageIndex === 2;
  const kickerHexValid = checksKickerHex ? onFreeKickHexCount === 1 : true;

  // D-50 (defending team's stages — index 1 and 3): no piece within 2 hexes of freeKickHex.
  const tooCloseCount = !isKicking
    ? myPieces.filter((p) => hexDistance(p.position, freeKickHex) <= 2).length
    : 0;
  const defenderZoneValid = !isKicking ? tooCloseCount === 0 : true;

  const constraintsMet = kickerHexValid && defenderZoneValid;

  const disabledTitle = checksKickerHex
    ? 'Place exactly one player on the free-kick hex before ending your last turn'
    : !isKicking
      ? 'Move all players at least 3 hexes from the free-kick hex'
      : undefined;

  const stageLabel = isKicking ? 'Attacking team' : 'Defending team';
  const endButtonLabel = freeKickStageIndex === 3 ? 'Take Kick' : 'End Turn';

  return (
    <div className={styles.panel}>
      <span className={styles.panelHeading}>Offside — Free Kick</span>

      <span className={styles.constraintRow}>
        {stageLabel}: place up to {stage.max} players ({placedCount} used, {remaining} remaining).
      </span>

      <span className={styles.constraintRow}>
        Reposition players, then press {endButtonLabel}. Placements are optional — you may end your
        turn having placed none, some, or all of your allowance.
      </span>

      {checksKickerHex && (
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

      <button
        className={styles.ctaButton}
        disabled={!constraintsMet}
        title={!constraintsMet ? disabledTitle : undefined}
        onClick={emitFreeKickReady}
      >
        {endButtonLabel}
      </button>
    </div>
  );
}
