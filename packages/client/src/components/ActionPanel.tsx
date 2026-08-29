import { useEffect, useState, type ReactNode } from 'react';
import {
  ELIGIBLE_NEXT_ACTIONS,
  GOAL_R_VALUES,
  hexDistance,
  isInRegion,
} from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import type { PassType } from '../store/useGameStore.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { ctaColorClass } from '../utils/ctaColorClass.js';
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
  'Punt (High Pass)': 'Keeper clears with a long kick.',
  'Quick Throw': 'Keeper throws the ball back into play.',
  Undo: 'Undo your last move this phase.',
  Confirm: 'Confirm your actions and end your turn, passing control to the opponent.',
  // THROWIN-04 (Phase 37): throw-in step-choice labels — same underlying mechanic as
  // Standard/High Pass, distinct copy only.
  'Standard Throw-In': 'Throw the ball in low, up to 6 hexes; may be intercepted.',
  'High Throw-In': 'Throw the ball in high, up to 6 hexes; the receiver must attempt a header.',
};

// GOAL_R_VALUES imported from @counter-attack/shared — single source of truth for goal row positions

/**
 * D-02/D-06: CTA button color-state selector (mirrors GameBoard's statBubbleClass pattern).
 * Returns .ctaButtonReady (green) when all eligible pieces have moved/placed,
 * .ctaButtonPending (orange) while any eligible piece remains unmoved. The
 * color-state logic itself now lives in `packages/client/src/utils/ctaColorClass.ts`
 * — this is a thin module-local adapter that names ActionPanel's own CSS-module
 * class names exactly once so call sites stay terse.
 */
const ctaClass = (eligibleRemaining: number): string =>
  ctaColorClass(eligibleRemaining, {
    ready: styles.ctaButtonReady,
    pending: styles.ctaButtonPending,
  });

/**
 * D-07: static heading shown atop every ActionPanel render site via `PanelShell`. A static
 * 'Actions' label (rather than a phase-derived one) is used because each phase block already
 * carries its own contextual title in `helperLine1` (`Move!`, `Attempt Save!`, `Kick-Off!`, …)
 * — a phase-derived heading would duplicate that line, whereas 'Actions' reads naturally above
 * all of the roughly fifteen phase states and gives the panel the same heading-then-content
 * structure its three GameBoard slot siblings (`KickOffSetupPanel`, `FreeKickSetupPanel`,
 * `ReplayPanel`) already have.
 */
const ACTION_PANEL_HEADING = 'Actions';

/**
 * D-07: wraps every ActionPanel render site so the `Actions` heading can never be omitted
 * from any of the panel's 18 phase-gated returns. Renders the same panel flex container
 * class as before (plus the wide modifier class when `wide` is true) with the heading as
 * its first child, followed by the phase's own content. Preserves the pre-existing
 * className composition exactly: a non-wide shell yields exactly the bare panel class
 * (no stray trailing space), matching every prior render site's original class output.
 *
 * Does NOT wrap `confirmOverlay`/`confirmCard` — the confirm dialog is a modal, not a slot
 * panel, and must not gain an "Actions" heading (see `confirmDialog` below, left untouched).
 */
