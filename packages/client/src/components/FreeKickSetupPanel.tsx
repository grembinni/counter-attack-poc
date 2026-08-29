import { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import {
  hexDistance,
  FREE_KICK_STAGES,
  freeKickStageTeam,
  isActivePiece,
} from '@counter-attack/shared';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { ctaColorClass } from '../utils/ctaColorClass.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';
import styles from './FreeKickSetupPanel.module.css';

/**
 * Free-kick setup sidebar panel — shown to BOTH players during FREE_KICK_SETUP phase
 * (OFFSIDE-02, D-49 rulebook-correction rework). Covers BOTH trigger sources: offside
 * (triggerOffsideFoul) and foul-awarded restarts (triggerFoulFreeKick, Phase 39, e.g.
 * tackle-from-behind) — the panel heading is intentionally generic ("Free Kick", not
 * "Offside — Free Kick") since GameState carries no field distinguishing which trigger
 * fired (see debug session free-kick-title-wrong-tackle.md). Reworked from the original
 * simultaneous-both-teams-then-dual-Ready model into a staged, alternating, turn-gated
 * UI: only the CURRENTLY-active stage's team sees the End-Turn-style "End Stage" button
 * and constraint rows; the inactive team sees a waiting message (mirrors ActionPanel's
 * `!isActivePlayer` waiting-panel pattern). Returns null when phase !== 'FREE_KICK_SETUP'.
 *
 * Sequence (D-49/D-54): stage 0 kicking<=5 (MANDATORY kicker-first placement, D-54 —
 * supersedes D-51's old stage-2-end check) -> stage 1 defending<=5 -> stage 2 kicking<=3
 * -> stage 3 defending<=2 (D-50 2-hex check) -> kick taken.
 */
export function FreeKickSetupPanel() {
  const [pendingEndTurn, setPendingEndTurn] = useState<null | {
    action: () => void;
    count: number;
  }>(null);
  const phase = useGameStore((s) => s.gameState.phase);
  const myTeamOrNull = useMyTeam();
  const pieces = useGameStore((s) => s.gameState.pieces);
  const freeKickHex = useGameStore((s) => s.gameState.freeKickHex);
  const freeKickAttackingTeam = useGameStore((s) => s.gameState.freeKickAttackingTeam);
  const freeKickStageIndex = useGameStore((s) => s.gameState.freeKickStageIndex);
  const freeKickPlacedPieceIds = useGameStore((s) => s.gameState.freeKickPlacedPieceIds);
  // D-54: the kicker locks into movedPieceIds the instant it lands on freeKickHex.
  const movedPieceIds = useGameStore((s) => s.gameState.movedPieceIds);
  const freeKickKickerChosen = useGameStore((s) => s.gameState.freeKickKickerChosen);
  const eventLog = useGameStore((s) => s.gameState.eventLog);
  const lastDiceRoll = useGameStore((s) => s.gameState.lastDiceRoll);
  const gameError = useGameStore((s) => s.gameError);
  const emitFreeKickReady = useGameStore((s) => s.emitFreeKickReady);
  const emitUndo = useGameStore((s) => s.emitUndo);

  // Return null unless in FREE_KICK_SETUP phase with a fully-initialized stage.
  // D-04/Pitfall 4: myTeamOrNull === null is included here as an explicit guard, not a
  // silent `?? 'away'` coercion. A3 verified (not assumed): App.tsx's onRoomJoined sets
  // playerSlot before onGameState ever transitions screen to 'GAME_BOARD' (a GAME_STATE
  // broadcast requires the room to already have both player slots joined) — this panel
  // only renders inside GameBoard, so playerSlot (and therefore myTeamOrNull) is always
  // non-null in real gameplay. This guard is defense-in-depth for that invariant.
  if (
    phase !== 'FREE_KICK_SETUP' ||
    freeKickHex === null ||
    freeKickHex === undefined ||
    freeKickAttackingTeam === null ||
    freeKickAttackingTeam === undefined ||
    freeKickStageIndex === null ||
    freeKickStageIndex === undefined ||
    myTeamOrNull === null
  ) {
    return null;
  }

  // Narrowed to 'home' | 'away' by the guard above.
  const myTeam = myTeamOrNull;

  // D-16-01/T-37-71/T-37-72: derived once so gameError is never rendered as a raw server
  // wire code (mirrors ThrowInSetupPanel/GoalKickSetupPanel).
  const humanisedError = restartErrorMessage(gameError);
  const activeStageTeam = freeKickStageTeam(freeKickStageIndex, freeKickAttackingTeam);
  const isMyStage = myTeam === activeStageTeam;
  const stage = FREE_KICK_STAGES[freeKickStageIndex];
  const isKicking = stage.side === 'kicking';
  const placedCount = (freeKickPlacedPieceIds ?? []).length;
  // True only during the kicker-select sub-step: kicking stage where kicker hasn't been placed yet.
  const isKickerSelectionPhase = freeKickKickerChosen === false && isKicking;

  // Inactive team: waiting message only — it isn't their turn (mirrors ActionPanel's
  // !isActivePlayer waiting-panel pattern).
  if (!isMyStage) {
    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Free Kick</span>
        <span className={styles.constraintRow}>
          {isKicking ? 'Attacking' : 'Defending'} team is repositioning&hellip;
        </span>
      </div>
    );
  }

  // My pieces — used for the D-50/D-54 constraint preview rows.
  // Deviation (checkpoint 45-05-04 fix, developer-reported blocking bug): filtered
  // through the shared BUG-38 `isActivePiece` predicate — a red-carded/sent-off
  // piece keeps a live on-pitch `position` (server-authoritative-correct check at
  // gameEngine.ts already excludes it via isActivePiece), but this client-side
  // panel independently recomputed the same "too close" constraint from raw
  // `pieces` without the same exclusion, producing a false-positive
  // "Defending zone: N player(s) too close" block that disabled Confirm even
  // when the server would have accepted ending the turn.
  const myPieces = pieces.filter((p) => p.teamId === myTeam && isActivePiece(p));

  // D-54 (supersedes D-51): mandatory kicker-first placement — checked on EVERY kicking
  // stage (0 and 2), not just the old stage-2-only D-51 end-of-stage check. The kicker is
  // permanently locked into movedPieceIds the instant it lands on freeKickHex (server-side,
  // applyFreeKickMove), so "kicker placed" is simply "any of my pieces is already locked."
  // Once locked, this constraint stays satisfied for the rest of free-kick setup — it is
  // never re-checked against current piece position, since the kicker can never move again.
  const kickerLocked = isKicking && myPieces.some((p) => movedPieceIds.includes(p.id));
  const checksKickerPlacement = isKicking;
  const kickerConstraintValid = checksKickerPlacement ? kickerLocked : true;

  // D-50 (defending team's stages — index 1 and 3): no piece within 2 hexes of freeKickHex.
  const tooCloseCount = !isKicking
    ? myPieces.filter((p) => hexDistance(p.position, freeKickHex) <= 2).length
    : 0;
  const defenderZoneValid = !isKicking ? tooCloseCount === 0 : true;

  const constraintsMet = kickerConstraintValid && defenderZoneValid;

  const disabledTitle =
    checksKickerPlacement && !kickerLocked
      ? 'Move one of your players onto the free-kick hex before ending your turn'
      : !isKicking
        ? 'Move all players at least 3 hexes from the free-kick hex'
        : undefined;

  const stageLabel = isKicking ? 'Attacking team' : 'Defending team';

  // Next-stage preview text shown at the bottom of the panel.
  const nextStageIdx = freeKickStageIndex + 1;
  const nextStage = nextStageIdx < FREE_KICK_STAGES.length ? FREE_KICK_STAGES[nextStageIdx] : null;
  const nextActionText = nextStage
    ? `Next: ${nextStage.side === 'kicking' ? 'Attacking' : 'Defending'} team will move up to ${nextStage.max} players.`
    : 'Next: Free kick will be taken.';

  const remaining = Math.max(stage.max - placedCount, 0);

  const withEndTurnConfirm = (eligibleRemaining: number, action: () => void): (() => void) => {
    return () => {
      if (eligibleRemaining > 0) {
        setPendingEndTurn({ action, count: eligibleRemaining });
      } else {
        action();
      }
    };
  };

  const confirmDialog =
    pendingEndTurn !== null ? (
      <div className={styles.confirmOverlay}>
        <div className={styles.confirmCard}>
          <p className={styles.confirmText}>
            {pendingEndTurn.count} players left to reposition, are you sure you want to end your
            turn?
          </p>
          <div className={styles.confirmActions}>
            <button className={styles.ctaButton} onClick={() => setPendingEndTurn(null)}>
              Cancel
            </button>
            <button
              className={`${styles.ctaButton} ${styles.ctaButtonReady ?? ''}`}
              onClick={() => {
                pendingEndTurn.action();
                setPendingEndTurn(null);
              }}
            >
              Yes, end turn
            </button>
          </div>
        </div>
      </div>
    ) : null;

  // Undo: enabled when at least one FK_SETUP_MOVE exists after the last FK boundary in the log.
  const canUndo = (() => {
    if (lastDiceRoll) return false;
    if ((freeKickPlacedPieceIds ?? []).length === 0 && !freeKickKickerChosen) return false;
    const lastBoundaryIdx = eventLog.reduce<number>((acc, evt, idx) => {
      const isBoundary = evt.type === 'FK_KICKER_CHOSEN' || evt.type === 'FK_STAGE_ADVANCE';
      return isBoundary ? idx : acc;
    }, -1);
    return eventLog.slice(lastBoundaryIdx + 1).some((e) => e.type === 'FK_SETUP_MOVE');
  })();

  // Confirm button color: pending while placements remain, ready when all used.
  // D-06: single shared color-state implementation (see ctaColorClass.ts) — constraintsMet
  // is passed as `enabled` so a constraint-blocked button shows neither color, exactly
  // reproducing the prior local ternary's `: ''` branch.
  const endTurnColorClass = ctaColorClass(
    remaining,
    { ready: styles.ctaButtonReady, pending: styles.ctaButtonPending },
    constraintsMet,
  );

  return (
    <div className={styles.panel}>
      <span className={styles.panelHeading}>Free Kick</span>

      {!isKickerSelectionPhase && (
        <span className={styles.constraintRow}>
          {stageLabel}: {placedCount} of {stage.max} placed.
        </span>
      )}

      {checksKickerPlacement && !kickerLocked && (
        <span className={styles.constraintRow} style={{ color: 'var(--color-danger)' }}>
          Kicker: move a player onto the free-kick hex first — required before any other move
        </span>
      )}

      {!isKicking && !defenderZoneValid && (
        <span className={styles.constraintRow} style={{ color: 'var(--color-danger)' }}>
          {`Defending zone: ${tooCloseCount} player(s) too close`}
        </span>
      )}

      {!isKickerSelectionPhase && <span className={styles.constraintRow}>{nextActionText}</span>}

      {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}

      {!isKickerSelectionPhase && (
        <button className={styles.ctaButton} disabled={!canUndo} onClick={emitUndo}>
          Undo
        </button>
      )}

      {!isKickerSelectionPhase && (
        <button
          className={`${styles.ctaButton} ${endTurnColorClass}`}
          disabled={!constraintsMet}
          title={!constraintsMet ? disabledTitle : undefined}
          onClick={withEndTurnConfirm(remaining, emitFreeKickReady)}
        >
          Confirm
        </button>
      )}

      {confirmDialog}
    </div>
  );
}
