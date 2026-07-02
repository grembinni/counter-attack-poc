import { useRef, useState } from 'react';
import type { GamePhase } from '@counter-attack/shared';
import type { MovementSlot } from '@counter-attack/shared';
import type { PlayerPiece } from '@counter-attack/shared';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { HexGrid } from './HexGrid.js';
import { ActionLog } from './ActionLog.js';
import { DisconnectBanner } from './DisconnectBanner.js';
import { ActionPanel } from './ActionPanel.js';
import { KickOffSetupPanel } from './KickOffSetupPanel.js';
import { FreeKickSetupPanel } from './FreeKickSetupPanel.js';
import { ReplayPanel } from './ReplayPanel.js';
import { TeamBadge } from './TeamBadge.js';
import styles from './GameBoard.module.css';

/** Phase label mapping per DESIGN-01 (Phase 18) naming convention. Absorbed from TurnIndicator.tsx. */
const PHASE_LABEL: Record<GamePhase, string> = {
  LOBBY: '',
  KICK_OFF: 'KICKOFF',
  KICK_OFF_SETUP: 'KICKOFF SETUP',
  MOVE: 'MOVE',
  // D-11: gerund kept intentionally per user correction — do NOT change to 'CHOOSE ACTION'.
  PASS: 'CHOOSING ACTION',
  // D-11 correction
  SNAPSHOT_TARGET: 'SNAPSHOT - SELECT TARGET',
  // D-11 correction (GK -> GOALIE; also fixes the stale 'GK DIVING')
  GK_DIVE: 'GOALIE DIVE',
  // D-11 correction
  SNAPSHOT_DEFLECT: 'SNAPSHOT - RESPONSE MOVE',
  SHOT: 'SHOT',
  HEADER: 'HEADER',
  SNAPSHOT: 'SNAPSHOT',
  LOOSE_BALL: 'LOOSE BALL',
  HIGH_PASS_MOVE: 'HIGH PASS — REPOSITION',
  // D-11 correction
  GK_RESTART: 'GOALIE RESTART',
  GK_QUICK_THROW: 'QUICK THROW',
  // D-11 correction
  GK_KICK_TARGET: 'GOALIE KICK — SELECT TARGET',
  // D-11 correction
  GK_KICK_MOVE: 'GOALIE KICK — REPOSITION',
  FREE_MOVE_ATTACK: 'FREE MOVE — ATTACK',
  FREE_MOVE_DEFENSE: 'FREE MOVE — DEFENSE',
  // D-11 correction (hyphenated FIRST-TIME, em-dash, RESPONSE MOVE not REPOSITION)
  FIRST_TIME_PASS_MOVE: 'FIRST-TIME PASS — RESPONSE MOVE',
  // OFFSIDE-02 (Phase 17 D-29): both-teams repositioning before an offside free kick is taken.
  // D-11 correction
  FREE_KICK_SETUP: 'OFFSIDES - FREE KICK SETUP',
  HALF_TIME: 'HALF TIME',
  FULL_TIME: 'FULL TIME',
  REPLAY: 'REPLAY',
};

/**
 * UX-12 (Phase 18.4): Full stat name + action summary lookup for native title tooltips.
 * D-02 lookup-table-as-data shape — same flat Record as PHASE_LABEL/MOVE_SLOT_SUFFIX.
 * Maps every abbreviation rendered by StatRow call sites to full name + what it helps with.
 */
const STAT_FULL_NAME: Record<string, string> = {
  PAC: 'Pace — how far this player can move per turn.',
  DRB: 'Dribbling — keeping the ball under pressure.',
  AA: 'Aerial Ability — winning headers and high passes.',
  SHT: 'Shooting — scoring power on shots.',
  SAV: "Saving — a goalkeeper's shot-stopping.",
  HPS: 'High Pass — accuracy of lofted passes.',
  RES: 'Resilience — resisting fatigue and knocks.',
  TAC: 'Tackling — contesting the ball from a carrier.',
  HND: "Handling — a goalkeeper's catch reliability.",
};

