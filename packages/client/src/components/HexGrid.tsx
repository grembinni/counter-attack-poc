import { useState } from 'react';
import { PITCH_HEXES, isInRegion, ClientEvents, PITCH_REGIONS } from '@counter-attack/shared';
import type { HexCoord } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { socket } from '../socket.js';
import { computeViewBox, HEX_SIZE, axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';
import { HexCell } from './HexCell.js';
import { PieceOverlay } from './PieceOverlay.js';
import { BallMarker } from './BallMarker.js';
import { PitchMarkings } from './PitchMarkings.js';
import { GoalNets } from './GoalNets.js';
import styles from './HexGrid.module.css';

const SQRT3 = Math.sqrt(3);
// Clip rect produces a symmetric rectangular pitch boundary.
// Top  (y=CLIP_Y):        even-q r=0  centre  → bottom-half visible; odd-q r=0  top-flat at line → full.
// Bottom (y=CLIP_Y+H):   even-q r=25 centre  → top-half visible;    odd-q r=24 bot-flat at line → full.
// Left/right: clip path operates in the <g>'s LOCAL coordinate space (post-translate).
// Left:  CLIP_X = −HEX_SIZE/2 = −10  → clips at the 120°/240° corners of q=0  (local x=−10); 180° tips at local −20 are outside → removed.
// Right: CLIP_RIGHT = q36_center + HEX_SIZE/2 = 1080+10 = 1090 → clips at the 60°/300° corners of q=36; 0° tips at local 1100 are outside → removed.
const CLIP_X = -(HEX_SIZE / 2); // -10 — local x of 120°/240° corners of q=0
const CLIP_RIGHT = HEX_SIZE * 1.5 * 36 + HEX_SIZE / 2; // 1090 — local x of 60°/300° corners of q=36
const CLIP_Y = HEX_SIZE * SQRT3 * 0.5;
const CLIP_W = CLIP_RIGHT - CLIP_X; // 1100
const CLIP_H = HEX_SIZE * SQRT3 * 25; // clips at even-q r=25 centre — mirrors top

/**
 * SVG root element for the Counter Attack pitch.
 * Renders all 962 HexCell polygons, BallMarker, and PieceOverlay elements inside
 * a single <svg> root — z-order is DOM order: hexes → BallMarker → PieceOverlay.
 * Anti-pattern: NEVER use a second <svg> for overlays (PATTERNS.md z-order note).
 *
 * Pitfall 5 mitigation: <g transform="translate(HEX_SIZE, HEX_SIZE * √3/2)"> offsets
 * origin so the q=0,r=0 hex center is not clipped at the SVG edge.
 *
 * Pitfall 6 mitigation: Individual Zustand selectors per slice to avoid re-renders
 * from unrelated state changes.
 */
export function HexGrid() {
  // Subscribe to individual slices — avoids whole-component re-renders on unrelated changes (Pitfall 6)
  const pieces = useGameStore((s) => s.gameState.pieces);
  const ball = useGameStore((s) => s.gameState.ball);
  const phase = useGameStore((s) => s.gameState.phase);
  const activeTeam = useGameStore((s) => s.gameState.activeTeam);
  const attackingTeam = useGameStore((s) => s.gameState.attackingTeam);
  const movedPieceIds = useGameStore((s) => s.gameState.movedPieceIds);
  const validMoveHexes = useGameStore((s) => s.validMoveHexes);
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const selectPiece = useGameStore((s) => s.selectPiece);
  const inspectPiece = useGameStore((s) => s.inspectPiece);
  const emitMove = useGameStore((s) => s.emitMove);
  const emitKickOffMove = useGameStore((s) => s.emitKickOffMove);

  const myTeam: 'home' | 'away' | null =
    playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
  const isActivePlayer = myTeam !== null && myTeam === activeTeam;

  // Optimistic highlight for SHOT target — cosmetic only; server emit is source of truth (D-06)
  const [shotTargetHighlight, setShotTargetHighlight] = useState<HexCoord | null>(null);

  // O(1) membership check for valid-move highlights
  const validMoveHexSet = new Set(validMoveHexes.map((h) => `${h.q},${h.r}`));

  // KICK_OFF_SETUP: derive the local team's valid placement zone (D-23)
  // Attacking team: own half + centre circle; defending team: own half excluding centre circle
  const isKickOffSetup = phase === 'KICK_OFF_SETUP';
  const isMyAttacking = isKickOffSetup && myTeam !== null && myTeam === attackingTeam;

  // Determine if a hex is in the local team's valid kick-off placement zone
  const isInMyKickOffZone = (hex: HexCoord): boolean => {
    if (!isKickOffSetup || myTeam === null) return false;
    const inCentreCircle = PITCH_REGIONS.centreCircle.has(`${hex.q},${hex.r}`);
    if (myTeam === 'home') {
      // Home: own half is q <= 18
      if (isMyAttacking) {
        // Attacking: q <= 18 OR centre circle
        return hex.q <= 18 || inCentreCircle;
      } else {
        // Defending: q <= 18 but NOT in centre circle
        return hex.q <= 18 && !inCentreCircle;
      }
    } else {
      // Away: own half is q >= 18
      if (isMyAttacking) {
        // Attacking: q >= 18 OR centre circle
        return hex.q >= 18 || inCentreCircle;
      } else {
        // Defending: q >= 18 but NOT in centre circle
        return hex.q >= 18 && !inCentreCircle;
      }
    }
  };

  // Zone tint colour for the local team (T-08-19: own-team only; opponent zone has no tint)
  const kickOffZoneColor = myTeam === 'home' ? '#1a56b0' : '#c0392b';

  // Translate offset to prevent q=0,r=0 hex clipping (Pitfall 5)
  const translateX = HEX_SIZE;
  const translateY = (HEX_SIZE * Math.sqrt(3)) / 2;

  return (
    <svg className={styles.hexGrid} viewBox={computeViewBox()} preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id="pitch-clip">
          <rect x={CLIP_X} y={CLIP_Y} width={CLIP_W} height={CLIP_H} />
        </clipPath>
        {/* D-09: Goal net mesh pattern — reused by both goal net rects in GoalNets */}
        <pattern id="goal-net" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 0 0 L 8 0 M 0 0 L 0 8" stroke="rgba(255,255,255,0.4)" strokeWidth={0.8} />
        </pattern>
      </defs>
      <g transform={`translate(${translateX}, ${translateY})`}>
        {/* Goal nets: outside clip boundary — rendered as sibling of clipped group (D-09) */}
        <GoalNets />
        <g clipPath="url(#pitch-clip)">
          {/* Layer 1: Hex cells — base pitch fill and valid-move / goal-hex highlights */}
          {PITCH_HEXES.map((hex) => {
            const hexId = `${hex.q},${hex.r}`;
            const isValidMove = validMoveHexSet.has(hexId);
            // D-06: goal hexes are clickable during SHOT phase to emit the target to the server
            const isGoalHex =
              phase === 'SHOT' && (isInRegion(hex, 'homeGoal') || isInRegion(hex, 'awayGoal'));
            const isShotTarget =
              shotTargetHighlight !== null &&
              hex.q === shotTargetHighlight.q &&
              hex.r === shotTargetHighlight.r;
            const isHighlighted = isValidMove || isGoalHex || isShotTarget;

            let onClick: (() => void) | undefined;
            if (phase === 'KICK_OFF_SETUP') {
              // KICK_OFF_SETUP: clicking a valid zone hex while a piece is selected → emitKickOffMove (T-08-19)
              if (isValidMove && selectedPieceId) {
                onClick = () => emitKickOffMove(selectedPieceId, hex);
              }
              // Clicking any other hex during setup is a no-op — handled by the piece's own onClick below
            } else if (isValidMove && selectedPieceId) {
              onClick = () => emitMove(selectedPieceId, hex);
            } else if (isGoalHex) {
              // D-06: emit target to server; optimistic highlight is cosmetic
              onClick = () => {
                setShotTargetHighlight(hex);
                socket.emit(ClientEvents.GAME_SHOT, hex);
              };
            }

            // KICK_OFF_SETUP zone tint overlays — rendered as additional polygons after base hex
            const inMyZone = isKickOffSetup ? isInMyKickOffZone(hex) : false;
            const isCentreHex =
              isKickOffSetup &&
              hex.q === PITCH_REGIONS.kickOffHex.q &&
              hex.r === PITCH_REGIONS.kickOffHex.r;
            const { cx, cy } = axialToPixel(hex.q, hex.r);
            const points = hexPolygonPoints(cx, cy);

            return (
              <g key={hexId}>
                <HexCell
                  hex={hex}
                  isHighlighted={isHighlighted}
                  highlightColor={isGoalHex || isShotTarget ? '#ef4444' : undefined}
                  onClick={onClick ?? (() => undefined)}
                />
                {/* KICK_OFF_SETUP: zone tint overlay (own team valid zone, excluding occupied hexes) */}
                {inMyZone && !isCentreHex && (
                  <polygon
                    points={points}
                    fill={kickOffZoneColor}
                    fillOpacity={0.25}
                    stroke="none"
                    pointerEvents="none"
                  />
                )}
                {/* KICK_OFF_SETUP: centre hex gold fill overlay (always visible during setup, MATCH-03) */}
                {isCentreHex && (
                  <polygon
                    points={points}
                    fill="#f5c518"
                    fillOpacity={0.5}
                    stroke="none"
                    pointerEvents="none"
                  />
                )}
                {/* KICK_OFF_SETUP: centre hex required ring (2px gold stroke, no fill) */}
                {isCentreHex && (
                  <polygon
                    points={points}
                    fill="none"
                    stroke="#f5c518"
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}
          {/* Layer 1.5: Pitch markings — cosmetic SVG overlay; under pieces, over hex fill (D-07, D-08, D-12) */}
          <PitchMarkings />
          {/* Layer 2: Ball marker — above hexes, below pieces */}
          <BallMarker ball={ball} />
          {/* Layer 3: Piece overlays — topmost layer, all 22 pieces */}
          {pieces.map((piece) => {
            const canSelect =
              isActivePlayer &&
              phase === 'MOVEMENT' &&
              piece.teamId === activeTeam &&
              !movedPieceIds.includes(piece.id); // Pitfall 8: exclude already-moved pieces
            // KICK_OFF_SETUP: both teams reposition their own pieces; opponent pieces are no-ops (T-08-19)
            const canSelectKickOff = isKickOffSetup && myTeam !== null && piece.teamId === myTeam;
            const isClickable = canSelect || canSelectKickOff;
            const handleClick = canSelectKickOff
              ? () => selectPiece(piece.id)
              : canSelect
                ? () => selectPiece(piece.id)
                : () => undefined;
            return (
              <PieceOverlay
                key={piece.id}
                piece={piece}
                isSelected={piece.id === selectedPieceId}
                isClickable={isClickable}
                onClick={handleClick}
                onInspect={() => inspectPiece(piece.id)} // D-06: stats-only; no move computation — no socket.emit
                carrierId={ball.carrierId}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}
