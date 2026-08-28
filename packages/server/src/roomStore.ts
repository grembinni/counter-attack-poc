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
import type { GamePhase, GameState, GameSpeed, HexCoord } from '@counter-attack/shared';
import type {
  TeamId,
  UniformStyleId,
  FormationId,
  TeamType,
  DraftPoolId,
  DraftSession,
} from '@counter-attack/shared';
import { ServerEvents } from '@counter-attack/shared';
import type { Server } from 'socket.io';
import {
  applyFreeMoveZoneCheck,
  computeBoxEntryOffer,
  computeGkDiveAtFeetOffer,
} from './gameEngine.js';
import { foldMatchStats } from './matchStatsReducer.js';

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
  /**
   * D-06: Records the shooter's target hex for UX/broadcast after a game:shot event.
   * Server-side UX bookkeeping only — never fed into dice resolution.
   * applyRoll resolves SHOT from dice only and does not read this field.
   */
  shotTarget?: HexCoord | null;
  /**
   * D-31 / Phase 8: Replay streaming interval handle.
   * Set when the REPLAY phase begins; must be cleared in deleteRoom (Pitfall 4)
   * and on disconnect during REPLAY to prevent post-deletion emit leaks.
   */
  replayTimer?: ReturnType<typeof setInterval> | null;
  /**
   * D-24 / Phase 8: Tracks which player slots have confirmed "Ready" during KICK_OFF_SETUP.
   * Pattern 4 (PATTERNS.md): Set<1|2> so each socket can only mark its own slot ready.
   * Cleared when transitioning out of KICK_OFF_SETUP.
   */
  readyPlayers?: Set<1 | 2> | null;
  /**
   * Phase 16 / D-11: The team chosen by home player (slot 1) during team selection.
   * undefined = home has not yet picked; set once home picks; used to gate away's pick.
   * Cleared (irrelevant) once gameState is built — gameState.selectedTeams becomes the source of truth.
   */
  homePickedTeam?: TeamId;
  /**
   * UX-07 (Phase 18.4): The game speed chosen by the home player before match start.
   * undefined = not yet set (defaults to 'standard' when building initial state).
   * Set by TEAM_SPEED_SET handler; consumed when building game state in TEAM_PICK away-pick.
   */
  gameSpeed?: GameSpeed;
  /** DRAFT-01 (Phase 27): team type confirmed on the settings pre-step. undefined until confirmed. */
  teamType?: TeamType;
  /** DRAFT-01 (Phase 27): draft pools confirmed on the settings pre-step (only meaningful if teamType === 'draft'). */
  draftPools?: DraftPoolId[];
  /**
   * GOALKICK-06 / OOB-05 (Phase 37): Out-of-Bounds/Restarts toggle confirmed on the
   * settings pre-step. `undefined` = not yet confirmed and is treated as `false`
   * (disabled) when building game state. Independent of Fouls/Booking/Injury, which
   * are Phase 39 toggles.
   */
  outOfBoundsEnabled?: boolean;
  /**
   * SETTINGS-01/FOUL-05 (Phase 39): Fouls system toggle confirmed on the settings pre-step.
   * `undefined` = not yet confirmed and is treated as `false` (disabled) when building game
   * state. Independent of Booking/Injury/Out-of-Bounds toggles.
   */
  foulsEnabled?: boolean;
  /**
   * SETTINGS-02/CARD-04 (Phase 39): Booking (cards) toggle confirmed on the settings
   * pre-step. `undefined` = not yet confirmed and is treated as `false` (disabled) when
   * building game state. Independent of Fouls/Injury/Out-of-Bounds toggles.
   */
  bookingEnabled?: boolean;
  /**
   * SETTINGS-03/INJURY-04 (Phase 39): Injury system toggle confirmed on the settings
   * pre-step. `undefined` = not yet confirmed and is treated as `false` (disabled) when
   * building game state. Independent of Fouls/Booking/Out-of-Bounds toggles.
   */
  injuryEnabled?: boolean;
  /**
   * TACKLE-01 (Phase 43): Tackle/Steal decline-prompt toggle confirmed on the settings
   * pre-step. `undefined` = not yet confirmed and is treated as `false` (disabled) when
   * building game state. Independent of Fouls/Booking/Injury/Out-of-Bounds toggles.
   */
  tackleStealDeclineEnabled?: boolean;
  /**
   * REFEREE-01 (Phase 44): manual Referee Leniency override toggle confirmed on the settings
   * pre-step. `undefined` = not yet confirmed and is treated as `false` (i.e. keep the random
   * roll) when building game state. Independent of every other toggle.
   */
  refereeLeniencyOverrideEnabled?: boolean;
  /**
   * REFEREE-02 (Phase 44): the host-selected 2-5 Leniency value, already range-validated by
   * the ROOM_SETTINGS_CONFIRM handler before it is stored. `undefined` means no override was
   * confirmed.
   */
  refereeLeniencyValue?: number;
  /**
   * DRAFT-01/D-03 (Phase 27): true once host has confirmed settings — gates TEAM_SELECTION_START
   * alongside "slot 2 has joined" (see roomHandlers.ts ROOM_SETTINGS_CONFIRM / ROOM_JOIN).
   */
  settingsConfirmed?: boolean;
  /**
   * Phase 22 D-13: away's team stored on second TEAM_PICK; game state deferred until
   * both players confirm team + uniform style via UNIFORM_CONFIRM.
   * undefined = away has not yet picked; set when away sends TEAM_PICK; consumed by UNIFORM_CONFIRM.
   */
  awayPickedTeam?: TeamId;
  /**
   * Phase 22 D-15: set on home's UNIFORM_CONFIRM; presence gates away's confirm branch.
   * undefined = home has not yet confirmed; defined = home confirmed, away may now confirm.
   */
  homePickedUniformStyle?: UniformStyleId;
  /** Jersey variant chosen by home player ('home' kit or 'away' kit). Defaults to 'home' if absent. */
  homePickedJerseyType?: 'home' | 'away';
  /**
   * Phase 24: uniform style confirmed by away player on their UNIFORM_CONFIRM.
   * Not stored in Phase 22/23 because buildInitialGameState was called immediately.
   * Phase 24 defers that call to LINEUP_CONFIRM, so away's style must be stored here.
   * undefined = away has not yet confirmed.
   */
  awayPickedUniformStyle?: UniformStyleId;
  /**
   * Phase 24: jersey variant ('home'/'away' kit) chosen by away player on their UNIFORM_CONFIRM.
   * Mirrors homePickedJerseyType. Defaults to 'away' in LINEUP_CONFIRM if absent.
   */
  awayPickedJerseyType?: 'home' | 'away';
  /**
   * Phase 23 D-12: formation chosen by home player on their UNIFORM_CONFIRM.
   * undefined = home has not yet confirmed; defined once home confirms.
   */
  homePickedFormation?: FormationId;
  /**
   * Phase 23 D-12: formation chosen by away player on their UNIFORM_CONFIRM.
   * undefined = away has not yet confirmed; defined once away confirms.
   */
  awayPickedFormation?: FormationId;
  /**
   * Phase 24 D-06: Auto-assignment result for the home team. PlayerId[] of 11 entries where
   * index i maps to FORMATIONS[homePickedFormation].slots[i].
   * Set in the UNIFORM_CONFIRM away-branch (after both formations confirmed);
   * mutated by LINEUP_SWAP (home player may swap outfield entries);
   * consumed by LINEUP_CONFIRM (resolved to PoolPlayer[] and passed to buildInitialGameState).
   * null / undefined = assignments not yet computed (UNIFORM_CONFIRM away-branch not yet reached).
   */
  homeAssignment?: string[] | null;
  /**
   * Phase 24 D-06: Auto-assignment result for the away team. PlayerId[] of 11 entries where
   * index i maps to FORMATIONS[awayPickedFormation].slots[i].
   * Set in the UNIFORM_CONFIRM away-branch (after both formations confirmed);
   * mutated by LINEUP_SWAP (away player may swap outfield entries);
   * consumed by LINEUP_CONFIRM (resolved to PoolPlayer[] and passed to buildInitialGameState).
   * null / undefined = assignments not yet computed.
   */
  awayAssignment?: string[] | null;
  /**
   * Phase 24 D-10: true after home player (slot 1) emits LINEUP_CONFIRM.
   * Set by the LINEUP_CONFIRM handler; never reset after setting.
   * When both homeLineupConfirmed and awayLineupConfirmed are true, buildInitialGameState fires.
   */
  homeLineupConfirmed?: boolean;
  /**
   * Phase 24 D-10: true after away player (slot 2) emits LINEUP_CONFIRM.
   * Set by the LINEUP_CONFIRM handler; never reset after setting.
   * When both homeLineupConfirmed and awayLineupConfirmed are true, buildInitialGameState fires.
   */
  awayLineupConfirmed?: boolean;
  /**
   * Phase 29 (DRAFT-06..10): live draft session for teamType==='draft' rooms.
   * undefined/null until ROOM_SETTINGS_CONFIRM bootstraps it. Holds cycle/sub-step,
   * per-player packs, drafted ids, lineup/bench state (D-04/D-13).
   */
  draftSession?: DraftSession | null;
  /**
   * D-10 (Phase 39, 39-15): the ball's position as of the PREVIOUS `broadcastState`
   * call. Exists solely so `computeBoxEntryOffer` can compare the pre-action ball
   * position without a retroactive `eventLog` scan — the same reasoning
   * `ball.lastTouchedBy` was introduced with in Phase 37 (RESEARCH.md ARCHITECTURE.md
   * Q2: never derive retroactively from an event-log scan). `undefined`/`null` before
   * the first broadcast of a match; set at the end of every `broadcastState` call where
   * `gameState` is non-null.
   */
  lastBroadcastBallPosition?: HexCoord | null;
  /**
   * Phase 45 Plan 03 (STATS-04/05/06/09): the previous broadcast's `eventLog` length,
   * `actionCount`, and `attackingTeam` — the three baselines `foldMatchStats` needs to
   * see exactly what changed since the last broadcast without a retroactive `eventLog`
   * scan (forbidden by D-05, mirroring `lastBroadcastBallPosition`'s own reasoning).
   * `lastBroadcastAttackingTeam` specifically exists because the possession delta must
   * be credited to the PRE-action attacking team, not whatever team is attacking after
   * the action resolves (45-RESEARCH.md Pitfall 5) — a turnover mid-broadcast would
   * otherwise silently credit the wrong team's clock. `undefined`/`null` before the
   * first broadcast of a match, exactly like `lastBroadcastBallPosition`.
   */
  lastBroadcastEventLogLength?: number;
  lastBroadcastActionCount?: number;
  lastBroadcastAttackingTeam?: 'home' | 'away';
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

  // 4. Success path: assign slot 2, transition to 'playing'.
  // Phase 16 D-10: gameState stays null until both teams are selected via team:pick.
  // buildInitialGameState is called only after away pick in roomHandlers TEAM_PICK handler.
  const sessionToken = randomUUID();
  room.players[1] = { socketId, sessionToken, slot: 2 };
  room.status = 'playing';

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
    // Phase 8 / Pitfall 4: clear replay timer to prevent post-deletion emit leak (D-31)
    if (room.replayTimer) clearInterval(room.replayTimer);
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
 * D-10 (Phase 39, 39-15): the ONLY phases the box-entry offer hook
 * (`computeBoxEntryOffer`) may fire from — an inclusion whitelist rather than an
 * exclusion blacklist.
 *
 * Rule 1 auto-fix (discovered wiring this task against the full existing suite): a
 * blacklist naming every "restart-setup"/"Phase 39 prompt" phase is under-inclusive in
 * a different, more damaging way than over-inclusive — the ball landing inside a
 * penalty area as the DIRECT, ALREADY-ESTABLISHED consequence of an in-progress
 * shot/header/corner/penalty/GK-catch sequence (SNAPSHOT_TARGET → SNAPSHOT_DEFLECT →
 * GK_DIVE → GK_RESTART; HEADER → GK_DIVE; a corner's HIGH_PASS_MOVE/HEADER delivery;
 * LOOSE_BALL from a tied penalty) is NOT a restart-SETUP phase and was not excluded by
 * the original blacklist, yet offering a SECOND, unrelated GK interrupt on top of a
 * duel/catch/reposition window that's ALREADY resolving the exact same "ball entered
 * the box" situation is nonsensical and hijacks the existing, correct flow (confirmed
 * by 8 pre-existing regression suites spanning shot/header/corner/FTP/GK-restart
 * scenarios). A whitelist of the three genuinely "ordinary open play" phases — the
 * carrier walking the ball in (`MOVE`), a delivered pass landing it there (`PASS`), or
 * a scattered loose ball settling there (`LOOSE_BALL`) — is the correct, narrow scope:
 * every other phase already has its own dedicated GK-interaction mechanic (GK_DIVE for
 * shots/headers, GK_RESTART for catches, the restart-setup chains for kick-off/
 * throw-in/goal-kick/corner-kick/free-kick/penalty-kick, and the Phase 39 prompt phases
 * themselves) that must not be double-interrupted. TACKLE_STEAL_PROMPT (Phase 43,
 * 43-02) joins that list of prompt phases that must not be double-interrupted — the
 * ball has not moved while the defending manager decides whether to challenge, so it is
 * deliberately NOT added to this whitelist.
 */
