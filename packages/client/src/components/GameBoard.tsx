import { useRef, useState } from 'react';
import type { GamePhase, MovementSlot } from '@counter-attack/shared';
import type { PlayerPiece } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { HexGrid } from './HexGrid.js';
import { ActionLog } from './ActionLog.js';
import { ConnectionStatus } from './ConnectionStatus.js';
import { DisconnectBanner } from './DisconnectBanner.js';
import { ActionPanel } from './ActionPanel.js';
import { KickOffSetupPanel } from './KickOffSetupPanel.js';
import { ReplayPanel } from './ReplayPanel.js';
import styles from './GameBoard.module.css';

/** Phase label mapping per UI-SPEC Turn Indicator Spec table. Absorbed from TurnIndicator.tsx. */
const PHASE_LABEL: Record<GamePhase, string> = {
  LOBBY: '',
  KICK_OFF: 'KICK OFF',
  KICK_OFF_SETUP: 'KICK OFF SETUP',
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

/** Total moves allowed per movement slot. Absorbed from TurnIndicator.tsx. */
const SLOT_TOTAL: Record<MovementSlot, number> = {
  ATTACKER_4: 4,
  DEFENDER_5: 5,
  ATTACKER_2: 2,
};

/**
 * Compact stats to display in the player card (2x3 grid).
 * Six confirmed PlayerPiece numeric fields chosen for outfield relevance.
 */
const COMPACT_STATS: Array<[keyof PlayerPiece, string]> = [
  ['pace', 'PAC'],
  ['shooting', 'SHT'],
  ['tackling', 'TAC'],
  ['heading', 'HED'],
  ['dribbling', 'DRB'],
  ['highPass', 'HPS'],
];

/**
 * Full game board layout: 80px top band (score | centre | card | action | log | score)
 * followed by the hex pitch. HALF_TIME / FULL_TIME render as overlays over the pitch.
 * Phase 13: replaces sidebar layout; top band always visible in every phase (LAYOUT-01/02, CLOCK-01/02).
 */
export function GameBoard() {
  // Core state
  const score = useGameStore((s) => s.gameState.score);
  const phase = useGameStore((s) => s.gameState.phase);
  const actionCount = useGameStore((s) => s.gameState.actionCount);

  // Centre section (absorbed from TurnIndicator)
  const activeTeam = useGameStore((s) => s.gameState.activeTeam);
  const movementSlot = useGameStore((s) => s.gameState.movementSlot);
  const paceUsedByPieceId = useGameStore((s) => s.gameState.paceUsedByPieceId);

  // Compact player card
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const pieces = useGameStore((s) => s.gameState.pieces);

  // HALF_TIME overlay
  const playerSlot = useGameStore((s) => s.playerSlot);
  const kickOffTeam = useGameStore((s) => s.gameState.kickOffTeam);
  const addedTime = useGameStore((s) => s.gameState.addedTime);
  const emitHalfTimeStart = useGameStore((s) => s.emitHalfTimeStart);

  // Log toggle (D-05: collapsed by default, local UI state)
  const [logExpanded, setLogExpanded] = useState(false);

  // D-08/D-09: event-driven clock. Format: "MM:00". Always rendered (CLOCK-02).
  const clockDisplay = String(actionCount).padStart(2, '0') + ':00';

  // Centre section derived values (from TurnIndicator)
  const teamName = activeTeam === 'home' ? 'HOME TEAM' : 'AWAY TEAM';
  const teamColor = activeTeam === 'home' ? '#1a56b0' : '#c0392b';
  const phaseLabel = PHASE_LABEL[phase];
  const remaining =
    phase === 'MOVEMENT' && movementSlot != null
      ? SLOT_TOTAL[movementSlot] - Object.keys(paceUsedByPieceId).length
      : null;

  // D-03: persistent player card — never blank after first selection
  const lastPieceRef = useRef<PlayerPiece | null>(null);
  const currentPiece = selectedPieceId
    ? (pieces.find((p) => p.id === selectedPieceId) ?? null)
    : null;
  if (currentPiece) lastPieceRef.current = currentPiece;
  const displayPiece = lastPieceRef.current;

  // HALF_TIME overlay: canStart logic (D-28 preserved verbatim from HalfTimeScreen.tsx)
  const myTeam: 'home' | 'away' | null =
    playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
  const canStart = myTeam !== null && myTeam !== kickOffTeam;
  const secondHalfKickOffTeam = kickOffTeam === 'home' ? 'away' : 'home';
  const secondHalfTeamName = secondHalfKickOffTeam === 'home' ? 'Home' : 'Away';
  const secondHalfTeamColor = secondHalfKickOffTeam === 'home' ? '#1a56b0' : '#c0392b';

  // FULL_TIME overlay: result derivation (from FullTimeScreen.tsx)
  const resultText =
    score.home > score.away ? 'Home wins' : score.away > score.home ? 'Away wins' : 'Draw';
  const resultColor =
    score.home > score.away ? '#1a56b0' : score.away > score.home ? '#c0392b' : '#e0e0e0';

  return (
    <div className={styles.gameBoard}>
      {/* Top band: 80px CSS grid strip spanning full width */}
      <div className={styles.topBand}>
        {/* Home score column (far left, fixed 56px) */}
        <div className={styles.scoreColumn}>
          <span className={styles.scoreTeamName}>Home</span>
          <span className={styles.scoreNumeral} style={{ color: '#1a56b0' }}>
            {score.home}
          </span>
        </div>

        {/* Centre section: clock + connection + phase summary */}
        <div className={styles.topBandSection}>
          <span className={styles.clockDisplay}>{clockDisplay}</span>
          <div className={styles.connectionLine}>
            <ConnectionStatus />
          </div>
          <div className={styles.phaseSummary}>
            <span className={styles.teamName} style={{ color: teamColor }}>
              {teamName}
            </span>
            {phaseLabel && phase !== 'REPLAY' && (
              <span className={styles.phaseLabel}>&nbsp;{phaseLabel}</span>
            )}
            {phase === 'MOVEMENT' && movementSlot != null && remaining != null && (
              <span className={styles.movesRemaining}>
                &nbsp;&middot;&nbsp;{movementSlot}&nbsp;&middot;&nbsp;{remaining} moves remaining
              </span>
            )}
          </div>
        </div>

        {/* Compact player card */}
        <div className={styles.topBandSection}>
          {displayPiece ? (
            <div className={styles.playerCard}>
              <div className={styles.playerCardHeader}>
                <span>{displayPiece.name}</span>
                <span className={styles.playerCardRole}>{displayPiece.role}</span>
              </div>
              <div className={styles.compactStatsGrid}>
                {COMPACT_STATS.map(([field, label]) => (
                  <div key={field} className={styles.compactStat}>
                    <span className={styles.compactStatLabel}>{label}</span>
                    <span className={styles.compactStatValue}>{displayPiece[field] as number}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <span className={styles.playerCardPlaceholder}>Select a piece</span>
          )}
        </div>

        {/* Action section: phase-aware panel swap */}
        <div className={styles.topBandSection}>
          <div className={styles.actionSection}>
            {phase === 'KICK_OFF_SETUP' ? (
              <KickOffSetupPanel />
            ) : phase === 'REPLAY' ? (
              <ReplayPanel />
            ) : (
              <ActionPanel />
            )}
          </div>
        </div>

        {/* Log toggle section */}
        {logExpanded ? (
          <div className={styles.logExpanded}>
            <div className={styles.logHeader}>
              <span>MATCH LOG</span>
              <button
                className={styles.logChevron}
                onClick={() => setLogExpanded(false)}
                aria-label="Collapse log"
              >
                &#8249;
              </button>
            </div>
            <ActionLog />
          </div>
        ) : (
          <div className={styles.logCollapsed}>
            <button
              className={styles.logChevron}
              onClick={() => setLogExpanded(true)}
              aria-label="Expand log"
            >
              &#8250;
            </button>
          </div>
        )}

        {/* Away score column (far right, fixed 56px) */}
        <div className={styles.scoreColumnAway}>
          <span className={styles.scoreTeamName}>Away</span>
          <span className={styles.scoreNumeral} style={{ color: '#c0392b' }}>
            {score.away}
          </span>
        </div>
      </div>

      {/* DisconnectBanner between top band and pitch */}
      <DisconnectBanner />

      {/* Pitch area: flex:1, position:relative for overlay anchoring */}
      <div className={styles.pitchContainer}>
        <HexGrid />

        {/* Phase overlays — rendered over pitch, top band remains visible above (D-13) */}
        {phase === 'HALF_TIME' && (
          <div className={styles.overlay}>
            <div className={styles.overlayCard}>
              <h2 className={styles.overlayHeading}>Half Time</h2>
              <p className={styles.overlayBody}>End of 1st Half</p>

              {/* Score display */}
              <div className={styles.overlayScoreRow}>
                <span className={styles.overlayTeamLabel} style={{ color: '#1a56b0' }}>
                  Home
                </span>
                <span className={styles.overlayScore}>
                  {score.home}&nbsp;&ndash;&nbsp;{score.away}
                </span>
                <span className={styles.overlayTeamLabel} style={{ color: '#c0392b' }}>
                  Away
                </span>
              </div>

              {/* Added time note */}
              {addedTime !== null && addedTime > 0 && (
                <p className={styles.overlayBody}>Added time played: +{addedTime}&apos;</p>
              )}

              {/* 2nd half kick-off assignment */}
              <p className={styles.overlayBody}>
                2nd half kick-off:{' '}
                <span style={{ color: secondHalfTeamColor, fontWeight: 700 }}>
                  {secondHalfTeamName}
                </span>
              </p>

              {/* Start 2nd Half button — gated to non-first-half kick-off team (D-28) */}
              <button
                className={styles.overlayCtaButton}
                disabled={!canStart}
                title={!canStart ? 'Only the 2nd half kick-off team can start' : undefined}
                onClick={() => emitHalfTimeStart()}
              >
                Start 2nd Half
              </button>
            </div>
          </div>
        )}

        {phase === 'FULL_TIME' && (
          <div className={styles.overlay}>
            <div className={styles.overlayCard}>
              <h2 className={styles.overlayHeading}>Full Time</h2>

              {/* Score display */}
              <div className={styles.overlayScoreRow}>
                <span className={styles.overlayTeamLabel} style={{ color: '#1a56b0' }}>
                  Home
                </span>
                <span className={styles.overlayScore}>
                  {score.home}&nbsp;&ndash;&nbsp;{score.away}
                </span>
                <span className={styles.overlayTeamLabel} style={{ color: '#c0392b' }}>
                  Away
                </span>
              </div>

              {/* Result line */}
              <p className={styles.overlayResultLine} style={{ color: resultColor }}>
                {resultText}
              </p>

              {/* Transition notice */}
              <p className={styles.overlayBody}>Replay starting&hellip;</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
