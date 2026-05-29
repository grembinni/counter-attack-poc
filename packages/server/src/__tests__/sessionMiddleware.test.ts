import { describe, it, expect, afterEach } from 'vitest';
import { sessionMiddleware } from '../sessionMiddleware.js';
import { createRoom, joinRoom, clearAllRooms } from '../roomStore.js';
import type { Socket } from 'socket.io';

afterEach(() => {
  clearAllRooms();
});

/** Creates a minimal mock Socket for testing the middleware. */
function makeSocket(authToken?: string): Socket {
  return {
    handshake: {
      auth: authToken !== undefined ? { sessionToken: authToken } : {},
    },
    data: {} as Record<string, unknown>,
  } as unknown as Socket;
}

describe('sessionMiddleware', () => {
  it('does NOT mutate socket.data when no sessionToken is provided', () => {
    const socket = makeSocket();
    let nextCalled = false;
    sessionMiddleware(socket, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(socket.data.sessionToken).toBeUndefined();
    expect(socket.data.playerSlot).toBeUndefined();
    expect(socket.data.roomCode).toBeUndefined();
  });

  it('does NOT mutate socket.data for an unknown sessionToken (falls through)', () => {
    const socket = makeSocket('unknown-token-xyz');
    let nextCalled = false;
    sessionMiddleware(socket, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(socket.data.sessionToken).toBeUndefined();
    expect(socket.data.playerSlot).toBeUndefined();
    expect(socket.data.roomCode).toBeUndefined();
  });

  it('populates socket.data for a known slot-1 sessionToken', () => {
    const { roomCode, sessionToken } = createRoom('socket-host');
    const socket = makeSocket(sessionToken);
    sessionMiddleware(socket, () => {});
    expect(socket.data.sessionToken).toBe(sessionToken);
    expect(socket.data.playerSlot).toBe(1);
    expect(socket.data.roomCode).toBe(roomCode);
  });

  it('populates socket.data for a known slot-2 sessionToken', () => {
    const { roomCode } = createRoom('socket-host');
    const joinResult = joinRoom(roomCode, 'socket-guest');
    expect(joinResult.ok).toBe(true);
    if (!joinResult.ok) return;
    const socket = makeSocket(joinResult.sessionToken);
    sessionMiddleware(socket, () => {});
    expect(socket.data.sessionToken).toBe(joinResult.sessionToken);
    expect(socket.data.playerSlot).toBe(2);
    expect(socket.data.roomCode).toBe(roomCode);
  });

  it('always calls next() exactly once with no arguments', () => {
    const socket = makeSocket();
    const calls: unknown[] = [];
    sessionMiddleware(socket, (...args) => {
      calls.push(args);
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([]);
  });
});
