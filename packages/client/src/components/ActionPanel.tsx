import { useEffect, useState } from 'react';
import {
  ELIGIBLE_NEXT_ACTIONS,
  FREE_KICK_STAGES,
  GOAL_R_VALUES,
  freeKickStageTeam,
  hexDistance,
  isInRegion,
} from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import type { PassType } from '../store/useGameStore.js';
import styles from './ActionPanel.module.css';

const PASS_TYPE_LABELS: Record<PassType, string> = {
  STANDARD_PASS: 'Standard Pass',
  FIRST_TIME_PASS: 'One-Touch',
  HIGH_PASS: 'High Pass',
  LONG_BALL: 'Long Ball',
};

/**
 * UX-13: one-line summary tooltip for each action button (18-UI-SPEC Interaction Contract).
 * Applied as native `title` attribute on each `<button className={styles.ctaButton}>`.
 */
const ACTION_SUMMARY: Record<string, string> = {
  Move: 'Move a player; distance limited by pace.',
  'Standard Pass': 'Pass to a nearby teammate; may be intercepted.',
  'One-Touch': 'First-time pass; both teams reposition before it lands.',
  'High Pass': 'Lofted pass contested by an aerial header.',
  'Long Ball': 'A long downfield pass; less accurate.',
  Snapshot: 'A quick shot from inside the box.',
  Shoot: 'Take a shot at goal (in range only).',
  'Punt (High Pass)': 'Goalkeeper clears with a long kick.',
  'Quick Throw': 'Goalkeeper throws the ball back into play.',
  Undo: 'Undo your last move this phase.',
  'End Turn': 'End your turn and pass control to the opponent.',
};

// GOAL_R_VALUES imported from @counter-attack/shared — single source of truth for goal row positions

/**
 * UX-08: CTA button color-state selector (mirrors GameBoard's statBubbleClass pattern).
 * Returns .ctaButtonReady (green) when all eligible pieces have moved/placed,
 * .ctaButtonPending (orange) while any eligible piece remains unmoved.
 */
function ctaButtonClass(eligibleRemaining: number): string {
  return eligibleRemaining <= 0 ? (styles.ctaButtonReady ?? '') : (styles.ctaButtonPending ?? '');
}

/**
 * Phase-gated, active-player-gated action controls.
 *
 * PASS phase uses a three-step flow (Phase 8.2 D-06):
 *  1. Show eligible next actions (no pass type selected).
 *  2. After selecting a pass type: prompt "click a target hex" with a Back button.
 *  3. After clicking a target hex: show Roll Dice (enabled) and Back.
 * Non-pass actions (Move, Shoot) trigger immediately without a roll step.
 *
 * HEADER phase (D-17): shows contestant selection prompt, Confirm, and gated Roll Header.
 *
 * Returns null for the non-active player (UNDO-03).
 */
