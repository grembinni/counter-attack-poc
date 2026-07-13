import { useState, useEffect } from 'react';
import {
  PITCH_HEXES,
  GOAL_R_VALUES,
  isInRegion,
  ClientEvents,
  PITCH_REGIONS,
  getZoIDefenders,
  hexDistance,
  hexLine,
  freeKickStageTeam,
  FREE_KICK_STAGES,
  TEAM_CONFIGS,
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
  // D-02 (Phase 17.1 gap closure, plan 09): steal-risk tint exclusion source
  const stealAttemptedByIds = useGameStore((s) => s.gameState.stealAttemptedByIds);
  // OFFSIDE-01 (D-25): sticky offside flag source for the PieceOverlay red ring
  const offsidePieceIds = useGameStore((s) => s.gameState.offsidePieceIds);
  // Phase 20 D-16: resolve uniformStyle + palette per piece from TEAM_CONFIGS (passed to PieceOverlay)
  const selectedTeams = useGameStore((s) => s.gameState.selectedTeams);
  // Phase 22 D-18: resolve uniformStyle per piece from GameState.selectedUniformStyles (not team default)
  const selectedUniformStyles = useGameStore((s) => s.gameState.selectedUniformStyles);
  // Jersey type per team ('home' or 'away' kit); absent = default (home→home, away→away).
  const selectedJerseyTypes = useGameStore((s) => s.gameState.selectedJerseyTypes);
  const validMoveHexes = useGameStore((s) => s.validMoveHexes);
  const tackleRiskHexes = useGameStore((s) => s.tackleRiskHexes);
  const selectedPieceId = useGameStore((s) => s.selectedPieceId);
  const playerSlot = useGameStore((s) => s.playerSlot);
  const selectPiece = useGameStore((s) => s.selectPiece);
  const inspectPiece = useGameStore((s) => s.inspectPiece);
  const emitMove = useGameStore((s) => s.emitMove);
  const emitKickOffMove = useGameStore((s) => s.emitKickOffMove);
  // OFFSIDE-02 (Phase 17 D-29): free-kick setup repositioning — mirrors emitKickOffMove
  const emitFreeKickMove = useGameStore((s) => s.emitFreeKickMove);
  // OFFSIDE-02 (Phase 17 D-49 staged rework): which stage is active + who's awarded the
  // kick — drives the D-48 persistent geometric highlight and turn-gated clickability.
  const freeKickHex = useGameStore((s) => s.gameState.freeKickHex);
  const freeKickAttackingTeam = useGameStore((s) => s.gameState.freeKickAttackingTeam);
  const freeKickStageIndex = useGameStore((s) => s.gameState.freeKickStageIndex);
  // D-55 (Free Kick Setup — Round 2 Corrections): pieces already counted toward the
  // CURRENT free-kick stage's placement cap — drives the green "moved this stage" ring.
  const freeKickPlacedPieceIds = useGameStore((s) => s.gameState.freeKickPlacedPieceIds);
  const freeKickKickerChosen = useGameStore((s) => s.gameState.freeKickKickerChosen);

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
  const headerDuelWinner = useGameStore((s) => s.gameState.headerDuelWinner);
  const headerWinnerId = useGameStore((s) => s.gameState.headerWinnerId);
  // HIGH_PASS_MOVEMENT: track locked piece and pace so selection gating + spent X match server rule
  const highPassMovedPieceId = useGameStore((s) => s.gameState.highPassMovedPieceId);
  const highPassPaceUsed = useGameStore((s) => s.gameState.highPassPaceUsed);
  // FIRST_TIME_PASS_MOVE: track locked piece so selection gating matches server rule (CR-01-new)
  const firstTimePassMovedPieceId = useGameStore((s) => s.gameState.firstTimePassMovedPieceId);
  // GK_KICK_MOVEMENT: track locked piece so multi-step moves stay on the same piece
  const gkKickMovedPieceId = useGameStore((s) => s.gameState.gkKickMovedPieceId);
  // FREE_MOVE_ATTACK/DEFENSE (Phase 17 MOVE-06, client-wiring fix): precomputed eligible-piece
  // lists (both teams) and per-piece used-pace tracking, mirrors server's freeMove* fields.
  const freeMoveEligibleIds = useGameStore((s) => s.gameState.freeMoveEligibleIds);
  const freeMoveUsedPace = useGameStore((s) => s.gameState.freeMoveUsedPace);
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
  const lastActionType = useGameStore((s) => s.gameState.lastActionType);
  const emitGKKickTarget = useGameStore((s) => s.emitGKKickTarget);

  const myTeam: 'home' | 'away' | null =
    playerSlot === 1 ? 'home' : playerSlot === 2 ? 'away' : null;
  const isActivePlayer = myTeam !== null && myTeam === activeTeam;

  // Optimistic highlight for SHOT target — cosmetic only; server emit is source of truth (D-06)
  const [shotTargetHighlight, setShotTargetHighlight] = useState<HexCoord | null>(null);

  // BUG-23 (D-14 Fix 2): clear shotTargetHighlight when phase transitions to KICK_OFF_SETUP.
  // shotTargetHighlight is set on shot-declaration click and never cleared elsewhere; it can
  // produce a stale red goal-target tint after a SNAPSHOT_DEFLECT goal.
  useEffect(() => {
    if (phase === 'KICK_OFF_SETUP') setShotTargetHighlight(null);
  }, [phase]);

  // Phase 10: Goal line hexes (used for shootingMode two-step and HEADER target)
  // GOAL_R_VALUES imported from @counter-attack/shared — single source of truth
  const goalQ = attackingTeam === 'home' ? 36 : 0;
  const goalLineHexSet = new Set(GOAL_R_VALUES.map((r) => `${goalQ},${r}`));

  // GK_DIVE: valid dive targets are shot-path hexes within 3 hexes of GK's starting position.
  const gkDiveTargetSet = new Set<string>();
  if (phase === 'GK_DIVE' && gkDivePosition !== null && gkDivePosition !== undefined) {
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

  // RULE-02 (Phase 11): the duel winner is pre-computed in GAME_HEADER_CONTESTANT and stored as
  // headerDuelWinner while the server stays in HEADER. The winning team then sees the goal-line
  // (and other pitch) hexes highlighted here so they can pick a target via GAME_HEADER_TARGET.
  const headerTargetStep = phase === 'HEADER' && myTeam !== null && headerDuelWinner === myTeam;
  // Winner's piece position for header target range — headerWinnerId is set alongside headerDuelWinner.
  // Falls back to ball.position if the winner piece is not found (should not occur in normal play).
  const headerWinnerPiece = headerWinnerId
    ? (pieces.find((p) => p.id === headerWinnerId) ?? null)
    : null;

  // DESIGN-02: during post-game REPLAY no hex is ever clickable and no highlight is ever
  // meaningful (nothing in any REPLAY-phase code path calls selectPiece, so selectedPieceId
  // stays null and validMoveHexes/tackleRiskHexes stay empty throughout replay) — short-circuit
  // these previously-unconditional (not already phase-gated) highlight-set derivations so
  // HexGrid does no wasted per-frame derivation work while pieces/ball still render normally.
  // O(1) membership check for valid-move highlights
  const validMoveHexSet =
    phase !== 'REPLAY' ? new Set(validMoveHexes.map((h) => `${h.q},${h.r}`)) : new Set<string>();

  // Phase 8.2: O(1) sets for pass target highlights (D-06, D-09)
  const validPassTargetHexSet = new Set(validPassTargetHexes.map((h) => `${h.q},${h.r}`));
  const interceptionRiskSet = new Set(interceptionRiskHexes.map((h) => `${h.q},${h.r}`));

  // ZoI steal-risk hexes: only when ball carrier is selected (red tint = steal danger)
  const isCarrierSelected = selectedPieceId !== null && selectedPieceId === ball.carrierId;
  const opponents = myTeam !== null ? pieces.filter((p) => p.teamId !== myTeam) : [];
  // D-02 (Phase 17.1 gap closure, plan 09): exclude defenders already in stealAttemptedByIds
  // from the steal-risk tint, mirroring moveValidator.ts's STEAL_ATTEMPT exclusion pattern.
  const zoiRiskSet = new Set(
    phase !== 'REPLAY' && isCarrierSelected
      ? validMoveHexes
          .filter(
            (hex) =>
              getZoIDefenders(hex, opponents).filter(
                (d) => !(stealAttemptedByIds ?? []).includes(d.id),
              ).length > 0,
          )
          .map((h) => `${h.q},${h.r}`)
      : [],
  );
  // Tackle-risk hexes: orange when non-carrier's step would land adjacent to ball carrier
  const tackleRiskSet =
    phase !== 'REPLAY' ? new Set(tackleRiskHexes.map((h) => `${h.q},${h.r}`)) : new Set<string>();

  // SNAPSHOT_DEFLECT: orange-tint shot path from shooter position to declared target hex
  const snapDeflectPathSet = new Set<string>();
  if (phase === 'SNAPSHOT_DEFLECT' && shotTargetHex !== null && shotTargetHex !== undefined) {
    const shooter = ball.carrierId ? pieces.find((p) => p.id === ball.carrierId) : null;
    if (shooter) {
      for (const h of hexLine(shooter.position, shotTargetHex)) {
        snapDeflectPathSet.add(`${h.q},${h.r}`);
      }
    }
  }

  // Bug 1 fix: HIGH_PASS_MOVE — contest zone preview.
  // During repositioning, highlight the ball's landing hex (= pass target) plus all hexes
  // within 2 hexes of it with shot-path (white) tint. This shows players where the header
  // contest will take place before the accuracy roll resolves.
  const highPassContestZoneSet = new Set<string>();
  if (phase === 'HIGH_PASS_MOVE') {
    for (const h of PITCH_HEXES) {
      if (hexDistance(h, ball.position) <= 2) {
        highPassContestZoneSet.add(`${h.q},${h.r}`);
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

  // D-48 (Phase 17, rulebook-correction round): a pure, per-hex geometric placement-zone
  // check for FREE_KICK_SETUP — mirrors isInMyKickOffZone's "evaluated for every hex on
  // every render, regardless of selection" shape, fixing the prior isValidMove-gated
  // (selection-required) highlight. Returns true only during MY team's CURRENTLY-active
  // stage: unrestricted for the kicking team's stages (0/2, D-29); all pitch hexes except
  // the 2-hex zone around freeKickHex for the conceding team's stages (1/3, D-30).
  const isFreeKickSetup = phase === 'FREE_KICK_SETUP';
  // Plan 25-06: extract activeTeamForStage separately so the per-piece eligible-ring check
  // can reference it without recomputing freeKickStageTeam inside the hot render path.
  const activeTeamForStage =
    isFreeKickSetup &&
    freeKickStageIndex !== null &&
    freeKickStageIndex !== undefined &&
    !!freeKickAttackingTeam
      ? freeKickStageTeam(freeKickStageIndex, freeKickAttackingTeam)
      : null;
  const myFreeKickStageActive = isFreeKickSetup && myTeam !== null && myTeam === activeTeamForStage;
  const isMyFreeKickKickingStage = myFreeKickStageActive && myTeam === freeKickAttackingTeam;
  // Placement budget remaining for the current stage — used to suppress eligible rings
  // and selection when all slots are filled.
  const fkBudgetRemaining =
    isFreeKickSetup && freeKickStageIndex !== null && freeKickStageIndex !== undefined
      ? FREE_KICK_STAGES[freeKickStageIndex].max - (freeKickPlacedPieceIds ?? []).length
      : 0;

  const isInMyFreeKickZone = (hex: HexCoord): boolean => {
    if (!myFreeKickStageActive) return false;
    // Suppress during kicker-select: that step has its own white ball-hex highlight.
    if (freeKickKickerChosen === false) return false;
    // Suppress until a piece is selected — blue only shows for the selected piece's
    // valid destinations, and clears automatically when the move commits.
    if (selectedPieceId === null) return false;
    if (isMyFreeKickKickingStage || !freeKickHex) return true;
    // D-30: conceding team's stages must stay >2 hexes from freeKickHex.
    return hexDistance(hex, freeKickHex) > 2;
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

  // GK_QUICK_THROW: all pitch hexes within 11 hexes of the GK (no blocking, no interception)
  const quickThrowTargetSet = new Set<string>();
  if (phase === 'GK_QUICK_THROW' && isActivePlayer) {
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

            // Phase 10: shooting mode goal-line highlight (two-step Shoot flow + SNAPSHOT_TARGET snapshot target)
            // For snapshot (SNAPSHOT_TARGET), apply 6-hex range from carrier — same gate the server enforces.
            // For regular shot (shootingMode), apply the 11-hex range from the shooter (D-09 gap
            // closure plan 10) — mirrors the server's applyDeclareShot hexDistance > 11 gate.
            const snapCarrier =
              phase === 'SNAPSHOT_TARGET' && ball.carrierId
                ? pieces.find((p) => p.id === ball.carrierId)
                : null;
            const regularShooter = ball.carrierId
              ? pieces.find((p) => p.id === ball.carrierId)
              : null;
            const isShootingModeGoalHex =
              isActivePlayer &&
              goalLineHexSet.has(hexId) &&
              ((shootingMode &&
                regularShooter != null &&
                hexDistance(regularShooter.position, hex) <= 11) ||
                (phase === 'SNAPSHOT_TARGET' &&
                  snapCarrier !== undefined &&
                  snapCarrier !== null &&
                  hexDistance(snapCarrier.position, hex) <= 6));

            // SNAPSHOT_DEFLECT: shot path — shot line from shooter to declared target.
            // BUGFIX (snapshot-shot-flow-mismatch): now rendered with the same white
            // 'shot-path' tint as regular/headed shots (see isShotPathTint below) instead
            // of the orange 'risk' tint it previously shared with ZoI/tackle danger hexes.
            const isShotPath = snapDeflectPathSet.has(hexId);
            // GK team = defending team during a shot
            const gkTeamForDive: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
            const isGKTeamPlayer = myTeam === gkTeamForDive;
            // Phase 10: GK dive target — gated on isGKTeamPlayer so only the GK's side sees highlights
            const isGKDiveTarget =
              phase === 'GK_DIVE' && gkDiveTargetSet.has(hexId) && isGKTeamPlayer;

            // Phase 10: HEADER target hex selection step — range from winner's position (≤6 hexes)
            const headerDist = headerTargetStep
              ? hexDistance(hex, headerWinnerPiece?.position ?? ball.position)
              : Infinity;
            const isHeaderTargetGoalHex =
              headerTargetStep && goalLineHexSet.has(hexId) && headerDist <= 6;
            const isHeaderNonGoalTarget =
              headerTargetStep && !goalLineHexSet.has(hexId) && headerDist <= 6;

            // Bug 2 fix: HIGH_PASS_MOVE and GK_KICK_MOVE valid move hexes now use yellow
            // (safe) tint, same as normal movement. SNAPSHOT_DEFLECT keeps the white shot-path tint
            // (defender moving to intercept a snapshot = different UX context).
            // D-28: GK_DIVE highlights already cleared by setGameState — still suppressed here.
            // headerTargetStep excluded: white action overlay in HexGrid handles header pass tinting.
            const isHighlighted =
              isShootingModeGoalHex ||
              isHeaderTargetGoalHex ||
              isHeaderNonGoalTarget ||
              (phase !== 'GK_DIVE' &&
                phase !== 'SNAPSHOT_DEFLECT' &&
                !headerTargetStep &&
                isValidMove) ||
              isGoalHex ||
              isShotTarget;
            const isHpMoveTarget =
              (phase === 'SNAPSHOT_DEFLECT' && selectedPieceId !== null && isValidMove) ||
              isGKDiveTarget;

            // Header pass is unblockable — declared here so both isInterceptionRisk and isRisk can use it.
            const isHeaderPass = phase === 'PASS' && lastActionType === 'HEADER';

            // Phase 8.2 D-06/D-09: pass target classification (KICK_OFF uses same three-step flow)
            const isPassTarget =
              (phase === 'PASS' || phase === 'KICK_OFF') &&
              selectedPassType !== null &&
              validPassTargetHexSet.has(hexId);
            const isInterceptionRisk =
              isPassTarget && !isHeaderPass && interceptionRiskSet.has(hexId);
            const isConfirmedPassTarget =
              passTargetHex !== null && hex.q === passTargetHex.q && hex.r === passTargetHex.r;

            // KICK_OFF_SETUP zone — must be computed before highlightType derivation below
            const inMyZone = isKickOffSetup ? isInMyKickOffZone(hex) : false;
            const isCentreHex =
              isKickOffSetup &&
              hex.q === PITCH_REGIONS.kickOffHex.q &&
              hex.r === PITCH_REGIONS.kickOffHex.r;

            // Plan 04 D-12: priority-resolve highlightType (risk > goal > shot-path > kickoff > safe)
            // isRisk: ZoI steal-risk OR tackle-risk movement (orange).
            // BUGFIX (snapshot-shot-flow-mismatch): snapshot's shot path (isShotPath) was
            // previously folded into isRisk (orange "danger" tint), making it visually
            // inconsistent with the regular/headed shot path (white 'shot-path' tint via
            // lastShotPathSet below). Snapshot path now joins isShotPathTint instead so all
            // shot-path highlights render the same color regardless of shot type.
            const isRisk =
              !isHeaderPass &&
              !headerTargetStep &&
              ((zoiRiskSet.has(hexId) && isValidMove) || (tackleRiskSet.has(hexId) && isValidMove));
            const isGoalTint =
              isGoalHex || isShotTarget || isShootingModeGoalHex || isHeaderTargetGoalHex;
            // isShotPathActionTint: actionable white hexes — GK dive options and header contest zone
            // hexes the moving player can actually step into (darker/less transparent white).
            const isShotPathActionTint =
              isGKDiveTarget || (highPassContestZoneSet.has(hexId) && isValidMove);
            // isShotPathTint: informational white — resolved shot path, contest zone preview,
            // SNAP_DEFLECT reposition targets, and the snapshot's declared shot path (lighter/
            // more transparent white) — same classification as a regular/headed shot path.
            // BUG-23 (D-14 Fix 1): gate the ENTIRE expression on phase !== 'KICK_OFF_SETUP' so
            // none of the five sub-conditions can produce a stale tint during kick-off setup.
            const isShotPathTint =
              phase !== 'KICK_OFF_SETUP' &&
              !headerTargetStep &&
              (lastShotPathSet.has(hexId) ||
                isHpMoveTarget ||
                isGKDiveTarget ||
                isShotPath ||
                highPassContestZoneSet.has(hexId));
            // isKickoffTint: own-team valid zone during KICK_OFF_SETUP (excluding centre hex),
            // OR the D-48 persistent geometric placement zone during FREE_KICK_SETUP — visible
            // for every pitch hex on every render during MY team's active stage, regardless of
            // whether a piece is currently selected (corrects the prior D-45 fix, which was
            // gated on isValidMove/validMoveHexes and thus invisible until a piece was clicked).
            const isKickoffTint = (inMyZone && !isCentreHex) || isInMyFreeKickZone(hex);
            // Kicker-select target: ball hex shows white when a piece is selected during
            // the kicker-select sub-step, giving a clear single destination to click.
            const isKickerTargetTint =
              freeKickKickerChosen === false &&
              selectedPieceId !== null &&
              freeKickHex !== null &&
              freeKickHex !== undefined &&
              hex.q === freeKickHex.q &&
              hex.r === freeKickHex.r;
            // isSafeTint: normal valid-move hexes not classified as goal-line
            const isSafeTint = isHighlighted && !isGoalTint;
            const highlightType: HexHighlightType | undefined = isHeaderNonGoalTarget
              ? 'header-target'
              : isRisk
                ? 'risk'
                : isGoalTint
                  ? 'goal'
                  : isShotPathActionTint
                    ? 'shot-path-action'
                    : isShotPathTint
                      ? 'shot-path'
                      : isKickerTargetTint
                        ? 'shot-path'
                        : isKickoffTint
                          ? 'kickoff'
                          : isSafeTint
                            ? 'safe'
                            : undefined;

            let onClick: (() => void) | undefined;
            // DESIGN-02: REPLAY is never interactive — skip the entire phase-branch cascade so
            // onClick stays undefined for every hex during post-game replay playback.
            if (phase !== 'REPLAY') {
              if (phase === 'KICK_OFF_SETUP') {
                // KICK_OFF_SETUP: clicking a valid zone hex while a piece is selected → emitKickOffMove (T-08-19)
                if (isValidMove && selectedPieceId) {
                  onClick = () => emitKickOffMove(selectedPieceId, hex);
                }
                // Clicking any other hex during setup is a no-op — handled by the piece's own onClick below
              } else if (phase === 'FREE_KICK_SETUP') {
                // OFFSIDE-02 (D-49 staged rework): clicking a valid hex while a piece is selected
                // → emitFreeKickMove. validMoveHexes (computed in useGameStore.selectPiece) is
                // already turn-gated to the CURRENTLY-active stage's team and zone rules — the
                // click-to-move interaction itself is unchanged from the prior model.
                if (isValidMove && selectedPieceId) {
                  onClick = () => emitFreeKickMove(selectedPieceId, hex);
                }
              } else if (phase === 'GK_DIVE' && isGKDiveTarget && isGKTeamPlayer) {
                // Phase 10: GK team clicks a valid dive hex during GK_DIVE
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
              } else if (
                phase === 'GK_KICK_TARGET' &&
                isActivePlayer &&
                gkKickTargetSet.has(hexId)
              ) {
                onClick = () => emitGKKickTarget(hex);
              } else if (
                phase === 'GK_QUICK_THROW' &&
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
            }

            const { cx, cy } = axialToPixel(hex.q, hex.r);
            const points = hexPolygonPoints(cx, cy);

            return (
              <g key={hexId}>
                <HexCell
                  hex={hex}
                  {...(highlightType !== undefined ? { highlightType } : {})}
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
            // During GK_DIVE, visually show the defending GK at their current dive position.
            // gk.position in state.pieces is the original position (used for cumulative distance check);
            // gkDivePosition tracks where they actually are on screen.
            const gkDiveTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
            const displayPiece =
              phase === 'GK_DIVE' &&
              gkDivePosition != null &&
              piece.role === 'GK' &&
              piece.teamId === gkDiveTeam
                ? { ...piece, position: gkDivePosition }
                : piece;

            // Phase 20 D-16: resolve uniform style + palette from TEAM_CONFIGS per piece.
            // Uses displayPiece.teamId (the rendered piece) so GK_DIVE visual position matches.
            const resolvedTeamId = selectedTeams[displayPiece.teamId];
            const teamConfig = TEAM_CONFIGS[resolvedTeamId];
            // Phase 22 D-18: resolve uniformStyle from GameState.selectedUniformStyles
            const resolvedUniformStyle = selectedUniformStyles[displayPiece.teamId];
            // Jersey swap: PieceOverlay uses palette.homePrime for home outfield and palette.awayPrime
            // for away outfield. When a team wears the non-default kit (home wearing away, or away
            // wearing home), swap the home↔away halves so PieceOverlay picks the right colors.
            const teamJerseyType =
              selectedJerseyTypes?.[displayPiece.teamId] ?? displayPiece.teamId;
            const rawPalette = teamConfig.palette;
            const resolvedPalette =
              teamJerseyType !== displayPiece.teamId
                ? {
                    ...rawPalette,
                    homePrime: rawPalette.awayPrime,
                    homeAlt: rawPalette.awayAlt,
                    homeFont: rawPalette.awayFont,
                    awayPrime: rawPalette.homePrime,
                    awayAlt: rawPalette.homeAlt,
                    awayFont: rawPalette.homeFont,
                  }
                : rawPalette;

            // Slot quota: how many activations remain in this slot
            const slotQuota =
              movementSlot === 'ATTACKER_4' ? 4 : movementSlot === 'DEFENDER_5' ? 5 : 2;
            const activatedCount = Object.keys(paceUsedByPieceId).length;
            const pieceAlreadyActivated = (paceUsedByPieceId[piece.id] ?? 0) > 0;
            const slotFull = activatedCount >= slotQuota && !pieceAlreadyActivated;

            const canSelect =
              isActivePlayer &&
              phase === 'MOVE' &&
              piece.teamId === activeTeam &&
              !movedPieceIds.includes(piece.id) && // already moved this phase
              !slotFull; // slot quota exhausted
            // KICK_OFF_SETUP: both teams reposition their own pieces; opponent pieces are no-ops (T-08-19)
            const canSelectKickOff = isKickOffSetup && myTeam !== null && piece.teamId === myTeam;
            // OFFSIDE-02 (D-49 staged rework): only the CURRENTLY-active stage's team may
            // select a piece — mirrors canSelectKickOff but additionally gated on
            // myFreeKickStageActive (the inactive team sees no selectable pieces at all,
            // since it isn't their turn). Zone-restriction enforcement stays server-side
            // at stage-end (applyFreeKickReady) — this is selection gating only.
            const canSelectFreeKick =
              myFreeKickStageActive &&
              fkBudgetRemaining > 0 &&
              myTeam !== null &&
              piece.teamId === myTeam &&
              !movedPieceIds.includes(piece.id) &&
              !(freeKickPlacedPieceIds ?? []).includes(piece.id);
            // HIGH_PASS_MOVE: active team selects 1 own piece to reposition up to 3 hexes
            const canSelectHighPassMove =
              phase === 'HIGH_PASS_MOVE' &&
              isActivePlayer &&
              myTeam !== null &&
              piece.teamId === myTeam &&
              (highPassMovedPieceId === null || highPassMovedPieceId === piece.id);
            // SNAPSHOT_DEFLECT: defending team selects 1 own piece to move up to 2 hexes
            const snapDefendingTeam: 'home' | 'away' = attackingTeam === 'home' ? 'away' : 'home';
            const canSelectSnapDeflect =
              phase === 'SNAPSHOT_DEFLECT' &&
              myTeam !== null &&
              myTeam === snapDefendingTeam &&
              piece.teamId === myTeam &&
              (snapDeflectMovedPieceId === null || snapDeflectMovedPieceId === piece.id) &&
              (snapDeflectPaceUsed ?? 0) < 2; // RULE-04 D-09: suppress when pace exhausted
            // GK_KICK_MOVE: active team selects 1 own piece to reposition up to 3 hexes
            const canSelectGKKickMove =
              phase === 'GK_KICK_MOVE' &&
              isActivePlayer &&
              myTeam !== null &&
              piece.teamId === myTeam &&
              (gkKickMovedPieceId === null || gkKickMovedPieceId === piece.id);
            // FIRST_TIME_PASS_MOVE: active team selects 1 own piece to reposition up to 1 hex
            // (CR-01-new; mirrors canSelectHighPassMove)
            const canSelectFirstTimePassMove =
              phase === 'FIRST_TIME_PASS_MOVE' &&
              isActivePlayer &&
              myTeam !== null &&
              piece.teamId === myTeam &&
              (firstTimePassMovedPieceId === null || firstTimePassMovedPieceId === piece.id);
            // FREE_MOVE_ATTACK/DEFENSE (Phase 17 MOVE-06, client-wiring fix): any number of
            // precomputed-eligible pieces of the active sub-phase's side may each move up to
            // 6 hexes independently — no single-piece lock like HIGH_PASS_MOVE.
            const freeMoveSide =
              phase === 'FREE_MOVE_ATTACK'
                ? 'attack'
                : phase === 'FREE_MOVE_DEFENSE'
                  ? 'defense'
                  : null;
            const canSelectFreeMove =
              freeMoveSide !== null &&
              isActivePlayer &&
              myTeam !== null &&
              piece.teamId === myTeam &&
              (freeMoveEligibleIds?.[freeMoveSide]?.includes(piece.id) ?? false) &&
              (freeMoveUsedPace?.[piece.id] ?? 0) < 6 &&
              !movedPieceIds.includes(piece.id); // already activated this sub-phase (UX-parity fix)

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
            // GK_QUICK_THROW: clicking a piece on a valid target hex emits throw to that hex (not selectPiece)
            const isQuickThrowTargetPiece =
              phase === 'GK_QUICK_THROW' && isActivePlayer && quickThrowTargetSet.has(pieceHexId);
            // HEADER target step: pieces in range are clickable targets. Pieces are in a
            // separate SVG layer from hexes so click events don't bubble from piece to hex —
            // this handler bridges the gap so clicking a piece emits the target directly.
            const pieceHeaderDist = headerTargetStep
              ? hexDistance(piece.position, headerWinnerPiece?.position ?? ball.position)
              : Infinity;
            const isPieceAtHeaderTarget = headerTargetStep && pieceHeaderDist <= 6;

            // DESIGN-02: force false during REPLAY — no piece ever registers a click affordance
            // during post-game replay playback, regardless of what the underlying booleans above
            // would otherwise compute.
            const isClickable =
              phase !== 'REPLAY' &&
              (isPassTargetPiece ||
                isQuickThrowTargetPiece ||
                isPieceAtHeaderTarget ||
                canSelect ||
                canSelectKickOff ||
                canSelectFreeKick ||
                isHeaderEligible ||
                canSelectHighPassMove ||
                canSelectSnapDeflect ||
                canSelectGKKickMove ||
                canSelectFirstTimePassMove ||
                canSelectFreeMove);

            // Plan 04: derive single selectionState enum for PieceOverlay (UX-05, D-04, D-07)
            const isSpentNow =
              phase === 'HIGH_PASS_MOVE'
                ? piece.id === highPassMovedPieceId && (highPassPaceUsed ?? 0) >= 3
                : phase === 'MOVE'
                  ? movedPieceIds.includes(piece.id) ||
                    (paceUsedByPieceId[piece.id] ?? 0) >=
                      (movementSlot === 'ATTACKER_2' ? Math.min(piece.pace, 2) : piece.pace)
                  : phase === 'FREE_KICK_SETUP'
                    ? movedPieceIds.includes(piece.id) ||
                      (freeKickPlacedPieceIds ?? []).includes(piece.id)
                    : movedPieceIds.includes(piece.id);
            // Eligible ring: piece can still be selected for placement this stage.
            // Gated on budget remaining — hides ring once all stage slots are filled.
            const isFreeKickEligible =
              phase === 'FREE_KICK_SETUP' &&
              myFreeKickStageActive &&
              fkBudgetRemaining > 0 &&
              piece.teamId === activeTeamForStage &&
              !movedPieceIds.includes(piece.id) &&
              !(freeKickPlacedPieceIds ?? []).includes(piece.id);
            // Bug 3 fix: isHeaderContestant (confirmed contestant) → 'active' (green ring);
            // isHeaderEligible but not yet contestant → 'selectable' (blue ring).
            // In HEADER phase, selectedPieceId is set by inspectPiece clicks but should NOT
            // produce a green ring — only confirmed contestants get 'active' there.
            // FREE_KICK_SETUP: use isFreeKickEligible for the ring (not the broader isClickable
            // which would incorrectly include locked/placed/kicker-select-phase pieces).
            const selectionState: SelectionState = isSpentNow
              ? 'activated'
              : (phase !== 'HEADER' && piece.id === selectedPieceId) || isHeaderContestant
                ? 'active'
                : isFreeKickEligible ||
                    isHeaderEligible ||
                    (isClickable && phase !== 'FREE_KICK_SETUP')
                  ? 'selectable'
                  : 'none';

            const handleClick = isPieceAtHeaderTarget
              ? () => emitHeaderTarget(piece.position)
              : isQuickThrowTargetPiece
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
                        : canSelectFirstTimePassMove
                          ? () => selectPiece(piece.id)
                          : canSelectFreeMove
                            ? () => selectPiece(piece.id)
                            : isHeaderEligible
                              ? () => {
                                  toggleHeaderContestantId(piece.id);
                                }
                              : canSelectKickOff
                                ? () => selectPiece(piece.id)
                                : canSelectFreeKick
                                  ? () => selectPiece(piece.id)
                                  : canSelect
                                    ? () => selectPiece(piece.id)
                                    : // BUG-10: clicking an already-moved own-team piece in MOVE opens its
                                      // player card via inspectPiece — same as unmoved pieces — but does NOT
                                      // re-trigger move-target highlighting (canSelect already excludes moved
                                      // pieces so selectPiece is never called here).
                                      phase === 'MOVE' &&
                                        myTeam !== null &&
                                        piece.teamId === myTeam &&
                                        movedPieceIds.includes(piece.id)
                                      ? () => inspectPiece(piece.id)
                                      : // BUG-26: clicking an opponent's activated (already-moved)
                                        // piece opens its stats panel via inspectPiece. The
                                        // canSelect guard above already excludes opponent pieces
                                        // from selectPiece, so no erroneous selection occurs.
                                        // No piece.teamId === myTeam constraint is needed here —
                                        // this branch fires only after canSelect is false.
                                        movedPieceIds.includes(piece.id)
                                        ? () => inspectPiece(piece.id)
                                        : () => undefined;

            return (
              <PieceOverlay
                key={piece.id}
                piece={displayPiece}
                uniformStyle={resolvedUniformStyle}
                palette={resolvedPalette}
                selectionState={selectionState}
                onClick={handleClick}
                onInspect={() => inspectPiece(piece.id)}
                carrierId={ball.carrierId}
                attackingTeam={attackingTeam}
                isOffside={(offsidePieceIds ?? []).includes(piece.id)}
                // D-55: green "moved this stage" ring — only during FREE_KICK_SETUP,
                // for a piece already counted in this stage's freeKickPlacedPieceIds.
                isMovedThisStage={false}
              />
            );
          })}
        </g>
      </g>
    </svg>
  );
}
