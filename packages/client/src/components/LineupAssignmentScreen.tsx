/**
 * LineupAssignmentScreen — Phase 24 D-13/D-14/D-15/D-17/D-18/D-19/D-20/D-21/D-22/D-23.
 * Standalone screen (NOT an extension of UniformSelectionScreen) that renders the
 * server-assigned lineup as a horizontal GK|DEF|MID|FWD formation grid of full stat cards,
 * supports HTML5 native drag-to-swap on outfield cards (GK locked), reflects server-authoritative
 * updates after each swap, and confirms via LINEUP_CONFIRM.
 *
 * D-16: only the player's own assignment is shown — server never sends opponent's lineup to this socket.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FORMATIONS,
  PLAYER_POOL,
  computeTotalStat,
  classifyTier,
  DRAFT_ROUNDS,
  DRAFT_ROUND_COUNT,
} from '@counter-attack/shared';
import type {
  BenchEntry,
  FormationId,
  FormationSlot,
  PlayerPiece,
  PoolPlayer,
  TeamId,
  DraftClientView,
  DraftDestination,
  DraftSlotRef,
  TieredPoolPlayer,
} from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { TeamBadge } from './TeamBadge.js';
import { NationFlag } from './NationFlag.js';
import { STAT_LABELS } from './PlayerStatsPanel.js';
import { DraftPackCarousel, TIER_CARD_CLASS } from './DraftPackCarousel.js';
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
  /** Phase 40 (D-01/D-04): 'midmatch' activates the live-GameState substitution
   * branch below. Defaults to 'pregame' (undefined) — every existing pre-match
   * call site is unaffected. */
  mode?: 'pregame' | 'midmatch';
  /** Phase 40 (SUB-02): the caller's own team's live on-pitch pieces (mid-match mode only). */
  midmatchPieces?: readonly PlayerPiece[];
  /** Phase 40 (SUB-02/07/D-13): the caller's own team's bench, including subbedOut/redCarded
   * entries (mid-match mode only). */
  bench?: readonly BenchEntry[];
  /** Phase 40 (SUB-04/SUB-06): this team's whole-match substitution count / permanent
   * on-pitch headcount cap (11 - redCardCount, D-08). */
  subsUsed?: number;
  maxOnPitch?: number;
  /** Phase 40 (SUB-02/D-04): emitted when a bench card is dropped onto an eligible
   * on-pitch card — a single 1-for-1 swap, gated server-side by GAME_SUBSTITUTION. */
  onSubstitute?: (outPieceId: string, inPlayerId: string) => void;
};

/** Phase 29 (DRAFT-06): a single parent-owned drag-state variable resolves every drop —
 * children (DraftPackCarousel/BenchCarousel/lineup slots) never have their dataTransfer
 * payload read at drop time (D-05/D-06/D-08, 29-03-SUMMARY.md pattern). */
type DragState =
  | { cardId: string; source: 'pack' }
  | { cardId: string; source: 'slot'; slotIndex: number }
  | { cardId: string; source: 'bench'; benchIndex: number };

/* ─── LineupStatCard — flat format matching GameBoard/PlayerStatsPanel ────── */

/**
 * Phase 40 (Task 3): widened card-player type so a live-match `PlayerPiece` can be
 * passed directly to `LineupStatCard` in mid-match mode, without disturbing the
 * pregame/draft branches which always pass a real `PoolPlayer`/`TieredPoolPlayer`.
 * `id`/`sourceTeamId`/`poolTag` are PoolPlayer-only fields with no PlayerPiece
 * equivalent, so they become optional rather than required.
 */
type RosterCardPlayer = Omit<PoolPlayer, 'id' | 'sourceTeamId' | 'poolTag'> &
  Partial<Pick<PoolPlayer, 'id' | 'sourceTeamId' | 'poolTag'>>;

