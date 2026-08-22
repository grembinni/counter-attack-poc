import type {
  HexCoord,
  GameState,
  GameSpeed,
  TeamType,
  DraftPoolId,
  DraftClientView,
  DraftPickPayload,
  DraftRearrangePayload,
} from './types.js';
import type { TeamId } from './teamConfig.js';
import type { UniformStyleId } from './uniformStyles.js';
import type { FormationId } from './formations.js';

// Typed const objects for Socket.io event names (not TypeScript enums — enums compile
// to IIFEs and don't tree-shake cleanly; const objects emit nothing at runtime).
// Source: socket.io/docs/v4/typescript/

export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  /**
   * BUG-33 (Phase 36) / D-03: host abandons the pre-game settings screen; server deletes
   * the room immediately instead of waiting on the disconnect grace timer.
   */
  LEAVE_ROOM: 'room:leave',
  /** DRAFT-01/D-03 (Phase 27): host confirms speed + team type + draft pools atomically on the pre-game settings screen. */
  ROOM_SETTINGS_CONFIRM: 'room:settings-confirm',
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
  /**
   * DRAFT-06/07 (Phase 29), D-05/D-14: drafts `cardId` from the player's current pack and
   * simultaneously places it at `destination` (lineup slot or bench). This is the only
   * client action that counts as "the pick" and can advance cycle/sub-step state (D-10).
   */
  DRAFT_PICK: 'draft:pick',
  /**
   * DRAFT-06/09 (Phase 29), D-08/D-10: rearranges an already-drafted card between lineup
   * and bench (either direction). Never advances cycle/sub-step state (D-10).
   */
  DRAFT_REARRANGE: 'draft:rearrange',
  /**
   * THROWIN-02 (Phase 37): the attacking manager selects which of their pieces takes the
   * throw. The destination hex is server-owned (`state.throwInHex`) and is deliberately NOT
   * part of the payload so a client can never choose where the throw-in is taken from.
   * Note: goal-kick repositioning (GOAL_KICK_SETUP_GK/OPPONENT) and GOAL_KICK_MOVE
   * deliberately reuse the existing GAME_MOVE + GAME_END_TURN events (the FREE_MOVE_*
   * and GK_KICK_MOVE precedent); throw-in Movement Phases reuse the real MOVE phase's
   * existing events; the throw itself reuses GAME_ROLL. Do not add redundant events here.
   */
  GAME_THROW_IN_PLACE: 'game:throw-in-place',
  /** GOALKICK-03 (Phase 37): mirrors GAME_GK_RESTART's choice-payload shape. */
  GAME_GOAL_KICK_CHOICE: 'game:goal-kick-choice',
  /** GOALKICK-05 (Phase 37): mirrors GAME_GK_KICK_TARGET. */
  GAME_GOAL_KICK_TARGET: 'game:goal-kick-target',
  /**
   * CORNER-01 (Phase 38): reposition a GK during either corner-kick GK reposition window
   * (attacking GK first, then defending GK). Payload mirrors GAME_FREE_KICK_MOVE's
   * pick-up-and-place shape.
   *
   * CORNER-03/CORNER-06 (Phase 38): the reposition windows for those requirements
   * deliberately reuse the existing GAME_MOVE + GAME_END_TURN events (the goal-kick/
   * FREE_MOVE precedent) — no further corner-kick reposition events are to be added.
   */
  GAME_CORNER_KICK_GK_PLACE: 'game:corner-kick-gk-place',
  /**
   * CORNER-02 (Phase 38): the attacking manager selects which of their pieces takes the
   * corner. The destination hex is server-owned (`state.cornerKickHex`) and deliberately
   * NOT part of the payload — mirrors GAME_THROW_IN_PLACE.
   */
  GAME_CORNER_KICK_TAKER: 'game:corner-kick-taker',
  /**
   * FOUL-03/D-01 (Phase 39): fouled attacker's continue-play vs. take-the-restart choice.
   * Mirrors GAME_GK_RESTART's choice-payload shape.
   */
  GAME_FOUL_CHOICE: 'game:foul-choice',
  /** GKDIVE-02/D-07 (Phase 39): GK's team accepts or declines the dive-at-feet offer. */
  GAME_GK_DIVE_AT_FEET: 'game:gk-dive-at-feet',
  /**
   * 39-UAT gap 3 (Phase 39): the GK manager chooses the dive destination hex after accepting
   * the dive-at-feet offer. Mirrors GAME_GK_BOX_ENTRY_MOVE's single-hex payload — the server
   * already knows which goalkeeper is diving from `gkDiveAtFeetGkId`.
   */
  GAME_GK_DIVE_AT_FEET_TARGET: 'game:gk-dive-at-feet-target',
  /** D-10 (Phase 39): GK's team accepts or declines the box-entry response offer. */
  GAME_GK_BOX_ENTRY_RESPONSE: 'game:gk-box-entry-response',
  /** D-10 (Phase 39): GK's repositioning move during GK_BOX_ENTRY_MOVE. Mirrors GAME_GK_DIVE's single-hex payload. */
  GAME_GK_BOX_ENTRY_MOVE: 'game:gk-box-entry-move',
  /**
   * PEN-02 (Phase 39): the attacking manager selects which piece takes the penalty.
   * Mirrors GAME_CORNER_KICK_TAKER — the destination hex is NOT part of the payload;
   * the server places the taker on `state.penaltyKickSpot`.
   *
   * PEN-02's penalty reposition windows deliberately reuse the existing GAME_MOVE +
   * GAME_END_TURN events (handled inside applyMove/applyEndTurn dispatch), exactly as the
   * goal-kick and corner-kick reposition windows already do — do not add redundant
   * reposition events here.
   */
  GAME_PENALTY_KICK_TAKER: 'game:penalty-kick-taker',
  /**
   * SUB-01..07 (Phase 40): a manager-initiated 1-for-1 substitution during any stoppage
   * (`isStoppagePhase`). Payload carries the outgoing on-pitch slot id and the incoming
   * bench player's pool id — see `SubstitutionPayload` below. This is a compile-time
   * convenience only; runtime validation (cap, red-card, no-return) happens server-side
   * in `applySubstitution` (T-40-01).
   */
  GAME_SUBSTITUTION: 'game:substitution',
  /**
   * SUB-08 (Phase 42): a manager-initiated swap of two of their own on-field players'
   * formation positions during a stoppage (`isStoppagePhase`). Payload carries both
   * on-pitch slot ids — see `RosterRepositionPayload` below. Applies instantly on drop
   * with no confirm step (D-02), so server-side validation must be complete: runtime
   * guards (phase, ownership, GK slot, ball carrier) happen in `applyRosterReposition`.
   */
  GAME_ROSTER_REPOSITION: 'game:roster-reposition',
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
  /** DRAFT-01 (Phase 27): broadcast to room members carrying the host's confirmed settings (speed, team type, draft pools). */
  ROOM_SETTINGS_CONFIRMED: 'room:settings-confirmed',
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
  /**
   * DRAFT-06..10 (Phase 29), D-14: emitted per-socket (never `io.to(room).emit`) after every
   * validated DRAFT_PICK/DRAFT_REARRANGE — mirrors LINEUP_ASSIGNMENT_UPDATED's unicast privacy
   * pattern. Carries a DraftClientView scoped to the receiving player only (T-29-PRIV).
   */
  DRAFT_STATE_UPDATED: 'draft:state-updated',
} as const;

