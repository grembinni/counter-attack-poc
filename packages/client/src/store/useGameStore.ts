import { create } from 'zustand';
import type { GameState, HexCoord } from '@counter-attack/shared';
import { validateMove, hexesInRange, ClientEvents } from '@counter-attack/shared';
import { mockMovementState } from '../mock/index.js';
import { socket } from '../socket.js';

/** Screen states for client-side routing (D-12). No React Router — screen field in store. */
export type Screen = 'CREATE_ROOM' | 'JOIN_ROOM' | 'WAITING' | 'GAME_BOARD';

/** Zustand store shape for the Counter Attack game client. */
export type GameStore = {
  gameState: GameState;
  screen: Screen;
  selectedPieceId: string | null;
  validMoveHexes: HexCoord[];
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
  /** Navigate to a different screen (D-12). */
  setScreen: (s: Screen) => void;
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
  /** Emit game:roll to the server (dice resolution: pass accuracy, shot duel, loose ball). */
  emitRoll: () => void;
  /** Emit game:end-turn to end the current movement phase. */
  emitEndTurn: () => void;
  /** Emit game:undo to request an undo of the last movement action (UNDO-01). */
  emitUndo: () => void;
  /** Emit game:gk-restart with the GK's choice after a save catch (D-22, Phase 5). */
  emitGKRestart: (choice: 'kick' | 'throw' | 'movement') => void;
  /** Emit game:start-movement to transition from KICK_OFF to MOVEMENT (D-01, Phase 4). */
  emitStartMovement: () => void;
};

/**
 * Zustand 4.x store using curried TypeScript form: create<T>()((set, get) => ...).
 * Required for correct TypeScript type inference in Zustand 4 (Pitfall 1 from RESEARCH.md).
 * Initial state uses mockMovementState (D-10, D-11).
 */
export const useGameStore = create<GameStore>()((set, get) => ({
  gameState: mockMovementState,
  screen: 'CREATE_ROOM',
  selectedPieceId: null,
  validMoveHexes: [],
  playerSlot: null,
  roomCode: null,
  disconnectWarning: false,
  roomError: null,
  gameError: null,

  setScreen: (s) => set({ screen: s }),

  selectPiece: (id) => {
    const { gameState, selectedPieceId } = get();
    // Toggle off if the same piece is clicked again
    if (selectedPieceId === id) {
      set({ selectedPieceId: null, validMoveHexes: [] });
      return;
    }
    const piece = gameState.pieces.find((p) => p.id === id);
    if (!piece) return;
    // Use hexesInRange to limit candidates — never iterate all 962 PITCH_HEXES (D-07, Pitfall 7)
    const candidates = hexesInRange(piece.position, piece.pace);
    const valid = candidates.filter((hex) => validateMove(gameState, piece, hex).ok);
    set({ selectedPieceId: id, validMoveHexes: valid });
  },

  inspectPiece: (id) => {
    set({ selectedPieceId: id, validMoveHexes: [] });
  },

  setGameState: (state) => set({ gameState: state }),

  setPlayerSlot: (slot) => set({ playerSlot: slot }),

  setRoomCode: (code) => set({ roomCode: code }),

  setDisconnectWarning: (v) => set({ disconnectWarning: v }),

  setRoomError: (msg) => set({ roomError: msg }),

  setGameError: (msg) => set({ gameError: msg }),

  emitMove: (pieceId, to) => {
    socket.emit(ClientEvents.GAME_MOVE, pieceId, to);
    set({ selectedPieceId: null, validMoveHexes: [] });
  },

  emitRoll: () => {
    socket.emit(ClientEvents.GAME_ROLL);
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
}));
