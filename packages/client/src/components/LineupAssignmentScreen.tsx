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
import styles from './LineupAssignmentScreen.module.css';

/** O(1) lookup map: PlayerId → PoolPlayer. Built once at module load from the immutable PLAYER_POOL. */
const PLAYER_MAP = new Map<string, PoolPlayer>(PLAYER_POOL.map((p) => [p.id, p]));

/** Same stat order as PlayerStatsPanel.STAT_LABELS, typed against PoolPlayer. */
const POOL_STAT_LABELS: Array<[keyof PoolPlayer, string]> = [
  ['pace', 'Pace'],
  ['shooting', 'Shooting'],
  ['tackling', 'Tackling'],
  ['dribbling', 'Dribbling'],
  ['saving', 'Saving'],
  ['handling', 'Handling'],
  ['resilience', 'Resilience'],
  ['aerialAbility', 'Aerial'],
  ['highPass', 'High Pass'],
];

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
  isDragSource: boolean;
  isDropTarget: boolean;
  lineupConfirmed: boolean;
  tokenFill: string;
  tokenStroke: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
  onDragEnd: () => void;
};

/** D-15/D-20: full stat card matching PlayerStatsPanel visual format at compact 8px padding.
 * GK (slotIndex 0) is permanently locked. Outfield cards are draggable until lineupConfirmed. */
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
  const isDraggable = !isGK && !lineupConfirmed;

  let cardClass: string | undefined;
  if (isGK) {
    cardClass = styles.statCardLocked;
  } else if (lineupConfirmed) {
    cardClass = styles.statCardConfirmed;
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
      {/* Header: mini token + name/role — matches PlayerStatsPanel .header structure */}
      <div className={styles.cardHeader}>
        <MiniLineupToken
          jerseyNumber={slotMeta.jerseyNumber}
          fillColor={tokenFill}
          strokeColor={tokenStroke}
        />
        <div className={styles.cardHeaderText}>
          <span className={styles.cardFirstName}>{player.firstName}</span>
          <span className={styles.cardLastName}>{player.lastName}</span>
          {/* D-15 Pitfall 5: jersey number from slotMeta.jerseyNumber, NOT player.number */}
          <span className={styles.cardPlayerMeta}>
            <span>{player.role}</span>
            <span>#{slotMeta.jerseyNumber}</span>
            {isGK && <span className={styles.lockedBadge}>LOCKED</span>}
          </span>
        </div>
      </div>

      {/* Stats grid — same column/gap values as PlayerStatsPanel.statGrid */}
      <div className={styles.statGrid}>
        {POOL_STAT_LABELS.map(([attr, label]) => (
          <Fragment key={attr}>
            <span className={styles.statLabel}>{label}</span>
            <span className={styles.statValue}>{player[attr] as number}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─── LineupAssignmentScreen ─────────────────────────────────────────────── */

export function LineupAssignmentScreen({
  assignment,
  formationId,
  playerSlot,
  onSwap,
  onConfirm,
  lineupConfirmed,
}: Props) {
  const currentPlayerLabel = playerSlot === 1 ? 'HOME' : 'VISITOR';
  const waitingForLabel = playerSlot === 1 ? 'Visitor' : 'Home';
  const isActiveNow = !lineupConfirmed;

  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);
  const myTeamId = playerSlot === 1 ? selectedTeams.home : selectedTeams.away;
  const teamConfig = TEAM_CONFIGS[myTeamId];
  const tokenFill = teamConfig?.palette.homePrime ?? '#3b82f6';
  const tokenStroke = teamConfig?.palette.homePrime ?? '#1d4ed8';

  // D-19/D-22: drag state is local — never in Zustand (Pitfall 7)
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const gameError = useGameStore((s) => s.gameError);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (gameError === 'GK_SLOT_LOCKED') {
      setRejectionMessage('Swap rejected — GK cannot be moved.');
      const timer = setTimeout(() => setRejectionMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [gameError]);

  // D-14: group slots by slotRole prefix into 4 columns
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
      fwdColumn.push(entry);
    }
  });

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, idx: number) {
    setDragSourceIndex(idx);
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, idx: number) {
    // D-20/Pitfall 3: GK slot (index 0) is never a valid drop target
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

  /** Renders one position column. Cards are wrapped in .columnCards so they
   * center vertically within the shared column height (formation shape effect). */
  function renderColumn(label: string, entries: ColEntry[]) {
    return (
      <div className={styles.column}>
        <div className={styles.columnHeader}>{label}</div>
        <div className={styles.columnCards}>
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
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <h2 className={styles.matchSetupHeading}>
        MATCH SETUP: STEP 3 &mdash; {currentPlayerLabel} PLAYER (YOU)
      </h2>

      <p className={isActiveNow ? styles.statusActive : styles.statusWaiting}>
        {isActiveNow
          ? 'Make your selections now!'
          : `Waiting for ${waitingForLabel} Player to Lock in their Selection.`}
      </p>

      {/* D-14: horizontal GK | DEF | MID | FWD formation grid */}
      <div className={styles.formationColumns}>
        {renderColumn('GK', gkColumn)}
        {renderColumn('DEF', defColumn)}
        {renderColumn('MID', midColumn)}
        {renderColumn('FWD', fwdColumn)}
      </div>

      {/* D-17: bench section — structural only in v1.3 */}
      <div className={styles.benchSection}>
        <span className={styles.benchLabel}>BENCH</span>
        <div className={styles.benchPlaceholders}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.benchSlot} data-bench-index={i} />
          ))}
        </div>
      </div>

      {rejectionMessage !== null && <p className={styles.swapRejection}>{rejectionMessage}</p>}

      {!lineupConfirmed && (
        <button className={styles.confirmButtonGreen} onClick={() => onConfirm(assignment)}>
          Confirm Lineup
        </button>
      )}
    </div>
  );
}
