import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../store/useGameStore.js';
import { mockMovementState } from '../mock/index.js';
import { ClientEvents } from '@counter-attack/shared';
import { FreeKickSetupPanel } from './FreeKickSetupPanel.js';
import { restartErrorMessage } from '../utils/restartErrorMessage.js';

vi.mock('../socket.js', () => ({
  socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}));

import { socket } from '../socket.js';

// Capture mock reference once — avoids @typescript-eslint/unbound-method on socket.emit
// eslint-disable-next-line @typescript-eslint/unbound-method
const emitMock: Mock = socket.emit as Mock;

afterEach(() => cleanup());

const FREE_KICK_HEX = { q: 25, r: 13 };

/** Seeds a FREE_KICK_SETUP state with away awarded the kick (D-28), at a given stage (D-49). */
function freeKickSetupState(
  stageIndex: 0 | 1 | 2 | 3,
  overrides: Partial<typeof mockMovementState> = {},
) {
  return {
    ...mockMovementState,
    phase: 'FREE_KICK_SETUP' as const,
    freeKickHex: FREE_KICK_HEX,
    freeKickAttackingTeam: 'away' as const,
    freeKickStageIndex: stageIndex,
    freeKickPlacedPieceIds: [],
    freeKickKickerChosen: null as null | boolean,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useGameStore.setState({
    gameState: freeKickSetupState(0),
    screen: 'GAME_BOARD',
    selectedPieceId: null,
    validMoveHexes: [],
    playerSlot: 1, // home — defending team (conceding) in these fixtures
    roomCode: 'ABC123',
    disconnectWarning: false,
    roomError: null,
    gameError: null,
  });
});

describe('FreeKickSetupPanel — phase gating', () => {
  it('returns null when phase is not FREE_KICK_SETUP', () => {
    useGameStore.setState({ gameState: { ...mockMovementState, phase: 'MOVE' } });
    const { container } = render(<FreeKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when freeKickHex is null', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0, { freeKickHex: null }) });
    const { container } = render(<FreeKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when freeKickStageIndex is null', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0, { freeKickStageIndex: null }) });
    const { container } = render(<FreeKickSetupPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('FreeKickSetupPanel — turn gating (active vs inactive team)', () => {
  it('stage 0 (kicking = away): the INACTIVE team (home, playerSlot 1) sees only a waiting message, no End-Turn button', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0), playerSlot: 1 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/^free kick$/i)).toBeDefined();
    expect(screen.getByText(/repositioning/i)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('stage 0 (kicking = away): the ACTIVE team (away, playerSlot 2) sees the per-stage UI and Confirm button', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0), playerSlot: 2 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/attacking team: 0 of 4 placed/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });

  it('stage 1 (defending = home): the ACTIVE team (home, playerSlot 1) sees the defending-stage UI', () => {
    useGameStore.setState({ gameState: freeKickSetupState(1), playerSlot: 1 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/defending team: 0 of 4 placed/i)).toBeDefined();
  });

  it('stage 1 (defending = home): the INACTIVE team (away, playerSlot 2) sees only a waiting message', () => {
    useGameStore.setState({ gameState: freeKickSetupState(1), playerSlot: 2 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/repositioning/i)).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('FreeKickSetupPanel — placements counter display', () => {
  it('shows 0 of N placed when no placements have been made this stage', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0), playerSlot: 2 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/attacking team: 0 of 4 placed/i)).toBeDefined();
  });

  it('shows the correct placed count after some placements this stage', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(0, { freeKickPlacedPieceIds: ['away-9', 'away-8'] }),
      playerSlot: 2,
    });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/attacking team: 2 of 4 placed/i)).toBeDefined();
  });

  it('stage 2 (kicking, cap 3): shows the stage-specific cap, not the stage-0 cap', () => {
    useGameStore.setState({ gameState: freeKickSetupState(2), playerSlot: 2 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/attacking team: 0 of 3 placed/i)).toBeDefined();
  });

  it('stage 3 (defending, cap 2): shows the stage-specific cap', () => {
    useGameStore.setState({ gameState: freeKickSetupState(3), playerSlot: 1 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/defending team: 0 of 2 placed/i)).toBeDefined();
  });
});

describe('FreeKickSetupPanel — kicker selection sub-step (freeKickKickerChosen === false)', () => {
  it('shows only heading and the kicker-selection instruction — no count row, no Confirm button', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(0, { freeKickKickerChosen: false, movedPieceIds: [] }),
      playerSlot: 2,
    });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/^free kick$/i)).toBeDefined();
    expect(
      screen.getByText(/move a player onto the kick spot to become the kicker/i),
    ).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/of \d+ placed/i)).toBeNull();
  });

  // CLEANUP-10 (Phase 46): the panel must never show two rows describing the same
  // "how do I choose the kicker" requirement at once.
  it('renders the kicker-selection instruction row exactly once, and no reworded red row alongside it', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(0, { freeKickKickerChosen: false, movedPieceIds: [] }),
      playerSlot: 2,
    });
    render(<FreeKickSetupPanel />);
    expect(
      screen.getAllByText(/move a player onto the kick spot to become the kicker/i),
    ).toHaveLength(1);
    expect(screen.queryByText(/kicker required before any other move/i)).toBeNull();
  });
});

