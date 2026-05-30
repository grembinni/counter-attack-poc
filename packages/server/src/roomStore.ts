/**
 * In-memory room store for Counter Attack server.
 *
 * Pattern 2 from RESEARCH.md: application-level Map<string, Room> holding room state
 * independently of Socket.io's adapter. All game-level state — player slots, session tokens,
 * disconnect timers — lives here. Socket.io rooms are used only for broadcasting.
 *
 * ARCH-04: Full game-state snapshot broadcast after every validated action;
 *          no differential patching. broadcastState() is the single ARCH-04 entry point.
 */

import { randomUUID } from 'crypto';
import { customAlphabet } from 'nanoid';
import type { GameState } from '@counter-attack/shared';
import { ServerEvents } from '@counter-attack/shared';
import type { Server } from 'socket.io';

// Crockford-ish alphabet — excludes 0/O and 1/I to reduce transcription errors.
// RESEARCH.md Pattern 2: customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5)
const genRoomCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

// Module-level singleton — mirrors the AXIAL_DIRECTIONS const pattern from hex.ts.
const rooms = new Map<string, Room>();

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** A player record stored in a Room slot. */
export type PlayerRecord = {
  socketId: string;
  sessionToken: string;
  slot: 1 | 2;
};

/**
 * Room held in the application-level Map.
 *
 * isProcessing: pre-loaded for the Phase 4 game-action mutex (STATE.md pitfall:
 * "Add isProcessing mutex before writing any game logic").
 * disconnectTimers: tuple of per-slot timeout handles for the 90-second grace timer (Pattern 4).
 */
export type Room = {
  roomCode: string;
  players: [PlayerRecord | null, PlayerRecord | null];
  status: 'waiting' | 'playing' | 'ended';
  gameState: GameState | null;
  isProcessing: boolean;
  disconnectTimers: [ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null];
};

/**
 * Discriminated union result for joinRoom.
 *
 * - NOT_FOUND: room code unknown (CONN-04, first clause)
 * - NOT_WAITING: room exists but status ≠ 'waiting' (CONN-04, second clause — distinct from NOT_FOUND
 *   so the client can display different error messages)
 * - FULL: both player slots occupied (defensive, should be unreachable)
 */
export type JoinResult =
  | { ok: false; reason: 'NOT_FOUND' | 'NOT_WAITING' | 'FULL' }
  | { ok: true; sessionToken: string; slot: 2 };

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Creates a new room and assigns slot 1 to the creating socket.
 *
 * CONN-01: server generates room code and session token; client never generates these.
 *
 * Collision-retry: regenerates up to 5 times if the code already exists in the Map.
 * Probability of 5 sequential collisions in a 33M-key space with < 1000 rooms: negligible (<10^-30).
 *
 * @param socketId - The socket.id of the creating client
 * @returns { roomCode, sessionToken } — both are server-generated
 * @throws Error if 5 consecutive collision attempts all fail
 */
export function createRoom(socketId: string): { roomCode: string; sessionToken: string } {
  let roomCode = genRoomCode();
  let attempts = 1;
  while (rooms.has(roomCode)) {
    if (attempts >= 5) {
      throw new Error('Room code collision after 5 attempts');
    }
    roomCode = genRoomCode();
    attempts++;
  }

  const sessionToken = randomUUID();
  const room: Room = {
    roomCode,
    players: [{ socketId, sessionToken, slot: 1 }, null],
    status: 'waiting',
    gameState: null,
    isProcessing: false,
    disconnectTimers: [null, null],
  };
  rooms.set(roomCode, room);
  return { roomCode, sessionToken };
}

/**
 * Joins an existing room and assigns slot 2 to the joining socket.
 *
 * Guard precedence (CONN-04 — tests must verify this order):
 * 1. NOT_FOUND — room code not in Map (CONN-04, first clause)
 * 2. NOT_WAITING — room.status !== 'waiting' (CONN-04, second clause)
 * 3. FULL — room.players[1] !== null (defensive guard, should be unreachable)
 * 4. Success — assign sessionToken, slot 2, transition status to 'playing',
 *    set stub LOBBY GameState (CONN-02 success path, CONN-03 trigger for ARCH-04 broadcast)
 *
 * @param roomCode - 5-char uppercase alphanumeric room code
 * @param socketId - The socket.id of the joining client
 * @returns JoinResult — discriminated union, ok:true or ok:false with reason
 */