/** DESIGN-01: MOVE-phase numbered slot suffix lookup (D-02 lookup-table-as-data shape). */
const MOVE_SLOT_SUFFIX: Record<MovementSlot, string> = {
  ATTACKER_4: ' 4',
  DEFENDER_5: ' 5',
  ATTACKER_2: ' 2',
};

/** Returns the MOVE-phase numbered slot suffix (' 4' / ' 5' / ' 2'), or '' when no slot is active. */
function moveSlotSuffix(slot: MovementSlot | null): string {
  if (slot === null) return '';
  return MOVE_SLOT_SUFFIX[slot] ?? '';
}

/** Returns the appropriate statBubble color class based on the stat value. */
function statBubbleClass(value: number): string {
  if (value >= 5) return styles.statBubbleGreen ?? '';
  if (value >= 3) return styles.statBubbleYellow ?? '';
  return styles.statBubbleRed ?? '';
}

/** Renders a single stat row: label + colored bubble. */
function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel} title={STAT_FULL_NAME[label] ?? label}>
        {label}
      </span>
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
  const movementSlot = useGameStore((s) => s.gameState.movementSlot);

  // Centre section (absorbed from TurnIndicator)
  const activeTeam = useGameStore((s) => s.gameState.activeTeam);

  // Compact player card
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const pieces = useGameStore((s) => s.gameState.pieces);

  // D-17: selectedTeams drives badge/color lookups (replaces TEAM_DEFAULTS)
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);

  // HALF_TIME overlay
  const playerSlot = useGameStore((s) => s.playerSlot);
  const kickOffTeam = useGameStore((s) => s.gameState.kickOffTeam);
  const addedTime = useGameStore((s) => s.gameState.addedTime);
  const emitHalfTimeStart = useGameStore((s) => s.emitHalfTimeStart);

  // D-08/D-09: event-driven clock. Format: "MM:00". Always rendered (CLOCK-02).
  const clockDisplay = String(actionCount).padStart(2, '0') + ':00';

  // Centre section derived values (from TurnIndicator)
  const teamName = activeTeam === 'home' ? 'HOME TEAM' : 'AWAY TEAM';
  const teamColor = TEAM_CONFIGS[selectedTeams[activeTeam]].primaryColor;
  const phaseLabel =
    phase === 'MOVE' ? PHASE_LABEL[phase] + moveSlotSuffix(movementSlot) : PHASE_LABEL[phase];

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
  const secondHalfTeamColor = TEAM_CONFIGS[selectedTeams[secondHalfKickOffTeam]].primaryColor;

  // FULL_TIME overlay: result derivation (from FullTimeScreen.tsx)
  const resultText =
    score.home > score.away ? 'Home wins' : score.away > score.home ? 'Away wins' : 'Draw';
  const resultColor =
    score.home > score.away
      ? TEAM_CONFIGS[selectedTeams['home']].primaryColor
      : score.away > score.home
        ? TEAM_CONFIGS[selectedTeams['away']].primaryColor
        : '#e0e0e0';

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
                <span className={styles.playerCardName}>
                  {displayPiece.firstName} {displayPiece.lastName}
                </span>
                <span className={styles.playerCardRole}>{displayPiece.role}</span>
                <TeamBadge teamId={selectedTeams[displayPiece.teamId]} size={28} />
              </div>

              {/* Col 2: PAC / DRB / HED or AA / SHT or SAV */}
              <div className={styles.playerCardStatsCol}>
                <StatRow label="PAC" value={displayPiece.pace} />
                <StatRow label="DRB" value={displayPiece.dribbling} />
                <StatRow label="AA" value={displayPiece.aerialAbility} />
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
                {!isGK && <StatRow label="TAC" value={displayPiece.tackling} />}
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
            {/* Home cell: score numeral only */}
            <div className={styles.scoreboardHomeCell}>
              <span
                className={styles.scoreNumeral}
                style={{ color: TEAM_CONFIGS[selectedTeams['home']].primaryColor }}
              >
                {score.home}
              </span>
            </div>

            {/* Centre cell: badges flank clock, then phase summary */}
            <div className={styles.scoreboardCentreCell}>
              <div className={styles.clockRow}>
                <TeamBadge teamId={selectedTeams['home']} size={28} />
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#27ae60',
                    flexShrink: 0,
                  }}
                  title="Connected"
                />
                <span className={styles.clockDisplay}>{clockDisplay}</span>
                <TeamBadge teamId={selectedTeams['away']} size={28} />
              </div>
              <div className={styles.phaseSummary}>
                <span className={styles.teamName} style={{ color: teamColor }}>
                  {teamName}
                </span>
                {phaseLabel && phase !== 'REPLAY' && (
                  <span className={styles.phaseLabel}>&nbsp;&middot;&nbsp;{phaseLabel}</span>
                )}
              </div>
            </div>

            {/* Away cell: score numeral only */}
            <div className={styles.scoreboardAwayCell}>
              <span
                className={styles.scoreNumeral}
                style={{ color: TEAM_CONFIGS[selectedTeams['away']].primaryColor }}
              >
                {score.away}
              </span>
            </div>
          </div>
        </div>

        {/* Track 3 — Right zone: action panel centred within 1fr */}
        <div className={styles.topBandRight}>
          {phase === 'KICK_OFF_SETUP' ? (
            <KickOffSetupPanel />
          ) : phase === 'FREE_KICK_SETUP' ? (
            <FreeKickSetupPanel />
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
                {/* Score row: score | badge | [HALF TIME / 45:00 / KICK OFF] | badge | score */}
                <div className={styles.halfTimeScoreRow}>
                  <span
                    className={styles.halfTimeScore}
                    style={{ color: TEAM_CONFIGS[selectedTeams['home']].primaryColor }}
                  >
                    {score.home}
                  </span>
                  <TeamBadge teamId={selectedTeams['home']} size={150} full />

                  {/* Centre column: HALF TIME (top) | clock (mid) | kick-off + team (bottom) */}
                  <div className={styles.halfTimeCenter}>
                    <span className={styles.halfTimeKickOff}>HALF TIME</span>
                    <div className={styles.halfTimeCenterMiddle}>
                      <span className={styles.halfTimeClock}>45:00</span>
                      {addedTime !== null && addedTime > 0 && (
                        <span className={styles.halfTimeAddedTime}>+{addedTime}&prime;</span>
                      )}
                    </div>
                    <div className={styles.halfTimeCenterBottom}>
                      <span className={styles.halfTimeKickOff}>2ND HALF KICK OFF</span>
                      <span
                        className={styles.halfTimeKickOff}
                        style={{ color: secondHalfTeamColor }}
                      >
                        {secondHalfTeamName.toUpperCase()} TEAM
                      </span>
                    </div>
                  </div>

                  <TeamBadge teamId={selectedTeams['away']} size={150} full />
                  <span
                    className={styles.halfTimeScore}
                    style={{ color: TEAM_CONFIGS[selectedTeams['away']].primaryColor }}
                  >
                    {score.away}
                  </span>
                </div>

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
                {/* Score row: home score | home badge | [90:00 / result] | away badge | away score */}
                <div className={styles.halfTimeScoreRow}>
                  <span
                    className={styles.halfTimeScore}
                    style={{ color: TEAM_CONFIGS[selectedTeams['home']].primaryColor }}
                  >
                    {score.home}
                  </span>
                  <TeamBadge teamId={selectedTeams['home']} size={150} full />
                  <div className={styles.halfTimeCenter}>
                    <div className={styles.halfTimeCenterMiddle}>
                      <span className={styles.halfTimeClock}>90:00</span>
                      <span className={styles.halfTimeAddedTime} style={{ color: resultColor }}>
                        {resultText}
                      </span>
                    </div>
                  </div>
                  <TeamBadge teamId={selectedTeams['away']} size={150} full />
                  <span
                    className={styles.halfTimeScore}
                    style={{ color: TEAM_CONFIGS[selectedTeams['away']].primaryColor }}
                  >
                    {score.away}
                  </span>
                </div>

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
