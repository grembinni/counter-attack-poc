/**
 * LineupAssignmentScreen — Phase 24 D-13/D-14/D-15/D-17/D-18/D-19/D-20/D-21/D-22/D-23.
 * Standalone screen (NOT an extension of UniformSelectionScreen) that renders the
 * server-assigned lineup as a horizontal GK|DEF|MID|FWD formation grid of full stat cards,
 * supports click-to-select swap on outfield cards (GK locked, Phase 47 — see
 * ROSTER-01..08), reflects server-authoritative updates after each swap, and
 * confirms via LINEUP_CONFIRM.
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
  getGenericBenchPlayers,
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
  /** Called when the player clicks a selected card's eligible target — emits LINEUP_SWAP to server. */
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
  /** Phase 29 D-05/D-06: emitted when a pack-row card is clicked onto a lineup slot or the bench. */
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
  /** Phase 40 (SUB-02/D-04): emitted when a bench card's selection is completed onto an eligible
   * on-pitch card — a single 1-for-1 swap, gated server-side by GAME_SUBSTITUTION. */
  onSubstitute?: (outPieceId: string, inPlayerId: string) => void;
  /** Checkpoint gap-closure (40-07 Task 2 human-verify feedback): true when the
   * panel is open OUTSIDE a stoppage — the roster is still viewable, but bench
   * cards are never selectable and a click can never call `onSubstitute` (the
   * server would reject it as `WRONG_PHASE` anyway; this mirrors that guard
   * client-side so the panel reads as calmly read-only, not broken). Mid-match
   * mode only; every other mode ignores this prop. */
  readOnly?: boolean;
  /** Phase 42 (SUB-08/D-02): mid-match only. Called when a positioning-mode
   * selection's completion click lands on another on-pitch card — fires
   * synchronously with no confirm popup. Gated server-side by
   * `GAME_ROSTER_REPOSITION`. */
  onReposition?: (pieceIdA: string, pieceIdB: string) => void;
  /** Phase 42 (SUB-09): mid-match only. True when a game action is currently
   * selected/pending on the pitch — disables positioning-mode selection while
   * true. The parent derives this from `useGameStore`'s `selectedPieceId !== null`
   * (`GameBoard.tsx` already reads `selectedPieceId`); wiring the parent is a
   * later plan's job (42-09) — this plan only consumes the prop. */
  actionPending?: boolean;
  /** Gap-closure (42-12 Task 2A): mid-match only. Supplied by `GameBoard.tsx` to dismiss
   * the substitution modal. Rendered INSIDE this component (not by the parent) so the
   * Resume button sits in the roster panel's own scrolling content flow directly under
   * the bench, per gap item 4 — the previous bottom-of-`.substitutionModalCard`
   * placement read as pinned to the viewport bottom in live verification. */
  onResume?: () => void;
};

/** Phase 42 (SUB-08/SUB-11/SUB-12): the mid-match roster panel's two coexisting
 * interaction modes — default positioning (on-field click-to-select-swap) vs. an
 * explicit substitution mode entered through the mode-toggle button. Pitfall 5
 * (research PITFALLS.md): the two modes' click handlers are kept as two
 * structurally separate functions sharing no guard body — this type exists
 * purely to select WHICH handler runs, never to branch inside a shared one. */
type MidmatchSubMode = 'reposition' | 'substitute';

/** Phase 42 (SUB-13/14/15, Plan 08): a single staged substitution awaiting
 * confirmation. A substitution consumes a capped, un-undoable resource (the
 * 3-per-team cap, no undo per REQUIREMENTS.md), unlike a reposition — so it
 * stages via this type and confirms through a popup rather than firing
 * synchronously on click like `handleRepositionCardClick`. `outName`/
 * `outNumber`/`inName` are captured at stage time (not re-derived at confirm
 * time) so the popup can render both players' identity even if a later
 * server broadcast changes `pieces`/`bench` before the popup is resolved. */
type PendingSubstitution = {
  outPieceId: string;
  inPlayerId: string;
  outName: string;
  outNumber: number;
  inName: string;
};

/** Phase 29 (DRAFT-06), Phase 47 (D-11, ROSTER-08): a single parent-owned
 * SELECTION resolves every click — children (DraftPackCarousel/
 * BenchCarousel/lineup slots) never resolve completion themselves, they
 * only report which card/area was clicked. */
