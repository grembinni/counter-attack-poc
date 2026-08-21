/**
 * BenchCarousel — Phase 29 D-08/D-09/D-21, reworked into a real carousel in
 * Phase 29 gap-closure (29-08-PLAN.md Task 1, DRAFT-09/D-21).
 *
 * A dynamically sized (0..17 cards, D-09/D-16 Phase 30 — 6-round/17-card draft model)
 * left-right navigable carousel
 * reusing the exact same card style AND carousel chrome as
 * DraftPackCarousel (D-21 — DraftCardBody + TIER_CARD_CLASS + carouselViewport/
 * carouselTrack/carouselNav). Unlike the draft-pack row, the bench is BOTH a
 * drag source (dragging a benched card back onto the lineup, D-08) AND a drop
 * target (dragging a card from the draft-pack row, or from a lineup slot,
 * onto the bench).
 *
 * The bench container's onDrop is intentionally payload-free — it only
 * signals that *a* drop landed on the bench. Resolving WHICH card was
 * dragged and its origin is the parent's (LineupAssignmentScreen, Plan 05)
 * job, tracked via a single parent-owned drag-state variable set through the
 * onCardDragStart callbacks. This component must never read dataTransfer to
 * decide anything (see `<action>` in 29-03-PLAN.md Task 2).
 */
import { useEffect, useRef, useState } from 'react';
import type { TeamId, TieredPoolPlayer } from '@counter-attack/shared';
import { DraftCardBody } from './DraftPackCarousel.js';
import type { BenchCardStatus } from './CardInjuryBadge.js';
import styles from './LineupAssignmentScreen.module.css';

type BenchCarouselProps = {
  /** Benched cards — dynamic length, 0..16 (D-09). */
  cards: TieredPoolPlayer[];
  teamId: TeamId;
  /** Jersey numbers by card id — shown once the draft completes (D-15). */
  benchNumbers?: Record<string, number>;
  /** Phase 40 (SUB-07): card ids (PLAYER_POOL ids) that have been substituted out —
   * rendered with an "OUT" badge, dimmed, and non-draggable. Undefined in every
   * pre-match (draft) call site — pre-match draft usage is unaffected. */
  unavailablePlayerIds?: readonly string[];
  /** Phase 40 (D-13): card ids that have been sent off — rendered with a distinct
   * "RED CARD" badge (takes precedence over unavailablePlayerIds), dimmed, and
   * non-draggable. Undefined in every pre-match (draft) call site. */
  redCardedPlayerIds?: readonly string[];
  /** Phase 41 (ICON-03): `benchCardStatus` is per-card disciplinary/fitness glyph state,
   * keyed by PLAYER_POOL card id (the same key space as `unavailablePlayerIds`/
   * `redCardedPlayerIds`/`benchNumbers`). Undefined in every pre-match (draft) call
   * site — pre-match bench cards have no card/injury state and render no glyph,
   * exactly as before. */
  benchCardStatus?: Readonly<Record<string, BenchCardStatus>>;
  /** Checkpoint gap-closure (40-07 Task 2 human-verify feedback): true when the
   * whole bench is view-only (mid-match panel opened outside a stoppage) — every
   * card becomes non-draggable regardless of unavailable/redCarded state, and a
   * drop on the bench is a no-op. Undefined/false in every other call site
   * (pre-match draft never sets this — the bench is always interactive there). */
  disabled?: boolean;
  /** Called on drag-start with the dragged card's bench index (source-tracking only —
   * the parent resolves which card/origin this refers to). */
  onCardDragStart: (benchIndex: number) => void;
  /** Called when a drag lands on the bench — payload-free BY DESIGN. */
  onDropToBench: () => void;
};

/** Approximate per-card scroll step (card min-width 320px + 8px gap) — mirrors
 * DraftPackCarousel's SCROLL_STEP_PX exactly (D-21: identical carousel chrome). */
const SCROLL_STEP_PX = 328;

export function BenchCarousel({
  cards,
  teamId,
  benchNumbers,
  unavailablePlayerIds,
  redCardedPlayerIds,
  benchCardStatus,
  disabled,
  onCardDragStart,
  onDropToBench,
}: BenchCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // D-19/Pitfall 7: drag/scroll UI state is local — never in Zustand.
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  // Gap-closure 29-12 (DRAFT-09): content-derived key instead of the `cards` array
  // identity — card ids are unique and order-significant, so benchKey changes only
  // when the benched card set or its order genuinely changes. This makes the reset
  // resilient to ANY caller's reference churn (belt-and-suspenders alongside the
  // parent-side benchCards memoization in LineupAssignmentScreen.tsx).
  const benchKey = cards.map((c) => c.id).join('|');

  // Mirrors DraftPackCarousel's D-20 reset: scroll to the leftmost card
  // whenever the bench content (benchKey) genuinely changes.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    updateScrollState();
  }, [benchKey]);

  function scrollByCard(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: 'smooth' });
    // Smooth scroll settles asynchronously — re-check disabled state shortly after.
    setTimeout(updateScrollState, 300);
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, benchIndex: number, cardId: string) {
    // Checkpoint gap-closure (40-07): a disabled (read-only) bench never starts a
    // drag at all, regardless of the card's own availability state.
    if (disabled === true) return;
    // Phase 40 (SUB-07/D-13): a card that is OUT or RED CARD is never a drag
    // source — a single combined guard is fine here because both mean "not a
    // drag source"; the visual distinction lives in the badge, not the drag
    // behaviour (BenchCarousel.tsx module doc / D-13).
    if (unavailablePlayerIds?.includes(cardId) || redCardedPlayerIds?.includes(cardId)) return;
    // Native HTML5 drag initiation requires a dataTransfer payload, but this
    // string is NOT the resolution channel (see module doc) — the parent
    // resolves drag source/origin from onCardDragStart(benchIndex) instead.
    e.dataTransfer.setData('text/plain', `bench:${benchIndex}`);
    e.dataTransfer.effectAllowed = 'move';
    onCardDragStart(benchIndex);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled === true) return;
    onDropToBench();
  }

  const prevClass = canScrollLeft
    ? styles.carouselNav
    : `${styles.carouselNav} ${styles.carouselNavDisabled}`;
  const nextClass = canScrollRight
    ? styles.carouselNav
    : `${styles.carouselNav} ${styles.carouselNavDisabled}`;

  // D-22: empty bench (0 cards) reuses the existing dashed-placeholder style —
  // no new empty-state component. The whole container (including the
  // placeholder) remains a valid drop target.
  if (cards.length === 0) {
    return (
      <div
        className={styles.benchCarousel}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-testid="bench-carousel"
      >
        <div className={styles.carouselViewport}>
          <div className={styles.benchSlot} data-bench-index={0} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.benchCarousel}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-testid="bench-carousel"
    >
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
          {cards.map((card, benchIndex) => {
            const jerseyNumber = benchNumbers?.[card.id];
            const status = benchCardStatus?.[card.id];
            return (
              <DraftCardBody
                key={card.id}
                card={card}
                teamId={teamId}
                {...(jerseyNumber !== undefined ? { jerseyNumber } : {})}
                draggable={disabled !== true}
                unavailable={unavailablePlayerIds?.includes(card.id) ?? false}
                redCarded={redCardedPlayerIds?.includes(card.id) ?? false}
                cardColor={status?.cardColor ?? null}
                injuryCount={status?.injuryCount ?? 0}
                onDragStart={(e) => handleDragStart(e, benchIndex, card.id)}
              />
            );
          })}
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
