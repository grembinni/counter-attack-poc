/**
 * Socket.io event handlers for game action management.
 *
 * Wires GAME_START_MOVEMENT, GAME_MOVE, GAME_END_TURN, and GAME_UNDO onto a socket.
 * Called from createServer.ts io.on('connection') alongside registerRoomHandlers.
 *
 * ARCH-01: server is the sole authority for all FSM transitions and state mutations.
 * ARCH-04: broadcastState is the single entry point for all state updates — never io.to().emit.
 * SC-5: isProcessing mutex guards every handler; duplicate actions are silently dropped.
 * T-4-01: wrong-team game:move and game:end-turn rejected with GAME_ERROR 'WRONG_TEAM'.
 * T-4-02: isProcessing mutex prevents double-action race (concurrent identical actions).
 * T-4-03: pieceId lookup in applyMove uses server-side piece.position — client from-coord ignored.
 * T-4-04: wrong-team game:end-turn rejected before calling applyEndTurn.
 * T-4-05: game:start-movement restricted to the attacking team's socket.
 *
 * Anti-pattern rationale (RESEARCH.md):
 * - Reads socket.data.playerSlot/roomCode, NEVER socket.rooms (Pitfall 2).
 * - isProcessing released in finally — never conditionally (Pitfall 5).
 * - Player slot 1 controls 'home'; slot 2 controls 'away'.
 *   attackingTeam (coin flip) determines who acts first, not slot→team mapping.
 */

import type {
  ClientToServerEvents,
  HexCoord,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@counter-attack/shared';
import {
  ClientEvents,
  ELIGIBLE_NEXT_ACTIONS,
  PITCH_HEXES,
  PITCH_REGIONS,
  ServerEvents,
  freeKickStageTeam,
  hexDistance,
  hexLine,
  isInRegion,
  isPitchHex,
  validatePass,
} from '@counter-attack/shared';
import type { Server, Socket } from 'socket.io';
import { broadcastState, getRoom } from './roomStore.js';
import {
  applyCancelMovement,
  applyCornerKickClearOut,
  applyCornerKickClearOutEnd,
  applyCornerKickFinalMove,
  applyCornerKickFinalSetupEnd,
  applyCornerKickGkPlace,
  applyCornerKickGkWindowEnd,
  applyCornerKickReposition,
  applyCornerKickStageEnd,
  applyCornerKickTakerSelect,
  applyDeclareShot,
  applyEndTurn,
  applyFreeKickMove,
  applyFreeKickReady,
  applyFreeMoveEnd,
  applyGKDive,
  applyGKKickTarget,
  applyGKRestart,
  applyGoalKickChoice,
  applyGoalKickMoveEnd,
  applyGoalKickReposition,
  applyGoalKickTarget,
  applyGoalKickWindowEnd,
  applyHalfTimeStart,
  applyKickOffReady,
  applyMove,
  applyQuickThrow,
  applyResolveHeaderTarget,
  applyRestartMovement,
  applyRoll,
  applySnapshot,
  applyStartMovement,
  applyThrowInPlace,
  applyUndo,
  buildKickOffPieces,
  buildReplayFrames,
  computeHeaderDuelDetail,
  computeShotPathDeflection,
  applyOffsideFoulWithRelocation,
  resolveHeaderWinnerPiece,
} from './gameEngine.js';
import type { DefenderDeflectionInput } from './gameEngine.js';
import { rollDice } from './diceUtils.js';
import type { Room } from './roomStore.js';
import type {
  ActionEvent,
  GamePhase,
  GameState,
  LastActionType,
  PlayerPiece,
} from '@counter-attack/shared';

/** Typed Socket alias for the project's four generic parameters. */
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Phases that require a dice roll from the active player.
 * GK_RESTART is handled by the separate game:gk-restart handler (Plan 03, D-12/D-22).
 */
const DICE_PHASES = new Set<string>(['KICK_OFF', 'PASS', 'HEADER', 'LOOSE_BALL']);

/** THROWIN-04: a throw-in travels at most 6 hexes, regardless of Low/High type. */
const THROW_IN_MAX_DISTANCE = 6;

/**
 * Returns true when `lastActionType` marks an in-progress throw-in Movement Phase
 * (THROW_IN_MOVEMENT_1 after Movement Phase 1, THROW_IN_MOVEMENT_2 after Movement
 * Phase 2). Used at every throw-in-specific guard site in the GAME_ROLL PASS branch
 * below so the same condition stays greppable and single-sourced.
 */
const isThrowInContext = (lastActionType: LastActionType | null): boolean =>
  lastActionType === 'THROW_IN_MOVEMENT_1' || lastActionType === 'THROW_IN_MOVEMENT_2';

/**
 * CORNER-04: a High Pass corner aimed inside the box the attacking team is shooting at has
 * no distance limit. `validatePass`'s `options.maxDistance` REPLACES the per-type cap
 * entirely (see its doc comment), so a sentinel value is the correct way to express
 * "no limit" without changing `validatePass`'s signature or adding a new cap branch there.
 */
const CORNER_KICK_UNLIMITED_DISTANCE = Number.MAX_SAFE_INTEGER;

/**
 * Returns true when a corner-kick restart is in progress. Reads the PERSISTENT
 * `state.cornerKickTeam` field rather than `lastActionType` (contrast `isThrowInContext`
 * above, which does read `lastActionType`): by the time this check runs — inside the
 * GAME_ROLL PASS branch, at the same site that resolves `passOptions` below —
 * `lastActionType` has already been overwritten with the client's chosen passType (see
 * the `room.gameState = { ...room.gameState, lastActionType: passType, ... }` commit a
 * few lines below this handler's validatePass call), so a `lastActionType`-based check
 * would already be gone. `cornerKickTeam` survives unmodified until
 * `applyRoll`'s own PASS-case teardown (`CORNER_KICK_TEARDOWN`, added in Plan 38-04) runs
 * — Pitfall 3.
 */
const isCornerKickContext = (state: GameState): boolean => state.cornerKickTeam != null;

/** Typed Server alias for the project's four generic parameters. */
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Maps the socket's player slot to its controlled team.
 * Slot 1 = 'home'; slot 2 = 'away'. Convention is fixed regardless of coin-flip result.
 */
function socketTeam(socket: AppSocket): 'home' | 'away' {
  return socket.data.playerSlot === 1 ? 'home' : 'away';
}

/**
 * Returns the team allowed to act. state.activeTeam is always authoritative —
 * it is correct for D-30 (loose ball pickup mid-slot) and HIGH_PASS_MOVEMENT.
 */
function actingTeam(state: GameState): 'home' | 'away' {
  return state.activeTeam;
}

/**
 * Returns true when the socket's controlled team is the team currently allowed to act.
 * T-4-01 / T-4-04: gates game:move and game:end-turn.
 */
function isActivePlayer(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null) return false;
  return socketTeam(socket) === actingTeam(room.gameState);
}

/**
 * Returns true when the socket's controlled team is the attacking team.
 * T-4-05: gates game:start-movement (only the attacking team may start the Movement Phase).
 */
function controlsAttackingTeam(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null) return false;
  return socketTeam(socket) === room.gameState.attackingTeam;
}

/**
 * Returns true when the socket's controlled team is the GK's team.
 *
 * In GK_DIVING phase: the GK's team is the defending team (non-attacking team).
 * In GK_RESTART phase: derived from ball.carrierId (the GK holds the ball after a save).
 * This avoids reading socket.rooms (Pitfall 2) and avoids a separate gkTeam state field.
 * T-05-07: gates game:gk-restart (only the GK's team may restart).
 * T-10-08: gates GAME_GK_DIVE (only the defending/GK team may dive).
 *
 * Open Question 3 resolution: GK team derived from ball ownership for GK_RESTART;
 * derived from attackingTeam for GK_DIVING (ball carrier is the shooter, not the GK).
 */
function controlsGKTeam(socket: AppSocket, room: Room): boolean {
  if (room.gameState === null) return false;
  // In GK_DIVE the ball carrier is the shooter; derive GK team from attackingTeam instead
  if (room.gameState.phase === 'GK_DIVE') {
    const defendingTeam: 'home' | 'away' =
      room.gameState.attackingTeam === 'home' ? 'away' : 'home';
    return socketTeam(socket) === defendingTeam;
  }
  // GK_RESTART: GK holds the ball — derive from ball.carrierId
  if (room.gameState.ball.carrierId === null) return false;
  const gkPiece = room.gameState.pieces.find((p) => p.id === room.gameState!.ball.carrierId);
  if (!gkPiece) return false;
  return socketTeam(socket) === gkPiece.teamId;
}

/**
 * Per-phase field-name configuration for {@link validateResponseMoveStep} (Cluster 1,
 * Phase 18.2 DESIGN-03 consolidation). Each of the 4 GAME_MOVE response-move branches
 * (HIGH_PASS_MOVE, GK_KICK_MOVE, FIRST_TIME_PASS_MOVE, SNAPSHOT_DEFLECT) supplies its own
 * field names/values here instead of duplicating the guard sequence inline.
 */
type ResponseMoveConfig = {
  /** Which team is currently allowed to act in this phase. */
  actingTeam: 'home' | 'away';
  /** GameState field tracking the single piece locked to this phase's movement slot. */
  lockedPieceIdKey:
    | 'highPassMovedPieceId'
    | 'gkKickMovedPieceId'
    | 'firstTimePassMovedPieceId'
    | 'snapDeflectMovedPieceId'
    | 'goalKickMovedPieceId';
  /** GameState field tracking cumulative hexes moved this slot. */
  paceUsedKey:
    | 'highPassPaceUsed'
    | 'gkKickPaceUsed'
    | 'firstTimePassPaceUsed'
    | 'snapDeflectPaceUsed'
    | 'goalKickPaceUsed';
  /** Maximum hexes (pace) allowed this slot. */
  paceCap: number;
  /** GameState field identifying the original carrier/kicker who may not reposition their own piece (BUG-11 class). Omit for phases with no carrier-exclusion concept (GK_KICK_MOVE, SNAPSHOT_DEFLECT). */
  carrierExclusionKey?: 'highPassCarrierId' | 'firstTimePassCarrierId';
  /**
   * 'strict-1': click distance must be exactly 1 hex (HIGH_PASS_MOVE, GK_KICK_MOVE, FIRST_TIME_PASS_MOVE).
   * 'range': a single click may cover any distance up to the remaining pace budget (SNAPSHOT_DEFLECT).
   */
  clickDistanceMode: 'strict-1' | 'range';
};

/** Successful validation result: the caller applies its own phase-specific state merge. */
type ResponseMoveValidation = {
  ok: true;
  piece: PlayerPiece;
  /** Distance actually moved this click — equals 1 for 'strict-1', the click distance for 'range'. */
  distanceMoved: number;
};

/**
 * Shared guard sequence for the 4 GAME_MOVE response-move branches (Cluster 1,
 * Phase 18.2 DESIGN-03). Runs: active-player → ownership → optional carrier-exclusion →
 * single-piece lock → pace-cap → distance → pitch-boundary → occupancy.
 *
 * On any guard failure, emits the matching GAME_ERROR reason, calls broadcastState
 * (D-06 snap-back), and returns `{ ok: false }` — the caller must `return` immediately.
 * On success, returns the validated piece and distance moved; the caller applies its own
 * state-merge shape (event-log entry type and `...MovedPieceId`/`...PaceUsed` field names
 * differ per phase and are NOT handled here).
 *
 * CRITICAL: carrierExclusionKey must be supplied for HIGH_PASS_MOVE (highPassCarrierId,
 * BUG-11) and FIRST_TIME_PASS_MOVE (firstTimePassCarrierId) to preserve those fixes.
 */
