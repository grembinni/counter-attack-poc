/**
 * LineupAssignmentScreen — Phase 24 D-13/D-14/D-15/D-17/D-18/D-19/D-20/D-21/D-22/D-23.
 * Standalone screen (NOT an extension of UniformSelectionScreen) that renders the
 * server-assigned lineup as a horizontal GK|DEF|MID|FWD formation grid of full stat cards,
 * supports HTML5 native drag-to-swap on outfield cards (GK locked), reflects server-authoritative
 * updates after each swap, and confirms via LINEUP_CONFIRM.
 *
 * D-16: only the player's own assignment is shown — server never sends opponent's lineup to this socket.
 */
import { useState, useEffect, Fragment } from 'react';
import { FORMATIONS, PLAYER_POOL, TEAM_CONFIGS } from '@counter-attack/shared';
import type { FormationId, FormationSlot, PoolPlayer } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { STAT_LABELS } from './PlayerStatsPanel.js';
import styles from './LineupAssignmentScreen.module.css';

/** O(1) lookup map: PlayerId → PoolPlayer. Built once at module load from the immutable PLAYER_POOL. */
const PLAYER_MAP = new Map<string, PoolPlayer>(PLAYER_POOL.map((p) => [p.id, p]));

type Props = {
  /** PlayerId[] from server (11 entries), index maps to FORMATIONS[formationId].slots[i]. */
  assignment: string[];
  /** This player's chosen formation (own side). */
  formationId: FormationId;
  /** Server-assigned slot: 1 = home, 2 = visitor. */
  playerSlot: 1 | 2;
  /** Called when the player drops a card onto another — emits LINEUP_SWAP to server. */
  onSwap: (slotIndexA: number, slotIndexB: number) => void;
  /** Called when the player clicks Confirm Lineup — emits LINEUP_CONFIRM to server. */
  onConfirm: (confirmedOrder: string[]) => void;
  /** True after this player has emitted LINEUP_CONFIRM; cards go dim and button hides. */
  lineupConfirmed: boolean;
};

/* ─── Inline mini token badge ────────────────────────────────────────────── */

/** Inline 20×20 SVG token badge for LineupStatCard header.
 * Uses team primary color (from selectedTeams in store via prop). No jersey pattern complexity needed here.
 * D-15: all cards show a token with the jersey number.
 */
function MiniLineupToken({
  jerseyNumber,
  fillColor,
  strokeColor,
}: {
  jerseyNumber: number;
  fillColor: string;
  strokeColor: string;
}) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx={10} cy={10} r={9} fill={fillColor} stroke={strokeColor} strokeWidth={1.5} />
      <text
        x={10}
        y={10}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={700}
        fill="#ffffff"
        pointerEvents="none"
      >
        {jerseyNumber}
      </text>
    </svg>
  );
}

/* ─── Inline LineupStatCard sub-component ────────────────────────────────── */

type StatCardProps = {
  player: PoolPlayer;
  slotMeta: FormationSlot;
  /** Absolute slot index in FORMATIONS[formationId].slots — 0 = GK (always locked). */
  slotIndex: number;
  /** True when this card is currently being dragged (sets .statCardDragging). */
  isDragSource: boolean;
  /** True when this card is the active drop target (sets .statCardDropTarget). */
  isDropTarget: boolean;
  /** True after this player has confirmed the lineup — all outfield cards get .statCardConfirmed. */
  lineupConfirmed: boolean;
  /** Primary fill color for the mini token circle. */
  tokenFill: string;
  /** Stroke color for the mini token circle. */
  tokenStroke: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
  onDragEnd: () => void;
};

/** D-15: Full stat card showing name, role, jersey number, mini token, and all 9 stats.
 * D-20: GK card (slotIndex 0) always uses .statCardLocked with a LOCKED badge.
 * D-19/D-22: outfield cards are draggable until lineupConfirmed; multiple swaps allowed. */
