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
  | 'GAME_BOARD'
  | 'HALF_TIME' // Phase 8: shown when GameState.phase === 'HALF_TIME'
  | 'FULL_TIME' // Phase 8: shown when GameState.phase === 'FULL_TIME'
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
  /** Phase 8 / D-17: Emit game:header — resolve a Header while phase === 'HEADER'. */
  emitHeader: () => void;
  /** Restart the movement phase from ATTACKER_4 — resets movedPieceIds and pace tracking. */
  emitRestartMovement: () => void;
};

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

    // HIGH_PASS_MOVEMENT: 1 piece per team, up to 3 hexes, any direction
    if (gameState.phase === 'HIGH_PASS_MOVEMENT') {
      const myTeam = playerSlot === 1 ? 'home' : 'away';
      // Only own team pieces can be selected
      if (piece.teamId !== myTeam) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      // If a different piece is already locked in for this slot, reject selection
      const lockedId = gameState.highPassMovedPieceId ?? null;
      if (lockedId !== null && lockedId !== id) {
        set({ selectedPieceId: null, validMoveHexes: [] });
        return;
      }
      const paceRemaining = 3 - (gameState.highPassPaceUsed ?? 0);
      if (paceRemaining <= 0) {
        set({ selectedPieceId: id, validMoveHexes: [] });
        return;
      }
      // Valid destinations: adjacent hexes on pitch not occupied by another piece
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

    // Normal MOVEMENT phase: show only adjacent hexes (step-by-step, D-07)
    const candidates = hexesInRange(piece.position, 1);
    const validResults = candidates.map((hex) => ({
      hex,
      result: validateMove(gameState, piece, hex),
    }));
    const valid = validResults.filter(({ result }) => result.ok).map(({ hex }) => hex);
    const tackle = validResults
      .filter(
        ({ result }) => result.ok && 'effect' in result && result.effect.type === 'TACKLE_ATTEMPT',
      )
      .map(({ hex }) => hex);
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
    const slotChanged = newState.movementSlot !== prevState.movementSlot;
    const phaseChanged = newState.phase !== prevState.phase;
    const pieceStillExists =
      prevSelectedId !== null && newState.pieces.some((p) => p.id === prevSelectedId);
    // After a multi-hex activation the piece is in movedPieceIds — deselect, activation complete
    const activationComplete =
      prevSelectedId !== null && newState.movedPieceIds.includes(prevSelectedId);

    if (
      slotChanged ||
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
      });
      return;
    }

    // Sticky selection: recompute adjacent hexes for next step (D-17, D-19)
    const piece = newState.pieces.find((p) => p.id === prevSelectedId)!;

    // HIGH_PASS_MOVEMENT: re-run phase-specific valid move logic (validateMove is MOVEMENT-only)
    if (newState.phase === 'HIGH_PASS_MOVEMENT') {
      const paceRemaining = 3 - (newState.highPassPaceUsed ?? 0);
      const lockedId = newState.highPassMovedPieceId ?? null;
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

    const stickyResults = hexesInRange(piece.position, 1).map((hex) => ({
      hex,
      result: validateMove(newState, piece, hex),
    }));
    const stickyValid = stickyResults.filter(({ result }) => result.ok).map(({ hex }) => hex);
    const stickyTackle = stickyResults
      .filter(
        ({ result }) => result.ok && 'effect' in result && result.effect.type === 'TACKLE_ATTEMPT',
      )
      .map(({ hex }) => hex);
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

  emitHeader: () => {
    socket.emit(ClientEvents.GAME_HEADER);
  },

  emitRestartMovement: () => {
    socket.emit(ClientEvents.GAME_RESTART_MOVEMENT);
  },
}));