/**
 * SUB-01..07 (Phase 40): payload for `GAME_SUBSTITUTION`. `outPieceId` is the on-pitch
 * slot id being vacated (a `PlayerPiece.id`, e.g. `home-3`); `inPlayerId` is the incoming
 * bench player's pool id (a `BenchEntry.playerId`, e.g. `p012`) — deliberately NOT a
 * `PlayerPiece.id`, since a bench player has no slot until the swap resolves.
 */
export type SubstitutionPayload = { outPieceId: string; inPlayerId: string };

/**
 * SUB-08 (Phase 42): payload for `GAME_ROSTER_REPOSITION`. `pieceIdA`/`pieceIdB` are
 * both the caller's OWN on-pitch slot piece ids (`PlayerPiece.id`, e.g. `home-3`) whose
 * occupants are to be swapped. This payload is untrusted client input — both ids are
 * shape-validated (non-empty string) server-side before any `pieces` lookup, and
 * ownership/GK-slot/ball-carrier/phase eligibility are re-checked independently inside
 * `applyRosterReposition`.
 */
export type RosterRepositionPayload = { pieceIdA: string; pieceIdB: string };

/**
 * Typed event map for client-to-server events.
 * Consumed by Server<ClientToServerEvents, ...> in packages/server (Phase 3).
 */
