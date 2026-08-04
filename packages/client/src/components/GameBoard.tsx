import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GamePhase } from '@counter-attack/shared';
import type { MovementSlot } from '@counter-attack/shared';
import type { PlayerPiece } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { useTeamAccentColorAA } from '../hooks/useTeamColors.js';
import { useMyTeam } from '../hooks/useMyTeam.js';
import { HexGrid } from './HexGrid.js';
import { ActionLog } from './ActionLog.js';
import { DisconnectBanner } from './DisconnectBanner.js';
import { EventBanner } from './EventBanner.js';
import { ActionPanel } from './ActionPanel.js';
import { KickOffSetupPanel } from './KickOffSetupPanel.js';
import { FreeKickSetupPanel } from './FreeKickSetupPanel.js';
import { ThrowInSetupPanel } from './ThrowInSetupPanel.js';
import { ReplayPanel } from './ReplayPanel.js';
import { TeamBadge } from './TeamBadge.js';
import { NationFlag } from './NationFlag.js';
import { STAT_LABELS } from './PlayerStatsPanel.js';
import { SPEED_OPTIONS } from '../constants/speedOptions.js';
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
  // Phase 37 (37-02): Throw-In and Goal Kick phases.
  THROW_IN_SETUP: 'THROW-IN — SETUP',
  GOAL_KICK_SETUP_GK: 'GOAL KICK — REPOSITION (KICKING)',
  GOAL_KICK_SETUP_OPPONENT: 'GOAL KICK — REPOSITION (DEFENDING)',
  GOAL_KICK_CHOICE: 'GOAL KICK — CHOOSE',
  GOAL_KICK_TARGET: 'GOAL KICK — SELECT TARGET',
  GOAL_KICK_MOVE: 'GOAL KICK — REPOSITION',
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
  Pace: 'Pace — hexes this player can move per turn (equal to Pace value).',
  Dribbling:
    'Dribbling — Carrier (Dribbling+D6) vs Tackler (Tackling+D6); carrier keeps ball if score is equal or higher.',
  Aerial:
    'Aerial — both players roll (Aerial+D6) to win headers and high-pass contests; higher score wins.',
  Shooting:
    'Shooting — Attacker (Shooting+D6) vs Keeper (Saving+D6); attacker scores if equal or higher.',
  Saving: 'Saving — Keeper (Saving+D6) vs Attacker (Shooting+D6); keeper saves if equal or higher.',
  'High Pass':
    "High Pass — accuracy of lofted passes; compared against the target's Aerial when the ball lands.",
  Resilience: 'Resilience — not used in current rules.',
  Tackling:
    'Tackling — Defender (Tackling+D6) vs Carrier (Dribbling+D6); defender wins the ball if equal or higher.',
  Handling: 'Handling — Goalkeeper (Handling+D6) to secure catches and high-ball restarts.',
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

