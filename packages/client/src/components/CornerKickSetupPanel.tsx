import { useState } from 'react';
import { CORNER_KICK_STAGES, cornerKickStageTeam } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { ctaColorClass } from '../utils/ctaColorClass.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';
import styles from './CornerKickSetupPanel.module.css';

/**
 * Corner Kick sidebar panel — covers all five corner-kick phases (CORNER-01/02/03/06):
 * CORNER_KICK_GK_SETUP_ATTACKING, CORNER_KICK_GK_SETUP_DEFENDING, CORNER_KICK_TAKER_SELECT,
 * CORNER_KICK_REPOSITION, CORNER_KICK_FINAL_SETUP, plus the PASS-phase High/Low Pass choice
 * (CORNER-04/05). Structurally mirrors GoalKickSetupPanel.tsx (38-UI-SPEC "Component reuse for
 * this phase"): `.panel` with no border rule, the single-CTA verb lock ("Confirm"), and the
 * verbatim waiting-state phrasing ("{Attacking|Defending} team is repositioning…"). The two
 * reposition windows and the pre-kick window reuse Goal Kick's soft end-turn dialog pattern
 * (withEndTurnGuard/pendingEndTurn) verbatim (CONTEXT.md D-06: follow Goal Kick's Confirm-with-0
 * pattern, not Free Kick's).
 *
 * The PASS-phase High/Low choice reuses the existing STANDARD_PASS/HIGH_PASS pass-type selection
 * path (`setSelectedPassType`) that ActionPanel already drives for every other pass — mirrors the
 * Throw-In precedent (Standard/High Throw-In reuse the same underlying pass types, not new ones).
 *
 * Returns null when phase is none of the five corner phases (and not PASS with cornerKickTeam
 * set), when cornerKickTeam is null/undefined, or when useMyTeam() returns null.
 */