type DraftSelection =
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
  /** Phase 47 (D-03/ROSTER-01): this card is the current green selection. */
  isSelected: boolean;
  /** Phase 47 (D-03/ROSTER-02): something else is selected and this card is a legal
   * click-to-complete target (blue ring). */
  isEligibleTarget: boolean;
  lineupConfirmed: boolean;
  /** Team badge ID for the left-column badge. */
  teamId: TeamId;
  /** Phase 47: fires when the card is clicked or activated via Enter/Space while
   * clickable — omitted entirely (not just gated to a no-op) when the card is
   * neither interactive nor an eligible target (D-04, PieceOverlay.tsx's
   * click-gating idiom). */
  onClick: () => void;
  /** Phase 29 D-08, Phase 47 (ROSTER-08): in draft mode a GK card is selectable
   * freely (both directions per the slot-role rule, not a permanent lock) —
   * undefined/false preserves the original Standard-mode "GK always locked"
   * behavior exactly. */
  allowGKSelect?: boolean;
  /** Phase 30 D-23: applies the TIER_CARD_CLASS tier-colored border (D-22) alongside the
   * existing selection/lock/confirm state class — only meaningful for draft-mode cards, which
   * are drafted with a rarity tier (Standard-mode auto-assigned cards are untouched, D-23
   * scopes tier color to "everywhere a drafted card appears", not Standard-mode lineups). */
  showTierBorder?: boolean;
  /** Phase 40 (RESEARCH.md Pitfall 6): a STRUCTURALLY SEPARATE mid-match rendering/
   * selection-gating branch — never merged with the GK-lock expression above. */
  mode?: 'pregame' | 'midmatch';
  /** Phase 41 (ICON-01): derived by the shared `cardColorFor`; the local Phase 40 ternary is gone. */
  cardColor?: CardColor;
  /** Phase 41 (ICON-01): derived by the shared `cardColorFor`; the local Phase 40 ternary is gone. */
  injuryCount?: number;
  /** Phase 40 (SUB-06): true for a red-carded on-pitch card — never a valid sub target. */
  isSubBlocked?: boolean;
  /** Phase 42 (SUB-08), Phase 47: PARENT-computed mid-match selectability.
   * Only meaningful when `mode === 'midmatch'`; ignored otherwise. The card
   * component stays dumb — it never re-derives eligibility itself. */
  isSelectable?: boolean;
};

