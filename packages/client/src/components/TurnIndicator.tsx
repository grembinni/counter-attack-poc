import type { GamePhase, MovementSlot } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import styles from './TurnIndicator.module.css';

/** Phase label mapping per UI-SPEC Turn Indicator Spec table. */
const PHASE_LABEL: Record<GamePhase, string> = {
  LOBBY: '',
  KICK_OFF: 'KICK OFF',
  KICK_OFF_SETUP: 'KICK OFF SETUP', // Phase 8 / UI-SPEC §KICK_OFF_SETUP layout
  MOVEMENT: 'MOVEMENT PHASE',
  PASS: 'PASS PHASE',
  SHOT_DECLARED: 'SHOT DECLARED',
  GK_DIVING: 'GK DIVING',
  SNAP_DEFLECT: 'SNAP DEFLECT',
  SHOT: 'SHOT PHASE',
  HEADER: 'HEADER PHASE',
  SNAPSHOT: 'SNAPSHOT PHASE',
  LOOSE_BALL: 'LOOSE BALL',
  HIGH_PASS_MOVEMENT: 'HIGH PASS — REPOSITION',
  GK_RESTART: 'GK RESTART',
  QUICK_THROW: 'QUICK THROW',
  GK_KICK_TARGET: 'GK KICK — SELECT TARGET',
  GK_KICK_MOVEMENT: 'GK KICK — REPOSITION',
  HALF_TIME: 'HALF TIME',
  FULL_TIME: 'FULL TIME',
  REPLAY: 'REPLAY',
};

/** Total moves allowed per movement slot (UI-SPEC Moves remaining logic). */
const SLOT_TOTAL: Record<MovementSlot, number> = {
  ATTACKER_4: 4,
  DEFENDER_5: 5,
  ATTACKER_2: 2,
};

/**
 * Turn indicator panel: active team name, phase label, score, slot and moves remaining.
 * UI-SPEC §Turn Indicator Spec.
 */
export function TurnIndicator() {
  const phase = useGameStore((s) => s.gameState.phase);
  const activeTeam = useGameStore((s) => s.gameState.activeTeam);
  const score = useGameStore((s) => s.gameState.score);
  const movementSlot = useGameStore((s) => s.gameState.movementSlot);
  const paceUsedByPieceId = useGameStore((s) => s.gameState.paceUsedByPieceId);

  const teamName = activeTeam === 'home' ? 'HOME TEAM' : 'AWAY TEAM';
  const teamColor = activeTeam === 'home' ? '#1a56b0' : '#c0392b';
  const phaseLabel = PHASE_LABEL[phase];

  // paceUsedByPieceId is reset to {} at every slot boundary, so its key count
  // reflects activations in the CURRENT slot only — correct for all three slots.
  const remaining =
    phase === 'MOVEMENT' && movementSlot != null
      ? SLOT_TOTAL[movementSlot] - Object.keys(paceUsedByPieceId).length
      : null;

  return (
    <div className={styles.panel}>
      <div className={styles.line1}>
        <span className={styles.teamName} style={{ color: teamColor }}>
          {teamName}
        </span>
        <span className={styles.score}>
          {score.home} &ndash; {score.away}
        </span>
      </div>
      {phaseLabel && <div className={styles.phaseLabel}>{phaseLabel}</div>}
      {phase === 'MOVEMENT' && movementSlot != null && remaining != null && (
        <div className={styles.slotLine}>
          {movementSlot} &middot; {remaining} moves remaining
        </div>
      )}
    </div>
  );
}
