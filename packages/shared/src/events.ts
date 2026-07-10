import type { HexCoord, GameState, GameSpeed } from './types.js';
import type { TeamId } from './teamConfig.js';
import type { UniformStyleId } from './uniformStyles.js';
import type { FormationId } from './formations.js';

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
  /** Phase 17 BUG-02: cancels MOVEMENT phase before any piece has moved. */
  GAME_CANCEL_MOVEMENT: 'game:cancel_movement',
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
  /**
   * RULE-01 (Phase 11): attacker acknowledges the high-pass accuracy roll result before
   * contestant selection UI is shown. Zero-argument event — clears headerAccuracyRollPending.
   */
  GAME_HEADER_ACCURACY_ACK: 'game:header-accuracy-ack',
  /** Phase 16 D-11: client emits chosen TeamId during team selection phase. */
  TEAM_PICK: 'team:pick',
  /**
   * UX-07 (Phase 18.4): home player emits their chosen game speed before match start.
   * Payload: 'slow' | 'standard' | 'fast'. Server validates against allow-list.
   */
  TEAM_SPEED_SET: 'team:speed-set',
  /**
   * OFFSIDE-02 (Phase 17 D-29): piece repositioning during FREE_KICK_SETUP.
   * Mirrors GAME_KICK_OFF_MOVE — no pace limits, no ZoI enforcement.
   */
  GAME_FREE_KICK_MOVE: 'game:free-kick-move',
  /** OFFSIDE-02 (Phase 17 D-29): both-teams ready confirmation during FREE_KICK_SETUP. */
  GAME_FREE_KICK_READY: 'game:free-kick-ready',
  /** Phase 22 D-14: client emits team + uniform style confirmation during uniform selection phase. */
  UNIFORM_CONFIRM: 'uniform:confirm',
  /**
   * Phase 24 D-08: swap two outfield slot indices before confirming lineup.
   * Payload: `{ slotIndexA, slotIndexB }` — both must be non-zero (GK slot is immovable per D-09).
   * Server validates and responds with LINEUP_ASSIGNMENT_UPDATED to the requesting socket only.
   */
  LINEUP_SWAP: 'lineup:swap',
  /**
   * Phase 24 D-10: confirm current assignment ordering to lock in the lineup.
   * Payload: `{ confirmedOrder: PlayerId[] }` — server uses stored room assignment (ASVS V5 tamper-prevention).
   * After both players confirm, server calls buildInitialGameState and emits GAME_STATE.
   */
  LINEUP_CONFIRM: 'lineup:confirm',
} as const;