export function CornerKickSetupPanel() {
  const [pendingEndTurn, setPendingEndTurn] = useState<null | {
    action: () => void;
    count: number;
  }>(null);

  const phase = useGameStore((s) => s.gameState.phase);
  const cornerKickTeam = useGameStore((s) => s.gameState.cornerKickTeam);
  const cornerKickStageIndex = useGameStore((s) => s.gameState.cornerKickStageIndex);
  const cornerKickEligibleIds = useGameStore((s) => s.gameState.cornerKickEligibleIds);
  const cornerKickUsedPace = useGameStore((s) => s.gameState.cornerKickUsedPace);
  const cornerKickStagePlacedIds = useGameStore((s) => s.gameState.cornerKickStagePlacedIds);
  const cornerKickMoveSlot = useGameStore((s) => s.gameState.cornerKickMoveSlot);
  const cornerKickMovedPieceId = useGameStore((s) => s.gameState.cornerKickMovedPieceId);
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const gameError = useGameStore((s) => s.gameError);
  const eventLog = useGameStore((s) => s.gameState.eventLog);
  const lastDiceRoll = useGameStore((s) => s.gameState.lastDiceRoll);
  const emitCornerKickTaker = useGameStore((s) => s.emitCornerKickTaker);
  const emitEndTurn = useGameStore((s) => s.emitEndTurn);
  const setSelectedPassType = useGameStore((s) => s.setSelectedPassType);
  const emitUndo = useGameStore((s) => s.emitUndo);
  const myTeamOrNull = useMyTeam();

  const isCornerKickPhase =
    phase === 'CORNER_KICK_GK_SETUP_ATTACKING' ||
    phase === 'CORNER_KICK_GK_SETUP_DEFENDING' ||
    phase === 'CORNER_KICK_TAKER_SELECT' ||
    phase === 'CORNER_KICK_REPOSITION' ||
    phase === 'CORNER_KICK_FINAL_SETUP';
  // CORNER-04/05: the High/Low choice happens in the ordinary PASS phase — cornerKickTeam
  // persists as the signal that this PASS instance is a corner-kick delivery, not lastActionType
  // (mirrors Pitfall 3 in 38-PATTERNS.md: cornerKickTeam survives the intermediate transitions).
  const isCornerKickPassChoice = phase === 'PASS' && cornerKickTeam != null;

  // Guard block — D-04/Pitfall 4: myTeamOrNull === null is an explicit guard, never a
  // silently-coerced default team (mirrors GoalKickSetupPanel/FreeKickSetupPanel).
  if (
    (!isCornerKickPhase && !isCornerKickPassChoice) ||
    cornerKickTeam === null ||
    cornerKickTeam === undefined ||
    myTeamOrNull === null
  ) {
    return null;
  }

  // Narrowed to 'home' | 'away' by the guard above.
  const myTeam = myTeamOrNull;
  const oppTeam: 'home' | 'away' = cornerKickTeam === 'home' ? 'away' : 'home';

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

  // CORNER-01: the two sequential goalkeeper reposition windows — attacking GK first, then
  // defending GK (D-03). Placement is uncapped (Assumption A1) so there is no "N eligible"
  // constraint here, unlike the two budgeted windows below; Confirm is always ready.
  if (phase === 'CORNER_KICK_GK_SETUP_ATTACKING' || phase === 'CORNER_KICK_GK_SETUP_DEFENDING') {
    const actingTeam = phase === 'CORNER_KICK_GK_SETUP_ATTACKING' ? cornerKickTeam : oppTeam;

    if (myTeam !== actingTeam) {
      return (
        <div className={styles.panel}>
          <span className={styles.panelHeading}>Corner Kick</span>
          <span className={styles.constraintRow}>
            {phase === 'CORNER_KICK_GK_SETUP_ATTACKING' ? 'Attacking' : 'Defending'} team is
            repositioning&hellip;
          </span>
        </div>
      );
    }

    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Corner Kick</span>
        <span className={styles.constraintRow}>
          Goalkeeper: choose a new position, then Confirm.
        </span>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
        <button
          className={`${styles.ctaButton} ${styles.ctaButtonReady ?? ''}`}
          onClick={emitEndTurn}
        >
          Confirm
        </button>
      </div>
    );
  }

  // CORNER-02: the kicking manager designates the corner-taker. Destination is server-fixed
  // (cornerKickHex); selection comes from HexGrid's piece-click cascade (38-06).
  if (phase === 'CORNER_KICK_TAKER_SELECT') {
    if (myTeam !== cornerKickTeam) {
      return (
        <div className={styles.panel}>
          <span className={styles.panelHeading}>Corner Kick</span>
          <span className={styles.constraintRow}>
            Attacking team is choosing a corner-taker&hellip;
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
        <span className={styles.panelHeading}>Corner Kick</span>
        <span className={styles.constraintRow}>Choose a player to take the corner kick.</span>
        {selectedPieceId === null && (
          <span className={styles.errorText}>Select a player to take the corner kick first.</span>
        )}
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
        <button
          className={`${styles.ctaButton} ${takerColorClass}`}
          disabled={selectedPieceId === null}
          title={
            selectedPieceId === null ? 'Select a player to take the corner kick first' : undefined
          }
          onClick={() => {
            if (selectedPieceId !== null) emitCornerKickTaker(selectedPieceId);
          }}
        >
          Confirm
        </button>
      </div>
    );
  }

  // CORNER-03 (D-05): 6 alternating attacking/defending stages, strict pairs, up to 2 distinct
  // pieces per stage, each up to 6 hexes (persistent across all 6 stages — cornerKickUsedPace).
  if (phase === 'CORNER_KICK_REPOSITION') {
    const stageIndex = cornerKickStageIndex ?? 0;
    const stage = CORNER_KICK_STAGES[stageIndex];
    const actingTeam = cornerKickStageTeam(stageIndex, cornerKickTeam);
    const sideLabel = stage.side === 'attacking' ? 'Attacking' : 'Defending';

    if (myTeam !== actingTeam) {
      return (
        <div className={styles.panel}>
          <span className={styles.panelHeading}>Corner Kick</span>
          <span className={styles.constraintRow}>{sideLabel} team is repositioning&hellip;</span>
        </div>
      );
    }

    const eligibleIds = cornerKickEligibleIds?.[stage.side] ?? [];
    const stagePlaced = cornerKickStagePlacedIds ?? [];
    const stageFull = stagePlaced.length >= stage.max;
    // The count of pieces the acting manager can still legally move this round: eligible,
    // pace-remaining pieces — restricted to the already-touched set once the round's
    // distinct-piece budget (stage.max) is used up (Task 1 spec).
    const remaining = eligibleIds.filter((id) => {
      const paceOk = (cornerKickUsedPace?.[id] ?? 0) < 6;
      if (!paceOk) return false;
      if (!stageFull) return true;
      return stagePlaced.includes(id);
    }).length;

    const repositionColorClass = ctaColorClass(
      remaining,
      { ready: styles.ctaButtonReady, pending: styles.ctaButtonPending },
      true,
    );

    // UX mirror only — the server's applyUndo (gameEngine.ts) is the sole enforcement layer.
    // Boundary types (CORNER_KICK_STAGE_ADVANCE, CORNER_KICK_TAKER_PLACED) and the scanned
    // move type (MOVE, the phase's default in applyUndo's moveTypeForPhase) must stay in sync
    // with applyUndo's isBoundary reduce for CORNER_KICK_REPOSITION.
    const canUndoReposition = (() => {
      if (lastDiceRoll) return false;
      const lastBoundaryIdx = eventLog.reduce<number>((acc, evt, idx) => {
        const isBoundary =
          evt.type === 'CORNER_KICK_STAGE_ADVANCE' || evt.type === 'CORNER_KICK_TAKER_PLACED';
        return isBoundary ? idx : acc;
      }, -1);
      return eventLog.slice(lastBoundaryIdx + 1).some((e) => e.type === 'MOVE');
    })();

    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Corner Kick</span>
        <span className={styles.constraintRow}>
          {`${remaining} players still eligible to move this round — up to 2, up to 6 hexes each.`}
        </span>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
        <button className={styles.ctaButton} disabled={!canUndoReposition} onClick={emitUndo}>
          Undo
        </button>
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

  // CORNER-06: the 1-player-per-team pre-kick 3-hex travel window, attacking slot first.
  if (phase === 'CORNER_KICK_FINAL_SETUP') {
    const slot = cornerKickMoveSlot ?? 'ATTACKER';
    const actingTeam: 'home' | 'away' = slot === 'ATTACKER' ? cornerKickTeam : oppTeam;
    const sideLabel = slot === 'ATTACKER' ? 'Attacking' : 'Defending';

    if (myTeam !== actingTeam) {
      return (
        <div className={styles.panel}>
          <span className={styles.panelHeading}>Corner Kick</span>
          <span className={styles.constraintRow}>{sideLabel} team is repositioning&hellip;</span>
        </div>
      );
    }

    const remaining = cornerKickMovedPieceId == null ? 1 : 0;
    const finalColorClass = ctaColorClass(
      remaining,
      { ready: styles.ctaButtonReady, pending: styles.ctaButtonPending },
      true,
    );

    // UX mirror only — the server's applyUndo (gameEngine.ts) is the sole enforcement layer.
    // Boundary type (CORNER_KICK_STAGE_ADVANCE) and the scanned move type (CORNER_KICK_MOVE)
    // must stay in sync with applyUndo's isBoundary reduce and moveTypeForPhase for
    // CORNER_KICK_FINAL_SETUP.
    const canUndoFinalSetup = (() => {
      if (lastDiceRoll) return false;
      const lastBoundaryIdx = eventLog.reduce<number>((acc, evt, idx) => {
        const isBoundary = evt.type === 'CORNER_KICK_STAGE_ADVANCE';
        return isBoundary ? idx : acc;
      }, -1);
      return eventLog.slice(lastBoundaryIdx + 1).some((e) => e.type === 'CORNER_KICK_MOVE');
    })();

    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Corner Kick</span>
        <span className={styles.constraintRow}>Reposition 1 player — up to 3 hexes.</span>
        {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
        <button className={styles.ctaButton} disabled={!canUndoFinalSetup} onClick={emitUndo}>
          Undo
        </button>
        <button
          className={`${styles.ctaButton} ${finalColorClass}`}
          onClick={withEndTurnGuard(remaining, emitEndTurn)}
        >
          Confirm
        </button>
        {confirmDialog}
      </div>
    );
  }

  // CORNER-04/05: the PASS-phase High/Low Pass choice — only reachable branch remaining.
  if (myTeam !== cornerKickTeam) {
    return (
      <div className={styles.panel}>
        <span className={styles.panelHeading}>Corner Kick</span>
        <span className={styles.constraintRow}>Attacking team is choosing a pass type&hellip;</span>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <span className={styles.panelHeading}>Corner Kick</span>
      <span className={styles.constraintRow}>Choose High Pass or Low Pass.</span>
      {humanisedError && <span className={styles.errorText}>{humanisedError}</span>}
      <button
        className={styles.ctaButton}
        title="High Pass — any hex in the penalty area with no distance limit, elsewhere up to 15 hexes; needs a combined score of 8 or more; receiver must attempt a header"
        onClick={() => setSelectedPassType('HIGH_PASS')}
      >
        High Pass
      </button>
      <button
        className={styles.ctaButton}
        title="Low Pass — needs a combined score of 8 or more; no header required"
        onClick={() => setSelectedPassType('STANDARD_PASS')}
      >
        Low Pass
      </button>
    </div>
  );
}
