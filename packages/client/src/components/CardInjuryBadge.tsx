import type { BenchEntry, PlayerPiece } from '@counter-attack/shared';

/**
 * ICON-01 (Phase 41, D-01): single shared owner of card/injury glyph drawing and
 * derivation for every player-showing surface (pitch token, player-stats card, roster
 * card, bench card). Consumers MUST call `cardColorFor`/`cardColorForBenchEntry` — the
 * `redCarded === true ? 'red' : (yellowCards ?? 0) > 0 ? 'yellow' : null` ternary that
 * used to be hand-duplicated at `PieceOverlay.tsx`, `PlayerStatsPanel.tsx`, and
 * `LineupAssignmentScreen.tsx` must never be re-introduced in a consumer — the Phase 41
 * audit (plan 41-06) greps for that literal ternary and expects zero matches outside
 * this file.
 *
 * The `piece-card-badge`/`piece-injury-badge` `data-testid` names are legacy-named
 * (they originated on `PieceOverlay`'s corner-anchored token) but are now the shared
 * cross-surface contract used by every consumer of `CardInjuryBadgeGroup`/`CardInjuryBadge`.
 * They are kept unchanged so `PieceOverlay.test.tsx` stays green as a behaviour-
 * preservation signal across this extraction.
 *
 * The injury glyph is binary by design (D-01/UI-SPEC): whether a player has been
 * injured once or multiple times, the SAME single cross glyph renders. `injuryCount`
 * only changes the accessible label (`cardInjuryLabel`), never the visual shape/size/
 * count of glyphs drawn.
 */

/** `null` means no card. Red always wins over yellow (a second yellow becomes a red). */
export type CardColor = 'yellow' | 'red' | null;

/** Convenience shape for callers that already have a derived color + injury count in hand. */
export type BenchCardStatus = { cardColor: CardColor; injuryCount: number };

/**
 * Derives card color from a `PlayerPiece`-shaped object. Red wins over yellow: a piece
 * that is both `redCarded` and carrying `yellowCards` is red (matches CARD-02's
 * second-yellow-becomes-red rule — by the time `redCarded` is true, the yellow that
 * caused it is irrelevant for display purposes).
 */
export function cardColorFor(piece: Pick<PlayerPiece, 'redCarded' | 'yellowCards'>): CardColor {
  if (piece.redCarded === true) return 'red';
  return (piece.yellowCards ?? 0) > 0 ? 'yellow' : null;
}

/**
 * Derives card color from a bench entry. `status === 'redCarded'` implies red with zero
 * extra data — a piece cannot reach that bench status without `redCarded === true` on the
 * underlying `PlayerPiece` (D-13's mutual-exclusivity invariant) — so this deliberately
 * does NOT read a `redCarded` boolean field the way `cardColorFor` does. Otherwise falls
 * back to the entry's `yellowCards` (the optional field `BenchEntry` gains in plan 41-02).
 *
 * The parameter type intentionally does not write `Pick<BenchEntry, 'status' | 'yellowCards'>`
 * directly: `BenchEntry.yellowCards` is added by a sibling same-wave plan (41-02) that
 * lands in shared/src/types.ts independently of this file. Structurally intersecting
 * `Pick<BenchEntry, 'status'>` with an inline `yellowCards` shape accepts any real
 * `BenchEntry` (present or future-shaped) without this module depending on that plan's
 * landing order.
 */
export function cardColorForBenchEntry(
  entry: Pick<BenchEntry, 'status'> & { yellowCards?: 0 | 1 | 2 },
): CardColor {
  if (entry.status === 'redCarded') return 'red';
  return (entry.yellowCards ?? 0) > 0 ? 'yellow' : null;
}

/**
 * Joins the present parts with `', '` per the UI-SPEC Copywriting Contract. The visual
 * glyph is binary, but the accessible label preserves the "×2" distinction (U+00D7
 * multiplication sign) since that costs nothing and keeps the information available to
 * screen-reader / colorblind users. Returns `''` when neither a card nor an injury is
 * present.
 */
export function cardInjuryLabel(cardColor: CardColor, injuryCount: number): string {
  const parts: string[] = [];
  if (cardColor === 'red') parts.push('Red card');
  else if (cardColor === 'yellow') parts.push('Yellow card');

  if (injuryCount >= 2) parts.push('Injured ×2');
  else if (injuryCount === 1) parts.push('Injured');

  return parts.join(', ');
}

export type CardInjuryBadgeGroupProps = {
  cx: number;
  cy: number;
  r: number;
  cardColor: CardColor;
  injuryCount: number;
};