/** Returns the appropriate statBubble color class based on the stat value (1-9 scale). */
function statBubbleClass(value: number): string {
  if (value >= 5) return styles.statBubbleGreen ?? '';
  if (value >= 3) return styles.statBubbleYellow ?? '';
  return styles.statBubbleRed ?? '';
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

  // D-08 (soft): read-only active match-speed reminder in the scoreboard phase summary
  const gameSpeed = useGameStore((s) => s.gameState.gameSpeed);

  // Compact player card
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const pieces = useGameStore((s) => s.gameState.pieces);

  // D-17: selectedTeams drives badge/color lookups (replaces TEAM_DEFAULTS)
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);

  // HALF_TIME overlay
  const kickOffTeam = useGameStore((s) => s.gameState.kickOffTeam);
  const addedTime = useGameStore((s) => s.gameState.addedTime);
  const emitHalfTimeStart = useGameStore((s) => s.emitHalfTimeStart);

  // D-08/D-09: event-driven clock. Format: "MM:00". Always rendered (CLOCK-02).
  const clockDisplay = String(actionCount).padStart(2, '0') + ':00';

  // Canonical accent-color resolution (CLEANUP-02, D-04; AA-derived per THEME-04) — hook
  // called in component body only, never inside .map()/conditionals. homeColor/awayColor
  // cover every home/away score/badge site; useTeamAccentColorAA guarantees the derived
  // value clears WCAG AA against both --color-bg-page and --color-text-inverse.
  const homeColor = useTeamAccentColorAA(selectedTeams['home']);
  const awayColor = useTeamAccentColorAA(selectedTeams['away']);

  // Centre section derived values (from TurnIndicator)
  const teamName = activeTeam === 'home' ? 'HOME TEAM' : 'AWAY TEAM';
  const teamColor = useTeamAccentColorAA(selectedTeams[activeTeam]);
  const phaseLabel =
    phase === 'MOVE' ? PHASE_LABEL[phase] + moveSlotSuffix(movementSlot) : PHASE_LABEL[phase];

  // D-08 (soft): derive the display label from the shared SPEED_OPTIONS source of truth
  const speedOption = SPEED_OPTIONS.find((o) => o.value === gameSpeed);
  const speedSegmentLabel = speedOption ? `${speedOption.icon} ${speedOption.label}` : null;

  // D-03: persistent player card — never blank after first selection
  const lastPieceRef = useRef<PlayerPiece | null>(null);
  const currentPiece = selectedPieceId
    ? (pieces.find((p) => p.id === selectedPieceId) ?? null)
    : null;
  if (currentPiece) lastPieceRef.current = currentPiece;
  const displayPiece = lastPieceRef.current;

  // HALF_TIME overlay: canStart logic (D-28 preserved verbatim from HalfTimeScreen.tsx)
  const myTeam = useMyTeam();
  const canStart = myTeam !== null && myTeam !== kickOffTeam;
  const secondHalfKickOffTeam = kickOffTeam === 'home' ? 'away' : 'home';
  const secondHalfTeamName = secondHalfKickOffTeam === 'home' ? 'Home' : 'Away';

  // FULL_TIME overlay: result derivation (from FullTimeScreen.tsx)
  const resultText =
    score.home > score.away ? 'Home wins' : score.away > score.home ? 'Away wins' : 'Draw';
  const resultColor =
    score.home > score.away
      ? homeColor
      : score.away > score.home
        ? awayColor
        : 'var(--color-text-primary)';

  // THEME-03 (D-06): runtime per-view accent variables, injected once at the root.
  // --team-accent = active team (single per-view accent); --home-accent/--away-accent
  // are exposed separately because the scoreboard shows both team colors
  // simultaneously — a single --team-accent cannot represent both without changing
  // today's appearance, which the locked phase boundary (D-06, no visual change
  // this phase) forbids. Descendant CSS reads these via var(--home-accent) etc.
  // instead of per-render-site inline color lookups.
  const rootStyle = {
    '--team-accent': teamColor,
    '--home-accent': homeColor,
    '--away-accent': awayColor,
  } as CSSProperties;

  return (
    <div className={styles.gameBoard} style={rootStyle}>
      {/* Top band: 80px CSS grid strip spanning full width — 3 tracks: 1fr auto 1fr */}
      <div className={styles.topBand}>
        {/* Track 1 — Left zone: player card centred within 1fr */}
        <div className={styles.topBandLeft}>
          {displayPiece ? (
            <div className={styles.playerCardFlat}>
              {/* Left: team badge */}
              <TeamBadge teamId={selectedTeams[displayPiece.teamId]} size={48} />
              {/* Right: name/flag/role header + 2-row stat chips */}
              <div className={styles.playerCardBody}>
                <div className={styles.playerCardHeader}>
                  <span className={styles.playerCardName}>
                    {displayPiece.firstName} {displayPiece.lastName}
                  </span>
                  <div className={styles.playerCardMeta}>
                    <NationFlag nationality={displayPiece.nationality} size={18} />
                    <span className={styles.playerCardRole}>{displayPiece.role}</span>
                    <span className={styles.playerCardNum}>#{displayPiece.number}</span>
                  </div>
                </div>
                <div className={styles.playerCardStatGrid}>
                  {STAT_LABELS.filter(([attr]) => {
                    if (attr === 'resilience') return false;
                    const gk = displayPiece.role === 'GK';
                    if (gk) return attr !== 'shooting' && attr !== 'highPass';
                    return attr !== 'saving' && attr !== 'handling';
                  }).map(([attr, abbr, fullLabel]) => {
                    const value = displayPiece[attr] as number;
                    return (
                      <div
                        key={attr}
                        className={styles.statChip}
                        title={STAT_FULL_NAME[fullLabel] ?? fullLabel}
                      >
                        <span className={`${styles.statBubble} ${statBubbleClass(value)}`}>
                          {value}
                        </span>
                        <span className={styles.statAbbr}>{abbr}</span>
                      </div>
                    );
                  })}
                </div>
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
              <span className={`${styles.scoreNumeral} ${styles.accentHome}`}>{score.home}</span>
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
                    background: 'var(--color-cta-ready-bg)',
                    flexShrink: 0,
                  }}
                  title="Connected"
                />
                <span className={styles.clockDisplay}>{clockDisplay}</span>
                <TeamBadge teamId={selectedTeams['away']} size={28} />
              </div>
              <div className={styles.phaseSummary}>
                <span className={`${styles.teamName} ${styles.accentTeam}`}>{teamName}</span>
                {phaseLabel && phase !== 'REPLAY' && (
                  <span className={styles.phaseLabel}>&nbsp;&middot;&nbsp;{phaseLabel}</span>
                )}
                {speedSegmentLabel && phase !== 'REPLAY' && (
                  <span className={styles.phaseLabel}>&nbsp;&middot;&nbsp;{speedSegmentLabel}</span>
                )}
              </div>
            </div>

            {/* Away cell: score numeral only */}
            <div className={styles.scoreboardAwayCell}>
              <span className={`${styles.scoreNumeral} ${styles.accentAway}`}>{score.away}</span>
            </div>
          </div>
        </div>

        {/* Track 3 — Right zone: action panel centred within 1fr */}
        <div className={styles.topBandRight}>
          {/* Phase 37: GoalKickSetupPanel branch added in plan 37-10 */}
          {phase === 'KICK_OFF_SETUP' ? (
            <KickOffSetupPanel />
          ) : phase === 'FREE_KICK_SETUP' ? (
            <FreeKickSetupPanel />
          ) : phase === 'THROW_IN_SETUP' ? (
            <ThrowInSetupPanel />
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
          {/* UX-14: transient event banner — self-gates on eventLog, renders null when idle */}
          <EventBanner />

          {/* Phase overlays — rendered over pitch, top band remains visible above (D-13) */}
          {phase === 'HALF_TIME' && (
            <div className={styles.overlay}>
              <div className={styles.overlayCard}>
                {/* Score row: score | badge | [HALF TIME / 45:00 / KICK OFF] | badge | score */}
                <div className={styles.halfTimeScoreRow}>
                  <span className={`${styles.halfTimeScore} ${styles.accentHome}`}>
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
                        className={`${styles.halfTimeKickOff} ${secondHalfKickOffTeam === 'home' ? styles.accentHome : styles.accentAway}`}
                      >
                        {secondHalfTeamName.toUpperCase()} TEAM
                      </span>
                    </div>
                  </div>

                  <TeamBadge teamId={selectedTeams['away']} size={150} full />
                  <span className={`${styles.halfTimeScore} ${styles.accentAway}`}>
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
                  <span className={`${styles.halfTimeScore} ${styles.accentHome}`}>
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
                  <span className={`${styles.halfTimeScore} ${styles.accentAway}`}>
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
