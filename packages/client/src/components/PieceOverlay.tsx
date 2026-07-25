import type { PlayerPiece, UniformStyleId, TeamPalette } from '@counter-attack/shared';
import { axialToPixel } from '../utils/hexToPixel.js';
import { UNIFORM_STYLES } from '../styles/uniformStyles.js';

/** Green active-selection ring stroke. Exported so PieceOverlay.test.tsx asserts against
 * this constant instead of retyping the hex literal. */
export const ACTIVE_RING_STROKE = '#22c55e';

function SoccerPatches({ cx, cy, R }: { cx: number; cy: number; R: number }) {
  const outerDist = R * 0.62;
  const angles = Array.from({ length: 5 }, (_, i) => (i * 72 - 90) * (Math.PI / 180));
  return (
    <>
      <circle cx={cx} cy={cy} r={R * 0.27} fill="#111" pointerEvents="none" />
      {angles.map((a, i) => (
        <circle
          key={i}
          cx={cx + outerDist * Math.cos(a)}
          cy={cy + outerDist * Math.sin(a)}
          r={R * 0.19}
          fill="#111"
          pointerEvents="none"
        />
      ))}
    </>
  );
}

export type SelectionState = 'none' | 'selectable' | 'active' | 'activated';

type Props = {
  piece: PlayerPiece;
  /** Phase 20 D-15: uniform style id resolved from TEAM_CONFIGS[teamId].defaultUniformStyle by the parent (HexGrid). */
  uniformStyle: UniformStyleId;
  /** Phase 20 D-15: 4-color palette resolved from TEAM_CONFIGS[teamId].palette by the parent (HexGrid). */
  palette: TeamPalette;
  selectionState: SelectionState;
  onClick: () => void;
  /** Always fires on any piece click regardless of selectionState — used for stats panel inspection (D-06). */
  onInspect: () => void;
  carrierId: string | null;
  /** Which team is currently attacking — passed from HexGrid for ball possession dot direction (D-16). */
  attackingTeam: 'home' | 'away';
  /**
   * OFFSIDE-01 (D-25): true when this piece's id is in `GameState.offsidePieceIds`.
   * Renders an additional red ring at a distinct radius (normal stroke width, per D-42),
   * independent of `selectionState` — a piece can be simultaneously offside and
   * selectable/active/activated.
   */
  isOffside?: boolean;
};

/**
 * Renders a single PlayerPiece as an SVG circle + text label.
 * Phase 20 D-15 refactor: PieceOverlay is a pure renderer. It accepts `uniformStyle` and
 * `palette` props from the parent (HexGrid) which resolves them from TEAM_CONFIGS. The internal
 * useGameStore(selectedTeams)/TEAM_CONFIGS color path has been removed.
 *
 * Jersey patterns: delegated to UNIFORM_STYLES[uniformStyle] registry (Phase 20 D-01..D-12).
 * GK variant: opposite color scheme (D-13) applied before the renderer call — home GK uses away
 * scheme (awayPrime/awayAlt), away GK uses home scheme (homePrime/homeAlt).
 * Selection states: selectable (blue ring), active (green ring), activated (orange ring + red X) (UX-05, D-04/D-05).
 * Offside marker: independent red ring layer at a distinct radius, driven by `isOffside` (OFFSIDE-01, D-25; stroke width corrected by D-42).
 * Must be a child of the HexGrid <svg> root — not a div wrapper.
 */