export function joinRoom(roomCode: string, socketId: string): JoinResult {
  // 1. NOT_FOUND guard
  if (!rooms.has(roomCode)) {
    return { ok: false, reason: 'NOT_FOUND' };
  }

  const room = rooms.get(roomCode)!;

  // 2. NOT_WAITING guard (playing or ended)
  if (room.status !== 'waiting') {
    return { ok: false, reason: 'NOT_WAITING' };
  }

  // 3. FULL guard (defensive — should be unreachable in normal flow)
  if (room.players[1] !== null) {
    return { ok: false, reason: 'FULL' };
  }

  // 4. Success path: assign slot 2, transition to 'playing', set stub LOBBY state
  const sessionToken = randomUUID();
  room.players[1] = { socketId, sessionToken, slot: 2 };
  room.status = 'playing';

  // Stub GameState with phase: 'LOBBY' — placeholder for ARCH-04 broadcast in Plan 03.
  // Phase 4 (plan 04-03) replaces this with real initial state via buildInitialGameState().
  room.gameState = {
    roomCode,
    phase: 'LOBBY',
    activeTeam: 'home',
    attackingTeam: 'home',
    pieces: [],
    ball: { position: { q: 0, r: 0 }, carrierId: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 3 },
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
  };

  return { ok: true, sessionToken, slot: 2 };
}

/**
 * Returns the Room for a given room code, or undefined if not found.
 *
 * Pure Map lookup — no side effects.
 *
 * @param roomCode - 5-char uppercase alphanumeric room code
 */
export function getRoom(roomCode: string): Room | undefined {
  return rooms.get(roomCode);
}

/**
 * Removes a room from the store.
 *
 * Also clears any pending disconnect timers to prevent stale timer callbacks
 * from running on a deleted room (defense-in-depth; primary trigger paths cancel
 * their own timers, but this guarantees no leak).
 *
 * @param roomCode - 5-char uppercase alphanumeric room code
 */
export function deleteRoom(roomCode: string): void {
  const room = rooms.get(roomCode);
  if (room) {
    for (const timer of room.disconnectTimers) {
      if (timer !== null) clearTimeout(timer);
    }
  }
  rooms.delete(roomCode);
}

/**
 * Finds a player by session token — scans all rooms for a matching player record.
 *
 * ARCH-01: server-authoritative identity; client cannot self-assign slot.
 * Used by sessionMiddleware to restore player slot and room context on reconnect.
 *
 * Linear scan over all rooms — acceptable for POC (< 100 rooms). Not a security risk:
 * no token leaks across rooms because only matching tokens return a result (T-03-05).
 *
 * @param sessionToken - UUID v4 session token to look up
 * @returns { room, slot } if found, null otherwise
 */
export function findPlayerByToken(sessionToken: string): { room: Room; slot: 1 | 2 } | null {
  for (const room of rooms.values()) {
    for (const player of room.players) {
      if (player?.sessionToken === sessionToken) {
        return { room, slot: player.slot };
      }
    }
  }
  return null;
}

/**
 * Broadcasts the current game state to all sockets in the room.
 *
 * ARCH-04: server broadcasts full game state snapshot after every validated action;
 * never differential patching. This is the single ARCH-04 entry point — every Phase 4+
 * handler calls this after any state mutation.
 *
 * No-op if room.gameState is null (room not yet in-game).
 *
 * @param io - Socket.io Server instance
 * @param room - The room whose state should be broadcast
 */
export function broadcastState(io: Server, room: Room): void {
  if (room.gameState === null) return;
  io.to(room.roomCode).emit(ServerEvents.GAME_STATE, room.gameState);
}

/**
 * Clears all rooms from the store, cancelling any pending disconnect timers.
 *
 * @internal — test cleanup helper. Call in afterEach() to reset Map state between tests.
 */
export function clearAllRooms(): void {
  for (const room of rooms.values()) {
    for (const timer of room.disconnectTimers) {
      if (timer !== null) clearTimeout(timer);
    }
  }
  rooms.clear();
}