function PanelShell({ wide = false, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <div className={`${styles.panel}${wide ? ` ${styles.wide}` : ''}`}>
      <span className={styles.panelHeading}>{ACTION_PANEL_HEADING}</span>
      {children}
    </div>
  );
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
  // 260621-ajd: remaining-player countdown for FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE
  const freeMoveEligibleIds = useGameStore((s) => s.gameState.freeMoveEligibleIds);
  const freeMoveUsedPace = useGameStore((s) => s.gameState.freeMoveUsedPace);
  // UX-08: per-phase repositioning tracking fields for eligibleRemaining derivation
  const highPassMovedPieceId = useGameStore((s) => s.gameState.highPassMovedPieceId);
  const firstTimePassMovedPieceId = useGameStore((s) => s.gameState.firstTimePassMovedPieceId);
  const gkKickMovedPieceId = useGameStore((s) => s.gameState.gkKickMovedPieceId);
  const snapDeflectMovedPieceId = useGameStore((s) => s.gameState.snapDeflectMovedPieceId);

  const myTeam = useMyTeam();
  const isActivePlayer = myTeam !== null && myTeam === activeTeam;
  // D-09: derives correctly only where the guard is !isActivePlayer — see waitingPanel call
  // sites below for the keeper/defender-gated blocks that use an explicitly-named actor instead.
  const actingSideLabel: 'Attacking' | 'Defending' =
    activeTeam === attackingTeam ? 'Attacking' : 'Defending';

  /** D-09: shared two-line waiting markup — used by waitingPanel and HEADER's myConfirmed branch. */
  const waitingHelperBlock = (detail: string) => (
    <div className={styles.helperBlock}>
      <span className={styles.helperLine1}>Opponent&apos;s Turn</span>
      <span className={styles.helperLine2}>{detail}</span>
    </div>
  );

  function waitingPanel(detail: string) {
    return <PanelShell>{waitingHelperBlock(detail)}</PanelShell>;
  }

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
              Yes, end turn
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
  // Mirrors applyUndo's boundary logic (SLOT_ADVANCE | KICK_OFF | HP_REPOSITION in HIGH_PASS_MOVE
  // | TACKLE_ATTEMPT | STEAL_ATTEMPT). BUG-37 (Phase 36) / D-13: a resolved TACKLE_ATTEMPT or
  // STEAL_ATTEMPT is also a boundary — UX mirror only, the server's applyUndo is the sole
  // enforcement layer for this clamp.
  //
  // Phase 39 (39-17): this mirror MUST stay in sync, term for term, with applyUndo's
  // isBoundary reduce in gameEngine.ts — this is the exact defect class that shipped twice
  // already (BUG-30/31, BUG-37; see STATE.md Pitfalls). Six new terms were added by
  // Plans 39-07/39-10/39-12/39-14:
  //   - `evt.type === 'GK_DIVE_AT_FEET'` (unconditional — a resolved dive-at-feet duel is a
  //     committed dice outcome, exactly like TACKLE_ATTEMPT/STEAL_ATTEMPT above)
  //   - `state.phase === 'FOUL_CHOICE' && evt.type === 'FOUL_CHOICE_MADE'`
  //   - `(state.phase === 'PENALTY_KICK_SETUP_ATTACKING' ||
  //      state.phase === 'PENALTY_KICK_SETUP_DEFENDING') &&
  //      evt.type === 'PENALTY_KICK_WINDOW_ADVANCE'`
  //   - `state.phase === 'PENALTY_KICK_TAKER_SELECT' && evt.type === 'PENALTY_KICK_TAKER_PLACED'`
  //   - `state.phase === 'GK_BOX_ENTRY_MOVE' && evt.type === 'GK_BOX_ENTRY_MOVE'`
  //   - `state.phase === 'HALF_TIME' && evt.type === 'SECOND_HALF_CONFIRM'`
  // Phase 40 (40-01): a seventh term was added — `evt.type === 'SUBSTITUTION'`
  // (unconditional, no phase guard) — a substitution is a committed roster change that
  // Undo must never cross, exactly like GK_DIVE_AT_FEET above.
  // Phase 42 (42-09): an eighth term — `evt.type === 'ROSTER_REPOSITION'` (unconditional,
  // directly beside SUBSTITUTION) — a roster reposition is a committed roster change
  // reaching the server exactly like a substitution. This MUST stay in sync, term for
  // term, with applyUndo's isBoundary reduce in gameEngine.ts (registered in 42-06);
  // omitting it is the exact defect class that shipped twice already (BUG-30/31, BUG-37;
  // see STATE.md Pitfalls) — it would make the client offer an Undo the server refuses.
  // FOUL_CHOICE, PENALTY_KICK_SETUP_ATTACKING/DEFENDING, PENALTY_KICK_TAKER_SELECT and
  // GK_BOX_ENTRY_MOVE are each rendered by their own dedicated GameBoard panel (FoulChoicePanel,
  // PenaltyKickSetupPanel, GkBoxEntryPromptPanel) rather than by ActionPanel, so those four
  // phase-guarded terms are currently unreachable here — no Undo control is ever offered in
  // those phases (see ActionPanel.test.tsx "Phase 39 boundary mirror" describe block). They are
  // still reproduced verbatim so the mirror is exhaustive and does not silently drift if
  // ActionPanel is ever extended to those phases. HALF_TIME does fall through to ActionPanel's
  // final `return null` — reachable, but currently renders no Undo affordance either.
  // TACKLE-02 (Phase 43, 43-02): this mirror needs NO new term for TACKLE_STEAL_DECLINED —
  // it is deliberately omitted here because it is omitted from applyUndo's isBoundary
  // reduce (gameEngine.ts, 43-02 Task 1): a decline commits no dice outcome and must
  // remain crossable by Undo. TACKLE_STEAL_PROMPT itself is rendered by its own dedicated
  // panel rather than by ActionPanel, so no Undo affordance is ever offered during the
  // prompt — same reasoning as the four phases named above.
  const canUndo = (() => {
    if (lastDiceRoll) return false;
    // Bug-C (Phase 25 gap 25-07): canUndo must be false at the start of a MOVE slot when
    // no moves have been committed yet. The event-log boundary approach (SLOT_ADVANCE / KICK_OFF)
    // does not bound the start of every new MOVE phase (no boundary event exists between Team A's
    // turn end and Team B's next MOVE phase start), so without this guard the button mistakenly
    // shows as enabled, pointing at stale MOVE events from the previous team's turn.
    // paceUsedByPieceId resets at each slot boundary (server-side), so an empty map means
    // no moves have been committed in the current slot — Undo is impossible.
    if (
      (phase === 'MOVE' || phase === 'FREE_MOVE_ATTACK' || phase === 'FREE_MOVE_DEFENSE') &&
      Object.keys(paceUsedByPieceId).length === 0
    )
      return false;
    const lastBoundaryIdx = eventLog.reduce<number>((acc, evt, idx) => {
      const isBoundary =
        evt.type === 'SLOT_ADVANCE' ||
        evt.type === 'KICK_OFF' ||
        evt.type === 'TACKLE_ATTEMPT' ||
        evt.type === 'STEAL_ATTEMPT' ||
        (phase === 'HIGH_PASS_MOVE' && evt.type === 'HP_REPOSITION') ||
        (phase === 'FIRST_TIME_PASS_MOVE' && evt.type === 'FTP_REPOSITION') ||
        // Phase 39 (39-17): see the comment block above `canUndo` for the full term-for-term
        // rationale against applyUndo's isBoundary reduce.
        (phase === 'FOUL_CHOICE' && evt.type === 'FOUL_CHOICE_MADE') ||
        evt.type === 'GK_DIVE_AT_FEET' ||
        ((phase === 'PENALTY_KICK_SETUP_ATTACKING' || phase === 'PENALTY_KICK_SETUP_DEFENDING') &&
          evt.type === 'PENALTY_KICK_WINDOW_ADVANCE') ||
        (phase === 'PENALTY_KICK_TAKER_SELECT' && evt.type === 'PENALTY_KICK_TAKER_PLACED') ||
        (phase === 'GK_BOX_ENTRY_MOVE' && evt.type === 'GK_BOX_ENTRY_MOVE') ||
        (phase === 'HALF_TIME' && evt.type === 'SECOND_HALF_CONFIRM') ||
        // Phase 40 (40-01): a substitution is a committed roster change — Undo must
        // never cross it, unconditionally, matching applyUndo's isBoundary reduce.
        evt.type === 'SUBSTITUTION' ||
        // Phase 42 (42-09): eighth term, beside SUBSTITUTION — must stay in sync with
        // applyUndo's isBoundary reduce (gameEngine.ts, 42-06); the shipped-twice defect.
        evt.type === 'ROSTER_REPOSITION';
      return isBoundary ? idx : acc;
    }, -1);
    // CR-01 (17.1-11): mirror applyUndo's phase-aware move-type mapping — gameHandlers.ts
    // emits HP_MOVE during HIGH_PASS_MOVE and FTP_MOVE during FIRST_TIME_PASS_MOVE, never MOVE.
    // BUG-18 (Phase 18.3): extended to match the server's expanded validUndoPhases.
    // Phase 39 (39-17): GK_BOX_ENTRY_MOVE emits its own event type (never MOVE) — mapped here
    // for exhaustiveness, matching the pattern the server would use were GK_BOX_ENTRY_MOVE ever
    // reachable from applyUndo (it isn't, today — see the comment above `canUndo`). The penalty
    // reposition phases (PENALTY_KICK_SETUP_ATTACKING/DEFENDING) deliberately stay on the
    // default 'MOVE' branch below — applyPenaltyKickReposition emits plain MOVE events, exactly
    // like the server's own moveTypeForPhase comment confirms.
    const moveTypeForPhase =
      phase === 'HIGH_PASS_MOVE'
        ? 'HP_MOVE'
        : phase === 'FIRST_TIME_PASS_MOVE'
          ? 'FTP_MOVE'
          : phase === 'GK_KICK_MOVE'
            ? 'GK_KICK_MOVE'
            : phase === 'SNAPSHOT_DEFLECT'
              ? 'SNAP_DEFLECT_MOVE'
              : phase === 'GK_BOX_ENTRY_MOVE'
                ? 'GK_BOX_ENTRY_MOVE'
                : 'MOVE'; // covers MOVE, FREE_MOVE_ATTACK, FREE_MOVE_DEFENSE, PENALTY_KICK_SETUP_*
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
    if (!isActivePlayer) return waitingPanel(`${actingSideLabel} team is repositioning…`);
    // UX-08: 1 repositioning slot per team — pending until highPassMovedPieceId is set
    const hpmEligibleRemaining = highPassMovedPieceId == null ? 1 : 0;
    return (
      <PanelShell>
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
          className={`${styles.ctaButton} ${ctaClass(hpmEligibleRemaining)}`}
          title={ACTION_SUMMARY['Confirm']}
          onClick={withEndTurnConfirm(hpmEligibleRemaining, emitEndTurn)}
        >
          Confirm
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
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
    if (!isActivePlayer) return waitingPanel(`${actingSideLabel} team is repositioning…`);
    // UX-08: 1 repositioning slot per team — pending until firstTimePassMovedPieceId is set
    const ftpmEligibleRemaining = firstTimePassMovedPieceId == null ? 1 : 0;
    return (
      <PanelShell>
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
          className={`${styles.ctaButton} ${ctaClass(ftpmEligibleRemaining)}`}
          title={ACTION_SUMMARY['Confirm']}
          onClick={withEndTurnConfirm(ftpmEligibleRemaining, emitEndTurn)}
        >
          Confirm
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
    );
  }

  // -------------------------------------------------------------------------
  // GK_DIVE phase: GK clicks a highlighted hex on the shot path (0–3 hexes away).
  // Clicking triggers the dive and the shot auto-resolves immediately — no Confirm needed.
  // Must be before the isActivePlayer guard — both teams see this phase.
  // -------------------------------------------------------------------------
  if (phase === 'GK_DIVE') {
    if (myTeam === null) return null;
    const gkTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
    const isGKTeamPlayer = myTeam === gkTeam;
    if (!isGKTeamPlayer) return waitingPanel('Keeper is diving to attempt a save…');
    return (
      <PanelShell>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Attempt Save!</span>
          <span className={styles.helperLine2}>Dive to a highlighted hex (max 3 hexes).</span>
        </div>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
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
    if (!isDefendingTeamPlayer)
      return waitingPanel('Defending team is moving to deflect the shot…');
    // UX-08: 1 repositioning slot — pending until snapDeflectMovedPieceId is set
    const sdEligibleRemaining = snapDeflectMovedPieceId == null ? 1 : 0;
    return (
      <PanelShell>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Snapshot — Deflection Attempt!</span>
          <span className={styles.helperLine2}>
            Move 1 player to deflect the shot (up to 2 hexes).
          </span>
        </div>
        <button
          className={`${styles.ctaButton} ${ctaClass(sdEligibleRemaining)}`}
          title={ACTION_SUMMARY['Confirm']}
          onClick={withEndTurnConfirm(sdEligibleRemaining, emitEndTurn)}
        >
          Confirm
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
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
      return waitingPanel('Resolving the aerial challenge…');
    }

    const myConfirmed = headerConfirmed?.[myTeam] ?? false;
    const bothConfirmed = (headerConfirmed?.home ?? false) && (headerConfirmed?.away ?? false);

    if (bothConfirmed) {
      // Duel resolved — winner selects target hex; loser/tie waits.
      if (headerDuelWinner != null && headerDuelWinner === myTeam) {
        return (
          <PanelShell>
            <div className={styles.helperBlock}>
              <span className={styles.helperLine1}>Header Won!</span>
              <span className={styles.helperLine2}>Select a target hex.</span>
            </div>
            {gameError && <span className={styles.errorText}>{gameError}</span>}
          </PanelShell>
        );
      }
      return waitingPanel(
        headerDuelWinner != null
          ? `${headerDuelWinner === attackingTeam ? 'Attacking' : 'Defending'} team is selecting a target…`
          : 'Header tied — resolving the loose ball…',
      );
    }

    return (
      <PanelShell>
        {!myConfirmed && (
          <>
            <div className={styles.helperBlock}>
              <span className={styles.helperLine1}>Contest Header!</span>
              <span className={styles.helperLine2}>
                {headerContestantIds.length} players selected within range.
              </span>
            </div>
            {/* UX-08/D-08: eligibleRemaining = 1 while no contestant selected (player has not
                 acted yet); 0 once a contestant is chosen. Confirm has no dialog (already
                 green/ready); Decline (no contestant) triggers the dialog as it could be
                 accidental. D-08 collapses the old longer positive-branch label into the
                 single canonical 'Confirm' verb used by every other confirm-and-advance CTA
                 in this panel. */}
            {(() => {
              const headerEligibleRemaining = headerContestantIds.length > 0 ? 0 : 1;
              return (
                <button
                  className={`${styles.ctaButton} ${ctaClass(headerEligibleRemaining)}`}
                  onClick={withEndTurnConfirm(headerEligibleRemaining, () =>
                    emitHeaderContestant(headerContestantIds),
                  )}
                >
                  {headerContestantIds.length > 0 ? 'Confirm' : 'Decline (no contestant)'}
                </button>
              );
            })()}
          </>
        )}
        {myConfirmed && waitingHelperBlock('Waiting for the opponent to confirm their contestant…')}
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
    );
  }

  // -------------------------------------------------------------------------
  // SNAPSHOT_TARGET — snapshot target selection: attacker clicks a goal hex.
  // Must be before the isActivePlayer gate so defender also gets a waiting panel.
  // -------------------------------------------------------------------------
  if (phase === 'SNAPSHOT_TARGET') {
    if (myTeam === null) return null;
    if (!isActivePlayer) return waitingPanel('Attacking team is selecting a goal hex…');
    return (
      <PanelShell>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Snapshot!</span>
          <span className={styles.helperLine2}>Select a goal hex to target.</span>
        </div>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
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
    if (!isGKTeamPlayer) return waitingPanel('Keeper is choosing how to restart play…');
    return (
      <PanelShell>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Keeper Restart!</span>
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
      </PanelShell>
    );
  }

  // GK_QUICK_THROW phase: GK's team selects a target hex on the pitch (≤ 11 hexes).
  // Same guard structure as GK_RESTART — must be before isActivePlayer check.
  if (phase === 'GK_QUICK_THROW') {
    if (myTeam === null) return null;
    const gkPiece = pieces.find((p) => p.id === carrierId);
    const gkTeam = gkPiece?.teamId ?? null;
    const isGKTeamPlayer = myTeam === gkTeam;
    if (!isGKTeamPlayer) return waitingPanel('Keeper is choosing a throw target…');
    return (
      <PanelShell>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Quick Throw!</span>
          <span className={styles.helperLine2}>Select a target hex (up to 11 hexes).</span>
        </div>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
    );
  }

  // GK_KICK_TARGET phase: GK's team clicks a target hex on the pitch.
  // Must be before isActivePlayer guard — both teams see this phase.
  if (phase === 'GK_KICK_TARGET') {
    if (myTeam === null) return null;
    const gkPiece = pieces.find((p) => p.id === carrierId);
    const gkTeam = gkPiece?.teamId ?? null;
    const isGKTeamPlayer = myTeam === gkTeam;
    if (!isGKTeamPlayer) return waitingPanel('Keeper is choosing a punt target…');
    return (
      <PanelShell>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Punt!</span>
          <span className={styles.helperLine2}>
            Target anywhere except the opponent&apos;s final third.
          </span>
        </div>
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
    );
  }

  // GK_KICK_MOVE phase: both teams reposition 1 player up to 3 hexes while ball is in air.
  // Must be before isActivePlayer guard — both teams act in this phase.
  if (phase === 'GK_KICK_MOVE') {
    if (myTeam === null) return null;
    if (!isActivePlayer) return waitingPanel(`${actingSideLabel} team is repositioning…`);
    // UX-08: 1 repositioning slot per team — pending until gkKickMovedPieceId is set
    const gkmEligibleRemaining = gkKickMovedPieceId == null ? 1 : 0;
    return (
      <PanelShell>
        <div className={styles.helperBlock}>
          <span className={styles.helperLine1}>Ball in Air!</span>
          <span className={styles.helperLine2}>
            Move 1 player to receive the ball (max 3 hexes).
          </span>
        </div>
        <button
          className={`${styles.ctaButton} ${ctaClass(gkmEligibleRemaining)}`}
          title={ACTION_SUMMARY['Confirm']}
          onClick={withEndTurnConfirm(gkmEligibleRemaining, emitEndTurn)}
        >
          Confirm
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
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
    if (!isActivePlayer) return waitingPanel(`${actingSideLabel} team is repositioning…`);
    // 260621-ajd: countdown of players left to move in the active free-move sub-phase.
    const freeMoveSide = phase === 'FREE_MOVE_ATTACK' ? 'attack' : 'defense';
    const eligibleIds = freeMoveEligibleIds?.[freeMoveSide] ?? [];
    const eligibleTotal = eligibleIds.length;
    const movedCount = eligibleIds.filter((id) => (freeMoveUsedPace?.[id] ?? 0) > 0).length;
    const remaining = Math.max(eligibleTotal - movedCount, 0);
    return (
      <PanelShell>
        <div className={styles.helperBlock}>
          {/* Deviation (checkpoint 45-05-04 fix, developer-reported bug): the
              prior "Position for Kick!" text combined with the "Actions"
              PanelShell heading directly above it to read as the mangled
              phrase "Actions Position for Kick!" — it also had nothing to
              do with a kick at all (this is the final-third free-move
              phase, not a restart). Renamed to match this file's existing
              short-noun-phrase-plus-exclamation convention (Move!, Loose
              Ball!, Quick Throw!, …) and GameBoard.tsx's own "FREE MOVE"
              phase-label wording.
              Phase 46 / CLEANUP-08: the resulting "Free Move!" heading still
              gave the player no indication of what triggered this phase,
              unlike every restart panel whose heading names the restart by
              definition (e.g. "Goal Kick", "Corner Kick"). Renamed again below
              to name the actual trigger — the ball entering a final third —
              per 46-UI-SPEC.md's Copywriting Contract. */}
          <span className={styles.helperLine1}>Final-Third Movement!</span>
          <span className={styles.helperLine2}>
            {`${remaining} players still eligible to move — up to 6 hexes each, regardless of remaining pace.`}
          </span>
        </div>
        <button
          className={`${styles.ctaButton} ${ctaClass(remaining)}`}
          title={ACTION_SUMMARY['Confirm']}
          onClick={withEndTurnConfirm(remaining, emitEndTurn)}
        >
          Confirm
        </button>
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
    );
  }

  if (!isActivePlayer) return waitingPanel(`${actingSideLabel} team is taking their turn…`);

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
        <PanelShell>
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
        </PanelShell>
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
      // THROWIN-04 (Phase 37/D-09): post-Movement-Phase throw-in step choice. Label-level
      // only — ELIGIBLE_NEXT_ACTIONS' THROW_IN_MOVEMENT_1/2 rows already control which
      // buttons are eligible (THROW_IN_MOVEMENT_2 omits MOVEMENT, dropping "Move" for free).
      const isThrowIn =
        lastActionType === 'THROW_IN_MOVEMENT_1' || lastActionType === 'THROW_IN_MOVEMENT_2';

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
        <PanelShell wide={actionCount >= 5}>
          <div className={styles.helperBlock}>
            <span className={styles.helperLine1}>
              {isKickOff ? 'Kick-Off!' : isThrowIn ? 'Throw-In!' : 'Choose an Action!'}
            </span>
            <span className={styles.helperLine2}>
              {isKickOff
                ? 'Play starts with a Standard Pass from the centre circle — the only legal opening action.'
                : lastActionType === 'THROW_IN_MOVEMENT_1'
                  ? 'Take the throw now, or take another Movement Phase first.'
                  : lastActionType === 'THROW_IN_MOVEMENT_2'
                    ? 'Take the throw — no more Movement Phases available.'
                    : 'Move a player, pass to a teammate, or take a shot.'}
            </span>
          </div>
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
              title={
                isThrowIn ? ACTION_SUMMARY['Standard Throw-In'] : ACTION_SUMMARY['Standard Pass']
              }
              onClick={() => setSelectedPassType('STANDARD_PASS')}
            >
              {isThrowIn ? 'Standard Throw-In' : 'Standard Pass'}
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
              title={isThrowIn ? ACTION_SUMMARY['High Throw-In'] : ACTION_SUMMARY['High Pass']}
              onClick={() => setSelectedPassType('HIGH_PASS')}
            >
              {isThrowIn ? 'High Throw-In' : 'High Pass'}
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
        </PanelShell>
      );
    }

    // Step 2: pass type selected, no target hex yet — prompt to click a target
    if (passTargetHex === null) {
      return (
        <PanelShell>
          <div className={styles.helperBlock}>
            <span className={styles.helperLine1}>{`${PASS_TYPE_LABELS[selectedPassType]}!`}</span>
            <span className={styles.helperLine2}>Click a target hex.</span>
          </div>
          {/* D-17-05 (gap-closure plan 37-17): Back is only meaningful when the player genuinely
              had a choice. With a singleton eligible set (e.g. GOAL_KICK_RESTART), the store
              auto-selected this pass type (useGameStore.ts setGameState) and Back would return
              to a Step-1 chooser containing a single button — the exact dead click Task 1
              removes. `eligible` is the same ELIGIBLE_NEXT_ACTIONS-derived set Step 1 uses. */}
          {eligible.size > 1 && (
            <button className={styles.backButton} onClick={() => setSelectedPassType(null)}>
              ← Back
            </button>
          )}
          {gameError && <span className={styles.errorText}>{gameError}</span>}
        </PanelShell>
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
    // BUG-31/D-04: any piece with a paceUsedByPieceId entry counts as "started" the moment it
    // steps its first hex — not only once pace is exhausted and locked into movedPieceIds.
    // This mirrors the activatedCount signal at HexGrid.tsx:702 and subsumes both the prior
    // "exhausted-not-locked" and "locked-this-slot" terms (every piece counted by either of
    // those has a paceUsedByPieceId entry, so their union equals this count with no
    // double-count and no under-count).
    const startedCount = Object.keys(paceUsedByPieceId).length;
    const remaining = slotTotal != null ? Math.max(slotTotal - startedCount, 0) : null;
    const slotHelperLine2 =
      slotTotal != null && remaining != null
        ? movementSlot === 'ATTACKER_2'
          ? `${remaining} of ${slotTotal} players left to move. (2 hex max)`
          : `${remaining} of ${slotTotal} players left to move.`
        : null;

    return (
      <PanelShell>
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
          className={`${styles.ctaButton} ${ctaClass(remaining ?? 0)}`}
          title={ACTION_SUMMARY['Confirm']}
          onClick={withEndTurnConfirm(remaining ?? 0, emitEndTurn)}
        >
          Confirm
        </button>
        {movementSlot === 'ATTACKER_4' && Object.keys(paceUsedByPieceId).length === 0 && (
          <button className={styles.backButton} onClick={emitCancelMovement}>
            ← Back
          </button>
        )}
        {confirmDialog}
        {gameError && <span className={styles.errorText}>{gameError}</span>}
      </PanelShell>
    );
  }

  // Error display for phases where the player is active but has no action controls
  // (e.g. GK_RESTART for the non-GK team).
  if (gameError) {
    return (
      <PanelShell>
        <span className={styles.errorText}>{gameError}</span>
      </PanelShell>
    );
  }

  return null;
}
