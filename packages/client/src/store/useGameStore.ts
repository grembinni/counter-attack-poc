import { create } from 'zustand';
import type { GameState, HexCoord } from '@counter-attack/shared';
import {
  validateMove,
  hexesInRange,
  ClientEvents,
  PITCH_HEXES,
  PITCH_REGIONS,
  isInRegion,
  validatePass,
  hexLine,
  hexDistance,
  getZoIDefenders,
  freeKickStageTeam,
  cornerKickStageTeam,
  ELIGIBLE_NEXT_ACTIONS,
  isWithinCornerExclusionZone,
  computeGkDiveAtFeetTargetHexes,
  isActivePiece,
} from '@counter-attack/shared';
import { mockMovementState } from '../mock/index.js';
import { socket } from '../socket.js';
import { deriveMyTeam } from '../hooks/useMyTeam.js';

/** Pass type used for store and ActionPanel three-step flow (matches server event signature). */
export type PassType = 'STANDARD_PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_BALL';

/**
 * THROWIN-04 (Phase 37): a throw-in travels at most 6 hexes, regardless of Low/High type.
 * Mirrors the identical constant in packages/server/src/gameHandlers.ts — the server remains
 * authoritative; this only shrinks the client's highlight set to match.
 */
const THROW_IN_MAX_DISTANCE = 6;

/** Screen states for client-side routing (D-12). No React Router — screen field in store.
 * Module-internal only — no other file imports this type directly (components read
 * `screen` values via the store selector, which carries the literal type through). */
type Screen =
  | 'LANDING'
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'WAITING'
  | 'GAME_SETTINGS' // Phase 27: host-only pre-team-selection settings screen (DRAFT-01, D-01)
  | 'TEAM_SELECTION' // Phase 16 D-10: team selection screen before game board
  | 'UNIFORM_SELECTION' // Phase 22: combined team + style pre-game screen (D-01)
  | 'LINEUP_ASSIGNMENT' // Phase 24: standalone lineup assignment screen (D-13)
  | 'GAME_BOARD'
  | 'REPLAY'; // Phase 8: shown when GameState.phase === 'REPLAY' (uses GAME_BOARD layout)

/** Zustand store shape for the Counter Attack game client. */
export type GameStore = {
  gameState: GameState;
  screen: Screen;
  selectedPieceId: string | null;
  validMoveHexes: HexCoord[];
  /** Hexes where moving the selected piece would trigger a tackle attempt (adjacent to ball carrier). */
  tackleRiskHexes: HexCoord[];
  /** Tracks the piece ID emitted in the most recent move — survives emitMove's optimistic clear so
   *  setGameState can restore selection when the server broadcast arrives (D-17). */
  lastMovedPieceId: string | null;
  /** Phase 7: which slot this client occupies (server-assigned in room:joined, D-04). Display-only — never emitted. */
  playerSlot: 1 | 2 | null;
  /** Phase 7: current room code (set from room:joined, D-04). */
  roomCode: string | null;
  /** Phase 7: true while opponent is in the 90-second reconnect grace period (D-13). */
  disconnectWarning: boolean;
  /** Phase 7: last room error from server (e.g. 'NOT_FOUND'). */
  roomError: string | null;
  /** Phase 7: last game error from server (e.g. 'WRONG_PHASE'). */
  gameError: string | null;
  /** Phase 8.2 D-06/D-07: valid target hexes for the selected pass type (safe, no interception risk). */
  validPassTargetHexes: HexCoord[];
  /** Phase 8.2 D-09: target hexes with interception risk (amber highlight). */
  interceptionRiskHexes: HexCoord[];
  /** Phase 8.2 D-06: confirmed pass target hex (set when player clicks a valid target). */
  passTargetHex: HexCoord | null;
  /** Phase 8.2 D-06: currently selected pass type driving the target highlights. */
  selectedPassType: PassType | null;
  /** Phase 8.2 D-17: IDs of pieces this client has selected as header contestants (multiple allowed). */
  headerContestantIds: string[];
  /** Phase 10: true when shooter has clicked "Shoot" and is selecting a goal hex. */
  shootingMode: boolean;
  /** Navigate to a different screen (D-12). */
  setScreen: (s: Screen) => void;
  /**
   * Phase 8.2 D-06/D-07/D-09: Select a pass type and compute valid target hexes.
   * Iterates PITCH_HEXES via validatePass, splits results into safe (green) + interception-risk (amber).
   * Passing null clears the selection.
   */
  setSelectedPassType: (passType: PassType | null) => void;
  /** Phase 8.2 D-06: Confirm or deselect a pass target hex. */
  setPassTargetHex: (hex: HexCoord | null) => void;
  /**
   * Phase 8.2 D-06: Confirm a pass target from HexGrid click.
   * STANDARD/FIRST_TIME: auto-emits GAME_ROLL immediately (no accuracy check, interception resolved by server).
   * HIGH/LONG_BALL: sets passTargetHex so ActionPanel step 3 shows Roll Dice.
   */
  confirmPassTarget: (hex: HexCoord) => void;
  /** Phase 8.2 D-17: Emit confirmed contestant array to server (send current headerContestantIds or empty = decline). */
  emitHeaderContestant: (pieceIds: string[]) => void;
  /** Phase 8.2 D-17: Toggle a piece in/out of the local headerContestantIds array. */
  toggleHeaderContestantId: (id: string) => void;
  /**
   * Select or deselect a piece. Toggles off if already selected (D-07).
   * Computes valid move destinations via hexesInRange + validateMove (client-side, D-07).
   * Uses hexesInRange(piece.position, piece.pace) to limit candidates — never iterates all 962 PITCH_HEXES.
   */
  selectPiece: (id: string) => void;
  /**
   * Inspect a piece for stats display only — sets selectedPieceId without computing valid moves (D-06).
   * Used by onInspect for non-active players and opponent pieces so no movement highlights appear.
   */
  inspectPiece: (id: string) => void;
  /** Phase 7: Replace gameState wholesale from server broadcast (ARCH-04 full-snapshot). */
  setGameState: (state: GameState) => void;
  /** Phase 7: Set the player slot assigned by the server (D-04). */
  setPlayerSlot: (slot: 1 | 2) => void;
  /** Phase 7: Set the room code assigned by the server (D-04). */
  setRoomCode: (code: string) => void;
  /** Phase 7: Set/clear the opponent disconnect warning banner (D-13). */
  setDisconnectWarning: (v: boolean) => void;
  /** Phase 7: Set/clear the room error message. */
  setRoomError: (msg: string | null) => void;
  /** Phase 7: Set/clear the game error message. */
  setGameError: (msg: string | null) => void;
  /** Reset lobby-related state when navigating back to the landing screen. */
  resetLobby: () => void;
  /**
   * Emit game:move to the server and clear local selection (D-08, RESEARCH Pitfall 4).
   * Uses POSITIONAL args (pieceId, to) — matches ClientToServerEvents[GAME_MOVE] signature.
   * Replaces the removed movePiece local-mutation action.
   */
  emitMove: (pieceId: string, to: HexCoord) => void;
  /**
   * Emit game:roll to the server.
   * Pass phase uses passType (D-10): also sends targetHex for High/Long pass accuracy resolution.
   */
  emitRoll: (passType?: PassType, targetHex?: HexCoord) => void;
  /** Emit game:end-turn to end the current movement phase. */
  emitEndTurn: () => void;
  /** Emit game:undo to request an undo of the last movement action (UNDO-01). */
  emitUndo: () => void;
  /** BUG-02 (Phase 17 D-03/D-04): cancel MOVEMENT phase before any piece has moved, reverting to PASS. */
  emitCancelMovement: () => void;
  /** Emit game:gk-restart with the GK's choice after a save catch (D-22, Phase 5). */
  emitGKRestart: (choice: 'kick' | 'throw' | 'movement') => void;
  /** Emit game:start-movement to transition from KICK_OFF to MOVEMENT (D-01, Phase 4). */
  emitStartMovement: () => void;
  /** Phase 8 / D-24: Emit game:ready — KICK_OFF_SETUP confirmation. */
  emitReady: () => void;
  /** Phase 8: Emit game:kick-off-move — reposition a piece during KICK_OFF_SETUP (no pace limits). */
  emitKickOffMove: (pieceId: string, to: HexCoord) => void;
  /** Phase 8 / D-28: Emit game:half-time-start — trigger 2nd half (only for non-first-half kick-off team). */
  emitHalfTimeStart: () => void;
  /** Phase 8 / D-18: Emit game:snapshot — declare a Snapshot shot while in penalty area or post-pass. */
  emitSnapshot: () => void;
  /** Restart the movement phase from ATTACKER_4 — resets movedPieceIds and pace tracking. */
  emitRestartMovement: () => void;
  /** Phase 10: Emit game:shot (shot declaration) with the selected goal hex. Reuses GAME_SHOT event. */
  emitDeclareShot: (goalHex: HexCoord) => void;
  /** Phase 10: Emit game:gk-dive — GK repositions during GK_DIVING phase. */
  emitGKDive: (to: HexCoord) => void;
  /** Phase 10: Emit game:header-target — attacker selects target hex during HEADER phase (HEAD-03). */
  emitHeaderTarget: (targetHex: HexCoord) => void;
  /** Phase 10: Enable/disable shooting mode (step 1 of two-step Shoot flow). */
  setShootingMode: (on: boolean) => void;
  /** GK quick throw: emit target hex to server (unblocked, uninterceptable delivery). */
  emitQuickThrow: (targetHex: HexCoord) => void;
  /** GK kick: emit chosen target hex to server (GK_KICK_TARGET phase). */
  emitGKKickTarget: (targetHex: HexCoord) => void;
  /**
   * RULE-01 (Phase 11): attacker acknowledges the high-pass accuracy roll result.
   * Emits GAME_HEADER_ACCURACY_ACK (zero arguments). No-op if socket not connected.
   */
  emitHeaderAccuracyAck: () => void;
  /**
   * OFFSIDE-02 (Phase 17 D-29): reposition a piece during FREE_KICK_SETUP
   * (no pace limits, no ZoI — mirrors emitKickOffMove).
   */
  emitFreeKickMove: (pieceId: string, to: HexCoord) => void;
  /** OFFSIDE-02 (Phase 17 D-29): emit game:free-kick-ready — FREE_KICK_SETUP confirmation. */
  emitFreeKickReady: () => void;
  /** THROWIN-02 (Phase 37): emit game:throw-in-place — pieceId-only, destination is server-owned throwInHex. */
  emitThrowInPlace: (pieceId: string) => void;
  /** GOALKICK-03 (Phase 37): mirrors emitGKRestart's choice-payload shape. */
  emitGoalKickChoice: (choice: 'kick' | 'standard') => void;
  /** GOALKICK-05 (Phase 37): mirrors emitGKKickTarget. */
  emitGoalKickTarget: (targetHex: HexCoord) => void;
  /**
   * CORNER-01 (Phase 38): one-shot GK placement during either corner-kick GK reposition
   * window. Mirrors emitFreeKickMove (two arguments, clears selectedPieceId after emitting)
   * since the placement is one-shot, not a multi-click budgeted reposition.
   */
  emitCornerKickGkPlace: (pieceId: string, to: HexCoord) => void;
  /**
   * CORNER-02 (Phase 38): mirrors emitThrowInPlace exactly — a single pieceId argument, since
   * the destination (cornerKickHex) is server-owned and never client-chosen.
   */
  emitCornerKickTaker: (pieceId: string) => void;
  /** FOUL-03 (Phase 39 / D-01): attacker's continue-play-or-restart choice after a foul. */
  emitFoulChoice: (choice: 'continue' | 'restart') => void;
  /** GKDIVE-02 (Phase 39 / D-07): defending manager's accept/decline response to a dive-at-feet prompt. */
  emitGkDiveAtFeet: (accept: boolean) => void;
  /** GKDIVE-02/GKDIVE-04 (39-UAT gap 3, Plan 39-21): defending manager's chosen dive-destination
   *  hex during GK_DIVE_AT_FEET_TARGET. */
  emitGkDiveAtFeetTarget: (to: HexCoord) => void;
  /** D-10 (Phase 39): defending manager's accept/decline response to a box-entry GK reposition prompt. */
  emitGkBoxEntryResponse: (accept: boolean) => void;
  /** D-10 (Phase 39): GK's one-hex destination during GK_BOX_ENTRY_MOVE. */
  emitGkBoxEntryMove: (to: HexCoord) => void;
  /** PEN-02 (Phase 39): attacking manager's penalty-taker selection during PENALTY_KICK_TAKER_SELECT. */
  emitPenaltyKickTaker: (pieceId: string) => void;
  /**
   * SUB-02 (Phase 40): manager's 1-for-1 substitution intent (bench player in for an on-pitch
   * player). Fire-and-forget: no optimistic mutation of gameState, because the server's
   * full-snapshot broadcast is the only source of truth for roster state.
   */
  emitSubstitution: (outPieceId: string, inPlayerId: string) => void;
  /**
   * SUB-08 (Phase 42): manager's mid-match roster reposition intent (swap two on-pitch
   * pieces' slots). Fire-and-forget: no optimistic mutation of gameState, mirroring SUB-02 —
   * a reposition happens inside a modal and must not disturb pitch selection state
   * (selectedPieceId/validMoveHexes are deliberately left untouched).
   */
  emitRosterReposition: (pieceIdA: string, pieceIdB: string) => void;
};

