import { useEffect } from 'react';
import { ELIGIBLE_NEXT_ACTIONS, hexDistance, isInRegion } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import type { PassType } from '../store/useGameStore.js';
import styles from './ActionPanel.module.css';

const PASS_TYPE_LABELS: Record<PassType, string> = {
  STANDARD_PASS: 'Standard Pass',
  FIRST_TIME_PASS: 'First-time Pass',
  HIGH_PASS: 'High Pass',
  LONG_BALL: 'Long Ball',
};

/** Goal line r-values shared between Shoot two-step and GK_DIVING/SNAP_DEFLECT wait panels. */
const GOAL_R_VALUES = [10, 11, 12, 13, 14, 15, 16];

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
  // Phase 10: shooting mode (two-step Shoot flow)
  const shootingMode = useGameStore((s) => s.shootingMode);
  const setShootingMode = useGameStore((s) => s.setShootingMode);
  const movedPieceIds = useGameStore((s) => s.gameState.movedPieceIds);

  const myTeam: 'home' | 'away' | null =
    playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
  const isActivePlayer = myTeam !== null && myTeam === activeTeam;

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

  // -------------------------------------------------------------------------
  // HIGH_PASS_MOVEMENT phase: both teams reposition 1 player up to 3 hexes before accuracy roll.
  // Must be before the isActivePlayer guard — both teams act in this phase.
  // -------------------------------------------------------------------------
  if (phase === 'HIGH_PASS_MOVEMENT') {
    if (myTeam === null) return null;
    // activeTeam switches between attackingTeam (ATTACKER slot) and defenderTeam (DEFENDER slot)
    // so isActivePlayer correctly reflects whose turn it is in this phase
    if (!isActivePlayer) {
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>Opponent is repositioning — wait...</span>
        </div>
      );
    }
    return (
      <div className={styles.panel}>
        <span className={styles.phaseLabel}>
          Reposition a player for the header (up to 3 hexes)
        </span>
        <button className={styles.ctaButton} onClick={emitEndTurn}>
          End Turn
        </button>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // GK_DIVING phase: GK clicks a highlighted hex on the shot path (0–3 hexes away).
  // Clicking triggers the dive and the shot auto-resolves immediately — no End Turn needed.
  // Must be before the isActivePlayer guard — both teams see this phase.
  // -------------------------------------------------------------------------
  if (phase === 'GK_DIVING') {
    if (myTeam === null) return null;
    const gkTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
    const isGKTeamPlayer = myTeam === gkTeam;
    if (!isGKTeamPlayer) {
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>Opponent is positioning GK — wait...</span>
        </div>
      );
    }
    return (
      <div className={styles.panel}>
        <span className={styles.phaseLabel}>
          Click a highlighted hex to dive (0–3 hexes along the shot path)
        </span>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // SNAP_DEFLECT phase: defending team moves 1 player up to 2 hexes before
  // snapshot resolves.
  // Must be before the isActivePlayer guard — both teams see this phase.
  // Active team = defending team (opponent of attackingTeam).
  // -------------------------------------------------------------------------
  if (phase === 'SNAP_DEFLECT') {
    if (myTeam === null) return null;
    const defendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
    const isDefendingTeamPlayer = myTeam === defendingTeam;
    if (!isDefendingTeamPlayer) {
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>Opponent is deflecting — wait...</span>
        </div>
      );
    }
    return (
      <div className={styles.panel}>
        <span className={styles.phaseLabel}>
          Move a player to deflect the snapshot (up to 2 hexes)
        </span>
        <button className={styles.ctaButton} onClick={emitEndTurn}>
          End Turn
        </button>
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

    // RULE-01: gate contestant selection behind accuracy roll acknowledgment
    if (headerAccuracyRollPending ?? false) {
      const rollValue = lastDiceRoll?.rolls[0] ?? '?';
      if (isActivePlayer && myTeam === attackingTeam) {
        return (
          <div className={styles.panel}>
            <span className={styles.phaseLabel}>
              High Pass accuracy roll: {rollValue} — accurate! Click to continue.
            </span>
            <button className={styles.ctaButton} onClick={() => emitHeaderAccuracyAck()}>
              Continue
            </button>
            {gameError && <span className={styles.errorText}>{gameError}</span>}
          </div>
        );
      }
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>
            High Pass accuracy roll: {rollValue} — waiting for attacker...
          </span>
        </div>
      );
    }

    const myConfirmed = headerConfirmed?.[myTeam] ?? false;
    const bothConfirmed = (headerConfirmed?.home ?? false) && (headerConfirmed?.away ?? false);

    // HEAD-03: after both teams confirm, attacker clicks a target hex (handled in HexGrid).
    // Only the attacker sees the "click target" prompt; defender waits.
    // D-19 (WR-04): No Roll Header or Header button here — auto-confirm fires the duel once
    // headerTargetHex is set (server side). Single resolution route only.
    if (bothConfirmed) {
      if (isActivePlayer && myTeam === attackingTeam) {
        return (
          <div className={styles.panel}>
            <span className={styles.phaseLabel}>Click a target hex for the header</span>
            {gameError && <span className={styles.errorText}>{gameError}</span>}
          </div>
        );
      }
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>Waiting for attacker to select target...</span>
          {gameError && <span className={styles.errorText}>{gameError}</span>}
        </div>
      );
    }

    return (
      <div className={styles.panel}>
        {!myConfirmed && (
          <>
            <span className={styles.phaseLabel}>
              Select contestant(s) within 2 hexes ({headerContestantIds.length} selected)
            </span>
            <button
              className={styles.ctaButton}
              onClick={() => emitHeaderContestant(headerContestantIds)}
            >
              {headerContestantIds.length > 0 ? 'Confirm Selection' : 'Decline (no contestant)'}
            </button>
          </>
        )}
        {myConfirmed && <span className={styles.phaseLabel}>Waiting for opponent...</span>}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // SHOT_DECLARED — snapshot target selection: attacker clicks a goal hex.
  // Must be before the isActivePlayer gate so defender also gets a waiting panel.
  // -------------------------------------------------------------------------
  if (phase === 'SHOT_DECLARED') {
    if (myTeam === null) return null;
    if (!isActivePlayer) {
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>Opponent is aiming — wait...</span>
        </div>
      );
    }
    return (
      <div className={styles.panel}>
        <span className={styles.phaseLabel}>Snapshot! Click a goal hex to target</span>
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
    if (!isGKTeamPlayer) {
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>Opponent GK restart — wait...</span>
        </div>
      );
    }
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

  // QUICK_THROW phase: GK's team selects a target hex on the pitch (≤ 11 hexes).
  // Same guard structure as GK_RESTART — must be before isActivePlayer check.
  if (phase === 'QUICK_THROW') {
    if (myTeam === null) return null;
    const gkPiece = pieces.find((p) => p.id === carrierId);
    const gkTeam = gkPiece?.teamId ?? null;
    const isGKTeamPlayer = myTeam === gkTeam;
    if (!isGKTeamPlayer) {
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>Opponent GK quick throw — wait...</span>
        </div>
      );
    }
    return (
      <div className={styles.panel}>
        <span className={styles.gkLabel}>Quick Throw — select target hex</span>
        <span className={styles.phaseLabel}>Up to 11 hexes · no interception</span>
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
    if (!isGKTeamPlayer) {
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>Opponent GK kick — wait for target selection...</span>
        </div>
      );
    }
    return (
      <div className={styles.panel}>
        <span className={styles.gkLabel}>GK Kick — select target hex</span>
        <span className={styles.phaseLabel}>
          Any pitch hex except the opponent&apos;s final third
        </span>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  // GK_KICK_MOVEMENT phase: both teams reposition 1 player up to 3 hexes while ball is in air.
  // Must be before isActivePlayer guard — both teams act in this phase.
  if (phase === 'GK_KICK_MOVEMENT') {
    if (myTeam === null) return null;
    if (!isActivePlayer) {
      return (
        <div className={styles.panel}>
          <span className={styles.phaseLabel}>Opponent is repositioning — wait...</span>
        </div>
      );
    }
    return (
      <div className={styles.panel}>
        <span className={styles.phaseLabel}>
          Reposition a player while kick is in air (up to 3 hexes)
        </span>
        <button className={styles.ctaButton} onClick={emitEndTurn}>
          End Turn
        </button>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </div>
    );
  }

  if (!isActivePlayer) return null;

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
          <span className={styles.phaseLabel}>Ball is loose — move to collect</span>
          <button className={styles.ctaButton} onClick={emitStartMovement}>
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

          {(() => {
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
            return (
              <>
                {/* D-18 (WR-03): Snapshot — carrier must be in opponent's penalty area (mirrors MOVEMENT phase check) */}
                {lastActionType !== null && isEligible('SNAPSHOT') && carrierInPenaltyArea && (
                  <button className={styles.ctaButton} onClick={emitSnapshot}>
                    Snapshot
                  </button>
                )}
                {/* Two-step Shoot flow (D-01): Step 1 — click Shoot sets shootingMode=true.
                    Step 2 — HexGrid highlights goal hexes; clicking one emits emitDeclareShot. */}
                {eligible.has('SHOT') && dist <= 11 && (
                  <button
                    className={styles.ctaButton}
                    onClick={() => setShootingMode(true)}
                    disabled={shootingMode}
                  >
                    {shootingMode ? 'Select goal hex...' : 'Shoot'}
                  </button>
                )}
                {shootingMode && (
                  <button className={styles.backButton} onClick={() => setShootingMode(false)}>
                    ← Cancel Shot
                  </button>
                )}
              </>
            );
          })()}

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
  // MOVEMENT phase
  // -------------------------------------------------------------------------
  if (phase === 'MOVEMENT') {
    const carrier = pieces.find((p) => p.id === carrierId);
    const penaltyAreaRegion = attackingTeam === 'home' ? 'awayPenaltyArea' : 'homePenaltyArea';
    // Snapshot only for the attacking team (not defense in DEFENDER_5 slot) and only while
    // the ball carrier has not yet exhausted their movement (not in movedPieceIds).
    const canSnapshot =
      carrier !== undefined &&
      myTeam !== null &&
      carrier.teamId === myTeam &&
      isInRegion(carrier.position, penaltyAreaRegion) &&
      carrierId !== null &&
      !movedPieceIds.includes(carrierId);

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
        {/* D-10: Snapshot wired to emitSnapshot in MOVEMENT phase (was permanently disabled) */}
        {canSnapshot && (
          <button className={styles.ctaButton} onClick={emitSnapshot}>
            Snapshot
          </button>
        )}
        <button className={styles.ctaButton} disabled={!canUndo} onClick={emitUndo}>
          Undo
        </button>
        <button className={styles.ctaButton} onClick={emitEndTurn}>
          End Turn
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