type StatCardProps = {
  player: RosterCardPlayer;
  /** Optional in mid-match mode — the jersey number instead comes from `player.number`
   * (the live PlayerPiece's own number, already reflecting any prior substitution's
   * number inheritance per SUB-03). Required in practice for pregame/draft modes. */
  slotMeta?: FormationSlot;
  /** Absolute slot index — 0 = GK (always locked) in pregame/draft mode. In mid-match
   * mode this is a rendering-only sequence index (no formation-slot meaning). */
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
  /** Phase 30 D-23: applies the TIER_CARD_CLASS tier-colored border (D-22) alongside the
   * existing drag/lock/confirm state class — only meaningful for draft-mode cards, which
   * are drafted with a rarity tier (Standard-mode auto-assigned cards are untouched, D-23
   * scopes tier color to "everywhere a drafted card appears", not Standard-mode lineups). */
  showTierBorder?: boolean;
  /** Phase 40 (RESEARCH.md Pitfall 6): a STRUCTURALLY SEPARATE mid-match rendering/
   * drag-gating branch — never merged with the GK-lock expression above. */
  mode?: 'pregame' | 'midmatch';
  /** Phase 40 (D-05): red beats yellow, mirrors PlayerStatsPanel.tsx's cardColor derivation. */
  cardColor?: 'yellow' | 'red' | null;
  /** Phase 40 (D-05): mirrors PlayerStatsPanel.tsx's injury-chip derivation. */
  injuryCount?: number;
  /** Phase 40 (SUB-02): true while this on-pitch card is the hovered bench-drag drop target. */
  isSubTarget?: boolean;
  /** Phase 40 (SUB-06): true for a red-carded on-pitch card — never a valid sub target. */
  isSubBlocked?: boolean;
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
  showTierBorder,
  mode,
  cardColor,
  injuryCount,
  isSubTarget,
  isSubBlocked,
}: StatCardProps) {
  const isMidmatch = mode === 'midmatch';
  const isGK = !isMidmatch && slotIndex === 0;
  // Phase 40 (RESEARCH.md Pitfall 6): mid-match draggability is a structurally
  // separate condition — bench->pitch is the only substitution gesture, so every
  // on-pitch card is non-draggable regardless of the pregame GK-lock rule below.
  const isDraggable = isMidmatch
    ? false
    : allowGKDrag
      ? !lineupConfirmed
      : !isGK && !lineupConfirmed;

  let cardClass: string | undefined;
  if (isMidmatch) {
    cardClass = styles.statCard;
    if (isSubBlocked) cardClass = `${cardClass} ${styles.statCardSubBlocked}`;
    if (isSubTarget) cardClass = `${cardClass} ${styles.statCardSubTarget}`;
  } else if (isGK && !allowGKDrag) {
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

  // D-23: compose the tier-colored border (D-22) onto the state-based class — the tier
  // border and drag/lock/confirm state are independent concerns, matching how
  // DraftPackCarousel/BenchCarousel apply TIER_CARD_CLASS alongside interaction state.
  if (showTierBorder) {
    const tier = classifyTier(computeTotalStat(player as PoolPlayer));
    cardClass = `${cardClass} ${TIER_CARD_CLASS[tier]}`;
  }

  // Phase 40 (SUB-03): mid-match jersey number comes from the live piece's own
  // `number` field (already reflecting any prior substitution's number
  // inheritance) — never from a FormationSlot, which mid-match mode doesn't have.
  const displayNumber = isMidmatch ? player.number : slotMeta?.jerseyNumber;

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
            {/* D-15 Pitfall 5: jersey number from slotMeta, not player (pregame/draft only) */}
            <span className={styles.cardNum}>#{displayNumber}</span>
            {isGK && !allowGKDrag && <span className={styles.lockedBadge}>LOCK</span>}
            {/* Phase 40 (D-05): card/injury chips — identical classes/copy to
                PlayerStatsPanel.tsx's top-left player card (cardColor/injuryCount
                are undefined for pregame/draft cards, so this is a no-op there). */}
            {cardColor && (
              <span data-testid="stats-card-chip" data-card={cardColor} className={styles.cardChip}>
                {cardColor.toUpperCase()}
              </span>
            )}
            {(injuryCount ?? 0) > 0 && (
              <span data-testid="stats-injury-chip" className={styles.injuryChip}>
                {(injuryCount ?? 0) >= 2 ? 'INJ ×2' : 'INJ'}
              </span>
            )}
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
                <span className={styles.statBadge} data-tier={statTier(value)}>
                  {value}
                </span>
                <span className={styles.statAbbr}>{abbr}</span>
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
  mode,
  midmatchPieces,
  bench,
  subsUsed,
  maxOnPitch,
  onSubstitute,
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
    } else if (gameError === 'SUB_CAP_REACHED') {
      message = 'Substitution rejected — limit reached.';
    } else if (gameError === 'ALREADY_SUBBED') {
      message = 'Substitution rejected — player already substituted.';
    } else if (gameError === 'WRONG_PHASE') {
      message = 'Substitution rejected — not currently a stoppage.';
    } else if (gameError === 'CANNOT_SUB_RED_CARD') {
      message = 'Substitution rejected — a sent-off player cannot be replaced.';
    } else if (gameError === 'CANNOT_SUB_IN_RED_CARDED') {
      message = 'Substitution rejected — a sent-off player cannot return.';
    } else if (gameError === 'INVALID_SUBSTITUTE') {
      message = 'Substitution rejected — invalid substitute.';
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

  /** Resolves a drafted card id to a TieredPoolPlayer for bench rendering — falls back to an
   * exact recomputation via classifyTier(computeTotalStat(player)) if the card never appeared
   * in this client's currentPack history (D-05/Pitfall 5: no more role-based heuristic — since
   * tier is a pure function of stats, this fallback is now exact, not approximate).
   * CLEANUP-04 (D-07): wrapped in useCallback keyed on cardCache so the reference stays
   * stable across unrelated re-renders — required so the benchCards useMemo below can list
   * it as a dependency without recomputing on every render (Pitfall 3). */
  const resolveTieredCard = useCallback(
    (cardId: string): TieredPoolPlayer | null => {
      const cached = cardCache[cardId];
      if (cached) return cached;
      const player = PLAYER_MAP.get(cardId);
      if (!player) return null;
      const totalStat = computeTotalStat(player);
      return { ...player, tier: classifyTier(totalStat), totalStat };
    },
    [cardCache],
  );

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
    // CLEANUP-04 (D-07): draftView replaces the former draftView?.benchIds-only dep — the
    // callback references the full draftView object (the `if (!draftView) return []` guard),
    // so exhaustive-deps requires it explicitly. Behavior-equivalent in practice: this app's
    // full-snapshot broadcast pattern (STATE.md "Decisions Locked") means draftView only gets a
    // new reference on a genuine DRAFT_STATE_UPDATED, which is exactly when benchIds also
    // changes — unrelated local-state re-renders (drag-over ticks, rejection-message timeout)
    // leave the draftView prop reference untouched, so benchCards' stable identity from
    // Gap-closure 29-12 (DRAFT-09) is preserved. resolveTieredCard is now a useCallback keyed
    // on cardCache, so its own identity change already covers the prior cardCache dependency.
  }, [draftView, resolveTieredCard]);

  // ─── Phase 40 (SUB-02/03/06/07, D-12/D-13): mid-match substitution state ───

  /** The bench card whose drag started this substitution gesture — set by
   * BenchCarousel's onCardDragStart, mirroring the parent-owned drag-state
   * pattern already used in draft mode (never read dataTransfer at drop time). */
  const [midmatchDragPlayerId, setMidmatchDragPlayerId] = useState<string | null>(null);
  const [midmatchDropTargetPieceId, setMidmatchDropTargetPieceId] = useState<string | null>(null);

  /** Renders one mid-match on-pitch position column, grouped by `piece.role` — GK
   * column: 'GK'; DEF: 'DEF'; MID: 'MID'; FWD: 'FWD' and 'ST'. Never derives slot
   * indices by parsing piece ids (RESEARCH.md instruction) — grouping reads
   * `piece.role` directly. */
  function renderMidmatchColumn(label: string, pieces: readonly PlayerPiece[]) {
    return (
      <div className={styles.column}>
        <div className={styles.columnHeader}>{label}</div>
        <div className={styles.columnCards}>
          {pieces.map((piece, i) => {
            const cardColor: 'yellow' | 'red' | null =
              piece.redCarded === true ? 'red' : (piece.yellowCards ?? 0) > 0 ? 'yellow' : null;
            const isBlocked = piece.redCarded === true;
            return (
              <LineupStatCard
                key={piece.id}
                player={piece}
                slotIndex={i}
                isDragSource={false}
                isDropTarget={midmatchDropTargetPieceId === piece.id}
                lineupConfirmed={false}
                teamId={myTeamId}
                mode="midmatch"
                cardColor={cardColor}
                injuryCount={piece.injuryCount ?? 0}
                isSubTarget={midmatchDropTargetPieceId === piece.id}
                isSubBlocked={isBlocked}
                onDragStart={() => {}}
                onDragOver={(e) => {
                  e.preventDefault();
                  setMidmatchDropTargetPieceId(piece.id);
                }}
                onDragLeave={() => setMidmatchDropTargetPieceId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setMidmatchDropTargetPieceId(null);
                  const inPlayerId = midmatchDragPlayerId;
                  setMidmatchDragPlayerId(null);
                  if (!inPlayerId || isBlocked) return;
                  onSubstitute?.(piece.id, inPlayerId);
                }}
                onDragEnd={() => {}}
              />
            );
          })}
        </div>
      </div>
    );
  }

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
                showTierBorder
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

  if (mode === 'midmatch') {
    const pieces = midmatchPieces ?? [];
    const benchList = bench ?? [];
    const subsUsedVal = subsUsed ?? 0;
    const redCardCount = maxOnPitch !== undefined ? 11 - maxOnPitch : 0;

    const midmatchGk: PlayerPiece[] = [];
    const midmatchDef: PlayerPiece[] = [];
    const midmatchMid: PlayerPiece[] = [];
    const midmatchFwd: PlayerPiece[] = [];
    for (const piece of pieces) {
      if (piece.role === 'GK') midmatchGk.push(piece);
      else if (piece.role === 'DEF') midmatchDef.push(piece);
      else if (piece.role === 'MID') midmatchMid.push(piece);
      else midmatchFwd.push(piece); // 'FWD' and 'ST'
    }

    // D-12: the bench is roster-minus-starting-XI, nothing is ever generated to
    // fill it — a Standard-mode room's bench is legitimately empty. This branch
    // renders calmly either way (no error styling, no retry affordance), whether
    // the bench was never populated or has simply been used up (D-12/D-13).
    const midmatchBenchCards: TieredPoolPlayer[] = benchList
      .map((entry) => resolveTieredCard(entry.playerId))
      .filter((c): c is TieredPoolPlayer => c !== null);
    const midmatchBenchNumbers: Record<string, number> = {};
    for (const entry of benchList) midmatchBenchNumbers[entry.playerId] = entry.jerseyNumber;
    const unavailablePlayerIds = benchList
      .filter((e) => e.status === 'subbedOut')
      .map((e) => e.playerId);
    const redCardedPlayerIds = benchList
      .filter((e) => e.status === 'redCarded')
      .map((e) => e.playerId);
    const hasAvailableBenchEntry = benchList.some((e) => e.status === 'available');
    const showEmptyBenchCopy = benchList.length === 0 || !hasAvailableBenchEntry;

    return (
      <div className={styles.screen}>
        <h2 className={styles.matchSetupHeading}>Substitution</h2>
        <p className={styles.cyclePickCounter}>
          Drag a bench card onto an on-pitch card to Substitute.
        </p>

        <span
          className={
            subsUsedVal >= 3
              ? `${styles.subCounterChip} ${styles.subCounterChipCapped}`
              : styles.subCounterChip
          }
        >
          {subsUsedVal}/3 SUBS USED
        </span>

        {maxOnPitch !== undefined && maxOnPitch < 11 && (
          <p className={styles.slotCapNote}>
            {currentPlayerLabel} is down to {maxOnPitch} players after {redCardCount} red card
            {redCardCount === 1 ? '' : 's'}. The vacated slot cannot be filled.
          </p>
        )}

        {/* D-14: horizontal GK | DEF | MID | FWD formation grid, driven by midmatchPieces */}
        <div className={styles.formationColumns}>
          {renderMidmatchColumn('GK', midmatchGk)}
          {renderMidmatchColumn('DEF', midmatchDef)}
          {renderMidmatchColumn('MID', midmatchMid)}
          {renderMidmatchColumn('FWD', midmatchFwd)}
        </div>

        <div className={styles.benchSection}>
          <span className={styles.benchLabel}>BENCH</span>
          <BenchCarousel
            cards={midmatchBenchCards}
            teamId={myTeamId}
            benchNumbers={midmatchBenchNumbers}
            unavailablePlayerIds={unavailablePlayerIds}
            redCardedPlayerIds={redCardedPlayerIds}
            onCardDragStart={(benchIndex) => {
              const card = midmatchBenchCards[benchIndex];
              if (card) setMidmatchDragPlayerId(card.id);
            }}
            onDropToBench={() => setMidmatchDragPlayerId(null)}
          />
          {showEmptyBenchCopy && (
            <p className={styles.cyclePickCounter}>No available substitutes on the bench.</p>
          )}
        </div>

        {rejectionMessage !== null && <p className={styles.swapRejection}>{rejectionMessage}</p>}
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

    // D-20: round-aware progress label — round 1 (GK-only round, D-12) shows "GK Round" in
    // place of "Round N of 6" per the UI-SPEC Copywriting Contract; the pick-count
    // denominator is derived from DRAFT_ROUNDS[round-1].picks, not a hardcoded literal
    // (round 1 -> 2 picks, rounds 2-6 -> 3 picks, D-12..D-16).
    const currentRoundConfig = DRAFT_ROUNDS[draftView.round - 1];
    const roundLabel =
      currentRoundConfig?.kind === 'gk'
        ? 'GK Round'
        : `Round ${draftView.round} of ${DRAFT_ROUND_COUNT}`;
    const roundPicks = currentRoundConfig?.picks ?? draftView.picksRemaining;

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
            {roundLabel} &middot; Pick {draftView.picksRemaining} of {roundPicks}
          </p>
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
              className={styles.confirmButtonReady}
              aria-label="Confirm lineup"
              onClick={() => onConfirm(draftConfirmedOrder)}
            >
              Confirm
            </button>
          )}
          {draftView.draftComplete && !lineupConfirmed && !isLineupComplete && (
            <>
              <button
                className={styles.confirmButton}
                aria-label="Confirm lineup"
                disabled
                aria-disabled="true"
              >
                Confirm
              </button>
              <p className={styles.cyclePickCounter}>Fill all 11 lineup positions to confirm.</p>
            </>
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
            className={styles.confirmButtonReady}
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