function LineupStatCard({
  player,
  slotMeta,
  slotIndex,
  isDragSource,
  isDropTarget,
  lineupConfirmed,
  tokenFill,
  tokenStroke,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: StatCardProps) {
  const isGK = slotIndex === 0;
  // D-20: GK never draggable; D-22: outfield draggable until confirmed (supports multiple swaps)
  const isDraggable = !isGK && !lineupConfirmed;

  // Determine card CSS class: GK always locked; outfield follows drag/confirm state
  // string | undefined because CSS module index access returns `string | undefined` under noUncheckedIndexedAccess
  let cardClass: string | undefined;
  if (isGK) {
    cardClass = styles.statCardLocked;
  } else if (lineupConfirmed) {
    cardClass = styles.statCardConfirmed;
  } else if (isDragSource && isDropTarget) {
    // edge case: same card is both — treat as dragging
    cardClass = `${styles.statCard} ${styles.statCardDragging}`;
  } else if (isDragSource) {
    cardClass = `${styles.statCard} ${styles.statCardDragging}`;
  } else if (isDropTarget) {
    cardClass = `${styles.statCard} ${styles.statCardDropTarget}`;
  } else {
    cardClass = styles.statCard;
  }

  return (
    <div
      className={cardClass}
      draggable={isDraggable}
      onDragStart={(e) => onDragStart(e, slotIndex)}
      onDragOver={(e) => onDragOver(e, slotIndex)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, slotIndex)}
      onDragEnd={onDragEnd}
    >
      {/* Card header: mini token + name/role + LOCKED badge (GK only) */}
      <div className={styles.cardHeader}>
        <MiniLineupToken
          jerseyNumber={slotMeta.jerseyNumber}
          fillColor={tokenFill}
          strokeColor={tokenStroke}
        />
        <div className={styles.cardHeaderText}>
          {/* D-15: first name, last name on separate lines; role is player's source role */}
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#e0e0e0' }}>
            {player.firstName}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#e0e0e0' }}>
            {player.lastName}
          </span>
          {/* D-15 Pitfall 5: jersey number from slotMeta.jerseyNumber, NOT player.number */}
          <span
            style={{
              fontSize: '12px',
              fontWeight: 400,
              color: '#a0a0a0',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {player.role} #{slotMeta.jerseyNumber}
          </span>
        </div>
        {/* D-20: LOCKED badge rendered only on GK card */}
        {isGK && <span className={styles.lockedBadge}>LOCKED</span>}
      </div>

      {/* D-15: all 9 stats via STAT_LABELS — same order as PlayerStatsPanel */}
      <div className={styles.statGrid}>
        {STAT_LABELS.map(([attr, label]) => (
          <Fragment key={attr}>
            <span className={styles.statLabel}>{label}</span>
            <span className={styles.statValue}>
              {(player as unknown as Record<string, number>)[attr as string] ?? 0}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─── LineupAssignmentScreen ─────────────────────────────────────────────── */

/** D-13: Standalone lineup assignment screen. Both players see their own lineup simultaneously
 * (D-16/D-25 corrected: parallel confirm gate, not sequential). */
export function LineupAssignmentScreen({
  assignment,
  formationId,
  playerSlot,
  onSwap,
  onConfirm,
  lineupConfirmed,
}: Props) {
  // D-18: heading derives player label from slot number
  const currentPlayerLabel = playerSlot === 1 ? 'HOME' : 'VISITOR';
  // D-16: only own lineup shown — always "YOU"
  const youOrOpponent = 'YOU';
  // D-23: status string derives "waiting for" from opposite slot
  const waitingForLabel = playerSlot === 1 ? 'Visitor' : 'Home';
  // D-25 corrected: both players are active in parallel — neither waits for the other before seeing their lineup
  const isActiveNow = !lineupConfirmed;

  // Read team ID to color mini tokens from the Zustand store
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);
  const myTeamId = playerSlot === 1 ? selectedTeams.home : selectedTeams.away;
  const teamConfig = TEAM_CONFIGS[myTeamId];
  const tokenFill = teamConfig?.palette.homePrime ?? '#3b82f6';
  const tokenStroke = teamConfig?.palette.homePrime ?? '#1d4ed8';

  // D-19/D-22: drag state is local to this component — never in Zustand (Pitfall 7)
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // Swap rejection message — driven by GAME_ERROR from server (D-21/D-22 rejection path)
  const gameError = useGameStore((s) => s.gameError);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (gameError === 'GK_SLOT_LOCKED') {
      setRejectionMessage('Swap rejected — GK cannot be moved.');
      const timer = setTimeout(() => setRejectionMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [gameError]);

  // D-14: group the 11 slots into 4 horizontal columns by slotRole prefix
  const formation = FORMATIONS[formationId];
  if (!formation) return null;
  const slots = formation.slots;

  type ColEntry = { slotIndex: number; player: PoolPlayer; slotMeta: FormationSlot };
  const gkColumn: ColEntry[] = [];
  const defColumn: ColEntry[] = [];
  const midColumn: ColEntry[] = [];
  const fwdColumn: ColEntry[] = [];

  slots.forEach((slotMeta, idx) => {
    const playerId = assignment[idx];
    if (!playerId) return;
    const player = PLAYER_MAP.get(playerId);
    if (!player) return;
    const entry: ColEntry = { slotIndex: idx, player, slotMeta };
    if (slotMeta.slotRole === 'GK') {
      gkColumn.push(entry);
    } else if (slotMeta.slotRole.startsWith('DEF')) {
      defColumn.push(entry);
    } else if (slotMeta.slotRole.startsWith('MID')) {
      midColumn.push(entry);
    } else {
      // FWD-central, FWD-wing
      fwdColumn.push(entry);
    }
  });

  // Shared drag event handlers — keep drag state in this parent component (Pitfall 7)
  function handleDragStart(e: React.DragEvent<HTMLDivElement>, idx: number) {
    setDragSourceIndex(idx);
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, idx: number) {
    // D-20/Pitfall 3: GK slot (index 0) is never a valid drop target — do NOT call preventDefault
    if (idx === 0) return;
    e.preventDefault();
    setDropTargetIndex(idx);
  }

  function handleDragLeave() {
    setDropTargetIndex(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, targetIdx: number) {
    e.preventDefault();
    const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
    // D-20: GK is never a drop target; also reject same-slot drops
    if (targetIdx !== 0 && sourceIdx !== targetIdx) {
      onSwap(sourceIdx, targetIdx);
    }
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }

  function handleDragEnd() {
    setDragSourceIndex(null);
    setDropTargetIndex(null);
  }

  /** Render a single column of stat cards. */
  function renderColumn(label: string, entries: ColEntry[]) {
    return (
      <div className={styles.column}>
        <div className={styles.columnHeader}>{label}</div>
        {entries.map(({ slotIndex, player, slotMeta }) => (
          <LineupStatCard
            key={slotIndex}
            player={player}
            slotMeta={slotMeta}
            slotIndex={slotIndex}
            isDragSource={dragSourceIndex === slotIndex}
            isDropTarget={dropTargetIndex === slotIndex}
            lineupConfirmed={lineupConfirmed}
            tokenFill={tokenFill}
            tokenStroke={tokenStroke}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      {/* D-18: MATCH SETUP heading — Step 3 for both home and visitor */}
      <h2 className={styles.matchSetupHeading}>
        MATCH SETUP: STEP 3 &mdash; {currentPlayerLabel} PLAYER ({youOrOpponent})
      </h2>

      {/* D-23: status line — exact strings from UniformSelectionScreen verbatim */}
      <p className={isActiveNow ? styles.statusActive : styles.statusWaiting}>
        {isActiveNow
          ? 'Make your selections now!'
          : `Waiting for ${waitingForLabel} Player to Lock in their Selection.`}
      </p>

      {/* D-14: horizontal GK | DEF | MID | FWD formation columns */}
      <div className={styles.formationColumns}>
        {renderColumn('GK', gkColumn)}
        {renderColumn('DEF', defColumn)}
        {renderColumn('MID', midColumn)}
        {renderColumn('FWD', fwdColumn)}
      </div>

      {/* D-17: BENCH section — structural only in v1.3, no functional behavior */}
      <div className={styles.benchSection}>
        <span className={styles.benchLabel}>BENCH</span>
        <div className={styles.benchPlaceholders}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={styles.benchSlot}
              data-bench-index={i}
              // v1.4: bench drop target
              onDragOver={undefined}
              onDrop={undefined}
            />
          ))}
        </div>
      </div>

      {/* Swap rejection message — auto-clears after 2000ms */}
      {rejectionMessage !== null && <p className={styles.swapRejection}>{rejectionMessage}</p>}

      {/* Confirm Lineup button — hidden after confirm (D-23/D-25) */}
      {!lineupConfirmed && (
        <button className={styles.confirmButtonGreen} onClick={() => onConfirm(assignment)}>
          Confirm Lineup
        </button>
      )}
    </div>
  );
}
