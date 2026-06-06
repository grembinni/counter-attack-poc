import { useState } from 'react';
import { ELIGIBLE_NEXT_ACTIONS, isInRegion } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import styles from './ActionPanel.module.css';

type PassType = 'STANDARD' | 'FIRST_TIME' | 'HIGH' | 'LONG';

const DICE_PHASES = new Set(['PASS', 'SHOT', 'HEADER', 'LOOSE_BALL'] as const);

/**
 * Phase-gated, active-player-gated action controls.
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
  const gameError = useGameStore((s) => s.gameError);
  const emitRoll = useGameStore((s) => s.emitRoll);
  const emitEndTurn = useGameStore((s) => s.emitEndTurn);
  const emitUndo = useGameStore((s) => s.emitUndo);
  const emitStartMovement = useGameStore((s) => s.emitStartMovement);
  const emitGKRestart = useGameStore((s) => s.emitGKRestart);
  const emitSnapshot = useGameStore((s) => s.emitSnapshot);
  const emitHeader = useGameStore((s) => s.emitHeader);

  const [passType, setPassType] = useState<PassType>('STANDARD');

  const myTeam: 'home' | 'away' | null =
    playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
  const isActivePlayer = myTeam !== null && myTeam === activeTeam;

  if (!isActivePlayer) return null;

  // Eligibility-based button disabling (T-08-18): reflect server's ELIGIBLE_NEXT_ACTIONS table.
  // This is UX ONLY — the server independently validates and rejects ineligible actions.
  const eligible = lastActionType !== null ? ELIGIBLE_NEXT_ACTIONS[lastActionType] : null;
  const isEligible = (
    action: Parameters<
      (typeof ELIGIBLE_NEXT_ACTIONS)[keyof typeof ELIGIBLE_NEXT_ACTIONS]['has']
    >[0],
  ) => eligible === null || eligible.has(action);

  // GK team derivation — mirrors server controlsGKTeam in gameHandlers.ts
  const gkPiece = pieces.find((p) => p.id === carrierId);
  const gkTeam = gkPiece?.teamId ?? null;
  const isGKTeam = myTeam !== null && myTeam === gkTeam;

  // Snapshot button visibility — mirrors applySnapshot SNAP-01 trigger (T-08-24).
  // Client guard is permissive UX reflection only; server re-validates and rejects ineligible snapshots.
  const carrier = pieces.find((p) => p.id === carrierId);
  const penaltyRegion = attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';
  const movementTrigger =
    phase === 'MOVEMENT' && carrier !== undefined && isInRegion(carrier.position, penaltyRegion);
  const passTrigger = phase === 'PASS' && lastActionType !== null;
  const canSnapshot = movementTrigger || passTrigger;

  return (
    <div className={styles.panel}>
      {/* PassTypeSelector — rendered during PASS phase above Roll button */}
      {phase === 'PASS' && (
        <>
          <span className={styles.passTypeLabel}>Pass Type</span>
          <div className={styles.passTypeGroup}>
            {(['STANDARD', 'FIRST_TIME', 'HIGH', 'LONG'] as PassType[]).map((pt) => (
              <button
                key={pt}
                className={
                  passType === pt
                    ? `${styles.passTypeButton} ${styles.passTypeButtonSelected}`
                    : styles.passTypeButton
                }
                onClick={() => setPassType(pt)}
              >
                {pt === 'STANDARD'
                  ? 'Standard'
                  : pt === 'FIRST_TIME'
                    ? 'First-time'
                    : pt === 'HIGH'
                      ? 'High'
                      : 'Long'}
              </button>
            ))}
          </div>
          {/* Phase 8 extension point: passType is UI-only in Phase 7; game:roll resolves accuracy from dice only */}
        </>
      )}

      {/* Roll Dice — PASS / SHOT / HEADER / LOOSE_BALL */}
      {DICE_PHASES.has(phase as typeof DICE_PHASES extends Set<infer T> ? T : never) && (
        <button className={styles.ctaButton} onClick={emitRoll}>
          Roll Dice
        </button>
      )}

      {/* Snapshot — visible when SNAP-01 trigger conditions are met (ball carrier in opponent penalty
          area during MOVEMENT, or post-pass in PASS phase). Client guard is UX only; server re-validates. */}
      {canSnapshot && (
        <button className={styles.ctaButton} onClick={emitSnapshot}>
          Snapshot
        </button>
      )}

      {/* Header — HEADER phase; always enabled when visible (phase gating is the guard) */}
      {phase === 'HEADER' && (
        <button className={styles.ctaButton} onClick={emitHeader}>
          Header
        </button>
      )}

      {/* Move — available from KICK_OFF or PASS when movement is eligible.
          This is the single entry point for all movement (kick-off, repeat, post-steal). */}
      {(phase === 'KICK_OFF' || phase === 'PASS') && isEligible('MOVEMENT') && (
        <button
          className={styles.ctaButton}
          title={
            !isEligible('MOVEMENT')
              ? 'Not available after a High Pass — must head the ball'
              : undefined
          }
          onClick={emitStartMovement}
        >
          Move
        </button>
      )}

      {/* Undo — MOVEMENT only, disabled after dice rolled (UNDO-01/02) */}
      {phase === 'MOVEMENT' && (
        <button className={styles.ctaButton} disabled={!!lastDiceRoll} onClick={emitUndo}>
          Undo
        </button>
      )}

      {/* End Slot — advance to next slot or end movement phase */}
      {phase === 'MOVEMENT' && (
        <button className={styles.ctaButton} onClick={emitEndTurn}>
          End Slot
        </button>
      )}

      {/* GK restart group — GK_RESTART phase for the GK's team only */}
      {phase === 'GK_RESTART' && isGKTeam && (
        <>
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
        </>
      )}

      {/* Game error display — auto-clears when next game:state arrives via App.tsx */}
      {gameError && <span className={styles.errorText}>{gameError}</span>}
    </div>
  );
}