/**
 * Plain-MOVEMENT valid-hex + tackle-risk derivation (Cluster 5, Phase 18.2 DESIGN-03).
 * Shared by selectPiece's normal MOVEMENT branch and setGameState's generic sticky
 * fallthrough — the two call sites were byte-for-byte identical (hexesInRange(.,1) →
 * validateMove per candidate → split ok hexes from TACKLE_ATTEMPT-effect hexes).
 */
function computeMovementValidHexes(
  piece: GameState['pieces'][number],
  gameState: GameState,
): { validMoveHexes: HexCoord[]; tackleRiskHexes: HexCoord[] } {
  const candidates = hexesInRange(piece.position, 1);
  const results = candidates.map((hex) => ({
    hex,
    result: validateMove(gameState, piece, hex),
  }));
  const validMoveHexes = results.filter(({ result }) => result.ok).map(({ hex }) => hex);
  const tackleRiskHexes = results
    .filter(
      ({ result }) => result.ok && 'effect' in result && result.effect.type === 'TACKLE_ATTEMPT',
    )
    .map(({ hex }) => hex);
  return { validMoveHexes, tackleRiskHexes };
}

/**
 * Per-phase field-name configuration for {@link computeResponseMoveValidHexes}
 * (Cluster 3, Phase 18.2 DESIGN-03). Mirrors the server's ResponseMoveConfig shape
 * (gameHandlers.ts validateResponseMoveStep) so the two consolidations stay parallel.
 */
type ResponseMoveValidHexConfig = {
  /** GameState field tracking the single piece locked to this phase's movement slot. */
  lockedPieceIdField:
    | 'highPassMovedPieceId'
    | 'gkKickMovedPieceId'
    | 'firstTimePassMovedPieceId'
    | 'snapDeflectMovedPieceId'
    | 'goalKickMovedPieceId'
    | 'cornerKickMovedPieceId';
  /** GameState field tracking cumulative hexes moved this slot. */
  paceUsedField:
    | 'highPassPaceUsed'
    | 'gkKickPaceUsed'
    | 'firstTimePassPaceUsed'
    | 'snapDeflectPaceUsed'
    | 'goalKickPaceUsed'
    | 'cornerKickPaceUsed';
  /** Maximum hexes (pace) allowed this slot. */
  paceCap: number;
  /**
   * 'strict-1': only adjacent hexes are valid (HIGH_PASS_MOVE, GK_KICK_MOVE, FIRST_TIME_PASS_MOVE).
   * 'range': any hex within the remaining pace budget is a valid single-click destination (SNAPSHOT_DEFLECT).
   */
  clickDistanceMode: 'strict-1' | 'range';
};

/**
 * Named per-phase configs for {@link computeResponseMoveValidHexes} (SELECTOR-REVIEW.md
 * fix #2, Phase 32-05 CLEANUP-03/D-06). Previously each selectPiece branch (and the
 * SNAPSHOT_DEFLECT sticky block) constructed an equivalent object literal inline at its own
 * call site — hoisting them to named constants lets setGameState's sticky-selection block
 * reuse the exact same config selectPiece uses per phase, eliminating the need to hand-roll
 * an equivalent computation a second time (see fix #2's inline duplication finding).
 */
const HIGH_PASS_MOVE_CONFIG: ResponseMoveValidHexConfig = {
  lockedPieceIdField: 'highPassMovedPieceId',
  paceUsedField: 'highPassPaceUsed',
  paceCap: 3,
  clickDistanceMode: 'strict-1',
};
const GK_KICK_MOVE_CONFIG: ResponseMoveValidHexConfig = {
  lockedPieceIdField: 'gkKickMovedPieceId',
  paceUsedField: 'gkKickPaceUsed',
  paceCap: 3,
  clickDistanceMode: 'strict-1',
};
const FIRST_TIME_PASS_MOVE_CONFIG: ResponseMoveValidHexConfig = {
  lockedPieceIdField: 'firstTimePassMovedPieceId',
  paceUsedField: 'firstTimePassPaceUsed',
  paceCap: 1,
  clickDistanceMode: 'strict-1',
};
const SNAPSHOT_DEFLECT_CONFIG: ResponseMoveValidHexConfig = {
  lockedPieceIdField: 'snapDeflectMovedPieceId',
  paceUsedField: 'snapDeflectPaceUsed',
  paceCap: 2,
  clickDistanceMode: 'range',
};
/**
 * GOALKICK-05 (Phase 37): the 3-hex travel window while the goal kick is in the air —
 * byte-for-byte the GK_KICK_MOVE_CONFIG shape with the goal-kick field names, matching
 * the server's validateResponseMoveStep config from Plan 37-09 so client highlights and
 * server legality cannot drift.
 */
const GOAL_KICK_MOVE_CONFIG: ResponseMoveValidHexConfig = {
  lockedPieceIdField: 'goalKickMovedPieceId',
  paceUsedField: 'goalKickPaceUsed',
  paceCap: 3,
  clickDistanceMode: 'strict-1',
};
/**
 * CORNER-06 (Phase 38): the 3-hex pre-kick travel window while the corner kick is being
 * taken — byte-for-byte the GOAL_KICK_MOVE_CONFIG shape with the corner-kick field names,
 * mirroring the server's CORNER_KICK_FINAL_PACE_CAP so client highlights and server
 * legality cannot drift.
 */
const CORNER_KICK_FINAL_SETUP_CONFIG: ResponseMoveValidHexConfig = {
  lockedPieceIdField: 'cornerKickMovedPieceId',
  paceUsedField: 'cornerKickPaceUsed',
  paceCap: 3,
  clickDistanceMode: 'strict-1',
};

/**
 * Shared valid-hex computation for the 4 response-move selectPiece branches (Cluster 3,
 * Phase 18.2 DESIGN-03). The caller does its own ownership/carrier/lock early-return guards
 * (these differ per branch and stay inline) — this helper only computes the valid
 * destination hex list once the piece is known to be selectable this slot.
 */
function computeResponseMoveValidHexes(
  id: string,
  piece: GameState['pieces'][number],
  gameState: GameState,
  config: ResponseMoveValidHexConfig,
): HexCoord[] {
  const paceUsed = gameState[config.paceUsedField] ?? 0;
  const paceRemaining = config.paceCap - paceUsed;
  if (paceRemaining <= 0) return [];
  const range = config.clickDistanceMode === 'range' ? paceRemaining : 1;
  return hexesInRange(piece.position, range).filter((hex) => {
    if (!PITCH_HEXES.some((h) => h.q === hex.q && h.r === hex.r)) return false;
    if (
      gameState.pieces.some((p) => p.id !== id && p.position.q === hex.q && p.position.r === hex.r)
    )
      return false;
    const dist = hexDistance(piece.position, hex);
    if (config.clickDistanceMode === 'strict-1') return dist === 1;
    return dist >= 1 && dist <= paceRemaining;
  });
}

/**
 * KICK_OFF_SETUP valid-hex zone computation (SELECTOR-REVIEW.md fix #1, Phase 32-05
 * CLEANUP-03/D-06). Extracted verbatim from selectPiece's former inline KICK_OFF_SETUP block
 * so setGameState's sticky-selection block can reuse it — previously only selectPiece computed
 * this, so a same-phase broadcast during KICK_OFF_SETUP (e.g. the opponent repositioning a
 * piece) fell through to the generic MOVEMENT computeMovementValidHexes path, which always
 * returns [] here (validateMove's WRONG_SLOT guard fires because movementSlot is null during
 * KICK_OFF_SETUP), silently wiping the zone highlight mid-selection.
 */
function computeKickOffSetupValidHexes(
  id: string,
  gameState: GameState,
  myTeam: 'home' | 'away',
): HexCoord[] {
  const isAttacking = myTeam === gameState.attackingTeam;
  const kickOffHex = PITCH_REGIONS.kickOffHex;
  return PITCH_HEXES.filter((hex) => {
    // Exclude the hex currently occupied by another own piece (can't stack)
    if (
      gameState.pieces.some(
        (p) =>
          p.id !== id && p.teamId === myTeam && p.position.q === hex.q && p.position.r === hex.r,
      )
    )
      return false;
    const inCentre = isInRegion(hex, 'centreCircle');
    if (myTeam === 'home') {
      // Attacking: q ≤ 18; defending: strictly q < 18 and not in centre circle
      return isAttacking ? hex.q <= kickOffHex.q : hex.q < kickOffHex.q && !inCentre;
    } else {
      // Attacking: q ≥ 18; defending: strictly q > 18 and not in centre circle
      return isAttacking ? hex.q >= kickOffHex.q : hex.q > kickOffHex.q && !inCentre;
    }
  });
}

