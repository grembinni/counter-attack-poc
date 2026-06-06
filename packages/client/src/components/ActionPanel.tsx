import { useState, useEffect } from 'react';
import { ELIGIBLE_NEXT_ACTIONS, isInRegion } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import styles from './ActionPanel.module.css';

type PassType = 'STANDARD_PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_BALL';

const PASS_TYPE_LABELS: Record<PassType, string> = {
  STANDARD_PASS: 'Standard Pass',
  FIRST_TIME_PASS: 'First-time Pass',
  HIGH_PASS: 'High Pass',
  LONG_BALL: 'Long Ball',
};

const DICE_PHASES = new Set(['SHOT', 'HEADER', 'LOOSE_BALL'] as const);

/**
 * Phase-gated, active-player-gated action controls.
 *
 * PASS phase uses a two-step choose-phase flow:
 *  1. Show eligible next actions based on ELIGIBLE_NEXT_ACTIONS[lastActionType].
 *  2. After the player selects a pass type, show Roll Dice.
 * Non-pass actions (Move, Shoot) trigger immediately without a roll step.
 *
 * Returns null for the non-active player (UNDO-03).
 */
export function ActionPanel() {
  const playerSlot = useGameStore((s) => s.playerSlot);
  const phase = useGameStore((s) => s.gameState.phase);
  const activeTeam = useGameStore((s) => s.gameState.activeTeam);
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const lastDiceRoll = useGameStore((s) => s.gameState.lastDiceRoll);
  const lastActionType = useGameStore((s) => s.gameState.lastActionType);
  const carrierId = useGameStore((s) => s.gameState.ball.carrierId);
  const pieces = useGameStore((s) => s.gameState.pieces);
  const eventLog = useGameStore((s) => s.gameState.eventLog);
  const gameError = useGameStore((s) => s.gameError);
  const emitRoll = useGameStore((s) => s.emitRoll);
  const emitEndTurn = useGameStore((s) => s.emitEndTurn);
  const emitUndo = useGameStore((s) => s.emitUndo);
  const emitStartMovement = useGameStore((s) => s.emitStartMovement);
  const emitGKRestart = useGameStore((s) => s.emitGKRestart);
  const emitSnapshot = useGameStore((s) => s.emitSnapshot);
  const emitHeader = useGameStore((s) => s.emitHeader);

  // Local state: which pass type the player has selected (step 2 of choose-phase flow).
  // Cleared whenever the game phase changes so each new PASS phase starts at the chooser.
  const [selectedPassType, setSelectedPassType] = useState<PassType | null>(null);
  useEffect(() => {
    setSelectedPassType(null);
  }, [phase]);

  const myTeam: 'home' | 'away' | null =
    playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
  const isActivePlayer = myTeam !== null && myTeam === activeTeam;

  if (!isActivePlayer) return null;

  // GK team derivation — mirrors server controlsGKTeam in gameHandlers.ts
  const gkPiece = pieces.find((p) => p.id === carrierId);
  const gkTeam = gkPiece?.teamId ?? null;
  const isGKTeam = myTeam !== null && myTeam === gkTeam;

  // -------------------------------------------------------------------------
  // KICK_OFF + PASS phase — two-step choose-phase flow
  // KICK_OFF is treated identically to PASS: lastActionType is null → shows
  // MOVEMENT_PHASE eligible actions. "Move" calls emitStartMovement which the
  // server accepts from both KICK_OFF and PASS.
  // -------------------------------------------------------------------------
  if (phase === 'PASS' || phase === 'KICK_OFF') {
    // Eligible next actions based on the last completed action.
    // null lastActionType (kick-off start state) treated as MOVEMENT_PHASE.
    const effectiveLastAction = lastActionType ?? 'MOVEMENT_PHASE';
    const eligible = ELIGIBLE_NEXT_ACTIONS[effectiveLastAction];

    if (selectedPassType === null) {
      // Step 1: show the action chooser
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>Choose action</span>

          {eligible.has('MOVEMENT') && (
            <button className={styles.ctaButton} onClick={emitStartMovement}>
              Move
            </button>
          )}

          {eligible.has('STANDARD_PASS') && (
            <button
              className={styles.ctaButton}
              onClick={() => setSelectedPassType('STANDARD_PASS')}
            >
              Standard Pass
            </button>
          )}

          {eligible.has('FIRST_TIME_PASS') && (
            <button
              className={styles.ctaButton}
              onClick={() => setSelectedPassType('FIRST_TIME_PASS')}
            >
              First-time Pass
            </button>
          )}

          {eligible.has('HIGH_PASS') && (
            <button className={styles.ctaButton} onClick={() => setSelectedPassType('HIGH_PASS')}>
              High Pass
            </button>
          )}

          {eligible.has('LONG_BALL') && (
            <button className={styles.ctaButton} onClick={() => setSelectedPassType('LONG_BALL')}>
              Long Ball
            </button>
          )}

          {(eligible.has('SNAPSHOT') || eligible.has('SHOT')) && (
            <button className={styles.ctaButton} onClick={emitSnapshot}>
              Shoot
            </button>
          )}

          {gameError && <span className={styles.errorText}>{gameError}</span>}
        </div>
      );
    }

    // Step 2: pass type selected — show Roll Dice
    const handleRoll = () => {
      emitRoll(selectedPassType);
      setSelectedPassType(null);
    };

    return (
      <div className={styles.panel}>
        <span className={styles.phaseLabel}>Rolling for {PASS_TYPE_LABELS[selectedPassType]}</span>
        <button className={styles.ctaButton} onClick={handleRoll}>
          Roll Dice
        </button>
        <button className={styles.backButton} onClick={() => setSelectedPassType(null)}>
          ← Back
        </button>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // MOVEMENT phase
  // -------------------------------------------------------------------------
  if (phase === 'MOVEMENT') {
    const carrier = pieces.find((p) => p.id === carrierId);
    const penaltyRegion = attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';
    const canSnapshot = carrier !== undefined && isInRegion(carrier.position, penaltyRegion);

    // Undo is available when there is at least one MOVE event after the last slot boundary
    // (SLOT_ADVANCE or KICK_OFF) and no dice have been rolled. Mirrors applyUndo's boundary logic.
    const canUndo = (() => {
      if (lastDiceRoll) return false;
      const lastBoundaryIdx = eventLog.reduce<number>((acc, evt, idx) => {
        return evt.type === 'SLOT_ADVANCE' || evt.type === 'KICK_OFF' ? idx : acc;
      }, -1);
      return eventLog.slice(lastBoundaryIdx + 1).some((e) => e.type === 'MOVE');
    })();

    return (
      <div className={styles.panel}>
        {canSnapshot && (
          <button className={styles.ctaButton} onClick={emitSnapshot}>
            Snapshot
          </button>
        )}
        <button className={styles.ctaButton} disabled={!canUndo} onClick={emitUndo}>
          Undo
        </button>
        <button className={styles.ctaButton} onClick={emitEndTurn}>
          End Slot
        </button>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // HEADER phase
  // -------------------------------------------------------------------------
  if (phase === 'HEADER') {
    return (
      <div className={styles.panel}>
        <button className={styles.ctaButton} onClick={emitHeader}>
          Header
        </button>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // SHOT / LOOSE_BALL — Roll Dice
  // -------------------------------------------------------------------------
  if (DICE_PHASES.has(phase as 'SHOT' | 'HEADER' | 'LOOSE_BALL')) {
    return (
      <div className={styles.panel}>
        <button className={styles.ctaButton} onClick={() => emitRoll()}>
          Roll Dice
        </button>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // GK_RESTART phase — GK's team chooses restart method
  // -------------------------------------------------------------------------
  if (phase === 'GK_RESTART' && isGKTeam) {
    return (
      <div className={styles.panel}>
        <span className={styles.gkLabel}>GK Restart — choose:</span>
        <button className={styles.ctaButton} onClick={() => emitGKRestart('kick')}>
          Kick (High Pass)
        </button>
        <button className={styles.ctaButton} onClick={() => emitGKRestart('throw')}>
          Quick Throw
        </button>
        <button className={styles.ctaButton} onClick={() => emitGKRestart('movement')}>
          Move
        </button>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // Error display for phases where the player is active but has no action controls
  // (e.g. GK_RESTART for the non-GK team).
  if (gameError) {
    return (
      <div className={styles.panel}>
        <span className={styles.errorText}>{gameError}</span>
      </div>
    );
  }

  return null;
}