const GK_BOX_ENTRY_PHASES: ReadonlySet<GamePhase> = new Set<GamePhase>([
  'MOVE',
  'PASS',
  'LOOSE_BALL',
]);

/**
 * Broadcasts the current game state to all sockets in the room.
 *
 * ARCH-04: server broadcasts full game state snapshot after every validated action;
 * never differential patching. This is the single ARCH-04 entry point — every Phase 4+
 * handler calls this after any state mutation.
 *
 * No-op if room.gameState is null (room not yet in-game).
 *
 * MOVE-06 (Phase 17, corrected design D-33): runs the centralized ball-zone-triggered
 * free-move check immediately before broadcasting, so the FREE_MOVE_ATTACK/
 * FREE_MOVE_DEFENSE overlay fires after literally any resolved action with zero
 * per-handler changes elsewhere.
 *
 * D-10/GKDIVE-02 (Phase 39, 39-15): immediately after the free-move zone check and
 * before the snapshot is emitted, runs a single offer-hook block that fires AT MOST
 * ONE offer per broadcast — mirroring `applyFreeMoveZoneCheck` as the single ARCH-04
 * entry point so both goalkeeper interrupts fire after literally any action with zero
 * per-handler wiring elsewhere. Box entry (D-10) is checked FIRST — a ball entering the
 * box is the more urgent response — and dive-at-feet (GKDIVE-02) only when box entry did
 * not fire. This must stay a pure phase substitution: never emits a second snapshot,
 * never calls broadcastState recursively.
 *
 * @param io - Socket.io Server instance
 * @param room - The room whose state should be broadcast
 */
