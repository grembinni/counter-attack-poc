import { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { ctaColorClass } from '../utils/ctaColorClass.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';
import styles from './PenaltyKickSetupPanel.module.css';

/**
 * Penalty Kick sidebar panel — covers all four penalty-kick phases (PEN-01/PEN-02, D-08):
 * PENALTY_KICK_SETUP_ATTACKING, PENALTY_KICK_SETUP_DEFENDING, PENALTY_KICK_TAKER_SELECT,
 * PENALTY_KICK. A direct structural copy of `GoalKickSetupPanel.tsx`'s turn-based sequential
 * reposition-window branch (the `withEndTurnGuard`/`pendingEndTurn` soft-confirm dialog, the
 * eligible-count derivation, and the locked "{Team} is repositioning…" waiting-state phrasing),
 * generalised to the full remaining squad — PEN-02's reposition windows are deliberately
 * UNBUDGETED (no hex-distance cap), unlike Goal/Corner Kick's capped windows.
 *
 * Returns null when phase is none of the four penalty-kick phases, when penaltyKickTeam is
 * null/undefined, or when useMyTeam() returns null.
 */
export function PenaltyKickSetupPanel() {
  const [pendingEndTurn, setPendingEndTurn] = useState<null | {
    action: () => void;
    count: number;
  }>(null);

  const phase = useGameStore((s) => s.gameState.phase);
  const activeTeam = useGameStore((s) => s.gameState.activeTeam);
  const penaltyKickTeam = useGameStore((s) => s.gameState.penaltyKickTeam);
  const penaltyKickEligibleIds = useGameStore((s) => s.gameState.penaltyKickEligibleIds);
  const penaltyKickUsedPace = useGameStore((s) => s.gameState.penaltyKickUsedPace);
  const penaltyKickTakerId = useGameStore((s) => s.gameState.penaltyKickTakerId);
  const movedPieceIds = useGameStore((s) => s.gameState.movedPieceIds);
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const gameError = useGameStore((s) => s.gameError);
  const emitEndTurn = useGameStore((s) => s.emitEndTurn);
  const emitPenaltyKickTaker = useGameStore((s) => s.emitPenaltyKickTaker);
  const emitRoll = useGameStore((s) => s.emitRoll);
  const myTeamOrNull = useMyTeam();

  const isPenaltyKickPhase =
    phase === 'PENALTY_KICK_SETUP_ATTACKING' ||
    phase === 'PENALTY_KICK_SETUP_DEFENDING' ||
    phase === 'PENALTY_KICK_TAKER_SELECT' ||
    phase === 'PENALTY_KICK';

  // Guard block — D-04/Pitfall 4: myTeamOrNull === null is an explicit guard, never a
  // silently-coerced default team (mirrors GoalKickSetupPanel/ThrowInSetupPanel/FreeKickSetupPanel).
  if (
    !isPenaltyKickPhase ||
    penaltyKickTeam === null ||
    penaltyKickTeam === undefined ||
    myTeamOrNull === null
  ) {
    return null;
  }

  // Narrowed to 'home' | 'away' by the guard above.
  const myTeam = myTeamOrNull;
  const oppTeam: 'home' | 'away' = penaltyKickTeam === 'home' ? 'away' : 'home';

  // D-16-01: derived once so every gameError render site below stays consistent, instead of
  // calling the helper repeatedly per render (mirrors GoalKickSetupPanel).
  const humanisedError = restartErrorMessage(gameError);

  const withEndTurnGuard = (eligibleRemaining: number, action: () => void): (() => void) => {
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

  // Reposition windows: attacking team first (PENALTY_KICK_SETUP_ATTACKING), then the
  // defending team (PENALTY_KICK_SETUP_DEFENDING) — mirrors GoalKickSetupPanel's GK/opponent
  // sequential-window structure. The acting team is penaltyKickTeam for the first window,
  // oppTeam for the second.
  if (phase === 'PENALTY_KICK_SETUP_ATTACKING' || phase === 'PENALTY_KICK_SETUP_DEFENDING') {
    const actingTeam = phase === 'PENALTY_KICK_SETUP_ATTACKING' ? penaltyKickTeam : oppTeam;

    if (myTeam !== actingTeam) {
      return (
        <div className={styles.panel}>
          <span className={styles.panelHeading}>Penalty Kick</span>
          <span className={styles.constraintRow}>
            {phase === 'PENALTY_KICK_SETUP_ATTACKING' ? 'Attacking' : 'Defending'} is
            repositioning&hellip;
          </span>
        </div>
      );
    }

    const eligibleIds =
      (phase === 'PENALTY_KICK_SETUP_ATTACKING'
        ? penaltyKickEligibleIds?.attacking
        : penaltyKickEligibleIds?.defending) ?? [];
    const remaining = eligibleIds.filter(
      (id) => (penaltyKickUsedPace?.[id] ?? 0) === 0 && !movedPieceIds.includes(id),
    ).length;
    const repositionColorClass = ctaColorClass(
      remaining,
      { ready: styles.ctaButtonReady, pending: styles.ctaButtonPending },
      true,
    );

    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Penalty Kick</span>
        <span className={styles.constraintRow}>
          {`${remaining} players still eligible to move — reposition freely, then Confirm.`}
        </span>
        <span className={styles.constraintRow}>
          Only the penalty taker and goalkeeper may stand in the penalty area.
        </span>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
        <button
          className={`${styles.ctaButton} ${repositionColorClass}`}
          onClick={withEndTurnGuard(remaining, emitEndTurn)}
        >
          Confirm
        </button>
        {confirmDialog}
      </div>
    );
  }

  // PEN-02 (39-23 gap-6 closure): the attacking manager selects a candidate by clicking a
  // piece on the board (the store's PENALTY_KICK_TAKER_SELECT branch now only sets
  // selectedPieceId — see 39-05's selectPiece branch, rewritten in Plan 39-23), then commits
  // with an explicit Confirm click here — mirrors CornerKickSetupPanel's CORNER_KICK_TAKER_SELECT
  // branch exactly, closing the misclick-commits-irreversibly defect (PENALTY_KICK_TAKER_PLACED
  // is an Undo boundary).
  if (phase === 'PENALTY_KICK_TAKER_SELECT') {
    if (myTeam !== penaltyKickTeam) {
      return (
        <div className={styles.panel}>
          <span className={styles.panelHeading}>Penalty Kick</span>
          <span className={styles.constraintRow}>
            Attacking is choosing a penalty taker&hellip;
          </span>
        </div>
      );
    }

    const takerColorClass = ctaColorClass(
      selectedPieceId === null ? 1 : 0,
      { ready: styles.ctaButtonReady, pending: styles.ctaButtonPending },
      true,
    );

    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Penalty Kick</span>
        <span className={styles.constraintRow}>
          {penaltyKickTakerId === null
            ? 'Choose your penalty taker.'
            : 'Placing your penalty taker…'}
        </span>
        {selectedPieceId === null && (
          <span className={styles.errorText}>Select a player to take the penalty kick first.</span>
        )}
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
        <button
          className={`${styles.ctaButton} ${takerColorClass}`}
          disabled={selectedPieceId === null}
          title={
            selectedPieceId === null ? 'Select a player to take the penalty kick first' : undefined
          }
          onClick={() => {
            if (selectedPieceId !== null) emitPenaltyKickTaker(selectedPieceId);
          }}
        >
          Confirm
        </button>
      </div>
    );
  }

  // PEN-01: the penalty-kick duel itself resolves server-side on the roll. Previously this
  // branch's acting-manager arm rendered no control at all — the claim that "the Roll Dice
  // action lives in ActionPanel" was false, because GameBoard routes the PENALTY_KICK phase to
  // this panel and never renders ActionPanel during it, leaving the phase with no reachable
  // control (found while planning 39-UAT gap 6, not separately reported). Gated on activeTeam,
  // mirroring GoalKickSetupPanel's GOAL_KICK_MOVE travel-window branch.
  if (myTeam !== activeTeam) {
    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Penalty Kick</span>
        <span className={styles.constraintRow}>Waiting for the penalty kick&hellip;</span>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <span className={styles.panelHeading}>Penalty Kick</span>
      <span className={styles.constraintRow}>Take your penalty kick.</span>
      {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      <button
        className={`${styles.ctaButton} ${styles.ctaButtonReady ?? ''}`}
        title="Take a penalty shot at goal, contested by the goalkeeper."
        onClick={() => emitRoll()}
      >
        Shoot
      </button>
    </div>
  );
}
