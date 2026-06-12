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

/** Returns the appropriate statBubble color class based on the stat value. */
function statBubbleClass(value: number): string {
  if (value >= 5) return styles.statBubbleGreen ?? '';
  if (value >= 3) return styles.statBubbleYellow ?? '';
  return styles.statBubbleRed ?? '';
}

/** Inline SVG shield icon for team identity in the score row and player card. */
function TeamShieldIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none" aria-hidden="true">
      <path
        d="M11 1L2 4.5V12C2 17.5 6 22.5 11 25C16 22.5 20 17.5 20 12V4.5L11 1Z"
        fill={color}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1"
      />
    </svg>
  );
}

/** Renders a single stat row: label + colored bubble. */
function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statBubble} ${statBubbleClass(value)}`}>{value}</span>
    </div>
  );
}

/**
 * Side log panel — collapsed (28px strip with › chevron) or expanded (220px with ActionLog).
 * CSS width transition 0.2s ease on the wrapper div.
 */
function SideLog() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className={styles.sideLogCollapsed}>
        <button
          className={styles.sideLogChevron}
          onClick={() => setOpen(true)}
          aria-label="Open log"
        >
          &#8250;
        </button>
      </div>
    );
  }

  return (
    <div className={styles.sideLogExpanded}>
      <div className={styles.sideLogHeader}>
        <span>MATCH LOG</span>
        <button
          className={styles.sideLogChevron}
          onClick={() => setOpen(false)}
          aria-label="Close log"
        >
          &#8249;
        </button>
      </div>
      <ActionLog />
    </div>
  );
}

/**
 * Full game board layout: 80px top band (left 1fr | scoreboard auto | right 1fr)
 * followed by a pitchRow containing SideLog + pitchContainer.
 * HALF_TIME / FULL_TIME render as overlays over the pitch.
 * Phase 13: replaces sidebar layout; top band always visible in every phase (LAYOUT-01/02, CLOCK-01/02).
 * Refactored 260612-ike: scoreboard with shields, 3-col player card, stat bubbles.
 * Refactored 260612-kvw: scores flank clock in centre, side-log panel.
 * Refactored 260612-l7d: 3-track band (1fr auto 1fr), scoreboard as visual centrepiece.
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

  const isGK = displayPiece?.role === 'GK';

  return (
    <div className={styles.gameBoard}>
      {/* Top band: 80px CSS grid strip spanning full width — 3 tracks: 1fr auto 1fr */}
      <div className={styles.topBand}>
        {/* Track 1 — Left zone: player card centred within 1fr */}
        <div className={styles.topBandLeft}>
          {displayPiece ? (
            <div className={styles.playerCard3Col}>
              {/* Col 1: name / role / team icon */}
              <div className={styles.playerCardInfoCol}>
                <span className={styles.playerCardName}>{displayPiece.name}</span>
                <span className={styles.playerCardRole}>{displayPiece.role}</span>
                <TeamShieldIcon color={displayPiece.teamId === 'home' ? '#1a56b0' : '#c0392b'} />
              </div>

              {/* Col 2: PAC / DRB / HED or AA / SHT or SAV */}
              <div className={styles.playerCardStatsCol}>
                <StatRow label="PAC" value={displayPiece.pace} />
                <StatRow label="DRB" value={displayPiece.dribbling} />
                {isGK ? (
                  <StatRow label="AA" value={displayPiece.aerialAbility} />
                ) : (
                  <StatRow label="HED" value={displayPiece.heading} />
                )}
                {isGK ? (
                  <StatRow label="SAV" value={displayPiece.saving} />
                ) : (
                  <StatRow label="SHT" value={displayPiece.shooting} />
                )}
              </div>

              {/* Col 3: HPS / RES / TAC / HND (GK only) */}
              <div className={styles.playerCardStatsCol}>
                <StatRow label="HPS" value={displayPiece.highPass} />
                <StatRow label="RES" value={displayPiece.resilience} />
                <StatRow label="TAC" value={displayPiece.tackling} />
                {isGK && <StatRow label="HND" value={displayPiece.handling} />}
              </div>
            </div>
          ) : (
            <span className={styles.playerCardPlaceholder}>Select a piece</span>
          )}
        </div>

        {/* Track 2 — Scoreboard (auto): home cell | centre cell | away cell */}
        <div className={styles.scoreboard}>
          <div className={styles.scoreboardGrid}>
            {/* Home cell: shield + score numeral */}
            <div className={styles.scoreboardHomeCell}>
              <TeamShieldIcon color="#1a56b0" />
              <span className={styles.scoreNumeral} style={{ color: '#1a56b0' }}>
                {score.home}
              </span>
            </div>

            {/* Centre cell: clock + connection + phase summary */}
            <div className={styles.scoreboardCentreCell}>
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
                    &nbsp;&middot;&nbsp;{movementSlot}&nbsp;&middot;&nbsp;{remaining} moves
                    remaining
                  </span>
                )}
              </div>
            </div>

            {/* Away cell: score numeral + shield */}
            <div className={styles.scoreboardAwayCell}>
              <span className={styles.scoreNumeral} style={{ color: '#c0392b' }}>
                {score.away}
              </span>
              <TeamShieldIcon color="#c0392b" />
            </div>
          </div>
        </div>

        {/* Track 3 — Right zone: action panel centred within 1fr */}
        <div className={styles.topBandRight}>
          {phase === 'KICK_OFF_SETUP' ? (
            <KickOffSetupPanel />
          ) : phase === 'REPLAY' ? (
            <ReplayPanel />
          ) : (
            <ActionPanel />
          )}
        </div>
      </div>

      {/* DisconnectBanner between top band and pitch */}
      <DisconnectBanner />

      {/* Pitch row: SideLog + pitchContainer in a flex row */}
      <div className={styles.pitchRow}>
        <SideLog />

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
    </div>
  );
}
