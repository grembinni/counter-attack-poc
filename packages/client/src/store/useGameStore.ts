import { create } from 'zustand';
import type { GameSpeed, GameState, HexCoord } from '@counter-attack/shared';
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
} from '@counter-attack/shared';
import { mockMovementState } from '../mock/index.js';
import { socket } from '../socket.js';

/** Pass type used for store and ActionPanel three-step flow (matches server event signature). */
export type PassType = 'STANDARD_PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_BALL';

/** Screen states for client-side routing (D-12). No React Router — screen field in store. */
export type Screen =
  | 'LANDING'
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'WAITING'
  | 'TEAM_SELECTION' // Phase 16 D-10: team selection screen before game board
  | 'UNIFORM_SELECTION' // Phase 22: combined team + style pre-game screen (D-01)
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
  /** Phase 10: goal hex selected by shooter before emit. */
  shootTargetHex: HexCoord | null;
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
  /**
   * UX-07 (Phase 18.4): home player emits chosen game speed (before match start).
   * Emits TEAM_SPEED_SET event with the selected speed value.
   */
  emitTeamSpeed: (speed: GameSpeed) => void;
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
    | 'snapDeflectMovedPieceId';
  /** GameState field tracking cumulative hexes moved this slot. */
  paceUsedField:
    | 'highPassPaceUsed'
    | 'gkKickPaceUsed'
    | 'firstTimePassPaceUsed'
    | 'snapDeflectPaceUsed';
  /** Maximum hexes (pace) allowed this slot. */
  paceCap: number;
  /**
   * 'strict-1': only adjacent hexes are valid (HIGH_PASS_MOVE, GK_KICK_MOVE, FIRST_TIME_PASS_MOVE).
   * 'range': any hex within the remaining pace budget is a valid single-click destination (SNAPSHOT_DEFLECT).
   */
  clickDistanceMode: 'strict-1' | 'range';
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
  shootTargetHex: null,

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

    const validTargets: HexCoord[] = [];
    const interceptionRisk: HexCoord[] = [];

    for (const hex of PITCH_HEXES) {
      const result = validatePass(gameState, carrier, carrier.position, hex, vpType);
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
      const myTeam = playerSlot === 1 ? 'home' : 'away';
      const isAttacking = myTeam === gameState.attackingTeam;
      const kickOffHex = PITCH_REGIONS.kickOffHex;
      const valid = PITCH_HEXES.filter((hex) => {
        // Exclude the hex currently occupied by another own piece (can't stack)
        if (
          gameState.pieces.some(
            (p) =>
              p.id !== id &&
              p.teamId === myTeam &&
              p.position.q === hex.q &&
              p.position.r === hex.r,
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
      const myTeam = playerSlot === 1 ? 'home' : 'away';
      const stageIndex = gameState.freeKickStageIndex;
      const kickingTeam = gameState.freeKickAttackingTeam;
      if (
        piece.teamId !== myTeam ||
        stageIndex === null ||
        stageIndex === undefined ||
        !kickingTeam
      ) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const activeTeamForStage = freeKickStageTeam(stageIndex, kickingTeam);
      if (myTeam !== activeTeamForStage) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const isKickingTeam = myTeam === kickingTeam;
      const freeKickHex = gameState.freeKickHex;
      const valid = PITCH_HEXES.filter((hex) => {
        // Exclude hexes occupied by another own piece (can't stack)
        if (
          gameState.pieces.some(
            (p) =>
              p.id !== id &&
              p.teamId === myTeam &&
              p.position.q === hex.q &&
              p.position.r === hex.r,
          )
        )
          return false;
        // D-29: kicking team's stages have no further restriction.
        if (isKickingTeam || !freeKickHex) return true;
        // D-30: defending team's stages must stay >2 hexes from freeKickHex.
        if (hexDistance(hex, freeKickHex) <= 2) return false;
        return true;
      });
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // HIGH_PASS_MOVE: 1 piece per team, up to 3 hexes, any direction
    if (gameState.phase === 'HIGH_PASS_MOVE') {
      const myTeam = playerSlot === 1 ? 'home' : 'away';
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
      const valid = computeResponseMoveValidHexes(id, piece, gameState, {
        lockedPieceIdField: 'highPassMovedPieceId',
        paceUsedField: 'highPassPaceUsed',
        paceCap: 3,
        clickDistanceMode: 'strict-1',
      });
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // FREE_MOVE_ATTACK / FREE_MOVE_DEFENSE (Phase 17 MOVE-06, corrected design): any number of
    // eligible pieces (both teams precomputed at trigger time) may each move up to 6 hexes
    // independently — no single-piece lock like HIGH_PASS_MOVE.
    if (gameState.phase === 'FREE_MOVE_ATTACK' || gameState.phase === 'FREE_MOVE_DEFENSE') {
      const myTeam = playerSlot === 1 ? 'home' : 'away';
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
      const valid = hexesInRange(piece.position, 1).filter((hex) => {
        if (!PITCH_HEXES.some((h) => h.q === hex.q && h.r === hex.r)) return false;
        if (
          gameState.pieces.some(
            (p) => p.id !== id && p.position.q === hex.q && p.position.r === hex.r,
          )
        )
          return false;
        return hexDistance(piece.position, hex) === 1;
      });
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // FIRST_TIME_PASS_MOVE: 1 piece per team, up to 1 hex, any direction (D-03, CR-01-new)
    // Mirrors HIGH_PASS_MOVE structurally but pace cap is 1 (not 3) and uses the
    // firstTimePass* slot fields. Does NOT call validateMove — that fn's WRONG_SLOT guard
    // fires for this phase (movementSlot stays null here; position is tracked via
    // firstTimePassMovementSlot instead), which was the CR-01-new root cause.
    if (gameState.phase === 'FIRST_TIME_PASS_MOVE') {
      const myTeam = playerSlot === 1 ? 'home' : 'away';
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
      const valid = computeResponseMoveValidHexes(id, piece, gameState, {
        lockedPieceIdField: 'firstTimePassMovedPieceId',
        paceUsedField: 'firstTimePassPaceUsed',
        paceCap: 1,
        clickDistanceMode: 'strict-1',
      });
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // GK_KICK_MOVE: both teams reposition 1 piece up to 3 hexes while kick is in air
    if (gameState.phase === 'GK_KICK_MOVE') {
      const myTeam = playerSlot === 1 ? 'home' : 'away';
      if (piece.teamId !== myTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const lockedId = gameState.gkKickMovedPieceId ?? null;
      if (lockedId !== null && lockedId !== id) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const valid = computeResponseMoveValidHexes(id, piece, gameState, {
        lockedPieceIdField: 'gkKickMovedPieceId',
        paceUsedField: 'gkKickPaceUsed',
        paceCap: 3,
        clickDistanceMode: 'strict-1',
      });
      set({ selectedPieceId: id, validMoveHexes: valid });
      return;
    }

    // SNAPSHOT_DEFLECT: defending team moves 1 piece up to 2 hexes
    if (gameState.phase === 'SNAPSHOT_DEFLECT') {
      const myTeam = playerSlot === 1 ? 'home' : 'away';
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
      const valid = computeResponseMoveValidHexes(id, piece, gameState, {
        lockedPieceIdField: 'snapDeflectMovedPieceId',
        paceUsedField: 'snapDeflectPaceUsed',
        paceCap: 2,
        clickDistanceMode: 'range',
      });
      set({ selectedPieceId: id, validMoveHexes: valid });
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
    const responseMoveStateChanged =
      newState.movementSlot !== prevState.movementSlot ||
      newState.firstTimePassMovementSlot !== prevState.firstTimePassMovementSlot ||
      newState.highPassMovementSlot !== prevState.highPassMovementSlot ||
      newState.gkKickMovementSlot !== prevState.gkKickMovementSlot;
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
        // Phase 8.2: clear pass target and header contestant slices on phase change
        selectedPassType: null,
        validPassTargetHexes: [],
        interceptionRiskHexes: [],
        passTargetHex: null,
        headerContestantIds: [],
        // Phase 10: clear shooting mode on new server broadcast
        shootingMode: false,
        shootTargetHex: null,
        // Bug 1: stale GAME_ERROR from a prior action must not bleed into the new phase/slot
        gameError: null,
      });
      return;
    }

    // Sticky selection: recompute adjacent hexes for next step (D-17, D-19)
    const piece = newState.pieces.find((p) => p.id === prevSelectedId)!;

    // HIGH_PASS_MOVE / GK_KICK_MOVE / FIRST_TIME_PASS_MOVE: re-run phase-specific valid move logic
    if (
      newState.phase === 'HIGH_PASS_MOVE' ||
      newState.phase === 'GK_KICK_MOVE' ||
      newState.phase === 'FIRST_TIME_PASS_MOVE'
    ) {
      const paceRemaining =
        newState.phase === 'GK_KICK_MOVE'
          ? 3 - (newState.gkKickPaceUsed ?? 0)
          : newState.phase === 'FIRST_TIME_PASS_MOVE'
            ? 1 - (newState.firstTimePassPaceUsed ?? 0)
            : 3 - (newState.highPassPaceUsed ?? 0);
      const lockedId =
        newState.phase === 'GK_KICK_MOVE'
          ? (newState.gkKickMovedPieceId ?? null)
          : newState.phase === 'FIRST_TIME_PASS_MOVE'
            ? (newState.firstTimePassMovedPieceId ?? null)
            : (newState.highPassMovedPieceId ?? null);
      const locked = lockedId !== null && lockedId !== prevSelectedId;
      const stickyValid =
        locked || paceRemaining <= 0
          ? []
          : hexesInRange(piece.position, 1).filter((hex) => {
              if (!PITCH_HEXES.some((h) => h.q === hex.q && h.r === hex.r)) return false;
              if (
                newState.pieces.some(
                  (p) =>
                    p.id !== prevSelectedId && p.position.q === hex.q && p.position.r === hex.r,
                )
              )
                return false;
              return hexDistance(piece.position, hex) === 1;
            });
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
    // helper selectPiece's SNAPSHOT_DEFLECT branch uses (lines 615-620), keyed by snapDeflectMovedPieceId
    // / snapDeflectPaceUsed / paceCap 2 / clickDistanceMode 'range'. The lock check (WR-01 caveat) is
    // done here by the caller — computeResponseMoveValidHexes does not enforce lockedPieceIdField itself.
    if (newState.phase === 'SNAPSHOT_DEFLECT') {
      const lockedId = newState.snapDeflectMovedPieceId ?? null;
      const locked = lockedId !== null && lockedId !== prevSelectedId;
      const stickyValid = locked
        ? []
        : computeResponseMoveValidHexes(prevSelectedId, piece, newState, {
            lockedPieceIdField: 'snapDeflectMovedPieceId',
            paceUsedField: 'snapDeflectPaceUsed',
            paceCap: 2,
            clickDistanceMode: 'range',
          });
      set({
        gameState: newState,
        selectedPieceId: prevSelectedId,
        validMoveHexes: stickyValid,
        tackleRiskHexes: [],
        lastMovedPieceId: null,
      });
      return;
    }

    // FREE_MOVE_ATTACK / FREE_MOVE_DEFENSE: separate, parallel sticky-selection block — FREE_MOVE
    // has no single-piece lock concept (multiple independently-eligible pieces), so it is not
    // folded into the HIGH_PASS_MOVE-style block above. phaseChanged (handled earlier) already
    // clears selection the moment FREE_MOVE_ATTACK transitions to FREE_MOVE_DEFENSE or to the
    // resume phase — each sub-phase starts fresh, no carry-over selection across sub-phases (D-35).
    if (newState.phase === 'FREE_MOVE_ATTACK' || newState.phase === 'FREE_MOVE_DEFENSE') {
      const paceRemaining = 6 - (newState.freeMoveUsedPace?.[prevSelectedId] ?? 0);
      const stickyValid =
        paceRemaining <= 0
          ? []
          : hexesInRange(piece.position, 1).filter((hex) => {
              if (!PITCH_HEXES.some((h) => h.q === hex.q && h.r === hex.r)) return false;
              if (
                newState.pieces.some(
                  (p) =>
                    p.id !== prevSelectedId && p.position.q === hex.q && p.position.r === hex.r,
                )
              )
                return false;
              return hexDistance(piece.position, hex) === 1;
            });
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

  setShootingMode: (on) => set({ shootingMode: on, shootTargetHex: null }),

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

  emitTeamSpeed: (speed) => {
    // UX-07 (Phase 18.4): home player emits chosen game speed before match start.
    socket.emit(ClientEvents.TEAM_SPEED_SET, speed);
  },
}));