/**
 * FREE_KICK_SETUP valid-hex + selection-validity computation (SELECTOR-REVIEW.md fix #1,
 * Phase 32-05 CLEANUP-03/D-06). Extracted verbatim from selectPiece's former inline
 * FREE_KICK_SETUP guard cascade (D-49 staged/turn-gated model) so setGameState's sticky-
 * selection block can re-validate AND recompute on every same-phase broadcast — a stage
 * hand-off (kicking team -> defending team, or vice versa) does not change GameState.phase,
 * so without this the previous selection could survive a turn change with a stale hex set.
 * Returns null when the selection is no longer valid for the CURRENT broadcast state (mirrors
 * every early-return-to-clear branch in the original selectPiece cascade); the caller clears
 * selection in that case exactly as selectPiece's guards would.
 */
function computeFreeKickSetupValidHexes(
  id: string,
  piece: GameState['pieces'][number],
  gameState: GameState,
  myTeam: 'home' | 'away',
): HexCoord[] | null {
  if (piece.teamId !== myTeam) return null;
  const stageIndex = gameState.freeKickStageIndex;
  const kickingTeam = gameState.freeKickAttackingTeam;
  if (stageIndex === null || stageIndex === undefined || !kickingTeam) return null;
  const activeTeamForStage = freeKickStageTeam(stageIndex, kickingTeam);
  if (myTeam !== activeTeamForStage) return null;
  const isKickingTeam = myTeam === kickingTeam;
  const freeKickHex = gameState.freeKickHex;

  // D-54 kicker-select sub-step: the only valid destination is the ball hex (freeKickHex).
  if (gameState.freeKickKickerChosen === false) {
    if (!freeKickHex) return null;
    const fkOccupied = gameState.pieces.some(
      (p) => p.id !== id && p.position.q === freeKickHex.q && p.position.r === freeKickHex.r,
    );
    return fkOccupied ? [] : [freeKickHex];
  }

  return PITCH_HEXES.filter((hex) => {
    // Exclude hexes occupied by another own piece (can't stack)
    if (
      gameState.pieces.some(
        (p) =>
          p.id !== id && p.teamId === myTeam && p.position.q === hex.q && p.position.r === hex.r,
      )
    )
      return false;
    // D-29: kicking team's stages have no further restriction.
    if (isKickingTeam || !freeKickHex) return true;
    // D-30: defending team's stages must stay >2 hexes from freeKickHex.
    if (hexDistance(hex, freeKickHex) <= 2) return false;
    return true;
  });
}

/**
 * CORNER_KICK_REPOSITION (CORNER-03) bounded-area destination computation (Plan 38-29 Task 1).
 * Modelled on computeFreeKickSetupValidHexes directly above (bounded-area placement), not on
 * computeFreeMoveValidHexes's adjacency-only model — D-GAP-03's corrected reading (38-24 bug 2)
 * is one destination click at any distance inside the allowed area. Shared by selectPiece's
 * CORNER_KICK_REPOSITION branch and setGameState's sticky-selection arm so the two call sites
 * can never drift apart (mirrors how computeFreeKickSetupValidHexes itself is shared).
 *
 * Deliberate divergence from computeFreeKickSetupValidHexes: this excludes every hex occupied
 * by ANY other piece (`p.id !== id`), not just own-team pieces, because
 * applyCornerKickReposition (gameEngine.ts, rewritten by plan 38-27) rejects ANY occupied
 * destination with INVALID_TARGET regardless of which team occupies it — free kick's kicking
 * team has no such restriction, but a corner reposition placement does.
 */
function computeCornerRepositionValidHexes(
  id: string,
  gameState: GameState,
  side: 'attacking' | 'defending',
): HexCoord[] {
  const cornerKickHex = gameState.cornerKickHex ?? null;
  return PITCH_HEXES.filter((hex) => {
    // Any-piece occupancy exclusion — mirrors applyCornerKickReposition's stricter INVALID_TARGET
    // guard (gameEngine.ts), not computeFreeKickSetupValidHexes's own-team-only filter above.
    if (
      gameState.pieces.some((p) => p.id !== id && p.position.q === hex.q && p.position.r === hex.r)
    )
      return false;
    // T-38-74/permanent exclusion zone (38-20): the defending side may never be offered a
    // destination inside the corner exclusion zone at any point in the corner sequence.
    if (
      side === 'defending' &&
      cornerKickHex !== null &&
      isWithinCornerExclusionZone(hex, cornerKickHex)
    )
      return false;
    return true;
  });
}

/**
 * FREE_MOVE_ATTACK/DEFENSE valid-hex computation (SELECTOR-REVIEW.md fix #3, Phase 32-05
 * CLEANUP-03/D-06). Extracted from selectPiece's former inline FREE_MOVE_ATTACK/DEFENSE block —
 * was byte-for-byte duplicated in setGameState's sticky-selection block (differing only in the
 * pace-budget lookup expression); both call sites now share this single source.
 */
function computeFreeMoveValidHexes(
  id: string,
  piece: GameState['pieces'][number],
  gameState: GameState,
): HexCoord[] {
  return hexesInRange(piece.position, 1).filter((hex) => {
    if (!PITCH_HEXES.some((h) => h.q === hex.q && h.r === hex.r)) return false;
    if (
      gameState.pieces.some((p) => p.id !== id && p.position.q === hex.q && p.position.r === hex.r)
    )
      return false;
    return hexDistance(piece.position, hex) === 1;
  });
}

/**
 * PENALTY_KICK_SETUP_ATTACKING/DEFENDING valid-hex computation (PEN-02, D-08, Phase 39 Plan
 * 05). Structurally identical to {@link computeFreeMoveValidHexes} (single-step adjacency,
 * on-pitch, unoccupied) — deliberately UNBUDGETED (no pace-cap cutoff is ported from the
 * goal-kick reposition branch; PEN-02 is free repositioning with no per-piece hex budget).
 *
 * Additionally excludes any destination inside the DEFENDING team's penalty area unless the
 * selected piece is the defending goalkeeper or the already-chosen penalty taker
 * (`penaltyKickTakerId`). The kicking team (`penaltyKickTeam`) attacks the OTHER team's area,
 * so the restricted region is the one belonging to the team that is NOT `penaltyKickTeam`.
 * This is a client-side convenience highlight only — the server independently re-validates the
 * same restriction (T-39-05-01); no client filter here is load-bearing for correctness.
 */
function computePenaltyKickValidHexes(
  id: string,
  piece: GameState['pieces'][number],
  gameState: GameState,
): HexCoord[] {
  const penaltyKickTeam = gameState.penaltyKickTeam ?? null;
  const restrictedRegion =
    penaltyKickTeam === null
      ? null
      : penaltyKickTeam === 'home'
        ? 'awayPenaltyArea'
        : 'homePenaltyArea';
  const isExempt =
    (piece.role === 'GK' && penaltyKickTeam !== null && piece.teamId !== penaltyKickTeam) ||
    id === gameState.penaltyKickTakerId;
  return hexesInRange(piece.position, 1).filter((hex) => {
    if (!PITCH_HEXES.some((h) => h.q === hex.q && h.r === hex.r)) return false;
    if (
      gameState.pieces.some((p) => p.id !== id && p.position.q === hex.q && p.position.r === hex.r)
    )
      return false;
    if (hexDistance(piece.position, hex) !== 1) return false;
    if (!isExempt && restrictedRegion !== null && isInRegion(hex, restrictedRegion)) return false;
    return true;
  });
}

/**
 * GOALKICK-03/D-17-01 (Phase 37, gap-closure plan 37-17): when the eligible next-action set
 * for a broadcast's `lastActionType` reduces to a single pass type, the player has already
 * made that exact choice one screen earlier (e.g. clicking "Standard Pass" over "Kick" in
 * GoalKickSetupPanel for GOAL_KICK_RESTART) — re-presenting a one-button Step-1 chooser is a
 * dead click (37-UAT.md Test 10). This rule is expressed purely in terms of
 * ELIGIBLE_NEXT_ACTIONS cardinality (never special-cased to a specific lastActionType), so any
 * future restart row that also collapses to a singleton pass-type set (e.g. Phase 38's corner
 * kick) inherits the behaviour automatically with no code change.
 *
 * `effectiveLastAction` mirrors ActionPanel.tsx's `lastActionType ?? 'MOVEMENT_PHASE'` fallback
 * exactly (line ~708) so this helper and the Step-1 chooser always agree on which row is being
 * evaluated.
 *
 * Deliberately excludes MOVEMENT, SNAPSHOT and SHOT even when either is the sole eligible
 * member: those actions have side effects beyond local selection state (MOVEMENT commits to a
 * movement sub-phase via emitStartMovement, SNAPSHOT/SHOT fire dice rolls), so auto-firing them
 * would take an irreversible action the player never clicked. Only pass-*type* selection is
 * purely local, reversible UI state — nothing is emitted to the server until an explicit
 * target-hex click confirms the pass (T-37-81).
 */
function computeAutoSelectablePassType(state: GameState): PassType | null {
  const effectiveLastAction = state.lastActionType ?? 'MOVEMENT_PHASE';
  const eligible = ELIGIBLE_NEXT_ACTIONS[effectiveLastAction];
  if (!eligible || eligible.size !== 1) return null;
  const [only] = Array.from(eligible);
  if (
    only === 'STANDARD_PASS' ||
    only === 'FIRST_TIME_PASS' ||
    only === 'HIGH_PASS' ||
    only === 'LONG_BALL'
  ) {
    return only;
  }
  return null;
}

/**
 * Zustand 4.x store using curried TypeScript form: create<T>()((set, get) => ...).
 * Required for correct TypeScript type inference in Zustand 4 (Pitfall 1 from RESEARCH.md).
 * Initial state uses mockMovementState (D-10, D-11).
 */
