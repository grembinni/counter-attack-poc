/**
 * BenchCarousel — Phase 29 D-08/D-09/D-21, reworked into a real carousel in
 * Phase 29 gap-closure (29-08-PLAN.md Task 1, DRAFT-09/D-21).
 *
 * A dynamically sized (0..17 cards, D-09/D-16 Phase 30 — 6-round/17-card draft model)
 * left-right navigable carousel
 * reusing the exact same card style AND carousel chrome as
 * DraftPackCarousel (D-21 — DraftCardBody + TIER_CARD_CLASS + carouselViewport/
 * carouselTrack/carouselNav).
 *
 * Phase 47 (D-06/D-07/D-10/D-11, ROSTER-08): converted from the retired
 * native HTML5 pointer-carry source + drop target model to a click-select
 * SOURCE + click-completion TARGET. Unlike the draft-pack row (a click
 * source only), the bench is BOTH a click-select source — clicking an
 * available bench card reports its `benchIndex` via `onCardClick`
 * (mid-match substitution bench card; draft bench card being rearranged
 * into a slot) — AND a click-completion target — clicking the bench
 * container itself reports completion via `onBenchAreaClick` (draft
 * pack->bench pick, draft slot->bench move).
 *
 * Both `onCardClick(benchIndex)` and `onBenchAreaClick()` are intentionally
 * payload-free, by design (mirrors the retired pointer-carry contract
 * exactly). This component holds zero selection-resolution state of its
 * own — `selectedCardId` and `benchAreaEligible` are entirely parent-owned
 * (LineupAssignmentScreen). Resolving WHICH card is selected, its origin,
 * and whether the bench is currently a legal completion target is the
 * parent's job. This component must never infer selection/eligibility from
 * anything besides the props it's given (Phase 47 / D-10/D-11; mirrors this
 * component's own retired "must never read dataTransfer" convention).
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
   * rendered with an "OUT" badge, dimmed, and non-interactive. Undefined in every
   * pre-match (draft) call site — pre-match draft usage is unaffected. */
  unavailablePlayerIds?: readonly string[];
  /** Phase 40 (D-13): card ids that have been sent off — rendered with a distinct
   * "RED CARD" badge (takes precedence over unavailablePlayerIds), dimmed, and
   * non-interactive. Undefined in every pre-match (draft) call site. */
  redCardedPlayerIds?: readonly string[];
  /** Phase 41 (ICON-03): `benchCardStatus` is per-card disciplinary/fitness glyph state,
   * keyed by PLAYER_POOL card id (the same key space as `unavailablePlayerIds`/
   * `redCardedPlayerIds`/`benchNumbers`). Undefined in every pre-match (draft) call
   * site — pre-match bench cards have no card/injury state and render no glyph,
   * exactly as before. */
  benchCardStatus?: Readonly<Record<string, BenchCardStatus>>;
  /** Checkpoint gap-closure (40-07 Task 2 human-verify feedback): true when the
   * whole bench is view-only (mid-match panel opened outside a stoppage) — every
   * card becomes non-interactive regardless of unavailable/redCarded state, and
   * the bench container never completes a click. Undefined/false in every other
   * call site (pre-match draft never sets this — the bench is always interactive
   * there). */
  disabled?: boolean;
  /** Phase 47 (D-11): fires when an available bench card is clicked or activated
   * via Enter/Space, reporting that card's bench index only — the parent resolves
   * which card/origin this refers to (payload-free by design, same as the
   * retired pointer-carry-start contract it replaces). */
  onCardClick: (benchIndex: number) => void;
  /** Phase 47 (D-11): fires when the bench container itself is clicked while the
   * parent has marked it an eligible completion target (`benchAreaEligible`).
   * Optional — the mid-match call site has no bench-as-target semantics and
   * passes nothing. Payload-free by design (same as the old onDropToBench
   * contract) — the parent resolves what selection is being completed. */
  onBenchAreaClick?: () => void;
  /** Phase 47: the currently-selected bench card's PLAYER_POOL id, parent-owned —
   * applies the green .statCardSelected ring to the matching card. */
  selectedCardId?: string | null;
  /** Phase 47: true when the parent's current selection makes the bench
   * container itself a legal completion target — applies the blue
   * .statCardEligible ring to the container and, when also not disabled,
   * makes the container clickable/keyboard-activatable. */
  benchAreaEligible?: boolean;
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
  onCardClick,
  onBenchAreaClick,
  selectedCardId,
  benchAreaEligible,
}: BenchCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // D-19/Pitfall 7: scroll UI state is local — never in Zustand.
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

  /** Phase 47 (D-11/T-47-06): preserves the retired pointer-carry-source
   * guards verbatim, re-expressed for clicks — a disabled bench never starts
   * a selection, and an OUT or RED CARD bench card is never a selection
   * source, regardless of the badge that's shown for it. */
  function handleCardClick(benchIndex: number, cardId: string) {
    if (disabled === true) return;
    if (unavailablePlayerIds?.includes(cardId) || redCardedPlayerIds?.includes(cardId)) return;
    onCardClick(benchIndex);
  }

  /** Phase 47 (T-47-07): the bench container is clickable/keyboard-activatable
   * only when the parent has marked it an eligible completion target AND the
   * bench isn't disabled — otherwise no handler is attached at all (mirrors
   * DraftCardBody's identical click-gating idiom). */
  const isBenchAreaClickable = benchAreaEligible === true && disabled !== true;

  function handleBenchAreaKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!isBenchAreaClickable) return;
    if (e.key === 'Enter') {
      onBenchAreaClick?.();
    } else if (e.key === ' ') {
      e.preventDefault();
      onBenchAreaClick?.();
    }
  }

  /** Phase 47 (T-47-07): stops a nav-button click from bubbling up to the
   * bench container's own click handler — paging the carousel must never
   * complete a draft move. */
  function handleNavClick(e: React.MouseEvent<HTMLButtonElement>, direction: 1 | -1) {
    e.stopPropagation();
    scrollByCard(direction);
  }

  /** Phase 47 (T-47-07): the bench container's own click handler. A `<button>`
   * element's onClick is skipped by React when the button is `disabled` (the
   * nav buttons start disabled — no scroll content yet — before any card has
   * scrolled), so the nav button's own `stopPropagation()` call above never
   * runs in that state; the native click event still bubbles regardless.
   * Checking `event.target` here is the actual propagation guard (the nav
   * button's own `stopPropagation()` is defense-in-depth for the enabled
   * case) — a click landing on/inside a nav `<button>` never completes the
   * bench-area target. Bench-card clicks already stop their own propagation
   * (see the `onClick` passed to `DraftCardBody` below), so this is a second,
   * independent line of defense against the same class of bug for cards too. */
  function handleBenchAreaClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-roster-card]')) return;
    onBenchAreaClick?.();
  }

  const containerClassName =
    benchAreaEligible === true
      ? `${styles.benchCarousel} ${styles.statCardEligible}`
      : styles.benchCarousel;
  const containerInteractiveProps = isBenchAreaClickable
    ? {
        onClick: handleBenchAreaClick,
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: handleBenchAreaKeyDown,
      }
    : {};

  const prevClass = canScrollLeft
    ? styles.carouselNav
    : `${styles.carouselNav} ${styles.carouselNavDisabled}`;
  const nextClass = canScrollRight
    ? styles.carouselNav
    : `${styles.carouselNav} ${styles.carouselNavDisabled}`;

  // D-22: empty bench (0 cards) reuses the existing dashed-placeholder style —
  // no new empty-state component. The whole container (including the
  // placeholder) remains a valid click-completion target when eligible.
  if (cards.length === 0) {
    return (
      <div
        className={containerClassName}
        data-testid="bench-carousel"
        {...containerInteractiveProps}
      >
        <div className={styles.carouselViewport}>
          <div className={styles.benchSlot} data-bench-index={0} />
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName} data-testid="bench-carousel" {...containerInteractiveProps}>
      <div className={styles.carouselViewport}>
        <button
          type="button"
          className={prevClass}
          aria-label="Previous card"
          disabled={!canScrollLeft}
          onClick={(e) => handleNavClick(e, -1)}
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
                interactive={disabled !== true}
                isSelected={selectedCardId === card.id}
                unavailable={unavailablePlayerIds?.includes(card.id) ?? false}
                redCarded={redCardedPlayerIds?.includes(card.id) ?? false}
                cardColor={status?.cardColor ?? null}
                injuryCount={status?.injuryCount ?? 0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick(benchIndex, card.id);
                }}
              />
            );
          })}
        </div>
        <button
          type="button"
          className={nextClass}
          aria-label="Next card"
          disabled={!canScrollRight}
          onClick={(e) => handleNavClick(e, 1)}
        >
          &rsaquo;
        </button>
      </div>
    </div>
  );
}
