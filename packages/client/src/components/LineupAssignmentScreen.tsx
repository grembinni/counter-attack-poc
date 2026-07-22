/**
 * LineupAssignmentScreen — Phase 24 D-13/D-14/D-15/D-17/D-18/D-19/D-20/D-21/D-22/D-23.
 * Standalone screen (NOT an extension of UniformSelectionScreen) that renders the
 * server-assigned lineup as a horizontal GK|DEF|MID|FWD formation grid of full stat cards,
 * supports HTML5 native drag-to-swap on outfield cards (GK locked), reflects server-authoritative
 * updates after each swap, and confirms via LINEUP_CONFIRM.
 *
 * D-16: only the player's own assignment is shown — server never sends opponent's lineup to this socket.
 */
import { useState, useEffect, useMemo } from 'react';
import { FORMATIONS, PLAYER_POOL, computeTotalStat } from '@counter-attack/shared';
import type {
  FormationId,
  FormationSlot,
  PoolPlayer,
  TeamId,
  DraftClientView,
  DraftDestination,
  DraftSlotRef,
  DraftTier,
  TieredPoolPlayer,
} from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { TeamBadge } from './TeamBadge.js';
import { NationFlag } from './NationFlag.js';
import { STAT_LABELS } from './PlayerStatsPanel.js';
import { DraftPackCarousel } from './DraftPackCarousel.js';
import { BenchCarousel } from './BenchCarousel.js';
import styles from './LineupAssignmentScreen.module.css';

/** O(1) lookup map: PlayerId → PoolPlayer. Built once at module load from the immutable PLAYER_POOL. */
const PLAYER_MAP = new Map<string, PoolPlayer>(PLAYER_POOL.map((p) => [p.id, p]));

/** Color tier for stat badge — mirrors PlayerStatsPanel.statTier. */
function statTier(value: number): 'high' | 'mid' | 'low' {
  if (value >= 5) return 'high';
  if (value >= 3) return 'mid';
  return 'low';
}

type Props = {
  /** PlayerId[] from server (11 entries), index maps to FORMATIONS[formationId].slots[i]. */
  assignment: string[];
  /** This player's chosen formation (own side). */
  formationId: FormationId;
  /** Server-assigned slot: 1 = home, 2 = visitor. */
  playerSlot: 1 | 2;
  /** The player's own confirmed team ID — passed from App.tsx to avoid stale store default. */
  myTeamId: TeamId;
  /** Called when the player drops a card onto another — emits LINEUP_SWAP to server. */
  onSwap: (slotIndexA: number, slotIndexB: number) => void;
  /** Called when the player clicks Confirm Lineup — emits LINEUP_CONFIRM to server. */
  onConfirm: (confirmedOrder: string[]) => void;
  /** True after this player has emitted LINEUP_CONFIRM; cards go dim and button hides. */
  lineupConfirmed: boolean;
  /** Phase 29 (DRAFT-06/D-05): true when this room's teamType is 'draft' — activates the
   * carousel-over-lineup interaction branch below. Additive-only; falsy renders exactly as before. */
  draftMode?: boolean;
  /** Phase 29 D-14: this player's server-authoritative, privacy-scoped draft view. Null/undefined
   * before the first DRAFT_STATE_UPDATED arrives. */
  draftView?: DraftClientView | null;
  /** Phase 29 D-05/D-06: emitted when a pack-row card is dropped onto a lineup slot or the bench. */
  onDraftPick?: (cardId: string, destination: DraftDestination) => void;
  /** Phase 29 D-08/D-10: emitted when an already-drafted card is rearranged (lineup<->bench, lineup<->lineup). */
  onDraftRearrange?: (from: DraftSlotRef, to: DraftSlotRef) => void;
};

/** Phase 29 (DRAFT-06): a single parent-owned drag-state variable resolves every drop —
 * children (DraftPackCarousel/BenchCarousel/lineup slots) never have their dataTransfer
 * payload read at drop time (D-05/D-06/D-08, 29-03-SUMMARY.md pattern). */
type DragState =
  | { cardId: string; source: 'pack' }
  | { cardId: string; source: 'slot'; slotIndex: number }
  | { cardId: string; source: 'bench'; benchIndex: number };

/* ─── LineupStatCard — flat format matching GameBoard/PlayerStatsPanel ────── */