/**
 * Raw SVG primitives (no `<svg>` wrapper) that compose into a parent `<svg>` coordinate
 * space — used by `PieceOverlay.tsx`'s corner-anchored pitch token (D-03's layered,
 * both-glyphs-centred-on-the-same-point treatment) and internally by `CardInjuryBadge`
 * (twice, offset to different centres, for the D-04 side-by-side layout).
 *
 * Geometry is lifted VERBATIM from `PieceOverlay.tsx`'s pre-extraction badge IIFE:
 * `cardWidth = r * 1.5`, `cardHeight = r * 2`, `barLength = r * 1.8`,
 * `barThickness = r * 0.6`. The injury cross renders AFTER the card rect in DOM order
 * (existing D-05 layering, asserted by `PieceOverlay.test.tsx`).
 *
 * Deliberately carries NO `role`/`aria-label` of its own (WR-01 fix): an `img` role is
 * meant to represent a single atomic image, not a container of further labeled images.
 * Every call site is responsible for wrapping its own single combined accessible name —
 * `CardInjuryBadge` does this on its outer `<svg>`, `PieceOverlay` does this on a
 * wrapping `<g>` — so no consumer ever produces nested `role="img"` elements.
 */
export function CardInjuryBadgeGroup({
  cx,
  cy,
  r,
  cardColor,
  injuryCount,
}: CardInjuryBadgeGroupProps) {
  const cardWidth = r * 1.5;
  const cardHeight = r * 2;
  const barLength = r * 1.8;
  const barThickness = r * 0.6;
  const hasInjury = injuryCount > 0;

  return (
    <>
      {/* Card badge — rect (not a circle) so it reads distinctly from the ball dot.
          Red always wins over yellow, matching CARD-02's second-yellow-becomes-red rule. */}
      {cardColor && (
        <rect
          data-testid="piece-card-badge"
          data-card={cardColor}
          x={cx - cardWidth / 2}
          y={cy - cardHeight / 2}
          width={cardWidth}
          height={cardHeight}
          rx={1.5}
          fill={cardColor === 'red' ? 'var(--color-card-red)' : 'var(--color-card-yellow)'}
          stroke="var(--color-card-badge-border)"
          strokeWidth={1}
          pointerEvents="none"
        />
      )}
      {/* Injury badge — white plus-sign glyph, rendered AFTER the card badge so it layers
          on top per D-05. Distinguished from the card badge by SHAPE (cross vs. rectangle),
          not colour, since both may occupy the same corner simultaneously. Binary by design
          (D-01): injuryCount >= 2 differs only in the accessible label, never the shape. */}
      {hasInjury && (
        <g data-testid="piece-injury-badge" pointerEvents="none">
          <rect
            x={cx - barLength / 2}
            y={cy - barThickness / 2}
            width={barLength}
            height={barThickness}
            rx={1}
            fill="var(--color-text-inverse)"
            stroke="var(--color-card-badge-border)"
            strokeWidth={0.75}
          />
          <rect
            x={cx - barThickness / 2}
            y={cy - barLength / 2}
            width={barThickness}
            height={barLength}
            rx={1}
            fill="var(--color-text-inverse)"
            stroke="var(--color-card-badge-border)"
            strokeWidth={0.75}
          />
        </g>
      )}
    </>
  );
}

export type CardInjuryBadgeProps = {
  cardColor: CardColor;
  injuryCount: number;
  size?: number;
};

/**
 * Self-contained `<svg>` for plain-DOM surfaces (player-stats card, roster/lineup card,
 * bench card), mirroring `PlayerStatsPanel.tsx`'s `MiniTokenBadge` self-contained-`<svg>`-
 * in-DOM pattern. Returns `null` when there is nothing to draw.
 *
 * Layout constants (D-04 side-by-side, derived so the two glyphs never overlap):
 * `r = size * 0.4`; when only one glyph is present `viewW = size` and that glyph's
 * `cx = size * 0.5`; when both are present `viewW = size * 1.5`, card `cx = size * 0.34`,
 * injury `cx = size * 1.10`; `cy = size / 2` always. Composes `CardInjuryBadgeGroup` twice
 * (once with `injuryCount={0}`, once with `cardColor={null}`) so glyph geometry has
 * exactly one definition.
 */
export function CardInjuryBadge({ cardColor, injuryCount, size = 16 }: CardInjuryBadgeProps) {
  if (cardColor === null && injuryCount <= 0) return null;

  const r = size * 0.4;
  const cy = size / 2;
  const bothPresent = cardColor !== null && injuryCount > 0;
  const viewW = bothPresent ? size * 1.5 : size;
  const cardCx = bothPresent ? size * 0.34 : size * 0.5;
  const injuryCx = bothPresent ? size * 1.1 : size * 0.5;
  const label = cardInjuryLabel(cardColor, injuryCount);

  return (
    <svg
      data-testid="card-injury-badge"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${viewW} ${size}`}
      width={viewW}
      height={size}
      style={{ flexShrink: 0 }}
    >
      <title>{label}</title>
      <CardInjuryBadgeGroup cx={cardCx} cy={cy} r={r} cardColor={cardColor} injuryCount={0} />
      <CardInjuryBadgeGroup
        cx={injuryCx}
        cy={cy}
        r={r}
        cardColor={null}
        injuryCount={injuryCount}
      />
    </svg>
  );
}
