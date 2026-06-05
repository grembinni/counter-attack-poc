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
  /** Which team is currently attacking — passed from HexGrid for ball possession dot direction (D-16). */
  attackingTeam: 'home' | 'away';
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
  attackingTeam,
}: Props) {
  const { cx, cy } = axialToPixel(piece.position.q, piece.position.r);

  // Player number: everything after the last '-': 'home-10' → '10', 'away-0' → '0'
  const playerNumber = piece.id.slice(piece.id.lastIndexOf('-') + 1);

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
  const PIECE_RADIUS = 10;
  const dotOffsetX = piece.teamId === 'home' ? PIECE_RADIUS * 0.6 : -(PIECE_RADIUS * 0.6);
  const dotOffsetY = PIECE_RADIUS * 0.6;

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
      {/* Ball carrier indicator — directional white dot at 45° toward scoring goal (D-15) */}
      {isBallCarrier && (
        <circle
          cx={cx + dotOffsetX}
          cy={cy + dotOffsetY}
          r={2.5}
          fill="#ffffff"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth={0.5}
          pointerEvents="none"
        />
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