describe('FreeKickSetupPanel — D-54 mandatory kicker-first placement (supersedes D-51, checked on EVERY kicking stage)', () => {
  beforeEach(() => {
    useGameStore.setState({ playerSlot: 2 }); // away — kicking team
  });

  it('stage 0: Confirm is DISABLED when no kicking-team piece is locked into movedPieceIds yet', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0, { movedPieceIds: [] }) });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /^confirm$/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/kicker required before any other move/i)).toBeDefined();
  });

  it('stage 0: Confirm is ENABLED once a kicking-team piece is locked into movedPieceIds (kicker placed), and the locked-kicker row names them', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(0, { movedPieceIds: ['away-9'] }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /^confirm$/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/kicker required before any other move/i)).toBeNull();
    expect(screen.queryByText(/move a player onto the kick spot to become the kicker/i)).toBeNull();
    const piece = mockMovementState.pieces.find((p) => p.id === 'away-9')!;
    expect(
      screen.getByText(`Kicker: #${piece.number} ${piece.firstName} ${piece.lastName}`),
    ).toBeDefined();
  });

  it('stage 2 (kicking, second kicking turn): Confirm is ENABLED when the kicker was already locked at stage 0 (carries forward in movedPieceIds), and the locked-kicker row still names them', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(2, { movedPieceIds: ['away-9'] }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /^confirm$/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/kicker required before any other move/i)).toBeNull();
    const piece = mockMovementState.pieces.find((p) => p.id === 'away-9')!;
    expect(
      screen.getByText(`Kicker: #${piece.number} ${piece.firstName} ${piece.lastName}`),
    ).toBeDefined();
  });

  it('stage 2: Confirm is DISABLED in the (abnormal) case where movedPieceIds has no kicking-team piece locked', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(2, { movedPieceIds: [] }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /^confirm$/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(true);
  });

  it('defending stages (1, 3) never show the kicker constraint row', () => {
    useGameStore.setState({ playerSlot: 1 }); // home — defending team
    useGameStore.setState({
      gameState: freeKickSetupState(1, {
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    expect(screen.queryByText(/kicker/i)).toBeNull();
  });
});

describe('FreeKickSetupPanel — D-50 defender-zone constraint (defending stages, 1 and 3)', () => {
  beforeEach(() => {
    useGameStore.setState({ playerSlot: 1 }); // home — defending team
  });

  it('stage 1: Confirm is disabled when a defending-team piece is within 2 hexes of freeKickHex', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(1, {
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9'
            ? { ...p, position: { q: FREE_KICK_HEX.q - 1, r: FREE_KICK_HEX.r } }
            : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /^confirm$/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/defending zone: 1 player/i)).toBeDefined();
  });

  it('stage 1: Confirm is enabled when all defending-team pieces are more than 2 hexes from freeKickHex', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(1, {
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /^confirm$/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/defending zone/i)).toBeNull();
  });

  it('stage 3 (last defending turn): the same 2-hex constraint applies and the button reads "Confirm"', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(3, {
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9'
            ? { ...p, position: { q: FREE_KICK_HEX.q - 1, r: FREE_KICK_HEX.r } }
            : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /^confirm$/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/defending zone: 1 player/i)).toBeDefined();
  });

  // Deviation (checkpoint 45-05-04 fix, developer-reported blocking bug): a
  // red-carded/sent-off piece keeps a live on-pitch `position` — the shared
  // BUG-38 `isActivePiece` predicate must exclude it from this client-side
  // "too close" recount the same way gameEngine.ts's server-authoritative
  // check already does, or the Confirm button gets falsely disabled and
  // blocks the free-kick setup flow entirely.
  it('stage 1: a RED-CARDED defending-team piece within 2 hexes is excluded — Confirm stays enabled, no false "too close" error', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(1, {
        pieces: mockMovementState.pieces.map((p) =>
          p.id === 'home-9'
            ? {
                ...p,
                position: { q: FREE_KICK_HEX.q - 1, r: FREE_KICK_HEX.r },
                redCarded: true,
                onPitch: false,
              }
            : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /^confirm$/i });
    expect((endTurn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/defending zone/i)).toBeNull();
  });
});

