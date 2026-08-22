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
  MAX_SUBS_PER_TEAM,
  isActivePiece,
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
import {
  CardInjuryBadge,
  cardColorFor,
  cardColorForBenchEntry,
  type CardColor,
  type BenchCardStatus,
} from './CardInjuryBadge.js';
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
  /** Checkpoint gap-closure (40-07 Task 2 human-verify feedback): true when the
   * panel is open OUTSIDE a stoppage — the roster is still viewable, but bench
   * cards are never draggable and a drop can never call `onSubstitute` (the
   * server would reject it as `WRONG_PHASE` anyway; this mirrors that guard
   * client-side so the panel reads as calmly read-only, not broken). Mid-match
   * mode only; every other mode ignores this prop. */
  readOnly?: boolean;
  /** Phase 42 (SUB-08/D-02): mid-match only. Called when a positioning-mode drag
   * lands on another on-pitch card — fires synchronously with no confirm popup.
   * Gated server-side by `GAME_ROSTER_REPOSITION`. */
  onReposition?: (pieceIdA: string, pieceIdB: string) => void;
  /** Phase 42 (SUB-09): mid-match only. True when a game action is currently
   * selected/pending on the pitch — disables positioning-mode dragging while
   * true. The parent derives this from `useGameStore`'s `selectedPieceId !== null`
   * (`GameBoard.tsx` already reads `selectedPieceId`); wiring the parent is a
   * later plan's job (42-09) — this plan only consumes the prop. */
  actionPending?: boolean;
};

/** Phase 29 (DRAFT-06): a single parent-owned drag-state variable resolves every drop —
 * children (DraftPackCarousel/BenchCarousel/lineup slots) never have their dataTransfer
 * payload read at drop time (D-05/D-06/D-08, 29-03-SUMMARY.md pattern). */
type DragState =
  | { cardId: string; source: 'pack' }
  | { cardId: string; source: 'slot'; slotIndex: number }
  | { cardId: string; source: 'bench'; benchIndex: number };

/** Phase 42 (SUB-08/SUB-11/SUB-12): the mid-match roster panel's two coexisting
 * interaction modes — default positioning (on-field drag-to-swap) vs. an
 * explicit substitution mode entered through the mode-toggle button. Pitfall 5
 * (research PITFALLS.md): the two modes' drop handlers are kept as two
 * structurally separate functions sharing no guard body — this type exists
 * purely to select WHICH handler runs, never to branch inside a shared one. */
type MidmatchSubMode = 'reposition' | 'substitute';

/** Phase 42 (Task 1 action C): unifies the old single-purpose, bench-only drag
 * id state into one parent-owned union covering both drag sources — pitch
 * (positioning-mode swap) and bench (substitution), matching this file's
 * established `DragState` convention above. Neither mid-match drop handler
 * ever reads `e.dataTransfer.getData(...)`. */
