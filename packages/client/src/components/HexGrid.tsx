import { useState } from 'react';
import {
  PITCH_HEXES,
  isInRegion,
  ClientEvents,
  PITCH_REGIONS,
  getZoIDefenders,
  hexDistance,
  hexLine,
} from '@counter-attack/shared';
import type { HexCoord } from '@counter-attack/shared';
import { useGameStore } from '../store/useGameStore.js';
import { socket } from '../socket.js';
import { computeViewBox, HEX_SIZE, axialToPixel, hexPolygonPoints } from '../utils/hexToPixel.js';
import { HexCell } from './HexCell.js';
import type { HexHighlightType } from './HexCell.js';
import { PieceOverlay } from './PieceOverlay.js';
import type { SelectionState } from './PieceOverlay.js';
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
  const movementSlot = useGameStore((s) => s.gameState.movementSlot);
  const paceUsedByPieceId = useGameStore((s) => s.gameState.paceUsedByPieceId);
  const validMoveHexes = useGameStore((s) => s.validMoveHexes);
  const tackleRiskHexes = useGameStore((s) => s.tackleRiskHexes);
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const selectPiece = useGameStore((s) => s.selectPiece);
  const inspectPiece = useGameStore((s) => s.inspectPiece);
  const emitMove = useGameStore((s) => s.emitMove);
  const emitKickOffMove = useGameStore((s) => s.emitKickOffMove);

  // Phase 8.2: pass target highlight slices (D-06, D-09)
  const validPassTargetHexes = useGameStore((s) => s.validPassTargetHexes);
  const interceptionRiskHexes = useGameStore((s) => s.interceptionRiskHexes);
  const passTargetHex = useGameStore((s) => s.passTargetHex);
  const selectedPassType = useGameStore((s) => s.selectedPassType);
  const setPassTargetHex = useGameStore((s) => s.setPassTargetHex);
  const confirmPassTarget = useGameStore((s) => s.confirmPassTarget);

  // Phase 8.2: header contestant (D-17)
  const headerContestantIds = useGameStore((s) => s.headerContestantIds);
  const toggleHeaderContestantId = useGameStore((s) => s.toggleHeaderContestantId);
  const headerConfirmed = useGameStore((s) => s.gameState.headerConfirmed);
  const headerTargetHex = useGameStore((s) => s.gameState.headerTargetHex);
  // HIGH_PASS_MOVEMENT: track locked piece and pace so selection gating + spent X match server rule
  const highPassMovedPieceId = useGameStore((s) => s.gameState.highPassMovedPieceId);
  const highPassPaceUsed = useGameStore((s) => s.gameState.highPassPaceUsed);
  // GK_KICK_MOVEMENT: track locked piece so multi-step moves stay on the same piece
  const gkKickMovedPieceId = useGameStore((s) => s.gameState.gkKickMovedPieceId);
  // Phase 10: shooting mode, GK dive/header-target actions
  const shootingMode = useGameStore((s) => s.shootingMode);
  const emitDeclareShot = useGameStore((s) => s.emitDeclareShot);
  const emitGKDive = useGameStore((s) => s.emitGKDive);
  const emitHeaderTarget = useGameStore((s) => s.emitHeaderTarget);
  const emitQuickThrow = useGameStore((s) => s.emitQuickThrow);
  const gkDivePosition = useGameStore((s) => s.gameState.gkDivePosition);
  const shotTargetHex = useGameStore((s) => s.gameState.shotTargetHex);
  const snapDeflectMovedPieceId = useGameStore((s) => s.gameState.snapDeflectMovedPieceId);
  // RULE-04 (Phase 11): subscribe to pace counter so HexGrid suppresses selection once exhausted
  const snapDeflectPaceUsed = useGameStore((s) => s.gameState.snapDeflectPaceUsed);
  const lastShotPath = useGameStore((s) => s.gameState.lastShotPath);
  const emitGKKickTarget = useGameStore((s) => s.emitGKKickTarget);

  const myTeam: 'home' | 'away' | null =
    playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
  const isActivePlayer = myTeam !== null && myTeam === activeTeam;

  // Optimistic highlight for SHOT target — cosmetic only; server emit is source of truth (D-06)
  const [shotTargetHighlight, setShotTargetHighlight] = useState<HexCoord | null>(null);

  // Phase 10: Goal line hexes (used for shootingMode two-step and HEADER target)
  const GOAL_R_VALUES = [10, 11, 12, 13, 14, 15, 16];
  const goalQ = attackingTeam === 'home' ? 36 : 0;
  const goalLineHexSet = new Set(GOAL_R_VALUES.map((r) => `${goalQ},${r}`));

  // GK_DIVING: valid dive targets are shot-path hexes within 3 hexes of GK's starting position.
  const gkDiveTargetSet = new Set<string>();
  if (phase === 'GK_DIVING' && gkDivePosition !== null && gkDivePosition !== undefined) {
    // For a regular shot the ball has a carrier (the shooter). For a header-at-goal the ball
    // was in the air (carrierId=null) — fall back to ball.position as the shot origin.
    const shooterPiece = ball.carrierId ? pieces.find((p) => p.id === ball.carrierId) : null;
    const shotOrigin = shooterPiece?.position ?? ball.position;
    if (shotTargetHex !== null && shotTargetHex !== undefined) {
      for (const h of hexLine(shotOrigin, shotTargetHex)) {
        if (hexDistance(gkDivePosition, h) <= 3) {
          gkDiveTargetSet.add(`${h.q},${h.r}`);
        }
      }
    }
  }

  // HEADER target step: goal line hexes (both sides) for the attacker's selection
  const bothConfirmed = (headerConfirmed?.home ?? false) && (headerConfirmed?.away ?? false);
  const headerTargetStep =
    phase === 'HEADER' &&
    bothConfirmed &&
    headerTargetHex == null && // == catches both null and undefined (field is optional in GameState)
    isActivePlayer &&
    myTeam === attackingTeam;

  // O(1) membership check for valid-move highlights
  const validMoveHexSet = new Set(validMoveHexes.map((h) => `${h.q},${h.r}`));

  // Phase 8.2: O(1) sets for pass target highlights (D-06, D-09)
  const validPassTargetHexSet = new Set(validPassTargetHexes.map((h) => `${h.q},${h.r}`));
  const interceptionRiskSet = new Set(interceptionRiskHexes.map((h) => `${h.q},${h.r}`));

  // ZoI steal-risk hexes: only when ball carrier is selected (red tint = steal danger)
  const isCarrierSelected = selectedPieceId !== null && selectedPieceId === ball.carrierId;
  const opponents = myTeam !== null ? pieces.filter((p) => p.teamId !== myTeam) : [];
  const zoiRiskSet = new Set(
    isCarrierSelected
      ? validMoveHexes
          .filter((hex) => getZoIDefenders(hex, opponents).length > 0)
          .map((h) => `${h.q},${h.r}`)
      : [],
  );
  // Tackle-risk hexes: orange when non-carrier's step would land adjacent to ball carrier
  const tackleRiskSet = new Set(tackleRiskHexes.map((h) => `${h.q},${h.r}`));

  // SNAP_DEFLECT: orange-tint shot path from shooter position to declared target hex
  const snapDeflectPathSet = new Set<string>();
  if (phase === 'SNAP_DEFLECT' && shotTargetHex !== null && shotTargetHex !== undefined) {
    const shooter = ball.carrierId ? pieces.find((p) => p.id === ball.carrierId) : null;
    if (shooter) {
      for (const h of hexLine(shooter.position, shotTargetHex)) {
        snapDeflectPathSet.add(`${h.q},${h.r}`);
      }
    }
  }

  // KICK_OFF_SETUP: derive the local team's valid placement zone (D-23)
  // Attacking team: own half + centre circle; defending team: own half excluding centre circle
  const isKickOffSetup = phase === 'KICK_OFF_SETUP';
  const isMyAttacking = isKickOffSetup && myTeam !== null && myTeam === attackingTeam;

  // Determine if a hex is in the local team's valid kick-off placement zone
  const isInMyKickOffZone = (hex: HexCoord): boolean => {
    if (!isKickOffSetup || myTeam === null) return false;
    const inCentreCircle = PITCH_REGIONS.centreCircle.has(`${hex.q},${hex.r}`);
    if (myTeam === 'home') {
      // Attacking: q <= 18; defending: strictly q < 18, not in centre circle
      return isMyAttacking ? hex.q <= 18 : hex.q < 18 && !inCentreCircle;
    } else {
      // Attacking: q >= 18; defending: strictly q > 18, not in centre circle
      return isMyAttacking ? hex.q >= 18 : hex.q > 18 && !inCentreCircle;
    }
  };

  // Shot path highlight: O(1) lookup set for the last resolved shot trajectory
  const lastShotPathSet = new Set<string>((lastShotPath ?? []).map((h) => `${h.q},${h.r}`));

  // GK_KICK_TARGET: all pitch hexes not in the opponent's final third (GK's team restricted)
  const gkKickTargetSet = new Set<string>();
  if (phase === 'GK_KICK_TARGET' && isActivePlayer) {
    const gk = pieces.find((p) => p.id === ball.carrierId);
    if (gk) {
      const restrictedRegion = gk.teamId === 'home' ? 'awayThird' : 'homeThird';
      for (const h of PITCH_HEXES) {
        if (isInRegion(h, restrictedRegion)) continue;
        if (h.q === gk.position.q && h.r === gk.position.r) continue;
        gkKickTargetSet.add(`${h.q},${h.r}`);
      }
    }
  }

  // QUICK_THROW: all pitch hexes within 11 hexes of the GK (no blocking, no interception)
  const quickThrowTargetSet = new Set<string>();
  if (phase === 'QUICK_THROW' && isActivePlayer) {
    const gk = pieces.find((p) => p.id === ball.carrierId);
    if (gk) {
      for (const h of PITCH_HEXES) {
        const d = hexDistance(gk.position, h);
        if (d > 0 && d <= 11) quickThrowTargetSet.add(`${h.q},${h.r}`);
      }
    }
  }

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

            // Phase 10: shooting mode goal-line highlight (two-step Shoot flow + SHOT_DECLARED snapshot target)
            // For snapshot (SHOT_DECLARED), apply 6-hex range from carrier — same max as first-time pass.
            const snapCarrier =
              phase === 'SHOT_DECLARED' && ball.carrierId
                ? pieces.find((p) => p.id === ball.carrierId)
                : null;
            const isShootingModeGoalHex =
              isActivePlayer &&
              goalLineHexSet.has(hexId) &&
              (shootingMode ||
                (phase === 'SHOT_DECLARED' &&
                  snapCarrier !== undefined &&
                  snapCarrier !== null &&
                  hexDistance(snapCarrier.position, hex) <= 6));

            // SNAP_DEFLECT: danger path tint — shot line from shooter to declared target
            const isShotPath = snapDeflectPathSet.has(hexId);
            // GK team = defending team during a shot
            const gkTeamForDive: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
            const isGKTeamPlayer = myTeam === gkTeamForDive;
            // Phase 10: GK dive target — gated on isGKTeamPlayer so only the GK's side sees highlights
            const isGKDiveTarget =
              phase === 'GK_DIVING' && gkDiveTargetSet.has(hexId) && isGKTeamPlayer;

            // Phase 10: HEADER target hex selection step — same range as first-time pass (≤6 hexes)
            const headerDist = headerTargetStep ? hexDistance(hex, ball.position) : Infinity;
            const isHeaderTargetGoalHex =
              headerTargetStep && goalLineHexSet.has(hexId) && headerDist <= 6;
            const isHeaderNonGoalTarget =
              headerTargetStep && !goalLineHexSet.has(hexId) && headerDist <= 6;

            // Suppress gold move highlights during reposition phases — separate subtle overlay below
            // D-28: also suppress for GK_DIVING/SNAP_DEFLECT phases (highlights already cleared by setGameState)
            const isHighlighted =
              isShootingModeGoalHex ||
              isHeaderTargetGoalHex ||
              (phase !== 'HIGH_PASS_MOVEMENT' &&
                phase !== 'GK_KICK_MOVEMENT' &&
                phase !== 'GK_DIVING' &&
                phase !== 'SNAP_DEFLECT' &&
                isValidMove) ||
              isGoalHex ||
              isShotTarget;
            const isHpMoveTarget =
              ((phase === 'HIGH_PASS_MOVEMENT' ||
                phase === 'SNAP_DEFLECT' ||
                phase === 'GK_KICK_MOVEMENT') &&
                selectedPieceId !== null &&
                isValidMove) ||
              isGKDiveTarget;

            // Phase 8.2 D-06/D-09: pass target classification (KICK_OFF uses same three-step flow)
            const isPassTarget =
              (phase === 'PASS' || phase === 'KICK_OFF') &&
              selectedPassType !== null &&
              validPassTargetHexSet.has(hexId);
            const isInterceptionRisk = isPassTarget && interceptionRiskSet.has(hexId);
            const isConfirmedPassTarget =
              passTargetHex !== null && hex.q === passTargetHex.q && hex.r === passTargetHex.r;

            // KICK_OFF_SETUP zone — must be computed before highlightType derivation below
            const inMyZone = isKickOffSetup ? isInMyKickOffZone(hex) : false;
            const isCentreHex =
              isKickOffSetup &&
              hex.q === PITCH_REGIONS.kickOffHex.q &&
              hex.r === PITCH_REGIONS.kickOffHex.r;

            // Plan 04 D-12: priority-resolve highlightType (risk > goal > shot-path > kickoff > safe)
            // isRisk: ZoI steal-risk OR tackle-risk movement OR snap-deflect shot path (all orange)
            const isRisk =
              (zoiRiskSet.has(hexId) && isValidMove) ||
              (tackleRiskSet.has(hexId) && isValidMove) ||
              isShotPath;
            const isGoalTint =
              isGoalHex || isShotTarget || isShootingModeGoalHex || isHeaderTargetGoalHex;
            // isShotPathTint: resolved shot path, HIGH_PASS reposition targets, GK dive targets (white tint)
            const isShotPathTint = lastShotPathSet.has(hexId) || isHpMoveTarget || isGKDiveTarget;
            // isKickoffTint: own-team valid zone during KICK_OFF_SETUP (excluding centre hex)
            const isKickoffTint = inMyZone && !isCentreHex;
            // isSafeTint: normal valid-move hexes not classified as goal-line
            const isSafeTint = isHighlighted && !isGoalTint;
            const highlightType: HexHighlightType | undefined = isRisk
              ? 'risk'
              : isGoalTint
                ? 'goal'
                : isShotPathTint
                  ? 'shot-path'
                  : isKickoffTint
                    ? 'kickoff'
                    : isSafeTint
                      ? 'safe'
                      : undefined;

            let onClick: (() => void) | undefined;
            if (phase === 'KICK_OFF_SETUP') {
              // KICK_OFF_SETUP: clicking a valid zone hex while a piece is selected → emitKickOffMove (T-08-19)
              if (isValidMove && selectedPieceId) {
                onClick = () => emitKickOffMove(selectedPieceId, hex);
              }
              // Clicking any other hex during setup is a no-op — handled by the piece's own onClick below
            } else if (phase === 'GK_DIVING' && isGKDiveTarget && isGKTeamPlayer) {
              // Phase 10: GK team clicks a valid dive hex during GK_DIVING
              onClick = () => emitGKDive(hex);
            } else if (isShootingModeGoalHex) {
              // Phase 10: Two-step Shoot flow — clicking goal hex emits declare shot
              onClick = () => emitDeclareShot(hex);
            } else if (isHeaderTargetGoalHex) {
              // Phase 10: HEADER target step — attacker clicks goal-line hex
              onClick = () => emitHeaderTarget(hex);
            } else if (isHeaderNonGoalTarget) {
              // Phase 10: HEADER target step — attacker clicks any other pitch hex (headed pass)
              onClick = () => emitHeaderTarget(hex);
            } else if (isValidMove && selectedPieceId) {
              onClick = () => emitMove(selectedPieceId, hex);
            } else if (phase === 'GK_KICK_TARGET' && isActivePlayer && gkKickTargetSet.has(hexId)) {
              onClick = () => emitGKKickTarget(hex);
            } else if (
              phase === 'QUICK_THROW' &&
              isActivePlayer &&
              quickThrowTargetSet.has(hexId)
            ) {
              onClick = () => emitQuickThrow(hex);
            } else if (isGoalHex) {
              // D-06: emit target to server (legacy SHOT phase path); optimistic highlight is cosmetic
              onClick = () => {
                setShotTargetHighlight(hex);
                socket.emit(ClientEvents.GAME_SHOT, hex);
              };
            } else if (isPassTarget && isActivePlayer) {
              // Phase 8.2 D-06: click valid pass target to confirm (or deselect confirmed target).
              // STANDARD/FIRST_TIME: confirmPassTarget auto-emits; HIGH/LONG_BALL: sets passTargetHex for step 3.
              if (isConfirmedPassTarget) {
                onClick = () => setPassTargetHex(null);
              } else if (passTargetHex === null) {
                onClick = () => confirmPassTarget(hex);
              }
            }

            const { cx, cy } = axialToPixel(hex.q, hex.r);
            const points = hexPolygonPoints(cx, cy);

            return (
              <g key={hexId}>
                <HexCell
                  hex={hex}
                  highlightType={highlightType}
                  onClick={onClick ?? (() => undefined)}
                />
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
                {/* HEADER phase: gold overlay on ball position hex so players can see where the ball landed */}
                {phase === 'HEADER' && hex.q === ball.position.q && hex.r === ball.position.r && (
                  <polygon
                    points={points}
                    fill="#f5c518"
                    fillOpacity={0.5}
                    stroke="#f5c518"
                    strokeWidth={2}
                    pointerEvents="none"
                  />
                )}
                {/* HEADER target step: white shot-path tint on all non-goal-line pitch hexes (headed pass targets) — D-13 */}
                {isHeaderNonGoalTarget && (
                  <polygon
                    points={points}
                    fill="rgba(255,255,255,0.35)"
                    stroke="#cccccc"
                    strokeWidth={0.5}
                    onClick={onClick}
                    style={{ cursor: 'pointer' }}
                  />
                )}
                {/* GK_KICK_TARGET: sky-blue tint on valid kick destinations */}
                {gkKickTargetSet.has(hexId) && (
                  <polygon
                    points={points}
                    fill="rgba(56,189,248,0.30)"
                    stroke="rgba(56,189,248,0.55)"
                    strokeWidth={1}
                    onClick={() => emitGKKickTarget(hex)}
                    style={{ cursor: 'pointer' }}
                  />
                )}
                {/* QUICK_THROW: green tint on valid target hexes (no blocking, no interception) */}
                {quickThrowTargetSet.has(hexId) && (
                  <polygon
                    points={points}
                    fill="rgba(34,197,94,0.35)"
                    stroke="rgba(34,197,94,0.6)"
                    strokeWidth={1}
                    onClick={() => emitQuickThrow(hex)}
                    style={{ cursor: 'pointer' }}
                  />
                )}
                {/* Phase 8.2 D-06: safe pass target — green tint, handles click */}
                {isPassTarget && !isInterceptionRisk && !isConfirmedPassTarget && (
                  <polygon
                    points={points}
                    fill="rgba(34,197,94,0.4)"
                    stroke="none"
                    onClick={onClick}
                    style={{ cursor: onClick ? 'pointer' : 'default' }}
                  />
                )}
                {/* Phase 8.2 D-09: interception-risk pass target — amber, handles click */}
                {isInterceptionRisk && !isConfirmedPassTarget && (
                  <polygon
                    points={points}
                    className={styles.hexTackleRisk}
                    stroke="none"
                    onClick={onClick}
                    style={{ cursor: onClick ? 'pointer' : 'default' }}
                  />
                )}
                {/* Phase 8.2 D-06: confirmed pass target — gold outline ring, handles deselect click */}
                {isConfirmedPassTarget && (
                  <polygon
                    points={points}
                    fill="none"
                    stroke="#f5c518"
                    strokeWidth={2}
                    onClick={onClick}
                    style={{ cursor: onClick ? 'pointer' : 'default' }}
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
            // During GK_DIVING, visually show the defending GK at their current dive position.
            // gk.position in state.pieces is the original position (used for cumulative distance check);
            // gkDivePosition tracks where they actually are on screen.
            const gkDiveTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
            const displayPiece =
              phase === 'GK_DIVING' &&
              gkDivePosition != null &&
              piece.role === 'GK' &&
              piece.teamId === gkDiveTeam
                ? { ...piece, position: gkDivePosition }
                : piece;

            // Slot quota: how many activations remain in this slot
            const slotQuota =
              movementSlot === 'ATTACKER_4' ? 4 : movementSlot === 'DEFENDER_5' ? 5 : 2;
            const activatedCount = Object.keys(paceUsedByPieceId).length;
            const pieceAlreadyActivated = (paceUsedByPieceId[piece.id] ?? 0) > 0;
            const slotFull = activatedCount >= slotQuota && !pieceAlreadyActivated;

            const canSelect =
              isActivePlayer &&
              phase === 'MOVEMENT' &&
              piece.teamId === activeTeam &&
              !movedPieceIds.includes(piece.id) && // already moved this phase
              !slotFull; // slot quota exhausted
            // KICK_OFF_SETUP: both teams reposition their own pieces; opponent pieces are no-ops (T-08-19)
            const canSelectKickOff = isKickOffSetup && myTeam !== null && piece.teamId === myTeam;
            // HIGH_PASS_MOVEMENT: active team selects 1 own piece to reposition up to 3 hexes
            const canSelectHighPassMove =
              phase === 'HIGH_PASS_MOVEMENT' &&
              isActivePlayer &&
              myTeam !== null &&
              piece.teamId === myTeam &&
              (highPassMovedPieceId === null || highPassMovedPieceId === piece.id);
            // SNAP_DEFLECT: defending team selects 1 own piece to move up to 2 hexes
            const snapDefendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
            const canSelectSnapDeflect =
              phase === 'SNAP_DEFLECT' &&
              myTeam !== null &&
              myTeam === snapDefendingTeam &&
              piece.teamId === myTeam &&
              (snapDeflectMovedPieceId === null || snapDeflectMovedPieceId === piece.id) &&
              (snapDeflectPaceUsed ?? 0) < 2; // RULE-04 D-09: suppress when pace exhausted
            // GK_KICK_MOVEMENT: active team selects 1 own piece to reposition up to 3 hexes
            const canSelectGKKickMove =
              phase === 'GK_KICK_MOVEMENT' &&
              isActivePlayer &&
              myTeam !== null &&
              piece.teamId === myTeam &&
              (gkKickMovedPieceId === null || gkKickMovedPieceId === piece.id);

            // Phase 8.2 D-17: HEADER phase — eligible own pieces (≤2 hexes from ball) can toggle contestant.
            // Both teams select independently; gated on not yet confirmed for this team.
            const isHeaderPhase = phase === 'HEADER';
            const isOwnPiece = myTeam !== null && piece.teamId === myTeam;
            const myTeamConfirmed =
              isHeaderPhase && myTeam !== null ? (headerConfirmed?.[myTeam] ?? false) : false;
            const isHeaderEligible =
              isHeaderPhase &&
              !myTeamConfirmed &&
              isOwnPiece &&
              hexDistance(piece.position, ball.position) <= 2;
            const isHeaderContestant = isHeaderPhase && headerContestantIds.includes(piece.id);

            // Pass targeting: clicking a piece on a valid pass target hex is the same as clicking that hex.
            const pieceHexId = `${piece.position.q},${piece.position.r}`;
            const isPassTargetPiece =
              isActivePlayer && selectedPassType !== null && validPassTargetHexSet.has(pieceHexId);
            const pieceHexConfirmed =
              isPassTargetPiece &&
              passTargetHex !== null &&
              passTargetHex.q === piece.position.q &&
              passTargetHex.r === piece.position.r;
            // QUICK_THROW: clicking a piece on a valid target hex emits throw to that hex (not selectPiece)
            const isQuickThrowTargetPiece =
              phase === 'QUICK_THROW' && isActivePlayer && quickThrowTargetSet.has(pieceHexId);

            const isClickable =
              isPassTargetPiece ||
              isQuickThrowTargetPiece ||
              canSelect ||
              canSelectKickOff ||
              isHeaderEligible ||
              canSelectHighPassMove ||
              canSelectSnapDeflect ||
              canSelectGKKickMove;

            // Plan 04: derive single selectionState enum for PieceOverlay (UX-05, D-04, D-07)
            const isSpentNow =
              phase === 'HIGH_PASS_MOVEMENT'
                ? piece.id === highPassMovedPieceId && (highPassPaceUsed ?? 0) >= 3
                : movedPieceIds.includes(piece.id);
            const selectionState: SelectionState = isSpentNow
              ? 'activated'
              : piece.id === selectedPieceId || isHeaderEligible || isHeaderContestant
                ? 'active'
                : isClickable
                  ? 'selectable'
                  : 'none';

            const handleClick = isQuickThrowTargetPiece
              ? () => emitQuickThrow(piece.position)
              : isPassTargetPiece
                ? () => {
                    if (pieceHexConfirmed) {
                      setPassTargetHex(null);
                    } else if (passTargetHex === null) {
                      confirmPassTarget(piece.position);
                    }
                  }
                : canSelectGKKickMove
                  ? () => selectPiece(piece.id)
                  : canSelectSnapDeflect
                    ? () => selectPiece(piece.id)
                    : canSelectHighPassMove
                      ? () => selectPiece(piece.id)
                      : isHeaderEligible
                        ? () => {
                            toggleHeaderContestantId(piece.id);
                          }
                        : canSelectKickOff
                          ? () => selectPiece(piece.id)
                          : canSelect
                            ? () => selectPiece(piece.id)
                            : () => undefined;

            return (
              <PieceOverlay
                key={piece.id}
                piece={displayPiece}
                selectionState={selectionState}
                onClick={handleClick}
                onInspect={() => inspectPiece(piece.id)}
                carrierId={ball.carrierId}
                attackingTeam={attackingTeam}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}