function validateResponseMoveStep(
  io: AppServer,
  socket: AppSocket,
  room: Room,
  pieceId: string,
  to: HexCoord,
  config: ResponseMoveConfig,
): ResponseMoveValidation | { ok: false } {
  const state = room.gameState as GameState;
  const fail = (reason: Parameters<typeof socket.emit>[1]): { ok: false } => {
    socket.emit(ServerEvents.GAME_ERROR, reason as never);
    broadcastState(io, room);
    return { ok: false };
  };

  if (socketTeam(socket) !== config.actingTeam) {
    return fail('WRONG_TEAM');
  }
  const piece = state.pieces.find((p) => p.id === pieceId);
  if (!piece || piece.teamId !== config.actingTeam) {
    return fail('WRONG_TEAM');
  }
  // BUG-11 / FTP self-pass-reclaim guard: the original carrier/kicker may not reposition
  // their own piece. Only checked when the phase has a carrier-exclusion concept.
  if (config.carrierExclusionKey !== undefined && pieceId === state[config.carrierExclusionKey]) {
    return fail('WRONG_PIECE');
  }
  // Only one piece per slot: lock to the first piece moved.
  const lockedId = state[config.lockedPieceIdKey] ?? null;
  if (lockedId !== null && lockedId !== pieceId) {
    return fail('WRONG_PIECE');
  }
  const paceUsed = state[config.paceUsedKey] ?? 0;
  const paceRemaining = config.paceCap - paceUsed;
  if (paceRemaining <= 0) {
    return fail('PACE_EXCEEDED');
  }
  const clickDistance = hexDistance(piece.position, to);
  if (config.clickDistanceMode === 'strict-1') {
    if (clickDistance !== 1) {
      return fail('NOT_ADJACENT');
    }
  } else {
    if (clickDistance < 1 || clickDistance > paceRemaining) {
      return fail('NOT_ADJACENT');
    }
  }
  if (!PITCH_HEXES.some((h) => h.q === to.q && h.r === to.r)) {
    return fail('OFF_PITCH');
  }
  if (
    state.pieces.some((p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r)
  ) {
    return fail('OCCUPIED');
  }
  return { ok: true, piece, distanceMoved: clickDistance };
}

/**
 * Starts the post-game replay stream after FULL_TIME.
 *
 * D-30 / D-31 / D-32 / REPLAY-01: After a ~3s FULL_TIME display, streams one
 * GameState frame per second via setInterval. Each frame carries phase='REPLAY',
 * replayIndex (1-based), and replayTotal so the client can show progress.
 *
 * T-08-15: The interval handle is stored on room.replayTimer so it can be
 * cleared on disconnect (roomHandlers.ts) and on room deletion (deleteRoom).
 *
 * D-15 (CR-01 BLOCKER): The setTimeout callback re-fetches the live room via
 * getRoom(room.roomCode) to avoid holding a stale reference to a room that may
 * have been deleted during the 3s hold (e.g. both players disconnected). If the
 * room is gone or its gameState is null when the callback fires, the interval is
 * never created and the callback exits silently.
 *
 * @param io   - Socket.io Server instance (for room-wide emit)
 * @param room - The room that just reached FULL_TIME
 */
function startReplayStream(io: AppServer, room: Room): void {
  if (room.gameState === null) return;

  // ~3s delay so the FULL_TIME screen displays before replay begins (Open Question 3)
  // D-15 CR-01: frames are built inside the callback so we work with the live room,
  // not a stale closure reference.
  setTimeout(() => {
    // D-15 CR-01: re-fetch the live room — if deleted during the 3s hold, bail out.
    const liveRoom = getRoom(room.roomCode);
    if (!liveRoom || liveRoom.gameState === null) return;

    const frames = buildReplayFrames(liveRoom.gameState);
    const replayTotal = frames.length;
    let idx = 0;
    liveRoom.replayTimer = setInterval(() => {
      if (idx >= frames.length) {
        clearInterval(liveRoom.replayTimer!);
        liveRoom.replayTimer = null;
        return;
      }
      const frame = frames[idx++]!;
      // D-32: emit REPLAY-phase frame with position metadata (D-31, D-33)
      // Cast needed because exactOptionalPropertyTypes treats spread as losing required guarantees
      const replayFrame: import('@counter-attack/shared').GameState = {
        ...frame,
        replayIndex: idx, // 1-based (idx already incremented)
        replayTotal,
      };
      io.to(liveRoom.roomCode).emit(ServerEvents.GAME_STATE, replayFrame);
    }, 500);
  }, 3000);
}

/**
 * Registers game action event handlers on a socket.
 *
 * Called from createServer.ts for both fresh and reconnected sockets so
 * mid-game reconnects can continue sending actions.
 *
 * @param io     - Socket.io Server instance (for broadcastState)
 * @param socket - The socket to register handlers on
 */
export function registerGameHandlers(io: AppServer, socket: AppSocket): void {
  // -------------------------------------------------------------------------
  // GAME_START_MOVEMENT — transitions KICK_OFF or PASS → MOVEMENT/ATTACKER_4
  // T-4-05: only the attacking team's socket may start the Movement Phase
  // From KICK_OFF: sets kickOffActive=true (first pass must come from centre hex).
  // From PASS: starts a new 4-5-2 movement sequence without kickoff constraints.
  // THROW_IN_SETUP is deliberately NOT in this allow-list (Plan 37-05 Task 3):
  // applyStartMovement rejects any phase other than KICK_OFF/PASS/LOOSE_BALL, so a
  // client emitting game:start-movement during THROW_IN_SETUP already receives
  // WRONG_PHASE from the engine. Placement into a real Movement Phase 1 happens
  // exclusively via GAME_THROW_IN_PLACE -> applyThrowInPlace.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_START_MOVEMENT, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      if (
        room.gameState === null ||
        (room.gameState.phase !== 'KICK_OFF' &&
          room.gameState.phase !== 'PASS' &&
          room.gameState.phase !== 'LOOSE_BALL')
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // D-06: snap-back
        return;
      }
      if (!controlsAttackingTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM'); // T-4-05
        broadcastState(io, room);
        return;
      }
      // D-07 / T-08-12: sequence guard — MOVEMENT is invalid after HIGH_PASS (D-11)
      if (
        room.gameState.lastActionType !== null &&
        !ELIGIBLE_NEXT_ACTIONS[room.gameState.lastActionType].has('MOVEMENT')
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
        broadcastState(io, room);
        return;
      }
      const result = applyStartMovement(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      // D-27 / MATCH-03: kickOffActive only applies on the KICK_OFF → MOVEMENT transition.
      // From PASS, movement restarts without forcing the first pass from the centre hex.
      const kickOffActive = room.gameState.phase === 'KICK_OFF';
      room.gameState = { ...result.state, kickOffActive };
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_MOVE — applies a piece movement
  // T-4-01: non-acting player is rejected; T-4-03: from-coord is server-derived
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_MOVE, (pieceId: string, to: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5

    room.isProcessing = true;
    try {
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }

      // HIGH_PASS_MOVE: simple piece repositioning — 1 piece per team, max 3 hexes, no ball movement.
      // BUG-11 (Phase 18.2): the original high-pass kicker may not reposition their own
      // piece during HIGH_PASS_MOVE — mirrors the FTP firstTimePassCarrierId guard below
      // (Phase 17.1-16). carrierExclusionKey is the authoritative server-side guard; the
      // client selectPiece mirror is defense-in-depth.
      if (room.gameState.phase === 'HIGH_PASS_MOVE') {
        const hpState = room.gameState;
        const validation = validateResponseMoveStep(io, socket, room, pieceId, to, {
          actingTeam: hpState.activeTeam,
          lockedPieceIdKey: 'highPassMovedPieceId',
          paceUsedKey: 'highPassPaceUsed',
          paceCap: 3,
          carrierExclusionKey: 'highPassCarrierId',
          clickDistanceMode: 'strict-1',
        });
        if (!validation.ok) return;
        const { piece, distanceMoved } = validation;
        const hpMoveEvent: ActionEvent = {
          type: 'HP_MOVE',
          slot: hpState.highPassMovementSlot === 'ATTACKER' ? 'ATTACKER' : 'DEFENDER',
          pieceId,
          from: piece.position,
          to,
          timestamp: Date.now(),
        };
        room.gameState = {
          ...hpState,
          pieces: hpState.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p)),
          highPassMovedPieceId: pieceId,
          highPassPaceUsed: (hpState.highPassPaceUsed ?? 0) + distanceMoved,
          eventLog: [...hpState.eventLog, hpMoveEvent],
        };
        broadcastState(io, room);
        return;
      }

      // SNAPSHOT_DEFLECT: defending team moves 1 player up to 2 hexes before snapshot resolves.
      // 1 piece per team, max 2-hex total budget, pitch boundary, no occupied hex.
      // Active team = defending team (opponent of attackingTeam). D-08 / SNAP-02.
      // BUGFIX (snapshot-shot-flow-mismatch): previously required strict adjacency
      // (1 hex per click), forcing hex-by-hex movement unlike GK_DIVE's single-click
      // targeting for regular/headed shots. Now accepts a single click to any hex within
      // the remaining 2-hex budget, consuming the full distance moved in one step — matching
      // GK_DIVE's "click a spot directly" UX while preserving the 2-hex total budget.
      if (room.gameState.phase === 'SNAPSHOT_DEFLECT') {
        const sdState = room.gameState;
        const defendingTeam: 'home' | 'away' = sdState.attackingTeam === 'home' ? 'away' : 'home';
        const validation = validateResponseMoveStep(io, socket, room, pieceId, to, {
          actingTeam: defendingTeam,
          lockedPieceIdKey: 'snapDeflectMovedPieceId',
          paceUsedKey: 'snapDeflectPaceUsed',
          paceCap: 2,
          clickDistanceMode: 'range',
        });
        if (!validation.ok) return;
        const { piece: sdPiece, distanceMoved: clickDistance } = validation;
        // BUG-32: the goalkeeper is never an eligible deflection responder. Reject before
        // any state mutation — defense-in-depth against a modified/buggy client that
        // bypasses the HexGrid.tsx canSelectSnapDeflect client-side gate.
        if (sdPiece.role === 'GK') {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PIECE');
          broadcastState(io, room);
          return;
        }
        const paceUsed = sdState.snapDeflectPaceUsed ?? 0;
        // SNAP-02: pass-through — snapshotGkPenalty can no longer be recomputed here since
        // sdPiece can never be the GK (rejected above); the field is preserved unchanged.
        const snapshotGkPenalty = sdState.snapshotGkPenalty ?? 0;
        // BUG-18 (Phase 18.3): log SNAP_DEFLECT_MOVE so applyUndo can reverse
        // this move if the defender activates Undo before snapshot resolves.
        const snapDeflectMoveEvent: ActionEvent = {
          type: 'SNAP_DEFLECT_MOVE',
          pieceId,
          from: sdPiece.position,
          to,
          timestamp: Date.now(),
        };
        room.gameState = {
          ...sdState,
          pieces: sdState.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p)),
          snapDeflectMovedPieceId: pieceId,
          snapDeflectPaceUsed: paceUsed + clickDistance,
          snapshotGkPenalty,
          eventLog: [...sdState.eventLog, snapDeflectMoveEvent],
        };
        broadcastState(io, room);
        return;
      }

      // GK_KICK_MOVE: both teams reposition 1 piece ≤3 hexes while kick is in air.
      // Mirrors HIGH_PASS_MOVE block: adjacency, pitch boundary, occupancy, 1-piece lock.
      if (room.gameState.phase === 'GK_KICK_MOVE') {
        const gkMoveState = room.gameState;
        const validation = validateResponseMoveStep(io, socket, room, pieceId, to, {
          actingTeam: gkMoveState.activeTeam,
          lockedPieceIdKey: 'gkKickMovedPieceId',
          paceUsedKey: 'gkKickPaceUsed',
          paceCap: 3,
          clickDistanceMode: 'strict-1',
        });
        if (!validation.ok) return;
        const { piece, distanceMoved } = validation;
        const gkKickMoveEvent: ActionEvent = {
          type: 'GK_KICK_MOVE',
          slot: gkMoveState.gkKickMovementSlot === 'KICKER' ? 'KICKER' : 'OPP',
          pieceId,
          from: piece.position,
          to,
          timestamp: Date.now(),
        };
        room.gameState = {
          ...gkMoveState,
          pieces: gkMoveState.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p)),
          gkKickMovedPieceId: pieceId,
          gkKickPaceUsed: (gkMoveState.gkKickPaceUsed ?? 0) + distanceMoved,
          eventLog: [...gkMoveState.eventLog, gkKickMoveEvent],
        };
        broadcastState(io, room);
        return;
      }

      // GOAL_KICK_MOVE: both teams reposition 1 piece <=3 hexes while the goal kick
      // travels (GOALKICK-05). Distinct from the GOAL_KICK_SETUP_GK/OPPONENT branch
      // below (Plan 37-08) — that one delegates to applyGoalKickReposition for a
      // per-piece 6-hex budget; this is a single-piece-per-slot 3-hex budget, exactly
      // what validateResponseMoveStep exists for (mirrors the GK_KICK_MOVE block above).
      if (room.gameState.phase === 'GOAL_KICK_MOVE') {
        const goalKickMoveState = room.gameState;
        const validation = validateResponseMoveStep(io, socket, room, pieceId, to, {
          actingTeam: goalKickMoveState.activeTeam,
          lockedPieceIdKey: 'goalKickMovedPieceId',
          paceUsedKey: 'goalKickPaceUsed',
          paceCap: 3,
          clickDistanceMode: 'strict-1',
        });
        if (!validation.ok) return;
        const { piece, distanceMoved } = validation;
        const goalKickMoveEvent: ActionEvent = {
          type: 'GOAL_KICK_MOVE',
          slot: goalKickMoveState.goalKickMoveSlot === 'KICKER' ? 'KICKER' : 'OPP',
          pieceId,
          from: piece.position,
          to,
          timestamp: Date.now(),
        };
        room.gameState = {
          ...goalKickMoveState,
          pieces: goalKickMoveState.pieces.map((p) =>
            p.id === pieceId ? { ...p, position: to } : p,
          ),
          goalKickMovedPieceId: pieceId,
          goalKickPaceUsed: (goalKickMoveState.goalKickPaceUsed ?? 0) + distanceMoved,
          eventLog: [...goalKickMoveState.eventLog, goalKickMoveEvent],
        };
        broadcastState(io, room);
        return;
      }

      // FIRST_TIME_PASS_MOVE: both teams reposition 1 piece ≤1 hex while ball is in flight.
      // Mirrors HIGH_PASS_MOVE block: 1 piece per team, max 1 hex, adjacency,
      // pitch boundary, no occupied hex. Active team alternates ATTACKER→DEFENDER.
      // D-03 (Phase 17.1).
      // Cycle-4 self-pass-reclaim finding (D-03, Phase 17.1-16): the original passer may
      // not reposition their own piece during FTP repositioning — doing so would let them
      // move onto the (empty) passTargetHex and have the delivery lookup hand the ball
      // straight back to them. Mirrors how highPassCarrierId identifies the kicker;
      // carrierExclusionKey is the authoritative server-side guard (the client selectPiece
      // mirror is defense-in-depth).
      if (room.gameState.phase === 'FIRST_TIME_PASS_MOVE') {
        const ftpState = room.gameState;
        const validation = validateResponseMoveStep(io, socket, room, pieceId, to, {
          actingTeam: ftpState.activeTeam,
          lockedPieceIdKey: 'firstTimePassMovedPieceId',
          paceUsedKey: 'firstTimePassPaceUsed',
          paceCap: 1,
          carrierExclusionKey: 'firstTimePassCarrierId',
          clickDistanceMode: 'strict-1',
        });
        if (!validation.ok) return;
        const { piece, distanceMoved } = validation;
        const ftpMoveEvent: ActionEvent = {
          type: 'FTP_MOVE',
          slot: ftpState.firstTimePassMovementSlot === 'ATTACKER' ? 'ATTACKER' : 'DEFENDER',
          pieceId,
          from: piece.position,
          to,
          timestamp: Date.now(),
        };
        room.gameState = {
          ...ftpState,
          pieces: ftpState.pieces.map((p) => (p.id === pieceId ? { ...p, position: to } : p)),
          firstTimePassMovedPieceId: pieceId,
          firstTimePassPaceUsed: (ftpState.firstTimePassPaceUsed ?? 0) + distanceMoved,
          eventLog: [...ftpState.eventLog, ftpMoveEvent],
        };
        broadcastState(io, room);
        return;
      }

      // MOVE-06 (Phase 17, corrected design D-34/D-35): FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE —
      // each eligible piece moves up to 6 hexes independently. applyMove disambiguates
      // eligibility by phase (attack vs defense sub-list), so this guard just needs to
      // accept both sub-phases. Reuses applyMove's FREE_MOVE branch (gameEngine.ts applyFreeMove).
      if (
        room.gameState.phase === 'FREE_MOVE_ATTACK' ||
        room.gameState.phase === 'FREE_MOVE_DEFENSE'
      ) {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        // T-37-66 (Plan 37-15, closes the sibling threat 37-13 accepted and required be
        // carried) / T-37-75: this branch previously went straight to applyMove with
        // neither a payload-shape check nor a bounds check — strictly more exposed than
        // the goal-kick reposition branch below, since isPitchHex dereferences .q/.r and
        // is not null-safe. Mirrors the goal-kick branch's guard ordering exactly: the
        // payload-shape check MUST run first (isPitchHex would throw on a null/non-object
        // payload), then isPitchHex, then delegation.
        if (
          typeof to !== 'object' ||
          to === null ||
          typeof to.q !== 'number' ||
          typeof to.r !== 'number'
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
          broadcastState(io, room);
          return;
        }
        if (!isPitchHex(to)) {
          socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
          broadcastState(io, room);
          return;
        }
        const freeMoveResult = applyMove(room.gameState, pieceId, to);
        if (!freeMoveResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, freeMoveResult.reason);
          broadcastState(io, room);
          return;
        }
        room.gameState = freeMoveResult.state;
        broadcastState(io, room);
        return;
      }

      // GOALKICK-02 (Plan 37-08): GOAL_KICK_SETUP_GK/GOAL_KICK_SETUP_OPPONENT reposition
      // windows — each eligible piece moves up to 6 hexes independently, single-hex-per-
      // click. D-01: delegates to applyGoalKickReposition, NOT validateResponseMoveStep —
      // that helper is for single-piece-per-slot phases sharing one pace field; the
      // goal-kick windows are per-piece budgets, a different model (see applyFreeMove's
      // FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE branch above for the same distinction).
      if (
        room.gameState.phase === 'GOAL_KICK_SETUP_GK' ||
        room.gameState.phase === 'GOAL_KICK_SETUP_OPPONENT'
      ) {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        // ASVS V5 — validate payload shape before dispatch (never trust client input).
        if (
          typeof to !== 'object' ||
          to === null ||
          typeof to.q !== 'number' ||
          typeof to.r !== 'number'
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
          broadcastState(io, room);
          return;
        }
        // GOALKICK-02 (37-13, closes the 37-VERIFICATION.md handler-layer half of the
        // BLOCKER): defence-in-depth over the engine guard added in gameEngine.ts's
        // applyGoalKickReposition — NOT redundant with it, because this handler emits
        // goalKickResult.reason and never goalKickResult.detail (see the comment near
        // goalKick.integration.test.ts's "Wire value is the generic ApplyMoveResult
        // reason" note above the GOAL_KICK_PACE_EXHAUSTED regression test), so without
        // this guard the wire code would be the vague MOVE_INVALID instead of the
        // precise OFF_PITCH. Must stay strictly after the payload-shape check above:
        // isPitchHex dereferences .q/.r and would throw on the null/non-object
        // payloads that check exists to reject (D-13-04).
        if (!isPitchHex(to)) {
          socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
          broadcastState(io, room);
          return;
        }
        const goalKickResult = applyGoalKickReposition(room.gameState, pieceId, to);
        if (!goalKickResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, goalKickResult.reason);
          broadcastState(io, room);
          return;
        }
        room.gameState = goalKickResult.state;
        broadcastState(io, room);
        return;
      }

      // CORNER-01/CORNER-02 (38-15 defect 3, 38-21): CORNER_KICK_CLEAR_OUT's mandatory
      // pre-corner clear-out — one hex per click, attacking manager's slot first, then
      // defending. T-38-17: isActivePlayer is a correct pre-check here for the same reason
      // recorded at the CORNER_KICK_REPOSITION branch below — `activeTeam` is kept in sync
      // with the clear-out slot by `triggerOutOfBoundsRestart` (initial ATTACKER slot) and by
      // `applyCornerKickClearOutEnd`'s ATTACKER->DEFENDER slot handoff, so a non-acting
      // socket can never pass this guard even if it submits a pieceId belonging to the
      // acting team.
      // Appends NO event of its own — applyCornerKickClearOut emits its own
      // CORNER_KICK_CLEAR_OUT_MOVE, so this branch follows the CORNER_KICK_FINAL_SETUP
      // pattern below (engine owns event construction), NOT the CORNER_KICK_REPOSITION
      // pattern (handler owns event construction) — the two adjacent branches disagree on
      // exactly this point and the wrong choice double-logs every clear-out move.
      if (room.gameState.phase === 'CORNER_KICK_CLEAR_OUT') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        // ASVS V5 — validate payload shape before dispatch (mirrors the sibling corner
        // branches; hexDistance/isPitchHex inside applyCornerKickClearOut are not null-safe).
        if (
          typeof to !== 'object' ||
          to === null ||
          typeof to.q !== 'number' ||
          typeof to.r !== 'number'
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
          broadcastState(io, room);
          return;
        }
        const clearOutResult = applyCornerKickClearOut(room.gameState, pieceId, to);
        if (!clearOutResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, clearOutResult.reason);
          broadcastState(io, room);
          return;
        }
        room.gameState = clearOutResult.state;
        broadcastState(io, room);
        return;
      }

      // CORNER-03: CORNER_KICK_REPOSITION's 6-stage alternating reposition window.
      // T-38-17: isActivePlayer is a correct pre-check here (activeTeam is kept in sync
      // with cornerKickStageTeam at every stage transition — see applyCornerKickStageEnd)
      // and closes a gap applyCornerKickReposition's own guard leaves open: that guard only
      // verifies the SELECTED PIECE's team against the derived acting team, never the
      // REQUESTING socket's team, so without this check a non-acting socket could submit a
      // pieceId belonging to the acting team and have it accepted.
      if (room.gameState.phase === 'CORNER_KICK_REPOSITION') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        // ASVS V5 — validate payload shape before dispatch (mirrors the goal-kick branch;
        // hexDistance/isPitchHex inside applyCornerKickReposition are not null-safe).
        if (
          typeof to !== 'object' ||
          to === null ||
          typeof to.q !== 'number' ||
          typeof to.r !== 'number'
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
          broadcastState(io, room);
          return;
        }
        // Capture `from` before the engine call — applyCornerKickReposition deliberately
        // does NOT append its own MOVE event (see its doc comment: "the reposition windows
        // reuse the existing GAME_MOVE handler, which emits its own event"), so this
        // handler owns event construction, mirroring applyGoalKickReposition's own
        // internal MOVE event shape (slot 'ATTACKER_2' — CORNER_KICK_REPOSITION has no
        // MovementSlot of its own, same reasoning as the goal-kick reposition windows).
        const priorPiece = room.gameState.pieces.find((p) => p.id === pieceId);
        const from = priorPiece?.position ?? to;
        const cornerRepoResult = applyCornerKickReposition(room.gameState, pieceId, to);
        if (!cornerRepoResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, cornerRepoResult.reason);
          broadcastState(io, room);
          return;
        }
        const cornerMoveEvent: ActionEvent = {
          type: 'MOVE',
          pieceId,
          from,
          to,
          slot: 'ATTACKER_2',
          timestamp: Date.now(),
          ballAfter: {
            position: cornerRepoResult.state.ball.position,
            carrierId: cornerRepoResult.state.ball.carrierId,
          },
        };
        room.gameState = {
          ...cornerRepoResult.state,
          eventLog: [...cornerRepoResult.state.eventLog, cornerMoveEvent],
        };
        broadcastState(io, room);
        return;
      }

      // CORNER-06: CORNER_KICK_FINAL_SETUP's 2-slot (ATTACKER, then DEFENDER) pre-kick
      // reposition window. Unlike CORNER_KICK_REPOSITION above, applyCornerKickFinalMove
      // DOES append its own CORNER_KICK_MOVE event internally — this handler must NOT
      // construct a second one (would double-log every move in Undo/Replay).
      if (room.gameState.phase === 'CORNER_KICK_FINAL_SETUP') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        if (
          typeof to !== 'object' ||
          to === null ||
          typeof to.q !== 'number' ||
          typeof to.r !== 'number'
        ) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
          broadcastState(io, room);
          return;
        }
        const cornerFinalMoveResult = applyCornerKickFinalMove(room.gameState, pieceId, to);
        if (!cornerFinalMoveResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, cornerFinalMoveResult.reason);
          broadcastState(io, room);
          return;
        }
        room.gameState = cornerFinalMoveResult.state;
        broadcastState(io, room);
        return;
      }

      if (room.gameState.phase !== 'MOVE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM'); // T-4-01
        broadcastState(io, room);
        return;
      }
      // D-08/D-12: pre-generate all dice that may be consumed by applyMove.
      // Generated here (in the I/O layer) so the pure engine stays deterministic for tests.
      const stealDie = rollDice();
      const tackleDie = rollDice();
      const carrierDie = rollDice();
      const result = applyMove(room.gameState, pieceId, to, { stealDie, tackleDie, carrierDie });
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // D-06: snap-back on rejection
        return;
      }
      room.gameState = result.state;
      // OFFSIDE-02 (D-26): the lone GAME_MOVE applyMove success path covers any loose-ball
      // pickup AND a successful steal/tackle (both always set ball.carrierId to the
      // acting/winning piece) — no-op when the new carrier isn't flagged offside.
      // D-53: applyOffsideFoulWithRelocation wraps triggerOffsideFoul + auto-relocates
      // any conceding-team piece trapped within 2 hexes of the new restart spot.
      room.gameState = applyOffsideFoulWithRelocation(room.gameState);
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_END_TURN — advances the movement slot (D-03) or transitions to PASS (D-04)
  // T-4-04: non-acting player is rejected
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_END_TURN, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5

    room.isProcessing = true;
    try {
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }

      // GK_DIVE: shot now resolves via GAME_GK_DIVE (single-click dive + auto-resolve).
      // End-turn in this phase is a no-op — just snap back so the client stays in sync.
      if (room.gameState.phase === 'GK_DIVE') {
        broadcastState(io, room);
        return;
      }

      // HIGH_PASS_MOVE: slot transitions + auto accuracy roll after defender slot.
      if (room.gameState.phase === 'HIGH_PASS_MOVE') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const hpState = room.gameState;
        if (hpState.highPassMovementSlot === 'ATTACKER') {
          // Log attacker repositioning then switch to defender's turn
          const attackerReposEvent: ActionEvent = {
            type: 'HP_REPOSITION',
            slot: 'ATTACKER',
            pieceId: hpState.highPassMovedPieceId ?? null,
            timestamp: Date.now(),
          };
          const defenderTeam: 'home' | 'away' = hpState.attackingTeam === 'home' ? 'away' : 'home';
          room.gameState = {
            ...hpState,
            highPassMovementSlot: 'DEFENDER',
            activeTeam: defenderTeam,
            highPassMovedPieceId: null,
            highPassPaceUsed: 0,
            eventLog: [...hpState.eventLog, attackerReposEvent],
          };
          broadcastState(io, room);
        } else {
          // Log defender repositioning then roll accuracy.
          // Restore ball.carrierId from highPassCarrierId so applyRoll can find the kicker's stat.
          const defenderReposEvent: ActionEvent = {
            type: 'HP_REPOSITION',
            slot: 'DEFENDER',
            pieceId: hpState.highPassMovedPieceId ?? null,
            timestamp: Date.now(),
          };
          const d1 = rollDice();
          const d2 = rollDice();
          const d3 = rollDice();
          const stateForRoll: typeof hpState = {
            ...hpState,
            phase: 'PASS',
            ball: { ...hpState.ball, carrierId: hpState.highPassCarrierId ?? null },
            activeTeam: hpState.attackingTeam,
            highPassMovementSlot: null,
            highPassMovedPieceId: null,
            highPassPaceUsed: 0,
            highPassCarrierId: null,
            eventLog: [...hpState.eventLog, defenderReposEvent],
          };
          const result = applyRoll(stateForRoll, d1, d2, d3);
          if (!result.ok) {
            socket.emit(ServerEvents.GAME_ERROR, result.reason);
            broadcastState(io, room);
            return;
          }
          room.gameState = result.state;
          broadcastState(io, room);
          if (result.state.phase === 'FULL_TIME') {
            startReplayStream(io, room);
          }
        }
        return;
      }

      // FIRST_TIME_PASS_MOVE: slot transitions + ball delivery after defender slot.
      // Mirrors HIGH_PASS_MOVE: ATTACKER slot → DEFENDER slot → deliver ball to passTargetHex.
      // No accuracy roll on delivery (D-03: no interception check). D-03 (Phase 17.1).
      if (room.gameState.phase === 'FIRST_TIME_PASS_MOVE') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const ftpEndState = room.gameState;
        if (ftpEndState.firstTimePassMovementSlot === 'ATTACKER') {
          // Log attacker repositioning then switch to defender's turn
          const attackerReposEvent: ActionEvent = {
            type: 'FTP_REPOSITION',
            slot: 'ATTACKER',
            pieceId: ftpEndState.firstTimePassMovedPieceId ?? null,
            timestamp: Date.now(),
          };
          const defenderTeam: 'home' | 'away' =
            ftpEndState.attackingTeam === 'home' ? 'away' : 'home';
          room.gameState = {
            ...ftpEndState,
            firstTimePassMovementSlot: 'DEFENDER',
            activeTeam: defenderTeam,
            firstTimePassMovedPieceId: null,
            firstTimePassPaceUsed: 0,
            eventLog: [...ftpEndState.eventLog, attackerReposEvent],
          };
          broadcastState(io, room);
        } else {
          // DEFENDER slot done: log defender repositioning, deliver ball to passTargetHex.
          // D-03: no interception check on delivery — ball goes straight to target.
          const defenderReposEvent: ActionEvent = {
            type: 'FTP_REPOSITION',
            slot: 'DEFENDER',
            pieceId: ftpEndState.firstTimePassMovedPieceId ?? null,
            timestamp: Date.now(),
          };
          const targetHex = ftpEndState.passTargetHex!;
          // Review-CR-02 / BUG-04 (D-08/D-09) parity: team-agnostic occupant search —
          // find ANY piece at targetHex (no teamId filter), mirroring gameEngine.ts
          // BUG-04 (1272-1297) used for STANDARD_PASS/LONG_BALL occupant delivery.
          // A defending-team occupant must receive the ball (possession transfers);
          // an attacking-team occupant keeps possession unchanged (happy path);
          // no occupant delivers to the empty hex with carrierId:null (unchanged).
          // Cycle-4 self-pass-reclaim finding (D-03, Phase 17.1-16): exclude the original
          // passer (firstTimePassCarrierId) — defense in depth behind the GAME_MOVE rejection
          // above; even if the passer were somehow standing on passTargetHex, the ball must
          // not be handed back to them.
          const occupant = ftpEndState.pieces.find(
            (p) =>
              p.position.q === targetHex.q &&
              p.position.r === targetHex.r &&
              p.id !== ftpEndState.firstTimePassCarrierId,
          );
          const possessionChanges = occupant
            ? occupant.teamId !== ftpEndState.attackingTeam
            : false;
          const deliveryTeam = possessionChanges ? occupant!.teamId : ftpEndState.attackingTeam;
          room.gameState = {
            ...ftpEndState,
            phase: 'PASS',
            ball: occupant
              ? {
                  position: occupant.position,
                  carrierId: occupant.id,
                  lastTouchedBy: { pieceId: occupant.id, teamId: occupant.teamId },
                }
              : {
                  position: targetHex,
                  carrierId: null,
                  // No occupant: carry forward — the passer's lastTouchedBy was already set
                  // when the ball went in flight at the FIRST_TIME_PASS transition.
                  lastTouchedBy: ftpEndState.ball.lastTouchedBy,
                },
            lastActionType: 'FIRST_TIME_PASS',
            attackingTeam: deliveryTeam,
            activeTeam: deliveryTeam,
            firstTimePassMovementSlot: null,
            firstTimePassMovedPieceId: null,
            firstTimePassPaceUsed: 0,
            // Carrier id is only cleared once the ball is delivered — mirrors the
            // HIGH_PASS clear of highPassCarrierId:null (Phase 17.1-16).
            firstTimePassCarrierId: null,
            passTargetHex: null,
            stealAttemptedByIds: [], // D-02: reset at every 'PASS' transition
            tackleAttemptedByIds: [], // D-02
            eventLog: [...ftpEndState.eventLog, defenderReposEvent],
          };
          broadcastState(io, room);
          if (room.gameState.phase === 'FULL_TIME') {
            startReplayStream(io, room);
          }
        }
        return;
      }

      // GK_KICK_MOVE: slot transitions + accuracy check after OPP slot.
      if (room.gameState.phase === 'GK_KICK_MOVE') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const gkEndState = room.gameState;
        if (gkEndState.gkKickMovementSlot === 'KICKER') {
          // KICKER slot done: switch to opponent's repositioning turn
          const oppTeam: 'home' | 'away' = gkEndState.attackingTeam === 'home' ? 'away' : 'home';
          room.gameState = {
            ...gkEndState,
            gkKickMovementSlot: 'OPP',
            activeTeam: oppTeam,
            gkKickMovedPieceId: null,
            gkKickPaceUsed: 0,
          };
          broadcastState(io, room);
        } else {
          // OPP slot done: roll accuracy and deliver ball (or loose ball)
          const kickDie = rollDice();
          const gk = gkEndState.pieces.find((p) => p.id === gkEndState.gkKickGkId);
          const kickScore = kickDie + (gk?.highPass ?? 0);
          const accurate = kickScore >= 8;
          const targetHex = gkEndState.gkKickTargetHex!;
          const gkTeam = gkEndState.attackingTeam; // attackingTeam = GK's team throughout GK kick phases

          // Resolve receiver before kickEvent construction so ballAfter.carrierId is populated
          // (REPLAY-07 / D-09: receiver must be known at event construction, not post-hoc).
          const receiver = accurate
            ? gkEndState.pieces.find(
                (p) =>
                  p.teamId === gkTeam &&
                  p.position.q === targetHex.q &&
                  p.position.r === targetHex.r,
              )
            : null;

          const kickEvent: ActionEvent = {
            type: 'GK_KICK',
            gkId: gkEndState.gkKickGkId ?? '',
            targetHex,
            accurate,
            kickDie,
            kickScore,
            timestamp: Date.now(),
            ballAfter: { position: targetHex, carrierId: accurate ? (receiver?.id ?? null) : null },
          };

          if (accurate) {
            room.gameState = {
              ...gkEndState,
              phase: 'PASS',
              ball: {
                position: targetHex,
                carrierId: receiver?.id ?? null,
                lastTouchedBy: receiver
                  ? { pieceId: receiver.id, teamId: receiver.teamId }
                  : { pieceId: gk?.id ?? '', teamId: gkTeam },
              },
              attackingTeam: gkTeam,
              activeTeam: gkTeam,
              lastDiceRoll: { rolls: [kickDie], context: 'GK_KICK' },
              lastActionType: 'MOVEMENT_PHASE',
              lastShotPath: null,
              actionCount: gkEndState.actionCount + 1,
              gkKickTargetHex: null,
              gkKickGkId: null,
              gkKickMovementSlot: null,
              gkKickMovedPieceId: null,
              gkKickPaceUsed: 0,
              eventLog: [...gkEndState.eventLog, kickEvent],
            };
          } else {
            // Inaccurate: loose ball at the target hex (ball went wide of its destination)
            room.gameState = {
              ...gkEndState,
              phase: 'LOOSE_BALL',
              // Inaccurate kick: ball went wide, no receiver — kicker (GK) is the last toucher.
              ball: {
                position: targetHex,
                carrierId: null,
                lastTouchedBy: { pieceId: gk?.id ?? '', teamId: gkTeam },
              },
              attackingTeam: gkTeam,
              activeTeam: gkTeam,
              lastDiceRoll: { rolls: [kickDie], context: 'GK_KICK' },
              lastActionType: 'DEFLECTION',
              lastShotPath: null,
              actionCount: gkEndState.actionCount + 1,
              gkKickTargetHex: null,
              gkKickGkId: null,
              gkKickMovementSlot: null,
              gkKickMovedPieceId: null,
              gkKickPaceUsed: 0,
              eventLog: [...gkEndState.eventLog, kickEvent],
            };
          }
          broadcastState(io, room);
        }
        return;
      }

      // GOAL_KICK_MOVE: slot transitions (KICKER -> OPP) + the accuracy roll after the
      // OPP slot (GOALKICK-05). Delegates the whole travel-window resolution to the
      // pure applyGoalKickMoveEnd — this handler only generates the die (ARCH-01) and
      // broadcasts the result. Never produces FULL_TIME, so no startReplayStream call.
      if (room.gameState.phase === 'GOAL_KICK_MOVE') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        // WR-02: the delegate below reads kickDie only on the OPP slot (documented
        // at gameEngine.ts ~3804-3808), so the KICKER slot previously burned a
        // crypto.randomInt draw whose value nothing could observe. 0 is passed as
        // an inert placeholder to keep the engine signature total, per ARCH-01
        // (the engine must never roll for itself) and D-12-04 (do not split or
        // loosen the engine signature).
        const kickDie = room.gameState.goalKickMoveSlot === 'OPP' ? rollDice() : 0;
        const goalKickEndResult = applyGoalKickMoveEnd(room.gameState, kickDie);
        if (!goalKickEndResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, goalKickEndResult.reason);
          broadcastState(io, room);
          return;
        }
        room.gameState = goalKickEndResult.state;
        broadcastState(io, room);
        return;
      }

      // SNAPSHOT_DEFLECT: defending team ends their deflection turn.
      // Flow mirrors GAME_SHOT: deflection check → GK range check → GK_DIVE (or auto-GOAL).
      if (room.gameState.phase === 'SNAPSHOT_DEFLECT') {
        const sdState = room.gameState;
        const defendingTeam: 'home' | 'away' = sdState.attackingTeam === 'home' ? 'away' : 'home';
        if (socketTeam(socket) !== defendingTeam) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        // Strip snap-deflect tracking fields from base state

        const {
          snapDeflectMovedPieceId: _smpi,
          snapDeflectPaceUsed: _sppu,
          ...baseSnapState
        } = sdState;

        // Deflection check (same pattern as GAME_SHOT)
        const snapShooter = baseSnapState.pieces.find((p) => p.id === baseSnapState.ball.carrierId);
        const snapTarget = baseSnapState.shotTargetHex;
        const snapDefInputs: DefenderDeflectionInput[] = [];
        if (snapShooter && snapTarget) {
          const pathHexes = hexLine(snapShooter.position, snapTarget);
          const pathSet = new Set(pathHexes.map((h) => `${h.q},${h.r}`));
          for (const defender of baseSnapState.pieces.filter(
            (p) => p.teamId === defendingTeam && p.role !== 'GK',
          )) {
            const onPath = pathSet.has(`${defender.position.q},${defender.position.r}`);
            let nearPath = false;
            if (!onPath) {
              for (const ph of pathHexes) {
                if (hexDistance(defender.position, ph) === 1) {
                  nearPath = true;
                  break;
                }
              }
            }
            if (onPath || nearPath) {
              snapDefInputs.push({
                defenderId: defender.id,
                defenderPosition: defender.position,
                tackling: defender.tackling,
                die: rollDice(),
                band: onPath ? 'A' : 'B',
              });
            }
          }
        }

        const deflectEvents: ActionEvent[] = [];
        for (const def of snapDefInputs) {
          const didDeflect =
            def.band === 'A'
              ? def.die === 5 || def.die === 6 || def.die + def.tackling >= 10
              : def.die === 6 || def.die + def.tackling >= 10;
          deflectEvents.push({
            type: 'DEFLECT_ATTEMPT',
            defenderId: def.defenderId,
            band: def.band,
            die: def.die,
            tackling: def.tackling,
            result: didDeflect ? 'DEFLECTED' : 'NO_DEFLECT',
            timestamp: Date.now(),
          });
          if (didDeflect) break;
        }

        const snapDeflectResult = computeShotPathDeflection(snapDefInputs);
        if (snapDeflectResult.deflected && snapDeflectResult.deflectorPosition) {
          // D-06: DEFLECT_ATTEMPT resolving to DEFLECTED — the deflecting piece is the last toucher.
          const deflectorPiece = baseSnapState.pieces.find(
            (p) => p.id === snapDeflectResult.deflectorId,
          );
          room.gameState = {
            ...baseSnapState,
            phase: 'LOOSE_BALL',
            ball: {
              position: snapDeflectResult.deflectorPosition,
              carrierId: null,
              lastTouchedBy: deflectorPiece
                ? { pieceId: deflectorPiece.id, teamId: deflectorPiece.teamId }
                : baseSnapState.ball.lastTouchedBy,
            },
            lastActionType: 'DEFLECTION',
            shotTargetHex: null,
            gkDivePosition: null,
            lastShotPath: null,
            snapshotGkPenalty: null,
            eventLog: [...baseSnapState.eventLog, ...deflectEvents],
          };
          // OFFSIDE-02 D-41: the ball is deliberately left loose (carrierId: null) here, so
          // the implicit triggerOffsideFoul(state) entry point can't see who touched it.
          // Pass the deflecting defender's id explicitly — fires (or no-ops) the foul using
          // their identity even though they never gain clean possession.
          // D-53: applyOffsideFoulWithRelocation wraps triggerOffsideFoul + relocation.
          room.gameState = applyOffsideFoulWithRelocation(
            room.gameState,
            snapDeflectResult.deflectorId,
          );
          broadcastState(io, room);
          return;
        }

        // GK range check: auto-GOAL if no path hex within 3 hexes of GK
        const snapGk = baseSnapState.pieces.find(
          (p) => p.teamId === defendingTeam && p.role === 'GK',
        );
        const reachableSnapPath =
          snapShooter && snapTarget ? hexLine(snapShooter.position, snapTarget) : [];
        const snapGkHasReachable =
          snapGk !== undefined &&
          reachableSnapPath.some((h) => hexDistance(snapGk.position, h) <= 3);

        if (!snapGkHasReachable) {
          const scoringTeam = baseSnapState.attackingTeam;
          const newKickOffTeam = defendingTeam;
          const outDie1 = rollDice();
          const outDie2 = rollDice();
          const outOfRangeEvent: ActionEvent = {
            type: 'SHOT_ATTEMPT',
            shooterId: baseSnapState.ball.carrierId ?? '',
            gkId: snapGk?.id ?? '',
            targetHex: snapTarget ?? { q: 0, r: 0 },
            outcome: 'GOAL',
            shooterDie: outDie1,
            shooterScore: null,
            gkDie: outDie2,
            gkScore: null,
            handlingDie: null,
            gkHandling: null,
            shooterPenaltyTotal: 0,
            gkPenaltyTotal: 0,
            timestamp: Date.now(),
            ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
          };
          const newScore = {
            ...baseSnapState.score,
            [scoringTeam]: baseSnapState.score[scoringTeam] + 1,
          };
          // D-01 (BUG-30): hoist once and feed both state.pieces and the GOAL event's
          // piecesAfter so buildReplayFrames reconstructs every piece at the new kickoff
          // formation, not just the ball (mirrors gameEngine.ts's resetPieces pattern).
          const resetPieces = buildKickOffPieces(
            newKickOffTeam,
            baseSnapState.selectedTeams,
            baseSnapState.selectedFormation,
          );
          room.gameState = {
            ...baseSnapState,
            pieces: resetPieces,
            phase: 'KICK_OFF_SETUP',
            score: newScore,
            attackingTeam: newKickOffTeam,
            activeTeam: newKickOffTeam,
            ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null, lastTouchedBy: null }, // kick-off reset — fresh state
            lastDiceRoll: { rolls: [outDie1, outDie2], context: 'SHOT_DUEL' },
            lastActionType: null,
            lastShotPath: null,
            gkDivePosition: null,
            shotTargetHex: null,
            snapshotGkPenalty: null,
            eventLog: [
              ...baseSnapState.eventLog,
              ...deflectEvents,
              outOfRangeEvent,
              {
                type: 'GOAL' as const,
                scoringTeam,
                scorerId: outOfRangeEvent.shooterId,
                timestamp: Date.now(),
                ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
                piecesAfter: resetPieces, // D-01 (BUG-30): reconstruct all pieces at kickoff in replay
              },
            ],
          };
          broadcastState(io, room);
          return;
        }

        // GK in range: transition to GK_DIVE so GK can choose a dive hex
        room.gameState = {
          ...baseSnapState,
          phase: 'GK_DIVE',
          lastActionType: 'SHOT',
          gkDivePosition: snapGk.position,
          snapshotGkPenalty: null,
          eventLog: [...baseSnapState.eventLog, ...deflectEvents],
        };
        broadcastState(io, room);
        return;
      }

      // MOVE-06 (Phase 17, corrected design D-35/D-36): FREE_MOVE_ATTACK/FREE_MOVE_DEFENSE
      // end on End Turn — applyFreeMoveEnd already knows which sub-phase it's exiting and
      // does the right thing (hand off to DEFENSE, or restore from freeMoveResume).
      if (
        room.gameState.phase === 'FREE_MOVE_ATTACK' ||
        room.gameState.phase === 'FREE_MOVE_DEFENSE'
      ) {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const result = applyFreeMoveEnd(room.gameState);
        room.gameState = result.state;
        broadcastState(io, room);
        return;
      }

      // GOALKICK-02 (Plan 37-08): ends the active goal-kick reposition window —
      // applyGoalKickWindowEnd already knows which window it's exiting and does the
      // right thing (hand off to the opponent window, skip to GOAL_KICK_CHOICE, or
      // always-advance from the opponent window). Mirrors the FREE_MOVE_END branch above.
      if (
        room.gameState.phase === 'GOAL_KICK_SETUP_GK' ||
        room.gameState.phase === 'GOAL_KICK_SETUP_OPPONENT'
      ) {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const goalKickEndResult = applyGoalKickWindowEnd(room.gameState);
        if (!goalKickEndResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, goalKickEndResult.reason);
          broadcastState(io, room);
          return;
        }
        room.gameState = goalKickEndResult.state;
        broadcastState(io, room);
        return;
      }

      // CORNER-01/CORNER-02 (38-15 defect 3, 38-21): confirms the active clear-out slot.
      // Delegates straight to applyCornerKickClearOutEnd(room.gameState, socketTeam(socket))
      // with no handler-level pre-check — the engine owns the acting-team comparison,
      // exactly as applyCornerKickStageEnd's branch below does, and exactly as this
      // plan's own instructions require. MUST_CLEAR_CORNER is the rejection reason a
      // player actually sees when in-zone pieces still have a legal step remaining.
      if (room.gameState.phase === 'CORNER_KICK_CLEAR_OUT') {
        const clearOutEndResult = applyCornerKickClearOutEnd(room.gameState, socketTeam(socket));
        if (!clearOutEndResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, clearOutEndResult.reason);
          broadcastState(io, room);
          return;
        }
        room.gameState = clearOutEndResult.state;
        broadcastState(io, room);
        return;
      }

      // CORNER-01: ends the active corner-kick GK reposition window (attacking GK's
      // window, then defending GK's window). Mirrors the GOAL_KICK_SETUP_GK/OPPONENT
      // branch above — activeTeam is kept in sync at every corner-kick GK transition
      // (triggerOutOfBoundsRestart sets it to cornerKickTeam at entry;
      // applyCornerKickGkWindowEnd flips it to the defending team on advance), so
      // isActivePlayer is a correct pre-check here, unlike FREE_KICK_SETUP's stage-team
      // special case below.
      if (
        room.gameState.phase === 'CORNER_KICK_GK_SETUP_ATTACKING' ||
        room.gameState.phase === 'CORNER_KICK_GK_SETUP_DEFENDING'
      ) {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const cornerGkEndResult = applyCornerKickGkWindowEnd(room.gameState);
        if (!cornerGkEndResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, cornerGkEndResult.reason);
          broadcastState(io, room);
          return;
        }
        room.gameState = cornerGkEndResult.state;
        broadcastState(io, room);
        return;
      }

      // CORNER-03 (D-06): ends the CURRENTLY-active stage of the CORNER_KICK_REPOSITION
      // window. Passes socketTeam(socket) straight through without a handler-level
      // pre-check — applyCornerKickStageEnd owns the stage-team comparison exactly as
      // applyFreeKickReady does for FREE_KICK_SETUP (see the GAME_UNDO handler's
      // stage-team special case for the analogous reasoning). Confirming with 0 pieces
      // moved this stage is legal (D-06) — no minimum-move guard here.
      if (room.gameState.phase === 'CORNER_KICK_REPOSITION') {
        const cornerStageEndResult = applyCornerKickStageEnd(room.gameState, socketTeam(socket));
        if (!cornerStageEndResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, cornerStageEndResult.reason);
          broadcastState(io, room);
          return;
        }
        room.gameState = cornerStageEndResult.state;
        broadcastState(io, room);
        return;
      }

      // CORNER-06: ends the active CORNER_KICK_FINAL_SETUP slot (ATTACKER, then
      // DEFENDER). Unlike applyCornerKickStageEnd, applyCornerKickFinalSetupEnd takes no
      // team parameter and performs no team validation of its own (T-38-17) — this
      // handler-level isActivePlayer guard is the sole acting-team check, mirroring the
      // GOAL_KICK_MOVE End Turn branch's identical-shape applyGoalKickMoveEnd pattern.
      // activeTeam is kept in sync across both slots (applyCornerKickFinalSetupEnd flips
      // it on the ATTACKER->DEFENDER handoff), so isActivePlayer is correct here.
      // Explicitly generates NO die (unlike the GOAL_KICK_MOVE branch above): Corner's
      // kick has not been taken yet when this window ends — the High/Low choice and its
      // accuracy roll come later, from the client's own GAME_ROLL request in the
      // resulting PASS phase. Do NOT "restore" a missing die here.
      if (room.gameState.phase === 'CORNER_KICK_FINAL_SETUP') {
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
        const cornerFinalEndResult = applyCornerKickFinalSetupEnd(room.gameState);
        if (!cornerFinalEndResult.ok) {
          socket.emit(ServerEvents.GAME_ERROR, cornerFinalEndResult.reason);
          broadcastState(io, room);
          return;
        }
        room.gameState = cornerFinalEndResult.state;
        broadcastState(io, room);
        return;
      }

      if (room.gameState.phase !== 'MOVE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM'); // T-4-04
        broadcastState(io, room);
        return;
      }
      // D-05 / MATCH-02: pre-generate added-time roll; consumed by applyEndTurn only when
      // actionCount crosses 45 and addedTime is null. crypto.randomInt-backed (Pitfall 1).
      const addedTimeRoll = rollDice();
      const result = applyEndTurn(room.gameState, { addedTimeRoll });
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
      // D-30 / D-31 / REPLAY-01: when FULL_TIME is reached, broadcast the FULL_TIME state
      // first (already done above), then schedule the replay stream after ~3s (Open Question 3).
      if (result.state.phase === 'FULL_TIME') {
        startReplayStream(io, room);
      }
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_UNDO — reverses the last move in the current slot (D-09, D-10)
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_UNDO, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5

    room.isProcessing = true;
    try {
      // BUG-03 (Phase 17 D-06): undo is valid in MOVE and HIGH_PASS_MOVE phases
      // D-03 (Phase 17.1): also valid in FIRST_TIME_PASS_MOVE
      // BUG-18 (Phase 18.3): extended to cover all move-bearing phases. KICK_OFF_SETUP
      // is intentionally excluded — its Undo is out of scope this phase.
      // Phase 37 (37-02): GOAL_KICK_SETUP_GK/GOAL_KICK_SETUP_OPPONENT/GOAL_KICK_MOVE added —
      // each contains a reversible piece move. THROW_IN_SETUP/GOAL_KICK_CHOICE/GOAL_KICK_TARGET
      // are deliberately NOT added — those phases contain no reversible piece move, and adding
      // them would make Undo a silent no-op there.
      // Phase 38 (38-05): CORNER_KICK_REPOSITION/CORNER_KICK_FINAL_SETUP added — each
      // contains a reversible piece move (CORNER-03/CORNER-06). CORNER_KICK_GK_SETUP_
      // ATTACKING/_DEFENDING/CORNER_KICK_TAKER_SELECT are deliberately NOT added — those
      // three steps are placements with no per-hex move to reverse, mirroring the
      // rationale for excluding THROW_IN_SETUP/GOAL_KICK_CHOICE/GOAL_KICK_TARGET above.
      // Phase 38 (38-20/38-21): CORNER_KICK_CLEAR_OUT joins that same exclusion list —
      // per 38-20's recorded design decision the mandatory pre-corner clear-out is not
      // undoable, exactly like the GK setup windows and taker select it sits alongside;
      // do NOT add it here.
      const validUndoPhases: GamePhase[] = [
        'MOVE',
        'HIGH_PASS_MOVE',
        'FIRST_TIME_PASS_MOVE',
        'GK_KICK_MOVE',
        'SNAPSHOT_DEFLECT',
        'FREE_MOVE_ATTACK',
        'FREE_MOVE_DEFENSE',
        'FREE_KICK_SETUP',
        'GOAL_KICK_SETUP_GK',
        'GOAL_KICK_SETUP_OPPONENT',
        'GOAL_KICK_MOVE',
        'CORNER_KICK_REPOSITION',
        'CORNER_KICK_FINAL_SETUP',
      ];
      if (room.gameState === null || !validUndoPhases.includes(room.gameState.phase)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // During FREE_KICK_SETUP, activeTeam is not updated between stages — use the stage
      // team from freeKickStageTeam instead of isActivePlayer (which reads activeTeam).
      // CORNER_KICK_REPOSITION does NOT need an equivalent special-case arm (verified
      // empirically, Plan 38-05 Task 2): unlike FREE_KICK_SETUP, Corner's activeTeam IS
      // updated at every stage transition (triggerOutOfBoundsRestart sets it to
      // cornerKickTeam at entry; applyCornerKickStageEnd sets it to
      // cornerKickStageTeam(nextIndex, cornerKickTeam) on every advance) — so the default
      // isActivePlayer branch below is already correct for both CORNER_KICK_REPOSITION and
      // CORNER_KICK_FINAL_SETUP (whose activeTeam is likewise kept in sync by
      // applyCornerKickFinalSetupEnd's ATTACKER->DEFENDER handoff).
      if (room.gameState.phase === 'FREE_KICK_SETUP') {
        const fkState = room.gameState;
        const stageTeam =
          fkState.freeKickStageIndex !== null &&
          fkState.freeKickStageIndex !== undefined &&
          fkState.freeKickAttackingTeam
            ? freeKickStageTeam(fkState.freeKickStageIndex, fkState.freeKickAttackingTeam)
            : null;
        if (!stageTeam || socketTeam(socket) !== stageTeam) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room);
          return;
        }
      } else if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyUndo(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_RESTART_MOVEMENT — resets movement phase to ATTACKER_4 (house-rule repeat)
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_RESTART_MOVEMENT, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return;
    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'MOVE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // D-24: snap-back so client re-syncs
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // D-24: snap-back so client re-syncs
        return;
      }
      const result = applyRestartMovement(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // D-24: snap-back so client re-syncs
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room);
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_CANCEL_MOVEMENT — reverts MOVEMENT phase back to PASS before any piece has moved
  // BUG-02 (Phase 17 D-03/D-04/D-05): cancel is only available when paceUsedByPieceId is empty.
  // No movement slot is consumed on cancel.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_CANCEL_MOVEMENT, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return;
    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'MOVE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyCancelMovement(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room);
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_ROLL — rolls dice and resolves the current stochastic phase
  // T-05-03: WRONG_TEAM guard rejects non-active sockets before dice are generated
  // T-05-04: WRONG_PHASE guard limits resolution to DICE_PHASES (PASS/SHOT/HEADER/LOOSE_BALL)
  // T-05-05: isProcessing mutex prevents double-click race (SC-5)
  // D-10: single broadcastState after each resolution (ARCH-04)
  //
  // passType (optional): when phase===PASS, client sends the chosen pass type.
  // Server validates it is eligible for the current lastActionType and sets
  // lastActionType=passType before calling applyRoll so the engine records the
  // correct action and computes the correct time cost.
  //
  // D-10 (Phase 8.2): targetHex carries the destination hex for High/Long pass
  // accuracy resolution. Server authoritatively re-runs validatePass before
  // committing passTargetHex to state (ASVS V5).
  // -------------------------------------------------------------------------
  socket.on(
    ClientEvents.GAME_ROLL,
    (
      passType?: 'STANDARD_PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_BALL',
      targetHex?: HexCoord,
    ) => {
      const { roomCode } = socket.data;
      if (roomCode === undefined) return;
      const room = getRoom(roomCode);
      if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

      room.isProcessing = true;
      try {
        // Phase guard — must be in a dice-requiring phase (T-05-04)
        if (room.gameState === null || !DICE_PHASES.has(room.gameState.phase)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
          broadcastState(io, room); // snap-back
          return;
        }
        // Team guard — must be the active player (T-05-03)
        if (!isActivePlayer(socket, room)) {
          socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
          broadcastState(io, room); // snap-back
          return;
        }

        if (room.gameState.phase === 'PASS' || room.gameState.phase === 'KICK_OFF') {
          // T-37-26: capture the pre-commit throw-in context before this branch
          // overwrites lastActionType with the chosen passType below — the context
          // teardown (step 4) needs the value as it was BEFORE the throw was taken.
          const wasThrowIn = isThrowInContext(room.gameState.lastActionType);
          // Pass phase requires a passType from the client (choose-phase flow).
          const PASS_TYPES = [
            'STANDARD_PASS',
            'FIRST_TIME_PASS',
            'HIGH_PASS',
            'LONG_BALL',
          ] as const;
          if (!passType || !(PASS_TYPES as readonly string[]).includes(passType)) {
            socket.emit(ServerEvents.GAME_ERROR, 'MISSING_PASS_TYPE');
            broadcastState(io, room);
            return;
          }
          // Validate the chosen passType against the current lastActionType.
          // null lastActionType (kick-off start) is treated as MOVEMENT_PHASE eligibility.
          const effectiveLastAction = room.gameState.lastActionType ?? 'MOVEMENT_PHASE';
          if (!ELIGIBLE_NEXT_ACTIONS[effectiveLastAction].has(passType)) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
            broadcastState(io, room);
            return;
          }
          // T-37-25: defence-in-depth — ELIGIBLE_NEXT_ACTIONS[THROW_IN_MOVEMENT_*]
          // (Plan 37-02) already restricts a throw to STANDARD_PASS/HIGH_PASS; this
          // explicit check protects against a future edit to that table silently
          // widening throw-in options.
          if (
            isThrowInContext(room.gameState.lastActionType) &&
            passType !== 'STANDARD_PASS' &&
            passType !== 'HIGH_PASS'
          ) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
            broadcastState(io, room);
            return;
          }
          // MATCH-07: during KICK_OFF phase, only a Standard Pass may open play.
          if (room.gameState.phase === 'KICK_OFF' && passType !== 'STANDARD_PASS') {
            socket.emit(ServerEvents.GAME_ERROR, 'KICKOFF_STANDARD_PASS_ONLY');
            broadcastState(io, room);
            return;
          }
          // D-10 (Phase 8.2): targetHex validation and authoritative validatePass gate.
          // Require targetHex for all pass types — engine needs it for accuracy resolution.
          if (!targetHex) {
            socket.emit(ServerEvents.GAME_ERROR, 'MISSING_TARGET');
            broadcastState(io, room);
            return;
          }
          // ASVS V5: shape validation — reject non-number q/r (mirror GAME_SHOT T-07-12)
          if (
            typeof targetHex !== 'object' ||
            targetHex === null ||
            typeof targetHex.q !== 'number' ||
            typeof targetHex.r !== 'number'
          ) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
            broadcastState(io, room);
            return;
          }
          // T-37-24: THROWIN-04 off-pitch guard — lives here only, never inside
          // validatePass (RESEARCH.md Assumption A4 / Open Question 1).
          if (isThrowInContext(room.gameState.lastActionType) && !isPitchHex(targetHex)) {
            socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
            broadcastState(io, room);
            return;
          }
          // Look up the ball carrier (must exist in PASS phase)
          const carrier = room.gameState.pieces.find(
            (p) => p.id === room.gameState!.ball.carrierId,
          );
          if (!carrier) {
            socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
            broadcastState(io, room);
            return;
          }
          // Map client passType to validatePass type parameter
          const passTypeMap: Record<
            'STANDARD_PASS' | 'FIRST_TIME_PASS' | 'HIGH_PASS' | 'LONG_BALL',
            'STANDARD' | 'FIRST_TIME' | 'HIGH' | 'LONG'
          > = {
            STANDARD_PASS: 'STANDARD',
            FIRST_TIME_PASS: 'FIRST_TIME',
            HIGH_PASS: 'HIGH',
            LONG_BALL: 'LONG',
          };
          const vpType = passTypeMap[passType];
          // CORNER-04: resolution order for validatePass's maxDistance override.
          // 1. Throw-in context (checked FIRST so throw-in semantics never regress —
          //    unchanged from before this plan).
          // 2. A corner-kick High Pass aimed inside the box the attacking team is
          //    shooting at gets no distance limit.
          // 3. Otherwise undefined — the ordinary per-type caps in validatePass apply.
          //
          // PITFALL 5 — `defendingBox` MUST be the BYLINE OWNER's own penalty area (the
          // box the ATTACKING team is shooting at), never the kicking team's own box.
          // `cornerKickTeam` is the team taking the corner (the attacker); the byline
          // owner — and therefore the box being attacked — is always the OPPOSITE team.
          // Getting this backwards would key the unlimited-range rule to the box on the
          // opposite side of the pitch from where a corner is ever aimed, silently
          // disabling it for every real corner.
          let passOptions: { maxDistance?: number } | undefined;
          if (isThrowInContext(room.gameState.lastActionType)) {
            passOptions = { maxDistance: THROW_IN_MAX_DISTANCE };
          } else if (isCornerKickContext(room.gameState) && passType === 'HIGH_PASS') {
            const cornerKickTeam = room.gameState.cornerKickTeam;
            const bylineOwnerTeam: 'home' | 'away' = cornerKickTeam === 'home' ? 'away' : 'home';
            const defendingBox: 'homePenaltyArea' | 'awayPenaltyArea' =
              bylineOwnerTeam === 'home' ? 'homePenaltyArea' : 'awayPenaltyArea';
            passOptions = isInRegion(targetHex, defendingBox)
              ? { maxDistance: CORNER_KICK_UNLIMITED_DISTANCE }
              : undefined;
          } else {
            passOptions = undefined;
          }
          // Authoritative server-side validatePass (D-10) — re-runs before committing
          const passResult = validatePass(
            room.gameState,
            carrier,
            carrier.position,
            targetHex,
            vpType,
            passOptions,
          );
          if (!passResult.ok) {
            socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
            broadcastState(io, room);
            return;
          }
          // Commit passTargetHex to state — consumed by applyRoll PASS branch
          room.gameState = { ...room.gameState, passTargetHex: targetHex };
          // D-11 (Phase 8.2): Pre-generate interception dice before applyRoll (Pitfall 4)
          // Header-win pass is non-interceptable — skip regardless of validatePass result.
          // D-10: autoIntercepts need no dice; only pre-generate for rollIntercepts.
          const isHeaderPass = room.gameState.lastActionType === 'HEADER';
          if (!isHeaderPass && passResult.rollIntercepts.length > 0) {
            const interceptionDice = passResult.rollIntercepts.map(() => rollDice());
            room.gameState = { ...room.gameState, preGeneratedInterceptionDice: interceptionDice };
          }

          // Commit the chosen pass type — applyRoll reads lastActionType to determine time cost.
          // T-37-26/THROWIN-04: tear down the throw-in context the moment the throw
          // passes validation and is committed here — the throw has been taken, so
          // the throw-in is over regardless of Low/High type or what happens next.
          // Placed before the HIGH_PASS repositioning detour below so it applies to
          // both Low and High throws.
          room.gameState = {
            ...room.gameState,
            lastActionType: passType,
            ...(wasThrowIn
              ? { throwInHex: null, throwInTeam: null, throwInPhasesTaken: null }
              : {}),
          };

          // HIGH_PASS: log the pass attempt immediately then enter repositioning phase.
          // Ball moves to target (visible to both clients); carrierId cleared so kicker loses possession.
          // highPassCarrierId preserves the kicker ID for the accuracy stat lookup in applyRoll.
          if (passType === 'HIGH_PASS') {
            const kickerId = room.gameState.ball.carrierId;
            const kickerPiece = room.gameState.pieces.find((p) => p.id === kickerId);
            const highPassEvent: ActionEvent = {
              type: 'HIGH_PASS',
              passerId: kickerId ?? '',
              from: kickerPiece?.position ?? targetHex,
              to: targetHex,
              accurate: null,
              timestamp: Date.now(),
              ballAfter: { position: targetHex, carrierId: null },
            };
            room.gameState = {
              ...room.gameState,
              phase: 'HIGH_PASS_MOVE',
              // Ball in flight, no immediate receiver — kicker is the last toucher.
              ball: {
                position: targetHex,
                carrierId: null,
                lastTouchedBy: kickerPiece
                  ? { pieceId: kickerPiece.id, teamId: kickerPiece.teamId }
                  : room.gameState.ball.lastTouchedBy,
              },
              highPassCarrierId: kickerId,
              highPassMovementSlot: 'ATTACKER',
              highPassMovedPieceId: null,
              highPassPaceUsed: 0,
              activeTeam: room.gameState.attackingTeam,
              eventLog: [...room.gameState.eventLog, highPassEvent],
            };
            broadcastState(io, room);
            return;
          }
        } else {
          // D-07 / T-08-12: sequence guards for non-PASS dice phases.
          if (room.gameState.phase === 'HEADER' && room.gameState.lastActionType !== null) {
            if (!ELIGIBLE_NEXT_ACTIONS[room.gameState.lastActionType].has('HEADER')) {
              socket.emit(ServerEvents.GAME_ERROR, 'INVALID_SEQUENCE');
              broadcastState(io, room);
              return;
            }
          }
          // Pitfall 5 (Phase 8.2): HEADER roll requires both teams to confirm their contestant.
          if (room.gameState.phase === 'HEADER') {
            if (!room.gameState.headerConfirmed?.home || !room.gameState.headerConfirmed?.away) {
              socket.emit(ServerEvents.GAME_ERROR, 'HEADER_NOT_CONFIRMED');
              broadcastState(io, room);
              return;
            }
          }
          // RULE-02 guard: duel already resolved in GAME_HEADER_CONTESTANT — do not re-fire.
          // An attacker who lost could otherwise send GAME_ROLL to overwrite headerDuelWinner.
          if (room.gameState.phase === 'HEADER' && room.gameState.headerDuelWinner !== undefined) {
            socket.emit(ServerEvents.GAME_ERROR, 'DUEL_ALREADY_RESOLVED');
            broadcastState(io, room);
            return;
          }
        }

        // Pre-generate all dice the branch may need (Pitfall 4 — upfront, before any validator call)
        const d1 = rollDice();
        const d2 = rollDice();
        const d3 = rollDice();
        // applyRoll's PASS branch only triggers on phase === 'PASS'; normalise KICK_OFF → PASS
        // so the engine's pass logic runs without duplicating it (kickOffActive enforces centre-hex rule above).
        const stateForRoll =
          room.gameState.phase === 'KICK_OFF'
            ? { ...room.gameState, phase: 'PASS' as const }
            : room.gameState;
        const result = applyRoll(stateForRoll, d1, d2, d3);
        if (!result.ok) {
          socket.emit(ServerEvents.GAME_ERROR, result.reason);
          broadcastState(io, room); // snap-back
          return;
        }
        // D-27 / MATCH-03: clear kickOffActive after a successful kick-off pass from centre hex.
        if (room.gameState.kickOffActive) {
          room.gameState = { ...result.state, kickOffActive: false };
        } else {
          room.gameState = result.state;
        }
        // OFFSIDE-02 (D-26): single success path for GAME_ROLL's PASS/HEADER/LOOSE_BALL
        // resolution — covers any grounded pass pickup and won header; no-op when the
        // new carrier isn't flagged offside.
        // D-53: applyOffsideFoulWithRelocation wraps triggerOffsideFoul + relocation.
        room.gameState = applyOffsideFoulWithRelocation(room.gameState);
        broadcastState(io, room); // ARCH-04: single broadcast entry point
        // WR-04: guard against the (currently unreachable) case where applyRoll transitions to
        // FULL_TIME — mirrors the startReplayStream call in GAME_END_TURN / HIGH_PASS_MOVEMENT.
        if (room.gameState.phase === 'FULL_TIME') {
          startReplayStream(io, room);
        }
      } finally {
        room.isProcessing = false; // MUST be in finally — Pitfall 5
      }
    },
  );

  // -------------------------------------------------------------------------
  // GAME_SHOT — declares a shot: PASS → GK_DIVING (D-02 rework)
  //
  // D-02: reworked from a metadata-only recorder to a state-transitioning
  // declaration handler. Phase guard changed from SHOT → PASS (shooter is in
  // the ACTION/PASS phase when they click "Shoot"). Calls applyDeclareShot which
  // transitions to GK_DIVING and records shotTargetHex. Broadcasts new state.
  //
  // T-07-11: phase (PASS) + team guard (controlsAttackingTeam) prevent wrong-phase
  //          / wrong-team declarations
  // T-07-12: HexCoord shape validation rejects malformed payloads (ASVS V5, T-10-09)
  // T-10-10: server declares goal hex; dice pre-generated server-side (no client dice)
  // T-10-11: isProcessing mutex prevents double-click race (SC-5)
  // ARCH-04: broadcastState is mandatory — this handler now transitions state.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_SHOT, (targetHex: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // 1. Null-state guard
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // 2. Phase guard: must be in PASS or SNAPSHOT_TARGET (snapshot target selection)
      if (room.gameState.phase !== 'PASS' && room.gameState.phase !== 'SNAPSHOT_TARGET') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // 3. Team guard: only the attacking team may declare a shot
      if (!controlsAttackingTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // 4. Payload validation (ASVS V5, T-07-12, T-10-09)
      if (
        typeof targetHex !== 'object' ||
        targetHex === null ||
        typeof targetHex.q !== 'number' ||
        typeof targetHex.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room); // snap-back
        return;
      }
      // 5. Engine call: validates goal hex and seeds GK_DIVING state
      const result = applyDeclareShot(room.gameState, targetHex);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      const declaredState = result.state;

      // BUGFIX (snapshot-shot-flow-mismatch): when applyDeclareShot is called from
      // SNAPSHOT_TARGET it transitions to 'SNAPSHOT_DEFLECT' (defending team gets a
      // 2-hex repositioning turn) rather than 'GK_DIVE'. Steps 6/7 below resolve
      // deflection and GK-range using CURRENT (pre-repositioning) positions, which is
      // only correct for the regular PASS → GK_DIVE flow. For the snapshot flow, the
      // equivalent checks already run — correctly, with POST-repositioning positions —
      // in the SNAPSHOT_DEFLECT end-of-turn handler (GAME_END_TURN). Running them again
      // here would resolve (or even score) the snapshot before the defending team gets
      // their repositioning turn. Skip straight to broadcasting the SNAPSHOT_DEFLECT state.
      if (declaredState.phase === 'SNAPSHOT_DEFLECT') {
        room.gameState = declaredState;
        broadcastState(io, room);
        return;
      }

      // 6. Deflection check (before GK dives — defenders on/near path act first)
      const shotShooter = declaredState.pieces.find((p) => p.id === declaredState.ball.carrierId);
      const shotPathTarget = declaredState.shotTargetHex;
      const defInputs: DefenderDeflectionInput[] = [];
      if (shotShooter && shotPathTarget) {
        const pathHexes = hexLine(shotShooter.position, shotPathTarget);
        const pathSet = new Set(pathHexes.map((h) => `${h.q},${h.r}`));
        const defTeam: 'home' | 'away' = declaredState.attackingTeam === 'home' ? 'away' : 'home';
        for (const defender of declaredState.pieces.filter(
          (p) => p.teamId === defTeam && p.role !== 'GK',
        )) {
          const onPath = pathSet.has(`${defender.position.q},${defender.position.r}`);
          let nearPath = false;
          if (!onPath) {
            for (const ph of pathHexes) {
              if (hexDistance(defender.position, ph) === 1) {
                nearPath = true;
                break;
              }
            }
          }
          if (onPath || nearPath) {
            defInputs.push({
              defenderId: defender.id,
              defenderPosition: defender.position,
              tackling: defender.tackling,
              die: rollDice(),
              band: onPath ? 'A' : 'B',
            });
          }
        }
      }

      const deflectEventsShot: ActionEvent[] = [];
      for (const def of defInputs) {
        const didDeflect =
          def.band === 'A'
            ? def.die === 5 || def.die === 6 || def.die + def.tackling >= 10
            : def.die === 6 || def.die + def.tackling >= 10;
        deflectEventsShot.push({
          type: 'DEFLECT_ATTEMPT',
          defenderId: def.defenderId,
          band: def.band,
          die: def.die,
          tackling: def.tackling,
          result: didDeflect ? 'DEFLECTED' : 'NO_DEFLECT',
          timestamp: Date.now(),
        });
        if (didDeflect) break;
      }

      const shotDeflectionResult = computeShotPathDeflection(defInputs);
      if (shotDeflectionResult.deflected && shotDeflectionResult.deflectorPosition) {
        // D-06: DEFLECT_ATTEMPT resolving to DEFLECTED — the deflecting piece is the last toucher.
        const shotDeflectorPiece = declaredState.pieces.find(
          (p) => p.id === shotDeflectionResult.deflectorId,
        );
        room.gameState = {
          ...declaredState,
          phase: 'LOOSE_BALL',
          ball: {
            position: shotDeflectionResult.deflectorPosition,
            carrierId: null,
            lastTouchedBy: shotDeflectorPiece
              ? { pieceId: shotDeflectorPiece.id, teamId: shotDeflectorPiece.teamId }
              : declaredState.ball.lastTouchedBy,
          },
          lastActionType: 'DEFLECTION',
          shotTargetHex: null,
          gkDivePosition: null,
          lastShotPath: null,
          eventLog: [...declaredState.eventLog, ...deflectEventsShot],
        };
        // OFFSIDE-02 D-41: ball is deliberately left loose (carrierId: null) — pass the
        // deflecting defender's id explicitly so the foul fires using their identity even
        // though they never gain clean possession (mirrors the SNAPSHOT_DEFLECT site above).
        // D-53: applyOffsideFoulWithRelocation wraps triggerOffsideFoul + relocation.
        room.gameState = applyOffsideFoulWithRelocation(
          room.gameState,
          shotDeflectionResult.deflectorId,
        );
        broadcastState(io, room);
        return;
      }

      // 7. GK range check: if no path hex is reachable (≤3 hexes) auto-GOAL
      const shotDefTeam: 'home' | 'away' = declaredState.attackingTeam === 'home' ? 'away' : 'home';
      const gkForRange = declaredState.pieces.find(
        (p) => p.teamId === shotDefTeam && p.role === 'GK',
      );
      const reachablePathHexes =
        shotShooter && shotPathTarget ? hexLine(shotShooter.position, shotPathTarget) : [];
      const hasReachableHex =
        gkForRange !== undefined &&
        reachablePathHexes.some((h) => hexDistance(gkForRange.position, h) <= 3);

      if (!hasReachableHex) {
        const scoringTeam = declaredState.attackingTeam;
        const newKickOffTeam = shotDefTeam;
        const outDie1 = rollDice();
        const outDie2 = rollDice();
        const outOfRangeEvent: ActionEvent = {
          type: 'SHOT_ATTEMPT',
          shooterId: declaredState.ball.carrierId ?? '',
          gkId: gkForRange?.id ?? '',
          targetHex: shotPathTarget ?? { q: 0, r: 0 },
          outcome: 'GOAL',
          shooterDie: outDie1,
          shooterScore: null,
          gkDie: outDie2,
          gkScore: null,
          handlingDie: null,
          gkHandling: null,
          shooterPenaltyTotal: 0,
          gkPenaltyTotal: 0,
          timestamp: Date.now(),
          ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
        };
        const newScore = {
          ...declaredState.score,
          [scoringTeam]: declaredState.score[scoringTeam] + 1,
        };
        // D-01 (BUG-30): hoist once and feed both state.pieces and the GOAL event's
        // piecesAfter so buildReplayFrames reconstructs every piece at the new kickoff
        // formation, not just the ball (mirrors gameEngine.ts's resetPieces pattern).
        const resetPieces = buildKickOffPieces(
          newKickOffTeam,
          declaredState.selectedTeams,
          declaredState.selectedFormation,
        );
        room.gameState = {
          ...declaredState,
          pieces: resetPieces,
          phase: 'KICK_OFF_SETUP',
          score: newScore,
          attackingTeam: newKickOffTeam,
          activeTeam: newKickOffTeam,
          ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null, lastTouchedBy: null }, // kick-off reset — fresh state
          lastDiceRoll: { rolls: [outDie1, outDie2], context: 'SHOT_DUEL' },
          lastActionType: null,
          lastShotPath: null,
          gkDivePosition: null,
          shotTargetHex: null,
          snapshotGkPenalty: null,
          eventLog: [
            ...declaredState.eventLog,
            ...deflectEventsShot,
            outOfRangeEvent,
            {
              type: 'GOAL' as const,
              scoringTeam,
              scorerId: outOfRangeEvent.shooterId,
              timestamp: Date.now(),
              ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
              piecesAfter: resetPieces, // D-01 (BUG-30): reconstruct all pieces at kickoff in replay
            },
          ],
        };
        broadcastState(io, room);
        return;
      }

      // GK in range: enter GK_DIVING with any deflect events appended
      room.gameState = {
        ...declaredState,
        eventLog: [...declaredState.eventLog, ...deflectEventsShot],
      };
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_KICK_OFF_MOVE — free piece repositioning during KICK_OFF_SETUP phase
  // T-08-09: piece must belong to the requesting socket's team (T-08-09 Tampering)
  // T-08-14: isProcessing mutex guards against double-process (SC-5)
  // D-23: no pace limits, no ZoI enforcement — this is pre-kick-off positioning
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_KICK_OFF_MOVE, (pieceId: string, to: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be KICK_OFF_SETUP
      if (room.gameState === null || room.gameState.phase !== 'KICK_OFF_SETUP') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // T-08-09: validate HexCoord payload (V5 input validation)
      if (
        typeof to !== 'object' ||
        to === null ||
        typeof to.q !== 'number' ||
        typeof to.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room);
        return;
      }
      // Piece lookup
      const piece = room.gameState.pieces.find((p) => p.id === pieceId);
      if (!piece) {
        socket.emit(ServerEvents.GAME_ERROR, 'PIECE_NOT_FOUND');
        broadcastState(io, room);
        return;
      }
      // T-08-09: only the owning team may reposition their pieces
      const team = socketTeam(socket);
      if (piece.teamId !== team) {
        socket.emit(ServerEvents.GAME_ERROR, 'NOT_YOUR_PIECE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Boundary guard: reject off-pitch destinations (D-23)
      if (!PITCH_HEXES.some((h) => h.q === to.q && h.r === to.r)) {
        socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
        broadcastState(io, room);
        return;
      }
      // Occupancy guard: reject if any other piece already occupies that hex
      if (
        room.gameState.pieces.some(
          (p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r,
        )
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'OCCUPIED');
        broadcastState(io, room);
        return;
      }
      // Apply free repositioning (no pace/ZoI checks — D-23)
      const newPieces = room.gameState.pieces.map((p) =>
        p.id === pieceId ? { ...p, position: { q: to.q, r: to.r } } : p,
      );
      // BUG-17 (Phase 18.3): push a KICK_OFF_SETUP event so buildReplayFrames can
      // reconstruct formation repositioning moves (including post-goal resets).
      // Event and piece-position change commit atomically in the same state assignment.
      // `piece` is already declared above at the piece-lookup guard.
      const kickOffSetupEvent: ActionEvent = {
        type: 'KICK_OFF_SETUP',
        pieceId,
        from: piece.position,
        to: { q: to.q, r: to.r },
        timestamp: Date.now(),
      };
      room.gameState = {
        ...room.gameState,
        pieces: newPieces,
        eventLog: [...room.gameState.eventLog, kickOffSetupEvent],
      };
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_READY — KICK_OFF_SETUP confirmation ("Ready" button)
  // T-08-10: applyKickOffReady validates placement server-side; snap-back on rejection
  // T-08-08: handler tracks each socket's own slot only; never sets both ready at once
  // D-24: transitions to KICK_OFF only when both teams have confirmed ready
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_READY, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be KICK_OFF_SETUP
      if (room.gameState === null || room.gameState.phase !== 'KICK_OFF_SETUP') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Validate placement rules for this socket's team (T-08-10)
      const team = socketTeam(socket);
      const result = applyKickOffReady(room.gameState, team);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      // Mark this socket's player slot as ready (T-08-08: only the confirming socket's own slot)
      const slot = socket.data.playerSlot;
      if (slot === undefined) return;
      if (!room.readyPlayers) {
        room.readyPlayers = new Set<1 | 2>();
      }
      room.readyPlayers.add(slot);
      // D-24: transition to KICK_OFF only when both teams have confirmed ready.
      // applyKickOffReady already validated that the attacking team has exactly one
      // piece on the centre hex — assign that piece as ball carrier so possession
      // is reflected in state and graphics immediately.
      if (room.readyPlayers.size === 2) {
        const kickOffHex = PITCH_REGIONS.kickOffHex;
        // CR-03: filter by attackingTeam first so a defending piece that happens to be on
        // the kick-off hex (e.g. due to a stale placement guard) cannot be assigned possession.
        const kicker = room.gameState.pieces.find(
          (p) =>
            p.teamId === room.gameState!.attackingTeam &&
            p.position.q === kickOffHex.q &&
            p.position.r === kickOffHex.r,
        );
        room.gameState = {
          ...room.gameState,
          phase: 'KICK_OFF',
          ball: kicker
            ? {
                position: kickOffHex,
                carrierId: kicker.id,
                lastTouchedBy: { pieceId: kicker.id, teamId: kicker.teamId },
              }
            : room.gameState.ball,
          attackingTeam: kicker ? kicker.teamId : room.gameState.attackingTeam,
          activeTeam: kicker ? kicker.teamId : room.gameState.activeTeam,
          lastActionType: null, // D-10: fresh sequence at kick-off
          // D-47: a player cannot be flagged/remain-flagged offside as a direct result of
          // a kick-off restart — generalizes D-43 (already done for the free-kick restart)
          // to the kick-off restart too.
          offsidePieceIds: [],
          eventLog: [
            ...room.gameState.eventLog,
            {
              type: 'KICK_OFF' as const,
              timestamp: Date.now(),
              ballAfter: kicker
                ? { position: kickOffHex, carrierId: kicker.id }
                : room.gameState.ball,
            },
          ],
        };
        room.readyPlayers = null; // clear for next use
      }
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_FREE_KICK_MOVE — free piece repositioning during FREE_KICK_SETUP phase
  // OFFSIDE-02 (D-49 staged rework): only the CURRENTLY-active stage's team may
  // reposition; applyFreeKickMove validates team-for-stage and the per-stage
  // placement cap (PLACEMENT_LIMIT_REACHED for a NEW piece beyond the cap; re-placing
  // an already-counted piece is always free). No pace/ZoI checks (D-29).
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_FREE_KICK_MOVE, (pieceId: string, to: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be FREE_KICK_SETUP
      if (room.gameState === null || room.gameState.phase !== 'FREE_KICK_SETUP') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // T-17-06-09: validate HexCoord payload (V5 input validation)
      if (
        typeof to !== 'object' ||
        to === null ||
        typeof to.q !== 'number' ||
        typeof to.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room);
        return;
      }
      // Piece lookup
      const piece = room.gameState.pieces.find((p) => p.id === pieceId);
      if (!piece) {
        socket.emit(ServerEvents.GAME_ERROR, 'PIECE_NOT_FOUND');
        broadcastState(io, room);
        return;
      }
      // Only the owning team may reposition their pieces (defense-in-depth — the
      // applyFreeKickMove team-for-stage check below also catches a wrong-team attempt,
      // but this distinguishes NOT_YOUR_PIECE (tampering) from WRONG_TEAM (not your stage)).
      const team = socketTeam(socket);
      if (piece.teamId !== team) {
        socket.emit(ServerEvents.GAME_ERROR, 'NOT_YOUR_PIECE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Boundary guard: reject off-pitch destinations
      if (!PITCH_HEXES.some((h) => h.q === to.q && h.r === to.r)) {
        socket.emit(ServerEvents.GAME_ERROR, 'OFF_PITCH');
        broadcastState(io, room);
        return;
      }
      // Occupancy guard: reject if any other piece already occupies that hex
      if (
        room.gameState.pieces.some(
          (p) => p.id !== pieceId && p.position.q === to.q && p.position.r === to.r,
        )
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'OCCUPIED');
        broadcastState(io, room);
        return;
      }
      // D-49: validate team-for-stage + placement cap, and apply the reposition.
      const result = applyFreeKickMove(room.gameState, pieceId, { q: to.q, r: to.r });
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_FREE_KICK_READY — "I'm done with my stage" signal (D-49 staged rework)
  // OFFSIDE-02 (D-49/D-50/D-51): the event name is kept from the prior dual-Ready
  // model, but the semantics are now single-team-at-a-time — only the CURRENTLY-active
  // stage's team may meaningfully end it (applyFreeKickReady rejects an inactive team's
  // attempt with NOT_YOUR_STAGE). No room.readyPlayers dual-confirm — each stage is
  // ended by exactly one team's own action, mirroring applyFreeMoveEnd's End-Turn model.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_FREE_KICK_READY, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be FREE_KICK_SETUP
      if (room.gameState === null || room.gameState.phase !== 'FREE_KICK_SETUP') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Validate + apply the stage-end for this socket's team. applyFreeKickReady owns
      // the full advance-or-finalize transition (D-49) — including the D-43/D-47
      // offsidePieceIds reset and FREE_KICK_RESTART lastActionType on finalize.
      const team = socketTeam(socket);
      const result = applyFreeKickReady(room.gameState, team);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_THROW_IN_PLACE — THROWIN-02: thrower placement during THROW_IN_SETUP
  // The destination hex is server-owned (room.gameState.throwInHex) — the event
  // payload is pieceId only; a client cannot supply or relocate the throw-in hex.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_THROW_IN_PLACE, (pieceId: string) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be THROW_IN_SETUP
      if (room.gameState === null || room.gameState.phase !== 'THROW_IN_SETUP') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // ASVS V5 input validation: payload shape check before use
      if (typeof pieceId !== 'string' || pieceId.length === 0) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room);
        return;
      }
      // Piece lookup
      const piece = room.gameState.pieces.find((p) => p.id === pieceId);
      if (!piece) {
        socket.emit(ServerEvents.GAME_ERROR, 'PIECE_NOT_FOUND');
        broadcastState(io, room);
        return;
      }
      // ASVS V4 ownership guard: distinguishes tampering (placing an opponent's
      // piece) from a wrong-turn attempt (NOT_YOUR_PIECE vs WRONG_TEAM below),
      // matching GAME_FREE_KICK_MOVE's two-guard structure.
      if (piece.teamId !== socketTeam(socket)) {
        socket.emit(ServerEvents.GAME_ERROR, 'NOT_YOUR_PIECE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Turn guard: only the throwing team may place the thrower
      if (socketTeam(socket) !== room.gameState.throwInTeam) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyThrowInPlace(room.gameState, pieceId);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_CORNER_KICK_GK_PLACE — CORNER-01: reposition a GK during either corner-kick
  // GK reposition window (attacking GK first, then defending GK). Mirrors
  // GAME_FREE_KICK_MOVE's pick-up-and-place payload shape ({pieceId, to}), delegating all
  // acting-team/role/legality validation to the pure applyCornerKickGkPlace.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_CORNER_KICK_GK_PLACE, (pieceId: string, to: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be one of the two corner-kick GK reposition windows.
      if (
        room.gameState === null ||
        (room.gameState.phase !== 'CORNER_KICK_GK_SETUP_ATTACKING' &&
          room.gameState.phase !== 'CORNER_KICK_GK_SETUP_DEFENDING')
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // ASVS V5 input validation: payload shape check before use (mirrors GAME_FREE_KICK_MOVE).
      if (
        typeof pieceId !== 'string' ||
        pieceId.length === 0 ||
        typeof to !== 'object' ||
        to === null ||
        typeof to.q !== 'number' ||
        typeof to.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room);
        return;
      }
      // T-38-17: wrong-team pre-check against the phase-derived acting team. Not merely
      // redundant with applyCornerKickGkPlace's own piece.teamId !== actingTeam check below —
      // without this, a socket for the NON-acting team could place a GK belonging to the
      // acting team (the engine only verifies the SELECTED PIECE's team, never the
      // REQUESTING socket's team, since pieceId is its only identity-bearing input).
      if (room.gameState.cornerKickTeam == null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      const phaseActingTeam: 'home' | 'away' =
        room.gameState.phase === 'CORNER_KICK_GK_SETUP_ATTACKING'
          ? room.gameState.cornerKickTeam
          : room.gameState.cornerKickTeam === 'home'
            ? 'away'
            : 'home';
      if (socketTeam(socket) !== phaseActingTeam) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyCornerKickGkPlace(room.gameState, pieceId, { q: to.q, r: to.r });
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_CORNER_KICK_TAKER — CORNER-02: the attacking manager selects which of their
  // pieces takes the corner. The destination hex is server-owned (state.cornerKickHex) —
  // deliberately NOT part of the payload so a client can never choose where the corner is
  // taken from. Mirrors GAME_THROW_IN_PLACE's single-pieceId payload shape.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_CORNER_KICK_TAKER, (pieceId: string) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be CORNER_KICK_TAKER_SELECT
      if (room.gameState === null || room.gameState.phase !== 'CORNER_KICK_TAKER_SELECT') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // ASVS V5 input validation: payload shape check before use
      if (typeof pieceId !== 'string' || pieceId.length === 0) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room);
        return;
      }
      // T-38-17: turn guard — only the kicking team's own socket may designate the
      // corner-taker. Not redundant with applyCornerKickTakerSelect's own
      // piece.teamId !== cornerKickTeam check: that check only verifies the SELECTED
      // PIECE's team, never the REQUESTING socket's team, since pieceId is its only
      // identity-bearing input. Without this pre-check, the non-kicking team's socket
      // could submit a pieceId belonging to the kicking team and have it accepted.
      if (socketTeam(socket) !== room.gameState.cornerKickTeam) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyCornerKickTakerSelect(room.gameState, pieceId);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_HALF_TIME_START — trigger 2nd half from HALF_TIME phase
  // T-08-11: only the non-kick-off team may start the second half (D-26/D-28)
  // T-08-14: isProcessing mutex guards against double-process (SC-5)
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_HALF_TIME_START, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be HALF_TIME
      if (room.gameState === null || room.gameState.phase !== 'HALF_TIME') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // T-08-11: only the team that did NOT kick off in the 1st half may start the 2nd half
      // The 2nd-half kick-off team is the opposite of kickOffTeam (D-26)
      const team = socketTeam(socket);
      const secondHalfKickOffTeam: 'home' | 'away' =
        room.gameState.kickOffTeam === 'home' ? 'away' : 'home';
      if (team !== secondHalfKickOffTeam) {
        socket.emit(ServerEvents.GAME_ERROR, 'NOT_KICK_OFF_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // Transition to KICK_OFF_SETUP for 2nd half (D-28)
      const result = applyHalfTimeStart(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_GK_RESTART — GK team chooses kick/throw/movement after a save catch
  // T-05-07: controlsGKTeam guard — only the GK's team may restart
  // T-05-08: choice payload validated against allowed values before dispatch (ASVS V5)
  // T-05-09: phase guard requires GK_RESTART (D-23)
  // T-05-10: isProcessing mutex prevents double-click race (SC-5)
  // D-10: single broadcastState after each resolution (ARCH-04)
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_GK_RESTART, (choice: 'kick' | 'throw' | 'movement') => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard (T-05-09): must be in GK_RESTART (D-23)
      if (room.gameState === null || room.gameState.phase !== 'GK_RESTART') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Team guard (T-05-07): must be the GK's team — derived from ball.carrierId (Open Q3)
      if (!controlsGKTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // Payload validation (T-05-08): never trust client input (ASVS V5)
      if (!['kick', 'throw', 'movement'].includes(choice)) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_CHOICE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Dispatch: pass rollDice as the injected die function (pure engine, deterministic tests)
      const result = applyGKRestart(room.gameState, choice, rollDice);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04: single broadcast entry point
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_GOAL_KICK_CHOICE — GK's team chooses kick vs. standard-pass restart
  // GOALKICK-03: mirrors GAME_GK_RESTART's canonical shape (mutex, phase guard,
  // value validation, team guard, delegate, single broadcast) but is its own event
  // and its own handler — D-01 forbids reusing or modifying the GAME_GK_RESTART
  // handler for goal kicks even though the payload shape is similar.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_GOAL_KICK_CHOICE, (choice: 'kick' | 'standard') => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently
    room.isProcessing = true;
    try {
      // Phase guard: must be in GOAL_KICK_CHOICE
      if (room.gameState === null || room.gameState.phase !== 'GOAL_KICK_CHOICE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // ASVS V5 — never trust client input; validated here before the team guard so a
      // malformed payload from either team is rejected with the same specific reason.
      if (choice !== 'kick' && choice !== 'standard') {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_CHOICE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Team guard: only the goal-kick team (the GK's own team) may choose.
      if (socketTeam(socket) !== room.gameState.goalKickTeam) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      const result = applyGoalKickChoice(room.gameState, choice);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04: single broadcast entry point
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_GOAL_KICK_TARGET — GK's team selects the Kick target during GOAL_KICK_TARGET.
  // GOALKICK-05: target must be an outfield teammate's hex (enforced in
  // applyGoalKickTarget). D-01: team guard compares socketTeam(socket) directly against
  // the server-owned goalKickTeam field — NOT controlsGKTeam, which derives the GK's
  // team from ball.carrierId and would break the moment the ball leaves the GK's hands.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_GOAL_KICK_TARGET, (targetHex: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently
    room.isProcessing = true;
    try {
      // Phase guard: must be in GOAL_KICK_TARGET
      if (room.gameState === null || room.gameState.phase !== 'GOAL_KICK_TARGET') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // ASVS V5 — never trust client input; validate payload shape before use.
      if (
        typeof targetHex !== 'object' ||
        targetHex === null ||
        typeof targetHex.q !== 'number' ||
        typeof targetHex.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room); // snap-back
        return;
      }
      // Team guard: only the goal-kicking team (the GK's own team) may select the target.
      if (socketTeam(socket) !== room.gameState.goalKickTeam) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      const result = applyGoalKickTarget(room.gameState, targetHex);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04: single broadcast entry point
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_QUICK_THROW — GK delivers to a target hex (unblocked, uninterceptable)
  // Only the GK's team may throw; target validated server-side (range ≤ 11, on pitch).
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_QUICK_THROW, (targetHex: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return;

    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'GK_QUICK_THROW') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      if (!controlsGKTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyQuickThrow(room.gameState, targetHex);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room);
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_GK_KICK_TARGET — GK's team selects kick destination during GK_KICK_TARGET phase.
  // Only the GK's team may send this; target validated by applyGKKickTarget (on pitch,
  // not in opponent's final third, not GK's own hex).
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_GK_KICK_TARGET, (targetHex: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return;

    room.isProcessing = true;
    try {
      if (room.gameState === null || room.gameState.phase !== 'GK_KICK_TARGET') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // controlsGKTeam derives GK team from ball.carrierId (still set in GK_KICK_TARGET)
      if (!controlsGKTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      const result = applyGKKickTarget(room.gameState, targetHex);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room);
    } finally {
      room.isProcessing = false;
    }
  });

  // -------------------------------------------------------------------------
  // GAME_SNAPSHOT — declares a Snapshot (CR-01 server end)
  //
  // T-08-21: gates on isActivePlayer (attacking team) + applySnapshot internal
  //   phase/sequence/position validation (NOT_IN_PENALTY_AREA / INVALID_SEQUENCE).
  //
  // applySnapshot transitions MOVEMENT or PASS → SHOT and sets snapshotGkPenalty.
  // No dice pre-generation here — the shot duel is resolved by the subsequent
  // game:roll (GAME_ROLL handles phase='SHOT' via DICE_PHASES).
  //
  // ARCH-04: broadcastState is the single broadcast entry point.
  // SC-5: isProcessing mutex guards against double-click race.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_SNAPSHOT, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Null-state guard (belt-and-suspenders; applySnapshot also validates internally)
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back — ARCH-04
        return;
      }
      // T-08-21: only the active (attacking) player may declare a Snapshot
      if (!isActivePlayer(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      const result = applySnapshot(room.gameState);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      room.gameState = result.state;
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_GK_DIVE — GK repositions during GK_DIVING phase (D-04, SHOT-04)
  //
  // T-10-08: controlsGKTeam guard — only the GK's team may send dive hexes.
  // T-10-09: HexCoord shape validation rejects malformed payloads (ASVS V5).
  // T-10-11: isProcessing mutex prevents double-click race (SC-5).
  // applyGKDive validates: parallel-to-goal-line, ≤3 hexes, on-pitch.
  // ARCH-04: broadcastState after success and on all error paths.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_GK_DIVE, (to: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // 1. Null-state guard
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // 2. Phase guard
      if (room.gameState.phase !== 'GK_DIVE') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // 3. HexCoord payload validation (ASVS V5, T-10-09)
      if (
        typeof to !== 'object' ||
        to === null ||
        typeof to.q !== 'number' ||
        typeof to.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room);
        return;
      }
      // 4. Team guard: only the GK's team may reposition (T-10-08)
      if (!controlsGKTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room);
        return;
      }
      // 5. Engine call: validates path membership, ≤3 hexes, on-pitch
      const result = applyGKDive(room.gameState, to);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }

      // 6. Auto-resolve shot immediately after dive (no end-turn needed)
      const afterDiveState = result.state;
      const diveShotDie = rollDice();
      const diveGkDie = rollDice();
      const diveHandlingDie = rollDice();
      const stateForShot: typeof afterDiveState = {
        ...afterDiveState,
        phase: 'SHOT',
        lastActionType: 'SHOT',
      };
      const diveShotResult = applyRoll(stateForShot, diveShotDie, diveGkDie, diveHandlingDie);
      if (!diveShotResult.ok) {
        socket.emit(ServerEvents.GAME_ERROR, diveShotResult.reason);
        broadcastState(io, room);
        return;
      }
      room.gameState = { ...diveShotResult.state, gkDivePosition: null };
      broadcastState(io, room); // ARCH-04
      if (diveShotResult.state.phase === 'FULL_TIME') {
        startReplayStream(io, room);
      }
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // GAME_HEADER_ACCURACY_ACK — attacker acknowledges the high-pass accuracy roll (RULE-01)
  //
  // D-01 (Phase 11): The attacking team must acknowledge the accuracy roll result before
  // contestant selection UI is revealed. This handler clears headerAccuracyRollPending.
  //
  // T-11-02: Only the attacking team can clear the flag (ASVS V4 Spoofing mitigation).
  // SC-5: isProcessing mutex prevents double-click race.
  // ARCH-04: broadcastState after flag clear.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_HEADER_ACCURACY_ACK, () => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard
      if (room.gameState === null || room.gameState.phase !== 'HEADER') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Team guard: only the attacking team can acknowledge (T-11-02)
      if (!controlsAttackingTeam(socket, room)) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // Idempotency guard: flag already cleared — snap-back without state mutation
      if (!room.gameState.headerAccuracyRollPending) {
        broadcastState(io, room);
        return;
      }
      // Clear the pending flag
      room.gameState = { ...room.gameState, headerAccuracyRollPending: null };
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // GAME_HEADER_TARGET — winning team selects target hex after duel resolves (RULE-02, D-05)
  //
  // RULE-02 (Phase 11): winner guard replaces the prior attacker-only guard (T-11-01).
  // The duel was already fired in GAME_HEADER_CONTESTANT when both teams confirmed.
  // headerDuelWinner records which team won; only that team may submit a target hex.
  // applyResolveHeaderTarget validates range against the winning contestant's position (D-06)
  // and transitions to PASS or GK_DIVING without re-rolling dice (Pitfall 4 prevention).
  //
  // T-10-09: HexCoord shape validation (ASVS V5).
  // SC-5: isProcessing mutex.
  // ARCH-04: broadcastState after success and on all error paths.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_HEADER_TARGET, (targetHex: HexCoord) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // 1. Null-state guard
      if (room.gameState === null) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // 2. Phase guard
      if (room.gameState.phase !== 'HEADER') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room);
        return;
      }
      // 3. Both-teams-confirmed guard: target hex only accepted after both teams confirm contestants
      if (!room.gameState.headerConfirmed?.home || !room.gameState.headerConfirmed?.away) {
        socket.emit(ServerEvents.GAME_ERROR, 'HEADER_NOT_CONFIRMED');
        broadcastState(io, room);
        return;
      }
      // 4. HexCoord payload validation (ASVS V5, T-10-09)
      if (
        typeof targetHex !== 'object' ||
        targetHex === null ||
        typeof targetHex.q !== 'number' ||
        typeof targetHex.r !== 'number'
      ) {
        socket.emit(ServerEvents.GAME_ERROR, 'INVALID_TARGET');
        broadcastState(io, room);
        return;
      }
      // 5. Winner guard (RULE-02, D-05, T-11-01): only the duel winner may select the target hex
      const duelWinner = room.gameState.headerDuelWinner;
      if (!duelWinner || socketTeam(socket) !== duelWinner) {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_TEAM');
        broadcastState(io, room); // snap-back
        return;
      }
      // 6. Engine call: validates range against winning contestant's position (D-06), transitions
      //    to PASS or GK_DIVING without re-rolling dice (Pitfall 4 — duel fires exactly once)
      const result = applyResolveHeaderTarget(room.gameState, targetHex);
      if (!result.ok) {
        socket.emit(ServerEvents.GAME_ERROR, result.reason);
        broadcastState(io, room); // snap-back
        return;
      }
      const headerTargetState = result.state;

      // BUGFIX (snapshot-shot-flow-mismatch continuation): applyResolveHeaderTarget routes a
      // goal-line target straight to GK_DIVE with no GK-range gate — unlike GAME_SHOT (step 7)
      // and the SNAPSHOT_DEFLECT end-of-turn handler, which both auto-resolve to GOAL when no
      // shot-path hex is within 3 hexes of the defending GK. Without this gate, a header-at-goal
      // against an out-of-range GK enters GK_DIVE with zero clickable dive hexes (the client's
      // gkDiveTargetSet is correctly empty) and the defending team gets permanently stuck with no
      // available action — perceived as "the path is shown but it's out of range and unselectable."
      // Mirror the same auto-GOAL fallback here for consistency across all three GK_DIVE entry
      // points (regular shot / snapshot / header).
      if (headerTargetState.phase === 'GK_DIVE') {
        const headerShooter = headerTargetState.pieces.find(
          (p) => p.id === headerTargetState.ball.carrierId,
        );
        const headerShotTarget = headerTargetState.shotTargetHex;
        const headerDefTeam: 'home' | 'away' =
          headerTargetState.attackingTeam === 'home' ? 'away' : 'home';
        const headerGk = headerTargetState.pieces.find(
          (p) => p.teamId === headerDefTeam && p.role === 'GK',
        );
        const headerReachablePath =
          headerShooter && headerShotTarget
            ? hexLine(headerShooter.position, headerShotTarget)
            : [];
        const headerGkHasReachable =
          headerGk !== undefined &&
          headerReachablePath.some((h) => hexDistance(headerGk.position, h) <= 3);

        if (!headerGkHasReachable) {
          const scoringTeam = headerTargetState.attackingTeam;
          const newKickOffTeam = headerDefTeam;
          const outDie1 = rollDice();
          const outDie2 = rollDice();
          const outOfRangeEvent: ActionEvent = {
            type: 'SHOT_ATTEMPT',
            shooterId: headerTargetState.ball.carrierId ?? '',
            gkId: headerGk?.id ?? '',
            targetHex: headerShotTarget ?? { q: 0, r: 0 },
            outcome: 'GOAL',
            shooterDie: outDie1,
            shooterScore: null,
            gkDie: outDie2,
            gkScore: null,
            handlingDie: null,
            gkHandling: null,
            shooterPenaltyTotal: 0,
            gkPenaltyTotal: 0,
            timestamp: Date.now(),
            ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
          };
          const newScore = {
            ...headerTargetState.score,
            [scoringTeam]: headerTargetState.score[scoringTeam] + 1,
          };
          // D-01 (BUG-30): hoist once and feed both state.pieces and the GOAL event's
          // piecesAfter so buildReplayFrames reconstructs every piece at the new kickoff
          // formation, not just the ball (mirrors gameEngine.ts's resetPieces pattern).
          const resetPieces = buildKickOffPieces(
            newKickOffTeam,
            headerTargetState.selectedTeams,
            headerTargetState.selectedFormation,
          );
          room.gameState = {
            ...headerTargetState,
            pieces: resetPieces,
            phase: 'KICK_OFF_SETUP',
            score: newScore,
            attackingTeam: newKickOffTeam,
            activeTeam: newKickOffTeam,
            ball: { position: PITCH_REGIONS.kickOffHex, carrierId: null, lastTouchedBy: null }, // kick-off reset — fresh state
            lastDiceRoll: { rolls: [outDie1, outDie2], context: 'SHOT_DUEL' },
            lastActionType: null,
            lastShotPath: null,
            gkDivePosition: null,
            shotTargetHex: null,
            snapshotGkPenalty: null,
            eventLog: [
              ...headerTargetState.eventLog,
              outOfRangeEvent,
              {
                type: 'GOAL' as const,
                scoringTeam,
                scorerId: outOfRangeEvent.shooterId,
                timestamp: Date.now(),
                ballAfter: { position: PITCH_REGIONS.kickOffHex, carrierId: null },
                piecesAfter: resetPieces, // D-01 (BUG-30): reconstruct all pieces at kickoff in replay
              },
            ],
          };
          broadcastState(io, room);
          return;
        }
      }

      room.gameState = headerTargetState;
      // OFFSIDE-02 (D-26): applyResolveHeaderTarget now re-evaluates offsidePieceIds
      // (post-HIGH_PASS_MOVE repositioning) before returning — so triggerOffsideFoul here
      // sees fresh offside data. GK_DIVE path: carrier is the winner piece; PASS occupant
      // path: carrier is the receiving player; PASS loose-ball path: carrierId=null (no-op).
      // D-53: applyOffsideFoulWithRelocation wraps triggerOffsideFoul + relocation.
      room.gameState = applyOffsideFoulWithRelocation(room.gameState);
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });

  // -------------------------------------------------------------------------
  // GAME_HEADER_CONTESTANT — per-team header contestant selection (D-17, ASVS V4)
  //
  // Both teams select their contestant piece during HEADER phase before GAME_ROLL
  // can resolve the heading duel.  Both teams may act (HEADER is two-sided), so
  // isActivePlayer is NOT used here — the ownership check binds selection to the
  // socket's own team slot instead (ASVS V4 Tampering mitigation T-08.2-08).
  //
  // SC-5: isProcessing mutex prevents double-click race.
  // ARCH-04: broadcastState after selection so both clients see opponent's confirm flag.
  // -------------------------------------------------------------------------
  socket.on(ClientEvents.GAME_HEADER_CONTESTANT, (pieceIds: string[] | null) => {
    const { roomCode } = socket.data;
    if (roomCode === undefined) return;
    const room = getRoom(roomCode);
    if (!room || room.isProcessing) return; // SC-5: drop duplicate silently

    room.isProcessing = true;
    try {
      // Phase guard: must be HEADER
      if (room.gameState === null || room.gameState.phase !== 'HEADER') {
        socket.emit(ServerEvents.GAME_ERROR, 'WRONG_PHASE');
        broadcastState(io, room); // snap-back
        return;
      }
      // Determine which team slot this socket controls
      const teamSlot = socket.data.playerSlot === 1 ? 'home' : 'away';

      const ids = pieceIds ?? [];

      // ASVS V4: validate piece ownership — reject any opponent piece
      for (const pieceId of ids) {
        const piece = room.gameState.pieces.find((p) => p.id === pieceId);
        if (!piece || piece.teamId !== teamSlot) {
          socket.emit(ServerEvents.GAME_ERROR, 'INVALID_CONTESTANT');
          broadcastState(io, room); // snap-back
          return;
        }
      }

      // Record the contestant selection and mark this team as confirmed
      const existingContestants = room.gameState.headerContestants ?? {
        home: [],
        away: [],
      };
      const existingConfirmed = room.gameState.headerConfirmed ?? {
        home: false,
        away: false,
      };

      const updatedContestants = { ...existingContestants, [teamSlot]: ids };
      const updatedConfirmed = { ...existingConfirmed, [teamSlot]: true };

      room.gameState = {
        ...room.gameState,
        headerContestants: updatedContestants,
        headerConfirmed: updatedConfirmed,
      };

      // RULE-02 (Phase 11): when both teams have confirmed, fire the heading duel via
      // computeHeaderDuelWinner (pure function — no phase transition) and store the result
      // as headerDuelWinner, staying in HEADER. This re-enables the two-step flow:
      // the winning team then selects a target hex via GAME_HEADER_TARGET, which routes
      // to GK_DIVE (goal-line target) or PASS (any other target) without re-rolling dice.
      // A tie (computeHeaderDuelWinner returns null) has no winner to select a target, so
      // applyRoll is used for that case only, to resolve directly to LOOSE_BALL.
      const bothConfirmed = updatedConfirmed.home === true && updatedConfirmed.away === true;
      if (bothConfirmed) {
        // D-57 (Free Kick Setup — Round 2 Corrections, supersedes D-52): the foul check
        // happens HERE, before any dice are rolled and before computeHeaderDuelWinner is
        // ever called — not after the duel resolves. Merely CONTESTING a header while
        // offside-flagged is itself the foul, regardless of who would have won, lost, or
        // tied. Scan the FULL combined nominated-contestant list (home's ids, then away's,
        // in nomination order — the documented deterministic tiebreak for the rare case of
        // multiple flagged nominees) for any id present in offsidePieceIds. If found, skip
        // rolling dice and skip computeHeaderDuelWinner/the win/tie branches entirely —
        // fire the foul immediately via applyOffsideFoulWithRelocation (D-53) using that
        // contestant's id. Only if NO nominated contestant on either side is flagged does
        // the duel proceed normally (roll dice, resolve winner/tie, etc. — unchanged).
        const allNominatedIds = [
          ...(updatedContestants.home ?? []),
          ...(updatedContestants.away ?? []),
        ];
        const offsideIds = room.gameState.offsidePieceIds ?? [];
        const flaggedContestantId = allNominatedIds.find((id) => offsideIds.includes(id));

        if (flaggedContestantId !== undefined) {
          // D-53: applyOffsideFoulWithRelocation wraps triggerOffsideFoul + relocation.
          room.gameState = applyOffsideFoulWithRelocation(room.gameState, flaggedContestantId);
        } else {
          const atkTeam = room.gameState.attackingTeam;
          const atkCount = updatedContestants[atkTeam]?.length ?? 0;
          const defTeam: 'home' | 'away' = atkTeam === 'home' ? 'away' : 'home';
          const defCount = updatedContestants[defTeam]?.length ?? 0;
          // dice layout: [atk_0..atkN, def_0..defN, atkTieDie, defTieDie]
          const numDice = Math.max(atkCount + defCount + 2, 2);
          const diceArr = Array.from({ length: numDice }, () => rollDice());
          const duelDetail = computeHeaderDuelDetail(room.gameState, diceArr);
          const winner = duelDetail.winner;
          if (winner === null) {
            // Tie: no winner to choose a target hex — resolve directly via applyRoll (LOOSE_BALL).
            const result = applyRoll(room.gameState, ...diceArr);
            if (result.ok) {
              room.gameState = result.state;
            }
            // applyRoll !ok is not expected here (phase is HEADER, contestants are set);
            // if it somehow fails, state is left in HEADER with contestants confirmed so the
            // client can retry via GAME_ROLL (existing fallback path).
          } else {
            // Winner determined — stay in HEADER so the winning team can pick a target hex.
            // Goal-line hexes trigger a shot (GK_DIVE); any other hex is a headed pass (PASS).
            // Quick-task 260621-b8f finding #1: emit the HEADER contest event here so the
            // log shows the contest result before the delivery event.
            const headerEvent: ActionEvent = {
              type: 'HEADER',
              attackerId: duelDetail.attackerId,
              defenderId: duelDetail.defenderId,
              result: winner === room.gameState.attackingTeam ? 'ATTACKER_WIN' : 'DEFENDER_WIN',
              attackerDie: duelDetail.attackerDie,
              attackerAerialAbility: duelDetail.attackerAerialAbility,
              attackerCombined: duelDetail.attackerCombined,
              defenderDie: duelDetail.defenderDie,
              defenderAerialAbility: duelDetail.defenderAerialAbility,
              defenderCombined: duelDetail.defenderCombined,
              timestamp: Date.now(),
            };
            const stateForWinner = {
              ...room.gameState,
              headerDuelWinner: winner,
              eventLog: [...room.gameState.eventLog, headerEvent],
            };
            const winnerPiece = resolveHeaderWinnerPiece(stateForWinner, winner);
            room.gameState = {
              ...stateForWinner,
              headerWinnerId: winnerPiece?.id ?? null,
            };
          }
        }
      }

      // Single broadcastState per handler path (Pitfall 1 — no double-broadcast)
      broadcastState(io, room); // ARCH-04
    } finally {
      room.isProcessing = false; // MUST be in finally — Pitfall 5
    }
  });
}
