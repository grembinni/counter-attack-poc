/**
 * DraftPackCarousel — Phase 29 D-20.
 *
 * A left-right navigable carousel of draft-pack cards. Renders any number of
 * cards (4-card packs per round, D-12..D-16 Phase 30) sorted rarest-first
 * (Chase, Rare, Uncommon, Common) and resets scroll to the leftmost card
 * whenever a new pack loads (D-20).
 *
 * Cards in this row are SELECTION SOURCES ONLY (Phase 47 / D-11) — clicking a
 * card reports its id via `onCardClick`; there is no click-to-complete target
 * on these cards themselves and no dataTransfer/pointer-carry involvement of
 * any kind.
 * Pack-card selection mirrors mid-match substitution's bench-first pattern
 * (CONTEXT.md D-11): select a pack card (green) -> eligible slots/bench turn
 * blue -> click completes the pick. The parent screen owns all selection
 * state; this component never resolves anything itself.
 *
 * `DraftCardBody` (the shared inner card renderer) and `TIER_CARD_CLASS` are
 * exported for reuse by `BenchCarousel` (D-21 — identical card style, click
 * source AND click target).
 */
import { useEffect, useRef, useState } from 'react';
import type { DraftTier, TeamId, TieredPoolPlayer } from '@counter-attack/shared';
import { TeamBadge } from './TeamBadge.js';
import { NationFlag } from './NationFlag.js';
import { CardInjuryBadge, type CardColor } from './CardInjuryBadge.js';
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
  /** Phase 47 (D-11): true when this card responds to click/keyboard input —
   * the click-select replacement for the retired pointer-carry-enabled gate.
   * Required (unlike the optional selection props below) because every
   * caller must make an explicit interactivity decision, mirroring that
   * retired gate's requiredness. */
  interactive: boolean;
  /** Phase 47: fires when the card is clicked or activated via Enter/Space
   * while interactive/eligible. Omitted entirely (not just a no-op) when the
   * card is neither interactive nor an eligible target — see isInteractive
   * derivation below and PieceOverlay.tsx's identical click-gating idiom.
   * Phase 47 plan 02 (BenchCarousel, D-11/T-47-07): widened from `() => void`
   * to accept the originating `SyntheticEvent` so callers that render this
   * card inside a click-completion container (BenchCarousel's bench area)
   * can call `event.stopPropagation()` to stop a card click from also
   * completing the container's own click target. `SyntheticEvent` (not
   * `MouseEvent`) because the same callback fires from both the div's
   * `onClick` (a MouseEvent) and `handleKeyDown`'s Enter/Space activation (a
   * KeyboardEvent) below — both extend SyntheticEvent and both expose
   * `stopPropagation()`. */
  onClick?: (event: React.SyntheticEvent<HTMLDivElement>) => void;
  /** Phase 47: this card is the current green selection. Wins over
   * isEligibleTarget when both are somehow true (selected always wins). */
  isSelected?: boolean;
  /** Phase 47: something else is selected and this card is a legal
   * click-to-complete target (blue ring). Never true at the same time as
   * isSelected being the visual winner. */
  isEligibleTarget?: boolean;
  /** Phase 40 (SUB-07): true when this card's player has been substituted out —
   * renders an "OUT" badge, dims the card, and forces isInteractive=false regardless
   * of the `interactive` prop above. Default false — every existing call site
   * (draft pack row, ordinary bench cards) is unaffected. */
  unavailable?: boolean;
  /** Phase 40 (D-13): true when this card's player has been sent off — renders a
   * "RED CARD" badge (takes precedence over `unavailable`), dims the card, and
   * forces isInteractive=false. Default false. */
  redCarded?: boolean;
  /** Phase 41 (ICON-02/ICON-03): disciplinary glyph colour for this card, derived by the
   * caller from the shared `cardColorFor`/`cardColorForBenchEntry`. Default undefined —
   * the draft-pack row and every pre-match bench call site pass nothing and render no
   * glyph. */
  cardColor?: CardColor;
  /** Phase 41 (ICON-03): live injury count carried onto the bench entry. The glyph is
   * binary (present/absent) per the UI-SPEC; the count survives only in the accessible
   * label. Default undefined -> 0. */
  injuryCount?: number;
};

/**
 * Shared inner card renderer — mirrors LineupStatCard's TeamBadge/cardBody/
 * cardHeader/statGrid/statChip markup exactly (D-18: card content unchanged),
 * with the tier border swapped in via TIER_CARD_CLASS (D-19) in place of the
 * base 1px card border. Reused by DraftPackCarousel (click source only) and
 * BenchCarousel (click source + click target).
 */
