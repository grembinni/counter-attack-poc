import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GamePhase } from '@counter-attack/shared';
import type { MovementSlot } from '@counter-attack/shared';
import type { PlayerPiece } from '@counter-attack/shared';
import { isStoppagePhase, maxOnPitchFor } from '@counter-attack/shared';
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
import { GoalKickSetupPanel } from './GoalKickSetupPanel.js';
import { CornerKickSetupPanel } from './CornerKickSetupPanel.js';
import { FoulChoicePanel } from './FoulChoicePanel.js';
import { GkDiveAtFeetPromptPanel } from './GkDiveAtFeetPromptPanel.js';
import { GkBoxEntryPromptPanel } from './GkBoxEntryPromptPanel.js';
import { TackleStealPromptPanel } from './TackleStealPromptPanel.js';
import { PenaltyKickSetupPanel } from './PenaltyKickSetupPanel.js';
import { ReplayPanel } from './ReplayPanel.js';
import { TeamBadge } from './TeamBadge.js';
import { NationFlag } from './NationFlag.js';
import { CardInjuryBadge, cardColorFor } from './CardInjuryBadge.js';
import { STAT_LABELS } from './PlayerStatsPanel.js';
import { LineupAssignmentScreen } from './LineupAssignmentScreen.js';
import { MatchSummaryModal } from './MatchSummaryModal.js';
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
  // Phase 38 (38-07): Corner Kick phases.
  CORNER_KICK_GK_SETUP_ATTACKING: 'CORNER KICK — ATTACKING GK',
  CORNER_KICK_GK_SETUP_DEFENDING: 'CORNER KICK — DEFENDING GK',
  CORNER_KICK_TAKER_SELECT: 'CORNER KICK — CHOOSE TAKER',
  CORNER_KICK_REPOSITION: 'CORNER KICK — REPOSITION',
  CORNER_KICK_FINAL_SETUP: 'CORNER KICK — FINAL SETUP',
  // Phase 39 (39-01): Fouls, Cards, Injuries & Penalty Kicks phases.
  FOUL_CHOICE: 'FOUL',
  GK_DIVE_AT_FEET_PROMPT: 'DIVE AT FEET',
  // 39-UAT gap 3: destination-hex step after accepting the dive; same label as the prompt.
  GK_DIVE_AT_FEET_TARGET: 'DIVE AT FEET',
  GK_BOX_ENTRY_PROMPT: 'KEEPER RESPONSE',
  GK_BOX_ENTRY_MOVE: 'KEEPER RESPONSE',
  // Phase 43 (43-01): Tackle/Steal prompt-and-decline phase. Panel routing belongs to 43-05.
  TACKLE_STEAL_PROMPT: 'TACKLE / STEAL',
  PENALTY_KICK_SETUP_ATTACKING: 'PENALTY SETUP',
  PENALTY_KICK_SETUP_DEFENDING: 'PENALTY SETUP',
  PENALTY_KICK_TAKER_SELECT: 'PENALTY TAKER',
  PENALTY_KICK: 'PENALTY KICK',
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
 * SUB-01/D-03 (Phase 40): persistent substitution affordance — a 28px strip mirroring
 * SideLog's collapsed-chevron structural template, but mirrored to the opposite (right)
 * edge of pitchRow (SideLog already owns the left edge). ALWAYS rendered across every
 * phase (never a conditional per-phase panel).
 *
 * Checkpoint gap-closure (40-07 Task 2 human-verify feedback): the button is now ALWAYS
 * clickable — a manager can open the roster to view it at any time, not only during a
 * stoppage. `actionable` (renamed from the original `enabled`, which used to gate
 * click-ability) now only drives the visual state: it turns the strip green
 * (`.subButtonActive`) when a stoppage is in progress and a substitution can actually be
 * made right now, giving an at-a-glance signal distinct from the neutral "viewable but not
 * actionable" default. Opens a modal (not an inline expand like SideLog) — the one
 * structural deviation.
 */
