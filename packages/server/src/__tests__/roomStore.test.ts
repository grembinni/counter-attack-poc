import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createRoom,
  joinRoom,
  getRoom,
  findPlayerByToken,
  deleteRoom,
  clearAllRooms,
  broadcastState,
  type Room,
} from '../roomStore.js';
import { buildInitialGameState } from '../gameEngine.js';
import type { GameState, PlayerPiece } from '@counter-attack/shared';
import type { UniformStyleId } from '@counter-attack/shared';
import type { Server } from 'socket.io';

// Phase 22 D-17: default uniform styles for test call sites.
const DEFAULT_STYLES_RS: { home: UniformStyleId; away: UniformStyleId } = {
  home: 'pinstripes-vertical',
  away: 'bar-diagonal',
};

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

// ---------------------------------------------------------------------------
// GOALKICK-06 / OOB-05 (Phase 37 Plan 03): Out-of-Bounds/Restarts settings toggle.
// Wave-0 toggle coverage per 37-VALIDATION.md. The over-the-wire
// ROOM_SETTINGS_CONFIRM validation/mutation (allow-list guard, broadcast) is
// integration-tested in room.integration.test.ts; here we cover the store field
// itself (default state + the mutation the handler performs) and the
// buildInitialGameState parameter that consumes it.
// ---------------------------------------------------------------------------

describe('Room.outOfBoundsEnabled (Phase 37 OOB-05/GOALKICK-06)', () => {
  it('defaults to undefined on a freshly created room', () => {
    const { roomCode } = createRoom('socket-host');
    const room = getRoom(roomCode);
    expect(room?.outOfBoundsEnabled).toBeUndefined();
  });

  it('reflects true after the settings-confirm mutation (mirrors the ROOM_SETTINGS_CONFIRM handler write)', () => {
    const { roomCode } = createRoom('socket-host');
    const room = getRoom(roomCode);
    if (!room) throw new Error('room not found');
    // Mirrors `room.outOfBoundsEnabled = outOfBounds;` in roomHandlers.ts's
    // ROOM_SETTINGS_CONFIRM handler after a client confirms with outOfBounds: true.
    room.outOfBoundsEnabled = true;
    expect(getRoom(roomCode)!.outOfBoundsEnabled).toBe(true);
  });
});

describe('buildInitialGameState outOfBoundsEnabled parameter (Phase 37 OOB-05/GOALKICK-06)', () => {
  it('returns a state with outOfBoundsEnabled === true when passed true as the 9th argument', () => {
    const state = buildInitialGameState(
      'ROOM-OOB-1',
      { home: 'city', away: 'crew' },
      'standard',
      DEFAULT_STYLES_RS,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );
    expect(state.outOfBoundsEnabled).toBe(true);
  });

  it('returns a state with outOfBoundsEnabled === false when the 9th argument is omitted', () => {
    const state = buildInitialGameState(
      'ROOM-OOB-2',
      { home: 'city', away: 'crew' },
      'standard',
      DEFAULT_STYLES_RS,
    );
    expect(state.outOfBoundsEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MOVE-06 (Phase 17, corrected design D-33): broadcastState invokes
// applyFreeMoveZoneCheck centrally before emitting.
// ---------------------------------------------------------------------------

function makePiece(overrides: Partial<PlayerPiece>): PlayerPiece {
  return {
    id: 'home-1',
    teamId: 'home',
    firstName: 'Test',
    lastName: 'Player',
    number: 2,
    nationality: 'Test',
    role: 'DEF',
    position: { q: 0, r: 0 },
    pace: 5,
    shooting: 3,
    tackling: 5,
    dribbling: 3,
    saving: 1,
    handling: 1,
    resilience: 5,
    aerialAbility: 4,
    highPass: 4,
    ...overrides,
  };
}

/** Minimal valid GameState for broadcastState tests — phase PASS, ball in middleThird. */
function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomCode: 'BCAST',
    phase: 'PASS',
    activeTeam: 'home',
    attackingTeam: 'home',
    pieces: [
      makePiece({ id: 'home-1', teamId: 'home', position: { q: 5, r: 7 } }),
      makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 7 } }),
    ],
    ball: { position: { q: 18, r: 13 }, carrierId: null, lastTouchedBy: null },
    score: { home: 0, away: 0 },
    actionCount: 0,
    half: 1,
    eventLog: [],
    refereeCard: { leniency: 3 },
    movedPieceIds: [],
    paceUsedByPieceId: {},
    movementSlot: null,
    ballZone: 'middle',
    addedTime: null,
    lastActionType: null,
    kickOffTeam: 'home',
    kickOffActive: false,
    selectedTeams: { home: 'city', away: 'crew' },
    selectedUniformStyles: DEFAULT_STYLES_RS, // Phase 22 D-17
    gameSpeed: 'standard' as const, // UX-07 (Phase 18.4)
    ...overrides,
  };
}