describe('FreeKickSetupPanel — next-action preview text', () => {
  it('stage 0 (kicking): shows next defending stage max', () => {
    useGameStore.setState({ gameState: freeKickSetupState(0), playerSlot: 2 });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/next: defending team will move up to 4 players/i)).toBeDefined();
  });

  it('stage 1 (defending): shows next attacking stage max', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(1, {
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      }),
      playerSlot: 1,
    });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/next: attacking team will move up to 3 players/i)).toBeDefined();
  });

  it('stage 3 (last stage): shows free kick will be taken', () => {
    useGameStore.setState({
      gameState: freeKickSetupState(3, {
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      }),
      playerSlot: 1,
    });
    render(<FreeKickSetupPanel />);
    expect(screen.getByText(/next: free kick will be taken/i)).toBeDefined();
  });
});

describe('FreeKickSetupPanel — Confirm click emits and surfaces server errors', () => {
  it('clicking Confirm (when enabled) calls emitFreeKickReady', () => {
    useGameStore.setState({
      playerSlot: 1,
      gameState: freeKickSetupState(1, {
        pieces: mockMovementState.pieces.map((p) =>
          p.teamId === 'home' ? { ...p, position: { q: 1, r: 1 } } : p,
        ),
      }),
    });
    render(<FreeKickSetupPanel />);
    const endTurn = screen.getByRole('button', { name: /^confirm$/i });
    fireEvent.click(endTurn);
    // socket.emit is mocked at the module level — assert no throw and the button is still
    // present (no local "waiting" state in this component anymore; the NEXT server broadcast
    // either advances the stage or rejects with a snap-back, both surfaced via gameState/gameError).
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDefined();
  });

  it('surfaces a server-rejection reason via the existing gameError display pattern, humanised (Plan 37-16)', () => {
    useGameStore.setState({
      playerSlot: 2,
      gameState: freeKickSetupState(0),
      gameError: 'NOT_YOUR_STAGE',
    });
    render(<FreeKickSetupPanel />);
    expect(screen.queryByText('NOT_YOUR_STAGE')).toBeNull();
    expect(screen.getByText(restartErrorMessage('NOT_YOUR_STAGE') ?? '')).toBeDefined();
  });
});

describe('FreeKickSetupPanel — D-06/D-08: shared CTA color helper and Confirm verb', () => {
  it('kicking stage, kicker locked, placements remaining: Confirm className contains ctaButtonPending, not ctaButtonReady', () => {
    useGameStore.setState({
      playerSlot: 2, // away — kicking team
      gameState: freeKickSetupState(0, {
        freeKickPlacedPieceIds: [],
        movedPieceIds: ['away-9'], // kicker locked in
      }),
    });
    render(<FreeKickSetupPanel />);
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn.className).toContain('ctaButtonPending');
    expect(confirmBtn.className).not.toContain('ctaButtonReady');
  });

  it('kicking stage, placements filled to stage.max: Confirm className contains ctaButtonReady, not ctaButtonPending', () => {
    useGameStore.setState({
      playerSlot: 2, // away — kicking team
      gameState: freeKickSetupState(0, {
        freeKickPlacedPieceIds: ['away-8', 'away-9', 'away-10', 'away-7'], // stage 0 max = 4
        movedPieceIds: ['away-9'], // kicker locked in
      }),
    });
    render(<FreeKickSetupPanel />);
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn.className).toContain('ctaButtonReady');
    expect(confirmBtn.className).not.toContain('ctaButtonPending');
  });

  it('kicking stage, no kicking-team piece locked (constraintsMet false): Confirm has neither color class and is disabled', () => {
    useGameStore.setState({
      playerSlot: 2, // away — kicking team
      gameState: freeKickSetupState(0, {
        freeKickPlacedPieceIds: [],
        movedPieceIds: [], // kicker not locked -> constraintsMet false
      }),
    });
    render(<FreeKickSetupPanel />);
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirmBtn.className).not.toContain('ctaButtonReady');
    expect(confirmBtn.className).not.toContain('ctaButtonPending');
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('clicking Confirm while remaining > 0 opens the dialog with Cancel and "Yes, end turn"; clicking "Yes, end turn" calls emitFreeKickReady', () => {
    useGameStore.setState({
      playerSlot: 2, // away — kicking team
      gameState: freeKickSetupState(0, {
        freeKickPlacedPieceIds: [],
        movedPieceIds: ['away-9'], // kicker locked -> constraintsMet true, remaining > 0
      }),
    });
    render(<FreeKickSetupPanel />);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeDefined();
    const affirm = screen.getByRole('button', { name: /^yes, end turn$/i });
    expect(affirm).toBeDefined();

    fireEvent.click(affirm);
    expect(emitMock).toHaveBeenCalledWith(ClientEvents.GAME_FREE_KICK_READY);
  });
});
