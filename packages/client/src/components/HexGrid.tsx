import { PITCH_HEXES } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { computeViewBox, HEX_SIZE } from '../utils/hexToPixel.js';
import { HexCell } from './HexCell.js';
import { PieceOverlay } from './PieceOverlay.js';
import { BallMarker } from './BallMarker.js';
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
  const validMoveHexes = useGameStore((s) => s.validMoveHexes);
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const selectPiece = useGameStore((s) => s.selectPiece);
  const movePiece = useGameStore((s) => s.movePiece);

  // O(1) membership check for valid-move highlights
  const validMoveHexSet = new Set(validMoveHexes.map((h) => `${h.q},${h.r}`));

  // Translate offset to prevent q=0,r=0 hex clipping (Pitfall 5)
  const translateX = HEX_SIZE;
  const translateY = (HEX_SIZE * Math.sqrt(3)) / 2;

  return (
    <svg className={styles.hexGrid} viewBox={computeViewBox()} preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id="pitch-clip">
          <rect x={CLIP_X} y={CLIP_Y} width={CLIP_W} height={CLIP_H} />
        </clipPath>
      </defs>
      <g transform={`translate(${translateX}, ${translateY})`} clipPath="url(#pitch-clip)">
        {/* Layer 1: Hex cells — base pitch fill and valid-move highlights */}
        {PITCH_HEXES.map((hex) => {
          const hexId = `${hex.q},${hex.r}`;
          const isHighlighted = validMoveHexSet.has(hexId);
          return (
            <HexCell
              key={hexId}
              hex={hex}
              isHighlighted={isHighlighted}
              onClick={isHighlighted ? () => movePiece(hex) : () => undefined}
            />
          );
        })}
        {/* Layer 2: Ball marker — above hexes, below pieces */}
        <BallMarker ball={ball} />
        {/* Layer 3: Piece overlays — topmost layer, all 22 pieces */}
        {pieces.map((piece) => (
          <PieceOverlay
            key={piece.id}
            piece={piece}
            isSelected={piece.id === selectedPieceId}
            isClickable={phase === 'MOVEMENT' && piece.teamId === activeTeam}
            onClick={() => selectPiece(piece.id)}
            carrierId={ball.carrierId}
          />
        ))}
      </g>
    </svg>
  );
}
