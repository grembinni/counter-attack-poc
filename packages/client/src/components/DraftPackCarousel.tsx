/**
 * DraftPackCarousel — Phase 29 D-20.
 *
 * A left-right navigable carousel of draft-pack cards. Renders any number of
 * cards (4-card packs per round, D-12..D-16 Phase 30) sorted rarest-first
 * (Chase, Rare, Uncommon, Common) and resets scroll to the leftmost card
 * whenever a new pack loads (D-20).
 *
 * Cards in this row are DRAG SOURCES ONLY (D-06) — they carry a `pack:`-
 * prefixed cardId via dataTransfer and expose no onDragOver/onDrop handler,
 * so a card can never be dragged back into the draft-pack row once picked.
 *
 * `DraftCardBody` (the shared inner card renderer) and `TIER_CARD_CLASS` are
 * exported for reuse by `BenchCarousel` (D-21 — identical card style, drag
 * source AND drop target).
 */
import { useEffect, useRef, useState } from 'react';
import type { DraftTier, TeamId, TieredPoolPlayer } from '@counter-attack/shared';
import { TeamBadge } from './TeamBadge.js';
import { NationFlag } from './NationFlag.js';
import { STAT_LABELS } from './PlayerStatsPanel.js';
import styles from './LineupAssignmentScreen.module.css';

/** Rarest-first tier order (D-20). Narrowed to 4 values — 'keeper' removed (D-05, Phase 30).
 * Module-internal only — no other file sorts by tier order. */
const TIER_ORDER: DraftTier[] = ['chase', 'rare', 'uncommon', 'common'];

/** Tier -> tier-border CSS class map (D-17/D-19). Narrowed to 4 entries (D-05, Phase 30) —
 * no 5th 'keeper' color; GK cards resolve to whichever of chase/rare/uncommon/common their
 * total stat lands them in, same as any outfield card (D-04/D-05).
 * Non-null assertions: noUncheckedIndexedAccess types CSS-module property
 * access as `string | undefined`, but every class below is declared verbatim
 * in LineupAssignmentScreen.module.css (see the tier-border block), so the
 * access is always defined at runtime. */
export const TIER_CARD_CLASS: Record<DraftTier, string> = {
  chase: styles.cardTierChase!,
  rare: styles.cardTierRare!,
  uncommon: styles.cardTierUncommon!,
  common: styles.cardTierCommon!,
};

/** Color tier for stat badge — mirrors LineupAssignmentScreen.statTier. */
function statTier(value: number): 'high' | 'mid' | 'low' {
  if (value >= 5) return 'high';
  if (value >= 3) return 'mid';
  return 'low';
}

type DraftCardBodyProps = {
  card: TieredPoolPlayer;
  teamId: TeamId;
  /** Shown in the header slot where LineupStatCard shows the jersey number
   * (BenchCarousel passes benchNumbers once the draft completes). */
  jerseyNumber?: number;
  draggable: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
};

/**
 * Shared inner card renderer — mirrors LineupStatCard's TeamBadge/cardBody/
 * cardHeader/statGrid/statChip markup exactly (D-18: card content unchanged),
 * with the tier border swapped in via TIER_CARD_CLASS (D-19) in place of the
 * base 1px card border. Reused by DraftPackCarousel (drag source only) and
 * BenchCarousel (drag source + drop target).
 */
export function DraftCardBody({
  card,
  teamId,
  jerseyNumber,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: DraftCardBodyProps) {
  const isGK = card.role === 'GK';

  return (
    <div
      className={TIER_CARD_CLASS[card.tier]}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Flat layout: [TeamBadge] [name/flag/role header + stat chips] — identical to LineupStatCard */}
      <TeamBadge teamId={teamId} size={48} />
      <div className={styles.cardBody}>
        <div className={styles.cardHeader}>
          <span className={styles.cardName}>
            {card.firstName} {card.lastName}
          </span>
          <div className={styles.cardMeta}>
            <NationFlag nationality={card.nationality} size={14} />
            <span className={styles.cardRole}>{card.role}</span>
            {jerseyNumber !== undefined && <span className={styles.cardNum}>#{jerseyNumber}</span>}
          </div>
        </div>
        <div className={styles.statGrid}>
          {STAT_LABELS.filter(([attr]) => {
            if (attr === 'resilience') return false;
            if (isGK) return attr !== 'shooting' && attr !== 'highPass';
            return attr !== 'saving' && attr !== 'handling';
          }).map(([attr, abbr, fullLabel]) => {
            const value = card[attr as keyof TieredPoolPlayer] as number;
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

type DraftPackCarouselProps = {
  /** The current pack's cards — always 4 (RoundConfig.cardsPerPack, D-12..D-16, Phase 30). */
  cards: TieredPoolPlayer[];
  teamId: TeamId;
  /** D-12: true while waiting for the opponent's pick — row dims and stops accepting drag. */
  disabled: boolean;
  /** Called on drag-start with the dragged card's id (the pick signal, D-03). */
  onCardDragStart: (cardId: string) => void;
};

/** Approximate per-card scroll step (card min-width 320px + 8px gap, DRAFT-06
 * gap-closure card-widening — 29-08-PLAN.md Task 1). */
const SCROLL_STEP_PX = 328;

export function DraftPackCarousel({
  cards,
  teamId,
  disabled,
  onCardDragStart,
}: DraftPackCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // D-19/Pitfall 7: drag/scroll UI state is local — never in Zustand.
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // D-20: sort rarest-first; stable within a tier (Array.prototype.sort is stable).
  const sortedCards = [...cards].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );

  function updateScrollState() {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  // D-20: reset scroll position to the leftmost card whenever the pack (cards
  // prop identity/length) changes, so each new pack opens scrolled-left.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    updateScrollState();
  }, [cards]);

  function scrollByCard(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: 'smooth' });
    // Smooth scroll settles asynchronously — re-check disabled state shortly after.
    setTimeout(updateScrollState, 300);
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, cardId: string) {
    // D-06: drag SOURCE only — no onDragOver/onDrop on these cards (one-way out).
    e.dataTransfer.setData('text/plain', `pack:${cardId}`);
    e.dataTransfer.effectAllowed = 'move';
    onCardDragStart(cardId);
  }

  const rowClass = disabled
    ? `${styles.draftPackRow} ${styles.draftRowDisabled}`
    : styles.draftPackRow;
  const prevClass = canScrollLeft
    ? styles.carouselNav
    : `${styles.carouselNav} ${styles.carouselNavDisabled}`;
  const nextClass = canScrollRight
    ? styles.carouselNav
    : `${styles.carouselNav} ${styles.carouselNavDisabled}`;

  return (
    <div className={rowClass}>
      <div className={styles.carouselViewport}>
        <button
          type="button"
          className={prevClass}
          aria-label="Previous card"
          disabled={!canScrollLeft}
          onClick={() => scrollByCard(-1)}
        >
          &lsaquo;
        </button>
        <div className={styles.carouselTrack} ref={trackRef} onScroll={updateScrollState}>
          {sortedCards.map((card) => (
            <DraftCardBody
              key={card.id}
              card={card}
              teamId={teamId}
              draggable={!disabled}
              onDragStart={(e) => handleDragStart(e, card.id)}
            />
          ))}
        </div>
        <button
          type="button"
          className={nextClass}
          aria-label="Next card"
          disabled={!canScrollRight}
          onClick={() => scrollByCard(1)}
        >
          &rsaquo;
        </button>
      </div>
    </div>
  );
}