/** Minimal fake Socket.io Server — broadcastState only calls io.to(roomCode).emit(...). */
function makeFakeServer(): Server {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  return { to } as unknown as Server;
}

function makeRoom(gameState: GameState | null): Room {
  return {
    roomCode: gameState?.roomCode ?? 'BCAST',
    players: [null, null],
    status: 'playing',
    gameState,
    isProcessing: false,
    disconnectTimers: [null, null],
  };
}

describe('broadcastState (MOVE-06 corrected design)', () => {
  it('is a no-op when room.gameState is null', () => {
    const io = makeFakeServer();
    const room = makeRoom(null);
    expect(() => broadcastState(io, room)).not.toThrow();
    expect(room.gameState).toBeNull();
  });

  it('does not mutate ballZone or phase when the ball stays in middleThird', () => {
    const io = makeFakeServer();
    const room = makeRoom(makeGameState());
    broadcastState(io, room);
    expect(room.gameState?.ballZone).toBe('middle');
    expect(room.gameState?.phase).toBe('PASS');
  });

  it('updates ballZone and triggers FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE when the ball freshly enters a final third with eligible pieces in the opposite third', () => {
    const io = makeFakeServer();
    // Ball at q:30 (awayThird) — fresh entry from the seeded 'middle' ballZone.
    // home-1 sits in homeThird (q:5) — the OPPOSITE final third from the ball's new
    // 'away' zone — making it eligible. attackingTeam is 'home', so home-1 lands in
    // the attack list and FREE_MOVE_ATTACK fires first (D-35).
    const seeded = makeGameState({
      ball: { position: { q: 30, r: 7 }, carrierId: null, lastTouchedBy: null },
      ballZone: 'middle',
      pieces: [
        makePiece({ id: 'home-1', teamId: 'home', position: { q: 5, r: 7 } }),
        makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 7 } }),
      ],
    });
    const room = makeRoom(seeded);

    broadcastState(io, room);

    expect(room.gameState?.ballZone).toBe('away');
    expect(room.gameState?.phase).toBe('FREE_MOVE_ATTACK');
    expect(room.gameState?.freeMoveEligibleIds).toEqual({ attack: ['home-1'], defense: [] });
  });

  it('emits the post-zone-check state to the room (not the pre-check state)', () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const io = { to } as unknown as Server;
    const seeded = makeGameState({
      ball: { position: { q: 30, r: 7 }, carrierId: null, lastTouchedBy: null },
      ballZone: 'middle',
      pieces: [
        makePiece({ id: 'home-1', teamId: 'home', position: { q: 5, r: 7 } }),
        makePiece({ id: 'away-1', teamId: 'away', position: { q: 30, r: 7 } }),
      ],
    });
    const room = makeRoom(seeded);

    broadcastState(io, room);

    expect(to).toHaveBeenCalledWith('BCAST');
    expect(emit).toHaveBeenCalledTimes(1);
    const [, emittedState] = emit.mock.calls[0] as [string, GameState];
    expect(emittedState.phase).toBe('FREE_MOVE_ATTACK');
    expect(emittedState.ballZone).toBe('away');
  });
});