function SubstitutionButton({ actionable, onOpen }: { actionable: boolean; onOpen: () => void }) {
  // SUB-17 (Phase 42): the whole 28px full-height strip now carries the editable signal, not
  // just the inner button's label/text — `actionable` is applied to the OUTER container
  // below, in addition to the existing inner `.subButtonActive` composition (both change
  // together; D-03 names both tokens).
  return (
    <div
      className={
        actionable
          ? `${styles.subButtonStrip} ${styles.subButtonStripActive}`
          : styles.subButtonStrip
      }
    >
      <button
        className={
          actionable ? `${styles.sideLogChevron} ${styles.subButtonActive}` : styles.sideLogChevron
        }
        onClick={onOpen}
        aria-label={actionable ? 'Open substitutions' : 'View roster'}
        title={
          actionable
            ? 'Substitutions available — open to make a change.'
            : 'Viewing roster — substitutions are only available during a stoppage in play.'
        }
      >
        <span className={styles.subButtonLabel}>ROSTER</span>
      </button>
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
  // Phase 38 (38-07): persists through PASS once a corner has been awarded — the signal that
  // the ordinary PASS-phase dispatch below must show the corner High/Low choice instead of the
  // generic ActionPanel chooser (mirrors CornerKickSetupPanel's own guard).
  const cornerKickTeam = useGameStore((s) => s.gameState.cornerKickTeam);
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
  // D-16 (Phase 39-16): mutual-confirm gate replacing the D-28 single-team kick-off-team-only
  // gate — both managers may confirm the second half, in either order.
  const secondHalfConfirmed = useGameStore((s) => s.gameState.secondHalfConfirmed);

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

  // HALF_TIME overlay: D-16 mutual-confirm gate — replaces the D-28 single-team
  // kick-off-team-only gate entirely. Both managers now see an actionable button; each sees
  // a waiting state once THEY have confirmed, independent of the other's confirm state.
  const myTeam = useMyTeam();
  const myConfirmed = myTeam !== null && (secondHalfConfirmed?.[myTeam] ?? false);
  const canStart = myTeam !== null && !myConfirmed;
  const secondHalfKickOffTeam = kickOffTeam === 'home' ? 'away' : 'home';
  const secondHalfTeamName = secondHalfKickOffTeam === 'home' ? 'Home' : 'Away';
  // D-16 waiting-state opponent label — derived from myTeam (the OTHER manager), independent
  // of secondHalfKickOffTeam (which communicates who kicks off, a separate concept per D-16).
  const opponentTeamName = myTeam === 'home' ? 'Away' : 'Home';

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

  // SUB-01..07/D-03 (Phase 40): persistent substitution affordance + modal state.
  // Per-slice selectors only (STATE.md Pitfall 6) — never a whole-store subscription.
  const bench = useGameStore((s) => s.gameState.bench);
  const subsUsed = useGameStore((s) => s.gameState.subsUsed);
  const selectedFormation = useGameStore((s) => s.gameState.selectedFormation);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const emitSubstitution = useGameStore((s) => s.emitSubstitution);
  // SUB-08 (Phase 42): same selector style as emitSubstitution above.
  const emitRosterReposition = useGameStore((s) => s.emitRosterReposition);
  // D-19/Pitfall 7: drag/modal-open state is local, never Zustand.
  const [subOpen, setSubOpen] = useState(false);
  // STATS-01/D-08/D-09 (Phase 45, plan 45-05): standalone match-summary modal
  // open/closed state. Local, never Zustand — mirrors subOpen immediately above.
  const [matchSummaryOpen, setMatchSummaryOpen] = useState(false);
  const isSubEligiblePhase = isStoppagePhase(phase);
  // Checkpoint gap-closure (40-07 Task 2 human-verify feedback): T-40-20's original
  // force-close-on-phase-transition useEffect is REMOVED — the panel is now always
  // viewable (2a), so a server-driven phase change leaving the stoppage set must no
  // longer close it. Staleness is instead handled live: `isSubEligiblePhase` is read
  // directly from the store on every render and passed through as `readOnly` below, so
  // the instant the phase leaves the stoppage set the modal (still open) flips to its
  // read-only presentation on its own next render — no imperative close needed.

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
                    {/* Debug card-and-injury-icons-are-not: this inline card is the actual
                        top-left player card the app renders (PlayerStatsPanel.tsx is not
                        used in the live tree — see debug session). ICON-01/ICON-02 (D-01/D-02):
                        shared CardInjuryBadge glyph, positioned immediately after the jersey
                        number, mirroring PieceOverlay/PlayerStatsPanel/roster/bench. */}
                    <CardInjuryBadge
                      cardColor={cardColorFor(displayPiece)}
                      injuryCount={displayPiece.injuryCount ?? 0}
                      size={18}
                    />
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
              {/* STATS-01/D-08/D-09: always-clickable (i) icon, a real sibling
                  element positioned above the clock row — .scoreboardCentreCell
                  is a content-sized centred column, not a cell with pre-reserved
                  empty space, so this cannot be absolutely positioned into an
                  assumed gap. No `disabled` prop and no phase condition
                  anywhere on this control (D-09) — it opens the read-only
                  summary in every phase, including mid-duel/prompt interrupts. */}
              <div className={styles.matchSummaryIconRow}>
                <button
                  type="button"
                  className={styles.matchSummaryIconButton}
                  title="View match summary"
                  onClick={() => setMatchSummaryOpen(true)}
                >
                  i
                </button>
              </div>
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
          {phase === 'KICK_OFF_SETUP' ? (
            <KickOffSetupPanel />
          ) : phase === 'FREE_KICK_SETUP' ? (
            <FreeKickSetupPanel />
          ) : phase === 'THROW_IN_SETUP' ? (
            <ThrowInSetupPanel />
          ) : phase === 'GOAL_KICK_SETUP_GK' ||
            phase === 'GOAL_KICK_SETUP_OPPONENT' ||
            phase === 'GOAL_KICK_CHOICE' ||
            phase === 'GOAL_KICK_TARGET' ||
            phase === 'GOAL_KICK_MOVE' ? (
            <GoalKickSetupPanel />
          ) : phase === 'CORNER_KICK_GK_SETUP_ATTACKING' ||
            phase === 'CORNER_KICK_GK_SETUP_DEFENDING' ||
            phase === 'CORNER_KICK_TAKER_SELECT' ||
            phase === 'CORNER_KICK_REPOSITION' ||
            phase === 'CORNER_KICK_FINAL_SETUP' ||
            // CORNER-04/05: the High/Low Pass choice happens in the ordinary PASS phase once a
            // corner has been awarded — cornerKickTeam is the persistent signal (mirrors
            // CornerKickSetupPanel's own guard; see the must_have truth "the kicking manager
            // chooses between a High Pass and a Low Pass before the corner is taken").
            (phase === 'PASS' && cornerKickTeam != null) ? (
            <CornerKickSetupPanel />
          ) : phase === 'FOUL_CHOICE' ? (
            <FoulChoicePanel />
          ) : phase === 'GK_DIVE_AT_FEET_PROMPT' || phase === 'GK_DIVE_AT_FEET_TARGET' ? (
            // 39-UAT gap 3: GK_DIVE_AT_FEET_TARGET is the destination-hex step after accept.
            // The panel's own phase guard is widened in Plan 39-21 to render the hex-choice UI;
            // during this plan the target phase renders GkDiveAtFeetPromptPanel with no content
            // for that phase, which is expected and NOT fixed here (client work is 39-21's).
            <GkDiveAtFeetPromptPanel />
          ) : phase === 'GK_BOX_ENTRY_PROMPT' || phase === 'GK_BOX_ENTRY_MOVE' ? (
            <GkBoxEntryPromptPanel />
          ) : phase === 'TACKLE_STEAL_PROMPT' ? (
            <TackleStealPromptPanel />
          ) : phase === 'PENALTY_KICK_SETUP_ATTACKING' ||
            phase === 'PENALTY_KICK_SETUP_DEFENDING' ||
            phase === 'PENALTY_KICK_TAKER_SELECT' ||
            phase === 'PENALTY_KICK' ? (
            // Unlike the corner kick's PASS-phase persistent-signal fallback above, the penalty
            // duel has its own dedicated PENALTY_KICK phase rather than resolving inside the
            // ordinary PASS phase — no analogous fallback branch is needed here (39-16 Task 1).
            <PenaltyKickSetupPanel />
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

                {/* Start 2nd Half — D-16 mutual-confirm gate replaces the D-28 single-team
                    kick-off-team-only gate. Both managers see an actionable button before
                    THEIR OWN confirm; each switches to a waiting message once they have
                    confirmed, independent of the opponent's confirm state. */}
                {myConfirmed ? (
                  <p className={styles.overlayBody}>
                    Waiting for {opponentTeamName} to start the 2nd half&hellip;
                  </p>
                ) : (
                  <button
                    className={styles.overlayCtaButton}
                    disabled={!canStart}
                    onClick={() => emitHalfTimeStart()}
                  >
                    Start 2nd Half
                  </button>
                )}
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

          {/* SUB-01..07/D-01/D-03 (Phase 40): substitution panel. Checkpoint gap-closure
              (40-07 Task 2 human-verify feedback, item 2a/2b): now openable at ANY time (not
              gated behind isSubEligiblePhase — that only drives the button's visual state and
              the `readOnly` prop below) and rendered full-size via `.substitutionModalCard`'s
              100%-of-viewport treatment, matching the pre-match LineupAssignmentScreen's own
              `.screen` full-screen presentation rather than a small centred card. */}
          {subOpen && myTeam !== null && (
            <div className={styles.substitutionOverlay}>
              <div className={styles.substitutionModalCard}>
                <LineupAssignmentScreen
                  mode="midmatch"
                  assignment={[]}
                  formationId={selectedFormation?.[myTeam] ?? '4-4-2'}
                  playerSlot={playerSlot ?? 1}
                  myTeamId={selectedTeams[myTeam]}
                  // Mid-match mode never invokes these three — SUB-02 is a 1-for-1 swap via
                  // onSubstitute; formation change is deferred per CONTEXT.md Deferred Ideas.
                  onSwap={() => {}}
                  onConfirm={() => {}}
                  lineupConfirmed={false}
                  midmatchPieces={pieces.filter((p) => p.teamId === myTeam)}
                  bench={bench?.[myTeam] ?? []}
                  subsUsed={subsUsed?.[myTeam] ?? 0}
                  maxOnPitch={maxOnPitchFor(pieces, myTeam)}
                  onSubstitute={emitSubstitution}
                  // SUB-08 (Phase 42): wires the roster panel's positioning-mode drag-swap to
                  // the server via the same selector-style store emitter as onSubstitute above.
                  onReposition={emitRosterReposition}
                  // SUB-09 (Phase 42): selectedPieceId !== null is the confirmed "a game action
                  // is currently selected/pending" signal (resolved from STATE.md's open
                  // question). Layers ON TOP of the existing readOnly gate below rather than
                  // replacing it — selectedPieceId is already selected above (~line 238), so no
                  // second selector is added here.
                  actionPending={selectedPieceId !== null}
                  // Checkpoint gap-closure (40-07, item 2a): read-only the instant a live
                  // phase change (or simply opening the panel outside a stoppage) makes a
                  // substitution un-actionable — mirrors the server's own WRONG_PHASE guard.
                  readOnly={!isSubEligiblePhase}
                  // Gap-closure (42-12 Task 2D, gap item 4): Resume now renders INSIDE
                  // LineupAssignmentScreen's own content flow, directly under the bench,
                  // instead of a bottom-pinned row on this modal card.
                  onResume={() => setSubOpen(false)}
                />
              </div>
            </div>
          )}

          {/* STATS-01/D-08/D-09 (Phase 45, plan 45-05): standalone match-summary
              modal, rendered adjacent to the substitution overlay block above,
              inside .pitchContainer's DOM subtree (NOT a portal) so the
              --home-accent/--away-accent/--team-accent custom properties
              injected on this component's root (rootStyle above) inherit
              correctly. */}
          {matchSummaryOpen && <MatchSummaryModal onClose={() => setMatchSummaryOpen(false)} />}
        </div>

        {/* SUB-01/D-03: persistent roster affordance, mirrored to the opposite edge from
            SideLog — always rendered and always clickable (40-07 gap-closure item 2a); turns
            green (`actionable`) only while a substitution can actually be made right now. */}
        <SubstitutionButton actionable={isSubEligiblePhase} onOpen={() => setSubOpen(true)} />
      </div>
    </div>
  );
}
