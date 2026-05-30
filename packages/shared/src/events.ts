import type { HexCoord, GameState } from './types.js';

// Typed const objects for Socket.io event names (not TypeScript enums — enums compile
// to IIFEs and don't tree-shake cleanly; const objects emit nothing at runtime).
// Source: socket.io/docs/v4/typescript/

export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  GAME_MOVE: 'game:move',
  GAME_ROLL: 'game:roll',
  GAME_GK_RESTART: 'game:gk-restart',
  GAME_END_TURN: 'game:end-turn',
  GAME_UNDO: 'game:undo',
  GAME_START_MOVEMENT: 'game:start-movement',
} as const;

export const ServerEvents = {
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
  GAME_STATE: 'game:state',
  GAME_DISCONNECT_WARNING: 'game:disconnect-warning',
  GAME_ERROR: 'game:error',
} as const;

/**
 * Typed event map for client-to-server events.
 * Consumed by Server<ClientToServerEvents, ...> in packages/server (Phase 3).
 */
export interface ClientToServerEvents {
  [ClientEvents.ROOM_CREATE]: () => void;
  [ClientEvents.ROOM_JOIN]: (roomCode: string) => void;
  /** RESEARCH OQ-1: pieceId removes adjacency ambiguity vs. from-coord approach. */
  [ClientEvents.GAME_MOVE]: (pieceId: string, to: HexCoord) => void;
  [ClientEvents.GAME_ROLL]: () => void;
  /** D-22 (Phase 5): GK restart choice after a save catch. Payload validated server-side. */
  [ClientEvents.GAME_GK_RESTART]: (choice: 'kick' | 'throw' | 'movement') => void;
  [ClientEvents.GAME_END_TURN]: () => void;
  [ClientEvents.GAME_UNDO]: () => void;
  /** Wire path for FSM KICK_OFF → MOVEMENT transition. D-01, 04-02/T1. */
  [ClientEvents.GAME_START_MOVEMENT]: () => void;
}

/**
 * Typed event map for server-to-client events.
 * Consumed by Socket<ServerToClientEvents, ...> in packages/client (Phase 3).
 */
export interface ServerToClientEvents {
  [ServerEvents.ROOM_JOINED]: (roomCode: string, playerSlot: 1 | 2, sessionToken: string) => void;
  [ServerEvents.ROOM_ERROR]: (message: string) => void;
  [ServerEvents.GAME_STATE]: (state: GameState) => void;
  [ServerEvents.GAME_DISCONNECT_WARNING]: () => void;
  /** D-06: Server rejection with typed reason string. Client snaps back on receipt. */
  [ServerEvents.GAME_ERROR]: (reason: string) => void;
}

/** Inter-server events (unused in single-instance POC, required for type param). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {}

/**
 * Per-socket data stored by Socket.io.
 * All fields are optional: brand-new sockets connecting through io.use() middleware
 * have none of these set yet. The session middleware populates sessionToken first;
 * playerSlot and roomCode are set when the socket joins a room.
 */
export interface SocketData {
  playerSlot?: 1 | 2;
  roomCode?: string;
  sessionToken?: string;
}
