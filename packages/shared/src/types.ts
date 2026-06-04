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
  role: 'GK' | 'DEF' | 'MID' | 'FWD';
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
  | 'FULL_TIME';

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
  | { type: 'STEAL_ATTEMPT'; defenderId: string; result: 'SUCCESS' | 'FAIL'; timestamp: number }
  | { type: 'GOAL'; scoringTeam: 'home' | 'away'; timestamp: number }
  | { type: 'KICK_OFF'; timestamp: number }
  // Phase 8 additions — new action subtypes for replay coverage (Claude's Discretion, 08-CONTEXT.md)
  | { type: 'HIGH_PASS'; from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
  | { type: 'LONG_BALL'; from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
  | { type: 'STANDARD_PASS'; from: HexCoord; to: HexCoord; accurate: boolean; timestamp: number }
  | {
      type: 'FIRST_TIME_PASS';
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
  | { type: 'FULL_TIME'; score: { home: number; away: number }; timestamp: number };

export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
  | 'KICK_OFF_SETUP' // Phase 8 (D-23): free repositioning before each kick-off; added here
  | 'MOVEMENT'
  | 'PASS'
  | 'SHOT'
  | 'HEADER'
  | 'SNAPSHOT'
  | 'LOOSE_BALL'
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
};