export interface ClientToServerEvents {
  [ClientEvents.ROOM_CREATE]: () => void;
  [ClientEvents.ROOM_JOIN]: (roomCode: string) => void;
  /**
   * BUG-33 (Phase 36) / D-03: host leaves the pre-game settings screen. No payload —
   * the server reads the room to delete from socket.data.roomCode only, so a client can
   * never supply (and therefore never spoof) a room code to delete.
   */
  [ClientEvents.LEAVE_ROOM]: () => void;
  /**
   * DRAFT-01/D-03 (Phase 27): host confirms speed + team type + draft pools together on the
   * pre-game settings screen. Object payload (three always-sent-together fields, consistent
   * with LINEUP_CONFIRM's object payload). Untrusted — fully re-validated server-side.
   */
  [ClientEvents.ROOM_SETTINGS_CONFIRM]: (settings: {
    speed: GameSpeed;
    teamType: TeamType;
    draftPools: DraftPoolId[];
    /** OOB-05/GOALKICK-06 (Phase 37): out-of-bounds detection + restart set game-creation toggle. */
    outOfBounds: boolean;
    /** SETTINGS-01 (Phase 39): Fouls system game-creation toggle. */
    fouls: boolean;
    /** SETTINGS-02 (Phase 39): Booking (cards) game-creation toggle. */
    booking: boolean;
    /** SETTINGS-03 (Phase 39): Injury system game-creation toggle. */
    injury: boolean;
  }) => void;
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
  /**
   * DRAFT-06/07 (Phase 29), D-05/D-14: drafts `cardId` from the sender's current pack and
   * places it at `destination`. Server validates `cardId` is present in the caller's
   * server-tracked current pack — never trusts client-supplied pack contents.
   */
  [ClientEvents.DRAFT_PICK]: (payload: DraftPickPayload) => void;
  /**
   * DRAFT-06/09 (Phase 29), D-08/D-10: rearranges an already-drafted card between `from`
   * and `to` (lineup/bench). Never advances cycle/sub-step state.
   */
  [ClientEvents.DRAFT_REARRANGE]: (payload: DraftRearrangePayload) => void;
  /**
   * THROWIN-02 (Phase 37): the attacking manager selects which of their pieces takes the
   * throw. Destination hex is server-owned (`state.throwInHex`), never client-supplied.
   */
  [ClientEvents.GAME_THROW_IN_PLACE]: (pieceId: string) => void;
  /** GOALKICK-03 (Phase 37): GK's kick-vs-standard-pass restart choice. */
  [ClientEvents.GAME_GOAL_KICK_CHOICE]: (choice: 'kick' | 'standard') => void;
  /** GOALKICK-05 (Phase 37): GK's team selects the goal-kick target hex. */
  [ClientEvents.GAME_GOAL_KICK_TARGET]: (targetHex: HexCoord) => void;
  /**
   * CORNER-01 (Phase 38): reposition a GK during a corner-kick GK reposition window.
   * Mirrors GAME_FREE_KICK_MOVE's (pieceId, to) shape.
   */
  [ClientEvents.GAME_CORNER_KICK_GK_PLACE]: (pieceId: string, to: HexCoord) => void;
  /**
   * CORNER-02 (Phase 38): the attacking manager selects which piece takes the corner.
   * Destination hex is server-owned (`state.cornerKickHex`), never client-supplied.
   */
  [ClientEvents.GAME_CORNER_KICK_TAKER]: (pieceId: string) => void;
  /** FOUL-03/D-01 (Phase 39): fouled attacker's continue-play vs. take-the-restart choice. */
  [ClientEvents.GAME_FOUL_CHOICE]: (choice: 'continue' | 'restart') => void;
  /** GKDIVE-02/D-07 (Phase 39): GK's team accepts or declines the dive-at-feet offer. */
  [ClientEvents.GAME_GK_DIVE_AT_FEET]: (accept: boolean) => void;
  /**
   * 39-UAT gap 3 (Phase 39): the GK manager chooses the dive destination hex. Mirrors
   * GAME_GK_BOX_ENTRY_MOVE's `(to: HexCoord) => void` shape.
   */
  [ClientEvents.GAME_GK_DIVE_AT_FEET_TARGET]: (to: HexCoord) => void;
  /** D-10 (Phase 39): GK's team accepts or declines the box-entry response offer. */
  [ClientEvents.GAME_GK_BOX_ENTRY_RESPONSE]: (accept: boolean) => void;
  /** D-10 (Phase 39): GK's repositioning move during GK_BOX_ENTRY_MOVE. Mirrors GAME_GK_DIVE's single-hex payload. */
  [ClientEvents.GAME_GK_BOX_ENTRY_MOVE]: (to: HexCoord) => void;
  /**
   * PEN-02 (Phase 39): the attacking manager selects which piece takes the penalty.
   * Mirrors GAME_CORNER_KICK_TAKER; the destination hex is NOT part of the payload — the
   * server places the taker on `state.penaltyKickSpot`.
   */
  [ClientEvents.GAME_PENALTY_KICK_TAKER]: (pieceId: string) => void;
  /**
   * SUB-01..07 (Phase 40): a manager-initiated 1-for-1 substitution during any stoppage.
   * See `SubstitutionPayload` above; runtime validation happens server-side.
   */
  [ClientEvents.GAME_SUBSTITUTION]: (payload: SubstitutionPayload) => void;
  /**
   * SUB-08 (Phase 42): a manager-initiated swap of two of their own on-field players'
   * formation positions during a stoppage. See `RosterRepositionPayload` above; runtime
   * validation happens server-side. No `ServerToClientEvents` counterpart is needed —
   * the result is delivered by the existing full-snapshot broadcast, and rejections use
   * the existing `GAME_ERROR` string channel.
   */
  [ClientEvents.GAME_ROSTER_REPOSITION]: (payload: RosterRepositionPayload) => void;
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
  /**
   * DRAFT-01 (Phase 27): broadcast to room members carrying the host's confirmed settings.
   * Positional args (consistent with TEAM_SPEED_CHANGED(speed) / UNIFORM_HOME_CONFIRMED(...)).
   */
  [ServerEvents.ROOM_SETTINGS_CONFIRMED]: (
    speed: GameSpeed,
    teamType: TeamType,
    draftPools: DraftPoolId[],
    /** OOB-05/GOALKICK-06 (Phase 37): out-of-bounds detection + restart set game-creation toggle. */
    outOfBounds: boolean,
    /** SETTINGS-01 (Phase 39): Fouls system game-creation toggle. */
    fouls: boolean,
    /** SETTINGS-02 (Phase 39): Booking (cards) game-creation toggle. */
    booking: boolean,
    /** SETTINGS-03 (Phase 39): Injury system game-creation toggle. */
    injury: boolean,
  ) => void;
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
  /**
   * DRAFT-06..10 (Phase 29), D-14: emitted per-socket (never broadcast) after every
   * validated DRAFT_PICK/DRAFT_REARRANGE. `view` is scoped to the receiving player only —
   * `currentPack` is THIS player's pack, never the opponent's (T-29-PRIV).
   */
  [ServerEvents.DRAFT_STATE_UPDATED]: (view: DraftClientView) => void;
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
