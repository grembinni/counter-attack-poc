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
  | 'KICK_OFF';

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
  | { type: 'KICK_OFF'; timestamp: number };

export type GamePhase =
  | 'LOBBY'
  | 'KICK_OFF'
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
};