export function DraftCardBody({
  card,
  teamId,
  jerseyNumber,
  interactive,
  onClick,
  isSelected,
  isEligibleTarget,
  unavailable,
  redCarded,
  cardColor,
  injuryCount,
}: DraftCardBodyProps) {
  const isGK = card.role === 'GK';
  const isUnavailable = unavailable === true || redCarded === true;
  /** Phase 47: mirrors the retired unavailable-forcing rule (an
   * unavailable card never responds to input regardless of what the caller
   * passed for `interactive`), ported from that retired gate's equivalent. */
  const isInteractive = isUnavailable ? false : interactive;
  /** Phase 47: selected wins over eligible — never both classes at once. */
  let className = isUnavailable
    ? `${TIER_CARD_CLASS[card.tier]} ${styles.cardUnavailable}`
    : TIER_CARD_CLASS[card.tier];
  if (isSelected === true) {
    className = `${className} ${styles.statCardSelected}`;
  } else if (isEligibleTarget === true) {
    className = `${className} ${styles.statCardEligible}`;
  }
  /** Gap-closure (42-10 Section D / gap item 1): suppress the glyph's CARD half when the
   * RED CARD text badge below is already showing — see the doc comment on the
   * CardInjuryBadge call for the full rationale. Never touches injuryCount. */
  const glyphCardColor: CardColor = redCarded === true ? null : (cardColor ?? null);
  /** Phase 47 (D-04 / UI-SPEC Accessibility): the card is clickable when it's
   * either directly interactive or a legal click-to-complete target — only
   * then do we attach onClick/keyboard handlers and role="button". A card
   * that is neither gets no handler at all (not even a no-op), matching
   * PieceOverlay.tsx's identical click-gating idiom. */
  const isClickable = isInteractive || isEligibleTarget === true;

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!isClickable || !onClick) return;
    if (e.key === 'Enter') {
      onClick(e);
    } else if (e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  }

  return (
    <div
      className={className}
      data-roster-card
      data-interactive={isInteractive ? 'true' : 'false'}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
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
            {/* Phase 41 (ICON-02/ICON-03/D-02): card/injury glyph — locked position
                immediately after the jersey number, ahead of the RED CARD/OUT status
                badge below. Gap-closure (42-10 Section D / gap item 1): the glyph's
                CARD half is suppressed when redCarded === true because the RED CARD
                text badge immediately below already states the same fact — the live
                human verifier reported the pair as a duplicate/overlapping card icon
                and asked for a single indicator. The INJURY half is deliberately still
                rendered (a red-carded AND injured player must still show the injury
                cross). Yellow-card and OUT bench cards are unaffected because neither
                has a competing card-text badge. */}
            <CardInjuryBadge cardColor={glyphCardColor} injuryCount={injuryCount ?? 0} size={16} />
            {/* Phase 40 (SUB-07/D-13): redCarded takes precedence over unavailable —
                a sent-off player is never mislabelled as merely substituted out. */}
            {redCarded === true ? (
              <span className={styles.redCardBadge} data-testid="bench-red-card-badge">
                RED CARD
              </span>
            ) : (
              unavailable === true && (
                <span className={styles.outBadge} data-testid="bench-out-badge">
                  OUT
                </span>
              )
            )}
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
  /** D-12: true while waiting for the opponent's pick — row dims and stops accepting clicks. */
  disabled: boolean;
  /** Phase 47 (D-11): fires when a pack card is clicked (the pick-selection
   * signal, replacing the retired pointer-carry-start signal). */
  onCardClick: (cardId: string) => void;
  /** Phase 47: the currently-selected pack card, owned by the parent screen —
   * applies the green .statCardSelected ring to the matching card. */
  selectedCardId?: string | null;
};

/** Approximate per-card scroll step (card min-width 320px + 8px gap, DRAFT-06
 * gap-closure card-widening — 29-08-PLAN.md Task 1). */
const SCROLL_STEP_PX = 328;

export function DraftPackCarousel({
  cards,
  teamId,
  disabled,
  onCardClick,
  selectedCardId,
}: DraftPackCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  // D-19/Pitfall 7: scroll UI state is local — never in Zustand.
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
              interactive={!disabled}
              isSelected={selectedCardId === card.id}
              onClick={() => onCardClick(card.id)}
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