export function ActionPanel() {
  /** UX-08: deferred end-turn/confirm-selection state — set when eligibleRemaining > 0. */
  const [pendingEndTurn, setPendingEndTurn] = useState<null | {
    action: () => void;
    count: number;
  }>(null);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const phase = useGameStore((s) => s.gameState.phase);
  const activeTeam = useGameStore((s) => s.gameState.activeTeam);
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const lastDiceRoll = useGameStore((s) => s.gameState.lastDiceRoll);
  const lastActionType = useGameStore((s) => s.gameState.lastActionType);
  const carrierId = useGameStore((s) => s.gameState.ball.carrierId);
  const pieces = useGameStore((s) => s.gameState.pieces);
  const eventLog = useGameStore((s) => s.gameState.eventLog);
  const headerConfirmed = useGameStore((s) => s.gameState.headerConfirmed);
  const gameError = useGameStore((s) => s.gameError);
  const emitRoll = useGameStore((s) => s.emitRoll);
  const emitEndTurn = useGameStore((s) => s.emitEndTurn);
  const emitUndo = useGameStore((s) => s.emitUndo);
  const emitStartMovement = useGameStore((s) => s.emitStartMovement);
  const emitGKRestart = useGameStore((s) => s.emitGKRestart);
  const emitSnapshot = useGameStore((s) => s.emitSnapshot);
  // Phase 8.2: store-backed pass type selection (replaces local useState — clearing is done in setGameState)
  const selectedPassType = useGameStore((s) => s.selectedPassType);
  const setSelectedPassType = useGameStore((s) => s.setSelectedPassType);
  const passTargetHex = useGameStore((s) => s.passTargetHex);
  const headerContestantIds = useGameStore((s) => s.headerContestantIds);
  const emitHeaderContestant = useGameStore((s) => s.emitHeaderContestant);
  // RULE-01 (Phase 11): accuracy roll acknowledgment gate
  const headerAccuracyRollPending = useGameStore((s) => s.gameState.headerAccuracyRollPending);
  const emitHeaderAccuracyAck = useGameStore((s) => s.emitHeaderAccuracyAck);
  const headerDuelWinner = useGameStore((s) => s.gameState.headerDuelWinner);
  // Phase 10: shooting mode (two-step Shoot flow)
  const shootingMode = useGameStore((s) => s.shootingMode);
  const setShootingMode = useGameStore((s) => s.setShootingMode);
  const movedPieceIds = useGameStore((s) => s.gameState.movedPieceIds);
  const movementSlot = useGameStore((s) => s.gameState.movementSlot);
  const paceUsedByPieceId = useGameStore((s) => s.gameState.paceUsedByPieceId);
  const emitCancelMovement = useGameStore((s) => s.emitCancelMovement);
  // D-19 (Phase 25): piece selection triggers counter decrement at move-start, not destination commit.
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  // 260621-ajd: remaining-player countdown for FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE
  const freeMoveEligibleIds = useGameStore((s) => s.gameState.freeMoveEligibleIds);
  const freeMoveUsedPace = useGameStore((s) => s.gameState.freeMoveUsedPace);
  // UX-08: per-phase repositioning tracking fields for eligibleRemaining derivation
  const highPassMovedPieceId = useGameStore((s) => s.gameState.highPassMovedPieceId);
  const firstTimePassMovedPieceId = useGameStore((s) => s.gameState.firstTimePassMovedPieceId);
  const gkKickMovedPieceId = useGameStore((s) => s.gameState.gkKickMovedPieceId);
  const snapDeflectMovedPieceId = useGameStore((s) => s.gameState.snapDeflectMovedPieceId);
  // Plan 25-06: FREE_KICK_SETUP stage tracking for dedicated ActionPanel block.
  const freeKickStageIndex = useGameStore((s) => s.gameState.freeKickStageIndex);
  const freeKickAttackingTeam = useGameStore((s) => s.gameState.freeKickAttackingTeam);
  const freeKickPlacedPieceIds = useGameStore((s) => s.gameState.freeKickPlacedPieceIds);
  const freeKickKickerChosen = useGameStore((s) => s.gameState.freeKickKickerChosen);

  const myTeam: 'home' | 'away' | null =
    playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
  const isActivePlayer = myTeam !== null && myTeam === activeTeam;

  const waitingPanel = (
    <div className={styles.panel}>
      <div className={styles.helperBlock}>
        <span className={styles.helperLine1}>Opponent&apos;s Turn</span>
        <span className={styles.helperLine2}>Waiting for opponent...</span>
      </div>
    </div>
  );

  /**
   * UX-08: wraps an end-turn/confirm-selection action with a confirmation gate.
   * When eligibleRemaining > 0 the action and count are stored; the confirm dialog is shown.
   * When eligibleRemaining <= 0 the action fires immediately with no dialog.
   */
  const withEndTurnConfirm = (eligibleRemaining: number, action: () => void): (() => void) => {
    return () => {
      if (eligibleRemaining > 0) {
        setPendingEndTurn({ action, count: eligibleRemaining });
      } else {
        action();
      }
    };
  };

  /** UX-08: confirm dialog overlay — rendered inside the phase panel when pendingEndTurn is set. */
  const confirmDialog =
    pendingEndTurn !== null ? (
      <div className={styles.confirmOverlay}>
        <div className={styles.confirmCard}>
          <p className={styles.confirmText}>
            {pendingEndTurn.count} players left to move, are you sure you want to end your turn?
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
              Confirm
            </button>
          </div>
        </div>
      </div>
    ) : null;

  /** Check if an action is eligible given the current lastActionType. */
  const isEligible = (action: string): boolean => {
    const effectiveLast = lastActionType ?? 'MOVEMENT_PHASE';
    const eligible = ELIGIBLE_NEXT_ACTIONS[effectiveLast];
    return eligible?.has(action as Parameters<typeof eligible.has>[0]) ?? false;
  };

  // Auto-emit scatter roll when entering LOOSE_BALL — no player interaction needed
  useEffect(() => {
    if (phase === 'LOOSE_BALL' && isActivePlayer) {
      emitRoll();
    }
  }, [phase, isActivePlayer, emitRoll]);

  // After a header win the active player gets a First-time Pass (non-interceptable per isHeaderPass).
  // Auto-select so the valid-target hexes appear without an extra click.
  // ELIGIBLE_NEXT_ACTIONS['HEADER'] does not include STANDARD_PASS — use FIRST_TIME_PASS.
  useEffect(() => {
    if (
      phase === 'PASS' &&
      lastActionType === 'HEADER' &&
      isActivePlayer &&
      selectedPassType === null
    ) {
      setSelectedPassType('FIRST_TIME_PASS');
    }
  }, [phase, lastActionType, isActivePlayer, selectedPassType, setSelectedPassType]);

  // D-20 (Phase 25): auto-advance the HEADER accuracy step after 1500ms on the attacking client.
  // Replaces the push-button Continue confirmation (UX-15 — v1.3 playtesting feedback).
  // The EventBanner popup (HP_ACCURACY → 'Accurate Pass!' / 'Loose Ball!') provides visual
  // feedback during the 1500ms window; no additional UI element is needed here.
  // Guard: only the active player on the attacking team emits the ack — never the defending
  // client (T-25-04 / Pitfall 6: single emitter invariant).
  useEffect(() => {
    if (
      phase === 'HEADER' &&
      (headerAccuracyRollPending ?? false) &&
      isActivePlayer &&
      myTeam === attackingTeam
    ) {
      const timerId = setTimeout(() => {
        emitHeaderAccuracyAck();
      }, 1500);
      return () => clearTimeout(timerId);
    }
  }, [
    phase,
    headerAccuracyRollPending,
    isActivePlayer,
    myTeam,
    attackingTeam,
    emitHeaderAccuracyAck,
  ]);

  // Shared canUndo computation — used in both MOVE and HIGH_PASS_MOVE phases.
  // BUG-03 (Phase 17 D-07): HIGH_PASS_MOVE also uses HP_REPOSITION as a slot boundary.
  // Mirrors applyUndo's boundary logic (SLOT_ADVANCE | KICK_OFF | HP_REPOSITION in HIGH_PASS_MOVE).
  // Plan 25-06: FK_KICKER_CHOSEN and FK_STAGE_ADVANCE are slot boundaries in FREE_KICK_SETUP.
  const canUndo = (() => {
    if (lastDiceRoll) return false;
    const lastBoundaryIdx = eventLog.reduce<number>((acc, evt, idx) => {
      const isBoundary =
        evt.type === 'SLOT_ADVANCE' ||
        evt.type === 'KICK_OFF' ||
        (phase === 'HIGH_PASS_MOVE' && evt.type === 'HP_REPOSITION') ||
        (phase === 'FIRST_TIME_PASS_MOVE' && evt.type === 'FTP_REPOSITION') ||
        (phase === 'FREE_KICK_SETUP' &&
          (evt.type === 'FK_KICKER_CHOSEN' || evt.type === 'FK_STAGE_ADVANCE'));
      return isBoundary ? idx : acc;
    }, -1);
    // CR-01 (17.1-11): mirror applyUndo's phase-aware move-type mapping — gameHandlers.ts
    // emits HP_MOVE during HIGH_PASS_MOVE and FTP_MOVE during FIRST_TIME_PASS_MOVE, never MOVE.
    // BUG-18 (Phase 18.3): extended to match the server's expanded validUndoPhases.
    const moveTypeForPhase =
      phase === 'HIGH_PASS_MOVE'
        ? 'HP_MOVE'
        : phase === 'FIRST_TIME_PASS_MOVE'
          ? 'FTP_MOVE'
          : phase === 'GK_KICK_MOVE'
            ? 'GK_KICK_MOVE'
            : phase === 'SNAPSHOT_DEFLECT'
              ? 'SNAP_DEFLECT_MOVE'
              : phase === 'FREE_KICK_SETUP'
                ? 'FK_SETUP_MOVE'
                : 'MOVE'; // covers MOVE, FREE_MOVE_ATTACK, FREE_MOVE_DEFENSE
    return eventLog.slice(lastBoundaryIdx + 1).some((e) => e.type === moveTypeForPhase);
  })();

  // -------------------------------------------------------------------------
  // HIGH_PASS_MOVE phase: both teams reposition 1 player up to 3 hexes before accuracy roll.
  // Must be before the isActivePlayer guard — both teams act in this phase.
  // -------------------------------------------------------------------------
  if (phase === 'HIGH_PASS_MOVE') {
    if (myTeam === null) return null;
    // activeTeam switches between attackingTeam (ATTACKER slot) and defenderTeam (DEFENDER slot)
    // so isActivePlayer correctly reflects whose turn it is in this phase
    if (!isActivePlayer) return waitingPanel;
    // UX-08: 1 repositioning slot per team — pending until highPassMovedPieceId is set
    const hpmEligibleRemaining = highPassMovedPieceId == null ? 1 : 0;
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>High Pass Aerial Challenge!</span>
          <span className={styles.helperLine2}>Move 1 player to challenge (max 3 hexes).</span>
        </div>
        {/* BUG-03 (Phase 17 D-07): Undo available in HIGH_PASS_MOVEMENT with same boundary logic */}
        <button
          className={styles.ctaButton}
          title={ACTION_SUMMARY['Undo']}
          disabled={!canUndo}
          onClick={emitUndo}
        >
          Undo
        </button>
        <button
          className={`${styles.ctaButton} ${ctaButtonClass(hpmEligibleRemaining)}`}
          title={ACTION_SUMMARY['End Turn']}
          onClick={withEndTurnConfirm(hpmEligibleRemaining, emitEndTurn)}
        >
          End Turn
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // FIRST_TIME_PASS_MOVE phase: both teams reposition 1 player ≤1 hex each before
  // ball is delivered to the target hex (no interception check).
  // Must be before the isActivePlayer guard — both teams act in this phase.
  // -------------------------------------------------------------------------
  if (phase === 'FIRST_TIME_PASS_MOVE') {
    if (myTeam === null) return null;
    // activeTeam switches between attackingTeam (ATTACKER slot) and defenderTeam (DEFENDER slot)
    // so isActivePlayer correctly reflects whose turn it is in this phase
    if (!isActivePlayer) return waitingPanel;
    // UX-08: 1 repositioning slot per team — pending until firstTimePassMovedPieceId is set
    const ftpmEligibleRemaining = firstTimePassMovedPieceId == null ? 1 : 0;
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>First-Time Pass!</span>
          <span className={styles.helperLine2}>Move 1 player to receive the ball (max 1 hex).</span>
        </div>
        {/* D-03 (Phase 17.1): Undo available with FTP_REPOSITION as the slot boundary */}
        <button
          className={styles.ctaButton}
          title={ACTION_SUMMARY['Undo']}
          disabled={!canUndo}
          onClick={emitUndo}
        >
          Undo
        </button>
        <button
          className={`${styles.ctaButton} ${ctaButtonClass(ftpmEligibleRemaining)}`}
          title={ACTION_SUMMARY['End Turn']}
          onClick={withEndTurnConfirm(ftpmEligibleRemaining, emitEndTurn)}
        >
          End Turn
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // GK_DIVE phase: GK clicks a highlighted hex on the shot path (0–3 hexes away).
  // Clicking triggers the dive and the shot auto-resolves immediately — no End Turn needed.
  // Must be before the isActivePlayer guard — both teams see this phase.
  // -------------------------------------------------------------------------
  if (phase === 'GK_DIVE') {
    if (myTeam === null) return null;
    const gkTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
    const isGKTeamPlayer = myTeam === gkTeam;
    if (!isGKTeamPlayer) return waitingPanel;
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Attempt Save!</span>
          <span className={styles.helperLine2}>Dive to a highlighted hex (max 3 hexes).</span>
        </div>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // SNAPSHOT_DEFLECT phase: defending team moves 1 player up to 2 hexes before
  // snapshot resolves.
  // Must be before the isActivePlayer guard — both teams see this phase.
  // Active team = defending team (opponent of attackingTeam).
  // -------------------------------------------------------------------------
  if (phase === 'SNAPSHOT_DEFLECT') {
    if (myTeam === null) return null;
    const defendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
    const isDefendingTeamPlayer = myTeam === defendingTeam;
    if (!isDefendingTeamPlayer) return waitingPanel;
    // UX-08: 1 repositioning slot — pending until snapDeflectMovedPieceId is set
    const sdEligibleRemaining = snapDeflectMovedPieceId == null ? 1 : 0;
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Snapshot - Deflection Attempt!</span>
          <span className={styles.helperLine2}>
            Move 1 player to deflect the shot (up to 2 hexes).
          </span>
        </div>
        <button
          className={`${styles.ctaButton} ${ctaButtonClass(sdEligibleRemaining)}`}
          title={ACTION_SUMMARY['End Turn']}
          onClick={withEndTurnConfirm(sdEligibleRemaining, emitEndTurn)}
        >
          End Turn
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // HEADER phase (D-17): both teams must see the contestant selection UI.
  // The Roll Header button is gated to the active player only.
  // This block must be BEFORE the isActivePlayer guard so the defending team
  // can select/decline their contestant.
  // -------------------------------------------------------------------------
  if (phase === 'HEADER') {
    if (myTeam === null) return null;

    // RULE-01: gate contestant selection behind accuracy roll acknowledgment.
    // D-20 (Phase 25): the auto-advance useEffect (above) fires emitHeaderAccuracyAck()
    // after 1500ms on the attacking client — no button needed. Both players see the
    // waiting panel; the EventBanner popup (HP_ACCURACY) provides visual feedback.
    if (headerAccuracyRollPending ?? false) {
      return waitingPanel;
    }

    const myConfirmed = headerConfirmed?.[myTeam] ?? false;
    const bothConfirmed = (headerConfirmed?.home ?? false) && (headerConfirmed?.away ?? false);

    if (bothConfirmed) {
      // Duel resolved — winner selects target hex; loser/tie waits.
      if (headerDuelWinner != null && headerDuelWinner === myTeam) {
        return (
          <div className={styles.panel}>
            <div className={styles.helperBlock}>
              <span className={styles.helperLine1}>Header Won!</span>
              <span className={styles.helperLine2}>Select a target hex.</span>
            </div>
            {gameError && <span className={styles.errorText}>{gameError}</span>}
          </div>
        );
      }
      return waitingPanel;
    }

    return (
      <div className={styles.panel}>
        {!myConfirmed && (
          <>
            <div className={styles.helperBlock}>
              <span className={styles.helperLine1}>Contest Header!</span>
              <span className={styles.helperLine2}>
                {headerContestantIds.length} players selected within range.
              </span>
            </div>
            {/* UX-08: eligibleRemaining = 1 while no contestant selected (player has not acted yet);
                 0 once a contestant is chosen. Confirm Selection has no dialog (already green/ready);
                 Decline (no contestant) triggers the dialog as it could be accidental. */}
            {(() => {
              const headerEligibleRemaining = headerContestantIds.length > 0 ? 0 : 1;
              return (
                <button
                  className={`${styles.ctaButton} ${ctaButtonClass(headerEligibleRemaining)}`}
                  onClick={withEndTurnConfirm(headerEligibleRemaining, () =>
                    emitHeaderContestant(headerContestantIds),
                  )}
                >
                  {headerContestantIds.length > 0 ? 'Confirm Selection' : 'Decline (no contestant)'}
                </button>
              );
            })()}
          </>
        )}
        {myConfirmed && (
          <div className={styles.helperBlock}>
            <span className={styles.helperLine1}>Opponent&apos;s Turn</span>
            <span className={styles.helperLine2}>Waiting for opponent...</span>
          </div>
        )}
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // SNAPSHOT_TARGET — snapshot target selection: attacker clicks a goal hex.
  // Must be before the isActivePlayer gate so defender also gets a waiting panel.
  // -------------------------------------------------------------------------
  if (phase === 'SNAPSHOT_TARGET') {
    if (myTeam === null) return null;
    if (!isActivePlayer) return waitingPanel;
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Snapshot!</span>
          <span className={styles.helperLine2}>Select a goal hex to target.</span>
        </div>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // GK_RESTART phase: GK's team chooses restart method (kick/throw/movement).
  // Must be before the isActivePlayer guard — after a regular save, activeTeam
  // stays as the attacking team, so the GK team would fail the guard below.
  // -------------------------------------------------------------------------
  if (phase === 'GK_RESTART') {
    if (myTeam === null) return null;
    const gkPieceForRestart = pieces.find((p) => p.id === carrierId);
    const gkTeamForRestart = gkPieceForRestart?.teamId ?? null;
    const isGKTeamPlayer = myTeam !== null && myTeam === gkTeamForRestart;
    if (!isGKTeamPlayer) return waitingPanel;
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Goalie Restart!</span>
          <span className={styles.helperLine2}>Choose an action.</span>
        </div>
        <button
          className={styles.ctaButton}
          title={ACTION_SUMMARY['Punt (High Pass)']}
          onClick={() => emitGKRestart('kick')}
        >
          Punt (High Pass)
        </button>
        <button
          className={styles.ctaButton}
          title={ACTION_SUMMARY['Quick Throw']}
          onClick={() => emitGKRestart('throw')}
        >
          Quick Throw
        </button>
        <button
          className={styles.ctaButton}
          title={ACTION_SUMMARY['Move']}
          onClick={() => emitGKRestart('movement')}
        >
          Move
        </button>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // GK_QUICK_THROW phase: GK's team selects a target hex on the pitch (≤ 11 hexes).
  // Same guard structure as GK_RESTART — must be before isActivePlayer check.
  if (phase === 'GK_QUICK_THROW') {
    if (myTeam === null) return null;
    const gkPiece = pieces.find((p) => p.id === carrierId);
    const gkTeam = gkPiece?.teamId ?? null;
    const isGKTeamPlayer = myTeam === gkTeam;
    if (!isGKTeamPlayer) return waitingPanel;
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Quick Throw!</span>
          <span className={styles.helperLine2}>Select a target hex (up to 11 hexes).</span>
        </div>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // GK_KICK_TARGET phase: GK's team clicks a target hex on the pitch.
  // Must be before isActivePlayer guard — both teams see this phase.
  if (phase === 'GK_KICK_TARGET') {
    if (myTeam === null) return null;
    const gkPiece = pieces.find((p) => p.id === carrierId);
    const gkTeam = gkPiece?.teamId ?? null;
    const isGKTeamPlayer = myTeam === gkTeam;
    if (!isGKTeamPlayer) return waitingPanel;
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Punt!</span>
          <span className={styles.helperLine2}>
            Target anywhere except the opponent&apos;s final third.
          </span>
        </div>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // GK_KICK_MOVE phase: both teams reposition 1 player up to 3 hexes while ball is in air.
  // Must be before isActivePlayer guard — both teams act in this phase.
  if (phase === 'GK_KICK_MOVE') {
    if (myTeam === null) return null;
    if (!isActivePlayer) return waitingPanel;
    // UX-08: 1 repositioning slot per team — pending until gkKickMovedPieceId is set
    const gkmEligibleRemaining = gkKickMovedPieceId == null ? 1 : 0;
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Ball in Air!</span>
          <span className={styles.helperLine2}>
            Move 1 player to receive the ball (max 3 hexes).
          </span>
        </div>
        <button
          className={`${styles.ctaButton} ${ctaButtonClass(gkmEligibleRemaining)}`}
          title={ACTION_SUMMARY['End Turn']}
          onClick={withEndTurnConfirm(gkmEligibleRemaining, emitEndTurn)}
        >
          End Turn
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // FREE_MOVE_ATTACK / FREE_MOVE_DEFENSE phases (Phase 17 MOVE-06, corrected design
  // D-33..D-38): triggered when the ball enters a final third — ALL pieces of both
  // teams (GK included) in the opposite final third each get an independent free
  // 6-hex move. Two sequential sub-phases enforce "attacking team moves first";
  // only the team whose sub-phase is active acts here — the other sees the waiting panel.
  // -------------------------------------------------------------------------
  if (phase === 'FREE_MOVE_ATTACK' || phase === 'FREE_MOVE_DEFENSE') {
    if (myTeam === null) return null;
    if (!isActivePlayer) return waitingPanel;
    // 260621-ajd: countdown of players left to move in the active free-move sub-phase.
    const freeMoveSide = phase === 'FREE_MOVE_ATTACK' ? 'attack' : 'defense';
    const eligibleIds = freeMoveEligibleIds?.[freeMoveSide] ?? [];
    const eligibleTotal = eligibleIds.length;
    const movedCount = eligibleIds.filter((id) => (freeMoveUsedPace?.[id] ?? 0) > 0).length;
    const remaining = Math.max(eligibleTotal - movedCount, 0);
    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>
            Ball entered the opposite final third — your backline can reposition up to 6 hexes
            regardless of remaining pace.
          </span>
          <span className={styles.helperLine2}>{remaining} players still eligible to move.</span>
        </div>
        <button
          className={`${styles.ctaButton} ${ctaButtonClass(remaining)}`}
          title={ACTION_SUMMARY['End Turn']}
          onClick={withEndTurnConfirm(remaining, emitEndTurn)}
        >
          End Turn
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // FREE_KICK_SETUP phase (Plan 25-06): dedicated panel with kicker-select sub-step,
  // move counter, Undo, and End Turn. Must be before the !isActivePlayer guard so
  // both teams see the correct waiting / active panel regardless of activeTeam.
  // -------------------------------------------------------------------------
  if (phase === 'FREE_KICK_SETUP') {
    if (myTeam === null) return null;

    const kickingTeam = freeKickAttackingTeam;
    const activeTeamForStage =
      freeKickStageIndex !== null &&
      freeKickStageIndex !== undefined &&
      kickingTeam !== null &&
      kickingTeam !== undefined
        ? freeKickStageTeam(freeKickStageIndex, kickingTeam)
        : null;
    const isMyStage = myTeam === activeTeamForStage;

    // Non-active team waits
    if (!isMyStage) return waitingPanel;

    // Kicker-select sub-step: kicking team must place kicker on freeKickHex first
    if (!freeKickKickerChosen && myTeam === kickingTeam) {
      return (
        <div className={styles.panel}>
          <div className={styles.helperBlock}>
            <span className={styles.helperLine1}>Free Kick — Select Kicker</span>
            <span className={styles.helperLine2}>
              Click a player and move them to the ball hex to designate the kicker. The kicker
              cannot be moved again during setup.
            </span>
          </div>
          {gameError && <span className={styles.errorText}>{gameError}</span>}
        </div>
      );
    }

    // Move-count sub-step: both teams reposition up to stage.max players
    const stageMax =
      freeKickStageIndex !== null && freeKickStageIndex !== undefined
        ? FREE_KICK_STAGES[freeKickStageIndex].max
        : 0;
    const placedCount = (freeKickPlacedPieceIds ?? []).length;
    const remaining = Math.max(stageMax - placedCount, 0);
    const isKickingTeam = myTeam === kickingTeam;
    const stageLabel = isKickingTeam ? 'Attacking' : 'Defending';

    return (
      <div className={styles.panel}>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Free Kick Setup — {stageLabel} Team</span>
          <span className={styles.helperLine2}>
            {remaining} of {stageMax} players left to reposition.
          </span>
        </div>
        <button
          className={styles.ctaButton}
          title={ACTION_SUMMARY['Undo']}
          disabled={!canUndo}
          onClick={emitUndo}
        >
          Undo
        </button>
        <button
          className={`${styles.ctaButton} ${ctaButtonClass(remaining)}`}
          title={ACTION_SUMMARY['End Turn']}
          onClick={withEndTurnConfirm(remaining, emitEndTurn)}
        >
          End Turn
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  if (!isActivePlayer) return waitingPanel;

  // -------------------------------------------------------------------------
  // KICK_OFF + PASS phase — three-step flow (Phase 8.2 D-06)
  // KICK_OFF is treated identically to PASS: lastActionType is null → shows
  // MOVEMENT_PHASE eligible actions. "Move" calls emitStartMovement which the
  // server accepts from both KICK_OFF and PASS.
  // -------------------------------------------------------------------------
  if (phase === 'PASS' || phase === 'KICK_OFF') {
    // Ball loose in PASS phase (standard pass to empty hex or deflection landing): only Move available.
    if (phase === 'PASS' && carrierId === null) {
      return (
        <div className={styles.panel}>
          <div className={styles.helperBlock}>
            <span className={styles.helperLine1}>Loose Ball!</span>
            <span className={styles.helperLine2}>Move to collect.</span>
          </div>
          <button
            className={styles.ctaButton}
            title={ACTION_SUMMARY['Move']}
            onClick={emitStartMovement}
          >
            Move
          </button>
          {gameError && <span className={styles.errorText}>{gameError}</span>}
        </div>
      );
    }

    // Eligible next actions based on the last completed action.
    // null lastActionType (kick-off start state) treated as MOVEMENT_PHASE.
    const effectiveLastAction = lastActionType ?? 'MOVEMENT_PHASE';
    const eligible = ELIGIBLE_NEXT_ACTIONS[effectiveLastAction];

    // Step 1: no pass type selected — show action chooser
    if (selectedPassType === null) {
      const carrier = pieces.find((p) => p.id === carrierId);
      const goalHexes = GOAL_R_VALUES.map((r) => ({
        q: attackingTeam === 'home' ? 36 : 0,
        r,
      }));
      const dist =
        carrier !== undefined
          ? Math.min(...goalHexes.map((g) => hexDistance(carrier.position, g)))
          : Infinity;
      const passPhaseSnapshotRegion =
        attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';
      const carrierInPenaltyArea =
        carrier !== undefined && isInRegion(carrier.position, passPhaseSnapshotRegion);
      const showSnapshot =
        lastActionType !== null && isEligible('SNAPSHOT') && carrierInPenaltyArea;
      const showShoot = eligible.has('SHOT') && dist <= 11;

      // MATCH-07: during kick-off only Standard Pass is a legal opening action.
      const isKickOff = phase === 'KICK_OFF';

      const actionCount = [
        eligible.has('MOVEMENT'),
        eligible.has('STANDARD_PASS'),
        !isKickOff && eligible.has('FIRST_TIME_PASS'),
        !isKickOff && eligible.has('HIGH_PASS'),
        !isKickOff && eligible.has('LONG_BALL'),
        !isKickOff && showSnapshot,
        !isKickOff && showShoot,
      ].filter(Boolean).length;

      return (
        <div className={`${styles.panel} ${actionCount >= 5 ? styles.wide : ''}`}>
          {isKickOff && (
            <div className={styles.helperBlock}>
              <span className={styles.helperLine1}>Kick-Off!</span>
              <span className={styles.helperLine2}>
                Play starts with a Standard Pass from the centre circle — the only legal opening
                action.
              </span>
            </div>
          )}
          <span className={styles.phaseLabel}>Choose Action</span>
          {!isKickOff && eligible.has('MOVEMENT') && (
            <button
              className={styles.ctaButton}
              title={ACTION_SUMMARY['Move']}
              onClick={emitStartMovement}
            >
              Move
            </button>
          )}
          {eligible.has('STANDARD_PASS') && (
            <button
              className={styles.ctaButton}
              title={ACTION_SUMMARY['Standard Pass']}
              onClick={() => setSelectedPassType('STANDARD_PASS')}
            >
              Standard Pass
            </button>
          )}
          {!isKickOff && eligible.has('FIRST_TIME_PASS') && (
            <button
              className={styles.ctaButton}
              title={ACTION_SUMMARY['One-Touch']}
              onClick={() => setSelectedPassType('FIRST_TIME_PASS')}
            >
              One-Touch
            </button>
          )}
          {!isKickOff && eligible.has('HIGH_PASS') && (
            <button
              className={styles.ctaButton}
              title={ACTION_SUMMARY['High Pass']}
              onClick={() => setSelectedPassType('HIGH_PASS')}
            >
              High Pass
            </button>
          )}
          {!isKickOff && eligible.has('LONG_BALL') && (
            <button
              className={styles.ctaButton}
              title={ACTION_SUMMARY['Long Ball']}
              onClick={() => setSelectedPassType('LONG_BALL')}
            >
              Long Ball
            </button>
          )}
          {!isKickOff && showSnapshot && (
            <button
              className={styles.ctaButton}
              title={ACTION_SUMMARY['Snapshot']}
              onClick={emitSnapshot}
            >
              Snapshot
            </button>
          )}
          {!isKickOff && showShoot && (
            <button
              className={styles.ctaButton}
              title={ACTION_SUMMARY['Shoot']}
              onClick={() => setShootingMode(true)}
              disabled={shootingMode}
            >
              {shootingMode ? 'Select goal hex...' : 'Shoot'}
            </button>
          )}
          {!isKickOff && shootingMode && (
            <button className={styles.backButton} onClick={() => setShootingMode(false)}>
              ← Cancel Shot
            </button>
          )}
          {gameError && <span className={styles.errorText}>{gameError}</span>}
        </div>
      );
    }

    // Step 2: pass type selected, no target hex yet — prompt to click a target
    if (passTargetHex === null) {
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>
            {PASS_TYPE_LABELS[selectedPassType]} — click a target hex
          </span>
          <button className={styles.backButton} onClick={() => setSelectedPassType(null)}>
            ← Back
          </button>
          {gameError && <span className={styles.errorText}>{gameError}</span>}
        </div>
      );
    }

    // confirmPassTarget auto-emits GAME_ROLL — no step 3 needed; return null while server processes
    return null;
  }

  // -------------------------------------------------------------------------
  // MOVE phase
  // -------------------------------------------------------------------------
  if (phase === 'MOVE') {
    const carrier = pieces.find((p) => p.id === carrierId);
    const penaltyAreaRegion = attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';
    // Snapshot only for the attacking team (not defense in DEFENDER_5 slot) and only while
    // the ball carrier has not yet exhausted their movement (not in movedPieceIds).
    const snapGoalQ = attackingTeam === 'home' ? 36 : 0;
    const carrierInSnapRange =
      carrier !== undefined &&
      GOAL_R_VALUES.some((r) => hexDistance(carrier.position, { q: snapGoalQ, r }) <= 6);
    const canSnapshot =
      carrier !== undefined &&
      myTeam !== null &&
      carrier.teamId === myTeam &&
      isInRegion(carrier.position, penaltyAreaRegion) &&
      carrierId !== null &&
      !movedPieceIds.includes(carrierId) &&
      carrierInSnapRange;

    // canUndo is computed above as a shared const (also used by HIGH_PASS_MOVEMENT)

    const slotTotal =
      movementSlot != null ? { ATTACKER_4: 4, DEFENDER_5: 5, ATTACKER_2: 2 }[movementSlot] : null;
    // 260621-ajd: countdown of players left to move in the active movement slot.
    // Count pieces that exhausted their pace this phase but aren't yet locked in movedPieceIds
    // (BUG-14 defers locking until the NEXT activation, so the last piece in the slot never
    // gets locked unless someone else moves after them — this fills that gap for the UI).
    const paceExhaustedNotLocked = Object.entries(paceUsedByPieceId).filter(([id, used]) => {
      if (movedPieceIds.includes(id)) return false;
      const p = pieces.find((pc) => pc.id === id);
      if (p === undefined) return false;
      const effectiveCap = movementSlot === 'ATTACKER_2' ? Math.min(p.pace, 2) : p.pace;
      return used >= effectiveCap;
    }).length;
    // movedPieceIds accumulates across slot transitions (ATTACKER_4 → DEFENDER_5 → ATTACKER_2).
    // paceUsedByPieceId resets at each slot boundary, so the intersection tells us which
    // pieces were locked in the CURRENT slot only.
    const currentSlotLockedCount = movedPieceIds.filter(
      (id) => paceUsedByPieceId[id] !== undefined,
    ).length;
    // D-19 (Phase 25): decrement the counter the moment a piece is selected (move start),
    // not when the destination is committed. Restores automatically on undo/deselect because
    // selectedPieceId returns to null — no extra state needed (Pitfall 7 guard prevents
    // double-counting a piece already counted by movedPieceIds or paceExhaustedNotLocked).
    const selectedIsMoving =
      phase === 'MOVE' &&
      selectedPieceId !== null &&
      !movedPieceIds.includes(selectedPieceId) &&
      (paceUsedByPieceId[selectedPieceId] ?? 0) === 0;
    const remaining =
      slotTotal != null
        ? Math.max(
            slotTotal -
              currentSlotLockedCount -
              paceExhaustedNotLocked -
              (selectedIsMoving ? 1 : 0),
            0,
          )
        : null;
    const slotHelperLine2 =
      slotTotal != null && remaining != null
        ? movementSlot === 'ATTACKER_2'
          ? `${remaining} of ${slotTotal} players left to move. (2 hex max)`
          : `${remaining} of ${slotTotal} players left to move.`
        : null;

    return (
      <div className={styles.panel}>
        {slotHelperLine2 && (
          <div className={styles.helperBlock}>
            <span className={styles.helperLine1}>Move!</span>
            <span className={styles.helperLine2}>{slotHelperLine2}</span>
          </div>
        )}
        {/* D-10: Snapshot wired to emitSnapshot in MOVEMENT phase (was permanently disabled) */}
        {canSnapshot && (
          <button
            className={styles.ctaButton}
            title={ACTION_SUMMARY['Snapshot']}
            onClick={emitSnapshot}
          >
            Snapshot
          </button>
        )}
        <button
          className={styles.ctaButton}
          title={ACTION_SUMMARY['Undo']}
          disabled={!canUndo}
          onClick={emitUndo}
        >
          Undo
        </button>
        <button
          className={`${styles.ctaButton} ${ctaButtonClass(remaining ?? 0)}`}
          title={ACTION_SUMMARY['End Turn']}
          onClick={withEndTurnConfirm(remaining ?? 0, emitEndTurn)}
        >
          End Turn
        </button>
        {movementSlot === 'ATTACKER_4' && Object.keys(paceUsedByPieceId).length === 0 && (
          <button className={styles.backButton} onClick={emitCancelMovement}>
            ← Back
          </button>
        )}
        {confirmDialog}
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