type StatCardProps = {
  player: PoolPlayer;
  slotMeta: FormationSlot;
  /** Absolute slot index — 0 = GK (always locked). */
  slotIndex: number;
  isDragSource: boolean;
  isDropTarget: boolean;
  lineupConfirmed: boolean;
  /** Team badge ID for the left-column badge. */
  teamId: TeamId;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, idx: number) => void;
  onDragEnd: () => void;
  /** Phase 29 D-08: in draft mode a GK card moves freely (both directions per the slot-role
   * rule, not a permanent lock) — undefined/false preserves the original Standard-mode
   * "GK always locked" behavior exactly. */
  allowGKDrag?: boolean;
};

function LineupStatCard({
  player,
  slotMeta,
  slotIndex,
  isDragSource,
  isDropTarget,
  lineupConfirmed,
  teamId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  allowGKDrag,
}: StatCardProps) {
  const isGK = slotIndex === 0;
  const isDraggable = allowGKDrag ? !lineupConfirmed : !isGK && !lineupConfirmed;

  let cardClass: string | undefined;
  if (isGK && !allowGKDrag) {
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
      {/* Flat layout: [TeamBadge] [name/flag/role header + stat chips] */}
      <TeamBadge teamId={teamId} size={48} />
      <div className={styles.cardBody}>
        {/* Header: name · [flag · role · #n] */}
        <div className={styles.cardHeader}>
          <span className={styles.cardName}>
            {player.firstName} {player.lastName}
          </span>
          <div className={styles.cardMeta}>
            <NationFlag nationality={player.nationality} size={14} />
            <span className={styles.cardRole}>{player.role}</span>
            {/* D-15 Pitfall 5: jersey number from slotMeta, not player */}
            <span className={styles.cardNum}>#{slotMeta.jerseyNumber}</span>
            {isGK && !allowGKDrag && <span className={styles.lockedBadge}>LOCK</span>}
          </div>
        </div>
        {/* 3-column stat chip grid → 2 rows of 3+3 (6 role-filtered stats) */}
        <div className={styles.statGrid}>
          {STAT_LABELS.filter(([attr]) => {
            if (attr === 'resilience') return false;
            if (isGK) return attr !== 'shooting' && attr !== 'highPass';
            return attr !== 'saving' && attr !== 'handling';
          }).map(([attr, abbr, fullLabel]) => {
            const value = player[attr as keyof PoolPlayer] as number;
            return (
              <div key={attr} className={styles.statChip} title={fullLabel}>
                <span className={styles.statAbbr}>{abbr}</span>
                <span className={styles.statBadge} data-tier={statTier(value)}>
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── LineupAssignmentScreen ─────────────────────────────────────────────── */

export function LineupAssignmentScreen({
  assignment,
  formationId,
  playerSlot,
  myTeamId,
  onSwap,
  onConfirm,
  lineupConfirmed,
  draftMode,
  draftView,
  onDraftPick,
  onDraftRearrange,
}: Props) {
  const currentPlayerLabel = playerSlot === 1 ? 'HOME' : 'VISITOR';
  const waitingForLabel = playerSlot === 1 ? 'Visitor' : 'Home';
  const isActiveNow = !lineupConfirmed;

  // D-19/D-22: drag state is local — never in Zustand (Pitfall 7)
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const gameError = useGameStore((s) => s.gameError);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  useEffect(() => {
    let message: string | null = null;
    if (gameError === 'GK_SLOT_LOCKED') {
      message = 'Swap rejected — GK cannot be moved.';
    } else if (gameError === 'NON_GK_SLOT_REJECTS_GK') {
      message = 'Swap rejected — only a goalkeeper card can be placed here.';
    } else if (gameError === 'GK_SLOT_REQUIRES_GK') {
      message = 'Swap rejected — goalkeeper slot requires a GK card.';
    } else if (gameError === 'INVALID_CARD') {
      message = 'Swap rejected — invalid card.';
    } else if (gameError === 'LINEUP_ALREADY_CONFIRMED') {
      // Phase 29 gap-closure (29-08-PLAN.md Task 2): server-authoritative
      // post-draft lifecycle guard (29-07) — additive/harmless if 29-07 has
      // not merged yet, since gameError is a plain string comparison.
      message = 'Rearrange rejected — lineup already confirmed.';
    } else if (gameError === 'LINEUP_INCOMPLETE') {
      message = 'Fill all 11 lineup positions before confirming.';
    }
    if (message === null) return;
    setRejectionMessage(message);
    const timer = setTimeout(() => setRejectionMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [gameError]);

  // ─── Phase 29 (DRAFT-06..10): draft-mode state — additive, never touched by Standard mode ───

  /** Phase 29 D-06/D-08: single parent-owned drag-state — resolves every drop; never read from
   * child dataTransfer at drop time (29-03-SUMMARY.md pattern). */
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [draftDropTargetIndex, setDraftDropTargetIndex] = useState<number | null>(null);
  const [showKeeperBanner, setShowKeeperBanner] = useState(false);

  /** Accumulates TieredPoolPlayer objects seen in `draftView.currentPack` over the session so
   * already-drafted cards (which leave currentPack once picked) can still be rendered with their
   * tier border on the bench — the server only sends ids for lineupSlots/benchIds, not full cards. */
  const [cardCache, setCardCache] = useState<Record<string, TieredPoolPlayer>>({});

  useEffect(() => {
    if (!draftView) return;
    setCardCache((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const card of draftView.currentPack) {
        if (next[card.id] !== card) {
          next[card.id] = card;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [draftView]);

  useEffect(() => {
    if (draftView?.keeperAutoPickedThisCycle) {
      setShowKeeperBanner(true);
      const timer = setTimeout(() => setShowKeeperBanner(false), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [draftView?.keeperAutoPickedThisCycle]);

  /** Resolves a drafted card id to a TieredPoolPlayer for bench rendering — falls back to
   * PLAYER_MAP + a role-based tier heuristic ('keeper' for GK, 'common' otherwise) if the card
   * never appeared in this client's currentPack history (e.g. the cycle-4 keeper safety-net auto-
   * pick, which may be placed without ever showing in the receiving player's pack). */
  function resolveTieredCard(cardId: string): TieredPoolPlayer | null {
    const cached = cardCache[cardId];
    if (cached) return cached;
    const player = PLAYER_MAP.get(cardId);
    if (!player) return null;
    const tier: DraftTier = player.role === 'GK' ? 'keeper' : 'common';
    return { ...player, tier, totalStat: computeTotalStat(player) };
  }

  function isCardGK(cardId: string): boolean {
    return PLAYER_MAP.get(cardId)?.role === 'GK';
  }

  // Gap-closure 29-12 (DRAFT-09): hoisted out of the `if (draftMode)` branch into a
  // top-level memo so the array reference is stable across unrelated re-renders
  // (setDraftDropTargetIndex fires on every native dragover tick; setRejectionMessage
  // fires on the rejection-message timeout). draftView.benchIds gets a NEW reference
  // only on a genuine DRAFT_STATE_UPDATED; cardCache changes only when a new pack
  // card populates the tier-color cache. Neither changes on those unrelated
  // re-renders, so benchCards keeps a stable reference across them — this is what
  // lets BenchCarousel's scroll-reset effect key on content instead of identity.
  const benchCards: TieredPoolPlayer[] = useMemo(() => {
    if (!draftView) return [];
    return draftView.benchIds
      .map(resolveTieredCard)
      .filter((c): c is TieredPoolPlayer => c !== null);
  }, [draftView?.benchIds, cardCache]);

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
              teamId={myTeamId}
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

  // ─── Phase 29: draft-mode column building + drag-drop wiring (additive; Standard-mode
  // rendering below is untouched) ────────────────────────────────────────────────────────

  type DraftColEntry = { slotIndex: number; slotMeta: FormationSlot; player: PoolPlayer | null };
  const draftGkColumn: DraftColEntry[] = [];
  const draftDefColumn: DraftColEntry[] = [];
  const draftMidColumn: DraftColEntry[] = [];
  const draftFwdColumn: DraftColEntry[] = [];

  if (draftMode && draftView) {
    slots.forEach((slotMeta, idx) => {
      const playerId = draftView.lineupSlots[idx] ?? null;
      const player = playerId ? (PLAYER_MAP.get(playerId) ?? null) : null;
      const entry: DraftColEntry = { slotIndex: idx, slotMeta, player };
      if (slotMeta.slotRole === 'GK') {
        draftGkColumn.push(entry);
      } else if (slotMeta.slotRole.startsWith('DEF')) {
        draftDefColumn.push(entry);
      } else if (slotMeta.slotRole.startsWith('MID')) {
        draftMidColumn.push(entry);
      } else {
        draftFwdColumn.push(entry);
      }
    });
  }

  /** D-09: only a GK card may land on the GK slot (index 0), and only the GK slot accepts a
   * GK card — both directions rejected client-side for UX only (server, Plan 04, is authoritative). */
  function rejectForGKRule(slotIndex: number, cardId: string): boolean {
    const isGKSlot = slotIndex === 0;
    const cardIsGK = isCardGK(cardId);
    if (isGKSlot && !cardIsGK) {
      showDraftRejection('Swap rejected — only a goalkeeper card can be placed here.');
      return true;
    }
    if (!isGKSlot && cardIsGK) {
      showDraftRejection('Swap rejected — goalkeeper slot requires a GK card.');
      return true;
    }
    return false;
  }

  function showDraftRejection(message: string) {
    setRejectionMessage(message);
    setTimeout(() => setRejectionMessage(null), 2000);
  }

  function handleDraftSlotDragStart(
    e: React.DragEvent<HTMLDivElement>,
    cardId: string,
    idx: number,
  ) {
    setDragState({ cardId, source: 'slot', slotIndex: idx });
    e.dataTransfer.setData('text/plain', `slot:${idx}`);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDraftSlotDragOver(e: React.DragEvent<HTMLDivElement>, idx: number) {
    e.preventDefault();
    setDraftDropTargetIndex(idx);
  }

  function handleDraftSlotDragLeave() {
    setDraftDropTargetIndex(null);
  }

  function handleDraftSlotDrop(e: React.DragEvent<HTMLDivElement>, slotIndex: number) {
    e.preventDefault();
    setDraftDropTargetIndex(null);
    const ds = dragState;
    setDragState(null);
    if (!ds) return;
    if (rejectForGKRule(slotIndex, ds.cardId)) return;

    if (ds.source === 'pack') {
      onDraftPick?.(ds.cardId, { type: 'slot', slotIndex });
    } else if (ds.source === 'slot') {
      if (ds.slotIndex === slotIndex) return;
      onDraftRearrange?.({ type: 'slot', slotIndex: ds.slotIndex }, { type: 'slot', slotIndex });
    } else {
      onDraftRearrange?.({ type: 'bench', benchIndex: ds.benchIndex }, { type: 'slot', slotIndex });
    }
  }

  function handleDraftSlotDragEnd() {
    setDragState(null);
    setDraftDropTargetIndex(null);
  }

  function handleDropToBench() {
    const ds = dragState;
    setDragState(null);
    if (!ds || !draftView) return;
    if (ds.source === 'bench') return; // dropped back onto the bench it came from — no-op

    if (ds.source === 'pack') {
      onDraftPick?.(ds.cardId, { type: 'bench' });
    } else {
      // Destination bench ref is always an append (D-08 comment on DraftSlotRef) — the current
      // bench length is the append position.
      onDraftRearrange?.(
        { type: 'slot', slotIndex: ds.slotIndex },
        { type: 'bench', benchIndex: draftView.benchIds.length },
      );
    }
  }

  /** Renders one draft-mode position column — filled slots use LineupStatCard (GK draggable,
   * D-08); empty slots reuse the dashed `.benchSlot` placeholder style (D-22) and are still a
   * valid drop target. */
  function renderDraftColumn(label: string, entries: DraftColEntry[]) {
    return (
      <div className={styles.column}>
        <div className={styles.columnHeader}>{label}</div>
        <div className={styles.columnCards}>
          {entries.map(({ slotIndex, slotMeta, player }) =>
            player ? (
              <LineupStatCard
                key={slotIndex}
                player={player}
                slotMeta={slotMeta}
                slotIndex={slotIndex}
                isDragSource={dragState?.source === 'slot' && dragState.slotIndex === slotIndex}
                isDropTarget={draftDropTargetIndex === slotIndex}
                lineupConfirmed={lineupConfirmed}
                teamId={myTeamId}
                allowGKDrag
                onDragStart={(e) => handleDraftSlotDragStart(e, player.id, slotIndex)}
                onDragOver={(e) => handleDraftSlotDragOver(e, slotIndex)}
                onDragLeave={handleDraftSlotDragLeave}
                onDrop={(e) => handleDraftSlotDrop(e, slotIndex)}
                onDragEnd={handleDraftSlotDragEnd}
              />
            ) : (
              <div
                key={slotIndex}
                className={styles.benchSlot}
                data-slot-index={slotIndex}
                onDragOver={(e) => handleDraftSlotDragOver(e, slotIndex)}
                onDragLeave={handleDraftSlotDragLeave}
                onDrop={(e) => handleDraftSlotDrop(e, slotIndex)}
              />
            ),
          )}
        </div>
      </div>
    );
  }

  if (draftMode) {
    if (!draftView) {
      // No DRAFT_STATE_UPDATED received yet — render an empty shell rather than crash on
      // null-field access below.
      return <div className={styles.screen} />;
    }

    const draftConfirmedOrder = draftView.lineupSlots.map((id) => id ?? '');
    const isLineupComplete = draftView.lineupSlots.every((id) => id !== null);

    return (
      // Phase 29 gap-closure (29-08-PLAN.md Task 2): a single container-level
      // `onDragEnd` guarantees `dragState` is cleared after ANY drag gesture
      // completes — success, cancel, or drop on empty space — even for
      // pack-sourced and bench-sourced drags, which have no per-card
      // `onDragEnd` of their own. The native `dragend` event always fires on
      // the drag source and bubbles up through this container regardless of
      // which descendant (pack card, bench card, or lineup-slot card)
      // initiated it, so no dragState wedges between rearrangements.
      <div className={styles.screen} onDragEnd={handleDraftSlotDragEnd}>
        <h2 className={styles.matchSetupHeading}>
          MATCH SETUP: STEP 4 &mdash; {currentPlayerLabel} PLAYER (YOU)
        </h2>

        {!draftView.draftComplete && (
          <p className={styles.cyclePickCounter}>
            Cycle {draftView.cycle} of 4 &middot; Pick {draftView.picksRemaining} of{' '}
            {draftView.picksRemaining <= 1 ? 1 : 2}
          </p>
        )}

        {showKeeperBanner && (
          <p className={styles.keeperBanner}>Keeper auto-selected — cycle 4 safety net.</p>
        )}

        {!draftView.draftComplete && draftView.waitingForOpponent && (
          <p className={styles.waitingIndicator}>Waiting for {waitingForLabel} Player to pick…</p>
        )}

        {!draftView.draftComplete && (
          <DraftPackCarousel
            cards={draftView.currentPack}
            teamId={myTeamId}
            disabled={draftView.waitingForOpponent}
            onCardDragStart={(cardId) => setDragState({ cardId, source: 'pack' })}
          />
        )}

        {/* D-14: horizontal GK | DEF | MID | FWD formation grid, driven by draftView.lineupSlots */}
        <div className={styles.formationColumns}>
          {renderDraftColumn('GK', draftGkColumn)}
          {renderDraftColumn('DEF', draftDefColumn)}
          {renderDraftColumn('MID', draftMidColumn)}
          {renderDraftColumn('FWD', draftFwdColumn)}
        </div>

        <div className={styles.benchSection}>
          <span className={styles.benchLabel}>BENCH</span>
          <BenchCarousel
            cards={benchCards}
            teamId={myTeamId}
            benchNumbers={draftView.benchNumbers}
            onCardDragStart={(benchIndex) => {
              const cardId = draftView.benchIds[benchIndex];
              if (cardId) setDragState({ cardId, source: 'bench', benchIndex });
            }}
            onDropToBench={handleDropToBench}
          />
        </div>

        {rejectionMessage !== null && <p className={styles.swapRejection}>{rejectionMessage}</p>}

        <div className={styles.confirmSection}>
          {/* Phase 29 gap-closure (29-08-PLAN.md Task 2/DRAFT-09): Confirm is
              only rendered once every one of the 11 starting lineup slots is
              filled — mirrors the server-side LINEUP_INCOMPLETE guard (29-07)
              so the player can never confirm a partial roster. */}
          {draftView.draftComplete && !lineupConfirmed && isLineupComplete && (
            <button
              className={styles.confirmButtonGreen}
              aria-label="Confirm lineup"
              onClick={() => onConfirm(draftConfirmedOrder)}
            >
              Confirm
            </button>
          )}
          {draftView.draftComplete && !lineupConfirmed && !isLineupComplete && (
            <p className={styles.cyclePickCounter}>Fill all 11 lineup positions to confirm.</p>
          )}
          {draftView.draftComplete && lineupConfirmed && (
            <p className={styles.statusActive}>
              Lineup confirmed — waiting for {waitingForLabel} player…
            </p>
          )}
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

      <div className={styles.confirmSection}>
        {!lineupConfirmed && (
          <button
            className={styles.confirmButtonGreen}
            aria-label="Confirm lineup"
            onClick={() => onConfirm(assignment)}
          >
            Confirm
          </button>
        )}
        {lineupConfirmed && (
          <p className={styles.statusActive}>
            Lineup confirmed — waiting for {waitingForLabel} player…
          </p>
        )}
      </div>
    </div>
  );
}
