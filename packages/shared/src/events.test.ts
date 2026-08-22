/**
 * Runtime assertions for the shared events module.
 *
 * These tests import the compiled module and assert on actual exported values,
 * rather than reading the source file as text (WR-04 fix). Source-text tests
 * break on innocuous formatting changes and cannot catch runtime regressions
 * (e.g. a typo that renames 'room:create' to 'room-create').
 *
 * SocketData interface shape tests are intentionally omitted — TypeScript
 * interfaces are erased at compile time and cannot be inspected at runtime.
 * Type correctness is enforced by `tsc --noEmit`, not by vitest assertions.
 */

import { describe, it, expect } from 'vitest';
import { ClientEvents, ServerEvents } from './events.js';

describe('ClientEvents', () => {
  it('ROOM_CREATE equals room:create', () => {
    expect(ClientEvents.ROOM_CREATE).toBe('room:create');
  });

  it('ROOM_JOIN equals room:join', () => {
    expect(ClientEvents.ROOM_JOIN).toBe('room:join');
  });

  it('GAME_MOVE equals game:move', () => {
    expect(ClientEvents.GAME_MOVE).toBe('game:move');
  });

  it('GAME_ROLL equals game:roll', () => {
    expect(ClientEvents.GAME_ROLL).toBe('game:roll');
  });

  it('GAME_ROSTER_REPOSITION equals game:roster-reposition', () => {
    expect(ClientEvents.GAME_ROSTER_REPOSITION).toBe('game:roster-reposition');
  });

  it('every ClientEvents value is unique (GAME_ROSTER_REPOSITION included)', () => {
    const values = Object.values(ClientEvents);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('ServerEvents', () => {
  it('ROOM_JOINED equals room:joined', () => {
    expect(ServerEvents.ROOM_JOINED).toBe('room:joined');
  });

  it('ROOM_ERROR equals room:error', () => {
    expect(ServerEvents.ROOM_ERROR).toBe('room:error');
  });

  it('GAME_STATE equals game:state', () => {
    expect(ServerEvents.GAME_STATE).toBe('game:state');
  });

  it('GAME_DISCONNECT_WARNING equals game:disconnect-warning', () => {
    expect(ServerEvents.GAME_DISCONNECT_WARNING).toBe('game:disconnect-warning');
  });
});
