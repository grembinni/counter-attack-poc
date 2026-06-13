import { describe, it, expect, afterEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  getRoom,
  findPlayerByToken,
  deleteRoom,
  clearAllRooms,
} from '../roomStore.js';

afterEach(() => {
  clearAllRooms();
});

describe('createRoom', () => {
  it('returns a 5-character uppercase code from the Crockford-ish alphabet (no 0,O,1,I)', () => {
    const { roomCode } = createRoom('socket-abc-123');
    expect(roomCode).toHaveLength(5);
    expect(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(roomCode)).toBe(true);
  });

  it('returns a UUID-v4 sessionToken (36 chars, 8-4-4-4-12 hex layout)', () => {
    const { sessionToken } = createRoom('socket-abc-123');
    expect(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionToken),
    ).toBe(true);
  });

  it('persists the room in the store with status=waiting, slot 1 occupied, slot 2 null, isProcessing=false', () => {
    const { roomCode, sessionToken } = createRoom('socket-abc-123');
    const room = getRoom(roomCode);
    expect(room).toBeDefined();
    if (!room) return;
    expect(room.status).toBe('waiting');
    expect(room.isProcessing).toBe(false);
    expect(room.players[0]).toEqual({
      socketId: 'socket-abc-123',
      sessionToken,
      slot: 1,
    });
    expect(room.players[1]).toBeNull();
    expect(room.disconnectTimers).toEqual([null, null]);
    expect(room.gameState).toBeNull();
  });

  it('returns distinct codes across 50 sequential calls (no collisions in normal use)', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { roomCode } = createRoom(`socket-${i}`);
      codes.add(roomCode);
    }
    expect(codes.size).toBe(50);
  });
});

describe('joinRoom', () => {
  it('returns { ok: true, slot: 2 } and transitions status to playing on a waiting room', () => {
    const { roomCode } = createRoom('socket-host');
    const result = joinRoom(roomCode, 'socket-guest');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.slot).toBe(2);
      expect(typeof result.sessionToken).toBe('string');
    }
    const room = getRoom(roomCode);
    expect(room?.status).toBe('playing');
  });

  it('returns { ok: false, reason: NOT_FOUND } for an unknown room code', () => {
    const result = joinRoom('ZZZZZ', 'socket-x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NOT_FOUND');
  });

  it('returns { ok: false, reason: NOT_WAITING } when the room is already playing', () => {
    const { roomCode } = createRoom('socket-host');
    joinRoom(roomCode, 'socket-guest');
    const result = joinRoom(roomCode, 'socket-third');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('NOT_WAITING');
  });

  it('joinRoom sets gameState to null — game built after team selection (Phase 16 D-10)', () => {
    const { roomCode } = createRoom('socket-host');
    const result = joinRoom(roomCode, 'socket-guest');
    expect(result.ok).toBe(true);
    const room = getRoom(roomCode);
    // Phase 16 D-10: gameState is null after join; built only once both teams pick via team:pick
    expect(room?.gameState).toBeNull();
    // homePickedTeam is not yet set
    expect(room?.homePickedTeam).toBeUndefined();
  });
});

describe('findPlayerByToken', () => {
  it('returns { room, slot: 1 } when the sessionToken matches the creator', () => {
    const { roomCode, sessionToken } = createRoom('socket-host');
    const found = findPlayerByToken(sessionToken);
    expect(found).not.toBeNull();
    if (found) {
      expect(found.slot).toBe(1);
      expect(found.room.roomCode).toBe(roomCode);
    }
  });

  it('returns { room, slot: 2 } when the sessionToken matches the joiner', () => {
    const { roomCode } = createRoom('socket-host');
    const joinResult = joinRoom(roomCode, 'socket-guest');
    expect(joinResult.ok).toBe(true);
    if (!joinResult.ok) return;
    const found = findPlayerByToken(joinResult.sessionToken);
    expect(found).not.toBeNull();
    if (found) {
      expect(found.slot).toBe(2);
      expect(found.room.roomCode).toBe(roomCode);
    }
  });

  it('returns null for an unknown token', () => {
    const found = findPlayerByToken('not-a-valid-token');
    expect(found).toBeNull();
  });
});

describe('deleteRoom', () => {
  it('removes the room from the store', () => {
    const { roomCode } = createRoom('socket-host');
    expect(getRoom(roomCode)).toBeDefined();
    deleteRoom(roomCode);
    expect(getRoom(roomCode)).toBeUndefined();
  });
});
