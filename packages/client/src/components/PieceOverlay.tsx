import type { PlayerPiece } from '@counter-attack/shared';
import { axialToPixel } from '../utils/hexToPixel.js';

export type SelectionState = 'none' | 'selectable' | 'active' | 'activated';

type Props = {
  piece: PlayerPiece;
  selectionState: SelectionState;
  onClick: () => void;
  /** Always fires on any piece click regardless of selectionState — used for stats panel inspection (D-06). */
  onInspect: () => void;
  carrierId: string | null;
  /** Which team is currently attacking — passed from HexGrid for ball possession dot direction (D-16). */
  attackingTeam: 'home' | 'away';
};

/**
 * Renders a single PlayerPiece as an SVG circle + text label.
 * Colors: home '#1a56b0' / away '#c0392b' per UI-SPEC §Piece Overlay Spec.
 * Stripe patterns: home = vertical black stripe, away = two horizontal maroon bands (VIS-01, D-01/D-02/D-03).
 * Selection states: selectable (blue ring), active (green ring), activated (orange ring + red X) (UX-05, D-04/D-05).
 * Must be a child of the HexGrid <svg> root — not a div wrapper.
 */
export function PieceOverlay({
  piece,
  selectionState,
  onClick,
  onInspect,
  carrierId,
  attackingTeam,
}: Props) {
  const { cx, cy } = axialToPixel(piece.position.q, piece.position.r);

  // Player number: 1-based — 'home-0' (GK) → '1', 'home-10' → '11'
  const playerNumber = String(Number(piece.id.slice(piece.id.lastIndexOf('-') + 1)) + 1);

  // GK pieces use distinctive colors regardless of team (physical board convention)
  // Outfield: home = blue, away = red
  const isGK = piece.role === 'GK';
  const fill = isGK
    ? piece.teamId === 'home'
      ? '#9b59b6' // home GK: purple
      : '#f59e0b' // away GK: yellow/amber
    : piece.teamId === 'home'
      ? '#1a56b0' // home outfield: blue
      : '#c0392b'; // away outfield: red
  const stroke = isGK
    ? piece.teamId === 'home'
      ? '#6c3483'
      : '#d97706'
    : piece.teamId === 'home'
      ? '#0d3a82'
      : '#8e1c12';

  // Ball carrier: piece holds the ball — render directional possession dot (D-15)
  const isBallCarrier = carrierId !== null && piece.id === carrierId;
  // Dot direction: home team attacks right (higher q) → bottom-right (+x, +y)
  // Away team attacks left (lower q) → bottom-left (-x, +y) — keyed off teamId per Open Question 3
  void attackingTeam; // direction uses piece.teamId per Open Question 3; prop kept for future overrides (D-16)
  const PIECE_RADIUS = 12;
  const dotOffsetX = piece.teamId === 'home' ? PIECE_RADIUS * 0.55 : -(PIECE_RADIUS * 0.55);
  const dotOffsetY = PIECE_RADIUS * 0.55;

  return (
    <>
      {/* D-01/D-02: Per-piece SVG stripe pattern defs — outfield only, gated on !isGK */}
      {!isGK && (
        <defs>
          {piece.teamId === 'home' ? (
            <pattern
              id={`home-stripe-${piece.id}`}
              x={cx - PIECE_RADIUS}
              y={cy - PIECE_RADIUS}
              width={24}
              height={24}
              patternUnits="userSpaceOnUse"
            >
              {/* D-03: Single vertical black stripe centered at x=10..14 within 24px tile */}
              <rect x={10} y={0} width={4} height={24} fill="#000000" fillOpacity={0.55} />
            </pattern>
          ) : (
            <pattern
              id={`away-stripe-${piece.id}`}
              x={cx - PIECE_RADIUS}
              y={cy - PIECE_RADIUS}
              width={24}
              height={24}
              patternUnits="userSpaceOnUse"
            >
              {/* D-03: Two horizontal dark maroon bands — upper third and lower third */}
              <rect x={0} y={6} width={24} height={4} fill="#7f0000" fillOpacity={0.65} />
              <rect x={0} y={14} width={24} height={4} fill="#7f0000" fillOpacity={0.65} />
            </pattern>
          )}
        </defs>
      )}
      {/* Base piece circle — GK: solid fill; outfield: stripe pattern fill */}
      <circle
        cx={cx}
        cy={cy}
        r={PIECE_RADIUS}
        fill={
          isGK
            ? fill
            : `url(#${piece.teamId === 'home' ? `home-stripe-${piece.id}` : `away-stripe-${piece.id}`})`
        }
        stroke={stroke}
        strokeWidth={1.5}
        style={{ cursor: selectionState !== 'none' ? 'pointer' : 'default' }}
        onClick={() => {
          if (selectionState !== 'none') onClick();
          else onInspect();
        }}
      />
      {/* D-04/UX-05: selectable ring — bright blue outline */}
      {selectionState === 'selectable' && (
        <circle
          cx={cx}
          cy={cy}
          r={PIECE_RADIUS + 2}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
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
          stroke="#22c55e"
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
            stroke="#ef4444"
            strokeWidth={2.5}
            strokeLinecap="round"
            pointerEvents="none"
          />
        </>
      )}
      {/* Ball carrier indicator — directional white dot at 45° toward scoring goal (D-15) */}
      {isBallCarrier && (
        <circle
          cx={cx + dotOffsetX}
          cy={cy + dotOffsetY}
          r={PIECE_RADIUS * 0.35}
          fill="#ffffff"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth={1}
          pointerEvents="none"
        />
      )}
      {/* Player number label */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={15}
        fontWeight={700}
        fill="#ffffff"
        fontStyle={piece.role === 'GK' ? 'italic' : 'normal'}
        pointerEvents="none"
      >
        {playerNumber}
      </text>
    </>
  );
}
