export type HexCoord = { q: number; r: number };

export type PlayerPiece = {
  id: string;
  teamId: 'home' | 'away';
  position: HexCoord;
  pace: number;
  shooting: number;
  tackling: number;
  dribbling: number;
  heading: number;
  saving: number;
  handling: number;
  resilience: number;
  aerialAbility: number;
  /**
   * D-04 (Phase 5): High Pass accuracy attribute.
   * Outfielders: meaningful value (3–8 by position/role).
   * GKs: 0 — GKs use High Pass mechanics for kicks but have low accuracy by design.
   * Context string values for lastDiceRoll: 'PASS_ACCURACY' | 'SHOT_DUEL' | 'HEADING_DUEL' | 'LOOSE_BALL' | 'GK_KICK'
   */
  highPass: number;
  /** Player display name (e.g. 'Home GK', 'Away FWD 1'). TEAM-02 */
  name: string;
  /** Positional role. TEAM-02 */
  role: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ST';
};

export type BallState = {
  position: HexCoord;
  carrierId: string | null;
};

/**
 * Named type for the 4-5-2 movement sub-phase sequence.
 * Exported so ActionEvent and gameEngine can reference it directly. D-07/A1.
 */
export type MovementSlot = 'ATTACKER_4' | 'DEFENDER_5' | 'ATTACKER_2';

/**
 * Referee card leniency attribute. Assigned randomly at match start.
 * Range 1–6 (matches dice face range per MATCH-02). TEAM-03.
 */
export type RefereeCard = {
  leniency: number;
};

/** Discriminant string literals for ActionEvent union. D-07. */
export type ActionEventType =
  | 'MOVE'
  | 'SLOT_ADVANCE'
  | 'DICE_ROLL'
  | 'STEAL_ATTEMPT'
  | 'TACKLE_ATTEMPT'
  | 'GOAL'
  | 'KICK_OFF'
  // Phase 8 additions (D-08 / Claude's Discretion): new action event types for replay coverage
  | 'HIGH_PASS'
  | 'LONG_BALL'
  | 'STANDARD_PASS'
  | 'FIRST_TIME_PASS'
  | 'SHOT_ATTEMPT'
  | 'SNAPSHOT'
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'HEADER'
  | 'HP_REPOSITION'
  | 'HP_ACCURACY'
  | 'HP_MOVE'
  | 'LOOSE_BALL_LAND';

/**
 * Discriminated union of all recordable game actions. D-07, D-08.
 * Appended to GameState.eventLog after each action.
 * Used for undo (D-09, D-10) and end-of-game replay (D-11).
 */