export const useGameStore = create<GameStore>()((set, get) => ({
  gameState: mockMovementState,
  screen: 'LANDING',
  selectedPieceId: null,
  validMoveHexes: [],
  tackleRiskHexes: [],
  lastMovedPieceId: null,
  playerSlot: null,
  roomCode: null,
  disconnectWarning: false,
  roomError: null,
  gameError: null,
  validPassTargetHexes: [],
  interceptionRiskHexes: [],
  passTargetHex: null,
  selectedPassType: null,
  headerContestantIds: [],
  shootingMode: false,

  setScreen: (s) => set({ screen: s }),

  setSelectedPassType: (passType) => {
    if (passType === null) {
      set({
        selectedPassType: null,
        validPassTargetHexes: [],
        interceptionRiskHexes: [],
        passTargetHex: null,
      });
      return;
    }

    const { gameState } = get();
    const carrier = gameState.pieces.find((p) => p.id === gameState.ball.carrierId);
    if (!carrier) return;

    // Map ActionPanel pass type to validatePass internal type
    const vpTypeMap: Record<PassType, 'STANDARD' | 'FIRST_TIME' | 'HIGH' | 'LONG'> = {
      STANDARD_PASS: 'STANDARD',
      FIRST_TIME_PASS: 'FIRST_TIME',
      HIGH_PASS: 'HIGH',
      LONG_BALL: 'LONG',
    };
    const vpType = vpTypeMap[passType];
    const opponents = gameState.pieces.filter((p) => p.teamId !== carrier.teamId);

    // THROWIN-04: mirror the server's 6-hex throw cap so highlights match server-side
    // legality. The server (gameHandlers.ts) remains authoritative regardless of what this
    // client-side highlight set shows.
    const isThrowIn =
      gameState.lastActionType === 'THROW_IN_MOVEMENT_1' ||
      gameState.lastActionType === 'THROW_IN_MOVEMENT_2';

    const validTargets: HexCoord[] = [];
    const interceptionRisk: HexCoord[] = [];

    for (const hex of PITCH_HEXES) {
      const result = validatePass(
        gameState,
        carrier,
        carrier.position,
        hex,
        vpType,
        isThrowIn ? { maxDistance: THROW_IN_MAX_DISTANCE } : undefined,
      );
      if (!result.ok) continue;

      validTargets.push(hex);

      if (passType === 'LONG_BALL') {
        // Long ball cannot be intercepted. Show orange only on final-third hexes
        // when the passer is in their own first third (ambitious long-range play indicator).
        const passerInOwnThird =
          carrier.teamId === 'home'
            ? isInRegion(carrier.position, 'homeThird')
            : isInRegion(carrier.position, 'awayThird');
        const hexInOpponentFinalThird =
          carrier.teamId === 'home' ? isInRegion(hex, 'awayThird') : isInRegion(hex, 'homeThird');
        if (passerInOwnThird && hexInOpponentFinalThird) {
          interceptionRisk.push(hex);
        }
      } else if (passType === 'HIGH_PASS') {
        // High pass cannot be intercepted in flight, but opponents within 2 hexes of the
        // landing hex can contest the header — show those targets as orange (contest risk).
        const hasNearbyOpponent = opponents.some((o) => hexDistance(o.position, hex) <= 2);
        if (hasNearbyOpponent) {
          interceptionRisk.push(hex);
        }
      } else {
        // STANDARD / FIRST_TIME: check if any travel-path hex is adjacent to a defender
        const travelPath = hexLine(carrier.position, hex).slice(1);
        const hasInterceptionRisk = travelPath.some(
          (pathHex) =>
            getZoIDefenders(pathHex, opponents).length > 0 ||
            opponents.some((o) => o.position.q === pathHex.q && o.position.r === pathHex.r),
        );
        if (hasInterceptionRisk) {
          interceptionRisk.push(hex);
        }
      }
    }

    set({
      selectedPassType: passType,
      validPassTargetHexes: validTargets,
      interceptionRiskHexes: interceptionRisk,
      passTargetHex: null,
    });
  },

  setPassTargetHex: (hex) => set({ passTargetHex: hex }),

  confirmPassTarget: (hex) => {
    const { selectedPassType } = get();
    // All pass types auto-emit GAME_ROLL on target confirm — no Roll Dice button.
    // HIGH_PASS: server transitions to HIGH_PASS_MOVEMENT; LONG_BALL: accuracy checked server-side.
    if (
      selectedPassType === 'STANDARD_PASS' ||
      selectedPassType === 'FIRST_TIME_PASS' ||
      selectedPassType === 'HIGH_PASS' ||
      selectedPassType === 'LONG_BALL'
    ) {
      socket.emit(ClientEvents.GAME_ROLL, selectedPassType, hex);
      set({
        selectedPassType: null,
        validPassTargetHexes: [],
        interceptionRiskHexes: [],
        passTargetHex: null,
      });
    } else {
      set({ passTargetHex: hex });
    }
  },

  emitHeaderContestant: (pieceIds) => {
    socket.emit(ClientEvents.GAME_HEADER_CONTESTANT, pieceIds);
  },

  toggleHeaderContestantId: (id) =>
    set((state) => ({
      headerContestantIds: state.headerContestantIds.includes(id)
        ? state.headerContestantIds.filter((x) => x !== id)
        : [...state.headerContestantIds, id],
    })),

  selectPiece: (id) => {
    const { gameState, selectedPieceId, playerSlot } = get();
    // Toggle off if the same piece is clicked again
    if (selectedPieceId === id) {
      set({ selectedPieceId: null, validMoveHexes: [] });
      return;
    }
    const piece = gameState.pieces.find((p) => p.id === id);
    if (!piece) return;

    // KICK_OFF_SETUP: valid destinations are the full kick-off zone (no pace limit, D-23)
    if (gameState.phase === 'KICK_OFF_SETUP') {
      // D-04/Pitfall 4: deriveMyTeam is the canonical null-safe helper (hooks are illegal
      // in store action bodies — Pitfall 2). selectPiece is only ever invoked from
      // HexGrid's canSelectKickOff, which already requires myTeam !== null, so this early
      // guard is defense-in-depth rather than a real-flow behavior change — but it replaces
      // the prior implicit "playerSlot==null -> away" coercion with an explicit no-op
      // instead of silently treating an unassigned player as the away team.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const valid = computeKickOffSetupValidHexes(id, gameState, myTeam);
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // OFFSIDE-02 (Phase 17 D-49 staged rework): only the piece belonging to the
    // CURRENTLY-active stage's team may be selected — derive the active team the same
    // way the server does (freeKickStageTeam(stageIndex, freeKickAttackingTeam)). Valid
    // destinations are unrestricted for the kicking team's stages (D-29), or all-pitch-
    // minus-2-hex-zone for the conceding team's stages (D-30) — this logic is UNCHANGED
    // from the prior simultaneous model, just re-gated on "is it my team's stage right now."
    if (gameState.phase === 'FREE_KICK_SETUP') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectFreeKick)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const valid = computeFreeKickSetupValidHexes(id, piece, gameState, myTeam);
      if (valid === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // THROW_IN_SETUP (THROWIN-02, D-16-05): thrower placement is a server-fixed teleport to
    // throwInHex (emitThrowInPlace(pieceId) — the destination is not chosen by the client), so
    // there is no per-piece destination set to compute here. HexGrid's isThrowInHexTint plus
    // BallLocationRing already mark the destination on the pitch independently of selection.
    // This branch exists so a thrower click is handled by phase-specific logic instead of
    // falling through to the generic MOVEMENT computeMovementValidHexes fallback below, which
    // runs validateMove against a movementSlot that triggerOutOfBoundsRestart's commonReset
    // deliberately sets to null (gameEngine.ts) — that fallback also writes tackleRiskHexes,
    // which is deliberately cleared to [] here since no throw-in rule produces ZoI/tackle-risk
    // data for a phase where the only action is "select the thrower, then Confirm".
    if (gameState.phase === 'THROW_IN_SETUP') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectThrowIn)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // Mirrors applyThrowInPlace's WRONG_TEAM guard (gameEngine.ts) — only the throwing
      // team's pieces are selectable. Does not invent an extra restriction the server
      // doesn't enforce.
      if (piece.teamId !== gameState.throwInTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      set({ selectedPieceId: id, validMoveHexes: [], tackleRiskHexes: [] });
      return;
    }

    // HIGH_PASS_MOVE: 1 piece per team, up to 3 hexes, any direction
    if (gameState.phase === 'HIGH_PASS_MOVE') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectHighPassMove)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // Only own team pieces can be selected
      if (piece.teamId !== myTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // BUG-11 (Phase 18.2): the original high-pass kicker's own piece is not selectable
      // during HIGH_PASS_MOVE repositioning — defense-in-depth UX only; the server is the
      // authoritative guard (GAME_MOVE rejects WRONG_PIECE) and would reject this move even
      // if a tampered client bypassed this check. Mirrors the FTP mirror below.
      if (id === gameState.highPassCarrierId) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // If a different piece is already locked in for this slot, reject selection
      const lockedId = gameState.highPassMovedPieceId ?? null;
      if (lockedId !== null && lockedId !== id) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const valid = computeResponseMoveValidHexes(id, piece, gameState, HIGH_PASS_MOVE_CONFIG);
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // FREE_MOVE_ATTACK / FREE_MOVE_DEFENSE (Phase 17 MOVE-06, corrected design): any number of
    // eligible pieces (both teams precomputed at trigger time) may each move up to 6 hexes
    // independently — no single-piece lock like HIGH_PASS_MOVE.
    if (gameState.phase === 'FREE_MOVE_ATTACK' || gameState.phase === 'FREE_MOVE_DEFENSE') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectFreeMove)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const side = gameState.phase === 'FREE_MOVE_ATTACK' ? 'attack' : 'defense';
      const eligibleIds = gameState.freeMoveEligibleIds?.[side] ?? [];
      if (piece.teamId !== myTeam || !eligibleIds.includes(id)) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // Already activated this sub-phase (exhausted or abandoned) — defense-in-depth, mirrors
      // other phase branches in this file that guard against already-spent pieces (UX-parity fix).
      if (gameState.movedPieceIds.includes(id)) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const paceRemaining = 6 - (gameState.freeMoveUsedPace?.[id] ?? 0);
      if (paceRemaining <= 0) {
        set({ selectedPieceId: id, validMoveHexes: [] });
        return;
      }
      const valid = computeFreeMoveValidHexes(id, piece, gameState);
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // GOAL_KICK_SETUP_GK / GOAL_KICK_SETUP_OPPONENT (GOALKICK-02): the two sequential 6-hex
    // reposition windows — GK's team first, then the opponent. Structurally identical to the
    // FREE_MOVE_ATTACK/DEFENSE branch above (precomputed eligible-piece list, no single-piece
    // lock, 6-hex-per-piece budget, movedPieceIds exhaustion guard), substituting the
    // goalKick*-prefixed fields for the freeMove*-prefixed ones.
    if (
      gameState.phase === 'GOAL_KICK_SETUP_GK' ||
      gameState.phase === 'GOAL_KICK_SETUP_OPPONENT'
    ) {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectGoalKickSetup)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const side = gameState.phase === 'GOAL_KICK_SETUP_GK' ? 'gkTeam' : 'opponent';
      const eligibleIds = gameState.goalKickEligibleIds?.[side] ?? [];
      if (piece.teamId !== myTeam || !eligibleIds.includes(id)) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // Already activated this window (exhausted or abandoned) — mirrors the FREE_MOVE_*
      // exhaustion guard and Plan 37-08's server-side applyGoalKickReposition lock.
      if (gameState.movedPieceIds.includes(id)) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const paceRemaining = 6 - (gameState.goalKickUsedPace?.[id] ?? 0);
      if (paceRemaining <= 0) {
        set({ selectedPieceId: id, validMoveHexes: [] });
        return;
      }
      const valid = computeFreeMoveValidHexes(id, piece, gameState);
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // FIRST_TIME_PASS_MOVE: 1 piece per team, up to 1 hex, any direction (D-03, CR-01-new)
    // Mirrors HIGH_PASS_MOVE structurally but pace cap is 1 (not 3) and uses the
    // firstTimePass* slot fields. Does NOT call validateMove — that fn's WRONG_SLOT guard
    // fires for this phase (movementSlot stays null here; position is tracked via
    // firstTimePassMovementSlot instead), which was the CR-01-new root cause.
    if (gameState.phase === 'FIRST_TIME_PASS_MOVE') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectFirstTimePassMove)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // Only own team pieces can be selected
      if (piece.teamId !== myTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // Cycle-4 self-pass-reclaim finding (D-03, Phase 17.1-16): the original passer's own
      // piece is not selectable during FTP repositioning — defense-in-depth UX only; the
      // server is the authoritative guard (GAME_MOVE rejects WRONG_PIECE) and would reject
      // this move even if a tampered client bypassed this check.
      if (id === gameState.firstTimePassCarrierId) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // If a different piece is already locked in for this slot, reject selection
      const lockedId = gameState.firstTimePassMovedPieceId ?? null;
      if (lockedId !== null && lockedId !== id) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const valid = computeResponseMoveValidHexes(
        id,
        piece,
        gameState,
        FIRST_TIME_PASS_MOVE_CONFIG,
      );
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // GK_KICK_MOVE: both teams reposition 1 piece up to 3 hexes while kick is in air
    if (gameState.phase === 'GK_KICK_MOVE') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectGKKickMove)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      if (piece.teamId !== myTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const lockedId = gameState.gkKickMovedPieceId ?? null;
      if (lockedId !== null && lockedId !== id) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const valid = computeResponseMoveValidHexes(id, piece, gameState, GK_KICK_MOVE_CONFIG);
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // GOAL_KICK_MOVE (GOALKICK-05): both teams reposition 1 piece up to 3 hexes while the
    // goal kick is in the air — structurally identical to the GK_KICK_MOVE branch above.
    if (gameState.phase === 'GOAL_KICK_MOVE') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectGoalKickMove)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      if (piece.teamId !== myTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const lockedId = gameState.goalKickMovedPieceId ?? null;
      if (lockedId !== null && lockedId !== id) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const valid = computeResponseMoveValidHexes(id, piece, gameState, GOAL_KICK_MOVE_CONFIG);
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // CORNER_KICK_GK_SETUP_ATTACKING / _DEFENDING (CORNER-01): sequential GK-only reposition
    // windows before the corner-taker is placed — the attacking team's GK first, then the
    // defending team's GK. Assumption A1 (RESEARCH.md): destinations are every unoccupied
    // on-pitch hex, deliberately uncapped, mirroring the server's applyCornerKickGkPlace —
    // unlike GOAL_KICK_SETUP_GK/_OPPONENT's 6-hex-per-click budgeted reposition above, this is
    // a single uncapped placement.
    if (
      gameState.phase === 'CORNER_KICK_GK_SETUP_ATTACKING' ||
      gameState.phase === 'CORNER_KICK_GK_SETUP_DEFENDING'
    ) {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectCornerKickGk)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const cornerKickTeam = gameState.cornerKickTeam ?? null;
      if (cornerKickTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const actingTeam: 'home' | 'away' =
        gameState.phase === 'CORNER_KICK_GK_SETUP_ATTACKING'
          ? cornerKickTeam
          : cornerKickTeam === 'home'
            ? 'away'
            : 'home';
      if (piece.teamId !== actingTeam || piece.role !== 'GK' || actingTeam !== myTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // Assumption A1: every on-pitch hex not occupied by another piece — uncapped, mirroring
      // the server's applyCornerKickGkPlace. Keep this comment adjacent to the computation so
      // the client cap (none) and server cap stay discoverable together.
      // T-38-74/permanent exclusion zone (38-20): CORNER_KICK_GK_SETUP_DEFENDING additionally
      // drops any hex inside the 3-hex zone — the defending GK may never be placed there,
      // mirroring applyCornerKickGkPlace's CORNER_EXCLUSION_ZONE guard. The attacking window
      // is unrestricted (attackers may stand anywhere, including inside the zone).
      const cornerKickHexForGk = gameState.cornerKickHex ?? null;
      const valid = PITCH_HEXES.filter((hex) => {
        if (
          gameState.pieces.some(
            (p) => p.id !== id && p.position.q === hex.q && p.position.r === hex.r,
          )
        )
          return false;
        if (
          gameState.phase === 'CORNER_KICK_GK_SETUP_DEFENDING' &&
          cornerKickHexForGk !== null &&
          isWithinCornerExclusionZone(hex, cornerKickHexForGk)
        ) {
          return false;
        }
        return true;
      });
      set({ selectedPieceId: id, validMoveHexes: valid, tackleRiskHexes: [] });
      return;
    }

    // CORNER_KICK_TAKER_SELECT (CORNER-02): modelled on THROW_IN_SETUP above — the
    // corner-taker's destination (cornerKickHex) is server-fixed, never client-chosen, so
    // there is no per-piece destination set to compute here.
    if (gameState.phase === 'CORNER_KICK_TAKER_SELECT') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectCornerKickTaker)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // Mirrors applyCornerKickTaker's WRONG_TEAM guard (gameEngine.ts) — only the kicking
      // team's own on-pitch pieces are selectable.
      if (piece.teamId !== gameState.cornerKickTeam || gameState.cornerKickTeam !== myTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      set({ selectedPieceId: id, validMoveHexes: [], tackleRiskHexes: [] });
      return;
    }

    // CORNER_KICK_REPOSITION (CORNER-03): 6 alternating attacking/defending stages. Modelled
    // on computeFreeKickSetupValidHexes (bounded-area single-destination placement, Plan 38-29
    // Task 1), not on the GOAL_KICK_SETUP_GK/_OPPONENT adjacency branch above — D-GAP-03's
    // corrected reading (38-24 bug 2) is one destination click at any distance inside the
    // allowed area, and the activation lock (cornerKickActivatedIds) applies the instant that
    // placement lands, including within the same stage that activated it. No stage-distinct-
    // piece-count check here — a client-side "2 distinct pieces" hint is a display concern
    // owned by the panel (38-07); the server rejects violations authoritatively.
    if (gameState.phase === 'CORNER_KICK_REPOSITION') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectCornerKickReposition)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const cornerKickTeam = gameState.cornerKickTeam ?? null;
      const stageIndex = gameState.cornerKickStageIndex ?? null;
      if (cornerKickTeam === null || stageIndex === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const actingTeam = cornerKickStageTeam(stageIndex, cornerKickTeam);
      const side = actingTeam === cornerKickTeam ? 'attacking' : 'defending';
      const eligibleIds = gameState.cornerKickEligibleIds?.[side] ?? [];
      if (myTeam !== actingTeam || piece.teamId !== actingTeam || !eligibleIds.includes(id)) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // Activation lock: a piece is locked the moment its placement completes — no same-stage
      // exemption. It stays selectable (so its stats panel can show) but yields no destinations.
      const cornerKickActivated = gameState.cornerKickActivatedIds?.includes(id) ?? false;
      if (cornerKickActivated) {
        set({ selectedPieceId: id, validMoveHexes: [] });
        return;
      }
      const valid = computeCornerRepositionValidHexes(id, gameState, side);
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // CORNER_KICK_FINAL_SETUP (CORNER-06): 1-player-per-team pre-kick reposition window,
    // modelled on the GOAL_KICK_MOVE branch above via CORNER_KICK_FINAL_SETUP_CONFIG. The
    // acting team derives from cornerKickMoveSlot; goalkeepers and the corner-taker are
    // excluded server-side via cornerKickEligibleIds, so the client must not offer them.
    if (gameState.phase === 'CORNER_KICK_FINAL_SETUP') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectCornerKickFinal)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const cornerKickTeam = gameState.cornerKickTeam ?? null;
      if (cornerKickTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const actingTeam: 'home' | 'away' =
        gameState.cornerKickMoveSlot === 'ATTACKER'
          ? cornerKickTeam
          : cornerKickTeam === 'home'
            ? 'away'
            : 'home';
      const side = actingTeam === cornerKickTeam ? 'attacking' : 'defending';
      const eligibleIds = gameState.cornerKickEligibleIds?.[side] ?? [];
      if (piece.teamId !== myTeam || piece.teamId !== actingTeam || !eligibleIds.includes(id)) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const lockedId = gameState.cornerKickMovedPieceId ?? null;
      if (lockedId !== null && lockedId !== id) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      let valid = computeResponseMoveValidHexes(
        id,
        piece,
        gameState,
        CORNER_KICK_FINAL_SETUP_CONFIG,
      );
      // T-38-74/permanent exclusion zone (38-20): the defending side may never be offered a
      // destination inside the 3-hex zone at any point in the corner sequence — filtered here
      // using this branch's own acting-side computation (`side`), never `activeTeam`.
      const cornerKickHexForFinal = gameState.cornerKickHex ?? null;
      if (side === 'defending' && cornerKickHexForFinal !== null) {
        valid = valid.filter((hex) => !isWithinCornerExclusionZone(hex, cornerKickHexForFinal));
      }
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // SNAPSHOT_DEFLECT: defending team moves 1 piece up to 2 hexes
    if (gameState.phase === 'SNAPSHOT_DEFLECT') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectSnapDeflect)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const defendingTeam: 'home' | 'away' = gameState.attackingTeam === 'home' ? 'away' : 'home';
      if (piece.teamId !== defendingTeam || myTeam !== defendingTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const lockedId = gameState.snapDeflectMovedPieceId ?? null;
      if (lockedId !== null && lockedId !== id) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // BUGFIX (snapshot-shot-flow-mismatch): previously hard-capped at hexesInRange(.., 1)
      // (adjacency-only), forcing hex-by-hex movement. Now mirrors the server's single-click
      // targeting — any hex within the remaining 2-hex budget is a valid one-click destination,
      // matching GK_DIVE's "click a spot directly" UX for regular/headed shots. clickDistanceMode:
      // 'range' in computeResponseMoveValidHexes preserves this semantic.
      const valid = computeResponseMoveValidHexes(id, piece, gameState, SNAPSHOT_DEFLECT_CONFIG);
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // FOUL_CHOICE / GK_DIVE_AT_FEET_PROMPT / GK_BOX_ENTRY_PROMPT (Phase 39): pure two-button
    // panels with no board interaction — no piece is ever selectable during these phases.
    // Defense-in-depth guard (mirrors every other phase's explicit no-op branch above);
    // setGameState's phaseChanged clear already zeroes selectedPieceId on entry to any of
    // these, this branch additionally prevents a stray selectPiece call from re-selecting
    // anything while one of these phases is active.
    if (
      gameState.phase === 'FOUL_CHOICE' ||
      gameState.phase === 'GK_DIVE_AT_FEET_PROMPT' ||
      gameState.phase === 'GK_BOX_ENTRY_PROMPT'
    ) {
      set({ selectedPieceId: null, validMoveHexes: [] });
      return;
    }

    // PENALTY_KICK_SETUP_ATTACKING / PENALTY_KICK_SETUP_DEFENDING (PEN-02, D-08): the
    // full-squad, unbudgeted reposition windows before a penalty kick — modelled on the
    // GOAL_KICK_SETUP_GK/_OPPONENT branch above (precomputed eligible-piece list, no
    // single-piece lock), but with NO per-piece hex budget (PEN-02 is unbudgeted free
    // repositioning; do not port the goal-kick branch's usedPace >= 6 cutoff).
    if (
      gameState.phase === 'PENALTY_KICK_SETUP_ATTACKING' ||
      gameState.phase === 'PENALTY_KICK_SETUP_DEFENDING'
    ) {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale).
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      if (myTeam !== gameState.activeTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const side = gameState.phase === 'PENALTY_KICK_SETUP_ATTACKING' ? 'attacking' : 'defending';
      const eligibleIds = gameState.penaltyKickEligibleIds?.[side] ?? [];
      if (piece.teamId !== myTeam || !eligibleIds.includes(id)) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // Already activated this window — mirrors the FREE_MOVE_*/GOAL_KICK_SETUP_* exhaustion
      // guard (this window has no numeric pace budget, but a piece is still locked out once
      // its activation completes and it lands in movedPieceIds).
      if (gameState.movedPieceIds.includes(id)) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const valid = computePenaltyKickValidHexes(id, piece, gameState);
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // PENALTY_KICK_TAKER_SELECT (PEN-02, 39-23 gap-6 closure): clicking an own-team,
    // non-goalkeeper, non-red-carded, on-pitch piece SELECTS it — mirrors
    // CORNER_KICK_TAKER_SELECT above exactly. The destination is server-fixed
    // (penaltyKickSpot), so there is no per-piece hex set to compute here; commitment
    // happens via PenaltyKickSetupPanel's Confirm button (emitPenaltyKickTaker), not this
    // click. A prior version emitted directly from here with no confirmation step, so a
    // misclick committed the taker irreversibly (PENALTY_KICK_TAKER_PLACED is an Undo
    // boundary) — 39-UAT gap 6. Also closes 39-REVIEW IN-02: the isActivePiece rejection
    // below mirrors applyPenaltyKickTaker's TAKER_INVALID guard (gameEngine.ts) so a
    // sent-off teammate is unselectable on the client, not merely rejected round-trip by
    // the server. Phase 42 (BUG-38 residual audit, 42-10): converged onto the shared
    // isActivePiece predicate — this site hand-wrote `redCarded === true` and was missed
    // by the earlier client-side sweep (42-04, HexGrid.tsx's canSelectPenaltyKickTaker).
    if (gameState.phase === 'PENALTY_KICK_TAKER_SELECT') {
      // D-04/Pitfall 4: null playerSlot -> explicit no-op (see KICK_OFF_SETUP guard above
      // for full rationale); selectPiece's only real caller (HexGrid canSelectPenaltyKickTaker)
      // already requires myTeam !== null.
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      if (
        piece.teamId !== myTeam ||
        piece.teamId !== gameState.penaltyKickTeam ||
        piece.role === 'GK' ||
        !isActivePiece(piece)
      ) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      set({ selectedPieceId: id, validMoveHexes: [], tackleRiskHexes: [] });
      return;
    }

    // GK_BOX_ENTRY_MOVE (D-10): only the piece whose id equals the responding team's
    // goalkeeper is selectable, and only when myTeam === gkBoxEntryTeam. Valid hexes are that
    // goalkeeper's adjacent on-pitch unoccupied neighbours — at most six, exactly one step, no
    // budget (mirrors computeFreeMoveValidHexes exactly, same shape as the box-entry response's
    // one-hex reposition choice).
    if (gameState.phase === 'GK_BOX_ENTRY_MOVE') {
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      if (myTeam !== gameState.gkBoxEntryTeam || piece.teamId !== myTeam || piece.role !== 'GK') {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const valid = computeFreeMoveValidHexes(id, piece, gameState);
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // GK_DIVE_AT_FEET_TARGET (GKDIVE-02/GKDIVE-04, 39-UAT gap 3, Plan 39-21): only the exact
    // diving goalkeeper named by gkDiveAtFeetGkId is selectable, and only for the manager whose
    // team is gkDiveAtFeetTeam — guard is on the goalkeeper's ID, not merely role === 'GK',
    // since gameState already names the specific keeper. Valid hexes come from the SHARED
    // computeGkDiveAtFeetTargetHexes helper (imported from @counter-attack/shared) — never
    // re-derived locally — so the highlighted set can never drift from what the server accepts
    // (Plan 39-20 put the helper in shared for exactly this reason).
    if (gameState.phase === 'GK_DIVE_AT_FEET_TARGET') {
      const myTeam = deriveMyTeam(playerSlot);
      if (myTeam === null) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      if (myTeam !== gameState.gkDiveAtFeetTeam || id !== gameState.gkDiveAtFeetGkId) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const valid = computeGkDiveAtFeetTargetHexes(gameState);
      set({ selectedPieceId: id, validMoveHexes: valid, tackleRiskHexes: [] });
      return;
    }

    // Normal MOVEMENT phase: show only adjacent hexes (step-by-step, D-07)
    const { validMoveHexes: valid, tackleRiskHexes: tackle } = computeMovementValidHexes(
      piece,
      gameState,
    );
    set({ selectedPieceId: id, validMoveHexes: valid, tackleRiskHexes: tackle });
  },

  inspectPiece: (id) => {
    set({ selectedPieceId: id, validMoveHexes: [] });
  },

  setGameState: (newState) => {
    const prev = get();
    const prevState = prev.gameState;
    // Use lastMovedPieceId as fallback: emitMove clears selectedPieceId optimistically but saves
    // the piece here so we can restore selection when the server broadcast arrives (D-17).
    const prevSelectedId = prev.selectedPieceId ?? prev.lastMovedPieceId;

    // Determine whether to retain or clear selection (D-17, D-18, D-19)
    // BUG-09 (Phase 18.2-03): broadened from plain movementSlot to also cover the
    // response-move sub-phase slot fields — those phases track ATTACKER->DEFENDER hand-off
    // via firstTimePassMovementSlot/highPassMovementSlot/gkKickMovementSlot instead of the
    // plain movementSlot field, which never changes (stays null) during those phases.
    // GOAL_KICK_MOVE (GOALKICK-05, Plan 37-10) mirrors gkKickMovementSlot's KICKER->OPP
    // handoff via goalKickMoveSlot — without detecting this hand-off the same way, a
    // selection belonging to the team whose slot just ended could survive into the other
    // team's slot (computeResponseMoveValidHexes has no team-ownership check of its own),
    // reproducing the exact BUG-09 failure mode this guard already closes for GK_KICK_MOVE.
    // CORNER-06 (Phase 38): cornerKickMoveSlot mirrors goalKickMoveSlot's ATTACKER/DEFENDER
    // handoff shape. CORNER-03 (Phase 38): cornerKickStageIndex changing is CORNER_KICK_REPOSITION's
    // window-handoff signal — unlike GOAL_KICK_SETUP_GK/_OPPONENT (whose handoff is a distinct
    // GamePhase value, already caught by phaseChanged below), all 6 reposition stages share the
    // same phase value, so a stage advance must be detected explicitly here to always clear the
    // outgoing manager's selection.
    const responseMoveStateChanged =
      newState.movementSlot !== prevState.movementSlot ||
      newState.firstTimePassMovementSlot !== prevState.firstTimePassMovementSlot ||
      newState.highPassMovementSlot !== prevState.highPassMovementSlot ||
      newState.gkKickMovementSlot !== prevState.gkKickMovementSlot ||
      newState.goalKickMoveSlot !== prevState.goalKickMoveSlot ||
      newState.cornerKickMoveSlot !== prevState.cornerKickMoveSlot ||
      newState.cornerKickStageIndex !== prevState.cornerKickStageIndex;
    // BUG-09: a response-move phase's per-piece pace allowance is exhausted — the stale
    // selection/highlight must clear even when the slot itself hasn't changed yet (e.g. the
    // piece that just moved is still locked into the current slot but has no pace left).
    const responseMovePaceExhausted =
      newState.phase === 'FIRST_TIME_PASS_MOVE'
        ? (newState.firstTimePassPaceUsed ?? 0) >= 1
        : newState.phase === 'HIGH_PASS_MOVE'
          ? (newState.highPassPaceUsed ?? 0) >= 3
          : newState.phase === 'GK_KICK_MOVE'
            ? (newState.gkKickPaceUsed ?? 0) >= 3
            : newState.phase === 'SNAPSHOT_DEFLECT'
              ? (newState.snapDeflectPaceUsed ?? 0) >= 2
              : newState.phase === 'GOAL_KICK_MOVE'
                ? (newState.goalKickPaceUsed ?? 0) >= 3
                : newState.phase === 'CORNER_KICK_FINAL_SETUP'
                  ? (newState.cornerKickPaceUsed ?? 0) >= 3
                  : false;
    const phaseChanged = newState.phase !== prevState.phase;
    const pieceStillExists =
      prevSelectedId !== null && newState.pieces.some((p) => p.id === prevSelectedId);
    // After a multi-hex activation the piece is in movedPieceIds — deselect, activation complete
    const activationComplete =
      prevSelectedId !== null && newState.movedPieceIds.includes(prevSelectedId);

    if (
      responseMoveStateChanged ||
      responseMovePaceExhausted ||
      phaseChanged ||
      !pieceStillExists ||
      prevSelectedId === null ||
      activationComplete
    ) {
      // Clear selection on phase/slot transitions or missing piece (D-18)
      set({
        gameState: newState,
        selectedPieceId: null,
        validMoveHexes: [],
        tackleRiskHexes: [],
        lastMovedPieceId: null,
        // Phase 8.2: clear pass target and header contestant slices on phase change.
        // UX-15: headerContestantIds must only clear on genuine phase transitions (phaseChanged),
        // NOT on in-HEADER broadcasts (e.g. opponent confirming). prevSelectedId===null is always
        // true in HEADER phase (toggleHeaderContestantId never sets selectedPieceId), so this
        // block fires on every HEADER broadcast — guard headerContestantIds with phaseChanged.
        selectedPassType: null,
        validPassTargetHexes: [],
        interceptionRiskHexes: [],
        passTargetHex: null,
        headerContestantIds: phaseChanged ? [] : prev.headerContestantIds,
        // Phase 10: clear shooting mode on new server broadcast
        shootingMode: false,
        // Bug 1: stale GAME_ERROR from a prior action must not bleed into the new phase/slot
        gameError: null,
      });
      // GOALKICK-03/D-17-02 (gap-closure plan 37-17): after the clear-on-transition set above,
      // auto-select the pass type when this broadcast's eligible next-action set has collapsed
      // to a single pass-type option the player already chose one screen earlier (37-UAT.md
      // Test 10). Runs here — reading the already-committed newState — rather than as an
      // ActionPanel effect, because the Step-1 chooser sits behind several early `return`s in
      // that component's render and the store already owns every field this needs.
      // D-17-04/T-37-80: gated to the acting client only. HexGrid's pass-target tint is not
      // gated on isActivePlayer, so an ungated auto-selection would paint the goalkeeper's
      // valid-target and interception-risk highlights onto the defending player's board.
      // deriveMyTeam(prev.playerSlot) is the canonical null-safe helper (D-04/Pitfall 4) — a
      // null playerSlot yields null, never a silently-coerced team.
      const autoPassType = computeAutoSelectablePassType(newState);
      const actingTeam = deriveMyTeam(prev.playerSlot);
      if (autoPassType !== null && actingTeam !== null && actingTeam === newState.activeTeam) {
        // D-17-03: must call the store action below, never assign the field directly — it is
        // the only code path that computes validPassTargetHexes/interceptionRiskHexes.
        get().setSelectedPassType(autoPassType);
      }
      return;
    }

    // Sticky selection: recompute adjacent hexes for next step (D-17, D-19)
    const piece = newState.pieces.find((p) => p.id === prevSelectedId)!;

    // KICK_OFF_SETUP: re-run the zone rule (SELECTOR-REVIEW.md fix #1, Phase 32-05 D-06).
    // Previously this phase had no dedicated sticky branch and fell through to the generic
    // MOVEMENT computeMovementValidHexes path below, which always yields [] here (validateMove's
    // WRONG_SLOT guard fires because movementSlot is null during KICK_OFF_SETUP) — silently
    // wiping the zone highlight the moment the opponent repositions any piece mid-selection.
    if (newState.phase === 'KICK_OFF_SETUP') {
      const myTeam = deriveMyTeam(prev.playerSlot);
      const stickyValid =
        myTeam === null ? [] : computeKickOffSetupValidHexes(prevSelectedId, newState, myTeam);
      set({
        gameState: newState,
        selectedPieceId: prevSelectedId,
        validMoveHexes: stickyValid,
        tackleRiskHexes: [],
        lastMovedPieceId: null,
      });
      return;
    }

    // FREE_KICK_SETUP: re-validate the stage/team guard AND re-run the zone rule (SELECTOR-
    // REVIEW.md fix #1, Phase 32-05 D-06). A stage hand-off (kicking team -> defending team)
    // does not change GameState.phase, so — same root cause as KICK_OFF_SETUP above — this
    // phase previously fell through to the generic MOVEMENT path and silently zeroed out.
    // computeFreeKickSetupValidHexes returns null when the selection is no longer valid for the
    // active stage, mirroring every clear-branch in selectPiece's original guard cascade.
    if (newState.phase === 'FREE_KICK_SETUP') {
      const myTeam = deriveMyTeam(prev.playerSlot);
      const stickyValid =
        myTeam === null
          ? null
          : computeFreeKickSetupValidHexes(prevSelectedId, piece, newState, myTeam);
      if (stickyValid === null) {
        set({
          gameState: newState,
          selectedPieceId: null,
          validMoveHexes: [],
          tackleRiskHexes: [],
          lastMovedPieceId: null,
        });
        return;
      }
      set({
        gameState: newState,
        selectedPieceId: prevSelectedId,
        validMoveHexes: stickyValid,
        tackleRiskHexes: [],
        lastMovedPieceId: null,
      });
      return;
    }

    // HIGH_PASS_MOVE / GK_KICK_MOVE / FIRST_TIME_PASS_MOVE / GOAL_KICK_MOVE: re-run phase-specific
    // valid move logic via the same named config + computeResponseMoveValidHexes helper
    // selectPiece's matching branches use (SELECTOR-REVIEW.md fix #2, Phase 32-05 D-06) —
    // previously this block hand-rolled an equivalent computation inline instead of reusing the
    // helper. GOAL_KICK_MOVE (GOALKICK-05, Plan 37-10) added alongside its GK_KICK_MOVE analog.
    if (
      newState.phase === 'HIGH_PASS_MOVE' ||
      newState.phase === 'GK_KICK_MOVE' ||
      newState.phase === 'FIRST_TIME_PASS_MOVE' ||
      newState.phase === 'GOAL_KICK_MOVE' ||
      newState.phase === 'CORNER_KICK_FINAL_SETUP'
    ) {
      const config =
        newState.phase === 'GK_KICK_MOVE'
          ? GK_KICK_MOVE_CONFIG
          : newState.phase === 'FIRST_TIME_PASS_MOVE'
            ? FIRST_TIME_PASS_MOVE_CONFIG
            : newState.phase === 'GOAL_KICK_MOVE'
              ? GOAL_KICK_MOVE_CONFIG
              : newState.phase === 'CORNER_KICK_FINAL_SETUP'
                ? CORNER_KICK_FINAL_SETUP_CONFIG
                : HIGH_PASS_MOVE_CONFIG;
      const lockedId = newState[config.lockedPieceIdField] ?? null;
      const locked = lockedId !== null && lockedId !== prevSelectedId;
      let stickyValid = locked
        ? []
        : computeResponseMoveValidHexes(prevSelectedId, piece, newState, config);
      // T-38-74/permanent exclusion zone (38-20): mirrors selectPiece's CORNER_KICK_FINAL_SETUP
      // defending-side filter so a sticky selection across a broadcast can never re-offer an
      // excluded-zone hex. Only applies to CORNER_KICK_FINAL_SETUP — the other phases in this
      // shared block have no corner-exclusion concept.
      if (newState.phase === 'CORNER_KICK_FINAL_SETUP' && !locked) {
        const stickyCornerKickTeam = newState.cornerKickTeam ?? null;
        const stickyCornerKickHex = newState.cornerKickHex ?? null;
        if (
          stickyCornerKickTeam !== null &&
          stickyCornerKickHex !== null &&
          piece.teamId !== stickyCornerKickTeam
        ) {
          stickyValid = stickyValid.filter(
            (hex) => !isWithinCornerExclusionZone(hex, stickyCornerKickHex),
          );
        }
      }
      set({
        gameState: newState,
        selectedPieceId: prevSelectedId,
        validMoveHexes: stickyValid,
        tackleRiskHexes: [],
        lastMovedPieceId: null,
      });
      return;
    }

    // SNAPSHOT_DEFLECT: defending team's piece can move up to 2 hexes in one click (range mode).
    // BUG-09 gap closure (18.2-05): previously fell through to the generic computeMovementValidHexes
    // fallthrough below, which validateMove's WRONG_SLOT guard always rejects for this phase
    // (SNAPSHOT_DEFLECT never sets movementSlot) — forcing validMoveHexes to [] even when the
    // defender has pace remaining. This branch routes through the same computeResponseMoveValidHexes
    // helper selectPiece's SNAPSHOT_DEFLECT branch uses, keyed by SNAPSHOT_DEFLECT_CONFIG. The lock
    // check (WR-01 caveat) is done here by the caller — computeResponseMoveValidHexes does not
    // enforce lockedPieceIdField itself.
    if (newState.phase === 'SNAPSHOT_DEFLECT') {
      const lockedId = newState.snapDeflectMovedPieceId ?? null;
      const locked = lockedId !== null && lockedId !== prevSelectedId;
      const stickyValid = locked
        ? []
        : computeResponseMoveValidHexes(prevSelectedId, piece, newState, SNAPSHOT_DEFLECT_CONFIG);
      set({
        gameState: newState,
        selectedPieceId: prevSelectedId,
        validMoveHexes: stickyValid,
        tackleRiskHexes: [],
        lastMovedPieceId: null,
      });
      return;
    }

    // FREE_MOVE_ATTACK / FREE_MOVE_DEFENSE / GOAL_KICK_SETUP_GK / GOAL_KICK_SETUP_OPPONENT:
    // separate, parallel sticky-selection block — these phases have no single-piece lock
    // concept (multiple independently-eligible pieces), so they are not folded into the
    // HIGH_PASS_MOVE-style block above. phaseChanged (handled earlier) already clears selection
    // the moment FREE_MOVE_ATTACK transitions to FREE_MOVE_DEFENSE (or GOAL_KICK_SETUP_GK to
    // GOAL_KICK_SETUP_OPPONENT) or to the resume phase — each sub-phase starts fresh, no
    // carry-over selection across sub-phases (D-35). Valid-hex filter shared with selectPiece's
    // FREE_MOVE/goal-kick-reposition branches via computeFreeMoveValidHexes (SELECTOR-REVIEW.md
    // fix #3, Phase 32-05 D-06) — previously duplicated inline in both places. GOAL_KICK_SETUP_GK/
    // OPPONENT (GOALKICK-02, Plan 37-10) added alongside its FREE_MOVE_* analog, using the
    // goalKick*-prefixed pace-budget lookup.
    // CORNER_KICK_REPOSITION (CORNER-03) joins this block for within-stage stickiness — a
    // stage handoff is already caught above (cornerKickStageIndex feeds responseMoveStateChanged),
    // so reaching here means the same manager is still mid-round and the selection should
    // persist. Its destination set is computed by the same computeCornerRepositionValidHexes
    // helper selectPiece's CORNER_KICK_REPOSITION branch uses (Plan 38-29 Task 1), and its
    // stickiness gate is the same single-term activation lock (cornerKickActivatedIds
    // membership, no same-stage exemption).
    // PENALTY_KICK_SETUP_ATTACKING / PENALTY_KICK_SETUP_DEFENDING (PEN-02, Phase 39 Plan 05)
    // join this block for the identical reason FREE_MOVE_ATTACK/DEFENSE do: multiple
    // independently-eligible pieces, no single-piece lock concept. The ATTACKING -> DEFENDING
    // handoff is a distinct GamePhase value, already caught by phaseChanged above (mirrors
    // GOAL_KICK_SETUP_GK -> GOAL_KICK_SETUP_OPPONENT) — reaching here means the same manager is
    // still mid-window. Activation completion is already caught by the top-level
    // activationComplete check (movedPieceIds membership), so no re-check is needed here.
    // GK_BOX_ENTRY_MOVE (D-10) joins this block too — a single selectable piece (the GK), but
    // same "no numeric budget, re-derive neighbours every broadcast" shape as FREE_MOVE_*.
    // GK_DIVE_AT_FEET_TARGET (GKDIVE-02/GKDIVE-04, Plan 39-21) joins for the identical reason:
    // a single selectable piece (the diving GK) with no numeric budget, so any same-phase
    // rebroadcast (e.g. reconnect resync) must re-derive the highlighted set rather than clear
    // it, exactly like GK_BOX_ENTRY_MOVE's own sticky arm above.
    if (
      newState.phase === 'FREE_MOVE_ATTACK' ||
      newState.phase === 'FREE_MOVE_DEFENSE' ||
      newState.phase === 'GOAL_KICK_SETUP_GK' ||
      newState.phase === 'GOAL_KICK_SETUP_OPPONENT' ||
      newState.phase === 'CORNER_KICK_REPOSITION' ||
      newState.phase === 'PENALTY_KICK_SETUP_ATTACKING' ||
      newState.phase === 'PENALTY_KICK_SETUP_DEFENDING' ||
      newState.phase === 'GK_BOX_ENTRY_MOVE' ||
      newState.phase === 'GK_DIVE_AT_FEET_TARGET'
    ) {
      let stickyValid: HexCoord[];
      if (newState.phase === 'CORNER_KICK_REPOSITION') {
        const cornerKickActivated =
          newState.cornerKickActivatedIds?.includes(prevSelectedId) ?? false;
        if (cornerKickActivated) {
          stickyValid = [];
        } else {
          // side mirrors selectPiece's CORNER_KICK_REPOSITION derivation (actingTeam ===
          // cornerKickTeam -> attacking): when cornerKickTeam is unset, default to 'attacking'
          // (no exclusion filter), matching this block's pre-existing behaviour.
          const stickyCornerKickTeam = newState.cornerKickTeam ?? null;
          const stickySide: 'attacking' | 'defending' =
            stickyCornerKickTeam === null || piece.teamId === stickyCornerKickTeam
              ? 'attacking'
              : 'defending';
          stickyValid = computeCornerRepositionValidHexes(prevSelectedId, newState, stickySide);
        }
      } else if (
        newState.phase === 'PENALTY_KICK_SETUP_ATTACKING' ||
        newState.phase === 'PENALTY_KICK_SETUP_DEFENDING'
      ) {
        stickyValid = computePenaltyKickValidHexes(prevSelectedId, piece, newState);
      } else if (newState.phase === 'GK_BOX_ENTRY_MOVE') {
        stickyValid = computeFreeMoveValidHexes(prevSelectedId, piece, newState);
      } else if (newState.phase === 'GK_DIVE_AT_FEET_TARGET') {
        stickyValid = computeGkDiveAtFeetTargetHexes(newState);
      } else {
        const paceRemaining =
          newState.phase === 'GOAL_KICK_SETUP_GK' || newState.phase === 'GOAL_KICK_SETUP_OPPONENT'
            ? 6 - (newState.goalKickUsedPace?.[prevSelectedId] ?? 0)
            : 6 - (newState.freeMoveUsedPace?.[prevSelectedId] ?? 0);
        stickyValid =
          paceRemaining <= 0 ? [] : computeFreeMoveValidHexes(prevSelectedId, piece, newState);
      }
      set({
        gameState: newState,
        selectedPieceId: prevSelectedId,
        validMoveHexes: stickyValid,
        tackleRiskHexes: [],
        lastMovedPieceId: null,
      });
      return;
    }

    const { validMoveHexes: stickyValid, tackleRiskHexes: stickyTackle } =
      computeMovementValidHexes(piece, newState);
    set({
      gameState: newState,
      selectedPieceId: prevSelectedId,
      validMoveHexes: stickyValid,
      tackleRiskHexes: stickyTackle,
      lastMovedPieceId: null,
    });
  },

  setPlayerSlot: (slot) => set({ playerSlot: slot }),

  setRoomCode: (code) => set({ roomCode: code }),

  setDisconnectWarning: (v) => set({ disconnectWarning: v }),

  setRoomError: (msg) => set({ roomError: msg }),

  resetLobby: () =>
    set({
      screen: 'LANDING',
      roomCode: null,
      playerSlot: null,
      roomError: null,
      gameError: null,
      disconnectWarning: false,
      gameState: mockMovementState,
    }),

  setGameError: (msg) => set({ gameError: msg }),

  emitMove: (pieceId, to) => {
    socket.emit(ClientEvents.GAME_MOVE, pieceId, to);
    // Save pieceId so setGameState can restore selection when the server broadcast arrives (D-17).
    set({ selectedPieceId: null, validMoveHexes: [], lastMovedPieceId: pieceId });
  },

  emitRoll: (passType, targetHex) => {
    socket.emit(ClientEvents.GAME_ROLL, passType, targetHex);
  },

  emitEndTurn: () => {
    socket.emit(ClientEvents.GAME_END_TURN);
  },

  emitUndo: () => {
    socket.emit(ClientEvents.GAME_UNDO);
  },

  emitCancelMovement: () => {
    socket.emit(ClientEvents.GAME_CANCEL_MOVEMENT);
  },

  emitGKRestart: (choice) => {
    socket.emit(ClientEvents.GAME_GK_RESTART, choice);
  },

  emitStartMovement: () => {
    socket.emit(ClientEvents.GAME_START_MOVEMENT);
  },

  emitReady: () => {
    socket.emit(ClientEvents.GAME_READY);
  },

  emitKickOffMove: (pieceId, to) => {
    socket.emit(ClientEvents.GAME_KICK_OFF_MOVE, pieceId, to);
    set({ selectedPieceId: null, validMoveHexes: [] });
  },

  emitHalfTimeStart: () => {
    socket.emit(ClientEvents.GAME_HALF_TIME_START);
  },

  emitSnapshot: () => {
    socket.emit(ClientEvents.GAME_SNAPSHOT);
  },

  emitRestartMovement: () => {
    socket.emit(ClientEvents.GAME_RESTART_MOVEMENT);
  },

  emitDeclareShot: (goalHex) => {
    socket.emit(ClientEvents.GAME_SHOT, goalHex);
  },

  emitGKDive: (to) => {
    socket.emit(ClientEvents.GAME_GK_DIVE, to);
  },

  emitHeaderTarget: (targetHex) => {
    socket.emit(ClientEvents.GAME_HEADER_TARGET, targetHex);
  },

  setShootingMode: (on) => set({ shootingMode: on }),

  emitQuickThrow: (targetHex) => {
    socket.emit(ClientEvents.GAME_QUICK_THROW, targetHex);
  },

  emitGKKickTarget: (targetHex) => {
    socket.emit(ClientEvents.GAME_GK_KICK_TARGET, targetHex);
  },

  emitHeaderAccuracyAck: () => {
    socket.emit(ClientEvents.GAME_HEADER_ACCURACY_ACK);
  },

  emitFreeKickMove: (pieceId, to) => {
    socket.emit(ClientEvents.GAME_FREE_KICK_MOVE, pieceId, to);
    set({ selectedPieceId: null, validMoveHexes: [] });
  },

  emitFreeKickReady: () => {
    socket.emit(ClientEvents.GAME_FREE_KICK_READY);
  },

  emitThrowInPlace: (pieceId) => {
    socket.emit(ClientEvents.GAME_THROW_IN_PLACE, pieceId);
  },

  // GOALKICK-03: does not clear selectedPieceId (unlike emitFreeKickMove) — the server
  // broadcast drives the phase change and setGameState already handles selection lifecycle.
  emitGoalKickChoice: (choice) => {
    socket.emit(ClientEvents.GAME_GOAL_KICK_CHOICE, choice);
  },

  // GOALKICK-05: does not clear selectedPieceId — same rationale as emitGoalKickChoice above.
  emitGoalKickTarget: (targetHex) => {
    socket.emit(ClientEvents.GAME_GOAL_KICK_TARGET, targetHex);
  },

  // CORNER-01: mirrors emitFreeKickMove — clears selectedPieceId after emitting since the
  // GK placement is a one-shot action, not a multi-click budgeted reposition.
  emitCornerKickGkPlace: (pieceId, to) => {
    socket.emit(ClientEvents.GAME_CORNER_KICK_GK_PLACE, pieceId, to);
    set({ selectedPieceId: null, validMoveHexes: [] });
  },

  // CORNER-02: mirrors emitThrowInPlace — single pieceId argument, destination is
  // server-owned (cornerKickHex), never client-chosen.
  emitCornerKickTaker: (pieceId) => {
    socket.emit(ClientEvents.GAME_CORNER_KICK_TAKER, pieceId);
  },

  // FOUL-03 (D-01): fire-and-forget, no optimistic state mutation — the authoritative
  // GAME_STATE broadcast is the only writer.
  emitFoulChoice: (choice) => {
    socket.emit(ClientEvents.GAME_FOUL_CHOICE, choice);
  },

  // GKDIVE-02 (D-07): fire-and-forget, no optimistic state mutation.
  emitGkDiveAtFeet: (accept) => {
    socket.emit(ClientEvents.GAME_GK_DIVE_AT_FEET, accept);
  },

  // emitGkDiveAtFeetTarget (GKDIVE-02/GKDIVE-04, 39-UAT gap 3, Plan 39-21): mirrors
  // emitCornerKickGkPlace/emitGkBoxEntryMove's one-shot-action shape — clears
  // selectedPieceId/validMoveHexes optimistically since the destination click is the final
  // action of the target step.
  emitGkDiveAtFeetTarget: (to) => {
    socket.emit(ClientEvents.GAME_GK_DIVE_AT_FEET_TARGET, to);
    set({ selectedPieceId: null, validMoveHexes: [] });
  },

  // D-10: fire-and-forget, no optimistic state mutation.
  emitGkBoxEntryResponse: (accept) => {
    socket.emit(ClientEvents.GAME_GK_BOX_ENTRY_RESPONSE, accept);
  },

  // D-10: fire-and-forget, no optimistic state mutation.
  emitGkBoxEntryMove: (to) => {
    socket.emit(ClientEvents.GAME_GK_BOX_ENTRY_MOVE, to);
  },

  // PEN-02: fire-and-forget, no optimistic state mutation.
  emitPenaltyKickTaker: (pieceId) => {
    socket.emit(ClientEvents.GAME_PENALTY_KICK_TAKER, pieceId);
  },

  // SUB-02: fire-and-forget, no optimistic state mutation — a substitution happens inside a
  // modal and must not disturb pitch selection state (selectedPieceId/validMoveHexes untouched).
  emitSubstitution: (outPieceId, inPlayerId) => {
    socket.emit(ClientEvents.GAME_SUBSTITUTION, { outPieceId, inPlayerId });
  },

  // SUB-08: fire-and-forget, no optimistic state mutation — mirrors SUB-02's emitSubstitution;
  // a reposition happens inside a modal and must not disturb pitch selection state
  // (selectedPieceId/validMoveHexes untouched).
  emitRosterReposition: (pieceIdA, pieceIdB) => {
    socket.emit(ClientEvents.GAME_ROSTER_REPOSITION, { pieceIdA, pieceIdB });
  },
}));