export const ServerEvents = {
  ROOM_JOINED: 'room:joined',
  ROOM_ERROR: 'room:error',
  GAME_STATE: 'game:state',
  GAME_DISCONNECT_WARNING: 'game:disconnect-warning',
  GAME_ERROR: 'game:error',
  /** Phase 16 D-10: emitted to both players when slot-2 joins; signals team selection phase start. */
  TEAM_SELECTION_START: 'team:selection-start',
  /** Phase 16 D-11: emitted to both players when home player picks a team. */
  TEAM_HOME_PICKED: 'team:home-picked',
  /** UX-07: emitted to both players when home player changes game speed during team selection. */
  TEAM_SPEED_CHANGED: 'team:speed-changed',
  /** Phase 22 D-13: emitted to both players when away team picks; signals uniform selection phase start. */
  UNIFORM_SELECTION_START: 'uniform:selection-start',
  /** Phase 22 D-15: broadcast to all room members after home confirms their team + uniform style. */
  UNIFORM_HOME_CONFIRMED: 'uniform:home-confirmed',
  /**
   * Phase 23 D-12: broadcast to both players after away confirms formation; carries both confirmed FormationIds.
   * buildInitialGameState is NOT called here — Phase 24 owns lineup assignment.
   */
  BOTH_FORMATIONS_CONFIRMED: 'formation:both-confirmed',
  /**
   * Phase 24 D-07: sent to individual player socket with their team's auto-assignment.
   * Payload: `assignment` is a `PlayerId[]` of 11 entries where index i maps to
   * `FORMATIONS[formationId].slots[i]` (D-06). Emitted per-socket, not broadcast.
   */
  LINEUP_ASSIGNMENT_READY: 'lineup:assignment-ready',
  /**
   * Phase 24 D-12: sent to the requesting socket after a validated LINEUP_SWAP.
   * Payload: updated `PlayerId[]` of 11 entries reflecting the post-swap assignment.
   * Emitted to the requester only (not broadcast) to preserve lineup privacy.
   */
  LINEUP_ASSIGNMENT_UPDATED: 'lineup:assignment-updated',
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
  /** Phase 17 BUG-02: revert MOVEMENT phase → PASS. Guard: paceUsedByPieceId must be empty. */
  [ClientEvents.GAME_CANCEL_MOVEMENT]: () => void;
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
  /**
   * RULE-01 (Phase 11): attacker acknowledges the high-pass accuracy roll result.
   * Zero-argument acknowledgment — clears headerAccuracyRollPending flag on the server.
   */
  [ClientEvents.GAME_HEADER_ACCURACY_ACK]: () => void;
  /** Phase 16 D-11: client selects a team during team selection phase. Validated server-side. */
  [ClientEvents.TEAM_PICK]: (teamId: TeamId) => void;
  /** UX-07 (Phase 18.4): home player sets the game speed before match start. Validated server-side. */
  [ClientEvents.TEAM_SPEED_SET]: (speed: GameSpeed) => void;
  /** OFFSIDE-02 (Phase 17 D-29): reposition a piece during FREE_KICK_SETUP (no pace limits, no ZoI). */
  [ClientEvents.GAME_FREE_KICK_MOVE]: (pieceId: string, to: HexCoord) => void;
  /** OFFSIDE-02 (Phase 17 D-29): Ready confirmation during FREE_KICK_SETUP; transitions when both teams confirm. */
  [ClientEvents.GAME_FREE_KICK_READY]: () => void;
  /** Phase 22 D-14 / Phase 23 D-09: client confirms team + uniform style + formation + jersey type selection. Validated server-side. */
  [ClientEvents.UNIFORM_CONFIRM]: (
    teamId: TeamId,
    uniformStyle: UniformStyleId,
    formationId: FormationId,
    jerseyType: 'home' | 'away',
  ) => void;
  /**
   * Phase 24 D-08: swap two outfield slot indices. Both slotIndexA and slotIndexB must be
   * non-zero (GK slot is immovable, D-09). Server validates, swaps in room state, and responds
   * with LINEUP_ASSIGNMENT_UPDATED to the requesting socket only (D-12).
   */
  [ClientEvents.LINEUP_SWAP]: (payload: { slotIndexA: number; slotIndexB: number }) => void;
  /**
   * Phase 24 D-10: confirm current assignment ordering. The server ignores the client's
   * confirmedOrder and uses room.homeAssignment / room.awayAssignment (ASVS V5 tamper-prevention).
   * After both players confirm, buildInitialGameState is called and GAME_STATE is broadcast.
   */
  [ClientEvents.LINEUP_CONFIRM]: (payload: { confirmedOrder: string[] }) => void;
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
  /** Phase 16 D-10: signals both players that team selection has begun. */
  [ServerEvents.TEAM_SELECTION_START]: () => void;
  /** Phase 16 D-11: informs both players which team home player chose. */
  [ServerEvents.TEAM_HOME_PICKED]: (teamId: TeamId) => void;
  /** UX-07: informs both players of the current game speed when home player changes it. */
  [ServerEvents.TEAM_SPEED_CHANGED]: (speed: GameSpeed) => void;
  /** Phase 22 D-13: signals both players that uniform selection phase has begun. */
  [ServerEvents.UNIFORM_SELECTION_START]: () => void;
  /** Phase 22 D-15 / Phase 23 D-09: informs both players that home has confirmed their team + uniform style + formation. */
  [ServerEvents.UNIFORM_HOME_CONFIRMED]: (
    teamId: TeamId,
    uniformStyle: UniformStyleId,
    formationId: FormationId,
  ) => void;
  /** Phase 23 D-12: broadcast to both players after away confirms formation; carries both confirmed FormationIds. buildInitialGameState is NOT called here — Phase 24 owns lineup assignment. */
  [ServerEvents.BOTH_FORMATIONS_CONFIRMED]: (
    homeFormation: FormationId,
    awayFormation: FormationId,
  ) => void;
  /**
   * Phase 24 D-07: sent to individual player socket with their team's auto-computed assignment.
   * `assignment` is a `PlayerId[]` of 11 entries where `assignment[i]` maps to
   * `FORMATIONS[formationId].slots[i]` (D-06). Client resolves IDs to PoolPlayer via PLAYER_POOL.
   */
  [ServerEvents.LINEUP_ASSIGNMENT_READY]: (assignment: string[]) => void;
  /**
   * Phase 24 D-12: sent to the requesting socket after a validated LINEUP_SWAP.
   * `assignment` is the full updated `PlayerId[]` of 11 entries post-swap.
   * Only the requesting player's socket receives this event (lineup privacy).
   */
  [ServerEvents.LINEUP_ASSIGNMENT_UPDATED]: (assignment: string[]) => void;
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
