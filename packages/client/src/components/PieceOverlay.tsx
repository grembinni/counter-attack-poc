import type { PlayerPiece } from '@counter-attack/shared';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { axialToPixel } from '../utils/hexToPixel.js';
import { TEAM_DEFAULTS } from '../teamDefaults.js';

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
 * Colors: driven by TEAM_CONFIGS[TEAM_DEFAULTS[piece.teamId]].primaryColor (D-06 refactor).
 * Jersey patterns: four outfield team patterns (cosmos/xolos/city/crew) + GK checker/stripe (D-08, D-10).
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

  const isGK = piece.role === 'GK';

  // D-06: resolve team config via TEAM_DEFAULTS → TEAM_CONFIGS instead of positional literals
  const teamId = TEAM_DEFAULTS[piece.teamId];
  const teamConfig = TEAM_CONFIGS[teamId];

  // GK pieces use distinctive colors regardless of team (physical board convention)
  // Outfield: primaryColor from TEAM_CONFIGS
  const fill = isGK
    ? piece.teamId === 'home'
      ? '#9b59b6' // home GK: purple (replaced by checker pattern on circle fill)
      : '#db2777' // away GK: orange (solid base; stripes added as siblings)
    : teamConfig.primaryColor; // outfield: team primary color (used for stroke calculation only — fill comes from url(#pattern))
  const stroke = isGK
    ? piece.teamId === 'home'
      ? '#6c3483'
      : '#7f1d1d'
    : piece.teamId === 'home'
      ? '#0d3a82'
      : '#8e1c12';

  // Ball carrier: piece holds the ball — render directional possession dot (D-15)
  const isBallCarrier = carrierId !== null && piece.id === carrierId;
  // Dot direction: home team attacks right (higher q) → bottom-right (+x, +y)
  // Away team attacks left (lower q) → bottom-left (-x, +y) — keyed off teamId per Open Question 3
  void attackingTeam; // direction uses piece.teamId per Open Question 3; prop kept for future overrides (D-16)
  void fill; // used for stroke reference; circle fill is pattern url for outfield / solid for GK
  const PIECE_RADIUS = 12;
  const dotOffsetX = piece.teamId === 'home' ? PIECE_RADIUS * 0.55 : -(PIECE_RADIUS * 0.55);
  const dotOffsetY = PIECE_RADIUS * 0.55;

  return (
    <>
      {/* D-08: Per-piece SVG jersey pattern defs — four outfield teams + home GK checker */}
      {!isGK && (
        <defs>
          {/* Cosmos: white base + wide horizontal navy stripe (D-08) */}
          <pattern
            id={`cosmos-jersey-${piece.id}`}
            x={cx - PIECE_RADIUS}
            y={cy - PIECE_RADIUS}
            width={24}
            height={24}
            patternUnits="userSpaceOnUse"
          >
            <rect width={24} height={24} fill="#1e3a8a" />
            <rect x={0} y={6} width={24} height={12} fill="#3b82f6" fillOpacity={0.85} />
          </pattern>

          {/* Xolos: amber base + grey checker 8×8 tiles in 16px tile (D-08) */}
          <pattern
            id={`xolos-jersey-${piece.id}`}
            x={cx - PIECE_RADIUS}
            y={cy - PIECE_RADIUS}
            width={16}
            height={16}
            patternUnits="userSpaceOnUse"
          >
            <rect width={16} height={16} fill="#f59e0b" />
            <rect x={0} y={0} width={8} height={8} fill="#374151" fillOpacity={0.7} />
            <rect x={8} y={8} width={8} height={8} fill="#374151" fillOpacity={0.7} />
          </pattern>

          {/* City: red base + 3 gold pinstripes (2px wide, 8px tile) (D-08) */}
          <pattern
            id={`city-jersey-${piece.id}`}
            x={cx - PIECE_RADIUS}
            y={cy - PIECE_RADIUS}
            width={8}
            height={24}
            patternUnits="userSpaceOnUse"
          >
            <rect width={8} height={24} fill="#dc143c" />
            <rect x={2} y={0} width={4} height={24} fill="#ef4444" fillOpacity={0.9} />
          </pattern>

          {/* Crew: solid gold base; / \ chevron stripes added as clipped siblings (D-08) */}
          <pattern
            id={`crew-jersey-${piece.id}`}
            x={cx - PIECE_RADIUS}
            y={cy - PIECE_RADIUS}
            width={PIECE_RADIUS * 2}
            height={PIECE_RADIUS * 2}
            patternUnits="userSpaceOnUse"
          >
            <rect width={PIECE_RADIUS * 2} height={PIECE_RADIUS * 2} fill="#f5c518" />
          </pattern>
          {teamId === 'crew' && (
            <clipPath id={`crew-clip-${piece.id}`}>
              <circle cx={cx} cy={cy} r={PIECE_RADIUS} />
            </clipPath>
          )}
        </defs>
      )}

      {/* D-10: Home GK checker pattern def */}
      {isGK && piece.teamId === 'home' && (
        <defs>
          <pattern
            id={`home-gk-checker-${piece.id}`}
            x={cx - PIECE_RADIUS}
            y={cy - PIECE_RADIUS}
            width={12}
            height={12}
            patternUnits="userSpaceOnUse"
          >
            <rect width={12} height={12} fill="#7c3aed" />
            <rect x={0} y={0} width={6} height={6} fill="#4c1d95" />
            <rect x={6} y={6} width={6} height={6} fill="#4c1d95" />
          </pattern>
        </defs>
      )}

      {/* Base piece circle — outfield: jersey pattern fill; home GK: checker pattern; away GK: solid amber */}
      <circle
        cx={cx}
        cy={cy}
        r={PIECE_RADIUS}
        fill={
          isGK
            ? piece.teamId === 'home'
              ? `url(#home-gk-checker-${piece.id})`
              : '#db2777' // away GK: solid orange base; stripes added as siblings
            : `url(#${teamId}-jersey-${piece.id})`
        }
        stroke={stroke}
        strokeWidth={1.5}
        style={{ cursor: selectionState !== 'none' ? 'pointer' : 'default' }}
        onClick={() => {
          if (selectionState !== 'none') onClick();
          else onInspect();
        }}
      />

      {/* Crew diagonal stripe (\ top-left to bottom-right) — clipped to circle */}
      {teamId === 'crew' && !isGK && (
        <line
          x1={cx - PIECE_RADIUS}
          y1={cy - PIECE_RADIUS}
          x2={cx + PIECE_RADIUS}
          y2={cy + PIECE_RADIUS}
          stroke="#111111"
          strokeWidth={10}
          strokeOpacity={0.8}
          clipPath={`url(#crew-clip-${piece.id})`}
          pointerEvents="none"
        />
      )}

      {/* D-10: Away GK edge stripes — two narrow orange vertical rects over amber base */}
      {isGK && piece.teamId === 'away' && (
        <>
          <rect
            x={cx - PIECE_RADIUS + 4}
            y={cy - PIECE_RADIUS}
            width={3}
            height={PIECE_RADIUS * 2}
            fill="#f59e0b"
            fillOpacity={0.85}
            pointerEvents="none"
          />
          <rect
            x={cx + PIECE_RADIUS - 7}
            y={cy - PIECE_RADIUS}
            width={3}
            height={PIECE_RADIUS * 2}
            fill="#f59e0b"
            fillOpacity={0.85}
            pointerEvents="none"
          />
        </>
      )}

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
            stroke="#f97316"
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
