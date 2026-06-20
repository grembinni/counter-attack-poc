import type { PlayerPiece } from '@counter-attack/shared';
import { TEAM_CONFIGS } from '@counter-attack/shared';
import { axialToPixel } from '../utils/hexToPixel.js';
import { useGameStore } from '../store/useGameStore.js';

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
  selectionState: SelectionState;
  onClick: () => void;
  /** Always fires on any piece click regardless of selectionState — used for stats panel inspection (D-06). */
  onInspect: () => void;
  carrierId: string | null;
  /** Which team is currently attacking — passed from HexGrid for ball possession dot direction (D-16). */
  attackingTeam: 'home' | 'away';
  /**
   * OFFSIDE-01 (D-25): true when this piece's id is in `GameState.offsidePieceIds`.
   * Renders an additional double-width red ring, independent of `selectionState` —
   * a piece can be simultaneously offside and selectable/active/activated.
   */
  isOffside?: boolean;
};

/**
 * Renders a single PlayerPiece as an SVG circle + text label.
 * Colors: driven by TEAM_CONFIGS[TEAM_DEFAULTS[piece.teamId]].primaryColor (D-06 refactor).
 * Jersey patterns: four outfield team patterns (cosmos/xolos/city/crew) + GK checker/stripe (D-08, D-10).
 * Selection states: selectable (blue ring), active (green ring), activated (orange ring + red X) (UX-05, D-04/D-05).
 * Offside marker: independent double-width red ring layer, driven by `isOffside` (OFFSIDE-01, D-25).
 * Must be a child of the HexGrid <svg> root — not a div wrapper.
 */
export function PieceOverlay({
  piece,
  selectionState,
  onClick,
  onInspect,
  carrierId,
  attackingTeam,
  isOffside = false,
}: Props) {
  const { cx, cy } = axialToPixel(piece.position.q, piece.position.r);
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);

  // Player number: GK=1, DEF/MID 1-based, FWD idx 6-7 → 7-8, FWD idx 8-9 → 10-11, ST=9
  const idx = Number(piece.id.slice(piece.id.lastIndexOf('-') + 1));
  const playerNumber =
    piece.role === 'ST'
      ? '9'
      : piece.role === 'FWD' && idx >= 8
        ? String(idx + 2)
        : String(idx + 1);

  const isGK = piece.role === 'GK';

  // D-06: resolve team config via selectedTeams → TEAM_CONFIGS (replaces TEAM_DEFAULTS — D-17)
  const teamId = selectedTeams[piece.teamId];
  const teamConfig = TEAM_CONFIGS[teamId];

  // GK pieces use distinctive colors regardless of team (physical board convention)
  // Outfield: primaryColor from TEAM_CONFIGS
  const fill = isGK
    ? piece.teamId === 'home'
      ? '#9b59b6' // home GK: purple (replaced by checker pattern on circle fill)
      : '#be185d' // away GK: pink-700 (one shade darker)
    : teamConfig.primaryColor; // outfield: team primary color (used for stroke calculation only — fill comes from url(#pattern))
  const stroke = isGK ? (piece.teamId === 'home' ? '#6c3483' : '#5f1515') : teamConfig.primaryColor;

  // Ball carrier: piece holds the ball — render directional possession dot (D-15)
  const isBallCarrier = carrierId !== null && piece.id === carrierId;
  // Dot direction: home team attacks right (higher q) → bottom-right (+x, +y)
  // Away team attacks left (lower q) → bottom-left (-x, +y) — keyed off teamId per Open Question 3
  void attackingTeam; // direction uses piece.teamId per Open Question 3; prop kept for future overrides (D-16)
  void fill; // used for stroke reference; circle fill is pattern url for outfield / solid for GK
  const PIECE_RADIUS = 12;
  const dotOffsetX = piece.teamId === 'home' ? PIECE_RADIUS * 0.715 : -(PIECE_RADIUS * 0.715);
  const dotOffsetY = PIECE_RADIUS * 0.715;

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

      {/* Away GK checker pattern def — one shade darker than prior pink-600/pink-900 */}
      {isGK && piece.teamId === 'away' && (
        <defs>
          <pattern
            id={`away-gk-checker-${piece.id}`}
            x={cx - PIECE_RADIUS}
            y={cy - PIECE_RADIUS}
            width={12}
            height={12}
            patternUnits="userSpaceOnUse"
          >
            <rect width={12} height={12} fill="#be185d" />
            <rect x={0} y={0} width={6} height={6} fill="#500724" />
            <rect x={6} y={6} width={6} height={6} fill="#500724" />
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
              : `url(#away-gk-checker-${piece.id})`
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
      {/* OFFSIDE-01 (D-25): double-width red ring — independent layer, not part of the
          selectionState switch above. A piece can be simultaneously offside and
          selectable/active/activated (both rings render). */}
      {isOffside && (
        <circle
          cx={cx}
          cy={cy}
          r={PIECE_RADIUS + 6}
          fill="none"
          stroke="#dc2626"
          strokeWidth={5}
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
