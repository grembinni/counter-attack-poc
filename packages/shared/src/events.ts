import type { HexCoord, GameState } from './types.js';

// Typed const objects for Socket.io event names (not TypeScript enums — enums compile
// to IIFEs and don't tree-shake cleanly; const objects emit nothing at runtime).
// Source: socket.io/docs/v4/typescript/

export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  GAME_MOVE: 'game:move',
  GAME_ROLL: 'game:roll',
} as const;

export const ServerEvents = {
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
  GAME_STATE: 'game:state',
  GAME_DISCONNECT_WARNING: 'game:disconnect-warning',
} as const;

/**
 * Typed event map for client-to-server events.
 * Consumed by Server<ClientToServerEvents, ...> in packages/server (Phase 3).
 */
export interface ClientToServerEvents {
  [ClientEvents.ROOM_CREATE]: () => void;
  [ClientEvents.ROOM_JOIN]: (roomCode: string) => void;
  [ClientEvents.GAME_MOVE]: (from: HexCoord, to: HexCoord) => void;
  [ClientEvents.GAME_ROLL]: () => void;
}

/**
 * Typed event map for server-to-client events.
 * Consumed by Socket<ServerToClientEvents, ...> in packages/client (Phase 3).
 */
export interface ServerToClientEvents {
  [ServerEvents.ROOM_JOINED]: (roomCode: string, playerSlot: 1 | 2) => void;
  [ServerEvents.ROOM_ERROR]: (message: string) => void;
  [ServerEvents.GAME_STATE]: (state: GameState) => void;
  [ServerEvents.GAME_DISCONNECT_WARNING]: () => void;
}

/** Inter-server events (unused in single-instance POC, required for type param). */
export interface InterServerEvents {}

/** Per-socket data stored by Socket.io (player slot, room code, etc.). */
export interface SocketData {
  playerSlot: 1 | 2;
  roomCode: string;
}
