/**
 * Phase 27 (DRAFT-01) — App.tsx GAME_SETTINGS routing/emit/receipt behavior.
 * Gap fill for task 27-03-03: the App.tsx logic wired in Phase 27 (host routed to
 * GAME_SETTINGS after room creation, handleSettingsConfirm emitting ROOM_SETTINGS_CONFIRM,
 * joiner never seeing GAME_SETTINGS, and onRoomSettingsConfirmed moving the host to WAITING)
 * had zero automated coverage — no App.test.tsx existed in the repo prior to this file.
 *
 * Mocking approach follows the established convention (see GameBoard.test.tsx /
 * useGameStore.test.ts): vi.mock('./socket.js', ...) with jest-mock-style socket.on/off/emit,
 * then the socket.on mock calls are inspected to retrieve and directly invoke the handlers
 * App.tsx registers in its mount effect (there is no real Socket.io server in this test).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerEvents, ClientEvents } from '@counter-attack/shared';
import { useGameStore } from './store/useGameStore.js';
import { mockMovementState } from './mock/index.js';
import { App } from './App.js';

vi.mock('./socket.js', () => ({
  socket: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn(),
    connected: false,
    io: { on: vi.fn(), off: vi.fn() },
  },
}));

import { socket } from './socket.js';

// eslint-disable-next-line @typescript-eslint/unbound-method
const onMock: Mock = socket.on as Mock;
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

/** Retrieve the handler App.tsx registered via socket.on(eventName, handler). */
function getHandler(eventName: string): (...args: unknown[]) => void {
  const call = onMock.mock.calls.find((c: unknown[]) => c[0] === eventName);
  if (!call) throw new Error(`No socket.on registered for ${eventName}`);
  return call[1] as (...args: unknown[]) => void;
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: { ...mockMovementState },
    screen: 'LANDING',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: null,
    roomCode: null,
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

describe('App — Phase 27 GAME_SETTINGS routing (DRAFT-01)', () => {
  it('routes the host (slot 1) to GAME_SETTINGS after ROOM_JOINED fires from LANDING/CREATE_ROOM', () => {
    render(<App />);

    const onRoomJoined = getHandler(ServerEvents.ROOM_JOINED);
    act(() => onRoomJoined('ABC12', 1, 'host-token'));

    expect(useGameStore.getState().screen).toBe('GAME_SETTINGS');
    expect(screen.getByText('Game Settings')).toBeTruthy();
  });

  it('does NOT route the joiner (slot 2) to GAME_SETTINGS on ROOM_JOINED', () => {
    render(<App />);

    const onRoomJoined = getHandler(ServerEvents.ROOM_JOINED);
    act(() => onRoomJoined('ABC12', 2, 'joiner-token'));

    expect(useGameStore.getState().screen).not.toBe('GAME_SETTINGS');
    expect(screen.queryByText('Game Settings')).toBeNull();
  });

  it('emits ROOM_SETTINGS_CONFIRM with the bundled {speed, teamType, draftPools, ...} payload when the host confirms', async () => {
    render(<App />);
    const user = userEvent.setup();

    const onRoomJoined = getHandler(ServerEvents.ROOM_JOINED);
    act(() => onRoomJoined('ABC12', 1, 'host-token'));

    expect(useGameStore.getState().screen).toBe('GAME_SETTINGS');

    await user.click(screen.getByRole('button', { name: 'Confirm Settings' }));

    // D-14 (Phase 39): all four Match Rules toggles default ON in GameSettingsScreen —
    // confirming without touching any toggle now forwards true for all four.
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.ROOM_SETTINGS_CONFIRM, {
      speed: 'standard',
      teamType: 'standard',
      draftPools: [],
      outOfBounds: true,
      fouls: true,
      booking: true,
      injury: true,
    });
  });

  it('moves the host from GAME_SETTINGS to WAITING when ROOM_SETTINGS_CONFIRMED arrives', () => {
    render(<App />);
    useGameStore.setState({ screen: 'GAME_SETTINGS' });

    const onRoomSettingsConfirmed = getHandler(ServerEvents.ROOM_SETTINGS_CONFIRMED);
    act(() => onRoomSettingsConfirmed('fast', 'draft', ['original', 'mls']));

    expect(useGameStore.getState().screen).toBe('WAITING');
  });

  it('does NOT change screen on ROOM_SETTINGS_CONFIRMED if the host is not currently on GAME_SETTINGS', () => {
    render(<App />);
    useGameStore.setState({ screen: 'TEAM_SELECTION' });

    const onRoomSettingsConfirmed = getHandler(ServerEvents.ROOM_SETTINGS_CONFIRMED);
    act(() => onRoomSettingsConfirmed('standard', 'standard', []));

    expect(useGameStore.getState().screen).toBe('TEAM_SELECTION');
  });
});
