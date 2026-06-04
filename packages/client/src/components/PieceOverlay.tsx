import type { PlayerPiece } from '@counter-attack/shared';
import { axialToPixel } from '../utils/hexToPixel.js';

type Props = {
  piece: PlayerPiece;
  isSelected: boolean;
  isClickable: boolean;
  onClick: () => void;
  /** Always fires on any piece click regardless of isClickable — used for stats panel inspection (D-06). */
  onInspect: () => void;
  carrierId: string | null;
};

/**
 * Renders a single PlayerPiece as an SVG circle + text label.
 * Colors: home '#1a56b0' / away '#c0392b' per UI-SPEC §Piece Overlay Spec.
 * Must be a child of the HexGrid <svg> root — not a div wrapper.
 */
export function PieceOverlay({
  piece,
  isSelected,
  isClickable,
  onClick,
  onInspect,
  carrierId,
}: Props) {
  const { cx, cy } = axialToPixel(piece.position.q, piece.position.r);

  // Player number: everything after the last '-': 'home-10' → '10', 'away-0' → '0'
  const playerNumber = piece.id.slice(piece.id.lastIndexOf('-') + 1);

  // Team colors — UI-SPEC §Game Board Palette
  const fill = piece.teamId === 'home' ? '#1a56b0' : '#c0392b';
  const stroke = piece.teamId === 'home' ? '#0d3a82' : '#8e1c12';

  // Ball carrier: piece holds the ball — render inner ring indicator
  const isBallCarrier = carrierId !== null && piece.id === carrierId;

  return (
    <>
      {/* Base piece circle */}
      <circle
        cx={cx}
        cy={cy}
        r={10}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        style={{ cursor: isClickable ? 'pointer' : 'default' }}
        onClick={() => {
          if (isClickable) onClick();
          else onInspect();
        }}
      />
      {/* Selected ring — gold outline when this piece is the active selection */}
      {isSelected && (
        <circle
          cx={cx}
          cy={cy}
          r={12}
          fill="none"
          stroke="#f5c518"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
      {/* Ball carrier indicator — subtle inner ring when piece holds the ball */}
      {isBallCarrier && (
        <circle cx={cx} cy={cy} r={5} fill="#f5f0dc" fillOpacity={0.6} pointerEvents="none" />
      )}
      {/* Player number label */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
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
