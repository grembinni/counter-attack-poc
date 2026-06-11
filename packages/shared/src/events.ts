import type { HexCoord, GameState } from './types.js';

// Typed const objects for Socket.io event names (not TypeScript enums — enums compile
// to IIFEs and don't tree-shake cleanly; const objects emit nothing at runtime).
// Source: socket.io/docs/v4/typescript/

export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  GAME_MOVE: 'game:move',
  GAME_ROLL: 'game:roll',
  /** D-06: client emits the SHOT target coord; server records it for UX/broadcast — duel still resolves from dice via game:roll. */
  GAME_SHOT: 'game:shot',
  GAME_GK_RESTART: 'game:gk-restart',
  GAME_END_TURN: 'game:end-turn',
  GAME_UNDO: 'game:undo',
  GAME_START_MOVEMENT: 'game:start-movement',
  /** D-24: kick-off setup confirmation — both teams click Ready before KICK_OFF_SETUP → KICK_OFF. */
  GAME_READY: 'game:ready',
  /**
   * Phase 8 / Research OQ-2 / Pitfall 2: piece repositioning during KICK_OFF_SETUP.
   * Distinct from game:move (movement phase) — no pace limits, no ZoI enforcement.
   */
  GAME_KICK_OFF_MOVE: 'game:kick-off-move',
  /** D-28: trigger transition from HALF_TIME to 2nd-half KICK_OFF_SETUP. */
  GAME_HALF_TIME_START: 'game:half-time-start',
  /** Phase 8 / D-18: declare a Snapshot when ball carrier is in penalty area or post-pass. */
  GAME_SNAPSHOT: 'game:snapshot',
  /** Phase 8 / D-17: resolve a Header while phase === 'HEADER'. */
  GAME_HEADER: 'game:header',
  /** Restart the movement phase from ATTACKER_4 — resets movedPieceIds and pace tracking. */
  GAME_RESTART_MOVEMENT: 'game:restart-movement',
  /**
   * D-17 (Phase 8.2): Client selects their header contestant piece during HEADER phase.
   * Payload: pieceId string (the selected piece), or null to deselect.
   */
  GAME_HEADER_CONTESTANT: 'game:header-contestant',
  /** Phase 10: GK repositions during GK_DIVING phase (up to 3 hexes parallel to goal line). */
  GAME_GK_DIVE: 'game:gk-dive',
  /** Phase 10: Attacker selects target hex during HEADER phase (HEAD-03). */
  GAME_HEADER_TARGET: 'game:header-target',
  /** GK selects the target hex for a quick throw (unblockable, uninterceptable standard pass). */
  GAME_QUICK_THROW: 'game:quick-throw',
  /** GK kick: GK's team selects the target hex for the kick (not into opponent's final third). */
  GAME_GK_KICK_TARGET: 'game:gk-kick-target',
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
  /**
   * Optional pass type sent when rolling in PASS phase — server validates eligibility and sets lastActionType.
   * D-10 (Phase 8.2): targetHex carries the destination hex for High/Long pass accuracy resolution.
   */
  [ClientEvents.GAME_ROLL]: (
    passType?: 'STANDARD_PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_BALL',
    targetHex?: HexCoord,
  ) => void;
  /** D-06: client emits the SHOT target coord; server records it for UX/broadcast — duel still resolves from dice via game:roll. */
  [ClientEvents.GAME_SHOT]: (targetHex: HexCoord) => void;
  /** D-22 (Phase 5): GK restart choice after a save catch. Payload validated server-side. */
  [ClientEvents.GAME_GK_RESTART]: (choice: 'kick' | 'throw' | 'movement') => void;
  [ClientEvents.GAME_END_TURN]: () => void;
  [ClientEvents.GAME_UNDO]: () => void;
  /** Wire path for FSM KICK_OFF → MOVEMENT transition. D-01, 04-02/T1. */
  [ClientEvents.GAME_START_MOVEMENT]: () => void;
  /** D-24: Ready confirmation during KICK_OFF_SETUP; server transitions when both teams confirm. */
  [ClientEvents.GAME_READY]: () => void;
  /** Phase 8: reposition a piece during KICK_OFF_SETUP (no pace limits, no ZoI). */
  [ClientEvents.GAME_KICK_OFF_MOVE]: (pieceId: string, to: HexCoord) => void;
  /** D-28: trigger 2nd half; only available to the team that did NOT kick off in the 1st half. */
  [ClientEvents.GAME_HALF_TIME_START]: () => void;
  /** Phase 8 / D-18: Snapshot declaration — ball carrier in penalty area or post-pass. */
  [ClientEvents.GAME_SNAPSHOT]: () => void;
  /** Phase 8 / D-17: Header declaration — resolve header while phase === 'HEADER'. */
  [ClientEvents.GAME_HEADER]: () => void;
  /** Restart movement phase from ATTACKER_4 — clears movedPieceIds and pace tracking. */
  [ClientEvents.GAME_RESTART_MOVEMENT]: () => void;
  /**
   * D-17 (Phase 8.2): Client confirms their header contestant selection.
   * pieceIds: array of selected piece IDs (multiple allowed); empty array or null = decline.
   * Server validates piece ownership (all pieces must belong to socket's team).
   */
  [ClientEvents.GAME_HEADER_CONTESTANT]: (pieceIds: string[] | null) => void;
  /** Phase 10: GK dive hex during GK_DIVING phase. */
  [ClientEvents.GAME_GK_DIVE]: (to: HexCoord) => void;
  /** Phase 10: Header target hex selection during HEADER phase (HEAD-03). */
  [ClientEvents.GAME_HEADER_TARGET]: (targetHex: HexCoord) => void;
  /** GK quick throw target hex — unblockable, uninterceptable delivery. */
  [ClientEvents.GAME_QUICK_THROW]: (targetHex: HexCoord) => void;
  /** GK kick target hex — not into opponent's final third; triggers GK_KICK_MOVEMENT repositioning. */
  [ClientEvents.GAME_GK_KICK_TARGET]: (targetHex: HexCoord) => void;
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