export function PieceOverlay({
  piece,
  uniformStyle,
  palette,
  selectionState,
  onClick,
  onInspect,
  carrierId,
  attackingTeam,
  isOffside = false,
}: Props) {
  const { cx, cy } = axialToPixel(piece.position.q, piece.position.r);

  // BUG-19: player number from piece.number (D-08 pattern from PlayerStatsPanel)
  const playerNumber = String(piece.number);

  const isGK = piece.role === 'GK';

  // Keeper uses opposite color scheme: home outfield/away GK → home scheme (homePrime/homeAlt, white numbers);
  // away outfield/home GK → away scheme (awayPrime/awayAlt, black numbers).
  const useAwayScheme = isGK ? piece.teamId === 'home' : piece.teamId === 'away';
  const effectivePalette: TeamPalette = useAwayScheme
    ? {
        homePrime: palette.awayPrime,
        homeAlt: palette.awayAlt,
        homeFont: palette.awayFont,
        awayPrime: palette.homePrime,
        awayAlt: palette.homeAlt,
        awayFont: palette.homeFont,
        // CLEANUP-02 (Plan 32-03, Pitfall 5): field pass-through only — `palette` is already
        // the fully-resolved TeamPalette prop from HexGrid's TEAM_CONFIGS lookup, and this
        // component has no roster TeamId to feed useTeamAccentColor. Not a duplicated derivation.
        uiColor: palette.uiColor,
      }
    : palette;
  const numberColor = effectivePalette.homeFont;

  const PIECE_RADIUS = 12;

  // Delegate to the parameterized renderer registry (Phase 20 UNIFORM-05 / D-15).
  const {
    patternDef,
    fill: circleFill,
    overlay,
  } = UNIFORM_STYLES[uniformStyle]({
    cx,
    cy,
    R: PIECE_RADIUS,
    palette: effectivePalette,
    isGK,
    pieceId: piece.id,
  });

  // Ball carrier: piece holds the ball — render directional possession dot (D-15)
  const isBallCarrier = carrierId !== null && piece.id === carrierId;
  // Dot direction: home team attacks right (higher q) → bottom-right (+x, +y)
  // Away team attacks left (lower q) → bottom-left (-x, +y) — keyed off teamId per Open Question 3
  void attackingTeam; // direction uses piece.teamId per Open Question 3; prop kept for future overrides (D-16)
  const dotOffsetX = piece.teamId === 'home' ? PIECE_RADIUS * 0.715 : -(PIECE_RADIUS * 0.715);
  const dotOffsetY = PIECE_RADIUS * 0.715;

  return (
    <>
      {/* Phase 20 D-15: parameterized pattern defs — delegated to UNIFORM_STYLES[uniformStyle] */}
      {patternDef && <defs>{patternDef}</defs>}

      {/* Base piece circle — fill comes from UNIFORM_STYLES renderer (url(#pattern-id) or solid color) */}
      <circle
        cx={cx}
        cy={cy}
        r={PIECE_RADIUS}
        fill={circleFill}
        stroke={effectivePalette.homePrime}
        strokeWidth={1.5}
        style={{ cursor: selectionState !== 'none' ? 'pointer' : 'default' }}
        onClick={() => {
          if (selectionState !== 'none') onClick();
          else onInspect();
        }}
      />

      {/* Overlay sibling elements from renderer (e.g. diagonal line, tree-ring circles, corner triangles) */}
      {overlay}

      {/* D-04/UX-05: selectable ring — bright blue outline */}
      {selectionState === 'selectable' && (
        <circle
          cx={cx}
          cy={cy}
          r={PIECE_RADIUS + 3}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={2.5}
          pointerEvents="none"
        />
      )}
      {/* D-04/UX-05: active ring — green outline (selected piece or header contestant) */}
      {selectionState === 'active' && (
        <circle
          cx={cx}
          cy={cy}
          r={PIECE_RADIUS + 4}
          fill="none"
          stroke={ACTIVE_RING_STROKE}
          strokeWidth={2.5}
          pointerEvents="none"
        />
      )}
      {/* D-04/D-05/UX-05: activated = orange ring + red X (piece already used this turn) */}
      {selectionState === 'activated' && (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={PIECE_RADIUS + 3}
            fill="none"
            stroke="#f97316"
            strokeWidth={2}
            pointerEvents="none"
          />
          <path
            d={`M${cx - PIECE_RADIUS * 0.7} ${cy - PIECE_RADIUS * 0.7} L${cx + PIECE_RADIUS * 0.7} ${cy + PIECE_RADIUS * 0.7} M${cx + PIECE_RADIUS * 0.7} ${cy - PIECE_RADIUS * 0.7} L${cx - PIECE_RADIUS * 0.7} ${cy + PIECE_RADIUS * 0.7}`}
            stroke="#f97316"
            strokeWidth={2.5}
            strokeLinecap="round"
            pointerEvents="none"
          />
        </>
      )}
      {/* OFFSIDE-01 (D-25, ring width corrected by D-42): red ring at a distinct radius —
          independent layer, not part of the selectionState switch above. A piece can be
          simultaneously offside and selectable/active/activated (both rings render).
          D-42: strokeWidth matches the other selection rings' normal width (2.5), not double —
          the distinct PIECE_RADIUS + 6 radius alone is what keeps this layer visible when
          stacked with a selection ring. */}
      {isOffside && (
        <circle
          cx={cx}
          cy={cy}
          r={PIECE_RADIUS + 6}
          fill="none"
          stroke="#dc2626"
          strokeWidth={2.5}
          pointerEvents="none"
        />
      )}
      {/* Ball carrier indicator — directional soccer ball at 45° toward scoring goal (D-15) */}
      {isBallCarrier && (
        <>
          <circle
            cx={cx + dotOffsetX}
            cy={cy + dotOffsetY}
            r={PIECE_RADIUS * 0.59}
            fill="#f5f0dc"
            stroke="rgba(0,0,0,0.5)"
            strokeWidth={1}
            pointerEvents="none"
          />
          <SoccerPatches cx={cx + dotOffsetX} cy={cy + dotOffsetY} R={PIECE_RADIUS * 0.59} />
        </>
      )}
      {/* Player number label */}
      <text
        x={cx}
        y={cy}
        dy="-0.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={15}
        fontWeight={700}
        fill={numberColor}
        fontStyle={piece.role === 'GK' ? 'italic' : 'normal'}
        pointerEvents="none"
      >
        {playerNumber}
      </text>
    </>
  );
}