function LineupStatCard({
  player,
  slotMeta,
  slotIndex,
  isSelected,
  isEligibleTarget,
  lineupConfirmed,
  teamId,
  onClick,
  allowGKSelect,
  showTierBorder,
  mode,
  cardColor,
  injuryCount,
  isSubBlocked,
  isSelectable,
}: StatCardProps) {
  const isMidmatch = mode === 'midmatch';
  // CLEANUP: pregame/draft slotIndex is a fixed formation-slot index (slot 0 is always
  // GK by formation convention). Mid-match slotIndex is instead the per-column render
  // index (see renderMidmatchColumn), so `slotIndex === 0` no longer identifies the GK
  // there — it was hard-coding isGK to false for every mid-match card, hiding SAVE/
  // HANDLING from the actual goalkeeper's roster/substitution stat grid. Use the
  // piece's real role in mid-match mode instead.
  const isGK = isMidmatch ? player.role === 'GK' : slotIndex === 0;
  // Phase 42 (SUB-08, research PITFALLS.md Pitfall 5): mid-match interactivity is
  // a structurally separate condition from pregame/draft — but it is no longer a
  // single hardcoded `false`. It is now a three-way split: pregame (GK-lock rule),
  // midmatch-reposition (parent-computed `isSelectable`, true for on-field
  // non-GK/non-slot-0 pieces when no other action is pending), and
  // midmatch-substitute (bench->pitch is the only gesture; on-pitch cards stay
  // non-selectable exactly as before Phase 42 — `isSelectable` is false in
  // that mode too, since only bench cards start a selection in substitution mode).
  const isInteractive = isMidmatch
    ? isSelectable === true
    : allowGKSelect
      ? !lineupConfirmed
      : !isGK && !lineupConfirmed;

  let cardClass: string | undefined;
  if (isMidmatch) {
    cardClass = styles.statCard;
    if (isSubBlocked) cardClass = `${cardClass} ${styles.statCardSubBlocked}`;
    if (isSelected) {
      cardClass = `${cardClass} ${styles.statCardSelected}`;
    } else if (isEligibleTarget) {
      cardClass = `${cardClass} ${styles.statCardEligible}`;
    }
  } else if (isGK && !allowGKSelect) {
    cardClass = styles.statCardLocked;
  } else if (lineupConfirmed) {
    cardClass = styles.statCardConfirmed;
  } else {
    cardClass = styles.statCard;
    if (isSelected) {
      cardClass = `${cardClass} ${styles.statCardSelected}`;
    }
    if (isEligibleTarget) {
      cardClass = `${cardClass} ${styles.statCardEligible}`;
    }
  }

  // D-23: compose the tier-colored border (D-22) onto the state-based class — the tier
  // border and selection/lock/confirm state are independent concerns, matching how
  // DraftPackCarousel/BenchCarousel apply TIER_CARD_CLASS alongside interaction state.
  if (showTierBorder) {
    const tier = classifyTier(computeTotalStat(player as PoolPlayer));
    cardClass = `${cardClass} ${TIER_CARD_CLASS[tier]}`;
  }

  // Phase 40 (SUB-03): mid-match jersey number comes from the live piece's own
  // `number` field (already reflecting any prior substitution's number
  // inheritance) — never from a FormationSlot, which mid-match mode doesn't have.
  const displayNumber = isMidmatch ? player.number : slotMeta?.jerseyNumber;

  const isClickable = isInteractive || isEligibleTarget;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!isClickable) return;
    if (e.key === 'Enter') {
      onClick();
    } else if (e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <div
      className={cardClass}
      data-roster-card
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
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
            {isGK && !allowGKSelect && <span className={styles.lockedBadge}>LOCK</span>}
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
  onResume,
}: Props) {
  const currentPlayerLabel = playerSlot === 1 ? 'HOME' : 'VISITOR';
  const waitingForLabel = playerSlot === 1 ? 'Visitor' : 'Home';
  const isActiveNow = !lineupConfirmed;

  // D-19/D-22: selection state is local — never in Zustand (Pitfall 7)
  // Phase 47 (ROSTER-07/D-12): Standard pregame lineup swap selection — the
  // currently selected slot index (GK slot, index 0, is never selectable).
  const [pregameSelectedSlotIndex, setPregameSelectedSlotIndex] = useState<number | null>(null);

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
    } else if (gameError === 'REPOSITION_SLOT_OCCUPIED') {
      message = 'Swap rejected — another player is already in that position.';
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

  /** Phase 29 D-06/D-08, Phase 47 (D-11): single parent-owned selection —
   * resolves every click; children only report which card/area was clicked. */
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null);

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
  // (setRejectionMessage fires on the rejection-message timeout). draftView.benchIds gets a NEW reference
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
    // changes — unrelated local-state re-renders (selection changes, rejection-message timeout)
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

  /** Phase 47 (D-08/D-10, T-47-10): positioning-mode selection — the
   * currently selected on-pitch card's id. Deliberately a scalar, not a
   * tagged union shared with substitution mode — this is the D-10
   * discretion call that structurally enforces the D-07/D-08 asymmetry a
   * shared union would invite collapsing. */
  const [repositionSelectedPieceId, setRepositionSelectedPieceId] = useState<string | null>(null);
  /** Phase 47 (D-06/D-07/D-10, T-47-10): substitution-mode selection — the
   * currently selected bench card's PLAYER_POOL id. */
  const [substituteSelectedPlayerId, setSubstituteSelectedPlayerId] = useState<string | null>(null);

  /** Plan 08 (SUB-13/14/15): the one substitution currently staged awaiting
   * confirm/cancel. Deliberately NOT cleared by the mode-toggle clearing
   * below — a staged substitution survives a click elsewhere, since the
   * confirmation popup (not the click gesture) is what resolves it. */
  const [pendingSub, setPendingSub] = useState<PendingSubstitution | null>(null);

  /** Phase 47 (ROSTER-05, Pitfall 5 HARD CONSTRAINT): positioning-mode
   * selectability — reproduces the pre-Phase-47 selectability conditions
   * verbatim, now gating click instead of the legacy pointer-based gesture.
   * D-09: the GK card is never selectable in positioning mode. */
  function isRepositionSelectable(piece: PlayerPiece): boolean {
    const parsedSlotIndex = /-(\d+)$/.exec(piece.id);
    const slotIndexNum = parsedSlotIndex !== null ? Number(parsedSlotIndex[1]) : null;
    return (
      subMode === 'reposition' &&
      readOnly !== true &&
      actionPending !== true &&
      isActivePiece(piece) &&
      slotIndexNum !== 0 &&
      piece.role !== 'GK' &&
      pendingSub === null
    );
  }

  /** Phase 47 (ROSTER-02/05): positioning-mode target eligibility. Every
   * rendered mid-match card other than the source is an eligible target,
   * INCLUDING the GK card — the pre-Phase-47 target-hover logic applied no
   * GK check to the target, and the server's `GK_SLOT_LOCKED` rejection is
   * the existing, deliberately-preserved feedback path (D-09 restricts GK
   * selectability only, not target eligibility). */
  function isRepositionEligible(sourcePieceId: string, targetPieceId: string): boolean {
    return (
      subMode === 'reposition' &&
      readOnly !== true &&
      actionPending !== true &&
      pendingSub === null &&
      targetPieceId !== sourcePieceId
    );
  }

  /** Phase 47 (ROSTER-01/03/04, D-08, Pitfall 5 HARD CONSTRAINT): the
   * positioning-mode click handler — click-select/deselect/complete,
   * structurally separate from `handleSubstitutePitchClick` below (shares no
   * guard body). D-08: there is NO "switch selection" branch here — with a
   * card already selected, clicking a different eligible card runs the
   * completion path, never a re-select. */
  function handleRepositionCardClick(pieceId: string) {
    if (repositionSelectedPieceId === pieceId) {
      setRepositionSelectedPieceId(null); // ROSTER-03
      return;
    }
    if (repositionSelectedPieceId !== null) {
      if (!isRepositionEligible(repositionSelectedPieceId, pieceId)) return; // D-04 no-op
      onReposition?.(repositionSelectedPieceId, pieceId); // ROSTER-04
      setRepositionSelectedPieceId(null);
      return;
    }
    const piece = midmatchPieces?.find((p) => p.id === pieceId);
    if (piece && isRepositionSelectable(piece)) {
      setRepositionSelectedPieceId(pieceId);
    }
  }

  /** Phase 47 (ROSTER-02/05): substitution-mode target eligibility —
   * structurally separate from `isRepositionEligible` above (shares no
   * guard body). */
  function isSubstituteEligible(piece: PlayerPiece): boolean {
    return (
      subMode === 'substitute' &&
      readOnly !== true &&
      pendingSub === null &&
      substituteSelectedPlayerId !== null &&
      isActivePiece(piece) &&
      piece.redCarded !== true
    );
  }

  /** Phase 47 (D-06, Pitfall 5 HARD CONSTRAINT): bench-first on-pitch
   * completion click — structurally separate from `handleRepositionCardClick`
   * above (shares no guard body). Preserves the pre-Phase-47 staging body
   * verbatim. */
  function handleSubstitutePitchClick(piece: PlayerPiece) {
    if (substituteSelectedPlayerId === null) return; // D-06: bench-first only
    if (!isSubstituteEligible(piece)) return; // D-04 no-op
    const inPlayerId = substituteSelectedPlayerId;
    const inPlayer = PLAYER_MAP.get(inPlayerId);
    if (!inPlayer) return; // don't stage a popup with a blank name
    const inName = `${inPlayer.firstName} ${inPlayer.lastName}`;
    setPendingSub({
      outPieceId: piece.id,
      inPlayerId,
      outName: `${piece.firstName} ${piece.lastName}`,
      outNumber: piece.number,
      inName,
    });
    setSubstituteSelectedPlayerId(null);
  }

  /** Phase 42 (gap item 6, Task 2 action B): best-effort UX pre-gate — hexes held by
   * this caller's own ACTIVE pieces, keyed `${q},${r}` (mirrors gameEngine.ts's
   * destination-occupancy `isActivePiece` convention in `applyRosterReposition`'s
   * guard 7). `midmatchPieces` (`GameBoard.tsx`:
   * `pieces.filter((p) => p.teamId === myTeam)`) only ever contains this caller's OWN
   * team's pieces, so an OPPONENT's active piece standing on a dismissed teammate's
   * frozen hex is invisible here — best-effort only. The server's
   * server's destination-occupancy guard remains authoritative for that case. */
  const ownActiveHexKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const piece of midmatchPieces ?? []) {
      if (isActivePiece(piece)) keys.add(`${piece.position.q},${piece.position.r}`);
    }
    return keys;
  }, [midmatchPieces]);

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

            // Phase 47 (ROSTER-02/05): per-mode eligible-target derivation
            // computed from the active selection — reposition mode consults
            // isRepositionEligible, substitute mode consults
            // isSubstituteEligible. Structurally separate per-mode, matching
            // the click handlers below (Pitfall 5 HARD CONSTRAINT).
            const isEligibleTargetHere =
              subMode === 'reposition'
                ? repositionSelectedPieceId !== null &&
                  isRepositionEligible(repositionSelectedPieceId, piece.id)
                : isSubstituteEligible(piece);

            // Phase 42 (Task 2 action B, D-05/D-06/SUB-18): a dismissed piece
            // is never rendered as a LineupStatCard — its slot renders the
            // SENT OFF placeholder instead. The slot remains a valid click
            // target for another on-field player being repositioned into it
            // (not permanently locked, D-05) — the server accepts a
            // red-carded piece as a legal reposition participant (42-06).
            if (!isActivePiece(piece)) {
              // Phase 42 gap item 6 (Task 2 action C): best-effort UX pre-gate — true
              // when one of the caller's own active pieces is already standing on
              // this dismissed piece's frozen hex, i.e. the server's
              // server's destination-occupancy guard would refuse a reposition drop here.
              // Own-team-only (see `ownActiveHexKeys`'s doc comment above); the
              // server remains authoritative for an opponent piece on this hex.
              const sentOffSlotHexTaken = ownActiveHexKeys.has(
                `${piece.position.q},${piece.position.r}`,
              );
              // Phase 47 (D-05, RESEARCH.md Pitfall 3): eligible ONLY in
              // positioning mode with an active, non-self, non-occupied
              // selection — NEVER eligible in substitution mode. Deliberate
              // behaviour change from the pre-Phase-47 implementation (D-05
              // supersedes today's unconditional substitute-mode target).
              const sentOffEligible =
                subMode === 'reposition' &&
                repositionSelectedPieceId !== null &&
                repositionSelectedPieceId !== piece.id &&
                !sentOffSlotHexTaken &&
                readOnly !== true &&
                actionPending !== true &&
                pendingSub === null;
              return (
                <div
                  key={piece.id}
                  className={
                    sentOffEligible
                      ? `${styles.statCardSentOff} ${styles.statCardEligible}`
                      : styles.statCardSentOff
                  }
                  aria-label="Sent off — slot empty"
                  role="img"
                  data-roster-card
                  {...(sentOffEligible
                    ? { onClick: () => handleRepositionCardClick(piece.id) }
                    : {})}
                >
                  <span className={styles.sentOffBadge}>SENT OFF</span>
                </div>
              );
            }

            return (
              <LineupStatCard
                key={piece.id}
                player={piece}
                slotIndex={i}
                isSelected={subMode === 'reposition' && repositionSelectedPieceId === piece.id}
                isEligibleTarget={isEligibleTargetHere}
                lineupConfirmed={false}
                teamId={myTeamId}
                mode="midmatch"
                cardColor={cardColorFor(piece)}
                injuryCount={piece.injuryCount ?? 0}
                isSubBlocked={isBlocked}
                isSelectable={isRepositionSelectable(piece)}
                onClick={() =>
                  subMode === 'reposition'
                    ? handleRepositionCardClick(piece.id)
                    : handleSubstitutePitchClick(piece)
                }
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

  /** Phase 47 (ROSTER-07/D-12): the GK-slot exclusion (`idx === 0`) is the
   * pre-Phase-47 hover/completion rule carried over verbatim. */
  function isPregameSwapEligible(sourceIdx: number, targetIdx: number): boolean {
    return lineupConfirmed !== true && targetIdx !== 0 && sourceIdx !== targetIdx;
  }

  /** Phase 47 (ROSTER-01/03/04/07, D-12): the pregame swap click handler —
   * same three-branch shape as `handleRepositionCardClick`. */
  function handlePregameCardClick(idx: number) {
    if (lineupConfirmed === true) return;
    if (pregameSelectedSlotIndex === idx) {
      setPregameSelectedSlotIndex(null);
      return;
    }
    if (pregameSelectedSlotIndex !== null) {
      if (!isPregameSwapEligible(pregameSelectedSlotIndex, idx)) return; // D-04 no-op
      onSwap(pregameSelectedSlotIndex, idx);
      setPregameSelectedSlotIndex(null);
      return;
    }
    // GK slot (idx 0) is never selectable — mirrors the pre-Phase-47
    // `!isGK && !lineupConfirmed` selectability rule (D-09-equivalent for pregame).
    if (idx !== 0) setPregameSelectedSlotIndex(idx);
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
              isSelected={pregameSelectedSlotIndex === slotIndex}
              isEligibleTarget={
                pregameSelectedSlotIndex !== null &&
                isPregameSwapEligible(pregameSelectedSlotIndex, slotIndex)
              }
              lineupConfirmed={lineupConfirmed}
              teamId={myTeamId}
              onClick={() => handlePregameCardClick(slotIndex)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Phase 29: draft-mode column building + click-select wiring (additive; Standard-mode
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

  /** Phase 47 (D-11/ROSTER-08): pure predicate extracted from `rejectForGKRule`
   * below — contains only the two GK-rule conditions, no message side effect,
   * so it is safe to call from render-time eligibility computation. */
  function violatesGKRule(slotIndex: number, cardId: string): boolean {
    const isGKSlot = slotIndex === 0;
    const cardIsGK = isCardGK(cardId);
    return (isGKSlot && !cardIsGK) || (!isGKSlot && cardIsGK);
  }

  /** D-09: only a GK card may land on the GK slot (index 0), and only the GK slot accepts a
   * GK card — both directions rejected client-side for UX only (server, Plan 04, is authoritative).
   * Phase 47: rewritten to call `violatesGKRule`; keeps the message side effect, so it must
   * only be called from a click-completion handler, never from render-time eligibility. */
  function rejectForGKRule(slotIndex: number, cardId: string): boolean {
    const isGKSlot = slotIndex === 0;
    if (!violatesGKRule(slotIndex, cardId)) return false;
    if (isGKSlot) {
      showDraftRejection('Swap rejected — only a goalkeeper card can be placed here.');
    } else {
      showDraftRejection('Swap rejected — goalkeeper slot requires a GK card.');
    }
    return true;
  }

  function showDraftRejection(message: string) {
    setRejectionMessage(message);
    setTimeout(() => setRejectionMessage(null), 2000);
  }

  /** Phase 47 (ROSTER-02/08): every slot other than the selection's own origin
   * slot is an eligible target. Deliberately does NOT consult `violatesGKRule`
   * here — the pre-Phase-47 target-hover logic applied no GK check when
   * highlighting, and the GK rule is enforced at completion time by
   * `rejectForGKRule`'s user-facing message; excluding GK-violating slots here
   * would make that message unreachable. */
  function isDraftSlotEligible(selection: DraftSelection, slotIndex: number): boolean {
    return (
      lineupConfirmed !== true &&
      !(selection.source === 'slot' && selection.slotIndex === slotIndex)
    );
  }

  /** Phase 47 (ROSTER-02/08): the pre-Phase-47 bench-completion logic no-oped
   * for a bench-sourced selection — pack->bench and slot->bench are the two
   * legal bench completions. */
  function isDraftBenchAreaEligible(selection: DraftSelection): boolean {
    return lineupConfirmed !== true && selection.source !== 'bench';
  }

  /** Phase 47 (D-11, Pitfall 5 HARD CONSTRAINT): pack-card selection mirrors
   * mid-match substitution's bench-first pattern — a click on a different
   * pack card always switches the selection (no explicit deselect step). */
  function handleDraftPackCardClick(cardId: string) {
    if (draftView?.waitingForOpponent === true || lineupConfirmed === true) return;
    if (draftSelection?.source === 'pack' && draftSelection.cardId === cardId) {
      setDraftSelection(null); // deselect
      return;
    }
    setDraftSelection({ cardId, source: 'pack' });
  }

  /** Phase 47 (D-11, Pitfall 5 HARD CONSTRAINT): filled-slot/empty-slot click —
   * source selection (swap-pattern, like positioning mode) when nothing is
   * selected, deselect on a second click of the same slot, otherwise a
   * completion attempt. */
  function handleDraftSlotClick(slotIndex: number, cardIdAtSlot: string | null) {
    if (draftSelection === null) {
      if (cardIdAtSlot !== null && lineupConfirmed !== true) {
        setDraftSelection({ cardId: cardIdAtSlot, source: 'slot', slotIndex });
      }
      return; // an empty slot with nothing selected is a no-op
    }
    if (draftSelection.source === 'slot' && draftSelection.slotIndex === slotIndex) {
      setDraftSelection(null); // ROSTER-03 deselect
      return;
    }
    if (!isDraftSlotEligible(draftSelection, slotIndex)) return; // D-04 no-op
    if (rejectForGKRule(slotIndex, draftSelection.cardId)) {
      setDraftSelection(null); // message already shown
      return;
    }
    if (draftSelection.source === 'pack') {
      onDraftPick?.(draftSelection.cardId, { type: 'slot', slotIndex });
    } else if (draftSelection.source === 'slot') {
      onDraftRearrange?.(
        { type: 'slot', slotIndex: draftSelection.slotIndex },
        { type: 'slot', slotIndex },
      );
    } else {
      onDraftRearrange?.(
        { type: 'bench', benchIndex: draftSelection.benchIndex },
        { type: 'slot', slotIndex },
      );
    }
    setDraftSelection(null);
  }

  /** Phase 47 (D-11): a bench card is a swap-pattern source like a filled
   * slot — clicking a different bench card while one is selected re-selects
   * it (bench cards are never completion targets in draft mode — the bench
   * AREA is, see `handleDraftBenchAreaClick`). */
  function handleDraftBenchCardClick(benchIndex: number) {
    const cardId = draftView?.benchIds[benchIndex];
    if (!cardId) return;
    if (lineupConfirmed === true) return;
    if (draftSelection?.source === 'bench' && draftSelection.benchIndex === benchIndex) {
      setDraftSelection(null); // deselect
      return;
    }
    setDraftSelection({ cardId, source: 'bench', benchIndex });
  }

  /** Phase 47 (D-11): the bench-area click-completion target — pack->bench
   * pick, slot->bench move (append-position semantics unchanged from the
   * pre-Phase-47 bench-completion logic). */
  function handleDraftBenchAreaClick() {
    if (draftSelection === null || !draftView) return;
    if (!isDraftBenchAreaEligible(draftSelection)) return;
    if (draftSelection.source === 'pack') {
      onDraftPick?.(draftSelection.cardId, { type: 'bench' });
    } else if (draftSelection.source === 'slot') {
      onDraftRearrange?.(
        { type: 'slot', slotIndex: draftSelection.slotIndex },
        { type: 'bench', benchIndex: draftView.benchIds.length },
      );
    }
    setDraftSelection(null);
  }

  /** Renders one draft-mode position column — filled slots use LineupStatCard (GK
   * selectable, D-08); empty slots reuse the dashed `.benchSlot` placeholder style
   * (D-22) and are still a valid click target. */
  function renderDraftColumn(label: string, entries: DraftColEntry[]) {
    return (
      <div className={styles.column}>
        <div className={styles.columnHeader}>{label}</div>
        <div className={styles.columnCards}>
          {entries.map(({ slotIndex, slotMeta, player }) => {
            const isEligibleHere =
              draftSelection !== null && isDraftSlotEligible(draftSelection, slotIndex);
            return player ? (
              <LineupStatCard
                key={slotIndex}
                player={player}
                slotMeta={slotMeta}
                slotIndex={slotIndex}
                isSelected={
                  draftSelection?.source === 'slot' && draftSelection.slotIndex === slotIndex
                }
                isEligibleTarget={isEligibleHere}
                lineupConfirmed={lineupConfirmed}
                teamId={myTeamId}
                allowGKSelect
                showTierBorder
                onClick={() => handleDraftSlotClick(slotIndex, player.id)}
              />
            ) : (
              <div
                key={slotIndex}
                className={
                  isEligibleHere
                    ? `${styles.benchSlot} ${styles.statCardEligible}`
                    : styles.benchSlot
                }
                data-slot-index={slotIndex}
                {...(isEligibleHere
                  ? {
                      onClick: () => handleDraftSlotClick(slotIndex, null),
                      role: 'button' as const,
                      tabIndex: 0,
                      onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                        if (e.key === 'Enter') {
                          handleDraftSlotClick(slotIndex, null);
                        } else if (e.key === ' ') {
                          e.preventDefault();
                          handleDraftSlotClick(slotIndex, null);
                        }
                      },
                    }
                  : {})}
              />
            );
          })}
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

    /** Phase 47 (D-06/D-07, Pitfall 5 HARD CONSTRAINT): bench-first source
     * click — structurally separate from `handleRepositionCardClick` (shares
     * no guard body). D-07: clicking a different eligible bench card while
     * one is already selected switches the selection without an explicit
     * deselect step first — bench-substitution-specific, NOT symmetric with
     * positioning mode (D-08). Defined here (not at module scope) because it
     * needs `midmatchBenchCards`, which only exists inside this render
     * branch — avoids duplicating the bench-card derivation. */
    function handleSubstituteBenchClick(benchIndex: number) {
      if (readOnly === true || subMode !== 'substitute' || pendingSub !== null) return;
      const card = midmatchBenchCards[benchIndex];
      if (!card) return;
      if (substituteSelectedPlayerId === card.id) {
        setSubstituteSelectedPlayerId(null); // explicit deselect
        return;
      }
      setSubstituteSelectedPlayerId(card.id); // D-07: switches selection, no deselect step required
    }

    return (
      <div className={styles.screen}>
        <h2 className={styles.matchSetupHeading}>Substitution</h2>
        <p className={styles.cyclePickCounter}>
          {readOnly === true
            ? 'Viewing roster — substitutions are only available during a stoppage in play.'
            : subMode === 'reposition'
              ? 'Select a player, then click another to swap positions.'
              : 'Select a bench card, then click an on-pitch card to substitute.'}
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
            disabled={readOnly === true || subMode === 'reposition' || pendingSub !== null}
            onCardClick={handleSubstituteBenchClick}
            selectedCardId={substituteSelectedPlayerId}
          />
          {showEmptyBenchCopy && (
            <p className={styles.cyclePickCounter}>No available substitutes on the bench.</p>
          )}
        </div>

        {/* Gap-closure (42-12 Task 2B, gap items 3/4): the Substitute/Cancel toggle and the
            Resume button now render together in one standard-size action row directly beneath
            the bench, inside this component's own scrolling `.screen` flow — not pinned to the
            bottom of `.substitutionModalCard` (the previous placement read as viewport-pinned
            in live verification). */}
        <div className={styles.midmatchActionRow}>
          {/* Phase 42 (SUB-11/SUB-12), Phase 47 (T-47-10/RESEARCH.md Anti-Pattern):
              mode-toggle button. Entering substitution mode clears any
              in-flight positioning-mode selection; Cancel returns to
              positioning mode and never calls onSubstitute. Both new
              selection state variables are cleared in BOTH buttons — the
              old partial-clear behaviour is NOT assumed sufficient. */}
          {subMode === 'reposition' ? (
            <button
              type="button"
              className={styles.rosterActionButton}
              aria-label="Enter substitution mode"
              disabled={readOnly === true || subsUsedVal >= MAX_SUBS_PER_TEAM}
              aria-disabled={readOnly === true || subsUsedVal >= MAX_SUBS_PER_TEAM}
              onClick={() => {
                setSubMode('substitute');
                setRepositionSelectedPieceId(null);
                setSubstituteSelectedPlayerId(null);
                // Defensive: entering substitution mode should never carry over
                // a stale pending selection from a prior mode session.
                setPendingSub(null);
              }}
            >
              Substitute
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.rosterActionButton} ${styles.rosterActionButtonCancel}`}
              aria-label="Cancel substitution"
              onClick={() => {
                setSubMode('reposition');
                setRepositionSelectedPieceId(null);
                setSubstituteSelectedPlayerId(null);
                setPendingSub(null);
              }}
            >
              Cancel
            </button>
          )}

          {onResume !== undefined && (
            <button
              type="button"
              className={styles.resumeButton}
              aria-label="Resume match"
              onClick={onResume}
            >
              Resume
            </button>
          )}
        </div>

        {/* Plan 08 (SUB-13/14/15): confirmation popup — mirrors ActionPanel's
            withEndTurnConfirm/confirmDialog pattern (`stagedSub` is captured
            into a local const here so the confirm handler below can't read a
            nulled value after `setPendingSub(null)`). */}
        {pendingSub !== null &&
          (() => {
            const stagedSub = pendingSub;
            return (
              <div className={styles.subConfirmOverlay} role="dialog" aria-modal="true">
                <div className={styles.subConfirmCard}>
                  <p className={styles.subConfirmText}>
                    Substitute {stagedSub.outName} for {stagedSub.inName}?
                  </p>
                  <div className={styles.subConfirmActions}>
                    <button
                      type="button"
                      className={`${styles.subModeButton} ${styles.subConfirmButtonCancel}`}
                      aria-label="Cancel substitution selection"
                      onClick={() => {
                        setPendingSub(null);
                        setRepositionSelectedPieceId(null);
                        setSubstituteSelectedPlayerId(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`${styles.subModeButton} ${styles.subConfirmButtonReady}`}
                      aria-label="Confirm substitution"
                      onClick={() => {
                        onSubstitute?.(stagedSub.outPieceId, stagedSub.inPlayerId);
                        setPendingSub(null);
                        setSubMode('reposition');
                        setRepositionSelectedPieceId(null);
                        setSubstituteSelectedPlayerId(null);
                      }}
                    >
                      Confirm Substitution
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

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
      <div className={styles.screen}>
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
            onCardClick={handleDraftPackCardClick}
            selectedCardId={draftSelection?.source === 'pack' ? draftSelection.cardId : null}
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
            onCardClick={handleDraftBenchCardClick}
            onBenchAreaClick={handleDraftBenchAreaClick}
            benchAreaEligible={draftSelection !== null && isDraftBenchAreaEligible(draftSelection)}
            selectedCardId={draftSelection?.source === 'bench' ? draftSelection.cardId : null}
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

  // CLEANUP bug fix: standard-mode teams have exactly 11 players each (see teams.ts —
  // every named team's sourceTeamId maps to precisely 11 pool entries), so there is
  // never a real squad remainder to bench. A standard room's bench is therefore always
  // the Phase 46 generic placeholder bench for this player's side — the same
  // getGenericBenchPlayers fallback roomHandlers.ts's LINEUP_CONFIRM uses server-side
  // once the match starts, computed here client-side from the shared PLAYER_POOL so it
  // renders during Step 3 instead of only after confirm. This section was previously
  // "structural only" (D-17): five inert placeholder divs with no data.
  const pregameBenchSide: 'home' | 'away' = playerSlot === 1 ? 'home' : 'away';
  const pregameGenericBench = getGenericBenchPlayers(pregameBenchSide);
  const pregameBenchCards: TieredPoolPlayer[] = pregameGenericBench
    .map((p) => resolveTieredCard(p.id))
    .filter((c): c is TieredPoolPlayer => c !== null);
  const pregameBenchNumbers: Record<string, number> = {};
  for (const p of pregameGenericBench) pregameBenchNumbers[p.id] = p.number;

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

      <div className={styles.benchSection}>
        <span className={styles.benchLabel}>BENCH</span>
        <BenchCarousel
          cards={pregameBenchCards}
          teamId={myTeamId}
          benchNumbers={pregameBenchNumbers}
          disabled
          onCardClick={() => {}}
        />
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
