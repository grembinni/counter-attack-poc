/**
 * BenchCarousel — Phase 29 D-08/D-09/D-21.
 *
 * A dynamically sized (0..16 cards, D-09) row reusing the exact same card
 * style as DraftPackCarousel (D-21 — DraftCardBody + TIER_CARD_CLASS). Unlike
 * the draft-pack row, the bench is BOTH a drag source (dragging a benched
 * card back onto the lineup, D-08) AND a drop target (dragging a card from
 * the draft-pack row, or from a lineup slot, onto the bench).
 *
 * The bench container's onDrop is intentionally payload-free — it only
 * signals that *a* drop landed on the bench. Resolving WHICH card was
 * dragged and its origin is the parent's (LineupAssignmentScreen, Plan 05)
 * job, tracked via a single parent-owned drag-state variable set through the
 * onCardDragStart callbacks. This component must never read dataTransfer to
 * decide anything (see `<action>` in 29-03-PLAN.md Task 2).
 */
import type { TeamId, TieredPoolPlayer } from '@counter-attack/shared';
import { DraftCardBody } from './DraftPackCarousel.js';
import styles from './LineupAssignmentScreen.module.css';

type BenchCarouselProps = {
  /** Benched cards — dynamic length, 0..16 (D-09). */
  cards: TieredPoolPlayer[];
  teamId: TeamId;
  /** Jersey numbers by card id — shown once the draft completes (D-15). */
  benchNumbers?: Record<string, number>;
  /** Called on drag-start with the dragged card's bench index (source-tracking only —
   * the parent resolves which card/origin this refers to). */
  onCardDragStart: (benchIndex: number) => void;
  /** Called when a drag lands on the bench — payload-free BY DESIGN. */
  onDropToBench: () => void;
};

export function BenchCarousel({
  cards,
  teamId,
  benchNumbers,
  onCardDragStart,
  onDropToBench,
}: BenchCarouselProps) {
  function handleDragStart(e: React.DragEvent<HTMLDivElement>, benchIndex: number) {
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
    onDropToBench();
  }

  // D-22: empty bench (0 cards) reuses the existing dashed-placeholder style —
  // no new empty-state component.
  if (cards.length === 0) {
    return (
      <div
        className={styles.benchCarousel}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        data-testid="bench-carousel"
      >
        <div className={styles.benchSlot} data-bench-index={0} />
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
      {cards.map((card, benchIndex) => {
        const jerseyNumber = benchNumbers?.[card.id];
        return (
          <DraftCardBody
            key={card.id}
            card={card}
            teamId={teamId}
            {...(jerseyNumber !== undefined ? { jerseyNumber } : {})}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, benchIndex)}
          />
        );
      })}
    </div>
  );
}