export type ActionEvent =
  | {
      type: 'MOVE';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      slot: MovementSlot;
      timestamp: number;
    }
  | { type: 'SLOT_ADVANCE'; from: MovementSlot; to: MovementSlot | null; timestamp: number }
  | { type: 'DICE_ROLL'; result: number; timestamp: number }
  | {
      type: 'STEAL_ATTEMPT';
      defenderId: string;
      result: 'SUCCESS' | 'FAIL';
      defenderDie: number;
      defenderCombined: number;
      timestamp: number;
    }
  | {
      type: 'TACKLE_ATTEMPT';
      defenderId: string;
      carrierId: string;
      defenderDie: number;
      carrierDie: number;
      defenderCombined: number;
      carrierCombined: number;
      result: 'SUCCESS' | 'FAIL';
      timestamp: number;
    }
  | { type: 'GOAL'; scoringTeam: 'home' | 'away'; timestamp: number }
  | { type: 'KICK_OFF'; timestamp: number }
  // Phase 8 additions — new action subtypes for replay coverage (Claude's Discretion, 08-CONTEXT.md)
  | {
      type: 'HIGH_PASS';
      passerId: string;
      from: HexCoord;
      to: HexCoord;
      accurate: boolean | null;
      timestamp: number;
    }
  | { type: 'LONG_BALL'; from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
  | {
      type: 'STANDARD_PASS';
      /** D-27: passer piece ID for team-colour prefix in ActionLog. */
      passerId: string;
      from: HexCoord;
      to: HexCoord;
      accurate: boolean;
      timestamp: number;
    }
  | {
      type: 'FIRST_TIME_PASS';
      /** D-27: passer piece ID for team-colour prefix in ActionLog. */
      passerId: string;
      from: HexCoord;
      to: HexCoord;
      accurate: boolean;
      timestamp: number;
    }
  | {
      type: 'SHOT_ATTEMPT';
      shooterId: string;
      targetHex: HexCoord;
      outcome: 'GOAL' | 'MISS' | 'SAVE' | 'LOOSE_BALL';
      timestamp: number;
    }
  | { type: 'SNAPSHOT'; shooterId: string; timestamp: number }
  | { type: 'HALF_TIME'; half: 1; score: { home: number; away: number }; timestamp: number }
  | { type: 'FULL_TIME'; score: { home: number; away: number }; timestamp: number }
  | {
      type: 'HEADER';
      /** Attacking team's contestant piece ID, or null if the attacking team declined. */
      attackerId: string | null;
      /** Defending team's contestant piece ID, or null if the defending team declined. */
      defenderId: string | null;
      result: 'ATTACKER_WIN' | 'DEFENDER_WIN' | 'TIE';
      /** Dice and stats — null for uncontested headers (no dice rolled). */
      attackerDie: number | null;
      attackerHeading: number | null;
      attackerCombined: number | null;
      defenderDie: number | null;
      defenderHeading: number | null;
      defenderCombined: number | null;
      timestamp: number;
    }
  | {
      type: 'HP_REPOSITION';
      slot: 'ATTACKER' | 'DEFENDER';
      pieceId: string | null;
      timestamp: number;
    }
  | { type: 'HP_ACCURACY'; passerId: string; accurate: boolean; timestamp: number }
  | {
      type: 'HP_MOVE';
      slot: 'ATTACKER' | 'DEFENDER';
      pieceId: string;
      from: HexCoord;
      to: HexCoord;
      timestamp: number;
    }
  | { type: 'LOOSE_BALL_LAND'; from: HexCoord; to: HexCoord; timestamp: number };

export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
  | 'KICK_OFF_SETUP' // Phase 8 (D-23): free repositioning before each kick-off; added here
  | 'MOVEMENT'
  | 'PASS'
  | 'SHOT_DECLARED' // new: shot declared, awaiting GK dive
  | 'GK_DIVING' // new: GK's team repositions GK interactively
  | 'SNAP_DEFLECT' // new: opponent moves 1 player before snapshot resolves
  | 'SHOT'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'LOOSE_BALL'
  | 'HIGH_PASS_MOVEMENT' // Pre-accuracy repositioning phase for high pass
  | 'GK_RESTART'
  | 'HALF_TIME'
  | 'FULL_TIME'
  | 'REPLAY';

/**
 * D-06: Records the type of the last completed action in the current sequence.
 * Used by the server to validate the proposed next action against ELIGIBLE_NEXT_ACTIONS (D-07/D-08).
 * null at match start, after each kick-off reset, and after goal scored.
 * Set to 'SUCCESSFUL_TACKLE' when a steal ends the Movement Phase early (D-14).
 * Set to 'DEFLECTION' when LOOSE_BALL resolves from any source (D-20).
 */
export type LastActionType =
  | 'MOVEMENT_PHASE'
  | 'SUCCESSFUL_TACKLE'
  | 'STANDARD_PASS'
  | 'FIRST_TIME_PASS'
  | 'HIGH_PASS'
  | 'LONG_BALL'
  | 'HEADER'
  | 'DEFLECTION'
  | 'SNAPSHOT'
  | 'SHOT';

export type GameState = {
  roomCode: string;
  phase: GamePhase;
  activeTeam: 'home' | 'away';
  pieces: readonly PlayerPiece[];
  ball: BallState;
  score: { home: number; away: number };
  actionCount: number;
  half: 1 | 2;
  /** D-08: Typed action event log. Replaces readonly unknown[] placeholder. */
  eventLog: readonly ActionEvent[];
  /** TEAM-03: Referee card drawn at match start. leniency range 1–6. */
  refereeCard: RefereeCard;
  /** A1: Team currently in possession / attacking. Set at KICK_OFF, constant through Movement Phase. */
  attackingTeam: 'home' | 'away';
  /**
   * D-08: Movement-phase tracking fields.
   * Default values when outside MOVEMENT phase: `[]`, `{}`, `null`.
   *
   * - movedPieceIds: IDs of pieces that have completed their movement in the
   *   current Movement Phase. Empty (`[]`) outside MOVEMENT phase.
   * - paceUsedByPieceId: Cumulative hexes moved per piece in the current
   *   Movement Phase. Empty (`{}`) outside MOVEMENT phase.
   * - movementSlot: Which 4-5-2 sub-phase is currently active.
   *   `null` outside MOVEMENT phase.
   */
  movedPieceIds: readonly string[];
  paceUsedByPieceId: Readonly<Record<string, number>>;
  movementSlot: MovementSlot | null;
  /**
   * D-15 / MOVE-06: set when the ball carrier crosses between final thirds.
   * Grants the scoring team a free 6-hex movement. Phase 5 enforces the grant.
   * null or absent when no free move is pending.
   */
  pendingFreeMove?: { team: 'home' | 'away'; hexesAllowed: number } | null;
  /**
   * D-11 / Phase 5: Dice rolls from the most recent dice action.
   * Embedded in GameState so both clients see the rolls before rendering the outcome.
   * null when no dice have been rolled yet (KICK_OFF, LOBBY phases).
   * Context string values: 'PASS_ACCURACY' | 'SHOT_DUEL' | 'HEADING_DUEL' | 'LOOSE_BALL' | 'GK_KICK'
   */
  lastDiceRoll?: {
    rolls: number[]; // ordered dice values; length varies by context (1–3)
    context: string;
  } | null;
  // Phase 8 additions — match lifecycle fields (D-06, D-27, D-31)
  /** D-06: null until actionCount first crosses 45; set once per half via inline dice roll (D-05). */
  addedTime: number | null;
  /** D-06: null at match start and after kick-off reset; updated after every action. */
  lastActionType: LastActionType | null;
  /** D-06: team that kicked off the first half; determines second-half kick-off assignment (D-26). */
  kickOffTeam: 'home' | 'away';
  /**
   * D-27 / MATCH-03: true from KICK_OFF_SETUP → KICK_OFF → MOVEMENT transition until the first
   * accurate Standard Pass originating from the centre hex resolves. While true, the server must
   * reject any ball action that is not a Standard Pass from kickOffHex. Cleared to false after the
   * first accurate Standard Pass resolves.
   */
  kickOffActive: boolean;
  /** D-31: 1-based replay frame position carried on REPLAY-phase frames only; absent outside replay. */
  replayIndex?: number;
  /** D-31: total replay frame count carried on REPLAY-phase frames only; absent outside replay. */
  replayTotal?: number;
  /**
   * SNAP-02: true when the current SHOT phase was entered via applySnapshot.
   * The SHOT branch in applyRoll applies a -1 shooter dice penalty when this is set.
   * Cleared to false after the shot resolves (goal, miss, save, loose ball).
   */
  snapshotPenalty?: boolean;
  /**
   * D-10 (Phase 8.2): Target hex for the in-flight Long/High pass.
   * Set by the GAME_ROLL handler before applyRoll; consumed and cleared by the applyRoll PASS branch.
   * null or absent outside the PASS phase accuracy-check sequence.
   */
  passTargetHex?: HexCoord | null;
  /**
   * D-17 (Phase 8.2): Per-team selected contestant piece IDs during HEADER phase.
   * home/away are arrays of piece IDs; empty array means the team declined (no contestant).
   * null or absent outside the HEADER phase.
   */
  headerContestants?: { home: string[]; away: string[] } | null;
  /**
   * D-17 (Phase 8.2): Confirmation flags for header contestant selection.
   * true once a team submits its contestant; GAME_ROLL for HEADER requires both true.
   * null or absent outside the HEADER phase.
   */
  headerConfirmed?: { home: boolean; away: boolean } | null;
  /**
   * D-21 / HEAD-05 (Phase 8.2): IDs of pieces that contested a header this sequence.
   * These pieces are excluded from the subsequent Movement Phase.
   * Cleared to empty array in applyStartMovement.
   */
  contestedPieceIds?: readonly string[];
  /**
   * D-11 (Phase 8.2): Dice pre-rolled by the GAME_ROLL handler for each interceptor
   * in validatePass's interceptors list. Consumed and cleared by the applyRoll PASS branch
   * interception loop. Absent or empty when no interception roll is pending.
   */
  preGeneratedInterceptionDice?: number[];
  /**
   * HIGH_PASS_MOVEMENT phase: which team's repositioning slot is active.
   * 'ATTACKER' → attacking team moves first; 'DEFENDER' → defending team moves.
   * null or absent outside HIGH_PASS_MOVEMENT phase.
   */
  highPassMovementSlot?: 'ATTACKER' | 'DEFENDER' | null;
  /**
   * HIGH_PASS_MOVEMENT phase: the piece ID chosen for this team's repositioning slot.
   * Locked to the first piece moved; subsequent moves must use the same piece.
   * null if no piece has been moved yet in the current slot.
   */
  highPassMovedPieceId?: string | null;
  /**
   * HIGH_PASS_MOVEMENT phase: cumulative hexes moved by highPassMovedPieceId in the current slot.
   * Capped at 3. Reset to 0 at each slot transition.
   */
  highPassPaceUsed?: number;
  /**
   * HIGH_PASS_MOVEMENT phase: the piece ID of the player who kicked the high pass.
   * Preserved so applyRoll can look up the kicker's highPass stat after ball.carrierId is cleared.
   * null or absent outside HIGH_PASS_MOVEMENT phase.
   */
  highPassCarrierId?: string | null;
  /** Phase 10 HEAD-03: target hex selected by header attacker; null outside HEADER phase. */
  headerTargetHex?: HexCoord | null;
  /** Phase 10 SHOT_DECLARED: goal hex the shooter declared. */
  shotTargetHex?: HexCoord | null;
  /** Phase 10 GK_DIVING: GK's current position during GK_DIVING phase. */
  gkDivePosition?: HexCoord | null;
  /** Phase 10 D-29: piece IDs that already attempted a steal this movement phase. */
  stealAttemptedByIds?: readonly string[];
  /** Phase 10 D-29: piece IDs that already attempted a tackle this movement phase. */
  tackleAttemptedByIds?: readonly string[];
  /** Phase 10 SNAP_DEFLECT: ID of the first piece moved during snap deflection. */
  snapDeflectMovedPieceId?: string | null;
  /** Phase 10 SNAP_DEFLECT: number of hexes moved so far during snap deflection (max 2). */
  snapDeflectPaceUsed?: number;
};
