import { useState } from 'react';
import { useGameStore } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { ctaColorClass } from '../utils/ctaColorClass.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';
import styles from './GoalKickSetupPanel.module.css';

/**
 * Goal Kick sidebar panel — covers all five goal-kick phases (GOALKICK-04/05):
 * GOAL_KICK_SETUP_GK, GOAL_KICK_SETUP_OPPONENT, GOAL_KICK_CHOICE, GOAL_KICK_TARGET,
 * GOAL_KICK_MOVE. Adopts Phase 35's locked conventions in full (D-07): `.panel` with
 * no `border` rule, the single-CTA verb lock, and the verbatim waiting-state phrasing
 * ("{Attacking|Defending} team is repositioning…"). The two reposition windows and
 * the travel window reuse FreeKickSetupPanel's soft end-turn dialog pattern
 * (withEndTurnGuard/pendingEndTurn) verbatim in behaviour.
 *
 * Returns null when phase is none of the five goal-kick phases, when goalKickTeam is
 * null/undefined, or when useMyTeam() returns null.
 */
export function GoalKickSetupPanel() {
  const [pendingEndTurn, setPendingEndTurn] = useState<null | {
    action: () => void;
    count: number;
  }>(null);

  const phase = useGameStore((s) => s.gameState.phase);
  const activeTeam = useGameStore((s) => s.gameState.activeTeam);
  const goalKickTeam = useGameStore((s) => s.gameState.goalKickTeam);
  const goalKickEligibleIds = useGameStore((s) => s.gameState.goalKickEligibleIds);
  const goalKickUsedPace = useGameStore((s) => s.gameState.goalKickUsedPace);
  const goalKickMovedPieceId = useGameStore((s) => s.gameState.goalKickMovedPieceId);
  const movedPieceIds = useGameStore((s) => s.gameState.movedPieceIds);
  const gameError = useGameStore((s) => s.gameError);
  const emitGoalKickChoice = useGameStore((s) => s.emitGoalKickChoice);
  const emitEndTurn = useGameStore((s) => s.emitEndTurn);
  const myTeamOrNull = useMyTeam();

  const isGoalKickPhase =
    phase === 'GOAL_KICK_SETUP_GK' ||
    phase === 'GOAL_KICK_SETUP_OPPONENT' ||
    phase === 'GOAL_KICK_CHOICE' ||
    phase === 'GOAL_KICK_TARGET' ||
    phase === 'GOAL_KICK_MOVE';

  // Guard block — D-04/Pitfall 4: myTeamOrNull === null is an explicit guard, never a
  // silently-coerced default team (mirrors ThrowInSetupPanel/FreeKickSetupPanel).
  if (
    !isGoalKickPhase ||
    goalKickTeam === null ||
    goalKickTeam === undefined ||
    myTeamOrNull === null
  ) {
    return null;
  }

  // Narrowed to 'home' | 'away' by the guard above.
  const myTeam = myTeamOrNull;
  const oppTeam: 'home' | 'away' = goalKickTeam === 'home' ? 'away' : 'home';

  // D-16-01/T-37-71/T-37-72: derived once so all four gameError render sites below stay
  // consistent with one another, instead of calling the helper four times per render.
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

  // Reposition windows: GK's team first (GOAL_KICK_SETUP_GK), then the opponent
  // (GOAL_KICK_SETUP_OPPONENT). The acting team is goalKickTeam for the first window,
  // oppTeam for the second.
  if (phase === 'GOAL_KICK_SETUP_GK' || phase === 'GOAL_KICK_SETUP_OPPONENT') {
    const actingTeam = phase === 'GOAL_KICK_SETUP_GK' ? goalKickTeam : oppTeam;

    if (myTeam !== actingTeam) {
      return (
        <div className={styles.panel}>
          <span className={styles.panelHeading}>Goal Kick</span>
          <span className={styles.constraintRow}>
            {phase === 'GOAL_KICK_SETUP_GK' ? 'Attacking' : 'Defending'} team is
            repositioning&hellip;
          </span>
        </div>
      );
    }

    const eligibleIds =
      (phase === 'GOAL_KICK_SETUP_GK'
        ? goalKickEligibleIds?.gkTeam
        : goalKickEligibleIds?.opponent) ?? [];
    const remaining = eligibleIds.filter(
      (id) => (goalKickUsedPace?.[id] ?? 0) === 0 && !movedPieceIds.includes(id),
    ).length;
    const repositionColorClass = ctaColorClass(
      remaining,
      { ready: styles.ctaButtonReady, pending: styles.ctaButtonPending },
      true,
    );

    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Goal Kick</span>
        <span className={styles.constraintRow}>Goal Kick!</span>
        <span className={styles.constraintRow}>
          {`${remaining} players still eligible to move — up to 6 hexes each.`}
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

  // GOALKICK-03: the goalkeeper's team chooses Kick or Standard Pass.
  if (phase === 'GOAL_KICK_CHOICE') {
    if (myTeam !== goalKickTeam) {
      return (
        <div className={styles.panel}>
          <span className={styles.panelHeading}>Goal Kick</span>
          <span className={styles.constraintRow}>
            Keeper is choosing how to take the goal kick&hellip;
          </span>
        </div>
      );
    }

    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Goal Kick</span>
        <span className={styles.constraintRow}>Goal Kick!</span>
        <span className={styles.constraintRow}>Choose an action.</span>
        <button
          className={styles.ctaButton}
          title="Kick — needs a combined score of 8 or more; an inaccurate kick becomes a Loose Ball"
          onClick={() => emitGoalKickChoice('kick')}
        >
          Kick
        </button>
        <button
          className={styles.ctaButton}
          title="Standard Pass — the unmodified pass, no header requirement"
          onClick={() => emitGoalKickChoice('standard')}
        >
          Standard Pass
        </button>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      </div>
    );
  }

  // GOALKICK-04/05: the goalkeeper's team selects the teammate's head to target.
  if (phase === 'GOAL_KICK_TARGET') {
    if (myTeam !== goalKickTeam) {
      return (
        <div className={styles.panel}>
          <span className={styles.panelHeading}>Goal Kick</span>
          <span className={styles.constraintRow}>Keeper is choosing a kick target&hellip;</span>
        </div>
      );
    }

    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Goal Kick</span>
        <span className={styles.constraintRow}>Goal Kick!</span>
        <span className={styles.constraintRow}>Select a teammate to head the ball.</span>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      </div>
    );
  }

  // GOALKICK-05: the 3-hex travel window — both teams reposition 1 player while the
  // kick is in the air. Only phase remaining after the guard/branches above.
  if (myTeam !== activeTeam) {
    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Goal Kick</span>
        <span className={styles.constraintRow}>
          {activeTeam === goalKickTeam ? 'Attacking' : 'Defending'} team is repositioning&hellip;
        </span>
      </div>
    );
  }

  const travelEligibleRemaining = goalKickMovedPieceId == null ? 1 : 0;
  const travelColorClass = ctaColorClass(
    travelEligibleRemaining,
    { ready: styles.ctaButtonReady, pending: styles.ctaButtonPending },
    true,
  );

  return (
    <div className={styles.panel}>
      <span className={styles.panelHeading}>Goal Kick</span>
      <span className={styles.constraintRow}>Ball in Air!</span>
      <span className={styles.constraintRow}>Move 1 player to receive the ball (max 3 hexes).</span>
      {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      <button
        className={`${styles.ctaButton} ${travelColorClass}`}
        onClick={withEndTurnGuard(travelEligibleRemaining, emitEndTurn)}
      >
        Confirm
      </button>
      {confirmDialog}
    </div>
  );
}