type MidmatchDragState =
  | { source: 'pitch'; pieceId: string }
  | { source: 'bench'; playerId: string };

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
  /** Phase 41 (ICON-01): derived by the shared `cardColorFor`; the local Phase 40 ternary is gone. */
  cardColor?: CardColor;
  /** Phase 41 (ICON-01): derived by the shared `cardColorFor`; the local Phase 40 ternary is gone. */
  injuryCount?: number;
  /** Phase 40 (SUB-02): true while this on-pitch card is the hovered bench-drag drop target. */
  isSubTarget?: boolean;
  /** Phase 40 (SUB-06): true for a red-carded on-pitch card — never a valid sub target. */
  isSubBlocked?: boolean;
  /** Phase 42 (SUB-08): PARENT-computed mid-match draggability — replaces the old
   * hardcoded `isMidmatch ? false` branch below. Only meaningful when `mode ===
   * 'midmatch'`; ignored otherwise. The card component stays dumb — it never
   * re-derives eligibility itself. */
  midmatchDraggable?: boolean;
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
  midmatchDraggable,
}: StatCardProps) {
  const isMidmatch = mode === 'midmatch';
  const isGK = !isMidmatch && slotIndex === 0;
  // Phase 42 (SUB-08, research PITFALLS.md Pitfall 5): mid-match draggability is
  // a structurally separate condition from pregame/draft — but it is no longer a
  // single hardcoded `false`. It is now a three-way split: pregame (GK-lock rule),
  // midmatch-reposition (parent-computed `midmatchDraggable`, true for on-field
  // non-GK/non-slot-0 pieces when no other action is pending), and
  // midmatch-substitute (bench->pitch is the only gesture; on-pitch cards stay
  // non-draggable exactly as before Phase 42 — `midmatchDraggable` is false in
  // that mode too, since only bench cards drag in substitution mode).
  const isDraggable = isMidmatch
    ? midmatchDraggable === true
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
            <CardInjuryBadge
              cardColor={cardColor ?? null}
              injuryCount={injuryCount ?? 0}
              size={16}
            />
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
  readOnly,
  onReposition,
  actionPending,
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
    } else if (gameError === 'INVALID_REPOSITION') {
      message = 'Swap rejected — invalid selection.';
    } else if (gameError === 'REPOSITION_BALL_CARRIER') {
      message = 'Swap rejected — that player has the ball.';
    }
    // Phase 42 (Task 1 action H): 'GK_SLOT_LOCKED' and 'WRONG_PHASE' already have
    // entries above (pregame swap / substitution-mode respectively) — reused
    // verbatim for reposition rejections, not duplicated. 'WRONG_TEAM' is
    // deliberately NOT mapped here: it is unreachable through this UI and a
    // generic string shared by other flows, so mapping it would surface a
    // spurious message.
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
  // ─── Phase 42 (SUB-08/09/10/11/12): mid-match positioning-mode state ───────

  /** Phase 42 (SUB-08): default 'reposition' (positioning mode). `GameBoard`
   * conditionally renders this screen (`{subOpen && ...}`), so closing the
   * panel unmounts it — the mode resets to positioning on reopen with no
   * explicit cleanup needed. */
  const [subMode, setSubMode] = useState<MidmatchSubMode>('reposition');

  /** Phase 42 (Task 1 action C): see `MidmatchDragState` above (module scope). */
  const [midmatchDrag, setMidmatchDrag] = useState<MidmatchDragState | null>(null);
  const [midmatchDropTargetPieceId, setMidmatchDropTargetPieceId] = useState<string | null>(null);

  /** Renders one mid-match on-pitch position column. Checkpoint gap-closure
   * (40-07 Task 2 human-verify feedback): originally grouped by `piece.role` (the
   * occupant's own playing specialism), which broke formation shape on a
   * substitution — subbing a FWD into a MID slot re-grouped the roster into a
   * "4-3-3"-looking column layout instead of keeping the selected "4-4-2" shape,
   * because the FWD's `role` moved it into the FWD column regardless of which
   * slot it actually filled. Now grouped by the FIXED formation SLOT's role
   * (`FORMATIONS[formationId].slots[slotIndex].slotRole`, resolved via the slot
   * index encoded in `piece.id`, e.g. `home-5` -> index 5) — identical grouping
   * key to the pregame `renderColumn`'s `slotMeta.slotRole` above. `piece.id` is
   * documented "slot identity" in gameEngine.ts's buildSquadPieces/applySubstitution
   * (SUB-03: a substitution deliberately never changes it), so parsing it here is
   * the same contract the server already guarantees, not a fragile inference. */
  function renderMidmatchColumn(label: string, pieces: readonly PlayerPiece[]) {
    return (
      <div className={styles.column}>
        <div className={styles.columnHeader}>{label}</div>
        <div className={styles.columnCards}>
          {pieces.map((piece, i) => {
            const isBlocked = piece.redCarded === true;
            // Reuse the same slot-index parse already established for column
            // grouping above (`piece.id`'s `${team}-${slotIndex}` suffix) rather
            // than adding a second parse implementation (Task 1 action D).
            const parsedSlotIndex = /-(\d+)$/.exec(piece.id);
            const slotIndexNum = parsedSlotIndex !== null ? Number(parsedSlotIndex[1]) : null;
            // Phase 42 (SUB-08/09/10, Task 1 action D): parent-computed
            // draggability for positioning mode. The two GK clauses
            // (`role === 'GK'` and slot index 0) mirror
            // `applyRosterReposition`'s GK_SLOT_LOCKED guard exactly, so a card
            // can never look draggable and then be server-rejected.
            const midmatchDraggable =
              subMode === 'reposition' &&
              readOnly !== true &&
              actionPending !== true &&
              isActivePiece(piece) &&
              slotIndexNum !== 0 &&
              piece.role !== 'GK';
            const isDragSource =
              subMode === 'reposition' &&
              midmatchDrag?.source === 'pitch' &&
              midmatchDrag.pieceId === piece.id;
            return (
              <LineupStatCard
                key={piece.id}
                player={piece}
                slotIndex={i}
                isDragSource={isDragSource}
                isDropTarget={midmatchDropTargetPieceId === piece.id}
                lineupConfirmed={false}
                teamId={myTeamId}
                mode="midmatch"
                cardColor={cardColorFor(piece)}
                injuryCount={piece.injuryCount ?? 0}
                isSubTarget={midmatchDropTargetPieceId === piece.id}
                isSubBlocked={isBlocked}
                midmatchDraggable={midmatchDraggable}
                onDragStart={(e) => {
                  // Phase 42 (Task 1): positioning-mode drag start only —
                  // substitution mode's only drag source is the bench (below).
                  // Named/extracted into `handleMidmatchDragStart` in Task 2.
                  if (subMode !== 'reposition' || midmatchDraggable !== true) return;
                  setMidmatchDrag({ source: 'pitch', pieceId: piece.id });
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setMidmatchDropTargetPieceId(piece.id);
                }}
                onDragLeave={() => setMidmatchDropTargetPieceId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setMidmatchDropTargetPieceId(null);
                  if (subMode === 'reposition') {
                    // Task 2 extracts this branch into the named
                    // `handleMidmatchRepositionDrop` function (Pitfall 5:
                    // never share a guard body with the substitution branch
                    // below — kept as two structurally separate code paths
                    // even inline here).
                    const drag = midmatchDrag;
                    setMidmatchDrag(null);
                    if (!drag || drag.source !== 'pitch') return;
                    if (drag.pieceId === piece.id) return;
                    if (readOnly === true || actionPending === true) return;
                    onReposition?.(drag.pieceId, piece.id);
                    return;
                  }
                  const drag = midmatchDrag;
                  setMidmatchDrag(null);
                  const inPlayerId = drag?.source === 'bench' ? drag.playerId : null;
                  // Checkpoint gap-closure (40-07): readOnly mirrors the server's
                  // WRONG_PHASE guard client-side — outside a stoppage the panel is
                  // viewable but a drop can never trigger a substitution. In
                  // practice nothing CAN be dragged here while readOnly (bench
                  // cards are non-draggable below), but this guard is kept as a
                  // defensive second gate rather than relying on drag-source
                  // gating alone.
                  if (!inPlayerId || isBlocked || readOnly === true) return;
                  onSubstitute?.(piece.id, inPlayerId);
                }}
                onDragEnd={() => setMidmatchDrag(null)}
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
      // Checkpoint gap-closure (40-07): resolve the FIXED formation slot for this
      // piece from its id's slot-identity suffix (`${team}-${slotIndex}`,
      // gameEngine.ts buildSquadPieces/applySubstitution) and group by that slot's
      // `slotRole` — never by `piece.role` (the occupant's own specialism), which
      // would re-shuffle the formation shape on every substitution. Falls back to
      // `piece.role` only if the id is unparseable or out of range, so a malformed
      // id never crashes the roster panel.
      const parsedSlotIndex = /-(\d+)$/.exec(piece.id);
      const ownSlotMeta = parsedSlotIndex !== null ? slots[Number(parsedSlotIndex[1])] : undefined;
      const slotRole = ownSlotMeta?.slotRole ?? piece.role;
      if (slotRole === 'GK') midmatchGk.push(piece);
      else if (slotRole.startsWith('DEF')) midmatchDef.push(piece);
      else if (slotRole.startsWith('MID')) midmatchMid.push(piece);
      else midmatchFwd.push(piece); // 'FWD-*' slotRole, or 'FWD'/'ST' piece.role fallback
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
    // Phase 41 (ICON-03): per-card disciplinary/fitness glyph state derived from the
    // same benchList the other bench derivations already use. cardColorForBenchEntry
    // (not cardColorFor) — a bench entry has no `redCarded` field, so its
    // `status: 'redCarded'` alone derives red.
    const benchCardStatus: Record<string, BenchCardStatus> = {};
    for (const entry of benchList) {
      benchCardStatus[entry.playerId] = {
        cardColor: cardColorForBenchEntry(entry),
        injuryCount: entry.injuryCount ?? 0,
      };
    }
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
          {readOnly === true
            ? 'Viewing roster — substitutions are only available during a stoppage in play.'
            : subMode === 'reposition'
              ? 'Drag a player onto another to swap positions.'
              : 'Drag a bench card onto an on-pitch card to Substitute.'}
        </p>

        <span
          className={
            subsUsedVal >= MAX_SUBS_PER_TEAM
              ? `${styles.subCounterChip} ${styles.subCounterChipCapped}`
              : styles.subCounterChip
          }
        >
          {subsUsedVal}/{MAX_SUBS_PER_TEAM} SUBS USED
        </span>

        {/* Phase 42 (SUB-11/SUB-12): mode-toggle button. Entering substitution
            mode clears any in-flight positioning-mode drag; Cancel returns to
            positioning mode and never calls onSubstitute. */}
        {subMode === 'reposition' ? (
          <button
            type="button"
            className={styles.subModeButton}
            aria-label="Enter substitution mode"
            disabled={readOnly === true || subsUsedVal >= MAX_SUBS_PER_TEAM}
            aria-disabled={readOnly === true || subsUsedVal >= MAX_SUBS_PER_TEAM}
            onClick={() => {
              setSubMode('substitute');
              setMidmatchDrag(null);
              setMidmatchDropTargetPieceId(null);
            }}
          >
            Substitute
          </button>
        ) : (
          <button
            type="button"
            className={styles.subModeButton}
            aria-label="Cancel substitution"
            onClick={() => {
              setSubMode('reposition');
              setMidmatchDrag(null);
              setMidmatchDropTargetPieceId(null);
            }}
          >
            Cancel
          </button>
        )}

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
            benchCardStatus={benchCardStatus}
            disabled={readOnly === true || subMode === 'reposition'}
            onCardDragStart={(benchIndex) => {
              // Phase 42 (SUB-10): bench cards are inert in positioning mode —
              // only substitution mode may start a bench-sourced drag.
              if (readOnly === true || subMode !== 'substitute') return;
              const card = midmatchBenchCards[benchIndex];
              if (card) setMidmatchDrag({ source: 'bench', playerId: card.id });
            }}
            onDropToBench={() => setMidmatchDrag(null)}
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