export function broadcastState(io: Server, room: Room): void {
  if (room.gameState === null) return;
  room.gameState = applyFreeMoveZoneCheck(room.gameState);

  // Phase 45 Plan 03 (STATS-04/05/06/09, PD-11): fold newly-appended eventLog events
  // plus the possession delta into matchStats BEFORE the `state` capture below, so
  // every downstream spread later in this function (the GK_BOX_ENTRY_PROMPT and
  // GK_DIVE_AT_FEET_PROMPT phase substitutions) carries the folded matchStats forward
  // automatically — inserting this after those hooks would require auditing each
  // hook's spread for field preservation instead.
  {
    const preFoldState = room.gameState;
    const prevEventLogLength = room.lastBroadcastEventLogLength ?? preFoldState.eventLog.length;
    const prevActionCount = room.lastBroadcastActionCount ?? preFoldState.actionCount;
    const prevAttackingTeam = room.lastBroadcastAttackingTeam ?? preFoldState.attackingTeam;

    // PD-13: applyUndo can shrink eventLog by one since the previous broadcast (it
    // never touches actionCount). Clamp the previous length down to the CURRENT
    // length before slicing so a shrunken log can never produce an out-of-range
    // (negative-start) slice.
    const clampedPrevLength = Math.min(prevEventLogLength, preFoldState.eventLog.length);
    const newEvents = preFoldState.eventLog.slice(clampedPrevLength);
    const actionCountDelta = preFoldState.actionCount - prevActionCount;

    // Only fold when there is something to fold — a non-empty slice or a non-zero
    // action-count delta — so a broadcast that changes neither (e.g. an immediate
    // repeat call) leaves matchStats referentially untouched.
    if (newEvents.length > 0 || actionCountDelta !== 0) {
      room.gameState = {
        ...preFoldState,
        matchStats: foldMatchStats(preFoldState.matchStats, newEvents, preFoldState.pieces, {
          team: prevAttackingTeam,
          actionCountDelta,
        }),
      };
    }
  }

  const state = room.gameState;
  const prevBallPosition = room.lastBroadcastBallPosition ?? state.ball.position;

  // D-10: box entry, checked FIRST.
  if (GK_BOX_ENTRY_PHASES.has(state.phase)) {
    const boxEntryOffer = computeBoxEntryOffer(prevBallPosition, state);
    if (boxEntryOffer !== null) {
      room.gameState = {
        ...state,
        phase: 'GK_BOX_ENTRY_PROMPT',
        gkBoxEntryTeam: boxEntryOffer.team,
        activeTeam: boxEntryOffer.team,
        gkBoxEntryResume: {
          phase: state.phase,
          activeTeam: state.activeTeam,
          movementSlot: state.movementSlot,
        },
      };
    }
  }

  // GKDIVE-02: dive at feet, checked only when box entry did NOT fire above (referential
  // equality against the pre-block `state` snapshot is the "did box entry fire?" check —
  // guarantees at most one offer per invocation without a separate boolean flag).
  // FOUL-05: the offer itself is gated on `foulsEnabled === true` — FOUL-05 explicitly
  // lists "GK-dive-at-feet" among what the Fouls toggle enables ("Fouls (detection,
  // injury, GK-dive-at-feet, professional-foul check, and the resulting restart)"). The
  // box-entry offer above is a D-10 scope expansion, not part of any toggle's locked
  // scope, so it is NOT gated the same way.
  //
  // Rule 1 auto-fix (discovered writing this task's integration suite): unlike
  // `computeBoxEntryOffer`, `computeGkDiveAtFeetOffer` is LEVEL-triggered, not
  // edge-triggered — it has no "previous state" concept and simply reports whether the
  // carrier is CURRENTLY within range with the cap unset. Without a change-detection
  // guard, declining the offer would immediately re-offer on the SAME decline response's
  // own `broadcastState` call (the carrier hasn't moved, so the condition is still true)
  // — the manager could never actually decline and resume play without first moving the
  // carrier out of range. The `ballPositionChanged` check applies the identical
  // edge-triggered principle `computeBoxEntryOffer` already uses, reusing the same
  // `prevBallPosition` snapshot: only offer when the ball has actually moved since the
  // last broadcast (a real qualifying MOVE), never on a broadcast that merely re-confirms
  // an unchanged position (e.g. a decline's own resume-phase broadcast).
  const ballPositionChanged =
    prevBallPosition.q !== state.ball.position.q || prevBallPosition.r !== state.ball.position.r;
  if (
    room.gameState === state &&
    state.phase === 'MOVE' &&
    state.foulsEnabled === true &&
    ballPositionChanged
  ) {
    const diveOffer = computeGkDiveAtFeetOffer(state);
    if (diveOffer !== null) {
      room.gameState = {
        ...state,
        phase: 'GK_DIVE_AT_FEET_PROMPT',
        gkDiveAtFeetTeam: diveOffer.team,
        gkDiveAtFeetGkId: diveOffer.gkId,
        gkDiveAtFeetCarrierId: diveOffer.carrierId,
        gkDiveAtFeetDistance: diveOffer.distance,
        activeTeam: diveOffer.team,
        gkDiveAtFeetResume: {
          phase: state.phase,
          activeTeam: state.activeTeam,
          movementSlot: state.movementSlot,
        },
      };
    }
  }

  // TACKLE-02 (Phase 43, 43-02): do NOT advance the edge-trigger baseline while a
  // tackle/steal prompt is open. A TACKLE_STEAL_PROMPT broadcast happens with the ball
  // already at its post-move hex but with both goalkeeper offers skipped (box entry
  // because TACKLE_STEAL_PROMPT is not in GK_BOX_ENTRY_PHASES, dive-at-feet because its
  // guard requires phase === 'MOVE'). Advancing the baseline here would make
  // `ballPositionChanged` false on the resume broadcast, permanently swallowing a
  // goalkeeper offer that would have fired without the toggle.
  if (room.gameState.phase !== 'TACKLE_STEAL_PROMPT') {
    room.lastBroadcastBallPosition = room.gameState.ball.position;
  }

  // Phase 45 Plan 03 (PD-12): these three match-stats baselines advance
  // UNCONDITIONALLY, placed OUTSIDE the TACKLE_STEAL_PROMPT guard above. That guard
  // exists to protect a DIFFERENT, Phase-43-specific goalkeeper edge trigger (it
  // needs `ballPositionChanged` to stay true across the prompt so a suppressed offer
  // isn't permanently swallowed) — it does not apply here. Suppressing these
  // baselines during a tackle/steal prompt would instead make the SAME
  // already-folded event slice look "new" again on the resume broadcast, double-
  // counting every statistic produced during the prompt.
  room.lastBroadcastEventLogLength = room.gameState.eventLog.length;
  room.lastBroadcastActionCount = room.gameState.actionCount;
  room.lastBroadcastAttackingTeam = room.gameState.attackingTeam;

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
